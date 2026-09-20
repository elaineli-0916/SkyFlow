import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const GOOGLE_ORIGIN = "https://tile.googleapis.com";
const ROOT_PATH = "/v1/3dtiles/root.json";

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function validPath(path) {
  return path.length <= 4096 && /^\/v1\/3dtiles\/[a-zA-Z0-9_./~-]+$/.test(path)
    && !path.split("/").some((part) => part === "." || part === "..");
}

// Every nested tileset stays on our origin; the Google key never reaches Cesium.
export function rewriteTileset(document, upstreamUrl, apiKey) {
  function rewrite(value, field) {
    if (Array.isArray(value)) return value.map((item) => rewrite(item));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item, key)]));
    }
    if (typeof value !== "string") return value;
    if (field === "uri" || field === "url") {
      const target = new URL(value, upstreamUrl);
      if (target.origin !== GOOGLE_ORIGIN || !validPath(target.pathname)) {
        throw new Error("Unsupported tile resource");
      }
      const params = new URLSearchParams({ path: target.pathname });
      const session = target.searchParams.get("session") ?? new URL(upstreamUrl).searchParams.get("session");
      if (session) params.set("session", session);
      return `/api/maps/tiles?${params}`;
    }
    // Keep provider copyright and metadata, while defensively redacting credentials.
    return apiKey ? value.split(apiKey).join("[redacted]").split(encodeURIComponent(apiKey)).join("[redacted]") : value;
  }
  return rewrite(document);
}

export function handleMapsConfig(_request, response) {
  json(response, 200, { googleTilesConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY) });
}

export async function handleMapTiles(request, response, url, { fetchImpl = fetch, apiKey = process.env.GOOGLE_MAPS_API_KEY } = {}) {
  if (request.method !== "GET") return json(response, 405, { error: "Method not allowed" });
  if (request.headers["sec-fetch-site"] === "cross-site") return json(response, 403, { error: "Same-origin requests only" });
  const path = url.searchParams.get("path") ?? ROOT_PATH;
  const session = url.searchParams.get("session");
  if (!validPath(path) || (session && session.length > 2048)
    || [...url.searchParams.keys()].some((key) => !["path", "session"].includes(key))) {
    return json(response, 400, { error: "Invalid tile request" });
  }
  if (!apiKey) return json(response, 503, { error: "Google 3D Tiles is not configured", code: "MAPS_KEY_MISSING" });

  const upstreamUrl = new URL(path, GOOGLE_ORIGIN);
  upstreamUrl.searchParams.set("key", apiKey);
  if (session) upstreamUrl.searchParams.set("session", session);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const cancel = () => { if (!response.writableEnded) controller.abort(); };
  response.on("close", cancel);
  try {
    const upstream = await fetchImpl(upstreamUrl, { signal: controller.signal, redirect: "error" });
    if (!upstream.ok) {
      // Never forward provider error bodies or URLs: they can contain the API key.
      return json(response, upstream.status === 429 ? 429 : 502, {
        error: "Google 3D Tiles unavailable", code: "MAPS_UPSTREAM_ERROR", upstreamStatus: upstream.status
      });
    }
    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    if (contentType.includes("json") || path.endsWith(".json")) {
      return json(response, 200, rewriteTileset(await upstream.json(), upstreamUrl, apiKey));
    }
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    await pipeline(Readable.fromWeb(upstream.body), response);
  } catch {
    if (!response.headersSent && !response.destroyed) {
      json(response, 502, { error: "Google 3D Tiles request failed", code: "MAPS_UNAVAILABLE" });
    }
  } finally {
    clearTimeout(timeout);
    response.off("close", cancel);
  }
}
