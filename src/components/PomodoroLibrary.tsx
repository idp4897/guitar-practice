'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  createProgramAction,
  deleteProgramAction,
  updateProgramAction,
} from '@/application/pomodoro/pomodoro.actions';
import { formatDuration, sessionLabel, totalDurationSec } from '@/domain/pomodoro/program';
import type { MiniSession, PomodoroProgram } from '@/domain/pomodoro/types';
import { PomodoroEditor } from './PomodoroEditor';

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; program: PomodoroProgram };

export function PomodoroLibrary({ programs }: { programs: PomodoroProgram[] }) {
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });

  const handleSave = async (name: string, sessions: MiniSession[]) => {
    if (editor.mode === 'edit') await updateProgramAction(editor.program.id, { name, sessions });
    else                        await createProgramAction({ name, sessions });
    setEditor({ mode: 'closed' });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
            ← Songs
          </Link>
          <h1 className="text-lg font-bold text-zinc-100 flex-1">Pomodoro</h1>

          {editor.mode === 'closed' && (
            <button
              type="button"
              onClick={() => setEditor({ mode: 'create' })}
              className="px-4 py-2 rounded-xl shrink-0 bg-amber-500 text-zinc-950
                text-sm font-semibold hover:bg-amber-400 transition-colors touch-manipulation"
            >
              + New program
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {editor.mode !== 'closed' && (
          <PomodoroEditor
            program={editor.mode === 'edit' ? editor.program : undefined}
            onSave={handleSave}
            onCancel={() => setEditor({ mode: 'closed' })}
          />
        )}

        {programs.length === 0 && editor.mode === 'closed' ? (
          <EmptyState onCreate={() => setEditor({ mode: 'create' })} />
        ) : (
          <div className="space-y-3">
            {programs.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onEdit={() => setEditor({ mode: 'edit', program })}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Program card ─────────────────────────────────────────────────────────────

function ProgramCard({ program, onEdit }: { program: PomodoroProgram; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(`Delete program "${program.name}"?`)) return;
    startTransition(async () => {
      await deleteProgramAction(program.id);
    });
  };

  return (
    <div className={[
      'rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition-opacity',
      pending ? 'opacity-50' : '',
    ].join(' ')}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-zinc-100 truncate">{program.name}</h2>
          <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
            {program.sessions.length} session{program.sessions.length === 1 ? '' : 's'}
            {' · '}{formatDuration(totalDurationSec(program.sessions))}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400
              hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500
              hover:text-red-400 hover:bg-red-950/40 disabled:opacity-40 transition-colors"
          >
            Delete
          </button>
          <Link
            href={`/pomodoro/${program.id}`}
            className="px-4 py-1.5 rounded-lg bg-amber-500 text-zinc-950
              text-xs font-semibold hover:bg-amber-400 transition-colors touch-manipulation"
          >
            Start
          </Link>
        </div>
      </div>

      <ol className="flex flex-wrap gap-1.5 mt-3">
        {program.sessions.map((session, index) => (
          <li
            key={session.id}
            className="px-2.5 py-1 rounded-lg bg-zinc-950/70 border border-zinc-800
              text-[11px] text-zinc-400"
          >
            <span className="text-amber-400/90 font-semibold tabular-nums">{session.bpm}</span>
            <span className="text-zinc-600"> · </span>
            <span className="tabular-nums">{Math.round(session.trainSec / 60)}m</span>
            <span className="text-zinc-600 truncate"> · {sessionLabel(session, index)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <p className="text-zinc-400">No training programs yet.</p>
      <p className="text-sm text-zinc-600 max-w-sm">
        Build a program from mini-sessions — each with its own tempo, time signature,
        and training and rest timers.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-2 px-5 py-2.5 rounded-xl bg-amber-500 text-zinc-950
          text-sm font-semibold hover:bg-amber-400 transition-colors"
      >
        Create your first program
      </button>
    </div>
  );
}
