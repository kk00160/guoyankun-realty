import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DbSetupNotice from "@/app/admin/_components/DbSetupNotice";
import { isDbConfigured } from "@/lib/db";
import { getTour, listTourEntries } from "@/lib/tour-store";
import TourDetail from "./TourDetail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "帶看紀錄",
  robots: { index: false, follow: false }
};

export default async function TourDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isDbConfigured()) {
    return (
      <div className="admin-page">
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
      <TourDetail tour={tour} entries={entries} />
    </div>
  );
}
