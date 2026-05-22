import * as THREE from "three";

export function getSunDirection(date) {
  return getSubsolarDirection(date);
}

export function getSubsolarPoint(date) {
  const dayMs = 24 * 60 * 60 * 1000;
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = (date.getTime() - yearStart) / dayMs;
  const declination = 23.44 * Math.sin(((dayOfYear - 81) / 365.25) * Math.PI * 2);
  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 +
    date.getUTCMilliseconds() / 3600000;
  const longitude = normalizeLongitude(180 - utcHours * 15);

  return {
    latitude: declination,
    longitude
  };
}

export function getSubsolarDirection(date) {
  const point = getSubsolarPoint(date);
  return latLonToVector3(point.latitude, point.longitude).normalize();
}

export function getMoonPhase(date) {
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const lunarCycle = 29.530588853;
  const days = (date.getTime() - knownNewMoon) / 86400000;
  const phase = ((days % lunarCycle) + lunarCycle) % lunarCycle;
  return 0.5 - 0.5 * Math.cos((phase / lunarCycle) * Math.PI * 2);
}

export function isNightAtLocation(date, longitude) {
  const localHour = (date.getUTCHours() + longitude / 15 + 24) % 24;
  return localHour < 6 || localHour > 18.5;
}

export function getSolarPosition(date, latitude, longitude) {
  const subsolar = getSubsolarPoint(date);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const localHour = (utcHours + longitude / 15 + 24) % 24;
  const declination = subsolar.latitude;
  const hourAngle = (localHour - 12) * 15;
  const latRad = THREE.MathUtils.degToRad(latitude);
  const decRad = THREE.MathUtils.degToRad(declination);
  const hourRad = THREE.MathUtils.degToRad(hourAngle);

  const altitude = Math.asin(
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourRad)
  );

  const azimuth = Math.atan2(
    -Math.sin(hourRad),
    Math.tan(decRad) * Math.cos(latRad) - Math.sin(latRad) * Math.cos(hourRad)
  );

  return {
    altitude: THREE.MathUtils.radToDeg(altitude),
    azimuth: (THREE.MathUtils.radToDeg(azimuth) + 360) % 360
  };
}

export function getApproxMoonPosition(date, latitude, longitude) {
  const phaseAngle = getMoonPhase(date) * Math.PI * 2;
  const solar = getSolarPosition(date, latitude, longitude);

  return {
    altitude: clamp(solar.altitude * -0.65 + Math.sin(phaseAngle) * 24, -72, 72),
    azimuth: (solar.azimuth + 180 + Math.cos(phaseAngle) * 38 + 360) % 360
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function latLonToVector3(lat, lon) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  );
}

function normalizeLongitude(longitude) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}
