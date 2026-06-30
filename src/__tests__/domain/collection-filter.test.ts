import { describe, expect, it } from 'vitest';
import { filterCollections } from '@/domain/collections/filter';
import type { StoredCollection } from '@/lib/collection-store';

function makeColl(overrides: Partial<StoredCollection>): StoredCollection {
  return {
    id:        overrides.id        ?? '1',
    name:      overrides.name      ?? 'Collection',
    tags:      overrides.tags      ?? [],
    songIds:   overrides.songIds   ?? [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const collections: StoredCollection[] = [
  makeColl({ id: '1', name: 'เพลงเช้า',    tags: ['chill', 'acoustic'],  songIds: ['s1', 's2', 's3'] }),
  makeColl({ id: '2', name: 'เพลง BNK48',  tags: ['japanese', 'pop'],    songIds: ['s1'] }),
  makeColl({ id: '3', name: 'Drop D Riffs', tags: ['drop-d', 'rock'],    songIds: ['s4'] }),
  makeColl({ id: '4', name: 'เพลงโชว์',    tags: ['chill', 'japanese'],  songIds: [] }),
];

// ─── filterCollections ────────────────────────────────────────────────────────

describe('filterCollections', () => {
  it('empty query returns all collections', () => {
    expect(filterCollections(collections, '')).toHaveLength(4);
  });

  it('whitespace-only query returns all', () => {
    expect(filterCollections(collections, '   ')).toHaveLength(4);
  });

  it('matches by collection name (exact, case-insensitive)', () => {
    const result = filterCollections(collections, 'เพลงเช้า');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('matches by collection name (partial)', () => {
    const result = filterCollections(collections, 'drop d');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('matches collection name case-insensitively', () => {
    const result = filterCollections(collections, 'BNK');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('matches by tag (exact)', () => {
    const result = filterCollections(collections, 'chill');
    // collections 1 and 4 have tag 'chill'
    expect(result.map(c => c.id)).toEqual(expect.arrayContaining(['1', '4']));
    expect(result).toHaveLength(2);
  });

  it('matches by tag (partial) — "jap" finds japanese', () => {
    const result = filterCollections(collections, 'jap');
    // collections 2 and 4 have tag 'japanese'
    expect(result.map(c => c.id)).toEqual(expect.arrayContaining(['2', '4']));
    expect(result).toHaveLength(2);
  });

  it('matches by name OR tag (OR logic per collection)', () => {
    // "rock" matches collection 3 by tag; no name match
    const result = filterCollections(collections, 'rock');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('returns empty when nothing matches', () => {
    expect(filterCollections(collections, 'xyznotfound')).toHaveLength(0);
  });

  it('Thai name search works', () => {
    const result = filterCollections(collections, 'โชว์');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('4');
  });

  it('searches against all collections (not just first match)', () => {
    const result = filterCollections(collections, 'เพลง');
    // matches 'เพลงเช้า', 'เพลง BNK48', 'เพลงโชว์'
    expect(result).toHaveLength(3);
  });

  it('empty collections array returns empty', () => {
    expect(filterCollections([], 'anything')).toHaveLength(0);
  });
});
