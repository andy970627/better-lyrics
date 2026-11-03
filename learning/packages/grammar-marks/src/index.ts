export type { Analysis, Category, GrammarSpan, Lang, Token } from "./types";
export { createJapaneseAnalyzer, looksJapanese } from "./ja";
export { analyzeEnglish, looksEnglish } from "./en";

/** Traditional Chinese names for the mark categories, for legends and cards. */
export const CATEGORY_LABELS = {
  noun: "名詞",
  pron: "代名詞",
  verb: "動詞",
  adj: "形容詞・副詞",
  particle: "助詞・介系詞",
  aux: "助動詞・時態",
  other: "其他",
} as const;
