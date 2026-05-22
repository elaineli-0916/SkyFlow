const AUDIO_LAYERS = {
  base: {
    src: "/audio/base-ambient.mp3",
    baseVolume: 0.32
  },
  night: {
    src: "/audio/night-piano.mp3",
    baseVolume: 0.28
  },
  wind: {
    src: "/audio/wind-cloud.mp3",
    baseVolume: 0.24
  }
};

const FADE_SPEED = 0.035;

export function createSoundscapeEngine() {
  const layers = new Map();
  let animationFrame = null;
  let running = false;

  function ensureLayer(name) {
    if (layers.has(name)) return layers.get(name);

    const config = AUDIO_LAYERS[name];
    const audio = new Audio(config.src);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;

    const layer = {
      audio,
      currentVolume: 0,
      targetVolume: 0,
      failed: false
    };

    audio.addEventListener("error", () => {
      layer.failed = true;
      layer.targetVolume = 0;
    });

    layers.set(name, layer);
    return layer;
  }

  async function start() {
    running = true;
    const playRequests = Object.keys(AUDIO_LAYERS).map(async (name) => {
      const layer = ensureLayer(name);
      if (layer.failed) return;

      try {
        await layer.audio.play();
      } catch {
        layer.failed = true;
      }
    });

    tick();
    await Promise.allSettled(playRequests);
  }

  function setTargets(targets) {
    for (const name of Object.keys(AUDIO_LAYERS)) {
      const layer = ensureLayer(name);
      layer.targetVolume = clamp01(targets[name] ?? 0) * AUDIO_LAYERS[name].baseVolume;
    }
  }

  function stop() {
    running = false;
    for (const layer of layers.values()) {
      layer.targetVolume = 0;
    }
    tick();
  }

  function dispose() {
    running = false;
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    for (const layer of layers.values()) {
      layer.audio.pause();
      layer.audio.src = "";
    }
    layers.clear();
  }

  function getLevel() {
    let level = 0;
    for (const layer of layers.values()) {
      level += layer.currentVolume;
    }
    return clamp01(level);
  }

  function tick() {
    if (animationFrame) return;

    const frame = () => {
      let shouldContinue = running;

      for (const layer of layers.values()) {
        const delta = layer.targetVolume - layer.currentVolume;
        layer.currentVolume += delta * FADE_SPEED;

        if (Math.abs(delta) > 0.001) {
          shouldContinue = true;
        }

        layer.audio.volume = clamp01(layer.currentVolume);

        if (!running && layer.currentVolume < 0.001) {
          layer.audio.pause();
        }
      }

      if (shouldContinue) {
        animationFrame = window.requestAnimationFrame(frame);
      } else {
        animationFrame = null;
      }
    };

    animationFrame = window.requestAnimationFrame(frame);
  }

  return {
    start,
    stop,
    dispose,
    setTargets,
    getLevel
  };
}

export function getSoundscapeTargets(snapshot, lookUpMode) {
  const cloudCover = snapshot.weather?.cloudCover ?? 30;
  const windSpeed = snapshot.weather?.windSpeed ?? 8;
  const sunAltitude = snapshot.telemetry?.solar?.altitude ?? 18;
  const moonAltitude = snapshot.telemetry?.lunar?.altitude ?? -8;

  const proximity = lookUpMode ? 1.18 : 1;
  const cloudEnergy = Math.max(cloudCover / 100, Math.min(windSpeed / 38, 1));
  const nightEnergy = sunAltitude < 0 ? 0.74 : 0.12;
  const moonEnergy = moonAltitude > 0 ? 0.18 : 0;

  return {
    base: 0.72 * proximity,
    night: Math.min(1, (nightEnergy + moonEnergy + (lookUpMode ? 0.18 : 0)) * proximity),
    wind: Math.min(1, (0.1 + cloudEnergy * 0.86) * proximity)
  };
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}
