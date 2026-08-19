'use client';

import type { AccentLevel } from '@/domain/music/timeSignature';

// ─── Beat dot colors per accent level ────────────────────────────────────────

export function accentClass(accent: AccentLevel, active: boolean): string {
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
  accents:     AccentLevel[];
  currentBeat: number;
  isPlaying:   boolean;
  size?:       'sm' | 'lg' | 'xl';
}

const DIMENSIONS = {
  sm: { dim: 'w-2 h-2',   gap: 'gap-1.5', speed: 'duration-100' },
  lg: { dim: 'w-4 h-4',   gap: 'gap-2',   speed: 'duration-75'  },
  xl: { dim: 'w-6 h-6',   gap: 'gap-3',   speed: 'duration-75'  },
} as const;

export function BeatDots({ accents, currentBeat, isPlaying, size = 'lg' }: BeatDotsProps) {
  const { dim, gap, speed } = DIMENSIONS[size];

  return (
    <div className={`flex flex-wrap items-center justify-center ${gap}`}>
      {accents.map((accent, i) => (
        <div
          key={i}
          className={[
            dim, 'rounded-full transition-all', speed,
            accentClass(accent, isPlaying && currentBeat === i),
          ].join(' ')}
        />
      ))}
    </div>
  );
}
