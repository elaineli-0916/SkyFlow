import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { JOURNEY_STOPS, JOURNEY_MUSIC, journeyArc } from "../src/journey/journeyData.js";
const memories=JSON.parse(readFileSync(new URL("../src/journey/memories.json",import.meta.url)));

test("journey preserves every return visit in the requested order",()=>{
  assert.deepEqual(JOURNEY_STOPS.map(s=>s.name),["北京","上海","纽约","马里兰","北京","香港","上海","北京"]);
  assert.equal(new Set(JOURNEY_STOPS.map(s=>s.id)).size,8);
});
test("globe arcs join exact cities above the surface and remain finite",()=>{
  for(let i=1;i<8;i++){
    const a=JOURNEY_STOPS[i-1],b=JOURNEY_STOPS[i],arc=journeyArc(a,b,i);
    for(const [p,q] of [[arc[0],a],[arc.at(-1),b]]){assert.ok(Math.abs(p.latitude-q.latitude)<1e-8);assert.ok(Math.abs(p.longitude-q.longitude)<1e-8);}
    for(const p of arc)assert.ok(Object.values(p).every(Number.isFinite)&&p.height>=14999&&p.latitude>=-90&&p.latitude<=90);
    assert.ok(arc[40].height>100000);
  }
});
test("local media URLs resolve, preserve supplied precision and GPS hemispheres",()=>{
  assert.equal(memories.length,19);
  assert.equal(new Set(memories.map(m=>m.id)).size,memories.length);
  for(const m of memories){assert.ok(existsSync(new URL(`../public${decodeURIComponent(m.url)}`,import.meta.url)),m.url);assert.ok(Math.abs(m.latitude)<=90&&Math.abs(m.longitude)<=180);}
  for(const m of memories.filter(m=>["new-york","maryland"].includes(m.city)))assert.ok(m.longitude<0,"western GPS longitude must retain its reference");
  const harbor=memories.find(m=>m.id==="hongkong-harbor");
  assert.equal(harbor.locationSource,"provided");
  assert.equal(harbor.capturedAt.slice(0,10),"2025-10-06");
  assert.ok(Math.abs(harbor.latitude-22.292305)<1e-8&&Math.abs(harbor.longitude-114.181262)<1e-8);
  const video=memories.find(m=>m.id==="newyork-washingtownsq");
  assert.equal(video.locationSource,"provided");
  assert.equal(video.capturedAt.slice(0,10),"2021-09-18");
  assert.equal(memories.filter(m=>m.city==="shanghai").length,0);
  assert.equal(memories.find(m=>m.id==="beijing-young").capturedAt,"2005","year-only dates remain year-only");
  assert.equal(memories.find(m=>m.id==="los-angeles").capturePrecision,"month");
  assert.ok(!JOURNEY_MUSIC.includes("#"));
  assert.ok(existsSync(new URL(`../public${JOURNEY_MUSIC}`,import.meta.url)));
});
