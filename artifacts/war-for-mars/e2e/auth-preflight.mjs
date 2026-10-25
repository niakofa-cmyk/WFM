const missingSecrets = ["CLERK_SECRET_KEY", "VITE_CLERK_PUBLISHABLE_KEY"].filter(
  (name) => !process.env[name]?.trim(),
);

if (missingSecrets.length) {
  console.error(
    `Authenticated WFM E2E is blocked. Missing Replit Development secrets: ${missingSecrets.join(", ")}.`,
  );
  process.exit(1);
}

if (!process.env.WFM_E2E_EMAIL?.trim()) {
  console.error("Authenticated WFM E2E is blocked. Add the Development environment variable: WFM_E2E_EMAIL.");
  process.exit(1);
}

if (
  !process.env.CLERK_SECRET_KEY.startsWith("sk_test_") ||
  !process.env.VITE_CLERK_PUBLISHABLE_KEY.startsWith("pk_test_")
) {
  console.error("Authenticated WFM E2E requires Development Clerk test keys; no key values were displayed.");
  process.exit(1);
}

const apiUrl = new URL("http://127.0.0.1:8080/api/readyz");
try {
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error("not ready");
} catch {
  console.error("Authenticated WFM E2E needs the local API workflow ready at 127.0.0.1:8080.");
  process.exit(1);
}
