import { startWingSocketServer } from "./server";
import { createClerkSocketVerifier } from "./auth";

const rawPort = process.env.PORT;
if (!rawPort) throw new Error("PORT environment variable is required.");
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const verifySession = createClerkSocketVerifier({
  jwtKey: process.env.CLERK_JWT_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
  authorizedParties: (process.env.WFM_SOCKET_AUTHORIZED_PARTIES ?? "").split(",").map((value) => value.trim()).filter(Boolean),
});
const runtime = await startWingSocketServer(port, "0.0.0.0", { verifySession });
process.stdout.write(`Wing socket server listening on ${runtime.port}\n`);

async function shutdown() {
  await runtime.close();
}

process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
