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

## 控台（`/admin`）

所有後台的總入口，2026-08 新增。上面那排分頁在每個後台頁面都看得到。

- 系統名單只有一份：`src/lib/admin-nav.ts` 的 `ADMIN_SYSTEMS`。
  控台首頁的卡片與導覽列的分頁都從它長出來，**新增系統只改這一份**。
- `/admin` 與 `/admin/logout` 在 middleware 裡歸類成 `"console"`，
  **刻意沒有功能開關** —— 控台的職責之一就是在某個系統關著時告訴你它為什麼關著，
  跟著開關一起關掉的話，全部關閉時會連個能看的頁面都沒有。沒有開關不等於沒有防護，
  `/admin` 開頭一律要密碼。
- 登出走 `/admin/logout`，middleware 會在密碼檢查**之前**攔下來一律回 401。
  HTTP Basic 沒有伺服器端的 session 可以清，讓瀏覽器重問一次帳密是唯一可靠的做法。
- 控台首頁的每個數字都各自 try/catch。控台是「進得去別的地方」的那一頁，
  數字讀不到頂多少看幾個數字，不能因此讓整個後台連不進去。

## 買方配案系統（配案 → 買方勾選 → 路線 → 帶看單）

2026-08 新增的第二個模組，跟預約系統各自獨立。

用詞（改過一次，不要改回去）：`/admin/listings` 是**買方配案系統**、
`/admin/tours` 是**帶看日記**、裡面一筆叫**帶看紀錄**、
只有印出來帶出門的那張紙才叫**帶看單**。

- 入口：`/admin/listings`（買方配案系統）、`/admin/tours`（帶看日記）、`/tour/[token]`（買方，免登入）
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

**導航一律走 `src/lib/route.ts` 的 `mapTarget()`，不要改回只認經緯度。**
實測 1,000 筆台南案源：有地址 100%、有社區名 72%、有經緯度只有 1.3% ——
座標要一筆一筆開明細頁才拿得到。只認座標的話，九成九的物件根本按不出導航。
優先序是社區名 → 地址 → 座標，而且每個查詢字串都硬性加「台南市＋行政區」前綴：
純文字搜尋最可怕的失敗是安靜地搜到別縣市的同名建案，加了前綴最差只會落在對的行政區。
同名建案確實存在（實測「宇成植村NY」會回兩筆），所以按鈕旁邊永遠印著該有的路名讓人當場核對，
這行提示不要拿掉。

排順序（`orderRoute`）仍然只吃經緯度，這是刻意的：那是數字，不會被文字比對搞錯。
所以「排不進行車順序」跟「按不出導航」是兩件事，UI 上不要混為一談。

新增任何 `/api` 或 `/admin` 路由時，必須到 `src/middleware.ts` 的 `featureOf()` 登記，
沒登記的路徑會被當成未知路徑直接 404（fail closed）。

### 安全邊界（補充）

- `SUPABASE_SERVICE_ROLE_KEY` 可繞過所有資料表權限，只能存在 `.env.local` 或 Vercel 環境變數，
  絕不可出現在任何 `"use client"` 檔案。`src/lib/db.ts` 開頭的 `import "server-only"` 就是在擋這件事。
- 不把外部來源的圖片轉存到自己的網域，只存網址並連回原始刊登頁。
- 買方連結（`/tour/[token]`）內容屬於個資：`robots.ts` 與頁面 metadata 兩層都要保持 noindex。
