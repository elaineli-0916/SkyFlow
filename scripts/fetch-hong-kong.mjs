import { mkdir, writeFile } from "node:fs/promises";

// A bounded, one-off OSM extract. Rendering uses this local file, never Overpass.
const query = '[out:json][timeout:40];(way["building"](22.268,114.13,22.326,114.202);way["natural"="coastline"](22.268,114.13,22.326,114.202););out geom;';
const response = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST", body: new URLSearchParams({ data: query }),
  headers: { "User-Agent": "SkyFlow-local-hackathon-data-extract/1.0" }, signal: AbortSignal.timeout(55000)
});
if (!response.ok) throw new Error(`OSM extract unavailable (${response.status})`);
const data = await response.json();
if (!Array.isArray(data.elements) || data.remark) throw new Error("Incomplete OSM extract");
const features = data.elements.filter((item) => item.geometry?.length > 2).map((item) => ({
  id: item.id, kind: item.tags.building ? "building" : "coastline",
  name: item.tags["name:en"] ?? item.tags.name ?? null,
  height: parseFloat(item.tags.height) || (parseFloat(item.tags["building:levels"]) || 0) * 3.2 || null,
  points: item.geometry.map(({lon, lat}) => [Number(lon.toFixed(6)), Number(lat.toFixed(6))])
}));
await mkdir("public/data", { recursive: true });
await writeFile("public/data/hong-kong-osm.json", JSON.stringify({
  source: "OpenStreetMap contributors", license: "ODbL-1.0", sourceUrl: "https://www.openstreetmap.org/copyright",
  fetchedAt: new Date().toISOString(), bounds: [114.13,22.268,114.202,22.326], features
}));
console.log(JSON.stringify({features:features.length,buildings:features.filter(f=>f.kind==="building").length}));
