import { bad, fail, ok, optionalText, readJson } from "@/lib/api";
import { addTourItems, getTour, removeTourItem, setAgentNote } from "@/lib/tour-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS_PER_CALL = 30;

/** 把案源加進帶看單。待確認（needs_review）的會被擋下並回報，不會默默消失。 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);

    if (!(await getTour(id))) return bad("找不到這張帶看單。", 404);

    const listingIds = Array.isArray(body.listingIds) ? body.listingIds.map(String) : [];
    if (listingIds.length === 0) return bad("請先選擇要加入的物件。");
    if (listingIds.length > MAX_ITEMS_PER_CALL) return bad(`一次最多加入 ${MAX_ITEMS_PER_CALL} 筆。`);

    const result = await addTourItems(id, listingIds);
    return ok({ added: result.added, skipped: result.skipped });
  } catch (error) {
    return fail("admin/tours/[id]/items", error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);

    const listingId = optionalText(body.listingId, 64);
    if (!listingId) return bad("缺少要移除的物件。");

    await removeTourItem(id, listingId);
    return ok({});
  } catch (error) {
    return fail("admin/tours/[id]/items", error);
  }
}

/** 你自己的備註，只會出現在後台與帶看單上，買方頁看不到。 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);

    const listingId = optionalText(body.listingId, 64);
    if (!listingId) return bad("缺少物件編號。");

    await setAgentNote(id, listingId, optionalText(body.agentNote, 500) ?? "");
    return ok({});
  } catch (error) {
    return fail("admin/tours/[id]/items", error);
  }
}
