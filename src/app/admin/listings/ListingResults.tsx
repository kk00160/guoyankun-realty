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
import { buyerTourUrl, isLocalPreview, localTourUrl } from "@/lib/buyer-link";
import { type ListingQuery, buildListingHref, describeQuery } from "@/lib/listing-filters";
import type { ListingPage } from "@/lib/tour-store";
import ListingDetail from "./ListingDetail";

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
  const [openId, setOpenId] = useState<string | null>(null);
  // 產好的買方連結留在畫面上，不用再跳到帶看單頁去複製。
  const [madeLink, setMadeLink] = useState<{
    url: string;
    preview: string;
    title: string;
    count: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

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

  /**
   * 挑好 → 直接產生買方連結。
   *
   * 原本要先去 /admin/tours 開單、回來勾選、再回去複製連結，三頁跳來跳去；
   * 沒有帶看單的時候更是直接卡死。這支一次做完，連結當場給你。
   * 帶看單名稱預設用搜尋條件，之後在帶看單頁還可以改。
   */
  async function makeLink() {
    if (selected.length === 0) return;
    setBusy("link");
    setMessage("");
    try {
      const title = `${describeQuery(query)}　${new Date().toLocaleDateString("zh-TW")}`;
      const response = await fetch("/api/admin/tours/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, listingIds: selected })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "產生連結失敗");

      setMadeLink({
        // 一律用正式站網址：localhost 的連結傳給買方永遠打不開。
        url: buyerTourUrl(payload.token),
        preview: localTourUrl(payload.token),
        title: payload.tour.title,
        count: payload.added
      });
      const skipped: string[] = Array.isArray(payload.skipped) ? payload.skipped : [];
      if (skipped.length > 0) {
        setMessage(`${skipped.length} 筆待確認的沒有加入：${skipped.join("、")}`);
      }
      setSelected([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "產生連結失敗");
    } finally {
      setBusy("");
    }
  }

  async function copyLink() {
    if (!madeLink) return;
    try {
      await navigator.clipboard.writeText(madeLink.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("瀏覽器不給複製，請手動選取連結。");
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
            <label className="listing-pick" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selected.includes(listing.id)}
                onChange={() => toggle(listing.id)}
                disabled={listing.status !== "active"}
              />
              <span>加入帶看單</span>
            </label>

            {/* 整張卡片可點開詳細；勾選框在上面，已用 stopPropagation 隔開。 */}
            <button type="button" className="listing-open" onClick={() => setOpenId(listing.id)}>
              {/* 原生 img：next/image 會把來源網站的圖片抓下來重新代管，這裡只做外連。 */}
              {listing.images[0] && (
                <img className="listing-photo" src={listing.images[0]} alt="" loading="lazy" />
              )}
              {listing.images.length > 1 && (
                <span className="listing-photo-count">{listing.images.length} 張</span>
              )}
              <h3>{listing.title}</h3>
              <span className="listing-more">看詳細資料與照片 →</span>
            </button>
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

      {madeLink && (
        <div className="made-link">
          <div>
            <b>買方連結已產生</b>
            <span>
              　{madeLink.title}　·　{madeLink.count} 間
            </span>
          </div>
          <div className="made-link-row">
            <code>{madeLink.url}</code>
            <button type="button" className="button" onClick={copyLink}>
              {copied ? "已複製" : "複製連結"}
            </button>
            <a className="button-secondary" href={madeLink.preview} target="_blank" rel="noreferrer">
              自己先看一次
            </a>
            <button type="button" className="button-secondary" onClick={() => setMadeLink(null)}>
              關閉
            </button>
          </div>
          <p className="made-link-note">
            {isLocalPreview() ? (
              <>
                ⚠️ 這是<b>正式站</b>的網址，要等正式站設好環境變數才會通（現在點會 404）。
                「自己先看一次」開的是本機版本，只有你這台電腦看得到。
              </>
            ) : (
              <>把連結傳給買方就好。他勾完「想看」，你在帶看單那邊會即時看到，接著就能排路線。</>
            )}
          </p>
        </div>
      )}

      {selected.length > 0 && (
        <div className="select-bar">
          <span>已選 {selected.length} 筆</span>

          <button type="button" className="button" onClick={makeLink} disabled={busy === "link"}>
            {busy === "link" ? "產生中…" : "產生買方連結"}
          </button>

          {/* 想併進已經開好的單才需要這個，平常直接按上面那顆就好。 */}
          {tours.length > 0 && (
            <>
              <span className="select-bar-or">或加進現有的</span>
              <select value={tourId} onChange={(event) => setTourId(event.target.value)}>
                {tours.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.title}
                  </option>
                ))}
              </select>
              <button type="button" className="button-secondary" onClick={addToTour} disabled={busy === "add"}>
                {busy === "add" ? "加入中…" : "加入"}
              </button>
            </>
          )}

          <button type="button" className="button-secondary" onClick={() => setSelected([])}>
            取消選取
          </button>
        </div>
      )}

      {openId && (() => {
        const listing = rows.find((row) => row.id === openId);
        if (!listing) return null;
        return (
          <ListingDetail
            listing={listing}
            selected={selected.includes(listing.id)}
            onToggle={() => toggle(listing.id)}
            onClose={() => setOpenId(null)}
          />
        );
      })()}

    </>
  );
}
