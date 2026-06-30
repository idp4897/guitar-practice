'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ChordCue, ChordProSheet } from '@/domain/music/types';
import type { YTPlayer } from '@/lib/youtube';
import { ChordSheetViewer } from './ChordSheetViewer';
import { useTapSync } from '@/hooks/useTapSync';
import { extractChords } from '@/domain/music/chordpro';

// ─── TapSyncMode ──────────────────────────────────────────────────────────────
// Replaces the bare chord-rail with a full ChordSheetViewer showing context
// (chords above lyrics) so the user can tap with better musical awareness.
//
// Visual chord states:
//   synced  (index < tapIdx)  — amber-600, past taps
//   active  (index = tapIdx)  — amber-300 + ring, the chord to tap next
//   pending (index > tapIdx)  — amber-400, not yet reached

export interface TapSyncModeProps {
  sheet:   ChordProSheet;
  player:  YTPlayer | null;
  onSave:  (map: ChordCue[]) => void;
  onClose: () => void;
}

export function TapSyncMode({ sheet, player, onSave, onClose }: TapSyncModeProps) {
  const chords = extractChords(sheet);
  const total  = chords.length;

  const { tapIdx, taps, done, tap, undo, reset, chordStatus } = useTapSync(chords, player);

  // ── Auto-scroll: keep active chord visible ─────────────────────────────────

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    const activeEl  = container?.querySelector<HTMLElement>(`[data-chord-idx="${tapIdx}"]`);
    if (!container || !activeEl) return;
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [tapIdx]);

  // ── Keyboard: Space/Enter = tap · Z/Backspace = undo · Escape = exit ───────

  const tapRef   = useRef(tap);
  const undoRef  = useRef(undo);
  tapRef.current  = tap;
  undoRef.current = undo;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tapRef.current(); }
      if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') { e.preventDefault(); undoRef.current(); }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (taps.length > 0) onSave(taps);
    onClose();
  }, [taps, onSave, onClose]);

  const handleReset = useCallback(() => {
    reset();
    player?.seekTo(0, true);
  }, [reset, player]);

  // ── No player ────────────────────────────────────────────────────────────

  if (!player) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 bg-zinc-950">
        <p className="text-lg font-semibold text-zinc-200">Add a YouTube video first</p>
        <p className="text-sm text-zinc-500 max-w-xs">
          Tap the video icon in the control bar to link a video, then come back to tap sync.
        </p>
        <button onClick={onClose}
          className="mt-2 px-5 py-3 rounded-xl bg-zinc-800 text-zinc-300
            text-sm font-medium hover:bg-zinc-700 transition-colors touch-manipulation">
          Go back
        </button>
      </div>
    );
  }

  // ── No chords ────────────────────────────────────────────────────────────

  if (total === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 bg-zinc-950">
        <p className="text-lg font-semibold text-zinc-200">No chords in this song</p>
        <p className="text-sm text-zinc-500">Add chords to the sheet before using tap sync.</p>
        <button onClick={onClose}
          className="px-5 py-3 rounded-xl bg-zinc-800 text-zinc-300
            text-sm font-medium hover:bg-zinc-700 transition-colors touch-manipulation">
          Go back
        </button>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-zinc-950 select-none">

      {/* Header bar: progress + action buttons */}
      <div className="flex-none flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs tabular-nums">
            <span className="text-zinc-100 font-semibold">{Math.min(tapIdx, total)}</span>
            <span className="text-zinc-600">/ {total} chords</span>
            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-200"
                style={{ width: `${total > 0 ? (Math.min(tapIdx, total) / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        <button
          onClick={undo}
          disabled={taps.length === 0}
          className="flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-medium
            bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200
            disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
        >
          <UndoIcon /> Undo
        </button>

        <button
          onClick={handleReset}
          disabled={taps.length === 0}
          className="flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-medium
            bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200
            disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
        >
          <ResetIcon /> Reset
        </button>

        <button
          onClick={onClose}
          className="px-3 h-8 rounded-lg text-xs font-medium
            bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300
            transition-colors touch-manipulation"
        >
          Exit
        </button>
      </div>

      {done ? (
        // ── Done screen ────────────────────────────────────────────────────

        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
            <CheckIcon />
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-100">All {total} chords tapped</p>
            <p className="text-sm text-zinc-500 mt-1">Save to enable play-along highlighting</p>
          </div>
          <div className="flex gap-3 w-full max-w-xs">
            <button onClick={() => { reset(); player.seekTo(0, true); }}
              className="flex-1 py-4 rounded-2xl text-sm font-semibold
                bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors touch-manipulation">
              ↺ Re-tap
            </button>
            <button onClick={handleSave}
              className="flex-1 py-4 rounded-2xl text-base font-bold
                bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors
                shadow-lg shadow-amber-500/20 touch-manipulation">
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Full chord sheet — chords above lyrics, colour-coded by state */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
            <ChordSheetViewer
              sheet={sheet}
              chordStatus={chordStatus}
              showHeader={false}
            />
            {/* Bottom padding so last chord can scroll to centre */}
            <div className="h-[40vh]" />
          </div>

          {/* Sticky TAP button + hint */}
          <div className="flex-none px-4 py-3 bg-zinc-950/90 backdrop-blur-sm border-t border-zinc-800/60">
            {/* Next chord preview */}
            <div className="flex items-baseline justify-between mb-2 px-1">
              <span className="text-xs text-zinc-600">
                Next: <span className="text-zinc-400 font-mono font-semibold">
                  {chords[tapIdx + 1] ?? '—'}
                </span>
              </span>
              <span className="text-[10px] text-zinc-700">
                <kbd className="font-mono">Space</kbd> or <kbd className="font-mono">Enter</kbd>
              </span>
            </div>

            <button
              onPointerDown={(e) => { e.preventDefault(); tap(); }}
              className={[
                'w-full rounded-2xl font-black tracking-[0.2em] touch-manipulation',
                'text-3xl py-7',
                'transition-all duration-[120ms] active:scale-95',
                'bg-amber-500 text-zinc-950 hover:bg-amber-400',
                'shadow-lg shadow-amber-500/20',
              ].join(' ')}
            >
              TAP
            </button>

            {taps.length > 0 && (
              <button
                onClick={handleSave}
                className="w-full mt-2 py-2 rounded-xl text-xs font-medium
                  bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300
                  transition-colors touch-manipulation"
              >
                Save partial ({taps.length} / {total})
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function UndoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className="text-green-400">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
