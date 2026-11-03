import {
  type Analysis,
  analyzeEnglish,
  createJapaneseAnalyzer,
  looksEnglish,
  looksJapanese,
} from "@learning/grammar-marks";
import type { Settings } from "../types";

const analyzeJapanese = createJapaneseAnalyzer(chrome.runtime.getURL("dict/"));
const cache = new Map<string, Promise<Analysis | null>>();

/** Picks the language for a line and analyzes it once; the same line text is never analyzed twice. */
export function analyzeLine(text: string, settings: Settings): Promise<Analysis | null> {
  const lang = settings.ja && looksJapanese(text) ? "ja" : settings.en && looksEnglish(text) ? "en" : null;
  if (!lang) return Promise.resolve(null);
  const key = `${lang}\u0000${text}`;
  let result = cache.get(key);
  if (!result) {
    result = lang === "ja" ? analyzeJapanese(text) : Promise.resolve(analyzeEnglish(text));
    result = result.catch(error => {
      console.error("[Lyric Study] Analysis failed:", error);
      cache.delete(key);
      return null;
    });
    cache.set(key, result);
  }
  return result;
}
