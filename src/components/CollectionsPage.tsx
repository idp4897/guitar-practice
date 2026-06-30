'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteCollectionAction } from '@/application/collections/collection.actions';
import { filterCollections } from '@/domain/collections/filter';
import type { StoredCollection } from '@/domain/collections/types';

interface CollectionsPageProps {
  collections: StoredCollection[];
}

export function CollectionsPage({ collections }: CollectionsPageProps) {
  const [query, setQuery] = useState('');
  const filtered = filterCollections(collections, query);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
            ← Songs
          </Link>
          <h1 className="text-lg font-bold text-zinc-100 flex-1">Collections</h1>

          <div className="relative max-w-xs flex-1">
            <input
              type="search"
              placeholder="Search name or tag…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700
                text-sm text-zinc-100 placeholder:text-zinc-500
                focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          </div>

          <Link
            href="/collections/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl shrink-0
              bg-amber-500 text-zinc-950 text-sm font-semibold
              hover:bg-amber-400 transition-colors touch-manipulation"
          >
            <PlusIcon />
            New
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {collections.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-center">
            <p className="text-zinc-500">No collections match &ldquo;{query}&rdquo;</p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((coll) => (
              <CollectionCard key={coll.id} collection={coll} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Collection Card ──────────────────────────────────────────────────────────

function CollectionCard({ collection }: { collection: StoredCollection }) {
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(`Delete collection "${collection.name}"? Songs will not be deleted.`)) return;
    startTransition(async () => {
      try { await deleteCollectionAction(collection.id); } catch {}
    });
  };

  return (
    <div className={[
      'group relative flex flex-col gap-3 p-4 rounded-2xl',
      'bg-zinc-900 border border-zinc-800 hover:border-zinc-700',
      'hover:bg-zinc-800/50 transition-all',
      pending ? 'opacity-50 pointer-events-none' : '',
    ].join(' ')}>

      <Link href={`/collections/${collection.id}`} className="absolute inset-0 rounded-2xl" />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-100 leading-snug truncate">{collection.name}</p>
          {collection.description && (
            <p className="text-sm text-zinc-400 mt-0.5 line-clamp-2">{collection.description}</p>
          )}
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium
          bg-zinc-800 border border-zinc-700 text-zinc-500 tabular-nums">
          {collection.songIds.length} {collection.songIds.length === 1 ? 'song' : 'songs'}
        </span>
      </div>

      {/* Tags */}
      {collection.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {collection.tags.map((tag) => (
            <span key={tag}
              className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 border border-zinc-700 text-zinc-500">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer actions */}
      <div className="relative z-10 flex items-center mt-auto">
        <div className="flex-1" />
        <Link
          href={`/collections/${collection.id}/edit`}
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
      <div className="text-6xl select-none">📂</div>
      <h2 className="text-xl font-semibold text-zinc-200">No collections yet</h2>
      <p className="text-sm text-zinc-500 max-w-xs">
        Group songs into collections — by mood, tuning, setlist, or anything you like.
      </p>
      <Link
        href="/collections/new"
        className="mt-2 px-5 py-3 rounded-xl bg-amber-500 text-zinc-950
          font-semibold hover:bg-amber-400 transition-colors"
      >
        Create first collection
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
