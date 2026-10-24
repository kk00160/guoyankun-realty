import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/google-calendar";
import { SITE_URL } from "@/lib/site-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Google 授權完成後回到這裡，把授權碼換成 refresh token 存進資料庫。
 *
 * ⚠️ 這支不能放在 /api/admin 底下。
 * Google 是用瀏覽器轉址過來的，不會帶 HTTP Basic 的帳密，
 * 放進受保護路徑會被 401 擋掉，授權永遠完成不了。
 * 防護改靠 state cookie：沒有那組隨機字串就不算數。
 */
function back(status: "ok" | "denied" | "bad_state" | "failed") {
  return NextResponse.redirect(`${SITE_URL}/admin/appointments?google=${status}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code) return back("denied");

  // 對照發起授權時種下的 cookie，確認這趟是我們自己開的。
  const expected = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("google_oauth_state="))
    ?.slice("google_oauth_state=".length);

  if (!state || !expected || state !== expected) return back("bad_state");

  const success = await exchangeCodeForToken(code);
  const response = back(success ? "ok" : "failed");
  // 用完就丟，避免同一組 state 被重複使用。
  response.cookies.set("google_oauth_state", "", { path: "/", maxAge: 0 });
  return response;
}
