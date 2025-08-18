# GLM 卡片生成器

一個基於 Next.js 14 的卡片生成應用，使用智譜大模型作為後端對話引擎，根據用戶輸入的主題、數量和語氣生成卡片。每張卡片包含標題、描述、標籤和一個 emoji 圖標，並支持複製、導出、清空和歷史記錄等功能。

## 架構概覽

本項目採用前後端分離的架構：

```
┌───────────────┐   POST /api/chat    ┌─────────────────────┐   POST chat/completions   ┌───────────────────────┐
│    前端頁面     │ ────────────────▶ │    Next.js API 路由    │ ───────────────────────▶ │ 智譜 Chat Completions API │
│ (App Router)  │   SSE streaming    │  (Edge Runtime)      │   Authorization          │ open.bigmodel.cn       │
└───────────────┘   ◀─────────────── └─────────────────────┘   ◀────────────────────── └───────────────────────┘
```

1. **前端頁面**：`app/page.tsx` 提供輸入表單、結果顯示、歷史記錄等功能。提交表單後，通過 `fetch` 調用 `/api/chat`，並解析服務端返回的 SSE 流以增量渲染結果。
2. **服務端 API 路由**：`app/api/chat/route.ts` 採用 Edge Runtime，僅在服務端運行。它組合系統提示與用戶提示，代理調用智譜的 `chat/completions` 端點，並將流式響應原樣返回給前端。若主模型返回 4xx/5xx 錯誤，將自動回退到舊模型 `GLM-4-Flash-250414` 並重試一次。
3. **智譜 API**：`https://open.bigmodel.cn/api/paas/v4/chat/completions`。需要傳入 Bearer token (`ZHIPU_API_KEY`) 和模型名稱。參數 `stream: true` 啟用服務端流式輸出。

## 功能特性

- 輸入主題、卡片數量、語氣，生成符合 JSON Schema 的卡片列表。
- 流式渲染：前端逐段解析 SSE 流，實時展示模型生成的 JSON 內容。
- 複製 JSON / 複製純文本 / 導出 JSON 檔案。
- 清空當前生成結果，查看並恢復歷史記錄（使用 `localStorage` 保存最近 10 條）。
- 自動模型回退：當 `glm-4.5-flash` 無法使用時，後端自動切換至 `GLM-4-Flash-250414`。
- 基礎單元測試：利用 Vitest 和 Zod 檢驗返回的 JSON 結構。

## 項目結構

```
glm-card-app/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts    # 服務端 API，代理智譜接口
│   ├── page.tsx            # 前端主頁
│   ├── layout.tsx          # 全局佈局
│   └── globals.css         # Tailwind 全局樣式
├── components/             # 可擴展的 UI 組件（本實現直接在 page.tsx 中渲染）
├── lib/
│   └── prompt/
│       └── card.ts         # 系統提示模板與用戶提示生成函數
├── types/
│   └── card.ts             # Card 類型定義
├── tests/
│   └── cardParsing.test.ts # JSON 解析與結構校驗單測
├── tailwind.config.js      # Tailwind 配置
├── postcss.config.js       # PostCSS 配置
├── next.config.mjs         # Next.js 配置
├── tsconfig.json           # TypeScript 配置
├── package.json            # 項目依賴與腳本
└── README.md
```

## 快速開始

### 安裝依賴

```bash
pnpm install
# 或者 npm install
```

### 環境變量

在本地開發或部署之前，請在項目根目錄創建 `.env.local` 並填寫以下環境變量：

```env
ZHIPU_API_KEY=請替換為你的智譜 API Key
MODEL_NAME=glm-4.5-flash
```

> **注意**：`ZHIPU_API_KEY` 僅用於服務端調用，不會暴露於瀏覽器。`MODEL_NAME` 默認為 `glm-4.5-flash`，若該模型無法使用，服務端會自動退回至 `GLM-4-Flash-250414`。

### 本地開發

```bash
npm run dev
# 或 pnpm dev
```

打開瀏覽器訪問 [http://localhost:3000](http://localhost:3000)，即可看到應用頁面。

### 運行測試

```bash
npm run test
# 使用 Vitest 執行單元測試
```

## 部署說明

### 1. 推送到 GitHub

由於當前無法在代理中直接調用 GitHub API 創建倉庫，你可以按照以下步驟手動推送代碼：

1. 在 GitHub 中新建一個倉庫，例如 `glm-card-app`。
2. 將本項目代碼初始化 Git：

   ```bash
   cd glm-card-app
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<你的 GitHub 用戶名>/glm-card-app.git
   git push -u origin main
   ```

3. 啟用 GitHub Actions（可選）：在 GitHub 倉庫的 Actions 標籤頁中啟用 Node.js CI 工作流程，以運行 lint 和單元測試。

### 2. 部署到 Vercel

1. 登錄 [Vercel](https://vercel.com/) 並新建項目，從 GitHub 掛鉤 `glm-card-app` 倉庫。
2. 在 **Environment Variables** 中添加：

   - `ZHIPU_API_KEY`：你的智譜 API Key
   - `MODEL_NAME`：默認 `glm-4.5-flash`

3. 點擊 Deploy，Vercel 會自動識別 Next.js 項目並完成部署。部署成功後可獲得一個 `<project-name>.vercel.app` 域名。
4. 若部署日誌中出現 4xx/5xx 錯誤並提示模型不可用，可在 Vercel 環境變量中將 `MODEL_NAME` 設為 `GLM-4-Flash-250414` 再次部署。

### 流式渲染與兜底策略

本應用優先通過 `stream: true` 調用智譜接口，並將 SSE 流直接傳遞給前端。前端解析 `delta.content` 並實時更新顯示。如果流式解析失敗或 API 返回非 2xx 狀態，服務端會重試一次並切換至非流式模式。如果兩種模式都失敗，會返回包含錯誤信息的 JSON，前端會顯示對應錯誤提示。

## 模型切換原因與方法

應官方建議，本項目默認使用 `glm-4.5-flash` 作為生成模型。若出現以下情況應手動或自動切換：

- **模型不可用 (4xx/5xx)**：可能是暫時限流或版本下線，服務端會捕捉錯誤並自動嘗試 `GLM-4-Flash-250414`。
- **長期不可用**：可在 Vercel 環境變量中將 `MODEL_NAME` 改為 `GLM-4-Flash-250414`，並重新部署。

在 `README.md` 中保留此說明，方便未來回顧。

## 授權

本項目代碼遵循 MIT 授權，你可以自由修改與分發。使用智譜大模型服務須遵守其服務條款。