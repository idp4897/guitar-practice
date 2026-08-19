import { notFound } from 'next/navigation';
import { getProgramAction } from '@/application/pomodoro/pomodoro.actions';
import { PomodoroRunner } from '@/components/PomodoroRunner';

export default async function PomodoroRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const program = await getProgramAction(id);
  if (!program) notFound();

  return <PomodoroRunner program={program} />;
}
