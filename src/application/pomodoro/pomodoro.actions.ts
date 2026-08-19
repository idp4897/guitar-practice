'use server';

import { revalidatePath, refresh } from 'next/cache';
import {
  pomodoroStore,
  type CreateProgramInput,
  type UpdateProgramInput,
} from '@/lib/pomodoro-store';

export async function getProgramsAction() {
  return pomodoroStore.findAll();
}

export async function getProgramAction(id: string) {
  return pomodoroStore.findById(id);
}

export async function createProgramAction(input: CreateProgramInput): Promise<void> {
  await pomodoroStore.create(input);
  revalidatePath('/pomodoro');
  refresh();
}

export async function updateProgramAction(id: string, input: UpdateProgramInput): Promise<void> {
  await pomodoroStore.update(id, input);
  revalidatePath('/pomodoro');
  revalidatePath(`/pomodoro/${id}`);
  refresh();
}

export async function deleteProgramAction(id: string): Promise<void> {
  await pomodoroStore.delete(id);
  revalidatePath('/pomodoro');
  refresh();
}
