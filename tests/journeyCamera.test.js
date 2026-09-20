import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { journeyCityView, journeyFlight, memoryIsOpen } from "../src/journey/journeyCamera.js";
import { JOURNEY_STOPS } from "../src/journey/journeyData.js";
const memories = JSON.parse(readFileSync(new URL("../src/journey/memories.json", import.meta.url)));

test("city framing includes all GPS memories at useful satellite scale on wide and portrait screens", () => {
  for (const aspect of [1.6, .55]) for (const stop of JOURNEY_STOPS) {
    const view = journeyCityView(stop, memories, aspect);
    assert.ok(view.range < 200000 && view.range >= 4500);
    const radius = view.range * Math.sin(Math.atan(Math.tan(Math.PI / 6) * Math.min(1, aspect)));
    for (const m of memories.filter(m => m.city === stop.city)) {
      const distance = Math.hypot((m.latitude - view.latitude) * 111195, (m.longitude - view.longitude) * 111195 * Math.cos(view.latitude * Math.PI / 180));
      assert.ok(distance < radius / 1.5, `${stop.city}: ${m.id} fits with room for photos`);
    }
  }
});
test("all route legs follow continuous ground tracks and camera scale, including transpacific travel", () => {
  const views = [{ longitude:112, latitude:32, range:20500000, heading:0, pitch:-Math.PI/2 }, ...JOURNEY_STOPS.map(s=>journeyCityView(s,memories))];
  for (let i=1;i<views.length;i++) {
    const path=journeyFlight(views[i-1],views[i]), first=path.sample(0), last=path.sample(1);
    for (const key of ["latitude","longitude","range","pitch"]) {
      assert.ok(Math.abs(first[key]-views[i-1][key])<1e-5, `start ${key}`);
      assert.ok(Math.abs(last[key]-views[i][key])<1e-5, `end ${key}`);
    }
    let previous=first;
    for(let frame=1;frame<=path.duration*60;frame++) {
      const p=path.sample(frame/(path.duration*60));
      assert.ok(Object.values(p).every(Number.isFinite));
      assert.ok(p.range>=Math.min(first.range,last.range)-1);
      assert.ok(Math.abs(Math.log(p.range/previous.range))<.075,"no single-frame zoom jump");
      previous=p;
    }
    const apexA=path.sample(.379),apexB=path.sample(.381);
    assert.ok(Math.hypot(apexA.latitude-apexB.latitude,apexA.longitude-apexB.longitude)>.00001,"ground movement continues across climb/descent join");
  }
});
test("manual photo closing overrides auto reveal, and a pin click can reopen it",()=>{
  assert.equal(memoryIsOpen(null,true),true);
  assert.equal(memoryIsOpen(false,true),false);
  assert.equal(memoryIsOpen(true,false),true);
});
