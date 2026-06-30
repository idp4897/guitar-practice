import type { StoredCollection } from '@/domain/collections/types';

export function filterCollections(
  collections: StoredCollection[],
  query: string,
): StoredCollection[] {
  const trimmed = query.trim().normalize('NFC').toLowerCase();
  if (!trimmed) return collections;
  return collections.filter((c) => {
    if (c.name.normalize('NFC').toLowerCase().includes(trimmed)) return true;
    return c.tags.some((t) => t.normalize('NFC').includes(trimmed));
  });
}
