import type { Metadata } from "next";
import Topbar from "@/app/_components/Topbar";
import DbErrorNotice from "@/app/admin/_components/DbErrorNotice";
import DbSetupNotice from "@/app/admin/_components/DbSetupNotice";
import { isDbConfigured } from "@/lib/db";
import { type TourWithCount, listTours } from "@/lib/tour-store";
import TourBoard from "./TourBoard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "帶看單",
  robots: { index: false, follow: false }
};

export default async function ToursPage() {
  if (!isDbConfigured()) {
    return (
      <div className="admin-page">
        <Topbar admin title="帶看單" />
        <div className="admin-shell">
          <DbSetupNotice />
        </div>
      </div>
    );
  }

  let tours: TourWithCount[] = [];
  let loadError = "";

  try {
    tours = await listTours();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "讀取資料失敗";
  }

  if (loadError) {
    return (
      <div className="admin-page">
        <Topbar admin title="帶看單" />
        <div className="admin-shell">
          <DbErrorNotice detail={loadError} retryHref="/admin/tours" />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <Topbar admin title="帶看單" />
      <TourBoard initialTours={tours} />
    </div>
  );
}
