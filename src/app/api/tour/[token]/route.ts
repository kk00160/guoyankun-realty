import { bad, fail, ok, optionalText, readJson } from "@/lib/api";
import { BUYER_CHOICES, type BuyerChoice, isTourOpen, tourClosedReason } from "@/lib/tour";
import { getTourByToken, patchTour, setBuyerChoice } from "@/lib/tour-store";

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

/** 買方按「想看」或「略過」。 */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const { tour, response } = await openTourOr(token);
    if (!tour) return response;

    const body = await readJson(request);
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
