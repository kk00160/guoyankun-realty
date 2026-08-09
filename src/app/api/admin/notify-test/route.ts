import { bad, fail, ok } from "@/lib/api";
import { isLineConfigured, pushLine } from "@/lib/notify-line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 送一則測試訊息到你的 LINE。
 *
 * 為什麼需要這支：LINE 通知壞掉的症狀是「什麼都沒發生」。
 * 權杖打錯、userId 貼錯、Vercel 的環境變數沒真的存進去 —— 三種原因，同一個症狀。
 * 沒有這顆按鈕的話，第一次發現是在你錯過一位真的買方之後。
 * （ADMIN_PASSWORD 就在 Vercel 上發生過一次「看起來存好了、其實沒有」。）
 *
 * 這支刻意把 LINE 回的原始錯誤原樣吐回畫面。這是只有你看得到的後台，
 * 而「LINE 回 401」跟「LINE 回 400 invalid to」要修的地方完全不一樣。
 */
export async function POST() {
  try {
    if (!isLineConfigured()) {
      return bad(
        "這台伺服器上還沒有 LINE 的設定。要設兩個環境變數：LINE_CHANNEL_ACCESS_TOKEN 與 LINE_NOTIFY_TO，" +
          "本機放 .env.local、正式站放 Vercel 的 Environment Variables，兩邊都要，設完要重新部署。"
      );
    }

    const now = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
    const result = await pushLine(
      `✅ 測試訊息\n\n看得到這則，代表買方挑完物件時你就會收到通知。\n\n（${now} 從後台送出）`
    );

    if (!result.ok) return bad(`送不出去：${result.reason}`);
    return ok({ sent: true });
  } catch (error) {
    return fail("admin/notify-test", error);
  }
}
