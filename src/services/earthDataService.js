import { getEarthTelemetry } from "./earthTelemetry.js";

export async function getEnvironmentSnapshot(options = {}) {
  const telemetry = await getEarthTelemetry(options);

  return {
    status: telemetry.status,
    latitude: telemetry.location.latitude,
    longitude: telemetry.location.longitude,
    locationName: telemetry.location.name,
    locationSource: telemetry.location.source,
    locationTimezone: telemetry.location.timezone ?? telemetry.timezone ?? null,
    country: telemetry.location.country ?? null,
    weather: telemetry.weather,
    sunrise: telemetry.solar.sunrise,
    sunset: telemetry.solar.sunset,
    moonPhase: telemetry.lunar.phase,
    telemetry,
    generatedAt: telemetry.generatedAt
  };
}
