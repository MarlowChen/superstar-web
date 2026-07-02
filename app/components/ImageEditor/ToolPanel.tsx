import React, { useState, useCallback, useEffect } from 'react';
import { 
  TextEditor, 
  ImageResizer, 
  ExpressionChanger, 
  BackgroundRemover, 
  AreaEraser, 
  StyleSwitcher,
  TextData 
} from './tools';

interface ToolPanelProps {
  currentTool: string;
  isActive: boolean;
  imageData: {
    width: number;
    height: number;
    url: string;
  };
  canvas?: HTMLCanvasElement | null;
  brushPreviewCanvas?: HTMLCanvasElement | null;
  isMobile: boolean;
  canvasSize?: { width: number; height: number };
  brushSize?: number;
  setBrushSize?: (size: number) => void;
  onToolComplete: (tool: string, data: unknown) => void;
  onClose: () => void;
  onTextPreviewUpdate?: (data: unknown) => void;
  onTextPositionUpdate?: (position: { x: number; y: number }) => void;
  onTextContentUpdate?: (text: string) => void;
  // 新增：接收來自 ImageEditor 的位置更新
  currentTextPosition?: { x: number; y: number };
  currentTextContent?: string;
  // 新增：即時操作記錄回調
  onImmediateAction?: (actionType: string, actionData: Record<string, unknown>) => void;
  onTextPositionChange?: (position: { x: number; y: number }) => void;
  onTextContentChange?: (content: string) => void;
  onTextStyleChange?: (style: Partial<TextData>) => void;
  onEraserEventHandlersReady?: (handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
  }) => void;
  onEraserClearFunctionReady?: (clearFunction: () => Promise<void>) => void;
  onBackgroundRemoverEventHandlersReady?: (handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
  }) => void;
  onBackgroundRemoverClearFunctionReady?: (clearFunction: () => Promise<void>) => void; // 新增：背景移除修復清除函數
  onBackgroundRemoverResetFunctionReady?: (resetFunction: () => void) => void; // 新增：背景移除修復重置函數
  onBackgroundRemoverResetRepair?: () => void;
  onBackgroundRemoverExitRepair?: () => void;
  onBackgroundRemoverClose?: () => void;
  originalImageUrl?: string; // 添加原始圖片URL
}

const ToolPanel: React.FC<ToolPanelProps> = ({
  currentTool,
  isActive,
  imageData,
  canvas,
  brushPreviewCanvas,
  isMobile,
  canvasSize,
  brushSize,
  setBrushSize,
  onToolComplete,
  onClose,
  onTextPreviewUpdate,
  currentTextPosition,
  currentTextContent,
  onImmediateAction,
  onTextPositionChange,
  onTextContentChange,
  onTextStyleChange,
  onEraserEventHandlersReady,
  onEraserClearFunctionReady,
  onBackgroundRemoverEventHandlersReady,
  onBackgroundRemoverClearFunctionReady,
  onBackgroundRemoverResetFunctionReady,
  onBackgroundRemoverResetRepair,
  onBackgroundRemoverExitRepair,
  onBackgroundRemoverClose,
  originalImageUrl
}) => {
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [textContent, setTextContent] = useState<string>('');

  // 處理文字位置更新 - 修復：避免循環更新
  const handleTextPositionUpdate = useCallback((position: { x: number; y: number }) => {
    console.log('ToolPanel: 接收到文字位置更新:', position);
    setTextPosition(position);
    // 移除：避免循環通知
    // if (onTextPositionUpdate) {
    //   onTextPositionUpdate(position);
    // }
  }, []);

  // 處理文字內容更新 - 修復：避免循環更新
  const handleTextContentUpdate = useCallback((text: string) => {
    console.log('ToolPanel: 接收到文字內容更新:', text);
    setTextContent(text);
    // 移除：避免循環通知
    // if (onTextContentUpdate) {
    //   onTextContentUpdate(text);
    // }
  }, []);

  // 修復：接收來自 ImageEditor 的位置更新
  useEffect(() => {
    if (currentTextPosition && 
        (textPosition?.x !== currentTextPosition.x || textPosition?.y !== currentTextPosition.y)) {
      console.log('ToolPanel: 接收到來自 ImageEditor 的位置更新:', currentTextPosition);
      setTextPosition(currentTextPosition);
    }
  }, [currentTextPosition, textPosition]);

  // 修復：接收來自 ImageEditor 的內容更新
  useEffect(() => {
    if (currentTextContent && currentTextContent !== textContent) {
      console.log('ToolPanel: 接收到來自 ImageEditor 的內容更新:', currentTextContent);
      setTextContent(currentTextContent);
    }
  }, [currentTextContent, textContent]);

  const handleTextAdd = (textData: unknown) => {
    // 文字添加完成時的回調
    console.log('ToolPanel: 文字添加完成:', textData);
    onToolComplete('add-text', textData);
  };

  const getImageId = (): string => {
    if (imageData.url.startsWith('blob:')) {
      return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    const urlParts = imageData.url.split('/');
    const fileName = urlParts[urlParts.length - 1];
    return fileName.split('.')[0] || `img_${Date.now()}`;
  };

  const handleResize = (resizeData: unknown) => {
    console.log('ToolPanel: 圖片調整大小完成:', resizeData);
    onToolComplete('resize', resizeData);
  };

  const handleExpressionChange = (expressionData: unknown) => {
    console.log('ToolPanel: 表情變更完成:', expressionData);
    onToolComplete('expression', expressionData);
  };

  const handleBackgroundRemove = (removeData: unknown) => {
    console.log('ToolPanel: 背景移除完成:', removeData);
    onToolComplete('background-remove', removeData);
  };

  // 適配器函數：將 BackgroundRemover 的 onComplete 格式轉換為 ImageEditor 的格式
  const handleBackgroundRemoverComplete = useCallback((result: { type: string; data: Record<string, unknown> }) => {
    console.log('=== ToolPanel: BackgroundRemover onComplete 被調用 ===', result);
    console.log('ToolPanel: 調用 onToolComplete 傳遞給 ImageEditor', { 
      toolId: 'background-remove', 
      resultType: result.type,
      hasData: !!result.data 
    });
    
    // 調用 onToolComplete 確保狀態管理一致
    onToolComplete('background-remove', result);
    
    // 如果有立即動作，也執行
    if (onImmediateAction) {
      console.log('ToolPanel: 執行立即動作', { type: result.type });
      onImmediateAction(result.type, result.data);
    }
  }, [onToolComplete, onImmediateAction]);

  const handleStyleTransfer = (styleData: unknown) => {
    console.log('ToolPanel: 風格轉換完成:', styleData);
    onToolComplete('style-switch', styleData);
  };

  if (!isActive) return null;

  return (
    <>
      {/* 文字編輯器 - 浮動窗口模式 */}
      {currentTool === 'add-text' && (
        <TextEditor
          isActive={true}
          onTextAdd={handleTextAdd}
          onClose={onClose}
          imageId={getImageId()}
          imageUrl={imageData.url}
          onPreviewUpdate={onTextPreviewUpdate || (() => {})}
          currentPosition={textPosition || undefined}
          currentTextContent={textContent || undefined}
          onTextPositionUpdate={handleTextPositionUpdate}
          onTextContentUpdate={handleTextContentUpdate}
          onTextPositionChange={onTextPositionChange}
          onTextContentChange={onTextContentChange}
          onTextStyleChange={onTextStyleChange}
          isMobile={isMobile}
        />
      )}
      
      <ImageResizer
        isActive={currentTool === 'resize'}
        originalWidth={imageData.width}
        originalHeight={imageData.height}
        onResize={handleResize}
        onClose={onClose}
        imageId={getImageId()}
      />

        <ExpressionChanger
          isActive={currentTool === 'expression'}
          onExpressionChange={handleExpressionChange}
          onClose={onClose}
          imageId={getImageId()}
        />

      <BackgroundRemover
        isActive={currentTool === 'background-remove'}
        onRemoveBackground={handleBackgroundRemove}
        onClose={onBackgroundRemoverClose || onClose}
        imageId={getImageId()}
        canvas={canvas}
        brushPreviewCanvas={brushPreviewCanvas}
        isMobile={isMobile}
        canvasSize={canvasSize}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        onComplete={handleBackgroundRemoverComplete}
        onEventHandlersReady={onBackgroundRemoverEventHandlersReady}
        onClearRepairFunctionReady={onBackgroundRemoverClearFunctionReady}
        onResetRepairFunctionReady={onBackgroundRemoverResetFunctionReady}
        onResetRepair={onBackgroundRemoverResetRepair}
        onExitRepair={onBackgroundRemoverExitRepair}
        originalImageUrl={originalImageUrl}
      />

      <AreaEraser
        isActive={currentTool === 'area-eraser'}
        canvas={canvas}
        brushPreviewCanvas={brushPreviewCanvas}
        isMobile={isMobile}
        canvasSize={canvasSize}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        onClose={onClose}
        onComplete={(result) => onToolComplete('area-eraser', result)}
        onEventHandlersReady={onEraserEventHandlersReady}
        onClearFunctionReady={onEraserClearFunctionReady}
        imageId={getImageId()}
        originalImageUrl={originalImageUrl || imageData.url}
      />

      <StyleSwitcher
        isActive={currentTool === 'style-switch'}
        onApplyStyle={handleStyleTransfer}
        onClose={onClose}
        imageId={getImageId()}
      />
    </>
  );
};

export default ToolPanel; 