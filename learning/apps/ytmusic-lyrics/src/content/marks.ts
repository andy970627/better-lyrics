import type { Analysis, Category, GrammarSpan, Token } from "@learning/grammar-marks";
import type { Settings } from "../types";
import { analyzeLine } from "./analysis";
import { cleanText, lyricLines, mainRun, rangeFor, type TextMap, textMap } from "./dom";

// Marks are painted with the CSS Custom Highlight API: ranges over Better Lyrics' own text nodes,
// so its DOM, karaoke timing and click-to-seek are left exactly as they are.

const CATEGORIES: Category[] = ["noun", "pron", "verb", "adj", "particle", "aux"];
const GRAMMAR_CATEGORIES = new Set<Category>(["particle", "aux"]);
const PATTERN_HIGHLIGHT = "ls-pattern";

export interface LineInfo {
  line: HTMLElement;
  /** The line's text, whitespace-collapsed, as saved and as hidden-translation keys use it. */
  text: string;
  map: TextMap;
  analysis: Analysis;
  tokenRanges: (Range | null)[];
  spanRanges: (Range | null)[];
}

export interface Hit {
  info: LineInfo;
  token: Token;
  range: Range;
  span?: GrammarSpan;
}

let infos: LineInfo[] = [];
let generation = 0;

const supportsHighlights = typeof CSS !== "undefined" && "highlights" in CSS;

function paint(settings: Settings): void {
  if (!supportsHighlights) return;
  for (const category of CATEGORIES) CSS.highlights.delete(`ls-${category}`);
  CSS.highlights.delete(PATTERN_HIGHLIGHT);
  if (!settings.marks) return;

  const byCategory = new Map<Category, Range[]>();
  const patterns: Range[] = [];
  for (const info of infos) {
    info.analysis.tokens.forEach((token, i) => {
      const range = info.tokenRanges[i];
      if (!range || token.category === "other") return;
      if (settings.markLevel === "grammar" && !GRAMMAR_CATEGORIES.has(token.category)) return;
      const list = byCategory.get(token.category) ?? [];
      list.push(range);
      byCategory.set(token.category, list);
    });
    for (const range of info.spanRanges) if (range) patterns.push(range);
  }
  for (const [category, ranges] of byCategory) CSS.highlights.set(`ls-${category}`, new Highlight(...ranges));
  const patternHighlight = new Highlight(...patterns);
  patternHighlight.priority = 1;
  CSS.highlights.set(PATTERN_HIGHLIGHT, patternHighlight);
}

/**
 * Re-reads every lyric line and repaints. Analysis is cached by line text, so this is cheap to run
 * whenever Better Lyrics re-renders; lines still being analyzed are picked up when they finish.
 */
export async function refreshMarks(wrapper: HTMLElement, settings: Settings): Promise<void> {
  const run = ++generation;
  const pending: Promise<void>[] = [];
  const next: LineInfo[] = [];
  for (const line of lyricLines(wrapper)) {
    const runElement = mainRun(line);
    if (!runElement) continue;
    const map = textMap(runElement);
    if (!map.text.trim()) continue;
    pending.push(
      analyzeLine(map.text, settings).then(analysis => {
        if (!analysis || run !== generation) return;
        next.push({
          line,
          text: cleanText(map.text),
          map,
          analysis,
          tokenRanges: analysis.tokens.map(token => rangeFor(map, token.start, token.end)),
          spanRanges: analysis.spans.map(span => rangeFor(map, span.start, span.end)),
        });
      })
    );
  }
  await Promise.all(pending);
  if (run !== generation) return;
  infos = next;
  paint(settings);
}

export function clearMarks(): void {
  generation++;
  infos = [];
  if (!supportsHighlights) return;
  for (const category of CATEGORIES) CSS.highlights.delete(`ls-${category}`);
  CSS.highlights.delete(PATTERN_HIGHLIGHT);
}

export function lineInfoFor(line: HTMLElement): LineInfo | undefined {
  return infos.find(info => info.line === line);
}

function contains(range: Range, x: number, y: number, pad = 2): boolean {
  for (const rect of range.getClientRects()) {
    if (x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad) return true;
  }
  return false;
}

/** The token under a point, found from the ranges' own boxes, so the karaoke overlay on top doesn't matter. */
export function hitTest(x: number, y: number): Hit | null {
  for (const info of infos) {
    const box = info.line.getBoundingClientRect();
    if (y < box.top || y > box.bottom || x < box.left || x > box.right) continue;
    for (let i = 0; i < info.analysis.tokens.length; i++) {
      const range = info.tokenRanges[i];
      if (!range || !contains(range, x, y)) continue;
      const token = info.analysis.tokens[i];
      const span = info.analysis.spans.find(s => s.start <= token.start && token.end <= s.end);
      return { info, token, range, span };
    }
  }
  return null;
}
