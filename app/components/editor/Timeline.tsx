'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditorStore } from '../../lib/editor/store';
import { getTotalDuration } from '../../lib/editor/selectors';
import { EDITOR_TOKENS } from '../../lib/editor/constants';
import { TrackRow } from './TrackRow';
import { formatTime } from '../../lib/editor/utils';


export const Timeline: React.FC = () => {
  const project = useEditorStore(s => s.project);
  const playhead = useEditorStore(s => s.playhead);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const isTrimming = useEditorStore(s => s.isTrimming);
  const zoom = useEditorStore(s => s.zoom);
  const setZoom = useEditorStore(s => s.setZoom);
  const seek = useEditorStore(s => s.seek);
  const pause = useEditorStore(s => s.pause);
  const selectClip = useEditorStore(s => s.selectClip);
  
  const totalDuration = getTotalDuration(useEditorStore.getState());
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  
  useEffect(() => {
    if (!scrollRef.current) return;
    const ro = new ResizeObserver(entries => {
      setViewportWidth(entries[0].contentRect.width);
    });
    ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, []);
  
  // 預設「視窗寬度顯示 N 秒」,zoom 是乘數
  const pixelsPerSecond = viewportWidth > 0
    ? (viewportWidth / EDITOR_TOKENS.defaultSecondsPerScreen) * zoom
    : 50;
  
  // Timeline 內容總寬度(至少撐滿視窗)
  const contentWidth = Math.max(
    totalDuration * pixelsPerSecond + 200, // 末尾留一點空間
    viewportWidth
  );
  
  // ============================================
  // 播放時 auto-follow:playhead 跑出視窗才捲動
  // ============================================
  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return;
    
    const playheadX = playhead * pixelsPerSecond;
    const scrollLeft = scrollRef.current.scrollLeft;
    const visibleLeft = scrollLeft;
    
    // 留 20% 邊距,playhead 跑到視窗右側 80% 就捲動
    const threshold = viewportWidth * 0.8;
    
    if (playheadX > visibleLeft + threshold) {
      // 往右捲,讓 playhead 回到視窗左側 20% 的位置
      scrollRef.current.scrollLeft = playheadX - viewportWidth * 0.2;
    } else if (playheadX < visibleLeft) {
      // 往左跑出去了,拉回來
      scrollRef.current.scrollLeft = playheadX - viewportWidth * 0.2;
    }
  }, [playhead, isPlaying, pixelsPerSecond, viewportWidth]);
  
  // ============================================
  // 拖曳 playhead(三角形把手)
  // ============================================
  const handlePlayheadPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    
    if (isPlaying) pause();
    
    const startX = e.clientX;
    const startPlayhead = playhead;
    
    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const deltaSec = dx / pixelsPerSecond;
      const newTime = Math.max(0, Math.min(totalDuration, startPlayhead + deltaSec));
      seek(newTime);
      
      // 拖到視窗邊緣自動捲動
      if (scrollRef.current) {
        const rect = scrollRef.current.getBoundingClientRect();
        const edgeThreshold = 40;
        if (ev.clientX > rect.right - edgeThreshold) {
          scrollRef.current.scrollLeft += 8;
        } else if (ev.clientX < rect.left + edgeThreshold) {
          scrollRef.current.scrollLeft -= 8;
        }
      }
    };
    
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, [playhead, pixelsPerSecond, totalDuration, isPlaying, pause, seek]);
  
  // ============================================
  // 點刻度區 → playhead 跳到該位置
  // ============================================
  const handleRulerPointerDown = useCallback((e: React.PointerEvent) => {
    if (isTrimming) return;
    if (!innerRef.current) return;
    
    const rect = innerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, Math.min(totalDuration, x / pixelsPerSecond));
    
    if (isPlaying) pause();
    seek(time);
    
    // 進入拖曳模式
    const handleMove = (ev: PointerEvent) => {
      const mx = ev.clientX - rect.left;
      const t = Math.max(0, Math.min(totalDuration, mx / pixelsPerSecond));
      seek(t);
    };
    
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [pixelsPerSecond, totalDuration, isPlaying, pause, seek, isTrimming]);
  
  // ============================================
  // 縮放
  // ============================================
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(zoom * factor);
    }
  }, [zoom, setZoom]);
  
  const pinchRef = useRef<{ initialDist: number; initialZoom: number } | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = {
        initialDist: Math.sqrt(dx * dx + dy * dy),
        initialZoom: zoom,
      };
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / pinchRef.current.initialDist;
      setZoom(pinchRef.current.initialZoom * ratio);
    }
  };
  
  const handleTouchEnd = () => {
    pinchRef.current = null;
  };
  
  // ============================================
  // 渲染刻度
  // ============================================
  const ruler = [];
  const interval = totalDuration > 60 ? 5 : pixelsPerSecond > 80 ? 0.5 : 1;
  for (let i = 0; i <= totalDuration; i += interval) {
    const isMajor = i % (interval * 5) < 0.001 || interval >= 1;
    ruler.push(
      <div
        key={i}
        className="absolute top-0 flex flex-col items-center pointer-events-none"
        style={{ left: i * pixelsPerSecond }}
      >
        <div
          className={isMajor ? 'w-px h-3 bg-neutral-500' : 'w-px h-1.5 bg-neutral-700'}
        />
        {isMajor && (
          <span className="text-[9px] text-neutral-500 mt-0.5 tabular-nums">
            {formatTime(i)}
          </span>
        )}
      </div>
    );
  }
  
  // Playhead 在 inner 內的絕對位置
  const playheadX = playhead * pixelsPerSecond;
  
  return (
    <div className="relative bg-neutral-900 border-t border-neutral-800">
      <div
        ref={scrollRef}
        data-editor-timeline-scroll="true"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={(e) => {
          // 點空白處取消選取
          if (e.target === e.currentTarget) selectClip(null);
        }}
        className="overflow-x-auto overflow-y-hidden relative"
        style={{
          height: 220,
          touchAction: isTrimming ? 'none' : 'pan-x',
          overscrollBehavior: 'contain',
        }}
      >
        {/* 內部容器 — playhead 和 clips 都釘在這上面 */}
        <div
          ref={innerRef}
          className="relative"
          style={{
            width: contentWidth,
            paddingTop: 8,
          }}
        >
          {/* 刻度區(可點擊拖曳跳轉) */}
          <div
            className="relative h-7 cursor-pointer select-none"
            style={{ width: contentWidth }}
            onPointerDown={handleRulerPointerDown}
          >
            {ruler}
          </div>
          
          {/* 軌道 */}
          <div style={{ width: contentWidth }}>
            {project.tracks.map(track => (
              <TrackRow
                key={track.id}
                track={track}
                pixelsPerSecond={pixelsPerSecond}
              />
            ))}
          </div>
          
          {/* Playhead — 絕對定位,跟著時間跑 */}
          <div
            className="absolute top-0 bottom-0 z-50 pointer-events-none"
            style={{
              left: playheadX,
              width: 0,
            }}
          >
            {/* 紅線 */}
            <div
              className="absolute top-0 bottom-0 bg-red-500"
              style={{
                left: -1,
                width: 2,
              }}
            />
            
            {/* 三角形把手(可拖) */}
            <div
              onPointerDown={handlePlayheadPointerDown}
              className="absolute top-0 cursor-ew-resize pointer-events-auto touch-none"
              style={{
                left: -10,
                width: 20,
                height: 16,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div
                className="w-0 h-0"
                style={{
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: '12px solid #ef4444',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
