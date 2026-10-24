"use client";

import { useState } from "react";
import { PROFILE } from "@/lib/profile";

const SERVICES = ["買屋", "賣屋", "資產配置", "稅務諮詢", "簡易裝潢", "其他"] as const;
const TIME_SLOTS = ["不限", "上午 (09-12)", "下午 (12-18)", "晚上 (18-21)"] as const;

/**
 * 客戶預約表單。
 *
 * 流程刻意設計成「先複製、再加好友」：
 * 新客戶通常還沒加過好友，若直接開啟 LINE 傳訊畫面，
 * 聯絡人名單裡找不到收件者，訊息根本送不出去。
 * 因此改為把填寫內容複製到剪貼簿後開啟加好友頁面，
 * 客戶加完好友貼上即可送出。
 *
 * 2026-08 補上：同時送一份到 /api/lead 存進資料庫。
 *
 * 為什麼補這個 —— 原本只有「複製 + 開 LINE」，客戶如果填完就關掉、
 * 或懶得加好友，那筆資料就永遠消失，後台完全不知道有人來過。
 * 現在畫面上的體驗一模一樣，但你在後台的來客名單看得到每一筆。
 *
 * ⚠️ 送出資料庫這件事「絕對不能擋住」客戶的流程：
 * 網路慢、資料庫掛掉、離線都不該讓客戶看到錯誤或等待。
 * 所以下面是先把請求丟出去（不 await），再照原本的步驟走完。
 */
export default function ContactForm() {
  const [service, setService] = useState<string>(SERVICES[0]);
  const [timeSlot, setTimeSlot] = useState<string>(TIME_SLOTS[0]);
  const [summary, setSummary] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    // 先丟出去，不等回應。失敗也只寫進主控台，客戶那邊完全無感。
    void fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        service,
        timeSlot,
        message,
        website: String(data.get("website") ?? "") // 蜜罐，真人不會填
      }),
      keepalive: true // 客戶送出後馬上跳去 LINE，用這個讓請求在頁面離開後仍送得完
    }).catch(() => {
      /* 這裡刻意吞掉：客戶的下一步是加 LINE，不該因為我們的後台狀況被打斷。 */
    });

    const lines = [
      "您好，我想預約諮詢：",
      `姓名：${name}`,
      `電話：${phone}`,
      `諮詢服務：${service}`,
      `方便聯絡時段：${timeSlot}`
    ];
    if (message) lines.push(`需求說明：${message}`);
    const text = lines.join("\n");

    setSummary(text);

    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // 瀏覽器擋下剪貼簿時，下方仍會顯示內容讓客戶自行複製。
      ok = false;
    }
    setCopied(ok);

    window.open(PROFILE.social.line, "_blank", "noopener,noreferrer");
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit}>
      <div className="lead-row">
        <label htmlFor="lead-name">
          姓名 <span aria-hidden="true">*</span>
        </label>
        <input id="lead-name" name="name" type="text" placeholder="請輸入您的姓名" required />
      </div>

      <div className="lead-row">
        <label htmlFor="lead-phone">
          聯絡電話 <span aria-hidden="true">*</span>
        </label>
        <input
          id="lead-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="09xx-xxx-xxx"
          pattern="[0-9\-+() ]{8,20}"
          title="請輸入可聯絡到您的電話號碼"
          required
        />
      </div>

      <div className="lead-grid">
        <div className="lead-row">
          <label htmlFor="lead-service">想諮詢的服務</label>
          <select
            id="lead-service"
            name="service"
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            {SERVICES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="lead-row">
          <label htmlFor="lead-time">方便聯絡時段</label>
          <select
            id="lead-time"
            name="timeSlot"
            value={timeSlot}
            onChange={(e) => setTimeSlot(e.target.value)}
          >
            {TIME_SLOTS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="lead-row">
        <label htmlFor="lead-message">想說的話</label>
        <textarea
          id="lead-message"
          name="message"
          rows={4}
          placeholder="例如：想看東橋重劃區三房、預算 1200 萬內（選填）"
        />
      </div>

      {/* 蜜罐：真人看不到也不會填，自動填表的機器人會。中了就在伺服器端丟掉。
          用 CSS 藏起來而不是 type="hidden"，因為機器人多半會跳過 hidden。 */}
      <div className="lead-trap" aria-hidden="true">
        <label htmlFor="lead-website">網站</label>
        <input id="lead-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button type="submit" className="lead-submit">送出預約</button>

      {summary && (
        <div className="lead-result" role="status">
          <p className="lead-result-title">
            {copied ? "✅ 已複製您的資料，LINE 已開啟" : "請複製以下內容，LINE 已開啟"}
          </p>
          <p className="lead-result-step">
            加我好友後，把內容<strong>貼上</strong>傳送即可，我會盡快回覆您。
          </p>
          <pre className="lead-result-text">{summary}</pre>
          <a className="lead-result-link" href={PROFILE.social.line} target="_blank" rel="noreferrer">
            沒有自動開啟？點這裡加 LINE 好友
          </a>
        </div>
      )}

      <p className="lead-note">
        急件請直接<a href={`tel:${PROFILE.phoneRaw}`}>來電 {PROFILE.phone}</a>，回覆最快。
      </p>
    </form>
  );
}
