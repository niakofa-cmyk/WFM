import { MARS_ADVENTURES, MARS_ADVENTURE_STATE_LABEL } from "./mars-adventure-network";
import { MARS_STORY_FOUNDATION, MARS_STORY_ROLE_LABEL, MARS_STORY_THREAD } from "./mars-story-thread";

export function MarsAdventureAtlas() {
  const adventureById = new Map(MARS_ADVENTURES.map((adventure) => [adventure.id, adventure]));

  return (
    <details className="uv-routes" data-testid="mars-adventure-atlas">
      <summary>
        <span>MARS ROUTE & ADVENTURE ATLAS</span>
        <small>11 routes · current capability shown</small>
      </summary>
      <p className="uv-routes__intro">
        Routes are travel guidance; adventures become live only when their gameplay and authority are connected.
      </p>
      <section className="uv-story-foundation" aria-label="Foundational storyline">
        <header>
          <b>FOUNDATIONAL STORY · OWNER-DIRECTED</b>
          <small>WAR FOR MARS: THE INFINITE WAR</small>
        </header>
        <h3>{MARS_STORY_FOUNDATION.heading}</h3>
        <p>{MARS_STORY_FOUNDATION.premise}</p>
        <div className="uv-story-foundation__truths">
          {MARS_STORY_FOUNDATION.truths.map((truth) => (
            <article key={truth.label}>
              <b>{truth.label}</b>
              <p>{truth.text}</p>
            </article>
          ))}
        </div>
        <p className="uv-story-foundation__mystery">{MARS_STORY_FOUNDATION.mystery}</p>
        <small className="uv-story-foundation__boundary">
          Story foundation, not an operation result. The current engine migration is tracked separately.
        </small>
      </section>
      <section className="uv-story-thread" aria-label="Connected Mars storyline">
        <header className="uv-story-thread__header">
          <b>CONNECTED STORY THREAD</b>
          <small>WORKING STORY ORDER · NOT A LIVE OPERATION LIST</small>
        </header>
        <p className="uv-story-thread__intro">
          Contact → Mars Approach → Beacon → Warden → Cage → Iron Eclipse → Beyond the Signal.
          Mars Approach is a travel interlude; Iron Eclipse is a proposed story placement, not a campaign unlock.
        </p>
        <ol className="uv-story-thread__list">
          {MARS_STORY_THREAD.map((beat) => {
            const adventure = adventureById.get(beat.routeId);
            return (
              <li key={beat.id} data-story-role={beat.role} data-route-state={adventure?.state ?? "unmapped"}>
                <span className="uv-story-thread__role">{MARS_STORY_ROLE_LABEL[beat.role]}</span>
                <div>
                  <small className="uv-story-thread__sequence">{beat.sequenceLabel}</small>
                  <b>{beat.title}</b>
                  <p>{beat.purpose}</p>
                  <small>{adventure?.region ?? "Location mapping pending"} · {adventure ? MARS_ADVENTURE_STATE_LABEL[adventure.state] : "NOT MAPPED"}</small>
                  <small>{beat.connection}</small>
                </div>
              </li>
            );
          })}
        </ol>
        <small className="uv-story-thread__boundary">
          Navigation context only. This thread does not start an operation, grant a discovery, or change account progression.
        </small>
      </section>
      <ul className="uv-routes__list">
        {MARS_ADVENTURES.map((adventure) => (
          <li key={adventure.id} data-route-state={adventure.state}>
            <div className="uv-routes__heading">
              <div>
                <b>{adventure.name}</b>
                <small>{adventure.region}</small>
              </div>
              <span className={`uv-routes__state uv-routes__state--${adventure.state}`}>
                {MARS_ADVENTURE_STATE_LABEL[adventure.state]}
              </span>
            </div>
            <p>{adventure.concept}</p>
            <small className="uv-routes__evidence">{adventure.currentEvidence}</small>
            <small className="uv-routes__gate"><b>Next gate:</b> {adventure.nextGate}</small>
          </li>
        ))}
      </ul>
    </details>
  );
}
