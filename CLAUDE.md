# Claude Code 執行規則

這是一個跨 Windows 與 macOS 的 Next.js 教學專案。

## 觸發詞

當使用者輸入「請執行」時，直接完成以下工作，不要反問技術問題：

1. 確認目前目錄是本專案根目錄，並顯示作業系統。
2. 執行 `node --version`，必須是 Node.js 20.9 以上。若未安裝或版本不足，清楚告知安裝 Node.js 20 LTS 的官方網址，不要擅自使用來源不明的安裝器。
3. 執行 `npm ci`。Windows PowerShell 若因執行原則封鎖 `npm.ps1`，改用 `npm.cmd ci`，不要要求使用者降低系統安全設定。不要使用壓縮包外或其他專案的 `node_modules`。
4. 執行 `npm run check`；遇到上述 Windows 問題時使用 `npm.cmd run check`。
5. 執行 `npm run build`；遇到上述 Windows 問題時使用 `npm.cmd run build`。
6. 啟動開發伺服器。先嘗試 `npm run dev -- --port 3000`；Windows 可使用 `npm.cmd run dev -- --port 3000`。若 3000 已占用，自動改用 3001 至 3010 的第一個可用連接埠。
7. 等待首頁可連線後，回報完整網址與三個入口：
   - `/card`
   - `/card/booking`
   - `/admin/appointments`
8. 遇到可自行修正的錯誤就修正並重跑，不要只貼錯誤訊息。

## 安全邊界

- 不讀取或修改本專案資料夾外的檔案。
- 不需要 API key、資料庫或第三方帳號。
- 不真的寄信、不呼叫 LINE、不寫入 Google 日曆。
- 不把 `node_modules`、`.next`、`.env` 或 `data/appointments.json` 提交到 Git。
- 只在使用者明確要求時，才修改姓名、電話、社群連結與品牌色。

## 帶看助手（案源庫 → 買方勾選 → 路線 → 帶看單）

2026-08 新增的第二個模組，跟預約系統各自獨立。

- 入口：`/admin/listings`（案源庫）、`/admin/tours`（帶看單）、`/tour/[token]`（買方，免登入）
- 開關：`TOUR_ENABLED`。跟 `BOOKING_ENABLED` **刻意分開**，兩者前提條件不同，不要合併。
- 儲存：Supabase Postgres（`supabase/schema.sql`），不是本機 JSON 檔。
  預約系統仍維持檔案版本，兩套併存是刻意的取捨，不要順手統一。
- 案源可以手動建立，也可以由本機的匯入腳本寫進資料庫。
  匯入腳本不在這個 repo 裡（見 `.gitignore`），也不隨 Vercel 部署。

### 動這個模組之前一定要知道的事

**外部來源的資料一律當成不可信。** 對方限速或改版時，回來的可能不是錯誤碼，
而是看起來正常的錯誤數值。因此有一道「資料合理性閘門」
（`src/lib/listings.ts` 的 `checkListingSanity`），沒過的標成 `needs_review`，
**永遠不會出現在買方頁**。`addTourItems` 與買方頁各擋一次，兩道都要留著，不要合併成一道。

`crawl_runs` 資料表與 `crawlerLooksBroken()` 是用來讓「匯入已經悄悄失效」這件事
在後台變成紅字，而不是讓人繼續拿舊資料去跟客戶談。

新增任何 `/api` 或 `/admin` 路由時，必須到 `src/middleware.ts` 的 `featureOf()` 登記，
沒登記的路徑會被當成未知路徑直接 404（fail closed）。

### 安全邊界（補充）

- `SUPABASE_SERVICE_ROLE_KEY` 可繞過所有資料表權限，只能存在 `.env.local` 或 Vercel 環境變數，
  絕不可出現在任何 `"use client"` 檔案。`src/lib/db.ts` 開頭的 `import "server-only"` 就是在擋這件事。
- 不把外部來源的圖片轉存到自己的網域，只存網址並連回原始刊登頁。
- 買方連結（`/tour/[token]`）內容屬於個資：`robots.ts` 與頁面 metadata 兩層都要保持 noindex。
