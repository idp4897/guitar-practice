'use client';

import type { FretNote } from '@/domain/music/scale';
import type { Tuning } from '@/domain/music/tuning';

export type FretLabel = 'note' | 'degree';

const FRET_W     = 46;
const STRING_GAP = 26;
const PAD_L      = 48;
const PAD_T      = 22;
const PAD_B      = 20;
const DOT_R      = 10;

const INLAYS        = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const DOUBLE_INLAYS = new Set([12, 24]);

export interface FretboardProps {
  notes:      FretNote[];
  tuning:     Tuning;
  range:      [number, number];
  label?:     FretLabel;
  /** Frets outside this span are dimmed — used to spotlight a position. */
  highlight?: [number, number];
}

export function Fretboard({ notes, tuning, range, label = 'note', highlight }: FretboardProps) {
  const [low, high] = range;
  const stringCount = tuning.strings.length;

  // A fretted note is drawn between its own fret wire and the one below it, so
  // the board has to start one wire before `low` — otherwise the first fret's
  // dot falls off the left edge whenever a position starts up the neck.
  const startLine = low === 0 ? 0 : low - 1;

  const width  = PAD_L + (high - startLine) * FRET_W + 14;
  const height = PAD_T + (stringCount - 1) * STRING_GAP + PAD_B;

  // String 0 is the lowest pitch; tab convention puts it at the bottom.
  const stringY = (s: number) => PAD_T + (stringCount - 1 - s) * STRING_GAP;
  const fretX   = (f: number) => PAD_L + (f - startLine) * FRET_W;
  const openX   = PAD_L - 16;
  const dotX    = (f: number) => (f === 0 ? openX : fretX(f) - FRET_W / 2);
  const f0X     = fretX(startLine);
  const frets   = Array.from({ length: high - startLine + 1 }, (_, i) => startLine + i);

  const inRange = (f: number) => !highlight || (f >= highlight[0] && f <= highlight[1]);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="text-zinc-400"
        role="img"
        aria-label={`Fretboard, frets ${low} to ${high}`}
      >
        {/* Inlay markers */}
        {frets.map((f) => {
          if (f === 0) return null;
          const cx = dotX(f);
          const cy = PAD_T + ((stringCount - 1) * STRING_GAP) / 2;
          if (DOUBLE_INLAYS.has(f)) return (
            <g key={f} fill="currentColor" fillOpacity={0.12}>
              <circle cx={cx} cy={cy - STRING_GAP * 0.9} r={5} />
              <circle cx={cx} cy={cy + STRING_GAP * 0.9} r={5} />
            </g>
          );
          if (INLAYS.has(f)) return (
            <circle key={f} cx={cx} cy={cy} r={5} fill="currentColor" fillOpacity={0.12} />
          );
          return null;
        })}

        {/* Frets — the nut is drawn thick when fret 0 is in view */}
        {frets.map((f) => {
          const isNut = f === 0;
          return (
            <line
              key={f}
              x1={fretX(f)} y1={PAD_T}
              x2={fretX(f)} y2={stringY(0)}
              stroke="currentColor"
              strokeWidth={isNut ? 4 : 1}
              strokeOpacity={isNut ? 0.8 : 0.25}
              strokeLinecap="round"
            />
          );
        })}

        {/* Strings */}
        {tuning.strings.map((open, s) => (
          <g key={s}>
            <line
              x1={f0X} y1={stringY(s)}
              x2={fretX(high)} y2={stringY(s)}
              stroke="currentColor" strokeWidth={1} strokeOpacity={0.3}
            />
            <text
              x={2} y={stringY(s) + 4}
              fontSize={10} fill="currentColor" fillOpacity={0.45}
            >
              {open}
            </text>
          </g>
        ))}

        {/* Fret numbers */}
        {frets.filter((f) => f >= low).map((f) => (
          <text
            key={f}
            x={dotX(f)} y={height - 6}
            textAnchor="middle" fontSize={9}
            fill="currentColor" fillOpacity={0.4}
          >
            {f}
          </text>
        ))}

        {/* Scale tones */}
        {notes.map((n) => {
          const dim = !inRange(n.fret);
          return (
            <g key={`${n.string}-${n.fret}`} opacity={dim ? 0.18 : 1}>
              <circle
                cx={dotX(n.fret)} cy={stringY(n.string)} r={DOT_R}
                className={n.isRoot ? 'fill-amber-500' : 'fill-zinc-600'}
              />
              <text
                x={dotX(n.fret)} y={stringY(n.string) + 3.5}
                textAnchor="middle" fontSize={9} fontWeight={600}
                className={n.isRoot ? 'fill-zinc-950' : 'fill-zinc-100'}
              >
                {label === 'note' ? n.note : n.degree}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
