import { integrateSpatialFlight, newFlight, rotate } from "@workspace/orbital-sim";
import type { FlightControls, Rock, SpatialCraft } from "@workspace/orbital-sim";
import { useEffect, useRef, useState } from "react";
import { PilotFlightStick } from "./PilotFlightStick";
import { buildOrbitalShip } from "./orbital-visuals";
import { evaluateCinderRingDockingGate } from "./CinderRingDockingGate";
import type { Faction, ShipId } from "./ships";
import { SHIPS } from "./ships";
import "./CinderRingDockingApproach.css";

type Props = {
  shipId: ShipId;
  faction: Faction;
  onDock: () => void;
  onAbort: () => void;
};

type FlightReadout = {
  x: number;
  y: number;
  z: number;
  speed: number;
  alignmentErrorDeg: number;
  canDock: boolean;
  gateReason: string;
  rendererReady: boolean;
};

const INITIAL_READOUT: FlightReadout = {
  x: 0,
  y: 0,
  z: 36,
  speed: 0,
  alignmentErrorDeg: 0,
  canDock: false,
  gateReason: "outside-volume",
  rendererReady: false,
};

const ROCK_FIELD: Rock[] = [
  { x: -12, y: 2, z: 10, r: 2.5 }, { x: 13, y: -2, z: 4, r: 3.1 },
  { x: -17, y: -3, z: -6, r: 3.8 }, { x: 18, y: 4, z: -9, r: 4.1 },
  { x: -7, y: 9, z: -16, r: 2.8 }, { x: 8, y: -10, z: -19, r: 3.7 },
  { x: 23, y: 8, z: 19, r: 5.4 }, { x: -25, y: -7, z: 16, r: 4.6 },
  { x: 29, y: -4, z: -24, r: 6 }, { x: -28, y: 12, z: -25, r: 5.5 },
  { x: 6, y: 15, z: 24, r: 3.2 }, { x: -13, y: -15, z: -30, r: 4.4 },
];

const GATE_COPY: Record<string, string> = {
  ready: "Approach envelope stable. Docking collar aligned.",
  "outside-volume": "Steer through the amber collar to enter the safe approach volume.",
  speed: "Reduce closure speed below 2.2 m/s before the capture collar.",
  alignment: "Trim yaw and pitch until your nose is within 11° of the dock axis.",
};

function formatCoordinate(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function alignmentError(craft: SpatialCraft) {
  const forward = rotate(craft.space!.q, 0, 0, -1);
  const dot = Math.max(-1, Math.min(1, -forward.z));
  return Math.acos(dot) * (180 / Math.PI);
}

export function CinderRingDockingApproach({ shipId, faction, onDock, onAbort }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef({ x: 0, y: 0 });
  const throttleRef = useRef(0);
  const brakeRef = useRef(false);
  const keysRef = useRef(new Set<string>());
  const readoutRef = useRef(INITIAL_READOUT);
  const onDockRef = useRef(onDock);
  const arrivedRef = useRef(false);
  const [throttle, setThrottle] = useState(0);
  const [braking, setBraking] = useState(false);
  const [readout, setReadout] = useState(INITIAL_READOUT);
  const [sceneError, setSceneError] = useState("");
  const [arrived, setArrived] = useState(false);
  const ship = SHIPS[shipId];
  const factionLabel = faction === "ussf" ? "USSF TRANSIT" : "ACCORD TRANSIT";
  onDockRef.current = onDock;

  useEffect(() => {
    let cancelled = false;
    let frameId = 0;
    let cleanupScene: (() => void) | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let previousTime = 0;
    let lastReadoutAt = 0;
    const host = viewportRef.current;

    if (!host) return;

    void (async () => {
      try {
        const {
          ACESFilmicToneMapping, BackSide, BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry,
          DirectionalLight, Group, HemisphereLight, IcosahedronGeometry,
          Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
          Points, PointsMaterial, Scene, SphereGeometry, TorusGeometry,
          WebGLRenderer,
        } = await import("./three-flight-runtime");
        if (cancelled || !host) return;

        const scene = new Scene();
        scene.background = new Color(0x111a1e);
        const camera = new PerspectiveCamera(49, 1, 0.1, 240);
        const resize = () => {
          const width = host.clientWidth;
          const height = host.clientHeight;
          if (width < 1 || height < 1) return;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          gl.setSize(width, height, false);
        };
        const gl = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
        gl.outputColorSpace = "srgb";
        host.appendChild(gl.domElement);
        cleanupScene = () => {
          resizeObserver?.disconnect();
          window.removeEventListener("resize", resize);
          scene.traverse((object) => {
            const resource = object as typeof object & { geometry?: { dispose: () => void }; material?: unknown };
            resource.geometry?.dispose();
            if (Array.isArray(resource.material)) resource.material.forEach((material) => material.dispose?.());
            else if (resource.material && typeof resource.material === "object" && "dispose" in resource.material) {
              (resource.material as { dispose: () => void }).dispose();
            }
          });
          gl.dispose();
          gl.domElement.remove();
        };

        scene.add(new HemisphereLight(0xa9d0d3, 0x25211c, 1.65));
        const sun = new DirectionalLight(0xffd6a0, 3.4);
        sun.position.set(-24, 28, 14);
        scene.add(sun);
        const fill = new DirectionalLight(0x80c9d0, 1.15);
        fill.position.set(20, -8, -20);
        scene.add(fill);

        const starPositions = new Float32Array(1400 * 3);
        for (let index = 0; index < 1400; index += 1) {
          const angle = index * 2.399963;
          const radius = 34 + (index % 19) * 4.3;
          starPositions[index * 3] = Math.cos(angle) * radius;
          starPositions[index * 3 + 1] = Math.sin(angle * 1.73) * radius * .58;
          starPositions[index * 3 + 2] = -80 + Math.sin(angle * .71) * 90;
        }
        const starsGeometry = new BufferGeometry();
        starsGeometry.setAttribute("position", new BufferAttribute(starPositions, 3));
        const stars = new Points(starsGeometry, new PointsMaterial({ color: 0xc6d8d5, size: .12, transparent: true, opacity: .72 }));
        scene.add(stars);

        const station = new Group();
        station.position.set(0, 0, -2.4);
        scene.add(station);
        const stationMetal = new MeshStandardMaterial({ color: 0x4e5b5a, roughness: .55, metalness: .78 });
        const stationLight = new MeshStandardMaterial({ color: 0xe0a96b, emissive: 0x7a3d14, emissiveIntensity: 1.5, roughness: .35, metalness: .45 });
        const cyanLight = new MeshStandardMaterial({ color: 0x77d1d3, emissive: 0x24777b, emissiveIntensity: 1.35, roughness: .3, metalness: .5 });
        const darkPanel = new MeshStandardMaterial({ color: 0x202b2d, roughness: .78, metalness: .54 });
        const addStationMesh = (geometry: InstanceType<typeof TorusGeometry> | InstanceType<typeof CylinderGeometry> | InstanceType<typeof BoxGeometry> | InstanceType<typeof SphereGeometry>, material: InstanceType<typeof MeshStandardMaterial>, parent: InstanceType<typeof Group>, position: [number, number, number], rotation?: [number, number, number], scale?: [number, number, number]) => {
          const mesh = new Mesh(geometry, material);
          mesh.position.set(...position);
          if (rotation) mesh.rotation.set(...rotation);
          if (scale) mesh.scale.set(...scale);
          parent.add(mesh);
          return mesh;
        };

        addStationMesh(new TorusGeometry(12.4, .72, 12, 112), stationMetal, station, [0, 0, 0]);
        addStationMesh(new TorusGeometry(9.65, .28, 8, 96), stationLight, station, [0, 0, .38]);
        addStationMesh(new TorusGeometry(7.15, .16, 8, 80), stationMetal, station, [0, 0, -.38]);
        addStationMesh(new TorusGeometry(2.75, .12, 8, 56), cyanLight, station, [0, 0, 3.6]);
        addStationMesh(new TorusGeometry(3.25, .06, 6, 56), stationLight, station, [0, 0, 3.45]);

        for (let index = 0; index < 32; index += 1) {
          const angle = (index / 32) * Math.PI * 2;
          const x = Math.cos(angle);
          const y = Math.sin(angle);
          addStationMesh(
            new BoxGeometry(index % 4 === 0 ? 1.2 : .46, index % 4 === 0 ? .38 : .2, .72),
            index % 4 === 0 ? stationLight : darkPanel,
            station,
            [x * 12.35, y * 12.35, 0],
            [0, 0, angle],
          );
          if (index % 2 === 0) {
            addStationMesh(new CylinderGeometry(.11, .15, 2.2, 7), stationMetal, station, [x * 10.65, y * 10.65, -.1], [0, 0, angle]);
          }
        }

        // Stacked work decks, transfer towers, and fuel tanks give the ring a lived-in industrial scale.
        for (let deck = 0; deck < 3; deck += 1) {
          const radius = 5.15 - deck * .48;
          const z = -.45 - deck * .48;
          addStationMesh(new TorusGeometry(radius, .52, 8, 52), deck === 1 ? stationLight : stationMetal, station, [0, 0, z]);
          for (let spoke = 0; spoke < 8; spoke += 1) {
            const angle = spoke * Math.PI / 4;
            const r = radius;
            addStationMesh(new BoxGeometry(.26, .26, 1.2), darkPanel, station, [Math.cos(angle) * r, Math.sin(angle) * r, z], [0, 0, angle]);
          }
        }
        for (let tank = 0; tank < 9; tank += 1) {
          const angle = tank * Math.PI * 2 / 9;
          const x = Math.cos(angle) * 6.4;
          const y = Math.sin(angle) * 6.4;
          const cylinder = addStationMesh(new CylinderGeometry(.42, .48, 2.4 + (tank % 3) * .4, 10), tank % 3 === 0 ? stationLight : stationMetal, station, [x, y, -2.7]);
          cylinder.rotation.x = Math.PI / 2;
          addStationMesh(new SphereGeometry(.44, 10, 8), darkPanel, station, [x, y, -4.05 - (tank % 3) * .2]);
        }
        for (let tower = 0; tower < 5; tower += 1) {
          const angle = (tower / 5) * Math.PI * 2 + .3;
          const x = Math.cos(angle) * 8.2;
          const y = Math.sin(angle) * 8.2;
          addStationMesh(new CylinderGeometry(.23, .4, 3.8, 8), stationMetal, station, [x, y, .75]);
          addStationMesh(new BoxGeometry(1.4, .9, .7), darkPanel, station, [x, y, 2.9], [0, 0, angle]);
          addStationMesh(new BoxGeometry(.35, .12, .13), cyanLight, station, [x, y, 2.88], [0, 0, angle]);
        }

        const asteroidMaterial = new MeshStandardMaterial({ color: 0x554f47, roughness: .98, metalness: .12, flatShading: true });
        const asteroid = new Mesh(new IcosahedronGeometry(7.2, 3), asteroidMaterial);
        asteroid.position.set(1.8, -.4, -10.7);
        asteroid.scale.set(1.15, .79, .88);
        scene.add(asteroid);
        const craterMaterial = new MeshStandardMaterial({ color: 0x292e2f, roughness: 1, metalness: .08, side: BackSide });
        for (let index = 0; index < 12; index += 1) {
          const a = index * 2.399;
          const crater = new Mesh(new SphereGeometry(.62 + (index % 3) * .35, 10, 8), craterMaterial);
          crater.position.set(1.8 + Math.cos(a) * (4.8 + (index % 4) * .45), -.4 + Math.sin(a * 1.4) * 3.2, -10.7 + Math.sin(a) * 5.2);
          crater.scale.set(1.5, .28, .8);
          crater.rotation.z = a;
          scene.add(crater);
        }

        const rockMaterials = [
          new MeshStandardMaterial({ color: 0x414849, roughness: .95, metalness: .08, flatShading: true }),
          new MeshStandardMaterial({ color: 0x61574a, roughness: .94, metalness: .12, flatShading: true }),
          new MeshStandardMaterial({ color: 0x303a3d, roughness: .93, metalness: .15, flatShading: true }),
        ];
        for (let index = 0; index < ROCK_FIELD.length; index += 1) {
          const rock = ROCK_FIELD[index];
          const mesh = new Mesh(new IcosahedronGeometry(rock.r, 1), rockMaterials[index % rockMaterials.length]);
          mesh.position.set(rock.x, rock.y ?? 0, rock.z);
          mesh.rotation.set(index * .29, index * .71, index * .43);
          mesh.scale.set(.8 + (index % 3) * .2, .63 + (index % 4) * .17, .7 + (index % 5) * .1);
          scene.add(mesh);
        }

        const shipGroup = new Group();
        const shipModel = buildOrbitalShip(shipId);
        shipModel.rotation.y = Math.PI;
        shipModel.scale.setScalar(1.65);
        shipGroup.add(shipModel);
        scene.add(shipGroup);

        const craft: SpatialCraft = {
          id: 0, x: 0, z: 36, yaw: 0, pitch: 0, speed: 0, steer: 0,
          hull: 100, hullMax: 100, alive: true, root: 0, jam: 0, boost: 0,
          cloak: 0, untargetable: 0, radius: .8, lockTargetId: null, space: newFlight(0),
        };
        const tuning = {
          turnRate: ship.turnRate,
          handling: ship.handling,
          accel: ship.accel,
          maxSpeed: ship.maxSpeed,
        };

        resize();
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(resize);
          resizeObserver.observe(host);
        } else {
          window.addEventListener("resize", resize);
        }

        const gatePosition = () => ({
          x: craft.x,
          y: craft.space!.y,
          z: craft.z,
          speed: Math.hypot(craft.space!.vx, craft.space!.vy, craft.space!.vz),
          alignmentErrorDeg: alignmentError(craft),
        });
        const renderFrame = (now: number) => {
          if (cancelled) return;
          frameId = requestAnimationFrame(renderFrame);
          const dt = previousTime === 0 ? 1 / 60 : Math.min(.075, Math.max(.001, (now - previousTime) / 1000));
          previousTime = now;
          const keys = keysRef.current;
          const yaw = inputRef.current.x + (keys.has("a") || keys.has("ArrowLeft") ? -1 : 0) + (keys.has("d") || keys.has("ArrowRight") ? 1 : 0);
          const pitch = -inputRef.current.y + (keys.has("ArrowUp") ? -1 : 0) + (keys.has("ArrowDown") ? 1 : 0);
          const keyThrottle = keys.has("w") ? 1 : keys.has("s") ? -1 : null;
          const controls: FlightControls = {
            throttle: keyThrottle ?? throttleRef.current,
            yaw: Math.max(-1, Math.min(1, yaw)),
            pitch: Math.max(-1, Math.min(1, pitch)),
            strafe: (keys.has("q") ? -1 : 0) + (keys.has("e") ? 1 : 0),
            brake: brakeRef.current || keys.has(" "),
          };
          if (!arrivedRef.current) {
            integrateSpatialFlight(craft, controls, dt, 1, ROCK_FIELD, tuning, { boundaryRadius: 90 });
          }

          shipGroup.position.set(craft.x, craft.space!.y, craft.z);
          shipGroup.quaternion.set(craft.space!.q[0], craft.space!.q[1], craft.space!.q[2], craft.space!.q[3]);
          const followOffset = rotate(craft.space!.q, 0, 4.1, 11.5);
          camera.position.set(craft.x + followOffset.x, craft.space!.y + followOffset.y, craft.z + followOffset.z);
          const forward = rotate(craft.space!.q, 0, 0, -1);
          camera.lookAt(craft.x + forward.x * 5, craft.space!.y + forward.y * 5, craft.z + forward.z * 5);
          station.rotation.z = Math.sin(now * .00005) * .006;
          stars.rotation.y = now * .000004;
          gl.render(scene, camera);

          if (now - lastReadoutAt > 125) {
            const approach = gatePosition();
            const gate = evaluateCinderRingDockingGate(approach);
            const nextReadout: FlightReadout = {
              ...approach,
              canDock: gate.canDock,
              gateReason: gate.reason,
              rendererReady: true,
            };
            readoutRef.current = nextReadout;
            setReadout(nextReadout);
            lastReadoutAt = now;
          }
        };
        frameId = requestAnimationFrame(renderFrame);

      } catch (error) {
        if (!cancelled) {
          setSceneError(error instanceof Error ? error.message : "The local flight renderer could not initialize.");
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      cleanupScene?.();
    };
  }, [faction, shipId, ship]);

  useEffect(() => {
    const ignoredTarget = (target: EventTarget | null) => target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName));
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (ignoredTarget(event.target)) return;
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) event.preventDefault();
      keysRef.current.add(key);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      keysRef.current.delete(key);
    };
    const clearKeys = () => keysRef.current.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
    };
  }, []);

  const changeThrottle = (value: number) => {
    throttleRef.current = value;
    setThrottle(value);
  };
  const toggleBrake = () => {
    brakeRef.current = !brakeRef.current;
    setBraking(brakeRef.current);
  };
  const doDock = () => {
    if (arrived || !evaluateCinderRingDockingGate(readoutRef.current).canDock) return;
    arrivedRef.current = true;
    setArrived(true);
    onDockRef.current();
  };
  const abortApproach = () => {
    keysRef.current.clear();
    inputRef.current = { x: 0, y: 0 };
    throttleRef.current = 0;
    brakeRef.current = false;
    onAbort();
  };
  const gateMessage = GATE_COPY[readout.gateReason] ?? GATE_COPY["outside-volume"];
  const dockingStatus = arrived
    ? "LOCAL ARRIVAL RECORDED"
    : readout.canDock
      ? "DOCKING WINDOW OPEN"
      : readout.rendererReady
        ? "APPROACH IN PROGRESS"
        : "INITIALIZING LOCAL FLIGHT";

  return (
    <main className="cinder-approach" data-testid="screen-cinder-ring-docking-approach">
      <div ref={viewportRef} className="cinder-approach__viewport" data-testid="scene-cinder-ring-approach" aria-label="Procedural three-dimensional Cinder Ring docking approach" />
      <div className="cinder-approach__shade" aria-hidden="true" />
      <div className="cinder-approach__grain" aria-hidden="true" />
      <div className="cinder-approach__reticle" aria-hidden="true"><span /></div>

      <header className="cinder-approach__top">
        <div>
          <p className="cinder-approach__eyebrow">PERSISTENT UNIVERSE / LOCAL TRANSIT / NO COMBAT INSTANCE</p>
          <h1 className="cinder-approach__title">CINDER RING</h1>
          <div className="cinder-approach__origin"><i /> {ship.name.toUpperCase()} / {ship.role.toUpperCase()} · STATION APPROACH</div>
        </div>
        <div className="cinder-approach__faction" data-testid="text-approach-faction">{factionLabel}</div>
      </header>
      <p className="sr-only" data-testid="text-approach-safety-scope">Local transit only · no combat instance, rewards, matchmaking, or server authorization.</p>

      <aside className="cinder-approach__telemetry" aria-label="Flight telemetry">
        <div>
          <span className="cinder-approach__readout-label">CLOSURE SPEED</span>
          <span className="cinder-approach__readout-value" data-testid="status-approach-speed">{readout.speed.toFixed(1)} <small>m/s</small></span>
        </div>
        <div>
          <span className="cinder-approach__readout-label">RANGE TO COLLAR</span>
          <span className="cinder-approach__readout-value" data-testid="status-approach-range">{Math.max(0, Math.hypot(readout.x, readout.y, readout.z)).toFixed(1)} <small>km</small></span>
        </div>
        <div>
          <span className="cinder-approach__readout-label">AXIS ERROR</span>
          <span className="cinder-approach__readout-value" data-testid="status-approach-alignment">{readout.alignmentErrorDeg.toFixed(1)}°</span>
        </div>
      </aside>

      <section className="cinder-approach__bottom" aria-label="Approach controls and docking status">
        <div className="cinder-approach__status" data-testid="status-docking-approach" data-ready={readout.canDock ? "true" : "false"} role="status" aria-live="polite">
          <div className="cinder-approach__status-copy">
            <p className="cinder-approach__status-title" data-testid="text-docking-state">{sceneError ? "FLIGHT LINK UNAVAILABLE" : dockingStatus}</p>
            <p className="cinder-approach__status-detail" data-testid="text-docking-guidance">
              {sceneError ? "WebGL could not be initialized. Abort to return to the universe view." : gateMessage}
            </p>
          </div>
          <span className="cinder-approach__micro" data-testid="text-approach-coordinates">
            X {formatCoordinate(readout.x)} / Z {formatCoordinate(readout.z)}
          </span>
        </div>
        {sceneError ? (
          <div role="alert" data-testid="status-approach-error" className="cinder-approach__status-detail">{sceneError}</div>
        ) : null}
        <div className="cinder-approach__control-deck">
          <div className="cinder-approach__stick-wrap">
            <PilotFlightStick
              label="Approach steering"
              testId="stick-approach-steering"
              size="rust-disc"
              onAxis={(x, y) => { inputRef.current = { x, y }; }}
              description="Drag to yaw and pitch the ship toward the collar."
              className="border-cyan-200/45 bg-slate-950/55"
            />
            <span className="cinder-approach__stick-caption"><b>STEER</b>YAW / PITCH</span>
          </div>

          <label className="cinder-approach__throttle" htmlFor="cinder-approach-throttle">
            <span className="cinder-approach__throttle-head">
              <span>THRUST</span>
              <output data-testid="status-approach-throttle">{Math.round(throttle * 100)}%</output>
            </span>
            <input
              id="cinder-approach-throttle"
              data-testid="control-approach-throttle"
              aria-label="Analog forward thrust"
              type="range"
              min="0"
              max="1"
              step=".02"
              value={throttle}
              onChange={(event) => changeThrottle(Number(event.target.value))}
            />
          </label>

          <div className="cinder-approach__actions">
            <button type="button" data-testid="button-approach-brake" aria-pressed={braking} onClick={toggleBrake} className="cinder-approach__button">
              {braking ? "RELEASE BRAKE" : "BRAKE"}
            </button>
            <button type="button" data-testid="button-dock-cinder-ring" disabled={!readout.canDock || arrived || Boolean(sceneError)} onClick={doDock} className="cinder-approach__button cinder-approach__button--dock">
              {arrived ? "ARRIVAL LOGGED" : "DOCK"}
            </button>
            <button type="button" data-testid="button-abort-cinder-ring-approach" onClick={abortApproach} className="cinder-approach__button cinder-approach__button--abort">
              ABORT APPROACH
            </button>
          </div>
          <p className="cinder-approach__keyboard" data-testid="text-approach-keyboard-hint">
            KEYBOARD · W/S THRUST · A/D YAW · ARROWS PITCH / YAW · Q/E STRAFE · SPACE BRAKE
          </p>
        </div>
      </section>
    </main>
  );
}
