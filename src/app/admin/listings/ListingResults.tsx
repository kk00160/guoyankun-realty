"use client";

import Link from "next/link";
import { useState } from "react";
import {
  type Listing,
  type ListingStatus,
  formatAge,
  formatPing,
  formatPrice,
  formatSeenAt,
  formatUnitPrice
} from "@/lib/listings";
import { type ListingQuery, buildListingHref, describeQuery } from "@/lib/listing-filters";
import type { ListingPage } from "@/lib/tour-store";

/**
 * 搜尋結果 + 勾選加入帶看單。
 *
 * 這一支只負責顯示與勾選；篩選與分頁都在網址上，由伺服器處理。
 */
export default function ListingResults({
  query,
  result,
  tours
}: {
  query: ListingQuery;
  result: ListingPage;
  tours: { id: string; title: string }[];
}) {
  const [rows, setRows] = useState(result.rows);
  const [selected, setSelected] = useState<string[]>([]);
  const [tourId, setTourId] = useState(tours[0]?.id ?? "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function changeStatus(id: string, next: ListingStatus) {
    setBusy(id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/listings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "更新失敗");

      setRows((current) =>
        current.map((row) =>
          row.id === id
            ? { ...row, status: next, reviewReasons: next === "active" ? [] : row.reviewReasons }
            : row
        )
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setBusy("");
    }
  }

  async function addToTour() {
    if (!tourId || selected.length === 0) return;
    setBusy("add");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/tours/${encodeURIComponent(tourId)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: selected })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "加入失敗");

      const skipped: string[] = Array.isArray(payload.skipped) ? payload.skipped : [];
      setMessage(
        skipped.length > 0
          ? `已加入 ${payload.added} 筆。${skipped.length} 筆待確認的沒有加入：${skipped.join("、")}`
          : `已加入 ${payload.added} 筆。到帶看單複製連結給買方。`
      );
      setSelected([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加入失敗");
    } finally {
      setBusy("");
    }
  }

  const from = (result.page - 1) * 24 + 1;
  const to = Math.min(result.page * 24, result.total);

  return (
    <>
      <div className="result-head">
        <div>
          <b>{describeQuery(query)}</b>
          <span className="result-count">
            {result.total > 0 ? `　共 ${result.total} 筆，顯示 ${from}–${to}` : "　沒有符合的物件"}
          </span>
        </div>
      </div>

      {message && <p className="form-message">{message}</p>}

      {result.total === 0 && (
        <p className="empty-note">
          這組條件沒有找到物件。把條件放寬一點，或先跑一次匯入把更多案源抓進來。
        </p>
      )}

      <div className="listing-grid">
        {rows.map((listing) => (
          <article
            key={listing.id}
            className="listing-card"
            data-status={listing.status}
            data-selected={selected.includes(listing.id)}
          >
            <label className="listing-pick">
              <input
                type="checkbox"
                checked={selected.includes(listing.id)}
                onChange={() => toggle(listing.id)}
                disabled={listing.status !== "active"}
              />
              <span>加入帶看單</span>
            </label>

            {/* 原生 img：next/image 會把來源網站的圖片抓下來重新代管，這裡只做外連。 */}
            {listing.images[0] && (
              <img className="listing-photo" src={listing.images[0]} alt="" loading="lazy" />
            )}

            <h3>{listing.title}</h3>
            <div className="listing-price">{formatPrice(listing.totalPrice)}</div>

            <dl className="listing-meta">
              <div>
                <dt>坪數</dt>
                <dd>{formatPing(listing.ping)}</dd>
              </div>
              <div>
                <dt>單價</dt>
                <dd>{formatUnitPrice(listing.unitPrice)}</dd>
              </div>
              <div>
                <dt>格局</dt>
                <dd>{listing.layout ?? "—"}</dd>
              </div>
              <div>
                <dt>屋齡</dt>
                <dd>{formatAge(listing.age)}</dd>
              </div>
            </dl>

            <div className="tag-row tag-row-left">
              {listing.district && <span className="tag">{listing.district}</span>}
              {listing.houseType && <span className="tag">{listing.houseType}</span>}
              {listing.floorInfo && <span className="tag">{listing.floorInfo}</span>}
              {listing.lat === null && <span className="tag tag-warn">缺座標，排不了路線</span>}
            </div>

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

            <footer className="listing-foot">
              <span className="listing-seen">更新於 {formatSeenAt(listing.lastSeenAt)}</span>
              <div className="listing-actions">
                {listing.sourceUrl && (
                  <a href={listing.sourceUrl} target="_blank" rel="noreferrer">
                    看原始刊登
                  </a>
                )}
                {listing.status === "needs_review" && (
                  <button type="button" onClick={() => changeStatus(listing.id, "active")} disabled={busy === listing.id}>
                    我確認過了
                  </button>
                )}
                <button type="button" onClick={() => changeStatus(listing.id, "archived")} disabled={busy === listing.id}>
                  封存
                </button>
              </div>
            </footer>
          </article>
        ))}
      </div>

      {result.pageCount > 1 && (
        <nav className="pager" aria-label="分頁">
          {result.page > 1 && (
            <Link className="button-secondary" href={buildListingHref(query, { page: result.page - 1 })}>
              上一頁
            </Link>
          )}
          <span>
            第 {result.page} / {result.pageCount} 頁
          </span>
          {result.page < result.pageCount && (
            <Link className="button-secondary" href={buildListingHref(query, { page: result.page + 1 })}>
              下一頁
            </Link>
          )}
        </nav>
      )}

      {selected.length > 0 && (
        <div className="select-bar">
          <span>已選 {selected.length} 筆</span>
          {tours.length === 0 ? (
            <Link href="/admin/tours" className="button">
              先去開一張帶看單
            </Link>
          ) : (
            <>
              <select value={tourId} onChange={(event) => setTourId(event.target.value)}>
                {tours.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.title}
                  </option>
                ))}
              </select>
              <button type="button" className="button" onClick={addToTour} disabled={busy === "add"}>
                {busy === "add" ? "加入中…" : "加入帶看單"}
              </button>
            </>
          )}
          <button type="button" className="button-secondary" onClick={() => setSelected([])}>
            取消選取
          </button>
        </div>
      )}
    </>
  );
}
