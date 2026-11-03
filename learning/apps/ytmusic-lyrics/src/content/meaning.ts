// A one-word gloss from the same Google endpoint Better Lyrics uses for line translations.
const cache = new Map<string, Promise<string | undefined>>();

export function lookUpMeaning(word: string, from: "ja" | "en", to: string): Promise<string | undefined> {
  const key = `${from}|${to}|${word}`;
  let result = cache.get(key);
  if (!result) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(word)}`;
    result = fetch(url)
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        const text = Array.isArray(data?.[0]) ? data[0].map((part: string[]) => part[0]).join("") : "";
        // An English word coming back unchanged means "unknown"; a kanji word often really is the same in Chinese.
        if (!text || (from === "en" && text.toLowerCase() === word.toLowerCase())) return undefined;
        return text;
      })
      .catch(error => {
        console.error("[Lyric Study] Meaning lookup failed:", error);
        cache.delete(key);
        return undefined;
      });
    cache.set(key, result);
  }
  return result;
}
