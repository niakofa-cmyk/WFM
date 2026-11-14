import React from "react";

/** Public historical context, never a recovered evidence record or reward claim. */
export function OpeningHistory() {
  return (
    <details data-testid="opening-history" className="border border-bone/15 bg-panel/80 p-3">
      <summary className="cursor-pointer font-hud text-xs tracking-widest text-solar">
        THE LAST EXPEDITION · HISTORICAL BACKGROUND
      </summary>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-bone/80">
        <p>Eon Dusk, a billionaire backed by powerful insiders, secretly assembled a private expedition using USSF resources to seize Mars. He was not a serving military commander.</p>
        <p>Mars was already home to the Accord. Defending their civilization, the Accord destroyed the expedition and captured Dusk, its only known survivor. A transmission reporting his capture reached Earth before the fleet was destroyed.</p>
        <p>Earth’s response began the USSF–Accord war. You enter that ongoing conflict as a pilot, not as Dusk: choose your faction and hull here, then explicitly deploy into the living Orbital universe.</p>
        <p>Contact, Beacon, Warden and the later Cage transfer uncover what came next. The First Witness remains a mystery; this background does not unlock classified evidence or determine your campaign outcomes.</p>
        <p className="font-hud text-[10px] tracking-wider text-muted">PUBLIC STORY CONTEXT · NO REWARDS · NOT A PLAYABLE OR CINEMATIC BATTLE</p>
      </div>
    </details>
  );
}
