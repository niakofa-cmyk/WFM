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
