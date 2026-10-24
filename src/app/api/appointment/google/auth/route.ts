import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthUrl, isGoogleConfigured } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 開始綁定 Google 日曆。
 *
 * 這支在 /api/admin 底下受密碼保護（見 middleware），
 * 所以只有你本人能發起授權，客戶點不到。
 */
export async function GET() {
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "還沒設定 Google OAuth。請先在 Vercel 環境變數填入 " +
          "GOOGLE_CALENDAR_CLIENT_ID 與 GOOGLE_CALENDAR_CLIENT_SECRET。"
      },
      { status: 400 }
    );
  }

  // state 用來防 CSRF：回來的時候要對得上才算數。
  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(getAuthUrl(state));
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });
  return response;
}
