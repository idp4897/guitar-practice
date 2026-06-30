'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addSongToCollectionAction,
  deleteCollectionAction,
  removeSongFromCollectionAction,
} from '@/application/collections/collection.actions';
import type { StoredCollection } from '@/domain/collections/types';
import type { StoredSong } from '@/lib/song-store';

interface CollectionViewPageProps {
  collection: StoredCollection;
  allSongs:   StoredSong[];
}

export function CollectionViewPage({
  collection: initialCollection,
  allSongs,
}: CollectionViewPageProps) {
  const router = useRouter();
  const [collection, setCollection] = useState(initialCollection);
  const [pending, startTransition]  = useTransition();
  const [addModalOpen, setAddModalOpen]     = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [addSearch, setAddSearch]           = useState('');

  const collectionSongs = allSongs.filter((s) => collection.songIds.includes(s.id));
  const availableSongs  = allSongs.filter((s) => !collection.songIds.includes(s.id));

  const filteredAvailable = addSearch.trim()
    ? availableSongs.filter((s) => {
        const q = addSearch.toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          (s.artist ?? '').toLowerCase().includes(q)
        );
      })
    : availableSongs;

  function handleRemoveSong(songId: string) {
    setCollection((prev) => ({
      ...prev,
      songIds: prev.songIds.filter((id) => id !== songId),
    }));
    startTransition(() => removeSongFromCollectionAction(collection.id, songId));
  }

  function handleAddSongs() {
    if (selectedSongIds.length === 0) return;
    setCollection((prev) => ({
      ...prev,
      songIds: [...new Set([...prev.songIds, ...selectedSongIds])],
    }));
    const ids = [...selectedSongIds];
    setSelectedSongIds([]);
    setAddSearch('');
    setAddModalOpen(false);
    startTransition(async () => {
      await Promise.all(ids.map((id) => addSongToCollectionAction(collection.id, id)));
    });
  }

  function handleDeleteCollection() {
    if (!confirm(`Delete collection "${collection.name}"? Songs will not be deleted.`)) return;
    startTransition(async () => {
      try { await deleteCollectionAction(collection.id); } catch {}
    });
  }

  function toggleSong(songId: string) {
    setSelectedSongIds((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId],
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <Link href="/collections" className="text-xs text-zinc-600 hover:text-zinc-400">
                ← Collections
              </Link>
              <h1 className="text-xl font-bold text-zinc-100 mt-0.5 truncate">
                {collection.name}
              </h1>
              {collection.description && (
                <p className="text-sm text-zinc-400 mt-0.5">{collection.description}</p>
              )}
              {collection.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {collection.tags.map((tag) => (
                    <span key={tag}
                      className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 border border-zinc-700 text-zinc-500">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              <Link
                href={`/collections/${collection.id}/edit`}
                className="px-3 py-1.5 rounded-lg text-xs font-medium
                  text-zinc-400 bg-zinc-800 border border-zinc-700
                  hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
              >
                Edit
              </Link>
              <button
                onClick={handleDeleteCollection}
                disabled={pending}
                className="px-3 py-1.5 rounded-lg text-xs font-medium
                  text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Song count + Add button */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-zinc-500">
            {collectionSongs.length} {collectionSongs.length === 1 ? 'song' : 'songs'}
          </span>
          {availableSongs.length > 0 && (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-zinc-800 border border-zinc-700 text-zinc-400
                hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
            >
              + Add songs
            </button>
          )}
        </div>

        {/* Song list */}
        {collectionSongs.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4 text-center">
            <p className="text-zinc-500 text-sm">No songs in this collection yet.</p>
            {availableSongs.length > 0 && (
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 text-sm font-semibold
                  hover:bg-amber-400 transition-colors"
              >
                Add songs
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {collectionSongs.map((song) => (
              <div
                key={song.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl
                  bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <Link href={`/songs/${song.id}`} className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-100 truncate">{song.title}</p>
                  {song.artist && (
                    <p className="text-sm text-zinc-400 truncate">{song.artist}</p>
                  )}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  {(song.preferredKey || song.originalKey) && (
                    <span className="text-xs font-mono text-amber-400/80">
                      {song.preferredKey || song.originalKey}
                    </span>
                  )}
                  <Link
                    href={`/songs/${song.id}`}
                    className="px-2.5 py-1 rounded-lg text-xs text-zinc-500
                      hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                  >
                    Play
                  </Link>
                  <button
                    onClick={() => handleRemoveSong(song.id)}
                    className="px-2.5 py-1 rounded-lg text-xs text-zinc-700
                      hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add songs modal */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70"
          onClick={() => { setAddModalOpen(false); setSelectedSongIds([]); setAddSearch(''); }}
        >
          <div
            className="w-full sm:max-w-lg bg-zinc-900 rounded-t-2xl sm:rounded-2xl
              border border-zinc-700 flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
              <h2 className="flex-1 font-semibold text-zinc-100">Add songs</h2>
              {selectedSongIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddSongs}
                  disabled={pending}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold
                    bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors"
                >
                  Add {selectedSongIds.length}
                </button>
              )}
              <button
                onClick={() => { setAddModalOpen(false); setSelectedSongIds([]); setAddSearch(''); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg
                  text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-2 border-b border-zinc-800 shrink-0">
              <input
                type="search"
                placeholder="Search songs…"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700
                  text-sm text-zinc-100 placeholder:text-zinc-600
                  focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Song list */}
            <div className="overflow-y-auto flex-1">
              {filteredAvailable.length === 0 ? (
                <p className="text-center text-zinc-500 text-sm py-8">No songs available</p>
              ) : (
                filteredAvailable.map((song) => {
                  const checked = selectedSongIds.includes(song.id);
                  return (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => toggleSong(song.id)}
                      className={[
                        'w-full flex items-center gap-3 px-4 py-3 text-left',
                        'border-b border-zinc-800/50 transition-colors',
                        checked ? 'bg-amber-500/10' : 'hover:bg-zinc-800/50',
                      ].join(' ')}
                    >
                      <div className={[
                        'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                        checked
                          ? 'bg-amber-500 border-amber-500'
                          : 'border-zinc-600 bg-transparent',
                      ].join(' ')}>
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5"
                              strokeLinecap="round" strokeLinejoin="round" className="text-zinc-950" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-100 truncate">{song.title}</p>
                        {song.artist && (
                          <p className="text-xs text-zinc-400 truncate">{song.artist}</p>
                        )}
                      </div>
                      {(song.preferredKey || song.originalKey) && (
                        <span className="text-xs font-mono text-zinc-600 shrink-0">
                          {song.preferredKey || song.originalKey}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
