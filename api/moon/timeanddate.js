import { handleTimeAndDateMoon } from "../../server/routes/moon.js";
import { createApiHandler } from "../_utils/serverless.js";

export const config = {
  maxDuration: 30
};

export default createApiHandler(async (request, response) => {
  const url = new URL(request.url, `https://${request.headers.host ?? "skyflow.local"}`);
  await handleTimeAndDateMoon(request, response, url);
}, { methods: ["GET"] });
