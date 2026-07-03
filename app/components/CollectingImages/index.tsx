"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { showToast } from "../CustomToast";
import ImageZoomViewer from "../ImageZoomViewer";
import CommentDialog from "../CommentDialog";
import useReactions from "../EnhancedImageDisplay/useReactions";
import { useLocale, useTranslations } from "next-intl";
import {
  Heart,
  Copy,
  Download,
  X,
  User,
  Clock,
  Share2,
  MessageCircle,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ShareDropdown } from "./ShareDropdown";
import { getDownloadFileName } from "@/utils/getDownloadFileName";
import { useScroll } from "@/app/context/ScrollContext";

interface CollectedImageData {
  id: string;
  publishedImage: {
    id: string;
    url: string;
    reactions: {
      likes: number;
      dislikes: number;
    };
    userReaction: {
      like: boolean;
      dislike: boolean;
      collecting: boolean;
      comment?: string;
    };
  };
  task: {
    id: string;
    prompt: string;
    loraModel: string;
    loraModelTitle: string;
  };
  user?: {
    id: string;
    username: string;
    name?: string;
    email?: string;
  };
  createdAt: string;
}

interface CommentReaction {
  comment?: string;
  imageId: string;
}

interface PaginatedCollectedImages {
  images: CollectedImageData[];
  totalPages: number;
  currentPage: number;
  totalCount: number;
}

interface CollectedImagesProps {
  type?: "user" | "all";
}

const pickString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

const readMediaUrl = (value: unknown) => {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;

  return pickString(
    record.url,
    record.imageUrl,
    record.videoUrl,
    record.audioUrl,
    record.fileUrl,
    record.resultUrl,
    record.s3_url,
    record.s3Url,
    record.src,
    record.filename
  );
};

const normalizeCollectedMediaUrl = (publishedImage?: unknown) => {
  if (!publishedImage || typeof publishedImage !== "object") return "";
  const image = publishedImage as Record<string, unknown>;

  return pickString(
    image.url,
    image.imageUrl,
    image.videoUrl,
    image.audioUrl,
    image.fileUrl,
    image.resultUrl,
    image.s3_url,
    image.s3Url,
    image.src,
    readMediaUrl(image.media),
    readMediaUrl(image.image),
    readMediaUrl(image.video),
    readMediaUrl(image.audio),
    readMediaUrl(image.file)
  );
};

const normalizeCollectedImageItem = (
  item: CollectedImageData
): CollectedImageData => ({
  ...item,
  publishedImage: {
    ...item.publishedImage,
    url: normalizeCollectedMediaUrl(item.publishedImage) || item.publishedImage.url || "",
  },
});

const isVideoUrl = (url?: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || "");
const isAudioUrl = (url?: string) => /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(url || "");

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
      ${
        isMobile
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

const CollectedImages: React.FC<CollectedImagesProps> = ({ type = "user" }) => {
  const lng = useLocale();
  const t = useTranslations("collecting");
  const [collectedImages, setCollectedImages] = useState<CollectedImageData[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement | null>(null);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const isFirstRender = useRef(true);
  const { setScrollY } = useScroll();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCopy = {
    label: lng === "zh-TW" ? "Saved" : lng === "ja" ? "Saved" : "Saved",
    title: lng === "zh-TW" ? "我的典藏" : lng === "ja" ? "保存済み" : "Saved",
    subtitle:
      lng === "zh-TW"
        ? "收藏喜歡的生成結果，方便之後回看提示詞、下載或延伸創作。"
        : lng === "ja"
          ? "気に入った生成結果を保存し、あとでプロンプト確認やダウンロードに使えます。"
          : "Keep favorite generations here so you can revisit prompts, download, or build on them.",
    countLabel:
      lng === "zh-TW"
        ? "個收藏"
        : lng === "ja"
          ? "件の保存"
          : "saved",
  };

  const handleScroll = () => {
    const container = containerRef.current;
    if (container) {
      // 更新全局滾動狀態
      setScrollY(container.scrollTop);
    }
  };

  // 留言相關狀態
  const [openCommentDialog, setCommentDialogOpen] = useState<boolean>(false);
  const [showComment, setShowComment] = useState<CommentReaction>({
    imageId: "",
    comment: "",
  });
  const { toggleReactionComment } = useReactions();

  // 分享相關狀態
  const [shareDropdowns, setShareDropdowns] = useState<Record<string, boolean>>(
    {}
  );
  const [sharedImages, setSharedImages] = useState<Record<string, boolean>>({});
  const shareButtonRefs = useRef<
    Record<string, React.RefObject<HTMLButtonElement>>
  >({});

  // 判斷是否為付費用戶
  const isPremium = true;

  // 🔥 除錯資訊
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
  const getShareData = (imageData: CollectedImageData) => ({
    url: `${process.env.NEXT_PUBLIC_URL}/${lng}/details/${imageData.publishedImage.id}`,
    title: t("share_collected_image_title"),
    description: imageData.task.prompt || t("share_collected_image_description"),
    hashtag: "#AIArt #CollectedImage #GeneratedImage",
    imageUrl: imageData.publishedImage.url,
    modelName: imageData.task.loraModelTitle,
    imageId: imageData.publishedImage.id || imageData.id,
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

  // 處理留言提交
  const submitReactionComment = useCallback(
    async (commentData: CommentReaction) => {
      const { imageId, comment } = commentData;

      // 找到對應的圖片在列表中的位置
      const imageIndex = collectedImages.findIndex(
        (img) => img.publishedImage.id === imageId
      );

      if (imageIndex === -1) return;

      // 更新本地狀態
      const updatedImages = [...collectedImages];
      updatedImages[imageIndex] = {
        ...updatedImages[imageIndex],
        publishedImage: {
          ...updatedImages[imageIndex].publishedImage,
          userReaction: {
            ...updatedImages[imageIndex].publishedImage.userReaction,
            comment: comment,
          },
        },
      };

      setCollectedImages(updatedImages);

      // 調用 API 更新留言
      try {
        await toggleReactionComment(imageId, comment || "", 1, 20, "desc");
        showToast(
          comment
            ? t("comment_updated")
            : t("comment_removed")
        );
      } catch (error) {
        console.error("Comment update failed:", error);
        showToast(t("comment_failed"), true);
        // 如果 API 調用失敗，恢復原狀態
        setCollectedImages(collectedImages);
      }

      setCommentDialogOpen(false);
    },
    [collectedImages, toggleReactionComment, t]
  );

  // 下載單張圖片
  const downloadImage = async (imageData: CollectedImageData) => {
    try {
      const fileName = getDownloadFileName(
        imageData.task.loraModelTitle,
        imageData.publishedImage.id || imageData.id
      );
      
      // 使用改進的下載函數，iOS Safari 將顯示分享面板讓用戶保存到相簿
      const { downloadImage: downloadImageHelper } = await import('@/utils/downloadHelper');
      const result = await downloadImageHelper(imageData.publishedImage.url, fileName);
      
      if (result.success) {
        // iOS 使用分享方式時，提示用戶選擇「儲存圖片」
        if (result.method === 'share') {
          showToast(t("image_share_hint"));
        } else {
          showToast(t("image_downloaded_success"));
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error("Download failed:", error);
      showToast(t("image_download_failed"), true);
    }
  };

  // 複製文字
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("copied_success"));
    } catch (error) {
      console.error("Copy failed:", error);
      showToast(t("copy_failed"), true);
    }
  };

  // 取消收藏
  const handleUncollect = async (imageData: CollectedImageData) => {
    try {
      const response = await fetch(
        `/api/image-reaction/${encodeURIComponent(imageData.publishedImage.id)}`,
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

      if (!response.ok) throw new Error("Failed to uncollect image");

      // 從列表中移除該圖片
      setCollectedImages((prev) =>
        prev.filter((img) => img.id !== imageData.id)
      );

    } catch (error) {
      console.error("Uncollect failed:", error);
    }
  };

  // 獲取收藏圖片
  const fetchCollectedImages = useCallback(async (pageNum: number) => {
    if (loading) return;
    setLoading(true);

    try {
      const limit = isPremium ? 20 : 6; // 免費版只載入少量數據
      const endpoint =
        type === "user"
          ? `collected-images/user/${pageNum}/${limit}`
          : `collected-images/all/${pageNum}/${limit}`;

      const response = await fetch(
        `/api/${endpoint}`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("Failed to fetch collected images");
      const data: PaginatedCollectedImages = await response.json();

      const normalizedImages = Array.isArray(data.images)
        ? data.images.map(normalizeCollectedImageItem)
        : [];

      if (pageNum === 1) {
        setCollectedImages(normalizedImages);
      } else {
        setCollectedImages((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const newItems = normalizedImages.filter(
            (item) => !existingIds.has(item.id)
          );
          return [...prev, ...newItems];
        });
      }

      // 免費版限制分頁
      setHasMore(isPremium ? pageNum < data.totalPages : false);
    } catch (error) {
      console.error("Failed to fetch collected images:", error);
      showToast(t("fetch_collected_failed"), true);
    } finally {
      setLoading(false);
    }
  }, [isPremium, loading, t, type]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchCollectedImages(page);
    }
  }, [fetchCollectedImages, page]);

  useEffect(() => {
    if (!isFirstRender.current && page > 1 && isPremium) {
      fetchCollectedImages(page);
    }
  }, [fetchCollectedImages, page, isPremium]);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading && isPremium) {
        setPage((prev) => prev + 1);
      }
    },
    [hasMore, loading, isPremium]
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

  const openImageViewer = (index: number) => {
    if (!isPremium) {
      showPremiumToast();
      return;
    }

    setSelectedImageIndex(index);
    setIsImageViewerOpen(true);
  };

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
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-custom-black dark:text-custom-black-dark mb-2">
        {t("no_collected_images")}
      </h3>
      <p className="text-gray-500 dark:text-gray-400">
        {t("start_collecting_hint")}
      </p>
    </div>
  );

  return (
    <div
      className="content-scrollbar min-h-screen overflow-y-auto bg-custom-gray px-4 pb-[9rem] pt-20 dark:bg-[#120f16] md:pt-8"
      ref={containerRef}
      onScroll={handleScroll}
    >
      <div className="relative mx-auto max-w-6xl px-2 py-6 sm:px-4 lg:px-6">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b7fa5] dark:text-[#887c9a]">
              {pageCopy.label}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#2f2740] dark:text-[#f3effb]">
              {pageCopy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6383] dark:text-[#b9aec8]">
              {pageCopy.subtitle}
            </p>
          </div>
          <div className="inline-flex w-fit rounded-full border border-[#e6dff0] bg-white/70 px-3 py-1.5 text-xs font-medium text-[#6f6383] shadow-sm dark:border-white/10 dark:bg-white/[0.05] dark:text-[#cfc4df]">
            {collectedImages.length} {pageCopy.countLabel}
          </div>
        </div>
        {collectedImages.length === 0 && !loading ? (
          <EmptyState />
        ) : (
          <>
            {/* 收藏圖片網格 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {collectedImages.map((imageData, index) => {
                const mediaUrl = imageData.publishedImage.url;
                const isVideo = isVideoUrl(mediaUrl);
                const isAudio = isAudioUrl(mediaUrl);

                return (
                <div
                  key={imageData.id}
                  className="transition-all duration-300 relative group"
                >
                  {/* 卡片容器 */}
                  <div className="overflow-hidden rounded-[26px] bg-white/78 shadow-[0_10px_30px_rgba(46,30,78,0.08)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(46,30,78,0.12)] dark:bg-white/[0.03] dark:shadow-[0_14px_40px_rgba(0,0,0,0.18)]">
                    {/* 圖片區域 */}
                    <div
                      className="aspect-square relative overflow-hidden cursor-pointer"
                      onClick={() => openImageViewer(index)}
                    >
                      {isVideo ? (
                        <video
                          src={mediaUrl}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          muted
                          playsInline
                          autoPlay
                          loop
                        />
                      ) : isAudio ? (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#f8eefc] to-[#e6f4ff] text-sm font-semibold text-[#5e4d85] dark:from-[#211829] dark:to-[#122233] dark:text-[#e6dfff]">
                          Audio
                        </div>
                      ) : (
                        <Image
                          src={mediaUrl}
                          alt={`Collected image`}
                          fill
                          sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                          priority={index < 2}
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

                      {/* 收藏標記 - 左上角 */}
                      <div className="absolute top-3 left-3">
                        <div className="flex items-center gap-1.5 rounded-full bg-pink-500/85 px-2.5 py-1 text-white backdrop-blur-sm">
                          <Heart className="w-3 h-3 fill-current" />
                          <span className="text-xs font-medium">
                            {t("collected")}
                          </span>
                        </div>
                      </div>

                      {/* 用戶標籤（僅全域收藏顯示） - 右上角 */}
                      {type === "all" && imageData.user && (
                        <div className="absolute top-3 right-3">
                          <div className="flex items-center gap-1 rounded-full bg-[#6d5bd0]/85 px-2.5 py-1 text-white backdrop-blur-sm">
                            <User className="w-3 h-3" />
                            <span className="text-xs font-medium">
                              {imageData.user.name || imageData.user.email?.split("@")[0] || imageData.user.username}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="absolute top-3 right-3 hidden md:flex flex-col space-y-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <ShareButton
                          ref={getShareButtonRef(imageData.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleShareDropdown(imageData.id);
                          }}
                          isActive={
                            shareDropdowns[imageData.id] ||
                            sharedImages[imageData.id]
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
                              copyToClipboard(imageData.task.prompt);
                            }}
                            disabled={!isPremium}
                            className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 ${
                              !isPremium
                                ? "text-white/35 cursor-not-allowed"
                                : "text-white/60 hover:bg-white/8 hover:text-white"
                            }`}
                            title={t("copy_prompt")}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>{t("copy")}</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadImage(imageData);
                            }}
                            disabled={!isPremium}
                            className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 ${
                              !isPremium
                                ? "text-white/35 cursor-not-allowed"
                                : "text-white/60 hover:bg-white/8 hover:text-white"
                            }`}
                            title={t("download_image")}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isPremium) {
                                setShowComment({
                                  imageId: imageData.publishedImage.id,
                                  comment:
                                    imageData.publishedImage.userReaction.comment || "",
                                });
                                setCommentDialogOpen(true);
                              } else {
                                showPremiumToast();
                              }
                            }}
                            disabled={!isPremium}
                            className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 ${
                              !isPremium
                                ? "text-white/35 cursor-not-allowed"
                                : imageData.publishedImage.userReaction.comment
                                  ? "bg-white/10 text-emerald-300"
                                  : "text-white/60 hover:bg-white/8 hover:text-white"
                            }`}
                            title={t("comment")}
                          >
                            <MessageCircle
                              className={`h-3.5 w-3.5 ${
                                imageData.publishedImage.userReaction.comment ? "fill-current" : ""
                              }`}
                            />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUncollect(imageData);
                            }}
                            disabled={!isPremium}
                            className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 ${
                              !isPremium
                                ? "text-white/35 cursor-not-allowed"
                                : "text-red-200 hover:bg-white/8 hover:text-white"
                            }`}
                            title={t("uncollect")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>

                          <div className="md:hidden">
                            <ShareButton
                              ref={getShareButtonRef(`${imageData.id}-mobile`)}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleShareDropdown(`${imageData.id}-mobile`);
                              }}
                              isActive={
                                shareDropdowns[`${imageData.id}-mobile`] ||
                                sharedImages[imageData.id]
                              }
                              isMobile={true}
                              disabled={!isPremium}
                              title={t("share_image")}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 信息區域 */}
                    <div className="p-4">
                      {/* Prompt 顯示 */}
                      <div className="mb-3">
                        <p className="line-clamp-2 min-h-[2.5rem] text-sm leading-7 text-[#2f2740] dark:text-[#f3effb]">
                          &quot;{imageData.task.prompt}&quot;
                        </p>
                      </div>

                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#efe9f8] px-2.5 py-1 text-[11px] font-medium text-[#5e4d85] dark:bg-white/[0.05] dark:text-[#d4cde4]">
                          {imageData.task.loraModelTitle}
                        </span>
                        <span className="text-[11px] text-[#8b7fa5] dark:text-[#887c9a]">
                          {new Date(imageData.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-[#8b7fa5] dark:text-[#887c9a]">
                        <Clock className="h-3 w-3" />
                        <span>{t("collected")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>

            {/* 載入指示器 */}
            {loading && (
              <div className="text-center py-12">
                <div className="inline-flex items-center gap-3 px-6 py-4 bg-custom-white dark:bg-custom-white-dark rounded-xl shadow-lg border border-custom-light-purple dark:border-custom-light-purple-dark">
                  <div className="w-6 h-6 border-2 border-custom-logo-purple/20 border-t-custom-logo-purple dark:border-t-custom-logo-purple-dark rounded-full animate-spin"></div>
                  <p className="text-custom-black dark:text-custom-black-dark font-medium">
                    {t("loading_collections")}
                  </p>
                </div>
              </div>
            )}

            {/* 免費版分頁提示 */}
            {!isPremium && collectedImages.length > 0 && (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-xl border border-pink-200 dark:border-pink-800">
                  <Heart className="w-5 h-5 text-pink-500" />
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    {t("free_version_limited")}
                  </p>
                </div>
              </div>
            )}

            {hasMore && isPremium && (
              <div ref={observerTarget} style={{ height: "20px" }} />
            )}
          </>
        )}

        {/* 非付費用戶的漸變遮罩和升級提示 */}
        {!isPremium && collectedImages.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 pointer-events-none">
            {/* 漸變背景 */}
            <div className="h-48 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-gray-900 dark:via-gray-900/90"></div>

            {/* 底部升級提示 */}
            <div className="h-40 bg-white dark:bg-gray-900 flex items-center justify-center">
              <div className="text-center max-w-md w-full px-6">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <Heart className="w-8 h-8 text-white fill-current" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {t("unlock_title")}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                  {t("unlock_content")}
                </p>
                <button
                  onClick={handleUpgradeToPremium}
                  className="px-8 py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 pointer-events-auto"
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

            // 找到對應的圖片
            const cleanImageId = imageId
              .replace("-mobile", "")
              .replace("-bottom", "");
            const targetImage = collectedImages.find(
              (img) => img.id === cleanImageId
            );

            if (!targetImage) return null;

            return (
              <ShareDropdown
                key={imageId}
                isOpen={isOpen}
                onClose={() => closeShareDropdown(imageId)}
                shareData={getShareData(targetImage)}
                buttonRef={shareButtonRefs.current[imageId]}
                onShareComplete={(platform) =>
                  handleShareComplete(targetImage.id, platform)
                }
              />
            );
          })}
        </AnimatePresence>

        {/* 圖片檢視器 */}
        {isImageViewerOpen && collectedImages.length > 0 && (
          <ImageZoomViewer
            modelName={
              collectedImages[selectedImageIndex]?.task.loraModelTitle || ""
            }
            prompt={collectedImages[selectedImageIndex]?.task.prompt || ""}
            images={collectedImages.map((img) => ({
              id: img.publishedImage.id,
              url: img.publishedImage.url,
              prompt: img.task.prompt,
              modelName: img.task.loraModelTitle,
              reactions: img.publishedImage.reactions,
              userReaction: img.publishedImage.userReaction,
            }))}
            initialIndex={selectedImageIndex}
            onClose={() => setIsImageViewerOpen(false)}
            onComment={(imageId: string) => {
              // 找到對應的圖片數據
              const imageData = collectedImages.find(
                (img) => img.publishedImage.id === imageId
              );
              if (imageData) {
                setShowComment({
                  imageId: imageId,
                  comment: imageData.publishedImage.userReaction.comment || "",
                });
                setCommentDialogOpen(true);
              }
            }}
            handleReaction={(imageId: string, type: string) => {
              if (type === "collecting") {
                const imageData = collectedImages.find(
                  (img) => img.publishedImage.id === imageId
                );
                if (imageData) {
                  handleUncollect(imageData);
                  setIsImageViewerOpen(false);
                }
              }
            }}
            handleCollectReaction={(imageId: string) => {
              const imageData = collectedImages.find(
                (img) => img.publishedImage.id === imageId
              );
              if (imageData) {
                handleUncollect(imageData);
                setIsImageViewerOpen(false);
              }
            }}
            showEditButton={false} // 收藏頁面隱藏編輯按鈕
          />
        )}

        {/* 留言對話框 */}
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
      </div>
    </div>
  );
};

export default CollectedImages;
