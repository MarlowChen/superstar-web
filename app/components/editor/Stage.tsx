'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useEditorStore } from '../../lib/editor/store';
import { getActiveClipsAt, getMediaTime } from '../../lib/editor/selectors';
import { fitStageInContainer, transformToPixels, getAspectRatioFromPreset, fitContentTransform, getPresetById } from '../../lib/editor/utils';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

/** 縮放手柄位置 */
type HandlePos = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;

export const Stage: React.FC = () => {
  const project = useEditorStore(s => s.project);
  const playhead = useEditorStore(s => s.playhead);
  const isPlaying = useEditorStore(s => s.isPlaying);
  const selectedClipId = useEditorStore(s => s.selectedClipId);
  const inlineEditingClipId = useEditorStore(s => s.inlineEditingClipId);
  const updateClip = useEditorStore(s => s.updateClip);
  const seek = useEditorStore(s => s.seek);
  const pause = useEditorStore(s => s.pause);
  const selectClip = useEditorStore(s => s.selectClip);
  const setEditingText = useEditorStore(s => s.setEditingText);
  const setInlineEditing = useEditorStore(s => s.setInlineEditing);
  const setCanvasPanning = useEditorStore(s => s.setCanvasPanning);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState({ width: 0, height: 0 });
  const [viewZoom, setViewZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  // refs 供手勢 handler 使用
  const viewZoomRef = useRef(viewZoom);
  viewZoomRef.current = viewZoom;
  const containerSizeRef = useRef(container);
  containerSizeRef.current = container;

  const inlineEditRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainer({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // 切換預設時重置縮放與平移
  useEffect(() => {
    setViewZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [project.canvasPresetId]);

  const aspectRatio = getAspectRatioFromPreset(project.canvasPresetId);
  const stage = fitStageInContainer(container.width, container.height, aspectRatio, viewZoom);

  // ─── 空白鍵追蹤 ───
  // 不攔截 keydown，只追蹤按住狀態供平移使用
  // 播放/暫停由 Editor.tsx 的 keydown 處理
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (useEditorStore.getState().inlineEditingClipId) return;
      setIsSpaceHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      setIsSpaceHeld(false);
      setIsPanning(false);
      setCanvasPanning(false);
    };
    const onBlur = () => {
      setIsSpaceHeld(false);
      setIsPanning(false);
      setCanvasPanning(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [setCanvasPanning]);

  // ─── 空白+拖拽平移 ───
  const handlePanPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isSpaceHeld) return;
    e.preventDefault();
    e.stopPropagation();
    setIsPanning(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startPan = { ...panOffset };

    const handleMove = (ev: PointerEvent) => {
      setPanOffset({
        x: startPan.x + ev.clientX - startX,
        y: startPan.y + ev.clientY - startY,
      });
    };
    const handleUp = () => {
      setIsPanning(false);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, [isSpaceHeld, panOffset]);

  // ─── 滾輪縮放（朝游標位置） ───
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const oldZoom = viewZoomRef.current;
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round((oldZoom + delta) * 100) / 100));
    if (newZoom === oldZoom) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const currentAspect = getAspectRatioFromPreset(project.canvasPresetId);
    const newStage = fitStageInContainer(container.width, container.height, currentAspect, newZoom);
    const ratio = newZoom / oldZoom;

    setPanOffset(prev => ({
      x: mx - newStage.offsetX - (mx - stage.offsetX - prev.x) * ratio,
      y: my - newStage.offsetY - (my - stage.offsetY - prev.y) * ratio,
    }));
    setViewZoom(newZoom);
  }, [container, stage, project.canvasPresetId]);

  // ─── 手機雙指縮放 + 平移 ───
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let active = false;
    let lastDist = 0;
    let lastMidX = 0;
    let lastMidY = 0;

    const getDist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      active = true;
      lastDist = getDist(e.touches);
      lastMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      lastMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active || e.touches.length !== 2) return;
      e.preventDefault();

      const dist = getDist(e.touches);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      // 縮放
      const scale = dist / lastDist;
      const oldZoom = viewZoomRef.current;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * scale));

      // 平移
      const dx = midX - lastMidX;
      const dy = midY - lastMidY;

      if (newZoom !== oldZoom) {
        const rect = el.getBoundingClientRect();
        const mx = midX - rect.left;
        const my = midY - rect.top;
        const currentAspect = getAspectRatioFromPreset(useEditorStore.getState().project.canvasPresetId);
        const cs = containerSizeRef.current;
        const newStage = fitStageInContainer(cs.width, cs.height, currentAspect, newZoom);
        const ratio = newZoom / oldZoom;
        const currentStage = fitStageInContainer(cs.width, cs.height, currentAspect, oldZoom);

        setPanOffset(prev => ({
          x: mx - newStage.offsetX - (mx - currentStage.offsetX - prev.x) * ratio + dx,
          y: my - newStage.offsetY - (my - currentStage.offsetY - prev.y) * ratio + dy,
        }));
      } else {
        setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      }

      setViewZoom(newZoom);
      lastDist = dist;
      lastMidX = midX;
      lastMidY = midY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) active = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // 所有影片預先掛載
  const allVideoClips = useMemo(
    () => project.tracks.flatMap(t => t.clips).filter(c => c.type === 'video'),
    [project.tracks]
  );

  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const playheadRef = useRef(playhead);
  playheadRef.current = playhead;

  // 統一播放循環
  useEffect(() => {
    if (!isPlaying) {
      videoRefs.current.forEach(v => v.pause());
      return;
    }
    let lastTick = performance.now();
    let rafId = 0;
    const tick = () => {
      const now = performance.now();
      const delta = (now - lastTick) / 1000;
      lastTick = now;
      const next = playheadRef.current + delta;
      const state = useEditorStore.getState();
      let total = 0;
      for (const t of state.project.tracks) {
        for (const c of t.clips) {
          const end = c.start + c.duration;
          if (end > total) total = end;
        }
      }
      if (next >= total) { seek(0); pause(); return; }
      seek(next);
      const activeClips = getActiveClipsAt(state, next);
      const activeIds = new Set(activeClips.map(c => c.id));
      videoRefs.current.forEach((video, clipId) => {
        const clip = allVideoClips.find(c => c.id === clipId);
        if (!clip) return;
        if (activeIds.has(clipId)) {
          const mediaTime = getMediaTime(clip, next);
          if (Math.abs(video.currentTime - mediaTime) > 0.25) video.currentTime = mediaTime;
          if (video.paused) video.play().catch(() => { });
        } else {
          if (!video.paused) video.pause();
        }
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, allVideoClips, seek, pause]);

  // 暫停時 scrub 同步
  useEffect(() => {
    if (isPlaying) return;
    const state = useEditorStore.getState();
    const active = getActiveClipsAt(state, playhead);
    active.forEach(clip => {
      if (clip.type !== 'video') return;
      const v = videoRefs.current.get(clip.id);
      if (!v) return;
      const mediaTime = getMediaTime(clip, playhead);
      if (Math.abs(v.currentTime - mediaTime) > 0.1) v.currentTime = mediaTime;
      v.pause();
    });
  }, [playhead, isPlaying]);

  const activeClips = getActiveClipsAt(useEditorStore.getState(), playhead);
  const activeIds = new Set(activeClips.map(c => c.id));

  // ─── 通用 clip 拖拽（文字/圖片/影片） ───
  const handleClipPointerDown = useCallback((clipId: string, clipType?: 'video' | 'image' | 'audio' | 'text') => (e: React.PointerEvent<HTMLDivElement>) => {
    if (isSpaceHeld) return; // 平移模式中不拖
    if (clipType === 'text' && e.detail > 1) return; // 雙擊文字時不要先進拖曳
    const clip = useEditorStore.getState().project.tracks
      .flatMap(track => track.clips)
      .find(item => item.id === clipId);
    if (!clip || !stageRef.current) return;
    // inline editing 中的文字不拖
    if (clip.type === 'text' && useEditorStore.getState().inlineEditingClipId === clipId) return;

    e.stopPropagation();
    selectClip(clipId);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    if (isPlaying) pause();

    const startX = e.clientX;
    const startY = e.clientY;
    const startTransform = clip.transform;
    const halfWidth = startTransform.width / 2;
    const halfHeight = startTransform.height / 2;

    const handleMove = (ev: PointerEvent) => {
      const deltaX = (ev.clientX - startX) / stage.width;
      const deltaY = (ev.clientY - startY) / stage.height;
      const nextX = Math.max(halfWidth, Math.min(1 - halfWidth, startTransform.x + deltaX));
      const nextY = Math.max(halfHeight, Math.min(1 - halfHeight, startTransform.y + deltaY));
      // 移動時內容跟著一起動
      const cdx = nextX - startTransform.x;
      const cdy = nextY - startTransform.y;
      updateClip(clipId, { transform: { ...startTransform, x: nextX, y: nextY, contentX: startTransform.contentX + cdx, contentY: startTransform.contentY + cdy } });
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, [isSpaceHeld, isPlaying, pause, selectClip, stage.width, stage.height, updateClip]);

  // ─── 通用 clip 手柄拖拽（Canva 風格,純像素計算) ───
  // 角落 (nw/ne/sw/se) = 等比縮放
  // 邊 (n/s/w/e):
  //   外拉 = 等比放大整個元素(container + content 同步)
  //   內推 = 純裁切(container 縮小,content 不變)
  const handleResizePointerDown = useCallback((clipId: string, pos: HandlePos) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const clip = useEditorStore.getState().project.tracks.flatMap(t => t.clips).find(c => c.id === clipId);
    if (!clip) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    if (isPlaying) pause();

    // 取得 stage 在螢幕上的位置(用來把 clientX/Y 換算成 stage 內座標)
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const stageRect = stageEl.getBoundingClientRect();

    // 凍結初始狀態(stage 內絕對像素)
    const startT = { ...clip.transform };
    const S_frameLeft = (startT.x - startT.width / 2) * stage.width;
    const S_frameRight = (startT.x + startT.width / 2) * stage.width;
    const S_frameTop = (startT.y - startT.height / 2) * stage.height;
    const S_frameBottom = (startT.y + startT.height / 2) * stage.height;
    const S_frameW = S_frameRight - S_frameLeft;
    const S_frameH = S_frameBottom - S_frameTop;
    const S_imgCx = startT.contentX * stage.width;
    const S_imgCy = startT.contentY * stage.height;
    const S_imgW = startT.contentWidth * stage.width;
    const S_imgH = startT.contentHeight * stage.height;

    // 滑鼠在 stage 內的起始座標
    const startMouseStageX = e.clientX - stageRect.left;
    const startMouseStageY = e.clientY - stageRect.top;

    // 滑鼠相對於「目前那個邊」的偏移(這樣拖曳時不會跳動)
    let mouseOffsetX = 0;
    let mouseOffsetY = 0;
    if (pos === 'e' || pos === 'ne' || pos === 'se') mouseOffsetX = startMouseStageX - S_frameRight;
    if (pos === 'w' || pos === 'nw' || pos === 'sw') mouseOffsetX = startMouseStageX - S_frameLeft;
    if (pos === 's' || pos === 'se' || pos === 'sw') mouseOffsetY = startMouseStageY - S_frameBottom;
    if (pos === 'n' || pos === 'ne' || pos === 'nw') mouseOffsetY = startMouseStageY - S_frameTop;

    const isCorner = pos === 'nw' || pos === 'ne' || pos === 'sw' || pos === 'se';
    const MIN = 24;

    const handleMove = (ev: PointerEvent) => {
      // 滑鼠在 stage 內的當前座標
      const mouseStageX = ev.clientX - stageRect.left - mouseOffsetX;
      const mouseStageY = ev.clientY - stageRect.top - mouseOffsetY;

      // 直接從滑鼠座標算新的 frame 邊界
      let frameLeft = S_frameLeft;
      let frameRight = S_frameRight;
      let frameTop = S_frameTop;
      let frameBottom = S_frameBottom;

      if (pos === 'e') frameRight = Math.max(S_frameLeft + MIN, mouseStageX);
      else if (pos === 'w') frameLeft = Math.min(S_frameRight - MIN, mouseStageX);
      else if (pos === 's') frameBottom = Math.max(S_frameTop + MIN, mouseStageY);
      else if (pos === 'n') frameTop = Math.min(S_frameBottom - MIN, mouseStageY);
      else if (isCorner) {
        // 角落:等比縮放
        const aspect = S_frameW / S_frameH;
        if (pos === 'se') {
          frameRight = Math.max(S_frameLeft + MIN, mouseStageX);
          frameBottom = S_frameTop + (frameRight - S_frameLeft) / aspect;
        } else if (pos === 'nw') {
          frameLeft = Math.min(S_frameRight - MIN, mouseStageX);
          frameTop = S_frameBottom - (S_frameRight - frameLeft) / aspect;
        } else if (pos === 'ne') {
          frameRight = Math.max(S_frameLeft + MIN, mouseStageX);
          frameTop = S_frameBottom - (frameRight - S_frameLeft) / aspect;
        } else if (pos === 'sw') {
          frameLeft = Math.min(S_frameRight - MIN, mouseStageX);
          frameBottom = S_frameTop + (S_frameRight - frameLeft) / aspect;
        }
      }

      // 算底圖
      let imgCx = S_imgCx;
      let imgCy = S_imgCy;
      let imgW = S_imgW;
      let imgH = S_imgH;

      if (isCorner) {
        const scale = (frameRight - frameLeft) / S_frameW;
        imgW = S_imgW * scale;
        imgH = S_imgH * scale;
        const newFrameCx = (frameLeft + frameRight) / 2;
        const newFrameCy = (frameTop + frameBottom) / 2;
        const oldFrameCx = (S_frameLeft + S_frameRight) / 2;
        const oldFrameCy = (S_frameTop + S_frameBottom) / 2;
        imgCx = newFrameCx + (S_imgCx - oldFrameCx) * scale;
        imgCy = newFrameCy + (S_imgCy - oldFrameCy) * scale;
      } else {
        const newW = frameRight - frameLeft;
        const newH = frameBottom - frameTop;

        let anchorX = S_imgCx;
        let anchorY = S_imgCy;
        let scale = 1;

        const S_ImageLeft = S_imgCx - S_imgW / 2;
        const S_ImageRight = S_imgCx + S_imgW / 2;
        const S_ImageTop = S_imgCy - S_imgH / 2;
        const S_ImageBottom = S_imgCy + S_imgH / 2;

        if (pos === 'w') {
          const limitW = S_frameRight - S_ImageLeft;
          if (newW > limitW) { // Scale（超過底圖邊界才放大）
            scale = newW / limitW;
            anchorX = S_frameRight;
            anchorY = S_imgCy - S_imgH / 2; // 鎖死 contentOffsetY
          } else { // Crop / Uncrop
            imgCx = S_imgCx + (frameLeft - S_frameLeft);
          }
        } else if (pos === 'e') {
          const limitW = S_ImageRight - S_frameLeft;
          if (newW > limitW) {
            scale = newW / limitW;
            anchorX = S_frameLeft;
            anchorY = S_imgCy - S_imgH / 2; // 鎖死 contentOffsetY
          } else {
            imgCx = S_imgCx;
          }
        } else if (pos === 'n') {
          const limitH = S_frameBottom - S_ImageTop;
          if (newH > limitH) {
            scale = newH / limitH;
            anchorY = S_frameBottom;
            anchorX = S_imgCx - S_imgW / 2; // 鎖死 contentOffsetX 避免往左漂移留白
          } else {
            imgCy = S_imgCy + (frameTop - S_frameTop);
          }
        } else if (pos === 's') {
          const limitH = S_ImageBottom - S_frameTop;
          if (newH > limitH) {
            scale = newH / limitH;
            anchorY = S_frameTop;
            anchorX = S_imgCx - S_imgW / 2; // 鎖死 contentOffsetX 避免往左漂移留白
          } else {
            imgCy = S_imgCy;
          }
        }

        if (scale !== 1) {
          imgW = S_imgW * scale;
          imgH = S_imgH * scale;
          imgCx = anchorX + (S_imgCx - anchorX) * scale;
          imgCy = anchorY + (S_imgCy - anchorY) * scale;
        }
      }

      const newFrameW = frameRight - frameLeft;
      const newFrameH = frameBottom - frameTop;

      updateClip(clipId, {
        transform: {
          ...startT,
          x: (frameLeft + newFrameW / 2) / stage.width,
          y: (frameTop + newFrameH / 2) / stage.height,
          width: newFrameW / stage.width,
          height: newFrameH / stage.height,
          contentX: imgCx / stage.width,
          contentY: imgCy / stage.height,
          contentWidth: imgW / stage.width,
          contentHeight: imgH / stage.height,
        },
      });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, [isPlaying, pause, stage.width, stage.height, updateClip]);

  // ─── 雙擊進入 inline 編輯 ───
  const handleTextDoubleClick = useCallback((clipId: string) => () => {
    if (isSpaceHeld) return;
    setInlineEditing(clipId);
    setEditingText(clipId);
  }, [isSpaceHeld, setInlineEditing, setEditingText]);

  useEffect(() => {
    if (inlineEditingClipId && inlineEditRef.current) {
      inlineEditRef.current.focus();
      inlineEditRef.current.select();
    }
  }, [inlineEditingClipId]);

  // 點擊畫布空白處取消選取
  const handleStageClick = useCallback((e: React.MouseEvent) => {
    if (isSpaceHeld) return;
    if (e.target === stageRef.current || e.target === containerRef.current) {
      selectClip(null);
      setInlineEditing(null);
      setEditingText(null);
    }
  }, [isSpaceHeld, selectClip, setInlineEditing, setEditingText]);

  const getHandleStyle = (pos: HandlePos): React.CSSProperties => {
    const cornerSize = 10;
    const edgeWidth = 20;
    const edgeThick = 6;
    const offset = -cornerSize / 2;
    const base: React.CSSProperties = {
      position: 'absolute',
      borderRadius: 2,
      backgroundColor: '#3b82f6',
      border: '1.5px solid white',
      zIndex: 20,
    };
    switch (pos) {
      case 'nw': return { ...base, width: cornerSize, height: cornerSize, top: offset, left: offset, cursor: 'nwse-resize' };
      case 'ne': return { ...base, width: cornerSize, height: cornerSize, top: offset, right: offset, cursor: 'nesw-resize' };
      case 'sw': return { ...base, width: cornerSize, height: cornerSize, bottom: offset, left: offset, cursor: 'nesw-resize' };
      case 'se': return { ...base, width: cornerSize, height: cornerSize, bottom: offset, right: offset, cursor: 'nwse-resize' };
      case 'n': return { ...base, width: edgeWidth, height: edgeThick, top: -edgeThick / 2, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' };
      case 's': return { ...base, width: edgeWidth, height: edgeThick, bottom: -edgeThick / 2, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' };
      case 'w': return { ...base, width: edgeThick, height: edgeWidth, left: -edgeThick / 2, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' };
      case 'e': return { ...base, width: edgeThick, height: edgeWidth, right: -edgeThick / 2, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' };
    }
  };

  const zoomPercent = Math.round(viewZoom * 100);


  // 游標：平移模式優先
  const cursorStyle = isPanning ? 'grabbing' : isSpaceHeld ? 'grab' : undefined;

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* 工作區 */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden"
        onClick={handleStageClick}
        onWheel={handleWheel}
        onPointerDown={handlePanPointerDown}
        style={{ background: '#18181b', cursor: cursorStyle }}
      >
        <div
          ref={stageRef}
          className="absolute bg-white"
          style={{
            width: stage.width,
            height: stage.height,
            left: stage.offsetX + panOffset.x,
            top: stage.offsetY + panOffset.y,
            boxShadow: '0 2px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
            overflow: 'hidden',
            cursor: cursorStyle,
          }}
        >
          {/* 影片層 - 可拖曳/等比縮放/裁切 */}
          {allVideoClips.map(clip => {
            const isActive = activeIds.has(clip.id);
            const px = transformToPixels(clip.transform, stage.width, stage.height);
            const isSelected = selectedClipId === clip.id;
            return (
              <div key={clip.id}
                onPointerDown={isActive ? handleClipPointerDown(clip.id, clip.type) : undefined}
                className="absolute select-none"
                style={{
                  width: px.width, height: px.height, left: px.left, top: px.top,
                  opacity: isActive ? clip.transform.opacity : 0,
                  transform: `rotate(${px.rotation}deg)`,
                  cursor: isSpaceHeld ? cursorStyle : isSelected ? 'grab' : 'pointer',
                  pointerEvents: isActive ? 'auto' : 'none',
                  zIndex: isSelected ? 10 : isActive ? 1 : -1,
                  overflow: 'visible',
                }}
                onClick={e => { if (!isSpaceHeld) { e.stopPropagation(); selectClip(clip.id); } }}
              >
                {isSelected && <div className="absolute inset-0 pointer-events-none" style={{ border: '1.5px solid #3b82f6', borderRadius: 2 }} />}
                {isSelected && (
                  <>
                    <div style={getHandleStyle('nw')} onPointerDown={handleResizePointerDown(clip.id, 'nw')} />
                    <div style={getHandleStyle('ne')} onPointerDown={handleResizePointerDown(clip.id, 'ne')} />
                    <div style={getHandleStyle('sw')} onPointerDown={handleResizePointerDown(clip.id, 'sw')} />
                    <div style={getHandleStyle('se')} onPointerDown={handleResizePointerDown(clip.id, 'se')} />
                    <div style={getHandleStyle('n')} onPointerDown={handleResizePointerDown(clip.id, 'n')} />
                    <div style={getHandleStyle('s')} onPointerDown={handleResizePointerDown(clip.id, 's')} />
                    <div style={getHandleStyle('w')} onPointerDown={handleResizePointerDown(clip.id, 'w')} />
                    <div style={getHandleStyle('e')} onPointerDown={handleResizePointerDown(clip.id, 'e')} />
                  </>
                )}
                <div className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none">
                  <video
                    ref={el => { if (el) videoRefs.current.set(clip.id, el); else videoRefs.current.delete(clip.id); }}
                    src={clip.src} playsInline muted={clip.muted} preload="auto"
                    style={{
                      position: 'absolute',
                      width: px.contentWidth, height: px.contentHeight,
                      left: px.contentOffsetX, top: px.contentOffsetY,
                      objectFit: 'fill', pointerEvents: 'none',
                    }}
                    onLoadedMetadata={e => {
                      const v = e.currentTarget;
                      const dur = v.duration;
                      if (dur && !clip.sourceDuration) updateClip(clip.id, { sourceDuration: dur, duration: clip.duration === 5 ? dur : clip.duration });
                      if (v.videoWidth && v.videoHeight && clip.transform.contentWidth === 1 && clip.transform.contentHeight === 1) {
                        const preset = getPresetById(project.canvasPresetId);
                        const fit = fitContentTransform(v.videoWidth, v.videoHeight, preset?.width ?? 1080, preset?.height ?? 1920);
                        updateClip(clip.id, { transform: { ...clip.transform, ...fit, contentX: 0.5, contentY: 0.5 } });
                      }
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* 圖片層 - 可拖曳/等比縮放/裁切 */}
          {activeClips.filter(c => c.type === 'image').map(clip => {
            const px = transformToPixels(clip.transform, stage.width, stage.height);

            const isSelected = selectedClipId === clip.id;
            return (
              <div key={clip.id}
                onPointerDown={handleClipPointerDown(clip.id, clip.type)}
                className="absolute select-none"
                style={{
                  width: px.width, height: px.height, left: px.left, top: px.top,
                  opacity: clip.transform.opacity, transform: `rotate(${px.rotation}deg)`,
                  cursor: isSpaceHeld ? cursorStyle : isSelected ? 'grab' : 'pointer',
                  pointerEvents: 'auto', zIndex: isSelected ? 10 : 5,
                  overflow: 'visible',
                }}
                onClick={e => { if (!isSpaceHeld) { e.stopPropagation(); selectClip(clip.id); } }}
              >
                {isSelected && <div className="absolute inset-0 pointer-events-none" style={{ border: '1.5px solid #3b82f6', borderRadius: 2 }} />}
                {isSelected && (
                  <>
                    <div style={getHandleStyle('nw')} onPointerDown={handleResizePointerDown(clip.id, 'nw')} />
                    <div style={getHandleStyle('ne')} onPointerDown={handleResizePointerDown(clip.id, 'ne')} />
                    <div style={getHandleStyle('sw')} onPointerDown={handleResizePointerDown(clip.id, 'sw')} />
                    <div style={getHandleStyle('se')} onPointerDown={handleResizePointerDown(clip.id, 'se')} />
                    <div style={getHandleStyle('n')} onPointerDown={handleResizePointerDown(clip.id, 'n')} />
                    <div style={getHandleStyle('s')} onPointerDown={handleResizePointerDown(clip.id, 's')} />
                    <div style={getHandleStyle('w')} onPointerDown={handleResizePointerDown(clip.id, 'w')} />
                    <div style={getHandleStyle('e')} onPointerDown={handleResizePointerDown(clip.id, 'e')} />
                  </>
                )}
                <div className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none">
                  <img src={clip.src} alt="" style={{
                    position: 'absolute',
                    width: px.contentWidth, height: px.contentHeight,
                    left: px.contentOffsetX, top: px.contentOffsetY,
                    objectFit: 'cover', pointerEvents: 'none',
                  }}
                    onLoad={e => {
                      const img = e.currentTarget;
                      if (img.naturalWidth && img.naturalHeight && clip.transform.contentWidth === 1 && clip.transform.contentHeight === 1) {
                        const preset = getPresetById(project.canvasPresetId);
                        const fit = fitContentTransform(img.naturalWidth, img.naturalHeight, preset?.width ?? 1080, preset?.height ?? 1920);
                        updateClip(clip.id, { transform: { ...clip.transform, ...fit, contentX: 0.5, contentY: 0.5 } });
                      }
                    }}
                  />
                </div>
              </div>
            );
          })}



          {/* 音訊(隱形播放) */}
          {project.tracks.filter(t => t.type === 'audio').flatMap(t => t.clips).map(clip => {
            const isActive = activeIds.has(clip.id);
            return <audio key={clip.id} src={clip.src} ref={el => {
              if (!el) return;
              if (isActive) {
                const mediaTime = getMediaTime(clip, playhead);
                if (Math.abs(el.currentTime - mediaTime) > 0.25) el.currentTime = mediaTime;
                if (isPlaying && el.paused) el.play().catch(() => { });
                else if (!isPlaying && !el.paused) el.pause();
              } else { if (!el.paused) el.pause(); }
            }} />;
          })}

          {/* 文字層 - Canva 風格 */}
          {activeClips.filter(c => c.type === 'text').map(clip => {
            const px = transformToPixels(clip.transform, stage.width, stage.height);
            const fontSize = (clip.textStyle?.fontSize ?? 0.06) * stage.height;
            const isSelected = selectedClipId === clip.id;
            const isInlineEditing = inlineEditingClipId === clip.id;

            return (
              <div key={clip.id}
                onPointerDown={handleClipPointerDown(clip.id, clip.type)}
                onDoubleClick={e => {
                  e.stopPropagation();
                  handleTextDoubleClick(clip.id)();
                }}
                className="absolute select-none"
                style={{
                  width: px.width, height: px.height, left: px.left, top: px.top,
                  transform: `rotate(${px.rotation}deg)`,
                  cursor: isSpaceHeld ? cursorStyle : isInlineEditing ? 'text' : isSelected ? 'grab' : 'pointer',
                  pointerEvents: 'auto', zIndex: isSelected ? 10 : 5,
                  overflow: 'visible',
                }}
              >
                {isSelected && !isInlineEditing && <div className="absolute inset-0 pointer-events-none" style={{ border: '1.5px solid #3b82f6', borderRadius: 2 }} />}
                {isSelected && !isInlineEditing && (
                  <>
                    <div style={getHandleStyle('nw')} onPointerDown={handleResizePointerDown(clip.id, 'nw')} />
                    <div style={getHandleStyle('ne')} onPointerDown={handleResizePointerDown(clip.id, 'ne')} />
                    <div style={getHandleStyle('sw')} onPointerDown={handleResizePointerDown(clip.id, 'sw')} />
                    <div style={getHandleStyle('se')} onPointerDown={handleResizePointerDown(clip.id, 'se')} />
                    <div style={getHandleStyle('n')} onPointerDown={handleResizePointerDown(clip.id, 'n')} />
                    <div style={getHandleStyle('s')} onPointerDown={handleResizePointerDown(clip.id, 's')} />
                    <div style={getHandleStyle('w')} onPointerDown={handleResizePointerDown(clip.id, 'w')} />
                    <div style={getHandleStyle('e')} onPointerDown={handleResizePointerDown(clip.id, 'e')} />
                  </>
                )}
                {isInlineEditing ? (
                  <textarea
                    ref={inlineEditRef}
                    value={clip.text ?? ''}
                    onChange={e => updateClip(clip.id, { text: e.target.value })}
                    onBlur={() => setInlineEditing(null)}
                    onMouseDown={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    className="w-full h-full bg-transparent resize-none focus:outline-none p-1"
                    style={{
                      fontSize, color: clip.textStyle?.color ?? '#fff',
                      fontWeight: clip.textStyle?.fontWeight ?? 'bold',
                      textAlign: clip.textStyle?.align ?? 'center',
                      fontFamily: clip.textStyle?.fontFamily ?? 'sans-serif',
                      letterSpacing: clip.textStyle?.letterSpacing,
                      lineHeight: clip.textStyle?.lineHeight ?? 1.2,
                      border: '1.5px dashed #3b82f6', borderRadius: 2,
                      textShadow: '1px 1px 3px rgba(0,0,0,0.4)',
                    }}
                  />
                ) : (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute',
                      width: px.contentWidth, height: px.contentHeight,
                      left: px.contentOffsetX, top: px.contentOffsetY,
                    }}>
                      <span style={{
                        fontSize, color: clip.textStyle?.color ?? '#fff',
                        fontWeight: clip.textStyle?.fontWeight ?? 'bold',
                        textAlign: clip.textStyle?.align ?? 'center',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.6)',
                        fontFamily: clip.textStyle?.fontFamily ?? 'sans-serif',
                        letterSpacing: clip.textStyle?.letterSpacing,
                        lineHeight: clip.textStyle?.lineHeight ?? 1.2,
                        whiteSpace: 'pre-wrap', width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center',
                        justifyContent: clip.textStyle?.align === 'left' ? 'flex-start' : clip.textStyle?.align === 'right' ? 'flex-end' : 'center',
                        overflow: 'hidden', padding: '4px',
                      }}>
                        {clip.text}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 縮放控制條 */}
      <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-900/80 border-t border-neutral-800 shrink-0">
        <button onClick={() => setViewZoom(z => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100))}
          className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition" title="縮小">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => { setViewZoom(1); setPanOffset({ x: 0, y: 0 }); }}
          className="px-2 py-1 rounded-md text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition tabular-nums min-w-[3rem] text-center"
          title="重設為 100%">
          {zoomPercent}%
        </button>
        <button onClick={() => setViewZoom(z => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100))}
          className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition" title="放大">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-neutral-700 mx-1" />
        <button onClick={() => { setViewZoom(1); setPanOffset({ x: 0, y: 0 }); }}
          className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition" title="最適大小">
          <Maximize className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
