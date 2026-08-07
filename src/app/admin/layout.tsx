import AdminNav from "@/app/admin/_components/AdminNav";

/**
 * 所有後台頁面共用的外框。
 *
 * 導覽列放在 layout 而不是每一頁自己畫，是為了讓以後新增的後台頁面
 * 「預設就有」控台導覽，不會出現某一頁進去之後跳不回來的死路。
 *
 * 這裡刻意不包任何容器 div：各頁自己的 .admin-page / .report-page 版面維持原樣。
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
