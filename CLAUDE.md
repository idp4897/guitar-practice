@AGENTS.md

# Guitar Practice — Project Context for Claude

## Stack

- **Next.js 16** App Router (Server Components, Server Actions, `loading.tsx`)
- **React 19** — use `useActionState`, avoid legacy patterns
- **TypeScript** — strict, explicit types, no `any`
- **Tailwind CSS v4**
- **Tonal.js** — music theory (`Note`, `Chord`, `Interval`, `Key`)
- **tombatossals/chords-db** — guitar chord position database (standard tuning only)
- **Vitest** — unit tests in `src/__tests__/domain/`

## Architecture

Clean Architecture layers. Business logic lives in `domain/`, never in components or actions.

```
src/
├── app/                        Server Components (routes, pages)
├── application/                Server Actions ("use server")
│   ├── songs/song.actions.ts
│   ├── collections/collection.actions.ts
│   └── pomodoro/pomodoro.actions.ts
├── components/                 Client Components ("use client")
├── domain/
│   ├── music/                  Pure music logic — theory, tuning, chordpro, types
│   ├── pomodoro/               Pure program/timeline logic
│   └── songs/ + collections/   Pure filter functions
├── hooks/                      useSongPlayer, useMetronome, useTapSync, usePomodoroRunner
└── lib/                        song-store.ts, collection-store.ts, pomodoro-store.ts, youtube.ts
```

## Data Storage

**Turso / libSQL — no Prisma.** The client lives in `src/lib/db.ts` and is driven by
`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` (see `.env.local`).

Tables: `songs`, `collections`, `collection_songs`, `pomodoro_programs`.

Schema is created lazily by `ensureDb()` on first query — every store method awaits it.
To add a column to an existing table, append a `tryAlter('ALTER TABLE … ADD COLUMN …')`
call at the end of `initSchema()`; it swallows the "column already exists" error so it is
safe to re-run. New tables go in the `executeMultiple` block as `CREATE TABLE IF NOT EXISTS`.

Access data through the stores in `src/lib/` (`songStore`, `collectionStore`,
`pomodoroStore`) — never query the client directly from a component or action.

The `prisma/` directory and `src/infrastructure/db/` are legacy stubs — ignore TS errors from them.

## Key Data Types

```typescript
// src/domain/music/types.ts
interface SongKey { key: string; mode: 'major' | 'minor'; label?: string; }
interface DiatonicChordInfo { chord, degree, romanNumeral, fn, quality, isPrimary, harmonicMinorVariant? }
interface ChordCue { time: number; chord: string; }

// src/lib/song-store.ts
interface StoredSong {
  id, title, artist?, content,   // ChordPro text
  keys?: SongKey[],              // user-defined key tags
  originalKey?,                  // legacy — migrate to keys[] on read
  capo, tuning?, bpm?,
  youtubeUrl?, chordMap?,
  createdAt, updatedAt
}

// src/lib/collection-store.ts
interface StoredCollection {
  id, name, description?,
  tags: string[],                // normalized: lowercase, trimmed, deduped
  songIds: string[],             // ordered, many-to-many as embedded array
  createdAt, updatedAt
}
```

## Server Actions Pattern

Every mutation calls `revalidatePath` AND `refresh()` to bust both the server cache and the client-side router cache:

```typescript
import { revalidatePath, refresh } from 'next/cache';

export async function savePlaybackAction(id: string, data: UpdateSongInput) {
  songStore.update(id, data);
  revalidatePath(`/songs/${id}`);
  refresh();   // bust client router cache — prevents stale YouTube URL bug
}
```

## Caching / Routing Rules

- **`loading.tsx` exists in `src/app/songs/[id]/`** — this is intentional and critical. Without it, Next.js prefetches entire song pages with "until app reload" TTL, causing stale `youtubeUrl` when navigating back. With `loading.tsx`, prefetch TTL is 30s and navigations always fetch fresh data.
- **`key={song.id}` on `<PlayerPage>`** in `SongPlayerClient` — forces full unmount/remount on song change. Do not remove.
- **`<Suspense>` wrapper on `<LibraryPage>`** in `app/page.tsx` — required because `LibraryPage` uses `useSearchParams()`.

## Hydration Mismatch Pattern

Any component that conditionally disables buttons based on player state must use the `mounted` pattern:

```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);
const canPlay = mounted && player != null && ...;
```

This prevents server HTML (`disabled=true`) from mismatching client initial render when stale DOM from a previous navigation exists.

## Tuning System (`src/domain/music/tuning.ts`)

Supported tunings: `standard`, `eb_standard`, `drop_d`, `drop_db`.

Two categories:
- **Uniform-offset** (Eb Standard, D Standard): all strings lowered by the same semitones → use standard fingering shapes as-is. Player grips identically; pitch shifts uniformly.
- **Altered-interval** (Drop D, Drop C#/Db): strings offset differently → compute voicings from chord theory.

Key functions:
- `detectTuningType(tuning)` → `'uniform' | 'altered'`
- `getUniformOffset(tuning)` → semitone delta (Eb Standard = −1)
- `findVoicings(chord, tuning)` → uniform uses tombatossals DB; altered uses DFS fret search

`ChordDiagram` shows "sounds as X · concert pitch (N st lower)" for uniform non-standard tunings.

## Music Theory (`src/domain/music/theory.ts`)

- `analyzeKeySections(sheet)` → per-section key detection with modulation flag
- `getDiatonicChords(songKey)` → 7 `DiatonicChordInfo` (roman numerals, function names, I/IV/V highlighted, harmonic minor `*` on degree V of minor keys)
- `findUsedDiatonicChords(songChords, diatonicChords)` → `Set<string>`
- `getRelativeKey(songKey)` → relative major↔minor (tonal.js intervals)
- `parseSongKey(str)` / `formatSongKey(sk)` — serialize/display `SongKey`
- `transposeChord`, `applyCapo` via tonal.js

## Filters (pure functions)

```typescript
// src/domain/songs/filter.ts
filterSongs(songs, { query, tuningId })
// NFC-normalized substring match on title+artist, AND with tuning

// src/domain/collections/filter.ts
filterCollections(collections, query)
// NFC-normalized match on name OR any tag
```

Thai text support: always `.normalize('NFC').toLowerCase()`.

## Collections

- Many-to-many with songs via `songIds: string[]` embedded in `StoredCollection`
- Tag normalization: `normalizeTag(tag) = tag.trim().toLowerCase()`
- Optimistic updates in `LibraryPage` (toggle) and `CollectionViewPage` (add/remove song)
- Soft delete: removing a song from a collection does not delete the song; deleting a collection does not delete its songs

## Pomodoro Training (`/pomodoro`)

Interval practice: a program is an ordered list of mini-sessions, each with its own
BPM, time signature, training timer, and rest timer.

- `src/domain/pomodoro/program.ts` — `buildTimeline()` flattens sessions into
  `Stage[]` (train, rest, train, …). **The rest after the final session is dropped**,
  as is any session whose `restSec` is 0.
- `usePomodoroRunner(sessions)` owns one `useMetronome` and pushes each stage's BPM /
  time signature into it at the stage boundary.
- Countdowns run off a **wall-clock deadline** (`Date.now()`), not an accumulating
  interval — background tabs throttle timers and would stretch a 10-minute stage.
- The metronome is silent during rest. After each rest the runner parks in
  `awaitingReady` until the user confirms; this also guarantees every metronome start
  follows a user gesture, which the `AudioContext` requires.
- Sessions are stored as a JSON `TEXT` column on `pomodoro_programs`, like
  `songs.chord_map` — they are always read and written as one ordered list.

## Test Files (384 tests, all must pass)

```
src/__tests__/domain/
├── tuning.test.ts          detectTuningType, getUniformOffset, findVoicings
├── theory.test.ts          diatonic chords, relative key, parseSongKey
├── key-detection.test.ts   all 24 keys, modulation
├── filter.test.ts          filterSongs (Thai, tuning)
├── collection-filter.test.ts  filterCollections
├── chordpro.test.ts
├── chord-import.test.ts
├── bpm.test.ts
├── chord-placer.test.ts
├── gridCopy.test.ts
├── gridSync.test.ts
├── pomodoro.test.ts        buildTimeline, totalDurationSec, validateProgram
└── timeSignature.test.ts
```

Run with: `npm run test`

## What NOT to do

- Do not use Prisma — the database is Turso/libSQL, reached through the stores in `src/lib/`
- Do not remove `loading.tsx` from `src/app/songs/[id]/` — it prevents a real stale-data bug
- Do not remove `refresh()` from `savePlaybackAction` — same reason
- Do not commit `.env.local` — it holds the Turso credentials
- Do not add `any` types
- Do not mock the database in tests — domain functions are pure and don't touch it
