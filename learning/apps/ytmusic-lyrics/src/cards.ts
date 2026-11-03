import type { LearningCard } from "@learning/anki-bridge";
import { songUrl } from "./storage";
import type { SavedWord } from "./types";

export const APP_TAG = "lyric-study";

export function toLearningCard(word: SavedWord): LearningCard {
  const grammar = [word.pos, word.base && word.base !== word.text ? `原形 ${word.base}` : "", word.note]
    .filter(Boolean)
    .join("・");
  const source = [word.song, word.artist].filter(Boolean).join(" — ");
  return {
    id: word.id,
    text: word.text,
    reading: word.reading,
    meaning: word.meaning,
    grammar: grammar || undefined,
    context: word.line !== word.text ? word.line : undefined,
    contextTranslation: word.translation,
    sourceTitle: source || undefined,
    sourceUrl: songUrl(word) || undefined,
    tags: word.lang ? [word.lang] : [],
  };
}
