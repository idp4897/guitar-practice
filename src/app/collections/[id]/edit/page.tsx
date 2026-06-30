import { notFound } from 'next/navigation';
import { getCollectionAction, getAllTagsAction } from '@/application/collections/collection.actions';
import { CollectionEditor } from '@/components/CollectionEditor';

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [collection, allTags] = await Promise.all([
    getCollectionAction(id),
    getAllTagsAction(),
  ]);
  if (!collection) notFound();
  return <CollectionEditor collection={collection} allTags={allTags} />;
}
