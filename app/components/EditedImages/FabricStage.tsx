"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as fabric from "fabric";
import {
  ActiveSelection,
  Canvas,
  FabricImage,
  FabricObject,
  Group,
  ModifiedEvent,
  Rect,
  TMat2D,
  TPointerEvent,
} from "fabric";
import {
  FabricOriginX,
  FabricOriginY,
  HistoryState,
  SerializedObject,
} from "./types";
import { scheduleAutosave } from "./autosave/AutoSaveManager";
import { loadLayerBlob, loadSnapshotJSON } from "./autosave/store";
import { EditorMode } from "./EditorPromptDock";

type FPtr = fabric.TPointerEvent;
type FModEvt = fabric.ModifiedEvent<FPtr>;

declare module "fabric" {
  interface FabricObject {
    data?: {
      id?: string;
      ui?: boolean;
      pendingFlag?: string;
      jobId?: string;
      isPending?: boolean;
      frame?: {
        left?: number;
        top?: number;
        w: number;
        h: number;
        origin?: string;
        cx?: number;
        cy?: number;
        angle?: number;
      };
      [k: string]: unknown;
    };
  }

  interface Rect {
    __isEdgeDragging?: boolean;
    __cornerScalingStarted?: boolean;
    __cleanupEvents: () => void;
  }

  interface Canvas {
    __multiSelectCleanup?: () => void;
    __mobileEditMode: boolean;
  }
}
type ControlRenderingStyleOverride = Partial<
  Pick<
    fabric.InteractiveFabricObject,
    | "cornerStyle"
    | "cornerSize"
    | "cornerColor"
    | "cornerStrokeColor"
    | "cornerDashArray"
    | "transparentCorners"
  >
>;
// function dumpImgVsClip(img: any) {
//   if (!img || !img.clipPath) {
//     console.warn("no img/clipPath");
//     return;
//   }
//   const cp = img.clipPath;

//   const ic = img.getCenterPoint();
//   const cc = cp.getCenterPoint
//     ? cp.getCenterPoint()
//     : { x: cp.left, y: cp.top };
//   const el = img.getElement && img.getElement();
//   const natW = (el && el.naturalWidth) || img.width || 1;
//   const natH = (el && el.naturalHeight) || img.height || 1;

//   // 以「cover」為例計算理想縮放（你若用 contain/fill，換掉公式即可）
//   const sCover = Math.max(cc ? cp.width / natW : 1, cc ? cp.height / natH : 1);

//   console.table({
//     "img.left": img.left,
//     "img.top": img.top,
//     "img.origin": `${img.originX}/${img.originY}`,
//     "img.scaleX": img.scaleX,
//     "img.scaleY": img.scaleY,
//     "img.angle": img.angle,
//     "img.center.x": ic.x,
//     "img.center.y": ic.y,
//     "natW/H": `${natW}×${natH}`,
//     "clip.left": cp.left,
//     "clip.top": cp.top,
//     "clip.origin": `${cp.originX}/${cp.originY}`,
//     "clip.w/h": `${cp.width}×${cp.height}`,
//     "clip.angle": cp.angle,
//     "clip.absPos": cp.absolutePositioned,
//     "Δcenter.x": ic.x - cc.x,
//     "Δcenter.y": ic.y - cc.y,
//     "idealScale(cover)": sCover,
//   });

//   console.log("[canvas vt]", img.canvas && img.canvas.viewportTransform);
// }

const __offscreen =
  typeof document !== "undefined" ? document.createElement("canvas") : null;
const __offctx = __offscreen ? __offscreen.getContext("2d")! : null;
function getOffscreenCtx(w: number, h: number) {
  if (!__offscreen || !__offctx) return null;
  if (__offscreen.width !== w) __offscreen.width = w;
  if (__offscreen.height !== h) __offscreen.height = h;
  return __offctx;
}

const IMG_DATAURL_CACHE_URL = new Map<string, string>();
const LAYER_CLEAN_BASE = new Map<string, string>();
const LAYER_BASE_CANVAS = new Map<string, HTMLCanvasElement>();
const LAYER_MASK_CANVAS = new Map<string, HTMLCanvasElement>();
const LAYER_VIEW_CANVAS = new Map<string, HTMLCanvasElement>();
const LAYER_BASE_PIXEL = new Map<string, string>();
const LAYER_IMG_CACHE = new Map<string, string>();
const LAYER_HAS_BRUSH = new Set<string>();
const LAYER_MASK_NONWHITE = new Set<string>();
const LAYER_USER_DRAWN = new Set<string>();

const ACTIVE_JOBS = new Map<
  string,
  { layerId: string; cancelled: boolean; historyIndex: number }
>();

const VOID_JOBS = new Set<string>();

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const genId = () =>
  `ov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const nextFrame = () =>
  new Promise<void>((r) => requestAnimationFrame(() => r()));
const twoFrames = async () => {
  await nextFrame();
  await nextFrame();
};
const isBlobUrl = (u?: string | null) => !!u && u.startsWith("blob:");

function getAABBInWorld(obj: FabricObject) {
  const w = obj.width || 0;
  const h = obj.height || 0;
  const hw = w / 2;
  const hh = h / 2;
  const local = [
    new fabric.Point(-hw, -hh),
    new fabric.Point(hw, -hh),
    new fabric.Point(hw, hh),
    new fabric.Point(-hw, hh),
  ];
  const M = (
    obj as unknown as { calcTransformMatrix(): TMat2D }
  ).calcTransformMatrix();
  const world = local.map((p) => fabric.util.transformPoint(p, M));
  const xs = world.map((p) => p.x);
  const ys = world.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
  };
}

function canvasPointToImagePixel(img: fabric.FabricImage, pt: fabric.Point) {
  const el = img.getElement() as HTMLCanvasElement | HTMLImageElement;
  const W =
    el instanceof HTMLCanvasElement
      ? el.width
      : el.naturalWidth || (img.width as number) || 0;
  const H =
    el instanceof HTMLCanvasElement
      ? el.height
      : el.naturalHeight || (img.height as number) || 0;

  const cx = img.left || 0;
  const cy = img.top || 0;
  const angle = ((img.angle || 0) * Math.PI) / 180;
  const scaleX = img.scaleX || 1;
  const scaleY = img.scaleY || 1;

  const rx = pt.x - cx;
  const ry = pt.y - cy;
  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);
  const rotX = rx * cosA - ry * sinA;
  const rotY = rx * sinA + ry * cosA;

  const px = (rotX / (img.width! * scaleX || 1)) * W + W / 2;
  const py = (rotY / (img.height! * scaleY || 1)) * H + H / 2;
  return { px, py, W, H };
}

async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

function composeToView(layerId: string) {
  const base = LAYER_BASE_CANVAS.get(layerId);
  const mask = LAYER_MASK_CANVAS.get(layerId);
  const view = LAYER_VIEW_CANVAS.get(layerId);
  if (!base || !view) return;

  const w = base.width;
  const h = base.height;

  const vctx = view.getContext("2d")!;
  vctx.save();
  vctx.setTransform(1, 0, 0, 1, 0, 0);
  vctx.clearRect(0, 0, w, h);
  vctx.drawImage(base, 0, 0);

  if (mask) {
    const mctx = mask.getContext("2d")!;
    const mimg = mctx.getImageData(0, 0, w, h);
    const out = vctx.getImageData(0, 0, w, h);
    const md = mimg.data;
    const od = out.data;
    for (let i = 0; i < od.length; i += 4) {
      const r = md[i];
      od[i + 3] = Math.round((od[i + 3] * r) / 255);
    }
    vctx.putImageData(out, 0, 0);
  }

  vctx.restore();
}

export type StageLayerItem = {
  id: string;
  type: string;
  name: string;
  visible: boolean;
  thumb?: string;
  hasMask?: boolean;
  hasBrush?: boolean;
  isPending?: boolean;
  jobId?: string;
  opacity?: number;
};

export type SelectedLayerTransform = {
  id: string;
  name: string;
  type: string;
  transform: {
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    angle: number;
    flipX: boolean;
    flipY: boolean;
    left?: number;
    top?: number;
    originX?: string;
    originY?: string;
  };
  clipPath?: FabricObject; // 🔥 加這行
  boundingBox: { x: number; y: number; width: number; height: number };
  fabricIndex: number;
  overallBounds?: { left: number; top: number; width: number; height: number };
};

async function blobToDataURL(b: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(b);
  });
}

async function hydrateSnapshotDataURLs(projectId: string, snap: HistoryState) {
  for (const obj of snap.objects) {
    if (obj.type !== "image") continue;
    const layerId = (obj as SerializedObject)?.data?.id as string | undefined;
    if (!layerId) continue;

    // 如果沒有 base/mask 的 dataURL，但有 hasBase/hasMask，就從 store 抓 Blob → 轉 dataURL 補回來
    if (!("baseDataURL" in obj) && (obj as SerializedObject)?.hasBase) {
      const b = await loadLayerBlob(projectId, layerId, "base");
      if (b) (obj as SerializedObject).baseDataURL = await blobToDataURL(b);
    }
    if (!("maskDataURL" in obj) && (obj as SerializedObject)?.hasMask) {
      const m = await loadLayerBlob(projectId, layerId, "mask");
      if (m) (obj as SerializedObject).maskDataURL = await blobToDataURL(m);
    }
  }
}

const getDrawCursor = (size: number, color: string = "#000000") => {
  const circle = `
      <svg
        height="${size}"
        width="${size}"
        viewBox="0 0 ${size} ${size}"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="${size / 2}"
          cy="${size / 2}"
          r="${size / 2 - 1}"
          fill="none"
          stroke="${color}"
          stroke-width="2"
        />
      </svg>
    `;
  return `data:image/svg+xml;base64,${window.btoa(circle)}`;
};

export type FabricEditorHandle = {
  addImageLayer: (url: string, name?: string) => Promise<{ id: string }>;
  ensureTextProxyRect: (
    canvas: fabric.Canvas,
    textObj: fabric.Textbox
  ) => fabric.Rect;
  ensureProxyRect: (canvas: Canvas, img: FabricImage) => Rect;

  deleteLayer: (id: string) => void;
  setActive: (id: string | null) => void;
  setActiveMultiple: (ids: string[]) => void;
  replaceCurrentHistory: () => void;
  setVisible: (id: string, visible: boolean) => void;
  reorderTopToBottom: (idsTopToBottom: string[]) => void;
  mergeLayers: (ids: string[]) => Promise<{ id: string } | null>;
  getZoom: () => number;
  setZoom: (nextPercent: number) => void;
  resetView: () => void;
  setBackgroundVisible: (visible: boolean) => void;
  toDataURL: (type?: "image/png" | "image/jpeg", quality?: number) => string;

  clearResidualDraw: () => void;
  clearCurrentBrushStrokes: () => void;
  exitDrawingMode: (keepSelection?: boolean) => void;

  setBrushMode: (enabled: boolean) => void;
  setBrushSize: (size: number) => void;

  setEraserMode: (enabled: boolean) => void;
  setEraserSize: (size: number) => void;
  setEraserAction: (action: "erase" | "restore") => void;
  snapshotMask: (layerId: string) => string;
  restoreMaskFromSnapshot: (layerId: string, dataURL: string) => Promise<void>;

  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveHistory: () => void;

  getSelectedLayersTransform: (ids: string[]) => SelectedLayerTransform[];
  getCanvas: () => fabric.Canvas | null;
  getHistoryIndex: () => number;

  startAIJob: (layerId: string, jobId: string) => void;
  cancelAIJob: (jobId: string) => void;
  completeAIJob: (jobId: string, success: boolean) => void;
  isJobValid: (jobId: string) => boolean;

  setLayerPending: (id: string, pending: boolean, jobId?: string) => void;
  getLayerOriginalSize: (
    id: string
  ) => { width: number; height: number } | null;

  setLayerImageFromUrlPreserveWorldSize: (
    layerId: string,
    url: string,
    opts?: { resetMask?: boolean; jobId?: string }
  ) => Promise<boolean>;
  initMaskFromAlphaCutout: (
    layerId: string,
    cutoutUrl: string,
    jobId?: string
  ) => Promise<boolean>;
  setLayerImageFromUrlWithUpscale: (
    layerId: string,
    cutoutUrl: string,
    opts: { jobId?: string }
  ) => Promise<boolean>;
  exportLayerAsAlphaPng: (layerId: string) => Promise<string | null>;
  exportLayerCroppedPng: (
    layerId: string,
    canvas: Canvas,
    opts?: { original?: boolean }
  ) => Promise<string | null>;
  setLayerImageFromUrlMatchPixelDensity: (
    layerId: string,
    url: string,
    opts?: { resetMask?: boolean; jobId?: string }
  ) => Promise<boolean>;
  setLayerProcessing: (
    id: string | string[],
    processing: boolean,
    jobId?: string
  ) => void;
  setArtboardSize: (width: number, height: number) => void;
  getArtboardSize: () => {
    width: number;
    height: number;
    left: number;
    top: number;
  };
  toggleArtboard: (visible: boolean) => void;
  getArtboardBounds: () => {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  exportBasePng: (layerId: string) => Promise<string | null>;
  exportMaskPng: (
    layerId: string,
    opts?: { nullIfEmpty?: boolean }
  ) => Promise<string | null>;
  recenterView: (targetZoom?: number) => void;
  setMobileFocusState: (layerId: string | null) => void;

  // 複製貼上功能
  copySelectedLayers: () => void;
  pasteFromClipboard: () => Promise<void>;
  duplicateLayer: (id: string) => Promise<{ id: string } | null>;

  // 圖層下載功能
  downloadLayerOriginal: (layerId: string) => Promise<void>;
  downloadLayerCropped: (layerId: string) => Promise<void>;
  setHistoryIsolation: (enabled: boolean) => void;
  renameLayer:(id: string, newName: string) => void
};

type Props = {
  mode: EditorMode | null;
  selectedIds?: string[];
  className?: string;
  initialBackgroundUrl?: string | null;
  onCanvasReady?: (api: FabricEditorHandle) => void;
  onObjectsChange?: (topToBottom: StageLayerItem[]) => void;
  onZoomChange?: (percent: number) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  projectId?: string;
};

/**
 * 將 fabric 物件的 scaleX/scaleY 吸收進 width/height 中，並將 scaleX/Y 重設為 1。
 */
function absorbScaleIntoSize(rect: fabric.Rect) {
  const sx = rect.scaleX ?? 1;
  const sy = rect.scaleY ?? 1;

  if (Math.abs(sx - 1) > 1e-4 || Math.abs(sy - 1) > 1e-4) {
    const w0 = Math.max(1, rect.width || 1);
    const h0 = Math.max(1, rect.height || 1);
    const w = Math.max(1, w0 * sx);
    const h = Math.max(1, h0 * sy);

    rect.set({ width: w, height: h, scaleX: 1, scaleY: 1 });
    rect.setCoords();
  }
}

/**
 * 取得/建立 image 的 clipPath（maskRect）。
 */
function ensureMaskRect(
  canvas: fabric.Canvas,
  img: fabric.FabricImage
): fabric.Rect {
  let mask = img.clipPath as fabric.Rect | undefined;
  if (mask && !(mask instanceof fabric.Rect)) mask = undefined;

  if (!mask) {
    mask = new fabric.Rect({
      left: img.left,
      top: img.top,
      originX: "center",
      originY: "center",
      width: (img.width || 1) * Math.max(1e-5, img.scaleX || 1),
      height: (img.height || 1) * Math.max(1e-5, img.scaleY || 1),
      absolutePositioned: true,
      fill: "#000",
    });
    img.clipPath = mask;
  }
  return mask!;
}

type _EdgeSide = "ml" | "mr" | "mt" | "mb";
type _EdgeAnchor = "left" | "right" | "top" | "bottom";
const _anchorOf = (e: _EdgeSide): _EdgeAnchor =>
  e === "ml" ? "right" : e === "mr" ? "left" : e === "mt" ? "bottom" : "top";

export default function FabricStage({
  mode,
  selectedIds,
  className,
  initialBackgroundUrl = null,
  onCanvasReady,
  onObjectsChange,
  onZoomChange,
  onSelectionChange,
  projectId = "default",
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const bgRef = useRef<fabric.FabricImage | null>(null);
  const artboardRef = useRef<fabric.Rect | null>(null);
  const mobileFocusRef = useRef<string | null>(null);

  const objectsChangeRef = useRef<Props["onObjectsChange"]>(onObjectsChange);
  const zoomChangeRef = useRef<Props["onZoomChange"]>(onZoomChange);
  const selectionChangeRef =
    useRef<Props["onSelectionChange"]>(onSelectionChange);
  useEffect(() => {
    objectsChangeRef.current = onObjectsChange;
  }, [onObjectsChange]);
  useEffect(() => {
    zoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);
  useEffect(() => {
    selectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);
  const externalSelectedIdsRef = useRef<string[]>(selectedIds ?? []);
  const externalSelectedModeRef = useRef<EditorMode | null>(mode ?? null);
  useEffect(() => {
    externalSelectedIdsRef.current = selectedIds ?? [];
  }, [selectedIds]);
  useEffect(() => {
    externalSelectedModeRef.current = mode ?? null;
  }, [mode]);
  const lastClickRef = useRef<{
    id?: string;
    x: number;
    y: number;
    wasSelectedSingle: boolean;
    isMultiSelectToggle?: boolean;
  } | null>(null);

  const isSpacePressedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const processingDragRef = useRef<{
    active: boolean;
    proxy: FabricObject | null;
    targets: fabric.FabricImage[];
    lastPt: fabric.Point | null;
  }>({
    active: false,
    proxy: null,
    targets: [],
    lastPt: null,
  });

  const brushModeRef = useRef(false);
  const brushArmedRef = useRef(false);
  const activeLayerRef = useRef<fabric.FabricImage | null>(null);

  const eraserModeRef = useRef(false);
  const eraserSizeRef = useRef(40);
  const eraserRestoreRef = useRef(false);

  const baselinePushedRef = useRef(false);
  const isLiveCompositeRef = useRef(false);

  const liveDrawRef = useRef<{
    active: boolean;
    lastPx: number;
    lastPy: number;
    strokeCanvas: HTMLCanvasElement | null;
    raf: number | null;
  }>({ active: false, lastPx: 0, lastPy: 0, strokeCanvas: null, raf: null });

  const pausedForPanOrZoomRef = useRef(false);
  const wasDrawingWhenPausedRef = useRef(false);

  const currentDrawingPathsRef = useRef<fabric.Path[]>([]);

  const drawingSessionRef = useRef<{
    layerId: string;
    baseSnapshot: string;
    maskSnapshot: string;
  } | null>(null);
  const clipboardRef = useRef<{
    layerIds: string[];
    layerData: Array<{
      id: string;
      name: string;
      type: "image" | "text"; // 🔥 新增：圖層類型
      // 圖片圖層專用
      dataUrl?: string;
      viewDataUrl?: string;
      maskDataUrl?: string;
      hasBrush?: boolean;
      // 文字圖層專用
      text?: string;
      textProps?: {
        fontSize?: number;
        fontFamily?: string;
        fill?: string;
        fontWeight?: string;
        fontStyle?: string;
        textAlign?: string;
        underline?: boolean;
        linethrough?: boolean;
        width?: number;
      };
      // 通用
      transform: {
        left: number;
        top: number;
        scaleX: number;
        scaleY: number;
        angle: number;
      };
      clipPath?: {
        left: number;
        top: number;
        width: number;
        height: number;
        angle: number;
      };
      frame?: unknown;
    }>;
  } | null>(null);

  const historyRef = useRef<HistoryState[]>([]);
  const historyIndexRef = useRef(-1);
  const historyIsolationIndexRef = useRef<number>(-1);

  const isRestoringRef = useRef(false);
  const isUndoRedoingRef = useRef(false);
  const pendingSaveRef = useRef<number | null>(null);

  const MAX_HISTORY = 30;

  const [viewport, setViewport] = useState({ w: 800, h: 600 });
  const [artboardSize, setArtboardSize] = useState({
    width: 1920,
    height: 1080,
  });

  function resolveToImageObjects(
    objs: FabricObject[],
    canvas: fabric.Canvas
  ): fabric.FabricImage[] {
    const out: fabric.FabricImage[] = [];

    const pushIfImage = (o: FabricObject | null | undefined) => {
      if (!o) return;
      if (o.type === "image") out.push(o as fabric.FabricImage);
    };
    const pushIfText = (o: FabricObject | null | undefined) => {
      if (!o) return;
      if (o.type === "textbox" && o.data?.isText) {
        // 把文字物件也當作"圖層"處理
        out.push(o as FabricImage);
      }
    };

    const tryResolveProxy = (o: FabricObject) => {
      const d = (o as FabricObject).data;

      if (d?.isMultiSelectHandle && Array.isArray(d?.targetIds)) {
        (d.targetIds as string[]).forEach((id) => {
          // 🔥 找圖片
          const img = (canvas.getObjects() as FabricObject[]).find(
            (x) => x.type === "image" && (x as FabricObject).data?.id === id
          );
          if (img) pushIfImage(img);

          // 🔥 找文字（新增這段）
          const text = (canvas.getObjects() as FabricObject[]).find(
            (x) => x.type === "textbox" && (x as FabricObject).data?.id === id
          );
          if (text) pushIfText(text);
        });
        return;
      }

      // 單個 proxy 也要同時找圖片和文字
      const hostId: string | undefined = d?.hostId as string;
      if (!hostId) return;

      const img = (canvas.getObjects() as FabricObject[]).find(
        (x) => x.type === "image" && (x as FabricObject).data?.id === hostId
      );
      if (img) pushIfImage(img);

      // 🔥 找文字（新增這段）
      const text = (canvas.getObjects() as FabricObject[]).find(
        (x) => x.type === "textbox" && (x as FabricObject).data?.id === hostId
      );
      if (text) pushIfText(text);
    };

    const walk = (o: FabricObject) => {
      if (o.type === "image") return pushIfImage(o);
      if (o.type === "textbox") return pushIfText(o);

      if (o.type === "rect") return tryResolveProxy(o);
      // ActiveSelection：遞迴子項
      if (o.type === "activeSelection" && "getObjects" in (o as FabricObject)) {
        (o as FabricObject)
          .toObject()
          .forEach((child: FabricObject) => walk(child));
      }
    };

    objs.forEach(walk);

    // 排除背景 & UI/pending
    return out.filter((img) => {
      if (img === bgRef.current) return false;
      const data = (img as FabricImage).data || {};
      return (
        data.id && data.id !== "__background__" && !data.ui && !data.pendingFlag
      );
    });
  }

  /**
   * 以框同步圖片 - 完整修正版
   */
  /**
   * 以框同步圖片 - 最終邏輯重構版 (直接計算邊緣貼合，解決空白與位移)
   */
  function syncFrameToImageContent(
    canvas: fabric.Canvas,
    proxy: fabric.Rect,
    img: fabric.FabricImage,
    opts?: {
      isEdgeDrag?: boolean;
      isCornerScale?: boolean;
      isFirstCall?: boolean;
      isMoveOrRotate?: boolean;
    }
  ) {
    console.log("移動");
    if (
      isRestoringRef.current &&
      (opts?.isFirstCall ||
        (!opts?.isEdgeDrag && !opts?.isCornerScale && !opts?.isMoveOrRotate))
    ) {
      return;
    }
    const data = ((img as FabricImage).data ||= {});
    const frameW = Math.max(1, proxy.width || 1);
    const frameH = Math.max(1, proxy.height || 1);

    const el = img.getElement() as HTMLCanvasElement | HTMLImageElement;
    const naturalW =
      el instanceof HTMLCanvasElement
        ? el.width
        : el.naturalWidth || img.width || 1;
    const naturalH =
      el instanceof HTMLCanvasElement
        ? el.height
        : el.naturalHeight || img.height || 1;

    const isCorner = !!opts?.isCornerScale;
    const isEdge = !!opts?.isEdgeDrag;
    const isMoveOrRotate = !!opts?.isMoveOrRotate;

    const _deg2rad = (degrees: number) => (degrees * Math.PI) / 180;
    type _EdgeAnchor = "top" | "bottom" | "left" | "right";

    // 設置安全比例
    const currentScale = Math.max(0.0001, img.scaleX ?? 1);
    const currentImgScaledW = naturalW * currentScale;
    const currentImgScaledH = naturalH * currentScale;

    let targetScale = currentScale;
    let targetLeft = img.left ?? proxy.left ?? 0;
    let targetTop = img.top ?? proxy.top ?? 0;

    // ---------- Corner scale (不變) ----------
    if (isCorner) {
      if (!data.__cornerBase || opts?.isFirstCall) {
        const baseFrame = (data.frame as {
          w: number;
          h: number;
          left: number;
          top: number;
        }) || {
          w: frameW,
          h: frameH,
          left: proxy.left ?? 0,
          top: proxy.top ?? 0,
        };
        const initialScale =
          img.scaleX ??
          Math.max(baseFrame.w / naturalW, baseFrame.h / naturalH);
        data.__cornerBase = {
          frameW: baseFrame.w,
          frameH: baseFrame.h,
          imgScale: Math.max(0.0001, initialScale),
          offsetX: (img.left ?? 0) - (baseFrame.left ?? proxy.left ?? 0),
          offsetY: (img.top ?? 0) - (baseFrame.top ?? proxy.top ?? 0),
        };
      }
      const b = data.__cornerBase as {
        frameW: number;
        frameH: number;
        imgScale: number;
        offsetX: number;
        offsetY: number;
      };
      const s = Math.min(frameW / b.frameW, frameH / b.frameH);
      targetScale = (b.imgScale || 1) * s;
      targetLeft = (proxy.left ?? 0) + (b.offsetX || 0) * s;
      targetTop = (proxy.top ?? 0) + (b.offsetY || 0) * s;
      delete data.__edgeAnchor;
    }

    // ---------- Edge drag（最終邏輯重構區） ----------
    else if (isEdge) {
      if (opts?.isFirstCall && data.__edgeAnchor == null) {
        data.__edgeAnchor ||= "left";
      }
      const anchor = data.__edgeAnchor || "left";

      const theta = _deg2rad(proxy.angle || 0);
      const right = new fabric.Point(Math.cos(theta), Math.sin(theta));
      const up = new fabric.Point(-Math.sin(theta), Math.cos(theta));

      type EdgeBase = {
        baseImgScaledW: number; // 放大閾值 W
        baseImgScaledH: number; // 放大閾值 H
        baseImgScale: number;
        // 記錄圖片中心相對於外框中心的未縮放偏移
        centerOffsetInImgX: number;
        centerOffsetInImgY: number;
        anchor: _EdgeAnchor;
      };

      const frameCenter = new fabric.Point(proxy.left ?? 0, proxy.top ?? 0);
      const imgCenter = new fabric.Point(img.left ?? 0, img.top ?? 0);

      // 1. 計算當前中心點偏移 (用於閾值計算)
      const totalOffset = imgCenter.subtract(frameCenter);
      const totalOffsetX_Scaled =
        totalOffset.x * right.x + totalOffset.y * right.y;
      const totalOffsetY_Scaled = totalOffset.x * up.x + totalOffset.y * up.y;

      // 2. 決定當前的中心點相對外框中心的未縮放偏移 (用來紀錄和傳遞狀態)
      const currentCenterOffsetX = totalOffsetX_Scaled / currentScale;
      const currentCenterOffsetY = totalOffsetY_Scaled / currentScale;

      // 3. 初始化或重置 base (只在錨點切換或初次進入時執行)
      if (
        !data.__edgeBase ||
        (data.__edgeBase as { anchor: _EdgeAnchor }).anchor !== anchor
      ) {
        // 計算當前裁切量並設置閾值
        const rightCrop =
          currentImgScaledW / 2 - (frameW / 2 - totalOffsetX_Scaled);
        const leftCrop =
          currentImgScaledW / 2 - (frameW / 2 + totalOffsetX_Scaled);
        const bottomCrop =
          currentImgScaledH / 2 - (frameH / 2 - totalOffsetY_Scaled);
        const topCrop =
          currentImgScaledH / 2 - (frameH / 2 + totalOffsetY_Scaled);

        let baseW, baseH;
        if (anchor === "right") {
          baseW = frameW + Math.max(0, leftCrop);
          baseH = currentImgScaledH;
        } else if (anchor === "left") {
          baseW = frameW + Math.max(0, rightCrop);
          baseH = currentImgScaledH;
        } else if (anchor === "bottom") {
          baseH = frameH + Math.max(0, topCrop);
          baseW = currentImgScaledW;
        } else {
          baseH = frameH + Math.max(0, bottomCrop);
          baseW = currentImgScaledW;
        }

        // 記錄基準
        data.__edgeBase = {
          baseImgScaledW: baseW,
          baseImgScaledH: baseH,
          baseImgScale: currentScale,
          centerOffsetInImgX: currentCenterOffsetX,
          centerOffsetInImgY: currentCenterOffsetY,
          anchor,
        } as EdgeBase;
      }

      const base = data.__edgeBase as EdgeBase;

      // 4. 判斷是否需要放大 (使用修正後的閾值)
      let newScale = base.baseImgScale;
      let willScale = false;

      if (anchor === "right" || anchor === "left") {
        if (frameW > base.baseImgScaledW) {
          // 等比放大：保持 base 時的寬高比
          const scaleRatio = frameW / base.baseImgScaledW;
          newScale = base.baseImgScale * scaleRatio;
          willScale = true;
        }
      } else {
        // top or bottom
        if (frameH > base.baseImgScaledH) {
          console.log("放大");
          // 等比放大：保持 base 時的寬高比
          const scaleRatio = frameH / base.baseImgScaledH;
          newScale = base.baseImgScale * scaleRatio;
          willScale = true;
        }
      }

      targetScale = newScale;

      // 5. 圖片中心定位 (核心邏輯)

      if (willScale) {
        const newImgScaledW = naturalW * targetScale;
        const newImgScaledH = naturalH * targetScale;

        // 🔥 保持 base 時記錄的偏移比例
        const scaleRatio = targetScale / base.baseImgScale;
        let deltaX = base.centerOffsetInImgX * base.baseImgScale * scaleRatio;
        let deltaY = base.centerOffsetInImgY * base.baseImgScale * scaleRatio;

        // 🔥 但拖曳方向要重新計算以鎖定對側
        if (anchor === "right") {
          deltaX = newImgScaledW / 2 - frameW / 2;
        } else if (anchor === "left") {
          deltaX = -(newImgScaledW / 2 - frameW / 2);
        } else if (anchor === "bottom") {
          deltaY = newImgScaledH / 2 - frameH / 2;
        } else {
          // top
          deltaY = -(newImgScaledH / 2 - frameH / 2);
        }

        targetLeft = frameCenter.x + (right.x * deltaX + up.x * deltaY);
        targetTop = frameCenter.y + (right.y * deltaX + up.y * deltaY);
      } else {
        // 🔥 未發生縮放時：強制邊緣貼合 (防止空白)

        const frameHalfW = frameW / 2;
        const frameHalfH = frameH / 2;
        const imgHalfW = currentImgScaledW / 2;
        const imgHalfH = currentImgScaledH / 2;

        let deltaX = totalOffsetX_Scaled;
        let deltaY = totalOffsetY_Scaled;

        if (anchor === "right") {
          // 🔥 右邊拖曳：優先貼合右邊，但確保左邊不露出
          const rightAlign = imgHalfW - frameHalfW; // 右邊貼齊時的 deltaX
          const leftAlign = -(imgHalfW - frameHalfW); // 左邊貼齊時的 deltaX

          // 如果圖片比框小，強制置中
          if (currentImgScaledW <= frameW) {
            deltaX = 0;
          } else {
            // 圖片比框大，優先右對齊，但不能讓左邊露出
            deltaX = Math.min(rightAlign, Math.max(leftAlign, deltaX));
          }
        } else if (anchor === "left") {
          const rightAlign = imgHalfW - frameHalfW;
          const leftAlign = -(imgHalfW - frameHalfW);

          if (currentImgScaledW <= frameW) {
            deltaX = 0;
          } else {
            // 優先左對齊，但不能讓右邊露出
            deltaX = Math.max(leftAlign, Math.min(rightAlign, deltaX));
          }
        } else if (anchor === "bottom") {
          const bottomAlign = imgHalfH - frameHalfH;
          const topAlign = -(imgHalfH - frameHalfH);

          if (currentImgScaledH <= frameH) {
            deltaY = 0;
          } else {
            deltaY = Math.min(bottomAlign, Math.max(topAlign, deltaY));
          }
        } else if (anchor === "top") {
          const bottomAlign = imgHalfH - frameHalfH;
          const topAlign = -(imgHalfH - frameHalfH);

          if (currentImgScaledH <= frameH) {
            deltaY = 0;
          } else {
            deltaY = Math.max(topAlign, Math.min(bottomAlign, deltaY));
          }
        }

        targetLeft = frameCenter.x + (right.x * deltaX + up.x * deltaY);
        targetTop = frameCenter.y + (right.y * deltaX + up.y * deltaY);
      }

      delete data.__cornerBase;
    }

    // ---------- Move / Rotate (保持不變) ----------
    else if (isMoveOrRotate) {
      // 1) 讀取前一幀框的中心與角度（baseline）
      const prev =
        (data.frame as
          | { left?: number; top?: number; angle?: number }
          | undefined) || {};
      const prevCx = prev.left ?? proxy.left ?? 0;
      const prevCy = prev.top ?? proxy.top ?? 0;
      const prevAng = ((prev.angle ?? 0) * Math.PI) / 180;

      // 2) 把「上一幀 image 中心相對於上一幀框中心」轉成「上一幀局部座標」
      //    在 prev 角度的座標系中，right/ up 軸：
      const prevRight = new fabric.Point(Math.cos(prevAng), Math.sin(prevAng));
      const prevUp = new fabric.Point(-Math.sin(prevAng), Math.cos(prevAng));

      const imgCx = img.left ?? prevCx;
      const imgCy = img.top ?? prevCy;

      const relXw = imgCx - prevCx; // 世界向量
      const relYw = imgCy - prevCy;

      // 投影到「上一幀局部座標」
      const relLocalX = relXw * prevRight.x + relYw * prevRight.y;
      const relLocalY = relXw * prevUp.x + relYw * prevUp.y;

      // 3) 新的一幀：用「當前框中心與角度」把同一個局部向量轉回世界座標
      const curCx = proxy.left ?? prevCx;
      const curCy = proxy.top ?? prevCy;
      const curAng = ((proxy.angle ?? 0) * Math.PI) / 180;

      const curRight = new fabric.Point(Math.cos(curAng), Math.sin(curAng));
      const curUp = new fabric.Point(-Math.sin(curAng), Math.cos(curAng));

      const newLeft = curCx + curRight.x * relLocalX + curUp.x * relLocalY;
      const newTop = curCy + curRight.y * relLocalX + curUp.y * relLocalY;

      targetScale = img.scaleX ?? 1; // 只旋轉/平移不改比例
      targetLeft = newLeft;
      targetTop = newTop;
    }

    // ---------- 初次同步 (保持不變) ----------
    else {
      const s = Math.max(frameW / naturalW, frameH / naturalH);
      targetScale = s;
      targetLeft = proxy.left ?? 0;
      targetTop = proxy.top ?? 0;
      delete data.__edgeAnchor;
      delete data.__cornerBase;
    }

    // 最終輸出安全檢查
    targetLeft =
      isNaN(targetLeft) || !isFinite(targetLeft) ? proxy.left ?? 0 : targetLeft;
    targetTop =
      isNaN(targetTop) || !isFinite(targetTop) ? proxy.top ?? 0 : targetTop;
    targetScale = Math.max(0.0001, targetScale);

    // 寫回 image
    img.set({
      left: targetLeft,
      top: targetTop,
      angle: proxy.angle || 0,
      scaleX: targetScale,
      scaleY: targetScale,
      originX: "center",
      originY: "center",
    });
    img.setCoords();

    // 同步 clipPath(mask) (假設 ensureMaskRect 存在)
    const mask = ensureMaskRect(canvas, img);
    if (!isRestoringRef.current || !img.clipPath) {
      mask.set({
        left: proxy.left ?? 0,
        top: proxy.top ?? 0,
        angle: proxy.angle || 0,
        width: frameW,
        height: frameH,
        originX: "center",
        originY: "center",
        absolutePositioned: true,
      });
      mask.setCoords();
    }
    // 記錄本幀框基準
    const fabricImg = img as FabricImage;
    if (!fabricImg.data) {
      fabricImg.data = {};
    }
    fabricImg.data.frame = {
      w: frameW,
      h: frameH,
      left: proxy.left,
      top: proxy.top,
      angle: proxy.angle || 0,
    };

    canvas.requestRenderAll();
  }

  function nukeTopOverlay(canvas: fabric.Canvas) {
    const cTop = (
      canvas as unknown as { contextTop?: CanvasRenderingContext2D | null }
    ).contextTop;
    if (cTop) {
      try {
        canvas.clearContext(cTop);
      } catch {}
    }
    const upper = (canvas as unknown as { upperCanvasEl?: HTMLCanvasElement })
      .upperCanvasEl;
    if (upper) {
      const uctx = upper.getContext("2d");
      if (uctx) {
        uctx.save();
        uctx.setTransform(1, 0, 0, 1, 0, 0);
        uctx.clearRect(0, 0, upper.width, upper.height);
        uctx.restore();
      }
    }
    const br = (canvas as unknown as { freeDrawingBrush?: fabric.PencilBrush })
      .freeDrawingBrush;
    if (br) {
      try {
        // @ts-expect-error internal
        br.onMouseUp && br.onMouseUp({ e: undefined, pointer: undefined });
      } catch {}
      if (Array.isArray((br as unknown as { _points: [] })._points))
        (br as unknown as { _points: [] })._points.length = 0;
      (br as unknown as { _isDown: boolean })._isDown = false;
      (br as unknown as { _lastPoint: string | undefined })._lastPoint =
        undefined;
      (br as unknown as { _lastOriginal: string | undefined })._lastOriginal =
        undefined;
      (br as unknown as { _pathOffset: string | undefined })._pathOffset =
        undefined;
    }
    (
      canvas as unknown as { _isCurrentlyDrawing: boolean }
    )._isCurrentlyDrawing = false;

    const active = canvas.getActiveObject();
    if (
      active &&
      active.type === "path" &&
      (active as unknown as { exposedOnDrawing?: boolean }).exposedOnDrawing
    ) {
      canvas.remove(active);
    }
  }

  function snapshotOf(el: HTMLImageElement | HTMLCanvasElement): string {
    if (el instanceof HTMLCanvasElement) {
      try {
        const dataURL = el.toDataURL("image/png");
        if (!dataURL || dataURL === "data:,") {
          console.warn("Canvas toDataURL returned empty or invalid result");
          return "";
        }
        return dataURL;
      } catch (err) {
        console.error("Failed to snapshot canvas:", err);
        return "";
      }
    }

    try {
      const w = el.naturalWidth || el.width;
      const h = el.naturalHeight || el.height;

      if (w <= 0 || h <= 0) {
        console.warn("Invalid image dimensions:", w, h);
        return "";
      }

      const ctx = getOffscreenCtx(w, h);
      if (!ctx || !__offscreen) {
        console.warn("Failed to get offscreen context");
        return "";
      }

      __offscreen.width = w;
      __offscreen.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(el, 0, 0, w, h);

      const dataURL = __offscreen.toDataURL("image/png");
      if (!dataURL || dataURL === "data:,") {
        console.warn("Offscreen canvas toDataURL returned empty result");
        return "";
      }

      return dataURL;
    } catch (err) {
      console.error("Failed to snapshot image:", err);
      return "";
    }
  }

  function buildSnapshot(canvas: fabric.Canvas): HistoryState {
    const objs = canvas.getObjects();
    const serial: SerializedObject[] = [];

    for (const o of objs) {
      if (o.type === "textbox") {
        const textObj = o as fabric.IText | fabric.Textbox;
        const layerId = textObj.data?.id;

        if (!layerId || !textObj.data?.isText) continue;

        const rec: SerializedObject = {
          type: o.type as "textbox",
          text: textObj.text || "",
          left: textObj.left || 0,
          top: textObj.top || 0,
          originX: (textObj.originX ?? "center") as FabricOriginX,
          originY: (textObj.originY ?? "center") as FabricOriginY,
          fontSize: textObj.fontSize,
          fontFamily: textObj.fontFamily,
          fill: typeof textObj.fill === "string" ? textObj.fill : "#000000",
          fontWeight: textObj.fontWeight as string,
          fontStyle: textObj.fontStyle,
          underline: textObj.underline,
          textAlign: textObj.textAlign,
          width: textObj.width, // 🔥 加這行！Textbox 需要 width
          scaleX: textObj.scaleX || 1,
          scaleY: textObj.scaleY || 1,
          angle: textObj.angle || 0,
          visible: textObj.visible ?? true,
          selectable: true,
          evented: true,
          data: textObj.data,
        };
        serial.push(rec);
        continue;
      }

      if (o.type !== "image") continue;
      const img = o as fabric.FabricImage;
      const el = img.getElement() as HTMLImageElement | HTMLCanvasElement;

      const layerId = (
        img as unknown as { data?: { id?: string; isPending?: boolean } }
      ).data?.id;

      const isBg =
        layerId === "__background__" ||
        ((img as unknown as { selectable?: boolean; evented?: boolean })
          .selectable === false &&
          (img as unknown as { evented?: boolean }).evented === false);

      // 🔥 核心修正：Pending 圖層不進入 History
      //   if (isPending) {
      //     console.log(`Skip pending layer ${layerId} from history`);
      //     continue;
      //   }

      let dataURL = "";
      let baseDataURL = "";
      let maskDataURL = "";

      if (layerId && LAYER_BASE_PIXEL.has(layerId)) {
        baseDataURL = LAYER_BASE_PIXEL.get(layerId)!;
      }

      if (!baseDataURL) {
        baseDataURL = snapshotOf(el);
      }

      if (!baseDataURL && el instanceof HTMLImageElement && el.src) {
        if (IMG_DATAURL_CACHE_URL.has(el.src)) {
          baseDataURL = IMG_DATAURL_CACHE_URL.get(el.src)!;
        }
      }

      if (!baseDataURL) {
        console.error(`Failed to get base data for layer: ${layerId}`);
        continue;
      }

      if (layerId && LAYER_MASK_CANVAS.has(layerId)) {
        const maskCanvas = LAYER_MASK_CANVAS.get(layerId)!;
        try {
          maskDataURL = maskCanvas.toDataURL("image/png");
          if (!maskDataURL || maskDataURL === "data:,") {
            console.warn(`Failed to snapshot mask for layer: ${layerId}`);
            maskDataURL = "";
          }
        } catch (err) {
          console.error(`Error snapshotting mask for layer ${layerId}:`, err);
          maskDataURL = "";
        }
      }

      if (layerId && LAYER_VIEW_CANVAS.has(layerId)) {
        const viewCanvas = LAYER_VIEW_CANVAS.get(layerId)!;
        try {
          dataURL = viewCanvas.toDataURL("image/png");
        } catch (err) {
          console.error(
            `Error snapshotting view canvas for layer ${layerId}:`,
            err
          );
        }
      }

      if (!dataURL) {
        dataURL = baseDataURL;
      }

      const rec: SerializedObject = {
        type: "image",
        dataURL,
        baseDataURL,
        maskDataURL: maskDataURL || undefined,
        left: img.left || 0,
        top: img.top || 0,
        originX: (o.originX ?? "center") as FabricOriginX,
        originY: (o.originY ?? "center") as FabricOriginY,
        width: Math.round(img.width || 0),
        height: Math.round(img.height || 0),
        scaleX: img.scaleX || 1,
        scaleY: img.scaleY || 1,
        angle: img.angle || 0,
        flipX: img.flipX || false,
        flipY: img.flipY || false,
        visible: img.visible ?? true,
        selectable: isBg ? false : true,
        evented: isBg ? false : true,
        skewX: (img as unknown as { skewX?: number }).skewX ?? 0,
        skewY: (img as unknown as { skewY?: number }).skewY ?? 0,
        data: (img as unknown as { data?: Record<string, unknown> | undefined })
          .data,
        clipPath: img.clipPath ? img.clipPath.toObject() : undefined, // 🔥 加這行
      };

      //   dumpImgVsClip(img);
      serial.push(rec);
    }

    const active = canvas.getActiveObject();
    let selectedLayerId: string | null = null;
    if (active && active.type === "image") {
      const id = (
        active as unknown as { data?: { id?: string; isPending?: boolean } }
      ).data?.id;
      //   const isPending = (
      //     active as unknown as { data?: { isPending?: boolean } }
      //   ).data?.isPending;
      //   if (id && id !== "__background__" && !isPending) {
      //     selectedLayerId = id;
      //   }
      if (id && id !== "__background__") {
        selectedLayerId = id;
      }
    }

    return {
      objects: serial,
      bgVisible,
      selectedLayerId,
      userDrawnLayers: Array.from(LAYER_USER_DRAWN),
    };
  }

  function pushBaseline(canvas: fabric.Canvas) {
    if (baselinePushedRef.current) return;
    baselinePushedRef.current = true;
    const state = buildSnapshot(canvas);
    historyRef.current = [state];
    historyIndexRef.current = 0;
  }

  const saveToHistory = (canvas: fabric.Canvas) => {
    if (isRestoringRef.current) {
      console.log("Skip save: currently restoring");
      return;
    }

    if (pendingSaveRef.current !== null) {
      clearTimeout(pendingSaveRef.current);
    }

    pendingSaveRef.current = window.setTimeout(() => {
      pendingSaveRef.current = null;

      if (isRestoringRef.current) {
        console.log("Skip save: currently restoring (delayed check)");
        return;
      }

      try {
        const state = buildSnapshot(canvas);

        if (!state || !Array.isArray(state.objects)) {
          console.error("Invalid snapshot state");
          return;
        }

        historyRef.current = historyRef.current.slice(
          0,
          historyIndexRef.current + 1
        );

        historyRef.current.push(state);

        if (historyRef.current.length > MAX_HISTORY) {
          historyRef.current.shift();
        } else {
          historyIndexRef.current++;
        }
        try {
          const latest = historyRef.current[historyIndexRef.current];
          scheduleAutosave(projectId, latest);
        } catch (err) {
          console.error("autosave failed", err);
        }
        console.log("History saved:", {
          index: historyIndexRef.current,
          total: historyRef.current.length,
          objectCount: state.objects.length,
        });
      } catch (err) {
        console.error("Failed to save history:", err);
      }
    }, 100);
  };

  const applySnapshot = async (canvas: fabric.Canvas, state: HistoryState) => {
    console.log("⚡ Optimized applySnapshot starting...", {
      idx: historyIndexRef.current,
    });
    if (!canvasRef.current) return;
    isRestoringRef.current = true;

    const wasBrushMode = brushModeRef.current;
    const wasEraserMode = eraserModeRef.current;

    // 1. 暫停繪圖模式與清理 UI
    canvas.isDrawingMode = false;
    nukeTopOverlay(canvas);
    canvas.selection = false;

    // 2. 清理所有 Proxy 和 UI 物件
    const toRemove: FabricObject[] = [];
    (canvas.getObjects() as FabricObject[]).forEach((o) => {
      const d = (o as FabricObject).data;
      if (d?.ui || d?.proxyTag || d?.processingOverlay) {
        toRemove.push(o);
      }
    });
    toRemove.forEach((o) => canvas.remove(o));

    // 3. 建立現有物件的 Map
    const currentMap = new Map<string, FabricObject>();
    const bgObj = bgRef.current;

    (canvas.getObjects() as FabricObject[]).forEach((obj) => {
      if (obj === bgObj) return;
      const d = obj.data;
      const objId = d?.id as string | undefined;
      
      if (objId && !d?.ui) {
        currentMap.set(objId, obj);
      } else {
        canvas.remove(obj);
      }
    });

    // 4. 重置狀態標記
    LAYER_USER_DRAWN.clear();
    if (state.userDrawnLayers) {
      state.userDrawnLayers.forEach((id) => LAYER_USER_DRAWN.add(id));
    }
    LAYER_MASK_NONWHITE.clear();

    let restoredActiveLayer: FabricObject | null = null;
    const finalObjectsOrder: FabricObject[] = []; 

    // 5. 遍歷歷史紀錄
    for (let idx = 0; idx < state.objects.length; idx++) {
      const objState = state.objects[idx];
      const layerId = objState.data?.id as string | undefined;

      if (layerId === "__background__") continue;

      // --- A. 處理文字物件 ---
      if (objState.type === "textbox") {
        if (!layerId) continue;

        let existingText = currentMap.get(layerId) as fabric.Textbox | undefined;

        if (!existingText || existingText.type !== "textbox") {
          if (existingText) canvas.remove(existingText);
          existingText = new fabric.Textbox(objState.text || "", {
            splitByGrapheme: true,
            editable: false,
            lockScalingFlip: true,
            lockUniScaling: false,
            selectable: false,
            evented: false,
          });
          existingText.setControlsVisibility({
            mt: false, mb: false, ml: false, mr: false, mtr: true,
          });
          canvas.add(existingText);
        }

        existingText.set({
          text: objState.text,
          left: objState.left,
          top: objState.top,
          originX: (objState.originX as FabricOriginX) ?? "center",
          originY: (objState.originY as FabricOriginY) ?? "center",
          width: objState.width,
          scaleX: objState.scaleX,
          scaleY: objState.scaleY,
          angle: objState.angle,
          visible: objState.visible,
          opacity: 1,
          fontSize: objState.fontSize,
          fontFamily: objState.fontFamily,
          fill: objState.fill,
          fontWeight: objState.fontWeight,
          fontStyle: objState.fontStyle,
          underline: objState.underline,
          textAlign: objState.textAlign,
        });
        existingText.data = objState.data;
        existingText.setCoords();

        const proxy = api.ensureTextProxyRect(canvas, existingText);
        proxy.visible = objState.visible ?? true;
        proxy.evented = objState.visible ?? true;
        proxy.selectable = objState.visible ?? true;

        if (layerId === state.selectedLayerId) {
          restoredActiveLayer = existingText;
        }

        currentMap.delete(layerId); 
        finalObjectsOrder.push(existingText);
        continue;
      }

      // --- B. 處理圖片物件 ---
      if (objState.type === "image") {
        if (!layerId) continue;

        let existingImg = currentMap.get(layerId) as fabric.FabricImage | undefined;
        let needRecreate = true;

        // baseDataURL = 視覺上的圖 (包含筆刷)
        const baseDataURL = objState.baseDataURL || objState.dataURL;
        const maskDataURL = objState.maskDataURL;
        // originBase = 乾淨的底圖 (必須從 data 裡拿)
        const cleanOriginBase = (objState.data as { originBase: string, visualBase:string})?.originBase;

        if (existingImg && existingImg.type === "image") {
          const currentBase = (existingImg.data as { originBase: string, visualBase:string})?.originBase;
          const currentVisual = (existingImg.data as { originBase: string, visualBase:string})?.visualBase; // 用於比對視覺變化

          // 這裡改為比對 originBase (乾淨圖) 是否一致，以及 visualBase (視覺圖) 是否一致
          const originMatch = (currentBase === cleanOriginBase);
          const visualMatch = (currentVisual === baseDataURL);

          if (originMatch && visualMatch) {
            needRecreate = false;
          }
        }

        if (needRecreate) {
          if (existingImg) canvas.remove(existingImg);

          if (!baseDataURL) continue;

          try {
            // 1. 還原「視覺」層 (LAYER_BASE_CANVAS) -> 給使用者看的，包含筆刷
            const visualImg = await loadImage(baseDataURL);
            const w = visualImg.naturalWidth || visualImg.width;
            const h = visualImg.naturalHeight || visualImg.height;

            if (w <= 0 || h <= 0) continue;

            const baseC = document.createElement("canvas");
            baseC.width = w;
            baseC.height = h;
            const bctx = baseC.getContext("2d");
            if (!bctx) continue;
            bctx.clearRect(0, 0, w, h);
            bctx.drawImage(visualImg, 0, 0);

            // 2. 還原遮罩層
            let maskC: HTMLCanvasElement;
            if (maskDataURL) {
              const mImg = await loadImage(maskDataURL);
              maskC = document.createElement("canvas");
              maskC.width = w;
              maskC.height = h;
              const mctx = maskC.getContext("2d");
              if (mctx) {
                mctx.clearRect(0, 0, w, h);
                mctx.drawImage(mImg, 0, 0);
              }
            } else {
              maskC = document.createElement("canvas");
              maskC.width = w;
              maskC.height = h;
              const mctx = maskC.getContext("2d");
              if (mctx) {
                mctx.fillStyle = "#ffffff";
                mctx.fillRect(0, 0, w, h);
              }
            }

            const viewC = document.createElement("canvas");
            viewC.width = w;
            viewC.height = h;

            LAYER_BASE_CANVAS.set(layerId, baseC);
            LAYER_MASK_CANVAS.set(layerId, maskC);
            LAYER_VIEW_CANVAS.set(layerId, viewC);

            try {
              LAYER_BASE_PIXEL.set(layerId, baseC.toDataURL("image/png"));
            } catch (err) {}

            // 🔥🔥🔥 關鍵修正：只還原乾淨底圖 🔥🔥🔥
            // 只有當 objState.data.originBase 存在時，才更新 LAYER_CLEAN_BASE
            // 絕對不要用 baseDataURL 去覆蓋它，因為 baseDataURL 可能是髒的
            if (cleanOriginBase) {
              LAYER_CLEAN_BASE.set(layerId, cleanOriginBase);
            } 
            // 如果 cleanOriginBase 不存在 (可能是舊資料)，我們不做任何事
            // 這樣可以保留記憶體中可能存在的正確乾淨圖，防止被污染

            composeToView(layerId);

            existingImg = new fabric.FabricImage(viewC);
            
            existingImg.data = objState.data || {};
            // 記住這兩個狀態以便下次 Diff
            (existingImg.data  as { originBase: string, visualBase:string}).originBase = cleanOriginBase;
            (existingImg.data  as { originBase: string, visualBase:string}).visualBase = baseDataURL; 

            existingImg.objectCaching = false;
            (existingImg as FabricImage).noScaleCache = true;
            (existingImg as FabricImage).selectable = false;
            (existingImg as FabricImage).evented = false;

            canvas.add(existingImg);
          } catch (err) {
            console.error("Restoration failed for layer", layerId, err);
            continue;
          }
        }

        // 更新幾何屬性
        if (existingImg) {
          existingImg.set({
            left: objState.left,
            top: objState.top,
            originX: (objState.originX as FabricOriginX) ?? "center",
            originY: (objState.originY as FabricOriginY) ?? "center",
            scaleX: objState.scaleX,
            scaleY: objState.scaleY,
            angle: objState.angle,
            flipX: objState.flipX,
            flipY: objState.flipY,
            visible: objState.visible,
            skewX: objState.skewX ?? 0,
            skewY: objState.skewY ?? 0,
            opacity: 1,
          });

          if (objState.clipPath) {
            const cp = objState.clipPath as FabricObject;
            const clipRect = new fabric.Rect({
              left: cp.left,
              top: cp.top,
              width: cp.width,
              height: cp.height,
              originX: cp.originX || "center",
              originY: cp.originY || "center",
              scaleX: 1,
              scaleY: 1,
              angle: cp.angle || 0,
              absolutePositioned: true,
              inverted: false,
              fill: "#000",
            });
            existingImg.clipPath = clipRect;
            
            if(!existingImg.data) existingImg.data = {};
            existingImg.data.frame = {
              w: cp.width,
              h: cp.height,
              left: cp.left,
              top: cp.top,
              angle: cp.angle || 0,
            };
          } else {
            existingImg.clipPath = undefined;
          }

          existingImg.setCoords();

          const proxy = api.ensureProxyRect(canvas, existingImg);
          
          if (objState.clipPath) {
             const cp = objState.clipPath;
             proxy.set({
               left: cp.left, 
               top: cp.top, 
               width: cp.width, 
               height: cp.height, 
               angle: cp.angle || 0
             });
             proxy.setCoords();
          }

          const imgVisible = objState.visible ?? true;
          proxy.visible = imgVisible;
          proxy.evented = imgVisible;
          proxy.selectable = imgVisible;

          if (maskDataURL) {
            LAYER_MASK_NONWHITE.add(layerId);
          } else {
            LAYER_MASK_NONWHITE.delete(layerId);
          }

          if (layerId === state.selectedLayerId) {
            restoredActiveLayer = existingImg;
          }

          currentMap.delete(layerId);
          finalObjectsOrder.push(existingImg);
        }
      }
    }

    // 6. 移除與清理
    currentMap.forEach((obj) => {
      canvas.remove(obj);
      const id = obj.data?.id as string | undefined;
      if (id) {
        LAYER_BASE_CANVAS.delete(id);
        LAYER_MASK_CANVAS.delete(id);
        LAYER_VIEW_CANVAS.delete(id);
        LAYER_BASE_PIXEL.delete(id);
        LAYER_IMG_CACHE.delete(id);
        LAYER_HAS_BRUSH.delete(id);
        LAYER_MASK_NONWHITE.delete(id);
        LAYER_USER_DRAWN.delete(id);
        // 注意：這裡不刪除 LAYER_CLEAN_BASE，以防萬一還原回來時可以用
      }
    });

    // 7. 排序
    finalObjectsOrder.forEach((obj) => {
      canvas.bringObjectToFront(obj);
    });

    const proxies = canvas.getObjects().filter(o => o.data?.ui || o.data?.proxyTag);
    proxies.forEach(p => canvas.bringObjectToFront(p));

    const handle = canvas.getObjects().find(o => o.data?.isMultiSelectHandle);
    if(handle) canvas.bringObjectToFront(handle);

    if (artboardRef.current) canvas.sendObjectToBack(artboardRef.current);
    if (bgRef.current) {
      (bgRef.current as unknown as { visible?: boolean }).visible = state.bgVisible;
      canvas.sendObjectToBack(bgRef.current);
    }
    setBgVisible(state.bgVisible);

    // 8. 恢復工具狀態
    if (wasBrushMode && restoredActiveLayer) {
      canvas.isDrawingMode = true;
      brushModeRef.current = true;
      eraserModeRef.current = false;
      activeLayerRef.current = restoredActiveLayer as fabric.FabricImage;
      enterLockedBrushLike(canvas, restoredActiveLayer as fabric.FabricImage);
    } else if (wasEraserMode && restoredActiveLayer) {
      canvas.isDrawingMode = true;
      eraserModeRef.current = true;
      brushModeRef.current = false;
      activeLayerRef.current = restoredActiveLayer as fabric.FabricImage;
      enterLockedBrushLike(canvas, restoredActiveLayer as fabric.FabricImage);
    } else {
      canvas.isDrawingMode = false;
      canvas.selection = true;
      brushModeRef.current = false;
      eraserModeRef.current = false;
      (canvas as unknown as { defaultCursor?: string }).defaultCursor = "default";

      if (restoredActiveLayer) {
        activeLayerRef.current = restoredActiveLayer as fabric.FabricImage;
        const layerId = (restoredActiveLayer as FabricObject).data?.id;
        if (layerId) {
          const proxyTag = `__proxy_${layerId}`;
          const proxyRect = (canvas.getObjects() as FabricObject[]).find(
            (o) => (o as FabricObject).data?.proxyTag === proxyTag
          );
          if (proxyRect) {
            canvas.setActiveObject(proxyRect);
          } else {
            canvas.setActiveObject(restoredActiveLayer);
          }
        }
      } else {
        activeLayerRef.current = null;
        canvas.discardActiveObject();
      }
    }

    const focusId = mobileFocusRef.current;
    if (focusId) {
      canvas.getObjects().forEach((obj) => {
        const data = obj.data || {};
        const layerId = data.id || data.hostId;
        if (layerId !== focusId && layerId !== "__background__" && !data.isArtboard) {
          obj.visible = false;
          obj.evented = false;
          obj.selectable = false;
        }
        if (layerId === focusId) {
          obj.visible = true;
          obj.selectable = false;
          obj.evented = false;
          obj.hasControls = false;
        }
      });
      if (bgRef.current) bgRef.current.visible = false;
      if (artboardRef.current) artboardRef.current.visible = false;
    }

    const pendingLayers = (canvas.getObjects() as FabricObject[])
      .filter((o) => {
        const d = (o as FabricObject).data;
        return o.type === "image" && d?.isPending && d?.id;
      })
      .map((o) => (o as FabricObject).data?.id as string);

    if (pendingLayers.length > 0) {
      const taskGroups = new Map<string, string[]>();
      (canvas.getObjects() as FabricObject[]).forEach((o) => {
        const d = (o as FabricObject).data;
        if (o.type === "image" && d?.isPending && d?.taskId && d?.id) {
          const taskId = d.taskId as string;
          const layerId = d.id as string;
          if (!taskGroups.has(taskId)) {
            taskGroups.set(taskId, []);
          }
          taskGroups.get(taskId)!.push(layerId);
        }
      });

      taskGroups.forEach((layerIds) => {
        if (layerIds.length > 1) {
          api.setLayerProcessing(layerIds, true);
        }
      });
    }

    canvas.requestRenderAll();
    isRestoringRef.current = false;
    console.log("⚡ Optimized applySnapshot completed.");
  };

  const updateActiveLayerRefFromCanvas = (canvas: fabric.Canvas) => {
    const a = canvas.getActiveObject();

    // 🔥 修正：如果選中的是 proxy rect，找到對應的 image
    if (a && a.type === "rect") {
      const hostId = (a as unknown as { data?: { hostId?: string } }).data
        ?.hostId;
      if (hostId) {
        const img = (canvas.getObjects() as FabricObject[]).find(
          (o) => o.type === "image" && (o as FabricObject).data?.id === hostId
        ) as fabric.FabricImage | undefined;

        if (img && img !== bgRef.current) {
          activeLayerRef.current = img;
          return;
        }
      }
    }

    // 原本的邏輯
    const idMaybe =
      a &&
      a.type === "image" &&
      (a as unknown as { data?: { id?: string } }).data?.id;
    if (
      a &&
      a.type === "image" &&
      idMaybe &&
      idMaybe !== "__background__" &&
      !(a as unknown as { data?: { ui?: boolean } }).data?.ui
    ) {
      activeLayerRef.current = a as fabric.FabricImage;
    } else {
      activeLayerRef.current = null;
    }
  };

  const createArtboard = (
    canvas: fabric.Canvas,
    width: number,
    height: number
  ) => {
    if (artboardRef.current) {
      canvas.remove(artboardRef.current);
    }

    const cw = canvas.getWidth()!;
    const ch = canvas.getHeight()!;

    // 創建透明格子圖案
    const patternCanvas = document.createElement("canvas");
    patternCanvas.width = 20;
    patternCanvas.height = 20;
    const patternCtx = patternCanvas.getContext("2d")!;

    patternCtx.fillStyle = "#ffffff";
    patternCtx.fillRect(0, 0, 20, 20);
    patternCtx.fillStyle = "#e0e0e0";
    patternCtx.fillRect(0, 0, 10, 10);
    patternCtx.fillRect(10, 10, 10, 10);

    const artboard = new fabric.Rect({
      left: cw / 2,
      top: ch / 2,
      originX: "center",
      originY: "center",
      width: width,
      height: height,
      fill: new fabric.Pattern({
        source: patternCanvas,
        repeat: "repeat",
      }),
      stroke: "#3b82f6",
      strokeWidth: 2,
      strokeDashArray: [10, 5],
      selectable: false,
      evented: false,
      excludeFromExport: true,
      objectCaching: false,
    });

    (
      artboard as unknown as { data?: { id?: string; isArtboard?: boolean } }
    ).data = {
      id: "__artboard__",
      isArtboard: true,
    };

    canvas.add(artboard);
    // 🔥 完整禁用互動
    artboard.selectable = false;
    artboard.evented = false;
    artboard.hasControls = false;
    artboard.hasBorders = false;
    artboard.lockMovementX = true;
    artboard.lockMovementY = true;
    artboard.hoverCursor = "default";

    // 🔥 關鍵：監聽鼠標事件強制設置游標
    canvas.on("mouse:over", (e) => {
      if (e.target === artboard) {
        canvas.defaultCursor = "default";
        const upper = (canvas as Canvas).upperCanvasEl;
        if (upper) upper.style.cursor = "default";
      }
    });

    canvas.on("mouse:move", (e) => {
      if (e.target === artboard) {
        const upper = (canvas as Canvas).upperCanvasEl;
        if (upper) upper.style.cursor = "default";
      }
    });

    canvas.sendObjectToBack(artboard);
    if (bgRef.current) {
      canvas.sendObjectToBack(bgRef.current);
    }

    // 🔥 設定 Canvas 的 clipPath
    const clipRect = new fabric.Rect({
      left: cw / 2,
      top: ch / 2,
      originX: "center",
      originY: "center",
      width: width,
      height: height,
      absolutePositioned: true,
      selectable: false, // 🔥 加這行
      evented: false, // 🔥 加這行
    });

    canvas.clipPath = clipRect;

    artboardRef.current = artboard;
    canvas.requestRenderAll();
  };

  const updateArtboardPosition = (canvas: fabric.Canvas) => {
    const artboard = artboardRef.current;
    if (!artboard) return;

    const cw = canvas.getWidth()!;
    const ch = canvas.getHeight()!;

    artboard.set({
      left: cw / 2,
      top: ch / 2,
    });
    artboard.setCoords();

    // 🔥 同步更新 clipPath
    if (canvas.clipPath && canvas.clipPath instanceof fabric.Rect) {
      (canvas.clipPath as fabric.Rect).set({
        left: cw / 2,
        top: ch / 2,
      });
    }

    canvas.requestRenderAll();
  };

  const enterLockedBrushLike = (
    canvas: fabric.Canvas,
    img: fabric.FabricImage
  ) => {
    nukeTopOverlay(canvas);

    const layerId = (img as unknown as { data?: { id?: string } }).data?.id;

    // 🔥 修正：隱藏所有 proxy，不只是當前圖層的
    (canvas.getObjects() as FabricObject[]).forEach((o) => {
      const d = (o as FabricObject).data;
      if (d?.proxyTag) {
        o.visible = false;
        o.evented = false;
        o.selectable = false;
      }
    });

    // 🔥 恢復 image 的互動性
    img.selectable = true;
    img.evented = true;
    img.hoverCursor = "crosshair";
    img.hasControls = false;
    img.hasBorders = false;

    canvas.isDrawingMode = true;
    canvas.selection = false;

    // 設置自定義游標
    const size = brushModeRef.current
      ? canvas.freeDrawingBrush?.width || 20
      : eraserSizeRef.current;
    const color = eraserModeRef.current ? "#ff0000" : "#000000";
    const zoom = canvas.getZoom();

    canvas.freeDrawingCursor = `url(${getDrawCursor(size * zoom, color)}) ${
      (size * zoom) / 2
    } ${(size * zoom) / 2}, crosshair`;

    canvas.forEachObject((obj) => {
      const isBg = obj === bgRef.current;
      const isTarget = obj === img;
      if (isBg) return;

      if (!isTarget) {
        (obj as unknown as { selectable?: boolean }).selectable = false;
        (obj as unknown as { evented?: boolean }).evented = false;
      }
    });

    canvas.setActiveObject(img);

    const brush = canvas.freeDrawingBrush as fabric.PencilBrush;

    if (brushModeRef.current) {
      brush.color = "rgba(0,0,0,0)";
      brush.width = brush.width || 20;

      if (layerId) {
        const needNewSnapshot =
          !drawingSessionRef.current ||
          drawingSessionRef.current.layerId !== layerId;

        if (needNewSnapshot) {
          const baseCanvas = LAYER_BASE_CANVAS.get(layerId) || null;
          const maskCanvas = LAYER_MASK_CANVAS.get(layerId) || null;
          drawingSessionRef.current = {
            layerId,
            baseSnapshot: baseCanvas ? baseCanvas.toDataURL("image/png") : "",
            maskSnapshot: maskCanvas ? maskCanvas.toDataURL("image/png") : "",
          };
        }
      }
    }

    if (eraserModeRef.current) {
      brush.color = "rgba(0,0,0,0)";
      brush.width = eraserSizeRef.current;
    }

    canvas.requestRenderAll();
  };

  const exitAllDraw = (canvas: fabric.Canvas, keepSelection = true) => {
    canvas.isDrawingMode = false;
    nukeTopOverlay(canvas);

    brushModeRef.current = false;
    brushArmedRef.current = false;
    eraserModeRef.current = false;

    currentDrawingPathsRef.current = [];

    canvas.selection = true;
    (canvas as unknown as { defaultCursor?: string }).defaultCursor = "default";

    // 🔥 恢復 proxy 狀態：但要跟著對應圖層的 visible 走
    const allObjects = canvas.getObjects() as FabricObject[];

    // 先把 image 用 id 建一個 map
    const imageById = new Map<string, FabricObject>();
    allObjects.forEach((o) => {
      const d = o.data;
      if (o.type === "image" && d?.id) {
        imageById.set(d.id as string, o);
      }
    });

    allObjects.forEach((obj) => {
      const data = obj.data;
      if (!data?.proxyTag) return;

      const hostId = data.hostId as string | undefined;
      let hostVisible = true;

      if (hostId && imageById.has(hostId)) {
        const host = imageById.get(hostId)!;
        hostVisible = host.visible ?? true;
      }

      // 🔥 proxy 跟著 host 的 visible
      obj.visible = hostVisible;
      obj.evented = hostVisible;
      obj.selectable = hostVisible;
    });

    // 🔥 恢復所有 image 的設定
    const images = getObjectsNoBgImagesOnly();
    images.forEach((img) => {
      const fabricImg = img as fabric.FabricImage;
      fabricImg.hasControls = true;
      fabricImg.hasBorders = true;
      fabricImg.selectable = false; // image 本身不可選
      fabricImg.evented = false;
    });

    canvas.forEachObject((obj) => {
      if (
        obj !== bgRef.current &&
        !(obj as unknown as { data?: { locked?: boolean } }).data?.locked
      ) {
        const isProxy = (obj as FabricObject).data?.proxyTag;

        if (isProxy) {
          (obj as unknown as { selectable?: boolean }).selectable = true;
          (obj as unknown as { evented?: boolean }).evented = true;
          (obj as unknown as { hoverCursor?: string }).hoverCursor = "move";
        }
      }
    });

    if (!keepSelection) {
      canvas.discardActiveObject();
      activeLayerRef.current = null;
    } else {
      updateActiveLayerRefFromCanvas(canvas);

      // 🔥 如果有 activeLayer，選中對應的 proxy
      if (activeLayerRef.current) {
        const layerId = (activeLayerRef.current as FabricObject).data?.id;
        if (layerId) {
          const proxyTag = `__proxy_${layerId}`;
          const proxyRect = (canvas.getObjects() as FabricObject[]).find(
            (o) => (o as FabricObject).data?.proxyTag === proxyTag
          );
          if (proxyRect) {
            canvas.setActiveObject(proxyRect);
          }
        }
      }
    }
    canvas.requestRenderAll();
  };

  const getTopObjectAtPointer = (
    canvas: fabric.Canvas,
    pointer: fabric.Point
  ) => {
    const objs = canvas.getObjects();
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      if (!o.visible || o === bgRef.current) continue;
      const anyContains = o as unknown as {
        containsPoint?: (p: fabric.Point) => boolean;
      };
      if (
        typeof anyContains.containsPoint === "function" &&
        anyContains.containsPoint(pointer)
      ) {
        return o as FabricObject;
      }
    }
    return null;
  };

  function pauseDrawing(canvas: fabric.Canvas) {
    if (pausedForPanOrZoomRef.current) return;
    wasDrawingWhenPausedRef.current = canvas.isDrawingMode;
    if (canvas.isDrawingMode) {
      canvas.isDrawingMode = false;
      nukeTopOverlay(canvas);
    }
    pausedForPanOrZoomRef.current = true;
  }

  function resumeDrawingIfNeeded(canvas: fabric.Canvas) {
    if (!pausedForPanOrZoomRef.current) return;
    pausedForPanOrZoomRef.current = false;
    if (wasDrawingWhenPausedRef.current) {
      canvas.isDrawingMode = true;
      if (activeLayerRef.current) {
        enterLockedBrushLike(canvas, activeLayerRef.current);
      }
    }
    wasDrawingWhenPausedRef.current = false;
  }

  const attachFabricListeners = (canvas: fabric.Canvas) => {
    const syncLayers = () => {
      const cb = objectsChangeRef.current;
      if (!cb) return;

      const images = getObjectsNoBgImagesOnly();
      const topToBottom = images
        .slice()
        .reverse()
        .map((o, idx) => {
          const data = (
            o as unknown as {
              data?: {
                id?: string;
                name?: string;
                thumb?: string;
                isPending?: boolean;
                jobId?: string;
                type?: string;
              };
            }
          ).data;
          const id = data?.id ?? `obj-${idx}`;
          return {
            id,
            name: data?.name ?? `Layer`,
            visible: o.visible ?? true,
            thumb: data?.thumb,
            hasMask: !!(data?.id && LAYER_MASK_NONWHITE.has(data.id)),
            hasBrush: !!(data?.id && LAYER_HAS_BRUSH.has(data.id)),
            isPending: data?.isPending ?? false,
            jobId: data?.jobId,
            type: data?.type,
          } as StageLayerItem;
        });

      cb(topToBottom);
    };

    const syncSelection = () => {
      if (isRestoringRef.current) return;
      const cb = selectionChangeRef.current;
      if (!cb) return;
      if (brushModeRef.current || eraserModeRef.current) return;

      const active = canvas.getActiveObject();

      // 如果是多選 handle，不要觸發 callback
      if (active && (active as FabricObject).data?.isMultiSelectHandle) {
        return;
      }
      updateActiveLayerRefFromCanvas(canvas);

      const getAOs = (
        canvas as unknown as { getActiveObjects?: () => FabricObject[] }
      ).getActiveObjects;
      const raw =
        typeof getAOs === "function"
          ? getAOs.call(canvas)
          : canvas.getActiveObject()
          ? [canvas.getActiveObject() as FabricObject]
          : [];

      console.log("raw ", raw);
      console.log(
        "active是什麼:",
        active,
        "isHandle:",
        (active as FabricObject).data?.isMultiSelectHandle
      );

      // 🔥 先用 resolveToImageObjects 處理圖片（保持原有多選邏輯）
      const images = resolveToImageObjects(raw as FabricObject[], canvas);
      const imageIds = images
        .map((img) => (img as FabricImage).data?.id as string | undefined)
        .filter((x): x is string => typeof x === "string" && x.length > 0);

      // 🔥 再額外處理文字物件
      const textIds: string[] = [];
      for (const obj of raw) {
        const d = (obj as FabricObject).data;
        if (obj.type === "textbox" && d?.id && d?.isText) {
          textIds.push(d.id as string);
        }
      }

      // 🔥 合併去重
      const ids = Array.from(new Set([...imageIds, ...textIds]));

      cb(ids);
    };

    canvas.on("object:added", (e) => {
      syncLayers();
      const t = (e as FModEvt | undefined)?.target as unknown as
        | (FabricObject & {
            data?: {
              id?: string;
              ui?: boolean;
              isPending?: boolean;
              isText?: boolean;
            };
          })
        | undefined;
      const isImageLayer =
        t?.type === "image" &&
        t?.data?.id &&
        t?.data?.id !== "__background__" &&
        !t?.data?.ui &&
        !t?.data?.isPending;
      const isTextLayer = t?.type === "textbox" && t?.data?.isText; // 🔥 加這行
      if (!isRestoringRef.current && (isImageLayer || isTextLayer))
        saveToHistory(canvas); // 🔥 改這行
    });

    canvas.on("object:removed", (e) => {
      syncLayers();
      const t = (e as FModEvt | undefined)?.target as unknown as
        | (FabricObject & {
            data?: {
              id?: string;
              ui?: boolean;
              isPending?: boolean;
              isText?: boolean;
            };
          })
        | undefined;
      const isImageLayer =
        t?.type === "image" &&
        t?.data?.id &&
        t?.data?.id !== "__background__" &&
        !t?.data?.ui &&
        !t?.data?.isPending;
      const isTextLayer = t?.type === "textbox" && t?.data?.isText; // 🔥 加這行
      if (!isRestoringRef.current && (isImageLayer || isTextLayer))
        saveToHistory(canvas); // 🔥 改這行
    });

    canvas.on("object:modified", (e) => {
      syncLayers();
      if (isRestoringRef.current || isLiveCompositeRef.current) return;

      const t = (e as FModEvt | undefined)?.target as unknown as
        | (FabricObject & {
            data?: { id?: string; ui?: boolean; isPending?: boolean };
          } & {
            type?: string;
            _objects?: FabricObject[];
          })
        | undefined;

      if (t?.data?.ui && t?.data?.hostId) {
        saveToHistory(canvas);
        return;
      }

      const isImageLayer =
        t?.type === "image" &&
        t?.data?.id &&
        t?.data?.id !== "__background__" &&
        !t?.data?.ui &&
        !t?.data?.isPending;
      const isTextLayer = t?.type === "textbox" && t?.data?.isText; // 🔥 加這行
      if (isImageLayer || isTextLayer) {
        // 🔥 改這行
        saveToHistory(canvas);
        return;
      }

      const sel = t as unknown as { _objects?: FabricObject[] };
      if (t?.type === "activeSelection" && Array.isArray(sel?._objects)) {
        const hasImage = sel._objects.some((o: FabricObject) => {
          const d = (
            o as unknown as {
              data?: { id?: string; ui?: boolean; isPending?: boolean };
            }
          ).data;
          return (
            o.type === "image" &&
            d?.id &&
            d.id !== "__background__" &&
            !d?.ui &&
            !d?.isPending
          );
        });
        if (hasImage) saveToHistory(canvas);
      }
    });

    canvas.on("selection:created", (e) => {
      type SelectionEvent = {
        selected?: FabricObject[];
        target?: FabricObject;
        deselected?: FabricObject[];
      };
    
      const evt = e as unknown as SelectionEvent;
      const target = evt.selected?.[0] || evt.target;
    
      if (target) {
        const d = (target as FabricObject).data;
        if (d?.proxyTag && d?.hostId) {
          // 🔥 修正：同時檢查 image 和 textbox
          const hostObj = (canvas.getObjects() as FabricObject[]).find(
            (obj) =>
              (obj.type === "image" || obj.type === "textbox") &&
              (obj as FabricObject).data?.id === d.hostId
          );
          if (hostObj && !(hostObj.visible ?? true)) {
            requestAnimationFrame(() => {
              canvas.discardActiveObject();
              canvas.requestRenderAll();
            });
            return;
          }
        }
      }
    
      syncLayers();
      syncSelection();
    });

    canvas.on("selection:updated", (e) => {
      type SelectionEvent = {
        selected?: FabricObject[];
        target?: FabricObject;
        deselected?: FabricObject[];
      };
    
      const evt = e as unknown as SelectionEvent;
      const target = evt.selected?.[0] || evt.target;
    
      if (target) {
        const d = (target as FabricObject).data;
        if (d?.proxyTag && d?.hostId) {
          // 🔥 修正：同時檢查 image 和 textbox
          const hostObj = (canvas.getObjects() as FabricObject[]).find(
            (obj) =>
              (obj.type === "image" || obj.type === "textbox") &&
              (obj as FabricObject).data?.id === d.hostId
          );
          if (hostObj && !(hostObj.visible ?? true)) {
            requestAnimationFrame(() => {
              canvas.discardActiveObject();
              canvas.requestRenderAll();
            });
            return;
          }
        }
      }
    
      syncLayers();
      syncSelection();
    });
    // canvas.on("selection:cleared", () => {
    //   syncLayers();
    //   syncSelection("selection:cleared");
    // });

    canvas.on("path:created", async (e) => {
      const path = (e as unknown as { path?: fabric.Path }).path;
      if (path) canvas.remove(path);

      const targetImg = activeLayerRef.current;
      if (!targetImg) return;

      const element = targetImg.getElement() as HTMLCanvasElement;
      const W = element.width;
      const H = element.height;
      const baseCanvas =
        LAYER_BASE_CANVAS.get(
          (targetImg as unknown as { data?: { id?: string } }).data?.id || ""
        ) ||
        (() => {
          const c = document.createElement("canvas");
          c.width = W;
          c.height = H;
          return c;
        })();
      const maskCanvas = LAYER_MASK_CANVAS.get(
        (targetImg as unknown as { data?: { id?: string } }).data?.id || ""
      );

      const imgAngle = targetImg.angle || 0;
      const imgScaleX = targetImg.scaleX || 1;
      const imgScaleY = targetImg.scaleY || 1;
      const cx = targetImg.left || 0;
      const cy = targetImg.top || 0;
      const scaleToPxX = W / (targetImg.width! * imgScaleX);
      const scaleToPxY = H / (targetImg.height! * imgScaleY);

      const pathData = (e as unknown as { path?: { path?: unknown[] } }).path
        ?.path as unknown[] | undefined;
      const layerId = (targetImg as unknown as { data?: { id?: string } }).data
        ?.id;
      if (!layerId) return;

      const toCanvasPath = (ctx: CanvasRenderingContext2D) => {
        if (!pathData) return;
        ctx.beginPath();
        for (let i = 0; i < pathData.length; i++) {
          const [cmd, ...coords] = pathData[i] as [string, ...number[]];
          const T: number[] = [];
          for (let j = 0; j < coords.length; j += 2) {
            const x = coords[j],
              y = coords[j + 1];
            const rx = x - cx,
              ry = y - cy;
            const ang = -(imgAngle * Math.PI) / 180;
            const cosA = Math.cos(ang),
              sinA = Math.sin(ang);
            const rotX = rx * cosA - ry * sinA;
            const rotY = rx * sinA + ry * cosA;
            const px = rotX * scaleToPxX + W / 2;
            const py = rotY * scaleToPxY + H / 2;
            T.push(px, py);
          }
          if (cmd === "M") ctx.moveTo(T[0], T[1]);
          else if (cmd === "L") ctx.lineTo(T[0], T[1]);
          else if (cmd === "Q") ctx.quadraticCurveTo(T[0], T[1], T[2], T[3]);
          else if (cmd === "C")
            ctx.bezierCurveTo(T[0], T[1], T[2], T[3], T[4], T[5]);
        }
      };

      if (brushModeRef.current) {
        const bctx = baseCanvas.getContext("2d")!;
        const brush = canvas.freeDrawingBrush as fabric.PencilBrush;
        bctx.save();
        bctx.lineCap = "round";
        bctx.lineJoin = "round";
        bctx.strokeStyle = (brush?.color as string) || "#3a3a3a";
        bctx.lineWidth =
          (brush?.width || 20) * Math.min(scaleToPxX, scaleToPxY);
        toCanvasPath(bctx);
        bctx.stroke();
        bctx.restore();

        composeToView(layerId);
        targetImg.dirty = true;
        canvas.requestRenderAll();

        LAYER_USER_DRAWN.add(layerId);
        LAYER_HAS_BRUSH.add(layerId);
        LAYER_BASE_PIXEL.set(layerId, baseCanvas.toDataURL("image/png"));

        // 🔥 關鍵修正：畫完後立即恢復對 image 的選擇
        canvas.setActiveObject(targetImg);
        activeLayerRef.current = targetImg;

        canvas.fire("object:modified", {
          target: targetImg,
        } as ModifiedEvent<TPointerEvent> | undefined);

        // 🔥 強制儲存 history
        if (!isRestoringRef.current) {
          saveToHistory(canvas);
        }
        return;
      }

      if (eraserModeRef.current) {
        let mask = maskCanvas;
        if (!mask) {
          mask = document.createElement("canvas");
          mask.width = W;
          mask.height = H;
          const mctx = mask.getContext("2d")!;
          mctx.fillStyle = "#ffffff";
          mctx.fillRect(0, 0, W, H);
          LAYER_MASK_CANVAS.set(layerId, mask);
        }
        const mctx = mask.getContext("2d")!;
        mctx.save();
        mctx.lineCap = "round";
        mctx.lineJoin = "round";
        mctx.strokeStyle = eraserRestoreRef.current ? "#ffffff" : "#000000";
        const lineWidthPx =
          (canvas.freeDrawingBrush?.width || eraserSizeRef.current) *
          Math.min(scaleToPxX, scaleToPxY);
        mctx.lineWidth = Math.max(2, lineWidthPx);
        toCanvasPath(mctx);
        mctx.stroke();
        mctx.restore();

        LAYER_MASK_NONWHITE.add(layerId);

        composeToView(layerId);
        targetImg.dirty = true;
        canvas.requestRenderAll();

        // 🔥 關鍵修正：畫完後立即恢復對 image 的選擇
        canvas.setActiveObject(targetImg);
        activeLayerRef.current = targetImg;

        canvas.fire("object:modified", {
          target: targetImg,
        } as ModifiedEvent<TPointerEvent> | undefined);

        // 🔥 強制儲存 history
        if (!isRestoringRef.current) {
          saveToHistory(canvas);
        }
        return;
      }
    });

    canvas.on("mouse:wheel", (opt) => {
      const e = (opt as unknown as { e: WheelEvent }).e;
      e.preventDefault();

      if (brushModeRef.current || eraserModeRef.current) pauseDrawing(canvas);

      const delta = e.deltaY > 0 ? -10 : 10;
      const percent = clamp(
        Math.round(canvas.getZoom() * 100) + delta,
        25,
        400
      );
      const z = percent / 100;
      const point = new fabric.Point(
        (e as unknown as { offsetX?: number }).offsetX ?? 0,
        (e as unknown as { offsetY?: number }).offsetY ?? 0
      );
      canvas.zoomToPoint(point, z);
      zoomChangeRef.current?.(Math.round(z * 100));
      canvas.requestRenderAll();

      resumeDrawingIfNeeded(canvas);

      // 🔥 更新游標尺寸以匹配新的縮放比例
      if (
        (brushModeRef.current || eraserModeRef.current) &&
        canvas.isDrawingMode
      ) {
        const size = brushModeRef.current
          ? canvas.freeDrawingBrush?.width || 20
          : eraserSizeRef.current;
        const color = eraserModeRef.current ? "#ff0000" : "#000000";
        const zoom = canvas.getZoom();
        canvas.freeDrawingCursor = `url(${getDrawCursor(size * zoom, color)}) ${
          (size * zoom) / 2
        } ${(size * zoom) / 2}, crosshair`;
      }
    });

    canvas.on("mouse:down", (opt) => {
      // 🔥 Step 1: 先取得 event 並判斷多點觸控
      const e = (opt as fabric.TPointerEventInfo).e as
        | MouseEvent
        | TouchEvent
        | undefined;

      if (e && "touches" in e && e.touches.length > 1) {
        // 多點觸控，完全不處理
        return;
      }

      // 🔥 Step 2: 手機編輯模式強制畫布拖曳
      const isMobileEdit = (canvas as Canvas & { __mobileEditMode?: boolean })
        .__mobileEditMode;
      if (isMobileEdit && !(brushModeRef.current || eraserModeRef.current)) {
        if (e) e.preventDefault();

        const clientX =
          e && "touches" in e
            ? e.touches[0].clientX
            : (e as MouseEvent)?.clientX || 0;
        const clientY =
          e && "touches" in e
            ? e.touches[0].clientY
            : (e as MouseEvent)?.clientY || 0;

        isDraggingRef.current = true;
        lastPosRef.current = { x: clientX, y: clientY };
        safeSetCursor(canvas, "grabbing");
        return;
      }

      // 🔥 Step 3: 原本的邏輯（用 mouseEvent 變數避免型別衝突）
      
      // 🛑 修正衝突點 1：Proxy 同步邏輯
      (canvas.getObjects() as FabricObject[]).forEach((o) => {
        const d = (o as FabricObject).data;
        // 確保我們只處理 Proxy 物件
        if (d?.proxyTag && d?.hostId) {
          
          // (這裡保留原本的群組檢查邏輯)
          const belongsToGroup = canvas.getObjects().some((obj) => {
            const objData = (obj as FabricObject).data;
            return (
              objData?.isMultiSelectHandle &&
              Array.isArray(objData?.targetIds) &&
              (objData.targetIds as string[]).includes(d.hostId as string)
            );
          });
          if (belongsToGroup) return;

          // 找到宿主 (Host)
          const host = (canvas.getObjects() as FabricObject[]).find(
            (obj) => (obj as FabricObject).data?.id === d.hostId
          );

          if (host) {
            // 🔥🔥🔥 核心修正 1：絕對防禦 🔥🔥🔥
            // 如果 Host 是文字框且正在編輯，直接 return，保留 Proxy 的隱藏狀態
            // 不要執行下面的 o.visible = true，否則會蓋住文字框導致失焦
            if (host.type === "textbox" && (host as fabric.Textbox).isEditing) {
              return;
            }

            // ✅ 正常情況：Proxy 跟隨 Host 的可見度
            const hostVisible = host.visible ?? true;
            o.visible = hostVisible;
            o.evented = hostVisible;
            o.selectable = hostVisible;
          }
        }
      });

      const mouseEvent = e && !("touches" in e) ? (e as MouseEvent) : undefined;
      const isMobile = "ontouchstart" in window;

      // 🔥 手機版：如果已經有選擇，自動啟用多選（等於自動 Shift）
      const hasExistingSelection = externalSelectedIdsRef.current.length > 0;
      const effectiveShiftKey =
        (mouseEvent && mouseEvent.shiftKey) ||
        (isMobile && hasExistingSelection);
      const isShiftMultiSelect = effectiveShiftKey;

      // 🛑 修正衝突點 2：Shift 多選預判邏輯
      (canvas.getObjects() as FabricObject[]).forEach((o) => {
        const d = (o as FabricObject).data;
        if (d?.proxyTag && d?.hostId) {
          // 🔥 修改：如果是 Shift 多選，跳過群組檢查
          if (!isShiftMultiSelect) {
            // 🔥 檢查這個 proxy 是否屬於某個群組
            const belongsToGroup = canvas.getObjects().some((obj) => {
              const objData = (obj as FabricObject).data;
              return (
                objData?.isMultiSelectHandle &&
                Array.isArray(objData?.targetIds) &&
                (objData.targetIds as string[]).includes(d.hostId as string)
              );
            });

            // 🔥 如果屬於群組，不要改它的狀態
            if (belongsToGroup) {
              return;
            }
          }

          const img = (canvas.getObjects() as FabricObject[]).find(
            (obj) =>
              (obj.type === "image" ||
                obj.type === "textbox" ||
                obj.type === "i-text") &&
              (obj as FabricObject).data?.id === d.hostId
          );
          if (img) {
            // 🔥🔥🔥 核心修正 2：這裡也要防禦！ 🔥🔥🔥
            // 之前的版本這裡漏了，導致即使上面擋住了，這裡又把 Proxy 打開
            if (img.type === "textbox" && (img as fabric.Textbox).isEditing) {
               return;
            }

            const imgVisible = img.visible ?? true;
            o.visible = imgVisible;
            o.evented = imgVisible;
            o.selectable = imgVisible;
          }
        }
      });

      const p = canvas.getPointer((opt as unknown as { e: MouseEvent }).e);
      const pt = new fabric.Point(p.x, p.y);
      const target = (opt as unknown as { target?: FabricObject }).target;

      // 🔥 合併模式（已有 handle）
      if (
        target &&
        (target as FabricObject).data?.isMultiSelectHandle &&
        effectiveShiftKey
      ) {
        const allObjects = canvas.getObjects() as FabricObject[];
        const currentTargetIds =
          ((target as FabricObject).data?.targetIds as string[]) || [];

        for (let i = allObjects.length - 1; i >= 0; i--) {
          const obj = allObjects[i];

          if (obj === target) continue;

          const d = (obj as FabricObject).data;
          if (!d?.proxyTag || !d?.hostId) continue;

          // 檢查是否在點擊位置
          if (
            obj.visible &&
            obj.evented &&
            (obj as FabricObject).containsPoint?.(pt)
          ) {
            const clickedId = d.hostId as string;

            // 🔥 如果點到已選中的，記錄下來（等 mouse:up 判斷是否取消）
            if (currentTargetIds.includes(clickedId)) {
              lastClickRef.current = {
                id: clickedId,
                x: pt.x,
                y: pt.y,
                wasSelectedSingle: false,
                isMultiSelectToggle: true,
              };
              break;
            }

            // 點到新圖層 → 加入選擇
            const cb = selectionChangeRef.current;
            if (cb) {
              const newIds = [...currentTargetIds, clickedId];
              cb(newIds);
            }

            if (mouseEvent) {
              mouseEvent.preventDefault();
              mouseEvent.stopPropagation();
            }
            return;
          }
        }
      }

      // 🔥 手機多選模式（已有選擇但還沒有 handle）
      if (
        externalSelectedModeRef.current === "MERGE" &&
        hasExistingSelection &&
        isMobile &&
        !target?.data?.isMultiSelectHandle
      ) {
        const currentIds = externalSelectedIdsRef.current;
        const allObjects = canvas.getObjects() as FabricObject[];

        for (let i = allObjects.length - 1; i >= 0; i--) {
          const obj = allObjects[i];
          const d = (obj as FabricObject).data;

          if (!d?.proxyTag || !d?.hostId) continue;
          if (!obj.visible || !obj.evented) continue;

          // 檢查是否在點擊位置
          if ((obj as FabricObject).containsPoint?.(pt)) {
            const clickedId = d.hostId as string;

            // 🔥 如果點到已選中的，記錄下來（等 mouse:up 判斷是點擊還是拖曳）
            if (currentIds.includes(clickedId)) {
              lastClickRef.current = {
                id: clickedId,
                x: pt.x,
                y: pt.y,
                wasSelectedSingle: false, // 多選模式
                isMultiSelectToggle: true, // 標記為多選切換
              };
              break;
            }

            // 點到新圖層 → 加入選擇
            console.log("🔥 手機多選：加入新圖層", clickedId);
            const cb = selectionChangeRef.current;
            if (cb) {
              const newIds = [...currentIds, clickedId];
              cb(newIds);
            }

            if (mouseEvent) {
              mouseEvent.preventDefault();
              mouseEvent.stopPropagation();
            }
            return;
          }
        }
      }

      console.log("target ", target);

      // 🔥 手機版已選擇時，進入多選模式，不執行單擊邏輯
      if (
        mouseEvent &&
        mouseEvent.button === 0 &&
        !effectiveShiftKey &&
        !brushModeRef.current &&
        !eraserModeRef.current &&
        !mobileFocusRef.current
      ) {
        
        // 🔥🔥🔥 核心修正 3：防止編輯時被當作「取消選取」 🔥🔥🔥
        // 如果目前點擊的目標是「正在編輯的 Textbox」，絕對不要執行「切換選取」邏輯
        // 否則 mouse:up 會執行 discardActiveObject，導致失焦跳回圖層模式
        if (target && target.type === 'textbox' && (target as fabric.Textbox).isEditing) {
           lastClickRef.current = null;
           // 這裡直接 return 讓 Fabric 原生事件繼續跑 (移動游標/雙擊選字)
           return; 
        }
        // 🔥🔥🔥 修正結束 🔥🔥🔥

        // 先預設沒有 click 候選（移到這裡）
        lastClickRef.current = null;

        let clickedId: string | undefined;

        if (target) {
          const imgs = resolveToImageObjects([target], canvas);
          clickedId = imgs[0]?.data?.id as string | undefined;
        }

        const pointer = canvas.getPointer(mouseEvent);
        const selectedIds = externalSelectedIdsRef.current;

        const wasSelectedSingle =
          !!clickedId &&
          selectedIds.length === 1 &&
          selectedIds[0] === clickedId;

        lastClickRef.current = {
          id: clickedId,
          x: pointer.x,
          y: pointer.y,
          wasSelectedSingle,
        };
      }

      // =========================
      // 🔥 處理中：檢查是否點到任何一個 processing proxy
      // =========================
      type ExtCanvasProc = fabric.Canvas & {
        __procProxies?: Map<string, fabric.Group>;
      };
      const extProc = canvas as ExtCanvasProc;
      const procProxies = extProc.__procProxies;

      if (procProxies && procProxies.size > 0) {
        let hitProxy: fabric.Group | null = null;

        procProxies.forEach((proxy) => {
          if (hitProxy) return; // 已經找到了
          const hit =
            typeof (proxy as FabricObject).containsPoint === "function"
              ? (proxy as FabricObject).containsPoint(pt)
              : false;
          if (hit) {
            hitProxy = proxy;
          }
        });

        if (hitProxy) {
          if (mouseEvent) {
            mouseEvent.preventDefault();
            mouseEvent.stopPropagation();
          }

          canvas.setActiveObject(hitProxy);

          const data = (hitProxy as FabricObject).data || {};
          const hitIds = (data.targetIds as string[]) || [];

          const imgs = (canvas.getObjects() as FabricObject[]).filter((o) => {
            if (o.type !== "image" && o.type !== "textbox") return false;
            const id = (o as FabricObject).data?.id as string | undefined;
            return id && hitIds.includes(id);
          }) as fabric.FabricImage[];

          (canvas as Canvas)._currentTransform = null;

          processingDragRef.current = {
            active: true,
            proxy: hitProxy,
            targets: imgs,
            lastPt: pt,
          };

          canvas.requestRenderAll();
          return;
        }
      }

      if (isSpacePressedRef.current) {
        if (brushModeRef.current || eraserModeRef.current) pauseDrawing(canvas);
        (canvas as fabric.Canvas)._currentTransform = null;

        isDraggingRef.current = true;
        safeSetCursor(canvas, "grabbing");
        const spaceE = (opt as unknown as { e: MouseEvent }).e;
        lastPosRef.current = { x: spaceE.clientX, y: spaceE.clientY };
        return;
      }

      if (brushModeRef.current || eraserModeRef.current) {
        if (!activeLayerRef.current) {
          const topObj = getTopObjectAtPointer(canvas, pt);
          if (topObj && topObj.type === "image" && topObj !== bgRef.current) {
            canvas.setActiveObject(topObj);
            updateActiveLayerRefFromCanvas(canvas);
            if (activeLayerRef.current)
              enterLockedBrushLike(canvas, activeLayerRef.current);
          }
          return;
        }
        const locked = activeLayerRef.current!;
        const contains = (
          locked as unknown as { containsPoint?: (p: fabric.Point) => boolean }
        ).containsPoint?.(pt);
        if (!contains) return;

        const { px, py } = canvasPointToImagePixel(locked, pt);
        liveDrawRef.current.active = true;
        liveDrawRef.current.lastPx = px;
        liveDrawRef.current.lastPy = py;

        liveDrawRef.current.strokeCanvas = null;
        return;
      }

      // ==== 🔥 專門處理 processing overlay 的手動拖曳 ====
      const tData = (target as FabricObject)?.data;
      if (target && tData?.isProcessingOverlay) {
        if (mouseEvent) {
          mouseEvent.preventDefault();
          mouseEvent.stopPropagation();
        }

        const anyCanvas = canvas as Canvas;
        anyCanvas._currentTransform = null;

        const ids = (tData.targetIds as string[]) || [];
        const all = canvas.getObjects() as FabricObject[];
        const imgs = all.filter((o) => {
          if (o.type !== "image" && o.type !== "textbox") return false;
          const id = (o as FabricObject).data?.id as string | undefined;
          return id && ids.includes(id);
        }) as fabric.FabricImage[];

        processingDragRef.current = {
          active: true,
          proxy: target,
          targets: imgs,
          lastPt: pt,
        };

        return;
      }

      // 🔥 修正：找可見的 proxy
      const allProxies = (canvas.getObjects() as FabricObject[])
        .filter((o) => {
          const d = (o as FabricObject).data;
          if (!d?.proxyTag || !o.visible || !o.evented || !o.selectable) {
            return false;
          }

          const hostId = d.hostId as string | undefined;
          if (hostId) {
            const img = (canvas.getObjects() as FabricObject[]).find(
              (obj) =>
                obj.type === "image" &&
                (obj as FabricObject).data?.id === hostId
            );
            if (img && !(img.visible ?? true)) {
              return false;
            }
          }

          return true;
        })
        .reverse();

      const clickedProxy = allProxies.find((proxy) => {
        return (proxy as FabricObject).containsPoint?.(pt);
      });

      if (clickedProxy) {
        const transform = (canvas as Canvas)._currentTransform;
        if (transform) {
          return;
        }
      }

      // 🔥 新增：如果點到不可見圖層的 proxy，阻止選擇
      const allObjects = canvas.getObjects() as FabricObject[];
      for (let i = allObjects.length - 1; i >= 0; i--) {
        const o = allObjects[i];
        const d = (o as FabricObject).data;

        if (
          d?.proxyTag &&
          o.evented &&
          o.visible &&
          (o as FabricObject).containsPoint?.(pt)
        ) {
          const hostId = d.hostId as string | undefined;
          if (hostId) {
            const img = allObjects.find(
              (obj) =>
                obj.type === "image" &&
                (obj as FabricObject).data?.id === hostId
            );
            if (img && !(img.visible ?? true)) {
              if (mouseEvent) {
                mouseEvent.preventDefault();
                mouseEvent.stopPropagation();
              }
              canvas.discardActiveObject();
              canvas.requestRenderAll();
              return;
            }
          }
        }
      }

      // 🔥 檢查是否點到控制點
      const activeObj = canvas.getActiveObject();
      let isOnControl = false;
      if (activeObj) {
        const corner = activeObj.__corner;
        if (corner) {
          isOnControl = true;
        }
      }

      const hasInteractiveObject = (canvas.getObjects() as FabricObject[]).some(
        (obj) => {
          const d = obj.data;
          if (
            d?.ui ||
            d?.isArtboard ||
            d?.processingOverlay ||
            obj === bgRef.current
          ) {
            return false;
          }
          if ((obj.selectable || obj.evented) && obj.visible !== false) {
            return obj.containsPoint?.(pt);
          }
          return false;
        }
      );

      // 🔥 如果點到控制點或互動物件，不啟動畫布拖曳
      if (!hasInteractiveObject && !isOnControl) {
        const dragE = (opt as unknown as { e: MouseEvent }).e;
        isDraggingRef.current = true;
        lastPosRef.current = { x: dragE.clientX, y: dragE.clientY };
        safeSetCursor(canvas, "grabbing");
        return;
      }

      // 如果沒點到任何 proxy，才允許拖動畫布
      if (!target && !isOnControl) {
        isDraggingRef.current = true;
        safeSetCursor(canvas, "grabbing");
        const dragE = (opt as unknown as { e: MouseEvent }).e;
        lastPosRef.current = { x: dragE.clientX, y: dragE.clientY };
      }
    });
    let lastDrawTime = 0;
    const DRAW_THROTTLE = 16; // 約 60fps
    canvas.on("mouse:move", async (opt) => {
      const dragState = processingDragRef.current;
      if (isDraggingRef.current && lastPosRef.current) {
        const e = (opt as unknown as { e: MouseEvent | TouchEvent }).e;

        // 🔥 同樣處理 touch 事件
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
        const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

        const dx = clientX - lastPosRef.current.x;
        const dy = clientY - lastPosRef.current.y;

        const vpt = canvas.viewportTransform!.slice() as fabric.TMat2D;
        vpt[4] += dx;
        vpt[5] += dy;
        canvas.setViewportTransform(vpt);
        canvas.requestRenderAll();

        lastPosRef.current = { x: clientX, y: clientY };
        return;
      }
      if (dragState.active && dragState.proxy && dragState.lastPt) {
        const p = canvas.getPointer((opt as fabric.TPointerEventInfo).e);
        const cur = new fabric.Point(p.x, p.y);
        const dx = cur.x - dragState.lastPt.x;
        const dy = cur.y - dragState.lastPt.y;

        if (dx !== 0 || dy !== 0) {
          // 1) 移動 overlay 本身
          const proxy = dragState.proxy;
          const lt = proxy.getPointByOrigin("left", "top");
          proxy.setPositionByOrigin(
            new fabric.Point(lt.x + dx, lt.y + dy),
            "left",
            "top"
          );
          proxy.setCoords();

          // 2) 移動所有目標 image + clipPath + 原本每層的 proxyRect
          dragState.targets.forEach((img) => {
            const imgLt = img.getPointByOrigin("left", "top");
            img.setPositionByOrigin(
              new fabric.Point(imgLt.x + dx, imgLt.y + dy),
              "left",
              "top"
            );
            img.setCoords();

            const cp = img.clipPath as fabric.Rect | undefined;
            if (cp) {
              const cplt = cp.getPointByOrigin("left", "top");
              cp.setPositionByOrigin(
                new fabric.Point(cplt.x + dx, cplt.y + dy),
                "left",
                "top"
              );
              cp.setCoords?.();
            }

            const layerId = (img as FabricImage).data?.id as string | undefined;
            if (layerId) {
              const tag = `__proxy_${layerId}`;
              const pr = (canvas.getObjects() as FabricObject[]).find(
                (o) => (o as FabricObject).data?.proxyTag === tag
              ) as fabric.Rect | undefined;
              if (pr) {
                const prlt = pr.getPointByOrigin("left", "top");
                pr.setPositionByOrigin(
                  new fabric.Point(prlt.x + dx, prlt.y + dy),
                  "left",
                  "top"
                );
                pr.setCoords();

                // 🔥 新增：同步更新 data.frame
                const imgData = (img as FabricImage).data;
                if (imgData?.frame) {
                  imgData.frame = {
                    ...imgData.frame,
                    left: pr.left,
                    top: pr.top,
                  };
                }
              }
            }
          });

          dragState.lastPt = cur;
          canvas.requestRenderAll();
        }
        return; // 🔥 這次 move 完全自己處理
      }

      if (!liveDrawRef.current.active || !activeLayerRef.current) return;

      const now = performance.now();
      if (now - lastDrawTime < DRAW_THROTTLE) return;
      lastDrawTime = now;

      const img = activeLayerRef.current!;
      const p = canvas.getPointer((opt as unknown as { e: MouseEvent }).e);
      const pt = new fabric.Point(p.x, p.y);
      const { px, py, W, H } = canvasPointToImagePixel(img, pt);

      const scaleToPxX = W / ((img.width || 1) * (img.scaleX || 1));
      const scaleToPxY = H / ((img.height || 1) * (img.scaleY || 1));
      const uiSize = eraserModeRef.current
        ? eraserSizeRef.current
        : canvas.freeDrawingBrush?.width || 20;
      const brushPx = uiSize * Math.min(scaleToPxX, scaleToPxY);

      const layerIdMaybe = (img as unknown as { data?: { id?: string } }).data
        ?.id;
      const layerId = typeof layerIdMaybe === "string" ? layerIdMaybe : null;
      if (!layerId) return;

      isLiveCompositeRef.current = true;

      if (eraserModeRef.current) {
        let mask = LAYER_MASK_CANVAS.get(layerId);
        if (!mask) {
          mask = document.createElement("canvas");
          mask.width = W;
          mask.height = H;
          const mctx = mask.getContext("2d")!;
          mctx.fillStyle = "#ffffff";
          mctx.fillRect(0, 0, W, H);
          LAYER_MASK_CANVAS.set(layerId, mask);
        }
        const mctx = mask.getContext("2d")!;
        mctx.save();
        mctx.lineCap = "round";
        mctx.lineJoin = "round";
        mctx.strokeStyle = eraserRestoreRef.current ? "#ffffff" : "#000000";
        mctx.lineWidth = Math.max(2, brushPx);
        mctx.beginPath();
        mctx.moveTo(liveDrawRef.current.lastPx, liveDrawRef.current.lastPy);
        mctx.lineTo(px, py);
        mctx.stroke();
        mctx.restore();

        LAYER_MASK_NONWHITE.add(layerId);

        if (liveDrawRef.current.raf == null) {
          liveDrawRef.current.raf = requestAnimationFrame(() => {
            liveDrawRef.current.raf = null;
            composeToView(layerId);
            img.dirty = true;
            canvas.requestRenderAll();
          });
        }
      } else if (brushModeRef.current) {
        const base = LAYER_BASE_CANVAS.get(layerId);
        if (base) {
          const sctx = base.getContext("2d")!;
          sctx.save();
          sctx.lineCap = "round";
          sctx.lineJoin = "round";
          sctx.strokeStyle = "#3a3a3a";
          sctx.lineWidth = Math.max(1, brushPx);
          sctx.beginPath();
          sctx.moveTo(liveDrawRef.current.lastPx, liveDrawRef.current.lastPy);
          sctx.lineTo(px, py);
          sctx.stroke();
          sctx.restore();

          if (liveDrawRef.current.raf == null) {
            liveDrawRef.current.raf = requestAnimationFrame(() => {
              liveDrawRef.current.raf = null;
              composeToView(layerId);
              img.dirty = true;
              canvas.requestRenderAll();
            });
          }
        }
      }

      liveDrawRef.current.lastPx = px;
      liveDrawRef.current.lastPy = py;
    });

    canvas.on("mouse:up", (opt) => {
      // 🔥 重置筆刷狀態
      liveDrawRef.current.active = false;
      processingDragRef.current.active = false;

      const info = lastClickRef.current;
      lastClickRef.current = null;

      const e = opt.e as MouseEvent | undefined;
      if (!info || !e) return;

      // 只處理左鍵
      if (e.button !== 0) return;

      // 筆刷 / 橡皮擦時不要動選取
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        lastPosRef.current = null;
        safeSetCursor(canvas, "default");
        if (
          isSpacePressedRef.current &&
          (brushModeRef.current || eraserModeRef.current)
        ) {
          resumeDrawingIfNeeded(canvas);
        }
      }

      const pointer = canvas.getPointer(e);
      const dx = pointer.x - info.x;
      const dy = pointer.y - info.y;
      const distSq = dx * dx + dy * dy;

      const CLICK_TOL = 4; // 可調：移動小於 4px 視為 click
      if (distSq > CLICK_TOL * CLICK_TOL) {
        // 有明顯移動 → 當拖拉，不取消
        return;
      }

      // 🔥 多選切換模式（點擊已選中的圖層 → 取消選擇）
      if (info.isMultiSelectToggle && info.id) {
        console.log("🔥 多選切換：取消選擇", info.id);
        const currentIds = externalSelectedIdsRef.current;
        const newIds = currentIds.filter((id) => id !== info.id);

        // 🔥 1. 呼叫 cleanup（如果存在）來正確清理 handle 和 listener
        if (canvas.__multiSelectCleanup) {
          canvas.__multiSelectCleanup();
          console.log("🔥 已執行 cleanup");
        }

        // 🔥 2. 通知外部
        const cb = selectionChangeRef.current;
        cb?.(newIds);

        // 🔥 3. 根據剩餘數量決定
        if (newIds.length === 0) {
          canvas.discardActiveObject();
        } else if (newIds.length === 1) {
          // 剩 1 個：找到對應的 proxy 並選中
          const remainId = newIds[0];
          const proxyTag = `__proxy_${remainId}`;
          const proxy = (canvas.getObjects() as FabricObject[]).find(
            (o) => (o as FabricObject).data?.proxyTag === proxyTag
          );
          if (proxy) {
            canvas.setActiveObject(proxy);
            console.log("🔥 已選中剩餘 proxy:", remainId);
          }
        } else {
          // 剩 >= 2 個：重建 handle
          requestAnimationFrame(() => {
            api.setActiveMultiple(newIds);
          });
        }

        canvas.requestRenderAll();
        return;
      }

      // 🔥 單選模式（第二次點同一顆 → 取消選取）
      if (!info.wasSelectedSingle) return;
      if (e.shiftKey) return; // Shift 模式不取消

      // 先把 Fabric 的內部拖曳/框選狀態清掉，避免「殘影」
      (canvas as Canvas & { __mobileEditMode: boolean })._currentTransform =
        null;
      (
        canvas as Canvas & {
          __mobileEditMode: boolean;
          _groupSelector: boolean | null;
        }
      )._groupSelector = null;

      canvas.discardActiveObject();
      updateActiveLayerRefFromCanvas(canvas);
      canvas.requestRenderAll();

      // 通知外面：現在變成「沒有選取」
      const cb = selectionChangeRef.current;
      cb?.([]);
    });

    const endDrag = () => {
      // 🔥 重置筆刷狀態
      liveDrawRef.current.active = false;
      processingDragRef.current.active = false;

      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      lastPosRef.current = null;
      safeSetCursor(canvas, "default");

      if (
        isSpacePressedRef.current &&
        (brushModeRef.current || eraserModeRef.current)
      ) {
        resumeDrawingIfNeeded(canvas);
      }
      if (brushModeRef.current || eraserModeRef.current) nukeTopOverlay(canvas);
    };
    canvas.on("mouse:out", endDrag);

    const onWinMouseUp = () => {
      if (!isCanvasAlive(canvas)) return;

      // 🔥 重置筆刷狀態
      liveDrawRef.current.active = false;
      processingDragRef.current.active = false;

      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        lastPosRef.current = null;
        safeSetCursor(canvas, "default");
        if (
          isSpacePressedRef.current &&
          (brushModeRef.current || eraserModeRef.current)
        ) {
          resumeDrawingIfNeeded(canvas);
        }
      }

      if (canvas.isDrawingMode) {
        nukeTopOverlay(canvas);
        canvas.requestRenderAll();
      }
    };
    window.addEventListener("mouseup", onWinMouseUp);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isCanvasAlive(canvas)) return;
      // 🔥 複製 (Ctrl+C / Cmd+C)
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        const activeObj = canvas.getActiveObject();
        if (
          activeObj?.type === "textbox" &&
          (activeObj as fabric.Textbox).isEditing
        ) {
          return; // 讓瀏覽器處理文字複製
        }

        e.preventDefault();
        api.copySelectedLayers();
        return;
      }
      // 🔥 複製 (Ctrl+C / Cmd+C)
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        const activeObj = canvas.getActiveObject();
        if (
          activeObj?.type === "textbox" &&
          (activeObj as fabric.Textbox).isEditing
        ) {
          return; // 讓瀏覽器處理文字複製
        }

        e.preventDefault();
        api.copySelectedLayers();
        return;
      }

      // 🔥 貼上 (Ctrl+V / Cmd+V)
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        const activeObj = canvas.getActiveObject();
        if (
          activeObj?.type === "textbox" &&
          (activeObj as fabric.Textbox).isEditing
        ) {
          return; // 讓瀏覽器處理文字貼上
        }

        e.preventDefault();
        api.pasteFromClipboard();
        return;
      }

      // 🔥 複製選中圖層 (Ctrl+D / Cmd+D)
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();

        const activeObj = canvas.getActiveObject();
        if (!activeObj) return;

        // 取得選中的圖層 ID
        let layerId: string | null = null;

        if ((activeObj as FabricObject).data?.proxyTag) {
          layerId = (activeObj as FabricObject).data?.hostId as string;
        } else if (activeObj.type === "image") {
          layerId = (activeObj as FabricObject).data?.id as string;
        }

        if (layerId && layerId !== "__background__") {
          api.duplicateLayer(layerId);
        }
        return;
      }
      if (
        e.key === "Escape" &&
        (brushModeRef.current || eraserModeRef.current)
      ) {
        exitAllDraw(canvas, true);
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!isSpacePressedRef.current) {
          isSpacePressedRef.current = true;
          safeSetCursor(canvas, "grab");
          if (brushModeRef.current || eraserModeRef.current) {
            pauseDrawing(canvas);
          }
        }
        return;
      }
      if (brushModeRef.current || eraserModeRef.current) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        resetView(canvas);
        zoomChangeRef.current?.(100);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!isCanvasAlive(canvas)) return;
      if (e.code === "Space") {
        isSpacePressedRef.current = false;
        safeSetCursor(canvas, "default");
        if (brushModeRef.current || eraserModeRef.current) {
          resumeDrawingIfNeeded(canvas);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // 🔥 這裡開始是 ResizeObserver 的部分
    const hostElement = hostRef.current;
    if (!hostElement) return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr || cr.width < 1 || cr.height < 1) return;
      const cnv = canvasRef.current;
      if (!cnv) return;
      const cnvEl = (
        cnv as unknown as { getElement?: () => HTMLCanvasElement }
      ).getElement?.();
      if (!cnvEl) return;
      if (!hostElement.isConnected) return;

      const w = Math.max(100, Math.floor(cr.width));
      const h = Math.max(100, Math.floor(cr.height));
      if (cnvEl.width === w && cnvEl.height === h) return;

      try {
        console.log(`ResizeObserver triggered: ${w}x${h}`);
        cnv.setDimensions({ width: w, height: h });
        setViewport({ w, h });
        updateArtboardPosition(cnv);
        cnv.requestRenderAll();
      } catch (err) {
        console.error("Canvas resize failed:", err);
      }
    });

    hostElement.setAttribute("data-fabric-host", "1");
    ro.observe(hostElement);

    return () => {
      try {
        ro.unobserve(hostElement);
      } catch {}
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mouseup", onWinMouseUp);
      isSpacePressedRef.current = false;

      canvas.off();
    };
  };

  useEffect(() => {
    const localHost = hostRef.current;
    if (!localHost) return;

    const el = document.createElement("canvas");
    el.style.position = "absolute";
    el.style.inset = "0";
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.display = "block";
    el.style.backgroundColor = "transparent";
    el.style.willChange = "transform";

    // 🔥 強制設定 touch-action
    el.style.touchAction = "none";

    localHost.style.position = "relative";
    localHost.style.isolation = "isolate";

    // 🔥 確保 host 有明確的尺寸
    localHost.style.width = "100%";
    localHost.style.height = "100%";

    localHost.appendChild(el);

    const canvas = new fabric.Canvas(el, {
      selection: true,
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      stopContextMenu: true,
      isDrawingMode: false,
      // 🔥 移動端關鍵設定
      allowTouchScrolling: false,
      enablePointerEvents: true,
      renderOnAddRemove: false, // 🔥 手動控制渲染
      skipTargetFind: false, // 🔥 繪圖時可以設為 true
    });

    canvasRef.current = canvas;
    const preventTouchSelection = (e: TouchEvent) => {
      if (touchStartPoint || isPinching) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 🔥 修正：先獲取實際尺寸
    const getActualSize = () => {
      const rect = localHost.getBoundingClientRect();
      const w = Math.max(100, Math.floor(rect.width || window.innerWidth));
      const h = Math.max(
        100,
        Math.floor(rect.height || window.innerHeight - 200)
      );
      return { w, h };
    };

    const { w: w0, h: h0 } = getActualSize();

    // 🔥 立即設定尺寸
    canvas.setWidth(w0);
    canvas.setHeight(h0);
    el.width = w0;
    el.height = h0;

    console.log(`Canvas initialized: ${w0}x${h0}`);

    FabricObject.prototype.transparentCorners = true;
    FabricObject.prototype.cornerStyle = "circle";
    FabricObject.prototype.cornerColor = "#ffffff";
    FabricObject.prototype.cornerStrokeColor = "#6b46c1";
    FabricObject.prototype.borderColor = "#6b46c1";
    FabricObject.prototype.cornerSize = 15; // 🔥 10 * 1.5 = 15

    // 🔥 手機端：加大熱區
    const isMobile = "ontouchstart" in window;
    if (isMobile) {
      FabricObject.prototype.touchCornerSize = 25; // 🔥 50 * 1.5 = 75
      FabricObject.prototype.borderScaleFactor = 2;
    }

    (
      FabricObject.prototype as unknown as { rotatingPointOffset?: number }
    ).rotatingPointOffset = 24;

    const brush = new fabric.PencilBrush(canvas);
    brush.color = "rgba(58,58,58,0)";
    brush.width = 20;
    canvas.freeDrawingBrush = brush;

    const pencil = canvas.freeDrawingBrush as fabric.PencilBrush;
    const origDown = pencil.onMouseDown.bind(pencil);
    (
      pencil as unknown as { onMouseDown: typeof pencil.onMouseDown }
    ).onMouseDown = (pointer, opt) => {
      if (isSpacePressedRef.current) return;

      if (
        (brushModeRef.current || eraserModeRef.current) &&
        !activeLayerRef.current
      ) {
        return;
      }
      if (
        (brushModeRef.current || eraserModeRef.current) &&
        activeLayerRef.current
      ) {
        const p = canvas.getPointer((opt as unknown as { e: MouseEvent }).e);
        const pt = new fabric.Point(p.x, p.y);
        const locked = activeLayerRef.current!;
        const hitLocked = (
          locked as unknown as { containsPoint?: (p: fabric.Point) => boolean }
        ).containsPoint?.(pt);
        if (!hitLocked) return;
      }
      origDown(pointer, opt);
    };

    attachFabricListeners(canvas);

    createArtboard(canvas, artboardSize.width, artboardSize.height);

    // ============================================
    // 🔥 手機觸控手勢支援（完整版）
    // ============================================
    let touchStartDist = 0;
    let touchStartZoom = 1;
    let touchStartCenter: { x: number; y: number } | null = null;
    let isPinching = false;
    let touchStartPoint: { x: number; y: number } | null = null;
    let lastTapTime = 0;
    let isDraggingCanvas = false;

    const getTouchDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (touches: TouchList) => {
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      };
    };

    // 1. 移除 onTouchStart 中的重複邏輯（約 line 2890-2950）
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();

        // 🔥 關鍵：重置拖曳狀態
        isDraggingRef.current = false;
        lastPosRef.current = null;

        isPinching = true;
        touchStartDist = getTouchDistance(e.touches);
        touchStartZoom = canvas.getZoom();
        touchStartCenter = getTouchCenter(e.touches);
        touchStartPoint = null;
        isDraggingCanvas = false;
        if (brushModeRef.current || eraserModeRef.current) {
          pauseDrawing(canvas);
        }
        return;
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();

        // 雙擊重置
        if (now - lastTapTime < 300) {
          // 🔥 檢查是否點到任何可互動物件（proxy、控制點等）
          const pointer = canvas.getPointer(
            e as unknown as fabric.TPointerEvent
          );
          const point = new fabric.Point(pointer.x, pointer.y);

          const hasInteractiveObject = (
            canvas.getObjects() as FabricObject[]
          ).some((obj) => {
            const d = obj.data;
            if (
              d?.ui ||
              d?.isArtboard ||
              d?.processingOverlay ||
              obj === bgRef.current
            ) {
              return false;
            }
            if ((obj.selectable || obj.evented) && obj.visible !== false) {
              return obj.containsPoint?.(point);
            }
            return false;
          });

          if (!hasInteractiveObject) {
            // 🔥 沒點到互動物件，才執行放大
            e.preventDefault();
            api.recenterView(1);
            zoomChangeRef.current?.(100);
          }

          lastTapTime = 0;
          return;
        }
        lastTapTime = now;

        // 🔥 關鍵：先讓 Fabric 判斷是否點到控制點
        const isMobileEditMode =
          (canvas as Canvas & { __mobileEditMode: boolean })
            .__mobileEditMode === true;

        if (
          isMobileEditMode &&
          !(brushModeRef.current || eraserModeRef.current)
        ) {
          // 🔥 使用 Fabric 內建方法檢測點擊目標
          const pointer = canvas.getPointer(
            e as unknown as fabric.TPointerEvent
          );

          // 🔥 檢查當前選中物件是否正在進行變換（拖曳/縮放/旋轉）
          const transform = canvas._currentTransform;
          if (transform) {
            // 正在變換，不啟動畫布拖曳
            return;
          }

          // 🔥 檢查是否點到控制點
          const activeObj = canvas.getActiveObject();
          if (activeObj) {
            const corner = activeObj.__corner;
            if (corner) {
              // 點到控制點，不啟動畫布拖曳
              return;
            }
          }

          const point = new fabric.Point(pointer.x, pointer.y);
          const target = getTopObjectAtPointer(canvas, point);

          const isTextLayer = target?.type === "textbox" && target.data?.isText;
          const isEditingThisText = isMobileEditMode && isTextLayer; // 🔥 正在編輯這個文字

          const isSelectableObject =
            target &&
            target !== bgRef.current &&
            target !== artboardRef.current &&
            !isEditingThisText && // 🔥 如果是正在編輯的文字，視為不可選
            target.selectable !== false &&
            target.evented !== false;

          // 只有點擊空白處才啟動畫布拖曳
          if (!isSelectableObject) {
            touchStartPoint = { x: touch.clientX, y: touch.clientY };
            isDraggingCanvas = false;
          }

          return;
        } else {
          // 🔥 非 mobile editing mode 的統一處理
          const pointer = canvas.getPointer(
            e as unknown as fabric.TPointerEvent
          );
          const point = new fabric.Point(pointer.x, pointer.y);
          const target = getTopObjectAtPointer(canvas, point);

          const isSelectableObject =
            target &&
            target !== bgRef.current &&
            target !== artboardRef.current &&
            target.selectable !== false &&
            target.evented !== false;

          if (!isSelectableObject && !canvas.isDrawingMode) {
            touchStartPoint = { x: touch.clientX, y: touch.clientY };
            isDraggingCanvas = false;
            if (brushModeRef.current || eraserModeRef.current) {
              pauseDrawing(canvas);
            }
          }
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();

        const currentDist = getTouchDistance(e.touches);
        const scale = currentDist / touchStartDist;
        const newZoom = Math.min(4, Math.max(0.25, touchStartZoom * scale));

        if (touchStartCenter) {
          const point = new fabric.Point(
            touchStartCenter.x,
            touchStartCenter.y
          );
          canvas.zoomToPoint(point, newZoom);
          zoomChangeRef.current?.(Math.round(newZoom * 100));
          canvas.requestRenderAll();
        }

        return;
      }

      // 🔥 檢查是否正在操作控制點
      const transform = canvas._currentTransform;
      if (transform) {
        // 正在縮放/旋轉，不處理畫布拖曳
        touchStartPoint = null;
        isDraggingCanvas = false;
        return;
      }

      // 單指拖曳
      if (touchStartPoint && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartPoint.x;
        const dy = touch.clientY - touchStartPoint.y;

        const DRAG_THRESHOLD = 10;

        if (!isDraggingCanvas) {
          if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            isDraggingCanvas = true;
            canvas.selection = false;
            e.preventDefault();
            e.stopPropagation();
            (canvas as fabric.Canvas)._currentTransform = null;
            touchStartPoint = {
              x: touch.clientX,
              y: touch.clientY,
            };
            return;
          } else {
            return;
          }
        }

        if (isDraggingCanvas) {
          e.preventDefault();
          e.stopPropagation();

          const vpt = canvas.viewportTransform!.slice() as fabric.TMat2D;
          vpt[4] += dx;
          vpt[5] += dy;
          canvas.setViewportTransform(vpt);
          canvas.requestRenderAll();

          touchStartPoint = {
            x: touch.clientX,
            y: touch.clientY,
          };
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      // 🔥 重置筆刷狀態
      liveDrawRef.current.active = false;
      processingDragRef.current.active = false;

      // 重置所有手勢狀態
      if (e.touches.length === 0) {
        isPinching = false;
        touchStartCenter = null;

        // 🔥 拖曳結束後恢復選取
        if (touchStartPoint || isDraggingCanvas) {
          canvas.selection = true;
        }

        touchStartPoint = null;
        isDraggingCanvas = false;

        // 恢復繪圖模式
        if (brushModeRef.current || eraserModeRef.current) {
          resumeDrawingIfNeeded(canvas);
        }
      }

      // 從雙指變單指
      if (e.touches.length === 1 && isPinching) {
        isPinching = false;
        touchStartCenter = null;
        touchStartPoint = null;
        isDraggingCanvas = false;
        canvas.selection = true;
      }
    };

    const upper = canvas.upperCanvasEl;
    if (upper) {
      upper.addEventListener("touchstart", onTouchStart, { passive: false });
      upper.addEventListener("touchmove", onTouchMove, { passive: false });
      upper.addEventListener("touchend", onTouchEnd);
      upper.addEventListener("touchcancel", onTouchEnd);
      upper.addEventListener("touchstart", preventTouchSelection, {
        passive: false,
      });
    }

    // 原有的加載快照邏輯
    (async () => {
      try {
        const snap = (await loadSnapshotJSON(projectId)) as HistoryState;
        if (snap && canvas) {
          await hydrateSnapshotDataURLs(projectId, snap);
          await applySnapshot(canvas, snap);
          historyRef.current = [snap];
          historyIndexRef.current = 0;
          baselinePushedRef.current = true;
        } else {
          pushBaseline(canvas);
        }
      } catch (e) {
        console.error("load snapshot failed", e);
        pushBaseline(canvas);
      }
    })();

    // 🔥 延遲一幀後再次確認尺寸
    requestAnimationFrame(() => {
      const { w, h } = getActualSize();
      if (canvas.getWidth() !== w || canvas.getHeight() !== h) {
        console.log(`Canvas resized on next frame: ${w}x${h}`);

        canvas.width = w;
        canvas.height = h;
        setViewport({ w, h });
        canvas.requestRenderAll();
      }
    });

    // ============================================
    // 🔥 cleanup 時移除所有監聽
    // ============================================
    return () => {
      if (upper) {
        upper.removeEventListener("touchstart", onTouchStart);
        upper.removeEventListener("touchmove", onTouchMove);
        upper.removeEventListener("touchend", onTouchEnd);
        upper.removeEventListener("touchcancel", onTouchEnd);
        upper.removeEventListener("touchstart", preventTouchSelection); // 🔥 新增
      }

      canvas.dispose();
      canvasRef.current = null;
      localHost?.removeChild(el);
    };
  }, [projectId]);

  const [bgVisible, setBgVisible] = useState(true);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    (async () => {
      if (!initialBackgroundUrl) {
        if (bgRef.current) {
          canvas.remove(bgRef.current);
          bgRef.current = null;
          canvas.requestRenderAll();
          saveToHistory(canvas);
        }
        return;
      }

      const opts = !isBlobUrl(initialBackgroundUrl)
        ? ({ crossOrigin: "anonymous" as const } as const)
        : undefined;
      const img = await fabric.FabricImage.fromURL(initialBackgroundUrl, opts);

      if (bgRef.current) canvas.remove(bgRef.current);

      img.selectable = false;
      img.evented = false;
      img.hoverCursor = "default";
      img.excludeFromExport = false;
      img.visible = bgVisible;
      (img as unknown as { data?: { id?: string } }).data = {
        id: "__background__",
      };

      img.objectCaching = true;
      (img as unknown as { noScaleCache?: boolean }).noScaleCache = false;

      fitImageIntoCanvas(img, canvas);
      canvas.add(img);

      canvas.sendObjectToBack(img);
      bgRef.current = img;

      requestAnimationFrame(() => {
        canvas.requestRenderAll();
        pushBaseline(canvas);
        saveToHistory(canvas);
      });
    })();
  }, [initialBackgroundUrl, bgVisible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const bg = bgRef.current as fabric.FabricImage | null;
    if (!canvas) return;

    updateArtboardPosition(canvas);

    if (bg) {
      fitImageIntoCanvas(bg, canvas);
      canvas.sendObjectToBack(bg);
    }

    if (artboardRef.current) {
      canvas.sendObjectToBack(artboardRef.current);
      if (bg) canvas.sendObjectToBack(bg);
    }

    canvas.requestRenderAll();
  }, [viewport, updateArtboardPosition]);

  const getObjectsNoBgImagesOnly = () => {
    const canvas = canvasRef.current!;
    return (canvas.getObjects() as FabricObject[]).filter((o) => {
      if (o === bgRef.current) return false;
      if (o === artboardRef.current) return false;

      // 🔥 修改：同時接受 image 和 textbox
      const isImageLayer = o.type === "image";
      const isTextLayer = o.type === "textbox" || o.type === "textbox";

      if (!isImageLayer && !isTextLayer) return false;

      const d = (
        o as unknown as {
          data?: { ui?: boolean; pendingFlag?: string; id?: string };
        }
      ).data;
      if (d?.ui === true || d?.pendingFlag) return false;
      if (d?.id === "__background__") return false;
      return true;
    });
  };
  const syncProxyToImage = (
    canvas: fabric.Canvas,
    layerId: string,
    img: fabric.FabricImage
  ) => {
    const proxyTag = `__proxy_${layerId}`;
    const proxy = (canvas.getObjects() as FabricObject[]).find(
      (o) => (o as FabricObject).data?.proxyTag === proxyTag
    ) as fabric.Rect | undefined;
  
    if (proxy) {
      proxy.set({
        left: img.left,
        top: img.top,
        width: (img.width ?? 1) * (img.scaleX ?? 1),
        height: (img.height ?? 1) * (img.scaleY ?? 1),
        angle: img.angle ?? 0,
        scaleX: 1,
        scaleY: 1,
      });
      proxy.setCoords();
    }
  };
  const api = useMemo<FabricEditorHandle>(() => {
    const thumbOf = async (img: fabric.FabricImage) => {
      const edge = 64;
      const iw = Math.max(1, Math.round(img.width || 1));
      const ih = Math.max(1, Math.round(img.height || 1));
      const s = Math.min(edge / iw, edge / ih, 1);
      const w = Math.max(1, Math.round(iw * s));
      const h = Math.max(1, Math.round(ih * s));
      const el = img.getElement() as HTMLCanvasElement | HTMLImageElement;
      const ctx = getOffscreenCtx(w, h);
      if (!ctx || !__offscreen) return "";
      __offscreen.width = w;
      __offscreen.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(el, 0, 0, w, h);
      return __offscreen.toDataURL("image/png");
    };

    /**
     * 進入文字編輯模式
     */
    function enterTextEditingMode(
      canvas: fabric.Canvas,
      textObj: fabric.Textbox,
      proxy: fabric.Rect,
      clickPosition?: { x: number; y: number }
    ) {
      // 隱藏 proxy
      proxy.visible = false;
      proxy.evented = false;
      proxy.selectable = false;

      // 顯示並啟用文字編輯
      textObj.selectable = true;
      textObj.evented = true;
      textObj.editable = true;
      textObj.hasControls = true;
      textObj.hasBorders = true;

      canvas.setActiveObject(textObj);
      textObj.enterEditing();

      // 🔥 如果有點擊位置，計算游標應該在哪個字符
      if (clickPosition) {
        // 使用 Fabric 內建方法取得點擊位置對應的字符索引
        const cursorIndex =
          textObj.getSelectionStartFromPointer?.(
            clickPosition as TPointerEvent
          ) ?? 0;
        textObj.setSelectionStart(cursorIndex);
        textObj.setSelectionEnd(cursorIndex);
      } else {
        // 沒有點擊位置才全選
        textObj.selectAll();
      }

      canvas.requestRenderAll();
    }
    /**
     * 退出文字編輯模式
     * 修正了：
     * 1. 移除 textObj.exitEditing()，解決 RangeError: Maximum call stack size exceeded 的無限遞迴問題。
     * 2. 執行 initDimensions() 和 scaleX: 1，解決紫色匡尺寸異常的問題。
     */
    function exitTextEditingMode(
      canvas: fabric.Canvas,
      textObj: fabric.Textbox,
      proxy: fabric.Rect
    ) {
      // 1. ⭐️ 解決 RangeError:
      //    移除 textObj.exitEditing()。
      //    假設此函數是從 'editing:exited' 事件或外部（例如點擊畫布）調用。
      //    如果 textObj.isEditing 仍為 true，您可能需要在調用此函數的地方確保它被 exitEditing。

      // 2. ⭐️ K E Y F I X 1 (尺寸同步)：
      //    強制重新計算尺寸，確保讀取到文字圖層最新的寬高
      textObj.initDimensions();

      // 3. 取得 Textbox 縮放後的精確尺寸
      const newWidth = textObj.getScaledWidth();
      const newHeight = textObj.getScaledHeight();

      // 🔥 更新 proxy 尺寸和位置（同步文字的變換）
      proxy.set({
        // 保持位置、角度與 Textbox 完全一致
        left: textObj.left,
        top: textObj.top,
        angle: textObj.angle || 0,

        // 4. 設定 width/height 為 Textbox 的實際尺寸
        width: newWidth,
        height: newHeight,

        // 5. ⭐️ K E Y F I X 2 (避免重複縮放)：
        //    將 Proxy Rect 自身的 scale 設為 1，避免與 width/height 裡的縮放因子重複計算
        scaleX: 1,
        scaleY: 1,
      });

      // 必須呼叫 setCoords 重新計算 Proxy 的控制點位置
      proxy.setCoords();

      // 隱藏文字的編輯能力，顯示 proxy
      textObj.selectable = false;
      textObj.evented = false;
      textObj.editable = false;
      textObj.hasControls = false;
      textObj.hasBorders = false;

      proxy.visible = true;
      proxy.evented = true;
      proxy.selectable = true;

      canvas.setActiveObject(proxy);
      canvas.requestRenderAll();
    }

    return {
      addImageLayer: async (url: string, name?: string) => {
        const canvas = canvasRef.current!;
        const opts = !isBlobUrl(url)
          ? ({ crossOrigin: "anonymous" as const } as const)
          : undefined;

        const srcImg = await fabric.FabricImage.fromURL(url, opts);
        const maxW = canvas.getWidth()! * 0.8;
        const maxH = canvas.getHeight()! * 0.8;
        const s = Math.min(
          maxW / (srcImg.width || 1),
          maxH / (srcImg.height || 1),
          1
        );
        srcImg.scale(s);

        const baseEl = await loadImage(url);
        const w = baseEl.naturalWidth || baseEl.width;
        const h = baseEl.naturalHeight || baseEl.height;

        const baseC = document.createElement("canvas");
        baseC.width = w;
        baseC.height = h;
        baseC.getContext("2d")!.drawImage(baseEl, 0, 0);

        const id = genId();
        LAYER_BASE_CANVAS.set(id, baseC);

        // 🔥 關鍵：保存乾淨的原始圖（此時還沒有筆刷）
        LAYER_CLEAN_BASE.set(id, baseC.toDataURL("image/png"));

        const maskC = document.createElement("canvas");
        maskC.width = w;
        maskC.height = h;
        const mctx = maskC.getContext("2d")!;
        mctx.fillStyle = "#ffffff";
        mctx.fillRect(0, 0, w, h);

        const viewC = document.createElement("canvas");
        viewC.width = w;
        viewC.height = h;

        LAYER_BASE_CANVAS.set(id, baseC);
        LAYER_MASK_CANVAS.set(id, maskC);
        LAYER_VIEW_CANVAS.set(id, viewC);
        LAYER_BASE_PIXEL.set(id, baseC.toDataURL("image/png"));
        LAYER_IMG_CACHE.set(id, baseC.toDataURL("image/png"));

        composeToView(id);

        const img = new fabric.FabricImage(viewC);
        img.set({
          left: canvas.getWidth()! / 2,
          top: canvas.getHeight()! / 2,
          originX: "center",
          originY: "center",
          scaleX: srcImg.scaleX,
          scaleY: srcImg.scaleY,
        });
        const origin = baseC.toDataURL("image/png");
        const t = await thumbOf(img);
        (img as unknown as { data?: Record<string, unknown> }).data = {
          id,
          name: name ?? "Layer",
          thumb: t,
          originBase: origin,
          isPending: false,
          type: "image",
        };

        img.objectCaching = true;
        (img as unknown as { noScaleCache?: boolean }).noScaleCache = false;
        img.setControlsVisibility({ mtr: true });
        (img as unknown as { lockScalingFlip?: boolean }).lockScalingFlip =
          true;
        img.hasControls = true;
        img.hasBorders = true;

        canvas.add(img);
        const proxy = api.ensureProxyRect(canvas, img);

        const imgIndex = canvas.getObjects().indexOf(img);
        const proxyIndex = canvas.getObjects().indexOf(proxy);
        if (imgIndex !== -1 && proxyIndex !== imgIndex + 1) {
          canvas.remove(proxy);
          canvas.insertAt(imgIndex + 1, proxy);
        }

        canvas.setActiveObject(img);
        activeLayerRef.current = img;

        requestAnimationFrame(() => {
          canvas.requestRenderAll();
          saveToHistory(canvas);
        });

        LAYER_HAS_BRUSH.delete(id);
        LAYER_MASK_NONWHITE.delete(id);

        if (brushArmedRef.current && activeLayerRef.current) {
          enterLockedBrushLike(canvas, activeLayerRef.current);
        }
        if (eraserModeRef.current && activeLayerRef.current) {
          enterLockedBrushLike(canvas, activeLayerRef.current);
        }

        return { id };
      },
      /**
       * 為文字建立 proxy rect
       */
      ensureTextProxyRect(
        canvas: fabric.Canvas,
        textObj: fabric.Textbox
      ): fabric.Rect {
        const id = textObj.data?.id || "__noid__";
        const proxyTag = `__proxy_${id}`;

        const existing = canvas
          .getObjects()
          .find((o) => o.data?.proxyTag === proxyTag);
        if (existing) {
          return existing as fabric.Rect;
        }

        textObj.set({ splitByGrapheme: true });

        const currentScale = textObj.scaleX || 1;
        const textWidth = (textObj.width || 100) * currentScale;
        const textHeight = (textObj.height || 50) * currentScale;

        const rect = new fabric.Rect({
          left: textObj.left,
          top: textObj.top,
          originX: "center",
          originY: "center",
          width: textWidth,
          height: textHeight,
          scaleX: 1,
          scaleY: 1,
          angle: textObj.angle || 0,
          fill: "rgba(0,0,0,0)",
          stroke: "#8b5cf6",
          strokeWidth: 1,
          strokeDashArray: [6, 4],
          selectable: true,
          evented: true,
          hasBorders: true,
          hasControls: true,
          objectCaching: false,
          excludeFromExport: true,
          lockScalingFlip: true,
          lockUniScaling: false,
        });

        rect.data = {
          ui: true,
          proxyTag,
          hostId: id,
          baseTextWidth: textObj.width,
          baseTextScale: currentScale,
          type: "textbox",
        };

        const isMobile = "ontouchstart" in window;
        rect.setControlsVisibility({
          tl: true,
          tr: true,
          bl: true,
          br: true,
          ml: true,
          mr: true,
          mt: false,
          mb: false,
          mtr: true,
        });

        // 🔥 統一樣式
        rect.cornerSize = isMobile ? 15 : 10;
        rect.touchCornerSize = isMobile ? 75 : 20;
        rect.cornerStrokeColor = "#6b46c1";
        rect.borderColor = "#6b46c1";
        rect.cornerStyle = "circle";
        rect.transparentCorners = false;
        rect.cornerColor = "#ffffff";
        rect.borderScaleFactor = isMobile ? 2 : 1.5;

        // 🔥 用閉包變數追蹤 activeCorner
        let activeCorner: string | null = null;

        // 🔥 覆寫 render - 直接讀閉包變數
        Object.keys(rect.controls).forEach((controlName) => {
          const control = rect.controls[controlName];
          if (!control?.render) return;
          const originalRender = control.render.bind(control);

          control.render = function (
            ctx: CanvasRenderingContext2D,
            left: number,
            top: number,
            styleOverride: ControlRenderingStyleOverride | undefined,
            fabricObject: FabricObject
          ) {
            // 🔥 用 override 來控制顏色，不再動 obj.cornerColor
            const override: ControlRenderingStyleOverride = {
              ...(styleOverride || {}),
              transparentCorners: false,
              cornerColor: controlName === activeCorner ? "#6b46c1" : "#ffffff", // 紫 or 白
            };

            originalRender(ctx, left, top, override, fabricObject);
          };
        });

        // 🔥 用 canvas 層級的 mouse:down 事件
        const onCanvasMouseDown = (opt: fabric.CanvasEvents["mouse:down"]) => {
          if (opt.target !== rect) return;

          // 延遲一個 tick 讓 _currentTransform 建立
          setTimeout(() => {
            const transform = canvas._currentTransform;
            console.log("🔍 transform:", transform);
            console.log("🔍 corner:", transform?.corner);
            if (transform?.corner) {
              activeCorner = transform.corner;
              canvas.requestRenderAll();
            }
          }, 0);
        };

        const onCanvasMouseUp = () => {
          if (activeCorner) {
            activeCorner = null;
            canvas.requestRenderAll();
          }
        };

        canvas.on("mouse:down", onCanvasMouseDown);
        canvas.on("mouse:up", onCanvasMouseUp);

        // 🔥 記錄事件以便清理
        rect.__cleanupEvents = () => {
          canvas.off("mouse:down", onCanvasMouseDown);
          canvas.off("mouse:up", onCanvasMouseUp);
        };

        rect.on("moving", () => {
          textObj.set({ left: rect.left, top: rect.top });
          textObj.setCoords();
          canvas.requestRenderAll();
        });

        rect.on("rotating", () => {
          textObj.set({ angle: rect.angle });
          textObj.setCoords();
          canvas.requestRenderAll();
        });

        rect.on("scaling", () => {
          const corner = activeCorner;
          const rectData = rect.data;

          const currentProxyWidth = rect.width || textWidth;
          const currentProxyHeight = rect.height || textHeight;
          const scaledWidth = currentProxyWidth * (rect.scaleX || 1);
          const scaledHeight = currentProxyHeight * (rect.scaleY || 1);

          rect.set({
            width: scaledWidth,
            height: scaledHeight,
            scaleX: 1,
            scaleY: 1,
          });
          rect.setCoords();

          const isCorner =
            corner === "tl" ||
            corner === "tr" ||
            corner === "bl" ||
            corner === "br";
          const isLeftRight = corner === "ml" || corner === "mr";

          if (isCorner && rectData) {
            const baseScale = (rectData.baseTextScale || 1 ) as number;
            const baseWidth = (rectData.baseTextWidth || textObj.width || 100) as number;
            const scaleRatioX = scaledWidth / (baseWidth * baseScale);
            const scaleRatioY =
              scaledHeight / ((textObj.height || 50) * baseScale);
            const uniformScale = Math.max(scaleRatioX, scaleRatioY);
            const newScale = baseScale * uniformScale;

            textObj.set({
              left: rect.left,
              top: rect.top,
              scaleX: newScale,
              scaleY: newScale,
            });
            textObj.setCoords();
          } else if (isLeftRight) {
            const currentTextScale = textObj.scaleX || 1;
            const newTextWidth = scaledWidth / currentTextScale;

            textObj.set({
              left: rect.left,
              top: rect.top,
              width: newTextWidth,
            });
            textObj.initDimensions();

            const newTextHeight = (textObj.height || 50) * currentTextScale;
            rect.set({ height: newTextHeight });
            textObj.setCoords();
            rect.setCoords();
          } else {
            textObj.set({ left: rect.left, top: rect.top });
            textObj.setCoords();
          }

          canvas.requestRenderAll();
        });

        rect.on("modified", () => {
          activeCorner = null;

          const scaledWidth = (rect.width || textWidth) * (rect.scaleX || 1);
          const scaledHeight = (rect.height || textHeight) * (rect.scaleY || 1);
          rect.set({
            width: scaledWidth,
            height: scaledHeight,
            scaleX: 1,
            scaleY: 1,
          });
          rect.setCoords();

          const rectData = rect.data;
          if (rectData) {
            rectData.baseTextWidth = textObj.width;
            rectData.baseTextScale = textObj.scaleX || 1;
          }
          canvas.requestRenderAll();
        });

        rect.on("mousedblclick", (e: fabric.TPointerEventInfo) => {
          const pointer = canvas.getPointer(e.e);
          enterTextEditingMode(canvas, textObj, rect, pointer);
        });

        if (isMobile) {
          let lastTapTime = 0;
          let tapCount = 0;

          rect.on("mousedown", (e: fabric.TPointerEventInfo) => {
            const now = Date.now();
            if (now - lastTapTime < 300) {
              tapCount++;
              if (tapCount === 1) {
                e.e?.preventDefault();
                e.e?.stopPropagation();
                const pointer = canvas.getPointer(e.e);
                enterTextEditingMode(canvas, textObj, rect, pointer);
                tapCount = 0;
              }
            } else {
              tapCount = 0;
            }
            lastTapTime = now;
          });
        }

        textObj.on("editing:exited", () => {
          exitTextEditingMode(canvas, textObj, rect);
        });

        textObj.on("changed", () => {
          if (!textObj.isEditing) {
            const currentScale = textObj.scaleX || 1;
            const newWidth = (textObj.width || 100) * currentScale;
            const newHeight = (textObj.height || 50) * currentScale;
            rect.set({ width: newWidth, height: newHeight });
            rect.setCoords();
            canvas.requestRenderAll();
          }
        });

        textObj.selectable = false;
        textObj.evented = false;
        textObj.editable = false;

        canvas.add(rect);

        const textIndex = canvas.getObjects().indexOf(textObj);
        if (textIndex !== -1) {
          canvas.remove(rect);
          canvas.insertAt(textIndex + 1, rect );
        }

        canvas.requestRenderAll();
        return rect;
      },

      /**
       * Proxy：邊控點 handler
       */
      ensureProxyRect(
        canvas: fabric.Canvas,
        img: fabric.FabricImage
      ): fabric.Rect {
        const cnv = (img.canvas ?? canvas)!;
        const id = (img as FabricImage).data?.id || "__noid__";
        const proxyTag = `__proxy_${id}`;

        const existing = (cnv.getObjects() as FabricObject[]).find(
          (o) => (o as FabricObject).data?.proxyTag === proxyTag
        ) as fabric.Rect | undefined;

        if (existing) {
          return existing;
        }

        const el = img.getElement() as HTMLCanvasElement | HTMLImageElement;
        const naturalW =
          el instanceof HTMLCanvasElement
            ? el.width
            : el.naturalWidth || img.width || 1;
        const naturalH =
          el instanceof HTMLCanvasElement
            ? el.height
            : el.naturalHeight || img.height || 1;

        // 🔴 刪除或註解掉原本「強制使用全圖尺寸」的邏輯
        // const worldW = naturalW * (img.scaleX || 1);
        // const worldH = naturalH * (img.scaleY || 1);

        // 🟢 新增：優先使用 clipPath (裁切框) 的資訊，如果沒有才用原圖尺寸
        // 這樣在 Paste 時，Proxy 就會直接長成裁切後的大小，syncFunc 就不會把遮罩撐大
        let targetLeft = img.left;
        let targetTop = img.top;
        let targetW = naturalW * (img.scaleX || 1);
        let targetH = naturalH * (img.scaleY || 1);
        let targetAngle = img.angle || 0;

        if (img.clipPath && img.clipPath instanceof fabric.Rect) {
          const cp = img.clipPath;
          targetLeft = cp.left ?? targetLeft;
          targetTop = cp.top ?? targetTop;
          targetW = cp.width ?? targetW;
          targetH = cp.height ?? targetH;
          targetAngle = cp.angle ?? targetAngle;
        }

        const rect = new fabric.Rect({
          left: targetLeft, // 改用變數
          top: targetTop, // 改用變數
          originX: "center",
          originY: "center",
          width: targetW, // 改用變數
          height: targetH, // 改用變數
          angle: targetAngle, // 改用變數
          fill: "rgba(0,0,0,0)",
          stroke: "#8b5cf6",
          strokeWidth: 1,
          strokeDashArray: [6, 4],
          selectable: true,
          evented: true,
          hasBorders: true,
          objectCaching: false,
          excludeFromExport: true,
          lockScalingFlip: true,
          lockUniScaling: false,
          centeredScaling: false,
        });

        rect.data = {
          ui: true,
          proxyTag: `__proxy_${id}`,
          hostId: id,
          type: "image",
        };

        const isMobile = "ontouchstart" in window;
        rect.setControlsVisibility({
          tl: true,
          tr: true,
          bl: true,
          br: true,
          ml: true,
          mr: true,
          mt: true,
          mb: true,
          mtr: true,
        });

        // 🔥 統一樣式
        rect.cornerSize = isMobile ? 15 : 10;
        rect.touchCornerSize = isMobile ? 20 : 20;
        rect.cornerStrokeColor = "#6b46c1";
        rect.borderColor = "#6b46c1";
        rect.cornerStyle = "circle";
        rect.transparentCorners = false;
        rect.cornerColor = "#ffffff";
        rect.borderScaleFactor = isMobile ? 2 : 1.5;

        // 🔥 用閉包變數追蹤 activeCorner
        let activeCorner: string | null = null;

        // 🔥 覆寫 render
        Object.keys(rect.controls).forEach((controlName) => {
          const control = rect.controls[controlName];
          if (!control?.render) return;
          const originalRender = control.render.bind(control);

          control.render = function (
            ctx: CanvasRenderingContext2D,
            left: number,
            top: number,
            styleOverride: ControlRenderingStyleOverride | undefined,
            fabricObject: FabricObject
          ) {
            // 🔥 用 override 來控制顏色，不再動 obj.cornerColor
            const override: ControlRenderingStyleOverride = {
              ...(styleOverride || {}),
              transparentCorners: false,
              cornerColor: controlName === activeCorner ? "#6b46c1" : "#ffffff", // 紫 or 白
            };

            originalRender(ctx, left, top, override, fabricObject);
          };
        });

        // 🔥 用 canvas 層級的 mouse:down 事件
        const onCanvasMouseDown = (opt: fabric.CanvasEvents["mouse:down"]) => {
          if (opt.target !== rect) return;

          setTimeout(() => {
            const transform = cnv._currentTransform;
            if (transform?.corner) {
              activeCorner = transform.corner;
              cnv.requestRenderAll();
            }
          }, 0);
        };

        const onCanvasMouseUp = () => {
          if (activeCorner) {
            activeCorner = null;
            cnv.requestRenderAll();
          }
        };

        cnv.on("mouse:down", onCanvasMouseDown);
        cnv.on("mouse:up", onCanvasMouseUp);

        rect.__cleanupEvents = () => {
          cnv.off("mouse:down", onCanvasMouseDown);
          cnv.off("mouse:up", onCanvasMouseUp);
        };

        const syncFunc = syncFrameToImageContent;

        const edge =
          (which: _EdgeSide) =>
          (
            evt: fabric.TPointerEvent,
            transform: { lastX: number; lastY: number },
            x: number,
            y: number
          ) => {
            const first = transform.lastX == null;
            if (first) {
              transform.lastX = x;
              transform.lastY = y;
              (rect as Rect).__isEdgeDragging = true;
              const imgData = ((img as FabricImage).data ||= {});
              imgData.__edgeAnchor = _anchorOf(which);
              delete imgData.__cornerBase;
              delete imgData.__edgeBase;
            } else {
              ((img as FabricImage).data ||= {}).__edgeAnchor =
                _anchorOf(which);
            }

            const dxw = x - transform.lastX,
              dyw = y - transform.lastY;
            const inv = fabric.util.invertTransform(
              (rect as Rect).calcTransformMatrix()
            );
            const p0 = fabric.util.transformPoint(new fabric.Point(0, 0), inv);
            const p1 = fabric.util.transformPoint(
              new fabric.Point(dxw, dyw),
              inv
            );
            const dx = p1.x - p0.x,
              dy = p1.y - p0.y;

            let dw = 0,
              dh = 0,
              cx = 0,
              cy = 0;
            if (which === "ml") {
              dw = -dx;
              cx = -dw / 2;
            }
            if (which === "mr") {
              dw = dx;
              cx = dw / 2;
            }
            if (which === "mt") {
              dh = -dy;
              cy = -dh / 2;
            }
            if (which === "mb") {
              dh = dy;
              cy = dh / 2;
            }

            const minW = 10,
              minH = 10;
            rect.set({
              width: Math.max(minW, (rect.width || 1) + dw),
              height: Math.max(minH, (rect.height || 1) + dh),
            });

            if (cx || cy) {
              const M = (rect as Rect).calcTransformMatrix();
              const q0 = fabric.util.transformPoint(new fabric.Point(0, 0), M);
              const q1 = fabric.util.transformPoint(
                new fabric.Point(cx, cy),
                M
              );
              rect.set({
                left: (rect.left || 0) + (q1.x - q0.x),
                top: (rect.top || 0) + (q1.y - q0.y),
              });
            }

            rect.setCoords();
            transform.lastX = x;
            transform.lastY = y;

            syncFunc(cnv, rect, img, { isEdgeDrag: true, isFirstCall: first });
            return true;
          };

        rect.controls.ml.actionHandler = edge("ml");
        rect.controls.mr.actionHandler = edge("mr");
        rect.controls.mt.actionHandler = edge("mt");
        rect.controls.mb.actionHandler = edge("mb");

        rect.on("scaling", () => {
          absorbScaleIntoSize(rect);
          const first = !(rect as Rect).__cornerScalingStarted;
          (rect as Rect).__cornerScalingStarted = true;
          syncFunc(cnv, rect, img, {
            isCornerScale: !(rect as Rect).__isEdgeDragging,
            isEdgeDrag: !!(rect as Rect).__isEdgeDragging,
            isFirstCall: first,
          });
        });

        rect.on("modified", () => {
          activeCorner = null;
          (rect as Rect).__isEdgeDragging = false;
          (rect as Rect).__cornerScalingStarted = false;
          absorbScaleIntoSize(rect);

          const d = ((img as FabricImage).data ||= {});
          d.__edgeAnchor = d.__edgeAnchor || "left";
          delete d.__cornerBase;
          delete d.__edgeBase;

          const frameW = Math.max(1, rect.width || 1);
          const frameH = Math.max(1, rect.height || 1);
          const mask = ensureMaskRect(cnv, img);
          mask.set({
            left: rect.left,
            top: rect.top,
            width: frameW,
            height: frameH,
          });
          mask.setCoords();

          d.frame = {
            w: frameW,
            h: frameH,
            left: rect.left,
            top: rect.top,
            angle: rect.angle || 0,
          };
          img.setCoords();
          cnv.requestRenderAll();

          if (!isRestoringRef.current) {
            saveToHistory(cnv);
          }
        });

        rect.on("moving", () =>
          syncFunc(cnv, rect, img, { isMoveOrRotate: true })
        );
        rect.on("rotating", () =>
          syncFunc(cnv, rect, img, { isMoveOrRotate: true })
        );

        img.selectable = false;
        img.evented = false;

        cnv.add(rect);

        const imgIndex = cnv.getObjects().indexOf(img);
        if (imgIndex !== -1) {
          cnv.remove(rect);
          cnv.insertAt(imgIndex + 1, rect);
        }

        syncFunc(cnv, rect, img, { isMoveOrRotate: true });
        cnv.requestRenderAll();

        return rect;
      },
      deleteLayer: (id: string) => {
        const canvas = canvasRef.current!;
        if (!canvas) return;

        // 找到目標 image 物件（非背景）
        const target = getObjectsNoBgImagesOnly().find(
          (o) => (o as unknown as { data?: { id?: string } }).data?.id === id
        ) as fabric.FabricImage | undefined;

        if (!target) {
          // 仍把殘留的 proxy / pending 清掉，避免「框框」留存
          const proxyTag = `__proxy_${id}`;
          (canvas.getObjects() as FabricObject[])
            .filter((o) => {
              const d = (o as FabricObject).data || {};
              return (
                d?.proxyTag === proxyTag ||
                d?.pendingFlag === `__pending_${id}` ||
                d?.handleOf === id ||
                d?.relatedId === id
              );
            })
            .forEach((o) => canvas.remove(o));
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          return;
        }

        // 如果目前有 activeSelection，把它解除，避免刪除時發生幽靈控制框
        const active = canvas.getActiveObject?.();
        if (active instanceof Group || active instanceof ActiveSelection) {
          active.remove(target);
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }

        // 是否為「鎖定繪製」中的對象
        const wasLocked = activeLayerRef.current === target;

        // 先把所有附屬物（proxy/pending/handles/related overlays）找出並移除
        const proxyTag = `__proxy_${id}`;
        const toRemove = (canvas.getObjects() as FabricObject[]).filter((o) => {
          const d = (o as FabricObject).data || {};
          return (
            d?.proxyTag === proxyTag || // 代理框
            d?.pendingFlag === `__pending_${id}` || // 等候中的 UI
            d?.handleOf === id || // 遮罩/裁切把手
            d?.relatedId === id // 任何自定關聯
          );
        });

        toRemove.forEach((o) => canvas.remove(o));

        // 再移除真正的影像物件
        canvas.remove(target as FabricObject);

        // 清理各種快取與標記
        LAYER_BASE_CANVAS.delete(id);
        LAYER_MASK_CANVAS.delete(id);
        LAYER_VIEW_CANVAS.delete(id);
        LAYER_BASE_PIXEL.delete(id);
        LAYER_IMG_CACHE.delete(id);
        LAYER_HAS_BRUSH.delete(id);
        LAYER_MASK_NONWHITE.delete(id);
        LAYER_USER_DRAWN.delete(id);

        // 若此圖層正是當前的筆刷/橡皮擦目標，先安全退出繪製模式
        if (wasLocked && (brushModeRef.current || eraserModeRef.current)) {
          exitAllDraw(canvas, false);
        } else {
          // 清掉任何殘留的 activeObject 與控制框
          canvas.discardActiveObject();
          updateActiveLayerRefFromCanvas(canvas);
        }

        // 最後一次完整重算控制點 & 重繪，避免殘影
        canvas.forEachObject((o) => o.setCoords && o.setCoords());
        canvas.requestRenderAll();

        // 補一筆歷史
        saveToHistory(canvas);
      },

      setActive: (id: string | null) => {
        const canvas = canvasRef.current!;
        if (!id) {
          canvas.discardActiveObject();
          activeLayerRef.current = null;
          canvas.requestRenderAll();
          return;
        }

        // 🔥 優先找 proxy rect（圖片和文字都用 proxy）
        let targetObj = (canvas.getObjects() as FabricObject[]).find(
          (o) => (o as FabricObject).data?.proxyTag === `__proxy_${id}`
        );

        // 如果沒有 proxy，才找原始物件
        if (!targetObj) {
          targetObj = getObjectsNoBgImagesOnly().find(
            (o) => (o as unknown as { data?: { id?: string } }).data?.id === id
          );
        }

        if (!targetObj) return;

        canvas.setActiveObject(targetObj);
        updateActiveLayerRefFromCanvas(canvas);

        if (
          (brushArmedRef.current || eraserModeRef.current) &&
          activeLayerRef.current
        ) {
          enterLockedBrushLike(canvas, activeLayerRef.current);
        } else {
          canvas.requestRenderAll();
        }
      },
      setActiveMultiple: (ids: string[]) => {
        const canvas = canvasRef.current!;
        exitAllDraw(canvas, true);

        console.log("idsidsids ", ids);

        // 🔥 如果只剩 0 或 1 個，清理所有 handle 並恢復 proxy
        if (ids.length < 2) {
          // 清理舊 handle
          const oldHandle = (canvas.getObjects() as FabricObject[]).find(
            (o) => (o as FabricObject).data?.isMultiSelectHandle
          );
          if (oldHandle) {
            canvas.remove(oldHandle);
          }

          // 恢復所有 proxy 可見
          (canvas.getObjects() as FabricObject[]).forEach((o) => {
            if ((o as FabricObject).data?.proxyTag) {
              const hostId = (o as FabricObject).data?.hostId as string;
              const hostObj = (canvas.getObjects() as FabricObject[]).find(
                (obj) => obj.data?.id === hostId
              );
              const objVisible = hostObj?.visible ?? true;
              o.visible = objVisible;
              o.evented = objVisible;
              o.selectable = objVisible;
            }
          });

          canvas.requestRenderAll();
          return;
        }

        type FObj = FabricObject;
        type FImg = fabric.FabricImage;

        // 🔥 清理舊的 handle（如果有）
        const oldHandle = (canvas.getObjects() as FabricObject[]).find(
          (o) => (o as FabricObject).data?.isMultiSelectHandle
        );
        if (oldHandle) {
          console.log("🔥 清理舊 handle");
          canvas.remove(oldHandle);
        }

        // ===== 安全係數（避免臨界值露白）=====
        const COVER_PAD_PX = 0.75; // 以像素為單位的投影墊高
        const S_SCALE_SAFETY = 1.001; // 臨界時額外乘上的保險係數

        // === 幫手 ===
        const axesOf = (deg: number) => {
          const th = (deg * Math.PI) / 180;
          return {
            right: new fabric.Point(Math.cos(th), Math.sin(th)),
            up: new fabric.Point(-Math.sin(th), Math.cos(th)),
          };
        };

        const setProxyGeometry = (
          proxy: fabric.Rect,
          cx: number,
          cy: number,
          w: number,
          h: number,
          angle: number
        ) => {
          proxy.set({
            left: cx,
            top: cy,
            originX: "center",
            originY: "center",
            width: Math.max(1, w),
            height: Math.max(1, h),
            angle,
            scaleX: 1,
            scaleY: 1,
          });
          proxy.setCoords();
        };

        // 角用：MAX 軸等比（上一版）
        const uniformFrom = (sx: number, sy: number) =>
          Math.max(Math.abs(sx), Math.abs(sy));

        // === 你的原公式：相對 baseScale 的 cover 下限；加入像素墊高與安全係數 ===
        const minCoverScaleRot = (
          proxyW: number,
          proxyH: number,
          proxyAngleDeg: number,
          imgAngleDeg: number,
          pxW: number,
          pxH: number,
          baseScale: number
        ) => {
          const d = ((proxyAngleDeg - imgAngleDeg) * Math.PI) / 180;
          const c = Math.abs(Math.cos(d));
          const s = Math.abs(Math.sin(d));
          // 在投影端加像素墊高（等效為需求多一點）
          const projW = c * proxyW + s * proxyH + COVER_PAD_PX;
          const projH = s * proxyW + c * proxyH + COVER_PAD_PX;
          const denomW = Math.max(1, pxW * baseScale);
          const denomH = Math.max(1, pxH * baseScale);
          return (
            Math.max(projW / denomW, projH / denomH, 0.0001) * S_SCALE_SAFETY
          );
        };

        // === 絕對覆蓋（不依賴 baseScale）；同樣加入墊高與安全係數 ===
        const minCoverAbsRot = (
          proxyW: number,
          proxyH: number,
          proxyAngleDeg: number,
          imgAngleDeg: number,
          pxW: number,
          pxH: number
        ) => {
          const d = ((proxyAngleDeg - imgAngleDeg) * Math.PI) / 180;
          const c = Math.abs(Math.cos(d));
          const s = Math.abs(Math.sin(d));
          const projW = c * proxyW + s * proxyH + COVER_PAD_PX;
          const projH = s * proxyW + c * proxyH + COVER_PAD_PX;
          const denomW = Math.max(1, pxW);
          const denomH = Math.max(1, pxH);
          return (
            Math.max(projW / denomW, projH / denomH, 0.0001) * S_SCALE_SAFETY
          );
        };

        // === 側邊同邊貼齊所需「絕對 scale」；分子加墊高 ===
        const edgeScaleNeedAbs = (args: {
          side: "mr" | "ml" | "mb" | "mt";
          proxyCenter: fabric.Point;
          proxyW: number;
          proxyH: number;
          proxyAxes: { right: fabric.Point; up: fabric.Point };
          imgCenter: fabric.Point;
          imgAngleDeg: number;
          pxW: number;
          pxH: number;
        }): number => {
          const {
            side,
            proxyCenter: wc,
            proxyW,
            proxyH,
            proxyAxes: pAxes,
            imgCenter: ic,
            imgAngleDeg,
            pxW,
            pxH,
          } = args;

          const useRight = side === "mr" || side === "ml";
          const u = useRight ? pAxes.right : pAxes.up;
          const proxyHalf = useRight ? proxyW / 2 : proxyH / 2;

          const iAxes = axesOf(imgAngleDeg);
          const dot = (a: fabric.Point, b: fabric.Point) =>
            a.x * b.x + a.y * b.y;
          const A =
            0.5 *
            (Math.abs(dot(u, iAxes.right)) * pxW +
              Math.abs(dot(u, iAxes.up)) * pxH);

          const wc_u = dot(wc, u);
          const ic_u = dot(ic, u);

          let numerator = 0;
          if (side === "mr" || side === "mb") {
            numerator = wc_u - ic_u + proxyHalf + COVER_PAD_PX; // 正向邊再加像素墊高
          } else {
            numerator = ic_u - wc_u + proxyHalf + COVER_PAD_PX; // 反向邊同理
          }

          const denom = Math.max(A, 1e-6);
          return Math.max(0, (numerator / denom) * S_SCALE_SAFETY);
        };

        const isSideCorner = (c?: string) =>
          c === "mr" || c === "ml" || c === "mt" || c === "mb";
        const isAngleCorner = (c?: string) =>
          c === "tl" || c === "tr" || c === "bl" || c === "br";

        // 🔥 修改：Pair 類型支援文字
        type Pair = {
          id: string;
          proxy: fabric.Rect;
          obj: fabric.FabricImage | fabric.Textbox; // 🔥 可以是圖片或文字
          isText: boolean; // 🔥 標記是否為文字
          baseProxy: {
            cx: number;
            cy: number;
            w: number;
            h: number;
            angle: number;
          };
          // 🔥 文字的基礎資訊
          baseText?: {
            scaleX: number;
            scaleY: number;
            angle: number;
          };
          // 🔥 只有圖片才需要的屬性
          baseImg?: {
            scale: number;
            angle: number;
            offsetLocalX: number;
            offsetLocalY: number;
            pxW: number;
            pxH: number;
          };
          baseClip?: {
            w: number;
            h: number;
            angle: number;
            offsetLocalX: number;
            offsetLocalY: number;
          };
        };

        // === 🔥 修改：蒐集目標（圖片 + 文字）===
        const pairs: Pair[] = [];
        ids.forEach((id) => {
          // 🔥 先嘗試找圖片
          const img = (canvas.getObjects() as FabricObject[]).find(
            (o) => o.type === "image" && (o as FObj).data?.id === id
          ) as fabric.FabricImage | undefined;

          // 🔥 獨立查找文字（移除 !img 條件）
          const text = (canvas.getObjects() as FabricObject[]).find(
            (o) =>
              (o.type === "textbox" || o.type === "i-text") &&
              (o as FObj).data?.id === id &&
              o.data?.isText
          ) as fabric.Textbox | undefined;

          const targetObj = img || text;
          if (!targetObj) {
            console.warn("找不到物件:", id);
            return;
          }

          const isText = !!text;

          // 找對應的 proxy
          let proxy = (canvas.getObjects() as FabricObject[]).find(
            (o) => (o as FObj).data?.proxyTag === `__proxy_${id}`
          ) as fabric.Rect | undefined;

          if (!proxy) {
            if (isText) {
              proxy = api.ensureTextProxyRect(canvas, text!);
            } else {
              proxy = api.ensureProxyRect(canvas, img!);
            }
          }

          proxy.set({ originX: "center", originY: "center" });
          targetObj.set({ originX: "center", originY: "center" });

          const pAng = proxy.angle || 0;
          const { right, up } = axesOf(pAng);

          const pW = Math.max(1, proxy.width ?? proxy.getScaledWidth());
          const pH = Math.max(1, proxy.height ?? proxy.getScaledHeight());
          const pCx = proxy.left ?? 0;
          const pCy = proxy.top ?? 0;

          // 🔥 如果是文字，只需要基本資訊
          if (isText) {
            pairs.push({
              id,
              proxy,
              obj: text!,
              isText: true,
              baseProxy: { cx: pCx, cy: pCy, w: pW, h: pH, angle: pAng },
              baseText: {
                scaleX: text!.scaleX || 1,
                scaleY: text!.scaleY || 1,
                angle: text!.angle || 0,
              },
            });
            return;
          }

          // 🔥 如果是圖片，需要完整的圖片資訊
          const imgCx = img!.left ?? pCx;
          const imgCy = img!.top ?? pCy;

          const vX = imgCx - pCx;
          const vY = imgCy - pCy;
          const offsetLocalX = vX * right.x + vY * right.y;
          const offsetLocalY = vX * up.x + vY * up.y;

          let baseClip: Pair["baseClip"] | undefined;
          if (img!.clipPath && img!.clipPath instanceof fabric.Rect) {
            const cp = img!.clipPath as fabric.Rect;
            cp.set({
              originX: "center",
              originY: "center",
              absolutePositioned: true,
            });
            const cpCx = cp.left ?? pCx,
              cpCy = cp.top ?? pCy;
            const dvX = cpCx - pCx,
              dvY = cpCy - pCy;
            baseClip = {
              w: Math.max(1, cp.width || 1),
              h: Math.max(1, cp.height || 1),
              angle: cp.angle || 0,
              offsetLocalX: dvX * right.x + dvY * right.y,
              offsetLocalY: dvX * up.x + dvY * up.y,
            };
          }

          const el = img!.getElement() as HTMLCanvasElement | HTMLImageElement;
          const pxW =
            el instanceof HTMLCanvasElement
              ? el.width
              : el.naturalWidth || (img!.width as number) || 1;
          const pxH =
            el instanceof HTMLCanvasElement
              ? el.height
              : el.naturalHeight || (img!.height as number) || 1;

          pairs.push({
            id,
            proxy,
            obj: img!,
            isText: false,
            baseProxy: { cx: pCx, cy: pCy, w: pW, h: pH, angle: pAng },
            baseImg: {
              scale: img!.scaleX || 1,
              angle: img!.angle || 0,
              offsetLocalX,
              offsetLocalY,
              pxW,
              pxH,
            },
            baseClip,
          });
        });

        if (!pairs.length) {
          (canvas.getObjects() as FabricObject[]).forEach((o) => {
            if ((o as FObj).data?.proxyTag) {
              o.selectable = true;
              o.evented = true;
              o.visible = true; // 🔥 加這行
              (o as FabricObject).hoverCursor = "move";
            }
          });
          canvas.requestRenderAll();
          return;
        }

        // === 群組外框（包含所有 proxy 的邊界）===
        const groupBase = (() => {
          console.log("🔍 計算 groupBase，pairs 數量:", pairs.length);

          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
          pairs.forEach((p) => {
            const b = p.proxy.getBoundingRect();
            console.log(
              `🔍 圖層 ${p.id} (${p.isText ? "文字" : "圖片"}) 邊界:`,
              b
            );
            minX = Math.min(minX, b.left);
            minY = Math.min(minY, b.top);
            maxX = Math.max(maxX, b.left + b.width);
            maxY = Math.max(maxY, b.top + b.height);
          });

          const result = {
            cx: (minX + maxX) / 2,
            cy: (minY + maxY) / 2,
            w: Math.max(1, maxX - minX),
            h: Math.max(1, maxY - minY),
            angle: 0,
          };

          console.log("🔍 groupBase 結果:", result);
          return result;
        })();

        // 🔥 禁用子 proxy，由 group handle 接管（重要：加上 visible = false）
        (canvas.getObjects() as FabricObject[]).forEach((o) => {
          if ((o as FObj).data?.proxyTag) {
            o.selectable = false;
            o.evented = false;
            o.visible = false; // 🔥 關鍵：隱藏所有子 proxy
            (o as FabricObject).hoverCursor = "default";
          }
        });

        // === 群組控制框 ===
        const handle = new fabric.Rect({
          left: groupBase.cx,
          top: groupBase.cy,
          originX: "center",
          originY: "center",
          width: groupBase.w,
          height: groupBase.h,
          angle: 0,
          fill: "rgba(0,0,0,0)",
          stroke: "#60a5fa",
          strokeWidth: 1,
          strokeDashArray: [6, 4],
          selectable: true,
          evented: true,
          objectCaching: false,
          excludeFromExport: true,
        }) as fabric.Rect;
        handle.setControlsVisibility({
          tl: true,
          tr: true,
          bl: true,
          br: true,
          ml: true,
          mr: true,
          mt: true,
          mb: true,
          mtr: true,
        });
        (handle as Rect).lockScalingFlip = true;
        (handle as Rect).centeredScaling = false;
        (handle as Rect).data = {
          isMultiSelectHandle: true,
          targetIds: ids, // 🔥 記住所有被選中的 ids
        };
        canvas.add(handle);

        let minIndex = Infinity;
        pairs.forEach((p) => {
          const idx = canvas.getObjects().indexOf(p.proxy);
          if (idx < minIndex) minIndex = idx;
        });

        // 🔥 把 handle 放在最底層圖層的下方
        if (minIndex !== Infinity) {
          canvas.remove(handle);
          canvas.insertAt(canvas.getObjects().length, handle); // 插入到最後（最上層）
        }
        pairs.forEach((p) => {
          p.proxy.selectable = false;
          p.proxy.evented = false;
        });
        canvas.setActiveObject(handle);
        canvas.requestRenderAll();

        // 追蹤目前拖曳的 corner
        let activeCorner: string | undefined;

        // === 🔥 修改：套用群組變換（支援文字）===
        const applyGroupTransform = (cur: {
          cx: number;
          cy: number;
          w: number;
          h: number;
          angle: number;
        }) => {
          const sx = cur.w / groupBase.w;
          const sy = cur.h / groupBase.h;
          const dAng = cur.angle - groupBase.angle;
          const gAxes = axesOf(dAng);
          const sUniform = uniformFrom(sx, sy); // 角用

          pairs.forEach((p) => {
            // (1) 代理框
            const baseDx = p.baseProxy.cx - groupBase.cx;
            const baseDy = p.baseProxy.cy - groupBase.cy;
            const wc = new fabric.Point(
              cur.cx + gAxes.right.x * baseDx * sx + gAxes.up.x * baseDy * sy,
              cur.cy + gAxes.right.y * baseDx * sx + gAxes.up.y * baseDy * sy
            );

            const newProxyW = Math.max(1, p.baseProxy.w * sx);
            const newProxyH = Math.max(1, p.baseProxy.h * sy);
            const newProxyAng = p.baseProxy.angle + dAng;
            setProxyGeometry(
              p.proxy,
              wc.x,
              wc.y,
              newProxyW,
              newProxyH,
              newProxyAng
            );

            const pAxes = axesOf(newProxyAng);

            // 🔥 如果是文字，根據拖曳方式決定行為
            if (p.isText) {
              const textObj = p.obj as fabric.IText;

              if (isAngleCorner(activeCorner)) {
                // 拉角：等比縮放字體
                const scaleRatio = Math.max(Math.abs(sx), Math.abs(sy));
                const newScaleX = (p.baseText?.scaleX || 1) * scaleRatio;
                const newScaleY = (p.baseText?.scaleY || 1) * scaleRatio;

                textObj.set({
                  left: wc.x,
                  top: wc.y,
                  scaleX: newScaleX,
                  scaleY: newScaleY,
                  angle: newProxyAng,
                });
                textObj.setCoords();
              } else if (activeCorner === "ml" || activeCorner === "mr") {
                // 拉左右邊：改變寬度，觸發換行
                const currentTextScale = p.baseText?.scaleX || 1;

                // 使用 proxy 的寬度來計算
                const baseProxyWidth = p.baseProxy.w;
                const newProxyWidth = baseProxyWidth * Math.abs(sx);
                const newTextWidth = newProxyWidth / currentTextScale;

                // 🔥 計算文字換行後的新高度
                const tempHeight = textObj.height || 50;
                textObj.set({ width: newTextWidth });
                textObj.initDimensions();
                const newTextHeight =
                  (textObj.height || tempHeight) * currentTextScale;

                // 🔥 計算高度差異
                const oldProxyHeight = p.baseProxy.h;
                const heightDiff = newTextHeight - oldProxyHeight;

                // 🔥 只允許向下擴展（沿著 proxy 的 up 軸正方向）
                const pAxes = axesOf(newProxyAng);
                const adjustedCy = wc.y + pAxes.up.y * (heightDiff / 2);
                const adjustedCx = wc.x + pAxes.up.x * (heightDiff / 2);

                textObj.set({
                  left: adjustedCx,
                  top: adjustedCy,
                  width: newTextWidth,
                  scaleX: currentTextScale,
                  scaleY: currentTextScale,
                  angle: newProxyAng,
                });

                // 更新 proxy 位置和高度
                p.proxy.set({
                  left: adjustedCx,
                  top: adjustedCy,
                  height: newTextHeight,
                });
                p.proxy.setCoords();
                textObj.setCoords();
              } else if (activeCorner === "mt" || activeCorner === "mb") {
                // 拉上下邊：只改變 proxy 高度，文字不受影響
                textObj.set({
                  left: wc.x,
                  top: wc.y,
                  angle: newProxyAng,
                });
                textObj.setCoords();
              } else {
                // 移動或旋轉：使用較小值（保守）
                const scaleRatio = Math.min(Math.abs(sx), Math.abs(sy));
                const newScaleX = (p.baseText?.scaleX || 1) * scaleRatio;
                const newScaleY = (p.baseText?.scaleY || 1) * scaleRatio;

                textObj.set({
                  left: wc.x,
                  top: wc.y,
                  scaleX: newScaleX,
                  scaleY: newScaleY,
                  angle: newProxyAng,
                });
                textObj.setCoords();
              }

              return;
            }

            // 🔥 如果是圖片，使用原有的複雜邏輯
            const img = p.obj as fabric.FabricImage;

            if (isAngleCorner(activeCorner)) {
              // === 角：完全沿用上一版（不動） ===
              const wantW = newProxyW,
                wantH = newProxyH;
              const curImgW0 = p.baseImg!.pxW * p.baseImg!.scale;
              const curImgH0 = p.baseImg!.pxH * p.baseImg!.scale;
              const coverNeed = Math.max(wantW / curImgW0, wantH / curImgH0);

              let uni = sUniform > 1 ? 1 : sUniform;
              uni = Math.max(uni, coverNeed, 0.0001);

              const offX = p.baseImg!.offsetLocalX * uni;
              const offY = p.baseImg!.offsetLocalY * uni;

              const imgWC = new fabric.Point(
                wc.x + pAxes.right.x * offX + pAxes.up.x * offY,
                wc.y + pAxes.right.y * offX + pAxes.up.y * offY
              );

              const sAbs = p.baseImg!.scale * uni;

              img.set({
                left: imgWC.x,
                top: imgWC.y,
                originX: "center",
                originY: "center",
                scaleX: sAbs,
                scaleY: sAbs,
                angle: p.baseImg!.angle + dAng,
              });
              img.setCoords();
            } else {
              // === 側邊：相對 cover + 絕對 cover + 被拉邊 + 對邊（全部取 max），並加入安全係數 ===
              const imgWC = new fabric.Point(
                wc.x +
                  pAxes.right.x * (p.baseImg!.offsetLocalX * sx) +
                  pAxes.up.x * (p.baseImg!.offsetLocalY * sy),
                wc.y +
                  pAxes.right.y * (p.baseImg!.offsetLocalX * sx) +
                  pAxes.up.y * (p.baseImg!.offsetLocalY * sy)
              );

              const imgAngleNow = p.baseImg!.angle + dAng;

              const needRel = minCoverScaleRot(
                newProxyW,
                newProxyH,
                newProxyAng,
                imgAngleNow,
                p.baseImg!.pxW,
                p.baseImg!.pxH,
                p.baseImg!.scale
              );
              let s = Math.max(p.baseImg!.scale * needRel, p.baseImg!.scale);

              const coverAbs = minCoverAbsRot(
                newProxyW,
                newProxyH,
                newProxyAng,
                imgAngleNow,
                p.baseImg!.pxW,
                p.baseImg!.pxH
              );

              if (isSideCorner(activeCorner)) {
                const side = activeCorner as "mr" | "ml" | "mt" | "mb";
                const needDragged = edgeScaleNeedAbs({
                  side,
                  proxyCenter: wc,
                  proxyW: newProxyW,
                  proxyH: newProxyH,
                  proxyAxes: pAxes,
                  imgCenter: imgWC,
                  imgAngleDeg: imgAngleNow,
                  pxW: p.baseImg!.pxW,
                  pxH: p.baseImg!.pxH,
                });
                const opposite =
                  side === "mr"
                    ? "ml"
                    : side === "ml"
                    ? "mr"
                    : side === "mb"
                    ? "mt"
                    : "mb";
                const needOpposite = edgeScaleNeedAbs({
                  side: opposite as "mr" | "ml" | "mt" | "mb",
                  proxyCenter: wc,
                  proxyW: newProxyW,
                  proxyH: newProxyH,
                  proxyAxes: pAxes,
                  imgCenter: imgWC,
                  imgAngleDeg: imgAngleNow,
                  pxW: p.baseImg!.pxW,
                  pxH: p.baseImg!.pxH,
                });
                s = Math.max(s, coverAbs, needDragged, needOpposite);
              } else {
                s = Math.max(s, coverAbs);
              }

              img.set({
                left: imgWC.x,
                top: imgWC.y,
                originX: "center",
                originY: "center",
                scaleX: s,
                scaleY: s,
                angle: imgAngleNow,
              });
              img.setCoords();
            }

            // (3) 裁切 / mask 同步 + frame 同步（維持前版）
            if (img.clipPath && img.clipPath instanceof fabric.Rect) {
              const cp = img.clipPath as fabric.Rect;
              const cpWC = new fabric.Point(
                wc.x +
                  pAxes.right.x * ((p.baseClip?.offsetLocalX ?? 0) * sx) +
                  pAxes.up.x * ((p.baseClip?.offsetLocalY ?? 0) * sy),
                wc.y +
                  pAxes.right.y * ((p.baseClip?.offsetLocalX ?? 0) * sx) +
                  pAxes.up.y * ((p.baseClip?.offsetLocalY ?? 0) * sy)
              );
              cp.set({
                left: cpWC.x,
                top: cpWC.y,
                originX: "center",
                originY: "center",
                width: Math.max(1, (p.baseClip?.w ?? p.baseProxy.w) * sx),
                height: Math.max(1, (p.baseClip?.h ?? p.baseProxy.h) * sy),
                angle: (p.baseClip?.angle ?? p.baseProxy.angle) + dAng,
                absolutePositioned: true,
              });
              cp.setCoords();

              (img as FImg).data ||= {};
              (
                (img as FImg).data as {
                  frame: {
                    origin: string;
                    cx: number;
                    cy: number;
                    w: number;
                    h: number;
                    angle: number;
                  };
                }
              ).frame = {
                origin: "center",
                cx: wc.x,
                cy: wc.y,
                w: newProxyW,
                h: newProxyH,
                angle: newProxyAng,
              };
            } else {
              const mask = ensureMaskRect(canvas, img);
              mask.set({
                left: wc.x,
                top: wc.y,
                originX: "center",
                originY: "center",
                width: newProxyW,
                height: newProxyH,
                angle: newProxyAng,
                absolutePositioned: true,
              });
              mask.setCoords();
              (img as FImg).data ||= {};
              (
                (img as FImg).data as {
                  frame: {
                    origin: string;
                    cx: number;
                    cy: number;
                    w: number;
                    h: number;
                    angle: number;
                  };
                }
              ).frame = {
                origin: "center",
                cx: wc.x,
                cy: wc.y,
                w: newProxyW,
                h: newProxyH,
                angle: newProxyAng,
              };
            }
          });

          canvas.requestRenderAll();
        };

        // 側邊拉伸時固定對邊（原樣）
        const sideLockDuringScaling = () => {
          const t = (canvas as Canvas)._currentTransform;
          const corner: string | undefined = t?.corner;
          if (!corner) return;
          if (!["ml", "mr", "mt", "mb"].includes(corner)) return;

          const ang = handle.angle || 0;
          const { right, up } = axesOf(ang);

          const newW = Math.max(1, handle.width || groupBase.w);
          const newH = Math.max(1, handle.height || groupBase.h);

          const baseAxes = axesOf(groupBase.angle);
          const leftAnchor = new fabric.Point(
            groupBase.cx + baseAxes.right.x * (-groupBase.w / 2),
            groupBase.cy + baseAxes.right.y * (-groupBase.w / 2)
          );
          const rightAnchor = new fabric.Point(
            groupBase.cx + baseAxes.right.x * (groupBase.w / 2),
            groupBase.cy + baseAxes.right.y * (groupBase.w / 2)
          );
          const topAnchor = new fabric.Point(
            groupBase.cx + baseAxes.up.x * (-groupBase.h / 2),
            groupBase.cy + baseAxes.up.y * (-groupBase.h / 2)
          );
          const bottomAnchor = new fabric.Point(
            groupBase.cx + baseAxes.up.x * (groupBase.h / 2),
            groupBase.cy + baseAxes.up.y * (groupBase.h / 2)
          );

          let cx = handle.left || groupBase.cx;
          let cy = handle.top || groupBase.cy;

          if (corner === "mr") {
            cx = leftAnchor.x + right.x * (newW / 2);
            cy = leftAnchor.y + right.y * (newW / 2);
          } else if (corner === "ml") {
            cx = rightAnchor.x - right.x * (newW / 2);
            cy = rightAnchor.y - right.y * (newW / 2);
          } else if (corner === "mb") {
            cx = topAnchor.x + up.x * (newH / 2);
            cy = topAnchor.y + up.y * (newH / 2);
          } else if (corner === "mt") {
            cx = bottomAnchor.x - up.x * (newH / 2);
            cy = bottomAnchor.y - up.y * (newH / 2);
          }

          handle.set({ left: cx, top: cy });
          handle.setCoords();
        };

        // 互動回呼（原樣）
        const reapply = () => {
          applyGroupTransform({
            cx: handle.left!,
            cy: handle.top!,
            w: Math.max(1, handle.width || groupBase.w),
            h: Math.max(1, handle.height || groupBase.h),
            angle: handle.angle || 0,
          });
        };

        handle.on("moving", () => {
          activeCorner = undefined;
          reapply();
        });
        handle.on("scaling", () => {
          const t = (canvas as Canvas)._currentTransform;
          activeCorner = t?.corner;
          absorbScaleIntoSize(handle);
          if (isSideCorner(activeCorner)) sideLockDuringScaling();
          handle.setCoords();
          reapply();
        });
        handle.on("rotating", () => {
          activeCorner = undefined;
          reapply();
        });

        // 回合起訖（原樣，含 frame 同步）
        const onRoundStart = () => {
          handle.setCoords();
          const b = handle.getBoundingRect();
          groupBase.cx = handle.left ?? b.left + b.width / 2;
          groupBase.cy = handle.top ?? b.top + b.height / 2;
          groupBase.w = Math.max(1, handle.width || b.width);
          groupBase.h = Math.max(1, handle.height || b.height);
          groupBase.angle = handle.angle || 0;

          pairs.forEach((p) => {
            const cx = p.proxy.left ?? 0,
              cy = p.proxy.top ?? 0,
              ang = p.proxy.angle || 0;
            const w = Math.max(1, p.proxy.width ?? p.proxy.getScaledWidth());
            const h = Math.max(1, p.proxy.height ?? p.proxy.getScaledHeight());
            const { right, up } = axesOf(ang);

            // 🔥 如果是文字，只更新 baseProxy 和 baseText
            if (p.isText) {
              const textObj = p.obj as fabric.IText;
              p.baseProxy = { cx, cy, w, h, angle: ang };
              p.baseText = {
                scaleX: textObj.scaleX || 1,
                scaleY: textObj.scaleY || 1,
                angle: textObj.angle || 0,
              };
              return;
            }

            const img = p.obj as fabric.FabricImage;
            const imgCx = img.left ?? cx,
              imgCy = img.top ?? cy;
            const vX = imgCx - cx,
              vY = imgCy - cy;

            p.baseProxy = { cx, cy, w, h, angle: ang };
            p.baseImg = {
              scale: img.scaleX || 1,
              angle: img.angle || 0,
              offsetLocalX: vX * right.x + vY * right.y,
              offsetLocalY: vX * up.x + vY * up.y,
              pxW: p.baseImg!.pxW,
              pxH: p.baseImg!.pxH,
            };

            if (img.clipPath && img.clipPath instanceof fabric.Rect) {
              const cp = img.clipPath as fabric.Rect;
              const cpCx = cp.left ?? cx,
                cpCy = cp.top ?? cy;
              const dvX = cpCx - cx,
                dvY = cpCy - cy;
              p.baseClip = {
                w: Math.max(1, cp.width || 1),
                h: Math.max(1, cp.height || 1),
                angle: cp.angle || 0,
                offsetLocalX: dvX * right.x + dvY * right.y,
                offsetLocalY: dvX * up.x + dvY * up.y,
              };
            } else p.baseClip = undefined;

            const d = ((img as FImg).data ||= {});
            delete d.__edgeBase;
            delete d.__cornerBase;
            delete d.__edgeAnchor;
          });
        };

        const onRoundEnd = () => {
          activeCorner = undefined;
          absorbScaleIntoSize(handle);
          handle.setCoords();

          pairs.forEach((p) => {
            const proxy = p.proxy;
            const cx = proxy.left ?? 0;
            const cy = proxy.top ?? 0;
            const w = Math.max(1, proxy.width ?? proxy.getScaledWidth());
            const h = Math.max(1, proxy.height ?? proxy.getScaledHeight());
            const ang = proxy.angle || 0;

            // 🔥 文字不需要 frame
            if (p.isText) return;

            const img = p.obj as fabric.FabricImage;
            (img as FImg).data ||= {};
            (
              (img as FImg).data as {
                frame: {
                  origin: string;
                  cx: number;
                  cy: number;
                  w: number;
                  h: number;
                  angle: number;
                };
              }
            ).frame = { origin: "center", cx, cy, w, h, angle: ang };
          });

          canvas.requestRenderAll();
          if (!isRestoringRef.current) saveToHistory(canvas);
        };

        handle.on("mousedown", onRoundStart);
        handle.on("mouseup", onRoundEnd);
        handle.on("modified", onRoundEnd);

        // 點空白/ESC 退出（原樣）
        const cleanup = () => {
          try {
            handle.off("moving");
            handle.off("scaling");
            handle.off("rotating");
            handle.off("mousedown", onRoundStart);
            handle.off("mouseup", onRoundEnd);
            handle.off("modified", onRoundEnd);
            canvas.off("mouse:down", onBlank);
            window.removeEventListener("keydown", onEsc);
          } catch {}
          if (canvas.getObjects().includes(handle)) canvas.remove(handle);

          // 🔥 恢復所有 proxy 可見（直接遍歷 canvas 上所有物件）
          (canvas.getObjects() as FabricObject[]).forEach((o) => {
            if ((o as FObj).data?.proxyTag) {
              // 找到對應的實際物件
              const hostId = (o as FObj).data?.hostId as string;
              const hostObj = (canvas.getObjects() as FabricObject[]).find(
                (obj) => obj.data?.id === hostId
              );

              const objVisible = hostObj?.visible ?? true;
              o.visible = objVisible;
              o.evented = objVisible;
              o.selectable = objVisible;
              (o as FabricObject).hoverCursor = "move";
            }
          });

          canvas.requestRenderAll();

          // 🔥 清理後移除 reference
          canvas.__multiSelectCleanup = undefined;
        };

        // 🔥 存到 canvas 上，方便外部呼叫
        canvas.__multiSelectCleanup = cleanup;

        const onBlank = (opt: fabric.CanvasEvents["mouse:down"]) => {
          const t = opt.target as FabricObject | null | undefined;

          const isHandle = !!(t as FObj)?.data?.isMultiSelectHandle;
          const isChild = !!(t as FObj)?.data?.proxyTag;

          // 🔥 如果點到子 proxy，強制選回 handle
          if (isChild) {
            console.log("isChild");
            const clickedId = (t as FObj)?.data?.hostId as string;
            if (clickedId && ids.includes(clickedId)) {
              // 🔥 阻止默認行為
              const event = opt.e as MouseEvent;
              if (event.preventDefault) event.preventDefault();
              if (event.stopPropagation) event.stopPropagation();

              // 🔥 強制選中 handle
              canvas.setActiveObject(handle);
              canvas.requestRenderAll();
              return;
            }
          }

          // 🔥 點到 handle，什麼都不做
          if (isHandle) {
            return;
          }

          // 🔥 點到其他地方，清理
          cleanup();
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        };
        const onEsc = (e: KeyboardEvent) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cleanup();
            try {
              canvas.discardActiveObject();
            } catch {}
            canvas.requestRenderAll();
          }
        };

        canvas.on("mouse:down", onBlank);
        window.addEventListener("keydown", onEsc);
      },
      replaceCurrentHistory: () => {
        const canvas = canvasRef.current;
        if (!canvas || isRestoringRef.current) return;

        try {
          const state = buildSnapshot(canvas);
          if (!state || !Array.isArray(state.objects)) return;

          // 🔥 替換當前 index 的 history，而不是 push
          historyRef.current[historyIndexRef.current] = state;

          // 同時更新 autosave
          try {
            scheduleAutosave(projectId, state);
          } catch (err) {
            console.error("autosave failed", err);
          }

          console.log("History replaced at index:", historyIndexRef.current);
        } catch (err) {
          console.error("Failed to replace history:", err);
        }
      },
      setVisible: (layerId: string, visible: boolean) => {
        const canvas = canvasRef.current!;

        // 🔥 找到實際物件（image 或 textbox）
        const obj = (canvas.getObjects() as FabricObject[]).find(
          (o) => (o as FabricObject).data?.id === layerId
        );

        if (obj) {
          obj.visible = visible;
          obj.evented = visible; // 🔥 圖片物件本身也要關閉事件

          // 🔥 找到 proxy（如果有）
          const proxy = (canvas.getObjects() as FabricObject[]).find(
            (o) => (o as FabricObject).data?.proxyTag === `__proxy_${layerId}`
          );
          if (proxy) {
            proxy.visible = visible;
            proxy.evented = visible;
          }

          canvas.requestRenderAll();
        }
      },

      reorderTopToBottom: (idsTopToBottom: string[]) => {
        const canvas = canvasRef.current!;
        const all = getObjectsNoBgImagesOnly();
        const map = new Map(
          all.map((o) => [
            (o as unknown as { data?: { id?: string } }).data?.id as string,
            o,
          ])
        );

        const ordered = idsTopToBottom
          .map((id) => map.get(id))
          .filter(Boolean) as FabricObject[];

        ordered.reverse();

        // 🔥 新增：同時收集對應的 proxy
        const orderedPairs: { img: FabricObject; proxy?: FabricObject }[] = [];
        ordered.forEach((img) => {
          const id = (img as FabricObject).data?.id;
          const proxyTag = `__proxy_${id}`;
          const proxy = (canvas.getObjects() as FabricObject[]).find(
            (o) => (o as FabricObject).data?.proxyTag === proxyTag
          );
          orderedPairs.push({ img, proxy });
        });

        // 移除所有
        orderedPairs.forEach(({ img, proxy }) => {
          canvas.remove(img);
          if (proxy) canvas.remove(proxy);
        });

        // 🔥 按照正確順序重新添加：先 image，再 proxy
        orderedPairs.forEach(({ img, proxy }) => {
          canvas.add(img);
          if (proxy) canvas.add(proxy);
        });

        const bg = bgRef.current as fabric.FabricImage | null;
        if (bg) canvas.sendObjectToBack(bg);

        canvas.requestRenderAll();
        saveToHistory(canvas);
      },

      getZoom: () => Math.round((canvasRef.current?.getZoom() ?? 1) * 100),

      setZoom: (nextPercent: number) => {
        const canvas = canvasRef.current!;
        const z = clamp(nextPercent, 25, 400) / 100;
        const center = new fabric.Point(
          canvas.getWidth()! / 2,
          canvas.getHeight()! / 2
        );
        pauseDrawing(canvas);
        canvas.zoomToPoint(center, z);
        zoomChangeRef.current?.(Math.round(z * 100));
        canvas.requestRenderAll();
        resumeDrawingIfNeeded(canvas);
      },

      resetView: () => {
        const canvas = canvasRef.current!;
        pauseDrawing(canvas);
        resetView(canvas);
        resumeDrawingIfNeeded(canvas);
        zoomChangeRef.current?.(100);
      },

      setBackgroundVisible: (visible: boolean) => {
        setBgVisible(visible);
        const bg = bgRef.current as fabric.FabricImage | null;
        if (bg && canvasRef.current) {
          (bg as unknown as { visible?: boolean }).visible = visible;
          canvasRef.current.requestRenderAll();
        }
      },

      // 替換 FabricStage.api.toDataURL 的 artboard 分支
      //   toDataURL: (type = "image/png", quality = 0.92) => {
      //     const canvas = canvasRef.current;
      //     if (!canvas) return "";

      //     const artboard = artboardRef.current;
      //     const dpr = window.devicePixelRatio || 1;

      //     const activeObj = canvas.getActiveObject();
      //     const hasSelection = !!activeObj && activeObj !== bgRef.current;

      //     if (!hasSelection && artboard) {
      //       const ax = artboard.left! - artboard.width! / 2;
      //       const ay = artboard.top! - artboard.height! / 2;
      //       const aw = artboard.width!;
      //       const ah = artboard.height!;

      //       // 暫時關閉 retina 與縮放
      //       const savedVpt = canvas.viewportTransform!.slice() as TMat2D;
      //       const savedZoom = canvas.getZoom();

      //       canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      //       canvas.setZoom(1);
      //       const el = canvas.getElement() as HTMLCanvasElement;

      //       // 以 dpr 輸出，避免鋸齒
      //       const out = document.createElement("canvas");
      //       out.width = Math.round(aw * dpr);
      //       out.height = Math.round(ah * dpr);
      //       const octx = out.getContext("2d")!;
      //       octx.setTransform(dpr, 0, 0, dpr, -ax * dpr, -ay * dpr);
      //       octx.drawImage(el, 0, 0);

      //       // 還原
      //       canvas.setViewportTransform(savedVpt);
      //       canvas.setZoom(savedZoom);
      //       canvas.renderAll();

      //       return out.toDataURL(type, quality);
      //     }

      //     return (canvas.getElement() as HTMLCanvasElement).toDataURL(
      //       type,
      //       quality
      //     );
      //   },
      toDataURL: (type = "image/png", quality = 0.92) => {
        const canvas = canvasRef.current;
        if (!canvas) return "";

        const artboard = artboardRef.current;
        const activeObj = canvas.getActiveObject();
        const hasSelection = !!activeObj && activeObj !== bgRef.current;

        if (!hasSelection && artboard) {
          const ax = artboard.left! - artboard.width! / 2;
          const ay = artboard.top! - artboard.height! / 2;
          const aw = artboard.width!;
          const ah = artboard.height!;
          const dpr = window.devicePixelRatio || 1;

          // 直接用 Fabric 內建的截取：left/top/width/height + multiplier
          return canvas.toDataURL({
            format: type === "image/jpeg" ? "jpeg" : "png",
            quality,
            left: ax,
            top: ay,
            width: aw,
            height: ah,
            multiplier: dpr, // 取代你手動做的 out canvas + setTransform
            enableRetinaScaling: false, // 避免 Fabric 自己再乘一次 DPR
            // backgroundColor: '#fff',  // 需要白底再開
          });
        }

        // 其餘維持舊行為：整張輸出
        return (canvas.getElement() as HTMLCanvasElement).toDataURL(
          type,
          quality
        );
      },

      setBrushMode: (enabled: boolean) => {
        const canvas = canvasRef.current!;
        if (enabled) {
          eraserModeRef.current = false;
          brushArmedRef.current = true;
          brushModeRef.current = true;

          canvas.isDrawingMode = true;
          const brush = canvas.freeDrawingBrush as fabric.PencilBrush;
          brush.color = "rgba(0,0,0,0)";
          brush.width = brush.width || 20;

          // 🔥 修正：先從當前選中物件找
          let targetImg = activeLayerRef.current;

          if (!targetImg) {
            const active = canvas.getActiveObject();
            if (active && active.type === "rect") {
              const hostId = (active as FabricObject).data?.hostId;
              if (hostId) {
                const found = (canvas.getObjects() as FabricObject[]).find(
                  (o) =>
                    o.type === "image" &&
                    (o as FabricObject).data?.id === hostId
                );
                targetImg = found ? (found as fabric.FabricImage) : null; // 🔥 改這裡
              }
            }
          }

          activeLayerRef.current = targetImg ?? null;

          if (activeLayerRef.current) {
            enterLockedBrushLike(canvas, activeLayerRef.current);
          }
        } else {
          exitAllDraw(canvas, true);
        }
      },
      setBrushSize: (size: number) => {
        const canvas = canvasRef.current!;
        if (canvas.freeDrawingBrush) {
          const limit = (v: number, a: number, b: number) =>
            Math.min(Math.max(v, a), b);
          canvas.freeDrawingBrush.width = limit(size, 1, 200);
          // 🔥 更新游標
          if (brushModeRef.current && canvas.isDrawingMode) {
            const zoom = canvas.getZoom();
            const displaySize = canvas.freeDrawingBrush.width * zoom;
            canvas.freeDrawingCursor = `url(${getDrawCursor(
              displaySize,
              "#000000"
            )}) ${displaySize / 2} ${displaySize / 2}, crosshair`;
          }
        }
      },

      mergeLayers: async (ids: string[]) => {
        if (ids.length < 2) return null;
        const canvas = canvasRef.current!;
        const objects = getObjectsNoBgImagesOnly().filter((o) => {
          const oid = (o as unknown as { data?: { id?: string } }).data?.id;
          return typeof oid === "string" && ids.includes(oid);
        });
        if (objects.length < 2) return null;

        try {
          let minLeft = Infinity,
            minTop = Infinity;
          let maxRight = -Infinity,
            maxBottom = -Infinity;

          objects.forEach((obj) => {
            const bound = obj.getBoundingRect();
            minLeft = Math.min(minLeft, bound.left);
            minTop = Math.min(minTop, bound.top);
            maxRight = Math.max(maxRight, bound.left + bound.width);
            maxBottom = Math.max(maxBottom, bound.top + bound.height);
          });

          const boundWidth = maxRight - minLeft;
          const boundHeight = maxBottom - minTop;

          const ctx = getOffscreenCtx(
            Math.max(1, Math.round(boundWidth)),
            Math.max(1, Math.round(boundHeight))
          );
          if (!ctx || !__offscreen) return null;

          const w = Math.max(1, Math.round(boundWidth));
          const h = Math.max(1, Math.round(boundHeight));
          __offscreen.width = w;
          __offscreen.height = h;
          ctx.clearRect(0, 0, w, h);

          const allObjects = canvas.getObjects();
          const orderedObjects = objects.sort(
            (a, b) => allObjects.indexOf(a) - allObjects.indexOf(b)
          );

          for (const obj of orderedObjects) {
            if (!obj.visible) continue;

            const objDataURL = obj.toDataURL({ format: "png", multiplier: 1 });
            const tmpImg = await new Promise<HTMLImageElement>(
              (resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = objDataURL;
              }
            );

            const bound = obj.getBoundingRect();
            const x = Math.round(bound.left - minLeft);
            const y = Math.round(bound.top - minTop);
            ctx.drawImage(
              tmpImg,
              x,
              y,
              Math.round(bound.width),
              Math.round(bound.height)
            );
          }

          const mergedDataURL = __offscreen.toDataURL("image/png");

          const names = objects
            .map(
              (o) => (o as unknown as { data?: { name?: string } }).data?.name
            )
            .filter(Boolean)
            .join(" + ");

          objects.forEach((obj) => {
            const oldId =
              (obj as unknown as { data?: { id?: string } }).data?.id || null;
            if (oldId) {
              LAYER_BASE_PIXEL.delete(oldId);
              LAYER_MASK_CANVAS.delete(oldId);
              LAYER_IMG_CACHE.delete(oldId);
              LAYER_HAS_BRUSH.delete(oldId);
              LAYER_MASK_NONWHITE.delete(oldId);
              LAYER_USER_DRAWN.delete(oldId);
            }
            canvas.remove(obj);
          });

          const mergedImg = await fabric.FabricImage.fromURL(mergedDataURL);

          const centerX = minLeft + boundWidth / 2;
          const centerY = minTop + boundHeight / 2;

          mergedImg.set({
            left: centerX,
            top: centerY,
            originX: "center",
            originY: "center",
            scaleX: 1,
            scaleY: 1,
          });

          const newId = genId();
          const t = await thumbOf(mergedImg);
          (mergedImg as unknown as { data?: Record<string, unknown> }).data = {
            id: newId,
            name: names ? `Merged: ${names}` : "Merged Layer",
            thumb: t,
            originBase: mergedDataURL,
            isPending: false,
          };

          mergedImg.objectCaching = true;
          (mergedImg as unknown as { noScaleCache?: boolean }).noScaleCache =
            false;

          const mergedEl = mergedImg.getElement() as HTMLImageElement;
          if (mergedEl?.src)
            IMG_DATAURL_CACHE_URL.set(mergedEl.src, mergedDataURL);

          canvas.add(mergedImg);
          canvas.setActiveObject(mergedImg);
          updateActiveLayerRefFromCanvas(canvas);
          canvas.requestRenderAll();

          LAYER_BASE_PIXEL.set(newId, mergedDataURL);
          const mask = document.createElement("canvas");
          const tmp = await loadImage(mergedDataURL);
          mask.width = tmp.naturalWidth || tmp.width;
          mask.height = tmp.naturalHeight || tmp.height;
          const mctx = mask.getContext("2d")!;
          mctx.fillStyle = "#ffffff";
          mctx.fillRect(0, 0, mask.width, mask.height);
          LAYER_HAS_BRUSH.delete(newId);
          LAYER_MASK_NONWHITE.delete(newId);

          saveToHistory(canvas);

          if (
            (brushArmedRef.current || eraserModeRef.current) &&
            activeLayerRef.current
          ) {
            enterLockedBrushLike(canvas, activeLayerRef.current);
          }

          return { id: newId };
        } catch (error) {
          console.error("合併圖層失敗:", error);
          return null;
        }
      },

      setEraserMode: (enabled: boolean) => {
        const canvas = canvasRef.current!;
        if (enabled) {
          // 🔥 橡皮擦的正確設置
          brushArmedRef.current = false; // 改這行
          brushModeRef.current = false; // 改這行
          eraserModeRef.current = true; // 改這行

          canvas.isDrawingMode = true;
          const brush = canvas.freeDrawingBrush as fabric.PencilBrush;
          brush.color = "rgba(0,0,0,0)";
          brush.width = eraserSizeRef.current; // 🔥 改這行：用橡皮擦的尺寸

          // 🔥 修正：先從當前選中物件找
          let targetImg = activeLayerRef.current;

          if (!targetImg) {
            const active = canvas.getActiveObject();
            if (active && active.type === "rect") {
              const hostId = (active as FabricObject).data?.hostId;
              if (hostId) {
                const found = (canvas.getObjects() as FabricObject[]).find(
                  (o) =>
                    o.type === "image" &&
                    (o as FabricObject).data?.id === hostId
                );
                targetImg = found ? (found as fabric.FabricImage) : null;
              }
            }
          }

          activeLayerRef.current = targetImg ?? null;

          if (activeLayerRef.current) {
            enterLockedBrushLike(canvas, activeLayerRef.current);
          }
        } else {
          exitAllDraw(canvas, true);
        }
      },
      setEraserSize: (size: number) => {
        eraserSizeRef.current = Math.min(Math.max(size, 1), 300);
        const canvas = canvasRef.current!;
        if (eraserModeRef.current && canvas.freeDrawingBrush) {
          (canvas.freeDrawingBrush as fabric.PencilBrush).width =
            eraserSizeRef.current;

          // 🔥 更新游標
          if (canvas.isDrawingMode) {
            const zoom = canvas.getZoom();
            const displaySize = eraserSizeRef.current * zoom;
            canvas.freeDrawingCursor = `url(${getDrawCursor(
              displaySize,
              "#ff0000"
            )}) ${displaySize / 2} ${displaySize / 2}, crosshair`;
          }
        }
      },
      setEraserAction: (action: "erase" | "restore") => {
        eraserRestoreRef.current = action === "restore";
      },

      snapshotMask: (layerId: string) => {
        const m = LAYER_MASK_CANVAS.get(layerId);
        return m ? m.toDataURL("image/png") : "";
      },

      restoreMaskFromSnapshot: async (layerId: string, dataURL: string) => {
        if (!dataURL) return;
        const m = document.createElement("canvas");
        const t = await loadImage(dataURL);
        m.width = t.naturalWidth || t.width;
        m.height = t.naturalHeight || t.height;
        m.getContext("2d")!.drawImage(t, 0, 0, m.width, m.height);
        LAYER_MASK_CANVAS.set(layerId, m);
        composeToView(layerId);

        const canvas = canvasRef.current!;
        const obj = getObjectsNoBgImagesOnly().find(
          (o) =>
            (o as unknown as { data?: { id?: string } }).data?.id === layerId
        ) as fabric.FabricImage | undefined;
        if (obj) {
          obj.dirty = true;
          canvas.requestRenderAll();
          canvas.fire("object:modified", {
            target: obj,
          } as ModifiedEvent<TPointerEvent> | undefined);
        }
      },

      exportLayerAsAlphaPng: async (layerId: string) => {
        const base = LAYER_BASE_CANVAS.get(layerId);
        if (!base) return null;
        const w = base.width;
        const h = base.height;
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const ctx = off.getContext("2d")!;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(base, 0, 0);

        const mask = LAYER_MASK_CANVAS.get(layerId);
        if (mask) {
          const out = ctx.getImageData(0, 0, w, h);
          const od = out.data;
          const md = mask.getContext("2d")!.getImageData(0, 0, w, h).data;
          for (let i = 0; i < od.length; i += 4) {
            const r = md[i];
            od[i + 3] = Math.round((od[i + 3] * r) / 255);
          }
          ctx.putImageData(out, 0, 0);
        }
        return off.toDataURL("image/png");
      },
      exportLayerCroppedPng: async (
        layerId: string,
        canvas: fabric.Canvas,
        opts?: { original?: boolean }
      ): Promise<string | null> => {
        const objs = canvas.getObjects() as FabricObject[];

        // ==========================================
        // 1. 文字圖層處理邏輯
        // ==========================================
        const textObj = objs.find(
          (o) =>
            o.type === "textbox" &&
            (o as FabricObject).data?.id === layerId &&
            o.data?.isText
        ) as fabric.Textbox | undefined;

        if (textObj) {
          try {
            // 找到對應的 proxy rect 取得裁切尺寸
            const proxyTag = `__proxy_${layerId}`;
            const proxy = objs.find(
              (o) => (o as FabricObject).data?.proxyTag === proxyTag
            ) as fabric.Rect | undefined;

            let outputW: number, outputH: number;

            if (proxy) {
              outputW = proxy.width || textObj.width || 100;
              outputH = proxy.height || textObj.height || 50;
            } else {
              const currentScale = textObj.scaleX || 1;
              outputW = (textObj.width || 100) * currentScale;
              outputH = (textObj.height || 50) * currentScale;
            }

            const off = document.createElement("canvas");
            off.width = Math.round(outputW);
            off.height = Math.round(outputH);
            const ctx = off.getContext("2d")!;
            ctx.clearRect(0, 0, off.width, off.height);

            const wasVisible = textObj.visible;
            textObj.visible = true;

            const tempCanvas = new fabric.Canvas(undefined, {
              width: off.width,
              height: off.height,
            });

            const cloned = await textObj.clone();
            cloned.set({
              left: off.width / 2,
              top: off.height / 2,
              originX: "center",
              originY: "center",
              angle: 0, 
            });
            tempCanvas.add(cloned);
            tempCanvas.renderAll();

            const dataUrl = tempCanvas.toDataURL({
              format: "png",
              multiplier: 1,
            });

            textObj.visible = wasVisible;
            tempCanvas.dispose();

            return dataUrl || null;
          } catch (err) {
            console.error("文字圖層匯出失敗:", err);
            return null;
          }
        }

        // ==========================================
        // 2. 圖片圖層處理邏輯
        // ==========================================
        const img = objs.find(
          (o) => o.type === "image" && (o as FabricObject).data?.id === layerId
        ) as fabric.FabricImage | undefined;

        // 決定使用哪張底圖 (Clean Base 還是 Current Canvas)
        let base: HTMLCanvasElement | null = null;

        if (opts?.original) {
          // ⭐️ 情況 A: 要原始圖 -> 找 CLEAN_BASE
          const cleanUrl = LAYER_CLEAN_BASE.get(layerId);
          if (cleanUrl) {
            const cleanImg = await loadImage(cleanUrl);
            base = document.createElement("canvas");
            base.width = cleanImg.naturalWidth || cleanImg.width;
            base.height = cleanImg.naturalHeight || cleanImg.height;
            base.getContext("2d")!.drawImage(cleanImg, 0, 0);
          } else {
            base = LAYER_BASE_CANVAS.get(layerId) || null;
          }
        } else {
          // ⭐️ 情況 B: 要目前效果 -> 找 BASE_CANVAS
          base = LAYER_BASE_CANVAS.get(layerId) || null;
        }

        if (!base) return null;

        // 如果找不到 Fabric Object (可能被刪除)，直接回傳整張 base
        if (!img) {
          return base.toDataURL("image/png");
        }

        // --- 計算裁切區域 (World Coordinates) ---
        let cx: number, cy: number, w: number, h: number, ang: number;

        if (img.clipPath instanceof fabric.Rect) {
          const cp = img.clipPath as fabric.Rect;
          cx = cp.left ?? img.left ?? 0;
          cy = cp.top ?? img.top ?? 0;
          w = Math.max(1, cp.width ?? base.width);
          h = Math.max(1, cp.height ?? base.height);
          ang = cp.angle ?? img.angle ?? 0;
        } else {
          const f =
            ((img as FabricImage).data?.frame as
              | { left?: number; top?: number; w?: number; h?: number; angle?: number }
              | undefined) || {};
          if (typeof f.w === "number" && typeof f.h === "number") {
            cx = f.left ?? img.left ?? 0;
            cy = f.top ?? img.top ?? 0;
            w = Math.max(1, f.w);
            h = Math.max(1, f.h);
            ang = f.angle ?? img.angle ?? 0;
          } else {
            const bb = getAABBInWorld(img);
            cx = bb.x + bb.width / 2;
            cy = bb.y + bb.height / 2;
            w = Math.max(1, bb.width);
            h = Math.max(1, bb.height);
            ang = img.angle ?? 0;
          }
        }

        const rad = (ang * Math.PI) / 180;
        const halfW = w / 2;
        const halfH = h / 2;

        const localCorners = [
          new fabric.Point(-halfW, -halfH),
          new fabric.Point(halfW, -halfH),
          new fabric.Point(halfW, halfH),
          new fabric.Point(-halfW, halfH),
        ];

        const worldCorners = localCorners.map((p) => {
          const x = p.x * Math.cos(rad) - p.y * Math.sin(rad) + cx;
          const y = p.x * Math.sin(rad) + p.y * Math.cos(rad) + cy;
          return new fabric.Point(x, y);
        });

        const imgSpace = worldCorners.map((pt) =>
          canvasPointToImagePixel(img, pt)
        );

        let minPx = Math.min(...imgSpace.map((c) => c.px));
        let maxPx = Math.max(...imgSpace.map((c) => c.px));
        let minPy = Math.min(...imgSpace.map((c) => c.py));
        let maxPy = Math.max(...imgSpace.map((c) => c.py));

        const W = base.width;
        const H = base.height;

        minPx = Math.max(0, Math.min(W, minPx));
        maxPx = Math.max(0, Math.min(W, maxPx));
        minPy = Math.max(0, Math.min(H, minPy));
        maxPy = Math.max(0, Math.min(H, maxPy));

        const cropW = Math.round(maxPx - minPx);
        const cropH = Math.round(maxPy - minPy);

        if (!isFinite(cropW) || !isFinite(cropH) || cropW <= 0 || cropH <= 0) {
          return base.toDataURL("image/png");
        }

        const sx = Math.round(minPx);
        const sy = Math.round(minPy);

        // --- 建立輸出 Canvas ---
        const off = document.createElement("canvas");
        off.width = cropW;
        off.height = cropH;
        const ctx = off.getContext("2d")!;
        ctx.clearRect(0, 0, cropW, cropH);

        // 1. 先畫上底圖 (可能是 Clean 或 Current)
        ctx.drawImage(base, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

        // 🔥 [修正點] 
        // 這裡原本有一段無條件執行的 Mask 邏輯，我已經刪掉了。
        // 現在只有下面這一段，會檢查 !opts.original

        if (!opts?.original) {
          const mask = LAYER_MASK_CANVAS.get(layerId);
          if (mask) {
            const mctx = mask.getContext("2d")!;
            try {
              const maskImg = mctx.getImageData(sx, sy, cropW, cropH);
              const md = maskImg.data;
      
              const outImg = ctx.getImageData(0, 0, cropW, cropH);
              const od = outImg.data;
      
              for (let i = 0; i < od.length; i += 4) {
                // 假設遮罩是灰階 (R=值)，如果是 Alpha 遮罩請改用 md[i+3]
                const a = md[i];
                // 套用遮罩透明度
                od[i + 3] = Math.round((od[i + 3] * a) / 255);
              }
      
              ctx.putImageData(outImg, 0, 0);
            } catch (e) {
              console.error("apply mask in exportLayerCroppedPng 失敗:", e);
            }
          }
        }
      
        return off.toDataURL("image/png");
      },

      undo: async () => {
        const canvas = canvasRef.current!;

        if (isUndoRedoingRef.current) {
          console.log("Undo blocked: already in progress");
          return false;
        }

        if (api.canUndo() === false) {
          console.log("Undo blocked by isolation");
          return false;
        }

        isUndoRedoingRef.current = true;

        try {
          const currentIndex = historyIndexRef.current;
          console.log("🔥 Undo currentIndex:", currentIndex);
          console.log(
            "🔥 ACTIVE_JOBS:",
            Array.from(ACTIVE_JOBS.entries()).map(([id, job]) => ({
              jobId: id,
              layerId: job.layerId,
              historyIndex: job.historyIndex,
              cancelled: job.cancelled,
            }))
          );

          ACTIVE_JOBS.forEach((job, jobId) => {
            console.log(
              `🔥 比較: job.historyIndex(${
                job.historyIndex
              }) >= currentIndex(${currentIndex}) = ${
                job.historyIndex >= currentIndex
              }`
            );
            if (!job.cancelled && job.historyIndex >= currentIndex) {
              console.log(`[Undo] Cancelling job ${jobId}`);
              job.cancelled = true;
              VOID_JOBS.add(jobId);
            }
          });

          if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
            await applySnapshot(
              canvas,
              historyRef.current[historyIndexRef.current]
            );
            return true;
          }
          return false;
        } finally {
          isUndoRedoingRef.current = false;
        }
      },

      redo: async () => {
        const canvas = canvasRef.current!;

        if (isUndoRedoingRef.current) {
          console.log("Redo blocked: already in progress");
          return false;
        }

        isUndoRedoingRef.current = true;

        try {
          if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current++;
            await applySnapshot(
              canvas,
              historyRef.current[historyIndexRef.current]
            );
            return true;
          }
          return false;
        } finally {
          isUndoRedoingRef.current = false;
        }
      },

      canUndo: () => {
        const isolation = historyIsolationIndexRef.current;
        // 如果有隔離(isolation != -1)，必須大於隔離點；否則只要大於 0
        if (isolation !== -1) {
          return historyIndexRef.current > isolation;
        }
        return historyIndexRef.current > 0;
      },
      canRedo: () => historyIndexRef.current < historyRef.current.length - 1,
      saveHistory: () => {
        const canvas = canvasRef.current!;
        saveToHistory(canvas);
      },

      // 🔥 核心新增：Job 管理
      startAIJob: (layerId: string, jobId: string) => {
        console.log(`[Job] Starting job ${jobId} for layer ${layerId}`);
        ACTIVE_JOBS.set(jobId, {
          layerId,
          cancelled: false,
          historyIndex: historyRef.current.length, // 🔥 改成這個
        });
        VOID_JOBS.delete(jobId);
      },

      cancelAIJob: (jobId: string) => {
        const job = ACTIVE_JOBS.get(jobId);
        if (job) {
          console.log(`[Job] Cancelling job ${jobId}`);
          job.cancelled = true;
          VOID_JOBS.add(jobId);
        }
      },

      completeAIJob: (jobId: string, success: boolean) => {
        console.log(`[Job] Completing job ${jobId}, success: ${success}`);
        ACTIVE_JOBS.delete(jobId);
        if (!success) {
          VOID_JOBS.add(jobId);
        }
      },

      isJobValid: (jobId: string) => {
        if (VOID_JOBS.has(jobId)) {
          console.log(`[Job] Job ${jobId} is voided`);
          return false;
        }
        const job = ACTIVE_JOBS.get(jobId);
        if (job?.cancelled) {
          console.log(`[Job] Job ${jobId} is cancelled`);
          return false;
        }
        return true;
      },

      getSelectedLayersTransform: (ids: string[]) => {
        const canvas = canvasRef.current;
        if (!canvas || !ids || ids.length === 0) return [];

        const all = canvas.getObjects() as FabricObject[];
        const selected = all
          .map((obj, index) => ({ obj, index }))
          .filter(({ obj }) => {
            const isBg = obj === bgRef.current;
            const idMaybe = obj.data?.id;
            const id = typeof idMaybe === "string" ? idMaybe : null;
            return !isBg && !!id && ids.includes(id);
          });

        if (selected.length === 0) return [];

        // 整體 bounds（跟原本一樣）
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        for (const { obj } of selected) {
          const bb = getAABBInWorld(obj);
          minX = Math.min(minX, bb.x);
          minY = Math.min(minY, bb.y);
          maxX = Math.max(maxX, bb.x + bb.width);
          maxY = Math.max(maxY, bb.y + bb.height);
        }

        const overallBounds = {
          left: minX,
          top: minY,
          width: Math.max(0, Math.round(maxX - minX)),
          height: Math.max(0, Math.round(maxY - minY)),
        };

        // ⭐ 關鍵：這裡對文字特別處理
        return selected.map(({ obj, index }) => {
          const anyObj = obj as FabricObject;
          const anyData = anyObj.data as
            | { id?: string; name?: string; isText?: boolean }
            | undefined;

          const layerId = anyData?.id ?? `layer-${index}`;
          const bb = getAABBInWorld(obj);

          // 先用一般物件的邏輯
          let width = Math.round(anyObj.width || 0);
          let height = Math.round(anyObj.height || 0);
          let scaleX = anyObj.scaleX || 1;
          let scaleY = anyObj.scaleY || 1;

          // 🔥 文字圖層：把 scale 吸收進尺寸裡，讓 Compositor 覺得「原圖就是 AABB 尺寸」
          if (
            (anyObj.type === "textbox" || anyObj.type === "i-text") &&
            anyData?.isText
          ) {
            width = Math.max(1, Math.round(bb.width)); // PNG 實際寬
            height = Math.max(1, Math.round(bb.height)); // PNG 實際高
            scaleX = 1;
            scaleY = 1;
          }

          return {
            id: layerId,
            name: anyData?.name || `圖層 ${index}`,
            type: anyObj?.type,
            transform: {
              x: Math.round(anyObj.left || 0),
              y: Math.round(anyObj.top || 0),
              width,
              height,
              scaleX,
              scaleY,
              angle: anyObj.angle || 0,
              flipX: anyObj.flipX || false,
              flipY: anyObj.flipY || false,
            },
            clipPath: anyObj.clipPath as FabricObject,
            boundingBox: bb,
            fabricIndex: index,
            overallBounds,
          };
        });
      },

      getCanvas: () => canvasRef.current,
      getHistoryIndex: () => historyIndexRef.current,

      clearResidualDraw: () => {
        const canvas = canvasRef.current!;
        nukeTopOverlay(canvas);
        canvas.requestRenderAll();
      },

      clearCurrentBrushStrokes: async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        nukeTopOverlay(canvas);

        if (drawingSessionRef.current) {
          const { layerId, baseSnapshot } = drawingSessionRef.current;
          if (baseSnapshot) {
            const baseC = LAYER_BASE_CANVAS.get(layerId);
            if (baseC) {
              const img = await loadImage(baseSnapshot);
              baseC
                .getContext("2d")!
                .clearRect(0, 0, baseC.width, baseC.height);
              baseC.getContext("2d")!.drawImage(img, 0, 0);
              composeToView(layerId);
              const obj = getObjectsNoBgImagesOnly().find((o) => {
                const oid = (o as unknown as { data?: { id?: string } }).data
                  ?.id;
                return oid === layerId;
              }) as fabric.FabricImage | undefined;
              if (obj) {
                obj.dirty = true;
              }
            }
          }
          drawingSessionRef.current = null;
        }

        currentDrawingPathsRef.current = [];
        canvas.requestRenderAll();
      },

      exitDrawingMode: (keepSelection = true) => {
        const canvas = canvasRef.current!;
        exitAllDraw(canvas, keepSelection);
      },

      // 🔥 核心修正：setLayerPending 標記 isPending
      setLayerPending: (id, pending, jobId) => {
        const canvas = canvasRef.current!;
        const target = (canvas.getObjects() as FabricObject[]).find(
          (o) => (o as FabricObject)?.data?.id === id
        );
        if (!target) return;

        (target as FabricObject).opacity = pending ? 0.6 : 1;

        // 🔥 標記為 pending
        const data =
          (target as unknown as { data?: Record<string, unknown> }).data || {};
        (target as unknown as { data?: Record<string, unknown> }).data = {
          ...data,
          isPending: pending,
          jobId: jobId || data.jobId,
        };

        const flag = `__pending_${id}`;

        (canvas.getObjects() as FabricObject[])
          .filter(
            (o) =>
              (o as unknown as { data?: { pendingFlag?: string } }).data
                ?.pendingFlag === flag
          )
          .forEach((o) => canvas.remove(o));

        canvas.requestRenderAll();
      },

      getLayerOriginalSize: (id) => {
        const base = LAYER_BASE_CANVAS.get(id);
        if (!base) return null;
        return { width: base.width, height: base.height };
      },

      setLayerImageFromUrlPreserveWorldSize: async (layerId, newUrl, opts) => {
        const canvas = canvasRef.current;
        if (!canvas) return false;
      
        if (opts?.jobId && !api.isJobValid(opts.jobId)) {
          console.log(
            `[setLayerImage] Job ${opts.jobId} is invalid, skipping update`
          );
          return false;
        }
      
        const obj = (canvas.getObjects() as FabricObject[]).find(
          (o) => (o as FabricObject).data?.id === layerId
        );
      
        if (!obj) return false;
      
        // 🔥 如果是文字圖層，轉換成圖片圖層
        if (obj.type === "textbox" && obj.data?.isText) {
          console.log("Converting text layer to image layer");


          const textObj = obj as fabric.Textbox;
          const prevData = (textObj as FabricObject).data ?? {};
          const layerName = prevData.name || "文字圖層";

          // 🔥 找到對應的 proxy
          const proxyTag = `__proxy_${layerId}`;
          const textProxy = (canvas.getObjects() as FabricObject[]).find(
            (o) => (o as FabricObject).data?.proxyTag === proxyTag
          ) as fabric.Rect | undefined;

          if (!textProxy) {
            console.error("找不到文字 proxy");
            return false;
          }

          // 🔥 記錄 proxy 的完整狀態
          const proxyLeft = textProxy.left ?? 0;
          const proxyTop = textProxy.top ?? 0;
          const proxyWidth = textProxy.width ?? 100;
          const proxyHeight = textProxy.height ?? 50;
          const proxyAngle = textProxy.angle ?? 0;

          // 載入新圖片
          const el = await loadImage(newUrl);
          const w = el.naturalWidth || el.width;
          const h = el.naturalHeight || el.height;

          // 🔥 建立所有必要的 canvas（參考 addImageLayer）
          const baseC = document.createElement("canvas");
          baseC.width = w;
          baseC.height = h;
          baseC.getContext("2d")!.drawImage(el, 0, 0);

          const maskC = document.createElement("canvas");
          maskC.width = w;
          maskC.height = h;
          const mctx = maskC.getContext("2d")!;
          mctx.fillStyle = "#ffffff";
          mctx.fillRect(0, 0, w, h);

          const viewC = document.createElement("canvas");
          viewC.width = w;
          viewC.height = h;

          LAYER_BASE_CANVAS.set(layerId, baseC);
          LAYER_MASK_CANVAS.set(layerId, maskC);
          LAYER_VIEW_CANVAS.set(layerId, viewC);
          LAYER_BASE_PIXEL.set(layerId, baseC.toDataURL("image/png"));
          LAYER_IMG_CACHE.set(layerId, baseC.toDataURL("image/png"));
          LAYER_CLEAN_BASE.set(layerId, baseC.toDataURL("image/png"));

          composeToView(layerId);

          // 🔥 創建新圖片（參考 addImageLayer）
          const img = new fabric.FabricImage(viewC);

          // 🔥 計算縮放：讓圖片的世界尺寸 = proxy 尺寸
          const s = Math.max(proxyWidth / w, proxyHeight / h);

          img.set({
            left: proxyLeft,
            top: proxyTop,
            originX: "center",
            originY: "center",
            scaleX: s,
            scaleY: s,
            angle: proxyAngle,
          });

          const origin = baseC.toDataURL("image/png");
          const t = await thumbOf(img);

          (img as FabricObject).data = {
            id: layerId,
            name: layerName,
            thumb: t,
            originBase: origin,
            isPending: false,
            type: "image",
            originalType: "textbox",
          };

          img.objectCaching = true;
          img.noScaleCache = false;
          img.setControlsVisibility({ mtr: true });
          img.lockScalingFlip = true;
          img.hasControls = true;
          img.hasBorders = true;

          // 找到文字物件的索引
          const textIndex = canvas.getObjects().indexOf(textObj);

          // 移除舊物件
          canvas.remove(textObj);
          if (textProxy) {
            if (textProxy.__cleanupEvents) {
              textProxy.__cleanupEvents();
            }
            canvas.remove(textProxy);
          }

          // 插入新圖片
          if (textIndex !== -1) {
            canvas.insertAt(textIndex, img);
          } else {
            canvas.add(img);
          }

          // 🔥 創建新 proxy（會自動計算正確位置）
          const proxy = api.ensureProxyRect(canvas, img);

          const imgIndex = canvas.getObjects().indexOf(img);
          const proxyIndex = canvas.getObjects().indexOf(proxy);
          if (imgIndex !== -1 && proxyIndex !== imgIndex + 1) {
            canvas.remove(proxy);
            canvas.insertAt(imgIndex + 1, proxy);
            syncProxyToImage(canvas, layerId, img)
          }

          // 清除 pending
          LAYER_HAS_BRUSH.delete(layerId);
          LAYER_MASK_NONWHITE.delete(layerId);

          img.opacity = 1;
          const flag = `__pending_${layerId}`;
          (canvas.getObjects() as FabricObject[])
            .filter((o) => (o as FabricObject).data?.pendingFlag === flag)
            .forEach((o) => canvas.remove(o));

          canvas.requestRenderAll();
          await twoFrames();

          if (!isRestoringRef.current) {
            saveToHistory(canvas);
          }

          return true;
        }
        // 🔥 以下是圖片圖層的邏輯
        const img = obj as fabric.FabricImage;
      
        const shouldSaveHistory = !isRestoringRef.current;
        if (pendingSaveRef.current !== null) {
          clearTimeout(pendingSaveRef.current);
          pendingSaveRef.current = null;
        }
      
        // 🔴 移除：原本在這裡讀取 left, top, scale 等屬性
        // 因為這時候還沒開始下載圖片，下載期間使用者可能會動圖片
      
        // ⏳ 等待圖片下載 (這段時間使用者可能會拖動圖片)
        const el = await loadImage(newUrl);
      
        // ✅ 修正：下載完成後，才讀取當前的狀態
        // 這樣就能抓到使用者「剛剛」拖曳到的新位置
        const currentLeft = img.left ?? 0;
        const currentTop = img.top ?? 0;
        const currentAngle = img.angle ?? 0;
        const currentOriginX = (img.originX ?? "center") as FabricOriginX;
        const currentOriginY = (img.originY ?? "center") as FabricOriginY;
        const currentFlipX = img.flipX ?? false;
        const currentFlipY = img.flipY ?? false;
      
        // ✅ 也重新計算當前的世界尺寸 (以防使用者在等待時縮放了圖片)
        const worldW = (img.width ?? 0) * (img.scaleX ?? 1);
        const worldH = (img.height ?? 0) * (img.scaleY ?? 1);
      
        const newW = el.naturalWidth || el.width;
        const newH = el.naturalHeight || el.height;
      
        const baseC =
          LAYER_BASE_CANVAS.get(layerId) || document.createElement("canvas");
        baseC.width = newW;
        baseC.height = newH;
        baseC.getContext("2d")!.clearRect(0, 0, newW, newH);
        baseC.getContext("2d")!.drawImage(el, 0, 0);
        LAYER_BASE_CANVAS.set(layerId, baseC);
      
        // if (!LAYER_HAS_BRUSH.has(layerId) || opts?.resetMask !== false) {
        //   LAYER_CLEAN_BASE.set(layerId, baseC.toDataURL("image/png"));
        // }
        LAYER_CLEAN_BASE.set(layerId, baseC.toDataURL("image/png"));
      
        if (!opts || opts.resetMask !== false) {
          const mask = document.createElement("canvas");
          mask.width = newW;
          mask.height = newH;
          const mctx = mask.getContext("2d")!;
          mctx.fillStyle = "#ffffff";
          mctx.fillRect(0, 0, newW, newH);
          LAYER_MASK_CANVAS.set(layerId, mask);
          LAYER_MASK_NONWHITE.delete(layerId);
        }
      
        let viewC = LAYER_VIEW_CANVAS.get(layerId);
        if (!viewC) {
          viewC = document.createElement("canvas");
          LAYER_VIEW_CANVAS.set(layerId, viewC);
        }
        viewC.width = newW;
        viewC.height = newH;
        composeToView(layerId);
      
        img.setElement(viewC);
        img.set({ width: newW, height: newH });
      
        const newScaleX = worldW / Math.max(1, newW);
        const newScaleY = worldH / Math.max(1, newH);
      
        img.set({
          scaleX: newScaleX,
          scaleY: newScaleY,
          left: currentLeft,   // ✅ 使用最新位置
          top: currentTop,     // ✅ 使用最新位置
          originX: currentOriginX,
          originY: currentOriginY,
          angle: currentAngle, // ✅ 使用最新角度
          flipX: currentFlipX,
          flipY: currentFlipY,
          dirty: true,
        });
        img.setCoords();
        syncProxyToImage(canvas, layerId, img)
        const base64 = baseC.toDataURL("image/png");
        LAYER_BASE_PIXEL.set(layerId, base64);
        LAYER_IMG_CACHE.set(layerId, base64);
        LAYER_HAS_BRUSH.delete(layerId);
        LAYER_USER_DRAWN.delete(layerId);
      
        const prevData = (img as FabricObject).data ?? {};
      
        (img as FabricObject).data = {
          ...prevData,
          originBase: base64,
          isPending: false,
          jobId: undefined,
        };
      
        img.opacity = 1;
        const flag = `__pending_${layerId}`;
        (canvas.getObjects() as FabricObject[])
          .filter((o) => (o as FabricObject).data?.pendingFlag === flag)
          .forEach((o) => canvas.remove(o));
      
        canvas.requestRenderAll();
      
        await twoFrames();
      
        if (shouldSaveHistory) {
          saveToHistory(canvas);
        }
      
        return true;
      },

      // 🔥 核心修正：檢查 jobId 有效性
      initMaskFromAlphaCutout: async (
        layerId: string,
        cutoutUrl: string,
        jobId?: string
      ) => {
        const base = LAYER_BASE_CANVAS.get(layerId);
        if (!base) return false;

        // 檢查 jobId
        if (jobId && !api.isJobValid(jobId)) {
          console.log(`[initMask] Job ${jobId} is invalid, skipping update`);
          return false;
        }

        const shouldSaveHistory = !isRestoringRef.current;
        if (pendingSaveRef.current !== null) {
          clearTimeout(pendingSaveRef.current);
          pendingSaveRef.current = null;
        }

        const cutoutImg = await loadImage(cutoutUrl);
        const w = base.width;
        const h = base.height;

        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = w;
        maskCanvas.height = h;
        const mctx = maskCanvas.getContext("2d")!;
        mctx.clearRect(0, 0, w, h);
        mctx.drawImage(cutoutImg, 0, 0, w, h);
        const cutData = mctx.getImageData(0, 0, w, h);
        const cd = cutData.data;
        for (let i = 0; i < cd.length; i += 4) {
          const a = cd[i + 3];
          cd[i + 0] = a;
          cd[i + 1] = 0;
          cd[i + 2] = 0;
          cd[i + 3] = 255;
        }
        mctx.putImageData(cutData, 0, 0);

        LAYER_MASK_CANVAS.set(layerId, maskCanvas);
        LAYER_MASK_NONWHITE.add(layerId);
        LAYER_USER_DRAWN.delete(layerId);

        composeToView(layerId);

        const canvas = canvasRef.current!;
        const obj = getObjectsNoBgImagesOnly().find(
          (o) =>
            (o as unknown as { data?: { id?: string } }).data?.id === layerId
        ) as fabric.FabricImage | undefined;
        if (obj) {
          // 🔥 清除 pending 狀態
          const prevData =
            (obj as unknown as { data?: Record<string, unknown> }).data ?? {};
          (obj as unknown as { data?: Record<string, unknown> }).data = {
            ...prevData,
            isPending: false,
            jobId: undefined,
          };

          obj.opacity = 1;
          const flag = `__pending_${layerId}`;
          (canvas.getObjects() as FabricObject[])
            .filter(
              (o) =>
                (o as unknown as { data?: { pendingFlag?: string } }).data
                  ?.pendingFlag === flag
            )
            .forEach((o) => canvas.remove(o));

          obj.dirty = true;
          syncProxyToImage(canvas, layerId, obj)
          canvas.requestRenderAll();
        }

        await twoFrames();

        if (shouldSaveHistory) {
          saveToHistory(canvas);
        }

        return true;
      },
      setLayerImageFromUrlWithUpscale: async (
        layerId: string,
        newUrl: string,
        opts?: { jobId?: string }
      ) => {
        const canvas = canvasRef.current;
        if (!canvas) return false;
      
        if (opts?.jobId && !api.isJobValid(opts.jobId)) {
          console.log(
            `[setLayerImageUpscale] Job ${opts.jobId} is invalid, skipping`
          );
          return false;
        }
      
        const obj = (canvas.getObjects() as FabricObject[]).find(
          (o) => (o as FabricObject).data?.id === layerId
        ) as fabric.FabricImage | undefined;
      
        if (!obj || obj.type !== "image") return false;
      
        const img = obj as fabric.FabricImage;
      
        const shouldSaveHistory = !isRestoringRef.current;
        if (pendingSaveRef.current !== null) {
          clearTimeout(pendingSaveRef.current);
          pendingSaveRef.current = null;
        }
      
        // ⏳ 等待圖片載入
        const el = await loadImage(newUrl);
      
        // ✅ 修正：下載完成後，才讀取當前狀態
        const currentLeft = img.left ?? 0;
        const currentTop = img.top ?? 0;
        const currentAngle = img.angle ?? 0;
        const currentOriginX = img.originX ?? "center";
        const currentOriginY = img.originY ?? "center";
        const currentFlipX = img.flipX ?? false;
        const currentFlipY = img.flipY ?? false;
      
        // ✅ 計算當前的世界尺寸 (以保持視覺大小不變)
        // 這裡使用 img.width (舊像素寬) * img.scaleX (舊縮放) = 當前世界寬
        const worldW = (img.width ?? 1) * (img.scaleX ?? 1);
        const worldH = (img.height ?? 1) * (img.scaleY ?? 1);
      
        const newPixelW = el.naturalWidth || el.width;
        const newPixelH = el.naturalHeight || el.height;
      
        // 更新 base canvas
        const baseC =
          LAYER_BASE_CANVAS.get(layerId) || document.createElement("canvas");
        baseC.width = newPixelW;
        baseC.height = newPixelH;
        baseC.getContext("2d")!.clearRect(0, 0, newPixelW, newPixelH);
        baseC.getContext("2d")!.drawImage(el, 0, 0);
        LAYER_BASE_CANVAS.set(layerId, baseC);
        LAYER_CLEAN_BASE.set(layerId, baseC.toDataURL("image/png"));
      
        // 更新 mask canvas（放大到新尺寸）
        const oldMask = LAYER_MASK_CANVAS.get(layerId);
        const maskC = document.createElement("canvas");
        maskC.width = newPixelW;
        maskC.height = newPixelH;
        const mctx = maskC.getContext("2d")!;
        if (oldMask) {
          // 把舊 mask 放大到新尺寸
          mctx.drawImage(oldMask, 0, 0, newPixelW, newPixelH);
        } else {
          mctx.fillStyle = "#ffffff";
          mctx.fillRect(0, 0, newPixelW, newPixelH);
        }
        LAYER_MASK_CANVAS.set(layerId, maskC);
      
        // 更新 view canvas
        let viewC = LAYER_VIEW_CANVAS.get(layerId);
        if (!viewC) {
          viewC = document.createElement("canvas");
          LAYER_VIEW_CANVAS.set(layerId, viewC);
        }
        viewC.width = newPixelW;
        viewC.height = newPixelH;
        composeToView(layerId);
      
        // 更新 Fabric 圖片
        img.setElement(viewC);
        img.set({ width: newPixelW, height: newPixelH });
      
        // 🔥 計算新的 scale（讓世界尺寸 = 原本大小，不放大）
        const newScaleX = worldW / newPixelW;
        const newScaleY = worldH / newPixelH;
      
        img.set({
          scaleX: newScaleX,
          scaleY: newScaleY,
          left: currentLeft,   // ✅ 最新位置
          top: currentTop,     // ✅ 最新位置
          originX: currentOriginX,
          originY: currentOriginY,
          angle: currentAngle, // ✅ 最新角度
          flipX: currentFlipX,
          flipY: currentFlipY,
          dirty: true,
        });
        img.setCoords();
        syncProxyToImage(canvas, layerId, img)
        // 更新快取
        const base64 = baseC.toDataURL("image/png");
        LAYER_BASE_PIXEL.set(layerId, base64);
        LAYER_IMG_CACHE.set(layerId, base64);
      
        // 清除 pending
        const prevData = (img as FabricObject).data ?? {};
        (img as FabricObject).data = {
          ...prevData,
          originBase: base64,
          isPending: false,
          jobId: undefined,
        };
      
        img.opacity = 1;
        const flag = `__pending_${layerId}`;
        (canvas.getObjects() as FabricObject[])
          .filter((o) => (o as FabricObject).data?.pendingFlag === flag)
          .forEach((o) => canvas.remove(o));
      
        canvas.requestRenderAll();
        await twoFrames();
      
        if (shouldSaveHistory) {
          saveToHistory(canvas);
        }
      
        return true;
      },
      // 🔥 核心修正：檢查 jobId 有效性
      setLayerImageFromUrlMatchPixelDensity: async (layerId, newUrl, opts) => {
        const canvas = canvasRef.current;
        if (!canvas) return false;

        // 檢查 jobId
        if (opts?.jobId && !api.isJobValid(opts.jobId)) {
          console.log(
            `[setLayerImageMatch] Job ${opts.jobId} is invalid, skipping update`
          );
          return false;
        }

        const img = (canvas.getObjects() as FabricObject[]).find(
          (o) =>
            (o as unknown as { data?: { id?: string } }).data?.id === layerId
        ) as fabric.FabricImage | undefined;
        if (!img) return false;

        const shouldSaveHistory = !isRestoringRef.current;
        if (pendingSaveRef.current !== null) {
          clearTimeout(pendingSaveRef.current);
          pendingSaveRef.current = null;
        }

        const left = img.left ?? 0;
        const top = img.top ?? 0;
        const originX = (img.originX ?? "center") as FabricOriginX;
        const originY = (img.originY ?? "center") as FabricOriginY;
        const angle = img.angle ?? 0;
        const flipX = img.flipX ?? false;
        const flipY = img.flipY ?? false;

        const worldW = (img.width ?? 0) * (img.scaleX ?? 1);
        const worldH = (img.height ?? 0) * (img.scaleY ?? 1);

        const oldBase = LAYER_BASE_CANVAS.get(layerId);
        const oldW = oldBase?.width ?? Math.max(1, Math.round(img.width ?? 1));
        const oldH =
          oldBase?.height ?? Math.max(1, Math.round(img.height ?? 1));

        const kX = worldW / Math.max(1, oldW);
        const kY = worldH / Math.max(1, oldH);
        const k = (kX + kY) / 2;

        const el = await loadImage(newUrl);
        const newW = el.naturalWidth || el.width;
        const newH = el.naturalHeight || el.height;

        const baseC =
          LAYER_BASE_CANVAS.get(layerId) || document.createElement("canvas");
        baseC.width = newW;
        baseC.height = newH;
        const bctx = baseC.getContext("2d")!;
        bctx.clearRect(0, 0, newW, newH);
        bctx.drawImage(el, 0, 0);
        LAYER_BASE_CANVAS.set(layerId, baseC);
        // if (!LAYER_HAS_BRUSH.has(layerId) || opts?.resetMask !== false) {
        //   LAYER_CLEAN_BASE.set(layerId, baseC.toDataURL("image/png"));
        // }
        LAYER_CLEAN_BASE.set(layerId, baseC.toDataURL("image/png"));

        if (!opts || opts.resetMask !== false) {
          const mask = document.createElement("canvas");
          mask.width = newW;
          mask.height = newH;
          const mctx = mask.getContext("2d")!;
          mctx.fillStyle = "#ffffff";
          mctx.fillRect(0, 0, newW, newH);
          LAYER_MASK_CANVAS.set(layerId, mask);
          LAYER_MASK_NONWHITE.delete(layerId);
        }

        let viewC = LAYER_VIEW_CANVAS.get(layerId);
        if (!viewC) {
          viewC = document.createElement("canvas");
          LAYER_VIEW_CANVAS.set(layerId, viewC);
        }
        viewC.width = newW;
        viewC.height = newH;
        composeToView(layerId);

        img.setElement(viewC);
        img.set({ width: newW, height: newH });

        const newScale = Math.max(0.00001, k);
        img.set({
          scaleX: newScale,
          scaleY: newScale,
          left,
          top,
          originX,
          originY,
          angle,
          flipX,
          flipY,
          dirty: true,
        });
        img.setCoords();
        syncProxyToImage(canvas, layerId, img)
        const base64 = baseC.toDataURL("image/png");
        LAYER_BASE_PIXEL.set(layerId, base64);
        LAYER_IMG_CACHE.set(layerId, base64);
        LAYER_HAS_BRUSH.delete(layerId);
        LAYER_USER_DRAWN.delete(layerId);

        const prevData =
          (img as unknown as { data?: Record<string, unknown> }).data ?? {};

        // 🔥 清除 pending 狀態
        (img as unknown as { data?: Record<string, unknown> }).data = {
          ...prevData,
          originBase: base64,
          isPending: false,
          jobId: undefined,
        };

        img.opacity = 1;
        const flag = `__pending_${layerId}`;
        (canvas.getObjects() as FabricObject[])
          .filter(
            (o) =>
              (o as unknown as { data?: { pendingFlag?: string } }).data
                ?.pendingFlag === flag
          )
          .forEach((o) => canvas.remove(o));

        canvas.requestRenderAll();

        await twoFrames();

        if (shouldSaveHistory) {
          saveToHistory(canvas);
        }

        return true;
      },

      // 放在同一個作用域，沿用你的 canvasRef / bgRef 等變數
      setLayerProcessing: (
        id: string | string[],
        processing: boolean,
        jobId?: string
      ) => {
        console.log("🔥 setLayerProcessing 呼叫:", { id, processing });
        // ===== 型別擴充（支援多個 proxy）=====
        type ExtCanvas = fabric.Canvas & {
          __procCleanups?: Map<string, () => void>;
          __procProxies?: Map<string, fabric.Group>;
          __procSpinRafs?: Map<string, number>;
        };
        const canvas = canvasRef.current as ExtCanvas;
        if (!canvas) return;

        const ids = (Array.isArray(id) ? id : [id]).filter(Boolean) as string[];
        if (ids.length === 0) return;

        // 用 jobId 或 ids 組合作為 key
        const key = jobId || ids.sort().join(",");

        // 初始化 Map
        if (!canvas.__procCleanups) canvas.__procCleanups = new Map();
        if (!canvas.__procProxies) canvas.__procProxies = new Map();
        if (!canvas.__procSpinRafs) canvas.__procSpinRafs = new Map();

        // ===== 工具函式 =====
        const isRealImage = (o: FabricObject) => {
          if (o.type !== "image" || o === bgRef.current) return false;
          const d = (o as FabricObject).data as
            | { id?: string; ui?: boolean; pendingFlag?: string }
            | undefined;
          return (
            !!d?.id && d.id !== "__background__" && !d?.ui && !d?.pendingFlag
          );
        };

        const getTargets = (): FabricObject[] => {
          const out: FabricObject[] = [];
          (canvas.getObjects() as FabricObject[]).forEach((o) => {
            if (isRealImage(o)) {
              const oid = (o as FabricObject).data?.id as string | undefined;
              if (oid && ids.includes(oid)) out.push(o);
            } else if (o.type === "group") {
              (o as fabric.Group).getObjects().forEach((c) => {
                if (isRealImage(c)) {
                  const cid = (c as FabricObject).data?.id as
                    | string
                    | undefined;
                  if (cid && ids.includes(cid)) out.push(c);
                }
              });
            }
          });
          return out;
        };

        const cornersFromCenteredRect = (
          cx: number,
          cy: number,
          w: number,
          h: number,
          angleDeg: number | undefined
        ) => {
          const a = ((angleDeg ?? 0) * Math.PI) / 180;
          const cos = Math.cos(a),
            sin = Math.sin(a);
          const hw = Math.max(1, w) / 2,
            hh = Math.max(1, h) / 2;
          const local = [
            { x: -hw, y: -hh },
            { x: hw, y: -hh },
            { x: -hw, y: hh },
            { x: hw, y: hh },
          ];
          return local.map((p) => ({
            x: cx + p.x * cos - p.y * sin,
            y: cy + p.x * sin + p.y * cos,
          }));
        };

        const calcBounds = (objs: FabricObject[]) => {
          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

          for (const o of objs) {
            if (o.type === "textbox") {
              const textObj = o as fabric.Textbox;
              const b = textObj.getBoundingRect();
              if (b.left < minX) minX = b.left;
              if (b.top < minY) minY = b.top;
              if (b.left + b.width > maxX) maxX = b.left + b.width;
              if (b.top + b.height > maxY) maxY = b.top + b.height;
              continue;
            }
            const img = o as unknown as fabric.FabricImage;
            const cp = img?.clipPath as fabric.Rect | undefined;

            if (
              cp &&
              (cp as Rect).absolutePositioned === true &&
              (cp.originX ?? "center") === "center" &&
              (cp.originY ?? "center") === "center"
            ) {
              const cx = cp.left ?? 0;
              const cy = cp.top ?? 0;
              const w = Math.max(1, cp.width ?? 1);
              const h = Math.max(1, cp.height ?? 1);
              const pts = cornersFromCenteredRect(
                cx,
                cy,
                w,
                h,
                cp.angle as number | undefined
              );
              for (const p of pts) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
              }
            } else {
              const cs = o.getCoords();
              for (const p of cs) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
              }
            }
          }

          const left = isFinite(minX) ? minX : 0;
          const top = isFinite(minY) ? minY : 0;
          const width = Math.max(1, isFinite(maxX - minX) ? maxX - minX : 1);
          const height = Math.max(1, isFinite(maxY - minY) ? maxY - minY : 1);
          return { left, top, width, height };
        };

        const getLayerProxyRect = (c: fabric.Canvas, layerId: string) => {
          const tag = `__proxy_${layerId}`;
          return (c.getObjects() as FabricObject[]).find(
            (o) => (o as FabricObject).data?.proxyTag === tag
          ) as fabric.Rect | undefined;
        };

        const applyDeltaToOne = (
          c: fabric.Canvas,
          obj: FabricObject,
          dx: number,
          dy: number
        ) => {
          const lt = obj.getPointByOrigin("left", "top");
          obj.setPositionByOrigin(
            new fabric.Point(lt.x + dx, lt.y + dy),
            "left",
            "top"
          );
          obj.setCoords();

          const img = obj as unknown as fabric.FabricImage;
          const cp = img.clipPath as fabric.Rect | undefined;
          if (cp) {
            const cplt = cp.getPointByOrigin("left", "top");
            cp.setPositionByOrigin(
              new fabric.Point(cplt.x + dx, cplt.y + dy),
              "left",
              "top"
            );
            cp.setCoords?.();
          }

          const layerId = (img as FabricImage).data?.id as string | undefined;
          if (layerId) {
            const pr = getLayerProxyRect(c, layerId);
            if (pr) {
              const prlt = pr.getPointByOrigin("left", "top");
              pr.setPositionByOrigin(
                new fabric.Point(prlt.x + dx, prlt.y + dy),
                "left",
                "top"
              );
              pr.setCoords();
            }
          }
        };

        // ===== 關閉處理中：只清理這個 key 的 =====
        if (!processing) {
          const cleanup = canvas.__procCleanups?.get(key);
          if (cleanup) {
            cleanup();
            canvas.__procCleanups?.delete(key);
          }
          return;
        }

        // ===== 如果這個 key 已經在處理中，先清掉 =====
        const existingCleanup = canvas.__procCleanups?.get(key);
        if (existingCleanup) {
          existingCleanup();
          canvas.__procCleanups?.delete(key);
        }

        const targets = getTargets();
        if (targets.length === 0) return;

        const all = canvas.getObjects();
        targets.sort((a, b) => all.indexOf(a) - all.indexOf(b));
        const b = calcBounds(targets);

        // ===== 建代理群組（可拖動）=====
        const hitbox = new fabric.Rect({
          left: 0,
          top: 0,
          originX: "left",
          originY: "top",
          width: b.width,
          height: b.height,
          fill: "rgba(0,0,0,0.001)",
          selectable: false,
          evented: false,
          hasControls: false,
          objectCaching: false,
          excludeFromExport: true,
        });

        type RectWithData = fabric.Rect & { data?: Record<string, unknown> };
        type CircleWithData = fabric.Circle & {
          data?: Record<string, unknown>;
        };

        const r0 = Math.min(50, Math.min(b.width, b.height) * 0.15);
        const overlay: RectWithData = new fabric.Rect({
          left: b.width / 2,
          top: b.height / 2,
          originX: "center",
          originY: "center",
          width: b.width,
          height: b.height,
          fill: "rgba(0,0,0,0.6)",
          selectable: false,
          evented: false,
          objectCaching: false,
          excludeFromExport: true,
        }) as RectWithData;
        overlay.data = { processingOverlay: true, processingKey: key };

        const spinner: CircleWithData = new fabric.Circle({
          left: b.width / 2,
          top: b.height / 2,
          originX: "center",
          originY: "center",
          radius: r0,
          fill: "transparent",
          stroke: "#fff",
          strokeWidth: 5,
          strokeDashArray: [r0 * Math.PI * 0.3, r0 * Math.PI * 0.7],
          selectable: false,
          evented: false,
          objectCaching: false,
          excludeFromExport: true,
        }) as CircleWithData;
        spinner.data = { processingOverlay: true, processingKey: key };

        const proxy = new fabric.Group([hitbox, overlay, spinner], {
          left: b.left,
          top: b.top,
          originX: "left",
          originY: "top",
          selectable: true,
          evented: true,
          hasControls: false,
          objectCaching: false,
          excludeFromExport: true,
          subTargetCheck: false,
        });
        (proxy as fabric.Group).data = {
          isProcessingOverlay: true,
          targetIds: ids,
          processingKey: key,
        };

        canvas.add(proxy);
        canvas.bringObjectToFront(proxy);
        proxy.setCoords();
        canvas.requestRenderAll();
        canvas.__procProxies?.set(key, proxy);

        // 禁用原物件互動
        const origFlags = new Map<
          FabricObject,
          { sel: boolean; evt: boolean }
        >();
        targets.forEach((o) => {
          origFlags.set(o, {
            sel: !!(o as FabricObject).selectable,
            evt: !!(o as FabricObject).evented,
          });
          (o as FabricObject).selectable = false;
          (o as FabricObject).evented = false;
        });

        // 禁用參與圖層的 proxy
        ids.forEach((layerId) => {
          const layerProxy = getLayerProxyRect(canvas, layerId);
          if (layerProxy) {
            layerProxy.selectable = false;
            layerProxy.evented = false;
          }
        });

        // ===== 移動同步 =====
        let alive = true;
        let prevLT = proxy.getPointByOrigin("left", "top");

        const onMoving = () => {
          if (!alive) return;
          if (targets.length === 0) {
            canvas.__procCleanups?.get(key)?.();
            return;
          }
          const curLT = proxy.getPointByOrigin("left", "top");
          const dx = curLT.x - prevLT.x;
          const dy = curLT.y - prevLT.y;
          if (dx !== 0 || dy !== 0) {
            targets.forEach((t) => applyDeltaToOne(canvas, t, dx, dy));
            prevLT = curLT;
            canvas.requestRenderAll();
          }
        };

        const resizeProxyToTargets = () => {
          const nb = calcBounds(targets);
          proxy.set({ left: nb.left, top: nb.top });

          (hitbox as fabric.Rect).set({
            left: 0,
            top: 0,
            width: nb.width,
            height: nb.height,
          });
          (overlay as fabric.Rect).set({
            left: nb.width / 2,
            top: nb.height / 2,
            width: nb.width,
            height: nb.height,
          });
          const r = Math.min(50, Math.min(nb.width, nb.height) * 0.15);
          (spinner as fabric.Circle).set({
            left: nb.width / 2,
            top: nb.height / 2,
            radius: r,
            strokeDashArray: [r * Math.PI * 0.3, r * Math.PI * 0.7] as number[],
          });
          proxy.setCoords();
          prevLT = proxy.getPointByOrigin("left", "top");
        };

        let angle = 0;
        const spin = () => {
          if (!alive || !canvas.getObjects().includes(proxy)) return;
          angle = (angle + 6) % 360;
          (spinner as fabric.Circle).set("angle", angle);
          canvas.requestRenderAll();
          const rafId = requestAnimationFrame(spin);
          canvas.__procSpinRafs?.set(key, rafId);
        };
        const initialRaf = requestAnimationFrame(spin);
        canvas.__procSpinRafs?.set(key, initialRaf);

        const syncWhenTargetMoved = (e: ModifiedEvent<TPointerEvent>) => {
          const t = e?.target as FabricObject | undefined;
          if (!t || !targets.includes(t)) return;
          resizeProxyToTargets();
        };

        proxy.on("moving", onMoving);
        canvas.on(
          "object:moving",
          syncWhenTargetMoved as unknown as (
            e: ModifiedEvent<TPointerEvent>
          ) => void
        );
        canvas.on(
          "object:modified",
          syncWhenTargetMoved as unknown as (
            e: ModifiedEvent<TPointerEvent>
          ) => void
        );

        // ===== 統一清理口 =====
        const cleanup = () => {
          alive = false;

          const rafId = canvas.__procSpinRafs?.get(key);
          if (rafId) {
            cancelAnimationFrame(rafId);
            canvas.__procSpinRafs?.delete(key);
          }

          try {
            proxy.off("moving", onMoving);
            canvas.off("object:moving", syncWhenTargetMoved);
            canvas.off("object:modified", syncWhenTargetMoved);
          } catch {}

          const existingProxy = canvas.__procProxies?.get(key);
          if (existingProxy && canvas.getObjects().includes(existingProxy)) {
            canvas.remove(existingProxy);
          }
          canvas.__procProxies?.delete(key);

          nukeTopOverlay(canvas);

          origFlags.forEach((flags, o) => {
            (o as FabricObject).selectable = flags.sel;
            (o as FabricObject).evented = flags.evt;
          });

          // 還原參與圖層的 proxy
          ids.forEach((layerId) => {
            const layerProxy = getLayerProxyRect(canvas, layerId);
            if (layerProxy) {
              const img = (canvas.getObjects() as FabricObject[]).find(
                (o) => (o as FabricObject).data?.id === layerId
              );
              const imgVisible = img?.visible ?? true;
              layerProxy.selectable = imgVisible;
              layerProxy.evented = imgVisible;
            }
          });

          // 清理這個 key 相關的 overlay
          (canvas.getObjects() as FabricObject[])
            .filter((o) => (o as FabricObject).data?.processingKey === key)
            .forEach((o) => canvas.remove(o));

          canvas.requestRenderAll();
        };

        canvas.__procCleanups?.set(key, cleanup);
      },

      setArtboardSize: (width: number, height: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        setArtboardSize({ width, height });
        createArtboard(canvas, width, height);

        // 🔥 更新 clipPath
        if (canvas.clipPath && canvas.clipPath instanceof fabric.Rect) {
          (canvas.clipPath as fabric.Rect).set({ width, height });
        }

        canvas.sendObjectToBack(artboardRef.current!);
        if (bgRef.current) canvas.sendObjectToBack(bgRef.current);

        canvas.requestRenderAll();
      },

      getArtboardSize: () => {
        const artboard = artboardRef.current;
        if (!artboard) {
          return { ...artboardSize, top: 0, left: 0 };
        }

        return {
          width: Math.round(artboard.width ?? artboardSize.width),
          height: Math.round(artboard.height ?? artboardSize.height),
          left: Math.round(artboard.left ?? 0),
          top: Math.round(artboard.top ?? 0),
        };
      },

      toggleArtboard: (visible: boolean) => {
        if (!artboardRef.current) return;
        artboardRef.current.set({ visible });
        canvasRef.current?.requestRenderAll();
      },

      getArtboardBounds: () => {
        const artboard = artboardRef.current;
        if (!artboard) return null;

        const left = (artboard.left ?? 0) - (artboard.width ?? 0) / 2;
        const top = (artboard.top ?? 0) - (artboard.height ?? 0) / 2;
        const width = artboard.width ?? 0;
        const height = artboard.height ?? 0;

        return { left, top, width, height };
      },

      exportBasePng: async (layerId: string) => {
        return LAYER_CLEAN_BASE.get(layerId) || null;
      },

      exportMaskPng: async (layerId, opts) => {
        // 1. 取得「當前」畫面 (含筆刷)
        const currentCanvas = LAYER_BASE_CANVAS.get(layerId);
        if (!currentCanvas) return null;

        const w = currentCanvas.width;
        const h = currentCanvas.height;

        // 2. 取得「乾淨」原圖 (無筆刷)
        // 這是您程式碼裡本來就有維護的狀態
        const cleanDataUrl = LAYER_CLEAN_BASE.get(layerId); 
        
        // 3. 準備輸出 Canvas
        const out = document.createElement("canvas");
        out.width = w;
        out.height = h;
        const octx = out.getContext("2d")!;
        
        // 預設全白 (無遮罩)
        octx.fillStyle = "#ffffff";
        octx.fillRect(0, 0, w, h);
        
        // 取得當前畫面的像素數據
        const currentCtx = currentCanvas.getContext("2d", { willReadFrequently: true })!;
        const currentImgData = currentCtx.getImageData(0, 0, w, h);
        const cd = currentImgData.data;
        
        // 準備 Mask 的像素數據
        const outImgData = octx.getImageData(0, 0, w, h);
        const od = outImgData.data;

        let hasBrushPixel = false;

        // --- 核心邏輯：比對法 ---
        if (cleanDataUrl) {
           // 情況 A：有乾淨原圖，我們進行「差異比對」
           // 先把乾淨圖載入到一個臨時 Canvas 讀取像素
           const cleanImg = await loadImage(cleanDataUrl);
           const cleanC = document.createElement("canvas");
           cleanC.width = w;
           cleanC.height = h;
           const cleanCtx = cleanC.getContext("2d", { willReadFrequently: true })!;
           cleanCtx.drawImage(cleanImg, 0, 0, w, h);
           
           const cleanImgData = cleanCtx.getImageData(0, 0, w, h);
           const bd = cleanImgData.data;

           // 容許極小的雜訊 (例如壓縮造成的 1~2 數值差異)
           const DIFF_TOLERANCE = 5; 

           for (let i = 0; i < cd.length; i += 4) {
             // 比較 R, G, B, A
             const rDiff = Math.abs(cd[i] - bd[i]);
             const gDiff = Math.abs(cd[i+1] - bd[i+1]);
             const bDiff = Math.abs(cd[i+2] - bd[i+2]);
             const aDiff = Math.abs(cd[i+3] - bd[i+3]);

             // 只要任何一個通道的差異超過容許值，就視為被畫過 (Mask)
             if (rDiff > DIFF_TOLERANCE || gDiff > DIFF_TOLERANCE || bDiff > DIFF_TOLERANCE || aDiff > DIFF_TOLERANCE) {
                // 轉黑 (遮罩區)
                od[i] = 0;
                od[i+1] = 0;
                od[i+2] = 0;
                od[i+3] = 255;
                hasBrushPixel = true;
             } else {
                // 保持白 (非遮罩)
                od[i] = 255;
                od[i+1] = 255;
                od[i+2] = 255;
                od[i+3] = 255;
             }
           }

        } else {
           // 情況 B：萬一沒有乾淨原圖 (Fallback)，我們才退回去用「顏色偵測」
           // 但這次我們邏輯放寬一點，且不依賴特定的 Magic Color
           // 假設筆刷是半透明黑色疊加，通常會讓圖片變暗或變灰
           
           // *註：因為您的架構有正確維護 LAYER_CLEAN_BASE，理論上這段不太會跑到
           // 為了保險起見，這裡用您原本的邏輯但放寬 TOL
           const TOL = 10; // 放寬容忍度
           const TR=58, TG=58, TB=58;

           for (let i = 0; i < cd.length; i += 4) {
              const r = cd[i], g = cd[i+1], b = cd[i+2], a = cd[i+3];
              // 檢查是否接近筆刷顏色
              if (a > 50 && Math.abs(r - TR) < TOL && Math.abs(g - TG) < TOL && Math.abs(b - TB) < TOL) {
                 od[i] = 0; od[i+1] = 0; od[i+2] = 0; od[i+3] = 255;
                 hasBrushPixel = true;
              }
           }
        }

        if (!hasBrushPixel && opts?.nullIfEmpty) {
          return null;
        }

        octx.putImageData(outImgData, 0, 0);
        return out.toDataURL("image/png");
      },
      recenterView: (targetZoom: number = 1) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // 🔥 優先使用當前選中的圖層
        let targetImage = activeLayerRef.current;

        // 如果沒有選中圖層，找第一個非背景的 image
        if (!targetImage) {
          targetImage = (canvas.getObjects() as FabricImage[]).find(
            (obj) => obj.type === "image" && obj !== bgRef.current
          ) as FabricImage;
        }

        // 如果還是沒有，用任意 image
        if (!targetImage) {
          targetImage = canvas
            .getObjects()
            .find((obj) => obj.type === "image") as FabricImage;
        }

        if (targetImage) {
          recenterImage(canvas, targetImage, targetZoom);
        } else {
          resetView(canvas);
        }
      },
      setMobileFocusState: (layerId: string | null) => {
        mobileFocusRef.current = layerId;
      },
      copySelectedLayers: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const activeObj = canvas.getActiveObject();
        if (!activeObj) return;

        const layerIds: string[] = [];

        // 處理多選 handle
        if ((activeObj as FabricObject).data?.isMultiSelectHandle) {
          const targetIds = (activeObj as FabricObject).data
            ?.targetIds as string[];
          if (targetIds) layerIds.push(...targetIds);
        }
        // 處理 proxy rect
        else if ((activeObj as FabricObject).data?.proxyTag) {
          const hostId = (activeObj as FabricObject).data?.hostId as string;
          if (hostId) layerIds.push(hostId);
        }
        // 處理直接選中的 image
        else if (activeObj.type === "image") {
          const id = (activeObj as FabricObject).data?.id as string;
          if (id && id !== "__background__") layerIds.push(id);
        }
        // 🔥 處理直接選中的文字
        else if (activeObj.type === "textbox" || activeObj.type === "i-text") {
          const id = (activeObj as FabricObject).data?.id as string;
          if (id) layerIds.push(id);
        }

        if (layerIds.length === 0) return;

        const layerData: NonNullable<typeof clipboardRef.current>["layerData"] =
          [];
        const allObjects = canvas.getObjects() as FabricObject[];

        for (const layerId of layerIds) {
          // 🔥 先嘗試找文字圖層
          const textObj = allObjects.find(
            (o) =>
              (o.type === "textbox" || o.type === "i-text") &&
              (o as FabricObject).data?.id === layerId
          ) as fabric.Textbox | undefined;

          if (textObj) {
            const data = textObj.data || {};
            layerData.push({
              id: layerId,
              name: (data.name as string) || "Text Layer",
              type: "text",
              text: textObj.text || "",
              textProps: {
                fontSize: textObj.fontSize,
                fontFamily: textObj.fontFamily,
                fill:
                  typeof textObj.fill === "string" ? textObj.fill : "#000000",
                fontWeight: textObj.fontWeight as string,
                fontStyle: textObj.fontStyle,
                textAlign: textObj.textAlign,
                underline: textObj.underline,
                linethrough: textObj.linethrough,
                width: textObj.width,
              },
              transform: {
                left: textObj.left || 0,
                top: textObj.top || 0,
                scaleX: textObj.scaleX || 1,
                scaleY: textObj.scaleY || 1,
                angle: textObj.angle || 0,
              },
            });
            continue;
          }

          // 🔥 找圖片圖層
          const img = allObjects.find(
            (o) =>
              o.type === "image" && (o as FabricObject).data?.id === layerId
          ) as fabric.FabricImage | undefined;

          if (!img) continue;

          const baseDataUrl =
            LAYER_CLEAN_BASE.get(layerId) || LAYER_BASE_PIXEL.get(layerId);
          const viewCanvas = LAYER_VIEW_CANVAS.get(layerId);
          const viewDataUrl = viewCanvas
            ? viewCanvas.toDataURL("image/png")
            : undefined;
          const maskCanvas = LAYER_MASK_CANVAS.get(layerId);
          const maskDataUrl = maskCanvas
            ? maskCanvas.toDataURL("image/png")
            : undefined;
          const hasBrush = LAYER_HAS_BRUSH.has(layerId);
          const finalBaseUrl =
            baseDataUrl ||
            viewDataUrl ||
            (img.getElement() as HTMLCanvasElement)?.toDataURL?.("image/png");

          if (!finalBaseUrl) continue;

          const data = (img as FabricImage).data || {};

          layerData.push({
            id: layerId,
            name: (data.name as string) || "Layer",
            type: "image",
            dataUrl: finalBaseUrl,
            viewDataUrl,
            maskDataUrl,
            hasBrush,
            transform: {
              left: img.left || 0,
              top: img.top || 0,
              scaleX: img.scaleX || 1,
              scaleY: img.scaleY || 1,
              angle: img.angle || 0,
            },
            clipPath:
              img.clipPath instanceof fabric.Rect
                ? {
                    left: (img.clipPath as fabric.Rect).left || 0,
                    top: (img.clipPath as fabric.Rect).top || 0,
                    width: (img.clipPath as fabric.Rect).width || 100,
                    height: (img.clipPath as fabric.Rect).height || 100,
                    angle: (img.clipPath as fabric.Rect).angle || 0,
                  }
                : undefined,
            frame: data.frame,
          });
        }

        if (layerData.length > 0) {
          clipboardRef.current = { layerIds, layerData };
          console.log(`[Copy] 已複製 ${layerData.length} 個圖層`);
        }
      },

      // 🔥 貼上圖層（支援內部複製和外部圖片）
      pasteFromClipboard: async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // 優先嘗試從系統剪貼簿讀取圖片
        try {
          const clipboardItems = await navigator.clipboard.read();

          for (const item of clipboardItems) {
            const imageType = item.types.find((type) =>
              type.startsWith("image/")
            );
            if (imageType) {
              const blob = await item.getType(imageType);
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });

              await api.addImageLayer(dataUrl, "Pasted Image");
              console.log("[Paste] 從剪貼簿貼上外部圖片");
              return;
            }
          }
        } catch (err) {
          console.log("[Paste] 無法從系統剪貼簿讀取，嘗試內部剪貼簿");
        }

        // 使用內部剪貼簿
        if (
          !clipboardRef.current ||
          clipboardRef.current.layerData.length === 0
        ) {
          console.log("[Paste] 內部剪貼簿為空");
          return;
        }

        const { layerData } = clipboardRef.current;
        const newIds: string[] = [];
        const OFFSET = 20;

        for (const data of layerData) {
          try {
            // 🔥 處理文字圖層
            if (data.type === "text") {
              const textObj = new fabric.Textbox(data.text || "文字", {
                left: data.transform.left + OFFSET,
                top: data.transform.top + OFFSET,
                originX: "center",
                originY: "center",
                scaleX: data.transform.scaleX,
                scaleY: data.transform.scaleY,
                angle: data.transform.angle,
                fontSize: data.textProps?.fontSize ?? 32,
                fontFamily: data.textProps?.fontFamily ?? "Arial",
                fill: data.textProps?.fill ?? "#000000",
                fontWeight: data.textProps?.fontWeight ?? "normal",
                fontStyle: data.textProps?.fontStyle ?? "normal",
                textAlign: data.textProps?.textAlign ?? "left",
                underline: data.textProps?.underline ?? false,
                linethrough: data.textProps?.linethrough ?? false,
                width: data.textProps?.width,
                splitByGrapheme: true,
                editable: false,
                selectable: false,
                evented: false,
                hasControls: false,
                hasBorders: false,
              });

              const newId = `text-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`;

              // 生成縮圖
              const edge = 64;
              const thumbCanvas = document.createElement("canvas");
              thumbCanvas.width = edge;
              thumbCanvas.height = edge;
              const thumbCtx = thumbCanvas.getContext("2d")!;
              thumbCtx.fillStyle = "#ffffff";
              thumbCtx.fillRect(0, 0, edge, edge);
              const scale = Math.min(
                edge / (textObj.width || 1),
                edge / (textObj.height || 1),
                1
              );
              const dataURL = textObj.toDataURL({ multiplier: scale });
              const thumbImg = new Image();
              const thumb = await new Promise<string>((resolve) => {
                thumbImg.onload = () => {
                  thumbCtx.drawImage(
                    thumbImg,
                    (edge - thumbImg.width) / 2,
                    (edge - thumbImg.height) / 2
                  );
                  resolve(thumbCanvas.toDataURL("image/png"));
                };
                thumbImg.onerror = () => resolve("");
                thumbImg.src = dataURL;
              });

              textObj.data = {
                id: newId,
                name: `${data.name} Copy`,
                thumb,
                isText: true,
                type: "textbox",
              };

              canvas.add(textObj);
              const proxy = api.ensureTextProxyRect(canvas, textObj);
              canvas.setActiveObject(proxy);

              newIds.push(newId);
              continue;
            }

            // 🔥 處理圖片圖層
            const displayUrl = data.viewDataUrl || data.dataUrl;
            if (!displayUrl) continue;

            const newImg = await fabric.FabricImage.fromURL(displayUrl);
            const newId = genId();

            newImg.set({
              left: data.transform.left + OFFSET,
              top: data.transform.top + OFFSET,
              originX: "center",
              originY: "center",
              scaleX: data.transform.scaleX,
              scaleY: data.transform.scaleY,
              angle: data.transform.angle,
            });
            if (data.clipPath) {
              const clip = new fabric.Rect({
                left: data.clipPath.left + OFFSET,
                top: data.clipPath.top + OFFSET,
                width: data.clipPath.width,
                height: data.clipPath.height,
                angle: data.clipPath.angle,
                originX: "center",
                originY: "center",
                absolutePositioned: true,
              });
              newImg.clipPath = clip;
            }

            const thumb = await thumbOf(newImg);
            const oldFrame = data.frame as
              | {
                  w: number;
                  h: number;
                  cx?: number;
                  cy?: number;
                  angle?: number;
                  origin?: string;
                  left?: number;
                  top?: number;
                }
              | undefined;
            (newImg as FabricImage).data = {
              id: newId,
              name: `${data.name} Copy`,
              thumb,
              frame: oldFrame
                ? {
                    ...oldFrame,
                    cx: (oldFrame.cx || 0) + OFFSET,
                    cy: (oldFrame.cy || 0) + OFFSET,
                    left:
                      oldFrame.left !== undefined
                        ? oldFrame.left + OFFSET
                        : undefined,
                    top:
                      oldFrame.top !== undefined
                        ? oldFrame.top + OFFSET
                        : undefined,
                  }
                : undefined,
            };

            // 🔥 保存原始底圖
            if (data.dataUrl) {
              LAYER_CLEAN_BASE.set(newId, data.dataUrl);
              LAYER_BASE_PIXEL.set(newId, data.dataUrl);
            }

            // 🔥 先載入原始底圖來獲取正確尺寸
            const baseImg = await loadImage(data.dataUrl || displayUrl);
            const W = baseImg.naturalWidth || baseImg.width || 100;
            const H = baseImg.naturalHeight || baseImg.height || 100;

            // 🔥 還原 BASE_CANVAS（原始底圖）
            const baseCanvas = document.createElement("canvas");
            baseCanvas.width = W;
            baseCanvas.height = H;
            const bctx = baseCanvas.getContext("2d")!;
            bctx.drawImage(baseImg, 0, 0, W, H);
            LAYER_BASE_CANVAS.set(newId, baseCanvas);

            // 🔥 還原 MASK_CANVAS（遮罩）
            if (data.maskDataUrl) {
              const maskCanvas = document.createElement("canvas");
              maskCanvas.width = W;
              maskCanvas.height = H;
              const mctx = maskCanvas.getContext("2d")!;
              const maskImg = await loadImage(data.maskDataUrl);
              mctx.drawImage(maskImg, 0, 0, W, H);
              LAYER_MASK_CANVAS.set(newId, maskCanvas);
            }

            // 🔥 還原 VIEW_CANVAS（顯示用的合成圖）
            const viewCanvas = document.createElement("canvas");
            viewCanvas.width = W;
            viewCanvas.height = H;
            const vctx = viewCanvas.getContext("2d")!;

            if (data.viewDataUrl) {
              const viewImg = await loadImage(data.viewDataUrl);
              vctx.drawImage(viewImg, 0, 0, W, H);
            } else {
              vctx.drawImage(baseImg, 0, 0, W, H);
            }
            LAYER_VIEW_CANVAS.set(newId, viewCanvas);

            // 🔥 還原筆刷標記
            if (data.hasBrush) {
              LAYER_HAS_BRUSH.add(newId);
            }

            // 🔥 設置 FabricImage 使用 viewCanvas 顯示
            newImg.setElement(viewCanvas);

            canvas.add(newImg);
            const proxy = api.ensureProxyRect(canvas, newImg);
            canvas.add(proxy);

            newIds.push(newId);
          } catch (err) {
            console.error("[Paste] 貼上圖層失敗:", err);
          }
        }

        if (newIds.length > 0) {
          if (newIds.length === 1) {
            api.setActive(newIds[0]);
          } else {
            api.setActiveMultiple(newIds);
          }

          canvas.requestRenderAll();
          saveToHistory(canvas);
          console.log(`[Paste] 已貼上 ${newIds.length} 個圖層`);
        }
      },

      // 🔥 複製單個圖層
      duplicateLayer: async (id: string) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const allObjects = canvas.getObjects() as FabricObject[];
        const img = allObjects.find(
          (o) => o.type === "image" && (o as FabricObject).data?.id === id
        ) as fabric.FabricImage | undefined;

        if (!img) return null;

        // 🔥 獲取各種 canvas 數據
        const baseDataUrl =
          LAYER_CLEAN_BASE.get(id) || LAYER_BASE_PIXEL.get(id);
        const viewCanvas = LAYER_VIEW_CANVAS.get(id);
        const maskCanvas = LAYER_MASK_CANVAS.get(id);
        const hasBrush = LAYER_HAS_BRUSH.has(id);

        // 使用 viewCanvas（合成後的顯示圖）來創建新圖層
        const displayUrl = viewCanvas
          ? viewCanvas.toDataURL("image/png")
          : baseDataUrl;

        if (!displayUrl) return null;

        try {
          const newImg = await fabric.FabricImage.fromURL(displayUrl);
          const newId = genId();
          const OFFSET = 20;

          newImg.set({
            left: (img.left || 0) + OFFSET,
            top: (img.top || 0) + OFFSET,
            originX: "center",
            originY: "center",
            scaleX: img.scaleX || 1,
            scaleY: img.scaleY || 1,
            angle: img.angle || 0,
          });

          if (img.clipPath instanceof fabric.Rect) {
            const cp = img.clipPath as fabric.Rect;
            const newClip = new fabric.Rect({
              left: (cp.left || 0) + OFFSET,
              top: (cp.top || 0) + OFFSET,
              width: cp.width,
              height: cp.height,
              angle: cp.angle,
              originX: "center",
              originY: "center",
              absolutePositioned: true,
            });
            newImg.clipPath = newClip;
          }

          const data = (img as FabricImage).data || {};
          const thumb = await thumbOf(newImg);
          const oldFrame = data.frame as
            | {
                w: number;
                h: number;
                cx?: number;
                cy?: number;
                angle?: number;
                origin?: string;
                left?: number;
                top?: number;
              }
            | undefined;

          (newImg as FabricImage).data = {
            id: newId,
            name: `${(data.name as string) || "Layer"} Copy`,
            thumb,
            frame: oldFrame
              ? {
                  ...oldFrame,
                  cx: (oldFrame.cx || 0) + OFFSET,
                  cy: (oldFrame.cy || 0) + OFFSET,
                  left:
                    oldFrame.left !== undefined
                      ? oldFrame.left + OFFSET
                      : undefined,
                  top:
                    oldFrame.top !== undefined
                      ? oldFrame.top + OFFSET
                      : undefined,
                }
              : undefined,
          };

          const imgEl = newImg.getElement() as HTMLImageElement;
          const W = imgEl.naturalWidth || imgEl.width || 100;
          const H = imgEl.naturalHeight || imgEl.height || 100;

          // 🔥 複製 BASE_CANVAS（原始底圖）
          const newBaseCanvas = document.createElement("canvas");
          newBaseCanvas.width = W;
          newBaseCanvas.height = H;
          const bctx = newBaseCanvas.getContext("2d")!;

          const srcBaseCanvas = LAYER_BASE_CANVAS.get(id);
          if (srcBaseCanvas) {
            bctx.drawImage(srcBaseCanvas, 0, 0, W, H);
          } else if (baseDataUrl) {
            const baseImg = await loadImage(baseDataUrl);
            bctx.drawImage(baseImg, 0, 0, W, H);
          } else {
            bctx.drawImage(imgEl, 0, 0, W, H);
          }
          LAYER_BASE_CANVAS.set(newId, newBaseCanvas);

          // 🔥 複製 MASK_CANVAS（遮罩）
          if (maskCanvas) {
            const newMaskCanvas = document.createElement("canvas");
            newMaskCanvas.width = W;
            newMaskCanvas.height = H;
            newMaskCanvas.getContext("2d")!.drawImage(maskCanvas, 0, 0, W, H);
            LAYER_MASK_CANVAS.set(newId, newMaskCanvas);
          }

          // 🔥 複製 VIEW_CANVAS（顯示用的合成圖）
          const newViewCanvas = document.createElement("canvas");
          newViewCanvas.width = W;
          newViewCanvas.height = H;
          const vctx = newViewCanvas.getContext("2d")!;

          if (viewCanvas) {
            vctx.drawImage(viewCanvas, 0, 0, W, H);
          } else {
            vctx.drawImage(imgEl, 0, 0, W, H);
          }
          LAYER_VIEW_CANVAS.set(newId, newViewCanvas);

          // 🔥 複製其他標記
          if (baseDataUrl) {
            LAYER_CLEAN_BASE.set(newId, baseDataUrl);
            LAYER_BASE_PIXEL.set(newId, baseDataUrl);
          }

          if (hasBrush) {
            LAYER_HAS_BRUSH.add(newId);
          }

          // 🔥 設置 FabricImage 使用 viewCanvas 顯示
          newImg.setElement(newViewCanvas);

          canvas.add(newImg);
          const proxy = api.ensureProxyRect(canvas, newImg);
          canvas.add(proxy);

          canvas.setActiveObject(proxy);
          canvas.requestRenderAll();
          saveToHistory(canvas);

          return { id: newId };
        } catch (err) {
          console.error("[Duplicate] 複製圖層失敗:", err);
          return null;
        }
      },

      // 🔥 下載圖層 - 原始尺寸
      downloadLayerOriginal: async (layerId: string) => {
        const dataUrl =
          LAYER_CLEAN_BASE.get(layerId) || LAYER_BASE_PIXEL.get(layerId);
        if (!dataUrl) {
          console.warn("[Download] 找不到圖層原始數據:", layerId);
          return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const allObjects = canvas.getObjects() as FabricObject[];
        const img = allObjects.find(
          (o) => o.type === "image" && (o as FabricObject).data?.id === layerId
        ) as fabric.FabricImage | undefined;

        const name = ((img as FabricImage)?.data?.name as string) || "圖層";

        const link = document.createElement("a");
        link.download = `${name}_original.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },

      // 🔥 下載圖層 - 裁切後
      downloadLayerCropped: async (layerId: string) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dataUrl = await api.exportLayerCroppedPng(layerId, canvas);
        if (!dataUrl) {
          console.warn("[Download] 無法匯出裁切圖:", layerId);
          return;
        }

        const allObjects = canvas.getObjects() as FabricObject[];
        const img = allObjects.find(
          (o) => o.type === "image" && (o as FabricObject).data?.id === layerId
        ) as fabric.FabricImage | undefined;

        const name = ((img as FabricImage)?.data?.name as string) || "圖層";

        const link = document.createElement("a");
        link.download = `${name}_cropped.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },

      setHistoryIsolation: (enabled: boolean) => {
        if (enabled) {
          // [進入時] 開啟隔離：記住當前位置作為起點
          historyIsolationIndexRef.current = historyIndexRef.current;
        } else {
          // [退出時] 關閉隔離：這裡執行「合併歷史紀錄 (Squash)」
          const startIndex = historyIsolationIndexRef.current;
          const currentIndex = historyIndexRef.current;
          const canvas = canvasRef.current;

          // 如果有設定起點、且確實有做新的操作 (目前的步數 > 起點)、且 canvas 存在
          if (startIndex !== -1 && currentIndex > startIndex && canvas) {
            console.log("正在合併手機模式的歷史紀錄...");

            // 1. 取得「當前最終畫面」的快照
            const finalSnapshot = buildSnapshot(canvas);

            // 2. 砍掉中間過程：只保留 [0 ... startIndex] (也就是進入前的狀態)
            const squashedHistory = historyRef.current.slice(0, startIndex + 1);

            // 3. 把「最終畫面」加進去，變成新的一步
            squashedHistory.push(finalSnapshot);

            // 4. 更新歷史堆疊與指標
            historyRef.current = squashedHistory;
            historyIndexRef.current = startIndex + 1;
          }

          // 最後：真正解除隔離狀態
          historyIsolationIndexRef.current = -1;
        }
      },
      renameLayer: (id: string, newName: string) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
      
        // 找到對應的物件（圖片或文字）
        const obj = (canvas.getObjects() as FabricObject[]).find(
          (o) => (o as FabricObject).data?.id === id
        );
      
        if (!obj) return;
      
        // 更新名稱
        const data = (obj as FabricObject).data || {};
        (obj as FabricObject).data = {
          ...data,
          name: newName,
        };
      
        // 儲存到 history
        saveToHistory(canvas);
        
        // 觸發 layer list 更新
        canvas.fire("object:modified", { target: obj } as ModifiedEvent<TPointerEvent>);
      },
    };
  }, [bgRef]);

  useEffect(() => {
    onCanvasReady?.(api);
  }, [api, onCanvasReady]);

  return (
    <div
      ref={hostRef}
      className={
        className ??
        "w-full h-full bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
      }
    />
  );
}

/**
 * 將指定的物件中心點置於視埠中央，並設定指定的縮放比例
 * @param targetZoom - 目標縮放比例 (例如：1.0 為 100% 縮放)
 */
function recenterImage(
  canvas: fabric.Canvas,
  obj: FabricObject,
  targetZoom: number
) {
  const cw = canvas.getWidth();
  const ch = canvas.getHeight();

  // 🔥 先重置 viewport 再取座標
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.setZoom(1);

  // 取得物件在原始座標系的中心
  const center = obj.getCenterPoint();
  const imgX = center.x;
  const imgY = center.y;

  // 設定目標縮放
  canvas.setZoom(targetZoom);

  // 計算平移
  const newTx = cw / 2 - targetZoom * imgX;
  const newTy = ch / 2 - targetZoom * imgY;

  canvas.setViewportTransform([targetZoom, 0, 0, targetZoom, newTx, newTy]);

  canvas.requestRenderAll();
}

function fitImageIntoCanvas(img: fabric.FabricImage, canvas: fabric.Canvas) {
  const cw = canvas.getWidth()!;
  const ch = canvas.getHeight()!;
  const iw = img.width || 1;
  const ih = img.height || 1;
  const s = Math.max(cw / iw, ch / ih);
  img.set({
    originX: "center",
    originY: "center",
    left: cw / 2,
    top: ch / 2,
    scaleX: s,
    scaleY: s,
  });
}

function resetView(canvas: fabric.Canvas) {
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.setZoom(1);
  canvas.requestRenderAll();
}

function isCanvasAlive(cnv?: fabric.Canvas | null) {
  const upper = (cnv as unknown as { upperCanvasEl?: HTMLCanvasElement })
    .upperCanvasEl;
  return !!upper && upper.isConnected;
}

function safeSetCursor(cnv: fabric.Canvas | null | undefined, cursor: string) {
  if (!isCanvasAlive(cnv)) return;
  try {
    const upper = (cnv as unknown as { upperCanvasEl: HTMLCanvasElement })
      .upperCanvasEl;
    upper.style.cursor = cursor;
    (cnv as unknown as { defaultCursor?: string }).defaultCursor = cursor;
  } catch {}
}
