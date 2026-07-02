import React, { useRef, useEffect, useState } from "react";
import { ShareIcon } from "../../icon/ShareIcon";
import { showToast } from "../CustomToast";
import { useTranslations } from "next-intl";
import { ThumbsUp, X, ChevronLeft, ChevronRight, Copy, Info } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useTermsAgreement } from "@/app/hooks/useTermsAgreement";
import CopyrightNoticeDialog from "../CopyrightNoticeDialog";
import { addWatermark } from "@/app/utils/watermark";
import { ShareDropdown } from "../ShareDropdown";


export const WATERMARK = {
  margin: 30,
  logoDrawSize: 38,
  svgViewBoxSize: 342,
  textOffsetX: 3,
  textOffsetY: 3,
};

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

interface ImageZoomSingleViewerProps {
  currentImage: ImageData;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  showPrevious: boolean;
  showNext: boolean;
  handleReaction: (imageId: string, type: string) => void;
}

const ImageZoomSingleViewer: React.FC<ImageZoomSingleViewerProps> = ({
  currentImage,
  onClose,
  onPrevious,
  onNext,
  showPrevious,
  showNext,
  handleReaction,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { user } = useAuth();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const t = useTranslations("modelview");

  // 版權保護相關
  const {
    isDialogOpen,
    setIsDialogOpen,
    checkTermsAgreement,
    handleAgree,
  } = useTermsAgreement();

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
    copied_success: t("copied_success"),
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
    keyboard_shortcuts: t("keyboard_shortcuts")
  };

  // 鍵盤導航支援（僅桌面版）
  useEffect(() => {
    if (isMobile) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleClose();
          break;
        case 'ArrowLeft':
          if (showPrevious) onPrevious();
          break;
        case 'ArrowRight':
          if (showNext) onNext();
          break;
        case 'i':
        case 'I':
          setShowInfo(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrevious, onNext, showPrevious, showNext, isMobile]);

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

    window.addEventListener('mousemove', handleMouseMove);
    handleMouseMove();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
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

  // 版權保護的複製功能
  const handleCopy = () => {
    checkTermsAgreement(() => copyToClipboard(currentImage?.task?.prompt || ""));
  };

  // // 版權保護的下載功能
  // const handleDownload = () => {
  //   checkTermsAgreement(downloadImage);
  // };

  const loadImage = async () => {
    if (!currentImage || !canvasRef.current) return;

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
        img.src = currentImage.publishedImage.url;
      });

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);
      await addWatermark(ctx, img.width, img.height);
      setImageLoaded(true);
    } catch (error) {
      console.error("Image loading failed:", error);
      showToast(texts.image_loading_failed, true);
    }
  };

  useEffect(() => {
    loadImage();
  }, [currentImage]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(texts.copied_success);
    } catch (error) {
      console.error("Copy failed:", error);
      showToast(texts.copy_failed, true);
    }
  };


  // 準備分享數據
  const getShareData = () => {
    if (!currentImage) return {};

    // 從當前 URL 獲取語言，避免使用 useLocale
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const pathSegments = currentPath.split('/').filter(Boolean);
    const currentLang = pathSegments[0] || 'zh-TW'; // 預設為繁體中文

    return {
      url: `${process.env.NEXT_PUBLIC_URL}/${currentLang}/details/${currentImage.publishedImage.id}`,
      title: t("share_image_title") || "查看這個精彩的 AI 生成圖片！",
      description: currentImage.task.prompt || "這是一個令人驚豔的 AI 創作",
      hashtag: "#AIArt #GeneratedImage",
      imageUrl: currentImage.publishedImage.url,
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
      className={`fixed inset-0 bg-custom-gray/95 dark:bg-custom-white-dark z-50 transition-all duration-300 ease-out ${
        isClosing ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
    >
      {/* 點擊背景關閉 */}
      <div 
        className="absolute inset-0 cursor-pointer"
        onClick={handleClose}
      />

      {/* 主容器 */}
      <div className="relative w-full h-full flex items-center justify-center">
        
        {/* 圖片展示區域 */}
        <div className={`flex items-center justify-center w-full h-full ${isMobile ? 'p-2' : 'p-4'}`}>
          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-full object-contain transition-all duration-700 ease-out transform ${
              imageLoaded 
                ? 'opacity-100 scale-100 translate-y-0' 
                : 'opacity-0 scale-95 translate-y-4'
            }`}
            style={{
              maxWidth: isMobile ? '95vw' : '90vw',
              maxHeight: isMobile ? '85vh' : '90vh',
              filter: 'drop-shadow(0 25px 50px rgba(0, 0, 0, 0.5))'
            }}
          />
          
          {/* 載入指示器 */}
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            imageLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}>
            <div className={`flex flex-col items-center gap-6 ${isMobile ? 'p-6' : 'p-8'} rounded-2xl bg-custom-white/90 dark:bg-black/60 backdrop-blur-lg border border-custom-light-purple/30 dark:border-white/20`}>
              <div className="relative">
                <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} border-4 border-custom-light-purple/30 dark:border-white/20 rounded-full`}></div>
                <div className={`absolute inset-0 ${isMobile ? 'w-12 h-12' : 'w-16 h-16'} border-4 border-transparent border-t-custom-logo-purple dark:border-t-custom-logo-purple-dark rounded-full animate-spin`}></div>
              </div>
              <p className={`text-custom-black dark:text-white ${isMobile ? 'text-base' : 'text-lg'} font-medium`}>
                {texts.loading_image}
              </p>
            </div>
          </div>
        </div>

        {/* 頂部控制列 */}
        <div className={`absolute z-10 top-0 left-0 right-0 transition-all duration-500 ease-out ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'
        }`}>
          <div className={`bg-gradient-to-b from-custom-gray/80 via-custom-gray/40 to-transparent dark:from-black/80 dark:via-black/40 ${isMobile ? 'p-3' : 'p-6'}`}>
            <div className="flex items-center justify-between text-custom-black dark:text-white">
              <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-4'}`}>
                {user && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReaction(currentImage.publishedImage.id, "like");
                    }}
                    title={texts.like_image}
                    className={`group flex items-center ${isMobile ? 'gap-2 px-3 py-2' : 'gap-3 px-6 py-3'} rounded-full transition-all duration-300 ease-out transform hover:scale-105 active:scale-95 ${
                      currentImage.publishedImage.userReaction?.like
                        ? 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-white shadow-lg shadow-custom-logo-purple/30 dark:shadow-custom-logo-purple-dark/30'
                        : 'bg-custom-white/80 dark:bg-white/20 hover:bg-custom-logo-purple/30 dark:hover:bg-custom-logo-purple-dark/30 border border-custom-light-purple/30 dark:border-white/20 backdrop-blur-md'
                    }`}
                  >
                    <ThumbsUp className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} transition-transform duration-300 ${
                      currentImage.publishedImage.userReaction?.like ? '' : 'group-hover:scale-110'
                    }`} />
                    <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold`}>
                      {currentImage.publishedImage.reactions.likes}
                    </span>
                  </button>
                )}
                
                <div className={`flex items-center ${isMobile ? 'gap-2 px-3 py-2' : 'gap-3 px-4 py-2'} bg-custom-white/70 dark:bg-white/10 backdrop-blur-md rounded-full border border-custom-light-purple/30 dark:border-white/20`}>
                  <ShareIcon
                    className="fill-current text-custom-black/80 dark:text-white/80"
                    wrapperClassName={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`}
                  />
                  <span className={`${isMobile ? 'text-xs max-w-20 truncate' : 'text-sm'} font-medium text-custom-black/90 dark:text-white/90`}>
                    {currentImage?.task?.loraModelTitle}
                  </span>
                </div>
              </div>

              <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-3'}`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInfo(!showInfo);
                    // 當隱藏資訊時，同時收起完整內容
                    if (showInfo) {
                      setShowFullPrompt(false);
                    }
                  }}
                  title={showInfo ? texts.hide_info : texts.show_info}
                  className={`group ${isMobile ? 'p-2' : 'p-4'} rounded-full transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 ${
                    showInfo 
                      ? 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-white shadow-lg shadow-custom-logo-purple/30 dark:shadow-custom-logo-purple-dark/30' 
                      : 'bg-custom-white/70 dark:bg-white/20 hover:bg-custom-logo-purple/30 dark:hover:bg-custom-logo-purple-dark/30 border border-custom-light-purple/30 dark:border-white/20 backdrop-blur-md'
                  }`}
                >
                  <Info className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} transition-transform duration-300 ${
                    showInfo ? '' : 'group-hover:scale-110'
                  }`} />
                </button>

                {/* 複製按鈕 - 帶版權保護 */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy();
                  }}
                  title={texts.copy_prompt}
                  className={`group ${isMobile ? 'p-2' : 'p-4'} bg-custom-white/70 dark:bg-white/20 hover:bg-custom-logo-purple/30 dark:hover:bg-custom-logo-purple-dark/30 rounded-full transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 border border-custom-light-purple/30 dark:border-white/20 backdrop-blur-md`}
                >
                  <Copy className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} group-hover:scale-110 transition-transform duration-300`} />
                </button>


                {/* 分享按鈕 - 移到頂部控制列 */}
                <ShareDropdown
                  shareUrl={getShareData().url}
                  title={getShareData().title}
                  description={getShareData().description}
                  hashtag={getShareData().hashtag}
                  imageUrl={getShareData().imageUrl}
                  modelName={currentImage?.task?.loraModelTitle}
                  imageId={currentImage.publishedImage.id}
                  onShareComplete={handleShareComplete}
                  className={`group ${
                    isMobile ? "p-2" : "p-4"
                  } bg-custom-white/70 dark:bg-white/20 hover:bg-custom-logo-purple/30 dark:hover:bg-custom-logo-purple-dark/30 rounded-full transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 border border-custom-light-purple/30 dark:border-white/20 backdrop-blur-md w-full h-full flex items-center justify-center`}
                  enableWatermark={true} // 在主頁啟用浮水印
                  iconSize={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'}`} // 與其他按鈕保持一致的圖示大小
                />

                <button
                  onClick={handleClose}
                  title={texts.close_viewer}
                  className={`group ${isMobile ? 'p-2' : 'p-4'} bg-custom-white/70 dark:bg-white/20 hover:bg-red-500/40 rounded-full transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 border border-custom-light-purple/30 dark:border-white/20 hover:border-red-400/30 backdrop-blur-md`}
                >
                  <X className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'} group-hover:scale-110 transition-transform duration-300`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 信息面板 */}
        <div className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ease-out ${
          showInfo ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'
        }`}>
          <div className={`bg-gradient-to-t from-custom-gray/90 via-custom-gray/50 to-transparent dark:from-black/90 dark:via-black/50 pointer-events-none ${isMobile ? 'p-4' : 'p-8'}`}>
            <div className={`${isMobile ? 'mx-auto' : 'max-w-6xl mx-auto'} text-custom-black dark:text-white pointer-events-none`}>
              <div className={`bg-custom-white/80 dark:bg-black/30 backdrop-blur-lg rounded-2xl ${isMobile ? 'p-4' : 'p-6'} border border-custom-light-purple/30 dark:border-white/10 pointer-events-auto`}>
                <div className={`${isMobile ? 'mb-4' : 'mb-6'}`}>
                  <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold ${isMobile ? 'mb-3' : 'mb-4'} text-custom-black dark:text-white`}>
                    {texts.creation_prompt}
                  </h3>
                  <div className="relative">
                    <p className={`${isMobile ? 'text-sm' : 'text-base'} leading-relaxed text-custom-black/90 dark:text-white/90 font-medium pr-2 ${
                      !showFullPrompt ? 'line-clamp-3' : ''
                    }`}>
                      {currentImage?.task?.prompt}
                    </p>
                    {currentImage?.task?.prompt && currentImage.task.prompt.length > 100 && (
                      <button
                        onClick={() => setShowFullPrompt(!showFullPrompt)}
                        className="mt-2 text-custom-logo-purple dark:text-custom-logo-purple-dark hover:text-custom-logo-purple/80 dark:hover:text-custom-logo-purple-dark/80 text-sm font-medium transition-colors"
                      >
                        {showFullPrompt ? t("show_less") : `...${t("show_more")}`}
                      </button>
                    )}
                  </div>
                </div>
                
                <div className={`flex items-center flex-wrap ${isMobile ? 'gap-4' : 'gap-8'} ${isMobile ? 'text-xs' : 'text-sm'} text-custom-black/80 dark:text-white/80`}>
                  <div className={`flex items-center ${isMobile ? 'gap-2 px-3 py-1' : 'gap-3 px-4 py-2'} bg-custom-light-purple/50 dark:bg-white/10 rounded-full`}>
                    <ThumbsUp className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                    <span className="font-semibold">
                      {currentImage.publishedImage.reactions.likes} {texts.likes}
                    </span>
                  </div>
                  <div className={`flex items-center ${isMobile ? 'gap-2 px-3 py-1' : 'gap-3 px-4 py-2'} bg-custom-light-purple/50 dark:bg-white/10 rounded-full`}>
                    <ShareIcon
                      className="fill-current"
                      wrapperClassName={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`}
                    />
                    <span className={`font-semibold ${isMobile ? 'max-w-16 truncate' : ''}`}>{currentImage?.task?.loraModelTitle}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 導航按鈕 */}
        {showPrevious && (
          <button
            title={texts.previous_image}
            className={`absolute ${isMobile ? 'left-2 top-1/2' : 'left-6 top-1/2'} transform -translate-y-1/2 group ${isMobile ? 'p-3' : 'p-5'} bg-custom-white/70 dark:bg-black/40 backdrop-blur-lg hover:bg-custom-logo-purple/50 dark:hover:bg-custom-logo-purple-dark/30 text-custom-black dark:text-white rounded-full transition-all duration-400 ease-out hover:scale-125 active:scale-110 border border-custom-light-purple/30 dark:border-white/20 shadow-lg ${
              showControls ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
          >
            <ChevronLeft className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} group-hover:scale-110 transition-transform duration-300`} />
          </button>
        )}

        {showNext && (
          <button
            title={texts.next_image}
            className={`absolute ${isMobile ? 'right-2 top-1/2' : 'right-6 top-1/2'} transform -translate-y-1/2 group ${isMobile ? 'p-3' : 'p-5'} bg-custom-white/70 dark:bg-black/40 backdrop-blur-lg hover:bg-custom-logo-purple/50 dark:hover:bg-custom-logo-purple-dark/30 text-custom-black dark:text-white rounded-full transition-all duration-400 ease-out hover:scale-125 active:scale-110 border border-custom-light-purple/30 dark:border-white/20 shadow-lg ${
              showControls ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
          >
            <ChevronRight className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} group-hover:scale-110 transition-transform duration-300`} />
          </button>
        )}

        {/* 鍵盤提示（僅桌面版） */}
        {!isMobile && (
          <div className={`absolute bottom-6 right-6 transition-all duration-500 ease-out ${
            showControls ? 'opacity-80 translate-y-0' : 'opacity-0 translate-y-6'
          }`}>
            <div className="bg-custom-white/70 dark:bg-black/50 backdrop-blur-lg text-custom-black dark:text-white text-sm px-5 py-3 rounded-xl border border-custom-light-purple/30 dark:border-white/20 shadow-lg">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-custom-black/70 dark:text-white/70 mb-2">
                  {texts.keyboard_shortcuts}
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-custom-light-purple/50 dark:bg-white/20 rounded text-xs font-mono">←</kbd>
                  <kbd className="px-2 py-1 bg-custom-light-purple/50 dark:bg-white/20 rounded text-xs font-mono">→</kbd>
                  <span>{texts.navigate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-custom-light-purple/50 dark:bg-white/20 rounded text-xs font-mono">I</kbd>
                  <span>{texts.toggle_info}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 版權通知彈窗 */}
      <CopyrightNoticeDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onAgree={handleAgree}
      />
    </div>
  );
};

export default ImageZoomSingleViewer;