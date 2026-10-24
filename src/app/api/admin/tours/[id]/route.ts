import { bad, fail, ok, optionalNumber, optionalText, readJson } from "@/lib/api";
import { type TourStatus, defaultExpiry } from "@/lib/tour";
import { deleteTour, getTour, patchTour, rotateTourToken } from "@/lib/tour-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: TourStatus[] = ["active", "revoked", "done"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);

    const tour = await getTour(id);
    if (!tour) return bad("找不到這張帶看單。", 404);

    // 換一把新鑰匙：舊連結立刻失效。買方把連結轉傳給別人時用這個。
    if (body.rotateToken === true) {
      const token = await rotateTourToken(id);
      return ok({ token });
    }

    if (typeof body.status === "string") {
      const status = body.status as TourStatus;
      if (!STATUSES.includes(status)) return bad("不支援的帶看單狀態。");
      await patchTour(id, { status });
      return ok({ status });
    }

    // 續期：從現在起再算一次天數，不是在原本的到期日往後加。
    const extendDays = optionalNumber(body.extendDays);
    if (extendDays !== null) {
      if (extendDays < 1 || extendDays > 180) return bad("有效天數請填 1 到 180 之間。");
      await patchTour(id, { expiresAt: defaultExpiry(extendDays) });
      return ok({ expiresAt: defaultExpiry(extendDays) });
    }

    const originLat = optionalNumber(body.originLat);
    const originLng = optionalNumber(body.originLng);
    if (originLat !== null && (originLat < 21 || originLat > 26)) return bad("緯度看起來不在台灣範圍內。");
    if (originLng !== null && (originLng < 118 || originLng > 123)) return bad("經度看起來不在台灣範圍內。");

    await patchTour(id, {
      title: optionalText(body.title, 100) ?? undefined,
      buyerName: optionalText(body.buyerName, 50),
      note: optionalText(body.note, 1000),
      originLabel: optionalText(body.originLabel, 100),
      originLat,
      originLng
    });

    return ok({ tour: await getTour(id) });
  } catch (error) {
    return fail("admin/tours/[id]", error);
  }
}

/**
 * 整筆刪掉。
 *
 * 沒有垃圾桶、沒有復原：這是刻意的。帶看紀錄不是重要到需要軟刪除的資料，
 * 多一個「已刪除」狀態只會讓列表跟查詢都要一直記得排除它。
 * 真正的保險做在前面 —— 畫面上要輸入確認才刪得掉。
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const tour = await getTour(id);
    if (!tour) return bad("找不到這筆帶看紀錄。", 404);

    await deleteTour(id);
    return ok({ deleted: true, title: tour.title });
  } catch (error) {
    return fail("admin/tours/[id] DELETE", error);
  }
}
