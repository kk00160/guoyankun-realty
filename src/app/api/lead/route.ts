import { bad, fail, ok, optionalText, readJson } from "@/lib/api";
import { isDbConfigured } from "@/lib/db";
import { createLead } from "@/lib/lead-store";
import { buildLeadMessage, notifyQuietly } from "@/lib/notify-line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 首頁表單的收件口。公開、不需要密碼。
 *
 * 為什麼需要它：這個表單原本只把內容複製到剪貼簿、開啟 LINE 加好友頁，
 * 客戶如果沒去加好友貼上，那筆資料就永遠消失，後台完全不知道有人來過。
 * 現在照樣複製、照樣開 LINE（那段流程是對的），但同時留一份在這裡。
 *
 * 這支刻意「不」綁功能開關。開關的用途是擋住還不能上線的功能，
 * 但這裡擋住的後果是安靜地掉客戶 —— 那比任何開關能換到的好處都嚴重。
 *
 * 公開寫入的防護：
 *   1. 只收固定幾個欄位，每個都有長度上限
 *   2. 蜜罐欄位（真人看不到、機器人會填）—— 中了就當作成功，不寫進資料庫
 *   3. RLS 全開且無 policy，這支走伺服器端的 service_role，瀏覽器碰不到資料庫
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);

    // 蜜罐。回 ok 是刻意的：讓機器人以為成功了，不要給它偵錯的線索。
    if (optionalText(body.website, 200)) return ok({ saved: true });

    const name = optionalText(body.name, 50);
    const phone = optionalText(body.phone, 30);
    if (!name) return bad("請留下您的姓名。");
    if (!phone) return bad("請留下可以聯絡到您的電話。");

    // 資料庫沒設定時不要丟 500 —— 前端會照樣走完「複製 + 開 LINE」，
    // 客戶不該因為我們後台的狀況看到錯誤。
    if (!isDbConfigured()) {
      console.error("[lead] 資料庫未設定，這筆來客沒有存下來：", name);
      return ok({ saved: false });
    }

    const lead = await createLead({
      name,
      phone,
      service: optionalText(body.service, 40),
      timeSlot: optionalText(body.timeSlot, 40),
      message: optionalText(body.message, 1000),
      source: "home"
    });

    // 通知一定要放在存檔成功之後。
    // 反過來的話，你會收到一則「有新來客」，然後打開後台發現名單裡沒有這個人。
    await notifyQuietly("新來客", buildLeadMessage(lead));

    return ok({ saved: true, id: lead.id });
  } catch (error) {
    return fail("lead", error);
  }
}
