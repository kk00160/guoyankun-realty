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

/**
 * 環境變數一律「用到才讀」，不要在模組載入時就抓進常數。
 *
 * 踩過的坑：原本寫成 const SUPABASE_URL = process.env.SUPABASE_URL ?? ""，
 * 部署到 Vercel 之後永遠是空字串 —— 因為那幾個變數在 Vercel 上被標成
 * Sensitive，而 Sensitive 變數「建置階段讀不到，只有執行期才有」。
 * 模組層級的讀取會在建置時就被算掉，於是永遠拿到空的。
 *
 * 同一份程式在本機完全正常（本機沒有建置期／執行期的差別），
 * 所以這種錯只會在正式站出現，而且訊息會是「資料庫尚未設定」——
 * 看起來像沒設定，實際上設了。
 */
function readEnv() {
  return {
    url: process.env.SUPABASE_URL ?? "",
    key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  };
}

/** 環境變數齊全才算接上資料庫。缺一個就當作沒設定，讓功能整個關閉而不是半殘。 */
export function isDbConfigured() {
  const { url, key } = readEnv();
  return Boolean(url && key);
}

let cached: ReturnType<typeof createClient<Database>> | null = null;

/**
 * 取得資料庫連線。沒設定環境變數就丟明確的錯誤，
 * 不要回一個半殘的 client 讓錯誤延後到某個看不懂的地方才爆。
 */
export function db() {
  const { url, key } = readEnv();

  if (!url || !key) {
    // 講出「是哪一個」不見了。只說變數名稱，不洩漏任何值。
    // 原本只說「尚未設定」，結果 Vercel 上明明四個變數都設了，卻查不出是哪個沒生效。
    const missing = [!url && "SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"]
      .filter(Boolean)
      .join(" 與 ");
    throw new Error(
      `帶看系統的資料庫尚未設定：讀不到 ${missing}。` +
        "本機請檢查 .env.local；正式站請檢查 Vercel 的 Environment Variables（改完要重新部署）。"
    );
  }

  if (!cached) {
    cached = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  return cached;
}

/**
 * 會自己好的錯誤。
 *
 * 「JWT issued at future」是實際遇過的：Supabase 的閘道與資料庫節點時鐘差了一點點，
 * 幾秒後就恢復。這種錯誤不該讓整頁掛掉，更不該讓使用者以為自己的設定壞了。
 */
const TRANSIENT = /issued at future|jwt expired|fetch failed|econnreset|etimedout|socket hang up|\b(502|503|504)\b/i;

export function isTransientDbError(message: string) {
  return TRANSIENT.test(message);
}

/**
 * 跑一次查詢；遇到會自己好的錯誤就重試，最多三次，間隔遞增。
 *
 * 只重試「讀取」是刻意的 —— 寫入重試有可能寫兩次。
 * 這支只給讀的路徑用（見 tour-store.ts）。
 */
export async function readWithRetry<T>(
  run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  what: string
): Promise<T> {
  let lastMessage = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await run();
    if (!error) return (data ?? []) as T;

    lastMessage = error.message;
    if (!isTransientDbError(lastMessage)) break;

    // 200ms、600ms —— 時鐘偏差通常一兩秒內就過去了。
    await new Promise((resolve) => setTimeout(resolve, 200 + attempt * 400));
  }

  throw new Error(`${what}失敗：${lastMessage}`);
}
