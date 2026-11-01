import { ROMANIZED_LYRICS_CLASS, TRANSLATED_LYRICS_CLASS } from "@constants";
import { AppState, reloadLyrics } from "@core/appState";
import { t } from "@core/i18n";
import { hideTranslation, restoreHiddenTranslations, type SaveWordResult, saveWord } from "@core/vocabulary";
import { lyricsElementAdded, mainView } from "@modules/ui/mainLyricsView";
import { publishSecondaryViews } from "@modules/ui/secondaryViews";

const NOTICE_CLASS = "blyrics-lyric-notice";
const WORD_GROUP_SELECTOR = ".blyrics-word-group";
const MAIN_TEXT_SELECTOR = ":scope > .blyrics-line-main > .blyrics-bidi-run:not(.blyrics-highlight-run)";
const EDGE_GAP = 8;
const NOTICE_DURATION_MS = 1800;

export interface LineContext {
  index: number;
  lineElement: HTMLElement;
  lineText: string;
  translation: string | undefined;
  romanization: string | undefined;
}

let noticeTimer: ReturnType<typeof setTimeout> | undefined;

// -- Reading the line --------------------------

function cleanText(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

export function readLineContext(lineElement: HTMLElement): LineContext | null {
  const index = mainView.lines.findIndex(line => line.lyricElement === lineElement);
  if (index < 0) return null;
  const lyric = AppState.parsedLyrics?.lyrics[index];
  if (lyric?.isInstrumental) return null;
  const lineText = cleanText(lyric?.words) || cleanText(lineElement.querySelector(MAIN_TEXT_SELECTOR)?.textContent);
  if (!lineText) return null;
  return {
    index,
    lineElement,
    lineText,
    translation: cleanText(lineElement.querySelector(`.${TRANSLATED_LYRICS_CLASS}`)?.textContent) || undefined,
    romanization: cleanText(lineElement.querySelector(`.${ROMANIZED_LYRICS_CLASS}`)?.textContent) || undefined,
  };
}

export function selectedText(wrapper: HTMLElement): string {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.anchorNode) return "";
  if (!wrapper.contains(selection.anchorNode)) return "";
  return cleanText(selection.toString());
}

export function wordAt(target: Element): string {
  const group = target.closest<HTMLElement>(WORD_GROUP_SELECTOR);
  return cleanText(group?.dataset.content).replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");
}

// -- Feedback --------------------------

/** Places a fixed element at a point, kept inside the viewport. */
export function placeInViewport(element: HTMLElement, x: number, y: number): void {
  const { width, height } = element.getBoundingClientRect();
  element.style.left = `${Math.max(EDGE_GAP, Math.min(x, window.innerWidth - width - EDGE_GAP))}px`;
  element.style.top = `${Math.max(EDGE_GAP, Math.min(y, window.innerHeight - height - EDGE_GAP))}px`;
}

function showNotice(message: string, x: number, y: number): void {
  document.querySelector(`.${NOTICE_CLASS}`)?.remove();
  clearTimeout(noticeTimer);
  const notice = document.createElement("div");
  notice.className = NOTICE_CLASS;
  notice.setAttribute("role", "status");
  notice.textContent = message;
  document.body.appendChild(notice);
  placeInViewport(notice, x, y);
  requestAnimationFrame(() => notice.classList.add(`${NOTICE_CLASS}--visible`));
  noticeTimer = setTimeout(() => notice.remove(), NOTICE_DURATION_MS);
}

function saveResultMessage(result: SaveWordResult): string {
  if (result === "added") return t("vocab_notice_saved");
  if (result === "exists") return t("vocab_notice_exists");
  return t("vocab_notice_failed");
}

// -- Actions --------------------------

export async function saveText(text: string, line: LineContext, x: number, y: number): Promise<void> {
  const result = await saveWord({
    text,
    line: line.lineText,
    translation: line.translation,
    romanization: line.romanization,
    song: AppState.lyricData?.song ?? "",
    artist: AppState.lyricData?.artist ?? "",
    videoId: AppState.lastLoadedVideoId ?? "",
  });
  showNotice(saveResultMessage(result), x, y);
}

export async function removeTranslation(line: LineContext, x: number, y: number): Promise<void> {
  const videoId = AppState.lastLoadedVideoId;
  if (!videoId) return;
  line.lineElement.querySelector(`.${TRANSLATED_LYRICS_CLASS}`)?.remove();
  const decoration = AppState.lyricDecorations[line.index];
  if (decoration) {
    delete decoration.translation;
    delete decoration.translationLanguage;
  }
  lyricsElementAdded();
  publishSecondaryViews();
  await hideTranslation(videoId, AppState.translationLanguage, line.lineText);
  showNotice(t("vocab_notice_translationRemoved"), x, y);
}

export async function restoreTranslations(x: number, y: number): Promise<void> {
  const videoId = AppState.lastLoadedVideoId;
  if (!videoId) return;
  await restoreHiddenTranslations(videoId, AppState.translationLanguage);
  showNotice(t("vocab_notice_translationsRestored"), x, y);
  reloadLyrics();
}
