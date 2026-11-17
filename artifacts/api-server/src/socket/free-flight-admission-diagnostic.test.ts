import assert from "node:assert/strict";
import test from "node:test";
import { admissionFailureDiagnostic } from "./free-flight-admission-diagnostic";
import { createFreeFlightRuntime } from "./free-flight-runtime";

test("admission diagnostics expose only allowlisted categories through wrapped causes", () => {
  const failure = Object.assign(new Error("private SQL and credentials"), {
    cause: { name: "private account name", code: "42703", message: "private column and user" },
  });
  assert.deepEqual(admissionFailureDiagnostic("initialize-session", failure), {
    event: "orbital_freeflight_admission_failure", phase: "initialize-session",
    errorName: "Error", errorCode: "42703", validation: "unknown",
  });
  const hostile = { name: "secret", code: "secret", cause: null as unknown };
  hostile.cause = hostile;
  assert.equal(admissionFailureDiagnostic("resolve-admission", hostile).errorCode, "unknown");
  assert.equal(admissionFailureDiagnostic("resolve-admission", hostile).errorName, "unknown");
  assert.equal(admissionFailureDiagnostic("resolve-admission", "secret").errorName, "unknown");
});

test("checkpoint diagnostic categories never echo arbitrary validation details", () => {
  assert.equal(admissionFailureDiagnostic("initialize-session",
    new Error("Invalid encounter checkpoint.")).validation, "checkpoint-encounter");
  assert.equal(admissionFailureDiagnostic("initialize-session",
    new Error("Invalid encounter checkpoint. secret value")).validation, "unknown");
  assert.equal(admissionFailureDiagnostic("initialize-session",
    new Error("Invalid free-flight actor checkpoint.")).validation, "checkpoint-actor");
  const dangerous = Object.defineProperty({}, "message", { get() { throw new Error("private"); } });
  assert.doesNotThrow(() => admissionFailureDiagnostic("initialize-session", dangerous));
});

for (const stage of ["resolve-admission", "initialize-session"] as const) {
  test(`admission failure reports ${stage}, fails closed, and allows a later valid join`, async () => {
    let fail = true;
    const packets: Record<string, unknown>[] = [];
    const diagnostics: unknown[] = [];
    const dependencyFailure = Object.assign(new Error("never log this"), { code: "ECONNREFUSED" });
    const runtime = createFreeFlightRuntime({
      resolveAdmission: async () => {
        if (fail && stage === "resolve-admission") throw dependencyFailure;
        return { sessionKey: "mars:diagnostic", faction: "ussf", shipId: "glide" };
      },
      loadCheckpoint: async () => {
        if (fail && stage === "initialize-session") throw dependencyFailure;
        return null;
      },
      onAdmissionFailure: (diagnostic) => {
        diagnostics.push(diagnostic);
        throw new Error("diagnostic sink unavailable");
      },
    });
    const socket = { readyState: 1, bufferedAmount: 0,
      send: (data: string) => packets.push(JSON.parse(data)), close: () => {} };
    try {
      await runtime.handle(socket, "diagnostic-test", { type: "freeflight_join" });
      assert.deepEqual(packets, [{ type: "error", reason: "freeflight_admission_unavailable" }]);
      assert.deepEqual(diagnostics, [{
        event: "orbital_freeflight_admission_failure", phase: stage,
        errorName: "Error", errorCode: "ECONNREFUSED", validation: "unknown",
      }]);
      fail = false;
      await runtime.handle(socket, "diagnostic-test", { type: "freeflight_join" });
      assert.ok(packets.some((packet) => packet.type === "freeflight_joined"));
    } finally {
      await runtime.close();
    }
  });
}
