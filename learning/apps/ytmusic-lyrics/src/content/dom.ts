// Everything this extension knows about the page lives here. The class names come from Better
// Lyrics' renderer, which documents them as a public contract for themes, so they change rarely.

export const WRAPPER_ID = "blyrics-wrapper";
export const LINE_SELECTOR = ".blyrics--line";
export const TRANSLATION_SELECTOR = ".blyrics--translated";
const MAIN_RUN_SELECTOR = ":scope > .blyrics-line-main > .blyrics-bidi-run:not(.blyrics-highlight-run)";
const TIMED_WORD_SELECTOR = "[data-time]";

export function lyricsWrapper(): HTMLElement | null {
  return document.getElementById(WRAPPER_ID);
}

export function lyricLines(wrapper: HTMLElement): HTMLElement[] {
  return Array.from(wrapper.querySelectorAll<HTMLElement>(LINE_SELECTOR));
}

/** The visible text run of a line's main lyric, without the karaoke overlay that duplicates it. */
export function mainRun(line: HTMLElement): HTMLElement | null {
  return line.querySelector<HTMLElement>(MAIN_RUN_SELECTOR);
}

export interface TextMap {
  text: string;
  nodes: Text[];
  /** Offset in `text` where each node starts. */
  starts: number[];
}

export function textMap(root: HTMLElement): TextMap {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const starts: number[] = [];
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node as Text);
    starts.push(text.length);
    text += (node as Text).data;
  }
  return { text, nodes, starts };
}

/** The text node holding `offset`: a start sits at the beginning of a node, an end at the end of one. */
function locate(map: TextMap, offset: number, isEnd: boolean): [Text, number] | null {
  for (let i = 0; i < map.nodes.length; i++) {
    const start = map.starts[i];
    const end = start + map.nodes[i].data.length;
    if (isEnd ? offset > start && offset <= end : offset >= start && offset < end)
      return [map.nodes[i], offset - start];
  }
  return null;
}

export function rangeFor(map: TextMap, start: number, end: number): Range | null {
  const from = locate(map, start, false);
  const to = locate(map, end, true);
  if (!from || !to) return null;
  const range = document.createRange();
  range.setStart(from[0], from[1]);
  range.setEnd(to[0], to[1]);
  return range;
}

export function translationOf(line: HTMLElement): HTMLElement | null {
  return line.querySelector<HTMLElement>(TRANSLATION_SELECTOR);
}

export function lineStartSeconds(line: HTMLElement): number | undefined {
  const time = Number(line.querySelector<HTMLElement>(TIMED_WORD_SELECTOR)?.dataset.time);
  return Number.isFinite(time) ? time : undefined;
}

export function cleanText(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

export function currentSong(): { song: string; artist: string; videoId: string } {
  const bar = document.querySelector("ytmusic-player-bar");
  const song = cleanText(bar?.querySelector(".title")?.textContent);
  const artist = cleanText(bar?.querySelector(".byline")?.textContent?.split("•")[0]);
  const videoId = new URL(location.href).searchParams.get("v") ?? "";
  return { song, artist, videoId };
}
