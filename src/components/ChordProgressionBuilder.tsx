'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getDiatonicChords } from '@/domain/music/chord-placer';
import type { ChordSection } from '@/domain/music/types';

const COMMON_CHORDS = [
  'C', 'D', 'E', 'F', 'G', 'A', 'B',
  'C#', 'D#', 'F#', 'G#', 'A#', 'Db', 'Eb', 'Gb', 'Ab', 'Bb',
  'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm',
  'C#m', 'D#m', 'F#m', 'G#m', 'A#m', 'Dbm', 'Ebm', 'Gbm', 'Abm', 'Bbm',
  'C7', 'D7', 'E7', 'F7', 'G7', 'A7', 'B7', 'C#7', 'F#7', 'G#7', 'Bb7', 'Eb7', 'Ab7',
  'Cmaj7', 'Dmaj7', 'Emaj7', 'Fmaj7', 'Gmaj7', 'Amaj7', 'Bmaj7',
  'C#maj7', 'F#maj7', 'Bbmaj7', 'Ebmaj7', 'Abmaj7',
  'Cm7', 'Dm7', 'Em7', 'Fm7', 'Gm7', 'Am7', 'Bm7',
  'C#m7', 'D#m7', 'F#m7', 'G#m7', 'Bbm7', 'Ebm7',
  'Csus2', 'Dsus2', 'Esus2', 'Fsus2', 'Gsus2', 'Asus2', 'Bsus2',
  'Csus4', 'Dsus4', 'Esus4', 'Fsus4', 'Gsus4', 'Asus4', 'Bsus4',
  'Cadd9', 'Dadd9', 'Eadd9', 'Fadd9', 'Gadd9', 'Aadd9', 'Badd9',
  'C9', 'D9', 'E9', 'F9', 'G9', 'A9', 'B9',
  'Cdim', 'Ddim', 'Edim', 'Fdim', 'Gdim', 'Adim', 'Bdim',
  'Cdim7', 'Ddim7', 'Edim7', 'Gdim7', 'Bdim7',
  'Caug', 'Daug', 'Eaug', 'Faug', 'Gaug', 'Aaug',
  'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'F#5', 'G#5', 'Bb5',
];

type ProgressionItem =
  | { type: 'chord'; value: string; id: string; beats: number }
  | { type: 'bar'; id: string };

type PickerMode =
  | { mode: 'new' }
  | { mode: 'edit'; itemId: string };

export interface ChordProgressionBuilderProps {
  onInsert:         (chordProText: string, section: ChordSection) => void;
  onClose:          () => void;
  keyContext?:      string;
}

let _uid = 0;
const nextId = () => `pg-${++_uid}`;

function buildChordProText(label: string, items: ProgressionItem[]): string {
  const line = items
    .map(item => item.type === 'bar' ? '[/]' : `[${item.value}]`)
    .join('');
  return label.trim() ? `# ${label.trim()}\n${line}` : line;
}

export function ChordProgressionBuilder({
  onInsert,
  onClose,
  keyContext,
}: ChordProgressionBuilderProps) {
  const [items,   setItems]   = useState<ProgressionItem[]>([]);
  const [label,   setLabel]   = useState('');
  const [repeat,  setRepeat]  = useState(1);
  const [picker,  setPicker]  = useState<PickerMode | null>(null);
  const [search,  setSearch]  = useState('');
  const [offset,  setOffset]  = useState({ x: 0, y: 0 });
  const [inserted, setInserted] = useState(false);

  const dragging    = useRef(false);
  const dragOrigin  = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const pickerInput = useRef<HTMLInputElement>(null);

  const diatonic     = keyContext ? getDiatonicChords(keyContext) : [];
  const chordProText = buildChordProText(label, items);

  // Focus picker input on open, pre-fill with existing chord value when editing
  useEffect(() => {
    if (!picker) return;
    const prefill =
      picker.mode === 'edit'
        ? (items.find(i => i.id === picker.itemId) as Extract<ProgressionItem, { type: 'chord' }> | undefined)
            ?.value ?? ''
        : '';
    setSearch(prefill);
    const t = setTimeout(() => { pickerInput.current?.focus(); pickerInput.current?.select(); }, 10);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker]);

  // Drag: mouse events on window
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setOffset({
        x: dragOrigin.current.ox + e.clientX - dragOrigin.current.mx,
        y: dragOrigin.current.oy + e.clientY - dragOrigin.current.my,
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'BUTTON' || tag === 'INPUT') return;
    dragging.current = true;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
    e.preventDefault();
  };

  const selectChord = useCallback((chord: string) => {
    if (!chord.trim()) return;
    if (picker?.mode === 'edit') {
      const id = picker.itemId;
      setItems(prev => prev.map(item =>
        item.id === id
          ? { type: 'chord', value: chord, id, beats: (item as Extract<ProgressionItem, { type: 'chord' }>).beats ?? 4 }
          : item,
      ));
      setPicker(null);
    } else {
      setItems(prev => [...prev, { type: 'chord', value: chord, id: nextId(), beats: 4 }]);
      setSearch('');
      pickerInput.current?.focus();
    }
  }, [picker]);

  const submitSearch = () => selectChord(search.trim());

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    setPicker(null);
  };

  const addBar = () => {
    setItems(prev => [...prev, { type: 'bar', id: nextId() }]);
  };

  const handleInsert = () => {
    if (!items.length) return;
    const chordBeats = items
      .filter((i): i is Extract<ProgressionItem, { type: 'chord' }> => i.type === 'chord')
      .map(i => ({ chord: i.value, beats: i.beats }));
    const section: ChordSection = {
      label:  label.trim() || 'Section',
      chords: chordBeats,
      repeat,
    };
    onInsert(chordProText, section);
    setItems([]);
    setLabel('');
    setRepeat(1);
    setPicker(null);
    setInserted(true);
    setTimeout(() => setInserted(false), 1500);
  };

  const currentEditValue =
    picker?.mode === 'edit'
      ? (items.find(i => i.id === picker.itemId) as Extract<ProgressionItem, { type: 'chord' }> | undefined)?.value
      : undefined;

  const filteredCommon = COMMON_CHORDS.filter(c => {
    if (diatonic.includes(c)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.toLowerCase().startsWith(q);
  });

  return (
    <div
      style={{
        position:  'fixed',
        bottom:    '1.5rem',
        right:     '1.5rem',
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        zIndex:    60,
        width:     400,
        maxWidth:  'calc(100vw - 2rem)',
        maxHeight: '80vh',
      }}
      className="flex flex-col rounded-2xl bg-zinc-900 border border-zinc-700
        shadow-2xl shadow-black/60 overflow-hidden"
    >
      {/* ── Header / drag handle ── */}
      <div
        className="shrink-0 flex items-center gap-2 px-4 py-3
          border-b border-zinc-800 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleHeaderMouseDown}
      >
        <span className="text-zinc-600 text-base leading-none" aria-hidden>⠿</span>
        <h2 className="flex-1 text-sm font-semibold text-zinc-200">Chord Progression</h2>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-7 h-7 rounded-lg
            text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Label input */}
        <div className="px-4 pt-3 pb-2">
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Section label (e.g. Intro, Solo, Bridge…)"
            className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700
              text-sm text-zinc-100 placeholder:text-zinc-600
              focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500
              transition-colors"
          />
        </div>

        {/* ── Chord sequence ── */}
        <div className="px-4 py-2 flex flex-wrap gap-1.5 items-center min-h-[44px]">
          {items.map(item => {
            const isEditing = picker?.mode === 'edit' && picker.itemId === item.id;
            if (item.type === 'bar') {
              return (
                <button
                  key={item.id}
                  onClick={() => deleteItem(item.id)}
                  title="Click to remove bar separator"
                  className="px-2 h-8 rounded-lg font-mono text-sm
                    text-zinc-500 border border-zinc-700
                    hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  /
                </button>
              );
            }
            return (
              <div key={item.id} className="flex flex-col items-center gap-0.5">
                <button
                  onClick={() =>
                    isEditing ? setPicker(null) : setPicker({ mode: 'edit', itemId: item.id })
                  }
                  className={[
                    'px-2.5 h-8 rounded-lg text-sm font-mono font-bold transition-colors',
                    isEditing
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30',
                  ].join(' ')}
                >
                  {item.value}
                </button>
                <button
                  onClick={() => setItems(prev => prev.map(p =>
                    p.id === item.id && p.type === 'chord'
                      ? { ...p, beats: p.beats >= 8 ? 1 : p.beats + 1 }
                      : p,
                  ))}
                  title="Beats (click to change)"
                  className="text-[9px] text-zinc-600 hover:text-amber-400 transition-colors tabular-nums leading-none"
                >
                  {item.beats}b
                </button>
              </div>
            );
          })}

          {items.length === 0 && !picker && (
            <span className="text-xs text-zinc-600 select-none">Press + Chord to start…</span>
          )}

          {/* Action buttons */}
          <button
            onClick={() => setPicker(p => p?.mode === 'new' ? null : { mode: 'new' })}
            className={[
              'px-2.5 h-8 rounded-lg text-xs font-medium transition-colors',
              picker?.mode === 'new'
                ? 'bg-zinc-600 text-zinc-100'
                : 'bg-zinc-800 border border-dashed border-zinc-600 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
            ].join(' ')}
          >
            + Chord
          </button>
          <button
            onClick={addBar}
            title="Add bar separator [/]"
            className="px-2.5 h-8 rounded-lg text-xs font-medium font-mono
              bg-zinc-800 border border-dashed border-zinc-600 text-zinc-500
              hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
          >
            | Bar
          </button>
        </div>

        {/* ── Chord picker ── */}
        {picker && (
          <div className="mx-4 mb-3 rounded-xl border border-zinc-700 bg-zinc-800/50 overflow-hidden">

            {/* Edit mode: show current chord + remove button */}
            {picker.mode === 'edit' && currentEditValue && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-700/60">
                <span className="font-mono font-bold text-sm text-amber-400 flex-1">
                  {currentEditValue}
                </span>
                <button
                  onClick={() => picker.mode === 'edit' && deleteItem(picker.itemId)}
                  className="px-2.5 py-1 rounded-lg text-xs
                    text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Remove
                </button>
              </div>
            )}

            <div className="p-2.5 space-y-2.5 max-h-56 overflow-y-auto">

              {/* Custom input */}
              <div className="flex gap-1.5">
                <input
                  ref={pickerInput}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter')  { e.preventDefault(); submitSearch(); }
                    if (e.key === 'Escape') { e.preventDefault(); setPicker(null); }
                  }}
                  placeholder="Type chord name…"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700
                    text-sm font-mono text-zinc-100 placeholder:text-zinc-600
                    focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
                <button
                  onClick={submitSearch}
                  disabled={!search.trim()}
                  className="px-3 rounded-lg bg-amber-500 text-zinc-950 text-sm font-bold
                    hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ↵
                </button>
              </div>

              {/* Diatonic chords */}
              {diatonic.length > 0 && (
                <ChordGroup
                  label="Diatonic"
                  chords={diatonic}
                  onSelect={selectChord}
                  highlight
                />
              )}

              {/* Common chords */}
              <ChordGroup
                label="Common"
                chords={filteredCommon.slice(0, 48)}
                onSelect={selectChord}
              />
            </div>
          </div>
        )}

        {/* ── Preview ── */}
        {items.length > 0 && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-1">
              Preview
            </p>
            <pre className="font-mono text-xs text-zinc-400 whitespace-pre-wrap break-all">
              {chordProText}
            </pre>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="px-4 pb-4 flex items-center gap-2">
          {items.length > 0 && (
            <button
              onClick={() => { setItems([]); setLabel(''); setRepeat(1); setPicker(null); }}
              className="px-3 py-2 rounded-xl text-xs text-zinc-500
                hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Clear
            </button>
          )}
          <div className="flex-1" />

          {/* Repeat stepper */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Repeat</span>
            <button
              onClick={() => setRepeat(r => Math.max(0, r - 1))}
              disabled={repeat === 0}
              className="w-6 h-6 rounded-md bg-zinc-800 text-zinc-400
                hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-30 transition-colors text-sm font-bold"
            >−</button>
            <span className="w-6 text-center text-sm font-mono text-zinc-200 tabular-nums">
              {repeat === 0 ? '∞' : repeat}
            </span>
            <button
              onClick={() => setRepeat(r => r + 1)}
              className="w-6 h-6 rounded-md bg-zinc-800 text-zinc-400
                hover:bg-zinc-700 hover:text-zinc-200 transition-colors text-sm font-bold"
            >+</button>
          </div>
          <button
            onClick={handleInsert}
            disabled={items.length === 0}
            className={[
              'px-4 py-2 rounded-xl text-sm font-bold transition-colors',
              inserted
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {inserted ? 'Inserted ✓' : 'Insert into ChordPro ↵'}
          </button>
        </div>
      </div>
    </div>
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
        {chords.map(chord => (
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
