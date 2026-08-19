export const dynamic = 'force-dynamic';

import { getProgramsAction } from '@/application/pomodoro/pomodoro.actions';
import { PomodoroLibrary } from '@/components/PomodoroLibrary';

export default async function PomodoroPage() {
  const programs = await getProgramsAction();
  return <PomodoroLibrary programs={programs} />;
}
