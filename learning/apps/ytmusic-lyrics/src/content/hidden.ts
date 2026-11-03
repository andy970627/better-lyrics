import { getHidden, type HiddenTranslations, HIDDEN_KEY, hiddenKey } from "../storage";
import { cleanText, currentSong, lyricLines, mainRun, translationOf } from "./dom";

// Better Lyrics adds translations itself, so a wrong one is hidden with a class rather than
// prevented; this re-applies after every re-render. Its renderer re-measures on resize, so the
// line heights settle on their own.

export const HIDDEN_CLASS = "ls-hidden-translation";
let hidden: HiddenTranslations = {};

export async function loadHidden(onChange: () => void): Promise<void> {
  hidden = await getHidden();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(HIDDEN_KEY in changes)) return;
    const next = changes[HIDDEN_KEY].newValue;
    hidden = next && typeof next === "object" ? (next as HiddenTranslations) : {};
    onChange();
  });
}

export function translationLanguage(element: HTMLElement): string {
  return element.lang || "und";
}

export function isHidden(videoId: string, language: string, lineText: string): boolean {
  return hidden[hiddenKey(videoId, language)]?.includes(lineText) ?? false;
}

export function hiddenCountForSong(videoId: string): number {
  return Object.entries(hidden)
    .filter(([key]) => key.startsWith(`${videoId}|`))
    .reduce((sum, [, lines]) => sum + lines.length, 0);
}

export function applyHidden(wrapper: HTMLElement): void {
  const { videoId } = currentSong();
  for (const line of lyricLines(wrapper)) {
    const translation = translationOf(line);
    if (!translation) continue;
    const text = cleanText(mainRun(line)?.textContent);
    translation.classList.toggle(HIDDEN_CLASS, !!videoId && isHidden(videoId, translationLanguage(translation), text));
  }
}
