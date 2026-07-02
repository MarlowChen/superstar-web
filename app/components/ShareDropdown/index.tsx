import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Share2, Copy, Download, ExternalLink } from 'lucide-react';
import { ActionButton } from '../ActionButton';
import { useTranslations } from "next-intl";
import { showToast } from "../Drawing/CustomToast";
import { FaSquareXTwitter } from "react-icons/fa6";
import { getDownloadFileName } from "@/utils/getDownloadFileName";

// 專用於 ShareDropdown 的浮水印函數
const addShareWatermark = async (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) => {
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 342 424">
    <defs>
      <style>
        path { fill: #ffffff; }
      </style>
    </defs>
    <g transform="translate(0.000000,424.000000) scale(0.100000,-0.100000)">
      <path d="M1630 3789 c-335 -34 -629 -216 -828 -510 -51 -76 -118 -218 -151 -319 -59 -187 -75 -273 -96 -526 -8 -99 -28 -341 -45 -539 -17 -198 -41 -493 -55 -655 -29 -347 -53 -612 -60 -693 l-6 -58 91 3 91 3 133 295 c74 162 146 324 162 360 53 124 175 385 183 393 5 5 30 -3 57 -17 147 -75 304 -134 435 -161 247 -52 474 -15 768 126 114 54 141 62 141 39 0 -5 13 -37 29 -72 80 -174 131 -288 131 -292 0 -4 94 -217 149 -340 11 -22 38 -84 61 -136 23 -52 53 -119 65 -147 16 -35 30 -53 42 -54 110 -3 168 -1 168 7 -1 20 -18 224 -46 549 -16 187 -51 608 -79 935 -55 651 -54 645 -81 776 -120 598 -498 986 -1007 1034 -119 11 -131 11 -252 -1z m286 -558 c255 -66 453 -277 509 -542 75 -357 -166 -724 -529 -804 -113 -25 -274 -17 -376 19 -222 78 -388 253 -444 466 -80 301 39 607 301 777 58 38 178 85 243 96 71 12 229 6 296 -12z"/>
      <path d="M1680 2861 c-96 -20 -182 -89 -224 -180 -16 -35 -21 -65 -21 -126 0 -74 3 -85 38 -147 58 -104 148 -160 261 -161 159 -2 273 88 312 245 16 63 16 73 1 133 -18 71 -61 142 -105 173 -80 57 -180 81 -262 63z"/>
    </g>
  </svg>`;

  const logoImg = new Image();
  await new Promise((resolve, reject) => {
    logoImg.onload = resolve;
    logoImg.onerror = reject;
    logoImg.src = "data:image/svg+xml;base64," + btoa(logoSvg);
  });

  const margin = 30;
  const logoWidth = 38;
  const logoHeight = 38;
  const x = width - logoWidth - margin - 130;
  const y = height - logoHeight - margin;

  ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);

  ctx.font = "bold 34px Arial";
  ctx.fillStyle = "#ffffff"; // 您可以在這裡調整文字顏色
  ctx.textBaseline = "middle";
  ctx.fillText("superstar", x + logoWidth + 3, y + logoHeight / 2 + 3);
};
// LINE 圖示 - 簡潔設計
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

// Facebook 圖示 - 簡潔設計
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

// Twitter 圖示 - 簡潔設計
const TwitterIcon = ({ size = 16 }: { size?: number }) => (
  <FaSquareXTwitter
    size={size}
    className="text-[#000000] dark:text-white rounded"
  />
);

interface ShareDropdownProps {
  shareUrl?: string;
  title?: string;
  description?: string;
  hashtag?: string;
  imageUrl?: string;
  modelName?: string; // 新增：模型名稱（用於檔案名稱）
  imageId?: string | number; // 新增：圖片ID（用於檔案名稱）
  onCopyLink?: () => void;
  onShareComplete?: (platform: string) => void;
  className?: string;
  enableWatermark?: boolean; // 新增：是否啟用浮水印
  iconSize?: string; // 新增：圖示大小
  usePortal?: boolean; // 新增：是否使用 Portal 渲染
}

export const ShareDropdown: React.FC<ShareDropdownProps> = ({
  shareUrl = typeof window !== 'undefined' ? window.location.href : '',
  title = '查看這個精彩的 AI 生成圖片！',
  description = '這是一個令人驚豔的 AI 創作',
  hashtag = '#AI #ArtificialIntelligence',
  imageUrl,
  modelName,
  imageId,
  onShareComplete,
  className = "",
  enableWatermark = false, // 預設不啟用浮水印
  iconSize = "w-4 h-4", // 預設圖示大小
  usePortal = false, // 預設不使用 Portal
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top?: number; bottom?: number; left: number }>({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations("share");

  // 計算下拉選單位置（用於 Portal）
  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 300; // 預估下拉選單高度
      
      // viewer / 浮動工具列裡優先往上，避免被底部資訊卡或工具列擋到
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceAbove > dropdownHeight || spaceAbove > spaceBelow) {
        // 向上展開
        setDropdownPosition({
          bottom: viewportHeight - rect.top + 12,
          left: rect.right - 220 // 220px 是 min-w-[220px]
        });
      } else {
        // 向下展開
        setDropdownPosition({
          top: rect.bottom + 12,
          bottom: undefined,
          left: rect.right - 220
        });
      }
    }
  };
  // 點擊外部關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 當下拉選單打開時計算位置（僅 Portal 模式）
  useEffect(() => {
    if (isOpen && usePortal) {
      calculatePosition();
    }
  }, [isOpen, usePortal]);

  // 主要分享功能 - Web Share API
  const handleNativeShare = async () => {
    if (!('share' in navigator)) {
      handleCopyLink();
      return;
    }

    try {
      const shareData: ShareData = {
        title,
        text: description,
        url: shareUrl,
      };

      await navigator.share(shareData);
      setIsOpen(false);
      setIsShared(true);
      onShareComplete?.('native');
      setTimeout(() => setIsShared(false), 2000);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handleCopyLink();
      }
    }
  };

  // LINE 分享
  const handleLineShare = () => {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const shareText = `${title}\n\n${description}\n\n${shareUrl}`;
    
    if (isMobile) {
      const lineAppUrl = `https://line.me/R/share?text=${encodeURIComponent(shareText)}`;
      window.location.href = lineAppUrl;
    } else {
      const lineWebUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`${title}\n\n${description}`)}`;
      window.open(lineWebUrl, '_blank', 'width=500,height=500');
    }
    
    setIsOpen(false);
    setIsShared(true);
    onShareComplete?.('line');
    setTimeout(() => setIsShared(false), 2000);
  };

  // 複製連結
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsOpen(false);
      setIsShared(true);
      // 只調用 onShareComplete，避免重複顯示訊息
      // 如果父組件需要執行額外的複製邏輯，可以在 onShareComplete 回調中處理
      onShareComplete?.('copy');
      setTimeout(() => setIsShared(false), 2000);
    } catch (err) {
      console.error('複製失敗:', err);
    }
  };

  // 下載圖片
  const handleDownloadImage = async () => {
    if (!imageUrl) return;

    try {
      setIsOpen(false);
      
      if (enableWatermark) {
        // 啟用浮水印的下載方式
        await downloadImageWithWatermark();
      } else {
        // 原始下載方式（無浮水印）
        await downloadImageOriginal();
      }
      
    } catch (error) {
      console.error("Download failed:", error);
      showToast(t("downloadFailed"), true);
    }
  };

  // 原始下載方式（無浮水印）
  const downloadImageOriginal = async () => {
    // 使用統一的檔案名稱格式，包含模型編號
    let fileName: string;
    if (modelName && imageId) {
      fileName = getDownloadFileName(modelName, imageId);
    } else {
      // 如果沒有提供模型名稱和圖片ID，使用備用格式
      fileName = `superstar-unknown-${Date.now()}.jpg`;
    }
    
    // 使用改進的下載函數，iOS Safari 將顯示分享面板
    const { downloadImage: downloadImageHelper } = await import('@/utils/downloadHelper');
    const result = await downloadImageHelper(imageUrl!, fileName);
    
    if (result.success) {
      if (result.method === 'share') {
        showToast(t("imageSaveHint") || "請選擇「儲存圖片」保存到相簿");
      } else {
        showToast(t("downloadSuccess"));
      }
    } else {
      throw new Error('Download failed');
    }
  };

  // 帶浮水印的下載方式
  const downloadImageWithWatermark = async () => {
    // 創建一個隱藏的 canvas 來處理圖片
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('無法創建 canvas context');

    // 載入圖片
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl!;
    });

    // 設置 canvas 尺寸
    canvas.width = img.width;
    canvas.height = img.height;

    // 繪製圖片
    ctx.drawImage(img, 0, 0);
    
    // 添加浮水印
    await addShareWatermark(ctx, img.width, img.height);

    // 使用統一的檔案名稱格式，包含模型編號
    let fileName: string;
    if (modelName && imageId) {
      // 在檔案名稱中添加 -watermarked 標記
      const baseFileName = getDownloadFileName(modelName, imageId);
      fileName = baseFileName.replace('.jpg', '-watermarked.jpg');
    } else {
      // 如果沒有提供模型名稱和圖片ID，使用備用格式
      fileName = `superstar-unknown-${Date.now()}-watermarked.jpg`;
    }
    
    // 使用改進的 Canvas 下載函數
    const { downloadImageFromCanvas } = await import('@/utils/downloadHelper');
    const result = await downloadImageFromCanvas(canvas, fileName, 0.95);
    
    if (result.success) {
      if (result.method === 'share') {
        showToast(t("imageSaveHint") || "請選擇「儲存圖片」保存到相簿");
      } else {
        showToast(t("downloadSuccess"));
      }
    } else {
      throw new Error('Download failed');
    }
  };

  // 統一的社群分享處理
  const handleSocialShareComplete = (platform: string) => {
    setIsOpen(false);
    setIsShared(true);
    onShareComplete?.(platform);
    setTimeout(() => setIsShared(false), 2000);
  };

  // 渲染下拉選單內容
  const renderDropdown = () => (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          className={usePortal 
            ? "fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-2 min-w-[220px] overflow-hidden"
            : "absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-2 min-w-[220px] overflow-hidden"
          }
          style={usePortal ? { 
            top: dropdownPosition.top,
            bottom: dropdownPosition.bottom,
            left: dropdownPosition.left,
            maxHeight: 'calc(100vh - 100px)'
          } : {}}
          onClick={(e) => e.stopPropagation()}
        >
            {/* 標題 */}
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100"> {t("share_image")} </h3>
            </div>

            {/* 原生分享 */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <>
                <button
                  onClick={handleNativeShare}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
                  title={t("system_share")}
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
              {/* Facebook */}
              <button
                onClick={() => {
                  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&hashtag=${encodeURIComponent(hashtag)}`;
                  window.open(facebookUrl, '_blank', 'width=600,height=400');
                  handleSocialShareComplete('facebook');
                }}
                className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
                title={t("share_to_facebook")}
              >
                <FacebookIcon size={16} />
                <span>Facebook</span>
                <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
              </button>

              {/* Twitter */}
              <button
                onClick={() => {
                  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`${title}\n\n${description}`)}&hashtags=${encodeURIComponent(hashtag.replace(/#/g, '').replace(/\s/g, ','))}`;
                  window.open(twitterUrl, '_blank', 'width=600,height=400');
                  handleSocialShareComplete('twitter');
                }}
                className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
                title={t("share_to_twitter")}
              >
                <TwitterIcon size={16} />
                <span>X</span>
                <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
              </button>

              {/* LINE */}
              <button
                onClick={handleLineShare}
                className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
                title={t("share_to_line")}
              >
                <LineIcon size={16} />
                <span>LINE</span>
                <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
              </button>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>

            {/* 功能選項 */}
            <div className="py-1">
              {/* 下載圖片 */}
              {imageUrl && (
                <button
                  onClick={handleDownloadImage}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
                  title={t("download_image")}
                >
                  <Download className="w-4 h-4" />
                  <span>{t("download_image")}</span>
                </button>
              )}

              {/* 複製連結 */}
              <button
                onClick={handleCopyLink}
                className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 text-gray-700 dark:text-gray-300"
                title={t("copy_link")}
              >
                <Copy className="w-4 h-4" />
                <span>{t("copy_link")}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {className ? (
        // 自定義按鈕樣式（用於圖片卡片浮動按鈕）
        <button
          ref={buttonRef}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`${className} ${isShared ? 'bg-green-500/90 text-white shadow-lg' : ''}`}
          title={t("share_image")}
        >
          <Share2 className={iconSize} />
        </button>
      ) : (
        // 標準 ActionButton 樣式（用於Modal）
        <ActionButton
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          icon={Share2}
          title={t("share_image")}
          isActive={isOpen || isShared}
          activeColor={isShared ? "text-green-500" : "text-custom-logo-purple"}
        />
      )}
      
      {/* 使用 Portal 渲染到 body 或正常渲染 */}
      {usePortal && typeof window !== 'undefined' 
        ? createPortal(renderDropdown(), document.body)
        : renderDropdown()
      }
    </div>
  );
};
