import * as fabric from "fabric";

export type FabricOriginX = "left" | "center" | "right" | number;
export type FabricOriginY = "top" | "center" | "bottom" | number;



export type SerializedObject = {
  type: "image" | "i-text"  | "textbox";  // 🔥 改這行
  dataURL?: string;  // 🔥 改成 optional（文字不需要）
  left: number;
  top: number;
  originX?: FabricOriginX;
  originY?: FabricOriginY;
  width?: number;  // 🔥 改成 optional（文字不需要）
  height?: number;  // 🔥 改成 optional（文字不需要）
  scaleX: number;
  scaleY: number;
  angle: number;
  flipX?: boolean;  // 🔥 改成 optional
  flipY?: boolean;  // 🔥 改成 optional
  visible: boolean;
  selectable: boolean;
  evented: boolean;
  skewX?: number;
  skewY?: number;
  data?: Record<string, unknown>;
  baseDataURL?: string;
  maskDataURL?: string;
  hasBase?: boolean;
  hasMask?: boolean;
  clipPath?: fabric.Object;
  
  // 🔥 文字專屬屬性
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  fontWeight?: string;
  fontStyle?: string;
  underline?: boolean;
  textAlign?: string;
};
  export type HistoryState = {
    objects: SerializedObject[];
    bgVisible: boolean;
    selectedLayerId?: string | null;
    userDrawnLayers?: string[];
  };


  // ===== Strict Types & Helpers (type-only; no logic changes) =====

/** fabric 物件上 data 欄位的共同型別（對應你已做的 module augmentation）。 */
export type FabricExtraData = {
    id?: string;
    ui?: boolean;
    pendingFlag?: string;
    jobId?: string;
    isPending?: boolean;
    name?: string;
    thumb?: string;
    locked?: boolean;
    processingOverlay?: boolean;
  
    // 供裁切/同步流程暫存用
    frame?: {
      w: number; h: number;
      left?: number; top?: number;
      angle?: number;
    };
  
    // 邊拖曳/角拖曳暫存
    __edgeAnchor?: 'left'|'right'|'top'|'bottom';
    __cornerBase?: {
      frameW: number; frameH: number;
      imgScale: number;
      offsetX: number; offsetY: number;
    };
    __edgeBase?: {
      baseImgScaledW: number;
      baseImgScaledH: number;
      baseImgScale: number;
      centerOffsetInImgX: number;
      centerOffsetInImgY: number;
      anchor: 'left'|'right'|'top'|'bottom';
    };
  
    [k: string]: unknown;
  };
  
  /** 讓 fabric 任一物件都能安全讀寫 data。 */
  export type FabricObjectWithData = fabric.Object & { data?: FabricExtraData };
  
  /** 具有可選擇/事件旗標的物件（常見在程式中切換 selectable/evented）。 */
  export type FabricObjectInteractive =
    fabric.Object & { selectable?: boolean; evented?: boolean; hoverCursor?: string };
  
  /** 需要調整 noScaleCache / objectCaching 的影像物件。 */
  export type FabricImageCaching =
    fabric.FabricImage & { noScaleCache?: boolean; objectCaching?: boolean };
  
  /** 需要 skewX/skewY 的影像物件。 */
  export type FabricImageSkew =
    fabric.FabricImage & { skewX?: number; skewY?: number };
  
  /** 代表「代理框」的 rect（有 proxyTag 與 hostId）。 */
  export type ProxyRect =
    fabric.Rect & { data?: FabricExtraData & { proxyTag?: string; hostId?: string } };
  
  /** 會在 setLayerProcessing 用到的 Group 代理覆蓋層。 */
  export type ProcessingGroup = fabric.Group & { data?: FabricExtraData };
  
  /** 擴充 Canvas 以暫存一些流程狀態（不改行為，只是 typing）。 */
  export type ExtCanvas = fabric.Canvas & {
    __mh?: fabric.Rect | null;
    __pairs?: unknown; // 僅作暫存標記用；行為維持原狀
    __base?: { cx: number; cy: number; w: number; h: number; angle: number };
    __rotateBase?: unknown;
    __onBlank?: (ev: fabric.TPointerEvent) => void;
    __onEsc?: (ev: KeyboardEvent) => void;
    __dragging?: boolean;
  
    __procCleanup?: () => void;
    __procProxy?: fabric.Group | null;
    __procSpinRaf?: number | null;
  };
  
  /** type guard：判斷是否為影像物件。 */
  export function isFabricImage(o: fabric.Object | null | undefined): o is fabric.FabricImage {
    return !!o && o.type === 'image';
  }
  
  /** type guard：判斷是否為 ProxyRect。 */
  export function isProxyRect(o: fabric.Object | null | undefined): o is ProxyRect {
    return !!o && o.type === 'rect' && !!(o as ProxyRect).data?.proxyTag;
  }
  
  /** 取出 data（若無則回傳空物件），避免到處寫 (obj as any).data。 */
  export function getData(o: fabric.Object | null | undefined): FabricExtraData {
    return (o as FabricObjectWithData)?.data ?? {};
  }
  
  /** 設定/覆寫 data（不可改邏輯，因此只是安全型別封裝）。 */
  export function setData<T extends fabric.Object>(
    o: T,
    data: Partial<FabricExtraData>
  ): T {
    const cur = (o as FabricObjectWithData).data ?? {};
    (o as FabricObjectWithData).data = { ...cur, ...data };
    return o;
  }
  
  /** 幫助處理 selectable/evented/hoverCursor 的安全型別。 */
  export function asInteractive<T extends fabric.Object>(o: T): T & FabricObjectInteractive {
    return o as T & FabricObjectInteractive;
  }
  
  /** 幫助處理影像快取旗標的安全型別。 */
  export function asImageCaching(img: fabric.FabricImage): FabricImageCaching {
    return img as FabricImageCaching;
  }
  
  /** 幫助取得/設定 skewX/skewY。 */
  export function asImageSkew(img: fabric.FabricImage): FabricImageSkew {
    return img as FabricImageSkew;
  }
  
  /** 幫助把 canvas 視為擴充版本（只做 typing）。 */
  export function asExtCanvas(c: fabric.Canvas): ExtCanvas {
    return c as ExtCanvas;
  }
  
  /** 方便找到 hostId 對應的 image。 */
  export function findImageByHostId(canvas: fabric.Canvas, hostId: string): fabric.FabricImage | undefined {
    return (canvas.getObjects() as fabric.Object[]).find(
      o => isFabricImage(o) && getData(o).id === hostId
    ) as fabric.FabricImage | undefined;
  }
  
