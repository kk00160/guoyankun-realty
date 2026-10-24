import { PROFILE } from "@/lib/profile";

/**
 * 連結打不開時給買方看的那一頁。
 *
 * 挑選頁與行程頁共用：token 失效、過期、資料庫連不上，
 * 這些狀況在兩條連結上都會發生，訊息不該長得不一樣。
 * 一律不要丟 500 白畫面 —— 買方看到白畫面只會以為是自己手機壞了。
 */
export default function ClosedPage({ message }: { message: string }) {
  return (
    <main className="buyer-page">
      <div className="buyer-closed">
        <h1>{message}</h1>
        <p>如果需要重新看一次清單，直接跟我說一聲，我再發一個新連結給你。</p>
        <a className="button" href={`tel:${PROFILE.phoneRaw}`}>
          打給{PROFILE.alias}　{PROFILE.phone}
        </a>
      </div>
    </main>
  );
}
