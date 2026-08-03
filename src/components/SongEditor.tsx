'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { extractChords, parseChordPro } from '@/domain/music/chordpro';
import { detectKeyBySection, detectPossibleKeys, formatSongKey, parseSongKey } from '@/domain/music/theory';
import type { ChordSection, SectionAnalysisResult, SongKey } from '@/domain/music/types';
import { getTuning, TUNINGS } from '@/domain/music/tuning';
import { validateBpm } from '@/domain/music/bpm';
import { createSongAction, quickSaveSongAction, updateSongAction } from '@/application/songs/song.actions';
import { deriveChordGrid } from '@/domain/music/chordgrid';
import { looksLikeChordOverLyrics } from '@/domain/music/chord-import';
import { ChordSheetViewer } from './ChordSheetViewer';
import { ChordGridEditor } from './ChordGridEditor';
import { ChordImportDialog } from './ChordImportDialog';
import { ChordPlacer } from './ChordPlacer';
import { ChordProgressionBuilder } from './ChordProgressionBuilder';
import type { KeyCandidate } from '@/domain/music/types';
import type { StoredSong } from '@/lib/song-store';

const CAPO_MAX = 12;
const TAP_MAX_GAP_MS = 2500;

function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

interface SongEditorProps {
  song?: StoredSong;
}

export function SongEditor({ song }: SongEditorProps) {
  const isEdit = !!song;
  const router = useRouter();

  const [title,        setTitle]        = useState(song?.title        ?? '');
  const [artist,       setArtist]       = useState(song?.artist       ?? '');
  const [userKey,      setUserKey]      = useState(song?.preferredKey ?? '');
  const [tuningId,     setTuningId]     = useState(song?.tuning       ?? 'standard');
  const [capo,         setCapo]         = useState(song?.capo         ?? 0);
  const [bpmInput,     setBpmInput]     = useState(song?.bpm?.toString() ?? '');
  const [keys,         setKeys]         = useState<SongKey[]>(
    song?.keys ?? (song?.originalKey ? [parseSongKey(song.originalKey)] : []),
  );
  const [addingKey,    setAddingKey]    = useState(false);
  const [newKeyRoot,   setNewKeyRoot]   = useState('');
  const [newKeyMode,   setNewKeyMode]   = useState<'major' | 'minor'>('major');
  const [newKeyLabel,  setNewKeyLabel]  = useState('');
  const [youtubeUrl,   setYoutubeUrl]   = useState(song?.youtubeUrl   ?? '');
  const [content,      setContent]      = useState(song?.content      ?? '');
  const [chordGrid,    setChordGrid]    = useState<ChordSection[]>(song?.chordGrid ?? []);
  const [chordGridHash, setChordGridHash] = useState(song?.chordGridContentHash);
  const [gridWarningDismissed, setGridWarningDismissed] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<'form' | 'preview' | 'visual'>('form');
  const [rightPanel,   setRightPanel]   = useState<'preview' | 'visual'>('preview');
  const [showGrid,     setShowGrid]     = useState((song?.chordGrid?.length ?? 0) > 0);
  const [showBuilder,  setShowBuilder]  = useState(false);
  const [showImport,   setShowImport]   = useState(false);
  const [convertHint,  setConvertHint]  = useState(false);
  const [pending,      startTransition] = useTransition();
  const [quickPending, startQuickTransition] = useTransition();
  const [quickSaved,   setQuickSaved]   = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const tapTimesRef = useRef<number[]>([]);
  const savedRef = useRef(false);
  const quickSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => {
    if (quickSavedTimeoutRef.current) clearTimeout(quickSavedTimeoutRef.current);
  }, []);

  const buildSnapshot = useCallback(() => JSON.stringify({
    title, artist, userKey, tuningId, capo, bpmInput, keys, youtubeUrl, content, chordGrid, chordGridHash,
  }), [title, artist, userKey, tuningId, capo, bpmInput, keys, youtubeUrl, content, chordGrid, chordGridHash]);

  const initialSnapshotRef = useRef<string | null>(null);
  if (initialSnapshotRef.current === null) {
    initialSnapshotRef.current = buildSnapshot();
  }

  const isDirty = !savedRef.current && buildSnapshot() !== initialSnapshotRef.current;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleBack = useCallback(() => {
    if (isDirty) { setShowLeaveConfirm(true); return; }
    router.back();
  }, [isDirty, router]);

  const preview       = parseChordPro(content);
  const candidates    = detectPossibleKeys(extractChords(preview));
  const sectionResult = detectKeyBySection(preview);
  const effectiveKey  = userKey || candidates[0]?.key || '';

  const suggestedKeys: SongKey[] = sectionResult.sections
    .filter(s => s.key !== null)
    .map(s => ({ ...parseSongKey(s.key!), label: s.label }))
    .filter(sk => !keys.some(k => k.key === sk.key && k.mode === sk.mode));

  const handleBpmTap = useCallback(() => {
    const now = performance.now();
    tapTimesRef.current = [
      ...tapTimesRef.current.filter((t) => now - t < TAP_MAX_GAP_MS),
      now,
    ].slice(-8);

    if (tapTimesRef.current.length >= 2) {
      const taps = tapTimesRef.current;
      const intervals = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpmInput(Math.round(60_000 / avg).toString());
    }
  }, []);

  const handleAutoBuild = useCallback(() => {
    const derived = deriveChordGrid(preview);
    if (derived.length === 0) return;
    setChordGrid(derived);
    setChordGridHash(hashStr(content));
    setGridWarningDismissed(false);
  }, [preview, content]);

  const insertAtCursor = useCallback((text: string) => {
    setContent(prev => {
      const el  = contentRef.current;
      const pos = el ? el.selectionStart : prev.length;
      const before = prev.slice(0, pos);
      const after  = prev.slice(pos);

      const insertion =
        (before.length > 0 && !before.endsWith('\n') ? '\n' : '') +
        text +
        (after.length > 0 && !after.startsWith('\n') ? '\n' : '');

      const caret = before.length + insertion.length;
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(caret, caret);
      });

      return before + insertion + after;
    });
  }, []);

  const handleImportApply = useCallback((text: string, importedCapo?: number) => {
    setContent(text);
    if (importedCapo !== undefined) setCapo(importedCapo);
    setShowImport(false);
    setConvertHint(false);
  }, []);

  const handleImportInsert = useCallback((text: string, importedCapo?: number) => {
    insertAtCursor(text);
    if (importedCapo !== undefined) setCapo(importedCapo);
    setShowImport(false);
    setConvertHint(false);
  }, [insertAtCursor]);

  const handleContentPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted.includes('\n') && looksLikeChordOverLyrics(pasted)) setConvertHint(true);
  }, []);

  const handleProgressionInsert = useCallback((text: string, section: ChordSection) => {
    setContent(prev => {
      const el = contentRef.current;
      const pos = el ? el.selectionStart : prev.length;
      const before = prev.slice(0, pos);
      const after = prev.slice(pos);

      const leadingNewline = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
      const trailingNewline = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
      const insertion = leadingNewline + text + trailingNewline;
      const next = before + insertion + after;

      setChordGrid(g => {
        const newGrid = [...g, section];
        setChordGridHash(hashStr(next));
        setGridWarningDismissed(false);
        return newGrid;
      });

      const caret = before.length + insertion.length;
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(caret, caret);
      });

      return next;
    });
  }, []);

  const buildInput = useCallback(() => ({
    title:                title.trim(),
    artist:               artist.trim()     || undefined,
    originalKey:          candidates[0]?.key || undefined,
    preferredKey:         userKey           || undefined,
    capo,
    tuning:               tuningId !== 'standard' ? tuningId : undefined,
    bpm:                  validateBpm(bpmInput) ?? undefined,
    keys:                 keys.length > 0 ? keys : undefined,
    content,
    youtubeUrl:           youtubeUrl.trim() || undefined,
    chordMap:             song?.chordMap,
    chordGrid:            chordGrid.length > 0 ? chordGrid : undefined,
    chordGridContentHash: chordGrid.length > 0 ? chordGridHash : undefined,
  }), [title, artist, userKey, tuningId, candidates, capo, bpmInput, keys, content, youtubeUrl, chordGrid, chordGridHash, song]);

  const handleSave = useCallback(() => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setError(null);

    const input = buildInput();

    startTransition(async () => {
      try {
        savedRef.current = true;
        if (isEdit) {
          await updateSongAction(song.id, input);
        } else {
          await createSongAction(input);
        }
      } catch (e: unknown) {
        // redirect() throws internally in Next.js — let it propagate
        if (
          e != null &&
          typeof e === 'object' &&
          'digest' in e &&
          typeof (e as Record<string, unknown>).digest === 'string' &&
          ((e as Record<string, string>).digest).startsWith('NEXT_')
        ) {
          return;
        }
        savedRef.current = false;
        setError(e instanceof Error ? e.message : 'Failed to save');
      }
    });
  }, [title, buildInput, isEdit, song]);

  const handleQuickSave = useCallback(() => {
    if (!isEdit || !song) return;
    if (!title.trim()) { setError('Title is required.'); return; }
    setError(null);

    const input = buildInput();

    startQuickTransition(async () => {
      try {
        await quickSaveSongAction(song.id, input);
        initialSnapshotRef.current = buildSnapshot();
        setQuickSaved(true);
        if (quickSavedTimeoutRef.current) clearTimeout(quickSavedTimeoutRef.current);
        quickSavedTimeoutRef.current = setTimeout(() => setQuickSaved(false), 2000);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to save');
      }
    });
  }, [title, buildInput, isEdit, song, buildSnapshot]);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">

      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-3
        border-b border-zinc-800 bg-zinc-900">
        <button
          onClick={handleBack}
          className="flex items-center justify-center w-9 h-9 rounded-lg
            text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
          aria-label="Go back"
        >
          <ChevronLeftIcon />
        </button>

        <h1 className="flex-1 text-base font-semibold text-zinc-100">
          {isEdit ? 'Edit Song' : 'New Song'}
        </h1>

        {/* Mobile tab switch */}
        <div className="flex md:hidden gap-0.5 bg-zinc-800 rounded-lg p-0.5">
          {([
            { id: 'form',    label: 'Form'    },
            { id: 'preview', label: 'Preview' },
            { id: 'visual',  label: 'Visual'  },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                activeTab === id
                  ? 'bg-zinc-600 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {isEdit && (
          <button
            onClick={handleQuickSave}
            disabled={pending || quickPending}
            className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200
              text-sm font-bold hover:bg-zinc-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors touch-manipulation"
            title="Save without leaving the editor"
          >
            {quickPending ? 'Saving…' : quickSaved ? 'Saved ✓' : 'Quick Save'}
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={pending || quickPending}
          className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950
            text-sm font-bold hover:bg-amber-400
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors touch-manipulation"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </header>

      {error && (
        <div className="shrink-0 px-4 py-2 bg-red-950 border-b border-red-800">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Stale chord grid warning */}
      {chordGrid.length > 0 && chordGridHash && hashStr(content) !== chordGridHash && !gridWarningDismissed && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2
          bg-amber-950/40 border-b border-amber-800/40">
          <span className="text-xs text-amber-400 flex-1">
            Chord grid may be outdated — ChordPro was edited after it was built.
          </span>
          <button
            type="button"
            onClick={() => { setChordGrid([]); setChordGridHash(undefined); }}
            className="shrink-0 px-2 py-1 rounded-md text-[10px] text-amber-600
              hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            Clear grid
          </button>
          <button
            type="button"
            onClick={() => setGridWarningDismissed(true)}
            aria-label="Dismiss warning"
            className="shrink-0 p-1 rounded-md text-amber-600
              hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* ── Form column ────────────────────────────────────────────────── */}
        <div className={[
          'flex flex-col gap-5 p-5 overflow-y-auto',
          'w-full md:w-[400px] md:shrink-0 border-r border-zinc-800',
          activeTab === 'form' ? 'flex' : 'hidden md:flex',
        ].join(' ')}>

          <Field label="Title" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Song title"
              className={inputCls}
            />
          </Field>

          <Field label="Artist">
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artist name"
              className={inputCls}
            />
          </Field>

          <KeyDetectField
            candidates={candidates}
            userKey={userKey}
            onUserKeyChange={setUserKey}
            sectionResult={sectionResult}
          />

          <Field label="Guitar Tuning">
            <div className="flex flex-wrap gap-1.5">
              {TUNINGS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTuningId(t.id)}
                  aria-pressed={tuningId === t.id}
                  className={[
                    'flex flex-col items-start px-3 py-2 rounded-xl text-xs font-medium',
                    'transition-colors touch-manipulation',
                    tuningId === t.id
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200',
                  ].join(' ')}
                >
                  <span className="font-semibold">{t.name}</span>
                  <span className={[
                    'font-mono mt-0.5 tracking-tight',
                    tuningId === t.id ? 'text-zinc-700' : 'text-zinc-600',
                  ].join(' ')}>
                    {t.strings.join(' ')}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Default Capo">
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: CAPO_MAX + 1 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCapo(n)}
                  aria-pressed={capo === n}
                  className={[
                    'w-8 h-8 rounded-lg text-xs font-medium transition-colors touch-manipulation',
                    capo === n
                      ? 'bg-amber-500 text-zinc-950 font-bold'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
                  ].join(' ')}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>

          {/* ── Song Keys ── */}
          <Field label="Song Keys">
            <div className="flex flex-col gap-2">

              {/* Current key chips */}
              {keys.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {keys.map((sk, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                        bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-mono font-semibold"
                    >
                      {sk.label && (
                        <span className="text-amber-500/70 font-normal mr-0.5">{sk.label}:</span>
                      )}
                      {formatSongKey(sk)}
                      <button
                        type="button"
                        onClick={() => setKeys(prev => prev.filter((_, j) => j !== i))}
                        className="ml-0.5 text-amber-500/60 hover:text-amber-300 transition-colors"
                        aria-label={`Remove ${formatSongKey(sk)}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Suggestions from section analysis */}
              {suggestedKeys.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-zinc-600">Suggestions from analysis:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedKeys.map((sk, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setKeys(prev => [...prev, sk])}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                          bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs font-mono
                          hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                      >
                        +{' '}
                        {sk.label && <span className="text-zinc-600">{sk.label}:</span>}
                        {formatSongKey(sk)}
                      </button>
                    ))}
                    {suggestedKeys.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setKeys(prev => {
                          const next = [...prev];
                          for (const sk of suggestedKeys) {
                            if (!next.some(k => k.key === sk.key && k.mode === sk.mode)) {
                              next.push(sk);
                            }
                          }
                          return next;
                        })}
                        className="px-2.5 py-1 rounded-lg text-xs text-sky-500/80
                          hover:text-sky-400 transition-colors"
                      >
                        Apply all
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Add key inline form / button */}
              {addingKey ? (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <input
                    type="text"
                    value={newKeyRoot}
                    onChange={e => setNewKeyRoot(e.target.value)}
                    placeholder="Root (e.g. G, F#, Bb)"
                    className={[inputCls, 'w-36 flex-none text-xs py-1.5'].join(' ')}
                    autoFocus
                  />
                  <div className="flex rounded-lg overflow-hidden border border-zinc-700 text-xs">
                    {(['major', 'minor'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setNewKeyMode(m)}
                        className={[
                          'px-3 py-1.5 font-medium transition-colors',
                          newKeyMode === m
                            ? 'bg-amber-500 text-zinc-950'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
                        ].join(' ')}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={newKeyLabel}
                    onChange={e => setNewKeyLabel(e.target.value)}
                    placeholder="Label (optional)"
                    className={[inputCls, 'w-32 flex-none text-xs py-1.5'].join(' ')}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const root = newKeyRoot.trim();
                      if (!root) return;
                      const sk: SongKey = {
                        key:   root,
                        mode:  newKeyMode,
                        label: newKeyLabel.trim() || undefined,
                      };
                      setKeys(prev => [...prev, sk]);
                      setNewKeyRoot('');
                      setNewKeyLabel('');
                      setAddingKey(false);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold
                      bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingKey(false); setNewKeyRoot(''); setNewKeyLabel(''); }}
                    className="px-3 py-1.5 rounded-lg text-xs text-zinc-500
                      hover:text-zinc-300 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingKey(true)}
                  className="self-start px-2.5 py-1 rounded-lg text-xs
                    bg-zinc-800 border border-zinc-700 border-dashed
                    text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  + Add key
                </button>
              )}
            </div>
          </Field>

          <Field label="Tempo (BPM)">
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min={20}
                max={300}
                value={bpmInput}
                onChange={(e) => setBpmInput(e.target.value)}
                placeholder="120"
                className={[inputCls, 'w-24 flex-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'].join(' ')}
              />
              <button
                type="button"
                onClick={handleBpmTap}
                className="px-4 h-10 rounded-xl text-sm font-medium
                  bg-zinc-800 text-zinc-400 border border-zinc-700
                  hover:bg-zinc-700 hover:text-zinc-200 transition-colors touch-manipulation"
              >
                Tap
              </button>
              {bpmInput && !validateBpm(bpmInput) && (
                <span className="text-xs text-amber-600">20–300</span>
              )}
            </div>
          </Field>

          <Field label="YouTube URL">
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              className={inputCls}
            />
          </Field>

          <div className="flex flex-col gap-1.5 flex-1">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide shrink-0">
                ChordPro
              </label>
              <div className="flex gap-1.5 items-center">
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                    bg-zinc-800 border border-zinc-700 text-zinc-400
                    hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                  title="Convert chords-above-lyrics text into ChordPro"
                >
                  📋 Paste &amp; Convert
                </button>
                {extractChords(preview).length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoBuild}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                      bg-zinc-800 border border-zinc-700 text-zinc-400
                      hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                    title="Auto-build chord grid from ChordPro content"
                  >
                    ⚡ Auto-build grid
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowBuilder(v => !v)}
                  className={[
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                    showBuilder
                      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                      : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
                  ].join(' ')}
                  title="Open Chord Progression Builder"
                >
                  ♩ Progression
                </button>
              </div>
            </div>
            {convertHint && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl
                bg-sky-950/40 border border-sky-800/40">
                <span className="flex-1 text-xs text-sky-400">
                  Looks like chords above lyrics — convert to ChordPro?
                </span>
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold
                    bg-sky-500/20 border border-sky-500/40 text-sky-300
                    hover:bg-sky-500/30 transition-colors"
                >
                  Convert
                </button>
                <button
                  type="button"
                  onClick={() => setConvertHint(false)}
                  aria-label="Dismiss"
                  className="shrink-0 p-1 rounded-md text-sky-600
                    hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handleContentPaste}
              spellCheck={false}
              rows={20}
              placeholder={`[Am]Well you only need the [G]light when it's burn[F]ing low\n[Am]Only miss the [G]sun when it starts to [C]snow`}
              className={[
                inputCls,
                'resize-none font-mono text-sm leading-relaxed min-h-[180px]',
              ].join(' ')}
            />
            <div className="h-20" />
          </div>
        </div>

        {/* ── Right panel (Preview / Visual on top, Chord Grid split below) ── */}
        <div className={[
          'flex-1 flex flex-col min-h-0',
          activeTab === 'form' ? 'hidden md:flex' : 'flex',
        ].join(' ')}>

          {/* Panel toolbar */}
          <div className="shrink-0 flex items-center gap-0.5
            px-3 py-2 border-b border-zinc-800 bg-zinc-900">
            {/* Top-pane tabs — desktop only (mobile uses the header tabs) */}
            <div className="hidden md:flex items-center gap-0.5">
              {([
                { id: 'preview', label: 'Preview'       },
                { id: 'visual',  label: 'Visual Editor' },
              ] as const).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setRightPanel(id)}
                  className={[
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    rightPanel === id
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {/* Chord Grid toggle — reveals the grid editor below the preview */}
            <button
              type="button"
              onClick={() => setShowGrid(v => !v)}
              aria-pressed={showGrid}
              title="Show the chord grid editor below, with the lyrics for reference"
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                showGrid
                  ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
              ].join(' ')}
            >
              <span className={['w-1.5 h-1.5 rounded-full', showGrid ? 'bg-amber-400' : 'bg-zinc-600'].join(' ')} />
              Chord Grid
            </button>
          </div>

          {/* Top region: Preview / Visual (stays visible as a lyric reference) */}
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Preview pane */}
            <div className={[
              'flex-1 overflow-y-auto bg-zinc-950/40 flex-col',
              activeTab === 'preview' ? 'flex'    : 'hidden',
              rightPanel === 'preview' ? 'md:flex' : 'md:hidden',
            ].join(' ')}>
              {content.trim() ? (
                <ChordSheetViewer sheet={preview} tuning={getTuning(tuningId)} />
              ) : (
                <div className="flex items-center justify-center h-full text-center p-8">
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    Start typing ChordPro in the form<br />
                    to see a live preview here.
                  </p>
                </div>
              )}
            </div>

            {/* Visual editor pane */}
            <div className={[
              'flex-1 min-h-0 flex-col',
              activeTab === 'visual' ? 'flex'    : 'hidden',
              rightPanel === 'visual' ? 'md:flex' : 'md:hidden',
            ].join(' ')}>
              <ChordPlacer
                content={content}
                onChange={setContent}
                keyContext={effectiveKey || undefined}
              />
            </div>
          </div>

          {/* Bottom region: Chord Grid editor — toggled on/off */}
          {showGrid && (
            <div className="flex-1 min-h-0 flex flex-col bg-zinc-950 border-t border-zinc-800">
              <ChordGridEditor
                grid={chordGrid}
                onChange={setChordGrid}
                onAutoBuild={handleAutoBuild}
                hasContent={extractChords(preview).length > 0}
                youtubeUrl={song?.youtubeUrl}
              />
            </div>
          )}
        </div>
      </div>

      {/* Paste & Convert — chords above lyrics → ChordPro */}
      {showImport && (
        <ChordImportDialog
          onApply={handleImportApply}
          onInsert={handleImportInsert}
          onClose={() => setShowImport(false)}
          hasContent={content.trim().length > 0}
          initialText={convertHint ? content : ''}
        />
      )}

      {/* Chord Progression Builder — floating panel */}
      {showBuilder && (
        <ChordProgressionBuilder
          onInsert={handleProgressionInsert}
          onClose={() => setShowBuilder(false)}
          keyContext={effectiveKey || undefined}
        />
      )}

      {/* Unsaved changes confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-zinc-100">Discard unsaved changes?</h2>
            <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
              You have unsaved changes to this song. Leaving now will discard them.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium
                  bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => { setShowLeaveConfirm(false); savedRef.current = true; router.back(); }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold
                  bg-red-500/90 text-zinc-950 hover:bg-red-500 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
  className,
}: {
  label:     string;
  required?: boolean;
  children:  React.ReactNode;
  className?: string;
}) {
  return (
    <div className={['flex flex-col gap-1.5', className].join(' ')}>
      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
        {label}
        {required && <span className="text-amber-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = [
  'w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700',
  'text-sm text-zinc-100 placeholder:text-zinc-600',
  'focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500',
  'transition-colors',
].join(' ');

// ─── KeyDetectField ───────────────────────────────────────────────────────────

function KeyDetectField({
  candidates,
  userKey,
  onUserKeyChange,
  sectionResult,
}: {
  candidates:      KeyCandidate[];
  userKey:         string;
  onUserKeyChange: (key: string) => void;
  sectionResult?:  SectionAnalysisResult;
}) {
  const top5 = candidates.slice(0, 5);

  // The "active" candidate: user's choice, or auto top
  const activeKey = userKey || candidates[0]?.key;
  const activeCandidate = candidates.find(c => c.key === activeKey);
  const isPartial = !userKey && candidates[0]?.partial;

  return (
    <Field label="Detected Key">
      {top5.length === 0 ? (
        <p className="text-xs text-zinc-600 py-1">
          Add ChordPro content to detect key automatically
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Key chips */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {top5.map((c) => {
              const isActive = c.key === activeKey;
              const pct = Math.round(c.confidence * 100);
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onUserKeyChange(userKey === c.key ? '' : c.key)}
                  className={[
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg',
                    'font-mono text-xs font-semibold transition-colors touch-manipulation',
                    isActive
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200',
                  ].join(' ')}
                >
                  {c.key}
                  <span className={isActive ? 'text-zinc-700' : 'text-zinc-600'}>
                    {pct}%
                  </span>
                </button>
              );
            })}

            {/* Clear override */}
            {userKey && (
              <button
                type="button"
                onClick={() => onUserKeyChange('')}
                className="px-2 py-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                title="Use auto-detected key"
              >
                Auto
              </button>
            )}
          </div>

          {/* Modulation: sections have different keys */}
          {sectionResult?.hasModulation && (
            <p className="text-xs text-sky-500/80">
              <span className="font-semibold">Modulate</span>{' '}
              {sectionResult.sections
                .filter(s => s.key)
                .map(s => `${s.label}: ${s.key}`)
                .join(' · ')}
            </p>
          )}

          {/* Partial: no single key covers all chords cleanly */}
          {!sectionResult?.hasModulation && isPartial && (
            <p className="text-xs text-amber-600/70">
              ไม่มี key เดียวครอบทุก chord — น่าจะ {candidates[0].key} (มี chord นอก key อาจเปลี่ยน key)
            </p>
          )}

          {/* Non-diatonic warning for the active key */}
          {activeCandidate && activeCandidate.nonDiatonic.length > 0 && !isPartial && (
            <p className="text-xs text-amber-600/80">
              Outside {activeCandidate.key}:{' '}
              <span className="font-mono">{activeCandidate.nonDiatonic.join(', ')}</span>
            </p>
          )}
        </div>
      )}
    </Field>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
