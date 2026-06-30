import { Chord } from 'tonal';
import type { ChordProLine, ChordProSheet, ChordToken } from './types';
import { transposeChord } from './theory';

const DIRECTIVE_RE = /^\{([^:}]+)(?::\s*(.*?))?\}\s*$/;

// ─── Non-chord marker detection ───────────────────────────────────────────────

/**
 * Bracket tokens that are rhythm/structural markers, not real chords.
 * These are displayed in the chord row but excluded from analysis
 * (key detection, diatonic checking, play-along chord map).
 */
export const NON_CHORD_MARKERS = new Set([
  '/',    // sustain / repeat last chord
  '%',    // repeat measure
  'N.C.', // no chord
  'NC',
  '-',    // rest
  '|',    // bar line
  'x',    // muted / dead strum
]);

/**
 * Returns true when `value` (the content inside […]) is a non-chord marker
 * rather than a real chord name.
 *
 * Rules (in order):
 *   1. Explicit set: fast path for common markers (/, %, N.C., …)
 *   2. Tonal fallback: anything tonal cannot recognise as a chord (no root)
 *
 * Important: [B/D#] has root B → chord, not marker.
 *            [/]    has no root → marker.
 */
function isMarkerToken(value: string): boolean {
  if (NON_CHORD_MARKERS.has(value)) return true;
  return !Chord.get(value).tonic;
}

// ─── Line parser ──────────────────────────────────────────────────────────────

function parseLyricLine(line: string): ChordToken[] {
  const tokens: ChordToken[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    const bracketIdx = remaining.indexOf('[');

    if (bracketIdx === -1) {
      tokens.push({ chord: null, text: remaining });
      break;
    }

    if (bracketIdx > 0) {
      tokens.push({ chord: null, text: remaining.slice(0, bracketIdx) });
    }

    const closeIdx = remaining.indexOf(']', bracketIdx);
    if (closeIdx === -1) {
      tokens.push({ chord: null, text: remaining });
      break;
    }

    const chord = remaining.slice(bracketIdx + 1, closeIdx);
    remaining = remaining.slice(closeIdx + 1);

    const nextBracket = remaining.indexOf('[');
    const text = nextBracket === -1 ? remaining : remaining.slice(0, nextBracket);

    const marker = isMarkerToken(chord);
    tokens.push(marker ? { chord, text, marker: true } : { chord, text });

    if (nextBracket === -1) break;
    remaining = remaining.slice(nextBracket);
  }

  return tokens;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseChordPro(text: string): ChordProSheet {
  const sheet: ChordProSheet = { lines: [] };

  for (const raw of text.split('\n')) {
    const directive = raw.match(DIRECTIVE_RE);
    if (directive) {
      const [, key, value = ''] = directive;
      if (key === 'title') sheet.title = value;
      else if (key === 'artist') sheet.artist = value;
      else if (key === 'key') sheet.key = value;
      else if (key === 'capo') sheet.capo = parseInt(value, 10);

      sheet.lines.push({
        type: 'directive',
        tokens: [],
        directiveKey: key,
        directiveValue: value,
      });
      continue;
    }

    if (raw.startsWith('#')) {
      sheet.lines.push({ type: 'comment', tokens: [{ chord: null, text: raw }] });
      continue;
    }

    if (raw.trim() === '') {
      sheet.lines.push({ type: 'empty', tokens: [] });
      continue;
    }

    sheet.lines.push({ type: 'lyric', tokens: parseLyricLine(raw) });
  }

  return sheet;
}

export function formatChordPro(sheet: ChordProSheet): string {
  return sheet.lines
    .map((line) => {
      switch (line.type) {
        case 'directive':
          return line.directiveValue
            ? `{${line.directiveKey}: ${line.directiveValue}}`
            : `{${line.directiveKey}}`;
        case 'comment':
          return line.tokens[0]?.text ?? '';
        case 'empty':
          return '';
        case 'lyric':
          // chord field holds the original bracket content; round-trip is exact
          return line.tokens
            .map(({ chord, text }) => (chord != null ? `[${chord}]` : '') + text)
            .join('');
      }
    })
    .join('\n');
}

/**
 * Extracts only real chord names (non-markers) for use in key detection,
 * diatonic analysis, and play-along chord maps.
 * Marker tokens like [/], [%], [N.C.] are excluded.
 */
export function extractChords(sheet: ChordProSheet): string[] {
  return sheet.lines
    .filter((l) => l.type === 'lyric')
    .flatMap((l) => l.tokens)
    .filter((t): t is ChordToken & { chord: string } => t.chord != null && !t.marker)
    .map((t) => t.chord);
}

export function transposeSheet(sheet: ChordProSheet, semitones: number): ChordProSheet {
  if (semitones === 0) return sheet;

  return {
    ...sheet,
    key: sheet.key ? transposeChord(sheet.key, semitones) : undefined,
    lines: sheet.lines.map((line) => {
      if (line.type === 'directive' && line.directiveKey === 'key' && line.directiveValue) {
        return { ...line, directiveValue: transposeChord(line.directiveValue, semitones) };
      }
      if (line.type !== 'lyric') return line;
      return {
        ...line,
        tokens: line.tokens.map((token) => {
          // Markers are never transposed — they carry no pitch information
          if (token.chord == null || token.marker) return token;
          return { ...token, chord: transposeChord(token.chord, semitones) };
        }),
      };
    }),
  };
}
