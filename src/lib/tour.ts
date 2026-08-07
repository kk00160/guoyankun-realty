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

/**
 * 一個候選帶看時段。
 *
 * 你開幾個時段，買方在自己的連結上勾方便的那幾個。
 *
 * id 是短亂數，不是陣列索引 —— 買方在手機上勾選的同時，
 * 你可能正在後台刪掉某個時段，用索引對回來會整個錯位，
 * 結果是買方以為自己選了週六下午，你看到的是週日早上。
 */
export type TourTimeSlot = {
  id: string;
  /** ISO 時間字串 */
  startsAt: string;
  /** 買方勾了沒 */
  picked: boolean;
  /**
   * 這個時段是誰提的。
   *
   * agent：阿坤開的候選時段
   * buyer：買方自己加的（阿坤開的都不方便的時候）
   *
   * 要分開是因為兩者的意義完全不同：阿坤開的代表「我這時候有空」，
   * 買方加的代表「我只有這時候有空，你要想辦法」。混在一起看不出誰要遷就誰。
   */
  by: "agent" | "buyer";
};

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
  /** 候選帶看時段。永遠依時間排好序。 */
  timeSlots: TourTimeSlot[];
  createdAt: string;
};

/** 時段 id。夠短好讀，夠亂不會撞到。 */
export function createSlotId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 買方看得懂的時段寫法：8/10（六）14:00 */
export function formatSlot(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")}/${get("day")}（${get("weekday").replace("週", "")}）${get("hour")}:${get("minute")}`;
}

/** 資料庫裡的 jsonb 一律當成不可信，逐筆檢查後才放行。 */
export function toTimeSlots(raw: unknown): TourTimeSlot[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const bag = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const startsAt = typeof bag.startsAt === "string" ? bag.startsAt : "";
      if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) return null;
      return {
        id: typeof bag.id === "string" && bag.id ? bag.id : createSlotId(),
        startsAt,
        picked: bag.picked === true,
        // 舊資料沒有這個欄位，一律當成阿坤開的。
        by: bag.by === "buyer" ? ("buyer" as const) : ("agent" as const)
      };
    })
    .filter((slot): slot is TourTimeSlot => slot !== null)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

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
    timeSlots: toTimeSlots(row.time_slots),
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
