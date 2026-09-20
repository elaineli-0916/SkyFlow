import { handleMapTiles } from "../../server/routes/mapTiles.js";
import { createApiHandler } from "../_utils/serverless.js";

export default createApiHandler((request, response) => {
  const url = new URL(request.url, "https://skyflow.local");
  return handleMapTiles(request, response, url);
}, { methods: ["GET"] });
