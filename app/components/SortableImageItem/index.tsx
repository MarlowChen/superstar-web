import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { ImageData } from '@/payload-types';
import { CSS } from '@dnd-kit/utilities';

interface SortableImageItemProps {
  image: ImageData;
  index: number;
  removeImage: () => void;
  isMobile: boolean;
}

const SortableImageItem: React.FC<SortableImageItemProps> = ({
  image,
  removeImage,
  isMobile,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: image.id,
    data: {
      type: 'image',
      image: image,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
    cursor: 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative rounded-md overflow-hidden touch-none ${
        isMobile ? 'w-full mb-2' : 'w-24'
      }`}
    >
      <img 
        src={image.url} 
        alt="Selected" 
        className={`${isMobile ? 'w-full' : 'w-24'} h-24 object-cover`} 
        draggable={false} 
      />
      <button
        className="absolute top-1 right-1 bg-red-600 text-custom-white rounded-full p-1 text-xs hover:bg-red-700 focus:outline-none transition-all duration-200"
        onClick={(e) => {
          e.stopPropagation();
          removeImage();
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
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
    </div>
  );
};

export default SortableImageItem;