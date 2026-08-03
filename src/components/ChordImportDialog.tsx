'use client';

import { useEffect, useMemo, useState } from 'react';
import { convertChordOverLyrics } from '@/domain/music/chord-import';

export interface ChordImportDialogProps {
  onApply:     (content: string, capo?: number) => void;
  onInsert:    (content: string, capo?: number) => void;
  onClose:     () => void;
  hasContent:  boolean;
  initialText?: string;
}

const PLACEHOLDER = `Capo 2

[Verse 1]
Am       G                                 F
Well you only need the light when it's burning low`;

export function ChordImportDialog({
  onApply,
  onInsert,
  onClose,
  hasContent,
  initialText = '',
}: ChordImportDialogProps) {
  const [raw, setRaw] = useState(initialText);

  const { content, capo, stats } = useMemo(() => convertChordOverLyrics(raw), [raw]);
  const isEmpty = content.trim() === '';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex flex-col w-full max-w-4xl h-[80vh] rounded-2xl
        bg-zinc-900 border border-zinc-800 shadow-xl overflow-hidden">

        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <h2 className="flex-1 text-sm font-semibold text-zinc-100">
            Paste &amp; Convert
            <span className="ml-2 font-normal text-zinc-500">
              chords above lyrics → ChordPro
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center w-8 h-8 rounded-lg
              text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Panes */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0 divide-y md:divide-y-0
          md:divide-x divide-zinc-800">
          <div className="flex flex-col min-h-0">
            <p className="shrink-0 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide
              text-zinc-500 bg-zinc-900/60">
              Paste here
            </p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              spellCheck={false}
              autoFocus
              placeholder={PLACEHOLDER}
              className="flex-1 w-full px-3 py-2 bg-zinc-950 text-sm font-mono leading-relaxed
                text-zinc-100 placeholder:text-zinc-700 resize-none
                focus:outline-none whitespace-pre overflow-auto"
            />
          </div>

          <div className="flex flex-col min-h-0">
            <p className="shrink-0 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide
              text-zinc-500 bg-zinc-900/60">
              ChordPro result
            </p>
            <pre className="flex-1 px-3 py-2 bg-zinc-950 text-sm font-mono leading-relaxed
              text-zinc-300 overflow-auto whitespace-pre-wrap">
              {isEmpty
                ? <span className="text-zinc-700">Result appears here.</span>
                : content}
            </pre>
          </div>
        </div>

        {/* Stats + actions */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-t border-zinc-800">
          <div className="flex-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            {isEmpty ? (
              <span>Waiting for input…</span>
            ) : (
              <>
                <Stat value={stats.chordLines}      label="chord lines" />
                <Stat value={stats.mergedLines}     label="merged into lyrics" />
                <Stat value={stats.sections}        label="sections" />
                <Stat value={stats.tabLinesRemoved} label="tab rows removed" />
                {capo !== undefined && (
                  <span className="text-amber-500">capo {capo} detected</span>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-medium
              bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>

          {hasContent && (
            <button
              type="button"
              onClick={() => onInsert(content, capo)}
              disabled={isEmpty}
              className="px-3.5 py-2 rounded-xl text-xs font-medium
                bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Insert at cursor
            </button>
          )}

          <button
            type="button"
            onClick={() => onApply(content, capo)}
            disabled={isEmpty}
            className="px-3.5 py-2 rounded-xl text-xs font-bold
              bg-amber-500 text-zinc-950 hover:bg-amber-400
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {hasContent ? 'Replace ChordPro' : 'Use this'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  if (value === 0) return null;
  return (
    <span>
      <span className="text-zinc-300 font-semibold">{value}</span> {label}
    </span>
  );
}
