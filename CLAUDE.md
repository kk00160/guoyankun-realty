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
