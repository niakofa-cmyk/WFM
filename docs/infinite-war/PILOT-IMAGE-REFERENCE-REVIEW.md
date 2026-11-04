# Pilot visual reference review

These user-provided images are visual direction only. They are not production artwork or a request to reproduce another game's interface exactly. The implementation should use WFM colors, ship models, typography, and combat rules.

## Visual goals extracted

- Keep the player ship large enough to read, low in the frame, and centered against a deep flight environment.
- Protect the center aiming reticle and the forward sightline; show target identity and threat direction only when relevant.
- Keep hull/energy, speed, objective, and target-lock feedback short and legible.
- Use two separated dynamic thumb zones rather than a third vector stick plus a static arrow grid.
- Keep primary fire, target lock, and ready missiles immediately reachable; disclose secondary maneuver actions only when opened.
- Open tactical maps on demand. Show only the player, mission landmarks, and contacts available to that mode; do not invent or leak undiscovered contacts.
- Treat the cockpit image as an optional camera reference, not the default mobile flight framing.

## Image selection

- `attached_assets/TSLjbdNfYRnsWeH3FQ_9GkR7JgQiwwcENnx3SqX4NzhMzk-qg-V09H-ZdsAnT_1793823373401.jpeg` — asteroid scale, centered third-person ship, and a forward combat view.
- `attached_assets/qZZl9srCsVwGAK-w7ZtbxVR7Ocxgz98Bd3L0xrpmNe8zr-7HBjXM9iOncTFJN_1793823532436.jpeg` — spacecraft framing, restrained center targeting, concise status, and two-thumb-zone placement.
- `attached_assets/jelp_B0GFa_wO0-kE73pL9t1u2-wOTqVxOfmUEPscXPiLMTBF58mG-2TudwG5_1793823532519.jpeg` — readable hostile direction cues and a clear, uncluttered ship silhouette.
- `attached_assets/xIx5v6opN7jPNWgz6clcGrwXgQdNhdvGCYq5b2hBENSUyXJQE_bMvMVXNQGgp_1793823373377.jpeg` — cockpit perspective as a secondary camera option.

## Patterns deliberately not adopted

Some supplied examples include permanent UP/DOWN stacks, several large action rings, duplicate radar panels, and dense score/status overlays. Those are recorded as contrast, not as requirements. The target WFM layout keeps combat visibility first and reveals secondary controls or maps only on request.
