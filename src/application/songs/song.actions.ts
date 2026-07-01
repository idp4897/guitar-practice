'use server';

import { revalidatePath, refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { songStore, type CreateSongInput, type UpdateSongInput } from '@/lib/song-store';

export async function getSongsAction() {
  return songStore.findAll();
}

export async function getSongAction(id: string) {
  return songStore.findById(id);
}

export async function createSongAction(input: CreateSongInput): Promise<void> {
  const song = await songStore.create(input);
  revalidatePath('/');
  redirect(`/songs/${song.id}`);
}

export async function updateSongAction(id: string, input: UpdateSongInput): Promise<void> {
  await songStore.update(id, input);
  revalidatePath('/');
  revalidatePath(`/songs/${id}`);
  redirect(`/songs/${id}`);
}

export async function savePlaybackAction(id: string, data: UpdateSongInput): Promise<void> {
  await songStore.update(id, data);
  revalidatePath(`/songs/${id}`);
  refresh();
}

export async function deleteSongAction(id: string): Promise<void> {
  await songStore.delete(id);
  revalidatePath('/');
  redirect('/');
}
