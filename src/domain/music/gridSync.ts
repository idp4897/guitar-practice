import type { ChordBeat, ChordCue, ChordSection } from './types';

/**
 * Flatten a chord grid into a linear list of beats in document order.
 *
 * Section `repeat` is intentionally ignored. The generated cue list must stay
 * 1:1 with extractChords(sheet) — which lists each chord once — because the
 * play-along highlighter maps cue index directly to sheet chord index.
 */
export function flattenGridBeats(grid: ChordSection[]): ChordBeat[] {
  return grid.flatMap((section) => section.chords);
}

/**
 * True when the flattened grid lines up 1:1 with the sheet's chords, so a
 * generated cue list can be index-aligned to the sheet.
 */
export function gridAlignsWithChords(grid: ChordSection[], chords: string[]): boolean {
  return chords.length > 0 && flattenGridBeats(grid).length === chords.length;
}

/**
 * Build evenly-spaced chord cues from a grid, anchored at the first chord's time.
 *
 *   cue[i].time = anchorTime + (beats before chord i) × secondsPerBeat
 *
 * A grid "beat" is one metronome click, so `secondsPerBeat` must be the meter's
 * per-click duration — `TimeSignature.clickInterval(bpm)`, NOT a bare 60/bpm.
 * That is 60/bpm for simple meters (♩ = BPM) but (60/bpm)/3 for compound meters
 * like 6/8 (♩. = BPM) and (60/bpm)/2 for 5/8/7/8. Passing the raw 60/bpm would
 * run compound-meter songs slow. Spacing then matches the grid player exactly.
 *
 * `chords` supplies the names and required length (from the sheet);
 * `beatsPerChord` supplies each chord's duration (from the flattened grid).
 * Assumes a constant tempo extrapolated from the single anchor.
 *
 * Returns [] when secondsPerBeat is non-positive, there are no chords, or the two
 * arrays don't line up — callers must not persist a misaligned map.
 */
export function generateCuesFromGrid(
  chords: string[],
  beatsPerChord: number[],
  anchorTime: number,
  secondsPerBeat: number,
): ChordCue[] {
  if (secondsPerBeat <= 0) return [];
  if (chords.length === 0) return [];
  if (chords.length !== beatsPerChord.length) return [];

  const cues: ChordCue[] = [];
  let beatCursor = 0;
  for (let i = 0; i < chords.length; i++) {
    cues.push({ time: anchorTime + beatCursor * secondsPerBeat, chord: chords[i] });
    beatCursor += beatsPerChord[i];
  }
  return cues;
}
