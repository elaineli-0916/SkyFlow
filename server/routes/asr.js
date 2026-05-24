import { getConfiguredAsrModel, transcribeAudio } from "../services/asrService.js";
import { send } from "../services/responseService.js";

const MAX_BODY_SIZE = 8 * 1024 * 1024;

export async function handleAsrTranscribe(request, response) {
  const body = await readJsonBody(request);
  const result = await transcribeAudio({
    audioBase64: body.audioBase64,
    format: body.format ?? "pcm",
    sampleRate: Number(body.sampleRate ?? 16000)
  });

  send(response, 200, {
    text: result.text,
    model: result.model,
    usage: result.usage ?? null
  });
}

export function getAsrHealth() {
  return {
    model: getConfiguredAsrModel()
  };
}

async function readJsonBody(request) {
  if (request.body) {
    return typeof request.body === "string" ? JSON.parse(request.body) : request.body;
  }

  let size = 0;
  const chunks = [];

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      throw new Error("ASR request body is too large");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
