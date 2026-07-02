import React, { useState, useEffect, useRef, useReducer, useCallback } from 'react';
import { 
  Type, 
  Bold, 
  Italic, 
  Underline,
  X, 
  Palette, 
  Move, 
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
  Check
} from 'lucide-react';

// 導入正確的 TextData 類型
import { TextData } from './index';

// 導入正確的 API 函數
import { addTextToImage } from '@/app/services/textEditorApi';
import { showToast } from "@/app/components/CustomToast";
import { useTranslations } from "next-intl";

// 狀態機類型定義
type TextEditMode = 'idle' | 'input' | 'canvas' | 'external' | 'canvas_edit';

interface TextEditState {
  text: string;
  mode: TextEditMode;
  lastUpdate: number;
  source: 'input' | 'canvas' | 'external' | 'canvas_edit' | null;
  isUpdating: boolean;
  isEditing: boolean;
  canvasEditTimeout?: NodeJS.Timeout; // 新增：Canvas 編輯超時
}

type TextEditAction = 
  | { type: 'INPUT_CHANGE'; payload: string }
  | { type: 'CANVAS_EDIT'; payload: string }
  | { type: 'EXTERNAL_UPDATE'; payload: string }
  | { type: 'SET_UPDATING'; payload: boolean }
  | { type: 'SET_EDITING'; payload: boolean }
  | { type: 'CANVAS_EDIT_START'; payload: string }
  | { type: 'CANVAS_EDIT_END'; payload: string }
  | { type: 'RESET' };

// 初始狀態
const initialState: TextEditState = {
  text: '',
  mode: 'idle',
  lastUpdate: 0,
  source: null,
  isUpdating: false,
  isEditing: false
};

// 狀態機 reducer
const textEditReducer = (state: TextEditState, action: TextEditAction): TextEditState => {
  const now = Date.now();
  
  switch (action.type) {
    case 'INPUT_CHANGE':
      return {
        ...state,
        text: action.payload,
        mode: 'input',
        lastUpdate: now,
        source: 'input',
        isUpdating: false,
        isEditing: false
      };
      
    case 'CANVAS_EDIT_START':
      return {
        ...state,
        text: action.payload,
        mode: 'canvas_edit',
        lastUpdate: now,
        source: 'canvas_edit',
        isEditing: true,
        isUpdating: false
      };
      
    case 'CANVAS_EDIT_END':
      return {
        ...state,
        text: action.payload,
        mode: 'canvas',
        lastUpdate: now,
        source: 'canvas_edit',
        isEditing: false,
        isUpdating: false
      };
      
    case 'CANVAS_EDIT':
      return {
        ...state,
        text: action.payload,
        mode: 'canvas',
        lastUpdate: now,
        source: 'canvas',
        isEditing: false,
        isUpdating: false
      };
      
    case 'EXTERNAL_UPDATE':
      // 智能同步：允許在特定條件下接受外部更新
      if (state.mode === 'idle' || 
          state.mode === 'external' || 
          state.mode === 'canvas' ||
          (state.mode === 'input' && now - state.lastUpdate > 2000)) { // 2秒後允許外部更新
        return {
          ...state,
          text: action.payload,
          mode: 'external',
          lastUpdate: now,
          source: 'external',
          isUpdating: false
        };
      }
      return state;
      
    case 'SET_UPDATING':
      return {
        ...state,
        isUpdating: action.payload
      };
      
    case 'SET_EDITING':
      return {
        ...state,
        isEditing: action.payload
      };
      
    case 'RESET':
      return initialState;
      
    default:
      return state;
  }
};

interface TextEditorProps {
  isActive: boolean;
  onTextAdd: (textData: TextData) => void;
  onClose: () => void;
  imageId: string; // 新增：圖片 ID
  imageUrl: string; // 新增：圖片 URL 用於預覽
  onPreviewUpdate: (textData: TextData) => void; // 新增：即時預覽更新回調
  currentPosition?: { x: number; y: number }; // 新增：接收當前位置更新
  currentTextContent?: string; // 新增：接收當前文字內容更新
  onTextPositionUpdate?: (position: { x: number; y: number }) => void; // 新增：位置更新回調
  onTextContentUpdate?: (text: string) => void; // 新增：內容更新回調
  onTextPositionChange?: (position: { x: number; y: number }) => void; // 新增：主要位置變化回調
  onTextContentChange?: (content: string) => void; // 新增：主要內容變化回調
  onTextStyleChange?: (style: Partial<TextData>) => void; // 新增：樣式變化回調
  isMobile?: boolean; // 新增：手機版標識
}

const TextEditor: React.FC<TextEditorProps> = ({ 
  isActive, 
  onTextAdd, 
  onClose,
  imageId,
  onPreviewUpdate,
  currentPosition,
  currentTextContent,
  onTextPositionUpdate,
  onTextContentUpdate,
  onTextPositionChange,
  onTextContentChange,
  onTextStyleChange,
  isMobile = false
}) => {
  const t = useTranslations("imageEditor");
  // 使用狀態機替代複雜的 useState
  const [state, dispatch] = useReducer(textEditReducer, initialState);
  
  // 簡化的狀態派生
  const { text, mode, isUpdating, isEditing } = state;
  
  // 其他必要的狀態
  const [fontSize, setFontSize] = useState(32);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [color, setColor] = useState('#000000');
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // 手機版相關狀態
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'style' | 'position'>('text');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mobilePreviewCount, setMobilePreviewCount] = useState(0); // 手機版預覽更新計數器
  
  // 拖拽相關狀態
  const [isDragging, setIsDragging] = useState(false);
  const [windowPosition, setWindowPosition] = useState({ x: 0, y: 0 });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Refs
  const windowRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const prevTextDataRef = useRef<TextData | null>(null);
  // 移除 canvasRef 和 fabricCanvasRef
  // const canvasRef = useRef<HTMLCanvasElement>(null);
  // const fabricCanvasRef = useRef<fabric.Canvas | null>(null);

  // 位置變化時通知父組件
  useEffect(() => {
    if (onTextPositionUpdate) {
      onTextPositionUpdate(position);
    }
    if (onTextPositionChange) {
      onTextPositionChange(position);
    }
  }, [position, onTextPositionUpdate, onTextPositionChange]);

  // 樣式變化時通知父組件
  useEffect(() => {
    if (onTextStyleChange) {
      const styleData: Partial<TextData> = {
        fontSize,
        fontFamily,
        color,
        bold,
        italic,
        underline,
        align
      };
      onTextStyleChange(styleData);
    }
  }, [fontSize, fontFamily, color, bold, italic, underline, align, onTextStyleChange]);

  // 手機版專用效果 - 優化RWD體驗
  useEffect(() => {
    if (isMobile) {
      // 手機版預設使用適中的視窗大小，提供更好的編輯體驗
      setIsFullscreen(true);
      // 手機版預設位置調整 - 居中顯示
      setWindowPosition({ x: 0, y: 0 });
      
      // 手機版自動聚焦到文字輸入框
      if (textInputRef.current) {
        setTimeout(() => {
          textInputRef.current?.focus();
        }, 100);
      }

      // 手機版：確保文字預覽立即顯示
      if (text.trim()) {
        const textData: TextData = {
          text: text,
          fontFamily,
          fontSize,
          color,
          bold,
          italic,
          underline,
          align,
          x: position.x,
          y: position.y
        };
        console.log('TextEditor: 手機版立即更新文字預覽:', textData);
        onPreviewUpdate(textData);
      }
    }
  }, [isMobile, text, fontFamily, fontSize, color, bold, italic, underline, align, position, onPreviewUpdate]);

  // 手機版視窗安全區域檢測
  useEffect(() => {
    if (isMobile && !isFullscreen) {
      // 檢測視窗是否與圖片重疊，如果重疊則調整位置
      const checkOverlap = () => {
        const windowElement = windowRef.current;
        if (!windowElement) return;
        
        const windowRect = windowElement.getBoundingClientRect();
        const imageEditor = document.querySelector('.canvas-container');
        
        if (imageEditor) {
          const imageRect = imageEditor.getBoundingClientRect();
          
          // 檢查是否重疊
          const isOverlapping = !(
            windowRect.right < imageRect.left ||
            windowRect.left > imageRect.right ||
            windowRect.bottom < imageRect.top ||
            windowRect.top > imageRect.bottom
          );
          
          if (isOverlapping) {
            // 優先嘗試放在圖片下方
            const belowImage = imageRect.bottom + 10;
            const canFitBelow = belowImage + windowRect.height <= window.innerHeight;
            
            if (canFitBelow) {
              setWindowPosition({
                x: Math.max(10, Math.min(imageRect.left, window.innerWidth - windowRect.width - 10)),
                y: belowImage
              });
            } else {
              // 如果下方放不下，放在右側
              const rightOfImage = imageRect.right + 10;
              const canFitRight = rightOfImage + windowRect.width <= window.innerWidth;
              
              if (canFitRight) {
                setWindowPosition({
                  x: rightOfImage,
                  y: Math.max(10, Math.min(imageRect.top, window.innerHeight - windowRect.height - 10))
                });
              } else {
                // 最後選擇：放在螢幕邊緣
                setWindowPosition({
                  x: Math.max(10, window.innerWidth - windowRect.width - 10),
                  y: Math.max(10, window.innerHeight - windowRect.height - 10)
                });
              }
            }
          }
        }
      };
      
      // 延遲檢查，確保 DOM 已渲染
      setTimeout(checkOverlap, 100);
    }
  }, [isMobile, isFullscreen]);

  // 手機版觸控事件處理 - 優化觸控體驗
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    // 防止觸控事件冒泡到圖片編輯器
    e.stopPropagation();
    
    const touch = e.touches[0];
    const rect = windowRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // 計算觸控拖拽偏移量
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;
    setDragOffset({ x: offsetX, y: offsetY });
    
    setIsDragging(true);
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isMobile || !isDragging) return;
    
    // 防止觸控事件冒泡到圖片編輯器
    e.preventDefault();
    e.stopPropagation();
    
    // 使用 requestAnimationFrame 來減少抖動
    requestAnimationFrame(() => {
      const touch = e.touches[0];
      if (!touch) return;
      
      const newX = touch.clientX - dragOffset.x;
      const newY = touch.clientY - dragOffset.y;
      
      // 優化：限制手機版視窗不超出螢幕邊界，考慮安全區域
      const safeArea = 20; // 安全邊距
      const windowWidth = windowRef.current?.offsetWidth || 350;
      const windowHeight = windowRef.current?.offsetHeight || 400;
      const maxX = window.innerWidth - windowWidth - safeArea;
      const maxY = window.innerHeight - windowHeight - safeArea;
      
      const clampedX = Math.max(safeArea, Math.min(newX, maxX));
      const clampedY = Math.max(safeArea, Math.min(newY, maxY));
      
      // 減少抖動：只有當位置改變超過最小閾值時才更新
      const threshold = 2; // 像素閾值
      setWindowPosition(prev => {
        const deltaX = Math.abs(prev.x - clampedX);
        const deltaY = Math.abs(prev.y - clampedY);
        
        if (deltaX < threshold && deltaY < threshold) {
          return prev; // 避免微小移動造成抖動
        }
        
        return { x: clampedX, y: clampedY };
      });
    });
  }, [isMobile, isDragging, dragOffset.x, dragOffset.y]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile) return;
    
    // 防止觸控事件冒泡到圖片編輯器
    setIsDragging(false);
    
    // 手機版觸控結束後，確保文字輸入框保持聚焦
    if (textInputRef.current && !textInputRef.current.contains(document.activeElement)) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 50);
    }

    // 手機版：觸控結束後立即更新文字預覽
    if (text.trim()) {
      const textData: TextData = {
        text: text,
        fontFamily,
        fontSize,
        color,
        bold,
        italic,
        underline,
        align,
        x: position.x,
        y: position.y
      };
      console.log('TextEditor: 手機版觸控結束後更新文字預覽:', textData);
      onPreviewUpdate(textData);
    }
  }, [isMobile, text, fontFamily, fontSize, color, bold, italic, underline, align, position.x, position.y, onPreviewUpdate]);

  // 手機版觸控事件監聽
  useEffect(() => {
    if (isMobile) {
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isMobile, isDragging, dragOffset, handleTouchMove, handleTouchEnd]);

  // 預設字體選項
  const fontOptions = [
    { value: 'Arial', label: 'Arial' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Verdana', label: 'Verdana' },
    { value: 'Courier New', label: 'Courier New' },
    { value: 'Impact', label: 'Impact' },
    { value: 'Comic Sans MS', label: 'Comic Sans MS' }
  ];

  // 預設顏色選項
  const colorOptions = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#FFC0CB', '#A52A2A', '#808080', '#008000', '#000080'
  ];

  // 字體大小選項
  const fontSizeOptions = [12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72];

  // 移除 Fabric.js Canvas 初始化，因為文字預覽由主編輯器處理
  // useEffect(() => {
  //   console.log('TextEditor: 初始化 Fabric.js Canvas', { isActive, hasCanvasRef: !!canvasRef.current, imageUrl });
  //   
  //   if (isActive && canvasRef.current && imageUrl) {
  //     console.log('TextEditor: 開始創建 Fabric.js Canvas');
  //     
  //     // 創建 Fabric.js Canvas
  //     const canvas = new fabric.Canvas(canvasRef.current, {
  //       width: 400,
  //       height: 300,
  //       backgroundColor: '#f0f0f0'
  //     });
  //     
  //     fabricCanvasRef.current = canvas;
  //     console.log('TextEditor: Fabric.js Canvas 創建成功');

  //     // 載入背景圖片
  //     fabric.Image.fromURL(imageUrl, {
  //       crossOrigin: 'anonymous'
  //     }, (img: fabric.Image) => {
  //       console.log('TextEditor: 背景圖片載入成功');
  //       
  //       // 調整圖片大小以適應 Canvas
  //       const canvasWidth = canvas.getWidth() || 400;
  //       const canvasHeight = canvas.getHeight() || 300;
  //       
  //       const imgAspectRatio = img.width! / img.height!;
  //       const canvasAspectRatio = canvasWidth / canvasHeight;
  //       
  //       let newWidth, newHeight;
  //       if (imgAspectRatio > canvasAspectRatio) {
  //         newWidth = canvasWidth;
  //         newHeight = canvasWidth / imgAspectRatio;
  //       } else {
  //         newHeight = canvasHeight;
  //         newWidth = canvasHeight * imgAspectRatio;
  //       }
  //       
  //       img.scaleToWidth(newWidth);
  //       img.set({
  //         left: (canvasWidth - newWidth) / 2,
  //         top: (canvasHeight - newHeight) / 2,
  //         selectable: false,
  //         evented: false
  //       });
  //       
  //       canvas.backgroundImage = img;
  //       canvas.renderAll();
  //       
  //       console.log('TextEditor: 背景圖片設置完成');
  //       
  //       // 如果有文字內容，立即顯示預覽
  //       if (text.trim()) {
  //         console.log('TextEditor: 顯示初始文字預覽');
  //         const fabricText = new fabric.Text(text, {
  //           left: (position.x / 100) * canvasWidth,
  //           top: (position.y / 100) * canvasHeight,
  //           fontSize: fontSize,
  //           fontFamily: fontFamily,
  //           fill: color,
  //           fontWeight: bold ? 'bold' : 'normal',
  //           fontStyle: italic ? 'italic' : 'normal',
  //           textDecoration: underline ? 'underline' : 'none',
  //           textAlign: align,
  //           selectable: false,
  //           evented: false
  //         });
  //         
  //         canvas.add(fabricText);
  //         canvas.renderAll();
  //         console.log('TextEditor: 初始文字預覽完成');
  //       }
  //     });

  //     return () => {
  //       console.log('TextEditor: 清理 Fabric.js Canvas');
  //       canvas.dispose();
  //       fabricCanvasRef.current = null;
  //     };
  //   }
  // }, [isActive, imageUrl, text, fontSize, fontFamily, color, align, bold, italic, underline, position]);

  // 移除文字預覽更新邏輯，因為這由主編輯器處理
  // useEffect(() => {
  //   if (fabricCanvasRef.current && text.trim()) {
  //     const canvas = fabricCanvasRef.current;
  //     
  //     // 清除現有的文字物件
  //     const existingTexts = canvas.getObjects().filter((obj: fabric.Object) => obj.type === 'text');
  //     existingTexts.forEach((obj: fabric.Object) => canvas.remove(obj));
  //     
  //     // 創建新的文字物件
  //     const fabricText = new fabric.Text(text, {
  //       left: (position.x / 100) * (canvas.getWidth() || 400),
  //       top: (position.y / 100) * (canvas.getHeight() || 300),
  //       fontSize: fontSize,
  //       fontFamily: fontFamily,
  //       fill: color,
  //       fontWeight: bold ? 'bold' : 'normal',
  //       fontStyle: italic ? 'italic' : 'normal',
  //       textDecoration: underline ? 'underline' : 'none',
  //       textAlign: align,
  //       selectable: false,
  //       evented: false
  //     });
  //     
  //     canvas.add(fabricText);
  //     canvas.renderAll();
  //     
  //     // 調試信息
  //     console.log('文字預覽更新:', {
  //       text: text.trim(),
  //       position: { x: position.x, y: position.y },
  //       fontSize,
  //       fontFamily,
  //       color,
  //       align,
  //       bold,
  //       italic,
  //       underline
  //     });
  //   }
  // }, [text, fontSize, fontFamily, color, align, bold, italic, underline, position]);

  useEffect(() => {
    if (isActive && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [isActive]);

  // 直接更新文字預覽，移除防抖 - 優化版本
  useEffect(() => {
    if (!isUpdating) {
      const textData: TextData = {
        text: text,
        fontFamily,
        fontSize,
        color,
        bold,
        italic,
        underline,
        align,
        x: position.x,
        y: position.y
      };

      // 只在數據真正變化時才更新
      const hasChanged = !prevTextDataRef.current || 
        prevTextDataRef.current.text !== textData.text ||
        prevTextDataRef.current.x !== textData.x ||
        prevTextDataRef.current.y !== textData.y ||
        prevTextDataRef.current.fontSize !== textData.fontSize ||
        prevTextDataRef.current.fontFamily !== textData.fontFamily ||
        prevTextDataRef.current.color !== textData.color ||
        prevTextDataRef.current.align !== textData.align ||
        prevTextDataRef.current.bold !== textData.bold ||
        prevTextDataRef.current.italic !== textData.italic ||
        prevTextDataRef.current.underline !== textData.underline;
      
      if (hasChanged) {
        console.log('TextEditor: 更新文字預覽:', textData, '手機版:', isMobile);
        onPreviewUpdate(textData);
        prevTextDataRef.current = textData;
        
        // 手機版額外強化：確保預覽立即更新
        if (isMobile && text.trim()) {
          console.log('TextEditor: 手機版強制立即預覽更新');
          // 使用 requestAnimationFrame 確保在下一個渲染週期更新
          requestAnimationFrame(() => {
            onPreviewUpdate(textData);
            console.log('TextEditor: 手機版 RAF 更新完成');
          });
          
          // 額外保障：延遲再次更新
          setTimeout(() => {
            onPreviewUpdate(textData);
            console.log('TextEditor: 手機版延遲更新完成');
          }, 50);
        }
      }
    }
  }, [text, fontFamily, fontSize, color, bold, italic, underline, align, position, onPreviewUpdate, isUpdating, isMobile]);

  // 監聽外部位置更新（來自拖拽）
  useEffect(() => {
    if (currentPosition && (currentPosition.x !== position.x || currentPosition.y !== position.y)) {
      console.log('TextEditor: 接收到外部位置更新:', currentPosition);
      setPosition(currentPosition);
      }
  }, [currentPosition, position]);

  // 監聽外部文字內容更新（來自拖拽編輯）
  useEffect(() => {
    if (currentTextContent !== undefined && currentTextContent !== text) {
      console.log('TextEditor: 接收到外部文字內容更新:', currentTextContent, '當前模式:', mode);
      
      // 智能同步邏輯
      if (mode === 'canvas_edit' || mode === 'canvas') {
        // Canvas 編輯模式：直接接受更新
        // 原因：Canvas 編輯是直接操作，優先級最高
        dispatch({ type: 'CANVAS_EDIT_END', payload: currentTextContent });
        console.log('TextEditor: Canvas 編輯完成，同步文字內容');
      } else if (mode === 'idle' || mode === 'external') {
        // 空閒或外部模式：直接接受更新
        // 原因：沒有用戶活動，可以安全更新
        dispatch({ type: 'EXTERNAL_UPDATE', payload: currentTextContent });
        console.log('TextEditor: 外部更新，同步文字內容');
      } else if (mode === 'input') {
        // 輸入模式：檢查時間間隔
        // 原因：保護用戶輸入，避免被外部更新覆蓋
        const timeSinceLastInput = Date.now() - state.lastUpdate;
        if (timeSinceLastInput > 2000) { // 2秒後允許外部更新
          // 用戶已經停止輸入 2 秒，可以安全接受外部更新
          dispatch({ type: 'EXTERNAL_UPDATE', payload: currentTextContent });
          console.log('TextEditor: 輸入模式超時，允許外部更新');
        } else {
          // 用戶正在輸入，保護用戶輸入不被覆蓋
          console.log('TextEditor: 忽略外部更新，用戶正在輸入 (間隔:', timeSinceLastInput, 'ms)');
        }
      }
    }
  }, [currentTextContent, text, mode, state.lastUpdate]);

  // 新增：檢測 Canvas 編輯狀態變化
  useEffect(() => {
    // 如果檢測到 isEditing 狀態變化，可能是 Canvas 編輯開始
    if (isEditing && mode !== 'canvas_edit') {
      console.log('TextEditor: 檢測到 Canvas 編輯開始');
      dispatch({ type: 'CANVAS_EDIT_START', payload: text });
    }
  }, [isEditing, mode, text]);

  // 手機版專用：強化文字輸入即時預覽
  useEffect(() => {
    if (isMobile && text.trim() && isActive) {
      console.log('TextEditor: 手機版文字輸入即時預覽觸發:', text);
      
      const textData: TextData = {
        text: text,
        fontFamily,
        fontSize,
        color,
        bold,
        italic,
        underline,
        align,
        x: position.x,
        y: position.y
      };
      
      // 立即觸發預覽更新
      onPreviewUpdate(textData);
      
      // 使用多重保障確保手機版預覽顯示
      requestAnimationFrame(() => {
        onPreviewUpdate(textData);
      });
      
      setTimeout(() => {
        onPreviewUpdate(textData);
      }, 100);
    }
  }, [text, isMobile, isActive, fontFamily, fontSize, color, bold, italic, underline, align, position, onPreviewUpdate]);

  const handleAddText = async () => {
    if (!text.trim()) {
      setErrorMessage(t("text_editor.please_enter_text"));
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage('');

      // 修復：使用最新的位置資料，確保拖曳後的位置正確傳遞
      // 優先使用外部傳入的 currentPosition，否則使用本地 position
      const finalPosition = currentPosition || position;

      const textData: TextData = {
        text: text.trim(),
        x: finalPosition.x,
        y: finalPosition.y,
        fontSize,
        fontFamily,
        color,
        align,
        bold,
        italic,
        underline
      };

      // 驗證資料
      // if (!validateTextData(textData)) { // 移除 fabric.js 驗證
      //   throw new Error('文字資料格式錯誤');
      // }

      console.log('準備發送文字資料:', textData);

      // 呼叫 API
      const response = await addTextToImage(textData, imageId);

      if (response.success && response.data) {
        console.log('文字添加成功:', response.data);
        
        // 顯示成功提示
        showToast(t("toast.success.text_added"));
        
        // 呼叫父組件的回調函數
        onTextAdd(textData);
        
        // 重置表單
        handleReset();
        
        // 關閉編輯器
        onClose();
      } else {
        throw new Error(response.message || '文字添加失敗');
      }
    } catch (error) {
      console.error('文字添加失敗:', error);
      // const errorMsg = handleTextError(error); // 移除 fabric.js 錯誤處理
      setErrorMessage(t("toast.error.text_add_failed"));
      // 顯示錯誤提示
      showToast(t("toast.error.text_add_failed"), true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    dispatch({ type: 'RESET' }); // 使用 dispatch 重置狀態
    setFontSize(32);
    setFontFamily('Arial');
    setColor('#000000');
    setAlign('center');
    setBold(false);
    setItalic(false);
    setUnderline(false);
    setShowColorPicker(false);
    setPosition({ x: 50, y: 50 });
  };

  const handleCancel = () => {
    handleReset();
    onClose();
  };

  // 拖拽事件處理
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('button, input, textarea, select')) {
      return; // 不處理按鈕、輸入框等元素的拖拽
    }
    
    const rect = windowRef.current?.getBoundingClientRect();
    if (rect) {
      // 計算拖拽偏移量
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      setDragOffset({ x: offsetX, y: offsetY });
      
      setIsDragging(true);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    // 使用 requestAnimationFrame 來優化拖拽順暢度
    requestAnimationFrame(() => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // 快取邊界計算，避免重複計算
      const windowWidth = windowRef.current?.offsetWidth || 400;
      const windowHeight = windowRef.current?.offsetHeight || 300;
      const maxX = window.innerWidth - windowWidth;
      const maxY = window.innerHeight - windowHeight;
      
      const clampedX = Math.max(0, Math.min(newX, maxX));
      const clampedY = Math.max(0, Math.min(newY, maxY));
      
      // 只有當位置真正改變時才更新狀態
      setWindowPosition(prev => {
        if (prev.x === clampedX && prev.y === clampedY) {
          return prev; // 避免不必要的重新渲染
        }
        return { x: clampedX, y: clampedY };
      });
    });
  }, [isDragging, dragOffset.x, dragOffset.y]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 添加和移除全局滑鼠事件監聽器
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset, handleMouseMove, handleMouseUp]);

  // 鍵盤事件處理 - 防止方向鍵事件冒泡
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 阻止所有鍵盤事件冒泡到圖片編輯器
    e.stopPropagation();
    e.preventDefault();
    
    // 允許正常的文字編輯功能
    const target = e.target as HTMLElement;
    const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
    
    if (isInputElement) {
      // 在輸入元素內，允許正常的文字編輯功能
      return;
    }
    
    // 對於非輸入元素，阻止所有鍵盤事件
    e.preventDefault();
  };

  // 防止文字編輯器內的點擊事件冒泡
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // 防止文字編輯器內的所有事件冒泡
  const handleContainerEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  // 專門處理文字輸入框的鍵盤事件
  const handleTextareaKeyDown = (e: React.KeyboardEvent) => {
    // 阻止事件冒泡到圖片編輯器，但允許正常的文字編輯功能
    e.stopPropagation();
    
    // 允許所有正常的文字編輯功能，包括：
    // - 方向鍵：ArrowUp, ArrowDown, ArrowLeft, ArrowRight
    // - 導航鍵：Home, End, PageUp, PageDown
    // - 編輯鍵：Backspace, Delete, Enter, Tab
    // - 修飾鍵：Shift, Control, Alt, Meta
    // - 所有字母、數字、符號
    // 不阻止任何預設行為，讓瀏覽器處理正常的文字編輯

    // 手機版：每次按鍵後立即更新預覽
    if (isMobile) {
      setTimeout(() => {
        if (text.trim()) {
          const textData: TextData = {
            text: text,
            fontFamily,
            fontSize,
            color,
            bold,
            italic,
            underline,
            align,
            x: position.x,
            y: position.y
          };
          console.log('TextEditor: 手機版按鍵後更新文字預覽:', textData);
          onPreviewUpdate(textData);
        }
      }, 50);
    }
  };

  // 全局事件隔離 - 確保文字編輯器完全獨立
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 檢查事件是否來自文字編輯器
      const target = e.target as HTMLElement;
      const isFromTextEditor = target.closest('[data-text-editor]');
      
      if (isFromTextEditor) {
        // 檢查是否為輸入元素
        const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
        
        if (isInputElement) {
          // 在輸入元素內，只阻止事件冒泡，不阻止預設行為
          e.stopPropagation();
          return;
        }
        
        // 對於非輸入元素，阻止所有鍵盤事件
        e.stopPropagation();
        e.preventDefault();
      }
    };

    // 添加全局事件監聽器
    document.addEventListener('keydown', handleGlobalKeyDown, true); // 使用捕獲階段
    
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, []);


  if (!isActive) return null;

  return (
    <div 
      ref={windowRef}
      className={`fixed bg-custom-white/95 dark:bg-custom-white-dark/95 backdrop-blur-sm shadow-lg z-50 border border-custom-light-purple dark:border-custom-light-purple-dark transition-all duration-200 ${
        isDragging ? 'shadow-2xl scale-[1.02]' : 'shadow-lg'
      } ${
        isMobile 
          ? 'w-full h-auto max-h-[50vh] rounded-t-2xl border-t border-x-0 border-b-0 overflow-y-auto p-4' 
          : 'max-w-sm sm:max-w-md w-full mx-2 sm:mx-4 p-3 sm:p-4 rounded-lg'
      }`}
      style={{
        left: isMobile ? '0' : (windowPosition.x || '50%'),
        bottom: isMobile ? '0' : 'auto',
        top: isMobile ? 'auto' : (windowPosition.y || '1rem'),
        transform: (!windowPosition.x && !isMobile) ? 'translateX(-50%)' : 'none',
        cursor: isMobile ? 'default' : (isDragging ? 'grabbing' : 'grab')
      }}
      onMouseDown={!isMobile ? handleMouseDown : undefined}
      onTouchStart={!isMobile ? handleTouchStart : undefined}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleContainerEvent}
      onKeyPress={handleContainerEvent}
      onFocus={handleContainerEvent}
      onBlur={handleContainerEvent}
      data-text-editor // 添加 data 屬性以隔離事件
    >
                 {/* 標題欄 - 手機版簡潔設計 */}
       <div className={`flex items-center justify-between ${isMobile ? 'mb-2 pb-2 border-b border-custom-light-purple/20 dark:border-custom-light-purple-dark/20' : 'mb-3'}`}>
         {isMobile ? (
           <>
             {/* 手機版拖拽把手 */}
             <div className="w-12 h-1 bg-custom-light-purple dark:bg-custom-light-purple-dark rounded-full mx-auto"></div>
             <button
               onClick={handleCancel}
               className="absolute right-3 top-3 text-custom-light-purple dark:text-custom-light-purple-dark hover:text-custom-logo-purple dark:hover:text-custom-logo-purple-dark p-1 rounded-lg hover:bg-custom-light-purple/20 dark:hover:bg-custom-light-purple-dark/20 transition-colors"
               title={t("text_editor.close")}
             >
               <X className="w-4 h-4" />
             </button>
           </>
         ) : (
           <>
             <h3 className="text-sm font-semibold flex items-center text-custom-black dark:text-custom-black-dark">
               <Type className="w-4 h-4 mr-2" />
               {t("text_editor.title")}
               <span className="text-xs text-custom-light-purple dark:text-custom-light-purple-dark ml-2 font-normal">
                 {t("text_editor.draggable")}
               </span>
             </h3>
             <button
               onClick={handleCancel}
               className="text-custom-light-purple dark:text-custom-light-purple-dark hover:text-custom-logo-purple dark:hover:text-custom-logo-purple-dark p-2 rounded-lg hover:bg-custom-light-purple/20 dark:hover:bg-custom-light-purple-dark/20 transition-colors"
               title={t("text_editor.close_text_editor")}
             >
               <X className="w-4 h-4" />
             </button>
           </>
         )}
        </div>

                 {/* 手機版標籤頁導航 - 超簡潔設計 */}
         {isMobile && (
           <div className="flex space-x-1 mb-2">
             {[
               { id: 'text', label: t("text_editor.text"), icon: Type },
               { id: 'style', label: t("text_editor.style"), icon: Palette },
               { id: 'position', label: t("text_editor.position"), icon: Move }
             ].map(({ id, label, icon: Icon }) => (
               <button
                 key={id}
                 onClick={() => setActiveTab(id as 'text' | 'style' | 'position')}
                 className={`flex-1 flex items-center justify-center py-2 text-xs rounded-lg transition-all duration-200 ${
                   activeTab === id
                     ? 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white'
                     : 'text-custom-black dark:text-custom-black-dark hover:bg-custom-light-purple/30 dark:hover:bg-custom-light-purple-dark/30'
                 }`}
               >
                 <Icon className="w-4 h-4 mr-1" />
                 <span className="font-medium">{label}</span>
               </button>
             ))}
           </div>
         )}

                 {/* 文字輸入區 - 緊湊設計 */}
       <div className={`space-y-3 ${isMobile && activeTab !== 'text' ? 'hidden' : ''}`}>
           <div>
           <label className="block text-xs font-medium mb-1 text-custom-black dark:text-custom-black-dark">{t("text_editor.text")}</label>
             <textarea
               ref={textInputRef}
               value={text}
                         onChange={(e) => {
              console.log('TextEditor: 文字輸入變化:', e.target.value, '手機版:', isMobile);
              dispatch({ type: 'INPUT_CHANGE', payload: e.target.value }); // 使用 dispatch 更新狀態
              
              // 通知父組件文字內容變化
              if (onTextContentUpdate) {
                onTextContentUpdate(e.target.value);
              }
              if (onTextContentChange) {
                onTextContentChange(e.target.value);
              }
              
              // 手機版和桌面版：統一立即更新文字預覽
              const textData: TextData = {
                text: e.target.value,
                fontFamily,
                fontSize,
                color,
                bold,
                italic,
                underline,
                align,
                x: position.x,
                y: position.y
              };
              
              console.log('TextEditor: 文字輸入立即更新預覽:', textData, '手機版:', isMobile);
              
              // 立即更新 - 對所有版本都適用
              onPreviewUpdate(textData);
              
              // 手機版額外保障
              if (isMobile) {
                setMobilePreviewCount(prev => prev + 1);
                
                // RAF 保障
                requestAnimationFrame(() => {
                  onPreviewUpdate(textData);
                  setMobilePreviewCount(prev => prev + 1);
                  console.log('TextEditor: 手機版輸入 RAF 更新');
                });
                
                // 延遲保障
                setTimeout(() => {
                  onPreviewUpdate(textData);
                  setMobilePreviewCount(prev => prev + 1);
                  console.log('TextEditor: 手機版輸入延遲更新');
                }, 100);
              }
             }}
             onKeyDown={handleTextareaKeyDown}
               placeholder={t("text_editor.placeholder")}
             className={`w-full p-2 text-sm border border-custom-light-purple dark:border-custom-light-purple-dark rounded-lg resize-none focus:ring-2 focus:ring-custom-logo-purple dark:focus:ring-custom-logo-purple-dark focus:border-custom-logo-purple dark:focus:border-custom-logo-purple-dark bg-custom-white dark:bg-custom-white-dark text-custom-black dark:text-custom-black-dark transition-all duration-200 ${
               isMobile ? 'text-sm leading-relaxed' : 'text-sm'
             }`}
             rows={isMobile ? 3 : 3}
               maxLength={200}
             />
                     <div className="flex items-center justify-between mt-1">
             <div className="text-xs text-custom-light-purple dark:text-custom-light-purple-dark">
               {text.length}/200 {t("text_editor.characters")}
             </div>
             {isEditing && (
               <div className="text-xs text-custom-logo-purple dark:text-custom-logo-purple-dark animate-pulse flex items-center">
                 <span className="w-2 h-2 bg-custom-logo-purple dark:bg-custom-logo-purple-dark rounded-full mr-1 animate-pulse"></span>
                 {t("text_editor.editing")}
               </div>
             )}
           </div>
           {/* 簡潔提示 */}
           {!isMobile && (
             <div className="text-xs text-custom-logo-purple dark:text-custom-logo-purple-dark mt-1 bg-custom-light-purple/10 dark:bg-custom-light-purple-dark/10 p-1.5 rounded-lg">
               💡 {t("text_editor.double_click_hint")}
             </div>
           )}
        </div>

                 {/* 字體設定 - 緊湊佈局 */}
         <div className={`grid gap-2 ${isMobile && activeTab !== 'style' ? 'hidden' : ''} ${
           isMobile ? 'grid-cols-1' : 'grid-cols-2'
         }`}>
             <div>
             <label className="block text-xs font-medium mb-1 text-custom-black dark:text-custom-black-dark">{t("text_editor.font_family")}</label>
               <select
                 value={fontFamily}
                 onChange={(e) => setFontFamily(e.target.value)}
                 onKeyDown={(e) => {
                   e.stopPropagation();
                 }}
               className="w-full p-2 text-sm border border-custom-light-purple dark:border-custom-light-purple-dark rounded-lg focus:ring-2 focus:ring-custom-logo-purple dark:focus:ring-custom-logo-purple-dark focus:border-custom-logo-purple dark:focus:border-custom-logo-purple-dark bg-custom-white dark:bg-custom-white-dark text-custom-black dark:text-custom-black-dark transition-all duration-200"
               >
                {fontOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

                         <div>
             <label className="block text-xs font-medium mb-1 text-custom-black dark:text-custom-black-dark">{t("text_editor.font_size")}</label>
               <select
                 value={fontSize}
                 onChange={(e) => setFontSize(Number(e.target.value))}
                 onKeyDown={(e) => {
                   e.stopPropagation();
                 }}
               className="w-full p-2 text-sm border border-custom-light-purple dark:border-custom-light-purple-dark rounded-lg focus:ring-2 focus:ring-custom-logo-purple dark:focus:ring-custom-logo-purple-dark focus:border-custom-logo-purple dark:focus:border-custom-logo-purple-dark bg-custom-white dark:bg-custom-white-dark text-custom-black dark:text-custom-black-dark transition-all duration-200"
               >
                {fontSizeOptions.map(size => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </div>
          </div>

                 {/* 文字樣式 - 緊湊佈局 */}
           <div className={`${isMobile && activeTab !== 'style' ? 'hidden' : ''}`}>
           <label className="block text-xs font-medium mb-1 text-custom-black dark:text-custom-black-dark">{t("text_editor.style")}</label>
           <div className={`flex space-x-1 ${isMobile ? 'justify-center' : ''}`}>
               <button
                 onClick={() => setBold(!bold)}
                 onKeyDown={(e) => {
                   e.stopPropagation();
                   e.preventDefault();
                 }}
               className={`p-2 rounded-lg transition-all duration-200 ${
                 bold ? 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white shadow-md' : 'bg-custom-light-purple/20 dark:bg-custom-light-purple-dark/20 text-custom-black dark:text-custom-black-dark hover:bg-custom-light-purple/40 dark:hover:bg-custom-light-purple-dark/40'
                 } ${isMobile ? 'p-3' : 'p-2'}`}
                 title={t("text_editor.bold")}
               >
               <Bold className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
               </button>
              <button
                onClick={() => setItalic(!italic)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                             className={`p-2 rounded-lg transition-all duration-200 ${
                 italic ? 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white shadow-md' : 'bg-custom-light-purple/20 dark:bg-custom-light-purple-dark/20 text-custom-black dark:text-custom-black-dark hover:bg-custom-light-purple/40 dark:hover:bg-custom-light-purple-dark/40'
                 } ${isMobile ? 'p-3' : 'p-2'}`}
                 title={t("text_editor.italic")}
               >
               <Italic className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
              </button>
              <button
                onClick={() => setUnderline(!underline)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                             className={`p-2 rounded-lg transition-all duration-200 ${
                 underline ? 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white shadow-md' : 'bg-custom-light-purple/20 dark:bg-custom-light-purple-dark/20 text-custom-black dark:text-custom-black-dark hover:bg-custom-light-purple/40 dark:hover:bg-custom-light-purple-dark/40'
                 } ${isMobile ? 'p-3' : 'p-2'}`}
                 title={t("text_editor.underline")}
               >
               <Underline className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
              </button>
            </div>
          </div>

                     {/* 對齊方式 - 緊湊佈局 */}
           <div className={`${isMobile && activeTab !== 'style' ? 'hidden' : ''}`}>
           <label className="block text-xs font-medium mb-1 text-custom-black dark:text-custom-black-dark">{t("text_editor.align")}</label>
           <div className={`flex space-x-1 ${isMobile ? 'justify-center' : ''}`}>
               <button
                 onClick={() => setAlign('left')}
                 onKeyDown={(e) => {
                   e.stopPropagation();
                   e.preventDefault();
                 }}
               className={`p-2 rounded-lg transition-all duration-200 ${
                 align === 'left' ? 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white shadow-md' : 'bg-custom-light-purple/20 dark:bg-custom-light-purple-dark/20 text-custom-black dark:text-custom-black-dark hover:bg-custom-light-purple/40 dark:hover:bg-custom-light-purple-dark/40'
                 } ${isMobile ? 'p-3' : 'p-2'}`}
                 title={t("text_editor.align_left")}
               >
               <AlignLeft className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
              </button>
              <button
                onClick={() => setAlign('center')}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                             className={`p-2 rounded-lg transition-all duration-200 ${
                 align === 'center' ? 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white shadow-md' : 'bg-custom-light-purple/20 dark:bg-custom-light-purple-dark/20 text-custom-black dark:text-custom-black-dark hover:bg-custom-light-purple/40 dark:hover:bg-custom-light-purple-dark/40'
                 } ${isMobile ? 'p-3' : 'p-2'}`}
                 title={t("text_editor.align_center")}
               >
               <AlignCenter className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
              </button>
              <button
                onClick={() => setAlign('right')}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                             className={`p-2 rounded-lg transition-all duration-200 ${
                 align === 'right' ? 'bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white shadow-md' : 'bg-custom-light-purple/20 dark:bg-custom-light-purple-dark/20 text-custom-black dark:text-custom-black-dark hover:bg-custom-light-purple/40 dark:hover:bg-custom-light-purple-dark/40'
                 } ${isMobile ? 'p-3' : 'p-2'}`}
                 title={t("text_editor.align_right")}
               >
               <AlignRight className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'}`} />
              </button>
            </div>
          </div>

                   {/* 顏色選擇 - 緊湊佈局 */}
         <div className={`${isMobile && activeTab !== 'style' ? 'hidden' : ''}`}>
         <label className="block text-xs font-medium mb-1 text-custom-black dark:text-custom-black-dark">{t("text_editor.color")}</label>
           <div className="flex items-center space-x-2">
           <div className={`flex flex-wrap gap-1 ${isMobile ? 'justify-center' : ''}`}>
             {colorOptions.slice(0, isMobile ? 6 : 8).map((colorOption) => (
               <button
                 key={colorOption}
                 onClick={() => setColor(colorOption)}
                 onKeyDown={(e) => {
                   e.stopPropagation();
                   e.preventDefault();
                 }}
                 className={`rounded-lg border-2 transition-all duration-200 ${
                   color === colorOption ? 'border-custom-logo-purple dark:border-custom-logo-purple-dark scale-110 shadow-md' : 'border-custom-light-purple dark:border-custom-light-purple-dark hover:scale-105'
                 } ${isMobile ? 'w-8 h-8' : 'w-6 h-6'}`}
                 style={{ backgroundColor: colorOption }}
                 title={colorOption}
               />
             ))}
           </div>
             <button
               onClick={() => setShowColorPicker(!showColorPicker)}
               onKeyDown={(e) => {
                 e.stopPropagation();
                 e.preventDefault();
               }}
             className="p-2 rounded-lg bg-custom-light-purple/20 dark:bg-custom-light-purple-dark/20 hover:bg-custom-light-purple/40 dark:hover:bg-custom-light-purple-dark/40 transition-all duration-200"
             title={t("text_editor.more_colors")}
             >
             <Palette className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} text-custom-black dark:text-custom-black-dark`} />
             </button>
           </div>

                   {/* 顏色選擇器 - 緊湊設計 */}
           {showColorPicker && (
           <div className="mt-2 p-2 bg-custom-light-purple/10 dark:bg-custom-light-purple-dark/10 rounded-lg border border-custom-light-purple/20 dark:border-custom-light-purple-dark/20">
             <div className={`grid gap-1 ${isMobile ? 'grid-cols-6' : 'grid-cols-8'}`}>
               {colorOptions.map((colorOption) => (
                   <button
                     key={colorOption}
                     onClick={() => {
                       setColor(colorOption);
                       setShowColorPicker(false);
                     }}
                     onKeyDown={(e) => {
                       e.stopPropagation();
                       e.preventDefault();
                     }}
                   className={`rounded-lg border-2 transition-all duration-200 ${
                     color === colorOption ? 'border-custom-logo-purple dark:border-custom-logo-purple-dark scale-110 shadow-md' : 'border-custom-light-purple dark:border-custom-light-purple-dark hover:scale-105'
                   } ${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`}
                     style={{ backgroundColor: colorOption }}
                     title={colorOption}
                   />
                 ))}
               </div>
             </div>
           )}
          </div>

                 {/* 位置顯示 - 緊湊設計 */}
           <div className={`${isMobile && activeTab !== 'position' ? 'hidden' : ''}`}>
           <label className="block text-xs font-medium mb-1 text-custom-black dark:text-custom-black-dark">{t("text_editor.position")}</label>
           <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
             <div className="text-xs text-custom-black dark:text-custom-black-dark bg-custom-light-purple/10 dark:bg-custom-light-purple-dark/10 p-2 rounded-lg">
               <span className="font-medium">X:</span> {Math.round(position.x)}%
             </div>
             <div className="text-xs text-custom-black dark:text-custom-black-dark bg-custom-light-purple/10 dark:bg-custom-light-purple-dark/10 p-2 rounded-lg">
               <span className="font-medium">Y:</span> {Math.round(position.y)}%
             </div>
           </div>
           <div className="text-xs text-custom-logo-purple dark:text-custom-logo-purple-dark mt-2 bg-custom-light-purple/10 dark:bg-custom-light-purple-dark/10 p-1.5 rounded-lg">
             {isMobile ? t("text_editor.drag_hint_mobile") : t("text_editor.drag_hint")}
           </div>
         </div>

        {/* 錯誤訊息 - 優化RWD設計 */}
        {errorMessage && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
              {errorMessage}
          </div>
        )}

                          {/* 操作按鈕 - 手機版簡潔設計 */}
         <div className={`${isMobile ? 'sticky bottom-0 bg-custom-white dark:bg-custom-white-dark pt-3 border-t border-custom-light-purple/20 dark:border-custom-light-purple-dark/20 -mx-4 px-4 -mb-4' : 'flex justify-end space-x-2 pt-3 border-t border-custom-light-purple dark:border-custom-light-purple-dark'}`}>
           {isMobile ? (
             <button
               onClick={handleAddText}
               disabled={!text.trim() || isLoading}
               className="w-full bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white rounded-lg hover:bg-custom-logo-purple/90 dark:hover:bg-custom-logo-purple-dark/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center py-3 text-base font-medium shadow-md"
             >
               {isLoading ? (
                 <>
                   <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                   處理中...
                 </>
               ) : (
                 <>
                   <Check className="w-5 h-5 mr-2" />
                   {t("text_editor.add_text")}
                 </>
               )}
             </button>
           ) : (
             <>
               <button
                 onClick={handleCancel}
                 disabled={isLoading}
                 className="text-custom-black dark:text-custom-black-dark hover:text-custom-logo-purple dark:hover:text-custom-logo-purple-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-xs"
               >
                 {t("ui.cancel")}
               </button>
               <button
                 onClick={handleAddText}
                 disabled={!text.trim() || isLoading}
                 className="bg-custom-logo-purple dark:bg-custom-logo-purple-dark text-custom-white dark:text-custom-white rounded-lg hover:bg-custom-logo-purple/90 dark:hover:bg-custom-logo-purple-dark/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center shadow-md px-3 py-1.5 text-xs"
               >
                 {isLoading ? (
                   <>
                     <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                     處理中...
                   </>
                 ) : (
                   <>
                     <Check className="w-3 h-3 mr-1" />
                     {t("text_editor.add_text")}
                   </>
                 )}
               </button>
             </>
           )}
         </div>
      </div>
    </div>
  );
};

export default TextEditor; 