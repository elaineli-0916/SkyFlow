import { handleAsrTranscribe } from "../../server/routes/asr.js";
import { createApiHandler } from "../_utils/serverless.js";

export const config = {
  maxDuration: 60
};

export default createApiHandler(handleAsrTranscribe, { methods: ["POST"] });
