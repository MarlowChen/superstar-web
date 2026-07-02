"use client";
import { createContext, useState, useEffect, ReactNode, JSX, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import {
  ImageData,
  GalleryContextType,
  ImageDataGroup,
  TaskStatus,
} from "../types";
import LoraModel from "../../LoraModel";


// 設定最大允許的圖片組數量
const MAX_IMAGE_GROUPS = 10;
const PERSISTED_GENERATED_IMAGES_KEY = "generatedImages";
const PERSISTED_RECONNECT_WINDOW_MS = 24 * 60 * 60 * 1000;

const LOCAL_TASK_PLACEHOLDER_PREFIXES = ["pending-", "chat-", "history-", "retry-"];
const RECONNECTABLE_STATUSES = new Set<TaskStatus>([
  TaskStatus.IN_QUEUE,
  TaskStatus.PROMPT_DELIVERING,
  TaskStatus.AI_PROCESSING,
  TaskStatus.GENERATING,
  TaskStatus.PARTIAL_COMPLETE,
]);

export const isLocalPlaceholderGroupId = (groupId?: string | null): boolean => {
  const normalizedGroupId = String(groupId || "").trim();
  if (!normalizedGroupId) return false;

  return LOCAL_TASK_PLACEHOLDER_PREFIXES.some((prefix) =>
    normalizedGroupId.startsWith(prefix)
  );
};

const isTerminalStatus = (status?: TaskStatus) =>
  status === TaskStatus.COMPLETED || status === TaskStatus.FAILED;

const isReconnectableStatus = (status?: TaskStatus) =>
  Boolean(status && RECONNECTABLE_STATUSES.has(status));

const getStatusPriority = (status?: TaskStatus) => {
  switch (status) {
    case TaskStatus.COMPLETED:
      return 6;
    case TaskStatus.FAILED:
      return 5;
    case TaskStatus.PARTIAL_COMPLETE:
      return 4;
    case TaskStatus.GENERATING:
      return 3;
    case TaskStatus.AI_PROCESSING:
      return 2;
    case TaskStatus.PROMPT_DELIVERING:
      return 1;
    case TaskStatus.IN_QUEUE:
      return 0;
    default:
      return -1;
  }
};

const pickNonEmptyString = (...values: Array<string | undefined | null>) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
};

const readPersistedReconnectableGroups = (
  conversationId?: string | null
): ImageDataGroup[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(PERSISTED_GENERATED_IMAGES_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    return parsed
      .filter((group): group is ImageDataGroup => {
        if (!group || typeof group !== "object") return false;

        const candidate = group as Partial<ImageDataGroup>;
        if (!candidate.id || isLocalPlaceholderGroupId(candidate.id)) return false;
        if (!isReconnectableStatus(candidate.status)) return false;

        const expectedCount = Math.max(
          1,
          Number(candidate.expectedCount) ||
            Number((candidate as Record<string, unknown>).count) ||
            candidate.publishedImages?.length ||
            1
        );
        const resultCount = Math.max(
          0,
          Number(candidate.resultCount) ||
            candidate.publishedImages?.filter((image) => Boolean(image?.url)).length ||
            0
        );
        const timestamp = Date.parse(candidate.timestamp || "");
        if (countResolvedMedia(candidate) === 0 && Number(candidate.progressPercent) >= 100) {
          return false;
        }

        if (
          candidate.status === TaskStatus.PARTIAL_COMPLETE &&
          resultCount > 0 &&
          resultCount < expectedCount
        ) {
          return false;
        }

        if (
          conversationId &&
          candidate.conversationId &&
          candidate.conversationId !== conversationId
        ) {
          return false;
        }

        if (!Number.isNaN(timestamp) && now - timestamp > PERSISTED_RECONNECT_WINDOW_MS) {
          return false;
        }

        return true;
      })
      .map((group) => ({
        ...group,
        publishedImages: Array.isArray(group.publishedImages)
          ? group.publishedImages
          : [],
        prompt: typeof group.prompt === "string" ? group.prompt : "",
        loraModel: group.loraModel || group.kind || "image",
        timestamp: group.timestamp || new Date().toISOString(),
        images: Array.isArray(group.images)
          ? group.images
              .filter((image) => image && typeof image === "object" && typeof image.url === "string")
              .map((image) => ({
                name: image.name,
                url: image.url,
              }))
          : undefined,
      }));
  } catch (error) {
    console.warn("Failed to restore persisted generation state:", error);
    return [];
  }
};

const hasMeaningfulReactionState = (image?: Partial<ImageData> | null) => {
  if (!image) return false;

  return Boolean(
    image.publishedImageId ||
      image.shortId ||
      image.url ||
      image.userReaction?.like ||
      image.userReaction?.dislike ||
      image.userReaction?.collecting ||
      image.userReaction?.comment ||
      image.reactions?.likes ||
      image.reactions?.dislikes ||
      image.reactions?.collections
  );
};

const countResolvedMedia = (group: Partial<ImageDataGroup>) =>
  Array.isArray(group.publishedImages)
    ? group.publishedImages.filter((image) => Boolean(image?.url)).length
    : 0;

const isTerminalEmptyGenerationGroup = (group: Partial<ImageDataGroup>) => {
  if (group.responseType !== "generation" && group.kind !== "image" && group.kind !== "video" && group.kind !== "audio") {
    return false;
  }

  return (
    (group.status === TaskStatus.COMPLETED ||
      group.status === TaskStatus.PARTIAL_COMPLETE ||
      group.status === TaskStatus.FAILED) &&
    countResolvedMedia(group) === 0
  );
};

const mergePublishedImages = (
  existingImages: ImageData[] = [],
  incomingImages: ImageData[] = []
): ImageData[] => {
  if (existingImages.length === 0) return incomingImages;
  if (incomingImages.length === 0) return existingImages;

  const maxLength = Math.max(existingImages.length, incomingImages.length);
  const merged: ImageData[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const existing = existingImages[index];
    const incoming = incomingImages[index];

    if (!existing && incoming) {
      merged.push(incoming);
      continue;
    }

    if (existing && !incoming) {
      merged.push(existing);
      continue;
    }

    if (!existing || !incoming) {
      continue;
    }

    const shouldPreferIncomingReactions = hasMeaningfulReactionState(incoming);
    merged.push({
      ...existing,
      ...incoming,
      id: incoming.id || existing.id,
      publishedImageId: incoming.publishedImageId || existing.publishedImageId,
      shortId: incoming.shortId || existing.shortId,
      url: incoming.url || existing.url,
      userReaction: shouldPreferIncomingReactions
        ? {
            ...existing.userReaction,
            ...incoming.userReaction,
          }
        : existing.userReaction,
      reactions: shouldPreferIncomingReactions
        ? {
            ...existing.reactions,
            ...incoming.reactions,
          }
        : existing.reactions,
    });
  }

  return merged;
};

const mergeProgressTrail = (
  existingTrail?: ImageDataGroup["progressTrail"],
  incomingTrail?: ImageDataGroup["progressTrail"]
) => {
  if (!existingTrail?.length) return incomingTrail;
  if (!incomingTrail?.length) return existingTrail;

  const mergedTrail = [...existingTrail];
  incomingTrail.forEach((entry) => {
    const key = `${entry.timestamp || ""}:${entry.phase || ""}:${entry.label || ""}:${entry.detail || ""}`;
    const existingIndex = mergedTrail.findIndex(
      (item) => `${item.timestamp || ""}:${item.phase || ""}:${item.label || ""}:${item.detail || ""}` === key
    );

    if (existingIndex >= 0) {
      mergedTrail[existingIndex] = {
        ...mergedTrail[existingIndex],
        ...entry,
      };
      return;
    }

    mergedTrail.push(entry);
  });

  return mergedTrail;
};

export const mergeImageGroup = (
  existingGroup: ImageDataGroup,
  incomingGroup: ImageDataGroup
): ImageDataGroup => {
  const preferExistingChatId =
    (existingGroup.responseType === "chat" || incomingGroup.responseType === "chat") &&
    isLocalPlaceholderGroupId(existingGroup.id) &&
    !isTerminalStatus(existingGroup.status);

  let nextStatus = incomingGroup.status || existingGroup.status;
  if (!nextStatus) {
    nextStatus = existingGroup.status;
  }

  if (
    existingGroup.status === TaskStatus.COMPLETED ||
    incomingGroup.status === TaskStatus.COMPLETED
  ) {
    nextStatus = TaskStatus.COMPLETED;
  } else if (
    incomingGroup.status === TaskStatus.FAILED &&
    !isTerminalStatus(existingGroup.status)
  ) {
    nextStatus = existingGroup.status;
  } else if (getStatusPriority(existingGroup.status) > getStatusPriority(incomingGroup.status)) {
    nextStatus = existingGroup.status;
  }

  const mergedImages = mergePublishedImages(
    existingGroup.publishedImages || [],
    incomingGroup.publishedImages || []
  );
  const mergedResultCount = Math.max(
    Number(existingGroup.resultCount) || 0,
    Number(incomingGroup.resultCount) || 0,
    mergedImages.filter((image) => Boolean(image?.url)).length
  );
  const incomingExpectedCount = Number(incomingGroup.expectedCount) || 0;
  const existingExpectedCount = Number(existingGroup.expectedCount) || 0;
  const mergedExpectedCount =
    incomingGroup.status === TaskStatus.COMPLETED && incomingExpectedCount > 0
      ? Math.max(incomingExpectedCount, mergedResultCount || 1)
      : Math.max(existingExpectedCount, incomingExpectedCount, mergedResultCount || 1);

  const mergedGroup: ImageDataGroup = {
    ...existingGroup,
    ...incomingGroup,
    id: preferExistingChatId ? existingGroup.id : incomingGroup.id || existingGroup.id,
    publishedImages: mergedImages,
    prompt: pickNonEmptyString(incomingGroup.prompt, existingGroup.prompt) || "",
    assistantMessage:
      (incomingGroup.assistantMessage || "").length >= (existingGroup.assistantMessage || "").length
        ? incomingGroup.assistantMessage || existingGroup.assistantMessage
        : existingGroup.assistantMessage,
    responseType: incomingGroup.responseType || existingGroup.responseType,
    conversationId: pickNonEmptyString(incomingGroup.conversationId, existingGroup.conversationId),
    userMessageId: pickNonEmptyString(incomingGroup.userMessageId, existingGroup.userMessageId),
    assistantMessageId: pickNonEmptyString(incomingGroup.assistantMessageId, existingGroup.assistantMessageId),
    kind: incomingGroup.kind || existingGroup.kind,
    loraModel: incomingGroup.loraModel || existingGroup.loraModel,
    timestamp: pickNonEmptyString(incomingGroup.timestamp, existingGroup.timestamp) || new Date().toISOString(),
    status: nextStatus,
    queue:
      typeof incomingGroup.queue === "number"
        ? incomingGroup.queue
        : existingGroup.queue,
    discardRecommended: incomingGroup.discardRecommended ?? existingGroup.discardRecommended,
    terminalAction: incomingGroup.terminalAction || existingGroup.terminalAction,
    failureCode: incomingGroup.failureCode || existingGroup.failureCode,
    failureMessage: incomingGroup.failureMessage || existingGroup.failureMessage,
    paramsSummary: incomingGroup.paramsSummary || existingGroup.paramsSummary,
    currentPhase: incomingGroup.currentPhase || existingGroup.currentPhase,
    currentLabel: incomingGroup.currentLabel || existingGroup.currentLabel,
    progressPercent:
      typeof incomingGroup.progressPercent === "number"
        ? incomingGroup.progressPercent
        : existingGroup.progressPercent,
    activeResultIndex:
      typeof incomingGroup.activeResultIndex === "number"
        ? incomingGroup.activeResultIndex
        : existingGroup.activeResultIndex,
    progressTrail: mergeProgressTrail(existingGroup.progressTrail, incomingGroup.progressTrail),
    requestSnapshot: incomingGroup.requestSnapshot || existingGroup.requestSnapshot,
    images:
      (incomingGroup.images && incomingGroup.images.length > 0)
        ? incomingGroup.images
        : existingGroup.images,
    expectedCount: mergedExpectedCount || undefined,
    resultCount: mergedResultCount,
  };

  return mergedGroup;
};

const buildGroupSemanticKey = (group: ImageDataGroup): string => {
  const typedGroup = group as ImageDataGroup & {
    userMessageId?: string;
    assistantMessageId?: string;
    conversationId?: string;
  };

  const messagePairKey =
    typedGroup.userMessageId || typedGroup.assistantMessageId
      ? `${typedGroup.userMessageId || ""}:${typedGroup.assistantMessageId || ""}`
      : "";

  const imageIds = (group.publishedImages || [])
    .map((image) => image.publishedImageId || image.id || image.url || "")
    .join(",");

  if (messagePairKey) {
    return `msg:${typedGroup.conversationId || ""}:${messagePairKey}`;
  }

  if (group.id) {
    if (!isLocalPlaceholderGroupId(group.id)) {
      return `id:${group.id}`;
    }

    return `local:${typedGroup.conversationId || ""}:${group.responseType || ""}:${group.kind || ""}:${group.prompt || ""}`;
  }

  return `fallback:${typedGroup.conversationId || ""}:${group.responseType || ""}:${group.kind || ""}:${group.prompt || ""}:${group.assistantMessage || ""}:${imageIds}`;
};

export const mergeImageGroupCollections = (groups: ImageDataGroup[]): ImageDataGroup[] => {
  const mergedByKey = new Map<string, ImageDataGroup>();
  const orderedKeys: string[] = [];

  groups.forEach((group) => {
    if (!group) return;
    const key = buildGroupSemanticKey(group);
    const existingGroup = mergedByKey.get(key);
    if (!existingGroup) {
      mergedByKey.set(key, group);
      orderedKeys.push(key);
      return;
    }

    mergedByKey.set(key, mergeImageGroup(existingGroup, group));
  });

  return orderedKeys
    .map((key) => mergedByKey.get(key))
    .filter((group): group is ImageDataGroup => Boolean(group))
    .filter((group) => !isTerminalEmptyGenerationGroup(group));
};

const trimImageGroups = (groups: ImageDataGroup[]) =>
  groups.length > MAX_IMAGE_GROUPS ? groups.slice(groups.length - MAX_IMAGE_GROUPS) : groups;

// 新增模型相關的型別定義
interface ModelData {
  id: string;
  title: string;
  class: string;
  canImageToImage: boolean; // 🎯 新增：支援圖片轉圖片功能
  maxReferenceImages?: number;
}

interface GroupedModels {
  [className: string]: ModelData[];
}

// 擴展 GalleryContextType 以包含分類功能和圖片選擇
interface ExtendedGalleryContextType extends GalleryContextType {
  models: ModelData[];
  groupedModels: GroupedModels;
  modelClasses: string[];
  getModelsByClass: (className: string) => ModelData[];
  selectedImageForGeneration: {
    publishedImageId: string;
    url: string;
    groupIndex: number;
    imageIndex: number;
  } | null;
  setSelectedImageForGeneration: (image: {
    publishedImageId: string;
    url: string;
    groupIndex: number;
    imageIndex: number;
  } | null) => void;
}

export const GalleryContext = createContext<ExtendedGalleryContextType>({
  images: [],
  models: [],
  groupedModels: {},
  modelClasses: [],
  addImage: () => {},
  setImages: () => {},
  updateImage: () => {},
  updateImageQueue: () => {},
  removeImage: () => {},
  clearAllImages: () => {},
  getModelsByClass: () => [],
  selectedImageForGeneration: null,
  setSelectedImageForGeneration: () => {},
});

interface GalleryProviderProps {
  children: ReactNode;
}

export function GalleryProvider({
  children,
}: GalleryProviderProps): JSX.Element {
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [images, setImagesState] = useState<ImageDataGroup[]>([]);
  const [models, setModels] = useState<ModelData[]>([]);
  const [groupedModels, setGroupedModels] = useState<GroupedModels>({});
  const [modelClasses, setModelClasses] = useState<string[]>([]);
  
  // 🎯 新增：選擇的圖片狀態
  const [selectedImageForGeneration, setSelectedImageForGeneration] = useState<{
    publishedImageId: string;
    url: string;
    groupIndex: number;
    imageIndex: number;
  } | null>(null);
  const lastBootstrapErrorRef = useRef<string | null>(null);
  // 紀錄是否已對某個 user 進行過 task list 的 bootstrap，避免 URL（fresh / conversationId / template params）
  // 變動時再次 fetch + setImages，誤覆蓋 PromptForm 剛 addImage 的 pending 卡或新 task group。
  // PromptForm 會自行透過 setImages / addImage / updateImage 維護生成中的對話狀態。
  const bootstrappedForUserIdRef = useRef<string | null>(null);
  const selectedConversationId = searchParams.get("conversationId");

  // 沒有指定 conversationId 時一律視為全新狀態，避免首頁背景載入不明歷史紀錄
  const shouldStartFromCleanSlate = !selectedConversationId;
  // 將最新值同步到 ref，讓只依賴 user 的 bootstrap effect 在執行時仍能讀到最新狀態。
  const shouldStartFromCleanSlateRef = useRef(shouldStartFromCleanSlate);
  shouldStartFromCleanSlateRef.current = shouldStartFromCleanSlate;
  const previousShouldStartFromCleanSlateRef = useRef(shouldStartFromCleanSlate);
  const hydratedReconnectStateForUserRef = useRef<string | null>(null);

  const setImages = useCallback((nextImages: ImageDataGroup[]) => {
    setImagesState(trimImageGroups(mergeImageGroupCollections(nextImages)));
  }, []);

  const updateImages = useCallback(
    (updater: (prev: ImageDataGroup[]) => ImageDataGroup[]) => {
      setImagesState((prev) => trimImageGroups(mergeImageGroupCollections(updater(prev))));
    },
    []
  );

  useEffect(() => {
    const wasCleanSlate = previousShouldStartFromCleanSlateRef.current;
    if (!wasCleanSlate && shouldStartFromCleanSlate) {
      setImages([]);
    }
    previousShouldStartFromCleanSlateRef.current = shouldStartFromCleanSlate;
  }, [setImages, shouldStartFromCleanSlate]);

  useEffect(() => {
    const handleNewConversation = () => {
      previousShouldStartFromCleanSlateRef.current = true;
      setImages([]);
    };

    window.addEventListener("drawing:new-conversation", handleNewConversation);
    return () => {
      window.removeEventListener("drawing:new-conversation", handleNewConversation);
    };
  }, [setImages]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    const userId = (user as { id?: string }).id || "";
    const hydrationKey = `${userId}:${selectedConversationId || "fresh"}`;
    if (hydratedReconnectStateForUserRef.current === hydrationKey) {
      return;
    }

    const restoredGroups = readPersistedReconnectableGroups(selectedConversationId);
    hydratedReconnectStateForUserRef.current = hydrationKey;

    if (restoredGroups.length > 0) {
      updateImages((prev) => mergeImageGroupCollections([...prev, ...restoredGroups]));
    }
  }, [loading, selectedConversationId, updateImages, user]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      setImages([]);
      setModels([]);
      setGroupedModels({});
      setModelClasses([]);
      bootstrappedForUserIdRef.current = null;
      hydratedReconnectStateForUserRef.current = null;
      return;
    }

    const userId = (user as { id?: string }).id || "";

    // 已對該 user bootstrap 過，後續 URL 變化（fresh / conversationId 切換、模板參數變動）
    // 不再重新 fetch task list；conversation 內的 history 由 PromptForm.loadConversationHistory 處理，
    // 生成中的 pending 卡 / 新 task 由 PromptForm 透過 addImage / updateImage 管理。
    // 這樣可避免 setImages(finalImages) 覆蓋掉手動圖片流程剛建立的 pending 卡。
    if (bootstrappedForUserIdRef.current === userId) {
      return;
    }
    bootstrappedForUserIdRef.current = userId;
    // 只載入模型資料；conversation 內容由 messages 還原，不再撈舊 task list。
    const fetchAnotherData = () =>
      fetch("/api/get-models", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      }).then(async (res) => {
        if (res.status === 400) {
          return { result: [] };
        }
        if (!res.ok) {
          throw new Error(`Failed to fetch models: ${res.status}`);
        }

        return res.json();
      });
    fetchAnotherData()
      .then((modelsData) => {
        // 處理模型資料
        const modelList = Array.isArray(modelsData)
          ? modelsData
          : Array.isArray(modelsData?.list)
            ? modelsData.list
            : Array.isArray(modelsData?.result)
              ? modelsData.result
              : [];

        const processedModels: ModelData[] = modelList.map((model: LoraModel & { class: string }) => ({
          id: model.id,
          title: model.title,
          class: model.class,
          canImageToImage: model.canImageToImage, // 🎯 新增：保留 canImageToImage 屬性
          maxReferenceImages: (model as LoraModel & { maxReferenceImages?: number }).maxReferenceImages,
        }));

        // 按照 class 分組模型
        const grouped: GroupedModels = {};
        const classes: string[] = [];

        processedModels.forEach((model) => {
          const className = model.class;
          
          // 如果這個 class 還沒有被記錄，就加入到 classes 陣列
          if (!classes.includes(className)) {
            classes.push(className);
          }

          // 如果這個 class 的群組還不存在，就建立它
          if (!grouped[className]) {
            grouped[className] = [];
          }

          // 將模型加入到對應的群組
          grouped[className].push(model);
        });

        // 可選：對 classes 進行排序，讓使用者體驗更好
        classes.sort();

        // 可選：對每個群組內的模型按 title 排序
        Object.keys(grouped).forEach(className => {
          grouped[className].sort((a, b) => a.title.localeCompare(b.title));
        });

        // 更新 state
        setModels(processedModels);
        setGroupedModels(grouped);
        setModelClasses(classes);

        // conversationId 頁面的內容只交給 PromptForm.loadConversationHistory，
        // 不能用全域 task/list 覆蓋，否則會跳到「非該對話」的舊列表。
        if (!shouldStartFromCleanSlateRef.current) {
          return;
        }

        setImages([]);
        lastBootstrapErrorRef.current = null;
      })
      .catch((error) => {
        const errorKey =
          error instanceof Error ? error.message : "unknown-bootstrap-error";
        if (lastBootstrapErrorRef.current !== errorKey) {
          lastBootstrapErrorRef.current = errorKey;
          console.error("Failed to fetch data:", error);
        }
        // 不清空圖片，避免錯誤時 UI 反覆重置與閃動
        setModels([]);
        setGroupedModels({});
        setModelClasses([]);
      });
    // 注意：此 effect 僅依賴 user。fresh / conversationId / template / shouldStartFromCleanSlate
    // 等的清空行為已在上方獨立 useEffect 中處理（shouldStartFromCleanSlate → setImages([])）。
  }, [loading, setImages, user]);

  // 當圖片變更時保存到本地存儲
  useEffect(() => {
    if (images.length > 0) {
      localStorage.setItem("generatedImages", JSON.stringify(images));
    }
  }, [images]);

  // 根據 class 獲取模型的輔助函數
  const getModelsByClass = (className: string): ModelData[] => {
    return groupedModels[className] || [];
  };

  // 添加新圖片到圖庫，確保不超過最大限制
  const addImage = (newImage: ImageDataGroup): void => {
    updateImages((prev) => {
      const existingIndex = prev.findIndex((image) => image.id === newImage.id);
      return existingIndex >= 0
        ? prev.map((image, index) =>
            index === existingIndex ? mergeImageGroup(image, newImage) : image
          )
        : [...prev, newImage];
    });
  };

  // 只更新圖片的佇列狀態
  const updateImageQueue = (id: string, queue: number): void => {
    updateImages((prev) => {
      const targetGroupIndex = prev.findIndex((image) => image.id === id);
      if (targetGroupIndex === -1) {
        return prev;
      }

      const newImages = [...prev];
      newImages[targetGroupIndex] = {
        ...newImages[targetGroupIndex],
        queue: queue,
      };
      return newImages;
    });
  };

  // 更新現有圖片的函數
  const updateImage = (id: string, updatedData: ImageDataGroup): void => {
    updateImages((prev) => {
      const targetGroupIndex = prev.findIndex((image) => image.id === id);

      // 如果找不到，就新增一個
      if (targetGroupIndex === -1) {
        const updatedId = updatedData.id;
        const sameUpdatedIdIndex =
          updatedId ? prev.findIndex((image) => image.id === updatedId) : -1;

        return sameUpdatedIdIndex >= 0
          ? prev.map((image, index) =>
              index === sameUpdatedIdIndex ? mergeImageGroup(image, updatedData) : image
            )
          : [...prev, updatedData];
      }

      // 如果找到，就更新
      const newImages = [...prev];
      newImages[targetGroupIndex] = mergeImageGroup(
        newImages[targetGroupIndex],
        updatedData
      );

      // 關鍵：若本次更新把 id 從 temp 改成 taskId，且列表中已存在同 taskId，
      // 需要合併為單筆，避免 submit/SSE 競態下出現兩張對話卡。
      if (updatedData.id && updatedData.id !== id) {
        const renamedIndex = newImages.findIndex((image) => image.id === updatedData.id);
        const duplicateIndex = newImages.findIndex(
          (image, index) => index !== renamedIndex && image.id === updatedData.id
        );

        if (renamedIndex >= 0 && duplicateIndex >= 0) {
          const preferredIndex = Math.max(renamedIndex, duplicateIndex);
          const staleIndex = Math.min(renamedIndex, duplicateIndex);
          const staleGroup = newImages[staleIndex];
          const preferredGroup = newImages[preferredIndex];
          newImages[preferredIndex] = {
            ...staleGroup,
            ...preferredGroup,
            publishedImages:
              (preferredGroup.publishedImages && preferredGroup.publishedImages.length > 0)
                ? preferredGroup.publishedImages
                : staleGroup.publishedImages,
            requestSnapshot: preferredGroup.requestSnapshot || staleGroup.requestSnapshot,
            images:
              (preferredGroup.images && preferredGroup.images.length > 0)
                ? preferredGroup.images
                : staleGroup.images,
            status: preferredGroup.status || staleGroup.status,
          };
          newImages.splice(staleIndex, 1);
        }
      }

      return newImages;
    });
  };

  // 從圖庫中刪除圖片
  const removeImage = (id: string): void => {
    updateImages((prev) => prev.filter((image) => image.id !== id));
  };

  // 清空所有圖片
  const clearAllImages = (): void => {
    setImages([]);
  };

  return (
    <GalleryContext.Provider
      value={{
        images,
        models,
        groupedModels,
        modelClasses,
        setImages,
        addImage,
        updateImageQueue,
        removeImage,
        clearAllImages,
        updateImage,
        getModelsByClass,
        selectedImageForGeneration,
        setSelectedImageForGeneration,
      }}
    >
      {children}
    </GalleryContext.Provider>
  );
}
