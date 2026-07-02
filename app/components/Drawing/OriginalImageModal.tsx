import React, { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

// 原圖放大查看器 - 獨立介面
interface OriginalImageModalProps {
  imageUrl: string;
  onClose: () => void;
}

export const OriginalImageModal: React.FC<OriginalImageModalProps> = ({
  imageUrl,
  onClose,
}) => {
  const t = useTranslations("imageViewer");
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  // 使用 ref 避免重新渲染
  const positionRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isVideoAsset = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(imageUrl);

  // 檢測移動設備
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 控制項自動隱藏
  useEffect(() => {
    if (isMobile) {
      setShowControls(true);
      return;
    }
    const handleMouseMove = () => {
      setShowControls(true);
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);
    };
    window.addEventListener('mousemove', handleMouseMove);
    handleMouseMove();
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    };
  }, [isMobile]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onClose(), 200);
  }, [onClose]);

  const handleZoomIn = useCallback(() => {
    setScale(prev => {
      const newScale = Math.min(prev + 0.5, 5);
      requestAnimationFrame(() => {
        if (imgRef.current) {
          imgRef.current.style.transform = `scale(${newScale}) translate(${positionRef.current.x / newScale}px, ${positionRef.current.y / newScale}px) rotate(${rotation}deg)`;
        }
      });
      return newScale;
    });
  }, [rotation]);

  const handleZoomOut = useCallback(() => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.5, 0.5);
      requestAnimationFrame(() => {
        if (imgRef.current) {
          imgRef.current.style.transform = `scale(${newScale}) translate(${positionRef.current.x / newScale}px, ${positionRef.current.y / newScale}px) rotate(${rotation}deg)`;
        }
      });
      return newScale;
    });
  }, [rotation]);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setRotation(0);
    positionRef.current = { x: 0, y: 0 };
    if (imgRef.current) {
      imgRef.current.style.transform = 'scale(1) translate(0px, 0px) rotate(0deg)';
    }
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => {
      const newRotation = (prev + 90) % 360;
      requestAnimationFrame(() => {
        if (imgRef.current) {
          imgRef.current.style.transform = `scale(${scale}) translate(${positionRef.current.x / scale}px, ${positionRef.current.y / scale}px) rotate(${newRotation}deg)`;
        }
      });
      return newRotation;
    });
  }, [scale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.clientX - positionRef.current.x,
        y: e.clientY - positionRef.current.y
      };
    }
  }, [scale]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current && scale > 1 && imgRef.current) {
      positionRef.current = {
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      };
      imgRef.current.style.transform = `scale(${scale}) translate(${positionRef.current.x / scale}px, ${positionRef.current.y / scale}px) rotate(${rotation}deg)`;
    }
  }, [scale, rotation]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: e.touches[0].clientX - positionRef.current.x,
        y: e.touches[0].clientY - positionRef.current.y
      };
    }
  }, [scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDraggingRef.current && e.touches.length === 1 && scale > 1 && imgRef.current) {
      positionRef.current = {
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y
      };
      imgRef.current.style.transform = `scale(${scale}) translate(${positionRef.current.x / scale}px, ${positionRef.current.y / scale}px) rotate(${rotation}deg)`;
    }
  }, [scale, rotation]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale(prev => {
      const newScale = Math.max(0.5, Math.min(5, prev + delta));
      requestAnimationFrame(() => {
        if (imgRef.current) {
          imgRef.current.style.transform = `scale(${newScale}) translate(${positionRef.current.x / newScale}px, ${positionRef.current.y / newScale}px) rotate(${rotation}deg)`;
        }
      });
      return newScale;
    });
  }, [rotation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': handleClose(); break;
        case '+': case '=': handleZoomIn(); break;
        case '-': handleZoomOut(); break;
        case '0': handleResetZoom(); break;
        case 'r': case 'R': handleRotate(); break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [handleClose, handleZoomIn, handleZoomOut, handleResetZoom, handleRotate]);

  const modalContent = (
    <div 
      className={`fixed inset-0 bg-custom-gray/95 dark:bg-custom-white-dark z-[2147483647] transition-all duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
      style={{ zIndex: 2147483647, isolation: 'isolate', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
    >
      <div 
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: scale > 1 ? (isDraggingRef.current ? 'grabbing' : 'grab') : 'default' }}
      >
        {isVideoAsset ? (
          <video
            ref={videoRef}
            src={imageUrl}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              maxWidth: isMobile ? '95vw' : '90vw',
              maxHeight: isMobile ? '85vh' : '90vh',
              filter: 'drop-shadow(0 25px 50px rgba(0, 0, 0, 0.5))',
            }}
            controls
            autoPlay
            playsInline
            onLoadedData={() => setImageLoaded(true)}
          />
        ) : (
          <img
            ref={imgRef}
            src={imageUrl}
            alt="原圖放大"
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `scale(${scale}) translate(0px, 0px) rotate(${rotation}deg)`,
              maxWidth: isMobile ? '95vw' : '90vw',
              maxHeight: isMobile ? '85vh' : '90vh',
              filter: 'drop-shadow(0 25px 50px rgba(0, 0, 0, 0.5))',
              transition: 'none',
              willChange: 'transform'
            }}
            onLoad={() => setImageLoaded(true)}
            draggable={false}
          />
        )}

        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`flex flex-col items-center gap-6 ${isMobile ? 'p-6' : 'p-8'} rounded-2xl bg-custom-white/90 dark:bg-black/60 backdrop-blur-lg border border-custom-light-purple/30 dark:border-white/20`}>
              <div className="relative">
                <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} border-4 border-custom-light-purple/30 dark:border-white/20 rounded-full`}></div>
                <div className={`absolute inset-0 ${isMobile ? 'w-12 h-12' : 'w-16 h-16'} border-4 border-transparent border-t-custom-logo-purple dark:border-t-custom-logo-purple-dark rounded-full animate-spin`}></div>
              </div>
              <p className={`text-custom-black dark:text-white ${isMobile ? 'text-base' : 'text-lg'} font-medium`}>載入中...</p>
            </div>
          </div>
        )}
      </div>

      <div className={`absolute z-10 top-0 left-0 right-0 transition-all duration-500 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}>
        <div className={`bg-gradient-to-b from-custom-gray/80 via-custom-gray/40 to-transparent dark:from-black/80 dark:via-black/40 ${isMobile ? 'p-3' : 'p-6'}`}>
          <div className="flex items-center justify-between">
            <div className={`${isMobile ? 'px-3 py-1.5' : 'px-4 py-2'} bg-custom-white/80 dark:bg-white/20 backdrop-blur-md rounded-full border border-custom-light-purple/30 dark:border-white/20 text-custom-black dark:text-white ${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>
              {Math.round(scale * 100)}%
            </div>

            <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-2'}`}>
              <button onClick={handleZoomIn} disabled={scale >= 5} className={`${isMobile ? 'p-2' : 'p-3'} bg-custom-white/70 dark:bg-white/20 hover:bg-custom-logo-purple/30 dark:hover:bg-custom-logo-purple-dark/30 disabled:opacity-50 rounded-full transition-all backdrop-blur-md border border-custom-light-purple/30 dark:border-white/20`} title={t("zoom_in")}>
                <svg className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
              </button>
              <button onClick={handleZoomOut} disabled={scale <= 0.5} className={`${isMobile ? 'p-2' : 'p-3'} bg-custom-white/70 dark:bg-white/20 hover:bg-custom-logo-purple/30 dark:hover:bg-custom-logo-purple-dark/30 disabled:opacity-50 rounded-full transition-all backdrop-blur-md border border-custom-light-purple/30 dark:border-white/20`} title={t("zoom_out")}>
                <svg className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
              </button>
              <button onClick={handleResetZoom} className={`${isMobile ? 'p-2' : 'p-3'} bg-custom-white/70 dark:bg-white/20 hover:bg-custom-logo-purple/30 dark:hover:bg-custom-logo-purple-dark/30 rounded-full transition-all backdrop-blur-md border border-custom-light-purple/30 dark:border-white/20`} title={t("reset_zoom")}>
                <svg className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              </button>
              <button onClick={handleRotate} className={`${isMobile ? 'p-2' : 'p-3'} bg-custom-white/70 dark:bg-white/20 hover:bg-custom-logo-purple/30 dark:hover:bg-custom-logo-purple-dark/30 rounded-full transition-all backdrop-blur-md border border-custom-light-purple/30 dark:border-white/20`} title={t("rotate")}>
                <svg className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              <button onClick={handleClose} className={`${isMobile ? 'p-2' : 'p-3'} bg-custom-white/70 dark:bg-white/20 hover:bg-red-500/40 rounded-full transition-all backdrop-blur-md border border-custom-light-purple/30 dark:border-white/20`} title={t("close")}>
                <svg className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {!isMobile && (
        <div className={`absolute bottom-6 right-6 transition-all duration-500 ${showControls ? 'opacity-80' : 'opacity-0'}`}>
          <div className="bg-custom-white/70 dark:bg-black/50 backdrop-blur-lg text-custom-black dark:text-white text-xs px-4 py-3 rounded-xl border border-custom-light-purple/30 dark:border-white/20">
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold opacity-70 mb-2">{t("keyboard_shortcuts")}</div>
              <div className="flex gap-2"><kbd className="px-2 py-0.5 bg-custom-light-purple/50 dark:bg-white/20 rounded text-[10px]">ESC</kbd><span className="text-[11px]">{t("close")}</span></div>
              <div className="flex gap-2"><kbd className="px-2 py-0.5 bg-custom-light-purple/50 dark:bg-white/20 rounded text-[10px]">+/-</kbd><span className="text-[11px]">{t("zoom")}</span></div>
              <div className="flex gap-2"><kbd className="px-2 py-0.5 bg-custom-light-purple/50 dark:bg-white/20 rounded text-[10px]">0</kbd><span className="text-[11px]">{t("reset")}</span></div>
              <div className="flex gap-2"><kbd className="px-2 py-0.5 bg-custom-light-purple/50 dark:bg-white/20 rounded text-[10px]">R</kbd><span className="text-[11px]">{t("rotate")}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modalContent, document.body);
};
