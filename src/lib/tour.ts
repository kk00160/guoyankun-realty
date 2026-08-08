/**
 * 帶看單的型別、狀態判斷與買方連結 token。
 *
 * 這支檔案保持「純函式、無 I/O」，跟 booking.ts 一樣可以被 client component 直接 import。
 */

export type TourStatus = "active" | "revoked" | "done";

export const TOUR_STATUS_LABEL: Record<TourStatus, string> = {
  active: "進行中",
  revoked: "已撤銷",
  done: "已結束"
};

/** pending：買方還沒表態　interested：想看　rejected：略過 */
export type BuyerChoice = "pending" | "interested" | "rejected";

export const BUYER_CHOICE_LABEL: Record<BuyerChoice, string> = {
  pending: "未選",
  interested: "想看",
  rejected: "略過"
};

export const BUYER_CHOICES: readonly BuyerChoice[] = ["pending", "interested", "rejected"];

export type Tour = {
  id: string;
  title: string;
  buyerName: string | null;
  token: string;
  expiresAt: string;
  status: TourStatus;
  originLabel: string | null;
  originLat: number | null;
  originLng: number | null;
  note: string | null;
  /** 買方按下「送出」的時間。null = 還在看。 */
  submittedAt: string | null;
  createdAt: string;
};

export type TourItem = {
  id: string;
  tourId: string;
  listingId: string;
  buyerChoice: BuyerChoice;
  buyerNote: string | null;
  decidedAt: string | null;
  visitOrder: number | null;
  agentNote: string | null;
};

// ---------------------------------------------------------------
// 買方連結的 token
// ---------------------------------------------------------------

/**
 * 32 個字元、每字元 5 bits，共 160 bits 亂度 —— 猜不到。
 *
 * 字集刻意拿掉 l、o、0、1，因為這個連結有機會被你用唸的或截圖傳給買方，
 * 少一組容易看錯的字元就少一次「連結打不開」的來電。
 */
const TOKEN_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // 剛好 32 個字元
const TOKEN_LENGTH = 32;

/** 買方連結預設的有效天數。過期後連結自動失效，不必記得手動關。 */
export const TOUR_DEFAULT_DAYS = 30;

/**
 * 產生買方連結的 token。
 * 用 Web Crypto 的 getRandomValues（Node 20 與瀏覽器都是全域可用），
 * 這樣這支檔案不必 import node:crypto，才能同時給前後端使用。
 */
export function createTourToken() {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);

  let token = "";
  for (const byte of bytes) {
    // 字集長度是 2 的次方，用位元遮罩取值不會有取模偏差。
    token += TOKEN_ALPHABET[byte & 31];
  }
  return token;
}

/** 擋掉明顯不是我們發出去的 token，避免拿奇怪字串去查資料庫。 */
export function isValidTokenFormat(token: string) {
  return token.length === TOKEN_LENGTH && /^[a-z2-9]+$/.test(token);
}

export function defaultExpiry(days = TOUR_DEFAULT_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * 買方現在能不能打開這個連結。
 * 三種關閉的方式：你手動撤銷、你標記結束、時間到期。
 */
export function isTourOpen(tour: Pick<Tour, "status" | "expiresAt">) {
  if (tour.status !== "active") return false;
  const expiry = new Date(tour.expiresAt).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
}

/** 連結關閉的原因，直接顯示給買方看，不要丟 500 或空白頁。 */
export function tourClosedReason(tour: Pick<Tour, "status" | "expiresAt">) {
  if (tour.status === "revoked") return "這份看房清單已經收回了。";
  if (tour.status === "done") return "這次帶看已經結束了，謝謝你。";
  return "這份看房清單已經過期了。";
}

export function toTour(row: Record<string, unknown>): Tour {
  const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));
  const str = (value: unknown) => (value === null || value === undefined ? null : String(value));

  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    buyerName: str(row.buyer_name),
    token: String(row.token ?? ""),
    expiresAt: String(row.expires_at ?? ""),
    status: (row.status ?? "active") as TourStatus,
    originLabel: str(row.origin_label),
    originLat: num(row.origin_lat),
    originLng: num(row.origin_lng),
    note: str(row.note),
    submittedAt: str(row.submitted_at),
    createdAt: String(row.created_at ?? "")
  };
}

export function toTourItem(row: Record<string, unknown>): TourItem {
  const str = (value: unknown) => (value === null || value === undefined ? null : String(value));

  return {
    id: String(row.id),
    tourId: String(row.tour_id),
    listingId: String(row.listing_id),
    buyerChoice: (row.buyer_choice ?? "pending") as BuyerChoice,
    buyerNote: str(row.buyer_note),
    decidedAt: str(row.decided_at),
    visitOrder: row.visit_order === null || row.visit_order === undefined ? null : Number(row.visit_order),
    agentNote: str(row.agent_note)
  };
}

/** 帶看單的日期時間，統一用台北時區顯示。 */
export function formatTourDate(iso: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
