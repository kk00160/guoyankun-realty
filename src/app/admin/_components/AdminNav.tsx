"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type AdminEntry, adminTabs } from "@/lib/admin-nav";
import { PROFILE } from "@/lib/profile";

/**
 * 控台導覽列。每一個後台頁面上面都有這排，讓你隨時跳到別的系統。
 *
 * 分頁清單來自 src/lib/admin-nav.ts，不要在這裡寫死 ——
 * 以後多一個系統只改那一份名單，這裡會自己跟上。
 *
 * 整條列標了 no-print：帶看單列印時不該印出後台導覽。
 */
function isActive(pathname: string, href: string) {
  // 控台首頁要完全相等，否則點進任何 /admin/* 都會讓「控台」也亮著。
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export default function AdminNav() {
  const pathname = usePathname();
  const tabs: AdminEntry[] = adminTabs();

  return (
    <header className="console-bar no-print">
      <div className="console-bar-top">
        <Link className="console-brand" href="/admin">
          <span className="console-dot" aria-hidden="true" />
          {PROFILE.name}房仲控台
        </Link>
        {/* HTTP Basic 沒有真正的登出，這條會讓瀏覽器重新問一次帳密（見 middleware）。 */}
        <a className="console-logout" href="/admin/logout">
          登出
        </a>
      </div>

      <nav className="console-tabs" aria-label="後台系統">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} data-on={isActive(pathname, tab.href)}>
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
