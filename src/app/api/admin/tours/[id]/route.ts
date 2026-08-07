import { bad, fail, ok, optionalNumber, optionalText, readJson } from "@/lib/api";
import { type TourStatus, type TourTimeSlot, createSlotId, defaultExpiry } from "@/lib/tour";
import { deleteTour, getTour, patchTour, rotateTourToken, setTourTimeSlots } from "@/lib/tour-store";

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

    /**
     * 候選帶看時段。整份覆蓋。
     *
     * 前端只送 startsAt，id 與 picked 在這裡對回原本那筆 ——
     * 不然你新增一個時段就會把買方已經勾好的全部洗掉。
     */
    if (Array.isArray(body.timeSlots)) {
      if (body.timeSlots.length > 20) return bad("時段最多 20 個，太多買方也挑不動。");

      const before = new Map(tour.timeSlots.map((slot) => [slot.startsAt, slot]));
      const seen = new Set<string>();
      const slots: TourTimeSlot[] = [];

      for (const raw of body.timeSlots) {
        const startsAt = typeof raw?.startsAt === "string" ? raw.startsAt : "";
        const at = new Date(startsAt);
        if (!startsAt || Number.isNaN(at.getTime())) return bad("有一個時段的時間看不懂。");
        if (seen.has(at.toISOString())) continue; // 同一個時間重複填就吃掉
        seen.add(at.toISOString());

        const kept = before.get(startsAt) ?? before.get(at.toISOString());
        slots.push({
          id: kept?.id ?? createSlotId(),
          startsAt: at.toISOString(),
          picked: kept?.picked ?? false,
          // 「誰提的」也要一起留著，不然買方自己加的時段會被改寫成阿坤開的。
          by: kept?.by ?? "agent"
        });
      }

      await setTourTimeSlots(id, slots);
      return ok({ timeSlots: (await getTour(id))?.timeSlots ?? [] });
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
