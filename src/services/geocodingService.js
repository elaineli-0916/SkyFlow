export async function reverseGeocode(latitude, longitude) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
  url.searchParams.set("latitude", latitude.toFixed(4));
  url.searchParams.set("longitude", longitude.toFixed(4));
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url, { signal: AbortSignal.timeout(5200) });
  if (!response.ok) throw new Error("Could not resolve photo coordinates.");
  const result = (await response.json())?.results?.[0];
  if (!result) throw new Error("No place found for photo coordinates.");

  return normalizePlace(result, latitude, longitude);
}

export async function geocodePlace(query) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url, { signal: AbortSignal.timeout(5200) });
  if (!response.ok) throw new Error("Could not find that place.");
  const result = (await response.json())?.results?.[0];
  if (!result) throw new Error("No matching place found.");

  return normalizePlace(result, result.latitude, result.longitude);
}

function normalizePlace(result, latitude, longitude) {
  return {
    name: result.name ?? "Sky memory",
    region: result.admin1 ?? result.country ?? "Local sky",
    country: result.country ?? null,
    latitude,
    longitude
  };
}
