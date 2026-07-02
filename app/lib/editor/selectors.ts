import { EditorState, Clip } from './types';
import { EDITOR_TOKENS } from './constants';

export function getTotalDuration(state: EditorState): number {
  let max = 0;
  for (const t of state.project.tracks) {
    for (const c of t.clips) {
      const end = c.start + c.duration;
      if (end > max) max = end;
    }
  }
  return Math.max(max, EDITOR_TOKENS.defaultSecondsPerScreen);
}

export function getActiveClipsAt(state: EditorState, time: number): Clip[] {
  const result: Clip[] = [];
  for (const t of state.project.tracks) {
    if (t.hidden) continue;
    for (const c of t.clips) {
      if (time >= c.start && time < c.start + c.duration) {
        result.push(c);
      }
    }
  }
  return result;
}

export function getMediaTime(clip: Clip, timelineTime: number): number {
  return clip.offset + (timelineTime - clip.start);
}