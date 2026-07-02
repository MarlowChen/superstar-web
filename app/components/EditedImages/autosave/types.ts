// autosave/types.ts
export type DraftManifest = {
    projectId: string;
    appVersion: number;   // 方便將來做 migration
    savedAt: number;      // epoch ms
    // 純 JSON（壓縮前）：就是你 buildSnapshot() 的輸出
    // 實際存 IndexedDB 時會是壓縮後的 Uint8Array
  };
  
  export type BlobRef = {
    key: string;   // 存在 IndexedDB 的 blob key
    size: number;  // bytes（可選）
    kind: "base" | "mask";
  };
  