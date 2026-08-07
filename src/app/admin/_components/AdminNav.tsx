"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminEntry } from "@/lib/admin-nav";

/**
 * 控台導覽列。每一個後台頁面上面都有這排，讓你隨時跳到別的系統。
 *
 * ⚠️ 分頁清單一律由 layout（server component）算好用 props 傳進來，
 *    這支不可以自己去讀環境變數 —— 那些變數在瀏覽器裡是 undefined，
 *    自己算的話 hydration 之後分頁會整排消失。詳見 src/lib/admin-nav.ts 的註解。
 *    這裡只留一件需要瀏覽器才知道的事：現在人在哪一頁。
 *
 * 整條列標了 no-print：帶看單列印時不該印出後台導覽。
 */
function isActive(pathname: string, href: string) {
  // 控台首頁要完全相等，否則點進任何 /admin/* 都會讓「控台」也亮著。
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export default function AdminNav({ tabs, brand }: { tabs: AdminEntry[]; brand: string }) {
  const pathname = usePathname();

  return (
    <header className="console-bar no-print">
      <div className="console-bar-top">
        <Link className="console-brand" href="/admin">
          <span className="console-dot" aria-hidden="true" />
          {brand}
        </Link>
        {/* HTTP Basic 沒有真正的登出，這條會讓瀏覽器重新問一次帳密（見 middleware）。 */}
        <a className="console-logout" href="/admin/logout">
          登出
        </a>
      </div>

      <nav className="console-tabs" aria-label="後台系統">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            data-on={isActive(pathname, tab.href)}
            aria-current={isActive(pathname, tab.href) ? "page" : undefined}
          >
            <span className="console-tab-icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
