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
