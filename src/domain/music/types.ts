export interface ChordToken {
  chord:   string | null;
  text:    string;
  marker?: boolean;  // true for non-chord bracket tokens like [/], [%], [N.C.]
}

export interface ChordProLine {
  type: 'lyric' | 'directive' | 'comment' | 'empty';
  tokens: ChordToken[];
  directiveKey?: string;
  directiveValue?: string;
}

export interface ChordProSheet {
  title?: string;
  artist?: string;
  key?: string;
  capo?: number;
  lines: ChordProLine[];
}

export interface KeyCandidate {
  key:         string;            // "C", "Am", "F#m"
  mode:        'major' | 'minor';
  confidence:  number;            // 0–1
  nonDiatonic: string[];          // original chord names outside this key
  partial?:    boolean;           // true when returned from coverage fallback (low certainty)
}

export interface SectionKeyResult {
  label:  string;        // "Verse", "Chorus", "Section 1", etc.
  key:    string | null; // top detected key, null if section has < 2 parseable chords
  chords: string[];
}

export interface SectionAnalysisResult {
  hasModulation: boolean;
  sections:      SectionKeyResult[];
}

export interface ChordCue {
  time: number;   // seconds from video start
  chord: string;  // chord name, e.g. "Am"
}

export interface SongKey {
  key:    string;              // root note only — "E", "G", "C#", "Bb"
  mode:   'major' | 'minor';
  label?: string;              // optional section tag — "Verse", "Hook"
}

export interface DiatonicChordInfo {
  chord:                 string;              // "E", "F#m", "D#dim"
  degree:                number;              // 1–7
  romanNumeral:          string;              // "I", "ii", "iii", "IV", "V", "vi", "vii°"
  fn:                    string;              // "Tonic", "Supertonic", …
  quality:               'major' | 'minor' | 'dim';
  isPrimary:             boolean;             // true for degree 1, 4, 5
  harmonicMinorVariant?: string;              // V major chord name (only for degree 5 of minor keys)
}
