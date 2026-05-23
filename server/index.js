import http from "node:http";
import { URL } from "node:url";
import { getAsrHealth, handleAsrTranscribe } from "./routes/asr.js";
import { handleEarthChat } from "./routes/earthChat.js";
import { loadEnvFile } from "./services/envService.js";
import { getConfiguredQwenModel } from "./services/qwenService.js";
import { send } from "./services/responseService.js";

loadEnvFile();

const port = Number(process.env.SERVER_PORT ?? 8787);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    send(response, 204, null);
    return;
  }

  try {
    if (request.method === "POST" && url.pathname === "/api/earth/chat") {
      await handleEarthChat(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/asr/transcribe") {
      await handleAsrTranscribe(request, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      send(response, 200, { ok: true, model: getConfiguredQwenModel(), asr: getAsrHealth() });
      return;
    }

    send(response, 404, { error: "Not found" });
  } catch (error) {
    send(response, 500, {
      error: "SkyFlow backend error",
      detail: error.message
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SkyFlow API listening on http://127.0.0.1:${port}`);
});
