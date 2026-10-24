import "server-only";
import { db } from "@/lib/db";
import type { AppointmentUpdate } from "@/lib/db-schema";
import { casePrefix, formatCaseNo, parseCaseSeq } from "@/lib/appointment-case-number";
import {
  type Appointment,
  type AppointmentStatus,
  CalendarUnavailableError,
  SlotConflictError,
  toAppointment
} from "@/lib/appointments";
import { type BusyRange, meetDuration, meetTypeLabel, intentLabel, urgencyLabel } from "@/lib/booking";
import { gradeLead } from "@/lib/grading";
import {
  GoogleCalendarUnavailableError,
  createCalendarEvent,
  deleteCalendarEvent,
  getBusyRanges,
  getBusyRangesStrict,
  getCalendarDisplaySettings,
  isGoogleConfigured
} from "@/lib/google-calendar";
import { PROFILE } from "@/lib/profile";

/**
 * 線上預約的資料存取層。
 *
 * ⚠️ 這兩張表要先建立：到 Supabase 的 SQL Editor 跑一次
 *    supabase/2026-08-09-appointments-google-calendar.sql。
 *
 * 為什麼從 data/appointments.json 換過來：
 * Vercel 的檔案系統唯讀且不持久，客戶送出的預約會直接消失。
 * 舊版還有一個更隱蔽的問題 —— 用行程內的鎖擋撞號，
 * 但無伺服器環境下兩個客戶可能落在不同機器，兩邊都以為時段是空的。
 * 現在改由資料庫的 exclude 約束擋，跨機器一樣有效。
 */

export { SlotConflictError, CalendarUnavailableError };
export type { Appointment, AppointmentStatus };

/** 表還沒建的時候，Postgres 回的是英文技術訊息。換成一句知道要做什麼的話。 */
function appointmentError(what: string, message: string) {
  if (
    /appointments/i.test(message) &&
    /(does not exist|could not find|schema cache|relation)/i.test(message)
  ) {
    return new Error(
      "資料庫還沒有 appointments 這張表。" +
        "到 Supabase 的 SQL Editor 跑一次 supabase/2026-08-09-appointments-google-calendar.sql 就會好。"
    );
  }
  return new Error(`${what}失敗：${message}`);
}

/** Postgres 的重疊排除與唯一鍵違反。 */
function isOverlapViolation(message: string) {
  return /appointments_no_overlap|exclusion constraint|conflicting key value/i.test(message);
}
function isCaseNoViolation(message: string) {
  return /case_no/i.test(message) && /duplicate|unique/i.test(message);
}

function withGrade(row: Record<string, unknown>): Appointment {
  const intent = Array.isArray(row.intent) ? (row.intent as unknown[]).map(String) : [];
  const grade = gradeLead(intent, (row.urgency as string) ?? null, String(row.note ?? ""));
  return toAppointment(row, grade);
}

// ---------- 讀 ----------

export async function listAppointments(status = "all"): Promise<Appointment[]> {
  let query = db().from("appointments").select("*").order("slot_at", { ascending: true });
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw appointmentError("讀取預約", error.message);
  return (data ?? []).map((row) => withGrade(row as Record<string, unknown>));
}

export async function readAppointments(): Promise<Appointment[]> {
  return listAppointments("all");
}

export async function getAppointment(id: string): Promise<Appointment | null> {
  const { data, error } = await db().from("appointments").select("*").eq("id", id).maybeSingle();
  if (error) throw appointmentError("讀取預約", error.message);
  return data ? withGrade(data as Record<string, unknown>) : null;
}

/**
 * 未來這段期間「已經有事」的時間，給前台算空檔用。
 *
 * 兩個來源合併：資料庫裡已成立的預約，以及 Google 日曆上你自己排的行程。
 * 日曆查不到時只會少擋一些格子（寬鬆版），最後送出前還會再嚴格檢查一次。
 */
export async function busyRanges(fromIso: string, toIso: string): Promise<BusyRange[]> {
  const { data, error } = await db()
    .from("appointments")
    .select("slot_at, slot_end")
    .eq("status", "confirmed")
    .gte("slot_at", fromIso)
    .lte("slot_at", toIso);

  if (error) throw appointmentError("讀取已預約時段", error.message);

  const fromDb: BusyRange[] = (data ?? []).map((row) => ({
    start: new Date(String((row as Record<string, unknown>).slot_at)).getTime(),
    end: new Date(String((row as Record<string, unknown>).slot_end)).getTime()
  }));

  const fromCalendar = await getBusyRanges(fromIso, toIso);
  return [...fromDb, ...fromCalendar.map(({ start, end }) => ({ start, end }))];
}

// ---------- 寫 ----------

export type CreateAppointmentInput = {
  name: string;
  phone: string;
  email: string;
  lineId?: string | null;
  meetType: string;
  intent: string[];
  urgency: string | null;
  note: string;
  slotIso: string;
  source?: string;
};

/**
 * 配一個當天的流水號。
 *
 * 靠 case_no 的唯一約束擋併發：兩個人同時拿到 03，第二個會被資料庫退回，
 * 呼叫端重試一次就會拿到 04。不需要另外開序號表或加鎖。
 */
async function nextCaseNo(now: Date): Promise<string> {
  const prefix = casePrefix(now);
  const { data, error } = await db()
    .from("appointments")
    .select("case_no")
    .like("case_no", `${prefix}%`);

  if (error) throw appointmentError("配發案件編號", error.message);

  const maxSeq = (data ?? []).reduce((max, row) => {
    const seq = parseCaseSeq(String((row as Record<string, unknown>).case_no ?? ""), prefix);
    return seq > max ? seq : max;
  }, 0);

  return formatCaseNo(now, maxSeq + 1);
}

export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const durationMin = meetDuration(input.meetType);
  const startMs = new Date(input.slotIso).getTime();
  const endIso = new Date(startMs + durationMin * 60_000).toISOString();

  /**
   * 寫入前的最後一道把關：確認 Google 日曆上這段時間真的是空的。
   *
   * 沒設定 OAuth = 功能沒啟用，直接放行。
   * 但設定了卻查不到，就擋下來 —— 這時候「不知道你有沒有空」，
   * 硬寫的代價是你同時答應兩個人。
   */
  try {
    const busy = await getBusyRangesStrict(input.slotIso, endIso);
    if (busy.some((range) => startMs < range.end && startMs + durationMin * 60_000 > range.start)) {
      throw new SlotConflictError();
    }
  } catch (error) {
    if (error instanceof GoogleCalendarUnavailableError) throw new CalendarUnavailableError();
    throw error;
  }

  // 案件編號撞號時重試。三次還撞代表當天量大到不正常，讓它往上拋。
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const now = new Date();
    const caseNo = await nextCaseNo(now);

    const { data, error } = await db()
      .from("appointments")
      .insert({
        case_no: caseNo,
        name: input.name,
        phone: input.phone,
        email: input.email,
        line_id: input.lineId ?? null,
        meet_type: input.meetType,
        intent: input.intent,
        urgency: input.urgency,
        note: input.note,
        slot_at: input.slotIso,
        slot_end: endIso,
        source: input.source ?? "card"
      })
      .select("*")
      .single();

    if (!error) {
      const appointment = withGrade(data as Record<string, unknown>);
      await attachCalendarEvent(appointment);
      return appointment;
    }

    if (isOverlapViolation(error.message)) throw new SlotConflictError();
    if (isCaseNoViolation(error.message)) {
      lastError = error;
      continue; // 換一個號碼再試
    }
    throw appointmentError("建立預約", error.message);
  }

  throw appointmentError("建立預約", String((lastError as { message?: string })?.message ?? "案件編號重複"));
}

/**
 * 把預約寫進 Google 日曆。
 *
 * 失敗不能讓整筆預約失敗 —— 客戶那邊時段已經佔走了，
 * 這時候回錯誤只會讓他重按一次，然後撞到自己剛剛建立的預約。
 * 所以這裡只記錄，不往外拋。
 */
async function attachCalendarEvent(appointment: Appointment): Promise<void> {
  if (!isGoogleConfigured()) return;

  try {
    const { titleTemplate } = await getCalendarDisplaySettings();
    const serviceText = appointment.intent.map(intentLabel).join("、") || "諮詢";
    const summary = titleTemplate
      .replace(/\{name\}/g, appointment.name)
      .replace(/\{service\}/g, serviceText)
      .replace(/\{caseNo\}/g, appointment.caseNo);

    const endIso = new Date(
      new Date(appointment.slotIso).getTime() + appointment.durationMin * 60_000
    ).toISOString();

    const description = [
      `案件編號：${appointment.caseNo}`,
      `姓名：${appointment.name}`,
      `電話：${appointment.phone}`,
      appointment.email ? `Email：${appointment.email}` : null,
      `見面方式：${meetTypeLabel(appointment.meetType)}`,
      `想談：${serviceText}`,
      `急迫程度：${urgencyLabel(appointment.urgency)}`,
      "",
      appointment.note
    ]
      .filter((line) => line !== null)
      .join("\n");

    const event = await createCalendarEvent({
      summary,
      description,
      startIso: appointment.slotIso,
      endIso,
      withMeet: appointment.meetType === "video",
      location: appointment.meetType === "office" ? PROFILE.address : null
    });

    if (event?.eventId) {
      await db()
        .from("appointments")
        .update({ google_event_id: event.eventId, updated_at: new Date().toISOString() })
        .eq("id", appointment.id);
      appointment.googleEventId = event.eventId;
    }
  } catch (error) {
    console.error("[appointment] 寫入 Google 日曆失敗（預約仍然成立）:", error);
  }
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<Appointment | null> {
  const existing = await getAppointment(id);
  if (!existing) return null;

  const patch: AppointmentUpdate = { status, updated_at: new Date().toISOString() };
  if (status === "cancelled") patch.cancelled_at = new Date().toISOString();

  const { data, error } = await db()
    .from("appointments")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw appointmentError("更新預約狀態", error.message);

  // 取消時把日曆上的事件一併刪掉，否則時段會一直被佔著。
  if (status === "cancelled" && existing.googleEventId) {
    await deleteCalendarEvent(existing.googleEventId);
  }

  return withGrade(data as Record<string, unknown>);
}

export async function setAgentNote(id: string, note: string): Promise<void> {
  const { error } = await db()
    .from("appointments")
    .update({ agent_note: note, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw appointmentError("更新備註", error.message);
}
