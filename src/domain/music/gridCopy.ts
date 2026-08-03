import type { ChordSection } from './types';

/**
 * True when two sections have an identical chord progression: the same chords,
 * in the same order, with the same count. Beat durations, repeat, and label are
 * ignored — only the chord sequence must match exactly.
 *
 * This is the gate for copying beats between sections: the beat list is applied
 * positionally, so it is only meaningful when the progressions line up 1:1.
 */
export function sectionsShareProgression(a: ChordSection, b: ChordSection): boolean {
  if (a.chords.length !== b.chords.length) return false;
  return a.chords.every((c, i) => c.chord === b.chords[i].chord);
}

/**
 * Return the beats of `source` applied onto `target`, positionally.
 *
 * Only the per-chord beat counts are copied; `target` keeps its own label and
 * repeat. Guarded: if the progressions differ, `target` is returned unchanged so
 * callers can never produce a mismatched beat list.
 */
export function applyBeatsFromSection(source: ChordSection, target: ChordSection): ChordSection {
  if (!sectionsShareProgression(source, target)) return target;
  return {
    ...target,
    chords: target.chords.map((c, i) => ({ ...c, beats: source.chords[i].beats })),
  };
}

/**
 * Indices of the sections whose progression matches the section at `sourceIndex`
 * (the source itself excluded). These are the valid targets for copying beats.
 */
export function matchingSectionIndices(grid: ChordSection[], sourceIndex: number): number[] {
  const source = grid[sourceIndex];
  if (!source) return [];
  return grid
    .map((_, i) => i)
    .filter((i) => i !== sourceIndex && sectionsShareProgression(source, grid[i]));
}

/**
 * Copy the beats of the section at `sourceIndex` into every section in
 * `targetIndices`. Targets that don't share the source's progression are skipped
 * (via {@link applyBeatsFromSection}'s guard), so the result is always safe.
 */
export function copyBeatsToSections(
  grid: ChordSection[],
  sourceIndex: number,
  targetIndices: number[],
): ChordSection[] {
  const source = grid[sourceIndex];
  if (!source) return grid;
  const targets = new Set(targetIndices);
  return grid.map((section, i) =>
    targets.has(i) ? applyBeatsFromSection(source, section) : section,
  );
}
