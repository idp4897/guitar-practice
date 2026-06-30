import { describe, expect, it } from 'vitest';
import {
  chromaAtFret,
  detectTuningType,
  findVoicings,
  getTuning,
  getUniformOffset,
  noteAtFret,
  TUNINGS,
} from '@/domain/music/tuning';
import { Note } from 'tonal';

const STANDARD = TUNINGS.find((t) => t.id === 'standard')!;
const EB       = TUNINGS.find((t) => t.id === 'eb_standard')!;
const DROP_D   = TUNINGS.find((t) => t.id === 'drop_d')!;
const DROP_DB  = TUNINGS.find((t) => t.id === 'drop_db')!;

// ─── getTuning ────────────────────────────────────────────────────────────────

describe('getTuning', () => {
  it('returns the matching tuning by id', () => {
    expect(getTuning('standard').name).toBe('Standard');
    expect(getTuning('drop_d').name).toBe('Drop D');
  });

  it('falls back to Standard for unknown id', () => {
    expect(getTuning('unknown').id).toBe('standard');
    expect(getTuning('').id).toBe('standard');
  });
});

// ─── noteAtFret ───────────────────────────────────────────────────────────────

describe('noteAtFret', () => {
  it('returns the open note at fret 0', () => {
    expect(noteAtFret('E', 0)).toBe('E');
    expect(noteAtFret('A', 0)).toBe('A');
    expect(noteAtFret('Eb', 0)).toBe('Eb');
  });

  it('transposes by fret count (standard tuning)', () => {
    expect(noteAtFret('E', 1)).toBe('F');
    expect(noteAtFret('E', 2)).toBe('F#');
    expect(noteAtFret('E', 3)).toBe('G');
    expect(noteAtFret('E', 5)).toBe('A');
    expect(noteAtFret('E', 12)).toBe('E');  // octave wrap
  });

  it('handles Eb tuning correctly (enharmonic-safe via chroma)', () => {
    // Tonal may return 'Fb' for Eb+1; compare by chroma (pitch class number)
    expect(Note.chroma(noteAtFret('Eb', 1))).toBe(Note.chroma('E'));
    expect(Note.chroma(noteAtFret('Eb', 3))).toBe(Note.chroma('Gb'));
    expect(Note.chroma(noteAtFret('Ab', 2))).toBe(Note.chroma('Bb'));
  });

  it('same shape on Standard vs Eb Standard → notes differ by 1 semitone', () => {
    // Fret 3 on string 6: E+3=G in standard, Eb+3=F# in Eb standard
    const stdNote = noteAtFret('E', 3);
    const ebNote  = noteAtFret('Eb', 3);
    const stdCh   = Note.chroma(stdNote)!;
    const ebCh    = Note.chroma(ebNote)!;
    expect((stdCh - ebCh + 12) % 12).toBe(1); // G is 1 semitone above F#
  });

  it('Drop D: string 6 at fret 0 is D, at fret 2 is E', () => {
    expect(noteAtFret('D', 0)).toBe('D');
    expect(noteAtFret('D', 2)).toBe('E');
    expect(noteAtFret('D', 5)).toBe('G');
  });
});

// ─── chromaAtFret ─────────────────────────────────────────────────────────────

describe('chromaAtFret', () => {
  it('returns correct chroma for standard tuning notes', () => {
    expect(chromaAtFret('E', 0)).toBe(Note.chroma('E'));   // 4
    expect(chromaAtFret('E', 3)).toBe(Note.chroma('G'));   // 7
    expect(chromaAtFret('A', 2)).toBe(Note.chroma('B'));   // 11
  });

  it('Drop D: string 6 open is D (chroma 2)', () => {
    expect(chromaAtFret('D', 0)).toBe(2);
  });
});

// ─── findVoicings ─────────────────────────────────────────────────────────────

describe('findVoicings – standard tuning (tombatossals)', () => {
  it('returns voicings for common chords', () => {
    expect(findVoicings('C', STANDARD).length).toBeGreaterThan(0);
    expect(findVoicings('G', STANDARD).length).toBeGreaterThan(0);
    expect(findVoicings('Am', STANDARD).length).toBeGreaterThan(0);
    expect(findVoicings('Dm', STANDARD).length).toBeGreaterThan(0);
  });

  it('each position has 6 fret values', () => {
    for (const pos of findVoicings('C', STANDARD)) {
      expect(pos.frets).toHaveLength(6);
    }
  });

  it('baseFret is at least 1', () => {
    for (const pos of findVoicings('G', STANDARD)) {
      expect(pos.baseFret).toBeGreaterThanOrEqual(1);
    }
  });

  it('returns [] for an unrecognised chord', () => {
    expect(findVoicings('Xyz', STANDARD)).toHaveLength(0);
  });
});

describe('findVoicings – Eb Standard', () => {
  it('returns voicings for C major in Eb standard', () => {
    const voicings = findVoicings('C', EB);
    expect(voicings.length).toBeGreaterThan(0);
  });

  it('C major in Eb standard uses the same fingering shape as Standard (uniform tuning)', () => {
    const stdPos = findVoicings('C', STANDARD)[0];
    const ebPos  = findVoicings('C', EB)[0];
    // Uniform-offset tuning: player grips identically; sounding pitch shifts uniformly
    expect(ebPos.frets).toEqual(stdPos.frets);
    expect(ebPos.baseFret).toBe(stdPos.baseFret);
  });

  it('Am in Eb standard uses the same fingering shape as Standard', () => {
    const stdPos = findVoicings('Am', STANDARD)[0];
    const ebPos  = findVoicings('Am', EB)[0];
    expect(ebPos.frets).toEqual(stdPos.frets);
  });

  it('each voicing has 6 fret values and baseFret ≥ 1', () => {
    for (const pos of findVoicings('Am', EB)) {
      expect(pos.frets).toHaveLength(6);
      expect(pos.baseFret).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('findVoicings – Drop D', () => {
  it('D major in Drop D uses all 6 strings (string 6 open = D)', () => {
    const voicings = findVoicings('D', DROP_D);
    expect(voicings.length).toBeGreaterThan(0);
    // The first voicing should have string 6 (index 0) played open
    const best = voicings[0];
    expect(best.frets[0]).toBeGreaterThanOrEqual(0); // not muted
  });

  it('D major in Standard tuning has string 6 muted', () => {
    const voicings = findVoicings('D', STANDARD);
    // tombatossals D chord: xx0232, string 6 and 5 muted
    const best = voicings[0];
    expect(best.frets[0]).toBe(-1); // string 6 muted
  });

  it('G major in Drop D is found without throwing', () => {
    expect(() => findVoicings('G', DROP_D)).not.toThrow();
    expect(findVoicings('G', DROP_D).length).toBeGreaterThan(0);
  });
});

describe('findVoicings – Drop C#/Db', () => {
  it('returns voicings for common chords without throwing', () => {
    expect(() => findVoicings('C', DROP_DB)).not.toThrow();
    expect(() => findVoicings('Am', DROP_DB)).not.toThrow();
    expect(() => findVoicings('G', DROP_DB)).not.toThrow();
  });

  it('voicings for D major are found for both Drop D and Drop C#/Db', () => {
    expect(findVoicings('D', DROP_D)[0]).toBeDefined();
    expect(findVoicings('D', DROP_DB)[0]).toBeDefined();
  });
});

// ─── detectTuningType ─────────────────────────────────────────────────────────

describe('detectTuningType', () => {
  it('Standard → uniform (all offsets 0)', () => {
    expect(detectTuningType(STANDARD)).toBe('uniform');
  });

  it('Eb Standard → uniform (all strings −1 semitone)', () => {
    expect(detectTuningType(EB)).toBe('uniform');
  });

  it('Drop D → altered (string 6 is −2, rest are 0)', () => {
    expect(detectTuningType(DROP_D)).toBe('altered');
  });

  it('Drop C#/Db → altered (string 6 is −3, rest are −1)', () => {
    expect(detectTuningType(DROP_DB)).toBe('altered');
  });

  it('custom all-same-offset tuning → uniform', () => {
    const dStd = { id: 'd_standard', name: 'D Standard', strings: ['D', 'G', 'C', 'F', 'A', 'D'] };
    expect(detectTuningType(dStd)).toBe('uniform');
  });
});

// ─── getUniformOffset ─────────────────────────────────────────────────────────

describe('getUniformOffset', () => {
  it('Standard → 0', () => {
    expect(getUniformOffset(STANDARD)).toBe(0);
  });

  it('Eb Standard → −1', () => {
    expect(getUniformOffset(EB)).toBe(-1);
  });

  it('D Standard (custom) → −2', () => {
    const dStd = { id: 'd_standard', name: 'D Standard', strings: ['D', 'G', 'C', 'F', 'A', 'D'] };
    expect(getUniformOffset(dStd)).toBe(-2);
  });
});
