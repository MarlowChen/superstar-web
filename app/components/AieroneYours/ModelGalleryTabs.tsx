"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { showToast } from "../CustomToast";
import { useTranslations } from "next-intl";
import { Download, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { getDownloadFileName } from "@/utils/getDownloadFileName";
import { useAuth } from "@/app/context/AuthContext";

interface ModelImage { 
  id: string; 
  url: string; 
  prompt: string;
}

interface ModelConfig {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  cdnFolder: string; // CDN 資料夾名稱
  imageCount: number; // 圖片數量
  imagePrefix: string; // 檔名前綴
}

const SCROLL_STEP = 260;

/** 設定要鎖住的多個 model id */
const LOCKED_MODEL_IDS: string[] = [
  "68ebbb87a14057a087bf43c9",
  "68eb54598cab2cac2b49f873",
];

const HEAVY_BLUR = "blur-[3px] md:blur-[3px]";
const CDN_BASE_URL = "https://psf.nyc3.cdn.digitaloceanspaces.com/covers/yours";

const ModelGalleryTabs: React.FC = () => {
  const t = useTranslations("psfyours");
  const tModelview = useTranslations("modelview");
  const { userPoint } = useAuth();

  // 定義模型配置（包含 CDN 資訊）
  const MODEL_CONFIGS: ModelConfig[] = [
    {
      id: "988f6fdca24db156bcb38528",
      name: "model_style_transfer",
      displayName: t("model_style_transfer"),
      description: t("model_style_transfer"),
      cdnFolder: "japenAnime",
      imagePrefix: "japenAnime",
      imageCount: 71
    },
    {
      id: "68ed9c1cad7d2563378060ed",
      name: "model_super_fusion",
      displayName: t("model_super_fusion"),
      description: t("model_super_fusion"),
      cdnFolder: "cuteAnime",
      imagePrefix: "cuteAnime",
      imageCount: 62
    },
    {
      id: "68ed9c82cc3e600fe7f15ff2",
      name: "model_custom_project",
      displayName: t("model_custom_project"),
      description: t("model_custom_project"),
      cdnFolder: "customAnime",
      imagePrefix: "customAnime",
      imageCount: 78
    },
    {
      id: "",
      name: "model_r18_nsfw",
      displayName: t("model_r18_nsfw"),
      description: t("model_r18_nsfw"),
      cdnFolder: "",
      imagePrefix: "",
      imageCount: 0
    },
  ];

  const [activeModelId, setActiveModelId] = useState<string>(MODEL_CONFIGS[0].id);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  const isPremium = userPoint?.pointType !== "FREE";

  // --- 生成圖片 URL 的函數 ---
  const generateImageUrls = (config: ModelConfig): ModelImage[] => {
    if (!config.cdnFolder || config.imageCount === 0) return [];
    
    const images: ModelImage[] = [];
    for (let i = 1; i <= config.imageCount; i++) {
      const paddedNum = i.toString().padStart(5, '0'); // 00001, 00002, ...
      images.push({
        id: `${config.imagePrefix}-${paddedNum}`,
        url: `${CDN_BASE_URL}/${config.cdnFolder}/${config.imagePrefix}${paddedNum}.png`,
        prompt: `${config.displayName} - Image ${i}` // 可以自定義或留空
      });
    }
    return images;
  };

  // --- 分頁列捲動控制 ---
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [tabsOverflow, setTabsOverflow] = useState({ left: false, right: false });

  const updateOverflow = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setTabsOverflow({
      left: scrollLeft > 6,
      right: scrollLeft + clientWidth < scrollWidth - 6,
    });
  }, []);

  useEffect(() => {
    updateOverflow();
    const el = tabsRef.current;
    if (!el) return;
    const onScroll = () => updateOverflow();
    const onResize = () => updateOverflow();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [updateOverflow, MODEL_CONFIGS.length]);

  const scrollTabs = (dir: "left" | "right") => {
    const el = tabsRef.current;
    if (!el) return;
    el.scrollTo({ 
      left: dir === "left" ? el.scrollLeft - SCROLL_STEP : el.scrollLeft + SCROLL_STEP, 
      behavior: "smooth" 
    });
  };

  // --- 基本功能 ---
  const showPremiumToast = () => showToast(tModelview("premium_required"), true);
  // const handleUpgradeToPremium = () => window.dispatchEvent(new CustomEvent("openPaymentDialog"));

  const downloadImage = async (imageUrl: string, fileName: string) => {
    if (!isPremium) { showPremiumToast(); return; }
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast(tModelview("download_success"));
    } catch (error) {
      console.error("Download failed:", error);
      showToast(tModelview("download_failed"), true);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!isPremium) { showPremiumToast(); return; }
    try { 
      await navigator.clipboard.writeText(text); 
      showToast(t("prompt_copied")); 
    } catch { 
      showToast(t("copy_failed"), true); 
    }
  };

  /** 是否為受限展示模型（多 id） */
  const isLockedModel = LOCKED_MODEL_IDS.includes(activeModelId);

  const handleImageClick = (index: number) => {
    if (!isPremium) { showPremiumToast(); return; }
    if (isLockedModel) { showToast(t("restricted_toast"), true); return; }
    setSelectedImageIndex(index);
    setIsImageViewerOpen(true);
  };

  const handleCloseViewer = () => setIsImageViewerOpen(false);
  const handlePrevious = () => { 
    if (selectedImageIndex > 0) setSelectedImageIndex((p) => p - 1); 
  };
  const handleNext = () => { 
    const allImages = getCurrentModelImages();
    if (selectedImageIndex < allImages.length - 1) setSelectedImageIndex((p) => p + 1); 
  };

  // Modal 鍵盤
  useEffect(() => {
    if (!isImageViewerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseViewer();
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { 
      window.removeEventListener("keydown", handleKeyDown); 
      document.body.style.overflow = prevOverflow; 
    };
  }, [isImageViewerOpen, selectedImageIndex, handleNext, handlePrevious]);

  // 切換模型
  const handleModelChange = (modelId: string) => {
    setActiveModelId(modelId);

    const el = tabsRef.current;
    if (el) {
      const btn = el.querySelector<HTMLButtonElement>(`button[data-model="${modelId}"]`);
      if (btn) {
        const btnLeft = btn.offsetLeft;
        const btnRight = btnLeft + btn.offsetWidth;
        const viewLeft = el.scrollLeft;
        const viewRight = el.scrollLeft + el.clientWidth;
        if (btnLeft < viewLeft) el.scrollTo({ left: btnLeft - 16, behavior: "smooth" });
        else if (btnRight > viewRight) el.scrollTo({ left: btnRight - el.clientWidth + 16, behavior: "smooth" });
      }
    }
  };

  // 獲取當前模型的圖片
  const getCurrentModelImages = (): ModelImage[] => {
    const config = MODEL_CONFIGS.find((m) => m.id === activeModelId);
    return config ? generateImageUrls(config) : [];
  };

  const activeModel = MODEL_CONFIGS.find((m) => m.id === activeModelId);
  const allImages = getCurrentModelImages();

  // Empty State
  const EmptyState = () => (
    <div className="text-center py-12">
      <svg 
        className="mx-auto h-12 w-12 text-slate-600 mb-4" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24" 
        aria-hidden="true"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={1.5} 
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
        />
      </svg>
      <p className="text-slate-400 text-sm">{t("no_images")}</p>
    </div>
  );

  // ---- Render ----
  return (
    <div className="w-full">
      {/* Mobile: 下拉 */}
      <div className="sm:hidden mb-4">
        <label htmlFor="model-select" className="sr-only">{t("select_model")}</label>
        <select
          id="model-select"
          value={activeModelId}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          {MODEL_CONFIGS.map((m) => (
            <option key={m.id || m.displayName} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop/Tablet: 分頁列 */}
      <div className="hidden sm:block relative mb-6">
        {tabsOverflow.left && (
          <div 
            aria-hidden 
            className="pointer-events-none absolute inset-y-0 left-0 w-8 z-10 bg-gradient-to-r from-slate-950 to-transparent" 
          />
        )}
        {tabsOverflow.right && (
          <div 
            aria-hidden 
            className="pointer-events-none absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-slate-950 to-transparent" 
          />
        )}

        <button
          type="button"
          aria-label={t("scroll_left")}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 hidden md:flex items-center justify-center w-8 h-8 rounded-full 
            bg-white/10 hover:bg-white/20 text-white transition ${tabsOverflow.left ? "" : "opacity-0 pointer-events-none"}`}
          onClick={() => scrollTabs("left")}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          aria-label={t("scroll_right")}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 hidden md:flex items-center justify-center w-8 h-8 rounded-full 
            bg-white/10 hover:bg-white/20 text-white transition ${tabsOverflow.right ? "" : "opacity-0 pointer-events-none"}`}
          onClick={() => scrollTabs("right")}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div
          ref={tabsRef}
          role="tablist"
          aria-label={t("select_model")}
          className="no-scrollbar relative flex gap-2 overflow-x-auto pr-6"
          onScroll={updateOverflow}
        >
          {MODEL_CONFIGS.map((model) => {
            const isActive = activeModelId === model.id;
            return (
              <button
                key={model.id || model.displayName}
                data-model={model.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tab-${model.id}`}
                onClick={() => handleModelChange(model.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400
                  ${isActive
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/80"
                  }`}
              >
                {model.displayName}
              </button>
            );
          })}
        </div>
      </div>

      {/* 圖片牆 */}
      {activeModel && allImages.length > 0 ? (
        <div id={`tab-${activeModelId}`} role="tabpanel">
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {allImages.map((image, index) => {
              const locked = isLockedModel;
              return (
                <div
                  key={image.id}
                  className={`group relative aspect-square rounded-lg overflow-hidden border transition-all select-none ${
                    locked
                      ? "bg-slate-900/70 border-slate-800"
                      : "bg-slate-800/50 border-slate-700 hover:border-purple-500 cursor-pointer"
                  }`}
                  onClick={() => (locked ? showToast(t("restricted_toast"), true) : handleImageClick(index))}
                  onContextMenu={(e) => { if (locked) e.preventDefault(); }}
                  role="button"
                  aria-label={locked ? t("restricted_open") : t("open_image")}
                >
                  <Image
                    src={image.url}
                    alt={image.prompt || "AI generated image"}
                    fill
                    className={`object-cover transition-transform duration-300 ${
                      locked
                        ? `${HEAVY_BLUR} brightness-90 saturate-50 scale-105`
                        : "group-hover:scale-110"
                    }`}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    draggable={false}
                  />

                  {locked && (
                    <>
                      <div className="absolute inset-0" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                        <Lock className="w-14 h-14 md:w-16 md:h-16 drop-shadow-lg" aria-hidden />
                        <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs md:text-sm backdrop-blur">
                          {t("restricted_preview")}
                        </span>
                      </div>
                      <div className="absolute left-2 top-2 flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-black/60 text-slate-200 border border-white/10">
                        <Lock className="w-3.5 h-3.5" />
                        {t("restricted_badge")}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState />
      )}

      {/* 升級 CTA */}
      {/* {!isPremium && allImages.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 pointer-events-none z-40">
          <div className="h-32 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
          <div className="bg-slate-950 pb-6 flex items-center justify-center pointer-events-auto">
            <button
              type="button"
              onClick={handleUpgradeToPremium}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg transition-all font-semibold shadow-lg shadow-purple-500/30"
            >
              {t("upgrade_unlock")}
            </button>
          </div>
        </div>
      )} */}

      {/* 圖片檢視 Modal */}
      {isImageViewerOpen && allImages[selectedImageIndex] && (
        <div 
          role="dialog" 
          aria-modal="true" 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" 
          onClick={handleCloseViewer}
        >
          <button 
            type="button" 
            onClick={handleCloseViewer} 
            className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {selectedImageIndex > 0 && (
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); handlePrevious(); }} 
              className="absolute left-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {selectedImageIndex < allImages.length - 1 && (
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); handleNext(); }} 
              className="absolute right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <div 
            className="relative max-w-6xl max-h-[85vh] w-full h-full flex items-center justify-center px-6 sm:px-12" 
            onClick={(e) => e.stopPropagation()}
          >
            <Image 
              src={allImages[selectedImageIndex].url} 
              alt={allImages[selectedImageIndex].prompt || "AI generated image"} 
              fill 
              className="object-contain" 
              priority 
            />
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-4xl w-full px-6">
            <div className="bg-black/80 backdrop-blur-md rounded-lg p-4 border border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-white text-sm mb-2">{allImages[selectedImageIndex].prompt}</p>
                  <p className="text-gray-400 text-xs">{selectedImageIndex + 1} / {allImages.length}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      copyToClipboard(allImages[selectedImageIndex].prompt as string); 
                    }} 
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2z" />
                    </svg>
                  </button>
                  <button 
                    type="button" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      downloadImage(
                        allImages[selectedImageIndex].url, 
                        getDownloadFileName(activeModel?.name || "image", allImages[selectedImageIndex].id)
                      ); 
                    }} 
                    className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar { scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default ModelGalleryTabs;
