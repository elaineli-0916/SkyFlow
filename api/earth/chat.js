import { handleEarthChat } from "../../server/routes/earthChat.js";
import { createApiHandler } from "../_utils/serverless.js";

export const config = {
  maxDuration: 60
};

export default createApiHandler(handleEarthChat, { methods: ["POST"] });
