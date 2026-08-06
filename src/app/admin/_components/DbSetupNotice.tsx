/**
 * 資料庫還沒接上時顯示的說明。
 *
 * 為什麼不直接讓它報錯：帶看系統的第一次設定要去 Supabase 開專案、跑 SQL、複製兩把鑰匙，
 * 中間任何一步漏掉，看到的都會是一個看不懂的 500。與其那樣，不如直接把待辦清單攤開來。
 */
export default function DbSetupNotice({ detail }: { detail?: string }) {
  return (
    <section className="setup-notice">
      <h2>帶看系統還沒接上資料庫</h2>
      <p>照下面四步做完就會通。做完記得重啟開發伺服器，環境變數不會熱更新。</p>

      <ol>
        <li>
          到 <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Supabase</a> 開一個免費專案，
          地區選 <b>Northeast Asia (Tokyo)</b>，離台灣最近。
        </li>
        <li>
          左邊選 <b>SQL Editor</b>，把專案裡 <code>supabase/schema.sql</code> 整份貼上去按 Run。
        </li>
        <li>
          到 <b>Project Settings → API</b>，把 Project URL 和 <b>service_role</b> key 複製出來，
          填進專案根目錄的 <code>.env.local</code>：
          <pre>
{`SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
TOUR_ENABLED=true
ADMIN_PASSWORD=你自己設一組`}
          </pre>
        </li>
        <li>重新啟動 <code>npm run dev</code>。</li>
      </ol>

      <p className="setup-warn">
        service_role key 等於資料庫的萬用鑰匙，只能放 <code>.env.local</code> 或 Vercel 的環境變數，
        不要貼進任何檔案、不要提交進 Git。
      </p>

      {detail && <p className="setup-detail">目前的錯誤訊息：{detail}</p>}
    </section>
  );
}
