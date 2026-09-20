const STOP = Object.freeze({ lateral: 0, zoom: 0, confidence: 0 });
export const HAND_CONTROL = Object.freeze({
  detectionConfidence: .35, presenceConfidence: .35, trackingConfidence: .35,
  minConfidence: .35, frameInterval: 50, poseHold: 80, lossGrace: 260,
  intentGrace: 650, staleFrame: 900,
  motionWindow: 120, deadSpeed: .015, fullSpeed: .32,
});
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const distance = (a, b) => Math.hypot(a.x-b.x, a.y-b.y, (a.z||0)-(b.z||0));
const vector = (a, b) => [b.x-a.x, b.y-a.y, (b.z||0)-(a.z||0)];
const cosine = (a, b) => a.reduce((sum,v,i)=>sum+v*b[i],0)/(Math.hypot(...a)*Math.hypot(...b)||1);
const validPoints = points => points?.length === 21 && points.every(p =>
  Number.isFinite(p.x) && Number.isFinite(p.y) && (p.z == null || Number.isFinite(p.z)));

// Joint angles and palm-relative distances work for either hand and rotated palms.
export function measureHandPose(points) {
  const unknown={shape:"unknown",zoom:0};
  if (!validPoints(points)) return unknown;
  const scale = distance(points[0],points[9]);
  if (scale < 1e-5) return unknown;
  let extended = 0, curled = 0, openness = 0, closure = 0;
  for (const base of [5,9,13,17]) {
    const alignment = cosine(vector(points[base],points[base+1]),vector(points[base+1],points[base+3]));
    const tip = distance(points[0],points[base+3]), joint = distance(points[0],points[base+1]);
    if (alignment > .55 && tip > joint*1.08) extended++;
    if (alignment < .3 || tip < joint*1.05) curled++;
    openness += clamp((tip/(joint||1)-1.02)/.35,0,1)*clamp((alignment-.2)/.55,0,1);
    closure += Math.max(clamp((.9-tip/(joint||1))/.3,0,1),clamp((.3-alignment)/.8,0,1));
  }
  // A slightly bent finger or tucked thumb no longer cancels an otherwise clear pose.
  if (extended >= 3) return {shape:"open",zoom:clamp(openness/4,.35,1)};
  if (extended === 0 && curled >= 3) return {shape:"fist",zoom:-clamp(closure/4,.35,1)};
  return unknown;
}
export function classifyHand(points) {return measureHandPose(points).shape;}

// Mirrored-preview coordinates: hands to the user's left -> observer to the right.
// Delta is a fraction of preview width. Preserve magnitude all the way to the camera.
export function lateralFromMirroredMotion(delta, duration) {
  if (!Number.isFinite(delta) || !(duration >= .04 && duration <= .3) || Math.abs(delta)<.004) return 0;
  const speed=Math.abs(delta/duration);
  return -Math.sign(delta)*clamp((speed-HAND_CONTROL.deadSpeed)/(HAND_CONTROL.fullSpeed-HAND_CONTROL.deadSpeed),0,1);
}

export function normalizeGestureIntent(intent) {
  if (!Number.isFinite(intent?.confidence) || intent.confidence<HAND_CONTROL.minConfidence) return {...STOP};
  const axis=value=>Number.isFinite(value)?clamp(value,-1,1):0;
  return {lateral:axis(intent.lateral),zoom:axis(intent.zoom),confidence:clamp(intent.confidence,0,1)};
}

export function createHandGestureFilter() {
  let history = [], previousTime = null, pose = "unknown", poseSince = 0;
  let tracked=null, lastSeen=-Infinity, lastSweep=-Infinity, lastIntent={...STOP};
  function reset() {
    history = []; previousTime = null; pose = "unknown"; poseSince = 0;
    tracked=null;lastSeen=-Infinity;lastSweep=-Infinity;lastIntent={...STOP};
    return { ...STOP };
  }
  return {
    reset,
    update(result, now) {
      if (!Number.isFinite(now) || (previousTime!==null && now<=previousTime)) return reset();
      previousTime=now;
      // Model detection/presence/tracking use .5. The exposed score describes
      // handedness, so a left/right label flip must not discard a valid palm track.
      const hands = (result?.landmarks||[]).map((points,i) => ({
        points, shape: result.worldLandmarks?.[i] || points,
        score: result.handedness?.[i]?.[0]?.score || 0,
      })).filter(h=>validPoints(h.points)).map(h=>({...h,
        // Handedness is a left/right classification score, not detection
        // confidence. Valid landmarks already passed MediaPipe's thresholds.
        score:Math.max(h.score,HAND_CONTROL.minConfidence),
        center:{x:1-[0,5,9,17].reduce((sum,i)=>sum+h.points[i].x,0)/4,
          y:[0,5,9,17].reduce((sum,i)=>sum+h.points[i].y,0)/4},
      }));
      if (!hands.length) {
        const age=now-lastSeen;
        if (age>=HAND_CONTROL.lossGrace) return reset();
        const decay=Math.exp(-age/90);
        return {...lastIntent,lateral:lastIntent.lateral*decay,zoom:lastIntent.zoom*decay};
      }
      // One active hand: follow the nearest palm, not detection array order or label.
      // A second hand can enter without interrupting or doubling the current command.
      hands.sort((a,b)=>tracked ? distance(a.center,tracked)-distance(b.center,tracked) : b.score-a.score);
      const hand=hands[0],previous=history.at(-1),gap=now-lastSeen;
      const acquired=!tracked || gap>=HAND_CONTROL.lossGrace || distance(hand.center,tracked)>.2;
      if (acquired) {history=[];pose="unknown";lastSweep=-Infinity;}
      const blend=acquired?1:1-Math.exp(-gap/45);
      const x=acquired?hand.center.x:previous.x+(hand.center.x-previous.x)*blend;
      history.push({time:now,x});
      while(history.length>2 && now-history[1].time>=HAND_CONTROL.motionWindow)history.shift();
      tracked=hand.center;lastSeen=now;
      const first = history[0];
      const sweep=lateralFromMirroredMotion(x-first.x,(now-first.time)/1000);
      if (sweep) lastSweep=now;
      const currentPose=measureHandPose(hand.shape);
      if (pose!==currentPose.shape) {pose=currentPose.shape;poseSince=now;}
      const zoom=!sweep && now-lastSweep>=120 && now-poseSince>=HAND_CONTROL.poseHold ? currentPose.zoom : 0;
      lastIntent={lateral:sweep,zoom,confidence:hand.score};
      return {...lastIntent};
    },
  };
}
