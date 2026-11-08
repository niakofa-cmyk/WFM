# Orbital-native asteroid spectator and staging gate

> **Superseded renderer gate:** The owner chose immediate Three.js removal and
> retirement of unported combat presentation rather than a parity-gated
> compatibility period. This file remains a staging/authority reference; its
> renderer rollback language is not current. See
> [renderer rebuild status](ORBITAL-ENGINE-ONLY-RENDERER-REBUILD.md).

## Implemented slice

The Cinder Ring live Wing spectator now has a read-only WebGL2 view that renders
the server's anonymous human-match snapshot with Orbital-native ship geometry.
The existing tactical map remains visible as a low-cost companion and as the
fallback when WebGL2 is unavailable. The spectator view consumes positions,
heading, hull identity, team, health, and alive state only. It has no player
identifiers, combat inputs, authority, matchmaking, or reward path.

The native hull presentation now adds shallow armor segmentation, launcher
bays/rails, lower docking hardware, and faction-color markings to the existing
individual silhouettes. These additions are presentation-only: they do not
change flight physics, hitboxes, weapon rules, or server settlement.

## Scope boundary

This is not continuous 3D traffic across the open universe. It is an Orbital
native 3D spectator view at the existing asteroid competition destination,
driven by the existing live human-match feed. It does not create a second match
runtime or a client-authoritative simulation.

This is also not the full Orbital-only rendering migration. Production flight,
hangar, and docking surfaces still have Three.js dependencies. Keep those
surfaces and the rollback path until the renderer parity gate passes for each
surface, including mobile performance, transitions, deterministic behavior,
resource cleanup, and physical-device verification.

This slice introduces no database schema changes, so there is no database
migration to apply for it. Server-owned faction reputation and territory
settlement remain a separate implementation gate; do not represent these
visual changes as changing faction control.

## Separate staging rollout checklist

Do not promote this build to Production as part of the staging check.

1. Deploy one aligned revision of the WFM web app, API, and Wing socket to the
   separate staging environment. Confirm their commit/revision identifiers and
   socket protocol agree before testing.
2. Confirm the staging gateway still protects the app and API. Use the approved
   staging accounts through the normal secure sign-in flow; never place
   passwords or verification codes in this document, logs, or screenshots.
3. Since this slice has no schema change, do not run a database migration for
   it. If a later faction-control migration is included, apply and verify that
   migration against the separate staging database before app rollout, not the
   Development or Production database.
4. On two separate authenticated devices, place both pilots at Cinder Ring and
   create/join a private room for the interception test. Verify both pilots see
   the same server-owned patrol encounter, movement and damage converge on both
   clients, one destroyed hull is removed only once, and reconnecting does not
   create a duplicate encounter or duplicate settlement.
5. Separately, observe a public 5v5 match from the Cinder Ring spectator panel.
   Confirm the 3D silhouettes track the latest server snapshot, hull/team state
   is anonymous, no private-room match is listed, and the tactical map remains
   usable when WebGL2 is unavailable.
6. Record client/API/socket revisions, test accounts as non-sensitive labels,
   device/browser models, results, and any console/socket errors. Do not include
   account credentials or one-time verification codes.
7. If any authority, privacy, settlement, or protocol check fails, stop the
   staging rollout and restore the prior aligned staging revision. Keep
   Production unchanged.

The two-device interception and live spectator checks have not been run on
physical devices for this slice. A browser build or software-rendered preview is
not evidence that those device checks passed.
