import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("Replit Production keeps the game API same-origin instead of routing to Railway", () => {
  const repl = read(".replit");
  const production = repl.split("[userenv.production]")[1] ?? "";

  assert.match(production, /VITE_API_BASE_URL\s*=\s*""/);
  assert.doesNotMatch(production, /railway\.app/i);
});

test("Replit Production routes the frontend, API, and socket through one origin", () => {
  const apiArtifact = read("artifacts/api-server/.replit-artifact/artifact.toml");

  assert.match(apiArtifact, /paths\s*=\s*\["\/api"\]/);
  assert.match(apiArtifact, /paths\s*=\s*\["\/ws",\s*"\/healthz"\]/);
  assert.match(apiArtifact, /API_ALLOWED_ORIGINS\s*=\s*"https:\/\/niakofa\.com"/);
  assert.match(apiArtifact, /WING_ALLOWED_ORIGINS\s*=\s*"https:\/\/niakofa\.com"/);
  assert.match(apiArtifact, /WFM_CLERK_AUTH_PROVIDER\s*=\s*"replit-managed"/);
  assert.match(apiArtifact, /WFM_CLERK_BACKEND_HOSTING\s*=\s*"replit"/);
});
