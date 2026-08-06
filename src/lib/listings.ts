/**
 * 案源的型別、顯示格式，以及「資料合理性閘門」。
 *
 * 這支檔案沒有任何 I/O，本機匯入腳本與網站共用同一套判斷，
 * 才不會出現「匯入時覺得沒問題、網站覺得有問題」這種兩套標準的情況。
 */

/** 台南 37 個行政區。順序照常見房產網站篩選器上的排列，方便對照。 */
export const TAINAN_DISTRICTS = [
  "永康區", "安南區", "東區", "北區", "南區", "中西區", "仁德區", "新營區", "安平區", "歸仁區", "佳里區",
  "善化區", "麻豆區", "新化區", "新市區", "關廟區", "安定區", "白河區", "西港區", "學甲區", "鹽水區", "下營區",
  "後壁區", "六甲區", "七股區", "官田區", "柳營區", "東山區", "將軍區", "玉井區", "北門區", "大內區", "楠西區",
  "南化區", "山上區", "左鎮區", "龍崎區"
] as const;

export type ListingSource = "591" | "manual";

/**
 * active      ：資料通過合理性閘門，可以放進帶看單給買方看
 * needs_review：閘門沒過，只在後台出現，永遠不會出現在買方頁
 * archived    ：手動封存
 * sold        ：已成交或已下架
 */
export type ListingStatus = "active" | "needs_review" | "archived" | "sold";

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  active: "可用",
  needs_review: "待確認",
  archived: "已封存",
  sold: "已成交／下架"
};

export type Listing = {
  id: string;
  source: ListingSource;
  sourceId: string | null;
  sourceUrl: string | null;
  title: string;
  district: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  totalPrice: number | null;
  ping: number | null;
  unitPrice: number | null;
  layout: string | null;
  age: number | null;
  houseType: string | null;
  floorInfo: string | null;
  parking: string | null;
  images: string[];
  status: ListingStatus;
  reviewReasons: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  /** 主建物坪數。跟權狀坪數一起才算得出公設比。 */
  mainArea: number | null;
  /** 用途：住宅／店面／辦公之類。 */
  kindName: string | null;
  communityName: string | null;
  /** 同社區還有幾間在賣。談判時有用：同社區三間一起掛，屋主通常比較軟。 */
  communitySaleNum: number | null;
  /** 591 上刊登多久了，例：「55天前」。掛越久議價空間通常越大。 */
  postedLabel: string | null;
  /** 誰在賣：仲介還是屋主自售。決定怎麼接洽。 */
  sellerLabel: string | null;
  /** 591 的標籤，例：有陽台、近捷運。 */
  tags: string[];
};

/** Supabase 回傳的是 snake_case，統一在這裡轉成前端用的 camelCase。 */
export function toListing(row: Record<string, unknown>): Listing {
  const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));
  const str = (value: unknown) => (value === null || value === undefined ? null : String(value));

  return {
    id: String(row.id),
    source: (row.source === "591" ? "591" : "manual") as ListingSource,
    sourceId: str(row.source_id),
    sourceUrl: str(row.source_url),
    title: String(row.title ?? ""),
    district: str(row.district),
    address: str(row.address),
    lat: num(row.lat),
    lng: num(row.lng),
    totalPrice: num(row.total_price),
    ping: num(row.ping),
    unitPrice: num(row.unit_price),
    layout: str(row.layout),
    age: num(row.age),
    houseType: str(row.house_type),
    floorInfo: str(row.floor_info),
    parking: str(row.parking),
    images: Array.isArray(row.images) ? (row.images as unknown[]).map(String) : [],
    status: (row.status ?? "active") as ListingStatus,
    reviewReasons: Array.isArray(row.review_reasons) ? (row.review_reasons as unknown[]).map(String) : [],
    firstSeenAt: String(row.first_seen_at ?? ""),
    lastSeenAt: String(row.last_seen_at ?? ""),
    ...readExtras(row.raw)
  };
}

/**
 * 從 raw（591 原始回應）補幾個對房仲有用、但沒有獨立欄位的資料。
 *
 * 這些欄位匯入時本來就一起存進 raw 了，只是之前沒拿出來用。
 * 放在這裡而不是加資料表欄位，是因為它們只用來顯示，不需要拿來篩選或排序。
 */
function readExtras(raw: unknown) {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const str = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value).trim();
    return text.length > 0 ? text : null;
  };

  return {
    mainArea: num(source.mainarea),
    kindName: str(source.kind_name),
    communityName: str(source.community_name),
    communitySaleNum: num(source.community_sale_num),
    postedLabel: str(source.refreshtime),
    sellerLabel: str(source.nick_name) ?? str(source.linkman),
    tags: Array.isArray(source.tag) ? source.tag.map(String).filter(Boolean).slice(0, 8) : []
  };
}

/**
 * 公設比。買方第一個會問的數字之一，591 沒有直接給，要自己算。
 * 權狀扣掉主建物就是公設加附屬建物，所以這是概算，不是登記謄本上的數字。
 */
export function publicRatio(listing: Pick<Listing, "ping" | "mainArea">) {
  if (!listing.ping || !listing.mainArea || listing.mainArea >= listing.ping) return null;
  return (1 - listing.mainArea / listing.ping) * 100;
}

// ---------------------------------------------------------------
// 資料合理性閘門
// ---------------------------------------------------------------

/**
 * 為什麼需要這道閘門：
 *
 * 外部資料來源出問題時，不見得會回錯誤碼 —— 有可能回來的是「看起來正常的錯誤數值」。
 * 也就是說匯入壞掉的時候不會有任何錯誤訊息，你只會拿到錯的價格。
 * 房仲拿錯價格去跟買方談，比沒有資料嚴重得多。
 *
 * 所以每一筆資料在能被放進帶看單之前，都要先通過這裡。
 * 沒過的標成 needs_review，只出現在後台，買方頁一律看不到。
 *
 * 判斷刻意寬鬆：這道閘門要抓的是「明顯不可能」的資料，不是「比較貴」的物件。
 * 寧可放過幾筆怪資料讓你自己看到，也不要每天丟一堆假警報給你。
 */

/** 台南住宅的合理區間。抓的是「不可能」而不是「不常見」，所以上下界放得很寬。 */
const BOUNDS = {
  totalPrice: { min: 50, max: 30000 },   // 萬元。50 萬以下、3 億以上在台南住宅市場不合理
  ping: { min: 3, max: 500 },            // 權狀坪
  unitPrice: { min: 2, max: 80 },        // 萬元／坪
  age: { min: 0, max: 100 }              // 年
};

/** 總價 ÷ 坪數 與刊登標示單價的容許誤差。各家的計算基準偶有出入，給 25%。 */
const UNIT_PRICE_TOLERANCE = 0.25;

/** 與上次爬到的價格相比，變動超過這個比例就請你自己看一眼。 */
const PRICE_JUMP_TOLERANCE = 0.3;

export type SanityInput = {
  title?: string | null;
  totalPrice?: number | null;
  ping?: number | null;
  unitPrice?: number | null;
  age?: number | null;
};

/**
 * 回傳「有問題的原因」清單（中文，會直接顯示在後台）。
 * 空陣列 = 通過。
 *
 * @param input     這次抓到的資料
 * @param previous  上一次存進資料庫的同一筆（沒有就傳 undefined）
 */
export function checkListingSanity(input: SanityInput, previous?: SanityInput): string[] {
  const reasons: string[] = [];
  const { title, totalPrice, ping, unitPrice, age } = input;

  const finite = (value: number | null | undefined): value is number =>
    typeof value === "number" && Number.isFinite(value);

  // --- 必要欄位 ---
  if (!title || !title.trim()) reasons.push("缺少標題");
  if (!finite(totalPrice)) reasons.push("缺少總價");
  if (!finite(ping)) reasons.push("缺少坪數");

  // --- 數值區間 ---
  if (finite(totalPrice) && (totalPrice < BOUNDS.totalPrice.min || totalPrice > BOUNDS.totalPrice.max)) {
    reasons.push(`總價 ${totalPrice} 萬超出合理範圍`);
  }
  if (finite(ping) && (ping < BOUNDS.ping.min || ping > BOUNDS.ping.max)) {
    reasons.push(`坪數 ${ping} 坪超出合理範圍`);
  }
  if (finite(unitPrice) && (unitPrice < BOUNDS.unitPrice.min || unitPrice > BOUNDS.unitPrice.max)) {
    reasons.push(`單價 ${unitPrice} 萬／坪超出合理範圍`);
  }
  if (finite(age) && (age < BOUNDS.age.min || age > BOUNDS.age.max)) {
    reasons.push(`屋齡 ${age} 年超出合理範圍`);
  }

  // --- 內部一致性：總價 ÷ 坪數 應該接近網站標的單價 ---
  // 對不上通常代表某個欄位被解錯或被塞了假值，是最有效的一個訊號。
  if (finite(totalPrice) && finite(ping) && ping > 0 && finite(unitPrice) && unitPrice > 0) {
    const derived = totalPrice / ping;
    const drift = Math.abs(derived - unitPrice) / unitPrice;
    if (drift > UNIT_PRICE_TOLERANCE) {
      reasons.push(
        `總價÷坪數為 ${derived.toFixed(1)} 萬／坪，與標示單價 ${unitPrice} 萬／坪 對不上`
      );
    }
  }

  // --- 與上次比對：價格暴衝暴跌 ---
  // 可能是真的改價，也可能是被餵了假資料，兩種都值得你自己看一眼再放給買方。
  if (previous && finite(totalPrice) && finite(previous.totalPrice) && previous.totalPrice > 0) {
    const jump = Math.abs(totalPrice - previous.totalPrice) / previous.totalPrice;
    if (jump > PRICE_JUMP_TOLERANCE) {
      reasons.push(`總價從 ${previous.totalPrice} 萬變成 ${totalPrice} 萬，變動超過三成`);
    }
  }

  return reasons;
}

/** 沒有經緯度就排不了路線。這不算資料錯誤，所以不擋，只在後台提示你補地址。 */
export function canRoute(listing: Pick<Listing, "lat" | "lng">) {
  return typeof listing.lat === "number" && typeof listing.lng === "number";
}

// ---------------------------------------------------------------
// 顯示格式
// ---------------------------------------------------------------

/** 總價。台南住宅講「萬」最直覺，破億才換單位。 */
export function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "價格未提供";
  if (value >= 10000) {
    const yi = Math.floor(value / 10000);
    const wan = Math.round(value % 10000);
    return wan > 0 ? `${yi} 億 ${wan.toLocaleString("zh-TW")} 萬` : `${yi} 億`;
  }
  return `${value.toLocaleString("zh-TW")} 萬`;
}

export function formatPing(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} 坪`;
}

export function formatUnitPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} 萬／坪`;
}

export function formatAge(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value < 1) return "新成屋";
  return `${Math.round(value)} 年`;
}

/** 資料更新時間。買方頁一定要顯示，讓對方知道這是快照不是即時報價。 */
export function formatSeenAt(iso: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

/**
 * 疑似重複刊登的分組鍵：同區 + 同總價 + 同坪數。
 *
 * 第一版刻意不做自動合併 —— 演算法很容易把兩間不同的房子判成同一間，
 * 而房仲把兩間房搞混的代價太高。這裡只負責把疑似重複的排在一起讓你一眼看到。
 */
export function dedupeKey(listing: Listing) {
  if (listing.totalPrice === null || listing.ping === null) return null;
  return `${listing.district ?? "?"}|${listing.totalPrice}|${listing.ping.toFixed(1)}`;
}
