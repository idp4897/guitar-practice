import type { SongSyncStatus } from '@/domain/songs/sync';

export function SyncTag({
  status,
  synced,
  total,
}: {
  status: SongSyncStatus;
  synced: number;
  total:  number;
}) {
  if (status === 'full') {
    return (
      <span
        className="px-2 py-0.5 rounded-full text-xs font-medium
          bg-green-500/10 text-green-400 border border-green-500/20"
        title={`Fully synced (${synced}/${total} chords)`}
      >
        Synced
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span
        className="px-2 py-0.5 rounded-full text-xs font-medium
          bg-amber-500/10 text-amber-400 border border-amber-500/20"
        title={`Partially synced (${synced}/${total} chords)`}
      >
        Partial
      </span>
    );
  }
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium
        bg-zinc-800 text-zinc-600 border border-zinc-700"
      title="No sync data"
    >
      No sync
    </span>
  );
}
