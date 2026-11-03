import type { Token } from "@learning/grammar-marks";
import { getSettings, hideTranslation, restoreHiddenFor, saveWord } from "../storage";
import { cleanText, currentSong, lineStartSeconds, mainRun, translationOf } from "./dom";
import { HIDDEN_CLASS, translationLanguage } from "./hidden";
import { lookUpMeaning } from "./meaning";
import { showNotice } from "./notice";

export interface LineContext {
  line: HTMLElement;
  text: string;
  translation?: string;
}

export function lineContext(line: HTMLElement): LineContext | null {
  const text = cleanText(mainRun(line)?.textContent);
  if (!text) return null;
  const translation = translationOf(line);
  const visibleTranslation = translation && !translation.classList.contains(HIDDEN_CLASS) ? translation : null;
  return { line, text, translation: cleanText(visibleTranslation?.textContent) || undefined };
}

async function requestAnkiSync(): Promise<boolean> {
  try {
    const reply = await chrome.runtime.sendMessage({ type: "anki-sync" });
    return reply?.kind === "synced";
  } catch (error) {
    console.error("[Lyric Study] Anki sync request failed:", error);
    return false;
  }
}

/** Saves a word (with its grammar info when it came from a token) or a whole line. */
export async function saveItem(context: LineContext, token: Token | null, x: number, y: number): Promise<void> {
  const settings = await getSettings();
  const song = currentSong();
  const text = token ? token.surface : context.text;
  const lookup = token?.base ?? text;
  const meaning = settings.meaning && token ? await lookUpMeaning(lookup, token.lang, settings.meaningLang) : undefined;
  try {
    const { result } = await saveWord({
      text,
      base: token?.base,
      reading: token?.reading,
      pos: token?.pos,
      note: token?.note,
      meaning,
      line: context.text,
      translation: context.translation,
      song: song.song,
      artist: song.artist,
      videoId: song.videoId,
      time: lineStartSeconds(context.line),
      lang: token?.lang,
    });
    if (result === "exists") {
      showNotice("已經存過了", x, y);
      return;
    }
    showNotice("已儲存", x, y);
    if (settings.ankiAutoSync && (await requestAnkiSync())) showNotice("已儲存，並送到 Anki", x, y);
  } catch (error) {
    console.error("[Lyric Study] Save failed:", error);
    showNotice("儲存失敗", x, y);
  }
}

export async function removeTranslation(context: LineContext, x: number, y: number): Promise<void> {
  const { videoId } = currentSong();
  const translation = translationOf(context.line);
  if (!videoId || !translation) return;
  translation.classList.add(HIDDEN_CLASS);
  await hideTranslation(videoId, translationLanguage(translation), context.text);
  showNotice("已隱藏這句翻譯", x, y);
}

export async function restoreTranslations(x: number, y: number): Promise<void> {
  const { videoId } = currentSong();
  if (!videoId) return;
  await restoreHiddenFor(videoId);
  showNotice("已還原這首歌的翻譯", x, y);
}
