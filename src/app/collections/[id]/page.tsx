import { notFound } from 'next/navigation';
import { getCollectionAction } from '@/application/collections/collection.actions';
import { getSongsAction } from '@/application/songs/song.actions';
import { CollectionViewPage } from '@/components/CollectionViewPage';

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [collection, allSongs] = await Promise.all([
    getCollectionAction(id),
    getSongsAction(),
  ]);
  if (!collection) notFound();
  return <CollectionViewPage collection={collection} allSongs={allSongs} />;
}
