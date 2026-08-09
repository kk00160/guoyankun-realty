import { bad, fail, ok, readJson } from "@/lib/api";
import { canRoute } from "@/lib/listings";
import { type RoutePoint, googleMapsUrls, mapTarget, orderRoute, routeSummary } from "@/lib/route";
import { getTour, listTourEntries, saveVisitOrder } from "@/lib/tour-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 排看房順序。這支有兩種用法，共用同一個 visit_order 欄位：
 *
 *   { order: [listingId, …] }   手動：後台按上下箭頭，畫面上的順序就是答案
 *   { scope: "interested" }     自動：只排買方勾「想看」的
 *   { scope: "remaining" }      自動：排掉「略過」以外的全部（買方還沒回覆時用）
 *
 * 手動優先。理由：自動排的是「路程最短」，但實際帶看還有屋主方便的時間、
 * 想壓軸的那間、順路吃飯 —— 那些演算法不知道。自動排完再手動微調，
 * 後按的那個就該蓋掉前一個。
 *
 * 自動排時沒有經緯度的物件排不進去，會原樣回報給你，
 * 讓你回後台補地址而不是默默漏掉。
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    const scope = body.scope === "remaining" ? "remaining" : "interested";

    const tour = await getTour(id);
    if (!tour) return bad("找不到這張帶看單。", 404);

    // --- 手動排序 ---
    // 不算路線、不回 mapUrls：這裡是「我說了算」，不需要再給一次演算法的意見。
    if (Array.isArray(body.order)) {
      const manual = (body.order as unknown[])
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .slice(0, 200);
      if (manual.length === 0) return bad("沒有收到要排的物件。");

      // saveVisitOrder 會再對一次這些 id 是不是真的在這張帶看單裡，
      // 回傳的是真的存進去的那些。
      const saved = await saveVisitOrder(id, [...new Set(manual)]);
      if (saved.length === 0) {
        return bad("這些物件已經不在這張帶看單裡了，順序沒有存。重新整理這一頁看目前的內容。");
      }
      return ok({ order: saved });
    }

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
        lng: entry.listing.lng as number,
        // 順序用座標算，但導航連結用社區名／地址 —— 大樓的座標常落在屋頂。
        query: mapTarget(entry.listing)?.query
      }));

    if (points.length === 0) {
      return bad(
        "這些物件都還沒有經緯度，排不出行車順序。在專案目錄跑 `npm run fill` 補一下（一筆約 5 秒）再回來排。" +
          "單間導航不受影響，帶看單上每一間都還是按得出來。"
      );
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
      // 出發點沒有座標時，用它的名字當導航起點（見 googleMapsUrls 的說明）。
      mapUrls: googleMapsUrls(ordered, origin, tour.originLabel ?? undefined),
      missingCoords
    });
  } catch (error) {
    return fail("admin/tours/[id]/order", error);
  }
}
