import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import ImageActions from "../ImageActions";

interface ImageData {
  url: string;
  id: string;
  reactions: {
    likes: number;
    dislikes: number;
  };
  userReaction: {
    like: boolean;
    dislike: boolean;
  };
}

interface EnhancedImageDisplayProps {
  messageId: string;
  selectedImages: ImageData[];
  isImageViewerOpen: boolean;
  setIsImageViewerOpen: (isOpen: boolean) => void;
  onReaction: (
    messageId: string,
    imageId: string,
    reactionType: "like" | "dislike"
  ) => void;
}

const EnhancedImageDisplay: React.FC<EnhancedImageDisplayProps> = ({
  messageId,
  selectedImages,
  setIsImageViewerOpen,
  onReaction,
}) => {
  const [imagesLoaded, setImagesLoaded] = useState<Record<string, boolean>>({});
  // const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  useEffect(() => {
    selectedImages.forEach((image) => {
      if (!imagesLoaded[image.url]) {
        const img = new window.Image();
        img.onload = () =>
          setImagesLoaded((prev) => ({ ...prev, [image.url]: true }));
        img.onerror = () =>
          setImagesLoaded((prev) => ({ ...prev, [image.url]: true }));
        img.src = image.url;
      }
    });
  }, [selectedImages]);

  const handleReaction = useCallback(
    (imageId: string, reactionType: "like" | "dislike") => {
      const image = selectedImages.find((img) => img.id === imageId);
      if (!image) return;
      if (reactionType === "like") {
        if (image.userReaction.dislike) {
          // 如果已經不喜歡，先取消不喜歡
          onReaction(messageId, imageId, "dislike");
        }
        // 切換喜歡狀態
        onReaction(messageId, imageId, "like");
      } else if (reactionType === "dislike") {
        if (image.userReaction.like) {
          // 如果已經喜歡，先取消喜歡
          onReaction(messageId, imageId, "like");
        }
        // 切換不喜歡狀態
        onReaction(messageId, imageId, "dislike");
      }
    },
    [onReaction, messageId, selectedImages]
  );

  const renderImage = useCallback(
    (image: ImageData, index: number) => (
      <div
        key={image.id}
        className="cursor-pointer relative aspect-square"
        onClick={() => {
          // setSelectedImageIndex(index);
          setIsImageViewerOpen(true);
        }}
      >
        {!imagesLoaded[image.url] ? (
          <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg" />
        ) : (
          <div className="relative rounded-lg w-full h-full">
            <Image
              src={image.url}
              alt={`selected picture ${index + 1}`}
              layout="fill"
              objectFit="cover"
              className="rounded-lg cursor-pointer	"
            />
            <div className="absolute bottom-0 -right-[.5rem] z-10">
              <ImageActions
                like={() => handleReaction(image.id, "like")}
                disLike={() => handleReaction(image.id, "dislike")}
                isLiked={image.userReaction.like}
                isDisliked={image.userReaction.dislike}
              />
            </div>
          </div>
        )}
      </div>
    ),
    [imagesLoaded, handleReaction, setIsImageViewerOpen]
  );

  return (
    <div className="p-4 w-full">
      {selectedImages.length > 0 && (
        <>
          <h2 className="text-lg font-bold mb-4">Images</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[600px] mx-auto">
            {selectedImages.map(renderImage)}
          </div>
        </>
      )}

      {/* {isImageViewerOpen && selectedImages.length > 0 && (
        <ImageZoomViewer
          images={selectedImages}
          initialIndex={selectedImageIndex}
          onClose={() => setIsImageViewerOpen(false)}
        />
      )} */}
    </div>
  );
};

export default React.memo(EnhancedImageDisplay);
