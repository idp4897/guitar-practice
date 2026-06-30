import { Chord, Interval, Note } from 'tonal';
import guitarDb from '@tombatossals/chords-db/lib/guitar.json';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Tuning {
  id:      string;
  name:    string;
  strings: string[]; // 6 notes, index 0 = string 6 (low), index 5 = string 1 (high)
}

/** Matches the tombatossals shape, also used for computed voicings. */
export interface ChordPosition {
  frets:    number[];  // 6 values: -1=muted, 0=open, ≥1=relative fret row
  fingers:  number[];  // suggested finger per string (0 = none)
  baseFret: number;    // which absolute fret the "1" row represents
  barres:   number[];  // barre fret rows (relative)
}

// ─── Tuning catalogue ─────────────────────────────────────────────────────────

export const TUNINGS: Tuning[] = [
  { id: 'standard',    name: 'Standard',    strings: ['E', 'A', 'D', 'G', 'B', 'E'] },
  { id: 'eb_standard', name: 'Eb Standard', strings: ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb'] },
  { id: 'drop_d',      name: 'Drop D',      strings: ['D', 'A', 'D', 'G', 'B', 'E'] },
  { id: 'drop_db',     name: 'Drop C#/Db',  strings: ['Db', 'Ab', 'Db', 'Gb', 'Bb', 'Eb'] },
];

/** Returns the tuning by id, falling back to Standard if not found. */
export function getTuning(id: string): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0];
}

// ─── Tuning classification ────────────────────────────────────────────────────

const STANDARD_CHROMAS = TUNINGS[0].strings.map((n) => Note.chroma(n) as number);

function stringOffset(note: string, stdIdx: number): number {
  let diff = (Note.chroma(note) ?? 0) - STANDARD_CHROMAS[stdIdx];
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

/**
 * Uniform: every string is offset by the same number of semitones from standard
 * (e.g. Eb Standard = −1, D Standard = −2).
 * Altered: strings differ (e.g. Drop D has string 6 at −2, rest at 0).
 */
export function detectTuningType(tuning: Tuning): 'uniform' | 'altered' {
  const offsets = tuning.strings.map((n, i) => stringOffset(n, i));
  return offsets.every((d) => d === offsets[0]) ? 'uniform' : 'altered';
}

/** Semitone offset of a uniform tuning from standard (negative = lower). */
export function getUniformOffset(tuning: Tuning): number {
  return stringOffset(tuning.strings[0], 0);
}

// ─── Fretboard math ───────────────────────────────────────────────────────────

/** Pitch class (no octave) at `fret` on a string with `openNote` open tuning. */
export function noteAtFret(openNote: string, fret: number): string {
  if (fret === 0) return openNote;
  return (
    Note.pitchClass(Note.transpose(openNote + '2', Interval.fromSemitones(fret))) ??
    openNote
  );
}

/** Chroma (0–11) at `fret` on a string, or -1 if the note cannot be determined. */
export function chromaAtFret(openNote: string, fret: number): number {
  return Note.chroma(noteAtFret(openNote, fret)) ?? -1;
}

// ─── Standard-tuning DB lookup (tombatossals) ─────────────────────────────────

interface DbEntry {
  key: string;
  suffix: string;
  positions: ChordPosition[];
}

const NOTE_TO_DB_KEY: Record<string, string> = {
  C: 'C', 'C#': 'Csharp', Db: 'Csharp',
  D: 'D', 'D#': 'Eb',     Eb: 'Eb',
  E: 'E',
  F: 'F', 'F#': 'Fsharp', Gb: 'Fsharp',
  G: 'G', 'G#': 'Ab',     Ab: 'Ab',
  A: 'A', 'A#': 'Bb',     Bb: 'Bb',
  B: 'B',
};

const SUFFIX_MAP: Record<string, string> = {
  '': 'major', maj: 'major', major: 'major',
  m: 'minor',  min: 'minor', minor: 'minor',
  '7': '7',    m7: 'm7',     min7: 'm7',
  maj7: 'maj7', M7: 'maj7',
  '9': '9',    m9: 'm9',     maj9: 'maj9',
  '11': '11',  '13': '13',
  dim: 'dim',  dim7: 'dim7', aug: 'aug',
  sus2: 'sus2', sus4: 'sus4', '7sus4': '7sus4',
  add9: 'add9', '6': '6',    m6: 'm6',   '69': '69',
};

function parseChordName(chord: string): { dbKey: string; suffix: string } | null {
  const m = chord.match(/^([A-G][b#]?)(.*)$/);
  if (!m) return null;
  const dbKey = NOTE_TO_DB_KEY[m[1]];
  if (!dbKey) return null;
  return { dbKey, suffix: SUFFIX_MAP[m[2]] ?? m[2] };
}

function lookupFromDb(chord: string): ChordPosition[] {
  const parsed = parseChordName(chord);
  if (!parsed) return [];
  const { dbKey, suffix } = parsed;
  const entries = (guitarDb.chords as Record<string, DbEntry[]>)[dbKey];
  if (!entries) return [];
  const entry = entries.find((e) => e.suffix === suffix) ?? entries[0];
  if (!entry) return [];
  // Sort simpler voicings first (low baseFret, no barre, small stretch)
  return [...entry.positions].sort((a, b) => {
    const score = (p: ChordPosition) => {
      const played = p.frets.filter((f) => f > 0);
      const stretch = played.length > 1 ? Math.max(...played) - Math.min(...played) : 0;
      return p.baseFret * 3 + p.barres.length * 8 + p.frets.filter((f) => f === -1).length + stretch;
    };
    return score(a) - score(b);
  });
}

// ─── Computed voicing search ──────────────────────────────────────────────────

/**
 * DFS over all 6 strings in a fret window [windowStart, windowStart+4].
 * Returns the best (lowest total fret sum) valid ChordPosition, or null.
 *
 * Constraints:
 *   • Root note on the lowest non-muted string.
 *   • Every note class in the chord is present at least once.
 *   • Non-open frets stay within a 4-fret span.
 *   • At least 3 strings played.
 */
function searchWindow(
  chordChromas: Set<number>,
  rootChroma: number,
  strings: string[],
  windowStart: number,
): number[] | null {
  const windowEnd = windowStart + 4;

  // Build per-string fret options: [absoluteFret, chroma]
  const options: Array<Array<[number, number]>> = strings.map((open) => {
    const opts: Array<[number, number]> = [];
    // Open string
    const openCh = Note.chroma(open);
    if (openCh != null && chordChromas.has(openCh)) opts.push([0, openCh]);
    // Frets in window
    for (let f = Math.max(1, windowStart); f <= windowEnd; f++) {
      const ch = chromaAtFret(open, f);
      if (ch >= 0 && chordChromas.has(ch)) opts.push([f, ch]);
    }
    opts.push([-1, -1]); // mute
    return opts;
  });

  let bestFrets: number[] | null = null;
  let bestScore = Infinity;

  const frets: number[] = [];
  const present = new Set<number>();

  function dfs(si: number, minF: number, maxF: number): void {
    if (si === strings.length) {
      const played = frets.filter((f) => f >= 0);
      if (played.length < 3) return;

      // Root on lowest played string
      const firstIdx = frets.findIndex((f) => f >= 0);
      if (firstIdx < 0) return;
      if (chromaAtFret(strings[firstIdx], frets[firstIdx]) !== rootChroma) return;

      // All chord notes present
      for (const c of chordChromas) if (!present.has(c)) return;

      const score = played.reduce((s, f) => s + f, 0) + frets.filter((f) => f < 0).length;
      if (score < bestScore) { bestScore = score; bestFrets = [...frets]; }
      return;
    }

    for (const [f, ch] of options[si]) {
      const newMin = f > 0 ? Math.min(minF, f) : minF;
      const newMax = f > 0 ? Math.max(maxF, f) : maxF;
      // Prune: non-open fret span > 4
      if (newMin !== Infinity && newMax !== -Infinity && newMax - newMin > 4) continue;

      frets.push(f);
      const added = ch >= 0 && !present.has(ch);
      if (added) present.add(ch);

      dfs(si + 1, newMin, newMax);

      frets.pop();
      if (added) present.delete(ch);
    }
  }

  dfs(0, Infinity, -Infinity);
  return bestFrets;
}

function absoluteToPosition(absFrets: number[]): ChordPosition {
  const nonZeroPlayed = absFrets.filter((f) => f > 0);
  const baseFret = nonZeroPlayed.length > 0 ? Math.min(...nonZeroPlayed) : 1;
  return {
    frets:    absFrets.map((f) => (f === -1 ? -1 : f === 0 ? 0 : f - baseFret + 1)),
    fingers:  [],
    baseFret,
    barres:   [],
  };
}

function computeVoicings(chordName: string, tuning: Tuning): ChordPosition[] {
  const chord = Chord.get(chordName);
  if (chord.empty || !chord.tonic) return [];

  const chordChromas = new Set(
    chord.notes.map((n) => Note.chroma(n)).filter((c): c is number => c != null),
  );
  const rootChroma = Note.chroma(chord.tonic);
  if (rootChroma == null) return [];

  const results: ChordPosition[] = [];
  const seen = new Set<string>();

  for (const ws of [0, 2, 5, 7]) {
    if (results.length >= 3) break;
    const abs = searchWindow(chordChromas, rootChroma, tuning.strings, ws);
    if (!abs) continue;
    const key = abs.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(absoluteToPosition(abs));
  }

  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns up to 3 chord voicings for `chordName` in the given `tuning`.
 *
 * Uniform-offset tunings (Eb Standard, D Standard, …) use the same fingering
 * shapes as Standard — the player grips identically and the sound shifts
 * uniformly. Altered-interval tunings (Drop D, Drop C#/Db) derive new shapes
 * from chord theory because string offsets differ.
 */
export function findVoicings(chordName: string, tuning: Tuning): ChordPosition[] {
  if (detectTuningType(tuning) === 'uniform') {
    const fromDb = lookupFromDb(chordName);
    if (fromDb.length > 0) return fromDb;
    return computeVoicings(chordName, TUNINGS[0]);
  }
  return computeVoicings(chordName, tuning);
}
