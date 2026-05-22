import { getMoonPhase, getSolarPosition, getApproxMoonPosition } from "../utils/astro.js";

const DEFAULT_POSITION = {
  latitude: 31.2304,
  longitude: 121.4737,
  name: "Shanghai orbit",
  source: "fallback"
};

let cachedPosition = null;

export async function getEarthTelemetry(options = {}) {
  const now = new Date();
  const location = await getLocation(options);
  const meteo = await getOpenMeteoSnapshot(location).catch(() => null);

  return {
    status: meteo ? "live" : "local-model",
    generatedAt: now.toISOString(),
    location,
    weather: meteo?.weather ?? null,
    solar: {
      sunrise: meteo?.solar?.sunrise ?? null,
      sunset: meteo?.solar?.sunset ?? null,
      ...getSolarPosition(now, location.latitude, location.longitude)
    },
    lunar: {
      phase: getMoonPhase(now),
      moonrise: null,
      moonset: null,
      ...getApproxMoonPosition(now, location.latitude, location.longitude)
    },
    sources: {
      location: location.source,
      weather: meteo ? "open-meteo" : "fallback",
      astronomy: meteo?.solar ? "open-meteo+local-astro" : "local-astro"
    }
  };
}

async function getLocation({ preferCachedPosition } = {}) {
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
      source: "browser"
    };
    return cachedPosition;
  } catch {
    cachedPosition = DEFAULT_POSITION;
    return DEFAULT_POSITION;
  }
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
    }
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
