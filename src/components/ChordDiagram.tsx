'use client';

import { useEffect, useRef, useState } from 'react';
import { Interval, Note } from 'tonal';
import { detectTuningType, findVoicings, getTuning, getUniformOffset, TUNINGS } from '@/domain/music/tuning';
import type { Tuning } from '@/domain/music/tuning';
import { FretDiagram } from './FretDiagram';

function soundingChordName(chord: string, semitones: number): string {
  if (semitones === 0) return chord;
  const m = chord.match(/^([A-G][b#]?)(.*)$/);
  if (!m) return chord;
  const [, root, suffix] = m;
  const transposed = Note.transpose(root + '4', Interval.fromSemitones(semitones));
  return Note.pitchClass(transposed) + suffix;
}


// ─── ChordDiagram ─────────────────────────────────────────────────────────────

interface ChordDiagramProps {
  chord:   string;
  tuning?: Tuning;
  onClose: () => void;
}

export function ChordDiagram({ chord, tuning, onClose }: ChordDiagramProps) {
  const resolvedTuning = tuning ?? getTuning('standard');
  const overlayRef = useRef<HTMLDivElement>(null);
  const [posIdx, setPosIdx] = useState(0);

  useEffect(() => { setPosIdx(0); }, [chord, resolvedTuning.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const positions     = findVoicings(chord, resolvedTuning);
  const position      = positions[posIdx] ?? null;
  const total         = positions.length;
  const isNonStandard = resolvedTuning.id !== 'standard';
  const tuningType    = detectTuningType(resolvedTuning);
  const uniformOffset = tuningType === 'uniform' ? getUniformOffset(resolvedTuning) : 0;
  const isUniformNonStandard = tuningType === 'uniform' && uniformOffset !== 0;
  const sounding      = isUniformNonStandard ? soundingChordName(chord, uniformOffset) : chord;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative z-10 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">

        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-100 font-mono leading-none">{chord}</span>
              {isNonStandard && (
                <span className="text-xs text-zinc-500 font-medium">{resolvedTuning.name}</span>
              )}
            </div>
            {isUniformNonStandard && sounding !== chord && (
              <p className="text-[11px] text-zinc-500 mt-0.5">
                sounds as{' '}
                <span className="text-amber-400 font-medium font-mono">{sounding}</span>
                <span className="text-zinc-600">
                  {' '}· concert pitch ({Math.abs(uniformOffset)}&nbsp;st lower)
                </span>
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close"
            className="text-zinc-500 hover:text-zinc-100 transition-colors p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex justify-center px-5 pb-3 text-zinc-100">
          {position ? (
            <FretDiagram position={position} stringNames={resolvedTuning.strings} />
          ) : (
            <p className="text-sm text-zinc-500 py-8">No diagram available.</p>
          )}
        </div>

        {total > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
            <button
              onClick={() => setPosIdx((i) => Math.max(0, i - 1))}
              disabled={posIdx === 0}
              aria-label="Previous voicing"
              className="flex items-center justify-center w-8 h-8 rounded-lg
                text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700
                disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <span className="text-xs text-zinc-400 tabular-nums">
              Voicing&nbsp;
              <span className="text-zinc-200 font-medium">{posIdx + 1}</span>
              &nbsp;/&nbsp;{total}
            </span>

            <button
              onClick={() => setPosIdx((i) => Math.min(total - 1, i + 1))}
              disabled={posIdx === total - 1}
              aria-label="Next voicing"
              className="flex items-center justify-center w-8 h-8 rounded-lg
                text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700
                disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { TUNINGS };
