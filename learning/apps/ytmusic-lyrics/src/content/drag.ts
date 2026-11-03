import type { Token } from "@learning/grammar-marks";
import { type LineContext, lineContext, removeTranslation, saveItem } from "./actions";
import { suspendCard } from "./card";
import { LINE_SELECTOR, TRANSLATION_SELECTOR } from "./dom";
import { hitTest } from "./marks";

// Drag a word out of the lyrics onto a drop zone. Works mid-song without aiming at small menu
// items; the zones only exist while something is being dragged.

const THRESHOLD_PX = 6;
const ZONE_GAP_PX = 24;
const DRAGGING_CLASS = "ls-dragging";

interface Target {
  label: string;
  danger?: boolean;
  onDrop: (x: number, y: number) => Promise<void>;
}

interface Pending {
  pointerId: number;
  x: number;
  y: number;
  label: string;
  targets: Target[];
}

interface Active {
  zones: HTMLElement;
  items: { element: HTMLElement; target: Target }[];
  ghost: HTMLElement;
  hovered: Target | null;
}

let pending: Pending | null = null;
let active: Active | null = null;

function wordTargets(context: LineContext, token: Token | null): Target[] {
  const targets: Target[] = [];
  if (token) targets.push({ label: "放開以儲存單字", onDrop: (x, y) => saveItem(context, token, x, y) });
  targets.push({ label: "放開以儲存整句", onDrop: (x, y) => saveItem(context, null, x, y) });
  return targets;
}

function sourceAt(target: Element, x: number, y: number): Omit<Pending, "pointerId" | "x" | "y"> | null {
  const line = target.closest<HTMLElement>(LINE_SELECTOR);
  if (!line) return null;
  const context = lineContext(line);
  if (!context) return null;
  if (target.closest(TRANSLATION_SELECTOR) && context.translation) {
    return {
      label: context.translation,
      targets: [{ label: "放開以隱藏這句翻譯", danger: true, onDrop: (dx, dy) => removeTranslation(context, dx, dy) }],
    };
  }
  const hit = hitTest(x, y);
  if (!hit || hit.info.line !== line) return null;
  return { label: hit.token.surface, targets: wordTargets(context, hit.token) };
}

function zoneAnchor(): { x: number; bottom: number } {
  const host = document.querySelector<HTMLElement>("#tab-renderer") ?? document.body;
  const rect = host.getBoundingClientRect();
  const left = Math.max(0, rect.left);
  const right = Math.min(window.innerWidth, rect.right);
  const bottom = Math.min(window.innerHeight, rect.bottom);
  return { x: (left + right) / 2, bottom: window.innerHeight - bottom + ZONE_GAP_PX };
}

function begin(source: Pending): Active {
  suspendCard(true);
  const zones = document.createElement("div");
  zones.className = "ls-zones";
  const { x, bottom } = zoneAnchor();
  zones.style.left = `${x}px`;
  zones.style.bottom = `${bottom}px`;
  const items = source.targets.map(target => {
    const element = document.createElement("div");
    element.className = target.danger ? "ls-zone ls-zone--danger" : "ls-zone";
    element.textContent = target.label;
    return { element, target };
  });
  zones.replaceChildren(...items.map(item => item.element));
  document.body.appendChild(zones);
  requestAnimationFrame(() => zones.classList.add("ls-zones--visible"));

  const ghost = document.createElement("div");
  ghost.className = "ls-ghost";
  ghost.textContent = source.label;
  document.body.appendChild(ghost);
  document.documentElement.classList.add(DRAGGING_CLASS);
  window.getSelection()?.removeAllRanges();
  return { zones, items, ghost, hovered: null };
}

function track(drag: Active, x: number, y: number): void {
  drag.hovered = null;
  for (const { element, target } of drag.items) {
    const rect = element.getBoundingClientRect();
    const over = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    element.classList.toggle("ls-zone--active", over);
    if (over) drag.hovered = target;
  }
  drag.ghost.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
}

function finish(drop: { x: number; y: number } | null): void {
  const drag = active;
  active = null;
  pending = null;
  if (!drag) return;
  drag.zones.remove();
  drag.ghost.remove();
  document.documentElement.classList.remove(DRAGGING_CLASS);
  suspendCard(false);
  if (drop && drag.hovered) {
    drag.hovered.onDrop(drop.x, drop.y).catch(error => console.error("[Lyric Study] Drop failed:", error));
  }
}

// The click that ends a drag would otherwise make Better Lyrics seek to that line.
function swallowNextClick(): void {
  const swallow = (event: MouseEvent): void => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
}

export function attachDrag(): void {
  document.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.pointerType === "touch" || active) return;
    if (!(event.target instanceof Element) || !event.target.closest("#blyrics-wrapper")) return;
    const source = sourceAt(event.target, event.clientX, event.clientY);
    if (source) pending = { ...source, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  });
  window.addEventListener("pointermove", event => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    if (!active) {
      if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < THRESHOLD_PX) return;
      active = begin(pending);
    }
    event.preventDefault();
    track(active, event.clientX, event.clientY);
  });
  window.addEventListener("pointerup", event => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    if (active) swallowNextClick();
    finish({ x: event.clientX, y: event.clientY });
  });
  window.addEventListener("pointercancel", () => finish(null));
  window.addEventListener("blur", () => finish(null));
  window.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape" && active) {
        event.preventDefault();
        finish(null);
      }
    },
    { capture: true }
  );
}
