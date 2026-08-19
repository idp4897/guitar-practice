'use client';

import { useState, useTransition } from 'react';
import { TIME_SIGNATURES } from '@/domain/music/timeSignature';
import {
  BPM_MIN,
  BPM_MAX,
  MAX_SESSIONS,
  formatDuration,
  totalDurationSec,
  validateProgram,
} from '@/domain/pomodoro/program';
import type { MiniSession, PomodoroProgram } from '@/domain/pomodoro/types';

const DEFAULT_SESSION: Omit<MiniSession, 'id'> = {
  bpm:       100,
  timeSigId: '4_4',
  trainSec:  600,
  restSec:   300,
};

function newSession(from?: MiniSession): MiniSession {
  return { ...(from ?? DEFAULT_SESSION), id: crypto.randomUUID() };
}

const toMinutes = (sec: number) => Math.round(sec / 60);
const toSeconds = (min: number) => (Number.isFinite(min) ? Math.max(0, Math.round(min)) * 60 : 0);

interface PomodoroEditorProps {
  program?: PomodoroProgram;
  onSave:   (name: string, sessions: MiniSession[]) => Promise<void>;
  onCancel: () => void;
}

export function PomodoroEditor({ program, onSave, onCancel }: PomodoroEditorProps) {
  const [name, setName]         = useState(program?.name ?? '');
  const [sessions, setSessions] = useState<MiniSession[]>(
    program?.sessions ?? [newSession()],
  );
  const [errors, setErrors]     = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const patch = (id: string, changes: Partial<MiniSession>) =>
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));

  const remove = (id: string) =>
    setSessions((prev) => prev.filter((s) => s.id !== id));

  const move = (index: number, delta: number) =>
    setSessions((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const handleSave = () => {
    const found = validateProgram(name, sessions);
    setErrors(found);
    if (found.length > 0) return;
    startTransition(async () => {
      await onSave(name.trim(), sessions);
    });
  };

  const total = totalDurationSec(sessions);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-5">

      {/* Program name */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Program name — e.g. 1 Hour Ladder"
          className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700
            text-sm text-zinc-100 placeholder:text-zinc-500
            focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
        />
        <div className="text-sm text-zinc-500 shrink-0">
          Total <span className="text-amber-400 font-semibold tabular-nums">{formatDuration(total)}</span>
          <span className="text-zinc-600"> · {sessions.length} session{sessions.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {/* Session rows */}
      <div className="space-y-3">
        {sessions.map((session, index) => (
          <div
            key={session.id}
            className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-3"
          >
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 shrink-0 rounded-md
                bg-zinc-800 text-[11px] font-semibold text-zinc-400 tabular-nums">
                {index + 1}
              </span>
              <input
                type="text"
                value={session.label ?? ''}
                onChange={(e) => patch(session.id, { label: e.target.value })}
                placeholder="What to practice (optional)"
                className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700
                  text-sm text-zinc-100 placeholder:text-zinc-600
                  focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              />
              <div className="flex items-center gap-1 shrink-0">
                <IconButton label="Move up"   onClick={() => move(index, -1)} disabled={index === 0}>↑</IconButton>
                <IconButton label="Move down" onClick={() => move(index, 1)}  disabled={index === sessions.length - 1}>↓</IconButton>
                <IconButton label="Duplicate" onClick={() => setSessions((p) => [
                  ...p.slice(0, index + 1), newSession(session), ...p.slice(index + 1),
                ])} disabled={sessions.length >= MAX_SESSIONS}>⧉</IconButton>
                <IconButton label="Remove"    onClick={() => remove(session.id)} disabled={sessions.length === 1} danger>✕</IconButton>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Field label="BPM">
                <input
                  type="number"
                  min={BPM_MIN}
                  max={BPM_MAX}
                  value={session.bpm}
                  onChange={(e) => patch(session.id, { bpm: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>

              <Field label="Time sig">
                <select
                  value={session.timeSigId}
                  onChange={(e) => patch(session.id, { timeSigId: e.target.value })}
                  className={`${inputClass} font-mono`}
                >
                  {TIME_SIGNATURES.map((ts) => (
                    <option key={ts.id} value={ts.id}>{ts.display}</option>
                  ))}
                </select>
              </Field>

              <Field label="Train (min)">
                <input
                  type="number"
                  min={1}
                  value={toMinutes(session.trainSec)}
                  onChange={(e) => patch(session.id, { trainSec: toSeconds(Number(e.target.value)) })}
                  className={inputClass}
                />
              </Field>

              <Field label="Rest (min)">
                <input
                  type="number"
                  min={0}
                  value={toMinutes(session.restSec)}
                  onChange={(e) => patch(session.id, { restSec: toSeconds(Number(e.target.value)) })}
                  className={inputClass}
                />
              </Field>
            </div>

            {index === sessions.length - 1 && session.restSec > 0 && (
              <p className="text-[11px] text-zinc-600">
                Rest is skipped on the last session — the program ends when training finishes.
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSessions((p) => [...p, newSession(p.at(-1))])}
        disabled={sessions.length >= MAX_SESSIONS}
        className="w-full py-2.5 rounded-xl border border-dashed border-zinc-700
          text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:border-zinc-600
          disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        + Add session
      </button>

      {errors.length > 0 && (
        <ul className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 space-y-1">
          {errors.map((error) => (
            <li key={error} className="text-xs text-red-300">{error}</li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="px-5 py-2.5 rounded-xl bg-amber-500 text-zinc-950 text-sm font-semibold
            hover:bg-amber-400 disabled:opacity-50 transition-colors touch-manipulation"
        >
          {pending ? 'Saving…' : program ? 'Save changes' : 'Create program'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400
            hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────────

const inputClass = `w-full px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700
  text-sm text-zinc-100 tabular-nums
  focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-zinc-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function IconButton({
  label, onClick, disabled, danger, children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        'flex items-center justify-center w-7 h-7 rounded-lg text-xs transition-colors',
        'disabled:opacity-25 disabled:cursor-not-allowed',
        danger
          ? 'text-zinc-500 hover:text-red-400 hover:bg-red-950/40'
          : 'text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
