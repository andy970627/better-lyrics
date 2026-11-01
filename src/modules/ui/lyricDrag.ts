import { LINE_CLASS, LYRIC_MENU_ERROR_LOG, TAB_RENDERER_SELECTOR, TRANSLATED_LYRICS_CLASS } from "@constants";
import { t } from "@core/i18n";
import { logCore } from "@core/logger";
import {
  type LineContext,
  readLineContext,
  removeTranslation,
  saveText,
  selectedText,
  wordAt,
} from "@modules/ui/lyricActions";

const DRAG_THRESHOLD_PX = 6;
const ZONE_BOTTOM_GAP_PX = 24;
const DRAGGING_CLASS = "blyrics-lyric-dragging";
const ZONES_CLASS = "blyrics-drop-zones";
const ZONE_CLASS = "blyrics-drop-zone";
const ZONE_ACTIVE_CLASS = "blyrics-drop-zone--active";
const ZONE_DANGER_CLASS = "blyrics-drop-zone--danger";
const GHOST_CLASS = "blyrics-drag-ghost";
const VISIBLE_CLASS = "blyrics-drop-zones--visible";

interface DropTarget {
  label: string;
  danger?: boolean;
  onDrop: (x: number, y: number) => Promise<void>;
}

interface PendingDrag {
  pointerId: number;
  startX: number;
  startY: number;
  text: string;
  targets: DropTarget[];
}

interface ActiveDrag {
  zones: HTMLElement;
  zoneElements: { element: HTMLElement; target: DropTarget }[];
  ghost: HTMLElement | null;
  hovered: DropTarget | null;
}

let pending: PendingDrag | null = null;
let active: ActiveDrag | null = null;

// -- What a drag can do --------------------------

function wordTargets(text: string, line: LineContext): DropTarget[] {
  const targets: DropTarget[] = [{ label: t("vocab_drop_saveWord"), onDrop: (x, y) => saveText(text, line, x, y) }];
  if (text !== line.lineText) {
    targets.push({ label: t("vocab_drop_saveLine"), onDrop: (x, y) => saveText(line.lineText, line, x, y) });
  }
  return targets;
}

function translationTargets(line: LineContext): DropTarget[] {
  return [{ label: t("vocab_drop_removeTranslation"), danger: true, onDrop: (x, y) => removeTranslation(line, x, y) }];
}

function dragSource(target: Element, wrapper: HTMLElement): { text: string; targets: DropTarget[] } | null {
  const lineElement = target.closest<HTMLElement>(`.${LINE_CLASS}`);
  if (!lineElement || !wrapper.contains(lineElement)) return null;
  const line = readLineContext(lineElement);
  if (!line) return null;
  if (target.closest(`.${TRANSLATED_LYRICS_CLASS}`) && line.translation) {
    return { text: line.translation, targets: translationTargets(line) };
  }
  const word = wordAt(target);
  return word ? { text: word, targets: wordTargets(word, line) } : null;
}

// -- Drop zones --------------------------

function zoneAnchor(wrapper: HTMLElement): { x: number; bottom: number } {
  const host = wrapper.closest<HTMLElement>(TAB_RENDERER_SELECTOR) ?? wrapper;
  const rect = host.getBoundingClientRect();
  const left = Math.max(0, rect.left);
  const right = Math.min(window.innerWidth, rect.right);
  const bottom = Math.min(window.innerHeight, rect.bottom);
  return { x: (left + right) / 2, bottom: window.innerHeight - bottom + ZONE_BOTTOM_GAP_PX };
}

function showZones(wrapper: HTMLElement, targets: DropTarget[], ghostText: string | null): ActiveDrag {
  const zones = document.createElement("div");
  zones.className = ZONES_CLASS;
  const { x, bottom } = zoneAnchor(wrapper);
  zones.style.left = `${x}px`;
  zones.style.bottom = `${bottom}px`;

  const zoneElements = targets.map(target => {
    const element = document.createElement("div");
    element.className = target.danger ? `${ZONE_CLASS} ${ZONE_DANGER_CLASS}` : ZONE_CLASS;
    element.textContent = target.label;
    return { element, target };
  });
  zones.replaceChildren(...zoneElements.map(zone => zone.element));
  document.body.appendChild(zones);
  requestAnimationFrame(() => zones.classList.add(VISIBLE_CLASS));

  let ghost: HTMLElement | null = null;
  if (ghostText) {
    ghost = document.createElement("div");
    ghost.className = GHOST_CLASS;
    ghost.textContent = ghostText;
    document.body.appendChild(ghost);
  }
  document.documentElement.classList.add(DRAGGING_CLASS);
  return { zones, zoneElements, ghost, hovered: null };
}

function hoverAt(drag: ActiveDrag, x: number, y: number): void {
  drag.hovered = null;
  for (const { element, target } of drag.zoneElements) {
    const rect = element.getBoundingClientRect();
    const isOver = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    element.classList.toggle(ZONE_ACTIVE_CLASS, isOver);
    if (isOver) drag.hovered = target;
  }
  if (drag.ghost) drag.ghost.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
}

function finishDrag(drop: { x: number; y: number } | null): void {
  const drag = active;
  active = null;
  pending = null;
  if (!drag) return;
  drag.zones.remove();
  drag.ghost?.remove();
  document.documentElement.classList.remove(DRAGGING_CLASS);
  if (drop && drag.hovered) {
    drag.hovered.onDrop(drop.x, drop.y).catch(error => logCore(LYRIC_MENU_ERROR_LOG, error));
  }
}

// The click that ends a drag would otherwise seek to the line it was dropped near.
function swallowNextClick(): void {
  const swallow = (event: MouseEvent): void => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
}

// -- Wiring --------------------------

function attachPointerDrag(wrapper: HTMLElement): void {
  wrapper.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.pointerType === "touch" || active) return;
    if (!(event.target instanceof Element)) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.containsNode(event.target, true)) return;
    const source = dragSource(event.target, wrapper);
    if (!source) return;
    pending = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      text: source.text,
      targets: source.targets,
    };
  });

  window.addEventListener("pointermove", event => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    if (!active) {
      const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
      if (distance < DRAG_THRESHOLD_PX) return;
      window.getSelection()?.removeAllRanges();
      active = showZones(wrapper, pending.targets, pending.text);
    }
    event.preventDefault();
    hoverAt(active, event.clientX, event.clientY);
  });

  window.addEventListener("pointerup", event => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    if (active) swallowNextClick();
    finishDrag({ x: event.clientX, y: event.clientY });
  });

  window.addEventListener("pointercancel", () => finishDrag(null));
  window.addEventListener("blur", () => finishDrag(null));
  window.addEventListener(
    "keydown",
    event => {
      if (event.key !== "Escape" || !active) return;
      event.preventDefault();
      finishDrag(null);
    },
    { capture: true }
  );
}

/** Dragging selected text uses the browser's own drag, so the zones listen for a native drop. */
function attachSelectionDrag(wrapper: HTMLElement): void {
  wrapper.addEventListener("dragstart", event => {
    const text = selectedText(wrapper);
    const anchor = window.getSelection()?.anchorNode;
    const anchorElement = anchor instanceof Element ? anchor : anchor?.parentElement;
    const lineElement = anchorElement?.closest<HTMLElement>(`.${LINE_CLASS}`);
    const line = lineElement ? readLineContext(lineElement) : null;
    if (!text || !line) return;
    finishDrag(null);
    event.dataTransfer?.setData("text/plain", text);
    active = showZones(wrapper, wordTargets(text, line), null);
    const drag = active;
    for (const { element, target } of drag.zoneElements) {
      element.addEventListener("dragover", over => {
        over.preventDefault();
        drag.hovered = target;
        element.classList.add(ZONE_ACTIVE_CLASS);
      });
      element.addEventListener("dragleave", () => {
        if (drag.hovered === target) drag.hovered = null;
        element.classList.remove(ZONE_ACTIVE_CLASS);
      });
      element.addEventListener("drop", dropEvent => {
        dropEvent.preventDefault();
        drag.hovered = target;
        finishDrag({ x: dropEvent.clientX, y: dropEvent.clientY });
      });
    }
  });
  wrapper.addEventListener("dragend", () => {
    if (active) finishDrag(null);
  });
}

/**
 * Drag a word out of the lyrics and drop it on "Save word" (or "Save line"), or drag a wrong
 * translation onto "Remove translation". The zones only appear while something is being dragged.
 */
export function attachLyricDrag(wrapper: HTMLElement): void {
  attachPointerDrag(wrapper);
  attachSelectionDrag(wrapper);
}
