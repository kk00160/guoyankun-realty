"use client";

import { useState } from "react";
import { buyerTourUrl } from "@/lib/buyer-link";

/**
 * 「複製買方連結」放在帶看單這一頁上。
 *
 * 為什麼要放在這裡：實際發生過 —— 阿坤產生帶看單之後，直接複製瀏覽器網址列
 * 傳給買方，買方看到的是要求輸入密碼的畫面。這一頁是 /admin 底下的後台頁，
 * 本來就進不去。
 *
 * 這不是他的錯，是這一頁沒有把「要給買方的是另一條連結」講出來。
 * 所以除了下面那行說明，還直接把正確的連結擺在他手邊。
 */
export default function CopyBuyerLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(buyerTourUrl(token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("瀏覽器不給複製，請手動選取這條連結：", buyerTourUrl(token));
    }
  }

  return (
    <button type="button" className="button" onClick={copy}>
      {copied ? "已複製買方連結" : "複製買方連結"}
    </button>
  );
}
