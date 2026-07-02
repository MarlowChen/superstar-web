'use client';

import React from 'react';
import { Track } from '../../lib/editor/types';
import { EDITOR_TOKENS } from '../../lib/editor/constants';
import { ClipView } from './ClipView';

interface Props {
  track: Track;
  pixelsPerSecond: number;
}

export const TrackRow: React.FC<Props> = ({ track, pixelsPerSecond }) => {
  const height = EDITOR_TOKENS.trackHeight[track.type];
  
  return (
    <div
      className="relative"
      style={{
        height,
        marginBottom: EDITOR_TOKENS.trackGap,
        opacity: track.hidden ? 0.3 : 1,
      }}
    >
      {track.clips.map(clip => (
        <ClipView
          key={clip.id}
          clip={clip}
          pixelsPerSecond={pixelsPerSecond}
          trackHeight={height}
        />
      ))}
    </div>
  );
};