import type { Metadata } from "next";
import DbErrorNotice from "@/app/admin/_components/DbErrorNotice";
import DbSetupNotice from "@/app/admin/_components/DbSetupNotice";
import { isDbConfigured } from "@/lib/db";
import { parseListingQuery } from "@/lib/listing-filters";
import { type ListingPage, listListings, listTours } from "@/lib/tour-store";
import FilterPanel from "./FilterPanel";
import ListingResults from "./ListingResults";

export const dynamic = "force-dynamic";

// 後台是內部管理頁，不可被搜尋引擎收錄。
export const metadata: Metadata = {
  title: "買方配案系統",
  robots: { index: false, follow: false }
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-page">
      <div className="admin-shell">{children}</div>
    </div>
  );
}

export default async function ListingsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isDbConfigured()) {
    return (
      <Shell>
        <DbSetupNotice />
      </Shell>
    );
  }

  const query = parseListingQuery(await searchParams);

  // 還沒按過搜尋 → 只給篩選器，不列物件。
  if (!query.searched) {
    return (
      <div className="admin-page">
        <div className="admin-shell">
          <div className="admin-heading">
            <div>
              <h1>買方配案系統</h1>
              <p>先選條件，按搜尋。挑好的物件加進帶看紀錄，就能產生買方連結。</p>
            </div>
          </div>
          <FilterPanel query={query} defaultOpen />
        </div>
      </div>
    );
  }

  let result: ListingPage = { rows: [], total: 0, page: 1, pageCount: 1 };
  let tours: { id: string; title: string }[] = [];
  let loadError = "";

  try {
    [result, tours] = await Promise.all([
      listListings(query),
      listTours().then((rows) =>
        rows.filter((row) => row.status === "active").map((row) => ({ id: row.id, title: row.title }))
      )
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "讀取資料失敗";
  }

  if (loadError) {
    return (
      <Shell>
        <DbErrorNotice detail={loadError} retryHref="/admin/listings" />
      </Shell>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <div className="admin-heading">
          <div>
            <h1>買方配案系統</h1>
            <p>勾選要給買方看的物件，產生連結後傳給他，他在手機上自己挑。</p>
          </div>
        </div>

        {/* 搜過之後預設收合，把版面讓給結果；要改條件再展開。 */}
        <FilterPanel query={query} defaultOpen={false} />
        <ListingResults query={query} result={result} tours={tours} />
      </div>
    </div>
  );
}
