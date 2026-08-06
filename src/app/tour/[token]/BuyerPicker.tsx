"use client";

import { useMemo, useState } from "react";
import {
  type Listing,
  formatAge,
  formatPing,
  formatPrice,
  formatSeenAt,
  formatUnitPrice
} from "@/lib/listings";
import { PROFILE } from "@/lib/profile";
import { googleMapsPlaceUrl } from "@/lib/route";
import type { BuyerChoice } from "@/lib/tour";

type Entry = {
  listingId: string;
  choice: BuyerChoice;
  listing: Listing;
};

export default function BuyerPicker({
  token,
  title,
  buyerName,
  entries
}: {
  token: string;
  title: string;
  buyerName: string | null;
  entries: Entry[];
}) {
  const [rows, setRows] = useState(entries);
  const [name, setName] = useState(buyerName ?? "");
  // 只在一開始問一次稱呼。不問電話 Email —— 對方本來就認識你，多問一欄只會讓人退出。
  const [askName, setAskName] = useState(!buyerName);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const decided = useMemo(() => rows.filter((row) => row.choice !== "pending").length, [rows]);

  async function choose(listingId: string, choice: BuyerChoice) {
    const previous = rows;
    // 先動畫面再送出：手機上網路慢的時候，按了沒反應會讓人一直重複按。
    setRows((current) =>
      current.map((row) => (row.listingId === listingId ? { ...row, choice } : row))
    );
    setBusy(listingId);
    setMessage("");

    try {
      const response = await fetch(`/api/tour/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, choice })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "沒有存成功");
      }
    } catch (error) {
      setRows(previous); // 失敗就退回原狀，不要讓畫面顯示一個沒存進去的選擇
      setMessage(error instanceof Error ? error.message : "沒有存成功，請再按一次。");
    } finally {
      setBusy("");
    }
  }

  async function submitName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy("name");
    try {
      await fetch(`/api/tour/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerName: name.trim() })
      });
      setAskName(false);
    } catch {
      setAskName(false); // 存不進去也放行，不要卡住整個流程
    } finally {
      setBusy("");
    }
  }

  if (askName) {
    return (
      <form className="buyer-gate" onSubmit={submitName}>
        <h1>{title}</h1>
        <p>這是{PROFILE.alias}幫你整理的物件清單。先讓我知道怎麼稱呼你：</p>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={50}
          placeholder="例：陳先生"
          autoFocus
        />
        <button type="submit" className="button" disabled={busy === "name" || !name.trim()}>
          開始看清單
        </button>
      </form>
    );
  }

  return (
    <div className="buyer-shell">
      <header className="buyer-head">
        <h1>{title}</h1>
        <p>
          {name ? `${name}，` : ""}共 {rows.length} 間。想看的按「想看」，沒興趣就按「略過」，
          我這邊會即時看到，再幫你排看房路線。
        </p>
        <div className="buyer-progress">
          已選 {decided} / {rows.length}
        </div>
      </header>

      {message && <p className="form-message">{message}</p>}

      <div className="buyer-list">
        {rows.map((entry) => (
          <article key={entry.listingId} className="buyer-card" data-choice={entry.choice}>
            {/* 用原生 img 外連原始刊登的圖片，不轉存到自己的網域。 */}
            {entry.listing.images[0] ? (
              <img className="buyer-photo" src={entry.listing.images[0]} alt="" loading="lazy" />
            ) : (
              <div className="buyer-photo buyer-photo-empty">沒有照片</div>
            )}

            <div className="buyer-card-body">
              <h2>{entry.listing.title}</h2>
              <div className="buyer-price">{formatPrice(entry.listing.totalPrice)}</div>

              <dl className="buyer-meta">
                <div>
                  <dt>坪數</dt>
                  <dd>{formatPing(entry.listing.ping)}</dd>
                </div>
                <div>
                  <dt>格局</dt>
                  <dd>{entry.listing.layout ?? "—"}</dd>
                </div>
                <div>
                  <dt>單價</dt>
                  <dd>{formatUnitPrice(entry.listing.unitPrice)}</dd>
                </div>
                <div>
                  <dt>屋齡</dt>
                  <dd>{formatAge(entry.listing.age)}</dd>
                </div>
              </dl>

              <p className="buyer-where">
                {entry.listing.district ?? ""}
                {entry.listing.houseType ? `　${entry.listing.houseType}` : ""}
                {entry.listing.floorInfo ? `　${entry.listing.floorInfo}` : ""}
              </p>

              {/* 資料來源與更新時間固定顯示：這是一份快照，不是即時報價。 */}
              <p className="buyer-source">
                資料更新於 {formatSeenAt(entry.listing.lastSeenAt)}
                {entry.listing.source === "591" && "　·　資料來源：591"}
                {entry.listing.sourceUrl && (
                  <>
                    　·{" "}
                    <a href={entry.listing.sourceUrl} target="_blank" rel="noreferrer">
                      看原始刊登
                    </a>
                  </>
                )}
                {entry.listing.lat !== null && entry.listing.lng !== null && (
                  <>
                    　·{" "}
                    <a
                      href={googleMapsPlaceUrl({ lat: entry.listing.lat, lng: entry.listing.lng })}
                      target="_blank"
                      rel="noreferrer"
                    >
                      看地圖
                    </a>
                  </>
                )}
              </p>
            </div>

            <div className="buyer-actions">
              <button
                type="button"
                className="buyer-yes"
                data-on={entry.choice === "interested"}
                onClick={() => choose(entry.listingId, entry.choice === "interested" ? "pending" : "interested")}
                disabled={busy === entry.listingId}
              >
                想看
              </button>
              <button
                type="button"
                className="buyer-no"
                data-on={entry.choice === "rejected"}
                onClick={() => choose(entry.listingId, entry.choice === "rejected" ? "pending" : "rejected")}
                disabled={busy === entry.listingId}
              >
                略過
              </button>
            </div>
          </article>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="empty-note">這份清單目前還沒有物件，我整理好會再通知你。</p>
      )}

      <footer className="buyer-foot">
        <p>
          清單上的價格與屋況資料以原始刊登為準，實際情況我會在現場跟你確認。
          有任何一間想先問細節，直接打給我。
        </p>
        <a className="button" href={`tel:${PROFILE.phoneRaw}`}>
          打給{PROFILE.alias}　{PROFILE.phone}
        </a>
      </footer>
    </div>
  );
}
