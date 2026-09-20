// Metres. Keep the observer outside the atmosphere and within the local scene.
export const EARTH_RADIUS = 6378137;
export const MIN_RADIUS = EARTH_RADIUS + 2800000;
export const MAX_RADIUS = EARTH_RADIUS + 42000000;

export function clampPosition(position) {
  const length = Math.hypot(...position);
  if (!Number.isFinite(length) || length < 1) return [0, 0, MIN_RADIUS];
  const radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, length));
  return position.map(value => value * radius / length);
}

export function moveObserver(position, direction, distance) {
  const length = Math.hypot(...direction);
  if (!Number.isFinite(distance) || length < 1e-8) return [...position];
  const ray=direction.map(value=>value/length*Math.sign(distance));
  let step=Math.abs(distance);
  const b=position.reduce((sum,value,i)=>sum+value*ray[i],0);
  const c=position.reduce((sum,value)=>sum+value*value,0)-MIN_RADIUS*MIN_RADIUS;
  const discriminant=b*b-c;
  if(b<0&&discriminant>=0)step=Math.min(step,Math.max(0,-b-Math.sqrt(discriminant)));
  return clampPosition(position.map((value, i) => value + ray[i]*step));
}

export function rotateVector(vector, axis, angle) {
  const norm = Math.hypot(...axis);
  if (norm < 1e-8) return [...vector];
  const [x, y, z] = axis.map(value => value / norm), [a, b, c] = vector;
  const cos = Math.cos(angle), sin = Math.sin(angle), dot = x*a + y*b + z*c;
  return [a*cos + (y*c-z*b)*sin + x*dot*(1-cos),
    b*cos + (z*a-x*c)*sin + y*dot*(1-cos),
    c*cos + (x*b-y*a)*sin + z*dot*(1-cos)];
}

export const MOTION = Object.freeze({
  earthSpinSpeed: .0025, orbitSpeed: 65000, maxSpeed: 300000,
  gestureOrbitSpeed: 28*Math.PI/180, gestureZoomRate: .36, gestureResponse: 14,
  maxLookSpeed: .42, maxYaw: 1.2, maxPitch: .65,
  breathHeight: 60, breathPitch: .0009, breathRoll: .0005,
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = value => Number.isFinite(value) ? value : 0;
const unit = vector => vector.map(value => value / (Math.hypot(...vector) || 1));
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

// Body position lives in an inertial frame. Looking around never writes to it.
export function createObserverMotion(position) {
  const safe = clampPosition(position);
  const forward = unit(safe.map(value => -value));
  const pole = Math.abs(forward[2]) > .98 ? [0, 1, 0] : [0, 0, 1];
  return {
    position: safe, up: unit(cross(cross(forward, pole), forward)),
    mode: "free", time: 0, earthSpinPhase: 0,
    lookYaw: 0, lookPitch: 0, targetYaw: 0, targetPitch: 0,
    yawVelocity: 0, pitchVelocity: 0, lateralVelocity: 0, zoomVelocity: 0,
    orbitVelocity: 0, travel: 0, gestureAngularVelocity: 0, gestureZoomRate: 0,
  };
}

export function turnObserver(state, yaw, pitch) {
  state.targetYaw = clamp(state.targetYaw + finite(yaw), -MOTION.maxYaw, MOTION.maxYaw);
  state.targetPitch = clamp(state.targetPitch + finite(pitch), -MOTION.maxPitch, MOTION.maxPitch);
}

export function recenterObserver(state) {
  state.targetYaw = 0;
  state.targetPitch = 0;
}

export function queueTravel(state, amount) {
  state.travel = clamp(state.travel + finite(amount) * 450000, -900000, 900000);
}

// A lightly damped head settles with a small rebound; both rate and range are bounded.
function stepLook(value, velocity, target, dt, limit) {
  velocity = clamp(velocity + ((target-value)*49 - velocity*11.5)*dt,
    -MOTION.maxLookSpeed, MOTION.maxLookSpeed);
  const next = clamp(value + velocity*dt, -limit, limit);
  return [next, Math.abs(next) === limit ? 0 : velocity];
}

export function stepObserver(state, elapsed, { lateral = 0, zoom = 0, gestureLateral = 0, gestureZoom = 0 } = {}) {
  // No large catch-up step after a hidden tab, slow inference or a suspended frame.
  const dt = clamp(finite(elapsed), 0, .05);
  state.time += dt;
  state.earthSpinPhase = (state.earthSpinPhase + MOTION.earthSpinSpeed*dt) % (Math.PI*2);
  [state.lookYaw, state.yawVelocity] = stepLook(state.lookYaw, state.yawVelocity, state.targetYaw, dt, MOTION.maxYaw);
  [state.lookPitch, state.pitchVelocity] = stepLook(state.lookPitch, state.pitchVelocity, state.targetPitch, dt, MOTION.maxPitch);

  const blend = 1 - Math.exp(-dt*3.2);
  const orbitTarget = state.mode === "orbit" ? MOTION.orbitSpeed : 0;
  state.orbitVelocity += (orbitTarget-state.orbitVelocity)*blend;
  let lateralTarget = clamp(finite(lateral), -1, 1)*MOTION.maxSpeed*.6;
  let zoomTarget = clamp(finite(zoom) + state.travel/400000, -1, 1)*MOTION.maxSpeed;
  const magnitude = Math.hypot(lateralTarget, zoomTarget);
  if (magnitude > MOTION.maxSpeed) {
    lateralTarget *= MOTION.maxSpeed/magnitude;
    zoomTarget *= MOTION.maxSpeed/magnitude;
  }
  state.travel *= Math.exp(-dt*1.8);
  state.lateralVelocity += (lateralTarget-state.lateralVelocity)*blend;
  state.zoomVelocity += (zoomTarget-state.zoomVelocity)*blend;
  const tangent = state.lateralVelocity + state.orbitVelocity;
  const speedScale = Math.min(1, MOTION.maxSpeed/(Math.hypot(tangent,state.zoomVelocity)||1));
  const gestureBlend = 1-Math.exp(-dt*MOTION.gestureResponse);
  state.gestureAngularVelocity += (clamp(finite(gestureLateral),-1,1)*MOTION.gestureOrbitSpeed-state.gestureAngularVelocity)*gestureBlend;
  state.gestureZoomRate += (clamp(finite(gestureZoom),-1,1)*MOTION.gestureZoomRate-state.gestureZoomRate)*gestureBlend;
  const oldRadius = Math.hypot(...state.position);
  const manualRadius = clamp(oldRadius-state.zoomVelocity*speedScale*dt, MIN_RADIUS, MAX_RADIUS);
  // Projected sphere size is proportional to R / sqrt(r²-R²). Exponentially
  // changing that size gives the same zoom feel at every distance. At full input,
  // k=.15/s yields ~1.5x in 3 s including the 100 ms pose hold and acceleration.
  const nextRadius = state.gestureZoomRate === 0 ? manualRadius : Math.sqrt(EARTH_RADIUS**2 +
    (manualRadius**2-EARTH_RADIUS**2)*Math.exp(-2*state.gestureZoomRate*dt));
  const radius = clamp(nextRadius, MIN_RADIUS, MAX_RADIUS);
  if (radius === MIN_RADIUS || radius === MAX_RADIUS) { state.zoomVelocity = 0; state.travel = 0; state.gestureZoomRate = 0; }
  const angularVelocity = clamp(tangent*speedScale/oldRadius+state.gestureAngularVelocity,-MOTION.gestureOrbitSpeed,MOTION.gestureOrbitSpeed);
  const angle = angularVelocity*dt;
  if (angle || radius !== oldRadius) {
    state.position = rotateVector(state.position, state.up, angle).map(value => value*radius/oldRadius);
  }
  return observerPose(state);
}

export function observerPose(state, reducedMotion = false) {
  const breathing = reducedMotion ? 0 : Math.sin(state.time*Math.PI*2/5.4);
  const breathOffset = breathing*MOTION.breathHeight;
  const forward = unit(state.position.map(value => -value));
  let direction = rotateVector(forward, state.up, state.lookYaw);
  const right = unit(cross(direction, state.up));
  direction = rotateVector(direction, right, state.lookPitch + breathing*MOTION.breathPitch);
  let up = unit(cross(right, direction));
  up = rotateVector(up, direction, breathing*MOTION.breathRoll);
  const position = state.position.map((value, i) => value + state.up[i]*breathOffset);

  // Cesium's globe is Earth-fixed. Express the inertial observer in the rotating
  // Earth frame; counter-rotate stars and sunlight by the same phase in the renderer.
  const earthFixed = vector => rotateVector(vector, [0, 0, 1], -state.earthSpinPhase);
  const handTravel = clamp(state.zoomVelocity/MOTION.maxSpeed+state.gestureZoomRate/MOTION.gestureZoomRate,-1,1);
  const handLateral = clamp(state.lateralVelocity/MOTION.maxSpeed+state.gestureAngularVelocity/MOTION.gestureOrbitSpeed,-1,1);
  return {
    position: earthFixed(position), direction: earthFixed(direction), up: earthFixed(up),
    breathOffset,
    hands: {
      x: reducedMotion ? 0 : clamp(-state.yawVelocity*12 + Math.sin(state.time*.73)*.65 - handLateral*2, -7, 7),
      y: reducedMotion ? 0 : clamp(breathing*2.4 + state.pitchVelocity*9, -6.5, 6.5),
      roll: reducedMotion ? 0 : clamp(-state.yawVelocity*.65 + breathing*.12, -.45, .45),
      scale: reducedMotion ? 1 : 1 + breathing*.0015 + handTravel*.003,
    },
  };
}
