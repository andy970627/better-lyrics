import { errorCore } from "@core/logger";

// -- Saved words --------------------------

export const SAVED_WORDS_KEY = "savedWords";
const MAX_SAVED_WORDS = 2000;
const MAX_SAVED_TEXT_LENGTH = 300;

export interface SavedWord {
  id: string;
  text: string;
  line: string;
  translation?: string;
  romanization?: string;
  song: string;
  artist: string;
  videoId: string;
  savedAt: number;
}

export type SaveWordResult = "added" | "exists" | "failed";

function clampText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_SAVED_TEXT_LENGTH);
}

function sameWord(a: SavedWord, text: string, videoId: string): boolean {
  return a.videoId === videoId && a.text.toLocaleLowerCase() === text.toLocaleLowerCase();
}

export async function getSavedWords(): Promise<SavedWord[]> {
  const result = await chrome.storage.local.get(SAVED_WORDS_KEY);
  const words = result[SAVED_WORDS_KEY];
  return Array.isArray(words) ? (words as SavedWord[]) : [];
}

/**
 * Saves a word or phrase, newest first. The same text from the same song is saved once.
 */
export async function saveWord(entry: Omit<SavedWord, "id" | "savedAt">): Promise<SaveWordResult> {
  const text = clampText(entry.text);
  if (!text) return "failed";
  try {
    const words = await getSavedWords();
    if (words.some(word => sameWord(word, text, entry.videoId))) return "exists";
    const saved: SavedWord = {
      ...entry,
      id: crypto.randomUUID(),
      text,
      line: clampText(entry.line),
      translation: entry.translation ? clampText(entry.translation) : undefined,
      romanization: entry.romanization ? clampText(entry.romanization) : undefined,
      savedAt: Date.now(),
    };
    await chrome.storage.local.set({ [SAVED_WORDS_KEY]: [saved, ...words].slice(0, MAX_SAVED_WORDS) });
    return "added";
  } catch (error) {
    errorCore("Failed to save word:", error);
    return "failed";
  }
}

export async function removeSavedWord(id: string): Promise<void> {
  const words = await getSavedWords();
  await chrome.storage.local.set({ [SAVED_WORDS_KEY]: words.filter(word => word.id !== id) });
}

export async function restoreSavedWords(words: readonly SavedWord[]): Promise<void> {
  await chrome.storage.local.set({ [SAVED_WORDS_KEY]: words });
}

export async function clearSavedWords(): Promise<void> {
  await chrome.storage.local.remove(SAVED_WORDS_KEY);
}

function csvCell(value: string | undefined): string {
  const text = value ?? "";
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function savedWordsToCsv(words: readonly SavedWord[]): string {
  const header = ["word", "line", "translation", "romanization", "song", "artist", "videoId", "savedAt"];
  const rows = words.map(word =>
    [
      word.text,
      word.line,
      word.translation,
      word.romanization,
      word.song,
      word.artist,
      word.videoId,
      new Date(word.savedAt).toISOString(),
    ]
      .map(csvCell)
      .join(",")
  );
  return [header.join(","), ...rows].join("\r\n");
}

// -- Hidden translations --------------------------

/**
 * Translations the user removed as wrong, keyed by `${videoId}|${targetLanguage}` and holding the
 * trimmed original lines whose translation should not be shown again.
 */
export const HIDDEN_TRANSLATIONS_KEY = "hiddenTranslations";

type HiddenTranslations = Record<string, string[]>;

function hiddenKey(videoId: string, language: string): string {
  return `${videoId}|${language}`;
}

async function readHiddenTranslations(): Promise<HiddenTranslations> {
  const result = await chrome.storage.local.get(HIDDEN_TRANSLATIONS_KEY);
  const value = result[HIDDEN_TRANSLATIONS_KEY];
  return value && typeof value === "object" ? (value as HiddenTranslations) : {};
}

let hiddenMirror: HiddenTranslations = {};
let isMirrorListening = false;

/**
 * Loads the hidden translations into memory and keeps them current, so the lyrics pass can check
 * a line synchronously.
 */
export async function loadHiddenTranslations(): Promise<void> {
  if (!isMirrorListening) {
    isMirrorListening = true;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !(HIDDEN_TRANSLATIONS_KEY in changes)) return;
      const next = changes[HIDDEN_TRANSLATIONS_KEY].newValue;
      hiddenMirror = next && typeof next === "object" ? (next as HiddenTranslations) : {};
    });
  }
  try {
    hiddenMirror = await readHiddenTranslations();
  } catch (error) {
    errorCore("Failed to load hidden translations:", error);
  }
}

export function isTranslationHidden(videoId: string | null | undefined, language: string, line: string): boolean {
  if (!videoId) return false;
  return hiddenMirror[hiddenKey(videoId, language)]?.includes(line.trim()) ?? false;
}

export function hiddenTranslationCountFor(videoId: string | null | undefined, language: string): number {
  if (!videoId) return 0;
  return hiddenMirror[hiddenKey(videoId, language)]?.length ?? 0;
}

export async function hideTranslation(videoId: string, language: string, line: string): Promise<void> {
  const trimmed = line.trim();
  if (!videoId || !trimmed) return;
  const all = await readHiddenTranslations();
  const key = hiddenKey(videoId, language);
  const lines = all[key] ?? [];
  if (!lines.includes(trimmed)) all[key] = [...lines, trimmed];
  hiddenMirror = all;
  await chrome.storage.local.set({ [HIDDEN_TRANSLATIONS_KEY]: all });
}

export async function restoreHiddenTranslations(videoId: string, language: string): Promise<void> {
  const all = await readHiddenTranslations();
  delete all[hiddenKey(videoId, language)];
  hiddenMirror = all;
  await chrome.storage.local.set({ [HIDDEN_TRANSLATIONS_KEY]: all });
}

export async function countHiddenTranslations(): Promise<number> {
  const all = await readHiddenTranslations();
  return Object.values(all).reduce((sum, lines) => sum + lines.length, 0);
}

export async function clearHiddenTranslations(): Promise<void> {
  hiddenMirror = {};
  await chrome.storage.local.remove(HIDDEN_TRANSLATIONS_KEY);
}
