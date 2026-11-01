import { t } from "@core/i18n";
import { errorCore } from "@core/logger";
import {
  clearHiddenTranslations,
  clearSavedWords,
  countHiddenTranslations,
  getSavedWords,
  HIDDEN_TRANSLATIONS_KEY,
  removeSavedWord,
  restoreSavedWords,
  SAVED_WORDS_KEY,
  type SavedWord,
  savedWordsToCsv,
} from "@core/vocabulary";
import { createModal } from "@/ui/modal";
import { toast } from "@/ui/toast";

const DELETE_ICON_PATH =
  "M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z";

function deleteIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", DELETE_ICON_PATH);
  svg.appendChild(path);
  return svg;
}

function textSpan(className: string, text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function renderWord(word: SavedWord, onDelete: (id: string) => void): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "saved-word";

  const body = document.createElement("div");
  body.className = "saved-word__body";
  body.appendChild(textSpan("saved-word__text", word.text));
  if (word.line && word.line !== word.text) body.appendChild(textSpan("saved-word__line", word.line));
  if (word.romanization) body.appendChild(textSpan("saved-word__line", word.romanization));
  if (word.translation) body.appendChild(textSpan("saved-word__translation", word.translation));
  const source = [word.song, word.artist].filter(Boolean).join(" · ");
  if (source) body.appendChild(textSpan("saved-word__source", source));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "ui-button ui-button--compact ui-button--ghost ui-button--icon saved-word__delete";
  remove.setAttribute("aria-label", t("vocab_options_deleteWord", word.text));
  remove.appendChild(deleteIcon());
  remove.addEventListener("click", () => onDelete(word.id));

  item.append(body, remove);
  return item;
}

export function initSavedWords(): void {
  const overlay = document.getElementById("saved-words-modal-overlay");
  const openBtn = document.getElementById("saved-words-btn");
  const countBadge = document.getElementById("saved-words-count");
  const list = document.getElementById("saved-words-list");
  const empty = document.getElementById("saved-words-empty");
  const copyBtn = document.getElementById("saved-words-copy-btn") as HTMLButtonElement | null;
  const clearBtn = document.getElementById("saved-words-clear-btn") as HTMLButtonElement | null;
  const hiddenRow = document.getElementById("hidden-translations-row");
  const hiddenCount = document.getElementById("hidden-translations-count");
  const restoreBtn = document.getElementById("hidden-translations-restore-btn");
  if (!overlay || !openBtn || !countBadge || !list || !empty || !copyBtn || !clearBtn) return;

  const modal = createModal(overlay);
  let words: SavedWord[] = [];

  const render = (): void => {
    countBadge.textContent = String(words.length);
    empty.hidden = words.length > 0;
    list.hidden = words.length === 0;
    copyBtn.disabled = words.length === 0;
    clearBtn.disabled = words.length === 0;
    list.replaceChildren(
      ...words.map(word =>
        renderWord(word, id => {
          removeSavedWord(id).catch(error => {
            errorCore("Failed to delete saved word:", error);
            toast.error(t("vocab_notice_failed"));
          });
        })
      )
    );
  };

  const refreshWords = async (): Promise<void> => {
    words = await getSavedWords();
    render();
  };

  const refreshHidden = async (): Promise<void> => {
    if (!hiddenRow || !hiddenCount) return;
    const count = await countHiddenTranslations();
    hiddenRow.hidden = count === 0;
    hiddenCount.textContent = t("vocab_options_hiddenTranslationsCount", String(count));
  };

  openBtn.addEventListener("click", () => modal.open());

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(savedWordsToCsv(words));
      toast.success(t("vocab_options_copied"));
    } catch (error) {
      errorCore("Failed to copy saved words:", error);
      toast.error(t("vocab_notice_failed"));
    }
  });

  clearBtn.addEventListener("click", async () => {
    const backup = words;
    try {
      await clearSavedWords();
      toast.success(t("vocab_options_cleared"), {
        action: {
          label: t("vocab_options_undo"),
          onClick: () => {
            restoreSavedWords(backup).catch(error => errorCore("Failed to restore saved words:", error));
          },
        },
      });
    } catch (error) {
      errorCore("Failed to clear saved words:", error);
      toast.error(t("vocab_notice_failed"));
    }
  });

  restoreBtn?.addEventListener("click", async () => {
    await clearHiddenTranslations().catch(error => errorCore("Failed to restore translations:", error));
    toast.success(t("vocab_notice_translationsRestored"));
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (SAVED_WORDS_KEY in changes) void refreshWords();
    if (HIDDEN_TRANSLATIONS_KEY in changes) void refreshHidden();
  });

  void refreshWords();
  void refreshHidden();
}
