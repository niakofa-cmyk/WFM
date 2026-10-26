import { startWingSocketServer } from "./server";
import { parseSocketOrigins } from "./origin-policy";

const rawPort = process.env.PORT;
if (!rawPort) throw new Error("PORT environment variable is required.");
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const allowedOrigins = parseSocketOrigins(process.env.WING_ALLOWED_ORIGINS);
if (process.env.NODE_ENV === "production" && !allowedOrigins?.size) {
  throw new Error(
    "WING_ALLOWED_ORIGINS must be configured before running the socket server in production.",
  );
}

const runtime = await startWingSocketServer(port, "0.0.0.0", {
  allowedOrigins,
});
process.stdout.write(`Wing socket server listening on ${runtime.port}\n`);

function shutdown() {
  void runtime.close().catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Wing socket shutdown failed: ${reason}\n`);
    process.exitCode = 1;
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
