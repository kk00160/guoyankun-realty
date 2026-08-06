import type { Metadata } from "next";
import Topbar from "@/app/_components/Topbar";
import DbErrorNotice from "@/app/admin/_components/DbErrorNotice";
import DbSetupNotice from "@/app/admin/_components/DbSetupNotice";
import { DB_CONFIGURED } from "@/lib/db";
import type { Listing, ListingStatus } from "@/lib/listings";
import {
  type CrawlRun,
  crawlerLooksBroken,
  listListings,
  listTours,
  recentCrawlRuns
} from "@/lib/tour-store";
import ListingBoard from "./ListingBoard";

export const dynamic = "force-dynamic";

// 後台是內部管理頁，不可被搜尋引擎收錄。
export const metadata: Metadata = {
  title: "案源庫",
  robots: { index: false, follow: false }
};

const STATUS_PARAMS: ListingStatus[] = ["active", "needs_review", "archived", "sold"];

export default async function ListingsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!DB_CONFIGURED) {
    return (
      <div className="admin-page">
        <Topbar admin title="案源庫" />
        <div className="admin-shell">
          <DbSetupNotice />
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const status = STATUS_PARAMS.includes(params.status as ListingStatus)
    ? (params.status as ListingStatus)
    : "all";

  let listings: Listing[] = [];
  let tours: { id: string; title: string }[] = [];
  let runs: CrawlRun[] = [];
  let loadError = "";

  // 案源與帶看單是這一頁的本體，讀不到就只能顯示錯誤。
  try {
    [listings, tours] = await Promise.all([
      listListings({ status }),
      listTours().then((rows) =>
        rows.filter((row) => row.status === "active").map((row) => ({ id: row.id, title: row.title }))
      )
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "讀取資料失敗";
  }

  // 匯入紀錄只拿來顯示「爬蟲是不是壞了」的提示，是附屬資訊。
  // 刻意獨立 try —— 原本跟上面放在同一個 Promise.all 裡，
  // 結果這支查詢失敗一次，整個案源庫就跟著掛掉，明明 62 筆案源都讀得到。
  // 附屬資訊不該有能力弄垮主功能。
  try {
    runs = await recentCrawlRuns();
  } catch {
    runs = [];
  }

  // 設定是好的、只是這次讀取失敗 —— 不要拿設定指引嚇人。
  if (loadError) {
    return (
      <div className="admin-page">
        <Topbar admin title="案源庫" />
        <div className="admin-shell">
          <DbErrorNotice detail={loadError} retryHref="/admin/listings" />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <Topbar admin title="案源庫" />
      <ListingBoard
        listings={listings}
        tours={tours}
        status={status}
        crawlerHealth={crawlerLooksBroken(runs)}
        latestRun={runs[0] ?? null}
      />
    </div>
  );
}
