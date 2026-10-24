/**
 * 線上預約的型別與純函式。
 *
 * 跟 leads.ts 一樣的分層：這支沒有任何 I/O，client component 可以直接 import；
 * 真正碰資料庫的都在 appointment-store.ts（那支是 server-only）。
 */

export type AppointmentStatus = "confirmed" | "completed" | "cancelled";

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  confirmed: "已預約",
  completed: "已完成",
  cancelled: "已取消"
};

export type Appointment = {
  id: string;
  /** 人看得懂的案件編號，例：AP-260809-01 */
  caseNo: string;
  name: string;
  phone: string;
  email: string;
  lineId: string | null;
  meetType: string;
  intent: string[];
  urgency: string | null;
  note: string;
  /** 預約開始時間（ISO，UTC） */
  slotIso: string;
  /** 這筆約多久 */
  durationMin: number;
  status: AppointmentStatus;
  /** Google 日曆上的事件 id。沒綁日曆時為 null，預約照樣成立。 */
  googleEventId: string | null;
  source: string;
  agentNote: string | null;
  createdAt: string;

  /** 以下是既有後台在用的判讀欄位，由 grading.ts 算出來後一起帶回畫面。 */
  aiHeat: "high" | "mid" | "low";
  aiSuggestion: string;
  aiSummary: string;
  aiNextAction: string;
};

/** 資料庫的一列 → 畫面用的物件。 */
export function toAppointment(
  row: Record<string, unknown>,
  grade?: { heat: "high" | "mid" | "low"; suggestion: string; summary: string; nextAction: string }
): Appointment {
  const str = (value: unknown) => (value === null || value === undefined ? null : String(value));
  const intent = Array.isArray(row.intent) ? (row.intent as unknown[]).map(String) : [];

  return {
    id: String(row.id),
    caseNo: String(row.case_no ?? ""),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    lineId: str(row.line_id),
    meetType: String(row.meet_type ?? "office"),
    intent,
    urgency: str(row.urgency),
    note: String(row.note ?? ""),
    slotIso: new Date(String(row.slot_at)).toISOString(),
    // 長度由起訖時間算，不另存一欄，免得兩者對不起來。
    durationMin: Math.round(
      (new Date(String(row.slot_end)).getTime() - new Date(String(row.slot_at)).getTime()) / 60_000
    ),
    status: (String(row.status ?? "confirmed") as AppointmentStatus),
    googleEventId: str(row.google_event_id),
    source: String(row.source ?? "card"),
    agentNote: str(row.agent_note),
    createdAt: new Date(String(row.created_at)).toISOString(),

    aiHeat: grade?.heat ?? "low",
    aiSuggestion: grade?.suggestion ?? "",
    aiSummary: grade?.summary ?? "",
    aiNextAction: grade?.nextAction ?? ""
  };
}

/** 這個時段剛剛被別人訂走了。 */
export class SlotConflictError extends Error {
  constructor() {
    super("這個時段剛剛被預約，請重新選擇。");
    this.name = "SlotConflictError";
  }
}

/**
 * 日曆查不到時擋下預約用的錯誤。
 *
 * 為什麼要擋而不是放行：這時候「不知道你有沒有空」。
 * 硬寫下去的代價是你同時答應兩個客戶，比請對方重試一次嚴重得多。
 */
export class CalendarUnavailableError extends Error {
  constructor() {
    super("目前無法確認行事曆空檔，請稍後再試一次。");
    this.name = "CalendarUnavailableError";
  }
}
