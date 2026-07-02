export type ClipType = 'video' | 'image' | 'audio' | 'text';
export type TrackType = 'video' | 'audio' | 'text';
export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

/** 畫布尺寸預設 */
export interface CanvasPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  category: string;        // 社群 / 影片 / 文件 ...
  aspectRatio: AspectRatio; // 最接近的 AspectRatio（for stage 計算）
}

export interface ClipTransform {
  x: number;            // 可見框中心點 X (normalized 0-1)
  y: number;            // 可見框中心點 Y (normalized 0-1)
  width: number;        // 可見框寬度 (normalized 0-1)
  height: number;       // 可見框高度 (normalized 0-1)
  rotation: number;
  opacity: number;
  /** 內容中心 X（裁切時不動，縮放/移動時跟 x 同步） */
  contentX: number;
  /** 內容中心 Y（裁切時不動，縮放/移動時跟 y 同步） */
  contentY: number;
  /** 內容寬度（裁切時不變，縮放時等比變） */
  contentWidth: number;
  /** 內容高度（裁切時不變，縮放時等比變） */
  contentHeight: number;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;      // normalized (相對畫布高度)
  color: string;
  fontWeight: 'normal' | 'bold';
  align: 'left' | 'center' | 'right';
  letterSpacing?: number; // px
  lineHeight?: number;    // 倍率 (e.g. 1.2)
}

export interface Clip {
  id: string;
  trackId: string;
  type: ClipType;
  start: number;
  duration: number;
  offset: number;
  sourceDuration?: number;
  src?: string;
  transform: ClipTransform;
  label: string;
  color: string;
  speed: number;
  volume: number;
  muted: boolean;
  text?: string;
  textStyle?: TextStyle;
}

export interface Track {
  id: string;
  type: TrackType;
  clips: Clip[];
  hidden: boolean;
}

export interface Project {
  id: string;
  name: string;
  canvasPresetId: string;  // 指向 CANVAS_PRESETS 中的 id
  fps: number;
  tracks: Track[];
}

export interface EditorState {
  project: Project;
  playhead: number;
  isPlaying: boolean;
  zoom: number;
  selectedClipId: string | null;
  isTrimming: boolean;
  editingTextId: string | null;
  /** 畫布內正在直接編輯文字的 clip id */
  inlineEditingClipId: string | null;
  /** 空白鍵按住中，畫布處於平移模式（禁止 play/pause） */
  canvasPanning: boolean;
  snapEnabled: boolean;
  swapMode: boolean;
  swapSourceId: string | null;
  swapTargetId: string | null;
  swapGhostOffset: number | null;
}

export const DEFAULT_TRANSFORM: ClipTransform = {
  x: 0.5,
  y: 0.5,
  width: 1,
  height: 1,
  rotation: 0,
  opacity: 1,
  contentX: 0.5,
  contentY: 0.5,
  contentWidth: 1,
  contentHeight: 1,
};

/** 文字 clip 的預設 transform：置中、合理大小 */
export const DEFAULT_TEXT_TRANSFORM: ClipTransform = {
  x: 0.5,
  y: 0.5,
  width: 0.6,
  height: 0.12,
  rotation: 0,
  opacity: 1,
  contentX: 0.5,
  contentY: 0.5,
  contentWidth: 0.6,
  contentHeight: 0.12,
};
