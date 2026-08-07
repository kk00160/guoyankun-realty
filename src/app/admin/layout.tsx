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
 * 這裡刻意不包任何容器 div：各頁自己的 .admin-page / .report-page 版面維持原樣。
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminNav tabs={adminTabs()} brand={`${PROFILE.name}房仲控台`} />
      {children}
    </>
  );
}
