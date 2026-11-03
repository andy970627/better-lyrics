import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require("./package.json");
const dictDir = join(dirname(require.resolve("kuromoji/package.json")), "dict");

const base = {
  manifest_version: 3,
  name: "Lyric Study for Better Lyrics",
  version: pkg.version,
  description: "Grammar marks, hover cards and saved words on Better Lyrics' lyrics in YouTube Music, with Anki sync.",
  permissions: ["storage"],
  host_permissions: ["*://music.youtube.com/*", "https://translate.googleapis.com/*", "http://127.0.0.1:8765/*"],
  action: { default_popup: "popup.html", default_title: "Lyric Study" },
  content_scripts: [
    { matches: ["*://music.youtube.com/*"], js: ["content.js"], css: ["content.css"], run_at: "document_idle" },
  ],
  web_accessible_resources: [{ resources: ["dict/*"], matches: ["*://music.youtube.com/*"] }],
};

const manifests = {
  chrome: { ...base, background: { service_worker: "background.js" } },
  firefox: {
    ...base,
    background: { scripts: ["background.js"] },
    browser_specific_settings: { gecko: { id: "lyric-study@learning.local", strict_min_version: "140.0" } },
  },
};

const outRoot = join(here, "dist");
rmSync(outRoot, { recursive: true, force: true });

for (const [browser, manifest] of Object.entries(manifests)) {
  const out = join(outRoot, browser);
  mkdirSync(out, { recursive: true });
  await build({
    entryPoints: {
      content: join(here, "src/content/index.ts"),
      background: join(here, "src/background.ts"),
      popup: join(here, "src/popup/popup.ts"),
    },
    outdir: out,
    bundle: true,
    format: "iife",
    target: "es2022",
    platform: "browser",
    minify: true,
    legalComments: "linked",
    // kuromoji calls Node's path.join on its dictionary URL; yanki-connect only imports "open" on macOS auto-launch.
    alias: { path: join(here, "src/shims/path.cjs") },
    external: ["open"],
    logLevel: "warning",
  });
  cpSync(join(here, "src/content/content.css"), join(out, "content.css"));
  cpSync(join(here, "src/popup/popup.html"), join(out, "popup.html"));
  cpSync(join(here, "src/popup/popup.css"), join(out, "popup.css"));
  cpSync(dictDir, join(out, "dict"), { recursive: true });
  writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  execFileSync("zip", ["-qr", join(outRoot, `lyric-study-${pkg.version}-${browser}.zip`), "."], { cwd: out });
}
console.log(`Built ${Object.keys(manifests).join(", ")} into ${outRoot}`);
