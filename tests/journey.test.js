import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { JOURNEY_STOPS, JOURNEY_MUSIC, journeyArc } from "../src/journey/journeyData.js";
import { JOURNEY_NARRATIVES, createNarrativeTimeline, visibleCharactersAt, narrativePlainText } from "../src/journey/journeyNarratives.js";
const memories=JSON.parse(readFileSync(new URL("../src/journey/memories.json",import.meta.url)));

test("journey preserves every return visit in the requested order",()=>{
  assert.deepEqual(JOURNEY_STOPS.map(s=>s.name),["北京","上海","纽约","马里兰","北京","香港","上海","北京"]);
  assert.equal(new Set(JOURNEY_STOPS.map(s=>s.id)).size,8);
});
test("every destination has the supplied narrative in route order",()=>{
  assert.deepEqual(Object.keys(JOURNEY_NARRATIVES),JOURNEY_STOPS.map(stop=>stop.id));
  assert.deepEqual(Object.values(JOURNEY_NARRATIVES).map(chapters=>chapters.length),[2,1,1,1,1,1,1,1]);
  assert.deepEqual(Object.values(JOURNEY_NARRATIVES).flat().map(chapter=>chapter.title),[
    "北京 · 起点","北京理工大学 · 第一次转向","上海 · 第一次离开北京","纽约 · 光怪陆离","Maryland · 实验室里的世界","北京 · 回来以后","香港 · 烟火气","上海 · 再一次回来","北京 · 回到起点"
  ]);
  const hashes=JOURNEY_STOPS.map(stop=>createHash("sha256").update(narrativePlainText(stop.id)).digest("hex").slice(0,16));
  assert.deepEqual(hashes,["a8b263f46beb2677","20650c12e15e33d6","0f796f185c41487f","e678e51050cca66e","c709387f4489b665","be16f31a11810639","0803439cc6edb080","c552222c8a96e49b"]);
});
test("typewriter timing reveals every character before automatic travel can continue",()=>{
  for(const stop of JOURNEY_STOPS){
    const timeline=createNarrativeTimeline(stop.id);
    assert.equal(visibleCharactersAt(timeline,0),0);
    assert.equal(visibleCharactersAt(timeline,timeline.typingDuration),timeline.totalCharacters);
    assert.equal(visibleCharactersAt(timeline,timeline.duration),timeline.totalCharacters);
    assert.ok(timeline.duration-timeline.typingDuration>=1800);
    assert.ok(timeline.duration>=11000&&timeline.duration<=23000,`${stop.id}: ${timeline.duration}ms`);
  }
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
