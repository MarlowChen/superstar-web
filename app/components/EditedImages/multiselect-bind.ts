// utils/multiselect-bind.ts
import * as fabric from "fabric";
import { FabricObject } from "fabric";

// ------------- 型別定義 -------------

type SelItem = {
  obj: fabric.Object;
  M0: fabric.TMat2D;                   // 物件初始矩陣
  cp?: fabric.Object;        // clipPath（若有）
  cpM0?: fabric.TMat2D;                // clipPath 初始矩陣（若有）
};

export type SelCtx = {
  sel: fabric.ActiveSelection;
  Msel0: fabric.TMat2D;                                       // ActiveSelection 初始矩陣
  byId: Record<string, SelItem>;                   // 以穩定 ID 索引
};

// ------------- 穩定 ID（不碰私有欄位）-------------
const __OBJ_ID = new WeakMap<fabric.Object, string>();

function genId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as Crypto).randomUUID()
    : `o_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getId(o: fabric.Object): string {
  const data: {
    [k: string]: unknown;
    id?: string;
    ui?: boolean;
    pendingFlag?: string;
    jobId?: string;
    isPending?: boolean;
} | undefined = (o as fabric.Object).data;
  if (data && typeof data.id === "string" && data.id) return data.id;

  const cached = __OBJ_ID.get(o);
  if (cached) return cached;

  const id = genId();
  const onj = (o as fabric.FabricObject)
  if (!onj.data) onj.data = { id: ""};
  onj.data.id = id;
  __OBJ_ID.set(o, id);
  return id;
}

// ------------- 矩陣/套用工具 -------------
function getMatrix(o: fabric.Object): fabric.TMat2D {
  return o.calcTransformMatrix() as fabric.TMat2D;
}

function invert(m: fabric.TMat2D): fabric.TMat2D {
  return fabric.util.invertTransform(m) as fabric.TMat2D;
}

function mmul(a: fabric.TMat2D, b: fabric.TMat2D): fabric.TMat2D {
  return fabric.util.multiplyTransformMatrices(a, b) as fabric.TMat2D;
}

/**
 * 依矩陣把平移/旋轉/縮放/斜切回填到物件屬性（以中心為原點）
 * 注意：這會把 originX/Y 設為 center，避免因原點在邊緣導致二次位移
 */
function applyMatrix(o: fabric.Object, m: fabric.TMat2D) {
  const opt = fabric.util.qrDecompose(m);
  const center = new fabric.Point(opt.translateX, opt.translateY);

  o.set({
    left: center.x,
    top: center.y,
    scaleX: opt.scaleX,
    scaleY: opt.scaleY,
    skewX: opt.skewX,
    skewY: opt.skewY,
    angle: opt.angle,
    originX: "center",
    originY: "center",
  } as Partial<fabric.RectProps>);

  o.setCoords();
}

// ------------- 多選：建立互動前基準 -------------
/**
 * 僅在「進入多選互動」時呼叫一次（例如 selection:created 或使用者按下滑鼠開始拖動）
 * - 把 ActiveSelection 與子物件的初始矩陣記下
 * - 若物件有 clipPath，也同步記下 clipPath 的初始矩陣，並設為絕對定位 + center 原點
 */
export function captureMultiSelectionBaseline(sel: fabric.ActiveSelection): SelCtx {
  // 為了避免原點在邊緣造成二次位移，把 selection 視為以中心為原點
  sel.set({ originX: "center", originY: "center" });
  sel.setCoords();

  const Msel0 = getMatrix(sel);
  const byId: SelCtx["byId"] = {};

  // 使用公開 API 取得子物件，避免直接觸碰 _objects
  const objects = sel.getObjects() as fabric.Object[];

  for (const o of objects) {
    const id = getId(o);

    // 確保資料物件存在且寫回 id（方便外界除錯）
    (o as FabricObject).data ||= {};
    // 物件的 data 屬性在上一行已確保為物件，使用非空斷言 (!) 避免型別檢查器誤判為「未定義」。
    ((o as FabricObject).data!).id ||= id;

    const M0 = getMatrix(o);

    // clipPath（若有）的初始矩陣也記下來，並調整成絕對定位 + 中心原點
    const cp = (o as FabricObject).clipPath as fabric.Object | undefined;
    let cpM0: fabric.TMat2D | undefined;
    if (cp) {
      cp.set({
        absolutePositioned: true,
        originX: "center",
        originY: "center",
      } as Partial<fabric.RectProps>);
      cp.setCoords();
      cpM0 = getMatrix(cp);
    }

    byId[id] = { obj: o, M0, cp, cpM0 };
  }

  return { sel, Msel0, byId };
}

// ------------- 多選：在 move/scale/rotate/modified 期間套用 Δ -------------
/**
 * 在 on:scaling / on:moving / on:rotating（通常綁 ActiveSelection 的事件）呼叫
 * 做法：
 *   dM = Msel · inv(Msel0)
 *   Mnew(obj) = dM · M0(obj)
 *   Mnew(clipPath) = dM · M0(clipPath)
 *
 * 我們**不**讓 ActiveSelection 再去驅動子物件（避免二次變換造成偏移），
 * 只把 Δ 直接套到每一個子物件與其 clipPath，這樣「旋轉後再拉伸」就不會跑掉。
 */
export function applyDeltaToSelection(ctx: SelCtx) {
  const Msel = getMatrix(ctx.sel);
  const dM = mmul(Msel, invert(ctx.Msel0)); // Δ = Msel · inv(Msel0)

  for (const id of Object.keys(ctx.byId)) {
    const { obj, M0, cp, cpM0 } = ctx.byId[id];

    // 物件：Mnew = dM · M0
    const Mnew = mmul(dM, M0);
    applyMatrix(obj, Mnew);

    // clipPath（若有）：同樣套 Δ（以 clipPath 自己的 M0 為基準）
    if (cp && cpM0) {
      const McpNew = mmul(dM, cpM0);
      applyMatrix(cp, McpNew);
    }
  }

  // 只重繪，不讓 ActiveSelection 再觸發子物件的搬動流程
  ctx.sel.canvas?.requestRenderAll();
}
