import { bad, fail, ok, readJson } from "@/lib/api";
import { canRoute } from "@/lib/listings";
import { type RoutePoint, googleMapsUrls, orderRoute, routeSummary } from "@/lib/route";
import { getTour, listTourEntries, saveVisitOrder } from "@/lib/tour-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 排看房順序。
 *
 * scope 決定要排哪些物件：
 *   interested（預設）：只排買方勾「想看」的
 *   remaining        ：排掉「略過」以外的全部（買方還沒回覆時用這個）
 *
 * 沒有經緯度的物件排不進去，會原樣回報給你，讓你回後台補地址而不是默默漏掉。
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    const scope = body.scope === "remaining" ? "remaining" : "interested";

    const tour = await getTour(id);
    if (!tour) return bad("找不到這張帶看單。", 404);

    const entries = await listTourEntries(id);
    const picked = entries.filter((entry) =>
      scope === "interested" ? entry.buyerChoice === "interested" : entry.buyerChoice !== "rejected"
    );

    if (picked.length === 0) {
      return bad(
        scope === "interested"
          ? "買方還沒有勾任何一間「想看」。"
          : "這張帶看單裡沒有可以排的物件。"
      );
    }

    const missingCoords = picked.filter((entry) => !canRoute(entry.listing)).map((entry) => entry.listing.title);
    const points: RoutePoint[] = picked
      .filter((entry) => canRoute(entry.listing))
      .map((entry) => ({
        id: entry.listingId,
        label: entry.listing.title,
        lat: entry.listing.lat as number,
        lng: entry.listing.lng as number
      }));

    if (points.length === 0) {
      return bad("這些物件都還沒有經緯度，排不了路線。請先在案源庫補上地址座標。");
    }

    const origin: RoutePoint | undefined =
      tour.originLat !== null && tour.originLng !== null
        ? { id: "origin", label: tour.originLabel ?? "出發點", lat: tour.originLat, lng: tour.originLng }
        : undefined;

    const ordered = orderRoute(points, origin);
    await saveVisitOrder(
      id,
      ordered.map((point) => point.id)
    );

    return ok({
      order: ordered.map((point) => point.id),
      summary: routeSummary(ordered, origin),
      mapUrls: googleMapsUrls(ordered, origin),
      missingCoords
    });
  } catch (error) {
    return fail("admin/tours/[id]/order", error);
  }
}
