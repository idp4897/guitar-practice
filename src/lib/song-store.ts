import { randomUUID } from 'crypto';
import { turso, initDb } from '@/lib/db';
import type { ChordCue, SongKey } from '@/domain/music/types';

export interface StoredSong {
  id:            string;
  title:         string;
  artist?:       string;
  originalKey?:  string;
  preferredKey?: string;
  capo:          number;
  tuning?:       string;
  content:       string;
  bpm?:          number;
  keys?:         SongKey[];
  youtubeUrl?:   string;
  chordMap?:     ChordCue[];
  createdAt:     string;
  updatedAt:     string;
}

export type CreateSongInput = Omit<StoredSong, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateSongInput = Partial<CreateSongInput>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSong(row: Record<string, any>): StoredSong {
  return {
    id:            row.id as string,
    title:         row.title as string,
    artist:        (row.artist as string | null) ?? undefined,
    originalKey:   (row.original_key as string | null) ?? undefined,
    preferredKey:  (row.preferred_key as string | null) ?? undefined,
    capo:          row.capo as number,
    tuning:        (row.tuning as string | null) ?? undefined,
    content:       row.content as string,
    bpm:           (row.bpm as number | null) ?? undefined,
    keys:          row.keys ? (JSON.parse(row.keys as string) as SongKey[]) : undefined,
    youtubeUrl:    (row.youtube_url as string | null) ?? undefined,
    chordMap:      row.chord_map ? (JSON.parse(row.chord_map as string) as ChordCue[]) : undefined,
    createdAt:     row.created_at as string,
    updatedAt:     row.updated_at as string,
  };
}

let dbReady: Promise<void> | null = null;
function ensureDb(): Promise<void> {
  if (!dbReady) dbReady = initDb();
  return dbReady;
}

export const songStore = {
  findAll: async (): Promise<StoredSong[]> => {
    await ensureDb();
    const result = await turso.execute('SELECT * FROM songs ORDER BY created_at DESC');
    return result.rows.map(rowToSong);
  },

  findById: async (id: string): Promise<StoredSong | undefined> => {
    await ensureDb();
    const result = await turso.execute({
      sql: 'SELECT * FROM songs WHERE id = ?',
      args: [id],
    });
    return result.rows[0] ? rowToSong(result.rows[0]) : undefined;
  },

  create: async (input: CreateSongInput): Promise<StoredSong> => {
    await ensureDb();
    const now  = new Date().toISOString();
    const song: StoredSong = {
      ...input,
      id:        randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await turso.execute({
      sql: `INSERT INTO songs
              (id, title, artist, content, capo, tuning, bpm, youtube_url,
               preferred_key, original_key, keys, chord_map, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        song.id,
        song.title,
        song.artist ?? null,
        song.content,
        song.capo,
        song.tuning ?? null,
        song.bpm ?? null,
        song.youtubeUrl ?? null,
        song.preferredKey ?? null,
        song.originalKey ?? null,
        song.keys ? JSON.stringify(song.keys) : null,
        song.chordMap ? JSON.stringify(song.chordMap) : null,
        song.createdAt,
        song.updatedAt,
      ],
    });
    return song;
  },

  update: async (id: string, input: UpdateSongInput): Promise<StoredSong> => {
    await ensureDb();
    const existing = await songStore.findById(id);
    if (!existing) throw new Error(`Song ${id} not found`);
    const updated: StoredSong = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    await turso.execute({
      sql: `UPDATE songs SET
              title         = ?,
              artist        = ?,
              content       = ?,
              capo          = ?,
              tuning        = ?,
              bpm           = ?,
              youtube_url   = ?,
              preferred_key = ?,
              original_key  = ?,
              keys          = ?,
              chord_map     = ?,
              updated_at    = ?
            WHERE id = ?`,
      args: [
        updated.title,
        updated.artist ?? null,
        updated.content,
        updated.capo,
        updated.tuning ?? null,
        updated.bpm ?? null,
        updated.youtubeUrl ?? null,
        updated.preferredKey ?? null,
        updated.originalKey ?? null,
        updated.keys ? JSON.stringify(updated.keys) : null,
        updated.chordMap ? JSON.stringify(updated.chordMap) : null,
        updated.updatedAt,
        id,
      ],
    });
    return updated;
  },

  delete: async (id: string): Promise<void> => {
    await ensureDb();
    await turso.execute({ sql: 'DELETE FROM songs WHERE id = ?', args: [id] });
  },
};
