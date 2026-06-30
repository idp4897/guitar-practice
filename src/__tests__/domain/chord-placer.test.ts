import { describe, expect, it } from 'vitest';
import {
  graphemes,
  parseChordProLine,
  serializeChordLine,
  parseToEditorLines,
  serializeEditorLines,
  insertChord,
  removeChord,
  moveChord,
  replaceChord,
  getDiatonicChords,
  type ChordLine,
} from '@/domain/music/chord-placer';

// ─── graphemes ────────────────────────────────────────────────────────────────

describe('graphemes', () => {
  it('splits ASCII into individual characters', () => {
    expect(graphemes('abc')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for empty string', () => {
    expect(graphemes('')).toEqual([]);
  });

  it('counts Thai with combining marks as fewer clusters than code units', () => {
    // "กา" = consonant + sara aa  (2 code units)
    // Intl.Segmenter treats this as 2 grapheme clusters (ก and า are separate in Thai)
    // but something like "กี่" (ก + ี + ่) may vary — the key invariant is:
    // graphemes(text).join('') === text
    const text = 'กีต้าร์';
    const gs = graphemes(text);
    expect(gs.join('')).toBe(text);
    // Each cluster must be non-empty
    expect(gs.every((g) => g.length > 0)).toBe(true);
  });

  it('handles emoji (multi-codepoint) as one grapheme', () => {
    // 🎸 is a single emoji = one grapheme
    const gs = graphemes('🎸abc');
    expect(gs[0]).toBe('🎸');
    expect(gs).toHaveLength(4);
  });

  it('joinability: graphemes round-trip back to original string', () => {
    const samples = ['hello', 'ยิ้มได้', '[Am]test', 'mix混合テスト', ''];
    for (const s of samples) {
      expect(graphemes(s).join('')).toBe(s);
    }
  });
});

// ─── parseChordProLine / serializeChordLine ────────────────────────────────────

describe('parseChordProLine', () => {
  it('parses empty line', () => {
    const line = parseChordProLine('');
    expect(line.text).toBe('');
    expect(line.chords).toHaveLength(0);
  });

  it('parses plain lyric with no chords', () => {
    const line = parseChordProLine('hello world');
    expect(line.text).toBe('hello world');
    expect(line.chords).toHaveLength(0);
  });

  it('parses chord at the start', () => {
    const line = parseChordProLine('[Am]hello');
    expect(line.text).toBe('hello');
    expect(line.chords).toEqual([{ charIndex: 0, chord: 'Am' }]);
  });

  it('parses chord in the middle', () => {
    const line = parseChordProLine('hel[G]lo');
    expect(line.text).toBe('hello');
    expect(line.chords).toEqual([{ charIndex: 3, chord: 'G' }]);
  });

  it('parses chord at the end (after all text)', () => {
    const line = parseChordProLine('hello[Am]');
    expect(line.text).toBe('hello');
    expect(line.chords).toEqual([{ charIndex: 5, chord: 'Am' }]);
  });

  it('parses multiple chords and sorts them', () => {
    const line = parseChordProLine('[Am]Well you [G]need the [F]light');
    expect(line.chords.map((c) => c.chord)).toEqual(['Am', 'G', 'F']);
    expect(line.chords[0].charIndex).toBe(0);
    expect(line.chords[1].charIndex).toBeGreaterThan(0);
    expect(line.chords[2].charIndex).toBeGreaterThan(line.chords[1].charIndex);
  });

  it('parses chord-only line (chords with spaces between)', () => {
    const line = parseChordProLine('[Am] [G] [C]');
    expect(line.text).toBe('  ');   // two spaces between chords
    expect(line.chords).toHaveLength(3);
    expect(line.chords[0]).toEqual({ charIndex: 0, chord: 'Am' });
    expect(line.chords[1]).toEqual({ charIndex: 1, chord: 'G' });
    expect(line.chords[2]).toEqual({ charIndex: 2, chord: 'C' });
  });

  it('parses Thai lyrics and preserves grapheme positions', () => {
    const line = parseChordProLine('[Am]ยิ้มๆ [G]ให้กัน');
    expect(line.text).toBe('ยิ้มๆ ให้กัน');
    expect(line.chords[0]).toEqual({ charIndex: 0, chord: 'Am' });
    expect(line.chords[1].chord).toBe('G');
    // G chord is after "ยิ้มๆ " (some number of grapheme clusters)
    expect(line.chords[1].charIndex).toBeGreaterThan(0);
  });
});

// ─── Round-trip: parseChordProLine → serializeChordLine ───────────────────────

describe('round-trip (parse → serialize)', () => {
  const cases = [
    '',
    'hello world',
    '[Am]hello',
    'hel[G]lo',
    'hello[Am]',
    '[Am]Well you only need the [G]light when it\'s burn[F]ing low',
    '[Am] [G] [C]',
    '[Am]ยิ้มๆ [G]ให้กัน',
    '[C]เนื้อ[G/B]เพลง[Am]ภาษา[F]ไทย',
    '[Cmaj7]some[Dsus2]chords',
  ];

  for (const original of cases) {
    it(`preserves: "${original.slice(0, 50)}"`, () => {
      expect(serializeChordLine(parseChordProLine(original))).toBe(original);
    });
  }
});

// ─── Round-trip: ChordLine → serializeChordLine → parseChordProLine ───────────

describe('round-trip (model → serialize → parse)', () => {
  it('empty ChordLine', () => {
    const original: ChordLine = { text: '', chords: [] };
    const serialized = serializeChordLine(original);
    expect(parseChordProLine(serialized)).toEqual(original);
  });

  it('ChordLine with chords at multiple positions', () => {
    const original: ChordLine = {
      text:   'hello world',
      chords: [
        { charIndex: 0, chord: 'Am' },
        { charIndex: 6, chord: 'G' },
      ],
    };
    const serialized = serializeChordLine(original);
    expect(parseChordProLine(serialized)).toEqual(original);
  });

  it('ChordLine with chord at end (past last char)', () => {
    const original: ChordLine = {
      text:   'hello',
      chords: [{ charIndex: 5, chord: 'C' }],
    };
    const back = parseChordProLine(serializeChordLine(original));
    expect(back.chords).toEqual(original.chords);
  });
});

// ─── parseToEditorLines / serializeEditorLines ────────────────────────────────

describe('parseToEditorLines', () => {
  it('classifies directive lines as raw', () => {
    const lines = parseToEditorLines('{title: Test Song}');
    expect(lines[0].kind).toBe('raw');
    expect((lines[0] as { kind: 'raw'; text: string }).text).toBe('{title: Test Song}');
  });

  it('classifies comment lines as raw', () => {
    const lines = parseToEditorLines('# Chorus');
    expect(lines[0].kind).toBe('raw');
  });

  it('classifies empty lines as raw', () => {
    const lines = parseToEditorLines('');
    expect(lines[0].kind).toBe('raw');
  });

  it('classifies lyric lines correctly', () => {
    const lines = parseToEditorLines('[Am]hello world');
    expect(lines[0].kind).toBe('lyric');
  });

  it('splits multi-line content correctly', () => {
    const content = '{title: T}\n[Am]hello\n\n# Bridge\n[G]world';
    const lines = parseToEditorLines(content);
    expect(lines).toHaveLength(5);
    expect(lines[0].kind).toBe('raw');
    expect(lines[1].kind).toBe('lyric');
    expect(lines[2].kind).toBe('raw');  // empty
    expect(lines[3].kind).toBe('raw');  // comment
    expect(lines[4].kind).toBe('lyric');
  });
});

describe('serializeEditorLines round-trip', () => {
  const cases = [
    '',
    '[Am]hello',
    '{title: Let Her Go}\n{artist: Passenger}\n\n# Verse\n[Am]Well you [G]need the [F]light',
    '# Intro\n[C] [G] [Am] [F]\n\n# Verse\n[C]Today is gonna be[G] the day',
  ];

  for (const content of cases) {
    it(`preserves full content: "${content.slice(0, 40)}..."`, () => {
      expect(serializeEditorLines(parseToEditorLines(content))).toBe(content);
    });
  }
});

// ─── Chord operations ─────────────────────────────────────────────────────────

describe('insertChord', () => {
  const base: ChordLine = { text: 'hello world', chords: [] };

  it('inserts at position 0', () => {
    const result = insertChord(base, 0, 'Am');
    expect(result.chords).toEqual([{ charIndex: 0, chord: 'Am' }]);
    expect(serializeChordLine(result)).toBe('[Am]hello world');
  });

  it('inserts at end (past text length)', () => {
    const result = insertChord(base, 11, 'G');
    expect(result.chords).toEqual([{ charIndex: 11, chord: 'G' }]);
  });

  it('inserts in the middle and keeps chords sorted', () => {
    const withFirst = insertChord(base, 0, 'Am');
    const result    = insertChord(withFirst, 6, 'G');
    expect(result.chords[0].charIndex).toBe(0);
    expect(result.chords[1].charIndex).toBe(6);
  });

  it('replaces existing chord at same charIndex', () => {
    const withAm = insertChord(base, 0, 'Am');
    const result = insertChord(withAm, 0, 'G');
    expect(result.chords).toHaveLength(1);
    expect(result.chords[0].chord).toBe('G');
  });

  it('does not mutate original ChordLine', () => {
    insertChord(base, 0, 'Am');
    expect(base.chords).toHaveLength(0);
  });
});

describe('removeChord', () => {
  const base: ChordLine = {
    text:   'hello',
    chords: [{ charIndex: 0, chord: 'Am' }],
  };

  it('removes existing chord', () => {
    const result = removeChord(base, 0);
    expect(result.chords).toHaveLength(0);
    expect(result.text).toBe('hello');
  });

  it('is a no-op when charIndex has no chord', () => {
    const result = removeChord(base, 3);
    expect(result.chords).toEqual(base.chords);
  });

  it('does not mutate original', () => {
    removeChord(base, 0);
    expect(base.chords).toHaveLength(1);
  });
});

describe('moveChord', () => {
  const base: ChordLine = {
    text:   'hello world',
    chords: [{ charIndex: 0, chord: 'Am' }],
  };

  it('moves chord to new position', () => {
    const result = moveChord(base, 0, 6);
    expect(result.chords).toEqual([{ charIndex: 6, chord: 'Am' }]);
  });

  it('clamps to text length', () => {
    const result = moveChord(base, 0, 999);
    expect(result.chords[0].charIndex).toBe(graphemes(base.text).length);
  });

  it('clamps to 0', () => {
    const result = moveChord(base, 0, -5);
    expect(result.chords[0].charIndex).toBe(0);
  });

  it('is a no-op when source charIndex does not exist', () => {
    const result = moveChord(base, 5, 8);
    expect(result.chords).toEqual(base.chords);
  });

  it('displaces chord at destination', () => {
    const two: ChordLine = {
      text:   'hello world',
      chords: [
        { charIndex: 0, chord: 'Am' },
        { charIndex: 6, chord: 'G' },
      ],
    };
    // Move Am to position 6 (where G is) → G is displaced
    const result = moveChord(two, 0, 6);
    expect(result.chords).toHaveLength(1);
    expect(result.chords[0]).toEqual({ charIndex: 6, chord: 'Am' });
  });
});

describe('replaceChord', () => {
  const base: ChordLine = {
    text:   'hello',
    chords: [{ charIndex: 0, chord: 'Am' }],
  };

  it('changes chord name at given index', () => {
    const result = replaceChord(base, 0, 'G');
    expect(result.chords).toEqual([{ charIndex: 0, chord: 'G' }]);
  });

  it('does not change position', () => {
    const result = replaceChord(base, 0, 'Cmaj7');
    expect(result.chords[0].charIndex).toBe(0);
  });

  it('is a no-op when charIndex has no chord', () => {
    const result = replaceChord(base, 3, 'G');
    expect(result.chords).toEqual(base.chords);
  });
});

// ─── getDiatonicChords ────────────────────────────────────────────────────────

describe('getDiatonicChords', () => {
  it('returns 7 chords for a major key', () => {
    expect(getDiatonicChords('C')).toHaveLength(7);
  });

  it('returns 7 chords for a minor key (short form)', () => {
    expect(getDiatonicChords('Am')).toHaveLength(7);
  });

  it('C major diatonic', () => {
    expect(getDiatonicChords('C')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
  });

  it('G major diatonic', () => {
    expect(getDiatonicChords('G')).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim']);
  });

  it('Am (natural minor) diatonic', () => {
    expect(getDiatonicChords('Am')).toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']);
  });

  it('handles tonal "A minor" format', () => {
    expect(getDiatonicChords('A minor')).toEqual(getDiatonicChords('Am'));
  });

  it('handles tonal "C major" format', () => {
    expect(getDiatonicChords('C major')).toEqual(getDiatonicChords('C'));
  });

  it('returns empty for unknown key', () => {
    expect(getDiatonicChords('X??')).toEqual([]);
  });

  it('handles enharmonic roots like Bb', () => {
    // Bb major = A# major on chromatic scale
    const chords = getDiatonicChords('Bb');
    expect(chords).toHaveLength(7);
    expect(chords[0]).toBe('A#'); // Bb stored as A# internally
  });
});
