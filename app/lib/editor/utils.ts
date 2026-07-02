import { AspectRatio, Clip, CanvasPreset } from './types';
import { EDITOR_TOKENS, CANVAS_PRESETS } from './constants';

/** 根據 canvasPresetId 取得對應的 AspectRatio */
export function getAspectRatioFromPreset(presetId: string): AspectRatio {
  const preset = CANVAS_PRESETS.find(p => p.id === presetId);
  return preset?.aspectRatio ?? '9:16';
}

/** 根據 canvasPresetId 取得預設物件 */
export function getPresetById(presetId: string): CanvasPreset | undefined {
  return CANVAS_PRESETS.find(p => p.id === presetId);
}

export function formatTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function fitStageInContainer(
  containerW: number,
  containerH: number,
  aspectRatio: AspectRatio,
  viewZoom: number = 1,
) {
  const base = EDITOR_TOKENS.stageBaseDimensions[aspectRatio];
  const ratio = base.width / base.height;
  
  // 先算 fit 大小（留 5% padding）
  const padW = containerW * 0.92;
  const padH = containerH * 0.92;
  let fitW: number;
  let fitH: number;
  
  if (padW / padH > ratio) {
    fitH = padH;
    fitW = fitH * ratio;
  } else {
    fitW = padW;
    fitH = fitW / ratio;
  }
  
  // 套用使用者縮放
  const width = fitW * viewZoom;
  const height = fitH * viewZoom;
  
  return {
    width,
    height,
    offsetX: (containerW - width) / 2,
    offsetY: (containerH - height) / 2,
    baseWidth: fitW,   // 縮放前基準
    baseHeight: fitH,
  };
}

export function transformToPixels(
  t: { x: number; y: number; width: number; height: number; rotation: number; contentX: number; contentY: number; contentWidth: number; contentHeight: number },
  stageW: number,
  stageH: number,
) {
  // 可見框
  const w = t.width * stageW;
  const h = t.height * stageH;
  // 內容
  const cw = t.contentWidth * stageW;
  const ch = t.contentHeight * stageH;
  // 內容中心相對可見框中心的偏移（像素）
  const cxOff = (t.contentX - t.x) * stageW;
  const cyOff = (t.contentY - t.y) * stageH;
  return {
    width: w,
    height: h,
    left: t.x * stageW - w / 2,
    top: t.y * stageH - h / 2,
    rotation: t.rotation,
    // 內容在可見框內的偏移 = 居中偏移 + 中心差
    contentOffsetX: (w - cw) / 2 + cxOff,
    contentOffsetY: (h - ch) / 2 + cyOff,
    contentWidth: cw,
    contentHeight: ch,
  };
}

/**
 * 根據內容原始尺寸計算在畫布中的等比適配 transform
 * （框跟內容完全吻合，不留白）
 */
export function fitContentTransform(
  contentNatW: number,
  contentNatH: number,
  canvasRatioW: number,
  canvasRatioH: number,
  maxFill: number = 0.85, // 最多佔畫布 85%
): { width: number; height: number; contentWidth: number; contentHeight: number } {
  // 內容的寬高比
  const contentAspect = contentNatW / contentNatH;
  // 畫布的寬高比
  const canvasAspect = canvasRatioW / canvasRatioH;

  let w: number, h: number;
  if (contentAspect > canvasAspect) {
    // 內容更寬 → 寬佔滿，高按比例
    w = maxFill;
    h = maxFill * (canvasAspect / contentAspect);
  } else {
    // 內容更高 → 高佔滿，寬按比例
    h = maxFill;
    w = maxFill * (contentAspect / canvasAspect);
  }

  return { width: w, height: h, contentWidth: w, contentHeight: h };
}

let idCounter = 0;
export function nextClipId(): string {
  return `clip-${Date.now()}-${++idCounter}`;
}

/**
 * 找出磁吸目標。回傳吸附後的 start 時間。
 * @param movingClipId 正在移動的 clip id
 * @param desiredStart 想要的 start 時間
 * @param duration clip 長度
 * @param allClips 所有其他 clips
 * @param playhead 目前 playhead 位置
 * @param thresholdSec 吸附門檻(秒)
 */
export function snapStart(
  movingClipId: string,
  desiredStart: number,
  duration: number,
  allClips: Clip[],
  playhead: number,
  thresholdSec: number,
): { start: number; snapped: boolean; snapLine: number | null } {
  const desiredEnd = desiredStart + duration;
  
  // 候選吸附點:其他 clip 的 start / end,加上 playhead 和 0
  const points: number[] = [0, playhead];
  for (const c of allClips) {
    if (c.id === movingClipId) continue;
    points.push(c.start);
    points.push(c.start + c.duration);
  }
  
  let bestStart = desiredStart;
  let bestDist = thresholdSec;
  let bestLine: number | null = null;
  
  for (const p of points) {
    // 用 clip 的開頭吸附
    const distStart = Math.abs(desiredStart - p);
    if (distStart < bestDist) {
      bestDist = distStart;
      bestStart = p;
      bestLine = p;
    }
    // 用 clip 的結尾吸附
    const distEnd = Math.abs(desiredEnd - p);
    if (distEnd < bestDist) {
      bestDist = distEnd;
      bestStart = p - duration;
      bestLine = p;
    }
  }
  
  return {
    start: Math.max(0, bestStart),
    snapped: bestLine !== null,
    snapLine: bestLine,
  };
}

/**
 * 找出滑鼠位置下的 clip(交換模式用)
 */
export function findClipUnderPoint(
  movingClipId: string,
  pointTimeSec: number,
  pointTrackId: string,
  allTracks: { id: string; clips: Clip[] }[],
): Clip | null {
  for (const t of allTracks) {
    if (t.id !== pointTrackId) continue;
    for (const c of t.clips) {
      if (c.id === movingClipId) continue;
      if (pointTimeSec >= c.start && pointTimeSec < c.start + c.duration) {
        return c;
      }
    }
  }
  return null;
}