'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseChordPro } from '@/domain/music/chordpro';
import { parseSongKey } from '@/domain/music/theory';
import { savePlaybackAction } from '@/application/songs/song.actions';
import { PlayerPage } from './PlayerPage';
import type { StoredSong } from '@/lib/song-store';
import type { ChordCue } from '@/domain/music/types';

function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

interface SongPlayerClientProps {
  song: StoredSong;
  collectionId?: string;
  collectionSongIds?: string[];
}

export function SongPlayerClient({ song, collectionId, collectionSongIds }: SongPlayerClientProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const autoNext   = searchParams.get('autoNext') as 'skip' | 'play' | null;
  const isAutoNav  = searchParams.get('_auto') === '1';
  const songOrder  = searchParams.get('songOrder');

  const currentIndex = collectionSongIds?.indexOf(song.id) ?? -1;
  const nextSongId =
    currentIndex >= 0 && currentIndex < (collectionSongIds?.length ?? 0) - 1
      ? collectionSongIds![currentIndex + 1]
      : undefined;

  // When arriving via auto-navigation, compute where to seek before playing.
  // auto-skip: seek to just before the first chord (fallback to 0 if no cues).
  // auto-play: play from 0.
  let autoPlayFrom: number | undefined;
  if (isAutoNav && autoNext && collectionId) {
    const firstChordTime = song.chordMap?.[0]?.time ?? null;
    autoPlayFrom =
      autoNext === 'skip' && firstChordTime !== null
        ? Math.max(0, firstChordTime - 1)
        : 0;
  }

  const handleUrlChange = useCallback(async (url: string) => {
    await savePlaybackAction(song.id, { youtubeUrl: url || undefined });
  }, [song.id]);

  const handleChordMapChange = useCallback(async (map: ChordCue[]) => {
    await savePlaybackAction(song.id, { chordMap: map });
  }, [song.id]);

  const chordGridStale =
    !!song.chordGrid?.length &&
    !!song.chordGridContentHash &&
    hashStr(song.content) !== song.chordGridContentHash;

  const handleSongEnd = useCallback(() => {
    if (!nextSongId || !collectionId || !autoNext) return;
    const params = new URLSearchParams({ collectionId, autoNext, _auto: '1' });
    if (songOrder) params.set('songOrder', songOrder);
    router.push(`/songs/${nextSongId}?${params.toString()}`);
  }, [nextSongId, collectionId, autoNext, songOrder, router]);

  return (
    <PlayerPage
      key={song.id}
      songId={song.id}
      songTitle={song.title}
      songArtist={song.artist}
      baseSheet={parseChordPro(song.content)}
      youtubeUrl={song.youtubeUrl}
      chordMap={song.chordMap}
      chordGrid={song.chordGrid}
      chordGridStale={chordGridStale}
      tuningId={song.tuning}
      initialBpm={song.bpm}
      songKeys={song.keys ?? (song.originalKey ? [parseSongKey(song.originalKey)] : [])}
      onYoutubeUrlChange={handleUrlChange}
      onChordMapChange={handleChordMapChange}
      autoPlayFrom={autoPlayFrom}
      autoNextMode={autoNext ?? undefined}
      onSongEnd={autoNext && nextSongId ? handleSongEnd : undefined}
    />
  );
}
