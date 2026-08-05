import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 預約系統與後台的總開關（fail closed）。
 *
 * 沒有設定 BOOKING_ENABLED=true 時，這些路徑一律回 404：
 * - /admin/*                後台沒有登入驗證，開著會外洩客戶姓名、電話、Email
 * - /card/booking/*         預約寫入本機檔案，在雲端平台會失敗或遺失
 * - /api/appointment(s)/*   同上，且提供讀取全部預約的端點
 *
 * 用 middleware 集中擋，比在每支路由各寫一次不容易漏。
 */
const BOOKING_ENABLED = process.env.BOOKING_ENABLED === "true";

export function middleware(request: NextRequest) {
  if (BOOKING_ENABLED) return NextResponse.next();

  const wantsJson = request.nextUrl.pathname.startsWith("/api/");
  if (wantsJson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse("404 – 找不到頁面", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

export const config = {
  matcher: ["/admin/:path*", "/card/booking/:path*", "/api/:path*"]
};
