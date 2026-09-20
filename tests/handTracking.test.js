import test from "node:test";
import assert from "node:assert/strict";
import { createHandTrackingSession } from "../src/astronaut/handTracking.js";

function deferred() {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(overrides={}) {
  let stops=0,closes=0,requests=0,cancelled=0,inferences=0;
  const tracks=[new EventTarget(),new EventTarget()];
  tracks.forEach(track=>{track.stop=()=>stops++;});
  const stream={getTracks:()=>tracks};
  const video={srcObject:null,readyState:2,currentTime:0,play:async()=>{},pause:()=>{}};
  const detector={close:()=>closes++,detectForVideo:async()=>{inferences++;return {landmarks:[]};}};
  const statuses=[],intents=[],landmarkFrames=[],frames=new Map();let next=0;
  const documentTarget=new EventTarget(),windowTarget=new EventTarget();
  documentTarget.hidden=false;
  const session=createHandTrackingSession({video,documentTarget,windowTarget,
    clock:()=>0,
    onStatus:value=>statuses.push(value),onIntent:value=>intents.push(value),onLandmarks:value=>landmarkFrames.push(value),
    mediaDevices:{getUserMedia:async()=>{requests++;return stream;}},createDetector:async()=>detector,
    requestFrame:callback=>{frames.set(++next,callback);return next;},
    cancelFrame:id=>{frames.delete(id);cancelled++;},...overrides});
  return {session,stream,video,detector,statuses,intents,landmarkFrames,documentTarget,windowTarget,tracks,
    stats:()=>({stops,closes,requests,cancelled,inferences}),
    async tick(now) {const entry=frames.entries().next().value;assert.ok(entry);frames.delete(entry[0]);video.currentTime+=.1;await entry[1](now);},
  };
}
test("no camera access before start; closing releases every track, detector and frame",async()=>{
  const f=fixture();assert.equal(f.stats().requests,0);
  await f.session.start();await f.session.start();
  assert.equal(f.stats().requests,1);
  assert.equal(f.video.srcObject,f.stream);
  await f.tick(100);
  f.session.stop();f.session.stop();
  assert.deepEqual(f.stats(),{stops:2,closes:1,requests:1,cancelled:1,inferences:1});
  assert.equal(f.video.srcObject,null);
  assert.deepEqual(f.intents.at(-1),{lateral:0,zoom:0,confidence:0});
});
test("a permission response arriving after unmount is immediately stopped",async()=>{
  const permission=deferred();const f=fixture({mediaDevices:{getUserMedia:()=>permission.promise}});
  const starting=f.session.start();f.session.stop();permission.resolve(f.stream);await starting;
  assert.equal(f.stats().stops,2);assert.equal(f.stats().closes,0);assert.equal(f.video.srcObject,null);
});
test("closing while the model loads releases camera immediately and the late model",async()=>{
  const model=deferred(),loading=deferred();let signal;
  const f=fixture({createDetector:options=>{signal=options.signal;loading.resolve();return model.promise;}});
  const starting=f.session.start();await loading.promise;
  f.session.stop();assert.equal(f.stats().stops,2);assert.equal(signal.aborted,true);
  model.resolve(f.detector);await starting;assert.equal(f.stats().closes,1);
});
test("denial, missing browser API, model failure and playback failure remain contained",async()=>{
  const denied=fixture({mediaDevices:{getUserMedia:async()=>{throw new DOMException("Denied","NotAllowedError");}}});
  await denied.session.start();assert.match(denied.statuses.at(-1),/未获授权/);
  const unsupported=fixture({mediaDevices:{}});await unsupported.session.start();assert.match(unsupported.statuses.at(-1),/不支持/);
  const failed=fixture({createDetector:async()=>{throw new Error("WASM failed");}});
  await failed.session.start();assert.equal(failed.stats().stops,2);assert.equal(failed.video.srcObject,null);
  const playback=fixture();playback.video.play=async()=>{throw new Error("No playback");};
  await playback.session.start();assert.equal(playback.stats().stops,2);
});
test("an in-flight inference cannot publish or schedule after close",async()=>{
  const pending=deferred();const f=fixture();f.detector.detectForVideo=()=>pending.promise;
  await f.session.start();const running=f.tick(100);f.session.stop();
  const count=f.intents.length;pending.resolve({landmarks:[]});await running;
  assert.equal(f.intents.length,count);assert.equal(f.stats().closes,1);
});
test("a delayed inference is discarded instead of applying stale movement",async()=>{
  const f=fixture({clock:()=>2000});await f.session.start();await f.tick(100);
  assert.deepEqual(f.intents.at(-1),{lateral:0,zoom:0,confidence:0});
  f.session.stop();
});
test("recognition runs at most 20 Hz and a single visible hand is accepted by the UI",async()=>{
  const f=fixture();await f.session.start();
  for(const time of [0,25,50,75,100])await f.tick(time);
  assert.equal(f.stats().inferences,3);
  f.detector.detectForVideo=async()=>({
    landmarks:[Array.from({length:21},()=>({x:.5,y:.5,z:0}))],
    handedness:[[{categoryName:"Left",score:.55}]],
  });
  await f.tick(150);
  assert.match(f.statuses.at(-1),/已识别手掌/);
  assert.equal(f.landmarkFrames.at(-1).length,1);
  f.session.stop();
  assert.deepEqual(f.landmarkFrames.at(-1),[]);
});
test("hidden tabs neutralize input, device removal and pagehide release the camera",async()=>{
  const f=fixture();await f.session.start();
  f.documentTarget.hidden=true;f.documentTarget.dispatchEvent(new Event("visibilitychange"));
  await f.tick(100);assert.equal(f.stats().inferences,0);
  f.documentTarget.hidden=false;f.documentTarget.dispatchEvent(new Event("visibilitychange"));
  await f.tick(200);assert.equal(f.stats().inferences,1);
  f.tracks[0].dispatchEvent(new Event("ended"));assert.equal(f.stats().stops,2);
  assert.match(f.statuses.at(-1),/摄像头不可用/);
  const leaving=fixture();await leaving.session.start();leaving.windowTarget.dispatchEvent(new Event("pagehide"));
  assert.equal(leaving.stats().stops,2);assert.equal(leaving.stats().closes,1);
});
