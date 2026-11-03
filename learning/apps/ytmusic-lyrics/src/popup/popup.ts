import { toAnkiTsv } from "@learning/anki-bridge";
import { APP_TAG, toLearningCard } from "../cards";
import {
  clearHidden,
  countHidden,
  getHidden,
  getSettings,
  getWords,
  HIDDEN_KEY,
  removeWord,
  restoreWords,
  SETTINGS_KEY,
  songUrl,
  updateSettings,
  WORDS_KEY,
} from "../storage";
import type { SavedWord, Settings } from "../types";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

// -- Tabs --------------------------

for (const tab of document.querySelectorAll<HTMLButtonElement>("[data-tab]")) {
  tab.addEventListener("click", () => {
    for (const other of document.querySelectorAll<HTMLButtonElement>("[data-tab]")) {
      other.setAttribute("aria-selected", String(other === tab));
    }
    for (const panel of document.querySelectorAll<HTMLElement>("[data-panel]")) {
      panel.hidden = panel.dataset.panel !== tab.dataset.tab;
    }
  });
}

// -- Words --------------------------

let words: SavedWord[] = [];

function el(tag: string, className: string, text?: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

function renderItem(word: SavedWord): HTMLLIElement {
  const item = el("li", "item") as HTMLLIElement;
  const body = el("div", "item__body");
  const head = el("div", "item__word", word.text);
  if (word.reading) head.appendChild(el("span", "item__reading", word.reading));
  body.appendChild(head);
  if (word.meaning) body.appendChild(el("div", "item__meaning", word.meaning));
  if (word.line && word.line !== word.text) body.appendChild(el("div", "item__line", word.line));
  if (word.translation) body.appendChild(el("div", "item__line", word.translation));
  const source = el("div", "item__source");
  const url = songUrl(word);
  const title = [word.song, word.artist].filter(Boolean).join(" — ") || "YouTube Music";
  if (url) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `▶ ${title}`;
    source.appendChild(link);
  } else {
    source.textContent = title;
  }
  if (word.ankiNoteId !== undefined) source.appendChild(el("span", "item__synced", " · 已在 Anki"));
  body.appendChild(source);

  const remove = el("button", "item__delete", "✕") as HTMLButtonElement;
  remove.type = "button";
  remove.title = `刪除「${word.text}」`;
  remove.addEventListener("click", () => void removeWord(word.id));
  item.append(body, remove);
  return item;
}

function render(): void {
  const query = ($<HTMLInputElement>("search").value || "").trim().toLowerCase();
  const shown = query
    ? words.filter(word =>
        [word.text, word.base, word.reading, word.meaning, word.line, word.song, word.artist]
          .filter(Boolean)
          .some(value => value!.toLowerCase().includes(query))
      )
    : words;
  $("word-count").textContent = String(words.length);
  $("empty").hidden = words.length > 0;
  $("list").replaceChildren(...shown.map(renderItem));
  const pending = words.filter(word => word.ankiNoteId === undefined).length;
  $("pending-count").textContent = String(pending);
  $<HTMLButtonElement>("sync-btn").disabled = pending === 0;
  $<HTMLButtonElement>("tsv-btn").disabled = words.length === 0;
  $<HTMLButtonElement>("clear-btn").hidden = words.length === 0;
}

async function loadWords(): Promise<void> {
  words = await getWords();
  render();
}

$("search").addEventListener("input", render);

$("sync-btn").addEventListener("click", async () => {
  const status = $("anki-status");
  const button = $<HTMLButtonElement>("sync-btn");
  button.disabled = true;
  status.textContent = "正在連線到 Anki…";
  const outcome = await chrome.runtime.sendMessage({ type: "anki-sync" });
  if (outcome?.kind === "synced")
    status.textContent = `已送出 ${outcome.added} 個${outcome.skipped ? `（${outcome.skipped} 個已經在牌組裡）` : ""}`;
  else if (outcome?.kind === "unreachable")
    status.textContent = "連不到 Anki：請開著 Anki 並安裝 AnkiConnect（見設定）";
  else if (outcome?.kind === "denied") status.textContent = "Anki 拒絕了連線，請在 Anki 的提示視窗按允許";
  else status.textContent = `同步失敗：${outcome?.message ?? "未知錯誤"}`;
  await loadWords();
});

$("tsv-btn").addEventListener("click", async () => {
  const { ankiDeck } = await getSettings();
  const tsv = toAnkiTsv(words.map(toLearningCard), ankiDeck, [APP_TAG]);
  const url = URL.createObjectURL(new Blob([tsv], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "lyric-study-anki.txt";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

let clearArmed: ReturnType<typeof setTimeout> | undefined;
$("clear-btn").addEventListener("click", async () => {
  const button = $<HTMLButtonElement>("clear-btn");
  if (!clearArmed) {
    button.textContent = "再按一次確認清除";
    clearArmed = setTimeout(() => {
      clearArmed = undefined;
      button.textContent = "全部清除";
    }, 3000);
    return;
  }
  clearTimeout(clearArmed);
  clearArmed = undefined;
  button.textContent = "全部清除";
  await restoreWords([]);
});

// -- Settings --------------------------

async function loadSettings(): Promise<void> {
  const settings = await getSettings();
  for (const input of document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting]")) {
    const key = input.dataset.setting as keyof Settings;
    if (input instanceof HTMLInputElement && input.type === "checkbox") input.checked = Boolean(settings[key]);
    else input.value = String(settings[key]);
  }
}

for (const input of document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-setting]")) {
  input.addEventListener("change", () => {
    const key = input.dataset.setting as keyof Settings;
    const value = input instanceof HTMLInputElement && input.type === "checkbox" ? input.checked : input.value.trim();
    if (key === "ankiDeck" && !value) return;
    void updateSettings({ [key]: value } as Partial<Settings>);
  });
}

async function loadHiddenCount(): Promise<void> {
  const count = countHidden(await getHidden());
  $("hidden-count").textContent = `${count} 句`;
  $<HTMLButtonElement>("restore-btn").disabled = count === 0;
}

$("restore-btn").addEventListener("click", () => void clearHidden());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (WORDS_KEY in changes) void loadWords();
  if (HIDDEN_KEY in changes) void loadHiddenCount();
  if (SETTINGS_KEY in changes) void loadSettings();
});

void loadWords();
void loadSettings();
void loadHiddenCount();
