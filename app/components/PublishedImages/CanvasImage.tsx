import React, { useRef, useEffect } from "react";
import { addWatermark } from "@/app/utils/watermark";

interface CanvasImageProps {
  src: string;
  alt: string;
  className?: string;
}

const CanvasImage: React.FC<CanvasImageProps> = ({ src, alt, className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadImage = async () => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = src;
      });

      // 設置 Canvas 大小為容器大小
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;

      // 計算縮放和裁剪參數以實現 objectFit: "cover"
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const offsetX = (canvas.width - scaledWidth) / 2;
      const offsetY = (canvas.height - scaledHeight) / 2;

      // 繪製圖片
      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
      await addWatermark(ctx, canvas.width, canvas.height);
    } catch (error) {
      console.error("Image loading failed:", error);
    }
  };

  useEffect(() => {
    loadImage();
    
    // 監聽容器大小變化
    const resizeObserver = new ResizeObserver(() => {
      loadImage();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [src]);

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg"
        aria-label={alt}
      />
    </div>
  );
};

export default CanvasImage;