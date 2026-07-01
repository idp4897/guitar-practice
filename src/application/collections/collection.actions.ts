'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  collectionStore,
  type CreateCollectionInput,
  type UpdateCollectionInput,
} from '@/lib/collection-store';

export async function getCollectionsAction() {
  return collectionStore.findAll();
}

export async function getCollectionAction(id: string) {
  return collectionStore.findById(id);
}

export async function getAllTagsAction(): Promise<string[]> {
  return collectionStore.getAllTags();
}

export async function createCollectionAction(input: CreateCollectionInput): Promise<void> {
  const coll = await collectionStore.create(input);
  revalidatePath('/');
  revalidatePath('/collections');
  redirect(`/collections/${coll.id}`);
}

export async function updateCollectionAction(id: string, input: UpdateCollectionInput): Promise<void> {
  await collectionStore.update(id, input);
  revalidatePath('/');
  revalidatePath('/collections');
  revalidatePath(`/collections/${id}`);
  redirect(`/collections/${id}`);
}

export async function deleteCollectionAction(id: string): Promise<void> {
  await collectionStore.delete(id);
  revalidatePath('/');
  revalidatePath('/collections');
  redirect('/collections');
}

export async function addSongToCollectionAction(collectionId: string, songId: string): Promise<void> {
  await collectionStore.addSong(collectionId, songId);
  revalidatePath('/');
  revalidatePath('/collections');
  revalidatePath(`/collections/${collectionId}`);
}

export async function removeSongFromCollectionAction(
  collectionId: string,
  songId: string,
): Promise<void> {
  await collectionStore.removeSong(collectionId, songId);
  revalidatePath('/');
  revalidatePath('/collections');
  revalidatePath(`/collections/${collectionId}`);
}
