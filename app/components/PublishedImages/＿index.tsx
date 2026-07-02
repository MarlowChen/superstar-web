"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { ShareIcon } from "@/app/icon/ShareIcon";
import { LinkIcon } from "@/app/icon/LinkIcon";
import { DownloadIcon } from "@/app/icon/DownloadIcon";
import { showToast } from "../CustomToast";
import ImageZoomViewer from "../ImageZoomViewer";
import useReactions from "../EnhancedImageDisplay/useReactions";
import ImageActions from "../ImageActions";
import CommentDialog from "../CommentDialog";
import { useTranslations } from "next-intl";
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
  };
  userReaction: {
    like: boolean;
    dislike: boolean;
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
  uploadedImages: ImageData[];
}

const PublishedImages: React.FC = () => {
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
    uploadedImages: [],
  });
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const { toggleReaction, toggleReactionComment } = useReactions();
  const [openCommentDialog, setCommentDialogOpen] = useState<boolean>(false);
  const [showComment, setShowComment] = useState<CommentReaction>({
    imageId: "",
    comment: "",
  });
  const isFirstRender = useRef(true);
  const t = useTranslations("library");
  const contentRef = useRef<HTMLDivElement>(null);

  // 假設這是從環境變數或全局狀態獲取的付費狀態
  const isPremium = false; // 示例：設為false表示未付費

  // 處理升級到付費版的函數
  const handleUpgradeToPremium = () => {
    return;
    //window.location.href = "/upgrade";
  };

  // 下載圖片的函數
  const downloadImages = async (images: ImageGroup["images"]) => {
    try {
      // 建立一個 zip 檔案
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // 下載所有圖片
      const imagePromises = images.map(async (image, index) => {
        const response = await fetch(image.url);
        if (!response.ok) throw new Error(`Failed to fetch image ${index + 1}`);
        const blob = await response.blob();
        zip.file(`image-${index + 1}.jpg`, blob);
      });

      await Promise.all(imagePromises);

      // 生成並下載 zip 檔案
      const content = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `images-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      showToast(t("images_downloaded_success"));
    } catch (error) {
      console.error("Download failed:", error);
      showToast(t("images_download_failed"), true);
    }
  };

  // 複製文字的函數
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("copied_success"));
    } catch (error) {
      console.error("Copy failed:", error);
      showToast(t("copy_failed"), true);
    }
  };

  const fetchPublishedImages = async (pageNum: number) => {
    // 重要：非付費用戶只加載第一頁數據
    if (!isPremium && pageNum > 1) {
      setHasMore(false);
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      const limit = 10;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/user/images/${pageNum}/${limit}`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("Failed to fetch images");
      const data = await response.json();

      const resultData = data.groups.map((item: ImageGroup) => {
        return {
          taskId: item.taskId,
          page: pageNum,
          limit: limit,
          sort: "desc",
          prompt: item.userMessage || item.prompt || "",
          loraModelName: item.loraModelName || "",
          images: item.images || [],
          uploadedImages: item.uploadedImages || [],
        };
      });

      setPublishedImages((prev) => {
        // 避免重複的數據
        const existingIds = new Set(prev.map((item) => item.taskId));
        const newItems = resultData.filter(
          (item: ImageGroup) => !existingIds.has(item.taskId)
        );
        return [...prev, ...newItems];
      });

      // 非付費用戶在加載完第一頁後，設置hasMore為false，不再加載更多
      if (!isPremium) {
        setHasMore(false);
      } else {
        const newTotalItems = publishedImages.length + resultData.length;
        setHasMore(newTotalItems < data.total);
      }
    } catch (error) {
      console.error("Failed to fetch images:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 只在首次渲染時執行一次
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchPublishedImages(page);
    }
  }, []);

  // 分開處理滾動加載的邏輯
  useEffect(() => {
    if (!isFirstRender.current && page > 1) {
      fetchPublishedImages(page);
    }
  }, [page]);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading) {
        setPage((prev) => prev + 1);
      }
    },
    [hasMore, loading]
  );

  const openSelectImageDialog = (
    selectIndex: number,
    imageGroup: ImageGroup
  ) => {
    // 非付費用戶點擊不會有效果
    if (!isPremium) return;

    setSelectedImage(imageGroup);
    setIsImageViewerOpen(true);
    setSelectedImageIndex(selectIndex);
  };

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

  const handleReaction = useCallback(
    async (imageId: string, reactionType: "like" | "dislike") => {
      // 非付費用戶點贊不會有效果
      if (!isPremium) return;

      // 找到包含該圖片的圖片組
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

      // 更新圖片的反應狀態
      updatedMessages[groupIndex].images[imageIndex] = {
        ...currentImage,
        userReaction: {
          ...currentImage.userReaction,
          like: reactionType === "like" ? !wasLiked : false,
          dislike: reactionType === "dislike" ? !wasDisliked : false,
        },
        reactions: {
          likes:
            reactionType === "like"
              ? wasLiked
                ? currentImage.reactions.likes - 1
                : currentImage.reactions.likes + 1
              : currentImage.reactions.likes,
          dislikes:
            reactionType === "dislike"
              ? wasDisliked
                ? currentImage.reactions.dislikes - 1
                : currentImage.reactions.dislikes + 1
              : currentImage.reactions.dislikes,
        },
      };

      // 同樣更新 selectedImage 的狀態，如果是當前選中的圖片組
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

      // 呼叫 API 更新後端
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

  const submitReactionComment = useCallback(
    async (commentData: CommentReaction) => {
      // 非付費用戶評論不會有效果
      if (!isPremium) return;

      const { imageId, comment } = commentData;

      // 找到包含該圖片的圖片組
      const groupIndex = publishedImages.findIndex((group) =>
        group.images.some((image) => image.id === imageId)
      );

      if (groupIndex === -1) return;

      const imageIndex = publishedImages[groupIndex].images.findIndex(
        (image) => image.id === imageId
      );

      if (imageIndex === -1) return;

      const updatedMessages = [...publishedImages];

      // 更新圖片的評論
      updatedMessages[groupIndex].images[imageIndex] = {
        ...updatedMessages[groupIndex].images[imageIndex],
        userReaction: {
          ...updatedMessages[groupIndex].images[imageIndex].userReaction,
          comment: comment,
        },
      };

      // 同樣更新 selectedImage 的狀態，如果是當前選中的圖片組
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

      // 呼叫 API 更新後端
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
    [toggleReactionComment, publishedImages, selectedImage, isPremium]
  );

  return (
    <div className="w-full max-w-5xl h-[calc(100vh-2.5rem)] flex flex-col transition-all duration-300 ease-in-out m-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#2C3E50] dark:text-custom-white">
          {t("my_library")}
        </h1>

        {/* 添加升級按鈕在標題旁邊 */}
        {!isPremium && (
          <button
            onClick={handleUpgradeToPremium}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center cursor-not-allowed"
          >
            <svg
              className="w-4 h-4 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M19 11H5V21H19V11Z" fill="currentColor" />
              <path
                d="M17 11V7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7V11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {t("upgrade")}
          </button>
        )}
      </div>

      {/* 使用 flex-1 和 overflow-hidden 確保容器不超過剩餘的視口高度 */}
      <div className="flex-1 relative overflow-hidden" ref={contentRef}>
        {/* 非付費用戶顯示漸變覆蓋層 */}
        {!isPremium && (
          <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none">
            {/* 漸變背景 - 從透明到白色(或暗模式下的暗色) */}
            <div className="h-40 bg-gradient-to-t from-white dark:from-custom-gray-dark to-transparent"></div>

            {/* 底部固定色塊和升級按鈕 */}
            <div className="h-32 bg-white dark:bg-custom-gray-dark flex items-center justify-center">
              <div className="text-center max-w-md w-full px-6">
                <div className="w-12 h-12 bg-[#EAE8FD] rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-[#5944FF]"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M19 11H5V21H19V11Z" fill="currentColor" />
                    <path
                      d="M17 11V7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7V11"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <button
                  onClick={handleUpgradeToPremium}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium pointer-events-auto cursor-not-allowed"
                >
                  {t("upgrade_now")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 主要內容區域，使用 h-full 和 overflow-auto 創建可滾動容器 */}
        <div className={`h-full overflow-hidden ${!isPremium ? "pb-44" : ""}`}>
          <div className="space-y-10 p-6">
            {publishedImages.map((group) => (
              <div key={group.taskId} className="mb-10">
                <div className="flex my-2 justify-between">
                  <div className="flex items-center">
                    <button
                      className="flex items-center hover:bg-custom-light-purple-hover justify-center bg-custom-light-purple w-6 h-6 rounded-md"
                      onClick={() => copyToClipboard(group.prompt)}
                      aria-label="Copy message"
                    >
                      <LinkIcon
                        className="fill-custom-logo-purple stroke-custom-logo-purple stroke-[2]"
                        wrapperClassName="w-4 h-4"
                      />
                    </button>
                    <p className="pl-2 text-custom-black dark:text-custom-white">
                      {group.prompt}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <div className="flex items-center">
                      <ShareIcon
                        className="fill-custom-black stroke-custom-black dark:fill-custom-white dark:stroke-custom-white stroke-[2]"
                        wrapperClassName="w-4 h-4"
                      />
                      <p className="pl-2 text-custom-black dark:text-custom-white">
                        {group.loraModelName}
                      </p>
                    </div>
                    <button
                      className="ml-2 flex items-center hover:bg-custom-light-purple-hover justify-center bg-custom-light-purple w-6 h-6 rounded-md"
                      onClick={() => downloadImages(group.images)}
                      aria-label="Download images"
                    >
                      <DownloadIcon
                        className="fill-custom-logo-purple stroke-custom-logo-purple stroke-[2]"
                        wrapperClassName="w-4 h-4"
                      />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                  {group.images.map((image, index) => (
                    <div
                      key={image.id}
                      className="relative aspect-square w-full group"
                      onClick={() => openSelectImageDialog(index, group)}
                    >
                      <div className="absolute inset-0 rounded-lg overflow-hidden cursor-pointer">
                        <Image
                          src={image.url}
                          alt={`Image ${image.id}`}
                          layout="fill"
                          objectFit="cover"
                          className="rounded-lg"
                        />

                        {/* 非付費用戶圖片上顯示鎖定圖標 */}
                        {!isPremium && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
                            <svg
                              className="w-10 h-10 text-white opacity-80"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M19 11H5V21H19V11Z"
                                fill="currentColor"
                              />
                              <path
                                d="M17 11V7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7V11"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                        )}

                        {/* 圖片操作按鈕 */}
                        <div className="absolute bottom-0 right-0 z-10">
                          <ImageActions
                            like={() => handleReaction(image.id, "like")}
                            disLike={() => handleReaction(image.id, "dislike")}
                            isLiked={image.userReaction.like}
                            isDisliked={image.userReaction.dislike}
                            comment={() => {
                              if (isPremium) {
                                setShowComment({
                                  imageId: image.id,
                                  comment: image.userReaction.comment || "",
                                });
                                setCommentDialogOpen(true);
                              }
                            }}
                            isCommented={Boolean(
                              image?.userReaction?.comment?.trim()
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {loading && (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#5944FF] dark:border-[#8F7FFF]"></div>
              </div>
            )}

            {hasMore && <div ref={observerTarget} style={{ height: "20px" }} />}
          </div>
        </div>
      </div>

      {isImageViewerOpen && selectedImage.images.length > 0 && (
        <ImageZoomViewer
          modelName={selectedImage.loraModelName}
          prompt={selectedImage.prompt}
          images={selectedImage.images}
          initialIndex={selectedImageIndex}
          onClose={() => setIsImageViewerOpen(false)}
          handleReaction={function (imageId: string, type: string): void {
            handleReaction(imageId, type as "like" | "dislike");
          }}
        />
      )}

      <CommentDialog
        currentComment={showComment}
        onConfirm={(newComment: CommentReaction) => {
          submitReactionComment(newComment);
        }}
        onClose={function (): void {
          setCommentDialogOpen(false);
        }}
        isOpen={openCommentDialog}
      />
    </div>
  );
};

export default PublishedImages;
