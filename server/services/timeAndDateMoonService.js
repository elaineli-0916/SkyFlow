import crypto from "node:crypto";

const TIMEANDDATE_BASE_URL = "https://www.timeanddate.com";
const TIMEANDDATE_ASTRO_API_URL = "https://api.xmltime.com/astronomy";
const CACHE_TTL_MS = 1000 * 60 * 60 * 8;
const MIN_FETCH_INTERVAL_MS = 1000 * 45;

const cache = new Map();
let lastFetchAt = 0;

const KNOWN_MOON_PATHS = [
  { city: "beijing", country: "china", path: "/moon/china/beijing", latitude: 39.9042, longitude: 116.4074 },
  { city: "shanghai", country: "china", path: "/moon/china/shanghai", latitude: 31.2304, longitude: 121.4737 },
  { city: "guangzhou", country: "china", path: "/moon/china/guangzhou", latitude: 23.1291, longitude: 113.2644 },
  { city: "shenzhen", country: "china", path: "/moon/china/shenzhen", latitude: 22.5431, longitude: 114.0579 },
  { city: "hangzhou", country: "china", path: "/moon/china/hangzhou", latitude: 30.2741, longitude: 120.1551 },
  { city: "new york", country: "united states", path: "/moon/usa/new-york", latitude: 40.7128, longitude: -74.006 },
  { city: "college park", country: "united states", path: "/moon/usa/college-park-md", latitude: 38.9897, longitude: -76.9378 },
  { city: "los angeles", country: "united states", path: "/moon/usa/los-angeles", latitude: 34.0522, longitude: -118.2437 },
  { city: "provideniya", country: "russia", path: "/moon/russia/provideniya", latitude: 64.3833, longitude: -173.3 }
];

export async function getTimeAndDateMoonData(location) {
  const target = resolveMoonTarget(location);
  const hasCoordinates = Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude);
  if (!target && !hasCoordinates) {
    return {
      ok: false,
      source: "timeanddate-unresolved",
      reason: "Could not resolve a Timeanddate moon URL or coordinate place id for this location."
    };
  }

  const date = normalizeDate(location?.date);
  const cacheKey = `${target?.path ?? `coords:${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`}:${date}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { ...cached.data, cached: true };
  }

  const apiError = await fetchAstroApiMoon(location, target, date)
    .then((parsed) => {
      cache.set(cacheKey, {
        cachedAt: Date.now(),
        data: parsed
      });
      return null;
    })
    .catch((error) => error);

  if (!apiError) {
    return { ...cache.get(cacheKey).data };
  }

  if (!target?.path) {
    return {
      ok: false,
      source: "timeanddate-api-unavailable",
      reason: apiError.message,
      location: buildLocationMeta(location, target)
    };
  }

  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < MIN_FETCH_INTERVAL_MS) {
    return {
      ok: false,
      source: "timeanddate-rate-limited",
      reason: "Skipping Timeanddate page fetch to avoid rapid repeated requests.",
      retryAfterMs: MIN_FETCH_INTERVAL_MS - elapsed,
      apiReason: apiError.message
    };
  }

  lastFetchAt = Date.now();
  const url = `${TIMEANDDATE_BASE_URL}${target.path}`;
  let html;
  try {
    html = await fetchMoonPage(url);
  } catch (error) {
    return {
      ok: false,
      source: /challenge/i.test(error.message) ? "timeanddate-blocked" : "timeanddate-unavailable",
      reason: error.message,
      apiReason: apiError.message,
      location: {
        ...buildLocationMeta(location, target),
        url
      }
    };
  }

  const parsed = parseMoonPage(html, target);

  cache.set(cacheKey, {
    cachedAt: Date.now(),
    data: parsed
  });

  return parsed;
}

async function fetchAstroApiMoon(location, target, date) {
  const accessKey = process.env.TIMEANDDATE_ASTRO_ACCESS_KEY;
  const secretKey = process.env.TIMEANDDATE_ASTRO_SECRET_KEY;
  if (!accessKey || !secretKey) {
    throw new Error("Timeanddate Astronomy API credentials are missing.");
  }

  if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) {
    throw new Error("Timeanddate Astronomy API requires latitude and longitude.");
  }

  const url = new URL(process.env.TIMEANDDATE_ASTRO_API_URL || TIMEANDDATE_ASTRO_API_URL);
  url.searchParams.set("version", "3");
  url.searchParams.set("accesskey", accessKey);
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("signature", createTimeAndDateSignature(accessKey, secretKey, "astronomy", timestamp));
  url.searchParams.set("placeid", formatAstroPlaceId(location, target));
  url.searchParams.set("object", "moon");
  url.searchParams.set("types", "setrise,meridian,phase,current");
  url.searchParams.set("startdt", date);
  url.searchParams.set("isotime", "1");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(8000)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Timeanddate Astronomy API request failed with ${response.status}`);
  }
  if (payload?.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message || error).join("; "));
  }
  if (payload?.warnings?.length && !payload?.locations?.length) {
    throw new Error(payload.warnings.join("; "));
  }

  return parseAstroApiResponse(payload, location, target, date);
}

function createTimeAndDateSignature(accessKey, secretKey, serviceName, timestamp) {
  return crypto
    .createHmac("sha1", secretKey)
    .update(`${accessKey}${serviceName}${timestamp}`)
    .digest("base64");
}

function parseAstroApiResponse(payload, location, target, date) {
  const resultLocation = payload?.locations?.[0];
  const moon = resultLocation?.astronomy?.objects?.find((item) => normalizeToken(item.name) === "moon");
  const day = moon?.days?.find((item) => item.date === date) ?? moon?.days?.[0];
  if (!moon || !day) {
    throw new Error("Timeanddate Astronomy API returned no moon data for this date.");
  }

  const events = day.events ?? [];
  const rise = events.find((event) => event.type === "rise");
  const set = events.find((event) => event.type === "set");
  const meridian = events.find((event) => event.type === "meridian");

  return {
    ok: true,
    source: "timeanddate-api",
    location: buildLocationMeta(location, target, resultLocation),
    current: {
      directionDegrees: numberOrNull(moon.current?.azimuth),
      directionLabel: null,
      altitudeDegrees: numberOrNull(moon.current?.altitude)
    },
    today: {
      moonrise: formatApiEvent(rise),
      moonset: formatApiEvent(set),
      meridian: formatApiTime(meridian),
      meridianAltitude: numberOrNull(meridian?.altitude),
      moonphase: day.moonphase ?? null
    },
    fetchedAt: new Date().toISOString()
  };
}

function resolveMoonTarget({ locationName, country, latitude, longitude } = {}) {
  const cityKey = normalizeToken(locationName);
  const countryKey = normalizeToken(country);

  const exact = KNOWN_MOON_PATHS.find((item) => {
    if (countryKey && item.country !== countryKey) return false;
    return cityKey && (cityKey === item.city || cityKey.includes(item.city) || item.city.includes(cityKey));
  });

  if (exact) return exact;

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    const nearest = KNOWN_MOON_PATHS
      .map((item) => ({ ...item, distance: haversine(latitude, longitude, item.latitude, item.longitude) }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearest && nearest.distance < 90) return nearest;
  }

  const countrySlug = countryToPath(countryKey);
  const citySlug = slugify(locationName);
  if (countrySlug && citySlug && !["your-orbit", "local-orbit", "fallback-orbit"].includes(citySlug)) {
    return {
      city: cityKey,
      country: countryKey,
      path: `/moon/${countrySlug}/${citySlug}`,
      latitude,
      longitude
    };
  }

  return null;
}

async function fetchMoonPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "SkyFlowEarthCompanion/0.1 (+local demo; low frequency moon telemetry)",
      Accept: "text/html,application/xhtml+xml"
    },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`Timeanddate moon request failed with ${response.status}`);
  }

  const html = await response.text();
  if (isChallengePage(html)) {
    throw new Error("Timeanddate returned an anti-bot challenge page; using local moon estimates instead.");
  }

  return html;
}

function parseMoonPage(html, target) {
  const text = htmlToText(html);
  const today = new Date();
  const calendar = extractCalendarRow(html, today.getDate());
  const direction = extractDirection(text);
  const altitude = extractNumberAfter(text, "Moon Altitude:");
  const nextMoonrise = extractValueAfter(text, "Next Moonrise:");

  return {
    ok: true,
    source: "timeanddate",
    location: {
      label: titleCase(target.city || ""),
      path: target.path,
      url: `${TIMEANDDATE_BASE_URL}${target.path}`
    },
    current: {
      directionDegrees: direction?.degrees ?? null,
      directionLabel: direction?.label ?? null,
      altitudeDegrees: altitude
    },
    today: {
      moonrise: calendar.moonrise ?? nextMoonrise ?? null,
      moonset: calendar.moonset ?? null,
      meridian: calendar.meridian ?? null,
      meridianAltitude: calendar.meridianAltitude ?? null
    },
    fetchedAt: new Date().toISOString()
  };
}

function formatApiEvent(event) {
  if (!event) return null;
  return {
    time: formatApiTime(event),
    azimuthDegrees: numberOrNull(event.azimuth)
  };
}

function formatApiTime(event) {
  if (!event) return null;
  if (event.isotime) {
    const date = new Date(event.isotime);
    if (!Number.isNaN(date.getTime())) return formatTimeParts(date.getHours(), date.getMinutes());
  }

  if (Number.isFinite(event.hour) && Number.isFinite(event.min)) {
    return formatTimeParts(event.hour, event.min);
  }

  return null;
}

function formatTimeParts(hour, minute) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatCoordinatePlaceId(latitude, longitude) {
  return `${formatSignedCoordinate(latitude)}${formatSignedCoordinate(longitude)}`;
}

function formatAstroPlaceId(location, target) {
  if (target?.path) return target.path.replace(/^\/moon\//, "");
  return formatCoordinatePlaceId(location.latitude, location.longitude);
}

function formatSignedCoordinate(value) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${Math.abs(value).toFixed(4)}`;
}

function buildLocationMeta(location = {}, target, resultLocation) {
  return {
    label: resultLocation?.geo?.name ?? titleCase(target?.city || location.locationName || "Local orbit"),
    path: target?.path ?? null,
    url: target?.path ? `${TIMEANDDATE_BASE_URL}${target.path}` : null
  };
}

function normalizeDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return value;
  return new Date().toISOString().slice(0, 10);
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function extractCalendarRow(html, dayOfMonth) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const row = rows.find((candidate) => {
    const firstCell = candidate.match(/<(?:th|td)[^>]*>\s*(?:<[^>]+>)*\s*(\d{1,2})\s*(?:<[^>]+>)*\s*<\/(?:th|td)>/i);
    return Number(firstCell?.[1]) === dayOfMonth;
  });

  if (!row) return {};

  const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => cleanCell(match[1]));
  const moonriseCandidates = [cells[0], cells[2]].map(parseEventCell).filter((value) => value?.time);
  const moonset = parseEventCell(cells[1]);
  const meridian = parseMeridianCell(cells[3]);

  return {
    moonrise: moonriseCandidates[0] ?? null,
    moonset: moonset?.time ? moonset : null,
    meridian: meridian?.time ?? null,
    meridianAltitude: meridian?.altitude ?? null
  };
}

function parseEventCell(value = "") {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized === "-") return null;
  const time = normalized.match(/\d{1,2}:\d{2}\s*[ap]m/i)?.[0] ?? null;
  const azimuth = normalized.match(/\((\d+(?:\.\d+)?)°\)/)?.[1];
  return {
    time,
    azimuthDegrees: azimuth == null ? null : Number(azimuth)
  };
}

function parseMeridianCell(value = "") {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || /does not pass/i.test(normalized)) return null;
  const time = normalized.match(/\d{1,2}:\d{2}\s*[ap]m/i)?.[0] ?? null;
  const altitude = normalized.match(/\(([-+]?\d+(?:\.\d+)?)°\)/)?.[1];
  return {
    time,
    altitude: altitude == null ? null : Number(altitude)
  };
}

function extractDirection(text) {
  const match = text.match(/Moon Direction:\s*↑?\s*(\d+(?:\.\d+)?)°\s*([A-Za-z\s-]+)/i);
  if (!match) return null;
  return {
    degrees: Number(match[1]),
    label: match[2].split(/Moon Altitude:|Moon Distance:/i)[0].trim()
  };
}

function extractNumberAfter(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}\\s*([-+]?\\d+(?:\\.\\d+)?)°?`, "i"));
  return match ? Number(match[1]) : null;
}

function extractValueAfter(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() ?? null;
}

function isChallengePage(html) {
  return /Just a moment/i.test(html) || /cdn-cgi\/challenge-platform/i.test(html);
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|tr|h\d|div|table|section)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&deg;/g, "°")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function cleanCell(value = "") {
  return htmlToText(value).replace(/\s+/g, " ").trim();
}

function normalizeToken(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value = "") {
  return normalizeToken(value).replace(/\s+/g, "-");
}

function countryToPath(countryKey) {
  if (!countryKey) return null;
  if (countryKey === "china") return "china";
  if (countryKey === "united states" || countryKey === "usa" || countryKey === "us") return "usa";
  if (countryKey === "russia" || countryKey === "russian federation") return "russia";
  return slugify(countryKey);
}

function titleCase(value) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function haversine(lat1, lon1, lat2, lon2) {
  const radiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}
