"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { showToast } from "../CustomToast";
import { useTranslations } from "next-intl";
import { Download, Loader2, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { getDownloadFileName } from "@/utils/getDownloadFileName";
import { useAuth } from "@/app/context/AuthContext";

interface ModelImage { id: string; url: string; }
interface ImageGroup { taskId: string; prompt: string; loraModelName: string; images: ModelImage[]; }
interface ModelData { id: string; name: string; displayName: string; description?: string; groups: ImageGroup[]; }

const MODELS: Omit<ModelData, "groups">[] = [
  { id: "988f6fdca24db156bcb38528", name: "風格轉移：鬼滅之刃風格", displayName: "風格轉移：鬼滅之刃風格", description: "風格轉移：鬼滅之刃風格" },
  { id: "68ed9c1cad7d2563378060ed", name: "超級融合：全新美日式經典風格", displayName: "超級融合：全新美日式經典風格", description: "超級融合：全新美日式經典風格" },
  { id: "68ed9c82cc3e600fe7f15ff2", name: "專案客製：JumpAnime", displayName: "專案客製：JumpAnime", description: "專案客製：JumpAnime" },
  { id: "68eb54598cab2cac2b49f873", name: "原創孿生：鬼滅之刃", displayName: "原創孿生：鬼滅之刃", description: "原創孿生：鬼滅之刃" },
  { id: "68ebbb87a14057a087bf43c9", name: "原創孿生：彌豆子", displayName: "原創孿生：彌豆子", description: "原創孿生：彌豆子" },
  { id: "", name: "R18 & NSFW ", displayName: "R18 & NSFW ", description: "R18 & NSFW " },
];

const FALLBACK_IMAGE_SETS: Record<string, string[]> = {
  "988f6fdca24db156bcb38528": [
    "/images/heros/demo/character1.png",
    "/images/heros/demo/character2.png",
    "/images/heros/demo/character3.png",
    "/images/heros/demo/character4.png",
    "/images/heros/demo/fight1.png",
    "/images/heros/demo/fight2.png",
  ],
  "68ed9c1cad7d2563378060ed": [
    "/images/heros/demo/character5.png",
    "/images/heros/demo/character6.png",
    "/images/heros/demo/character7.png",
    "/images/heros/demo/character8.png",
    "/images/heros/demo/scene1.png",
    "/images/heros/demo/scene2.png",
  ],
  "68ed9c82cc3e600fe7f15ff2": [
    "/images/heros/demo/material1.png",
    "/images/heros/demo/material2.png",
    "/images/heros/demo/material3.png",
    "/images/heros/demo/material4.png",
    "/images/heros/demo/scene3.png",
    "/images/heros/demo/scene4.png",
  ],
  "68eb54598cab2cac2b49f873": [
    "/images/heros/demo/fight1.png",
    "/images/heros/demo/fight2.png",
    "/images/heros/demo/fight3.png",
    "/images/heros/demo/fight4.png",
  ],
  "68ebbb87a14057a087bf43c9": [
    "/images/heros/demo/animal1.png",
    "/images/heros/demo/animal2.png",
    "/images/heros/demo/animal3.png",
    "/images/heros/demo/animal4.png",
  ],
};

const getFallbackGroups = (modelId: string, modelName: string): ImageGroup[] => {
  const urls = FALLBACK_IMAGE_SETS[modelId] || FALLBACK_IMAGE_SETS[MODELS[0].id];

  return [
    {
      taskId: `fallback-${modelId || "demo"}`,
      prompt: `${modelName} demo gallery`,
      loraModelName: modelName,
      images: urls.map((url, index) => ({
        id: `fallback-${modelId || "demo"}-${index + 1}`,
        url,
      })),
    },
  ];
};

const SCROLL_STEP = 260;

/** 設定要鎖住的多個 model id（想鎖幾個就放幾個） */
const LOCKED_MODEL_IDS: string[] = [
  "68ebbb87a14057a087bf43c9", // 原創孿生：彌豆子
  "68eb54598cab2cac2b49f873", // 例：原創孿生：鬼滅之刃（需要就保留，不要就刪）
];

const HEAVY_BLUR = "blur-[3px] md:blur-[3px]"; // 重度模糊

const ModelGalleryTabs: React.FC = () => {
  const t = useTranslations("modelview");
  const { userPoint } = useAuth();

  const [models, setModels] = useState<ModelData[]>(MODELS.map((m) => ({ ...m, groups: [] })));
  const [activeModelId, setActiveModelId] = useState<string>(MODELS[0].id);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement | null>(null);
  const isFirstRender = useRef(true);

  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  const isPremium = userPoint?.pointType !== "FREE";

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
  }, [updateOverflow, models.length]);

  const scrollTabs = (dir: "left" | "right") => {
    const el = tabsRef.current;
    if (!el) return;
    el.scrollTo({ left: dir === "left" ? el.scrollLeft - SCROLL_STEP : el.scrollLeft + SCROLL_STEP, behavior: "smooth" });
  };

  // --- 基本功能 ---
  const showPremiumToast = () => showToast(t("premium_required"), true);
  const handleUpgradeToPremium = () => window.dispatchEvent(new CustomEvent("openPaymentDialog"));

  const fetchModelImages = async (modelId: string, pageNum: number) => {
    if (!modelId) {
      setHasMore(false);
      return;
    }
    if (!isPremium && pageNum > 1) { setHasMore(false); return; }
    if (imagesLoading) return;
    setImagesLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const limit = 20;
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
      if (!serverUrl) throw new Error("Missing NEXT_PUBLIC_SERVER_URL");

      const response = await fetch(
        `${serverUrl}/model/${modelId}/images/${pageNum}/${limit}`,
        { credentials: "include", signal: controller.signal }
      );

      if (!response.ok) throw new Error("Failed to fetch images");
      const data = await response.json();

      setModels((prevModels) => prevModels.map((model) => {
        if (model.id !== modelId) return model;
        const existingGroups = pageNum === 1 ? [] : model.groups;
        const newGroups = data.groups || [];
        const groupIds = new Set(existingGroups.map((g: ImageGroup) => g.taskId));
        const uniqueNewGroups = newGroups.filter((g: ImageGroup) => !groupIds.has(g.taskId));
        return { ...model, groups: [...existingGroups, ...uniqueNewGroups] };
      }));

      setHasMore(isPremium ? Boolean(data.hasNextPage) : false);
    } catch {
      if (pageNum === 1) {
        setModels((prevModels) => prevModels.map((model) => {
          if (model.id !== modelId) return model;
          if (model.groups.length > 0) return model;
          return { ...model, groups: getFallbackGroups(modelId, model.displayName) };
        }));
      }
      setHasMore(false);
    } finally {
      clearTimeout(timeout);
      setImagesLoading(false);
    }
  };

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
      showToast(t("download_success"));
    } catch (error) {
      console.error("Download failed:", error);
      showToast(t("download_failed"), true);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!isPremium) { showPremiumToast(); return; }
    try { await navigator.clipboard.writeText(text); showToast("提示詞已複製"); }
    catch { showToast("複製失敗", true); }
  };

  /** 是否為受限展示模型（多 id） */
  const isLockedModel = LOCKED_MODEL_IDS.includes(activeModelId);

  const handleImageClick = (index: number) => {
    if (!isPremium) { showPremiumToast(); return; }
    if (isLockedModel) { showToast("此模型為受限展示，無法開啟原圖", true); return; }
    setSelectedImageIndex(index);
    setIsImageViewerOpen(true);
  };

  const handleCloseViewer = () => setIsImageViewerOpen(false);
  const handlePrevious = () => { if (selectedImageIndex > 0) setSelectedImageIndex((p) => p - 1); };
  const handleNext = () => { if (selectedImageIndex < allImages.length - 1) setSelectedImageIndex((p) => p + 1); };

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
    return () => { window.removeEventListener("keydown", handleKeyDown); document.body.style.overflow = prevOverflow; };
  }, [isImageViewerOpen, selectedImageIndex]);

  // 切換模型
  const handleModelChange = (modelId: string) => {
    setActiveModelId(modelId);
    setPage(1);
    setHasMore(true);
    const targetModel = models.find((m) => m.id === modelId);
    if (!targetModel?.groups || targetModel.groups.length === 0) fetchModelImages(modelId, 1);

    // 把該 tab 捲到可視範圍
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

  // 首次載入
  useEffect(() => { 
    if (isFirstRender.current) { 
      isFirstRender.current = false; 
      fetchModelImages(activeModelId, 1);
    } 
  }, []);
  // 防止 tab 初始無資料
  useEffect(() => {
    if (activeModelId && page === 1) {
      const activeModel = models.find((m) => m.id === activeModelId);
      if (activeModel && (!activeModel.groups || activeModel.groups.length === 0)) fetchModelImages(activeModelId, 1);
    }
  }, [activeModelId]);

  // Intersection Observer
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !imagesLoading) setPage((prev) => prev + 1);
  }, [hasMore, imagesLoading]);

  useEffect(() => {
    if (!hasMore) return;
    const observer = new IntersectionObserver(handleObserver, { root: null, rootMargin: "20px", threshold: 0.1 });
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [handleObserver, hasMore]);

  useEffect(() => { if (page > 1 && activeModelId) fetchModelImages(activeModelId, page); }, [page]);

  const activeModel = models.find((m) => m.id === activeModelId);
  const allImages =
    activeModel?.groups.flatMap((group) => group.images.map((image) => ({ ...image, prompt: group.prompt }))) || [];

  // Skeleton / Empty
  const ImageSkeleton = () => (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-800/50 border border-slate-700">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-700/40 via-slate-700/20 to-slate-700/40" />
    </div>
  );

  const EmptyState = () => (
    <div className="text-center py-12">
      <svg className="mx-auto h-12 w-12 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p className="text-slate-400 text-sm">尚無圖片</p>
    </div>
  );

  // ---- Render ----
  return (
    <div className="w-full">
      {/* Mobile: 下拉 */}
      <div className="sm:hidden mb-4">
        <label htmlFor="model-select" className="sr-only">選擇模型</label>
        <select
          id="model-select"
          value={activeModelId}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          {MODELS.map((m) => (
            <option key={m.id || m.displayName} value={m.id}>{m.displayName}</option>
          ))}
        </select>
      </div>

      {/* Desktop/Tablet: 分頁列 */}
      <div className="hidden sm:block relative mb-6">
        {tabsOverflow.left && (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8 z-10 bg-gradient-to-r from-slate-950 to-transparent" />
        )}
        {tabsOverflow.right && (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-slate-950 to-transparent" />
        )}

        <button
          type="button"
          aria-label="向左捲動"
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 hidden md:flex items-center justify-center w-8 h-8 rounded-full 
            bg-white/10 hover:bg-white/20 text-white transition ${tabsOverflow.left ? "" : "opacity-0 pointer-events-none"}`}
          onClick={() => scrollTabs("left")}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          aria-label="向右捲動"
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 hidden md:flex items-center justify-center w-8 h-8 rounded-full 
            bg-white/10 hover:bg-white/20 text-white transition ${tabsOverflow.right ? "" : "opacity-0 pointer-events-none"}`}
          onClick={() => scrollTabs("right")}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div
          ref={tabsRef}
          role="tablist"
          aria-label="模型選擇"
          className="no-scrollbar relative flex gap-2 overflow-x-auto pr-6"
          onScroll={updateOverflow}
        >
          {MODELS.map((model) => {
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
      {activeModel ? (
        <div id={`tab-${activeModelId}`} role="tabpanel">
          {allImages.length > 0 ? (
            <>
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
                      onClick={() => (locked ? showToast("此模型為受限展示，無法開啟原圖", true) : handleImageClick(index))}
                      onContextMenu={(e) => { if (locked) e.preventDefault(); }}
                      role="button"
                      aria-label={locked ? "受限展示（無法開啟）" : "開啟圖片"}
                    >
                      <Image
                        src={image.url}
                        alt={image.prompt || "AI 生成圖片"}
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
                              特別展示（受限）
                            </span>
                          </div>
                          <div className="absolute left-2 top-2 flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-black/60 text-slate-200 border border-white/10">
                            <Lock className="w-3.5 h-3.5" />
                            Restricted Preview
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Load more */}
              {hasMore && !imagesLoading && (
                <div className="text-center mt-8">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => prev + 1)}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all font-medium"
                    disabled={imagesLoading}
                  >
                    {imagesLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> 載入中...
                      </span>
                    ) : (
                      "載入更多"
                    )}
                  </button>
                </div>
              )}

              {hasMore && <div ref={observerTarget} style={{ height: 20 }} aria-hidden="true" />}
            </>
          ) : imagesLoading ? (
            <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {Array.from({ length: 10 }).map((_, i) => <ImageSkeleton key={`skl-${i}`} />)}
            </div>
          ) : <EmptyState />}
        </div>
      ) : <EmptyState />}

      {/* 升級 CTA（保留） */}
      {!isPremium && allImages.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 pointer-events-none z-40">
          <div className="h-32 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
          <div className="bg-slate-950 pb-6 flex items-center justify-center pointer-events-auto">
            <button
              type="button"
              onClick={handleUpgradeToPremium}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg transition-all font-semibold shadow-lg shadow-purple-500/30"
            >
              升級解鎖完整作品集
            </button>
          </div>
        </div>
      )}

      {/* 圖片檢視 Modal（受限模型不會觸發） */}
      {isImageViewerOpen && allImages[selectedImageIndex] && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={handleCloseViewer}>
          <button type="button" onClick={handleCloseViewer} className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          {selectedImageIndex > 0 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); handlePrevious(); }} className="absolute left-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}

          {selectedImageIndex < allImages.length - 1 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); handleNext(); }} className="absolute right-4 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}

          <div className="relative max-w-6xl max-h-[85vh] w-full h-full flex items-center justify-center px-6 sm:px-12" onClick={(e) => e.stopPropagation()}>
            <Image src={allImages[selectedImageIndex].url} alt={allImages[selectedImageIndex].prompt || "AI 生成圖片"} fill className="object-contain" priority />
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-4xl w-full px-6">
            <div className="bg-black/80 backdrop-blur-md rounded-lg p-4 border border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-white text-sm mb-2">{allImages[selectedImageIndex].prompt}</p>
                  <p className="text-gray-400 text-xs">{selectedImageIndex + 1} / {allImages.length}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); copyToClipboard(allImages[selectedImageIndex].prompt as string); }} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2z" /></svg>
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); downloadImage(allImages[selectedImageIndex].url, getDownloadFileName(activeModel?.name || "image", allImages[selectedImageIndex].id)); }} className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white">
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
