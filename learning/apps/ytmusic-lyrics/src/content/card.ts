import { getSettings } from "../storage";
import { lineContext, saveItem } from "./actions";
import { type Hit, hitTest } from "./marks";
import { lookUpMeaning } from "./meaning";

const CARD_CLASS = "ls-card";
const SHOW_DELAY_MS = 220;
const HIDE_DELAY_MS = 260;
const GAP = 8;

let card: HTMLElement | null = null;
let shown: Hit | null = null;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let suspended = false;

function row(className: string, text: string): HTMLElement {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text;
  return element;
}

/** What to look up: the whole phrase for a phrasal verb ("show up"), else the dictionary form. */
export function lookupText(hit: Hit): string {
  if (hit.span?.label.startsWith("片語動詞")) return hit.info.map.text.slice(hit.span.start, hit.span.end);
  return hit.token.base ?? hit.token.surface;
}

function dictionaryUrl(hit: Hit): string {
  const word = encodeURIComponent(hit.token.base ?? hit.token.surface);
  return hit.token.lang === "ja"
    ? `https://jisho.org/search/${word}`
    : `https://dictionary.cambridge.org/dictionary/english-chinese-traditional/${word}`;
}

function build(hit: Hit): HTMLElement {
  const { token, span } = hit;
  const element = document.createElement("div");
  element.className = `${CARD_CLASS} ${CARD_CLASS}--${token.category}`;
  element.setAttribute("role", "tooltip");

  const head = document.createElement("div");
  head.className = `${CARD_CLASS}__head`;
  head.appendChild(row(`${CARD_CLASS}__word`, token.surface));
  if (token.reading) head.appendChild(row(`${CARD_CLASS}__reading`, token.reading));
  const save = document.createElement("button");
  save.type = "button";
  save.className = `${CARD_CLASS}__save`;
  save.textContent = "☆ 存";
  save.title = "存到單字本";
  save.addEventListener("click", event => {
    event.stopPropagation();
    const context = lineContext(hit.info.line);
    if (!context) return;
    const box = save.getBoundingClientRect();
    save.textContent = "★";
    void saveItem(context, token, box.left, box.bottom + 6);
  });
  element.appendChild(head);

  const pos = [token.pos, token.base && token.base !== token.surface ? `原形 ${token.base}` : ""].filter(Boolean);
  element.appendChild(row(`${CARD_CLASS}__pos`, pos.join("・")));
  if (span) element.appendChild(row(`${CARD_CLASS}__pattern`, `${span.label}：${span.note}`));
  if (token.note) element.appendChild(row(`${CARD_CLASS}__note`, token.note));

  const meaning = row(`${CARD_CLASS}__meaning`, "");
  meaning.hidden = true;
  element.appendChild(meaning);
  void getSettings().then(async settings => {
    if (!settings.meaning) return;
    const text = await lookUpMeaning(lookupText(hit), token.lang, settings.meaningLang);
    if (text && shown === hit) {
      meaning.textContent = text;
      meaning.hidden = false;
      position(element, hit);
    }
  });

  const link = document.createElement("a");
  link.className = `${CARD_CLASS}__dict`;
  link.href = dictionaryUrl(hit);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = token.lang === "ja" ? "Jisho ↗" : "Cambridge ↗";

  // Only this row takes the pointer: the rest of the card lets it through to the lyrics beneath,
  // so a card never blocks the line it happens to cover.
  const actions = document.createElement("div");
  actions.className = `${CARD_CLASS}__actions`;
  actions.append(save, link);
  actions.addEventListener("pointerenter", () => clearTimeout(hideTimer));
  actions.addEventListener("pointerleave", scheduleHide);
  element.appendChild(actions);
  return element;
}

function position(element: HTMLElement, hit: Hit): void {
  const anchor = hit.range.getBoundingClientRect();
  const { width, height } = element.getBoundingClientRect();
  const left = Math.max(GAP, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - GAP));
  const above = anchor.top - height - GAP;
  const isAbove = above >= GAP;
  // The actions row sits on the side nearest the word, so reaching it never crosses other lyrics.
  element.classList.toggle(`${CARD_CLASS}--below`, !isAbove);
  element.style.left = `${left}px`;
  element.style.top = `${isAbove ? above : anchor.bottom + GAP}px`;
}

function show(hit: Hit): void {
  hide();
  shown = hit;
  card = build(hit);
  document.body.appendChild(card);
  position(card, hit);
  requestAnimationFrame(() => card?.classList.add(`${CARD_CLASS}--visible`));
}

export function hide(): void {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  card?.remove();
  card = null;
  shown = null;
}

function scheduleHide(): void {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, HIDE_DELAY_MS);
}

function sameToken(a: Hit | null, b: Hit | null): boolean {
  return !!a && !!b && a.info === b.info && a.token === b.token;
}

/** Drags and menus take over the pointer; the card stays out of their way meanwhile. */
export function suspendCard(value: boolean): void {
  suspended = value;
  if (value) hide();
}

export function attachCard(): void {
  let frame = 0;
  let pending: Hit | null = null;
  document.addEventListener(
    "pointermove",
    event => {
      if (event.pointerType === "touch") return;
      const { clientX: x, clientY: y } = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (suspended) return;
        if (document.elementFromPoint(x, y)?.closest(`.${CARD_CLASS}__actions`)) return;
        const hit = hitTest(x, y);
        if (sameToken(hit, shown)) {
          clearTimeout(hideTimer);
          return;
        }
        if (sameToken(hit, pending)) return;
        pending = hit;
        clearTimeout(showTimer);
        if (!hit) {
          if (shown) scheduleHide();
          return;
        }
        showTimer = setTimeout(
          () => {
            pending = null;
            show(hit);
          },
          shown ? 60 : SHOW_DELAY_MS
        );
      });
    },
    { passive: true }
  );
  // Better Lyrics scrolls the lyrics as the song plays: follow the word instead of closing.
  window.addEventListener(
    "scroll",
    () => {
      if (!card || !shown) return;
      if (shown.info.line.isConnected) position(card, shown);
      else hide();
    },
    { capture: true, passive: true }
  );
  window.addEventListener("blur", hide);
}
