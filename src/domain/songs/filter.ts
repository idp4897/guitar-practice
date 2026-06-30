import type { StoredSong } from '@/lib/song-store';

export interface SongFilterParams {
  query:    string;
  tuningId: string | null; // null = all tunings
}

export function filterSongs(songs: StoredSong[], params: SongFilterParams): StoredSong[] {
  const { query, tuningId } = params;
  const trimmed = query.trim().normalize('NFC').toLowerCase();

  return songs.filter((song) => {
    // Tuning filter — songs with no tuning stored are treated as 'standard'
    if (tuningId) {
      const songTuning = song.tuning ?? 'standard';
      if (songTuning !== tuningId) return false;
    }

    // Text search — empty query matches all
    if (!trimmed) return true;
    const title  = song.title.normalize('NFC').toLowerCase();
    const artist = (song.artist ?? '').normalize('NFC').toLowerCase();
    return title.includes(trimmed) || artist.includes(trimmed);
  });
}
