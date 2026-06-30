import { Chord, Interval, Key, Note } from 'tonal';
import type {
  ChordProSheet,
  ChordToken,
  DiatonicChordInfo,
  KeyCandidate,
  SectionAnalysisResult,
  SectionKeyResult,
  SongKey,
} from './types';

const TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function transposeChord(chord: string, semitones: number): string {
  if (semitones === 0) return chord;
  const interval = Interval.fromSemitones(semitones);
  if (!interval) return chord;
  const result = Chord.transpose(chord, interval);
  return result || chord;
}

export function transpose(chords: string[], semitones: number): string[] {
  return chords.map((chord) => transposeChord(chord, semitones));
}

export function applyCapo(chords: string[], capoFret: number): string[] {
  return transpose(chords, -capoFret);
}

// ─── Key Detection ────────────────────────────────────────────────────────────

// Standard key spellings (preferred enharmonic for each of the 24 keys).
const MAJOR_ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const MINOR_ROOTS = ['A', 'Bb', 'B', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#'] as const;

type TriadQuality = 'major' | 'minor' | 'dim';

interface ParsedChord {
  original: string;
  chroma:   number;       // 0–11, enharmonic-safe
  quality:  TriadQuality;
}

interface DiatonicEntry {
  chroma:  number;
  quality: TriadQuality;
}

function parseChord(chord: string): ParsedChord | null {
  // Slash chords: "G/B" → use root "G"
  const base = chord.includes('/') ? chord.split('/')[0] : chord;
  const c = Chord.get(base);
  if (!c.tonic) return null;

  const chroma = Note.chroma(c.tonic);
  if (chroma == null) return null;

  let quality: TriadQuality;
  switch (c.quality) {
    case 'Major':
      quality = 'major'; break;
    case 'Minor':
      quality = 'minor'; break;
    case 'Diminished':
      quality = 'dim'; break;
    case 'Unknown':
      // sus2 / sus4 → treat as major triad for key-detection purposes
      if ((c.aliases[0] ?? '').startsWith('sus')) { quality = 'major'; break; }
      return null;
    default:
      return null; // Augmented etc. — never diatonic, skip
  }

  return { original: chord, chroma, quality };
}

function buildDiatonic(root: string, mode: 'major' | 'minor'): DiatonicEntry[] {
  const triads =
    mode === 'major'
      ? Key.majorKey(root).triads
      : Key.minorKey(root).natural.triads;

  return triads.flatMap((triad) => {
    const c = Chord.get(triad);
    if (!c.tonic) return [];
    const ch = Note.chroma(c.tonic);
    if (ch == null) return [];
    const q: TriadQuality =
      c.quality === 'Minor' ? 'minor' :
      c.quality === 'Diminished' ? 'dim' : 'major';
    return [{ chroma: ch, quality: q }];
  });
}

/**
 * Detects the most likely musical keys for a set of chords.
 *
 * Steps:
 * 1. Parse raw chord names → (chroma, quality) pairs, skipping unparseable chords.
 * 2. Score all 24 keys (12 major + 12 minor) by diatonic ratio + cadence bonuses.
 * 3. Return strict candidates first (0 non-diatonic); fall back to lenient (≤ 2).
 * 4. Sorted by confidence descending.
 */
export function detectPossibleKeys(rawChords: string[]): KeyCandidate[] {
  if (rawChords.length === 0) return [];

  // Parse — preserving order for first/last chord analysis
  const allParsed = rawChords
    .map(parseChord)
    .filter((c): c is ParsedChord => c !== null);

  if (allParsed.length === 0) return [];

  // Deduplicate by (chroma, quality) for diatonic ratio calculation
  const seenKeys = new Set<string>();
  const uniqueParsed: ParsedChord[] = [];
  for (const p of allParsed) {
    const k = `${p.chroma}-${p.quality}`;
    if (!seenKeys.has(k)) { seenKeys.add(k); uniqueParsed.push(p); }
  }

  const firstChord = allParsed[0];
  const lastChord  = allParsed[allParsed.length - 1];

  const candidates: KeyCandidate[] = [];

  const scoreKey = (root: string, mode: 'major' | 'minor') => {
    const keyLabel   = mode === 'major' ? root : `${root}m`;
    const diatonic   = buildDiatonic(root, mode);
    const inDiatonic = (p: ParsedChord) =>
      diatonic.some(d => d.chroma === p.chroma && d.quality === p.quality);

    const nonDiatonicParsed = uniqueParsed.filter(p => !inDiatonic(p));
    const diatonicRatio     = (uniqueParsed.length - nonDiatonicParsed.length) / uniqueParsed.length;

    const tonicChroma  = Note.chroma(root) ?? -1;
    const tonicQuality = mode === 'minor' ? 'minor' : 'major';
    const isTonic      = (p: ParsedChord) =>
      p.chroma === tonicChroma && p.quality === tonicQuality;

    const firstIsTonic = isTonic(firstChord);
    const lastIsTonic  = isTonic(lastChord);
    const tonicPresent = uniqueParsed.some(isTonic);

    // V → I cadence: dominant is 7 semitones above tonic
    const dominantChroma = (tonicChroma + 7) % 12;
    const hasVtoI = allParsed.some((p, i) =>
      p.chroma === dominantChroma &&
      p.quality === 'major' &&
      allParsed[i + 1] !== undefined &&
      isTonic(allParsed[i + 1])
    );

    let score = diatonicRatio * 0.6;
    if (firstIsTonic) score += 0.20;
    if (lastIsTonic)  score += 0.10;
    if (tonicPresent && !firstIsTonic && !lastIsTonic) score += 0.05;
    if (hasVtoI) score += 0.05;

    candidates.push({
      key:         keyLabel,
      mode,
      confidence:  Math.min(1, score),
      nonDiatonic: nonDiatonicParsed.map(p => p.original),
    });
  };

  for (const root of MAJOR_ROOTS) scoreKey(root, 'major');
  for (const root of MINOR_ROOTS) scoreKey(root, 'minor');

  // Prefer strict (0 non-diatonic); fall back to lenient (≤ 2)
  const strict  = candidates.filter(c => c.nonDiatonic.length === 0);
  const lenient = candidates.filter(c => c.nonDiatonic.length <= 2);

  if (strict.length > 0) return strict.sort((a, b) => b.confidence - a.confidence);
  if (lenient.length > 0) return lenient.sort((a, b) => b.confidence - a.confidence);

  // Coverage fallback: no key fits within 2 non-diatonic (song likely modulates).
  // Return top-5 by coverage (fewest non-diatonic), all marked partial.
  return candidates
    .sort((a, b) => a.nonDiatonic.length - b.nonDiatonic.length || b.confidence - a.confidence)
    .slice(0, 5)
    .map(c => ({ ...c, partial: true }));
}

// Thin wrapper kept for callers (useSongPlayer) that only need the top key string.
export function detectKey(chords: string[]): KeyCandidate[] {
  return detectPossibleKeys(chords);
}

// ─── Section analysis ────────────────────────────────────────────────────────

const SECTION_DIRECTIVE_LABELS: Record<string, string> = {
  start_of_verse:       'Verse',
  start_of_chorus:      'Chorus',
  start_of_bridge:      'Bridge',
  start_of_solo:        'Solo',
  start_of_intro:       'Intro',
  start_of_outro:       'Outro',
  start_of_pre_chorus:  'Pre-Chorus',
};

interface InternalSection { label: string; chords: string[] }

function chordsFromLineTokens(tokens: ChordToken[]): string[] {
  return tokens
    .filter((t): t is ChordToken & { chord: string } => t.chord != null && !t.marker)
    .map(t => t.chord);
}

function extractSections(sheet: ChordProSheet): InternalSection[] {
  const { lines } = sheet;

  // ── Directive mode ────────────────────────────────────────────────────────
  const hasStartDirective = lines.some(
    l => l.type === 'directive' && l.directiveKey != null && l.directiveKey in SECTION_DIRECTIVE_LABELS,
  );

  if (hasStartDirective) {
    const sections: InternalSection[] = [];
    let current: InternalSection | null = null;

    for (const line of lines) {
      if (line.type === 'directive' && line.directiveKey) {
        const label = SECTION_DIRECTIVE_LABELS[line.directiveKey];
        if (label) {
          if (current?.chords.length) sections.push(current);
          const display = line.directiveValue ? `${label} (${line.directiveValue})` : label;
          current = { label: display, chords: [] };
        } else if (line.directiveKey.startsWith('end_of_')) {
          if (current?.chords.length) { sections.push(current); current = null; }
        }
      } else if (line.type === 'lyric' && current) {
        current.chords.push(...chordsFromLineTokens(line.tokens));
      }
    }
    if (current?.chords.length) sections.push(current);
    return sections;
  }

  // ── Comment-header mode ───────────────────────────────────────────────────
  const hasCommentHeaders = lines.some(
    l => l.type === 'comment' ||
         (l.type === 'directive' && l.directiveKey === 'comment' && !!l.directiveValue),
  );

  if (hasCommentHeaders) {
    const sections: InternalSection[] = [];
    let current: InternalSection | null = null;

    for (const line of lines) {
      const isComment = line.type === 'comment' ||
        (line.type === 'directive' && line.directiveKey === 'comment');
      if (isComment) {
        if (current?.chords.length) sections.push(current);
        const raw = line.type === 'comment'
          ? (line.tokens[0]?.text ?? '').replace(/^#+\s*/, '').trim()
          : (line.directiveValue ?? '');
        current = { label: raw || `Section ${sections.length + 1}`, chords: [] };
      } else if (line.type === 'lyric') {
        if (!current) current = { label: `Section ${sections.length + 1}`, chords: [] };
        current.chords.push(...chordsFromLineTokens(line.tokens));
      }
    }
    if (current?.chords.length) sections.push(current);
    return sections;
  }

  // ── Paragraph mode (blank-line separation) ────────────────────────────────
  const sections: InternalSection[] = [];
  let pending: string[] = [];

  const flush = () => {
    if (pending.length > 0) {
      sections.push({ label: `Section ${sections.length + 1}`, chords: [...pending] });
      pending = [];
    }
  };

  for (const line of lines) {
    if (line.type === 'empty') { flush(); }
    else if (line.type === 'lyric') { pending.push(...chordsFromLineTokens(line.tokens)); }
  }
  flush();

  return sections;
}

/**
 * Analyses a ChordPro sheet for key modulations between sections.
 * Sections are derived from `start_of_*` directives, comment headers, or blank-line
 * paragraphs (in that priority order).
 *
 * Returns { hasModulation: true, sections } when two or more sections have
 * detectably different top keys.
 */
export function detectKeyBySection(sheet: ChordProSheet): SectionAnalysisResult {
  const sections = extractSections(sheet).filter(s => s.chords.length >= 2);

  const sectionResults: SectionKeyResult[] = sections.map(s => ({
    label:  s.label,
    key:    detectPossibleKeys(s.chords)[0]?.key ?? null,
    chords: s.chords,
  }));

  const keyedSections = sectionResults.filter(s => s.key !== null);
  const uniqueKeys    = new Set(keyedSections.map(s => s.key));
  const hasModulation = keyedSections.length >= 2 && uniqueKeys.size > 1;

  return { hasModulation, sections: sectionResults };
}

// ─── SongKey utilities ────────────────────────────────────────────────────────

/**
 * Parses a legacy key string (e.g. "Am", "F#m", "G") into a SongKey.
 * Used for migrating songs that only have originalKey stored.
 */
export function parseSongKey(keyStr: string): SongKey {
  if (keyStr.length > 1 && keyStr.endsWith('m')) {
    return { key: keyStr.slice(0, -1), mode: 'minor' };
  }
  return { key: keyStr, mode: 'major' };
}

/** "Am" / "E" (short) or "A minor" / "E major" (full). */
export function formatSongKey(sk: SongKey, style: 'short' | 'full' = 'short'): string {
  if (style === 'full') return `${sk.key} ${sk.mode}`;
  return sk.mode === 'minor' ? `${sk.key}m` : sk.key;
}

/** The relative minor (for major keys) or relative major (for minor keys). */
export function getRelativeKey(songKey: SongKey): SongKey {
  const { key, mode } = songKey;
  const interval = mode === 'major' ? '6M' : '3m';
  const relMode  = mode === 'major' ? 'minor' : 'major';
  const raw      = Note.transpose(key, interval);
  const relRoot  = (raw && Note.simplify(raw)) || key;
  return { key: relRoot, mode: relMode };
}

// ─── Diatonic chord analysis ──────────────────────────────────────────────────

const MAJOR_ROMANS    = ['I',   'ii',  'iii', 'IV',  'V',   'vi',  'vii°'] as const;
const MAJOR_FUNCTIONS = ['Tonic', 'Supertonic', 'Mediant', 'Subdominant', 'Dominant', 'Submediant', 'Leading tone'] as const;
const MINOR_ROMANS    = ['i',   'ii°', 'III', 'iv',  'v',   'VI',  'VII']  as const;
const MINOR_FUNCTIONS = ['Tonic', 'Supertonic', 'Mediant', 'Subdominant', 'Dominant', 'Submediant', 'Subtonic'] as const;

/**
 * Returns all 7 diatonic triads for a given key with full theory metadata.
 * Minor keys use natural minor as the base; harmonic minor V is flagged via
 * `harmonicMinorVariant` on degree 5.
 */
export function getDiatonicChords(songKey: SongKey): DiatonicChordInfo[] {
  const { key, mode } = songKey;
  const triads          = mode === 'major'
    ? Key.majorKey(key).triads
    : Key.minorKey(key).natural.triads;
  const romans          = mode === 'major' ? MAJOR_ROMANS    : MINOR_ROMANS;
  const fns             = mode === 'major' ? MAJOR_FUNCTIONS : MINOR_FUNCTIONS;
  const harmonicTriads  = mode === 'minor' ? Key.minorKey(key).harmonic.triads : null;

  return triads.map((chord, i): DiatonicChordInfo => {
    const c = Chord.get(chord);
    const quality: 'major' | 'minor' | 'dim' =
      c.quality === 'Diminished' ? 'dim' :
      c.quality === 'Minor'      ? 'minor' : 'major';

    const entry: DiatonicChordInfo = {
      chord,
      degree:       i + 1,
      romanNumeral: romans[i],
      fn:           fns[i],
      quality,
      isPrimary:    i === 0 || i === 3 || i === 4,
    };

    // Degree 5 of natural minor is v (minor); harmonic minor raises it to V (major).
    if (mode === 'minor' && i === 4 && harmonicTriads?.[4]) {
      entry.harmonicMinorVariant = harmonicTriads[4];
    }

    return entry;
  });
}

/**
 * Returns true when a chord (any extension) is diatonic to the given key,
 * matching by root chroma + triad quality.
 */
export function isChordInKey(chord: string, songKey: SongKey): boolean {
  const parsed = parseChord(chord);
  if (!parsed) return false;
  const diatonic = buildDiatonic(songKey.key, songKey.mode);
  return diatonic.some(d => d.chroma === parsed.chroma && d.quality === parsed.quality);
}

/**
 * Given the full chord list of a song and a list of diatonic chord names,
 * returns the set of diatonic chord names that actually appear in the song.
 * Matching is by root chroma + triad quality, so "F#m7" matches "F#m".
 */
export function findUsedDiatonicChords(
  songChords:          string[],
  diatonicChordNames:  string[],
): Set<string> {
  const songParsed = songChords
    .map(c => parseChord(c.includes('/') ? c.split('/')[0] : c))
    .filter((p): p is ParsedChord => p !== null);

  const used = new Set<string>();
  for (const dcName of diatonicChordNames) {
    const dp = parseChord(dcName);
    if (!dp) continue;
    if (songParsed.some(p => p.chroma === dp.chroma && p.quality === dp.quality)) {
      used.add(dcName);
    }
  }
  return used;
}
