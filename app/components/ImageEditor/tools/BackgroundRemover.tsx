import React, { useState, useRef, useEffect, useCallback } from 'react';
import { showToast } from "@/app/components/CustomToast";
import { 
  Scissors, 
  X, 
  Loader2, 
  AlertCircle,
  Eraser,
  RotateCcw,
  Check
} from 'lucide-react';
import { 
  BackgroundRemoveData, 
  removeBackground, 
  validateBackgroundRemoveData, 
} from '../../../services/backgroundRemoverApi';
import { useTranslations } from "next-intl";

interface BackgroundRemoverProps {
  isActive: boolean;
  onRemoveBackground: (removeData: BackgroundRemoveData) => void;
  onClose: () => void;
  imageId: string;
  canvas?: HTMLCanvasElement | null;
  brushPreviewCanvas?: HTMLCanvasElement | null;
  isMobile?: boolean;
  canvasSize?: { width: number; height: number };
  brushSize?: number;
  setBrushSize?: (size: number) => void;
  onComplete?: (result: { type: string; data: Record<string, unknown> }) => void; // 新增：用於記錄歷史
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
  onResetRepair?: () => void;
  onExitRepair?: () => void;
  onClearRepairFunctionReady?: (clearFunction: () => Promise<void>) => void; // 新增：暴露清除函數
  onResetRepairFunctionReady?: (resetFunction: () => void) => void; // 新增：暴露重置函數
  originalImageUrl?: string; // 新增：原始圖片URL
}

// 節流函數
const throttle = <T extends unknown[]>(func: (...args: T) => void, limit: number) => {
  let inThrottle: boolean;
  return (...args: T) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

const BackgroundRemover: React.FC<BackgroundRemoverProps> = ({ 
  isActive, 
  onRemoveBackground, 
  onClose,
  imageId,
  canvas,
  brushPreviewCanvas,
  isMobile = false,
  brushSize = 20,
  setBrushSize,
  onComplete,
  onEventHandlersReady,
  onResetRepair,
  onExitRepair,
  onClearRepairFunctionReady,
  onResetRepairFunctionReady,
  originalImageUrl
}) => {
  const t = useTranslations("imageEditor");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [backgroundRemoved, setBackgroundRemoved] = useState(false);
  
  // 修復筆刷相關狀態
  const [isRepairActive, setIsRepairActive] = useState(false);
  
  // 調試信息
  console.log('BackgroundRemover render:', {
    isActive,
    backgroundRemoved,
    isRepairActive,
    translationText: t("background_remove.description")
  });
  const [repairPath, setRepairPath] = useState<Array<{ x: number; y: number; brushSize: number }>>([]); // 新增：記錄修復路徑
  const [backgroundRemovedImageUrl, setBackgroundRemovedImageUrl] = useState<string | null>(null); // 保存背景移除後的圖片URL
  const isDrawingRef = useRef<boolean>(false);
  const lastDrawPosRef = useRef<{ x: number; y: number } | null>(null);
  const brushSizeRef = useRef(brushSize);
  brushSizeRef.current = brushSize;
  
  // 使用 useRef 來存儲 onComplete 函數，避免依賴項問題
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  
  // 背景移除選項 - 使用預設值
  const quality = 'high' as const;
  const format = 'PNG' as const;
  const keepShadows = false;
  const enhanceEdges = true;

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
    let error = deltax / 2;
    const ystep = y0_int < y1_int ? 1 : -1;
    let y = y0_int;
    
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // 半透明白色修復
    ctx.beginPath();
    
    for (let x = x0_int; x <= x1_int; x++) {
      const drawX = steep ? y : x;
      const drawY = steep ? x : y;
      
      ctx.arc(drawX, drawY, currentBrushSize / 2, 0, 2 * Math.PI);
      
      error -= deltay;
      if (error < 0) {
        y += ystep;
        error += deltax;
      }
    }
    
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }, []);

  const drawConnectedLine = useCallback((ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
    const currentBrushSize = brushSizeRef.current;
    const distance = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
    
    if (distance < currentBrushSize / 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // 半透明白色修復
      ctx.beginPath();
      ctx.arc(x1, y1, currentBrushSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      return;
    }
    
    if (distance < currentBrushSize * 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; // 半透明白色修復
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
  }, [drawLineBetween]);

  // 筆刷預覽
  const drawBrushPreview = useCallback((x: number, y: number) => {
    const brushCanvas = brushPreviewCanvas;
    const brushCtx = brushCanvas?.getContext('2d');
    if (!brushCtx || !brushCanvas) return;
    
    const currentBrushSize = brushSizeRef.current;
    
    brushCtx.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    
    if (currentBrushSize <= 10) {
      brushCtx.beginPath();
      brushCtx.arc(x, y, currentBrushSize / 2, 0, 2 * Math.PI);
      brushCtx.strokeStyle = '#00ff00';
      brushCtx.lineWidth = 1;
      brushCtx.stroke();
      brushCtx.beginPath();
      brushCtx.arc(x, y, 1, 0, 2 * Math.PI);
      brushCtx.fillStyle = '#00ff00';
      brushCtx.fill();
    } else {
      brushCtx.beginPath();
      brushCtx.arc(x, y, currentBrushSize / 2, 0, 2 * Math.PI);
      brushCtx.strokeStyle = '#00ff00';
      brushCtx.lineWidth = 2;
      brushCtx.stroke();
      brushCtx.beginPath();
      brushCtx.arc(x, y, currentBrushSize / 2 - 2, 0, 2 * Math.PI);
      brushCtx.strokeStyle = '#ffffff';
      brushCtx.lineWidth = 1;
      brushCtx.stroke();
    }
  }, []);

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
  }, [canvas]);

  // 修復筆刷事件處理函數
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isRepairActive || !canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    const { x, y } = coords;
    isDrawingRef.current = true;
    lastDrawPosRef.current = { x, y };
    
    // 記錄修復路徑
    setRepairPath(prev => [...prev, { x, y, brushSize: brushSizeRef.current }]);
    
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // 半透明白色修復
    ctx.beginPath();
    ctx.arc(x, y, brushSizeRef.current / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    
    drawBrushPreview(x, y);
  }, [isRepairActive, canvas, getCoordinates, drawBrushPreview]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isRepairActive || !isDrawingRef.current || !canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    const { x, y } = coords;
    
    // 記錄修復路徑
    setRepairPath(prev => [...prev, { x, y, brushSize: brushSizeRef.current }]);
    
    if (lastDrawPosRef.current) {
      drawConnectedLine(ctx, lastDrawPosRef.current.x, lastDrawPosRef.current.y, x, y);
    }
    
    lastDrawPosRef.current = { x, y };
    drawBrushPreview(x, y);
  }, [isRepairActive, canvas, getCoordinates, drawConnectedLine, drawBrushPreview]);

  const handleMouseUp = useCallback(() => {
    isDrawingRef.current = false;
    lastDrawPosRef.current = null;
    
    if (brushPreviewCanvas) {
      const brushCtx = brushPreviewCanvas.getContext('2d');
      if (brushCtx) {
        brushCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
      }
    }
    
    // 修復筆刷每一筆都記錄歷史，用於逐筆撤銷
    if (onCompleteRef.current && repairPath.length > 0) {
      console.log('背景移除修復: 記錄本次修復操作', { pathLength: repairPath.length });
      
      // 計算本次修復的邊界
      const minX = Math.min(...repairPath.map(p => p.x));
      const maxX = Math.max(...repairPath.map(p => p.x));
      const minY = Math.min(...repairPath.map(p => p.y));
      const maxY = Math.max(...repairPath.map(p => p.y));
      const maxBrushSize = Math.max(...repairPath.map(p => p.brushSize));
      const margin = Math.ceil(maxBrushSize / 2);
      
      onCompleteRef.current({
        type: 'background-remove-repair',
        data: {
          action: 'repair-brush',
          area: {
            x: Math.max(0, minX - margin),
            y: Math.max(0, minY - margin),
            width: maxX - minX + maxBrushSize,
            height: maxY - minY + maxBrushSize
          },
          brushSize: brushSize,
          pathPoints: repairPath
        }
      });
      
      // 清除路徑記錄，為下次修復做準備
      setRepairPath([]);
    }
  }, [brushPreviewCanvas, repairPath]);

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
    if (!isRepairActive || !canvas) return;
    e.preventDefault();
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    const { x, y } = coords;
    isDrawingRef.current = true;
    lastDrawPosRef.current = { x, y };
    
    // 記錄修復路徑
    setRepairPath(prev => [...prev, { x, y, brushSize: brushSizeRef.current }]);
    
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // 半透明白色修復
    ctx.beginPath();
    ctx.arc(x, y, brushSizeRef.current / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    
    drawBrushPreview(x, y);
  }, [isRepairActive, canvas, getCoordinates, drawBrushPreview]);

  const throttledTouchMove = useCallback(
    throttle((e: React.TouchEvent) => {
      if (!isRepairActive || !isDrawingRef.current || !canvas) return;
      e.preventDefault();
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const coords = getCoordinates(e);
      if (!coords) return;
      
      const { x, y } = coords;
      
      // 記錄修復路徑
      setRepairPath(prev => [...prev, { x, y, brushSize: brushSizeRef.current }]);
      
      if (lastDrawPosRef.current) {
        drawConnectedLine(ctx, lastDrawPosRef.current.x, lastDrawPosRef.current.y, x, y);
      }
      
      lastDrawPosRef.current = { x, y };
      drawBrushPreview(x, y);
    }, isMobile ? 25 : 16),
    [isRepairActive, canvas, getCoordinates, drawConnectedLine, drawBrushPreview, isMobile]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    throttledTouchMove(e);
  }, [throttledTouchMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    console.log('=== BackgroundRemover TouchEnd ===', {
      isRepairActive,
      repairPathLength: repairPath.length,
      hasOnCompleteRef: !!onCompleteRef.current,
      willRecord: !!(onCompleteRef.current && repairPath.length > 0)
    });
    
    isDrawingRef.current = false;
    lastDrawPosRef.current = null;
    
    if (brushPreviewCanvas) {
      const brushCtx = brushPreviewCanvas.getContext('2d');
      if (brushCtx) {
        brushCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
      }
    }
    
    // 修復筆刷觸控結束時記錄歷史，用於逐筆撤銷
    if (onCompleteRef.current && repairPath.length > 0) {
      try {
        console.log('=== 手機版修復筆刷: 開始記錄歷史 ===', { 
          pathLength: repairPath.length,
          repairPath: repairPath.slice(0, 3) // 只顯示前3個點
        });
        
        // 計算修復區域
        const minX = Math.min(...repairPath.map(p => p.x));
        const maxX = Math.max(...repairPath.map(p => p.x));
        const minY = Math.min(...repairPath.map(p => p.y));
        const maxY = Math.max(...repairPath.map(p => p.y));
        const maxBrushSize = Math.max(...repairPath.map(p => p.brushSize));
        const margin = Math.ceil(maxBrushSize / 2);

        const recordData = {
          type: 'background-remove-repair',
          data: {
            action: 'repair-brush',
            area: {
              x: Math.max(0, minX - margin),
              y: Math.max(0, minY - margin),
              width: maxX - minX + maxBrushSize,
              height: maxY - minY + maxBrushSize
            },
            brushSize: brushSizeRef.current,
            pathPoints: repairPath
          }
        };

        console.log('=== 手機版修復筆刷: 調用 onComplete ===', recordData);
        onCompleteRef.current(recordData);
        console.log('=== 手機版修復筆刷: onComplete 調用完成 ===');
      } catch (error) {
        console.error('手機版修復筆刷: 記錄歷史失敗', error);
      } finally {
        setRepairPath([]);
        console.log('=== 手機版修復筆刷: 清除路徑完成 ===');
      }
    } else {
      console.log('=== 手機版修復筆刷: 不記錄歷史 ===', {
        hasOnCompleteRef: !!onCompleteRef.current,
        repairPathLength: repairPath.length,
        reason: !onCompleteRef.current ? 'No onComplete callback' : 'Empty repair path'
      });
    }
  }, [brushPreviewCanvas, isRepairActive, repairPath]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
  }, []);

  const handleRemoveBackground = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage('');

      const removeData: BackgroundRemoveData = {
        quality,
        format,
        keepShadows,
        enhanceEdges
      };

      // 驗證資料
      if (!validateBackgroundRemoveData(removeData)) {
        throw new Error('背景移除資料格式錯誤');
      }

      console.log('準備發送背景移除請求:', removeData);

      // 呼叫 API
      const response = await removeBackground(removeData, imageId);

      if (response.success && response.data) {
        console.log('背景移除成功:', response.data);
        showToast(t("toast.success.background_removed"));

        // 保存背景移除後的圖片URL，用於退出修復模式時恢復
        if (canvas) {
          const backgroundRemovedUrl = canvas.toDataURL('image/png');
          setBackgroundRemovedImageUrl(backgroundRemovedUrl);
          console.log('背景移除修復: 已保存背景移除後的圖片URL，用於退出修復模式時恢復');
        }

        // 標記背景已移除，進入修復模式
        setBackgroundRemoved(true);
        // 不要自動啟動修復筆刷，讓用戶手動點擊開始
        
        // 呼叫父組件的回調函數
        onRemoveBackground(removeData);
      } else {
        throw new Error(response.message || '背景移除失敗');
      }
    } catch (error) {
      console.error('背景移除失敗:', error);
      showToast(t("toast.error.background_remove_failed"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartRepair = () => {
    console.log('背景移除修復: 開始修復模式');
    setIsRepairActive(true);
    // 通知父組件更新工具狀態
    if (onEventHandlersReady) {
      // 這裡會在 useEffect 中處理事件處理器的傳遞
    }
  };

  const handleExitRepair = () => {
    console.log('背景移除修復: 手動退出修復模式', { 
      hasCanvas: !!canvas, 
      canvasWidth: canvas?.width, 
      canvasHeight: canvas?.height,
      currentIsRepairActive: isRepairActive
    });
    
    try {
      // 1. 重置所有狀態（但不關閉修復模式）
      // 清除繪製路徑記錄
      console.log('背景移除修復: 清除前 repairPath 長度:', repairPath.length);
      setRepairPath([]);
      console.log('背景移除修復: 已調用 setRepairPath([])');
      
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
      
      // 2. 不恢復 Canvas，讓父組件通過撤銷來清除修復筆刷
      console.log('背景移除修復: 退出修復模式，將由父組件撤銷修復筆刷');
      
      // 3. 關閉修復模式
      setIsRepairActive(false);
      
      // 4. 通知父組件關閉
      onExitRepair?.();
      
      console.log('背景移除修復: 退出修復模式完成，isRepairActive 將被設置為 false');
      
    } catch (error) {
      console.error('退出修復模式時發生錯誤:', error);
      showToast(t("toast.error.exit_repair_mode_error"));
      
      // 即使發生錯誤，也要嘗試關閉
      resetRepairState();
      setIsRepairActive(false);
      onExitRepair?.();
    }
  };

  const handleFinishRepair = () => {
    setBackgroundRemoved(false);
    setIsRepairActive(false);
    // 通知父組件完成修復，重置工具狀態
    onClose();
  };

  // 重置修復筆刷狀態
  const resetRepairState = useCallback(() => {
    // 1. 清除修復路徑記錄
    setRepairPath([]);
    
    // 2. 重置繪製狀態
    isDrawingRef.current = false;
    lastDrawPosRef.current = null;
    
    // 3. 清除筆刷預覽
    if (brushPreviewCanvas) {
      const brushCtx = brushPreviewCanvas.getContext('2d');
      if (brushCtx) {
        brushCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
      }
    }
    
    console.log('背景移除修復: 重置所有筆刷狀態（但不關閉修復模式）');
  }, [brushPreviewCanvas]);

  const handleResetRepair = () => {
    console.log('=== BackgroundRemover: handleResetRepair 被調用 ===');
    console.log('背景移除修復: 重置修復內容，恢復到背景移除後的狀態');
    
    // 恢復到背景移除後的狀態（如果有保存的話）
    if (canvas && backgroundRemovedImageUrl) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        console.log('背景移除修復: 恢復到背景移除後的狀態');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          console.log('背景移除修復: 已恢復到背景移除後的狀態');
        };
        img.onerror = (error) => {
          console.error('背景移除修復: 恢復背景移除後圖片失敗', error);
        };
        img.src = backgroundRemovedImageUrl;
      }
    } else if (canvas && originalImageUrl) {
      // 備用方案：恢復到原始圖片
      const ctx = canvas.getContext('2d');
      if (ctx) {
        console.log('背景移除修復: 沒有背景移除後的圖片，恢復到原始圖片');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          console.log('背景移除修復: 已恢復到原始圖片');
        };
        img.onerror = (error) => {
          console.error('背景移除修復: 恢復原始圖片失敗', error);
        };
        img.src = originalImageUrl;
      }
    } else {
      console.warn('背景移除修復: 無法恢復，缺少必要的圖片URL');
    }
    
    // 重置修復筆刷狀態
    resetRepairState();
    
    onResetRepair?.();
  };

  // 新增：當工具切換時自動執行清理邏輯
  useEffect(() => {
    console.log('BackgroundRemover useEffect 觸發', { isActive, isRepairActive, backgroundRemoved });
    
    // 當工具被關閉時，清理修復狀態
    if (!isActive) {
      console.log('工具被關閉，檢查是否需要執行背景移除修復清理邏輯', { isRepairActive });
      if (isRepairActive) {
        console.log('工具關閉，自動執行背景移除修復清理邏輯');
        // 直接執行清理邏輯，避免依賴項問題
        try {
          // 1. 清除修復路徑記錄
          setRepairPath([]);
          
          // 2. 重置繪製狀態
          isDrawingRef.current = false;
          lastDrawPosRef.current = null;
          
          // 3. 清除筆刷預覽
          if (brushPreviewCanvas) {
            const brushCtx = brushPreviewCanvas.getContext('2d');
            if (brushCtx) {
              brushCtx.clearRect(0, 0, brushPreviewCanvas.width, brushPreviewCanvas.height);
            }
          }
          
          // 4. 關閉修復模式
          setIsRepairActive(false);
          
          console.log('背景移除修復: 工具關閉時清理完成');
          
        } catch (error) {
          console.error('工具關閉時清理背景移除修復狀態失敗:', error);
          showToast(t("toast.error.exit_repair_mode_error"));
          
          // 即使發生錯誤，也要嘗試關閉
          setIsRepairActive(false);
        }
      }
    }
  }, [isActive, isRepairActive, brushPreviewCanvas]);


  // 暴露清除函數給父組件
  useEffect(() => {
    if (isActive && onClearRepairFunctionReady) {
      // 創建一個包裝函數來調用 handleExitRepair
      const exitRepairWrapper = async () => {
        handleExitRepair();
      };
      onClearRepairFunctionReady(exitRepairWrapper);
    }
  }, [isActive, onClearRepairFunctionReady]);

  // 暴露重置函數給父組件
  useEffect(() => {
    if (isActive && onResetRepairFunctionReady) {
      onResetRepairFunctionReady(handleResetRepair);
    }
  }, [isActive, onResetRepairFunctionReady]);

  // 將修復筆刷事件處理函數傳遞給父組件
  useEffect(() => {
    console.log('BackgroundRemover: 事件處理器傳遞檢查', { 
      isActive, 
      isRepairActive, 
      hasOnEventHandlersReady: !!onEventHandlersReady,
      willPassHandlers: isActive && isRepairActive ,
      willClearHandlers: isActive && (!isRepairActive )
    });
    
    if (isActive && isRepairActive && onEventHandlersReady) {
      console.log('BackgroundRemover: 傳遞修復筆刷事件處理器');
      onEventHandlersReady({
        onMouseDown: handleMouseDown,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        onMouseLeave: handleMouseLeave,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onWheel: handleWheel
      });
    } else if (isActive && !isRepairActive && onEventHandlersReady) {
      // 當修復模式關閉時，清除事件處理器
      console.log('BackgroundRemover: 清除修復筆刷事件處理器');
      onEventHandlersReady({
        onMouseDown: () => { console.log('BackgroundRemover: 非活動狀態的 onMouseDown'); },
        onMouseMove: () => { console.log('BackgroundRemover: 非活動狀態的 onMouseMove'); },
        onMouseUp: () => { console.log('BackgroundRemover: 非活動狀態的 onMouseUp'); },
        onMouseLeave: () => { console.log('BackgroundRemover: 非活動狀態的 onMouseLeave'); },
        onTouchStart: () => { console.log('BackgroundRemover: 非活動狀態的 onTouchStart'); },
        onTouchMove: () => { console.log('BackgroundRemover: 非活動狀態的 onTouchMove'); },
        onTouchEnd: () => { console.log('BackgroundRemover: 非活動狀態的 onTouchEnd'); },
        onWheel: () => { console.log('BackgroundRemover: 非活動狀態的 onWheel'); }
      });
    }
  }, [isActive, isRepairActive,  onEventHandlersReady, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, handleTouchStart, handleTouchMove, handleTouchEnd, handleWheel]);

  if (!isActive) return null;

  return (
    <>
      {/* 工具面板 - 只在非修復模式下顯示 */}
      {!isRepairActive && (
        <div className="fixed inset-0 bg-custom-gray/50 dark:bg-custom-gray-dark/50 flex items-center justify-center z-50 p-4">
          <div className="bg-custom-white dark:bg-custom-white-dark rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-custom-light-purple dark:border-custom-light-purple-dark">
              <h3 className="text-lg font-semibold flex items-center text-custom-black dark:text-custom-black-dark">
                {backgroundRemoved ? <Eraser className="w-5 h-5 mr-2" /> : <Scissors className="w-5 h-5 mr-2" />}
                {backgroundRemoved ? t("background_remove.local_repair") : t("tools.background_remove")}
              </h3>
              <button onClick={onClose} className="p-2 hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark rounded-full transition-colors text-custom-black dark:text-custom-black-dark">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!backgroundRemoved ? (
                // 背景移除模式
                <div className="text-center">
                  <p className="text-sm text-custom-black/60 dark:text-custom-black-dark/60 mb-6">
                    {t("background_remove.description")}
                  </p>    

                  <button
                    onClick={handleRemoveBackground}
                    disabled={isProcessing}
                    className="px-6 py-3 bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center mx-auto"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t("ui.loading_image")}
                      </>
                    ) : (
                      <>
                        <Scissors className="w-4 h-4 mr-2" />
                        {t("background_remove.start_remove")}
                      </>
                    )}
                  </button>

                  {isProcessing && (
                    <div className="mt-4 text-sm text-custom-black/60 dark:text-custom-black-dark/60">
                      {t("ui.loading_image")}
                    </div>
                  )}
                </div>
              ) : (
                // 修復模式選擇
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-custom-black/60 dark:text-custom-black-dark/60 mb-6">
                      {t("background_remove.repair_description")}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-custom-black dark:text-custom-black-dark mb-2">
                        {t("ui.brush_size")}: {brushSize}px
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="50"
                        value={brushSize}
                        onChange={(e) => setBrushSize?.(Number(e.target.value))}
                        className="w-full h-2 bg-custom-light-purple dark:bg-custom-light-purple-dark rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={handleStartRepair}
                        className="flex-1 bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white px-4 py-2 rounded-lg hover:opacity-90 transition-colors flex items-center justify-center"
                      >
                        <Eraser className="w-4 h-4 mr-2" />
                        {t("ui.start_repair")}
                      </button>
                      <button
                        onClick={handleFinishRepair}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {t("ui.finish")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 錯誤訊息 */}
              {errorMessage && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span className="text-sm">{errorMessage}</span>
                  </div>
                </div>
              )}

              <div className="bg-custom-light-purple/20 dark:bg-custom-light-purple-dark/20 p-4 rounded-lg">
                <div className="flex items-center text-custom-black dark:text-custom-black-dark">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  <span className="text-sm">
                    {t("ui.ai_service_required")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-4 border-t border-custom-light-purple dark:border-custom-light-purple-dark bg-custom-light-purple/30 dark:bg-custom-light-purple-dark/30">
              <button
                onClick={onClose}
                className="px-4 py-2 text-custom-black dark:text-custom-black-dark hover:opacity-70 transition-colors"
              >
                {t("ui.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 修復模式 UI - 只在修復模式下顯示 */}
      {isRepairActive && (
        <>
          {/* 移動版筆刷控制 */}
          {isMobile && (
            <div className="fixed bottom-20 left-4 right-4 bg-white dark:bg-gray-800 rounded-lg p-3 shadow-lg z-40">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("ui.repair_brush")}: {brushSize}px
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={brushSize}
                    onChange={(e) => setBrushSize?.(Number(e.target.value))}
                    className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    title={t("ui.adjust_brush_size")}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={onResetRepair || handleResetRepair}
                    className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    title={t("ui.reset_repair")}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onExitRepair || handleExitRepair}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title={t("ui.exit_repair_mode")}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default BackgroundRemover;