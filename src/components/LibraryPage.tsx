'use client';

import Link from 'next/link';
import { useTransition, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { deleteSongAction } from '@/application/songs/song.actions';
import {
  addSongToCollectionAction,
  removeSongFromCollectionAction,
} from '@/application/collections/collection.actions';
import { TUNINGS, getTuning } from '@/domain/music/tuning';
import { filterSongs } from '@/domain/songs/filter';
import type { StoredSong } from '@/lib/song-store';
import type { StoredCollection } from '@/lib/collection-store';

const DEBOUNCE_MS = 250;

interface LibraryPageProps {
  songs:       StoredSong[];
  collections: StoredCollection[];
}

export function LibraryPage({ songs, collections: initialCollections }: LibraryPageProps) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [query,          setQuery]          = useState(searchParams.get('q')      ?? '');
  const [tuningId,       setTuningId]       = useState<string | null>(searchParams.get('tuning') ?? null);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [collections,    setCollections]    = useState(initialCollections);
  const [collModalSongId, setCollModalSongId] = useState<string | null>(null);
  const [collPending, startCollTransition]  = useTransition();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const syncUrl = useCallback((q: string, tid: string | null) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (tid)      params.set('tuning', tid);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '/', { scroll: false });
  }, [router]);

  const handleQueryChange = (q: string) => {
    setQuery(q);
    syncUrl(q, tuningId);
  };

  const handleTuningChange = (tid: string | null) => {
    setTuningId(tid);
    syncUrl(query, tid);
  };

  const clearFilters = () => {
    setQuery('');
    setTuningId(null);
    router.replace('/', { scroll: false });
  };

  function handleToggleCollection(collId: string, songId: string) {
    const coll = collections.find((c) => c.id === collId);
    if (!coll) return;
    const isIn = coll.songIds.includes(songId);
    setCollections((prev) =>
      prev.map((c) =>
        c.id !== collId
          ? c
          : { ...c, songIds: isIn ? c.songIds.filter((id) => id !== songId) : [...c.songIds, songId] },
      ),
    );
    startCollTransition(async () => {
      if (isIn) await removeSongFromCollectionAction(collId, songId);
      else       await addSongToCollectionAction(collId, songId);
    });
  }

  const filtered    = filterSongs(songs, { query: debouncedQuery, tuningId });
  const hasFilters  = query.trim() !== '' || tuningId !== null;
  const usedTuningIds = new Set(songs.map((s) => s.tuning ?? 'standard'));
  const filterableTunings = TUNINGS.filter((t) => usedTuningIds.has(t.id));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <h1 className="text-lg font-bold text-zinc-100 shrink-0">Guitar Practice</h1>

          <div className="relative flex-1 max-w-sm">
            <input
              type="search"
              placeholder="Search songs…"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700
                text-sm text-zinc-100 placeholder:text-zinc-500
                focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          </div>

          <div className="flex-1" />

          <Link
            href="/collections"
            className="px-3 py-2 rounded-xl text-sm font-medium
              text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors touch-manipulation"
          >
            Collections
          </Link>

          <Link
            href="/songs/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl shrink-0
              bg-amber-500 text-zinc-950 text-sm font-semibold
              hover:bg-amber-400 transition-colors touch-manipulation"
          >
            <PlusIcon />
            New Song
          </Link>
        </div>

        {filterableTunings.length > 1 && (
          <div className="max-w-5xl mx-auto px-4 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-xs text-zinc-600 shrink-0">Tuning:</span>
            <button
              type="button"
              onClick={() => handleTuningChange(null)}
              className={[
                'shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                tuningId === null
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200',
              ].join(' ')}
            >
              All
            </button>
            {filterableTunings.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTuningChange(tuningId === t.id ? null : t.id)}
                title={t.strings.join(' ')}
                className={[
                  'shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                  tuningId === t.id
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200',
                ].join(' ')}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {hasFilters && (
          <div className="flex items-center gap-3 mb-4 text-sm">
            <span className="text-zinc-400">
              {filtered.length} {filtered.length === 1 ? 'song' : 'songs'}
            </span>
            <button type="button" onClick={clearFilters}
              className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">
              Clear filters ×
            </button>
          </div>
        )}

        {songs.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-4 text-center">
            <p className="text-zinc-500">No songs match your filters</p>
            <button type="button" onClick={clearFilters}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-sm
                hover:bg-zinc-700 hover:text-zinc-200 transition-colors">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                collections={collections}
                onCollectionToggle={handleToggleCollection}
                onCollectionOpen={() => setCollModalSongId(song.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add to collection modal */}
      {collModalSongId && (
        <AddToCollectionModal
          songId={collModalSongId}
          collections={collections}
          onToggle={handleToggleCollection}
          onClose={() => setCollModalSongId(null)}
          pending={collPending}
        />
      )}
    </div>
  );
}

// ─── AddToCollectionModal ─────────────────────────────────────────────────────

function AddToCollectionModal({
  songId,
  collections,
  onToggle,
  onClose,
  pending,
}: {
  songId:      string;
  collections: StoredCollection[];
  onToggle:    (collId: string, songId: string) => void;
  onClose:     () => void;
  pending:     boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-zinc-900 rounded-t-2xl sm:rounded-2xl
          border border-zinc-700 flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
          <h2 className="flex-1 font-semibold text-sm text-zinc-100">Add to collection</h2>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg
              text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors text-xs">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {collections.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-zinc-500 mb-3">No collections yet</p>
              <Link
                href="/collections/new"
                className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                Create a collection →
              </Link>
            </div>
          ) : (
            <>
              {collections.map((coll) => {
                const isIn = coll.songIds.includes(songId);
                return (
                  <button
                    key={coll.id}
                    type="button"
                    onClick={() => onToggle(coll.id, songId)}
                    disabled={pending}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-3 text-left',
                      'border-b border-zinc-800/50 transition-colors',
                      isIn ? 'bg-amber-500/10' : 'hover:bg-zinc-800/50',
                    ].join(' ')}
                  >
                    <div className={[
                      'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                      isIn ? 'bg-amber-500 border-amber-500' : 'border-zinc-600',
                    ].join(' ')}>
                      {isIn && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5"
                            strokeLinecap="round" strokeLinejoin="round" className="text-zinc-950" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-100 truncate">{coll.name}</p>
                      <p className="text-xs text-zinc-500">
                        {coll.songIds.length} {coll.songIds.length === 1 ? 'song' : 'songs'}
                      </p>
                    </div>
                  </button>
                );
              })}
              <div className="px-4 py-2">
                <Link
                  href="/collections/new"
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  + New collection
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Song Card ────────────────────────────────────────────────────────────────

function SongCard({
  song,
  collections,
  onCollectionOpen,
}: {
  song:             StoredSong;
  collections:      StoredCollection[];
  onCollectionToggle: (collId: string, songId: string) => void;
  onCollectionOpen:   () => void;
}) {
  const [pending, startTransition] = useTransition();
  const key    = song.preferredKey || song.originalKey;
  const hasSync = !!song.chordMap?.length;
  const tuning  = song.tuning && song.tuning !== 'standard' ? getTuning(song.tuning) : null;
  const collCount = collections.filter((c) => c.songIds.includes(song.id)).length;

  const handleDelete = () => {
    if (!confirm(`Delete "${song.title}"?`)) return;
    startTransition(async () => {
      try { await deleteSongAction(song.id); } catch {}
    });
  };

  return (
    <div className={[
      'group relative flex flex-col gap-3 p-4 rounded-2xl',
      'bg-zinc-900 border border-zinc-800 hover:border-zinc-700',
      'hover:bg-zinc-800/50 transition-all',
      pending ? 'opacity-50 pointer-events-none' : '',
    ].join(' ')}>

      <Link href={`/songs/${song.id}`} className="absolute inset-0 rounded-2xl" />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-100 leading-snug truncate">{song.title}</p>
          {song.artist && (
            <p className="text-sm text-zinc-400 mt-0.5 truncate">{song.artist}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {key && (
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold
              bg-amber-500/15 text-amber-400 border border-amber-500/20">
              {key}
            </span>
          )}
          {hasSync && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium
              bg-green-500/10 text-green-400 border border-green-500/20"
              title="YouTube sync recorded">
              YT
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 flex items-center mt-auto gap-2">
        {song.capo > 0 && (
          <span className="text-xs text-zinc-600">Capo {song.capo}</span>
        )}
        {tuning && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700
            text-zinc-500 font-medium" title={tuning.strings.join(' ')}>
            {tuning.name}
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCollectionOpen}
          title="Add to collection"
          className={[
            'px-2 py-1 rounded-lg text-xs transition-colors',
            collCount > 0
              ? 'text-amber-500/80 hover:text-amber-400 hover:bg-amber-500/10'
              : 'text-zinc-700 hover:text-zinc-400 hover:bg-zinc-700',
          ].join(' ')}
        >
          📁{collCount > 0 && <span className="ml-0.5 tabular-nums">{collCount}</span>}
        </button>
        <Link
          href={`/songs/${song.id}/edit`}
          className="px-2.5 py-1 rounded-lg text-xs text-zinc-600
            hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          Edit
        </Link>
        <button
          onClick={handleDelete}
          className="ml-1 px-2.5 py-1 rounded-lg text-xs text-zinc-700
            hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="text-6xl select-none">🎸</div>
      <h2 className="text-xl font-semibold text-zinc-200">No songs yet</h2>
      <p className="text-sm text-zinc-500 max-w-xs">
        Add your first song to start practising with chord sheets and YouTube sync.
      </p>
      <Link
        href="/songs/new"
        className="mt-2 px-5 py-3 rounded-xl bg-amber-500 text-zinc-950
          font-semibold hover:bg-amber-400 transition-colors"
      >
        Add first song
      </Link>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
