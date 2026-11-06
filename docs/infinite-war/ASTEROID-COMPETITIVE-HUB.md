# Cinder Ring Asteroid Arena — Architecture and Roadmap

## Product direction

**The universe is the battlefield. Every competitive engagement is an operation within the larger war. Every operation can have consequences for the universe.**

Cinder Ring is a physical asteroid destination in the persistent universe and the shared access point for two separate multiplayer lanes: public competitive operations and invite-only private rooms. Players can travel there, discover live competitions, spectate a running battle, and enter the next eligible match.

The asteroid is a venue, not a mandate to merge every mode into one simulation:

| Layer | Responsibility |
| --- | --- |
| Persistent universe | Navigation, locations, travel, operation discovery, and the visual presence of destinations |
| Cinder Ring arena hub | Competition directory, live match viewing, competitive queue entry, and a separate no-reward private-room dock |
| Wing Relay 5v5 | Existing authoritative competitive combat, matchmaking, and separately gated reward settlement |
| Arcade Skirmish | Existing playable arcade experience, exposed as an operation when its route is connected |
| Orbital Combat Lab | Offline combat development and validation; promote only after compatibility and authority checks |
| Rust Disc and campaign | Preserve their specialist flight, story, and progression systems while connecting them through explicit operation contracts |

The universe layer must not replace the existing Wing combat runtime. Orbital Combat Lab is not yet a universal production runtime. Future operations can use distinct engines and rulesets while sharing the same trusted identity, destination, operation directory, and server-owned outcome boundaries.

## First vertical slice: live Cinder Ring Relay arena

The first playable arena operation is the existing **5v5 Wing Relay** match:

1. An authenticated player navigates to the server-recognized Cinder Ring location.
2. The universe directory advertises an operation only while a real queue-created match is active.
3. A signed-in visitor can open a read-only spectator feed. It shows anonymous team contacts, hull condition, and relay control; it accepts no combat input and does not consume a player seat.
4. Queue entry is available only when the server confirms the player's location at Cinder Ring.
5. The existing competitive queue still requires ten distinct authenticated human pilots. No AI-fill seats, private rooms, or substitute pilots enter this queue.
6. The existing Wing simulation, match validation, and reward settlement remain authoritative. The arena directory reports activity; it does not award credits or change match results.
7. Match presence is refreshed by the server and expires quickly when its heartbeat stops. Completed matches are removed from the public live directory.

The operation directory exposes a match UUID, phase, and aggregate connected-player count only. It never exposes account IDs, callsigns, room codes, reconnect credentials, or reward data. Spectator packets contain only anonymous combat state.

## Separate private-room dock

The Cinder Ring station also exposes the existing private-room create/join flow. Pilots travel to the asteroid in the universe UI, then create a code or enter an invite code from the dock. The home-screen shortcut opens the universe station rather than creating a room directly.

This is a separate lane from the competitive queue: private rooms remain invite-only, may fill open seats with AI under their existing rules, never award Wing credits, and never appear in the public operation directory or spectator feed. The dock's location check is a UI navigation rule; it does not replace server authority. The competitive queue continues to require a server-confirmed Cinder Ring location and ten distinct authenticated humans.

## Reference imagery and art direction

Use the attached project images as visual references for future Cinder Ring and universe work. The asset filenames below are the source references; do not replace them with unrelated stock art or mistake them for implemented 3D geometry.

- `attached_assets/doGjqD2iaGRKDjG4NJICB3dac7FUlaSBZPaeBVQWPxiQyCF3OZnroiJJky5hx_1793818224683.jpeg` — inhabited asteroid, tunnels, landing approaches, industrial scale.
- `attached_assets/-_-wUF-GZyELvW8116Nu9k9QHQRsFsKjqTkJEDyZQvvZg4H0YIuXQ4td2EcWf_1793818224561.jpeg` — orbital ring station, layered silhouettes, Earth-side scale.
- `attached_assets/s06fhli10RtHoVuiTFN9NRsfJlTX-XTwN6hkULVEV7w5_CetVkTC-2BedVOqC_1793818224582.jpeg` — asteroid enclosed by a structural ring and active work lights.
- `attached_assets/0luT_u8H_hZfWKc8-ehDgmH-H0qnuAHgGDCyYHjQ19KLezsY1ncDZqsoEKilU_1793818224597.jpeg` — factional battle around a monumental asteroid station.
- `attached_assets/9apzikL9fdoyrhbDr_RtYSVXGHfja1tA2fkdC-OfZ1fvvu6L_9lgJYKxqVQhv_1793818224614.jpeg` — readable combat silhouettes and debris-field action.
- `attached_assets/_GhZtLxV82nC70QsnUH26R_Y1hAlGjDhTHHUsbUCyhMhWpiGZL52eRnLjFVsj_1793818224627.jpeg` — strategic galaxy map with multiple stations and navigable routes.
- `attached_assets/cofPu5h4jkGZZQGwnCtZvFPKzF7MKb8xq0X7qulPpDO0WZ_Y7bVqwFHf9HmLK_1793818224640.jpeg`
- `attached_assets/ubY_uxagutK2Uoslr49hk8MJxbO8677nuP0TJnASmyfOjKyoy387Ryeh4afUt_1793818224653.jpeg`
- `attached_assets/HmmFGQ-RWlI7o9GpzqYgDZfXx1ZUU-76vpA-0MiY8gs6S3zEdz3CuSahIcapY_1793818224668.jpeg`
- `attached_assets/e_yl8Z3KSs2cM6wlFwExtXV_7PfPJH126_vh2DvhFgTFhH8KYIYY5VhZeOpfJ_1793991103190.jpeg` — stacked docking rings, elevated platforms, and a station embedded in asteroid terrain.
- `attached_assets/b6x_mzOGs37FsoE9v9GQ9VPkxiqFRaklqab66zL-gitvyUqVHNobIme7YJVnI_1793991103253.jpeg` — industrial habitat scale, clustered tanks, traffic, and readable debris-field flight.

The current source briefs are preserved unchanged in `attached_assets/`:
`Pasted--War-for-Mars-Infinite-War-The-Infinite-Open-Universe-I_1793989681065.txt`,
`Pasted--War-for-Mars-Infinite-War-Orbital-Combat-Lab-Infinite-_1793990090269.txt`,
`Pasted--WAR-FOR-MARS-THE-INFINITE-WAR-structural-rebuild-strat_1793990237240.txt`,
and `Pasted--War-for-Mars-Infinite-War-Multiplayer-Universe-Archite_1793990650366.txt`.
Use them as direction, not as evidence that every described multiplayer capability exists.

Visual goals: make the asteroid read as a real place in the larger universe; show scale through rings, dock structures, traffic, light, and distant battle activity; keep the arena interface legible on phones; use distinct faction color language; and make active operations visible as server-reported state, not decorative animation.

## Flightable local approach

After the server confirms the player's universe location is Cinder Ring, the
universe screen now offers a local 3D flight approach to a procedural station
collar. It uses the shared Orbital spatial-flight integrator, the saved ship
model, touch/keyboard steering, forward thrust, and braking. Docking is gated
locally on entering a bounded capture volume, reducing speed, and aligning the
ship to the collar. Successful docking reveals the existing station hub;
undocking returns to the approach entry.

This is a local navigation/presentation step only. It does not register a
multiplayer operation, write campaign state, grant a match seat, or replace any
combat runtime. The competitive queue still validates location and ten human
pilots on the server. Private rooms remain no-reward and absent from public
discovery.

## Explicitly not claimed as complete

This slice does not yet provide shared free-flight between universe destinations,
visible live battles rendered in the approach scene, a full in-combat spectator
camera, tournament brackets, cross-server match federation, Arcade Skirmish
entry from the asteroid, a constellation of finished stations/anomalies, or
gameplay migration to one universal Orbital combat runtime. The station scene
is a procedural local approach, not a shared-world docking session. Live
competition listings and spectator state remain available through the separate
server-backed station hub. Staging and real-device checks are still required
before calling the approach live or production-ready.

## Acceptance checks

- Cinder Ring is a real, server-recognized travel destination.
- The directory publishes active status only for a live, queue-created ten-human Wing match.
- Competitive queue attempts outside Cinder Ring are rejected server-side.
- The universe station has distinct private-room and competitive-entry panels; the private dock appears only at Cinder Ring.
- At Cinder Ring, the pilot must complete the local, no-reward approach gate before the station operations hub is shown; this client-only arrival does not authorize online queue entry.
- Private-room creation/join reuses the existing room flow and remains no-reward, invite-only, and absent from public discovery.
- Private and AI-fill matches never appear in the public arena directory or spectator endpoint.
- The spectator endpoint requires the existing authenticated session, is read-only, does not consume a pilot seat, and sends no player identity or account data.
- Heartbeats keep live listings fresh; closed or abandoned matches disappear without manual cleanup.
- Tests cover lifecycle, location gating, visibility, identity scrubbing, read-only behavior, and capacity boundaries.
- Existing Wing matchmaking/reward safeguards and Rust Disc/campaign behavior remain intact.
- Staging deployment and real-client evidence are recorded separately from local tests. Production remains untouched until explicitly authorized.

## Next development phases

1. Verify the live spectator and location gate in the staging environment; no physical phone test is implied by local tests.
2. Test the new flightable approach in landscape on Android, including low-throttle arrival, alignment, brake handling, and abort/re-entry.
3. Connect Arcade Skirmish as a separately versioned operation.
4. Add a destination-operation adapter for additional asteroid hubs, stations, and anomalies; publish only real server operations and keep each combat engine explicit.
5. Evaluate Orbital Combat Lab for per-mode integration only after compatibility, gameplay, network, and reward boundaries are proven.
6. Add tournament/event scheduling and in-approach live-battle rendering only after active-match discovery and lifecycle are dependable.
