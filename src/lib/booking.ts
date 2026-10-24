/**
 * 線上預約的規則與時段計算。
 *
 * 這支沒有任何 I/O，client component 可以直接 import。
 */

export const BOOKING_RULES = {
  startHour: 10,
  endHour: 20,
  /**
   * 時段格線，15 分鐘。
   *
   * 為什麼不是 30 或 60：電話諮詢通常十幾分鐘就講完，
   * 用 60 分鐘一格會讓一個下午只排得下四個人。
   * 改成 15 分鐘的格線後，再由見面方式決定實際佔用多久（見 MEET_TYPES）。
   */
  slotMinutes: 15,
  workDays: [1, 2, 3, 4, 5, 6],
  /** 最少要提前幾小時才能預約，免得客戶約十分鐘後。 */
  leadHours: 2,
  daysAhead: 14
} as const;

export const INTENTS = [
  { key: "buy", label: "買房", hint: "預算、區域、房型" },
  { key: "sell", label: "賣房", hint: "屋況、售價、時間" },
  { key: "asset", label: "資產配置", hint: "置產規劃、投報評估" },
  { key: "tax", label: "稅務諮詢", hint: "房地合一、贈與、繼承" },
  { key: "renovate", label: "簡易裝潢", hint: "預算、屋況、空間規劃" },
  { key: "other", label: "其他", hint: "簡單描述需求" }
] as const;

export const URGENCIES = [
  { key: "asap", label: "這個月內" },
  { key: "soon", label: "1 至 3 個月" },
  { key: "explore", label: "先了解" }
] as const;

/**
 * 見面方式。durationMin 決定這種約會佔掉日曆多久。
 *
 * 長度不同是刻意的：電話講十幾分鐘就夠，現場面談抓一小時才不會趕。
 * 全部給同一個長度的話，不是電話約浪費時間，就是面談時間不夠。
 */
export const MEET_TYPES = [
  { key: "office", label: "現場帶看 · 面談", description: "台南市各區，地點另約", durationMin: 60 },
  { key: "phone", label: "電話聯繫", description: "由我主動致電", durationMin: 15 },
  { key: "video", label: "線上視訊", description: "Google Meet 或 LINE 視訊", durationMin: 30 }
] as const;

export const INTENT_KEYS = INTENTS.map((item) => item.key) as readonly string[];
export const URGENCY_KEYS = URGENCIES.map((item) => item.key) as readonly string[];
export const MEET_TYPE_KEYS = MEET_TYPES.map((item) => item.key) as readonly string[];

export function intentLabel(key: string) {
  return INTENTS.find((item) => item.key === key)?.label ?? key;
}

export function urgencyLabel(key: string | null) {
  return URGENCIES.find((item) => item.key === key)?.label ?? "未填";
}

export function meetTypeLabel(key: string) {
  return MEET_TYPES.find((item) => item.key === key)?.label ?? key;
}

/** 這種見面方式要佔多久。認不出來就給 30 分鐘。 */
export function meetDuration(key: string): number {
  return MEET_TYPES.find((item) => item.key === key)?.durationMin ?? 30;
}

const TAIPEI_OFFSET = 8 * 60 * 60 * 1000;

export function formatSlotTaipei(value: string | Date, durationMin = 30) {
  const source = value instanceof Date ? value : new Date(value);
  const local = new Date(source.getTime() + TAIPEI_OFFSET);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const pad = (n: number) => String(n).padStart(2, "0");
  const end = new Date(local.getTime() + durationMin * 60_000);

  return (
    `${local.getUTCFullYear()}/${pad(local.getUTCMonth() + 1)}/${pad(local.getUTCDate())}` +
    `（週${weekdays[local.getUTCDay()]}）` +
    `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}–${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`
  );
}

export type OpenSlot = { iso: string; label: string };
export type OpenDay = { date: string; label: string; slots: OpenSlot[] };

/** 一段已經有事的時間（epoch 毫秒）。日曆上的行程與已成立的預約都會轉成這個形狀。 */
export type BusyRange = { start: number; end: number };

function overlaps(start: number, end: number, busy: readonly BusyRange[]): boolean {
  return busy.some((range) => start < range.end && end > range.start);
}

/**
 * 算出接下來可以預約的時段。
 *
 * @param busy 已經有事的時間，包含已成立的預約與 Google 日曆上的行程。
 * @param durationMin 這次要約多久 —— 會影響哪些格子放得下。
 */
export function generateOpenSlots(
  now: Date,
  busy: readonly BusyRange[],
  durationMin = 30
): OpenDay[] {
  const result: OpenDay[] = [];
  const earliest = now.getTime() + BOOKING_RULES.leadHours * 60 * 60 * 1000;
  const taipeiNow = new Date(now.getTime() + TAIPEI_OFFSET);
  const year = taipeiNow.getUTCFullYear();
  const month = taipeiNow.getUTCMonth();
  const date = taipeiNow.getUTCDate();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const pad = (n: number) => String(n).padStart(2, "0");

  for (let offset = 0; offset <= BOOKING_RULES.daysAhead; offset += 1) {
    const localDay = new Date(Date.UTC(year, month, date + offset));
    const weekday = localDay.getUTCDay();
    if (!(BOOKING_RULES.workDays as readonly number[]).includes(weekday)) continue;

    const slots: OpenSlot[] = [];
    const startMin = BOOKING_RULES.startHour * 60;
    const endMin = BOOKING_RULES.endHour * 60;

    for (let minute = startMin; minute + durationMin <= endMin; minute += BOOKING_RULES.slotMinutes) {
      // 台北時間換回 UTC：減 8 小時。
      const startUtc = Date.UTC(
        localDay.getUTCFullYear(),
        localDay.getUTCMonth(),
        localDay.getUTCDate(),
        0,
        minute - 8 * 60
      );
      const endUtc = startUtc + durationMin * 60_000;

      if (startUtc < earliest) continue;
      if (overlaps(startUtc, endUtc, busy)) continue;

      const h = Math.floor(minute / 60);
      const m = minute % 60;
      const eh = Math.floor((minute + durationMin) / 60);
      const em = (minute + durationMin) % 60;
      slots.push({
        iso: new Date(startUtc).toISOString(),
        label: `${pad(h)}:${pad(m)}–${pad(eh)}:${pad(em)}`
      });
    }

    if (slots.length) {
      result.push({
        date: `${localDay.getUTCFullYear()}-${pad(localDay.getUTCMonth() + 1)}-${pad(localDay.getUTCDate())}`,
        label: `${localDay.getUTCMonth() + 1}/${localDay.getUTCDate()} 週${weekdays[weekday]}`,
        slots
      });
    }
  }

  return result;
}

/**
 * 這個時段本身合不合法（沒有檢查有沒有被訂走，那是資料庫的事）。
 * 前端可能被繞過，所以送出時一定要再驗一次。
 */
export function isValidSlot(slotIso: string, durationMin = 30): boolean {
  const slot = new Date(slotIso);
  if (Number.isNaN(slot.getTime())) return false;
  if (slot.getTime() < Date.now() + BOOKING_RULES.leadHours * 60 * 60 * 1000) return false;
  if (slot.getTime() > Date.now() + (BOOKING_RULES.daysAhead + 1) * 86_400_000) return false;
  if (slot.getUTCSeconds() !== 0 || slot.getUTCMilliseconds() !== 0) return false;
  // 必須落在 15 分鐘的格線上。
  if (slot.getUTCMinutes() % BOOKING_RULES.slotMinutes !== 0) return false;

  const taipei = new Date(slot.getTime() + TAIPEI_OFFSET);
  const minute = taipei.getUTCHours() * 60 + taipei.getUTCMinutes();
  const weekday = taipei.getUTCDay();

  return (
    minute >= BOOKING_RULES.startHour * 60 &&
    minute + durationMin <= BOOKING_RULES.endHour * 60 &&
    (BOOKING_RULES.workDays as readonly number[]).includes(weekday)
  );
}
