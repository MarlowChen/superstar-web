"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from 'framer-motion';
import { useTranslations } from "next-intl";
import { FaSquareXTwitter } from "react-icons/fa6";

import { 
  Copy, 
  Download, 
  Share2, 
  ExternalLink 
} from "lucide-react";

// 社群平台圖示組件
const LineIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="#00B900"
    className="rounded"
  >
    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
  </svg>
);

const FacebookIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="#1877F2"
    className="rounded"
  >
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const TwitterIcon = ({ size = 16 }: { size?: number }) => (
  <FaSquareXTwitter
    size={size}
    className="text-[#14171A] dark:text-[#E7E9EA] rounded"
  />
);


// 分享下拉選單組件
export const ShareDropdown = ({
  isOpen,
  onClose,
  shareData,
  buttonRef,
  onShareComplete
}: {
  isOpen: boolean;
  onClose: () => void;
  shareData: {
    url: string;
    title: string;
    description: string;
    hashtag: string;
    imageUrl?: string;
    modelName?: string;
    imageId?: string;
  };
  buttonRef: React.RefObject<HTMLButtonElement>;
  onShareComplete?: (platform: string) => void;
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [isMouseInside, setIsMouseInside] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const t = useTranslations("share");

  // 計算下拉選單位置
  useEffect(() => {
    if (isOpen && buttonRef.current && dropdownRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const dropdownRect = dropdownRef.current.getBoundingClientRect();
      
      let top = buttonRect.bottom + 8;
      let left = buttonRect.right - dropdownRect.width;

      // 確保不超出視窗邊界
      if (left < 8) {
        left = buttonRect.left;
      }
      
      if (top + dropdownRect.height > window.innerHeight - 16) {
        top = buttonRect.top - dropdownRect.height - 8;
      }

      setDropdownPosition({ top, left });
    }
  }, [isOpen, buttonRef]);

  // 延遲關閉功能
  const scheduleClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      if (!isMouseInside) {
        onClose();
      }
    }, 300);
  };

  const cancelClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  // 事件監聽
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('wheel', handleWheel);
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('wheel', handleWheel);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose, buttonRef]);

  // 清理 timeout
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // 分享功能實作
  const handleNativeShare = async () => {
    if (!('share' in navigator)) {
      handleCopyLink();
      return;
    }

    try {
      await navigator.share({
        title: shareData.title,
        text: shareData.description,
        url: shareData.url,
      });
      onClose();
      onShareComplete?.('native');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handleCopyLink();
      }
    }
  };

  const handleLineShare = () => {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const shareText = `${shareData.title}\n\n${shareData.description}\n\n${shareData.url}`;
    
    if (isMobile) {
      window.location.href = `https://line.me/R/share?text=${encodeURIComponent(shareText)}`;
    } else {
      window.open(
        `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(`${shareData.title}\n\n${shareData.description}`)}`,
        '_blank',
        'width=500,height=500'
      );
    }
    
    onClose();
    onShareComplete?.('line');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareData.url);
      onClose();
      onShareComplete?.('copy');
    } catch (err) {
      console.error('複製失敗:', err);
    }
  };

  const handleDownloadImage = async () => {
    if (!shareData.imageUrl) return;

    try {
      // 使用統一的檔案名稱格式，包含模型編號
      const modelName = shareData.modelName || "unknown";
      const imageId = shareData.imageId || Date.now().toString();
      const { getDownloadFileName } = await import('@/utils/getDownloadFileName');
      const fileName = getDownloadFileName(modelName, imageId);
      
      // 使用改進的下載函數，iOS Safari 將顯示分享面板讓用戶保存到相簿
      const { downloadImage: downloadImageHelper } = await import('@/utils/downloadHelper');
      const result = await downloadImageHelper(shareData.imageUrl, fileName);
      
      onClose();
      
      if (result.success) {
        onShareComplete?.('download');
      } else {
        console.error("Download failed");
      }
    } catch (error) {
      console.error("Download failed:", error);
      onClose();
    }
  };

  const handleSocialShare = (platform: string, url: string) => {
    window.open(url, '_blank', 'width=600,height=400');
    onClose();
    onShareComplete?.(platform);
  };

  if (!isOpen) return null;

  const buttonBaseClass =
    "group flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-medium text-gray-700 dark:text-gray-200 transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/[0.08] outline-none";
  const iconWrapperClass =
    "flex h-5 w-5 items-center justify-center shrink-0 text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-200";

  return (
    <div
      className="fixed inset-0 z-[9999]"
      style={{ pointerEvents: 'none' }}
    >
      <motion.div
        ref={dropdownRef}
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -4 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="absolute min-w-[220px] overflow-hidden rounded-2xl border border-black/5 bg-white/90 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl ring-1 ring-black/5 dark:border-white/[0.08] dark:bg-[#1C1C1F]/85 dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] dark:ring-white/5"
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          pointerEvents: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          setIsMouseInside(true);
          cancelClose();
        }}
        onMouseLeave={() => {
          setIsMouseInside(false);
          scheduleClose();
        }}
      >
        <div className="px-2.5 pb-1.5 pt-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{t("share_collect_image")}</h3>
        </div>

        {/* 原生分享 */}
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <>
            <button
              onClick={handleNativeShare}
              className={buttonBaseClass}
            >
              <span className={iconWrapperClass}>
                <Share2 className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <span>{t("system_share")}</span>
              <ExternalLink className="ml-auto h-3.5 w-3.5 text-gray-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            </button>
            <div className="mx-2 my-1 h-[1px] bg-gray-100 dark:bg-white/[0.06]" />
          </>
        )}

        {/* 社群平台分享 */}
        <div className="space-y-0.5">
          <button
            onClick={() => handleSocialShare(
              'facebook',
              `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}&hashtag=${encodeURIComponent(shareData.hashtag)}`
            )}
            className={buttonBaseClass}
          >
            <span className="flex h-5 w-5 items-center justify-center shrink-0">
              <FacebookIcon size={18} />
            </span>
            <span>Facebook</span>
            <ExternalLink className="ml-auto h-3.5 w-3.5 text-gray-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </button>

          <button
            onClick={() => handleSocialShare(
              'twitter',
              `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(`${shareData.title}\n\n${shareData.description}`)}&hashtags=${encodeURIComponent(shareData.hashtag.replace(/#/g, '').replace(/\s/g, ','))}`
            )}
            className={buttonBaseClass}
          >
            <span className="flex h-5 w-5 items-center justify-center shrink-0">
              <TwitterIcon size={16} />
            </span>
            <span>X (Twitter)</span>
            <ExternalLink className="ml-auto h-3.5 w-3.5 text-gray-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </button>

          <button
            onClick={handleLineShare}
            className={buttonBaseClass}
          >
            <span className="flex h-5 w-5 items-center justify-center shrink-0">
              <LineIcon size={18} />
            </span>
            <span>LINE</span>
            <ExternalLink className="ml-auto h-3.5 w-3.5 text-gray-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </button>
        </div>

        <div className="mx-2 my-1.5 h-[1px] bg-gray-100 dark:bg-white/[0.06]" />

        {/* 功能選項 */}
        <div className="space-y-0.5">
          {shareData.imageUrl && (
            <button
              onClick={handleDownloadImage}
              className={buttonBaseClass}
            >
              <span className={iconWrapperClass}>
                <Download className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <span>{t("download_image")}</span>
            </button>
          )}  

          <button
            onClick={handleCopyLink}
            className={buttonBaseClass}
          >
            <span className={iconWrapperClass}>
              <Copy className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <span>{t("copy_link")}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
