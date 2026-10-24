"use client";

import { useState } from "react";
import { LEAD_STATUS_LABEL, type Lead, type LeadStatus, formatLeadTime } from "@/lib/leads";
import { PROFILE } from "@/lib/profile";

const FILTERS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "new", label: "待聯絡" },
  { value: "contacted", label: "已聯絡" },
  { value: "done", label: "結案" },
  { value: "spam", label: "垃圾" }
];

export default function LeadBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const shown = filter === "all" ? leads : leads.filter((lead) => lead.status === filter);
  const waiting = leads.filter((lead) => lead.status === "new").length;

  async function setStatus(id: string, status: LeadStatus) {
    setBusy(id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "更新失敗");
      setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, status } : lead)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setBusy("");
    }
  }

  async function saveNote(id: string, agentNote: string) {
    try {
      await fetch(`/api/admin/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentNote })
      });
    } catch {
      setMessage("備註沒存成功，請再試一次。");
    }
  }

  async function remove(lead: Lead) {
    if (!window.confirm(`要刪掉「${lead.name}」這一筆嗎？真的是客戶的話建議改成「結案」就好，刪掉沒辦法復原。`)) {
      return;
    }
    setBusy(lead.id);
    try {
      const response = await fetch(`/api/admin/leads/${encodeURIComponent(lead.id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "刪除失敗");
      setLeads((current) => current.filter((row) => row.id !== lead.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刪除失敗");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="admin-shell">
      <div className="admin-heading">
        <div>
          <h1>來客名單</h1>
          <p>
            首頁表單留下來的客戶。
            {waiting > 0 ? <b>　有 {waiting} 筆還沒聯絡。</b> : "　目前沒有待聯絡的。"}
          </p>
        </div>
      </div>

      <div className="filter-row">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={filter === item.value ? "button" : "button-secondary"}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
            {item.value === "all" ? `（${leads.length}）` : ""}
          </button>
        ))}
      </div>

      {message && <p className="form-message">{message}</p>}

      <div className="lead-list">
        {shown.map((lead) => (
          <article key={lead.id} className="lead-card" data-status={lead.status}>
            <div className="lead-card-top">
              <div>
                <h3>
                  {lead.name}
                  {/* 電話做成可以直接撥的連結：這一頁多半是在手機上看的，
                      看到名單的下一個動作幾乎一定是打過去。 */}
                  <a className="lead-phone" href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}>
                    {lead.phone}
                  </a>
                </h3>
                <p className="lead-meta">
                  {formatLeadTime(lead.createdAt)}
                  {lead.service ? `　·　${lead.service}` : ""}
                  {lead.timeSlot ? `　·　方便時段 ${lead.timeSlot}` : ""}
                </p>
              </div>
              <span className="tag" data-status={lead.status}>
                {LEAD_STATUS_LABEL[lead.status]}
              </span>
            </div>

            {lead.message && <p className="lead-message">{lead.message}</p>}

            <label className="tour-item-note">
              我的備註
              <input
                defaultValue={lead.agentNote ?? ""}
                maxLength={1000}
                onBlur={(event) => saveNote(lead.id, event.target.value)}
                placeholder="例：已回電，約週六看東橋"
              />
            </label>

            <div className="listing-actions">
              {lead.status !== "contacted" && (
                <button type="button" onClick={() => setStatus(lead.id, "contacted")} disabled={busy === lead.id}>
                  標記已聯絡
                </button>
              )}
              {lead.status !== "done" && (
                <button type="button" onClick={() => setStatus(lead.id, "done")} disabled={busy === lead.id}>
                  結案
                </button>
              )}
              {lead.status !== "new" && (
                <button type="button" onClick={() => setStatus(lead.id, "new")} disabled={busy === lead.id}>
                  改回待聯絡
                </button>
              )}
              {lead.status !== "spam" && (
                <button type="button" onClick={() => setStatus(lead.id, "spam")} disabled={busy === lead.id}>
                  標記垃圾
                </button>
              )}
              <button type="button" className="link-danger" onClick={() => remove(lead)} disabled={busy === lead.id}>
                刪除
              </button>
            </div>
          </article>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="empty-note">
          {leads.length === 0
            ? `還沒有人從首頁留資料。客戶在 ${PROFILE.brand} 首頁按下「送出預約」之後，就會出現在這裡。`
            : "這個分類目前沒有資料。"}
        </p>
      )}
    </div>
  );
}
