import { getAsrHealth } from "../server/routes/asr.js";
import { getConfiguredQwenModel } from "../server/services/qwenService.js";
import { send } from "../server/services/responseService.js";
import { createApiHandler } from "./_utils/serverless.js";

export default createApiHandler((_request, response) => {
  send(response, 200, {
    ok: true,
    model: getConfiguredQwenModel(),
    asr: getAsrHealth()
  });
}, { methods: ["GET"] });
