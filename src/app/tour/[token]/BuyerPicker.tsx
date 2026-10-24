"use client";

import { useMemo, useState } from "react";
import {
  type Listing,
  formatAge,
  formatPing,
  formatPrice,
  formatSeenAt,
  formatUnitPrice,
  publicAreaLabel
} from "@/lib/listings";
import { PROFILE } from "@/lib/profile";
import type { BuyerChoice } from "@/lib/tour";
import Gallery from "./Gallery";

type Entry = {
  listingId: string;
  choice: BuyerChoice;
  /** 阿坤排完看房順序之後才有值（1 開始）。 */
  visitOrder: number | null;
  listing: Listing;
};

export default function BuyerPicker({
  token,
  title,
  buyerName,
  submittedAt,
  entries
}: {
  token: string;
  title: string;
  buyerName: string | null;
  submittedAt: string | null;
  entries: Entry[];
}) {
  const [rows, setRows] = useState(entries);
  /**
   * 買方稱呼只拿來打招呼，而且只由阿坤在後台填。
   *
   * 以前一進來會先擋一個「先讓我知道怎麼稱呼你」的表單 —— 那一關拿掉了。
   * 阿坤是把連結直接傳給認識的人，他本來就知道對方是誰；
   * 為了一個他已經知道的答案，讓客戶多打一次字、多按一次按鈕，
   * 只會讓人在還沒看到房子之前就先流失。
   */
  const name = buyerName ?? "";
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(Boolean(submittedAt));

  const interested = useMemo(() => rows.filter((row) => row.choice === "interested"), [rows]);

  /**
   * 帶看行程。阿坤在後台按過「排路線」之後，物件才會有看房順序。
   *
   * 有順序就代表行程定了 —— 這時候買方打開連結最想知道的是
   * 「我們要看哪幾間、什麼順序」，而不是再挑一次。所以這一區放在最上面。
   *
   * 這裡只放純文字的順序摘要，刻意不放任何導航連結，也不放通往行程頁的入口。
   * 導航屬於「已經談定要看哪幾間」之後的事，那是 /tour/[token]/plan 的職責，
   * 而那條連結什麼時候發出去由阿坤決定 —— 不該從這一頁自己滲過去。
   */
  const plan = useMemo(
    () =>
      rows
        .filter((row) => row.visitOrder !== null)
        .sort((a, b) => (a.visitOrder ?? 0) - (b.visitOrder ?? 0)),
    [rows]
  );

  async function choose(listingId: string, choice: BuyerChoice) {
    const previous = rows;
    // 先動畫面再送出：手機上網路慢的時候，按了沒反應會讓人一直重複按。
    setRows((current) => current.map((row) => (row.listingId === listingId ? { ...row, choice } : row)));
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
      setRows(previous); // 失敗就退回原狀，不要顯示一個沒存進去的選擇
      setMessage(error instanceof Error ? error.message : "沒有存成功，請再按一次。");
    } finally {
      setBusy("");
    }
  }

  async function submit() {
    setBusy("submit");
    setMessage("");
    try {
      await fetch(`/api/tour/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" })
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // 選擇本來就是即時存的，送出只是通知。失敗也讓對方看到已送出，
      // 不要因為一個通知失敗就讓人以為白選了。
      setSubmitted(true);
    } finally {
      setBusy("");
    }
  }

  const open = openId ? rows.find((row) => row.listingId === openId) : null;

  return (
    <div className="buyer-shell">
      <header className="buyer-head">
        <h1>{title}</h1>
        {submitted ? (
          <div className="buyer-done">
            <b>已經送出了，謝謝你 🙌</b>
            <p>
              {interested.length > 0
                ? `你挑了 ${interested.length} 間想看的`
                : "這次沒有特別想看的也沒關係"}
              ，我收到了，會盡快跟你聯絡安排時間。
              還想調整的話，直接改下面的選擇再送出一次就好。
            </p>
          </div>
        ) : (
          /* 這份清單是阿坤挑過才送出來的，所以這裡不催進度、不要求「全部選完」。
             想全看、只挑一兩間、或一間都不挑，都是正常答案。 */
          <p>
            {name ? `${name}，` : ""}這裡有 {rows.length} 間。點卡片可以看更多照片和詳細資料，
            想看的按「想看」—— 要幾間就幾間，全部都想看也可以。挑好按最下面送出就行。
          </p>
        )}
        {interested.length > 0 && <div className="buyer-progress">已挑了 {interested.length} 間</div>}
      </header>

      {message && <p className="form-message">{message}</p>}

      {plan.length > 0 && (
        <section className="buyer-plan">
          <h2>看房行程</h2>
          <p className="buyer-plan-note">這是我們要看的順序，時間我再跟你電話確認。</p>
          <ol className="buyer-plan-list">
            {plan.map((entry) => (
              <li key={entry.listingId}>
                <b>{entry.listing.title}</b>
                <span>
                  {entry.listing.district ?? ""}
                  {entry.listing.address ? `　${entry.listing.address}` : ""}
                  　{formatPrice(entry.listing.totalPrice)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="buyer-list">
        {rows.map((entry) => {
          const listing = entry.listing;

          return (
            <article key={entry.listingId} className="buyer-card" data-choice={entry.choice}>
              <Gallery photos={listing.images} alt={listing.title} />

              <div className="buyer-card-body">
                <h2>{listing.title}</h2>
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

                <p className="buyer-where">
                  {listing.district ?? ""}
                  {listing.houseType ? `　${listing.houseType}` : ""}
                  {listing.floorInfo ? `　${listing.floorInfo}` : ""}
                  {listing.parking ? `　${listing.parking}` : ""}
                </p>

                {listing.tags.length > 0 && (
                  <div className="buyer-tags">
                    {listing.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="buyer-more"
                  onClick={() => setOpenId(openId === entry.listingId ? null : entry.listingId)}
                >
                  {openId === entry.listingId ? "收起詳細資料 ▲" : "看詳細資料 ▼"}
                </button>

                {open?.listingId === entry.listingId && (
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
                        ["位置", `${listing.district ?? ""}${listing.address ? `　${listing.address}` : ""}` || "—"]
                      ] as [string, string][]
                    ).map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {/* 刻意只留更新日期，不揭露資料從哪裡來。
                    日期不能拿掉：買方拿一個月前的價格來談，責任會落在阿坤身上。 */}
                {/* ⚠️ 這一頁刻意沒有導航按鈕，不要「順手補回來」。
                    這條連結問的是「你要不要看這間」，還沒到「怎麼去」那一步；
                    在還沒決定要不要看的時候放一顆導航，等於暗示他可以自己先去看。
                    導航只出現在行程頁 /tour/[token]/plan 與印出來的帶看單上 ——
                    那兩個地方的前提都是「要看哪幾間已經談定了」。 */}

                <p className="buyer-source">
                  資料更新於 {formatSeenAt(listing.lastSeenAt)}　·　實際屋況與價格以現場為準
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
          );
        })}
      </div>

      {rows.length === 0 && <p className="empty-note">這份清單目前還沒有物件，我整理好會再通知你。</p>}

      <footer className="buyer-foot">
        <p>
          清單上的資料僅供參考，實際屋況、價格與產權情形，我會在帶看時跟你逐一確認。
          有任何一間想先問細節，直接打給我。
        </p>
        <a className="button-secondary" href={`tel:${PROFILE.phoneRaw}`}>
          打給{PROFILE.alias}　{PROFILE.phone}
        </a>
      </footer>

      {/* 送出列固定在底部。勾選本來就即時存了，這顆按鈕是讓買方知道「我挑完了」，
          也讓阿坤知道可以開始安排帶看。 */}
      {rows.length > 0 && (
        <div className="buyer-submit-bar">
          <div>
            <b>{interested.length > 0 ? `想看 ${interested.length} 間` : "還沒挑"}</b>
            {/* 刻意不顯示「還有幾間沒選」。沒按到的不是待辦事項，就只是沒興趣而已。 */}
            <span>　挑幾間都可以</span>
          </div>
          <button type="button" className="button" onClick={submit} disabled={busy === "submit"}>
            {busy === "submit" ? "送出中…" : submitted ? "重新送出" : "送出給" + PROFILE.alias}
          </button>
        </div>
      )}
    </div>
  );
}
