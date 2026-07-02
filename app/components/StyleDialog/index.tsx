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
import { Style } from "@/app/services/styleSwitcherApi";
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
  createdAt?: string;
  updatedAt?: string;
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

// 參考圖片介面
interface ReferenceImage {
  url: string;
  alt?: string;
}

interface StyleDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  style: Style | null;
}

const StyleDetailsDialog: React.FC<StyleDetailsDialogProps> = ({
  isOpen,
  onClose,
  style,
}) => {
  const t = useTranslations("styles");
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "masonry">("grid");
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // 解析分類 - 後端已經給正確語系，直接解析即可
  const categories = useMemo((): SimpleCategory[] => {
    if (!style?.styleCategories) return [];

    try {
      let rawData = style.styleCategories;

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
  }, [style?.styleCategories]);

  // 解析圖片
  const allImages = useMemo((): string[] => {
    if (!style) return [];

    const images: string[] = [];

    // 封面圖
    if (style.cover) {
      try {
        // 如果 cover 已經是物件，直接使用；如果是字串，才解析
        const cover =
          typeof style.cover === "string"
            ? (JSON.parse(style.cover))
            : (style.cover);
        if (cover?.url) images.push(cover.url);
      } catch (error) {
        console.error("封面圖解析錯誤:", error);
      }
    }

    // 參考圖片
    if (style.reference) {
      try {
        const referenceData = style.reference as unknown;

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
  }, [style?.cover, style?.reference, style?.id]);

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

  const closeImageViewer = useCallback(() => {
    setSelectedImageIndex(null);
  }, []);

  const nextImage = useCallback(() => {
    if (selectedImageIndex !== null && selectedImageIndex < allImages.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  }, [selectedImageIndex, allImages.length]);

  const prevImage = useCallback(() => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  }, [selectedImageIndex]);

  // 鍵盤事件處理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (selectedImageIndex !== null) {
        switch (event.key) {
          case "Escape":
            closeImageViewer();
            break;
          case "ArrowRight":
            nextImage();
            break;
          case "ArrowLeft":
            prevImage();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedImageIndex, closeImageViewer, nextImage, prevImage]);

  // 獲取網格佈局
  const getGridLayout = useCallback(() => {
    if (isMobile) return "grid-cols-2";
    if (isTablet) return "grid-cols-3";
    return "grid-cols-4";
  }, [isMobile, isTablet]);

  // 圖片鍵值（用於強制重新渲染）
  const imagesKey = useMemo(() => {
    return `${style?.id}-${allImages.length}-${Date.now()}`;
  }, [style?.id, allImages.length]);

  if (!isOpen) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />

      {/* 主對話框 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* 背景遮罩 */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* 對話框內容 */}
        <div className="relative w-full max-w-6xl max-h-[90vh] bg-custom-white dark:bg-custom-white-dark rounded-2xl shadow-2xl overflow-hidden">
          {/* 標題列 */}
          <div className="flex items-center justify-between p-6 border-b border-custom-light-purple dark:border-custom-light-purple-dark">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="p-2 hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-bold text-custom-black dark:text-custom-black-dark">
                {style?.title || t("style_details")}
              </h2>
            </div>

            {/* 視圖模式切換 */}
            <div className="flex bg-custom-light-purple/30 dark:bg-custom-light-purple-dark/30 rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded transition-all duration-200 ${
                  viewMode === "grid"
                    ? "bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-white"
                    : "text-custom-black dark:text-custom-black-dark hover:bg-custom-light-purple/50 dark:hover:bg-custom-light-purple-dark/50"
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded transition-all duration-200 ${
                  viewMode === "list"
                    ? "bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-white"
                    : "text-custom-black dark:text-custom-black-dark hover:bg-custom-light-purple/50 dark:hover:bg-custom-light-purple-dark/50"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 內容區域 */}
          <div className="flex h-[calc(90vh-120px)]">
            {/* 左側資訊面板 */}
            <div className="content-scrollbar w-1/3 p-6 border-r border-custom-light-purple dark:border-custom-light-purple-dark overflow-y-auto">
              <div className="space-y-6">
                {/* 風格資訊 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-custom-black dark:text-custom-black-dark">
                    {t("style_description")}
                  </h3>
                  <p className="text-custom-black/70 dark:text-custom-black-dark/70">
                    {style?.description || t("no_description")}
                  </p>
                </div>

                {/* 分類標籤 */}
                {categories.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-custom-black dark:text-custom-black-dark">
                      {t("categories")}
                    </h4>
                    <SmartTagDisplay categories={categories} maxInitialTags={5} />
                  </div>
                )}

                {/* 詳細資訊 */}
                <div className="space-y-3">
                  <h4 className="font-medium text-custom-black dark:text-custom-black-dark">
                    {t("style_details")}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-custom-black/60 dark:text-custom-black-dark/60">
                        {t("style_id")}:
                      </span>
                      <span className="text-custom-black dark:text-custom-black-dark font-mono">
                        {style?.id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-custom-black/60 dark:text-custom-black-dark/60">
                        {t("style_created_at")}:
                      </span>
                      <span className="text-custom-black dark:text-custom-black-dark">
                        {style?.createdAt
                          ? new Date(style.createdAt).toLocaleDateString()
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-custom-black/60 dark:text-custom-black-dark/60">
                        {t("style_updated_at")}:
                      </span>
                      <span className="text-custom-black dark:text-custom-black-dark">
                        {style?.updatedAt
                          ? new Date(style.updatedAt).toLocaleDateString()
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 右側圖片展示 */}
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
                      t={t}
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
        </div>
      </div>

      {/* 圖片查看器 Modal */}
      {selectedImageIndex !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90">
          <div className="relative max-w-[90vw] max-h-[90vh]">
            {/* 關閉按鈕 */}
            <button
              onClick={closeImageViewer}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* 導航按鈕 */}
            {selectedImageIndex > 0 && (
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {selectedImageIndex < allImages.length - 1 && (
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* 圖片 */}
            <Image
              src={allImages[selectedImageIndex]}
              alt={`${style?.title} - ${selectedImageIndex + 1}`}
              width={1200}
              height={800}
              className="max-w-full max-h-[90vh] object-contain"
              priority
            />

            {/* 圖片計數 */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              {selectedImageIndex + 1} / {allImages.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// 圖片項目組件
const ImageItem: React.FC<{ 
  url: string; 
  index: number;
  t: (key: string, values?: Record<string, string | number>) => string;
}> = ({ url, index, t }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`group relative overflow-hidden rounded-xl transform transition-all duration-300 ease-out 
                  hover:scale-105 hover:shadow-2xl active:scale-95 will-change-transform cursor-pointer`}
      onClick={() => {
        // 這裡可以添加點擊處理邏輯
      }}
    >
      <Image
        src={url}
        alt={t("imageAlt", { index: index + 1 })}
        width={300}
        height={300}
        className="w-full transition-transform duration-500 ease-out group-hover:scale-110"
        style={{ height: "auto" }}
        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
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

      {/* 載入狀態 */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-custom-logo-purple border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* 錯誤狀態 */}
      {hasError && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <div className="text-gray-500 text-sm">{t("loadFailed")}</div>
        </div>
      )}
    </div>
  );
};

// 工具函數：取得分類名稱
const getCategoryName = (
  category: SimpleCategory,
  lng: string,
  tModels: (key: string) => string
): string => {
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
};

// 簡化的標籤顯示組件
const SmartTagDisplay: React.FC<{
  categories: SimpleCategory[];
  maxInitialTags?: number;
}> = ({ categories, maxInitialTags = 3 }) => {
  const t = useTranslations("styles");
  const tModels = useTranslations("models");
  const lng = useLocale();
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const shouldShowExpand = categories.length > maxInitialTags;
  const displayCategories = isTagsExpanded
    ? categories
    : categories.slice(0, maxInitialTags);
  const hiddenCount = categories.length - maxInitialTags;

  const toggleTags = () => {
    setIsTagsExpanded(!isTagsExpanded);
  };

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
          {getCategoryName(category, lng, tModels)}
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

export default StyleDetailsDialog; 
