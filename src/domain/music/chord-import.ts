import { Chord } from 'tonal';
import { NON_CHORD_MARKERS } from './chordpro';

/**
 * Converts "chord above lyrics" text — the format used by Ultimate Guitar,
 * Thai chord sites, and most printed song sheets — into ChordPro.
 *
 *   Am        G         F
 *   Well you only need the light
 *        ↓
 *   [Am]Well you only need the [G]light
 *
 * Everything here is pure and column-based: a chord is placed at the exact
 * character column it occupied in the source, so mid-word placements
 * (burn[F]ing) are preserved.
 */

const TAB_WIDTH = 8;
const MAX_SECTION_LABEL = 40;

const REPEAT_RE    = /^\(?(?:x\s?\d{1,2}|\d{1,2}\s?x)\)?$/i;
const DIRECTIVE_RE = /^\{[^{}]*\}$/;
const CAPO_RE      = /^\s*(?:capo(?:\s*fret)?|คาโป้?)\s*[:\-]?\s*(\d{1,2})\s*$/i;
const BRACKET_RE   = /^\[([^[\]]+)\]$/;
const PAREN_RE     = /^\(([^()]+)\)$/;

const SECTION_WORDS = new Set([
  'intro', 'outro', 'verse', 'chorus', 'pre-chorus', 'pre chorus', 'prechorus',
  'post-chorus', 'post chorus', 'hook', 'bridge', 'solo', 'instrumental',
  'interlude', 'refrain', 'ending', 'coda', 'break', 'riff', 'tag', 'vamp',
  'turnaround',
  'อินโทร', 'ท่อน', 'ฮุค', 'ฮุก', 'สร้อย', 'ดนตรี', 'โซโล่', 'จบ',
]);

type TokenType = 'chord' | 'marker' | 'repeat';

interface PositionedToken {
  value:  string;
  column: number;   // visual column in the source line, not a string index
  type:   TokenType;
}

export interface ImportStats {
  chordLines:      number;
  mergedLines:     number;
  sections:        number;
  tabLinesRemoved: number;
}

export interface ImportResult {
  content: string;
  capo?:   number;
  stats:   ImportStats;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

function isChordToken(value: string): boolean {
  const cleaned = value.replace(/[,.]+$/, '');
  if (!/^[A-G]/.test(cleaned)) return false;
  return Chord.get(cleaned).tonic != null;
}

function expandTabs(line: string): string {
  let out = '';
  for (const ch of line) {
    out += ch === '\t' ? ' '.repeat(TAB_WIDTH - (out.length % TAB_WIDTH)) : ch;
  }
  return out;
}

/**
 * Splits a line into positioned tokens when *every* token is a chord, a
 * non-chord marker, or a repeat hint (x2). Returns null for anything else —
 * one unrecognised word is enough to classify the line as lyrics.
 */
function parseChordLine(line: string): PositionedToken[] | null {
  if (line.trim() === '') return null;

  const tokens: PositionedToken[] = [];
  let hasChord = false;

  for (const match of line.matchAll(/\S+/g)) {
    let value = match[0];
    let index = match.index ?? 0;

    const leadingBars = value.match(/^\|+/);
    if (leadingBars) {
      value = value.slice(leadingBars[0].length);
      index += leadingBars[0].length;
    }
    value = value.replace(/\|+$/, '');

    if (value === '') continue;                       // bare bar line — drop

    const column = displayColumn(line, index);

    if (REPEAT_RE.test(value))        { tokens.push({ value, column, type: 'repeat' }); continue; }
    if (NON_CHORD_MARKERS.has(value)) { tokens.push({ value, column, type: 'marker' }); continue; }
    if (isChordToken(value)) {
      tokens.push({ value: value.replace(/[,.]+$/, ''), column, type: 'chord' });
      hasChord = true;
      continue;
    }

    return null;
  }

  return hasChord ? tokens : null;
}

/** True when the line already carries ChordPro brackets — pass it through untouched. */
function hasChordProBrackets(line: string): boolean {
  const brackets = line.match(/\[([^[\]\n]+)\]/g);
  if (!brackets) return false;
  return brackets.some((b) => {
    const inner = b.slice(1, -1);
    return NON_CHORD_MARKERS.has(inner) || isChordToken(inner);
  });
}

function isSectionWord(text: string): boolean {
  const normalised = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\s.:_]*\d+$/, '')
    .trim();
  return SECTION_WORDS.has(normalised);
}

/** `[Verse 1]`, `(Chorus)`, `Verse 2:` → the label; null when it is not a header. */
function matchSectionLabel(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed === '') return null;

  const bracket = trimmed.match(BRACKET_RE);
  if (bracket) {
    const inner = bracket[1].trim();
    if (inner === '' || inner.length > MAX_SECTION_LABEL) return null;
    return parseChordLine(inner) ? null : inner;
  }

  const paren = trimmed.match(PAREN_RE);
  if (paren && isSectionWord(paren[1])) return paren[1].trim();

  const colon = trimmed.match(/^(.{1,30}?)\s*:$/);
  if (colon && isSectionWord(colon[1])) return colon[1].trim();

  if (trimmed.length <= MAX_SECTION_LABEL && isSectionWord(trimmed)) return trimmed;

  return null;
}

/** Guitar tablature rows (`e|--3--5--|`) carry no ChordPro value — drop them. */
function isTabLine(line: string): boolean {
  const compact = line.replace(/\s/g, '');
  if (compact.length < 4) return false;

  const dashes = compact.match(/-/g)?.length ?? 0;
  if (dashes < 3 || dashes / compact.length < 0.3) return false;

  return /^[eEADGBbCF#|:\-\d\\/xXhHpPrRsSvV~^()*.]+$/.test(compact);
}

function matchCapo(line: string): number | null {
  const match = line.match(CAPO_RE);
  if (!match) return null;
  const fret = parseInt(match[1], 10);
  return fret >= 0 && fret <= 12 ? fret : null;
}

// ─── Line assembly ────────────────────────────────────────────────────────────

function renderChordOnlyLine(tokens: PositionedToken[]): string {
  return tokens
    .map((t) => (t.type === 'repeat' ? t.value : `[${t.value}]`))
    .join(' ');
}

/**
 * Thai vowels and tone marks render above/below their base consonant and take
 * no horizontal space, so a string index is not a visual column. Chord sheets
 * are aligned visually — the mapping has to be too, and an inserted chord must
 * never land between a base character and its marks.
 */
const ZERO_WIDTH_MARK_RE = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0300-\u036F]/;

function displayColumnToIndex(text: string, column: number): number {
  let index = 0;
  let col   = 0;

  while (index < text.length && col < column) {
    index++;
    while (index < text.length && ZERO_WIDTH_MARK_RE.test(text[index])) index++;
    col++;
  }

  return index;
}

function displayColumn(text: string, index: number): number {
  let col = 0;
  for (let i = 0; i < index && i < text.length; i++) {
    if (!ZERO_WIDTH_MARK_RE.test(text[i])) col++;
  }
  return col;
}

function mergeChordsIntoLyric(tokens: PositionedToken[], lyric: string): string {
  let result = '';
  let cursor = 0;

  for (const token of tokens) {
    const position = displayColumnToIndex(lyric, token.column);
    if (position > cursor) {
      result += lyric.slice(cursor, position);
      cursor = position;
    }
    result += token.type === 'repeat' ? token.value : `[${token.value}]`;
  }

  return result + lyric.slice(cursor);
}

function dedent(lines: string[]): string[] {
  const indents = lines
    .filter((l) => l.trim() !== '')
    .map((l) => l.length - l.trimStart().length);
  const common = indents.length > 0 ? Math.min(...indents) : 0;
  return common === 0 ? lines : lines.map((l) => l.slice(common));
}

function collapseBlankLines(lines: string[]): string[] {
  return lines.filter((line, i) => line.trim() !== '' || lines[i - 1]?.trim() !== '');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function convertChordOverLyrics(raw: string): ImportResult {
  const stats: ImportStats = { chordLines: 0, mergedLines: 0, sections: 0, tabLinesRemoved: 0 };
  let capo: number | undefined;

  const lines = dedent(
    raw
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map(expandTabs),
  );

  const isLyricCandidate = (line: string | undefined): line is string =>
    line !== undefined &&
    line.trim() !== '' &&
    !isTabLine(line) &&
    matchCapo(line) === null &&
    matchSectionLabel(line) === null &&
    !DIRECTIVE_RE.test(line.trim()) &&
    !line.trimStart().startsWith('#') &&
    !hasChordProBrackets(line) &&
    parseChordLine(line) === null;

  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isTabLine(line)) { stats.tabLinesRemoved++; continue; }

    const capoFret = matchCapo(line);
    if (capoFret !== null) { capo ??= capoFret; continue; }

    const trimmed = line.trim();
    if (DIRECTIVE_RE.test(trimmed) || trimmed.startsWith('#')) { out.push(trimmed); continue; }

    const section = matchSectionLabel(line);
    if (section) { out.push(`{c: ${section}}`); stats.sections++; continue; }

    if (hasChordProBrackets(line)) { out.push(line.trimEnd()); continue; }

    const tokens = parseChordLine(line);
    if (!tokens) { out.push(line.trimEnd()); continue; }

    stats.chordLines++;

    if (isLyricCandidate(lines[i + 1])) {
      out.push(mergeChordsIntoLyric(tokens, lines[i + 1].trimEnd()));
      stats.mergedLines++;
      i++;
      continue;
    }

    out.push(renderChordOnlyLine(tokens));
  }

  return { content: collapseBlankLines(out).join('\n').trim(), capo, stats };
}

/** Heuristic used by the editor to offer conversion on paste. */
export function looksLikeChordOverLyrics(raw: string): boolean {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map(expandTabs);
  if (lines.some(hasChordProBrackets)) return false;
  return lines.some((line) => parseChordLine(line) !== null);
}
