import { describe, expect, it } from 'vitest';
import {
  flattenGridBeats,
  gridAlignsWithChords,
  generateCuesFromGrid,
} from '@/domain/music/gridSync';
import { getTimeSignature } from '@/domain/music/timeSignature';
import type { ChordSection } from '@/domain/music/types';

const section = (label: string, chords: [string, number][], repeat = 1): ChordSection => ({
  label,
  repeat,
  chords: chords.map(([chord, beats]) => ({ chord, beats })),
});

describe('flattenGridBeats', () => {
  it('returns [] for an empty grid', () => {
    expect(flattenGridBeats([])).toEqual([]);
  });

  it('concatenates chords across sections in order', () => {
    const grid = [
      section('Verse', [['C', 4], ['G', 4]]),
      section('Chorus', [['Am', 2], ['F', 2]]),
    ];
    expect(flattenGridBeats(grid)).toEqual([
      { chord: 'C', beats: 4 },
      { chord: 'G', beats: 4 },
      { chord: 'Am', beats: 2 },
      { chord: 'F', beats: 2 },
    ]);
  });

  it('ignores section repeat (does not expand)', () => {
    const grid = [section('Loop', [['C', 4], ['G', 4]], 4)];
    expect(flattenGridBeats(grid)).toHaveLength(2);
  });
});

describe('gridAlignsWithChords', () => {
  it('is true when flattened length matches the chord count', () => {
    const grid = [section('A', [['C', 4], ['G', 4]])];
    expect(gridAlignsWithChords(grid, ['C', 'G'])).toBe(true);
  });

  it('is false when counts differ', () => {
    const grid = [section('A', [['C', 4], ['G', 4]])];
    expect(gridAlignsWithChords(grid, ['C', 'G', 'Am'])).toBe(false);
  });

  it('is false for empty chords even with an empty grid', () => {
    expect(gridAlignsWithChords([], [])).toBe(false);
  });

  it('ignores repeat when checking alignment', () => {
    const grid = [section('A', [['C', 4], ['G', 4]], 3)];
    expect(gridAlignsWithChords(grid, ['C', 'G'])).toBe(true);
  });
});

describe('generateCuesFromGrid', () => {
  it('places the first chord exactly on the anchor', () => {
    const cues = generateCuesFromGrid(['C'], [4], 10, 0.5);
    expect(cues[0]).toEqual({ time: 10, chord: 'C' });
  });

  it('spaces chords by beats × secondsPerBeat', () => {
    // 0.5 s/beat → 4 beats = 2 s per chord
    const cues = generateCuesFromGrid(['C', 'G', 'Am'], [4, 4, 4], 0, 0.5);
    expect(cues).toEqual([
      { time: 0, chord: 'C' },
      { time: 2, chord: 'G' },
      { time: 4, chord: 'Am' },
    ]);
  });

  it('honors mixed beat durations', () => {
    // 1 s/beat
    const cues = generateCuesFromGrid(['C', 'G', 'Am'], [2, 1, 4], 5, 1);
    expect(cues.map((c) => c.time)).toEqual([5, 7, 8]);
  });

  it('rescales spacing with secondsPerBeat', () => {
    const slow = generateCuesFromGrid(['C', 'G'], [4, 4], 0, 1);
    const fast = generateCuesFromGrid(['C', 'G'], [4, 4], 0, 0.5);
    expect(slow[1].time).toBe(4);
    expect(fast[1].time).toBe(2);
  });

  it('carries the anchor offset through every cue', () => {
    const cues = generateCuesFromGrid(['C', 'G'], [4, 4], 12.5, 0.5);
    expect(cues.map((c) => c.time)).toEqual([12.5, 14.5]);
  });

  it('uses the sheet chord names, in order', () => {
    const cues = generateCuesFromGrid(['C', 'G', 'Am'], [4, 4, 4], 0, 0.5);
    expect(cues.map((c) => c.chord)).toEqual(['C', 'G', 'Am']);
  });

  it('returns [] when chords and beats lengths differ', () => {
    expect(generateCuesFromGrid(['C', 'G'], [4], 0, 0.5)).toEqual([]);
  });

  it('returns [] for non-positive secondsPerBeat', () => {
    expect(generateCuesFromGrid(['C'], [4], 0, 0)).toEqual([]);
    expect(generateCuesFromGrid(['C'], [4], 0, -0.5)).toEqual([]);
  });

  it('returns [] for no chords', () => {
    expect(generateCuesFromGrid([], [], 0, 0.5)).toEqual([]);
  });

  it('produces a strictly increasing timeline for positive beats', () => {
    const cues = generateCuesFromGrid(['C', 'G', 'Am', 'F'], [4, 2, 2, 4], 3, 0.66);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i].time).toBeGreaterThan(cues[i - 1].time);
    }
  });

  // ── Meter integration: spacing must track TimeSignature.clickInterval ─────────

  it('matches the metronome click interval for 4/4 (♩ = BPM)', () => {
    const spb = getTimeSignature('4_4').clickInterval(120); // 0.5 s
    const cues = generateCuesFromGrid(['C', 'G'], [4, 4], 0, spb);
    expect(cues[1].time).toBeCloseTo(2, 5); // one 4-beat bar = 2 s
  });

  it('handles 6/8 compound meter (♩. = BPM, click = eighth note)', () => {
    // At 120 dotted-quarter BPM, a full 6/8 bar (6 eighths) lasts 2 s — the
    // same wall-clock length the grid player produces. A bare 60/bpm would
    // give 3 s (3× too slow), so this locks in the clickInterval fix.
    const spb = getTimeSignature('6_8').clickInterval(120); // (60/120)/3 = 0.16667 s
    const cues = generateCuesFromGrid(['C', 'G'], [6, 6], 0, spb);
    expect(cues[1].time).toBeCloseTo(1, 5);   // half-bar = 3 eighths = 1 s
    expect(cues[0].time).toBe(0);
  });

  it('handles 7/8 irregular meter (♩ = BPM, click = eighth note)', () => {
    const spb = getTimeSignature('7_8').clickInterval(120); // 30/120 = 0.25 s
    const cues = generateCuesFromGrid(['C', 'G'], [7, 7], 0, spb);
    expect(cues[1].time).toBeCloseTo(1.75, 5); // 7 eighths = 1.75 s
  });
});
