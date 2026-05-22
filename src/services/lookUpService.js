import { formatLocalClock } from "../utils/format.js";

const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function azimuthToDirection(azimuth) {
  if (azimuth == null || Number.isNaN(azimuth)) return "unknown";
  const normalized = ((azimuth % 360) + 360) % 360;
  return DIRECTIONS[Math.round(normalized / 45) % 8];
}

export function describeAltitude(altitude) {
  if (altitude == null || Number.isNaN(altitude)) return "untracked";
  if (altitude < 0) return "below horizon";
  if (altitude < 28) return "low above horizon";
  return "high in the sky";
}

export function describeMoonPhase(phase) {
  if (phase == null) return "unknown phase";
  if (phase < 0.03 || phase > 0.97) return "new moon";
  if (phase < 0.22) return "waxing crescent";
  if (phase < 0.29) return "first quarter";
  if (phase < 0.47) return "waxing gibbous";
  if (phase < 0.55) return "full moon";
  if (phase < 0.72) return "waning gibbous";
  if (phase < 0.79) return "last quarter";
  return "waning crescent";
}

export function buildLookUpState(snapshot, now) {
  const solar = snapshot.telemetry?.solar ?? {};
  const lunar = snapshot.telemetry?.lunar ?? {};
  const cloudCover = snapshot.weather?.cloudCover;
  const moonDirection = azimuthToDirection(lunar.azimuth);
  const moonAltitudeText = describeAltitude(lunar.altitude);
  const sunAltitudeText = describeAltitude(solar.altitude);
  const moonPhase = describeMoonPhase(snapshot.moonPhase);

  return {
    localTime: formatLocalClock(now, snapshot.longitude),
    moonDirection,
    moonAltitude: lunar.altitude,
    moonAltitudeText,
    sunAltitude: solar.altitude,
    sunAltitudeText,
    cloudCover,
    sunrise: snapshot.sunrise,
    sunset: snapshot.sunset,
    moonPhase,
    narration: buildLookUpNarration({
      moonDirection,
      moonAltitudeText,
      cloudCover,
      sunAltitude: solar.altitude,
      moonPhase
    })
  };
}

export function buildLookUpNarration({ moonDirection, moonAltitudeText, cloudCover, sunAltitude, moonPhase }) {
  const cloudText =
    cloudCover == null
      ? "through a quiet atmospheric veil"
      : cloudCover > 70
        ? "partly hidden by a dense cloud field"
        : cloudCover > 38
          ? "softened by moving clouds"
          : "with a clear line of sight";

  if (moonAltitudeText === "below horizon") {
    return `The moon is below the horizon toward ${moonDirection}; the sky is holding a ${moonPhase} ${cloudText}.`;
  }

  if (sunAltitude < 0) {
    return `The moon is ${moonAltitudeText} in the ${moonDirection}, ${cloudText}.`;
  }

  return `Daylight is still present; the moon is ${moonAltitudeText} toward ${moonDirection}, ${cloudText}.`;
}
