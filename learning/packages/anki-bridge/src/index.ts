import { YankiConnect } from "yanki-connect";

/**
 * One thing worth reviewing, from any learning app: a word or phrase plus the context it was met in.
 * Apps map their own records onto this, so every project feeds the same Anki note type.
 */
export interface LearningCard {
  /** The app's own id for the item, kept on the note so a re-sync can skip it. */
  id: string;
  text: string;
  reading?: string;
  meaning?: string;
  /** Part of speech and grammar hints, already short. */
  grammar?: string;
  /** The sentence or lyric line it came from. */
  context?: string;
  contextTranslation?: string;
  /** Where it came from: a song, a video, an article. */
  sourceTitle?: string;
  sourceUrl?: string;
  tags?: string[];
}

export const NOTE_TYPE = "Learning Card";
const FIELDS = [
  "Text",
  "Reading",
  "Meaning",
  "Grammar",
  "Context",
  "ContextTranslation",
  "Source",
  "SourceUrl",
  "ItemId",
];

const FRONT = `<div class="text">{{Text}}</div>
{{#Context}}<div class="context">{{Context}}</div>{{/Context}}`;

const BACK = `{{FrontSide}}
<hr id="answer">
{{#Reading}}<div class="reading">{{Reading}}</div>{{/Reading}}
{{#Meaning}}<div class="meaning">{{Meaning}}</div>{{/Meaning}}
{{#Grammar}}<div class="grammar">{{Grammar}}</div>{{/Grammar}}
{{#ContextTranslation}}<div class="translation">{{ContextTranslation}}</div>{{/ContextTranslation}}
{{#Source}}<div class="source">{{#SourceUrl}}<a href="{{SourceUrl}}">▶ {{Source}}</a>{{/SourceUrl}}{{^SourceUrl}}{{Source}}{{/SourceUrl}}</div>{{/Source}}`;

const CSS = `.card { font-family: system-ui, sans-serif; font-size: 20px; text-align: center; color: #222; background: #fff; }
.nightMode.card { color: #eee; background: #2b2b2b; }
.text { font-size: 34px; font-weight: 600; }
.context { margin-top: 12px; font-size: 18px; opacity: .8; }
.context b { color: #d9822b; }
.reading { font-size: 22px; }
.meaning { margin-top: 6px; font-size: 22px; font-weight: 600; }
.grammar { margin-top: 8px; font-size: 15px; opacity: .75; }
.translation { margin-top: 10px; font-size: 16px; opacity: .8; }
.source { margin-top: 14px; font-size: 14px; }
.source a { color: inherit; }`;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
}

/** The context with the item bolded, so the card shows which word in the line it is about. */
function contextHtml(card: LearningCard): string {
  if (!card.context) return "";
  const context = escapeHtml(card.context);
  const text = escapeHtml(card.text);
  const at = context.indexOf(text);
  return at < 0 ? context : `${context.slice(0, at)}<b>${text}</b>${context.slice(at + text.length)}`;
}

export function noteFields(card: LearningCard): Record<string, string> {
  return {
    Text: escapeHtml(card.text),
    Reading: escapeHtml(card.reading ?? ""),
    Meaning: escapeHtml(card.meaning ?? ""),
    Grammar: escapeHtml(card.grammar ?? ""),
    Context: contextHtml(card),
    ContextTranslation: escapeHtml(card.contextTranslation ?? ""),
    Source: escapeHtml(card.sourceTitle ?? ""),
    SourceUrl: card.sourceUrl ? escapeHtml(card.sourceUrl) : "",
    ItemId: escapeHtml(card.id),
  };
}

// -- AnkiConnect --------------------------

export type SyncOutcome =
  | { kind: "synced"; added: Map<string, number>; skipped: number }
  | { kind: "unreachable" }
  | { kind: "denied" }
  | { kind: "failed"; message: string };

export interface SyncOptions {
  deck: string;
  /** Extra tags on every note, such as the app's name. */
  tags?: string[];
}

/**
 * Adds each card as a note in `deck`, creating the deck and the shared note type the first time.
 * Cards already in that deck are skipped, not duplicated. AnkiConnect must be running (it ships as
 * an Anki add-on); the first call from a new origin asks the user to allow it inside Anki.
 */
export async function syncToAnki(cards: readonly LearningCard[], options: SyncOptions): Promise<SyncOutcome> {
  const client = new YankiConnect({ autoLaunch: false });
  try {
    const permission = await client.miscellaneous.requestPermission();
    if (permission.permission !== "granted") return { kind: "denied" };

    if (!(await client.model.modelNames()).includes(NOTE_TYPE)) {
      await client.model.createModel({
        modelName: NOTE_TYPE,
        inOrderFields: FIELDS,
        css: CSS,
        cardTemplates: [{ Name: "Recognize", Front: FRONT, Back: BACK }],
      });
    }
    if (!(await client.deck.deckNames()).includes(options.deck)) {
      await client.deck.createDeck({ deck: options.deck });
    }

    const added = new Map<string, number>();
    let skipped = 0;
    for (const card of cards) {
      try {
        const noteId = await client.note.addNote({
          note: {
            deckName: options.deck,
            modelName: NOTE_TYPE,
            fields: noteFields(card),
            tags: [...(options.tags ?? []), ...(card.tags ?? [])],
            options: { allowDuplicate: false, duplicateScope: "deck" },
          },
        });
        if (noteId) added.set(card.id, noteId);
      } catch (error) {
        if (!String(error).includes("duplicate")) throw error;
        added.set(card.id, 0);
        skipped++;
      }
    }
    return { kind: "synced", added, skipped };
  } catch (error) {
    if (error instanceof TypeError) return { kind: "unreachable" };
    return { kind: "failed", message: error instanceof Error ? error.message : String(error) };
  }
}

// -- File import --------------------------

const TSV_CELL = (value: string): string => value.replace(/[\t\r\n]+/g, " ");

/**
 * A tab-separated file for Anki's File → Import when AnkiConnect isn't installed. It targets the
 * built-in "Basic" note type, so it imports into any Anki profile without setup.
 */
export function toAnkiTsv(cards: readonly LearningCard[], deck: string, tags: string[] = []): string {
  const header = ["#separator:tab", "#html:true", "#notetype:Basic", `#deck:${deck}`];
  if (tags.length) header.push(`#tags:${tags.join(" ")}`);
  const rows = cards.map(card => {
    const fields = noteFields(card);
    const front = [fields.Text, fields.Context && `<div style="font-size:.7em;opacity:.8">${fields.Context}</div>`]
      .filter(Boolean)
      .join("<br>");
    const source =
      fields.Source && (fields.SourceUrl ? `<a href="${fields.SourceUrl}">▶ ${fields.Source}</a>` : fields.Source);
    const back = [
      fields.Reading,
      fields.Meaning && `<b>${fields.Meaning}</b>`,
      fields.Grammar,
      fields.ContextTranslation,
      source,
    ]
      .filter(Boolean)
      .join("<br>");
    return `${TSV_CELL(front)}\t${TSV_CELL(back)}`;
  });
  return [...header, ...rows].join("\n");
}
