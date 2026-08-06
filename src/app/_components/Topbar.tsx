import Link from "next/link";
import { BOOKING_ENABLED, TOUR_ENABLED } from "@/lib/feature-flags";
import { PROFILE } from "@/lib/profile";

export default function Topbar({ admin = false, title }: { admin?: boolean; title?: string }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark">{PROFILE.brandMark}</span>
        <span>{title ?? (admin ? "後台" : PROFILE.brand)}</span>
      </Link>
      <nav className="topnav" aria-label="主要導覽">
        <Link href="/">首頁</Link>
        <Link href="/card">名片</Link>
        {BOOKING_ENABLED && <Link href="/card/booking">預約</Link>}
        {/* 後台是內部入口，只在後台頁面顯示，不對客戶露出。 */}
        {/* 每個連結各自跟著自己的功能開關：功能沒開就不要放一個點了會 404 的連結。 */}
        {admin && BOOKING_ENABLED && <Link href="/admin/appointments">預約管理</Link>}
        {admin && TOUR_ENABLED && <Link href="/admin/listings">案源庫</Link>}
        {admin && TOUR_ENABLED && <Link href="/admin/tours">帶看單</Link>}
      </nav>
    </header>
  );
}
