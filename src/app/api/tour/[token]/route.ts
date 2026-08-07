import { bad, fail, ok, optionalText, readJson } from "@/lib/api";
import { BUYER_CHOICES, type BuyerChoice, isTourOpen, tourClosedReason } from "@/lib/tour";
import {
  addBuyerTimeSlot,
  getTourByToken,
  markTourSubmitted,
  patchTour,
  setBuyerChoice,
  setBuyerTimePick
} from "@/lib/tour-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 買方用的 API —— 這是整個系統唯一不需要密碼就能寫入的地方。
 *
 * 防護不靠登入，靠三件事：
 *   1. token 有 160 bits 亂度，猜不到
 *   2. 每次都重新檢查帶看單是否仍然開啟（可撤銷、會過期）
 *   3. 寫入一律用 tour_id + listing_id 兩個條件夾住，
 *      就算有人拿別張單的 listing_id 來試，也只會更新到 0 列
 *
 * 買方能改的只有「自己的選擇」與「自己的稱呼」，碰不到價格、碰不到其他帶看單。
 */

async function openTourOr(token: string) {
  const tour = await getTourByToken(token);
  if (!tour) return { tour: null, response: bad("這個連結無效。", 404) };
  if (!isTourOpen(tour)) return { tour: null, response: bad(tourClosedReason(tour), 410) };
  return { tour, response: null };
}

/** 買方按「想看」或「略過」，或按下「送出」。 */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const { tour, response } = await openTourOr(token);
    if (!tour) return response;

    const body = await readJson(request);

    // 送出：勾選早就存好了，這裡只是標記「挑完了」。
    if (body.action === "submit") {
      await markTourSubmitted(tour.id);
      if (typeof body.buyerName === "string") {
        const name = optionalText(body.buyerName, 50);
        if (name) await patchTour(tour.id, { buyerName: name });
      }
      return ok({ submitted: true });
    }

    // 買方勾一個候選時段。
    if (body.action === "time") {
      const slotId = optionalText(body.slotId, 32);
      if (!slotId) return bad("缺少時段編號。");
      const result = await setBuyerTimePick(tour.id, slotId, body.picked === true);
      return ok({ slots: result.slots, missing: result.missing });
    }

    /**
     * 買方自己加一個時段（你開的都不方便的時候）。
     *
     * 這是買方唯一能「主動提出」的東西，其餘欄位一概碰不到。
     * 時間的合理性（不能是過去、不能太遠、上限 20 個）在 addBuyerTimeSlot 裡把關。
     */
    if (body.action === "add-time") {
      const startsAt = optionalText(body.startsAt, 40);
      if (!startsAt) return bad("缺少時間。");
      const result = await addBuyerTimeSlot(tour.id, startsAt);
      if (result.error) return bad(result.error);
      return ok({ slots: result.slots });
    }

    const listingId = optionalText(body.listingId, 64);
    const choice = String(body.choice ?? "") as BuyerChoice;

    if (!listingId) return bad("缺少物件編號。");
    if (!BUYER_CHOICES.includes(choice)) return bad("不支援的選擇。");

    await setBuyerChoice(tour.id, listingId, choice);
    return ok({ listingId, choice });
  } catch (error) {
    return fail("tour/[token]", error);
  }
}

/** 買方第一次進來時填的稱呼。不問電話 Email —— 你本來就知道對方是誰。 */
export async function PATCH(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const { tour, response } = await openTourOr(token);
    if (!tour) return response;

    const body = await readJson(request);
    const buyerName = optionalText(body.buyerName, 50);
    if (!buyerName) return bad("請填寫稱呼。");

    await patchTour(tour.id, { buyerName });
    return ok({ buyerName });
  } catch (error) {
    return fail("tour/[token]", error);
  }
}
