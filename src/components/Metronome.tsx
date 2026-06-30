'use client';

import { useCallback, useRef, useState } from 'react';
import { useMetronome } from '@/hooks/useMetronome';
import {
  type AccentLevel,
  TIME_SIGNATURES,
  formatGrouping,
} from '@/domain/music/timeSignature';

// ─── Tempo labels ─────────────────────────────────────────────────────────────

const TEMPO_MARKS = [
  { max: 60,       label: 'Largo' },
  { max: 76,       label: 'Adagio' },
  { max: 108,      label: 'Andante' },
  { max: 120,      label: 'Moderato' },
  { max: 156,      label: 'Allegro' },
  { max: 200,      label: 'Vivace' },
  { max: Infinity, label: 'Presto' },
] as const;

function tempoLabel(bpm: number) {
  return TEMPO_MARKS.find(({ max }) => bpm <= max)?.label ?? 'Presto';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BPM_MIN        = 40;
const BPM_MAX        = 240;
const TAP_MAX_GAP_MS = 2500;

// ─── Beat dot colors per accent level ────────────────────────────────────────

function accentClass(accent: AccentLevel, active: boolean): string {
  if (active) {
    if (accent === 'strong') return 'bg-amber-400 scale-125 shadow-lg shadow-amber-400/50';
    if (accent === 'medium') return 'bg-sky-400 scale-115 shadow-sm shadow-sky-400/40';
    return 'bg-zinc-200 scale-110 shadow-sm shadow-zinc-200/30';
  }
  if (accent === 'strong') return 'bg-amber-800/70';
  if (accent === 'medium') return 'bg-sky-900/60';
  return 'bg-zinc-700';
}

// ─── BeatDots ────────────────────────────────────────────────────────────────

interface BeatDotsProps {
  accents:      AccentLevel[];
  currentBeat:  number;
  isPlaying:    boolean;
  size?:        'sm' | 'lg';
}

function BeatDots({ accents, currentBeat, isPlaying, size = 'lg' }: BeatDotsProps) {
  const dim  = size === 'lg' ? 'w-4 h-4' : 'w-2 h-2';
  const gap  = size === 'lg' ? 'gap-2'   : 'gap-1.5';

  return (
    <div className={`flex flex-wrap items-center justify-center ${gap}`}>
      {accents.map((accent, i) => {
        const active = isPlaying && currentBeat === i;
        return (
          <div
            key={i}
            className={[
              dim, 'rounded-full transition-all',
              size === 'lg' ? 'duration-75' : 'duration-100',
              accentClass(accent, active),
            ].join(' ')}
          />
        );
      })}
    </div>
  );
}

// ─── Metronome ────────────────────────────────────────────────────────────────

export function Metronome({ initialBpm = 120 }: { initialBpm?: number }) {
  const {
    isPlaying, bpm, timeSignature, currentBeat, currentAccent,
    toggle, setBpm, setTimeSignature, setGrouping, activeGrouping,
  } = useMetronome(initialBpm, '4_4');

  const [expanded, setExpanded] = useState(false);

  // Always-current bpm ref for hold-repeat
  const latestBpmRef = useRef(bpm);
  latestBpmRef.current = bpm;

  // ── Tap tempo ──────────────────────────────────────────────────────────────

  const tapTimesRef = useRef<number[]>([]);

  const handleTap = useCallback(() => {
    const now = performance.now();
    tapTimesRef.current = [
      ...tapTimesRef.current.filter(t => now - t < TAP_MAX_GAP_MS),
      now,
    ].slice(-8);

    if (tapTimesRef.current.length >= 2) {
      const taps = tapTimesRef.current;
      const intervals = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(Math.round(60_000 / avg));
    }
  }, [setBpm]);

  // ── Nudge with hold-repeat ─────────────────────────────────────────────────

  const holdRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startHold = useCallback((delta: number) => {
    setBpm(bpm + delta);
    holdRef.current = setTimeout(() => {
      repeatRef.current = setInterval(() => setBpm(latestBpmRef.current + delta), 80);
    }, 400);
  }, [bpm, setBpm]);

  const endHold = useCallback(() => {
    if (holdRef.current)   clearTimeout(holdRef.current);
    if (repeatRef.current) clearInterval(repeatRef.current);
    holdRef.current = repeatRef.current = null;
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const accents       = activeGrouping
    ? timeSignature.accents  // updated by setGrouping via hook
    : timeSignature.accents;
  const hasGroupings  = (timeSignature.groupings?.length ?? 0) > 0;

  // ── Collapsed bar ─────────────────────────────────────────────────────────

  const collapsedBar = (
    <div className="flex items-center gap-3 px-4 h-14 border-t border-zinc-800 bg-zinc-900">
      <BeatDots
        accents={accents}
        currentBeat={currentBeat}
        isPlaying={isPlaying}
        size="sm"
      />

      <div className="flex items-baseline gap-1 min-w-[4.5rem]">
        <span className="text-lg font-bold text-zinc-100 tabular-nums leading-none">{bpm}</span>
        <span className="text-[10px] text-zinc-500 uppercase tracking-wide">bpm</span>
      </div>

      <span className="text-xs text-zinc-600 font-mono">{timeSignature.display}</span>

      <div className="flex-1" />

      <button
        onClick={toggle}
        className={[
          'flex items-center justify-center w-9 h-9 rounded-full transition-colors',
          isPlaying
            ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            : 'bg-amber-500 text-zinc-950 hover:bg-amber-400',
        ].join(' ')}
        aria-label={isPlaying ? 'Stop metronome' : 'Start metronome'}
      >
        {isPlaying ? <StopIcon /> : <PlayIcon />}
      </button>

      <button
        onClick={() => setExpanded(e => !e)}
        aria-label={expanded ? 'Collapse metronome' : 'Expand metronome'}
        className="flex items-center justify-center w-8 h-8 rounded-lg
          text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
      >
        <ChevronIcon up={expanded} />
      </button>
    </div>
  );

  // ── Expanded panel ────────────────────────────────────────────────────────

  const expandedPanel = (
    <div
      className={[
        'overflow-hidden transition-all duration-300 ease-in-out border-t border-zinc-800',
        expanded ? 'max-h-[560px]' : 'max-h-0 border-transparent',
      ].join(' ')}
    >
      <div className="px-6 pt-5 pb-4 space-y-5 bg-zinc-900">

        {/* Beat indicators */}
        <div className="flex justify-center">
          <BeatDots
            accents={accents}
            currentBeat={currentBeat}
            isPlaying={isPlaying}
            size="lg"
          />
        </div>

        {/* BPM display */}
        <div className="text-center select-none">
          <div className="text-6xl font-bold text-zinc-100 tabular-nums leading-none">{bpm}</div>
          <div className="text-[11px] text-zinc-500 uppercase tracking-widest mt-1">
            {tempoLabel(bpm)} · {timeSignature.bpmLabel}=BPM
          </div>
        </div>

        {/* BPM slider */}
        <div className="space-y-1">
          <input
            type="range"
            min={BPM_MIN}
            max={BPM_MAX}
            value={bpm}
            onChange={e => setBpm(Number(e.target.value))}
            className="w-full h-1 accent-amber-400 cursor-pointer"
            aria-label="BPM"
          />
          <div className="flex justify-between text-[10px] text-zinc-600 tabular-nums">
            <span>{BPM_MIN}</span>
            <span>{BPM_MAX}</span>
          </div>
        </div>

        {/* Nudge + tap */}
        <div className="flex items-center justify-center gap-2">
          {([-5, -1] as const).map(d => (
            <button
              key={d}
              onPointerDown={() => startHold(d)}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              disabled={bpm + d < BPM_MIN}
              className="w-11 h-9 rounded-lg text-sm font-medium text-zinc-400
                bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100
                disabled:opacity-25 disabled:cursor-not-allowed transition-colors tabular-nums
                select-none touch-manipulation"
              aria-label={`BPM ${d}`}
            >
              {d}
            </button>
          ))}

          <button
            onClick={handleTap}
            className="px-4 h-9 rounded-lg text-sm font-semibold text-zinc-300
              bg-zinc-700 hover:bg-zinc-600 hover:text-zinc-100 transition-colors
              select-none touch-manipulation"
            aria-label="Tap tempo"
          >
            Tap
          </button>

          {([+1, +5] as const).map(d => (
            <button
              key={d}
              onPointerDown={() => startHold(d)}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              disabled={bpm + d > BPM_MAX}
              className="w-11 h-9 rounded-lg text-sm font-medium text-zinc-400
                bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100
                disabled:opacity-25 disabled:cursor-not-allowed transition-colors tabular-nums
                select-none touch-manipulation"
              aria-label={`BPM +${d}`}
            >
              +{d}
            </button>
          ))}
        </div>

        {/* Time signature selector */}
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest text-center">
            Time Signature
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {TIME_SIGNATURES.map(ts => (
              <button
                key={ts.id}
                onClick={() => setTimeSignature(ts)}
                className={[
                  'px-3 h-9 rounded-lg text-sm font-mono font-semibold transition-colors select-none',
                  timeSignature.id === ts.id
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100',
                ].join(' ')}
                aria-pressed={timeSignature.id === ts.id}
              >
                {ts.display}
              </button>
            ))}
          </div>

          {/* Grouping picker for irregular time (5/8, 7/8) */}
          {hasGroupings && (
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              {timeSignature.groupings!.map((g) => {
                const label = formatGrouping(g);
                const current = activeGrouping
                  ? formatGrouping(activeGrouping) === label
                  : formatGrouping(g) === formatGrouping(timeSignature.groupings![0]);
                return (
                  <button
                    key={label}
                    onClick={() => setGrouping(g)}
                    className={[
                      'px-2.5 h-7 rounded-md text-xs font-mono font-medium transition-colors select-none',
                      current
                        ? 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30'
                        : 'bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Beat legend */}
          <div className="flex items-center justify-center gap-4 pt-1">
            {(['strong', 'medium', 'weak'] as AccentLevel[]).map(level => (
              <div key={level} className="flex items-center gap-1.5">
                <div className={[
                  'w-2.5 h-2.5 rounded-full',
                  level === 'strong' ? 'bg-amber-400' : level === 'medium' ? 'bg-sky-400' : 'bg-zinc-500',
                ].join(' ')} />
                <span className="text-[10px] text-zinc-600 capitalize">{level}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Play / Stop */}
        <button
          onClick={toggle}
          className={[
            'w-full h-12 rounded-xl font-semibold text-base transition-all select-none touch-manipulation',
            isPlaying
              ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
              : 'bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20',
          ].join(' ')}
        >
          {isPlaying ? `■  Stop  (beat ${currentBeat + 1})` : '▶  Start'}
        </button>

      </div>
    </div>
  );

  // Suppress unused warning — currentAccent drives audio via the hook, not visual here
  void currentAccent;

  return (
    <div className="shrink-0">
      {expandedPanel}
      {collapsedBar}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-300 ${up ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
