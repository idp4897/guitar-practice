import {
  extractChords,
  formatChordPro,
  parseChordPro,
  transposeSheet,
} from '@/domain/music/chordpro';
import { applyCapo, detectPossibleKeys } from '@/domain/music/theory';
import type { KeyCandidate } from '@/domain/music/types';

export function applyTranspose(content: string, semitones: number): string {
  const sheet = parseChordPro(content);
  return formatChordPro(transposeSheet(sheet, semitones));
}

// Returns ChordPro content with fingering chords for a given capo fret.
// The sounding chords in `content` are transposed down so that placing the
// capo at `capoFret` produces the original sound.
export function getFingeringContent(content: string, capoFret: number): string {
  if (capoFret === 0) return content;
  const sheet = parseChordPro(content);
  const chords = extractChords(sheet);
  const capoSheet = transposeSheet(sheet, -capoFret);
  void chords; // available for caller if needed
  return formatChordPro(capoSheet);
}

export function detectSongKey(content: string): KeyCandidate[] {
  const sheet = parseChordPro(content);
  return detectPossibleKeys(extractChords(sheet));
}

export function getSoundingChords(content: string, capoFret: number): string[] {
  const sheet = parseChordPro(content);
  return applyCapo(extractChords(sheet), -capoFret); // fingering + capo = sounding
}
