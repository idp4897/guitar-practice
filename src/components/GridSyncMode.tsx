'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChordCue, ChordSection } from '@/domain/music/types';
import type { YTPlayer } from '@/lib/youtube';
import {
  flattenGridBeats,
  gridAlignsWithChords,
  generateCuesFromGrid,
} from '@/domain/music/gridSync';
import { BPM_MIN, BPM_MAX } from '@/domain/music/bpm';

// ─── GridSyncMode ───────────────────────────────────────────────────────────
// Places one ChordCue per sheet chord from a single anchor tap + BPM, using the
// beat durations stored in the chord grid. Assumes a constant tempo. The result
// is 1:1 with extractChords(sheet), so the existing play-along highlighter and
// full-sync detection work unchanged.

const PREVIEW_LIMIT = 8;

export interface GridSyncModeProps {
  grid:        ChordSection[];
  chords:      string[];        // extractChords(displaySheet) — names + count
  player:      YTPlayer | null;
  initialBpm?: number;
  stale?:      boolean;
  onSave:      (map: ChordCue[]) => void;
  onExit:      () => void;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const clampBpm = (n: number) => Math.max(BPM_MIN, Math.min(BPM_MAX, n));

export function GridSyncMode({
  grid, chords, player, initialBpm, stale, onSave, onExit,
}: GridSyncModeProps) {
  const [bpm,    setBpm]    = useState(() => clampBpm(initialBpm ?? 120));
  const [anchor, setAnchor] = useState<number | null>(null);

  const beatsPerChord = useMemo(() => flattenGridBeats(grid).map((b) => b.beats), [grid]);
  const aligned       = useMemo(() => gridAlignsWithChords(grid, chords), [grid, chords]);

  const cues = useMemo(
    () => (anchor != null ? generateCuesFromGrid(chords, beatsPerChord, anchor, bpm) : []),
    [anchor, chords, beatsPerChord, bpm],
  );

  const tapAnchor = useCallback(() => {
    if (!player) return;
    setAnchor(player.getCurrentTime());
  }, [player]);

  // Space/Enter = tap the first chord
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tapAnchor(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tapAnchor]);

  const header = (
    <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
      <span className="text-xs font-semibold text-zinc-300">Grid Sync</span>
      <span className="text-[10px] text-zinc-600 tabular-nums">{chords.length} chords</span>
      <div className="flex-1" />
      <button onClick={onExit}
        className="px-3 h-8 rounded-lg text-xs font-medium
          bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300
          transition-colors touch-manipulation">
        Exit
      </button>
    </div>
  );

  // ── Grid can't be used: needs a rebuild ─────────────────────────────────────
  if (stale || !aligned) {
    return (
      <div className="flex-1 min-h-0 flex flex-col bg-zinc-950 select-none">
        {header}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
          <p className="text-lg font-semibold text-zinc-200">Grid doesn&apos;t match the sheet</p>
          <p className="text-sm text-zinc-500 max-w-xs">
            {stale
              ? 'The chord grid is out of date. Open the editor to rebuild it, then try grid sync again.'
              : 'The chord grid has a different number of chords than the sheet. Rebuild it in the editor to use grid sync.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Main ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-zinc-950 select-none">
      {header}

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
        <p className="text-sm text-zinc-400 leading-relaxed">
          Play the video and tap once when the{' '}
          <span className="text-amber-400 font-medium">first chord</span> lands. The rest are
          placed automatically from your chord grid and BPM.
        </p>

        {/* BPM */}
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">Tempo</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums text-zinc-100">{bpm}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide">bpm</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {([-5, -1] as const).map((d) => (
              <button key={d}
                onClick={() => setBpm((b) => clampBpm(b + d))}
                disabled={bpm + d < BPM_MIN}
                className="w-11 h-9 rounded-lg text-xs font-medium text-zinc-400
                  bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100
                  disabled:opacity-25 disabled:cursor-not-allowed transition-colors tabular-nums"
              >{d}</button>
            ))}
            <div className="flex-1" />
            {([+1, +5] as const).map((d) => (
              <button key={d}
                onClick={() => setBpm((b) => clampBpm(b + d))}
                disabled={bpm + d > BPM_MAX}
                className="w-11 h-9 rounded-lg text-xs font-medium text-zinc-400
                  bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100
                  disabled:opacity-25 disabled:cursor-not-allowed transition-colors tabular-nums"
              >+{d}</button>
            ))}
          </div>
        </div>

        {/* Anchor / preview */}
        {anchor == null ? (
          <p className="text-xs text-zinc-600 text-center py-2">
            No anchor yet — tap the first chord below.
          </p>
        ) : (
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 divide-y divide-zinc-800/60">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">First chord at</span>
              <span className="text-sm font-mono text-amber-400 tabular-nums">{formatTime(anchor)}</span>
            </div>
            <div className="px-3 py-2 space-y-1">
              {cues.slice(0, PREVIEW_LIMIT).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-zinc-300">{c.chord}</span>
                  <span className="font-mono tabular-nums text-zinc-500">{formatTime(c.time)}</span>
                </div>
              ))}
              {cues.length > PREVIEW_LIMIT && (
                <div className="text-[10px] text-zinc-600 text-center pt-1">
                  +{cues.length - PREVIEW_LIMIT} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 px-4 py-3 bg-zinc-950/90 backdrop-blur-sm border-t border-zinc-800/60 space-y-2">
        <button
          onPointerDown={(e) => { e.preventDefault(); tapAnchor(); }}
          disabled={!player}
          className={[
            'w-full rounded-2xl font-black tracking-[0.2em] touch-manipulation',
            'text-2xl py-6 transition-all duration-[120ms] active:scale-95',
            'bg-amber-500 text-zinc-950 hover:bg-amber-400',
            'shadow-lg shadow-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed',
          ].join(' ')}
        >
          {anchor == null ? 'TAP FIRST CHORD' : 'RE-TAP'}
        </button>

        {anchor != null && (
          <button
            onClick={() => onSave(cues)}
            className="w-full py-3 rounded-xl text-sm font-bold
              bg-zinc-800 text-amber-400 hover:bg-zinc-700
              transition-colors touch-manipulation tabular-nums"
          >
            Save · {cues.length} chords
          </button>
        )}
      </div>
    </div>
  );
}
