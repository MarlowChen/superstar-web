import React, { useState, useEffect, useRef } from "react";
import { ShareIcon } from "../../icon/ShareIcon";
import { showToast } from "../CustomToast";
import {
  ThumbsUp,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Info,
  Heart,
  MessageCircle,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { ShareDropdown } from "../ShareDropdown";

const isVideoUrl = (url?: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || "");
const isAudioUrl = (url?: string) => /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(url || "");

interface ImageZoomViewerProps {
  modelName?: string; // 改為可選，向後兼容
  prompt?: string; // 改為可選，向後兼容
  images: {
    url: string;
    id: string;
    prompt?: string; // 添加每個圖片的 prompt
    modelName?: string; // 添加每個圖片的模型名稱
    reactions: {
      likes: number;
      dislikes: number;
      collections?: number; // 新增收藏數
    };
    userReaction: {
      like: boolean;
      dislike: boolean;
      collecting?: boolean; // 新增收藏狀態
      comment?: string;
    };
  }[];
  initialIndex: number;
  onClose: () => void;
  handleReaction: (imageId: string, type: string) => void;
  handleCollectReaction?: (imageId: string) => void; // 新增收藏處理函數
  onComment?: (imageId: string, comment: string) => void; // 新增留言處理函數
  showEditButton?: boolean; // 控制是否顯示編輯按鈕
}

export const WATERMARK = {
  margin: 30,
  logoDrawSize: 38,
  svgViewBoxSize: 342,
  textOffsetX: 3,
  textOffsetY: 3,
};

const ImageZoomViewer: React.FC<ImageZoomViewerProps> = ({
  modelName: fallbackModelName = "",
  prompt: fallbackPrompt = "",
  images,
  initialIndex,
  onClose,
  handleReaction,
  handleCollectReaction,
  onComment,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const t = useTranslations("modelview");
  const lng = useLocale();

  // 檢測移動設備
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 多語系文字配置
  const texts = {
    loading_image: t("loading_image"),
    creation_prompt: t("creation_prompt"),
    likes: t("likes"),
    to_close: t("to_close"),
    navigate: t("navigate"),
    toggle_info: t("toggle_info"),
    copied_success: t("copied_to_clipboard"),
    copy_failed: t("copy_failed"),
    download_success: t("download_success"),
    download_failed: t("download_failed"),
    image_loading_failed: t("image_loading_failed"),
    copy_prompt: t("copy_prompt"),
    download_image: t("download_image"),
    close_viewer: t("close_viewer"),
    show_info: t("show_info"),
    hide_info: t("hide_info"),
    previous_image: t("previous_image"),
    next_image: t("next_image"),
    like_image: t("like_image"),
    collect_image: t("collect_image"),
    keyboard_shortcuts: t("keyboard_shortcuts"),
    share_image: t("share_image"),
    comment_image: t("comment_image"),
    has_comment: t("has_comment"),
    your_comment: t("your_comment"),
  };

  const currentImage = images[currentIndex];
  const currentIsVideo = isVideoUrl(currentImage?.url);
  const currentIsAudio = isAudioUrl(currentImage?.url);

  // 優先使用當前圖片的資料，否則使用 fallback
  const currentModelName = currentImage.modelName || fallbackModelName;
  const currentPrompt = currentImage.prompt || fallbackPrompt;

  // 鍵盤導航支援（僅桌面版）
  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          handleClose();
          break;
        case "ArrowLeft":
          if (images.length > 1) {
            setCurrentIndex(
              (prev) => (prev - 1 + images.length) % images.length
            );
          }
          break;
        case "ArrowRight":
          if (images.length > 1) {
            setCurrentIndex((prev) => (prev + 1) % images.length);
          }
          break;
        case "i":
        case "I":
          setShowInfo((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, images.length, isMobile]);

  // 控制項自動隱藏（桌面版）/ 手機版保持顯示
  useEffect(() => {
    if (isMobile) {
      setShowControls(true);
      return;
    }

    const handleMouseMove = () => {
      setShowControls(true);

      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }

      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    window.addEventListener("mousemove", handleMouseMove);
    handleMouseMove();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, [isMobile]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  // // 處理留言點擊
  // const handleCommentClick = () => {
  //   if (currentImage && onComment) {
  //     onComment(currentImage.id, currentImage.userReaction.comment || "");
  //   }
  // };

  // 處理收藏點擊
  const handleCollectClick = () => {
    if (currentImage && handleCollectReaction) {
      handleCollectReaction(currentImage.id);
    }
  };

  const loadImage = async (url: string) => {
    if (isVideoUrl(url) || isAudioUrl(url)) {
      setImageLoaded(true);
      return;
    }

    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      setImageLoaded(false);
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);
      setImageLoaded(true);
    } catch (error) {
      console.error("Image loading failed:", error);
      showToast(texts.image_loading_failed, true);
    }
  };

  useEffect(() => {
    setImageLoaded(false);
    loadImage(currentImage.url);
  }, [currentIndex, currentImage.url]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(texts.copied_success);
    } catch (error) {
      console.error("Copy failed:", error);
      showToast(texts.copy_failed, true);
    }
  };

  const downloadImage = async () => {
    if (currentIsVideo || currentIsAudio) {
      try {
        const link = document.createElement("a");
        link.href = currentImage.url;
        link.download = `${currentImage.id || (currentIsAudio ? "audio-result" : "video-result")}.${currentIsAudio ? "mp3" : "mp4"}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(texts.download_success);
      } catch (error) {
        console.error("Download failed:", error);
        showToast(texts.download_failed, true);
      }
      return;
    }

    if (!canvasRef.current) return;

    const modelName = currentModelName || "unknown";
    const imageId = currentImage.id || Date.now().toString();
    const { getDownloadFileName } = await import('@/utils/getDownloadFileName');
    const fileName = getDownloadFileName(modelName, imageId);

    try {
      // 使用統一的檔案名稱格式，包含模型編號

      // 使用改進的 Canvas 下載函數，iOS Safari 將顯示分享面板
      const { downloadImageFromCanvas } = await import(
        "@/utils/downloadHelper"
      );
      const result = await downloadImageFromCanvas(
        canvasRef.current,
        fileName,
        0.95
      );

      if (result.success) {
        if (result.method === "share") {
          showToast(t("imageSaveHint") || "請選擇「儲存圖片」保存到相簿");
        } else {
          showToast(texts.download_success);
        }
      } else {
        throw new Error("Download failed");
      }
    } catch (error) {
      console.error("Download failed:", error);
      try {
        const { downloadImage: downloadOriginalImage } = await import("@/utils/downloadHelper");
        await downloadOriginalImage(currentImage.url, fileName);
        showToast(texts.download_success);
      } catch (fallbackError) {
        console.error("Fallback download failed:", fallbackError);
        showToast(texts.download_failed, true);
      }
    }
  };

  // 準備分享數據
  const getShareData = () => {
    if (!currentImage) return {};

    return {
      url: `${process.env.NEXT_PUBLIC_URL}/${lng}/details/${currentImage.id}`,
      title: t("share_image_title"),
      description: currentPrompt,
      hashtag: "#AIArt #GeneratedImage",
      imageUrl: currentImage.url,
    };
  };

  // 處理分享完成
  const handleShareComplete = (platform: string) => {
    if (platform === "copy") {
      showToast(t("share_link_copied"));
    } else if (platform === "download") {
      showToast(t("download_success"));
    } else {
      showToast(t("shared_successfully", { platform }));
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/[0.82] dark:bg-[rgba(10,10,10,0.86)] transition-all duration-300 ease-out ${
        isClosing ? "opacity-0 scale-105" : "opacity-100 scale-100"
      }`}
      style={{
        backdropFilter: "blur(0px)",
        WebkitBackdropFilter: "blur(0px)",
      }}
    >
      {/* 點擊背景關閉 */}
      <div className="absolute inset-0 cursor-pointer" onClick={handleClose} />

      {/* 主容器 */}
      <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
        {/* 圖片展示區域 */}
        <div
          className={`pointer-events-auto flex items-center justify-center w-full h-full ${
            isMobile ? "p-2" : "p-4"
          }`}
        >
          {currentIsVideo ? (
            <video
              ref={videoRef}
              src={currentImage.url}
              className={`max-w-full max-h-full object-contain transition-all duration-700 ease-out transform ${
                imageLoaded
                  ? "opacity-100 scale-100 translate-y-0"
                  : "opacity-0 scale-95 translate-y-4"
              }`}
              style={{
                maxWidth: isMobile ? "100vw" : "90vw",
                maxHeight: isMobile ? "100vh" : "90vh",
                filter: "drop-shadow(0 25px 50px rgba(0, 0, 0, 0.7))",
              }}
              controls
              autoPlay
              playsInline
              onLoadedData={() => setImageLoaded(true)}
            />
          ) : currentIsAudio ? (
            <div
              className={`flex w-full max-w-xl flex-col items-center justify-center gap-6 rounded-[32px] border border-custom-light-purple/30 bg-custom-white/85 px-8 py-10 text-custom-black transition-all duration-700 ease-out transform dark:border-white/10 dark:bg-white/10 dark:text-white ${
                imageLoaded
                  ? "opacity-100 scale-100 translate-y-0"
                  : "opacity-0 scale-95 translate-y-4"
              }`}
              style={{
                maxWidth: isMobile ? "100vw" : "720px",
                filter: "drop-shadow(0 25px 50px rgba(0, 0, 0, 0.7))",
              }}
            >
              <div className="text-base font-semibold">
                Audio Result
              </div>
              <audio
                ref={audioRef}
                src={currentImage.url}
                controls
                autoPlay
                className="w-full"
                onLoadedData={() => setImageLoaded(true)}
              />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className={`max-w-full max-h-full object-contain transition-all duration-700 ease-out transform ${
                imageLoaded
                  ? "opacity-100 scale-100 translate-y-0"
                  : "opacity-0 scale-95 translate-y-4"
              }`}
              style={{
                maxWidth: isMobile ? "100vw" : "90vw",
                maxHeight: isMobile ? "100vh" : "90vh",
                filter: "drop-shadow(0 25px 50px rgba(0, 0, 0, 0.7))",
              }}
            />
          )}

          {/* 載入指示器 */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
              imageLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <div className="flex flex-col items-center gap-5 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl dark:bg-black/60">
              <div className="relative">
                <div
                  className={`${isMobile ? "w-12 h-12" : "w-12 h-12"} border-4 border-white/10 rounded-full`}
                ></div>
                <div
                  className={`absolute inset-0 ${
                    isMobile ? "w-12 h-12" : "w-12 h-12"
                  } border-4 border-transparent border-t-white rounded-full animate-spin`}
                ></div>
              </div>
              <p className="text-sm font-medium tracking-wide text-white">
                {texts.loading_image}
              </p>
            </div>
          </div>
        </div>

        <div
          className={`absolute left-0 right-0 top-0 z-10 transition-all duration-500 ease-out ${
            showControls ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"
          }`}
        >
          <div className={`${isMobile ? "p-3" : "p-6"} bg-gradient-to-b from-black/80 via-black/40 to-transparent`}>
            <div className="flex items-center justify-between text-white">
              <div
                className={`flex items-center ${isMobile ? "gap-2" : "gap-4"}`}
              >
                {/* 按讚按鈕 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReaction(currentImage.id, "like");
                  }}
                  title={texts.like_image}
                  className={`group flex items-center ${
                    isMobile ? "gap-2 px-3 py-2" : "gap-3 px-6 py-3"
                  } rounded-full transition-all duration-300 ease-out transform hover:scale-105 active:scale-95 ${
                    currentImage.userReaction?.like
                      ? "bg-custom-logo-purple text-white shadow-lg shadow-custom-logo-purple/30"
                      : "border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/18"
                  }`}
                >
                  <ThumbsUp
                    className={`${
                      isMobile ? "w-4 h-4" : "w-5 h-5"
                    } transition-transform duration-300 ${
                      currentImage.userReaction?.like
                        ? ""
                        : "group-hover:scale-110"
                    }`}
                  />
                  <span
                    className={`${
                      isMobile ? "text-xs" : "text-sm"
                    } font-semibold`}
                  >
                    {currentImage.reactions?.likes || 0}
                  </span>
                </button>

                {/* 收藏按鈕 */}
                {handleCollectReaction && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCollectClick();
                    }}
                    title={texts.collect_image}
                    className={`group flex items-center ${
                    isMobile ? "gap-2 px-3 py-2" : "gap-3 px-6 py-3"
                  } rounded-full transition-all duration-300 ease-out transform hover:scale-105 active:scale-95 ${
                    currentImage.userReaction?.collecting
                      ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                      : "border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/18"
                    }`}
                  >
                    <Heart
                      className={`${
                        isMobile ? "w-4 h-4" : "w-5 h-5"
                      } transition-transform duration-300 ${
                        currentImage.userReaction?.collecting
                          ? "fill-current"
                          : "group-hover:scale-110"
                      }`}
                    />
                  </button>
                )}

                {/* 留言按鈕 */}
                {/* {!isMobile && onComment && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCommentClick();
                    }}
                    title={
                      currentImage.userReaction?.comment
                        ? texts.has_comment
                        : texts.comment_image
                    }
                    className={`group flex items-center ${
                      isMobile ? "gap-2 px-3 py-2" : "gap-3 px-6 py-3"
                    } rounded-full transition-all duration-300 ease-out transform hover:scale-105 active:scale-95 ${
                      currentImage.userReaction?.comment
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                        : "bg-custom-white/80 dark:bg-white/20 hover:bg-emerald-500/30 border border-custom-light-purple/30 dark:border-white/20 backdrop-blur-md"
                    }`}
                  >
                    <MessageCircle
                      className={`${
                        isMobile ? "w-4 h-4" : "w-5 h-5"
                      } transition-transform duration-300 ${
                        currentImage.userReaction?.comment
                          ? "fill-current"
                          : "group-hover:scale-110"
                      }`}
                    />
                  </button>
                )} */}

                {/* 模型標籤 */}
                <div
                  className={`flex items-center ${
                    isMobile ? "gap-2 px-3 py-2" : "gap-3 px-4 py-2"
                  } rounded-full border border-white/20 bg-white/10 backdrop-blur-md`}
                >
                  <ShareIcon
                    className="fill-current text-white/80"
                    wrapperClassName={`${isMobile ? "w-4 h-4" : "w-5 h-5"}`}
                  />
                  <span
                    className={`${
                      isMobile ? "text-xs max-w-20 truncate" : "text-sm"
                    } font-medium text-white/90`}
                  >
                    {currentModelName}
                  </span>
                </div>

                {/* 圖片導航指示器 */}
                {/* {images.length > 1 && (
                  <div
                    className={`flex items-center ${
                      isMobile ? "gap-2 px-3 py-2" : "gap-2 px-4 py-2"
                    } bg-custom-white/70 dark:bg-white/10 backdrop-blur-md rounded-xl border border-custom-light-purple/30 dark:border-white/20`}
                  >
                    <span
                      className={`${
                        isMobile ? "text-xs" : "text-sm"
                      } font-medium text-custom-black/90 dark:text-white/90`}
                    >
                      {currentIndex + 1} / {images.length}
                    </span>
                  </div>
                )} */}
              </div>

              <div
                className={`flex items-center ${isMobile ? "gap-1" : "gap-3"}`}
              >
                {/* 信息按鈕 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInfo(!showInfo);
                    if (showInfo) {
                      setShowFullPrompt(false);
                    }
                  }}
                  title={showInfo ? texts.hide_info : texts.show_info}
                  className={`group ${isMobile ? "p-2" : "p-4"} rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 ${showInfo ? "bg-custom-logo-purple text-white shadow-lg shadow-custom-logo-purple/30 border-transparent" : "hover:bg-white/18"}`}
                >
                  <Info
                    className={`${
                      isMobile ? "w-4 h-4" : "w-6 h-6"
                    } transition-transform duration-300 ${
                      showInfo ? "" : "group-hover:scale-110"
                    }`}
                  />
                </button>

                {/* 分享按鈕 - 移到頂部控制列 */}
                <ShareDropdown
                  shareUrl={getShareData().url}
                  title={getShareData().title}
                  description={getShareData().description}
                  hashtag={getShareData().hashtag}
                  imageUrl={getShareData().imageUrl}
                  modelName={currentModelName}
                  imageId={currentImage.id}
                  onShareComplete={handleShareComplete}
                  className={`group ${isMobile ? "p-2" : "p-4"} h-full w-full flex items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 hover:bg-white/18`}
                  iconSize={`${isMobile ? "w-4 h-4" : "w-6 h-6"}`}
                />

                {/* 複製按鈕 */}
                {!isMobile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(currentPrompt);
                    }}
                    title={texts.copy_prompt}
                    className={`group ${
                      isMobile ? "p-2" : "p-4"
                    } rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 hover:bg-white/18`}
                  >
                    <Copy
                      className={`${
                        isMobile ? "w-4 h-4" : "w-6 h-6"
                      } group-hover:scale-110 transition-transform duration-300`}
                    />
                  </button>
                )}

                {/* 下載按鈕 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadImage();
                  }}
                  title={texts.download_image}
                  className={`group ${
                    isMobile ? "p-2" : "p-4"
                    } rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 hover:bg-white/18`}
                >
                  <Download
                    className={`${
                      isMobile ? "w-4 h-4" : "w-6 h-6"
                    } group-hover:scale-110 transition-transform duration-300`}
                  />
                </button>

                {/* 關閉按鈕 */}
                <button
                  onClick={handleClose}
                  title={texts.close_viewer}
                  className={`group ${
                    isMobile ? "p-2" : "p-4"
                    } rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 hover:bg-red-500/40 hover:border-red-400/30`}
                >
                  <X
                    className={`${
                      isMobile ? "w-4 h-4" : "w-6 h-6"
                    } group-hover:scale-110 transition-transform duration-300`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`absolute bottom-0 left-0 right-0 z-[1] transition-all duration-500 ease-out ${
            showInfo ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div
            className={`pointer-events-none bg-gradient-to-t from-black/90 via-black/50 to-transparent ${
              isMobile ? "p-4" : "p-8"
            }`}
          >
            <div
              className={`${
                isMobile ? "mx-auto" : "max-w-6xl mx-auto"
              } pointer-events-none text-white`}
            >
              <div
                className={`pointer-events-auto rounded-2xl border border-white/10 bg-black/30 backdrop-blur-lg ${
                  isMobile ? "p-4" : "p-6"
                }`}
              >
                <div className={`${isMobile ? "mb-4" : "mb-6"}`}>
                  <h3
                    className={`${isMobile ? "text-lg" : "text-xl"} mb-4 font-bold ${
                      isMobile ? "mb-3" : "mb-4"
                    } text-white`}
                  >
                    {texts.creation_prompt}
                  </h3>
                  <div className="relative">
                    <p
                      className={`${
                        isMobile ? "text-sm" : "text-base"
                      } pr-2 font-medium leading-relaxed text-white/90 ${
                        !showFullPrompt ? "line-clamp-3" : ""
                      }`}
                    >
                      {currentPrompt}
                    </p>
                    {currentPrompt && currentPrompt.length > 100 && (
                      <button
                        onClick={() => setShowFullPrompt(!showFullPrompt)}
                        className="mt-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
                      >
                        {showFullPrompt
                          ? t("show_less")
                          : `...${t("show_more")}`}
                      </button>
                    )}
                  </div>
                </div>

                {/* 留言內容顯示 */}
                {currentImage.userReaction?.comment && (
                  <div
                    className={`${
                      isMobile ? "mb-4 p-3" : "mb-6 p-4"
                    } rounded-xl border border-emerald-500/20 bg-emerald-500/10`}
                  >
                    <h4
                      className={`${
                        isMobile ? "text-xs" : "text-sm"
                      } mb-2 flex items-center gap-2 font-semibold text-emerald-300`}
                    >
                      <MessageCircle
                        className={`${isMobile ? "w-3 h-3" : "w-4 h-4"}`}
                      />
                      {texts.your_comment}
                    </h4>
                    <div
                      className={`${
                        isMobile ? "max-h-24" : "max-h-[8vh]"
                      } overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-400/60 dark:scrollbar-thumb-emerald-500/60 scrollbar-track-emerald-100/20 dark:scrollbar-track-emerald-800/20`}
                    >
                      <p
                        className={`${
                          isMobile ? "text-xs" : "text-sm"
                        } pr-2 leading-relaxed text-emerald-200`}
                      >
                        {currentImage.userReaction.comment}
                      </p>
                    </div>
                  </div>
                )}

                <div
                  className={`flex items-center ${
                    isMobile ? "gap-3 flex-wrap" : "gap-8"
                  } ${
                    isMobile ? "text-xs" : "text-sm"
                  } text-white/80`}
                >
                  {/* 按讚數顯示 */}
                  <div
                    className={`flex items-center ${
                      isMobile ? "gap-2 px-3 py-1" : "gap-3 px-4 py-2"
                      } rounded-full bg-white/10`}
                  >
                    <ThumbsUp
                      className={`${isMobile ? "w-4 h-4" : "w-5 h-5"}`}
                    />
                    <span className="font-semibold">
                      {currentImage.reactions?.likes || 0} {texts.likes}
                    </span>
                  </div>

                  {/* 收藏狀態顯示 */}
                  {handleCollectReaction && (
                    <div
                      className={`flex items-center ${
                        isMobile ? "gap-2 px-3 py-1" : "gap-3 px-4 py-2"
                      } rounded-full bg-white/10`}
                    >
                      <Heart
                        className={`${isMobile ? "w-4 h-4" : "w-5 h-5"} ${
                          currentImage.userReaction?.collecting
                            ? "fill-current text-red-500"
                            : ""
                        }`}
                      />
                      <span className="font-semibold">
                        {currentImage.userReaction?.collecting
                          ? t("collected")
                          : t("collect")}
                      </span>
                    </div>
                  )}

                  {/* 留言狀態顯示 */}
                  {onComment && (
                    <div
                      className={`flex items-center ${
                        isMobile ? "gap-2 px-3 py-1" : "gap-3 px-4 py-2"
                      } rounded-full bg-white/10`}
                    >
                      <MessageCircle
                        className={`${isMobile ? "w-4 h-4" : "w-5 h-5"} ${
                          currentImage.userReaction?.comment
                            ? "fill-current text-emerald-500"
                            : ""
                        }`}
                      />
                      <span className="font-semibold">
                        {currentImage.userReaction?.comment
                          ? texts.has_comment
                          : texts.comment_image}
                      </span>
                    </div>
                  )}

                  {/* 模型名稱顯示 */}
                  <div
                    className={`flex items-center ${
                      isMobile ? "gap-2 px-3 py-1" : "gap-3 px-4 py-2"
                      } rounded-full bg-white/10`}
                    >
                    <ShareIcon
                      className="fill-current"
                      wrapperClassName={`${isMobile ? "w-4 h-4" : "w-5 h-5"}`}
                    />
                    <span
                      className={`font-semibold ${
                        isMobile ? "max-w-16 truncate" : ""
                      }`}
                    >
                      {currentModelName}
                    </span>
                  </div>

                  {/* 圖片計數顯示 */}
                  {images.length > 1 && (
                    <div
                      className={`flex items-center ${
                        isMobile ? "gap-2 px-3 py-1" : "gap-3 px-4 py-2"
                      } rounded-xl bg-white/10`}
                    >
                      <span className="font-semibold">
                        {currentIndex + 1} of {images.length}{" "}
                        {isMobile ? "" : t("images")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {images.length > 1 && (
          <>
            <button
              title={texts.previous_image}
              className={`absolute ${
                isMobile ? "left-2 top-1/2" : "left-6 top-1/2"
              } transform -translate-y-1/2 group ${
                isMobile ? "p-3" : "p-5"
              } rounded-full border border-white/20 bg-black/40 text-white shadow-lg backdrop-blur-lg transition-all duration-400 ease-out hover:scale-125 hover:bg-white/10 active:scale-110 ${
                showControls
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-12"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(
                  (prev) => (prev - 1 + images.length) % images.length
                );
              }}
            >
              <ChevronLeft
                className={`${
                  isMobile ? "w-6 h-6" : "w-8 h-8"
                } group-hover:scale-110 transition-transform duration-300`}
              />
            </button>

            <button
              title={texts.next_image}
              className={`absolute ${
                isMobile ? "right-2 top-1/2" : "right-6 top-1/2"
              } transform -translate-y-1/2 group ${
                isMobile ? "p-3" : "p-5"
              } rounded-full border border-white/20 bg-black/40 text-white shadow-lg backdrop-blur-lg transition-all duration-400 ease-out hover:scale-125 hover:bg-white/10 active:scale-110 ${
                showControls
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-12"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev + 1) % images.length);
              }}
            >
              <ChevronRight
                className={`${
                  isMobile ? "w-6 h-6" : "w-8 h-8"
                } group-hover:scale-110 transition-transform duration-300`}
              />
            </button>
          </>
        )}

      </div>
    </div>
  );
};

export default ImageZoomViewer;
