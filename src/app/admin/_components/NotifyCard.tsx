"use client";

import { useState } from "react";

/**
 * 控台上的「訊息通知」狀態卡。
 *
 * 這張卡刻意把「哪幾件事會通知」列出來。原因：通知系統唯一會讓人吃虧的
 * 誤解就是「我以為那個也會通知」—— 而那個誤解不會有任何症狀，
 * 你只會在事後發現有人等了三天。所以會通知的、不會通知的都寫在臉上。
 *
 * `configured` 與 `bookingEnabled` 一定要由 server component 算好傳進來 ——
 * 那些環境變數沒有 NEXT_PUBLIC_ 前綴，瀏覽器裡讀到的是 undefined，
 * 在這裡自己判斷的話會永遠顯示「還沒設定」。
 * （`admin-nav.ts` 的分頁清單踩過同一個坑，見 CLAUDE.md。）
 */
export default function NotifyCard({
  configured,
  bookingEnabled
}: {
  configured: boolean;
  bookingEnabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function test() {
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch("/api/admin/notify-test", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "送不出去");
      setMessage("已送出，去看你的 LINE。沒收到就是官方帳號還沒加好友。");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "送不出去");
    } finally {
      setBusy(false);
    }
  }

  const events = [
    { label: "買方挑完物件送出", detail: "勾了哪幾間、多少錢", on: true },
    { label: "首頁表單留下來客", detail: "姓名、電話、需求", on: true },
    {
      label: "線上預約送出",
      detail: bookingEnabled ? "時段、需求、意願熱度" : "預約系統目前關著，開了就會通",
      on: bookingEnabled
    }
  ];

  return (
    <section className="console-card console-card-wide">
      <header>
        <div>
          <h2>訊息通知</h2>
          <p>站上只要有人找上門，就推一則到你的 LINE（彥坤小幫手）。</p>
        </div>
      </header>

      <ul className="notify-events">
        {events.map((event) => (
          <li key={event.label} data-on={event.on}>
            <b>{event.label}</b>
            <span>{event.detail}</span>
          </li>
        ))}
      </ul>

      {configured ? (
        <>
          <p className="console-note">
            建議偶爾按一次測試 —— 通知壞掉的樣子就是「什麼都沒發生」，平常完全看不出來。
          </p>
          <div className="console-actions">
            <button type="button" className="button" onClick={test} disabled={busy}>
              {busy ? "送出中…" : "送一則測試訊息"}
            </button>
          </div>
        </>
      ) : (
        <p className="console-off">
          <b>還沒設定</b>
          　需要 LINE_CHANNEL_ACCESS_TOKEN 與 LINE_NOTIFY_TO 兩個環境變數。
          本機放 .env.local、正式站放 Vercel，兩邊都要設，設完要重新部署。
        </p>
      )}

      {message && (
        <p className={failed ? "alert-bar" : "console-note"} role={failed ? "alert" : undefined}>
          {message}
        </p>
      )}
    </section>
  );
}
