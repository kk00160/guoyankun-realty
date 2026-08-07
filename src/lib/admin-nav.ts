import { BOOKING_ENABLED, TOUR_ENABLED } from "@/lib/feature-flags";

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
    icon: "🔍",
    href: "/admin/listings",
    summary: "從案源裡篩出要給買方的物件，產一條連結給他自己勾，勾完排路線、印帶看單。",
    cta: "開始配案",
    enabled: TOUR_ENABLED,
    disabledReason: "TOUR_ENABLED 沒設成 true。",
    links: [{ label: "帶看日記", href: "/admin/tours", icon: "📔" }]
  },
  {
    id: "booking",
    label: "預約管理",
    title: "預約系統",
    icon: "📅",
    href: "/admin/appointments",
    summary: "客戶線上選時段預約諮詢，這裡看名單、確認或取消。",
    cta: "看預約名單",
    enabled: BOOKING_ENABLED,
    disabledReason:
      "預約資料還存在本機檔案，雲端主機的檔案不會保留，客戶送出的預約會消失。改成資料庫之前刻意不開，首頁的預約一律導到 LINE。",
    links: []
  }
];

/** 上面那排分頁：控台 + 每個有開的系統（含它底下的入口）。 */
export function adminTabs(): AdminEntry[] {
  const tabs: AdminEntry[] = [{ label: "控台", href: "/admin", icon: "🏠" }];
  for (const system of ADMIN_SYSTEMS) {
    if (!system.enabled) continue;
    tabs.push({ label: system.label, href: system.href, icon: system.icon });
    tabs.push(...system.links);
  }
  return tabs;
}
