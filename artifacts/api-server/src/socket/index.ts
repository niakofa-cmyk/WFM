import { startWingSocketServer } from "./server";

const rawPort = process.env.PORT;
if (!rawPort) throw new Error("PORT environment variable is required.");
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const runtime = await startWingSocketServer(port);
process.stdout.write(`Wing socket server listening on ${runtime.port}\n`);

async function shutdown() {
  await runtime.close();
}

process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
