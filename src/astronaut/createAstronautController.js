import { Cartesian2, Cartesian3, Matrix3, Matrix4, PostProcessStage, PointPrimitiveCollection, Color } from "cesium";
import { EARTH_RADIUS, createObserverMotion, turnObserver, stepObserver, observerPose, queueTravel, recenterObserver, rotateVector } from "./astronautMotion.js";
import { astronautBeamShader } from "./astronautBeam.js";
import { HAND_CONTROL, normalizeGestureIntent } from "./handGestures.js";

export function createAstronautController(viewer, { onPose, onMode, onDispose } = {}) {
  const { camera, canvas, scene } = viewer;
  const controls = scene.screenSpaceCameraController;
  const previousInputs = controls.enableInputs, previousSky = scene.skyBox.show;
  controls.enableInputs = false;
  scene.skyBox.show = false;
  camera.lookAtTransform(Matrix4.IDENTITY);
  let dead=false, frame=0, beam=true, pointer=null, last=performance.now(), lastReport=0;
  const initial=Cartesian3.fromDegrees(112,27,17000000);
  const motion=createObserverMotion([initial.x,initial.y,initial.z]);
  const initialPose=observerPose(motion),right=normalize(cross(initialPose.direction,initialPose.up));
  const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
  let gesture={lateral:0,zoom:0,confidence:0},gestureTime=-Infinity;
  const keys=new Set(), aim=new Cartesian2(.4,.47), targetAim=new Cartesian2(.4,.47), center=new Cartesian3(),sunEC=new Cartesian3();
  const sunInertial=normalize(right.map((v,i)=>v*.95+initialPose.up[i]*.38-initialPose.direction[i]*.28));
  const sunWorld=Cartesian3.fromArray(sunInertial),spinRotation=new Matrix3();
  // Keep the sun inertial as well; turning the head must not drag daylight around.
  const removeLight=scene.preRender.addEventListener(()=>{Cartesian3.negate(sunWorld,scene.light.direction);});
  const stars=scene.primitives.add(new PointPrimitiveCollection());
  let seed=7183;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<1500;i++) {
    const z=random()*2-1,azimuth=random()*Math.PI*2,r=Math.sqrt(1-z*z),bright=random();
    stars.add({position:new Cartesian3(r*Math.cos(azimuth)*8e8,r*Math.sin(azimuth)*8e8,z*8e8),pixelSize:bright>.98?2:1,color:new Color(.72,.8,.92,.3+bright*.65)});
  }
  const stage=scene.postProcessStages.add(new PostProcessStage({name:"skyflow-astronaut-beam",fragmentShader:astronautBeamShader,
    uniforms:{earthCenter:()=>center,sunDirection:()=>sunEC,nightTexture:`${import.meta.env.BASE_URL}textures/earth-night.png`,beamAim:()=>aim,beamPower:()=>beam?1:0}}));
  const abort=new AbortController(), options={signal:abort.signal};
  const movementKeys=["w","s","a","d","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"];
  function setMode(value) {
    if(dead||!["free","orbit","hover"].includes(value))return;
    motion.mode=value;keys.clear();motion.travel=0;
    gesture={lateral:0,zoom:0,confidence:0};onMode?.(value);
  }
  function setGestureIntent(intent) {
    if(dead)return;
    gesture=normalizeGestureIntent(intent);
    gestureTime=performance.now();
    if(motion.mode==="hover"&&(gesture.lateral||gesture.zoom)) {
      motion.mode="free";onMode?.("free");
    }
  }
  function aimAt(event) {
    const rect=canvas.getBoundingClientRect();
    targetAim.x=(event.clientX-rect.left)/rect.width;
    targetAim.y=1-(event.clientY-rect.top)/rect.height;
  }
  function pointerDown(event) {
    if(event.button!==0)return;
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY};
    canvas.setPointerCapture(event.pointerId);aimAt(event);
  }
  function pointerMove(event) {
    aimAt(event);
    if(!pointer||pointer.id!==event.pointerId)return;
    const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
    // All modes share the same head-only input, with bounded, damped angular speed.
    turnObserver(motion,-dx*.00085,-dy*.00085);
    pointer.x=event.clientX;pointer.y=event.clientY;
  }
  function pointerUp(event) {
    if(pointer?.id!==event.pointerId)return;
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    pointer=null;
  }
  function move(value) { if(dead)return;if(motion.mode==="hover")setMode("free");queueTravel(motion,value); }
  canvas.addEventListener("pointerdown",pointerDown,options);
  canvas.addEventListener("pointermove",pointerMove,options);
  canvas.addEventListener("pointerup",pointerUp,options);
  canvas.addEventListener("pointercancel",pointerUp,options);
  canvas.addEventListener("lostpointercapture",()=>{pointer=null;},options);
  canvas.addEventListener("wheel",event=>{
    event.preventDefault();
    const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1);
    move(Math.max(-.5,Math.min(.5,-pixels/600)));
  },{...options,passive:false});
  window.addEventListener("keydown",event=>{
    if(event.target.closest?.("input,textarea,select,[contenteditable='true']")||event.metaKey||event.ctrlKey||event.altKey)return;
    if(event.key==="Escape"){setMode("hover");return;}
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(!movementKeys.includes(key))return;
    event.preventDefault();if(motion.mode==="hover")setMode("free");keys.add(key);
  },options);
  window.addEventListener("keyup",event=>keys.delete(event.key.length===1?event.key.toLowerCase():event.key),options);
  const release=()=>{
    keys.clear();motion.travel=0;gesture={lateral:0,zoom:0,confidence:0};
    if(pointer&&canvas.hasPointerCapture(pointer.id))canvas.releasePointerCapture(pointer.id);
    pointer=null;last=performance.now();
  };
  window.addEventListener("blur",release,options);
  document.addEventListener("visibilitychange",release,options);
  function tick(now) {
    if(dead)return;
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if(!document.hidden) {
      const damping=1-Math.exp(-dt*5);
      const forward=(keys.has("w")||keys.has("ArrowUp")?1:0)-(keys.has("s")||keys.has("ArrowDown")?1:0);
      const strafe=(keys.has("d")||keys.has("ArrowRight")?1:0)-(keys.has("a")||keys.has("ArrowLeft")?1:0);
      const fresh=now-gestureTime<HAND_CONTROL.intentGrace;
      stepObserver(motion,dt,{zoom:forward,lateral:strafe,
        gestureZoom:fresh?gesture.zoom:0,gestureLateral:fresh?gesture.lateral:0});
      const pose=observerPose(motion,reducedMotion.matches);
      aim.x+=(targetAim.x-aim.x)*damping;aim.y+=(targetAim.y-aim.y)*damping;
      camera.setView({destination:Cartesian3.fromArray(pose.position),orientation:{direction:Cartesian3.fromArray(pose.direction),up:Cartesian3.fromArray(pose.up)}});
      Matrix3.fromRotationZ(-motion.earthSpinPhase,spinRotation);
      Matrix4.fromRotationTranslation(spinRotation,Cartesian3.ZERO,stars.modelMatrix);
      Cartesian3.fromArray(rotateVector(sunInertial,[0,0,1],-motion.earthSpinPhase),0,sunWorld);
      Matrix4.multiplyByPoint(camera.viewMatrix,Cartesian3.ZERO,center);
      Cartesian3.divideByScalar(center,EARTH_RADIUS,center);
      Matrix4.multiplyByPointAsVector(camera.viewMatrix,sunWorld,sunEC);
      scene.requestRender();
      if(now-lastReport>32){lastReport=now;onPose?.({altitude:Math.round((Math.hypot(...motion.position)-EARTH_RADIUS)/1000),hands:pose.hands});}
    }
    frame=requestAnimationFrame(tick);
  }
  frame=requestAnimationFrame(tick);
  return {setMode,move,setGestureIntent,setBeam(value){beam=value;},recenter(){recenterObserver(motion);},
    dispose(){if(dead)return;dead=true;cancelAnimationFrame(frame);abort.abort();release();removeLight();onDispose?.();if(!viewer.isDestroyed()){controls.enableInputs=previousInputs;scene.skyBox.show=previousSky;scene.postProcessStages.remove(stage);scene.primitives.remove(stars);scene.requestRender();}}
  };
}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function normalize(a){const n=Math.hypot(...a)||1;return a.map(v=>v/n);}
