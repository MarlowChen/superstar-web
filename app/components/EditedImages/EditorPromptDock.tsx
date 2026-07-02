"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  FormEvent,
  ChangeEvent,
  KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import {
  Upload,
  X,
  Edit3,
  Layers,
  Zap,
  Scissors,
  Eraser as EraserIcon,
  Paintbrush,
} from "lucide-react";
import Image from "next/image";
import ObjectID from "bson-objectid";
import { Canvas } from "fabric";
import { motion, AnimatePresence } from "framer-motion";
import { TextProperties } from "./TextToolbar";

declare global {
  interface Window {
    __resizeTimer?: number | NodeJS.Timeout;
  }
}

export type EditorMode = "EDIT" | "MERGE" | "ACTION";

export type TaskStatus =
  | "PROMPT_DELIVERING"
  | "IN_QUEUE"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

type PublishedImage = {
  publishedImageId: string;
  url: string;
  shortId: string;
};

type OperationKind = "EDIT" | "MERGE" | "ACTION" | "COMPOSITE" | string;

type TaskEnvelope = {
  id?: string;
  _id?: string;
  status: TaskStatus;
  prompt?: string;
  loraModel?: string;
  createdAt?: string;
  publishedImages?: PublishedImage[];
  op?: OperationKind;
  mode?: OperationKind;
  operation?: OperationKind;
  compositorData?: unknown;
};

export type EditorPromptDockProps = {
  serverUrl: string;
  userId: string;
  selectedImagesCount?: number;
  selectedLayerIds?: string[]; // ✅ 當前選中的圖層 IDs
  layerProcessingStates?: Map<string, boolean>; // ✅ 各圖層是否正在處理中
  beforeSubmit?:
    | ((body: Record<string, unknown>) => Promise<void> | void)
    | undefined;
  onTaskUpdate?: (payload: TaskEnvelope) => void;
  onTaskComplete?: (payload: TaskEnvelope) => void;
  onTaskCreated?: (taskId: string) => void;
  onError?: (err: Error | string) => void;
  fixed?: boolean;
  framed?: boolean;
  fabricCanvas?: Canvas | null;
  mode: EditorMode | null;
  onModeChange?: (mode: EditorMode | null) => void;
  onAddTextWithAlpha?: (
    prompt: string,
    referenceImageName?: string
  ) => Promise<void>;
  onPoseEditWithAlpha?: (
    prompt: string,
    referenceImageName?: string
  ) => Promise<void>;
  onComposeMerge?: (prompt: string) => Promise<void>;
  onBackgroundRemove?: () => Promise<void>;
  onLayerSeparation?: () => Promise<void>;
  onBrushToggle?: () => void;
  onEraserToggle?: () => void;
  isBrushActive?: boolean;
  isEraserActive?: boolean;
  brushSize?: number;
  eraserSize?: number;
  eraserAction?: "erase" | "restore";
  onBrushSizeChange?: (size: number) => void;
  onEraserSizeChange?: (size: number) => void;
  onEraserActionChange?: (action: "erase" | "restore") => void;
  selectedTextId?: string | null;  // 🔥 新增
  textProperties?: TextProperties | null;  // 🔥 新增
  onTextUpdate?: (props: Partial<TextProperties>) => void;  // 🔥 新增
};

// ==================== 核心修改：多 SSE 連線管理 ====================

type SSEConnectionState = {
  isConnecting: boolean;
  isConnected: boolean;
  userId: string;
  taskId: string;
  attempt: number;
};

export default function EditorPromptDock({
  mode,
  serverUrl,
  userId,
  selectedImagesCount = 0,
  selectedLayerIds = [], // ✅ 接收選中的圖層
  layerProcessingStates, // ✅ 接收圖層處理狀態
  beforeSubmit,
  onTaskUpdate,
  onTaskComplete,
  onTaskCreated,
  onError,
  fixed = true,
  framed = true,
  onModeChange,
  onAddTextWithAlpha,
  onPoseEditWithAlpha,
  onComposeMerge,
  onBackgroundRemove,
  onLayerSeparation,
  onBrushToggle,
  onEraserToggle,
  isBrushActive = false,
  isEraserActive = false,
  brushSize = 20,
  eraserSize = 20,
  eraserAction = "erase",
  onBrushSizeChange,
  onEraserSizeChange,
  onEraserActionChange,
  selectedTextId,
  textProperties,
  onTextUpdate,
}: EditorPromptDockProps) {
  const t = useTranslations("edited");
  const [prompt, setPrompt] = useState<string>("");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceImageName, setReferenceImageName] = useState<string>("");
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // ✅ 新增：追蹤正在提交中的圖層（立即反應）
  const [submittingLayers, setSubmittingLayers] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const currentPreviewRef = useRef<string | null>(null);
  const isComposingRef = useRef<boolean>(false);

  // ✅ 修改：用 Map 管理多個 SSE 連線
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
  const heartbeatsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastEventIdsRef = useRef<Map<string, string>>(new Map());
  const sseStatesRef = useRef<Map<string, SSEConnectionState>>(new Map());

  // ✅ 計算當前選中的圖層是否有任何一個正在處理或提交中
  const isCurrentLayerProcessing = selectedLayerIds.some(
    (layerId) => 
      layerProcessingStates?.get(layerId) === true ||
      submittingLayers.has(layerId)
  );

  // ✅ 計算總共有多少圖層正在處理（用於 UI 顯示）
  const processingLayersCount = (() => {
    const processingFromState = layerProcessingStates
      ? Array.from(layerProcessingStates.values()).filter((v) => v === true).length
      : 0;
    const additionalSubmitting = submittingLayers.size;
    return processingFromState + additionalSubmitting;
  })();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    const handler = () => {
      clearTimeout(window.__resizeTimer);
      window.__resizeTimer = setTimeout(checkMobile, 100);
    };
    checkMobile();
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("resize", handler);
      clearTimeout(window.__resizeTimer);
    };
  }, []);
  useEffect(() => {
    const handleFocus = () => {
      // 防止 iOS 放大
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1');
      }
    };
    
    const handleBlur = () => {
      // 恢復正常
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1');
      }
    };
    
    const input = inputRef.current;
    if (input) {
      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
      return () => {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      };
    }
  }, []);

  const canSubmit = (() => {
    // ✅ 如果當前選中的圖層正在處理中，不能提交
    if (isCurrentLayerProcessing) return false;
    if (!mode) return false;
    
    switch (mode) {
      case "EDIT":
        return !!prompt.trim() && selectedImagesCount <= 1;
      case "MERGE":
        return selectedImagesCount === 0 || selectedImagesCount >= 2;
      case "ACTION":
        return true;
      default:
        return false;
    }
  })();

  const removeReferenceImage = useCallback(() => {
    if (currentPreviewRef.current) {
      try {
        URL.revokeObjectURL(currentPreviewRef.current);
      } catch (err) {
        console.error("Failed to revoke URL:", err);
      }
      currentPreviewRef.current = null;
    }
    setReferenceFile(null);
    setReferenceImageName("");
    setReferencePreview(null);
  }, []);

  useEffect(() => {
    return () => {
      if (currentPreviewRef.current) {
        try {
          URL.revokeObjectURL(currentPreviewRef.current);
        } catch (err) {
          console.error("Failed to revoke URL on unmount:", err);
        }
      }
    };
  }, []);

  // ✅ 修改：清理特定 taskId 的 SSE 連線
  const cleanupSSE = useCallback((taskId: string) => {
    const es = eventSourcesRef.current.get(taskId);
    if (es) {
      try {
        es.close();
      } catch {}
      eventSourcesRef.current.delete(taskId);
    }

    const timer = heartbeatsRef.current.get(taskId);
    if (timer) {
      clearTimeout(timer);
      heartbeatsRef.current.delete(taskId);
    }

    lastEventIdsRef.current.delete(taskId);
    sseStatesRef.current.delete(taskId);
  }, []);

  // ✅ 修改：清理所有 SSE 連線
  const cleanupAllSSE = useCallback(() => {
    eventSourcesRef.current.forEach((es) => {
      try {
        es.close();
      } catch {}
    });
    eventSourcesRef.current.clear();

    heartbeatsRef.current.forEach((timer) => clearTimeout(timer));
    heartbeatsRef.current.clear();

    lastEventIdsRef.current.clear();
    sseStatesRef.current.clear();
  }, []);

  // ✅ unmount 時清理所有連線
  useEffect(() => cleanupAllSSE, [cleanupAllSSE]);

  // ✅ 修改：為特定 taskId 啟動 heartbeat
  const startHeartbeat = useCallback((taskId: string) => {
    const existingTimer = heartbeatsRef.current.get(taskId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      const es = eventSourcesRef.current.get(taskId);
      if (es) {
        es.close();
        cleanupSSE(taskId);
      }
    }, 15000);

    heartbeatsRef.current.set(taskId, timer);
  }, [cleanupSSE]);

  // ✅ 修改：重置特定 taskId 的 heartbeat
  const resetHeartbeat = useCallback(
    (taskId: string) => {
      startHeartbeat(taskId);
    },
    [startHeartbeat]
  );

  // ✅ 修改：連接 SSE，支援多個並行連線
  const connectSSE = useCallback(
    (userIdParam: string, taskIdParam: string) =>
      new Promise<boolean>((resolve) => {
        if (!userIdParam || !taskIdParam) return resolve(false);

        const scheduleReconnect = (attempt: number) => {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);

          cleanupSSE(taskIdParam);
          sseStatesRef.current.set(taskIdParam, {
            isConnecting: false,
            isConnected: false,
            userId: userIdParam,
            taskId: taskIdParam,
            attempt,
          });

          window.setTimeout(() => {
            const retryState = sseStatesRef.current.get(taskIdParam);
            if (!retryState || retryState.isConnected) return;
            void connectSSE(userIdParam, taskIdParam);
          }, delay);
        };

        // ✅ 檢查是否已有該 taskId 的連線
        const existingState = sseStatesRef.current.get(taskIdParam);
        if (existingState?.isConnected) {
          return resolve(true);
        }

        // ✅ 如果正在連接，不重複連接
        if (existingState?.isConnecting) {
          return resolve(false);
        }

        // ✅ 建立新的連線狀態
        const newState: SSEConnectionState = {
          isConnecting: true,
          isConnected: false,
          userId: userIdParam,
          taskId: taskIdParam,
          attempt: existingState?.attempt || 0,
        };
        sseStatesRef.current.set(taskIdParam, newState);

        const url = new URL(`/api/task-sse/stream`, window.location.origin);
        url.searchParams.set("userId", userIdParam);
        url.searchParams.set("taskId", taskIdParam);
        
        const lastEventId = lastEventIdsRef.current.get(taskIdParam);
        if (lastEventId) {
          url.searchParams.set("replay", "1");
          url.searchParams.set("after", lastEventId);
        }

        const es = new EventSource(url.toString(), { withCredentials: true });
        eventSourcesRef.current.set(taskIdParam, es);

        es.onopen = () => {
          newState.isConnected = true;
          newState.isConnecting = false;
          newState.attempt = 0;
          startHeartbeat(taskIdParam);
          resolve(true);
        };

        es.onerror = () => {
          newState.isConnecting = false;
          newState.isConnected = false;

          if (es.readyState === EventSource.CLOSED && newState.attempt < 5) {
            const nextAttempt = newState.attempt + 1;
            scheduleReconnect(nextAttempt);
            resolve(false);
            return;
          }

          es.close();
          cleanupSSE(taskIdParam);
          resolve(false);
        };

        es.addEventListener("heartbeat", () => resetHeartbeat(taskIdParam));

        const handleTaskEvent = (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as TaskEnvelope;
            if (e.lastEventId) {
              lastEventIdsRef.current.set(taskIdParam, e.lastEventId);
            }
            resetHeartbeat(taskIdParam);
            onTaskUpdate?.(data);

            if (data.status === "COMPLETED") {
              onTaskComplete?.(data);
              // ✅ 只清理該 taskId 的連線
              cleanupSSE(taskIdParam);
            } else if (data.status === "FAILED") {
              onError?.(t("task_failed"));
              // ✅ 只清理該 taskId 的連線
              cleanupSSE(taskIdParam);
            }
          } catch {}
        };

        es.addEventListener("task-update", handleTaskEvent);
        es.addEventListener("status", handleTaskEvent);
      }),
    [
      cleanupSSE,
      onTaskComplete,
      onTaskUpdate,
      onError,
      resetHeartbeat,
      startHeartbeat,
      t,
    ]
  );

  const clearPrompt = useCallback(() => setPrompt(""), []);

  const uploadReferenceImage = useCallback(
    async (
      file: File
    ): Promise<{ ok: boolean; imageName?: string; error?: string }> => {
      try {
        const form = new FormData();
        form.append("image", file);
        const res = await fetch(`${serverUrl}/image-processing/upload`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          const error = j?.error || t("upload_failed");
          return { ok: false, error };
        }
        const j = await res.json();
        if (j?.ok && j?.imageName) {
          return { ok: true, imageName: j.imageName };
        }
        return { ok: false, error: t("upload_failed") };
      } catch (e) {
        return { ok: false, error: t("upload_failed") };
      }
    },
    [serverUrl, t]
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      const trimmedPrompt = prompt.trim();
      if (mode === "EDIT" && !trimmedPrompt) return;
      if (mode === "EDIT" && selectedImagesCount > 1) return;
      if (mode === "MERGE" && selectedImagesCount === 1) return;

      // ✅ 立即標記當前選中的圖層為提交中
      setSubmittingLayers((prev) => {
        const next = new Set(prev);
        selectedLayerIds.forEach((id) => next.add(id));
        return next;
      });

      // ✅ 生成 taskId（提前生成以便追蹤）
      const uuid = ObjectID().toHexString();

      try {
        let uploadedImageName = referenceImageName;
        if (referenceFile && !referenceImageName) {
          const result = await uploadReferenceImage(referenceFile);
          if (!result.ok) {
            // 失敗時移除 submitting 標記
            setSubmittingLayers((prev) => {
              const next = new Set(prev);
              selectedLayerIds.forEach((id) => next.delete(id));
              return next;
            });
            onError?.(result.error || t("upload_failed"));
            return;
          }
          uploadedImageName = result.imageName!;
          setReferenceImageName(uploadedImageName);
        }

        const body: { [key: string]: unknown } = { mode, uuid };

        if (trimmedPrompt) body.prompt = trimmedPrompt;
        if (uploadedImageName) body.referenceImage = uploadedImageName;

        try {
          await beforeSubmit?.(body);
        } catch (err) {
          // 失敗時移除 submitting 標記
          setSubmittingLayers((prev) => {
            const next = new Set(prev);
            selectedLayerIds.forEach((id) => next.delete(id));
            return next;
          });
          onError?.(err instanceof Error ? err : "beforeSubmit error");
          return;
        }


        if (onAddTextWithAlpha && mode === "EDIT" && selectedImagesCount <= 1) {
          try {
            await onAddTextWithAlpha(
              trimmedPrompt,
              uploadedImageName || undefined
            );
            // ✅ 成功後移除 submitting 標記
            setSubmittingLayers((prev) => {
              const next = new Set(prev);
              selectedLayerIds.forEach((id) => next.delete(id));
              return next;
            });
            clearPrompt();
            return;
          } catch (err) {
            // 失敗時移除 submitting 標記
            setSubmittingLayers((prev) => {
              const next = new Set(prev);
              selectedLayerIds.forEach((id) => next.delete(id));
              return next;
            });
            onError?.(err instanceof Error ? err.message : t("submit_failed"));
            return;
          }
        }

        if (onPoseEditWithAlpha && mode === "ACTION") {
          try {
            await onPoseEditWithAlpha(
              trimmedPrompt,
              uploadedImageName || undefined
            );
            // ✅ 成功後移除 submitting 標記
            setSubmittingLayers((prev) => {
              const next = new Set(prev);
              selectedLayerIds.forEach((id) => next.delete(id));
              return next;
            });
            clearPrompt();
            return;
          } catch (err) {
            // 失敗時移除 submitting 標記
            setSubmittingLayers((prev) => {
              const next = new Set(prev);
              selectedLayerIds.forEach((id) => next.delete(id));
              return next;
            });
            onError?.(err instanceof Error ? err.message : t("action_submit_failed"));
            return;
          }
        }

        if (onComposeMerge && mode === "MERGE") {
          try {
            await onComposeMerge(trimmedPrompt);
            // ✅ 成功後移除 submitting 標記
            setSubmittingLayers((prev) => {
              const next = new Set(prev);
              selectedLayerIds.forEach((id) => next.delete(id));
              return next;
            });
            clearPrompt();
            return;
          } catch (err) {
            // 失敗時移除 submitting 標記
            setSubmittingLayers((prev) => {
              const next = new Set(prev);
              selectedLayerIds.forEach((id) => next.delete(id));
              return next;
            });
            onError?.(err instanceof Error ? err.message : t("merge_submit_failed"));
            return;
          }
        }

        const res = await fetch(`${serverUrl}/task/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || t("submit_failed"));
        }
        const j = await res.json();
        const taskId = j?.taskId;
        if (!taskId) {
          // 失敗時移除 submitting 標記
          setSubmittingLayers((prev) => {
            const next = new Set(prev);
            selectedLayerIds.forEach((id) => next.delete(id));
            return next;
          });
          onError?.(t("missing_task_id"));
          return;
        }

        onTaskCreated?.(taskId);
        clearPrompt();
        
        // ✅ 建立該 taskId 的 SSE 連線（不會影響其他連線）
        await connectSSE(userId, taskId);
        
        // ✅ SSE 連線建立後才移除 submitting 標記
        // 此時 layerProcessingStates 應該已經接管
        setSubmittingLayers((prev) => {
          const next = new Set(prev);
          selectedLayerIds.forEach((id) => next.delete(id));
          return next;
        });
      } catch (err) {
        // 失敗時移除 submitting 標記
        setSubmittingLayers((prev) => {
          const next = new Set(prev);
          selectedLayerIds.forEach((id) => next.delete(id));
          return next;
        });
        onError?.(err instanceof Error ? err.message : t("submit_failed"));
      }
    },
    [
      mode,
      prompt,
      selectedImagesCount,
      selectedLayerIds, // ✅ 加入依賴
      referenceFile,
      referenceImageName,
      uploadReferenceImage,
      beforeSubmit,
      serverUrl,
      userId,
      onTaskCreated,
      onError,
      connectSSE,
      onAddTextWithAlpha,
      t,
      onPoseEditWithAlpha,
      onComposeMerge,
      clearPrompt,
    ]
  );

  const onPickReferenceFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) {
        e.target.value = "";
        return;
      }
      if (!f.type.startsWith("image/")) {
        e.target.value = "";
        onError?.(t("please_select_image_file"));
        return;
      }

      try {
        if (currentPreviewRef.current) {
          try {
            URL.revokeObjectURL(currentPreviewRef.current);
          } catch (err) {
            console.error("Failed to revoke old URL:", err);
          }
        }

        const newPreviewUrl = URL.createObjectURL(f);
        currentPreviewRef.current = newPreviewUrl;

        setReferenceFile(f);
        setReferenceImageName("");
        setReferencePreview(newPreviewUrl);
        e.target.value = "";
      } catch (err) {
        e.target.value = "";
        onError?.(t("process_image_failed"));
      }
    },
    [onError, t]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (isComposingRef.current) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (canSubmit) handleSubmit(e as unknown as FormEvent);
      }
    },
    [canSubmit, handleSubmit]
  );

  const getPlaceholder = () => {
    switch (mode) {
      case "EDIT":
        return t("describe_edit_effect");
      case "MERGE":
        return t("describe_merge_effect_optional");
      case "ACTION":
        return t("describe_action_optional");
      default:
        return "";
    }
  };

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "48px";
    const newHeight = Math.max(48, textarea.scrollHeight);
    textarea.style.height = `${newHeight}px`;
  }, [prompt]);

  const handleModeChange = useCallback(
    (newMode: EditorMode) => {
      if (mode !== "MERGE" && newMode === "MERGE") {
        removeReferenceImage();
      }
      onModeChange?.(newMode);
    },
    [mode, removeReferenceImage, onModeChange]
  );

  const handleExitMode = useCallback(
    () => (onModeChange ? onModeChange(null) : ""),
    [onModeChange]
  );

  const getModeLabel = () => {
    switch (mode) {
      case "EDIT":
        return t("edit_mode");
      case "MERGE":
        return t("merge_mode");
      case "ACTION":
        return t("action_mode");
      default:
        return "";
    }
  };

  const canSelectMode = (targetMode: EditorMode) => {
    if (selectedImagesCount === 0 && targetMode !== "MERGE") {
      return false;
    }

    if (targetMode === "EDIT") return selectedImagesCount <= 1;
    if (targetMode === "MERGE")
      return (selectedImagesCount === 0 || selectedImagesCount >= 2) || isMobile;
    if (targetMode === "ACTION") return true;
    return false;
  };

  return (
    <div
      className={[
        fixed ? "fixed left-0 right-0 bottom-0 z-[60]" : "",
        // 🔥🔥 修正 1：底部輸入區改用 bg-white (白底)，避免整片紫 🔥🔥
        // 🔥🔥 修正 2：頂部邊框使用 custom-light-purple/50 (淡紫線)
        "bg-white dark:bg-[#1A2633] border-t border-custom-light-purple/50 dark:border-white/5",
      ].join(" ")}
    >
      <div
        className={framed ? "max-w-[1000px] mx-auto px-4 py-3" : "px-4 py-3"}
      >
        <AnimatePresence mode="wait">
          {isMobile && !mode ? (
            <motion.div
              key="mobile-mode-selector"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
            >
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange("EDIT")}
                  disabled={!canSelectMode("EDIT")}
                  className={[
                    "flex flex-col items-center justify-center py-3 rounded-lg border transition-all h-[60px]",
                    canSelectMode("EDIT")
                      ? "border-custom-logo-purple/50 bg-custom-light-purple/40 dark:bg-custom-light-purple/10 hover:bg-custom-light-purple/60"
                      : "border-custom-light-purple/20 bg-custom-light-purple/10 opacity-50 cursor-not-allowed",
                  ].join(" ")}
                >
                  <Edit3
                    size={18}
                    className={
                      canSelectMode("EDIT") ? "text-custom-logo-purple" : "text-custom-black/40 dark:text-custom-white/40"
                    }
                  />
                  <span
                    className={[
                      "text-xs font-medium mt-1",
                      canSelectMode("EDIT")
                        ? "text-custom-logo-purple"
                        : "text-custom-black/40 dark:text-custom-white/40",
                    ].join(" ")}
                  >
                    {t("edit")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange("ACTION")}
                  disabled={!canSelectMode("ACTION")}
                  className={[
                    "flex flex-col items-center justify-center py-3 rounded-lg border transition-all h-[60px]",
                    canSelectMode("ACTION")
                      ? "border-green-500/50 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30"
                      : "border-custom-light-purple/20 bg-custom-light-purple/10 opacity-50 cursor-not-allowed",
                  ].join(" ")}
                >
                  <Zap
                    size={18}
                    className={
                      canSelectMode("ACTION")
                        ? "text-green-500"
                        : "text-custom-black/40 dark:text-custom-white/40"
                    }
                  />
                  <span
                    className={[
                      "text-xs font-medium mt-1",
                      canSelectMode("ACTION")
                        ? "text-green-600 dark:text-green-400"
                        : "text-custom-black/40 dark:text-custom-white/40",
                    ].join(" ")}
                  >
                    {t("action")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange("MERGE")}
                  disabled={!canSelectMode("MERGE")}
                  className={[
                    "flex flex-col items-center justify-center py-3 rounded-lg border transition-all h-[60px]",
                    canSelectMode("MERGE")
                      ? "border-custom-logo-purple/50 bg-custom-light-purple/40 dark:bg-custom-light-purple/10 hover:bg-custom-light-purple/60"
                      : "border-custom-light-purple/20 bg-custom-light-purple/10 opacity-50 cursor-not-allowed",
                  ].join(" ")}
                >
                  <Layers
                    size={18}
                    className={
                      canSelectMode("MERGE")
                        ? "text-custom-logo-purple"
                        : "text-custom-black/40 dark:text-custom-white/40"
                    }
                  />
                  <div className="flex flex-col items-center">
                    <span
                      className={[
                        "text-xs font-medium",
                        canSelectMode("MERGE")
                          ? "text-custom-logo-purple"
                          : "text-custom-black/40 dark:text-custom-white/40",
                      ].join(" ")}
                    >
                      {t("merge")}
                    </span>
                    <span
                      className={[
                        "text-[10px] mt-0.5",
                        canSelectMode("MERGE")
                          ? "text-custom-black/60 dark:text-custom-white/60"
                          : "text-custom-black/40 dark:text-custom-white/40",
                      ].join(" ")}
                    >
                      {selectedImagesCount} {t("images_count")}
                    </span>
                  </div>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="prompt-input-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
            >
              <form onSubmit={handleSubmit} className="w-full">
                {isMobile && mode && (
                  <div className="mb-3 space-y-3">
                    <div className="flex items-center justify-between border-b border-custom-light-purple/30 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-custom-black dark:text-custom-white">
                          {getModeLabel()}
                        </span>
                        {mode === "MERGE" && (
                          <span className="text-xs text-custom-black/60 dark:text-custom-white/60">
                            {selectedImagesCount} {t("images_count")}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleExitMode}
                        className="w-8 h-8 rounded-full hover:bg-custom-light-purple/30 flex items-center justify-center text-custom-black/60 dark:text-custom-white/60"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {mode === "EDIT" && (
                      selectedTextId ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <select
                            value={textProperties?.fontFamily || "Arial"}
                            onChange={(e) => onTextUpdate?.({ fontFamily: e.target.value })}
                            className="w-24 px-2 py-1.5 rounded-lg bg-custom-light-purple/20 border border-custom-light-purple/30 text-xs text-custom-black dark:text-custom-white dark:bg-gray-800 dark:border-gray-700 outline-none"
                          >
                            <option value="Arial">Arial</option>
                            <option value="Helvetica">Helvetica</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Noto Sans TC">{t("noto_sans")}</option>
                            <option value="Noto Serif TC">{t("noto_serif")}</option>
                          </select>

                          <input
                            type="number"
                            value={textProperties?.fontSize || 32}
                            onChange={(e) => onTextUpdate?.({ fontSize: parseInt(e.target.value) })}
                            className="w-12 text-center px-1 py-1.5 rounded-lg bg-custom-light-purple/20 border border-custom-light-purple/30 text-xs text-custom-black dark:text-custom-white dark:bg-gray-800 dark:border-gray-700 outline-none"
                          />

                          <input
                            type="color"
                            value={(textProperties?.fill as string) || "#000000"}
                            onChange={(e) => onTextUpdate?.({ fill: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer border border-custom-light-purple/30"
                          />

                          <div className="w-px h-6 bg-custom-light-purple/30 mx-0.5" />

                          <button
                            type="button"
                            onClick={() => onTextUpdate?.({
                              fontWeight: textProperties?.fontWeight === "bold" ? "normal" : "bold"
                            })}
                            className={[
                              "w-8 h-8 rounded-lg font-bold text-sm transition-all flex items-center justify-center border",
                              textProperties?.fontWeight === "bold"
                                ? "bg-custom-logo-purple text-white border-custom-logo-purple"
                                : "bg-custom-light-purple/20 border-transparent hover:bg-custom-light-purple/40 text-custom-black dark:text-custom-white dark:bg-gray-800"
                            ].join(" ")}
                          >
                            B
                          </button>

                          <button
                            type="button"
                            onClick={() => onTextUpdate?.({
                              fontStyle: textProperties?.fontStyle === "italic" ? "normal" : "italic"
                            })}
                            className={[
                              "w-8 h-8 rounded-lg italic text-sm transition-all flex items-center justify-center border",
                              textProperties?.fontStyle === "italic"
                                ? "bg-custom-logo-purple text-white border-custom-logo-purple"
                                : "bg-custom-light-purple/20 border-transparent hover:bg-custom-light-purple/40 text-custom-black dark:text-custom-white dark:bg-gray-800"
                            ].join(" ")}
                          >
                            I
                          </button>

                          <button
                            type="button"
                            onClick={() => onTextUpdate?.({ underline: !textProperties?.underline })}
                            className={[
                              "w-8 h-8 rounded-lg underline text-sm transition-all flex items-center justify-center border",
                              textProperties?.underline
                                ? "bg-custom-logo-purple text-white border-custom-logo-purple"
                                : "bg-custom-light-purple/20 border-transparent hover:bg-custom-light-purple/40 text-custom-black dark:text-custom-white dark:bg-gray-800"
                            ].join(" ")}
                          >
                            U
                          </button>

                          <div className="w-px h-6 bg-custom-light-purple/30 mx-0.5" />

                          {['left', 'center', 'right'].map((align) => (
                            <button
                              key={align}
                              type="button"
                              onClick={() => onTextUpdate?.({ textAlign: align as "left" | "center" | "right" | "justify" | undefined })}
                              className={[
                                "w-8 h-8 rounded-lg transition-all flex items-center justify-center border",
                                textProperties?.textAlign === align
                                  ? "bg-custom-logo-purple text-white border-custom-logo-purple"
                                  : "bg-custom-light-purple/20 border-transparent hover:bg-custom-light-purple/40 text-custom-black dark:text-custom-white dark:bg-gray-800"
                              ].join(" ")}
                            >
                              <div className={align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right'}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  {align === 'left' && <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></>}
                                  {align === 'center' && <><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></>}
                                  {align === 'right' && <><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></>}
                                </svg>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          <button
                            type="button"
                            onClick={onBackgroundRemove}
                            className="flex flex-col justify-center items-center gap-1 py-2 px-2 rounded-lg border border-custom-light-purple/30 bg-custom-light-purple/10 hover:bg-custom-light-purple/30 active:scale-95 transition-transform text-custom-black dark:text-custom-white dark:bg-gray-800 dark:border-gray-700"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 3l18 18M3 21l18-18" />
                            </svg>
                            <span className="text-[10px]">{t("remove_background")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={onLayerSeparation}
                            className="flex flex-col justify-center items-center gap-1 py-2 px-2 rounded-lg border border-custom-light-purple/30 bg-custom-light-purple/10 hover:bg-custom-light-purple/30 active:scale-95 transition-transform text-custom-black dark:text-custom-white dark:bg-gray-800 dark:border-gray-700"
                          >
                            <Scissors size={18} />
                            <span className="text-[10px]">{t("separate")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={onBrushToggle}
                            className={`flex flex-col justify-center items-center gap-1 py-2 px-2 rounded-lg border transition-all active:scale-95 ${
                              isBrushActive
                                ? "border-custom-logo-purple bg-custom-light-purple/40 dark:bg-custom-light-purple/10"
                                : "border-custom-light-purple/30 bg-custom-light-purple/10 hover:bg-custom-light-purple/30 dark:bg-gray-800 dark:border-gray-700"
                            }`}
                          >
                            <Paintbrush
                              size={18}
                              className={isBrushActive ? "text-custom-logo-purple" : "text-custom-black dark:text-custom-white"}
                            />
                            <span className={`text-[10px] ${isBrushActive ? "text-custom-logo-purple" : "text-custom-black dark:text-custom-white"}`}>
                              {t("brush")}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={onEraserToggle}
                            className={`flex flex-col justify-center items-center gap-1 py-2 px-2 rounded-lg border transition-all active:scale-95 ${
                              isEraserActive
                                ? "border-custom-logo-purple bg-custom-light-purple/40 dark:bg-custom-light-purple/10"
                                : "border-custom-light-purple/30 bg-custom-light-purple/10 hover:bg-custom-light-purple/30 dark:bg-gray-800 dark:border-gray-700"
                            }`}
                          >
                            <EraserIcon
                              size={18}
                              className={isEraserActive ? "text-custom-logo-purple" : "text-custom-black dark:text-custom-white"}
                            />
                            <span className={`text-[10px] ${isEraserActive ? "text-custom-logo-purple" : "text-custom-black dark:text-custom-white"}`}>
                              {t("eraser")}
                            </span>
                          </button>
                        </div>
                      )
                    )}

                    {mode === "ACTION" && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={onEraserToggle}
                          className={`flex flex-col items-center gap-1 py-2 px-2 rounded-lg border transition-all active:scale-95 ${
                            isEraserActive
                              ? "border-custom-logo-purple bg-custom-light-purple/40 dark:bg-custom-light-purple/10"
                              : "border-custom-light-purple/30 bg-custom-light-purple/10 hover:bg-custom-light-purple/30 dark:bg-gray-800 dark:border-gray-700"
                          }`}
                        >
                          <EraserIcon
                            size={18}
                            className={isEraserActive ? "text-custom-logo-purple" : "text-custom-black dark:text-custom-white"}
                          />
                          <span
                            className={`text-[10px] ${
                              isEraserActive
                                ? "text-custom-logo-purple"
                                : "text-custom-black dark:text-custom-white"
                            }`}
                          >
                            {t("eraser")}
                          </span>
                        </button>
                        <div className="flex flex-col items-center gap-1 py-2 px-2 rounded-lg border border-custom-light-purple/30 bg-custom-light-purple/5 opacity-40">
                          <Paintbrush size={18} className="text-custom-black dark:text-custom-white" />
                          <span className="text-[10px] text-custom-black dark:text-custom-white">{t("brush_unavailable")}(N/A)</span>
                        </div>
                      </div>
                    )}

                    <AnimatePresence>
                      {isBrushActive && mode === "EDIT" && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.12 }}
                          className="p-3 rounded-lg bg-custom-light-purple/30 dark:bg-custom-light-purple/10 space-y-2"
                        >
                          <label className="text-xs font-medium text-custom-logo-purple">
                            {t("brush_size")}: {brushSize}px
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="100"
                            value={brushSize}
                            onChange={(e) =>
                              onBrushSizeChange?.(parseInt(e.target.value))
                            }
                            className="w-full accent-custom-logo-purple"
                          />
                        </motion.div>
                      )}
                      {isEraserActive &&
                        (mode === "EDIT" || mode === "ACTION") && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.12 }}
                            className="p-3 rounded-lg bg-custom-light-purple/30 dark:bg-custom-light-purple/10 space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onEraserActionChange?.("erase")}
                                className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                                  eraserAction === "erase"
                                    ? "bg-custom-logo-purple text-white"
                                    : "bg-custom-white dark:bg-custom-white-dark border border-custom-light-purple/30 text-custom-black dark:text-custom-white"
                                }`}
                              >
                                {t("erase")}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onEraserActionChange?.("restore")
                                }
                                className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${
                                  eraserAction === "restore"
                                    ? "bg-custom-logo-purple text-white"
                                    : "bg-custom-white dark:bg-custom-white-dark border border-custom-light-purple/30 text-custom-black dark:text-custom-white"
                                }`}
                              >
                                {t("restore")}
                              </button>
                            </div>
                            <label className="text-xs font-medium text-custom-logo-purple">
                              {t("eraser_size")}: {eraserSize}px
                            </label>
                            <input
                              type="range"
                              min="1"
                              max="150"
                              value={eraserSize}
                              onChange={(e) =>
                                onEraserSizeChange?.(parseInt(e.target.value))
                              }
                              className="w-full accent-custom-logo-purple"
                            />
                          </motion.div>
                        )}
                    </AnimatePresence>
                  </div>
                )}

                {mode !== "MERGE" && referencePreview && (
                  <div className="mb-3">
                    <div className="inline-block relative rounded-xl overflow-hidden">
                      <Image
                        src={referencePreview}
                        alt="ref"
                        width={200}
                        height={200}
                        className="max-w-[200px] max-h-[200px] object-cover rounded-xl"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={removeReferenceImage}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-custom-white/90 hover:bg-custom-white flex items-center justify-center shadow-lg text-custom-black"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  {/* 🔥🔥 修正 3：輸入框背景使用 custom-light-purple/30 (淺紫)，避免太白 🔥🔥 */}
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onCompositionStart={() => (isComposingRef.current = true)}
                    onCompositionEnd={() => (isComposingRef.current = false)}
                    placeholder={getPlaceholder()}
                    style={{ minHeight: "48px", height: "auto" }}
                    className="flex-1 resize-none rounded-2xl border border-custom-light-purple/20 bg-custom-light-purple/30 dark:bg-custom-white-dark px-4 py-3 text-base text-custom-black dark:text-custom-white outline-none focus:border-custom-logo-purple/50 focus:bg-custom-white dark:focus:bg-custom-white-dark focus:ring-1 focus:ring-custom-logo-purple/30 transition-all overflow-hidden placeholder:text-custom-black/50 dark:placeholder:text-custom-white/40 shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    // 🔥 禁用按鈕：使用淡紫色背景 bg-custom-light-purple/20
                    className={[
                      "flex-shrink-0 h-12 w-12 rounded-full transition-all flex items-center justify-center relative",
                      canSubmit
                        ? "bg-custom-logo-purple text-white hover:bg-custom-logo-purple-hover active:scale-95 shadow-md shadow-custom-logo-purple/20"
                        : "bg-custom-light-purple/20 text-custom-black/90 cursor-not-allowed",
                    ].join(" ")}
                  >
                    {processingLayersCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-sm">
                        {processingLayersCount}
                      </span>
                    )}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      fill="currentColor"
                      viewBox="0 0 256 256"
                    >
                      <path d="M208.49,120.49a12,12,0,0,1-17,0L140,69V216a12,12,0,0,1-24,0V69L64.49,120.49a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0l72,72A12,12,0,0,1,208.49,120.49Z" />
                    </svg>
                  </button>
                </div>

                {!isMobile && (
                  <div className="flex items-center gap-2 mt-2 px-1">
                    {mode !== "MERGE" && !referencePreview && (
                      <label className="w-8 h-8 rounded-lg hover:bg-custom-light-purple/30 cursor-pointer flex items-center justify-center text-custom-black/50 dark:text-custom-white/50 transition-colors">
                        <Upload size={16} />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onPickReferenceFile}
                          className="hidden"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => handleModeChange("EDIT")}
                      className={[
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all",
                        mode === "EDIT"
                          ? "bg-custom-logo-purple text-white shadow-sm"
                          : "text-custom-black/60 dark:text-custom-white/60 hover:bg-custom-light-purple/30",
                      ].join(" ")}
                    >
                      <Edit3 size={13} />
                      {t("edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeChange("ACTION")}
                      className={[
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all",
                        mode === "ACTION"
                          ? "bg-green-500 text-white shadow-sm"
                          : "text-custom-black/60 dark:text-custom-white/60 hover:bg-custom-light-purple/30",
                      ].join(" ")}
                    >
                      <Zap size={13} />
                      {t("action")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeChange("MERGE")}
                      className={[
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all",
                        mode === "MERGE"
                          ? "bg-custom-logo-purple text-white shadow-sm"
                          : "text-custom-black/60 dark:text-custom-white/60 hover:bg-custom-light-purple/30",
                      ].join(" ")}
                    >
                      <Layers size={13} />
                      {t("merge")}
                    </button>
                    <div className="flex-1" />
                    <div className="text-xs text-custom-black/40 dark:text-custom-white/40">
                      {selectedImagesCount} {t("images_count")}
                    </div>
                  </div>
                )}
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
