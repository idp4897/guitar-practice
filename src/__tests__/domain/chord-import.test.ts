import { describe, expect, it } from 'vitest';
import { convertChordOverLyrics, looksLikeChordOverLyrics } from '@/domain/music/chord-import';
import { extractChords, parseChordPro } from '@/domain/music/chordpro';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Ultimate Guitar style: bracketed sections, capo line, tab block, x2 hints. */
const UG_PASTE = `Capo 2

[Intro]
Am  G  F  F

[Verse 1]
Am       G                                 F
Well you only need the light when it's burning low
Am            G           C
Only miss the sun when it starts to snow

[Chorus]
F             C        G
Only know you love her when you let her go`;

/** Thai chord site style: parenthesised sections, tab rows, INTRO in caps. */
const THAI_PASTE = `คาโป้ 3

INTRO
| C | G/B | Am | F |

e|-----0-----0-----|
B|---1---1---1-----|
G|-0-----0-----0---|

ท่อน 1
   C       G/B
   ฉันยังคงรอเธออยู่
   Am     F
   ไม่ว่านานเท่าไหร่

(ฮุค)
F        G    C
รักเธอเสมอไม่เคยเปลี่ยน`;

/** Colon-suffixed sections + mid-word chord placement. */
const COLON_PASTE = `Verse 1:
Am       G
Somebody once told me

Pre-Chorus:
    F   C
    the world is gonna roll me`;

// ─── Core conversion ──────────────────────────────────────────────────────────

describe('convertChordOverLyrics — chord/lyric merge', () => {
  it('places chords at their source column', () => {
    const { content } = convertChordOverLyrics(
      'Am       G         F\n' +
      "Well you only need the light when it's burning low",
    );
    expect(content).toBe("[Am]Well you [G]only need [F]the light when it's burning low");
  });

  it('preserves mid-word placement', () => {
    const { content } = convertChordOverLyrics(
      'Am                  F\n' +
      "Well you only need the light",
    );
    expect(content).toBe('[Am]Well you only need t[F]he light');
  });

  it('keeps a chord line standalone when no lyric follows', () => {
    const { content } = convertChordOverLyrics('Am  G  F  F\n\nAm  G');
    expect(content).toBe('[Am] [G] [F] [F]\n\n[Am] [G]');
  });

  it('does not merge a chord line into the next chord line', () => {
    const { content } = convertChordOverLyrics('Am  G\nF   C');
    expect(content).toBe('[Am] [G]\n[F] [C]');
  });

  it('clamps chords that overrun the lyric line', () => {
    const { content } = convertChordOverLyrics('C          G      Am\nshort line');
    expect(content).toBe('[C]short line[G][Am]');
  });

  it('leaves plain lyric lines untouched', () => {
    const { content } = convertChordOverLyrics('just some lyrics here\nand more lyrics');
    expect(content).toBe('just some lyrics here\nand more lyrics');
  });

  it('is idempotent — converting ChordPro output is a no-op', () => {
    const once  = convertChordOverLyrics(UG_PASTE).content;
    const twice = convertChordOverLyrics(once).content;
    expect(twice).toBe(once);
  });

  it('output parses back into the same chords', () => {
    const { content } = convertChordOverLyrics(UG_PASTE);
    expect(extractChords(parseChordPro(content))).toEqual([
      'Am', 'G', 'F', 'F',
      'Am', 'G', 'F',
      'Am', 'G', 'C',
      'F', 'C', 'G',
    ]);
  });
});

// ─── Chord line detection ─────────────────────────────────────────────────────

describe('convertChordOverLyrics — chord line detection', () => {
  it('accepts slash chords, extensions and bar lines', () => {
    const { content } = convertChordOverLyrics('| C | G/B | Am7 | Fmaj7 |');
    expect(content).toBe('[C] [G/B] [Am7] [Fmaj7]');
  });

  it('keeps repeat hints as plain text', () => {
    const { content } = convertChordOverLyrics('Am  G  F  x2');
    expect(content).toBe('[Am] [G] [F] x2');
  });

  it('keeps non-chord markers bracketed', () => {
    const { content } = convertChordOverLyrics('Am  /  N.C.  G');
    expect(content).toBe('[Am] [/] [N.C.] [G]');
  });

  it('rejects a line where one token is not a chord', () => {
    const { content } = convertChordOverLyrics('Am G Bad F');
    expect(content).toBe('Am G Bad F');
  });

  it('rejects lyric lines that merely start with a chord letter', () => {
    const { content } = convertChordOverLyrics('A day in the life');
    expect(content).toBe('A day in the life');
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

describe('convertChordOverLyrics — cleanup', () => {
  it('converts [Verse 1] to a comment directive', () => {
    const { content, stats } = convertChordOverLyrics('[Verse 1]\nAm  G');
    expect(content).toBe('{c: Verse 1}\n[Am] [G]');
    expect(stats.sections).toBe(1);
  });

  it('converts colon and bare section headers', () => {
    const { content } = convertChordOverLyrics('Verse 1:\nAm\n\nChorus\nG');
    expect(content).toBe('{c: Verse 1}\n[Am]\n\n{c: Chorus}\n[G]');
  });

  it('does not treat [Am] as a section header', () => {
    const { content, stats } = convertChordOverLyrics('[Am]hello there');
    expect(content).toBe('[Am]hello there');
    expect(stats.sections).toBe(0);
  });

  it('does not treat a parenthesised lyric as a section header', () => {
    const { content } = convertChordOverLyrics('(and I know you feel it too)');
    expect(content).toBe('(and I know you feel it too)');
  });

  it('drops tablature rows', () => {
    const { content, stats } = convertChordOverLyrics(
      'e|---0---3---|\nB|---1---0---|\nAm  G',
    );
    expect(content).toBe('[Am] [G]');
    expect(stats.tabLinesRemoved).toBe(2);
  });

  it('extracts the capo line and removes it', () => {
    const { content, capo } = convertChordOverLyrics('Capo 2\n\nAm  G');
    expect(capo).toBe(2);
    expect(content).toBe('[Am] [G]');
  });

  it('extracts a Thai capo line', () => {
    expect(convertChordOverLyrics('คาโป้ 3\nAm').capo).toBe(3);
  });

  it('collapses runs of blank lines', () => {
    const { content } = convertChordOverLyrics('Am\n\n\n\nG');
    expect(content).toBe('[Am]\n\n[G]');
  });

  it('expands tabs so column alignment survives', () => {
    const { content } = convertChordOverLyrics('Am\tG\nAmazing grace how sweet');
    expect(content).toBe('[Am]Amazing [G]grace how sweet');
  });
});

// ─── Full paste fixtures ──────────────────────────────────────────────────────

describe('convertChordOverLyrics — realistic pastes', () => {
  it('converts an Ultimate Guitar paste', () => {
    const { content, capo, stats } = convertChordOverLyrics(UG_PASTE);

    expect(capo).toBe(2);
    expect(stats.sections).toBe(3);
    expect(content).toBe(
`{c: Intro}
[Am] [G] [F] [F]

{c: Verse 1}
[Am]Well you [G]only need the light when it's burn[F]ing low
[Am]Only miss the [G]sun when it [C]starts to snow

{c: Chorus}
[F]Only know you [C]love her [G]when you let her go`,
    );
  });

  it('converts a Thai chord site paste', () => {
    const { content, capo, stats } = convertChordOverLyrics(THAI_PASTE);

    expect(capo).toBe(3);
    expect(stats.tabLinesRemoved).toBe(3);
    expect(content).toBe(
`{c: INTRO}
[C] [G/B] [Am] [F]

{c: ท่อน 1}
   [C]ฉันยังคงรอ[G/B]เธออยู่
   [Am]ไม่ว่านาน[F]เท่าไหร่

{c: ฮุค}
[F]รักเธอเสมอ[G]ไม่เคย[C]เปลี่ยน`,
    );
  });

  it('converts a colon-header paste with indented chord rows', () => {
    const { content } = convertChordOverLyrics(COLON_PASTE);
    expect(content).toBe(
`{c: Verse 1}
[Am]Somebody [G]once told me

{c: Pre-Chorus}
    [F]the [C]world is gonna roll me`,
    );
  });
});

// ─── looksLikeChordOverLyrics ─────────────────────────────────────────────────

describe('looksLikeChordOverLyrics', () => {
  it('detects a chord-over-lyrics paste', () => {
    expect(looksLikeChordOverLyrics(UG_PASTE)).toBe(true);
    expect(looksLikeChordOverLyrics(THAI_PASTE)).toBe(true);
  });

  it('rejects text that is already ChordPro', () => {
    expect(looksLikeChordOverLyrics('[Am]Well you only need the [G]light')).toBe(false);
  });

  it('rejects plain lyrics', () => {
    expect(looksLikeChordOverLyrics('just some lyrics\nwith no chords')).toBe(false);
  });

  it('rejects empty input', () => {
    expect(looksLikeChordOverLyrics('')).toBe(false);
  });
});
