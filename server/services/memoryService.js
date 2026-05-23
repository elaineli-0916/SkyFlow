import fs from "node:fs/promises";
import path from "node:path";

const MEMORY_PATH = path.resolve(process.cwd(), "server/storage/memories.json");

export async function getRelevantMemories() {
  const memories = await readMemories();
  return memories.slice(-12);
}

export async function saveMemoryCandidates(candidates = [], source = {}) {
  const meaningful = candidates
    .filter((candidate) => typeof candidate === "string" && candidate.trim().length > 0)
    .map((value) => ({
      id: `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "profile",
      text: value.trim(),
      source: source.mode ?? "ask",
      createdAt: new Date().toISOString()
    }));

  if (meaningful.length === 0) return;

  const memories = await readMemories();
  await writeMemories([...memories, ...meaningful].slice(-200));
}

async function readMemories() {
  try {
    const value = await fs.readFile(MEMORY_PATH, "utf8");
    return JSON.parse(value);
  } catch {
    return [];
  }
}

async function writeMemories(memories) {
  await fs.mkdir(path.dirname(MEMORY_PATH), { recursive: true });
  await fs.writeFile(MEMORY_PATH, `${JSON.stringify(memories, null, 2)}\n`);
}
