export type AdmissionPhase = "resolve-admission" | "patrol-directory" |
  "prior-session" | "initialize-session" | "initialize-pilot" |
  "publish-join" | "opening-engagement";

// Never serialize arbitrary error names, messages, stacks, identifiers or SQL.
const SAFE_CODES = new Set([
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND",
  "EAI_AGAIN", "42P01", "42703", "42501", "53300", "57P01",
  "08001", "08006", "23505", "23503",
]);
const SAFE_NAMES = new Set([
  "Error", "TypeError", "RangeError", "SyntaxError", "AbortError",
]);

export function admissionFailureDiagnostic(phase: AdmissionPhase, failure: unknown) {
  let errorName = "unknown";
  let errorCode = "unknown";
  let current = failure;
  const seen = new Set<unknown>();
  // Drizzle and other adapters wrap dependency errors in a bounded cause chain.
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    if (seen.has(current)) break;
    seen.add(current);
    try {
      const error = current as { name?: unknown; code?: unknown; cause?: unknown };
      if (typeof error.name === "string" && SAFE_NAMES.has(error.name)) {
        errorName = error.name;
      }
      if (typeof error.code === "string" && SAFE_CODES.has(error.code)) {
        errorCode = error.code;
      }
      current = error.cause;
    } catch {
      break;
    }
  }
  return { event: "orbital_freeflight_admission_failure" as const, phase, errorName, errorCode };
}
