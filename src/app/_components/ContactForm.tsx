"use client";

import { useState } from "react";
import { PROFILE } from "@/lib/profile";

const SERVICES = ["買屋", "賣屋", "資產配置", "稅務諮詢", "簡易裝潢", "其他"] as const;
const TIME_SLOTS = ["不限", "上午 (09-12)", "下午 (12-18)", "晚上 (18-21)"] as const;

/**
 * 客戶預約表單。
 *
 * 刻意不送到伺服器：目前沒有資料庫，寫入雲端會遺失。
 * 改為在瀏覽器把內容組成訊息後開啟 LINE，客戶按送出即可傳給我，
 * 資料不經過第三方，也不會有「顯示成功但實際沒收到」的情況。
 */
export default function ContactForm() {
  const [service, setService] = useState<string>(SERVICES[0]);
  const [timeSlot, setTimeSlot] = useState<string>(TIME_SLOTS[0]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    const lines = [
      `您好，我想預約諮詢：`,
      `姓名：${name}`,
      `電話：${phone}`,
      `諮詢服務：${service}`,
      `方便聯絡時段：${timeSlot}`
    ];
    if (message) lines.push(`需求說明：${message}`);

    // 開啟 LINE 並帶入已填好的內容，客戶按傳送即可。
    window.open(
      `https://line.me/R/msg/text/?${encodeURIComponent(lines.join("\n"))}`,
      "_blank",
      "noopener,noreferrer"
    );
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

      <button type="submit" className="lead-submit">送出預約</button>

      <p className="lead-note">
        送出後會開啟 LINE 並帶入您填寫的內容，按傳送即可；
        急件請直接<a href={`tel:${PROFILE.phoneRaw}`}>來電 {PROFILE.phone}</a>，回覆最快。
      </p>
    </form>
  );
}
