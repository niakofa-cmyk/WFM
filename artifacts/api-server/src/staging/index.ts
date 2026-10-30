import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../lib/logger";
import { readStagingGatewayConfig } from "./config";
import { createStagingGateway } from "./gateway";

const staticRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../war-for-mars/dist/public",
);
const config = readStagingGatewayConfig(process.env, staticRoot);
if (!existsSync(path.join(staticRoot, "index.html"))) {
  throw new Error("Build the WFM frontend before starting the staging gateway.");
}
const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("A valid PORT must be configured for the staging gateway.");
}
const gateway = createStagingGateway(config);
gateway.server.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Private WFM staging gateway listening");
});
async function shutdown() {
  await gateway.close();
}
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
