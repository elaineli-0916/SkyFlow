import { useEffect, useMemo, useState } from "react";
import { Cloud, CloudOff, Eye, Grid2X2, LocateFixed, MessageCircle, Moon, RotateCcw, Sparkles, SunMedium, Telescope, Waves } from "lucide-react";
import EarthCanvas from "./components/EarthCanvas.jsx";
import EarthCommandInput from "./components/EarthCommandInput.jsx";
import EarthConversationLog from "./components/EarthConversationLog.jsx";
import LookUpPanel from "./components/LookUpPanel.jsx";
import SoundscapeToggle from "./components/SoundscapeToggle.jsx";
import { getEnvironmentSnapshot } from "./services/earthDataService.js";
import { resolveEarthCommand } from "./services/earthCommandService.js";
import { PHOTO_MEMORY_MARKERS } from "./services/photoMemoryService.js";
import { buildNarration } from "./services/narration.js";
import { useLookUpMode } from "./hooks/useLookUpMode.js";
import { useSoundscape } from "./hooks/useSoundscape.js";
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
  const [visualCommand, setVisualCommand] = useState(null);
  const [commandResponse, setCommandResponse] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [conversationTurns, setConversationTurns] = useState([]);
  const [mode, setMode] = useState("companion");
  const lookUp = useLookUpMode(snapshot, now);
  const soundscape = useSoundscape(snapshot, lookUp.enabled, now);

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

  const readouts = useMemo(() => {
    const localTime = compactClock(formatLocalClock(now, snapshot.longitude));
    const moonAzimuth = snapshot.telemetry?.lunar?.azimuth;
    const moonAltitude = snapshot.telemetry?.lunar?.altitude;
    const sunAltitude = snapshot.telemetry?.solar?.altitude;
    const cloudCover = snapshot.weather?.cloudCover;

    if (mode === "ask") {
      return {
        eyebrow: "Earth Command",
        main: "Ask",
        unit: "the Earth",
        detail: commandResponse || "The globe can answer and move.",
        secondary: [
          { label: "memory", value: "planned" },
          { label: "mode", value: lookUp.enabled ? "look up" : "orbit" }
        ]
      };
    }

    if (mode === "observe") {
      return {
        eyebrow: "Local telemetry",
        main: sunAltitude == null ? "--" : `${Math.round(sunAltitude)}°`,
        unit: "sun altitude",
        detail: `${snapshot.locationName} / ${formatUtcOffset(snapshot.longitude)}`,
        secondary: [
          { label: "moon", value: moonAzimuth == null ? "--" : `${Math.round(moonAzimuth)}°` },
          { label: "cloud", value: cloudCover == null ? "--" : `${Math.round(cloudCover)}%` }
        ]
      };
    }

    return {
      eyebrow: "Companion orbit",
      main: localTime,
      unit: "local time",
      detail: lookUp.sky.narration,
      secondary: [
        { label: "moon", value: moonAltitude == null ? "--" : `${Math.round(moonAltitude)}°` },
        { label: "next light", value: nextSunEvent }
      ]
    };
  }, [commandResponse, lookUp.enabled, lookUp.sky.narration, mode, nextSunEvent, now, snapshot]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-void text-slate-100">
      <EarthCanvas
        snapshot={snapshot}
        now={now}
        showClouds={showClouds}
        showGrid={showGrid}
        resetViewSignal={resetViewSignal}
        lookUpMode={lookUp.enabled}
        lookUpSignal={lookUp.sequence}
        visualCommand={visualCommand}
        photoMarkers={mode === "ask" ? PHOTO_MEMORY_MARKERS : []}
      />

      <div className="pointer-events-none absolute inset-0 orbital-vignette" />
      <div className="pointer-events-none absolute inset-0 scanline-field" />

      <header className="top-orbit-bar">
        <div className="brand-lockup">
          <Sparkles size={17} />
          <div>
            <strong>SkyFlow</strong>
            <span>Earth Companion</span>
          </div>
        </div>
        <ModeSwitch mode={mode} onChange={setMode} />
      </header>

      <section className="companion-copy">
        <div className="glass-strip">
          <p className="mode-kicker">{readouts.eyebrow}</p>
          <p className="mt-3 max-w-[34rem] text-balance font-display text-lg leading-relaxed text-slate-100 sm:text-2xl">
            {mode === "ask" ? "Ask the planet, then watch the interface move with the answer." : narration}
          </p>
        </div>
      </section>

      <div className="orbit-controls absolute right-5 top-24 z-20 sm:right-8 sm:top-24">
        <OrbitalReadout readouts={readouts} />
        <button
          className="control-button look-up-button"
          type="button"
          aria-pressed={lookUp.enabled}
          aria-label={lookUp.enabled ? "Leave Look Up Mode" : "Enter Look Up Mode"}
          title={lookUp.enabled ? "Leave Look Up Mode" : "Enter Look Up Mode"}
          onClick={lookUp.toggle}
        >
          <Eye size={16} />
          <span>{lookUp.enabled ? "looking up" : "look up"}</span>
        </button>
        <SoundscapeToggle enabled={soundscape.enabled} level={soundscape.level} onToggle={soundscape.toggle} />
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

      <LookUpPanel active={lookUp.enabled} sky={lookUp.sky} focus={lookUp.focus} />

      <section className={`bottom-orbit-panel ${mode}`}>
        {mode === "ask" && (
        <div className="pointer-events-auto ask-console">
          <EarthConversationLog turns={conversationTurns} />
          <EarthCommandInput response={commandResponse} onSubmit={handleEarthCommand} busy={commandBusy} />
        </div>
        )}
        {mode === "observe" && (
        <>
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
        </>
        )}
      </section>
    </main>
  );

  async function handleEarthCommand(commandInput) {
    const text = typeof commandInput === "string" ? commandInput : commandInput.text;
    const attachments = typeof commandInput === "string" ? [] : commandInput.attachments ?? [];

    if (!text && attachments.length === 0) return;

    setCommandBusy(true);
    setCommandResponse("Thinking with the Earth...");
    const turnId = `turn-${Date.now()}`;
    const createdAt = compactClock(formatLocalClock(now, snapshot.longitude));
    const inputAttachments = attachments.map(({ kind, name }) => ({ kind, name }));

    setConversationTurns((turns) => [
      ...turns,
      {
        id: turnId,
        createdAt,
        routeLabel: "checking api",
        status: "pending",
        userText: text,
        assistantText: "Routing through SkyFlow...",
        attachments: inputAttachments,
        actions: []
      }
    ].slice(-8));

    try {
      const response = await fetch("/api/earth/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text,
          attachments,
          mode,
          localTime: formatLocalClock(now, snapshot.longitude),
          telemetry: snapshot.telemetry,
          locationName: snapshot.locationName,
          latitude: snapshot.latitude,
          longitude: snapshot.longitude,
          sunrise: snapshot.sunrise,
          sunset: snapshot.sunset,
          moonPhase: snapshot.moonPhase,
          photoMemories: PHOTO_MEMORY_MARKERS
        })
      });

      if (!response.ok) {
        throw new Error("backend unavailable");
      }

      const result = await response.json();
      setCommandResponse(result.text ?? "I am listening from orbit.");
      applyEarthActions(result.actions ?? []);
      updateConversationTurn(turnId, {
        routeLabel: "qwen api",
        status: "answered",
        assistantText: result.text ?? "I am listening from orbit.",
        actions: result.actions ?? []
      });
    } catch {
      const result = resolveEarthCommand(text ?? "", snapshot, conversationTurns, attachments);
      if (result) {
        setCommandResponse(result.response);
        applyLocalCommand(result);
        updateConversationTurn(turnId, {
          routeLabel: "local rules",
          status: "answered",
          assistantText: result.response,
          actions: localResultToActions(result)
        });
      } else {
        const fallbackText = "I could not reach the model yet, but the local Earth controls are still online.";
        setCommandResponse(fallbackText);
        updateConversationTurn(turnId, {
          routeLabel: "local fallback",
          status: "answered",
          assistantText: fallbackText,
          actions: []
        });
      }
    } finally {
      setCommandBusy(false);
    }
  }

  function applyLocalCommand(result) {
    if (result.action === "look-up") {
      lookUp.open(result.focus);
    }

    if (result.action === "night-side" || result.action === "sunlight") {
      setVisualCommand({
        type: result.action,
        createdAt: Date.now()
      });
    }

    if (result.action === "set-mode" && ["companion", "ask", "observe"].includes(result.mode)) {
      setMode(result.mode);
    }
  }

  function applyEarthActions(actions) {
    for (const action of actions) {
      if (action.type === "open_look_up") {
        lookUp.open(action.focus ?? null);
      }

      if (action.type === "focus_moon") {
        lookUp.open("moon");
      }

      if (action.type === "focus_sun") {
        lookUp.open("sun");
      }

      if (action.type === "show_night_side") {
        setVisualCommand({ type: "night-side", createdAt: Date.now() });
      }

      if (action.type === "show_sunlight") {
        setVisualCommand({ type: "sunlight", createdAt: Date.now() });
      }

      if (action.type === "set_mode" && ["companion", "ask", "observe"].includes(action.mode)) {
        setMode(action.mode);
      }
    }
  }

  function updateConversationTurn(turnId, patch) {
    setConversationTurns((turns) =>
      turns.map((turn) => (turn.id === turnId ? { ...turn, ...patch } : turn))
    );
  }

  function localResultToActions(result) {
    if (result.action === "look-up") {
      return [{ type: "open_look_up", focus: result.focus ?? null }];
    }

    if (result.action === "night-side") {
      return [{ type: "show_night_side" }];
    }

    if (result.action === "sunlight") {
      return [{ type: "show_sunlight" }];
    }

    if (result.action === "set-mode") {
      return [{ type: "set_mode", mode: result.mode }];
    }

    if (result.action === "focus-photo") {
      return [{ type: "focus_photo_marker", id: result.photoId }];
    }

    return [];
  }
}

function ModeSwitch({ mode, onChange }) {
  const modes = [
    { id: "companion", label: "Companion", icon: <Sparkles size={14} /> },
    { id: "ask", label: "Ask", icon: <MessageCircle size={14} /> },
    { id: "observe", label: "Observe", icon: <Telescope size={14} /> }
  ];

  return (
    <nav className="mode-switch" aria-label="SkyFlow mode">
      {modes.map((item) => (
        <button
          key={item.id}
          type="button"
          className={mode === item.id ? "active" : ""}
          aria-pressed={mode === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function OrbitalReadout({ readouts }) {
  return (
    <aside className="orbital-readout" aria-live="polite">
      <p>{readouts.eyebrow}</p>
      <div className="readout-main">
        <strong>{readouts.main}</strong>
        <span>{readouts.unit}</span>
      </div>
      <p className="readout-detail">{readouts.detail}</p>
      <div className="readout-secondary">
        {readouts.secondary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </aside>
  );
}

function compactClock(value) {
  return value.replace(/:(\d{2})(\s?[AP]M)?$/i, "$2");
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
