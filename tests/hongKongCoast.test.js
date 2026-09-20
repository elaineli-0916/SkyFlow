import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { coastalPolygons, containsLand } from "../src/city/hongKongCoast.js";
import { project, BOUNDS } from "../src/city/hongKongScene.js";

const data=JSON.parse(readFileSync(new URL("../public/data/hong-kong-coast.json",import.meta.url)));
const polygons=coastalPolygons(data);
const landAt=point=>polygons.filter(p=>containsLand(project(point),p)).map(p=>p.id);

test("physical islands and mainland contain the expected geographic locations",()=>{
  for(const [name,point,id] of [
    ["Central",[114.158,22.281],"hong-kong-island"],
    ["Stanley",[114.212,22.219],"hong-kong-island"],
    ["Mong Kok",[114.169,22.321],"mainland"],
    ["Sha Tin",[114.19,22.385],"mainland"],
    ["Tsuen Wan",[114.117,22.372],"mainland"],
    ["Tsing Yi",[114.105,22.349],"tsing-yi"],
    ["Lamma",[114.113,22.226],"lamma"],
    ["Lantau",[113.98,22.264],"lantau"]
  ])assert.deepEqual(landAt(point),[id],name);
  for(let lat=22.32;lat<=22.415;lat+=.005)assert.deepEqual(landAt([114.165,lat]),["mainland"],"Kowloon must connect north into New Territories");
  const island=polygons.find(p=>p.id==="hong-kong-island");
  assert.ok(island.bounds.minX<BOUNDS.west&&island.bounds.maxX>BOUNDS.east);
  assert.ok(island.bounds.maxZ>44,"retain the full south coast, beyond the original cropped city");
});

test("harbour entrances and island channels remain open water",()=>{
  for(const [name,point] of [
    ["Victoria Harbour",[114.164,22.295]],
    ["Eastern Harbour",[114.234,22.293]],
    ["Western Harbour",[114.125,22.303]],
    ["Tsing Yi Channel",[114.119,22.348]],
    ["West Lamma Channel",[114.074,22.244]],
    ["East Lamma Channel",[114.13,22.247]]
  ])assert.deepEqual(landAt(point),[],name);
});

test("offline coast data has closed finite rings and carries its source attribution",()=>{
  assert.equal(new Set(data.features.map(f=>f.id)).size,data.features.length);
  assert.match(data.license,/ODbL/);assert.match(data.source,/Natural Earth/);
  for(const f of data.features)for(const ring of f.rings){
    assert.ok(ring.length>=4,f.id);assert.deepEqual(ring[0],ring.at(-1),f.id);
    for(const [lon,lat] of ring)assert.ok(Number.isFinite(lon)&&Number.isFinite(lat)&&lon>=113.7&&lon<=114.5&&lat>=22.05&&lat<=22.67,f.id);
  }
});
