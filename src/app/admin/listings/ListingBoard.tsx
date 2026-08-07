"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type Listing,
  type ListingStatus,
  TAINAN_DISTRICTS,
  dedupeKey,
  formatAge,
  formatPing,
  formatPrice,
  formatSeenAt,
  formatUnitPrice
} from "@/lib/listings";
import type { CrawlRun } from "@/lib/tour-store";

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "可用 + 待確認" },
  { key: "active", label: "只看可用" },
  { key: "needs_review", label: "只看待確認" },
  { key: "archived", label: "已封存" },
  { key: "sold", label: "已成交／下架" }
];

type Props = {
  listings: Listing[];
  tours: { id: string; title: string }[];
  status: string;
  crawlerHealth: { broken: boolean; reason: string };
  latestRun: CrawlRun | null;
};

export default function ListingBoard({ listings, tours, status, crawlerHealth, latestRun }: Props) {
  const [rows, setRows] = useState(listings);
  const [district, setDistrict] = useState("");
  const [keyword, setKeyword] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [tourId, setTourId] = useState(tours[0]?.id ?? "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  // 疑似重複刊登（同區 + 同總價 + 同坪數）。不自動合併，只標記出來讓你自己判斷。
  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const key = dedupeKey(row);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [rows]);

  const visible = useMemo(() => {
    const max = Number(maxPrice);
    return rows.filter((row) => {
      if (district && row.district !== district) return false;
      if (keyword && !`${row.title}${row.address ?? ""}`.includes(keyword)) return false;
      if (Number.isFinite(max) && max > 0 && (row.totalPrice ?? 0) > max) return false;
      return true;
    });
  }, [rows, district, keyword, maxPrice]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((row) => row.status === "active").length,
      review: rows.filter((row) => row.status === "needs_review").length,
      duplicate: rows.filter((row) => {
        const key = dedupeKey(row);
        return key ? duplicateKeys.has(key) : false;
      }).length
    }),
    [rows, duplicateKeys]
  );

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
          row.id === id ? { ...row, status: next, reviewReasons: next === "active" ? [] : row.reviewReasons } : row
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

      const skipped = Array.isArray(payload.skipped) ? payload.skipped : [];
      setMessage(
        skipped.length > 0
          ? `已加入 ${payload.added} 筆。${skipped.length} 筆待確認的沒有加入：${skipped.join("、")}`
          : `已加入 ${payload.added} 筆。`
      );
      setSelected([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加入失敗");
    } finally {
      setBusy("");
    }
  }

  async function submitManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("manual");
    setMessage("");
    try {
      const response = await fetch("/api/admin/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries()))
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "新增失敗");

      setRows((current) => [payload.listing as Listing, ...current]);
      setMessage("已新增一筆案源。");
      setShowForm(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增失敗");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>案源庫</h1>
          <p>
            勾選物件後加進帶看單，買方就能在手機上挑。
            {latestRun && <>　最近一次匯入：{formatSeenAt(latestRun.startedAt)}（{latestRun.found} 筆）</>}
          </p>
        </div>
        <button type="button" className="button-secondary" onClick={() => setShowForm((value) => !value)}>
          {showForm ? "收起" : "手動新增案源"}
        </button>
      </div>

      {crawlerHealth.broken && (
        <p className="alert-bar" role="alert">
          ⚠️ 資料匯入可能已經失效：{crawlerHealth.reason}。在拿資料跟買方談之前，先自己開原始刊登對一下。
        </p>
      )}

      {showForm && (
        <form className="manual-form" onSubmit={submitManual}>
          <p className="manual-form-hint">
            自己的案、公司內部案、朋友託售都填這裡。填了地址座標才排得進看房路線。
          </p>
          <div className="manual-grid">
            <label>
              <span className="field-label">
                物件名稱 <span className="required">必填</span>
              </span>
              <input name="title" required maxLength={200} placeholder="東區崇明路 3 房電梯" />
            </label>
            <label>
              行政區
              <select name="district" defaultValue="">
                <option value="">未指定</option>
                {TAINAN_DISTRICTS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              總價（萬）
              <input name="totalPrice" type="number" step="1" min="0" placeholder="1280" />
            </label>
            <label>
              權狀坪數
              <input name="ping" type="number" step="0.1" min="0" placeholder="42.5" />
            </label>
            <label>
              格局
              <input name="layout" maxLength={50} placeholder="3房2廳2衛" />
            </label>
            <label>
              屋齡（年）
              <input name="age" type="number" step="1" min="0" placeholder="12" />
            </label>
            <label>
              型態
              <input name="houseType" maxLength={30} placeholder="電梯大樓" />
            </label>
            <label>
              樓層
              <input name="floorInfo" maxLength={30} placeholder="7F/14F" />
            </label>
            <label className="span-2">
              地址
              <input name="address" maxLength={200} placeholder="台南市東區崇明路 000 號" />
            </label>
            <label>
              緯度
              <input name="lat" type="number" step="0.000001" placeholder="22.9799" />
            </label>
            <label>
              經度
              <input name="lng" type="number" step="0.000001" placeholder="120.2270" />
            </label>
            <label className="span-2">
              原始刊登網址
              <input name="sourceUrl" maxLength={500} placeholder="https://..." />
            </label>
          </div>
          <button type="submit" className="button" disabled={busy === "manual"}>
            {busy === "manual" ? "新增中…" : "新增案源"}
          </button>
        </form>
      )}

      <div className="stat-grid stat-grid-4">
        <div className="stat">
          <div className="stat-label">總筆數</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat">
          <div className="stat-label">可用</div>
          <div className="stat-value">{stats.active}</div>
        </div>
        <div className="stat">
          <div className="stat-label">待確認</div>
          <div className="stat-value">{stats.review}</div>
        </div>
        <div className="stat">
          <div className="stat-label">疑似重複</div>
          <div className="stat-value">{stats.duplicate}</div>
        </div>
      </div>

      <div className="filter-row">
        {STATUS_FILTERS.map((item) => (
          <Link
            key={item.key}
            href={item.key === "all" ? "/admin/listings" : `/admin/listings?status=${item.key}`}
            data-active={status === item.key}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="filter-row">
        <select value={district} onChange={(event) => setDistrict(event.target.value)}>
          <option value="">全部行政區</option>
          {TAINAN_DISTRICTS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜尋物件名稱或地址"
        />
        <input
          value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)}
          type="number"
          placeholder="總價上限（萬）"
        />
      </div>

      {message && <p className="form-message">{message}</p>}

      <div className="listing-grid">
        {visible.map((listing) => {
          const key = dedupeKey(listing);
          const duplicate = key ? duplicateKeys.has(key) : false;

          return (
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

              {/* 刻意用原生 img 而不是 next/image：next/image 會把來源網站的圖片抓下來重新代管，
                  那等於把別人的圖片轉存到自己的網域。這裡只做外連。 */}
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
                <span className="tag">{listing.source === "591" ? "591" : "自建"}</span>
                {duplicate && <span className="tag tag-warn">疑似重複刊登</span>}
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
                  {listing.status !== "archived" && (
                    <button type="button" onClick={() => changeStatus(listing.id, "archived")} disabled={busy === listing.id}>
                      封存
                    </button>
                  )}
                  {listing.status === "archived" && (
                    <button type="button" onClick={() => changeStatus(listing.id, "active")} disabled={busy === listing.id}>
                      取回
                    </button>
                  )}
                </div>
              </footer>
            </article>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className="empty-note">
          目前這個條件下沒有案源。
          {status === "all" && rows.length === 0 && "先跑一次匯入，或用右上角手動新增一筆。"}
        </p>
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

      <p className="note-line">
        待確認（紅框）的物件不能加進帶看單，也永遠不會出現在買方頁。
        這是刻意的 —— 外部來源出問題時可能回傳看起來正常的錯誤數值，而且不會報錯。
        你自己開原始刊登對過之後，按「我確認過了」就會放行。
      </p>
    </div>
  );
}
