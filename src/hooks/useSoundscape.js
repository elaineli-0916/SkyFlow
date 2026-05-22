import { useEffect, useRef, useState } from "react";
import { createSoundscapeEngine, getSoundscapeTargets } from "../services/audioService.js";

export function useSoundscape(snapshot, lookUpMode) {
  const engineRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    engineRef.current = createSoundscapeEngine();

    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!engineRef.current) return;

    if (enabled) {
      engineRef.current.setTargets(getSoundscapeTargets(snapshot, lookUpMode));
    } else {
      engineRef.current.stop();
    }
  }, [enabled, lookUpMode, snapshot]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLevel(engineRef.current?.getLevel() ?? 0);
    }, 260);

    return () => window.clearInterval(id);
  }, []);

  async function toggle() {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);

    if (nextEnabled && engineRef.current) {
      await engineRef.current.start();
      engineRef.current.setTargets(getSoundscapeTargets(snapshot, lookUpMode));
    }
  }

  return {
    enabled,
    level,
    toggle
  };
}
