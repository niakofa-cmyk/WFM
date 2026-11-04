export function combatLockCue({
  targetActive,
  canAcquire,
  lockHeld,
  lock,
}: {
  targetActive: boolean;
  canAcquire: boolean;
  lockHeld: boolean;
  lock: number;
}): string {
  if (!targetActive) return "NO HOSTILE CONTACT · FOLLOW THE OBJECTIVE";
  if (lock >= 1) return "LOCK CONFIRMED · TAP MISSILE";
  if (!canAcquire) return "NO LOCK SOLUTION · AIM, CLOSE, OR CLEAR COVER";
  if (lockHeld) return `ACQUIRING LOCK · ${Math.round(Math.max(0, Math.min(1, lock)) * 100)}%`;
  return "CENTER THE CONTACT · HOLD LOCK";
}
