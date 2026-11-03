// Short grammar hints shown on the hover card. They are meant to be glanced at mid-song, so each
// one is a few words, not an explanation.

// -- Japanese --------------------------

export const JA_PARTICLE_NOTES: Record<string, string> = {
  は: "主題「至於…」",
  が: "主語・焦點",
  を: "受詞（動作的對象）",
  に: "對象・時間・目的地",
  へ: "方向「往…」",
  で: "地點・手段",
  と: "和…・引用「…說」",
  の: "「的」・名詞化",
  も: "也",
  かも: "也許（後接しれない）",
  から: "從…・因為",
  まで: "到…為止",
  より: "比…",
  や: "和（列舉）",
  か: "疑問・或",
  よ: "告知、提醒的語氣",
  ね: "確認、感嘆「…呢」",
  な: "感嘆・禁止",
  さ: "輕鬆的語氣",
  ぞ: "強調（男性語氣）",
  ぜ: "強調（男性語氣）",
  わ: "感嘆（女性語氣）",
  って: "「…說」・所謂（口語）",
  だけ: "只",
  しか: "只（後接否定）",
  ばかり: "淨是・剛剛",
  ても: "即使…也",
  でも: "即使…也・…之類",
  けど: "雖然・但是",
  けれど: "雖然・但是",
  けれども: "雖然・但是",
  のに: "明明…卻",
  ながら: "一邊…一邊",
  ば: "如果…的話",
  て: "連接動作「…然後」",
  し: "列舉理由「又…又」",
  たり: "列舉動作「…啦…啦」",
  ので: "因為（客觀）",
  かな: "自問「…吧？」",
  ほど: "程度・越…越",
  など: "等等",
  くらい: "大約・程度",
  ぐらい: "大約・程度",
  こそ: "正是",
  さえ: "連…都",
  ずつ: "各…",
  かしら: "自問「…吧？」（女性語氣）",
};

export const JA_AUX_NOTES: Record<string, string> = {
  だ: "斷定「是」",
  です: "禮貌的「是」",
  ます: "禮貌語尾",
  ない: "否定「不…」",
  ぬ: "否定（文言）",
  ん: "否定（口語）",
  ず: "否定「不…而」（文言）",
  た: "過去・完成",
  だ過去: "過去・完成",
  たい: "想要…",
  う: "意志「…吧」・推測",
  まい: "不打算・大概不",
  らしい: "好像・似乎",
  れる: "被動・可能・尊敬",
  られる: "被動・可能・尊敬",
  せる: "使役「讓…」",
  させる: "使役「讓…」",
};

/** What a conjugated form is for, in a few words. */
export const JA_FORM_NOTES: Record<string, string> = {
  連用タ接続: "て・た形",
  連用形: "連用形（接ます、て等）",
  未然形: "未然形（接ない等）",
  未然ウ接続: "意向形（接う）",
  仮定形: "假定形（接ば）",
  仮定縮約１: "假定形（口語）",
  命令ｅ: "命令形",
  命令ｒｏ: "命令形",
  命令ｙｏ: "命令形",
  体言接続: "連體形",
};

interface JaMatcher {
  surface?: string[];
  base?: string[];
  pos?: string;
}

interface Pattern<M> {
  seq: M[];
  label: string;
  note: string;
}

const TE: JaMatcher = { surface: ["て", "で"], pos: "助詞" };

export const JA_PATTERNS: Pattern<JaMatcher>[] = [
  { seq: [TE, { base: ["いる"] }], label: "〜ている", note: "正在…・持續的狀態" },
  { seq: [TE, { base: ["る"] }], label: "〜てる", note: "ている的口語：正在…" },
  { seq: [TE, { base: ["しまう"] }], label: "〜てしまう", note: "…完了・不小心…（遺憾）" },
  { seq: [TE, { base: ["ください"] }], label: "〜てください", note: "請…" },
  { seq: [TE, { base: ["ほしい"] }], label: "〜てほしい", note: "希望對方…" },
  { seq: [TE, { base: ["くれる"] }], label: "〜てくれる", note: "（別人）為我…" },
  { seq: [TE, { base: ["あげる"] }], label: "〜てあげる", note: "為別人…" },
  { seq: [TE, { base: ["もらう"] }], label: "〜てもらう", note: "請別人為我…" },
  { seq: [TE, { base: ["おく"] }], label: "〜ておく", note: "事先…" },
  { seq: [TE, { base: ["みる"] }], label: "〜てみる", note: "試著…" },
  { seq: [TE, { base: ["いく", "行く"] }], label: "〜ていく", note: "…下去・漸漸…" },
  { seq: [TE, { base: ["くる", "来る"] }], label: "〜てくる", note: "…起來・…過來" },
  { seq: [TE, { surface: ["も"] }], label: "〜ても", note: "即使…也" },
  {
    seq: [{ surface: ["かも"] }, { base: ["しれる"] }, { base: ["ない", "ん"] }],
    label: "〜かもしれない",
    note: "也許…",
  },
  {
    seq: [{ surface: ["なけれ"] }, { surface: ["ば"] }, { base: ["なる"] }, { base: ["ない", "ん"] }],
    label: "〜なければならない",
    note: "必須…",
  },
  { seq: [{ surface: ["だろ"] }, { surface: ["う"] }], label: "〜だろう", note: "…吧（推測）" },
  { seq: [{ surface: ["でしょ"] }, { surface: ["う"] }], label: "〜でしょう", note: "…吧（推測，禮貌）" },
  { seq: [{ base: ["よう"] }, { surface: ["に"] }], label: "〜ように", note: "為了…・像…一樣" },
  { seq: [{ base: ["よう"] }, { base: ["だ"] }], label: "〜ようだ", note: "好像…" },
  { seq: [{ base: ["そう"] }, { base: ["だ", "です"] }], label: "〜そうだ", note: "看起來…・聽說…" },
  { seq: [{ surface: ["の"] }, { base: ["だ", "です"] }], label: "〜のだ", note: "說明・強調理由" },
  { seq: [{ surface: ["ん"], pos: "名詞" }, { base: ["だ", "です"] }], label: "〜んだ", note: "說明・強調（口語）" },
];

export function matchJa(m: JaMatcher, token: { surface: string; base: string; pos: string }): boolean {
  if (m.surface && !m.surface.includes(token.surface)) return false;
  if (m.base && !m.base.includes(token.base)) return false;
  if (m.pos && token.pos !== m.pos) return false;
  return true;
}

// -- English --------------------------

export const EN_MODAL_NOTES: Record<string, string> = {
  can: "能夠・可以",
  could: "能夠（過去）・可能",
  will: "將會・意志",
  would: "會（假設）・過去習慣",
  shall: "將・要不要…",
  should: "應該",
  may: "也許・可以",
  might: "也許（較不確定）",
  must: "必須・一定是",
};

export const EN_WORD_NOTES: Record<string, string> = {
  gonna: "= going to：打算…・將要…",
  wanna: "= want to：想要…",
  gotta: "= have got to：必須…",
  "'cause": "= because：因為",
  cause: "= because：因為（口語）",
  "ain't": "= am not / isn't / haven't（口語）",
  "y'all": "= you all：你們",
  "'til": "= until：直到",
  till: "直到",
};

interface EnMatcher {
  words?: string[];
  tag?: string;
}

const BE = ["am", "is", "are", "was", "were", "be", "been", "being"];
const HAVE = ["have", "has", "had"];

export const EN_PATTERNS: Pattern<EnMatcher>[] = [
  {
    seq: [{ tag: "Modal" }, { words: ["have"] }, { tag: "Participle" }],
    label: "modal + have + 過去分詞",
    note: "過去沒發生的假設：本來會／應該…",
  },
  {
    seq: [{ tag: "Modal" }, { words: ["have"] }, { tag: "PastTense" }],
    label: "modal + have + 過去分詞",
    note: "過去沒發生的假設：本來會／應該…",
  },
  {
    seq: [{ words: HAVE }, { words: ["been"] }, { tag: "Gerund" }],
    label: "完成進行式",
    note: "一直在…（持續到現在）",
  },
  { seq: [{ words: ["had"] }, { tag: "Participle" }], label: "過去完成式", note: "（在過去某時之前）已經…" },
  { seq: [{ words: ["had"] }, { tag: "PastTense" }], label: "過去完成式", note: "（在過去某時之前）已經…" },
  { seq: [{ words: HAVE }, { tag: "Participle" }], label: "現在完成式", note: "已經…・到現在為止…" },
  { seq: [{ words: HAVE }, { tag: "PastTense" }], label: "現在完成式", note: "已經…・到現在為止…" },
  { seq: [{ words: ["going"] }, { words: ["to"] }, { tag: "Infinitive" }], label: "be going to", note: "打算…・將要…" },
  {
    seq: [{ words: ["used"] }, { words: ["to"] }, { tag: "Infinitive" }],
    label: "used to",
    note: "過去常常…（現在不了）",
  },
  { seq: [{ words: BE }, { tag: "Gerund" }], label: "進行式", note: "正在…" },
  { seq: [{ words: BE }, { tag: "Participle" }], label: "被動式", note: "被…" },
];

export function matchEn(m: EnMatcher, token: { word: string; tags: string[] }): boolean {
  if (m.words && !m.words.includes(token.word)) return false;
  if (m.tag && !token.tags.includes(m.tag)) return false;
  return true;
}

/**
 * Finds every non-overlapping run of tokens that matches a pattern, trying patterns in order at
 * each position so the longer, more specific ones win.
 */
export function findPatterns<T, M>(
  tokens: readonly T[],
  patterns: readonly Pattern<M>[],
  matches: (matcher: M, token: T) => boolean
): { from: number; to: number; label: string; note: string }[] {
  const found: { from: number; to: number; label: string; note: string }[] = [];
  let i = 0;
  while (i < tokens.length) {
    const hit = patterns.find(
      p => i + p.seq.length <= tokens.length && p.seq.every((m, k) => matches(m, tokens[i + k]))
    );
    if (hit) {
      found.push({ from: i, to: i + hit.seq.length - 1, label: hit.label, note: hit.note });
      i += hit.seq.length;
    } else {
      i++;
    }
  }
  return found;
}
