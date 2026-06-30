'use client';

import { useEffect, useRef, useState } from 'react';
import { Interval, Note } from 'tonal';
import { detectTuningType, findVoicings, getTuning, getUniformOffset, TUNINGS } from '@/domain/music/tuning';
import type { ChordPosition, Tuning } from '@/domain/music/tuning';

function soundingChordName(chord: string, semitones: number): string {
  if (semitones === 0) return chord;
  const m = chord.match(/^([A-G][b#]?)(.*)$/);
  if (!m) return chord;
  const [, root, suffix] = m;
  const transposed = Note.transpose(root + '4', Interval.fromSemitones(semitones));
  return Note.pitchClass(transposed) + suffix;
}

// ─── SVG constants ────────────────────────────────────────────────────────────

const SX = [20, 36, 52, 68, 84, 100] as const;
const NUT_Y = 38;
const FRET_SPACING = 22;
const ROWS = 5;
const SVG_W = 120;
const SVG_H = NUT_Y + ROWS * FRET_SPACING + 20;

const fretLineY = (row: number) => NUT_Y + row * FRET_SPACING;
const dotCY = (fretRow: number) => NUT_Y + fretRow * FRET_SPACING - FRET_SPACING / 2;

// ─── FretDiagram ──────────────────────────────────────────────────────────────

function FretDiagram({ position, stringNames }: { position: ChordPosition; stringNames: string[] }) {
  const { frets, fingers, baseFret, barres } = position;
  const isOpenPosition = baseFret === 1;
  const barreSet = new Set(barres);

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width={SVG_W}
      height={SVG_H}
      aria-hidden
      className="overflow-visible"
    >
      {isOpenPosition ? (
        <line x1={SX[0]} y1={NUT_Y} x2={SX[5]} y2={NUT_Y}
          stroke="currentColor" strokeWidth={4} strokeLinecap="round" />
      ) : (
        <>
          <line x1={SX[0]} y1={NUT_Y} x2={SX[5]} y2={NUT_Y}
            stroke="currentColor" strokeWidth={1.5} strokeOpacity={0.35} />
          <text x={SX[5] + 7} y={dotCY(1) + 4} fontSize={10}
            fill="currentColor" fillOpacity={0.55} textAnchor="start">
            {baseFret}
          </text>
        </>
      )}

      {Array.from({ length: ROWS }, (_, i) => (
        <line key={i}
          x1={SX[0]} y1={fretLineY(i + 1)} x2={SX[5]} y2={fretLineY(i + 1)}
          stroke="currentColor" strokeWidth={1} strokeOpacity={0.25} />
      ))}

      {SX.map((x, i) => (
        <line key={i}
          x1={x} y1={NUT_Y} x2={x} y2={fretLineY(ROWS)}
          stroke="currentColor" strokeWidth={1} strokeOpacity={0.25} />
      ))}

      {frets.map((fret, si) => {
        const x = SX[si];
        const y = NUT_Y - 11;
        if (fret === 0) return (
          <circle key={si} cx={x} cy={y} r={4.5}
            fill="none" stroke="currentColor" strokeWidth={1.5} />
        );
        if (fret === -1) return (
          <g key={si}>
            <line x1={x - 4} y1={y - 4} x2={x + 4} y2={y + 4}
              stroke="currentColor" strokeWidth={1.5} strokeOpacity={0.6} />
            <line x1={x + 4} y1={y - 4} x2={x - 4} y2={y + 4}
              stroke="currentColor" strokeWidth={1.5} strokeOpacity={0.6} />
          </g>
        );
        return null;
      })}

      {barres.map((barreFret) => {
        const barredIdxs = frets
          .map((f, i) => (f === barreFret ? i : -1))
          .filter((i) => i !== -1);
        if (barredIdxs.length < 2) return null;
        const x1 = SX[barredIdxs[0]];
        const x2 = SX[barredIdxs[barredIdxs.length - 1]];
        const cy = dotCY(barreFret);
        return (
          <rect key={barreFret}
            x={x1} y={cy - 7} width={x2 - x1} height={14} rx={7}
            fill="currentColor" />
        );
      })}

      {frets.map((fret, si) => {
        if (fret <= 0 || barreSet.has(fret)) return null;
        const cy = dotCY(fret);
        const finger = fingers[si];
        return (
          <g key={si}>
            <circle cx={SX[si]} cy={cy} r={7} fill="currentColor" />
            {finger > 0 && (
              <text x={SX[si]} y={cy + 4} textAnchor="middle" fontSize={9}
                fill="currentColor" className="fill-zinc-950">
                {finger}
              </text>
            )}
          </g>
        );
      })}

      {SX.map((x, i) => (
        <text key={i} x={x} y={fretLineY(ROWS) + 14}
          textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.35}>
          {stringNames[i]}
        </text>
      ))}
    </svg>
  );
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
