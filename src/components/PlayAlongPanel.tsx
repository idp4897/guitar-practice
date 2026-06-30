'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { extractChords } from '@/domain/music/chordpro';
import { type ChordCue, type ChordProSheet } from '@/domain/music/types';
import { ensureYouTubeApi, extractVideoId, YT_ERROR_MSG, YT_STATE, type YTPlayer } from '@/lib/youtube';

// ─── Binary search: largest index i where chordMap[i].time <= time ────────────

function findCueIndex(cues: ChordCue[], time: number): number {
  let lo = 0, hi = cues.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (cues[mid].time <= time) { result = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }
  return result;
}

// ─── YouTubeEmbed ─────────────────────────────────────────────────────────────
// Mounts exactly one YT.Player per instance. Use key={videoId} in the parent
// to get a fresh embed whenever the video changes.

interface YouTubeEmbedProps {
  videoId: string;
  onPlayerReady: (p: YTPlayer) => void;
  onStateChange: (state: number) => void;
  onError: (code: number) => void;
}

function YouTubeEmbed({ videoId, onPlayerReady, onStateChange, onError }: YouTubeEmbedProps) {
  // Stable unique DOM id per component instance
  const uid = useId().replace(/:/g, '');
  const domId = `yt-${uid}`;

  const playerRef = useRef<YTPlayer | null>(null);
  // Keep callbacks in refs so the effect closure never goes stale
  const onReadyRef = useRef(onPlayerReady);
  const onStateRef = useRef(onStateChange);
  const onErrorRef = useRef(onError);
  onReadyRef.current   = onPlayerReady;
  onStateRef.current   = onStateChange;
  onErrorRef.current   = onError;

  useEffect(() => {
    let abandoned = false;

    ensureYouTubeApi(() => {
      if (abandoned || !document.getElementById(domId)) return;

      playerRef.current = new window.YT.Player(domId, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, fs: 1 },
        events: {
          onReady:       ({ target }) => { if (!abandoned) onReadyRef.current(target); },
          onStateChange: ({ data })   => { if (!abandoned) onStateRef.current(data);  },
          onError:       ({ data })   => { if (!abandoned) onErrorRef.current(data);  },
        },
      });
    });

    return () => {
      abandoned = true;
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full aspect-video bg-black">
      <div id={domId} className="w-full h-full" />
    </div>
  );
}

// ─── TapSyncUI ────────────────────────────────────────────────────────────────

interface TapSyncUIProps {
  chords:   string[];
  tapIdx:   number;
  tapCount: number;
  onTap:    () => void;
  onUndo:   () => void;
  onDone:   () => void;
}

function TapSyncUI({ chords, tapIdx, tapCount, onTap, onUndo, onDone }: TapSyncUIProps) {
  const current = chords[tapIdx] ?? null;
  const next    = chords[tapIdx + 1] ?? null;
  const total   = chords.length;
  const done    = tapIdx >= total;

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Tap when chord changes</span>
        <span className="tabular-nums">{Math.min(tapIdx, total)} / {total}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-200"
          style={{ width: `${total > 0 ? (Math.min(tapIdx, total) / total) * 100 : 0}%` }}
        />
      </div>

      {done ? (
        <div className="text-center py-4">
          <p className="text-sm text-zinc-300 mb-3">All {total} chords mapped!</p>
          <button
            onClick={onDone}
            className="px-6 py-2.5 bg-amber-500 text-zinc-950 rounded-xl
              text-sm font-semibold hover:bg-amber-400 transition-colors"
          >
            Save Timing
          </button>
        </div>
      ) : (
        <>
          {/* Current / next chord display */}
          <div className="flex items-baseline gap-4 py-1">
            <div>
              <div className="text-[10px] text-zinc-600 uppercase tracking-wide mb-0.5">Now</div>
              <div className="text-4xl font-bold font-mono text-amber-400 leading-none">
                {current ?? '—'}
              </div>
            </div>
            {next && (
              <div className="opacity-50">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wide mb-0.5">Next</div>
                <div className="text-2xl font-bold font-mono text-zinc-300 leading-none">{next}</div>
              </div>
            )}
          </div>

          {/* TAP button */}
          <button
            onClick={onTap}
            className="w-full py-5 rounded-2xl bg-amber-500 text-zinc-950
              text-xl font-bold hover:bg-amber-400 active:scale-95
              transition-all duration-75 select-none touch-manipulation
              shadow-lg shadow-amber-500/20"
          >
            TAP
          </button>

          {/* Undo / Done */}
          <div className="flex gap-2">
            <button
              onClick={onUndo}
              disabled={tapCount === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium
                bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200
                disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ↩ Undo
            </button>
            <button
              onClick={onDone}
              disabled={tapCount === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium
                bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200
                disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Save partial
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── PlayAlongPanel ───────────────────────────────────────────────────────────

export interface PlayAlongPanelProps {
  songId:               string;
  sheet:                ChordProSheet;
  youtubeUrl?:          string;
  chordMap?:            ChordCue[];
  onYoutubeUrlChange:   (url: string) => void;
  onChordMapChange:     (map: ChordCue[]) => void;
  onActiveChordChange:  (idx: number) => void;
}

type Mode = 'play' | 'tap';

export function PlayAlongPanel({
  songId,
  sheet,
  youtubeUrl,
  chordMap,
  onYoutubeUrlChange,
  onChordMapChange,
  onActiveChordChange,
}: PlayAlongPanelProps) {
  const [expanded,   setExpanded]   = useState(false);
  const [urlInput,   setUrlInput]   = useState(youtubeUrl ?? '');
  const [urlError,   setUrlError]   = useState<string | null>(null);
  const [videoId,    setVideoId]    = useState<string | null>(() =>
    youtubeUrl ? extractVideoId(youtubeUrl) : null,
  );
  const [status,     setStatus]     = useState<'idle'|'loading'|'ready'|'playing'|'paused'|'buffering'|'ended'|'error'>('idle');
  const [errorCode,  setErrorCode]  = useState<number | null>(null);
  const [mode,       setMode]       = useState<Mode>('play');

  // Tap-sync state
  const allChords = extractChords(sheet);
  const [tapIdx,  setTapIdx]  = useState(0);
  const [taps,    setTaps]    = useState<ChordCue[]>([]);

  const playerRef = useRef<YTPlayer | null>(null);

  // Reset tap state when song changes
  useEffect(() => {
    setTapIdx(0);
    setTaps([]);
    setMode('play');
  }, [songId]);

  // Sync url input when prop changes (song switch)
  useEffect(() => {
    setUrlInput(youtubeUrl ?? '');
    setUrlError(null);
    const id = youtubeUrl ? extractVideoId(youtubeUrl) : null;
    setVideoId(id);
    setStatus(id ? 'loading' : 'idle');
  }, [youtubeUrl, songId]);

  // ─── RAF loop for play-along chord highlighting ──────────────────────────────
  const rafRef      = useRef<number | null>(null);
  const prevIdxRef  = useRef(-1);
  const chordMapRef = useRef(chordMap);
  chordMapRef.current = chordMap;
  const onActiveRef = useRef(onActiveChordChange);
  onActiveRef.current = onActiveChordChange;

  const startRaf = useCallback(() => {
    const tick = () => {
      const player = playerRef.current;
      const cues   = chordMapRef.current;
      if (player && cues && cues.length > 0) {
        const idx = findCueIndex(cues, player.getCurrentTime());
        if (idx !== prevIdxRef.current) {
          prevIdxRef.current = idx;
          onActiveRef.current(idx);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (status === 'playing' && mode === 'play' && chordMap && chordMap.length > 0) {
      startRaf();
    } else {
      stopRaf();
    }
    return stopRaf;
  }, [status, mode, chordMap, startRaf, stopRaf]);

  // Reset highlight when leaving play mode or video changes
  useEffect(() => {
    if (mode !== 'play') {
      prevIdxRef.current = -1;
      onActiveRef.current(-1);
    }
  }, [mode]);

  useEffect(() => {
    prevIdxRef.current = -1;
    onActiveRef.current(-1);
  }, [videoId]);

  // ─── YouTube player callbacks ────────────────────────────────────────────────

  const handlePlayerReady = useCallback((player: YTPlayer) => {
    playerRef.current = player;
    setStatus('ready');
  }, []);

  const handleStateChange = useCallback((state: number) => {
    if (state === YT_STATE.PLAYING)   setStatus('playing');
    if (state === YT_STATE.PAUSED)    setStatus('paused');
    if (state === YT_STATE.BUFFERING) setStatus('buffering');
    if (state === YT_STATE.ENDED)     setStatus('ended');
    if (state === YT_STATE.UNSTARTED) setStatus('ready');
  }, []);

  const handleError = useCallback((code: number) => {
    setStatus('error');
    setErrorCode(code);
  }, []);

  // ─── URL input handler ───────────────────────────────────────────────────────

  const handleLoadUrl = useCallback(() => {
    const id = extractVideoId(urlInput);
    if (!id) {
      setUrlError('Could not extract a video ID from that URL.');
      return;
    }
    setUrlError(null);
    setVideoId(id);
    setStatus('loading');
    playerRef.current = null;
    onYoutubeUrlChange(urlInput.trim());
  }, [urlInput, onYoutubeUrlChange]);

  // ─── Tap-sync handlers ───────────────────────────────────────────────────────

  const handleTap = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const time  = player.getCurrentTime();
    const chord = allChords[tapIdx];
    if (chord === undefined) return;
    const newTap: ChordCue = { time, chord };
    setTaps((prev) => [...prev, newTap]);
    setTapIdx((i) => i + 1);
  }, [tapIdx, allChords]);

  const handleUndo = useCallback(() => {
    if (taps.length === 0) return;
    setTaps((prev) => prev.slice(0, -1));
    setTapIdx((i) => Math.max(0, i - 1));
  }, [taps.length]);

  const handleTapDone = useCallback(() => {
    if (taps.length === 0) return;
    onChordMapChange(taps);
    setMode('play');
  }, [taps, onChordMapChange]);

  const handleRetap = useCallback(() => {
    setTapIdx(0);
    setTaps([]);
    setMode('tap');
    // Seek to start of video
    playerRef.current?.seekTo(0, true);
  }, []);

  // ─── Collapsed bar ───────────────────────────────────────────────────────────

  const statusDot =
    status === 'playing'   ? 'bg-green-500 animate-pulse' :
    status === 'buffering' ? 'bg-yellow-500 animate-pulse' :
    status === 'error'     ? 'bg-red-500' :
    status === 'loading'   ? 'bg-zinc-500 animate-pulse' :
    'bg-zinc-700';

  const collapsedBar = (
    <div className="flex items-center gap-3 px-4 h-14 border-t border-zinc-800 bg-zinc-900">
      <VideoIcon />

      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} />
        <span className="text-sm text-zinc-400 truncate">
          {videoId
            ? status === 'error'
              ? (YT_ERROR_MSG[errorCode ?? 0] ?? 'Player error')
              : 'Play-Along'
            : 'No video'}
        </span>
      </div>

      {chordMap && chordMap.length > 0 && status === 'playing' && (() => {
        const idx = findCueIndex(chordMap, playerRef.current?.getCurrentTime() ?? 0);
        return idx >= 0 ? (
          <span className="text-sm font-bold font-mono text-amber-400 shrink-0">
            {chordMap[idx].chord}
          </span>
        ) : null;
      })()}

      <button
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? 'Collapse play-along' : 'Expand play-along'}
        className="flex items-center justify-center w-8 h-8 rounded-lg
          text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors shrink-0"
      >
        <ChevronIcon up={expanded} />
      </button>
    </div>
  );

  // ─── Mode tabs ───────────────────────────────────────────────────────────────

  const modeTabs = videoId && status !== 'error' && (
    <div className="flex border-b border-zinc-800">
      {(['play', 'tap'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={[
            'flex-1 py-2.5 text-xs font-medium uppercase tracking-wide transition-colors',
            mode === m
              ? 'text-amber-400 border-b-2 border-amber-400 -mb-px'
              : 'text-zinc-500 hover:text-zinc-300',
          ].join(' ')}
        >
          {m === 'play' ? 'Play-Along' : 'Tap Sync'}
        </button>
      ))}
    </div>
  );

  // ─── Expanded content ────────────────────────────────────────────────────────

  const expandedContent = (() => {
    // URL input
    if (!videoId) return (
      <div className="p-4 space-y-3">
        <label className="block text-xs text-zinc-500 uppercase tracking-wide">
          YouTube URL
        </label>
        <input
          type="url"
          value={urlInput}
          onChange={(e) => { setUrlInput(e.target.value); setUrlError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleLoadUrl(); }}
          placeholder="https://youtube.com/watch?v=..."
          className="w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700
            text-sm text-zinc-100 placeholder:text-zinc-600
            focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500
            transition-colors"
        />
        {urlError && <p className="text-xs text-red-400">{urlError}</p>}
        <button
          onClick={handleLoadUrl}
          disabled={!urlInput.trim()}
          className="w-full py-2.5 rounded-xl bg-amber-500 text-zinc-950
            text-sm font-semibold hover:bg-amber-400
            disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Load Video
        </button>
      </div>
    );

    // Error state
    if (status === 'error') return (
      <div className="p-4 space-y-3">
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
          <p className="text-sm text-red-400 font-medium">
            {YT_ERROR_MSG[errorCode ?? 0] ?? 'Unknown player error'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Try a different video or check permissions.</p>
        </div>
        <button
          onClick={() => { setVideoId(null); setUrlInput(''); onYoutubeUrlChange(''); }}
          className="w-full py-2 rounded-xl text-sm font-medium
            bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
        >
          Change Video
        </button>
      </div>
    );

    // Player + mode content
    return (
      <div>
        {/* YouTube player */}
        <YouTubeEmbed
          key={videoId}
          videoId={videoId}
          onPlayerReady={handlePlayerReady}
          onStateChange={handleStateChange}
          onError={handleError}
        />

        {/* Change video link */}
        <div className="px-4 pt-2 flex justify-end">
          <button
            onClick={() => { setVideoId(null); setUrlInput(youtubeUrl ?? ''); onYoutubeUrlChange(''); }}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Change video
          </button>
        </div>

        {modeTabs}

        {/* Mode-specific UI */}
        {mode === 'tap' ? (
          allChords.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">
              No chords found in this song's sheet.
            </div>
          ) : (
            <TapSyncUI
              chords={allChords}
              tapIdx={tapIdx}
              tapCount={taps.length}
              onTap={handleTap}
              onUndo={handleUndo}
              onDone={handleTapDone}
            />
          )
        ) : (
          // Play-Along mode
          <div className="px-4 py-3 space-y-3">
            {chordMap && chordMap.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wide mb-0.5">
                      {status === 'playing' ? 'Now playing' : 'Ready'}
                    </div>
                    <div className="text-lg font-bold font-mono text-zinc-300">
                      {status === 'playing' && chordMap && (() => {
                        const idx = findCueIndex(chordMap, playerRef.current?.getCurrentTime() ?? 0);
                        return idx >= 0 ? chordMap[idx].chord : '—';
                      })() || '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wide mb-0.5">
                      Mapped
                    </div>
                    <div className="text-sm text-zinc-400 tabular-nums">{chordMap.length} chords</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg bg-zinc-800/50 border border-zinc-800 px-3 py-2">
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Status</div>
                    <div className={`text-xs font-medium capitalize ${
                      status === 'playing'   ? 'text-green-400' :
                      status === 'buffering' ? 'text-yellow-400' :
                      'text-zinc-400'
                    }`}>
                      {status}
                    </div>
                  </div>
                  <button
                    onClick={handleRetap}
                    className="px-3 py-2 rounded-lg text-xs font-medium
                      bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200
                      border border-zinc-700 transition-colors"
                  >
                    Re-tap timing
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4 space-y-2">
                <p className="text-sm text-zinc-400">No chord timing mapped yet.</p>
                <p className="text-xs text-zinc-600">
                  Switch to <span className="text-zinc-400">Tap Sync</span> tab, play the video,
                  then tap each time the chord changes.
                </p>
                <button
                  onClick={() => setMode('tap')}
                  className="mt-2 px-4 py-2 rounded-lg text-xs font-medium
                    bg-amber-500/10 text-amber-400 border border-amber-500/20
                    hover:bg-amber-500/20 transition-colors"
                >
                  Go to Tap Sync →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  })();

  return (
    <div className="shrink-0">
      {/* Expanded panel (CSS transition) */}
      <div
        className={[
          'overflow-hidden transition-all duration-300 ease-in-out border-t border-zinc-800',
          expanded ? 'max-h-[560px] overflow-y-auto' : 'max-h-0 border-transparent',
        ].join(' ')}
      >
        <div className="bg-zinc-900">
          {expandedContent}
        </div>
      </div>

      {collapsedBar}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className="text-zinc-500 shrink-0">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-300 ${up ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
