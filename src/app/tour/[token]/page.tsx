import type { Metadata } from "next";
import { PROFILE } from "@/lib/profile";
import { isTourOpen, tourClosedReason } from "@/lib/tour";
import { type TourEntry, getTourByToken, listTourEntries } from "@/lib/tour-store";
import BuyerPicker from "./BuyerPicker";

export const dynamic = "force-dynamic";

/**
 * 買方連結必須是 noindex。
 * 這個網址不用登入就能打開，被搜尋引擎收錄等於把買方看過哪些房子攤在網路上。
 */
export const metadata: Metadata = {
  title: "為你挑的物件",
  robots: { index: false, follow: false, nocache: true }
};

function ClosedPage({ message }: { message: string }) {
  return (
    <main className="buyer-page">
      <div className="buyer-closed">
        <h1>{message}</h1>
        <p>如果需要重新看一次清單，直接跟我說一聲，我再發一個新連結給你。</p>
        <a className="button" href={`tel:${PROFILE.phoneRaw}`}>
          打給{PROFILE.alias}　{PROFILE.phone}
        </a>
      </div>
    </main>
  );
}

export default async function BuyerTourPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let tour = null;
  let entries: TourEntry[] = [];

  try {
    tour = await getTourByToken(token);
    if (tour) entries = await listTourEntries(tour.id);
  } catch {
    // 資料庫連不上時，給買方一句人話，不要丟 500 白畫面。
    return <ClosedPage message="系統暫時連不上，請稍後再開一次。" />;
  }

  if (!tour) return <ClosedPage message="這個連結無效。" />;
  if (!isTourOpen(tour)) return <ClosedPage message={tourClosedReason(tour)} />;

  /**
   * 第二道防線：只有 active 的案源會送到買方眼前。
   *
   * 加入帶看單時已經擋過一次待確認的資料（見 tour-store.ts 的 addTourItems），
   * 這裡再擋一次 —— 物件有可能是加入之後才被標記成待確認的。
   * 這是整個系統最不能出錯的地方，所以兩道都留著。
   */
  const visible = entries.filter((entry) => entry.listing.status === "active");

  return (
    <main className="buyer-page">
      <BuyerPicker
        token={token}
        title={tour.title}
        buyerName={tour.buyerName}
        submittedAt={tour.submittedAt}
        mode={tour.mode}
        timeSlots={tour.timeSlots}
        entries={visible.map((entry) => ({
          listingId: entry.listingId,
          choice: entry.buyerChoice,
          // 阿坤排完路線之後才有值。有值就代表「行程定了」，買方頁要把順序秀出來。
          visitOrder: entry.visitOrder,
          listing: entry.listing
        }))}
      />
    </main>
  );
}
