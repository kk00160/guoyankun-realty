"use client";

import { useEffect, useState } from "react";
import {
  type Listing,
  formatAge,
  formatPing,
  formatPrice,
  formatSeenAt,
  formatUnitPrice,
  publicRatio,
  resizeImage
} from "@/lib/listings";
import { googleMapsPlaceUrl, mapPlaceUrl, mapTarget } from "@/lib/route";

/**
 * 物件詳細資料，蓋在搜尋結果上面。
 *
 * 用蓋的而不是跳到另一頁，是因為挑物件時會一直開開關關 ——
 * 跳頁的話每關一次就要等搜尋結果重新載入，還會失去捲動位置。
 */
export default function ListingDetail({
  listing,
  selected,
  onToggle,
  onClose
}: {
  listing: Listing;
  selected: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const photos = listing.images;

  // Esc 關閉、左右鍵翻照片。挑物件時手不用離開鍵盤。
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((i) => (photos.length ? (i + 1) % photos.length : 0));
      if (event.key === "ArrowLeft") setIndex((i) => (photos.length ? (i - 1 + photos.length) % photos.length : 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, photos.length]);

  const ratio = publicRatio(listing);
  const place = mapTarget(listing);

  // 一眼要看到的四個數字，放在標題底下，不用捲動。
  const highlights: [string, string][] = [
    ["權狀", formatPing(listing.ping)],
    ["格局", listing.layout ?? "—"],
    ["屋齡", formatAge(listing.age)],
    ["單價", formatUnitPrice(listing.unitPrice)]
  ];

  const specs: [string, string][] = [
    ["權狀坪數", formatPing(listing.ping)],
    ["主建物", listing.mainArea ? `${listing.mainArea.toFixed(1)} 坪` : "—"],
    ["公設比", ratio === null ? "—" : `約 ${ratio.toFixed(0)}%`],
    ["格局", listing.layout ?? "—"],
    ["屋齡", formatAge(listing.age)],
    ["型態", listing.houseType ?? "—"],
    ["用途", listing.kindName ?? "—"],
    ["樓層", listing.floorInfo ?? "—"],
    ["車位", listing.parking ?? "—"],
    ["社區", listing.communityName ?? "—"],
    ["行政區", listing.district ?? "—"],
    ["地址", listing.address ?? "未提供"],
    ["刊登", listing.postedLabel ?? "—"],
    ["刊登者", listing.sellerLabel ?? "—"]
  ];

  return (
    <div className="detail-backdrop" onClick={onClose} role="presentation">
      <div className="detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="detail-head">
          <h2>{listing.title}</h2>
          <button type="button" className="detail-close" onClick={onClose} aria-label="關閉">
            ✕
          </button>
        </header>

        {/* 重點數字放最上面：視窗窄的時候規格表會被擠到照片下面，
            但這一列永遠看得到。 */}
        <div className="detail-highlights">
          <div className="detail-price">{formatPrice(listing.totalPrice)}</div>
          <dl>
            {highlights.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="detail-body">
          <div className="detail-gallery">
            {photos.length > 0 ? (
              <>
                {/* 原生 img：不把來源網站的圖片轉存到自己的網域。 */}
                <img className="detail-photo" src={resizeImage(photos[index], "full")} alt="" />
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="detail-nav detail-prev"
                      onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
                      aria-label="上一張"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="detail-nav detail-next"
                      onClick={() => setIndex((i) => (i + 1) % photos.length)}
                      aria-label="下一張"
                    >
                      ›
                    </button>
                    <div className="detail-counter">
                      {index + 1} / {photos.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="detail-photo detail-photo-empty">
                還沒有照片
                <small>跑一次匯入就會把 591 上的照片一起帶回來</small>
              </div>
            )}

            {photos.length > 1 && (
              <div className="detail-thumbs">
                {photos.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    className="detail-thumb"
                    data-on={i === index}
                    onClick={() => setIndex(i)}
                    aria-label={`第 ${i + 1} 張`}
                  >
                    <img src={resizeImage(src, "thumb")} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="detail-side">
            {listing.tags.length > 0 && (
              <div className="tag-row tag-row-left detail-tags">
                {listing.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {listing.communitySaleNum !== null && listing.communitySaleNum > 1 && (
              <p className="detail-hint">
                同社區還有 {listing.communitySaleNum} 間在賣 —— 談價時可以拿來比。
              </p>
            )}

            <dl className="detail-specs">
              {specs.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            {listing.status === "needs_review" && (
              <div className="review-box">
                <b>資料待確認，買方頁看不到這筆</b>
                <ul>
                  {listing.reviewReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="detail-source">
              資料更新於 {formatSeenAt(listing.lastSeenAt)}
              {listing.source === "591" && "　·　資料來源：591"}
            </p>

            <div className="detail-actions">
              <button
                type="button"
                className={selected ? "button-secondary" : "button"}
                onClick={onToggle}
                disabled={listing.status !== "active"}
              >
                {selected ? "取消選取" : "選取這間"}
              </button>
              {listing.sourceUrl && (
                <a className="button-secondary" href={listing.sourceUrl} target="_blank" rel="noreferrer">
                  看原始刊登
                </a>
              )}
              {/* 主要地圖連結走社區名／地址（見 mapTarget）。
                  有座標時另外給一顆純座標的，兩顆對不起來就是資料有問題，值得看一眼。 */}
              {place && (
                <a className="button-secondary" href={mapPlaceUrl(place)} target="_blank" rel="noreferrer">
                  {place.kind === "community" ? "看社區位置" : "看地圖"}
                </a>
              )}
              {listing.lat !== null && listing.lng !== null && (
                <a
                  className="button-secondary"
                  href={googleMapsPlaceUrl({ lat: listing.lat, lng: listing.lng })}
                  target="_blank"
                  rel="noreferrer"
                >
                  核對座標
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
