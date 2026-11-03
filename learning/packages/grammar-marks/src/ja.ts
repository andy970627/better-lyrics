import kuromoji from "kuromoji";
import type { Analysis, Category, GrammarSpan, Token } from "./types";
import { findPatterns, JA_AUX_NOTES, JA_FORM_NOTES, JA_PARTICLE_NOTES, JA_PATTERNS, matchJa } from "./grammar";

type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;

const KANA_OR_KANJI = /[぀-ヿ㐀-鿿ｦ-ﾟ]/;
const KANJI = /[㐀-鿿]/;

export function looksJapanese(text: string): boolean {
  return KANA_OR_KANJI.test(text);
}

function toHiragana(katakana: string): string {
  return katakana.replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function classify(t: kuromoji.IpadicFeatures): { category: Category; pos: string } {
  const detail = t.pos_detail_1;
  switch (t.pos) {
    case "名詞":
      if (detail === "代名詞") return { category: "pron", pos: "代名詞" };
      if (detail === "形容動詞語幹") return { category: "adj", pos: "形容動詞" };
      if (detail === "非自立" || detail === "接尾") return { category: "aux", pos: "名詞（形式）" };
      return { category: "noun", pos: "名詞" };
    case "動詞":
      if (detail === "非自立") return { category: "aux", pos: "補助動詞" };
      if (detail === "接尾") return { category: "aux", pos: "動詞語尾" };
      return { category: "verb", pos: "動詞" };
    case "形容詞":
      return detail === "非自立" ? { category: "aux", pos: "補助形容詞" } : { category: "adj", pos: "形容詞" };
    case "副詞":
      return { category: "adj", pos: "副詞" };
    case "連体詞":
      return { category: "adj", pos: "連體詞" };
    case "助詞":
      return { category: "particle", pos: detail && detail !== "*" ? `助詞・${detail}` : "助詞" };
    case "助動詞":
      return { category: "aux", pos: "助動詞" };
    case "接続詞":
      return { category: "particle", pos: "接續詞" };
    case "感動詞":
      return { category: "other", pos: "感嘆詞" };
    default:
      return { category: "other", pos: t.pos };
  }
}

function noteFor(t: kuromoji.IpadicFeatures, category: Category): string | undefined {
  if (t.pos === "助詞") {
    const isTeForm = t.pos_detail_1 === "接続助詞" && (t.surface_form === "て" || t.surface_form === "で");
    return JA_PARTICLE_NOTES[isTeForm ? "て" : t.surface_form];
  }
  if (t.pos === "助動詞") return JA_AUX_NOTES[t.basic_form] ?? JA_AUX_NOTES[t.surface_form];
  if (t.pos === "動詞" && t.pos_detail_1 === "接尾") return JA_AUX_NOTES[t.basic_form];
  if ((category === "verb" || category === "adj") && t.conjugated_form !== "基本形") {
    return JA_FORM_NOTES[t.conjugated_form];
  }
  return undefined;
}

/**
 * Creates a Japanese analyzer. The ~18 MB dictionary is loaded once, on the first call, from
 * `dicPath`: a folder path in Node, or a URL ending in "/" in a browser or extension.
 */
export function createJapaneseAnalyzer(dicPath: string): (text: string) => Promise<Analysis> {
  let tokenizer: Promise<Tokenizer> | null = null;
  const load = (): Promise<Tokenizer> => {
    tokenizer ??= new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath }).build((error, built) => {
        if (error) {
          tokenizer = null;
          reject(error);
        } else {
          resolve(built);
        }
      });
    });
    return tokenizer;
  };
  return async text => analyzeTokens((await load()).tokenize(text));
}

function analyzeTokens(raw: kuromoji.IpadicFeatures[]): Analysis {
  const tokens: Token[] = [];
  const kept: kuromoji.IpadicFeatures[] = [];
  for (const t of raw) {
    if (t.pos === "記号" || !t.surface_form.trim()) continue;
    const start = t.word_position - 1;
    const { category, pos } = classify(t);
    const base = t.basic_form && t.basic_form !== "*" ? t.basic_form : t.surface_form;
    const reading = t.reading && t.reading !== "*" && KANJI.test(t.surface_form) ? toHiragana(t.reading) : undefined;
    tokens.push({
      start,
      end: start + t.surface_form.length,
      surface: t.surface_form,
      base: base !== t.surface_form ? base : undefined,
      reading,
      category,
      pos,
      note: noteFor(t, category),
      lang: "ja",
    });
    kept.push(t);
  }

  const view = kept.map(t => ({ surface: t.surface_form, base: t.basic_form, pos: t.pos }));
  const spans: GrammarSpan[] = findPatterns(view, JA_PATTERNS, matchJa).map(hit => ({
    // A て-form pattern reads as one expression with the verb before it: 呼んでいる, not でいる.
    start: tokens[hit.label.startsWith("〜て") && hit.from > 0 ? hit.from - 1 : hit.from].start,
    end: tokens[hit.to].end,
    label: hit.label,
    note: hit.note,
  }));
  return { lang: "ja", tokens, spans };
}
