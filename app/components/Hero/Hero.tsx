"use client";

// =============================================
// GalleryPage.tsx — 首屏主標題 + 看更多（滿版大器 Overlay） + 全站順滑過場
// - Hero → 主標題區（你的三段導入＋看更多）→ 生成器 → 歷史 → Tabs → Footer
// - 看更多：整個畫面「滿版」展示 PitchSection（玻璃擬態、右上角叉叉、美型過場）
// - 不改動原本 SSE / 生成 / 歷史 / Tabs 邏輯
// =============================================

import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import Image from "next/image";
import ObjectID from "bson-objectid";

import HeroBanner from "./HeroBanner";
import ModelGalleryTabs from "./ModelGalleryTabs";
import PitchSection from "./PitchSection"; // 若路徑不同請修正

import { useAuth } from "@/app/context/AuthContext";
import { useTranslations } from "next-intl";
import { TaskStatus } from "../Drawing/types";

// =================== 型別 ===================
interface PublishedImage {
  id: string;
  publishedImageId: string;
  url: string;
  shortId?: string;
  userReaction?: {
    like: boolean;
    dislike: boolean;
    collecting: boolean;
    comment: string;
  };
  reactions?: {
    likes: number;
    dislikes: number;
    collections: number;
  };
}

interface GeneratedTask {
  id: string;
  publishedImages: PublishedImage[];
  prompt: string;
  timestamp: string;
  status: TaskStatus;
  queuePosition?: number;
}

// =================== 滿版 Overlay（真正全螢幕，非小框） ===================
function FullscreenPitchOverlay({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(open);
  const [leaving, setLeaving] = React.useState(false);

  // 掛載/離場
  React.useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
    } else if (mounted) {
      setLeaving(true);
      const t = setTimeout(() => {
        setMounted(false);
        setLeaving(false);
      }, 260);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  // ESC 關閉
  React.useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  // 鎖捲動
  React.useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-[100] transition-opacity duration-200 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* 背景（可點擊關閉） */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      {/* 裝飾光暈（不攔截滑鼠） */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/3 -left-1/3 w-[85vw] h-[85vw] rounded-full bg-fuchsia-500/10 blur-[120px]" />
        <div className="absolute -bottom-1/3 -right-1/3 w-[85vw] h-[85vw] rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      {/* 右上角 X（確保可點擊） */}
      <button
        type="button"
        onClick={onClose}
        aria-label="關閉"
        className={`fixed top-6 right-6 z-[120] size-12 rounded-full 
          bg-white/10 hover:bg-white/16 
          border border-white/15 
          shadow-[0_8px_40px_rgba(0,0,0,0.45)]
          backdrop-blur 
          grid place-items-center
          transition-all duration-200
          ${leaving ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}
      >
        <svg
          className="w-6 h-6 text-slate-200"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {/* 內容：整層可滾動；內層水平置中 */}
      <div
        className={`absolute inset-0 overflow-y-auto ${
          leaving ? "pitch-leave" : "pitch-enter"
        }`}
      >
        {/* 頂部彩色飾條 */}
        <div className="sticky top-0 h-[3px] bg-gradient-to-r from-fuchsia-400 via-purple-400 to-sky-400" />

        {/* 這層負責「水平置中」 */}
        <div className="w-full flex justify-center">
          {/* 內容行寬：好讀但不窄；左右留白有氣勢 */}
          <div className="w-full px-6 md:px-10 lg:px-14 xl:px-20 py-10 md:py-14 max-w-[110ch]">
            {children}
          </div>
        </div>
      </div>

      {/* Enter/Leave 動畫（與你原本一致） */}
      <style jsx global>{`
        .pitch-enter {
          animation: pitchIn 240ms cubic-bezier(0.2, 0.8, 0.16, 1) both;
        }
        .pitch-leave {
          animation: pitchOut 240ms cubic-bezier(0.2, 0.8, 0.16, 1) both;
        }
        @keyframes pitchIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0px);
          }
        }
        @keyframes pitchOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(8px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .pitch-enter,
          .pitch-leave {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// =================== 主頁面 ===================
export default function GalleryPage() {
  const { user } = useAuth();
  const t = useTranslations("gallery");

  // —— 生成相關狀態 —— //
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [prompt, setPrompt] = useState<string>("");
  const [styleWeight, setStyleWeight] = useState<number>(0.7);
  const [selectedModel, setSelectedModel] = useState<string>("68eb54598cab2cac2b49f873");
  const [selectedPreset, setSelectedPreset] = useState<string>("standard");
  const [selectedSize, setSelectedSize] = useState<string>("sq-1024");

  // —— 圖片查看器（生成歷史） —— //
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [viewingImages, setViewingImages] = useState<Array<{ url: string; prompt: string }>>([]);

  // —— Pitch 滿版 Overlay —— //
  const [isPitchOpen, setIsPitchOpen] = useState<boolean>(false);

  // —— SSE 與心跳管理 —— //
  const eventSourceRef = useRef<EventSource | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const connectionStateRef = useRef<{
    isConnecting: boolean;
    isConnected: boolean;
    currentTaskId: string | null;
    userId: string | null;
    reconnectAttempt: number;
    lastEventId: string | null;
  }>({
    isConnecting: false,
    isConnected: false,
    currentTaskId: null,
    userId: null,
    reconnectAttempt: 0,
    lastEventId: null,
  });

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // —— 清理 SSE —— //
  const cleanupSSE = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch {}
      eventSourceRef.current = null;
    }
    connectionStateRef.current = {
      isConnecting: false,
      isConnected: false,
      currentTaskId: null,
      userId: null,
      reconnectAttempt: 0,
      lastEventId: null,
    };
  }, []);

  const startHeartbeatMonitor = useCallback((taskId: string) => {
    const HEARTBEAT_TIMEOUT = 15000;
    if (heartbeatTimerRef.current) clearTimeout(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setTimeout(() => {
      const state = connectionStateRef.current;
      if (state.currentTaskId === taskId && eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    }, HEARTBEAT_TIMEOUT);
  }, []);

  const resetHeartbeatMonitor = useCallback(
    (taskId: string) => {
      if (connectionStateRef.current.currentTaskId === taskId) {
        startHeartbeatMonitor(taskId);
      }
    },
    [startHeartbeatMonitor]
  );

  const updateTaskStatus = useCallback(
    (taskId: string, updates: Partial<GeneratedTask>) => {
      setGeneratedTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
      );
    },
    []
  );

  const startTaskStatusPolling = useCallback(
    (taskId: string) => {
      if (!taskId) return;

      window.setTimeout(async () => {
        if (connectionStateRef.current.currentTaskId !== taskId) {
          return;
        }

        try {
          const res = await fetch(`/api/task/${encodeURIComponent(taskId)}/status`, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          });

          if (!res.ok) {
            return;
          }

          const task = await res.json();
          const images: PublishedImage[] = (task.publishedImages || []).map(
            (
              item: { publishedImageId: string; url: string; shortId: string },
              index: number
            ) => ({
              id: `${taskId}_${index}`,
              publishedImageId: item.publishedImageId || "",
              shortId: item.shortId,
              url: item.url || "",
              userReaction: { like: false, dislike: false, collecting: false, comment: "" },
              reactions: { likes: 0, dislikes: 0, collections: 0 },
            })
          );

          updateTaskStatus(taskId, {
            publishedImages: images.length > 0 ? images : undefined,
            status: task.status,
          });

          if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
            setIsGenerating(false);
            cleanupSSE();
          }
        } catch (error) {
          console.warn("Hero task status polling failed:", error);
        }
      }, 1500);
    },
    [cleanupSSE, updateTaskStatus]
  );

  // —— 建立 SSE —— //
  const setupUserSSE = useCallback(
    async (userId: string, taskId: string): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        if (!userId || !taskId) {
          resolve(false);
          return;
        }
        const state = connectionStateRef.current;

        if (state.isConnected && state.currentTaskId === taskId && state.userId === userId) {
          resolve(true);
          return;
        }
        if (state.isConnecting && state.currentTaskId === taskId) {
          setTimeout(() => resolve(state.isConnected), 600);
          return;
        }

        // 清理舊連線
        cleanupSSE();

        connectionStateRef.current = {
          isConnecting: true,
          isConnected: false,
          currentTaskId: taskId,
          userId,
          reconnectAttempt: state.currentTaskId === taskId ? state.reconnectAttempt : 0,
          lastEventId: state.currentTaskId === taskId ? state.lastEventId : null,
        };

        const lastEventId = connectionStateRef.current.lastEventId;
        let url = `/api/task-sse/stream?userId=${encodeURIComponent(userId)}&taskId=${encodeURIComponent(taskId)}&limit=5`;
        if (lastEventId) url += `&replay=1`;

        const maxReconnectAttempts = 5;
        const getReconnectDelay = (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 16000);

        const connectSSE = () => {
          const currentState = connectionStateRef.current;
          if (currentState.currentTaskId !== taskId) {
            resolve(false);
            return;
          }
          try {
            const es = new EventSource(url, { withCredentials: true });
            eventSourceRef.current = es;

            es.addEventListener("open", () => {
              connectionStateRef.current.isConnecting = false;
              connectionStateRef.current.isConnected = true;
              connectionStateRef.current.reconnectAttempt = 0;
              startHeartbeatMonitor(taskId);
              resolve(true);
            });

            es.addEventListener("heartbeat", () => resetHeartbeatMonitor(taskId));

            es.addEventListener("status", (e: MessageEvent) => {
              try {
                if (e.lastEventId) connectionStateRef.current.lastEventId = e.lastEventId;
                const task = JSON.parse(e.data);

                if (task.status === TaskStatus.FAILED) {
                  updateTaskStatus(taskId, { status: TaskStatus.FAILED });
                  setIsGenerating(false);
                  cleanupSSE();
                  return;
                }

                // 非完成狀態
                if (task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.IN_QUEUE) {
                  const images: PublishedImage[] = (task.publishedImages || []).map(
                    (
                      img: { publishedImageId: string; url: string; shortId: string },
                      i: number
                    ) => ({
                      id: `${taskId}_${i}`,
                      publishedImageId: img.publishedImageId || "",
                      url: img.url || "",
                      shortId: img.shortId,
                      userReaction: { like: false, dislike: false, collecting: false, comment: "" },
                      reactions: { likes: 0, dislikes: 0, collections: 0 },
                    })
                  );

                  // 無資料→提供骨架
                  if (images.length === 0) {
                    for (let i = 0; i < 4; i++) {
                      images.push({
                        id: `${taskId}_${i}`,
                        publishedImageId: "",
                        url: "",
                        userReaction: { like: false, dislike: false, collecting: false, comment: "" },
                        reactions: { likes: 0, dislikes: 0, collections: 0 },
                      });
                    }
                  }

                  updateTaskStatus(taskId, { publishedImages: images, status: task.status });
                  return;
                }

                // 完成狀態
                if (
                  task.status === TaskStatus.COMPLETED &&
                  Array.isArray(task.publishedImages) &&
                  task.publishedImages.length > 0
                ) {
                  const updatedImages = task.publishedImages.map(
                    (
                      item: { publishedImageId: string; url: string; shortId: string },
                      index: number
                    ) => ({
                      id: `${taskId}_${index}`,
                      publishedImageId: item.publishedImageId,
                      shortId: item.shortId,
                      url: item.url || "",
                      userReaction: { like: false, dislike: false, collecting: false, comment: "" },
                      reactions: { likes: 0, dislikes: 0, collections: 0 },
                    })
                  );

                  updateTaskStatus(taskId, { publishedImages: updatedImages, status: TaskStatus.COMPLETED });

                  setIsGenerating(false);
                  cleanupSSE();
                }
              } catch (err) {
                console.error("Error parsing status event:", err);
              }
            });

            es.addEventListener("queue", (e: MessageEvent) => {
              try {
                if (e.lastEventId) connectionStateRef.current.lastEventId = e.lastEventId;
                const queueInfo = JSON.parse(e.data) as Array<{ id: string; position: number }>;
                queueInfo.forEach((data) => updateTaskStatus(data.id, { queuePosition: data.position }));
              } catch (err) {
                console.error("Error parsing queue event:", err);
              }
            });

            es.addEventListener("error", () => {
              const currentState = connectionStateRef.current;
              if (es.readyState === EventSource.CLOSED) {
                if (currentState.currentTaskId !== taskId) {
                  resolve(false);
                  return;
                }

                if (currentState.reconnectAttempt < maxReconnectAttempts) {
                  currentState.reconnectAttempt++;
                  const delay = getReconnectDelay(currentState.reconnectAttempt - 1);
                  connectionStateRef.current.isConnecting = true;
                  connectionStateRef.current.isConnected = false;

                  reconnectTimerRef.current = setTimeout(() => {
                    if (connectionStateRef.current.currentTaskId === taskId) connectSSE();
                    else resolve(false);
                  }, delay);
                } else {
                  startTaskStatusPolling(taskId);
                  setIsGenerating(false);
                  cleanupSSE();
                  resolve(false);
                }
              } else if (es.readyState === EventSource.CONNECTING) {
                connectionStateRef.current.isConnecting = true;
                connectionStateRef.current.isConnected = false;
                resetHeartbeatMonitor(taskId);
                startTaskStatusPolling(taskId);
              }
            });
          } catch (error) {
            console.error("Error creating EventSource:", error);
            startTaskStatusPolling(taskId);
            resolve(false);
          }
        };

        connectSSE();
      });
    },
    [cleanupSSE, resetHeartbeatMonitor, startHeartbeatMonitor, startTaskStatusPolling, updateTaskStatus]
  );

  useEffect(() => () => cleanupSSE(), [cleanupSSE]);

  useEffect(() => {
    let wasHidden = false;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const reconnectStream = (reason: string) => {
      const state = connectionStateRef.current;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      reconnectTimer = setTimeout(() => {
        if (state.currentTaskId && state.userId) {
          console.log(`🔄 Hero task SSE reconnect: ${reason}`);
          cleanupSSE();
          void setupUserSSE(state.userId, state.currentTaskId).then((connected) => {
            if (!connected && state.currentTaskId) {
              startTaskStatusPolling(state.currentTaskId);
            }
          });
        }
      }, 1000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        wasHidden = true;
        return;
      }

      if (wasHidden) {
        reconnectStream("visibility-restored");
      }
      wasHidden = false;
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        reconnectStream("bfcache-restored");
      }
    };

    const handleOnline = () => {
      reconnectStream("online");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("online", handleOnline);

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("online", handleOnline);
    };
  }, [cleanupSSE, setupUserSSE, startTaskStatusPolling]);

  useEffect(() => {
    const reconnectableTaskIds = generatedTasks
      .filter(
        (task) =>
          task.id &&
          task.status !== TaskStatus.COMPLETED &&
          task.status !== TaskStatus.FAILED
      )
      .map((task) => task.id);

    if (reconnectableTaskIds.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      reconnectableTaskIds.forEach((taskId) => {
        const state = connectionStateRef.current;
        const isActiveSseTask =
          state.currentTaskId === taskId &&
          (state.isConnecting || state.isConnected);

        if (!isActiveSseTask) {
          startTaskStatusPolling(taskId);
        }
      });
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [generatedTasks, startTaskStatusPolling]);

  // —— 發送生成請求 —— //
  const handleGenerate = async (): Promise<void> => {
    if (!prompt.trim() || !selectedModel || isGenerating) return;
    setIsGenerating(true);

    const tempUuid = ObjectID().toHexString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const requestBody: {
        modelId: string;
        uuid: string;
        prompt: string;
        presetId: string;
        sizeId: string;
        styleWeight: number;
        type?: string;
      } = {
        modelId: selectedModel,
        uuid: tempUuid,
        prompt: prompt.trim(),
        presetId: selectedPreset,
        sizeId: selectedSize,
        styleWeight,
      };
      if (selectedModel === "68eb54598cab2cac2b49f873") requestBody.type = "A109";

      const res = await fetch("/api/task/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("生成失敗");
      const data = await res.json();
      if (!data.taskId) throw new Error("Missing taskId in response");

      const taskId = data.taskId;
      const initialTask: GeneratedTask = {
        id: taskId,
        publishedImages: Array(4)
          .fill(null)
          .map((_, i) => ({
            id: `${taskId}_${i}`,
            publishedImageId: "",
            url: "",
            userReaction: { like: false, dislike: false, collecting: false, comment: "" },
            reactions: { likes: 0, dislikes: 0, collections: 0 },
          })),
        prompt: prompt,
        timestamp: new Date().toISOString(),
        status: TaskStatus.PROMPT_DELIVERING,
      };

      setGeneratedTasks((prev) => [initialTask, ...prev]);
      const sseConnected = await setupUserSSE(user?.id || "", taskId);
      if (!sseConnected) console.warn("SSE 連接失敗");
    } catch (err) {
      console.error("生成錯誤:", err);
      setIsGenerating(false);
      cleanupSSE();
    } finally {
      clearTimeout(timeout);
    }
  };

  // —— 圖片查看器（歷史） —— //
  const handleOpenGeneratedImageViewer = (task: GeneratedTask, startIndex: number) => {
    const images = task.publishedImages.filter((img) => img.url).map((img) => ({ url: img.url, prompt: task.prompt }));
    setViewingImages(images);
    setSelectedImageIndex(startIndex);
    setIsImageViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setIsImageViewerOpen(false);
    setViewingImages([]);
  };
  const handlePrevious = () => {
    if (selectedImageIndex > 0) setSelectedImageIndex((prev) => prev - 1);
  };
  const handleNext = () => {
    if (selectedImageIndex < viewingImages.length - 1) setSelectedImageIndex((prev) => prev + 1);
  };

  // —— 圖片查看器：鍵盤支援 —— //
  useEffect(() => {
    if (!isImageViewerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseViewer();
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isImageViewerOpen, selectedImageIndex, viewingImages.length]);


  // ====== 標題組件（保留） ======
  const GroupTitle = memo(
    useCallback(
      ({
        prompt,
        timestamp,
        status,
      }: {
        prompt: string | React.ReactNode;
        timestamp: string;
        count: number;
        status?: TaskStatus;
      }) => {
        const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

        const statusInfo = (() => {
          switch (status) {
            case TaskStatus.IN_QUEUE:
              return { text: t("status_in_queue") || "排隊中", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: "⏳" };
            case TaskStatus.PROMPT_DELIVERING:
              return { text: t("status_prompt_delivering") || "提示詞傳遞中", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: "📤" };
            case TaskStatus.AI_PROCESSING:
              return { text: t("status_ai_processing") || "AI處理中", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: "🤖" };
            case TaskStatus.GENERATING:
              return { text: t("status_generating") || "圖片生成中", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: "🎨" };
            default:
              return null;
          }
        })();

        return (
          <div className="col-span-full mb-8 mt-4 first:mt-0">
            <div className="group relative">
              <div>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base md:text-lg font-semibold text-white line-clamp-3 leading-relaxed">{prompt}</h3>
                  </div>

                  {statusInfo && (
                    <div
                      aria-live="polite"
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusInfo.color} ${
                        prefersReducedMotion ? "" : "animate-pulse"
                      }`}
                    >
                      <span className="text-base leading-none">{statusInfo.icon}</span>
                      <span>{statusInfo.text}</span>
                    </div>
                  )}

                  {status === TaskStatus.COMPLETED && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      <span className="text-base leading-none">✅</span>
                      <span>{t("completed") || "已完成"}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formatDate(timestamp)}</span>
                  </div>
                </div>

                {status && status !== TaskStatus.COMPLETED && (
                  <div className="mt-3" aria-hidden="true">
                    <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                        style={{
                          width:
                            status === TaskStatus.GENERATING ? "75%" : status === TaskStatus.AI_PROCESSING ? "50%" : status === TaskStatus.PROMPT_DELIVERING ? "25%" : "10%",
                          transition: prefersReducedMotion ? "none" : "width 1.8s ease-in-out",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      },
      [t, prefersReducedMotion]
    )
  );

  const ImageSkeleton = () => (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-800/50 border border-purple-500/20">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-700/40 via-slate-700/20 to-slate-700/40" />
    </div>
  );

  // =================== 畫面 ===================
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero */}
      <HeroBanner />

      {/* ===== 主標題＋三段導入 + 看更多（不吃太多版面） ===== */}
      <section className="w-full max-w-7xl mx-auto px-6 mt-10">
        <div className="max-w-[80ch]">
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Hondolab Yours：為您打造專屬 AI 模型與數位資產
          </h1>
          <div className="mt-4 text-slate-200 leading-8 text-[15px] space-y-4">
            <p>AI 生成的浪潮已然來臨，但它也帶來一個根本性困境：您是在建立「資產」還是在積累「負債」？</p>
            <p>
              當您的團隊將珍貴的原創角色、創作手稿、品牌設計上傳至 ChatGPT、Midjourney 等通用模型時，
              您就是在用自己最寶貴的數據，去訓練一個不屬於您、不受您控制的「公共大腦」。
              一旦進入這些通用大模型，您的原創內容就是別人的訓練資料。這不是協作，這是數位資產的單向流失。
            </p>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setIsPitchOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold text-white
              bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500
              focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400
              shadow-[0_8px_32px_rgba(168,85,247,0.28)] transition-all"
            >
              看更多
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* 生成面板 */}
      <div className="w-full max-w-7xl mx-auto px-6 py-12">
        <div className="bg-slate-800/80 rounded-2xl p-8 border border-purple-500/20 mb-12 backdrop-blur-sm" aria-labelledby="generator-heading">
          <h2 id="generator-heading" className="text-2xl font-bold text-white mb-6">
            訂製你的專屬AI模型
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-white font-medium mb-2 text-sm" htmlFor="model-select">
                選擇模型
              </label>
              <select
                id="model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-slate-700/50 text-white rounded-lg px-4 py-2 border border-slate-600 focus:border-purple-500 outline-none text-sm transition-all"
              >
                <option value="">選擇風格</option>
                <option value="988f6fdca24db156bcb38528">風格轉移：鬼滅之刃風格</option>
                <option value="68ed9c1cad7d2563378060ed">超級融合：全新美日式經典風格</option>
                <option value="68ed9c82cc3e600fe7f15ff2">專案客製：JumpAnime</option>
                <option value="68eb54598cab2cac2b49f873">原創孿生：鬼滅之刃</option>
                <option value="68ebbb87a14057a087bf43c9">原創孿生：彌豆子</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-white font-medium mb-2 text-sm" htmlFor="prompt-input">
                描述你的想法
              </label>
              <input
                id="prompt-input"
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例如：穿著黑色羽織的劍士..."
                className="w-full bg-slate-700/50 text-white rounded-lg px-4 py-2 border border-slate-600 focus:border-purple-500 outline-none text-sm transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isGenerating) handleGenerate();
                }}
                aria-describedby="prompt-help"
              />
              <p id="prompt-help" className="sr-only">按 Enter 可直接開始生成</p>
            </div>

            <div>
              <label className="block text-white font-medium mb-2 text-sm" htmlFor="style-range">
                風格強度：{(styleWeight * 100).toFixed(0)}%
              </label>
              <input
                id="style-range"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={styleWeight}
                onChange={(e) => setStyleWeight(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-white font-medium mb-2 text-sm" htmlFor="preset-select">
                生成品質
              </label>
              <select
                id="preset-select"
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full bg-slate-700/50 text-white rounded-lg px-4 py-2 border border-slate-600 focus:border-purple-500 outline-none text-sm transition-all"
              >
                <option value="sketch">⚡ 速寫模式 (8步)</option>
                <option value="standard">🎨 標準模式 (18步)</option>
                <option value="detail">✨ 細節模式 (36步)</option>
              </select>
            </div>

            <div>
              <label className="block text-white font-medium mb-2 text-sm" htmlFor="size-select">
                圖片尺寸
              </label>
              <select
                id="size-select"
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                className="w-full bg-slate-700/50 text-white rounded-lg px-4 py-2 border border-slate-600 focus:border-purple-500 outline-none text-sm transition-all"
              >
                <option value="sq-1024">⬜ 正方形 (1024×1024)</option>
                <option value="poster-832x1216">📱 直式海報 (832×1216)</option>
                <option value="banner-1344x896">🖼️ 橫幅 (1344×896)</option>
              </select>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating || !selectedModel}
              className={`px-8 py-3 rounded-lg font-bold text-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                isGenerating
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 shadow-[0_8px_34px_rgba(168,85,247,0.25)] hover:shadow-[0_10px_46px_rgba(168,85,247,0.35)]"
              }`}
              aria-live="polite"
              aria-busy={isGenerating}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  生成中...
                </span>
              ) : (
                "開始生成"
              )}
            </button>
          </div>

          {/* 生成歷史 */}
          {generatedTasks.length > 0 && (
            <div className="mt-6 space-y-6">
              <h3 className="text-white font-medium mb-3">生成歷史</h3>
              {generatedTasks.map((task) => (
                <div key={task.id} className="bg-slate-700/30 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <GroupTitle
                        prompt={task.prompt || ""}
                        timestamp={task.timestamp || new Date().toISOString()}
                        count={task.publishedImages?.length || 0}
                        status={task.status}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {task.publishedImages.map((image, idx) => (
                      <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-800/50 border border-purple-500/20 group">
                        {image.url ? (
                          <Image
                            src={image.url}
                            alt={task.prompt ? `${task.prompt}（第 ${idx + 1} 張）` : `生成圖片 ${idx + 1}`}
                            fill
                            className="object-cover cursor-pointer transition-transform duration-300 group-hover:scale-[1.03]"
                            onClick={() => handleOpenGeneratedImageViewer(task, idx)}
                          />
                        ) : (
                          <ImageSkeleton />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 作品集 Tabs */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">可客製化模型種類</h1>
        </div>
        <ModelGalleryTabs />
      </div>

      {/* 滿版 Pitch Overlay（大器全畫面） */}
      <FullscreenPitchOverlay open={isPitchOpen} onClose={() => setIsPitchOpen(false)}>
        <PitchSection />
      </FullscreenPitchOverlay>

      {/* 圖片查看器（生成歷史） */}
      {isImageViewerOpen && viewingImages[selectedImageIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="圖片查看器"
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={handleCloseViewer}
        >
          <button
            type="button"
            onClick={handleCloseViewer}
            className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text白 z-10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            aria-label="關閉"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {selectedImageIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
              }}
              className="absolute left-4 w-12 h-12 rounded-full bg白/10 hover:bg白/20 flex items-center justify-center text白 z-10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              aria-label="上一張"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {selectedImageIndex < viewingImages.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-4 w-12 h-12 rounded-full bg白/10 hover:bg白/20 flex items-center justify-center text白 z-10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              aria-label="下一張"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <div className="relative max-w-6xl max-h-[85vh] w-full h-full flex items-center justify-center px-20" onClick={(e) => e.stopPropagation()}>
            <Image src={viewingImages[selectedImageIndex].url} alt={viewingImages[selectedImageIndex].prompt || "生成圖片"} fill className="object-contain" priority />
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-4xl w-full px-6">
            <div className="bg-black/80 backdrop-blur-md rounded-lg p-4 border border-white/10">
              <p className="text-white text-sm mb-2">{viewingImages[selectedImageIndex].prompt}</p>
              <p className="text-gray-400 text-xs">
                {selectedImageIndex + 1} / {viewingImages.length}
              </p>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-slate-950 border-t border-slate-800 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500">
          <p>© Hondolab Inc. All rights reserved.</p>
        </div>
      </footer>

      {/* 全域互動動畫與降級 */}
      <style jsx global>{`
        button, a, [role="button"] {
          transition: color 160ms ease, background-color 160ms ease, border-color 160ms ease, box-shadow 200ms ease, transform 200ms ease;
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
