/**
 * 看房路線：排順序 + 產生 Google Maps 導航連結。
 *
 * 刻意不用 Google Directions API：那要 API key、要綁信用卡、要管配額，
 * 而一趟帶看只有 5 到 10 個點，用直線距離排順序在市區已經夠準。
 * 真正的導航交給 Google Maps App 自己算，我們只負責把順序排好、把連結生出來。
 *
 * 純函式、無 I/O，client component 可以直接 import。
 */

export type RoutePoint = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  /**
   * 導航時要交給 Google Maps 的地點名稱（社區名或地址），見 mapTarget()。
   *
   * 排順序一律用 lat/lng 算，不用這個 —— 那是數字，不會被文字比對搞錯。
   * 但真的要開車過去時用名稱比較準：大樓的座標常常落在屋頂或社區中心，
   * 而 Google Maps 認得建案名稱，會把你帶到真正的大門口。
   * 沒給就退回用座標。
   */
  query?: string;
};

/** 市區平均車速（km/h），用來把距離換算成「大概要開多久」。 */
const CITY_SPEED_KMH = 25;

/**
 * 繞路係數。直線距離乘上這個數字才接近實際里程。
 * 台南市區路網方正，1.35 是偏保守的估法（寧可估多不要估少，帶看遲到很傷）。
 */
const DETOUR_FACTOR = 1.35;

/** Google Maps 連結的中繼點上限。超過就要拆成多段。 */
const MAX_WAYPOINTS = 9;

const EARTH_RADIUS_KM = 6371;

/** 兩點直線距離（公里）。 */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pathCost(points: RoutePoint[]) {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += haversineKm(points[i], points[i + 1]);
  }
  return total;
}

/** 從起點出發，每次都跳到最近的下一個點。快，但常會留下交叉的路線。 */
function nearestNeighbour(start: RoutePoint, rest: RoutePoint[]) {
  const remaining = [...rest];
  const ordered: RoutePoint[] = [];
  let current = start;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    remaining.forEach((point, index) => {
      const distance = haversineKm(current, point);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    [current] = remaining.splice(bestIndex, 1);
    ordered.push(current);
  }

  return ordered;
}

/**
 * 2-opt：反覆把路線中交叉的兩段對調，直到沒有更好的組合。
 * 這一步就是在把最近鄰居法留下的「折返跑」拉直。
 * 點數只有個位數，暴力跑到收斂完全沒有效能問題。
 */
function twoOpt(start: RoutePoint, tour: RoutePoint[]) {
  let best = [start, ...tour];
  let bestCost = pathCost(best);
  let improved = true;
  let passes = 0;

  // passes 上限是保險，正常情況下三、四輪就收斂了。
  while (improved && passes < 50) {
    improved = false;
    passes += 1;

    for (let i = 1; i < best.length - 1; i += 1) {
      for (let j = i + 1; j < best.length; j += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1)
        ];
        const cost = pathCost(candidate);
        if (cost < bestCost - 1e-9) {
          best = candidate;
          bestCost = cost;
          improved = true;
        }
      }
    }
  }

  return best.slice(1);
}

/**
 * 把物件排成一條合理的看房路線。
 *
 * @param points 要看的物件（必須都有經緯度）
 * @param origin 出發點。沒給就用清單裡的第一間當起點。
 */
export function orderRoute(points: RoutePoint[], origin?: RoutePoint): RoutePoint[] {
  if (points.length <= 1) return [...points];

  // 有出發點：出發點是固定的起點，全部物件都要排進去。
  if (origin) return twoOpt(origin, nearestNeighbour(origin, points));

  // 沒出發點：第一間房子當起點。
  // 注意 twoOpt 會把固定起點從結果裡拿掉（因為有出發點時起點不是物件），
  // 所以這裡要把它補回去，否則會少排一間。
  const [head, ...tail] = points;
  return [head, ...twoOpt(head, nearestNeighbour(head, tail))];
}

export type RouteLeg = {
  from: string;
  to: string;
  km: number;
  minutes: number;
};

/** 每一段的距離與預估車程，用在帶看單上。 */
export function routeLegs(ordered: RoutePoint[], origin?: RoutePoint): RouteLeg[] {
  const stops = origin ? [origin, ...ordered] : ordered;
  const legs: RouteLeg[] = [];

  for (let i = 0; i < stops.length - 1; i += 1) {
    const km = haversineKm(stops[i], stops[i + 1]) * DETOUR_FACTOR;
    legs.push({
      from: stops[i].label,
      to: stops[i + 1].label,
      km,
      minutes: Math.max(3, Math.round((km / CITY_SPEED_KMH) * 60))
    });
  }

  return legs;
}

/** 全程概估。標示成「概估」是刻意的，這是直線距離推算，不是導航實測。 */
export function routeSummary(ordered: RoutePoint[], origin?: RoutePoint) {
  const legs = routeLegs(ordered, origin);
  return {
    stops: ordered.length,
    km: legs.reduce((sum, leg) => sum + leg.km, 0),
    minutes: legs.reduce((sum, leg) => sum + leg.minutes, 0)
  };
}

/**
 * 一個停靠點在導航連結裡怎麼寫。
 * 有地點名稱就用名稱（比較準，見 RoutePoint.query），沒有才退回座標。
 * `|` 是 waypoints 的分隔字元，出現在名稱裡會把整串切壞，先清掉。
 */
function navTarget(point: RoutePoint) {
  const query = point.query?.replace(/\|/g, " ").trim();
  return query || `${point.lat},${point.lng}`;
}

/**
 * 產生 Google Maps 導航連結。
 *
 * 用的是官方的 Maps URLs 格式：免費、免 API key、手機點開直接進 Google Maps App。
 * 限制是一條連結最多 9 個中繼點，所以停靠點超過 11 個就自動拆成多段，
 * 前一段的終點會成為下一段的起點，接得起來。
 *
 * @returns 一或多條連結。一趟帶看通常只會有一條。
 */
export function googleMapsUrls(ordered: RoutePoint[], origin?: RoutePoint): string[] {
  const stops = origin ? [origin, ...ordered] : ordered;
  if (stops.length < 2) return [];

  // 每段最多 = 起點 + 9 個中繼點 + 終點 = 11 個停靠點。
  const perSegment = MAX_WAYPOINTS + 2;
  const urls: string[] = [];

  for (let start = 0; start < stops.length - 1; start += perSegment - 1) {
    const segment = stops.slice(start, start + perSegment);
    if (segment.length < 2) break;

    const params = new URLSearchParams({
      api: "1",
      origin: navTarget(segment[0]),
      destination: navTarget(segment[segment.length - 1]),
      travelmode: "driving"
    });

    const waypoints = segment.slice(1, -1);
    if (waypoints.length > 0) {
      params.set("waypoints", waypoints.map(navTarget).join("|"));
    }

    urls.push(`https://www.google.com/maps/dir/?${params.toString()}`);
  }

  return urls;
}

/** 純座標的地圖連結。只在「想自己核對那個點到底落在哪」的時候用，見 mapTarget()。 */
export function googleMapsPlaceUrl(point: { lat: number; lng: number }) {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
}

// ---------------------------------------------------------------
// 導航目標：用「地方的名字」導航，不是只丟一個座標點
// ---------------------------------------------------------------

/**
 * 為什麼不直接用經緯度導航：
 *
 * 一、資料裡幾乎沒有座標。實測 1,000 筆台南案源：有地址的 100%、
 *     有社區名的 72%（電梯大樓 98%），有經緯度的只有 1.3%。
 *     座標要一筆一筆開明細頁才拿得到，全部補完是十幾個小時的事。
 *     只認座標，等於九成九的物件根本按不出導航。
 *
 * 二、就算有座標也不見得比較好。大樓的座標常落在屋頂或社區中心，
 *     而 Google Maps 認得「白金漢宮」這種建案名稱，會帶你到真正的大門口。
 *
 * 所以優先序是：社區名 → 地址 → 座標。
 *
 * ⚠️ 每個查詢字串都硬性加上「台南市＋行政區」前綴，這是防呆不是裝飾：
 * 純文字搜尋最可怕的失敗不是搜不到，是安靜地搜到別的縣市的同名建案。
 * 加了前綴之後，最差的結果是落在正確的行政區裡，不會把人載到彰化。
 */
export type MapTargetKind = "community" | "address" | "coords";

export type MapTarget = {
  kind: MapTargetKind;
  /** 丟給 Google Maps 的字串：社區名／地址，或 "lat,lng" */
  query: string;
  /** 給人看的一句話，讓你知道這條連結會把你帶到多精準的地方 */
  hint: string;
};

/** mapTarget() 需要的欄位。刻意不收整個 Listing，這支才能被匯入腳本共用。 */
export type Locatable = {
  district: string | null;
  address: string | null;
  communityName: string | null;
  lat: number | null;
  lng: number | null;
};

const CITY = "台南市";

/** 補上「台南市＋行政區」前綴，但不製造「台南市台南市東區東區」這種疊字。 */
function localise(district: string | null, text: string) {
  if (text.includes(CITY)) return text;
  const area = district && !text.includes(district) ? district : "";
  return `${CITY}${area}${text}`;
}

/** 這筆物件要怎麼導航。全部資訊都缺才會回 null。 */
export function mapTarget(listing: Locatable): MapTarget | null {
  const community = listing.communityName?.trim();
  const address = listing.address?.trim();

  // 一、有社區名（多半是電梯大樓、華廈）：Google Maps 認得建案，直接帶到大門口。
  //
  //     提示裡一定要把地址一起帶出來。實測「台南市善化區宇成植村NY」，
  //     Google 會回兩筆同名建案（陽光大道591號 / 目加溜灣大道535號），
  //     它自己挑了對的那筆，但這是排序結果，不是保證。
  //     所以按鈕旁邊永遠寫著該有的路名 —— 導航開起來對不上，你當場就看得出來。
  if (community) {
    return {
      kind: "community",
      query: localise(listing.district, community),
      hint: address ? `導航到「${community}」，地址應該在${address}` : `導航到「${community}」`
    };
  }

  // 二、沒社區名（多半是透天、公寓）：用地址。
  //     來源的地址通常只到路或巷、沒有門牌 —— 那正好就是「附近」，
  //     導到巷口再自己認門牌，本來就是帶看的實際做法，不用假裝更精準。
  if (address) {
    return {
      kind: "address",
      query: localise(listing.district, address),
      hint: `導航到${address}附近（無門牌，到巷口再認）`
    };
  }

  // 三、名字跟地址都沒有，才輪到座標。
  if (listing.lat !== null && listing.lng !== null) {
    return {
      kind: "coords",
      query: `${listing.lat},${listing.lng}`,
      hint: "只有座標，導航點可能落在屋頂或路中間"
    };
  }

  return null;
}

/** 單一目標的 Google Maps 連結（搜尋模式，手機點開直接進 App）。 */
export function mapPlaceUrl(target: MapTarget) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target.query)}`;
}

/** 單一目標的「直接開始導航」連結。帶看當下最常按的就是這顆。 */
export function mapDirectionsUrl(target: MapTarget) {
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(target.query)}`;
}
