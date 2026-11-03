import nlp from "compromise";
import type { Analysis, Category, GrammarSpan, Token } from "./types";
import { EN_MODAL_NOTES, EN_PATTERNS, EN_WORD_NOTES, findPatterns, matchEn } from "./grammar";

interface Term {
  text: string;
  normal: string;
  implicit?: string;
  root?: string;
  tags: string[];
  offset: { start: number; length: number };
}

const LATIN_WORD = /[a-z]/i;

export function looksEnglish(text: string): boolean {
  return LATIN_WORD.test(text);
}

function classify(tags: string[]): { category: Category; pos: string } {
  const has = (tag: string) => tags.includes(tag);
  if (has("Pronoun")) return { category: "pron", pos: "代名詞" };
  if (has("Modal")) return { category: "aux", pos: "情態助動詞" };
  if (has("Copula")) return { category: "aux", pos: "be 動詞" };
  if (has("Auxiliary")) return { category: "aux", pos: "助動詞" };
  if (has("Particle")) return { category: "particle", pos: "介副詞" };
  if (has("Negative")) return { category: "aux", pos: "否定" };
  if (has("Verb")) return { category: "verb", pos: "動詞" };
  if (has("Adjective")) return { category: "adj", pos: "形容詞" };
  if (has("Adverb")) return { category: "adj", pos: "副詞" };
  if (has("Preposition")) return { category: "particle", pos: "介系詞" };
  if (has("Conjunction")) return { category: "particle", pos: "連接詞" };
  if (has("Determiner")) return { category: "other", pos: "限定詞" };
  if (has("Noun")) return { category: "noun", pos: "名詞" };
  return { category: "other", pos: "其他" };
}

function noteFor(word: string, tags: string[]): string | undefined {
  if (EN_WORD_NOTES[word]) return EN_WORD_NOTES[word];
  if (tags.includes("Modal")) return EN_MODAL_NOTES[word];
  if (tags.includes("Negative")) return "否定";
  if (tags.includes("Gerund")) return "-ing：進行式・動名詞";
  if (tags.includes("Participle")) return "過去分詞";
  if (tags.includes("PastTense")) return "過去式";
  return undefined;
}

export function analyzeEnglish(text: string): Analysis {
  const doc = nlp(text);
  doc.compute("root");
  const terms: Term[] = doc.json({ offset: true, terms: { offset: true } }).flatMap((s: { terms: Term[] }) => s.terms);

  const tokens: Token[] = [];
  const view: { word: string; tags: string[] }[] = [];
  const viewToToken: number[] = [];
  for (const term of terms) {
    const word = (term.implicit ?? term.normal ?? term.text).toLowerCase();
    view.push({ word, tags: term.tags });
    if (term.offset.length === 0) {
      // A contraction's hidden half ("I've" → "have"): note it on the visible token.
      const previous = tokens.at(-1);
      if (previous?.surface.includes("'")) previous.note = `縮寫：= ${previous.surface.replace(/'.*$/, "")} ${word}`;
      viewToToken.push(tokens.length - 1);
      continue;
    }
    const { category, pos } = classify(term.tags);
    const surface = text.slice(term.offset.start, term.offset.start + term.offset.length);
    const base = term.root && term.root !== word ? term.root : undefined;
    tokens.push({
      start: term.offset.start,
      end: term.offset.start + term.offset.length,
      surface,
      base,
      category,
      pos,
      note: noteFor(EN_WORD_NOTES[term.normal] ? term.normal : word, term.tags),
      lang: "en",
    });
    viewToToken.push(tokens.length - 1);
  }

  const spans: GrammarSpan[] = [];
  for (const hit of findPatterns(view, EN_PATTERNS, matchEn)) {
    const first = tokens[viewToToken[hit.from]];
    const last = tokens[viewToToken[hit.to]];
    if (first && last && last.end > first.start) {
      spans.push({ start: first.start, end: last.end, label: hit.label, note: hit.note });
    }
  }
  // Phrasal verbs: a verb followed by its particle ("show up", "give up").
  for (let i = 0; i < terms.length - 1; i++) {
    const verb = terms[i];
    const particle = terms[i + 1];
    if (verb.tags.includes("PhrasalVerb") && particle.tags.includes("Particle") && verb.offset.length > 0) {
      const start = verb.offset.start;
      const end = particle.offset.start + particle.offset.length;
      if (!spans.some(span => span.start < end && start < span.end)) {
        const phrase = `${(verb.root ?? verb.normal).toLowerCase()} ${particle.normal}`;
        spans.push({ start, end, label: `片語動詞 ${phrase}`, note: "動詞＋介副詞，整組有自己的意思" });
      }
    }
  }
  spans.sort((a, b) => a.start - b.start);
  return { lang: "en", tokens, spans };
}
