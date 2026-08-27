'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CHORD_CATEGORIES, searchChords } from '@/domain/music/chord-search';
import type { ChordCategory, ChordEntry } from '@/domain/music/chord-search';
import { detectTuningType, findVoicings, getTuning, TUNINGS } from '@/domain/music/tuning';
import { ChordDiagram } from './ChordDiagram';
import { FretDiagram } from './FretDiagram';

const DEBOUNCE_MS = 200;

const CATEGORY_LABELS: Record<ChordCategory, string> = {
  major:     'Major',
  minor:     'Minor',
  dominant:  'Dominant',
  suspended: 'Sus',
  altered:   'Altered',
  slash:     'Slash',
};

export function ChordSearchPage() {
  const [query,          setQuery]          = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category,       setCategory]       = useState<ChordCategory | null>(null);
  const [tuningId,       setTuningId]       = useState('standard');
  const [openChord,      setOpenChord]      = useState<string | null>(null);

  const tuning   = getTuning(tuningId);
  const pageSize = detectTuningType(tuning) === 'uniform' ? 48 : 24;
  const [visible, setVisible] = useState(pageSize);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setVisible(pageSize); }, [debouncedQuery, category, tuningId, pageSize]);

  const results = useMemo(
    () => searchChords({ query: debouncedQuery, category }),
    [debouncedQuery, category],
  );
  const shown = results.slice(0, visible);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">

          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm shrink-0">
              ← Songs
            </Link>
            <h1 className="text-lg font-bold text-zinc-100 flex-1">Chords</h1>

            <select
              value={tuningId}
              onChange={(e) => setTuningId(e.target.value)}
              aria-label="Tuning"
              className="px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700
                text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {TUNINGS.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <input
              type="search"
              autoFocus
              placeholder="Search chords…  try “Am7”, “F#”, “sus4”, “maj7”"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700
                text-sm text-zinc-100 placeholder:text-zinc-500
                focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryChip
              label="All"
              active={category === null}
              onClick={() => setCategory(null)}
            />
            {CHORD_CATEGORIES.map((c) => (
              <CategoryChip
                key={c}
                label={CATEGORY_LABELS[c]}
                active={category === c}
                onClick={() => setCategory(category === c ? null : c)}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <p className="text-xs text-zinc-500 tabular-nums">
          {results.length === 0
            ? 'No chords found.'
            : `Showing ${shown.length} of ${results.length} chord${results.length === 1 ? '' : 's'}`}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {shown.map((entry) => (
            <ChordCard
              key={entry.name}
              entry={entry}
              tuningId={tuningId}
              onOpen={() => setOpenChord(entry.name)}
            />
          ))}
        </div>

        {visible < results.length && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setVisible((v) => v + pageSize)}
              className="px-5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700
                text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors
                touch-manipulation"
            >
              Show more
            </button>
          </div>
        )}
      </main>

      {openChord && (
        <ChordDiagram
          chord={openChord}
          tuning={tuning}
          onClose={() => setOpenChord(null)}
        />
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface ChordCardProps {
  entry:    ChordEntry;
  tuningId: string;
  onOpen:   () => void;
}

function ChordCard({ entry, tuningId, onOpen }: ChordCardProps) {
  const positions = useMemo(
    () => findVoicings(entry.name, getTuning(tuningId)),
    [entry.name, tuningId],
  );
  const position = positions[0] ?? null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col items-center gap-1 p-3 rounded-2xl
        bg-zinc-900 border border-zinc-800 hover:border-amber-500/60
        transition-colors touch-manipulation"
    >
      <span className="text-sm font-semibold font-mono text-zinc-100
        group-hover:text-amber-400 transition-colors">
        {entry.name}
      </span>

      <span className="text-zinc-300">
        {position ? (
          <FretDiagram
            position={position}
            stringNames={getTuning(tuningId).strings}
            width={96}
          />
        ) : (
          <span className="block text-[11px] text-zinc-600 py-10">No shape</span>
        )}
      </span>

      {positions.length > 1 && (
        <span className="text-[10px] text-zinc-500 tabular-nums">
          {positions.length} voicings
        </span>
      )}
    </button>
  );
}

function CategoryChip({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors touch-manipulation',
        active
          ? 'bg-amber-500 text-zinc-950'
          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
