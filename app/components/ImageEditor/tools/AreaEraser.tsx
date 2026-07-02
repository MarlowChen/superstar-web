import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Trash2 } from 'lucide-react';
import { showToast } from "@/app/components/CustomToast";
import { AreaEraseData, defaultAreaEraseData, eraseAreas } from '../../../services/areaEraserApi';
import { toast } from 'react-toastify';
import { useTranslations } from "next-intl";

// 節流函數
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const throttle = (func: (...args: any[]) => void, limit: number) => {
  let inThrottle: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (...args: any[]) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

export interface AreaEraserArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 繪製路徑點介面
interface DrawPoint {
  x: number;
  y: number;
  brushSize: number;
  timestamp: number;
}

interface AreaEraserProps {
  isActive: boolean;
  canvas?: HTMLCanvasElement | null;
  brushPreviewCanvas?: HTMLCanvasElement | null;
  isMobile: boolean;
  canvasSize?: { width: number; height: number };
  brushSize?: number;
  setBrushSize?: (size: number) => void;
  onClose: () => void;
  onComplete?: (result: { selectedAreas: AreaEraserArea[]; eraserData: AreaEraseData }) => void;
  onEventHandlersReady?: (handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
  }) => void;
  imageId?: string; // 添加圖片ID用於API調用
  onClearFunctionReady?: (clearFunction: () => Promise<void>) => void; // 暴露清除函數
  originalImageUrl?: string; // 添加原始圖片URL
}

const AreaEraser: React.FC<AreaEraserProps> = ({ 
  isActive, 
  canvas,
  brushPreviewCanvas,
  isMobile,
  // canvasSize, // 暫時未使用
  brushSize = 20,
  setBrushSize,
  onClose,
  onComplete,
  onEventHandlersReady,
  imageId,
  onClearFunctionReady,
  originalImageUrl
}) => {
  const t = useTranslations("imageEditor");
  const [isEraserActive, setIsEraserActive] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<AreaEraserArea[]>([]);
  const [eraserData] = useState<AreaEraseData>(defaultAreaEraseData);
  const [drawPath, setDrawPath] = useState<DrawPoint[]>([]); // 記錄繪製路徑
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isProcessing, setIsProcessing] = useState(false); // 處理狀態 - 用於清除操作
  
  // 覆蓋層 Canvas ref - 用於橡皮擦繪製，不影響主 Canvas
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // 簡化的 refs
  const isDrawingRef = useRef<boolean>(false);
  const lastDrawPosRef = useRef<{ x: number; y: number } | null>(null);
  const brushSizeRef = useRef(brushSize);
  brushSizeRef.current = brushSize;
  
  // 高度優化的繪製函數 - 使用精確的整數運算 Bresenham 算法
  const drawLineBetween = useCallback((ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
    const currentBrushSize = brushSizeRef.current;
    
    // 使用精確的整數運算 Bresenham 算法
    let x0_int = Math.round(x0);
    let y0_int = Math.round(y0);
    let x1_int = Math.round(x1);
    let y1_int = Math.round(y1);
    
    // 檢查是否需要交換 x 和 y（處理陡峭線段）
    const steep = Math.abs(y1_int - y0_int) > Math.abs(x1_int - x0_int);
    if (steep) {
      [x0_int, y0_int] = [y0_int, x0_int];
      [x1_int, y1_int] = [y1_int, x1_int];
    }
    
    // 確保 x0 <= x1
    if (x0_int > x1_int) {
      [x0_int, x1_int] = [x1_int, x0_int];
      [y0_int, y1_int] = [y1_int, y0_int];
    }
    
    const deltax = x1_int - x0_int;
    const deltay = Math.abs(y1_int - y0_int);
    let error = deltax / 2; // 初始誤差為 deltax/2
    const ystep = y0_int < y1_int ? 1 : -1;
    let y = y0_int;
    
    // 批量繪製點，減少 save/restore 調用
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
    
    for (let x = x0_int; x <= x1_int; x++) {
      // 根據是否陡峭決定繪製座標
      const drawX = steep ? y : x;
      const drawY = steep ? x : y;
      
      // 繪製圓點
      ctx.arc(drawX, drawY, currentBrushSize / 2, 0, 2 * Math.PI);
      
      // 更新誤差
      error -= deltay;
      if (error < 0) {
        y += ystep;
        error += deltax;
      }
    }
    
    // 一次性填充所有點
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
  }, []);

  const drawConnectedLine = useCallback((ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
    const currentBrushSize = brushSizeRef.current;
    const distance = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
    if (distance < currentBrushSize / 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x1, y1, currentBrushSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      return;
    }
    if (distance < currentBrushSize * 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineWidth = currentBrushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      return;
    }
    drawLineBetween(ctx, x0, y0, x1, y1);
  }, [drawLineBetween]); // 保持 drawLineBetween 依賴項

  // 筆刷預覽 - 手機和電腦使用相同的預覽方式
  const drawBrushPreview = useCallback((x: number, y: number) => {
    const brushCanvas = brushPreviewCanvas;
    const brushCtx = brushCanvas?.getContext('2d');
    if (!brushCtx || !brushCanvas) return;
    
    const currentBrushSize = brushSizeRef.current;
    
    brushCtx.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    
    if (currentBrushSize <= 10) {
      brushCtx.beginPath();
      brushCtx.arc(x, y, currentBrushSize / 2, 0, 2 * Math.PI);
      brushCtx.strokeStyle = '#ff00ff';
      brushCtx.lineWidth = 1;
      brushCtx.stroke();
      brushCtx.beginPath();
      brushCtx.arc(x, y, 1, 0, 2 * Math.PI);
      brushCtx.fillStyle = '#ff00ff';
      brushCtx.fill();
    } else {
      brushCtx.beginPath();
      brushCtx.arc(x, y, currentBrushSize / 2, 0, 2 * Math.PI);
      brushCtx.strokeStyle = '#ff00ff';
      brushCtx.lineWidth = 2;
      brushCtx.stroke();
      brushCtx.beginPath();
      brushCtx.arc(x, y, currentBrushSize / 2 - 2, 0, 2 * Math.PI);
      brushCtx.strokeStyle = '#ffffff';
      brushCtx.lineWidth = 1;
      brushCtx.stroke();
    }
  }, [brushPreviewCanvas]); // 添加 brushPreviewCanvas 依賴項

  // 獲取繪製用的 Canvas - 直接使用主 Canvas
  const getDrawingCanvas = useCallback(() => {
    return canvas;
  }, [canvas]);

  // 座標獲取函數
  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return null;
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }, [canvas]); // 使用主 Canvas 進行座標計算

  // 事件處理函數
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    console.log('橡皮擦: handleMouseDown 被調用', { isEraserActive, hasCanvas: !!canvas });
    if (!isEraserActive || !canvas) return;
    
    const drawingCanvas = getDrawingCanvas();
    if (!drawingCanvas) return;
    
    const ctx = drawingCanvas.getContext('2d');
    if (!ctx) return;
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    const { x, y } = coords;
    console.log('橡皮擦: 開始繪製', { x, y, brushSize: brushSizeRef.current });
    isDrawingRef.current = true;
    lastDrawPosRef.current = { x, y };
    
    // 記錄繪製路徑
    const drawPoint: DrawPoint = {
      x,
      y,
      brushSize: brushSizeRef.current,
      timestamp: Date.now()
    };
    setDrawPath(prev => [...prev, drawPoint]);
    
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushSizeRef.current / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    
    drawBrushPreview(x, y);
  }, [isEraserActive, canvas]); // 簡化依賴項

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isEraserActive || !isDrawingRef.current || !canvas) return;
    
    const drawingCanvas = getDrawingCanvas();
    if (!drawingCanvas) return;
    
    const ctx = drawingCanvas.getContext('2d');
    if (!ctx) return;
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    const { x, y } = coords;
    
    // 記錄繪製路徑
    const drawPoint: DrawPoint = {
      x,
      y,
      brushSize: brushSizeRef.current,
      timestamp: Date.now()
    };
    setDrawPath(prev => [...prev, drawPoint]);
    
    if (lastDrawPosRef.current) {
      drawConnectedLine(ctx, lastDrawPosRef.current.x, lastDrawPosRef.current.y, x, y);
    }
    
    lastDrawPosRef.current = { x, y };
    drawBrushPreview(x, y);
  }, [isEraserActive, canvas]); // 簡化依賴項

  // 移除覆蓋層相關函數，直接使用主 Canvas

  // 重置橡皮擦狀態
  const handleReset = () => {
    // 1. 清除繪製路徑記錄
    setDrawPath([]);
    
    // 2. 清除選擇區域
    setSelectedAreas([]);
    
    // 3. 重置繪製狀態
    isDrawingRef.current = false;
    lastDrawPosRef.current = null;
    
    // 4. 清除筆刷預覽
    if (brushPreviewCanvas) {
      const brushCtx = brushPreviewCanvas.getContext('2d');
      if (brushCtx) {
        brushCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
      }
    }
    
    // 5. 清除覆蓋層 Canvas（如果存在）
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    }
  };

  // 退出橡皮擦模式 - 直接恢復主 Canvas
  const handleExitErase = () => {
    console.log('橡皮擦: 退出擦除模式', { 
      hasCanvas: !!canvas, 
      hasOriginalImageUrl: !!originalImageUrl,
      originalImageUrl,
      canvasWidth: canvas?.width,
      canvasHeight: canvas?.height
    });
    
    try {
      // 1. 重置所有狀態（但不關閉擦除模式）
      // 清除繪製路徑記錄
      setDrawPath([]);
      
      // 清除選擇區域
      setSelectedAreas([]);
      
      // 重置繪製狀態
      isDrawingRef.current = false;
      lastDrawPosRef.current = null;
      
      // 清除筆刷預覽
      if (brushPreviewCanvas) {
        const brushCtx = brushPreviewCanvas.getContext('2d');
        if (brushCtx) {
          brushCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
        }
      }
      
      // 清除覆蓋層 Canvas（如果存在）
      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
        }
      }
      
      // 2. 立即恢復主 Canvas
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (preloadedImage) {
            // 使用預載入的圖片立即恢復
            console.log('橡皮擦: 使用預載入圖片立即恢復');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(preloadedImage, 0, 0, canvas.width, canvas.height);
            console.log('橡皮擦: 主 Canvas 已恢復原始圖片');
          } else if (originalImageUrl) {
            // 備用方案：重新載入圖片
            console.log('橡皮擦: 預載入圖片不存在，重新載入', { originalImageUrl });
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              console.log('橡皮擦: 原始圖片載入成功', { 
                imgWidth: img.width, 
                imgHeight: img.height,
                canvasWidth: canvas.width,
                canvasHeight: canvas.height
              });
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              console.log('橡皮擦: 主 Canvas 已恢復原始圖片');
            };
            img.onerror = (error) => {
              console.error('橡皮擦: 載入原始圖片失敗', error);
              showToast(t("toast.error.load_original_failed"));
            };
            img.src = originalImageUrl;
          } else {
            console.warn('橡皮擦: 無法恢復 Canvas', { 
              hasCanvas: !!canvas, 
              hasOriginalImageUrl: !!originalImageUrl,
              hasPreloadedImage: !!preloadedImage
            });
          }
        }
      }
      
      // 3. 關閉擦除模式
      setIsEraserActive(false);
      
      // 4. 通知父組件關閉
      onClose();
      
    } catch (error) {
      console.error('退出擦除模式時發生錯誤:', error);
      showToast(t("toast.error.exit_erase_failed"));
      
      // 即使發生錯誤，也要嘗試關閉
      handleReset();
      setIsEraserActive(false);
      onClose();
    }
  };

  // 移除：不再需要 handleDrawComplete 函數
  // 只在用戶明確點擊清除按鈕時才保存歷史記錄

  const handleMouseUp = useCallback(() => {
    isDrawingRef.current = false;
    lastDrawPosRef.current = null;
    
    if (brushPreviewCanvas) {
      const brushCtx = brushPreviewCanvas.getContext('2d');
      if (brushCtx) {
        brushCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
      }
    }
    
    // 新增：每次繪製完成時就記錄歷史
    console.log('檢查是否需要記錄歷史:', { 
      hasOnComplete: !!onCompleteRef.current, 
      drawPathLength: drawPath.length,
      willRecord: !!(onCompleteRef.current && drawPath.length > 0)
    });
    if (onCompleteRef.current && drawPath.length > 0) {
      console.log('橡皮擦: 記錄本次繪製操作', { pathLength: drawPath.length });
      
      // 計算本次繪製的邊界
      const points = drawPath.slice(-drawPath.length); // 獲取本次繪製的所有點
      const minX = Math.min(...points.map(p => p.x));
      const maxX = Math.max(...points.map(p => p.x));
      const minY = Math.min(...points.map(p => p.y));
      const maxY = Math.max(...points.map(p => p.y));
      const maxBrushSize = Math.max(...points.map(p => p.brushSize));
      const margin = Math.ceil(maxBrushSize / 2);
      
      onCompleteRef.current({
        selectedAreas: [{
          x: Math.max(0, minX - margin),
          y: Math.max(0, minY - margin),
          width: maxX - minX + maxBrushSize,
          height: maxY - minY + maxBrushSize
        }],
        eraserData: {
          ...eraserData,
          areas: [{
            x: Math.max(0, minX - margin),
            y: Math.max(0, minY - margin),
            width: maxX - minX + maxBrushSize,
            height: maxY - minY + maxBrushSize
          }],
          brushSize: brushSize
        }
      });
      
      // 清除路徑記錄，為下次繪製做準備
      setDrawPath([]);
    }
  }, [brushPreviewCanvas, drawPath, eraserData, brushSize]);

  const handleMouseLeave = useCallback(() => {
    isDrawingRef.current = false;
    lastDrawPosRef.current = null;
    
    if (brushPreviewCanvas) {
      const brushCtx = brushPreviewCanvas.getContext('2d');
      if (brushCtx) {
        brushCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
      }
    }
  }, [brushPreviewCanvas]);

  // 觸控事件處理
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    console.log('橡皮擦: handleTouchStart 被調用');
    if (!isEraserActive || !canvas) {
      console.log('橡皮擦: handleTouchStart 條件檢查失敗', { isEraserActive, hasCanvas: !!canvas });
      return;
    }
    e.preventDefault();
    
    const drawingCanvas = getDrawingCanvas();
    if (!drawingCanvas) return;
    
    const ctx = drawingCanvas.getContext('2d');
    if (!ctx) return;
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    const { x, y } = coords;
    isDrawingRef.current = true;
    lastDrawPosRef.current = { x, y };
    
    // 記錄繪製路徑
    const drawPoint: DrawPoint = {
      x,
      y,
      brushSize: brushSizeRef.current,
      timestamp: Date.now()
    };
    setDrawPath(prev => [...prev, drawPoint]);
    
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushSizeRef.current / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    
    drawBrushPreview(x, y);
  }, [isEraserActive, canvas, getDrawingCanvas, getCoordinates, drawBrushPreview]);

  // 觸控移動處理
  const throttledTouchMove = useCallback(
    throttle((e: React.TouchEvent) => {
    console.log('橡皮擦: handleTouchMove 被調用');
    if (!isEraserActive || !isDrawingRef.current || !canvas) {
      console.log('橡皮擦: handleTouchMove 條件檢查失敗', { 
        isEraserActive, 
        isDrawing: isDrawingRef.current, 
        hasCanvas: !!canvas 
      });
      return;
    }
    e.preventDefault();
    
    const drawingCanvas = getDrawingCanvas();
    if (!drawingCanvas) return;
    
    const ctx = drawingCanvas.getContext('2d');
    if (!ctx) return;
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    const { x, y } = coords;
    
    // 記錄繪製路徑
    const drawPoint: DrawPoint = {
      x,
      y,
      brushSize: brushSizeRef.current,
      timestamp: Date.now()
    };
    setDrawPath(prev => [...prev, drawPoint]);
    
    if (lastDrawPosRef.current) {
      drawConnectedLine(ctx, lastDrawPosRef.current.x, lastDrawPosRef.current.y, x, y);
    }
    
    lastDrawPosRef.current = { x, y };
    drawBrushPreview(x, y);
    }, isMobile ? 25 : 16), // 手機模式 40fps，桌面模式 60fps
    [isEraserActive, canvas, isMobile, getDrawingCanvas, getCoordinates, drawConnectedLine, drawBrushPreview]
  );

  // 效能監控
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const monitorPerformance = useCallback((operation: string, startTime: number) => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    if (duration > 16) { // 超過 60fps 的閾值
      console.warn(`效能警告：${operation} 耗時 ${duration.toFixed(2)}ms`);
    }
  }, []);

  // 使用節流版本的觸控移動處理
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    throttledTouchMove(e);
  }, [throttledTouchMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    console.log('橡皮擦: handleTouchEnd 被調用');
    e.preventDefault();
    isDrawingRef.current = false;
    lastDrawPosRef.current = null;
    
    if (brushPreviewCanvas) {
      const brushCtx = brushPreviewCanvas.getContext('2d');
      if (brushCtx) {
        brushCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
      }
    }
    
    // 記錄繪製操作到歷史記錄
    if (drawPath.length > 0) {
      console.log('橡皮擦: 記錄本次繪製操作', { pathLength: drawPath.length });
      if (onCompleteRef.current) {
        // 計算繪製區域的邊界
        const minX = Math.min(...drawPath.map(p => p.x));
        const minY = Math.min(...drawPath.map(p => p.y));
        const maxX = Math.max(...drawPath.map(p => p.x));
        const maxY = Math.max(...drawPath.map(p => p.y));
        const maxBrushSize = Math.max(...drawPath.map(p => p.brushSize));
        const margin = Math.ceil(maxBrushSize / 2);
        
        onCompleteRef.current({
          selectedAreas: [{
            x: Math.max(0, minX - margin),
            y: Math.max(0, minY - margin),
            width: maxX - minX + maxBrushSize,
            height: maxY - minY + maxBrushSize
          }],
          eraserData: {
            ...eraserData,
            areas: [{
              x: Math.max(0, minX - margin),
              y: Math.max(0, minY - margin),
              width: maxX - minX + maxBrushSize,
              height: maxY - minY + maxBrushSize
            }],
            brushSize: brushSizeRef.current
          }
        });
      }
    }
  }, [brushPreviewCanvas, drawPath, selectedAreas, eraserData]);

  // 滾輪事件 - 已禁用，只能通過滑動條調整
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // 完全禁用滾輪調整筆刷大小
    e.preventDefault();
    // 不執行任何筆刷大小調整邏輯
  }, []);

  // 記憶體清理
  const cleanupMemory = useCallback(() => {
    if (brushPreviewCanvas) {
      const brushCtx = brushPreviewCanvas.getContext('2d');
      if (brushCtx) {
        brushCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
      }
    }
  }, [brushPreviewCanvas]);

  // 組件卸載時清理記憶體
  useEffect(() => {
    return () => {
      cleanupMemory();
    };
  }, [cleanupMemory]);

  // 當橡皮擦工具啟動時，確保 Canvas 狀態正確
  useEffect(() => {
    if (isActive && canvas) {
      // 確保 Canvas 的合成模式正確
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }, [isActive, canvas]); // 簡化依賴項

  // 新增：當工具切換時自動執行退出邏輯
  useEffect(() => {
    console.log('AreaEraser useEffect 觸發', { isActive, isEraserActive });
    if (!isActive) {
      console.log('工具切換，檢查是否需要執行橡皮擦退出邏輯', { isEraserActive });
      if (isEraserActive) {
        console.log('工具切換，自動執行橡皮擦退出邏輯');
        // 直接執行退出邏輯，避免依賴項問題
        try {
        // 1. 重置所有狀態（但不關閉擦除模式）
        // 清除繪製路徑記錄
        setDrawPath([]);
        
        // 清除選擇區域
        setSelectedAreas([]);
        
        // 重置繪製狀態
        isDrawingRef.current = false;
        lastDrawPosRef.current = null;
        
        // 清除筆刷預覽
        if (brushPreviewCanvas) {
          const brushCtx = brushPreviewCanvas.getContext('2d');
          if (brushCtx) {
            brushCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
          }
        }
        
        // 清除覆蓋層 Canvas（如果存在）
        if (overlayCanvasRef.current) {
          const ctx = overlayCanvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
          }
        }
        
        // 2. 不要在工具切換時清除主 Canvas
        // 因為這會影響其他工具（如背景移除修復）的狀態
        console.log('橡皮擦: 工具切換時不清除主 Canvas，避免影響其他工具狀態');
        
        // 3. 關閉擦除模式
        setIsEraserActive(false);
        
      } catch (error) {
        console.error('工具切換時退出擦除模式失敗:', error);
        showToast(t("toast.error.exit_erase_failed"));
        
        // 即使發生錯誤，也要嘗試關閉
        setIsEraserActive(false);
      }
    }
  }
  }, [isActive, isEraserActive, canvas, originalImageUrl]);

  // 清除選擇區域
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const clearSelectedAreas = () => {
    setSelectedAreas([]);
  };

  // 使用 useRef 來存儲 onComplete 函數，避免依賴項問題
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // 清除畫布和路徑
  const handleClearCanvas = useCallback(async () => {
    if (!canvas || !imageId) return;
    
    setIsProcessing(true);
    
    try {
      // 清除畫布上的擦除效果
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // 重新載入原始圖片
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        // 這裡需要從 ImageEditor 獲取原始圖片URL
        // 暫時使用一個佔位符
        img.src = originalImageUrl || '/placeholder-image.jpg';
      }
      
      // 如果有繪製路徑，傳送到後端
      if (drawPath.length > 0) {
        // 將繪製路徑轉換為區域格式
        // 計算路徑的邊界框
        const minX = Math.min(...drawPath.map(p => p.x));
        const maxX = Math.max(...drawPath.map(p => p.x));
        const minY = Math.min(...drawPath.map(p => p.y));
        const maxY = Math.max(...drawPath.map(p => p.y));
        
        // 檢查是否有無效值
        if (isNaN(minX) || isNaN(maxX) || isNaN(minY) || isNaN(maxY) ||
            !isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
          console.error('路徑包含無效座標:', { minX, maxX, minY, maxY });
          showToast(t("toast.error.invalid_coordinates"));
          return;
        }
        
        // 添加筆刷大小的邊距
        const maxBrushSize = Math.max(...drawPath.map(p => p.brushSize));
        const margin = maxBrushSize / 2;
        
        // 檢查筆刷大小是否有效
        if (isNaN(maxBrushSize) || !isFinite(maxBrushSize) || maxBrushSize <= 0) {
          console.error('無效的筆刷大小:', maxBrushSize);
          showToast(t("toast.error.invalid_brush_size"));
          return;
        }
        
        const eraseData: AreaEraseData = {
          ...eraserData,
          areas: [{
            x: Math.max(0, minX - margin),
            y: Math.max(0, minY - margin),
            width: maxX - minX + maxBrushSize,
            height: maxY - minY + maxBrushSize
          }],
          brushSize: brushSize
        };
        
        console.log('發送擦除路徑到後端:', eraseData);
        console.log('繪製路徑點數:', drawPath.length);
        console.log('路徑邊界:', { minX, maxX, minY, maxY, margin });
        console.log('驗證前的資料:', JSON.stringify(eraseData, null, 2));
        
        const result = await eraseAreas(eraseData, imageId);
        
        if (result.success) {
          console.log('擦除路徑處理成功:', result);
          showToast(t("toast.success.eraser_processed", { count: drawPath.length }));
          
          // 移除：不再在這裡保存歷史記錄，因為每次繪製完成時已經保存了
          // 清除按鈕只是發送到後端處理，不影響歷史記錄
          
          // 清除路徑記錄
          setDrawPath([]);
        } else {
          console.error('擦除路徑處理失敗:', result.message);
          showToast(t("toast.error.eraser_process_failed", { message: result.message }));
        }
      } else {
        // 移除：沒有路徑時不保存歷史記錄
        console.log('沒有擦除路徑，不保存歷史記錄');
      }
      
    } catch (error) {
      console.error('清除畫布時發生錯誤:', error);
      toast(t("toast.error.canvas_clear_error"));
    } finally {
      setIsProcessing(false);
    }
  }, [canvas, imageId, drawPath, eraserData, brushSize, originalImageUrl, t]); // 移除 onComplete 依賴項

  // 應用擦除
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const applyAreaErase = () => {
    if (onComplete) {
      onComplete({ selectedAreas, eraserData: {
        ...eraserData,
        areas: selectedAreas,
        brushSize
      }});
    }
  };

  // 啟動橡皮擦
  const handleStartErase = () => {
    console.log('橡皮擦: 啟動擦除模式');
    setIsEraserActive(true);
  };

  // 將事件處理函數傳遞給父組件
  useEffect(() => {
    console.log('橡皮擦: 傳遞事件處理函數', { 
      isActive, 
      hasOnEventHandlersReady: !!onEventHandlersReady,
      hasHandleMouseDown: !!handleMouseDown,
      hasHandleMouseMove: !!handleMouseMove
    });
    if (isActive && onEventHandlersReady) {
      const handlers = {
        onMouseDown: handleMouseDown,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        onMouseLeave: handleMouseLeave,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onWheel: handleWheel
      };
      console.log('橡皮擦: 傳遞的處理函數:', handlers);
      onEventHandlersReady(handlers);
    }
  }, [isActive, onEventHandlersReady, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, handleTouchStart, handleTouchMove, handleTouchEnd, handleWheel]);
  const handleCancel = () => {
    setDrawPath([]);
    onClose();
  };
  // 暴露清除函數給父組件
  useEffect(() => {
    if (isActive && onClearFunctionReady) {
      onClearFunctionReady(handleClearCanvas);
    }
  }, [isActive, onClearFunctionReady, handleClearCanvas]); // 恢復 handleClearCanvas 依賴項

  // 預載入原始圖片，確保退出時能立即恢復
  const [preloadedImage, setPreloadedImage] = useState<HTMLImageElement | null>(null);
  
  useEffect(() => {
    if (isActive && originalImageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        console.log('橡皮擦: 預載入原始圖片成功');
        setPreloadedImage(img);
      };
      img.onerror = (error) => {
        console.error('橡皮擦: 預載入原始圖片失敗', error);
      };
      img.src = originalImageUrl;
    }
  }, [isActive, originalImageUrl]);


  if (!isActive) return null;

  return (
    <>
      {/* 工具面板 */}
      {!isEraserActive && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t("tools.area_eraser")}</h3>
              <button
                onClick={handleCancel}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {t("area_eraser.description")}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t("ui.brush_size")}: {brushSize}px
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={brushSize}
                    onChange={(e) => setBrushSize?.(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t("area_eraser.brush_size_hint")}
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleStartErase}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  // onClick={handleStartErase}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t("area_eraser.start_erase")}
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  {t("ui.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 擦除模式 UI */}
      {isEraserActive && (
        <>
          {/* 移動版筆刷控制 */}
          {isMobile && (
            <div className="fixed bottom-20 left-4 right-4 bg-white dark:bg-gray-800 rounded-lg p-3 shadow-lg z-40">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    筆刷: {brushSize}px
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={brushSize}
                    onChange={(e) => setBrushSize?.(Number(e.target.value))}
                    className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    title={t("ui.brush_size")}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={async () => {
                      try {
                        await handleClearCanvas();
                      } catch (error) {
                        console.error('清除失敗:', error);
                      }
                    }}
                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title={t("ui.clear_and_send_path")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleExitErase}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={t("ui.exit_erase_mode")}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Canvas 事件處理 - 已移至 ImageEditor 統一處理 */}
        </>
      )}
    </>
  );
};

export default AreaEraser; 