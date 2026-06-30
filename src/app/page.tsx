import { Suspense } from 'react';
import { getSongsAction } from '@/application/songs/song.actions';
import { getCollectionsAction } from '@/application/collections/collection.actions';
import { LibraryPage } from '@/components/LibraryPage';

export default async function Home() {
  const [songs, collections] = await Promise.all([
    getSongsAction(),
    getCollectionsAction(),
  ]);
  return (
    <Suspense>
      <LibraryPage songs={songs} collections={collections} />
    </Suspense>
  );
}
