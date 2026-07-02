import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Tag,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  EyeOff,
  Plus,
} from "lucide-react";
import Image from "next/image";
import { LoraModel, Media } from "@/payload-types";
import { useTranslations, useLocale } from "next-intl";

// 自訂滾動條樣式
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    transition: background 0.2s ease;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
  }
  
  .custom-scrollbar::-webkit-scrollbar-corner {
    background: transparent;
  }

  /* 動畫樣式 */
  .fade-in-up {
    animation: fadeInUp 0.6s ease-out both;
  }

  .stagger-1 { animation-delay: 0ms; }
  .stagger-2 { animation-delay: 100ms; }
  .stagger-3 { animation-delay: 200ms; }
  .stagger-4 { animation-delay: 300ms; }
  .stagger-5 { animation-delay: 400ms; }
  .stagger-6 { animation-delay: 500ms; }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .fade-in {
    animation: fadeIn 0.3s ease-out both;
  }
`;

// 簡化的分類介面
interface SimpleCategory {
  id: string;
  name: string | { [key: string]: string };
  createdAt: string;
  updatedAt: string;
}

// 中文名稱到翻譯 key 的映射表
const chineseNameToKeyMap: { [key: string]: string } = {
  "極簡風格": "minimalist",
  "少女風格": "girl_style",
  "賽博朋克": "cyberpunk",
  "羊毛氈": "felted_wool",
  "樂高": "lego",
  "寫實": "realistic",
  "油畫": "oil_painting",
  "陶土": "clay",
  "水墨畫": "ink_painting",
  "鮮豔色彩": "vivid_colors",
  "黑白": "black_and_white",
  "手繪": "hand_drawn",
  "美式漫畫": "american_comic",
  "卡通": "cartoon",
  "暗色調": "dark_tone",
  "動物": "animal",
  "柔和色彩": "soft_colors",
  "食物": "food",
  "物件": "object",
  "建築": "architecture",
  "風景": "landscape",
  "漫畫": "manga",
  "3D": "3d",
  "角色": "character",
  "2D": "2d",
};

export interface ReferenceImage {
  id: string;
  shortId: string;
  url: string;
  is_published: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ModelDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  model: LoraModel | null;
}

const ModelDetailsDialog: React.FC<ModelDetailsDialogProps> = ({
  isOpen,
  onClose,
  model,
}) => {
  const t = useTranslations("modelDetailsDialog");
  const tModels = useTranslations("models");
  const lng = useLocale();

  // UI 狀態
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<"masonry" | "grid">("masonry");
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [imagesKey, setImagesKey] = useState(0);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);

  // === 簡化的數據解析 ===

  // 解析分類 - 後端已經給正確語系，直接解析即可
  const categories = useMemo((): SimpleCategory[] => {
    if (!model?.loraCategories) return [];

    try {
      let rawData = model.loraCategories;

      // 如果是字串，需要解析；如果已經是陣列，直接使用
      if (typeof rawData === "string") {
        // 移除外層引號
        if (rawData.startsWith('"') && rawData.endsWith('"')) {
          rawData = rawData.slice(1, -1);
        }

        // 處理轉義字符
        const unescaped = rawData.replace(/\\\"/g, '"').replace(/\\\\/g, "\\");

        // 解析 JSON
        const parsed = JSON.parse(unescaped);

        if (Array.isArray(parsed)) {
          return parsed.map((cat) => ({
            id: cat.id,
            name: cat.name, // 後端已經給正確語系的名稱
            createdAt: cat.createdAt,
            updatedAt: cat.updatedAt,
          }));
        }
      } else if (Array.isArray(rawData)) {
        // 如果已經是陣列，直接使用
        return rawData.map((cat) => ({
          id: cat.id,
          name: cat.name,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt,
        }));
      }

      return [];
    } catch (error) {
      console.error("分類解析錯誤:", error);
      return [];
    }
  }, [model?.loraCategories]);

  // 解析圖片
  const allImages = useMemo((): string[] => {
    if (!model) return [];

    const images: string[] = [];

    // 封面圖
    if (model.cover) {
      try {
        // 如果 cover 已經是物件，直接使用；如果是字串，才解析
        const cover =
          typeof model.cover === "string"
            ? (JSON.parse(model.cover) as Media)
            : (model.cover as Media);
        if (cover?.url) images.push(cover.url);
      } catch (error) {
        console.error("封面圖解析錯誤:", error);
      }
    }

    // 參考圖片
    if (model.reference) {
      try {
        const referenceData = model.reference as unknown;

        if (typeof referenceData === "string") {
          // 如果是字串，需要解析
          const parsed = referenceData
            .replace(/^"|"$/g, "")
            .replace(/\\\"/g, '"')
            .replace(/\\\\/g, "\\");
          const refs = JSON.parse(parsed) as ReferenceImage[];

          if (Array.isArray(refs)) {
            refs.forEach((img) => {
              if (img?.url) images.push(img.url);
            });
          }
        } else if (Array.isArray(referenceData)) {
          // 如果已經是陣列，直接使用
          referenceData.forEach((img: { url: string }) => {
            if (img?.url) images.push(img.url);
          });
        }
      } catch (error) {
        console.error("參考圖片解析錯誤:", error);
      }
    }

    return images;
  }, [model?.cover, model?.reference, model?.id]);

  // === UI 響應邏輯 ===

  // 響應式檢測
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // 樣式注入
  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = scrollbarStyles;
    document.head.appendChild(styleElement);
    return () => {
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  // 重置狀態當 model 變化時
  useEffect(() => {
    if (!model) {
      setCurrentImageIndex(0);
      setLightboxOpen(false);
      setImageLoaded(false);
      setImagesKey((prev) => prev + 1);
      setIsTagsExpanded(false);
    } else {
      setImagesKey((prev) => prev + 1);
    }
  }, [model?.id]);

  // === 事件處理函數 ===

  const openLightbox = useCallback(
    (index: number) => {
      setCurrentImageIndex(index);
      setImageLoaded(false);
      setLightboxOpen(true);

      // 預載入鄰近圖片
      const preloadImage = (imgIndex: number) => {
        if (imgIndex >= 0 && imgIndex < allImages.length) {
          const img = new window.Image();
          img.src = allImages[imgIndex];
        }
      };

      preloadImage(index - 1);
      preloadImage(index + 1);
    },
    [allImages]
  );

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setImageLoaded(false);
  }, []);

  const toggleTags = useCallback(() => {
    setIsTagsExpanded((prev) => !prev);
  }, []);

  const nextImage = useCallback(() => {
    if (isAnimating || allImages.length <= 1) return;
    setIsAnimating(true);
    setImageLoaded(false);

    setTimeout(() => {
      setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
      setTimeout(() => setIsAnimating(false), 150);
    }, 150);
  }, [allImages.length, isAnimating]);

  const prevImage = useCallback(() => {
    if (isAnimating || allImages.length <= 1) return;
    setIsAnimating(true);
    setImageLoaded(false);

    setTimeout(() => {
      setCurrentImageIndex(
        (prev) => (prev - 1 + allImages.length) % allImages.length
      );
      setTimeout(() => setIsAnimating(false), 150);
    }, 150);
  }, [allImages.length, isAnimating]);

  // 觸控滑動支援
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && allImages.length > 1) {
      nextImage();
    }
    if (isRightSwipe && allImages.length > 1) {
      prevImage();
    }
  };

  // 鍵盤控制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxOpen) {
        if (e.key === "Escape") {
          closeLightbox();
        } else if (e.key === "ArrowLeft") {
          prevImage();
        } else if (e.key === "ArrowRight") {
          nextImage();
        }
      } else if (isOpen && e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, lightboxOpen, onClose, closeLightbox, prevImage, nextImage]);

  // 防止背景滾動
  useEffect(() => {
    if (isOpen || lightboxOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, lightboxOpen]);

  // 獲取網格佈局類名
  const getGridLayout = () => {
    if (viewMode === "grid") {
      if (isMobile) return "grid-cols-2";
      if (isTablet) return "grid-cols-3";
      return "grid-cols-4";
    }
    // Masonry 佈局
    if (isMobile) return "columns-2";
    if (isTablet) return "columns-3";
    return "columns-4";
  };

  // === 組件定義 ===

  // 圖片組件
  const ImageItem = ({ url, index }: { url: string; index: number }) => {
    const staggerClass = `stagger-${Math.min((index % 6) + 1, 6)}`;

    return (
      <div
        key={`${imagesKey}-${index}`}
        className={`${
          viewMode === "grid"
            ? "aspect-square"
            : "mb-3 sm:mb-4 break-inside-avoid"
        } 
                   cursor-pointer group fade-in-up ${staggerClass}`}
        onClick={() => openLightbox(index)}
      >
        <div
          className={`relative overflow-hidden rounded-xl transform transition-all duration-300 ease-out 
                        hover:scale-105 hover:shadow-2xl active:scale-95 will-change-transform
                        ${viewMode === "grid" ? "h-full" : ""}`}
        >
          <Image
            src={url}
            alt={t("imageAlt", {
              modelTitle: model?.title || "",
              index: index + 1,
            })}
            width={viewMode === "grid" ? 300 : 400}
            height={viewMode === "grid" ? 300 : 400}
            className={`w-full transition-transform duration-500 ease-out group-hover:scale-110
                       ${viewMode === "grid" ? "h-full object-cover" : ""}`}
            style={viewMode === "masonry" ? { height: "auto" } : {}}
            sizes={isMobile ? "50vw" : isTablet ? "33vw" : "25vw"}
            loading="lazy"
          />

          {/* Hover 效果 */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent 
                          opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out 
                          flex items-center justify-center backdrop-blur-[1px]"
          >
            <div
              className="bg-white/20 backdrop-blur-md rounded-lg px-3 py-2 text-white text-xs sm:text-sm 
                           font-medium transform translate-y-2 group-hover:translate-y-0 
                           transition-transform duration-300 ease-out"
            >
              <span className="hidden sm:inline">{t("clickToEnlarge")}</span>
              <span className="sm:hidden">{t("view")}</span>
            </div>
          </div>

          {/* 光澤效果 */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent 
                          opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out pointer-events-none"
          />
        </div>
      </div>
    );
  };

  // 工具函數：取得分類名稱
  const getCategoryName = useCallback(
    (category: SimpleCategory): string => {
      if (!category || !category.name) {
        return category?.id || "";
      }

      // 當 category.name 是字串時（通常是中文），嘗試從多語系檔案查找
      if (typeof category.name === "string") {
        // 如果當前語言是中文，直接回傳
        if (lng === "zh-TW") {
          return category.name;
        }

        // 非中文環境下，優先根據中文名稱查找對應的翻譯 key
        const translationKey = chineseNameToKeyMap[category.name];
        if (translationKey) {
          const translated = tModels(`categories.${translationKey}`);
          // 如果翻譯存在且不等於 key，則使用翻譯
          if (translated && translated !== `categories.${translationKey}`) {
            return translated;
          }
        }

        // 如果找不到映射，嘗試使用 category.id 查找（後備方案）
        if (category.id) {
          const normalizedId = category.id.replace(/-/g, "_").replace(/^cat_/, "");
          const idTranslationKey = `categories.${normalizedId}`;
          const idTranslated = tModels(idTranslationKey);
          if (idTranslated && idTranslated !== idTranslationKey) {
            return idTranslated;
          }
        }

        // 最後回傳原字串（中文）
        return category.name;
      }

      // 如果 category.name 是物件
      if (typeof category.name === "object" && category.name !== null) {
        // 優先使用後端提供的當前語言翻譯
        if (category.name[lng]) {
          return category.name[lng];
        }

        // 如果後端沒有提供當前語言翻譯，優先從多語系檔案中查找
        if (category.id) {
          const normalizedId = category.id.replace(/-/g, "_").replace(/^cat_/, "");
          const translationKey = `categories.${normalizedId}`;
          const translated = tModels(translationKey);
          if (translated && translated !== translationKey) {
            return translated;
          }
        }

        // 最後的後備：使用第一個可用的翻譯值
        const availableValues = Object.values(category.name).filter(
          (value) => typeof value === "string" && value.trim() !== ""
        );
        if (availableValues.length > 0) {
          return availableValues[0];
        }
      }

      return category.id || "";
    },
    [lng, tModels]
  );

  // 簡化的標籤顯示組件
  const SmartTagDisplay: React.FC<{
    categories: SimpleCategory[];
    maxInitialTags?: number;
  }> = ({ categories, maxInitialTags = 3 }) => {
    const shouldShowExpand = categories.length > maxInitialTags;
    const displayCategories = isTagsExpanded
      ? categories
      : categories.slice(0, maxInitialTags);
    const hiddenCount = categories.length - maxInitialTags;

    return (
      <div className="flex gap-1 sm:gap-2 flex-wrap">
        {displayCategories.map((category, index) => (
          <span
            key={`${category.id}-${index}`}
            className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full 
                     bg-gradient-to-r from-white/10 to-white/20 
                     text-white 
                     border border-white/20
                     hover:from-white/20 hover:to-white/30
                     transition-all duration-200 cursor-default"
          >
            <Tag className="w-3 h-3 mr-1" />
            {getCategoryName(category)}
          </span>
        ))}

        {shouldShowExpand && (
          <button
            onClick={toggleTags}
            className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full
                     bg-gray-700 hover:bg-gray-600
                     text-white
                     border border-gray-600
                     transition-all duration-200 group"
          >
            {isTagsExpanded ? (
              <>
                <EyeOff className="w-3 h-3 mr-1 group-hover:scale-110 transition-transform" />
                {t("collapse")}
              </>
            ) : (
              <>
                <Plus className="w-3 h-3 mr-1 group-hover:scale-110 transition-transform" />
                {hiddenCount}
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 主對話框 */}
      <div
        className={`fixed inset-0 z-[60] bg-black/90 flex flex-col transition-all duration-300 fade-in
                      ${isOpen ? "opacity-100" : "opacity-0"}`}
      >
        {/* 標題列 */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-700 fade-in">
          <div className="flex-1 min-w-0 pr-4">
            <h1
              className={`${
                isMobile ? "text-lg" : isTablet ? "text-xl" : "text-2xl"
              } 
                           font-bold text-white mb-2 truncate`}
            >
              {model?.title}
            </h1>

            {/* 分類標籤 */}
            {categories.length > 0 && (
              <SmartTagDisplay
                categories={categories}
                maxInitialTags={isMobile ? 2 : isTablet ? 3 : 5}
              />
            )}
          </div>

          {/* 視圖切換和關閉按鈕 */}
          <div className="flex items-center gap-2">
            {/* 視圖切換 - 僅桌面版 */}
            {!isMobile && (
              <div className="flex bg-gray-800 rounded-lg p-1 mr-2">
                <button
                  onClick={() => setViewMode("masonry")}
                  className={`p-2 rounded transition-all duration-200 ${
                    viewMode === "masonry"
                      ? "bg-gray-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                  title={t("masonry_layout")}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded transition-all duration-200 ${
                    viewMode === "grid"
                      ? "bg-gray-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                  title={t("grid_layout")}
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded text-white transition-colors duration-200 flex-shrink-0"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* 圖片展示區域 */}
        <div className="content-scrollbar flex-1 overflow-auto p-3 sm:p-4 md:p-6">
          {allImages.length > 0 ? (
            <div
              className={
                viewMode === "grid"
                  ? `grid ${getGridLayout()} gap-3 sm:gap-4`
                  : `${getGridLayout()} gap-3 sm:gap-4`
              }
            >
              {allImages.map((url, index) => (
                <ImageItem
                  key={`${imagesKey}-${index}`}
                  url={url}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 mt-20 fade-in">
              <div
                className={`${
                  isMobile ? "w-12 h-12" : "w-16 h-16"
                } mx-auto mb-4 opacity-50 
                             rounded-full bg-gray-700 flex items-center justify-center`}
              >
                <Tag className={`${isMobile ? "w-6 h-6" : "w-8 h-8"}`} />
              </div>
              <p className={isMobile ? "text-sm" : "text-base"}>
                {t("noImagesAvailable")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 圖片查看器 Modal */}
      {lightboxOpen && (
        <div
          className={`fixed inset-0 z-[70] bg-black/95 backdrop-blur-sm flex items-center justify-center 
                        transition-all duration-500 ease-out fade-in
                        ${lightboxOpen ? "opacity-100" : "opacity-0"}`}
        >
          {/* 關閉按鈕 */}
          <button
            onClick={closeLightbox}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 p-2 sm:p-3 
                     bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full 
                     text-white/80 hover:text-white transition-all duration-300 ease-out 
                     touch-manipulation group"
            aria-label={t("closeLightbox")}
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200 group-hover:scale-110" />
          </button>

          {/* 圖片計數 */}
          <div
            className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 px-3 py-2 
                         bg-black/50 backdrop-blur-md rounded-lg text-white/90 
                         text-xs sm:text-sm font-medium border border-white/10"
          >
            <span className="font-mono">{currentImageIndex + 1}</span>
            <span className="mx-1 opacity-60">/</span>
            <span className="font-mono">{allImages.length}</span>
          </div>

          {/* 主圖片容器 */}
          <div
            className="relative w-full h-full flex items-center justify-center p-4 sm:p-8"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* 載入指示器 */}
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}

            <div
              className={`relative max-w-full max-h-full transition-all duration-500 ease-out will-change-transform ${
                isAnimating
                  ? "scale-95 opacity-60 blur-sm"
                  : "scale-100 opacity-100 blur-0"
              } ${!imageLoaded ? "opacity-0" : "opacity-100"}`}
            >
              <Image
                src={allImages[currentImageIndex]}
                alt={t("lightboxImageAlt", { index: currentImageIndex + 1 })}
                width={1200}
                height={800}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                style={{
                  maxHeight: "calc(100vh - 8rem)",
                  maxWidth: "calc(100vw - 2rem)",
                  filter: "drop-shadow(0 25px 50px rgba(0, 0, 0, 0.5))",
                }}
                priority
                sizes="100vw"
                onLoad={() => setImageLoaded(true)}
              />
            </div>
          </div>

          {/* 導航按鈕 - 桌面版 */}
          {allImages.length > 1 && !isMobile && (
            <>
              <button
                onClick={prevImage}
                disabled={isAnimating}
                className="absolute left-3 lg:left-6 top-1/2 -translate-y-1/2 p-3 lg:p-4 
                         bg-black/30 hover:bg-black/50 backdrop-blur-md disabled:opacity-30 
                         disabled:cursor-not-allowed rounded-full text-white/80 hover:text-white 
                         transition-all duration-300 ease-out touch-manipulation group will-change-transform"
                aria-label={t("previousImage")}
              >
                <ChevronLeft className="w-6 h-6 lg:w-7 lg:h-7 transition-transform duration-200 group-hover:-translate-x-0.5" />
              </button>

              <button
                onClick={nextImage}
                disabled={isAnimating}
                className="absolute right-3 lg:right-6 top-1/2 -translate-y-1/2 p-3 lg:p-4 
                         bg-black/30 hover:bg-black/50 backdrop-blur-md disabled:opacity-30 
                         disabled:cursor-not-allowed rounded-full text-white/80 hover:text-white 
                         transition-all duration-300 ease-out touch-manipulation group will-change-transform"
                aria-label={t("nextImage")}
              >
                <ChevronRight className="w-6 h-6 lg:w-7 lg:h-7 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </>
          )}

          {/* 手機滑動提示 */}
          {allImages.length > 1 && isMobile && (
            <div
              className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 
                           bg-black/50 backdrop-blur-md rounded-full text-white/70 text-xs 
                           text-center border border-white/10"
            >
              <span className="inline-block animate-pulse">
                {t("swipeHint")}
              </span>
            </div>
          )}

          {/* 縮略圖導航 */}
          {allImages.length > 1 && (
            <div
              className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1 sm:gap-2 
                           bg-black/50 backdrop-blur-md rounded-xl p-2 sm:p-3 max-w-[90vw] 
                           overflow-x-auto custom-scrollbar border border-white/10"
            >
              {allImages.map((url, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (!isAnimating) {
                      setImageLoaded(false);
                      setCurrentImageIndex(i);
                    }
                  }}
                  disabled={isAnimating}
                  className={`relative ${
                    isMobile ? "w-8 h-8" : "w-10 h-10 sm:w-12 sm:h-12"
                  } 
                             rounded-lg overflow-hidden flex-shrink-0 transition-all duration-300 ease-out 
                             touch-manipulation will-change-transform ${
                               i === currentImageIndex
                                 ? "ring-2 ring-white scale-110 shadow-lg"
                                 : "opacity-60 hover:opacity-100 hover:scale-105"
                             } ${isAnimating ? "pointer-events-none" : ""}`}
                  aria-label={t("thumbnailAlt", { index: i + 1 })}
                >
                  <Image
                    src={url}
                    alt={t("thumbnailAlt", { index: i + 1 })}
                    width={isMobile ? 32 : 48}
                    height={isMobile ? 32 : 48}
                    className="w-full h-full object-cover transition-transform duration-300"
                    sizes={isMobile ? "32px" : "48px"}
                  />
                  {/* 選中指示器 */}
                  {i === currentImageIndex && (
                    <div className="absolute inset-0 bg-white/20 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* 點擊背景關閉 */}
          <div
            className="absolute inset-0 -z-10 cursor-pointer"
            onClick={closeLightbox}
            aria-label={t("closeLightbox")}
          />
        </div>
      )}
    </>
  );
};

export default ModelDetailsDialog;
