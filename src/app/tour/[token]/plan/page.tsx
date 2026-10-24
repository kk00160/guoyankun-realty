import type { Metadata } from "next";
import {
  displayAddress,
  formatAge,
  formatPing,
  formatPrice,
  formatSeenAt,
  formatUnitPrice,
  publicAreaLabel
} from "@/lib/listings";
import { PROFILE } from "@/lib/profile";
import { mapDirectionsUrl, mapTarget } from "@/lib/route";
import { isTourOpen, tourClosedReason } from "@/lib/tour";
import { pickPlanEntries } from "@/lib/tour-plan";
import { type TourEntry, getTourByToken, listTourEntries } from "@/lib/tour-store";
import ClosedPage from "../ClosedPage";
import Gallery from "../Gallery";

export const dynamic = "force-dynamic";

/**
 * 跟挑選頁一樣必須是 noindex。
 * 這個網址不用登入就能打開，被搜尋引擎收錄等於把買方要去看哪些房子攤在網路上。
 */
export const metadata: Metadata = {
  title: "看房行程",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * 買方的看房行程（同一個 token 的第二條連結）。
 *
 * 兩條連結刻意分開，決定買方看到什麼的是「你複製了哪一條」，不是任何開關：
 *
 *   /tour/[token]        從帶看日記複製 → 買方要「挑」→ 想看／略過
 *   /tour/[token]/plan   從帶看單那一頁複製 → 行程已經定了 → 每一站「導航到這一站」
 *
 * 之前試過在同一條連結上加模式切換，被打回票，原因很直白：
 * 已經約好時間的客人再看到「想看／略過」，等於在問一個已經談完的問題。
 * 而連結是什麼性質，你在複製的當下就知道了，不需要多一個地方去設定它。
 *
 * 這一頁上的物件與順序，跟你手上印出來的帶看單完全一致（見 tour-plan.ts）。
 */
export default async function BuyerPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let tour = null;
  let entries: TourEntry[] = [];

  try {
    tour = await getTourByToken(token);
    if (tour) entries = await listTourEntries(tour.id);
  } catch {
    return <ClosedPage message="系統暫時連不上，請稍後再開一次。" />;
  }

  if (!tour) return <ClosedPage message="這個連結無效。" />;
  if (!isTourOpen(tour)) return <ClosedPage message={tourClosedReason(tour)} />;

  // 待確認的案源永遠不進買方頁。加入帶看紀錄時擋過一次，這裡再擋一次。
  const visible = entries.filter((entry) => entry.listing.status === "active");
  const stops = pickPlanEntries(visible);

  return (
    <main className="buyer-page">
      <div className="buyer-shell">
        <header className="buyer-head">
          <h1>{tour.title}</h1>
          <p>
            {tour.buyerName ? `${tour.buyerName}，` : ""}這是我們這次要看的 {stops.length} 間，
            順序已經排好了。每一間下面都有導航，時間我再跟你電話確認。
          </p>
        </header>

        <ol className="buyer-stops">
          {stops.map((entry, index) => {
            const listing = entry.listing;
            const place = mapTarget(listing);
            return (
              <li key={entry.id} className="buyer-stop">
                <div className="buyer-stop-head">
                  <span className="buyer-stop-order">第 {index + 1} 站</span>
                  <h2>{listing.title}</h2>
                </div>

                {/* 照片在上、資訊在下：手機上一眼先看到房子長什麼樣，
                    要比先讀一排數字容易判斷得多。 */}
                <Gallery photos={listing.images} alt={listing.title} />

                <div className="buyer-card-body">
                  <div className="buyer-price">{formatPrice(listing.totalPrice)}</div>

                  <dl className="buyer-meta">
                    <div>
                      <dt>權狀</dt>
                      <dd>{formatPing(listing.ping)}</dd>
                    </div>
                    <div>
                      <dt>格局</dt>
                      <dd>{listing.layout ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>屋齡</dt>
                      <dd>{formatAge(listing.age)}</dd>
                    </div>
                    <div>
                      <dt>單價</dt>
                      <dd>{formatUnitPrice(listing.unitPrice)}</dd>
                    </div>
                  </dl>

                  {listing.tags.length > 0 && (
                    <div className="buyer-tags">
                      {listing.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* 完整規格一律攤開，不收在「看詳細資料」按鈕後面。
                      挑選頁收起來是因為那裡要一次掃過十幾間；這一頁只有談定的那幾間，
                      而買方是站在房子前面看這一頁的 —— 那時候他要的是資料在眼前，
                      不是再多按一下。實際被反映過：這一頁「沒有物件的詳細資料」。 */}
                  <dl className="buyer-specs">
                    {(
                      [
                        ["權狀坪數", formatPing(listing.ping)],
                        ["主建物", listing.mainArea ? `${listing.mainArea.toFixed(1)} 坪` : "—"],
                        ["公設比", publicAreaLabel(listing, "ratio")],
                        ["格局", listing.layout ?? "—"],
                        ["屋齡", formatAge(listing.age)],
                        ["型態", listing.houseType ?? "—"],
                        ["用途", listing.kindName ?? "—"],
                        ["樓層", listing.floorInfo ?? "—"],
                        ["車位", listing.parking ?? "—"],
                        ["社區", listing.communityName ?? "—"],
                        [
                          "位置",
                          `${listing.district ?? ""}　${displayAddress(listing) ?? "現場提供"}`.trim()
                        ]
                      ] as [string, string][]
                    ).map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {/* 這一頁的主角就是這顆按鈕。
                      不做「整條路線一次導航」：那條路線的起點是阿坤的出發點，
                      對買方沒有意義，反而會把人從家裡導到門市再繞回來。 */}
                  {/* 按鈕就是一句「導航到這一站」，底下不掛任何說明。
                      以前掛過一行「導航到『某某』，地址應該在某某路」，兩邊都拿掉了 ——
                      門牌現在直接印在上面的「位置」那一列，那才是要給人看的地方；
                      重複寫在按鈕底下只會讓人覺得這個地址有什麼問題。 */}
                  {place ? (
                    <a className="buyer-nav-link" href={mapDirectionsUrl(place)} target="_blank" rel="noreferrer">
                      🧭 導航到這一站
                    </a>
                  ) : (
                    <p className="buyer-nav-hint">這一間的位置我現場帶你過去，導航先按不出來。</p>
                  )}

                  <p className="buyer-source">
                    資料更新於 {formatSeenAt(listing.lastSeenAt)}　·　實際屋況與價格以現場為準
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {stops.length === 0 && <p className="empty-note">行程還在整理，排好我會再傳給你。</p>}

        <footer className="buyer-foot">
          <p>
            行程上的資料僅供參考，實際屋況、價格與產權情形，我會在現場跟你逐一確認。
            當天有任何狀況要改時間，直接打給我。
          </p>
          <a className="button-secondary" href={`tel:${PROFILE.phoneRaw}`}>
            打給{PROFILE.alias}　{PROFILE.phone}
          </a>
        </footer>
      </div>
    </main>
  );
}
