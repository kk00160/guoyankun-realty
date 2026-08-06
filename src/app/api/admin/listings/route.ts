import { bad, fail, ok, optionalNumber, optionalText, readJson } from "@/lib/api";
import { TAINAN_DISTRICTS } from "@/lib/listings";
import { createListing } from "@/lib/tour-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 手動新增一筆案源：你自己的案、公司內部案、朋友託售，不是只有匯入進來的。 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);

    const title = optionalText(body.title, 200);
    if (!title) return bad("請填寫物件名稱。");

    const district = optionalText(body.district, 20);
    if (district && !TAINAN_DISTRICTS.includes(district as (typeof TAINAN_DISTRICTS)[number])) {
      return bad("行政區不在台南市範圍內。");
    }

    const totalPrice = optionalNumber(body.totalPrice);
    const ping = optionalNumber(body.ping);
    if (totalPrice !== null && totalPrice <= 0) return bad("總價要大於 0。");
    if (ping !== null && ping <= 0) return bad("坪數要大於 0。");

    const lat = optionalNumber(body.lat);
    const lng = optionalNumber(body.lng);
    if (lat !== null && (lat < 21 || lat > 26)) return bad("緯度看起來不在台灣範圍內。");
    if (lng !== null && (lng < 118 || lng > 123)) return bad("經度看起來不在台灣範圍內。");

    const listing = await createListing({
      title,
      district,
      address: optionalText(body.address, 200),
      lat,
      lng,
      totalPrice,
      ping,
      layout: optionalText(body.layout, 50),
      age: optionalNumber(body.age),
      houseType: optionalText(body.houseType, 30),
      floorInfo: optionalText(body.floorInfo, 30),
      parking: optionalText(body.parking, 50),
      sourceUrl: optionalText(body.sourceUrl, 500)
    });

    return ok({ listing });
  } catch (error) {
    return fail("admin/listings", error);
  }
}
