// autosave/store.ts
import { set, get, del, keys } from "idb-keyval";
import { deflate, inflate } from "pako";

// 你可以統一在 key 前面加 namespace
const NS = "pslike";
const K = {
  manifest: (pid: string) => `${NS}:manifest:${pid}`,
  snapshot: (pid: string) => `${NS}:snapshot:${pid}`,           // gzip Uint8Array
  layerBase: (pid: string, lid: string) => `${NS}:base:${pid}:${lid}`, // Blob
  layerMask: (pid: string, lid: string) => `${NS}:mask:${pid}:${lid}`, // Blob
};

export async function saveSnapshotJSON(projectId: string, snapshot: unknown) {
  const raw = new TextEncoder().encode(JSON.stringify(snapshot));
  const gz = deflate(raw);
  await set(K.snapshot(projectId), gz);
  await set(K.manifest(projectId), {
    projectId,
    appVersion: 1,
    savedAt: Date.now(),
  });
}

export async function loadSnapshotJSON<T = unknown>(projectId: string): Promise<T | null> {
  const gz = await get<Uint8Array>(K.snapshot(projectId));
  if (!gz) return null;
  const raw = inflate(gz);
  const json = new TextDecoder().decode(raw);
  return JSON.parse(json) as T;
}

export async function saveLayerBlob(
  projectId: string,
  layerId: string,
  kind: "base" | "mask",
  blob: Blob
) {
  const key = kind === "base" ? K.layerBase(projectId, layerId) : K.layerMask(projectId, layerId);
  await set(key, blob);
}

export async function loadLayerBlob(
  projectId: string,
  layerId: string,
  kind: "base" | "mask"
): Promise<Blob | null> {
  const key = kind === "base" ? K.layerBase(projectId, layerId) : K.layerMask(projectId, layerId);
  return (await get<Blob>(key)) ?? null;
}

export async function clearDraft(projectId: string) {
  // 粗暴清：把該 projectId 相關的 key 全部刪除
  const all = await keys<string>();
  await Promise.all(
    all
      .filter((k) => typeof k === "string" && k.includes(`:${projectId}`))
      .map((k) => del(k as string))
  );
}


