# Scout pursuit and shared-flight alignment

## Direction

Enemy ships should actively look for opposing pilots, close on detected contacts,
and patrol/search a pilot's last observed location after losing contact. This
belongs inside the existing live universe, not a separate encounter scene.
Server detection, encounter admission, damage, attribution and settlement retain
authority. Three.js remains the primary renderer.

## Implemented candidate

- Every living patrol ship scans living, connected opposing pilots in its
  current server-owned location session using spherical **520 m 3D sensors**.
  Cloaked/untargetable pilots cannot supply new observations.
- A scout retains its detected target rather than oscillating between pilots.
  It physically steers and accelerates toward the observation; there is no
  teleport or fleet-spawn shortcut.
- Once detection is lost, the scout searches a bounded area up to **100 m**
  around the copied last observation. It never reads an out-of-range or
  disconnected pilot's current pose for pursuit. Memory expires **45 seconds**
  after the last detection; destroyed targets clear it immediately.
- Snapshot designations show `PATROL`, `PURSUIT` or `SEARCH` through the existing
  validated ASCII callsign field, without widening the V1 protocol.
- The existing **180 m interception threshold**, reservation, participation,
  kill/assist and settlement rules are unchanged. Search alone grants no
  weapons or rewards.
- This memory is short-lived simulation state, not a new database record.
  It survives a contact's disappearance within the current session, not a
  server restart or session eviction. Sensors currently use range/concealment,
  not asteroid line-of-sight, faction reputation or cross-sector intelligence.

## Approach correction

The client previously anchored remote traffic to its local pilot position but
did not restore its own authoritative orientation/velocity after admission or
rejoin. This let server bearings and the local view describe different headings.
Local-only sector collision obstacles also differed from the server's empty
collision set.

The new presentation correction initializes own-seat heading/velocity from the
authenticated snapshot, then applies bounded per-snapshot quaternion/velocity
blending. It takes the shortest quaternion arc, never sends a client pose, never
repairs health, and leaves the continuous rebased local position intact.
Shared prediction now uses the same empty collider set as the current server.
Offline exploration keeps its existing colliders. This is not new authoritative
station/terrain collision support or a full input-acknowledged rollback system.

V1-unsupported drift/tactical-maneuver intents are excluded from shared
prediction rather than running locally without server agreement. Inertial and
aim-assist toggles survive the network sampler and are consumed once by the
server rather than once per repeated simulation tick.

Small nearest-contact range fluctuations retain the existing approach target.
A closer contact inside the interception envelope still takes priority; dead,
departed and out-of-sensor contacts cannot remain selected.

## Verification and limits

- 16 focused server tests passed, including physical pursuit/closing, no
  unreserved weapon/reward authority, lost-contact memory, concealment,
  expiry, existing late assistance and settlement.
- 22 focused client/runtime tests passed, including authoritative initial facing,
  shortest-arc convergence, no local teleport/heal, toggle sampling, stable
  contact selection and existing offline exploration/training.
- API/game typechecks and both production builds passed.
- Four static-build tests passed. Lab initial graph: **126,487 B gzip** against
  the unchanged **143,360 B** limit. Three.js remains lazy.

These checks do not replace authenticated staging evidence. The earlier staging
189 m approach blocker was observed on the previous runtime. This candidate has
not yet been deployed; fresh approach, two-pilot combat, kills/assists, durable
settlement and continued flight after battle still need verification. No
Production change is authorized or implied.
