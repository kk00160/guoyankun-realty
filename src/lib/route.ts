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

function coord(point: RoutePoint) {
  return `${point.lat},${point.lng}`;
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
      origin: coord(segment[0]),
      destination: coord(segment[segment.length - 1]),
      travelmode: "driving"
    });

    const waypoints = segment.slice(1, -1);
    if (waypoints.length > 0) {
      params.set("waypoints", waypoints.map(coord).join("|"));
    }

    urls.push(`https://www.google.com/maps/dir/?${params.toString()}`);
  }

  return urls;
}

/** 單一物件的地圖連結，買方頁上「看地圖」用。 */
export function googleMapsPlaceUrl(point: { lat: number; lng: number }) {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
}
