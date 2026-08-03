import { describe, expect, it } from 'vitest';
import {
  sectionsShareProgression,
  applyBeatsFromSection,
  matchingSectionIndices,
  copyBeatsToSections,
} from '@/domain/music/gridCopy';
import type { ChordSection } from '@/domain/music/types';

const section = (label: string, chords: [string, number][], repeat = 1): ChordSection => ({
  label,
  repeat,
  chords: chords.map(([chord, beats]) => ({ chord, beats })),
});

describe('sectionsShareProgression', () => {
  it('is true for the same chords in the same order, ignoring beats', () => {
    const a = section('Verse', [['F#m', 4], ['D', 4], ['E', 4], ['A', 4]]);
    const b = section('Chorus', [['F#m', 2], ['D', 8], ['E', 1], ['A', 4]]);
    expect(sectionsShareProgression(a, b)).toBe(true);
  });

  it('ignores label and repeat', () => {
    const a = section('Verse', [['C', 4], ['G', 4]], 1);
    const b = section('Hook', [['C', 4], ['G', 4]], 4);
    expect(sectionsShareProgression(a, b)).toBe(true);
  });

  it('is false when chord counts differ', () => {
    const a = section('Verse', [['C', 4], ['G', 4]]);
    const b = section('Chorus', [['C', 4], ['G', 4], ['Am', 4]]);
    expect(sectionsShareProgression(a, b)).toBe(false);
  });

  it('is false when a chord name differs', () => {
    const a = section('Verse', [['C', 4], ['G', 4]]);
    const b = section('Chorus', [['C', 4], ['Am', 4]]);
    expect(sectionsShareProgression(a, b)).toBe(false);
  });

  it('is false when the order differs', () => {
    const a = section('Verse', [['C', 4], ['G', 4]]);
    const b = section('Chorus', [['G', 4], ['C', 4]]);
    expect(sectionsShareProgression(a, b)).toBe(false);
  });

  it('distinguishes chord spelling exactly (F# vs Gb)', () => {
    const a = section('A', [['F#', 4]]);
    const b = section('B', [['Gb', 4]]);
    expect(sectionsShareProgression(a, b)).toBe(false);
  });
});

describe('applyBeatsFromSection', () => {
  it('copies beats positionally onto a matching target', () => {
    const source = section('Verse',  [['C', 2], ['G', 6]]);
    const target = section('Chorus', [['C', 4], ['G', 4]], 3);
    const result = applyBeatsFromSection(source, target);
    expect(result.chords).toEqual([
      { chord: 'C', beats: 2 },
      { chord: 'G', beats: 6 },
    ]);
  });

  it('keeps the target label and repeat', () => {
    const source = section('Verse',  [['C', 2], ['G', 6]], 1);
    const target = section('Chorus', [['C', 4], ['G', 4]], 3);
    const result = applyBeatsFromSection(source, target);
    expect(result.label).toBe('Chorus');
    expect(result.repeat).toBe(3);
  });

  it('returns the target unchanged when progressions differ', () => {
    const source = section('Verse',  [['C', 2], ['G', 6]]);
    const target = section('Chorus', [['C', 4], ['Am', 4]]);
    expect(applyBeatsFromSection(source, target)).toBe(target);
  });

  it('does not mutate the target', () => {
    const source = section('Verse',  [['C', 2]]);
    const target = section('Chorus', [['C', 4]]);
    applyBeatsFromSection(source, target);
    expect(target.chords[0].beats).toBe(4);
  });
});

describe('matchingSectionIndices', () => {
  const grid = [
    section('Verse 1', [['C', 4], ['G', 4]]),
    section('Pre',     [['F', 4], ['C', 4]]),
    section('Chorus 1', [['C', 2], ['G', 6]]),
    section('Chorus 2', [['C', 8], ['G', 1]]),
  ];

  it('lists other sections with the same progression, excluding the source', () => {
    expect(matchingSectionIndices(grid, 0)).toEqual([2, 3]);
  });

  it('returns [] when nothing else matches', () => {
    expect(matchingSectionIndices(grid, 1)).toEqual([]);
  });

  it('returns [] for an out-of-range index', () => {
    expect(matchingSectionIndices(grid, 99)).toEqual([]);
  });
});

describe('copyBeatsToSections', () => {
  const grid = [
    section('Verse 1',  [['C', 2], ['G', 6]]),
    section('Chorus 1', [['C', 4], ['G', 4]]),
    section('Chorus 2', [['C', 4], ['G', 4]]),
    section('Bridge',   [['F', 4], ['Am', 4]]),
  ];

  it('copies the source beats into the given matching targets', () => {
    const result = copyBeatsToSections(grid, 0, [1, 2]);
    expect(result[1].chords).toEqual([{ chord: 'C', beats: 2 }, { chord: 'G', beats: 6 }]);
    expect(result[2].chords).toEqual([{ chord: 'C', beats: 2 }, { chord: 'G', beats: 6 }]);
  });

  it('leaves the source and untargeted sections untouched', () => {
    const result = copyBeatsToSections(grid, 0, [1]);
    expect(result[0]).toBe(grid[0]);
    expect(result[3]).toBe(grid[3]);
  });

  it('skips targets whose progression does not match', () => {
    const result = copyBeatsToSections(grid, 0, [1, 3]);
    expect(result[3]).toBe(grid[3]); // Bridge differs — unchanged
    expect(result[1].chords[0].beats).toBe(2);
  });

  it('returns the grid unchanged for an out-of-range source', () => {
    expect(copyBeatsToSections(grid, 99, [1])).toBe(grid);
  });
});
