"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import ImageZoomSingleViewer from "../ImageZoomSingleViewer";

interface ImageData {
  _id: string;
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
      comment?: string;
    };
  };
  task: {
    id: string;
    loraModel: string;
    loraModelTitle: string;
    prompt: string;
  };
}

interface ImageResponse {
  images: ImageData[];
  totalPages: number;
  currentPage: number;
  totalCount: number;
}

const PublishedSingleImages: React.FC = () => {
  const [publishedImages, setPublishedImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement | null>(null);
  // const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  // const { toggleReaction, toggleReactionComment } = useReactions();
  // const [openCommentDialog, setCommentDialogOpen] = useState<boolean>(false);
  // const [showComment, setShowComment] = useState<CommentReaction>({
  //   imageId: "",
  //   comment: "",
  // });
  const isFirstRender = useRef(true);

  const fetchPublishedImages = async (pageNum: number) => {
    if (loading) return;
    setLoading(true);

    try {
      const limit = 12;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/liked-images/${pageNum}/${limit}`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("Failed to fetch images");
      const data: ImageResponse = await response.json();

      setPublishedImages((prev) => {
        const existingIds = new Set(prev.map((item) => item._id));
        const newItems = data.images.filter(
          (item) => !existingIds.has(item._id)
        );
        return [...prev, ...newItems];
      });
      setPage(pageNum);
      setHasMore(data.currentPage < data.totalPages);
    } catch (error) {
      console.error("Failed to fetch images:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchPublishedImages(page);
    }
  }, []);

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

  // const handleReaction = useCallback(
  //   async (imageId: string, reactionType: "like" | "dislike") => {
  //     const imageIndex = publishedImages.findIndex(
  //       (image) => image.id === imageId
  //     );

  //     if (imageIndex === -1) return;

  //     const updatedImages = [...publishedImages];
  //     const image = updatedImages[imageIndex];

  //     // Update the reaction state
  //     updatedImages[imageIndex] = {
  //       ...image,
  //       reactions: {
  //         like: reactionType === "like" ? !image.reactions.like : false,
  //         dislike: reactionType === "dislike" ? !image.reactions.dislike : false,
  //       },
  //     };

  //     setPublishedImages(updatedImages);

  //     // 更新選中的圖片狀態
  //     if (selectedImage && selectedImage.id === imageId) {
  //       setSelectedImage(updatedImages[imageIndex]);
  //     }

  //     // Call API to update reaction
  //     // await toggleReaction(imageId, reactionType);
  //   },
  //   [toggleReaction, publishedImages, selectedImage]
  // );

  // const submitReactionComment = useCallback(
  //   async (commentData: CommentReaction) => {
  //     const imageIndex = publishedImages.findIndex(
  //       (image) => image.id === commentData.imageId
  //     );

  //     if (imageIndex === -1) return;

  //     const updatedImages = [...publishedImages];
  //     const image = updatedImages[imageIndex];

  //     // Update the comment
  //     updatedImages[imageIndex] = {
  //       ...image,
  //       comment: commentData.comment || "",
  //     };

  //     setPublishedImages(updatedImages);

  //     // Update selected image if it's the one being commented on
  //     if (selectedImage && selectedImage.id === commentData.imageId) {
  //       setSelectedImage(updatedImages[imageIndex]);
  //     }

  //     // await toggleReactionComment(commentData.imageId, commentData.comment || "");
  //     setCommentDialogOpen(false);
  //   },
  //   [toggleReactionComment, publishedImages, selectedImage]
  // );

  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  // 加載更多圖片的函數
  const loadMoreImages = async () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    await fetchPublishedImages(nextPage);
  };

  // 在圖片網格中點擊圖片時
  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
    setIsImageViewerOpen(true);
  };

  return (
    <div className="w-full max-w-5xl h-full flex flex-col transition-all duration-300 ease-in-out m-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#2C3E50] dark:text-custom-white">
          My Image Library
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {publishedImages.map((image, index) => (
          <div key={image._id} className="relative aspect-square w-full group">
            <div
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer"
              onClick={() => handleImageClick(index)}
            >
              <Image
                src={image.publishedImage.url}
                alt={image.task.prompt}
                layout="fill"
                objectFit="cover"
                className="rounded-lg"
              />

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <div className="flex justify-between items-center">
                  {/* <button
                    className="flex items-center hover:bg-custom-light-purple-hover justify-center bg-custom-light-purple w-6 h-6 rounded-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(image.generatedImage.userMessage);
                    }}
                    aria-label="Copy prompt"
                  >
                    <LinkIcon
                      className="fill-custom-logo-purple stroke-custom-logo-purple stroke-[2]"
                      wrapperClassName="w-4 h-4"
                    />
                  </button> */}
                  <div className="flex items-center">
                    {/* <ShareIcon
                      className="fill-white stroke-white stroke-[2]"
                      wrapperClassName="w-4 h-4"
                    /> */}
                    <p className="pl-2 text-white text-sm">
                      {image.task.prompt}
                    </p>
                  </div>
                </div>
              </div>

              {/* <div className="absolute bottom-0 right-0 z-10">
                <ImageActions
                  like={() => handleReaction(image.id, "like")}
                  disLike={() => handleReaction(image.id, "dislike")}
                  isLiked={image.reactions.like}
                  isDisliked={image.reactions.dislike}
                  comment={() => {
                    setShowComment({
                      imageId: image.id,
                      comment: image.comment
                    });
                    setCommentDialogOpen(true);
                  }}
                  isCommented={Boolean(image.comment?.trim())}
                />
              </div> */}
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#5944FF] dark:border-[#8F7FFF]"></div>
        </div>
      )}

      {hasMore && <div ref={observerTarget} style={{ height: "20px" }} />}

      {isImageViewerOpen && (
        <ImageZoomSingleViewer
          currentImage={publishedImages[selectedImageIndex]}
          onPrevious={() => setSelectedImageIndex((prev) => prev - 1)}
          onNext={async () => {
            // 如果是最後一張且還有更多，先加載更多
            if (selectedImageIndex === publishedImages.length - 1 && hasMore) {
              await loadMoreImages();
            }
            setSelectedImageIndex((prev) => prev + 1);
          }}
          handleReaction={() => {
            // handleReaction(imageId, type as "like" | "dislike");
          }}
          showPrevious={selectedImageIndex > 0}
          showNext={selectedImageIndex < publishedImages.length - 2 || hasMore}
          onClose={() => setIsImageViewerOpen(false)}
        />
      )}

      {/* <CommentDialog
        currentComment={showComment}
        onConfirm={submitReactionComment}
        onClose={() => setCommentDialogOpen(false)}
        isOpen={openCommentDialog}
      /> */}
    </div>
  );
};

export default PublishedSingleImages;
