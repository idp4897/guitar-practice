export const dynamic = 'force-dynamic';

import { getAllTagsAction } from '@/application/collections/collection.actions';
import { CollectionEditor } from '@/components/CollectionEditor';

export default async function NewCollectionPage() {
  const allTags = await getAllTagsAction();
  return <CollectionEditor allTags={allTags} />;
}
