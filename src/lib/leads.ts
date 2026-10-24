/**
 * 首頁表單留下來的來客。
 *
 * 跟 appointment-store.ts 那套「線上選時段預約」是兩回事，刻意不合併：
 * 那個是客戶挑好時段的預約，這個是「留個資料請你聯絡我」的詢問，
 * 欄位、流程與急迫性都不一樣。
 *
 * 這支檔案沒有任何 I/O，client component 可以直接 import。
 */

import { formatInTaipei } from "@/lib/format-date";

/** new：還沒聯絡　contacted：聯絡過了　done：結案　spam：垃圾 */
export type LeadStatus = "new" | "contacted" | "done" | "spam";

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "待聯絡",
  contacted: "已聯絡",
  done: "結案",
  spam: "垃圾"
};

export const LEAD_STATUSES: readonly LeadStatus[] = ["new", "contacted", "done", "spam"];

export type Lead = {
  id: string;
  name: string;
  phone: string;
  service: string | null;
  timeSlot: string | null;
  message: string | null;
  source: string;
  status: LeadStatus;
  agentNote: string | null;
  createdAt: string;
};

export function toLead(row: Record<string, unknown>): Lead {
  const str = (value: unknown) => (value === null || value === undefined ? null : String(value));

  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    service: str(row.service),
    timeSlot: str(row.time_slot),
    message: str(row.message),
    source: String(row.source ?? "home"),
    status: (LEAD_STATUSES as readonly string[]).includes(String(row.status))
      ? (row.status as LeadStatus)
      : "new",
    agentNote: str(row.agent_note),
    createdAt: String(row.created_at ?? "")
  };
}

/** 來客的時間一律用台北時區顯示，含星期 —— 你要判斷「這是週幾打來的」。 */
export function formatLeadTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return formatInTaipei(date, {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

/**
 * 電話正規化：只留數字與開頭的 +。
 *
 * 存原樣、另外算一份正規化的用來比對重複 ——
 * 同一個人分兩次留 0921-020-851 跟 0921020851，你要看得出來那是同一個人。
 */
export function normalisePhone(phone: string) {
  const trimmed = phone.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}
