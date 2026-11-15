import type { Scheme } from "./ships";
import type { Goal, Pace } from "./sim";
import { winConditionFor } from "./sortie-guidance";

type Props = {
  mission: string;
  objective: string;
  description: string;
  goal: Goal;
  pace: Pace;
  scheme: Scheme;
  gyro: boolean;
};

export function DeploymentBriefing({
  mission,
  objective,
  description,
  goal,
  pace,
  scheme,
  gyro,
}: Props) {
  const controlGuidance = scheme === "arc"
    ? "ARC · Left stick turns the nose; right stick aims."
    : "STRAFE · Left stick slides; right stick turns the nose.";

  return (
    <section
      aria-labelledby="deployment-briefing-title"
      data-testid="section-deployment-briefing"
      className="border border-solar/45 bg-void/75 p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-bone/10 pb-3">
        <div>
          <p className="font-hud text-[10px] tracking-[0.22em] text-solar">DEPLOYMENT BRIEF</p>
          <h2 id="deployment-briefing-title" className="mt-1 font-hud text-2xl leading-none text-bone">
            {mission}
          </h2>
        </div>
        <span
          data-testid="text-flight-duration"
          className="border border-solar/40 px-2 py-1 font-hud text-xs tracking-widest text-solar"
        >
          {pace === "strike" ? "STRIKE · 06:00" : "PRACTICE · 02:00"}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div>
          <p className="font-hud text-[10px] tracking-[0.18em] text-muted">FIELD ORDERS</p>
          <p data-testid="text-flight-orders" className="mt-1 text-sm leading-relaxed text-bone/90">
            {description}
          </p>
        </div>
        <div>
          <p className="font-hud text-[10px] tracking-[0.18em] text-solar">PRIMARY OBJECTIVE</p>
          <p data-testid="text-flight-objective" className="mt-1 font-hud text-lg leading-tight text-bone">
            {objective}
          </p>
          <p className="mt-2 font-hud text-[10px] tracking-[0.18em] text-solar">HOW TO WIN</p>
          <p data-testid="text-flight-win-condition" className="mt-1 text-sm leading-relaxed text-bone/90">
            {winConditionFor(goal)}
          </p>
        </div>
        <div>
          <p className="font-hud text-[10px] tracking-[0.18em] text-solar">CONTROL MAP</p>
          <p data-testid="text-flight-controls" className="mt-1 text-sm leading-relaxed text-bone/90">
            {controlGuidance}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Fire and ability controls stay on the flight HUD. {gyro ? "Gyro aiming is enabled." : "Gyro aiming is off."}
          </p>
        </div>
      </div>
    </section>
  );
}
