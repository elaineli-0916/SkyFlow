import { Cartesian2, Cartesian3, Cartographic, HeadingPitchRange, Matrix4, Math as CesiumMath } from "cesium";
import { journeyCityView, journeyFlight } from "./journeyCamera.js";

export function createJourneyCamera(viewer) {
  let frame = 0, rejectFlight = null, removeAbort = null, dead = false;
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function stop() {
    cancelAnimationFrame(frame); frame = 0;
    removeAbort?.(); removeAbort = null;
    const reject = rejectFlight; rejectFlight = null;
    reject?.(new DOMException("Camera interrupted", "AbortError"));
    if (!dead) {
      viewer.camera.cancelFlight();
      viewer.scene.screenSpaceCameraController.enableInputs = true;
      viewer.scene.requestRender();
    }
  }
  function currentView() {
    const camera = viewer.camera;
    const hit = camera.pickEllipsoid(new Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2));
    const p = hit ? Cartographic.fromCartesian(hit) : camera.positionCartographic;
    return { latitude: CesiumMath.toDegrees(p.latitude), longitude: CesiumMath.toDegrees(p.longitude),
      range: hit ? Cartesian3.distance(camera.positionWC, hit) : Math.max(2000, p.height), heading: camera.heading, pitch: camera.pitch };
  }
  function apply(view) {
    viewer.camera.lookAt(Cartesian3.fromDegrees(view.longitude, view.latitude), new HeadingPitchRange(view.heading, view.pitch, view.range));
    // Release the local lookAt frame after every update so normal globe
    // dragging/zooming is never locked to the tour's last target.
    viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    viewer.scene.requestRender();
  }
  function fly(to, { signal, duration, onProgress } = {}) {
    stop();
    if (dead || signal?.aborted) return Promise.reject(new DOMException("Camera interrupted", "AbortError"));
    const path = journeyFlight(currentView(), to);
    const seconds = reducedMotion() ? 0 : duration ?? path.duration;
    return new Promise((resolve, reject) => {
      rejectFlight = reject;
      removeAbort = () => signal?.removeEventListener("abort", stop);
      signal?.addEventListener("abort", stop, { once: true });
      const start = performance.now();
      function tick(now) {
        const progress = seconds ? Math.min(1, (now - start) / (seconds * 1000)) : 1;
        apply(path.sample(progress)); onProgress?.(progress);
        if (progress < 1) frame = requestAnimationFrame(tick);
        else { frame = 0; rejectFlight = null; removeAbort?.(); removeAbort = null; resolve(); }
      }
      frame = requestAnimationFrame(tick);
    });
  }
  function drift(space = false) {
    stop();
    if (dead || reducedMotion()) return;
    const startView = currentView(), start = performance.now();
    function tick(now) {
      const seconds = (now - start) / 1000;
      apply(space
        ? { ...startView, longitude: startView.longitude + seconds * .7 }
        : { ...startView, heading: startView.heading + seconds * .008, range: startView.range * (1 - .035 * Math.min(1, seconds / 20)) });
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  return {
    flyToJourneyStop: (stop, { memories = [], ...options } = {}) => fly(journeyCityView(stop, memories, viewer.canvas.clientWidth / viewer.canvas.clientHeight, viewer.camera.frustum.fovy), options),
    journeyOverview: ({ ending = false, ...options } = {}) => fly({ longitude: ending ? 155 : 112, latitude: ending ? 65 : 32, range: 20500000, heading: 0, pitch: -Math.PI / 2 }, options),
    startJourneyDrift: drift,
    stopJourneyMotion: stop,
    dispose() { stop(); dead = true; }
  };
}
