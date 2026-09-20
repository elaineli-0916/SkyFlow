export const ACTION_KINDS = ["fly_to", "show_overlay", "show_photo", "show_moon_path", "narrate"];

export function validateAction(action) {
  if (!action || !ACTION_KINDS.includes(action.type)) return false;
  if (action.type === "fly_to" && typeof action.cityId !== "string") return false;
  if (["show_overlay", "show_photo", "show_moon_path"].includes(action.type) && typeof action.visible !== "boolean") return false;
  if (action.type === "narrate" && typeof action.text !== "string") return false;
  return true;
}

export function validateActionPlan(plan) { return Array.isArray(plan) && plan.length <= 24 && plan.every(validateAction); }

export function createCityActionPlan(cityId) {
  return [
    { type: "fly_to", cityId: cityId ?? "hong-kong", duration: 3.2 },
    { type: "show_overlay", visible: true },
    { type: "show_photo", visible: true },
    { type: "narrate", text: "潮汐之间，城市醒来。" }
  ];
}

export function parseDirectorInput(input) {
  const text = String(input ?? "").toLowerCase();
  const cityId = text.includes("beijing") || text.includes("北京") ? "beijing" : text.includes("new york") || text.includes("纽约") ? "new-york" : "hong-kong";
  return createCityActionPlan(cityId);
}

export async function runActionPlan(plan, handlers, { signal } = {}) {
  if (!validateActionPlan(plan)) throw new Error("Invalid SkyFlow action plan");
  for (const action of plan) {
    if (signal?.aborted) throw new DOMException("Action plan cancelled", "AbortError");
    if (handlers[action.type]) await handlers[action.type](action, { signal });
  }
}
