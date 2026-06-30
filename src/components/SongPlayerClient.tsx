'use client';

import { useCallback } from 'react';
import { parseChordPro } from '@/domain/music/chordpro';
import { parseSongKey } from '@/domain/music/theory';
import { savePlaybackAction } from '@/application/songs/song.actions';
import { AppLayout } from './AppLayout';
import { PlayerPage } from './PlayerPage';
import type { StoredSong } from '@/lib/song-store';
import type { ChordCue } from '@/domain/music/types';

interface SongPlayerClientProps {
  song:  StoredSong;
  songs: StoredSong[];
}

export function SongPlayerClient({ song, songs }: SongPlayerClientProps) {
  const handleUrlChange = useCallback(async (url: string) => {
    await savePlaybackAction(song.id, { youtubeUrl: url || undefined });
  }, [song.id]);

  const handleChordMapChange = useCallback(async (map: ChordCue[]) => {
    await savePlaybackAction(song.id, { chordMap: map });
  }, [song.id]);

  const sidebarSongs = songs.map((s) => ({
    id:     s.id,
    title:  s.title,
    artist: s.artist,
  }));

  return (
    <AppLayout songs={sidebarSongs} activeSongId={song.id}>
      <PlayerPage
        key={song.id}
        songId={song.id}
        songTitle={song.title}
        songArtist={song.artist}
        baseSheet={parseChordPro(song.content)}
        youtubeUrl={song.youtubeUrl}
        chordMap={song.chordMap}
        tuningId={song.tuning}
        initialBpm={song.bpm}
        songKeys={song.keys ?? (song.originalKey ? [parseSongKey(song.originalKey)] : [])}
        onYoutubeUrlChange={handleUrlChange}
        onChordMapChange={handleChordMapChange}
      />
    </AppLayout>
  );
}
