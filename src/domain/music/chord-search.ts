import { Note } from 'tonal';
import { acceptsFallback, rootCandidates, splitRoot } from './note-query';
import guitarDb from '@tombatossals/chords-db/lib/guitar.json';

// ─── Public types ─────────────────────────────────────────────────────────────

export type ChordCategory =
  | 'major'
  | 'minor'
  | 'dominant'
  | 'suspended'
  | 'altered'
  | 'slash';

export interface ChordEntry {
  name:       string;         // display name — "C", "Am", "F#m7", "C/E"
  root:       string;         // "C", "F#", "Bb"
  suffix:     string;         // chords-db suffix — "major", "m7", "/E"
  category:   ChordCategory;
  rootChroma: number;         // 0–11, for enharmonic matching
}

export interface ChordSearchParams {
  query:    string;
  category: ChordCategory | null;   // null = all categories
}

export const CHORD_CATEGORIES: ChordCategory[] = [
  'major', 'minor', 'dominant', 'suspended', 'altered', 'slash',
];

// ─── Catalogue construction ───────────────────────────────────────────────────

interface DbEntry {
  key:    string;
  suffix: string;
}

/** chords-db calls these "major"/"minor"; guitarists write "" and "m". */
function displaySuffix(suffix: string): string {
  if (suffix === 'major') return '';
  if (suffix === 'minor') return 'm';
  return suffix;
}

/** db.keys spells these "C#"/"F#" but db.chords is keyed "Csharp"/"Fsharp". */
const DB_KEY_ALIASES: Record<string, string> = { 'C#': 'Csharp', 'F#': 'Fsharp' };

const SUSPENDED = new Set(['sus2', 'sus4', '7sus4']);
const ALTERED   = new Set(['dim', 'dim7', 'aug', 'alt', '7sg', 'aug7', 'aug9', '7b5', '9b5']);

export function categorize(suffix: string): ChordCategory {
  if (suffix.includes('/'))      return 'slash';
  if (SUSPENDED.has(suffix))     return 'suspended';
  if (ALTERED.has(suffix))       return 'altered';
  if (suffix.startsWith('maj'))  return 'major';    // major, maj7, maj9, maj7b5…
  if (suffix.startsWith('m'))    return 'minor';    // m, m6, m7, mmaj7, madd9…
  if (/^\d/.test(suffix))        return 'dominant'; // 7, 9, 11, 13, 7b9, 9#11…
  return 'major';                                   // 6, 69, add9…
}

function buildCatalogue(): ChordEntry[] {
  const chords = guitarDb.chords as Record<string, DbEntry[]>;
  const entries: ChordEntry[] = [];

  for (const key of guitarDb.keys) {
    const chroma = Note.chroma(key);
    if (chroma == null) continue;
    for (const entry of chords[DB_KEY_ALIASES[key] ?? key] ?? []) {
      entries.push({
        name:       key + displaySuffix(entry.suffix),
        root:       key,
        suffix:     entry.suffix,
        category:   categorize(entry.suffix),
        rootChroma: chroma,
      });
    }
  }

  return entries;
}

/** Every chord shape the position database can draw, in standard tuning. */
export const CHORD_CATALOGUE: ChordEntry[] = buildCatalogue();

// ─── Query parsing ────────────────────────────────────────────────────────────

/** Common spellings that are not the database's own suffix names. */
const SUFFIX_ALIASES: Record<string, string> = {
  maj:   '',
  major: '',
  min:   'm',
  minor: 'm',
  M7:    'maj7',
  Δ:     'maj7',
  '°':   'dim',
  o:     'dim',
  '+':   'aug',
  '-':   'm',
};

interface ParsedQuery {
  rootChroma: number | null;
  suffix:     string;
}

/**
 * Splits a raw query into an optional root and a suffix fragment.
 * "F#m7" → { F#, "m7" }, "m7" → { null, "m7" }, "b" alone stays a suffix.
 */
export function parseQuery(query: string): ParsedQuery {
  const { rootChroma, rest } = splitRoot(query);
  return { rootChroma, suffix: normalizeSuffix(rest) };
}

function normalizeSuffix(raw: string): string {
  const trimmed = raw.trim();
  const alias   = SUFFIX_ALIASES[trimmed];
  if (alias !== undefined) return alias.toLowerCase();
  return trimmed.toLowerCase();
}

// ─── Search ───────────────────────────────────────────────────────────────────

function baseScore(display: string, suffixQuery: string, entry: ChordEntry): number | null {
  if (!suffixQuery)                    return display === '' ? 0 : 2;
  if (display === suffixQuery)         return 0;
  if (display.startsWith(suffixQuery)) return 1;
  if (display.includes(suffixQuery))   return 2;
  // "minor"/"major" typed in full still find their shorthand entries
  if (entry.suffix.toLowerCase().startsWith(suffixQuery)) return 1;
  return null;
}

/**
 * Lower score sorts first. Inexact matches from a different chord family are
 * nudged back, so "Am" reaches Am7 before Amaj7 — both merely share an "m".
 */
function matchScore(entry: ChordEntry, suffixQuery: string): number | null {
  const display = displaySuffix(entry.suffix).toLowerCase();
  const score   = baseScore(display, suffixQuery, entry);
  if (score == null || score === 0) return score;
  return categorize(suffixQuery) === entry.category ? score : score + 0.5;
}

/**
 * Ranked chord lookup. Matches the root enharmonically (Db finds C# shapes) and
 * the suffix by prefix, so "f#m" reaches F#m, F#m7, F#m9 in that order.
 */
export function searchChords(
  params: ChordSearchParams,
  catalogue: ChordEntry[] = CHORD_CATALOGUE,
): ChordEntry[] {
  const candidates = rootCandidates(params.query);
  const { category } = params;

  const scored: Array<{ entry: ChordEntry; score: number; order: number }> = [];

  catalogue.forEach((entry, order) => {
    if (category && entry.category !== category) return;

    let best: number | null = null;
    for (const candidate of candidates) {
      const { rootChroma, rest } = candidate;
      if (rootChroma != null && entry.rootChroma !== rootChroma) continue;
      const score = matchScore(entry, normalizeSuffix(rest));
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
