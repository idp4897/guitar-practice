import type { ChordProSheet } from './types';
import type { ChordBeat, ChordSection } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function labelFromDirectiveKey(key: string): string {
  // "start_of_verse" → "Verse", "start_of_chorus" → "Chorus"
  return key.replace('start_of_', '').split('_').map(capitalize).join(' ');
}

// ─── deriveChordGrid ──────────────────────────────────────────────────────────

/**
 * Auto-derive a ChordSection[] from parsed ChordPro content.
 *
 * Rules:
 * - Lines with [/] bar separators: group chords into bars, split beats evenly.
 * - Lines without [/]: each chord is its own bar (beatsPerBar each).
 * - # comments and {start_of_*} directives start new sections.
 * - repeat is always 1 (cannot be inferred from ChordPro).
 */
export function deriveChordGrid(sheet: ChordProSheet, beatsPerBar = 4): ChordSection[] {
  const sections: ChordSection[] = [];
  let currentLabel = '';
  let autoIdx = 1;
  let currentChords: ChordBeat[] = [];

  const flushSection = () => {
    if (currentChords.length === 0) return;
    sections.push({
      label:  currentLabel || `Section ${autoIdx++}`,
      chords: currentChords,
      repeat: 1,
    });
    currentChords = [];
  };

  const pushBar = (bar: string[]) => {
    if (bar.length === 0) return;
    const beatsEach = Math.max(1, Math.floor(beatsPerBar / bar.length));
    for (const chord of bar) {
      currentChords.push({ chord, beats: beatsEach });
    }
  };

  for (const line of sheet.lines) {
    // ── Section label: # Comment ──────────────────────────────────────────
    if (line.type === 'comment') {
      flushSection();
      const raw = line.tokens[0]?.text ?? '';
      currentLabel = raw.replace(/^#+\s*/, '').trim();
      continue;
    }

    // ── Section label: {start_of_verse} etc. ─────────────────────────────
    if (line.type === 'directive') {
      const key = line.directiveKey ?? '';
      if (key.startsWith('start_of_')) {
        flushSection();
        const fromValue = line.directiveValue?.trim();
        currentLabel = fromValue || labelFromDirectiveKey(key);
      } else if (key.startsWith('end_of_')) {
        flushSection();
        currentLabel = '';
      }
      continue;
    }

    // ── Lyric line: extract chords ────────────────────────────────────────
    if (line.type !== 'lyric') continue;

    const hasBarSeps = line.tokens.some(t => t.marker);

    if (hasBarSeps) {
      // Group by [/] separators
      let bar: string[] = [];
      for (const token of line.tokens) {
        if (token.marker) {
          pushBar(bar);
          bar = [];
        } else if (token.chord != null) {
          bar.push(token.chord);
        }
      }
      pushBar(bar); // trailing chords after last [/]
    } else {
      // No bar structure: each chord = one bar
      for (const token of line.tokens) {
        if (token.chord != null) {
          currentChords.push({ chord: token.chord, beats: beatsPerBar });
        }
      }
    }
  }

  flushSection();
  return sections;
}
