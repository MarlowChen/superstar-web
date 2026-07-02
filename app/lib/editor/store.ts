import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  EditorState, Project, Clip, Track, AspectRatio, ClipType, TrackType,
  DEFAULT_TRANSFORM, DEFAULT_TEXT_TRANSFORM,
} from './types';
import { EDITOR_TOKENS, CANVAS_PRESETS } from './constants';
import { nextClipId, clamp } from './utils';

interface Actions {
  loadProject: (p: Project) => void;
  setCanvasPreset: (presetId: string) => void;
  setAspectRatio: (r: AspectRatio) => void;
  
  addClip: (input: Partial<Clip> & { type: ClipType }) => string;
  removeClip: (id: string) => void;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  splitClipAtPlayhead: () => void;
  trimClip: (id: string, side: 'left' | 'right', deltaSec: number) => void;
  selectClip: (id: string | null) => void;
  swapClips: (aId: string, bId: string) => void;
  
  addTrack: (type: TrackType) => void;
  removeTrack: (id: string) => void;
  
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (t: number) => void;
  
  setZoom: (z: number) => void;
  setIsTrimming: (v: boolean) => void;
  setEditingText: (id: string | null) => void;
  setInlineEditing: (id: string | null) => void;
  setCanvasPanning: (v: boolean) => void;
  
  toggleSnap: () => void;
  toggleSwapMode: () => void;
  setSwapDragState: (state: {
    sourceId: string | null;
    targetId: string | null;
    ghostOffset: number | null;
  }) => void;
}

const createDefaultProject = (): Project => ({
  id: `project-${Date.now()}`,
  name: '新專案',
  canvasPresetId: 'instagram-story',
  fps: 30,
  tracks: [
    { id: 'video-1', type: 'video', clips: [], hidden: false },
    { id: 'audio-1', type: 'audio', clips: [], hidden: false },
    { id: 'text-1',  type: 'text',  clips: [], hidden: false },
  ],
});

const initial: EditorState = {
  project: createDefaultProject(),
  playhead: 0,
  isPlaying: false,
  zoom: 1,
  selectedClipId: null,
  isTrimming: false,
  editingTextId: null,
  inlineEditingClipId: null,
  canvasPanning: false,
  snapEnabled: true,
  swapMode: false,
  swapSourceId: null,
  swapTargetId: null,
  swapGhostOffset: null,
};

export const useEditorStore = create<EditorState & Actions>()(
  temporal(
    (set, get) => ({
      ...initial,
      
      loadProject: (project) => set({ project, playhead: 0, selectedClipId: null }),
      
      setCanvasPreset: (presetId) => set(s => ({
        project: { ...s.project, canvasPresetId: presetId },
      })),
      
      setAspectRatio: (ratio) => {
        // 根據 ratio 找到最接近的預設
        const preset = CANVAS_PRESETS.find(p => p.aspectRatio === ratio);
        if (preset) {
          set(s => ({ project: { ...s.project, canvasPresetId: preset.id } }));
        }
      },
      
      addClip: (input) => {
        const state = get();
        const wantType: TrackType = input.type === 'audio' ? 'audio'
                                  : input.type === 'text'  ? 'text'
                                  : 'video';
        const trackId = input.trackId
          ?? state.project.tracks.find(t => t.type === wantType)?.id;
        if (!trackId) return '';
        
        const track = state.project.tracks.find(t => t.id === trackId);
        if (!track) return '';
        
        const lastEnd = track.clips.reduce(
          (max, c) => Math.max(max, c.start + c.duration), 0
        );
        
        const totalClips = state.project.tracks.reduce((n, t) => n + t.clips.length, 0);
        const colorIdx = totalClips % EDITOR_TOKENS.clipColors.length;
        
        const newClip: Clip = {
          id: input.id ?? nextClipId(),
          trackId,
          type: input.type,
          start: input.start ?? lastEnd,
          duration: input.duration ?? (input.type === 'audio' ? 10 : 5),
          offset: 0,
          sourceDuration: input.sourceDuration,
          src: input.src,
          transform: input.transform ?? (input.type === 'text' ? { ...DEFAULT_TEXT_TRANSFORM } : { ...DEFAULT_TRANSFORM }),
          label: input.label ?? (
            input.type === 'video' ? '影片' :
            input.type === 'image' ? '圖片' :
            input.type === 'audio' ? '音樂' : '文字'
          ),
          color: input.color ?? EDITOR_TOKENS.clipColors[colorIdx],
          speed: 1,
          volume: 1,
          muted: false,
          text: input.text,
          textStyle: input.textStyle,
        };
        
        set(s => ({
          project: {
            ...s.project,
            tracks: s.project.tracks.map(t =>
              t.id === trackId
                ? { ...t, clips: [...t.clips, newClip].sort((a, b) => a.start - b.start) }
                : t
            ),
          },
          selectedClipId: newClip.id,
        }));
        
        return newClip.id;
      },
      
      removeClip: (id) => set(s => ({
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t => ({
            ...t,
            clips: t.clips.filter(c => c.id !== id),
          })),
        },
        selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
      })),
      
      updateClip: (id, updates) => set(s => ({
        project: {
          ...s.project,
          tracks: s.project.tracks.map(t => ({
            ...t,
            clips: t.clips.map(c => c.id === id ? { ...c, ...updates } : c),
          })),
        },
      })),
      
      splitClipAtPlayhead: () => {
        const state = get();
        const playhead = state.playhead;
        
        let foundClip: Clip | null = null;
        let foundTrack: Track | null = null;
        
        for (const t of state.project.tracks) {
          const c = t.clips.find(c =>
            playhead > c.start && playhead < c.start + c.duration
          );
          if (c) { foundClip = c; foundTrack = t; break; }
        }
        if (!foundClip || !foundTrack) return;
        
        const localTime = playhead - foundClip.start;
        const min = EDITOR_TOKENS.minClipDuration;
        if (localTime < min || localTime > foundClip.duration - min) return;
        
        const left: Clip = {
          ...foundClip,
          id: nextClipId(),
          duration: localTime,
          label: foundClip.label + ' (1)',
        };
        const right: Clip = {
          ...foundClip,
          id: nextClipId(),
          start: foundClip.start + localTime,
          duration: foundClip.duration - localTime,
          offset: foundClip.offset + localTime,
          label: foundClip.label + ' (2)',
        };
        
        set(s => ({
          project: {
            ...s.project,
            tracks: s.project.tracks.map(t =>
              t.id === foundTrack!.id
                ? {
                    ...t,
                    clips: t.clips.flatMap(c => c.id === foundClip!.id ? [left, right] : [c])
                                  .sort((a, b) => a.start - b.start),
                  }
                : t
            ),
          },
          selectedClipId: right.id,
        }));
      },
      
      trimClip: (id, side, deltaSec) => set(s => {
        const min = EDITOR_TOKENS.minClipDuration;
        return {
          project: {
            ...s.project,
            tracks: s.project.tracks.map(t => ({
              ...t,
              clips: t.clips.map(c => {
                if (c.id !== id) return c;
                
                if (side === 'right') {
                  let newDur = c.duration + deltaSec;
                  if (c.type === 'video' && c.sourceDuration) {
                    newDur = Math.min(newDur, c.sourceDuration - c.offset);
                  }
                  newDur = Math.max(min, newDur);
                  return { ...c, duration: newDur };
                } else {
                  const desiredOffset = c.offset + deltaSec;
                  const desiredDur = c.duration - deltaSec;
                  
                  if (desiredOffset < 0) {
                    return {
                      ...c,
                      offset: 0,
                      duration: c.duration + c.offset,
                      start: c.start - c.offset,
                    };
                  }
                  if (desiredDur < min) {
                    const adjustment = c.duration - min;
                    return {
                      ...c,
                      offset: c.offset + adjustment,
                      duration: min,
                      start: c.start + adjustment,
                    };
                  }
                  return {
                    ...c,
                    offset: desiredOffset,
                    duration: desiredDur,
                    start: c.start + deltaSec,
                  };
                }
              }),
            })),
          },
        };
      }),
      
      selectClip: (id) => set({ selectedClipId: id }),
      
      swapClips: (aId, bId) => set(s => {
        if (aId === bId) return s;
        
        let clipA: Clip | null = null;
        let clipB: Clip | null = null;
        
        for (const t of s.project.tracks) {
          for (const c of t.clips) {
            if (c.id === aId) clipA = c;
            if (c.id === bId) clipB = c;
          }
        }
        if (!clipA || !clipB) return s;
        
        const aStart = clipA.start;
        const aTrackId = clipA.trackId;
        const bStart = clipB.start;
        const bTrackId = clipB.trackId;
        
        return {
          project: {
            ...s.project,
            tracks: s.project.tracks.map(t => {
              const filtered = t.clips.filter(c => c.id !== aId && c.id !== bId);
              const additions: Clip[] = [];
              if (t.id === bTrackId) {
                additions.push({ ...clipA!, start: bStart, trackId: bTrackId });
              }
              if (t.id === aTrackId) {
                additions.push({ ...clipB!, start: aStart, trackId: aTrackId });
              }
              return {
                ...t,
                clips: [...filtered, ...additions].sort((x, y) => x.start - y.start),
              };
            }),
          },
        };
      }),
      
      addTrack: (type) => set(s => {
        const count = s.project.tracks.filter(t => t.type === type).length;
        const newTrack: Track = {
          id: `${type}-${count + 1}`,
          type,
          clips: [],
          hidden: false,
        };
        return { project: { ...s.project, tracks: [...s.project.tracks, newTrack] } };
      }),
      
      removeTrack: (id) => set(s => ({
        project: {
          ...s.project,
          tracks: s.project.tracks.filter(t => t.id !== id),
        },
      })),
      
      play: () => set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      togglePlay: () => set(s => ({ isPlaying: !s.isPlaying })),
      seek: (t) => set({ playhead: Math.max(0, t) }),
      
      setZoom: (z) => set({ zoom: clamp(z, EDITOR_TOKENS.minZoom, EDITOR_TOKENS.maxZoom) }),
      setIsTrimming: (v) => set({ isTrimming: v }),
      setEditingText: (id) => set({ editingTextId: id }),
      setInlineEditing: (id) => set({ inlineEditingClipId: id }),
      setCanvasPanning: (v) => set({ canvasPanning: v }),
      
      toggleSnap: () => set(s => ({ snapEnabled: !s.snapEnabled })),
      toggleSwapMode: () => set(s => ({ swapMode: !s.swapMode })),
      setSwapDragState: ({ sourceId, targetId, ghostOffset }) => set({
        swapSourceId: sourceId,
        swapTargetId: targetId,
        swapGhostOffset: ghostOffset,
      }),
    }),
    {
      partialize: (s) => ({ project: s.project, selectedClipId: s.selectedClipId } as EditorState),
      limit: 50,
    }
  )
);

export const editorUndo = () => (useEditorStore as typeof useEditorStore).temporal.getState().undo();
export const editorRedo = () => (useEditorStore as typeof useEditorStore).temporal.getState().redo();
