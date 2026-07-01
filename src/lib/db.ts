import { createClient, type Client } from '@libsql/client';

let _client: Client | null = null;

export function getDb(): Client {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
  }
  return _client;
}

let _ready: Promise<void> | null = null;

export function ensureDb(): Promise<void> {
  if (!_ready) _ready = initSchema();
  return _ready;
}

async function initSchema(): Promise<void> {
  await getDb().executeMultiple(`
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
