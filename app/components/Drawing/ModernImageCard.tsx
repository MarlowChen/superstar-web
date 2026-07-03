import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { showToast } from "../CustomToast";
import { FaSquareXTwitter } from "react-icons/fa6";

import {
  Share2,
  Copy,
  Download,
  ExternalLink,
  // MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Heart,
  Palette,
  Music4,
  Play,
} from "lucide-react";

// LINE 圖示
const LineIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="#00B900"
    className="rounded"
  >
    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
  </svg>
);

// Facebook 圖示
const FacebookIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="#1877F2"
    className="rounded"
  >
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

// Twitter 圖示
const TwitterIcon = ({ size = 16 }: { size?: number }) => (
  <FaSquareXTwitter
    size={size}
    className="text-[#000000] dark:text-white rounded"
  />
);

const isDirectPublicMediaUrl = (url?: string) =>
  Boolean(
    url &&
      (url.startsWith("/images/") ||
        url.startsWith("blob:") ||
        url.startsWith("data:"))
  );

const getAuthenticatedMediaUrl = (shortId?: string, fallbackUrl?: string) => {
  if (isDirectPublicMediaUrl(fallbackUrl)) return fallbackUrl || "";
  if (!shortId) return fallbackUrl || "";

  return `/media/${encodeURIComponent(shortId)}`;
};

const getMediaFallbackUrl = (shortId?: string, fallbackUrl?: string) =>
  shortId && fallbackUrl && !isDirectPublicMediaUrl(fallbackUrl) ? fallbackUrl : "";

const VIDEO_POSTER_URL = "/images/banner/aierone-Q2-6952788aaa70210e4ef6e37a.jpg";

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
      ${isMobile
        ? "p-2 rounded-full backdrop-blur-sm transition-all duration-200 active:scale-95"
        : "p-2 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 shadow-lg"
      } 
      ${isActive
        ? "bg-emerald-500/90 text-white shadow-lg"
        : "bg-black/50 text-white hover:bg-black/70"
      } ${className || ""}`}
    title={title}
  >
    <Share2 className="w-4 h-4" />
  </button>
));

ShareButton.displayName = "ShareButton";

// 分享下拉選單組件
const ShareDropdown = ({
  isOpen,
  onClose,
  shareData,
  buttonRef,
  onShareComplete,
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

  // 檢測是否為移動設備
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 計算下拉選單位置
  useEffect(() => {
    if (isOpen && buttonRef.current && dropdownRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      console.log("buttonRect", buttonRect);
      const dropdownRect = dropdownRef.current.getBoundingClientRect();
      console.log("dropdownRect", dropdownRect);

      // 🔥 添加更詳細的除錯資訊和錯誤檢查
      if (buttonRect.width === 0 && buttonRect.height === 0) {
        // console.error("按鈕 getBoundingClientRect 返回無效值，可能是隱藏元素:", buttonRect);
        // 🔥 使用備用位置：螢幕中央偏右上
        const fallbackTop = Math.max(100, window.innerHeight * 0.2);
        const fallbackLeft = Math.max(50, window.innerWidth - 270); // 270 是選單寬度 + 邊距
        console.log("使用備用位置 - top:", fallbackTop, "left:", fallbackLeft);
        setDropdownPosition({ top: fallbackTop, left: fallbackLeft });
        return;
      }

      let top = buttonRect.bottom + 8;
      let left = buttonRect.right - dropdownRect.width;
      //   console.log("計算前 - top:", top, "left:", left);

      if (left < 8) {
        left = buttonRect.left;
        // console.log("左邊界調整後 - left:", left);
      }

      if (top + dropdownRect.height > window.innerHeight - 16) {
        top = buttonRect.top - dropdownRect.height - 8;
        // console.log("底部邊界調整後 - top:", top);
      }

      //   console.log("最終位置 - top:", top, "left:", left);
      setDropdownPosition({ top, left });
    } else {
      //   console.log("位置計算跳過:", {
      //     isOpen,
      //     hasButtonRef: !!buttonRef.current,
      //     hasDropdownRef: !!dropdownRef.current
      //   });
    }
  }, [isOpen, buttonRef]);

  // 延遲關閉功能 - 僅桌面版
  const scheduleClose = () => {
    // console.log("scheduleClose 被調用", { isMobile, isMouseInside });

    if (isMobile) return;

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      //   console.log("延遲關閉計時器觸發", { isMouseInside });
      if (!isMouseInside) {
        // console.log("執行關閉操作");
        onClose();
      }
    }, 300);
  };

  const cancelClose = () => {
    // console.log("cancelClose 被調用");
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  // 點擊外部關閉
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
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener('wheel', handleWheel);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener('wheel', handleWheel);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, onClose, buttonRef]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // 分享功能
  const handleNativeShare = async () => {
    if (!("share" in navigator)) {
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
      onShareComplete?.("native");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        handleCopyLink();
      }
    }
  };

  const handleLineShare = () => {
    const isMobileDevice =
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    const shareText = `${shareData.title}\n\n${shareData.description}\n\n${shareData.url}`;

    if (isMobileDevice) {
      window.location.href = `https://line.me/R/share?text=${encodeURIComponent(
        shareText
      )}`;
    } else {
      window.open(
        `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(
          shareData.url
        )}&text=${encodeURIComponent(
          `${shareData.title}\n\n${shareData.description}`
        )}`,
        "_blank",
        "width=500,height=500"
      );
    }

    onClose();
    onShareComplete?.("line");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareData.url);
      onClose();
      onShareComplete?.("copy");
    } catch (err) {
      console.error("複製失敗:", err);
    }
  };

  const handleDownloadImage = async () => {
    if (!shareData.imageUrl) return;

    try {
      // 使用統一的檔案名稱格式，包含模型編號
      // 如果沒有模型名稱，使用 "unknown" 作為備用
      const modelName = shareData.modelName || "unknown";
      const imageId = shareData.imageId || Date.now().toString();
      const { getDownloadFileName } = await import('@/utils/getDownloadFileName');
      const fileName = getDownloadFileName(modelName, imageId);

      // 使用改進的下載函數，iOS Safari 將顯示分享面板讓用戶保存到相簿
      const { downloadImage: downloadImageHelper } = await import('@/utils/downloadHelper');
      const result = await downloadImageHelper(shareData.imageUrl, fileName);

      onClose();

      if (result.success) {
        onShareComplete?.("download");
      } else {
        console.error("Download failed");
      }
    } catch (error) {
      console.error("Download failed:", error);
      onClose();
    }
  };

  const handleSocialShare = (platform: string, url: string) => {
    window.open(url, "_blank", "width=600,height=400");
    onClose();
    onShareComplete?.(platform);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "none" }}>
      <motion.div
        ref={dropdownRef}
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
        className="absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-2 min-w-[220px] overflow-hidden"
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          pointerEvents: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
        // 只在桌面版使用滑鼠事件
        {...(!isMobile && {
          onMouseEnter: () => {
            setIsMouseInside(true);
            cancelClose();
          },
          onMouseLeave: () => {
            setIsMouseInside(false);
            scheduleClose();
          }
        })}
      >
        {/* 標題 */}
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {t("share_image")}
          </h3>
        </div>

        {/* 原生分享 */}
        {typeof navigator !== "undefined" && "share" in navigator && (
          <>
            <button
              onClick={handleNativeShare}
              className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
            >
              <Share2 className="w-4 h-4" />
              <span>{t("system_share")}</span>
              <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
            </button>
            <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
          </>
        )}

        {/* 社群平台分享 */}
        <div className="py-1">
          <button
            onClick={() =>
              handleSocialShare(
                "facebook",
                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                  shareData.url
                )}&hashtag=${encodeURIComponent(shareData.hashtag)}`
              )
            }
            className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
          >
            <FacebookIcon size={16} />
            <span>Facebook</span>
            <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
          </button>

          <button
            onClick={() =>
              handleSocialShare(
                "twitter",
                `https://twitter.com/intent/tweet?url=${encodeURIComponent(
                  shareData.url
                )}&text=${encodeURIComponent(
                  `${shareData.title}\n\n${shareData.description}`
                )}&hashtags=${encodeURIComponent(
                  shareData.hashtag.replace(/#/g, "").replace(/\s/g, ",")
                )}`
              )
            }
            className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
          >
            <TwitterIcon size={16} />
            <span>X</span>
            <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
          </button>

          <button
            onClick={handleLineShare}
            className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
          >
            <LineIcon size={16} />
            <span>LINE</span>
            <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
          </button>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>

        {/* 功能選項 */}
        <div className="py-1">
          {shareData.imageUrl && (
            <button
              onClick={handleDownloadImage}
              className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
            >
              <Download className="w-4 h-4" />
              <span>{t("download_image")}</span>
            </button>
          )}

          <button
            onClick={handleCopyLink}
            className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
          >
            <Copy className="w-4 h-4" />
            <span>{t("copy_link")}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

interface ImageData {
  id: string;
  publishedImageId: string;
  url: string;
  reactions: { likes: number; dislikes: number; collections: number };
  userReaction: {
    like: boolean;
    dislike: boolean;
    collecting: boolean;
    comment: string;
  };
  shortId?: string;
}

// 主要的圖片卡片組件 - 修正版本
const ModernImageCard = ({
  image,
  prompt,
  onClick,
  handleReaction,
  handleCollectReaction,
  // onComment,
  onSelectForGeneration,
  isSelectedForGeneration = false,
  canSelectForGeneration = true,
  modelName,
  mediaKind,
}: {
  image: ImageData;
  prompt: string;
  onClick: () => void;
  handleReaction: (type: "like" | "dislike") => void;
  handleCollectReaction: () => void;
  // onComment: () => void;
  onSelectForGeneration?: () => void;
  isSelectedForGeneration?: boolean;
  canSelectForGeneration?: boolean;
  modelName?: string; // 新增：模型名稱
  mediaKind?: string;
}): JSX.Element => {
  const lng = useLocale();
  const t = useTranslations("drawing");
  const [isShareDropdownOpen, setIsShareDropdownOpen] = useState(false);
  const [isShared, setIsShared] = useState(false);

  // 🔥 修正：為桌面版和移動版分別創建 ref
  const desktopShareButtonRef = useRef<HTMLButtonElement>(null);
  const mobileShareButtonRef = useRef<HTMLButtonElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const isVideoAsset = mediaKind === "video" || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(image.url || "");
  const isAudioAsset = mediaKind === "audio" || /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(image.url || "");
  const [mediaUrl, setMediaUrl] = useState(() => getAuthenticatedMediaUrl(image.shortId, image.url));
  const mediaFallbackUrl = getMediaFallbackUrl(image.shortId, image.url);

  useEffect(() => {
    setMediaUrl(getAuthenticatedMediaUrl(image.shortId, image.url));
  }, [image.shortId, image.url]);

  const handleMediaLoadError = () => {
    if (mediaFallbackUrl && mediaUrl !== mediaFallbackUrl) {
      setMediaUrl(mediaFallbackUrl);
    }
  };

  // 檢測移動設備
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 準備分享數據
  const getShareData = () => ({
    url: `${process.env.NEXT_PUBLIC_URL}/${lng}/details/${image.publishedImageId}`,
    title: t("share_image_title"),
    description: prompt,
    hashtag: "#AIArt #GeneratedImage",
    imageUrl: image.url,
    modelName: modelName, // 使用傳入的模型名稱
    imageId: image.publishedImageId || image.shortId || image.id,
  });

  const handleShareComplete = (platform: string) => {
    setIsShared(true);

    if (platform === "copy") {
      showToast(t("share_link_copied"));
    } else if (platform === "download") {
      showToast(t("download_success"));
    } else {
      showToast(t("shared_successfully", { platform }));
    }

    setTimeout(() => setIsShared(false), 2000);
  };

  const toggleShareDropdown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsShareDropdownOpen(!isShareDropdownOpen);
  };

  // 🔥 修正：根據當前設備獲取正確的 buttonRef
  const getCurrentButtonRef = () => {
    return isMobile ? mobileShareButtonRef : desktopShareButtonRef;
  };

  return (
    <>
      <div className="transition-all duration-300 relative group">
        <div className="relative overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <div
            className="relative aspect-square cursor-pointer overflow-hidden rounded-2xl bg-[#edf6fd] dark:bg-[#13202a]"
            onClick={onClick}
          >
            {isVideoAsset ? (
              <div className="relative h-full w-full bg-[#13202a]">
                <video
                  src={mediaUrl}
                  poster={VIDEO_POSTER_URL}
                  onError={handleMediaLoadError}
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                  muted
                  playsInline
                  autoPlay
                  loop
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white shadow-lg backdrop-blur-sm sm:h-14 sm:w-14">
                    <Play className="ml-0.5 h-5 w-5 fill-current sm:h-6 sm:w-6" />
                  </div>
                </div>
              </div>
            ) : isAudioAsset ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#eef7fd] via-[#e6f3fc] to-[#dbeefd] px-4 pb-14 pt-6 text-center dark:from-[#162430] dark:via-[#1a2a37] dark:to-[#1f3240] sm:gap-3 sm:pb-16">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/75 text-[#466d8d] shadow-sm dark:bg-white/10 dark:text-[#d6efff] sm:h-14 sm:w-14">
                  <Music4 className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="line-clamp-2 text-xs font-medium text-[#35546e] dark:text-[#e8f6ff]">
                  Audio Result
                </div>
                <audio
                  src={mediaUrl}
                  controls
                  className="relative z-10 w-full max-w-[200px] sm:max-w-[220px]"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ) : (
              <img
                src={mediaUrl}
                alt={t("generated_image")}
                onError={handleMediaLoadError}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              />
            )}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-100 transition-opacity duration-300" />

            {/* 桌面版：右上角浮動按鈕 */}
            <div className="absolute right-3 top-3 hidden flex-col space-y-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:flex">
              {onSelectForGeneration && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectForGeneration();
                  }}
                  disabled={!canSelectForGeneration}
                    className={`pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-black/60 ${!canSelectForGeneration
                      ? 'cursor-not-allowed bg-gray-400/40 text-gray-300'
                      : isSelectedForGeneration
                        ? 'bg-[#53c7ff]/90 text-white'
                        : ''
                    }`}
                  title={
                    !canSelectForGeneration
                      ? t("model_not_support_image_to_image")
                      : isSelectedForGeneration
                        ? t("image_selected")
                        : t("select_image_for_style_transfer")
                  }
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <Palette strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                  </svg>
                </button>
              )}

              {/* 留言按鈕 10/08 先拿掉*/}
              {/* <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComment();
                }}
                className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 shadow-lg ${
                  image.userReaction?.comment
                    ? 'bg-emerald-500/90 text-white'
                    : 'bg-black/50 text-white hover:bg-black/70'
                }`}
                title={t("comment")}
              >
                <MessageCircle className="w-4 h-4" />
              </button> */}

              <ShareButton
                ref={desktopShareButtonRef}
                onClick={toggleShareDropdown}
                isActive={isShareDropdownOpen || isShared}
                title={t("share_image")}
              />
            </div>

            {/* 底部互動列 */}
            <div className="absolute inset-x-0 bottom-0">
              <div className="grid grid-cols-4 items-center gap-0.5 bg-black/10 px-1 py-1 backdrop-blur-[2px] transition-all duration-200 group-hover:bg-black/18 group-hover:backdrop-blur-[4px] md:flex md:justify-center md:gap-2 md:px-3 md:py-1.5">
                <div className="contents md:flex md:items-center md:justify-center md:gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReaction("like");
                    }}
                    className={`flex min-w-0 items-center justify-center gap-0.5 rounded-full px-1 py-1 text-[10px] transition-all duration-200 md:gap-1 md:px-2 md:text-[11px] ${image.userReaction?.like
                        ? "bg-blue-500/90 text-white"
                        : "bg-white/0 text-white/60 hover:bg-white/8 hover:text-white"
                      }`}
                    title={t("like")}
                  >
                    <ThumbsUp className={`h-3 w-3 shrink-0 md:h-3.5 md:w-3.5 ${image.userReaction?.like ? "fill-current" : ""}`} />
                    <span className="min-w-0 leading-none">{image.reactions?.likes || 0}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReaction("dislike");
                    }}
                    className={`flex min-w-0 items-center justify-center gap-0.5 rounded-full px-1 py-1 text-[10px] transition-all duration-200 md:gap-1 md:px-2 md:text-[11px] ${image.userReaction?.dislike
                        ? "bg-red-500/90 text-white"
                        : "bg-white/0 text-white/60 hover:bg-white/8 hover:text-white"
                      }`}
                    title={t("dislike")}
                  >
                    <ThumbsDown className={`h-3 w-3 shrink-0 md:h-3.5 md:w-3.5 ${image.userReaction?.dislike ? "fill-current" : ""}`} />
                    <span className="min-w-0 leading-none">{image.reactions?.dislikes || 0}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCollectReaction();
                    }}
                    className={`flex min-w-0 items-center justify-center gap-0.5 rounded-full px-1 py-1 text-[10px] transition-all duration-200 md:gap-1 md:px-2 md:text-[11px] ${image.userReaction?.collecting
                        ? "bg-pink-500/90 text-white"
                        : "bg-white/0 text-white/60 hover:bg-white/8 hover:text-white"
                      }`}
                    title={t("collect")}
                  >
                    <Heart className={`h-3 w-3 shrink-0 md:h-3.5 md:w-3.5 ${image.userReaction?.collecting ? "fill-current" : ""}`} />
                    <span className="min-w-0 leading-none">{image.reactions?.collections || 0}</span>
                  </button>
                </div>

                <div className="flex min-w-0 items-center justify-center md:hidden">
                  <ShareButton
                    ref={mobileShareButtonRef}
                    onClick={toggleShareDropdown}
                    isActive={isShareDropdownOpen || isShared}
                    isMobile={true}
                    title={t("share_image")}
                    className="w-full px-1"
                  />
                </div>
              </div>
            </div>

            {/* 移動版右上選圖 */}
            <div className="absolute right-3 top-3 md:hidden">
              {onSelectForGeneration && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectForGeneration();
                  }}
                  disabled={!canSelectForGeneration}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-sm transition-all duration-200 ${!canSelectForGeneration
                      ? "cursor-not-allowed bg-gray-400/40 text-gray-300"
                      : isSelectedForGeneration
                        ? "bg-[#53c7ff]/90 text-white"
                        : ""
                    }`}
                  title={
                    !canSelectForGeneration
                      ? t("model_not_support_image_to_image")
                      : isSelectedForGeneration
                        ? t("image_selected")
                        : t("select_image_for_style_transfer")
                  }
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <Palette strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                  </svg>
                </button>
              )}
            </div>

            {/* 舊手機版底欄移除，保留更乾淨的一條 */}
            <div className="hidden">
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 md:hidden">
                <div className="flex items-center justify-between">
                  {onSelectForGeneration && (
                    <button />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 分享下拉選單 */}
      <AnimatePresence>
        <ShareDropdown
          isOpen={isShareDropdownOpen}
          onClose={() => setIsShareDropdownOpen(false)}
          shareData={getShareData()}
          buttonRef={getCurrentButtonRef()}
          onShareComplete={handleShareComplete}
        />
      </AnimatePresence>
    </>
  );
};

export default ModernImageCard;
