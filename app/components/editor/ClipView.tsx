'use client';

import React, { useRef, useCallback } from 'react';
import { Video, Image as ImageIcon, Music, Type, ArrowLeftRight } from 'lucide-react';
import { useEditorStore } from '@/app/lib/editor/store';
import { Clip } from '@/app/lib/editor/types';
import { snapStart, findClipUnderPoint } from '@/app/lib/editor/utils';

interface Props {
  clip: Clip;
  pixelsPerSecond: number;
  trackHeight: number;
}

export const ClipView: React.FC<Props> = ({ clip, pixelsPerSecond, trackHeight }) => {
  const selectedId = useEditorStore(s => s.selectedClipId);
  const swapTargetId = useEditorStore(s => s.swapTargetId);
  const swapGhostOffset = useEditorStore(s => s.swapGhostOffset);
  const swapSourceId = useEditorStore(s => s.swapSourceId);
  const selectClip = useEditorStore(s => s.selectClip);
  const trimClip = useEditorStore(s => s.trimClip);
  const updateClip = useEditorStore(s => s.updateClip);
  const setIsTrimming = useEditorStore(s => s.setIsTrimming);
  const pause = useEditorStore(s => s.pause);
  const setEditingText = useEditorStore(s => s.setEditingText);
  const swapClips = useEditorStore(s => s.swapClips);
  const setSwapDragState = useEditorStore(s => s.setSwapDragState);
  const swapMode = useEditorStore(s => s.swapMode);
  
  const isSelected = selectedId === clip.id;
  const isSwapSource = swapSourceId === clip.id;
  const isSwapTarget = swapTargetId === clip.id;
  
  const width = Math.max(clip.duration * pixelsPerSecond, 30);
  const left = clip.start * pixelsPerSecond;
  
  const renderLeft = isSwapSource && swapGhostOffset !== null
    ? left + swapGhostOffset
    : isSwapTarget && swapSourceId
      ? (() => {
          const state = useEditorStore.getState();
          const source = state.project.tracks
            .flatMap(t => t.clips)
            .find(c => c.id === swapSourceId);
          return source ? source.start * pixelsPerSecond : left;
        })()
      : left;
  
  const trimStateRef = useRef({ active: false, lastDx: 0 });
  const dragStateRef = useRef({
    active: false,
    startX: 0,
    startStart: 0,
    startScrollLeft: 0,
    swapTargetId: null as string | null,
  });
  
  const handleTrimPointerDown = useCallback(
    (side: 'left' | 'right') => (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      
      pause();
      setIsTrimming(true);
      trimStateRef.current = { active: true, lastDx: 0 };
      
      const startX = e.clientX;
      
      const handleMove = (ev: PointerEvent) => {
        if (!trimStateRef.current.active) return;
        const dx = ev.clientX - startX;
        const incrementalDx = dx - trimStateRef.current.lastDx;
        const deltaSec = incrementalDx / pixelsPerSecond;
        
        if (Math.abs(deltaSec) >= 0.03) {
          trimClip(clip.id, side, deltaSec);
          trimStateRef.current.lastDx = dx;
        }
      };
      
      const handleUp = () => {
        trimStateRef.current.active = false;
        setIsTrimming(false);
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
      };
      
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    },
    [clip.id, pixelsPerSecond, trimClip, setIsTrimming, pause]
  );
  
  const handleClipPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    selectClip(clip.id);
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const scrollContainer = target.closest('[data-editor-timeline-scroll="true"]') as HTMLDivElement | null;
    
    pause();
    
    dragStateRef.current = {
      active: false,
      startX: e.clientX,
      startStart: clip.start,
      startScrollLeft: scrollContainer?.scrollLeft ?? 0,
      swapTargetId: null,
    };
    
    const DRAG_THRESHOLD = 4;
    const SNAP_THRESHOLD_PX = 10;
    
    const handleMove = (ev: PointerEvent) => {
      const currentScrollLeft = scrollContainer?.scrollLeft ?? dragStateRef.current.startScrollLeft;
      let dx = ev.clientX - dragStateRef.current.startX + (currentScrollLeft - dragStateRef.current.startScrollLeft);
      
      if (!dragStateRef.current.active && Math.abs(dx) < DRAG_THRESHOLD) return;
      dragStateRef.current.active = true;
      
      const state = useEditorStore.getState();

      if (scrollContainer) {
        const rect = scrollContainer.getBoundingClientRect();
        const edgeThreshold = 56;
        const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
        let nextScrollLeft = scrollContainer.scrollLeft;

        if (ev.clientX > rect.right - edgeThreshold) {
          const ratio = (ev.clientX - (rect.right - edgeThreshold)) / edgeThreshold;
          nextScrollLeft = Math.min(maxScrollLeft, nextScrollLeft + Math.max(6, ratio * 18));
        } else if (ev.clientX < rect.left + edgeThreshold) {
          const ratio = ((rect.left + edgeThreshold) - ev.clientX) / edgeThreshold;
          nextScrollLeft = Math.max(0, nextScrollLeft - Math.max(6, ratio * 18));
        }

        if (nextScrollLeft !== scrollContainer.scrollLeft) {
          scrollContainer.scrollLeft = nextScrollLeft;
          dx = ev.clientX - dragStateRef.current.startX + (nextScrollLeft - dragStateRef.current.startScrollLeft);
        }
      }
      
      if (state.swapMode) {
        const deltaSec = dx / pixelsPerSecond;
        const tentativeStart = Math.max(0, dragStateRef.current.startStart + deltaSec);
        const centerTime = tentativeStart + clip.duration / 2;
        
        const targetClip = findClipUnderPoint(
          clip.id,
          centerTime,
          clip.trackId,
          state.project.tracks,
        );
        
        dragStateRef.current.swapTargetId = targetClip?.id ?? null;
        
        setSwapDragState({
          sourceId: clip.id,
          targetId: targetClip?.id ?? null,
          ghostOffset: dx,
        });
        return;
      }
      
      const deltaSec = dx / pixelsPerSecond;
      let newStart = Math.max(0, dragStateRef.current.startStart + deltaSec);
      const allClips = state.project.tracks.flatMap(t => t.clips);
      
      if (state.snapEnabled) {
        const thresholdSec = SNAP_THRESHOLD_PX / pixelsPerSecond;
        const snap = snapStart(
          clip.id,
          newStart,
          clip.duration,
          allClips,
          state.playhead,
          thresholdSec,
        );
        newStart = snap.start;
      }
      
      updateClip(clip.id, { start: newStart });
    };
    
    const handleUp = () => {
      const state = useEditorStore.getState();
      
      if (state.swapMode && dragStateRef.current.swapTargetId) {
        swapClips(clip.id, dragStateRef.current.swapTargetId);
      }
      
      setSwapDragState({ sourceId: null, targetId: null, ghostOffset: null });
      
      dragStateRef.current.active = false;
      dragStateRef.current.swapTargetId = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, [clip.id, clip.start, clip.duration, clip.trackId, pixelsPerSecond, selectClip, updateClip, pause, swapClips, setSwapDragState]);
  
  const Icon = clip.type === 'video' ? Video
             : clip.type === 'image' ? ImageIcon
             : clip.type === 'audio' ? Music
             : Type;
  
  const isAnyDragging = swapSourceId !== null;
  
  return (
    <>
      <div
        onPointerDown={handleClipPointerDown}
        onDoubleClick={() => {
          if (clip.type === 'text') setEditingText(clip.id);
        }}
        className="absolute top-0 rounded-lg overflow-hidden flex items-center cursor-grab active:cursor-grabbing select-none touch-none"
        style={{
          width,
          left: renderLeft,
          height: trackHeight,
          backgroundColor: clip.color,
          outline: isSelected
            ? '2px solid #3b82f6'
            : isSwapTarget
              ? '2px solid #f97316'
              : (swapMode ? '1px dashed rgba(255,255,255,0.4)' : 'none'),
          outlineOffset: -2,
          boxShadow: isSwapTarget
            ? '0 0 20px rgba(249,115,22,0.6)'
            : isSelected
              ? '0 0 0 1px rgba(59,130,246,0.5)'
              : 'none',
          opacity: isSwapSource ? 0.3 : 1,
          transition: isSwapSource
            ? 'none'
            : (isAnyDragging ? 'left 0.2s ease-out, box-shadow 0.15s ease-out' : 'box-shadow 0.15s ease-out'),
          zIndex: isSelected ? 5 : 1,
        }}
      >
        {clip.type === 'image' && clip.src && width > 50 && (
          <img src={clip.src} alt="" className="w-10 h-10 ml-1 rounded object-cover pointer-events-none" />
        )}
        {clip.type !== 'image' && (
          <div className="w-10 h-10 ml-1 rounded bg-black/30 flex items-center justify-center pointer-events-none">
            <Icon className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="flex-1 px-2 min-w-0 pointer-events-none">
          <div className="text-white text-xs font-semibold truncate">{clip.label}</div>
          <div className="text-white/70 text-[10px]">{clip.duration.toFixed(1)}s</div>
        </div>
        
        {swapMode && !isAnyDragging && (
          <div className="absolute top-1 right-1 pointer-events-none">
            <ArrowLeftRight className="w-3 h-3 text-white/70" />
          </div>
        )}
      </div>
      
      {isSwapSource && swapGhostOffset !== null && (
        <div
          className="absolute top-0 rounded-lg overflow-hidden flex items-center pointer-events-none"
          style={{
            width,
            left: left + swapGhostOffset,
            height: trackHeight,
            backgroundColor: clip.color,
            outline: '2px solid #f97316',
            outlineOffset: -2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(249,115,22,0.8)',
            opacity: 0.95,
            transform: 'scale(1.04)',
            zIndex: 100,
            transition: 'none',
          }}
        >
          {clip.type === 'image' && clip.src && width > 50 && (
            <img src={clip.src} alt="" className="w-10 h-10 ml-1 rounded object-cover" />
          )}
          {clip.type !== 'image' && (
            <div className="w-10 h-10 ml-1 rounded bg-black/30 flex items-center justify-center">
              <Icon className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="flex-1 px-2 min-w-0">
            <div className="text-white text-xs font-semibold truncate">{clip.label}</div>
            <div className="text-white/70 text-[10px]">{clip.duration.toFixed(1)}s</div>
          </div>
        </div>
      )}
      
      {isSelected && !isAnyDragging && (
        <>
          <div
            onPointerDown={handleTrimPointerDown('left')}
            className="absolute z-30 flex items-center justify-center cursor-ew-resize touch-none"
            style={{
              left: left - 12,
              top: -2,
              width: 24,
              height: trackHeight + 4,
            }}
          >
            <div className="w-1 h-1/2 bg-white rounded-full shadow" />
          </div>
          <div
            onPointerDown={handleTrimPointerDown('right')}
            className="absolute z-30 flex items-center justify-center cursor-ew-resize touch-none"
            style={{
              left: left + width - 12,
              top: -2,
              width: 24,
              height: trackHeight + 4,
            }}
          >
            <div className="w-1 h-1/2 bg-white rounded-full shadow" />
          </div>
        </>
      )}
    </>
  );
};
