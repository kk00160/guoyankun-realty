# 郭彥坤｜台南房仲顧問 個人官網

台南房仲顧問的個人形象網站與線上預約系統，專營東橋重劃區。
以 Next.js 建置，同一套程式同時提供對外形象網站與內部預約管理。

## 頁面

| 路徑 | 用途 | 正式站狀態 |
| --- | --- | --- |
| `/` | 形象網站首頁（服務區域、戰績、服務項目、預約） | 公開 |
| `/card` | 電子名片，適合傳 LINE 或印成 QR Code | 公開 |
| `/card/booking` | 客戶線上選時段預約 | 預設關閉 |
| `/admin/appointments` | 預約管理後台（客戶溫度分級、追蹤建議） | 預設關閉，需密碼 |

## 本機執行

需要 Node.js 20.9 以上。

```bash
npm ci
npm run check
npm run dev
```

開啟 http://localhost:3000

想在本機測試完整預約流程，建立 `.env.local`：

```
BOOKING_ENABLED=true
ADMIN_PASSWORD=自己設一組密碼
```

## 為什麼預約系統預設是關閉的

這不是還沒做完，是刻意的。目前的實作有兩個限制，在正式環境會出問題：

1. **預約資料存在本機 JSON 檔**（`src/lib/appointment-store.ts`）。
   Vercel 等無伺服器平台的檔案系統唯讀且不持久，客戶送出的預約會寫入失敗或消失。
2. **後台雖已加上密碼**，但單一密碼的 HTTP Basic 驗證只適合暫時使用，
   長期仍應改為正式的帳號系統。

因此 `BOOKING_ENABLED` 未設為 `true` 時，預約與後台一律回 404，
形象網站的預約按鈕會自動改導向 LINE。

要正式啟用線上預約，需先把儲存改成雲端資料庫（並用唯一鍵約束避免時段撞號），
再把環境變數打開。

## 修改內容

| 檔案 | 內容 |
| --- | --- |
| `src/lib/profile.ts` | 姓名、電話、Email、LINE、社群連結 |
| `src/lib/site-content.ts` | 首頁的服務區域、戰績、服務項目文案 |
| `src/lib/booking.ts` | 營業時間、開放天數、諮詢需求選項 |
| `src/app/globals.css` | 品牌色（`--brand-green` / `--brand-purple`） |
| `public/guo-yankun-hero.png` | 首頁形象照（去背） |
| `public/card/guo-yankun.jpg` | 名片圓形頭像 |

社群連結留空白就不會顯示在名片上，不會出現點了沒反應的死連結。

## 部署

推上 GitHub 後於 Vercel 匯入即可，不需額外設定。

**不要設定 `BOOKING_ENABLED`**，除非儲存已改為資料庫——
未設定就是安全的關閉狀態。
