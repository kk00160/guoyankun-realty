/**
 * 買方頁的共用外框。
 *
 * 這一層唯一的工作，是把配色（.theme-latte，見 globals.css）套到 /tour 底下
 * 的每一頁 —— 挑選頁、行程頁、以及以後不管多加什麼頁。
 *
 * 為什麼要有這個檔案：配色本來是一頁一頁掛在各自的 <main> 上，
 * 那等於把「記得加 class」變成一件人要記住的事。忘記的後果不是整頁沒換，
 * 而是**半新半舊** —— 底色還是舊的淡紫（那是 html/body 的底），
 * 按鈕卻已經是新的暖綠，比整頁沒換還難看，而且不打開那一頁根本不會發現。
 *
 * 後台的 src/app/admin/layout.tsx 用的是同一招，兩邊保持一致。
 * ⚠️ 不要把 theme-latte 搬回各頁的 <main>。
 */
export default function TourLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-latte">{children}</div>;
}
