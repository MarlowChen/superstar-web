'use client';

import { Editor } from '@/app/components/editor/Editor';
import { useEditorStore } from '@/app/lib/editor/store';
import React, { useCallback, useState } from 'react';

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

  const handleExportProject = useCallback(() => {
    const { project } = useEditorStore.getState();
    const exportedAt = new Date().toISOString();
    const payload = {
      schemaVersion: 1,
      exportedAt,
      project,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `superstar-editor-project-${exportedAt.replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);
  
  return (
    <Editor
      injectedAsset={injectedAsset}
      onAssetInjected={() => setInjectedAsset(null)}
      onPickMedia={handlePickMedia}
      onBack={() => history.back()}
      onExport={handleExportProject}
    />
  );
}
