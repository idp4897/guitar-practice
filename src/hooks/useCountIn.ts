'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMetronome } from './useMetronome';
import { getTimeSignature } from '@/domain/music/timeSignature';

export interface UseCountInReturn {
  startCountIn: (onComplete: () => void) => Promise<void>;
  cancelCountIn: () => void;
  isCountingIn: boolean;
  currentBeat: number;
  beatsTotal: number;
}

export function useCountIn(bpm: number, timeSigId = '4_4'): UseCountInReturn {
  const metronome = useMetronome(bpm, timeSigId);
  const [isCountingIn, setIsCountingIn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const beatsTotal = getTimeSignature(timeSigId).numerator;

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  const cancelCountIn = useCallback(() => {
    if (!activeRef.current) return;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    activeRef.current = false;
    setIsCountingIn(false);
    metronome.stop();
  }, [metronome]);

  const startCountIn = useCallback(async (onComplete: () => void) => {
    if (activeRef.current) return;
    const barMs = (60000 / bpm) * beatsTotal;
    activeRef.current = true;
    setIsCountingIn(true);
    await metronome.toggle();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      activeRef.current = false;
      setIsCountingIn(false);
      metronome.stop();
      onComplete();
    }, barMs);
  }, [bpm, beatsTotal, metronome]);

  return { startCountIn, cancelCountIn, isCountingIn, currentBeat: metronome.currentBeat, beatsTotal };
}
