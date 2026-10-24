import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 預約系統、帶看助手與後台的存取控制。
 *
 * 兩道關卡（都是 fail closed，沒設定就是擋住）：
 *
 * 1. 功能開關 - 每個路徑先歸屬到一個功能，該功能沒開就 404。
 *    BOOKING_ENABLED：線上預約。資料寫本機檔案，雲端平台不持久，客戶預約會遺失。
 *    TOUR_ENABLED   ：帶看助手。走 Supabase，可以獨立於預約系統上線。
 *    兩個開關刻意分開：綁在一起等於為了開帶看被迫打開還不能上線的預約系統。
 *
 * 2. ADMIN_PASSWORD - 後台密碼。
 *    後台與管理用 API 需通過 HTTP Basic 驗證才能存取。
 *    沒設密碼就一律擋住，避免「忘了設」等於門戶大開。
 */
const BOOKING_ENABLED = process.env.BOOKING_ENABLED === "true";
const TOUR_ENABLED = process.env.TOUR_ENABLED === "true";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

type Feature = "booking" | "tour" | "console" | "lead" | null;

/**
 * 這個路徑屬於哪個功能。
 *
 * ⚠️ 新增任何 /api 或 /admin 路由時，必須在這裡登記。
 *    沒登記的路徑會被當成未知路徑直接 404（見 middleware 第一關），
 *    這是刻意的：忘了登記的後果是「功能不通」，而不是「沒有防護就上線」。
 */
function featureOf(pathname: string): Feature {
  /**
   * 首頁表單的來客名單。
   *
   * /api/lead 是公開的收件口（客戶送出用），/admin/leads 是你自己看的名單。
   *
   * 刻意沒有功能開關：關掉它的後果是客戶填了表單、資料安靜地掉在地上，
   * 而你不會知道有人來過。這個代價比任何開關能換到的好處都嚴重。
   * 沒有開關不等於沒有防護 —— /admin/leads 一樣要密碼（見 isAdminPath）。
   */
  if (pathname === "/api/lead" || pathname.startsWith("/admin/leads") || pathname.startsWith("/api/admin/leads")) {
    return "lead";
  }

  // 帶看助手。/tour 與 /api/tour 是給買方的公開路徑，不需要密碼但受開關管制。
  // ⚠️ 這條用 /api/admin 一網打盡，所以任何「不屬於帶看」的 /api/admin/* 都必須寫在它前面。
  if (
    pathname.startsWith("/tour") ||
    pathname.startsWith("/api/tour") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/admin/listings") ||
    pathname.startsWith("/admin/tours")
  ) {
    return "tour";
  }

  /**
   * 線上預約的「後台側」：預約總表、狀態更新、Google 日曆綁定。
   *
   * 刻意不受 BOOKING_ENABLED 管制，因為要先設定好才談得上對外開放 ——
   * 綁定日曆得先進後台，若後台也被開關擋住就變成雞生蛋。
   * 而且開關關著的時候，你正需要進來看有沒有殘留的預約要處理。
   *
   * 沒有開關不等於沒有防護：這些路徑一律要密碼（見 isAdminPath），
   * 只有 google/callback 例外，它靠 state cookie 驗證。
   */
  if (
    pathname.startsWith("/admin/appointments") ||
    pathname.startsWith("/api/appointments") ||
    pathname.startsWith("/api/appointment/google")
  ) {
    return "console";
  }

  /**
   * 線上預約的「客戶側」：選時段的頁面與送出用的 API。
   * 這才是 BOOKING_ENABLED 真正要管的東西 —— 要不要對客戶開放。
   */
  if (pathname.startsWith("/card/booking") || pathname.startsWith("/api/appointment")) {
    return "booking";
  }

  /**
   * 控台本身。刻意沒有功能開關 —— 它是「所有系統的入口」，
   * 每個系統關著的時候，控台正好要負責告訴你哪個關著、為什麼關著。
   * 跟著任何一個開關一起關掉的話，全部關閉時你會連個能看的頁面都沒有。
   *
   * 沒有開關不等於沒有防護：/admin 開頭一律要密碼（見 isAdminPath）。
   * 這裡放最後面，前面幾個比較明確的路徑先比對。
   */
  if (pathname === "/admin" || pathname === "/admin/logout") {
    return "console";
  }

  return null;
}

/**
 * 只有本人能用的路徑：所有後台頁面，以及可讀取／竄改資料的管理 API。
 *
 * 這裡用 /admin 開頭一網打盡，未來新增後台頁面預設就是受保護的。
 * 反過來說，買方用的 /tour 與 /api/tour 不在這裡 —— 買方免登入，
 * 靠的是猜不到、可撤銷、有到期日的 token。
 */
function isAdminPath(pathname: string) {
  /**
   * ⚠️ 例外：Google 授權完成後的轉址。
   *
   * Google 是用瀏覽器把使用者送回來的，不會帶 HTTP Basic 的帳密，
   * 放進受保護路徑會被 401 擋掉，授權永遠完成不了。
   * 它的防護是 state cookie（見該路由），不是密碼。
   */
  if (pathname.startsWith("/api/appointment/google/callback")) return false;

  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/appointments") ||
    // 發起授權必須是你本人，否則任何人都能對你的帳號啟動綁定流程。
    pathname.startsWith("/api/appointment/google/auth")
  );
}

/** 長度固定的比對，避免用回應時間逐字元猜密碼。 */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function hasValidCredentials(request: NextRequest) {
  if (!ADMIN_PASSWORD) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }

  const password = decoded.slice(decoded.indexOf(":") + 1);
  return safeEqual(password, ADMIN_PASSWORD);
}

function notFound(pathname: string) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse("404 – 找不到頁面", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 第一關：功能開關。認不出屬於哪個功能的路徑，一律當作沒開。
  const feature = featureOf(pathname);
  if (feature === null) return notFound(pathname);
  if (feature === "booking" && !BOOKING_ENABLED) return notFound(pathname);
  if (feature === "tour" && !TOUR_ENABLED) return notFound(pathname);

  /**
   * 登出。
   *
   * HTTP Basic 沒有真正的登出 —— 帳密是瀏覽器記著、每次自動送出的，
   * 伺服器這邊沒有 session 可以清掉。唯一可靠的做法是回一次 401，
   * 讓瀏覽器重新問帳密，使用者按「取消」就等於登出了。
   *
   * 所以這裡刻意放在密碼檢查「之前」：帶著正確密碼來也一樣回 401。
   */
  if (pathname === "/admin/logout") {
    return new NextResponse("已登出。跳出來的視窗按取消，或直接關掉這個分頁。", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Admin", charset="UTF-8"',
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }

  if (isAdminPath(pathname) && !hasValidCredentials(request)) {
    // 回 401 讓瀏覽器跳出輸入框；沒設密碼時同樣擋住。
    return new NextResponse("需要登入", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Admin", charset="UTF-8"',
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }

  return NextResponse.next();
}

export const config = {
  // "/admin" 單獨列出來：控台首頁本身也要進 middleware，不能只靠 /admin/:path*。
  matcher: ["/admin", "/admin/:path*", "/card/booking/:path*", "/api/:path*", "/tour/:path*"]
};
