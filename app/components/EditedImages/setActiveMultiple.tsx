// coverGuard.ts
import type { FabricObject } from "fabric";

type Base = {
  frameW: number;
  frameH: number;
  imageW: number;
  imageH: number;
  imageScale: number; // 等比（=scaleX=scaleY）
  offsetX: number;    // 圖心相對 frame 心的偏移（frame 本地座標）
  offsetY: number;
};

const BASES = new WeakMap<FabricObject, Base>();

function getActualSize(obj: FabricObject) {
  return {
    w: (obj.width || 0) * (obj.scaleX || 1),
    h: (obj.height || 0) * (obj.scaleY || 1),
  };
}
function safeRatio(a: number, b: number) { return b ? a / b : 1; }

function getCenter(obj: FabricObject) {
  return obj.getCenterPoint
    ? obj.getCenterPoint()
    : { x: (obj.left || 0) + (obj.width || 0)/2, y: (obj.top || 0) + (obj.height || 0)/2 };
}
function worldOffsetToFrameLocal(image: FabricObject, frame: FabricObject) {
  const fc = getCenter(frame);
  const ic = image.getCenterPoint ? image.getCenterPoint() : { x: image.left + (image.width || 0)/2, y: image.top + (image.height || 0)/2 };
  const dx = ic.x - fc.x;
  const dy = ic.y - fc.y;
  const ang = -((frame.angle || 0) * Math.PI / 180);
  const cos = Math.cos(ang), sin = Math.sin(ang);
  return { offsetX: dx * cos - dy * sin, offsetY: dx * sin + dy * cos };
}
function rotateLocalOffset(x: number, y: number, angleDeg: number) {
  const r = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

export type Pair = { frame: FabricObject; image: FabricObject };

export const coverGuard = {
  /** 在縮放開始時建立基準（只需呼叫一次） */
  begin(pairs: Pair[]) {
    for (const { frame, image } of pairs) {
      if (!frame || !image) continue;
      const f = getActualSize(frame);
      const imageW = (image.width || 1);
      const imageH = (image.height || 1);
      const imageScale = ((image.scaleX || 1) + (image.scaleY || 1)) / 2;
      const { offsetX, offsetY } = worldOffsetToFrameLocal(image, frame);
      BASES.set(image, {
        frameW: f.w,
        frameH: f.h,
        imageW,
        imageH,
        imageScale,
        offsetX,
        offsetY,
      });
    }
  },

  /** 在縮放過程中呼叫：會「只在將露邊時」補放大圖片（不動 frame） */
  handle(pairs: Pair[]) {
    for (const { frame, image } of pairs) {
      const base = BASES.get(image);
      if (!base) continue;

      // 當前 frame 世界尺寸
      const cur = getActualSize(frame);
      const sxLocal = safeRatio(cur.w, base.frameW);
      const syLocal = safeRatio(cur.h, base.frameH);

      // 偏移跟各向縮放
      const ox = base.offsetX * sxLocal;
      const oy = base.offsetY * syLocal;

      // 先讓圖片在縮小時跟著縮（放大時不跟）
      let imgScale = base.imageScale * Math.min(1, Math.min(sxLocal, syLocal));

      // 目前圖片等比半寬高
      const halfImgW0 = (base.imageW * imgScale) / 2;
      const halfImgH0 = (base.imageH * imgScale) / 2;

      // frame 半寬高
      const halfFrameW = cur.w / 2;
      const halfFrameH = cur.h / 2;

      // 依左右/上下拉的直覺各向判斷（把偏移量算進去）
      const needX = (halfFrameW + Math.abs(ox)) / Math.max(halfImgW0, 1e-6);
      const needY = (halfFrameH + Math.abs(oy)) / Math.max(halfImgH0, 1e-6);
      const need = Math.max(1, needX, needY);
      if (need > 1) imgScale *= need;

      // 實套：只動圖片縮放與位置（不改 frame）
      const angleNow = frame.angle || 0;
      image.set({ scaleX: imgScale, scaleY: imgScale });

      const fc = getCenter(frame);
      const pt = rotateLocalOffset(ox, oy, angleNow);
      image.set({ left: fc.x + pt.x, top: fc.y + pt.y });

      image.setCoords?.();
    }
  },

  /** 縮放結束可清理（可省略） */
  end(pairs: Pair[]) {
    for (const { image } of pairs) BASES.delete(image);
  },
};
