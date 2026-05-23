import fs from "node:fs/promises";
import path from "node:path";

const DASHSCOPE_COMPAT_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const DEFAULT_QWEN_MODEL = "qwen3.5-omni-plus";
const MODEL_ALIASES = new Map([
  ["qwen-omni", DEFAULT_QWEN_MODEL],
  ["qwen3-omni", DEFAULT_QWEN_MODEL],
  ["qwen3.5-omni", DEFAULT_QWEN_MODEL]
]);

export async function callQwen({ text, attachments, context }) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is missing. Add it to .env.local.");
  }

  const model = getConfiguredQwenModel();
  const requestBody = buildRequestBody({ model, text, attachments, context });

  const response = await fetch(DASHSCOPE_COMPAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(formatProviderError(responseText, response.status, model));
  }

  if (requestBody.stream) {
    return parseModelResponse(parseStreamingText(responseText));
  }

  const data = parseJson(responseText);
  return parseModelResponse(data?.choices?.[0]?.message?.content);
}

export function getConfiguredQwenModel() {
  return normalizeQwenModelName(process.env.QWEN_MODEL);
}

export function normalizeQwenModelName(modelName) {
  const normalized = String(modelName || DEFAULT_QWEN_MODEL).trim();
  return MODEL_ALIASES.get(normalized) ?? normalized;
}

function buildRequestBody({ model, text, attachments, context }) {
  const stream = isOmniModel(model);
  return {
    model,
    messages: [
      {
        role: "system",
        content: getSystemPromptText()
      },
      {
        role: "user",
        content: buildUserContent(text, attachments, context)
      }
    ],
    temperature: 0.7,
    ...(stream
      ? {
          stream: true,
          stream_options: { include_usage: true },
          modalities: ["text"]
        }
      : {})
  };
}

function isOmniModel(model) {
  return String(model).toLowerCase().includes("omni");
}

let systemPromptText;

function getSystemPromptText() {
  if (!systemPromptText) {
    throw new Error("System prompt has not loaded yet.");
  }
  return systemPromptText;
}

async function ensureSystemPromptLoaded() {
  if (!systemPromptText) {
    systemPromptText = await getSystemPrompt();
  }
}

function buildUserContent(text, attachments = [], context) {
  const content = [
    {
      type: "text",
      text: [
        `User message: ${text || "(no text)"}`,
        "",
        "SkyFlow context:",
        JSON.stringify(context, null, 2),
        "",
        "Return compact JSON only with this shape:",
        "{\"text\":\"...\",\"actions\":[],\"memoriesToSave\":[]}",
        "",
        "Use actions only when the UI should visibly do something. Do not include set_mode observe unless the user asked for spatial sky, sun, moon, cloud, weather, or local telemetry."
      ].join("\n")
    }
  ];

  for (const attachment of attachments) {
    if (attachment.kind === "image") {
      content.push({
        type: "image_url",
        image_url: {
          url: attachment.dataUrl
        }
      });
    }

    if (attachment.kind === "audio") {
      content.push({
        type: "input_audio",
        input_audio: {
          data: stripDataUrlPrefix(attachment.dataUrl),
          format: getAudioFormat(attachment)
        }
      });
    }
  }

  return content;
}

async function getSystemPrompt() {
  const promptPath = path.resolve(process.cwd(), "server/prompts/earthCompanion.md");
  return fs.readFile(promptPath, "utf8");
}

function parseStreamingText(responseText) {
  return responseText
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace(/^data:\s*/, "").trim())
    .filter((line) => line && line !== "[DONE]")
    .map((line) => parseJson(line))
    .map((chunk) => extractChunkContent(chunk))
    .filter(Boolean)
    .join("");
}

function extractChunkContent(chunk) {
  const delta = chunk?.choices?.[0]?.delta;
  const message = chunk?.choices?.[0]?.message;
  return stringifyContent(delta?.content ?? message?.content ?? "");
}

function stringifyContent(content) {
  if (Array.isArray(content)) {
    return content.map((item) => item?.text ?? item?.content ?? "").join("");
  }
  return String(content ?? "");
}

function parseModelResponse(content) {
  const rawText = Array.isArray(content)
    ? content.map((item) => item.text ?? "").join("\n")
    : String(content ?? "");

  const jsonText = extractJson(rawText);

  if (!jsonText) {
    return {
      text: rawText || "I am listening from orbit.",
      actions: [],
      memoriesToSave: []
    };
  }

  try {
    const parsed = JSON.parse(jsonText);
    return {
      text: parsed.text ?? rawText,
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      memoriesToSave: Array.isArray(parsed.memoriesToSave) ? parsed.memoriesToSave : []
    };
  } catch {
    return {
      text: rawText,
      actions: [],
      memoriesToSave: []
    };
  }
}

function extractJson(value) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return value.slice(start, end + 1);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function formatProviderError(responseText, status, model) {
  const data = parseJson(responseText);
  const detail = data?.message ?? data?.error?.message ?? responseText;
  return `Qwen request failed for ${model} (${status}): ${detail || "Unknown provider error"}`;
}

function stripDataUrlPrefix(dataUrl = "") {
  return dataUrl.replace(/^data:[^;]+;base64,/, "");
}

function getAudioFormat(attachment) {
  if (attachment.mimeType?.includes("wav")) return "wav";
  if (attachment.mimeType?.includes("mpeg") || attachment.mimeType?.includes("mp3")) return "mp3";
  if (attachment.mimeType?.includes("mp4")) return "mp4";
  if (attachment.name?.endsWith(".wav")) return "wav";
  if (attachment.name?.endsWith(".m4a")) return "mp4";
  return "mp3";
}

await ensureSystemPromptLoaded();
