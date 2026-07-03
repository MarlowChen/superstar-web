'use client';

import React from 'react';

import {
  Play, Pause, SkipBack, SkipForward, Scissors, Trash2,
  Type, Music, Image as ImageIcon, Undo2, Redo2, Magnet, ArrowLeftRight,
} from 'lucide-react';
import { getTotalDuration } from '@/app/lib/editor/selectors';
import { useEditorStore, editorUndo, editorRedo } from '@/app/lib/editor/store';
import { formatTime } from '@/app/lib/editor/utils';

interface Props {
  onAddMedia: (type: 'video' | 'image' | 'audio') => void;
}

const blurOnUp = (e: React.PointerEvent) => {
  (e.currentTarget as HTMLElement).blur();
};

export const Toolbar: React.FC<Props> = ({ onAddMedia }) => {
  const playhead = useEditorStore(s => s.playhead);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const togglePlay = useEditorStore(s => s.togglePlay);
  const seek = useEditorStore(s => s.seek);
  const splitClipAtPlayhead = useEditorStore(s => s.splitClipAtPlayhead);
  const removeClip = useEditorStore(s => s.removeClip);
  const selectedId = useEditorStore(s => s.selectedClipId);
  const addClip = useEditorStore(s => s.addClip);
  const setEditingText = useEditorStore(s => s.setEditingText);
  const snapEnabled = useEditorStore(s => s.snapEnabled);
  const swapMode = useEditorStore(s => s.swapMode);
  const toggleSnap = useEditorStore(s => s.toggleSnap);
  const toggleSwapMode = useEditorStore(s => s.toggleSwapMode);
  
  const totalDuration = getTotalDuration(useEditorStore.getState());
  
  const handleAddText = () => {
    const id = addClip({
      type: 'text',
      text: '輸入文字',
      duration: 5,
      textStyle: {
        fontFamily: 'sans-serif',
        fontSize: 0.06,
        color: '#FFFFFF',
        fontWeight: 'bold',
        align: 'center',
        lineHeight: 1.2,
        letterSpacing: 0,
      },
    });
    setEditingText(id);
  };
  
  const tools = [
    { icon: Scissors, label: '分割', onClick: splitClipAtPlayhead },
    { icon: Type,     label: '文字', onClick: handleAddText },
    { icon: Music,    label: '音樂', onClick: () => onAddMedia('audio') },
    { icon: ImageIcon, label: '圖片', onClick: () => onAddMedia('image') },
    {
      icon: Trash2,
      label: '刪除',
      onClick: () => selectedId && removeClip(selectedId),
      disabled: !selectedId,
    },
  ];
  
  return (
    <div className="bg-neutral-900 border-t border-neutral-800">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-2 py-2 sm:grid sm:grid-cols-[auto_1fr_8rem] sm:px-4">
        <div className="order-2 flex items-center gap-1 sm:order-none sm:justify-self-start">
          <button
            onClick={editorUndo}
            onPointerUp={blurOnUp}
            className="p-2 text-neutral-400 hover:text-white transition"
            title="復原 (Ctrl+Z)"
            aria-label="復原"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={editorRedo}
            onPointerUp={blurOnUp}
            className="p-2 text-neutral-400 hover:text-white transition"
            title="重做 (Ctrl+Shift+Z)"
            aria-label="重做"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          
          <div className="w-px h-5 bg-neutral-700 mx-1" />
          
          <button
            onClick={toggleSnap}
            onPointerUp={blurOnUp}
            className={`p-2 rounded transition ${
              snapEnabled
                ? 'text-blue-400 bg-blue-500/10'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="磁性吸附"
            aria-label="切換磁性吸附"
            aria-pressed={snapEnabled}
          >
            <Magnet className="w-4 h-4" />
          </button>
          <button
            onClick={toggleSwapMode}
            onPointerUp={blurOnUp}
            className={`p-2 rounded transition ${
              swapMode
                ? 'text-orange-400 bg-orange-500/10'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="交換模式"
            aria-label="切換交換模式"
            aria-pressed={swapMode}
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="order-1 flex w-full items-center justify-center gap-2 sm:order-none sm:w-auto sm:gap-3">
          <span className="text-xs text-neutral-400 tabular-nums">
            {formatTime(playhead)}
          </span>
          <button
            onClick={() => seek(Math.max(0, playhead - 5))}
            onPointerUp={blurOnUp}
            className="p-2 text-white hover:bg-neutral-800 rounded-full transition"
            aria-label="倒退 5 秒"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={togglePlay}
            onPointerUp={blurOnUp}
            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition"
            aria-label={isPlaying ? '暫停' : '播放'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button
            onClick={() => seek(Math.min(totalDuration, playhead + 5))}
            onPointerUp={blurOnUp}
            className="p-2 text-white hover:bg-neutral-800 rounded-full transition"
            aria-label="快轉 5 秒"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <span className="text-xs text-neutral-400 tabular-nums">
            {formatTime(totalDuration)}
          </span>
        </div>
        
        <div className="hidden w-32 sm:block" />
      </div>
      
      <div className="flex gap-1 px-2 pb-2 overflow-x-auto">
        {tools.map(tool => (
          <button
            key={tool.label}
            onClick={tool.onClick}
            onPointerUp={blurOnUp}
            disabled={tool.disabled}
            className="flex flex-col items-center justify-center min-w-[64px] px-3 py-2 rounded-lg text-neutral-300 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label={tool.label}
          >
            <tool.icon className="w-5 h-5 mb-1" />
            <span className="text-[10px]">{tool.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
