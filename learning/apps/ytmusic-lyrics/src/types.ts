import type { Lang } from "@learning/grammar-marks";

export interface SavedWord {
  id: string;
  text: string;
  base?: string;
  reading?: string;
  pos?: string;
  note?: string;
  meaning?: string;
  line: string;
  translation?: string;
  song: string;
  artist: string;
  videoId: string;
  /** Seconds into the song where the line starts, when known. */
  time?: number;
  lang?: Lang;
  savedAt: number;
  /** Set once the word has been added to Anki through AnkiConnect. */
  ankiNoteId?: number;
}

/** "grammar" leaves content words unmarked and keeps only particles, inflections and patterns. */
export type MarkLevel = "all" | "grammar";

export interface Settings {
  marks: boolean;
  markLevel: MarkLevel;
  ja: boolean;
  en: boolean;
  meaning: boolean;
  meaningLang: string;
  /** Send each saved word to Anki right away, when AnkiConnect is reachable. */
  ankiAutoSync: boolean;
  ankiDeck: string;
}

export const DEFAULT_SETTINGS: Settings = {
  marks: true,
  markLevel: "all",
  ja: true,
  en: true,
  meaning: true,
  meaningLang: "zh-TW",
  ankiAutoSync: true,
  ankiDeck: "Lyric Study",
};
