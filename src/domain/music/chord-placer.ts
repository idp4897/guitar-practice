// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlacedChord {
  charIndex: number;  // 0-based grapheme-cluster index in ChordLine.text
  chord:     string;
}

export interface ChordLine {
  text:   string;         // lyric text with no ChordPro syntax
  chords: PlacedChord[];  // sorted ascending by charIndex
}

export type EditorLine =
  | { kind: 'lyric'; data: ChordLine }
  | { kind: 'raw';   text: string };   // directive / comment / empty

// ─── Grapheme segmentation ────────────────────────────────────────────────────
// Uses Intl.Segmenter (grapheme granularity) when available so that Thai
// combining marks (sara above/below, tone marks) stay with their consonant.
// Falls back to Array.from (Unicode code points) for environments without it.

export function graphemes(text: string): string[] {
  if (
    typeof Intl !== 'undefined' &&
    'Segmenter' in Intl &&
    typeof (Intl as { Segmenter?: unknown }).Segmenter === 'function'
  ) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

// ─── ChordPro line ↔ ChordLine ────────────────────────────────────────────────

const CHORD_RE = /\[([^\]]*)\]/g;

/**
 * Parses a single ChordPro line such as "[Am]ยิ้มๆ [G]ให้กัน"
 * into a ChordLine where charIndex values are grapheme-cluster positions
 * in the plain text.
 */
export function parseChordProLine(line: string): ChordLine {
  let plainSoFar = '';
  let lastEnd    = 0;
  const chords: PlacedChord[] = [];

  for (const match of line.matchAll(CHORD_RE)) {
    plainSoFar += line.slice(lastEnd, match.index);
    chords.push({ charIndex: graphemes(plainSoFar).length, chord: match[1] });
    lastEnd = (match.index ?? 0) + match[0].length;
  }
  plainSoFar += line.slice(lastEnd);

  return { text: plainSoFar, chords };
}

/**
 * Serialises a ChordLine back to a ChordPro line string.
 * Round-trips cleanly with parseChordProLine.
 */
export function serializeChordLine(line: ChordLine): string {
  const gs  = graphemes(line.text);
  const map = new Map<number, string[]>();

  for (const { charIndex, chord } of line.chords) {
    const ci  = Math.max(0, Math.min(charIndex, gs.length));
    const arr = map.get(ci) ?? [];
    arr.push(chord);
    map.set(ci, arr);
  }

  let out = '';
  for (let i = 0; i <= gs.length; i++) {
    for (const c of (map.get(i) ?? [])) out += `[${c}]`;
    if (i < gs.length) out += gs[i];
  }
  return out;
}

// ─── Full content ↔ EditorLine[] ─────────────────────────────────────────────

/**
 * A directive starts with '{', a comment with '#', empty line is ''.
 * Everything else is treated as a lyric line.
 */
export function parseToEditorLines(content: string): EditorLine[] {
  return content.split('\n').map((line): EditorLine => {
    const t = line.trim();
    if (t === '' || t.startsWith('{') || t.startsWith('#')) {
      return { kind: 'raw', text: line };
    }
    return { kind: 'lyric', data: parseChordProLine(line) };
  });
}

export function serializeEditorLines(lines: EditorLine[]): string {
  return lines
    .map((l) => (l.kind === 'raw' ? l.text : serializeChordLine(l.data)))
    .join('\n');
}

// ─── Chord operations (pure) ──────────────────────────────────────────────────

/** Insert (or replace) a chord at the given grapheme-cluster index. */
export function insertChord(line: ChordLine, charIndex: number, chord: string): ChordLine {
  const filtered = line.chords.filter((c) => c.charIndex !== charIndex);
  return {
    ...line,
    chords: [...filtered, { charIndex, chord }].sort((a, b) => a.charIndex - b.charIndex),
  };
}

/** Remove the chord at the given grapheme-cluster index (no-op if none). */
export function removeChord(line: ChordLine, charIndex: number): ChordLine {
  return { ...line, chords: line.chords.filter((c) => c.charIndex !== charIndex) };
}

/**
 * Move a chord from fromIndex to toIndex.
 * If toIndex already has a chord, the existing one is displaced (removed).
 */
export function moveChord(line: ChordLine, fromIndex: number, toIndex: number): ChordLine {
  const gs      = graphemes(line.text);
  const clamped = Math.max(0, Math.min(toIndex, gs.length));
  const moving  = line.chords.find((c) => c.charIndex === fromIndex);
  if (!moving) return line;
  const rest = line.chords.filter((c) => c.charIndex !== fromIndex && c.charIndex !== clamped);
  return {
    ...line,
    chords: [...rest, { charIndex: clamped, chord: moving.chord }]
      .sort((a, b) => a.charIndex - b.charIndex),
  };
}

/** Change the chord name at charIndex without moving it. */
export function replaceChord(line: ChordLine, charIndex: number, newChord: string): ChordLine {
  return {
    ...line,
    chords: line.chords.map((c) =>
      c.charIndex === charIndex ? { ...c, chord: newChord } : c,
    ),
  };
}

// ─── Diatonic chord suggestion ────────────────────────────────────────────────
// Handles both "Am"/"F#m" (ChordPro format) and "A minor"/"C major" (tonal format).

const CHROMATIC  = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ENHARMONIC: Record<string, string> = {
  Db: 'C#', Eb: 'D#', Fb: 'E', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B',
};
const MAJOR_STEPS: number[] = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS: number[] = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_QUAL  = ['', 'm', 'm', '', '', 'm', 'dim'];
const MINOR_QUAL  = ['m', 'dim', '', 'm', 'm', '', ''];

export function getDiatonicChords(key: string): string[] {
  const k = key.trim();
  let root: string;
  let isMinor: boolean;

  if (k.endsWith(' major')) {
    root    = k.slice(0, -6).trim();
    isMinor = false;
  } else if (k.endsWith(' minor')) {
    root    = k.slice(0, -6).trim();
    isMinor = true;
  } else if (k.length > 1 && k.endsWith('m') && !k.includes('maj')) {
    root    = k.slice(0, -1);
    isMinor = true;
  } else {
    root    = k;
    isMinor = false;
  }

  root = ENHARMONIC[root] ?? root;
  const rootIdx = CHROMATIC.indexOf(root);
  if (rootIdx < 0) return [];

  const steps = isMinor ? MINOR_STEPS : MAJOR_STEPS;
  const quals = isMinor ? MINOR_QUAL  : MAJOR_QUAL;

  return steps.map((step, i) => CHROMATIC[(rootIdx + step) % 12] + quals[i]);
}
