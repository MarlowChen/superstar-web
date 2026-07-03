"use client";

import { JSX, useRef, useState, useEffect, useContext } from "react";
import ImageGallery from "../../components/Drawing/ImageGallery";
import { GalleryContext } from "../../components/Drawing/contexts/GalleryContext";
import PromptForm from "../../components/Drawing/PromptForm";
import { ImageDataGroup } from "../../components/Drawing/types";
import DrawerModelSelector from "../DrawerModelSelector";
import LoraModelSelection from "../LoraModelSelection";
import ModelDialog from "../ModelDialog";
import { LoraModel } from "@/payload-types";
import { useAuth } from "@/app/context/AuthContext";
import { useScroll } from "@/app/context/ScrollContext";
import { useSearchParams } from "next/navigation";
import {
  Image as ImageIcon,
  Mic,
  PenSquare,
  Sparkles,
  Video,
} from "lucide-react";

type GalleryContentProps = {
  initialTemplate?: {
    prompt?: string;
    type?: "image" | "video" | "audio" | "text" | "chat" | null;
    aspectRatio?: string;
    count?: number;
    modelId?: string;
    selectedImageUrl?: string;
  };
};

export default function GalleryContent({
  initialTemplate,
}: GalleryContentProps): JSX.Element {
  const { user } = useAuth();
  const { setScrollY } = useScroll();
  const searchParams = useSearchParams();
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const { images } = useContext(GalleryContext);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [showModelDetails, setShowModelDetails] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LoraModel | null>(null);
  const [modelForDetails, setModelForDetails] = useState<LoraModel | null>(
    null
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isImageToImageMode, setIsImageToImageMode] =
    useState<boolean>(false);
  const [retryGenerationRequest, setRetryGenerationRequest] =
    useState<ImageDataGroup | null>(null);
  const selectedConversationId = searchParams.get("conversationId");
  const [isConversationHistoryLoading, setIsConversationHistoryLoading] =
    useState(Boolean(selectedConversationId));
  const shouldShowNewConversationHero =
    !isGenerating &&
    images.length === 0 &&
    !selectedConversationId;

  useEffect(() => {
    setIsConversationHistoryLoading(Boolean(selectedConversationId));
  }, [selectedConversationId]);

  useEffect(() => {
    const handleHistoryLoading = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: string }>).detail;
      if (!selectedConversationId || detail?.conversationId !== selectedConversationId) {
        return;
      }
      setIsConversationHistoryLoading(true);
    };

    const handleHistoryLoaded = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: string }>).detail;
      if (!selectedConversationId || detail?.conversationId !== selectedConversationId) {
        return;
      }
      setIsConversationHistoryLoading(false);
    };

    window.addEventListener("drawing:conversation-history-loading", handleHistoryLoading);
    window.addEventListener("drawing:conversation-history-loaded", handleHistoryLoaded);

    return () => {
      window.removeEventListener("drawing:conversation-history-loading", handleHistoryLoading);
      window.removeEventListener("drawing:conversation-history-loaded", handleHistoryLoaded);
    };
  }, [selectedConversationId]);

  useEffect(() => {
    if (shouldScrollToBottom) {
      scrollToBottom();
    }
  }, [images, shouldScrollToBottom]);

  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      const threshold = 100;
      return (
        container.scrollHeight - container.scrollTop - container.clientHeight <
        threshold
      );
    }
    return false;
  };

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (container) {
      setScrollY(container.scrollTop);
    }
    setShouldScrollToBottom(isNearBottom());
  };

  const handleSelectModel = (model: LoraModel) => {
    const modelKind = String((model as LoraModel & { kind?: string }).kind || "").toLowerCase();
    const nextType =
      modelKind === "chat" || modelKind === "text"
        ? modelKind
        : modelKind === "image" || modelKind === "video" || modelKind === "audio"
          ? modelKind
          : null;

    setSelectedModel(model);
    setIsModelSelectorOpen(false);

    if (nextType) {
      window.dispatchEvent(
        new CustomEvent("drawing:apply-prompt-template", {
          detail: {
            prompt: "",
            type: nextType,
          },
        })
      );
    }
  };

  const toggleSelectedModel = (model: LoraModel) => {
    setModelForDetails(model);
    setShowModelDetails(true);
  };

  const applyStarterMode = (
    type: "image" | "video" | "audio" | "text" | "chat"
  ) => {
    window.dispatchEvent(
      new CustomEvent("drawing:apply-prompt-template", {
        detail: {
          prompt: "",
          type,
        },
      })
    );
  };

  const displayName =
    user?.name ||
    user?.email?.split("@")[0] ||
    user?.username ||
    "there";

  const starterActions = [
    {
      label: "生成圖片",
      type: "image" as const,
      icon: ImageIcon,
    },
    {
      label: "製作影片",
      type: "video" as const,
      icon: Video,
    },
    {
      label: "生成聲音",
      type: "audio" as const,
      icon: Mic,
    },
    {
      label: "撰寫內容",
      type: "text" as const,
      icon: PenSquare,
    },
  ];

  return (
    <main
      className="h-full min-h-0 overflow-y-auto bg-custom-gray px-4 pt-4 dark:bg-custom-gray-dark md:pt-8"
      ref={messagesContainerRef}
      onScroll={handleScroll}
    >
      <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl flex-1 flex-col md:px-2">
        {shouldShowNewConversationHero ? (
          <div className="flex min-h-[calc(100dvh-6rem)] flex-1 flex-col items-center justify-start px-1 pb-10 pt-10 sm:px-4 md:justify-center md:pb-[10dvh] md:pt-0">
            <div className="mb-5 w-full max-w-4xl md:mb-6">
              <div className="mx-auto max-w-2xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#9ee3ff] to-[#159cff] text-[#07121d] shadow-[0_12px_34px_rgba(21,156,255,0.24)]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-semibold tracking-normal text-[#10243a] dark:text-white">
                    {displayName}，你好
                  </div>
                </div>
                <h1 className="text-4xl font-semibold tracking-normal text-[#10243a] dark:text-white md:text-5xl">
                  你想從哪裡著手？
                </h1>
              </div>
            </div>

            <div className="w-full max-w-4xl">
              <PromptForm
                isGenerating={isGenerating}
                setIsGenerating={setIsGenerating}
                callback={scrollToBottom}
                setShowModelDetails={(open: boolean) => {
                  setShowModelDetails(open);
                }}
                setIsModelSelectorOpen={(open: boolean) => {
                  setIsModelSelectorOpen(open);
                }}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                initialTemplate={initialTemplate}
                retryGenerationRequest={retryGenerationRequest}
                onRetryGenerationRequestConsumed={() => setRetryGenerationRequest(null)}
                onImageToImageModeChange={setIsImageToImageMode}
              />
            </div>

            <div className="mt-6 flex w-full max-w-4xl flex-wrap items-center justify-center gap-3">
              {starterActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.type}
                    type="button"
                    onClick={() => applyStarterMode(action.type)}
                    className="inline-flex h-11 items-center gap-2.5 rounded-full border border-[#cfe0ee] bg-white px-5 text-sm font-semibold text-[#10243a] shadow-[0_8px_22px_rgba(16,36,58,0.08)] transition hover:border-[#159cff] hover:bg-[#eef7ff] dark:border-[#22384e] dark:bg-[#101a26] dark:text-white dark:shadow-[0_8px_22px_rgba(0,0,0,0.14)] dark:hover:border-[#53c7ff] dark:hover:bg-[#132235]"
                  >
                    <Icon className="h-4 w-4 text-[#159cff] dark:text-[#53c7ff]" />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 w-full max-w-5xl flex-col transition-all duration-300 ease-in-out">
            <div className="flex-1 text-custom-white">
              <div className="w-full h-full z-0">
                <div className="p-4 space-y-4 relative">
                  <ImageGallery
                    isLoading={isGenerating}
                    isConversationLoading={isConversationHistoryLoading}
                    onRetryGeneration={setRetryGenerationRequest}
                  />
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 mx-auto w-full pt-6 z-[11]">
              <PromptForm
                isGenerating={isGenerating}
                setIsGenerating={setIsGenerating}
                callback={scrollToBottom}
                setShowModelDetails={(open: boolean) => {
                  setShowModelDetails(open);
                }}
                setIsModelSelectorOpen={(open: boolean) => {
                  setIsModelSelectorOpen(open);
                }}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                initialTemplate={initialTemplate}
                retryGenerationRequest={retryGenerationRequest}
                onRetryGenerationRequestConsumed={() => setRetryGenerationRequest(null)}
                onImageToImageModeChange={setIsImageToImageMode}
              />
            </div>
          </div>
        )}

        <DrawerModelSelector
          isOpen={isModelSelectorOpen}
          onClose={() => setIsModelSelectorOpen(false)}
          ref={scrollContainerRef}
        >
          <LoraModelSelection
            scrollContainerRef={scrollContainerRef}
            onSelectModel={handleSelectModel}
            toggleSelectedModel={toggleSelectedModel}
            isImageToImageMode={isImageToImageMode}
          />
        </DrawerModelSelector>

        <ModelDialog
          isOpen={showModelDetails}
          onClose={() => setShowModelDetails(false)}
          model={modelForDetails}
        />
      </div>
    </main>
  );
}
