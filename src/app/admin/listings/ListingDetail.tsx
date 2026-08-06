"use client";

import { useEffect, useState } from "react";
import {
  type Listing,
  formatAge,
  formatPing,
  formatPrice,
  formatSeenAt,
  formatUnitPrice
} from "@/lib/listings";
import { googleMapsPlaceUrl } from "@/lib/route";

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

  const specs: [string, string][] = [
    ["總價", formatPrice(listing.totalPrice)],
    ["單價", formatUnitPrice(listing.unitPrice)],
    ["權狀坪數", formatPing(listing.ping)],
    ["格局", listing.layout ?? "—"],
    ["屋齡", formatAge(listing.age)],
    ["型態", listing.houseType ?? "—"],
    ["樓層", listing.floorInfo ?? "—"],
    ["車位", listing.parking ?? "—"],
    ["行政區", listing.district ?? "—"],
    ["地址", listing.address ?? "未提供"]
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

        <div className="detail-body">
          <div className="detail-gallery">
            {photos.length > 0 ? (
              <>
                {/* 原生 img：不把來源網站的圖片轉存到自己的網域。 */}
                <img className="detail-photo" src={photos[index]} alt="" />
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
                    <img src={src} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="detail-side">
            <div className="detail-price">{formatPrice(listing.totalPrice)}</div>

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
              {listing.lat !== null && listing.lng !== null && (
                <a
                  className="button-secondary"
                  href={googleMapsPlaceUrl({ lat: listing.lat, lng: listing.lng })}
                  target="_blank"
                  rel="noreferrer"
                >
                  看地圖
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
