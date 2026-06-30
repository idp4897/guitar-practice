'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { type ChordCue, type ChordProSheet, type SongKey } from '@/domain/music/types';
import { extractChords } from '@/domain/music/chordpro';
import { useSongPlayer } from '@/hooks/useSongPlayer';
import { ensureYouTubeApi, extractVideoId, YT_ERROR_MSG, YT_STATE, type YTPlayer } from '@/lib/youtube';
import { getTuning } from '@/domain/music/tuning';
import { getDiatonicChords, findUsedDiatonicChords, getRelativeKey, formatSongKey } from '@/domain/music/theory';
import type { DiatonicChordInfo } from '@/domain/music/types';
import { ChordSheetViewer } from './ChordSheetViewer';
import { ChordDiagram } from './ChordDiagram';
import { Metronome } from './Metronome';
import { TapSyncMode } from './TapSyncMode';

// ─── Chord-cue binary search ──────────────────────────────────────────────────

function findCueIndex(cues: ChordCue[], time: number): number {
  let lo = 0, hi = cues.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (cues[mid].time <= time) { result = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return result;
}

// ─── YouTubeEmbed ─────────────────────────────────────────────────────────────
// Always rendered hidden; mounts once per videoId so the player is never torn down mid-play.

interface YouTubeEmbedProps {
  videoId:       string;
  onPlayerReady: (p: YTPlayer) => void;
  onStateChange: (s: number) => void;
  onError:       (code: number) => void;
}

function YouTubeEmbed({ videoId, onPlayerReady, onStateChange, onError }: YouTubeEmbedProps) {
  const uid      = useId().replace(/:/g, '');
  const domId    = `yt-pp-${uid}`;
  const readyRef = useRef(onPlayerReady);
  const stateRef = useRef(onStateChange);
  const errorRef = useRef(onError);
  readyRef.current = onPlayerReady;
  stateRef.current = onStateChange;
  errorRef.current = onError;

  useEffect(() => {
    let abandoned = false;
    ensureYouTubeApi(() => {
      if (abandoned || !document.getElementById(domId)) return;
      new window.YT.Player(domId, {
        videoId,
        // Fixed dimensions — container clips to 1×1 so it's visually hidden
        // but the player object is fully functional for audio & API calls.
        width:  '200',
        height: '113',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, fs: 0 },
        events: {
          onReady:       ({ target }) => { if (!abandoned) readyRef.current(target); },
          onStateChange: ({ data })   => { if (!abandoned) stateRef.current(data);  },
          onError:       ({ data })   => { if (!abandoned) errorRef.current(data);  },
        },
      });
    });
    return () => { abandoned = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div id={domId} />;
}

// ─── ControlBar ───────────────────────────────────────────────────────────────

interface ControlBarProps {
  displayKey:      string;
  transpose:       number;
  capo:            number;
  detectedKey:     string | null;
  onTransposeUp:   () => void;
  onTransposeDown: () => void;
  onCapoChange:    (n: number) => void;
  hasVideo:        boolean;
  onVideoToggle:   () => void;
}

function ControlBar({
  displayKey, transpose, capo, detectedKey,
  onTransposeUp, onTransposeDown, onCapoChange, hasVideo, onVideoToggle,
}: ControlBarProps) {
  const keyLabel = displayKey || (transpose !== 0 ? `${transpose > 0 ? '+' : ''}${transpose}` : '—');

  return (
    <div className="flex items-center gap-1 px-3 h-12
      bg-zinc-950 border-b border-zinc-800 select-none">

      <button onClick={onTransposeDown} aria-label="Transpose down"
        className="flex items-center justify-center w-10 h-10 rounded-lg
          text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800
          active:bg-zinc-700 transition-colors touch-manipulation text-lg font-bold">
        ♭
      </button>

      <div className="flex flex-col items-center min-w-[3.5rem]">
        <span className="text-base font-bold font-mono text-amber-400 leading-none">{keyLabel}</span>
        {transpose !== 0 && (
          <span className="text-[9px] text-zinc-600 leading-none mt-px tabular-nums">
            {transpose > 0 ? `+${transpose}` : transpose}
          </span>
        )}
      </div>

      <button onClick={onTransposeUp} aria-label="Transpose up"
        className="flex items-center justify-center w-10 h-10 rounded-lg
          text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800
          active:bg-zinc-700 transition-colors touch-manipulation text-lg font-bold">
        ♯
      </button>

      <div className="w-px h-5 bg-zinc-800 mx-1 shrink-0" />

      <div className="flex gap-1 overflow-x-auto flex-1 no-scrollbar">
        {Array.from({ length: 13 }, (_, n) => (
          <button key={n} onClick={() => onCapoChange(n)}
            aria-label={`Capo ${n}`} aria-pressed={capo === n}
            className={[
              'shrink-0 w-7 h-7 rounded-lg text-xs font-medium transition-colors touch-manipulation',
              capo === n
                ? 'bg-amber-500 text-zinc-950 font-bold'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
            ].join(' ')}>
            {n}
          </button>
        ))}
      </div>

      {detectedKey && (
        <span className="text-[10px] text-zinc-600 shrink-0 hidden sm:block ml-1">
          ≈&nbsp;{detectedKey}
        </span>
      )}

      <div className="w-px h-5 bg-zinc-800 mx-1 shrink-0" />

      <button onClick={onVideoToggle}
        aria-label={hasVideo ? 'Change YouTube video' : 'Add YouTube video'}
        className={[
          'flex items-center justify-center w-9 h-9 rounded-lg transition-colors touch-manipulation',
          hasVideo
            ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
            : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800',
        ].join(' ')}>
        <VideoIcon />
      </button>
    </div>
  );
}

// ─── YouTubeAudioControls ─────────────────────────────────────────────────────

type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface AudioControlsProps {
  player:      YTPlayer | null;
  status:      PlayerStatus;
  playerError: number | null;
  onRemove:    () => void;
}

function YouTubeAudioControls({ player, status, playerError, onRemove }: AudioControlsProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [isSeeking,   setIsSeeking]   = useState(false);
  const [seekValue,   setSeekValue]   = useState(0);
  const [rate,        setRate]        = useState(1);
  // mounted guards against SSR/client hydration mismatch on disabled props:
  // server always renders disabled=true; client syncs after first paint.
  const [mounted,     setMounted]     = useState(false);
  const audioRafRef = useRef<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading' || status === 'buffering';
  const canPlay   = mounted && player != null &&
    (status === 'ready' || status === 'playing' || status === 'paused' ||
     status === 'buffering' || status === 'ended');

  // RAF loop — live time update, no drift
  useEffect(() => {
    if (!player) return;
    const tick = () => {
      if (!isSeeking) setCurrentTime(player.getCurrentTime?.() ?? 0);
      const d = player.getDuration?.() ?? 0;
      if (d > 0) setDuration(d);
      audioRafRef.current = requestAnimationFrame(tick);
    };
    audioRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (audioRafRef.current) cancelAnimationFrame(audioRafRef.current);
    };
  }, [player, isSeeking]);

  // Reset on player change
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setRate(1);
  }, [player]);

  const handlePlayPause = () => {
    if (!player) return;
    if (isPlaying) player.pauseVideo();
    else           player.playVideo();
  };

  const handleSkip = (delta: number) => {
    if (!player) return;
    const t = Math.max(0, Math.min(duration, (player.getCurrentTime?.() ?? 0) + delta));
    player.seekTo(t, true);
    setCurrentTime(t);
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekValue(currentTime);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setSeekValue(v);
    setCurrentTime(v);
  };

  const handleSeekCommit = () => {
    if (player) player.seekTo(seekValue, true);
    setIsSeeking(false);
  };

  const handleRate = (r: number) => {
    setRate(r);
    player?.setPlaybackRate(r);
  };

  const displayTime = isSeeking ? seekValue : currentTime;
  const progress    = duration > 0 ? (displayTime / duration) : 0;

  if (status === 'error') {
    return (
      <div className="shrink-0 flex items-center justify-between px-4 py-3
        border-b border-zinc-800 bg-zinc-900">
        <p className="text-sm text-red-400">
          {YT_ERROR_MSG[playerError ?? 0] ?? 'Player error — video may be unavailable'}
        </p>
        <button onClick={onRemove}
          className="ml-3 shrink-0 px-3 py-1.5 rounded-lg text-xs bg-zinc-800
            text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors">
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-zinc-800 bg-zinc-900">
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
            disabled={!canPlay || duration === 0}
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

        {/* Skip back */}
        <button onClick={() => handleSkip(-10)} disabled={!canPlay}
          aria-label="Skip back 10s"
          className="flex items-center justify-center w-10 h-10 rounded-lg
            text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800
            disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation">
          <SkipBackIcon />
        </button>

        {/* Play / Pause */}
        <button onClick={handlePlayPause} disabled={!canPlay && !isLoading}
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

        {/* Skip forward */}
        <button onClick={() => handleSkip(10)} disabled={!canPlay}
          aria-label="Skip forward 10s"
          className="flex items-center justify-center w-10 h-10 rounded-lg
            text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800
            disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation">
          <SkipForwardIcon />
        </button>

        <div className="flex-1" />

        {/* Status pill */}
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

        {/* Remove video */}
        <button onClick={onRemove}
          className="ml-1 flex items-center justify-center w-8 h-8 rounded-lg
            text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors touch-manipulation"
          aria-label="Remove video">
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

// ─── BottomToolbar ────────────────────────────────────────────────────────────

interface BottomToolbarProps {
  autoScroll:  boolean;
  onAutoScroll: () => void;
  onTapSync:   () => void;
  canTapSync:  boolean;
}

function BottomToolbar({ autoScroll, onAutoScroll, onTapSync, canTapSync }: BottomToolbarProps) {
  return (
    <div className="shrink-0 flex items-center justify-end gap-1 px-3 h-11
      border-t border-zinc-800/60 bg-zinc-900 select-none">

      <button onClick={onAutoScroll} aria-pressed={autoScroll}
        className={[
          'flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-colors touch-manipulation',
          autoScroll
            ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
            : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700',
        ].join(' ')}>
        <ScrollIcon />
        <span className="hidden sm:inline">Scroll</span>
      </button>

      <button onClick={onTapSync} disabled={!canTapSync}
        className={[
          'flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-colors touch-manipulation',
          canTapSync
            ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            : 'bg-zinc-800/50 text-zinc-700 cursor-not-allowed',
        ].join(' ')}>
        <TapIcon />
        <span className="hidden sm:inline">Tap</span>
      </button>
    </div>
  );
}

// ─── PlayerPage ───────────────────────────────────────────────────────────────

export interface PlayerPageProps {
  songId:             string;
  songTitle?:         string;
  songArtist?:        string;
  baseSheet:          ChordProSheet;
  youtubeUrl?:        string;
  chordMap?:          ChordCue[];
  tuningId?:          string;
  initialBpm?:        number;
  songKeys?:          SongKey[];
  onYoutubeUrlChange: (url: string) => void;
  onChordMapChange:   (map: ChordCue[]) => void;
}

export function PlayerPage({
  songId, songTitle, songArtist, baseSheet,
  youtubeUrl, chordMap, tuningId, initialBpm, songKeys,
  onYoutubeUrlChange, onChordMapChange,
}: PlayerPageProps) {
  const tuning = getTuning(tuningId ?? 'standard');

  // ─── Music theory ─────────────────────────────────────────────────────────────
  const { displaySheet, transpose, capo, detectedKey, transposeUp, transposeDown, setCapo } =
    useSongPlayer(baseSheet, songId);

  // Metronome state lives entirely inside <Metronome> — no hook needed here.

  // ─── Key panel ────────────────────────────────────────────────────────────────
  const [selectedKey, setSelectedKey] = useState<SongKey | null>(null);
  const [panelChord,  setPanelChord]  = useState<string | null>(null);

  useEffect(() => { setSelectedKey(null); setPanelChord(null); }, [songId]);

  // ─── YouTube ──────────────────────────────────────────────────────────────────
  const [urlInput,     setUrlInput]     = useState(youtubeUrl ?? '');
  const [urlError,     setUrlError]     = useState<string | null>(null);
  const [videoId,      setVideoId]      = useState<string | null>(() =>
    youtubeUrl ? extractVideoId(youtubeUrl) : null,
  );
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('idle');
  const [playerError,  setPlayerError]  = useState<number | null>(null);
  const [urlOpen,      setUrlOpen]      = useState(false);
  // player is tracked in both ref (for RAF perf) and state (for consistent SSR/client render)
  const [player,       setPlayer]       = useState<YTPlayer | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  useEffect(() => {
    setUrlInput(youtubeUrl ?? '');
    setUrlError(null);
    const id = youtubeUrl ? extractVideoId(youtubeUrl) : null;
    setVideoId(id);
    setPlayerStatus(id ? 'loading' : 'idle');
    playerRef.current = null;
    setPlayer(null);
  }, [youtubeUrl, songId]);

  // ─── RAF chord highlight ──────────────────────────────────────────────────────
  const [activeChordIndex, setActiveChordIndex] = useState(-1);
  const rafRef        = useRef<number | null>(null);
  const prevIdxRef    = useRef(-1);
  const chordMapRef   = useRef(chordMap);
  chordMapRef.current = chordMap;

  useEffect(() => {
    if (playerStatus !== 'playing' || !chordMap?.length) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      return;
    }
    const tick = () => {
      const idx = findCueIndex(chordMapRef.current ?? [], playerRef.current?.getCurrentTime() ?? 0);
      if (idx !== prevIdxRef.current) { prevIdxRef.current = idx; setActiveChordIndex(idx); }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [playerStatus, chordMap]);

  useEffect(() => { prevIdxRef.current = -1; setActiveChordIndex(-1); }, [videoId, songId]);

  // ─── Auto-scroll ──────────────────────────────────────────────────────────────
  const [autoScroll, setAutoScroll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll || activeChordIndex < 0) return;
    scrollRef.current
      ?.querySelector(`[data-chord-idx="${activeChordIndex}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeChordIndex, autoScroll]);

  // ─── Tap-sync ────────────────────────────────────────────────────────────────
  const [tapOpen, setTapOpen] = useState(false);
  const tapChords = extractChords(displaySheet);

  useEffect(() => { setTapOpen(false); }, [songId]);

  // ─── YouTube callbacks ────────────────────────────────────────────────────────
  const handlePlayerReady = useCallback((p: YTPlayer) => {
    playerRef.current = p;
    setPlayer(p);
    setPlayerStatus('ready');
  }, []);

  const handleStateChange = useCallback((state: number) => {
    if (state === YT_STATE.PLAYING)   setPlayerStatus('playing');
    if (state === YT_STATE.PAUSED)    setPlayerStatus('paused');
    if (state === YT_STATE.BUFFERING) setPlayerStatus('buffering');
    if (state === YT_STATE.ENDED)     setPlayerStatus('ended');
    if (state === YT_STATE.UNSTARTED) setPlayerStatus('ready');
  }, []);

  const handlePlayerError = useCallback((code: number) => {
    setPlayerStatus('error');
    setPlayerError(code);
  }, []);

  const handleLoadUrl = useCallback(() => {
    const id = extractVideoId(urlInput);
    if (!id) { setUrlError('Could not find a video ID in that URL.'); return; }
    setUrlError(null);
    setUrlOpen(false);
    setVideoId(id);
    setPlayerStatus('loading');
    playerRef.current = null;
    onYoutubeUrlChange(urlInput.trim());
  }, [urlInput, onYoutubeUrlChange]);

  const handleRemoveVideo = useCallback(() => {
    setVideoId(null);
    setUrlInput('');
    setPlayerStatus('idle');
    setPlayerError(null);
    playerRef.current = null;
    setPlayer(null);
    onYoutubeUrlChange('');
  }, [onYoutubeUrlChange]);

  const displayKey = displaySheet.key ?? '';

  // ─── Render ───────────────────────────────────────────────────────────────────

  // headerBlock stays at a stable DOM position so the hidden YouTubeEmbed
  // never unmounts when we switch to tap-sync mode.
  const headerBlock = (
    <div className="shrink-0">
      {!tapOpen && (
        <div className="px-5 pt-4 pb-2.5 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-zinc-100 leading-tight">
              {songTitle ?? displaySheet.title ?? 'Untitled'}
            </h2>
            {(songArtist ?? displaySheet.artist) && (
              <p className="text-sm text-zinc-400 mt-0.5">{songArtist ?? displaySheet.artist}</p>
            )}
            {(displayKey || detectedKey) && (
              <p className="text-xs text-zinc-500 mt-1 font-mono">
                Key&nbsp;<span className="text-amber-400">{displayKey || detectedKey}</span>
                {capo > 0 && <>&nbsp;·&nbsp;Capo&nbsp;{capo}</>}
                {tuning.id !== 'standard' && <>&nbsp;·&nbsp;<span className="text-zinc-400">{tuning.name}</span></>}
              </p>
            )}
          </div>
          <Link
            href={`/songs/${songId}/edit`}
            className="shrink-0 mt-1 px-3 py-1.5 rounded-lg text-xs font-medium
              text-zinc-400 bg-zinc-800 border border-zinc-700
              hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
          >
            Edit
          </Link>
        </div>
      )}

      {/* Key chips bar */}
      {!tapOpen && songKeys && songKeys.length > 0 && (
        <div className="flex items-center gap-2 px-4 pb-2 overflow-hidden">
          <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-wide shrink-0">Keys</span>
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {songKeys.map((sk, i) => {
              const active = selectedKey?.key === sk.key && selectedKey?.mode === sk.mode;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedKey(active ? null : sk)}
                  className={[
                    'shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg',
                    'text-xs font-mono font-semibold transition-colors touch-manipulation',
                    active
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200',
                  ].join(' ')}
                >
                  {sk.label && (
                    <span className="font-normal text-[10px] opacity-60">{sk.label}:</span>
                  )}
                  {formatSongKey(sk)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ControlBar
        displayKey={displayKey}
        transpose={transpose}
        capo={capo}
        detectedKey={detectedKey}
        onTransposeUp={transposeUp}
        onTransposeDown={transposeDown}
        onCapoChange={setCapo}
        hasVideo={!!videoId}
        onVideoToggle={() => setUrlOpen((o) => !o)}
      />

      {/* URL input panel */}
      {urlOpen && (
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900 space-y-2">
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              autoFocus
              onChange={(e) => { setUrlInput(e.target.value); setUrlError(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLoadUrl();
                if (e.key === 'Escape') setUrlOpen(false);
              }}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700
                text-sm text-zinc-100 placeholder:text-zinc-600
                focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
            <button onClick={handleLoadUrl}
              className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950
                text-sm font-semibold hover:bg-amber-400 transition-colors whitespace-nowrap">
              Load
            </button>
            <button onClick={() => setUrlOpen(false)}
              className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-400
                text-sm hover:bg-zinc-700 hover:text-zinc-200 transition-colors">
              ✕
            </button>
          </div>
          {urlError && <p className="text-xs text-red-400">{urlError}</p>}
        </div>
      )}

      {/* Custom audio controls — visible whenever a video is loaded */}
      {videoId && (
        <YouTubeAudioControls
          player={player}
          status={playerStatus}
          playerError={playerError}
          onRemove={handleRemoveVideo}
        />
      )}
    </div>
  );

  const allChords = extractChords(displaySheet);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {headerBlock}

      {tapOpen ? (
        <TapSyncMode
          sheet={displaySheet}
          player={playerRef.current}
          onSave={(map) => { onChordMapChange(map); setTapOpen(false); }}
          onClose={() => setTapOpen(false)}
        />
      ) : selectedKey ? (
        <>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <DiatonicPanel
              songKey={selectedKey}
              songChords={allChords}
              onChordClick={setPanelChord}
              onClose={() => setSelectedKey(null)}
            />
          </div>
          <Metronome initialBpm={initialBpm} />
          <BottomToolbar
            autoScroll={false}
            onAutoScroll={() => {}}
            onTapSync={() => setTapOpen(true)}
            canTapSync={!!player && tapChords.length > 0}
          />
          {panelChord && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
              onClick={() => setPanelChord(null)}
            >
              <div
                className="w-full max-w-sm bg-zinc-900 rounded-t-2xl border-t border-zinc-700"
                onClick={(e) => e.stopPropagation()}
              >
                <ChordDiagram
                  chord={panelChord}
                  tuning={tuning}
                  onClose={() => setPanelChord(null)}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
            <ChordSheetViewer
              sheet={displaySheet}
              activeChordIndex={activeChordIndex}
              showHeader={false}
              tuning={tuning}
            />
            <div className="h-4" />
          </div>

          <Metronome initialBpm={initialBpm} />
          <BottomToolbar
            autoScroll={autoScroll}
            onAutoScroll={() => setAutoScroll((a) => !a)}
            onTapSync={() => setTapOpen(true)}
            canTapSync={!!player && tapChords.length > 0}
          />
        </>
      )}

      {/*
        The YouTube iframe lives here, visually clipped to 1×1 px.
        It must remain mounted for audio to keep playing.
        overflow:hidden clips the 200×113 iframe; pointer-events:none prevents
        accidental interaction with the hidden element.
      */}
      {videoId && (
        <div
          className="fixed bottom-0 right-0 pointer-events-none"
          style={{ width: 1, height: 1, overflow: 'hidden' }}
          aria-hidden
        >
          <YouTubeEmbed
            key={videoId}
            videoId={videoId}
            onPlayerReady={handlePlayerReady}
            onStateChange={handleStateChange}
            onError={handlePlayerError}
          />
        </div>
      )}
    </div>
  );
}

// ─── DiatonicPanel ───────────────────────────────────────────────────────────

const THEORY_TERMS_COMMON = [
  'Diatonic chords',
  'Roman numeral analysis',
  'Primary chords (I IV V)',
  'Relative minor/major',
  'Harmonized scale',
  'Modulation',
];

interface DiatonicPanelProps {
  songKey:      SongKey;
  songChords:   string[];
  onChordClick: (chord: string) => void;
  onClose:      () => void;
}

function DiatonicPanel({ songKey, songChords, onChordClick, onClose }: DiatonicPanelProps) {
  const diatonic  = getDiatonicChords(songKey);
  const usedSet   = findUsedDiatonicChords(songChords, diatonic.map(d => d.chord));
  const relKey    = getRelativeKey(songKey);
  const theoryTerms = songKey.mode === 'minor'
    ? [...THEORY_TERMS_COMMON, 'Natural minor', 'Harmonic minor']
    : THEORY_TERMS_COMMON;

  return (
    <div className="flex flex-col gap-0 px-4 pt-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1">
          <span className="text-lg font-bold font-mono text-amber-400">
            {formatSongKey(songKey, 'full')}
          </span>
          <span className="ml-2 text-xs text-zinc-600">
            rel.&nbsp;{formatSongKey(relKey)}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg
            text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Chord grid */}
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex gap-2 min-w-max pb-1">
          {diatonic.map((d) => (
            <ChordCard
              key={d.degree}
              info={d}
              isUsed={usedSet.has(d.chord)}
              onClick={() => onChordClick(d.chord)}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-zinc-600">
        <span><span className="text-amber-500">●</span> Used in song</span>
        <span><span className="bg-amber-500/20 px-1 rounded">■</span> I IV V Primary</span>
        {songKey.mode === 'minor' && (
          <span>* = harmonic minor V</span>
        )}
      </div>

      {/* Theory terms */}
      <div className="flex flex-wrap gap-1.5 mt-4">
        {theoryTerms.map((term) => (
          <a
            key={term}
            href={`https://www.google.com/search?q=music+theory+${encodeURIComponent(term)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-full text-[11px] font-medium
              bg-zinc-800 border border-zinc-700 text-zinc-400
              hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
          >
            {term}
          </a>
        ))}
      </div>
    </div>
  );
}

interface ChordCardProps {
  info:    DiatonicChordInfo;
  isUsed:  boolean;
  onClick: () => void;
}

function ChordCard({ info, isUsed, onClick }: ChordCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-col items-center gap-0.5 w-16 py-3 px-1 rounded-xl border',
        'transition-colors touch-manipulation select-none',
        info.isPrimary
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-zinc-900 border-zinc-700',
        isUsed
          ? 'border-solid opacity-100'
          : 'border-dashed opacity-50',
      ].join(' ')}
    >
      <span className="text-[10px] font-mono text-zinc-500 leading-none">
        {info.romanNumeral}
      </span>
      <span className={[
        'text-base font-bold font-mono leading-none mt-1',
        isUsed ? 'text-zinc-100' : 'text-zinc-400',
      ].join(' ')}>
        {info.chord}
        {info.harmonicMinorVariant && <span className="text-amber-500 text-[10px] align-super">*</span>}
      </span>
      <span className="text-[9px] text-zinc-600 leading-none mt-1 text-center w-full truncate px-1">
        {info.fn}
      </span>
      {isUsed && (
        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
      )}
    </button>
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

function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ScrollIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

function TapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
