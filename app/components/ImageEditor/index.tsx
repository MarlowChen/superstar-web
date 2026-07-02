import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as fabric from 'fabric';
import { 
  X, 
  Undo, 
  Redo, 
  ZoomIn, 
  ZoomOut, 
  Save, 
  Download,
  Type,
  Scissors,
  Eraser,
  Move,
  RotateCw,
  RotateCcw,
  Layers,
  Palette,
  Trash2
} from 'lucide-react';
import { useTranslations } from "next-intl";

import ToolPanel from './ToolPanel';
import { 
  TextData
} from './tools';
// 移除未使用的 imports
// import { eraseAreas, defaultAreaEraseData } from '../services/areaEraserApi';

// 自訂滾動條樣式
const scrollbarStyles = `
  .image-editor-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  
  .image-editor-scrollbar::-webkit-scrollbar-track {
    background: rgba(218, 217, 241, 0.1);
    border-radius: 3px;
  }
  
  .image-editor-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(218, 217, 241, 0.6);
    border-radius: 3px;
    transition: background 0.2s ease;
  }
  
  .image-editor-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(89, 68, 255, 0.8);
  }
  
  .image-editor-scrollbar::-webkit-scrollbar-corner {
    background: transparent;
  }

  /* 深色模式滾動條 */
  .dark .image-editor-scrollbar::-webkit-scrollbar-track {
    background: rgba(45, 42, 64, 0.1);
  }
  
  .dark .image-editor-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(45, 42, 64, 0.6);
  }
  
  .dark .image-editor-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(143, 127, 255, 0.8);
  }

  /* 滾動指示器動畫 */
  .scroll-indicator {
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .scroll-indicator.visible {
    opacity: 1;
  }
`;

interface ImageEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (editedImageUrl: string) => void;
  className?: string;
  isPremium?: boolean;
  onUpgrade?: () => void;
  // 新增：原始圖片信息，用於保存到已編輯圖片
  originalImageInfo?: {
    id: string;
    prompt: string;
    modelName: string;
    source: 'drawing' | 'library';
  };
}

interface Tool {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  isActive?: boolean;
}

interface EditAction {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  // 新增：狀態快照
  canvasSnapshot?: string; // Canvas 的 base64 快照
  fabricSnapshot?: string; // Fabric.js 物件的 JSON 快照
  textData?: TextData | null;     // 文字資料快照
}

// 新增：歷史記錄管理器
interface HistoryManager {
  actions: EditAction[];
  currentIndex: number;
  maxHistory: number;
}

// 新增：Canvas 狀態快照
interface CanvasState {
  canvasData: string;      // 主 Canvas 的 base64 數據
  fabricData: string;      // Fabric.js 物件的 JSON 數據
  textData: TextData | null;
  zoom: number;
  imageRect: { left: number; top: number; width: number; height: number };
}

const ImageEditor: React.FC<ImageEditorProps> = ({ 
  imageUrl, 
  onClose, 
  onSave, 
  className = '',
  isPremium = true,
  onUpgrade,
  originalImageInfo
}) => {
  const t = useTranslations("imageEditor");
  
  // 狀態管理
  const [currentTool, setCurrentTool] = useState<string>('select');
  const [zoom, setZoom] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [originalImageUrl, setOriginalImageUrl] = useState<string>(''); // 保存真正的原始圖片 URL
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);  const [showToolsPanel, setShowToolsPanel] = useState<boolean>(false);
  const [showTopIndicator, setShowTopIndicator] = useState<boolean>(false);
  const [showBottomIndicator, setShowBottomIndicator] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>('');
  
  // 新增：歷史記錄管理器
  const [historyManager, setHistoryManager] = useState<HistoryManager>({
    actions: [],
    currentIndex: -1,
    maxHistory: 20 // 最多保存 20 個歷史記錄
  });
  

  
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const fabricCanvasElementRef = useRef<HTMLCanvasElement>(null);
  const brushPreviewRef = useRef<HTMLCanvasElement>(null);
  
  // 文字預覽狀態
  const [textPreviewData, setTextPreviewData] = useState<TextData | null>(null);
  const [imageRect, setImageRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  
  // 修復：添加防抖機制避免頻繁更新
  const [debouncedTextPreviewData, setDebouncedTextPreviewData] = useState<TextData | null>(null);
  const [isExternalTextUpdate, setIsExternalTextUpdate] = useState<boolean>(false);
  const [debouncedTextPosition, setDebouncedTextPosition] = useState<{ x: number; y: number } | null>(null);
  
  // 防抖文字預覽更新 - 手機版使用即時更新
  useEffect(() => {
    const debounceTime = isMobile ? 50 : 200; // 手機版50ms，桌面版200ms
    const timer = setTimeout(() => {
      console.log('ImageEditor: 防抖更新 debouncedTextPreviewData:', textPreviewData);
      setDebouncedTextPreviewData(textPreviewData);
      setIsExternalTextUpdate(false);
    }, debounceTime);
    
    return () => clearTimeout(timer);
  }, [textPreviewData, isMobile]);
  
  // 防抖位置更新
  useEffect(() => {
    if (textPreviewData) {
      const timer = setTimeout(() => {
        setDebouncedTextPosition({ x: textPreviewData.x, y: textPreviewData.y });
      }, 100); // 100ms 防抖，避免頻繁位置更新
      
      return () => clearTimeout(timer);
    }
  }, [textPreviewData?.x, textPreviewData?.y]);
  
  // 圖片原始尺寸狀態
  const [originalImageSize, setOriginalImageSize] = useState<{width: number, height: number}>({width: 0, height: 0});
  const [displaySize, setDisplaySize] = useState<{width: number, height: number}>({width: 0, height: 0});
  
  // 筆刷大小狀態 - 用於桌面版控制
  const [brushSize, setBrushSize] = useState<number>(20);
  
  // 橡皮擦事件處理函數狀態
  const [eraserEventHandlers, setEraserEventHandlers] = useState<{
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
  } | null>(null);
  
  const [eraserClearFunction, setEraserClearFunction] = useState<(() => Promise<void>) | null>(null);
  
  // 背景移除修復筆刷事件處理函數狀態
  const [backgroundRemoverEventHandlers, setBackgroundRemoverEventHandlers] = useState<{
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
  } | null>(null);
  
  // 檢測是否為移動設備 - 採用漢堡選單模式
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 動態計算最佳 Canvas 尺寸
  const getOptimalCanvasSize = useCallback(() => {
    if (isMobile) {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      // 手機版增大 Canvas 尺寸，提高文字顯示精度
      const maxSize = Math.min(screenWidth * 0.9, screenHeight * 0.7, 500);
      return { width: Math.round(maxSize), height: Math.round(maxSize) };
    }
    return { width: 600, height: 600 };
  }, [isMobile]);

  // Canvas 尺寸狀態
  const [canvasSize, setCanvasSize] = useState(getOptimalCanvasSize());

  // 當設備類型改變時更新 Canvas 尺寸
  useEffect(() => {
    const newCanvasSize = getOptimalCanvasSize();
    setCanvasSize(newCanvasSize);
    
    // 當 Canvas 尺寸改變時，重新繪製原始圖片以清除橡皮擦內容
    if (canvasRef.current && imageUrl && !isLoading) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        // 重新載入原始圖片，清除所有橡皮擦內容
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          // 重新計算圖片位置和尺寸 - 使用與 loadImageToCanvas 相同的邏輯
          const originalWidth = img.width;
          const originalHeight = img.height;
          
          // 確保圖片完全適應 Canvas 尺寸
          const canvasWidth = newCanvasSize.width;
          const canvasHeight = newCanvasSize.height;
          
          // 計算縮放比例，保持寬高比
          const canvasScaleX = canvasWidth / originalWidth;
          const canvasScaleY = canvasHeight / originalHeight;
          const canvasScale = Math.min(canvasScaleX, canvasScaleY, 1); // 不放大，只縮小
          
          // 計算實際顯示尺寸
          const imgWidth = Math.round(originalWidth * canvasScale);
          const imgHeight = Math.round(originalHeight * canvasScale);
          
          // 居中顯示
          const imgLeft = Math.round((canvasWidth - imgWidth) / 2);
          const imgTop = Math.round((canvasHeight - imgHeight) / 2);
          
          // 重新繪製圖片
          ctx.clearRect(0, 0, newCanvasSize.width, newCanvasSize.height);
          ctx.drawImage(img, imgLeft, imgTop, imgWidth, imgHeight);
        };
        img.src = imageUrl;
      }
    }
  }, [isMobile, getOptimalCanvasSize, imageUrl, isLoading]);

  // 注入自定義滾動條樣式
  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = scrollbarStyles;
    document.head.appendChild(styleElement);
    return () => document.head.removeChild(styleElement) as unknown as void;
  }, []);

  // 初始化 Fabric.js Canvas - 採用漢堡選單模式
  const initializeFabricCanvas = useCallback(() => {
    console.log('ImageEditor: 開始初始化 Fabric.js Canvas', { 
      hasElement: !!fabricCanvasElementRef.current, 
      imageUrl, 
      canvasSize 
    });
    
    if (!fabricCanvasElementRef.current || !imageUrl) {
      console.log('ImageEditor: Fabric.js Canvas 初始化條件不滿足');
      return;
    }

    // 清理現有的 Fabric Canvas
    if (fabricCanvasRef.current) {
      console.log('ImageEditor: 清理現有的 Fabric Canvas');
      fabricCanvasRef.current.dispose();
    }

    // 創建新的 Fabric Canvas，使用與主 Canvas 相同尺寸
    const canvas = new fabric.Canvas(fabricCanvasElementRef.current, {
      width: canvasSize.width,
      height: canvasSize.height,
      backgroundColor: 'transparent',
      selection: true, // 修復：啟用選取功能
      interactive: true, // 啟用互動功能
      preserveObjectStacking: true, // 保持物件堆疊順序
      // 優化拖曳體驗
      renderOnAddRemove: false, // 減少不必要的渲染
      // 參考 Fabric.js 最佳實踐的設定
      skipTargetFind: false, // 啟用目標查找
      selectionBorderColor: 'rgba(102,153,255,0.8)', // 選取邊框顏色
      selectionColor: 'rgba(102,153,255,0.3)', // 選取背景顏色
      selectionLineWidth: 2, // 選取線寬
      // 優化拖拽體驗
      enableRetinaScaling: true, // 啟用視網膜縮放
      allowTouchScrolling: true, // 允許觸控滾動
      // 優化文字編輯
      fireRightClick: true, // 啟用右鍵點擊
      fireMiddleClick: true, // 啟用中鍵點擊
      stopContextMenu: false, // 不阻止右鍵選單
      // 優化效能
      skipOffscreen: true, // 跳過螢幕外的物件
      // 優化互動
      perPixelTargetFind: true, // 像素級精確選取
      targetFindTolerance: 5, // 目標查找容差
      // 優化文字編輯
      defaultCursor: 'default', // 預設游標
      moveCursor: 'move', // 移動游標
      notAllowedCursor: 'not-allowed' // 不允許游標
    });
    
    // 強制設定 Canvas DOM 元素尺寸，確保與 canvasSize 完全一致
    if (fabricCanvasElementRef.current) {
      fabricCanvasElementRef.current.width = canvasSize.width;
      fabricCanvasElementRef.current.height = canvasSize.height;
      fabricCanvasElementRef.current.style.width = `${canvasSize.width}px`;
      fabricCanvasElementRef.current.style.height = `${canvasSize.height}px`;
    }
    
    // 強制 Fabric.js 重新計算尺寸
    canvas.setDimensions({
      width: canvasSize.width,
      height: canvasSize.height
    });
    
    fabricCanvasRef.current = canvas;
    console.log('ImageEditor: Fabric Canvas 初始化完成，尺寸:', {
      canvasSize: { width: canvasSize.width, height: canvasSize.height },
      fabricSize: { fabricWidth: canvas.width, fabricHeight: canvas.height },
      domSize: fabricCanvasElementRef.current ? {
        domWidth: fabricCanvasElementRef.current.width,
        domHeight: fabricCanvasElementRef.current.height,
        styleWidth: fabricCanvasElementRef.current.style.width,
        styleHeight: fabricCanvasElementRef.current.style.height
      } : null
    });
    console.log('ImageEditor: Fabric.js Canvas 創建成功', { 
      canvasWidth: canvasSize.width, 
      canvasHeight: canvasSize.height 
    });

    // 移除測試文字功能，因為現在有了真正的文字編輯功能
    // setTimeout(() => {
    //   if (fabricCanvasRef.current) {
    //     try {
    //       const testText = new fabric.Text('測試文字', {
    //         left: 50,
    //         top: 50,
    //         fontSize: 20,
    //         fill: 'red',
    //         selectable: false,
    //         evented: false
    //       });
    //       fabricCanvasRef.current.add(testText);
    //       fabricCanvasRef.current.renderAll();
    //       console.log('ImageEditor: 測試文字添加成功');
    //       
    //       // 3秒後移除測試文字
    //       setTimeout(() => {
    //         if (fabricCanvasRef.current) {
    //           const objects = fabricCanvasRef.current.getObjects();
    //           const testTextObj = objects.find(obj => obj.type === 'text' && (obj as fabric.Text).text === '測試文字');
    //           if (testTextObj) {
    //             fabricCanvasRef.current.remove(testTextObj);
    //             fabricCanvasRef.current.renderAll();
    //             console.log('ImageEditor: 測試文字已移除');
    //           }
    //         }
    //       }, 3000);
    //     } catch (error) {
    //       console.error('ImageEditor: 測試文字添加失敗:', error);
    //     }
    //   }
    // }, 1000);

    return () => {
      if (fabricCanvasRef.current) {
        console.log('ImageEditor: 清理 Fabric Canvas');
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [imageUrl, canvasSize, imageRect]);

  // 工具配置
  const tools: Tool[] = [
    {
      id: 'background-remove',
      name: t("tools.background_remove"),
      icon: <Scissors className="w-4 h-4" />,
      description: t("tool_descriptions.background_remove")
    },
    {
      id: 'add-text',
      name: t("tools.add_text"),
      icon: <Type className="w-4 h-4" />,
      description: t("tool_descriptions.add_text")
    },
    {
      id: 'area-eraser',
      name: t("tools.area_eraser"),
      icon: <Eraser className="w-4 h-4" />,
      description: t("tool_descriptions.area_eraser")
    },
    {
      id: 'resize',
      name: t("tools.resize"),
      icon: <RotateCw className="w-4 h-4" />,
      description: t("tool_descriptions.resize")
    },
    {
      id: 'expression',
      name: t("tools.expression"),
      icon: <Palette className="w-4 h-4" />,
      description: t("tool_descriptions.expression")
    },
    {
      id: 'style-switch',
      name: t("tools.style_switch"),
      icon: <Move className="w-4 h-4" />,
      description: t("tool_descriptions.style_switch")
    },  
  ];

  // 初始化 Fabric.js Canvas
  useEffect(() => {
    if (canvasRef.current && imageUrl && !isLoading && displaySize.width > 0) {
      initializeFabricCanvas();
    }
  }, [imageUrl, isLoading, displaySize, initializeFabricCanvas]);

  // 文字預覽渲染 - 支援拖拽功能
  useEffect(() => {
    console.log('ImageEditor: 文字預覽渲染 useEffect 觸發', { 
      hasTextData: !!debouncedTextPreviewData,
      debouncedTextPreviewData,
      imageRect,
      originalImageSize,
      isMobile,
      fabricCanvasExists: !!fabricCanvasRef.current
    });
    
    if (!fabricCanvasRef.current) {
      console.log('ImageEditor: Fabric Canvas 不存在，跳過文字預覽渲染');
      return;
    }
    
    if (!debouncedTextPreviewData) {
      console.log('ImageEditor: 沒有文字預覽資料，跳過渲染');
      return;
    }
    
    if (imageRect.width <= 0 || imageRect.height <= 0) {
      console.log('ImageEditor: 圖片矩形尺寸無效，使用 Canvas 尺寸作為備用', { imageRect, canvasSize });
      // 手機版備用方案：如果 imageRect 無效，使用整個 Canvas 尺寸
      if (isMobile) {
        const backupImageRect = { left: 0, top: 0, width: canvasSize.width, height: canvasSize.height };
        console.log('ImageEditor: 使用備用 imageRect:', backupImageRect);
        
        // 使用備用尺寸計算文字位置
        const left = backupImageRect.left + backupImageRect.width * (debouncedTextPreviewData.x / 100);
        const top = backupImageRect.top + backupImageRect.height * (debouncedTextPreviewData.y / 100);
        const scaleFactor = 1; // 不縮放
        const fontSize = Math.max(12, debouncedTextPreviewData.fontSize * scaleFactor);
        
        console.log('ImageEditor: 備用文字位置計算:', { left, top, fontSize });
        
        const fabricText = new fabric.IText(debouncedTextPreviewData.text, {
          left,
          top,
          fontSize,
          fontFamily: debouncedTextPreviewData.fontFamily,
          fill: debouncedTextPreviewData.color,
          fontWeight: debouncedTextPreviewData.bold ? 'bold' : 'normal',
          fontStyle: debouncedTextPreviewData.italic ? 'italic' : 'normal',
          textDecoration: debouncedTextPreviewData.underline ? 'underline' : 'none',
          textAlign: debouncedTextPreviewData.align,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true
        });
        
        fabricCanvasRef.current.add(fabricText);
        fabricCanvasRef.current.renderAll();
        console.log('ImageEditor: 備用文字渲染完成');
        return;
      }
      return;
    }
    
    console.log('ImageEditor: 開始渲染文字預覽');
    const canvas = fabricCanvasRef.current;
    
    // 修復：改進文字物件更新邏輯，避免每次重新創建
    const existingTexts = canvas.getObjects().filter((obj: fabric.Object) => obj.type === 'text' || obj.type === 'i-text');
    let fabricText: fabric.IText;
    
    if (existingTexts.length > 0) {
      // 如果已有文字物件，直接更新現有物件
      fabricText = existingTexts[0] as fabric.IText;
      console.log('ImageEditor: 更新現有文字物件');
      
      // 修復：使用 batchUpdate 避免多次重新渲染
      canvas.discardActiveObject(); // 取消選取，避免選取狀態干擾
      
      // 檢查是否需要更新文字內容（避免在拖曳時重置文字）
      const currentText = fabricText.text || '';
      const newText = debouncedTextPreviewData.text;
      // 修復：允許空字符串更新，確保可以完全刪除文字
      const shouldUpdateText = currentText !== newText;
      
      if (shouldUpdateText) {
        console.log('ImageEditor: 更新文字內容:', { currentText, newText });
        fabricText.set({
          text: newText,
          fontFamily: debouncedTextPreviewData.fontFamily,
          fill: debouncedTextPreviewData.color,
          fontWeight: debouncedTextPreviewData.bold ? 'bold' : 'normal',
          fontStyle: debouncedTextPreviewData.italic ? 'italic' : 'normal',
          textDecoration: debouncedTextPreviewData.underline ? 'underline' : 'none',
          textAlign: debouncedTextPreviewData.align
        });
      } else {
        console.log('ImageEditor: 保持現有文字內容，只更新樣式');
        // 只更新樣式，不更新文字內容
        fabricText.set({
          fontFamily: debouncedTextPreviewData.fontFamily,
          fill: debouncedTextPreviewData.color,
          fontWeight: debouncedTextPreviewData.bold ? 'bold' : 'normal',
          fontStyle: debouncedTextPreviewData.italic ? 'italic' : 'normal',
          textDecoration: debouncedTextPreviewData.underline ? 'underline' : 'none',
          textAlign: debouncedTextPreviewData.align
        });
      }
      
      // 更新位置和大小（配合原有設計）
      const left = imageRect.left + (imageRect.width * (debouncedTextPreviewData.x / 100));
      const top = imageRect.top + (imageRect.height * (debouncedTextPreviewData.y / 100));
      const scaleFactor = imageRect.width / (originalImageSize.width || imageRect.width);
      const fontSize = Math.max(12, debouncedTextPreviewData.fontSize * scaleFactor);
      
      fabricText.set({
        left,
        top,
        fontSize
      });
      
      // 一次性重新渲染
      canvas.renderAll();
      
    } else {
      // 如果沒有文字物件，檢查是否需要創建新的
      console.log('ImageEditor: 檢查是否需要創建新的文字物件');
      
      // 如果文字為空，不需要創建文字物件
      if (!debouncedTextPreviewData.text || debouncedTextPreviewData.text.trim() === '') {
        console.log('ImageEditor: 文字為空，移除所有文字物件');
        // 清除現有的文字物件
        existingTexts.forEach((obj: fabric.Object) => {
          canvas.remove(obj);
          obj.dispose();
        });
        canvas.renderAll();
        return;
      }
      
      // 創建新的文字物件
      console.log('ImageEditor: 創建新的文字物件');
      
      // 清除現有的文字物件
      existingTexts.forEach((obj: fabric.Object) => {
        canvas.remove(obj);
        obj.dispose();
      });
      canvas.renderAll();
      
      // 文字座標計算（配合原有設計，需要加上圖片在 Canvas 中的偏移）
      const left = imageRect.left + (imageRect.width * (debouncedTextPreviewData.x / 100));
      const top = imageRect.top + (imageRect.height * (debouncedTextPreviewData.y / 100));
      const scaleFactor = imageRect.width / (originalImageSize.width || imageRect.width);
      const fontSize = Math.max(12, debouncedTextPreviewData.fontSize * scaleFactor);
      
      console.log('ImageEditor: 文字位置計算詳細信息:', { 
        left, 
        top, 
        fontSize, 
        scaleFactor,
        isMobile,
        imageRect,
        originalImageSize,
        canvasSize,
        fabricCanvasExists: !!fabricCanvasRef.current,
        debouncedTextPreviewData: {
          x: debouncedTextPreviewData.x,
          y: debouncedTextPreviewData.y,
          fontSize: debouncedTextPreviewData.fontSize,
          text: debouncedTextPreviewData.text
        }
      });
      
      fabricText = new fabric.IText(debouncedTextPreviewData.text, {
        left,
        top,
        fontSize,
        fontFamily: debouncedTextPreviewData.fontFamily,
        fill: debouncedTextPreviewData.color,
        fontWeight: debouncedTextPreviewData.bold ? 'bold' : 'normal',
        fontStyle: debouncedTextPreviewData.italic ? 'italic' : 'normal',
        textDecoration: debouncedTextPreviewData.underline ? 'underline' : 'none',
        textAlign: debouncedTextPreviewData.align,
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        lockRotation: true,
        lockScalingX: false,
        lockScalingY: false,
        lockUniScaling: false,
        lockSkewingX: true,
        lockSkewingY: true,
        lockMovementX: false,
        lockMovementY: false,
        transparentCorners: true,
        cornerColor: 'rgba(102,153,255,0.8)',
        cornerSize: 8,
        padding: 5,
        editable: true,
        editingBorderColor: 'rgba(102,153,255,0.8)',
        cursorColor: 'rgba(102,153,255,0.8)',
        cursorWidth: 2,
        selectionColor: 'rgba(102,153,255,0.3)',
        perPixelTargetFind: true,
        strokeUniform: true,
        noScaleCache: false,
        originX: 'left',
        originY: 'top',
        centeredRotation: true,
        centeredScaling: true,
        snapAngle: 0,
        snapThreshold: 5,
        borderColor: 'rgba(102,153,255,0.8)',
        borderScaleFactor: 2,
        cornerStyle: 'circle',
        cornerStrokeColor: 'rgba(102,153,255,0.8)',
        cornerStrokeWidth: 2
      });
      
      // 添加事件處理器 - 使用 requestAnimationFrame 改善拖拽順暢度
      let isMoving = false;
      fabricText.on('moving', () => {
        // 使用 requestAnimationFrame 來確保流暢的拖拽體驗
        if (!isMoving) {
          isMoving = true;
          requestAnimationFrame(() => {
            if (fabricText && imageRect.width && imageRect.height && debouncedTextPreviewData) {
              const newX = ((fabricText.left || 0) - imageRect.left) / imageRect.width * 100;
              const newY = ((fabricText.top || 0) - imageRect.top) / imageRect.height * 100;
              
              const clampedX = Math.max(0, Math.min(100, newX));
              const clampedY = Math.max(0, Math.min(100, newY));
              
              // 減少抖動：設定最小移動閾值
              const threshold = 0.1; // 百分比閾值
              const deltaX = Math.abs(debouncedTextPreviewData.x - clampedX);
              const deltaY = Math.abs(debouncedTextPreviewData.y - clampedY);
              
              // 只在位置真正變化且超過閾值時更新
              if (deltaX > threshold || deltaY > threshold) {
                const updatedTextData = {
                  ...debouncedTextPreviewData,
                  x: clampedX,
                  y: clampedY
                };
                setTextPreviewData(updatedTextData);
              }
            }
            isMoving = false;
          });
        }
      });
      
      fabricText.on('modified', (e) => {
        const textObj = e.transform?.target as fabric.Text;
        if (!textObj || !imageRect.width || !imageRect.height || !debouncedTextPreviewData) return;
        
        const newX = ((textObj.left || 0) - imageRect.left) / imageRect.width * 100;
        const newY = ((textObj.top || 0) - imageRect.top) / imageRect.height * 100;
        
        const clampedX = Math.max(0, Math.min(100, newX));
        const clampedY = Math.max(0, Math.min(100, newY));
        
        // 修復：使用 Canvas 上的實際文字內容，而不是 debouncedTextPreviewData
        const currentText = textObj.text || debouncedTextPreviewData.text;
        
        // 修復：只更新位置，保持文字內容不變
        const updatedTextData = {
          ...debouncedTextPreviewData,
          x: clampedX,
          y: clampedY,
          text: currentText // 使用 Canvas 上的實際文字內容
        };
        setTextPreviewData(updatedTextData);
        console.log('ImageEditor: 文字拖拽完成，位置更新:', { 
          x: clampedX, 
          y: clampedY,
          originalText: currentText
        });
      });
      
      fabricText.on('scaling', (e) => {
        const textObj = e.transform?.target as fabric.Text;
        if (!textObj || !debouncedTextPreviewData) return;
        
        const newFontSize = Math.max(12, textObj.fontSize || fontSize);
        const newScaleFactor = imageRect.width / (originalImageSize.width || imageRect.width);
        const originalFontSize = newFontSize / newScaleFactor;
        
        console.log('ImageEditor: 文字縮放完成，大小更新:', { 
          newFontSize, 
          originalFontSize,
          scaleFactor: newScaleFactor 
        });
        
        const updatedTextData = {
          ...debouncedTextPreviewData,
          fontSize: Math.round(originalFontSize)
        };
        setTextPreviewData(updatedTextData);
      });
      
      fabricText.on('mousedblclick', () => {
        console.log('ImageEditor: 雙擊開始編輯文字');
        fabricText.enterEditing();
        fabricText.selectAll();
      });
      
      fabricText.on('selected', () => {
        console.log('ImageEditor: 文字被選取');
        canvas.setActiveObject(fabricText);
        canvas.renderAll();
      });
      
      fabricText.on('changed', () => {
        const textObj = fabricText;
        if (!textObj || !debouncedTextPreviewData || isExternalTextUpdate) return;
        
        const newText = textObj.text || '';
        console.log('ImageEditor: 文字內容變化:', newText);
        
        // 修復：避免循環更新，只在文字內容真正變化時更新
        if (newText !== debouncedTextPreviewData.text) {
          // 檢查是否正在進行外部更新
          if (isExternalTextUpdate) {
            console.log('ImageEditor: 忽略 Canvas changed 事件，正在進行外部更新');
            return;
          }
          
          // 如果文字變為空，移除文字物件
          if (!newText || newText.trim() === '') {
            console.log('ImageEditor: 文字變為空，移除文字物件');
            canvas.remove(textObj);
            textObj.dispose();
            canvas.renderAll();
            
            // 更新狀態為空文字
            const updatedTextData = {
              ...debouncedTextPreviewData,
              text: '',
              x: debouncedTextPreviewData.x,
              y: debouncedTextPreviewData.y
            };
            setTextPreviewData(updatedTextData);
            return;
          }
          
          // 修復：從 Fabric.js 物件獲取當前位置信息，而不是使用 debouncedTextPreviewData
          if (!imageRect.width || !imageRect.height) return;
          
          const currentLeft = textObj.left || 0;
          const currentTop = textObj.top || 0;
          
          // 計算當前位置相對於圖片的百分比
          const currentX = ((currentLeft - imageRect.left) / imageRect.width) * 100;
          const currentY = ((currentTop - imageRect.top) / imageRect.height) * 100;
          
          // 確保位置在有效範圍內
          const clampedX = Math.max(0, Math.min(100, currentX));
          const clampedY = Math.max(0, Math.min(100, currentY));
          
          const updatedTextData = {
            ...debouncedTextPreviewData,
            text: newText,
            x: clampedX, // 使用從 Fabric.js 物件獲取的當前位置
            y: clampedY  // 使用從 Fabric.js 物件獲取的當前位置
          };
          setTextPreviewData(updatedTextData);
          console.log('ImageEditor: 文字內容更新，保留當前位置:', { 
            text: newText, 
            x: clampedX, 
            y: clampedY,
            fabricLeft: currentLeft,
            fabricTop: currentTop
          });
        }
      });
      
      fabricText.on('editing:entered', () => {
        console.log('ImageEditor: 開始編輯文字');
        // 標記正在編輯，避免位置重置
        setIsExternalTextUpdate(true);
        
        // 通知 TextEditor 開始 Canvas 編輯
        handleTextContentUpdate(fabricText.text || '');
      });
      
      fabricText.on('editing:exited', () => {
        console.log('ImageEditor: 結束編輯文字');
        // 延遲清除編輯標記，確保文字內容更新完成
        setTimeout(() => {
          setIsExternalTextUpdate(false);
          
          // 通知 TextEditor Canvas 編輯完成
          handleTextContentUpdate(fabricText.text || '');
        }, 100);
        canvas.renderAll();
      });
      
      fabricText.on('deselected', () => {
        console.log('ImageEditor: 文字取消選取');
      });
      
      canvas.add(fabricText);
      canvas.renderAll();
    }
    
    console.log('ImageEditor: 文字預覽渲染完成，支援拖拽和編輯');
    
  }, [debouncedTextPreviewData, imageRect, originalImageSize]);

  // 載入圖片
  useEffect(() => {
    if (imageUrl && canvasRef.current) {
      loadImageToCanvas(imageUrl);
    }
  }, [imageUrl]); // 移除 canvasSize 依賴，避免不斷重新載入

  const loadImageToCanvas = async (url: string) => {
    setIsLoading(true);
    setLoadError('');
    
    // 保存原始圖片 URL
    setOriginalImageUrl(url);
    
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        const error = 'Canvas 元素不存在';
        console.error(error);
        setLoadError('初始化失敗：Canvas 元素不存在');
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const error = '無法獲取 Canvas 2D 上下文';
        console.error(error);
        setLoadError('初始化失敗：無法獲取 Canvas 2D 上下文');
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = (error) => {
          console.error('圖片載入失敗:', error);
          const errorMessage = '圖片載入失敗，請檢查圖片 URL 是否正確或網路連線是否正常';
          setLoadError(errorMessage);
          reject(new Error(errorMessage));
        };
        img.src = url;
      });

      // 保存原始尺寸
      const originalWidth = img.width;
      const originalHeight = img.height;
      setOriginalImageSize({width: originalWidth, height: originalHeight});

      // 計算圖片在 Canvas 上的實際位置
      const canvasWidth = canvasSize.width;
      const canvasHeight = canvasSize.height;
      
      // 計算縮放比例，保持寬高比
      const scaleX = canvasWidth / originalWidth;
      const scaleY = canvasHeight / originalHeight;
      const scale = Math.min(scaleX, scaleY, 1); // 不放大，只縮小
      
      // 計算實際顯示尺寸
      const imgWidth = Math.round(originalWidth * scale);
      const imgHeight = Math.round(originalHeight * scale);
      
      // 居中顯示
      const imgLeft = Math.round((canvasWidth - imgWidth) / 2);
      const imgTop = Math.round((canvasHeight - imgHeight) / 2);
      
      // 設置顯示尺寸（用於其他組件）
      setDisplaySize({width: imgWidth, height: imgHeight});
      
      const newImageRect = { left: imgLeft, top: imgTop, width: imgWidth, height: imgHeight };
      setImageRect(newImageRect);
      console.log('ImageEditor: 設置 imageRect:', newImageRect, '手機版:', isMobile);

      // Canvas 使用動態尺寸，確保效能
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
      
      // 繪製圖片到動態尺寸的 Canvas
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
      ctx.drawImage(img, imgLeft, imgTop, imgWidth, imgHeight);
      
      // 調試信息
      // console.log('圖片載入完成:', {
      //   originalSize: { width: originalWidth, height: originalHeight },
      //   canvasSize: { width: canvasSize.width, height: canvasSize.height },
      //   displaySize: { width: imgWidth, height: imgHeight },
      //   position: { left: imgLeft, top: imgTop },
      //   isMobile
      // });
      
      // 初始化覆蓋層canvas（也使用動態尺寸）
      if (overlayCanvasRef.current) {
        overlayCanvasRef.current.width = canvasSize.width;
        overlayCanvasRef.current.height = canvasSize.height;
      }
      
      // 初始化 Fabric Canvas
      setTimeout(() => {
        initializeFabricCanvas();
      }, 100);
      
      // 保存初始狀態到歷史記錄
      setTimeout(async () => {
        try {
          const snapshot = await createCanvasSnapshot();
          const initialAction: EditAction = {
            type: 'initial',
            data: {
              deviceType: isMobile ? 'mobile' : 'desktop',
              canvasSize,
              windowWidth: typeof window !== 'undefined' ? window.innerWidth : 0
            },
            timestamp: Date.now(),
            canvasSnapshot: snapshot.canvasData,
            fabricSnapshot: snapshot.fabricData,
            textData: snapshot.textData
          };
          
          setHistoryManager(prev => ({
            ...prev,
            actions: [initialAction],
            currentIndex: 0
          }));
          
          console.log('保存初始狀態到歷史記錄', { 
            deviceType: isMobile ? 'mobile' : 'desktop',
            canvasSize,
            windowWidth: typeof window !== 'undefined' ? window.innerWidth : 0
          });
        } catch (error) {
          console.error('保存初始狀態失敗:', error);
        }
      }, 300);
      
    } catch (error) {
      console.error('Failed to load image:', error);
      if (!loadError) {
        setLoadError('圖片載入失敗，請稍後重試');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 滾動處理函數 - 採用漢堡選單模式
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    // 簡化的滾動指示器邏輯
    setShowTopIndicator(scrollTop > 10);
    setShowBottomIndicator(scrollHeight - scrollTop - clientHeight > 10);
  };

  // 處理工具選擇
  const handleToolSelect = useCallback((toolId: string) => {
    if (!isPremium) {
      // 免費用戶點擊工具時顯示升級提示
      if (onUpgrade) {
        onUpgrade();
      }
      return;
    }
    
    // 切換工具時清空當前工具狀態
    if (currentTool !== toolId) {
      console.log('切換工具:', currentTool, '->', toolId);
      
      // 清空文字預覽數據
      if (currentTool === 'add-text') {
        setTextPreviewData(null);
        setDebouncedTextPreviewData(null);
      }
      
      // 清空橡皮擦路徑（如果從橡皮擦工具切換）
      if (currentTool === 'area-eraser') {
        // 這裡可以通知 AreaEraser 組件清空路徑
        console.log('清空橡皮擦路徑');
      }
      
      // 清空背景移除修復狀態（如果從背景移除工具切換）
      if (currentTool === 'background-remove') {
        console.log('清空背景移除修復狀態');
      }
    }
    
    setCurrentTool(toolId);
    setShowToolsPanel(false); // 手機版選擇工具後關閉面板
  }, [isPremium, onUpgrade, currentTool]);

  // 使用 useRef 來存儲 textPreviewData，避免依賴項問題
  const textPreviewDataRef = useRef(textPreviewData);
  textPreviewDataRef.current = textPreviewData;

  // 新增：創建 Canvas 狀態快照
  const createCanvasSnapshot = useCallback(async (): Promise<CanvasState> => {
    const canvas = canvasRef.current;
    const fabricCanvas = fabricCanvasRef.current;
    
    if (!canvas) {
      throw new Error('Canvas 不存在');
    }
    
    // 獲取主 Canvas 的 base64 數據
    const canvasData = canvas.toDataURL('image/png');
    
    // 獲取 Fabric.js 物件的 JSON 數據
    let fabricData = '';
    if (fabricCanvas) {
      fabricData = JSON.stringify(fabricCanvas.toJSON());
    }
    
    return {
      canvasData,
      fabricData,
      textData: textPreviewDataRef.current, // 使用 ref 而不是直接依賴
      zoom,
      imageRect
    };
  }, [zoom, imageRect]); // 移除 textPreviewData 依賴，使用 ref

  // 新增：恢復 Canvas 狀態
  const restoreCanvasState = useCallback(async (state: CanvasState) => {
    const canvas = canvasRef.current;
    const fabricCanvas = fabricCanvasRef.current;
    
    if (!canvas) return;
    
    try {
      // 恢復主 Canvas
      const img = new Image();
      // 不設定 crossOrigin，因為這是 base64 數據，不會有跨域問題
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = state.canvasData;
      });
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // 完全清除 Canvas，避免重疊
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // 使用正確的尺寸和位置繪製圖片
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      
      // 恢復 Fabric.js 物件
      if (fabricCanvas && state.fabricData) {
        fabricCanvas.clear();
        fabricCanvas.loadFromJSON(JSON.parse(state.fabricData), () => {
          fabricCanvas.renderAll();
        });
      }
      
      // 恢復其他狀態
      setZoom(state.zoom);
      setImageRect(state.imageRect);
      setTextPreviewData(state.textData);
      
      // 保持當前工具狀態，不重置筆刷大小
      // setCurrentTool('select'); // 註釋掉這行
      
    } catch (error) {
      console.error('恢復 Canvas 狀態失敗:', error);
    }
  }, []);
  // 新增：保存狀態快照到歷史記錄
  const saveStateToHistory = useCallback(async (actionType: string, actionData: Record<string, unknown>) => {
    try {
      const snapshot = await createCanvasSnapshot();
      
      const action: EditAction = {
        type: actionType,
        data: actionData,
        timestamp: Date.now(),
        canvasSnapshot: snapshot.canvasData,
        fabricSnapshot: snapshot.fabricData,
        textData: snapshot.textData
      };
      
      setHistoryManager(prev => {
        const newActions = [...prev.actions.slice(0, prev.currentIndex + 1), action];
        
        // 限制歷史記錄數量
        if (newActions.length > prev.maxHistory) {
          newActions.splice(0, newActions.length - prev.maxHistory);
        }
        
        return {
          ...prev,
          actions: newActions,
          currentIndex: newActions.length - 1
        };
      });
      
    } catch (error) {
      console.error('保存狀態快照失敗:', error);
    }
  }, [createCanvasSnapshot]);

  // 使用 useRef 來存儲 saveStateToHistory 函數，避免依賴項問題
  const saveStateToHistoryRef = useRef(saveStateToHistory);
  saveStateToHistoryRef.current = saveStateToHistory;

  // 改進：工具完成處理 - 只在實際操作完成時記錄歷史
  const handleToolComplete = useCallback(async (toolId: string, data: unknown) => {
    console.log('工具完成:', toolId, data);
    
    // 處理加文字功能
    if (toolId === 'add-text') {
      console.log('加文字功能完成:', data);
      const textData = data as TextData;
      setTextPreviewData(textData);
      // 只在文字實際添加時記錄歷史
      await saveStateToHistoryRef.current(toolId, data as Record<string, unknown>);
      
      // 🎯 新增：文字編輯完成後自動保存到編輯圖片集合
      if (originalImageInfo && isPremium) {
        console.log('🚀 文字編輯完成，自動保存到編輯圖片集合');
        try {
          // 等待一下確保文字完全渲染
          setTimeout(async () => {
            // 生成包含文字的圖片 blob
            const canvas = canvasRef.current;
            if (canvas) {
              console.log('🔍 準備保存 Canvas，當前狀態:', {
                hasCanvas: !!canvas,
                canvasWidth: canvas.width,
                canvasHeight: canvas.height
              });
              
              // 檢查 Canvas 是否被污染
              try {
                // 先嘗試獲取一個像素來檢測是否被污染
                const testCtx = canvas.getContext('2d');
                if (testCtx) {
                  testCtx.getImageData(0, 0, 1, 1);
                }
                
                // 如果沒有拋出錯誤，說明 Canvas 沒有被污染，可以正常保存
                canvas.toBlob(async (blob) => {
                  if (blob) {
                    console.log('✅ 生成包含文字的圖片 blob，大小:', blob.size);
                    
                    const formData = new FormData();
                    formData.append('editedImage', blob, 'edited-image-with-text.png');
                    formData.append('originalImageId', originalImageInfo.id);
                    formData.append('prompt', originalImageInfo.prompt);
                    formData.append('modelName', originalImageInfo.modelName);
                    formData.append('source', originalImageInfo.source);
                  
                    console.log('📤 自動保存文字編輯結果到本地 API');
                    const response = await fetch(
                      `/api/user/edited-images`,
                      {
                        method: 'POST',
                        credentials: 'include',
                        body: formData
                      }
                    );
                    
                    console.log('📥 自動保存響應:', response.status, response.statusText);
                    
                    if (response.ok) {
                      const result = await response.json();
                      console.log('✅ 文字編輯結果已自動保存:', result);
                    } else {
                      const errorText = await response.text();
                      console.error('❌ 自動保存文字編輯結果失敗:', response.status, errorText);
                    }
                  }
                }, 'image/png');
              } catch (toBlobError) {
                console.warn('⚠️ Canvas 被污染，跳過自動保存:', toBlobError);
                console.warn('⚠️ 文字編輯功能仍然正常，只是無法自動保存到編輯圖片集合');
                console.warn('⚠️ 這通常是因為圖片來源跨域，不影響編輯功能');
              }
            }
          }, 500); // 等待 500ms 確保文字完全渲染
        } catch (error) {
          console.error('❌ 自動保存文字編輯結果失敗:', error);
        }
      }
      
      setCurrentTool('select');
      return;
    }
    
    // 處理區域擦除功能
    if (toolId === 'area-eraser') {
      console.log('區域擦除功能完成:', data);
      // 只在實際擦除操作完成時記錄歷史
      await saveStateToHistoryRef.current(toolId, data as Record<string, unknown>);
      return; // 不重置 currentTool，讓用戶可以繼續擦除
    }
    
    // 處理背景移除功能
    if (toolId === 'background-remove') {
      console.log('=== ImageEditor: handleToolComplete - 背景移除功能完成 ===', {
        toolId,
        dataType: typeof data,
        data
      });
      
      // 檢查是否為修復筆刷操作
      if (data && typeof data === 'object' && 'type' in data) {
        const result = data as { type: string; data: Record<string, unknown> };
        console.log('=== ImageEditor: 檢測到結構化數據 ===', {
          resultType: result.type,
          isRepairBrush: result.type === 'background-remove-repair'
        });
        
        if (result.type === 'background-remove-repair') {
          console.log('=== ImageEditor: 準備記錄修復筆刷歷史 ===', result.data);
          await saveStateToHistoryRef.current('background-remove-repair', result.data);
          console.log('=== ImageEditor: 修復筆刷歷史記錄完成 ===');
          return; // 不重置 currentTool
        }
      }
      
      // 只在背景移除實際完成時記錄歷史
      console.log('=== ImageEditor: 記錄一般背景移除歷史 ===');
      await saveStateToHistoryRef.current(toolId, data as Record<string, unknown>);
      return; // 不重置 currentTool
    }
    
    // 處理表情姿勢調整功能
    if (toolId === 'expression') {
      console.log('=== ImageEditor: handleToolComplete - 表情姿勢調整完成 ===', {
        toolId,
        dataType: typeof data,
        data
      });
      
      // 記錄歷史
      await saveStateToHistoryRef.current(toolId, data as Record<string, unknown>);
      setCurrentTool('select');
      return;
    }
    
    // 處理尺寸調整功能
    if (toolId === 'resize') {
      console.log('=== ImageEditor: handleToolComplete - 尺寸調整完成 ===', {
        toolId,
        dataType: typeof data,
        data
      });
      
      // 記錄歷史
      await saveStateToHistoryRef.current(toolId, data as Record<string, unknown>);
      setCurrentTool('select');
      return;
    }
    
    // 其他工具完成時記錄歷史
    await saveStateToHistoryRef.current(toolId, data as Record<string, unknown>);
    setCurrentTool('select');
  }, []); // 移除 saveStateToHistory 依賴項，使用 useRef

  // 接收橡皮擦事件處理函數
  const handleEraserEventHandlersReady = useCallback((handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
  }) => {
    console.log('ImageEditor: 接收橡皮擦事件處理函數', { 
      hasHandlers: !!handlers,
      hasOnMouseDown: !!handlers.onMouseDown,
      hasOnMouseMove: !!handlers.onMouseMove
    });
    setEraserEventHandlers(handlers);
  }, []);

  const handleEraserClearFunctionReady = useCallback((clearFunction: () => Promise<void>) => {
    setEraserClearFunction(() => clearFunction);
  }, []);

  // 背景移除修復清除函數回調
  const [backgroundRemoverClearFunction, setBackgroundRemoverClearFunction] = useState<(() => Promise<void>) | null>(null);
  const handleBackgroundRemoverClearFunctionReady = useCallback((clearFunction: () => Promise<void>) => {
    setBackgroundRemoverClearFunction(() => clearFunction);
  }, []);

  // 背景移除修復重置函數回調
  const [backgroundRemoverResetFunction, setBackgroundRemoverResetFunction] = useState<(() => void) | null>(null);
  const handleBackgroundRemoverResetFunctionReady = useCallback((resetFunction: () => void) => {
    setBackgroundRemoverResetFunction(() => resetFunction);
  }, []);

  const handleBackgroundRemoverEventHandlersReady = useCallback((handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
  }) => {
    setBackgroundRemoverEventHandlers(handlers);
  }, []);

  const handleBackgroundRemoverResetRepair = useCallback(() => {
    console.log('背景移除修復: 重置修復內容，保持修復模式開啟');
    if (backgroundRemoverResetFunction) {
      try {
        backgroundRemoverResetFunction();
        console.log('背景移除修復: 重置函數執行成功');
      } catch (error) {
        console.error('背景移除修復: 重置函數執行失敗', error);
      }
    } else {
      console.warn('背景移除修復: 沒有可用的重置函數');
    }
    // 不切換工具，保持在背景移除修復模式
  }, [backgroundRemoverResetFunction]);

  const handleBackgroundRemoverExitRepair = useCallback(async () => {
    console.log('背景移除修復: 退出修復模式，撤銷所有修復筆刷操作');
    
    // 計算需要撤銷多少個修復筆刷操作
    let repairBrushCount = 0;
    console.log('背景移除修復: 檢查歷史記錄', {
      currentIndex: historyManager.currentIndex,
      totalActions: historyManager.actions.length
    });
    
    for (let i = historyManager.currentIndex; i >= 0; i--) {
      const action = historyManager.actions[i];
      console.log(`背景移除修復: 檢查歷史記錄 ${i}`, {
        hasAction: !!action,
        type: action?.type,
        dataAction: action?.data?.action
      });
      
      if (action && action.type === 'background-remove') {
        if (action.data && action.data.action === 'repair-brush') {
          repairBrushCount++;
          console.log(`背景移除修復: 找到修復筆刷操作 ${i}，計數: ${repairBrushCount}`);
        } else {
          // 遇到非修復筆刷的背景移除操作，停止計算
          console.log(`背景移除修復: 遇到非修復筆刷操作 ${i}，停止計算`, action.data);
          break;
        }
      }
    }
    
    console.log(`背景移除修復: 發現 ${repairBrushCount} 個修復筆刷操作需要撤銷`);
    
    // 執行撤銷操作
    for (let i = 0; i < repairBrushCount; i++) {
      if (historyManager.currentIndex > 0) {
        console.log(`背景移除修復: 撤銷第 ${i + 1}/${repairBrushCount} 個修復筆刷操作`);
        
        // 直接實現撤銷邏輯，避免依賴項問題
        const newIndex = historyManager.currentIndex - 1;
        const targetAction = historyManager.actions[newIndex];
        
        if (targetAction && targetAction.canvasSnapshot) {
          try {
            const state = {
              canvasData: targetAction.canvasSnapshot,
              fabricData: targetAction.fabricSnapshot || '',
              textData: targetAction.textData || null,
              zoom: zoom,
              imageRect: imageRect
            };
            
            await restoreCanvasState(state);
            
            setHistoryManager(prev => ({
              ...prev,
              currentIndex: newIndex
            }));
            
            console.log(`背景移除修復: 撤銷成功，恢復到歷史記錄: ${newIndex}`);
          } catch (error) {
            console.error('背景移除修復: 撤銷失敗:', error);
            break; // 撤銷失敗，停止後續撤銷
          }
        }
      }
    }
    
    if (repairBrushCount > 0) {
      console.log(`背景移除修復: 已撤銷所有 ${repairBrushCount} 個修復筆刷操作`);
    } else {
      console.log('背景移除修復: 沒有找到修復筆刷操作，嘗試直接清除 Canvas');
      
      // 備用方案：直接恢復到原始圖片
      const canvas = canvasRef.current;
      if (canvas && originalImageUrl) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          console.log('背景移除修復: 恢復到原始圖片');
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            console.log('背景移除修復: Canvas 已恢復到原始圖片，修復筆刷已清除');
          };
          img.onerror = (error) => {
            console.error('背景移除修復: 恢復原始圖片失敗', error);
          };
          img.src = originalImageUrl;
        }
      } else {
        console.warn('背景移除修復: 無法恢復 Canvas，缺少必要條件', {
          hasCanvas: !!canvas,
          hasOriginalImageUrl: !!originalImageUrl
        });
      }
    }
    
    // 調用 BackgroundRemover 的清除函數清理狀態
    if (backgroundRemoverClearFunction) {
      try {
        await backgroundRemoverClearFunction();
        console.log('背景移除修復: 狀態清理完成');
      } catch (error) {
        console.error('背景移除修復: 狀態清理失敗', error);
      }
    }
    
    setCurrentTool('select');
  }, [historyManager, zoom, imageRect, restoreCanvasState, backgroundRemoverClearFunction, originalImageUrl]);

  // 背景移除工具關閉處理
  const handleBackgroundRemoverClose = useCallback(() => {
    setCurrentTool('select');
  }, []);

  // 添加一個標記來防止關閉時的循環更新
  const [isClosingTextEditor, setIsClosingTextEditor] = useState(false);

  // 文字預覽更新處理（從 TextEditor 接收）- 優化版本，減少重新渲染
  const handleTextPreviewUpdate = useCallback((textData: unknown) => {
    // 如果正在關閉文字編輯器，忽略更新
    if (isClosingTextEditor) {
      console.log('ImageEditor: 忽略文字預覽更新，正在關閉文字編輯器');
      return;
    }
    
    console.log('ImageEditor: 接收到文字預覽更新:', textData);
    console.log('ImageEditor: 當前 textPreviewDataRef.current:', textPreviewDataRef.current);
    
    // 避免循環更新：只在文字內容真正變化時才更新
    const newTextData = textData as TextData;
    const hasTextChanged = textPreviewDataRef.current?.text !== newTextData?.text;
    const hasPositionChanged = textPreviewDataRef.current?.x !== newTextData?.x || textPreviewDataRef.current?.y !== newTextData?.y;
    const hasStyleChanged = textPreviewDataRef.current?.fontSize !== newTextData?.fontSize ||
                           textPreviewDataRef.current?.fontFamily !== newTextData?.fontFamily ||
                           textPreviewDataRef.current?.color !== newTextData?.color ||
                           textPreviewDataRef.current?.align !== newTextData?.align ||
                           textPreviewDataRef.current?.bold !== newTextData?.bold ||
                           textPreviewDataRef.current?.italic !== newTextData?.italic ||
                           textPreviewDataRef.current?.underline !== newTextData?.underline;
    
    console.log('ImageEditor: 變化檢測:', { hasTextChanged, hasPositionChanged, hasStyleChanged });
    
    // 手機版問題修復：強制更新，不依賴變化檢測
    const shouldForceUpdate = !textPreviewDataRef.current || hasTextChanged || hasPositionChanged || hasStyleChanged;
    
    if (shouldForceUpdate) {
      console.log('ImageEditor: 執行文字預覽更新');
      
      setIsExternalTextUpdate(true); // 標記為外部更新，避免觸發 Canvas changed 事件
      
      // 延遲清除外部更新標記，確保 Canvas 事件不會干擾
      setTimeout(() => {
        setIsExternalTextUpdate(false);
      }, 100); // 100ms 後清除標記
      
      // 更新文字預覽數據並同步更新 ref
      setTextPreviewData(newTextData);
      textPreviewDataRef.current = newTextData;
      
      // 手機版強制即時更新，不等防抖
      if (isMobile) {
        console.log('ImageEditor: 手機版強制即時更新 debouncedTextPreviewData');
        setDebouncedTextPreviewData(newTextData);
      }
    } else {
      console.log('ImageEditor: 文字數據未變化，跳過更新');
    }
  }, [isClosingTextEditor, isMobile]); // 添加 isMobile 依賴項

  // 文字位置更新處理（從拖拽事件接收）- 修復：避免循環更新
  const handleTextPositionUpdate = useCallback((position: { x: number; y: number }) => {
    console.log('ImageEditor: 接收到文字位置更新:', position);
    // 移除：避免循環更新 textPreviewData
    // if (textPreviewData) {
    //   const updatedTextData = {
    //     ...textPreviewData,
    //     x: position.x,
    //     y: position.y
    //   };
    //   setTextPreviewData(updatedTextData);
    //   console.log('ImageEditor: 文字位置已更新到 textPreviewData:', updatedTextData);
    // }
  }, []);

  // 文字內容更新處理（從拖拽事件接收）- 修復：避免循環更新
  const handleTextContentUpdate = useCallback((text: string) => {
    console.log('ImageEditor: 接收到文字內容更新:', text);
    // 移除：避免循環更新
    // 這裡可以將內容更新傳遞給 ToolPanel
  }, []);

  // 工具相關函數已移至各工具組件內部管理

  // 當文字工具被選擇時，清除之前的文字預覽
  useEffect(() => {
    if (currentTool !== 'add-text' && fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      const existingTexts = canvas.getObjects().filter((obj: fabric.Object) => obj.type === 'text');
      existingTexts.forEach((obj: fabric.Object) => canvas.remove(obj));
      canvas.renderAll();
      setTextPreviewData(null);
    }
  }, [currentTool]);

  // 當工具切換時，清理事件處理函數
  useEffect(() => {
    if (currentTool !== 'area-eraser') {
      setEraserEventHandlers(null);
    }
    if (currentTool !== 'background-remove') {
      setBackgroundRemoverEventHandlers(null);
    }
  }, [currentTool]);



  // 改進：撤銷功能
  const handleUndo = useCallback(async () => {
    if (historyManager.currentIndex > 0) {
      const newIndex = historyManager.currentIndex - 1;
      const targetAction = historyManager.actions[newIndex];
      
      if (targetAction && targetAction.canvasSnapshot) {
        try {
          // 恢復到目標狀態
          const state: CanvasState = {
            canvasData: targetAction.canvasSnapshot,
            fabricData: targetAction.fabricSnapshot || '',
            textData: targetAction.textData || null,
            zoom: zoom, // 保持當前縮放
            imageRect: imageRect // 保持當前圖片位置
          };
          
          await restoreCanvasState(state);
          
          // 更新歷史記錄索引
          setHistoryManager(prev => ({
            ...prev,
            currentIndex: newIndex
          }));
          
          console.log('撤銷成功，恢復到歷史記錄:', newIndex);
          // 撤銷後不應該清除事件處理函數，讓工具繼續正常工作
          console.log('撤銷: 保持當前工具狀態和事件處理函數', { currentTool });
        } catch (error) {
          console.error('撤銷失敗:', error);
        }
      }
    }
  }, [historyManager, zoom, imageRect, restoreCanvasState]);

  // 改進：重做功能
  const handleRedo = useCallback(async () => {
    if (historyManager.currentIndex < historyManager.actions.length - 1) {
      const newIndex = historyManager.currentIndex + 1;
      const targetAction = historyManager.actions[newIndex];
      
      if (targetAction && targetAction.canvasSnapshot) {
        try {
          // 恢復到目標狀態
          const state: CanvasState = {
            canvasData: targetAction.canvasSnapshot,
            fabricData: targetAction.fabricSnapshot || '',
            textData: targetAction.textData || null,
            zoom: zoom, // 保持當前縮放
            imageRect: imageRect // 保持當前圖片位置
          };
          
          await restoreCanvasState(state);
          
          // 更新歷史記錄索引
          setHistoryManager(prev => ({
            ...prev,
            currentIndex: newIndex
          }));
          
          console.log('重做成功，恢復到歷史記錄:', newIndex);
          // 重做後不應該清除事件處理函數，讓工具繼續正常工作
          console.log('重做: 保持當前工具狀態和事件處理函數', { currentTool });
        } catch (error) {
          console.error('重做失敗:', error);
        }
      }
    }
  }, [historyManager, zoom, imageRect, restoreCanvasState]);

  // 縮放控制
  const handleZoomIn = () => {
    setZoom(Math.min(zoom * 1.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom / 1.2, 0.1));
  };

  // 改進：保存圖片功能
  const handleSave = useCallback(async () => {
    console.log('🔍 handleSave 被調用');
    console.log('🔍 originalImageInfo:', originalImageInfo);
    console.log('🔍 isPremium:', isPremium);
    
    if (!canvasRef.current) {
      console.log('❌ canvasRef.current 不存在');
      return;
    }
    
    try {
      const canvas = canvasRef.current;
      canvas.toBlob(async (blob) => {
        if (blob) {
          console.log('✅ blob 生成成功，大小:', blob.size);
          const url = URL.createObjectURL(blob);
          
          // 如果有原始圖片信息，保存到已編輯圖片
          if (originalImageInfo && isPremium) {
            console.log('🚀 開始保存到編輯圖片集合');
            try {
              const formData = new FormData();
              formData.append('editedImage', blob, 'edited-image.png');
              formData.append('originalImageId', originalImageInfo.id);
              formData.append('prompt', originalImageInfo.prompt);
              formData.append('modelName', originalImageInfo.modelName);
              formData.append('source', originalImageInfo.source);
              
              console.log('📤 發送請求到本地 API');
              const response = await fetch(
                `/api/user/edited-images`,
                {
                  method: 'POST',
                  credentials: 'include',
                  body: formData
                }
              );
              
              console.log('📥 收到響應:', response.status, response.statusText);
              
              if (response.ok) {
                const result = await response.json();
                console.log('✅ 已保存到編輯圖片集合:', result);
              } else {
                const errorText = await response.text();
                console.error('❌ 保存到編輯圖片集合失敗:', response.status, errorText);
              }
            } catch (error) {
              console.error('❌ 保存到編輯圖片集合失敗:', error);
            }
          } else {
            console.log('⚠️ 跳過保存到編輯圖片集合:', {
              hasOriginalImageInfo: !!originalImageInfo,
              isPremium
            });
          }
          
          // 通知父組件
          onSave(url);
          
          console.log('✅ 圖片保存成功');
        } else {
          console.log('❌ blob 生成失敗');
        }
      }, 'image/png');
      
    } catch (error) {
      console.error('❌ 保存圖片失敗:', error);
    }
  }, [onSave, originalImageInfo, isPremium]);

  // 改進：快速備份功能
  const handleQuickBackup = useCallback(async () => {
    if (!canvasRef.current) return;
    
    try {
      const fileName = `edited-image-${Date.now()}.png`;
      
      // 使用改進的 Canvas 下載函數，iOS Safari 將顯示分享面板
      const { downloadImageFromCanvas } = await import('@/utils/downloadHelper');
      const result = await downloadImageFromCanvas(canvasRef.current, fileName, 1.0);
      
      if (result.success) {
        console.log('快速備份成功');
        if (result.method === 'share') {
          console.log('請選擇「儲存圖片」保存到相簿');
        }
      } else {
        throw new Error('Backup failed');
      }
    } catch (error) {
      console.error('快速備份失敗:', error);
    }
  }, []);

  // 橡皮擦模式下游標為圓形
  // const eraserCursor = (currentTool === 'area-eraser' && isEraserActive) // 移除橡皮擦狀態
  //   ? 'crosshair'
  //   : 'default';

  // 調試資訊
  // console.log('狀態檢查:', { currentTool, isEraserActive, eraserCursor }); // 移除橡皮擦狀態

  // 添加 CSS 樣式來強制游標
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      /* .eraser-active { // 移除橡皮擦狀態 */
      /*   cursor: crosshair !important; */
      /* } */
      
      /* 手機版滑動條樣式 */
      .slider-mobile {
        -webkit-appearance: none;
        appearance: none;
      }
      
      .slider-mobile::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #8b5cf6;
        cursor: pointer;
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }
      
      .slider-mobile::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #8b5cf6;
        cursor: pointer;
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }
      
      .slider-mobile::-webkit-slider-track {
        height: 4px;
        border-radius: 2px;
      }
      
      .slider-mobile::-moz-range-track {
        height: 4px;
        border-radius: 2px;
      }

      /* 電腦版滑動條樣式 */
      .slider-desktop {
        -webkit-appearance: none;
        appearance: none;
      }

      .slider-desktop::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #8b5cf6;
        cursor: pointer;
        border: 1px solid white;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }

      .slider-desktop::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #8b5cf6;
        cursor: pointer;
        border: 1px solid white;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }

      .slider-desktop::-webkit-slider-track {
        height: 3px;
        border-radius: 1.5px;
      }

      .slider-desktop::-moz-range-track {
        height: 3px;
        border-radius: 1.5px;
      }
    `;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // 添加鍵盤事件監聽器 - 採用漢堡選單模式
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className={`fixed inset-0 bg-custom-gray/95 dark:bg-custom-white-dark z-50 flex flex-col ${className}`} style={{
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      {/* 頂部工具欄 - 固定高度 */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-custom-white dark:bg-custom-white-dark shadow-md border-b border-custom-light-purple dark:border-custom-light-purple-dark flex-shrink-0 h-16 sm:h-20">
        <div className="flex items-center space-x-2">
          <button
            onClick={onClose}
            className="p-2 hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark rounded-full transition-colors text-custom-black dark:text-custom-black-dark"
            title={t("common.close")}
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-sm md:text-lg font-semibold text-custom-black dark:text-custom-black-dark">{t("title")}</h2>
        </div>

        <div className="flex items-center space-x-2">
          {/* 撤銷/重做 - 手機版和電腦版都顯示 */}
            <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('撤銷按鈕被點擊', {
                currentIndex: historyManager.currentIndex,
                actionsLength: historyManager.actions.length,
                isPremium,
                isMobile,
                canUndo: historyManager.currentIndex > 0 && isPremium && historyManager.actions.length > 1,
                eventType: e.type,
                target: e.target,
                buttonDisabled: !isPremium || historyManager.actions.length <= 1 || (historyManager.currentIndex <= 0 && historyManager.actions.length <= 1)
              });
              handleUndo();
            }}
            onTouchStart={(e) => {
              console.log('撤銷按鈕觸摸開始', { isMobile, eventType: e.type });
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const buttonDisabled = !isPremium || historyManager.actions.length <= 1 || (historyManager.currentIndex <= 0 && historyManager.actions.length <= 1);
              console.log('撤銷按鈕觸摸結束', { 
                isMobile, 
                eventType: e.type,
                currentIndex: historyManager.currentIndex,
                actionsLength: historyManager.actions.length,
                isPremium,
                buttonDisabled
              });
              // 手動觸發點擊事件
              if (!buttonDisabled) {
                console.log('調用 handleUndo');
                handleUndo();
              } else {
                console.log('撤銷按鈕被禁用');
              }
            }}
            disabled={!isPremium || historyManager.actions.length <= 1 || (historyManager.currentIndex <= 0 && historyManager.actions.length <= 1)}
            className={`p-2 rounded-full transition-colors ${
              !isPremium 
                ? 'opacity-50 cursor-not-allowed text-red-500 dark:text-red-400' 
                : 'hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark text-custom-black dark:text-custom-black-dark'
            }`}
            title={!isPremium ? t("premium.upgrade_required") : t("common.undo")}
          >
            <Undo className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('重做按鈕被點擊', {
                currentIndex: historyManager.currentIndex,
                actionsLength: historyManager.actions.length,
                isPremium,
                isMobile,
                canRedo: historyManager.currentIndex < historyManager.actions.length - 1 && isPremium,
                eventType: e.type,
                target: e.target,
                buttonDisabled: !isPremium || historyManager.actions.length <= 1 || historyManager.currentIndex >= historyManager.actions.length - 1
              });
              handleRedo();
            }}
            onTouchStart={(e) => {
              console.log('重做按鈕觸摸開始', { isMobile, eventType: e.type });
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('重做按鈕觸摸結束', { isMobile, eventType: e.type });
              // 手動觸發點擊事件
              handleRedo();
            }}
            disabled={!isPremium || historyManager.actions.length <= 1 || historyManager.currentIndex >= historyManager.actions.length - 1}
            className={`p-2 rounded-full transition-colors ${
              !isPremium 
                ? 'opacity-50 cursor-not-allowed text-red-500 dark:text-red-400' 
                : 'hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark text-custom-black dark:text-custom-black-dark'
            }`}
            title={!isPremium ? t("premium.upgrade_required") : t("common.redo")}
          >
            <Redo className="w-5 h-5" />
</button>

          {/* 縮放控制 - 只在桌面版顯示 */}
          {!isMobile && (
            <div className={`flex items-center space-x-1 border rounded-lg p-1 ${
              !isPremium 
                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' 
                : 'border-custom-light-purple dark:border-custom-light-purple-dark bg-custom-white dark:bg-custom-white-dark'
            }`}>
              <button
                onClick={handleZoomOut}
                disabled={!isPremium}
                className={`p-1 rounded ${
                  !isPremium 
                    ? 'opacity-50 cursor-not-allowed text-red-500 dark:text-red-400' 
                    : 'hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark text-custom-black dark:text-custom-black-dark'
                }`}
                title={!isPremium ? t("premium.upgrade_required") : t("zoom.zoom_out")}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className={`text-sm min-w-[3rem] text-center ${
                !isPremium ? 'text-red-500 dark:text-red-400' : 'text-custom-black dark:text-custom-black-dark'
              }`}>
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={!isPremium}
                className={`p-1 rounded ${
                  !isPremium 
                    ? 'opacity-50 cursor-not-allowed text-red-500 dark:text-red-400' 
                    : 'hover:bg-custom-light-purple dark:hover:bg-custom-light-purple-dark text-custom-black dark:text-custom-black-dark'
                }`}
                title={!isPremium ? t("premium.upgrade_required") : t("zoom.zoom_in")}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 手機版縮放提示 */}
          {isMobile && (
            <div className={`flex items-center text-xs px-2 py-1 rounded ${
              !isPremium 
                ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400' 
                : 'bg-custom-light-purple/20 dark:bg-custom-light-purple-dark/20 text-custom-black/60 dark:text-custom-black-dark/60'
            }`}>
              {t("zoom.mobile_gesture")}
            </div>
          )}

          {/* 保存按鈕 */}
          <button
            onClick={handleSave}
            disabled={!isPremium}
            className={`text-xs md:text-lg px-4 py-2 rounded-lg transition-colors ${
              !isPremium 
                ? 'bg-red-500 hover:bg-red-600 text-white cursor-not-allowed opacity-60' 
                : 'bg-custom-logo-purple dark:bg-cus tom-logo-purple-dark text-custom-white dark:text-custom-white hover:opacity-90'
            }`}
            title={!isPremium ? t("premium.upgrade_required") : t("common.save")}
          >
            <Save className="w-4 h-4 mr-2 inline" />
            {!isPremium ? t("premium.upgrade") : t("common.save")}
          </button>
        </div>
      </div>

      {/* 主要編輯區域 */}
      <div className="flex-1 flex">
        {/* 工具側欄 - 桌面版 */}
        {!isMobile && (
          <div className="w-64 bg-custom-light-purple dark:bg-custom-light-purple-dark border-r border-custom-light-purple dark:border-custom-light-purple-dark p-4 overflow-y-auto">
            <h3 className="font-semibold mb-4 text-custom-black dark:text-custom-black-dark">{t("ui.edit_tools")}</h3>
            <div className="space-y-2">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    if (!isPremium) {
                      // 免費用戶點擊工具時顯示升級提示
                      if (onUpgrade) {
                        onUpgrade();
                      }
                      return;
                    }
                    handleToolSelect(tool.id);
                  }}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors text-left ${
                    currentTool === tool.id
                      ? 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark border-2 border-custom-logo-purple dark:border-custom-logo-purple-dark text-custom-white dark:text-custom-white'
                      : !isPremium
                      ? 'hover:bg-red-50 dark:hover:bg-red-900/20 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 opacity-60 cursor-not-allowed'
                      : 'hover:bg-custom-white dark:hover:bg-custom-white-dark border-2 border-transparent text-custom-black dark:text-custom-black-dark'
                  }`}
                  title={!isPremium ? t("premium.upgrade_required") : tool.description}
                >
                  {tool.icon}
                  <div>
                    <div className="font-medium">{tool.name}</div>
                    <div className="text-sm opacity-75">
                      {!isPremium ? t("premium.upgrade") : tool.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Canvas 區域 - 根據固定工具欄計算可用空間 */}
        <div className="flex-1 flex items-center justify-center bg-custom-gray dark:bg-custom-gray-dark relative overflow-hidden p-1 sm:p-2 md:p-3" style={{
          height: isMobile 
            ? showToolsPanel 
              ? 'calc(100vh - 4rem - 3rem - 5rem)' // 頂部工具欄(4rem) + 底部控制區域(3rem) + 工具面板(5rem)
              : 'calc(100vh - 4rem - 3rem)' // 頂部工具欄(4rem) + 底部控制區域(3rem)
            : 'calc(100vh - 5rem)', // 桌面版：頂部工具欄(5rem)
          minHeight: isMobile 
            ? showToolsPanel 
              ? 'calc(100vh - 4rem - 3rem - 5rem)'
              : 'calc(100vh - 4rem - 3rem)'
            : 'calc(100vh - 5rem)'
        }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-custom-gray dark:bg-custom-gray-dark bg-opacity-75 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 md:h-10 md:w-10 border-b-2 border-custom-logo-purple dark:border-custom-logo-purple-dark mx-auto mb-1 sm:mb-2 md:mb-3"></div>
                <p className="text-xs sm:text-sm text-custom-black dark:text-custom-black-dark">{t("common.loading_image")}</p>
              </div>
            </div>
          )}

          {/* 手機版縮放支持：添加滾動容器 */}
          <div 
            className={`w-full h-full flex items-center justify-center ${
              isMobile ? 'overflow-auto' : (zoom > 1 ? 'overflow-auto' : 'overflow-hidden')
            }`}
            style={{
              // 手機版使用原生觸控縮放，桌面版禁用觸控
              touchAction: isMobile ? 'pan-x pan-y pinch-zoom' : 'none'
            }}
          >
            <div 
              className="relative flex items-center justify-center w-full h-full min-w-0 min-h-0"
              style={{ 
                // 手機版不使用程式化縮放，桌面版使用
                transform: isMobile ? 'none' : `scale(${zoom})`,
                transformOrigin: 'center center',
                // 手機版讓內容自適應，桌面版縮放時確保最小尺寸
                minWidth: !isMobile && zoom > 1 ? `${canvasSize.width * zoom}px` : 'auto',
                minHeight: !isMobile && zoom > 1 ? `${canvasSize.height * zoom}px` : 'auto'
              }}
            >
            {/* Canvas 容器 - 優化版本 */}

            <div className="canvas-container" style={{ 
              position: 'relative', 
              width: canvasSize.width, 
              height: canvasSize.height, 
              margin: 'auto', 
              boxShadow: '0 2px 16px #0002', 
              background: 'transparent'
            }}>
              
              {/* 免費用戶鎖定效果 */}
              {!isPremium && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] z-50 rounded-lg">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
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
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {t("premium.upgrade_to_use")}
                    </h3>
                    <p className="text-white/80 text-sm mb-4 max-w-xs">
                      {t("premium.upgrade_description")}
                    </p>
                    {onUpgrade && (
                      <button
                        onClick={onUpgrade}
                        className="px-6 py-2 bg-custom-logo-purple hover:bg-custom-logo-purple-dark text-white rounded-lg font-semibold transition-colors"
                      >
                        {t("premium.upgrade_now")}
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* 載入狀態顯示 */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-50 rounded-lg">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t("common.loading_image")}</p>
                  </div>
                </div>
              )}
              
              {/* 錯誤狀態顯示 */}
              {loadError && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm z-50 rounded-lg">
                  <div className="flex flex-col items-center space-y-4 p-6 text-center max-w-md">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t("common.image_load_failed")}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{loadError}</p>
                      <button
                        onClick={() => {
                          setLoadError('');
                          loadImageToCanvas(imageUrl);
                        }}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-200"
                      >
                        {t("common.reload")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: canvasSize.width,
                  height: canvasSize.height,
                  zIndex: 1,
                  pointerEvents: currentTool === 'add-text' ? 'none' : 'auto',
                  touchAction: isMobile ? 'pan-x pan-y pinch-zoom' : 'none',
                  userSelect: 'none'
                }}
              />
                
                {/* 筆刷預覽 Canvas */}
                <canvas
                  ref={brushPreviewRef}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: canvasSize.width,
                    height: canvasSize.height,
                    zIndex: 10,
                    pointerEvents: 'none',
                    background: 'transparent',
                    touchAction: isMobile ? 'pan-x pan-y pinch-zoom' : 'none',
                    userSelect: 'none'
                  }}
                />
                
                {/* Fabric.js Canvas - 用於文字預覽 */}
                <canvas
                  ref={fabricCanvasElementRef}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  style={{ 
                    position: 'absolute', 
                    left: 0, 
                    top: 0, 
                    width: `${canvasSize.width}px`, 
                    height: `${canvasSize.height}px`, 
                    pointerEvents: 'auto',
                    background: 'transparent',
                    zIndex: 15,
                    touchAction: isMobile ? 'pan-x pan-y pinch-zoom' : 'none',
                    userSelect: 'none',
                    border: 'none',
                    boxSizing: 'border-box', // 確保尺寸計算正確
                    display: 'block' // 避免 inline 元素的間距問題
                  }}
                />
                
                {/* Canvas 事件處理層 - 只在橡皮擦工具或背景移除修復模式啟動時顯示 */}
                {(() => {
                  const shouldShowEventLayer = (currentTool === 'area-eraser' && eraserEventHandlers) || (currentTool === 'background-remove' && backgroundRemoverEventHandlers);
                  console.log('事件處理層條件檢查:', {
                    currentTool,
                    hasEraserEventHandlers: !!eraserEventHandlers,
                    hasBackgroundRemoverEventHandlers: !!backgroundRemoverEventHandlers,
                    shouldShowEventLayer
                  });
                  return shouldShowEventLayer;
                })() && (
                  <div
                    style={{
                      position: 'fixed',
                      top: isMobile ? '5rem' : '0', // 手機版避開頂部工具欄
                      left: 0,
                      width: '100vw',
                      height: isMobile ? 'calc(100vh - 5rem - 3rem)' : '100vh', // 手機版避開頂部和底部工具欄
                      zIndex: 30,
                      pointerEvents: 'auto'
                    }}
                    onMouseDown={currentTool === 'area-eraser' ? eraserEventHandlers?.onMouseDown : backgroundRemoverEventHandlers?.onMouseDown}
                    onMouseMove={currentTool === 'area-eraser' ? eraserEventHandlers?.onMouseMove : backgroundRemoverEventHandlers?.onMouseMove}
                    onMouseUp={currentTool === 'area-eraser' ? eraserEventHandlers?.onMouseUp : backgroundRemoverEventHandlers?.onMouseUp}
                    onMouseLeave={currentTool === 'area-eraser' ? eraserEventHandlers?.onMouseLeave : backgroundRemoverEventHandlers?.onMouseLeave}
                    onTouchStart={(e) => {
                      console.log('事件處理層: onTouchStart 被調用', { 
                        currentTool, 
                        hasEraserHandlers: !!eraserEventHandlers?.onTouchStart,
                        isMobile,
                        eraserEventHandlers: eraserEventHandlers,
                        backgroundRemoverEventHandlers: backgroundRemoverEventHandlers
                      });
                      if (currentTool === 'area-eraser' && eraserEventHandlers?.onTouchStart) {
                        console.log('事件處理層: 調用橡皮擦 onTouchStart');
                        eraserEventHandlers.onTouchStart(e);
                      } else if (backgroundRemoverEventHandlers?.onTouchStart) {
                        console.log('事件處理層: 調用背景移除 onTouchStart');
                        backgroundRemoverEventHandlers.onTouchStart(e);
                      } else {
                        console.log('事件處理層: 沒有找到對應的 onTouchStart 處理函數');
                      }
                    }}                 
                    onTouchMove={(e) => {
                      console.log('事件處理層: onTouchMove 被調用', { 
                        currentTool, 
                        hasEraserHandlers: !!eraserEventHandlers?.onTouchMove,
                        isMobile 
                      });
                      if (currentTool === 'area-eraser' && eraserEventHandlers?.onTouchMove) {
                        console.log('事件處理層: 調用橡皮擦 onTouchMove');
                        eraserEventHandlers.onTouchMove(e);
                      } else if (backgroundRemoverEventHandlers?.onTouchMove) {
                        console.log('事件處理層: 調用背景移除 onTouchMove');
                        backgroundRemoverEventHandlers.onTouchMove(e);
                      } else {
                        console.log('事件處理層: 沒有找到對應的 onTouchMove 處理函數');
                      }
                    }}
                    onTouchEnd={(e) => {
                      console.log('事件處理層: onTouchEnd 被調用', { 
                        currentTool, 
                        hasEraserHandlers: !!eraserEventHandlers?.onTouchEnd,
                        isMobile 
                      });
                      if (currentTool === 'area-eraser' && eraserEventHandlers?.onTouchEnd) {
                        console.log('事件處理層: 調用橡皮擦 onTouchEnd');
                        eraserEventHandlers.onTouchEnd(e);
                      } else if (backgroundRemoverEventHandlers?.onTouchEnd) {
                        console.log('事件處理層: 調用背景移除 onTouchEnd');
                        backgroundRemoverEventHandlers.onTouchEnd(e);
                      } else {
                        console.log('事件處理層: 沒有找到對應的 onTouchEnd 處理函數');
                      }
                    }}
                    onWheel={currentTool === 'area-eraser' ? eraserEventHandlers?.onWheel : backgroundRemoverEventHandlers?.onWheel}
                  >
                    {/* 桌面版筆刷控制 - 放在事件處理層內部 */}
                    {!isMobile && (
                      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 shadow-lg z- border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center space-x-3">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {currentTool === 'background-remove' ? t("ui.repair_brush") : t("ui.brush")}: {brushSize}px
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="50"
                            value={brushSize}
                            onChange={(e) => setBrushSize(Number(e.target.value))}
                            className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            title={t("ui.brush_size")}
                          />
                          {currentTool === 'area-eraser' && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  console.log('電腦版退出按鈕被點擊');
                                  
                                  // 直接清除主 Canvas
                                  if (canvasRef.current && originalImageUrl) {
                                    const ctx = canvasRef.current.getContext('2d');
                                    if (ctx) {
                                      console.log('電腦版退出：直接清除主 Canvas');
                                      const img = new Image();
                                      img.crossOrigin = 'anonymous';
                                      img.onload = () => {
                                        ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
                                        ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
                                        console.log('電腦版退出：主 Canvas 已恢復原始圖片');
                                      };
                                      img.onerror = (error) => {
                                        console.error('電腦版退出：載入原始圖片失敗', error);
                                      };
                                      img.src = originalImageUrl;
                                    }
                                  }
                                  
                                  setCurrentTool('select');
                                }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title={t("ui.exit_erase_mode")}
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (eraserClearFunction) {
                                    try {
                                      await eraserClearFunction();
                                    } catch (error) {
                                      console.error('清除失敗:', error);
                                    }
                                  }
                                }}
                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title={t("ui.clear_and_send_path")}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {currentTool === 'background-remove' && (
                            <>
                              <button
                                onClick={handleBackgroundRemoverResetRepair}
                                className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                title={t("ui.reset_repair")}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleBackgroundRemoverExitRepair}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title={t("ui.exit_repair_mode")}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 文字編輯浮動窗口 - 只在文字工具啟動時顯示 */}
                {currentTool === 'add-text' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      zIndex: 20,
                      pointerEvents: 'none' // 讓滑鼠事件穿透到下面的 Canvas
                    }}
                  >
                    {/* 文字編輯浮動窗口會在這裡顯示 */}
                  </div>
                )}
                
                {/* Canvas 指示器 - 由各工具組件自行管理 */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部工具欄 - 移動版 */}
      {isMobile && (
        <div className="bg-custom-white dark:bg-custom-white-dark border-t border-custom-light-purple dark:border-custom-light-purple-dark flex-shrink-0">
          {/* 固定控制區域 */}
          <div className="p-2 sm:p-3 md:p-4 border-b border-custom-light-purple/30 dark:border-custom-light-purple-dark/30 h-12 sm:h-14 md:h-16">
            {/* 一般模式下的控制 */}
              <div className="flex items-center justify-between space-x-2">
              <button
                onClick={() => {
                  if (!isPremium) {
                    if (onUpgrade) {
                      onUpgrade();
                    }
                    return;
                  }
                  setShowToolsPanel(!showToolsPanel);
                }}
                className={`flex items-center space-x-1 sm:space-x-2 px-2 py-2 sm:px-3 md:px-4 rounded-lg transition-colors text-xs sm:text-sm md:text-base ${
                  !isPremium
                    ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                    : 'bg-custom-light-purple dark:bg-custom-light-purple-dark text-custom-black dark:text-custom-black-dark hover:opacity-80'
                }`}
                title={!isPremium ? t("premium.upgrade_required") : t("ui.tools")}
              >
                <Layers className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">{!isPremium ? t("premium.upgrade") : t("ui.tools")}</span>
                <span className="xs:hidden">{!isPremium ? t("premium.upgrade") : t("ui.tools")}</span>
              </button>
              <button
                onClick={() => {
                  if (!isPremium) {
                    if (onUpgrade) {
                      onUpgrade();
                    }
                    return;
                  }
                  handleQuickBackup();
                }}
                disabled={!isPremium}
                className={`flex items-center space-x-1 sm:space-x-2 px-2 py-2 sm:px-3 md:px-4 rounded-lg transition-colors text-xs sm:text-sm md:text-base ${
                  !isPremium
                    ? 'bg-red-500 hover:bg-red-600 text-white cursor-not-allowed opacity-60'
                    : 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white hover:opacity-90'
                }`}
                title={!isPremium ? t("premium.upgrade_required") : t("ui.quick_backup")}
              >
                <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">{!isPremium ? t("premium.upgrade") : t("ui.quick_backup")}</span>
                <span className="xs:hidden">{!isPremium ? t("premium.upgrade") : t("ui.backup")}</span>
              </button>
            </div>
          </div>

          {/* 工具控制面板 - 由各工具組件自行管理 */}

          {/* 可滾動工具面板 - 移動版 */}
          {showToolsPanel && (
            <div className="relative">
              {/* 滾動指示器 - 頂部 */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-b from-custom-light-purple/20 dark:from-custom-light-purple-dark/20 to-transparent pointer-events-none z-10 scroll-indicator ${showTopIndicator ? 'visible' : ''}`}></div>
              
              {/* 滾動指示器 - 底部 */}
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-t from-custom-light-purple/20 dark:from-custom-light-purple-dark/20 to-transparent pointer-events-none z-10 scroll-indicator ${showBottomIndicator ? 'visible' : ''}`}></div>
              
              <div 
                className="max-h-20 xs:max-h-24 sm:max-h-28 md:max-h-32 overflow-y-auto image-editor-scrollbar overscroll-contain scroll-smooth touch-pan-y"
                onScroll={handleScroll}
              >
                <div className="p-2 sm:p-3 md:p-4 space-y-1.5 sm:space-y-2 md:space-y-3">
                  {tools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => handleToolSelect(tool.id)}
                      className={`w-full flex items-center space-x-1.5 sm:space-x-2 md:space-x-3 p-1.5 sm:p-2 md:p-3 rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        currentTool === tool.id
                          ? 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark border-2 border-custom-logo-purple dark:border-custom-logo-purple-dark text-custom-white dark:text-custom-white shadow-md'
                          : !isPremium
                          ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 opacity-60 cursor-not-allowed'
                          : 'bg-custom-light-purple dark:bg-custom-light-purple-dark border-2 border-transparent hover:bg-custom-white dark:hover:bg-custom-white-dark text-custom-black dark:text-custom-black-dark hover:border-custom-logo-purple/50 dark:hover:border-custom-logo-purple-dark/50'
                      }`}
                      title={!isPremium ? t("premium.upgrade_required") : tool.description}
                    >
                      <div className="flex-shrink-0">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 flex items-center justify-center">
                          {tool.icon}
                        </div>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-xs sm:text-sm font-medium truncate">{tool.name}</div>
                        <div className="text-xs opacity-75 mt-0.5 sm:mt-1 line-clamp-1">
                          {!isPremium ? t("premium.upgrade") : tool.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 工具面板 - 優化版本 */}
      <ToolPanel
        currentTool={currentTool}
        isActive={currentTool !== 'select' && currentTool !== ''}
        imageData={{
          width: originalImageSize.width || 600,
          height: originalImageSize.height || 600,
          url: imageUrl
        }}
        canvas={canvasRef.current}
        brushPreviewCanvas={brushPreviewRef.current}
        isMobile={isMobile}
        canvasSize={canvasSize}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        onToolComplete={handleToolComplete}
        onClose={useCallback(() => { 
          setIsClosingTextEditor(true); // 設置標記
          console.log('ImageEditor: 關閉文字編輯器，清除 Canvas 文字物件');
          
          // 清除 Canvas 上的文字物件
          if (fabricCanvasRef.current) {
            const canvas = fabricCanvasRef.current;
            // 修復：正確獲取所有文字物件類型（包括 i-text）
            const existingTexts = canvas.getObjects().filter((obj: fabric.Object) => obj.type === 'text' || obj.type === 'i-text');
            
            console.log('ImageEditor: 找到的文字物件:', existingTexts.map(obj => ({ type: obj.type, text: (obj as fabric.Text).text })));
            
            // 移除所有文字物件
            existingTexts.forEach((obj: fabric.Object) => {
              canvas.remove(obj);
              obj.dispose();
            });
            
            canvas.renderAll();
            console.log('ImageEditor: 已清除', existingTexts.length, '個文字物件');
          }
          
          // 清除文字預覽數據（立即清除兩個狀態）
          setTextPreviewData(null);
          setDebouncedTextPreviewData(null);
          setIsClosingTextEditor(false); // 重置標記
          
          // 切換回選擇工具
          setCurrentTool('select'); 
        }, [])}
        onTextPreviewUpdate={handleTextPreviewUpdate}
        onTextPositionUpdate={handleTextPositionUpdate}
        onTextContentUpdate={handleTextContentUpdate}
        // 修復：傳遞最新的位置和內容給 ToolPanel
        currentTextPosition={debouncedTextPosition || (textPreviewData ? { x: textPreviewData.x, y: textPreviewData.y } : undefined)}
        currentTextContent={textPreviewData?.text}
                    onEraserEventHandlersReady={handleEraserEventHandlersReady}
            onEraserClearFunctionReady={handleEraserClearFunctionReady}
            onBackgroundRemoverEventHandlersReady={handleBackgroundRemoverEventHandlersReady}
            onBackgroundRemoverClearFunctionReady={handleBackgroundRemoverClearFunctionReady}
            onBackgroundRemoverResetFunctionReady={handleBackgroundRemoverResetFunctionReady}
                    onBackgroundRemoverResetRepair={handleBackgroundRemoverResetRepair}
        onBackgroundRemoverExitRepair={handleBackgroundRemoverExitRepair}
        onBackgroundRemoverClose={handleBackgroundRemoverClose}
        originalImageUrl={originalImageUrl} // 傳遞真正的原始圖片 URL
      />
    </div>
  );
};

export default ImageEditor; 