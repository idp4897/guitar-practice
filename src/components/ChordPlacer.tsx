'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ChordLine,
  type EditorLine,
  getDiatonicChords,
  graphemes,
  insertChord,
  moveChord,
  parseToEditorLines,
  removeChord,
  serializeEditorLines,
} from '@/domain/music/chord-placer';

// ─── Common chord palette ─────────────────────────────────────────────────────

const COMMON_CHORDS = [
  // Natural majors
  'C', 'D', 'E', 'F', 'G', 'A', 'B',
  // Sharp/flat majors
  'C#', 'D#', 'F#', 'G#', 'A#',
  'Db', 'Eb', 'Gb', 'Ab', 'Bb',
  // Natural minors
  'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm',
  // Sharp/flat minors
  'C#m', 'D#m', 'F#m', 'G#m', 'A#m',
  'Dbm', 'Ebm', 'Gbm', 'Abm', 'Bbm',
  // Dominant 7th
  'C7', 'D7', 'E7', 'F7', 'G7', 'A7', 'B7',
  'C#7', 'F#7', 'G#7', 'Bb7', 'Eb7', 'Ab7',
  // Major 7th
  'Cmaj7', 'Dmaj7', 'Emaj7', 'Fmaj7', 'Gmaj7', 'Amaj7', 'Bmaj7',
  'C#maj7', 'F#maj7', 'Bbmaj7', 'Ebmaj7', 'Abmaj7',
  // Minor 7th
  'Cm7', 'Dm7', 'Em7', 'Fm7', 'Gm7', 'Am7', 'Bm7',
  'C#m7', 'D#m7', 'F#m7', 'G#m7', 'Bbm7', 'Ebm7',
  // sus2
  'Csus2', 'Dsus2', 'Esus2', 'Fsus2', 'Gsus2', 'Asus2', 'Bsus2',
  // sus4
  'Csus4', 'Dsus4', 'Esus4', 'Fsus4', 'Gsus4', 'Asus4', 'Bsus4',
  // add9
  'Cadd9', 'Dadd9', 'Eadd9', 'Fadd9', 'Gadd9', 'Aadd9', 'Badd9',
  // 9th
  'C9', 'D9', 'E9', 'F9', 'G9', 'A9', 'B9',
  // Minor 9th
  'Cm9', 'Dm9', 'Em9', 'Gm9', 'Am9',
  // 6th
  'C6', 'D6', 'E6', 'F6', 'G6', 'A6', 'B6',
  // Minor 6th
  'Cm6', 'Dm6', 'Em6', 'Am6',
  // Diminished
  'Cdim', 'Ddim', 'Edim', 'Fdim', 'Gdim', 'Adim', 'Bdim',
  'C#dim', 'F#dim',
  // Diminished 7th
  'Cdim7', 'Ddim7', 'Edim7', 'Gdim7', 'Bdim7',
  // Augmented
  'Caug', 'Daug', 'Eaug', 'Faug', 'Gaug', 'Aaug',
  // Power chords
  'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5',
  'F#5', 'G#5', 'Bb5',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaletteTarget {
  lineIdx:   number;
  charIdx:   number;
  existing?: string;
  anchorX:   number;  // viewport px for palette positioning
  anchorY:   number;
}

// ─── ChordPlacer (root) ───────────────────────────────────────────────────────

export interface ChordPlacerProps {
  content:     string;
  onChange:    (content: string) => void;
  keyContext?: string;   // detected key for diatonic suggestions
}

export function ChordPlacer({ content, onChange, keyContext }: ChordPlacerProps) {
  const [lines,   setLines]   = useState<EditorLine[]>(() => parseToEditorLines(content));
  const [palette, setPalette] = useState<PaletteTarget | null>(null);

  // Re-parse when content changes from outside (e.g. switching from Text tab)
  useEffect(() => {
    const current = serializeEditorLines(lines);
    if (current !== content) {
      setLines(parseToEditorLines(content));
      setPalette(null);
    }
    // `lines` intentionally excluded — we only want to sync when `content` changes externally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const handleCharClick = useCallback((
    e: React.MouseEvent,
    lineIdx: number,
    charIdx: number,
    existing: string | undefined,
  ) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPalette({ lineIdx, charIdx, existing, anchorX: rect.left, anchorY: rect.bottom });
  }, []);

  const handlePaletteSelect = useCallback((chord: string) => {
    if (!palette) return;
    const next = lines.map((l, i) => {
      if (i !== palette.lineIdx || l.kind !== 'lyric') return l;
      return { kind: 'lyric' as const, data: insertChord(l.data, palette.charIdx, chord) };
    });
    setLines(next);
    onChange(serializeEditorLines(next));
    setPalette(null);
  }, [palette, lines, onChange]);

  const handlePaletteDelete = useCallback(() => {
    if (!palette) return;
    const next = lines.map((l, i) => {
      if (i !== palette.lineIdx || l.kind !== 'lyric') return l;
      return { kind: 'lyric' as const, data: removeChord(l.data, palette.charIdx) };
    });
    setLines(next);
    onChange(serializeEditorLines(next));
    setPalette(null);
  }, [palette, lines, onChange]);

  const handlePaletteMove = useCallback((delta: -1 | 1) => {
    if (!palette) return;
    const next = lines.map((l, i) => {
      if (i !== palette.lineIdx || l.kind !== 'lyric') return l;
      return {
        kind: 'lyric' as const,
        data: moveChord(l.data, palette.charIdx, palette.charIdx + delta),
      };
    });
    setLines(next);
    onChange(serializeEditorLines(next));
    setPalette((p) => p ? { ...p, charIdx: p.charIdx + delta } : null);
  }, [palette, lines, onChange]);

  const diatonicChords = keyContext ? getDiatonicChords(keyContext) : [];

  return (
    <div className="relative flex flex-col h-full bg-zinc-950 overflow-y-auto">

      {/* Hint bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2
        border-b border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/30 inline-block" />
          Click any character to place a chord above it
        </span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:inline">Click an existing chord to edit or move it</span>
      </div>

      {/* Lines */}
      <div className="flex-1 px-4 py-4 font-mono text-base leading-relaxed max-w-3xl mx-auto w-full">
        {lines.map((line, lineIdx) => (
          <EditorLineView
            key={lineIdx}
            line={line}
            lineIdx={lineIdx}
            onCharClick={handleCharClick}
          />
        ))}
        {/* Spacer so last line has room below */}
        <div className="h-16" />
      </div>

      {/* Palette popup */}
      {palette && (
        <ChordPalette
          target={palette}
          diatonic={diatonicChords}
          onSelect={handlePaletteSelect}
          onDelete={palette.existing ? handlePaletteDelete : undefined}
          onMove={palette.existing ? handlePaletteMove : undefined}
          onClose={() => setPalette(null)}
        />
      )}
    </div>
  );
}

// ─── EditorLineView ───────────────────────────────────────────────────────────

interface EditorLineViewProps {
  line:         EditorLine;
  lineIdx:      number;
  onCharClick:  (e: React.MouseEvent, lineIdx: number, charIdx: number, existing: string | undefined) => void;
}

function EditorLineView({ line, lineIdx, onCharClick }: EditorLineViewProps) {
  if (line.kind === 'raw') {
    const t = line.text.trim();
    if (t === '') return <div className="h-4" />;
    if (t.startsWith('{'))
      return <p className="text-xs text-zinc-600 italic py-0.5">{line.text}</p>;
    if (t.startsWith('#'))
      return <p className="text-xs text-zinc-600 py-0.5">{line.text}</p>;
    return <p className="text-zinc-400 py-0.5">{line.text}</p>;
  }

  return <LyricLineView line={line.data} lineIdx={lineIdx} onCharClick={onCharClick} />;
}

// ─── LyricLineView ────────────────────────────────────────────────────────────

interface LyricLineViewProps {
  line:        ChordLine;
  lineIdx:     number;
  onCharClick: (e: React.MouseEvent, lineIdx: number, charIdx: number, existing: string | undefined) => void;
}

function LyricLineView({ line, lineIdx, onCharClick }: LyricLineViewProps) {
  const gs       = graphemes(line.text);
  const chordMap = new Map(line.chords.map((c) => [c.charIndex, c.chord]));

  // A chord-only line (no text) — render a special placeholder row
  if (gs.length === 0 && line.chords.length > 0) {
    return (
      <div className="flex items-end gap-2 mb-1 pt-7 select-none">
        {line.chords.map(({ charIndex, chord }) => (
          <button
            key={charIndex}
            onClick={(e) => onCharClick(e, lineIdx, charIndex, chord)}
            className="font-mono font-bold text-sm text-amber-400 px-1 rounded
              hover:bg-amber-400/20 transition-colors"
          >
            {chord}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end mb-1 pt-7 leading-none select-none">
      {gs.map((g, i) => {
        const chord = chordMap.get(i);
        return (
          <CharCell
            key={i}
            grapheme={g}
            chord={chord}
            onClick={(e) => onCharClick(e, lineIdx, i, chord)}
          />
        );
      })}

      {/* End-of-line click target — place chord after last character */}
      <CharCell
        grapheme=""
        chord={chordMap.get(gs.length)}
        onClick={(e) => onCharClick(e, lineIdx, gs.length, chordMap.get(gs.length))}
        isEol
      />
    </div>
  );
}

// ─── CharCell ─────────────────────────────────────────────────────────────────

interface CharCellProps {
  grapheme:  string;
  chord?:    string;
  onClick:   (e: React.MouseEvent) => void;
  isEol?:    boolean;
}

function CharCell({ grapheme, chord, onClick, isEol }: CharCellProps) {
  return (
    <span
      className="relative inline-block group cursor-pointer"
      onClick={onClick}
    >
      {/* Chord floating above */}
      {chord && (
        <span className="absolute bottom-full left-0 pb-px
          font-mono font-bold text-xs text-amber-400 whitespace-nowrap
          select-none pointer-events-none leading-none">
          {chord}
        </span>
      )}

      {/* The grapheme (or invisible end-of-line target) */}
      <span className={[
        'inline-block px-px rounded-sm transition-colors leading-snug',
        isEol
          ? 'min-w-[0.75rem] opacity-0 group-hover:opacity-100 group-hover:bg-amber-400/15'
          : [
              chord
                ? 'text-zinc-200 bg-amber-500/10 group-hover:bg-amber-400/30'
                : 'text-zinc-300 group-hover:bg-amber-400/20 group-hover:text-zinc-100',
            ].join(' '),
      ].join(' ')}>
        {grapheme === ' ' ? ' ' : grapheme || '​'}
      </span>
    </span>
  );
}

// ─── ChordPalette ─────────────────────────────────────────────────────────────

interface ChordPaletteProps {
  target:    PaletteTarget;
  diatonic:  string[];
  onSelect:  (chord: string) => void;
  onDelete?: () => void;
  onMove?:   (delta: -1 | 1) => void;
  onClose:   () => void;
}

function ChordPalette({ target, diatonic, onSelect, onDelete, onMove, onClose }: ChordPaletteProps) {
  const [custom, setCustom] = useState(target.existing ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Position palette: below anchor, clamped to viewport
  const PALETTE_W = 296;
  const left = Math.min(target.anchorX, (typeof window !== 'undefined' ? window.innerWidth : 800) - PALETTE_W - 8);
  const top  = target.anchorY + 6;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleCustomSubmit = () => {
    const chord = custom.trim();
    if (chord) onSelect(chord);
  };

  // Keyboard: Escape closes, Enter submits custom
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Click-outside backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Palette panel */}
      <div
        style={{ position: 'fixed', left, top, width: PALETTE_W, zIndex: 50 }}
        className="rounded-2xl bg-zinc-900 border border-zinc-700
          shadow-xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: current chord + actions */}
        {target.existing ? (
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800">
            <span className="font-mono font-bold text-sm text-amber-400 flex-1">
              {target.existing}
            </span>
            {onMove && (
              <>
                <button onClick={() => onMove(-1)}
                  className="px-2 h-7 rounded-lg text-zinc-400 bg-zinc-800
                    hover:bg-zinc-700 hover:text-zinc-100 text-xs transition-colors"
                  title="Move left">
                  ←
                </button>
                <button onClick={() => onMove(+1)}
                  className="px-2 h-7 rounded-lg text-zinc-400 bg-zinc-800
                    hover:bg-zinc-700 hover:text-zinc-100 text-xs transition-colors"
                  title="Move right">
                  →
                </button>
              </>
            )}
            {onDelete && (
              <button onClick={onDelete}
                className="px-2 h-7 rounded-lg text-red-500/70 bg-zinc-800
                  hover:bg-red-500/15 hover:text-red-400 text-xs transition-colors"
                title="Remove chord">
                ✕
              </button>
            )}
          </div>
        ) : (
          <div className="px-3 py-2 border-b border-zinc-800">
            <p className="text-xs text-zinc-500">Place chord</p>
          </div>
        )}

        <div className="p-2.5 space-y-2.5 max-h-72 overflow-y-auto">

          {/* Custom input */}
          <div className="flex gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') { e.preventDefault(); handleCustomSubmit(); }
              }}
              placeholder="Type chord…"
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700
                text-sm font-mono text-zinc-100 placeholder:text-zinc-600
                focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!custom.trim()}
              className="px-3 rounded-lg bg-amber-500 text-zinc-950 text-sm font-bold
                hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ↵
            </button>
          </div>

          {/* Diatonic group */}
          {diatonic.length > 0 && (
            <ChordGroup label="Diatonic" chords={diatonic} onSelect={onSelect} highlight />
          )}

          {/* Common chords — filtered by typed input, excluding diatonic */}
          <ChordGroup
            label="Common"
            chords={COMMON_CHORDS.filter((c) => {
              if (diatonic.includes(c)) return false;
              const q = custom.trim().toLowerCase();
              if (q === '') return false;
              return q.length < 2 || c.toLowerCase().startsWith(q);
            })}
            onSelect={onSelect}
          />
        </div>
      </div>
    </>
  );
}

// ─── ChordGroup ───────────────────────────────────────────────────────────────

function ChordGroup({
  label, chords, onSelect, highlight,
}: {
  label:      string;
  chords:     string[];
  onSelect:   (c: string) => void;
  highlight?: boolean;
}) {
  if (chords.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-1.5">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {chords.map((chord) => (
          <button
            key={chord}
            onClick={() => onSelect(chord)}
            className={[
              'px-2.5 py-1 rounded-lg font-mono text-xs font-semibold transition-colors touch-manipulation',
              highlight
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/35'
                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-100',
            ].join(' ')}
          >
            {chord}
          </button>
        ))}
      </div>
    </div>
  );
}
