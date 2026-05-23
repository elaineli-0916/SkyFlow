import { buildEarthContext } from "../services/earthContextService.js";
import { callQwen } from "../services/qwenService.js";
import { getRelevantMemories, saveMemoryCandidates } from "../services/memoryService.js";
import { send } from "../services/responseService.js";

const MAX_BODY_SIZE = 18 * 1024 * 1024;

export async function handleEarthChat(request, response) {
  const body = await readJsonBody(request);
  const memories = await getRelevantMemories(body);
  const context = buildEarthContext(body, memories);
  const result = await callQwen({
    text: body.text,
    attachments: body.attachments ?? [],
    context
  });

  await saveMemoryCandidates(result.memoriesToSave ?? [], body);

  send(response, 200, {
    text: result.text,
    actions: result.actions ?? [],
    memoriesToSave: result.memoriesToSave ?? []
  });
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      throw new Error("Request body is too large");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
