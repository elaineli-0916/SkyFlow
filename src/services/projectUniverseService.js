export const PROJECT_UNIVERSE_ITEMS = [
  {
    id: "skyflow",
    title: "SkyFlow",
    label: "Earth Core",
    category: "AI-native Earth companion",
    summary: "A living globe that turns light, clouds, moon data, and sky memories into an interface you can observe and ask.",
    detail: "The center object keeps the original SkyFlow identity visible while the rest of the universe becomes your portfolio.",
    position: [0, 0, 0],
    focusPosition: [0.2, 1.1, 3.15],
    focusLookAt: [0, 0.1, 0],
    accent: "#84ffd8",
    model: "core"
  },
  {
    id: "ai-coding",
    title: "AI Coding Workflow",
    label: "Workflow Console",
    category: "Engineering control system",
    summary: "A practical loop for using agents without losing engineering control: inspect, plan, implement, verify, and keep evidence.",
    detail: "This object represents the craft layer behind the portfolio: reproducible commands, scoped edits, and verifiable outcomes.",
    position: [-2.25, 0.74, -0.95],
    focusPosition: [-2.65, 1.28, 2.05],
    focusLookAt: [-2.25, 0.68, -0.95],
    accent: "#ffd166",
    model: "console"
  },
  {
    id: "interview-agent",
    title: "Interview Agent",
    label: "Studio",
    category: "Practice and evaluation",
    summary: "A multi-step interview practice system with role-specific prompts, replay, coaching signals, and evaluation framing.",
    detail: "The studio object turns preparation into an interactive room: question, answer, replay, and improve.",
    position: [2.18, 0.62, -0.98],
    focusPosition: [2.54, 1.2, 2.02],
    focusLookAt: [2.18, 0.62, -0.98],
    accent: "#ff8fa3",
    model: "studio"
  },
  {
    id: "rag-docs",
    title: "RAG Document System",
    label: "Knowledge Block",
    category: "Traceable knowledge work",
    summary: "A document workflow for parsing, tracing, explaining, and exporting knowledge without losing source evidence.",
    detail: "This block stands for source-grounded work: every answer should know where it came from.",
    position: [-1.82, -0.7, 1.35],
    focusPosition: [-2.24, 0.05, 3.18],
    focusLookAt: [-1.82, -0.62, 1.35],
    accent: "#b8f7ff",
    model: "block"
  },
  {
    id: "photo-memory",
    title: "Photo Memory Atlas",
    label: "Film Star",
    category: "Personal sky memory",
    summary: "A way to place photos, location, time, and feeling back onto the Earth instead of leaving them as flat files.",
    detail: "This object connects the homepage to SkyFlow's memory layer: places, photos, and personal context.",
    position: [1.78, -0.72, 1.35],
    focusPosition: [2.2, 0.02, 3.16],
    focusLookAt: [1.78, -0.62, 1.35],
    accent: "#c7a7ff",
    model: "film"
  },
  {
    id: "about",
    title: "About Elaine",
    label: "Profile Capsule",
    category: "Personal signal",
    summary: "A compact profile surface for who you are, what you build, and why the projects fit together.",
    detail: "The capsule anchors the universe so visitors understand the person behind the systems.",
    position: [0, 2.05, -1.42],
    focusPosition: [0, 2.36, 2.1],
    focusLookAt: [0, 1.86, -1.42],
    accent: "#f5f7fa",
    model: "capsule"
  }
];

export function getProjectUniverseItem(projectId) {
  return PROJECT_UNIVERSE_ITEMS.find((item) => item.id === projectId) ?? null;
}
