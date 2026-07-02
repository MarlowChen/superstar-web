import React from "react";
import { motion } from "framer-motion";
import {
  ThumbsUp,
  ThumbsDown,
  Copy,
  RotateCcw,
  MessageSquareText,
  Heart, // 新增收藏圖標
} from "lucide-react";
import { ActionButton } from "../ActionButton";
import { ShareDropdown } from "../ShareDropdown";

interface ImageActionsProps {
  copy?: () => void;
  retry?: () => void;
  like?: () => void;
  disLike?: () => void;
  collect?: () => void; // 新增收藏方法
  isLiked?: boolean;
  isDisliked?: boolean;
  isCollected?: boolean; // 新增收藏狀態
  comment?: () => void;
  isCommented?: boolean;
  // 分享相關的 props
  shareData?: {
    url?: string;
    title?: string;
    description?: string;
    hashtag?: string;
    imageUrl?: string;
  };
  onCopyLink?: () => void;
  onShareComplete?: (platform: string) => void;
}

const ImageActions: React.FC<ImageActionsProps> = ({
  copy,
  retry,
  comment,
  like,
  disLike,
  collect, // 新增收藏
  isLiked = false,
  isDisliked = false,
  isCollected = false, // 新增收藏狀態
  isCommented = false,
  shareData,
  onCopyLink,
  onShareComplete,
}) => {
  const handleAction = (action?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (action) action();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.15,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="bg-custom-white dark:bg-[#3a444f] dark:text-custom-white text-gray-500 border border-[0.5px] border-custom-logo-purple dark:border-slate-700 dark:border-custom-white hover:border-custom-logo-purple-hover dark:hover:border-slate-700 flex items-center rounded-lg shadow-md p-0"
    >
      <div className="text-gray-300 flex items-stretch justify-between">
        <div className="flex gap-1 text-gray-500 dark:text-custom-white">
          {copy && (
            <ActionButton
              onClick={handleAction(copy)}
              icon={Copy}
              title="Copy image"
            />
          )}
          {retry && (
            <ActionButton
              onClick={handleAction(retry)}
              icon={RotateCcw}
              title="Retry"
            />
          )}
        </div>
        <div className="flex items-stretch gap-1 text-gray-500 dark:text-custom-white">
          {like && (
            <ActionButton
              onClick={handleAction(like)}
              icon={ThumbsUp}
              title={isLiked ? "Undo like" : "Like"}
              isActive={isLiked}
              activeColor="text-custom-logo-purple"
            />
          )}
          {disLike && (
            <ActionButton
              onClick={handleAction(disLike)}
              icon={ThumbsDown}
              title={isDisliked ? "Undo dislike" : "Dislike"}
              isActive={isDisliked}
              activeColor="text-red-500"
            />
          )}
          
          {/* 新增收藏按鈕 */}
          {collect && (
            <ActionButton
              onClick={handleAction(collect)}
              icon={Heart}
              title={isCollected ? "Uncollect" : "Collect"}
              isActive={isCollected}
              activeColor="text-red-500" // 收藏用紅色愛心
            />
          )}
          
          <ActionButton
            onClick={(e) => {
              e.stopPropagation();
              comment && comment();
            }}
            icon={MessageSquareText}
            isActive={isCommented}
            activeColor="text-custom-logo-purple"
          />

          {/* 分享下拉選單 */}
          <ShareDropdown
            shareUrl={shareData?.url}
            title={shareData?.title}
            description={shareData?.description}
            hashtag={shareData?.hashtag}
            imageUrl={shareData?.imageUrl}
            onCopyLink={onCopyLink}
            onShareComplete={onShareComplete}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default ImageActions;