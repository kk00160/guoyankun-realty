/**
 * 案源篩選條件。
 *
 * 條件放在網址的 query string 裡，不是 React state。這樣：
 *   - 上一頁／下一頁會回到上一組條件
 *   - 常用的搜尋可以直接加書籤
 *   - 篩選在資料庫做，不是撈回來再用瀏覽器篩
 *
 * 最後一點是關鍵：案源庫會長到一萬多筆，撈回來再篩只會拿到殘缺的結果，
 * 而且不會有任何錯誤提示 —— 你會以為東區只有那幾間。
 *
 * 純資料 + 純函式，client 與 server 共用。
 */

/** 售價級距。照 591 篩選器的分法，台南的物件幾乎都落在這幾檔。 */
export const PRICE_BANDS = [
  { key: "0-500", label: "500萬以下", min: null, max: 500 },
  { key: "500-750", label: "500-750萬", min: 500, max: 750 },
  { key: "750-1000", label: "750-1000萬", min: 750, max: 1000 },
  { key: "1000-1250", label: "1000-1250萬", min: 1000, max: 1250 },
  { key: "1250-1500", label: "1250-1500萬", min: 1250, max: 1500 },
  { key: "1500-2000", label: "1500-2000萬", min: 1500, max: 2000 },
  { key: "2000-", label: "2000萬以上", min: 2000, max: null }
] as const;

/** 權狀坪數級距。 */
export const PING_BANDS = [
  { key: "0-20", label: "20坪以下", min: null, max: 20 },
  { key: "20-30", label: "20-30坪", min: 20, max: 30 },
  { key: "30-40", label: "30-40坪", min: 30, max: 40 },
  { key: "40-50", label: "40-50坪", min: 40, max: 50 },
  { key: "50-60", label: "50-60坪", min: 50, max: 60 },
  { key: "60-100", label: "60-100坪", min: 60, max: 100 },
  { key: "100-", label: "100坪以上", min: 100, max: null }
] as const;

/** 建物型態。這五種就是資料庫裡實際會出現的值，不多也不少。 */
export const HOUSE_TYPES = ["別墅", "透天厝", "公寓", "華廈", "電梯大樓"] as const;

/** 格局只看房數。5 房以上合成一檔，因為 6 房以上的物件很少。 */
export const ROOM_OPTIONS = [
  { key: "1", label: "1房" },
  { key: "2", label: "2房" },
  { key: "3", label: "3房" },
  { key: "4", label: "4房" },
  { key: "5+", label: "5房及以上" }
] as const;

export const PAGE_SIZE = 24;

export type ListingQuery = {
  districts: string[];
  priceBands: string[];
  pingBands: string[];
  houseTypes: string[];
  rooms: string[];
  /** 自訂售價，填了就蓋過上面的級距。 */
  minPrice: number | null;
  maxPrice: number | null;
  keyword: string;
  /** all = 可用 + 待確認 */
  status: string;
  page: number;
  /** 有沒有按過「搜尋」。沒按過就只顯示篩選器，不列物件。 */
  searched: boolean;
};

const EMPTY: ListingQuery = {
  districts: [],
  priceBands: [],
  pingBands: [],
  houseTypes: [],
  rooms: [],
  minPrice: null,
  maxPrice: null,
  keyword: "",
  status: "all",
  page: 1,
  searched: false
};

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const positive = (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function parseListingQuery(params: Record<string, string | string[] | undefined>): ListingQuery {
  const get = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const query: ListingQuery = {
    ...EMPTY,
    districts: list(get("d")),
    priceBands: list(get("price")),
    pingBands: list(get("ping")),
    houseTypes: list(get("type")),
    rooms: list(get("rooms")),
    minPrice: positive(get("min")),
    maxPrice: positive(get("max")),
    keyword: (get("q") ?? "").trim().slice(0, 60),
    status: get("status") ?? "all",
    page: Math.max(1, Number(get("page")) || 1)
  };

  // 只要帶了任何條件，或明確按了「搜尋全部」，就算搜過了。
  query.searched =
    get("s") === "1" ||
    query.districts.length > 0 ||
    query.priceBands.length > 0 ||
    query.pingBands.length > 0 ||
    query.houseTypes.length > 0 ||
    query.rooms.length > 0 ||
    query.minPrice !== null ||
    query.maxPrice !== null ||
    query.keyword.length > 0;

  return query;
}

/** 把條件寫回網址。翻頁時只換 page，其餘保持不變。 */
export function buildListingHref(query: ListingQuery, overrides: Partial<ListingQuery> = {}) {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();

  if (merged.districts.length) params.set("d", merged.districts.join(","));
  if (merged.priceBands.length) params.set("price", merged.priceBands.join(","));
  if (merged.pingBands.length) params.set("ping", merged.pingBands.join(","));
  if (merged.houseTypes.length) params.set("type", merged.houseTypes.join(","));
  if (merged.rooms.length) params.set("rooms", merged.rooms.join(","));
  if (merged.minPrice) params.set("min", String(merged.minPrice));
  if (merged.maxPrice) params.set("max", String(merged.maxPrice));
  if (merged.keyword) params.set("q", merged.keyword);
  if (merged.status !== "all") params.set("status", merged.status);
  if (merged.page > 1) params.set("page", String(merged.page));

  // 沒有任何條件時也要留個記號，否則「搜尋全部」按下去會被當成沒搜過。
  if ([...params.keys()].length === 0) params.set("s", "1");

  return `/admin/listings?${params.toString()}`;
}

/** 把級距 key 轉成實際的數值範圍。多選時取聯集的最小與最大。 */
export function bandRange(
  keys: string[],
  bands: readonly { key: string; min: number | null; max: number | null }[]
) {
  const picked = bands.filter((band) => keys.includes(band.key));
  if (picked.length === 0) return { min: null, max: null };

  // 只要有一檔沒有下界（或上界），整個範圍就沒有下界（或上界）。
  const min = picked.some((band) => band.min === null)
    ? null
    : Math.min(...picked.map((band) => band.min as number));
  const max = picked.some((band) => band.max === null)
    ? null
    : Math.max(...picked.map((band) => band.max as number));

  return { min, max };
}

/** 給畫面用的一句話摘要：「東區、永康區 · 1000-1250萬 · 3房」。 */
export function describeQuery(query: ListingQuery) {
  const parts: string[] = [];
  if (query.districts.length) parts.push(query.districts.join("、"));

  if (query.minPrice || query.maxPrice) {
    parts.push(`${query.minPrice ?? "不限"}-${query.maxPrice ?? "不限"}萬`);
  } else if (query.priceBands.length) {
    parts.push(query.priceBands.map((k) => PRICE_BANDS.find((b) => b.key === k)?.label ?? k).join("、"));
  }

  if (query.pingBands.length) {
    parts.push(query.pingBands.map((k) => PING_BANDS.find((b) => b.key === k)?.label ?? k).join("、"));
  }
  if (query.houseTypes.length) parts.push(query.houseTypes.join("、"));
  if (query.rooms.length) {
    parts.push(query.rooms.map((k) => ROOM_OPTIONS.find((r) => r.key === k)?.label ?? k).join("、"));
  }
  if (query.keyword) parts.push(`「${query.keyword}」`);

  return parts.length > 0 ? parts.join("　·　") : "全部案源";
}
