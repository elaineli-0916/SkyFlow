import { azimuthToDirection, describeAltitude } from "./skyDescriptionService.js";

export function resolveEarthCommand(input, snapshot, history = [], attachments = []) {
  const normalized = input.trim().toLowerCase();
  const solar = snapshot.telemetry?.solar ?? {};
  const lunar = snapshot.telemetry?.lunar ?? {};
  const previousTurn = history.at(-1);

  if (!normalized && attachments.length > 0) {
    return {
      intent: "attachment",
      action: "answer",
      response: "I can see the attachment is here, but the model is offline. I will keep the conversation open while we wait for the API."
    };
  }

  if (includesAny(normalized, ["companion mode", "natural companion", "陪伴", "自然陪伴"])) {
    return {
      intent: "mode-companion",
      action: "set-mode",
      mode: "companion",
      response: "Returning to Companion mode. I will quiet the interface and keep the Earth breathing."
    };
  }

  if (includesAny(normalized, ["observe mode", "telemetry", "data", "观测", "数据"])) {
    return {
      intent: "mode-observe",
      action: "set-mode",
      mode: "observe",
      response: "Switching to Observe mode. I will surface the local telemetry without crowding the Earth."
    };
  }

  if (includesAny(normalized, ["ask mode", "chat", "conversation", "对话"])) {
    return {
      intent: "mode-ask",
      action: "set-mode",
      mode: "ask",
      response: "Staying in Ask mode. The conversation stays visible while the Earth remains interactive."
    };
  }

  if (includesAny(normalized, ["photo", "memory", "照片", "相册", "地点"])) {
    return {
      intent: "photo-memory",
      action: "focus-photo",
      photoId: "college-park-2024-04-23",
      response: "I found the photo memories on the globe. Hover the city labels to preview them; College Park is the clearest marker right now."
    };
  }

  if (includesAny(normalized, ["where is the moon", "moon"])) {
    const direction = azimuthToDirection(lunar.azimuth);
    const altitude = describeAltitude(lunar.altitude);
    return {
      intent: "moon",
      action: "set-mode",
      mode: "observe",
      focus: "moon",
      response: `The moon is ${altitude} toward ${direction}. I am opening the moon telemetry on the right.`
    };
  }

  if (includesAny(normalized, ["where is the sun", "sun"])) {
    const direction = azimuthToDirection(solar.azimuth);
    const altitude = describeAltitude(solar.altitude);
    return {
      intent: "sun",
      action: "set-mode",
      mode: "observe",
      focus: "sun",
      response: `The sun is ${altitude} toward ${direction}; I am opening the local sunlight telemetry.`
    };
  }

  if (includesAny(normalized, ["what does my sky look like", "my sky", "sky look"])) {
    const cloudCover = snapshot.weather?.cloudCover;
    return {
      intent: "sky",
      action: "set-mode",
      mode: "observe",
      focus: "weather",
      response: cloudCover == null
        ? "Your sky is being estimated locally. I will show the quiet telemetry layer."
        : `Your sky is carrying about ${Math.round(cloudCover)}% cloud cover. I will show the quiet telemetry layer.`
    };
  }

  if (includesAny(normalized, ["when is sunset", "sunset"])) {
    return {
      intent: "sunset",
      action: "set-mode",
      mode: "observe",
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

  if (includesAny(normalized, ["again", "more", "继续", "再说", "还有呢"]) && previousTurn) {
    return {
      intent: "continue",
      action: "answer",
      response: `Continuing from the last turn: ${previousTurn.assistantText || "I will keep the sky context open and stay with this thread."}`
    };
  }

  return {
    intent: "unknown",
    action: "answer",
    response: "The model is offline, so I am using local rules. Try asking about the moon, sun, sunset, night side, sunlight, photos, or modes."
  };
}

function includesAny(value, needles) {
  return needles.some((needle) => value.includes(needle));
}
