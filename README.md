# GLM Card App (Next.js 14 + TS)

小朋友知識卡片/海報生成器。前端 Next.js (App Router) + 後端 Serverless 代理 **智譜 GLM**。
- **模型**：預設 `glm-4.5-flash`，失敗自動回退 `GLM-4-Flash-250414`
- **功能**：輸入主題/數量/語氣 → 生成卡片列表或單張海報；複製/導出 JSON、導出 PNG
- **安全**：API Key 僅存於服務端環境變量

## 一鍵部署 (Vercel)
1. Fork 本倉庫或上傳源碼到 GitHub
2. 進入 Vercel 新建專案 → 連接 GitHub 倉庫
3. 設定環境變量：
   - `ZHIPU_API_KEY` = 你的智譜金鑰
   - `MODEL_NAME`    = `glm-4.5-flash`
4. 部署完成後打開站點。

> 本專案在 **Node.js Runtime** 執行 API（非 Edge），以避免 Edge 25 秒初始回應限制。`vercel.json` 已指定：
> ```json
> {
>   "functions": {
>     "app/api/chat/route.ts": { "runtime": "nodejs", "maxDuration": 60 }
>   }
> }
> ```

## 本地開發
```bash
pnpm i   # 或 npm i / yarn
pnpm dev # http://localhost:3000
```

## 專案結構
```
app/
  api/chat/route.ts     # 代理智譜 API（Node runtime）
  layout.tsx
  page.tsx
lib/
  prompt/{card,poster}.ts
types/
  {card,poster}.ts
public/favicon.svg
```

## 智譜 API 代理規則
Endpoint: `POST https://open.bigmodel.cn/api/paas/v4/chat/completions`  
Headers:
- `Authorization: Bearer ${ZHIPU_API_KEY}`
- `Content-Type: application/json`

Body（服務端固定非流式，thinking 關閉）：
```json
{
  "model": "glm-4.5-flash",
  "messages": [
    {"role":"system","content":"..."},
    {"role":"user","content":"..."}
  ],
  "stream": false,
  "thinking": { "type": "disabled" }
}
```
> 若出現 4xx/5xx 或逾時，後端自動改用 **GLM-4-Flash-250414** 再試一次，並在回應中包含 `_model` 欄位。

## 常見問題
- **FUNCTION_INVOCATION_TIMEOUT / 504**：確保當前部署使用 Node 函式（在 Vercel 的某次 Deployment → Functions 看到 `Serverless Function`），且 `vercel.json` 存在於**專案根目錄**。
- **postcss ESM 錯誤**：本專案已使用 ESM 寫法的 `postcss.config.js` / `tailwind.config.js`，不會再出現 "module is not defined"。

## 測試
```bash
pnpm test
```
僅進行基本 JSON 形狀檢查（Vitest）。

## 版權
MIT
