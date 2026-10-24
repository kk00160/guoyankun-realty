import { bad, fail, ok, optionalNumber, optionalText, readJson } from "@/lib/api";
import { TOUR_DEFAULT_DAYS } from "@/lib/tour";
import { createTour } from "@/lib/tour-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 開一筆新的帶看紀錄。建立當下就會拿到買方連結的 token。 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);

    const title = optionalText(body.title, 100);
    if (!title) return bad("請填寫帶看紀錄名稱。");

    const days = optionalNumber(body.days) ?? TOUR_DEFAULT_DAYS;
    if (days < 1 || days > 180) return bad("有效天數請填 1 到 180 之間。");

    const tour = await createTour({
      title,
      buyerName: optionalText(body.buyerName, 50),
      originLabel: optionalText(body.originLabel, 100),
      originLat: optionalNumber(body.originLat),
      originLng: optionalNumber(body.originLng),
      days
    });

    return ok({ tour });
  } catch (error) {
    return fail("admin/tours", error);
  }
}
