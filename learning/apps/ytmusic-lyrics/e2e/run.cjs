// End-to-end check of the built Chrome extension against a stand-in for Better Lyrics' lyrics DOM
// and a stand-in for AnkiConnect. Run `npm run build` first, then `npm run e2e`.
//
// The real music.youtube.com is not used: it needs sign-in and blocks automated browsers. The
// fake page (fake-ytm.html) mirrors the structure Better Lyrics renders, including the karaoke
// overlay run that sits on top of the text, so hit-testing is exercised under the same conditions.

const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { fork } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const here = __dirname;
const ext = path.join(here, "..", "dist", "chrome");
const shots = path.join(here, "screens");
const VIDEO_ID = "kagEKbdd2_g";

fs.mkdirSync(shots, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`) });
const log = (...args) => console.log(...args);

async function main() {
  assert.ok(fs.existsSync(path.join(ext, "manifest.json")), "Build the extension first: npm run build");
  const anki = fork(path.join(here, "fake-anki.cjs"), { silent: true });
  await new Promise(resolve => anki.stdout.once("data", resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lyric-study-e2e-"));
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  try {
    await run(ctx);
    log("\nAll checks passed. Screenshots:", shots);
  } finally {
    await ctx.close();
    anki.kill();
  }
}

async function run(ctx) {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
  const id = new URL(sw.url()).host;
  await ctx.route("https://music.youtube.com/**", route =>
    route.fulfill({ contentType: "text/html", body: fs.readFileSync(path.join(here, "fake-ytm.html"), "utf8") })
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`https://music.youtube.com/watch?v=${VIDEO_ID}`);

  // -- Marks --------------------------
  await page.waitForFunction(() => CSS.highlights.get("ls-pattern")?.size > 2, null, { timeout: 30000 });
  const highlights = await page.evaluate(() => Object.fromEntries([...CSS.highlights].map(([k, v]) => [k, v.size])));
  log("highlights:", JSON.stringify(highlights));
  for (const name of ["ls-noun", "ls-verb", "ls-particle", "ls-aux", "ls-pattern"]) {
    assert.ok(highlights[name] > 0, `expected marks for ${name}`);
  }
  await shot(page, "1-marks");

  const centerOf = (lineIndex, needle) =>
    page.evaluate(
      ([i, needle]) => {
        const run = document
          .querySelectorAll(".blyrics--line")
          [i].querySelector(".blyrics-bidi-run:not(.blyrics-highlight-run)");
        const walker = document.createTreeWalker(run, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let text = "";
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          nodes.push([n, text.length]);
          text += n.data;
        }
        const at = text.indexOf(needle);
        const locate = offset => {
          for (const [node, start] of nodes) if (offset >= start && offset <= start + node.data.length) return [node, offset - start];
        };
        const range = document.createRange();
        range.setStart(...locate(at));
        range.setEnd(...locate(at + needle.length));
        const box = range.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      },
      [lineIndex, needle]
    );

  const hoverCard = async (lineIndex, needle) => {
    const point = await centerOf(lineIndex, needle);
    await page.mouse.move(point.x, point.y);
    await page.waitForFunction(word => document.querySelector(".ls-card__word")?.textContent === word, needle, {
      timeout: 3000,
    });
    await page.waitForTimeout(1500); // the meaning lookup is a network call
    return page.textContent(".ls-card");
  };

  // -- Hover cards --------------------------
  const verbCard = await hoverCard(0, "呼ん");
  log("card 呼ん:", verbCard);
  assert.match(verbCard, /原形 呼ぶ/);
  assert.match(verbCard, /〜ている/);
  await shot(page, "2-card-japanese");

  await page.click(".ls-card__save");
  await page.waitForTimeout(1500);

  const englishCard = await hoverCard(3, "showed");
  log("card showed:", englishCard);
  assert.match(englishCard, /片語動詞 show up/);
  await shot(page, "3-card-english");

  // -- Drag a word to save --------------------------
  const word = await centerOf(2, "夢");
  await page.mouse.move(word.x, word.y);
  await page.waitForTimeout(600);
  await page.mouse.down();
  await page.mouse.move(word.x + 20, word.y + 20, { steps: 4 });
  await page.waitForSelector(".ls-zones--visible");
  const saveZone = await (await page.$(".ls-zone")).boundingBox();
  await page.mouse.move(saveZone.x + saveZone.width / 2, saveZone.y + saveZone.height / 2, { steps: 8 });
  await shot(page, "4-drag");
  await page.mouse.up();
  await page.waitForTimeout(1500);
  assert.deepEqual(await page.evaluate(() => window.seeks), [], "a drag must not make Better Lyrics seek");

  // -- Drag a wrong translation to hide --------------------------
  const translation = await (await page.$$(".blyrics--translated"))[2].boundingBox();
  await page.mouse.move(translation.x + 40, translation.y + translation.height / 2);
  await page.waitForTimeout(600);
  await page.mouse.down();
  await page.mouse.move(translation.x + 60, translation.y + 40, { steps: 4 });
  await page.waitForSelector(".ls-zones--visible");
  const hideZone = await (await page.$(".ls-zone--danger")).boundingBox();
  await page.mouse.move(hideZone.x + hideZone.width / 2, hideZone.y + hideZone.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const isHidden = () =>
    page.evaluate(() => document.querySelectorAll(".blyrics--translated")[2].classList.contains("ls-hidden-translation"));
  assert.equal(await isHidden(), true, "translation should be hidden after the drop");

  // Better Lyrics rebuilds the lines on a reload; the hide and the marks must come back.
  await page.evaluate(() => {
    const container = document.getElementById("lines");
    const html = container.innerHTML;
    container.replaceChildren();
    container.innerHTML = html;
  });
  await page.waitForTimeout(800);
  assert.equal(await isHidden(), true, "hide must survive a re-render");
  assert.ok((await page.evaluate(() => CSS.highlights.get("ls-noun")?.size)) > 0, "marks must repaint after a re-render");

  // -- Right-click menu --------------------------
  const given = await centerOf(4, "given");
  await page.mouse.click(given.x, given.y, { button: "right" });
  const menu = await page.$$eval(".ls-menu__item", items => items.map(item => item.textContent));
  log("menu:", JSON.stringify(menu));
  assert.deepEqual(menu, ["存「given」", "存整句", "隱藏這句錯誤翻譯", "還原這首歌的翻譯"]);
  await shot(page, "5-menu");
  await page.keyboard.press("Escape");

  // -- Storage --------------------------
  const store = await sw.evaluate(() => chrome.storage.local.get(null));
  const saved = store.words.map(w => w.text).sort();
  log("saved:", JSON.stringify(store.words.map(w => [w.text, w.reading, w.base, w.meaning, w.time, w.ankiNoteId])));
  assert.deepEqual(saved, ["呼ん", "夢"]);
  const verb = store.words.find(w => w.text === "呼ん");
  assert.equal(verb.base, "呼ぶ");
  assert.equal(verb.song, "夜に駆ける");
  assert.equal(verb.time, 12.3);
  assert.deepEqual(store.hiddenTranslations, { [`${VIDEO_ID}|zh-TW`]: ["夢を見ているように笑ってくれた"] });

  // -- Anki (auto-sync on save, against the fake AnkiConnect) --------------------------
  assert.ok(store.words.every(w => typeof w.ankiNoteId === "number"), "every word should be in Anki");
  const ankiState = await (
    await fetch("http://127.0.0.1:8765", { method: "POST", body: JSON.stringify({ action: "debugNotes" }) })
  ).json();
  assert.deepEqual(ankiState.result.models, ["Learning Card"]);
  assert.ok(ankiState.result.decks.includes("Lyric Study"));
  const note = ankiState.result.notes.find(n => n.fields.Text === "呼ん");
  log("anki note:", JSON.stringify(note.fields));
  assert.equal(note.fields.Context, "君の名前を<b>呼ん</b>でいたのに");

  // -- Popup --------------------------
  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 420, height: 640 });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.waitForTimeout(500);
  assert.equal(await popup.textContent("#word-count"), "2");
  await shot(popup, "6-popup");
  await popup.click('[data-tab="settings"]');
  await popup.waitForTimeout(300);
  await shot(popup, "7-settings");

  assert.deepEqual(errors, [], "no uncaught page errors");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
