// ─── Time Signature domain types and config ───────────────────────────────────

export type AccentLevel = 'strong' | 'medium' | 'weak';

export interface TimeSignature {
  id: string;
  display: string;          // "4/4", "6/8", …
  numerator: number;        // clicks per bar
  denominator: number;      // note value (4 = quarter, 8 = eighth)
  accents: AccentLevel[];   // length === numerator; first entry is always 'strong'
  bpmLabel: string;         // "♩" or "♩." — what note value BPM refers to
  /** Seconds between each click at the given BPM. */
  clickInterval: (bpm: number) => number;
  /** Alternate groupings for irregular time (5/8, 7/8). When present, accents
   *  are computed from the selected grouping via generateAccents(). */
  groupings?: number[][];
}

// ─── Pure function: grouping → accent array ────────────────────────────────────
//
// Rules:
//   - First beat of bar (group 0, position 0) → 'strong'
//   - First beat of each subsequent group       → 'medium'
//   - All other beats                            → 'weak'
//
// Examples:
//   generateAccents([4])     → [strong, weak, weak, weak]
//   generateAccents([2,2,3]) → [strong, weak, medium, weak, medium, weak, weak]
//   generateAccents([3,3])   → [strong, weak, weak, medium, weak, weak]

export function generateAccents(grouping: number[]): AccentLevel[] {
  const result: AccentLevel[] = [];
  for (let g = 0; g < grouping.length; g++) {
    for (let i = 0; i < grouping[g]; i++) {
      result.push(g === 0 && i === 0 ? 'strong' : i === 0 ? 'medium' : 'weak');
    }
  }
  return result;
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

export const TIME_SIGNATURES: TimeSignature[] = [
  // ── Simple ──────────────────────────────────────────────────────────────────
  {
    id: '2_4',
    display: '2/4',
    numerator: 2,
    denominator: 4,
    accents: generateAccents([2]),
    bpmLabel: '♩',
    clickInterval: (bpm) => 60 / bpm,
  },
  {
    id: '3_4',
    display: '3/4',
    numerator: 3,
    denominator: 4,
    accents: generateAccents([3]),
    bpmLabel: '♩',
    clickInterval: (bpm) => 60 / bpm,
  },
  {
    id: '4_4',
    display: '4/4',
    numerator: 4,
    denominator: 4,
    // 4/4 has a secondary accent on beat 3, not just beat 1
    accents: ['strong', 'weak', 'medium', 'weak'],
    bpmLabel: '♩',
    clickInterval: (bpm) => 60 / bpm,
  },

  // ── Compound ────────────────────────────────────────────────────────────────
  // BPM = dotted-quarter (1 felt beat = 3 eighths).
  // Click on every eighth → interval = 60/BPM ÷ 3.
  {
    id: '6_8',
    display: '6/8',
    numerator: 6,
    denominator: 8,
    accents: generateAccents([3, 3]),
    bpmLabel: '♩.',
    clickInterval: (bpm) => 60 / bpm / 3,
  },
  {
    id: '9_8',
    display: '9/8',
    numerator: 9,
    denominator: 8,
    accents: generateAccents([3, 3, 3]),
    bpmLabel: '♩.',
    clickInterval: (bpm) => 60 / bpm / 3,
  },
  {
    id: '12_8',
    display: '12/8',
    numerator: 12,
    denominator: 8,
    accents: generateAccents([3, 3, 3, 3]),
    bpmLabel: '♩.',
    clickInterval: (bpm) => 60 / bpm / 3,
  },

  // ── Irregular ───────────────────────────────────────────────────────────────
  // BPM = quarter note. Click on every eighth → interval = 60/BPM ÷ 2.
  {
    id: '5_8',
    display: '5/8',
    numerator: 5,
    denominator: 8,
    accents: generateAccents([2, 3]),   // default: 2+3
    bpmLabel: '♩',
    clickInterval: (bpm) => 30 / bpm,
    groupings: [[2, 3], [3, 2]],
  },
  {
    id: '7_8',
    display: '7/8',
    numerator: 7,
    denominator: 8,
    accents: generateAccents([2, 2, 3]),  // default: 2+2+3
    bpmLabel: '♩',
    clickInterval: (bpm) => 30 / bpm,
    groupings: [[2, 2, 3], [3, 2, 2], [2, 3, 2]],
  },
];

export function getTimeSignature(id: string): TimeSignature {
  return TIME_SIGNATURES.find((ts) => ts.id === id) ?? TIME_SIGNATURES[2]; // default 4/4
}

/** Format a grouping number[] as a human-readable string, e.g. [2,2,3] → "2+2+3" */
export function formatGrouping(grouping: number[]): string {
  return grouping.join('+');
}
