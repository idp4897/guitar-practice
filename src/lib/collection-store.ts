import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const DATA_DIR  = path.join(process.cwd(), '.data');
const COLL_FILE = path.join(DATA_DIR, 'collections.json');

export interface StoredCollection {
  id:           string;
  name:         string;
  description?: string;
  tags:         string[];   // normalized: lowercase, trimmed, deduplicated
  songIds:      string[];   // ordered; many-to-many as embedded array
  createdAt:    string;
  updatedAt:    string;
}

export interface CreateCollectionInput {
  name:         string;
  description?: string;
  tags?:        string[];
}

export type UpdateCollectionInput = Partial<CreateCollectionInput>;

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function read(): StoredCollection[] {
  if (!existsSync(COLL_FILE)) return [];
  try {
    return JSON.parse(readFileSync(COLL_FILE, 'utf8')) as StoredCollection[];
  } catch {
    return [];
  }
}

function write(colls: StoredCollection[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(COLL_FILE, JSON.stringify(colls, null, 2));
}

function stamp(): string {
  return new Date().toISOString();
}

function normalizeTags(tags: string[] | undefined): string[] {
  return [...new Set((tags ?? []).map(normalizeTag).filter(Boolean))];
}

export const collectionStore = {
  findAll: (): StoredCollection[] => read(),

  findById: (id: string): StoredCollection | undefined =>
    read().find((c) => c.id === id),

  create: (input: CreateCollectionInput): StoredCollection => {
    const colls = read();
    const now   = stamp();
    const coll: StoredCollection = {
      id:          randomUUID(),
      name:        input.name.trim(),
      description: input.description?.trim() || undefined,
      tags:        normalizeTags(input.tags),
      songIds:     [],
      createdAt:   now,
      updatedAt:   now,
    };
    write([...colls, coll]);
    return coll;
  },

  update: (id: string, input: UpdateCollectionInput): StoredCollection => {
    const colls = read();
    const idx   = colls.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error(`Collection ${id} not found`);
    const prev    = colls[idx];
    const updated: StoredCollection = {
      ...prev,
      name:        input.name !== undefined ? input.name.trim()                  : prev.name,
      description: input.description !== undefined
        ? (input.description.trim() || undefined)
        : prev.description,
      tags:        input.tags !== undefined ? normalizeTags(input.tags) : prev.tags,
      updatedAt:   stamp(),
    };
    colls[idx] = updated;
    write(colls);
    return updated;
  },

  delete: (id: string): void => {
    write(read().filter((c) => c.id !== id));
  },

  addSong: (collectionId: string, songId: string): StoredCollection => {
    const colls = read();
    const idx   = colls.findIndex((c) => c.id === collectionId);
    if (idx < 0) throw new Error(`Collection ${collectionId} not found`);
    if (colls[idx].songIds.includes(songId)) return colls[idx];
    colls[idx] = {
      ...colls[idx],
      songIds:   [...colls[idx].songIds, songId],
      updatedAt: stamp(),
    };
    write(colls);
    return colls[idx];
  },

  removeSong: (collectionId: string, songId: string): StoredCollection => {
    const colls = read();
    const idx   = colls.findIndex((c) => c.id === collectionId);
    if (idx < 0) throw new Error(`Collection ${collectionId} not found`);
    colls[idx] = {
      ...colls[idx],
      songIds:   colls[idx].songIds.filter((id) => id !== songId),
      updatedAt: stamp(),
    };
    write(colls);
    return colls[idx];
  },

  findBySongId: (songId: string): StoredCollection[] =>
    read().filter((c) => c.songIds.includes(songId)),

  getAllTags: (): string[] => {
    const all = read().flatMap((c) => c.tags);
    return [...new Set(all)].sort();
  },
};
