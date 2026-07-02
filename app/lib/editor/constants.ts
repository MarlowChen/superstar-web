import { CanvasPreset } from './types';

export const CANVAS_PRESETS: CanvasPreset[] = [
  // 社群媒體
  { id: 'instagram-post',    name: 'Instagram 貼文',    width: 1080, height: 1080, category: '社群媒體', aspectRatio: '1:1' },
  { id: 'instagram-story',   name: 'Instagram 限動',    width: 1080, height: 1920, category: '社群媒體', aspectRatio: '9:16' },
  { id: 'facebook-post',     name: 'Facebook 貼文',     width: 940,  height: 788,  category: '社群媒體', aspectRatio: '1:1' },
  { id: 'twitter-post',      name: 'Twitter 貼文',      width: 1200, height: 675,  category: '社群媒體', aspectRatio: '16:9' },
  { id: 'pinterest-pin',     name: 'Pinterest Pin',     width: 1000, height: 1500, category: '社群媒體', aspectRatio: '4:5' },
  { id: 'line-post',         name: 'LINE 貼文',         width: 1200, height: 1200, category: '社群媒體', aspectRatio: '1:1' },
  // 影片
  { id: 'youtube-thumb',     name: 'YouTube 縮圖',      width: 1280, height: 720,  category: '影片',     aspectRatio: '16:9' },
  { id: 'youtube-video',     name: 'YouTube 影片',      width: 1920, height: 1080, category: '影片',     aspectRatio: '16:9' },
  { id: 'tiktok-video',      name: 'TikTok 影片',       width: 1080, height: 1920, category: '影片',     aspectRatio: '9:16' },
  { id: 'shorts-reels',      name: 'Shorts / Reels',    width: 1080, height: 1920, category: '影片',     aspectRatio: '9:16' },
  // 簡報 / 文件
  { id: 'presentation-16-9', name: '簡報 16:9',         width: 1920, height: 1080, category: '簡報',     aspectRatio: '16:9' },
  { id: 'presentation-4-3',  name: '簡報 4:3',          width: 1024, height: 768,  category: '簡報',     aspectRatio: '16:9' },
  // 廣告
  { id: 'fb-ad',             name: 'FB 廣告',           width: 1200, height: 628,  category: '廣告',     aspectRatio: '16:9' },
  { id: 'ig-ad-portrait',    name: 'IG 廣告 直式',      width: 1080, height: 1350, category: '廣告',     aspectRatio: '4:5' },
];

export const EDITOR_TOKENS = {
  trackHeight: {
    video: 56,
    audio: 40,
    text: 36,
  },
  trackGap: 4,
  defaultSecondsPerScreen: 10,
  minZoom: 0.25,
  maxZoom: 8,
  minClipDuration: 0.5,
  trimHandleHitWidth: 24,
  clipColors: [
    '#5B8DEF', '#F2994A', '#6FCF97', '#BB6BD9',
    '#EB5757', '#2D9CDB', '#F2C94C', '#56CCF2',
  ],
  /** 根據 canvasPresetId 取得 base 維度 */
  stageBaseDimensions: {
    '9:16': { width: 1080, height: 1920 },
    '16:9': { width: 1920, height: 1080 },
    '1:1':  { width: 1080, height: 1080 },
    '4:5':  { width: 1080, height: 1350 },
  },
} as const;