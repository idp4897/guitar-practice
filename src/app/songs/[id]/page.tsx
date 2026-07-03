import { notFound } from 'next/navigation';
import { getSongAction } from '@/application/songs/song.actions';
import { getCollectionAction } from '@/application/collections/collection.actions';
import { SongPlayerClient } from '@/components/SongPlayerClient';

export default async function SongPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ collectionId?: string; songOrder?: string }>;
}) {
  const [{ id }, { collectionId, songOrder }] = await Promise.all([params, searchParams]);

  const song = await getSongAction(id);
  if (!song) notFound();

  let collectionSongIds: string[] | undefined;
  if (songOrder) {
    collectionSongIds = songOrder.split(',').filter(Boolean);
  } else if (collectionId) {
    const collection = await getCollectionAction(collectionId);
    collectionSongIds = collection?.songIds;
  }

  return (
    <SongPlayerClient
      song={song}
      collectionId={collectionId}
      collectionSongIds={collectionSongIds}
    />
  );
}
