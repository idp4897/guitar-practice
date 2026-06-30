import { describe, expect, it } from 'vitest';
import { filterSongs } from '@/domain/songs/filter';
import type { StoredSong } from '@/lib/song-store';

function makeSong(overrides: Partial<StoredSong>): StoredSong {
  return {
    id:        overrides.id        ?? '1',
    title:     overrides.title     ?? 'Untitled',
    artist:    overrides.artist,
    tuning:    overrides.tuning,
    capo:      overrides.capo      ?? 0,
    content:   overrides.content   ?? '',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

const songs: StoredSong[] = [
  makeSong({ id: '1', title: 'Kibouteki Refrain', artist: 'BNK48',    tuning: undefined }),
  makeSong({ id: '2', title: 'Aitakatta',         artist: 'AKB48',    tuning: 'eb_standard' }),
  makeSong({ id: '3', title: 'เพลงไทย',          artist: 'บีเอ็นเค', tuning: 'standard' }),
  makeSong({ id: '4', title: 'Drop D Song',       artist: 'Band',     tuning: 'drop_d' }),
];

// ─── filterSongs: search ─────────────────────────────────────────────────────

describe('filterSongs — search', () => {
  it('empty query returns all songs', () => {
    expect(filterSongs(songs, { query: '', tuningId: null })).toHaveLength(4);
  });

  it('matches by title substring (case-insensitive)', () => {
    const result = filterSongs(songs, { query: 'kibouteki', tuningId: null });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('matches by artist substring (case-insensitive)', () => {
    const result = filterSongs(songs, { query: 'bnk48', tuningId: null });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('matches Thai artist name', () => {
    const result = filterSongs(songs, { query: 'บีเอ็นเค', tuningId: null });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('matches partial title (case-insensitive)', () => {
    const result = filterSongs(songs, { query: 'refrain', tuningId: null });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty when no match', () => {
    expect(filterSongs(songs, { query: 'xyznotfound', tuningId: null })).toHaveLength(0);
  });

  it('whitespace-only query returns all', () => {
    expect(filterSongs(songs, { query: '   ', tuningId: null })).toHaveLength(4);
  });
});

// ─── filterSongs: tuning ──────────────────────────────────────────────────────

describe('filterSongs — tuning', () => {
  it('null tuningId returns all songs', () => {
    expect(filterSongs(songs, { query: '', tuningId: null })).toHaveLength(4);
  });

  it('standard tuning includes songs with no tuning stored (default is standard)', () => {
    const result = filterSongs(songs, { query: '', tuningId: 'standard' });
    // song 1 (tuning: undefined → treated as 'standard') and song 3 (tuning: 'standard')
    expect(result.map(s => s.id)).toEqual(expect.arrayContaining(['1', '3']));
    expect(result).toHaveLength(2);
  });

  it('eb_standard returns only matching songs', () => {
    const result = filterSongs(songs, { query: '', tuningId: 'eb_standard' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('drop_d returns only matching songs', () => {
    const result = filterSongs(songs, { query: '', tuningId: 'drop_d' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('4');
  });

  it('tuning with no matching songs returns empty', () => {
    expect(filterSongs(songs, { query: '', tuningId: 'drop_db' })).toHaveLength(0);
  });
});

// ─── filterSongs: combined (AND) ─────────────────────────────────────────────

describe('filterSongs — combined', () => {
  it('search + tuning narrow result with AND logic', () => {
    // song 3 matches Thai artist AND standard tuning
    const result = filterSongs(songs, { query: 'บีเอ็นเค', tuningId: 'standard' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('search match but wrong tuning → empty', () => {
    // song 1 matches "kibouteki" but is standard tuning; ask for eb_standard
    const result = filterSongs(songs, { query: 'kibouteki', tuningId: 'eb_standard' });
    expect(result).toHaveLength(0);
  });

  it('correct tuning but no text match → empty', () => {
    const result = filterSongs(songs, { query: 'nothing', tuningId: 'standard' });
    expect(result).toHaveLength(0);
  });
});
