import { Note } from 'tonal';

export interface RootSplit {
  rootChroma: number | null;
  rest:       string;
  /** True for the "the leading letter was not a root after all" reading. */
  fallback?:  boolean;
}

/**
 * Splits a leading note name off a search query.
 * "F#m7" → { 6, "m7" }, "Am pentatonic" → { 9, "m pentatonic" }, "sus4" → { null, "sus4" }.
 * Unicode accidentals are folded to ASCII so "E♭" and "Eb" behave alike.
 */
export function splitRoot(query: string): RootSplit {
  const trimmed = query.trim();
  if (!trimmed) return { rootChroma: null, rest: '' };

  const m = trimmed.match(/^([A-Ga-g])([b#♭♯]?)(.*)$/);
  if (!m) return { rootChroma: null, rest: trimmed };

  const [, letter, accidental, rest] = m;
  const root   = letter.toUpperCase() + accidental.replace('♭', 'b').replace('♯', '#');
  const chroma = Note.chroma(root);
  if (chroma == null) return { rootChroma: null, rest: trimmed };

  return { rootChroma: chroma, rest: rest.trim() };
}

/**
 * Both readings of a query, because scale and chord names start with note
 * letters: "dorian" is D + "orian" but also a bare scale name, and "dim" is
 * D + "im" but also a bare chord suffix. Callers score every candidate and keep
 * the best match, so neither reading is lost.
 */
export function rootCandidates(query: string): RootSplit[] {
  const split = splitRoot(query);
  if (split.rootChroma == null) return [split];
  return [split, { rootChroma: null, rest: query.trim(), fallback: true }];
}

/**
 * The fallback reading has to clear a higher bar, or a bare root leaks: "G"
 * would drag in every phrygian scale and "A" every add9 chord. Only an exact
 * name, or a prefix of one once enough has been typed, counts.
 */
export function acceptsFallback(score: number, rest: string): boolean {
  return score === 0 || (score === 1 && rest.length >= 3);
}
