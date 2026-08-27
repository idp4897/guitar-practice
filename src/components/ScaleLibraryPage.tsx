'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_FRET_RANGE,
  SCALE_CATEGORIES,
  getRelatedModes,
  getScaleEntry,
  getScalePositions,
  mapScaleToFretboard,
  searchScales,
} from '@/domain/music/scale';
import type { ScaleCategory, ScaleEntry } from '@/domain/music/scale';
import { getTuning, TUNINGS } from '@/domain/music/tuning';
import { Fretboard } from './Fretboard';
import type { FretLabel } from './Fretboard';

const DEBOUNCE_MS = 200;
const PAGE_SIZE   = 24;

const CATEGORY_LABELS: Record<ScaleCategory, string> = {
  pentatonic: 'Pentatonic',
  mode:       'Modes',
  minor:      'Minor',
  other:      'Symmetric',
};

type View = 'neck' | 'positions';

export function ScaleLibraryPage() {
  const [query,          setQuery]          = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category,       setCategory]       = useState<ScaleCategory | null>(null);
  const [tuningId,       setTuningId]       = useState('standard');
  const [selected,       setSelected]       = useState<ScaleEntry | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const [visible, setVisible] = useState(PAGE_SIZE);
  useEffect(() => { setVisible(PAGE_SIZE); }, [debouncedQuery, category]);

  const tuning  = getTuning(tuningId);
  const results = useMemo(
    () => searchScales({ query: debouncedQuery, category }),
    [debouncedQuery, category],
  );
  const shown = results.slice(0, visible);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
          <div className="flex items-center gap-3">
            {selected ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm shrink-0"
              >
                ← All scales
              </button>
            ) : (
              <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm shrink-0">
                ← Songs
              </Link>
            )}
            <h1 className="text-lg font-bold text-zinc-100 flex-1 truncate">
              {selected ? selected.name : 'Scales'}
            </h1>
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

          {!selected && (
            <>
              <div className="relative">
                <input
                  type="search"
                  autoFocus
                  placeholder="Search scales…  try “A minor pentatonic”, “dorian”, “F# blues”"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700
                    text-sm text-zinc-100 placeholder:text-zinc-500
                    focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Chip label="All" active={category === null} onClick={() => setCategory(null)} />
                {SCALE_CATEGORIES.map((c) => (
                  <Chip
                    key={c}
                    label={CATEGORY_LABELS[c]}
                    active={category === c}
                    onClick={() => setCategory(category === c ? null : c)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {selected ? (
          <ScaleDetail
            entry={selected}
            tuningId={tuningId}
            onSelect={setSelected}
          />
        ) : (
          <div className="space-y-6">
            <p className="text-xs text-zinc-500 tabular-nums">
              {results.length === 0
                ? 'No scales found.'
                : `Showing ${shown.length} of ${results.length} scale${results.length === 1 ? '' : 's'}`}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {shown.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => setSelected(entry)}
                  className="group text-left p-4 rounded-2xl bg-zinc-900 border border-zinc-800
                    hover:border-amber-500/60 transition-colors touch-manipulation"
                >
                  <div className="text-sm font-semibold text-zinc-100
                    group-hover:text-amber-400 transition-colors">
                    {entry.name}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {entry.notes.map((note, i) => (
                      <span
                        key={`${note}-${i}`}
                        className={[
                          'px-1.5 py-0.5 rounded text-[11px] font-mono',
                          i === 0 ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300',
                        ].join(' ')}
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1.5 text-[11px] text-zinc-500 font-mono">
                    {entry.degrees.join('  ')}
                  </div>
                </button>
              ))}
            </div>

            {visible < results.length && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="px-5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700
                    text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors
                    touch-manipulation"
                >
                  Show more
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Detail ───────────────────────────────────────────────────────────────────

interface ScaleDetailProps {
  entry:    ScaleEntry;
  tuningId: string;
  onSelect: (entry: ScaleEntry) => void;
}

function ScaleDetail({ entry, tuningId, onSelect }: ScaleDetailProps) {
  const [view,   setView]   = useState<View>('neck');
  const [label,  setLabel]  = useState<FretLabel>('note');
  const [posIdx, setPosIdx] = useState(0);

  const tuning = getTuning(tuningId);

  const fullNeck  = useMemo(() => mapScaleToFretboard(entry, tuning, DEFAULT_FRET_RANGE), [entry, tuning]);
  const positions = useMemo(() => getScalePositions(entry, tuning), [entry, tuning]);
  const modes     = useMemo(() => getRelatedModes(entry), [entry]);

  useEffect(() => { setPosIdx(0); }, [entry, tuningId]);

  const position = positions[posIdx] ?? null;
  const showNeck = view === 'neck' || !position;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {entry.notes.map((note, i) => (
          <span key={`${note}-${i}`} className="flex flex-col items-center">
            <span className={[
              'px-2 py-1 rounded-lg text-sm font-mono font-semibold',
              i === 0 ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-200',
            ].join(' ')}>
              {note}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{entry.degrees[i]}</span>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          options={[{ value: 'neck', label: 'Full neck' }, { value: 'positions', label: 'Positions' }]}
          value={view}
          onChange={(v) => setView(v as View)}
        />
        <Toggle
          options={[{ value: 'note', label: 'Notes' }, { value: 'degree', label: 'Degrees' }]}
          value={label}
          onChange={(v) => setLabel(v as FretLabel)}
        />
      </div>

      {!showNeck && position && (
        <div className="flex items-center gap-3">
          <StepButton
            dir="prev"
            onClick={() => setPosIdx((i) => Math.max(0, i - 1))}
            disabled={posIdx === 0}
          />
          <span className="text-sm text-zinc-300 tabular-nums">
            Position <span className="font-semibold text-amber-400">{position.index}</span>
            <span className="text-zinc-600"> / {positions.length}</span>
            <span className="text-zinc-500 text-xs">
              {'  '}· frets {position.startFret}–{position.endFret}
            </span>
          </span>
          <StepButton
            dir="next"
            onClick={() => setPosIdx((i) => Math.min(positions.length - 1, i + 1))}
            disabled={posIdx === positions.length - 1}
          />
        </div>
      )}

      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
        {showNeck || !position ? (
          <Fretboard notes={fullNeck} tuning={tuning} range={DEFAULT_FRET_RANGE} label={label} />
        ) : (
          <Fretboard
            notes={position.notes}
            tuning={tuning}
            range={[Math.max(0, position.startFret - 1), position.endFret + 1]}
            label={label}
          />
        )}
      </div>

      {modes.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium mb-2">
            Same notes, different root
          </p>
          <div className="flex flex-wrap gap-1.5">
            {modes.map((mode) => {
              const target = getScaleEntry(mode.root, mode.scaleType);
              const isCurrent = mode.root === entry.root && mode.scaleType === entry.scaleType;
              return (
                <button
                  key={`${mode.degree}-${mode.root}`}
                  type="button"
                  disabled={!target || isCurrent}
                  onClick={() => target && onSelect(target)}
                  className={[
                    'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors touch-manipulation',
                    isCurrent
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700',
                  ].join(' ')}
                >
                  {mode.root} {mode.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────────

function Toggle({ options, value, onChange }: {
  options: Array<{ value: string; label: string }>;
  value:   string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-zinc-700">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={[
            'px-3 py-1.5 text-xs font-medium transition-colors touch-manipulation select-none',
            value === o.value
              ? 'bg-amber-500 text-zinc-950'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StepButton({ dir, onClick, disabled }: {
  dir: 'prev' | 'next'; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous position' : 'Next position'}
      className="flex items-center justify-center w-9 h-9 rounded-lg
        text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800
        disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={dir === 'prev' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
      </svg>
    </button>
  );
}

function Chip({ label, active, onClick }: {
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
