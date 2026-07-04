import { Suspense } from 'react';
import { getSongsAction } from '@/application/songs/song.actions';
import { getCollectionsAction } from '@/application/collections/collection.actions';
import { getSongSyncInfo } from '@/domain/songs/sync';
import { AppLayout } from '@/components/AppLayout';

export default async function SongsLayout({ children }: { children: React.ReactNode }) {
  const [songs, collections] = await Promise.all([
    getSongsAction(),
    getCollectionsAction(),
  ]);

  const sidebarSongs = songs.map((s) => {
    const { status, synced, total } = getSongSyncInfo(s);
    return { id: s.id, title: s.title, artist: s.artist, syncStatus: status, synced, total };
  });
  const sidebarCollections = collections.map((c) => ({ id: c.id, name: c.name, songIds: c.songIds }));

  return (
    <Suspense>
      <AppLayout songs={sidebarSongs} collections={sidebarCollections}>
        {children}
      </AppLayout>
    </Suspense>
  );
}
