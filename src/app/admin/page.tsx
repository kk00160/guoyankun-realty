import type { Metadata } from "next";
import Link from "next/link";
import AdminIcon from "@/app/admin/_components/AdminIcon";
import NotifyCard from "@/app/admin/_components/NotifyCard";
import { ADMIN_SYSTEMS } from "@/lib/admin-nav";
import { isLineConfigured } from "@/lib/notify-line";
import { listAppointments } from "@/lib/appointment-store";
import { isDbConfigured } from "@/lib/db";
import { BOOKING_ENABLED, TOUR_ENABLED } from "@/lib/feature-flags";
import { PROFILE } from "@/lib/profile";
import { countLeads } from "@/lib/lead-store";
import { countListings, listTours } from "@/lib/tour-store";

export const dynamic = "force-dynamic";

// 後台是內部管理頁，不可被搜尋引擎收錄。
export const metadata: Metadata = {
  title: "控台",
  robots: { index: false, follow: false }
};

type Stat = { label: string; value: string };

/**
 * 買方配案系統的即時數字。
 *
 * 整包用一個 try 包起來是刻意的：控台是「進得去別的地方」的那一頁，
 * 數字抓不到頂多是少看幾個數字，絕對不能因此讓整個控台開不起來
 * ——那會變成後台一起連不進去。
 */
async function tourStats(): Promise<{ stats: Stat[]; note: string }> {
  // 關掉的系統不查數字。查了也沒地方顯示，只是白跑一趟資料庫。
  if (!TOUR_ENABLED) return { stats: [], note: "" };

  if (!isDbConfigured()) {
    return { stats: [], note: "資料庫還沒接上，數字先空著。" };
  }

  try {
    const [active, review, tours] = await Promise.all([
      countListings("active"),
      countListings("needs_review"),
      listTours()
    ]);

    const replied = tours.filter((tour) => tour.submittedAt).length;
    const waiting = tours.filter((tour) => !tour.submittedAt && tour.itemCount > 0).length;

    return {
      stats: [
        { label: "可用案源", value: `${active.toLocaleString("zh-TW")} 筆` },
        { label: "帶看紀錄", value: `${tours.length} 筆` },
        { label: "買方已回覆", value: `${replied} 筆` },
        { label: "等買方回覆", value: `${waiting} 筆` }
      ],
      note: review > 0 ? `另有 ${review} 筆待確認的案源，只在後台看得到，不會出現在買方頁。` : ""
    };
  } catch (error) {
    console.error("[控台] 讀數字失敗：", error);
    return { stats: [], note: "這次讀不到數字（資料庫暫時沒回應），系統本身還是進得去。" };
  }
}

/** 首頁來客的即時數字。「待聯絡」是你打開控台最想先看到的數字。 */
async function leadStats(): Promise<{ stats: Stat[]; note: string }> {
  if (!isDbConfigured()) return { stats: [], note: "資料庫還沒接上，數字先空著。" };

  try {
    const [waiting, total] = await Promise.all([countLeads("new"), countLeads()]);
    return {
      stats: [
        { label: "待聯絡", value: `${waiting} 筆` },
        { label: "累計來客", value: `${total} 筆` }
      ],
      note: waiting > 0 ? `有 ${waiting} 筆還沒回，點進去看。` : ""
    };
  } catch (error) {
    // 表還沒建的時候要講清楚下一步，不要只說「讀不到」。
    const message = error instanceof Error ? error.message : "";
    return {
      stats: [],
      note: message.includes("SQL Editor") ? message : "這次讀不到數字，系統本身還是進得去。"
    };
  }
}

/** 預約系統的即時數字。功能沒開就不查，不然只是白讀一個不會用到的檔案。 */
async function bookingStats(): Promise<{ stats: Stat[]; note: string }> {
  if (!BOOKING_ENABLED) return { stats: [], note: "" };

  try {
    const rows = await listAppointments("all");
    const confirmed = rows.filter((row) => row.status === "confirmed").length;
    return {
      stats: [
        { label: "待進行", value: `${confirmed} 筆` },
        { label: "全部預約", value: `${rows.length} 筆` }
      ],
      note: ""
    };
  } catch {
    return { stats: [], note: "這次讀不到預約名單，系統本身還是進得去。" };
  }
}

export default async function ConsolePage() {
  // 每張卡各自抓自己的數字，一邊掛掉不影響其他張。
  const [tour, lead, booking] = await Promise.all([tourStats(), leadStats(), bookingStats()]);
  const statsFor = (id: string) => (id === "tour" ? tour : id === "lead" ? lead : booking);

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <div className="console-hero">
          <h1>控台</h1>
          <p>
            {PROFILE.name}的後台總入口。所有系統都從這裡進去，網址記這一個就好。
          </p>
        </div>

        <div className="console-grid">
          {ADMIN_SYSTEMS.map((system) => {
            const { stats, note } = statsFor(system.id);

            return (
              <section key={system.id} className="console-card" data-off={!system.enabled}>
                <header>
                  <span className="console-card-icon">
                    <AdminIcon name={system.icon} />
                  </span>
                  <div>
                    <h2>{system.title}</h2>
                    <p>{system.summary}</p>
                  </div>
                </header>

                {system.enabled && stats.length > 0 && (
                  <dl className="console-stats">
                    {stats.map((stat) => (
                      <div key={stat.label}>
                        <dt>{stat.label}</dt>
                        <dd>{stat.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {system.enabled && note && <p className="console-note">{note}</p>}

                {system.enabled ? (
                  <div className="console-actions">
                    <Link className="button" href={system.href}>
                      {system.cta}
                    </Link>
                    {system.links.map((link) => (
                      <Link key={link.href} className="button-secondary" href={link.href}>
                        <AdminIcon name={link.icon} />
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  /* 關著的系統要講清楚為什麼關著，不要只顯示一個灰掉的按鈕。
                     三個月後看到這張卡的人（包含你自己）需要知道要補什麼才能開。 */
                  <p className="console-off">
                    <b>目前沒有開</b>
                    {system.disabledReason ? `　${system.disabledReason}` : ""}
                  </p>
                )}
              </section>
            );
          })}

          {/* 通知設定放在系統卡片後面，是刻意的：它不是一個「系統」，
              是這些系統共用的一件事，但又必須看得到目前到底通不通。

              ⚠️ 不要拿 TOUR_ENABLED 把它包起來。來客通知不歸帶看助手管
              （/api/lead 本來就刻意沒有開關），帶看關掉時來客照樣會通知，
              這時候把卡片藏起來，等於讓畫面說了一件不是事實的事。 */}
          <NotifyCard configured={isLineConfigured()} bookingEnabled={BOOKING_ENABLED} />
        </div>

        <p className="console-foot">
          之後要加新的系統，跟我說要做什麼就好 —— 卡片跟上面那排分頁會自己多一格。
        </p>
      </div>
    </div>
  );
}
