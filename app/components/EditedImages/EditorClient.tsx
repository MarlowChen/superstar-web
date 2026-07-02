"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ImageEditor from "@/app/components/EditedImages/ImageEditor";
import MagicFeatureDialog from "../MagicFeatureDialog";

function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function EditorClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialImage = sp.get("src") ?? undefined;

  // 👇 控制 Dialog 的狀態
  const [showMagicDialog, setShowMagicDialog] = useState(false);

  // 👇 邏輯核心：檢查 LocalStorage (只在第一次進入時跳出)
  useEffect(() => {
    // 定義 Key，加上版本號 v1 以便未來更新功能時可以改 v2 強制再跳一次
    const STORAGE_KEY = "has_seen_magic_editor_v1"; 

    // 檢查是否看過
    const hasSeen = localStorage.getItem(STORAGE_KEY);
    
    // 如果沒看過 (null)，則顯示彈窗
    if (!hasSeen) {
      // 稍微延遲 500ms 再跳出，讓使用者先看到編輯器介面，體驗較好
      const timer = setTimeout(() => {
        setShowMagicDialog(true);
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, []);

  // 👇 關閉視窗時的處理
  const handleDialogClose = useCallback(() => {
    setShowMagicDialog(false);
    // 寫入紀錄，確保下次不再跳出
    localStorage.setItem("has_seen_magic_editor_v1", "true");
  }, []);

  // 原有的邏輯
  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleSave = useCallback((imageData: string | null) => {
    if (!imageData) return;
    downloadDataUrl(`edited-${Date.now()}.png`, imageData);
  }, []);

  return (
    <div className="fixed inset-0">
      <ImageEditor
        initialImage={initialImage}
        onClose={handleClose}
        onSave={handleSave}
      />

      {/* 👇 復用原本的 MagicFeatureDialog */}
      <MagicFeatureDialog 
        isOpen={showMagicDialog} 
        onClose={handleDialogClose} 
      />
    </div>
  );
}