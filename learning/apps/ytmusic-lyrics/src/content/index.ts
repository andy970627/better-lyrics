import { getSettings, SETTINGS_KEY } from "../storage";
import type { Settings } from "../types";
import { attachCard, hide } from "./card";
import { lyricsWrapper } from "./dom";
import { attachDrag } from "./drag";
import { applyHidden, loadHidden } from "./hidden";
import { clearMarks, refreshMarks } from "./marks";
import { attachMenu } from "./menu";

const REFRESH_DEBOUNCE_MS = 150;
const WRAPPER_POLL_MS = 1000;

let settings: Settings;
let observed: HTMLElement | null = null;
let observer: MutationObserver | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

function scheduleRefresh(): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const wrapper = lyricsWrapper();
    if (!wrapper) return;
    applyHidden(wrapper);
    void refreshMarks(wrapper, settings);
  }, REFRESH_DEBOUNCE_MS);
}

// Better Lyrics creates its wrapper once the lyrics tab first opens and reuses it afterwards.
function watchWrapper(): void {
  const wrapper = lyricsWrapper();
  if (wrapper === observed) return;
  observer?.disconnect();
  observed = wrapper;
  hide();
  clearMarks();
  if (!wrapper) return;
  observer = new MutationObserver(scheduleRefresh);
  observer.observe(wrapper, { childList: true, subtree: true });
  scheduleRefresh();
}

async function start(): Promise<void> {
  settings = await getSettings();
  await loadHidden(scheduleRefresh);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(SETTINGS_KEY in changes)) return;
    void getSettings().then(next => {
      settings = next;
      scheduleRefresh();
    });
  });
  attachCard();
  attachDrag();
  attachMenu();
  watchWrapper();
  setInterval(watchWrapper, WRAPPER_POLL_MS);
}

void start();
