import { NextResponse } from "next/server";
import { busyRanges } from "@/lib/appointment-store";
import { BOOKING_RULES, generateOpenSlots, meetDuration } from "@/lib/booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 可預約的時段。
 *
 * 要帶 meetType，因為不同見面方式佔用的時間長度不同
 * （電話 15 分、視訊 30 分、面談 60 分），能放進去的格子也就不一樣。
 */
export async function GET(request: Request) {
  try {
    const meetType = new URL(request.url).searchParams.get("meetType") || "office";
    const durationMin = meetDuration(meetType);

    const now = new Date();
    const toIso = new Date(
      now.getTime() + (BOOKING_RULES.daysAhead + 1) * 86_400_000
    ).toISOString();

    const busy = await busyRanges(now.toISOString(), toIso);

    return NextResponse.json({
      ok: true,
      durationMin,
      days: generateOpenSlots(now, busy, durationMin)
    });
  } catch (error) {
    console.error("[slots]", error);
    return NextResponse.json(
      { ok: false, days: [], error: "無法取得可預約時段。" },
      { status: 500 }
    );
  }
}
