'use client';

import type { ChordPosition } from '@/domain/music/tuning';

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

export interface FretDiagramProps {
  position:    ChordPosition;
  stringNames: string[];
  width?:      number;
}

export function FretDiagram({ position, stringNames, width = SVG_W }: FretDiagramProps) {
  const { frets, fingers, baseFret, barres } = position;
  const isOpenPosition = baseFret === 1;
  const barreSet = new Set(barres);

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width={width}
      height={(width / SVG_W) * SVG_H}
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
