'use client';

import { useCallback, useState } from 'react';
import type { ChordCue } from '@/domain/music/types';
import type { ChordState } from '@/components/ChordSheetViewer';
import type { YTPlayer } from '@/lib/youtube';

export interface UseTapSyncReturn {
  tapIdx:      number;       // index of the NEXT chord to tap (0-based)
  taps:        ChordCue[];   // recorded entries so far
  done:        boolean;
  tap:         () => void;   // record current video time for tapIdx, advance
  undo:        () => void;   // remove last tap, step back
  reset:       () => void;   // clear all taps, go to start
  /** Returns the ChordSheetViewer state for a given global chord index. */
  chordStatus: (index: number) => ChordState | undefined;
}

export function useTapSync(chords: string[], player: YTPlayer | null): UseTapSyncReturn {
  const [tapIdx, setTapIdx] = useState(0);
  const [taps,   setTaps]   = useState<ChordCue[]>([]);

  const total = chords.length;
  const done  = tapIdx >= total;

  const tap = useCallback(() => {
    if (!player || done) return;
    const chord = chords[tapIdx];
    if (chord === undefined) return;
    const time = player.getCurrentTime();
    setTaps((prev) => [...prev, { time, chord }]);
    setTapIdx((i) => i + 1);
  }, [player, done, chords, tapIdx]);

  const undo = useCallback(() => {
    setTaps((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
    setTapIdx((i) => Math.max(0, i - 1));
  }, []);

  const reset = useCallback(() => {
    setTapIdx(0);
    setTaps([]);
  }, []);

  const chordStatus = useCallback((index: number): ChordState | undefined => {
    if (index < 0) return undefined;
    if (index < tapIdx) return 'synced';
    if (index === tapIdx) return 'active';
    return 'pending';
  }, [tapIdx]);

  return { tapIdx, taps, done, tap, undo, reset, chordStatus };
}
