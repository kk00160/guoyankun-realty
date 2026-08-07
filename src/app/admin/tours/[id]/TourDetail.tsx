"use client";

import Link from "next/link";
import { useState } from "react";
import { buyerTourUrl } from "@/lib/buyer-link";
import { formatPing, formatPrice, formatSeenAt, formatUnitPrice } from "@/lib/listings";
import { mapDirectionsUrl, mapTarget } from "@/lib/route";
import { BUYER_CHOICE_LABEL, type Tour, formatTourDate, isTourOpen } from "@/lib/tour";
import type { TourEntry } from "@/lib/tour-store";

type RouteResult = {
  summary: { stops: number; km: number; minutes: number };
  mapUrls: string[];
  missingCoords: string[];
};


export default function TourDetail({ tour, entries }: { tour: Tour; entries: TourEntry[] }) {
  const [rows, setRows] = useState(entries);
  const [token, setToken] = useState(tour.token);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const interested = rows.filter((row) => row.buyerChoice === "interested").length;
  const rejected = rows.filter((row) => row.buyerChoice === "rejected").length;
  const pending = rows.filter((row) => row.buyerChoice === "pending").length;

  async function planRoute(scope: "interested" | "remaining") {
    setBusy("route");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/tours/${encodeURIComponent(tour.id)}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "排路線失敗");

      const order: string[] = payload.order;
      setRoute({
        summary: payload.summary,
        mapUrls: payload.mapUrls,
        missingCoords: payload.missingCoords ?? []
      });

      // 依照回傳的順序重排畫面，排進路線的在前、沒排進去的在後。
      setRows((current) => {
        const rank = new Map(order.map((id, index) => [id, index]));
        return [...current]
          .map((row) => ({ ...row, visitOrder: rank.has(row.listingId) ? rank.get(row.listingId)! + 1 : null }))
          .sort((a, b) => (a.visitOrder ?? 999) - (b.visitOrder ?? 999));
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "排路線失敗");
    } finally {
      setBusy("");
    }
  }

  async function removeItem(listingId: string) {
    setBusy(listingId);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/tours/${encodeURIComponent(tour.id)}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "移除失敗");

      setRows((current) => current.filter((row) => row.listingId !== listingId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "移除失敗");
    } finally {
      setBusy("");
    }
  }

  async function saveNote(listingId: string, agentNote: string) {
    try {
      await fetch(`/api/admin/tours/${encodeURIComponent(tour.id)}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, agentNote })
      });
    } catch {
      setMessage("備註沒存成功，請再試一次。");
    }
  }

  async function rotate() {
    if (!window.confirm("換一把新鑰匙之後，你之前傳給買方的舊連結會立刻打不開。確定嗎？")) return;
    setBusy("rotate");
    try {
      const response = await fetch(`/api/admin/tours/${encodeURIComponent(tour.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotateToken: true })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "更新失敗");
      setToken(payload.token);
      setMessage("已產生新連結，舊連結已失效。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setBusy("");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(buyerTourUrl(token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("瀏覽器不給複製，請手動選取連結。");
    }
  }

  return (
    <div className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>{tour.title}</h1>
          <p>
            {tour.buyerName ?? "買方尚未填稱呼"}　·　共 {rows.length} 間　·　想看 {interested}　·
            略過 {rejected}　·　未選 {pending}
          </p>
        </div>
        <Link className="button-secondary" href="/admin/tours">
          回帶看單列表
        </Link>
      </div>

      {tour.submittedAt && (
        <p className="submitted-bar">
          ✅ 買方已於 {formatTourDate(tour.submittedAt)} 送出，勾了 {interested} 間想看。可以排路線安排帶看了。
        </p>
      )}

      {!isTourOpen(tour) && (
        <p className="alert-bar" role="alert">
          這張帶看單目前是關閉的（{formatTourDate(tour.expiresAt)} 到期），買方點連結會看到說明頁。
        </p>
      )}

      <div className="tour-link-row">
        <code>{buyerTourUrl(token)}</code>
        <button type="button" onClick={copyLink}>
          {copied ? "已複製" : "複製連結"}
        </button>
        <button type="button" onClick={rotate} disabled={busy === "rotate"}>
          換一把新鑰匙
        </button>
      </div>

      <div className="filter-row">
        <button type="button" className="button" onClick={() => planRoute("interested")} disabled={busy === "route"}>
          {busy === "route" ? "計算中…" : "照「想看」排路線"}
        </button>
        <button type="button" className="button-secondary" onClick={() => planRoute("remaining")} disabled={busy === "route"}>
          排全部（略過的除外）
        </button>
        <Link className="button-secondary" href={`/admin/tours/${tour.id}/report`}>
          產生帶看單
        </Link>
        <Link className="button-secondary" href="/admin/listings">
          去案源庫加物件
        </Link>
      </div>

      {message && <p className="form-message">{message}</p>}

      {route && (
        <section className="route-box">
          <h2>看房路線</h2>
          <p>
            共 {route.summary.stops} 站　·　概估里程 {route.summary.km.toFixed(1)} 公里　·
            概估車程 {route.summary.minutes} 分鐘（不含看房時間）
          </p>
          <p className="route-note">
            里程與車程是用直線距離乘上繞路係數推估的，不是導航實測值，只拿來抓大概。
          </p>
          {route.mapUrls.map((url, index) => (
            <a key={url} className="button" href={url} target="_blank" rel="noreferrer">
              {route.mapUrls.length > 1 ? `用 Google Maps 導航（第 ${index + 1} 段）` : "用 Google Maps 導航"}
            </a>
          ))}
          {route.missingCoords.length > 0 && (
            <p className="alert-bar">
              這 {route.missingCoords.length} 間沒有經緯度，排不進行車順序：{route.missingCoords.join("、")}。
              跑 <code>npm run fill</code> 補座標就會納入。單間導航不受影響，下面每一間都還是按得出來。
            </p>
          )}
        </section>
      )}

      <div className="tour-item-list">
        {rows.map((entry) => {
          const place = mapTarget(entry.listing);
          return (
          <article key={entry.id} className="tour-item" data-choice={entry.buyerChoice}>
            <div className="tour-item-order">{entry.visitOrder ?? "—"}</div>

            <div className="tour-item-body">
              <h3>{entry.listing.title}</h3>
              <p className="tour-item-meta">
                {formatPrice(entry.listing.totalPrice)}　·　{formatPing(entry.listing.ping)}　·
                {formatUnitPrice(entry.listing.unitPrice)}　·　{entry.listing.layout ?? "格局未提供"}
              </p>
              <p className="tour-item-meta">
                {entry.listing.district ?? "—"}　{entry.listing.address ?? ""}
                {/* 幾乎每一筆都沒有座標，所以這個標籤要講清楚它只影響「排順序」，
                    不要讓人以為這間連導航都按不出來。 */}
                {entry.listing.lat === null && <span className="tag tag-warn">無座標·排順序時略過</span>}
              </p>

              <label className="tour-item-note">
                我的備註（買方看不到）
                <input
                  defaultValue={entry.agentNote ?? ""}
                  maxLength={500}
                  onBlur={(event) => saveNote(entry.listingId, event.target.value)}
                  placeholder="例：屋主開價硬，可談空間小；車位另計"
                />
              </label>
            </div>

            <div className="tour-item-side">
              <span className="choice-badge" data-choice={entry.buyerChoice}>
                {BUYER_CHOICE_LABEL[entry.buyerChoice]}
              </span>
              <span className="listing-seen">更新於 {formatSeenAt(entry.listing.lastSeenAt)}</span>
              <div className="listing-actions">
                {place && (
                  <a href={mapDirectionsUrl(place)} target="_blank" rel="noreferrer" title={place.hint}>
                    導航
                  </a>
                )}
                {entry.listing.sourceUrl && (
                  <a href={entry.listing.sourceUrl} target="_blank" rel="noreferrer">
                    原始刊登
                  </a>
                )}
                <button type="button" onClick={() => removeItem(entry.listingId)} disabled={busy === entry.listingId}>
                  移除
                </button>
              </div>
            </div>
          </article>
          );
        })}
      </div>

      {rows.length === 0 && (
        <p className="empty-note">
          這張帶看單還沒有物件。到 <Link href="/admin/listings">案源庫</Link> 勾選後加進來。
        </p>
      )}
    </div>
  );
}
