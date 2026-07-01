import { randomUUID } from 'crypto';
import { getDb, ensureDb } from '@/lib/db';
import {
  type StoredCollection,
  type CreateCollectionInput,
  type UpdateCollectionInput,
  normalizeTag,
} from '@/domain/collections/types';

export type { StoredCollection, CreateCollectionInput, UpdateCollectionInput };
export { normalizeTag };

function normalizeTags(tags: string[] | undefined): string[] {
  return [...new Set((tags ?? []).map(normalizeTag).filter(Boolean))];
}

function stamp(): string {
  return new Date().toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rowToCollection(row: Record<string, any>): Promise<StoredCollection> {
  const songResult = await getDb().execute({
    sql: 'SELECT song_id FROM collection_songs WHERE collection_id = ? ORDER BY position ASC',
    args: [row.id as string],
  });
  return {
    id:          row.id as string,
    name:        row.name as string,
    description: (row.description as string | null) ?? undefined,
    tags:        JSON.parse(row.tags as string) as string[],
    songIds:     songResult.rows.map((r) => r.song_id as string),
    createdAt:   row.created_at as string,
    updatedAt:   row.updated_at as string,
  };
}

export const collectionStore = {
  findAll: async (): Promise<StoredCollection[]> => {
    await ensureDb();
    const result = await getDb().execute('SELECT * FROM collections ORDER BY created_at DESC');
    return Promise.all(result.rows.map(rowToCollection));
  },

  findById: async (id: string): Promise<StoredCollection | undefined> => {
    await ensureDb();
    const result = await getDb().execute({
      sql: 'SELECT * FROM collections WHERE id = ?',
      args: [id],
    });
    if (!result.rows[0]) return undefined;
    return rowToCollection(result.rows[0]);
  },

  create: async (input: CreateCollectionInput): Promise<StoredCollection> => {
    await ensureDb();
    const now  = stamp();
    const coll: StoredCollection = {
      id:          randomUUID(),
      name:        input.name.trim(),
      description: input.description?.trim() || undefined,
      tags:        normalizeTags(input.tags),
      songIds:     [],
      createdAt:   now,
      updatedAt:   now,
    };
    await getDb().execute({
      sql: `INSERT INTO collections (id, name, description, tags, created_at, updated_at)
            VALUES (?,?,?,?,?,?)`,
      args: [coll.id, coll.name, coll.description ?? null, JSON.stringify(coll.tags), coll.createdAt, coll.updatedAt],
    });
    return coll;
  },

  update: async (id: string, input: UpdateCollectionInput): Promise<StoredCollection> => {
    await ensureDb();
    const existing = await collectionStore.findById(id);
    if (!existing) throw new Error(`Collection ${id} not found`);
    const updated: StoredCollection = {
      ...existing,
      name:        input.name !== undefined ? input.name.trim()                  : existing.name,
      description: input.description !== undefined
        ? (input.description.trim() || undefined)
        : existing.description,
      tags:        input.tags !== undefined ? normalizeTags(input.tags) : existing.tags,
      updatedAt:   stamp(),
    };
    await getDb().execute({
      sql: `UPDATE collections SET name = ?, description = ?, tags = ?, updated_at = ? WHERE id = ?`,
      args: [updated.name, updated.description ?? null, JSON.stringify(updated.tags), updated.updatedAt, id],
    });
    return updated;
  },

  delete: async (id: string): Promise<void> => {
    await ensureDb();
    await getDb().execute({ sql: 'DELETE FROM collections WHERE id = ?', args: [id] });
  },

  addSong: async (collectionId: string, songId: string): Promise<StoredCollection> => {
    await ensureDb();
    const existing = await collectionStore.findById(collectionId);
    if (!existing) throw new Error(`Collection ${collectionId} not found`);
    if (existing.songIds.includes(songId)) return existing;
    await getDb().execute({
      sql: 'INSERT OR IGNORE INTO collection_songs (collection_id, song_id, position) VALUES (?,?,?)',
      args: [collectionId, songId, existing.songIds.length],
    });
    await getDb().execute({
      sql: 'UPDATE collections SET updated_at = ? WHERE id = ?',
      args: [stamp(), collectionId],
    });
    return collectionStore.findById(collectionId) as Promise<StoredCollection>;
  },

  removeSong: async (collectionId: string, songId: string): Promise<StoredCollection> => {
    await ensureDb();
    const existing = await collectionStore.findById(collectionId);
    if (!existing) throw new Error(`Collection ${collectionId} not found`);
    await getDb().execute({
      sql: 'DELETE FROM collection_songs WHERE collection_id = ? AND song_id = ?',
      args: [collectionId, songId],
    });
    const remaining = existing.songIds.filter((id) => id !== songId);
    for (let i = 0; i < remaining.length; i++) {
      await getDb().execute({
        sql: 'UPDATE collection_songs SET position = ? WHERE collection_id = ? AND song_id = ?',
        args: [i, collectionId, remaining[i]],
      });
    }
    await getDb().execute({
      sql: 'UPDATE collections SET updated_at = ? WHERE id = ?',
      args: [stamp(), collectionId],
    });
    return collectionStore.findById(collectionId) as Promise<StoredCollection>;
  },

  findBySongId: async (songId: string): Promise<StoredCollection[]> => {
    await ensureDb();
    const result = await getDb().execute({
      sql: `SELECT c.* FROM collections c
            JOIN collection_songs cs ON cs.collection_id = c.id
            WHERE cs.song_id = ?`,
      args: [songId],
    });
    return Promise.all(result.rows.map(rowToCollection));
  },

  getAllTags: async (): Promise<string[]> => {
    await ensureDb();
    const result = await getDb().execute('SELECT tags FROM collections');
    const all = result.rows.flatMap((r) => JSON.parse(r.tags as string) as string[]);
    return [...new Set(all)].sort();
  },
};
