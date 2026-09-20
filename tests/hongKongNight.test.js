import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { buildHongKong, disposeHongKong } from "../src/city/hongKongGeometry.js";
import { buildLandmarkFacade, disposeLandmarkFacade } from "../src/city/hongKongFacades.js";
import { PEAK_ANCHORS, getPeakAnchor, LANDMARKS, terrainHeight } from "../src/city/hongKongScene.js";

test("city window lights and silhouettes fit the source buildings in two finite batches", () => {
  const { features }=JSON.parse(readFileSync(new URL("../public/data/hong-kong-osm.json",import.meta.url)));
  const coast=JSON.parse(readFileSync(new URL("../public/data/hong-kong-coast.json",import.meta.url)));
  const data=buildHongKong(features,coast);
  try {
    assert.ok(data.buildingCount>4000);
    const windows=data.windows.attributes.position,edges=data.outlines.attributes.position;
    assert.equal(windows.count,data.windows.attributes.color.count);
    assert.ok(windows.count>50000 && windows.count<1500000,"city lights stay within a single manageable geometry");
    assert.equal(windows.count%6,0);assert.equal(edges.count%2,0);
    for(const g of [data.windows,data.outlines])for(const attribute of Object.values(g.attributes))assert.ok(attribute.array.every(Number.isFinite));
    data.buildings.computeBoundingBox();data.windows.computeBoundingBox();
    assert.ok(data.buildings.boundingBox.clone().expandByScalar(.01).containsBox(data.windows.boundingBox));
    data.surroundings.land.computeBoundingBox();
    assert.ok(data.surroundings.land.boundingBox.min.x < -20 && data.surroundings.land.boundingBox.max.x > 20,"peripheral land should extend beyond both sides");
    assert.ok(data.surroundings.land.boundingBox.max.y < .2,"peripheral land remains low and distant");
    data.surroundings.hills.computeBoundingBox();
    assert.ok(data.surroundings.hills.boundingBox.max.y < 5,"distant hills should stay low-profile");
    for(const geometry of [data.surroundings.land,data.surroundings.hills]){
      assert.ok(geometry.attributes.position.count<200000,"regional geography remains within its vertex budget");
      for(const attribute of Object.values(geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));
    }
  } finally { disposeHongKong(data); }
});

test("Peak pavilion stays small and leaves usable, stable photo and footstep anchors", () => {
  const model=buildLandmarkFacade("peak"),bounds=new THREE.Box3();
  try {
    for(const geometry of Object.values(model))bounds.union(geometry.boundingBox);
    const size=bounds.getSize(new THREE.Vector3());
    assert.ok(size.x<=.81 && size.z<=.75 && size.y<=.65,"pavilion must remain a small mountain landmark");
    const peak=LANDMARKS.find(l=>l.id==="peak");
    assert.equal(new Set(PEAK_ANCHORS.map(a=>a.id)).size,PEAK_ANCHORS.length);
    for(const {id,surface} of PEAK_ANCHORS) {
      const {position:[x,y,z]}=getPeakAnchor(id);
      assert.ok([x,y,z].every(Number.isFinite));
      assert.ok(Math.hypot(x-peak.point[0],z-peak.point[1])<.65);
      assert.ok(y>terrainHeight(x,z),"anchors must sit above their surface");
      if(surface==="building")assert.ok(y>=terrainHeight(...peak.point)+.56);
    }
    assert.equal(getPeakAnchor("unknown"),null);
  } finally { disposeLandmarkFacade(model); }
});
