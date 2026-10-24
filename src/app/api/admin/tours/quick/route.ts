import { bad, fail, ok, optionalText, readJson } from "@/lib/api";
import { TOUR_DEFAULT_DAYS } from "@/lib/tour";
import { addTourItems, createTour } from "@/lib/tour-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 30;

/**
 * 一次做完「開帶看紀錄 + 放物件」，回傳買方連結。
 *
 * 為什麼要有這支：原本得先去 /admin/tours 開一張單，再回配案系統勾選，
 * 再回帶看紀錄複製連結 —— 三個頁面跳來跳去，而且沒有帶看紀錄的時候，
 * 勾完只會看到一句「先去開一筆帶看紀錄」，等於走到死路。
 *
 * 實際的動作是「挑好物件 → 拿到連結傳給買方」，這支就照那個動作做。
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);

    const listingIds = Array.isArray(body.listingIds) ? body.listingIds.map(String) : [];
    if (listingIds.length === 0) return bad("請先勾選要給買方看的物件。");
    if (listingIds.length > MAX_ITEMS) return bad(`一次最多 ${MAX_ITEMS} 筆。`);

    const title = optionalText(body.title, 100) ?? `看房清單 ${new Date().toLocaleDateString("zh-TW")}`;

    const tour = await createTour({
      title,
      buyerName: optionalText(body.buyerName, 50),
      days: TOUR_DEFAULT_DAYS
    });

    const result = await addTourItems(tour.id, listingIds);

    return ok({
      tour,
      token: tour.token,
      added: result.added,
      skipped: result.skipped
    });
  } catch (error) {
    return fail("admin/tours/quick", error);
  }
}
