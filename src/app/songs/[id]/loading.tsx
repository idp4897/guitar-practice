export default function Loading() {
  return (
    <div className="flex flex-col h-full bg-zinc-950 animate-pulse">

      {/* Song header */}
      <div className="shrink-0 px-5 pt-4 pb-2.5 flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-7 w-44 rounded-md bg-zinc-800" />
          <div className="h-3.5 w-28 rounded bg-zinc-800/60" />
          <div className="h-3 w-20 rounded bg-zinc-800/40 mt-1" />
        </div>
        <div className="h-8 w-12 rounded-lg bg-zinc-800/60 mt-1 shrink-0" />
      </div>

      {/* ControlBar */}
      <div className="shrink-0 flex items-center gap-1 px-3 h-12 border-b border-zinc-800">
        <div className="w-10 h-10 rounded-lg bg-zinc-800/60" />
        <div className="w-14 h-7 rounded bg-zinc-800/60 mx-1" />
        <div className="w-10 h-10 rounded-lg bg-zinc-800/60" />
        <div className="w-px h-5 bg-zinc-800 mx-1 shrink-0" />
        <div className="flex gap-1 flex-1 overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="w-7 h-7 rounded-lg bg-zinc-800/60 shrink-0" />
          ))}
        </div>
        <div className="w-px h-5 bg-zinc-800 mx-1 shrink-0" />
        <div className="w-9 h-9 rounded-lg bg-zinc-800/60" />
      </div>

      {/* Chord sheet */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-7">

          {/* Section 1 */}
          <div className="space-y-3">
            <div className="h-3 w-16 rounded bg-zinc-800/80" />
            <SkeletonLine chords={[60, 52, 48, 64]} lyrics={180} />
            <SkeletonLine chords={[48, 60, 52]} lyrics={200} />
            <SkeletonLine chords={[56, 44, 60, 48]} lyrics={160} />
            <SkeletonLine chords={[52, 64, 48]} lyrics={190} />
          </div>

          {/* Section 2 */}
          <div className="space-y-3">
            <div className="h-3 w-20 rounded bg-zinc-800/80" />
            <SkeletonLine chords={[64, 48, 56]} lyrics={170} />
            <SkeletonLine chords={[52, 60, 44, 52]} lyrics={210} />
            <SkeletonLine chords={[60, 56]} lyrics={150} />
            <SkeletonLine chords={[48, 64, 52, 44]} lyrics={185} />
          </div>

          {/* Section 3 */}
          <div className="space-y-3">
            <div className="h-3 w-14 rounded bg-zinc-800/80" />
            <SkeletonLine chords={[56, 48, 64]} lyrics={195} />
            <SkeletonLine chords={[44, 60, 52, 56]} lyrics={165} />
          </div>

        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="shrink-0 h-11 border-t border-zinc-800/60 bg-zinc-900" />
    </div>
  );
}

function SkeletonLine({ chords, lyrics }: { chords: number[]; lyrics: number }) {
  return (
    <div className="space-y-1">
      {/* Chord row */}
      <div className="flex gap-3">
        {chords.map((w, i) => (
          <div key={i} className="h-3.5 rounded bg-zinc-800" style={{ width: w }} />
        ))}
      </div>
      {/* Lyric row */}
      <div className="h-5 rounded bg-zinc-800/50" style={{ width: lyrics }} />
    </div>
  );
}
