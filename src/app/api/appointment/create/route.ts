import { NextResponse } from "next/server";
import {
  INTENT_KEYS,
  MEET_TYPE_KEYS,
  URGENCY_KEYS,
  formatSlotTaipei,
  isValidSlot,
  meetDuration
} from "@/lib/booking";
import { CalendarUnavailableError, SlotConflictError, createAppointment } from "@/lib/appointment-store";
import { buildAppointmentMessage, notifyQuietly } from "@/lib/notify-line";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const meetType = String(body.meetType || "").trim();
    const urgency = String(body.urgency || "").trim();
    const note = String(body.note || "").trim();
    const slotIso = String(body.slotIso || "").trim();
    const intent = Array.isArray(body.intent) ? body.intent.map(String) : [];

    if (!name || name.length > 80) return bad("請填寫姓名。");
    if (!/^[0-9+() -]{8,20}$/.test(phone)) return bad("電話格式看起來不正確。");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return bad("Email 格式看起來不正確。");
    if (!MEET_TYPE_KEYS.includes(meetType)) return bad("請選擇見面方式。");
    if (!intent.length || !intent.every((key: string) => INTENT_KEYS.includes(key))) return bad("請至少選擇一個需求。");
    if (!URGENCY_KEYS.includes(urgency)) return bad("請選擇預計處理時間。");
    if (!note || note.length > 2000) return bad("請填寫需求說明。");
    // 時段長度跟著見面方式走，不能讓前端自己送一個長度上來。
    if (!isValidSlot(slotIso, meetDuration(meetType))) return bad("這個時段目前不能預約，請重新選擇。");

    const appointment = await createAppointment({
      name,
      phone,
      email,
      meetType,
      urgency,
      intent,
      note,
      slotIso,
      source: "card"
    });

    // 預約已經寫進去了，接下來這則只是通知。它失敗不能影響客戶看到的結果 ——
    // 客戶那邊時段已經被佔走，卻收到錯誤訊息去重按一次，就會撞到 SlotConflict。
    await notifyQuietly("新預約", buildAppointmentMessage(appointment));

    return NextResponse.json({
      ok: true,
      id: appointment.id,
      caseNo: appointment.caseNo,
      slotLabel: formatSlotTaipei(appointment.slotIso, appointment.durationMin)
    });
  } catch (error) {
    if (error instanceof SlotConflictError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    // 日曆問不到 ≠ 有空。寧可請客戶重試，也不要讓你同時答應兩個人。
    if (error instanceof CalendarUnavailableError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }
    console.error("[create]", error);
    return NextResponse.json({ ok: false, error: "系統忙碌，請稍後重試。" }, { status: 500 });
  }
}
