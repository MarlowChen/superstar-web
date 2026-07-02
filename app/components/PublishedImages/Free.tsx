"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { ShareIcon } from "@/app/icon/ShareIcon";
import { showToast } from "../CustomToast";
import useReactions from "../EnhancedImageDisplay/useReactions";
// import CommentDialog from "../CommentDialog";
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
import JSZip from "jszip";
import { OriginalImageModal } from "../Drawing/OriginalImageModal";
import ImageModal from "../Drawing/ImageModal";

const isVideoUrl = (url?: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || "");
const isAudioUrl = (url?: string) => /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(url || "");
// interface CommentReaction {
//   comment?: string;
//   imageId: string;
// }

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
  userMessage?: string;
  images: ImageData[];
  uploadedImages?: ImageData[]; // 🖼️ 新增：原始上傳圖片
}

// 簡化的分享按鈕組件
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

const PublishedImages: React.FC = () => {
  const lng = useLocale();
  const t = useTranslations("modelview");
  const [publishedImages, setPublishedImages] = useState<ImageGroup[]>([]);
  const [loading, setLoading] = useState(false);
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
  const { toggleReaction } = useReactions();
  // const [openCommentDialog, setCommentDialogOpen] = useState<boolean>(false);
  // const [showComment, setShowComment] = useState<CommentReaction>({
  //   imageId: "",
  //   comment: "",
  // });
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
    if (!isPremium) return;
    
    try {
      const zip = new JSZip();
      const seen = new Set();
      const images = group.images
      const imagePromises = images.map(async (image) => {
        if (seen.has(image.id)) return; // 避免同一批次重複
        seen.add(image.id);
        const response = await fetch(image.url, { mode: "cors" });
        if (!response.ok) throw new Error("Failed to fetch image");
        const blob = await response.blob();
        const fileName = getDownloadFileName(group.loraModelName, image.id);
        zip.file(fileName, blob);
      });
      await Promise.all(imagePromises);

      const content = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `psf-${group.loraModelName}-${group.taskId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
      showToast(t("images_download_failed"), true);
    }
  }

  // 複製文字的函數
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

  const fetchPublishedImages = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const limit = isPremium ? 10 : 3; // 免費版只載入少量數據
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/user/images/1/${limit}`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("Failed to fetch images");
      const data = await response.json();

      const resultData = data.groups.map((item: ImageGroup) => {
        return {
          taskId: item.taskId,
          page: 1,
          limit: limit,
          sort: "desc",
          prompt: item.userMessage || item.prompt || "",
          loraModelName: item.loraModelName || "",
          images: item.images || [],
          uploadedImages: item.uploadedImages || [], // 🖼️ 新增：處理原始上傳圖片
        };
      });

      setPublishedImages(resultData);
    } catch (error) {
      console.error("Failed to fetch images:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchPublishedImages();
    }
  }, []);

  const openSelectImageDialog = (
    selectIndex: number,
    imageGroup: ImageGroup
  ) => {
    if (!isPremium) return;
    
    setSelectedImage(imageGroup);
    setIsImageViewerOpen(true);
    setSelectedImageIndex(selectIndex);
  };

  // 修復後的 handleReaction 函數
  const handleReaction = useCallback(
    async (imageId: string, reactionType: "like" | "dislike") => {
      if (!isPremium) return;
      
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
    [toggleReaction, publishedImages, selectedImage, isPremium]
  );

  // 處理收藏反應
  const handleCollectReaction = useCallback(
    async (imageId: string) => {
      if (!isPremium) return;
      
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
    [publishedImages, selectedImage, t, isPremium]
  );

  // 處理評論反應
  // const submitReactionComment = useCallback(
  //   async (commentData: CommentReaction) => {
  //     if (!isPremium) return;
      
  //     const { imageId, comment } = commentData;

  //     const groupIndex = publishedImages.findIndex((group) =>
  //       group.images.some((image) => image.id === imageId)
  //     );

  //     if (groupIndex === -1) return;

  //     const imageIndex = publishedImages[groupIndex].images.findIndex(
  //       (image) => image.id === imageId
  //     );

  //     if (imageIndex === -1) return;

  //     const updatedMessages = [...publishedImages];

  //     updatedMessages[groupIndex].images[imageIndex] = {
  //       ...updatedMessages[groupIndex].images[imageIndex],
  //       userReaction: {
  //         ...updatedMessages[groupIndex].images[imageIndex].userReaction,
  //         comment: comment,
  //       },
  //     };

  //     if (selectedImage.taskId === updatedMessages[groupIndex].taskId) {
  //       const selectedImageIndex = selectedImage.images.findIndex(
  //         (img) => img.id === imageId
  //       );

  //       if (selectedImageIndex !== -1) {
  //         const updatedSelectedImages = [...selectedImage.images];
  //         updatedSelectedImages[selectedImageIndex] =
  //           updatedMessages[groupIndex].images[imageIndex];

  //         setSelectedImage({
  //           ...selectedImage,
  //           images: updatedSelectedImages,
  //         });
  //       }
  //     }

  //     setPublishedImages(updatedMessages);

  //     const imageGroup = updatedMessages[groupIndex];
  //     await toggleReactionComment(
  //       imageId,
  //       comment || "",
  //       imageGroup.page,
  //       imageGroup.limit,
  //       imageGroup.sort
  //     );

  //     setCommentDialogOpen(false);
  //   },
  //   [toggleReactionComment, publishedImages, selectedImage, isPremium]
  // );

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
      {publishedImages.length === 0 && !loading ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {publishedImages.map((group) => (
            <div
              key={group.taskId}
              className="bg-custom-white dark:bg-custom-white-dark rounded-2xl shadow-lg border border-custom-light-purple dark:border-custom-light-purple-dark hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              {/* 標題區域 */}
              <div className="p-6 border-b border-custom-light-purple dark:border-custom-light-purple-dark">
                <div className="flex items-start justify-between gap-4">
                  {/* Prompt 區域 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-2 h-2 bg-custom-logo-purple dark:bg-custom-logo-purple-dark rounded-full"></div>
                      <span className="text-sm text-custom-logo-purple dark:text-custom-logo-purple-dark">
                        {t("creation_prompt")}
                      </span>
                    </div>
                    <p className="text-custom-black dark:text-custom-black-dark leading-relaxed text-lg font-medium">
                      {group.prompt}
                    </p>
                  </div>

                  {/* 右側區域：操作按鈕 + 原圖 */}
                  <div className="flex flex-col gap-2 items-end">
                    {/* 操作按鈕區域 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        className="p-2 text-gray-500 hover:text-custom-logo-purple dark:hover:text-custom-logo-purple-dark hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark rounded-lg transition-all duration-200"
                        onClick={() => copyToClipboard(group.prompt)}
                        title={t("copy_prompt")}
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                      <button
                        className="p-2 text-gray-500 hover:text-custom-logo-purple dark:hover:text-custom-logo-purple-dark hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark rounded-lg transition-all duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          safeDownloadImagesZip(group);
                        }}
                        title={t("download_all")}
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {/* 🖼️ 原圖顯示在按鈕下方 */}
                    {group.uploadedImages && group.uploadedImages.length > 0 && (
                      <button
                        onClick={() => handleOriginalImageClick(group.uploadedImages![0].url)}
                        className="group relative overflow-hidden rounded-lg border-2 border-custom-light-purple 
                                 dark:border-custom-light-purple-dark hover:border-custom-logo-purple 
                                 dark:hover:border-custom-logo-purple-dark transition-all duration-200 
                                 hover:shadow-md p-0"
                        title={t("original_image_hint")}
                      >
                        {isVideoUrl(group.uploadedImages[0].url) ? (
                          <video
                            src={group.uploadedImages[0].url}
                            className="w-16 h-16 object-cover transition-transform duration-200 group-hover:scale-105"
                            muted
                            playsInline
                            autoPlay
                            loop
                          />
                        ) : (
                          <img
                            src={group.uploadedImages[0].url}
                            alt={t("original_image")}
                            className="w-16 h-16 object-cover transition-transform duration-200 
                                   group-hover:scale-105"
                          />
                        )}
                        <div
                          className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 
                                      transition-all duration-200 flex items-center justify-center"
                        >
                          <svg
                            className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 
                                     transition-opacity duration-200"
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
                    )}
                  </div>
                </div>

                {/* 底部信息區域 */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-custom-light-purple/30 dark:border-custom-light-purple-dark/30">
                  {/* 模型信息 */}
                  <div className="flex items-center gap-2 text-sm text-custom-logo-purple dark:text-custom-logo-purple-dark">
                    <ShareIcon
                      className="fill-current"
                      wrapperClassName="w-4 h-4"
                    />
                    <span className="font-medium">{group.loraModelName}</span>
                  </div>
                </div>
              </div>

              {/* 圖片網格 */}
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {group.images.map((image, index) => (
                    <div
                      key={image.id}
                      className="transition-all duration-300 relative group"
                    >
                      <div className="bg-custom-gray dark:bg-custom-gray-dark rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-custom-light-purple dark:border-custom-light-purple-dark">
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
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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
                                }
                              }}
                              className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 shadow-lg ${
                                image.userReaction.comment
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
                              title={t("share_image")}
                            />
                          </div>

                          {/* 移動版底部覆蓋層 - 僅在小屏幕顯示 */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 md:hidden">
                            <div className="flex items-center justify-between">
                              {/* 左側：收藏 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCollectReaction(image.id);
                                }}
                                className={`flex items-center space-x-2 px-3 py-2 rounded-full backdrop-blur-sm transition-all duration-200 active:scale-95 ${
                                  image.userReaction.collecting
                                    ? "bg-pink-500/90 text-white shadow-lg"
                                    : "bg-black/50 text-white"
                                }`}
                                title={t("collect_image")}
                              >
                                <Heart
                                  className={`w-4 h-4 ${
                                    image.userReaction.collecting
                                      ? "fill-current"
                                      : ""
                                  }`}
                                />
                                <span className="text-sm font-medium">
                                  {image.reactions.collections || 0}
                                </span>
                              </button>

                              {/* 中間：讚和踩 */}
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(image.id, "like");
                                  }}
                                  className={`flex items-center space-x-1 px-3 py-2 rounded-full backdrop-blur-sm transition-all duration-200 active:scale-95 ${
                                    image.userReaction.like
                                      ? "bg-blue-500/90 text-white shadow-lg"
                                      : "bg-black/50 text-white"
                                  }`}
                                title={t("like_image")}
                                >
                                  <ThumbsUp
                                    className={`w-4 h-4 ${
                                      image.userReaction.like
                                        ? "fill-current"
                                        : ""
                                    }`}
                                  />
                                  <span className="text-sm font-medium">
                                    {image.reactions.likes}
                                  </span>
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(image.id, "dislike");
                                  }}
                                  className={`flex items-center space-x-1 px-3 py-2 rounded-full backdrop-blur-sm transition-all duration-200 active:scale-95 ${
                                    image.userReaction.dislike
                                      ? "bg-red-500/90 text-white shadow-lg"
                                      : "bg-black/50 text-white"
                                  }`}
                                title={t("dislike_image")}
                                >
                                  <ThumbsDown
                                    className={`w-4 h-4 ${
                                      image.userReaction.dislike
                                        ? "fill-current"
                                        : ""
                                    }`}
                                  />
                                  <span className="text-sm font-medium">
                                    {image.reactions.dislikes}
                                  </span>
                                </button>
                              </div>

                              {/* 右側：留言和分享 */}
                              <div className="flex items-center space-x-2">
                                {/* <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isPremium) {
                                      setShowComment({
                                        imageId: image.id,
                                        comment: image.userReaction.comment || "",
                                      });
                                      setCommentDialogOpen(true);
                                    }
                                  }}
                                  className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 active:scale-95 ${
                                    image.userReaction.comment
                                      ? "bg-emerald-500/90 text-white shadow-lg"
                                      : "bg-black/50 text-white"
                                  }`}
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button> */}

                                <ShareButton
                                  ref={getShareButtonRef(`${image.id}-mobile`)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleShareDropdown(`${image.id}-mobile`);
                                  }}
                                  isActive={
                                    shareDropdowns[`${image.id}-mobile`] ||
                                    sharedImages[image.id]
                                  }
                                  isMobile={true}
                                  title={t("share_image")}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 底部互動區域 - 僅桌面版顯示 */}
                        <div className="p-4 hidden md:block">
                          <div className="flex items-center justify-between">
                            {/* 主要互動按鈕 */}
                            <div className="flex items-center space-x-6">
                              {/* 按讚 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReaction(image.id, "like");
                                }}
                                className={`flex items-center space-x-2 transition-all duration-200 hover:scale-105 ${
                                  image.userReaction.like
                                    ? "text-blue-500 font-bold"
                                    : "text-gray-500 hover:text-blue-500"
                                }`}
                                title={t("like_image")}
                              >
                                <ThumbsUp
                                  className={`w-5 h-5 ${
                                    image.userReaction.like
                                      ? "fill-current"
                                      : ""
                                  }`}
                                />
                                <span className="text-base">
                                  {image.reactions.likes}
                                </span>
                              </button>

                              {/* 按踩 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReaction(image.id, "dislike");
                                }}
                                className={`flex items-center space-x-2 transition-all duration-200 hover:scale-105 ${
                                  image.userReaction.dislike
                                    ? "text-red-500 font-bold"
                                    : "text-gray-500 hover:text-red-500"
                                }`}
                                title={t("dislike_image")}
                              >
                                <ThumbsDown
                                  className={`w-5 h-5 ${
                                    image.userReaction.dislike
                                      ? "fill-current"
                                      : ""
                                  }`}
                                />
                                <span className="text-base">
                                  {image.reactions.dislikes}
                                </span>
                              </button>

                              {/* 收藏 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCollectReaction(image.id);
                                }}
                                className={`flex items-center space-x-2 transition-all duration-200 hover:scale-105 ${
                                  image.userReaction.collecting
                                    ? "text-pink-500 font-bold"
                                    : "text-gray-500 hover:text-pink-500"
                                }`}
                                title={t("collect_image")}
                              >
                                <Heart
                                  className={`w-5 h-5 ${
                                    image.userReaction.collecting
                                      ? "fill-current"
                                      : ""
                                  }`}
                                />
                                <span className="text-base">
                                  {image.reactions.collections || 0}
                                </span>
                              </button>
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
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 px-6 py-4 bg-custom-white dark:bg-custom-white-dark rounded-xl shadow-lg border border-custom-light-purple dark:border-custom-light-purple-dark">
                <div className="w-6 h-6 border-2 border-custom-logo-purple/20 border-t-custom-logo-purple dark:border-t-custom-logo-purple-dark rounded-full animate-spin"></div>
                <p className="text-custom-black dark:text-custom-black-dark font-medium">
                  {t("loading_images")}
                </p>
              </div>
            </div>
          )}
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
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t("unlock_title")}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{t("unlock_content")}</p>
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
                img.id === imageId || img.id === imageId.replace("-mobile", "")
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
      {/* <CommentDialog
        currentComment={showComment}
        onConfirm={(newComment: CommentReaction) => {
          submitReactionComment(newComment);
        }}
        onClose={() => {
          setCommentDialogOpen(false);
        }}
        isOpen={openCommentDialog}
      /> */}

      {/* 🖼️ 原圖放大 Modal */}
      {showOriginalImageModal && originalImageUrl && (
        <OriginalImageModal
          imageUrl={originalImageUrl}
          onClose={handleCloseOriginalImageModal}
        />
      )}
    </div>
  );
};

export default PublishedImages;
