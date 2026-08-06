import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db-schema";

/**
 * 帶看助手的資料庫連線（Supabase Postgres）。
 *
 * 為什麼帶看功能不沿用 appointment-store.ts 的 JSON 檔：
 * 那套把資料寫到 data/*.json，在 Vercel 上檔案系統唯讀且不持久，
 * 買方在手機上勾的「想看／略過」會直接消失。買方勾選必須落地在真的資料庫。
 *
 * 為什麼只有 service_role 一把鑰匙：
 * 四張表都開了 RLS 且沒有任何 policy（見 supabase/schema.sql），
 * 所以 anon key 讀不到任何東西，也就沒有必要把它送到瀏覽器。
 * 所有查詢一律在伺服器端發生（server component 與 route handler）。
 *
 * 檔首的 "server-only" 是硬性保險：只要有人不小心在 client component
 * import 到這支檔案，build 會直接失敗，而不是把 service_role key 打包進前端。
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** 環境變數齊全才算接上資料庫。缺一個就當作沒設定，讓功能整個關閉而不是半殘。 */
export const DB_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

let cached: ReturnType<typeof createClient<Database>> | null = null;

/**
 * 取得資料庫連線。沒設定環境變數就丟明確的錯誤，
 * 不要回一個半殘的 client 讓錯誤延後到某個看不懂的地方才爆。
 */
export function db() {
  if (!DB_CONFIGURED) {
    throw new Error(
      "帶看系統的資料庫尚未設定。請在 .env.local 填入 SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY。"
    );
  }

  if (!cached) {
    cached = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  return cached;
}
