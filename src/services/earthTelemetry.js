import { getMoonPhase, getSolarPosition, getApproxMoonPosition } from "../utils/astro.js";

const DEFAULT_POSITION = {
  latitude: 40.7128,
  longitude: -74.006,
  name: "New York orbit",
  country: "United States",
  admin1: "New York",
  timezone: "America/New_York",
  source: "fallback"
};

const FORCE_LOCATIONS = {
  "new-york": {
    latitude: 40.7128,
    longitude: -74.006,
    name: "New York orbit",
    country: "United States",
    admin1: "New York",
    timezone: "America/New_York",
    source: "forced"
  }
};

let cachedPosition = null;

export async function getEarthTelemetry(options = {}) {
  const now = new Date();
  const location = await getLocation(options);
  const meteo = await getOpenMeteoSnapshot(location).catch(() => null);
  const localSolar = getSolarPosition(now, location.latitude, location.longitude);
  const localLunar = {
    phase: getMoonPhase(now),
    moonrise: null,
    moonset: null,
    meridian: null,
    meridianAltitude: null,
    ...getApproxMoonPosition(now, location.latitude, location.longitude)
  };
  const timeAndDateMoon = await getTimeAndDateMoonSnapshot(location).catch(() => null);
  const lunar = mergeLunarTelemetry(localLunar, timeAndDateMoon);

  return {
    status: meteo ? "live" : "local-model",
    generatedAt: now.toISOString(),
    location,
    weather: meteo?.weather ?? null,
    solar: {
      sunrise: meteo?.solar?.sunrise ?? null,
      sunset: meteo?.solar?.sunset ?? null,
      ...localSolar
    },
    timezone: location.timezone ?? meteo?.timezone ?? null,
    lunar,
    sources: {
      location: location.source,
      weather: meteo ? "open-meteo" : "fallback",
      astronomy: buildAstronomySource(meteo, timeAndDateMoon)
    }
  };
}

async function getLocation({ preferCachedPosition } = {}) {
  const forced = getForcedLocation();
  if (forced) {
    cachedPosition = forced;
    return forced;
  }

  if (preferCachedPosition && cachedPosition) {
    return cachedPosition;
  }

  if (!("geolocation" in navigator)) {
    cachedPosition = DEFAULT_POSITION;
    return DEFAULT_POSITION;
  }

  try {
    const location = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 4200,
        maximumAge: 1000 * 60 * 30
      });
    });

    cachedPosition = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      name: "your orbit",
      timezone: null,
      source: "browser"
    };
    cachedPosition = await enrichLocationName(cachedPosition).catch(() => cachedPosition);
    return cachedPosition;
  } catch {
    cachedPosition = DEFAULT_POSITION;
    return DEFAULT_POSITION;
  }
}

async function enrichLocationName(location) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
  url.searchParams.set("latitude", location.latitude.toFixed(4));
  url.searchParams.set("longitude", location.longitude.toFixed(4));
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url, { signal: AbortSignal.timeout(4200) });
  if (!response.ok) return location;

  const result = (await response.json())?.results?.[0];
  if (!result?.name) return location;

  return {
    ...location,
    name: result.name,
    country: result.country ?? null,
    admin1: result.admin1 ?? null,
    timezone: result.timezone ?? location.timezone ?? null
  };
}

function getForcedLocation() {
  const key = import.meta.env.VITE_SKYFLOW_FORCE_LOCATION?.trim();
  return key ? FORCE_LOCATIONS[key] ?? null : null;
}

async function getOpenMeteoSnapshot({ latitude, longitude }) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toFixed(4));
  url.searchParams.set("longitude", longitude.toFixed(4));
  url.searchParams.set("current", "temperature_2m,cloud_cover,weather_code,wind_speed_10m,is_day");
  url.searchParams.set("daily", "sunrise,sunset");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "2");

  const response = await fetch(url, { signal: AbortSignal.timeout(5200) });
  if (!response.ok) throw new Error("Open-Meteo telemetry unavailable");

  const data = await response.json();
  const current = data.current ?? {};
  const daily = data.daily ?? {};

  return {
    weather: {
      temperature: current.temperature_2m,
      cloudCover: current.cloud_cover,
      windSpeed: current.wind_speed_10m,
      code: current.weather_code,
      isDay: current.is_day === 1,
      summary: summarizeWeather(current)
    },
    solar: {
      sunrise: daily.sunrise?.[0] ? normalizeOpenMeteoTime(daily.sunrise[0], data.utc_offset_seconds) : null,
      sunset: daily.sunset?.[0] ? normalizeOpenMeteoTime(daily.sunset[0], data.utc_offset_seconds) : null
    },
    timezone: data.timezone ?? null
  };
}

function summarizeWeather(current) {
  if (current.cloud_cover > 82) return "dense cloud field";
  if (current.cloud_cover > 52) return "clouds in motion";
  if (current.wind_speed_10m > 24) return "fast surface winds";
  if (current.temperature_2m <= 2) return "cold surface air";
  if (current.temperature_2m >= 31) return "warm surface air";
  return "clear moving air";
}

function normalizeOpenMeteoTime(value, utcOffsetSeconds = 0) {
  const local = new Date(value);
  if (Number.isNaN(local.getTime())) return null;
  return new Date(local.getTime() - utcOffsetSeconds * 1000).toISOString();
}

async function getTimeAndDateMoonSnapshot(location) {
  const url = new URL("/api/moon/timeanddate", window.location.origin);
  url.searchParams.set("locationName", location.name ?? "");
  url.searchParams.set("country", location.country ?? "");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("date", formatLocalDateForRequest(new Date()));

  const response = await fetch(url, { signal: AbortSignal.timeout(9500) });
  if (!response.ok && response.status !== 202) return null;

  const data = await response.json();
  return data?.ok ? data : { source: data?.source ?? "timeanddate-unavailable" };
}

function formatLocalDateForRequest(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mergeLunarTelemetry(localLunar, timeAndDateMoon) {
  if (!timeAndDateMoon?.ok) {
    return {
      ...localLunar,
      provider: timeAndDateMoon?.source ?? "local-astro"
    };
  }

  return {
    ...localLunar,
    azimuth: timeAndDateMoon.current?.directionDegrees ?? localLunar.azimuth,
    altitude: timeAndDateMoon.current?.altitudeDegrees ?? localLunar.altitude,
    directionLabel: timeAndDateMoon.current?.directionLabel ?? null,
    moonrise: timeAndDateMoon.today?.moonrise ?? null,
    moonset: timeAndDateMoon.today?.moonset ?? null,
    meridian: timeAndDateMoon.today?.meridian ?? null,
    meridianAltitude: timeAndDateMoon.today?.meridianAltitude ?? null,
    provider: "timeanddate",
    providerUrl: timeAndDateMoon.location?.url ?? null,
    providerFetchedAt: timeAndDateMoon.fetchedAt ?? null
  };
}

function buildAstronomySource(meteo, timeAndDateMoon) {
  const base = meteo?.solar ? "open-meteo+local-astro" : "local-astro";
  if (timeAndDateMoon?.ok) return `${base}+timeanddate-moon`;
  if (timeAndDateMoon?.source) return `${base}+${timeAndDateMoon.source}`;
  return base;
}
