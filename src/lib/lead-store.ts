import "server-only";
import { db, readWithRetry } from "@/lib/db";
import type { LeadUpdate } from "@/lib/db-schema";
import { type Lead, type LeadStatus, toLead } from "@/lib/leads";

/**
 * 來客名單的資料存取層。
 *
 * ⚠️ 這張表要先建立：到 Supabase 的 SQL Editor 跑一次
 *    supabase/2026-08-07-times-and-leads.sql。
 */

/** 表還沒建的時候，Postgres 回的是英文技術訊息。換成一句知道要做什麼的話。 */
function leadError(what: string, message: string) {
  if (/leads/i.test(message) && /(does not exist|could not find|schema cache|relation)/i.test(message)) {
    return new Error(
      "資料庫還沒有 leads 這張表。" +
        "到 Supabase 的 SQL Editor 跑一次 supabase/2026-08-07-times-and-leads.sql 就會好。"
    );
  }
  return new Error(`${what}失敗：${message}`);
}

export type LeadInput = {
  name: string;
  phone: string;
  service?: string | null;
  timeSlot?: string | null;
  message?: string | null;
  source?: string;
};

export async function createLead(input: LeadInput): Promise<Lead> {
  const { data, error } = await db()
    .from("leads")
    .insert({
      name: input.name,
      phone: input.phone,
      service: input.service ?? null,
      time_slot: input.timeSlot ?? null,
      message: input.message ?? null,
      source: input.source ?? "home"
    })
    .select("*")
    .single();

  if (error) throw leadError("寫入來客", error.message);
  return toLead(data as Record<string, unknown>);
}

export async function listLeads(status: LeadStatus | "all" = "all"): Promise<Lead[]> {
  const rows = await readWithRetry<Record<string, unknown>[]>(
    () => {
      const query = db().from("leads").select("*").order("created_at", { ascending: false }).limit(500);
      return status === "all" ? query : query.eq("status", status);
    },
    "讀取來客名單"
  );
  return rows.map((row) => toLead(row));
}

/** 控台首頁用。head + count 只問數字不搬資料。 */
export async function countLeads(status?: LeadStatus): Promise<number> {
  const { count, error } = await (status
    ? db().from("leads").select("*", { count: "exact", head: true }).eq("status", status)
    : db().from("leads").select("*", { count: "exact", head: true }));

  if (error) throw leadError("計算來客數量", error.message);
  return count ?? 0;
}

export async function patchLead(
  id: string,
  patch: { status?: LeadStatus; agentNote?: string | null }
) {
  const row: LeadUpdate = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.agentNote !== undefined) row.agent_note = patch.agentNote;
  if (Object.keys(row).length === 0) return;

  const { error } = await db().from("leads").update(row).eq("id", id);
  if (error) throw leadError("更新來客", error.message);
}

export async function deleteLead(id: string) {
  const { error } = await db().from("leads").delete().eq("id", id);
  if (error) throw leadError("刪除來客", error.message);
}
