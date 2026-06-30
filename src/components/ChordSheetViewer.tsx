'use client';

import { useState } from 'react';
import type { ChordProLine, ChordProSheet } from '@/domain/music/types';
import { ChordDiagram } from './ChordDiagram';
import type { Tuning } from '@/domain/music/tuning';

export type ChordState = 'synced' | 'active' | 'pending';

interface ChordSheetViewerProps {
  sheet: ChordProSheet;
  activeChordIndex?: number;
  /** Per-chord state override used by tap-sync mode. When provided, overrides activeChordIndex-based highlighting. */
  chordStatus?: (index: number) => ChordState | undefined;
  showHeader?: boolean;
  tuning?: Tuning;
}

interface IndexedLine {
  line: ChordProLine;
  lineIdx: number;
  tokenStartIndex: number;
}

function buildIndexedLines(sheet: ChordProSheet): IndexedLine[] {
  let cursor = 0;
  return sheet.lines.map((line, lineIdx) => {
    const start = cursor;
    cursor += line.tokens.filter((t) => t.chord != null && !t.marker).length;
    return { line, lineIdx, tokenStartIndex: start };
  });
}

export function ChordSheetViewer({
  sheet,
  activeChordIndex,
  chordStatus,
  showHeader = true,
  tuning,
}: ChordSheetViewerProps) {
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const indexedLines = buildIndexedLines(sheet);

  return (
    <>
      <div className="font-mono text-base leading-relaxed p-6 max-w-3xl mx-auto select-text">
        {showHeader && (sheet.title || sheet.artist) && (
          <div className="mb-6">
            {sheet.title && (
              <h2 className="text-2xl font-bold text-zinc-100">{sheet.title}</h2>
            )}
            {sheet.artist && (
              <p className="text-sm text-zinc-400 mt-1">{sheet.artist}</p>
            )}
            {sheet.key && (
              <p className="text-xs text-zinc-500 mt-1">
                Key: <span className="text-amber-400">{sheet.key}</span>
                {sheet.capo != null && sheet.capo > 0 && (
                  <> &nbsp;|&nbsp; Capo {sheet.capo}</>
                )}
              </p>
            )}
          </div>
        )}

        {indexedLines.map(({ line, lineIdx, tokenStartIndex }) => {
          if (line.type === 'directive') return null;

          if (line.type === 'comment') {
            return (
              <p key={lineIdx} className="text-xs text-zinc-600 italic py-0.5">
                {line.tokens[0]?.text}
              </p>
            );
          }

          if (line.type === 'empty') {
            return <div key={lineIdx} className="h-4" />;
          }

          return (
            <LyricLine
              key={lineIdx}
              line={line}
              tokenStartIndex={tokenStartIndex}
              activeChordIndex={activeChordIndex}
              chordStatus={chordStatus}
              onChordClick={setSelectedChord}
            />
          );
        })}
      </div>

      {selectedChord && (
        <ChordDiagram chord={selectedChord} tuning={tuning} onClose={() => setSelectedChord(null)} />
      )}
    </>
  );
}

interface LyricLineProps {
  line: ChordProLine;
  tokenStartIndex: number;
  activeChordIndex?: number;
  chordStatus?: (index: number) => ChordState | undefined;
  onChordClick: (chord: string) => void;
}

function LyricLine({
  line,
  tokenStartIndex,
  activeChordIndex,
  chordStatus,
  onChordClick,
}: LyricLineProps) {
  let chordOffset = 0;

  return (
    // pt-6 (24px) reserves vertical space above the lyric row for chord names.
    // Chords are position:absolute so they don't affect lyric layout width.
    <div className="relative pt-6 mb-1">
      {line.tokens.map((token, tokenIdx) => {
        const isRealChord = token.chord != null && !token.marker;
        const globalIdx = isRealChord ? tokenStartIndex + chordOffset++ : -1;

        // Derive visual state: prefer chordStatus callback (tap-sync), fall back to activeChordIndex.
        const state: ChordState | undefined = chordStatus
          ? chordStatus(globalIdx)
          : isRealChord && globalIdx === activeChordIndex
            ? 'active'
            : undefined;

        return (
          <span
            key={tokenIdx}
            // relative: containing block for absolute chord span
            // inline-block: participates in block container's inline flow
            // whitespace-pre: preserves spaces; Thai chars flow gaplessly between adjacent spans
            className="relative inline-block whitespace-pre text-zinc-200"
          >
            {token.chord != null && (
              <>
                {/* Ghost: display:block, height:0, overflow:hidden, white-space:nowrap.
                    Being a block child of inline-block, it contributes to the parent's
                    shrink-to-fit width via CSS max-content sizing:
                      segment width = max(ghost width, lyric width)
                    → chord > lyric (intro/solo lines): segment expands → chords don't overlap
                    → lyric > chord (Thai lyrics): segment stays lyric-sized → no gaps inserted
                    Not visible, not selectable, not announced by screen readers (aria-hidden). */}
                <span
                  aria-hidden
                  style={{
                    display: 'block',
                    height: 0,
                    overflow: 'hidden',
                    visibility: 'hidden',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    pointerEvents: 'none',
                    fontWeight: 'bold',
                    // left padding matches chord button px-0.5; right adds px-0.5 + 0.5ch gap
                    padding: '0 calc(0.125rem + 0.5ch) 0 0.125rem',
                  }}
                >
                  {token.chord}
                </span>

                {/* Chord: absolutely positioned above — no impact on segment width */}
                <span className="absolute bottom-full left-0 whitespace-nowrap leading-none pb-0.5">
                  {token.marker ? (
                    <span className="text-base font-mono text-zinc-500 select-none">
                      {token.chord}
                    </span>
                  ) : (
                    <button
                      onClick={() => onChordClick(token.chord!)}
                      data-chord-idx={globalIdx >= 0 ? globalIdx : undefined}
                      className={[
                        'text-base font-bold font-mono px-0.5 rounded leading-none',
                        'transition-colors cursor-pointer select-none hover:bg-amber-400/20',
                        state === 'active'
                          ? 'text-amber-300 bg-amber-400/30 ring-1 ring-amber-400/50'
                          : state === 'synced'
                            ? 'text-amber-600'
                            : 'text-amber-400',
                      ].join(' ')}
                    >
                      {token.chord}
                    </button>
                  )}
                </span>
              </>
            )}
            {/* Zero-width space anchors inline-block height when text is empty,
                ensuring bottom:100% on the chord span calculates correctly. */}
            {token.text || (token.chord != null ? '​' : '')}
          </span>
        );
      })}
    </div>
  );
}
