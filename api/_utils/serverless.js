import { loadEnvFile } from "../../server/services/envService.js";
import { send } from "../../server/services/responseService.js";

loadEnvFile();

export function createApiHandler(handler, { methods = [] } = {}) {
  return async function apiHandler(request, response) {
    if (request.method === "OPTIONS") {
      send(response, 204, null);
      return;
    }

    if (methods.length > 0 && !methods.includes(request.method)) {
      send(response, 405, { error: "Method not allowed" });
      return;
    }

    try {
      await handler(request, response);
    } catch (error) {
      send(response, 500, {
        error: "SkyFlow backend error",
        detail: error.message
      });
    }
  };
}
