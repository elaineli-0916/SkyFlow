export function formatClock(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

export function formatLocalClock(date, longitude, timeZone) {
  if (timeZone) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone
    }).format(date);
  }

  if (typeof longitude !== "number" || Number.isNaN(longitude)) {
    return formatClock(date);
  }

  const offsetMinutes = Math.round((longitude / 15) * 60);
  const localDate = new Date(date.getTime() + offsetMinutes * 60000);

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC"
  }).format(localDate);
}

export function formatUtcOffset(longitude, timeZone) {
  if (timeZone) return timeZone.replace("_", " ");
  if (typeof longitude !== "number" || Number.isNaN(longitude)) return "UTC";
  const offset = Math.round((longitude / 15) * 2) / 2;
  const sign = offset >= 0 ? "+" : "-";
  return `UTC${sign}${Math.abs(offset).toFixed(offset % 1 === 0 ? 0 : 1)}`;
}

export function getLocalHour(date, longitude, timeZone) {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
      timeZone
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return Number(values.hour) + Number(values.minute ?? 0) / 60 + Number(values.second ?? 0) / 3600;
  }

  const offsetMinutes = typeof longitude === "number" && !Number.isNaN(longitude)
    ? Math.round((longitude / 15) * 60)
    : 0;
  const localDate = new Date(date.getTime() + offsetMinutes * 60000);

  return (
    localDate.getUTCHours() +
    localDate.getUTCMinutes() / 60 +
    localDate.getUTCSeconds() / 3600
  );
}

export function formatCoordinate(value, kind) {
  const direction = kind === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(2)}°${direction}`;
}

export function formatPreciseCoordinate(latitude, longitude) {
  return `${formatCoordinate(latitude, "lat")} / ${formatCoordinate(longitude, "lon")}`;
}

export function formatMinutes(minutes) {
  if (minutes < 1) return "now";
  if (minutes < 90) return `${Math.round(minutes)} min`;
  return `${Math.round(minutes / 60)} hr`;
}

export function formatDegrees(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "tracking";
  return `${Math.round(value)} deg`;
}
