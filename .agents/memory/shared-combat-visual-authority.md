---
name: Shared combat visual authority
description: Visible server contacts and destruction must survive actor mesh removal and spatial rebasing
---

The owner wants visible contacts, damage and explosions in the continuous
Orbital universe, using Combat Lab's feedback as the reference rather than
introducing another game entry.

**Why:** stopping a tracer and hiding a dead mesh did not convey impact or
destruction, despite the server already confirming both. Visual verification
must be distinguished from test-fixture damage and actual authenticated play.

**How to apply:** effects consume server-confirmed contacts and absolute world
coordinates, remain independent of the target mesh, survive spatial rebasing
and stay bounded/deduplicated. Rendering never grants damage, kills or rewards.
Collision tests must require accepted versioned input before treating absence
of hits as a physics failure. Keep registered solid collision, decorative
geometry and destructible objects distinct.
