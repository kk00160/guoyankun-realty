import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@/lib/db";
import { formatInTaipei } from "@/lib/format-date";
import {
  canRoute,
  displayAddress,
  formatAge,
  formatPing,
  formatPrice,
  formatSeenAt,
  formatUnitPrice
} from "@/lib/listings";
import { PROFILE } from "@/lib/profile";
import {
  type RoutePoint,
  googleMapsUrls,
  mapDirectionsUrl,
  mapTarget,
  routeLegs,
  routeSummary
} from "@/lib/route";
import { pickPlanEntries } from "@/lib/tour-plan";
import { getTour, listTourEntries } from "@/lib/tour-store";
import CopyBuyerLink from "./CopyBuyerLink";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "帶看單",
  robots: { index: false, follow: false }
};

export default async function TourReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDbConfigured()) notFound();

  const tour = await getTour(id);
  if (!tour) notFound();

  const entries = await listTourEntries(id);

  /**
   * 帶看單上要放哪幾間。
   *
   * 這份篩選跟買方的行程連結 /tour/[token]/plan 共用同一支函式，
   * 兩邊的物件與順序必須逐字一致 —— 見 src/lib/tour-plan.ts 的說明。
   */
  const picked = pickPlanEntries(entries);

  const origin: RoutePoint | undefined =
    tour.originLat !== null && tour.originLng !== null
      ? { id: "origin", label: tour.originLabel ?? "出發點", lat: tour.originLat, lng: tour.originLng }
      : undefined;

  const points: RoutePoint[] = picked
    .filter((entry) => canRoute(entry.listing))
    .map((entry) => ({
      id: entry.listingId,
      label: entry.listing.title,
      lat: entry.listing.lat as number,
      lng: entry.listing.lng as number,
      // 順序用座標算，導航連結用社區名／地址（大樓的座標常落在屋頂）。
      query: mapTarget(entry.listing)?.query
    }));

  const legs = routeLegs(points, origin);
  const summary = routeSummary(points, origin);
  const mapUrls = googleMapsUrls(points, origin, tour.originLabel ?? undefined);

  /**
   * 每一站對應「從上一站過來」的那一段。
   *
   * 注意不能直接用 picked 的索引：沒有座標的物件不會進 points，
   * 用 picked 的索引會讓後面每一段車程都對到錯的物件。
   * 這裡改成用 listingId 對回 points 裡的位置。
   */
  const pointIndex = new Map(points.map((point, index) => [point.id, index]));
  const legFor = (listingId: string) => {
    const position = pointIndex.get(listingId);
    if (position === undefined) return null;
    if (origin) return legs[position] ?? null; // 有出發點時 legs[0] 是「出發點 → 第一站」
    return position === 0 ? null : legs[position - 1] ?? null;
  };
  const printedAt = formatInTaipei(new Date(), { year: "numeric", month: "2-digit", day: "2-digit" });

  return (
    <div className="report-page">
      <div className="report-toolbar no-print">
        <Link className="button-secondary" href={`/admin/tours/${tour.id}`}>
          回帶看紀錄
        </Link>
        <PrintButton />
        <CopyBuyerLink token={tour.token} />
        {mapUrls.map((url, index) => (
          <a key={url} className="button-secondary" href={url} target="_blank" rel="noreferrer">
            {mapUrls.length > 1 ? `導航第 ${index + 1} 段` : "Google Maps 導航"}
          </a>
        ))}
      </div>

      {/* 這一頁是 /admin 底下的後台頁，網址列複製出去買方是打不開的（會要密碼）。
          實際發生過，所以這句話要直接寫在畫面上，而不是等人踩到。 */}
      <p className="report-hint no-print">
        這一頁是<b>你自己看的、印出來帶出門的</b>。網址不能直接傳給買方 —— 那是後台網址，
        他打開會被要求輸入密碼。要給買方看行程，按上面的<b>「複製行程連結」</b>：
        買方打開就是這張單子的手機版，每一站都有「導航到這一站」，不會再出現想看／略過。
        （要讓買方重新挑物件，那是<b>帶看日記裡的「複製挑選連結」</b>，是另一條。）
      </p>

      <article className="report-sheet">
        <header className="report-head">
          <div>
            <h1>{tour.title}</h1>
            <p>
              {tour.buyerName ? `${tour.buyerName} 專屬` : "看房清單"}　·　{picked.length} 間　·　{printedAt}
            </p>
          </div>
          <div className="report-brand">
            <b>{PROFILE.brand}</b>
            <span>{PROFILE.phone}</span>
          </div>
        </header>

        {points.length > 1 && (
          <p className="report-summary">
            建議看房順序如下，全程概估 {summary.km.toFixed(1)} 公里 / {summary.minutes} 分鐘車程
            {origin && `，從「${origin.label}」出發`}。（概估值，不含每間停留時間）
          </p>
        )}

        {picked.map((entry, index) => {
          const leg = legFor(entry.listingId);
          const place = mapTarget(entry.listing);
          return (
            <section key={entry.id} className="report-item">
              <div className="report-item-head">
                <span className="report-order">{index + 1}</span>
                <div>
                  <h2>{entry.listing.title}</h2>
                  {/* 有門牌就印門牌。你補的正確地址優先，其次才是來源的巷弄地址 ——
                      「地址現場提供」只保留給真的兩邊都沒有的那幾筆。 */}
                  <p className="report-address">
                    {entry.listing.district ?? ""}　{displayAddress(entry.listing) ?? "地址現場提供"}
                  </p>
                </div>
                <div className="report-price">{formatPrice(entry.listing.totalPrice)}</div>
              </div>

              <div className="report-item-body">
                {entry.listing.images[0] && (
                  <img className="report-photo" src={entry.listing.images[0]} alt="" />
                )}

                <table className="report-table">
                  <tbody>
                    <tr>
                      <th>坪數</th>
                      <td>{formatPing(entry.listing.ping)}</td>
                      <th>單價</th>
                      <td>{formatUnitPrice(entry.listing.unitPrice)}</td>
                    </tr>
                    <tr>
                      <th>格局</th>
                      <td>{entry.listing.layout ?? "—"}</td>
                      <th>屋齡</th>
                      <td>{formatAge(entry.listing.age)}</td>
                    </tr>
                    <tr>
                      <th>型態</th>
                      <td>{entry.listing.houseType ?? "—"}</td>
                      <th>樓層</th>
                      <td>{entry.listing.floorInfo ?? "—"}</td>
                    </tr>
                    <tr>
                      <th>車位</th>
                      <td>{entry.listing.parking ?? "—"}</td>
                      <th>資料更新</th>
                      <td>{formatSeenAt(entry.listing.lastSeenAt)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {leg && (
                <p className="report-leg">
                  從上一站過來約 {leg.km.toFixed(1)} 公里 / {leg.minutes} 分鐘
                </p>
              )}

              {/* 每一站自己的導航。列印時不需要（紙上的連結按不了），所以標 no-print。
                  這條在「沒有座標」的物件上一樣按得出來 —— 導航靠的是社區名或地址，
                  不是座標。實際上絕大多數物件都沒有座標，這條才是你出門真正會按的按鈕。 */}
              {place && (
                <p className="report-nav no-print">
                  <a className="button-secondary" href={mapDirectionsUrl(place)} target="_blank" rel="noreferrer">
                    導航到這一站
                  </a>
                </p>
              )}

              {entry.agentNote && <p className="report-note">備註：{entry.agentNote}</p>}
              {!canRoute(entry.listing) && (
                <p className="report-note">
                  這間沒有座標，所以沒有排進上面的行車順序與里程推估。單站導航不受影響。
                </p>
              )}
              {!place && (
                <p className="report-note">這間連地址跟社區名都沒有，導航按不出來，出發前要自己確認位置。</p>
              )}
            </section>
          );
        })}

        {picked.length === 0 && <p className="empty-note">這張帶看單目前沒有可以印的物件。</p>}

        <footer className="report-foot">
          <p>
            本表資料整理自公開刊登資訊，價格與屋況以原始刊登及現場實況為準。
            {PROFILE.brand}　{PROFILE.phone}
          </p>
        </footer>
      </article>
    </div>
  );
}
