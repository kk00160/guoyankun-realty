import Link from "next/link";
import { BOOKING_ENABLED } from "@/lib/feature-flags";
import { PROFILE } from "@/lib/profile";

/**
 * 對外頁面（名片、線上預約）的導覽列。
 *
 * 後台不用這支 —— 後台走 src/app/admin/layout.tsx 裡的控台導覽列（AdminNav）。
 * 兩邊刻意分開：這條會被客戶看到，那條是內部工具列，
 * 混在一起遲早會不小心把後台入口露給客戶。
 */
export default function Topbar({ title }: { title?: string }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark">{PROFILE.brandMark}</span>
        <span>{title ?? PROFILE.brand}</span>
      </Link>
      <nav className="topnav" aria-label="主要導覽">
        <Link href="/">首頁</Link>
        <Link href="/card">名片</Link>
        {/* 功能沒開就不要放一個點了會 404 的連結。 */}
        {BOOKING_ENABLED && <Link href="/card/booking">預約</Link>}
      </nav>
    </header>
  );
}
