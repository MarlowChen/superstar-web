import React, { useState, useEffect } from "react";
import { ImageData } from "@/payload-types";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  closestCenter,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";

import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";

import { snapCenterToCursor } from "@dnd-kit/modifiers";
import SortableImageItem from "../SortableImageItem";
import { useMediaQuery } from "react-responsive";

interface ImageGalleryPublisherProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (
    title: string,
    description: string,
    selectedImages: ImageData[]
  ) => void;
  images: ImageData[];
  postdata?: {
    title: string;
    description: string;
    publishedImages: string[];
  };
}

const ImageGalleryPublisher: React.FC<ImageGalleryPublisherProps> = ({
  isOpen,
  onClose,
  onPublish,
  images,
  postdata,
}) => {
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [selectedImages, setSelectedImages] = useState<ImageData[]>([]);
  const [isAnimatingIn, setIsAnimatingIn] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const isMobile = useMediaQuery({ maxWidth: 767 });

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = "hidden";
      setTimeout(() => setIsAnimatingIn(true), 10);
    } else {
      setIsAnimatingIn(false);
      setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (postdata) {
      setTitle(postdata.title);
      setDescription(postdata.description);

      // 創建一個 Map 來快速查找圖片
      const imageMap = new Map(images.map((img) => [img.id, img]));

      // 按照 publishedImages 的順序選擇圖片
      const orderedSelectedImages = postdata.publishedImages
        .map((id) => imageMap.get(id))
        .filter((img): img is ImageData => img !== undefined);

      setSelectedImages(orderedSelectedImages);
    }
  }, [postdata, images]);

  const handleClose = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePublish = () => {
    onPublish(title, description, selectedImages);
    onClose();
  };

  const toggleImageSelection = (image: ImageData) => {
    setSelectedImages((prev) => {
      const exists = prev.find((img) => img.id === image.id);
      if (exists) {
        return prev.filter((img) => img.id !== image.id);
      } else {
        return [...prev, image];
      }
    });
  };

  const removeImage = (image: ImageData) => {
    setSelectedImages((prev) => prev.filter((img) => img.id !== image.id));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(String(active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setSelectedImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className={`bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl transform transition-all duration-300 ease-out ${
          isAnimatingIn
            ? "translate-y-0 opacity-100"
            : "translate-y-4 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-custom-white transition-colors duration-200"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <h3 className="text-2xl font-semibold text-custom-white mb-4">
            发布图集
          </h3>

          <div className="mb-4">
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              标题
            </label>
            <input
              type="text"
              id="title"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-custom-white placeholder-gray-400 focus:outline-none transition-all duration-200"
              placeholder="输入您的图集标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              描述
            </label>
            <textarea
              id="description"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-custom-white placeholder-gray-400 focus:outline-none transition-all duration-200"
              rows={3}
              placeholder="Describe your collection"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {selectedImages.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Selected pictures (can be dragged and sorted)
              </label>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                modifiers={[snapCenterToCursor]}
              >
                <SortableContext
                  items={selectedImages.map((img) => img.id)}
                  strategy={
                    isMobile
                      ? verticalListSortingStrategy
                      : horizontalListSortingStrategy
                  }
                >
                  <div
                    className={
                      isMobile
                        ? "space-y-2"
                        : "flex space-x-2 overflow-x-auto pb-2"
                    }
                  >
                    {selectedImages.map((image, index) => (
                      <SortableImageItem
                        key={image.id}
                        image={image}
                        index={index}
                        removeImage={() => removeImage(image)}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeId ? (
                    <div
                      className="relative rounded-md overflow-hidden touch-none"
                      style={{ cursor: "grabbing" }}
                    >
                      <img
                        src={
                          selectedImages.find((img) => img.id === activeId)?.url
                        }
                        alt="Drag Preview"
                        className={
                          isMobile
                            ? "w-full h-24 object-cover"
                            : "w-24 h-24 object-cover"
                        }
                        draggable={false}
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              There are pictures (click to select)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {images.map((image) => {
                const isSelected = selectedImages.some(
                  (img) => img.id === image.id
                );
                return (
                  <div
                    key={image.id}
                    className={`relative cursor-pointer rounded-md overflow-hidden transition-all duration-200 ${
                      isSelected ? "ring-2 ring-custom-logo-purple" : ""
                    }`}
                    onClick={() => toggleImageSelection(image)}
                  >
                    <img
                      src={image.url}
                      alt={`Image`}
                      className="w-full h-24 object-cover"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-custom-logo-purple bg-opacity-50 flex items-center justify-center">
                        <span className="text-custom-white font-bold">
                          {selectedImages.findIndex(
                            (img) => img.id === image.id
                          ) + 1}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 focus:outline-none transition-all duration-200"
              onClick={onClose}
            >
              cancel
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-md focus:outline-none transition-all duration-200 ${
                selectedImages.length === 0
                  ? "bg-blue-400 text-custom-white cursor-not-allowed"
                  : "bg-blue-600 text-custom-white hover:bg-blue-700"
              }`}
              onClick={handlePublish}
              disabled={selectedImages.length === 0}
            >
              Publish {selectedImages.length > 0 && `(${selectedImages.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGalleryPublisher;
