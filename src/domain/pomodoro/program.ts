import { TIME_SIGNATURES } from '@/domain/music/timeSignature';
import type { MiniSession, Stage } from './types';

// ─── Limits ───────────────────────────────────────────────────────────────────
// BPM range mirrors the metronome UI (see components/Metronome.tsx).

export const BPM_MIN      = 40;
export const BPM_MAX      = 240;
export const MAX_SESSIONS = 12;

// ─── Labels ───────────────────────────────────────────────────────────────────

/** Display name for a session — falls back to "Session 2 · 100 BPM". */
export function sessionLabel(session: MiniSession, index: number): string {
  const trimmed = session.label?.trim();
  if (trimmed) return trimmed;
  return `Session ${index + 1} · ${session.bpm} BPM`;
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
//
// Each session contributes a train stage, then a rest stage. The rest after the
// final session is dropped — a countdown with nothing after it is dead time.
// A session with restSec <= 0 contributes no rest stage either.

export function buildTimeline(sessions: MiniSession[]): Stage[] {
  const stages: Stage[] = [];

  sessions.forEach((session, index) => {
    const label = sessionLabel(session, index);

    stages.push({
      kind:         'train',
      sessionIndex: index,
      label,
      durationSec:  session.trainSec,
      bpm:          session.bpm,
      timeSigId:    session.timeSigId,
    });

    const isLast = index === sessions.length - 1;
    if (isLast || session.restSec <= 0) return;

    stages.push({
      kind:         'rest',
      sessionIndex: index,
      label,
      durationSec:  session.restSec,
      bpm:          session.bpm,
      timeSigId:    session.timeSigId,
    });
  });

  return stages;
}

/** Total wall-clock length of a program, excluding the dropped final rest. */
export function totalDurationSec(sessions: MiniSession[]): number {
  return buildTimeline(sessions).reduce((sum, stage) => sum + stage.durationSec, 0);
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/** Countdown clock: "09:59", or "1:04:00" once past an hour. */
export function formatClock(totalSec: number): string {
  const safe    = Math.max(0, Math.round(totalSec));
  const hours   = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad     = (n: number) => String(n).padStart(2, '0');

  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Human summary of a duration: "1h 05m", "45m", "30s". */
export function formatDuration(totalSec: number): string {
  const safe    = Math.max(0, Math.round(totalSec));
  if (safe < 60) return `${safe}s`;

  const hours   = Math.floor(safe / 3600);
  const minutes = Math.round((safe % 3600) / 60);

  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateProgram(name: string, sessions: MiniSession[]): string[] {
  const errors: string[] = [];

  if (!name.trim())                errors.push('Program name is required.');
  if (sessions.length === 0)       errors.push('Add at least one session.');
  if (sessions.length > MAX_SESSIONS) {
    errors.push(`A program can hold at most ${MAX_SESSIONS} sessions.`);
  }

  sessions.forEach((session, index) => {
    const where = `Session ${index + 1}`;

    if (!Number.isFinite(session.bpm) || session.bpm < BPM_MIN || session.bpm > BPM_MAX) {
      errors.push(`${where}: BPM must be between ${BPM_MIN} and ${BPM_MAX}.`);
    }
    if (!TIME_SIGNATURES.some((ts) => ts.id === session.timeSigId)) {
      errors.push(`${where}: unknown time signature.`);
    }
    if (!Number.isFinite(session.trainSec) || session.trainSec <= 0) {
      errors.push(`${where}: training time must be greater than zero.`);
    }
    if (!Number.isFinite(session.restSec) || session.restSec < 0) {
      errors.push(`${where}: rest time cannot be negative.`);
    }
  });

  return errors;
}
