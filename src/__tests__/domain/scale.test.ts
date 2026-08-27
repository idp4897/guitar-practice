import { describe, expect, it } from 'vitest';
import {
  SCALE_CATALOGUE,
  SCALE_TYPES,
  getRelatedModes,
  getScaleEntry,
  getScalePositions,
  mapScaleToFretboard,
  preferredRoot,
  searchScales,
} from '@/domain/music/scale';
import { getTuning } from '@/domain/music/tuning';

const standard = getTuning('standard');
const dropD    = getTuning('drop_d');
const entry    = (root: string, type: string) => {
  const e = getScaleEntry(root, type);
  if (!e) throw new Error(`no scale entry for ${root} ${type}`);
  return e;
};

describe('preferredRoot', () => {
  it('avoids awkward spellings per scale type', () => {
    expect(preferredRoot(1, 'major')).toBe('Db');            // not C# (E#, B#)
    expect(preferredRoot(1, 'minor pentatonic')).toBe('C#');  // not Db (Fb, Cb)
    expect(preferredRoot(3, 'major')).toBe('Eb');             // not D# (double sharps)
  });

  it('prefers sharps when both spellings are equally clean', () => {
    expect(preferredRoot(6, 'major')).toBe('F#');
  });

  it('never produces a double accidental in the diatonic families', () => {
    // whole tone and chromatic are symmetric: 6 or 12 notes over 7 letter names,
    // so E whole tone needs a C## no matter how it is spelled.
    for (const type of SCALE_TYPES.filter((t) => t.category !== 'other')) {
      for (let chroma = 0; chroma < 12; chroma++) {
        const e = entry(preferredRoot(chroma, type.id), type.id);
        const bad = e.notes.filter((n) => n.includes('##') || n.includes('bb'));
        expect(bad, `${e.name}`).toEqual([]);
      }
    }
  });
});

describe('getScaleEntry', () => {
  it('derives notes and degree labels', () => {
    const e = entry('A', 'minor pentatonic');
    expect(e.notes).toEqual(['A', 'C', 'D', 'E', 'G']);
    expect(e.degrees).toEqual(['1', 'b3', '4', '5', 'b7']);
  });

  it('labels altered degrees', () => {
    expect(entry('E', 'minor blues').degrees).toEqual(['1', 'b3', '4', 'b5', '5', 'b7']);
    expect(entry('C', 'lydian').degrees).toEqual(['1', '2', '3', '#4', '5', '6', '7']);
  });

  it('rejects scales outside the curated catalogue', () => {
    expect(getScaleEntry('C', 'bebop')).toBeNull();
  });
});

describe('SCALE_CATALOGUE', () => {
  it('covers every curated type in all 12 keys', () => {
    expect(SCALE_CATALOGUE).toHaveLength(SCALE_TYPES.length * 12);
  });
});

describe('mapScaleToFretboard', () => {
  it('places only scale tones, spelled the way the scale spells them', () => {
    const e = entry('Db', 'major');
    const notes = mapScaleToFretboard(e, standard, [0, 12]);
    expect(notes.every((n) => e.notes.includes(n.note))).toBe(true);
    expect(notes.some((n) => n.note === 'Gb')).toBe(true);
    expect(notes.some((n) => n.note === 'F#')).toBe(false);
  });

  it('finds the open low E as the root of E minor pentatonic', () => {
    const notes = mapScaleToFretboard(entry('E', 'minor pentatonic'), standard, [0, 12]);
    const open  = notes.find((n) => n.string === 0 && n.fret === 0);
    expect(open).toMatchObject({ note: 'E', degree: '1', isRoot: true });
  });

  it('follows the retuned string in Drop D', () => {
    const openLowest = (t: typeof standard) =>
      mapScaleToFretboard(entry('D', 'major'), t, [0, 5])
        .find((n) => n.string === 0 && n.fret === 0);
    // Both tunings sound a D major tone open, but a different degree of it.
    expect(openLowest(dropD)).toMatchObject({ note: 'D', degree: '1', isRoot: true });
    expect(openLowest(standard)).toMatchObject({ note: 'E', degree: '2', isRoot: false });
  });
});

describe('getScalePositions', () => {
  it('yields one box per scale degree', () => {
    expect(getScalePositions(entry('A', 'minor pentatonic'), standard)).toHaveLength(5);
    expect(getScalePositions(entry('C', 'major'), standard)).toHaveLength(7);
    expect(getScalePositions(entry('E', 'minor blues'), standard)).toHaveLength(6);
  });

  it('starts position 1 on the root', () => {
    const [first] = getScalePositions(entry('A', 'minor pentatonic'), standard);
    expect(first.startFret).toBe(5);
    const lowest = first.notes.filter((n) => n.string === 0);
    expect(lowest[0]).toMatchObject({ fret: 5, degree: '1' });
  });

  it('reproduces the canonical A minor pentatonic box 1', () => {
    const [first] = getScalePositions(entry('A', 'minor pentatonic'), standard);
    const byString = [0, 1, 2, 3, 4, 5].map((s) =>
      first.notes.filter((n) => n.string === s).map((n) => n.fret),
    );
    expect(byString).toEqual([[5, 8], [5, 7], [5, 7], [5, 7], [5, 8], [5, 8]]);
  });

  it('keeps every box inside its fret span', () => {
    for (const e of [entry('C', 'major'), entry('A', 'minor pentatonic'), entry('B', 'dorian')]) {
      for (const pos of getScalePositions(e, standard)) {
        expect(pos.endFret - pos.startFret).toBeLessThanOrEqual(4);
        expect(pos.notes.every((n) => n.fret >= pos.startFret && n.fret <= pos.endFret)).toBe(true);
      }
    }
  });

  it('shifts the boxes for Drop D rather than reusing standard shapes', () => {
    const std  = getScalePositions(entry('A', 'minor pentatonic'), standard)[0];
    const drop = getScalePositions(entry('A', 'minor pentatonic'), dropD)[0];
    expect(drop.startFret).toBe(7);
    expect(drop.startFret).not.toBe(std.startFret);
  });

  it('covers the whole scale in every box', () => {
    const e = entry('C', 'major');
    for (const pos of getScalePositions(e, standard)) {
      expect(new Set(pos.notes.map((n) => n.degree)).size).toBe(e.degrees.length);
    }
  });
});

describe('getRelatedModes', () => {
  it('returns the modal family sharing the same notes', () => {
    const modes = getRelatedModes(entry('C', 'major'));
    expect(modes).toHaveLength(7);
    expect(modes[0]).toMatchObject({ degree: 1, root: 'C', scaleType: 'major' });
    expect(modes.map((m) => m.root)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(modes.find((m) => m.scaleType === 'mixolydian')?.root).toBe('G');
  });

  it('drops modes outside the curated catalogue', () => {
    const modes = getRelatedModes(entry('A', 'minor pentatonic'));
    expect(modes.every((m) => SCALE_TYPES.some((t) => t.id === m.scaleType))).toBe(true);
  });
});

describe('searchScales', () => {
  const names = (q: string) => searchScales({ query: q, category: null }).map((e) => e.name);

  it('matches a root with a scale name', () => {
    expect(names('A minor pentatonic')[0]).toBe('A Minor Pentatonic');
    expect(names('c major')[0]).toBe('C Major (Ionian)');
  });

  it('matches the root enharmonically', () => {
    const results = searchScales({ query: 'Db minor pentatonic', category: null });
    expect(results[0].root).toBe('C#');
  });

  it('lists every key when only a scale name is typed', () => {
    const dorian = searchScales({ query: 'dorian', category: null });
    expect(dorian).toHaveLength(12);
    expect(new Set(dorian.map((e) => e.rootChroma)).size).toBe(12);
  });

  it('lists every scale for a bare root', () => {
    const g = searchScales({ query: 'G', category: null });
    expect(g).toHaveLength(SCALE_TYPES.length);
    expect(g.every((e) => e.rootChroma === 7)).toBe(true);
  });

  it('filters by category', () => {
    const pent = searchScales({ query: '', category: 'pentatonic' });
    expect(pent.every((e) => e.category === 'pentatonic')).toBe(true);
    expect(pent).toHaveLength(4 * 12);
  });

  it('does not let a leading note letter swallow the scale name', () => {
    // "dorian" starts with D, "lydian" with... nothing, but "major" starts with no
    // note letter while "dorian" does — the D must not be eaten as a root.
    expect(searchScales({ query: 'dorian', category: null })).toHaveLength(12);
    expect(names('D dorian')).toEqual(['D Dorian']);
  });

  it('returns nothing for an unknown scale', () => {
    expect(names('C wobbly')).toEqual([]);
  });
});
