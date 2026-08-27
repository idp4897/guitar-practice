import { describe, expect, it } from 'vitest';
import {
  CHORD_CATALOGUE,
  categorize,
  parseQuery,
  searchChords,
} from '@/domain/music/chord-search';
import { findVoicings, getTuning } from '@/domain/music/tuning';

const names = (entries: { name: string }[]) => entries.map((e) => e.name);

describe('CHORD_CATALOGUE', () => {
  it('covers all 12 roots', () => {
    expect(new Set(CHORD_CATALOGUE.map((e) => e.rootChroma)).size).toBe(12);
  });

  it('renders major and minor with guitarist shorthand', () => {
    const all = names(CHORD_CATALOGUE);
    expect(all).toContain('C');
    expect(all).toContain('Am');
    expect(all).not.toContain('Cmajor');
    expect(all).not.toContain('Aminor');
  });

  it('every catalogue name resolves to at least one voicing', () => {
    const standard = getTuning('standard');
    const unresolved = CHORD_CATALOGUE.filter((e) => findVoicings(e.name, standard).length === 0);
    expect(unresolved).toEqual([]);
  });
});

describe('categorize', () => {
  it('classifies by suffix family', () => {
    expect(categorize('major')).toBe('major');
    expect(categorize('maj7')).toBe('major');
    expect(categorize('add9')).toBe('major');
    expect(categorize('minor')).toBe('minor');
    expect(categorize('m7b5')).toBe('minor');
    expect(categorize('mmaj7')).toBe('minor');
    expect(categorize('7')).toBe('dominant');
    expect(categorize('9#11')).toBe('dominant');
    expect(categorize('sus4')).toBe('suspended');
    expect(categorize('7sus4')).toBe('suspended');
    expect(categorize('dim7')).toBe('altered');
    expect(categorize('aug')).toBe('altered');
    expect(categorize('/E')).toBe('slash');
    expect(categorize('m/B')).toBe('slash');
  });
});

describe('parseQuery', () => {
  it('splits a root from its suffix', () => {
    expect(parseQuery('Am7')).toEqual({ rootChroma: 9, suffix: 'm7' });
    expect(parseQuery('F#')).toEqual({ rootChroma: 6, suffix: '' });
    expect(parseQuery('  bb9 ')).toEqual({ rootChroma: 10, suffix: '9' });
  });

  it('accepts a bare suffix with no root', () => {
    expect(parseQuery('sus4')).toEqual({ rootChroma: null, suffix: 'sus4' });
    expect(parseQuery('')).toEqual({ rootChroma: null, suffix: '' });
  });

  it('normalizes unicode accidentals', () => {
    expect(parseQuery('E♭m').rootChroma).toBe(3);
    expect(parseQuery('C♯').rootChroma).toBe(1);
  });

  it('expands common spellings', () => {
    expect(parseQuery('CM7').suffix).toBe('maj7');
    expect(parseQuery('Cmin').suffix).toBe('m');
    expect(parseQuery('C+').suffix).toBe('aug');
  });
});

describe('searchChords', () => {
  const search = (query: string) => names(searchChords({ query, category: null }));

  it('puts the exact match first', () => {
    expect(search('Am')[0]).toBe('Am');
    expect(search('C')[0]).toBe('C');
    expect(search('G7')[0]).toBe('G7');
  });

  it('matches the root enharmonically', () => {
    const db = searchChords({ query: 'Db', category: null });
    expect(db.length).toBeGreaterThan(0);
    expect(db.every((e) => e.rootChroma === 1)).toBe(true);
  });

  it('ranks prefix matches ahead of substring matches', () => {
    const results = search('Am');
    expect(results.indexOf('Am7')).toBeLessThan(results.indexOf('Amaj7'));
  });

  it('finds every root when only a suffix is typed', () => {
    const sus = searchChords({ query: 'sus4', category: null });
    expect(new Set(sus.map((e) => e.rootChroma)).size).toBe(12);
    expect(sus.every((e) => e.name.includes('sus4'))).toBe(true);
  });

  it('returns the whole catalogue for an empty query', () => {
    expect(searchChords({ query: '', category: null })).toHaveLength(CHORD_CATALOGUE.length);
  });

  it('sorts plain triads first for an empty query', () => {
    expect(searchChords({ query: '', category: null })[0].suffix).toBe('major');
  });

  it('filters by category', () => {
    const minors = searchChords({ query: '', category: 'minor' });
    expect(minors.length).toBeGreaterThan(0);
    expect(minors.every((e) => e.category === 'minor')).toBe(true);
  });

  it('combines a root query with a category filter', () => {
    const results = searchChords({ query: 'C', category: 'slash' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((e) => e.rootChroma === 0 && e.name.includes('/'))).toBe(true);
  });

  it('does not let a leading note letter swallow the suffix', () => {
    // "dim" begins with D and "add9" with A — neither may be read as a root.
    const dim = searchChords({ query: 'dim', category: null });
    expect(new Set(dim.map((e) => e.rootChroma)).size).toBe(12);
    expect(dim.every((e) => e.name.includes('dim'))).toBe(true);
    const add9 = searchChords({ query: 'add9', category: null });
    expect(new Set(add9.map((e) => e.rootChroma)).size).toBe(12);
    expect(add9.every((e) => e.name.includes('add9'))).toBe(true);
  });

  it('keeps a bare root from leaking same-lettered suffixes', () => {
    // "A" must not drag in every add9/aug chord in other keys.
    const a = searchChords({ query: 'A', category: null });
    expect(a.every((e) => e.rootChroma === 9)).toBe(true);
  });

  it('returns nothing for an unknown suffix', () => {
    expect(search('Cwobble')).toEqual([]);
  });
});
