/**
 * Selects a stable cyclic slice of an AI roster.
 *
 * This is used only by rulesets that opt into rotating lineups. Older
 * simulation versions keep their original fixed roster order for replay
 * compatibility.
 */
export function selectCyclicRoster<T extends string>(
  roster: readonly T[],
  count: number,
  seed: number,
  excluded?: T,
  offset = 0,
): T[] {
  const available = roster.filter((ship) => ship !== excluded);
  const take = Math.max(0, Math.floor(count));
  if (!Number.isFinite(count) || available.length === 0 || take === 0) return [];

  const normalizedSeed = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
  const normalizedOffset = Number.isFinite(offset) ? Math.trunc(offset) : 0;
  const start = ((normalizedSeed % available.length) + (normalizedOffset % available.length) + available.length) % available.length;
  return [...available.slice(start), ...available.slice(0, start)].slice(0, take);
}
