import {
  JSX,
  useContext,
  useState,
  useRef,
  useEffect,
  useMemo,
  Fragment,
  useCallback,
} from "react";
import { GalleryContext } from "./contexts/GalleryContext";
import { ImageGalleryProps, ImageData, ImageDataGroup, TaskStatus } from "./types";

import { useTranslations } from "next-intl";
import { showToast } from "../CustomToast";
import useReactions from "../EnhancedImageDisplay/useReactions";
import { Copy, PenSquare } from "lucide-react";
import ModernImageCard from "./ModernImageCard";
import ImageModal from "./ImageModal";
import CommentDialog from "../CommentDialog";
import { OriginalImageModal } from "./OriginalImageModal";

// 定義新的結構來表示圖片在全局陣列中的位置
interface FlatImageRef {
  image: ImageData;
  model: { id: string; title: string } | undefined;
  groupIndex: number;
  imageIndex: number;
  groupPrompt: string;
  kind?: string;
  queue?: number;
  status?: TaskStatus;
}

interface CommentReaction {
  comment?: string;
  imageId: string;
}

function sanitizeAssistantText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ChatTypingText({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming: boolean;
}): JSX.Element {
  const displayText = sanitizeAssistantText(text || "");
  const shouldShowWaiting = isStreaming && !displayText;

  return (
    <>
      {displayText ? (
        <>
          {displayText}
          {isStreaming && (
            <span className="ml-1 inline-block h-4 w-[2px] animate-pulse rounded-full bg-[#4f8fbd] align-[-2px] dark:bg-[#8fd8ff]" />
          )}
        </>
      ) : shouldShowWaiting ? (
        <span className="inline-flex items-center gap-1 py-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9bb4c8] [animation-delay:-0.3s] dark:bg-[#7f97ab]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9bb4c8] [animation-delay:-0.15s] dark:bg-[#7f97ab]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9bb4c8] dark:bg-[#7f97ab]" />
        </span>
      ) : null}
    </>
  );
}

function isChatGroup(group: {
  kind?: string;
  responseType?: string;
}): boolean {
  return group.kind === "chat" || group.responseType === "chat";
}

function isMediaGenerationGroup(group: {
  kind?: string;
  responseType?: string;
}): boolean {
  if (isChatGroup(group)) return false;
  if (!group.kind) return true;
  return group.kind === "image" || group.kind === "video" || group.kind === "audio";
}

function getExpectedImageCount(group: {
  expectedCount?: number;
  publishedImages?: Array<unknown>;
}): number {
  return Math.max(
    1,
    Number(group.expectedCount) ||
      (Array.isArray(group.publishedImages) ? group.publishedImages.length : 0) ||
      1
  );
}

function getActualImageCount(group: {
  resultCount?: number;
  publishedImages?: Array<{ url?: string }>;
}): number {
  if (Array.isArray(group.publishedImages)) {
    const urlCount = group.publishedImages.filter((image) => Boolean(image?.url)).length;
    if (urlCount > 0 || group.publishedImages.length > 0) {
      return urlCount;
    }
  }

  return typeof group.resultCount === "number" ? Math.max(0, group.resultCount) : 0;
}

function isTerminalEmptyGenerationGroup(group: ImageDataGroup): boolean {
  if (isChatGroup(group)) return false;
  const isTerminal =
    group.status === TaskStatus.COMPLETED ||
    group.status === TaskStatus.PARTIAL_COMPLETE ||
    group.status === TaskStatus.FAILED;

  return isTerminal && getActualImageCount(group) === 0;
}

function getResultSlots(group: ImageDataGroup): ImageData[] {
  if (Array.isArray(group.publishedImages) && group.publishedImages.length > 0) {
    return group.publishedImages;
  }

  return Array.from({ length: getExpectedImageCount(group) }, (_, index) => ({
    id: group.id + "-placeholder-" + index,
    publishedImageId: group.id + "-placeholder-" + index,
    url: "",
    reactions: { likes: 0, dislikes: 0, collections: 0 },
    userReaction: {
      like: false,
      dislike: false,
      collecting: false,
      comment: "",
    },
  }));
}

function getSlotProgressState(
  group: ImageDataGroup,
  image: ImageData,
  imageIndex: number
): {
  isCompleted: boolean;
  isActive: boolean;
  label: string;
  progressPercent?: number;
} {
  if (image.url) {
    return {
      isCompleted: true,
      isActive: false,
      label: "已完成",
      progressPercent: 100,
    };
  }

  const slots = Array.isArray(group.publishedImages) ? group.publishedImages : [];
  const firstMissingIndex = slots.findIndex((slot) => !slot?.url);
  const activeResultIndex =
    firstMissingIndex >= 0
      ? firstMissingIndex
      : typeof group.activeResultIndex === "number"
        ? Math.max(0, group.activeResultIndex)
        : getActualImageCount(group);

  const activeIndex = Math.min(
    activeResultIndex,
    Math.max(getExpectedImageCount(group) - 1, 0)
  );
  const isActive = !isGenerationDone(group) && imageIndex === activeIndex;

  if (isActive) {
    return {
      isCompleted: false,
      isActive: true,
      label: getGenerationStageLabel(group),
      progressPercent: getGenerationProgressPercent(group),
    };
  }

  return {
    isCompleted: false,
    isActive: false,
    label: imageIndex > activeIndex ? "等待前一張完成後開始" : "排隊中",
    progressPercent: 0,
  };
}

function ResultSlot({
  group,
  image,
  imageIndex,
  modelName,
  onSelect,
  onReaction,
  onCollect,
  onSelectForGeneration,
  isSelectedForGeneration,
}: {
  group: ImageDataGroup;
  image: ImageData;
  imageIndex: number;
  modelName?: string;
  onSelect: () => void;
  onReaction: (type: "like" | "dislike") => void;
  onCollect: () => void;
  onSelectForGeneration: () => void;
  isSelectedForGeneration: boolean;
}): JSX.Element {
  if (image.url) {
    const isVideoAsset = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(image.url || "") || group.kind === "video";
    const isAudioAsset = /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(image.url || "") || group.kind === "audio";

    return (
      <ModernImageCard
        prompt={group.prompt}
        image={image}
        modelName={modelName}
        onClick={onSelect}
        handleReaction={onReaction}
        handleCollectReaction={onCollect}
        onSelectForGeneration={onSelectForGeneration}
        isSelectedForGeneration={isSelectedForGeneration}
        canSelectForGeneration={!isVideoAsset && !isAudioAsset}
        mediaKind={group.kind}
      />
    );
  }

  if (group.status === TaskStatus.FAILED) {
    return <FailedResultCard taskId={group.id} message={group.failureMessage || group.failureCode || group.id} retryLabel="Retry" />;
  }

  const slotState = getSlotProgressState(group, image, imageIndex);

  return (
    <ImagePlaceholder
      taskId={group.id}
      label={slotState.label}
      progressPercent={slotState.progressPercent}
      isQueued={!slotState.isActive}
    />
  );
}

function getResultUnitLabel(group: {
  kind?: string;
  responseType?: string;
}): string {
  if (group.kind === "video") {
    return "支影片";
  }

  if (group.kind === "audio") {
    return "段音訊";
  }

  if (group.kind === "text" || group.kind === "chat" || group.responseType === "chat") {
    return "則結果";
  }

  return "張圖片";
}

function getGenerationNoun(group: {
  kind?: string;
  responseType?: string;
}): string {
  if (group.kind === "video") return "影片";
  if (group.kind === "audio") return "音訊";
  if (group.kind === "text" || group.kind === "chat" || group.responseType === "chat") return "回覆";
  return "圖片";
}

function isGenerationDone(group: {
  status?: TaskStatus;
  expectedCount?: number;
  resultCount?: number;
  publishedImages?: Array<{ url?: string }>;
  responseType?: string;
  kind?: string;
}): boolean {
  const expected = getExpectedImageCount(group);
  const actual = getActualImageCount(group);
  const isGenerationGroup = group.responseType !== "chat" && group.kind !== "chat";

  if (group.status === TaskStatus.FAILED) {
    return true;
  }

  if (group.status === TaskStatus.COMPLETED) {
    // 圖片/影片/音訊型任務若尚未達到預期數量，不視為完成，避免提早結束 loading
    if (isGenerationGroup && actual < expected) {
      return false;
    }
    return true;
  }

  return actual >= expected;
}

function getResultProgressText(
  group: {
    status?: TaskStatus;
    expectedCount?: number;
    resultCount?: number;
    publishedImages?: Array<{ url?: string }>;
    kind?: string;
    responseType?: string;
  },
  t: (key: string, fallback: string) => string
): string {
  const actual = getActualImageCount(group);
  const expected = getExpectedImageCount(group);
  const unit = getResultUnitLabel(group);

  if (group.status === TaskStatus.FAILED) {
    return `${t("failed", "生成失敗")} ${actual} / ${expected} ${unit}`;
  }

  if (isGenerationDone(group)) {
    return `${t("completed", "已完成")} ${actual} / ${expected} ${unit}`;
  }

  if (actual > 0) {
    return `已完成 ${actual} / ${expected} ${unit}，剩餘仍在處理中`;
  }

  if (group.status === TaskStatus.IN_QUEUE) {
    return `排隊中 0 / ${expected} ${unit}`;
  }

  return `正在生成 0 / ${expected} ${unit}`;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getGenerationProgressPercent(group: ImageDataGroup): number {
  if (typeof group.progressPercent === "number") {
    return clampProgress(group.progressPercent);
  }

  if (group.status === TaskStatus.IN_QUEUE) return 6;
  if (group.status === TaskStatus.PROMPT_DELIVERING) return 18;
  if (group.status === TaskStatus.AI_PROCESSING) return 45;
  if (group.status === TaskStatus.GENERATING) return 58;
  if (group.status === TaskStatus.PARTIAL_COMPLETE) return 82;
  if (group.status === TaskStatus.COMPLETED) return 100;
  if (group.status === TaskStatus.FAILED) return 100;
  return 24;
}

function getGenerationStageLabel(group: ImageDataGroup): string {
  if (group.currentLabel) return group.currentLabel;
  const noun = getGenerationNoun(group);
  if (isChatGroup(group) && group.status === TaskStatus.PROMPT_DELIVERING) {
    return "正在理解需求與讀取上下文";
  }
  if (group.status === TaskStatus.IN_QUEUE) return "正在排隊等待模型";
  if (group.status === TaskStatus.PROMPT_DELIVERING) return "正在整理提示詞與參考資料";
  if (group.status === TaskStatus.AI_PROCESSING) return `模型正在生成${noun}`;
  if (group.status === TaskStatus.GENERATING) return `模型正在生成${noun}`;
  if (group.status === TaskStatus.PARTIAL_COMPLETE) return "部分結果已回傳";
  if (group.status === TaskStatus.FAILED) return "生成失敗";
  return "正在準備生成";
}

function getGenerationStageDetail(group: ImageDataGroup): string {
  const latest = group.progressTrail?.[group.progressTrail.length - 1];
  if (latest?.detail) return latest.detail;
  if (latest?.label) return latest.label;

  if (isChatGroup(group) && group.status === TaskStatus.PROMPT_DELIVERING) {
    return "正在讀取最近對話、參考圖與你選擇的模型設定，再判斷這次是回覆問題還是建立生成任務。";
  }

  const hasReferences = (group.images?.length || 0) > 0;
  if (group.status === TaskStatus.PROMPT_DELIVERING) {
    return hasReferences
      ? "正在讀取參考圖，並把你的文字需求整理成模型能理解的生成指令。"
      : "正在理解你的需求，並搜尋可參考的模板風格。";
  }
  if (group.status === TaskStatus.AI_PROCESSING || group.status === TaskStatus.GENERATING) {
    if (group.kind === "video") {
      return "影片模型正在處理畫面、運鏡與時長，完成後會自動補上，不需要重新送出。";
    }
    if (group.kind === "audio") {
      return "音訊模型正在處理語氣、節奏與音色，完成後會自動補上。";
    }
    return "圖片模型正在處理構圖、風格與細節，結果會自動補上。";
  }
  return "不用重新整理頁面，完成後結果會出現在這裡。";
}

function getGenerationSteps(group: ImageDataGroup): Array<{ label: string; active: boolean; done: boolean }> {
  const progress = getGenerationProgressPercent(group);
  const hasReferences = (group.images?.length || 0) > 0;
  const generationNoun = getGenerationNoun(group);
  const steps = isChatGroup(group)
    ? ["讀取上下文", "理解需求", "判斷路由", "準備回覆", "更新畫面"]
    : [
        hasReferences ? "讀取參考圖" : "理解需求",
        "搜尋參考模板",
        "整理提示詞",
        "送出模型",
        `生成${generationNoun}`,
        "回傳結果",
      ];
  const thresholds = steps.length === 5 ? [8, 24, 42, 68, 94] : [8, 18, 30, 42, 72, 96];
  const nextThresholds = steps.length === 5 ? [24, 42, 68, 94, 101] : [18, 30, 42, 72, 96, 101];

  return steps.map((label, index) => {
    const threshold = thresholds[index];
    const nextThreshold = nextThresholds[index];
    return {
      label,
      done: progress >= threshold,
      active: progress >= threshold && progress < nextThreshold,
    };
  });
}

function GenerationProgressPanel({ group }: { group: ImageDataGroup }): JSX.Element {
  const progress = getGenerationProgressPercent(group);
  const steps = getGenerationSteps(group);
  const trail = group.progressTrail?.slice(-5) || [];
  const activeStepIndex = Math.max(
    0,
    steps.findIndex((step) => step.active)
  );
  const currentStep = steps[activeStepIndex] || steps[0];
  const visibleSteps =
    trail.length > 0
      ? trail.map((step) => ({
          key: `${step.phase || "trail"}-${step.timestamp || step.label || step.detail}`,
          label: step.label || step.detail || step.phase || currentStep?.label || getGenerationStageLabel(group),
          detail: step.detail,
          progressPercent: step.progressPercent,
        }))
      : [
          {
            key: "current",
            label: currentStep?.label || getGenerationStageLabel(group),
            detail: getGenerationStageDetail(group),
            progressPercent: progress,
          },
        ];

  return (
    <div className="mb-4 w-full max-w-3xl rounded-3xl border border-[#cfe2ef] bg-white/62 p-4 text-[#31526b] shadow-[0_16px_44px_rgba(35,83,118,0.10)] backdrop-blur-md dark:border-white/10 dark:bg-[#0f1b25]/82 dark:text-[#b9d4e8] dark:shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
      <div className="flex items-start gap-3">
        <span className="relative mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f7ff] dark:bg-[#123044]">
          <span className="absolute h-8 w-8 animate-ping rounded-full bg-[#49c9ff]/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#49c9ff] shadow-[0_0_16px_rgba(73,201,255,0.55)]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm font-semibold tracking-[0.01em] text-[#24445f] dark:text-[#d9efff]">
              {getGenerationStageLabel(group)}
            </p>
            <span className="text-xs font-medium text-[#6d879b] dark:text-[#86a4ba]">
              {progress}%
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#6d879b] dark:text-[#8fa8bb]">
            {getGenerationStageDetail(group)}
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#d9e6ef] dark:bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#2fb9ff] via-[#7bdcff] to-[#2fb9ff] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <details className="group mt-3">
        <summary className="cursor-pointer list-none text-xs font-medium text-[#5f7f97] transition hover:text-[#315f7e] dark:text-[#8ba5b8] dark:hover:text-[#d9efff]">
          <span className="inline-flex items-center gap-2">
            <span>{currentStep?.label || getGenerationStageLabel(group)}</span>
            <span className="text-[10px] text-[#8aa1b2] group-open:hidden">展開流程</span>
            <span className="hidden text-[10px] text-[#8aa1b2] group-open:inline">收合流程</span>
          </span>
        </summary>
        <div className="mt-3 border-l border-[#d3e3ee] pl-3 dark:border-white/10">
          {visibleSteps.map((step, index) => {
            const isCurrent = index === visibleSteps.length - 1;
            return (
              <div
                key={step.key}
                className={`relative pb-2 text-xs leading-5 last:pb-0 ${
                  isCurrent
                    ? "text-[#42647c] dark:text-[#a9c6da]"
                    : "text-[#8ba0af] dark:text-[#647889]"
                }`}
              >
                <span
                  className={`absolute -left-[17px] top-[7px] h-2 w-2 rounded-full ${
                    isCurrent
                      ? "bg-[#49c9ff] shadow-[0_0_12px_rgba(73,201,255,0.55)]"
                      : "bg-[#8fcce8] dark:bg-[#5b9bb6]"
                  }`}
                />
                <span className={isCurrent ? "font-semibold text-[#214b68] dark:text-[#dff4ff]" : ""}>
                  {step.label}
                </span>
                {step.detail && step.detail !== step.label ? (
                  <span className="block text-[11px] text-[#7891a5] dark:text-[#7f98aa]">
                    {step.detail}
                  </span>
                ) : null}
                {typeof step.progressPercent === "number" ? (
                  <span className="ml-2 text-[10px] text-[#8aa1b2]">
                    {step.progressPercent}%
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

// 載入佔位符：保持與完成後的圖片卡相同外框與比例
const ImagePlaceholder = ({
  label,
  progressPercent,
  isQueued = false,
}: {
  taskId: string;
  label?: string;
  progressPercent?: number;
  isQueued?: boolean;
}): JSX.Element => (
  <div className="relative overflow-hidden rounded-2xl border border-[#d8e8f3] bg-white shadow-sm dark:border-white/10 dark:bg-[#111b25]">
    <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#edf6fc] dark:bg-[#111b25]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(74,207,255,0.22),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.7),transparent_48%)] dark:bg-[radial-gradient(circle_at_28%_18%,rgba(74,207,255,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_45%)]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/70 shadow-[0_14px_36px_rgba(52,117,159,0.16)] backdrop-blur-sm dark:bg-white/10 dark:shadow-none">
            <div className="absolute inset-0 rounded-full border-2 border-[#46c9ff]/20" />
            <div className={`h-9 w-9 rounded-full border-4 border-[#46c9ff]/25 ${
              isQueued ? "border-dashed border-t-[#9dc7df]" : "animate-spin border-t-[#46c9ff]"
            }`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#24445f] dark:text-[#dff6ff]">
              {label || "正在生成圖片"}
            </p>
            {typeof progressPercent === "number" ? (
              <p className="mt-1 text-xs text-[#6f8da3] dark:text-[#9fb8cc]">{progressPercent}%</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0">
        <div className="bg-white/45 px-3 py-2 backdrop-blur-[2px] dark:bg-black/10">
          <div className="h-1.5 overflow-hidden rounded-full bg-[#d7e8f4] dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[#46c9ff] transition-all duration-500"
              style={{ width: `${typeof progressPercent === "number" ? Math.max(progressPercent, isQueued ? 0 : 24) : isQueued ? 0 : 24}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);

function FailedResultCard({
  taskId,
  message,
  onRetry,
  retryLabel,
}: {
  taskId: string;
  message?: string;
  onRetry?: () => void;
  retryLabel: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-red-500/25 bg-red-950/10 p-4 text-red-100 dark:bg-red-500/10">
      <p className="text-sm font-semibold">生成失敗</p>
      <p className="mt-1 break-all text-xs leading-5 text-red-200/80">
        {message || taskId}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-400"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

export default function ImageGallery({
  isConversationLoading = false,
  onRetryGeneration,
}: ImageGalleryProps): JSX.Element {
  const { 
    images, 
    setImages, 
    selectedImageForGeneration, 
    setSelectedImageForGeneration 
  } = useContext(GalleryContext);
  const [selectedImageRef, setSelectedImageRef] = useState<FlatImageRef | null>(
    null
  );

  // 🔧 修正 1: 添加防抖機制，防止快速點擊
  const [isProcessing, setIsProcessing] = useState(false);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🔧 修正 2: 添加 Modal 狀態鎖，防止同時開啟多個 Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalTransitionRef = useRef(false);

  // 💬 新增：留言功能相關狀態
  const [openCommentDialog, setCommentDialogOpen] = useState<boolean>(false);
  const [showComment, setShowComment] = useState<CommentReaction>({
    imageId: "",
    comment: "",
  });

  // 🖼️ 新增：原圖放大查看狀態
  const [showOriginalImageModal, setShowOriginalImageModal] =
    useState<boolean>(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>();

  const t = useTranslations("gallery");

  // 創建扁平化的圖片陣列，方便導航
  const flattenedImages = useMemo(() => {
    const result: FlatImageRef[] = [];

    images.forEach((group, groupIndex) => {
      if (group.publishedImages && Array.isArray(group.publishedImages)) {
        group.publishedImages.forEach((image, imageIndex) => {
          result.push({
            image,
            model: group.loraModel as { id: string; title: string },
            groupIndex,
            imageIndex,
            groupPrompt: group.prompt || "",
            kind: group.kind,
          });
        });
      }
    });

    return result;
  }, [images]);

  // 計算當前選中圖片在扁平陣列中的索引
  const currentFlatIndex = useMemo(() => {
    if (!selectedImageRef) return -1;

    return flattenedImages.findIndex(
      (ref) =>
        ref.groupIndex === selectedImageRef.groupIndex &&
        ref.imageIndex === selectedImageRef.imageIndex
    );
  }, [selectedImageRef, flattenedImages]);

  // 🔧 修正 3: 優化圖片選擇處理，添加防抖和狀態檢查
  const handleImageSelect = useCallback(
    (
      image: ImageData,
      model: { id: string; title: string } | undefined,
      groupIndex: number,
      imageIndex: number,
      groupPrompt: string,
      kind?: string
    ) => {
      // 防止快速點擊和重複處理
      if (isProcessing || modalTransitionRef.current) {
        // console.log("處理中，忽略點擊");
        return;
      }

      // 檢查是否點擊了同一張圖片
      if (
        selectedImageRef &&
        selectedImageRef.groupIndex === groupIndex &&
        selectedImageRef.imageIndex === imageIndex
      ) {
        // console.log("點擊同一張圖片，忽略");
        return;
      }

      setIsProcessing(true);
      modalTransitionRef.current = true;

      // 清除之前的 timeout
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }

      try {
        setSelectedImageRef({
          image,
          model,
          groupIndex,
          imageIndex,
          groupPrompt,
          kind,
        });
        setIsModalOpen(true);
      } catch (error) {
        console.error("選擇圖片時發生錯誤:", error);
      }

      // 設置處理完成的延遲
      processingTimeoutRef.current = setTimeout(() => {
        setIsProcessing(false);
        modalTransitionRef.current = false;
      }, 300); // 300ms 防抖延遲
    },
    [isProcessing, selectedImageRef]
  );

  // 🔧 修正 4: 優化 Modal 關閉處理
  const handleModalClose = useCallback(() => {
    if (modalTransitionRef.current) {
      return; // 防止在轉換過程中關閉
    }

    modalTransitionRef.current = true;
    setIsModalOpen(false);

    // 延遲清除選中的圖片，確保動畫完成
    setTimeout(() => {
      setSelectedImageRef(null);
      modalTransitionRef.current = false;
    }, 150);
  }, []);

  // 🔧 修正 5: 優化導航處理函數，添加邊界檢查和防抖
  const handlePrevious = useCallback(() => {
    if (isProcessing || modalTransitionRef.current || currentFlatIndex <= 0) {
      return;
    }

    setIsProcessing(true);
    modalTransitionRef.current = true;

    try {
      const newIndex = currentFlatIndex - 1;
      if (newIndex >= 0 && flattenedImages[newIndex]) {
        setSelectedImageRef(flattenedImages[newIndex]);
      }
    } catch (error) {
      console.error("導航到上一張圖片時發生錯誤:", error);
    }

    setTimeout(() => {
      setIsProcessing(false);
      modalTransitionRef.current = false;
    }, 200);
  }, [isProcessing, currentFlatIndex, flattenedImages]);

  const handleNext = useCallback(() => {
    if (
      isProcessing ||
      modalTransitionRef.current ||
      currentFlatIndex >= flattenedImages.length - 1
    ) {
      return;
    }

    setIsProcessing(true);
    modalTransitionRef.current = true;

    try {
      const newIndex = currentFlatIndex + 1;
      if (newIndex < flattenedImages.length && flattenedImages[newIndex]) {
        setSelectedImageRef(flattenedImages[newIndex]);
      }
    } catch (error) {
      console.error("導航到下一張圖片時發生錯誤:", error);
    }

    setTimeout(() => {
      setIsProcessing(false);
      modalTransitionRef.current = false;
    }, 200);
  }, [isProcessing, currentFlatIndex, flattenedImages]);

  // 🔧 修正 6: 添加鍵盤事件處理，並包含防抖機制
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isModalOpen || isProcessing) return;

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          handleModalClose();
          break;
        case "ArrowLeft":
          event.preventDefault();
          handlePrevious();
          break;
        case "ArrowRight":
          event.preventDefault();
          handleNext();
          break;
      }
    };

    if (isModalOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // 防止背景滾動
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isModalOpen, isProcessing, handleModalClose, handlePrevious, handleNext]);

  // 🔧 修正 7: 清理 effect，防止內存洩漏
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  // 計算是否應該顯示內容
  const hasImages = flattenedImages.length > 0;
  const hasGroups = images.length > 0;
  const shouldShowContent = hasGroups || hasImages;
  const renderedGroups = useMemo(() => {
    const visibleGroups = images.filter(
      (group) => !isTerminalEmptyGenerationGroup(group)
    );
    const uniqueGroups: typeof visibleGroups = [];
    const seenFingerprints = new Set<string>();

    visibleGroups.forEach((group) => {
      const imageIds = (group.publishedImages || [])
        .map((image) => image.publishedImageId || image.id || image.url || "")
        .join(",");
      const fingerprint = [
        group.id || "",
        group.responseType || "",
        group.kind || "",
        group.conversationId || "",
        group.userMessageId || "",
        group.assistantMessageId || "",
        group.prompt || "",
        group.assistantMessage || "",
        imageIds,
      ].join("|");

      if (seenFingerprints.has(fingerprint)) {
        return;
      }
      seenFingerprints.add(fingerprint);
      uniqueGroups.push(group);
    });

    return uniqueGroups;
  }, [images]);

  const { toggleReaction, toggleReactionComment } = useReactions();
  const leftPerson = { name: "PSF", avatar: "AI" };
  const rightPerson = { name: "You", avatar: "你" };
  const tx = useCallback(
    (key: string, fallback: string) => {
      const value = t(key);
      if (!value || value === key || value.endsWith(`.${key}`)) {
        return fallback;
      }
      return value;
    },
    [t]
  );

  // 複製到剪貼板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("copied_to_clipboard") || "已複製到剪貼板");
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  // 🔧 修正 8: 優化反應處理，添加錯誤處理和防重複提交
  const handleReaction = useCallback(
    async (imageId: string, reactionType: "like" | "dislike") => {
      // 防止重複提交
      if (isProcessing) {
        // console.log("正在處理中，忽略反應");
        return;
      }

      const groupIndex = images.findIndex((group) =>
        group.publishedImages.some(
          (image) => image.publishedImageId === imageId
        )
      );

      if (groupIndex === -1) {
        console.error("找不到對應的群組");
        return;
      }

      const imageIndex = images[groupIndex].publishedImages.findIndex(
        (image) => image.publishedImageId === imageId
      );

      if (imageIndex === -1) {
        console.error("找不到對應的圖片");
        return;
      }

      setIsProcessing(true);

      try {
        const updatedMessages = [...images];
        const currentImage =
          updatedMessages[groupIndex].publishedImages[imageIndex];
        const wasLiked = currentImage?.userReaction?.like;
        const wasDisliked = currentImage?.userReaction?.dislike;

        // 互斥邏輯：讚和踩不能同時存在
        let newLikeState = false;
        let newDislikeState = false;

        if (reactionType === "like") {
          if (wasLiked) {
            newLikeState = false;
            newDislikeState = false;
          } else {
            newLikeState = true;
            newDislikeState = false;
          }
        } else if (reactionType === "dislike") {
          if (wasDisliked) {
            newLikeState = false;
            newDislikeState = false;
          } else {
            newLikeState = false;
            newDislikeState = true;
          }
        }

        // 更新圖片的反應狀態
        updatedMessages[groupIndex].publishedImages[imageIndex] = {
          ...currentImage,
          userReaction: {
            ...currentImage.userReaction,
            like: newLikeState,
            dislike: newDislikeState,
          },
          reactions: {
            ...currentImage.reactions,
            likes: newLikeState
              ? wasLiked
                ? currentImage.reactions.likes
                : currentImage.reactions.likes + 1
              : wasLiked
              ? currentImage.reactions.likes - 1
              : currentImage.reactions.likes,
            dislikes: newDislikeState
              ? wasDisliked
                ? currentImage.reactions.dislikes
                : currentImage.reactions.dislikes + 1
              : wasDisliked
              ? currentImage.reactions.dislikes - 1
              : currentImage.reactions.dislikes,
          },
        };

        // 同步更新 selectedImageRef
        if (
          selectedImageRef &&
          selectedImageRef.groupIndex === groupIndex &&
          selectedImageRef.imageIndex === imageIndex
        ) {
          setSelectedImageRef({
            ...selectedImageRef,
            image: updatedMessages[groupIndex].publishedImages[imageIndex],
          });
        }

        setImages(updatedMessages);

        // 呼叫 API 更新後端
        await toggleReaction(imageId, reactionType);
      } catch (error) {
        console.error("處理反應時發生錯誤:", error);
        showToast(t("reaction_failed") || "操作失敗，請稍後再試", true);
      } finally {
        // 延遲重置處理狀態
        setTimeout(() => {
          setIsProcessing(false);
        }, 300);
      }
    },
    [toggleReaction, images, selectedImageRef, setImages, isProcessing, t]
  );

  // 🔧 修正 9: 優化收藏反應處理
  const handleCollectReaction = useCallback(
    async (imageId: string) => {
      if (isProcessing) {
        console.log("正在處理中，忽略收藏操作");
        return;
      }

      const groupIndex = images.findIndex((group) =>
        group.publishedImages.some(
          (image) => image.publishedImageId === imageId
        )
      );

      if (groupIndex === -1) return;

      const imageIndex = images[groupIndex].publishedImages.findIndex(
        (image) => image.publishedImageId === imageId
      );

      if (imageIndex === -1) return;

      setIsProcessing(true);

      try {
        const updatedMessages = [...images];
        const currentImage =
          updatedMessages[groupIndex].publishedImages[imageIndex];
        const wasCollected = currentImage?.userReaction?.collecting || false;

        // 更新收藏狀態
        updatedMessages[groupIndex].publishedImages[imageIndex] = {
          ...currentImage,
          userReaction: {
            ...currentImage.userReaction,
            collecting: !wasCollected,
          },
          reactions: {
            ...currentImage.reactions,
            collections: wasCollected
              ? (currentImage.reactions.collections || 0) - 1
              : (currentImage.reactions.collections || 0) + 1,
          },
        };

        // 同步更新 selectedImageRef
        if (
          selectedImageRef &&
          selectedImageRef.groupIndex === groupIndex &&
          selectedImageRef.imageIndex === imageIndex
        ) {
          setSelectedImageRef({
            ...selectedImageRef,
            image: updatedMessages[groupIndex].publishedImages[imageIndex],
          });
        }

        setImages(updatedMessages);

        // 呼叫收藏 API
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SERVER_URL}/image/${imageId}/reaction`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              reactionType: "collecting",
            }),
          }
        );

        if (!response.ok) throw new Error("Failed to toggle collect");
      } catch (error) {
        console.error("Collect failed:", error);

        // 如果 API 失敗，回滾狀態
        const updatedMessages = [...images];
        const currentImage =
          updatedMessages[groupIndex].publishedImages[imageIndex];
        updatedMessages[groupIndex].publishedImages[imageIndex] = currentImage;
        setImages(updatedMessages);
      } finally {
        setTimeout(() => {
          setIsProcessing(false);
        }, 300);
      }
    },
    [images, selectedImageRef, setImages, isProcessing]
  );

  // 💬 新增：處理留言功能
  const handleCommentClick = useCallback(
    (imageId: string) => {
      // 找到對應的圖片以獲取現有留言
      const groupIndex = images.findIndex((group) =>
        group.publishedImages.some(
          (image) => image.publishedImageId === imageId
        )
      );

      if (groupIndex === -1) return;

      const imageIndex = images[groupIndex].publishedImages.findIndex(
        (image) => image.publishedImageId === imageId
      );

      if (imageIndex === -1) return;

      const currentImage = images[groupIndex].publishedImages[imageIndex];

      // 設置留言對話框的初始狀態
      setShowComment({
        imageId,
        comment: currentImage?.userReaction?.comment || "",
      });
      setCommentDialogOpen(true);
    },
    [images]
  );

  // 💬 新增：提交留言反應
  const submitReactionComment = useCallback(
    async (commentData: CommentReaction) => {
      const { imageId, comment } = commentData;

      const groupIndex = images.findIndex((group) =>
        group.publishedImages.some(
          (image) => image.publishedImageId === imageId
        )
      );

      if (groupIndex === -1) {
        console.error("找不到對應的群組");
        return;
      }

      const imageIndex = images[groupIndex].publishedImages.findIndex(
        (image) => image.publishedImageId === imageId
      );

      if (imageIndex === -1) {
        console.error("找不到對應的圖片");
        return;
      }

      try {
        const updatedMessages = [...images];

        // 更新圖片的留言狀態
        updatedMessages[groupIndex].publishedImages[imageIndex] = {
          ...updatedMessages[groupIndex].publishedImages[imageIndex],
          userReaction: {
            ...updatedMessages[groupIndex].publishedImages[imageIndex]
              .userReaction,
            comment: comment || "",
          },
        };

        // 同步更新 selectedImageRef
        if (
          selectedImageRef &&
          selectedImageRef.groupIndex === groupIndex &&
          selectedImageRef.imageIndex === imageIndex
        ) {
          setSelectedImageRef({
            ...selectedImageRef,
            image: updatedMessages[groupIndex].publishedImages[imageIndex],
          });
        }

        setImages(updatedMessages);

        // 呼叫 API 更新後端留言
        await toggleReactionComment(imageId, comment || "");

        // 關閉留言對話框
        setCommentDialogOpen(false);

        // 顯示成功提示
        showToast(
          comment
            ? t("comment_saved") || "留言已保存"
            : t("comment_deleted") || "留言已刪除"
        );
      } catch (error) {
        console.error("處理留言時發生錯誤:", error);
        showToast(t("comment_failed") || "留言操作失敗，請稍後再試", true);

        // API 失敗時不需要回滾狀態，因為我們先更新了 UI
        // 用戶體驗更好，錯誤會通過 toast 提示
      }
    },
    [toggleReactionComment, images, selectedImageRef, setImages, t]
  );

  // 🖼️ 新增：處理原圖點擊放大
  const handleOriginalImageClick = useCallback(
    (originalImage: { file?: File; name?: string; url?: string }) => {
      setShowOriginalImageModal(true);
      setOriginalImageUrl(originalImage.url);
    },
    [setSelectedImageForGeneration, t]
  );

  // 🖼️ 移除重複的 useMemo，避免衝突

  // 🖼️ 新增：關閉原圖放大視窗
  const handleCloseOriginalImageModal = useCallback(() => {
    setShowOriginalImageModal(false);
  }, []);

  // 🎯 修正：處理圖片選擇功能
  const handleSelectImageForGeneration = useCallback(
    (image: ImageData, groupIndex: number, imageIndex: number) => {
      setSelectedImageForGeneration({
        publishedImageId: image.publishedImageId,
        url: image.url,
        groupIndex,
        imageIndex,
      });
      
      // 顯示選擇成功的提示
      showToast(t("toast.image_selected_continue_generate"), false);
    },
    []
  );

  const formatDateTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const getStatusInfo = useCallback(
    (status?: TaskStatus) => {
      switch (status) {
        case TaskStatus.IN_QUEUE:
          return {
            text: tx("status_in_queue", "排隊中"),
            className: "bg-[#f3ecd8] text-[#8a6b2d] dark:bg-[#2a2233] dark:text-[#d2b57b]",
          };
        case TaskStatus.PROMPT_DELIVERING:
          return {
            text: tx("status_prompt_delivering", "提示詞傳遞中"),
            className: "bg-[#ece7fb] text-[#6b55c6] dark:bg-[#251f31] dark:text-[#b8a7ff]",
          };
        case TaskStatus.AI_PROCESSING:
          return {
            text: tx("status_ai_processing", "AI處理中"),
            className: "bg-[#ece7fb] text-[#6b55c6] dark:bg-[#251f31] dark:text-[#b8a7ff]",
          };
        case TaskStatus.GENERATING:
          return {
            text: tx("status_generating", "圖片生成中"),
            className: "bg-[#e8f5eb] text-[#2e7a49] dark:bg-[#1f2b25] dark:text-[#8dd6a8]",
          };
        case TaskStatus.COMPLETED:
          return {
            text: tx("completed", "已完成"),
            className: "bg-[#e8f5eb] text-[#2e7a49] dark:bg-[#1f2b25] dark:text-[#8dd6a8]",
          };
        case TaskStatus.FAILED:
          return {
            text: tx("failed", "失敗"),
            className: "bg-[#fae8ed] text-[#b24f6b] dark:bg-[#2f1f24] dark:text-[#e6a5b2]",
          };
        default:
          return null;
      }
    },
    [tx]
  );

  // 🖼️ 原圖顯示組件
  const OriginalImageDisplay = ({
    originalImage,
    onImageClick,
  }: {
    originalImage: { file?: File; name?: string; url?: string };
    onImageClick: (originalImage: {
      file?: File;
      name?: string;
      url?: string;
    }) => void;
  }) => {
    if (!originalImage || (!originalImage.url && !originalImage.file)) {
      return null;
    }

    // 簡單的 URL 計算，不使用 useMemo
    const imageSrc =
      originalImage.url ||
      (originalImage.file ? URL.createObjectURL(originalImage.file) : "");
    const isVideoAsset = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(imageSrc);

    return (
      <div className="flex justify-end">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onImageClick(originalImage)}
            className="group relative overflow-hidden rounded-2xl bg-[#1a1622] shadow-[0_8px_20px_rgba(0,0,0,0.16)] transition-all duration-200"
            title={t("click_to_enlarge") || "點擊放大查看"}
          >
            {isVideoAsset ? (
              <video
                src={imageSrc}
                className="h-16 w-16 object-cover transition-transform duration-200 group-hover:scale-105"
                muted
                playsInline
                autoPlay
                loop
              />
            ) : (
              <img
                src={imageSrc}
                alt={originalImage.name || "原圖"}
                className="h-16 w-16 object-cover transition-transform duration-200 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/20">
              <svg
                className="h-6 w-6 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                />
              </svg>
            </div>
          </button>
        </div>
      </div>
    );
  };

  // Empty state component
  const EmptyState = (): JSX.Element => (
    <div className="px-4 py-16 text-center">
      <div className="mx-auto mb-6 h-24 w-24 text-custom-logo-purple opacity-45 dark:text-[#53c7ff]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-custom-black dark:text-white">
        {t("no_images_yet")}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-[#9f95b4]">
        {t("start_generating_prompt")}
      </p>
    </div>
  );

  const LoadingConversationState = (): JSX.Element => (
    <div className="px-4 py-16 text-center">
      <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-2 border-[#5d78ba]/30 border-t-[#5d78ba] dark:border-[#8F7FFF]/30 dark:border-t-[#8F7FFF]" />
      <h3 className="text-lg font-medium text-custom-black dark:text-white">
        正在載入對話
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-[#9f95b4]">
        正在讀取這個 conversation 的訊息與生成結果
      </p>
    </div>
  );

  const handleEditPrompt = useCallback((prompt: string, kind?: "image" | "video" | "audio" | "text" | "chat") => {
    window.dispatchEvent(
      new CustomEvent("drawing:apply-prompt-template", {
        detail: {
          prompt,
          type:
            kind === "image" || kind === "video" || kind === "audio"
              ? kind
              : null,
        },
      })
    );
  }, []);

  return (
    <div>
      {shouldShowContent ? (
        <>
          <div>
            {renderedGroups.map((group, groupIndex) => (
              <Fragment key={`group-${group.id}`}>
                <div className="mb-10 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {typeof group.prompt === "string" && group.prompt.trim() ? (
                  <div className="mx-auto w-full max-w-5xl px-2 sm:px-4">
                    <div className="flex flex-row-reverse items-end gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8e1f7] text-[11px] font-semibold text-[#4d3f72] shadow-[0_6px_18px_rgba(0,0,0,0.08)] dark:bg-[#2a2236] dark:text-white dark:shadow-[0_6px_18px_rgba(0,0,0,0.16)]">
                        {rightPerson.avatar}
                      </div>

                      <div className="flex min-w-0 w-full flex-col items-end">
                        <div className="w-full max-w-[720px] rounded-[22px] rounded-br-md border border-[rgba(118,171,214,0.26)] bg-[#dfeffc] px-4 py-3 shadow-[0_10px_24px_rgba(50,104,144,0.08)] dark:border-[rgba(118,171,214,0.16)] dark:bg-[#193042] dark:shadow-[0_10px_24px_rgba(0,0,0,0.18)] sm:px-5">
                          <p className="whitespace-pre-wrap text-sm leading-7 text-[#18344d] dark:text-[#eef7ff]">
                            {group.prompt || ""}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-3 px-1 text-[11px] text-[#7891a7] dark:text-[#7f97ab]">
                          <span>
                            {formatDateTime(group.timestamp || new Date().toISOString())}
                          </span>
                          {typeof group.prompt === "string" && group.prompt && (
                            <button
                              onClick={() => copyToClipboard(group.prompt)}
                              className="inline-flex items-center gap-1.5 text-[#5b8fba] transition-colors hover:text-[#2e638d] dark:text-[#8dc9f1] dark:hover:text-white"
                              title={t("copy_prompt") || "複製提示詞"}
                            >
                              <Copy className="h-3 w-3" />
                              <span>{t("copy") || "複製"}</span>
                            </button>
                          )}
                          {typeof group.prompt === "string" && group.prompt && (
                            <button
                              onClick={() => handleEditPrompt(group.prompt, group.kind)}
                              className="inline-flex items-center gap-1.5 text-[#5b8fba] transition-colors hover:text-[#2e638d] dark:text-[#8dc9f1] dark:hover:text-white"
                              title="編輯"
                            >
                              <PenSquare className="h-3 w-3" />
                              <span>編輯</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  ) : null}

                  <div className="mx-auto w-full max-w-5xl px-2 sm:px-4">
                    <div className="flex items-end gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#d7ecfb] text-[11px] font-semibold text-[#31597a] shadow-[0_6px_18px_rgba(0,0,0,0.08)] dark:bg-[#14202b] dark:text-white dark:shadow-[0_6px_18px_rgba(0,0,0,0.16)]">
                        {leftPerson.avatar}
                      </div>

                      <div className="flex min-w-0 w-full flex-col items-start">
                        {isChatGroup(group) ? (
                          <div className="w-full max-w-[720px] px-1 py-1 sm:px-0">
                            {group.assistantMessage ? (
                              <p className="whitespace-pre-wrap text-sm leading-7 text-[#20384d] dark:text-[#eef7ff]">
                                <ChatTypingText
                                  text={group.assistantMessage || ""}
                                  isStreaming={!isGenerationDone(group)}
                                />
                              </p>
                            ) : !isGenerationDone(group) ? (
                              <div className="inline-flex max-w-full flex-col rounded-2xl border border-[#cfe3f3] bg-[#f4faff] px-4 py-3 text-sm leading-6 text-[#416b8e] shadow-[0_10px_24px_rgba(49,89,122,0.08)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#b8dfff]">
                                <span className="inline-flex items-center gap-2 font-semibold text-[#20384d] dark:text-[#eef7ff]">
                                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#37bdf8]" />
                                  {getGenerationStageLabel(group)}
                                </span>
                                <span className="mt-1 text-xs text-[#6b88a1] dark:text-[#9bb4c8]">
                                  {getGenerationStageDetail(group)}
                                </span>
                                {typeof group.progressPercent === "number" ? (
                                  <span className="mt-2 h-1 overflow-hidden rounded-full bg-[#dbeaf5] dark:bg-white/[0.08]">
                                    <span
                                      className="block h-full rounded-full bg-[#37bdf8] transition-all duration-300"
                                      style={{ width: `${Math.max(6, Math.min(100, Math.round(group.progressPercent)))}%` }}
                                    />
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                            {group.status === TaskStatus.FAILED && !group.assistantMessage ? (
                              <p className="text-sm leading-6 text-red-500 dark:text-red-300">
                                {group.failureMessage || "回覆失敗，請重新送出"}
                                {onRetryGeneration ? (
                                  <button
                                    type="button"
                                    onClick={() => onRetryGeneration(group)}
                                    className="ml-2 font-semibold underline decoration-red-300 underline-offset-2 hover:text-red-600 dark:hover:text-red-200"
                                  >
                                    {tx("retry", "重新送出")}
                                  </button>
                                ) : null}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                        <div className="w-full px-1 py-1 sm:px-0">
                          {group.assistantMessage ? (
                            <p className="mb-4 whitespace-pre-wrap text-sm leading-7 text-[#20384d] dark:text-[#eef7ff]">
                              {sanitizeAssistantText(group.assistantMessage)}
                            </p>
                          ) : null}

                          {!isGenerationDone(group) && isMediaGenerationGroup(group) ? (
                            <GenerationProgressPanel group={group} />
                          ) : null}

                          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                {!group.paramsSummary && (group.loraModel as { title?: string })?.title && (
                                  <span className="rounded-full bg-[#e9f4fc] px-3 py-1 text-xs font-medium text-[#416b8e] dark:bg-white/[0.04] dark:text-[#c9e8ff]">
                                    {(group.loraModel as { title?: string }).title}
                                  </span>
                                )}
                                {getStatusInfo(group.status) && (
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                                      getStatusInfo(group.status)!.className
                                    }`}
                                  >
                                    {getStatusInfo(group.status)!.text}
                                  </span>
                                )}
                              </div>
                              {group.paramsSummary ? (
                                <p className="mb-1 text-xs font-medium tracking-[0.02em] text-[#416b8e] dark:text-[#b8dfff]">
                                  {group.paramsSummary}
                                </p>
                              ) : null}
                              {group.currentLabel && !isGenerationDone(group) ? (
                                <p className="mb-1 text-sm leading-6 text-[#5f7f9b] dark:text-[#a8bed1]">
                                  {group.currentLabel}
                                  {typeof group.progressPercent === "number"
                                    ? ` · ${Math.round(group.progressPercent)}%`
                                    : ""}
                                </p>
                              ) : null}
                              <p className="text-sm leading-6 text-[#6b88a1] dark:text-[#9bb4c8]">
                                {getResultProgressText(group, tx)}
                              </p>
                              {group.status === TaskStatus.FAILED && group.failureMessage ? (
                                <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                                  <p>{group.failureMessage}</p>
                                  {onRetryGeneration ? (
                                    <button
                                      type="button"
                                      onClick={() => onRetryGeneration(group)}
                                      className="mt-3 inline-flex h-9 items-center rounded-full bg-red-600 px-4 text-xs font-semibold text-white transition hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
                                    >
                                      {tx("retry", "重新送出")}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>

                            {group.images && group.images?.length > 0 && (
                              <div className="shrink-0">
                                <OriginalImageDisplay
                                  originalImage={group.images[0]}
                                  onImageClick={() =>
                                    handleOriginalImageClick(group.images![0])
                                  }
                                />
                              </div>
                            )}
                          </div>

                          {isMediaGenerationGroup(group) && (
                            !isGenerationDone(group) ||
                            getActualImageCount(group) > 0 ||
                            group.status === TaskStatus.FAILED
                          ) ? (
                            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                              {getResultSlots(group).map((image, imageIndex) => (
                                <div
                                  key={`${image.publishedImageId || imageIndex}`}
                                  className="relative"
                                >
                                  <ResultSlot
                                    group={group}
                                    image={image}
                                    imageIndex={imageIndex}
                                    modelName={(group.loraModel as { title: string })?.title}
                                    onSelect={() =>
                                      handleImageSelect(
                                        image,
                                        group.loraModel as { id: string; title: string },
                                        groupIndex,
                                        imageIndex,
                                        group.prompt || "",
                                        group.kind
                                      )
                                    }
                                    onReaction={(type) =>
                                      handleReaction(image.publishedImageId, type)
                                    }
                                    onCollect={() =>
                                      handleCollectReaction(image.publishedImageId)
                                    }
                                    onSelectForGeneration={() =>
                                      handleSelectImageForGeneration(
                                        image,
                                        groupIndex,
                                        imageIndex
                                      )
                                    }
                                    isSelectedForGeneration={
                                      selectedImageForGeneration?.publishedImageId ===
                                      image.publishedImageId
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </>
      ) : isConversationLoading ? (
        <LoadingConversationState />
      ) : (
        <EmptyState />
      )}

      {/* 🔧 修正 10: 優化圖片模態視窗，添加狀態檢查 */}
      {isModalOpen && selectedImageRef && (
        <ImageModal
          imageRef={selectedImageRef}
          onClose={handleModalClose}
          onPrevious={handlePrevious}
          onNext={handleNext}
          showPrevious={currentFlatIndex > 0 && !isProcessing}
          handleReaction={(imageId: string, type: string) => {
            handleReaction(imageId, type as "like" | "dislike");
          }}
          handleCollectReaction={handleCollectReaction}
          showNext={
            currentFlatIndex < flattenedImages.length - 1 && !isProcessing
          }
          // 💬 新增：在 Modal 中也支援留言功能
          onComment={(imageId: string) => {
            handleCommentClick(imageId);
          }}
        />
      )}

      {/* 💬 完整實作評論對話框 - 與 PublishedImages 一致 */}
      <CommentDialog
        currentComment={showComment}
        onConfirm={(newComment: CommentReaction) => {
          submitReactionComment(newComment);
        }}
        onClose={() => {
          setCommentDialogOpen(false);
        }}
        isOpen={openCommentDialog}
      />

      {/* 🖼️ 原圖放大 Modal */}
      {showOriginalImageModal && originalImageUrl && (
        <OriginalImageModal
          imageUrl={originalImageUrl}
          onClose={handleCloseOriginalImageModal}
        />
      )}
    </div>
  );
}
