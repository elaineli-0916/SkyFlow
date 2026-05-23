import WebSocket from "ws";

const DASHSCOPE_ASR_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference";
const DEFAULT_ASR_MODEL = "paraformer-realtime-v2";
const ASR_MODEL_ALIASES = new Map([
  ["paraformer-v2", DEFAULT_ASR_MODEL],
  ["paraformer", DEFAULT_ASR_MODEL],
  ["paraformer-realtime", DEFAULT_ASR_MODEL]
]);
const CHUNK_BYTES = 3200;
const SEND_INTERVAL_MS = 100;

export async function transcribeAudio({ audioBase64, format = "pcm", sampleRate = 16000 }) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is missing. Add it to .env.local.");
  }

  const audio = Buffer.from(stripDataUrlPrefix(audioBase64), "base64");
  if (audio.length === 0) {
    throw new Error("No microphone audio was received.");
  }

  const model = getConfiguredAsrModel();
  const result = await runRealtimeAsr({ apiKey, audio, format, sampleRate, model });
  return {
    text: result.text,
    model,
    usage: result.usage
  };
}

export function getConfiguredAsrModel() {
  const configured = String(process.env.DASHSCOPE_ASR_MODEL || DEFAULT_ASR_MODEL).trim();
  return ASR_MODEL_ALIASES.get(configured) ?? configured;
}

function runRealtimeAsr({ apiKey, audio, format, sampleRate, model }) {
  return new Promise((resolve, reject) => {
    const taskId = crypto.randomUUID();
    const transcriptParts = [];
    let latestPartial = "";
    let usage = null;
    let started = false;
    let finished = false;
    let sendTimer;
    let timeout;

    const websocket = new WebSocket(process.env.DASHSCOPE_ASR_WS_URL || DASHSCOPE_ASR_WS_URL, [], {
      headers: {
        Authorization: `bearer ${apiKey}`
      }
    });

    function cleanup() {
      clearInterval(sendTimer);
      clearTimeout(timeout);
      websocket.off("open", handleOpen);
      websocket.off("message", handleMessage);
      websocket.off("error", handleError);
      websocket.off("close", handleClose);
      if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
        websocket.close();
      }
    }

    function fail(error) {
      if (finished) return;
      finished = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    }

    function succeed() {
      if (finished) return;
      finished = true;
      cleanup();
      const finalText = transcriptParts.join(" ").trim() || latestPartial.trim();
      resolve({ text: finalText, usage });
    }

    function handleOpen() {
      timeout = setTimeout(() => fail(new Error("ASR request timed out.")), 30000);
      websocket.send(
        JSON.stringify({
          header: {
            action: "run-task",
            task_id: taskId,
            streaming: "duplex"
          },
          payload: {
            task_group: "audio",
            task: "asr",
            function: "recognition",
            model,
            parameters: {
              format,
              sample_rate: sampleRate,
              disfluency_removal_enabled: false,
              semantic_punctuation_enabled: false,
              punctuation_prediction_enabled: true,
              inverse_text_normalization_enabled: true,
              language_hints: ["zh", "en"]
            },
            input: {}
          }
        })
      );
    }

    function handleMessage(data) {
      const message = parseJson(Buffer.isBuffer(data) ? data.toString("utf8") : String(data ?? ""));
      const type = message?.header?.event;

      if (type === "task-started") {
        started = true;
        sendAudioAndFinish(websocket, taskId, audio);
        return;
      }

      if (type === "result-generated") {
        const sentence = message?.payload?.output?.sentence;
        const text = sentence?.text?.trim();
        if (text) {
          if (sentence?.sentence_end || sentence?.end_time != null) {
            transcriptParts.push(text);
            latestPartial = "";
          } else {
            latestPartial = text;
          }
        }
        if (message?.payload?.usage) {
          usage = message.payload.usage;
        }
        return;
      }

      if (type === "task-finished") {
        succeed();
        return;
      }

      if (type === "task-failed") {
        fail(new Error(message?.header?.error_message || "ASR task failed."));
      }
    }

    function handleError(error) {
      fail(new Error(error?.message || "Could not connect to DashScope ASR."));
    }

    function handleClose(code, reason) {
      if (!finished && !started) {
        fail(new Error(`ASR connection closed before the task started (${code}${reason ? `: ${reason}` : ""}).`));
      }
    }

    function sendAudioAndFinish(socket, id, buffer) {
      let offset = 0;
      sendTimer = setInterval(() => {
        if (offset >= buffer.length) {
          clearInterval(sendTimer);
          socket.send(
            JSON.stringify({
              header: {
                action: "finish-task",
                task_id: id,
                streaming: "duplex"
              },
              payload: {
                input: {}
              }
            })
          );
          return;
        }

        const chunk = buffer.subarray(offset, offset + CHUNK_BYTES);
        socket.send(chunk);
        offset += CHUNK_BYTES;
      }, SEND_INTERVAL_MS);
    }

    websocket.on("open", handleOpen);
    websocket.on("message", handleMessage);
    websocket.on("error", handleError);
    websocket.on("close", handleClose);
  });
}

function stripDataUrlPrefix(dataUrl = "") {
  return dataUrl.replace(/^data:[^;]+;base64,/, "");
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
