import type { Goal } from "./sim";

export function winConditionFor(goal: Goal): string {
  switch (goal) {
    case "disc":
      return "Hold two relays to drain enemy integrity. If time expires first, the wing with more integrity wins; a tie is a draw.";
    case "beacons":
      return "Secure two of three beacons. Your wing loses if its integrity is depleted or time expires before the objective is complete.";
    case "ace":
      return "Destroy the marked Warden. Other kills will not end this sortie; a living Warden at the deadline means failure.";
    case "extract":
      return "Stop the opposing cage before it escapes, or escort your cage across the extraction line. Protect your own integrity.";
  }
}
