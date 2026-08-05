import { promises as fs } from "node:fs";
import path from "node:path";
import { formatSlotTaipei, intentLabel, meetTypeLabel } from "@/lib/booking";
import type { Appointment } from "@/lib/appointment-store";

const OUTBOX_DIR = path.join(process.cwd(), "data", "outbox");

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function createEmailPreview(appointment: Appointment) {
  await fs.mkdir(OUTBOX_DIR, { recursive: true });
  const fileName = `appointment-${appointment.id}.html`;
  const target = path.join(OUTBOX_DIR, fileName);
  const html = `<!doctype html>
<html lang="zh-Hant">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>預約確認</title></head>
<body style="margin:0;background:#eef4f8;font-family:Arial,'Microsoft JhengHei',sans-serif;color:#12233f">
  <div style="max-width:760px;margin:0 auto;background:#fff;min-height:100vh">
    <div style="background:#10213d;color:#fff;padding:34px 40px">
      <div style="color:#efbd45;font-weight:800;letter-spacing:2px">SHONKO · 預約確認</div>
      <h1 style="margin:12px 0 0;font-size:28px">已收到你的預約</h1>
    </div>
    <div style="padding:34px 40px;line-height:1.8">
      <p>${escapeHtml(appointment.name)} 您好，以下是本機產生的確認信預覽。</p>
      <div style="border:1px solid #d8e3ef;background:#f7fafc;padding:20px;border-radius:8px">
        <b>時間：</b>${escapeHtml(formatSlotTaipei(appointment.slotIso))}<br>
        <b>方式：</b>${escapeHtml(meetTypeLabel(appointment.meetType))}<br>
        <b>需求：</b>${escapeHtml(appointment.intent.map(intentLabel).join("、"))}<br>
        <b>備註：</b>${escapeHtml(appointment.note)}
      </div>
      <p style="color:#63728a">教學模式不會寄出這封信。正式上線時請接通知佇列與郵件服務。</p>
    </div>
  </div>
</body>
</html>`;
  await fs.writeFile(target, html, "utf8");
  return fileName;
}
