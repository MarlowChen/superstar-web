"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import ImageZoomSingleViewer from "../ImageZoomSingleViewer";
import ImageCard from "./ImageCard";
import useReactions from "../EnhancedImageDisplay/useReactions";
import { useTranslations } from "next-intl";
import { useTermsAgreement } from "@/app/hooks/useTermsAgreement";
import CopyrightNoticeDialog from "../CopyrightNoticeDialog";
import { useRouter } from "next/navigation";
import { useScroll } from "@/app/context/ScrollContext";
import BannerCarousel, { BannerItem } from "../BannerCarousel";
import PaymentModelDialog from "../PaymentModelDialog";
import UpgradePopupProvider from "../UpgradePopupAd/UpgradePopupProvider";

interface ImageData {
  _id: string;
  publishedImage: {
    id: string;
    url: string;
    reactions: {
      likes: number;
      dislikes: number;
    };
    userReaction: {
      like: boolean;
      dislike: boolean;
      comment?: string;
    };
  };
  task: {
    id: string;
    loraModel: string;
    loraModelTitle: string;
    prompt: string;
  };
}

interface RandomGroupResponse {
  message: string;
  data: {
    groupKey: string;
    images: ImageData[];
    remainingGroups: number;
    validUntil: number;
  } | null;
  hasMore?: boolean;
  shouldReset?: boolean;
  debug?: {
    reason?: string;
    availableCount?: number;
    excludedCount?: number;
    actualRemaining?: number;
    // [key: string]: any;
  };
}

interface VisitedGroup {
  key: string;
  validUntil: number;
}

const PublishedRandomImages: React.FC = () => {
  const t = useTranslations("explore");

  const [publishedImages, setPublishedImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const { handleAgree } = useTermsAgreement();
  const router = useRouter();

  const isLoadingRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const RETRY_DELAY = 1000;

  const observerTarget = useRef<HTMLDivElement | null>(null);
  const { setScrollY } = useScroll();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const container = containerRef.current;
    if (container) {
      // 更新全局滾動狀態
      setScrollY(container.scrollTop);
    }
  };

  const [visitedGroups, setVisitedGroups] = useState<VisitedGroup[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("visitedGroups");
      if (!saved) return [];
      const groups = JSON.parse(saved) as VisitedGroup[];
      const now = Date.now();
      return groups.filter((g) => g.validUntil > now);
    } catch {
      return [];
    }
  });

  // 保存 visitedGroups 到 localStorage
  useEffect(() => {
    try {
      if (visitedGroups.length > 0) {
        const now = Date.now();
        const validGroups = visitedGroups.filter((g) => g.validUntil > now);
        localStorage.setItem("visitedGroups", JSON.stringify(validGroups));
      } else {
        localStorage.removeItem("visitedGroups");
      }
    } catch (error) {
      console.error(t("save_visited_groups_failed"), error);
    }
  }, [visitedGroups, t]);

  const clearExpiredGroups = useCallback(() => {
    const now = Date.now();
    setVisitedGroups((prev) => prev.filter((g) => g.validUntil > now));
  }, []);

  const fetchRandomImages = useCallback(async (): Promise<void> => {
    if (isLoadingRef.current || !hasMore) return;

    isLoadingRef.current = true;
    setLoading(true);
    setErrorMessage(null);

    try {
      clearExpiredGroups();

      const validKeys = visitedGroups
        .filter((g) => g.validUntil > Date.now())
        .map((g) => g.key);

      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_SERVER_URL
        }/liked-images/random?excludedKeys=${validKeys.join(",")}`,
        { credentials: "include" }
      );

      if (response.status === 304) {
        console.warn(t("304_not_modified"));
        setHasMore(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`${t("request_failed")} ${response.status}`);
      }

      const data: RandomGroupResponse = await response.json();

      switch (data.message) {
        case "success":
          if (data.data) {
            const { groupKey, images, validUntil } = data.data;
            setPublishedImages((prev) => [...prev, ...images]);
            setVisitedGroups((prev) => [
              ...prev,
              { key: groupKey, validUntil },
            ]);
            setHasMore(!!data.hasMore);
          }
          break;

        case "keys_expired":
          console.warn(t("keys_expired_warning"));
          setVisitedGroups([]);
          localStorage.removeItem("visitedGroups");

          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = setTimeout(() => {
            fetchRandomImages();
          }, RETRY_DELAY);
          break;

        case "temporary_unavailable":
          console.warn("暫時無法獲取圖片");
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = setTimeout(() => {
            fetchRandomImages();
          }, 3000);
          break;

        case "no_more_images":
          setHasMore(false);
          break;

        default:
          console.warn(t("unknown_response"), data.message);
          setHasMore(false);
          break;
      }
    } catch (error) {
      console.error(t("fetch_images_error"), error);
      setErrorMessage(t("loading_failed_retry"));
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [hasMore, visitedGroups, clearExpiredGroups, t]);

  // 初始載入
  useEffect(() => {
    fetchRandomImages();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Intersection Observer 處理
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !isLoadingRef.current) {
        fetchRandomImages();
      }
    },
    [hasMore, fetchRandomImages]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "200px",
      threshold: 0.1,
    });

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
    setIsImageViewerOpen(true);
  };

  const { toggleReaction } = useReactions();

  const handleReaction = useCallback(
    async (imageId: string, reactionType: "like" | "dislike") => {
      const groupIndex = publishedImages.findIndex(
        (group) => group.publishedImage.id === imageId
      );

      if (groupIndex === -1) return;

      const updatedMessages = [...publishedImages];
      const currentImage = updatedMessages[groupIndex].publishedImage;
      const wasLiked = currentImage?.userReaction?.like;
      const wasDisliked = currentImage?.userReaction?.dislike;

      updatedMessages[groupIndex].publishedImage = {
        ...currentImage,
        userReaction: {
          ...currentImage.userReaction,
          like: reactionType === "like" ? !wasLiked : false,
          dislike: reactionType === "dislike" ? !wasDisliked : false,
        },
        reactions: {
          likes:
            reactionType === "like"
              ? wasLiked
                ? currentImage.reactions.likes - 1
                : currentImage.reactions.likes + 1
              : currentImage.reactions.likes,
          dislikes:
            reactionType === "dislike"
              ? wasDisliked
                ? currentImage.reactions.dislikes - 1
                : currentImage.reactions.dislikes + 1
              : currentImage.reactions.dislikes,
        },
      };

      if (!updatedMessages) {
        return;
      }

      setPublishedImages(updatedMessages);
      await toggleReaction(imageId, reactionType);
    },
    [toggleReaction]
  );

  const handleNewDrawing = (modelId: string) => {
    // 檢查是否已經同意過條款
    if (localStorage.getItem("termsAgreed") === "true") {
      // 已同意，直接跳轉
      router.push(`/drawing/?modelId=${modelId}`);
    } else {
      // 沒同意，先彈條款
      setPendingModelId(modelId);
      setShowTerms(true);
    }
  };

  const handleTermsAgree = () => {
    if (pendingModelId) {
      router.push(`/drawing/?modelId=${pendingModelId}`);
    }
    handleAgree();
    setShowTerms(false);
  };

  // Empty state component
  const EmptyState = (): JSX.Element => (
    <div className="text-center py-20 px-4">
      <div className="mx-auto h-24 w-24 text-custom-logo-purple dark:text-custom-logo-purple-dark mb-6 opacity-50">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-custom-black dark:text-custom-black-dark mb-2">
        {t("no_images_yet")}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        {t("start_exploring_hint")}
      </p>
      <button
        onClick={fetchRandomImages}
        className="px-6 py-3 bg-custom-logo-purple dark:bg-custom-logo-purple-dark hover:bg-custom-logo-purple-hover dark:hover:bg-custom-logo-purple-hover-dark text-custom-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
      >
        {t("load_images")}
      </button>
    </div>
  );

  // 處理 Banner 按鈕點擊
  const handleBannerClick = (link: string, target: '_self' | '_blank' = '_self') => {
    // 1. 如果指定 _blank，直接另開視窗
    if (target === '_blank') {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }

    // 2. 特殊內部邏輯
    if (link === "#upgrade") {
      setIsPaymentDialogOpen(true);
    } else if (link === "/drawing") {
      router.push('/drawing?mode=style-transfer');
    } else {
      // 3. 一般內部路由跳轉
      router.push(link);
    }
  };

  // 處理方案選擇
  const handleSelectPlan = () => {
    // 這裡可以處理方案選擇後的邏輯
  };

  // 定義 Banner 項目列表
  const bannerItems: BannerItem[] = [
    {
      id: "new-model-launch",
      type: "grid-layout", // 黑色主題：左文右圖 (Standard Grid)
      bgColor: "#0f0f12",  
      title: t("banner_new_model_title") || "New Model", 
      subtitle: [
        t("banner_new_model_subtitle") || "Experience a whole new way of image generation"
      ],
      buttonText: t("banner_new_model_button") || "Get Started",
      onClick: () => handleBannerClick("/drawing?model=new"),
      imageUrl: "/images/banner/mobile-banner.png", 
      gridImages: [
        "/images/banner/psf-Q1-695263051744b72df18e6b9a.jpg", 
        "/images/banner/psf-N1-695255911081be8a5be96a49-2.jpg",   
        "/images/banner/psf-C1-6952635f1744b72df18e6cbf.jpg",     
        "/images/banner/psf-I1-69525f9f3af91c5ac41127bd-2.jpg",    
        "/images/banner/psf-C2-69525a5f8ef5f48c16dc95bc.jpg",   
        "/images/banner/psf-Q2-69525df93af91c5ac41125e5.jpg"        
      ]
    },
    {
      id: "custom-ai-models",
      type: "grid-layout-reverse", // 米色主題：左圖右文 (Reverse Grid)
      bgColor: "#F3F1E7", // 參考 4.jpg 的米色背景
      textColor: "#333333", // 深色文字
      title: t("banner_custom_model_title") || "Hondolab Yours",
      subtitle: t("banner_custom_model_subtitle") || "Custom AI Models",
      buttonText: t("banner_custom_model_button") || "LEARN MORE",
      onClick: () => handleBannerClick("/psf-yours", "_blank"),
      imageUrl: "/images/banner/custom_mobile_banner.png", // 手機版背景圖
      // 根據圖片結構：左列2小圖，右列1大圖
      gridImages: [
        "/images/banner/psf-Q2-6952788aaa70210e4ef6e37a.jpg",    // 左上：可樂女孩
        "/images/banner/psf-I1-69527977aa70210e4ef6e4cd.jpg",     // 左下：紅髮賽車女
        "/images/banner/psf-C2-69527e785dc83d7a6137dc64.jpg",  // 右側大圖：金髮包包頭
      ]
    },
    {
      id: "banner-1",
      type: "default",
      imageUrl: "/images/banner-payment.jpg",
      title: t("banner_payment"),
      subtitle: [
        t("banner_payment_subtitle_1"),
        t("banner_payment_subtitle_2" ),
        t("banner_payment_subtitle_3")
      ],
      buttonText: t("banner_payment_button"),
      link: "#upgrade",
      onClick: () => handleBannerClick("#upgrade")
    },
    {
      id: "banner-2", 
      type: "default",
      imageUrl: "/images/banner-Image-transfer.jpg",
      title: t("banner_image_transfer"),
      subtitle: [
        t("banner_image_transfer_subtitle_1"),
        t("banner_image_transfer_subtitle_2"),
        t("banner_image_transfer_subtitle_3")
      ],
      buttonText: t("banner_image_transfer_button"),
      link: "/drawing",
      onClick: () => handleBannerClick("/drawing")
    },
  ];

  return (
    <UpgradePopupProvider>
      <div
        className="min-h-screen bg-custom-gray dark:bg-custom-gray-dark overflow-y-auto"
        ref={containerRef}
        onScroll={handleScroll}
      >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner 輪播區域 */}
        <div className="mb-12">
          <BannerCarousel
            items={bannerItems}
            autoplayInterval={6000}
            showNavigation={true}
            showIndicators={true}
          />
        </div>

          {/* 標題區域 - 品牌風格 */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-custom-black dark:text-custom-black-dark mb-2">
              {t("create_endless_imagination")}
            </h1>
            <div className="w-24 h-1 bg-custom-logo-purple dark:bg-custom-logo-purple-dark rounded-full"></div>
          </div>

          {/* 錯誤訊息 - 品牌風格 */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-red-700 dark:text-red-300 mb-3">
                {errorMessage}
              </p>
              <button
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors duration-200"
                onClick={() => {
                  setErrorMessage(null);
                  fetchRandomImages();
                }}
              >
                {t("retry")}
              </button>
            </div>
          )}

          {/* 主內容區域 */}
          {publishedImages.length === 0 && !loading ? (
            <EmptyState />
          ) : (
            <>
              {/* 圖片網格 - 品牌風格 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {publishedImages.map((image, index) => (
                  <div
                    className="transition-transform duration-300 hover:-translate-y-1"
                    key={`${image.publishedImage.id}-${index}`}
                  >
                    <ImageCard
                      image={image}
                      onClick={() => handleImageClick(index)}
                      handleReaction={(imageId: string, type: string) => {
                        handleReaction(imageId, type as "like" | "dislike");
                      }}
                      onNewDrawing={handleNewDrawing}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 載入指示器 - 品牌風格 */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 px-6 py-4 bg-custom-white dark:bg-custom-white-dark rounded-xl shadow-lg border border-custom-light-purple dark:border-custom-light-purple-dark">
                <div className="w-6 h-6 border-2 border-custom-logo-purple/20 border-t-custom-logo-purple dark:border-t-custom-logo-purple-dark rounded-full animate-spin"></div>
                <p className="text-custom-black dark:text-custom-black-dark font-medium">
                  {t("loading_images")}
                </p>
              </div>
            </div>
          )}

          {/* 無限滾動觸發器 */}
          {hasMore && <div ref={observerTarget} style={{ height: "20px" }} />}
      </div>

      {/* 圖片檢視器 - 保持原有功能 */}
      {isImageViewerOpen && selectedImageIndex !== null && (
        <ImageZoomSingleViewer
          currentImage={publishedImages[selectedImageIndex]}
          onPrevious={() => {
            if (selectedImageIndex > 0) {
              setSelectedImageIndex(selectedImageIndex - 1);
            }
          }}
          onNext={() => {
            if (selectedImageIndex < publishedImages.length - 1) {
              setSelectedImageIndex(selectedImageIndex + 1);
            } else if (hasMore) {
              fetchRandomImages();
            }
          }}
          handleReaction={(imageId: string, type: string) => {
            handleReaction(imageId, type as "like" | "dislike");
          }}
          showPrevious={selectedImageIndex > 0}
          showNext={
            selectedImageIndex < publishedImages.length - 1 || hasMore
          }
          onClose={() => setIsImageViewerOpen(false)}
        />
      )}

      <CopyrightNoticeDialog
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        onAgree={handleTermsAgree}
      />

      {/* 支付方案對話框 */}
      <PaymentModelDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        onSelectPlan={handleSelectPlan}
        path="/explore"
      />
      </div>
    </UpgradePopupProvider>
  );
};

export default PublishedRandomImages;