// types/index.tsx
import { LoraModel } from "@/payload-types";
import { ReactNode } from "react";

// 通用元件相關類型
export interface ButtonProps {
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "danger"; // 保留 'ghost' 變體
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export interface ImageCardProps {
  image: ImageData;
  onClick?: () => void;
}

export enum TaskStatus {
  IN_QUEUE = "IN_QUEUE", // Demand in Queue
  PROMPT_DELIVERING = "PROMPT_DELIVERING", // Prompt Delivering
  AI_PROCESSING = "AI_PROCESSING", // AI Server Progressing
  GENERATING = "GENERATING", // Image Generating
  PARTIAL_COMPLETE = "PARTIAL_COMPLETE",
  COMPLETED = "COMPLETED", // Completed
  FAILED = "FAILED",
}
// 圖像相關類型
export interface ImageData {
  id: string;
  publishedImageId: string;
  url: string;
  reactions: { likes: number; dislikes: number; collections: number };
  userReaction: {
    like: boolean;
    dislike: boolean;
    collecting: boolean;
    comment: string;
  };
  shortId?: string;
  //prompt: string;
  //style: ImageStyle
  //modelId: string;
  //timestamp: string;
  //status: TaskStatus;
}

export interface ImageDataGroup {
  id: string;
  publishedImages: ImageData[];
  expectedCount?: number;
  resultCount?: number;
  prompt: string;
  assistantMessage?: string;
  responseType?: "chat" | "generation";
  conversationId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  kind?: "image" | "video" | "audio" | "text" | "chat";
  //style: ImageStyle
  loraModel: string | { id: string; title: string };
  timestamp: string;
  status: TaskStatus;
  queue?: number;
  discardRecommended?: boolean;
  terminalAction?: string;
  failureCode?: string;
  failureMessage?: string;
  paramsSummary?: string;
  currentPhase?: string;
  currentLabel?: string;
  progressPercent?: number;
  activeResultIndex?: number;
  progressTrail?: Array<{
    phase?: string;
    label?: string;
    detail?: string;
    timestamp?: string;
    progressPercent?: number;
    resultCount?: number;
    expectedCount?: number;
  }>;
  requestSnapshot?: {
    uuid: string;
    endpoint: string;
    method: "POST";
    body: Record<string, unknown>;
    createdAt: string;
  };
  images?: {
    file?: File;
    name?: string;
    url?: string; // 從 API 獲取的原圖 URL
  }[];
}

export type ImageStyle =
  | "realistic"
  | "anime"
  | "digital-art"
  | "oil-painting"
  | "watercolor";

export interface StyleOption {
  id: ImageStyle;
  name: string;
}

export interface PendingJob {
  id: string;
  originalId: string;
  index: number;
  startTime: number;
  isPlaceholder?: boolean;
}

// 表單相關類型
export interface PromptFormProps {
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
  callback: () => void;
  setIsModelSelectorOpen: (open: boolean) => void;
  setShowModelDetails: (open: boolean) => void;
  selectedModel: LoraModel | null;
  setSelectedModel: (model: LoraModel | null) => void;
  initialTemplate?: {
    prompt?: string;
    type?: "image" | "video" | "audio" | "text" | "chat" | null;
    aspectRatio?: string;
    count?: number;
    modelId?: string;
    selectedImageUrl?: string;
  };
  retryGenerationRequest?: ImageDataGroup | null;
  onRetryGenerationRequestConsumed?: () => void;
  // 🆕 新增：通知父組件圖片風格轉換模式狀態變化
  onImageToImageModeChange?: (isImageToImageMode: boolean) => void;
}

// 圖庫相關類型
export interface GalleryContextType {
  images: ImageDataGroup[];
  models: { id: string; title: string }[];
  addImage: (image: ImageDataGroup) => void;
  updateImageQueue: (id: string, queue: number) => void;
  updateImage: (id: string, image: ImageDataGroup) => void;
  removeImage: (id: string) => void;
  clearAllImages: () => void;
  setImages: (images: ImageDataGroup[]) => void; // 確保此方法存在
}

export interface GalleryContextProviderProps {
  children: ReactNode;
}

export interface ImageGalleryProps {
  isLoading: boolean;
  isConversationLoading?: boolean;
  onRetryGeneration?: (group: ImageDataGroup) => void;
  // pendingJobs: PendingJob[]
}

export interface ImageModalProps {
  image: ImageData;
  onClose: () => void;
}

// API 相關類型 - 使用泛型但保持兼容性
export interface ApiResponse<T = unknown> {
  // 默認為 unknown 以保持兼容性
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// 錯誤處理相關類型
export interface ErrorState {
  message: string;
  details: unknown; // 使用 unknown 而非 any
  statusCode?: number;
}

// 主題相關類型
export interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

export interface ThemeProviderProps {
  children: ReactNode;
}

export interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  modelId: string; // 從 style 改為 modelId
  timestamp: string;
}

export interface PendingJob {
  id: string;
  originalId: string;
  index: number;
  startTime: number;
}

// 新增 AI 模型相關類型
export interface AIModelBasicSettings {
  sd15Position: string;
  defaultPosition: string;
  mainModel: string;
  sd15Model: string;
  styleModel: string;
  loraModel: string;
  denoise: number;
  promptMsg: string;
}

export interface AIModel {
  id: string;
  title: string;
  description: string;
  basicSettings: AIModelBasicSettings;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}
