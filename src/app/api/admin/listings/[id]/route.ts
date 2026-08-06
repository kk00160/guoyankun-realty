import { bad, fail, ok, optionalNumber, optionalText, readJson } from "@/lib/api";
import type { ListingStatus } from "@/lib/listings";
import { getListing, patchListing, setListingStatus } from "@/lib/tour-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ListingStatus[] = ["active", "needs_review", "archived", "sold"];

/**
 * 修一筆案源。兩種用途：
 * 1. 只帶 status → 確認／封存／標記成交
 * 2. 帶欄位     → 修正價格坪數或補經緯度，改完會重跑一次合理性閘門
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);

    const existing = await getListing(id);
    if (!existing) return bad("找不到這筆案源。", 404);

    if (typeof body.status === "string") {
      const status = body.status as ListingStatus;
      if (!STATUSES.includes(status)) return bad("不支援的案源狀態。");
      await setListingStatus(id, status);
      return ok({ status });
    }

    const lat = optionalNumber(body.lat);
    const lng = optionalNumber(body.lng);
    if (lat !== null && (lat < 21 || lat > 26)) return bad("緯度看起來不在台灣範圍內。");
    if (lng !== null && (lng < 118 || lng > 123)) return bad("經度看起來不在台灣範圍內。");

    await patchListing(id, {
      title: optionalText(body.title, 200) ?? undefined,
      totalPrice: optionalNumber(body.totalPrice),
      ping: optionalNumber(body.ping),
      age: optionalNumber(body.age),
      address: optionalText(body.address, 200),
      lat,
      lng
    });

    const listing = await getListing(id);
    return ok({ listing });
  } catch (error) {
    return fail("admin/listings/[id]", error);
  }
}
