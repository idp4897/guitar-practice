/**
 * One-time migration: reads .data/songs.json + .data/collections.json
 * and inserts them into Turso.
 *
 * Usage:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/migrate-to-turso.ts
 */

import { createClient } from '@libsql/client';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const DATA_DIR    = path.join(process.cwd(), '.data');
const SONGS_FILE  = path.join(DATA_DIR, 'songs.json');
const COLLS_FILE  = path.join(DATA_DIR, 'collections.json');

const turso = createClient({
  url:       process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

interface RawSong {
  id: string; title: string; artist?: string; content: string;
  capo: number; tuning?: string; bpm?: number; youtubeUrl?: string;
  preferredKey?: string; originalKey?: string;
  keys?: unknown; chordMap?: unknown;
  createdAt: string; updatedAt: string;
}

interface RawCollection {
  id: string; name: string; description?: string;
  tags: string[]; songIds: string[];
  createdAt: string; updatedAt: string;
}

async function initSchema(): Promise<void> {
  await turso.executeMultiple(`
    CREATE TABLE IF NOT EXISTS songs (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      artist        TEXT,
      content       TEXT NOT NULL,
      capo          INTEGER NOT NULL DEFAULT 0,
      tuning        TEXT,
      bpm           REAL,
      youtube_url   TEXT,
      preferred_key TEXT,
      original_key  TEXT,
      keys          TEXT,
      chord_map     TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collections (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      tags        TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collection_songs (
      collection_id TEXT NOT NULL,
      song_id       TEXT NOT NULL,
      position      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (collection_id, song_id),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id)       REFERENCES songs(id)       ON DELETE CASCADE
    );
  `);
}

async function migrateSongs(): Promise<void> {
  if (!existsSync(SONGS_FILE)) { console.log('No songs.json found, skipping.'); return; }
  const songs: RawSong[] = JSON.parse(readFileSync(SONGS_FILE, 'utf8'));
  console.log(`Migrating ${songs.length} songs…`);
  for (const s of songs) {
    await turso.execute({
      sql: `INSERT OR IGNORE INTO songs
              (id, title, artist, content, capo, tuning, bpm, youtube_url,
               preferred_key, original_key, keys, chord_map, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        s.id, s.title, s.artist ?? null, s.content, s.capo,
        s.tuning ?? null, s.bpm ?? null, s.youtubeUrl ?? null,
        s.preferredKey ?? null, s.originalKey ?? null,
        s.keys ? JSON.stringify(s.keys) : null,
        s.chordMap ? JSON.stringify(s.chordMap) : null,
        s.createdAt, s.updatedAt,
      ],
    });
    console.log(`  ✓ song: ${s.title}`);
  }
}

async function migrateCollections(): Promise<void> {
  if (!existsSync(COLLS_FILE)) { console.log('No collections.json found, skipping.'); return; }
  const colls: RawCollection[] = JSON.parse(readFileSync(COLLS_FILE, 'utf8'));
  console.log(`Migrating ${colls.length} collections…`);
  for (const c of colls) {
    await turso.execute({
      sql: `INSERT OR IGNORE INTO collections (id, name, description, tags, created_at, updated_at)
            VALUES (?,?,?,?,?,?)`,
      args: [c.id, c.name, c.description ?? null, JSON.stringify(c.tags), c.createdAt, c.updatedAt],
    });
    for (let i = 0; i < c.songIds.length; i++) {
      await turso.execute({
        sql: 'INSERT OR IGNORE INTO collection_songs (collection_id, song_id, position) VALUES (?,?,?)',
        args: [c.id, c.songIds[i], i],
      });
    }
    console.log(`  ✓ collection: ${c.name} (${c.songIds.length} songs)`);
  }
}

async function main(): Promise<void> {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before running.');
    process.exit(1);
  }
  await initSchema();
  await migrateSongs();
  await migrateCollections();
  console.log('\nMigration complete.');
}

main().catch((err) => { console.error(err); process.exit(1); });
