import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { showToast } from "../CustomToast";
import { useLocale, useTranslations } from "next-intl";
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
  Sparkles,
  Music4,
} from "lucide-react";
import { ShareDropdown } from "../ShareDropdown";
import { getDownloadFileName } from "@/utils/getDownloadFileName";

const getAuthenticatedMediaUrl = (shortId?: string, fallbackUrl?: string) => {
  if (!shortId) return fallbackUrl || "";

  return `/media/${encodeURIComponent(shortId)}`;
};

const getMediaCandidates = (shortId?: string, fallbackUrl?: string) =>
  Array.from(
    new Set(
      [fallbackUrl || "", getAuthenticatedMediaUrl(shortId, fallbackUrl)].filter(Boolean)
    )
  );

const getMediaCrossOrigin = (url: string): "use-credentials" | undefined =>
  url.startsWith("/media/") ? "use-credentials" : undefined;

interface FlatImageRef {
  image: {
    url: string;
    shortId?: string;
    publishedImageId: string;
    userReaction: {
      like: boolean;
      dislike: boolean;
      collecting: boolean;
      comment?: string;
    };
    reactions: {
      likes: number;
      dislikes: number;
    };
  };
  groupPrompt: string;
  model?: {
    title: string;
  };
  kind?: string;
}

const ImageModal = ({
  imageRef,
  onClose,
  onPrevious,
  onNext,
  showPrevious,
  showNext,
  handleReaction,
  handleCollectReaction,
  // onComment,
}: {
  imageRef: FlatImageRef | null;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  showPrevious: boolean;
  showNext: boolean;
  handleReaction: (imageId: string, type: string) => void;
  handleCollectReaction: (imageId: string) => void;
  onComment?: (imageId: string) => void;
}): JSX.Element | null => {
  const lng = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const t = useTranslations("modelview");
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [activeMediaUrl, setActiveMediaUrl] = useState("");
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadErrorNotifiedRef = useRef(false);
  const imageDragStateRef = useRef<{ dragging: boolean; startX: number; startY: number; x: number; y: number }>({
    dragging: false,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
  });
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const mediaCandidates = useMemo(
    () => getMediaCandidates(imageRef?.image?.shortId, imageRef?.image?.url),
    [imageRef?.image?.shortId, imageRef?.image?.url]
  );
  const mediaUrl = activeMediaUrl || mediaCandidates[0] || "";
  const isVideoAsset =
    imageRef?.kind === "video" ||
    /\.(mp4|webm|mov|m4v)(\?|$)/i.test(imageRef?.image?.url || "");
  const isAudioAsset =
    imageRef?.kind === "audio" ||
    /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(imageRef?.image?.url || "");

  // 檢測移動設備
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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
  };

  useEffect(() => {
    loadErrorNotifiedRef.current = false;
    imageDragStateRef.current = { dragging: false, startX: 0, startY: 0, x: 0, y: 0 };
    setZoomScale(1);
    setZoomOffset({ x: 0, y: 0 });
  }, [imageRef?.image?.publishedImageId, imageRef?.image?.url]);

  const handleImageElementError = useCallback(() => {
    const currentIndex = mediaCandidates.indexOf(mediaUrl);
    const nextUrl = mediaCandidates[currentIndex + 1];

    if (nextUrl) {
      setActiveMediaUrl(nextUrl);
      return;
    }

    setImageLoaded(false);
    if (!loadErrorNotifiedRef.current) {
      loadErrorNotifiedRef.current = true;
      showToast(texts.image_loading_failed, true);
    }
  }, [mediaCandidates, mediaUrl, texts.image_loading_failed]);

  const clampZoomScale = (value: number) => Math.max(1, Math.min(4, value));

  const resetImageZoom = useCallback(() => {
    imageDragStateRef.current = { dragging: false, startX: 0, startY: 0, x: 0, y: 0 };
    setZoomScale(1);
    setZoomOffset({ x: 0, y: 0 });
  }, []);

  const handleImageWheel = useCallback((e: React.WheelEvent) => {
    if (isVideoAsset || isAudioAsset) return;
    e.preventDefault();
    e.stopPropagation();
    setZoomScale((prev) => {
      const next = clampZoomScale(prev + (e.deltaY > 0 ? -0.2 : 0.2));
      if (next === 1) {
        imageDragStateRef.current = { ...imageDragStateRef.current, x: 0, y: 0 };
        setZoomOffset({ x: 0, y: 0 });
      }
      return next;
    });
  }, [isAudioAsset, isVideoAsset]);

  const handleImageDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isVideoAsset || isAudioAsset) return;
    e.preventDefault();
    e.stopPropagation();
    setZoomScale((prev) => {
      if (prev > 1) {
        imageDragStateRef.current = { ...imageDragStateRef.current, x: 0, y: 0 };
        setZoomOffset({ x: 0, y: 0 });
        return 1;
      }
      return 2;
    });
  }, [isAudioAsset, isVideoAsset]);

  const handleImagePointerDown = useCallback((e: React.PointerEvent) => {
    if (zoomScale <= 1 || isVideoAsset || isAudioAsset) return;
    e.preventDefault();
    e.stopPropagation();
    imageDragStateRef.current = {
      dragging: true,
      startX: e.clientX - imageDragStateRef.current.x,
      startY: e.clientY - imageDragStateRef.current.y,
      x: imageDragStateRef.current.x,
      y: imageDragStateRef.current.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [isAudioAsset, isVideoAsset, zoomScale]);

  const handleImagePointerMove = useCallback((e: React.PointerEvent) => {
    if (!imageDragStateRef.current.dragging || zoomScale <= 1) return;
    e.preventDefault();
    e.stopPropagation();
    const next = {
      x: e.clientX - imageDragStateRef.current.startX,
      y: e.clientY - imageDragStateRef.current.startY,
    };
    imageDragStateRef.current = { ...imageDragStateRef.current, ...next };
    setZoomOffset(next);
  }, [zoomScale]);

  const handleImagePointerUp = useCallback((e: React.PointerEvent) => {
    if (!imageDragStateRef.current.dragging) return;
    imageDragStateRef.current.dragging = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  // 關閉處理函數
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

  // 鍵盤導航支援（僅桌面版）
  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          handleClose();
          break;
        case "ArrowLeft":
          if (showPrevious) onPrevious();
          break;
        case "ArrowRight":
          if (showNext) onNext();
          break;
        case "i":
        case "I":
          setShowInfo((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, onPrevious, onNext, showPrevious, showNext, isMobile]);

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

  // 處理留言點擊
  // const handleCommentClick = () => {
  //   if (imageRef && onComment) {
  //     onComment(imageRef.image.publishedImageId);
  //   }
  // };


  useEffect(() => {
    setActiveMediaUrl(mediaCandidates[0] || "");
    if (!isVideoAsset && !isAudioAsset) {
      setImageLoaded(false);
    }
  }, [isAudioAsset, isVideoAsset, mediaCandidates]);

  useEffect(() => {
    const mediaElement = isVideoAsset
      ? videoRef.current
      : isAudioAsset
        ? audioRef.current
        : null;

    if (!mediaElement || !mediaUrl) return;

    const handleMediaError = () => {
      const currentIndex = mediaCandidates.indexOf(mediaUrl);
      const nextUrl = mediaCandidates[currentIndex + 1];

      if (nextUrl) {
        setActiveMediaUrl(nextUrl);
        return;
      }

      showToast(texts.image_loading_failed, true);
    };

    mediaElement.addEventListener("error", handleMediaError);
    return () => mediaElement.removeEventListener("error", handleMediaError);
  }, [isAudioAsset, isVideoAsset, mediaCandidates, mediaUrl, texts.image_loading_failed]);

  useEffect(() => {
    if (imageRef && (isVideoAsset || isAudioAsset)) {
      setImageLoaded(true);
    }
  }, [imageRef, isVideoAsset, isAudioAsset]);

  // 複製到剪貼板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(texts.copied_success);
    } catch (error) {
      console.error("Copy failed:", error);
      showToast(texts.copy_failed, true);
    }
  };

  // 下載圖片
  const downloadImage = async () => {
    if (!imageRef) return;

    if (isVideoAsset || isAudioAsset) {
      try {
        const link = document.createElement("a");
        link.href = mediaUrl;
        link.download = `${imageRef.image.publishedImageId || (isAudioAsset ? "audio-result" : "video-result")}.${isAudioAsset ? "mp3" : "mp4"}`;
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

    try {
      // 使用統一的檔案名稱格式，包含模型編號
      const modelName = imageRef.model?.title || "unknown";
      const imageId = imageRef.image.publishedImageId || imageRef.image.shortId || Date.now().toString();
      const fileName = getDownloadFileName(modelName, imageId);

      // 使用改進的 Canvas 下載函數，iOS Safari 將顯示分享面板
      const { downloadImageFromCanvas } = await import('@/utils/downloadHelper');
      const result = await downloadImageFromCanvas(canvasRef.current, fileName, 0.95);

      if (result.success) {
        if (result.method === 'share') {
          showToast(t("imageSaveHint") || "請選擇「儲存圖片」保存到相簿");
        } else {
          showToast(texts.download_success);
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error("Download failed:", error);
      try {
        const { downloadImage: downloadOriginalImage } = await import('@/utils/downloadHelper');
        const modelName = imageRef.model?.title || "unknown";
        const imageId = imageRef.image.publishedImageId || imageRef.image.shortId || Date.now().toString();
        await downloadOriginalImage(mediaUrl, getDownloadFileName(modelName, imageId));
        showToast(texts.download_success);
      } catch (fallbackError) {
        console.error("Fallback download failed:", fallbackError);
        showToast(texts.download_failed, true);
      }
    }
  };

  // 準備分享數據
  const getShareData = () => {
    if (!imageRef) return {};

    return {
      url: `${process.env.NEXT_PUBLIC_URL}/${lng}/details/${imageRef.image.publishedImageId}`,
      title: t("share_image_title"),
      description: imageRef.groupPrompt,
      hashtag: "#AIArt #GeneratedImage",
      imageUrl: mediaUrl,
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

  if (!imageRef) return null;

  const modalContent = (
    <div
      className={`fixed inset-0 bg-black/[0.82] dark:bg-[rgba(10,10,10,0.86)] z-[2147483647] transition-all duration-300 ease-out ${isClosing ? "opacity-0 scale-105" : "opacity-100 scale-100"
        }`}
      style={{
        zIndex: 2147483647,
        isolation: "isolate",
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
          className={`flex items-center justify-center w-full h-full pointer-events-auto ${isMobile ? 'p-2' : 'p-4'}`}
          onWheel={handleImageWheel}
        >
          {isVideoAsset ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              crossOrigin={getMediaCrossOrigin(mediaUrl)}
              controls
              autoPlay
              playsInline
              className={`max-w-full max-h-full object-contain transition-all duration-700 ease-out transform ${
                imageLoaded ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
              }`}
              style={{
                maxWidth: isMobile ? "100vw" : "90vw",
                maxHeight: isMobile ? "100vh" : "90vh",
                filter: "drop-shadow(0 25px 50px rgba(0, 0, 0, 0.7))",
              }}
            />
          ) : isAudioAsset ? (
            <div className="flex w-full max-w-xl flex-col items-center justify-center gap-6 rounded-[32px] border border-white/10 bg-white/10 px-8 py-10 text-white backdrop-blur-2xl">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
                <Music4 className="h-8 w-8" />
              </div>
              <div className="text-center text-sm text-white/80">
                Audio Result
              </div>
              <audio
                ref={audioRef}
                src={mediaUrl}
                crossOrigin={getMediaCrossOrigin(mediaUrl)}
                controls
                autoPlay
                className="w-full"
              />
            </div>
          ) : (
            <>
              <img
                src={mediaUrl}
                alt="result"
                draggable={false}
                onLoad={() => setImageLoaded(true)}
                onError={handleImageElementError}
                onDoubleClick={handleImageDoubleClick}
                onPointerDown={handleImagePointerDown}
                onPointerMove={handleImagePointerMove}
                onPointerUp={handleImagePointerUp}
                onPointerCancel={handleImagePointerUp}
                className={`max-w-full max-h-full object-contain transition-opacity duration-300 ease-out transform ${
                  imageLoaded ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
                }`}
                style={{
                  maxWidth: isMobile ? "100vw" : "90vw",
                  maxHeight: isMobile ? "100vh" : "90vh",
                  filter: "drop-shadow(0 25px 50px rgba(0, 0, 0, 0.7))",
                  transform: `translate3d(${zoomOffset.x}px, ${zoomOffset.y}px, 0) scale(${zoomScale})`,
                  transformOrigin: "center center",
                  cursor: zoomScale > 1 ? "grab" : "zoom-in",
                  touchAction: zoomScale > 1 ? "none" : "pan-y",
                }}
              />
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}

          {/* 載入指示器 */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${imageLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
          >
            <div className="flex flex-col items-center gap-5 p-6 rounded-3xl bg-white/10 dark:bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-white/10 rounded-full"></div>
                <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-white rounded-full animate-spin"></div>
              </div>
              <p className="text-white text-sm font-medium tracking-wide">
                {texts.loading_image}
              </p>
            </div>
          </div>
        </div>

        {/* 絕對右上角關閉按鈕 */}
        <button
          onClick={handleClose}
          title={texts.close_viewer}
          className={`absolute ${isMobile ? 'top-4 right-4' : 'top-6 right-6'} z-50 rounded-full p-2.5 md:p-3 text-white/[0.68] transition-all duration-200 ease-out hover:bg-black/[0.32] hover:text-white active:scale-95 pointer-events-auto`}
        >
          <X className="w-5 h-5 md:w-6 md:h-6" />
        </button>

        {!isVideoAsset && !isAudioAsset && zoomScale > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetImageZoom();
            }}
            className="absolute right-6 top-20 z-50 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-md transition hover:bg-black/65 hover:text-white pointer-events-auto"
          >
            {Math.round(zoomScale * 100)}% · Reset
          </button>
        )}

        {/* 底部浮動式工具列 (Bottom Pill) */}
        <div
          className={`absolute ${isMobile ? 'bottom-6' : 'bottom-10'} left-1/2 -translate-x-1/2 z-50 pointer-events-auto transition-all duration-500 ease-out ${showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <div className="flex items-center gap-1.5 md:gap-2 rounded-full bg-black/10 px-2.5 py-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.06)]">
            {/* Info 切換 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowInfo(!showInfo);
                if (showInfo) setShowFullPrompt(false);
              }}
              title={showInfo ? texts.hide_info : texts.show_info}
              className={`rounded-full p-2.5 transition-all duration-200 ${showInfo ? "bg-white/[0.88] text-black shadow-sm" : "text-white/[0.62] hover:bg-white/[0.12] hover:text-white"}`}
            >
              <Info className="w-5 h-5" />
            </button>

            <div className="mx-0.5 h-4 w-px bg-white/10" />

            {/* 按讚 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReaction(imageRef.image.publishedImageId, "like");
              }}
              title={texts.like_image}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 transition-all duration-200 ${imageRef.image.userReaction?.like ? "bg-[#53c7ff]/16 text-[#53c7ff]" : "text-white/[0.62] hover:bg-white/[0.12] hover:text-white"}`}
            >
              <ThumbsUp className={`w-4 h-4 md:w-5 md:h-5 ${imageRef.image.userReaction?.like ? "fill-current" : ""}`} />
              <span className="text-xs font-semibold">{imageRef.image.reactions?.likes || 0}</span>
            </button>

            {/* 收藏 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCollectReaction(imageRef.image.publishedImageId);
              }}
              title={texts.collect_image}
              className={`rounded-full p-2.5 transition-all duration-200 ${imageRef.image.userReaction?.collecting ? "bg-red-500/12 text-red-400" : "text-white/[0.62] hover:bg-white/[0.12] hover:text-white"}`}
            >
              <Heart className={`w-5 h-5 ${imageRef.image.userReaction?.collecting ? "fill-current" : ""}`} />
            </button>

            <div className="mx-0.5 h-4 w-px bg-white/10" />

            {/* 複製提示詞 */}
            {!isMobile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(imageRef.groupPrompt || "");
                }}
                title={texts.copy_prompt}
                className="rounded-full p-2.5 text-white/[0.62] transition-all duration-200 hover:bg-white/[0.12] hover:text-white"
              >
                <Copy className="w-5 h-5" />
              </button>
            )}

            {/* 下載 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadImage();
              }}
              title={texts.download_image}
              className="rounded-full p-2.5 text-white/[0.62] transition-all duration-200 hover:bg-white/[0.12] hover:text-white"
            >
              <Download className="w-5 h-5" />
            </button>

            {/* 分享 */}
            <div className="flex items-center justify-center rounded-full p-1.5 transition-colors hover:bg-white/[0.12]">
              <ShareDropdown
                shareUrl={getShareData().url}
                title={getShareData().title}
                description={getShareData().description}
                hashtag={getShareData().hashtag}
                imageUrl={getShareData().imageUrl}
                modelName={imageRef.model?.title}
                imageId={imageRef.image.publishedImageId || imageRef.image.shortId}
                onShareComplete={handleShareComplete}
                className="flex items-center justify-center text-white/[0.62] hover:text-white"
                iconSize="w-5 h-5"
                usePortal
              />
            </div>
          </div>
        </div>

        {/* 提示詞資訊卡片 (浮動於 Pill 之上) */}
        <div
          className={`absolute ${isMobile ? 'bottom-20' : 'bottom-28'} left-1/2 -translate-x-1/2 w-[92%] max-w-xl z-40 transition-all duration-500 ease-out origin-bottom pointer-events-none ${showInfo ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"}`}
        >
          <div className="pointer-events-auto rounded-[28px] bg-black/10 p-5 shadow-[0_14px_36px_rgba(0,0,0,0.06)] md:p-6">
            <div className="mb-4 flex w-fit items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5 fill-current text-white/[0.72]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/[0.84]">
                {imageRef.model?.title}
              </span>
            </div>
            
            <h3 className="mb-2 text-base font-semibold text-white md:text-lg">
              {texts.creation_prompt}
            </h3>
            
            <div className="relative mb-4">
              <p className={`text-sm leading-[1.65] text-white/[0.74] md:text-base ${!showFullPrompt ? 'line-clamp-4' : ''}`}>
                {imageRef.groupPrompt}
              </p>
              {imageRef.groupPrompt && imageRef.groupPrompt.length > 150 && (
                <button
                  onClick={() => setShowFullPrompt(!showFullPrompt)}
                  className="mt-2 text-xs font-semibold text-white/[0.58] transition-colors hover:text-white/[0.88] md:text-sm"
                >
                  {showFullPrompt ? t("show_less") : t("show_more")}
                </button>
              )}
            </div>

            {imageRef.image.userReaction?.comment && (
              <div className="mt-4 rounded-xl bg-emerald-500/8 p-3.5">
                <h4 className="text-xs font-semibold text-emerald-400 mb-1.5 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5" />
                  {t("your_comment")}
                </h4>
                <p className="text-sm text-emerald-100 leading-relaxed max-h-24 overflow-y-auto no-scrollbar">
                  {imageRef.image.userReaction.comment}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 左/右導航按鈕 (懸浮，乾淨的毛玻璃) */}
        {showPrevious && (
          <button
            title={texts.previous_image}
            className={`absolute ${isMobile ? 'left-3' : 'left-8'} top-1/2 -translate-y-1/2 z-40 rounded-full p-3 text-white/[0.70] transition-all duration-200 ease-out hover:bg-black/[0.30] hover:text-white active:scale-95 md:p-4 pointer-events-auto ${showControls ? "opacity-100" : "opacity-0"}`}
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
          >
            <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
          </button>
        )}

        {showNext && (
          <button
            title={texts.next_image}
            className={`absolute ${isMobile ? 'right-3' : 'right-8'} top-1/2 -translate-y-1/2 z-40 rounded-full p-3 text-white/[0.70] transition-all duration-200 ease-out hover:bg-black/[0.30] hover:text-white active:scale-95 md:p-4 pointer-events-auto ${showControls ? "opacity-100" : "opacity-0"}`}
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
          >
            <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
          </button>
        )}

        {/* 鍵盤提示（僅桌面版，置於左下角） */}
        {!isMobile && (
          <div
            className={`absolute bottom-6 left-6 z-30 transition-all duration-500 ease-out ${showControls ? "opacity-50" : "opacity-0"}`}
          >
            <div className="flex items-center gap-3 text-white/50 text-[11px] font-medium pointer-events-none">
               <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white/10 rounded">ESC</kbd> 關閉</span>
               {(showPrevious || showNext) && <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white/10 rounded">←</kbd> <kbd className="px-1.5 py-0.5 bg-white/10 rounded">→</kbd> 下一張</span>}
               <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white/10 rounded">I</kbd> 資訊</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modalContent, document.body);
};

export default ImageModal;
