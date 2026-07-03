'use client';

import { useCallback } from 'react';
import type { ChordSection } from '@/domain/music/types';

interface ChordGridEditorProps {
  grid:         ChordSection[];
  onChange:     (grid: ChordSection[]) => void;
  onAutoBuild?: () => void;
  hasContent?:  boolean;
}

export function ChordGridEditor({ grid, onChange, onAutoBuild, hasContent }: ChordGridEditorProps) {

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

  if (grid.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
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
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2
        border-b border-zinc-800 bg-zinc-900/50">
        <span className="text-xs text-zinc-500">
          {grid.length} section{grid.length !== 1 ? 's' : ''}
          {' · '}
          {grid.reduce((n, s) => n + s.chords.length, 0)} chords
        </span>
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
        {grid.map((section, si) => (
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
                  {/* Beats badge — click cycles 1→8→1 */}
                  <button
                    onClick={() => setChordBeats(si, ci, cb.beats >= 8 ? 1 : cb.beats + 1)}
                    title="Click to change beat count"
                    className="text-[9px] tabular-nums leading-none
                      text-zinc-600 hover:text-amber-400 transition-colors"
                  >
                    {cb.beats}b
                  </button>
                </div>
              ))}
            </div>

          </div>
        ))}
        <div className="h-8" />
      </div>
    </div>
  );
}
