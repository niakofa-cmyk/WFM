import { MARS_ADVENTURES, MARS_ADVENTURE_STATE_LABEL } from "./mars-adventure-network";

export function MarsAdventureAtlas() {
  return (
    <details className="uv-routes" data-testid="mars-adventure-atlas">
      <summary>
        <span>MARS ROUTE & ADVENTURE ATLAS</span>
        <small>11 routes · current capability shown</small>
      </summary>
      <p className="uv-routes__intro">
        Routes are travel guidance; adventures become live only when their gameplay and authority are connected.
      </p>
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
