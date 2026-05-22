import { useEffect, useMemo, useState } from "react";
import { Activity, Cloud, CloudOff, Grid2X2, LocateFixed, Moon, RotateCcw, SunMedium, Waves } from "lucide-react";
import EarthCanvas from "./components/EarthCanvas.jsx";
import { getEnvironmentSnapshot } from "./services/earthDataService.js";
import { buildNarration } from "./services/narration.js";
import { formatCoordinate, formatDegrees, formatLocalClock, formatMinutes, formatPreciseCoordinate, formatUtcOffset } from "./utils/format.js";

const initialSnapshot = {
  status: "settling",
  locationName: "Local orbit",
  locationSource: "settling",
  latitude: 31.23,
  longitude: 121.47,
  weather: null,
  sunrise: null,
  sunset: null,
  moonPhase: 0.42,
  telemetry: null,
  generatedAt: new Date().toISOString()
};

function App() {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [now, setNow] = useState(() => new Date());
  const [narrationIndex, setNarrationIndex] = useState(0);
  const [showClouds, setShowClouds] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [resetViewSignal, setResetViewSignal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getEnvironmentSnapshot().then((nextSnapshot) => {
      if (!cancelled) {
        setSnapshot(nextSnapshot);
      }
    });

    const refresh = window.setInterval(() => {
      getEnvironmentSnapshot({ preferCachedPosition: true }).then((nextSnapshot) => {
        if (!cancelled) {
          setSnapshot(nextSnapshot);
        }
      });
    }, 1000 * 60 * 12);

    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    const narrationTick = window.setInterval(() => {
      setNarrationIndex((value) => value + 1);
    }, 1000 * 18);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(narrationTick);
    };
  }, []);

  const narration = useMemo(
    () => buildNarration(snapshot, now, narrationIndex),
    [snapshot, now, narrationIndex]
  );

  const nextSunEvent = useMemo(() => {
    const sunrise = snapshot.sunrise ? new Date(snapshot.sunrise) : null;
    const sunset = snapshot.sunset ? new Date(snapshot.sunset) : null;
    const candidates = [sunrise, sunset].filter((date) => date && date > now);
    const next = candidates.sort((a, b) => a - b)[0];

    if (!next) {
      return "tracking horizon";
    }

    return formatMinutes((next.getTime() - now.getTime()) / 60000);
  }, [snapshot.sunrise, snapshot.sunset, now]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-void text-slate-100">
      <EarthCanvas
        snapshot={snapshot}
        now={now}
        showClouds={showClouds}
        showGrid={showGrid}
        resetViewSignal={resetViewSignal}
      />

      <div className="pointer-events-none absolute inset-0 orbital-vignette" />
      <div className="pointer-events-none absolute inset-0 scanline-field" />

      <section className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-start gap-4 px-5 py-5 sm:px-8">
        <div className="glass-strip max-w-[min(520px,calc(100vw-40px))]">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-slate-300/70">
            <Activity size={14} />
            <span>SkyFlow Earth Companion</span>
          </div>
          <p className="mt-3 max-w-[34rem] text-balance font-display text-lg leading-relaxed text-slate-100 sm:text-2xl">
            {narration}
          </p>
        </div>
      </section>

      <div className="orbit-controls absolute right-5 top-24 z-20 sm:right-8 sm:top-24">
        <div className="time-card">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-300/50">
            local time
          </p>
          <p className="mt-1 font-display text-2xl text-slate-50">{formatLocalClock(now, snapshot.longitude)}</p>
          <p className="mt-2 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300/55">
            {snapshot.locationName} / {formatUtcOffset(snapshot.longitude)}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-300/45">
            sun alt {formatDegrees(snapshot.telemetry?.solar?.altitude)} / az {formatDegrees(snapshot.telemetry?.solar?.azimuth)}
          </p>
        </div>
        <button
          className="control-button"
          type="button"
          aria-pressed={showClouds}
          aria-label={showClouds ? "Hide cloud layer" : "Show cloud layer"}
          title={showClouds ? "Hide cloud layer" : "Show cloud layer"}
          onClick={() => setShowClouds((value) => !value)}
        >
          {showClouds ? <Cloud size={17} /> : <CloudOff size={17} />}
          <span>{showClouds ? "clouds on" : "clouds off"}</span>
        </button>
        <button
          className="control-button"
          type="button"
          aria-label="Reset view to current location"
          title="Reset view to current location"
          onClick={() => setResetViewSignal((value) => value + 1)}
        >
          <RotateCcw size={16} />
          <span>reset view</span>
        </button>
        <button
          className="control-button"
          type="button"
          aria-pressed={showGrid}
          aria-label={showGrid ? "Hide globe reference grid" : "Show globe reference grid"}
          title={showGrid ? "Hide globe reference grid" : "Show globe reference grid"}
          onClick={() => setShowGrid((value) => !value)}
        >
          <Grid2X2 size={16} />
          <span>{showGrid ? "grid on" : "grid off"}</span>
        </button>
      </div>

      <section className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 px-5 pb-5 sm:px-8 sm:pb-8">
        <div className="mb-3 flex max-w-[980px] flex-wrap items-center gap-2">
          <div className="geo-chip">
            <LocateFixed size={14} />
            <span>{snapshot.locationSource === "browser" ? "geo lock" : "fallback orbit"}</span>
            <strong>{formatPreciseCoordinate(snapshot.latitude, snapshot.longitude)}</strong>
          </div>
          <div className="geo-chip subtle">
            <span>{snapshot.status === "live" ? "open-meteo live" : "local earth model"}</span>
          </div>
          <div className="geo-chip subtle">
            <SunMedium size={14} />
            <span>sun {formatDegrees(snapshot.telemetry?.solar?.azimuth)}</span>
          </div>
          <div className="geo-chip subtle">
            <Moon size={14} />
            <span>moon {formatDegrees(snapshot.telemetry?.lunar?.azimuth)}</span>
          </div>
        </div>
        <div className="ambient-console">
          <StatusCell
            icon={<LocateFixed size={16} />}
            label={snapshot.locationName}
            value={`${formatCoordinate(snapshot.latitude, "lat")}  ${formatCoordinate(snapshot.longitude, "lon")}`}
          />
          <StatusCell
            icon={<SunMedium size={16} />}
            label="next light shift"
            value={nextSunEvent}
          />
          <StatusCell
            icon={<Moon size={16} />}
            label="moon phase"
            value={`${Math.round(snapshot.moonPhase * 100)}% lit`}
          />
          <StatusCell
            icon={<Waves size={16} />}
            label="surface weather"
            value={snapshot.weather?.summary ?? "quiet telemetry"}
          />
        </div>
      </section>
    </main>
  );
}

function StatusCell({ icon, label, value }) {
  return (
    <div className="status-cell">
      <div className="flex items-center gap-2 text-slate-300/55">
        {icon}
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="mt-2 truncate font-display text-sm text-slate-100 sm:text-base">{value}</p>
    </div>
  );
}

export default App;
