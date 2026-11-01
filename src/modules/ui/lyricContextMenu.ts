import { LINE_CLASS, LYRIC_MENU_ERROR_LOG } from "@constants";
import { AppState } from "@core/appState";
import { t } from "@core/i18n";
import { logCore } from "@core/logger";
import { hiddenTranslationCountFor } from "@core/vocabulary";
import {
  type LineContext,
  placeInViewport,
  readLineContext,
  removeTranslation,
  restoreTranslations,
  saveText,
  selectedText,
  wordAt,
} from "@modules/ui/lyricActions";

const MENU_CLASS = "blyrics-dock__menu blyrics-lyric-menu";
const MENU_OPEN_CLASS = "blyrics-dock__menu--open";
const MENU_ITEM_CLASS = "blyrics-dock__menu-item";
const MAX_WORD_PREVIEW = 24;

interface MenuEntry {
  label: string;
  onSelect: () => void | Promise<void>;
}

let openMenu: HTMLElement | null = null;
let closeListeners: AbortController | null = null;

function preview(text: string): string {
  return text.length > MAX_WORD_PREVIEW ? `${text.slice(0, MAX_WORD_PREVIEW - 1)}…` : text;
}

function menuEntries(wrapper: HTMLElement, target: Element, line: LineContext, x: number, y: number): MenuEntry[] {
  const entries: MenuEntry[] = [];
  const word = selectedText(wrapper) || wordAt(target);
  if (word && word !== line.lineText) {
    entries.push({ label: t("vocab_menu_saveWord", preview(word)), onSelect: () => saveText(word, line, x, y) });
  }
  entries.push({ label: t("vocab_menu_saveLine"), onSelect: () => saveText(line.lineText, line, x, y) });
  if (line.translation) {
    entries.push({ label: t("vocab_menu_removeTranslation"), onSelect: () => removeTranslation(line, x, y) });
  }
  if (hiddenTranslationCountFor(AppState.lastLoadedVideoId, AppState.translationLanguage) > 0) {
    entries.push({ label: t("vocab_menu_restoreTranslations"), onSelect: () => restoreTranslations(x, y) });
  }
  return entries;
}

function closeMenu(): void {
  closeListeners?.abort();
  closeListeners = null;
  openMenu?.remove();
  openMenu = null;
}

function showMenu(entries: MenuEntry[], x: number, y: number): void {
  closeMenu();
  const menu = document.createElement("div");
  menu.className = MENU_CLASS;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", t("vocab_menu_label"));

  const buttons = entries.map(entry => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = MENU_ITEM_CLASS;
    button.setAttribute("role", "menuitem");
    button.textContent = entry.label;
    button.addEventListener("click", () => {
      closeMenu();
      Promise.resolve(entry.onSelect()).catch(error => logCore(LYRIC_MENU_ERROR_LOG, error));
    });
    return button;
  });
  menu.replaceChildren(...buttons);
  document.body.appendChild(menu);
  placeInViewport(menu, x, y);
  requestAnimationFrame(() => menu.classList.add(MENU_OPEN_CLASS));
  openMenu = menu;
  buttons[0]?.focus({ preventScroll: true });

  closeListeners = new AbortController();
  const { signal } = closeListeners;
  document.addEventListener(
    "pointerdown",
    event => {
      if (!menu.contains(event.target as Node)) closeMenu();
    },
    { capture: true, signal }
  );
  document.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      buttons[(current + step + buttons.length) % buttons.length]?.focus({ preventScroll: true });
    },
    { capture: true, signal }
  );
  window.addEventListener("scroll", closeMenu, { capture: true, passive: true, signal });
  window.addEventListener("resize", closeMenu, { signal });
  window.addEventListener("blur", closeMenu, { signal });
}

/**
 * The keyboard-and-mouse fallback for the drag gestures: right-clicking a line offers the same
 * actions. Shift + right-click keeps the browser's own menu.
 */
export function attachLyricContextMenu(wrapper: HTMLElement): void {
  wrapper.addEventListener("contextmenu", event => {
    if (event.shiftKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const lineElement = target.closest<HTMLElement>(`.${LINE_CLASS}`);
    if (!lineElement || !wrapper.contains(lineElement)) return;
    const line = readLineContext(lineElement);
    if (!line) return;
    event.preventDefault();
    showMenu(menuEntries(wrapper, target, line, event.clientX, event.clientY), event.clientX, event.clientY);
  });
}
