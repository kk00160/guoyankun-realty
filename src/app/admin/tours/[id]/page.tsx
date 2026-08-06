import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Topbar from "@/app/_components/Topbar";
import DbSetupNotice from "@/app/admin/_components/DbSetupNotice";
import { DB_CONFIGURED } from "@/lib/db";
import { getTour, listTourEntries } from "@/lib/tour-store";
import TourDetail from "./TourDetail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "帶看單細節",
  robots: { index: false, follow: false }
};

export default async function TourDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!DB_CONFIGURED) {
    return (
      <div className="admin-page">
        <Topbar admin title="帶看單" />
        <div className="admin-shell">
          <DbSetupNotice />
        </div>
      </div>
    );
  }

  const tour = await getTour(id);
  if (!tour) notFound();

  const entries = await listTourEntries(id);

  return (
    <div className="admin-page">
      <Topbar admin title="帶看單" />
      <TourDetail tour={tour} entries={entries} />
    </div>
  );
}
