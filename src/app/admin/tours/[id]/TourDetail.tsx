"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buyerTourUrl } from "@/lib/buyer-link";
import { displayAddress, formatPing, formatPrice, formatSeenAt, formatUnitPrice } from "@/lib/listings";
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
  /** 手動排順序的存檔狀態。"" 沒動過　saving 存檔中　saved 已存　failed 沒存成功 */
  const [orderState, setOrderState] = useState<"" | "saving" | "saved" | "failed">("");

  const interested = rows.filter((row) => row.buyerChoice === "interested").length;
  const rejected = rows.filter((row) => row.buyerChoice === "rejected").length;
  const pending = rows.filter((row) => row.buyerChoice === "pending").length;
  /** 只有封面照的物件。全庫有 98.7% 是這樣，補過的才會有完整相簿。 */
  const thin = rows.filter((row) => (row.listing.images?.length ?? 0) <= 1);

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

  // ---------------------------------------------------------------
  // 手動調整看房順序
  //
  // 自動排路線算的是「路程最短」，但實際帶看還有屋主方便的時間、
  // 想壓軸的那間、中午順路吃飯 —— 那些演算法不知道。
  // 所以自動排完之後一定要能自己搬，而且後搬的要蓋掉先前自動排的結果。
  // ---------------------------------------------------------------

  const pendingOrder = useRef<string[] | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * rows 的同步鏡像，moveItem 一律讀這個而不是讀 state。
   *
   * 實測過（同一個 tick 裡連按三下）：讀 state 的話，第二、三下拿到的都還是
   * 第一下之前的順序，三次操作只會生效一次 —— 而畫面跟資料庫是一致的，
   * 所以看起來完全正常，只是有幾下沒吃到。順序默默錯掉是這套系統最不能出的錯，
   * 手上那張印出來的帶看單就是照它排的。
   */
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  /**
   * 把還在等的順序送出去。
   *
   * 只讀 ref 不讀 state，所以哪一次 render 的閉包呼叫它都拿得到最新的順序 ——
   * 下面 unmount 時要用到這一點。
   */
  async function flushOrder() {
    const order = pendingOrder.current;
    if (!order) return;
    pendingOrder.current = null;
    try {
      const response = await fetch(`/api/admin/tours/${encodeURIComponent(tour.id)}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "順序沒存成功");
      setOrderState("saved");
    } catch {
      setOrderState("failed");
    }
  }

  /**
   * 慢半拍再存。
   *
   * 連按三下箭頭是一個動作不是三個，等他停手再送一次就好：
   * 少跑兩趟資料庫，也避免三個請求回來的先後順序跟送出去的不一樣，
   * 最後存進去的反而是中間那個狀態。
   */
  function queueSave(order: string[]) {
    pendingOrder.current = order;
    setOrderState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flushOrder(), 500);
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // 剛按完箭頭就跳去「產生帶看單」的話，那半秒的等待會來不及。
      // 站內換頁不會把 JS 環境砍掉，所以這裡補送得出去。
      void flushOrder();
    };
    // flushOrder 只讀 ref 與 tour.id，不需要重新綁。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function moveItem(listingId: string, delta: -1 | 1) {
    const current = rowsRef.current;
    const index = current.findIndex((row) => row.listingId === listingId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= current.length) return;

    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];

    // 螢幕上看到的順序就是要存的順序，所以站號一律從 1 重編、不留洞。
    // 留洞的話「第 3 站」跟「從上面數下來第 3 個」會對不起來，
    // 而你手上拿的是印出來的那張紙，對不起來就是站錯地方。
    const renumbered = next.map((row, position) => ({ ...row, visitOrder: position + 1 }));
    rowsRef.current = renumbered;
    setRows(renumbered);
    queueSave(renumbered.map((row) => row.listingId));
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

  /**
   * 存這間房子的正確門牌。
   *
   * 存在物件上而不是這筆帶看紀錄上：門牌是房子的屬性，不是這次帶看的屬性。
   * 補一次，以後每一份帶看單、每一條買方連結都直接受惠。
   */
  async function saveExactAddress(listingId: string, exactAddress: string) {
    try {
      const response = await fetch(`/api/admin/listings/${encodeURIComponent(listingId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exactAddress })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "地址沒存成功");
      setRows((current) =>
        current.map((row) =>
          row.listingId === listingId
            ? { ...row, listing: { ...row.listing, exactAddress: exactAddress.trim() || null } }
            : row
        )
      );
      setMessage(exactAddress.trim() ? "正確地址已存，導航會改用這個。" : "已清掉正確地址。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "地址沒存成功");
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
          回帶看日記
        </Link>
      </div>

      {tour.submittedAt && (
        <p className="submitted-bar">
          ✅ 買方已於 {formatTourDate(tour.submittedAt)} 送出，勾了 {interested} 間想看。可以排路線安排帶看了。
        </p>
      )}

      {!isTourOpen(tour) && (
        <p className="alert-bar" role="alert">
          這筆帶看紀錄目前是關閉的（{formatTourDate(tour.expiresAt)} 到期），買方點連結會看到說明頁。
        </p>
      )}

      {/* 「照片只有封面」這件事一定要在複製連結之前講。
          批次匯入走的是清單 API，一次只帶回一張封面照；完整相簿要一筆一筆開明細頁補。
          實際發生過：整份連結傳給買方之後才發現每間房子都只有一張照片，
          而畫面上完全沒有任何提示，只有買方看得到那個結果。 */}
      {thin.length > 0 && (
        <p className="alert-bar" role="alert">
          <b>這 {thin.length} 間目前只有封面照。</b>
          　照片會自動補（每 5 分鐘檢查一次，一筆約 5 秒，這批大約 {Math.ceil((thin.length * 5) / 60)} 分鐘），
          等一下重新整理這一頁就會好，再把連結傳出去。
        </p>
      )}

      <div className="tour-link-row">
        <code>{buyerTourUrl(token)}</code>
        <button type="button" onClick={copyLink}>
          {copied ? "已複製" : "複製挑選連結"}
        </button>
        <button type="button" onClick={rotate} disabled={busy === "rotate"}>
          換一把新鑰匙
        </button>
      </div>

      {/* 同一個 token 有兩條買方連結，性質完全不同，一定要在按下去之前講清楚。
          決定買方看到什麼的是「你複製了哪一條」，不是任何開關 —— 你在複製的當下
          就知道這次是要他挑、還是行程已經定了，不需要再去別的地方設定一次。 */}
      <p className="tour-link-note">
        上面這條是<b>挑選連結</b>：買方打開會看到想看／略過，是請他先挑。
        <br />
        行程已經談定、只是要把順序跟導航發給他 —— 那要按下面的<b>「產生帶看單」</b>，
        那一頁裡的<b>「複製行程連結」</b>才是對的那條。
      </p>

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
          去配案系統加物件
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

      {rows.length > 1 && (
        <p className="order-hint">
          左邊的 <b>↑ ↓</b> 可以自己搬順序，搬完自動存，帶看單與買方的行程連結都會跟著改。
          {orderState === "saving" && <span className="order-state">儲存中…</span>}
          {orderState === "saved" && <span className="order-state is-done">順序已存</span>}
        </p>
      )}

      {/* 順序沒存成功一定要講。畫面上已經搬好了，看起來像成功了，
          但重新整理就會跳回去 —— 而你可能已經把帶看單印出來了。 */}
      {orderState === "failed" && (
        <p className="alert-bar" role="alert">
          <b>順序沒存進去。</b>
          　畫面上是你排的樣子，但資料庫還是舊的，現在去產生帶看單會拿到舊順序。
          再按一次上下箭頭重試，或重新整理這一頁看目前真正存著的順序。
        </p>
      )}

      <div className="tour-item-list">
        {rows.map((entry, index) => {
          const place = mapTarget(entry.listing);
          return (
          <article key={entry.id} className="tour-item" data-choice={entry.buyerChoice}>
            <div className="tour-item-order">
              <button
                type="button"
                className="order-move"
                onClick={() => moveItem(entry.listingId, -1)}
                disabled={index === 0}
                aria-label="往前一站"
                title="往前一站"
              >
                ↑
              </button>
              <span className="order-number">{entry.visitOrder ?? "—"}</span>
              <button
                type="button"
                className="order-move"
                onClick={() => moveItem(entry.listingId, 1)}
                disabled={index === rows.length - 1}
                aria-label="往後一站"
                title="往後一站"
              >
                ↓
              </button>
            </div>

            <div className="tour-item-body">
              <h3>{entry.listing.title}</h3>
              <p className="tour-item-meta">
                {formatPrice(entry.listing.totalPrice)}　·　{formatPing(entry.listing.ping)}　·
                {formatUnitPrice(entry.listing.unitPrice)}　·　{entry.listing.layout ?? "格局未提供"}
              </p>
              <p className="tour-item-meta">
                {entry.listing.district ?? "—"}　{displayAddress(entry.listing) ?? ""}
                {/* 幾乎每一筆都沒有座標，所以這個標籤要講清楚它只影響「排順序」，
                    不要讓人以為這間連導航都按不出來。 */}
                {entry.listing.lat === null && <span className="tag tag-warn">無座標·排順序時略過</span>}
              </p>

              <label className="tour-item-note">
                正確地址（買方導航會用這個）
                <input
                  defaultValue={entry.listing.exactAddress ?? ""}
                  maxLength={200}
                  onBlur={(event) => saveExactAddress(entry.listingId, event.target.value)}
                  placeholder={
                    entry.listing.address
                      ? `目前只到「${entry.listing.address}」，補門牌會更準`
                      : "例：永康區東橋七路123號"
                  }
                />
              </label>

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
          這筆帶看紀錄還沒有物件。到 <Link href="/admin/listings">買方配案系統</Link> 勾選後加進來。
        </p>
      )}
    </div>
  );
}
