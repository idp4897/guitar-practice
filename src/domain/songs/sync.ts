import type { StoredSong } from '@/lib/song-store';
import { parseChordPro, extractChords } from '@/domain/music/chordpro';

export type SongSyncStatus = 'unsync' | 'partial' | 'full';

export interface SongSyncInfo {
  status: SongSyncStatus;
  synced: number;
  total:  number;
}

export function getSongSyncInfo(song: StoredSong): SongSyncInfo {
  const total  = extractChords(parseChordPro(song.content)).length;
  const synced = song.chordMap?.length ?? 0;
  const status: SongSyncStatus =
    synced === 0 ? 'unsync' : synced >= total ? 'full' : 'partial';

  return { status, synced, total };
}

export function getUnsyncedSongs(songs: StoredSong[]): StoredSong[] {
  return songs.filter((song) => getSongSyncInfo(song).status !== 'full');
}
