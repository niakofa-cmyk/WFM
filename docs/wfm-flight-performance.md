# WFM flight performance check

The flight renderer now samples frame pacing locally, adjusts only the WebGL
render resolution after sustained pressure, and exposes an optional diagnostics
panel. Cooperative sector flights also measure an authenticated WebSocket
round-trip using a rate-limited echo packet. No performance measurements are
stored or sent to analytics.

## On-device procedure

1. On the target phone, open a flight and pause.
2. Choose **SHOW PERFORMANCE HUD**, then resume controls.
3. Record the readout at the start, after one minute of normal flight, and
   during projectile-heavy combat:
   - FPS is estimated from browser animation-frame intervals.
   - P95 is a coarse bucketed 95th-percentile frame interval; it is not GPU-only
     timing.
   - Long frames counts intervals of at least 50 ms in the last sample.
   - RES is the adaptive render-resolution scale relative to the selected
     quality's device-pixel-ratio cap.
   - NETWORK RTT is a client/server WebSocket round trip for cooperative
     expeditions; it is not one-way latency. Local trainer runs show LOCAL ONLY.
4. Note the phone model, browser, network type, orientation, selected quality,
   whether the app was backgrounded, and whether the device was warm. Do not
   include account identifiers, credentials, or tokens.
5. Repeat once with the same mode and quality after a fresh reload. Compare
   intervals rather than a single best reading.

The sampler ignores gaps over 250 ms so app switching and background throttling
do not force a graphics downgrade. Two consecutive slow windows can lower render
resolution by 10%; eight sustained smooth windows restore it in 5% steps. The
scale is bounded at 70–100%. Simulation step rate, collision, controls, server
authority, and socket input cadence do not change.

## Acceptance gates

- Desktop/unit suites confirm frame-window summaries, background-gap handling,
  adaptive-resolution hysteresis, round-trip matching/expiry, authenticated
  probe access, per-socket probe throttling, and in-place projectile removal.
- Client and API flight-sector sources must remain byte-identical and continue
  passing the deterministic simulation gate.
- A physical Android run is still required to establish real device frame
  pacing, thermal behavior, touch responsiveness, and network RTT. A passing
  build or software-rendered preview alone is not mobile-performance
  certification.
