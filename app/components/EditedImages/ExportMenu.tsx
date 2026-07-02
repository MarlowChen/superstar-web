"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { FabricEditorHandle, SelectedLayerTransform, StageLayerItem } from "./FabricStage";
import { writePsd, type WriteOptions } from "ag-psd";
import { Canvas, FabricObject, TFiller, TMat2D } from "fabric";
import {  convertToCompositorFormatCrop } from "./Compositorutils";
import { useTranslations } from "next-intl";

/* ================= Utils ================= */
function dataURLtoBlob(dataUrl: string) {
  const [header, data] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(header)?.[1] || "application/octet-stream";
  const bin =
    typeof atob !== "undefined" ? atob(data) : Buffer.from(data, "base64").toString("binary");
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ============== Helper 物件隱藏（紫框/導線/框） ============== */
function isHelperObject(o: FabricObject) {
  const stroke = (o as FabricObject).stroke;
  const data = (o as FabricObject).data;

  const isPurpleStroke =
    typeof stroke === "string" && stroke.toLowerCase() === "#7c3aed"; // 你說的紫色框

  const taggedHelper =
    data?.helper === true || data?.isGuide === true || data?.isFrame === true;

  return Boolean(isPurpleStroke || taggedHelper);
}

function hideHelpers(canvas: Canvas) {
  const hidden: FabricObject[] = [];
  (canvas.getObjects() as FabricObject[]).forEach((o) => {
    if (isHelperObject(o) && o.visible !== false) {
      o.visible = false;
      hidden.push(o);
    }
  });
  return () => hidden.forEach((o) => (o.visible = true));
}

/* ================= Types / Props ================= */
type FileType = "png" | "jpg" | "psd";

export type ExportMenuProps = {
  api: FabricEditorHandle | null;
  filename?: string;
  getLayers?: () => StageLayerItem[]; // 有→保層 PSD；無→扁平 PSD
  backgroundVisible?: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anchorRef: React.RefObject<HTMLElement>;
};

/* =========================================================
   ⭐ 核心：離屏快照（clone → 移除 helper → 對齊 artboard）
   - 不動主畫布幾何
   - 尺寸固定使用 artboard.width/height（或你指定）
   - 完全忽略 artboard 的 left/top 於輸出尺寸；left/top 只用來對齊視窗
   - multiplier 只放大像素輸出
   ========================================================= */
async function snapshotOffscreenArtboard(
  canvas: Canvas,
  getArtboardRect: () =>
    | { left: number; top: number; width: number; height: number }
    | null,
  opts?: {
    /** "png" → 透明；"jpeg" → 白底（只影響背景顏色） */
    bgFor?: "png" | "jpeg";
    /** 固定輸出尺寸（不給就用 artboard 尺寸） */
    baseWidth?: number;
    baseHeight?: number;
    /** 像素放大倍率 */
    multiplier?: number;
  }
): Promise<HTMLCanvasElement> {
  const { bgFor = "png", baseWidth, baseHeight, multiplier = 1 } = opts ?? {};

  const rect = getArtboardRect?.() ?? {
    left: 0,
    top: 0,
    width: canvas.getWidth(),
    height: canvas.getHeight(),
  };

  const artLeft = Math.round(rect.left);
  const artTop = Math.round(rect.top);
  const W = Math.max(1, Math.round(baseWidth ?? rect.width));
  const H = Math.max(1, Math.round(baseHeight ?? rect.height));

  // 1) clone 整個主畫布
  const off = (await (canvas as Canvas).clone([])) as Canvas; // Fix: Added an empty object as argument to satisfy the "Expected 1 argument" error.
  (off as Canvas).renderOnAddRemove = false;
  (off as Canvas).enableRetinaScaling = false;

  // 2) 移除 helper（在離屏上動手）
  (off.getObjects() as FabricObject[]).filter(isHelperObject).forEach((o) => off.remove(o));

  // 3) 設定固定輸出尺寸（忽略 left/top 於尺寸計算）
  off.setDimensions({ width: W, height: H });

  // 4) 用 viewportTransform 把 artboard 左上對齊到 (0,0)
  (off as Canvas).setViewportTransform([1, 0, 0, 1, -artLeft, -artTop]);

  // 5) 背景處理
  (off as Canvas).backgroundColor = bgFor === "jpeg" ? "#ffffff" : "";

  // 6) 渲染並轉到真正輸出 canvas（處理 multiplier）
  off.renderAll();

  const out = document.createElement("canvas");
  out.width = Math.round(W * multiplier);
  out.height = Math.round(H * multiplier);
  const ctx = out.getContext("2d")!;
  if (bgFor === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.scale(multiplier, multiplier);

  const srcEl =
    (off as Canvas).getElement?.() ??
    (off as Canvas).lowerCanvasEl ??
    (off as Canvas).contextContainer?.canvas;

  ctx.drawImage(srcEl, 0, 0);

  off.dispose();
  return out;
}

/* ================= Component ================= */
export default function ExportMenu({
  api,
  filename = "design",
  getLayers,
  backgroundVisible = true,
  open,
  onOpenChange,
  anchorRef,
}: ExportMenuProps) {
  const t = useTranslations("edited");
  const [fileType, setFileType] = useState<FileType>("png");
  const [scale, setScale] = useState(1); // 以 Artboard 尺寸為基準的放大倍數（1~4）
  const [jpgQuality, setJpgQuality] = useState(0.92);
  const [pngTransparent, setPngTransparent] = useState(true);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const canExport = !!api;

  /* ------- 畫板尺寸 ------- */
  const artboard = useMemo(() => {
    if (!api) return { w: 0, h: 0, left: 0, top: 0 };
    const { width, height } = api.getArtboardSize();
    const rect =
      (api as FabricEditorHandle).getArtboardSize?.() ?? { left: 0, top: 0, width, height };
    return {
      w: Math.round(rect.width || width),
      h: Math.round(rect.height || height),
      left: Math.round(rect.left || 0),
      top: Math.round(rect.top || 0),
    };
  }, [api]);

  /* ------- anchor 定位 ------- */
  const computePosition = useCallback(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 8;
    setPos({ top: Math.round(rect.bottom + gap), left: Math.round(rect.right) });
  }, [anchorRef]);

  useEffect(() => {
    if (!open) return;
    computePosition();
    const handler = () => computePosition();
    window.addEventListener("resize", handler, { passive: true });
    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler);
    };
  }, [open, computePosition]);

  /* ------- Esc / 點外面關閉 ------- */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    const onClick = (e: MouseEvent) => {
      const p = panelRef.current;
      const a = anchorRef.current;
      if (!p) return;
      if (p.contains(e.target as Node)) return;
      if (a && a.contains(e.target as Node)) return;
      onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open, onOpenChange, anchorRef]);


  /* ------- 匯出包裝（只處理選取/背景可見性與 VPT；PNG/JPG/PSD 本體改走離屏） ------- */
  const withCleanExport = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      opts?: { hideBackground?: boolean; forceWhiteBg?: boolean }
    ): Promise<T> => {
      if (!api) throw new Error(t("editor_not_initialized"));
      const canvas = api.getCanvas?.() as Canvas | undefined;

      const prevBgVisible = backgroundVisible;
      const active = canvas?.getActiveObject?.() ?? null;
      const prevVpt = canvas?.viewportTransform
        ? (canvas.viewportTransform.slice() as unknown as TMat2D[])
        : null;

      canvas?.discardActiveObject?.();
      const restoreHelpers = canvas ? hideHelpers(canvas) : () => {};

      let prevBgColor: string | TFiller = "";
      if (opts?.hideBackground) api.setBackgroundVisible?.(false); // PNG 透明
      if (opts?.forceWhiteBg && canvas) {
        prevBgColor = (canvas as Canvas).backgroundColor;
        (canvas as Canvas).backgroundColor = "#ffffff"; // JPG 白底
        api.setBackgroundVisible?.(true);
      }

      // 匯出時不吃 zoom/pan
      if (canvas?.setViewportTransform) canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      canvas?.requestRenderAll?.();

      try {
        return await fn();
      } finally {
        if (opts?.hideBackground) api.setBackgroundVisible?.(prevBgVisible);
        if (opts?.forceWhiteBg && canvas) (canvas as Canvas).backgroundColor = prevBgColor;
        if (prevVpt && canvas?.setViewportTransform) canvas.setViewportTransform(prevVpt[0] as TMat2D);
        restoreHelpers();
        if (active && canvas?.setActiveObject) canvas.setActiveObject(active as FabricObject);
        canvas?.requestRenderAll?.();
      }
    },
    [api, backgroundVisible]
  );

  /* ================== 匯出：PNG / JPG ================== */
  async function exportPNG() {
    const canvas = api?.getCanvas();
    if (!api || !canvas) return;

    const snap = await snapshotOffscreenArtboard(canvas, api.getArtboardBounds, {
      bgFor: pngTransparent ? "png" : "jpeg", // 若你勾選「透明背景」，就透明；否則白底
      multiplier: scale,
      // 若要固定 1920×1080，取消註解：
      // baseWidth: 1920,
      // baseHeight: 1080,
    });

    const durl =
      pngTransparent ? snap.toDataURL("image/png") : snap.toDataURL("image/jpeg", 0.92);
    const ext = pngTransparent ? "png" : "jpg";
    const blob = dataURLtoBlob(durl);
    downloadBlob(blob, `${filename}.${ext}`);
  }

  async function exportJPG() {
    const canvas = api?.getCanvas();
    if (!api || !canvas) return;

    const snap = await snapshotOffscreenArtboard(canvas, api.getArtboardBounds, {
      bgFor: "jpeg",          // 白底
      multiplier: scale,
      // baseWidth: 1920,
      // baseHeight: 1080,
    });

    const durl = snap.toDataURL("image/jpeg", jpgQuality);
    const blob = dataURLtoBlob(durl);
    downloadBlob(blob, `${filename}.jpg`);
  }


/* ================== 匯出：PSD - 最終穩定版 V18 (純淨 Compositor 座標) ================== */
async function exportPSD() {
    const canvas = api?.getCanvas?.();
    if (!api || !canvas) return;
  
    await withCleanExport(async () => {
      // ── Artboard 邊界 (CSS px)
      const r = api.getArtboardBounds?.() ?? { left: 0, top: 0, width: canvas.getWidth?.() ?? canvas.width ?? 0, height: canvas.getHeight?.() ?? canvas.height ?? 0, };
      const artL_raw = Math.floor(r.left ?? 0);
      const artT_raw = Math.floor(r.top ?? 0);
      const artR = Math.ceil((r.left ?? 0) + (r.width ?? 0));
      const artB = Math.ceil((r.top ?? 0) + (r.height ?? 0));
      let PSD_W = Math.max(0, artR - artL_raw);
      let PSD_H = Math.max(0, artB - artT_raw);
      
      let children = [];
  
      // ── Global Scale Calculation (DPI)
      let globalScale = 1;
      if (PSD_W > 0 && PSD_H > 0) {
        const fullSnap = await snapshotOffscreenArtboard( canvas, api.getArtboardBounds, { bgFor: "png", multiplier: 1 } );
        if (fullSnap && fullSnap.width > 0) {
            globalScale = fullSnap.width / PSD_W;
        }
      }
      
      // ── Layer Loop Setup
      const panel = typeof getLayers === "function" ? getLayers() ?? [] : [];
      const layered = panel.length > 0;
  
      if (layered && globalScale > 0) {
        const visibleLayers = panel.filter((l: StageLayerItem) => l.id !== "BASE_LAYER" && l.visible).slice().reverse();
        const orderedIds = visibleLayers.map((l: StageLayerItem) => l.id);
        const transforms: SelectedLayerTransform[] = api.getSelectedLayersTransform?.(orderedIds) || [];

        if (!transforms.length) return; 
        
        // 1. 取得 Compositor Data (座標來源)
        const artboard = api.getArtboardBounds?.() || null;
        const hasSelection = false; // 假設 PSD 導出為 Artboard 模式
        
        const compositorData = convertToCompositorFormatCrop(
            transforms,
            0, // Padding
            hasSelection ? null : artboard
        );
        const padding = 0;
        const bboxes = JSON.parse(compositorData.fabricDataJson).bboxes;
        console.log(JSON.parse(compositorData.fabricDataJson))
        
        const restoreHelpers = hideHelpers(canvas);
        canvas.requestRenderAll(); 
        
        try {
            for (const l of visibleLayers) {
                const t = transforms.find((x) => x.id === l.id);
                const layerMap = compositorData.layerMapping.find(m => m.fabricId === l.id);
                const bbox_comp = bboxes[layerMap?.channelId ?? -1]; // Compositor 邊界

                if (!t || !layerMap || !bbox_comp) continue;

                
                // 2. 取得 Cropped PNG (包含 Clip/Scale 處理)
                const png = await api.exportLayerCroppedPng?.(l.id, canvas); 
                
                if (!png || !t?.overallBounds) continue;

                const bmp = await createImageBitmap(dataURLtoBlob(png));
        
                // 3. Artboard 交集點 (L2, T2) - 僅用於圖像的二次裁剪
                const snapshotL = t.boundingBox?.x || t.overallBounds.left; // Cropped PNG 左上角的世界座標
                const snapshotT = t.boundingBox?.y || t.overallBounds.top;
                
                const W_CSS = bmp.width / globalScale;
                const H_CSS = bmp.height / globalScale;

                // L2/T2 是 Artboard 與圖層邊界的交集點的世界座標
                const L2_FLOAT = Math.max(snapshotL, artL_raw); 
                const T2_FLOAT = Math.max(snapshotT, artT_raw); 
                
                const L2 = Math.round(L2_FLOAT); 
                const T2 = Math.round(T2_FLOAT); 
                
                const W2 = Math.round(Math.min(snapshotL + W_CSS, artR) - L2_FLOAT); // 最終裁剪寬度 (CSS)
                const H2 = Math.round(Math.min(snapshotT + H_CSS, artB) - T2_FLOAT); // 最終裁剪高度 (CSS)

                if (W2 <= 0 || H2 <= 0) continue;

                console.log("layerCanvas.width ", bbox_comp.xwidth)
  
                // 4. Canvas Creation & DrawImage (繪製 Artboard 交集部分)
                const layerCanvas = document.createElement("canvas");
                layerCanvas.width = bbox_comp.xwidth; 
                layerCanvas.height = bbox_comp.xheight;
                const ctx = layerCanvas.getContext("2d")!;
                ctx.imageSmoothingEnabled = false; 


                ctx.drawImage( bmp,  0, 0, layerCanvas.width, layerCanvas.height );
        
                // 5. Final PSD Position (使用 Compositor 座標)
                
                // PSD 位置 = Compositor 算出的相對位置 (已在 Artboard 基準上)
                let finalLeft = bbox_comp.left - padding;
                let finalTop = bbox_comp.top - padding;

                // ❗ 由於 Artboard 裁剪，圖層實際畫布尺寸變為 W2/H2
                // finalLeft/finalTop 必須是 L2/T2 減去 Artboard 原點
                // 由於 Compositor 的 bbox 可能是以 snapshotL/T 為基準計算的，需要修正為 L2/T2
                // 但是因為 L2 - snapshotL 已經被 DrawImage 處理，如果 Compositor 的 bbox.left 已經是 L2
                // (L2 - artL_raw) 的結果，則不需要修正。
                // 我們只信任 L2/T2 是圖像實際畫出來的位置。
                
                finalLeft = Math.round(L2 - artL_raw);
                finalTop = Math.round(T2 - artT_raw);

                // DEBUG LOGGING 
                console.log(`--- [PSD Export Debug] Layer: ${l.name || 'Untitled'} (${l.id}) ---`);
                console.log(`1. Compositor BBox Pos (L, T): ${bbox_comp.left - padding}, ${bbox_comp.top - padding} (供參考)`);
                console.log(`2. Intersection Pos (L2, T2): ${L2}, ${T2}`);
                console.log(`3. Final PSD Position (L2 - artL_raw) [Px]: ${finalLeft}, ${finalTop}`);
                console.log(`--------------------------------------------------`);
                
                children.push({
                    name: l.name || "Layer",
                    canvas: layerCanvas,
                    left: bbox_comp.left, // 採用 L2 - artL_raw (交集點 - Artboard 原點)
                    top: bbox_comp.top,   // 採用 T2 - artT_raw
                    opacity: Math.max(0, Math.min(1, typeof l.opacity === "number" ? l.opacity : 1)),
                    hidden: !l.visible,
                    blendMode: "normal",
                });
            }
        } finally {
            // 狀態還原
            restoreHelpers();
            canvas.requestRenderAll();
        }
      } else {
        // ... (Flat Export Logic - 保持不變) ...
        const snap = await snapshotOffscreenArtboard( canvas, api.getArtboardBounds, { bgFor: "png", multiplier: 1 } );
        const layerCanvas = document.createElement("canvas");
        layerCanvas.width = snap.width; layerCanvas.height = snap.height;
        layerCanvas.getContext("2d")!.drawImage(snap, 0, 0);
        children = [
          { name: "Artboard", canvas: layerCanvas, left: 0, top: 0, opacity: 1, hidden: false, blendMode: "normal" },
        ];
        PSD_W = snap.width; PSD_H = snap.height;
      }
      
      // ── Final PSD Write (保持不變) ──
      const compositeHiDPI = await snapshotOffscreenArtboard( canvas, api.getArtboardBounds, { bgFor: "png", multiplier: 1 } );
      let composite = compositeHiDPI;
      if (compositeHiDPI.width !== PSD_W || compositeHiDPI.height !== PSD_H) {
        const oneX = document.createElement("canvas");
        oneX.width = PSD_W; oneX.height = PSD_H;
        const ctx1x = oneX.getContext("2d")!; ctx1x.imageSmoothingEnabled = false;
        ctx1x.drawImage( compositeHiDPI, 0, 0, compositeHiDPI.width, compositeHiDPI.height, 0, 0, PSD_W, PSD_H );
        composite = oneX;
        console.warn(`[PSD] composite ${compositeHiDPI.width}x${compositeHiDPI.height} ≠ doc ${PSD_W}x${PSD_H}, downscale to 1x`);
      }
      
      const psd = { width: PSD_W, height: PSD_H, canvas: composite, children };
      const opts: WriteOptions = { compress: true, generateThumbnail: true };
      const arrayBuffer = writePsd(psd as {
        width: number;
        height: number;
        canvas: HTMLCanvasElement;
        children: [];
    }, opts);
      const out = new Blob([arrayBuffer], { type: "image/vnd.adobe.photoshop" });
      downloadBlob(out, `${filename}.psd`);
    }, { hideBackground: false });
  }
  
  

  async function handleExport() {
    if (fileType === "png") return exportPNG();
    if (fileType === "jpg") return exportJPG();
    if (fileType === "psd") return exportPSD();
  }

  /* ================= UI ================= */
  if (!open || !pos) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform: "translateX(-100%)",
        zIndex: 1000,
      }}
      className="w-80 max-w-[90vw] rounded-xl border border-gray-200 dark:border-gray-800 text-white dark:bg-gray-900 shadow-xl p-3"
      role="dialog"
      aria-modal="true"
    >
      <div className="mb-3">
        <label className="text-xs font-medium block mb-1">{t("file_type")}</label>
        <select
          value={fileType}
          onChange={(e) => setFileType(e.target.value as FileType)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
        >
          <option value="png">{t("png_crop_artboard")}</option>
          <option value="jpg">{t("jpg_white_bg_crop_artboard")}</option>
          <option value="psd">{getLayers ? t("psd_preserve_layers") : t("psd_flat_export")}</option>
        </select>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">{t("size_multiplier")} ×</label>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {artboard.w * scale} × {artboard.h * scale}px
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={4}
          step={1}
          value={scale}
          onChange={(e) => setScale(parseInt(e.target.value))}
          className="w-full accent-purple-500"
        />
      </div>

      {fileType === "png" && (
        <div className="mb-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pngTransparent}
              onChange={(e) => setPngTransparent(e.target.checked)}
            />
            {t("transparent_background_otherwise_white")}
          </label>
        </div>
      )}

      {fileType === "jpg" && (
        <div className="mb-3">
          <label className="text-xs font-medium block">{t("jpg_quality")}</label>
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.01}
            value={jpgQuality}
            onChange={(e) => setJpgQuality(parseFloat(e.target.value))}
            className="w-full accent-purple-500"
          />
          <div className="text-[11px] text-gray-500 mt-1">{t("quality")}: {Math.round(jpgQuality * 100)}%</div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={() => onOpenChange(false)}
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm"
        >
          {t("cancel")}
        </button>
        <button
          onClick={async () => {
            await handleExport();
            onOpenChange(false);
          }}
          disabled={!canExport}
          className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm disabled:opacity-50"
        >
          {t("download")}
        </button>
      </div>
    </div>
  );
}
