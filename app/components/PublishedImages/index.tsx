"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { showToast } from "../CustomToast";
import useReactions from "../EnhancedImageDisplay/useReactions";
import CommentDialog from "../CommentDialog";
import { useLocale, useTranslations } from "next-intl";
import {
  Heart,
  ThumbsUp,
  ThumbsDown,
  Download,
  Copy,
  Share2,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ShareDropdown } from "./ShareDropdown";
import { getDownloadFileName } from "@/utils/getDownloadFileName";
import { useScroll } from "@/app/context/ScrollContext";
import { OriginalImageModal } from "../Drawing/OriginalImageModal";
import ImageModal from "../Drawing/ImageModal";

const isVideoUrl = (url?: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || "");
const isAudioUrl = (url?: string) => /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(url || "");

type LocalizedText = string | Record<string, unknown> | null | undefined;

const toDisplayText = (value: LocalizedText, locale: string, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return fallback;

  const localized =
    value[locale] ??
    value[locale.split("-")[0]] ??
    value["zh-TW"] ??
    value.en ??
    Object.values(value).find((item) => typeof item === "string");

  return typeof localized === "string" ? localized : fallback;
};

interface CommentReaction {
  comment?: string;
  imageId: string;
}

interface ImageData {
  id: string;
  url: string;
  reactions: {
    likes: number;
    dislikes: number;
    collections?: number;
  };
  userReaction: {
    like: boolean;
    dislike: boolean;
    collecting?: boolean;
    comment?: string;
  };
}

interface ImageGroup {
  taskId: string;
  page: number;
  limit: number;
  sort: "desc" | "asc";
  prompt: string;
  loraModelName: string;
  userMessage?: LocalizedText;
  images: ImageData[];
  uploadedImages?: ImageData[]; // 🖼️ 新增：原始上傳圖片
}

// 分享按鈕組件
const ShareButton = React.forwardRef<
  HTMLButtonElement,
  {
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    isActive: boolean;
    className?: string;
    isMobile?: boolean;
    disabled?: boolean;
    title: string;
  }
>(
  (
    { onClick, isActive, className, isMobile = false, disabled = false, title },
    ref
  ) => (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={`
      ${isMobile
          ? "flex items-center justify-center rounded-full px-2 py-1 text-[11px] transition-all duration-200"
          : "p-2 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 shadow-lg"
        } 
      ${isMobile
          ? isActive
            ? "bg-white/10 text-emerald-300"
            : "text-white/60 hover:bg-white/8 hover:text-white"
          : isActive
            ? "bg-emerald-500/90 text-white shadow-lg"
            : "bg-black/50 text-white hover:bg-black/70"
        } 
      ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      ${className || ""}`}
      title={title}
    >
      <Share2 className={isMobile ? "h-3.5 w-3.5" : "w-4 h-4"} />
    </button>
  )
);

ShareButton.displayName = "ShareButton";

const PublishedImages: React.FC = () => {
  const lng = useLocale();
  const t = useTranslations("modelview");
  const [publishedImages, setPublishedImages] = useState<ImageGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImageGroup>({
    taskId: "",
    prompt: "",
    page: 1,
    limit: 10,
    sort: "desc",
    loraModelName: "",
    images: [],
    uploadedImages: [], // 🖼️ 新增：原始上傳圖片
  });
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const { toggleReaction, toggleReactionComment } = useReactions();
  const [openCommentDialog, setCommentDialogOpen] = useState<boolean>(false);
  const [showComment] = useState<CommentReaction>({
    imageId: "",
    comment: "",
  });
  const isFirstRender = useRef(true);

  // 🖼️ 新增：原圖放大查看狀態
  const [showOriginalImageModal, setShowOriginalImageModal] = useState<boolean>(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>();

  // 分享相關狀態
  const [shareDropdowns, setShareDropdowns] = useState<Record<string, boolean>>(
    {}
  );
  const [sharedImages, setSharedImages] = useState<Record<string, boolean>>({});
  const shareButtonRefs = useRef<
    Record<string, React.RefObject<HTMLButtonElement>>
  >({});
  const { setScrollY } = useScroll();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const container = containerRef.current;
    if (container) {
      // 更新全局滾動狀態（用於手機版漢堡選單滑動顯示/隱藏）
      setScrollY(container.scrollTop);
    }
  };
  // 判斷是否為付費用戶
  const isPremium = true;
  // // 🔥 除錯資訊 - 無論如何都會顯示
  // console.log("=== CollectingImages 組件載入 ===");
  // console.log("userPoint 物件:", userPoint);
  // console.log("當前用戶的 pointType:", userPoint?.pointType);
  // console.log("是否為付費用戶:", isPremium);
  // console.log("================================");
  // 處理升級到付費版的函數
  const handleUpgradeToPremium = () => {
    // 觸發自定義事件來開啟升級對話框
    window.dispatchEvent(new CustomEvent('openPaymentDialog'));
  };

  // 顯示付費限制提示
  const showPremiumToast = useCallback(() => {
    showToast(t("premium_required"), true);
  }, [t]);

  // 獲取或創建分享按鈕的 ref
  const getShareButtonRef = (imageId: string) => {
    if (!shareButtonRefs.current[imageId]) {
      shareButtonRefs.current[imageId] = React.createRef<HTMLButtonElement>();
    }
    return shareButtonRefs.current[imageId];
  };

  // 處理分享下拉選單開關
  const toggleShareDropdown = (imageId: string) => {
    if (!isPremium) {
      showPremiumToast();
      return;
    }
    setShareDropdowns((prev) => ({
      ...prev,
      [imageId]: !prev[imageId],
    }));
  };

  // 關閉分享下拉選單
  const closeShareDropdown = (imageId: string) => {
    setShareDropdowns((prev) => ({
      ...prev,
      [imageId]: false,
    }));
  };

  // 準備分享數據
  const getShareData = (image: ImageData, prompt: string, group?: ImageGroup) => ({
    url: `${process.env.NEXT_PUBLIC_URL}/${lng}/details/${image.id}`,
    title: t("share_image_title"),
    description: prompt || t("share_image_description"),
    hashtag: "#AIArt #GeneratedImage",
    imageUrl: image.url,
    modelName: group?.loraModelName,
    imageId: image.id,
  });

  // 處理分享完成
  const handleShareComplete = (imageId: string, platform: string) => {
    setSharedImages((prev) => ({
      ...prev,
      [imageId]: true,
    }));

    if (platform === "copy") {
      showToast(t("share_link_copied"));
    } else if (platform === "download") {
      showToast(t("download_success"));
    } else {
      showToast(t("shared_successfully", { platform }));
    }

    setTimeout(() => {
      setSharedImages((prev) => ({
        ...prev,
        [imageId]: false,
      }));
    }, 2000);
  };

  // 批次下載函數
  async function safeDownloadImagesZip(group: ImageGroup) {
    try {
      const { downloadImagesAsZip, isIOSDevice } = await import('@/utils/downloadHelper');

      // iOS 提示：建議單張下載以保存到相簿
      if (isIOSDevice()) {
        showToast(t("ios_batch_download_hint"), false);
      }

      // 準備圖片列表
      const seen = new Set();
      const imageList = group.images
        .filter((image) => {
          if (seen.has(image.id)) return false;
          seen.add(image.id);
          return true;
        })
        .map((image) => ({
          url: image.url,
          fileName: getDownloadFileName(group.loraModelName, image.id)
        }));

      const zipFileName = `superstar-${group.loraModelName}-${group.taskId}.zip`;
      const success = await downloadImagesAsZip(imageList, zipFileName);

      if (success) {
        showToast(t("images_downloaded_success"));
      } else {
        throw new Error('ZIP download failed');
      }
    } catch (error) {
      console.error("Download failed:", error);
      showToast(t("images_download_failed"), true);
    }
  }

  // 複製文字的函數
  const copyToClipboard = async (text: string) => {
    if (!isPremium) {
      showPremiumToast();
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast(t("copied_success"));
    } catch (error) {
      console.error("Copy failed:", error);
      showToast(t("copy_failed"), true);
    }
  };

  const fetchPublishedImages = useCallback(async (pageNum: number) => {
    // 重要：非付費用戶只加載第一頁數據
    if (loading) return;
    setLoading(true);

    try {
      const limit = 10;
      const response = await fetch(
        `/api/user/images/${pageNum}/${limit}`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("Failed to fetch images");
      const data = await response.json();

      const resultData = data.groups.map((item: ImageGroup) => {
        const prompt = toDisplayText(
          item.userMessage,
          lng,
          toDisplayText(item.prompt as LocalizedText, lng)
        );

        return {
          taskId: item.taskId,
          page: pageNum,
          limit: limit,
          sort: "desc",
          prompt,
          loraModelName: toDisplayText(item.loraModelName as LocalizedText, lng),
          images: item.images || [],
          uploadedImages: item.uploadedImages || [], // 🖼️ 新增：處理原始上傳圖片
        };
      });

      setPublishedImages((prev) => {
        // 避免重複的數據
        const existingIds = new Set(prev.map((item) => item.taskId));
        const newItems = resultData.filter(
          (item: ImageGroup) => !existingIds.has(item.taskId)
        );
        const nextItems = [...prev, ...newItems];

        setHasMore(nextItems.length < data.total);

        return nextItems;
      });
    } catch (error) {
      console.error("Failed to fetch images:", error);
    } finally {
      setLoading(false);
    }
  }, [lng, loading]);

  useEffect(() => {
    // 只在首次渲染時執行一次
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchPublishedImages(page);
    }
  }, [fetchPublishedImages, page]);

  // 分開處理滾動加載的邏輯
  useEffect(() => {
    if (!isFirstRender.current && page > 1) {
      fetchPublishedImages(page);
    }
  }, [fetchPublishedImages, page]);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading) {
        setPage((prev) => prev + 1);
      }
    },
    [hasMore, loading]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "20px",
      threshold: 0.1,
    });

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  const openSelectImageDialog = (
    selectIndex: number,
    imageGroup: ImageGroup
  ) => {
    if (!isPremium) {
      showPremiumToast();
      return;
    }

    setSelectedImage(imageGroup);
    setIsImageViewerOpen(true);
    setSelectedImageIndex(selectIndex);
  };

  // 修復後的 handleReaction 函數
  const handleReaction = useCallback(
    async (imageId: string, reactionType: "like" | "dislike") => {
      if (!isPremium) {
        showPremiumToast();
        return;
      }

      const groupIndex = publishedImages.findIndex((group) =>
        group.images.some((image) => image.id === imageId)
      );

      if (groupIndex === -1) return;

      const imageIndex = publishedImages[groupIndex].images.findIndex(
        (image) => image.id === imageId
      );

      if (imageIndex === -1) return;

      const updatedMessages = [...publishedImages];
      const currentImage = updatedMessages[groupIndex].images[imageIndex];
      const wasLiked = currentImage.userReaction.like;
      const wasDisliked = currentImage.userReaction.dislike;

      // 新的反應狀態
      let newLikeState = false;
      let newDislikeState = false;
      let newLikeCount = currentImage.reactions.likes;
      let newDislikeCount = currentImage.reactions.dislikes;

      if (reactionType === "like") {
        if (wasLiked) {
          newLikeState = false;
          newLikeCount -= 1;
        } else {
          newLikeState = true;
          newLikeCount += 1;
          if (wasDisliked) {
            newDislikeState = false;
            newDislikeCount -= 1;
          }
        }
      } else {
        if (wasDisliked) {
          newDislikeState = false;
          newDislikeCount -= 1;
        } else {
          newDislikeState = true;
          newDislikeCount += 1;
          if (wasLiked) {
            newLikeState = false;
            newLikeCount -= 1;
          }
        }
      }

      updatedMessages[groupIndex].images[imageIndex] = {
        ...currentImage,
        userReaction: {
          ...currentImage.userReaction,
          like: newLikeState,
          dislike: newDislikeState,
        },
        reactions: {
          ...currentImage.reactions,
          likes: newLikeCount,
          dislikes: newDislikeCount,
        },
      };

      if (selectedImage.taskId === updatedMessages[groupIndex].taskId) {
        const selectedImageIndex = selectedImage.images.findIndex(
          (img) => img.id === imageId
        );

        if (selectedImageIndex !== -1) {
          const updatedSelectedImages = [...selectedImage.images];
          updatedSelectedImages[selectedImageIndex] =
            updatedMessages[groupIndex].images[imageIndex];

          setSelectedImage({
            ...selectedImage,
            images: updatedSelectedImages,
          });
        }
      }

      setPublishedImages(updatedMessages);

      const imageGroup = updatedMessages[groupIndex];
      await toggleReaction(
        imageId,
        reactionType,
        imageGroup.page,
        imageGroup.limit,
        imageGroup.sort
      );
    },
    [toggleReaction, publishedImages, selectedImage, isPremium, showPremiumToast]
  );

  // 處理收藏反應
  const handleCollectReaction = useCallback(
    async (imageId: string) => {
      if (!isPremium) {
        showPremiumToast();
        return;
      }

      const groupIndex = publishedImages.findIndex((group) =>
        group.images.some((image) => image.id === imageId)
      );

      if (groupIndex === -1) return;

      const imageIndex = publishedImages[groupIndex].images.findIndex(
        (image) => image.id === imageId
      );

      if (imageIndex === -1) return;

      const updatedMessages = [...publishedImages];
      const currentImage = updatedMessages[groupIndex].images[imageIndex];
      const wasCollecting = currentImage.userReaction.collecting || false;

      try {
        const response = await fetch(
          `/api/image-reaction/${encodeURIComponent(imageId)}`,
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

        if (!response.ok) throw new Error("Failed to toggle collection");

        updatedMessages[groupIndex].images[imageIndex] = {
          ...currentImage,
          userReaction: {
            ...currentImage.userReaction,
            collecting: !wasCollecting,
          },
          reactions: {
            ...currentImage.reactions,
            collections: wasCollecting
              ? (currentImage.reactions.collections || 1) - 1
              : (currentImage.reactions.collections || 0) + 1,
          },
        };

        if (selectedImage.taskId === updatedMessages[groupIndex].taskId) {
          const selectedImageIndex = selectedImage.images.findIndex(
            (img) => img.id === imageId
          );

          if (selectedImageIndex !== -1) {
            const updatedSelectedImages = [...selectedImage.images];
            updatedSelectedImages[selectedImageIndex] =
              updatedMessages[groupIndex].images[imageIndex];

            setSelectedImage({
              ...selectedImage,
              images: updatedSelectedImages,
            });
          }
        }

        setPublishedImages(updatedMessages);


      } catch (error) {
        console.error("Collection toggle failed:", error);

      }
    },
    [publishedImages, selectedImage, isPremium, showPremiumToast]
  );

  // 處理評論反應
  const submitReactionComment = useCallback(
    async (commentData: CommentReaction) => {
      if (!isPremium) {
        showPremiumToast();
        return;
      }

      const { imageId, comment } = commentData;

      const groupIndex = publishedImages.findIndex((group) =>
        group.images.some((image) => image.id === imageId)
      );

      if (groupIndex === -1) return;

      const imageIndex = publishedImages[groupIndex].images.findIndex(
        (image) => image.id === imageId
      );

      if (imageIndex === -1) return;

      const updatedMessages = [...publishedImages];

      updatedMessages[groupIndex].images[imageIndex] = {
        ...updatedMessages[groupIndex].images[imageIndex],
        userReaction: {
          ...updatedMessages[groupIndex].images[imageIndex].userReaction,
          comment: comment,
        },
      };

      if (selectedImage.taskId === updatedMessages[groupIndex].taskId) {
        const selectedImageIndex = selectedImage.images.findIndex(
          (img) => img.id === imageId
        );

        if (selectedImageIndex !== -1) {
          const updatedSelectedImages = [...selectedImage.images];
          updatedSelectedImages[selectedImageIndex] =
            updatedMessages[groupIndex].images[imageIndex];

          setSelectedImage({
            ...selectedImage,
            images: updatedSelectedImages,
          });
        }
      }

      setPublishedImages(updatedMessages);

      const imageGroup = updatedMessages[groupIndex];
      await toggleReactionComment(
        imageId,
        comment || "",
        imageGroup.page,
        imageGroup.limit,
        imageGroup.sort
      );

      setCommentDialogOpen(false);
    },
    [toggleReactionComment, publishedImages, selectedImage, isPremium, showPremiumToast]
  );

  // 🖼️ 新增：處理原圖點擊放大
  const handleOriginalImageClick = useCallback((imageUrl: string) => {
    setShowOriginalImageModal(true);
    setOriginalImageUrl(imageUrl);
  }, []);

  // 🖼️ 新增：關閉原圖放大視窗
  const handleCloseOriginalImageModal = useCallback(() => {
    setShowOriginalImageModal(false);
  }, []);

  // Empty state component
  const EmptyState = (): JSX.Element => (
    <div className="text-center py-20 px-4">
      <div className="mx-auto h-24 w-24 text-custom-logo-purple dark:text-custom-logo-purple-dark mb-6 opacity-50">
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
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-custom-black dark:text-custom-black-dark mb-2">
        {t("no_published_images")}
      </h3>
      <p className="text-gray-500 dark:text-gray-400">
        {t("start_creating_hint")}
      </p>
    </div>
  );

  return (
    <div
      className="content-scrollbar min-h-screen overflow-y-auto bg-custom-gray px-4 pb-[9rem] pt-8 dark:bg-[#120f16]"
      ref={containerRef}
      onScroll={handleScroll}
    >
      <div className="relative mx-auto max-w-6xl px-2 py-6 sm:px-4 lg:px-6">
        {publishedImages.length === 0 && !loading ? (
          <EmptyState />
        ) : (
          <div className="space-y-10">
            {publishedImages.map((group) => (
              <div
                key={group.taskId}
                className="space-y-4"
              >
                <div className="rounded-[28px] bg-white/78 p-4 shadow-[0_10px_30px_rgba(46,30,78,0.08)] backdrop-blur-sm dark:bg-white/[0.03] dark:shadow-[0_14px_40px_rgba(0,0,0,0.18)] sm:p-5">
                  <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      {group.uploadedImages && group.uploadedImages.length > 0 && (
                        <button
                          onClick={() =>
                            handleOriginalImageClick(group.uploadedImages![0].url)
                          }
                          className="group relative hidden shrink-0 overflow-hidden rounded-2xl bg-[#eee8f8] shadow-[0_8px_20px_rgba(46,30,78,0.10)] transition-all duration-200 hover:-translate-y-0.5 dark:bg-[#1b1622] dark:shadow-[0_8px_20px_rgba(0,0,0,0.18)] sm:block"
                          title={t("original_image_hint")}
                        >
                          {isVideoUrl(group.uploadedImages[0].url) ? (
                            <video
                              src={group.uploadedImages[0].url}
                              className="h-14 w-14 object-cover transition-transform duration-200 group-hover:scale-105"
                              muted
                              playsInline
                              autoPlay
                              loop
                            />
                          ) : (
                            <Image
                              src={group.uploadedImages[0].url}
                              alt={t("original_image")}
                              width={56}
                              height={56}
                              className="h-14 w-14 object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          )}
                          <div className="absolute bottom-1.5 right-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                            Ref
                          </div>
                        </button>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#efe9f8] px-2.5 py-1 text-[11px] font-medium text-[#5e4d85] dark:bg-white/[0.05] dark:text-[#d4cde4]">
                            {group.loraModelName}
                          </span>
                          <span className="text-[11px] text-[#8b7fa5] dark:text-[#887c9a]">
                            {group.images.length} {t("generated_image")}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-sm leading-7 text-[#2f2740] dark:text-[#f3effb] sm:text-[15px]">
                          &quot;{group.prompt}&quot;
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 self-end lg:self-start">
                      <button
                        className={`rounded-xl p-2 transition-all duration-200 ${
                          !isPremium
                            ? "cursor-not-allowed text-gray-300"
                            : "text-[#7f7298] hover:bg-[#efe9f8] hover:text-[#4f3f74] dark:text-[#a79bbd] dark:hover:bg-white/[0.06] dark:hover:text-white"
                        }`}
                        onClick={() => copyToClipboard(group.prompt)}
                        disabled={!isPremium}
                        title={t("copy_prompt")}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        className={`rounded-xl p-2 transition-all duration-200 ${
                          !isPremium
                            ? "cursor-not-allowed text-gray-300"
                            : "text-[#7f7298] hover:bg-[#efe9f8] hover:text-[#4f3f74] dark:text-[#a79bbd] dark:hover:bg-white/[0.06] dark:hover:text-white"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          safeDownloadImagesZip(group);
                        }}
                        disabled={!isPremium}
                        title={t("download_all")}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {group.images.map((image, index) => (
                      <div
                        key={image.id}
                        className="group relative transition-all duration-300"
                      >
                        <div className="overflow-hidden rounded-2xl bg-[#f3eef9] shadow-[0_8px_22px_rgba(46,30,78,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(46,30,78,0.12)] dark:bg-[#1b1622] dark:shadow-[0_8px_22px_rgba(0,0,0,0.18)]">
                          {/* 圖片區域 */}
                          <div
                            className="aspect-square relative overflow-hidden cursor-pointer"
                            onClick={() => openSelectImageDialog(index, group)}
                          >
                            {isVideoUrl(image.url) ? (
                              <video
                                src={image.url}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                muted
                                playsInline
                                autoPlay
                                loop
                              />
                            ) : isAudioUrl(image.url) ? (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#f4eefb] via-[#efe6fb] to-[#e7dcfa] px-4 text-center text-[#4c3d6d] dark:from-[#201828] dark:via-[#261d31] dark:to-[#2c2238] dark:text-[#e8e0fb]">
                                <div className="text-sm font-semibold">Audio</div>
                                <audio
                                  src={image.url}
                                  controls
                                  className="w-full max-w-[220px]"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : (
                              <Image
                                src={image.url}
                                alt={t("generated_image")}
                                fill
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            )}

                            {/* 非付費用戶鎖定效果 */}
                            {!isPremium && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                                  <svg
                                    className="w-6 h-6 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                    />
                                  </svg>
                                </div>
                              </div>
                            )}

                            {/* 右上角浮動按鈕 - 僅桌面版 hover 顯示 */}
                            <div className="absolute top-2 right-2 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden md:flex">
                              {/* 留言按鈕 */}
                              {/* <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isPremium) {
                                    setShowComment({
                                      imageId: image.id,
                                      comment: image.userReaction.comment || "",
                                    });
                                    setCommentDialogOpen(true);
                                  } else {
                                    showPremiumToast();
                                  }
                                }}
                                disabled={!isPremium}
                                className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 shadow-lg ${
                                  !isPremium
                                    ? "bg-black/30 text-white/50 cursor-not-allowed"
                                    : image.userReaction.comment
                                    ? "bg-emerald-500/90 text-white"
                                    : "bg-black/50 text-white hover:bg-black/70"
                                }`}
                                title={t("comment")}
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button> */}

                              {/* 分享按鈕 */}
                              <ShareButton
                                ref={getShareButtonRef(image.id)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleShareDropdown(image.id);
                                }}
                                isActive={
                                  shareDropdowns[image.id] ||
                                  sharedImages[image.id]
                                }
                                disabled={!isPremium}
                                title={t("share_image")}
                              />
                            </div>

                            <div className="absolute inset-x-0 bottom-0">
                              <div className="flex items-center justify-center gap-2 bg-black/10 px-3 py-1.5 backdrop-blur-[2px] transition-all duration-200 group-hover:bg-black/18 group-hover:backdrop-blur-[4px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(image.id, "like");
                                  }}
                                  disabled={!isPremium}
                                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 ${!isPremium
                                      ? "text-white/35 cursor-not-allowed"
                                      : image.userReaction.like
                                        ? "bg-white/10 text-blue-300"
                                        : "text-white/60 hover:bg-white/8 hover:text-white"
                                    }`}
                                  title={t("like_image")}
                                >
                                  <ThumbsUp
                                    className={`h-3.5 w-3.5 ${image.userReaction.like ? "fill-current" : ""
                                      }`}
                                  />
                                  <span>{image.reactions.likes}</span>
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(image.id, "dislike");
                                  }}
                                  disabled={!isPremium}
                                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 ${!isPremium
                                      ? "text-white/35 cursor-not-allowed"
                                      : image.userReaction.dislike
                                        ? "bg-white/10 text-red-300"
                                        : "text-white/60 hover:bg-white/8 hover:text-white"
                                    }`}
                                  title={t("dislike_image")}
                                >
                                  <ThumbsDown
                                    className={`h-3.5 w-3.5 ${image.userReaction.dislike
                                        ? "fill-current"
                                        : ""
                                      }`}
                                  />
                                  <span>{image.reactions.dislikes}</span>
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCollectReaction(image.id);
                                  }}
                                  disabled={!isPremium}
                                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 ${!isPremium
                                      ? "text-white/35 cursor-not-allowed"
                                      : image.userReaction.collecting
                                        ? "bg-white/10 text-pink-300"
                                        : "text-white/60 hover:bg-white/8 hover:text-white"
                                    }`}
                                  title={t("collect_image")}
                                >
                                  <Heart
                                    className={`h-3.5 w-3.5 ${image.userReaction.collecting
                                        ? "fill-current"
                                        : ""
                                      }`}
                                  />
                                  <span>{image.reactions.collections || 0}</span>
                                </button>

                                <div className="md:hidden">
                                  <ShareButton
                                    ref={getShareButtonRef(
                                      `${image.id}-mobile`
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleShareDropdown(`${image.id}-mobile`);
                                    }}
                                    isActive={
                                      shareDropdowns[`${image.id}-mobile`] ||
                                      sharedImages[image.id]
                                    }
                                    isMobile={true}
                                    disabled={!isPremium}
                                    title={t("share_image")}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* 載入指示器 */}
            {loading && (
              <div className="py-12 text-center">
                <div className="inline-flex items-center gap-3 rounded-xl bg-white/80 px-6 py-4 shadow-[0_10px_26px_rgba(46,30,78,0.08)] backdrop-blur-sm dark:bg-white/[0.04] dark:shadow-[0_10px_26px_rgba(0,0,0,0.18)]">
                  <div className="w-6 h-6 border-2 border-custom-logo-purple/20 border-t-custom-logo-purple dark:border-t-custom-logo-purple-dark rounded-full animate-spin"></div>
                  <p className="text-custom-black dark:text-custom-black-dark font-medium">
                    {t("loading_images")}
                  </p>
                </div>
              </div>
            )}

            {/* 免費版限制提示 */}
            {!isPremium && publishedImages.length > 0 && (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <svg
                    className="w-5 h-5 text-amber-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                    />
                  </svg>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    {t("free_version_limited")}
                  </p>
                </div>
              </div>
            )}

            {/* 無限滾動觸發器 */}
            {hasMore && <div ref={observerTarget} style={{ height: "20px" }} />}
          </div>
        )}

        {/* 非付費用戶的漸變遮罩和升級提示 */}
        {!isPremium && publishedImages.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 pointer-events-none">
            {/* 漸變背景 */}
            <div className="h-48 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-gray-900 dark:via-gray-900/90"></div>

            {/* 底部升級提示 */}
            <div className="h-40 bg-white dark:bg-gray-900 flex items-center justify-center">
              <div className="text-center max-w-md w-full px-6">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {t("unlock_title")}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                  {t("unlock_content")}
                </p>
                <button
                  onClick={handleUpgradeToPremium}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 pointer-events-auto"
                >
                  {t("upgrade_now")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 分享下拉選單 */}
        <AnimatePresence>
          {Object.entries(shareDropdowns).map(([imageId, isOpen]) => {
            if (!isOpen) return null;

            // 找到對應的圖片和群組
            let targetImage: ImageData | null = null;
            let targetPrompt = "";
            let targetGroup: ImageGroup | undefined = undefined;

            for (const group of publishedImages) {
              const foundImage = group.images.find(
                (img) =>
                  img.id === imageId ||
                  img.id === imageId.replace("-mobile", "")
              );
              if (foundImage) {
                targetImage = foundImage;
                targetPrompt = group.prompt;
                targetGroup = group;
                break;
              }
            }

            if (!targetImage) return null;

            return (
              <ShareDropdown
                key={imageId}
                isOpen={isOpen}
                onClose={() => closeShareDropdown(imageId)}
                shareData={getShareData(targetImage, targetPrompt, targetGroup)}
                buttonRef={shareButtonRefs.current[imageId]}
                onShareComplete={(platform) =>
                  handleShareComplete(targetImage!.id, platform)
                }
              />
            );
          })}
        </AnimatePresence>

        {isImageViewerOpen && selectedImage.images.length > 0 && (
          <ImageModal
            imageRef={
              selectedImage.images[selectedImageIndex]
                ? {
                    image: {
                      url: selectedImage.images[selectedImageIndex].url,
                      publishedImageId: selectedImage.images[selectedImageIndex].id,
                      userReaction: {
                        like: selectedImage.images[selectedImageIndex].userReaction.like,
                        dislike: selectedImage.images[selectedImageIndex].userReaction.dislike,
                        collecting: !!selectedImage.images[selectedImageIndex].userReaction.collecting,
                        comment: selectedImage.images[selectedImageIndex].userReaction.comment,
                      },
                      reactions: {
                        likes: selectedImage.images[selectedImageIndex].reactions.likes,
                        dislikes: selectedImage.images[selectedImageIndex].reactions.dislikes,
                      },
                    },
                    groupPrompt: selectedImage.prompt,
                    model: {
                      title: selectedImage.loraModelName,
                    },
                  }
                : null
            }
            onClose={() => setIsImageViewerOpen(false)}
            onPrevious={() =>
              setSelectedImageIndex((prev) => Math.max(0, prev - 1))
            }
            onNext={() =>
              setSelectedImageIndex((prev) =>
                Math.min(selectedImage.images.length - 1, prev + 1)
              )
            }
            showPrevious={selectedImageIndex > 0}
            showNext={selectedImageIndex < selectedImage.images.length - 1}
            handleReaction={(imageId: string, type: string) => {
              if (type === "like" || type === "dislike") {
                handleReaction(imageId, type);
              }
            }}
            handleCollectReaction={(imageId: string) => {
              handleCollectReaction(imageId);
            }}
          />
        )}

        {/* 評論對話框 */}
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
    </div>
  );
};

export default PublishedImages;
