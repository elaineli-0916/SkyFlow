import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Globe2, MapPin, Moon, Sun, CloudSun, X, RotateCcw } from "lucide-react";
import CesiumCityCanvas from "./CesiumCityCanvas.jsx";
import LowPolyCityCanvas from "./LowPolyCityCanvas.jsx";
import JourneyExperience from "../journey/JourneyExperience.jsx";
import { CITIES, getCity, cityLocation } from "./cities.js";
import { createCityActionPlan, runActionPlan } from "./cityDirector.js";
import { getEnvironmentSnapshot } from "../services/earthDataService.js";
import "./city.css";
import "./hongKong.css";

export default function CityExperience() {
  const [status, setStatus] = useState({ mode: "loading", message: "正在启动地球…" });
  const [sandboxStatus, setSandboxStatus] = useState(null);
  const [ready, setReady] = useState(false);
  const [cityId, setCityId] = useState(null);
  const [arrived, setArrived] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const [storyExpanded, setStoryExpanded] = useState(false);
  const [narration, setNarration] = useState("同一颗地球，三种抵达的方式。");
  const [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const camera = useRef(null);
  const sandboxCamera = useRef(null);
  const flight = useRef(null);
  const city = getCity(cityId);
  const isSandboxCity = cityId === "hong-kong" && arrived;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(timer); flight.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!city) return;
    let cancelled = false;
    setSnapshot(null);
    const refresh = () => getEnvironmentSnapshot({ location: cityLocation(city) }).then((data) => {
      if (!cancelled) setSnapshot(data);
    }).catch(() => { if (!cancelled) setSnapshot({ status: "unavailable" }); });
    refresh();
    const timer = setInterval(refresh, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [city]);

  async function visit(id) {
    if (!camera.current) return;
    flight.current?.abort();
    const controller = new AbortController();
    flight.current = controller;
    setCityId(id); setArrived(false); setShowPhoto(false); setBusy(true); setSandboxStatus(null); setStoryExpanded(false);
    try {
      // Allow the journey to release its camera before starting the separate
      // city visit, otherwise its unmount cleanup cancels the new flight.
      await new Promise(resolve=>requestAnimationFrame(resolve));
      if(controller.signal.aborted)return;
      await runActionPlan(createCityActionPlan(id), {
        fly_to: (action, context) => camera.current.flyToCity(getCity(action.cityId), { ...context, duration: action.duration }),
        show_overlay: (action) => setArrived(action.visible),
        show_photo: (action) => setShowPhoto(action.visible),
        narrate: (action) => setNarration(action.text)
      }, { signal: controller.signal });
      if (!controller.signal.aborted) { setArrived(true); setShowPhoto(true); }
    } catch { /* Selecting another city cancels the previous camera animation. */ }
    finally { if (flight.current === controller) setBusy(false); }
  }

  async function reset() {
    flight.current?.abort();
    setCityId(null); setArrived(false); setShowPhoto(false); setBusy(false); setSandboxStatus(null); setNarration("同一颗地球，三种抵达的方式。");
    // JourneyExperience restores the overview when it mounts.
  }

  return <main className="city-experience" data-city={cityId ?? "earth"} data-busy={busy} data-sandbox={isSandboxCity} data-journey={!cityId}>
    <CesiumCityCanvas onReady={(value) => { camera.current = value; setReady(Boolean(value)); }} onStatus={setStatus} onCitySelect={visit} />
    {isSandboxCity && <div className="city-sandbox-layer" aria-label="香港风格化城市 3D 沙盘"><LowPolyCityCanvas onReady={(value) => { sandboxCamera.current = value; value?.flyToCity(getCity("hong-kong"), { duration: 1.8 }).then(() => { if (sandboxCamera.current === value) value.startAutoTour?.(); }).catch(() => {}); }} onStatus={setSandboxStatus} onCitySelect={visit} onReturn={reset} /></div>}
    <div className="city-vignette" />
    <header className="city-header">
      <a className="city-brand" href="?view=cities">SkyFlow<span>城市之间，天空之下</span></a>
      <div className="city-header-right">{!cityId?<nav className="journey-city-nav" aria-label="城市探索"><button onClick={()=>visit("hong-kong")} disabled={!ready}>香港沙盘 ↗</button><button onClick={()=>visit("beijing")} disabled={!ready}>北京</button><button onClick={()=>visit("new-york")} disabled={!ready}>纽约</button></nav>:<span className="city-edition">FIELD NOTES / 001</span>}<a href="?view=classic">原版体验 <ArrowUpRight size={14} /></a></div>
    </header>
    {cityId&&<section className="city-intro">
      <div className="city-eyebrow"><span /> AN ATLAS OF MOMENTS</div>
      <h1>{city ? city.name : <>Every city.<br /><em>A different sky.</em></>}</h1>
      <p className="city-intro-copy">{city ? city.subtitle : "从一颗地球，到一座城市。\n跟随镜头，遇见此刻的天空。"}</p>
      <nav className="city-destinations" aria-label="选择城市">
        {CITIES.map((item) => <button key={item.id} onClick={() => visit(item.id)} disabled={!ready} aria-pressed={cityId === item.id}>
          <span className="city-number">{item.number}</span><span><strong>{item.label}</strong><small>{item.name}</small></span><ArrowUpRight size={17} />
        </button>)}
      </nav>
      <div className="city-instruction"><MapPin size={13} /><span>选择城市，或点击地球上的地点</span></div>
    </section>}
    {!cityId&&<JourneyExperience camera={camera.current} onCitySelect={visit}/>}
    <div className="city-provider" role="status"><span className={`city-status-dot ${(sandboxStatus ?? status).mode}`} />{(sandboxStatus ?? status).message}</div>
    {cityId&&<div className="city-map-controls"><button onClick={reset} disabled={!ready} aria-label="返回地球"><Globe2 size={19} /></button>{city && <button onClick={() => visit(city.id)} aria-label="重播城市飞行"><RotateCcw size={17} /></button>}</div>}
    {isSandboxCity && <button className="hk-story-toggle" aria-expanded={storyExpanded} onClick={() => setStoryExpanded(!storyExpanded)}><CloudSun size={16} />{storyExpanded ? "收起此刻" : "此刻 · 天气与照片"}{storyExpanded ? <MinusIcon /> : <ArrowUpRight size={13} />}</button>}
    {city && arrived && (!isSandboxCity || storyExpanded) && <aside className="city-story" aria-label={`${city.label}城市信息`}>
      <div className="city-story-heading"><span>{city.region}</span><MapPin size={14} /></div>
      <h2>{city.landmark}</h2><p>{city.story}</p>
      <div className="city-location-line"><span>{city.latitude.toFixed(4)}° N / {Math.abs(city.longitude).toFixed(4)}° {city.longitude > 0 ? "E" : "W"}</span><time>{formatTime(now, city.timezone)}</time></div>
      <div className="city-weather-grid">
        <Metric icon={<CloudSun size={17} />} label="天气" value={snapshot?.weather && Number.isFinite(snapshot.weather.temperature) ? `${Math.round(snapshot.weather.temperature)}°C` : "—"} note={!snapshot ? "正在读取" : snapshot.weather ? `云量 ${snapshot.weather.cloudCover ?? "—"}%` : "实时数据暂不可用"} />
        <Metric icon={<Moon size={17} />} label="月亮" value={Number.isFinite(snapshot?.moonPhase) ? `${Math.round(snapshot.moonPhase * 100)}%` : "—"} note="照明比例 · 近似计算" />
        <Metric icon={<Sun size={17} />} label="今日日落" value={snapshot?.sunset ? formatTime(new Date(snapshot.sunset), city.timezone) : "—"} note="城市当地时间" />
      </div>
      <div className="city-data-source">天气 / 日落：Open-Meteo · 月相：本地天文模型</div>
      {showPhoto ? <PhotoCard key={city.id} city={city} onClose={() => setShowPhoto(false)} /> : <button className="city-photo-reopen" onClick={() => setShowPhoto(true)}>打开城市照片 <ArrowUpRight size={14} /></button>}
    </aside>}
    {cityId&&<div className="city-bottom"><div className="city-narration" aria-live="polite">{busy ? `正在飞向${city?.label}，让城市慢慢展开…` : narration}</div><div className="city-bottom-meta"><span>SKYFLOW · CITY STORIES</span><span>拖拽旋转 · 滚轮缩放 · Ctrl + 拖拽倾斜</span></div></div>}
  </main>;
}

function Metric({ icon, label, value, note }) {
  return <div className="city-metric"><span>{icon}{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function MinusIcon() { return <span aria-hidden="true">−</span>; }

function PhotoCard({ city, onClose }) {
  const [failed, setFailed] = useState(false);
  return <figure className="city-photo">
    <button className="city-photo-close" onClick={onClose} aria-label="关闭城市照片"><X size={15} /></button>
    {failed ? <div className="city-photo-fallback">照片暂时无法加载</div> : <img src={city.photo.url} alt={city.photo.title} onError={() => setFailed(true)} />}
    <figcaption><div><span>POSTCARD / {city.number}</span><strong>{city.photo.title}</strong></div><a href={city.photo.source} target="_blank" rel="noreferrer">{city.photo.author} ↗</a></figcaption>
    <div className="city-photo-note">城市示例照片 · 非实时影像</div>
  </figure>;
}

function formatTime(date, timeZone) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
}
