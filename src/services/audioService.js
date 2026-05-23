const AUDIO_LAYERS = {
  bachDay: {
    src: "/audio/Gregor Quendel - Bach - Prelude and Fugue in C minor - BWV 847 - The Well-Tempered Clavier, No. 2 - Arranged for Strings.mp3.mp3",
    baseVolume: 0.34
  },
  thaisNight: {
    src: "/audio/Nicola Benedetti, violin; Julien Quentin, piano - Méditation from Thaïs.mp3",
    baseVolume: 0.34
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

export function getSoundscapeTargets(snapshot, lookUpMode, now = new Date()) {
  const localHour = getLocalHour(now, snapshot.longitude);
  const dayEnergy = getDayEnergy(localHour);
  const nightEnergy = 1 - dayEnergy;
  const proximity = lookUpMode ? 1.12 : 1;

  return {
    bachDay: dayEnergy * proximity,
    thaisNight: nightEnergy * proximity
  };
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function getLocalHour(date, longitude) {
  const offsetMinutes = typeof longitude === "number" && !Number.isNaN(longitude)
    ? Math.round((longitude / 15) * 60)
    : 0;
  const localDate = new Date(date.getTime() + offsetMinutes * 60000);

  return (
    localDate.getUTCHours() +
    localDate.getUTCMinutes() / 60 +
    localDate.getUTCSeconds() / 3600
  );
}

function getDayEnergy(localHour) {
  const dawn = smoothstep(5.4, 7.2, localHour);
  const dusk = 1 - smoothstep(18.0, 20.0, localHour);
  return clamp01(Math.min(dawn, dusk));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
