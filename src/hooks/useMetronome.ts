'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type AccentLevel,
  type TimeSignature,
  generateAccents,
  getTimeSignature,
} from '@/domain/music/timeSignature';

// ─── Lookahead scheduler constants ────────────────────────────────────────────
// Based on "A Tale of Two Clocks" by Chris Wilson.

const LOOKAHEAD_SEC = 0.1;
const SCHEDULE_MS   = 25;

// ─── Audio parameters per accent level ────────────────────────────────────────

const ACCENT_AUDIO: Record<AccentLevel, { freq: number; amp: number; dur: number }> = {
  strong: { freq: 880, amp: 0.90, dur: 0.055 },
  medium: { freq: 660, amp: 0.65, dur: 0.045 },
  weak:   { freq: 440, amp: 0.45, dur: 0.040 },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export interface UseMetronomeReturn {
  isPlaying:          boolean;
  bpm:                number;
  timeSignature:      TimeSignature;
  currentBeat:        number;   // 0-indexed beat within bar; -1 when stopped
  currentAccent:      AccentLevel | null;
  toggle:             () => Promise<void>;
  setBpm:             (bpm: number) => void;
  setTimeSignature:   (ts: TimeSignature) => void;
  /** Override accents for irregular time (5/8, 7/8) with a specific grouping. */
  setGrouping:        (grouping: number[]) => void;
  activeGrouping:     number[] | null;
}

export function useMetronome(
  initialBpm = 120,
  initialTimeSigId = '4_4',
): UseMetronomeReturn {
  // ── AudioContext — created lazily on first user gesture ─────────────────────
  const ctxRef = useRef<AudioContext | null>(null);

  // ── Scheduler state (refs only — never trigger re-renders) ──────────────────
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextTimeRef  = useRef(0);
  const beatCountRef = useRef(0);
  const isRunningRef = useRef(false);
  const genRef       = useRef(0);

  // ── Mutable copies of controlled settings ───────────────────────────────────
  const bpmRef      = useRef(initialBpm);
  const tsSigRef    = useRef<TimeSignature>(getTimeSignature(initialTimeSigId));
  const accentsRef  = useRef<AccentLevel[]>(tsSigRef.current.accents);

  // ── React state — drives UI only ────────────────────────────────────────────
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [bpm,            setBpmState]        = useState(initialBpm);
  const [timeSignature,  setTsSigState]      = useState<TimeSignature>(tsSigRef.current);
  const [currentBeat,    setCurrentBeat]     = useState(-1);
  const [currentAccent,  setCurrentAccent]   = useState<AccentLevel | null>(null);
  const [activeGrouping, setActiveGrouping]  = useState<number[] | null>(null);

  // ── BPM setter ───────────────────────────────────────────────────────────────

  const setBpm = useCallback((v: number) => {
    const n = Math.max(20, Math.min(300, Math.round(v)));
    bpmRef.current = n;
    setBpmState(n);
  }, []);

  // ── Time signature setter ────────────────────────────────────────────────────

  const setTimeSignature = useCallback((ts: TimeSignature) => {
    tsSigRef.current   = ts;
    accentsRef.current = ts.accents;
    setTsSigState(ts);
    setActiveGrouping(null);
    // Reset bar on time-signature change — no glitch, just restart bar
    beatCountRef.current = 0;
  }, []);

  // ── Grouping override (5/8, 7/8) ────────────────────────────────────────────

  const setGrouping = useCallback((grouping: number[]) => {
    const accents = generateAccents(grouping);
    accentsRef.current = accents;
    setActiveGrouping(grouping);
    beatCountRef.current = 0;
  }, []);

  // ── Audio: schedule one click at precise AudioContext time ───────────────────

  const scheduleClick = useCallback((beat: number, time: number, gen: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const accent = accentsRef.current[beat] ?? 'weak';
    const { freq, amp, dur } = ACCENT_AUDIO[accent];

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = freq;
    gain.gain.setValueAtTime(amp, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.start(time);
    osc.stop(time + dur + 0.005);

    // Visual feedback — fires close to the audio event via setTimeout.
    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (genRef.current !== gen) return;
      setCurrentBeat(beat);
      setCurrentAccent(accent);
    }, delayMs);
  }, []);

  // ── Scheduler loop ───────────────────────────────────────────────────────────

  const scheduler = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || !isRunningRef.current) return;

    const ts  = tsSigRef.current;
    const spb = ts.clickInterval(bpmRef.current);
    const gen = genRef.current;

    while (nextTimeRef.current < ctx.currentTime + LOOKAHEAD_SEC) {
      scheduleClick(beatCountRef.current, nextTimeRef.current, gen);
      nextTimeRef.current  += spb;
      beatCountRef.current  = (beatCountRef.current + 1) % ts.numerator;
    }

    timerRef.current = setTimeout(scheduler, SCHEDULE_MS);
  }, [scheduleClick]);

  // ── Start / stop ─────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new Ctor();
    }

    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    isRunningRef.current = true;
    beatCountRef.current = 0;
    nextTimeRef.current  = ctx.currentTime + 0.05;

    setIsPlaying(true);
    scheduler();
  }, [scheduler]);

  const stop = useCallback(() => {
    isRunningRef.current = false;
    genRef.current++;

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setIsPlaying(false);
    setCurrentBeat(-1);
    setCurrentAccent(null);
  }, []);

  const toggle = useCallback(async () => {
    if (isRunningRef.current) stop(); else await start();
  }, [start, stop]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  return {
    isPlaying,
    bpm,
    timeSignature,
    currentBeat,
    currentAccent,
    toggle,
    setBpm,
    setTimeSignature,
    setGrouping,
    activeGrouping,
  };
}
