import { describe, expect, it } from 'vitest';
import {
  applyCapo, detectKey, transpose, transposeChord,
  parseSongKey, formatSongKey, getRelativeKey,
  getDiatonicChords, isChordInKey, findUsedDiatonicChords,
} from '@/domain/music/theory';

describe('transposeChord', () => {
  it('transposes up by whole step', () => {
    expect(transposeChord('C', 2)).toBe('D');
    expect(transposeChord('G', 2)).toBe('A');
    expect(transposeChord('Am', 2)).toBe('Bm');
  });

  it('transposes down when semitones is negative', () => {
    expect(transposeChord('D', -2)).toBe('C');
    expect(transposeChord('Bm', -2)).toBe('Am');
  });

  it('handles sharps and accidentals', () => {
    expect(transposeChord('F#7', 1)).toBe('G7');
    expect(transposeChord('Bb', 2)).toBe('C');
  });

  it('handles minor, dominant 7, major 7 suffixes', () => {
    expect(transposeChord('Cmaj7', 2)).toBe('Dmaj7');
    expect(transposeChord('G7', 5)).toBe('C7');
    expect(transposeChord('Dm', 5)).toBe('Gm');
  });

  it('returns original chord when semitones is 0', () => {
    expect(transposeChord('C', 0)).toBe('C');
    expect(transposeChord('F#m7', 0)).toBe('F#m7');
  });

  it('wraps around the octave', () => {
    expect(transposeChord('A', 3)).toBe('C');
    expect(transposeChord('G', 5)).toBe('C');
  });
});

describe('transpose', () => {
  it('transposes an array of chords', () => {
    expect(transpose(['G', 'C', 'D'], 5)).toEqual(['C', 'F', 'G']);
  });

  it('returns same chords when semitones is 0', () => {
    const chords = ['Am', 'F', 'C', 'G'];
    expect(transpose(chords, 0)).toEqual(chords);
  });

  it('handles empty array', () => {
    expect(transpose([], 3)).toEqual([]);
  });
});

describe('applyCapo', () => {
  it('gives fingering chords for capo position', () => {
    // Playing these shapes with capo 2 produces G-Em-C-D sound
    expect(applyCapo(['G', 'Em', 'C', 'D'], 2)).toEqual(['F', 'Dm', 'Bb', 'C']);
  });

  it('returns original chords when capo is 0', () => {
    const chords = ['G', 'Em', 'C', 'D'];
    expect(applyCapo(chords, 0)).toEqual(chords);
  });

  it('handles capo 5', () => {
    // Playing these shapes with capo 5 sounds 5 semitones higher
    expect(applyCapo(['C', 'Am', 'F', 'G'], 5)).toEqual(['G', 'Em', 'C', 'D']);
  });
});

// ─── parseSongKey ─────────────────────────────────────────────────────────────

describe('parseSongKey', () => {
  it('parses major key string', () => {
    expect(parseSongKey('G')).toEqual({ key: 'G', mode: 'major' });
  });
  it('parses minor key string (Am)', () => {
    expect(parseSongKey('Am')).toEqual({ key: 'A', mode: 'minor' });
  });
  it('parses sharp minor (F#m)', () => {
    expect(parseSongKey('F#m')).toEqual({ key: 'F#', mode: 'minor' });
  });
  it('parses flat key (Bb)', () => {
    expect(parseSongKey('Bb')).toEqual({ key: 'Bb', mode: 'major' });
  });
  it('parses C#m', () => {
    expect(parseSongKey('C#m')).toEqual({ key: 'C#', mode: 'minor' });
  });
  it('single character "m" is treated as major (edge case)', () => {
    // 'm' alone has length 1 so is not treated as minor
    expect(parseSongKey('m').mode).toBe('major');
  });
});

// ─── formatSongKey ────────────────────────────────────────────────────────────

describe('formatSongKey', () => {
  it('short major → root note only', () => {
    expect(formatSongKey({ key: 'E', mode: 'major' })).toBe('E');
  });
  it('short minor → root + m', () => {
    expect(formatSongKey({ key: 'A', mode: 'minor' })).toBe('Am');
  });
  it('full major', () => {
    expect(formatSongKey({ key: 'E', mode: 'major' }, 'full')).toBe('E major');
  });
  it('full minor', () => {
    expect(formatSongKey({ key: 'C#', mode: 'minor' }, 'full')).toBe('C# minor');
  });
});

// ─── getRelativeKey ───────────────────────────────────────────────────────────

describe('getRelativeKey', () => {
  it('E major → C#m (relative minor)', () => {
    const rel = getRelativeKey({ key: 'E', mode: 'major' });
    expect(rel.mode).toBe('minor');
    expect(rel.key).toBe('C#');
  });
  it('G major → Em', () => {
    const rel = getRelativeKey({ key: 'G', mode: 'major' });
    expect(rel.key).toBe('E');
    expect(rel.mode).toBe('minor');
  });
  it('A minor → C major', () => {
    const rel = getRelativeKey({ key: 'A', mode: 'minor' });
    expect(rel.key).toBe('C');
    expect(rel.mode).toBe('major');
  });
  it('E minor → G major', () => {
    const rel = getRelativeKey({ key: 'E', mode: 'minor' });
    expect(rel.key).toBe('G');
    expect(rel.mode).toBe('major');
  });
  it('relative of relative returns original key', () => {
    const orig = { key: 'D', mode: 'major' as const };
    const rel  = getRelativeKey(orig);
    const back = getRelativeKey(rel);
    expect(back.key).toBe(orig.key);
    expect(back.mode).toBe(orig.mode);
  });
});

// ─── getDiatonicChords ────────────────────────────────────────────────────────

describe('getDiatonicChords — E major', () => {
  const diChords = getDiatonicChords({ key: 'E', mode: 'major' });

  it('returns 7 chords', () => expect(diChords).toHaveLength(7));

  it('first chord is E (I — Tonic)', () => {
    const I = diChords[0];
    expect(I.chord).toBe('E');
    expect(I.romanNumeral).toBe('I');
    expect(I.fn).toBe('Tonic');
    expect(I.quality).toBe('major');
    expect(I.isPrimary).toBe(true);
  });

  it('second chord is F#m (ii — Supertonic, minor)', () => {
    const ii = diChords[1];
    expect(ii.chord).toBe('F#m');
    expect(ii.romanNumeral).toBe('ii');
    expect(ii.fn).toBe('Supertonic');
    expect(ii.quality).toBe('minor');
    expect(ii.isPrimary).toBe(false);
  });

  it('fourth chord is A (IV — Subdominant, primary)', () => {
    const IV = diChords[3];
    expect(IV.chord).toBe('A');
    expect(IV.romanNumeral).toBe('IV');
    expect(IV.fn).toBe('Subdominant');
    expect(IV.isPrimary).toBe(true);
  });

  it('fifth chord is B (V — Dominant, primary)', () => {
    const V = diChords[4];
    expect(V.chord).toBe('B');
    expect(V.romanNumeral).toBe('V');
    expect(V.fn).toBe('Dominant');
    expect(V.isPrimary).toBe(true);
  });

  it('seventh chord is D#dim (vii° — Leading tone)', () => {
    const viio = diChords[6];
    expect(viio.chord).toBe('D#dim');
    expect(viio.romanNumeral).toBe('vii°');
    expect(viio.fn).toBe('Leading tone');
    expect(viio.quality).toBe('dim');
    expect(viio.isPrimary).toBe(false);
  });

  it('degrees are 1–7', () => {
    diChords.forEach((d, i) => expect(d.degree).toBe(i + 1));
  });

  it('no harmonicMinorVariant for major keys', () => {
    diChords.forEach(d => expect(d.harmonicMinorVariant).toBeUndefined());
  });
});

describe('getDiatonicChords — A minor (natural)', () => {
  const diChords = getDiatonicChords({ key: 'A', mode: 'minor' });

  it('first chord is Am (i — Tonic, minor)', () => {
    const i = diChords[0];
    expect(i.chord).toBe('Am');
    expect(i.romanNumeral).toBe('i');
    expect(i.fn).toBe('Tonic');
    expect(i.quality).toBe('minor');
    expect(i.isPrimary).toBe(true);
  });

  it('fifth chord is Em (v — Dominant, natural minor)', () => {
    const v = diChords[4];
    expect(v.chord).toBe('Em');
    expect(v.romanNumeral).toBe('v');
    expect(v.quality).toBe('minor');
    expect(v.isPrimary).toBe(true);
  });

  it('fifth chord has harmonicMinorVariant = "E" (V major)', () => {
    expect(diChords[4].harmonicMinorVariant).toBe('E');
  });

  it('seventh chord is G (VII — Subtonic, major)', () => {
    const VII = diChords[6];
    expect(VII.chord).toBe('G');
    expect(VII.romanNumeral).toBe('VII');
    expect(VII.fn).toBe('Subtonic');
    expect(VII.quality).toBe('major');
  });
});

// ─── isChordInKey ─────────────────────────────────────────────────────────────

describe('isChordInKey', () => {
  const eMajor = { key: 'E', mode: 'major' as const };
  const aMinor = { key: 'A', mode: 'minor' as const };

  it('E is in E major (I)', ()  => expect(isChordInKey('E',    eMajor)).toBe(true));
  it('F#m is in E major (ii)', () => expect(isChordInKey('F#m', eMajor)).toBe(true));
  it('B is in E major (V)',    () => expect(isChordInKey('B',   eMajor)).toBe(true));
  it('C#m is in E major (vi)', () => expect(isChordInKey('C#m', eMajor)).toBe(true));
  it('G is NOT in E major',    () => expect(isChordInKey('G',   eMajor)).toBe(false));
  it('D is NOT in E major',    () => expect(isChordInKey('D',   eMajor)).toBe(false));

  it('Em7 matches Em (minor quality) — extension ignored', () =>
    expect(isChordInKey('Em7', aMinor)).toBe(true));
  it('slash chord G/B uses root G', () =>
    expect(isChordInKey('G/B', aMinor)).toBe(true));
  it('C#m is NOT in A minor', () =>
    expect(isChordInKey('C#m', aMinor)).toBe(false));
});

// ─── findUsedDiatonicChords ───────────────────────────────────────────────────

describe('findUsedDiatonicChords', () => {
  const eMajorDiatonic = getDiatonicChords({ key: 'E', mode: 'major' }).map(d => d.chord);
  // E, F#m, G#m, A, B, C#m, D#dim

  it('finds E major chords used in a Kibouteki Refrain hook', () => {
    const songChords = ['E', 'A', 'B', 'C#m'];
    const used = findUsedDiatonicChords(songChords, eMajorDiatonic);
    expect(used.has('E')).toBe(true);
    expect(used.has('A')).toBe(true);
    expect(used.has('B')).toBe(true);
    expect(used.has('C#m')).toBe(true);
    expect(used.has('F#m')).toBe(false);
    expect(used.has('D#dim')).toBe(false);
  });

  it('G (verse chord) is not found as E major diatonic', () => {
    const used = findUsedDiatonicChords(['G', 'Em', 'D'], eMajorDiatonic);
    expect(used.size).toBe(0);
  });

  it('matches extended chords — F#m7 counts as F#m', () => {
    const used = findUsedDiatonicChords(['F#m7', 'Amaj7'], eMajorDiatonic);
    expect(used.has('F#m')).toBe(true);
    expect(used.has('A')).toBe(true);
  });
});

// ─── detectKey ───────────────────────────────────────────────────────────────

describe('detectKey', () => {
  it('returns empty array for empty input', () => {
    expect(detectKey([])).toEqual([]);
  });

  it('returns sorted candidates by confidence', () => {
    const result = detectKey(['G', 'Em', 'C', 'D']);
    expect(result.length).toBeGreaterThan(0);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].confidence).toBeLessThanOrEqual(result[i - 1].confidence);
    }
  });

  it('detects G major from I-vi-IV-V', () => {
    const result = detectKey(['G', 'Em', 'C', 'D']);
    // G major starts on tonic → highest confidence; key is now short form "G" not "G major"
    expect(result[0].key).toBe('G');
    expect(result[0].confidence).toBeGreaterThan(0.7);
  });

  it('detects C major or A minor from Am-F-C-G', () => {
    const result = detectKey(['Am', 'F', 'C', 'G']);
    const topThreeKeys = result.slice(0, 3).map((c) => c.key);
    // Keys are now short form: "C" and "Am" instead of "C major" / "A minor"
    const hasCMajorOrAMinor = topThreeKeys.some((k) => k === 'C' || k === 'Am');
    expect(hasCMajorOrAMinor).toBe(true);
  });

  it('assigns confidence between 0 and 1', () => {
    const result = detectKey(['C', 'G', 'Am', 'F']);
    result.forEach(({ confidence }) => {
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });
});
