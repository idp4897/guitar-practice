import { describe, expect, it } from 'vitest';
import {
  generateAccents,
  getTimeSignature,
  TIME_SIGNATURES,
} from '@/domain/music/timeSignature';

describe('generateAccents', () => {
  it('4/4 – [4] → strong, weak, weak, weak (note: 4/4 uses fixed accents in catalogue)', () => {
    expect(generateAccents([4])).toEqual(['strong', 'weak', 'weak', 'weak']);
  });

  it('3/4 – [3] → strong at 0, weak elsewhere', () => {
    expect(generateAccents([3])).toEqual(['strong', 'weak', 'weak']);
  });

  it('2/4 – [2] → strong at 0, weak at 1', () => {
    expect(generateAccents([2])).toEqual(['strong', 'weak']);
  });

  it('6/8 – [3,3] → strong@0, medium@3', () => {
    expect(generateAccents([3, 3])).toEqual([
      'strong', 'weak', 'weak',
      'medium', 'weak', 'weak',
    ]);
  });

  it('9/8 – [3,3,3] → strong@0, medium@3, medium@6', () => {
    expect(generateAccents([3, 3, 3])).toEqual([
      'strong', 'weak', 'weak',
      'medium', 'weak', 'weak',
      'medium', 'weak', 'weak',
    ]);
  });

  it('12/8 – [3,3,3,3] → strong@0, medium@3,6,9', () => {
    const result = generateAccents([3, 3, 3, 3]);
    expect(result).toHaveLength(12);
    expect(result[0]).toBe('strong');
    expect(result[3]).toBe('medium');
    expect(result[6]).toBe('medium');
    expect(result[9]).toBe('medium');
    expect(result.filter(a => a === 'weak')).toHaveLength(8);
  });

  it('7/8 grouping 2+2+3 → strong@0, medium@2, medium@4', () => {
    expect(generateAccents([2, 2, 3])).toEqual([
      'strong', 'weak',
      'medium', 'weak',
      'medium', 'weak', 'weak',
    ]);
  });

  it('7/8 grouping 3+2+2 → strong@0, medium@3, medium@5', () => {
    expect(generateAccents([3, 2, 2])).toEqual([
      'strong', 'weak', 'weak',
      'medium', 'weak',
      'medium', 'weak',
    ]);
  });

  it('5/8 grouping 2+3 → strong@0, medium@2', () => {
    expect(generateAccents([2, 3])).toEqual([
      'strong', 'weak',
      'medium', 'weak', 'weak',
    ]);
  });

  it('5/8 grouping 3+2 → strong@0, medium@3', () => {
    expect(generateAccents([3, 2])).toEqual([
      'strong', 'weak', 'weak',
      'medium', 'weak',
    ]);
  });

  it('output length equals sum of grouping values', () => {
    expect(generateAccents([2, 2, 3])).toHaveLength(7);
    expect(generateAccents([3, 3, 3])).toHaveLength(9);
    expect(generateAccents([4])).toHaveLength(4);
  });

  it('first entry is always strong', () => {
    const groupings = [[1], [2], [3, 3], [2, 2, 3], [3, 2, 2]];
    for (const g of groupings) {
      expect(generateAccents(g)[0]).toBe('strong');
    }
  });
});

describe('TIME_SIGNATURES catalogue', () => {
  it('4/4 accents are [strong, weak, medium, weak]', () => {
    const ts = getTimeSignature('4_4');
    expect(ts.accents).toEqual(['strong', 'weak', 'medium', 'weak']);
  });

  it('6/8 has 6 beats and dotted-quarter BPM label', () => {
    const ts = getTimeSignature('6_8');
    expect(ts.numerator).toBe(6);
    expect(ts.bpmLabel).toBe('♩.');
    expect(ts.accents[0]).toBe('strong');
    expect(ts.accents[3]).toBe('medium');
  });

  it('6/8 click interval = 60/bpm/3 (eighth note spacing)', () => {
    const ts = getTimeSignature('6_8');
    expect(ts.clickInterval(60)).toBeCloseTo(1 / 3);
    expect(ts.clickInterval(120)).toBeCloseTo(1 / 6);
  });

  it('4/4 click interval = 60/bpm (quarter note spacing)', () => {
    const ts = getTimeSignature('4_4');
    expect(ts.clickInterval(60)).toBeCloseTo(1);
    expect(ts.clickInterval(120)).toBeCloseTo(0.5);
  });

  it('7/8 click interval = 30/bpm (eighth note at quarter BPM)', () => {
    const ts = getTimeSignature('7_8');
    expect(ts.clickInterval(120)).toBeCloseTo(0.25);
  });

  it('7/8 has groupings defined', () => {
    const ts = getTimeSignature('7_8');
    expect(ts.groupings).toBeDefined();
    expect(ts.groupings!.length).toBeGreaterThanOrEqual(2);
  });

  it('all time signatures have accents.length === numerator', () => {
    for (const ts of TIME_SIGNATURES) {
      expect(ts.accents).toHaveLength(ts.numerator);
    }
  });

  it('getTimeSignature falls back to 4/4 for unknown id', () => {
    expect(getTimeSignature('unknown').id).toBe('4_4');
  });
});
