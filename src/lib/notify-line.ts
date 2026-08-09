import "server-only";
import type { Appointment } from "@/lib/appointments";
import { intentLabel, meetTypeLabel, formatSlotTaipei, urgencyLabel } from "@/lib/booking";
import type { Lead } from "@/lib/leads";
import { SITE_URL } from "@/lib/site-config";
import { formatPing, formatPrice } from "@/lib/listings";
import type { Tour } from "@/lib/tour";
import type { TourEntry } from "@/lib/tour-store";

/**
 * 訊息通知：站上任何「有人找上門」的事，都推一則到彥坤自己的 LINE。
 *
 * 目前接了三件事，全部走同一條管道（見底下的 notifyQuietly）：
 *   買方挑完物件送出   → buildSubmitMessage
 *   首頁表單留下來客   → buildLeadMessage
 *   線上預約送出       → buildAppointmentMessage
 *
 * 為什麼這三件要通知、別的不要：
 * 它們共同點是「客戶做了動作，而回覆速度直接決定成不成」。
 * 系統自己的事（匯入完成、照片補齊）不推 —— 通知一多就會開始被忽略，
 * 那等於把真正重要的那則也一起關掉了。
 *
 * 為什麼是 Messaging API 而不是 LINE Notify：
 * LINE Notify 已於 2025-03-31 終止服務。網路上大量教學還在教它，
 * 照著做會卡在「申請不到權杖」而不知道是服務收掉了。現在唯一的官方做法是
 * LINE 官方帳號 + Messaging API 的 push message。
 *
 * ⚠️ 這支的所有失敗都不可以往外丟。
 * 呼叫它的地方全部在客戶按送出的那條路上 —— 通知送不出去是你的困擾，
 * 但客戶按了送出卻看到錯誤，是把你的問題變成客戶的問題。
 * 所以一律回傳 { ok:false, reason } 讓呼叫端記 log，絕不 throw。
 */

const PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

/** 官方帳號的 channel access token（LINE Developers → Messaging API）。 */
const CHANNEL_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
/** 要推給誰。彥坤自己的 userId（U 開頭那一串）。 */
const TARGET_USER_ID = process.env.LINE_NOTIFY_TO ?? "";

/** 兩個環境變數都有才算設定完成。少一個就等於沒設定，不要半套。 */
export function isLineConfigured() {
  return CHANNEL_TOKEN.length > 0 && TARGET_USER_ID.length > 0;
}

export type PushResult = { ok: true } | { ok: false; reason: string };

export async function pushLine(text: string): Promise<PushResult> {
  if (!isLineConfigured()) {
    return { ok: false, reason: "還沒設定 LINE_CHANNEL_ACCESS_TOKEN 或 LINE_NOTIFY_TO。" };
  }

  try {
    const response = await fetch(PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CHANNEL_TOKEN}`
      },
      // LINE 單則文字上限 5000 字，留一點餘裕。
      body: JSON.stringify({ to: TARGET_USER_ID, messages: [{ type: "text", text: text.slice(0, 4800) }] }),
      // 買方正在等這個請求回來。LINE 沒回應就放棄，不要讓他盯著「送出中…」。
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) {
      // LINE 的錯誤訊息很具體（權杖過期、userId 不對、額度用完），原樣留下來才查得動。
      const detail = await response.text().catch(() => "");
      return { ok: false, reason: `LINE 回 ${response.status}：${detail.slice(0, 300)}` };
    }

    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "送不出去";
    return { ok: false, reason };
  }
}

/**
 * 所有呼叫端都用這一支，不要自己去接 pushLine。
 *
 * 它把「沒設定就跳過 + try/catch + 記 log」包成一件事 ——
 * 通知是掛在客戶送出那條路上的，任何一個呼叫端漏包 try/catch，
 * 後果就是客戶按了送出看到 500。少一個地方能出錯，就少一次。
 */
export async function notifyQuietly(label: string, text: string) {
  if (!isLineConfigured()) return;
  try {
    const result = await pushLine(text);
    if (!result.ok) console.error(`[LINE] ${label}通知沒送成功：`, result.reason);
  } catch (error) {
    console.error(`[LINE] ${label}通知炸了：`, error);
  }
}

/** 引用客戶自己打的字。太長就截斷，LINE 上一則太長會被摺起來反而看不到重點。 */
function quote(text: string | null, max = 120) {
  const clean = (text ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return null;
  return `「${clean.length > max ? `${clean.slice(0, max)}…` : clean}」`;
}

/**
 * 買方送出時的訊息內容。
 *
 * 寫成「不用點開連結也看得懂」：你可能在開車、在別的帶看現場。
 * 幾間、哪幾間、多少錢，一眼就知道要不要現在處理。
 */
export function buildSubmitMessage(tour: Tour, entries: TourEntry[], isResubmit: boolean) {
  const interested = entries.filter((entry) => entry.buyerChoice === "interested");
  const rejected = entries.filter((entry) => entry.buyerChoice === "rejected");
  const pending = entries.filter((entry) => entry.buyerChoice === "pending");

  const who = tour.buyerName?.trim() || tour.title;
  const head = isResubmit ? `🔁 ${who} 改了選擇（重新送出）` : `🔔 ${who} 挑完了`;

  const lines = [
    head,
    "",
    `想看 ${interested.length} 間　略過 ${rejected.length} 間${pending.length > 0 ? `　沒選 ${pending.length} 間` : ""}`
  ];

  if (interested.length > 0) {
    lines.push("");
    interested.forEach((entry, index) => {
      const listing = entry.listing;
      lines.push(`${index + 1}. ${listing.title}`);
      lines.push(
        `　　${formatPrice(listing.totalPrice)}　${formatPing(listing.ping)}　${listing.district ?? ""}`.trimEnd()
      );
    });
  } else {
    lines.push("");
    lines.push("這次一間都沒勾，可以打給他問問看是哪裡不合。");
  }

  lines.push("");
  lines.push(`排路線：${SITE_URL}/admin/tours/${tour.id}`);

  return lines.join("\n");
}

/**
 * 首頁表單留下來客。
 *
 * 這則是三種通知裡最該立刻看的：對方留了電話在等你回電，
 * 而在有這則之前，你只有打開後台才會發現有人來過。
 * 電話獨立成一行，LINE 會自動變成可以直接撥的連結。
 */
export function buildLeadMessage(lead: Lead) {
  const lines = [`📩 新來客　${lead.name}`, lead.phone, ""];

  const facts = [
    lead.service ? `需求：${lead.service}` : null,
    lead.timeSlot ? `方便時間：${lead.timeSlot}` : null
  ].filter(Boolean) as string[];
  if (facts.length > 0) lines.push(...facts);

  const said = quote(lead.message);
  if (said) lines.push(said);

  lines.push("", `看名單：${SITE_URL}/admin/leads`);
  return lines.join("\n");
}

const HEAT_LABEL: Record<Appointment["aiHeat"], string> = {
  high: "🔥 高意願",
  mid: "🌤 中等",
  low: "❄️ 先了解"
};

/**
 * 線上預約送出。
 *
 * 熱度放在標題那一行：這是唯一一種「已經把時間定下來」的通知，
 * 你要判斷的不是要不要回，是要先準備到什麼程度。
 */
export function buildAppointmentMessage(appointment: Appointment) {
  const lines = [
    `📅 新預約　${HEAT_LABEL[appointment.aiHeat]}`,
    `${appointment.name}　${appointment.phone}`,
    formatSlotTaipei(appointment.slotIso),
    "",
    `方式：${meetTypeLabel(appointment.meetType)}`,
    `需求：${appointment.intent.map(intentLabel).join("、") || "未填"}`,
    `時程：${urgencyLabel(appointment.urgency)}`
  ];

  const said = quote(appointment.note, 150);
  if (said) lines.push(said);

  if (appointment.aiNextAction) lines.push("", `建議：${appointment.aiNextAction}`);

  lines.push("", `看預約：${SITE_URL}/admin/appointments`);
  return lines.join("\n");
}
