import { describe, expect, it } from 'vitest';
import {
  extractChords,
  formatChordPro,
  NON_CHORD_MARKERS,
  parseChordPro,
  transposeSheet,
} from '@/domain/music/chordpro';
import type { ChordProSheet } from '@/domain/music/types';

const SAMPLE = `{title: Amazing Grace}
{artist: John Newton}
{key: G}

[G]Amazing [G7]grace, how [C]sweet the [G]sound
That [G]saved a [Em]wretch like [D]me`;

describe('parseChordPro', () => {
  it('extracts header metadata', () => {
    const sheet = parseChordPro(SAMPLE);
    expect(sheet.title).toBe('Amazing Grace');
    expect(sheet.artist).toBe('John Newton');
    expect(sheet.key).toBe('G');
  });

  it('parses directive lines', () => {
    const sheet = parseChordPro(SAMPLE);
    const directives = sheet.lines.filter((l) => l.type === 'directive');
    expect(directives).toHaveLength(3);
    expect(directives[0].directiveKey).toBe('title');
    expect(directives[0].directiveValue).toBe('Amazing Grace');
  });

  it('parses empty lines', () => {
    const sheet = parseChordPro(SAMPLE);
    const empty = sheet.lines.filter((l) => l.type === 'empty');
    expect(empty.length).toBeGreaterThan(0);
  });

  it('parses lyric lines with chord tokens', () => {
    const sheet = parseChordPro('[G]Amazing [D]grace');
    const [line] = sheet.lines;
    expect(line.type).toBe('lyric');
    expect(line.tokens).toEqual([
      { chord: 'G', text: 'Amazing ' },
      { chord: 'D', text: 'grace' },
    ]);
  });

  it('parses lyric line with leading text', () => {
    const sheet = parseChordPro('Amazing [G]grace');
    const [line] = sheet.lines;
    expect(line.tokens).toEqual([
      { chord: null, text: 'Amazing ' },
      { chord: 'G', text: 'grace' },
    ]);
  });

  it('parses plain lyric line (no chords)', () => {
    const sheet = parseChordPro('Just lyrics here');
    const [line] = sheet.lines;
    expect(line.type).toBe('lyric');
    expect(line.tokens).toEqual([{ chord: null, text: 'Just lyrics here' }]);
  });

  it('parses comment lines', () => {
    const sheet = parseChordPro('# This is a comment\n[G]verse');
    expect(sheet.lines[0].type).toBe('comment');
    expect(sheet.lines[1].type).toBe('lyric');
  });

  it('handles capo directive', () => {
    const sheet = parseChordPro('{capo: 2}\n[G]hello');
    expect(sheet.capo).toBe(2);
  });
});

describe('formatChordPro', () => {
  it('round-trips parseChordPro → formatChordPro', () => {
    expect(formatChordPro(parseChordPro(SAMPLE))).toBe(SAMPLE);
  });

  it('formats lyric lines with chord annotations', () => {
    const sheet: ChordProSheet = {
      lines: [
        {
          type: 'lyric',
          tokens: [
            { chord: 'G', text: 'Amazing ' },
            { chord: 'D', text: 'grace' },
          ],
        },
      ],
    };
    expect(formatChordPro(sheet)).toBe('[G]Amazing [D]grace');
  });

  it('formats directives', () => {
    const sheet: ChordProSheet = {
      lines: [{ type: 'directive', tokens: [], directiveKey: 'verse', directiveValue: '' }],
    };
    expect(formatChordPro(sheet)).toBe('{verse}');
  });

  it('formats empty lines as blank strings', () => {
    const sheet: ChordProSheet = {
      lines: [{ type: 'empty', tokens: [] }],
    };
    expect(formatChordPro(sheet)).toBe('');
  });
});

describe('extractChords', () => {
  it('extracts all chord names from lyric lines', () => {
    const sheet = parseChordPro(SAMPLE);
    const chords = extractChords(sheet);
    expect(chords).toContain('G');
    expect(chords).toContain('G7');
    expect(chords).toContain('C');
    expect(chords).toContain('Em');
    expect(chords).toContain('D');
  });

  it('does not include null (text-only) tokens', () => {
    const sheet = parseChordPro('Amazing [G]grace');
    expect(extractChords(sheet)).toEqual(['G']);
  });

  it('returns empty array when no chords present', () => {
    const sheet = parseChordPro('{title: My Song}\n\nJust lyrics');
    expect(extractChords(sheet)).toEqual([]);
  });
});

// ─── Non-chord marker tests ───────────────────────────────────────────────────

describe('NON_CHORD_MARKERS', () => {
  it('contains the canonical marker symbols', () => {
    expect(NON_CHORD_MARKERS.has('/')).toBe(true);
    expect(NON_CHORD_MARKERS.has('%')).toBe(true);
    expect(NON_CHORD_MARKERS.has('N.C.')).toBe(true);
  });
});

describe('parseChordPro – marker tokens', () => {
  it('[/] is parsed as a marker token', () => {
    const sheet = parseChordPro('[E] [/] [B/D#]');
    const tokens = sheet.lines[0].tokens;
    const slash = tokens.find((t) => t.chord === '/');
    expect(slash?.marker).toBe(true);
  });

  it('[B/D#] is NOT a marker (slash chord with root)', () => {
    const sheet = parseChordPro('[E] [/] [B/D#]');
    const tokens = sheet.lines[0].tokens;
    const bSlash = tokens.find((t) => t.chord === 'B/D#');
    expect(bSlash?.marker).toBeFalsy();
  });

  it('[C/G] slash chord is not a marker', () => {
    const sheet = parseChordPro('[C/G] [/] [D/F#]');
    const tokens = sheet.lines[0].tokens;
    expect(tokens.find((t) => t.chord === 'C/G')?.marker).toBeFalsy();
    expect(tokens.find((t) => t.chord === 'D/F#')?.marker).toBeFalsy();
    expect(tokens.find((t) => t.chord === '/')?.marker).toBe(true);
  });

  it('[%] and [N.C.] are markers', () => {
    const sheet = parseChordPro('[Am] [%] [N.C.]');
    const tokens = sheet.lines[0].tokens;
    expect(tokens.find((t) => t.chord === '%')?.marker).toBe(true);
    expect(tokens.find((t) => t.chord === 'N.C.')?.marker).toBe(true);
  });

  it('three consecutive markers have all three tokens', () => {
    const sheet = parseChordPro('[/] [/] [/]');
    const tokens = sheet.lines[0].tokens.filter((t) => t.chord != null);
    expect(tokens).toHaveLength(3);
    tokens.forEach((t) => expect(t.marker).toBe(true));
  });
});

describe('extractChords – skips markers', () => {
  it('[E] [/] [B/D#] → analysis chords are [E, B/D#]', () => {
    const sheet = parseChordPro('[E] [/] [B/D#]');
    expect(extractChords(sheet)).toEqual(['E', 'B/D#']);
  });

  it('[/] [/] [/] → analysis chords are []', () => {
    const sheet = parseChordPro('[/] [/] [/]');
    expect(extractChords(sheet)).toEqual([]);
  });

  it('[C/G] [/] [D/F#] → slash chords kept, marker removed', () => {
    const sheet = parseChordPro('[C/G] [/] [D/F#]');
    expect(extractChords(sheet)).toEqual(['C/G', 'D/F#']);
  });

  it('lines without markers are unaffected', () => {
    const sheet = parseChordPro('[Am]words [F]here [C]end [G]song');
    expect(extractChords(sheet)).toEqual(['Am', 'F', 'C', 'G']);
  });
});

describe('transposeSheet – preserves markers', () => {
  it('[/] stays [/] after transposing', () => {
    const sheet = parseChordPro('[E] [/] [B/D#]');
    const transposed = transposeSheet(sheet, 2);
    const tokens = transposed.lines[0].tokens;
    const slash = tokens.find((t) => t.chord === '/');
    expect(slash).toBeDefined();
    expect(slash?.marker).toBe(true);
  });

  it('real chords transpose while markers remain', () => {
    const sheet = parseChordPro('[G] [/] [C]');
    const transposed = transposeSheet(sheet, 2);
    const chords = transposed.lines[0].tokens
      .filter((t) => t.chord != null)
      .map((t) => ({ chord: t.chord, marker: t.marker }));
    expect(chords).toEqual([
      { chord: 'A',  marker: undefined },
      { chord: '/',  marker: true },
      { chord: 'D',  marker: undefined },
    ]);
  });
});

describe('formatChordPro – round-trip with markers', () => {
  it('parse then format preserves [/] exactly', () => {
    const src = '[E] [/] [B/D#]';
    expect(formatChordPro(parseChordPro(src))).toBe(src);
  });

  it('three markers round-trip correctly', () => {
    const src = '[/] [/] [/]';
    expect(formatChordPro(parseChordPro(src))).toBe(src);
  });

  it('[C/G] [/] [D/F#] round-trips', () => {
    const src = '[C/G] [/] [D/F#]';
    expect(formatChordPro(parseChordPro(src))).toBe(src);
  });
});

describe('transposeSheet', () => {
  it('transposes all chord tokens', () => {
    const original = parseChordPro('[G]Amazing [D]grace');
    const transposed = transposeSheet(original, 2);
    expect(transposed.lines[0].tokens).toEqual([
      { chord: 'A', text: 'Amazing ' },
      { chord: 'E', text: 'grace' },
    ]);
  });

  it('updates the key directive', () => {
    const sheet = parseChordPro('{key: G}\n[G]hello');
    const transposed = transposeSheet(sheet, 2);
    expect(transposed.key).toBe('A');
    const keyDirective = transposed.lines.find(
      (l) => l.type === 'directive' && l.directiveKey === 'key',
    );
    expect(keyDirective?.directiveValue).toBe('A');
  });

  it('returns same sheet when semitones is 0', () => {
    const sheet = parseChordPro(SAMPLE);
    expect(transposeSheet(sheet, 0)).toBe(sheet);
  });

  it('round-trips +5 then -5 semitones', () => {
    const sheet = parseChordPro('[G]Amazing [Em]grace');
    const up = transposeSheet(sheet, 5);
    const back = transposeSheet(up, -5);
    expect(formatChordPro(back)).toBe('[G]Amazing [Em]grace');
  });

  it('does not mutate the original sheet', () => {
    const sheet = parseChordPro('[G]Amazing [D]grace');
    transposeSheet(sheet, 2);
    expect(sheet.lines[0].tokens[0].chord).toBe('G');
  });
});
