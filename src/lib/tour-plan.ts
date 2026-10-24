import type { BuyerChoice } from "@/lib/tour";

/**
 * 帶看行程上要放哪幾間、什麼順序。
 *
 * 這份邏輯有兩個地方在用：
 *   1. 印出來帶出門的帶看單 `/admin/tours/[id]/report`
 *   2. 傳給買方的行程連結 `/tour/[token]/plan`
 *
 * 兩邊必須逐字一致 —— 手上那張紙的第三站跟買方手機上的第三站不是同一間，
 * 是帶看當下最尷尬、也最沒辦法當場補救的錯。所以只留這一份，不要各寫各的。
 *
 * 排序不在這裡做：`listTourEntries` 已經照 visit_order（沒排的排最後）、
 * 再照加入時間排好了。這支只負責「篩掉哪些」，順序原封不動帶著走。
 */

export type PlannableEntry = { buyerChoice: BuyerChoice };

/**
 * 買方勾過「想看」就只放那些；一間都還沒勾就放「略過」以外的全部。
 *
 * 這樣不管買方有沒有回覆，行程都生得出來 —— 很多客人是電話裡講完就約時間，
 * 根本不會回去點那個連結，這時候「他沒表態」不該等於「沒有行程」。
 */
export function pickPlanEntries<T extends PlannableEntry>(entries: T[]): T[] {
  const interested = entries.filter((entry) => entry.buyerChoice === "interested");
  if (interested.length > 0) return interested;
  return entries.filter((entry) => entry.buyerChoice !== "rejected");
}
