"use client";

import { useState } from "react";
import { buyerPlanUrl } from "@/lib/buyer-link";

/**
 * 「複製行程連結」放在帶看單這一頁上。
 *
 * 為什麼要放在這裡：實際發生過 —— 阿坤產生帶看單之後，直接複製瀏覽器網址列
 * 傳給買方，買方看到的是要求輸入密碼的畫面。這一頁是 /admin 底下的後台頁，
 * 本來就進不去。
 *
 * 這不是他的錯，是這一頁沒有把「要給買方的是另一條連結」講出來。
 * 所以除了下面那行說明，還直接把正確的連結擺在他手邊。
 *
 * ⚠️ 這裡複製的是 /tour/[token]/plan（行程），不是 /tour/[token]（挑選）。
 * 走到帶看單這一步代表要看哪幾間已經定了，這時候把挑選頁傳出去，
 * 等於請客人重新回答一個已經談完的問題。挑選連結在帶看日記那一頁。
 */
export default function CopyBuyerLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(buyerPlanUrl(token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("瀏覽器不給複製，請手動選取這條連結：", buyerPlanUrl(token));
    }
  }

  return (
    <button type="button" className="button" onClick={copy}>
      {copied ? "已複製行程連結" : "複製行程連結（給買方）"}
    </button>
  );
}
