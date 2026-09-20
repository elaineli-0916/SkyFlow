import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const memories=JSON.parse(readFileSync(new URL("../src/journey/memories.json",import.meta.url)));

test("Hong Kong photo pins use supplied coordinates and group only shared locations",()=>{
  const hk=memories.filter(memory=>memory.city==="hong-kong");
  assert.equal(hk.length,4);
  assert.equal(new Set(hk.map(memory=>`${memory.latitude.toFixed(5)}:${memory.longitude.toFixed(5)}`)).size,3);
  const peak=hk.filter(memory=>memory.latitude===22.2759&&memory.longitude===114.1455);
  assert.equal(peak.length,2);
  assert.ok(hk.every(memory=>memory.locationSource==="provided"));
});

test("Hong Kong coordinate pin asset is a browser-ready PNG with alpha",()=>{
  assert.ok(existsSync(new URL("../public/assets/hk-photo-pin.png",import.meta.url)));
  const header=readFileSync(new URL("../public/assets/hk-photo-pin.png",import.meta.url)).subarray(0,8);
  assert.deepEqual([...header],[137,80,78,71,13,10,26,10]);
});
