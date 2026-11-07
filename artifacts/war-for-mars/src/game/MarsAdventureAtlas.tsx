import { MARS_ADVENTURES, MARS_ADVENTURE_STATE_LABEL } from "./mars-adventure-network";
import { MARS_PARALLEL_STORY_OPERATIONS, MARS_STORY_ROLE_LABEL, MARS_STORY_THREAD } from "./mars-story-thread";

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
      <section className="uv-story-thread" aria-label="Connected Mars storyline">
        <header className="uv-story-thread__header">
          <b>CONNECTED STORY THREAD</b>
          <small>STORY CONTEXT · NOT A LIVE OPERATION LIST</small>
        </header>
        <p className="uv-story-thread__intro">
          Contact, Beacon, Warden, and Cage remain the authored campaign beats. Mars Approach links geography;
          it is not assumed to be another campaign unlock. Explore beyond the story and return without losing its thread.
        </p>
        <ol className="uv-story-thread__list">
          {MARS_STORY_THREAD.map((beat) => {
            const adventure = adventureById.get(beat.routeId);
            return (
              <li key={beat.id} data-story-role={beat.role} data-route-state={adventure?.state ?? "unmapped"}>
                <span className="uv-story-thread__role">{MARS_STORY_ROLE_LABEL[beat.role]}</span>
                <div>
                  <b>{beat.title}</b>
                  <p>{beat.purpose}</p>
                  <small>{adventure?.region ?? "Location mapping pending"} · {adventure ? MARS_ADVENTURE_STATE_LABEL[adventure.state] : "NOT MAPPED"}</small>
                  <small>{beat.connection}</small>
                </div>
              </li>
            );
          })}
        </ol>
        <aside className="uv-story-thread__parallel">
          {MARS_PARALLEL_STORY_OPERATIONS.map((operation) => {
            const adventure = adventureById.get(operation.routeId);
            return (
              <div key={operation.id} data-testid="mars-story-parallel-operation">
                <b>{operation.title}</b>
                <small>
                  {adventure ? MARS_ADVENTURE_STATE_LABEL[adventure.state] : "NOT MAPPED"} · CHRONOLOGY UNRESOLVED
                </small>
                <p>{operation.note}</p>
              </div>
            );
          })}
        </aside>
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
