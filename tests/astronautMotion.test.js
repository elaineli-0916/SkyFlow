import test from "node:test";
import assert from "node:assert/strict";
import {EARTH_RADIUS,MIN_RADIUS,MAX_RADIUS,moveObserver,rotateVector} from "../src/astronaut/astronautMotion.js";
import {MOTION,createObserverMotion,turnObserver,stepObserver,observerPose,queueTravel,recenterObserver} from "../src/astronaut/astronautMotion.js";

const distance = (a,b) => Math.hypot(...a.map((value,i)=>value-b[i]));
const projectedSize = radius => EARTH_RADIUS/Math.sqrt(radius**2-EARTH_RADIUS**2);
test("full open palm grows the projected Earth about 2x in two seconds",()=>{
  for(const fps of [20,30,60,120]) {
    const radius=EARTH_RADIUS+17000000,state=createObserverMotion([radius,0,0]);
    for(let i=0;i<fps*2;i++)stepObserver(state,1/fps,{gestureZoom:i/fps<.08?0:1});
    const ratio=projectedSize(Math.hypot(...state.position))/projectedSize(radius);
    assert.ok(ratio>1.85 && ratio<2.05,`${fps} fps: ${ratio}`);
  }
});
test("zoom has the same visual gain far and near, with continuous gesture strength",()=>{
  const ratios=[];
  for(const radius of [MIN_RADIUS+6e6,EARTH_RADIUS+17e6,MAX_RADIUS]) {
    const state=createObserverMotion([radius,0,0]);
    for(let i=0;i<120;i++)stepObserver(state,1/60,{gestureZoom:.5});
    ratios.push(projectedSize(Math.hypot(...state.position))/projectedSize(radius));
  }
  assert.ok(Math.max(...ratios)-Math.min(...ratios)<1e-8);
  assert.ok(ratios[0]>1.39 && ratios[0]<1.44);
});
test("single hand angular gain remains continuous and reaches 90% speed within 180 ms",()=>{
  for(const input of [.1,.4,1]) {
    const state=createObserverMotion([2e7,0,0]);
    for(let i=0;i<11;i++)stepObserver(state,1/60,{gestureLateral:input});
    assert.ok(state.gestureAngularVelocity>=input*MOTION.gestureOrbitSpeed*.9);
    assert.ok(state.gestureAngularVelocity<=input*MOTION.gestureOrbitSpeed);
  }
});
test("rapid gesture input and loss remain bounded at both safety limits",()=>{
  for(const zoom of [-999,999]) {
    const state=createObserverMotion([EARTH_RADIUS+17e6,0,0]);
    for(let i=0;i<1800;i++) {
      const before=Math.hypot(...state.position);
      stepObserver(state,1/60,{gestureZoom:zoom,gestureLateral:999});
      const after=Math.hypot(...state.position);
      assert.ok(after>=MIN_RADIUS-.01 && after<=MAX_RADIUS+.01);
      assert.ok(Math.abs(Math.log(projectedSize(after)/projectedSize(before)))<=MOTION.gestureZoomRate/60+1e-8);
      assert.ok(Math.abs(state.gestureAngularVelocity)<=MOTION.gestureOrbitSpeed);
    }
    for(let i=0;i<120;i++)stepObserver(state,1/60);
    assert.ok(Math.abs(state.gestureAngularVelocity)<1e-7);
    assert.ok(Math.abs(state.gestureZoomRate)<1e-7);
  }
});
test("turning the head never moves the observer in any mode",()=>{
  for(const mode of ["free","hover","orbit"]) {
    const baseline=createObserverMotion([2e7,0,1e7]),turning=createObserverMotion([2e7,0,1e7]);
    baseline.mode=turning.mode=mode;
    for(let i=0;i<600;i++) {
      turnObserver(turning,.02,-.01);
      stepObserver(baseline,1/60);stepObserver(turning,1/60);
      assert.deepEqual(turning.position,baseline.position);
      assert.ok(Math.abs(turning.yawVelocity)<=MOTION.maxLookSpeed);
    }
    assert.ok(distance(observerPose(turning).direction,observerPose(baseline).direction)>.1);
  }
});
test("earth spin is continuous, capped after stalls and independent of orbital mode",()=>{
  const state=createObserverMotion([2e7,0,0]),original=[...state.position];
  for(const mode of ["free","orbit","hover"]) {
    state.mode=mode;
    const previous=state.earthSpinPhase;
    stepObserver(state,10);
    assert.ok(Math.abs(state.earthSpinPhase-previous-MOTION.earthSpinSpeed*.05)<1e-12);
  }
  const still=createObserverMotion(original);
  for(let i=0;i<600;i++)stepObserver(still,1/60);
  assert.deepEqual(still.position,original);
  assert.ok(distance(observerPose(still).position,original)>10000);
});
test("breathing and hand inertia stay bounded and do not accumulate displacement",()=>{
  const state=createObserverMotion([2e7,0,0]),original=[...state.position];
  for(let i=0;i<6000;i++) {
    if(i%50===0)turnObserver(state,i%100?10:-10,10);
    const pose=stepObserver(state,1/60);
    assert.ok(Math.abs(pose.breathOffset)<=MOTION.breathHeight);
    assert.ok(Math.abs(pose.hands.x)<=7 && Math.abs(pose.hands.y)<=6.5);
    assert.ok(pose.hands.scale>.995 && pose.hands.scale<1.005);
  }
  assert.deepEqual(state.position,original);
  recenterObserver(state);
  for(let i=0;i<1200;i++)stepObserver(state,1/60);
  assert.ok(Math.abs(state.lookYaw)<1e-6 && Math.abs(state.lookPitch)<1e-6);
  assert.deepEqual(observerPose(state,true).hands,{x:0,y:0,roll:0,scale:1});
});
test("rapid input is speed limited, decelerates, and never crosses the safety shell",()=>{
  const state=createObserverMotion([MIN_RADIUS+1e5,0,0]);
  for(let i=0;i<600;i++) {
    queueTravel(state,1e6);
    const previous=[...state.position];
    stepObserver(state,1/60,{lateral:999,zoom:999});
    assert.ok(distance(previous,state.position)<=MOTION.maxSpeed/60+.01);
    assert.ok(Math.hypot(...state.position)>=MIN_RADIUS-.01);
  }
  state.travel=0;
  const speed=Math.abs(state.lateralVelocity);
  stepObserver(state,1/60);
  assert.ok(Math.abs(state.lateralVelocity)<speed && Math.abs(state.lateralVelocity)>0);
  for(let i=0;i<600;i++)stepObserver(state,1/60);
  assert.ok(Math.abs(state.lateralVelocity)<.01);
});
test("leaving orbit slows to a fixed hover without an abrupt position jump",()=>{
  const state=createObserverMotion([2e7,0,0]);
  state.mode="orbit";
  for(let i=0;i<120;i++)stepObserver(state,1/60);
  state.mode="hover";
  const speed=state.orbitVelocity;
  stepObserver(state,1/60);
  assert.ok(state.orbitVelocity>0 && state.orbitVelocity<speed);
  for(let i=0;i<600;i++)stepObserver(state,1/60);
  assert.ok(state.orbitVelocity<.01);
});
test("orbit, lateral and approach inputs together still obey the total speed limit",()=>{
  const state=createObserverMotion([2e7,0,0]);state.mode="orbit";
  for(let i=0;i<1200;i++) {
    const previous=[...state.position];
    stepObserver(state,1/60,{lateral:1,zoom:1});
    assert.ok(distance(previous,state.position)<=MOTION.maxSpeed/60+.01);
  }
});

test("forward travel stops at the safety shell, even for a step crossing the globe",()=>{
  for(const step of [1e6,1e7,1e9]) {
    const position=moveObserver([0,0,MIN_RADIUS+1e6],[0,0,-1],step);
    assert.ok(position[2]>=MIN_RADIUS-.001);
    assert.ok(position[2]<=MIN_RADIUS+1e6);
  }
  assert.deepEqual(moveObserver([0,0,MIN_RADIUS],[0,0,-1],1e6),[0,0,MIN_RADIUS]);
});
test("backwards and sideways movement stay in the scene and finite",()=>{
  assert.equal(Math.hypot(...moveObserver([0,0,MAX_RADIUS-1],[0,0,-1],-1e9)),MAX_RADIUS);
  const next=moveObserver([0,0,MIN_RADIUS+1e6],[1,0,0],500000);
  assert.equal(next[0],500000);
  assert.equal(next[2],MIN_RADIUS+1e6);
});
test("orbit rotations preserve altitude and relative viewing direction",()=>{
  let position=[1.8e7,0,1.8e7],direction=[-Math.SQRT1_2,0,-Math.SQRT1_2],up=[0,1,0];
  const radius=Math.hypot(...position);
  for(let i=0;i<10000;i++) {
    position=rotateVector(position,[0,0,1],.001);
    direction=rotateVector(direction,[0,0,1],.001);
    up=rotateVector(up,[0,0,1],.001);
  }
  assert.ok(Math.abs(Math.hypot(...position)-radius)<.001);
  assert.ok(Math.abs(Math.hypot(...direction)-1)<1e-9);
  assert.ok(Math.abs(direction.reduce((sum,v,i)=>sum+v*up[i],0))<1e-9);
  assert.ok(position.reduce((sum,v,i)=>sum+v*direction[i],0)<-radius+.001);
});
