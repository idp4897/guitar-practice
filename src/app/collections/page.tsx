import { getCollectionsAction } from '@/application/collections/collection.actions';
import { CollectionsPage } from '@/components/CollectionsPage';

export default async function CollectionsListPage() {
  const collections = await getCollectionsAction();
  return <CollectionsPage collections={collections} />;
}
