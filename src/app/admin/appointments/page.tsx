import type { Metadata } from "next";
import { listAppointments } from "@/lib/appointment-store";
import { GOOGLE_REDIRECT_URI, isGoogleBound, isGoogleConfigured } from "@/lib/google-calendar";
import AppointmentBoard from "./AppointmentBoard";
import GoogleCalendarCard from "./GoogleCalendarCard";

export const dynamic = "force-dynamic";

// 後台是內部管理頁，不可被搜尋引擎收錄。
export const metadata: Metadata = {
  title: "預約管理",
  robots: { index: false, follow: false }
};

export default async function AppointmentsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; google?: string }>;
}) {
  const params = await searchParams;
  const status = ["confirmed", "completed", "cancelled"].includes(params.status || "")
    ? params.status!
    : "all";

  const configured = isGoogleConfigured();
  // 沒設定 OAuth 就不用去查有沒有綁定，省一次資料庫往返。
  const [rows, bound] = await Promise.all([
    listAppointments(status),
    configured ? isGoogleBound() : Promise.resolve(false)
  ]);

  return (
    <div className="admin-page">
      <GoogleCalendarCard
        configured={configured}
        bound={bound}
        redirectUri={GOOGLE_REDIRECT_URI}
        notice={params.google}
      />
      <AppointmentBoard initialRows={rows} status={status} />
    </div>
  );
}
