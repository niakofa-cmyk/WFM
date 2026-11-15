/** External hosting must use the selected instance, never a hostname-derived key. */
export function configuredClerkPublishableKey(value: string | undefined): string {
  const key = value?.trim();
  if (!key) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY.");
  return key;
}
