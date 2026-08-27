import { Interval, Note, Scale } from 'tonal';
import { chromaAtFret } from './tuning';
import type { Tuning } from './tuning';
import { acceptsFallback, rootCandidates } from './note-query';

// ─── Public types ─────────────────────────────────────────────────────────────

export type ScaleCategory = 'pentatonic' | 'mode' | 'minor' | 'other';

export interface ScaleType {
  id:       string;          // tonal scale name — 'minor pentatonic'
  label:    string;          // display name — 'Minor Pentatonic'
  category: ScaleCategory;
}

export interface ScaleEntry {
  name:       string;        // "A Minor Pentatonic"
  root:       string;        // preferred spelling — "Db", not "C#", for Db major
  rootChroma: number;
  scaleType:  string;
  label:      string;
  category:   ScaleCategory;
  notes:      string[];      // ["A", "C", "D", "E", "G"]
  degrees:    string[];      // ["1", "b3", "4", "5", "b7"]
}

export interface FretNote {
  string: number;            // 0 = lowest-pitched string (string 6)
  fret:   number;
  note:   string;
  degree: string;
  isRoot: boolean;
}

export interface ScalePosition {
  index:     number;         // 1-based; position 1 is the box rooted on the lowest string
  startFret: number;
  endFret:   number;
  notes:     FretNote[];
}

export interface ScaleSearchParams {
  query:    string;
  category: ScaleCategory | null;
}

// ─── Curated catalogue ────────────────────────────────────────────────────────
// tonal ships 92 scales; most are academic. These are the ones a guitarist
// actually drills. Extending this list is the only step needed to add more.

export const SCALE_TYPES: ScaleType[] = [
  { id: 'major pentatonic', label: 'Major Pentatonic', category: 'pentatonic' },
  { id: 'minor pentatonic', label: 'Minor Pentatonic', category: 'pentatonic' },
  { id: 'major blues',      label: 'Major Blues',      category: 'pentatonic' },
  { id: 'minor blues',      label: 'Minor Blues',      category: 'pentatonic' },

  { id: 'major',            label: 'Major (Ionian)',   category: 'mode' },
  { id: 'dorian',           label: 'Dorian',           category: 'mode' },
  { id: 'phrygian',         label: 'Phrygian',         category: 'mode' },
  { id: 'lydian',           label: 'Lydian',           category: 'mode' },
  { id: 'mixolydian',       label: 'Mixolydian',       category: 'mode' },
  { id: 'minor',            label: 'Minor (Aeolian)',  category: 'mode' },
  { id: 'locrian',          label: 'Locrian',          category: 'mode' },

  { id: 'harmonic minor',   label: 'Harmonic Minor',   category: 'minor' },
  { id: 'melodic minor',    label: 'Melodic Minor',    category: 'minor' },

  { id: 'whole tone',       label: 'Whole Tone',       category: 'other' },
  { id: 'chromatic',        label: 'Chromatic',        category: 'other' },
];

export const SCALE_CATEGORIES: ScaleCategory[] = ['pentatonic', 'mode', 'minor', 'other'];

// ─── Root spelling ────────────────────────────────────────────────────────────

const SHARP_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_ROOTS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const AWKWARD = /^(E#|B#|Cb|Fb)$/;

/** Penalises double accidentals hard and E#/B#/Cb/Fb mildly. */
function spellingPenalty(notes: string[]): number {
  return notes.reduce((sum, n) => {
    if (n.includes('##') || n.includes('bb')) return sum + 10;
    if (AWKWARD.test(n))                      return sum + 3;
    return sum;
  }, 0);
}

/**
 * Picks the root spelling that keeps the scale readable: Db major (Db Eb F Gb
 * Ab Bb C) over C# major (C# D# E# F# G# A# B#), but C# minor pentatonic over
 * Db minor pentatonic. Sharps win ties, matching guitar convention (F#, not Gb).
 */
export function preferredRoot(chroma: number, scaleType: string): string {
  const candidates = [...new Set([SHARP_ROOTS[chroma], FLAT_ROOTS[chroma]])];
  let best = candidates[0];
  let bestPenalty = Infinity;

  for (const candidate of candidates) {
    const scale = Scale.get(`${candidate} ${scaleType}`);
    if (scale.empty) continue;
    const penalty = spellingPenalty(scale.notes);
    if (penalty < bestPenalty) { bestPenalty = penalty; best = candidate; }
  }

  return best;
}

// ─── Entry construction ───────────────────────────────────────────────────────

/** "1P" → "1", "3m" → "b3", "5d" → "b5", "4A" → "#4". */
function degreeLabel(interval: string): string {
  const iv = Interval.get(interval);
  if (iv.empty || iv.num == null) return interval;
  const alt = iv.alt ?? 0;
  const marks = alt < 0 ? 'b'.repeat(-alt) : '#'.repeat(alt);
  return marks + iv.num;
}

export function getScaleEntry(root: string, scaleType: string): ScaleEntry | null {
  const type = SCALE_TYPES.find((t) => t.id === scaleType);
  if (!type) return null;

  const scale = Scale.get(`${root} ${scaleType}`);
  if (scale.empty || scale.notes.length === 0) return null;

  const chroma = Note.chroma(root);
  if (chroma == null) return null;

  return {
    name:       `${root} ${type.label}`,
    root,
    rootChroma: chroma,
    scaleType,
    label:      type.label,
    category:   type.category,
    notes:      scale.notes,
    degrees:    scale.intervals.map(degreeLabel),
  };
}

function buildCatalogue(): ScaleEntry[] {
  const entries: ScaleEntry[] = [];
  for (const type of SCALE_TYPES) {
    for (let chroma = 0; chroma < 12; chroma++) {
      const entry = getScaleEntry(preferredRoot(chroma, type.id), type.id);
      if (entry) entries.push(entry);
    }
  }
  return entries;
}

/** Every curated scale in all 12 keys. */
export const SCALE_CATALOGUE: ScaleEntry[] = buildCatalogue();

// ─── Fretboard mapping ────────────────────────────────────────────────────────

/** chroma → the note/degree as this scale spells it, so Db major shows Gb not F#. */
function chromaLookup(entry: ScaleEntry): Map<number, { note: string; degree: string }> {
  const map = new Map<number, { note: string; degree: string }>();
  entry.notes.forEach((note, i) => {
    const chroma = Note.chroma(note);
    if (chroma != null) map.set(chroma, { note, degree: entry.degrees[i] ?? '' });
  });
  return map;
}

export const DEFAULT_FRET_RANGE: [number, number] = [0, 15];

/**
 * Every occurrence of the scale on the neck, in any tuning. String 0 is the
 * lowest-pitched string, matching `Tuning.strings`.
 */
export function mapScaleToFretboard(
  entry:  ScaleEntry,
  tuning: Tuning,
  range:  [number, number] = DEFAULT_FRET_RANGE,
): FretNote[] {
  const lookup = chromaLookup(entry);
  const [low, high] = range;
  const notes: FretNote[] = [];

  tuning.strings.forEach((open, string) => {
    for (let fret = low; fret <= high; fret++) {
      const hit = lookup.get(chromaAtFret(open, fret));
      if (!hit) continue;
      notes.push({
        string,
        fret,
        note:   hit.note,
        degree: hit.degree,
        isRoot: hit.degree === '1',
      });
    }
  });

  return notes;
}

// ─── Positions ────────────────────────────────────────────────────────────────

/** Pentatonics sit in a 4-fret box; 6- and 7-note scales need a 5-fret one. */
function positionSpan(entry: ScaleEntry): number {
  return entry.notes.length <= 5 ? 3 : 4;
}

/**
 * Playable boxes, derived rather than tabulated. Each position is anchored on a
 * scale tone of the lowest string — one octave of anchors yields exactly as many
 * boxes as the scale has notes (5 for pentatonic, 7 for the modes), and the list
 * is rotated so position 1 is the box rooted on the lowest string.
 *
 * Deriving them keeps every tuning honest: Drop D shifts the anchors on its
 * retuned low string instead of reusing a standard-tuning shape table.
 */
export function getScalePositions(entry: ScaleEntry, tuning: Tuning): ScalePosition[] {
  const lookup = chromaLookup(entry);
  const span   = positionSpan(entry);
  const low    = tuning.strings[0];

  const anchors: number[] = [];
  for (let fret = 0; fret < 12; fret++) {
    if (lookup.has(chromaAtFret(low, fret))) anchors.push(fret);
  }
  if (anchors.length === 0) return [];

  const rootAt = anchors.findIndex((fret) => {
    const hit = lookup.get(chromaAtFret(low, fret));
    return hit?.degree === '1';
  });
  const ordered = rootAt <= 0
    ? anchors
    : [...anchors.slice(rootAt), ...anchors.slice(0, rootAt)];

  return ordered.map((start, i) => ({
    index:     i + 1,
    startFret: start,
    endFret:   start + span,
    notes:     mapScaleToFretboard(entry, tuning, [start, start + span]),
  }));
}

// ─── Related modes ────────────────────────────────────────────────────────────

export interface RelatedMode {
  degree:    number;         // which degree of the parent scale this mode starts on
  root:      string;
  scaleType: string;
  label:     string;
}

/**
 * The modal family sharing this scale's notes — E phrygian and G mixolydian are
 * the same seven notes as C major, which is the point of drilling them together.
 * Modes outside the curated catalogue are dropped.
 */
export function getRelatedModes(entry: ScaleEntry): RelatedMode[] {
  const modes = Scale.modeNames(`${entry.root} ${entry.scaleType}`);

  return modes.flatMap(([root, name], i) => {
    const type = SCALE_TYPES.find((t) => t.id === name);
    if (!type || !root) return [];
    return [{ degree: i + 1, root, scaleType: type.id, label: type.label }];
  });
}

// ─── Search ───────────────────────────────────────────────────────────────────

function scaleMatchScore(entry: ScaleEntry, rest: string): number | null {
  if (!rest) return 0;
  const needle = rest.toLowerCase();
  const label  = entry.label.toLowerCase();
  const id     = entry.scaleType.toLowerCase();

  if (id === needle || label === needle)             return 0;
  if (id.startsWith(needle) || label.startsWith(needle)) return 1;
  if (id.includes(needle) || label.includes(needle)) return 2;
  return null;
}

/**
 * Ranked scale lookup. Roots match enharmonically, so "Db" finds the C# scales
 * whose preferred spelling differs from what was typed.
 */
export function searchScales(
  params:    ScaleSearchParams,
  catalogue: ScaleEntry[] = SCALE_CATALOGUE,
): ScaleEntry[] {
  const candidates = rootCandidates(params.query);
  const { category } = params;

  const scored: Array<{ entry: ScaleEntry; score: number; order: number }> = [];

  catalogue.forEach((entry, order) => {
    if (category && entry.category !== category) return;

    let best: number | null = null;
    for (const candidate of candidates) {
      const { rootChroma, rest } = candidate;
      if (rootChroma != null && entry.rootChroma !== rootChroma) continue;
      const score = scaleMatchScore(entry, rest);
      if (score == null) continue;
      if (candidate.fallback && !acceptsFallback(score, rest)) continue;
      if (best == null || score < best) best = score;
    }

    if (best == null) return;
    scored.push({ entry, score: best, order });
  });

  return scored
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .map((s) => s.entry);
}
