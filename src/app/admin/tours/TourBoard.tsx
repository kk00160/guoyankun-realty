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
        { ...payload.tour, itemCount: 0, interestedCount: 0, pendingCount: 0 },
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
          <label>
            這次要帶誰看 <span className="required">必填</span>
            <input name="title" required maxLength={100} placeholder="陳先生 8/10 東區看房" />
          </label>
          <label>
            買方稱呼
            <input name="buyerName" maxLength={50} placeholder="陳先生" />
          </label>
          <label>
            連結有效天數
            <input name="days" type="number" min="1" max="180" defaultValue={30} />
          </label>
          <label className="span-2">
            出發點（選填，排路線時當起點）
            <input name="originLabel" maxLength={100} placeholder="例：門市、或當天約的碰面地點" />
          </label>
          <label>
            出發點緯度
            <input name="originLat" type="number" step="0.000001" placeholder="22.9908" />
          </label>
          <label>
            出發點經度
            <input name="originLng" type="number" step="0.000001" placeholder="120.2133" />
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
              </div>
            </article>
          );
        })}
      </div>

      {tours.length === 0 && <p className="empty-note">還沒有任何帶看紀錄。用上面的表單開第一筆。</p>}
    </div>
  );
}
