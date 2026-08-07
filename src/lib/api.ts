import { NextResponse } from "next/server";

/**
 * 帶看助手 API 的共用回應格式。
 *
 * 沿用預約 API 既有的 { ok, error } 形狀，前端才不必記兩套。
 */

export function ok<T extends Record<string, unknown>>(payload: T = {} as T) {
  return NextResponse.json({ ok: true, ...payload });
}

export function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * 把丟出來的例外轉成回應。
 *
 * 錯誤訊息不直接回給前端 —— 資料庫的錯誤訊息可能夾帶欄位名稱或連線資訊。
 * 真正的內容寫進伺服器 log，前端只拿到一句人看得懂的話。
 */
export function fail(scope: string, error: unknown) {
  console.error(`[${scope}]`, error);
  const message = error instanceof Error ? error.message : "";

  /**
   * 有幾種錯誤是「設定沒做完」，不是真的壞掉。這些要原樣講出來，
   * 不然畫面只會顯示「系統忙碌」，而正確的下一步其實是去跑一段 SQL 或補一個環境變數。
   *
   * 判斷條件刻意寫死成我們自己寫的那幾句話，不用關鍵字模糊比對 ——
   * 免得哪天資料庫的原始錯誤剛好夾到這些字，把欄位名或連線資訊漏出去。
   */
  const isSetupHint = message.includes("尚未設定") || message.includes("SQL Editor");
  if (isSetupHint) {
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }

  return NextResponse.json({ ok: false, error: "系統忙碌，請稍後重試。" }, { status: 500 });
}

/** 讀取 JSON body，格式壞掉就當空物件，不要讓 API 因為 body 亂掉直接 500。 */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => ({}));
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

/** 表單數字欄位：空字串、null、非數字一律當成沒填。 */
export function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 表單文字欄位：修掉前後空白，空字串當成沒填。 */
export function optionalText(value: unknown, maxLength = 500): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().slice(0, maxLength);
  return text.length > 0 ? text : null;
}
