import { DEFAULT_SETTINGS, type SavedWord, type Settings } from "./types";

export const WORDS_KEY = "words";
export const HIDDEN_KEY = "hiddenTranslations";
export const SETTINGS_KEY = "settings";
const MAX_TEXT = 300;

function clamp(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  return cleaned || undefined;
}

// -- Settings --------------------------

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] as Partial<Settings> | undefined) };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...patch } });
}

// -- Saved words --------------------------

export async function getWords(): Promise<SavedWord[]> {
  const result = await chrome.storage.local.get(WORDS_KEY);
  const words = result[WORDS_KEY];
  return Array.isArray(words) ? (words as SavedWord[]) : [];
}

async function setWords(words: SavedWord[]): Promise<void> {
  await chrome.storage.local.set({ [WORDS_KEY]: words });
}

export type SaveResult = "added" | "exists";

export async function saveWord(
  entry: Omit<SavedWord, "id" | "savedAt">
): Promise<{ result: SaveResult; word?: SavedWord }> {
  const text = clamp(entry.text);
  if (!text) throw new Error("Nothing to save");
  const words = await getWords();
  const key = (entry.base || text).toLocaleLowerCase();
  const exists = words.some(
    word => word.videoId === entry.videoId && (word.base || word.text).toLocaleLowerCase() === key
  );
  if (exists) return { result: "exists" };
  const saved: SavedWord = {
    ...entry,
    text,
    line: clamp(entry.line) ?? text,
    translation: clamp(entry.translation),
    meaning: clamp(entry.meaning),
    id: crypto.randomUUID(),
    savedAt: Date.now(),
  };
  await setWords([saved, ...words]);
  return { result: "added", word: saved };
}

export async function removeWord(id: string): Promise<void> {
  await setWords((await getWords()).filter(word => word.id !== id));
}

export async function restoreWords(words: SavedWord[]): Promise<void> {
  await setWords(words);
}

export async function markSynced(ids: Map<string, number>): Promise<void> {
  const words = await getWords();
  await setWords(words.map(word => (ids.has(word.id) ? { ...word, ankiNoteId: ids.get(word.id) } : word)));
}

export function songUrl(word: Pick<SavedWord, "videoId" | "time">): string {
  if (!word.videoId) return "";
  const time = word.time ? `&t=${Math.max(0, Math.floor(word.time))}s` : "";
  return `https://music.youtube.com/watch?v=${encodeURIComponent(word.videoId)}${time}`;
}

// -- Hidden translations --------------------------

/** `${videoId}|${language}` → trimmed original lines whose translation is hidden. */
export type HiddenTranslations = Record<string, string[]>;

export function hiddenKey(videoId: string, language: string): string {
  return `${videoId}|${language}`;
}

export async function getHidden(): Promise<HiddenTranslations> {
  const result = await chrome.storage.local.get(HIDDEN_KEY);
  const value = result[HIDDEN_KEY];
  return value && typeof value === "object" ? (value as HiddenTranslations) : {};
}

export async function hideTranslation(videoId: string, language: string, line: string): Promise<void> {
  const all = await getHidden();
  const key = hiddenKey(videoId, language);
  const lines = all[key] ?? [];
  if (!lines.includes(line)) all[key] = [...lines, line];
  await chrome.storage.local.set({ [HIDDEN_KEY]: all });
}

export async function restoreHiddenFor(videoId: string): Promise<void> {
  const all = await getHidden();
  for (const key of Object.keys(all)) if (key.startsWith(`${videoId}|`)) delete all[key];
  await chrome.storage.local.set({ [HIDDEN_KEY]: all });
}

export async function clearHidden(): Promise<void> {
  await chrome.storage.local.remove(HIDDEN_KEY);
}

export function countHidden(all: HiddenTranslations): number {
  return Object.values(all).reduce((sum, lines) => sum + lines.length, 0);
}
