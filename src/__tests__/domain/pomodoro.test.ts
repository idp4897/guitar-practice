import { describe, expect, it } from 'vitest';
import {
  BPM_MIN,
  BPM_MAX,
  MAX_SESSIONS,
  buildTimeline,
  formatClock,
  formatDuration,
  sessionLabel,
  totalDurationSec,
  validateProgram,
} from '@/domain/pomodoro/program';
import type { MiniSession } from '@/domain/pomodoro/types';

function session(overrides: Partial<MiniSession> = {}): MiniSession {
  return {
    id:        's1',
    bpm:       100,
    timeSigId: '4_4',
    trainSec:  600,
    restSec:   300,
    ...overrides,
  };
}

/** The user's example: 1 hour ladder, 80 → 140 BPM. */
const LADDER: MiniSession[] = [80, 100, 120, 140].map((bpm, i) =>
  session({ id: `s${i + 1}`, bpm, trainSec: 600, restSec: 300 }),
);

describe('sessionLabel', () => {
  it('uses the custom label when present', () => {
    expect(sessionLabel(session({ label: 'Alternate picking' }), 0)).toBe('Alternate picking');
  });

  it('falls back to session number and BPM when blank', () => {
    expect(sessionLabel(session({ bpm: 100 }), 1)).toBe('Session 2 · 100 BPM');
  });

  it('treats a whitespace-only label as blank', () => {
    expect(sessionLabel(session({ label: '   ', bpm: 80 }), 0)).toBe('Session 1 · 80 BPM');
  });
});

describe('buildTimeline', () => {
  it('returns no stages for an empty program', () => {
    expect(buildTimeline([])).toEqual([]);
  });

  it('drops the rest after the final session', () => {
    const stages = buildTimeline(LADDER);
    expect(stages).toHaveLength(7);                       // 4 train + 3 rest
    expect(stages.at(-1)?.kind).toBe('train');
  });

  it('alternates train and rest', () => {
    expect(buildTimeline(LADDER).map((s) => s.kind)).toEqual([
      'train', 'rest', 'train', 'rest', 'train', 'rest', 'train',
    ]);
  });

  it('carries BPM and time signature onto each stage', () => {
    const stages = buildTimeline(LADDER);
    expect(stages[0].bpm).toBe(80);
    expect(stages[2].bpm).toBe(100);
    expect(stages[6].bpm).toBe(140);
    expect(stages.every((s) => s.timeSigId === '4_4')).toBe(true);
  });

  it('keeps per-session time signatures distinct', () => {
    const stages = buildTimeline([
      session({ id: 'a', timeSigId: '4_4' }),
      session({ id: 'b', timeSigId: '7_8' }),
    ]);
    expect(stages.map((s) => s.timeSigId)).toEqual(['4_4', '4_4', '7_8']);
  });

  it('points each stage back at its session index', () => {
    expect(buildTimeline(LADDER).map((s) => s.sessionIndex)).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });

  it('omits a rest stage when restSec is zero', () => {
    const stages = buildTimeline([
      session({ id: 'a', restSec: 0 }),
      session({ id: 'b', restSec: 300 }),
    ]);
    expect(stages.map((s) => s.kind)).toEqual(['train', 'train']);
  });

  it('a single session produces one train stage and no rest', () => {
    const stages = buildTimeline([session({ restSec: 300 })]);
    expect(stages).toHaveLength(1);
    expect(stages[0].kind).toBe('train');
  });
});

describe('totalDurationSec', () => {
  it('sums the 1-hour ladder to 55 minutes — the final rest is dropped', () => {
    expect(totalDurationSec(LADDER)).toBe(4 * 600 + 3 * 300);
    expect(totalDurationSec(LADDER)).toBe(3300);
  });

  it('is zero for an empty program', () => {
    expect(totalDurationSec([])).toBe(0);
  });
});

describe('formatClock', () => {
  it.each([
    [0,    '00:00'],
    [59,   '00:59'],
    [600,  '10:00'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3840, '1:04:00'],
  ])('formats %i seconds as %s', (input, expected) => {
    expect(formatClock(input)).toBe(expected);
  });

  it('clamps negatives to zero', () => {
    expect(formatClock(-5)).toBe('00:00');
  });
});

describe('formatDuration', () => {
  it.each([
    [30,   '30s'],
    [300,  '5m'],
    [3300, '55m'],
    [3600, '1h 00m'],
    [3900, '1h 05m'],
  ])('formats %i seconds as %s', (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe('validateProgram', () => {
  it('accepts the 1-hour ladder', () => {
    expect(validateProgram('1 Hour Ladder', LADDER)).toEqual([]);
  });

  it('requires a name', () => {
    expect(validateProgram('   ', LADDER)).toContain('Program name is required.');
  });

  it('requires at least one session', () => {
    expect(validateProgram('Empty', [])).toContain('Add at least one session.');
  });

  it('rejects BPM outside the metronome range', () => {
    expect(validateProgram('x', [session({ bpm: BPM_MIN - 1 })])).toHaveLength(1);
    expect(validateProgram('x', [session({ bpm: BPM_MAX + 1 })])).toHaveLength(1);
    expect(validateProgram('x', [session({ bpm: BPM_MIN })])).toEqual([]);
    expect(validateProgram('x', [session({ bpm: BPM_MAX })])).toEqual([]);
  });

  it('rejects an unknown time signature', () => {
    expect(validateProgram('x', [session({ timeSigId: '13_16' })]))
      .toContain('Session 1: unknown time signature.');
  });

  it('rejects non-positive training time', () => {
    expect(validateProgram('x', [session({ trainSec: 0 })]))
      .toContain('Session 1: training time must be greater than zero.');
  });

  it('allows zero rest but rejects negative rest', () => {
    expect(validateProgram('x', [session({ restSec: 0 })])).toEqual([]);
    expect(validateProgram('x', [session({ restSec: -1 })]))
      .toContain('Session 1: rest time cannot be negative.');
  });

  it('reports the offending session by number', () => {
    const errors = validateProgram('x', [session(), session({ bpm: 999 })]);
    expect(errors).toContain(`Session 2: BPM must be between ${BPM_MIN} and ${BPM_MAX}.`);
  });

  it('caps the number of sessions', () => {
    const many = Array.from({ length: MAX_SESSIONS + 1 }, (_, i) => session({ id: `s${i}` }));
    expect(validateProgram('x', many))
      .toContain(`A program can hold at most ${MAX_SESSIONS} sessions.`);
  });
});
