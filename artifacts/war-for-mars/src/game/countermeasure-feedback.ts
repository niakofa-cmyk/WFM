export function countermeasureFeedbackLabel(decoyed: number, disrupted: number) {
  const decoys = Number.isFinite(decoyed) ? Math.max(0, Math.floor(decoyed)) : 0;
  const disruptions = Number.isFinite(disrupted) ? Math.max(0, Math.floor(disrupted)) : 0;
  if (decoys > 0 && disruptions > 0) {
    return `${decoys} DECOYED · ${disruptions} DISRUPTED`;
  }
  if (decoys > 0) return `${decoys} MISSILE${decoys === 1 ? "" : "S"} DECOYED`;
  if (disruptions > 0) return `${disruptions} GUIDANCE DISRUPTED`;
  return "COUNTERMEASURE RELEASED";
}
