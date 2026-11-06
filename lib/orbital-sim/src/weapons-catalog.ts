/**
 * Canonical weapon fits for Orbital v2. Hull damage, cadence, ammo capacity,
 * and hull shot speed remain owned by the ship definition; this catalog adds
 * the previously missing per-fit projectile, guidance, and mount behavior.
 */
export type PrimaryWeaponFitId =
  | "heavy-beam" | "twin-pulse" | "torpedo-cannon" | "support-pulse"
  | "precision-cannon" | "escort-array" | "disruption-pulse" | "raider-pulse"
  | "interceptor-pulse" | "multirole-cannon" | "point-defense-array" | "assault-cannon"
  | "stealth-cannon" | "siege-lance" | "swarm-pulse" | "electronic-pulse";

export type MissileFitId =
  | "heavy-seeker" | "interceptor" | "torpedo" | "defense-seeker"
  | "precision-seeker" | "escort-seeker" | "tracking-disruptor" | "light-seeker"
  | "short-range-interceptor" | "multirole-seeker" | "point-defense-interceptor"
  | "anti-capital-torpedo" | "stealth-precision" | "siege-missile" | "swarm-pod" | "ew-seeker";

export type WeaponHardpoint = "nose" | "wing" | "turret";
export type WeaponVisualEffect = "beam" | "pulse" | "heavy" | "precision" | "ion" | "swarm";
export type WeaponAudioCue = "energy" | "pulse" | "heavy" | "ion";

export type PrimaryWeaponDefinition = {
  fitId: PrimaryWeaponFitId;
  compatibleShipIds: readonly string[];
  hardpoint: WeaponHardpoint;
  volleyCount: number;
  spreadRadians: number;
  projectileSpeedScale: number;
  projectileRadius: number;
  projectileLifetimeSeconds: number;
  damageScale: number;
  /** Primary guns remain unlimited; this preserves the current combat economy. */
  ammoCapacity: null;
  ammoCost: 0;
  /** Reserved as explicit zero-cost baseline until a heat/energy HUD pass. */
  energyCost: 0;
  heatPerShot: 0;
  visualEffect: WeaponVisualEffect;
  audioCue: WeaponAudioCue;
};

export type MissileGuidanceMode = "active" | "semi-active";
export type MissileDefinition = {
  fitId: MissileFitId;
  compatibleShipIds: readonly string[];
  hardpoint: WeaponHardpoint;
  ammoCost: 1;
  cooldownSeconds: number;
  projectilesPerLaunch: number;
  spreadRadians: number;
  maxLockRange: number;
  lockSeconds: number;
  lockConeRadians: number;
  launchSpeed: number;
  turnRateRadiansPerSecond: number;
  lifetimeSeconds: number;
  projectileRadius: number;
  damageScale: number;
  energyCost: 0;
  guidance: MissileGuidanceMode;
  countermeasureClass: "standard" | "hardened";
  visualEffect: WeaponVisualEffect;
  audioCue: WeaponAudioCue;
};

export const PRIMARY_WEAPON_CATALOG = {
  "heavy-beam": {
    fitId: "heavy-beam", compatibleShipIds: ["mandjet"], hardpoint: "nose",
    volleyCount: 1, spreadRadians: 0, projectileSpeedScale: 1.18, projectileRadius: 0.38,
    projectileLifetimeSeconds: 1.5, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "beam", audioCue: "heavy",
  },
  "twin-pulse": {
    fitId: "twin-pulse", compatibleShipIds: ["shakuna"], hardpoint: "wing",
    volleyCount: 2, spreadRadians: 0.035, projectileSpeedScale: 1, projectileRadius: 0.18,
    projectileLifetimeSeconds: 1.4, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "pulse", audioCue: "pulse",
  },
  "torpedo-cannon": {
    fitId: "torpedo-cannon", compatibleShipIds: ["sundara"], hardpoint: "nose",
    volleyCount: 1, spreadRadians: 0, projectileSpeedScale: 0.78, projectileRadius: 0.72,
    projectileLifetimeSeconds: 2.35, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "heavy", audioCue: "heavy",
  },
  "support-pulse": {
    fitId: "support-pulse", compatibleShipIds: ["tripura"], hardpoint: "turret",
    volleyCount: 1, spreadRadians: 0, projectileSpeedScale: 1.05, projectileRadius: 0.28,
    projectileLifetimeSeconds: 1.55, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "pulse", audioCue: "energy",
  },
  "precision-cannon": {
    fitId: "precision-cannon", compatibleShipIds: ["duskbreaker"], hardpoint: "nose",
    volleyCount: 1, spreadRadians: 0, projectileSpeedScale: 1.2, projectileRadius: 0.24,
    projectileLifetimeSeconds: 1.45, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "precision", audioCue: "energy",
  },
  "escort-array": {
    fitId: "escort-array", compatibleShipIds: ["sentinel"], hardpoint: "turret",
    volleyCount: 2, spreadRadians: 0.045, projectileSpeedScale: 0.92, projectileRadius: 0.26,
    projectileLifetimeSeconds: 1.6, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "pulse", audioCue: "energy",
  },
  "disruption-pulse": {
    fitId: "disruption-pulse", compatibleShipIds: ["splitter"], hardpoint: "wing",
    volleyCount: 1, spreadRadians: 0, projectileSpeedScale: 0.98, projectileRadius: 0.32,
    projectileLifetimeSeconds: 1.55, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "ion", audioCue: "ion",
  },
  "raider-pulse": {
    fitId: "raider-pulse", compatibleShipIds: ["glide"], hardpoint: "nose",
    volleyCount: 1, spreadRadians: 0, projectileSpeedScale: 1.13, projectileRadius: 0.2,
    projectileLifetimeSeconds: 1.3, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "pulse", audioCue: "pulse",
  },
  "interceptor-pulse": {
    fitId: "interceptor-pulse", compatibleShipIds: ["wasp"], hardpoint: "wing",
    volleyCount: 2, spreadRadians: 0.026, projectileSpeedScale: 1.15, projectileRadius: 0.18,
    projectileLifetimeSeconds: 1.3, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "precision", audioCue: "pulse",
  },
  "multirole-cannon": {
    fitId: "multirole-cannon", compatibleShipIds: ["valiant"], hardpoint: "nose",
    volleyCount: 1, spreadRadians: 0, projectileSpeedScale: 1, projectileRadius: 0.32,
    projectileLifetimeSeconds: 1.55, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "pulse", audioCue: "energy",
  },
  "point-defense-array": {
    fitId: "point-defense-array", compatibleShipIds: ["aegis"], hardpoint: "turret",
    volleyCount: 2, spreadRadians: 0.02, projectileSpeedScale: 1.18, projectileRadius: 0.16,
    projectileLifetimeSeconds: 1.2, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "precision", audioCue: "pulse",
  },
  "assault-cannon": {
    fitId: "assault-cannon", compatibleShipIds: ["bastion"], hardpoint: "nose",
    volleyCount: 1, spreadRadians: 0, projectileSpeedScale: 0.8, projectileRadius: 0.58,
    projectileLifetimeSeconds: 1.9, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "heavy", audioCue: "heavy",
  },
  "stealth-cannon": {
    fitId: "stealth-cannon", compatibleShipIds: ["apep"], hardpoint: "nose",
    volleyCount: 1, spreadRadians: 0, projectileSpeedScale: 1.17, projectileRadius: 0.24,
    projectileLifetimeSeconds: 1.45, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "precision", audioCue: "energy",
  },
  "siege-lance": {
    fitId: "siege-lance", compatibleShipIds: ["sekhmet"], hardpoint: "nose",
    volleyCount: 1, spreadRadians: 0, projectileSpeedScale: 0.94, projectileRadius: 0.68,
    projectileLifetimeSeconds: 2, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "beam", audioCue: "heavy",
  },
  "swarm-pulse": {
    fitId: "swarm-pulse", compatibleShipIds: ["garuda"], hardpoint: "wing",
    volleyCount: 3, spreadRadians: 0.052, projectileSpeedScale: 1.08, projectileRadius: 0.16,
    projectileLifetimeSeconds: 1.25, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "swarm", audioCue: "pulse",
  },
  "electronic-pulse": {
    fitId: "electronic-pulse", compatibleShipIds: ["vajra"], hardpoint: "turret",
    volleyCount: 1, spreadRadians: 0, projectileSpeedScale: 0.98, projectileRadius: 0.3,
    projectileLifetimeSeconds: 1.5, damageScale: 1, ammoCapacity: null, ammoCost: 0,
    energyCost: 0, heatPerShot: 0, visualEffect: "ion", audioCue: "ion",
  },
} as const satisfies Record<PrimaryWeaponFitId, PrimaryWeaponDefinition>;

export const MISSILE_CATALOG = {
  "heavy-seeker": {
    fitId: "heavy-seeker", compatibleShipIds: ["mandjet"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 4,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 70, lockSeconds: 1.5, lockConeRadians: 0.3,
    launchSpeed: 30, turnRateRadiansPerSecond: 1.85, lifetimeSeconds: 4.9, projectileRadius: 0.68,
    damageScale: 1, energyCost: 0, guidance: "active", countermeasureClass: "hardened",
    visualEffect: "heavy", audioCue: "heavy",
  },
  "interceptor": {
    fitId: "interceptor", compatibleShipIds: ["shakuna"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 2.6,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 48, lockSeconds: 0.9, lockConeRadians: 0.38,
    launchSpeed: 52, turnRateRadiansPerSecond: 3.4, lifetimeSeconds: 3.2, projectileRadius: 0.38,
    damageScale: 1, energyCost: 0, guidance: "active", countermeasureClass: "standard",
    visualEffect: "precision", audioCue: "pulse",
  },
  "torpedo": {
    fitId: "torpedo", compatibleShipIds: ["sundara"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 4.4,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 75, lockSeconds: 1.8, lockConeRadians: 0.24,
    launchSpeed: 26, turnRateRadiansPerSecond: 1.5, lifetimeSeconds: 6, projectileRadius: 0.8,
    damageScale: 1, energyCost: 0, guidance: "semi-active", countermeasureClass: "hardened",
    visualEffect: "heavy", audioCue: "heavy",
  },
  "defense-seeker": {
    fitId: "defense-seeker", compatibleShipIds: ["tripura"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 3.2,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 62, lockSeconds: 1.1, lockConeRadians: 0.34,
    launchSpeed: 38, turnRateRadiansPerSecond: 3.2, lifetimeSeconds: 4.6, projectileRadius: 0.5,
    damageScale: 1, energyCost: 0, guidance: "active", countermeasureClass: "standard",
    visualEffect: "pulse", audioCue: "energy",
  },
  "precision-seeker": {
    fitId: "precision-seeker", compatibleShipIds: ["duskbreaker"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 3.4,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 65, lockSeconds: 1.1, lockConeRadians: 0.24,
    launchSpeed: 44, turnRateRadiansPerSecond: 3.5, lifetimeSeconds: 4.8, projectileRadius: 0.42,
    damageScale: 1, energyCost: 0, guidance: "active", countermeasureClass: "standard",
    visualEffect: "precision", audioCue: "energy",
  },
  "escort-seeker": {
    fitId: "escort-seeker", compatibleShipIds: ["sentinel"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 3.8,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 62, lockSeconds: 1.1, lockConeRadians: 0.34,
    launchSpeed: 36, turnRateRadiansPerSecond: 2.8, lifetimeSeconds: 5.2, projectileRadius: 0.5,
    damageScale: 1, energyCost: 0, guidance: "active", countermeasureClass: "hardened",
    visualEffect: "pulse", audioCue: "energy",
  },
  "tracking-disruptor": {
    fitId: "tracking-disruptor", compatibleShipIds: ["splitter"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 3.1,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 58, lockSeconds: 1.25, lockConeRadians: 0.3,
    launchSpeed: 36, turnRateRadiansPerSecond: 2.8, lifetimeSeconds: 4.8, projectileRadius: 0.48,
    damageScale: 1, energyCost: 0, guidance: "semi-active", countermeasureClass: "standard",
    visualEffect: "ion", audioCue: "ion",
  },
  "light-seeker": {
    fitId: "light-seeker", compatibleShipIds: ["glide"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 2.8,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 52, lockSeconds: 0.95, lockConeRadians: 0.38,
    launchSpeed: 46, turnRateRadiansPerSecond: 3.3, lifetimeSeconds: 3.5, projectileRadius: 0.34,
    damageScale: 1, energyCost: 0, guidance: "active", countermeasureClass: "standard",
    visualEffect: "precision", audioCue: "pulse",
  },
  "short-range-interceptor": {
    fitId: "short-range-interceptor", compatibleShipIds: ["wasp"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 2.1,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 45, lockSeconds: 0.75, lockConeRadians: 0.45,
    launchSpeed: 54, turnRateRadiansPerSecond: 3.8, lifetimeSeconds: 2.7, projectileRadius: 0.32,
    damageScale: 1, energyCost: 0, guidance: "active", countermeasureClass: "standard",
    visualEffect: "precision", audioCue: "pulse",
  },
  "multirole-seeker": {
    fitId: "multirole-seeker", compatibleShipIds: ["valiant"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 3.1,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 62, lockSeconds: 1.1, lockConeRadians: 0.32,
    launchSpeed: 38, turnRateRadiansPerSecond: 2.5, lifetimeSeconds: 4.5, projectileRadius: 0.48,
    damageScale: 1, energyCost: 0, guidance: "active", countermeasureClass: "standard",
    visualEffect: "pulse", audioCue: "energy",
  },
  "point-defense-interceptor": {
    fitId: "point-defense-interceptor", compatibleShipIds: ["aegis"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 2.3,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 50, lockSeconds: 0.85, lockConeRadians: 0.42,
    launchSpeed: 48, turnRateRadiansPerSecond: 4.4, lifetimeSeconds: 3.3, projectileRadius: 0.34,
    damageScale: 1, energyCost: 0, guidance: "active", countermeasureClass: "standard",
    visualEffect: "precision", audioCue: "pulse",
  },
  "anti-capital-torpedo": {
    fitId: "anti-capital-torpedo", compatibleShipIds: ["bastion"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 4.8,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 82, lockSeconds: 1.8, lockConeRadians: 0.2,
    launchSpeed: 23, turnRateRadiansPerSecond: 1.35, lifetimeSeconds: 6.5, projectileRadius: 1,
    damageScale: 1, energyCost: 0, guidance: "semi-active", countermeasureClass: "hardened",
    visualEffect: "heavy", audioCue: "heavy",
  },
  "stealth-precision": {
    fitId: "stealth-precision", compatibleShipIds: ["apep"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 3.8,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 68, lockSeconds: 1.35, lockConeRadians: 0.22,
    launchSpeed: 42, turnRateRadiansPerSecond: 2.9, lifetimeSeconds: 5, projectileRadius: 0.42,
    damageScale: 1, energyCost: 0, guidance: "active", countermeasureClass: "hardened",
    visualEffect: "precision", audioCue: "energy",
  },
  "siege-missile": {
    fitId: "siege-missile", compatibleShipIds: ["sekhmet"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 5.2,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 84, lockSeconds: 1.9, lockConeRadians: 0.2,
    launchSpeed: 25, turnRateRadiansPerSecond: 1.25, lifetimeSeconds: 6.8, projectileRadius: 1.05,
    damageScale: 1, energyCost: 0, guidance: "semi-active", countermeasureClass: "hardened",
    visualEffect: "heavy", audioCue: "heavy",
  },
  "swarm-pod": {
    fitId: "swarm-pod", compatibleShipIds: ["garuda"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 2.7,
    projectilesPerLaunch: 3, spreadRadians: 0.13, maxLockRange: 52, lockSeconds: 0.95, lockConeRadians: 0.4,
    launchSpeed: 44, turnRateRadiansPerSecond: 3.5, lifetimeSeconds: 3.4, projectileRadius: 0.3,
    damageScale: 1, energyCost: 0, guidance: "active", countermeasureClass: "standard",
    visualEffect: "swarm", audioCue: "pulse",
  },
  "ew-seeker": {
    fitId: "ew-seeker", compatibleShipIds: ["vajra"], hardpoint: "wing", ammoCost: 1, cooldownSeconds: 3,
    projectilesPerLaunch: 1, spreadRadians: 0, maxLockRange: 60, lockSeconds: 1.1, lockConeRadians: 0.3,
    launchSpeed: 35, turnRateRadiansPerSecond: 2.7, lifetimeSeconds: 4.4, projectileRadius: 0.46,
    damageScale: 1, energyCost: 0, guidance: "semi-active", countermeasureClass: "standard",
    visualEffect: "ion", audioCue: "ion",
  },
} as const satisfies Record<MissileFitId, MissileDefinition>;
