'use client';

import React, { useEffect, useState } from 'react';
import { useEditorStore } from '../../lib/editor/store';
import { X, Bold, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

const FONTS = [
  { value: 'sans-serif', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Mono' },
  { value: 'cursive', label: 'Cursive' },
];
const COLORS = ['#FFFFFF', '#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#EC4899'];

export const TextEditSheet: React.FC = () => {
  const editingId = useEditorStore(s => s.editingTextId);
  const setEditingText = useEditorStore(s => s.setEditingText);
  const updateClip = useEditorStore(s => s.updateClip);
  const project = useEditorStore(s => s.project);
  const setInlineEditing = useEditorStore(s => s.setInlineEditing);
  
  const clip = editingId
    ? project.tracks.flatMap(t => t.clips).find(c => c.id === editingId)
    : null;
  const clipId = clip?.id;
  const clipText = clip?.text;
  
  const [text, setText] = useState('');
  
  useEffect(() => {
    if (clipId) setText(clipText ?? '');
  }, [clipId, clipText]);
  
  if (!clip) return null;
  
  const close = () => {
    setEditingText(null);
    setInlineEditing(null);
  };

  const style = clip.textStyle ?? {
    fontFamily: 'sans-serif',
    fontSize: 0.06,
    color: '#FFFFFF',
    fontWeight: 'bold' as const,
    align: 'center' as const,
  };

  return (
    <div className="pointer-events-none fixed left-3 right-3 top-[4.75rem] z-40 flex max-h-[42vh] w-auto justify-center sm:left-auto sm:right-4 sm:top-20 sm:max-h-[calc(100vh-10rem)] sm:w-[20rem] sm:justify-end">
      <div className="pointer-events-auto flex w-full flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900/95 shadow-2xl backdrop-blur">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h3 className="text-white font-semibold text-sm">文字設定</h3>
          <button onClick={close} aria-label="關閉文字設定" className="p-1 text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="overflow-y-auto px-4 py-3 space-y-4">
          {/* 文字內容 */}
          <textarea
            value={text}
            onChange={e => {
              const value = e.target.value;
              setText(value);
              updateClip(clip.id, { text: value });
            }}
            rows={3}
            className="w-full bg-neutral-800 text-white rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="輸入文字..."
          />
          
          {/* 字型大小 */}
          <div>
            <div className="text-[11px] text-neutral-400 mb-1.5">字型大小</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0.02}
                max={0.2}
                step={0.005}
                value={style.fontSize}
                onChange={e => updateClip(clip.id, {
                  textStyle: { ...style, fontSize: parseFloat(e.target.value) },
                })}
                className="flex-1"
              />
              <span className="text-xs text-neutral-400 w-10 text-right tabular-nums">
                {Math.round(style.fontSize * 100)}%
              </span>
            </div>
          </div>

          {/* 粗體 & 對齊 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateClip(clip.id, {
                textStyle: { ...style, fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' },
              })}
              className={`p-2 rounded-lg transition ${
                style.fontWeight === 'bold'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
              title="粗體"
            >
              <Bold className="w-4 h-4" />
            </button>
            {[
              { align: 'left' as const, Icon: AlignLeft, label: '靠左' },
              { align: 'center' as const, Icon: AlignCenter, label: '置中' },
              { align: 'right' as const, Icon: AlignRight, label: '靠右' },
            ].map(({ align, Icon, label }) => (
              <button
                key={align}
                onClick={() => updateClip(clip.id, {
                  textStyle: { ...style, align },
                })}
                className={`p-2 rounded-lg transition ${
                  style.align === align
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
                title={label}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* 顏色 */}
          <div>
            <div className="text-[11px] text-neutral-400 mb-1.5">顏色</div>
            <div className="flex gap-1.5 flex-wrap">
              {COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => updateClip(clip.id, {
                    textStyle: { ...style, color },
                  })}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: style.color === color ? '#3B82F6' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>
        
          {/* 字型 */}
          <div>
            <div className="text-[11px] text-neutral-400 mb-1.5">字型</div>
            <div className="flex gap-1.5 flex-wrap">
              {FONTS.map(font => (
                <button
                  key={font.value}
                  onClick={() => updateClip(clip.id, {
                    textStyle: { ...style, fontFamily: font.value },
                  })}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                    style.fontFamily === font.value
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                      : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-neutral-600'
                  }`}
                  style={{ fontFamily: font.value }}
                >
                  {font.label}
                </button>
              ))}
            </div>
          </div>

          {/* 行高 & 字距 */}
          <div>
            <div className="text-[11px] text-neutral-400 mb-1.5">行高</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0.8}
                max={2.5}
                step={0.1}
                value={style.lineHeight ?? 1.2}
                onChange={e => updateClip(clip.id, {
                  textStyle: { ...style, lineHeight: parseFloat(e.target.value) },
                })}
                className="flex-1"
              />
              <span className="text-xs text-neutral-400 w-8 text-right tabular-nums">
                {(style.lineHeight ?? 1.2).toFixed(1)}
              </span>
            </div>
          </div>

          <div>
            <div className="text-[11px] text-neutral-400 mb-1.5">字距</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-2}
                max={12}
                step={0.5}
                value={style.letterSpacing ?? 0}
                onChange={e => updateClip(clip.id, {
                  textStyle: { ...style, letterSpacing: parseFloat(e.target.value) },
                })}
                className="flex-1"
              />
              <span className="text-xs text-neutral-400 w-8 text-right tabular-nums">
                {style.letterSpacing ?? 0}
              </span>
            </div>
          </div>

          {/* 提示 */}
          <div className="text-[10px] text-neutral-500 pt-1 border-t border-neutral-800">
            💡 在畫布上直接拖動文字可調整位置，拖動角點可縮放，雙擊可直接編輯
          </div>
        </div>
      </div>
    </div>
  );
};
