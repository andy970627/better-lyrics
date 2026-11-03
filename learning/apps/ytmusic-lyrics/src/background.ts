import { syncToAnki } from "@learning/anki-bridge";
import { APP_TAG, toLearningCard } from "./cards";
import { getSettings, getWords, markSynced } from "./storage";

// AnkiConnect runs on localhost; talking to it from here avoids the page's CORS rules and lets the
// popup and the lyrics page share one sync.

let running: Promise<unknown> | null = null;

async function syncPending(): Promise<unknown> {
  const [settings, words] = await Promise.all([getSettings(), getWords()]);
  const pending = words.filter(word => word.ankiNoteId === undefined);
  if (pending.length === 0) return { kind: "synced", added: 0, skipped: 0 };
  const outcome = await syncToAnki(pending.map(toLearningCard), { deck: settings.ankiDeck, tags: [APP_TAG] });
  if (outcome.kind !== "synced") return outcome;
  await markSynced(outcome.added);
  return { kind: "synced", added: outcome.added.size - outcome.skipped, skipped: outcome.skipped };
}

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type !== "anki-sync") return;
  running ??= syncPending()
    .catch(error => ({ kind: "failed", message: String(error) }))
    .finally(() => {
      running = null;
    });
  running.then(reply);
  return true;
});
