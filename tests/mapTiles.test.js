import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { handleMapTiles, rewriteTileset } from "../server/routes/mapTiles.js";

const key = "test-secret-key";
const root = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${key}`;

test("rewrites nested, absolute and relative content URLs, retaining sessions and copyright", () => {
  const result = rewriteTileset({ asset: { copyright: "Google Maps; Provider" }, root: {
    content: { uri: `https://tile.googleapis.com/v1/3dtiles/a.json?key=${key}&session=s1` },
    children: [{ contents: [{ url: `b.glb?key=${key}&session=s2` }] }]
  }, extras: { debug: key } }, root, key);
  assert.equal(result.asset.copyright, "Google Maps; Provider");
  assert.equal(new URL(result.root.content.uri, "http://local").searchParams.get("session"), "s1");
  assert.equal(new URL(result.root.children[0].contents[0].url, "http://local").searchParams.get("path"), "/v1/3dtiles/b.glb");
  assert.ok(!JSON.stringify(result).includes(key));
  assert.throws(() => rewriteTileset({ content: { uri: "https://evil.example/tile" } }, root, key));
  const inherited = rewriteTileset({ content: { uri: "tile.glb" } }, `${root}&session=inherited`, key);
  assert.equal(new URL(inherited.content.uri, "http://local").searchParams.get("session"), "inherited");
});

async function withProxy(options, run) {
  const server = http.createServer((request, response) => handleMapTiles(request, response, new URL(request.url, "http://local"), options));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("missing credentials and invalid paths do not call Google", async () => {
  await withProxy({ apiKey: "", fetchImpl: () => { throw new Error("Must not fetch"); } }, async (base) => {
    assert.equal((await fetch(`${base}/api/maps/tiles`)).status, 503);
    for (const query of ["path=https://evil.example", "path=/v1/3dtiles/../secret", "url=https://evil.example", "key=client-key"]) {
      assert.equal((await fetch(`${base}/api/maps/tiles?${query}`)).status, 400);
    }
    assert.equal((await fetch(`${base}/api/maps/tiles`, { method: "POST" })).status, 405);
  });
});

test("upstream keys are server only and binary tiles pass through intact", async () => {
  const binary = new Uint8Array([103, 108, 84, 70, 0, 255, 20]);
  await withProxy({ apiKey: key, fetchImpl: async (url, options) => {
    assert.equal(url.origin, "https://tile.googleapis.com");
    assert.equal(url.searchParams.get("key"), key);
    assert.equal(url.searchParams.get("session"), "s1");
    assert.equal(options.redirect, "error");
    return new Response(binary, { headers: { "content-type": "model/gltf-binary" } });
  } }, async (base) => {
    const response = await fetch(`${base}/api/maps/tiles?path=/v1/3dtiles/a.glb&session=s1`);
    assert.equal(response.status, 200);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), binary);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("provider errors and redirects cannot leak credentials", async () => {
  for (const status of [403, 429]) {
    await withProxy({ apiKey: key, fetchImpl: async () => new Response(`secret: ${key}`, { status }) }, async (base) => {
      const response = await fetch(`${base}/api/maps/tiles`);
      assert.equal(response.status, status === 429 ? 429 : 502);
      assert.ok(!(await response.text()).includes(key));
    });
  }
});
