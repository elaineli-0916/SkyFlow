const RAD = Math.PI / 180;
const EARTH_RADIUS = 6371000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a, b, t) => a + (b - a) * t;

// Fit the actual memories, including the distant BIT campus in Beijing.
// Range is measured from the camera to the ground, not above a floating pin.
export function journeyCityView(stop, memories, aspect = 1.5, fov = Math.PI / 3) {
  const places = [stop, ...memories.filter(m => m.city === stop.city)];
  const latitude = (Math.min(...places.map(p => p.latitude)) + Math.max(...places.map(p => p.latitude))) / 2;
  const longitude = (Math.min(...places.map(p => p.longitude)) + Math.max(...places.map(p => p.longitude))) / 2;
  const radius = Math.max(900, ...places.map(p => Math.hypot(
    (p.latitude - latitude) * RAD * EARTH_RADIUS,
    (p.longitude - longitude) * RAD * EARTH_RADIUS * Math.cos(latitude * RAD)
  )));
  const halfFov = Math.atan(Math.tan(fov / 2) * Math.min(1, aspect));
  const range = Math.max(stop.city === "shanghai" ? 22000 : 4500, radius / Math.sin(halfFov) * 1.6);
  return { latitude, longitude, range, heading: 0, pitch: -Math.PI / 2.65 };
}

function vector(p) {
  return [Math.cos(p.latitude * RAD) * Math.cos(p.longitude * RAD), Math.cos(p.latitude * RAD) * Math.sin(p.longitude * RAD), Math.sin(p.latitude * RAD)];
}

// One continuous ground track with a gradual climb and descent in log range.
// Camera scale changes evenly; the lateral movement never stops at the apex.
export function journeyFlight(from, to) {
  const a = vector(from), b = vector(to);
  const angle = Math.acos(clamp(a.reduce((sum, value, i) => sum + value * b[i], 0), -1, 1));
  const distance = angle * EARTH_RADIUS;
  const peak = Math.max(from.range, to.range, clamp(distance * 1.1, 1500000, 18000000));
  const ascending = from.range < peak * .95;
  const duration = clamp(8 + distance / 2500000, 8, 13);
  return {
    duration,
    sample(value) {
      const t = clamp(value, 0, 1), u = ease(t), sine = Math.sin(angle);
      const p = Math.abs(sine) < 1e-7 ? a.map((v, i) => mix(v, b[i], u)) : a.map((v, i) => (v * Math.sin((1 - u) * angle) + b[i] * Math.sin(u * angle)) / sine);
      const range = !ascending
        ? Math.exp(mix(Math.log(from.range), Math.log(to.range), ease(t)))
        : t < .38
          ? Math.exp(mix(Math.log(from.range), Math.log(peak), ease(t / .38)))
          : Math.exp(mix(Math.log(peak), Math.log(to.range), ease((t - .38) / .62)));
      const headingDelta = Math.atan2(Math.sin(to.heading - from.heading), Math.cos(to.heading - from.heading));
      return { latitude: Math.atan2(p[2], Math.hypot(p[0], p[1])) / RAD, longitude: Math.atan2(p[1], p[0]) / RAD,
        range, heading: from.heading + headingDelta * u, pitch: mix(from.pitch, to.pitch, u) };
    }
  };
}

// A user's explicit close takes precedence over automatic proximity reveal.
export function memoryIsOpen(manual, automatic) { return manual === null ? automatic : manual; }
