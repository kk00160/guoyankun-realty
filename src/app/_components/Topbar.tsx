import Link from "next/link";
import { BOOKING_ENABLED } from "@/lib/feature-flags";
import { PROFILE } from "@/lib/profile";

export default function Topbar({ admin = false }: { admin?: boolean }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark">{PROFILE.brandMark}</span>
        <span>{admin ? "預約管理" : PROFILE.brand}</span>
      </Link>
      <nav className="topnav" aria-label="主要導覽">
        <Link href="/">首頁</Link>
        <Link href="/card">名片</Link>
        {BOOKING_ENABLED && <Link href="/card/booking">預約</Link>}
        {/* 後台是內部入口，只在後台頁面顯示，不對客戶露出。 */}
        {admin && <Link href="/admin/appointments">後台</Link>}
      </nav>
    </header>
  );
}
