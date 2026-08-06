import type { Metadata } from "next";
import Topbar from "@/app/_components/Topbar";
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

  try {
    [listings, tours, runs] = await Promise.all([
      listListings({ status }),
      listTours().then((rows) =>
        rows.filter((row) => row.status === "active").map((row) => ({ id: row.id, title: row.title }))
      ),
      recentCrawlRuns()
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "讀取資料失敗";
  }

  if (loadError) {
    return (
      <div className="admin-page">
        <Topbar admin title="案源庫" />
        <div className="admin-shell">
          <DbSetupNotice detail={loadError} />
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
