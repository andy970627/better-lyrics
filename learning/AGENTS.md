# 交接給 AI 代理（learning/）

接手這個資料夾的 AI 請先讀完這份。`learning/README.md` 是給人看的概覽，這份是工作規則和現況。

> 上一層的 `AGENTS.md` 和 `CONTRIBUTING.md` 是 **Better Lyrics 專案**的規則，只管 `src/`、`pages/`、`tooling/`。
> `learning/` 有自己的工具鏈，那些規則（i18n、UI guard、self-check、版本號）**不適用**這裡。

## 這是什麼、為誰做

- 擁有者：@andy970627，母語繁體中文。**回覆與介面文字一律用繁體中文。**
- 目的：做一系列「語言學習系統」專案，主要給自己用。第一個應用是聽 YouTube Music 時順便學日文、英文。
- 這個資料夾**暫放**在 Better Lyrics 的 fork 裡（`andy970627/better-lyrics`，分支 `claude/confident-johnson-qmi8ko`），只是因為當時只有這個 repo 可用。它不是 Better Lyrics 的一部分，之後要搬到獨立 repo（見下方「下一步」）。

## 擁有者已確定的偏好（不要推翻，除非他改口）

1. **語言**：日文、英文。
2. **標記要最簡短**：「聽音樂時順便吸收」，只需用輕量的標記把不同意義的部分區隔開來，不要長篇文法解說。
3. **顯示方式**：懸浮小卡（滑鼠停留才出現）。
4. **複習**：用現成的 Anki，不自己做間隔重複。他明確說要利用現有資源（https://github.com/topics/anki）。
5. **能用現成工具就用現成的**；不適合放在某專案裡的東西，要獨立出來或融入其他現有專案。
6. **多專案**：共用的部分放在 `packages/`，各個應用放在 `apps/`。

## 結構

```
learning/
├── packages/grammar-marks/   純分析：kuromoji（日）、compromise（英）→ Token / GrammarSpan
│   └── src/grammar.ts        所有提示文字和文法句型表都在這裡
├── packages/anki-bridge/     LearningCard → Anki（yanki-connect）或 TSV 匯入檔
└── apps/ytmusic-lyrics/      Chrome / Firefox MV3 擴充功能
    ├── src/content/          內容腳本（在 music.youtube.com 上跑）
    │   ├── dom.ts            ★ 唯一知道 Better Lyrics DOM 的檔案
    │   ├── marks.ts          用 CSS Custom Highlight API 上色、hit test
    │   ├── card.ts           懸浮小卡
    │   ├── drag.ts / menu.ts 拖拉存字、右鍵選單
    │   └── hidden.ts         隱藏錯誤翻譯
    ├── src/background.ts     Anki 同步（service worker）
    ├── src/popup/            單字本、設定
    ├── build.mjs             esbuild 打包，輸出 dist/chrome、dist/firefox 和 zip
    └── e2e/                  端對端測試（假的 Better Lyrics 頁面＋假的 AnkiConnect）
```

套件之間用 npm workspaces 連起來，套件直接以 TypeScript 原始碼被 esbuild 打包（`main: src/index.ts`），沒有各自的建置步驟。

## 指令

```bash
cd learning
npm install
npm run typecheck                          # 三個 workspace 的 tsc --noEmit
npm run build                              # 建置擴充功能
cd apps/ytmusic-lyrics && npm run e2e      # 端對端測試（需要先 build）
```

e2e 需要 Playwright，但沒有列在 package.json 的依賴裡，因為原本的雲端環境已經預先裝好。在本機第一次跑之前請先執行：

```bash
npm i -D playwright@1 -w @learning/ytmusic-lyrics
npx playwright install chromium
```

e2e 用 `channel: "chromium"` 和 headless 模式載入擴充功能。有任何一項檢查失敗就會以非零結束碼退出，截圖存到 `apps/ytmusic-lyrics/e2e/screens/`（已加入 gitignore）。

**宣稱完成之前**：`npm run typecheck`、`npm run build`、`npm run e2e` 都要通過。如果動到 `learning/` 以外的檔案，還要跑上一層 Better Lyrics 的 `npm run typecheck` 和 `npm run lint`（Biome 也會格式化 `learning/`）。

## 重要的設計決定（以及原因）

- **不改 Better Lyrics 的 DOM**：標記用 `CSS.highlights`（Custom Highlight API）畫在 Better Lyrics 自己的文字節點上。這樣它的逐字高亮、點擊跳轉、版面計算都不受影響。Chrome 105+、Firefox 140+ 支援。
- **class 名稱是公開約定**：`.blyrics--line`、`.blyrics-line-main`、`.blyrics-bidi-run`、`.blyrics-highlight-run`（覆蓋在文字上的卡拉 OK 層，要跳過）、`.blyrics--translated`、`#blyrics-wrapper`。braccato 原始碼註明這些是給佈景主題用的公開約定。如果 Better Lyrics 改版導致失效，只改 `dom.ts`。
- **hit test 用 Range 的 `getClientRects()`**，不用 `elementFromPoint`，因為卡拉 OK 覆蓋層蓋在文字上面。
- **小卡只有動作列吃滑鼠事件**（`pointer-events`）：卡片會蓋住上下一行，如果整張卡吃事件，就拖不到被蓋住的字。動作列放在靠近那個字的一側。
- **Better Lyrics 播放時會自動捲動**：小卡跟著字移動，不會一捲動就關掉。
- **拖拉放開時會吞掉那次 click**，否則 Better Lyrics 會跳到那一行。
- **隱藏翻譯用 class（`display:none`）**，不刪除元素。Better Lyrics 的 renderer 偵測到尺寸變化會自動重新量版面。key 是 `${videoId}|${翻譯元素的 lang}` 加上正規化後的原句。
- **kuromoji 字典約 18 MB**，在內容腳本裡第一次遇到日文時才載入。它用 `path.join` 拼 URL，會把 `chrome-extension://` 弄壞，所以 `build.mjs` 把 `path` 指到 `src/shims/path.cjs`。
- **簡短意思來自 `translate.googleapis.com`**（跟 Better Lyrics 用的同一個免費端點），沒有保證，可能被限流。e2e 不檢查意思的內容。在雲端環境連續測試後曾經回傳空值。
- **Anki**：同步一律從 background 送到 `http://127.0.0.1:8765`。第一次會用 `requestPermission` 讓 Anki 跳出允許視窗，並自動建立卡片類型「Learning Card」和牌組（預設「Lyric Study」）。重複的卡片會略過，並標記為已同步（`ankiNoteId: 0`）。
- **授權**：`learning/` 的套件標為 GPL-3.0-only，因為最早是從 GPL 的 Better Lyrics fork 開始的。依賴套件的授權：kuromoji 是 Apache-2.0，compromise 和 yanki-connect 是 MIT。

## 已知的缺口（還沒驗證、或刻意先不做）

- **還沒在真的 YouTube Music＋Better Lyrics 上跑過**。雲端環境的 IP 被 Google 擋了（reCAPTCHA），只在 `e2e/fake-ytm.html` 上驗證過。**第一件事就是在本機實測**，重點觀察：
  1. 標記有沒有對齊文字，有沒有被 Better Lyrics 的卡拉 OK 漸層蓋住或看不清楚。
  2. 開啟 letter wave（逐字母動畫）時，標記還在不在。
  3. 全螢幕模式下的小卡和放置區位置。
  4. 隱藏翻譯後，捲動位置有沒有跑掉。
  5. 第一首日文歌，字典的載入時間和記憶體用量。
- **觸控裝置不支援拖拉**（會跟捲動衝突），可以改用右鍵選單。
- **子母畫面（PiP）視窗沒有標記**：那是另一個 document。
- **文法句型表還不完整**（`packages/grammar-marks/src/grammar.ts`）。日文目前約 20 個常見句型，英文涵蓋時態、情態、片語動詞。日文的長複合句型可能會切錯。
- **沒有單元測試**：分析器的正確性目前只靠 e2e 和人工檢查。如果要加，第一個值得加的是 `grammar-marks` 的句型比對（純邏輯，不需要瀏覽器）。

## 下一步（照優先順序）

1. **本機實測**上面列的 5 點，修掉問題。修 DOM 對接只改 `dom.ts`，修樣式改 `content.css`。
2. **拆成獨立 repo**（需要擁有者先在 GitHub 建好 repo）：
   - `learning-core`：`packages/grammar-marks` 和 `packages/anki-bridge`（monorepo）。
   - `lyric-study`：`apps/ytmusic-lyrics`，依賴 `learning-core`。可以先用 git 依賴或 npm workspace，之後再考慮發佈套件。
   - 搬完後，從 Better Lyrics fork 刪掉 `learning/`，並把 fork 根目錄 `tsconfig.json` 的 `"learning"` exclude 拿掉。
3. **清理 Better Lyrics fork**：`src/` 裡先前做的單字本＋刪除翻譯功能（commit `5034845`，包含 `src/core/vocabulary.ts`、`src/modules/ui/lyricDrag.ts`、`lyricContextMenu.ts`、`lyricActions.ts`、`src/options/savedWords.ts` 以及相關的 locale 和 CSS）已經被 `apps/ytmusic-lyrics` 取代。等擁有者確認上游的功能建議 issue 不再需要那個分支當示範，就可以 revert 那個 commit。**先問擁有者再動手。**
4. **擴充 `grammar-marks` 的句型表**，例如 JLPT N3／N2 文法。這對之後所有專案都有幫助。
5. 之後的專案點子在 `README.md` 的「之後的專案」一節。原則是先看現成工具（Yomitan、asbplayer、Language Reactor）能不能做到，做不到的部分才自己做。

## 不要做的事

- 不要把語言學習功能加進 Better Lyrics 的 `src/`。上游不接受外部貢獻者用 AI 寫的 PR，見上一層 `CONTRIBUTING.md`。
- 不要自己實作間隔重複、字典或歌詞來源，這些交給 Anki、Yomitan 和 Better Lyrics。
- 不要在沒有擁有者同意的情況下推到別的分支、開 PR，或建立／刪除 repo。
- 不要把 `dist/`、`node_modules/` 或 e2e 截圖 commit 進去。
