// 工具組件統一導出
export { default as TextEditor } from './TextEditor';
export { default as ImageResizer } from './ImageResizer';
export { default as StyleSwitcher } from './StyleTransfer';
export { default as BackgroundRemover } from './BackgroundRemover';
export { default as ExpressionChanger } from './ExpressionChanger';
export { default as AreaEraser } from './AreaEraser';

// 工具類型定義
export interface ExpressionData {
  type: 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral';
  pose: 'standing' | 'sitting' | 'walking' | 'running' | 'dancing' | 'pointing' | 'waving' | 'neutral';
  intensity: number;
}

export interface EraseData {
  areas: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface StyleData {
  imageId: string;      // 照片 ID
  styleId: string;      // 風格 ID
  intensity: number;    // 效果強度 (%)
  styleName?: string;   // 風格名稱
  category?: string;    // 類別
  modelId?: string;     // 模型 ID
}

export interface ResizeData {
  width: number;
  height: number;
  format: string;
  quality: number;
  presetName: string;
}

export interface TextData {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

// 工具配置
export const TOOL_CONFIG = {
  'background-remove': {
    name: '一鍵去背',
    description: '自動偵測去背',
    component: 'BackgroundRemover',
    requiresAI: true
  },
  'add-text': {
    name: '增加文字',
    description: '貼字標語，打字功能',
    component: 'TextEditor',
    requiresAI: false
  },
  'area-eraser': {
    name: '魔法橡皮擦',
    description: '手動移除雜物',
    component: 'AreaEraser',
    requiresAI: false
  },
  'resize': {
    name: '快速調整圖片尺寸',
    description: '輸出格式非正方形',
    component: 'ImageResizer',
    requiresAI: false
  },
  'expression': {
    name: '改變表情/姿勢',
    description: '改變表情和姿勢',
    component: 'ExpressionChanger',
    requiresAI: true
  },
  'style-switch': {
    name: '風格切換',
    description: '切換到 100+ 種內建模型風格',
    component: 'StyleSwitcher',
    requiresAI: true
  }
} as const;

export type ToolId = keyof typeof TOOL_CONFIG; 