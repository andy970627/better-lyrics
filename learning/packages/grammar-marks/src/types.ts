export type Lang = "ja" | "en";

/** The grammar role a token is marked with. Kept deliberately coarse so the marks stay readable mid-song. */
export type Category = "noun" | "pron" | "verb" | "adj" | "particle" | "aux" | "other";

export interface Token {
  /** Character offsets into the line text. */
  start: number;
  end: number;
  surface: string;
  base?: string;
  reading?: string;
  category: Category;
  /** Short part-of-speech label shown on the hover card, in Traditional Chinese. */
  pos: string;
  /** One-line grammar hint for function words and inflections. */
  note?: string;
  lang: Lang;
}

/** A multi-token grammar expression such as 〜ている or "would have done". */
export interface GrammarSpan {
  start: number;
  end: number;
  label: string;
  note: string;
}

export interface Analysis {
  lang: Lang | null;
  tokens: Token[];
  spans: GrammarSpan[];
}
