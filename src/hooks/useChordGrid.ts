'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMetronome, type UseMetronomeReturn } from './useMetronome';
import type { ChordSection } from '@/domain/music/types';
import type { TimeSignature } from '@/domain/music/timeSignature';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GridPlayMode =
  | 'run-through'
  | { type: 'practice'; sectionIndex: number };

interface BeatEntry {
  chord:            string;
  sectionIdx:       number;
  chordIdxInSection: number;
  startBeat:        number;
  endBeat:          number; // exclusive
}

export interface UseChordGridReturn {
  // Metronome passthrough
  isPlaying:       boolean;
  bpm:             number;
  timeSignature:   TimeSignature;
  currentBeat:     number;
  absoluteBeat:    number;
  toggle:          () => Promise<void>;
  stop:            () => void;
  setBpm:          (bpm: number) => void;
  setTimeSignature:(ts: TimeSignature) => void;
  setGrouping:     (g: number[]) => void;
  activeGrouping:  number[] | null;
  // Grid state
  currentChord:      string | null;
  currentSectionIdx: number;
  currentChordIdx:   number;   // index within the section's chords array; -1 when idle
  done:              boolean;
  mode:            GridPlayMode;
  setMode:         (mode: GridPlayMode) => void;
}

// ─── Timeline builder ─────────────────────────────────────────────────────────

function buildTimeline(grid: ChordSection[], mode: GridPlayMode): BeatEntry[] {
  const entries: BeatEntry[] = [];
  let cursor = 0;

  if (mode === 'run-through') {
    for (let si = 0; si < grid.length; si++) {
      const section = grid[si];
      const reps = section.repeat === 0 ? 1 : section.repeat;
      for (let ri = 0; ri < reps; ri++) {
        for (let ci = 0; ci < section.chords.length; ci++) {
          const cb = section.chords[ci];
          entries.push({ chord: cb.chord, sectionIdx: si, chordIdxInSection: ci, startBeat: cursor, endBeat: cursor + cb.beats });
          cursor += cb.beats;
        }
      }
    }
  } else {
    const section = grid[mode.sectionIndex];
    if (!section) return [];
    for (let ci = 0; ci < section.chords.length; ci++) {
      const cb = section.chords[ci];
      entries.push({ chord: cb.chord, sectionIdx: mode.sectionIndex, chordIdxInSection: ci, startBeat: cursor, endBeat: cursor + cb.beats });
      cursor += cb.beats;
    }
  }

  return entries;
}

function findEntry(entries: BeatEntry[], beat: number): BeatEntry | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].startBeat <= beat) return entries[i];
  }
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChordGrid(
  grid: ChordSection[],
  initialBpm = 120,
  initialTimeSigId = '4_4',
): UseChordGridReturn {
  const [mode, setMode] = useState<GridPlayMode>('run-through');
  const metronome = useMetronome(initialBpm, initialTimeSigId);
  const { absoluteBeat, isPlaying, stop: metStop } = metronome;

  const timeline = useMemo(() => buildTimeline(grid, mode), [grid, mode]);
  const totalBeats = timeline.length > 0 ? timeline[timeline.length - 1].endBeat : 0;

  const lookupBeat = absoluteBeat < 0
    ? -1
    : mode !== 'run-through' && totalBeats > 0
      ? absoluteBeat % totalBeats
      : absoluteBeat;

  const entry = lookupBeat >= 0 ? findEntry(timeline, lookupBeat) : null;
  const done = mode === 'run-through' && absoluteBeat >= totalBeats && totalBeats > 0 && isPlaying;

  const hasStoppedRef = useRef(false);
  useEffect(() => {
    if (done && !hasStoppedRef.current) {
      hasStoppedRef.current = true;
      metStop();
    }
  }, [done, metStop]);

  useEffect(() => {
    if (!isPlaying) hasStoppedRef.current = false;
  }, [isPlaying]);

  return {
    isPlaying:        metronome.isPlaying,
    bpm:              metronome.bpm,
    timeSignature:    metronome.timeSignature,
    currentBeat:      metronome.currentBeat,
    absoluteBeat:     metronome.absoluteBeat,
    toggle:           metronome.toggle,
    stop:             metronome.stop,
    setBpm:           metronome.setBpm,
    setTimeSignature: metronome.setTimeSignature,
    setGrouping:      metronome.setGrouping,
    activeGrouping:   metronome.activeGrouping,
    currentChord:      entry?.chord ?? null,
    currentSectionIdx: entry?.sectionIdx ?? -1,
    currentChordIdx:   entry?.chordIdxInSection ?? -1,
    done,
    mode,
    setMode,
  };
}
