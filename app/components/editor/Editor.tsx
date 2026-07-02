'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useEditorStore } from '../../lib/editor/store';
import { Stage } from './Stage';
import { Timeline } from './Timeline';
import { Toolbar } from './Toolbar';
import { TextEditSheet } from './TextEditSheet';
import { ChevronLeft, Share2, ChevronDown, Check } from 'lucide-react';
import { CANVAS_PRESETS } from '../../lib/editor/constants';
import { getPresetById } from '../../lib/editor/utils';

interface Props {
  onBack?: () => void;
  onExport?: () => void;
  injectedAsset?: { url: string; type: 'video' | 'image' | 'audio'; label?: string } | null;
  onAssetInjected?: () => void;
  onPickMedia?: (type: 'video' | 'image' | 'audio') => void;
}

export const Editor: React.FC<Props> = ({
  onBack, onExport, injectedAsset, onAssetInjected, onPickMedia,
}) => {
  const project = useEditorStore(s => s.project);
  const addClip = useEditorStore(s => s.addClip);
  const setCanvasPreset = useEditorStore(s => s.setCanvasPreset);
  
  const [presetOpen, setPresetOpen] = useState(false);
  const presetDropdownRef = useRef<HTMLDivElement>(null);
  
  // 點擊外部關閉 dropdown
  useEffect(() => {
    if (!presetOpen) return;
    const handler = (e: MouseEvent) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target as Node)) {
        setPresetOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [presetOpen]);
  
  const currentPreset = getPresetById(project.canvasPresetId);
  const categories = useMemo(() => {
    const catSet = new Set(CANVAS_PRESETS.map(p => p.category));
    const cats = Array.from(catSet);
    return cats.map(cat => ({
      name: cat,
      presets: CANVAS_PRESETS.filter(p => p.category === cat),
    }));
  }, []);
  
  // 接收外部注入的素材
  const lastInjectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!injectedAsset) return;
    const key = `${injectedAsset.url}-${injectedAsset.type}`;
    if (lastInjectedRef.current === key) return;
    lastInjectedRef.current = key;
    
    addClip({
      type: injectedAsset.type,
      src: injectedAsset.url,
      label: injectedAsset.label,
    });
    onAssetInjected?.();
  }, [injectedAsset, addClip, onAssetInjected]);
  
  // 鍵盤快捷鍵(只在桌面)
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    
    if (e.code === 'Space') {
      e.preventDefault();
      e.stopPropagation();
      // canvasPanning 只有在按住空白+拖拽時才為 true，
      // 單純按空白鍵應觸發播放/暫停
      if (!useEditorStore.getState().canvasPanning) {
        useEditorStore.getState().togglePlay();
      }
      // 讓按鈕失焦,避免下次空白變成「再次點擊按鈕」
      if (target.tagName === 'BUTTON') target.blur();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        (useEditorStore as typeof useEditorStore).temporal.getState().redo();
      } else {
        (useEditorStore as typeof useEditorStore).temporal.getState().undo();
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const sel = useEditorStore.getState().selectedClipId;
      if (sel) {
        e.preventDefault();
        useEditorStore.getState().removeClip(sel);
      }
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
  
  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-neutral-300 hover:text-white"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold">{project.name}</h1>
          <span className="text-xs text-neutral-500">·</span>
          {/* 畫布尺寸選擇器 */}
          <div ref={presetDropdownRef} className="relative">
            <button
              onClick={() => setPresetOpen(!presetOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
            >
              <span>{currentPreset?.name ?? project.canvasPresetId}</span>
              <span className="text-neutral-500">{currentPreset ? `${currentPreset.width}×${currentPreset.height}` : ''}</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
            </button>
            
            {presetOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900/98 shadow-2xl backdrop-blur z-50">
                {categories.map(cat => (
                  <div key={cat.name}>
                    <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      {cat.name}
                    </div>
                    {cat.presets.map(preset => {
                      const isActive = project.canvasPresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => {
                            setCanvasPreset(preset.id);
                            setPresetOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm transition ${
                            isActive
                              ? 'bg-blue-500/15 text-blue-400'
                              : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {isActive && <Check className="w-3.5 h-3.5" />}
                            <span className={isActive ? '' : 'ml-5.5'}>{preset.name}</span>
                          </span>
                          <span className="text-xs text-neutral-500">{preset.width}×{preset.height}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
        >
          <Share2 className="w-4 h-4" />
          匯出
        </button>
      </header>
      
      {/* 預覽區 */}
      <div className="flex-1 min-h-0 p-2 lg:p-4">
        <Stage />
      </div>
      
      {/* 工具列 */}
      <Toolbar onAddMedia={(type) => onPickMedia?.(type)} />
      
      {/* 時間軸 */}
      <Timeline />
      
      {/* 文字編輯 sheet */}
      <TextEditSheet />
    </div>
  );
};