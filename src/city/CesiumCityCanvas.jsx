import { useEffect, useRef } from "react";
import {
  Viewer, Ion, Cartesian3, Color, Cesium3DTileset, SingleTileImageryProvider,
  UrlTemplateImageryProvider, Credit, Math as CesiumMath, buildModuleUrl,
  BoundingSphere, HeadingPitchRange, Cartesian2, ScreenSpaceEventType, LabelStyle, DirectionalLight
} from "cesium";
import { CITIES } from "./cities.js";
import { createJourneyLayer } from "../journey/createJourneyLayer.js";
import { createJourneyCamera } from "../journey/createJourneyCamera.js";
import { createAstronautController } from "../astronaut/createAstronautController.js";
import "cesium/Build/Cesium/Widgets/widgets.css";

export default function CesiumCityCanvas({ onReady, onStatus, onCitySelect }) {
  const container = useRef(null);
  const callbacks = useRef({ onReady, onStatus, onCitySelect });
  callbacks.current = { onReady, onStatus, onCitySelect };

  useEffect(() => {
    let disposed = false;
    let viewer;
    let satelliteLayer;
    let astronaut, cloudLayer;
    const abort = new AbortController();
    const status = (value) => { if (!disposed) callbacks.current.onStatus(value); };
    buildModuleUrl.setBaseUrl(`${import.meta.env.BASE_URL}cesium/`);
    Ion.defaultAccessToken = "";
    try {
      viewer = new Viewer(container.current, {
        animation: false, timeline: false, baseLayer: false, baseLayerPicker: false,
        geocoder: false, homeButton: false, sceneModePicker: false,
        navigationHelpButton: false, fullscreenButton: false, infoBox: false,
        selectionIndicator: false, requestRenderMode: true, maximumRenderTimeChange: Infinity,
        showRenderLoopErrors: false, msaaSamples: 1
      });
    } catch {
      status({ mode: "error", message: "无法启动 3D 画面。请启用 WebGL，或返回原版体验。" });
      return () => { disposed = true; abort.abort(); };
    }
    viewer.scene.backgroundColor = Color.fromCssColorString("#060c12");
    viewer.scene.globe.baseColor = Color.fromCssColorString("#203c49");
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.dynamicAtmosphereLighting = false;
    viewer.scene.globe.maximumScreenSpaceError = 1.5;
    viewer.scene.globe.tileCacheSize = 180;
    viewer.scene.skyBox.show = false;
    viewer.scene.light = new DirectionalLight({direction:new Cartesian3(1,0,0)});
    // A restrained rim and soft side light make the globe read as a volume.
    // Lighting fades out at city scale so satellite photos remain readable.
    const lightDirection=new Cartesian3();
    const removeLight=viewer.scene.preRender.addEventListener(()=>{
      Cartesian3.add(viewer.camera.directionWC,Cartesian3.multiplyByScalar(viewer.camera.rightWC,.8,lightDirection),lightDirection);
      Cartesian3.add(lightDirection,Cartesian3.multiplyByScalar(viewer.camera.upWC,-.45,new Cartesian3()),lightDirection);
      Cartesian3.normalize(lightDirection,viewer.scene.light.direction);
      if(satelliteLayer)satelliteLayer.alpha=CesiumMath.clamp((6000000-viewer.camera.positionCartographic.height)/4500000,0,1);
    });
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 150;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 30000000;
    viewer.camera.setView({ destination: Cartesian3.fromDegrees(112, 22, 22000000) });
    viewer.scene.renderError.addEventListener(() => status({ mode: "error", message: "3D 渲染中断，请刷新页面或返回原版体验。" }));
    for (const city of CITIES) {
      viewer.entities.add({
        id: city.id, position: Cartesian3.fromDegrees(city.longitude, city.latitude, 100),
        point: { pixelSize: 10, color: Color.fromCssColorString("#d1ebaa"), outlineColor: Color.fromCssColorString("#21362d"), outlineWidth: 3, disableDepthTestDistance: 1000000 },
        label: { text: `${city.label} / ${city.landmark}`, font: "13px sans-serif", fillColor: Color.WHITE,
          style: LabelStyle.FILL_AND_OUTLINE, outlineColor: Color.fromCssColorString("#09151c"), outlineWidth: 4,
          pixelOffset: new Cartesian2(0, -25), disableDepthTestDistance: 1000000 }
      });
    }
    viewer.screenSpaceEventHandler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      const city = CITIES.find((item) => item.id === picked?.id?.id);
      if (city) callbacks.current.onCitySelect?.(city.id);
    }, ScreenSpaceEventType.LEFT_CLICK);
    viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    const journeyCamera = createJourneyCamera(viewer);
    function leaveAstronaut() {
      astronaut?.dispose();astronaut=null;
      if(cloudLayer)cloudLayer.show=false;
    }

    function animate(options, signal, boundingSphere) {
      return new Promise((resolve, reject) => {
        if (signal?.aborted || disposed) { reject(new DOMException("Flight cancelled", "AbortError")); return; }
        leaveAstronaut();
        journeyCamera.stopJourneyMotion();
        let settled = false;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener("abort", cancel);
          viewer.scene.screenSpaceCameraController.enableInputs = true;
          viewer.scene.requestRender();
          if (error) reject(error); else resolve();
        };
        const cancel = () => { viewer.camera.cancelFlight(); finish(new DOMException("Flight cancelled", "AbortError")); };
        signal?.addEventListener("abort", cancel, { once: true });
        const flight = { ...options, complete: () => finish(), cancel: () => finish(new DOMException("Flight cancelled", "AbortError")) };
        if (boundingSphere) viewer.camera.flyToBoundingSphere(boundingSphere, flight);
        else viewer.camera.flyTo(flight);
      });
    }
    callbacks.current.onReady({
      ...journeyCamera,
      enterAstronaut: (options) => {
        journeyCamera.stopJourneyMotion();leaveAstronaut();
        astronaut=createAstronautController(viewer,options);
        if(cloudLayer)cloudLayer.show=true;
        return astronaut;
      },
      leaveAstronaut,
      installJourney:(memories,callbacks)=>createJourneyLayer(viewer,memories,callbacks),
      flyToCity: (city, { signal, duration = 4 } = {}) => animate({
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration,
        offset: new HeadingPitchRange(CesiumMath.toRadians(city.heading), CesiumMath.toRadians(city.pitch), city.range)
      }, signal, new BoundingSphere(Cartesian3.fromDegrees(city.longitude, city.latitude, 60), 100)),
      reset: (signal) => animate({ destination: Cartesian3.fromDegrees(112, 22, 22000000), duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 2 }, signal),
      cancel: () => journeyCamera.stopJourneyMotion()
    });

    async function initializeLayers() {
      try {
        const local = await SingleTileImageryProvider.fromUrl(`${import.meta.env.BASE_URL}textures/earth-day.jpg`);
        if (disposed) return;
        viewer.imageryLayers.addImageryProvider(local);
        viewer.scene.requestRender();
      } catch { /* The colored ellipsoid remains usable if the local texture is unavailable. */ }
      // This local cloud image is visual atmosphere for the opening only;
      // satellite closeups and the existing weather data stay independent.
      SingleTileImageryProvider.fromUrl(`${import.meta.env.BASE_URL}textures/earth-clouds.png`).then(provider=>{
        if(disposed)return;
        cloudLayer=viewer.imageryLayers.addImageryProvider(provider);
        cloudLayer.alpha=.58;cloudLayer.show=Boolean(astronaut);viewer.scene.requestRender();
      }).catch(()=>{});
      try {
        const response = await fetch("/api/maps/config", { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(5000)]) });
        if (!response.ok) throw new Error("API unavailable");
        const config = await response.json();
        if (disposed) return;
        if (!config.googleTilesConfigured) {
          fallback("未连接 Google 城市实景");
          return;
        }
        status({ mode: "loading", message: "正在连接 Google 3D Tiles…" });
        const tileset = await Cesium3DTileset.fromUrl("/api/maps/tiles", {
          showCreditsOnScreen: true, maximumScreenSpaceError: 12,
          cacheBytes: 256 * 1024 * 1024, maximumCacheOverflowBytes: 128 * 1024 * 1024
        });
        if (disposed) { tileset.destroy(); return; }
        viewer.scene.primitives.add(tileset);
        viewer.scene.globe.show = false;
        viewer.creditDisplay.addStaticCredit(new Credit("Google Maps", true));
        tileset.tileFailed.addEventListener(() => {
          status({ mode: "degraded", message: "部分实景瓦片加载失败 · 可刷新重试" });
        });
        status({ mode: "google", message: "Google 3D Tiles · 建筑细节取决于当地覆盖" });
        viewer.scene.requestRender();
      } catch {
        if (!disposed) fallback("城市实景暂不可用");
      }
    }

    function fallback(reason) {
      const imagery = new UrlTemplateImageryProvider({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maximumLevel: 19,
        credit: new Credit("Esri, Maxar, Earthstar Geographics, and the GIS User Community", true)
      });
      const layer = viewer.imageryLayers.addImageryProvider(imagery);
      satelliteLayer=layer;
      layer.alpha=CesiumMath.clamp((6000000-viewer.camera.positionCartographic.height)/4500000,0,1);
      imagery.errorEvent.addEventListener((error) => {
        if (disposed || !layer.show) return;
        // One failed tile must not remove every high-resolution tile already
        // loaded. Retry locally and retain the useful imagery around it.
        error.retry = error.timesRetried < 2;
        if (!error.retry) status({ mode: "degraded", message: "部分卫星影像暂未载入 · 已保留可用影像" });
        viewer.scene.requestRender();
      });
      status({ mode: "satellite", message: `${reason} · 卫星影像模式（非 3D 建筑）` });
      viewer.scene.requestRender();
    }
    initializeLayers();
    return () => {
      disposed = true;
      abort.abort();
      leaveAstronaut();
      journeyCamera.dispose();
      removeLight();
      callbacks.current.onReady(null);
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  return <div ref={container} className="city-canvas" aria-label="可拖拽和缩放的 Cesium 3D 地球" />;
}
