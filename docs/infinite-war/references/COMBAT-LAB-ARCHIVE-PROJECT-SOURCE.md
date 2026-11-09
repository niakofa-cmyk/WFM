# WAR FOR MARS: THE INFINITE WAR

## Current release boundary
Engine: Three.js + Vite (default engine selection). No earlier game source or asset manifests exist in this workspace. User master plan is the authoritative long-term design. This release implements STEP 1, Combat Evolution, as an explicitly labeled single-player AI training operation in Mars orbit. It does not claim authenticated multiplayer, persistent faction war, tournaments, or synchronized anomalies. Those require a trusted deployed server and authenticated identity; browser-host authority is not competitive authority.

## UI design fingerprint
Orbital military field-poster: charcoal #090e15, paper #efeadc, warning vermilion #ed633e, USSF ice-blue #89c9db. Strong condensed title, 2px outlined labels, 4px hard offset primary-action shadow; restrained static registration lines. Start and actual loading status share the right quarter; center-left shows the real orbital scene and fighter. Bottom strip shows immediate controls. During play the world occupies most of the screen; top operation/score, bottom ship status, left tactical feed, right target telemetry. Square panel corners and solid section labels; no frosted-glass cards. Desktop keyboard/mouse plus touch steering and action buttons; adaptable at 390px and 1440px.

## 3D direction and benchmark
Self-authored visual target: cinematic orbital combat, not a recreation. A reliable external gameplay benchmark image was not returned by the visual-reference search; no unseen reference is claimed. Huge rust-red Mars with crater/detail variation and thin illuminated atmosphere on the left; cold blue starlight and warm directional sun. Dark detailed metal fighters, bright restrained engine exhaust, hull panel seams, illuminated tactical relay rings, ordered asteroid belt with spatial depth. Main focal point is fighter/reticle and selected enemy. Readable dark surfaces via cool hemisphere fill, physically based roughness/metalness; bloom limited to propulsion, lasers, and impacts. Smooth curved surfaces, no faceted low-poly style. Normal third-person chase camera is the visual acceptance camera.

## Playable scope
Choose USSF or Accord and interceptor or heavy fighter. Distinct pulse/plasma/railgun firing behavior, faction special (USSF shield surge, Accord EMP). Six-axis translation, pitch/yaw/roll, boost energy, brake, inertial/assisted toggles. Target cycling/nearest/attacker/objective/friendly/clear. Missile lock cone and range, launch only at full lock, interceptable incoming missiles and countermeasures. Shields -> armor -> hull, functional engine/weapon/sensor/structural degradation. Impacts, breakup, expanding blast, debris. Operation: eliminate five enemy defenders then hold the relay for 20 seconds. AI wingmen, results and retry. All scores/results are training only. Pause, settings, sector briefing.

## Asset Preparation — pending
Inventory and evidence will be recorded after preparation. Models are vehicles, not humanoid characters; skeletal character/motion pipeline is not applicable. All runtime media will be local bundled files or implemented deterministic procedural setups.

## Verification plan
Node tests for targeting, locks, weapon cooldown, shield/hull/subsystem damage, missile guidance, scoring. Production build; isolated non-root preview. Browser representative combat loop using real controls, target/lock/fire/destruction and result inspection, a few screenshots for visual acceptance and asset-origin inspection. Publish only after playable verification. Multiplayer quality gate remains blocked, not substituted with AI or client-host authority.
