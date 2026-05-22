import { azimuthToDirection, describeAltitude } from "./lookUpService.js";

export function resolveEarthCommand(input, snapshot) {
  const normalized = input.trim().toLowerCase();
  const solar = snapshot.telemetry?.solar ?? {};
  const lunar = snapshot.telemetry?.lunar ?? {};

  if (!normalized) {
    return null;
  }

  if (includesAny(normalized, ["where is the moon", "moon"])) {
    const direction = azimuthToDirection(lunar.azimuth);
    const altitude = describeAltitude(lunar.altitude);
    return {
      intent: "moon",
      action: "look-up",
      focus: "moon",
      response: `The moon is ${altitude} toward ${direction}. I am turning Earth toward your sky.`
    };
  }

  if (includesAny(normalized, ["where is the sun", "sun"])) {
    const direction = azimuthToDirection(solar.azimuth);
    const altitude = describeAltitude(solar.altitude);
    return {
      intent: "sun",
      action: "look-up",
      focus: "sun",
      response: `The sun is ${altitude} toward ${direction}; its edge is setting the tone of your local sky.`
    };
  }

  if (includesAny(normalized, ["what does my sky look like", "my sky", "sky look"])) {
    const cloudCover = snapshot.weather?.cloudCover;
    return {
      intent: "sky",
      action: "look-up",
      focus: "sky",
      response: cloudCover == null
        ? "Your sky is being estimated locally. I will bring the window closer."
        : `Your sky is carrying about ${Math.round(cloudCover)}% cloud cover. I will bring the window closer.`
    };
  }

  if (includesAny(normalized, ["when is sunset", "sunset"])) {
    return {
      intent: "sunset",
      action: "look-up",
      focus: "sun",
      response: snapshot.sunset
        ? `Sunset is the next warm edge in the local day. I have marked the sun altitude for you.`
        : "I do not have a live sunset time yet, but I can still show the local sunlight geometry."
    };
  }

  if (includesAny(normalized, ["show me the night side", "night side", "night"])) {
    return {
      intent: "night-side",
      action: "night-side",
      focus: null,
      response: "Turning toward the night side, where city lights carry the surface."
    };
  }

  if (includesAny(normalized, ["show me the sunlight", "sunlight", "light side", "terminator"])) {
    return {
      intent: "sunlight",
      action: "sunlight",
      focus: "sun",
      response: "Following the sunlight edge along the planet."
    };
  }

  return {
    intent: "unknown",
    action: "look-up",
    focus: "sky",
    response: "I can show the moon, the sun, sunset, the night side, or the sunlight edge."
  };
}

function includesAny(value, needles) {
  return needles.some((needle) => value.includes(needle));
}
