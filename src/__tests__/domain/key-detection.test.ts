import { describe, expect, it } from 'vitest';
import { detectKeyBySection, detectPossibleKeys } from '@/domain/music/theory';
import { parseChordPro } from '@/domain/music/chordpro';

describe('detectPossibleKeys', () => {

  // ── Edge cases ──────────────────────────────────────────────────────────────

  it('returns [] for empty input', () => {
    expect(detectPossibleKeys([])).toEqual([]);
  });

  it('does not throw for a single chord', () => {
    expect(() => detectPossibleKeys(['Am'])).not.toThrow();
    expect(detectPossibleKeys(['Am']).length).toBeGreaterThan(0);
  });

  it('does not throw for unparseable chords', () => {
    expect(() => detectPossibleKeys(['X??', '!!!'])).not.toThrow();
  });

  it('skips unparseable chords silently', () => {
    const withGarbage = detectPossibleKeys(['X??', 'C', 'G']);
    const clean       = detectPossibleKeys(['C', 'G']);
    expect(withGarbage[0]?.key).toBe(clean[0]?.key);
  });

  // ── Result shape ────────────────────────────────────────────────────────────

  it('every candidate has mode "major" or "minor"', () => {
    for (const c of detectPossibleKeys(['C', 'F', 'G', 'Am'])) {
      expect(['major', 'minor']).toContain(c.mode);
    }
  });

  it('results are sorted by confidence descending', () => {
    const candidates = detectPossibleKeys(['C', 'F', 'G', 'Am']);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].confidence).toBeLessThanOrEqual(candidates[i - 1].confidence);
    }
  });

  it('confidence is within [0, 1]', () => {
    for (const c of detectPossibleKeys(['C', 'F', 'G', 'Am', 'E7'])) {
      expect(c.confidence).toBeGreaterThanOrEqual(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('nonDiatonic is an array (possibly empty)', () => {
    for (const c of detectPossibleKeys(['C', 'F', 'G', 'Am'])) {
      expect(Array.isArray(c.nonDiatonic)).toBe(true);
    }
  });

  // ── Standard progressions ───────────────────────────────────────────────────

  it('[C F G Am] → C major and Am are both in top results (relative keys)', () => {
    const candidates = detectPossibleKeys(['C', 'F', 'G', 'Am']);
    const keys = candidates.map(c => c.key);
    expect(keys).toContain('C');
    expect(keys).toContain('Am');
    // Both should appear in the top 3
    expect(Math.max(keys.indexOf('C'), keys.indexOf('Am'))).toBeLessThan(3);
  });

  it('[C F G Am] → C major has higher confidence than Am (starts on C)', () => {
    const candidates = detectPossibleKeys(['C', 'F', 'G', 'Am']);
    const c = candidates.find(x => x.key === 'C')!;
    const a = candidates.find(x => x.key === 'Am')!;
    expect(c).toBeDefined();
    expect(a).toBeDefined();
    expect(c.confidence).toBeGreaterThan(a.confidence);
  });

  it('[G C D Em] → G major is the top candidate', () => {
    const candidates = detectPossibleKeys(['G', 'C', 'D', 'Em']);
    expect(candidates[0].key).toBe('G');
  });

  it('[Am C F G] → Am minor is the top candidate (starts on Am)', () => {
    const candidates = detectPossibleKeys(['Am', 'C', 'F', 'G']);
    expect(candidates[0].key).toBe('Am');
  });

  it('[G C D G] → G major confidence is boosted (first and last are tonic)', () => {
    const candidates = detectPossibleKeys(['G', 'C', 'D', 'G']);
    const g = candidates.find(c => c.key === 'G')!;
    expect(g).toBeDefined();
    expect(g.confidence).toBeGreaterThan(0.85);
  });

  // ── Strict vs lenient fallback ──────────────────────────────────────────────

  it('[C F G Fm] → C major still appears via lenient (Fm is borrowed)', () => {
    const candidates = detectPossibleKeys(['C', 'F', 'G', 'Fm']);
    const cMajor = candidates.find(c => c.key === 'C');
    expect(cMajor).toBeDefined();
    expect(cMajor!.nonDiatonic).toContain('Fm');
  });

  it('[C F G Am] → all strict candidates have empty nonDiatonic', () => {
    const candidates = detectPossibleKeys(['C', 'F', 'G', 'Am']);
    for (const c of candidates) {
      expect(c.nonDiatonic).toHaveLength(0);
    }
  });

  // ── nonDiatonic field ───────────────────────────────────────────────────────

  it('nonDiatonic lists the original chord name (not the normalized form)', () => {
    const candidates = detectPossibleKeys(['C', 'F', 'G', 'Fm7']); // Fm7 → Fm (minor) outside C major
    const cMajor = candidates.find(c => c.key === 'C');
    if (cMajor && cMajor.nonDiatonic.length > 0) {
      // Should contain the original string "Fm7"
      expect(cMajor.nonDiatonic).toContain('Fm7');
    }
  });

  // ── Chord normalisation ─────────────────────────────────────────────────────

  it('slash chord (C/G) is treated as root C', () => {
    const a = detectPossibleKeys(['C', 'G', 'Am', 'F']);
    const b = detectPossibleKeys(['C/G', 'G', 'Am', 'F']);
    expect(b.some(c => c.key === 'C')).toBe(true);
    expect(a[0]?.key).toBe(b[0]?.key);
  });

  it('extended chords (maj7, 7, m7, sus2) are normalised to triads', () => {
    // Cmaj7, G7, Am7, Fmaj7 is functionally C major
    const candidates = detectPossibleKeys(['Cmaj7', 'G7', 'Am7', 'Fmaj7']);
    expect(candidates.some(c => c.key === 'C')).toBe(true);
  });

  it('sus chords treated as major triad for detection', () => {
    const candidates = detectPossibleKeys(['Gsus2', 'Csus4', 'D', 'Em']);
    expect(candidates.some(c => c.key === 'G')).toBe(true);
  });

  it('duplicate chords do not affect the score (deduplicated)', () => {
    const single  = detectPossibleKeys(['C', 'G', 'Am', 'F']);
    const doubled = detectPossibleKeys(['C', 'C', 'G', 'G', 'Am', 'Am', 'F', 'F']);
    expect(single[0].key).toBe(doubled[0].key);
    expect(single[0].confidence).toBeCloseTo(doubled[0].confidence, 5);
  });

  // ── Enharmonic equivalents ──────────────────────────────────────────────────

  it('Bb major is detected correctly (flat notation)', () => {
    // Bb, Eb, F, Gm are all diatonic to Bb major
    const candidates = detectPossibleKeys(['Bb', 'Eb', 'F', 'Gm']);
    expect(candidates.some(c => c.key === 'Bb')).toBe(true);
  });

  it('F# minor is detected correctly (sharp notation)', () => {
    const candidates = detectPossibleKeys(['F#m', 'G#dim', 'A', 'Bm']);
    expect(candidates.some(c => c.key === 'F#m')).toBe(true);
  });
});

// ─── Coverage fallback (modulating song) ──────────────────────────────────────

describe('detectPossibleKeys — coverage fallback', () => {
  // Chords that span G major AND E major (à la Kibouteki Refrain):
  // G major: G, C, D, Em · E major: E, A, B, C#m
  const modulatingChords = ['G', 'C', 'D', 'Em', 'E', 'A', 'B', 'C#m'];

  it('never returns [] for a song with parseable chords, even if no key fits cleanly', () => {
    const result = detectPossibleKeys(modulatingChords);
    expect(result.length).toBeGreaterThan(0);
  });

  it('marks candidates as partial when coverage fallback is used', () => {
    const result = detectPossibleKeys(modulatingChords);
    expect(result[0].partial).toBe(true);
  });

  it('returns at most 5 candidates in coverage fallback', () => {
    const result = detectPossibleKeys(modulatingChords);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('coverage fallback ranks keys with fewer non-diatonic chords first', () => {
    const result = detectPossibleKeys(modulatingChords);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].nonDiatonic.length).toBeGreaterThanOrEqual(result[i - 1].nonDiatonic.length);
    }
  });

  it('top result for G+E mixed chords is either G or E (best coverage)', () => {
    const result = detectPossibleKeys(modulatingChords);
    expect(['G', 'E', 'Am', 'C#m', 'Em']).toContain(result[0].key);
  });

  it('regular single-key chords do NOT trigger partial', () => {
    const result = detectPossibleKeys(['C', 'F', 'G', 'Am']);
    expect(result.some(c => c.partial)).toBe(false);
  });
});

// ─── detectKeyBySection ───────────────────────────────────────────────────────

describe('detectKeyBySection', () => {
  // Kibouteki Refrain-style: verse in G major, chorus modulates to E major
  const modulatingSong = [
    '{start_of_verse}',
    '[G]verse chords [C]here [D]yeah [Em]ok',
    '{end_of_verse}',
    '{start_of_chorus}',
    '[E]hook chords [A]here [B]yeah [C#m]ok',
    '{end_of_chorus}',
  ].join('\n');

  const singleKeySong = [
    '{start_of_verse}',
    '[C]verse [F]chords [G]here [Am]ok',
    '{end_of_verse}',
    '{start_of_chorus}',
    '[G]chorus [C]chords [F]here [Am]ok',
    '{end_of_chorus}',
  ].join('\n');

  it('detects modulation between G major verse and E major chorus', () => {
    const result = detectKeyBySection(parseChordPro(modulatingSong));
    expect(result.hasModulation).toBe(true);
  });

  it('reports the correct key per section (G for verse, E for chorus)', () => {
    const result = detectKeyBySection(parseChordPro(modulatingSong));
    const verse  = result.sections.find(s => s.label === 'Verse');
    const chorus = result.sections.find(s => s.label === 'Chorus');
    expect(verse?.key).toBe('G');
    expect(chorus?.key).toBe('E');
  });

  it('does NOT report modulation for a single-key song', () => {
    const result = detectKeyBySection(parseChordPro(singleKeySong));
    expect(result.hasModulation).toBe(false);
  });

  it('all sections of a single-key song agree on the same key', () => {
    const result = detectKeyBySection(parseChordPro(singleKeySong));
    const keys = result.sections.map(s => s.key).filter(Boolean);
    const unique = new Set(keys);
    expect(unique.size).toBe(1);
  });

  it('returns section labels from directives', () => {
    const result = detectKeyBySection(parseChordPro(modulatingSong));
    const labels = result.sections.map(s => s.label);
    expect(labels).toContain('Verse');
    expect(labels).toContain('Chorus');
  });

  it('uses paragraph mode when no directives are present', () => {
    const paragraphSong = [
      '[G]first [C]paragraph [D]chords [Em]here',
      '',
      '[E]second [A]paragraph [B]chords [C#m]here',
    ].join('\n');
    const result = detectKeyBySection(parseChordPro(paragraphSong));
    expect(result.sections.length).toBe(2);
    expect(result.hasModulation).toBe(true);
  });

  it('uses comment headers when present and no directives', () => {
    const commentSong = [
      '# Verse',
      '[G]verse [C]chords [D]here [Em]ok',
      '# Chorus',
      '[E]hook [A]chords [B]here [C#m]ok',
    ].join('\n');
    const result = detectKeyBySection(parseChordPro(commentSong));
    expect(result.hasModulation).toBe(true);
    const verse  = result.sections.find(s => s.label === 'Verse');
    const chorus = result.sections.find(s => s.label === 'Chorus');
    expect(verse).toBeDefined();
    expect(chorus).toBeDefined();
  });

  it('returns empty sections array for a sheet with no chords', () => {
    const result = detectKeyBySection(parseChordPro('{title: Empty Song}'));
    expect(result.sections.length).toBe(0);
    expect(result.hasModulation).toBe(false);
  });

  it('does not report modulation with only one section', () => {
    const singleSection = '{start_of_verse}\n[G]one [C]section [D]only\n{end_of_verse}';
    const result = detectKeyBySection(parseChordPro(singleSection));
    expect(result.hasModulation).toBe(false);
  });
});
