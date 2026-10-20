import { menuTip, type MenuAction, type MenuStateId } from "./menu";
import { ROSTER, SHIPS, type Faction, type Scheme, type ShipId } from "./ships";
import { TECHS, type TechId } from "./campaign";

type HomeProps = {
  state: MenuStateId;
  tipIndex: number;
  faction: Faction;
  ship: ShipId;
  scheme: Scheme;
  gyro: boolean;
  refit: number;
  credits: number;
  tech: TechId | null;
  cleared: number;
  refitLabel: string;
  refitDisabled: boolean;
  onAction: (action: MenuAction) => void;
  onOnline: (roomCode: string) => void;
  roomCode: string;
  onRoomCode: (roomCode: string) => void;
  onCreateRoom: () => void;
  onlineStatus?: string;
  offlineAvailable: boolean;
  onOfflineStrike: () => void;
  onFaction: (faction: Faction) => void;
  onShip: (ship: ShipId) => void;
  onScheme: (scheme: Scheme) => void;
  onGyro: () => void;
  onTech: (tech: TechId) => void;
  onRefit: () => void;
};

export function HomeScreen(props: HomeProps) {
  const { state, onAction } = props;
  return (
    <section
      className="relative h-dvh overflow-hidden bg-void text-bone"
      style={{
        backgroundImage: "url(/mars-front.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-void via-void/80 to-transparent" />
      <div className="relative flex h-full flex-col justify-between px-5 py-6 sm:px-10">
        <p className="font-hud text-xs tracking-widest text-solar">USSF VS THE ACCORD · PHOBOS MOON</p>
        {state === "BOOT" ? <Boot /> : null}
        {state === "TITLE" ? <Title onAction={onAction} /> : null}
        {state === "MAIN_MENU" ? <MainMenu {...props} /> : null}
        {state === "ARMORY" ? <Armory {...props} /> : null}
        {state === "SETTINGS" ? <Settings {...props} /> : null}
        {state === "LOADING" ? <Loading tip={menuTip(props.tipIndex)} ship={SHIPS[props.ship].name} /> : null}
      </div>
    </section>
  );
}

function Boot() {
  return (
    <div className="flex flex-1 items-center">
      <p className="font-hud text-sm tracking-widest text-bone">LINKING THE WING</p>
    </div>
  );
}

function Title({ onAction }: { onAction: (action: MenuAction) => void }) {
  return (
    <button type="button" className="flex flex-1 flex-col items-start justify-center text-left" onClick={() => onAction("START")}>
      <h1 className="sr-only">WAR FOR MARS</h1>
      <img
        src="/war-for-mars-logo.jpg"
        alt=""
        className="w-full max-w-3xl mix-blend-screen"
      />
      <p className="mt-2 font-hud text-sm tracking-widest text-solar">PRESS TO ENTER</p>
    </button>
  );
}

function MainMenu({
  onAction,
  onOnline,
  onCreateRoom,
  onRoomCode,
  roomCode,
  onlineStatus,
  offlineAvailable,
  onOfflineStrike,
  ship,
}: HomeProps) {
  const items: { action: MenuAction; label: string; detail: string }[] = [
    { action: "DEPLOY", label: "CAMPAIGN: DEPLOY", detail: "Sorties, the yard, the cage" },
    { action: "ARCADE", label: "ARCADE SKIRMISH", detail: "Open disc. Practice or strike." },
    { action: "ARMORY", label: "ARMORY & UPGRADES", detail: SHIPS[ship].name },
    { action: "SETTINGS", label: "SETTINGS", detail: "Stick, tilt, the glass" },
  ];
  return (
    <div className="flex flex-1 flex-col justify-center gap-3">
      <img src="/war-for-mars-logo.jpg" alt="WAR FOR MARS" className="w-full max-w-md mix-blend-screen" />
      <div className="mt-4 flex w-full max-w-sm flex-col gap-2">
        <section className="border border-solar bg-void/80 p-3">
          <p className="font-hud text-lg tracking-widest text-solar">5V5 ONLINE WING</p>
          <p className="mb-2 text-xs text-muted">Create a private room or enter a pilot’s code. Empty seats fly with AI.</p>
          <button
            type="button"
            data-testid="button-online-5v5"
            onClick={onCreateRoom}
            className="h-12 w-full bg-solar px-3 text-left text-void"
          >
            <span className="block font-hud text-base leading-none tracking-widest">CREATE NEW ROOM</span>
            <span className="text-xs text-void/80">{onlineStatus || "Generate a code and launch the 5v5."}</span>
          </button>
          <div className="mt-2 flex gap-2">
            <label className="sr-only" htmlFor="online-room-code">Room code</label>
            <input
              id="online-room-code"
              data-testid="input-room-code"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={24}
              onChange={(event) => onRoomCode(event.target.value.toUpperCase())}
              placeholder="6–24 CHAR ROOM CODE"
              value={roomCode}
              className="h-11 min-w-0 flex-1 border border-bone/30 bg-void px-3 font-hud tracking-widest text-bone placeholder:text-muted"
            />
            <button
              type="button"
              data-testid="button-join-room"
              disabled={roomCode.trim().length < 6}
              onClick={() => onOnline(roomCode)}
              className="h-11 border border-bone/40 px-3 font-hud tracking-widest text-bone disabled:opacity-40"
            >
              JOIN
            </button>
          </div>
          {offlineAvailable ? (
            <button
              type="button"
              data-testid="button-offline-strike"
              onClick={onOfflineStrike}
              className="mt-2 h-11 w-full border border-alert/50 px-3 text-left text-alert"
            >
              <span className="block font-hud text-sm tracking-widest">START OFFLINE STRIKE</span>
              <span className="text-xs">Room unavailable · play the local AI-filled match instead.</span>
            </button>
          ) : null}
        </section>
        {items.map((item, index) => (
          <button
            key={item.action}
            type="button"
            onClick={() => onAction(item.action)}
            className={
              index === 0
                ? "h-14 border border-solar bg-void/70 px-3 text-left"
                : "h-14 border border-bone/25 bg-void/55 px-3 text-left"
            }
          >
            <span className="block font-hud text-lg leading-none tracking-widest text-bone">{item.label}</span>
            <span className="text-xs text-muted">{item.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Armory(props: HomeProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-4">
      <h2 className="font-hud text-4xl leading-none">ARMORY</h2>
      <div className="grid max-w-xl grid-cols-2 gap-2">
        <Pick on={props.faction === "accord"} label="The Accord" detail="Solar, stealth, the rings" click={() => props.onFaction("accord")} />
        <Pick on={props.faction === "ussf"} label="USSF" detail="Sensors, wards, the glide" click={() => props.onFaction("ussf")} />
      </div>
      <div className="grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {ROSTER[props.faction].map((id) => {
          const def = SHIPS[id];
          return (
            <Pick
              key={id}
              on={props.ship === id}
              label={def.name}
              detail={`${def.role} · ${def.ultShort}`}
              click={() => props.onShip(id)}
            />
          );
        })}
      </div>
      <div className="grid max-w-xl grid-cols-3 gap-2">
        {TECHS.map((tech) => {
          const locked = props.cleared < tech.need;
          return (
            <button
              key={tech.id}
              type="button"
              disabled={locked}
              onClick={() => props.onTech(tech.id)}
              className={
                props.tech === tech.id
                  ? "h-14 bg-solar px-2 text-left text-void"
                  : "h-14 border border-bone/25 bg-void/60 px-2 text-left text-bone disabled:opacity-40"
              }
            >
              <span className="block font-hud text-xs tracking-widest">{tech.name.toUpperCase()}</span>
              <span className="text-xs text-muted">{locked ? "Locked" : tech.detail}</span>
            </button>
          );
        })}
      </div>
      <div className="flex max-w-xl items-center justify-between gap-3">
        <p className="font-hud text-xl text-solar">{props.credits} CR</p>
        <button
          type="button"
          disabled={props.refitDisabled}
          className="h-11 border border-solar px-3 font-hud tracking-widest text-solar disabled:border-bone/20 disabled:text-muted"
          onClick={props.onRefit}
        >
          {props.refitLabel}
        </button>
      </div>
      <Back onAction={props.onAction} />
    </div>
  );
}

function Settings(props: HomeProps) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-3">
      <h2 className="font-hud text-4xl leading-none">SETTINGS</h2>
      <div className="flex max-w-sm flex-col gap-2">
        <Pick on={props.scheme === "arc"} label="ARC" detail="Left stick turns the nose." click={() => props.onScheme("arc")} />
        <Pick on={props.scheme === "strafe"} label="STRAFE" detail="Left stick slides. Right stick turns." click={() => props.onScheme("strafe")} />
        <Pick on={props.gyro} label={props.gyro ? "GYRO ON" : "GYRO"} detail="Tilt rolls the nose after permission." click={props.onGyro} />
      </div>
      <p className="max-w-sm text-sm text-muted">Shake and sound stay on the fight glass. Hold is the P key.</p>
      <Back onAction={props.onAction} />
    </div>
  );
}

function Loading({ tip, ship }: { tip: string; ship: string }) {
  return (
    <div className="flex flex-1 flex-col justify-end gap-3 pb-8">
      <p className="font-hud text-sm tracking-widest text-solar">{ship.toUpperCase()} · LAUNCH</p>
      <p className="max-w-md text-sm leading-relaxed text-bone">{tip}</p>
      <div className="h-1 w-full max-w-md overflow-hidden bg-bone/20">
        <div className="h-full w-1/2 animate-pulse bg-solar" />
      </div>
    </div>
  );
}

function Back({ onAction }: { onAction: (action: MenuAction) => void }) {
  return (
    <button
      type="button"
      className="h-11 max-w-xs border border-bone/30 font-hud tracking-widest text-bone"
      onClick={() => onAction("BACK")}
    >
      BACK
    </button>
  );
}

function Pick({ on, label, detail, click }: { on: boolean; label: string; detail: string; click: () => void }) {
  return (
    <button
      type="button"
      onClick={click}
      className={on ? "h-14 bg-solar px-3 text-left text-void" : "h-14 border border-bone/25 bg-void/60 px-3 text-left text-bone"}
    >
      <span className="block font-hud text-lg leading-none">{label}</span>
      <span className={on ? "text-xs text-void/80" : "text-xs text-muted"}>{detail}</span>
    </button>
  );
}
