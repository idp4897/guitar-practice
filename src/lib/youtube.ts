// ─── YouTube IFrame API — types + singleton loader + URL parser ───────────────

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  loadVideoById(videoId: string): void;
  destroy(): void;
}

interface YTPlayerOptions {
  videoId?: string;
  width?: number | string;
  height?: number | string;
  playerVars?: {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    rel?: 0 | 1;
    modestbranding?: 0 | 1;
    playsinline?: 0 | 1;
    iv_load_policy?: 1 | 3;
    fs?: 0 | 1;
  };
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    onError?: (event: { data: number; target: YTPlayer }) => void;
  };
}

declare global {
  interface Window {
    YT: {
      Player: new (element: HTMLElement | string, options: YTPlayerOptions) => YTPlayer;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// ─── Player state constants (mirror of YT.PlayerState) ────────────────────────

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

// ─── Error messages ────────────────────────────────────────────────────────────

export const YT_ERROR_MSG: Record<number, string> = {
  2:   'Invalid video ID',
  5:   'HTML5 player error',
  100: 'Video not found or is private',
  101: 'Embedding disabled by video owner',
  150: 'Embedding disabled by video owner',
};

// ─── API singleton loader ──────────────────────────────────────────────────────

let apiState: 'idle' | 'loading' | 'ready' = 'idle';
const readyQueue: Array<() => void> = [];

export function ensureYouTubeApi(onReady: () => void): void {
  if (typeof window === 'undefined') return;

  if (apiState === 'ready') {
    onReady();
    return;
  }

  readyQueue.push(onReady);
  if (apiState === 'loading') return;
  apiState = 'loading';

  // Preserve any existing callback (e.g., from another library)
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    apiState = 'ready';
    if (prev) prev();
    readyQueue.splice(0).forEach((cb) => cb());
  };

  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api';
  script.async = true;
  document.head.appendChild(script);
}

// ─── URL → video ID ───────────────────────────────────────────────────────────

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('?')[0] || null;
    }
    if (u.hostname.includes('youtube.com') || u.hostname.includes('music.youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = u.pathname.match(/\/embed\/([^/?#]+)/);
      if (m) return m[1];
    }
  } catch {
    // fall through to regex
  }
  const m = url.match(/(?:v=|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}
