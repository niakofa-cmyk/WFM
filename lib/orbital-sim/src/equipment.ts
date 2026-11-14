/** Shared military fitting rules. Combat units remain Orbital world metres/seconds. */
export type EquipmentKind = "primary" | "secondary" | "special" | "defensive" | "utility";
export type EquipmentEffect = "gun" | "missile" | "plasma" | "emp" | "warhead" | "countermeasure" |
  "sensor" | "ew" | "shield" | "armor" | "power" | "comms";
export type EquipmentDefinition = {
  id: string; name: string; kind: EquipmentKind; effect: EquipmentEffect; description: string;
  size: number; mass: number; power: number;
  damage: number; ammunition: number; magazine: number; roundsPerMinute: number;
  range: number; projectileVelocity: number; tracking: number; lockSeconds: number;
  reloadSeconds: number; heat: number; durability: number; energy: number;
};
const module = (definition: Pick<EquipmentDefinition, "id" | "name" | "kind" | "effect" | "description"> &
  Partial<EquipmentDefinition>): EquipmentDefinition => ({
  size: 1, mass: 2, power: 2, damage: 0, ammunition: 0, magazine: 0, roundsPerMinute: 0,
  range: 0, projectileVelocity: 0, tracking: 0, lockSeconds: 0, reloadSeconds: 0,
  heat: 0, durability: 100, energy: 0, ...definition,
});
export const EQUIPMENT_CATALOG: readonly EquipmentDefinition[] = [
  module({ id: "autocannon", name: "M20 Autocannon", kind: "primary", effect: "gun",
    description: "Balanced kinetic cannon. Automatic magazine reload; physical contact applies damage.",
    damage: 5, ammunition: 900, magazine: 90, roundsPerMinute: 300, range: 360,
    projectileVelocity: 120, reloadSeconds: 2.5, heat: 3 }),
  module({ id: "rotary-gun", name: "Vulcan Rotary Gun", kind: "primary", effect: "gun",
    description: "Fast, light rounds. High ammunition use and sustained heat.",
    damage: 2.2, ammunition: 2400, magazine: 240, roundsPerMinute: 720, range: 270,
    projectileVelocity: 135, reloadSeconds: 3, heat: 1.8 }),
  module({ id: "railgun", name: "Longbow Railgun", kind: "primary", effect: "gun", size: 2, mass: 8, power: 7,
    description: "Precision kinetic penetrator. Slow cadence, substantial reactor demand.",
    damage: 24, ammunition: 120, magazine: 12, roundsPerMinute: 60, range: 1000,
    projectileVelocity: 260, reloadSeconds: 4, heat: 20, energy: 6 }),
  module({ id: "capital-cannon", name: "Citadel Capital Cannon", kind: "primary", effect: "gun",
    description: "Capital-class mount. None of the current fighter hulls can carry this weapon.",
    size: 4, mass: 80, power: 60, damage: 140, ammunition: 60, magazine: 6,
    roundsPerMinute: 12, range: 1800, projectileVelocity: 150, reloadSeconds: 10, heat: 65, energy: 30 }),
  module({ id: "seeker", name: "Kestrel Active Seeker", kind: "secondary", effect: "missile",
    description: "Active seeker. Requires an acquired target at launch; continues tracking independently.",
    damage: 52, ammunition: 12, magazine: 2, roundsPerMinute: 20, range: 160,
    projectileVelocity: 48, tracking: 3.4, lockSeconds: 1, reloadSeconds: 5, heat: 12, energy: 2 }),
  module({ id: "rocket", name: "Javelin Unguided Rocket", kind: "secondary", effect: "missile",
    description: "Direct-fire rocket. No target lock or homing; fire along the ship's forward axis.",
    damage: 34, ammunition: 24, magazine: 6, roundsPerMinute: 60, range: 200,
    projectileVelocity: 65, reloadSeconds: 4, heat: 8 }),
  module({ id: "torpedo", name: "Hammer Heavy Torpedo", kind: "secondary", effect: "missile", size: 3, mass: 15, power: 6,
    description: "Heavy anti-platform ordnance. Restricted to heavy mounts; slow turn rate.",
    damage: 110, ammunition: 8, magazine: 1, roundsPerMinute: 10, range: 260,
    projectileVelocity: 28, tracking: 1.2, lockSeconds: 2, reloadSeconds: 7, heat: 28, energy: 8 }),
  module({ id: "plasma", name: "Plasma Feed Capacitor", kind: "special", effect: "plasma", size: 2, mass: 5, power: 6,
    description: "Automatically energizes primary rounds: +20% damage, +3 heat and +2 energy per shot.",
    heat: 3, energy: 2 }),
  module({ id: "emp", name: "EMP Contact Injector", kind: "special", effect: "emp", mass: 4, power: 5,
    description: "Primary hits suppress hostile targeting for 0.6 seconds. Consumes +3 energy per shot.",
    heat: 2, energy: 3 }),
  module({ id: "warhead", name: "Breach Warhead Adapter", kind: "special", effect: "warhead", size: 3, mass: 9, power: 5,
    description: "Automatically reinforces secondary warheads: +25% damage and +4 heat per launch.", heat: 4 }),
  module({ id: "flares", name: "Decoy Flare Launcher", kind: "defensive", effect: "countermeasure",
    description: "Countermeasure button: halves decoy cooldown. Uses the ship's existing decoy ammunition policy." }),
  module({ id: "hardened-decoys", name: "Hardened Countermeasure Suite", kind: "defensive", effect: "countermeasure",
    description: "Countermeasure button: halves cooldown and reduces hostile targeting disruption.", size: 2, mass: 4, power: 4 }),
  module({ id: "sensors", name: "Spectre Targeting Package", kind: "utility", effect: "sensor",
    description: "Guided lock range +25%; acquisition time -20%. Does not turn unguided weapons into seekers.", power: 4 }),
  module({ id: "ew", name: "Electronic Warfare Filter", kind: "utility", effect: "ew",
    description: "Halves received targeting-jam duration.", power: 5 }),
  module({ id: "shield", name: "Auxiliary Shield Generator", kind: "utility", effect: "shield",
    description: "Increases launch shield capacity by 15%. Does not heal a reconnected ship.", size: 2, mass: 5, power: 7 }),
  module({ id: "armor", name: "Composite Armor Module", kind: "utility", effect: "armor",
    description: "Reduces incoming projectile damage by 10%. Mass competes with other equipment.", size: 2, mass: 9, power: 1 }),
  module({ id: "power", name: "Auxiliary Power System", kind: "utility", effect: "power",
    description: "Restores 3 additional maneuver-energy units per second.", mass: 4, power: 0 }),
  module({ id: "comms", name: "Fleet Communications Relay", kind: "utility", effect: "comms",
    description: "Extends this pilot's friendly assistance-call reach by 25%. Does not bypass faction or encounter checks.", power: 3 }),
];
export function equipmentDefinition(id: string) {
  return EQUIPMENT_CATALOG.find(item => item.id === id);
}
const SMALL = new Set(["shakuna", "duskbreaker", "splitter", "glide", "wasp", "apep", "garuda"]);
const HEAVY = new Set(["bastion", "sekhmet"]);
const HULLS = new Set([...SMALL, ...HEAVY, "mandjet", "sundara", "tripura", "sentinel", "valiant", "aegis", "vajra"]);
export function hullEquipmentRules(shipId: string) {
  if (!HULLS.has(shipId)) throw new Error("Unknown equipment hull.");
  const size = HEAVY.has(shipId) ? 3 : SMALL.has(shipId) ? 1 : 2;
  return {
    shipId, massLimit: [0, 22, 45, 90][size]!, powerLimit: [0, 18, 30, 48][size]!,
    hardpoints: (["primary", "secondary", "special", "defensive", "utility", "utility",
      ...(size === 3 ? ["utility", "utility"] as const : [])] as EquipmentKind[]).map((kind, i) => ({
      id: i < 4 ? kind : `utility-${i - 3}`, kind, size: kind === "defensive" ? Math.min(2, size) : size,
    })),
  };
}
export type EquippedModule = { instanceId: string; equipmentId: string; hardpointId: string; condition: number };
export function validateEquipmentFit(shipId: string, items: readonly EquippedModule[]): string | null {
  const hull = hullEquipmentRules(shipId);
  const slots = new Set<string>(), instances = new Set<string>(), effects = new Set<string>();
  let mass = 0, power = 0;
  for (const item of items) {
    const def = equipmentDefinition(item.equipmentId), slot = hull.hardpoints.find(s => s.id === item.hardpointId);
    if (!def || !slot || slot.kind !== def.kind) return "Equipment does not match this hardpoint.";
    if (instances.has(item.instanceId) || slots.has(slot.id)) return "Equipment and hardpoints must be unique.";
    if (def.size > slot.size) return "Equipment requires a larger military mount.";
    if (!Number.isFinite(item.condition) || item.condition <= 0 || item.condition > def.durability) return "Equipment is not serviceable.";
    if (def.kind === "utility" && effects.has(def.effect)) return "Duplicate utility effects cannot be stacked.";
    instances.add(item.instanceId); slots.add(slot.id); effects.add(def.effect);
    mass += def.mass; power += def.power;
  }
  if ((effects.has("plasma") || effects.has("emp")) && !items.some(item => equipmentDefinition(item.equipmentId)?.kind === "primary"))
    return "This special adapter requires a fitted modular primary weapon.";
  if (effects.has("warhead") && !items.some(item => equipmentDefinition(item.equipmentId)?.kind === "secondary"))
    return "This special adapter requires a fitted modular secondary weapon.";
  return mass > hull.massLimit ? "Hull equipment mass limit exceeded."
    : power > hull.powerLimit ? "Reactor equipment power limit exceeded." : null;
}
export function equipmentHas(items: readonly EquippedModule[] | undefined, effect: EquipmentEffect) {
  return items?.some(item => item.condition > 0 && equipmentDefinition(item.equipmentId)?.effect === effect) ?? false;
}

export type EquipmentWeaponResource = { rounds: number; reserve: number; reload: number; heat: number; overheated: boolean };
export type EquipmentWeaponsState = { primary: EquipmentWeaponResource | null; secondary: EquipmentWeaponResource | null };
export type EquipmentTelemetry = EquipmentWeaponsState & {
  protocol: 1; unguided?: boolean; energy?: number; primaryEnergy?: number; secondaryEnergy?: number;
};
export function isEquipmentTelemetry(value: unknown): value is EquipmentTelemetry {
  if (!value || typeof value !== "object") return false;
  const packet = value as EquipmentTelemetry;
  return packet.protocol === 1 && (packet.unguided === undefined || typeof packet.unguided === "boolean") &&
    [packet.energy, packet.primaryEnergy, packet.secondaryEnergy].every(n => n === undefined || Number.isFinite(n) && n >= 0 && n <= 100) &&
    [packet.primary, packet.secondary].every(resource =>
    resource === null || resource && [resource.rounds, resource.reserve].every(n => Number.isSafeInteger(n) && n >= 0) &&
      [resource.reload, resource.heat].every(n => Number.isFinite(n) && n >= 0) &&
      resource.heat <= 100 && typeof resource.overheated === "boolean");
}
