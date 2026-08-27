import type { Metadata } from 'next';
import { ScaleLibraryPage } from '@/components/ScaleLibraryPage';

export const metadata: Metadata = {
  title: 'Scales — Guitar Practice',
  description: 'Browse guitar scales and their positions across the neck',
};

export default function ScalesPage() {
  return <ScaleLibraryPage />;
}
