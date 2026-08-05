# 房仲 AI 預約系統

這個 ZIP 是可獨立執行的課堂版專案，包含：

- 房仲電子名片：`/card`
- 客戶線上預約：`/card/booking`
- 預約管理後台：`/admin/appointments`
- 本機 JSON 資料庫
- 時段撞號防護
- 客戶溫度與追蹤建議
- 確認信 HTML 預覽

預設不需要 API key、資料庫或第三方帳號，也不會真的寄信。

## 最簡單的執行方式

### Claude Code

1. 解壓縮 ZIP。
2. 在 Claude Code 開啟 `realtor-ai-booking` 資料夾。
3. 輸入：`請執行`

Claude Code 會依照 `CLAUDE.md` 自動安裝、檢查、建置並啟動。

### Codex

1. 解壓縮 ZIP。
2. 在 Codex 開啟 `realtor-ai-booking` 資料夾。
3. 輸入：`請執行`

Codex 會依照 `AGENTS.md` 自動安裝、檢查、建置並啟動。

## 電腦需求

- Windows 10/11 或 macOS
- Node.js 20.9 以上
- npm 10 以上

Node.js 官方下載：[https://nodejs.org/](https://nodejs.org/)

## 手動執行

```bash
npm ci
npm run check
npm run dev
```

開啟：

- [http://localhost:3000/card](http://localhost:3000/card)
- [http://localhost:3000/card/booking](http://localhost:3000/card/booking)
- [http://localhost:3000/admin/appointments](http://localhost:3000/admin/appointments)

## 修改自己的資料

主要設定集中在：

- `src/lib/profile.ts`：姓名、電話、地址、社群連結
- `src/lib/booking.ts`：營業時間、開放天數、需求選項
- `src/app/globals.css`：品牌色與畫面樣式
- `public/card/abin.jpg`：個人照片

## 資料位置

- 示範資料：`data/appointments.seed.json`
- 執行後資料：`data/appointments.json`
- 信件預覽：`data/outbox/`

後台按「重設示範資料」只會重設本專案內的預約資料。

## 與正式站的差異

這份教材保留正式站的主要流程與操作概念，但刻意拿掉登入、雲端資料庫、Google 日曆、LINE、真實寄信與廣告追蹤，避免學員因外部帳號或金鑰卡住。要正式上線前，應將本機 JSON 換成具唯一鍵約束的資料庫，並補上身分驗證、通知佇列與個資保護。
