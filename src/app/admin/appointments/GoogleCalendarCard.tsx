/**
 * Google 日曆綁定狀態。
 *
 * 為什麼要有這張卡：綁定與否會直接改變預約系統的行為
 * （沒綁 = 只存資料庫；綁了 = 同時擋掉你已排的行程並建立日曆事件），
 * 但這件事在畫面上完全看不出來。沒有這張卡，你只能靠「約了之後日曆有沒有跳出來」猜。
 */

const STATUS_MESSAGE: Record<string, { tone: "ok" | "warn"; text: string }> = {
  ok: { tone: "ok", text: "已完成綁定，之後的預約會自動寫進你的 Google 日曆。" },
  denied: { tone: "warn", text: "授權被取消了，沒有變更任何設定。" },
  bad_state: { tone: "warn", text: "授權連結已失效，請重新按一次綁定。" },
  failed: { tone: "warn", text: "換取授權失敗。確認 Google Cloud 的重新導向網址設定正確後再試一次。" }
};

export default function GoogleCalendarCard({
  configured,
  bound,
  redirectUri,
  notice
}: {
  configured: boolean;
  bound: boolean;
  redirectUri: string;
  notice?: string;
}) {
  const message = notice ? STATUS_MESSAGE[notice] : undefined;

  return (
    <section className="calendar-card">
      <div className="calendar-card-head">
        <h2>Google 日曆</h2>
        <span className={`tag ${bound ? "confirmed" : "cancelled"}`}>
          {bound ? "已連結" : "未連結"}
        </span>
      </div>

      {message ? <p className={`calendar-note ${message.tone}`}>{message.text}</p> : null}

      {!configured ? (
        <>
          <p className="calendar-desc">
            還沒設定 Google OAuth。要先在 Vercel 的環境變數填入
            <code>GOOGLE_CALENDAR_CLIENT_ID</code> 與 <code>GOOGLE_CALENDAR_CLIENT_SECRET</code>，
            這張卡才會出現綁定按鈕。
          </p>
          <p className="calendar-desc">
            Google Cloud Console 的「已授權的重新導向 URI」要填：
            <br />
            <code>{redirectUri}</code>
          </p>
        </>
      ) : bound ? (
        <>
          <p className="calendar-desc">
            客戶預約時會自動避開你日曆上已經有事的時間，成立後也會直接建立一筆行程。
            視訊諮詢還會附上 Google Meet 連結。
          </p>
          <a className="button-secondary" href="/api/appointment/google/auth">重新授權</a>
        </>
      ) : (
        <>
          <p className="calendar-desc">
            還沒連結。現在預約只會存進資料庫，<strong>不會</strong>出現在你的日曆上，
            也不會避開你已經排好的行程。
          </p>
          <a className="button" href="/api/appointment/google/auth">綁定 Google 日曆</a>
        </>
      )}
    </section>
  );
}
