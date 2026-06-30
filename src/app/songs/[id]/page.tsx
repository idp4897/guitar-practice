import { notFound } from 'next/navigation';
import { getSongAction, getSongsAction } from '@/application/songs/song.actions';
import { SongPlayerClient } from '@/components/SongPlayerClient';

export default async function SongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [song, songs] = await Promise.all([getSongAction(id), getSongsAction()]);
  if (!song) notFound();
  return <SongPlayerClient song={song} songs={songs} />;
}
