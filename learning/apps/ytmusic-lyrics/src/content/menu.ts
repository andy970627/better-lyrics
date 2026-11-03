import { lineContext, removeTranslation, restoreTranslations, saveItem } from "./actions";
import { suspendCard } from "./card";
import { currentSong, LINE_SELECTOR } from "./dom";
import { hiddenCountForSong } from "./hidden";
import { hitTest } from "./marks";
import { placeInViewport } from "./notice";

interface Entry {
  label: string;
  onSelect: () => Promise<void>;
}

let menu: HTMLElement | null = null;
let listeners: AbortController | null = null;

function close(): void {
  listeners?.abort();
  listeners = null;
  menu?.remove();
  menu = null;
  suspendCard(false);
}

function open(entries: Entry[], x: number, y: number): void {
  close();
  suspendCard(true);
  menu = document.createElement("div");
  menu.className = "ls-menu";
  menu.setAttribute("role", "menu");
  const buttons = entries.map(entry => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ls-menu__item";
    button.setAttribute("role", "menuitem");
    button.textContent = entry.label;
    button.addEventListener("click", () => {
      close();
      entry.onSelect().catch(error => console.error("[Lyric Study] Menu action failed:", error));
    });
    return button;
  });
  menu.replaceChildren(...buttons);
  document.body.appendChild(menu);
  placeInViewport(menu, x, y);
  buttons[0]?.focus({ preventScroll: true });

  listeners = new AbortController();
  const { signal } = listeners;
  const current = menu;
  document.addEventListener("pointerdown", e => !current.contains(e.target as Node) && close(), {
    capture: true,
    signal,
  });
  document.addEventListener(
    "keydown",
    e => {
      if (e.key === "Escape") return close();
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const step = e.key === "ArrowDown" ? 1 : -1;
      buttons[(index + step + buttons.length) % buttons.length]?.focus({ preventScroll: true });
    },
    { capture: true, signal }
  );
  window.addEventListener("scroll", close, { capture: true, passive: true, signal });
  window.addEventListener("blur", close, { signal });
}

/** Right-click on a line: the keyboard-and-mouse way to the same actions as dragging. Shift keeps the browser menu. */
export function attachMenu(): void {
  document.addEventListener("contextmenu", event => {
    if (event.shiftKey || !(event.target instanceof Element)) return;
    const line = event.target.closest<HTMLElement>(LINE_SELECTOR);
    if (!line?.closest("#blyrics-wrapper")) return;
    const context = lineContext(line);
    if (!context) return;
    const { clientX: x, clientY: y } = event;
    const hit = hitTest(x, y);
    const token = hit && hit.info.line === line ? hit.token : null;
    const entries: Entry[] = [];
    if (token) entries.push({ label: `存「${token.surface}」`, onSelect: () => saveItem(context, token, x, y) });
    entries.push({ label: "存整句", onSelect: () => saveItem(context, null, x, y) });
    if (context.translation)
      entries.push({ label: "隱藏這句錯誤翻譯", onSelect: () => removeTranslation(context, x, y) });
    if (hiddenCountForSong(currentSong().videoId) > 0) {
      entries.push({ label: "還原這首歌的翻譯", onSelect: () => restoreTranslations(x, y) });
    }
    event.preventDefault();
    open(entries, x, y);
  });
}
