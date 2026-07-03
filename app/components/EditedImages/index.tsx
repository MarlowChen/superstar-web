"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { showToast } from "../CustomToast";
import ImageZoomViewer from "../ImageZoomViewer";
import { useTranslations } from "next-intl";
import {
  Download,
  Copy,
  Trash2,
  Lock,
  Eye,
  Filter,
  SortAsc,
  SortDesc,
  Clock,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
// import { ShareDropdown } from "./ShareDropdown";
import { getDownloadFileName } from "@/utils/getDownloadFileName";
import { useAuth } from "@/app/context/AuthContext";
import { ImageEditIcon } from "@/app/icon/ImageEditIcon";
import { useScroll } from "@/app/context/ScrollContext";

interface EditedImage {
  id: string;
  originalImageId: string;
  originalImageUrl: string;
  editedImageUrl: string;
  editHistory: EditOperation[];
  createdAt: string;
  source: 'drawing' | 'library';
  prompt: string;
  modelName: string;
}

interface EditOperation {
  type: string;
  timestamp: string;
  description: string;
}

const debugEditedImages = (...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_DEBUG_AUTH === "true") {
    console.info(...args);
  }
  };

const EditedImages: React.FC = () => {
  const t = useTranslations("edited");
  const { userPoint, loading: authLoading } = useAuth();
  const [editedImages, setEditedImages] = useState<EditedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<EditedImage | null>(null);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EditedImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [filterSource, setFilterSource] = useState<'all' | 'drawing' | 'library'>('all');
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const isFirstRender = useRef(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  const { setScrollY } = useScroll();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const container = containerRef.current;
    if (container) {
      // 更新全局滾動狀態
      setScrollY(container.scrollTop);
    }
  };
  // 判斷是否為付費用戶
  const isPremium = Boolean(userPoint && userPoint.pointType !== "FREE");

  // 處理升級到付費版的函數
  const handleUpgradeToPremium = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openPaymentDialog'));
    }
  };

  // 載入編輯後的圖片
  const fetchEditedImages = useCallback(async (pageNum: number = 1) => {
    debugEditedImages('fetchEditedImages page:', pageNum);
    debugEditedImages('isPremium:', isPremium);

    if (!isPremium) {
      setEditedImages([]);
      setHasMore(false);
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      const limit = isPremium ? 20 : 6; // 免費版只載入少量數據
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
        sort: sortBy,
        source: filterSource
      });

      debugEditedImages('fetch edited images request');
      const response = await fetch(
        `/api/user/edited-images?${params}`,
        { credentials: "include" }
      );

      debugEditedImages('fetch edited images response:', response.status, response.statusText);

      if (!response.ok) throw new Error("Failed to fetch edited images");

      const data = await response.json();
      debugEditedImages('edited images data:', data);
      debugEditedImages('edited images count:', data.images?.length || 0);

      if (pageNum === 1) {
        setEditedImages(data.images || []);
      } else {
        setEditedImages((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const newItems = data.images.filter(
            (item: EditedImage) => !existingIds.has(item.id)
          );
          return [...prev, ...newItems];
        });
      }

      // 免費版限制分頁
      setHasMore(isPremium ? pageNum < data.totalPages : false);

    } catch (error) {
      console.error("❌ Failed to fetch edited images:", error);
      showToast(t("load_failed"), true);
    } finally {
      setLoading(false);
    }
  }, [isPremium, sortBy, filterSource, t, loading]);

  // 初始載入
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isPremium) {
      setEditedImages([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchEditedImages(page);
    }
  }, [authLoading, isPremium, page, fetchEditedImages]);

  useEffect(() => {
    if (!isFirstRender.current && page > 1 && isPremium) {
      fetchEditedImages(page);
    }
  }, [page, isPremium, fetchEditedImages]);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading && isPremium) {
        setPage((prev) => prev + 1);
      }
    },
    [hasMore, loading, isPremium]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "20px",
      threshold: 0.1,
    });

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  // 處理圖片點擊
  const handleImageClick = useCallback((image: EditedImage) => {
    setSelectedImage(image);
    setIsImageViewerOpen(true);
  }, []);

  // 處理下載
  const handleDownload = useCallback(async (image: EditedImage, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      // 使用統一的檔案名稱格式，包含模型編號
      const modelName = image.modelName || "unknown";
      const imageId = image.id || Date.now().toString();
      const fileName = getDownloadFileName(modelName, imageId);
      
      // 使用改進的下載函數，iOS Safari 將顯示分享面板讓用戶保存到相簿
      const { downloadImage: downloadImageHelper } = await import('@/utils/downloadHelper');
      const result = await downloadImageHelper(image.editedImageUrl, fileName);
      
      if (result.success) {
        if (result.method === 'share') {
          showToast(t("imageSaveHint"));
        } else {
          showToast(t("download_success"));
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error("Download failed:", error);
      showToast(t("download_failed"), true);
    }
  }, [t]);

  // 處理複製
  const handleCopy = useCallback(async (image: EditedImage, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await fetch(image.editedImageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      showToast(t("copy_success"));
    } catch (error) {
      console.error("Copy failed:", error);
      showToast(t("copy_failed"), true);
    }
  }, [t]);

  // 處理刪除
  const requestDelete = useCallback((image: EditedImage, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(image);
  }, []);

  const cancelDelete = useCallback(() => {
    if (!isDeleting) {
      setDeleteTarget(null);
    }
  }, [isDeleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/user/edited-images/${deleteTarget.id}`,
        {
          method: "DELETE",
          credentials: "include"
        }
      );

      if (!response.ok) throw new Error("Failed to delete image");

      setEditedImages(prev => prev.filter(img => img.id !== deleteTarget.id));
      showToast(t("delete_success"));
      setDeleteTarget(null);
    } catch (error) {
      console.error("Delete failed:", error);
      showToast(t("delete_failed"), true);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, t]);

  // 鎖定狀態組件
  const LockedState = () => (
    <div className="min-h-screen bg-custom-gray dark:bg-custom-gray-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t("lock_title")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-8 max-w-md mx-auto leading-relaxed">
            {t("lock_content")}
          </p>
          <button
            onClick={handleUpgradeToPremium}
            className="px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-2xl transition-all duration-200 font-semibold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 text-lg"
          >
            {t("upgrade_now")}
          </button>
        </div>
      </div>
    </div>
  );

  // 空狀態組件
  const EmptyState = () => (
    <div className="min-h-screen bg-custom-gray dark:bg-custom-gray-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <div className="mx-auto h-24 w-24 text-custom-logo-purple dark:text-custom-logo-purple-dark mb-6 opacity-50">
            <ImageEditIcon className="w-full h-full fill-current" />
          </div>
          <h3 className="text-xl font-semibold text-custom-black dark:text-custom-black-dark mb-2">
            {t("no_edited_images")}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {t("start_editing_hint")}
          </p>
        </div>
      </div>
    </div>
  );

  // 載入狀態組件
  const LoadingState = () => (
    <div className="min-h-screen bg-custom-gray dark:bg-custom-gray-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-3 px-6 py-4 bg-custom-white dark:bg-custom-white-dark rounded-xl shadow-lg border border-custom-light-purple dark:border-custom-light-purple-dark">
            <div className="w-6 h-6 border-2 border-custom-logo-purple/20 border-t-custom-logo-purple dark:border-t-custom-logo-purple-dark rounded-full animate-spin"></div>
            <p className="text-custom-black dark:text-custom-black-dark font-medium">
              {t("loading_edited_images")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // 圖片卡片組件
  const ImageCard = ({ image }: { image: EditedImage }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [showActions, setShowActions] = useState(false);

    return (
      <div
        className="group relative bg-custom-white dark:bg-custom-white-dark rounded-2xl overflow-hidden shadow-lg border border-custom-light-purple/20 dark:border-custom-light-purple-dark/20 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onClick={() => handleImageClick(image)}
      >
        {/* 圖片區域 */}
        <div className="aspect-square relative overflow-hidden">
          <canvas
            ref={(canvas) => {
              if (canvas && !imageLoaded) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  const img = new window.Image();
                  img.crossOrigin = 'anonymous';
                  img.onload = () => {
                    // 設置 Canvas 尺寸為容器大小
                    canvas.width = canvas.offsetWidth;
                    canvas.height = canvas.offsetHeight;

                    // 計算圖片縮放比例，保持寬高比
                    const scale = Math.min(
                      canvas.width / img.width,
                      canvas.height / img.height
                    );

                    // 計算居中位置
                    const x = (canvas.width - img.width * scale) / 2;
                    const y = (canvas.height - img.height * scale) / 2;

                    // 繪製圖片
                    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                    setImageLoaded(true);
                  };
                  img.onerror = (e) => {
                    console.error('圖片載入失敗:', {
                      url: image.editedImageUrl,
                      error: e,
                      imageData: image
                    });
                  };
                  img.src = image.editedImageUrl;
                }
              }
            }}
            className={`w-full h-full object-cover transition-all duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'
              } group-hover:scale-105`}
          />

          {/* 懸停操作按鈕 */}
          <AnimatePresence>
            {showActions && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => handleImageClick(image)}
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
                    title={t("view_image")}
                    aria-label={t("view_image")}
                  >
                    <Eye className="w-5 h-5 text-white" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDownload(image, e)}
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
                    title={t("download_image")}
                    aria-label={t("download_image")}
                  >
                    <Download className="w-5 h-5 text-white" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(image, e)}
                    className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
                    title={t("copy_image")}
                    aria-label={t("copy_image")}
                  >
                    <Copy className="w-5 h-5 text-white" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => requestDelete(image, e)}
                    className="p-3 bg-red-500/20 backdrop-blur-sm rounded-full hover:bg-red-500/30 transition-colors"
                    title={t("delete_image")}
                    aria-label={t("delete_image")}
                  >
                    <Trash2 className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            )}
          </AnimatePresence>

          {/* 來源標籤 */}
          <div className="absolute top-3 left-3">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${image.source === 'drawing'
                ? 'bg-blue-500/90 text-white'
                : 'bg-purple-500/90 text-white'
              }`}>
              {image.source === 'drawing' ? t("from_drawing") : t("from_library")}
            </div>
          </div>

          {/* 編輯標籤 */}
          <div className="absolute top-3 right-3">
            <div className="px-3 py-1 bg-custom-logo-purple/90 dark:bg-custom-logo-purple-dark/90 text-white rounded-full text-xs font-medium">
              {/* <ImageEditIcon className="w-3 h-3 inline mr-1 fill-current" /> */}
              {t("edited")}
            </div>
          </div>
        </div>

        {/* 信息區域 */}
        <div className="p-4">
          <div className="mb-3">
            <p className="text-custom-black dark:text-custom-black-dark text-sm leading-relaxed line-clamp-2 font-medium">
              {image.prompt}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span>
                {new Date(image.createdAt).toLocaleDateString()}
              </span>
            </div>
            <span className="text-custom-logo-purple dark:text-custom-logo-purple-dark font-medium">
              {image.modelName}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // 主要渲染邏輯
  if (authLoading) {
    return <LoadingState />;
  }

  if (!isPremium) {
    return <LockedState />;
  }

  if (loading) {
    return <LoadingState />;
  }

  if (editedImages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="min-h-screen bg-custom-gray dark:bg-custom-gray-dark px-4 pt-8 overflow-y-auto pb-[9rem]"
      ref={containerRef}
      onScroll={handleScroll}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 頁面標題 */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-custom-black dark:text-custom-black-dark mb-3">
            {t("edited_images_title")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            {t("edited_images_description")}
          </p>
        </div>

        {/* 篩選和排序工具欄 */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-3">
            {/* 來源篩選 */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value as 'all' | 'drawing' | 'library')}
                className="px-3 py-2 bg-custom-white dark:bg-custom-white-dark border border-custom-light-purple/30 dark:border-custom-light-purple-dark/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-custom-logo-purple/50"
              >
                <option value="all">{t("all_sources")}</option>
                <option value="drawing">{t("from_drawing")}</option>
                <option value="library">{t("from_library")}</option>
              </select>
            </div>

            {/* 排序 */}
            <div className="flex items-center gap-2">
              {sortBy === 'newest' ? <SortDesc className="w-4 h-4 text-gray-500" /> : <SortAsc className="w-4 h-4 text-gray-500" />}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
                className="px-3 py-2 bg-custom-white dark:bg-custom-white-dark border border-custom-light-purple/30 dark:border-custom-light-purple-dark/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-custom-logo-purple/50"
              >
                <option value="newest">{t("newest_first")}</option>
                <option value="oldest">{t("oldest_first")}</option>
              </select>
            </div>
          </div>

          {/* 統計信息 */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t("total_images", { count: editedImages.length }) || `共 ${editedImages.length} 張圖片`}
          </div>
        </div>

        {/* 圖片網格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {editedImages.map((image) => (
            <ImageCard key={image.id} image={image} />
          ))}
        </div>

        {/* 無限滾動觀察者 */}
        {hasMore && (
          <div ref={observerTarget} className="flex justify-center py-8">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-custom-logo-purple"></div>
                <span>{t("loading_more")}</span>
              </div>
            ) : (
              <div className="h-8" />
            )}
          </div>
        )}

        {deleteTarget && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-edited-image-title"
          >
            <button
              type="button"
              aria-label={`${t("cancel")} ${t("delete_image")}`}
              className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-sm"
              onClick={cancelDelete}
            />
            <div className="relative w-full max-w-[380px] rounded-2xl border border-custom-light-purple/30 bg-custom-white p-5 text-custom-black shadow-2xl dark:border-custom-light-purple-dark/30 dark:bg-custom-white-dark dark:text-custom-black-dark">
              <h2 id="delete-edited-image-title" className="text-base font-semibold">
                {t("delete_image")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                {t("confirm_delete")}
              </p>
              <div className="mt-3 truncate rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:bg-white/10 dark:text-gray-300">
                {deleteTarget.prompt || deleteTarget.modelName || deleteTarget.id}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={cancelDelete}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={confirmDelete}
                  className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? `${t("delete")}...` : t("delete")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 圖片檢視器 */}
        <AnimatePresence>
          {isImageViewerOpen && selectedImage && (
            <ImageZoomViewer
              images={[{
                id: selectedImage.id,
                url: selectedImage.editedImageUrl,
                prompt: selectedImage.prompt,
                modelName: selectedImage.modelName,
                reactions: { likes: 0, dislikes: 0 },
                userReaction: { like: false, dislike: false, collecting: false }
              }]}
              initialIndex={0}
              onClose={() => setIsImageViewerOpen(false)}
              handleReaction={() => { }}
              handleCollectReaction={() => { }}
              showEditButton={false}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EditedImages;
