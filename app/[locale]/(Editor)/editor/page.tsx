'use client';

import { Editor } from '@/app/components/editor/Editor';
import React, { useState } from 'react';

export default function EditorPage() {
  const [injectedAsset, setInjectedAsset] = useState<{ url: string; type: 'video' | 'image' | 'audio'; label?: string } | null>(null);
  
const handlePickMedia = (type: 'video' | 'image' | 'audio') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'audio' ? 'audio/*' : type === 'image' ? 'image/*' : 'video/*';
    
    // 1. 將 e 標記為原生的 Event 型別
    input.onchange = (e: Event) => {
      // 2. 斷言 target 為 HTMLInputElement，這樣 TS 才會知道它有 .files 屬性
      const target = e.target as HTMLInputElement; 
      const file = target.files?.[0];
      
      if (!file) return;
      
      const url = URL.createObjectURL(file);
      setInjectedAsset({ url, type, label: file.name });
    };
    
    input.click();
  };
  
  return (
    <Editor
      injectedAsset={injectedAsset}
      onAssetInjected={() => setInjectedAsset(null)}
      onPickMedia={handlePickMedia}
      onBack={() => history.back()}
      onExport={() => alert('匯出功能待實作')}
    />
  );
}