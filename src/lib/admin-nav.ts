import "server-only";
import { BOOKING_ENABLED, TOUR_ENABLED } from "@/lib/feature-flags";

/**
 * 檔首的 "server-only" 是硬性保險，別拿掉。
 *
 * 這支讀 TOUR_ENABLED / BOOKING_ENABLED，而那兩個是伺服器端的環境變數 ——
 * Next.js 只會把 NEXT_PUBLIC_ 開頭的變數送進瀏覽器，其餘在瀏覽器裡一律是 undefined。
 *
 * 實際踩過：導覽列本來是 client component 直接呼叫 adminTabs()，
 * 伺服器算出四個分頁送到畫面上，瀏覽器接手後兩個開關都變成 false，
 * 分頁就被抹掉只剩「控台」。而且伺服器吐出來的 HTML 是對的，
 * 只看 HTML 驗證完全看不出問題。
 *
 * 現在改成 server component（layout）算好再用 props 傳給導覽列。
 * 有人不小心又在 client component import 這支的話，build 會直接失敗，
 * 而不是安靜地少掉幾個分頁。
 */

/**
 * 控台的後台系統名單。
 *
 * 這裡是唯一一份名單 —— 控台首頁的卡片、每一頁上面那排分頁，都是從這裡長出來的。
 * 以後多一個系統，只要在這個陣列裡多一筆，兩個地方會自己跟上，不用去改畫面。
 *
 * ⚠️ 新增系統時除了這裡，還要到 src/middleware.ts 的 featureOf() 登記路徑。
 *    沒登記的路徑會直接 404（fail closed），這是刻意的：
 *    忘了登記的後果是「連不進去」，而不是「沒有防護就上線」。
 */
export type AdminEntry = {
  /** 分頁上的短標籤。三到五個字最好看，太長會擠。 */
  label: string;
  href: string;
  /** 線條圖示的名稱，對應 src/app/admin/_components/AdminIcon.tsx。不是表情符號。 */
  icon: string;
};

export type AdminSystem = AdminEntry & {
  id: string;
  /** 控台卡片上的完整名稱 */
  title: string;
  /** 一句話講清楚這個系統是幹嘛用的 */
  summary: string;
  /** 進到這個系統的第一個動作 */
  cta: string;
  /** 功能開關關掉時，分頁不顯示、卡片變成停用狀態 */
  enabled: boolean;
  /** 關著的時候要告訴自己「為什麼還沒開」，不然三個月後會忘記 */
  disabledReason?: string;
  /** 同一個系統底下的其他入口 */
  links: AdminEntry[];
};

export const ADMIN_SYSTEMS: AdminSystem[] = [
  {
    id: "tour",
    label: "買方配案",
    title: "買方配案系統",
    icon: "match",
    href: "/admin/listings",
    summary: "從案源裡篩出要給買方的物件，產一條連結給他自己勾，勾完排路線、印帶看單。",
    cta: "開始配案",
    enabled: TOUR_ENABLED,
    disabledReason: "TOUR_ENABLED 沒設成 true。",
    links: [{ label: "帶看日記", href: "/admin/tours", icon: "diary" }]
  },
  {
    id: "lead",
    label: "來客名單",
    title: "預約諮詢系統",
    icon: "leads",
    href: "/admin/leads",
    summary: "客戶在首頁按「送出預約」留下的姓名、電話與需求，全部落在這裡。",
    cta: "看來客名單",
    // 刻意沒有開關：關掉等於安靜地掉客戶。見 middleware 的 featureOf()。
    enabled: true,
    links: []
  },
  {
    id: "booking",
    label: "時段預約",
    title: "線上選時段預約",
    icon: "calendar",
    href: "/admin/appointments",
    summary: "客戶自己挑一個時段預約諮詢。跟上面的來客名單是兩回事：那個是留資料請你回電，這個是直接把時間定下來。",
    cta: "看預約名單",
    enabled: BOOKING_ENABLED,
    disabledReason:
      "這一套的資料還存在本機檔案，雲端主機的檔案不會保留，客戶送出的預約會消失，所以刻意沒開。首頁的表單走的是上面那套「來客名單」，資料有進資料庫，不受影響。",
    links: []
  }
];

/** 上面那排分頁：控台 + 每個有開的系統（含它底下的入口）。 */
export function adminTabs(): AdminEntry[] {
  const tabs: AdminEntry[] = [{ label: "控台", href: "/admin", icon: "console" }];
  for (const system of ADMIN_SYSTEMS) {
    if (!system.enabled) continue;
    tabs.push({ label: system.label, href: system.href, icon: system.icon });
    tabs.push(...system.links);
  }
  return tabs;
}
