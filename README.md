# lumemex

lumemex 是一個 **persistent, compounding wiki** 的個人知識庫系統：知識會被持續整理進 `wiki/` 並累積演化，而不是像傳統 RAG 每次查詢都重新臨時拼接。

## Quick Start

1. 安裝前置（Node 24.x + Volta）
2. 複製設定檔：
   - `cp config.example.json config.json`
3. 填入 `config.json` 的 `api_key`
   - Free key 申請：<https://aistudio.google.com/apikey>
4. 安裝與 build：
   - `volta run npm install && volta run npm run build`
5. 跑第一筆 ingest：
   - `volta run npm run cli -- ingest raw/url/llm-wiki-pattern-demo.md`
6. 啟動 Web UI：
   - `volta run npm run dev:web`
   - 開啟 <http://localhost:3000>

## Web UI 頁面說明

- `/dashboard`：知識庫健康儀表板（raw/wiki/link 統計、分類條圖、最近活動）。
- `/query`：提問、顯示回答、confirm-first 儲存回答回 wiki，含 API Key 診斷工具。
- `/ingest`：raw 檔案列表、多選批次 ingest、進度顯示、拖曳/選檔上傳。
- `/graph`：wiki 連結關係 force-directed 圖（拖曳、tooltip、點擊預覽）。
- `/search`：debounce 全文搜尋，關鍵字高亮，點擊結果預覽完整 markdown。
- `/editor`：wiki 頁面編輯器（Edit/Preview、手動儲存、dirty 警告、autosave 狀態）。

## CLI 指令

- ingest
  - 用法：`volta run npm run cli -- ingest <rawPath>`
  - 範例：`volta run npm run cli -- ingest raw/url/llm-wiki-pattern-demo.md`
- query
  - 用法：`volta run npm run cli -- query "<question>"`
  - 範例：`volta run npm run cli -- query "What is the core idea of the LLM Wiki pattern?"`
- lint
  - 用法：`volta run npm run cli -- lint`
  - 範例：`volta run npm run cli -- lint`

## Config 說明

`config.json` 欄位：

- `api_base_url`：OpenAI-compatible API base URL（目前預設 Gemini OpenAI 相容端點）。
- `api_key`：模型供應商 API key。
- `ingest_model`：Ingest 流程使用模型（目前預設 `gemma-4-31b-it`）。
- `query_model`：Query/診斷使用模型（目前預設 `gemini-2.5-flash-lite`）。
- `lint_model`：Lint 流程使用模型（目前預設 `gemma-4-31b-it`）。
- `raw_dir`：raw 檔案目錄（通常 `./raw`）。
- `wiki_dir`：wiki 檔案目錄（通常 `./wiki`）。
- `max_tokens_per_compilation`：單次編譯/操作的 token 上限。

## Free Tier 限制

以下為目前可確認資訊（實際額度以你的 AI Studio 專案頁為準）：

- `gemini-2.5-flash-lite`
  - RPM：30
  - RPD：1000
- `gemma-4-31b-it`
  - 官方公開文件未穩定提供固定 free-tier RPM/RPD 數值，請以 AI Studio Rate Limit Dashboard 為準：<https://aistudio.google.com/rate-limit?timeRange=last-28-days>

## Tech Stack

- Monorepo + TypeScript
- CLI：Node.js
- LLM client：OpenAI-compatible API（可換 provider）
- Storage：SQLite（better-sqlite3）+ FTS5 + Markdown files
- Web：Next.js App Router + React + D3 + react-markdown
