import { useState } from "react";
import { useAuth } from "@clerk/react";
import {
  getGetWorldPatrolsQueryKey,
  getGetWorldQueryKey,
  useGetWorld,
  useGetWorldPatrols,
} from "@workspace/api-client-react";
import { orbitalStartForVerifiedWorldLocation } from "./orbital-world-entry";
import { ROSTER, SHIPS, type Faction, type ShipId } from "./ships";
import { unlockAudio } from "./audio";
import { OrbitalChart } from "./OrbitalChart";
import { MarsAdventureAtlas } from "./MarsAdventureAtlas";
import { OrbitalFlightPreview } from "./OrbitalFlightPreview";
import { DESTINATIONS, STATUS_LABEL, localFactionBrief } from "./universe-destinations";
import "./combat-lab.css";
import "./orbital-universe.css";

type Mode = "entry" | "universe";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const HUB = `${BASE}/universe`;

/** Shared primary boot and compatibility Lab entry; one flight implementation. */
export function OrbitalBoot({ standalone = false }: { standalone?: boolean }) {
  return standalone
    ? <OrbitalBootCore standalone />
    : <AuthenticatedOrbitalBoot />;
}

function AuthenticatedOrbitalBoot() {
  const { userId } = useAuth();
  return <OrbitalBootCore userId={userId} />;
}

function OrbitalBootCore({
  standalone = false,
  userId,
}: {
  standalone?: boolean;
  userId?: string | null;
}) {
  const [faction, setFaction] = useState<Faction>("ussf");
  const [ship, setShip] = useState<ShipId>("duskbreaker");
  const [mode, setMode] = useState<Mode>(() => {
    const search = new URLSearchParams(window.location.search);
    return search.get("universe") === "1"
      || window.location.pathname.endsWith("/universe")
      || window.location.pathname.endsWith("/flight")
      || window.location.pathname.endsWith("/play")
      ? "universe"
      : "entry";
  });
  const [run, setRun] = useState(0);
  const [summary, setSummary] = useState("");
  const [destId, setDestId] = useState("cinder-ring");
  const worldQuery = useGetWorld({
    query: {
      enabled: Boolean(userId && !standalone && (mode === "entry" || mode === "universe")),
      refetchInterval: 15_000,
      queryKey: getGetWorldQueryKey(),
    },
  });
  const patrolsQuery = useGetWorldPatrols({
    query: {
      enabled: Boolean(userId && !standalone && (mode === "entry" || mode === "universe") && worldQuery.data),
      refetchInterval: 5_000,
      refetchIntervalInBackground: false,
      queryKey: [...getGetWorldPatrolsQueryKey(), worldQuery.data?.currentLocation],
    },
  });
  const dest = DESTINATIONS.find((d) => d.id === destId) ?? DESTINATIONS[0];
  const startLocation = "cinder-ring";
  const serverStartLocation = orbitalStartForVerifiedWorldLocation(worldQuery.data?.currentLocation);
  const patrolDirectory = !standalone
    && serverStartLocation === startLocation
    && patrolsQuery.data?.currentLocationId === worldQuery.data?.currentLocation
    ? patrolsQuery.data
    : null;
  const localTraffic = patrolDirectory?.traffic ?? [];
  const nativeDestinationAvailable = dest.id === "cinder-ring";

  if (mode === "universe") return (
    <div className="combat-lab">
      <OrbitalFlightPreview
        key={`${dest.id}:${run}`}
        shipId={ship}
        faction={faction}
        servicesHref={HUB}
        traffic={localTraffic}
      />
    </div>
  );

  const launch = () => {
    if (dest.status === "planned" || !nativeDestinationAvailable) {
      setSummary("Only Cinder Ring currently has an Orbital-native flight scene. Other destinations remain in rebuild.");
      return;
    }
    unlockAudio();
    setSummary("");
    setRun((value) => value + 1);
    setMode("universe");
  };
  return <div className="combat-lab uv" data-testid="orbital-primary-boot">
    <div className="uv-grain" aria-hidden="true" />
    <header className="uv-top">
      <div><p className="uv-eyebrow">WFM / ORBITAL UNIVERSE</p><h1 className="uv-title">WAR FOR MARS<span>THE INFINITE WAR</span></h1></div>
      <p className="uv-offline" data-testid="text-offline-scope">{standalone ? "OFFLINE LAB · ORBITAL NATIVE ENTRY" : "ORBITAL PRIMARY BOOT · LOCAL FLIGHT PROFILE"}</p>
    </header>
    <main className="uv-grid">
      <section className="uv-map" aria-label="Orbital chart">
        <OrbitalChart selected={destId} onSelect={setDestId} />
        <p className="uv-map__hint">Arrow keys or tap to select a destination</p>
        {nativeDestinationAvailable ? (
          <OrbitalFlightPreview
            shipId={ship}
            faction={faction}
            servicesHref={HUB}
            traffic={localTraffic}
          />
        ) : (
          <div className="uv-unavailable" role="status" data-testid="status-native-route-unavailable">
            <b>DESTINATION NOT AVAILABLE</b>
            <span>This Orbital-native build currently flies Cinder Ring only. No legacy renderer or mission session will be started here.</span>
          </div>
        )}
      </section>
      <section className="uv-brief" aria-live="polite" key={dest.id}>
        <p className={`uv-status uv-status--${dest.status}`} data-testid="status-destination">{STATUS_LABEL[dest.status]}</p>
        <h2 className="uv-dest" data-testid="text-destination-name">{dest.name}</h2>
        <p className="uv-kind">{dest.kind}</p>
        <p className="uv-copy">{dest.summary}</p>
        <p className="uv-copy" data-testid="text-faction-brief">{localFactionBrief(faction, dest.status)}</p>
        <ul className="uv-detail">{dest.detail.map((detail) => <li key={detail}>{detail}</li>)}</ul>
        <MarsAdventureAtlas />
        <fieldset className="uv-loadout" disabled={dest.status === "planned"}>
          <legend>PILOT LOADOUT</legend>
          <div className="lab-factions">{(["ussf", "accord"] as const).map((value) => <button key={value} type="button" data-testid={`button-faction-${value}`} aria-pressed={faction === value} onClick={() => { setFaction(value); setShip(ROSTER[value][0]); }}>{value.toUpperCase()}</button>)}</div>
          <label className="lab-ship-label">AIRFRAME<select data-testid="select-ship" value={ship} onChange={(event) => setShip(event.target.value as ShipId)}>{ROSTER[faction].map((id) => <option key={id} value={id}>{SHIPS[id].name} · {SHIPS[id].role}</option>)}</select></label>
        </fieldset>
        <button data-testid="button-launch-local-universe" className="uv-launch" disabled={dest.status === "planned" || !nativeDestinationAvailable}
          onClick={launch}>
          {nativeDestinationAvailable ? "APPROACH CINDER · ORBITAL UNIVERSE" : "NATIVE ROUTE IN REBUILD"}
        </button>
        <p className="uv-map__hint" data-testid="text-local-universe-scope">Current flight profile: session-only sandbox, no rewards or shared ships. Authenticated universe encounters and rewards require server authority.</p>
        <p className="uv-map__hint">Cinder Ring is the current Orbital-native flight slice. The station console launches its local skirmish; other destinations are not launchable yet.</p>
        {summary ? <p role="status" className="lab-summary" data-testid="status-summary">{summary}</p> : null}
        <a className="uv-hub" href={HUB} data-testid="link-account-hub"><b>OPEN ACCOUNT & UNIVERSE SERVICES</b><span>Sign-in required. Saved location, queue and match eligibility remain server-owned.</span></a>
        <a className="uv-hub" href={`${BASE}/command`} data-testid="link-account-command"><b>OPEN ACCOUNT COMMAND</b><span>Account and progression tools remain available; legacy combat screens are retired.</span></a>
      </section>
    </main>
    <footer className="lab-rules uv-rules"><b>FLIGHT</b><span>W/S thrust · A/D yaw · I/K pitch · Q/E roll · Z/X slide · Mobile: two-thumb flight controls</span></footer>
  </div>;
}
