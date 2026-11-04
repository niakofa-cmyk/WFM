# Master development directive — WAR FOR MARS: THE INFINITE WAR

## Canonical owner reference

The complete owner-provided directive is retained unchanged at:

`attached_assets/Pasted--MASTER-DEVELOPMENT-DIRECTIVE-WAR-FOR-MARS-THE-INFINITE_1793752668891.txt`

This file is its maintained implementation companion, not a replacement for
the complete source. The product blueprint remains
[`../references/wfm-infinite-war-blueprint.md`](../references/wfm-infinite-war-blueprint.md).
The current code audit is split into:

- [`FORENSIC-INVENTORY.md`](FORENSIC-INVENTORY.md)
- [`ARCHITECTURE-ASSESSMENT.md`](ARCHITECTURE-ASSESSMENT.md)
- [`FEATURE-INTEGRATION-MATRIX.md`](FEATURE-INTEGRATION-MATRIX.md)

## Governing product rule

**The universe is the battlefield. Every competitive engagement is an operation
within the larger war. Every operation can have consequences for the universe.**

The player should enter one universe, belong to one faction, command one ship,
progress through one connected journey, and participate in validated
operations whose consequences are visible in that universe.

## Required integration policy

1. Treat the existing custom Three.js/Vite game as the production runtime.
   Needle remains an authoring/research candidate; do not add a second runtime
   without an evaluated, measured migration decision.
2. Evolve the orbital simulation toward the canonical combat foundation, but
   do not assume the existing modes already share one combat protocol.
3. Retain the server-authoritative 5v5 Wing queue, authenticated session
   contracts, reward policy, idempotent ledger, and account-isolation behavior.
   Migrate its combat behavior only through a versioned, coordinated client/API/
   socket transition.
4. Retain Rust Disc and its connected co-op sectors, as well as Iron Eclipse.
   Reuse the existing account, world, discovery, and progression services;
   do not create parallel identity, inventory, profile, or reward systems.
5. Retain campaign, Armory/Market, and persistent-world systems. Consolidate
   their entry points only after the replacement journey works end to end.
6. Retire duplicate code only after a replacement is tested, its callers and
   stored data are migrated, and rollback remains possible.
7. Keep client input/prediction/rendering separate from server-owned combat
   outcomes, mission validation, progression, faction state, and rewards.
8. Deliver bounded, playable slices. Label the evidence correctly as automated,
   simulated, staging, or physical-device evidence; a build alone is not release
   proof.

## Ordered delivery

Follow the directive's stages: forensic inventory and architecture first;
unified player journey; orbital combat; campaign and co-op integration;
competitive integration; validated persistence; then bounded expansion.
Every stage needs acceptance criteria, automated checks, documented limits, and
an explicit rollback path. The next code change must follow the current audit
rather than merge multiple independent gameplay systems at once.

## Current audit snapshot

See the linked audit documents for source-level evidence. The repository has
working account-backed, campaign, world, co-op, and Wing systems, but they do
not yet form one shared 3D multiplayer warfront. The Combat Lab is an offline
training entry; the competitive Wing is a distinct planar simulation and its
existing reward eligibility must not be inferred from Lab or co-op success.
Current local branch and verification status must be rechecked before each
integration or release decision.
