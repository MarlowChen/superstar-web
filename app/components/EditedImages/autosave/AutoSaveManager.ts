import { HistoryState, SerializedObject } from "../types";
import { saveLayerBlob } from "./store";
import { set } from "idb-keyval"; // 直接引入 set 來存壓縮後的資料

// 為了保持 key 一致，我們需要知道 key 的規則
const NS = "pslike";
const K = {
  manifest: (pid: string) => `${NS}:manifest:${pid}`,
  snapshot: (pid: string) => `${NS}:snapshot:${pid}`,
};

let autosaveTimer: number | null = null;
const AUTOSAVE_DEBOUNCE_MS = 2000;

// Worker 實例
let _worker: Worker | null = null;

function getWorker() {
  if (!_worker && typeof window !== "undefined") {
    _worker = new Worker("/autosave-worker.js");
    _worker.onerror = (e) => console.error("Autosave Worker Error:", e);
  }
  return _worker;
}

// 降級方案：如果 Worker 失敗，回退到主執行緒 (使用 Blob 處理圖片)
function fallbackBlobFromDataURL(dataURL: string): Blob {
  const split = dataURL.split(",");
  const type = split[0].match(/:(.*?);/)?.[1] || "image/png";
  const bin = atob(split[1]);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type });
}

// 圖片轉檔 (Worker)
function convertToBlobInWorker(id: string, key: string, dataURL: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    if (!worker) {
      try { resolve(fallbackBlobFromDataURL(dataURL)); } catch (e) { reject(e); }
      return;
    }

    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (data.id === id && data.key === key && !data.action) { // 確保不是 compress 的回應
        worker.removeEventListener("message", handler);
        if (data.success) {
          const blob = new Blob([data.buffer], { type: data.mime });
          resolve(blob);
        } else {
          console.warn("Worker img error:", data.error);
          resolve(fallbackBlobFromDataURL(dataURL));
        }
      }
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ action: 'processImage', id, key, dataURL });
  });
}

// 🔥 JSON 壓縮 (Worker) - 這是解決你最後那個卡頓的關鍵
function compressSnapshotInWorker(snapshot: unknown): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    
    // 如果不支援 Worker 或 CompressionStream，就 throw error 讓外層用 fallback
    if (!worker || typeof CompressionStream === 'undefined') {
      reject(new Error("Worker or CompressionStream not supported"));
      return;
    }

    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (data.action === 'compress') {
        worker.removeEventListener("message", handler);
        if (data.success) {
          resolve(new Uint8Array(data.buffer));
        } else {
          reject(new Error(data.error));
        }
      }
    };

    worker.addEventListener("message", handler);
    // 傳送整個物件過去 (注意：這裡會發生 structuredClone，但如果不含大圖片，速度是很快的)
    worker.postMessage({ action: 'compress', data: snapshot });
  });
}

// 降級壓縮 (如果 Worker 失敗，雖然會卡但至少能存)
// 這裡簡單使用 TextEncoder，不壓縮，避免引入 pako 造成依賴問題 (或者你可以 import store.ts 的方法)
async function fallbackSaveSnapshot(projectId: string, snapshot: unknown) {
    const raw = new TextEncoder().encode(JSON.stringify(snapshot));
    // 這裡不壓縮直接存，或者你可以呼叫原本 store.ts 的 saveSnapshotJSON
    await set(K.snapshot(projectId), raw);
}

async function doAutosave(projectId: string, state: HistoryState) {
  // 1. 先處理圖片
  const tasks: Promise<void>[] = [];

  for (const obj of state.objects) {
    if (obj.type !== "image") continue;
    const layerId = ((obj as SerializedObject)?.data as { id: string })?.id;
    if (!layerId) continue;

    if (obj.baseDataURL && obj.baseDataURL.startsWith("data:")) {
      const p = convertToBlobInWorker(layerId, "base", obj.baseDataURL)
        .then((blob) => saveLayerBlob(projectId, layerId, "base", blob))
        .catch(e => console.error(e));
      tasks.push(p);
    }
    if (obj.maskDataURL && obj.maskDataURL.startsWith("data:")) {
      const p = convertToBlobInWorker(layerId, "mask", obj.maskDataURL)
        .then((blob) => saveLayerBlob(projectId, layerId, "mask", blob))
        .catch(e => console.error(e));
      tasks.push(p);
    }

    // 瘦身
    (obj as SerializedObject).hasBase = !!obj.baseDataURL;
    (obj as SerializedObject).hasMask = !!obj.maskDataURL;
    delete (obj as SerializedObject).baseDataURL;
    delete (obj as SerializedObject).maskDataURL;
    if ((obj as SerializedObject).dataURL) delete (obj as { dataURL?: string }).dataURL;
  }

  await Promise.all(tasks);

  // 2. 🔥 處理 JSON 壓縮 (改用 Worker)
  try {
    const compressed = await compressSnapshotInWorker(state);
    
    // 寫入 IndexedDB (這步非常快，因為已經是 binary)
    await set(K.snapshot(projectId), compressed);
    await set(K.manifest(projectId), { projectId, appVersion: 1, savedAt: Date.now() });
    
    // console.log("✅ Worker 壓縮存檔完成");
  } catch (err) {
    console.warn("Worker compression failed, using fallback", err);
    // 回退到主執行緒處理 (可能會卡一下，但保證能存)
    await fallbackSaveSnapshot(projectId, state);
  }
}

export function scheduleAutosave(projectId: string, state: HistoryState) {
  if (autosaveTimer) window.clearTimeout(autosaveTimer);

  autosaveTimer = window.setTimeout(() => {
    autosaveTimer = null;
    const run = () => {
      const shallowState = { ...state, objects: state.objects.map((obj) => ({ ...obj })) };
      doAutosave(projectId, shallowState).catch(console.error);
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout: 5000 });
    } else {
      setTimeout(run, 0);
    }
  }, AUTOSAVE_DEBOUNCE_MS);
}