# WAR FOR MARS — Phone Playtest Checklist

Use this checklist for roadmap step 1: finish a fight on a real phone and tune the eight ships, touch controls, combat actions, and both match clocks. This is a test plan, not evidence that a device has already passed.

## Test record

- Date / tester:
- Build or commit:
- Phone model:
- OS version:
- Browser and version:
- Screen size / orientation:
- Network (Wi-Fi / cellular):
- Audio output:
- Notes about case, screen protector, or touch issues:

## Before the first fight

- [ ] Open the game on the phone and confirm the title, menu, and arena fit the screen.
- [ ] Confirm the controls remain visible and usable in portrait and landscape, if both are supported.
- [ ] Start a fight and confirm audio unlocks after the first user gesture.
- [ ] Confirm no browser page scrolling, zooming, or accidental navigation while using the arena.
- [ ] Confirm the displayed clock starts at the selected duration: Practice 2:00 or Strike 6:00.

## Touch-control checks

Run these in an active fight with both thumbs on screen.

- [ ] Left stick responds from the center and from near the edge; movement is predictable and bounded.
- [ ] Right stick responds consistently for aim/turn.
- [ ] Both sticks work at the same time without one stealing the other's pointer.
- [ ] Fire can be held while steering and aiming.
- [ ] Lock can be activated while moving; the target name/feedback is readable.
- [ ] Ability can be activated while steering or firing; activation feedback and cooldown are clear.
- [ ] Releasing a stick returns it to neutral immediately.
- [ ] Lifting a finger, receiving a pointer-cancel, or briefly switching apps does not leave movement, fire, or ability stuck.
- [ ] Buttons are reachable without blocking the arena or causing repeated accidental taps.
- [ ] HUD text, target indicators, health, and clock remain legible and are not hidden by fingers or device cutouts.

Record any discomfort, missed inputs, accidental taps, delay, or inconsistent response:

| Control / action | Expected | Observed | Severity (blocker / major / minor) |
| --- | --- | --- | --- |
| Left stick | | | |
| Right stick | | | |
| Fire | | | |
| Lock | | | |
| Ability | | | |
| HUD / clock | | | |

## Eight-ship 2-minute pass

Play one Practice 2:00 fight with each ship. Test its normal steering and firing first, then trigger its signature ability when the situation makes sense. Record feel rather than trying to balance every number in one run.

| Ship | Ability focus | Stick / movement | Fire / aim / lock | Ability clear and useful? | Issue or adjustment |
| --- | --- | --- | --- | --- | --- |
| Mandjet | Flare | | | | |
| Shakuna | Wing Dive | | | | |
| Sundara | Cloak / torpedo setup | | | | |
| Tripura | Trinity Shift | | | | |
| Duskbreaker | Quantum Lock | | | | |
| Sentinel-G | Proximity Ward | | | | |
| Splitter Ring | Ring Split | | | | |
| Glide Knife | Skip Reentry / ram | | | | |

For each ship, note:

- [ ] Movement starts, turns, and stops in a way that feels controllable on glass.
- [ ] The ship can aim and fire without fighting the touch layout.
- [ ] Lock-on is easy to understand and does not require an uncomfortable reach.
- [ ] The signature ability is discoverable, activates once per press, and gives clear feedback.
- [ ] A death, respawn, or fight end does not leave a control stuck.
- [ ] Record at least one concrete issue or write “no issue observed”; avoid changing tuning based only on a vague feel.

## Clock checks

Use Practice for the short clock and Strike for the long clock. A match that ends early can test its end-state flow, but does not verify the clock reaches zero.

- [ ] Practice clock begins at 2:00 and counts down at a steady pace.
- [ ] Complete one fight through its result screen; record whether it ended by objective, team bar, or timeout.
- [ ] Strike clock begins at 6:00 and counts down at a steady pace.
- [ ] Reach 0:00 in at least one Strike fight, if the match rules allow it; verify the final result and any tie/win/loss message.
- [ ] If either mode ends early, record the time and reason. Repeat if a full clock-expiry check is still needed.
- [ ] Confirm pause/resume, app backgrounding, and returning to the game do not produce a frozen or jumping clock.

| Mode | Start shown | End reached | End reason | Clock/result correct? | Notes |
| --- | --- | --- | --- | --- | --- |
| Practice | 2:00 | | | | |
| Strike | 6:00 | | | | |

## Summary and tuning decisions

- Biggest control problem:
- Ship most difficult to fly:
- Ability least clear:
- UI element hardest to reach or read:
- Clock / result issue:
- Changes worth trying:
- Retest needed after changes:

For every reported issue, include the ship, mode, exact sequence of taps or gestures, expected result, observed result, and a screenshot or short screen recording when practical.

## Exit criteria for this pass

- [ ] A complete fight was finished on the target phone.
- [ ] All eight ships received a short touch-control pass.
- [ ] Fire, lock, and each ship's ability were exercised.
- [ ] Both clock modes were checked; any unverified timeout is explicitly recorded.
- [ ] Blocker issues have an owner and a reproducible report.
- [ ] Results identify the phone, OS, browser, build, and test date.

Do not mark phone feel, frame rate, memory, or install budget as passed based on desktop preview or source inspection. Those are separate real-device measurements.
