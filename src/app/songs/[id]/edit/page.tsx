import { notFound } from 'next/navigation';
import { getSongAction } from '@/application/songs/song.actions';
import { SongEditor } from '@/components/SongEditor';

export default async function EditSongPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const song   = await getSongAction(id);
  if (!song) notFound();
  return <SongEditor song={song} />;
}
