import "server-only";
import { CONFIG_KEYS, getConfig, getConfigMany, setConfig } from "@/lib/appointment-config";
import { SITE_URL } from "@/lib/site-config";

/**
 * Google 日曆整合。
 *
 * 移植自老師的 card-booking 專案（chrishsieh0903/card-booking），
 * 原版把 refresh token 存在 Prisma/MySQL，這裡改成我們的 Supabase，
 * 其餘直接呼叫 Google REST API 的部分幾乎原樣保留。
 *
 * 做的事：
 * 一次性授權拿 refresh token → 查日曆上已排的行程（擋掉已經有事的時段）
 * → 預約成立時建立日曆事件 → 改期／取消時同步更新。
 *
 * 🛡️ 兩種查詢刻意分開，因為「查不到」在不同情境下的正確反應相反：
 *   getBusyRanges       給前台看空檔用。查不到就回空陣列，客戶照樣看得到時段。
 *   getBusyRangesStrict 給最後寫入前用。查不到就丟例外擋下預約，
 *                       寧可請客戶重試，也不要在你已經有事的時間答應人。
 *
 * 啟用前提（一次性）：
 *   1. Google Cloud Console 的 OAuth client 要加上 redirect URI：
 *      {網站網址}/api/appointment/google/callback
 *   2. 到後台按「綁定 Google 日曆」→ 授權同意
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CAL_API = "https://www.googleapis.com/calendar/v3";

const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "";

export const GOOGLE_REDIRECT_URI = `${SITE_URL}/api/appointment/google/callback`;

const SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly"
].join(" ");

/** 日曆事件預設長相。標題裡的 {name} {service} 會被換掉。 */
export const DEFAULT_CALENDAR_TITLE = "【預約】{name}／{service}";
/** Google 日曆的顏色代號，7 是孔雀藍。 */
export const DEFAULT_CALENDAR_COLOR = "7";

/** 有沒有填 OAuth 設定。沒填代表整個日曆功能停用。 */
export function isGoogleConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

/** 有沒有真的完成授權。 */
export async function isGoogleBound(): Promise<boolean> {
  if (!isGoogleConfigured()) return false;
  return Boolean(await getConfig(CONFIG_KEYS.googleRefreshToken));
}

async function getCalendarId(): Promise<string> {
  return (await getConfig(CONFIG_KEYS.googleCalendarId)) || "primary";
}

/** 日曆事件的標題樣板與顏色。沒設定就用預設。 */
export async function getCalendarDisplaySettings(): Promise<{ titleTemplate: string; colorId: string }> {
  const cfg = await getConfigMany([CONFIG_KEYS.calendarTitleTemplate, CONFIG_KEYS.calendarColorId]);
  const tpl = cfg.get(CONFIG_KEYS.calendarTitleTemplate)?.trim();
  const color = cfg.get(CONFIG_KEYS.calendarColorId)?.trim();
  return {
    titleTemplate: tpl && tpl.length > 0 ? tpl.slice(0, 120) : DEFAULT_CALENDAR_TITLE,
    colorId: color && /^\d{1,2}$/.test(color) ? color : DEFAULT_CALENDAR_COLOR
  };
}

// ---------- OAuth ----------

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // 強制每次都給 refresh token，否則第二次授權會拿不到
    state
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** 用授權碼換 refresh token 並存起來。 */
export async function exchangeCodeForToken(code: string): Promise<boolean> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code"
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!res.ok) {
      console.error("[google-cal] 授權碼換 token 失敗:", (await res.text()).slice(0, 200));
      return false;
    }
    const data = await res.json();
    if (!data.refresh_token) {
      console.error("[google-cal] 回應沒有 refresh_token（可能少了 prompt=consent）");
      return false;
    }
    await setConfig(CONFIG_KEYS.googleRefreshToken, data.refresh_token);
    return true;
  } catch (e) {
    console.error("[google-cal] exchangeCodeForToken 例外:", e);
    return false;
  }
}

export async function disconnectGoogle(): Promise<void> {
  await setConfig(CONFIG_KEYS.googleRefreshToken, null);
  accessTokenCache = null;
}

// ---------- access token ----------

let accessTokenCache: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (accessTokenCache && accessTokenCache.exp > Date.now() + 60_000) return accessTokenCache.token;
  if (!isGoogleConfigured()) return null;

  const refresh = await getConfig(CONFIG_KEYS.googleRefreshToken);
  if (!refresh) return null;

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refresh,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "refresh_token"
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) {
      console.error("[google-cal] 換 access token 失敗:", (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    if (!data.access_token) return null;
    accessTokenCache = {
      token: data.access_token,
      exp: Date.now() + (Number(data.expires_in) || 3600) * 1000
    };
    return data.access_token;
  } catch (e) {
    console.error("[google-cal] getAccessToken 例外:", e);
    return null;
  }
}

// ---------- 查已排行程 ----------

/** 日曆上已經有事的一段時間（epoch 毫秒）。 */
export type BusyRange = { start: number; end: number; eventId?: string };

export class GoogleCalendarUnavailableError extends Error {
  constructor(readonly reason: "not_bound" | "token_unavailable" | "api_unavailable") {
    super(`google_calendar_${reason}`);
    this.name = "GoogleCalendarUnavailableError";
  }
}

type CalendarEvent = {
  id?: string;
  status?: string;
  transparency?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

function eventToBusyRange(event: CalendarEvent): BusyRange | null {
  if (event.status === "cancelled") return null;
  // 標成「有空」的事件不擋預約。
  if (event.transparency === "transparent") return null;
  // 整天事件（只有 date 沒有 dateTime）多半是提醒或生日，不該擋掉一整天的時段。
  if (!event.start?.dateTime || !event.end?.dateTime) return null;

  const start = new Date(event.start.dateTime).getTime();
  const end = new Date(event.end.dateTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end, eventId: event.id };
}

async function fetchBusyRanges(
  token: string,
  fromIso: string,
  toIso: string,
  excludeEventId?: string | null
): Promise<BusyRange[]> {
  const calId = await getCalendarId();
  const url = new URL(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events`);
  url.searchParams.set("timeMin", fromIso);
  url.searchParams.set("timeMax", toIso);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("showDeleted", "false");
  url.searchParams.set("maxResults", "2500");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
    cache: "no-store"
  });
  if (!res.ok) {
    console.error("[google-cal] 查詢事件失敗:", (await res.text()).slice(0, 200));
    throw new GoogleCalendarUnavailableError("api_unavailable");
  }
  const data = (await res.json()) as { items?: CalendarEvent[] };
  return (data.items || [])
    .filter((event) => !excludeEventId || event.id !== excludeEventId)
    .map(eventToBusyRange)
    .filter((range): range is BusyRange => Boolean(range));
}

/**
 * 給前台顯示空檔用的寬鬆查詢。
 * 查不到就回空陣列 —— 客戶照樣看得到時段，只是可能撞到你已排的行程。
 * 最後送出時還會再用 strict 版檢查一次，所以這裡放寬是安全的。
 */
export async function getBusyRanges(fromIso: string, toIso: string): Promise<BusyRange[]> {
  const token = await getAccessToken();
  if (!token) return [];
  try {
    return await fetchBusyRanges(token, fromIso, toIso);
  } catch (e) {
    console.error("[google-cal] getBusyRanges 例外:", e);
    return [];
  }
}

/**
 * 給「真的要寫入預約」之前用的嚴格查詢。
 *
 * 完全沒設定 OAuth = 這個功能沒啟用，回空陣列不擋。
 * 但只要設定了，卻查不到（沒授權、API 掛了、逾時），一律丟例外擋下預約。
 * 理由：這時候「不知道你有沒有空」，硬寫下去的代價是你同時答應兩個人。
 */
export async function getBusyRangesStrict(
  fromIso: string,
  toIso: string,
  options?: { excludeEventId?: string | null }
): Promise<BusyRange[]> {
  if (!isGoogleConfigured()) return [];

  const refresh = await getConfig(CONFIG_KEYS.googleRefreshToken);
  if (!refresh) throw new GoogleCalendarUnavailableError("not_bound");

  const token = await getAccessToken();
  if (!token) throw new GoogleCalendarUnavailableError("token_unavailable");

  return fetchBusyRanges(token, fromIso, toIso, options?.excludeEventId);
}

/**
 * 列出某段期間日曆上還存在的事件 id。
 *
 * 用途：後台比對「資料庫說預約還在，但你已經在 Google 上手動刪掉那個事件」。
 *
 * ⚠️ 回傳 null 代表「問不到」，不是「一個都沒有」。
 *    呼叫端必須分清楚，當成空集合會把所有預約都誤判成孤兒、整片標紅。
 */
export async function listCalendarEventIds(fromIso: string, toIso: string): Promise<Set<string> | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const calId = await getCalendarId();
    const ids = new Set<string>();
    let pageToken: string | undefined;

    // 一定要跟著翻頁，否則第二頁以後的事件會被誤判成孤兒。
    do {
      const url = new URL(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events`);
      url.searchParams.set("timeMin", fromIso);
      url.searchParams.set("timeMax", toIso);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("showDeleted", "false");
      url.searchParams.set("maxResults", "2500");
      url.searchParams.set("fields", "nextPageToken,items(id)");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
        cache: "no-store"
      });
      if (!res.ok) throw new Error(`events list ${res.status}`);

      const data = (await res.json()) as {
        items?: Array<{ id?: string | null }>;
        nextPageToken?: string | null;
      };
      for (const item of data.items ?? []) {
        if (item.id) ids.add(item.id);
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);

    return ids;
  } catch (e) {
    console.error("[google-cal] listCalendarEventIds 例外:", e);
    return null;
  }
}

// ---------- 建立／更新／刪除事件 ----------

export async function createCalendarEvent(opts: {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  withMeet: boolean;
  location?: string | null;
}): Promise<{ eventId: string; meetUrl: string | null } | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const calId = await getCalendarId();
    const display = await getCalendarDisplaySettings();

    const body: Record<string, unknown> = {
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: opts.startIso, timeZone: "Asia/Taipei" },
      end: { dateTime: opts.endIso, timeZone: "Asia/Taipei" },
      colorId: display.colorId
    };
    if (opts.location) body.location = opts.location;
    if (opts.withMeet) {
      body.conferenceData = {
        createRequest: {
          requestId: `appt-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" }
        }
      };
    }

    const res = await fetch(
      `${CAL_API}/calendars/${encodeURIComponent(calId)}/events?conferenceDataVersion=1`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000)
      }
    );
    if (!res.ok) {
      console.error("[google-cal] 建立事件失敗:", (await res.text()).slice(0, 200));
      return null;
    }

    const data = await res.json();
    const meetUrl =
      data?.hangoutLink ||
      (data?.conferenceData?.entryPoints || []).find(
        (e: { entryPointType?: string; uri?: string }) => e.entryPointType === "video"
      )?.uri ||
      null;
    return { eventId: data.id, meetUrl };
  } catch (e) {
    console.error("[google-cal] createCalendarEvent 例外:", e);
    return null;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token || !eventId) return;
  try {
    const calId = await getCalendarId();
    await fetch(
      `${CAL_API}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000)
      }
    );
  } catch (e) {
    console.error("[google-cal] deleteCalendarEvent 例外:", e);
  }
}

export async function updateCalendarEventTime(
  eventId: string,
  startIso: string,
  endIso: string
): Promise<void> {
  const token = await getAccessToken();
  if (!token || !eventId) return;
  try {
    const calId = await getCalendarId();
    await fetch(
      `${CAL_API}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          start: { dateTime: startIso, timeZone: "Asia/Taipei" },
          end: { dateTime: endIso, timeZone: "Asia/Taipei" }
        }),
        signal: AbortSignal.timeout(8000)
      }
    );
  } catch (e) {
    console.error("[google-cal] updateCalendarEventTime 例外:", e);
  }
}
