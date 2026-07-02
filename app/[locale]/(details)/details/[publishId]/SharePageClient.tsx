// app/share/[publishId]/SharePageClient.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
// import Image   from "next/image";
import { useTranslations } from "next-intl";
import { LinkIcon } from "@/app/icon/LinkIcon";
import { DownloadIcon } from "@/app/icon/DownloadIcon";
import { showToast, CustomToast } from "@/app/components/CustomToast";
import { ShareIcon } from "@/app/icon/ShareIcon";
import { addWatermark } from "@/app/utils/watermark";

interface SharePageData {
  prompt: string;
  generatedPrompt: string;
  publicImageId:string;
  modelTitle: string;
  shortId: string;
  imageUrl: string;
  taskId: string;
  createdAt?: string;
}





// interface ApiResponse {
//   success: boolean;
//   data: SharePageData;
// }

interface SharePageClientProps {
  initialData: SharePageData | null;
  publishId: string;
}

const SharePageClient: React.FC<SharePageClientProps> = ({
  initialData,
  publishId,
}) => {
  const t = useTranslations("library");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 添加對初始數據的調試
  // console.log("🔍 初始數據 (initialData):", initialData);
  // console.log("🔍 初始數據中的 loraModelName:", initialData?.loraModelName);
  // if (!initialData?.loraModelName) {
  //   // console.log("🔍 初始數據中的 taskId:", initialData?.taskId);
  // }

  const [shareData, setShareData] = useState<SharePageData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  // const [imageKey, setImageKey] = useState(0);



  const updatePageMeta = useCallback((data: SharePageData) => {
    const currentUrl = typeof window !== "undefined" ? window.location.href : "";
    const title = `${t("aiGeneratedImage") || "AI 生成圖片"} - ${data.prompt}`;
    const description = `${
      t("shareDescription") || "使用 AI 技術生成的精美圖片"
    }：${data.prompt}`;

    document.title = title;

    const updateOrCreateMeta = (
      selector: string,
      content: string,
      property?: string
    ) => {
      let metaTag = document.querySelector(selector) as HTMLMetaElement;
      if (!metaTag) {
        metaTag = document.createElement("meta");
        if (property) {
          metaTag.setAttribute(
            property.includes("og:") ? "property" : "name",
            property
          );
        } else {
          const matches = selector.match(/\[(.+?)="(.+?)"\]/);
          if (matches) {
            metaTag.setAttribute(matches[1], matches[2]);
          }
        }
        document.head.appendChild(metaTag);
      }
      metaTag.content = content;
    };

    updateOrCreateMeta('meta[property="og:image"]', data.imageUrl);
    updateOrCreateMeta('meta[property="og:image:secure_url"]', data.imageUrl);
    updateOrCreateMeta('meta[name="twitter:image"]', data.imageUrl);
    updateOrCreateMeta('meta[property="og:title"]', title);
    updateOrCreateMeta('meta[property="og:description"]', description);
    updateOrCreateMeta('meta[name="twitter:title"]', title);
    updateOrCreateMeta('meta[name="twitter:description"]', description);
    updateOrCreateMeta('meta[property="og:url"]', currentUrl);
  }, [t]);

  // 客戶端獲取資料（如果伺服器端獲取失敗）
  const fetchShareData = useCallback(async (id: string) => {
    try {
      console.log("🔍 正在請求 API:", `${process.env.NEXT_PUBLIC_SERVER_URL}/details/${id}`);
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/details/${id}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error(t("loadFailed") || "Failed to fetch share data");
      }

      const result = await response.json();
      

      // console.log("🔍 後端 API 回應:", result);
      // console.log("🔍 loraModelName 欄位:", result?.loraModelName);
      // console.log("🔍 完整資料:", JSON.stringify(result, null, 2));

      if (result) {        
        setShareData(result);
        // 客戶端動態更新 meta 標籤（作為備用）
        updatePageMeta(result);
      } else {
        throw new Error(t("loadFailed") || "Invalid response data");
      }
    } catch (error) {
      console.error("🔍 API 請求失敗:", error);
      setError(t("loadFailed") || "無法載入分享內容");
    } finally {
      setLoading(false);
    }
  }, [t, updatePageMeta]);

  // 複製連結
  // const copyLink = async () => {
  //   try {
  //     await navigator.clipboard.writeText(window.location.href);
  //     showToast(t("linkCopied") || "連結已複製到剪貼板");
  //   } catch (error) {
  //     console.error("Copy failed:", error);
  //     showToast(t("copyFailed") || "複製失敗", true);
  //   }
  // };

  // 複製提示詞
  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("promptCopied") || "提示詞已複製");
    } catch (error) {
      console.error("Copy failed:", error);
      showToast(t("copyFailed") || "複製失敗", true);
    }
  };

  // 下載圖片（帶水印）
  const downloadImage = async () => {
    if (!shareData || !canvasRef.current) return;

    try {
      const fileName = `superstar-${shareData.modelTitle}-${shareData.publicImageId}.jpg`;
      
      // 使用改進的 Canvas 下載函數，iOS Safari 將顯示分享面板
      const { downloadImageFromCanvas } = await import('@/utils/downloadHelper');
      const result = await downloadImageFromCanvas(canvasRef.current, fileName, 0.95);
      
      if (result.success) {
        if (result.method === 'share') {
          showToast(t("imageSaveHint") || "請選擇「儲存圖片」保存到相簿");
        } else {
          showToast(t("downloadSuccess") || "圖片下載成功");
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error("Download failed:", error);
      showToast(t("downloadFailed") || "圖片下載失敗", true);
    }
  };

  const resetImageState = () => {
    setImageLoaded(false);
    setImageError(false);
    // setImageKey((prev) => prev + 1);
  };

  const handleImageError = () => {
    if (retryCount < 3) {
      setRetryCount((count) => count + 1);
      resetImageState();
    } else {
      setImageError(true);
    }
  };

  // 載入圖片並添加水印
  const loadImageWithWatermark = useCallback(async () => {
    if (!shareData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      setImageLoaded(false);
      const img = new window.Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = shareData.imageUrl;
      });

      // 設置 canvas 尺寸
      canvas.width = img.width;
      canvas.height = img.height;

      // 繪製圖片
      ctx.drawImage(img, 0, 0);
      
      // 在分享頁面，所有用戶都顯示水印
      await addWatermark(ctx, img.width, img.height);
      
      setImageLoaded(true);
      setImageError(false);
    } catch (error) {
      console.error("Image loading failed:", error);
      handleImageError();
    }
  }, [handleImageError, shareData]);
  useEffect(() => {
    // 如果沒有初始資料，則客戶端獲取
    if (!initialData && publishId) {
      fetchShareData(publishId);
    }
    // 如果有初始資料，也執行一次 meta 標籤更新
    else if (initialData) {
      updatePageMeta(initialData);
    }
  }, [fetchShareData, publishId, initialData, updatePageMeta]);

  useEffect(() => {
    if (retryCount > 0 && retryCount <= 3) {
      resetImageState();
    }
  }, [retryCount]);

  useEffect(() => {
    if (shareData) {
      loadImageWithWatermark();
    }
  }, [shareData, loadImageWithWatermark]);

  // 載入中狀態
  if (loading) {
    return (
      <div className="w-full max-w-5xl h-screen flex items-center justify-center mx-auto bg-custom-white dark:bg-custom-white-dark">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-custom-light-purple dark:border-custom-light-purple-dark rounded-full animate-spin border-t-custom-logo-purple dark:border-t-custom-logo-purple-dark"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-ping border-t-custom-logo-purple/30 dark:border-t-custom-logo-purple-dark/30"></div>
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-custom-black dark:text-custom-black-dark">
              {t("loading") || "載入中..."}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("loadingSubtitle") || "正在獲取圖片資訊"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 錯誤狀態
  if (error || !shareData) {
    return (
      <div className="w-full max-w-5xl h-screen flex items-center justify-center mx-auto bg-custom-white dark:bg-custom-white-dark">
        <div className="text-center max-w-md px-4 space-y-6">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-10 h-10 text-red-500 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-custom-black dark:text-custom-black-dark">
              {t("errorTitle") || "載入失敗"}
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {error || t("errorMessage") || "無法載入分享內容，請稍後再試"}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-custom-logo-purple dark:bg-custom-logo-purple-dark hover:bg-custom-logo-purple-hover dark:hover:bg-custom-logo-purple-hover-dark text-white rounded-lg transition-all duration-200 font-medium"
            >
              {t("retry") || "重新載入"}
            </button>
            <button
              onClick={() => window.open("/", "_blank")}
              className="px-6 py-3 bg-custom-light-purple dark:bg-custom-light-purple-dark hover:bg-custom-light-purple-hover dark:hover:bg-custom-light-purple-hover-dark text-custom-logo-purple dark:text-custom-logo-purple-dark rounded-lg transition-all duration-200 font-medium"
            >
              {t("backHome") || "回到首頁"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto min-h-screen bg-custom-white dark:bg-custom-white-dark transition-all duration-300 ease-in-out">
      {/* 標題區域 */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 px-4 sm:px-6 pt-6 gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-custom-logo-purple dark:bg-custom-logo-purple-dark rounded-lg flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-custom-black dark:text-custom-black-dark">
            {t("sharePageTitle") || "AI 生成圖片分享"}
          </h1>
        </div>
        <button
          onClick={() => window.open("/", "_blank")}
          className="px-4 py-2 bg-custom-light-purple dark:bg-custom-light-purple-dark hover:bg-custom-light-purple-hover dark:hover:bg-custom-light-purple-hover-dark text-custom-logo-purple dark:text-custom-logo-purple-dark rounded-lg transition-colors font-medium text-sm sm:text-base whitespace-nowrap"
        >
          {t("startCreate") || "開始創作"}
        </button>
      </header>

      {/* 主要內容區域 */}
      <main className="px-4 sm:px-6 pb-8">
        <div className="space-y-6">
          {/* 提示詞區域 */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="flex items-start flex-1 min-w-0 w-full sm:w-auto">
              <button
                className="flex items-center hover:bg-custom-light-purple-hover dark:hover:bg-custom-light-purple-hover-dark justify-center bg-custom-light-purple dark:bg-custom-light-purple-dark w-8 h-8 rounded-md flex-shrink-0 mt-1"
                onClick={() => copyPrompt(shareData.prompt)}
                aria-label={t("copyPrompt") || "Copy prompt"}
                title={t("copyPrompt") || "複製提示詞"}
              >
                <LinkIcon
                  className="fill-custom-logo-purple dark:fill-custom-logo-purple-dark stroke-custom-logo-purple dark:stroke-custom-logo-purple-dark stroke-[2]"
                  wrapperClassName="w-4 h-4"
                />
              </button>
              <p className="pl-3 text-custom-black dark:text-custom-black-dark font-medium break-words leading-relaxed">
                {shareData.prompt}
              </p>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
                  {/* 底部信息區域 */}
                  <div className="flex items-center justify-between border-t border-custom-light-purple/30 dark:border-custom-light-purple-dark/30">
                    {/* 模型信息 */}
                    <div className="flex items-center gap-2 text-sm text-custom-logo-purple dark:text-custom-logo-purple-dark">
                      <ShareIcon
                        className="fill-current"
                        wrapperClassName="w-4 h-4"
                      />
                    <span className="font-medium">
                      {shareData.modelTitle || "模型編號未找到"}
                      {/* {console.log("🔍 顯示模型編號:", shareData.loraModelName)} */}
                    </span>
                  </div>
                </div>
              <button
                className="flex items-center hover:bg-custom-light-purple-hover dark:hover:bg-custom-light-purple-hover-dark justify-center bg-custom-light-purple dark:bg-custom-light-purple-dark w-8 h-8 rounded-md transition-colors"
                onClick={downloadImage}
                aria-label={t("downloadImage") || "Download image"}
                title={t("downloadImage") || "下載圖片"}
              >
                <DownloadIcon
                  className="fill-custom-logo-purple dark:fill-custom-logo-purple-dark stroke-custom-logo-purple dark:stroke-custom-logo-purple-dark stroke-[2]"
                  wrapperClassName="w-4 h-4"
                />
              </button>
            </div>
          </div>

          {/* 圖片展示區域 */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-2xl aspect-square">
              <div className="absolute inset-0 rounded-2xl overflow-hidden bg-custom-light-purple/10 dark:bg-custom-light-purple-dark/10 shadow-2xl">
                {!imageLoaded && !imageError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-custom-light-purple/5 dark:bg-custom-light-purple-dark/5">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-12 h-12 border-3 border-custom-logo-purple dark:border-custom-logo-purple-dark rounded-full animate-spin border-t-transparent"></div>
                      <p className="text-sm text-custom-black/60 dark:text-custom-black-dark/60">
                        {t("imageLoading") || "圖片載入中..."}
                        {retryCount > 0 && ` (重試 ${retryCount}/3)`}
                      </p>
                    </div>
                  </div>
                )}

                {imageError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-custom-light-purple/5 dark:bg-custom-light-purple-dark/5">
                    <div className="flex flex-col items-center space-y-4 text-center max-w-xs">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-custom-black/60 dark:text-custom-black-dark/60">
                          {t("imageLoadError") || "圖片載入失敗"}
                        </p>
                        <button
                          onClick={() => {
                            resetImageState();
                            setRetryCount(0);
                          }}
                          className="px-3 py-1 text-xs bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-white rounded-md hover:bg-custom-logo-purple-hover dark:hover:bg-custom-logo-purple-hover-dark transition-colors"
                        >
                          {t("retryLoad") || "重新載入"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!imageError && (
                  <canvas
                    ref={canvasRef}
                    className={`w-full h-full object-contain rounded-2xl transition-opacity duration-500 ${
                      imageLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    style={{ maxWidth: "100%", maxHeight: "100%" }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* AI 優化提示詞區域 */}
          {shareData.generatedPrompt && (
            <div className="bg-custom-white dark:bg-custom-gray-dark rounded-xl p-6 shadow-sm border border-custom-light-purple/20 dark:border-custom-light-purple-dark/20">
              <div className="flex items-center mb-4">
                <button
                  className="flex items-center hover:bg-custom-light-purple-hover dark:hover:bg-custom-light-purple-hover-dark justify-center bg-custom-light-purple dark:bg-custom-light-purple-dark w-8 h-8 rounded-md mr-3 transition-colors"
                  onClick={() => copyPrompt(shareData.generatedPrompt)}
                  aria-label={t("copyEnhancedPrompt") || "Copy enhanced prompt"}
                  title={t("copyEnhancedPrompt") || "複製優化提示詞"}
                >
                  <LinkIcon
                    className="fill-custom-logo-purple dark:fill-custom-logo-purple-dark stroke-custom-logo-purple dark:stroke-custom-logo-purple-dark stroke-[2]"
                    wrapperClassName="w-4 h-4"
                  />
                </button>
                <h3 className="text-lg font-semibold text-custom-black dark:text-custom-black-dark">
                  {t("enhancedPrompt") || "完整提示詞"}
                </h3>
              </div>
              <div className="bg-custom-gray/30 dark:bg-custom-gray-dark/30 rounded-lg p-4 border-l-4 border-custom-logo-purple dark:border-custom-logo-purple-dark">
                <p className="text-custom-black/80 dark:text-custom-black-dark/80 text-sm leading-relaxed whitespace-pre-wrap">
                  {shareData.generatedPrompt}
                </p>
              </div>
            </div>
          )}

          {/* Call to Action 區域 */}
          <div className="bg-gradient-to-br from-custom-logo-purple/10 via-custom-logo-purple/5 to-transparent dark:from-custom-logo-purple-dark/10 dark:via-custom-logo-purple-dark/5 dark:to-transparent rounded-2xl p-8 text-center border border-custom-logo-purple/10 dark:border-custom-logo-purple-dark/10">
            <div className="w-16 h-16 bg-custom-logo-purple dark:bg-custom-logo-purple-dark rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div className="space-y-4 max-w-md mx-auto">
              <h3 className="text-2xl font-bold text-custom-black dark:text-custom-black-dark">
                {t("likeThisImage") || "喜歡這張 AI 生成的圖片嗎？"}
              </h3>
              <p className="text-custom-black/70 dark:text-custom-black-dark/70 leading-relaxed">
                {t("ctaDescription") ||
                  "立即體驗我們的 AI 圖片生成器，創造屬於你的獨特作品"}
              </p>
              <button
                onClick={() => window.open("/", "_blank")}
                className="inline-flex items-center gap-3 px-8 py-4 bg-custom-logo-purple dark:bg-custom-logo-purple-dark hover:bg-custom-logo-purple-hover dark:hover:bg-custom-logo-purple-hover-dark text-white rounded-xl transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {t("startCreate") || "開始創作"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 添加 Toast 組件 */}
      <CustomToast />
    </div>
  );
};

export default SharePageClient;
