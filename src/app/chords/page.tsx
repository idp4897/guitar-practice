import type { Metadata } from 'next';
import { ChordSearchPage } from '@/components/ChordSearchPage';

export const metadata: Metadata = {
  title: 'Chords — Guitar Practice',
  description: 'Search guitar chords and browse their fingerings',
};

export default function ChordsPage() {
  return <ChordSearchPage />;
}
