import "server-only";
import { db } from "@/lib/db";

/**
 * 預約系統的設定（key-value）。
 *
 * 為什麼不用環境變數：
 * - Google refresh token 是「你在後台按下授權」當下才拿到的，不可能事先寫進 Vercel。
 * - 日曆標題樣板是你會想隨時改的東西，改一次就要重新部署太麻煩。
 *
 * 對應的表在 supabase/2026-08-09-appointments-google-calendar.sql。
 */

export const CONFIG_KEYS = {
  googleRefreshToken: "google_refresh_token",
  googleCalendarId: "google_calendar_id",
  calendarTitleTemplate: "calendar_title_template",
  calendarColorId: "calendar_color_id"
} as const;

/** 表還沒建的時候，Postgres 回的是英文技術訊息。換成一句知道要做什麼的話。 */
function configError(what: string, message: string) {
  if (
    /appointment_config/i.test(message) &&
    /(does not exist|could not find|schema cache|relation)/i.test(message)
  ) {
    return new Error(
      "資料庫還沒有 appointment_config 這張表。" +
        "到 Supabase 的 SQL Editor 跑一次 supabase/2026-08-09-appointments-google-calendar.sql 就會好。"
    );
  }
  return new Error(`${what}失敗：${message}`);
}

export async function getConfig(key: string): Promise<string | null> {
  const { data, error } = await db()
    .from("appointment_config")
    .select("v")
    .eq("k", key)
    .maybeSingle();

  if (error) throw configError("讀取預約設定", error.message);
  return (data?.v as string | null) ?? null;
}

export async function setConfig(key: string, value: string | null): Promise<void> {
  const { error } = await db()
    .from("appointment_config")
    .upsert({ k: key, v: value, updated_at: new Date().toISOString() }, { onConflict: "k" });

  if (error) throw configError("寫入預約設定", error.message);
}

/**
 * 一次讀多筆，少跑幾趟資料庫。
 * 讀不到的 key 不會出現在回傳的 Map 裡。
 */
export async function getConfigMany(keys: string[]): Promise<Map<string, string>> {
  const { data, error } = await db()
    .from("appointment_config")
    .select("k, v")
    .in("k", keys);

  if (error) throw configError("讀取預約設定", error.message);

  const map = new Map<string, string>();
  for (const row of (data ?? []) as { k: string; v: string | null }[]) {
    if (row.v !== null) map.set(row.k, row.v);
  }
  return map;
}
