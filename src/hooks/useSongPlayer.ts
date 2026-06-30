'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type ChordProSheet } from '@/domain/music/types';
import { detectPossibleKeys } from '@/domain/music/theory';
import { extractChords, transposeSheet } from '@/domain/music/chordpro';

const CAPO_MAX = 12;

export interface UseSongPlayerReturn {
  displaySheet:  ChordProSheet;
  transpose:     number;        // net semitones from original
  capo:          number;        // 0-12
  detectedKey:   string | null; // top candidate from detectKey
  transposeUp:   () => void;
  transposeDown: () => void;
  setCapo:       (n: number) => void;
}

// Wraps Music Theory Core (transposeSheet / detectPossibleKeys) for the Player UI.
// Changing capo keeps the sounding key constant — it re-fingers to the new position.
export function useSongPlayer(baseSheet: ChordProSheet, songId: string): UseSongPlayerReturn {
  const [transpose, setTranspose] = useState(0);
  const [capo,      setCapoState] = useState(baseSheet.capo ?? 0);

  // Always-current capo value available synchronously inside callbacks
  const capoRef = useRef(capo);
  capoRef.current = capo;

  // Reset to original tuning whenever the active song changes
  useEffect(() => {
    setTranspose(0);
    setCapoState(baseSheet.capo ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  const displaySheet = useMemo((): ChordProSheet => {
    const transposed = transposeSheet(baseSheet, transpose);
    // Override capo metadata with the user's current capo choice
    return { ...transposed, capo };
  }, [baseSheet, transpose, capo]);

  const detectedKey = useMemo(() => {
    const candidates = detectPossibleKeys(extractChords(displaySheet));
    return candidates[0]?.key ?? null;
  }, [displaySheet]);

  const transposeUp   = useCallback(() => setTranspose((t) => t + 1), []);
  const transposeDown = useCallback(() => setTranspose((t) => t - 1), []);

  // Changing capo re-fingers without shifting the sounding key:
  // the chord shapes go down by (new - old) semitones so the sound stays constant.
  const setCapo = useCallback((newCapo: number) => {
    const next = Math.max(0, Math.min(CAPO_MAX, newCapo));
    const prev = capoRef.current;
    setTranspose((t) => t + (prev - next));
    setCapoState(next);
  }, []);

  return { displaySheet, transpose, capo, detectedKey, transposeUp, transposeDown, setCapo };
}
