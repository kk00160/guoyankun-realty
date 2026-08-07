import { bad, fail, ok, optionalText, readJson } from "@/lib/api";
import { deleteLead, patchLead } from "@/lib/lead-store";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 改狀態（待聯絡／已聯絡／結案／垃圾）或加備註。 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);

    if (typeof body.status === "string") {
      const status = body.status as LeadStatus;
      if (!LEAD_STATUSES.includes(status)) return bad("不支援的狀態。");
      await patchLead(id, { status });
      return ok({ status });
    }

    if (body.agentNote !== undefined) {
      await patchLead(id, { agentNote: optionalText(body.agentNote, 1000) });
      return ok({ saved: true });
    }

    return bad("沒有要更新的欄位。");
  } catch (error) {
    return fail("admin/leads/[id]", error);
  }
}

/**
 * 刪掉一筆。
 *
 * 一般不建議刪客戶資料，但「垃圾訊息」是真的會來的，
 * 留著只會讓名單越翻越煩。真的是客戶就改成「結案」，不要刪。
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await deleteLead(id);
    return ok({ deleted: true });
  } catch (error) {
    return fail("admin/leads/[id] DELETE", error);
  }
}
