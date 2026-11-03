# 語言學習系統（暫放處）

這個資料夾是一組語言學習專案的起點。它暫時放在 Better Lyrics 的 fork 裡，只是因為目前只有這個 repo 可以用；裡面的東西**都不屬於 Better Lyrics**，之後會搬到各自的 repo。

> 交給 AI 代理接手時，請它先讀 [AGENTS.md](AGENTS.md)。

## 結構

```
learning/
├── packages/
│   ├── grammar-marks/   共用：日文、英文的輕量文法標記（詞性、短提示、文法句型）
│   └── anki-bridge/     共用：把學習項目變成 Anki 卡片（AnkiConnect 同步、匯入檔）
└── apps/
    └── ytmusic-lyrics/  應用：搭配 Better Lyrics 的 YouTube Music 擴充功能
```

- **共用套件**不碰網頁、不碰瀏覽器 API，任何專案（擴充功能、網頁、Node 腳本）都能直接用。
- **應用**只負責「接到某個地方」：讀那個網站的畫面、把結果畫上去、存資料。

## ytmusic-lyrics：聽歌時順便學

搭配官方 Better Lyrics 一起裝，不用停用它。

- **文法標記**：歌詞依功能上色。實詞畫細底線（名詞藍、動詞橘、形容詞／副詞綠），助詞和助動詞／時態用淡色底，文法句型（〜ている、かもしれない、完成式、片語動詞…）用波浪線。設定裡可以改成「只標文法」。
- **懸浮小卡**：滑鼠停在字上，顯示讀音、原形、詞性、一句文法提示和簡短意思，可以一鍵「☆ 存」，或連到 Jisho／Cambridge 查更多。
- **存單字**：把字拖到下方的「放開以儲存單字／整句」，或用小卡、右鍵選單。會記下原句、翻譯、歌名，以及那句在歌曲裡的時間點。
- **Anki**：存的單字自動送進 Anki 的「Lyric Study」牌組，卡片背面有「▶ 聽這句」連結。沒裝 AnkiConnect 也可以下載匯入檔。
- **隱藏錯誤翻譯**：把翻譯拖到「放開以隱藏這句翻譯」，或用右鍵選單。

### 建置與安裝

```bash
cd learning
npm install
npm run build
cd apps/ytmusic-lyrics && npm run e2e   # 端對端測試（第一次要先裝 Playwright，見 AGENTS.md）
```

產出在 `apps/ytmusic-lyrics/dist/`：`chrome/`、`firefox/` 兩個資料夾和對應的 zip。

- **Chrome／Edge／Brave**：`chrome://extensions` → 開發人員模式 → 載入未封裝項目 → 選 `dist/chrome`。
- **Firefox**：`about:debugging` → 這個 Firefox → 載入暫時性附加元件 → 選 `dist/firefox/manifest.json`。
- **Anki**：安裝 [AnkiConnect](https://ankiweb.net/shared/info/2055492159)（代碼 2055492159），開著 Anki。第一次同步時 Anki 會跳出視窗請你允許。

日文字典（kuromoji，約 18 MB）只在第一次遇到日文歌詞時載入，所以第一首日文歌的標記會晚一兩秒出現。

## 拆分與分工

### 該獨立成自己 repo 的

| 現在的位置 | 建議 | 原因 |
|---|---|---|
| `packages/grammar-marks` | 獨立 repo，當整個語言學習系統的核心 | 每個專案都需要「把句子切開、標出文法」，不該綁在歌詞上 |
| `packages/anki-bridge` | 跟 grammar-marks 放同一個核心 repo（monorepo） | 每個專案都要送卡到 Anki，共用同一種卡片類型，Anki 裡才不會亂 |
| `apps/ytmusic-lyrics` | 獨立 repo，依賴核心 repo | 它是「接到 YouTube Music」的那一層，跟著 Better Lyrics 的版面改 |

### 交給現成工具，不自己做的

| 需求 | 用什麼 | 備註 |
|---|---|---|
| 間隔重複複習 | **Anki** | 已經是最成熟的做法；這裡只負責把卡片送進去 |
| 和 Anki 溝通 | **AnkiConnect** + [yanki-connect](https://github.com/kitschpatrol/yanki-connect) | 不自己寫通訊協定 |
| 日文分詞、詞性 | **kuromoji** | 離線、免費 |
| 英文詞性、時態 | **compromise** | 離線、免費 |
| 歌詞、同步、整句翻譯 | **Better Lyrics** | 這裡只是疊在它上面 |
| 深入的日文字典查詢 | **Yomitan**（瀏覽器擴充功能） | 想查完整字義時可以一起開，小卡只放最短的意思 |
| 影片字幕學習 | **asbplayer**、**Language Reactor** | 已經做得很好，見下方 |

### 該回饋給上游的

- **錯誤翻譯**：隱藏翻譯只是在自己的電腦上藏起來。更好的做法是回報給 Better Lyrics／Unison，讓翻譯對所有人都變好。這點已經寫在給上游的功能建議 issue 草稿裡。

### 這個 fork 裡要清掉的

Better Lyrics fork 的 `src/` 裡，先前做的「單字本＋刪除翻譯」（`src/core/vocabulary.ts`、`src/modules/ui/lyricDrag.ts` 等）已經被 `apps/ytmusic-lyrics` 取代。這兩份不要同時用，否則同一個功能會出現兩次。等上游 issue 不再需要那個分支當示範，就可以把它從 fork 移除。

## 之後的專案

這些專案都能直接用 `grammar-marks` 和 `anki-bridge`，存出來的卡片會在同一個 Anki 牌組體系裡：

1. **網頁閱讀模式**：在任何網頁的日文／英文文章上套用同樣的標記和小卡。這需要新的「應用」，核心套件不用改。
2. **歌詞複習播放清單**：從 Anki 裡「這週剛學的字」反查出歌曲和時間點，做成一份播放清單，讓你重聽那些句子。
3. **文法句型擴充**：`grammar-marks` 的句型表（`src/grammar.ts`）可以持續增加，例如 JLPT N3／N2 文法。這是對所有專案都有效的投資。
4. **影片字幕**：先試 asbplayer 或 Language Reactor。只有在它們做不到「文法上色」時，才考慮把 `grammar-marks` 接進去，例如做成它們的外掛或使用者腳本，而不是自己重寫一個播放器。
