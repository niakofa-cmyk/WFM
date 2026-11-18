---
name: Clerk host-derived keys
description: External Railway authentication must honor explicitly configured Clerk keys.
---

For the existing external Clerk application on Railway, use the configured
frontend publishable key and API publishable/secret key pair directly. Do not
reintroduce hostname-derived Clerk configuration through an internal helper.

**Why:** the installed host-derived helper treats a Production fallback
differently from a Development fallback. On an external Railway hostname it
can select an invented Clerk host rather than the owner's configured instance;
the observed browser then failed TLS before loading sign-in.

**How to apply:** preserve explicit instance selection on both frontend and
API. A change in hosting hostname is not permission to select a different
Clerk instance. Verify actual loaded Clerk host metadata without printing or
decoding configured keys.

Embedded WFM authentication must return to the game's own mounted entry, not
inherit the parent website's generic account destination.

**Why:** an accepted production second-factor request was followed by the parent
site's `/login` page, with no authenticated game profile observed. Identity-factor
acceptance and successful game entry are separate facts.

**How to apply:** make sign-in and registration destinations game-scoped, preserve
the configured external Clerk instance, and verify the actual browser return plus
an authenticated profile response before claiming the flow works. A static bundle
fallback key is not proof of the runtime's selected Clerk hostname.

The WFM base route should show the real Orbital Clerk sign-in screen immediately.
Keep session initialization and retry feedback inline on that screen, and do not
mount flight/gameplay until Clerk confirms a loaded, signed-in pilot session.

**Why:** the user explicitly requires secure pilot verification before gameplay
and rejects guest or unauthenticated entry, while also asking that connection
delays not replace the sign-in experience with a full-screen loading/error page.

**How to apply:** preserve the mounted Clerk form during initialization, show
delays/retry as a compact status, and keep the authenticated game route behind
the existing signed-in and API-session gates.
