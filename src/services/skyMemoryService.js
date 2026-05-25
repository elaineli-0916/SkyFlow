import { PHOTO_MEMORY_MARKERS } from "./photoMemoryService.js";

export const SKY_MEMORY_STORAGE_KEY = "skyflow.skyMemories.v1";

export function loadSkyMemories() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SKY_MEMORY_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSkyMemory);
  } catch {
    return [];
  }
}

export function saveSkyMemories(memories) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SKY_MEMORY_STORAGE_KEY, JSON.stringify(memories.filter(isValidSkyMemory)));
}

export function addSkyMemory(memory) {
  const current = loadSkyMemories();
  const next = [memory, ...current.filter((item) => item.id !== memory.id)].slice(0, 24);
  saveSkyMemories(next);
  return next;
}

export function buildPhotoMemoryMarkers(userMemories = []) {
  return [
    ...userMemories.map((memory) => ({
      id: memory.id,
      label: memory.label,
      region: memory.region,
      latitude: memory.latitude,
      longitude: memory.longitude,
      capturedAt: memory.capturedAt,
      imageUrl: memory.thumbnailDataUrl,
      description: memory.description,
      note: memory.note ?? "",
      tags: memory.tags ?? [],
      source: "local-memory"
    })),
    ...PHOTO_MEMORY_MARKERS
  ];
}

export function createSkyMemory({ attachment, location, capturedAt, description, tags }) {
  const createdAt = new Date().toISOString();
  const label = location.name || "Sky memory";
  const region = location.region || location.country || "Local sky";

  return {
    id: `sky-memory-${createdAt.replace(/[^0-9]/g, "")}`,
    label,
    region,
    latitude: location.latitude,
    longitude: location.longitude,
    capturedAt: capturedAt || createdAt,
    createdAt,
    description: description || "A saved sky memory.",
    note: location.note ?? "",
    tags: Array.isArray(tags) ? tags.slice(0, 6) : [],
    thumbnailDataUrl: attachment.thumbnailDataUrl || attachment.dataUrl,
    attachmentName: attachment.name
  };
}

function isValidSkyMemory(memory) {
  return (
    memory &&
    typeof memory.id === "string" &&
    typeof memory.label === "string" &&
    Number.isFinite(memory.latitude) &&
    Number.isFinite(memory.longitude) &&
    typeof memory.thumbnailDataUrl === "string"
  );
}
