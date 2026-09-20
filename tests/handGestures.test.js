import test from "node:test";
import assert from "node:assert/strict";
import {classifyHand,measureHandPose,createHandGestureFilter,lateralFromMirroredMotion,normalizeGestureIntent} from "../src/astronaut/handGestures.js";
import {EARTH_RADIUS,createObserverMotion,stepObserver} from "../src/astronaut/astronautMotion.js";

function hand(open=true,x=.4) {
  const p=Array.from({length:21},()=>({x,y:.8,z:0}));
  [1,2,3,4].forEach((index,i)=>{p[index]={x:x-.035*(i+1),y:.76-.045*i,z:0};});
  [5,9,13,17].forEach((base,finger)=>{
    const fx=x+(finger-1.5)*.045;
    const ys=open?[.64,.55,.48,.42]:[.64,.55,.60,.69];
    ys.forEach((y,j)=>{p[base+j]={x:fx,y,z:0};});
  });
  return p;
}
function result(open=true,dx=0,score=.96) {
  return {landmarks:[hand(open,.4+dx)],handedness:[[{categoryName:"Left",score}]]};
}
function unknownPose(dx=0) {
  const value=result(false,dx),open=hand(true,.4+dx);
  for(let i=5;i<=8;i++)value.landmarks[0][i]=open[i];
  return value;
}
const stopped = intent => assert.ok(intent.lateral===0 && intent.zoom===0);

test("open hands and fists classify independently of rotation, scale, or handedness",()=>{
  for(const open of [true,false])for(const angle of [0,.5,2.7])for(const scale of [1,.1]) {
    const points=hand(open).map(p=>({x:scale*(p.x*Math.cos(angle)-p.y*Math.sin(angle)),y:scale*(p.x*Math.sin(angle)+p.y*Math.cos(angle)),z:0}));
    assert.equal(classifyHand(points),open?"open":"fist");
    assert.equal(classifyHand(points.map(p=>({...p,x:-p.x}))),open?"open":"fist");
  }
  assert.equal(classifyHand([]),"unknown");
});
test("one relaxed palm or fist starts zoom after a 100 ms hold",()=>{
  for(const open of [true,false]) {
    const filter=createHandGestureFilter();
    for(const t of [0,50])stopped(filter.update(result(open,0,.55),t));
    const intent=filter.update(result(open,0,.55),100);
    assert.equal(intent.zoom,open?1:-1);assert.equal(intent.confidence,.55);
  }
  const palm=hand(true),bent=hand(false);
  for(let i=17;i<=20;i++)palm[i]=bent[i];
  const pose=measureHandPose(palm);
  assert.equal(pose.shape,"open");assert.ok(pose.zoom>0 && pose.zoom<1);
});
test("swipe gain is proportional to amplitude per second and capped in both directions",()=>{
  const slow=lateralFromMirroredMotion(-.02,.1),fast=lateralFromMirroredMotion(-.03,.1);
  assert.ok(slow>0 && fast>slow && fast<1);
  assert.equal(lateralFromMirroredMotion(.03,.1),-fast);
  assert.equal(lateralFromMirroredMotion(-.2,.1),1);
  assert.equal(lateralFromMirroredMotion(.001,.1),0);
  assert.equal(lateralFromMirroredMotion(.1,0),0);
  assert.equal(lateralFromMirroredMotion(NaN,.1),0);
});
test("single-hand sideways motion works for an unknown pose without also zooming",()=>{
  for(const rawSign of [-1,1]) {
    const filter=createHandGestureFilter();let intent;
    for(let t=0;t<=400;t+=50)intent=filter.update(unknownPose(rawSign*t/4000),t);
    assert.equal(classifyHand(unknownPose().landmarks[0]),"unknown");
    assert.equal(Math.sign(intent.lateral),rawSign);assert.equal(intent.zoom,0);
    assert.ok(Math.abs(intent.lateral)>.7 && Math.abs(intent.lateral)<.85);
  }
});
test("short tracking loss fades without restarting pose hold, longer loss stops",()=>{
  const filter=createHandGestureFilter();
  for(let t=0;t<=200;t+=50)filter.update(result(),t);
  const missing=filter.update({landmarks:[]},250);
  assert.ok(missing.zoom>0 && missing.zoom<1);
  const recovered=filter.update(result(),300);assert.equal(recovered.zoom,1);
  stopped(filter.update({landmarks:[]},600));
  stopped(filter.update(result(),650));
});
test("the same hand is followed across reordered detections and left/right label flips",()=>{
  const filter=createHandGestureFilter();let intent;
  for(let t=0;t<=400;t+=50) {
    const value=result(true,t/4000,.55);
    value.handedness[0][0].categoryName=t%100===0?"Right":"Left";
    if(t>=100) {
      value.landmarks.push(hand(false,.9));value.handedness.push([{categoryName:"Left",score:.99}]);
      if(t%100===0){value.landmarks.reverse();value.handedness.reverse();}
    }
    intent=filter.update(value,t);
    assert.ok(intent.zoom>=0,"a second hand's fist must not hijack the active palm");
  }
  assert.ok(intent.lateral>.25);
});
test("switching to a distant hand rebaselines rather than creating a fast swipe",()=>{
  const filter=createHandGestureFilter();
  for(let t=0;t<=200;t+=50)filter.update(result(),t);
  stopped(filter.update(result(false,.4),250));
  stopped(filter.update(result(false,.4),300));
  assert.equal(filter.update(result(false,.4),350).zoom,-1);
});
test("jitter, malformed landmarks and persistently weak observations do not move",()=>{
  const filter=createHandGestureFilter();
  for(let t=0;t<=1000;t+=50)assert.equal(filter.update(unknownPose(Math.sin(t)*.0015),t).lateral,0);
  const malformed=result();malformed.landmarks[0][7].x=NaN;
  for(const value of [malformed,null]) {
    const fresh=createHandGestureFilter();stopped(fresh.update(value,0));stopped(fresh.update(value,200));
  }
});
test("continuous intent survives the controller boundary without becoming an on/off switch",()=>{
  assert.deepEqual(normalizeGestureIntent({lateral:.22,zoom:-.37,confidence:.55}),{lateral:.22,zoom:-.37,confidence:.55});
  stopped(normalizeGestureIntent({lateral:1,zoom:1,confidence:.3}));
  assert.deepEqual(normalizeGestureIntent({lateral:999,zoom:NaN,confidence:1}),{lateral:1,zoom:0,confidence:1});
});
test("valid landmarks remain controllable when handedness confidence is weak",()=>{
  const filter=createHandGestureFilter();
  filter.update(result(true,0,.08),0);
  const intent=filter.update(result(true,0,.08),100);
  assert.equal(intent.zoom,1);
  assert.equal(intent.confidence,.35);
});
test("single-hand filter and camera together achieve the faster visual target",()=>{
  const filter=createHandGestureFilter(),radius=EARTH_RADIUS+17000000;
  const state=createObserverMotion([radius,0,0]);let intent={};
  for(let frame=0;frame<180;frame++) {
    if(frame%3===0)intent=normalizeGestureIntent(filter.update(result(),frame/60*1000));
    stepObserver(state,1/60,{gestureZoom:intent.zoom,gestureLateral:intent.lateral});
  }
  const finalRadius=Math.hypot(...state.position);
  const ratio=Math.sqrt((radius**2-EARTH_RADIUS**2)/(finalRadius**2-EARTH_RADIUS**2));
  assert.ok(ratio>2.7 && ratio<2.95,`projected size gain: ${ratio}`);
});
