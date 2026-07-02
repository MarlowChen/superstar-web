/**
 * FabricStage 文字圖層擴展 - 支援自動換行版本
 * 
 * 使用 fabric.Textbox 而不是 IText，支援自動換行
 */

import type { FabricEditorHandle } from "./FabricStage";
import * as fabric from "fabric";
import { TextProperties } from "./TextToolbar";

export interface TextLayerOptions {
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: "left" | "center" | "right";
  underline?: boolean;
}

export interface ExtendedFabricEditorHandle extends FabricEditorHandle {
  addTextLayer: (text?: string, options?: TextLayerOptions) => Promise<{ id: string }>;
  isTextLayer: (layerId: string) => boolean;
  getTextObject: (layerId: string) => fabric.Textbox | null;
  deleteTextLayer: (layerId: string) => void;
  updateTextProperties: (layerId: string, properties: Partial<TextProperties>) => void;
  getTextProperties: (layerId: string) => TextProperties | null;
}

const genId = () => `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * 生成文字縮圖
 */
async function createTextThumb(textObj: fabric.Textbox): Promise<string> {
  const edge = 64;
  const scale = Math.min(edge / (textObj.width || 1), edge / (textObj.height || 1), 1);
  
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext("2d")!;
  
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, edge, edge);
  
  const dataURL = textObj.toDataURL({ multiplier: scale });
  const img = new Image();
  
  return new Promise((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, (edge - img.width) / 2, (edge - img.height) / 2);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve("");
    img.src = dataURL;
  });
}

/**
 * 擴展 API，加入可編輯的文字圖層
 */
export function extendWithTextLayer(
  baseApi: FabricEditorHandle
): ExtendedFabricEditorHandle {
  
  /**
   * 新增可編輯文字圖層
   */
  async function addTextLayer(
    text: string = "輸入文字",
    options: TextLayerOptions = {}
  ): Promise<{ id: string }> {
    const canvas = baseApi.getCanvas();
    if (!canvas) throw new Error("Canvas not ready");
  
    const id = genId();
  
    // 先創建一個臨時文字來計算寬度
    const tempText = new fabric.Textbox(text, {
      fontSize: options.fontSize ?? 32,
      fontFamily: options.fontFamily ?? "Arial",
      fontWeight: options.fontWeight ?? "normal",
      fontStyle: options.fontStyle ?? "normal",
    });
  
    // 計算文字的自然寬度（加一點 padding）
    const naturalWidth = Math.max(tempText.width || 100, 10);
    const initialWidth = Math.min(naturalWidth + 20, 500);
  
    // 創建正式的 Textbox
    const textObj = new fabric.Textbox(text, {
      left: canvas.getWidth()! / 2,
      top: canvas.getHeight()! / 2,
      fontSize: options.fontSize ?? 32,
      fontFamily: options.fontFamily ?? "Arial",
      fill: options.fill ?? "#000000",
      fontWeight: options.fontWeight ?? "normal",
      fontStyle: options.fontStyle ?? "normal",
      textAlign: options.textAlign ?? "left",
      underline: options.underline ?? false,
      originX: "center",
      originY: "center",
      splitByGrapheme: true,
      width: initialWidth,
      editable: false,
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockScalingFlip: true,
      lockUniScaling: false,
    });
  
    textObj.setControlsVisibility({
      mt: false,
      mb: false,
      ml: false,
      mr: false,
      mtr: true,
    });
  
    const thumb = await createTextThumb(textObj);
  
    textObj.data = {
      id,
      name: "Text Layer",
      thumb,
      isText: true,
      type: "textbox",
    };
  
    // 先加入文字到 Canvas
    canvas.add(textObj);
  
    // 建立 proxy
    const proxy = baseApi.ensureTextProxyRect(canvas, textObj);
  
    // 🔥 確保 proxy 在 textObj 的正上方
    const textIndex = canvas.getObjects().indexOf(textObj);
    const proxyIndex = canvas.getObjects().indexOf(proxy);
    if (proxyIndex !== textIndex + 1) {
      canvas.remove(proxy);
      canvas.insertAt(textIndex + 1, proxy);
    }
  
    // 🔥 確保 proxy 可被選取
    proxy.selectable = true;
    proxy.evented = true;
    proxy.visible = true;
    proxy.hoverCursor = "move";
  
    // 選中 proxy
    canvas.setActiveObject(proxy);
  
    canvas.requestRenderAll();
    baseApi.saveHistory?.();
  
    return { id };
  }

  /**
   * 刪除文字圖層（包含 proxy）
   */
  function deleteTextLayer(layerId: string): void {
    const canvas = baseApi.getCanvas();
    if (!canvas) return;

    const objects = canvas.getObjects() ;
    
    // 🔥 支援 textbox 和 i-text
    const textObj = objects.find(
      (o) => (o.type === "textbox" || o.type === "i-text") && o.data?.id === layerId
    );
    
    // 刪除 proxy
    const proxy = objects.find(
      (o) => o.data?.proxyTag === `__proxy_${layerId}`
    );

    if (textObj) {
      canvas.remove(textObj);
    }
    if (proxy) {
      canvas.remove(proxy);
    }
    
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    baseApi.saveHistory?.();
  }

  /**
   * 檢查是否為文字圖層
   */
  function isTextLayer(layerId: string): boolean {
    const canvas = baseApi.getCanvas();
    if (!canvas) return false;

    const objects = canvas.getObjects() ;
    const obj = objects.find((o) => o.data?.id === layerId);
    
    // 🔥 支援 textbox 和 i-text
    return (obj?.type === "textbox" || obj?.type === "i-text") && !!obj.data?.isText;
  }

  /**
   * 取得文字物件
   */
  function getTextObject(layerId: string): fabric.Textbox | null {
    const canvas = baseApi.getCanvas();
    if (!canvas) return null;

    const objects = canvas.getObjects();
    const obj = objects.find(
      (o) => (o.type === "textbox" || o.type === "i-text") && o.data?.id === layerId
    );
    
    return obj ? (obj as fabric.Textbox) : null;
  }

  /**
   * 更新文字屬性
   */
  function updateTextProperties(
    layerId: string,
    properties: Partial<TextProperties>
  ): void {
    const textObj = getTextObject(layerId);
    if (!textObj) return;

    const canvas = baseApi.getCanvas();
    if (!canvas) return;

    // 記錄當前位置
    const oldLeft = textObj.left;
    const oldTop = textObj.top;

    // 更新屬性
    textObj.set(properties);

    // 如果改變了字型大小，重新初始化尺寸
    if (properties.fontSize) {
      textObj.initDimensions();
      
      // 保持中心點位置不變
      textObj.set({
        left: oldLeft,
        top: oldTop,
      });
    }

    // 重新計算座標
    textObj.setCoords();
    
    // 🔥 同步更新 proxy
    const proxy = (canvas.getObjects()).find(
      (o) => o.data?.proxyTag === `__proxy_${layerId}`
    );
    if (proxy) {
      const currentScale = textObj.scaleX || 1;
      proxy.set({
        left: textObj.left,
        top: textObj.top,
        width: (textObj.width || 100) * currentScale,
        height: (textObj.height || 50) * currentScale,
      });
      proxy.setCoords();
    }
    
    canvas.requestRenderAll();
    baseApi.saveHistory?.();
  }

  /**
   * 取得文字屬性
   */
  function getTextProperties(layerId: string): TextProperties | null {
    const textObj = getTextObject(layerId);
    if (!textObj) return null;

    return {
      fontSize: textObj.fontSize,
      fontFamily: textObj.fontFamily,
      fill: typeof textObj.fill === "string" ? textObj.fill : "#000000",
      fontWeight: textObj.fontWeight as string,
      fontStyle: textObj.fontStyle,
      underline: textObj.underline,
      linethrough: textObj.linethrough,
      textAlign: (textObj.textAlign || "left") as "left" | "center" | "right" | "justify",
    };
  }

  // 包裝原本的 deleteLayer
  const originalDeleteLayer = baseApi.deleteLayer;
  const enhancedDeleteLayer = (id: string) => {
    if (isTextLayer(id)) {
      deleteTextLayer(id);
    } else {
      originalDeleteLayer(id);
    }
  };

  return {
    ...baseApi,
    addTextLayer,
    isTextLayer,
    getTextObject,
    deleteTextLayer,
    updateTextProperties,
    getTextProperties,
    deleteLayer: enhancedDeleteLayer,
  };
}

/**
 * 設定文字的全域事件監聽
 */
export function setupTextEditing(canvas: fabric.Canvas): void {
  // 文字內容改變時，重新計算邊界框
  canvas.on("text:changed", (e) => {
    const target = e.target;
    if (target && (target.type === "textbox" || target.type === "i-text")) {
      const textObj = target as fabric.Textbox;
      textObj.initDimensions();
      textObj.setCoords();
      canvas.requestRenderAll();
    }
  });
}