import type { Metadata } from "next";
import Topbar from "@/app/_components/Topbar";
import { listAppointments } from "@/lib/appointment-store";
import AppointmentBoard from "./AppointmentBoard";

export const dynamic = "force-dynamic";

// 後台是內部管理頁，不可被搜尋引擎收錄。
export const metadata: Metadata = {
  title: "預約管理",
  robots: { index: false, follow: false }
};

export default async function AppointmentsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = ["confirmed", "completed", "cancelled"].includes(params.status || "")
    ? params.status!
    : "all";
  const rows = await listAppointments(status);

  return (
    <div className="admin-page">
      <Topbar admin />
      <AppointmentBoard initialRows={rows} status={status} />
    </div>
  );
}
