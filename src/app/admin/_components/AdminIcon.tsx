/**
 * 後台的線條圖示。
 *
 * 為什麼不用表情符號：表情符號在 Mac、Windows、Android 上各長各的樣子
 * （而且一律很卡通），一整排擺在導覽列是整套後台看起來最廉價的細節。
 * 這裡的圖示是純 SVG，顏色跟大小都跟著父層的 color / font-size 走，
 * 換主題不用動它。
 *
 * 為什麼不裝圖示套件：這裡只需要五個圖，裝一整包等於為了五個字買一本字典，
 * 而且會多一個要跟著升級的相依。要加圖就在下面多一筆。
 *
 * 名稱寫在 src/lib/admin-nav.ts 的 icon 欄位。找不到對應的名稱會回 null
 * （畫面上就是少一個圖，不會整頁掛掉）。
 */

export type AdminIconName = "console" | "match" | "diary" | "leads" | "calendar";

const PATHS: Record<AdminIconName, React.ReactNode> = {
  // 房子：控台
  console: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  // 放大鏡：買方配案
  match: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  // 筆記本：帶看日記
  diary: (
    <>
      <path d="M6 3h13v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M4 8h4M4 12h4M4 16h4" />
    </>
  ),
  // 名片：來客名單
  leads: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14.5 10h4M14.5 14h4" />
    </>
  ),
  // 日曆：時段預約
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  )
};

export default function AdminIcon({ name }: { name: string }) {
  const path = PATHS[name as AdminIconName];
  if (!path) return null;

  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}
