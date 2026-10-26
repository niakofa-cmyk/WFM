import assert from "node:assert/strict";
import test from "node:test";
import { ACCESS_COOKIE, createStagingAccess, stripAccessCookie } from "./access";
import { readStagingGatewayConfig } from "./config";

const fixtureCode = "synthetic-code-for-isolated-staging-tests";

test("staging access rejects forged, duplicate, expired, revoked and pre-restart sessions", () => {
  let now = 1000;
  const access = createStagingAccess(fixtureCode, () => now, 100);
  const result = access.login(fixtureCode, "test-client");
  assert.ok(result.token && result.session);
  assert.notEqual(result.token, fixtureCode);
  const cookie = `${ACCESS_COOKIE}=${result.token}`;
  assert.ok(access.find(cookie));
  assert.equal(access.find(`${cookie}; ${cookie}`), undefined);
  assert.equal(access.find(`${ACCESS_COOKIE}=${"a".repeat(64)}`), undefined);
  assert.equal(createStagingAccess(fixtureCode).find(cookie), undefined);
  assert.ok(access.revoke(cookie));
  assert.equal(access.find(cookie), undefined);
  const next = access.login(fixtureCode, "test-client");
  now += 101;
  assert.equal(access.find(`${ACCESS_COOKIE}=${next.token}`), undefined);
});

test("access failures throttle without reflecting the supplied code", () => {
  let now = 1000;
  const access = createStagingAccess(fixtureCode, () => now);
  for (let n = 0; n < 5; n++) assert.equal(access.login("incorrect", "test-client").token, undefined);
  assert.ok(access.login(fixtureCode, "test-client").retryAfter);
  now += 10 * 60 * 1000 + 1;
  assert.ok(access.login(fixtureCode, "test-client").token);
});

test("the access cookie is removed without removing Clerk session cookies", () => {
  assert.equal(
    stripAccessCookie(`__session=synthetic; ${ACCESS_COOKIE}=opaque; other=value`),
    "__session=synthetic; other=value",
  );
});

test("gateway configuration fails closed and only permits HTTPS and private upstreams", () => {
  const env = {
    STAGING_GATE_ENABLED: "true",
    STAGING_ACCESS_CODE: fixtureCode,
    STAGING_PUBLIC_ORIGIN: "https://staging.example",
    STAGING_API_UPSTREAM: "http://wfm-api-staging.railway.internal:8080",
    STAGING_SOCKET_UPSTREAM: "http://wfm-socket-staging.railway.internal:8099",
  };
  const config = readStagingGatewayConfig(env, "/synthetic/static/root");
  assert.equal(config.publicOrigin, env.STAGING_PUBLIC_ORIGIN);
  for (const patch of [
    { STAGING_GATE_ENABLED: "false" },
    { STAGING_ACCESS_CODE: "" },
    { STAGING_PUBLIC_ORIGIN: "http://staging.example" },
    { STAGING_PUBLIC_ORIGIN: "https://staging.example/path" },
    { STAGING_API_UPSTREAM: "http://public.example:8080" },
    { STAGING_API_UPSTREAM: "http://user:password@wfm-api-staging.railway.internal:8080" },
    { STAGING_SOCKET_UPSTREAM: "https://wfm-socket-staging.railway.internal" },
  ]) assert.throws(() => readStagingGatewayConfig({ ...env, ...patch }, "/synthetic"));
});
