"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Undo2,
  Redo2,
  Download,
  ZoomIn,
  ZoomOut,
  X,
  Upload,
  Sparkles,
  Maximize2,
  Layers as LayersIcon,
  ChevronDown,
  Type,
} from "lucide-react";

import {
  LayersSidebar,
  LayersDrawer,
  type LayerListItem,
} from "./LayersSidebar";

import FabricStage, {
  type FabricEditorHandle,
  type StageLayerItem,
} from "./FabricStage";
import {
  Group,
  Rect,
  TMat2D,
  type Canvas,
  type FabricImage,
  type FabricObject,
} from "fabric";
import SelectedLayerToolbar from "./SelectedLayerToolbar";

import EditorPromptDock, { type EditorMode } from "./EditorPromptDock";
import {
  ConvertResult,
  convertToCompositorFormatCrop,
} from "./Compositorutils";
import ObjectID from "bson-objectid";
import ArtboardPanel from "./ArtboardPanel";
import ExportMenu from "./ExportMenu";
import {
  ExtendedFabricEditorHandle,
  extendWithTextLayer,
  setupTextEditing,
} from "./FabricStageTextExtension";
import TextToolbar, { TextProperties } from "./TextToolbar";
import {
  waitForTaskFirstMediaUrl,
  waitForTaskSuccess,
} from "@/app/lib/taskSseWatcher";

/* =======================
   Types
   ======================= */
export type EditorTool =
  | "background-removal"
  | "layer-separation"
  | "eraser"
  | "brush"
  | "pose-control"
  | "object-placement"
  | null;

interface EditorProps {
  initialImage?: string;
  onClose?: () => void;
  onSave?: (imageData: string | null) => void;
}

type SelectedTransforms = ReturnType<
  NonNullable<FabricEditorHandle["getSelectedLayersTransform"]>
>;

type SplitSSEItem =
  | {
      shortId?: string;
      id?: string;
      subfolder?: string;
      filename?: string;
      type?: string;
      s3_url?: string;
      url?: string;
      label?: string;
      name?: string;
    }
  | Record<string, unknown>;

const BASE_ID = "BASE_LAYER";

/* =======================
   Helpers
   ======================= */
function emptyPng(): string {
  const c = document.createElement("canvas");
  c.width = 1;
  c.height = 1;
  return c.toDataURL("image/png");
}

/* =======================
   Component
   ======================= */
export default function ImageEditor({ initialImage }: EditorProps) {
  const t = useTranslations("edited");
  const [isMobileDrawingMode, setIsMobileDrawingMode] = useState(false);
  const [mobileEditingLayerId, setMobileEditingLayerId] = useState<
    string | null
  >(null);

  const mobileBackupRef = useRef<{
    zoom: number;
    viewport: number[];
    hiddenLayers: string[]; // 其實這也不需要了，因為我們靠 FocusState 來動態隱藏，但留著雙重保險也可以
  } | null>(null);
  const [selectedTool, setSelectedTool] = useState<EditorTool>(null);
  const [baseUrl] = useState<string | null>(initialImage || null);

  const [zoom, setZoom] = useState(100);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [panelLayersTopToBottom, setPanelLayersTopToBottom] = useState<
    StageLayerItem[]
  >([]);
  const [baseVisible, setBaseVisible] = useState(true);

  const [brushMode, setBrushMode] = useState(false);
  const [brushSize, setBrushSize] = useState(20);

  const [eraserMode, setEraserMode] = useState(false);
  const [eraserSize, setEraserSize] = useState(20);
  const [eraserAction, setEraserAction] = useState<"erase" | "restore">(
    "erase"
  );

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);


  const [currentMode, setCurrentMode] = useState<EditorMode | null>(null);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  const fabricApiRef = useRef<ExtendedFabricEditorHandle | null>(null);

  const overlayFileRef = useRef<HTMLInputElement | null>(null);
  const exportAnchorRef = useRef<HTMLButtonElement>(null);

  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [textProperties, setTextProperties] = useState<TextProperties | null>(
    null
  );

  const [isArtboardPanelOpen, setIsArtboardPanelOpen] =
    useState<boolean>(false);

  const getCurrentArtboardSize = (): { width: number; height: number } => {
    const api = fabricApiRef.current;
    if (!api) return { width: 1920, height: 1080 };
    const { width, height } = api.getArtboardSize();
    return { width, height };
  };

  const suppressUntilRef = useRef(0);
  const now = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const withSuppress = (fn: () => void, ms = 200) => {
    suppressUntilRef.current = Math.max(suppressUntilRef.current, now() + ms);
    try {
      fn();
    } finally {
      /* no-op */
    }
  };
  const isSuppressed = () => now() < suppressUntilRef.current;

  useEffect(() => {
    if (selectedLayerIds.length === 1) {
      const api = fabricApiRef.current;
      if (api?.isTextLayer?.(selectedLayerIds[0])) {
        setSelectedTextId(selectedLayerIds[0]);
        const textObj = api.getTextObject(selectedLayerIds[0]);
        if (textObj) {
          setTextProperties({
            fontSize: textObj.fontSize,
            fontFamily: textObj.fontFamily,
            fill: textObj.fill as string,
            fontWeight: textObj.fontWeight,
            fontStyle: textObj.fontStyle,
            underline: textObj.underline,
            linethrough: textObj.linethrough,
            textAlign: textObj.textAlign as
              | "left"
              | "center"
              | "right"
              | "justify"
              | undefined,
          });
        }
      } else {
        setSelectedTextId(null);
        setTextProperties(null);
      }
    } else {
      setSelectedTextId(null);
      setTextProperties(null);
    }
  }, [selectedLayerIds]);

  // 🔥 完整的重連邏輯 - 完成後清除 taskId
  useEffect(() => {
    const checkPendingTasks = async () => {
      const api = fabricApiRef.current;
      const canvas = api?.getCanvas();
      if (!api || !canvas) {
        console.log("❌ API 或 Canvas 未就緒");
        return;
      }

      const allObjects = canvas.getObjects() as FabricObject[];
      const checkedTaskIds = new Set<string>();

      console.log(`🔍 開始掃描，共 ${allObjects.length} 個物件`);

      for (const obj of allObjects) {
        const data = obj.data;
        const taskId = data?.taskId as string;
        const isPending = data?.isPending;
        const layerId = data?.id || (data?.hostId as string);

        console.log(`🔍 檢查物件:`, {
          id: layerId,
          taskId,
          isPending,
          hasTaskId: !!taskId,
          hasPending: !!isPending,
        });

        // 🔥 新增：如果有 isPending 但沒有 taskId，表示已經完成過了
        if (isPending && !taskId) {
          console.log(`🧹 清理殘留的 pending 狀態: ${layerId}`);
          api.setLayerPending(layerId, false);
          continue;
        }

        if (!taskId || !isPending || checkedTaskIds.has(taskId)) {
          if (!taskId) console.log(`  ⏭️ 跳過：沒有 taskId`);
          if (!isPending) console.log(`  ⏭️ 跳過：不是 pending`);
          if (taskId && checkedTaskIds.has(taskId))
            console.log(`  ⏭️ 跳過：已處理過`);
          continue;
        }

        checkedTaskIds.add(taskId);
        console.log(`✅ 開始處理 taskId: ${taskId}`);

        try {
          const res = await fetch(`${SERVER}/task/${taskId}/status`, {
            credentials: "include",
          });

          if (!res.ok) {
            console.warn(`⚠️ 查詢失敗: ${res.status}`);
            continue;
          }

          const { status, publishedImages } = await res.json();
          console.log(`📡 任務狀態:`, {
            taskId,
            status,
            hasImages: !!publishedImages?.[0]?.url,
          });

          // 🔥 情況 1: 已完成 - 直接套用並清除 taskId
          if (status === "COMPLETED" && publishedImages?.[0]?.url) {
            console.log(`✅ 任務已完成，直接套用`);

            const affectedObjs = allObjects.filter(
              (o) => o.data?.taskId === taskId
            );

            // 🔥 辨識是否為合併任務
            if (affectedObjs.length > 1) {
              const layerIds = affectedObjs.map((o) => o.data?.id).filter(Boolean) as string[];
              
              // 🔥 1. 重新計算當前位置（不用存的 mergeCompositorData）
              const transforms = api.getSelectedLayersTransform(layerIds) as SelectedTransforms;
              const compositorData = convertToCompositorFormatCrop(transforms, 100, null);
              
              // 🔥 2. 放置結果
              await renderCompositeBack(publishedImages[0].url, compositorData);
              
              // 🔥 3. 清除 processing 狀態
              api.setLayerProcessing(layerIds, false);
              
              // 4. 清除 pending 和 taskId
              affectedObjs.forEach((o) => {
                const id = o.data?.id;
                if (id) {
                  api.setLayerPending(id, false);
                  delete o.data?.taskId;
                  delete o.data?.mergeCompositorData;
                }
              });
            
              canvas.requestRenderAll();
              api.replaceCurrentHistory?.();
            } else if (affectedObjs.length === 1) {
              // 單圖層任務
              const targetId = affectedObjs[0].data?.id as string;
              console.log(`🎯 單圖層任務，套用到: ${targetId}`);

              await api.setLayerImageFromUrlPreserveWorldSize(
                targetId,
                publishedImages[0].url,
                { resetMask: false }
              );
              api.setLayerPending(targetId, false);
              delete affectedObjs[0].data?.taskId;

              canvas.requestRenderAll();
              api.replaceCurrentHistory?.();
              console.log(`✅ 套用完成`);
            }

            continue;
          }

// 🔥 情況 2: 執行中 - 重連 SSE
if (status !== "COMPLETED" && status !== "FAILED") {
  console.log(`⏳ 任務執行中，重連 SSE`);

  const affectedObjs = allObjects.filter(
    (o) => o.data?.taskId === taskId
  );
  const layerIds = affectedObjs
    .map((o) => o.data?.id || o.data?.hostId)
    .filter(Boolean) as string[];

  console.log(`🔗 重連 SSE，影響圖層:`, layerIds);
  if (layerIds.length === 1) {
      // 🔥 重連時只用 setLayerPending 顯示視覺效果，不用 setLayerProcessing
      layerIds.forEach((id) => {
        api.setLayerPending(id, true);
      });
  }else{
    api.setLayerProcessing(layerIds, true);
  }


	void waitForTaskSuccess({
	  taskId,
	  userId: "guest",
	  replayLimit: 50,
	  failureMessage: t("sse_interrupted"),
	  interruptedMessage: t("sse_interrupted"),
	  onPayload: async (data) => {
	    console.log(`📨 解析後:`, {
	      status: data.status,
	      hasImages: !!data.publishedImages?.[0]?.url,
	    });

	    if (data.status === "COMPLETED" && data.publishedImages?.[0]?.url) {
	      console.log(`✅ SSE 完成，開始套用結果`);
	
	      if (layerIds.length === 1) {
	        const layerId = layerIds[0];
	        const resultUrl = data.publishedImages[0].url;
	
	        try {
	          await api.setLayerImageFromUrlPreserveWorldSize(
	            layerId,
	            resultUrl,
	            { resetMask: false }
	          );
	
	          api.setLayerPending(layerId, false);
	
	          const img = (canvas.getObjects() as FabricObject[]).find(
	            (o) => (o as FabricObject)?.data?.id === layerId
	          );
	          if (img) {
	            delete (img as FabricObject).data?.taskId;
	          }
	
	          canvas.requestRenderAll();
	          api.replaceCurrentHistory?.();
	          api.setLayerProcessing(layerIds, false);
	        } catch (err) {
	          console.error(`❌ 套用圖片失敗:`, err);
	          api.setLayerPending(layerId, false);
	        }
	      } else {
	        const transforms = api.getSelectedLayersTransform(layerIds) as SelectedTransforms;
	        const compositorData = convertToCompositorFormatCrop(transforms, 100, null);
	        const resultUrl = data.publishedImages[0].url;
	        await renderCompositeBack(resultUrl, compositorData);
	
	        layerIds.forEach((layerId) => {
	          api.setLayerPending(layerId, false);
	          const img = (canvas.getObjects() as FabricObject[]).find(
	            (o) => (o as FabricObject)?.data?.id === layerId
	          );
	          if (img) {
	            delete img.data?.taskId;
	            delete img.data?.mergeCompositorData;
	          }
	        });
	        canvas.requestRenderAll();
	        api.replaceCurrentHistory?.();
	        api.setLayerProcessing(layerIds, false);
	      }
	    } else if (data.status === "FAILED") {
	      layerIds.forEach((id) => {
	        api.setLayerPending(id, false);
	        const img = (canvas.getObjects() as FabricObject[]).find(
	          (o) => (o as FabricObject)?.data?.id === id
	        );
	        if (img) {
	          delete (img as FabricObject).data?.taskId;
	          delete (img as FabricObject).data?.mergeCompositorData;
	        }
	      });
	      canvas.requestRenderAll();
	      api.saveHistory?.();
	    }
	  },
	}).catch((err) => {
	  console.error(`❌ SSE 連線錯誤:`, err);
	  layerIds.forEach((id) => {
	    api.setLayerPending(id, false);
	  });
	  canvas.requestRenderAll();
	});
}
          // 🔥 情況 3: 失敗 - 清除 taskId
          else if (status === "FAILED") {
            console.warn(`❌ 任務失敗，清除 taskId`);
            allObjects
              .filter((o) => o.data?.taskId === taskId)
              .forEach((o) => {
                const id = o.data?.id;
                if (id) {
                  api.setLayerPending(id, false);
                  delete o.data?.taskId; // 🔥 清除 taskId
                }
              });
            canvas.requestRenderAll();
            api.saveHistory?.();
          }
        } catch (err) {
          console.error(`❌ 處理任務失敗:`, err);
        }
      }
    };

    const timer = setTimeout(checkPendingTasks, 1000);
    return () => clearTimeout(timer);
  }, []);

  async function downscaleImageBlob(
    file: File,
    opts: {
      maxWidth?: number;
      maxHeight?: number;
      mime?: string;
      quality?: number;
    } = {}
  ): Promise<Blob> {
    const {
      maxWidth = 2048,
      maxHeight = 2048,
      mime = "image/png",
      quality = 0.92,
    } = opts;

    const arrayBuf = await file.arrayBuffer();
    const bmp = await createImageBitmap(new Blob([arrayBuf]));
    const { width, height } = bmp;

    if (width <= maxWidth && height <= maxHeight) {
      return new Blob([arrayBuf], { type: file.type || mime });
    }

    const scale = Math.min(maxWidth / width, maxHeight / height);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);

    const outMime = mime;
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), outMime, quality)
    );
  }

  /* =======================
     上傳 overlay 圖層
     ======================= */
  const handleOverlayUploadClick = () => overlayFileRef.current?.click();
  const handleOverlayFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const f = e.target.files?.[0];
    e.target.value = "";

    if (!f) return;

    const compressed = await downscaleImageBlob(f, {
      maxWidth: 2048,
      maxHeight: 2048,
      mime: "image/png",
      quality: 1,
    });

    const objUrl = URL.createObjectURL(compressed);
    await fabricApiRef.current?.addImageLayer(objUrl);
  };

  //   const handleSave = () => {
  //     const data = fabricApiRef.current?.toDataURL("image/png");
  //     onSave?.(data || null);
  //   };

  /* =======================
     圖層面板資料
     ======================= */
  const layerList: LayerListItem[] = [
    ...panelLayersTopToBottom.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      thumb: l.thumb,
      type:l.type
    })),
    ...(baseUrl
      ? [{ id: BASE_ID, name: "背景", visible: baseVisible, locked: true, type: "image" }]
      : []),
  ];

  const selectLayer = async (id: string, shiftKey?: boolean) => {
    fabricApiRef.current?.clearResidualDraw?.();
    const singleOnly = currentMode === "EDIT" || currentMode === "ACTION";
    
    // 🔥 手機版：合併模式自動啟用多選（等於自動 Shift）
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    const isInMergeMode = currentMode === "MERGE" && selectedLayerIds.length >= 1;
    const effectiveShiftKey = shiftKey || (isMobile && isInMergeMode);

    if (id === BASE_ID) {
      if (!baseUrl) {
        withSuppress(() => {
          fabricApiRef.current?.setActive(null);
          setSelectedLayerId(null);
          setSelectedLayerIds([]);
          if (selectedTool === "brush") updateBrushMode(null, null);
          if (selectedTool === "eraser") updateEraserMode(null, null);
          updateHistoryState();
        });
        return;
      }

      if (brushMode || eraserMode) {
        setSelectedTool(null);
        setBrushMode(false);
        setEraserMode(false);
        fabricApiRef.current?.exitDrawingMode?.(false);
        fabricApiRef.current?.setBrushMode(false);
        fabricApiRef.current?.setEraserMode?.(false);
      }
      withSuppress(() => {
        fabricApiRef.current?.setActive(null);
        setSelectedLayerId(null);
        setSelectedLayerIds([]);
        if (selectedTool === "brush") updateBrushMode(null, null);
        if (selectedTool === "eraser") updateEraserMode(null, null);
        updateHistoryState();
      });
      return;
    }

    if (effectiveShiftKey) {
      console.log("effectiveShiftKey   ===> ", effectiveShiftKey)  
      if (singleOnly) {
        withSuppress(() => {
          fabricApiRef.current?.setActive(id);
          setSelectedLayerId(id);
          setSelectedLayerIds([id]);
          updateBrushMode(selectedTool, id);
          updateEraserMode(selectedTool, id);
          updateHistoryState();
        });
        return;
      }
      const exists = selectedLayerIds.includes(id);
      const nextIds = exists
        ? selectedLayerIds.filter((sid) => sid !== id)
        : [...selectedLayerIds, id];

      if (nextIds.length > 1 && (brushMode || eraserMode)) {
        
        setSelectedTool(null);
        setBrushMode(false);
        setEraserMode(false);
        fabricApiRef.current?.exitDrawingMode?.(true);
        fabricApiRef.current?.setBrushMode(false);
        fabricApiRef.current?.setEraserMode?.(false);
      }

      withSuppress(() => {
        setSelectedLayerIds(nextIds);
        setSelectedLayerId(nextIds[0] || null);

        if (nextIds.length === 0) {
          fabricApiRef.current?.setActive(null);
        } else if (nextIds.length === 1) {
            
          // 🔥 延遲執行，等 cleanup 完成
          setTimeout(() => {
            fabricApiRef.current?.setActive(nextIds[0]);
          }, 0);
        } else {
          fabricApiRef.current?.setActiveMultiple?.(nextIds);
        }

        updateBrushMode(selectedTool, nextIds.length === 1 ? nextIds[0] : null);
        updateEraserMode(
          selectedTool,
          nextIds.length === 1 ? nextIds[0] : null
        );
        updateHistoryState();
      });
      return;
    }

    withSuppress(() => {
      // 🔥 延遲執行，等 cleanup 完成
      setTimeout(() => {
        fabricApiRef.current?.setActive(id);
      }, 0);
      setSelectedLayerId(id);
      setSelectedLayerIds([id]);
      updateBrushMode(selectedTool, id);
      updateEraserMode(selectedTool, id);
      updateHistoryState();
    });
  };

  /* =======================
     顯示/隱藏
     ======================= */
     const toggleLayerVisible = (id: string) => {
        // 檢查是否為背景層
        if (id === BASE_ID) {
            if (!baseUrl) return;
            setBaseVisible((v) => { // 🔥 修正：使用 setBaseVisible 更新 State
                const next = !v;
                fabricApiRef.current?.setBackgroundVisible(next);
                return next;
            });
            return;
        }
    
        // 取得 Fabric API 和 Canvas
        const api = fabricApiRef.current;
        if (!api) return;
    
        // 找到 Fabric 物件
        const canvas = api.getCanvas();
        if (!canvas) return;
    
        const objects = canvas.getObjects() as FabricObject[];
        const target = objects.find((o) => (o as FabricObject).data?.id === id) as
          | FabricObject
          | undefined;
    
        if (!target) {
          console.warn(`toggleLayerVisible: 找不到圖層 ${id}`);
          return;
        }
    
        // 計算並切換可見性
        const currentVisible = target.visible ?? true;
        const nextVisible = !currentVisible;
    
        // 1. 更新 Fabric 畫布
        api.setVisible(id, nextVisible);
        canvas.requestRenderAll();
        
        // 2. 🔥 關鍵修正：更新 React State，讓圖層面板 UI 同步 (強制 panelLayersTopToBottom 重新計算)
        // 這是讓 layerList 拿到新 visible 狀態的唯一方法
        setPanelLayersTopToBottom(prevList => 
            prevList.map(item => 
                item.id === id 
                    ? { ...item, visible: nextVisible } // 傳遞新的可見狀態
                    : item
            )
        );
    
        // console.log(`圖層 ${id}: ${currentVisible} → ${nextVisible}`);
    };

  /* =======================
     刪除
     ======================= */
  const deleteLayer = (id: string) => {
    if (id === BASE_ID) return;
    fabricApiRef.current?.deleteLayer(id);
    setSelectedLayerIds((prev) => prev.filter((sid) => sid !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
    updateHistoryState();
  };

  /* =======================
     重排
     ======================= */
  const reorderLayers = (next: LayerListItem[]) => {
    const idsTopToBottom = next
      .filter((n) => n.id !== BASE_ID)
      .map((n) => n.id);
    fabricApiRef.current?.reorderTopToBottom(idsTopToBottom);
  };

  /* =======================
     合併
     ======================= */
  const mergeLayers = async (ids: string[]) => {
    if (ids.length < 2) {
      alert(t("need_at_least_2_layers_to_merge"));
      return;
    }
    try {
      const api = fabricApiRef.current;
      if (!api) return;
      const result = await api.mergeLayers?.(ids);
      if (result) {
        setSelectedLayerId(result.id);
        setSelectedLayerIds([result.id]);
        updateHistoryState();
      }
    } catch (e: unknown) {
      console.error("合併失敗:", e);
    }
  };

/* =======================
   下載圖層
   ======================= */
   const handleDownloadLayer = async (id: string, type: "original" | "cropped") => {
    const api = fabricApiRef.current;
    if (!api) return;
  
    try {
      if (type === "original") {
        await api.downloadLayerOriginal?.(id);
      } else {
        await api.downloadLayerCropped?.(id);
      }
    } catch (err) {
      console.error("下載圖層失敗:", err);
    }
  };

  /* =======================
     Undo/Redo
     ======================= */
  const updateHistoryState = () => {
    const api = fabricApiRef.current;
    if (!api) return;
    setCanUndo(api.canUndo());
    setCanRedo(api.canRedo());
  };

  const handleUndo = async () => {
    const api = fabricApiRef.current;
    if (!api) return;

    // 🔥 先記住當前的工具和圖層
    const currentTool = selectedTool;
    const wasBrushing = brushMode;
    const wasErasing = eraserMode;

    await api.undo();
    updateHistoryState();

    // 🔥 短暫延遲讓 Canvas 穩定
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 🔥 從 Canvas 重新取得選取狀態
    const canvas = api.getCanvas();
    if (!canvas) return;

    const activeObj = canvas.getActiveObject() as FabricObject | undefined;
    if (activeObj) {
      const data = activeObj.data as
        | { id?: string; hostId?: string }
        | undefined;
      const layerId = data?.id || data?.hostId;

      if (layerId && typeof layerId === "string") {
        // 🔥 恢復選取狀態
        withSuppress(() => {
          setSelectedLayerId(layerId);
          setSelectedLayerIds([layerId]);
        });

        // 🔥 恢復繪圖模式
        if (wasBrushing && currentTool === "brush") {
          setTimeout(() => {
            updateBrushMode("brush", layerId);
          }, 100);
        } else if (wasErasing && currentTool === "eraser") {
          setTimeout(() => {
            updateEraserMode("eraser", layerId);
          }, 100);
        }
      }
    }
  };

  const handleRedo = async () => {
    const api = fabricApiRef.current;
    if (!api) return;

    // 🔥 先記住當前的工具和圖層
    const currentTool = selectedTool;
    const wasBrushing = brushMode;
    const wasErasing = eraserMode;

    await api.redo();
    updateHistoryState();

    // 🔥 短暫延遲讓 Canvas 穩定
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 🔥 從 Canvas 重新取得選取狀態
    const canvas = api.getCanvas();
    if (!canvas) return;

    const activeObj = canvas.getActiveObject() as FabricObject | undefined;
    if (activeObj) {
      const data = activeObj.data as
        | { id?: string; hostId?: string }
        | undefined;
      const layerId = data?.id || data?.hostId;

      if (layerId && typeof layerId === "string") {
        // 🔥 恢復選取狀態
        withSuppress(() => {
          setSelectedLayerId(layerId);
          setSelectedLayerIds([layerId]);
        });

        // 🔥 恢復繪圖模式
        if (wasBrushing && currentTool === "brush") {
          setTimeout(() => {
            updateBrushMode("brush", layerId);
          }, 100);
        } else if (wasErasing && currentTool === "eraser") {
          setTimeout(() => {
            updateEraserMode("eraser", layerId);
          }, 100);
        }
      }
    }
  };

  /* =======================
     Zoom
     ======================= */
  const handleZoomIn = () => {
    const api = fabricApiRef.current;
    if (api) {
      const current = api.getZoom();
      api.setZoom(Math.min(current + 25, 400));
    }
  };

  const handleZoomOut = () => {
    const api = fabricApiRef.current;
    if (api) {
      const current = api.getZoom();
      api.setZoom(Math.max(current - 25, 25));
    }
  };

  const handleResetView = () => {
    fabricApiRef.current?.resetView();
  };

  /* =======================
     Brush / Eraser
     ======================= */
  const updateBrushMode = (tool: EditorTool, layerId: string | null) => {
    const nowBrushMode = tool === "brush" && !!layerId;

    if (nowBrushMode && eraserMode) {
      setEraserMode(false);
      fabricApiRef.current?.setEraserMode?.(false);
    }

    setBrushMode(nowBrushMode);
    fabricApiRef.current?.setBrushMode(nowBrushMode);
    if (nowBrushMode) fabricApiRef.current?.setBrushSize?.(brushSize);

    // 🔥 手機板進入繪圖模式
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsMobileDrawingMode(nowBrushMode);
    }
  };

  const updateEraserMode = (tool: EditorTool, layerId: string | null) => {
    const nowEraserMode = tool === "eraser" && !!layerId;

    if (nowEraserMode && brushMode) {
      setBrushMode(false);
      fabricApiRef.current?.setBrushMode(false);
    }

    setEraserMode(nowEraserMode);
    fabricApiRef.current?.setEraserMode?.(nowEraserMode);
    if (nowEraserMode) {
      fabricApiRef.current?.setEraserSize?.(eraserSize);
      fabricApiRef.current?.setEraserAction?.(eraserAction);
    }

    // 🔥 手機板進入繪圖模式
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsMobileDrawingMode(nowEraserMode);
    }
  };
  const exitMobileDrawingMode = () => {
    setSelectedTool(null);
    setBrushMode(false);
    setEraserMode(false);
    fabricApiRef.current?.exitDrawingMode?.(false);
    fabricApiRef.current?.setBrushMode(false);
    fabricApiRef.current?.setEraserMode?.(false);

    // 🔥 重新選中當前圖層，避免失焦
    if (mobileEditingLayerId) {
      fabricApiRef.current?.setActive(mobileEditingLayerId);
    }

    setIsMobileDrawingMode(false);
  };

  const enterMobileEditMode = useCallback(
    (layerId: string) => {
      const api = fabricApiRef.current;
      if (!api) return;
      const canvas = api.getCanvas();
      if (!canvas) return;
  
      // 防止重複備份
      if (!mobileBackupRef.current) {
        mobileBackupRef.current = {
          zoom: api.getZoom(),
          viewport: canvas.viewportTransform?.slice() || [1, 0, 0, 1, 0, 0],
          hiddenLayers: [],
        };
      }
  
      // 🔥 步驟 A: 告訴 FabricStage：「現在是專注模式，Undo 時別把其他人叫出來」
      api.setMobileFocusState(layerId);
      api.setHistoryIsolation(true);
  
      // 步驟 B: 執行當下的 UI 變更 (隱藏其他人)
      panelLayersTopToBottom.forEach((l) => {
        if (l.id !== layerId) api.setVisible(l.id, false);
      });
  
      // 🔥 隱藏背景和 artboard
      api.setBackgroundVisible(false);
      api.toggleArtboard(false);
  
      // 🔥 選中目標圖層
      api.setActive(layerId);
  
      // 🔥 計算居中但不縮放
      const transforms = api.getSelectedLayersTransform([layerId]);
      if (transforms.length > 0) {
        const bbox = transforms[0].boundingBox;
        const canvasWidth = canvas.getWidth()!;
        const canvasHeight = canvas.getHeight()!;
  
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
  
        const currentZoom = canvas.getZoom();
        const vpt = canvas.viewportTransform!;
        vpt[4] = canvasWidth / 2 - centerX * currentZoom;
        vpt[5] = canvasHeight / 2 - centerY * currentZoom;
        canvas.setViewportTransform(vpt);
      }
      
      // 🔥 關鍵修正：讓所有物件完全無互動（但先備份原本狀態）
      (canvas.getObjects() as FabricObject[]).forEach((o) => {
        const fo = o as FabricObject;
        const data = (fo.data ||= {});
  
        if (!data.__mobileBackup) {
          data.__mobileBackup = {
            selectable: fo.selectable,
            evented: fo.evented,
            hasControls: fo.hasControls,
            hasBorders: fo.hasBorders,
            hoverCursor: fo.hoverCursor,
          };
        }
  
        fo.selectable = false;
        fo.evented = false;
        fo.hasControls = false;
        fo.hasBorders = false;
        fo.hoverCursor = "default";
        fo.lockMovementX = true;
        fo.lockMovementY = true;
      });
      
      canvas.selection = false;
      canvas.discardActiveObject();
  
      // 🔥 如果是文字圖層，進入文字編輯模式（在鎖定所有物件之後）
      if (api.isTextLayer?.(layerId)) {
        const textObj = api.getTextObject?.(layerId);
        const proxy = canvas.getObjects() .find(
          (o) => o.data?.proxyTag === `__proxy_${layerId}`
        );
        
        if (textObj && proxy) {
          // proxy 保持隱藏和鎖定（已經在上面的 forEach 處理了）
          
          // 🔥 重新啟用文字編輯，但保持鎖定移動和變換
          textObj.selectable = true;
          textObj.evented = true;
          textObj.editable = true;
          textObj.hasControls = false;  // 不顯示控制點
          textObj.hasBorders = true;    // 顯示邊框
          textObj.lockMovementX = true; // 保持鎖定移動
          textObj.lockMovementY = true;
          textObj.lockScalingX = true;  // 鎖定縮放
          textObj.lockScalingY = true;
          textObj.lockRotation = true;  // 鎖定旋轉
          
          canvas.setActiveObject(textObj);
          textObj.enterEditing();
          textObj.selectAll();
        }
      }
  
      // 🔥 設定編輯模式標記
      (canvas as Canvas & { __mobileEditMode?: boolean }).__mobileEditMode = true;
  
      canvas.requestRenderAll();
      setMobileEditingLayerId(layerId);
      setSelectedLayerId(layerId);
      setSelectedLayerIds([layerId]);
  
      setTimeout(() => updateHistoryState(), 0);
    },
    [panelLayersTopToBottom]
  );
  
  // 退出手機編輯模式（完整修正版）
  const exitMobileEditMode = useCallback(() => {
    const api = fabricApiRef.current;
    if (!api) return;
  
    const canvas = api.getCanvas();
    if (!canvas) return;
  
    const currentLayerId = mobileEditingLayerId;
  
    // 🔥 如果是文字圖層，先退出編輯模式
    if (currentLayerId && api.isTextLayer?.(currentLayerId)) {
      const textObj = api.getTextObject?.(currentLayerId);
      const proxy = canvas.getObjects() .find(
        (o) => o.data?.proxyTag === `__proxy_${currentLayerId}`
      );
      
      if (textObj && proxy) {
        // 退出文字編輯
        if (textObj.isEditing) {
          textObj.exitEditing();
        }
        
        // 🔥 更新 proxy 尺寸（因為編輯可能改變了文字大小）
        const textWidth = textObj.width || 100;
        const textHeight = textObj.height || 50;
        proxy.set({
          left: textObj.left,
          top: textObj.top,
          width: textWidth,
          height: textHeight,
          scaleX: textObj.scaleX || 1,
          scaleY: textObj.scaleY || 1,
          angle: textObj.angle || 0,
        });
        proxy.setCoords();
      }
    }
  
    // 🔥 步驟 A: 解除專注模式標記
    api.setMobileFocusState(null);
    api.setHistoryIsolation(false);
  
    // 步驟 B: 還原 Viewport
    const backup = mobileBackupRef.current;
    if (backup) {
      canvas.setZoom(backup.zoom / 100);
      canvas.setViewportTransform(backup.viewport as TMat2D);
      mobileBackupRef.current = null;
    }
  
    // 步驟 C: 還原所有圖層可見性
    panelLayersTopToBottom.forEach((l) => {
      api.setVisible(l.id, l.visible);
    });
  
    api.setBackgroundVisible(baseVisible);
    api.toggleArtboard(true);
  
    // 🔥 解鎖所有物件：完全照備份還原
    (canvas.getObjects() as FabricObject[]).forEach((o) => {
      const fo = o as FabricObject;
      const data = fo.data as {
        __mobileBackup?: {
          selectable: boolean;
          evented: boolean;
          hasControls: boolean;
          hasBorders: boolean;
          hoverCursor: string;
        };
      };
  
      if (data?.__mobileBackup) {
        fo.selectable = data.__mobileBackup.selectable;
        fo.evented = data.__mobileBackup.evented;
        fo.hasControls = data.__mobileBackup.hasControls;
        fo.hasBorders = data.__mobileBackup.hasBorders;
        fo.hoverCursor = data.__mobileBackup.hoverCursor;
        fo.lockMovementX = false;
        fo.lockMovementY = false;
        
        // 🔥 如果是文字物件，還要解鎖縮放和旋轉
        if (fo.type === 'i-text') {
          fo.lockScalingX = false;
          fo.lockScalingY = false;
          fo.lockRotation = false;
        }
        
        delete data.__mobileBackup;
      }
    });
  
    // 🔥 如果退出的是文字圖層，確保文字物件恢復正常狀態（由 proxy 控制）
    if (currentLayerId && api.isTextLayer?.(currentLayerId)) {
      const textObj = api.getTextObject?.(currentLayerId);
      const proxy = canvas.getObjects() .find(
        (o) => o.data?.proxyTag === `__proxy_${currentLayerId}`
      );
      
      if (textObj && proxy) {
        // 文字物件恢復為不可選（由 proxy 控制）
        textObj.selectable = false;
        textObj.evented = false;
        textObj.editable = false;
        textObj.hasControls = false;
        textObj.hasBorders = false;
        
        // proxy 恢復可見
        proxy.visible = true;
        proxy.evented = true;
        proxy.selectable = true;
      }
    }
  
    setSelectedLayerId(null);
    setSelectedLayerIds([]);
    
    // 🔥 恢復選取
    canvas.selection = true;
    canvas.discardActiveObject();
  
    // 🔥 清除編輯模式標記
    (canvas as Canvas & { __mobileEditMode?: boolean }).__mobileEditMode = false;
  
    canvas.requestRenderAll();
    setMobileEditingLayerId(null);
    setTimeout(() => updateHistoryState(), 0);
    
    if (isMobileDrawingMode) {
      exitMobileDrawingMode();
    }
    
    // 🔥 重新選中圖層
    if (currentLayerId) {
      setTimeout(() => {
        selectLayer(currentLayerId);
      }, 100);
    }
  }, [
    panelLayersTopToBottom,
    baseVisible,
    isMobileDrawingMode,
    exitMobileDrawingMode,
    mobileEditingLayerId,
  ]);
  

  const handleBrushSizeChange = (size: number) => {
    setBrushSize(size);
    fabricApiRef.current?.setBrushSize?.(size);
  };

  const handleEraserSizeChange = (size: number) => {
    setEraserSize(size);
    fabricApiRef.current?.setEraserSize?.(size);
  };

  /* =======================
     模式切換
     ======================= */
  const handleModeChange = (nextMode: EditorMode | null) => {
    if (!nextMode) {
      setCurrentMode(null);
      setMobileEditingLayerId(null);
      exitMobileEditMode();
      return;
    }
    if (nextMode !== "EDIT") {
      fabricApiRef.current?.clearCurrentBrushStrokes?.();
    }
    if (!selectedLayerId && nextMode === "MERGE") {
      setCurrentMode(nextMode);
      return;
    }
    if (
      typeof window !== "undefined" &&
      window.innerWidth < 1024 &&
      selectedLayerId &&
      nextMode !== "MERGE"
    ) {
      enterMobileEditMode(selectedLayerId);
    }
    setCurrentMode(nextMode);
  };

  /* =======================
     dataURLToFile
     ======================= */
  function dataURLToFile(dataURL: string, filename: string) {
    const arr = dataURL.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] ?? "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  }

  const SERVER = process.env.NEXT_PUBLIC_SERVER_URL || "https://api.superstar-ai.xyz";

/* =======================
   🔥 核心修正：加字（含遮罩）— 完整邏輯
   ======================= */
   const handleAddTextWithAlpha = async (
    userPrompt: string,
    refImageName?: string
  ) => {
    // 1. 基本檢查
    if (selectedLayerIds.length !== 1) {
      alert(t("please_select_single_layer"));
      return;
    }
  
    const layerId = selectedLayerIds[0];
    const api = fabricApiRef.current;
    const canvas = api?.getCanvas();
  
    if (!api || !canvas) return;
  
    const obj = canvas.getActiveObject();
    const type = obj?.data?.type; // 'textbox' | 'image'
    const jobId = ObjectID().toHexString();
  
    // --- Helper Functions ---
    const toFile = (durl: string, filename: string) => {
      const arr = durl.split(",");
      const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    };
  
    const uploadOne = async (file: File): Promise<string> => {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch(`${SERVER}/image-processing/upload/custom`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(t("image_upload_failed"));
      const json = await res.json();
      if (!json.ok || !json.imageName) throw new Error(json.error || t("upload_failed"));
      return json.imageName;
    };
  
    try {
      // 2. 啟動 Job 狀態
      // api.saveHistory?.(); // 先存檔
      api.setLayerPending(layerId, true, jobId); // 設定圖層半透明等待
      api.startAIJob(layerId, jobId); // 註冊 Job
  
      let taskId: string;
  
      // 3. 準備圖片資源
      // ⭐️ 關鍵修正：使用 exportLayerCroppedPng 並帶入 { original: true }
      // 這樣可以拿到「裁切正確」但「沒有紅色遮罩」的乾淨底圖
      const cleanBasePng = await api.exportLayerCroppedPng(layerId, canvas, {
        original: true,
      });
  
      if (!cleanBasePng) throw new Error(t("export_base_image_failed"));
      const baseName = await uploadOne(toFile(cleanBasePng, "clean_base.png"));
  
      // 4. 根據圖層類型決定 API 路徑與參數
      if (type === "textbox") {
        // --- 文字特效流程 ---
        const payload = {
          uuid: ObjectID().toHexString(),
          original: baseName,
          prompt: userPrompt || "",
        };
  
        const res = await fetch(`${SERVER}/task/text-effect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // 確保帶有 session cookie
          body: JSON.stringify(payload),
        });
  
        if (!res.ok) throw new Error(t("submit_text_task_failed"));
        const result = await res.json();
        taskId = result.taskId;
  
      } else {
        // --- 圖片加字流程 (支援遮罩) ---
        
        // 嘗試取得遮罩 (如果有畫筆刷)
        const maskPng = await api.exportMaskPng(layerId, { nullIfEmpty: true });
        let maskName: string | undefined;
        
        if (maskPng) {
          maskName = await uploadOne(toFile(maskPng, "mask.png"));
        }
  
        const payload = {
          uuid: ObjectID().toHexString(),
          original: baseName, // 乾淨底圖
          prompt: userPrompt || "",
          reference: refImageName, // 參考圖 (可選)
          mask: maskName, // 遮罩圖 (可選)
        };
  
        const res = await fetch(`${SERVER}/task/add-text-masked`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
  
        if (!res.ok) throw new Error(t("submit_image_task_failed"));
        const result = await res.json();
        taskId = result.taskId;
      }
  
      if (!taskId) throw new Error(t("api_no_task_id"));
  
      // 5. 將 taskId 綁定到圖層 (方便追蹤)
      const imgObj = (canvas.getObjects() as FabricObject[]).find(
        (o) => (o as FabricObject)?.data?.id === layerId
      );
      if (imgObj) {
        (imgObj as FabricObject).data = {
          ...(imgObj as FabricObject).data,
          taskId,
        };
      }
      // 再次存檔以保存 taskId 狀態
      api.saveHistory?.();
  
      // 6. 監聽 SSE 等待結果
      const resultUrl = await waitForTaskFirstMediaUrl({
        taskId,
        userId: "guest",
        replayLimit: 5,
        failureMessage: t("ai_generation_failed"),
        interruptedMessage: t("connection_interrupted_sse"),
      });
  
      // 7. 檢查 Job 是否被使用者手動取消
      if (!api.isJobValid(jobId)) {
        console.log(`[AddText] Job ${jobId} 已被取消，忽略結果`);
        return;
      }
  
      // 8. 更新圖層圖片 (PreserveWorldSize 確保位置大小不跑掉)
      await api.setLayerImageFromUrlPreserveWorldSize(layerId, resultUrl, {
        resetMask: false, // 是否重置遮罩視需求而定，通常生成後不需要舊遮罩了
        jobId,
      });
  
      // 9. 完成與清理
      api.completeAIJob(jobId, true);
      api.setLayerPending(layerId, false);
  
      // 清除 taskId 綁定
      if (imgObj) delete imgObj.data?.taskId;
  
      // 替換歷史紀錄 (避免 Undo 時回到 Pending 狀態)
      //api.replaceCurrentHistory?.();
  
      // 重置工具狀態
      setSelectedTool(null);
      setBrushMode(false);
      setEraserMode(false);
      // setEraserAction("erase");
      
      // 呼叫 API 內部的清理
      api.exitDrawingMode?.(true); // true = 保持選取
      api.setBrushMode?.(false);
      api.setEraserMode?.(false);
      api.clearResidualDraw?.(); // 清除殘留的筆刷層
  
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "發生未知錯誤";
      alert(message);
  
      // 錯誤時的清理
      api.completeAIJob(jobId, false);
      api.setLayerPending(layerId, false);
  
      const imgObj = (canvas.getObjects() as FabricObject[]).find(
        (o) => (o as FabricObject)?.data?.id === layerId
      );
      if (imgObj) delete imgObj.data?.taskId;
  
      // 恢復歷史狀態 (可選)
      //api.saveHistory?.();
    }
  };

  /** ======================
   *  🔥 核心修正：動作（姿勢/視角/動作）— Pending 模式
   * ====================== */
  const handlePoseEditWithAlpha = async (
    userPrompt: string,
    referenceImageName?: string
  ) => {
    if (selectedLayerIds.length !== 1) {
      alert(t("please_select_single_layer"));
      return;
    }
    const layerId = selectedLayerIds[0];
    const api = fabricApiRef.current;
    if (!api) return;

    const jobId = ObjectID().toHexString();

    try {
      // 🔥 Step 1: 設置 Pending 狀態
      api.setLayerPending(layerId, true, jobId);
      api.startAIJob(layerId, jobId);

      const dataURL = await api.exportLayerAsAlphaPng(layerId);
      if (!dataURL) throw new Error(t("export_alpha_image_failed"));

      const toFile = (durl: string, filename: string) => {
        const [h, b] = durl.split(",");
        const mime = /:(.*?);/.exec(h)?.[1] || "image/png";
        const bin = atob(b);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return new File([u8], filename, { type: mime });
      };
      const file = toFile(dataURL, "layer.png");
      const form = new FormData();
      form.append("image", file);

      const up = await fetch(`${SERVER}/image-processing/upload/custom`, {
        method: "POST",
        body: form,
      });
      if (!up.ok) throw new Error(t("upload_failed"));
      const uj: { ok?: boolean; imageName?: string; error?: string } =
        await up.json();
      if (!uj?.ok || !uj?.imageName) throw new Error(uj?.error || t("upload_failed"));

      const payload: {
        uuid: string;
        original: string;
        prompt: string;
        reference?: string;
      } = {
        uuid: ObjectID().toHexString(),
        original: uj.imageName,
        prompt: userPrompt || "",
      };
      if (referenceImageName) payload.reference = referenceImageName;

      const add = await fetch(`${SERVER}/task/pose-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!add.ok) throw new Error(t("submit_task_failed"));
      const { taskId }: { taskId?: string } = await add.json();
      if (!taskId) throw new Error(t("missing_task_id"));

      // ✅ 存 taskId 到圖層
      const canvas = api.getCanvas();
      if (canvas) {
        const img = (canvas.getObjects() as FabricObject[]).find(
          (o) => (o as FabricObject)?.data?.id === layerId
        );
        if (img) {
          (img as FabricObject).data = {
            ...(img as FabricObject).data,
            taskId,
          };
        }
      }

      const resultUrl = await waitForTaskFirstMediaUrl({
        taskId,
        userId: "guest",
        replayLimit: 5,
        failureMessage: t("action_generation_failed"),
        interruptedMessage: t("sse_interrupted"),
      });

      // 🔥 Step 2: 檢查 job 是否仍然有效
      if (!api.isJobValid(jobId)) {
        console.log(
          `[PoseEdit] Job ${jobId} was cancelled, not applying result`
        );
        return;
      }

      // 🔥 Step 3: 任務完成，真正修改圖層
      await api.setLayerImageFromUrlMatchPixelDensity(layerId, resultUrl, {
        resetMask: true,
        jobId,
      });

      api.completeAIJob(jobId, true);
      api.setLayerPending(layerId, false);
      if (canvas) {
        const img = (canvas.getObjects() as FabricObject[]).find(
          (o) => (o as FabricObject)?.data?.id === layerId
        );
        if (img) {
          delete img.data?.taskId;
        }
      }
      api.saveHistory?.();
      setSelectedTool(null);
      setEraserMode(false);
      setBrushMode(false);
      api.setEraserMode?.(false);
      api.setBrushMode?.(false);
    } catch (err: unknown) {
      console.error(err);
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message?: unknown }).message ?? "")
          : "";
      alert(message || t("action_edit_error"));

      // 🔥 失敗時清除 pending 狀態
      api.completeAIJob(jobId, false);
      api.setLayerPending(layerId, false);
      // 🔥 新增：失敗時也清除 taskId
      const canvas = api.getCanvas();
      if (canvas) {
        const img = (canvas.getObjects() as FabricObject[]).find(
          (o) => (o as FabricObject)?.data?.id === layerId
        );
        if (img) {
          delete img.data?.taskId;
          console.log(`🧹 失敗時清除 taskId`);
        }
      }

      api.saveHistory?.(); // 🔥 存一次
    }
  };

  /* =======================
     ▶ 修正點 #1：合成結果保持原世界尺寸/位置
     ======================= */
  //   async function createSkeletonLayerAtOverallBounds(name = "合併結果") {
  //     const api = fabricApiRef.current;
  //     const canvas = api?.getCanvas();
  //     if (!api || !canvas) return null;

  //     const selected = api.getSelectedLayersTransform(selectedLayerIds) as
  //       | SelectedTransforms
  //       | [];
  //     if (!selected.length) return null;

  //     const overall = selected[0].overallBounds!;
  //     const { left, top, width, height } = overall;

  //     const add = await api.addImageLayer(emptyPng(), name);
  //     const objs = canvas.getObjects() as FabricObject[];
  //     const dst = objs.find((o) => (o as FabricObject)?.data?.id === add.id);
  //     if (!dst) return null;

  //     dst.set({ width: 1, height: 1 });

  //     const centerX = left + width / 2;
  //     const centerY = top + height / 2;

  //     dst.set({
  //       originX: "center",
  //       originY: "center",
  //       left: centerX,
  //       top: centerY,
  //       scaleX: Math.max(0.00001, width),
  //       scaleY: Math.max(0.00001, height),
  //       angle: 0,
  //       flipX: false,
  //       flipY: false,
  //     });
  //     (dst as FabricObject).setCoords?.();
  //     canvas.requestRenderAll();

  //     return { id: add.id };
  //   }

  //   async function createSkeletonLayerAtArtboardBounds(name = "合併結果") {
  //     const api = fabricApiRef.current;
  //     const canvas = api?.getCanvas();
  //     if (!api || !canvas) return null;

  //     const ab = api.getArtboardBounds?.();
  //     if (!ab || ab.width <= 0 || ab.height <= 0) return null;

  //     const { left, top, width, height } = ab;

  //     const add = await api.addImageLayer(emptyPng(), name);
  //     const objs = canvas.getObjects() as FabricObject[];
  //     const dst = objs.find((o) => (o as FabricObject)?.data?.id === add.id);
  //     if (!dst) return null;

  //     dst.set({ width: 1, height: 1 });

  //     const centerX = left + width / 2;
  //     const centerY = top + height / 2;

  //     dst.set({
  //       originX: "center",
  //       originY: "center",
  //       left: centerX,
  //       top: centerY,
  //       scaleX: Math.max(0.00001, width),
  //       scaleY: Math.max(0.00001, height),
  //       angle: 0,
  //       flipX: false,
  //       flipY: false,
  //     });
  //     (dst as FabricObject).setCoords?.();
  //     canvas.requestRenderAll();

  //     return { id: add.id };
  //   }

  // 直接用 convertToCompositorFormatCrop 的回傳放回去（世界框 = content + padding）
  async function renderCompositeBack(
    imgSrc: string,
    compositorData: ConvertResult
  ) {
    const api = fabricApiRef.current;
    const canvas = api?.getCanvas();
    if (!api || !canvas) return null;

    const wf = compositorData.worldFrame;
    const os = compositorData.outputSize;
    if (!wf || !os) return null;

    const worldW = os.width;
    const worldH = os.height;
    const contentW = os.contentWidth;
    const contentH = os.contentHeight;
    const padding = wf.padding;
    const contentLeft = wf.contentLeft;
    const contentTop = wf.contentTop;

    const worldAnchorLeft = contentLeft - padding;
    const worldAnchorTop = contentTop - padding;
    const contentAnchorLeft = contentLeft;
    const contentAnchorTop = contentTop;

    const added = await api.addImageLayer(imgSrc);
    const obj = (canvas.getObjects() as FabricObject[]).find(
      (o) => (o as FabricObject)?.data?.id === added.id
    ) as FabricImage | undefined;
    if (!obj) return null;

    // 清 processing overlay 這段我不動
    (canvas.getObjects() as FabricObject[])
      .filter((o) => (o as FabricObject).data?.processingOverlay)
      .forEach((o) => canvas.remove(o));
    const cAny = canvas as unknown as {
      __procCleanup?: () => void;
      __procProxy?: Group | null;
      __procSpinRaf?: number | null;
    };
    try {
      cAny.__procCleanup?.();
    } catch {}
    if (cAny.__procProxy && canvas.getObjects().includes(cAny.__procProxy)) {
      canvas.remove(cAny.__procProxy);
    }
    cAny.__procProxy = null;
    cAny.__procSpinRaf = null;

    await new Promise<void>((resolve) => {
      const tick = () => {
        const el = obj.getElement() as HTMLImageElement | undefined;
        const pxW = el?.naturalWidth || obj.width || 0;
        const pxH = el?.naturalHeight || obj.height || 0;
        if (pxW > 0 && pxH > 0) {
          const near = (a: number, b: number, tol = 1) =>
            Math.abs(a - b) <= tol;

          let targetLeft = worldAnchorLeft;
          let targetTop = worldAnchorTop;
          let targetW = worldW;
          let targetH = worldH;
          let scaleX = 1,
            scaleY = 1;

          if (near(pxW, worldW) && near(pxH, worldH)) {
            scaleX = worldW / pxW;
            scaleY = worldH / pxH;
            targetLeft = worldAnchorLeft;
            targetTop = worldAnchorTop;
            targetW = worldW;
            targetH = worldH;
          } else if (near(pxW, contentW) && near(pxH, contentH)) {
            scaleX = contentW / pxW;
            scaleY = contentH / pxH;
            targetLeft = contentAnchorLeft;
            targetTop = contentAnchorTop;
            targetW = contentW;
            targetH = contentH;
          } else {
            const sxW = worldW / pxW,
              syW = worldH / pxH;
            const sxC = contentW / pxW,
              syC = contentH / pxH;
            if (Math.abs(sxC - syC) <= Math.abs(sxW - syW)) {
              scaleX = sxC;
              scaleY = syC;
              targetLeft = contentAnchorLeft;
              targetTop = contentAnchorTop;
              targetW = contentW;
              targetH = contentH;
            } else {
              scaleX = sxW;
              scaleY = syW;
              targetLeft = worldAnchorLeft;
              targetTop = worldAnchorTop;
              targetW = worldW;
              targetH = worldH;
            }
          }

          const centerLeft = targetLeft + targetW / 2;
          const centerTop = targetTop + targetH / 2;

          obj.objectCaching = false;
          (obj as FabricObject).noScaleCache = true;

          obj.set({
            originX: "center",
            originY: "center",
            angle: 0,
            flipX: false,
            flipY: false,
            scaleX,
            scaleY,
            left: centerLeft,
            top: centerTop,
            visible: true,
            opacity: 1,
          });

          if (obj.clipPath) obj.clipPath = undefined;
          obj.setCoords?.();

          const proxyTag = `__proxy_${added.id}`;
          let proxy = (canvas.getObjects() as FabricObject[]).find(
            (o) => (o as FabricObject).data?.proxyTag === proxyTag
          ) as Rect | undefined;

          if (!proxy) {
            proxy = api.ensureProxyRect?.(canvas, obj) as Rect | undefined;
            if (proxy) {
              (proxy as FabricObject).data = {
                ...(proxy as FabricObject).data,
                proxyTag,
              };
            }
          }

          if (proxy) {
            proxy.set({
              originX: "center",
              originY: "center",
              left: centerLeft,
              top: centerTop,
              width: Math.max(1, obj.getScaledWidth()),
              height: Math.max(1, obj.getScaledHeight()),
              angle: 0,
            });
            proxy.setCoords();

            (obj as FabricObject).data = {
              ...(obj as FabricObject).data,
              frame: {
                w: proxy.width,
                h: proxy.height,
                left: proxy.left,
                top: proxy.top,
                angle: proxy.angle || 0,
              },
            };
            requestAnimationFrame(() => {
              canvas.requestRenderAll();
              api.saveHistory();
              
              // 🔥 設為選中狀態
              // if (proxy) {
              //   canvas.setActiveObject(proxy);
              //   canvas.requestRenderAll();
              // }
            });
          }

          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      tick();
    });

    return { id: added.id };
  }

  // 🔥 核心修正：多圖合併 — Pending 模式
  const handleComposeMerge = async (userPrompt: string) => {
    const api = fabricApiRef.current;
    const canvas = api?.getCanvas();
    if (!api || !canvas) return;

    const hasSelection = selectedLayerIds.length >= 2;

    const stackBottomToTop = panelLayersTopToBottom
      .filter((l) => l.visible && l.id !== BASE_ID)
      .slice()
      .reverse();

    const rawIds: string[] = hasSelection
      ? selectedLayerIds.slice()
      : stackBottomToTop.map((l) => l.id);

    if (rawIds.length < 2) {
      alert(
        hasSelection ? t("need_at_least_2_layers_to_merge") : t("canvas_mode_need_2_visible_layers")
      );
      return;
    }

    const orderIndex = new Map(stackBottomToTop.map((l, i) => [l.id, i]));
    const orderedIds = rawIds
      .filter((id) => orderIndex.has(id))
      .sort((a, b) => orderIndex.get(a)! - orderIndex.get(b)!);

    const jobId = ObjectID().toHexString();

    try {
      // 🔥 Step 1: 設置所有圖層為 Pending（但不修改）
      api.setLayerProcessing(orderedIds, true);
      orderedIds.forEach((id) => {
        api.startAIJob(id, jobId);
      });

      const toFile = (durl: string, filename: string) => {
        const [h, b] = durl.split(",");
        const mime = /:(.*?);/.exec(h)?.[1] || "image/png";
        const bin = atob(b);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return new File([u8], filename, { type: mime });
      };
      const uploadOne = async (durl: string) => {
        const form = new FormData();
        form.append("image", toFile(durl, "layer.png"));
        const up = await fetch(`${SERVER}/image-processing/upload/custom`, {
          method: "POST",
          body: form,
        });
        if (!up.ok) throw new Error(t("upload_failed"));
        const uj = (await up.json()) as {
          ok?: boolean;
          imageName?: string;
          error?: string;
        };
        if (!uj?.ok || !uj?.imageName) throw new Error(uj?.error || t("upload_failed"));
        return uj.imageName!;
      };

      const dataURLs = await Promise.all(
        orderedIds.map((id) => api.exportLayerCroppedPng(id, canvas))
      );
      if (dataURLs.some((x) => !x)) throw new Error(t("export_layers_failed"));

      const uploadedNames = await Promise.all(
        dataURLs.map((d) => uploadOne(d!))
      );

      const transforms = api.getSelectedLayersTransform(orderedIds) as
        | SelectedTransforms
        | [];
      if (!transforms.length) throw new Error(t("no_convertible_layers"));

      const artboard = api.getArtboardBounds?.() || null;
      const compositorData = convertToCompositorFormatCrop(
        transforms,
        100,
        hasSelection ? null : artboard
      );

      const payload = {
        uuid: ObjectID().toHexString(),
        images: uploadedNames,
        prompt: userPrompt || "",
        compositorData: compositorData.fabricDataJson,
        mode: "MERGE",
        layerMapping: compositorData.layerMapping,
        selectedLayers: transforms.map((l, index) => {
          const obj = (canvas.getObjects() as FabricObject[]).find(
            (o) => (o as FabricObject)?.data?.id === l.id
          );
          const objData = (obj as FabricObject)?.data;
          
          return { 
            id: l.id, 
            name: l.name,
            type: objData?.originalType || obj?.type || 'image',
            imageName: uploadedNames[index],
            index
          };
        }),     };

      const add = await fetch(`${SERVER}/task/compose-merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!add.ok) throw new Error(t("submit_task_failed"));
      const { taskId } = (await add.json()) as { taskId?: string };
      if (!taskId) throw new Error(t("missing_task_id"));

      // ✅ 存 taskId 到所有參與圖層
      orderedIds.forEach((layerId) => {
        const img = (canvas.getObjects() as FabricObject[]).find(
          (o) => (o as FabricObject)?.data?.id === layerId
        );
        if (img) {
          (img as FabricObject).data = {
            ...(img as FabricObject).data,
            taskId,
            mergeCompositorData: compositorData,
          };
        }
        api.setLayerPending(layerId, true, jobId);  // 🔥 設定 isPending
      });
      
      api.saveHistory?.(); 

      const resultUrl = await waitForTaskFirstMediaUrl({
        taskId,
        userId: "guest",
        replayLimit: 10,
        failureMessage: t("merge_failed"),
        interruptedMessage: t("sse_interrupted"),
      });

      // 🔥 Step 2: 檢查 job 是否仍然有效
      if (!api.isJobValid(jobId)) {
        console.log(
          `[ComposeMerge] Job ${jobId} was cancelled, not applying result`
        );
        return;
      }

      // 🔥 Step 3: 任務完成，創建新圖層
      //   const skeleton = hasSelection
      //     ? await createSkeletonLayerAtOverallBounds("合併結果")
      //     : await createSkeletonLayerAtArtboardBounds("合併結果");
      //   if (!skeleton) throw new Error("建立合併骨架圖層失敗");
      const transformsFinish = api.getSelectedLayersTransform(orderedIds) as
        | SelectedTransforms
        | [];
      if (!transformsFinish.length) throw new Error(t("no_convertible_layers"));

      const artboardFinish = api.getArtboardBounds?.() || null;

      // 注意：hasSelection 表示「用 selection 還是 artboard」；跟你前面一致
      const compositorDataFinish = convertToCompositorFormatCrop(
        transformsFinish,
        100,
        hasSelection ? null : artboardFinish
      );

      // 直接按照 convertToCompositorFormatCrop 的 worldFrame/outputSize 回貼
      const skeleton = await renderCompositeBack(
        resultUrl,
        compositorDataFinish
      );
      if (!skeleton || !skeleton.id) throw new Error(t("create_merge_layer_failed"));

      // ✅ 新圖層也存同樣的 taskId
      const newLayer = (canvas.getObjects() as FabricObject[]).find(
        (o) => (o as FabricObject)?.data?.id === skeleton.id
      );
      if (newLayer) {
        (newLayer as FabricObject).data = {
          ...(newLayer as FabricObject).data,
          taskId,
        };
      }

      console.log(skeleton);
      //   await api.setLayerImageFromUrlPreserveWorldSize(skeleton.id, resultUrl, {
      //     resetMask: true,
      //     jobId,
      //   });

      orderedIds.forEach(() => {
        api.completeAIJob(jobId, true);
      });
      if (canvas) {
        orderedIds.forEach((layerId) => {
          api.setLayerPending(layerId, false);  // 🔥 加這行：解除 pending，恢復 opacity
          const img = (canvas.getObjects() as FabricObject[]).find(
            (o) => (o as FabricObject)?.data?.id === layerId
          );
          if (img) {
            delete img.data?.taskId;
            delete img.data?.mergeCompositorData;  // 🔥 順便清掉這個
          }
        });
      }
      api.replaceCurrentHistory?.();
      api.setActive?.(skeleton.id);
      setSelectedLayerId(skeleton.id);
      setSelectedLayerIds([skeleton.id]);
      updateHistoryState();
    } catch (err) {
      console.error("❌ 合併錯誤:", err);
      alert(err instanceof Error ? err.message : t("merge_error"));

      // 🔥 失敗時清除 pending 狀態
      // 🔥 失敗時清除 pending 狀態
      orderedIds.forEach(() => {
        api.completeAIJob(jobId, false);
      });
      if (canvas) {
        orderedIds.forEach((layerId) => {
          const img = (canvas.getObjects() as FabricObject[]).find(
            (o) => (o as FabricObject)?.data?.id === layerId
          );
          api.setLayerPending(layerId, false); 
          if (img) {
            
            delete img.data?.taskId;
          }
        });
      }
      api.saveHistory?.();
    } finally {
      try {
        api?.setLayerProcessing?.(orderedIds, false);
      } catch {}
    }
  };

  /* =======================
     🔥 核心修正：去背 — Pending 模式
     ======================= */
  const handleBackgroundRemove = async () => {
    if (selectedLayerIds.length !== 1) return;

    const layerId = selectedLayerIds[0];
    const api = fabricApiRef.current;
    if (!api) return;

    const jobId = ObjectID().toHexString();

    try {
      // 🔥 Step 1: 設置 Pending 狀態
      api.setLayerPending(layerId, true, jobId);
      api.startAIJob(layerId, jobId);

      const composited = api.exportLayerAsAlphaPng
        ? await api.exportLayerAsAlphaPng(layerId)
        : null;

      if (
        typeof composited !== "string" ||
        !composited.startsWith("data:image")
      ) {
        throw new Error(
          t("read_layer_image_failed")
        );
      }

      const file = dataURLToFile(composited, "layer.png");
      const form = new FormData();
      form.append("image", file);

      const up = await fetch(`${SERVER}/image-processing/upload`, {
        method: "POST",
        body: form,
      });
      if (!up.ok) throw new Error(t("upload_failed"));
      const uj: { ok?: boolean; imageName?: string; error?: string } =
        await up.json();
      if (!uj?.ok || !uj?.imageName) throw new Error(uj?.error || t("upload_failed"));
      const imageName: string = uj.imageName;

      const add = await fetch(`${SERVER}/task/removeBG`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "EDIT",
          op: "BACKGROUND_REMOVAL",
          images: [imageName],
          uuid: ObjectID().toHexString(),
        }),
      });
      if (!add.ok) throw new Error(t("submit_task_failed"));
      const { taskId }: { taskId?: string } = await add.json();
      if (!taskId) throw new Error(t("missing_task_id"));

      const cutoutUrl = await waitForTaskFirstMediaUrl({
        taskId,
        userId: "guest",
        replayLimit: 5,
        failureMessage: t("background_removal_failed"),
        interruptedMessage: t("sse_connection_interrupted"),
      });

      // 🔥 Step 2: 檢查 job 是否仍然有效
      if (!api.isJobValid(jobId)) {
        console.log(
          `[RemoveBG] Job ${jobId} was cancelled, not applying result`
        );
        return;
      }

      // 🔥 Step 3: 任務完成，應用遮罩
      if (!(api as FabricEditorHandle).initMaskFromAlphaCutout) {
        throw new Error(
          t("missing_init_mask_from_alpha_cutout")
        );
      }
      await (api as FabricEditorHandle).initMaskFromAlphaCutout(
        layerId,
        cutoutUrl,
        jobId
      );

      api.completeAIJob(jobId, true);
      api.setLayerPending(layerId, false);

      setSelectedTool("eraser");
      setEraserAction("restore");
      api.setEraserMode?.(true);
      api.setEraserAction?.("restore");
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : t("background_removal_error"));

      // 🔥 失敗時清除 pending 狀態
      api.completeAIJob(jobId, false);
      api.setLayerPending(layerId, false);
    }
  };

    /* =======================
     放大圖片
     ======================= */
     const handleUpscaleImage = async (resolution: "2k" | "4k") => {
      if (selectedLayerIds.length !== 1) return;
  
      const layerId = selectedLayerIds[0];
      const api = fabricApiRef.current;
      if (!api) return;
  
      const jobId = ObjectID().toHexString();
  
      try {
        // 🔥 Step 1: 設置 Pending 狀態
        api.setLayerPending(layerId, true, jobId);
        api.startAIJob(layerId, jobId);
  
        const composited = api.exportLayerAsAlphaPng
          ? await api.exportLayerAsAlphaPng(layerId)
          : null;
  
        if (
          typeof composited !== "string" ||
          !composited.startsWith("data:image")
        ) {
          throw new Error(
            t("read_layer_image_failed")
          );
        }
  
        const file = dataURLToFile(composited, "layer.png");
        const form = new FormData();
        form.append("image", file);
  
        const up = await fetch(`${SERVER}/image-processing/upload`, {
          method: "POST",
          body: form,
        });
        if (!up.ok) throw new Error(t("upload_failed"));
        const uj: { ok?: boolean; imageName?: string; error?: string } =
          await up.json();
        if (!uj?.ok || !uj?.imageName) throw new Error(uj?.error || t("upload_failed"));
        const imageName: string = uj.imageName;
  
        const add = await fetch(`${SERVER}/task/image-upscale`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            resolution,
            original: imageName,
            uuid: ObjectID().toHexString(),
          }),
        });
        if (!add.ok) throw new Error(t("submit_task_failed"));
        const { taskId }: { taskId?: string } = await add.json();
        if (!taskId) throw new Error(t("missing_task_id"));
  
        const cutoutUrl = await waitForTaskFirstMediaUrl({
          taskId,
          userId: "guest",
          replayLimit: 5,
          failureMessage: t("upscale_failed"),
          interruptedMessage: t("sse_connection_interrupted"),
        });
  
        // 🔥 Step 2: 檢查 job 是否仍然有效
        if (!api.isJobValid(jobId)) {
          console.log(
            `[RemoveBG] Job ${jobId} was cancelled, not applying result`
          );
          return;
        }
  
        // 🔥 Step 3: 任務完成，應用遮罩
        if (!(api as FabricEditorHandle).initMaskFromAlphaCutout) {
          throw new Error(
            t("missing_init_mask_from_alpha_cutout")
          );
        }
        await api.setLayerImageFromUrlWithUpscale(layerId, cutoutUrl, { jobId });
  
 
        api.completeAIJob(jobId, true);
        api.setLayerPending(layerId, false);
  
 
      } catch (err: unknown) {
        console.error(err);
        alert(err instanceof Error ? err.message : t("upscale_error"));
  
        // 🔥 失敗時清除 pending 狀態
        api.completeAIJob(jobId, false);
        api.setLayerPending(layerId, false);
      }
    };

    
  /* =======================
     🔥 核心修正：分割 — Pending 模式
     ======================= */
  async function createSkeletonLayerFrom(
    srcLayerId: string,
    name = "分割圖層"
  ): Promise<string | null> {
    const api = fabricApiRef.current;
    const canvas = api?.getCanvas();
    if (!api || !canvas) return null;

    const objs = canvas.getObjects() as FabricObject[];
    const src = objs.find(
      (o) => (o as FabricObject)?.data?.id === srcLayerId
    ) as FabricObject;
    if (!src) return null;

    const left = src.left ?? 0;
    const top = src.top ?? 0;
    const originX = src.originX ?? "center";
    const originY = src.originY ?? "center";
    const angle = src.angle ?? 0;
    const flipX = !!src.flipX;
    const flipY = !!src.flipY;
    const worldW = (src.width ?? 0) * (src.scaleX ?? 1);
    const worldH = (src.height ?? 0) * (src.scaleY ?? 1);

    const { id: newId } = await api.addImageLayer(emptyPng(), name);

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const objs2 = canvas.getObjects() as FabricObject[];
    const dst = objs2.find(
      (o) => (o as FabricObject)?.data?.id === newId
    ) as FabricObject;
    if (!dst) return null;

    dst.set({ width: 1, height: 1 });
    const newScaleX = worldW / 1;
    const newScaleY = worldH / 1;

    dst.set({
      scaleX: newScaleX,
      scaleY: newScaleY,
      left,
      top,
      originX,
      originY,
      angle,
      flipX,
      flipY,
      opacity: 1, // 🔥 確保透明度是 1
    });
    dst.setCoords?.();

    const proxyTag = `__proxy_${newId}`;
    const proxy = canvas
      .getObjects()
      .find((o) => (o as FabricObject).data?.proxyTag === proxyTag) as
      | fabric.Rect
      | undefined;

    if (proxy) {
      proxy.set({
        left,
        top,
        originX: originX as string,
        originY: originY as string,
        angle,
        width: worldW,
        height: worldH,
        scaleX: 1,
        scaleY: 1,
      });
      proxy.setCoords?.();

      // 🔥 關鍵：更新 data.frame
      const fabricDst = dst as FabricImage;
      if (!fabricDst.data) {
        fabricDst.data = {};
      }
      fabricDst.data.frame = {
        w: worldW,
        h: worldH,
        left: left,
        top: top,
        angle: angle,
      };

      // 🔥 關鍵：更新 clipPath
      if (dst.clipPath) {
        const mask = dst.clipPath;
        mask.set({
          left: left,
          top: top,
          width: worldW,
          height: worldH,
          angle: angle,
          originX: "center",
          originY: "center",
          absolutePositioned: true,
        });
        mask.setCoords?.();
      }
    }

    canvas.requestRenderAll();

    // 🔥 關鍵：儲存 history
    api.saveHistory();

    return newId;
  }

  const spawnRevealableCutout = async (
    srcLayerId: string,
    cutoutUrl: string,
    namePrefix = "Cutout",
    jobId: string
  ): Promise<{ topWorkingId: string } | null> => {
    const api = fabricApiRef.current;
    if (!api) return null;

    // 🔥 檢查 job 是否仍然有效
    if (!api.isJobValid(jobId)) {
      console.log(
        `[spawnRevealableCutout] Job ${jobId} was cancelled, skipping`
      );
      return null;
    }

    const topId =
      (await createSkeletonLayerFrom(
        srcLayerId,
        `${namePrefix} • 可還原編輯`
      )) || "";
    if (!topId) return null;

    const baseURL = (await api.exportLayerAsAlphaPng(srcLayerId)) || "";

    await api.setLayerImageFromUrlPreserveWorldSize(topId, baseURL, {
      resetMask: true,
    });

    await api.initMaskFromAlphaCutout(topId, cutoutUrl, jobId);
    api.setVisible?.(srcLayerId, false);

    return { topWorkingId: topId };
  };

  const handleLayerSeparation = async () => {
    if (selectedLayerIds.length !== 1) {
      alert(t("please_select_single_layer_for_split"));
      return;
    }
    const layerId = selectedLayerIds[0];
    const api = fabricApiRef.current;
    if (!api) return;

    const jobId = ObjectID().toHexString();

    try {
      // 🔥 Step 1: 設置 Pending 狀態
      api.setLayerPending(layerId, true, jobId);
      api.startAIJob(layerId, jobId);

      const composited = await api.exportLayerAsAlphaPng(layerId);
      if (!composited) throw new Error(t("read_layer_pixels_failed"));

      const dataURLToFileLocal = (durl: string, filename: string) => {
        const arr = durl.split(",");
        const mime = arr[0].match(/:(.*?);/)?.[1] ?? "image/png";
        const bstr = atob(arr[1]);
        const u8 = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
        return new File([u8], filename, { type: mime });
      };

      const file = dataURLToFileLocal(composited, "layer.png");
      const form = new FormData();
      form.append("image", file);
      const up = await fetch(`${SERVER}/image-processing/upload/custom`, {
        method: "POST",
        body: form,
      });
      if (!up.ok) throw new Error(t("upload_failed"));
      const uj: { ok?: boolean; imageName?: string; error?: string } =
        await up.json();
      if (!uj?.ok || !uj?.imageName) throw new Error(uj?.error || t("upload_failed"));
      const imageName: string = uj.imageName;

      const add = await fetch(`${SERVER}/task/splitBG`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "EDIT",
          op: "LAYER_SPLIT",
          images: [imageName],
          uuid: ObjectID().toHexString(),
        }),
      });
      if (!add.ok) throw new Error(t("submit_task_failed"));
      const { taskId }: { taskId?: string } = await add.json();
      if (!taskId) throw new Error(t("missing_task_id"));

      const createdTopIds: string[] = [];

        const seen = new Set<string>();
        const labelCount = new Map<string, number>();

        const toKey = (it: SplitSSEItem): string => {
          const obj = it as Record<string, unknown>;
          if (typeof obj.shortId === "string") return `sid:${obj.shortId}`;
          if (typeof obj.id === "string") return `id:${obj.id}`;
          if (
            typeof obj.subfolder === "string" &&
            typeof obj.filename === "string" &&
            typeof obj.type === "string"
          ) {
            return `sf:${obj.subfolder}|fn:${obj.filename}|ty:${obj.type}`;
          }
          if (typeof obj.s3_url === "string") return `s3:${obj.s3_url}`;
          if (typeof obj.url === "string") return `url:${obj.url}`;
          try {
            return JSON.stringify(obj);
          } catch {
            return "[unknown]";
          }
        };

        const handleBatch = async (list: unknown) => {
          if (!Array.isArray(list) || !list.length) return;

          // 🔥 檢查 job 是否仍然有效
          if (!api.isJobValid(jobId)) {
            console.log(
              `[LayerSeparation] Job ${jobId} was cancelled, stopping batch processing`
            );
            throw new Error("Job was cancelled");
            return;
          }

          const fresh = list.filter((it) => {
            const key = toKey(it as SplitSSEItem);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          if (fresh.length === 0) return;

          for (const item of fresh) {
            const obj = item as Record<string, unknown>;
            const imageUrl =
              (typeof obj.url === "string" && obj.url) ||
              (typeof obj.s3_url === "string" && obj.s3_url) ||
              undefined;
            if (!imageUrl) continue;

            const baseLabel =
              (typeof obj.label === "string" && obj.label) ||
              (typeof obj.name === "string" && obj.name) ||
              "part";
            const idx = (labelCount.get(baseLabel) ?? 0) + 1;
            labelCount.set(baseLabel, idx);

            const res = await spawnRevealableCutout(
              layerId,
              imageUrl,
              `Split: ${baseLabel} #${idx}`,
              jobId
            );
            if (!res) continue;
            createdTopIds.push(res.topWorkingId);
          }

          try {
            api.setLayerPending(layerId, true, jobId);
          } catch {}
        };

        await waitForTaskSuccess({
          taskId,
          userId: "guest",
          replayLimit: 50,
          failureMessage: "分割失敗",
          interruptedMessage: t("sse_connection_interrupted"),
          onPayload: async (data) => {
            const payload = data as {
              publishedImages?: SplitSSEItem[];
            };

            if (Array.isArray(payload.publishedImages)) {
              await handleBatch(payload.publishedImages);
            }
          },
        });

      

      // 🔥 Step 2: 任務完成
      api.completeAIJob(jobId, true);
      api.setLayerPending(layerId, false);
      api.setVisible?.(layerId, false);

      if (createdTopIds.length > 0) {
        api.setActive?.(createdTopIds[0]);
        setSelectedTool("eraser");
        setEraserAction("restore");
        api.setEraserMode?.(true);
        api.setEraserAction?.("restore");
      }
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : t("layer_split_error"));

      // 🔥 失敗時清除 pending 狀態
      api.completeAIJob(jobId, false);
      api.setLayerPending(layerId, false);
    }
  };

  /* =======================
     工具狀態同步
     ======================= */
  useEffect(() => {
    if (selectedTool === "brush") {
      updateBrushMode("brush", selectedLayerId);
    } else if (selectedTool === "eraser") {
      updateEraserMode("eraser", selectedLayerId);
    } else {
      if (brushMode) updateBrushMode(null, null);
      if (eraserMode) updateEraserMode(null, null);
    }
  }, [selectedTool, selectedLayerId]);

  /* =======================
     快捷鍵刪除圖層
     ======================= */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        !target ||
        /^input|textarea$/i.test(target.tagName) ||
        target.isContentEditable;
      if (isEditable) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedLayerIds.length > 0) {
          e.preventDefault();
          const ids = [...selectedLayerIds];
          ids.forEach((id) => deleteLayer(id));
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedLayerIds, selectedLayerId, panelLayersTopToBottom]);

  /* =======================
     多選操作歷史點補齊
     ======================= */
  useEffect(() => {
    const api = fabricApiRef.current;
    const cnv = api?.getCanvas();
    if (!api || !cnv) return;

    const onModified = (e: unknown) => {
      const t = (e as { target?: unknown })?.target as
        | (FabricObject & { type?: string; _objects?: unknown[] })
        | undefined;
      if (
        t &&
        (t.type === "activeSelection" ||
          Array.isArray(
            (
              t as {
                type?: string;
                _objects?: unknown[];
              }
            )?._objects
          ))
      ) {
        api.saveHistory?.();
        updateHistoryState();
      }
    };

    const onMouseUp = () => {
      const active = (cnv as Canvas)?.getActiveObject?.() as
        | { type?: string }
        | undefined;
      if (active && active.type === "activeSelection") {
        api.saveHistory?.();
        updateHistoryState();
      }
    };

    (cnv as Canvas).on("object:modified", onModified);
    (cnv as Canvas).on("mouse:up", onMouseUp);

    return () => {
      try {
        (cnv as Canvas).off("object:modified", onModified);
        (cnv as Canvas).off("mouse:up", onMouseUp);
      } catch {}
    };
  }, [fabricApiRef.current]);

/* =======================
     Render
     ======================= */
     return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-0 ">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          // 🔥🔥 修正 1：主容器背景改回 custom-white (白底)，避免整片紫 🔥🔥
          className="w-full h-full bg-custom-white dark:bg-[#23292f87] md:rounded-2xl shadow-2xl flex overflow-hidden text-custom-black dark:text-custom-white"
        >
          <div className="flex-1 flex flex-col">
            {/* Header */}
            {mobileEditingLayerId ? (
              // 🔥 手機編輯模式標題列
              // 🔥🔥 修正 2：Header 使用 custom-light-purple/30 (淡紫)，與白底區隔 🔥🔥
              <div className="lg:hidden flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-custom-black/5 dark:border-white/5 bg-custom-light-purple/30 dark:bg-black/20">
                <button
                  onClick={exitMobileEditMode}
                  className="flex items-center gap-2 text-custom-black dark:text-custom-white hover:text-custom-logo-purple transition-colors"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  <span
                    className="text-sm"
                    onClick={() => {
                      handleModeChange(null);
                    }}
                  >
                    {t("back")}
                  </span>
                </button>
                <span className="text-sm font-medium text-custom-black dark:text-custom-white">{t("edit_image")}</span>
                <div>
                  <button
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className="p-2 hover:bg-custom-white/50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed text-custom-black dark:text-custom-white"
                    title={t("undo")}
                    aria-label={t("undo")}
                  >
                    <Undo2 size={18} />
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className="p-2 hover:bg-custom-white/50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed text-custom-black dark:text-custom-white"
                    title={t("redo")}
                    aria-label={t("redo")}
                  >
                    <Redo2 size={18} />
                  </button>
                </div>
              </div>
            ) : (
              // 🔥 桌機版 Header
              // 🔥🔥 修正 2：Header 使用 custom-light-purple/30 (淡紫) 🔥🔥
              <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-custom-black/5 dark:border-white/5 bg-custom-light-purple/30 dark:bg-black/20">
                <div className="flex items-center gap-3">
                  <h2 className="hidden md:flex text-lg md:text-xl font-bold text-custom-black dark:text-custom-white items-center gap-2">
                    <Sparkles className="text-custom-logo-purple" size={20} />
                    {t("ai_image_editor")}
                  </h2>
                  <span className="text-custom-black/40 dark:text-custom-white/40 text-xs font-medium">BETA</span>
                  <Sparkles className="md:hidden text-custom-logo-purple" size={24} />
    
                  {/* 畫布尺寸下拉 */}
                  <ArtboardPanel
                    open={isArtboardPanelOpen}
                    onOpenChange={setIsArtboardPanelOpen}
                    current={getCurrentArtboardSize()}
                    onApply={(p) => {
                      fabricApiRef.current?.setArtboardSize(p.width, p.height);
                    }}
                  />
                </div>
    
                <div className="flex items-center gap-2">
                  <div className="hidden lg:flex items-center gap-2">
                    <button
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className="p-2 hover:bg-custom-white/50 dark:hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed text-custom-black dark:text-custom-white"
                      title={t("undo")}
                      aria-label={t("undo")}
                    >
                      <Undo2 size={18} />
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={!canRedo}
                      className="p-2 hover:bg-custom-white/50 dark:hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed text-custom-black dark:text-custom-white"
                      title={t("redo")}
                      aria-label={t("redo")}
                    >
                      <Redo2 size={18} />
                    </button>
    
                    <div className="w-px h-6 bg-custom-black/10 dark:bg-white/10 mx-1" />
    
                    <button
                      onClick={handleZoomOut}
                      className="p-2 hover:bg-custom-white/50 dark:hover:bg-white/10 rounded-lg text-custom-black dark:text-custom-white"
                      title={t("zoom_out")}
                      aria-label={t("zoom_out")}
                    >
                      <ZoomOut size={18} />
                    </button>
                    <span className="text-sm font-medium min-w-[3rem] text-center text-custom-black dark:text-custom-white">
                      {zoom}%
                    </span>
                    <button
                      onClick={handleZoomIn}
                      className="p-2 hover:bg-custom-white/50 dark:hover:bg-white/10 rounded-lg text-custom-black dark:text-custom-white"
                      title={t("zoom_in")}
                      aria-label={t("zoom_in")}
                    >
                      <ZoomIn size={18} />
                    </button>
                    <button
                      onClick={handleResetView}
                      className="p-2 hover:bg-custom-white/50 dark:hover:bg-white/10 rounded-lg text-custom-black dark:text-custom-white"
                      title={t("reset_view")}
                      aria-label={t("reset_view")}
                    >
                      <Maximize2 size={18} />
                    </button>
                  </div>
    
                  <div className="flex lg:hidden items-center gap-1">
                    <button
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className="p-2 hover:bg-custom-white/50 dark:hover:bg-white/10 rounded-lg disabled:opacity-30 text-custom-black dark:text-custom-white"
                      title={t("undo")}
                      aria-label={t("undo")}
                    >
                      <Undo2 size={16} />
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={!canRedo}
                      className="p-2 hover:bg-custom-white/50 dark:hover:bg-white/10 rounded-lg disabled:opacity-30 text-custom-black dark:text-custom-white"
                      title={t("redo")}
                      aria-label={t("redo")}
                    >
                      <Redo2 size={16} />
                    </button>
                  </div>
    
                  <div className="w-px h-6 bg-custom-black/10 dark:bg-white/10 mx-1" />
                  <button
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="lg:hidden p-2 hover:bg-custom-white/50 dark:hover:bg-white/10 rounded-lg text-custom-black dark:text-custom-white"
                    aria-label={t("layers")}
                  >
                    <LayersIcon size={20} />
                  </button>
    
                  <button
                    ref={exportAnchorRef}
                    onClick={() => setExportOpen((v) => !v)}
                    className="px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 text-sm font-medium flex items-center gap-1.5 shadow-md active:scale-95 transition-transform"
                    aria-label={t("download")}
                    title={t("download")}
                  >
                    <Download size={16} />
                    <span className="hidden sm:inline">{t("download")}</span>
                    <ChevronDown size={16} className="opacity-80" />
                  </button>
                </div>
              </div>
            )}
    
            {/* Canvas 區 */}
            <div className="flex-1 flex overflow-hidden">
              <div
                className="flex-1 relative"
                onClick={(e) => {
                  if (typeof window === "undefined" || window.innerWidth >= 1024)
                    return;
                  if (mobileEditingLayerId || isMobileDrawingMode) return;
    
                  const target = e.target as HTMLElement;
                  if (!target.closest("canvas")) return;
    
                  const api = fabricApiRef.current;
                  if (!api) return;
    
                  const canvas = api.getCanvas();
                  if (!canvas) return;
    
                  const pointer = canvas.getPointer(e.nativeEvent);
    
                  for (const layer of panelLayersTopToBottom) {
                    if (!layer.visible || layer.id === BASE_ID) continue;
    
                    const transforms = api.getSelectedLayersTransform([layer.id]);
                    if (transforms.length === 0) continue;
    
                    const bbox = transforms[0].boundingBox;
    
                    if (
                      pointer.x >= bbox.x &&
                      pointer.x <= bbox.x + bbox.width &&
                      pointer.y >= bbox.y &&
                      pointer.y <= bbox.y + bbox.height
                    ) {
                      break;
                    }
                  }
                }}
              >
                {/* 左下：新增圖層（overlay） */}
                <div className="absolute left-4 bottom-4 flex items-center gap-2 z-10">
                  <button
                    onClick={handleOverlayUploadClick}
                    // 🔥 修改：工具按鈕使用白底，與主背景區隔
                    className="p-2 md:px-3 md:py-1.5 rounded-lg bg-white dark:bg-[#1A2633] border border-custom-black/5 dark:border-white/10 shadow-sm text-sm flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-800 text-custom-black dark:text-custom-white"
                    aria-label={t("add_layer")}
                  >
                    <Upload size={16} />
                    <span className="hidden md:inline">{t("add_layer")}</span>
                  </button>
                  <button
                    onClick={async () => {
                      if (!fabricApiRef.current) return;
                      await fabricApiRef.current.addTextLayer(t("input_text"), {
                        fontSize: 32,
                        fontFamily: "Arial",
                        fill: "#000000",
                      });
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-custom-logo-purple hover:bg-custom-logo-purple-hover text-white rounded-lg transition-colors text-sm shadow-md"
                    aria-label={t("add_text")}
                  >
                    <Type size={16} />
                    <span className="hidden md:inline">{t("add_text")}</span>
                  </button>
                  <input
                    ref={overlayFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleOverlayFileChange}
                  />
                </div>
    
                {/* 手機版畫布控制按鈕（右下角） */}
                <div className="lg:hidden absolute right-4 bottom-4 flex flex-col gap-2 z-10">
                  <button
                    onClick={handleZoomIn}
                    className="p-3 rounded-full bg-white dark:bg-[#1A2633] border border-custom-black/5 dark:border-white/10 shadow-lg hover:bg-gray-50 active:scale-95 transition-transform text-custom-black dark:text-custom-white"
                    aria-label={t("zoom_in")}
                  >
                    <ZoomIn size={20} />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-3 rounded-full bg-white dark:bg-[#1A2633] border border-custom-black/5 dark:border-white/10 shadow-lg hover:bg-gray-50 active:scale-95 transition-transform text-custom-black dark:text-custom-white"
                    aria-label={t("zoom_out")}
                  >
                    <ZoomOut size={20} />
                  </button>
                  <button
                    onClick={handleResetView}
                    className="p-3 rounded-full bg-white dark:bg-[#1A2633] border border-custom-black/5 dark:border-white/10 shadow-lg hover:bg-gray-50 active:scale-95 transition-transform text-custom-black dark:text-custom-white"
                    aria-label={t("reset_view")}
                  >
                    <Maximize2 size={20} />
                  </button>
    
                  {/* 顯示當前縮放比例 */}
                  <div className="px-3 py-2 rounded-full bg-white dark:bg-[#1A2633] border border-custom-black/5 dark:border-white/10 shadow-lg text-xs font-medium text-center text-custom-black dark:text-custom-white">
                    {zoom}%
                  </div>
                </div>
    
                {/* 工具浮窗 - 筆刷 */}
                {selectedTool === "brush" && (
                  // 🔥 修改：浮窗使用白底
                  <div className="hidden lg:block absolute top-4 left-4 z-10 bg-white dark:bg-[#1A2633] rounded-xl shadow-lg border border-custom-black/5 dark:border-white/10 p-3 max-w-xs text-custom-black dark:text-custom-white">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-custom-logo-purple animate-pulse" />
                      <span className="text-xs font-semibold text-custom-logo-purple">
                        {t("brush_mode")}
                      </span>
                    </div>
    
                    {selectedLayerId ? (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-custom-black dark:text-custom-white">
                          {t("brush_size")}: {brushSize}px
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={brushSize}
                          onChange={(e) =>
                            handleBrushSizeChange(parseInt(e.target.value))
                          }
                          className="w-full accent-custom-logo-purple"
                        />
                        <div className="flex justify-center py-2">
                          <div
                            className="rounded-full bg-custom-logo-purple"
                            style={{
                              width: `${Math.min(brushSize, 50)}px`,
                              height: `${Math.min(brushSize, 50)}px`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400">
                        ⚠️ {t("select_layer_to_draw")}
                      </div>
                    )}
                  </div>
                )}
    
                {/* 工具浮窗 - 橡皮擦 */}
                {selectedTool === "eraser" && (
                  <div className="hidden lg:block absolute top-4 left-4 z-10 bg-white dark:bg-[#1A2633] rounded-xl shadow-lg border border-custom-black/5 dark:border-white/10 p-3 max-w-xs text-custom-black dark:text-custom-white">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-custom-logo-purple animate-pulse" />
                      <span className="text-xs font-semibold text-custom-logo-purple">
                        {t("eraser_mode")}
                      </span>
                    </div>
    
                    {selectedLayerId ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            onClick={() => {
                              setEraserAction("erase");
                              fabricApiRef.current?.setEraserAction?.("erase");
                            }}
                            className={`px-2 py-1 rounded border ${
                              eraserAction === "erase"
                                ? "bg-custom-logo-purple text-white border-custom-logo-purple"
                                : "border-custom-black/10 dark:border-white/10 text-custom-black dark:text-custom-white hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                          >
                            {t("erase")}
                          </button>
                          <button
                            onClick={() => {
                              setEraserAction("restore");
                              fabricApiRef.current?.setEraserAction?.("restore");
                            }}
                            className={`px-2 py-1 rounded border ${
                              eraserAction === "restore"
                                ? "bg-custom-logo-purple text-white border-custom-logo-purple"
                                : "border-custom-black/10 dark:border-white/10 text-custom-black dark:text-custom-white hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                          >
                            {t("restore")}
                          </button>
                        </div>
    
                        <label className="text-xs font-medium text-custom-black dark:text-custom-white">
                          {t("eraser_size")}: {eraserSize}px
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="150"
                          value={eraserSize}
                          onChange={(e) => {
                            const v = parseInt(e.target.value);
                            handleEraserSizeChange(v);
                          }}
                          className="w-full accent-custom-logo-purple"
                        />
                      </div>
                    ) : (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400">
                        ⚠️ {t("select_layer_to_edit")}
                      </div>
                    )}
                  </div>
                )}
    
                {/* 真正的畫布 */}
                <div className="absolute inset-0">
                  {!selectedTextId && !textProperties && typeof window !== "undefined" && window.innerWidth >= 1024 && (
                    <SelectedLayerToolbar
                      visible={selectedLayerIds.length > 0}
                      selectedCount={selectedLayerIds.length}
                      onBackgroundRemove={handleBackgroundRemove}
                      onLayerSeparation={handleLayerSeparation}
                      canUseBrush={
                        selectedLayerIds.length === 1 && currentMode === "EDIT"
                      }
                      isBrushOn={selectedTool === "brush" && brushMode}
                      onBrushToggle={() => {
                        if (
                          selectedLayerIds.length !== 1 ||
                          currentMode !== "EDIT"
                        )
                          return;
                        fabricApiRef.current?.clearResidualDraw?.();
                        const next = !(selectedTool === "brush" && brushMode);
                        setSelectedTool(next ? "brush" : null);
                        if (next) {
                          setEraserMode(false);
                          fabricApiRef.current?.setEraserMode?.(false);
                        }
                        updateBrushMode(
                          next ? "brush" : null,
                          next ? selectedLayerIds[0] : null
                        );
                      }}
                      canUseEraser={selectedLayerIds.length === 1}
                      isEraserOn={selectedTool === "eraser" && eraserMode}
                      onEraserToggle={() => {
                        if (selectedLayerIds.length !== 1) return;
                        fabricApiRef.current?.clearResidualDraw?.();
                        const next = !(selectedTool === "eraser" && eraserMode);
                        setSelectedTool(next ? "eraser" : null);
                        if (next) {
                          setBrushMode(false);
                          fabricApiRef.current?.setBrushMode(false);
                          fabricApiRef.current?.setEraserAction?.(eraserAction);
                        }
                        updateEraserMode(
                          next ? "eraser" : null,
                          next ? selectedLayerIds[0] : null
                        );
                      }}
                      onUpscale={handleUpscaleImage}
                    />
                  )}
                  
                  <AnimatePresence>
                    {selectedTextId && textProperties && typeof window !== "undefined" && window.innerWidth >= 1024 && (
                      <TextToolbar
                        textId={selectedTextId}
                        properties={textProperties}
                        onUpdate={(newProps) => {
                          const api = fabricApiRef.current;
                          if (api && selectedTextId) {
                            api.updateTextProperties?.(selectedTextId, newProps);
                            setTextProperties((prev) => ({
                              ...prev,
                              ...newProps,
                            }));
                          }
                        }}
                        position="floating"
                      />
                    )}
                  </AnimatePresence>
                  <FabricStage
                    mode={currentMode}
                    selectedIds={selectedLayerIds}
                    initialBackgroundUrl={baseUrl ?? undefined}
                    onCanvasReady={(api) => {
                      const extendedApi = extendWithTextLayer(api);
                      fabricApiRef.current = extendedApi;
                      const canvas = extendedApi.getCanvas();
                      if (canvas) setupTextEditing(canvas);
    
                      setZoom(api.getZoom());
                      updateHistoryState();
                      const interval = setInterval(updateHistoryState, 500);
                      return () => clearInterval(interval);
                    }}
                    onZoomChange={(p: number) => setZoom(p)}
                    onObjectsChange={(topToBottom: StageLayerItem[]) => {
                      setPanelLayersTopToBottom(topToBottom);
                      updateHistoryState();
                    }}
                    onSelectionChange={(ids?: string[]) => {
                      console.log("ids ==> ", ids);
                      if (isSuppressed()) return;
    
                      const safeIds = Array.isArray(ids)
                        ? ids.filter(Boolean)
                        : [];
    
                      const singleOnly =
                        currentMode === "EDIT" || currentMode === "ACTION";
    
                      if (singleOnly && safeIds.length > 1) {
                        const first = safeIds[0];
                        withSuppress(() => {
                          fabricApiRef.current?.setActive(first);
                        });
                        setSelectedLayerIds([first]);
                        setSelectedLayerId(first);
    
                        if (selectedTool === "brush") {
                          updateBrushMode("brush", first);
                        } else if (selectedTool === "eraser") {
                          updateEraserMode("eraser", first);
                        } else {
                          if (brushMode) updateBrushMode(null, null);
                          if (eraserMode) updateEraserMode(null, null);
                        }
                        updateHistoryState();
                        return;
                      }
    
                      if (safeIds.length > 1) {
                        fabricApiRef.current?.clearResidualDraw?.();
    
                        if (brushMode || eraserMode) {
                          setSelectedTool(null);
                          setBrushMode(false);
                          setEraserMode(false);
                          fabricApiRef.current?.setBrushMode(false);
                          fabricApiRef.current?.setEraserMode?.(false);
                          fabricApiRef.current?.exitDrawingMode?.(true);
                        } else {
                          fabricApiRef.current?.setActiveMultiple?.(safeIds);
                        }
                      }
    
                      if (safeIds.length === 0) {
                        fabricApiRef.current?.clearResidualDraw?.();
    
                        if (brushMode || eraserMode) {
                          setSelectedTool(null);
                          setBrushMode(false);
                          setEraserMode(false);
                          fabricApiRef.current?.setBrushMode(false);
                          fabricApiRef.current?.setEraserMode?.(false);
                          fabricApiRef.current?.exitDrawingMode?.(true);
                        }
                      }
    
                      setSelectedLayerIds(safeIds);
                      setSelectedLayerId(safeIds[0] || null);
    
                      if (
                        safeIds.length === 1 &&
                        !currentMode &&
                        typeof window !== "undefined" &&
                        window.innerWidth >= 1024
                      ) {
                        handleModeChange("EDIT");
                      }
    
                      const targetId = safeIds.length === 1 ? safeIds[0] : null;
                      if (selectedTool === "brush") {
                        updateBrushMode("brush", targetId);
                      } else if (selectedTool === "eraser") {
                        updateEraserMode("eraser", targetId);
                      } else {
                        if (brushMode) updateBrushMode(null, null);
                        if (eraserMode) updateEraserMode(null, null);
                      }
                    }}
                    className="w-full h-full rounded-lg shadow-2xl"
                  />
                </div>
    
                {!baseUrl && panelLayersTopToBottom.length === 0 && (
                  // 🔥 修改：提示框卡片化
                  <div className="absolute top-4 left-4 z-10 px-3 py-2 text-xs rounded bg-white dark:bg-[#1A2633] shadow max-w-[200px] md:max-w-xs text-custom-black dark:text-custom-white border border-custom-black/5 dark:border-white/10">
                    <span className="md:hidden">{t("upload_image_mobile_hint")}</span>
                    <span className="hidden md:inline">
                      {t("empty_canvas_hint")}
                    </span>
                  </div>
                )}
              </div>
            </div>
    
            {/* Prompt Dock */}
            {/* 🔥🔥 修正 3：Prompt Dock 使用白底 (bg-white)，與主背景 (custom-white) 區隔 🔥🔥 */}
            <div
              className={`
    shrink-0 border-t border-custom-black/5 dark:border-white/5
    bg-white dark:bg-[#1A2633]
    transition-all duration-300 ease-in-out
    lg:opacity-100 lg:translate-y-0
    ${
      isMobileDrawingMode
        ? "opacity-0 translate-y-full pointer-events-none"
        : "opacity-100 translate-y-0"
    }
  `}
            >
              <EditorPromptDock
                mode={currentMode}
                fixed={false}
                framed={true}
                serverUrl={
                  process.env.NEXT_PUBLIC_SERVER_URL || "https://api.superstar-ai.xyz"
                }
                userId={"guest"}
                selectedImagesCount={selectedLayerIds.length}
                fabricCanvas={fabricApiRef.current?.getCanvas()}
                onModeChange={handleModeChange}
                onAddTextWithAlpha={handleAddTextWithAlpha}
                onPoseEditWithAlpha={handlePoseEditWithAlpha}
                onComposeMerge={handleComposeMerge}
                onBrushToggle={() => {
                  setSelectedTool("brush");
                }}
                onEraserToggle={() => {
                  setSelectedTool("eraser");
                }}
                beforeSubmit={async (body: Record<string, unknown>) => {
                  fabricApiRef.current?.clearResidualDraw?.();
    
                  const mode = body.mode as EditorMode;
    
                  if (mode === "MERGE") {
                    if (selectedLayerIds.length === 1) {
                      throw new Error(t("merge_mode_need_at_least_2_layers"));
                    }
                    if (selectedLayerIds.length > 8) {
                      throw new Error(t("max_8_layers_for_merge"));
                    }
                    const api = fabricApiRef.current;
                    if (!api) throw new Error(t("editor_not_initialized"));
    
                    const selectedLayers = api.getSelectedLayersTransform(
                      selectedLayerIds
                    ) as SelectedTransforms | [];
                    const compositorData = convertToCompositorFormatCrop(
                      selectedLayers,
                      100
                    ) as ConvertResult;
                    (body as { compositorData?: unknown }).compositorData =
                      compositorData.fabricDataJson;
                    (body as { layerMapping?: unknown }).layerMapping =
                      compositorData.layerMapping;
                    (
                      body as {
                        selectedLayers?: { id: string; name: string }[];
                      }
                    ).selectedLayers = selectedLayers.map((l) => ({
                      id: l.id,
                      name: l.name,
                    }));
                  }
    
                  if (mode === "EDIT") {
                    if (selectedLayerIds.length !== 1) {
                      throw new Error(t("edit_mode_need_exactly_one_layer"));
                    }
                    (body as { selectedLayerId?: string }).selectedLayerId =
                      selectedLayerIds[0];
                  }
    
                  if (mode === "ACTION") {
                    (body as { selectedLayerIds?: string[] }).selectedLayerIds =
                      selectedLayerIds;
                  }
                }}
                onTaskCreated={() => {}}
                onTaskUpdate={() => {}}
                onTaskComplete={(payload: Record<string, unknown>) => {
                  try {
                    const op =
                      (payload?.op as string | undefined) ||
                      (payload?.mode as string | undefined) ||
                      (payload?.operation as string | undefined);
                    const isMerge =
                      (op && op.toUpperCase() === "MERGE") ||
                      (op && op.toUpperCase() === "COMPOSITE") ||
                      Boolean(payload?.compositorData);
    
                    if (!isMerge) return;
    
                    const url = (
                      payload?.publishedImages as { url?: string }[] | undefined
                    )?.[0]?.url;
                    if (url) {
                      // 已在 handleComposeMerge 處理世界尺寸保留
                    }
                  } catch (e) {
                    console.error("onTaskComplete guard error:", e);
                  }
                }}
                onError={(err: unknown) => {
                  console.error("❌ 錯誤:", err);
                  const msg =
                    typeof err === "string"
                      ? err
                      : (err as { message?: unknown })?.message;
                  alert(String(msg ?? t("unknown_error")));
                }}
                selectedTextId={selectedTextId}
                textProperties={textProperties}
                onTextUpdate={(props) => {
                  if (selectedTextId) {
                    fabricApiRef.current?.updateTextProperties?.(selectedTextId, props);
                    const updated = fabricApiRef.current?.getTextProperties?.(selectedTextId);
                    setTextProperties(updated || null);
                  }
                }}
              />
            </div>
          </div>
          
          {/* 手機繪圖模式工具面板 */}
          <div
            className={`
    lg:hidden fixed inset-x-0 bottom-0 z-[70]
    bg-white dark:bg-[#1A2633] border-t border-custom-black/5 dark:border-white/5 text-custom-black dark:text-custom-white
    transition-all duration-300 ease-in-out
    ${
      isMobileDrawingMode
        ? "opacity-100 translate-y-0"
        : "opacity-0 translate-y-full pointer-events-none"
    }
  `}
          >
            <div className="px-4 py-4 space-y-4">
              {/* 關閉按鈕 */}
              <div className="flex justify-end absolute right-6">
                <button
                  onClick={exitMobileDrawingMode}
                  className="w-10 h-10 rounded-full bg-custom-light-purple/30 dark:bg-gray-700 hover:bg-custom-light-purple/50 flex items-center justify-center text-custom-black dark:text-custom-white"
                >
                  <X size={20} />
                </button>
              </div>
    
              {/* 筆刷控制 */}
              {selectedTool === "brush" && brushMode && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-custom-logo-purple animate-pulse" />
                    <span className="text-sm font-semibold text-custom-logo-purple">
                      {t("brush_mode")}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-custom-black dark:text-custom-white">
                      {t("brush_size")}: {brushSize}px
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={brushSize}
                      onChange={(e) =>
                        handleBrushSizeChange(parseInt(e.target.value))
                      }
                      className="w-full accent-custom-logo-purple"
                    />
                    <div className="flex justify-center py-2">
                      <div
                        className="rounded-full bg-custom-logo-purple"
                        style={{
                          width: `${Math.min(brushSize, 50)}px`,
                          height: `${Math.min(brushSize, 50)}px`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
    
              {/* 橡皮擦控制 */}
              {selectedTool === "eraser" && eraserMode && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-custom-logo-purple animate-pulse" />
                    <span className="text-sm font-semibold text-custom-logo-purple">
                      {t("eraser_mode")}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEraserAction("erase");
                          fabricApiRef.current?.setEraserAction?.("erase");
                        }}
                        className={`flex-1 py-2 rounded-lg border text-sm ${
                          eraserAction === "erase"
                            ? "bg-custom-logo-purple text-white border-custom-logo-purple"
                            : "border-custom-black/10 dark:border-white/10 text-custom-black dark:text-custom-white hover:bg-custom-light-purple/20"
                        }`}
                      >
                        {t("erase")}
                      </button>
                      <button
                        onClick={() => {
                          setEraserAction("restore");
                          fabricApiRef.current?.setEraserAction?.("restore");
                        }}
                        className={`flex-1 py-2 rounded-lg border text-sm ${
                          eraserAction === "restore"
                            ? "bg-custom-logo-purple text-white border-custom-logo-purple"
                            : "border-custom-black/10 dark:border-white/10 text-custom-black dark:text-custom-white hover:bg-custom-light-purple/20"
                        }`}
                      >
                        {t("restore")}
                      </button>
                    </div>
                    <label className="text-sm font-medium text-custom-black dark:text-custom-white">
                      {t("eraser_size")}: {eraserSize}px
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="150"
                      value={eraserSize}
                      onChange={(e) =>
                        handleEraserSizeChange(parseInt(e.target.value))
                      }
                      className="w-full accent-custom-logo-purple"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Layers 邊欄 */}
          <LayersSidebar
            isCollapsed={isSidebarCollapsed}
            setIsCollapsed={setIsSidebarCollapsed}
            items={layerList}
            activeId={selectedLayerId}
            activeIds={selectedLayerIds}
            onSelect={selectLayer}
            onToggleVisible={toggleLayerVisible}
            onDelete={deleteLayer}
            onReorder={reorderLayers}
            onMerge={mergeLayers}
            onDownloadLayer={handleDownloadLayer} 
          />
          <LayersDrawer
            isOpen={isMobileSidebarOpen}
            setIsOpen={setIsMobileSidebarOpen}
            items={layerList}
            activeId={selectedLayerId}
            activeIds={selectedLayerIds}
            onSelect={selectLayer}
            onToggleVisible={toggleLayerVisible}
            onDelete={deleteLayer}
            onReorder={reorderLayers}
            onMerge={mergeLayers}
            onDownloadLayer={handleDownloadLayer}  
          />
    
        </motion.div>
    
        <ExportMenu
          open={exportOpen}
          onOpenChange={setExportOpen}
          api={fabricApiRef.current}
          anchorRef={exportAnchorRef} 
          getLayers={() => panelLayersTopToBottom}
          backgroundVisible={baseVisible}
        />
      </div>
    );
}
