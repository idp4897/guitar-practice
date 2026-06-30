export interface StoredCollection {
  id:           string;
  name:         string;
  description?: string;
  tags:         string[];   // normalized: lowercase, trimmed, deduplicated
  songIds:      string[];   // ordered; many-to-many as embedded array
  createdAt:    string;
  updatedAt:    string;
}

export interface CreateCollectionInput {
  name:         string;
  description?: string;
  tags?:        string[];
}

export type UpdateCollectionInput = Partial<CreateCollectionInput>;

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}
