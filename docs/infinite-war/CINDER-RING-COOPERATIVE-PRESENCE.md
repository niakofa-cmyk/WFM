# Cinder Ring cooperative operation presence

The Rust Disc co-op room is now represented in the existing operation directory as
`cinder-ring-rust-disc-coop`. It reuses Clerk-authenticated sector rooms and the
existing operation database; it adds no identity, matchmaking, or reward service.

## Public status and access

- Room creators opt in to public status. The default is unlisted.
- The socket server confirms the creator is at the server-owned Cinder Ring location
  before accepting a public listing. Every pilot joining a listed room must also be
  at that location.
- The directory reports only phase and connected-pilot count/capacity. It never
  returns invitation codes, user IDs, or callsigns. The invitation remains the
  actual join mechanism.
- Room joins, ready state, launch, disconnect, completion, and shutdown update the
  same operation instance. Empty or terminal rooms are closed; active rows expire
  after 45 minutes if the process exits before it can close them.
- Rust Disc sector runs remain no-credit operations. Wing reward settlement is
  unchanged.

## Schema and release boundary

Migration `0002_cooperative_operation_presence.sql` additively adds operation phase
and occupancy columns. It must be applied only to the confirmed staging database
before deploying the matching API and socket revision. No Production migration or
deployment is authorized by this work.

Automated socket tests cover opt-in, Cinder Ring admission, anonymous status,
occupancy updates, launch, disconnect, and closure. A live two-account staging
check is still required to verify that the deployed app and socket share the
expected staging revision and database.
