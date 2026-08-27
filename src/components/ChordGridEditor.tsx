'use client';

import { useCallback, useState } from 'react';
import type { ChordSection } from '@/domain/music/types';
import { copyBeatsToSections, matchingSectionIndices } from '@/domain/music/gridCopy';
import { GridYouTubePlayer } from './GridYouTubePlayer';

const MAX_BEATS = 16;

// Beats after one badge click: add `step`, wrapping past MAX_BEATS back into 1..16.
function nextBeats(current: number, step: number): number {
  const next = current + step;
  return next > MAX_BEATS ? ((next - 1) % MAX_BEATS) + 1 : next;
}

interface ChordGridEditorProps {
  grid:         ChordSection[];
  onChange:     (grid: ChordSection[]) => void;
  onAutoBuild?: () => void;
  hasContent?:  boolean;
  youtubeUrl?:  string;   // saved song URL only — not the live form value
}

export function ChordGridEditor({ grid, onChange, onAutoBuild, hasContent, youtubeUrl }: ChordGridEditorProps) {

  // Index of the section whose "copy beats to" menu is open, or null.
  const [copyMenu, setCopyMenu] = useState<number | null>(null);

  // Beats added per badge click. Session-only — resets to 1 each mount, never persisted.
  const [beatStep, setBeatStep] = useState(1);

  // Reference player — shown only when the song has a saved YouTube link.
  const player = youtubeUrl ? <GridYouTubePlayer youtubeUrl={youtubeUrl} /> : null;

  const updateSection = useCallback((si: number, patch: Partial<ChordSection>) => {
    onChange(grid.map((s, i) => i === si ? { ...s, ...patch } : s));
  }, [grid, onChange]);

  const deleteSection = useCallback((si: number) => {
    onChange(grid.filter((_, i) => i !== si));
  }, [grid, onChange]);

  const setChordBeats = useCallback((si: number, ci: number, beats: number) => {
    onChange(grid.map((s, i) => i !== si ? s : {
      ...s,
      chords: s.chords.map((c, j) => j === ci ? { ...c, beats } : c),
    }));
  }, [grid, onChange]);

  const deleteChord = useCallback((si: number, ci: number) => {
    onChange(
      grid
        .map((s, i) => i !== si ? s : { ...s, chords: s.chords.filter((_, j) => j !== ci) })
        .filter(s => s.chords.length > 0),
    );
  }, [grid, onChange]);

  const copyBeats = useCallback((si: number, targets: number[]) => {
    onChange(copyBeatsToSections(grid, si, targets));
    setCopyMenu(null);
  }, [grid, onChange]);

  if (grid.length === 0) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {player}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-8">
          <p className="text-sm text-zinc-500">No chord grid yet.</p>
          {hasContent && onAutoBuild && (
            <button
              onClick={onAutoBuild}
              className="px-4 py-2 rounded-xl text-sm font-medium
                bg-zinc-800 border border-zinc-700 text-zinc-300
                hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
            >
              ⚡ Auto-build from ChordPro
            </button>
          )}
          <p className="text-xs text-zinc-600">
            Or use the ♩ Progression builder in the Form tab to add sections manually.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {player}

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2
        border-b border-zinc-800 bg-zinc-900/50">
        <span className="text-xs text-zinc-500">
          {grid.length} section{grid.length !== 1 ? 's' : ''}
          {' · '}
          {grid.reduce((n, s) => n + s.chords.length, 0)} chords
        </span>

        {/* Beats-per-click step — session-only, resets to 1 each time */}
        <div className="flex items-center gap-0.5 ml-3" title="How many beats each badge click adds">
          <span className="text-[10px] text-zinc-600 mr-1">step</span>
          <button
            onClick={() => setBeatStep(s => Math.max(1, s - 1))}
            disabled={beatStep <= 1}
            aria-label="Decrease beat step"
            className="w-5 h-5 flex items-center justify-center rounded
              text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700
              disabled:opacity-30 transition-colors text-sm"
          >−</button>
          <span className="w-6 text-center text-xs font-mono text-zinc-300 tabular-nums">
            +{beatStep}
          </span>
          <button
            onClick={() => setBeatStep(s => Math.min(MAX_BEATS, s + 1))}
            disabled={beatStep >= MAX_BEATS}
            aria-label="Increase beat step"
            className="w-5 h-5 flex items-center justify-center rounded
              text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700
              disabled:opacity-30 transition-colors text-sm"
          >+</button>
        </div>

        <div className="flex-1" />
        {hasContent && onAutoBuild && (
          <button
            onClick={onAutoBuild}
            className="px-2.5 py-1 rounded-lg text-xs font-medium
              bg-zinc-800 border border-zinc-700 text-zinc-400
              hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
            title="Rebuild grid from current ChordPro"
          >
            ⚡ Rebuild
          </button>
        )}
        <button
          onClick={() => onChange([])}
          className="px-2.5 py-1 rounded-lg text-xs
            text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Sections list */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
        {grid.map((section, si) => {
          const matches = matchingSectionIndices(grid, si);
          const menuOpen = copyMenu === si;
          return (
          <div key={si} className="px-4 py-3 space-y-2.5">

            {/* Section header row */}
            <div className="flex items-center gap-2">
              {/* Editable label */}
              <input
                type="text"
                value={section.label}
                onChange={e => updateSection(si, { label: e.target.value })}
                placeholder="Section name"
                className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-zinc-200
                  border-b border-transparent hover:border-zinc-700 focus:border-amber-500
                  focus:outline-none placeholder:text-zinc-600 transition-colors py-0.5"
              />

              {/* Copy beats to sections with an identical chord progression */}
              {matches.length > 0 && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => setCopyMenu(menuOpen ? null : si)}
                    aria-expanded={menuOpen}
                    title="Copy this section's beats to sections with the same chord progression"
                    className={[
                      'flex items-center gap-1 px-2 h-6 rounded-md text-[10px] font-medium transition-colors',
                      menuOpen
                        ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                        : 'text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10',
                    ].join(' ')}
                  >
                    ⧉ Copy beats
                  </button>

                  {menuOpen && (
                    <>
                      {/* Click-away backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setCopyMenu(null)} />
                      <div className="absolute right-0 top-7 z-20 w-52 rounded-xl
                        bg-zinc-900 border border-zinc-700 shadow-xl shadow-black/40 p-1">
                        <p className="px-2.5 py-1.5 text-[10px] text-zinc-500 leading-snug">
                          Apply <span className="text-zinc-300 font-medium">{section.label || 'this section'}</span>&apos;s
                          beats to:
                        </p>
                        {matches.map((ti) => (
                          <button
                            key={ti}
                            onClick={() => copyBeats(si, [ti])}
                            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg
                              text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
                          >
                            <span className="truncate">{grid[ti].label || `Section ${ti + 1}`}</span>
                            <span className="text-[9px] text-zinc-600 shrink-0">→ apply</span>
                          </button>
                        ))}
                        {matches.length > 1 && (
                          <button
                            onClick={() => copyBeats(si, matches)}
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left
                              text-amber-400 hover:bg-amber-500/10 transition-colors"
                          >
                            Apply to all {matches.length} matching
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Repeat stepper */}
              <div className="flex items-center gap-0.5 shrink-0">
                <span className="text-[10px] text-zinc-600 mr-1">repeat</span>
                <button
                  onClick={() => updateSection(si, { repeat: Math.max(0, section.repeat - 1) })}
                  disabled={section.repeat === 0}
                  className="w-5 h-5 flex items-center justify-center rounded
                    text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700
                    disabled:opacity-30 transition-colors text-sm"
                >−</button>
                <span className="w-6 text-center text-xs font-mono text-zinc-300 tabular-nums">
                  {section.repeat === 0 ? '∞' : section.repeat}
                </span>
                <button
                  onClick={() => updateSection(si, { repeat: section.repeat + 1 })}
                  className="w-5 h-5 flex items-center justify-center rounded
                    text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors text-sm"
                >+</button>
              </div>

              {/* Delete section */}
              <button
                onClick={() => deleteSection(si)}
                aria-label="Delete section"
                className="w-6 h-6 flex items-center justify-center rounded-md shrink-0
                  text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs"
              >✕</button>
            </div>

            {/* Chord chips */}
            <div className="flex flex-wrap gap-2">
              {section.chords.map((cb, ci) => (
                <div key={ci} className="group flex flex-col items-center gap-0.5">
                  <div className="relative">
                    <span className="block px-2.5 py-1 rounded-lg text-xs font-mono font-semibold
                      bg-zinc-800 border border-zinc-700 text-zinc-300 leading-none py-1.5">
                      {cb.chord}
                    </span>
                    {/* Delete chord — visible on hover */}
                    <button
                      onClick={() => deleteChord(si, ci)}
                      aria-label={`Remove ${cb.chord}`}
                      className="absolute -top-1.5 -right-1.5
                        w-3.5 h-3.5 flex items-center justify-center rounded-full
                        bg-zinc-600 text-zinc-300 text-[8px] leading-none
                        opacity-0 group-hover:opacity-100
                        hover:!bg-red-500 hover:!text-white
                        transition-all"
                    >×</button>
                  </div>
                  {/* Beats badge — click cycles 1→16→1 */}
                  <button
                    onClick={() => setChordBeats(si, ci, nextBeats(cb.beats, beatStep))}
                    title={`Click to add ${beatStep} beat${beatStep > 1 ? 's' : ''}`}
                    className="text-[9px] tabular-nums leading-none
                      text-zinc-600 hover:text-amber-400 transition-colors"
                  >
                    {cb.beats}b
                  </button>
                </div>
              ))}
            </div>

          </div>
          );
        })}
        <div className="h-8" />
      </div>
    </div>
  );
}
