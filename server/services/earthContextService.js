export function buildEarthContext(body, memories = []) {
  const telemetry = body.telemetry ?? {};
  const location = telemetry.location ?? {};
  const weather = telemetry.weather ?? {};
  const solar = telemetry.solar ?? {};
  const lunar = telemetry.lunar ?? {};

  return {
    mode: body.mode ?? "ask",
    localTime: body.localTime ?? null,
    location: {
      name: location.name ?? body.locationName ?? "local orbit",
      latitude: location.latitude ?? body.latitude ?? null,
      longitude: location.longitude ?? body.longitude ?? null
    },
    weather: {
      summary: weather.summary ?? null,
      cloudCover: weather.cloudCover ?? null,
      windSpeed: weather.windSpeed ?? null
    },
    sky: {
      sunAltitude: solar.altitude ?? null,
      sunAzimuth: solar.azimuth ?? null,
      moonAltitude: lunar.altitude ?? null,
      moonAzimuth: lunar.azimuth ?? null,
      moonPhase: lunar.phase ?? body.moonPhase ?? null,
      sunrise: solar.sunrise ?? body.sunrise ?? null,
      sunset: solar.sunset ?? body.sunset ?? null
    },
    photoMemories: (body.photoMemories ?? []).map((memory) => ({
      id: memory.id,
      label: memory.label,
      region: memory.region,
      capturedAt: memory.capturedAt,
      latitude: memory.latitude,
      longitude: memory.longitude
    })),
    memories
  };
}
