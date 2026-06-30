import { describe, expect, it } from 'vitest';
import { validateBpm, BPM_MIN, BPM_MAX } from '@/domain/music/bpm';

describe('validateBpm', () => {
  it('returns null for null', () => expect(validateBpm(null)).toBeNull());
  it('returns null for undefined', () => expect(validateBpm(undefined)).toBeNull());
  it('returns null for empty string', () => expect(validateBpm('')).toBeNull());
  it('returns null for non-numeric string', () => expect(validateBpm('abc')).toBeNull());
  it('returns null for NaN', () => expect(validateBpm(NaN)).toBeNull());
  it('returns null for Infinity', () => expect(validateBpm(Infinity)).toBeNull());
  it('returns null for below min', () => expect(validateBpm(BPM_MIN - 1)).toBeNull());
  it('returns null for above max', () => expect(validateBpm(BPM_MAX + 1)).toBeNull());
  it('returns the number for a valid integer', () => expect(validateBpm(120)).toBe(120));
  it('rounds decimal values', () => expect(validateBpm(120.6)).toBe(121));
  it('rounds decimal values down', () => expect(validateBpm(120.4)).toBe(120));
  it('accepts numeric strings', () => expect(validateBpm('120')).toBe(120));
  it('accepts min boundary', () => expect(validateBpm(BPM_MIN)).toBe(BPM_MIN));
  it('accepts max boundary', () => expect(validateBpm(BPM_MAX)).toBe(BPM_MAX));
  it('returns null for 0', () => expect(validateBpm(0)).toBeNull());
  it('returns null for negative numbers', () => expect(validateBpm(-60)).toBeNull());
  it('returns null for boolean true', () => expect(validateBpm(true)).toBeNull());
  it('returns null for objects', () => expect(validateBpm({})).toBeNull());
  it('trims numeric string with spaces', () => expect(validateBpm(' 120 ')).toBe(120));
});
