'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

export interface Song {
  id:      string;
  title:   string;
  artist?: string;
}

interface AppLayoutProps {
  songs:         Song[];
  activeSongId?: string;
  children:      React.ReactNode;
}

export function AppLayout({ songs, activeSongId, children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 dark:bg-zinc-950 text-zinc-100">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={[
        'fixed inset-y-0 left-0 z-30 w-72 flex flex-col',
        'bg-zinc-900 border-r border-zinc-800',
        'transform transition-transform duration-200 ease-in-out',
        'md:relative md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>

        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
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
          </div>
          <div className="flex items-center gap-1">
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

        {/* Song list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {songs.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-500">No songs yet.</p>
          )}
          {songs.map((song) => (
            <Link
              key={song.id}
              href={`/songs/${song.id}`}
              onClick={() => setSidebarOpen(false)}
              className={[
                'block w-full text-left px-4 py-3 transition-colors',
                'hover:bg-zinc-800',
                activeSongId === song.id
                  ? 'bg-zinc-800 border-l-2 border-amber-400 text-zinc-100'
                  : 'text-zinc-300 border-l-2 border-transparent',
              ].join(' ')}
            >
              <div className="text-sm font-medium leading-snug truncate">{song.title}</div>
              {song.artist && (
                <div className="text-xs text-zinc-500 mt-0.5 truncate">{song.artist}</div>
              )}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
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

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
