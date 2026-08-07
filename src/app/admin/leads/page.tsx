import type { Metadata } from "next";
import DbErrorNotice from "@/app/admin/_components/DbErrorNotice";
import DbSetupNotice from "@/app/admin/_components/DbSetupNotice";
import { isDbConfigured } from "@/lib/db";
import { listLeads } from "@/lib/lead-store";
import type { Lead } from "@/lib/leads";
import LeadBoard from "./LeadBoard";

export const dynamic = "force-dynamic";

// 後台是內部管理頁，而且這一頁全是客戶個資，絕對不可被搜尋引擎收錄。
export const metadata: Metadata = {
  title: "來客名單",
  robots: { index: false, follow: false }
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-page">
      <div className="admin-shell">{children}</div>
    </div>
  );
}

export default async function LeadsPage() {
  if (!isDbConfigured()) {
    return (
      <Shell>
        <DbSetupNotice />
      </Shell>
    );
  }

  let leads: Lead[] = [];
  try {
    leads = await listLeads("all");
  } catch (error) {
    return (
      <Shell>
        <DbErrorNotice
          detail={error instanceof Error ? error.message : "讀取來客名單失敗"}
          retryHref="/admin/leads"
        />
      </Shell>
    );
  }

  return (
    <div className="admin-page">
      <LeadBoard initialLeads={leads} />
    </div>
  );
}
