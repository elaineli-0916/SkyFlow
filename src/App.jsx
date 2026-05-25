import { useEffect, useMemo, useRef, useState } from "react";
import { Cloud, CloudOff, Grid2X2, LocateFixed, MessageCircle, Moon, RotateCcw, Sparkles, SunMedium, Telescope } from "lucide-react";
import EarthCanvas from "./components/EarthCanvas.jsx";
import EarthCommandInput from "./components/EarthCommandInput.jsx";
import EarthConversationLog from "./components/EarthConversationLog.jsx";
import SoundscapeToggle from "./components/SoundscapeToggle.jsx";
import { getEnvironmentSnapshot } from "./services/earthDataService.js";
import { resolveEarthCommand } from "./services/earthCommandService.js";
import { geocodePlace, reverseGeocode } from "./services/geocodingService.js";
import { addSkyMemory, buildPhotoMemoryMarkers, createSkyMemory, loadSkyMemories } from "./services/skyMemoryService.js";
import { buildNarration } from "./services/narration.js";
import { useSoundscape } from "./hooks/useSoundscape.js";
import { formatDegrees, formatLocalClock, formatMinutes, formatPreciseCoordinate, formatUtcOffset } from "./utils/format.js";

const initialSnapshot = {
  status: "settling",
  locationName: "Local orbit",
  locationSource: "settling",
  locationTimezone: "America/New_York",
  latitude: 40.7128,
  longitude: -74.006,
  weather: null,
  sunrise: null,
  sunset: null,
  moonPhase: 0.42,
  telemetry: null,
  generatedAt: new Date().toISOString()
};

const askModePrompt = "Ask Earth anything...";
const askModeDetail = "The globe can answer and move.";

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
  const [observeGuide, setObserveGuide] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [userSkyMemories, setUserSkyMemories] = useState(() => loadSkyMemories());
  const [pendingSkyMemory, setPendingSkyMemory] = useState(null);
  const [suggestedObserve, setSuggestedObserve] = useState(null);
  const [manualHighlightFocus, setManualHighlightFocus] = useState(null);
  const observeGuideTimers = useRef([]);
  const manualHighlightTimer = useRef(null);
  const soundscape = useSoundscape(snapshot, now);

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
    }, 1000 * 10);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(narrationTick);
    };
  }, []);

  useEffect(() => {
    if (mode !== "ask") {
      setPhotoPreview(null);
    }
  }, [mode]);

  useEffect(() => () => {
    clearObserveGuideTimers();
    clearManualHighlight();
  }, []);

  const photoMemoryMarkers = useMemo(
    () => buildPhotoMemoryMarkers(userSkyMemories),
    [userSkyMemories]
  );

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
    const localTime = compactClock(formatLocalClock(now, snapshot.longitude, snapshot.locationTimezone));
    const moonAzimuth = snapshot.telemetry?.lunar?.azimuth;
    const moonAltitude = snapshot.telemetry?.lunar?.altitude;
    const sunAltitude = snapshot.telemetry?.solar?.altitude;
    const cloudCover = snapshot.weather?.cloudCover;

    if (mode === "ask") {
      return {
        eyebrow: "Earth Command",
        main: "Ask",
        unit: "the Earth",
        detail: askModeDetail,
        secondary: [
          { label: "memory", value: "planned" },
          { label: "mode", value: "orbit" }
        ]
      };
    }

    if (mode === "observe") {
      return {
        eyebrow: "Local telemetry",
        main: sunAltitude == null ? "--" : `${Math.round(sunAltitude)}°`,
        unit: "sun altitude",
        detail: `${snapshot.locationName} / ${formatUtcOffset(snapshot.longitude, snapshot.locationTimezone)}`,
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
      detail: narration,
      secondary: [
        { label: "moon", value: moonAltitude == null ? "--" : `${Math.round(moonAltitude)}°` },
        { label: "next light", value: nextSunEvent }
      ]
    };
  }, [mode, narration, nextSunEvent, now, snapshot]);

  return (
    <main className={`relative min-h-screen overflow-hidden bg-void text-slate-100${observeGuide ? ` observe-guide-${observeGuide.phase}` : ""}`}>
      <EarthCanvas
        snapshot={snapshot}
        now={now}
        showClouds={showClouds}
        showGrid={showGrid}
        resetViewSignal={resetViewSignal}
        mode={mode}
        visualCommand={visualCommand}
        photoMarkers={mode === "ask" ? photoMemoryMarkers : []}
        onPhotoPreviewChange={setPhotoPreview}
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
        <ModeSwitch mode={mode} guide={observeGuide} onChange={setModeFromUser} />
      </header>

      {mode !== "observe" && (
        <section className="companion-copy">
          <div className="glass-strip">
            <p className="mode-kicker">{readouts.eyebrow}</p>
            <p key={mode === "ask" ? askModePrompt : narration} className="companion-narration mt-3 max-w-[34rem] text-balance font-display text-lg leading-relaxed text-slate-100 sm:text-2xl">
              {mode === "ask" ? askModePrompt : narration}
            </p>
          </div>
        </section>
      )}

      {mode !== "observe" && (
        <div className="orbit-controls absolute right-5 top-24 z-20 sm:right-8 sm:top-24">
          <OrbitalReadout readouts={readouts} />
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
      )}

      <section className={`bottom-orbit-panel ${mode}`}>
        {mode === "ask" && (
        <div className="pointer-events-auto ask-console">
          <EarthConversationLog turns={conversationTurns} />
          {suggestedObserve && (
            <button className="observe-suggestion" type="button" onClick={() => acceptObserveSuggestion(suggestedObserve.focus)}>
              <Telescope size={13} />
              <span>{suggestedObserve.label}</span>
            </button>
          )}
          <EarthCommandInput onSubmit={handleEarthCommand} busy={commandBusy} />
        </div>
        )}
        {mode === "observe" && (
          <ObserveTelemetryLayout snapshot={snapshot} nextSunEvent={nextSunEvent} highlightFocus={observeGuide?.phase === "highlight" ? observeGuide.focus : manualHighlightFocus} />
        )}
      </section>

      {mode === "ask" && <PhotoMemoryPreviewOverlay preview={photoPreview} />}
      <DataSourceFootnote snapshot={snapshot} />
    </main>
  );

  async function handleEarthCommand(commandInput) {
    const text = typeof commandInput === "string" ? commandInput : commandInput.text;
    const attachments = typeof commandInput === "string" ? [] : commandInput.attachments ?? [];
    let readySkyMemoryDraft = null;

    if (!text && attachments.length === 0) return;

    clearObserveGuideTimers();
    setObserveGuide(null);
    setSuggestedObserve(null);
    setCommandBusy(true);
    setCommandResponse("Thinking with the Earth...");
    const turnId = `turn-${Date.now()}`;
    const createdAt = compactClock(formatLocalClock(now, snapshot.longitude, snapshot.locationTimezone));
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
      if (pendingSkyMemory) {
        await continueSkyMemoryDraft(text, turnId);
        return;
      }

      if (isSkyMemorySaveIntent(text)) {
        if (attachments.length === 0) {
          const assistantText = "Attach the sky photo you want me to remember, then tell me to save it.";
          setCommandResponse(assistantText);
          updateConversationTurn(turnId, {
            routeLabel: "local memory",
            status: "answered",
            assistantText,
            actions: []
          });
          return;
        }

        const draft = await prepareSkyMemoryDraft(attachments[0]);
        if (draft.needs) {
          setPendingSkyMemory(draft);
          const assistantText = getSkyMemoryQuestion(draft.needs);
          setCommandResponse(assistantText);
          updateConversationTurn(turnId, {
            routeLabel: "local memory",
            status: "answered",
            assistantText,
            actions: [{ type: "save_sky_memory", status: `needs_${draft.needs}` }]
          });
          return;
        }
        readySkyMemoryDraft = draft;
      }

      const response = await fetch("/api/earth/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text,
          attachments,
          mode,
          localTime: formatLocalClock(now, snapshot.longitude, snapshot.locationTimezone),
          telemetry: snapshot.telemetry,
          locationName: snapshot.locationName,
          latitude: snapshot.latitude,
          longitude: snapshot.longitude,
          sunrise: snapshot.sunrise,
          sunset: snapshot.sunset,
          moonPhase: snapshot.moonPhase,
          photoMemories: photoMemoryMarkers
        })
      });

      if (!response.ok) {
        throw new Error("backend unavailable");
      }

      const result = await response.json();
      const observeFocus = getAllowedObserveFocus(result.actions ?? [], text, attachments);
      const assistantText = observeFocus
        ? withObserveHandoff(result.text, observeFocus)
        : result.text ?? "I am listening from orbit.";
      setCommandResponse(assistantText);
      const executedActions = applyEarthActions(result.actions ?? [], { userText: text, attachments, assistantText });
      if (readySkyMemoryDraft && shouldSaveSkyMemory(result.actions, text)) {
        const memoryAction = saveSkyMemoryFromDraft(readySkyMemoryDraft, {
          description: result.text,
          tags: inferSkyMemoryTags(result.text)
        });
        executedActions.push(memoryAction);
      }
      updateConversationTurn(turnId, {
        routeLabel: "qwen api",
        status: "answered",
        assistantText,
        actions: executedActions
      });
    } catch {
      const result = resolveEarthCommand(text ?? "", snapshot, conversationTurns, attachments);
      if (readySkyMemoryDraft) {
        const memoryAction = saveSkyMemoryFromDraft(readySkyMemoryDraft, {
          description: "A saved sky memory.",
          tags: inferSkyMemoryTags(text)
        });
        const assistantText = `I saved this sky memory over ${readySkyMemoryDraft.location.name}.`;
        setCommandResponse(assistantText);
        updateConversationTurn(turnId, {
          routeLabel: "local memory",
          status: "answered",
          assistantText,
          actions: [memoryAction]
        });
      } else if (result) {
        setCommandResponse(result.response);
        const executedActions = applyLocalCommand(result);
        updateConversationTurn(turnId, {
          routeLabel: "local rules",
          status: "answered",
          assistantText: result.response,
          actions: executedActions
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
    const executedActions = [];

    if (result.action === "night-side" || result.action === "sunlight") {
      setVisualCommand({
        type: result.action,
        createdAt: Date.now()
      });
      executedActions.push(result.action === "night-side" ? { type: "show_night_side" } : { type: "show_sunlight" });
    }

    if (result.action === "set-mode" && ["companion", "ask", "observe"].includes(result.mode)) {
      if (result.mode === "observe") {
        beginObserveGuide(result.focus ?? "telemetry");
      } else {
        setModeFromSystem(result.mode);
      }
      executedActions.push({ type: "set_mode", mode: result.mode, ...(result.focus ? { focus: result.focus } : {}) });
    }

    if (result.action === "focus-photo") {
      focusPhotoMarker(result.photoId);
      executedActions.push({ type: "focus_photo_marker", id: result.photoId });
    }

    return executedActions;
  }

  function applyEarthActions(actions, context) {
    const executedActions = [];

    for (const action of actions) {
      if (action.type === "show_night_side") {
        setVisualCommand({ type: "night-side", createdAt: Date.now() });
        executedActions.push(action);
      }

      if (action.type === "show_sunlight") {
        setVisualCommand({ type: "sunlight", createdAt: Date.now() });
        executedActions.push(action);
      }

      if (action.type === "camera_travel") {
        executeCameraTravel(action);
        executedActions.push(action);
      }

      if (action.type === "highlight") {
        triggerHighlight(action.target, action.durationMs);
        executedActions.push(action);
      }

      if (action.type === "pulse_layer") {
        const layer = normalizeLayer(action.layer);
        setVisualCommand(layer === "sunlight"
          ? { type: "sunlight", createdAt: Date.now() }
          : { type: "pulse-layer", layer, createdAt: Date.now() });
        executedActions.push(action);
      }

      if (action.type === "suggest_observe") {
        const focus = normalizeObserveFocus(action.focus);
        if (!focus || shouldStayInAsk(context.userText, context.attachments)) continue;
        setSuggestedObserve({ focus, label: action.label || getObserveSuggestionLabel(focus) });
        executedActions.push({ ...action, focus });
      }

      if (action.type === "focus_photo_marker") {
        if (focusPhotoMarker(action.id)) {
          executedActions.push(action);
        }
      }

      if (action.type === "set_mode" && ["companion", "ask", "observe"].includes(action.mode)) {
        if (action.mode === "observe") {
          const focus = getAllowedObserveFocus([action], context.userText, context.attachments);
          if (!focus) continue;
          beginObserveGuide(focus);
          executedActions.push({ ...action, focus });
        } else {
          setModeFromSystem(action.mode);
          executedActions.push(action);
        }
      }
    }

    return executedActions;
  }

  async function continueSkyMemoryDraft(text, turnId) {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) {
      const assistantText = getSkyMemoryQuestion(pendingSkyMemory.needs);
      setCommandResponse(assistantText);
      updateConversationTurn(turnId, {
        routeLabel: "local memory",
        status: "answered",
        assistantText,
        actions: []
      });
      return;
    }

    try {
      const nextDraft = { ...pendingSkyMemory };
      if (pendingSkyMemory.needs === "location") {
        nextDraft.location = await geocodePlace(trimmed);
      }

      if (pendingSkyMemory.needs === "location_label") {
        nextDraft.location = {
          ...nextDraft.location,
          name: trimmed,
          region: nextDraft.location?.region === "EXIF GPS" ? "User confirmed" : nextDraft.location?.region,
          source: "user-confirmed"
        };
      }

      if (pendingSkyMemory.needs === "time") {
        const parsedTime = parseUserDateTime(trimmed);
        if (!parsedTime) {
          const assistantText = "I need a clearer capture time, for example 2024-04-23 20:24.";
          setCommandResponse(assistantText);
          updateConversationTurn(turnId, {
            routeLabel: "local memory",
            status: "answered",
            assistantText,
            actions: [{ type: "save_sky_memory", status: "needs_time" }]
          });
          return;
        }
        nextDraft.capturedAt = parsedTime;
      }

      if (pendingSkyMemory.needs === "note") {
        nextDraft.location = {
          ...nextDraft.location,
          note: normalizeSkyMemoryNote(trimmed)
        };
        nextDraft.noteConfirmed = true;
      }

      if (!nextDraft.location) {
        nextDraft.needs = "location";
        setPendingSkyMemory(nextDraft);
        const assistantText = getSkyMemoryQuestion("location");
        setCommandResponse(assistantText);
        updateConversationTurn(turnId, {
          routeLabel: "local memory",
          status: "answered",
          assistantText,
          actions: [{ type: "save_sky_memory", status: "needs_location" }]
        });
        return;
      }

      if (!nextDraft.location.name || shouldConfirmPhotoLocationName(nextDraft.location)) {
        nextDraft.needs = "location_label";
        setPendingSkyMemory(nextDraft);
        const assistantText = getSkyMemoryQuestion("location_label", nextDraft);
        setCommandResponse(assistantText);
        updateConversationTurn(turnId, {
          routeLabel: "local memory",
          status: "answered",
          assistantText,
          actions: [{ type: "save_sky_memory", status: "needs_location_label" }]
        });
        return;
      }

      if (!nextDraft.capturedAt) {
        nextDraft.needs = "time";
        setPendingSkyMemory(nextDraft);
        const assistantText = getSkyMemoryQuestion("time");
        setCommandResponse(assistantText);
        updateConversationTurn(turnId, {
          routeLabel: "local memory",
          status: "answered",
          assistantText,
          actions: [{ type: "save_sky_memory", status: "needs_time" }]
        });
        return;
      }

      if (!nextDraft.noteConfirmed) {
        nextDraft.needs = "note";
        setPendingSkyMemory(nextDraft);
        const assistantText = getSkyMemoryQuestion("note", nextDraft);
        setCommandResponse(assistantText);
        updateConversationTurn(turnId, {
          routeLabel: "local memory",
          status: "answered",
          assistantText,
          actions: [{ type: "save_sky_memory", status: "needs_note" }]
        });
        return;
      }

      setPendingSkyMemory(null);
      const memoryAction = saveSkyMemoryFromDraft(nextDraft, {
        description: "A saved sky memory.",
        tags: inferSkyMemoryTags(trimmed)
      });
      const assistantText = `Saved. I placed this sky memory over ${nextDraft.location.name}.`;
      setCommandResponse(assistantText);
      updateConversationTurn(turnId, {
        routeLabel: "local memory",
        status: "answered",
        assistantText,
        actions: [memoryAction]
      });
    } catch {
      const assistantText = "I could not resolve that place. Try a city name, like Yueyang or College Park.";
      setCommandResponse(assistantText);
      updateConversationTurn(turnId, {
        routeLabel: "local memory",
        status: "answered",
        assistantText,
        actions: [{ type: "save_sky_memory", status: "needs_location" }]
      });
    }
  }

  async function prepareSkyMemoryDraft(attachment) {
    const draft = {
      attachment,
      location: null,
      capturedAt: attachment.captureTime ?? null,
      needs: null
    };

    if (Number.isFinite(attachment.gpsLatitude) && Number.isFinite(attachment.gpsLongitude)) {
      draft.location = await reverseGeocode(attachment.gpsLatitude, attachment.gpsLongitude)
        .then((location) => ({ ...location, source: "photo-gps" }))
        .catch(() => ({
          name: "Photo location",
          region: "EXIF GPS",
          latitude: attachment.gpsLatitude,
          longitude: attachment.gpsLongitude,
          source: "photo-gps"
        }));
    }

    if (!draft.location) {
      return { ...draft, needs: "location" };
    }

    if (shouldConfirmPhotoLocationName(draft.location)) {
      return { ...draft, needs: "location_label" };
    }

    if (!draft.capturedAt) {
      return { ...draft, needs: "time" };
    }

    return { ...draft, needs: "note" };
  }

  function saveSkyMemoryFromDraft(draft, options = {}) {
    const memory = createSkyMemory({
      attachment: draft.attachment,
      location: draft.location,
      capturedAt: draft.capturedAt,
      description: options.description,
      tags: options.tags
    });
    const nextMemories = addSkyMemory(memory);
    setUserSkyMemories(nextMemories);
    setPhotoPreview(null);
    setVisualCommand({
      type: "camera-travel",
      latitude: memory.latitude,
      longitude: memory.longitude,
      createdAt: Date.now()
    });
    return { type: "save_sky_memory", id: memory.id, label: memory.label };
  }

  function executeCameraTravel(action) {
    if (action.target === "local_position") {
      setVisualCommand({ type: "camera-travel", latitude: snapshot.latitude, longitude: snapshot.longitude, createdAt: Date.now() });
      return;
    }

    if (action.target === "photo_marker" && action.id) {
      focusPhotoMarker(action.id);
      return;
    }

    if (action.target === "night_side") {
      setVisualCommand({ type: "night-side", createdAt: Date.now() });
      return;
    }

    if (action.target === "sunlight_edge") {
      setVisualCommand({ type: "sunlight", createdAt: Date.now() });
    }
  }

  function focusPhotoMarker(markerId) {
    const marker = photoMemoryMarkers.find((item) => item.id === markerId) ?? photoMemoryMarkers[0];
    if (!marker) return false;
    setVisualCommand({
      type: "camera-travel",
      latitude: marker.latitude,
      longitude: marker.longitude,
      createdAt: Date.now()
    });
    return true;
  }

  function triggerHighlight(target, durationMs = 1800) {
    const focus = normalizeObserveFocus(target);
    if (!focus) return;
    clearManualHighlight();
    setManualHighlightFocus(focus);
    manualHighlightTimer.current = window.setTimeout(() => {
      setManualHighlightFocus(null);
      manualHighlightTimer.current = null;
    }, clamp(Number(durationMs) || 1800, 900, 3200));
  }

  function acceptObserveSuggestion(focus) {
    setSuggestedObserve(null);
    beginObserveGuide(focus);
  }

  function clearManualHighlight() {
    if (manualHighlightTimer.current) {
      window.clearTimeout(manualHighlightTimer.current);
      manualHighlightTimer.current = null;
    }
  }

  function beginObserveGuide(focus) {
    clearObserveGuideTimers();

    const guideId = `observe-${Date.now()}`;
    setObserveGuide({ id: guideId, focus, phase: "handoff" });

    observeGuideTimers.current.push(window.setTimeout(() => {
      setObserveGuide((guide) => (guide?.id === guideId ? { ...guide, phase: "travel" } : guide));
      setVisualCommand({ type: "observe-guide", focus, createdAt: Date.now() });
    }, 650));

    observeGuideTimers.current.push(window.setTimeout(() => {
      setMode("observe");
      setObserveGuide((guide) => (guide?.id === guideId ? { ...guide, phase: "highlight" } : guide));
    }, 1450));

    observeGuideTimers.current.push(window.setTimeout(() => {
      setObserveGuide((guide) => (guide?.id === guideId ? null : guide));
    }, 3600));
  }

  function setModeFromUser(nextMode) {
    clearObserveGuideTimers();
    setObserveGuide(null);
    setMode(nextMode);
  }

  function setModeFromSystem(nextMode) {
    clearObserveGuideTimers();
    setObserveGuide(null);
    setMode(nextMode);
  }

  function clearObserveGuideTimers() {
    for (const timer of observeGuideTimers.current) {
      window.clearTimeout(timer);
    }
    observeGuideTimers.current = [];
  }

  function updateConversationTurn(turnId, patch) {
    setConversationTurns((turns) =>
      turns.map((turn) => (turn.id === turnId ? { ...turn, ...patch } : turn))
    );
  }
}

function getAllowedObserveFocus(actions, userText, attachments = []) {
  const requestedObserve = actions.some((action) => action?.type === "set_mode" && action.mode === "observe");
  if (!requestedObserve) return null;
  if (shouldStayInAsk(userText, attachments)) return null;

  return inferObserveFocus(userText);
}

function shouldStayInAsk(userText, attachments = []) {
  const text = String(userText ?? "").trim().toLowerCase();
  const hasAttachments = attachments.length > 0;

  if (!text && hasAttachments) return true;

  const imageInspectionIntent =
    /(what is this|what are these|what kind of|identify|classify|describe this|in this image|in this photo|this cloud|these clouds|这是什么|这张|这幅|这片|这个云|这种云|这些云|图片|照片|图里|识别|判断|分析一下|帮我看)/i.test(text);
  const asksAboutCloudType =
    /(what cloud|cloud type|kind of cloud|这是什么云|这属于什么云|这是哪种云|这云叫什么|云的类型)/i.test(text);

  return imageInspectionIntent || asksAboutCloudType;
}

function inferObserveFocus(value) {
  const text = String(value ?? "").toLowerCase();

  if (/(moon|lunar|月亮|月相|月出|月落|月球)/i.test(text)) return "moon";
  if (/(sun|sunset|sunrise|sunlight|solar|terminator|日落|日出|太阳|阳光|晨昏线|曙光|黄昏)/i.test(text)) return "sun";
  if (/(cloud|clouds|weather|sky|rain|storm|fog|visibility|云|天气|天空|下雨|雨|雾|阴天|晴天)/i.test(text)) return "weather";
  if (/(observe|telemetry|data|观测|数据)/i.test(text)) return "telemetry";

  return null;
}

function withObserveHandoff(text, focus) {
  const base = String(text ?? "").trim();
  const handoff = getObserveHandoffLine(focus);

  if (!base) return handoff;
  if (/(show|open|take you|let me|我带你|打开|看一下|带你看)/i.test(base)) return base;

  return `${base} ${handoff}`;
}

function getObserveHandoffLine(focus) {
  if (focus === "moon") return "Let me show you where the moon is relative to your sky.";
  if (focus === "sun") return "Let me show you the sunlight geometry around your location.";
  if (focus === "weather") return "I will take you to the cloud and weather layer above you.";
  return "I will bring up the local telemetry without breaking the thread.";
}

function isSkyMemorySaveIntent(value) {
  return /(记下来|保存|存起来|放回地球|天空记忆|save this|save it|remember this|sky memory|place this sky)/i.test(String(value ?? ""));
}

function shouldSaveSkyMemory(actions = [], userText) {
  return isSkyMemorySaveIntent(userText) || actions.some((action) => action?.type === "save_sky_memory");
}

function getSkyMemoryQuestion(field, draft) {
  if (field === "location") return "I can save this sky, but the photo has no GPS. Where was it taken?";
  if (field === "location_label") {
    const inferred = draft?.location?.name && draft.location.name !== "Photo location" ? ` I found ${draft.location.name};` : "";
    return `${inferred} what place name should I show on the globe for this photo?`;
  }
  if (field === "time") return "I found the place. What time was this sky photographed? Use a format like 2024-04-23 20:24.";
  if (field === "note") return "Add one short note for this sky memory, or type skip.";
  return "Tell me the missing detail and I will place this sky memory on the Earth.";
}

function shouldConfirmPhotoLocationName(location) {
  return location?.source === "photo-gps" || location?.name === "Photo location";
}

function normalizeSkyMemoryNote(value) {
  const note = String(value ?? "").trim();
  if (/^(skip|no|none|不用|跳过|不写)$/i.test(note)) return "";
  return note.slice(0, 96);
}

function parseUserDateTime(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/年|\/|\./g, "-").replace(/月/g, "-").replace(/日/g, " ");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function inferSkyMemoryTags(value) {
  const text = String(value ?? "").toLowerCase();
  const tags = [];
  if (/cloud|云/.test(text)) tags.push("cloud");
  if (/moon|月/.test(text)) tags.push("moon");
  if (/sunset|日落|黄昏/.test(text)) tags.push("sunset");
  if (/sunrise|日出|清晨/.test(text)) tags.push("sunrise");
  if (/night|夜/.test(text)) tags.push("night");
  return tags;
}

function normalizeObserveFocus(value) {
  const text = String(value ?? "").toLowerCase().replace(/_/g, "-");
  if (["moon", "moon-path", "moon-altitude", "lunar"].includes(text)) return "moon";
  if (["sun", "sun-path", "sunlight", "solar"].includes(text)) return "sun";
  if (["weather", "cloud", "clouds", "cloud-density", "sky"].includes(text)) return "weather";
  if (["telemetry", "observe", "data"].includes(text)) return "telemetry";
  return null;
}

function normalizeLayer(value) {
  const text = String(value ?? "").toLowerCase();
  if (/moon|lunar/.test(text)) return "moon";
  if (/cloud|weather|sky/.test(text)) return "clouds";
  if (/sun|light|solar/.test(text)) return "sunlight";
  if (/photo|memory/.test(text)) return "photo";
  return "earth";
}

function getObserveSuggestionLabel(focus) {
  if (focus === "moon") return "Show moon path";
  if (focus === "sun") return "Show sunlight";
  if (focus === "weather") return "Show sky layer";
  return "Open Observe";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function DataSourceFootnote({ snapshot }) {
  const sources = buildDataSourceItems(snapshot);

  return (
    <nav className="data-source-footnote" aria-label="SkyFlow data sources">
      <span>Data: {sources.location}</span>
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
        {sources.weather}
      </a>
      <span>{sources.solar}</span>
      {sources.moonUrl ? (
        <a href={sources.moonUrl} target="_blank" rel="noreferrer">
          {sources.moon}
        </a>
      ) : (
        <span>{sources.moon}</span>
      )}
      <span>updated {sources.updated}</span>
    </nav>
  );
}

function buildDataSourceItems(snapshot) {
  const sources = snapshot.telemetry?.sources ?? {};
  const location =
    snapshot.locationSource === "forced"
      ? "New York test lock"
      : snapshot.locationSource === "browser"
        ? "browser geolocation"
        : sources.location ?? "fallback location";
  const weather = sources.weather === "open-meteo" ? "Open-Meteo weather/sunrise" : "local weather fallback";
  const solar = snapshot.telemetry?.solar ? "local solar geometry" : "solar estimate pending";
  const moon =
    snapshot.telemetry?.lunar?.provider === "timeanddate"
      ? "Timeanddate Astronomy API moon"
      : "local lunar approximation";
  const updated = snapshot.generatedAt ? formatFootnoteTime(snapshot.generatedAt, snapshot.locationTimezone) : "updating";

  return {
    location,
    weather,
    solar,
    moon,
    moonUrl: snapshot.telemetry?.lunar?.providerUrl ?? "https://dev.timeanddate.com/docs/astro/",
    updated
  };
}

function formatFootnoteTime(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "updating";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone
  }).format(date);
}

function PhotoMemoryPreviewOverlay({ preview }) {
  if (!preview) return null;

  const { marker, style } = preview;

  return (
    <aside className="photo-memory-floating-preview" style={style} aria-live="polite">
      <img src={marker.imageUrl} alt={`${marker.label} memory`} />
      <div>
        <strong>{marker.label}</strong>
        <span>{marker.region}</span>
        <small>{marker.capturedAt}</small>
        {marker.note && <em>{marker.note}</em>}
      </div>
    </aside>
  );
}

function ModeSwitch({ mode, guide, onChange }) {
  const modes = [
    { id: "companion", label: "Companion", icon: <Sparkles size={14} /> },
    { id: "ask", label: "Ask", icon: <MessageCircle size={14} /> },
    { id: "observe", label: "Observe", icon: <Telescope size={14} /> }
  ];

  return (
    <nav className={`mode-switch mode-${mode}${guide ? ` guiding-${guide.phase}` : ""}`} data-mode={mode} aria-label="SkyFlow mode">
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
      <p key={readouts.detail} className="readout-detail">{readouts.detail}</p>
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

function ObserveTelemetryLayout({ snapshot, nextSunEvent, highlightFocus }) {
  const solar = snapshot.telemetry?.solar ?? {};
  const lunar = snapshot.telemetry?.lunar ?? {};
  const weather = snapshot.weather?.summary ?? "quiet telemetry";

  return (
    <div className="observe-layout">
      <aside className="observe-side observe-left">
        <div className="observe-kicker">
          <LocateFixed size={14} />
          <span>{snapshot.status === "live" ? "open-meteo live" : "local earth model"}</span>
        </div>
        <h2>{snapshot.locationName}</h2>
        <p className="observe-coordinate">{formatPreciseCoordinate(snapshot.latitude, snapshot.longitude)}</p>
        <LightWindow sunrise={snapshot.sunrise} sunset={snapshot.sunset} sunAzimuth={solar.azimuth} timeZone={snapshot.locationTimezone} highlight={highlightFocus === "sun"} />
        <div className="observe-pair-row">
          <EventMetric label="next light" value={nextSunEvent} />
          <EventMetric label="weather" value={weather} highlight={highlightFocus === "weather"} />
        </div>
      </aside>

      <aside className="observe-side observe-right">
        <div className="observe-kicker">
          <Moon size={14} />
          <span>{lunar.provider === "timeanddate" ? "timeanddate moon" : "local moon estimate"}</span>
        </div>
        <MoonTimingCurve
          moonrise={lunar.moonrise}
          moonset={lunar.moonset}
          meridian={lunar.meridian}
          meridianAltitude={lunar.meridianAltitude}
          highlight={highlightFocus === "moon"}
        />
        <div className="observe-metric-grid">
          <EventMetric label="sun azimuth" value={formatDegrees(solar.azimuth)} highlight={highlightFocus === "sun"} />
          <EventMetric label="moon azimuth" value={formatDegrees(lunar.azimuth)} />
          <EventMetric label="moon altitude" value={formatDegrees(lunar.altitude)} highlight={highlightFocus === "moon"} />
          <EventMetric label="moon phase" value={`${Math.round(snapshot.moonPhase * 100)}% lit`} />
        </div>
      </aside>
    </div>
  );
}

function LightWindow({ sunrise, sunset, sunAzimuth, timeZone, highlight }) {
  return (
    <section className={`light-window${highlight ? " observe-focus-glow" : ""}`}>
      <div className="cell-kicker">
        <SunMedium size={13} />
        <span>sun path</span>
      </div>
      <SunArcGraphic sunrise={sunrise} sunset={sunset} timeZone={timeZone} />
      <p className="cell-foot">sun azimuth {formatDegrees(sunAzimuth)}</p>
    </section>
  );
}

function SunArcGraphic({ sunrise, sunset, timeZone }) {
  return (
    <div className="sun-arc-graphic">
      <svg viewBox="0 0 320 128">
        <defs>
          <linearGradient id="sunArcGradient" x1="48" y1="82" x2="272" y2="82" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5c7dff" />
            <stop offset="48%" stopColor="#ffe09a" />
            <stop offset="100%" stopColor="#5c7dff" />
          </linearGradient>
        </defs>
        <path className="horizon" d="M28 82 H292" />
        <path className="horizon-glow" d="M28 82 H292" />
        <path className="arc-shadow" d="M48 82 C80 76 84 48 108 29 C132 10 188 10 212 29 C236 48 240 76 272 82" />
        <path className="sun-arc-line" d="M48 82 C80 76 84 48 108 29 C132 10 188 10 212 29 C236 48 240 76 272 82" />
        <g className={sunrise ? "arc-event available" : "arc-event"}>
          <circle cx="48" cy="82" r="4" />
          <text x="48" y="110" textAnchor="middle">sunrise</text>
          <text className="arc-time" x="48" y="124" textAnchor="middle">{formatEventTime(sunrise, timeZone)}</text>
        </g>
        <g className={sunset ? "arc-event available" : "arc-event"}>
          <circle cx="272" cy="82" r="4" />
          <text x="272" y="110" textAnchor="middle">sunset</text>
          <text className="arc-time" x="272" y="124" textAnchor="middle">{formatEventTime(sunset, timeZone)}</text>
        </g>
      </svg>
    </div>
  );
}

function MoonTimingCurve({ moonrise, moonset, meridian, meridianAltitude, highlight }) {
  return (
    <section className={`moon-curve-cell${highlight ? " observe-focus-glow" : ""}`}>
      <div className="cell-kicker">
        <Moon size={13} />
        <span>moon path</span>
      </div>
      <MoonArcGraphic moonrise={moonrise} meridian={meridian} moonset={moonset} />
      <p className="cell-foot">meridian altitude {formatDegrees(meridianAltitude)}</p>
    </section>
  );
}

function MoonArcGraphic({ moonrise, meridian, moonset }) {
  return (
    <div className="moon-arc-graphic">
      <svg viewBox="0 0 320 128">
        <defs>
          <linearGradient id="moonArcGradient" x1="48" y1="82" x2="272" y2="82" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffe09a" />
            <stop offset="52%" stopColor="#6f8dff" />
            <stop offset="100%" stopColor="#ffe09a" />
          </linearGradient>
        </defs>
        <path className="horizon" d="M28 82 H292" />
        <path className="horizon-glow" d="M28 82 H292" />
        <path className="arc-shadow" d="M48 82 C80 76 84 48 108 29 C132 10 188 10 212 29 C236 48 240 76 272 82" />
        <path className="moon-arc-line" d="M48 82 C80 76 84 48 108 29 C132 10 188 10 212 29 C236 48 240 76 272 82" />
        <g className={moonrise ? "arc-event available" : "arc-event"}>
          <circle cx="48" cy="82" r="4" />
          <text x="48" y="110" textAnchor="middle">moonrise</text>
          <text className="arc-time" x="48" y="124" textAnchor="middle">{formatMoonEventTime(moonrise)}</text>
        </g>
        <g className={meridian ? "arc-event meridian available" : "arc-event meridian"}>
          <circle cx="160" cy="20" r="4" />
          <text x="160" y="10" textAnchor="middle">meridian</text>
          <text className="arc-time" x="160" y="38" textAnchor="middle">{meridian ?? "--"}</text>
        </g>
        <g className={moonset ? "arc-event available" : "arc-event"}>
          <circle cx="272" cy="82" r="4" />
          <text x="272" y="110" textAnchor="middle">moonset</text>
          <text className="arc-time" x="272" y="124" textAnchor="middle">{formatMoonEventTime(moonset)}</text>
        </g>
      </svg>
    </div>
  );
}

function EventMetric({ label, value, highlight }) {
  return (
    <div className={`event-metric${highlight ? " observe-focus-glow" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function compactClock(value) {
  return value.replace(/:(\d{2})(\s?[AP]M)?$/i, "$2");
}

function formatEventTime(value, timeZone) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone
  }).format(date);
}

function formatMoonEventTime(value) {
  if (!value) return "--";
  if (typeof value === "string") return value;
  return value.time ?? "--";
}

export default App;
