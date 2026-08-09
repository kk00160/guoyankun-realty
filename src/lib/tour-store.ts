import "server-only";
import { db, readWithRetry } from "@/lib/db";
import {
  type ListingQuery,
  PAGE_SIZE,
  PING_BANDS,
  PRICE_BANDS,
  bandRange,
  parseKeyword
} from "@/lib/listing-filters";
import type { ListingUpdate, TourUpdate } from "@/lib/db-schema";
import {
  type Listing,
  type ListingStatus,
  checkListingSanity,
  toListing
} from "@/lib/listings";
import {
  type BuyerChoice,
  type Tour,
  type TourItem,
  createTourToken,
  defaultExpiry,
  isValidTokenFormat,
  toTour,
  toTourItem
} from "@/lib/tour";

/**
 * 帶看助手的資料存取層。
 *
 * 對照 appointment-store.ts：那支是預約系統的 JSON 檔版本，這支是帶看系統的資料庫版本。
 * 兩套刻意不合併 —— 預約系統已經上線在跑，這次不動它。
 *
 * 所有查詢都用 service_role key 在伺服器端執行（見 db.ts）。
 */

/**
 * 讀取用的包裝：錯誤轉成看得懂的訊息，會自己好的錯誤自動重試。
 *
 * 為什麼要重試：實際遇過 Supabase 回「JWT issued at future」——
 * 它的閘道跟資料庫節點時鐘差了一點點，幾秒後就恢復。
 * 沒有重試的話，那幾秒剛好開頁面的人會看到整頁掛掉。
 */
function readList<T>(
  run: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  what: string
) {
  return readWithRetry<T[]>(run, what);
}

/**
 * 讀單筆。查不到要回 null，不能回空陣列。
 *
 * ⚠️ 這裡把結果包進 { value } 是必要的，不是多此一舉。
 *
 * readWithRetry 內部寫的是 `return (data ?? []) as T` —— 那是為了「讀清單」設計的，
 * 查不到就給空陣列很合理。但單筆查詢查不到時 data 也是 null，
 * 同一行就會回傳 `[]`，而 `[]` 是 truthy。
 *
 * 實際造成的災難（2026-08-07）：買方拿一條已經被刪掉的連結進來，
 * getTourByToken 收到 `[]` 當成「有這筆」，toTour([]) 生出一個 id 是 "undefined" 的空殼，
 * 再拿它去查物件時 Postgres 噴 uuid 格式錯 —— 買方看到的是
 * 「系統暫時連不上，請稍後再開一次」，於是他會一直重試一條永遠不會活過來的連結。
 * 正確的訊息應該是「這個連結無效」。
 *
 * 包一層物件之後 data 永遠不是 null，那行 `?? []` 就碰不到我們的值。
 */
function readOne<T>(
  run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  what: string
): Promise<T | null> {
  return readWithRetry<{ value: T | null }>(
    () => Promise.resolve(run()).then(({ data, error }) => ({ data: { value: data }, error })),
    what
  ).then((wrapped) => wrapped.value);
}

/**
 * 只問數量的查詢也要走重試。
 *
 * count 查詢的回傳是 { count, error } 而不是 { data, error }，
 * 所以先轉成 readWithRetry 認得的形狀。少了這層，控台首頁在
 * 「JWT issued at future」那幾秒會空著數字 —— 實際踩過。
 */
function readCount(
  run: () => PromiseLike<{ count: number | null; error: { message: string } | null }>,
  what: string
) {
  return readWithRetry<number>(
    () => Promise.resolve(run()).then(({ count, error }) => ({ data: normaliseCount(count, what), error })),
    what
  );
}

/**
 * count 查詢回 null 時要當成錯誤，不可以當成 0。
 *
 * 實測（2026-08-07）：對一張「不存在的資料表」下 head + count 的查詢，
 * PostgREST 回的是 HTTP 204、count = null、error = null ——
 * 跟「表存在但是空的」完全分不出來。
 *
 * 寫成 count ?? 0 的話，畫面會很有自信地顯示「累計來客 0 筆」，
 * 而真相是那張表根本還沒建。這種安靜的錯誤比噴一個錯誤嚴重得多：
 * 你會以為沒人來過，實際上是資料根本沒在存。
 */
function normaliseCount(count: number | null, what: string): number {
  if (typeof count === "number") return count;
  throw new Error(
    `${what}讀不到數量（資料表可能還不存在）。` +
      "到 Supabase 的 SQL Editor 跑一次 supabase/ 底下的 schema 檔就會好。"
  );
}

// ---------------------------------------------------------------
// 案源
// ---------------------------------------------------------------

export type ListingPage = {
  rows: Listing[];
  total: number;
  page: number;
  pageCount: number;
};

/**
 * 依條件查案源。
 *
 * 篩選、排序、分頁全部在資料庫做。
 * 之前是撈 500 筆回來讓瀏覽器篩 —— 案源庫長到上萬筆之後，
 * 那會安靜地給出殘缺結果：你搜「東區」看到 8 筆，就以為東區只有 8 筆。
 */
export async function listListings(query: ListingQuery): Promise<ListingPage> {
  const build = () => {
    let q = db().from("listings").select("*", { count: "exact" });

    // 預設不顯示已封存與已成交，那些只是留著備查。
    if (query.status === "all") q = q.in("status", ["active", "needs_review"]);
    else q = q.eq("status", query.status);

    /**
     * 行政區條件 = 勾選的 ∪ 從關鍵字裡認出來的。
     * 打「永康區東橋七路」的時候，「永康區」要當成行政區條件，
     * 不能整串丟去比對 address（那樣永遠 0 筆，見 parseKeyword 的說明）。
     */
    const parsed = parseKeyword(query.keyword);
    const districts = [...new Set([...query.districts, ...parsed.districts])];
    if (districts.length) q = q.in("district", districts);
    if (query.houseTypes.length) q = q.in("house_type", query.houseTypes);

    // 自訂售價優先，填了就蓋過級距。
    const priceBand = bandRange(query.priceBands, PRICE_BANDS);
    const min = query.minPrice ?? priceBand.min;
    const max = query.maxPrice ?? priceBand.max;
    if (min !== null) q = q.gte("total_price", min);
    if (max !== null) q = q.lte("total_price", max);

    const ping = bandRange(query.pingBands, PING_BANDS);
    if (ping.min !== null) q = q.gte("ping", ping.min);
    if (ping.max !== null) q = q.lte("ping", ping.max);

    // 格局存成「3房2廳2衛」，所以比對開頭。5+ 展開成 5 到 9 房。
    if (query.rooms.length) {
      const prefixes = query.rooms.flatMap((room) => (room === "5+" ? ["5", "6", "7", "8", "9"] : [room]));
      q = q.or(prefixes.map((n) => `layout.like.${n}房%`).join(","));
    }

    /**
     * 關鍵字：每個詞都要命中（AND），每個詞可以命中四個欄位其中之一（OR）。
     *
     * 為什麼是四個欄位：以前只比對 title 與 address，社區名完全搜不到 ——
     * 實測 300 筆有社區名的物件裡，有 189 筆的社區名根本沒出現在標題裡，
     * 等於打「上東城」也找不到上東城。社區名存在 raw 這個 jsonb 裡，
     * 用 raw->>community_name 就查得到（已實測可行）。
     *
     * 為什麼多個詞要 AND：打「東橋 三房」以前會被當成一整串字比對，結果 0 筆。
     * 分開之後才是「東橋」而且「三房」。
     * PostgREST 的多次 .or() 之間本來就是 AND，剛好是我們要的。
     */
    for (const term of parsed.terms) {
      // 逗號、括號、百分比是 PostgREST or() 的語法字元，先清掉避免查詢被拆壞。
      const safe = term.replace(/[%,()]/g, "");
      if (!safe) continue;
      q = q.or(
        [
          `title.ilike.%${safe}%`,
          `address.ilike.%${safe}%`,
          `district.ilike.%${safe}%`,
          `raw->>community_name.ilike.%${safe}%`
        ].join(",")
      );
    }

    return q;
  };

  const from = (query.page - 1) * PAGE_SIZE;

  // 待確認排最前面（那是需要你動手的），其餘照最近更新時間。
  const result = await readWithRetry<{ rows: Record<string, unknown>[]; count: number }>(
    async () => {
      const { data, error, count } = await build()
        .order("status", { ascending: true })
        .order("last_seen_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      return { data: { rows: (data ?? []) as Record<string, unknown>[], count: count ?? 0 }, error };
    },
    "讀取案源"
  );

  return {
    rows: result.rows.map(toListing),
    total: result.count,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(result.count / PAGE_SIZE))
  };
}

/**
 * 案源總數，控台首頁用。
 *
 * 用 head + count 只問數字不搬資料，上萬筆也是一次很輕的查詢。
 */
export async function countListings(status: ListingStatus = "active"): Promise<number> {
  return readCount(
    () => db().from("listings").select("*", { count: "exact", head: true }).eq("status", status),
    "計算案源數量"
  );
}

export async function getListing(id: string): Promise<Listing | null> {
  const data = await readOne(() => db().from("listings").select("*").eq("id", id).maybeSingle(), "讀取案源");
  return data ? toListing(data as Record<string, unknown>) : null;
}

export type ListingInput = {
  title: string;
  district?: string | null;
  address?: string | null;
  exactAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
  totalPrice?: number | null;
  ping?: number | null;
  unitPrice?: number | null;
  layout?: string | null;
  age?: number | null;
  houseType?: string | null;
  floorInfo?: string | null;
  parking?: string | null;
  sourceUrl?: string | null;
  images?: string[];
};

/**
 * 手動建立一筆案源（你自己的案、公司內部案、朋友託售）。
 *
 * 一樣要過合理性閘門 —— 手滑把 1280 萬打成 12800 萬的機率，
 * 其實不比匯入解錯低。
 */
export async function createListing(input: ListingInput): Promise<Listing> {
  const unitPrice =
    input.unitPrice ??
    (input.totalPrice && input.ping ? Number((input.totalPrice / input.ping).toFixed(2)) : null);

  const reasons = checkListingSanity({
    title: input.title,
    totalPrice: input.totalPrice,
    ping: input.ping,
    unitPrice,
    age: input.age
  });

  const { data, error } = await db()
    .from("listings")
    .insert({
      source: "manual",
      title: input.title,
      district: input.district ?? null,
      address: input.address ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      total_price: input.totalPrice ?? null,
      ping: input.ping ?? null,
      unit_price: unitPrice,
      layout: input.layout ?? null,
      age: input.age ?? null,
      house_type: input.houseType ?? null,
      floor_info: input.floorInfo ?? null,
      parking: input.parking ?? null,
      source_url: input.sourceUrl ?? null,
      images: input.images ?? [],
      status: reasons.length > 0 ? "needs_review" : "active",
      review_reasons: reasons
    })
    .select("*")
    .single();

  if (error) throw new Error(`建立案源失敗：${error.message}`);
  return toListing(data as Record<string, unknown>);
}

/** 改狀態：把 needs_review 的確認掉、把成交的下架、把不要的封存。 */
export async function setListingStatus(id: string, status: ListingStatus) {
  const patch: ListingUpdate = { status };
  // 你親自確認過就把待確認的理由清掉，否則紅字會一直掛著。
  if (status === "active") patch.review_reasons = [];

  const { error } = await db().from("listings").update(patch).eq("id", id);
  if (error) throw new Error(`更新案源狀態失敗：${error.message}`);
}

/** 修正某幾個欄位（通常是補經緯度或改價）。改完重跑一次閘門。 */
export async function patchListing(id: string, input: Partial<ListingInput>) {
  const current = await getListing(id);
  if (!current) throw new Error("找不到這筆案源。");

  const totalPrice = input.totalPrice ?? current.totalPrice;
  const ping = input.ping ?? current.ping;
  const unitPrice =
    input.unitPrice ?? (totalPrice && ping ? Number((totalPrice / ping).toFixed(2)) : current.unitPrice);

  const reasons = checkListingSanity({
    title: input.title ?? current.title,
    totalPrice,
    ping,
    unitPrice,
    age: input.age ?? current.age
  });

  const patch: ListingUpdate = {
    total_price: totalPrice,
    ping,
    unit_price: unitPrice,
    status: reasons.length > 0 ? "needs_review" : "active",
    review_reasons: reasons
  };

  if (input.title !== undefined) patch.title = input.title;
  if (input.district !== undefined) patch.district = input.district;
  if (input.address !== undefined) patch.address = input.address;
  if (input.exactAddress !== undefined) patch.exact_address = input.exactAddress;
  if (input.lat !== undefined) patch.lat = input.lat;
  if (input.lng !== undefined) patch.lng = input.lng;
  if (input.layout !== undefined) patch.layout = input.layout;
  if (input.age !== undefined) patch.age = input.age;
  if (input.houseType !== undefined) patch.house_type = input.houseType;
  if (input.floorInfo !== undefined) patch.floor_info = input.floorInfo;
  if (input.parking !== undefined) patch.parking = input.parking;

  const { error } = await db().from("listings").update(patch).eq("id", id);
  if (error) throw new Error(`更新案源失敗：${error.message}`);
}

// ---------------------------------------------------------------
// 帶看單
// ---------------------------------------------------------------

export type TourWithCount = Tour & {
  itemCount: number;
  interestedCount: number;
  pendingCount: number;
  /**
   * 只有封面照的物件數。
   *
   * 批次匯入走清單 API，一次只帶回一張封面；完整相簿要一筆一筆開明細頁補（npm run fill）。
   * 這個數字要顯示在有「複製連結」按鈕的地方 ——
   * 否則整份只有一張照片的清單會直接傳到買方手機上，而畫面上完全沒有任何提示。
   */
  thinCount: number;
};

export async function listTours(): Promise<TourWithCount[]> {
  // 刻意分兩次查而不用 Supabase 的巢狀 select：
  // 巢狀 select 的型別推導要靠 schema 的 Relationships 中繼資料，手寫容易寫錯，
  // 而這裡最多幾十列，在 JS 裡對起來又快又不會錯。
  const rows = await readList(
    () =>
      db().from("tours").select("*").order("created_at", { ascending: false }).limit(200),
    "讀取帶看單"
  );

  const tours = rows.map((row) => toTour(row));
  if (tours.length === 0) return [];

  const items = await readList(
    () =>
      db()
      .from("tour_items")
      .select("tour_id, listing_id, buyer_choice")
      .in(
        "tour_id",
        tours.map((tour) => tour.id)
      ),
    "讀取帶看物件"
  );

  // 只撈 id + images 來數「照片幾張」。一次撈完再在 JS 裡對，
  // 比每張帶看單各發一次查詢便宜得多。
  const listingIds = [...new Set(items.map((item) => item.listing_id))];
  const photoCount = new Map<string, number>();
  if (listingIds.length > 0) {
    const listings = await readList(
      () => db().from("listings").select("id, images").in("id", listingIds),
      "讀取物件照片數"
    );
    for (const row of listings) {
      photoCount.set(String(row.id), Array.isArray(row.images) ? row.images.length : 0);
    }
  }

  return tours.map((tour) => {
    const own = items.filter((item) => item.tour_id === tour.id);
    return {
      ...tour,
      itemCount: own.length,
      interestedCount: own.filter((item) => item.buyer_choice === "interested").length,
      pendingCount: own.filter((item) => item.buyer_choice === "pending").length,
      thinCount: own.filter((item) => (photoCount.get(item.listing_id) ?? 0) <= 1).length
    };
  });
}

export async function getTour(id: string): Promise<Tour | null> {
  const data = await readOne(() => db().from("tours").select("*").eq("id", id).maybeSingle(), "讀取帶看單");
  return data ? toTour(data as Record<string, unknown>) : null;
}

/** 買方頁進來的入口。格式不對就直接回 null，不要拿奇怪字串去查資料庫。 */
export async function getTourByToken(token: string): Promise<Tour | null> {
  if (!isValidTokenFormat(token)) return null;

  const data = await readOne(() => db().from("tours").select("*").eq("token", token).maybeSingle(), "讀取帶看單");
  return data ? toTour(data as Record<string, unknown>) : null;
}

export async function createTour(input: {
  title: string;
  buyerName?: string | null;
  originLabel?: string | null;
  originLat?: number | null;
  originLng?: number | null;
  days?: number;
}): Promise<Tour> {
  const { data, error } = await db()
    .from("tours")
    .insert({
      title: input.title,
      buyer_name: input.buyerName ?? null,
      token: createTourToken(),
      expires_at: defaultExpiry(input.days),
      origin_label: input.originLabel ?? null,
      origin_lat: input.originLat ?? null,
      origin_lng: input.originLng ?? null
    })
    .select("*")
    .single();

  if (error) throw new Error(`建立帶看單失敗：${error.message}`);
  return toTour(data as Record<string, unknown>);
}

export async function patchTour(
  id: string,
  patch: {
    title?: string;
    buyerName?: string | null;
    status?: Tour["status"];
    originLabel?: string | null;
    originLat?: number | null;
    originLng?: number | null;
    note?: string | null;
    expiresAt?: string;
  }
) {
  const row: TourUpdate = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.buyerName !== undefined) row.buyer_name = patch.buyerName;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.originLabel !== undefined) row.origin_label = patch.originLabel;
  if (patch.originLat !== undefined) row.origin_lat = patch.originLat;
  if (patch.originLng !== undefined) row.origin_lng = patch.originLng;
  if (patch.note !== undefined) row.note = patch.note;
  if (patch.expiresAt !== undefined) row.expires_at = patch.expiresAt;

  if (Object.keys(row).length === 0) return;

  const { error } = await db().from("tours").update(row).eq("id", id);
  if (error) throw new Error(`更新帶看單失敗：${error.message}`);
}

/**
 * 整筆刪掉。
 *
 * tour_items.tour_id 有 on delete cascade（見 schema.sql），
 * 所以底下的物件關聯會一起清乾淨，不會留下孤兒列。
 * 案源本身（listings）不會被動到 —— 那是共用的，只是這次沒帶到而已。
 *
 * 沒有「復原」。刪掉之後那條買方連結也跟著失效。
 */
export async function deleteTour(id: string) {
  const { error } = await db().from("tours").delete().eq("id", id);
  if (error) throw new Error(`刪除帶看紀錄失敗：${error.message}`);
}

/** 換一把新鑰匙：舊連結立刻失效。買方把連結轉傳出去時用。 */
export async function rotateTourToken(id: string): Promise<string> {
  const token = createTourToken();
  const { error } = await db().from("tours").update({ token }).eq("id", id);
  if (error) throw new Error(`重新產生連結失敗：${error.message}`);
  return token;
}

// ---------------------------------------------------------------
// 帶看單裡的物件
// ---------------------------------------------------------------

export type TourEntry = TourItem & { listing: Listing };

export async function listTourEntries(tourId: string): Promise<TourEntry[]> {
  const itemRows = await readList(
    () =>
      db()
      .from("tour_items")
      .select("*")
      .eq("tour_id", tourId)
      .order("visit_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    "讀取帶看物件"
  );

  const items = itemRows.map((row) => toTourItem(row));
  if (items.length === 0) return [];

  const listingRows = await readList(
    () =>
      db()
      .from("listings")
      .select("*")
      .in(
        "id",
        items.map((item) => item.listingId)
      ),
    "讀取案源"
  );

  const byId = new Map(listingRows.map((row) => [String(row.id), toListing(row)]));

  // 案源被刪掉時對應的 tour_item 會被資料庫連帶刪除，理論上不會有孤兒；
  // 這裡仍然過濾一次，避免任何情況下把 undefined 丟進畫面。
  return items.flatMap((item) => {
    const listing = byId.get(item.listingId);
    return listing ? [{ ...item, listing }] : [];
  });
}

/**
 * 加物件進帶看單。
 *
 * needs_review 的案源在這裡就擋掉 —— 這是「買方頁永遠看不到未確認資料」的第一道防線，
 * 買方頁本身還有第二道。兩道都擋是刻意的：這是整個系統最不能出錯的地方。
 */
export async function addTourItems(tourId: string, listingIds: string[]) {
  if (listingIds.length === 0) return { added: 0, skipped: [] as string[] };

  const rows = await readList(
    () =>
      db().from("listings").select("id, title, status").in("id", listingIds),
    "讀取案源"
  ) as { id: string; title: string; status: string }[];

  const usable = rows.filter((row) => row.status === "active");
  const skipped = rows.filter((row) => row.status !== "active").map((row) => row.title);

  if (usable.length > 0) {
    const { error } = await db()
      .from("tour_items")
      .upsert(
        usable.map((row) => ({ tour_id: tourId, listing_id: row.id })),
        { onConflict: "tour_id,listing_id", ignoreDuplicates: true }
      );
    if (error) throw new Error(`加入帶看單失敗：${error.message}`);
  }

  return { added: usable.length, skipped };
}

export async function removeTourItem(tourId: string, listingId: string) {
  const { error } = await db()
    .from("tour_items")
    .delete()
    .eq("tour_id", tourId)
    .eq("listing_id", listingId);
  if (error) throw new Error(`移除物件失敗：${error.message}`);
}

/**
 * 買方按下「送出」。
 *
 * 勾選本身是即時存的（見 setBuyerChoice），所以這裡不是在存資料，
 * 是在區分「還在挑」跟「挑完了，可以安排帶看」。
 *
 * 刻意不讓它失敗就中斷整個流程：買方的選擇早就存好了，
 * 就算這一筆時間戳沒寫進去，也要讓買方看到「已送出」。
 */
export async function markTourSubmitted(tourId: string) {
  const { error } = await db()
    .from("tours")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", tourId);

  // 欄位還沒建（舊資料庫沒跑過新的 schema.sql）也不要擋住買方。
  if (error) console.error("[tour] 標記送出失敗：", error.message);
}

export async function setBuyerChoice(tourId: string, listingId: string, choice: BuyerChoice) {
  const { error } = await db()
    .from("tour_items")
    .update({
      buyer_choice: choice,
      decided_at: choice === "pending" ? null : new Date().toISOString()
    })
    .eq("tour_id", tourId)
    .eq("listing_id", listingId);

  if (error) throw new Error(`儲存選擇失敗：${error.message}`);
}

/**
 * 把看房順序寫回去。帶看單、行程連結與報告都照這個順序顯示。
 *
 * 兩個地方會呼叫：自動排路線，以及後台手動按上下箭頭。兩邊共用同一支，
 * 順序的寫法只有這一種，不會有「自動排的」跟「手動排的」兩套規則。
 *
 * 一次 upsert 寫完，不要一筆一筆 update：手動微調是連續按的動作，
 * 每按一下就跟新加坡來回 N 趟，八間房子就是八趟，按起來會有明顯延遲。
 *
 * 先讀一次現有的 item 不是多餘的 —— upsert 碰到不在這張帶看單裡的
 * listing_id 會「新增」一筆，等於憑空把一間房子塞進帶看單。先對過再寫。
 */
export async function saveVisitOrder(tourId: string, orderedListingIds: string[]): Promise<string[]> {
  const existing = await readList(
    () => db().from("tour_items").select("listing_id").eq("tour_id", tourId),
    "讀取帶看物件"
  );
  const known = new Set(existing.map((row) => String(row.listing_id)));

  const ordered = orderedListingIds.filter((listingId) => known.has(listingId));
  const inOrder = new Set(ordered);

  // 送來的沒有一筆對得上（例如另一個分頁把整張帶看單換掉了）就什麼都不要動。
  // 下面會把沒排到的站號清成 null —— 在這種情況下那等於默默把整張單的順序洗掉。
  if (ordered.length === 0) return [];

  const rows = [
    ...ordered.map((listingId, index) => ({ tour_id: tourId, listing_id: listingId, visit_order: index + 1 })),
    // 沒排進這次順序的，站號一律清掉。
    // 不清的話會留下上一次排路線的舊站號 —— 那間房子明明沒排進去，
    // 重新整理之後卻插在中間，而且畫面上完全看不出來為什麼。
    ...[...known]
      .filter((listingId) => !inOrder.has(listingId))
      .map((listingId) => ({ tour_id: tourId, listing_id: listingId, visit_order: null }))
  ];

  const { error } = await db().from("tour_items").upsert(rows, { onConflict: "tour_id,listing_id" });
  if (error) throw new Error(`儲存看房順序失敗：${error.message}`);

  // 回傳「真的存進去的那些」，不要把呼叫端送來的原樣丟回去 ——
  // 那會讓一筆都沒對上的情況看起來像成功了。
  return ordered;
}

export async function setAgentNote(tourId: string, listingId: string, note: string) {
  const { error } = await db()
    .from("tour_items")
    .update({ agent_note: note })
    .eq("tour_id", tourId)
    .eq("listing_id", listingId);
  if (error) throw new Error(`儲存備註失敗：${error.message}`);
}

// ---------------------------------------------------------------
// 資料匯入健康狀態
// ---------------------------------------------------------------

export type CrawlRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  found: number;
  inserted: number;
  updated: number;
  flagged: number;
  ok: boolean;
  error: string | null;
};

export async function recentCrawlRuns(limit = 7): Promise<CrawlRun[]> {
  const rows = await readList(
    () =>
      db().from("crawl_runs").select("*").order("started_at", { ascending: false }).limit(limit),
    "讀取匯入紀錄"
  ) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: String(row.id),
    startedAt: String(row.started_at ?? ""),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    found: Number(row.found ?? 0),
    inserted: Number(row.inserted ?? 0),
    updated: Number(row.updated ?? 0),
    flagged: Number(row.flagged ?? 0),
    ok: Boolean(row.ok),
    error: row.error ? String(row.error) : null
  }));
}

/**
 * 資料匯入是不是已經悄悄壞掉了。
 *
 * 來源網站改版之後，最常見的失效方式不是報錯，是「跑完了但一筆都沒進來」。
 * 這個判斷讓那件事在後台變成紅字，而不是讓你繼續拿三個月前的舊資料去談。
 */
export function crawlerLooksBroken(runs: CrawlRun[]) {
  if (runs.length === 0) return { broken: false, reason: "" };

  const latest = runs[0];
  const hoursSince = (Date.now() - new Date(latest.startedAt).getTime()) / 3600000;

  if (hoursSince > 48) {
    return { broken: true, reason: `已經 ${Math.floor(hoursSince / 24)} 天沒有跑過匯入` };
  }
  if (!latest.ok) {
    return { broken: true, reason: `最近一次匯入失敗：${latest.error ?? "未知原因"}` };
  }

  const recent = runs.slice(0, 2);
  if (recent.length === 2 && recent.every((run) => run.found === 0)) {
    return { broken: true, reason: "連續兩次都匯入 0 筆，來源可能改版了" };
  }

  return { broken: false, reason: "" };
}
