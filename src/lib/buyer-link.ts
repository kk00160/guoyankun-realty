import { SITE_URL } from "@/lib/site-config";

/**
 * 買方連結。
 *
 * 為什麼不直接用 window.location.origin：
 * 在本機開發時那會產出 http://localhost:3000/tour/xxx，
 * 而 localhost 的意思是「打開連結的那台裝置自己」——
 * 買方手機上沒有跑這套系統，點下去永遠是「無法連接伺服器」。
 *
 * 已經真的發生過一次。所以這裡改成：只要目前是在本機，
 * 一律回正式站網址，讓「複製連結」永遠複製到一個傳出去有意義的網址。
 */

/** 本機或內網。這些網址傳給別人一定打不開。 */
function isLocalHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

export function buyerTourUrl(token: string) {
  if (typeof window === "undefined") return `${SITE_URL}/tour/${token}`;

  const { hostname, origin } = window.location;
  return `${isLocalHost(hostname) ? SITE_URL : origin}/tour/${token}`;
}

/**
 * 現在是不是在本機看這個頁面。
 *
 * 用來提醒：本機產出的連結指向正式站，但正式站要先設好環境變數才會通。
 * 不講的話，複製了一個「看起來對、其實還沒開通」的連結傳出去，
 * 買方一樣打不開，只是換一種打不開。
 */
export function isLocalPreview() {
  return typeof window !== "undefined" && isLocalHost(window.location.hostname);
}

/** 本機預覽用的網址，自己測試買方頁時用這個。 */
export function localTourUrl(token: string) {
  if (typeof window === "undefined") return `/tour/${token}`;
  return `${window.location.origin}/tour/${token}`;
}
