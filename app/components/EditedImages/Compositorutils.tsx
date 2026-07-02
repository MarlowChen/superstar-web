/**
 * Compositor 轉換工具（enricos-nodes v3）
 * 將 Fabric.js 圖層資訊轉成 ComfyUI enricos-nodes Compositor 所需格式
 */

import * as fabric from "fabric"; // ✅ v6 正確匯入方式
import type { SelectedLayerTransform } from "./FabricStage";

/* =======================
   你原本的型別（保留相容）
   ======================= */

export type CompositorData = {
  padding: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
  transforms: Record<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      scaleX: number;
      scaleY: number;
      angle: number;
      flipX: boolean;
      flipY: boolean;
    }
  >;
  boundingBoxes: Record<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
    }
  >;
};

export type LayerMapping = {
  fabricId: string;
  fabricName: string;
  channelId: number;
  fabricIndex: number;
};

export type ConvertResult = {
  fabricDataJson: string;
  layerMapping: LayerMapping[];
  totalLayers: number;
  outputSize: {
    width: number; // 內容寬
    height: number; // 內容高
    contentWidth: number; // 同 width
    contentHeight: number; // 同 height
  };

  coordinateSystem?: "artboard" | "selection"; // 新增這行
  worldFrame?:{
    contentLeft: number,   // 內容框(未含padding)的世界 left
    contentTop:  number,   // 內容框(未含padding)的世界 top
    padding: number,                // 輸出用的 padding
  }
};

/* =======================
   官方 enricos-nodes v3 schema（內部使用）
   ======================= */

type CompositorOfficial = {
  width: number; // 內容寬
  height: number; // 內容高
  padding: number; // 單一數字
  transforms: Array<{
    left: number;
    top: number;
    scaleX: number;
    scaleY: number;
    angle: number;
    flipX: boolean;
    flipY: boolean;
    originX: "left" | "center" | "right";
    originY: "top" | "center" | "bottom";
    xwidth: number; // 原圖寬（未縮放）
    xheight: number; // 原圖高（未縮放）
    skewX: number;
    skewY: number;
  }>;
  bboxes: Array<{ left: number; top: number; xwidth: number; xheight: number }>;
};

const EMPTY_T = (): CompositorOfficial["transforms"][number] => ({
  left: 0,
  top: 0,
  scaleX: 1,
  scaleY: 1,
  angle: 0,
  flipX: false,
  flipY: false,
  originX: "left",
  originY: "top",
  xwidth: 0,
  xheight: 0,
  skewX: 0,
  skewY: 0,
});
const EMPTY_B = (): CompositorOfficial["bboxes"][number] => ({
  left: 0,
  top: 0,
  xwidth: 0,
  xheight: 0,
});

/* ============================================================
   ⭐ 轉換主函式（可直接用來取代你原本的 convert）
   ============================================================ */
export function convertToCompositorFormat(
  layers: SelectedLayerTransform[],
  padding: number = 100,
  artboardBounds?: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null
): ConvertResult {
  // if (!layers || layers.length === 0) throw new Error("沒有圖層可以轉換");
  if (layers.length > 8)
    throw new Error(`圖層數量超過限制：${layers.length} > 8`);

  let contentW: number;
  let contentH: number;
  let offsetX: number;
  let offsetY: number;
  let useArtboard = false;

  // 判斷是否使用 Artboard 座標系
  if (artboardBounds && artboardBounds.width > 0 && artboardBounds.height > 0) {
    contentW = Math.round(artboardBounds.width);
    contentH = Math.round(artboardBounds.height);
    offsetX = artboardBounds.left;
    offsetY = artboardBounds.top;
    useArtboard = true;
  } else {
    // 內容矩形（不含 padding）= 所有圖層的世界座標 AABB 聯集
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const l of layers) {
      const bb = l.boundingBox;
      minX = Math.min(minX, bb.x);
      minY = Math.min(minY, bb.y);
      maxX = Math.max(maxX, bb.x + bb.width);
      maxY = Math.max(maxY, bb.y + bb.height);
    }
    contentW = Math.max(0, Math.round(maxX - minX));
    contentH = Math.max(0, Math.round(maxY - minY));
    offsetX = minX;
    offsetY = minY;
    useArtboard = false;
  }

  const transforms: CompositorOfficial["transforms"] = Array.from(
    { length: 8 },
    EMPTY_T
  );
  const bboxes: CompositorOfficial["bboxes"] = Array.from(
    { length: 8 },
    EMPTY_B
  );
  const layerMapping: LayerMapping[] = [];

  // slot0：內容矩形（不含 padding），擺在 (padding, padding)
  transforms[0] = {
    left: padding,
    top: padding,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    flipX: false,
    flipY: false,
    originX: "left",
    originY: "top",
    xwidth: contentW,
    xheight: contentH,
    skewX: 0,
    skewY: 0,
  };
  bboxes[0] = {
    left: padding,
    top: padding,
    xwidth: contentW,
    xheight: contentH,
  };

  // slot1..：各圖層
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const t = layer.transform;
    const bb = layer.boundingBox;
    const slot = i + 1;

    let relativeX: number;
    let relativeY: number;

    if (useArtboard) {
      // Artboard 模式：圖層相對於 Artboard 左上角的位置
      relativeX = Math.round(bb.x - artboardBounds!.left);
      relativeY = Math.round(bb.y - artboardBounds!.top);
    } else {
      // Selection 模式：圖層相對於選取範圍左上角的位置
      relativeX = Math.round(bb.x - offsetX);
      relativeY = Math.round(bb.y - offsetY);
    }

    // 加上 padding
    const desiredLeftAABB = relativeX + padding;
    const desiredTopAABB = relativeY + padding;

    // 原圖未縮放寬高
    const w0 = Math.max(1, Math.round(t.width));
    const h0 = Math.max(1, Math.round(t.height));

    // 先拿原本 scale / angle
    let sx = t.scaleX ?? 1;
    let sy = t.scaleY ?? 1;
    const angle = t.angle ?? 0;

    // 目標輸出尺寸 = AABB 寬高
    const wantW = Math.max(1, Math.round(bb.width));
    const wantH = Math.max(1, Math.round(bb.height));

    // ★ 關鍵修正：angle=0 時，以 bbox 為「真相」覆寫 scale
    if (Math.abs(angle) < 1e-4) {
      const curW = Math.round(w0 * sx);
      const curH = Math.round(h0 * sy);
      if (Math.abs(curW - wantW) > 1 || Math.abs(curH - wantH) > 1) {
        sx = wantW / w0;
        sy = wantH / h0;
      }
    }

    // 計算「未旋轉左上角」(origin=left/top) 放置點
    let left_unrotatedTL = desiredLeftAABB;
    let top_unrotatedTL = desiredTopAABB;

    if (Math.abs(angle) > 1e-4) {
      const W = w0 * sx;
      const H = h0 * sy;
      const a = (angle * Math.PI) / 180;
      const cos = Math.cos(a),
        sin = Math.sin(a);

      const x1 = 0,
        y1 = 0;
      const x2 = W * cos,
        y2 = W * sin;
      const x3 = -H * sin,
        y3 = H * cos;
      const x4 = W * cos - H * sin,
        y4 = W * sin + H * cos;

      const minCornerX = Math.min(x1, x2, x3, x4);
      const minCornerY = Math.min(y1, y2, y3, y4);

      left_unrotatedTL = Math.round(desiredLeftAABB - minCornerX);
      top_unrotatedTL = Math.round(desiredTopAABB - minCornerY);
    }

    // transforms：固定 origin=left/top、位置用「未旋轉左上」
    transforms[slot] = {
      left: left_unrotatedTL,
      top: top_unrotatedTL,
      scaleX: 1,
      scaleY: 1,
      angle,
      flipX: !!t.flipX,
      flipY: !!t.flipY,
      originX: "left",
      originY: "top",
      xwidth: w0,
      xheight: h0,
      skewX: 0,
      skewY: 0,
    };

    // bboxes：就用你量到的 AABB（內容座標 + padding）
    bboxes[slot] = {
      left: desiredLeftAABB,
      top: desiredTopAABB,
      xwidth: wantW,
      xheight: wantH,
    };

    layerMapping.push({
      fabricId: layer.id,
      fabricName: layer.name,
      channelId: slot,
      fabricIndex: layer.fabricIndex,
    });
  }

  const official: CompositorOfficial = {
    width: contentW,
    height: contentH,
    padding,
    transforms,
    bboxes,
  };

  return {
    fabricDataJson: JSON.stringify(official),
    layerMapping,
    totalLayers: layers.length,
    outputSize: {
      width: contentW,
      height: contentH,
      contentWidth: contentW,
      contentHeight: contentH,
    },
    coordinateSystem: useArtboard ? "artboard" : "selection", // 新增這行
  };
}

export function convertToCompositorFormatCrop(
  layers: SelectedLayerTransform[],
  padding: number = 100,
  artboardBounds?: { left: number; top: number; width: number; height: number } | null
): ConvertResult {
  if (layers.length > 8)
    throw new Error(`圖層數量超過限制：${layers.length} > 8`);

  // ---------- 幾何小工具（完整） ----------
  const ANG_EPS = 1e-4;
  type Pt = { x: number; y: number };

  // 由中心/寬高/角度得到旋轉矩形四角
  const rotRectPoly = (cx:number, cy:number, W:number, H:number, angleDeg:number): Pt[] => {
    const a = (angleDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const hw = W/2, hh = H/2;
    const local: Pt[] = [
      {x:-hw,y:-hh}, {x: hw,y:-hh},
      {x: hw,y: hh}, {x:-hw,y: hh},
    ];
    return local.map(p => ({ x: cx + p.x*c - p.y*s, y: cy + p.x*s + p.y*c }));
  };

  // Sutherland–Hodgman 把 subject 多邊形裁進 clip 多邊形（兩者皆凸）
  const clipPolySH = (subject: Pt[], clip: Pt[]): Pt[] => {
    let output = subject.slice();
    const len = clip.length;
    for (let i=0;i<len;i++){
      const A = clip[i];
      const B = clip[(i+1)%len];
      const input = output.slice();
      output = [];
      if (!input.length) break;
      const inside = (p:Pt) => (B.x-A.x)*(p.y-A.y) - (B.y-A.y)*(p.x-A.x) >= -1e-9; // 左側為內
      const intersect = (P:Pt, Q:Pt): Pt => {
        const a1 = Q.y - P.y, b1 = P.x - Q.x, c1 = a1*P.x + b1*P.y;
        const a2 = B.y - A.y, b2 = A.x - B.x, c2 = a2*A.x + b2*A.y;
        const det = a1*b2 - a2*b1;
        if (Math.abs(det) < 1e-12) return Q; // 近平行，退回 Q 避免 NaN
        const x = (b2*c1 - b1*c2)/det, y = (a1*c2 - a2*c1)/det;
        return {x,y};
      };
      for (let j=0;j<input.length;j++){
        const S = input[j];
        const E = input[(j+1)%input.length];
        const Ein = inside(E), Sin = inside(S);
        if (Ein){
          if (!Sin) output.push(intersect(S,E));
          output.push(E);
        } else if (Sin){
          output.push(intersect(S,E));
        }
      }
    }
    return output;
  };

  const aabbOfPoly = (poly: Pt[]) => {
    if (!poly.length) return null;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for (const p of poly) {
      if (p.x<minX) minX=p.x; if (p.y<minY) minY=p.y;
      if (p.x>maxX) maxX=p.x; if (p.y>maxY) maxY=p.y;
    }
    return { left: minX, top: minY, right: maxX, bottom: maxY };
  };

  // 取得影像中心（支援 t.x/t.y；否則用 left/top + origin 換中心）
  const getImageCenterWorld = (t: {
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    angle: number;
    flipX: boolean;
    flipY: boolean;
    left?: number,
    top?:number,
    originX?: string,
    originY?: string
  }, w0:number, h0:number) => {
    if (typeof t.x === "number" && typeof t.y === "number") return { cx: t.x, cy: t.y };
    const sx = t.scaleX ?? 1, sy = t.scaleY ?? 1;
    const W = w0 * sx, H = h0 * sy;
    const left = t.left ?? 0, top = t.top ?? 0;
    const ox = t.originX ?? "center", oy = t.originY ?? "center";
    let cx = left, cy = top;
    if (ox === "left") cx += W/2; else if (ox === "right") cx -= W/2;
    if (oy === "top")  cy += H/2; else if (oy === "bottom") cy -= H/2;
    return { cx, cy };
  };

  // 未旋轉左上補償，供 origin=left/top
  const rotAABBMin = (W:number,H:number,angleDeg:number) => {
    if (Math.abs(angleDeg) < ANG_EPS) return { minX:0, minY:0 };
    const a=(angleDeg*Math.PI)/180, c=Math.cos(a), s=Math.sin(a);
    const pts = [
      {x:0, y:0},
      {x:W*c, y:W*s},
      {x:-H*s, y:H*c},
      {x:W*c - H*s, y:W*s + H*c}
    ];
    let minX=Infinity,minY=Infinity;
    for (const p of pts){ if (p.x<minX) minX=p.x; if (p.y<minY) minY=p.y; }
    return {minX, minY};
  };

  // ---------- 內容矩形 ----------
  let contentW: number, contentH: number, offsetX: number, offsetY: number, useArtboard = false;

  if (artboardBounds && artboardBounds.width > 0 && artboardBounds.height > 0) {
    contentW = Math.round(artboardBounds.width);
    contentH = Math.round(artboardBounds.height);
    offsetX = artboardBounds.left;
    offsetY = artboardBounds.top;
    useArtboard = true;
  } else {
    // 用「真正可見多邊形」的聯集 AABB（逐層 union，實作上是掃描所有 layer 的 AABB 再 union）
    let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;

    for (const l of layers) {
      const t = l.transform;
      const w0 = Math.max(1, Math.round(t.width));
      const h0 = Math.max(1, Math.round(t.height));
      const sx = t.scaleX ?? 1, sy = t.scaleY ?? 1, angle = t.angle ?? 0;
      const absSX = Math.abs(sx), absSY = Math.abs(sy);

      const { cx, cy } = getImageCenterWorld(t, w0, h0);
      const Wimg = w0 * absSX, Himg = h0 * absSY;

      let visPoly: Pt[] = rotRectPoly(cx, cy, Wimg, Himg, angle);

      if (l.clipPath) {
        const cW = Math.max(1, l.clipPath.width);
        const cH = Math.max(1, l.clipPath.height);
        const cA = l.clipPath.angle ?? 0;
        const clipPoly = rotRectPoly(l.clipPath.left, l.clipPath.top, cW, cH, cA);
        visPoly = clipPolySH(visPoly, clipPoly);
      }

      const aabb = aabbOfPoly(visPoly);
      if (aabb) {
        const L = Math.floor(aabb.left),  T = Math.floor(aabb.top);
        const R = Math.ceil(aabb.right), B = Math.ceil(aabb.bottom);
        if (L < minL) minL = L;
        if (T < minT) minT = T;
        if (R > maxR) maxR = R;
        if (B > maxB) maxB = B;
      }
    }

    if (!isFinite(minL) || !isFinite(minT) || !isFinite(maxR) || !isFinite(maxB)) {
      // 沒有任何可見內容
      contentW = 0; contentH = 0; offsetX = 0; offsetY = 0;
    } else {
      contentW = Math.max(0, maxR - minL);
      contentH = Math.max(0, maxB - minT);
      offsetX = minL; offsetY = minT;
    }
    useArtboard = false;
  }

  // ---------- 初始化 ----------
  const transforms: CompositorOfficial["transforms"] = Array.from({ length: 8 }, EMPTY_T);
  const bboxes: CompositorOfficial["bboxes"]         = Array.from({ length: 8 }, EMPTY_B);
  const layerMapping: LayerMapping[] = [];

  transforms[0] = {
    left: padding, top: padding, scaleX: 1, scaleY: 1, angle: 0, flipX: false, flipY: false,
    originX: "left", originY: "top", xwidth: contentW, xheight: contentH, skewX: 0, skewY: 0,
  };
  bboxes[0] = { left: padding, top: padding, xwidth: contentW, xheight: contentH };

  // ---------- 主迴圈：每層 ----------
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const t = layer.transform;
    const bb = layer.boundingBox;
    const slot = i + 1;

    const baseLeft = useArtboard ? artboardBounds!.left : offsetX;
    const baseTop  = useArtboard ? artboardBounds!.top  : offsetY;

    const w0 = Math.max(1, Math.round(t.width));
    const h0 = Math.max(1, Math.round(t.height));
    let sx = t.scaleX ?? 1, sy = t.scaleY ?? 1;
    const angle = t.angle ?? 0;

    const absSX = Math.abs(sx), absSY = Math.abs(sy);
    const signSX = Math.sign(sx || 1), signSY = Math.sign(sy || 1);

    let final_xwidth = w0, final_xheight = h0, final_angle = angle;
    let left_unrotatedTL = 0, top_unrotatedTL = 0;

    // 影像世界多邊形
    const { cx, cy } = getImageCenterWorld(t, w0, h0);
    const Wimg = w0 * absSX, Himg = h0 * absSY;
    const imgPoly = rotRectPoly(cx, cy, Wimg, Himg, angle);

    if (layer.clipPath) {
      // ==== 裁切模式：先做「幾何交集」再取 AABB（這才是你要的）====
      const clipPolyPts = rotRectPoly(
        layer.clipPath.left, layer.clipPath.top,
        Math.max(1, layer.clipPath.width),
        Math.max(1, layer.clipPath.height),
        layer.clipPath.angle ?? 0
      );
      const visPoly = clipPolySH(imgPoly, clipPolyPts);

      const vAABB = aabbOfPoly(visPoly);
      if (!vAABB) {
        // 完全不可見
        transforms[slot] = {
          left: 0, top: 0, scaleX: sx, scaleY: sy, angle,
          flipX: !!t.flipX, flipY: !!t.flipY, originX: "left", originY: "top",
          xwidth: 0, xheight: 0, skewX: 0, skewY: 0,
        };
        bboxes[slot] = { left: 0, top: 0, xwidth: 0, xheight: 0 };
      } else {
        // 世界座標 → 內容座標
        const leftW  = Math.floor(vAABB.left  - baseLeft) + padding;
        const topW   = Math.floor(vAABB.top   - baseTop ) + padding;
        const rightW = Math.ceil (vAABB.right - baseLeft) + padding;
        const botW   = Math.ceil (vAABB.bottom- baseTop ) + padding;

        const visW_world = Math.max(0, rightW - leftW);
        const visH_world = Math.max(0, botW   - topW );

        // xwidth/xheight 必須回推到「未縮放」尺寸（真正裁後尺寸）
        final_xwidth  = absSX ? Math.max(0, Math.round(visW_world  / absSX)) : 0;
        final_xheight = absSY ? Math.max(0, Math.round(visH_world / absSY)) : 0;
        final_angle   = angle;

        // 未旋轉左上補償（origin=left/top）
        if (Math.abs(angle) > ANG_EPS) {
          const { minX, minY } = rotAABBMin(final_xwidth*absSX, final_xheight*absSY, angle);
          left_unrotatedTL = Math.round(leftW - minX);
          top_unrotatedTL  = Math.round(topW  - minY);
        } else {
          left_unrotatedTL = Math.round(leftW);
          top_unrotatedTL  = Math.round(topW);
        }

        transforms[slot] = {
          left: left_unrotatedTL,
          top:  top_unrotatedTL,
          scaleX: signSX * (absSX || 1),
          scaleY: signSY * (absSY || 1),
          angle: final_angle,
          flipX: !!t.flipX,
          flipY: !!t.flipY,
          originX: "left",
          originY: "top",
          xwidth: final_xwidth,
          xheight: final_xheight,
          skewX: 0,
          skewY: 0,
        };

        // bboxes = 真正可見世界 AABB（供下游選取/顯示）
        bboxes[slot] = {
          left: Math.round(leftW),
          top:  Math.round(topW),
          xwidth:  Math.max(0, Math.round(visW_world)),
          xheight: Math.max(0, Math.round(visH_world)),
        };
      }
    } else {
      // ==== 無裁切：維持原本 AABB 貼齊 ====
      const desiredLeftAABB = Math.floor(bb.x - baseLeft) + padding;
      const desiredTopAABB  = Math.floor(bb.y - baseTop)  + padding;

      if (Math.abs(angle) < ANG_EPS) {
        const curW = Math.round(w0 * absSX), curH = Math.round(h0 * absSY);
        if (Math.abs(curW - bb.width) > 1 || Math.abs(curH - bb.height) > 1) {
          sx = (bb.width / w0) * signSX;
          sy = (bb.height / h0) * signSY;
        }
        left_unrotatedTL = desiredLeftAABB;
        top_unrotatedTL  = desiredTopAABB;
      } else {
        const { minX, minY } = rotAABBMin(w0*absSX, h0*absSY, angle);
        left_unrotatedTL = Math.round(desiredLeftAABB - minX);
        top_unrotatedTL  = Math.round(desiredTopAABB  - minY);
      }

      final_xwidth  = w0;
      final_xheight = h0;
      final_angle   = angle;

      transforms[slot] = {
        left: left_unrotatedTL,
        top:  top_unrotatedTL,
        scaleX: sx,
        scaleY: sy,
        angle: final_angle,
        flipX: !!t.flipX,
        flipY: !!t.flipY,
        originX: "left",
        originY: "top",
        xwidth: final_xwidth,
        xheight: final_xheight,
        skewX: 0,
        skewY: 0,
      };

      bboxes[slot] = {
        left: desiredLeftAABB,
        top:  desiredTopAABB,
        xwidth: Math.max(1, Math.round(bb.width)),
        xheight: Math.max(1, Math.round(bb.height)),
      };
    }

    layerMapping.push({
      fabricId: layer.id, fabricName: layer.name, channelId: slot, fabricIndex: layer.fabricIndex,
    });
  }

  const official: CompositorOfficial = { width: contentW, height: contentH, padding, transforms, bboxes };

  return {
    fabricDataJson: JSON.stringify(official),
    layerMapping, totalLayers: layers.length,
    outputSize: {
      width: contentW + padding * 2,
      height: contentH + padding * 2,
      contentWidth: contentW,
      contentHeight: contentH,
    },
    coordinateSystem: useArtboard ? "artboard" : "selection",
    worldFrame: {
      contentLeft: offsetX,   // 內容框(未含padding)的世界 left
      contentTop:  offsetY,   // 內容框(未含padding)的世界 top
      padding,                // 輸出用的 padding
    },
  };
}


/* =======================
   下面保留你的共用工具（原樣；僅補型別）
   ======================= */

export function prettifyCompositorJSON(json: string): string {
  try {
    const data = JSON.parse(json);
    return JSON.stringify(data, null, 2);
  } catch {
    return json;
  }
}

export function validateCompositorData(json: string): {
  valid: boolean;
  error?: string;
} {
  try {
    const data = JSON.parse(json) as CompositorData;

    if (!data.transforms || !data.boundingBoxes || !data.padding) {
      return {
        valid: false,
        error: "缺少必要欄位 (transforms, boundingBoxes, padding)",
      };
    }

    const transformChannels = Object.keys(data.transforms);
    const boundingBoxChannels = Object.keys(data.boundingBoxes);

    if (transformChannels.length === 0) {
      return { valid: false, error: "沒有任何圖層資料" };
    }
    if (transformChannels.length > 8) {
      return {
        valid: false,
        error: `圖層數量超過限制：${transformChannels.length} > 8`,
      };
    }
    if (transformChannels.length !== boundingBoxChannels.length) {
      return { valid: false, error: "transforms 和 boundingBoxes 數量不一致" };
    }

    for (const channelId of transformChannels) {
      const transform = data.transforms[channelId];
      const bbox = data.boundingBoxes[channelId];
      if (!transform || !bbox) {
        return { valid: false, error: `Channel ${channelId} 資料不完整` };
      }
      const requiredTransformProps = [
        "x",
        "y",
        "width",
        "height",
        "scaleX",
        "scaleY",
        "angle",
      ] as const;
      const requiredBboxProps = ["x", "y", "width", "height"] as const;
      for (const prop of requiredTransformProps) {
        if (!(prop in transform)) {
          return {
            valid: false,
            error: `Channel ${channelId} 的 transform 缺少屬性: ${prop}`,
          };
        }
      }
      for (const prop of requiredBboxProps) {
        if (!(prop in bbox)) {
          return {
            valid: false,
            error: `Channel ${channelId} 的 boundingBox 缺少屬性: ${prop}`,
          };
        }
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "JSON 格式錯誤",
    };
  }
}

export function getLayerMappingSummary(mapping: LayerMapping[]): string {
  if (mapping.length === 0) return "無圖層";
  const summary = mapping
    .map((m) => `${m.fabricName} → Channel ${m.channelId}`)
    .join(", ");
  return `共 ${mapping.length} 層: ${summary}`;
}

/** （保留）導出圖片與下載工具 —— 你的其他代碼用得到就留著 */
export function exportLayerAsImage(
  canvas: fabric.Canvas,
  layerId: string
): string | null {
  const object = canvas.getObjects().find((obj: fabric.Object) => {
    const d = obj as unknown as {
      data?: { id?: string; layerId?: string };
      id?: string;
      name?: string;
    };
    return (
      d?.data?.id === layerId ||
      d?.id === layerId ||
      d?.data?.layerId === layerId ||
      d?.name === layerId
    );
  }) as fabric.Object | undefined;

  if (!object) {
    console.error(`❌ 找不到圖層: ${layerId}`);
    return null;
  }

  const originalAngle = object.angle || 0;
  const originalLeft = object.left || 0;
  const originalTop = object.top || 0;
  const originalScaleX = object.scaleX || 1;
  const originalScaleY = object.scaleY || 1;

  const width = (object.width || 0) * originalScaleX;
  const height = (object.height || 0) * originalScaleY;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = Math.ceil(width);
  tempCanvas.height = Math.ceil(height);
  const ctx = tempCanvas.getContext("2d")!;

  object.set({
    angle: 0,
    left: width / 2,
    top: height / 2,
    originX: "center",
    originY: "center",
  });

  // 使用 private render，維持你原本寫法，這裡只做安全斷言避免 TS 報錯
  (
    object as unknown as { render: (c: CanvasRenderingContext2D) => void }
  ).render(ctx);

  object.set({
    angle: originalAngle,
    left: originalLeft,
    top: originalTop,
    originX: "left",
    originY: "top",
  });

  canvas.renderAll();
  return tempCanvas.toDataURL("image/png");
}

export function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
