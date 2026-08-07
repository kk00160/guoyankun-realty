"use client";

import { useMemo, useState } from "react";
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
import { PROFILE } from "@/lib/profile";
import { mapPlaceUrl, mapTarget } from "@/lib/route";
import { type BuyerChoice, type TourTimeSlot, formatSlot } from "@/lib/tour";

type Entry = {
  listingId: string;
  choice: BuyerChoice;
  listing: Listing;
};

/**
 * 一間房的照片相簿。
 *
 * 用 CSS scroll-snap 做橫向滑動，不寫任何拖曳邏輯 ——
 * 手機上原生的慣性滑動比自己寫的順，而且不會跟頁面的上下捲動打架。
 */
function Gallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return <div className="buyer-photo buyer-photo-empty">沒有照片</div>;
  }

  return (
    <div className="buyer-gallery">
      <div
        className="buyer-track"
        onScroll={(event) => {
          const el = event.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {photos.map((src) => (
          // 原生 img：不把來源網站的圖片轉存到自己的網域。
          <img key={src} className="buyer-photo" src={resizeImage(src, "card")} alt={alt} loading="lazy" />
        ))}
      </div>

      {photos.length > 1 && (
        <>
          <div className="buyer-counter">
            {index + 1} / {photos.length}
          </div>
          <div className="buyer-dots">
            {photos.slice(0, 12).map((src, i) => (
              <span key={src} data-on={i === index} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function BuyerPicker({
  token,
  title,
  buyerName,
  submittedAt,
  entries,
  timeSlots
}: {
  token: string;
  title: string;
  buyerName: string | null;
  submittedAt: string | null;
  entries: Entry[];
  timeSlots: TourTimeSlot[];
}) {
  const [rows, setRows] = useState(entries);
  const [slots, setSlots] = useState(timeSlots);
  const [name, setName] = useState(buyerName ?? "");
  const [askName, setAskName] = useState(!buyerName);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(Boolean(submittedAt));

  const interested = useMemo(() => rows.filter((row) => row.choice === "interested"), [rows]);
  const pickedSlots = useMemo(() => slots.filter((slot) => slot.picked), [slots]);

  /** 買方勾一個時段。跟物件一樣即時存，不必等送出。 */
  async function chooseTime(slotId: string, picked: boolean) {
    const previous = slots;
    setSlots((current) => current.map((slot) => (slot.id === slotId ? { ...slot, picked } : slot)));
    setBusy(slotId);
    setMessage("");

    try {
      const response = await fetch(`/api/tour/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "time", slotId, picked })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "沒有存成功");
      // 以伺服器回來的為準：阿坤可能剛好在後台改了時段。
      if (Array.isArray(payload.slots)) setSlots(payload.slots);
    } catch (error) {
      setSlots(previous);
      setMessage(error instanceof Error ? error.message : "沒有存成功，請再按一次。");
    } finally {
      setBusy("");
    }
  }

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
        body: JSON.stringify({ action: "submit", buyerName: name.trim() })
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
    } catch {
      // 存不進去也放行，不要卡住整個流程
    } finally {
      setAskName(false);
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
              {pickedSlots.length > 0 ? `，時間選了 ${pickedSlots.length} 個，我收到了，會盡快跟你確認。` : "，我收到了，會盡快跟你聯絡安排時間。"}
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

      <div className="buyer-list">
        {rows.map((entry) => {
          const listing = entry.listing;
          const ratio = publicRatio(listing);
          // 有社區名就用社區名找，沒有就用地址找。幾乎沒有物件有經緯度，
          // 舊版只認經緯度，等於九成九的房子看不到「看地圖」。
          const place = mapTarget(listing);

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
                        ["公設比", ratio === null ? "—" : `約 ${ratio.toFixed(0)}%`],
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
                <p className="buyer-source">
                  資料更新於 {formatSeenAt(listing.lastSeenAt)}　·　實際屋況與價格以現場為準
                  {place && (
                    <>
                      　·{" "}
                      <a href={mapPlaceUrl(place)} target="_blank" rel="noreferrer">
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
          );
        })}
      </div>

      {rows.length === 0 && <p className="empty-note">這份清單目前還沒有物件，我整理好會再通知你。</p>}

      {/* 預約帶看時間。阿坤沒開時段就整區不出現，不要給買方一個空盒子。 */}
      {slots.length > 0 && (
        <section className="buyer-times">
          <h2>想約什麼時候看？</h2>
          {/* 這句是阿坤指定要放的：多幾個選項他才排得動。 */}
          <p className="buyer-times-note">
            方便的話<b>請選兩個以上的時間</b>，我比較好幫你安排，也不用來回問。
          </p>

          <div className="buyer-time-grid">
            {slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                data-on={slot.picked}
                onClick={() => chooseTime(slot.id, !slot.picked)}
                disabled={busy === slot.id}
              >
                {formatSlot(slot.startsAt)}
              </button>
            ))}
          </div>

          <p className="buyer-times-state">
            {pickedSlots.length === 0
              ? "還沒選時間。都不方便的話直接打給我，我們另外約。"
              : pickedSlots.length === 1
                ? "選了 1 個。再多選一個會更好排。"
                : `選了 ${pickedSlots.length} 個，很好安排，謝謝你 🙌`}
          </p>
        </section>
      )}

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
            <span>{slots.length > 0 ? `　時間 ${pickedSlots.length} 個` : "　挑幾間都可以"}</span>
          </div>
          <button type="button" className="button" onClick={submit} disabled={busy === "submit"}>
            {busy === "submit" ? "送出中…" : submitted ? "重新送出" : "送出給" + PROFILE.alias}
          </button>
        </div>
      )}
    </div>
  );
}
