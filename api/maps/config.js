import { handleMapsConfig } from "../../server/routes/mapTiles.js";
import { createApiHandler } from "../_utils/serverless.js";

export default createApiHandler(handleMapsConfig, { methods: ["GET"] });
