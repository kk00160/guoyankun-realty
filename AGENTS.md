# Codex 執行規則

這是一個跨 Windows 與 macOS 的 Next.js 教學專案。

> 這份是給 Codex 的精簡版，只寫「**不能破壞的規則**」。
> 每條規則背後的實測紀錄與理由寫在 `CLAUDE.md`，兩份對不上時**一律以 `CLAUDE.md` 為準**。
> 不要把 `CLAUDE.md` 的內容整段複製過來 —— 兩份同樣長度的文件遲早會各走各的，
> 這份檔案在 2026-08-07 改名之後就漏掉了半年，就是這樣來的。

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

## 用詞（改過一次，不要改回去）

`/admin/listings` 是**買方配案系統**、`/admin/tours` 是**帶看日記**、
裡面一筆叫**帶看紀錄**、**只有印出來帶出門的那張紙才叫帶看單**。

「帶看助手」指的是「配案 + 帶看」整個模組的統稱，底下才分買方配案系統與帶看日記 ——
這個詞還在用，不要連它一起換掉。

寫新程式或新註解時直接用新名字。看到舊名字（案源庫、拿「帶看單」指一筆紀錄）就順手改掉，
但**不要全域搜尋取代**：指那張紙的「帶看單」是對的，改掉就錯了。

## 控台（`/admin`）

所有後台的總入口，2026-08 新增。上面那排分頁在每個後台頁面都看得到。

- 系統名單只有一份：`src/lib/admin-nav.ts` 的 `ADMIN_SYSTEMS`。
  控台首頁的卡片與導覽列的分頁都從它長出來，**新增系統只改這一份**。
- `/admin` 與 `/admin/logout` 在 middleware 裡歸類成 `"console"`，**刻意沒有功能開關** ——
  控台的職責之一就是在某個系統關著時告訴你它為什麼關著。沒有開關不等於沒有防護，
  `/admin` 開頭一律要密碼。
- 登出走 `/admin/logout`，middleware 在密碼檢查**之前**攔下來一律回 401。
  HTTP Basic 沒有伺服器端 session 可清，讓瀏覽器重問一次帳密是唯一可靠的做法。
- 控台首頁的每個數字各自 try/catch。數字讀不到頂多少看幾個數字，
  不能因此讓整個後台連不進去。

**分頁清單一定要在 server component 算好再用 props 傳下去。** `adminTabs()` 讀的是
`TOUR_ENABLED` / `BOOKING_ENABLED`，而 Next.js 只把 `NEXT_PUBLIC_` 開頭的變數送進瀏覽器。
在 client component 裡自己算，畫面會先出現正確的分頁、hydration 之後被抹掉只剩「控台」。
`src/lib/admin-nav.ts` 的 `import "server-only"` 就是在擋這件事。

由此延伸一條驗證規則：**動到 client component 時，只看伺服器吐的 HTML 不算驗過。**
上面那個 bug 的 SSR HTML 完全正確，錯的是瀏覽器接手之後。

## 買方配案系統（配案 → 買方勾選 → 路線 → 帶看單）

2026-08 新增的第二個模組，跟預約系統各自獨立。

- 入口：`/admin/listings`（買方配案系統）、`/admin/tours`（帶看日記）、`/tour/[token]`（買方，免登入）
- 開關：`TOUR_ENABLED`。跟 `BOOKING_ENABLED` **刻意分開**，兩者前提條件不同，不要合併。
- 儲存：Supabase Postgres（`supabase/schema.sql`），不是本機 JSON 檔。
  預約系統仍維持檔案版本，兩套併存是刻意的取捨，不要順手統一。
- 案源可以手動建立，也可以由本機的匯入腳本寫進資料庫。
  匯入腳本不在這個 repo 裡（見 `.gitignore`），也不隨 Vercel 部署。

**買方有兩條連結，同一個 token、不同路徑，不要合併成一條加開關。**

| 路徑 | 從哪裡複製 | 買方看到 | 導航 |
|---|---|---|---|
| `/tour/[token]` | 帶看日記 →「複製挑選連結」 | 想看／略過，請他先挑 | **沒有，刻意的** |
| `/tour/[token]/plan` | 帶看單那一頁 →「複製行程連結」 | 排好的順序＋每一站 | 有 |

挑選頁**不放導航按鈕、也不放通往行程頁的入口**，不要順手補回來。那條連結問的是
「你要不要看這間」，還沒到「怎麼去」；行程連結什麼時候發出去是阿坤決定的。
判斷依據是**他複製了哪一條**，不是任何狀態欄位 ——
做過一版用開關切換，被打回票（忘了設定的後果是已經約好的客人再被問一次「想看嗎」）。

兩邊放哪幾間、什麼順序，一律走 `src/lib/tour-plan.ts` 的 `pickPlanEntries()`。
手上那張紙的第三站跟買方手機上的第三站不是同一間，是帶看當場最沒辦法補救的錯。

### 動這個模組之前一定要知道的事

**外部來源的資料一律當成不可信。** 對方限速或改版時，回來的可能不是錯誤碼，
而是看起來正常的錯誤數值。因此有一道「資料合理性閘門」
（`src/lib/listings.ts` 的 `checkListingSanity`），沒過的標成 `needs_review`，
**永遠不會出現在買方頁**。`addTourItems` 與買方頁各擋一次，兩道都要留著，不要合併成一道。

`crawl_runs` 資料表與 `crawlerLooksBroken()` 是用來讓「匯入已經悄悄失效」這件事
在後台變成紅字，而不是讓人繼續拿舊資料去跟客戶談。

**Supabase 的 count 查詢回 null 一定要當成錯誤，不可以當成 0。**
對不存在的資料表下 `count` 查詢，PostgREST 回 HTTP 204、`count = null`、`error = null`，
跟「表存在但是空的」分不出來。寫成 `count ?? 0` 的話，控台會很有自信地顯示「0 筆」，
而真相是表根本還沒建。`readCount()` 與 `countLeads()` 已經擋掉，不要改回去。

**導航一律走 `src/lib/route.ts` 的 `mapTarget()`，不要改回只認經緯度。**
實測 1,000 筆台南案源：有地址 100%、有社區名 72%、**有經緯度只有 1.3%** ——
只認座標的話九成九的物件按不出導航。優先序是社區名 → 地址 → 座標，
而且每個查詢字串硬性加「台南市＋行政區」前綴：純文字搜尋最可怕的失敗是
安靜地搜到別縣市的同名建案，加了前綴最差只會落在對的行政區。

排順序（`orderRoute`）仍然只吃經緯度，這是刻意的：那是數字，不會被文字比對搞錯。
所以「排不進行車順序」跟「按不出導航」是兩件事，UI 上不要混為一談。

**看房順序有兩個來源，但只有一支寫入函式：`saveVisitOrder()`。**
自動排路線與後台手動上下箭頭都打 `POST /api/admin/tours/[id]/order`。
不要為手動排序另開一支 API —— 兩套寫入規則遲早會對不起來。
函式裡有三件事不要拿掉：① 先讀一次現有 item 對照（upsert 碰到不屬於這筆帶看紀錄的
`listing_id` 會**新增**一筆，等於憑空塞一間房子進去）；② 沒排進這次順序的站號清成 null；
③ 一筆都對不上時直接 return。

**日期時間一律用 `src/lib/format-date.ts` 的 `formatInTaipei()`，不要直接叫 `Intl.DateTimeFormat`。**
Node 的 ICU 在日期與時間之間放 U+2009 細空格、Chrome 放一般空格 —— 肉眼一模一樣、
位元組不同，於是每個顯示日期時間的頁面都 hydration 失敗。

新增任何 `/api` 或 `/admin` 路由時，必須到 `src/middleware.ts` 的 `featureOf()` 登記，
沒登記的路徑會被當成未知路徑直接 404（fail closed）。

### 安全邊界（補充）

- `SUPABASE_SERVICE_ROLE_KEY` 可繞過所有資料表權限，只能存在 `.env.local` 或 Vercel 環境變數，
  絕不可出現在任何 `"use client"` 檔案。`src/lib/db.ts` 開頭的 `import "server-only"` 就是在擋這件事。
- 不把外部來源的圖片轉存到自己的網域，只存網址並連回原始刊登頁。
- 買方連結（`/tour/[token]`）內容屬於個資：`robots.ts` 與頁面 metadata 兩層都要保持 noindex。
