// ─── Pomodoro training domain types ───────────────────────────────────────────

/** One drill within a program: a training block followed by a rest block. */
export interface MiniSession {
  id:        string;
  label?:    string;
  bpm:       number;
  timeSigId: string;
  trainSec:  number;
  restSec:   number;
}

export interface PomodoroProgram {
  id:        string;
  name:      string;
  sessions:  MiniSession[];
  createdAt: string;
  updatedAt: string;
}

export type StageKind = 'train' | 'rest';

/** A flattened, runnable step of a program. Produced by buildTimeline(). */
export interface Stage {
  kind:         StageKind;
  sessionIndex: number;
  label:        string;
  durationSec:  number;
  bpm:          number;
  timeSigId:    string;
}
