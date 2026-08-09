/**
 * 案件編號 AP-260809-01
 *
 * 為什麼不直接用 uuid：電話裡念不出來。
 * 客戶打來問「我上次約的那個」，你要能請他念編號，而不是「那一串英文數字」。
 *
 * 組成：AP-（年月日，台北時間）-（當天第幾筆）
 *
 * 這支檔案沒有任何 I/O，client component 可以直接 import。
 */

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 台北時間的 YYMMDD。 */
export function caseDay(createdAt: Date = new Date()): string {
  const taipei = new Date(createdAt.getTime() + TAIPEI_OFFSET_MS);
  return taipei.toISOString().slice(2, 10).replace(/-/g, "");
}

export function formatCaseNo(createdAt: Date, seq: number): string {
  return `AP-${caseDay(createdAt)}-${String(Math.max(1, seq)).padStart(2, "0")}`;
}

/** 同一天的所有編號共用的前綴，例：AP-260809- */
export function casePrefix(createdAt: Date = new Date()): string {
  return `AP-${caseDay(createdAt)}-`;
}

/** 從編號取出當天序號；格式不符回 0。 */
export function parseCaseSeq(caseNo: string, prefix: string): number {
  if (!caseNo.startsWith(prefix)) return 0;
  const raw = caseNo.slice(prefix.length);
  if (!/^\d+$/.test(raw)) return 0;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}
