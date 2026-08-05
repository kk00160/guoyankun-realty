import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 預約系統與後台的存取控制。
 *
 * 兩道關卡（都是 fail closed，沒設定就是擋住）：
 *
 * 1. BOOKING_ENABLED - 線上預約總開關。
 *    未設為 true 時，預約與後台一律 404。
 *    原因：預約資料寫入本機檔案，在 Vercel 等無伺服器平台不持久，客戶預約會遺失。
 *
 * 2. ADMIN_PASSWORD - 後台密碼。
 *    後台與管理用 API 需通過 HTTP Basic 驗證才能存取。
 *    沒設密碼就一律擋住，避免「忘了設」等於門戶大開。
 */
const BOOKING_ENABLED = process.env.BOOKING_ENABLED === "true";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

/** 只有本人能用的路徑：後台頁面，以及可讀取／竄改全部預約的 API。 */
function isAdminPath(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/appointments");
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

  if (!BOOKING_ENABLED) return notFound(pathname);

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
  matcher: ["/admin/:path*", "/card/booking/:path*", "/api/:path*"]
};
