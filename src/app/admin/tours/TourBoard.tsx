"use client";

import Link from "next/link";
import { useState } from "react";
import { buyerTourUrl } from "@/lib/buyer-link";
import { TOUR_STATUS_LABEL, type TourStatus, formatTourDate, isTourOpen } from "@/lib/tour";
import type { TourWithCount } from "@/lib/tour-store";


export default function TourBoard({ initialTours }: { initialTours: TourWithCount[] }) {
  const [tours, setTours] = useState(initialTours);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");

  async function createTour(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setBusy("create");
    setMessage("");
    try {
      const response = await fetch("/api/admin/tours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "建立失敗");

      setTours((current) => [
        { ...payload.tour, itemCount: 0, interestedCount: 0, pendingCount: 0, thinCount: 0 },
        ...current
      ]);
      form.reset();
      setMessage("已建立帶看紀錄。接下來去買方配案系統勾物件加進來。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立失敗");
    } finally {
      setBusy("");
    }
  }

  async function changeStatus(id: string, status: TourStatus) {
    setBusy(id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/tours/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "更新失敗");

      setTours((current) => current.map((tour) => (tour.id === id ? { ...tour, status } : tour)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setBusy("");
    }
  }

  /**
   * 整筆刪掉。沒有復原，所以先問一次，訊息裡把「會連帶消失什麼」講清楚 ——
   * 只說「確定刪除嗎」的話，沒人知道自己按下去會失去什麼。
   */
  async function removeTour(tour: TourWithCount) {
    const warn =
      `要刪掉「${tour.title}」嗎？\n\n` +
      `· 這筆帶看紀錄裡的 ${tour.itemCount} 間物件關聯會一起消失\n` +
      `· 買方勾選的結果也會消失\n` +
      `· 你傳給買方的那條連結會立刻打不開\n\n` +
      "案源資料本身不會被刪掉。這個動作沒辦法復原。";
    if (!window.confirm(warn)) return;

    setBusy(tour.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/tours/${encodeURIComponent(tour.id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "刪除失敗");

      setTours((current) => current.filter((row) => row.id !== tour.id));
      setMessage(`已刪除「${payload.title}」。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刪除失敗");
    } finally {
      setBusy("");
    }
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(buyerTourUrl(token));
      setCopied(token);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      setMessage("瀏覽器不給複製，請手動選取連結。");
    }
  }

  return (
    <div className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>帶看日記</h1>
          <p>一筆帶看紀錄 = 一個買方 + 一批物件 + 一個可撤銷的連結。每次帶看都留在這裡。</p>
        </div>
      </div>

      <form className="manual-form" onSubmit={createTour}>
        <div className="manual-grid">
          <label className="span-2">
            {/* 標籤文字要包成「一個」元素。label 是 flex-column，
                純文字節點跟 <span> 會變成兩個 flex item 被拆成上下兩行，
                那一欄就比隔壁矮一截 —— 這就是表格看起來沒對齊的原因。 */}
            <span className="field-label">
              這次要帶誰看 <span className="required">必填</span>
            </span>
            <input name="title" required maxLength={100} placeholder="陳先生 8/10 東區看房" />
          </label>
          <label>
            <span className="field-label">買方稱呼（選填，你自己看的）</span>
            <input name="buyerName" maxLength={50} placeholder="陳先生" />
          </label>
          <label>
            <span className="field-label">連結有效天數</span>
            <input name="days" type="number" min="1" max="180" defaultValue={30} />
          </label>
          <label className="span-4">
            <span className="field-label">出發點（選填，導航連結會從這裡開始）</span>
            <input name="originLabel" maxLength={100} placeholder="例：門市、或當天約的碰面地點" />
          </label>
        </div>
        <button type="submit" className="button" disabled={busy === "create"}>
          {busy === "create" ? "建立中…" : "開一筆新的帶看紀錄"}
        </button>
      </form>

      {message && <p className="form-message">{message}</p>}

      <div className="tour-list">
        {tours.map((tour) => {
          const open = isTourOpen(tour);
          return (
            <article key={tour.id} className="tour-card" data-open={open}>
              <div className="tour-card-top">
                <div>
                  <h3>
                    <Link href={`/admin/tours/${tour.id}`}>{tour.title}</Link>
                  </h3>
                  <p className="tour-sub">
                    {tour.buyerName ?? "買方尚未填稱呼"}　·　{tour.itemCount} 間　·
                    想看 {tour.interestedCount}　·　未選 {tour.pendingCount}
                  </p>
                </div>
                <div className="tag-row">
                  {/* 照片沒補齊要在「複製連結」旁邊就看得到，不能等傳出去才發現。 */}
                  {tour.thinCount > 0 && (
                    <span className="tag tag-warn">{tour.thinCount} 間只有封面照</span>
                  )}
                  {tour.submittedAt && <span className="tag tag-done">買方已送出</span>}
                  <span className="tag">{TOUR_STATUS_LABEL[tour.status]}</span>
                  <span className="tag">{open ? `${formatTourDate(tour.expiresAt)} 到期` : "已關閉"}</span>
                </div>
              </div>

              <div className="tour-link-row">
                <code>{buyerTourUrl(tour.token)}</code>
                <button type="button" onClick={() => copyLink(tour.token)}>
                  {copied === tour.token ? "已複製" : "複製連結"}
                </button>
              </div>

              <div className="listing-actions">
                <Link href={`/admin/tours/${tour.id}`}>開啟</Link>
                {tour.status === "active" && (
                  <button type="button" onClick={() => changeStatus(tour.id, "done")} disabled={busy === tour.id}>
                    標記結束
                  </button>
                )}
                {tour.status === "active" && (
                  <button type="button" onClick={() => changeStatus(tour.id, "revoked")} disabled={busy === tour.id}>
                    撤銷連結
                  </button>
                )}
                {tour.status !== "active" && (
                  <button type="button" onClick={() => changeStatus(tour.id, "active")} disabled={busy === tour.id}>
                    重新開啟
                  </button>
                )}
                <button
                  type="button"
                  className="link-danger"
                  onClick={() => removeTour(tour)}
                  disabled={busy === tour.id}
                >
                  刪除
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {tours.length === 0 && <p className="empty-note">還沒有任何帶看紀錄。用上面的表單開第一筆。</p>}
    </div>
  );
}
