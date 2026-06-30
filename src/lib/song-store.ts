import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import type { ChordCue, SongKey } from '@/domain/music/types';

const DATA_DIR  = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'songs.json');

export interface StoredSong {
  id:           string;
  title:        string;
  artist?:      string;
  originalKey?: string;
  preferredKey?: string;
  capo:         number;
  tuning?:      string;   // tuning id, e.g. 'standard' | 'eb_standard' | 'drop_d' | 'drop_db'
  content:      string;
  bpm?:         number;
  keys?:        SongKey[];   // ordered key tags, e.g. [{key:'G',mode:'major',label:'Verse'}, ...]
  youtubeUrl?:  string;
  chordMap?:    ChordCue[];
  createdAt:    string;
  updatedAt:    string;
}

export type CreateSongInput = Omit<StoredSong, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateSongInput = Partial<CreateSongInput>;

function read(): StoredSong[] {
  if (!existsSync(STORE_FILE)) return [];
  try {
    return JSON.parse(readFileSync(STORE_FILE, 'utf8')) as StoredSong[];
  } catch {
    return [];
  }
}

function write(songs: StoredSong[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(songs, null, 2));
}

export const songStore = {
  findAll: (): StoredSong[] => read(),

  findById: (id: string): StoredSong | undefined =>
    read().find((s) => s.id === id),

  create: (input: CreateSongInput): StoredSong => {
    const songs = read();
    const song: StoredSong = {
      ...input,
      id:        randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    write([...songs, song]);
    return song;
  },

  update: (id: string, input: UpdateSongInput): StoredSong => {
    const songs = read();
    const idx   = songs.findIndex((s) => s.id === id);
    if (idx < 0) throw new Error(`Song ${id} not found`);
    const updated: StoredSong = {
      ...songs[idx],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    songs[idx] = updated;
    write(songs);
    return updated;
  },

  delete: (id: string): void => {
    write(read().filter((s) => s.id !== id));
  },
};
