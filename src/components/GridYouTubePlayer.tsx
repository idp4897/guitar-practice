'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ensureYouTubeApi, extractVideoId, YT_ERROR_MSG, YT_STATE, type YTPlayer } from '@/lib/youtube';

// ─── GridYouTubePlayer ────────────────────────────────────────────────────────
// A self-contained reference player for the Chord Grid editor. It mirrors the
// song page's transport bar (seek / play-pause / skip / rate) rather than showing
// a visible video: the iframe is clipped to 1×1 so only the controls are visible.
// Standalone by design — it does not touch PlayerPage, so the song page is
// unaffected.

type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface GridYouTubePlayerProps {
  youtubeUrl: string;   // saved song URL — not the live form value
}

export function GridYouTubePlayer({ youtubeUrl }: GridYouTubePlayerProps) {
  const videoId = useMemo(() => extractVideoId(youtubeUrl), [youtubeUrl]);

  const uid   = useId().replace(/:/g, '');
  const domId = `yt-grid-${uid}`;

  const [player, setPlayer]           = useState<YTPlayer | null>(null);
  const [status, setStatus]           = useState<PlayerStatus>(videoId ? 'loading' : 'idle');
  const [playerError, setPlayerError] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [isSeeking, setIsSeeking]     = useState(false);
  const [seekValue, setSeekValue]     = useState(0);
  const [rate, setRate]               = useState(1);
  // mounted guards against SSR/client hydration mismatch on disabled props.
  const [mounted, setMounted]         = useState(false);

  const playerRef = useRef<YTPlayer | null>(null);
  const rafRef    = useRef<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // ── Instantiate the (hidden) YouTube player once per videoId ──────────────────
  useEffect(() => {
    if (!videoId) return;
    let abandoned = false;
    setStatus('loading');
    ensureYouTubeApi(() => {
      if (abandoned || !document.getElementById(domId)) return;
      playerRef.current = new window.YT.Player(domId, {
        videoId,
        width: '200',
        height: '113',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, fs: 0 },
        events: {
          onReady: ({ target }) => {
            if (abandoned) return;
            playerRef.current = target;
            setPlayer(target);
            setStatus('ready');
          },
          onStateChange: ({ data }) => {
            if (abandoned) return;
            if (data === YT_STATE.PLAYING)   setStatus('playing');
            if (data === YT_STATE.PAUSED)    setStatus('paused');
            if (data === YT_STATE.BUFFERING) setStatus('buffering');
            if (data === YT_STATE.ENDED)     setStatus('ended');
            if (data === YT_STATE.UNSTARTED) setStatus('ready');
          },
          onError: ({ data }) => {
            if (abandoned) return;
            setStatus('error');
            setPlayerError(data);
          },
        },
      });
    });
    return () => {
      abandoned = true;
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
      setPlayer(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // ── RAF loop — live time update ───────────────────────────────────────────────
  useEffect(() => {
    if (!player) return;
    const tick = () => {
      if (!isSeeking) setCurrentTime(player.getCurrentTime?.() ?? 0);
      const d = player.getDuration?.() ?? 0;
      if (d > 0) setDuration(d);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [player, isSeeking]);

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading' || status === 'buffering';
  const canPlay = player != null &&
    (status === 'ready' || status === 'playing' || status === 'paused' ||
      status === 'buffering' || status === 'ended');

  const handlePlayPause = () => {
    if (!player) return;
    if (isPlaying) player.pauseVideo();
    else player.playVideo();
  };

  const handleSkip = (delta: number) => {
    if (!player) return;
    const t = Math.max(0, Math.min(duration, (player.getCurrentTime?.() ?? 0) + delta));
    player.seekTo(t, true);
    setCurrentTime(t);
  };

  const handleSeekStart = () => { setIsSeeking(true); setSeekValue(currentTime); };
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setSeekValue(v);
    setCurrentTime(v);
  };
  const handleSeekCommit = () => {
    if (player) player.seekTo(seekValue, true);
    setIsSeeking(false);
  };

  const handleRate = (r: number) => { setRate(r); player?.setPlaybackRate(r); };

  if (!videoId) return null;

  const displayTime = isSeeking ? seekValue : currentTime;
  const progress = duration > 0 ? displayTime / duration : 0;

  return (
    <div className="shrink-0 border-b border-zinc-800 bg-zinc-900">
      {/* Hidden 1×1 iframe — keeps audio playing without showing the video */}
      <div className="fixed bottom-0 right-0 pointer-events-none"
        style={{ width: 1, height: 1, overflow: 'hidden' }} aria-hidden>
        <div id={domId} />
      </div>

      {!mounted ? null : status === 'error' ? (
        <div className="flex items-center px-4 py-3">
          <p className="text-sm text-red-400">
            {YT_ERROR_MSG[playerError ?? 0] ?? 'Player error — video may be unavailable'}
          </p>
        </div>
      ) : (
        <>
          {/* Progress row */}
          <div className="flex items-center gap-3 px-4 pt-3 pb-1">
            <span className="text-xs text-zinc-400 tabular-nums w-[2.75rem] text-right shrink-0">
              {formatTime(displayTime)}
            </span>
            <div className="flex-1 relative h-5 flex items-center">
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.1}
                value={isSeeking ? seekValue : currentTime}
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
                onChange={handleSeekChange}
                onMouseUp={handleSeekCommit}
                onTouchEnd={handleSeekCommit}
                disabled={Boolean(!canPlay || duration === 0)}
                aria-label="Seek"
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                  disabled:cursor-default
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500
                  [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-sm
                  [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                  [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-amber-500
                  [&::-moz-range-thumb]:border-0"
                style={{
                  background: `linear-gradient(to right, #f59e0b ${progress * 100}%, #3f3f46 ${progress * 100}%)`,
                }}
              />
            </div>
            <span className="text-xs text-zinc-600 tabular-nums w-[2.75rem] shrink-0">
              {duration > 0 ? formatTime(duration) : '--:--'}
            </span>
          </div>

          {/* Controls row */}
          <div className="flex items-center px-4 pb-3 gap-1">
            <button onClick={() => handleSkip(-10)} disabled={Boolean(!canPlay)}
              aria-label="Skip back 10s"
              className="flex items-center justify-center w-10 h-10 rounded-lg
                text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800
                disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation">
              <SkipBackIcon />
            </button>

            <button onClick={handlePlayPause} disabled={Boolean(!canPlay && !isLoading)}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className={[
                'flex items-center justify-center w-12 h-12 rounded-full transition-colors touch-manipulation',
                isLoading
                  ? 'bg-zinc-700 text-zinc-400 cursor-wait'
                  : canPlay
                    ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400 active:bg-amber-300'
                    : 'bg-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed',
              ].join(' ')}>
              {isLoading ? <SpinnerIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            <button onClick={() => handleSkip(10)} disabled={Boolean(!canPlay)}
              aria-label="Skip forward 10s"
              className="flex items-center justify-center w-10 h-10 rounded-lg
                text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800
                disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation">
              <SkipForwardIcon />
            </button>

            <div className="flex-1" />

            {(status === 'loading' || status === 'buffering') && (
              <span className="text-[10px] text-yellow-400 font-medium uppercase tracking-wide mr-2">
                {status}
              </span>
            )}
            {status === 'ended' && (
              <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide mr-2">
                ended
              </span>
            )}

            {/* Playback rate */}
            <div className="flex gap-0.5 bg-zinc-800 rounded-lg p-0.5">
              {([0.5, 0.75, 1] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRate(r)}
                  aria-pressed={rate === r}
                  className={[
                    'px-2 py-1.5 rounded-md text-xs font-medium transition-colors touch-manipulation',
                    rate === r
                      ? 'bg-zinc-600 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300',
                  ].join(' ')}>
                  {r}×
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="3" width="4" height="18" rx="1" />
      <rect x="15" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="19,20 9,12 19,4" fill="currentColor" stroke="none" />
      <line x1="5" y1="4" x2="5" y2="20" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5,4 15,12 5,20" fill="currentColor" stroke="none" />
      <line x1="19" y1="4" x2="19" y2="20" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      className="animate-spin">
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}
