import AdminNav from "@/app/admin/_components/AdminNav";
import { adminTabs } from "@/lib/admin-nav";
import { PROFILE } from "@/lib/profile";

/**
 * 所有後台頁面共用的外框。
 *
 * 導覽列放在 layout 而不是每一頁自己畫，是為了讓以後新增的後台頁面
 * 「預設就有」控台導覽，不會出現某一頁進去之後跳不回來的死路。
 *
 * ⚠️ 分頁清單一定要在這裡（server component）算好再傳下去。
 *    adminTabs() 讀的是伺服器端環境變數，在瀏覽器裡讀不到 ——
 *    交給 client component 自己算的話，畫面會先出現正確的分頁，
 *    然後在 hydration 之後被抹掉，只剩「控台」。這個 bug 實際發生過。
 *
 * 外面那層 .theme-latte 是配色（暖白＋深綠＋大圓角，見 globals.css）。
 * 後台與買方頁共用同一套，客戶看到的跟你自己看到的是同一個品牌。
 *
 * 包在這裡而不是寫進 :root，是因為名片站首頁跟這裡共用同一組變數名稱 ——
 * 改 :root 等於連首頁的紫綠 CIS 一起換掉。包成容器之後，/admin 底下
 * 每一頁自動套到，容器外面的一切原封不動。新增後台頁面不用做任何事。
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-latte">
      <AdminNav tabs={adminTabs()} brand={`${PROFILE.name}房仲控台`} />
      {children}
    </div>
  );
}
