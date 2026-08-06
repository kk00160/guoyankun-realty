import Link from "next/link";

/**
 * 資料庫「已經設定好、但這次查詢失敗」時顯示的畫面。
 *
 * 跟 DbSetupNotice 分開是刻意的，而且是踩過坑之後才分的：
 * 原本兩種情況共用同一個畫面，結果 Supabase 有一次回了「JWT issued at future」
 * （它自己節點之間的時鐘差了幾秒，幾秒後就好了），
 * 使用者卻看到「帶看系統還沒接上資料庫」加一份四步驟設定指引，
 * 以為整套壞掉，跑去重設一個本來就是好的東西。
 *
 * 設定沒做完 → DbSetupNotice（教你怎麼設定）
 * 設定好了但讀取失敗 → 這一支（叫你重新整理，並說明多半會自己好）
 */
export default function DbErrorNotice({ detail, retryHref }: { detail: string; retryHref: string }) {
  // 這類錯誤幾秒後就會自己恢復，講清楚可以省掉一次無謂的排查。
  const transient = /issued at future|jwt expired|fetch failed|econnreset|etimedout|socket hang up|50[234]/i.test(
    detail
  );

  return (
    <section className="db-error-notice">
      <h2>{transient ? "資料庫剛剛回應不穩，重新整理一下" : "這次讀取資料失敗"}</h2>

      {transient ? (
        <p>
          你的設定是好的，資料也還在，只是 Supabase 那邊剛好有幾秒鐘不穩定
          （通常是它自己節點之間的時鐘差了一點點）。這種狀況會自己恢復，重新整理就好。
        </p>
      ) : (
        <p>
          設定看起來是完整的，但這次查詢沒有成功。先重新整理試一次；
          連續失敗的話，到 Supabase 主控台看一下專案是不是被暫停了
          （免費方案閒置一段時間會自動休眠，開啟主控台就會喚醒）。
        </p>
      )}

      <div className="db-error-actions">
        <Link className="button" href={retryHref}>
          重新整理
        </Link>
        <a
          className="button-secondary"
          href="https://supabase.com/dashboard/project/_/logs/explorer"
          target="_blank"
          rel="noreferrer"
        >
          開 Supabase 主控台
        </a>
      </div>

      <details>
        <summary>技術細節</summary>
        <p className="db-error-detail">{detail}</p>
      </details>
    </section>
  );
}
