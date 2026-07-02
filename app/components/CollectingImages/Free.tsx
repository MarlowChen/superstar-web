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

// 分享按鈕組件
const ShareButton = React.forwardRef<
  HTMLButtonElement,
  {
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    isActive: boolean;
    className?: string;
    isMobile?: boolean;
    title: string;
  }
>(({ onClick, isActive, className, isMobile = false, title }, ref) => (
  <button
    ref={ref}
    onClick={onClick}
    className={`
      ${
        isMobile
          ? "p-2 rounded-full backdrop-blur-sm transition-all duration-200 active:scale-95"
          : "p-2 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 shadow-lg"
      } 
      ${
        isActive
          ? "bg-emerald-500/90 text-white shadow-lg"
          : "bg-black/50 text-white hover:bg-black/70"
      } ${className || ""}`}
    title={title}
  >
    <Share2 className="w-4 h-4" />
  </button>
));

ShareButton.displayName = "ShareButton";

const CollectedImages: React.FC<CollectedImagesProps> = ({ type = "user" }) => {
  const lng = useLocale();
  const t = useTranslations("collecting");
  const [collectedImages, setCollectedImages] = useState<CollectedImageData[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const isFirstRender = useRef(true);

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

  // 假設這是從環境變數或全局狀態獲取的付費狀態
  const isPremium = false; // 示例：設為false表示未付費

  // 處理升級到付費版的函數
  const handleUpgradeToPremium = () => {
    // 觸發自定義事件來開啟升級對話框
    window.dispatchEvent(new CustomEvent('openPaymentDialog'));
  };

  // 獲取或創建分享按鈕的 ref
  const getShareButtonRef = (imageId: string) => {
    if (!shareButtonRefs.current[imageId]) {
      shareButtonRefs.current[imageId] = React.createRef<HTMLButtonElement>();
    }
    return shareButtonRefs.current[imageId];
  };

  // 處理分享下拉選單開關
  const toggleShareDropdown = (imageId: string) => {
    if (!isPremium) return;
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
      if (!isPremium) return;

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
    [collectedImages, toggleReactionComment, t, isPremium]
  );

  // 下載單張圖片
  const downloadImage = async (imageData: CollectedImageData) => {
    if (!isPremium) return;

    try {
      const fileName = getDownloadFileName(
        imageData.task.loraModelTitle,
        imageData.publishedImage.id || imageData.id
      );
      
      // 使用改進的下載函數，iOS Safari 將顯示分享面板讓用戶保存到相簿
      const { downloadImage: downloadImageHelper } = await import('@/utils/downloadHelper');
      const result = await downloadImageHelper(imageData.publishedImage.url, fileName);
      
      if (result.success) {
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
    if (!isPremium) return;

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
    if (!isPremium) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/image/${imageData.publishedImage.id}/reaction`,
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
  const fetchCollectedImages = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      const limit = isPremium ? 20 : 6; // 免費版只載入少量數據
      const endpoint =
        type === "user"
          ? `collected-images/user/1/${limit}`
          : `collected-images/all/1/${limit}`;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/${endpoint}`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("Failed to fetch collected images");
      const data: PaginatedCollectedImages = await response.json();

      setCollectedImages(data.images);
    } catch (error) {
      console.error("Failed to fetch collected images:", error);
      showToast(t("fetch_collected_failed"), true);
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchCollectedImages();
    }
  }, [fetchCollectedImages]);

  const openImageViewer = (index: number) => {
    if (!isPremium) return;

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
      {collectedImages.length === 0 && !loading ? (
        <EmptyState />
      ) : (
        <>
          {/* 收藏圖片網格 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {collectedImages.map((imageData, index) => (
              <div
                key={imageData.id}
                className="transition-all duration-300 relative group"
              >
                {/* 卡片容器 */}
                <div className="bg-custom-white dark:bg-custom-white-dark rounded-xl overflow-hidden shadow-lg border border-custom-light-purple dark:border-custom-light-purple-dark hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  {/* 圖片區域 */}
                  <div
                    className="aspect-square relative overflow-hidden cursor-pointer"
                    onClick={() => openImageViewer(index)}
                  >
                    <Image
                      src={imageData.publishedImage.url}
                      alt={`Collected image`}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />

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
                      <div className="flex items-center gap-2 bg-pink-500/90 text-white px-3 py-1.5 rounded-full backdrop-blur-sm shadow-lg">
                        <Heart className="w-3 h-3 fill-current" />
                        <span className="text-xs font-medium">
                          {t("collected")}
                        </span>
                      </div>
                    </div>

                    {/* 用戶標籤（僅全域收藏顯示） - 右上角 */}
                    {type === "all" && imageData.user && (
                      <div className="absolute top-3 right-3">
                        <div className="flex items-center gap-1 bg-custom-logo-purple/90 dark:bg-custom-logo-purple-dark/90 text-white px-3 py-1.5 rounded-full backdrop-blur-sm shadow-lg">
                          <User className="w-3 h-3" />
                          <span className="text-xs font-medium">
                            @{imageData.user.username}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 懸停操作按鈕 - 僅桌面版 */}
                    <div className="absolute bottom-3 right-3 hidden md:flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {/* 複製按鈕 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(imageData.task.prompt);
                        }}
                        className="p-2 bg-black/50 text-white hover:bg-black/70 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 shadow-lg"
                        title={t("copy_prompt")}
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      {/* 下載按鈕 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadImage(imageData);
                        }}
                        className="p-2 bg-black/50 text-white hover:bg-black/70 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 shadow-lg"
                        title={t("download_image")}
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* 留言按鈕 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isPremium) {
                            setShowComment({
                              imageId: imageData.publishedImage.id,
                              comment:
                                imageData.publishedImage.userReaction.comment ||
                                "",
                            });
                            setCommentDialogOpen(true);
                          }
                        }}
                        className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 shadow-lg ${
                          imageData.publishedImage.userReaction.comment
                            ? "bg-emerald-500/90 text-white"
                            : "bg-black/50 text-white hover:bg-black/70"
                        }`}
                        title={t("comment")}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>

                      {/* 分享按鈕 */}
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
                        title={t("share_image")}
                      />

                      {/* 取消收藏按鈕 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUncollect(imageData);
                        }}
                        className="p-2 bg-red-500/90 text-white hover:bg-red-600/90 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 shadow-lg"
                        title={t("uncollect")}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 移動版底部覆蓋層 */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 md:hidden">
                      <div className="flex items-center justify-between">
                        {/* 左側：複製 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(imageData.task.prompt);
                          }}
                          className="flex items-center space-x-2 px-3 py-2 bg-black/50 text-white rounded-full backdrop-blur-sm transition-all duration-200 active:scale-95"
                        >
                          <Copy className="w-4 h-4" />
                          <span className="text-sm">{t("copy")}</span>
                        </button>

                        {/* 右側操作 */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadImage(imageData);
                            }}
                            className="p-2 bg-black/50 text-white rounded-full backdrop-blur-sm transition-all duration-200 active:scale-95"
                            title={t("download_image")}
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* 移動版留言按鈕 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isPremium) {
                                setShowComment({
                                  imageId: imageData.publishedImage.id,
                                  comment:
                                    imageData.publishedImage.userReaction
                                      .comment || "",
                                });
                                setCommentDialogOpen(true);
                              }
                            }}
                            className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 active:scale-95 ${
                              imageData.publishedImage.userReaction.comment
                                ? "bg-emerald-500/90 text-white"
                                : "bg-black/50 text-white"
                            }`}
                            title={t("comment")}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>

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
                            title={t("share_image")}
                          />

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUncollect(imageData);
                            }}
                            className="p-2 bg-red-500/90 text-white rounded-full backdrop-blur-sm transition-all duration-200 active:scale-95"
                            title={t("uncollect")}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 信息區域 */}
                  <div className="p-4 bg-custom-gray dark:bg-custom-gray-dark">
                    {/* Prompt 顯示 */}
                    <div className="mb-3">
                      <p className="text-custom-black dark:text-custom-black-dark text-sm leading-relaxed line-clamp-2 min-h-[2.5rem]">
                        {imageData.task.prompt}
                      </p>
                    </div>

                    {/* 模型信息 */}
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-custom-light-purple/30 dark:border-custom-light-purple-dark/30">
                      <div className="w-2 h-2 bg-custom-logo-purple dark:bg-custom-logo-purple-dark rounded-full"></div>
                      <span className="text-custom-logo-purple dark:text-custom-logo-purple-dark text-sm font-medium truncate">
                        {imageData.task.loraModelTitle}
                      </span>
                    </div>

                    {/* 底部信息 */}
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      {/* 收藏時間 */}
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(imageData.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                    </div> 
                  </div>
                </div>
              </div>
            ))}
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
  );
};

export default CollectedImages;
