'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import { SyncTag } from './SyncTag';
import type { SongSyncStatus } from '@/domain/songs/sync';

export interface Song {
  id:         string;
  title:      string;
  artist?:    string;
  syncStatus: SongSyncStatus;
  synced:     number;
  total:      number;
}

interface SidebarCollection {
  id:      string;
  name:    string;
  songIds: string[];
}

interface AppLayoutProps {
  songs:       Song[];
  collections: SidebarCollection[];
  children:    React.ReactNode;
}

export function AppLayout({ songs, collections, children }: AppLayoutProps) {
  const pathname     = usePathname();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const collectionId = searchParams.get('collectionId');
  const autoNext     = searchParams.get('autoNext') as 'skip' | 'play' | null;

  const pathSegments = pathname.split('/');
  const songSegment  = pathSegments[2];
  const activeSongId = songSegment && songSegment !== 'new' ? songSegment : undefined;
  const isEditorRoute = songSegment === 'new' || pathSegments[3] === 'edit';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');

  const setAutoNext = (mode: 'skip' | 'play' | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (mode) params.set('autoNext', mode);
    else params.delete('autoNext');
    params.delete('_auto');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const activeCollection = collectionId
    ? collections.find((c) => c.id === collectionId) ?? null
    : null;

  const displayedSongs = activeCollection
    ? songs.filter((s) => activeCollection.songIds.includes(s.id))
    : songs;

  const filteredSongs = search.trim()
    ? displayedSongs.filter((s) => {
        const q = search.normalize('NFC').toLowerCase();
        return (
          s.title.normalize('NFC').toLowerCase().includes(q) ||
          (s.artist?.normalize('NFC').toLowerCase().includes(q) ?? false)
        );
      })
    : displayedSongs;

  const songHref = (id: string) =>
    activeCollection ? `/songs/${id}?collectionId=${activeCollection.id}` : `/songs/${id}`;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 dark:bg-zinc-950 text-zinc-100">

      {/* Mobile overlay */}
      {!isEditorRoute && sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {!isEditorRoute && <aside className={[
        'fixed inset-y-0 left-0 z-30 w-72 flex flex-col',
        'bg-zinc-900 border-r border-zinc-800',
        'transform transition-transform duration-200 ease-in-out',
        'md:relative md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>

        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
          {activeCollection ? (
            <div className="flex items-center gap-2 min-w-0">
              <Link
                href="/"
                onClick={() => setSidebarOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                aria-label="Back to all songs"
              >
                <BackIcon />
              </Link>
              <span className="text-sm font-semibold text-amber-400 truncate">
                {activeCollection.name}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/" className="text-sm font-semibold text-zinc-300 uppercase tracking-wider
                hover:text-zinc-100 transition-colors">
                Songs
              </Link>
              <Link href="/collections" onClick={() => setSidebarOpen(false)}
                className="text-xs font-medium text-zinc-600 uppercase tracking-wider
                  hover:text-zinc-400 transition-colors">
                Collections
              </Link>
              <Link href="/pomodoro" onClick={() => setSidebarOpen(false)}
                className="text-xs font-medium text-zinc-600 uppercase tracking-wider
                  hover:text-zinc-400 transition-colors">
                Pomodoro
              </Link>
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <Link
              href="/songs/new"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center justify-center w-7 h-7 rounded-lg
                text-zinc-500 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
              aria-label="New song"
            >
              <PlusIcon />
            </Link>
            <button
              className="md:hidden flex items-center justify-center w-7 h-7 rounded-lg
                text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-zinc-800">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder={activeCollection ? `Search in ${activeCollection.name}…` : 'Search songs…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md
                bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder-zinc-500
                focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>
        </div>

        {/* Auto-next toggle group (collection mode only) */}
        {activeCollection && (
          <div className="px-3 py-2 border-b border-zinc-800">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium mb-1.5">
              Auto-next
            </p>
            <div className="flex rounded-lg overflow-hidden border border-zinc-700">
              {([
                { value: null,   label: 'Manual' },
                { value: 'play', label: 'Auto' },
                { value: 'skip', label: 'Skip' },
              ] as const).map(({ value, label }) => {
                const active = autoNext === value;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setAutoNext(value)}
                    className={[
                      'flex-1 py-1.5 text-xs font-medium transition-colors touch-manipulation select-none',
                      active
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Song list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {displayedSongs.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-500">No songs yet.</p>
          )}
          {filteredSongs.length === 0 && displayedSongs.length > 0 && (
            <p className="px-4 py-3 text-sm text-zinc-500">No results.</p>
          )}
          {filteredSongs.map((song) => (
            <Link
              key={song.id}
              href={songHref(song.id)}
              onClick={() => setSidebarOpen(false)}
              className={[
                'block w-full text-left px-4 py-3 transition-colors',
                'hover:bg-zinc-800',
                activeSongId === song.id
                  ? 'bg-zinc-800 border-l-2 border-amber-400 text-zinc-100'
                  : 'text-zinc-300 border-l-2 border-transparent',
              ].join(' ')}
            >
              <div className="flex items-center gap-1.5">
                <div className="text-sm font-medium leading-snug truncate flex-1 min-w-0">{song.title}</div>
                <SyncTag status={song.syncStatus} synced={song.synced} total={song.total} />
              </div>
              {song.artist && (
                <div className="text-xs text-zinc-500 mt-0.5 truncate">{song.artist}</div>
              )}
            </Link>
          ))}
        </nav>
      </aside>}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {!isEditorRoute && (
          <header className="flex items-center gap-3 px-4 py-3
            border-b border-zinc-800 bg-zinc-900 shrink-0">
            <button
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg
                text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <HamburgerIcon />
            </button>

            <Link href="/" className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-zinc-100 truncate hover:text-amber-400
                transition-colors">
                Guitar Practice
              </h1>
            </Link>

            <ThemeToggle />
          </header>
        )}

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
