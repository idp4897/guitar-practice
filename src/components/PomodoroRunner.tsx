'use client';

import Link from 'next/link';
import { getTimeSignature } from '@/domain/music/timeSignature';
import { formatClock, formatDuration, sessionLabel, totalDurationSec } from '@/domain/pomodoro/program';
import type { PomodoroProgram } from '@/domain/pomodoro/types';
import { usePomodoroRunner } from '@/hooks/usePomodoroRunner';
import { BeatDots } from './BeatDots';

export function PomodoroRunner({ program }: { program: PomodoroProgram }) {
  const runner = usePomodoroRunner(program.sessions);
  const {
    status, stage, stageIndex, timeline, remainingSec,
    isPlaying, currentBeat, bpm,
  } = runner;

  const isRest    = status === 'resting';
  const isDone    = status === 'done';
  const isIdle    = status === 'idle';
  const accentHex = isRest ? 'text-sky-400' : 'text-amber-400';

  const timeSig      = getTimeSignature(stage?.timeSigId ?? '4_4');
  const sessionCount = program.sessions.length;
  const activeSession = stage ? program.sessions[stage.sessionIndex] : undefined;

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">

      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
        <Link
          href="/pomodoro"
          className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm shrink-0"
        >
          ← Programs
        </Link>
        <h1 className="text-sm font-semibold text-zinc-300 truncate flex-1 min-w-0">
          {program.name}
        </h1>
        <span className="text-xs text-zinc-600 tabular-nums shrink-0">
          {formatDuration(totalDurationSec(program.sessions))}
        </span>
      </header>

      {/* ── Session pips ── */}
      <div className="flex items-center justify-center gap-1.5 px-4 py-3 shrink-0">
        {program.sessions.map((session, index) => {
          const current = !isIdle && !isDone && stage?.sessionIndex === index;
          const passed  = isDone || (stage != null && index < stage.sessionIndex);
          return (
            <div
              key={session.id}
              title={sessionLabel(session, index)}
              className={[
                'h-1.5 flex-1 max-w-16 rounded-full transition-colors',
                current ? (isRest ? 'bg-sky-400' : 'bg-amber-400')
                        : passed ? 'bg-zinc-600' : 'bg-zinc-800',
              ].join(' ')}
            />
          );
        })}
      </div>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 overflow-y-auto">

        {isIdle && (
          <IdleView program={program} onStart={runner.start} />
        )}

        {isDone && (
          <div className="flex flex-col items-center gap-5 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Complete</p>
            <p className="text-5xl sm:text-6xl font-bold text-amber-400">Well done</p>
            <p className="text-sm text-zinc-500">
              {sessionCount} session{sessionCount === 1 ? '' : 's'} ·{' '}
              {formatDuration(totalDurationSec(program.sessions))}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <button type="button" onClick={runner.start} className={primaryButton}>
                Run again
              </button>
              <Link href="/pomodoro" className={ghostButton}>Back to programs</Link>
            </div>
          </div>
        )}

        {!isIdle && !isDone && stage && (
          <>
            <div className="flex flex-col items-center gap-2 text-center">
              <span className={[
                'px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.2em]',
                isRest ? 'bg-sky-500/15 text-sky-400' : 'bg-amber-500/15 text-amber-400',
              ].join(' ')}>
                {status === 'awaitingReady' ? 'Up next' : isRest ? 'Rest' : 'Train'}
              </span>
              <p className="text-xl sm:text-2xl font-semibold text-zinc-100">
                {activeSession ? sessionLabel(activeSession, stage.sessionIndex) : stage.label}
              </p>
              <p className="text-xs text-zinc-600 tabular-nums">
                Session {stage.sessionIndex + 1} of {sessionCount}
              </p>
            </div>

            <div className={[
              'text-7xl sm:text-8xl font-bold tabular-nums leading-none transition-colors',
              status === 'paused' ? 'text-zinc-500' : accentHex,
            ].join(' ')}>
              {formatClock(remainingSec)}
            </div>

            {status === 'awaitingReady' ? (
              <p className="text-sm text-zinc-500 text-center max-w-xs">
                Rest is over. Pick up your guitar — the metronome starts at{' '}
                <span className="text-amber-400 font-semibold tabular-nums">{stage.bpm} BPM</span>{' '}
                when you&rsquo;re ready.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <BeatDots
                  accents={timeSig.accents}
                  currentBeat={currentBeat}
                  isPlaying={isPlaying}
                  size="xl"
                />
                <div className="flex items-baseline gap-2 text-zinc-500">
                  <span className="text-2xl font-bold text-zinc-300 tabular-nums">
                    {isRest ? stage.bpm : bpm}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest">bpm</span>
                  <span className="text-sm font-mono text-zinc-600">{timeSig.display}</span>
                </div>
                {isRest && <p className="text-xs text-zinc-600">Metronome paused during rest</p>}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Controls ── */}
      {!isIdle && !isDone && (
        <footer className="flex items-center justify-center gap-3 px-6 py-5 border-t border-zinc-800 shrink-0">
          {status === 'awaitingReady' ? (
            <button type="button" onClick={runner.ready} className={primaryButton}>
              I&rsquo;m ready — start session {(stage?.sessionIndex ?? 0) + 1}
            </button>
          ) : status === 'paused' ? (
            <button type="button" onClick={runner.resume} className={primaryButton}>
              Resume
            </button>
          ) : (
            <button type="button" onClick={runner.pause} className={secondaryButton}>
              Pause
            </button>
          )}

          <button
            type="button"
            onClick={runner.skip}
            disabled={stageIndex >= timeline.length - 1 && status !== 'awaitingReady'}
            className={`${ghostButton} disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            Skip
          </button>
          <button type="button" onClick={runner.stop} className={ghostButton}>
            Stop
          </button>
        </footer>
      )}
    </div>
  );
}

// ─── Idle view ────────────────────────────────────────────────────────────────

function IdleView({
  program, onStart,
}: {
  program: PomodoroProgram;
  onStart: () => Promise<void>;
}) {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-600 mb-2">Ready</p>
        <p className="text-4xl font-bold text-zinc-100">{program.name}</p>
      </div>

      <ol className="w-full space-y-2">
        {program.sessions.map((session, index) => {
          const isLast = index === program.sessions.length - 1;
          return (
            <li
              key={session.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-800
                bg-zinc-900 px-4 py-2.5"
            >
              <span className="flex items-center justify-center w-6 h-6 shrink-0 rounded-md
                bg-zinc-800 text-[11px] font-semibold text-zinc-400 tabular-nums">
                {index + 1}
              </span>
              <span className="flex-1 min-w-0 text-sm text-zinc-300 truncate">
                {sessionLabel(session, index)}
              </span>
              <span className="text-xs text-zinc-500 tabular-nums shrink-0">
                <span className="text-amber-400 font-semibold">{session.bpm}</span>
                {' · '}{getTimeSignature(session.timeSigId).display}
                {' · '}{Math.round(session.trainSec / 60)}m
                {!isLast && session.restSec > 0 && (
                  <span className="text-sky-400/70"> +{Math.round(session.restSec / 60)}m rest</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <button type="button" onClick={onStart} className={`${primaryButton} w-full`}>
        Start training
      </button>
      <p className="text-[11px] text-zinc-600 text-center">
        Training and rest run automatically. After each rest you confirm before the next
        session begins.
      </p>
    </div>
  );
}

// ─── Button styles ────────────────────────────────────────────────────────────

const primaryButton = `px-6 py-3 rounded-xl bg-amber-500 text-zinc-950 text-sm font-semibold
  hover:bg-amber-400 transition-colors touch-manipulation select-none`;

const secondaryButton = `px-6 py-3 rounded-xl bg-zinc-800 text-zinc-200 text-sm font-semibold
  hover:bg-zinc-700 transition-colors touch-manipulation select-none`;

const ghostButton = `px-5 py-3 rounded-xl text-sm font-medium text-zinc-500
  hover:text-zinc-100 hover:bg-zinc-800 transition-colors touch-manipulation select-none`;
