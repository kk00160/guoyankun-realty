import { PROFILE } from "@/lib/profile";

/**
 * 線上預約系統開關。
 *
 * 預設「關閉」是刻意的：預約資料目前存在本機 JSON 檔（見 appointment-store.ts），
 * 在 Vercel 等無伺服器平台上檔案系統是唯讀且不持久的，客戶送出的預約會遺失；
 * 而 /admin 也還沒有登入驗證，開著等於公開客戶個資。
 *
 * 因此正式站只開形象網站，預約一律導到 LINE。
 * 等換成雲端資料庫並補上後台驗證後，把環境變數設成 BOOKING_ENABLED=true 即可全部打開。
 */
export const BOOKING_ENABLED = process.env.BOOKING_ENABLED === "true";

/** 預約 CTA 的目的地：功能開啟時走線上預約，否則走 LINE。 */
export const BOOKING_HREF = BOOKING_ENABLED ? "/card/booking" : PROFILE.social.line;

/** 導到外部 LINE 時要加 target="_blank"，站內連結則不需要。 */
export const BOOKING_LINK_PROPS = BOOKING_ENABLED
  ? {}
  : { target: "_blank", rel: "noreferrer" as const };

/**
 * 帶看助手（買方配案系統、帶看日記、買方勾選頁）的總開關。
 *
 * 跟 BOOKING_ENABLED 刻意分開，因為兩者的前提條件不同：
 * 預約系統卡在「資料存本機檔案」，帶看系統則是走 Supabase，可以先單獨上線。
 * 綁在同一個開關的話，等於為了開帶看被迫把還不能上線的預約系統一起打開。
 *
 * 一樣是 fail closed：沒設成 true 就整組 404。
 */
export const TOUR_ENABLED = process.env.TOUR_ENABLED === "true";
