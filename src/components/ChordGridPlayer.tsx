'use client';

import { type AccentLevel, TIME_SIGNATURES } from '@/domain/music/timeSignature';
import { useChordGrid, type GridPlayMode } from '@/hooks/useChordGrid';
import type { ChordSection } from '@/domain/music/types';

// ─── Beat dot helper ──────────────────────────────────────────────────────────

function accentClass(accent: AccentLevel, active: boolean): string {
  if (active) {
    if (accent === 'strong') return 'bg-amber-400 scale-125';
    if (accent === 'medium') return 'bg-sky-400 scale-110';
    return 'bg-zinc-200 scale-110';
  }
  if (accent === 'strong') return 'bg-amber-800/70';
  if (accent === 'medium') return 'bg-sky-900/60';
  return 'bg-zinc-700';
}

function BeatDots({ accents, currentBeat, isPlaying }: {
  accents: AccentLevel[]; currentBeat: number; isPlaying: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {accents.map((accent, i) => (
        <div
          key={i}
          className={[
            'w-2.5 h-2.5 rounded-full transition-all duration-75',
            accentClass(accent, isPlaying && currentBeat === i),
          ].join(' ')}
        />
      ))}
    </div>
  );
}

// ─── ChordGridPlayer ──────────────────────────────────────────────────────────

export interface ChordGridPlayerProps {
  grid:       ChordSection[];
  initialBpm?: number;
  onClose:    () => void;
}

export function ChordGridPlayer({ grid, initialBpm = 120, onClose }: ChordGridPlayerProps) {
  const {
    isPlaying, bpm, timeSignature, currentBeat,
    toggle, stop, setBpm, setTimeSignature,
    currentChord, currentSectionIdx, currentChordIdx, done,
    mode, setMode,
  } = useChordGrid(grid, initialBpm);

  const isPractice = mode !== 'run-through';
  const practiceIdx = isPractice ? (mode as { type: 'practice'; sectionIndex: number }).sectionIndex : -1;

  const handleClose = () => { stop(); onClose(); };

  const switchMode = (m: GridPlayMode) => { stop(); setMode(m); };

  if (grid.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 bg-zinc-950">
        <p className="text-lg font-semibold text-zinc-200">No chord grid yet</p>
        <p className="text-sm text-zinc-500 max-w-xs">
          Open the song editor and use the Progression builder to create a chord grid.
        </p>
        <button onClick={handleClose}
          className="mt-2 px-5 py-3 rounded-xl bg-zinc-800 text-zinc-300
            text-sm font-medium hover:bg-zinc-700 transition-colors touch-manipulation">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-zinc-950 select-none">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900">
        {/* Mode toggle */}
        <div className="flex gap-0.5 bg-zinc-800 rounded-lg p-0.5">
          <button
            onClick={() => switchMode('run-through')}
            className={[
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              !isPractice ? 'bg-zinc-600 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
            ].join(' ')}
          >
            Run-through
          </button>
          <button
            onClick={() => isPractice ? undefined : switchMode({ type: 'practice', sectionIndex: 0 })}
            className={[
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              isPractice ? 'bg-zinc-600 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
            ].join(' ')}
          >
            Practice
          </button>
        </div>

        <div className="flex-1" />

        <button onClick={handleClose}
          className="px-3 h-8 rounded-lg text-xs font-medium
            bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300
            transition-colors touch-manipulation">
          Exit
        </button>
      </div>

      {/* ── Current chord display ── */}
      <div className="shrink-0 flex flex-col items-center justify-center py-5 gap-1 border-b border-zinc-800/60">
        <div className={[
          'text-6xl font-black font-mono transition-all duration-150',
          currentChord ? 'text-amber-400' : 'text-zinc-700',
        ].join(' ')}>
          {currentChord ?? (isPlaying ? '—' : '·')}
        </div>
        {done && (
          <p className="text-xs text-emerald-400 font-medium">Done</p>
        )}
        {isPractice && grid[practiceIdx] && (
          <p className="text-xs text-zinc-500">{grid[practiceIdx].label} — looping</p>
        )}
      </div>

      {/* ── Sections list ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {grid.map((section, si) => {
          const isActive = currentSectionIdx === si;
          const isPracticeTarget = isPractice && practiceIdx === si;

          return (
            <div
              key={si}
              className={[
                'px-4 py-3 border-b border-zinc-800/40 transition-colors',
                isActive && isPlaying ? 'bg-amber-500/5' : '',
              ].join(' ')}
            >
              {/* Section header */}
              <div className="flex items-center gap-2 mb-2">
                <span className={[
                  'text-xs font-semibold',
                  isActive && isPlaying ? 'text-amber-400' : 'text-zinc-400',
                ].join(' ')}>
                  {section.label}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {section.repeat === 0 ? '∞' : `×${section.repeat}`}
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => switchMode(
                    isPracticeTarget
                      ? 'run-through'
                      : { type: 'practice', sectionIndex: si },
                  )}
                  className={[
                    'px-2 h-6 rounded-md text-[10px] font-medium transition-colors touch-manipulation',
                    isPracticeTarget
                      ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                      : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300',
                  ].join(' ')}
                >
                  {isPracticeTarget ? 'Practicing' : 'Practice'}
                </button>
              </div>

              {/* Chord chips */}
              <div className="flex flex-wrap gap-1.5">
                {section.chords.map((cb, ci) => {
                  const isThisChord =
                    isPlaying &&
                    currentSectionIdx === si &&
                    currentChordIdx === ci;
                  return (
                    <div key={ci} className="flex flex-col items-center gap-0.5">
                      <span className={[
                        'px-2 py-1 rounded-lg text-xs font-mono font-semibold transition-colors',
                        isThisChord
                          ? 'bg-amber-500 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-400',
                      ].join(' ')}>
                        {cb.chord}
                      </span>
                      <span className="text-[9px] text-zinc-700 tabular-nums">{cb.beats}b</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="h-4" />
      </div>

      {/* ── Metronome controls ── */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 py-3 space-y-3">

        {/* Beat dots + BPM */}
        <div className="flex items-center gap-4">
          <BeatDots
            accents={timeSignature.accents}
            currentBeat={currentBeat}
            isPlaying={isPlaying}
          />
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold tabular-nums text-zinc-100">{bpm}</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">bpm</span>
          </div>
          <span className="text-xs text-zinc-600 font-mono">{timeSignature.display}</span>
        </div>

        {/* BPM nudge */}
        <div className="flex items-center gap-2">
          {([-5, -1] as const).map(d => (
            <button key={d}
              onClick={() => setBpm(bpm + d)}
              disabled={bpm + d < 40}
              className="w-10 h-8 rounded-lg text-xs font-medium text-zinc-400
                bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100
                disabled:opacity-25 disabled:cursor-not-allowed transition-colors tabular-nums"
            >{d}</button>
          ))}

          <div className="flex-1" />

          {/* Time signature */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {TIME_SIGNATURES.slice(0, 6).map(ts => (
              <button
                key={ts.id}
                onClick={() => setTimeSignature(ts)}
                className={[
                  'shrink-0 px-2 h-8 rounded-lg text-xs font-mono font-semibold transition-colors',
                  timeSignature.id === ts.id
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                    : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300',
                ].join(' ')}
              >{ts.display}</button>
            ))}
          </div>

          <div className="flex-1" />

          {([+1, +5] as const).map(d => (
            <button key={d}
              onClick={() => setBpm(bpm + d)}
              disabled={bpm + d > 240}
              className="w-10 h-8 rounded-lg text-xs font-medium text-zinc-400
                bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100
                disabled:opacity-25 disabled:cursor-not-allowed transition-colors tabular-nums"
            >+{d}</button>
          ))}
        </div>

        {/* Play/Stop */}
        <button
          onClick={toggle}
          className={[
            'w-full h-12 rounded-xl font-semibold text-base transition-all touch-manipulation',
            isPlaying
              ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
              : 'bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20',
          ].join(' ')}
        >
          {isPlaying ? '■  Stop' : '▶  Start'}
        </button>
      </div>
    </div>
  );
}
