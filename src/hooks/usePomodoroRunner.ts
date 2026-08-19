'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMetronome } from './useMetronome';
import { getTimeSignature } from '@/domain/music/timeSignature';
import { buildTimeline } from '@/domain/pomodoro/program';
import type { MiniSession, Stage } from '@/domain/pomodoro/types';

// Countdowns are driven off a wall-clock deadline rather than an accumulating
// interval: browsers throttle timers in background tabs, which would otherwise
// stretch a 10-minute stage well past 10 minutes.
const TICK_MS = 250;

export type RunnerStatus =
  | 'idle'
  | 'training'
  | 'resting'
  | 'awaitingReady'   // rest is over; waiting for the user to confirm they're back
  | 'paused'
  | 'done';

export interface UsePomodoroRunnerReturn {
  status:        RunnerStatus;
  stage:         Stage | null;
  stageIndex:    number;
  timeline:      Stage[];
  remainingSec:  number;
  /** Index of the session currently being trained or rested on. */
  sessionIndex:  number;
  isPlaying:     boolean;
  currentBeat:   number;
  bpm:           number;
  timeSigId:     string;
  start:         () => Promise<void>;
  ready:         () => Promise<void>;
  pause:         () => void;
  resume:        () => Promise<void>;
  skip:          () => Promise<void>;
  stop:          () => void;
}

export function usePomodoroRunner(sessions: MiniSession[]): UsePomodoroRunnerReturn {
  const timeline = useMemo(() => buildTimeline(sessions), [sessions]);

  const first = timeline[0];
  const metronome = useMetronome(first?.bpm ?? 120, first?.timeSigId ?? '4_4');

  const [status,       setStatus]       = useState<RunnerStatus>('idle');
  const [stageIndex,   setStageIndex]   = useState(0);
  const [remainingSec, setRemainingSec] = useState(first?.durationSec ?? 0);

  const deadlineRef   = useRef<number | null>(null);
  const stageIndexRef = useRef(0);
  const pausedFromRef = useRef<'training' | 'resting'>('training');
  // Lets the tick interval call the latest advance() without being torn down.
  const advanceRef    = useRef<() => void>(() => {});

  const metronomeStop = metronome.stop;
  const metronomeStart = metronome.start;
  const setBpm = metronome.setBpm;
  const setTimeSignature = metronome.setTimeSignature;

  // ── Enter a stage ───────────────────────────────────────────────────────────

  const enterStage = useCallback(async (index: number) => {
    const stage = timeline[index];
    if (!stage) {
      setStatus('done');
      setRemainingSec(0);
      deadlineRef.current = null;
      return;
    }

    stageIndexRef.current = index;
    setStageIndex(index);
    setRemainingSec(stage.durationSec);
    deadlineRef.current = Date.now() + stage.durationSec * 1000;

    if (stage.kind !== 'train') {
      metronomeStop();
      setStatus('resting');
      return;
    }

    setBpm(stage.bpm);
    setTimeSignature(getTimeSignature(stage.timeSigId));
    setStatus('training');
    await metronomeStart();
  }, [timeline, metronomeStart, metronomeStop, setBpm, setTimeSignature]);

  // ── Stage boundary ──────────────────────────────────────────────────────────

  const advance = useCallback(() => {
    const current = timeline[stageIndexRef.current];
    const nextIndex = stageIndexRef.current + 1;
    const next = timeline[nextIndex];

    metronomeStop();
    deadlineRef.current = null;

    if (!next) {
      setStatus('done');
      setRemainingSec(0);
      return;
    }

    // Training just ended → roll straight into the rest countdown.
    if (current?.kind === 'train') {
      void enterStage(nextIndex);
      return;
    }

    // Rest just ended → park on the upcoming training stage until the user is ready.
    stageIndexRef.current = nextIndex;
    setStageIndex(nextIndex);
    setRemainingSec(next.durationSec);
    setStatus('awaitingReady');
  }, [timeline, enterStage, metronomeStop]);

  advanceRef.current = advance;

  // ── Countdown tick ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (status !== 'training' && status !== 'resting') return;

    const id = setInterval(() => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;

      const leftMs = deadline - Date.now();
      if (leftMs <= 0) {
        setRemainingSec(0);
        advanceRef.current();
        return;
      }
      setRemainingSec(Math.ceil(leftMs / 1000));
    }, TICK_MS);

    return () => clearInterval(id);
  }, [status]);

  // Stop the audio if the page unmounts mid-run.
  useEffect(() => () => metronomeStop(), [metronomeStop]);

  // ── Controls ────────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (timeline.length === 0) return;
    await enterStage(0);
  }, [timeline, enterStage]);

  const ready = useCallback(async () => {
    await enterStage(stageIndexRef.current);
  }, [enterStage]);

  const pause = useCallback(() => {
    if (status !== 'training' && status !== 'resting') return;
    pausedFromRef.current = status;

    const deadline = deadlineRef.current;
    if (deadline !== null) {
      setRemainingSec(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }
    deadlineRef.current = null;
    metronomeStop();
    setStatus('paused');
  }, [status, metronomeStop]);

  const resume = useCallback(async () => {
    if (status !== 'paused') return;
    deadlineRef.current = Date.now() + remainingSec * 1000;

    if (pausedFromRef.current === 'training') {
      setStatus('training');
      await metronomeStart();
      return;
    }
    setStatus('resting');
  }, [status, remainingSec, metronomeStart]);

  const skip = useCallback(async () => {
    if (status === 'awaitingReady') {
      await ready();
      return;
    }
    if (status === 'paused') {
      deadlineRef.current = null;
      advance();
      return;
    }
    if (status !== 'training' && status !== 'resting') return;
    advance();
  }, [status, ready, advance]);

  const stop = useCallback(() => {
    metronomeStop();
    deadlineRef.current = null;
    stageIndexRef.current = 0;
    setStageIndex(0);
    setRemainingSec(timeline[0]?.durationSec ?? 0);
    setStatus('idle');
  }, [metronomeStop, timeline]);

  const stage = timeline[stageIndex] ?? null;

  return {
    status,
    stage,
    stageIndex,
    timeline,
    remainingSec,
    sessionIndex: stage?.sessionIndex ?? 0,
    isPlaying:    metronome.isPlaying,
    currentBeat:  metronome.currentBeat,
    bpm:          metronome.bpm,
    timeSigId:    metronome.timeSignature.id,
    start,
    ready,
    pause,
    resume,
    skip,
    stop,
  };
}
