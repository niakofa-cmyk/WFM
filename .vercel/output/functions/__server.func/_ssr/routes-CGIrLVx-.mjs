import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { C as PointsMaterial, D as SphereGeometry, E as Scene, O as TorusGeometry, S as Points, T as SRGBColorSpace, _ as Mesh, a as BufferGeometry, b as OctahedronGeometry, c as CylinderGeometry, d as FogExp2, f as Group, g as Matrix4, h as LineBasicMaterial, i as BufferAttribute, k as Vector3, l as DirectionalLight, m as Line, n as AmbientLight, o as CircleGeometry, p as HemisphereLight, r as BoxGeometry, s as ConeGeometry, t as WebGLRenderer, u as DodecahedronGeometry, v as MeshBasicMaterial, w as RingGeometry, x as PerspectiveCamera, y as MeshStandardMaterial } from "../_libs/three.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CGIrLVx-.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var muted = false;
var ctx = null;
function setMuted(next) {
	muted = next;
}
function isMuted() {
	return muted;
}
function unlockAudio() {
	if (typeof window === "undefined") return;
	const AC = window.AudioContext || window.webkitAudioContext;
	if (!AC) return;
	if (!ctx) ctx = new AC();
	if (ctx.state === "suspended") ctx.resume();
}
function tone(freq, dur, type, gain, slide = 0) {
	if (!ctx || muted) return;
	const t = ctx.currentTime;
	const osc = ctx.createOscillator();
	const amp = ctx.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t);
	if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
	amp.gain.setValueAtTime(gain, t);
	amp.gain.exponentialRampToValueAtTime(1e-4, t + dur);
	osc.connect(amp);
	amp.connect(ctx.destination);
	osc.start(t);
	osc.stop(t + dur + .02);
}
function sfxShot(big) {
	tone(big ? 140 : 520, big ? .18 : .06, big ? "sawtooth" : "square", big ? .08 : .035, big ? -80 : -220);
}
function sfxHit() {
	tone(180, .07, "triangle", .04, -100);
}
function sfxBoom() {
	tone(90, .28, "sawtooth", .09, -60);
}
function sfxUlt() {
	tone(240, .22, "square", .05, 180);
}
function createBus(scheme) {
	return {
		keys: /* @__PURE__ */ new Set(),
		override: null,
		steerOverride: null,
		leftX: 0,
		leftY: 0,
		rightX: 0,
		rightY: 0,
		fireCanvas: false,
		fireButton: false,
		ultPulse: false,
		lockPulse: false,
		evadePulse: 0,
		presetPulse: null,
		gyroYaw: 0,
		gyroPitch: 0,
		scheme,
		qWas: false,
		eWas: false,
		fWas: false,
		rWas: false
	};
}
function clamp$1(n) {
	return Math.max(-1, Math.min(1, n));
}
function readInput(bus) {
	const keys = bus.override ?? bus.keys;
	const keyYaw = (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) - (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0);
	const keyThr = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
	const stickYaw = -bus.leftX;
	const stickThr = -bus.leftY;
	const aimYaw = -bus.rightX;
	let yaw = 0;
	let strafe = 0;
	if (bus.scheme === "arc") {
		yaw = clamp$1(keyYaw + stickYaw + aimYaw * .75 + bus.gyroYaw);
		strafe = 0;
	} else {
		yaw = clamp$1(aimYaw + bus.gyroYaw);
		strafe = clamp$1(keyYaw + stickYaw);
	}
	if (bus.steerOverride != null) yaw = clamp$1(bus.steerOverride);
	const throttle = clamp$1(keyThr + stickThr);
	const pitch = clamp$1(-bus.rightY + bus.gyroPitch);
	const fire = bus.fireCanvas || bus.fireButton || keys.has("Space");
	const fDown = keys.has("KeyF");
	const ult = bus.ultPulse || fDown && !bus.fWas;
	bus.ultPulse = false;
	bus.fWas = fDown;
	const rDown = keys.has("KeyR");
	const lock = bus.lockPulse || rDown && !bus.rWas;
	bus.lockPulse = false;
	bus.rWas = rDown;
	let evade = 0;
	if (bus.evadePulse !== 0) {
		evade = bus.evadePulse;
		bus.evadePulse = 0;
	}
	const q = keys.has("KeyQ");
	const e = keys.has("KeyE");
	if (q && !bus.qWas) evade = 1;
	if (e && !bus.eWas) evade = evade === 0 ? -1 : evade;
	bus.qWas = q;
	bus.eWas = e;
	const preset = bus.presetPulse;
	bus.presetPulse = null;
	return {
		throttle,
		yaw,
		strafe,
		pitch,
		fire,
		ult,
		lock,
		evade,
		preset
	};
}
var listening = false;
var yaw = 0;
var pitch = 0;
var baseGamma = null;
var baseBeta = null;
function clamp(n) {
	return Math.max(-1, Math.min(1, n));
}
function onOrient(event) {
	if (event.gamma == null || event.beta == null) return;
	if (baseGamma == null || baseBeta == null) {
		baseGamma = event.gamma;
		baseBeta = event.beta;
	}
	yaw = clamp((event.gamma - baseGamma) / 26) * .6;
	pitch = clamp((baseBeta - event.beta) / 26) * .45;
}
function gyroAim() {
	return {
		yaw,
		pitch
	};
}
function resetGyro() {
	baseGamma = null;
	baseBeta = null;
	yaw = 0;
	pitch = 0;
}
async function armGyro() {
	if (typeof window === "undefined") return false;
	const ctor = window.DeviceOrientationEvent;
	if (typeof ctor?.requestPermission === "function") try {
		if (await ctor.requestPermission() !== "granted") return false;
	} catch {
		return false;
	}
	if (!listening) {
		window.addEventListener("deviceorientation", onOrient);
		listening = true;
	}
	resetGyro();
	return true;
}
var PRESET_PIPS = {
	0: [
		2,
		2,
		2
	],
	1: [
		1,
		4,
		1
	],
	2: [
		1,
		1,
		4
	],
	3: [
		4,
		1,
		1
	]
};
var PRESET_NAME = [
	"BAL",
	"WEP",
	"DEF",
	"ENG"
];
var SHIPS = {
	mandjet: {
		id: "mandjet",
		name: "Mandjet",
		faction: "accord",
		role: "Vanguard",
		blurb: "Solar juggernaut. Slow nose, heavy beam, a flare that clears the cone ahead.",
		handling: .55,
		maxSpeed: 18,
		accel: 26,
		shield: 160,
		hull: 110,
		fireInterval: .18,
		shotDmg: 5.4,
		shotSpeed: 74,
		turnRate: 2.15,
		radius: 1.75,
		ultName: "Solar Flare",
		ultShort: "FLARE",
		ultCd: 8
	},
	shakuna: {
		id: "shakuna",
		name: "Shakuna",
		faction: "accord",
		role: "Hunter",
		blurb: "Bird interceptor. Lives on the turn. Wing Dive cuts whoever is in the path.",
		handling: 1.35,
		maxSpeed: 36,
		accel: 52,
		shield: 70,
		hull: 52,
		fireInterval: .11,
		shotDmg: 2.2,
		shotSpeed: 64,
		turnRate: 2.15,
		radius: 1.2,
		ultName: "Wing Dive",
		ultShort: "DIVE",
		ultCd: 7
	},
	sundara: {
		id: "sundara",
		name: "Sundara",
		faction: "accord",
		role: "Striker",
		blurb: "Needle bomber. Cloak, then the next torpedo crits. Lock a target and it homes.",
		handling: .85,
		maxSpeed: 24,
		accel: 34,
		shield: 84,
		hull: 64,
		fireInterval: 1.05,
		shotDmg: 26,
		shotSpeed: 30,
		turnRate: 2.15,
		radius: 1.25,
		ultName: "Vortex Camouflage",
		ultShort: "CLOAK",
		ultCd: 10
	},
	tripura: {
		id: "tripura",
		name: "Tripura",
		faction: "accord",
		role: "Support",
		blurb: "Three rings. Trinity Shift freezes enemy thrust nearby. It does not freeze guns.",
		handling: .75,
		maxSpeed: 20,
		accel: 30,
		shield: 120,
		hull: 86,
		fireInterval: .26,
		shotDmg: 4.6,
		shotSpeed: 52,
		turnRate: 2.15,
		radius: 1.6,
		ultName: "Trinity Shift",
		ultShort: "SHIFT",
		ultCd: 12
	},
	duskbreaker: {
		id: "duskbreaker",
		name: "Duskbreaker",
		faction: "ussf",
		role: "Striker",
		blurb: "OTV-C frame. Quantum Lock marks a target and thickens your shots for a few seconds.",
		handling: .95,
		maxSpeed: 26,
		accel: 40,
		shield: 100,
		hull: 78,
		fireInterval: .2,
		shotDmg: 4.6,
		shotSpeed: 60,
		turnRate: 2.15,
		radius: 1.4,
		ultName: "Quantum Lock",
		ultShort: "LOCK",
		ultCd: 11
	},
	sentinel: {
		id: "sentinel",
		name: "Sentinel-G",
		faction: "ussf",
		role: "Support",
		blurb: "GSSAP frame. Proximity Ward reseals your shields and shrugs the next hits.",
		handling: .7,
		maxSpeed: 17,
		accel: 24,
		shield: 150,
		hull: 90,
		fireInterval: .32,
		shotDmg: 3.8,
		shotSpeed: 48,
		turnRate: 2.15,
		radius: 1.55,
		ultName: "Proximity Ward",
		ultShort: "WARD",
		ultCd: 10
	},
	splitter: {
		id: "splitter",
		name: "Splitter Ring",
		faction: "ussf",
		role: "Hunter",
		blurb: "ESPA frame. Ring Split throws the hostile wing off their locks.",
		handling: 1,
		maxSpeed: 25,
		accel: 38,
		shield: 92,
		hull: 68,
		fireInterval: .18,
		shotDmg: 3.2,
		shotSpeed: 58,
		turnRate: 2.15,
		radius: 1.45,
		ultName: "Ring Split",
		ultShort: "SPLIT",
		ultCd: 9
	},
	glide: {
		id: "glide",
		name: "Glide Knife",
		faction: "ussf",
		role: "Vanguard",
		blurb: "HTV frame. Skip Reentry is untargetable, then a ram. Miss it and you are a brick.",
		handling: 1.15,
		maxSpeed: 34,
		accel: 46,
		shield: 62,
		hull: 48,
		fireInterval: .24,
		shotDmg: 2.7,
		shotSpeed: 66,
		turnRate: 2.15,
		radius: 1.15,
		ultName: "Skip Reentry",
		ultShort: "RAM",
		ultCd: 13
	}
};
var ROSTER = {
	accord: [
		"mandjet",
		"shakuna",
		"sundara",
		"tripura"
	],
	ussf: [
		"duskbreaker",
		"sentinel",
		"splitter",
		"glide"
	]
};
function otherFaction(f) {
	return f === "accord" ? "ussf" : "accord";
}
function refitMul(level) {
	return 1 + Math.max(0, Math.min(5, level)) * .06;
}
function field(disc) {
	if (disc === "dust") return {
		relays: [
			{
				x: 36,
				z: 24,
				own: 0,
				cap: 0
			},
			{
				x: -36,
				z: -8,
				own: 0,
				cap: 0
			},
			{
				x: 34,
				z: -40,
				own: 0,
				cap: 0
			}
		],
		rocks: [
			{
				x: 22,
				z: 18,
				r: 2.8
			},
			{
				x: -22,
				z: 6,
				r: 3
			},
			{
				x: 24,
				z: -12,
				r: 2.6
			},
			{
				x: -24,
				z: -24,
				r: 3.1
			},
			{
				x: 20,
				z: -42,
				r: 2.4
			},
			{
				x: -20,
				z: -52,
				r: 2.7
			}
		]
	};
	if (disc === "beacon") return {
		relays: [
			{
				x: 20,
				z: 8,
				own: 0,
				cap: 0
			},
			{
				x: -16,
				z: 12,
				own: 0,
				cap: 0
			},
			{
				x: 2,
				z: -10,
				own: 0,
				cap: 0
			}
		],
		rocks: [
			{
				x: 32,
				z: 22,
				r: 2.4
			},
			{
				x: -30,
				z: -8,
				r: 3
			},
			{
				x: 18,
				z: -24,
				r: 2.5
			}
		]
	};
	if (disc === "night") return {
		relays: [
			{
				x: 42,
				z: 16,
				own: 0,
				cap: 0
			},
			{
				x: -38,
				z: 20,
				own: 0,
				cap: 0
			},
			{
				x: 6,
				z: -40,
				own: 0,
				cap: 0
			}
		],
		rocks: [
			{
				x: 14,
				z: 8,
				r: 3.1
			},
			{
				x: -12,
				z: 4,
				r: 2.6
			},
			{
				x: 8,
				z: -8,
				r: 3.4
			},
			{
				x: -22,
				z: -18,
				r: 2.8
			},
			{
				x: 28,
				z: -16,
				r: 3
			},
			{
				x: -4,
				z: -28,
				r: 2.4
			},
			{
				x: 36,
				z: 30,
				r: 2.2
			}
		]
	};
	return {
		relays: [
			{
				x: 34,
				z: 8,
				own: 0,
				cap: 0
			},
			{
				x: -16,
				z: 30,
				own: 0,
				cap: 0
			},
			{
				x: -16,
				z: -28,
				own: 0,
				cap: 0
			}
		],
		rocks: [
			{
				x: 12,
				z: 12,
				r: 3.3
			},
			{
				x: -18,
				z: 6,
				r: 2.7
			},
			{
				x: 6,
				z: -16,
				r: 3.5
			},
			{
				x: -6,
				z: -30,
				r: 2.5
			},
			{
				x: 26,
				z: -6,
				r: 2.9
			},
			{
				x: -32,
				z: 16,
				r: 3.2
			},
			{
				x: 20,
				z: 28,
				r: 2.3
			}
		]
	};
}
function matchLimit(pace) {
	return pace === "strike" ? 360 : 120;
}
var nextId = 1;
function wrap(a) {
	let v = a;
	while (v > Math.PI) v -= Math.PI * 2;
	while (v < -Math.PI) v += Math.PI * 2;
	return v;
}
function engMul(eng) {
	return eng <= 2 ? .7 + (eng - 1) * .3 : 1 + (eng - 2) * .15;
}
function wepMul(wep) {
	return wep <= 2 ? .75 + (wep - 1) * .25 : 1 + (wep - 2) * .125;
}
function defMul(def) {
	return def <= 2 ? .85 + (def - 1) * .15 : 1 + (def - 2) * .2;
}
function craft(ship, ai, team, x, z, yaw, bonus) {
	const def = SHIPS[ship];
	const shield = def.shield * bonus;
	const hull = def.hull * bonus;
	return {
		id: nextId++,
		ship,
		faction: def.faction,
		ai,
		team,
		x,
		z,
		yaw,
		pitch: 0,
		speed: 0,
		steer: 0,
		hull,
		hullMax: hull,
		shield,
		shieldMax: shield,
		baseShield: shield,
		fireCd: ai ? .4 : 0,
		ultCd: 0,
		alive: true,
		respawn: 0,
		cloak: 0,
		boost: 0,
		boostDmg: 0,
		rammed: false,
		untargetable: 0,
		root: 0,
		jam: 0,
		dmgMul: 1,
		dmgMulT: 0,
		nextCrit: false,
		recover: 0,
		hurtT: 0,
		guard: ai ? .6 : 2.4,
		evadeCd: 0,
		radius: def.radius,
		ace: false
	};
}
function createMatch(shipId, faction, refit, pace = "practice", setup = {}) {
	nextId = 1;
	const player = craft(shipId, false, "you", 0, 28, 0, refitMul(refit));
	const mine = ROSTER[faction];
	const allyIds = mine.filter((id) => id !== shipId);
	while (allyIds.length < 4) allyIds.push(mine[allyIds.length % mine.length]);
	const allySpots = [
		{
			x: -9,
			z: 18
		},
		{
			x: 9,
			z: 18
		},
		{
			x: -16,
			z: 34
		},
		{
			x: 16,
			z: 34
		}
	];
	const allyCount = Math.max(1, Math.min(4, setup.allyCount ?? 4));
	const foeCount = Math.max(1, Math.min(5, setup.foeCount ?? 5));
	const allies = allyIds.slice(0, allyCount).map((id, i) => {
		const s = allySpots[i];
		return craft(id, true, "you", s.x, s.z, 0, 1);
	});
	const foeRoster = ROSTER[otherFaction(faction)];
	const foeShips = [...foeRoster, foeRoster[1]].slice(0, foeCount);
	const foeSpots = [
		{
			x: -18,
			z: -6
		},
		{
			x: 18,
			z: -4
		},
		{
			x: 0,
			z: -18
		},
		{
			x: -12,
			z: -28
		},
		{
			x: 14,
			z: -24
		}
	];
	const enemies = foeShips.map((id, i) => {
		const s = foeSpots[i];
		const yaw = Math.atan2(-(player.x - s.x), -(player.z - s.z));
		return craft(id, true, "foe", s.x, s.z, yaw, 1);
	});
	const goal = setup.goal ?? "disc";
	const disc = setup.disc ?? "rust";
	const ground = field(disc);
	if (goal === "ace" && enemies.length > 0) {
		const warden = enemies[enemies.length - 1];
		warden.ace = true;
		warden.hull *= 1.7;
		warden.hullMax *= 1.7;
		warden.shield *= 1.45;
		warden.shieldMax *= 1.45;
		warden.baseShield *= 1.45;
	}
	return {
		player,
		enemies,
		allies,
		bullets: [],
		relays: ground.relays,
		rocks: ground.rocks,
		pips: {
			eng: 2,
			wep: 2,
			def: 2
		},
		pipFrom: {
			eng: 2,
			wep: 2,
			def: 2
		},
		pipTo: {
			eng: 2,
			wep: 2,
			def: 2
		},
		ramp: 1,
		presetCd: 0,
		preset: 0,
		time: 0,
		youBar: 100,
		foeBar: 100,
		kills: 0,
		deaths: 0,
		lockId: null,
		fx: [],
		over: null,
		refit,
		playerFaction: faction,
		pace,
		limit: matchLimit(pace),
		goal,
		disc,
		tech: setup.tech === "stick" || setup.tech === "barrels" || setup.tech === "mark" ? setup.tech : null,
		runner: goal === "extract" ? {
			x: 0,
			z: 46,
			yaw: 0,
			hull: 640,
			hullMax: 640,
			alive: true,
			radius: 2.3,
			team: faction === "ussf" ? "you" : "foe",
			faction: "ussf",
			untargetable: 0,
			cloak: 0
		} : null
	};
}
function relaysHeld(match) {
	return match.relays.filter((r) => r.own === 1).length;
}
function pushFx(match, fx) {
	if (match.fx.length > 28) match.fx.shift();
	match.fx.push(fx);
}
function kill(match, c) {
	if (!c.alive) return;
	c.alive = false;
	c.hull = 0;
	c.speed = 0;
	c.respawn = 3.4;
	c.cloak = 0;
	c.boost = 0;
	pushFx(match, {
		k: "boom",
		x: c.x,
		z: c.z
	});
	const strike = match.pace === "strike";
	if (c.team === "foe") {
		match.kills += 1;
		match.foeBar = Math.max(0, match.foeBar - (strike ? 8 : 14));
		if (match.lockId === c.id) match.lockId = null;
		pushFx(match, {
			k: "down",
			name: SHIPS[c.ship].name
		});
	} else if (c.ai) match.youBar = Math.max(0, match.youBar - (strike ? 6 : 12));
	else {
		match.deaths += 1;
		match.youBar = Math.max(0, match.youBar - (strike ? 10 : 18));
		match.lockId = null;
	}
	if (c.ace) match.over = "win";
}
function hurt(match, c, dmg, fromX, fromZ) {
	if (!c.alive || c.guard > 0 || c.untargetable > 0) return false;
	let left = dmg;
	const absorbed = Math.min(c.shield, left);
	c.shield -= absorbed;
	left -= absorbed;
	c.hull -= left;
	c.hurtT = 2;
	c.cloak = 0;
	pushFx(match, {
		k: "hit",
		x: c.x,
		z: c.z,
		you: c.team === "you" && !c.ai,
		fromX: fromX ?? c.x,
		fromZ: fromZ ?? c.z
	});
	if (c.hull <= 0) kill(match, c);
	return true;
}
function aimYaw(fromX, fromZ, toX, toZ) {
	return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}
function tickTimers(c, dt) {
	c.fireCd = Math.max(0, c.fireCd - dt);
	c.ultCd = Math.max(0, c.ultCd - dt);
	c.cloak = Math.max(0, c.cloak - dt);
	c.jam = Math.max(0, c.jam - dt);
	c.guard = Math.max(0, c.guard - dt);
	c.untargetable = Math.max(0, c.untargetable - dt);
	c.dmgMulT = Math.max(0, c.dmgMulT - dt);
	c.hurtT = Math.max(0, c.hurtT - dt);
	c.evadeCd = Math.max(0, c.evadeCd - dt);
	c.root = Math.max(0, c.root - dt);
	c.boost = Math.max(0, c.boost - dt);
	c.recover = Math.max(0, c.recover - dt);
}
function moveCraft(match, c, steer, throttle, strafe, dt, speedMul) {
	const def = SHIPS[c.ship];
	let maxSp = def.maxSpeed * speedMul;
	let useSteer = steer;
	let useThrottle = throttle;
	let useStrafe = strafe;
	if (c.root > 0) {
		useSteer = 0;
		useThrottle = 0;
		useStrafe = 0;
		c.speed = 0;
		maxSp = 0;
	} else if (c.boost > 0) {
		useThrottle = 1;
		maxSp *= 1.9;
	}
	if (c.recover > 0) maxSp *= .45;
	const accel = def.accel * Math.max(.7, speedMul);
	const target = Math.max(-1, Math.min(1, useThrottle)) * maxSp;
	if (c.speed < target) c.speed = Math.min(target, c.speed + accel * dt);
	else c.speed = Math.max(target, c.speed - accel * dt);
	let rate = def.turnRate * def.handling * (c.ai ? .84 : 1);
	if (!c.ai && match.tech === "stick") rate *= 1.12;
	c.yaw = wrap(c.yaw + Math.max(-1, Math.min(1, useSteer)) * rate * dt);
	c.steer = useSteer;
	const strafeSpeed = def.maxSpeed * .8;
	c.x += -Math.cos(c.yaw) * useStrafe * strafeSpeed * dt;
	c.z += Math.sin(c.yaw) * useStrafe * strafeSpeed * dt;
	c.x += -Math.sin(c.yaw) * c.speed * dt;
	c.z += -Math.cos(c.yaw) * c.speed * dt;
	const dist = Math.hypot(c.x, c.z);
	if (dist > 78) {
		c.x = c.x / dist * 78;
		c.z = c.z / dist * 78;
		if (c.speed > 0) c.speed *= .35;
	}
	for (const rock of match.rocks) {
		const dx = c.x - rock.x;
		const dz = c.z - rock.z;
		const d = Math.hypot(dx, dz);
		const min = rock.r + c.radius * .85;
		if (d < min && d > .001) {
			c.x = rock.x + dx / d * min;
			c.z = rock.z + dz / d * min;
		}
	}
}
function fire(match, c, speedMulWep) {
	if (!c.alive || c.fireCd > 0 || c.root > 0) return;
	if (match.bullets.length > 110) return;
	const def = SHIPS[c.ship];
	c.fireCd = def.fireInterval / speedMulWep;
	if (!c.ai && match.tech === "barrels") c.fireCd *= .88;
	let dmg = def.shotDmg * Math.sqrt(speedMulWep);
	if (c.ai) dmg *= .46;
	else dmg *= 1 + match.refit * .04;
	if (!c.ai && c.dmgMulT > 0) dmg *= c.dmgMul;
	let big = false;
	if (!c.ai && c.nextCrit) {
		dmg *= 2.45;
		c.nextCrit = false;
		big = true;
	}
	if (c.cloak > 0) c.cloak = 0;
	const spread = c.ai ? (Math.random() - .5) * .16 : 0;
	const yaw = c.yaw + spread;
	const sp = def.shotSpeed;
	const nose = c.radius + .7;
	match.bullets.push({
		x: c.x + -Math.sin(yaw) * nose,
		z: c.z + -Math.cos(yaw) * nose,
		vx: -Math.sin(yaw) * sp,
		vz: -Math.cos(yaw) * sp,
		life: def.id === "sundara" ? 2.3 : 1.35,
		dmg,
		faction: c.faction,
		r: def.id === "sundara" ? .72 : .34,
		homeId: !c.ai && def.id === "sundara" ? match.lockId : null,
		own: !c.ai
	});
	pushFx(match, {
		k: "shot",
		x: c.x,
		z: c.z,
		big,
		you: !c.ai
	});
}
function triggerUlt(match, c) {
	if (!c.alive || c.ultCd > 0) return;
	const def = SHIPS[c.ship];
	c.ultCd = def.ultCd;
	if (c.ship === "mandjet") {
		c.speed *= .3;
		pushFx(match, {
			k: "flare",
			x: c.x,
			z: c.z,
			yaw: c.yaw
		});
		for (const e of match.enemies) {
			if (!e.alive) continue;
			if (Math.hypot(e.x - c.x, e.z - c.z) > 30) continue;
			if (Math.abs(wrap(aimYaw(c.x, c.z, e.x, e.z) - c.yaw)) < .46) hurt(match, e, 36);
		}
	} else if (c.ship === "shakuna") {
		c.boost = .48;
		c.boostDmg = 18;
		c.rammed = false;
		c.speed = def.maxSpeed * 1.7;
	} else if (c.ship === "sundara") {
		c.cloak = 4;
		c.nextCrit = true;
	} else if (c.ship === "tripura") {
		pushFx(match, {
			k: "emp",
			x: c.x,
			z: c.z
		});
		for (const e of match.enemies) {
			if (!e.alive) continue;
			if (Math.hypot(e.x - c.x, e.z - c.z) < 20) e.root = Math.max(e.root, 1.15);
		}
	} else if (c.ship === "duskbreaker") {
		c.dmgMul = 1.5;
		c.dmgMulT = 3.2;
		if (match.lockId == null) {
			let best = null;
			let bestAbs = 1;
			for (const e of match.enemies) {
				if (!e.alive) continue;
				const ang = Math.abs(wrap(aimYaw(c.x, c.z, e.x, e.z) - c.yaw));
				if (ang < bestAbs) {
					bestAbs = ang;
					best = e;
				}
			}
			if (best && bestAbs < .7) match.lockId = best.id;
		}
	} else if (c.ship === "sentinel") {
		c.shield = c.shieldMax;
		c.guard = Math.max(c.guard, 1.35);
	} else if (c.ship === "splitter") {
		for (const e of match.enemies) if (e.alive) e.jam = Math.max(e.jam, 3.2);
	} else if (c.ship === "glide") {
		c.untargetable = 1.15;
		c.boost = 1.15;
		c.boostDmg = 42;
		c.rammed = false;
		c.speed = def.maxSpeed * 1.65;
	}
}
function cycleLock(match) {
	const player = match.player;
	const alive = match.enemies.filter((e) => e.alive);
	if (alive.length === 0) {
		match.lockId = null;
		return;
	}
	const cone = alive.filter((e) => Math.abs(wrap(aimYaw(player.x, player.z, e.x, e.z) - player.yaw)) < .4);
	const pool = cone.length > 0 ? cone : alive;
	const idx = pool.findIndex((e) => e.id === match.lockId);
	if (pool.length === 1 && pool[0].id === match.lockId) {
		match.lockId = null;
		return;
	}
	match.lockId = pool[(idx + 1) % pool.length].id;
}
function steerAi(match, e, dt) {
	const hostile = e.team === "foe";
	const quarry = (hostile ? [match.player, ...match.allies] : match.enemies).filter((c) => c.alive && c.untargetable <= 0 && c.cloak <= 0);
	if (match.runner?.alive && match.runner.team !== e.team) quarry.push(match.runner);
	if (e.jam > 0) {
		moveCraft(match, e, Math.sin(match.time * 2.4 + e.id), .35, 0, dt, .9);
		return;
	}
	let tx = 0;
	let tz = 0;
	let chase = null;
	let bestD = match.goal === "extract" ? 74 : 42;
	for (const q of quarry) {
		const d = Math.hypot(q.x - e.x, q.z - e.z);
		if (d < bestD) {
			bestD = d;
			chase = q;
		}
	}
	if (chase) {
		tx = chase.x;
		tz = chase.z;
	} else {
		let best = match.relays[0];
		let bd = 1e9;
		const owned = hostile ? -1 : 1;
		for (const r of match.relays) {
			if (r.own === owned) continue;
			const d = Math.hypot(r.x - e.x, r.z - e.z);
			if (d < bd) {
				bd = d;
				best = r;
			}
		}
		if (match.relays.every((r) => r.own === owned) && quarry.length > 0) {
			tx = quarry[0].x;
			tz = quarry[0].z;
			chase = quarry[0];
		} else {
			tx = best.x;
			tz = best.z;
		}
	}
	const diff = wrap(aimYaw(e.x, e.z, tx, tz) - e.yaw);
	moveCraft(match, e, Math.max(-1, Math.min(1, diff / .42)), Math.abs(diff) < .9 ? 1 : .4, 0, dt, hostile ? .9 : .96);
	if (chase && Math.abs(diff) < .3 && Math.hypot(chase.x - e.x, chase.z - e.z) < 46) fire(match, e, 1);
	const mates = hostile ? match.enemies : [match.player, ...match.allies];
	for (const o of mates) {
		if (o === e || !o.alive) continue;
		const dx = e.x - o.x;
		const dz = e.z - o.z;
		const d = Math.hypot(dx, dz);
		if (d < 5.5 && d > .01) {
			e.x += dx / d * 4 * dt;
			e.z += dz / d * 4 * dt;
		}
	}
}
function respawn(match, c) {
	const angle = Math.random() * Math.PI * 2;
	const rad = 56.16;
	c.x = Math.cos(angle) * rad;
	c.z = Math.sin(angle) * rad;
	const focus = (c.team === "foe" ? [match.player, ...match.allies] : match.enemies).find((e) => e.alive) ?? match.player;
	c.yaw = aimYaw(c.x, c.z, focus.x, focus.z);
	c.speed = 0;
	c.hull = c.hullMax;
	c.shield = c.shieldMax;
	c.alive = true;
	c.guard = 1.3;
	c.root = 0;
	c.jam = 0;
	c.cloak = 0;
	c.boost = 0;
}
function boostHits(match, c) {
	if (c.boost <= 0 || c.boostDmg <= 0 || c.rammed) return;
	const targets = c.team === "foe" ? [match.player, ...match.allies] : match.enemies;
	for (const o of targets) {
		if (!o.alive || o.guard > 0) continue;
		if (Math.hypot(o.x - c.x, o.z - c.z) < c.radius + o.radius + .7) {
			hurt(match, o, c.boostDmg, c.x, c.z);
			c.rammed = true;
			if (c.ship === "glide") {
				c.boost = 0;
				c.recover = 1.35;
				c.untargetable = 0;
			}
			break;
		}
	}
}
function hurtRunner(match, dmg, fromX, fromZ) {
	const runner = match.runner;
	if (!runner || !runner.alive) return false;
	runner.hull -= dmg;
	pushFx(match, {
		k: "hit",
		x: runner.x,
		z: runner.z,
		you: false,
		fromX: fromX ?? runner.x,
		fromZ: fromZ ?? runner.z
	});
	if (runner.hull <= 0) {
		runner.alive = false;
		runner.hull = 0;
		pushFx(match, {
			k: "boom",
			x: runner.x,
			z: runner.z
		});
		match.over = runner.team === "you" ? "loss" : "win";
	}
	return true;
}
function tickRunner(match, dt) {
	const runner = match.runner;
	if (!runner || !runner.alive) return;
	runner.yaw = 0;
	runner.z -= 1.65 * dt;
	for (const rock of match.rocks) {
		const dx = runner.x - rock.x;
		const dz = runner.z - rock.z;
		const d = Math.hypot(dx, dz);
		const min = rock.r + runner.radius;
		if (d < min && d > .001) {
			runner.x = rock.x + dx / d * min;
			runner.z = rock.z + dz / d * min;
		}
	}
}
function step(match, input, dt) {
	if (match.over) return;
	const player = match.player;
	match.presetCd = Math.max(0, match.presetCd - dt);
	if (input.preset != null && match.presetCd <= 0 && input.preset !== match.preset) {
		const next = PRESET_PIPS[input.preset];
		if (next) {
			match.preset = input.preset;
			match.pipFrom = { ...match.pips };
			const [eng, wep, def] = next;
			match.pipTo = {
				eng,
				wep,
				def
			};
			match.ramp = 0;
			match.presetCd = 4;
		}
	}
	if (match.ramp < 1) {
		match.ramp = Math.min(1, match.ramp + dt / .35);
		const u = match.ramp;
		match.pips.eng = match.pipFrom.eng + (match.pipTo.eng - match.pipFrom.eng) * u;
		match.pips.wep = match.pipFrom.wep + (match.pipTo.wep - match.pipFrom.wep) * u;
		match.pips.def = match.pipFrom.def + (match.pipTo.def - match.pipFrom.def) * u;
	}
	player.shieldMax = player.baseShield * defMul(match.pips.def);
	if (player.shield > player.shieldMax) player.shield = player.shieldMax;
	const glideBoosting = player.alive && player.ship === "glide" && player.boost > 0 && !player.rammed;
	tickTimers(player, dt);
	for (const mate of match.allies) tickTimers(mate, dt);
	for (const e of match.enemies) tickTimers(e, dt);
	if (player.alive) {
		const mul = engMul(match.pips.eng);
		if (input.evade !== 0 && player.evadeCd <= 0 && player.root <= 0) {
			player.x += -Math.cos(player.yaw) * input.evade * 5.2;
			player.z += Math.sin(player.yaw) * input.evade * 5.2;
			player.evadeCd = 1.15;
		}
		moveCraft(match, player, input.yaw, input.throttle, input.strafe, dt, mul);
		const wantPitch = Math.max(-1, Math.min(1, input.pitch)) * .42;
		player.pitch += (wantPitch - player.pitch) * Math.min(1, dt * 7);
		if (input.fire) fire(match, player, wepMul(match.pips.wep));
		if (input.ult) triggerUlt(match, player);
		if (input.lock) cycleLock(match);
		if (player.hurtT <= 0) player.shield = Math.min(player.shieldMax, player.shield + 16 * dt);
		else if (match.pips.def >= 3.15) player.shield = Math.min(player.shieldMax, player.shield + 6 * dt);
		boostHits(match, player);
		if (glideBoosting && player.boost <= 0) {
			player.recover = Math.max(player.recover, 1.35);
			player.untargetable = 0;
		}
	} else {
		player.respawn -= dt;
		if (player.respawn <= 0 && match.youBar > 0) respawn(match, player);
	}
	for (const mate of match.allies) {
		if (!mate.alive) {
			mate.respawn -= dt;
			if (mate.respawn <= 0 && match.youBar > 0) respawn(match, mate);
			continue;
		}
		steerAi(match, mate, dt);
		boostHits(match, mate);
		if (mate.hurtT <= 0) mate.shield = Math.min(mate.shieldMax, mate.shield + 5 * dt);
	}
	for (const e of match.enemies) {
		if (!e.alive) {
			e.respawn -= dt;
			if (e.respawn <= 0 && match.foeBar > 0 && !e.ace) respawn(match, e);
			continue;
		}
		steerAi(match, e, dt);
		boostHits(match, e);
		if (e.hurtT <= 0) e.shield = Math.min(e.shieldMax, e.shield + 5 * dt);
	}
	for (let i = match.bullets.length - 1; i >= 0; i--) {
		const b = match.bullets[i];
		if (b.homeId != null) {
			const target = match.enemies.find((e) => e.id === b.homeId && e.alive);
			if (target) {
				const yaw = Math.atan2(-b.vx, -b.vz);
				const want = aimYaw(b.x, b.z, target.x, target.z);
				const ny = yaw + Math.max(-2.4 * dt, Math.min(2.4 * dt, wrap(want - yaw)));
				const sp = Math.hypot(b.vx, b.vz);
				b.vx = -Math.sin(ny) * sp;
				b.vz = -Math.cos(ny) * sp;
			}
		}
		b.x += b.vx * dt;
		b.z += b.vz * dt;
		b.life -= dt;
		let dead = b.life <= 0;
		if (!dead) {
			for (const rock of match.rocks) if (Math.hypot(rock.x - b.x, rock.z - b.z) < rock.r) {
				dead = true;
				break;
			}
		}
		if (!dead && match.runner?.alive && match.runner.faction !== b.faction) {
			const cage = match.runner;
			if (Math.hypot(cage.x - b.x, cage.z - b.z) < cage.radius + b.r) {
				if (hurtRunner(match, b.dmg, b.x, b.z) && b.own) pushFx(match, { k: "ping" });
				dead = true;
			}
		}
		if (!dead) {
			const targets = b.faction === match.playerFaction ? match.enemies : [player, ...match.allies];
			for (const t of targets) {
				if (!t.alive) continue;
				if (Math.hypot(t.x - b.x, t.z - b.z) < t.radius + b.r) {
					if (hurt(match, t, b.own && match.tech === "mark" && t.id === match.lockId ? b.dmg * 1.22 : b.dmg, b.x, b.z) && b.own) pushFx(match, { k: "ping" });
					dead = true;
					break;
				}
			}
		}
		if (dead) match.bullets.splice(i, 1);
	}
	for (const r of match.relays) {
		const friendNear = player.alive && Math.hypot(player.x - r.x, player.z - r.z) < 9 || match.allies.some((a) => a.alive && Math.hypot(a.x - r.x, a.z - r.z) < 9);
		const enemyNear = match.enemies.some((e) => e.alive && Math.hypot(e.x - r.x, e.z - r.z) < 9);
		if (friendNear && !enemyNear) r.cap = Math.min(1, r.cap + dt * .42);
		else if (enemyNear && !friendNear) r.cap = Math.max(-1, r.cap - dt * .42);
		r.own = r.cap > .58 ? 1 : r.cap < -.58 ? -1 : 0;
	}
	const yours = match.relays.filter((r) => r.own === 1).length;
	const theirs = match.relays.filter((r) => r.own === -1).length;
	const drain = match.pace === "strike" ? .85 : 3.4;
	if (yours >= 2) match.foeBar = Math.max(0, match.foeBar - drain * dt);
	if (theirs >= 2) match.youBar = Math.max(0, match.youBar - drain * dt);
	tickRunner(match, dt);
	match.time += dt;
	if (match.goal === "extract" && match.runner) {
		const cage = match.runner;
		if (!match.over && !cage.alive) match.over = cage.team === "you" ? "loss" : "win";
		else if (!match.over && cage.z <= -68) match.over = cage.team === "you" ? "win" : "loss";
		else if (!match.over && match.youBar <= 0) match.over = "loss";
		else if (!match.over && match.time >= match.limit) match.over = cage.team === "you" ? "loss" : "win";
	} else if (match.goal === "beacons" && yours >= 2) match.over = "win";
	else if (match.foeBar <= 0 && match.goal !== "ace") match.over = "win";
	else if (match.youBar <= 0) match.over = "loss";
	else if (match.time >= match.limit) {
		if (match.goal === "ace") match.over = "loss";
		else if (match.goal === "beacons") match.over = yours >= 2 ? "win" : "loss";
		else match.over = match.youBar > match.foeBar ? "win" : match.youBar < match.foeBar ? "loss" : "draw";
	}
}
var DRILL = [
	"Burn forward. W, or the left stick.",
	"Nose left is A. Right is D.",
	"Fire. Space, or the gold button.",
	"Tap ENG, WEP, or DEF."
];
var _fwd = new Vector3();
var _up = new Vector3(0, 1, 0);
var _x = new Vector3();
var _y = new Vector3();
var _x2 = new Vector3();
var _y2 = new Vector3();
var _tmp = new Vector3();
var _basis = new Matrix4();
var _cam = new Vector3();
var _look = new Vector3();
function orient(obj, yaw, pitch, steer) {
	const cp = Math.cos(pitch);
	const sp = Math.sin(pitch);
	_fwd.set(-Math.sin(yaw) * cp, sp, -Math.cos(yaw) * cp);
	if (_fwd.lengthSq() < 1e-8) _fwd.set(0, 0, -1);
	_fwd.normalize();
	_x.crossVectors(_up, _fwd);
	if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0);
	_x.normalize();
	_y.crossVectors(_fwd, _x).normalize();
	const bank = -steer * .55;
	const cos = Math.cos(bank);
	const sin = Math.sin(bank);
	_tmp.crossVectors(_fwd, _x);
	_x2.copy(_x).multiplyScalar(cos).addScaledVector(_tmp, sin);
	_tmp.crossVectors(_fwd, _y);
	_y2.copy(_y).multiplyScalar(cos).addScaledVector(_tmp, sin);
	_basis.makeBasis(_x2, _y2, _fwd);
	obj.quaternion.setFromRotationMatrix(_basis);
}
function metal(color, emissive, intensity) {
	return new MeshStandardMaterial({
		color,
		emissive,
		emissiveIntensity: intensity,
		metalness: .68,
		roughness: .36
	});
}
function tag(mesh, intensity, group) {
	mesh.userData.baseE = intensity;
	group.add(mesh);
}
function buildShip(id) {
	const g = new Group();
	const accord = SHIPS[id].faction === "accord";
	const hull = metal(accord ? 13144634 : 12043212, accord ? 5911568 : 1713196, accord ? .42 : .25);
	const hot = metal(accord ? 16766881 : 14019839, accord ? 16757338 : 8304340, .85);
	const nose = new Mesh(new ConeGeometry(.16, .72, 8), hot);
	nose.geometry.rotateX(Math.PI / 2);
	nose.position.z = 1.45;
	tag(nose, .85, g);
	if (id === "mandjet") {
		const disc = new Mesh(new CircleGeometry(.86, 28), hot);
		disc.position.z = -.2;
		disc.rotation.y = Math.PI;
		tag(disc, .85, g);
		const wing = new BoxGeometry(1.4, .05, .48);
		const left = new Mesh(wing, hull);
		left.position.set(-1.2, .02, -.05);
		left.rotation.y = -.4;
		tag(left, .42, g);
		const right = new Mesh(wing.clone(), hull);
		right.position.set(1.2, .02, -.05);
		right.rotation.y = .4;
		tag(right, .42, g);
	} else if (id === "shakuna") {
		const body = new Mesh(new ConeGeometry(.28, 1.7, 7), hull);
		body.geometry.rotateX(Math.PI / 2);
		tag(body, .42, g);
		const wing = new BoxGeometry(1.15, .04, .42);
		const left = new Mesh(wing, hot);
		left.position.set(-.85, .12, -.1);
		left.rotation.z = .35;
		left.rotation.y = -.5;
		tag(left, .85, g);
		const right = new Mesh(wing.clone(), hot);
		right.position.set(.85, .12, -.1);
		right.rotation.z = -.35;
		right.rotation.y = .5;
		tag(right, .85, g);
	} else if (id === "sundara") {
		const needle = new Mesh(new CylinderGeometry(.12, .22, 2.5, 10), hull);
		needle.geometry.rotateX(Math.PI / 2);
		tag(needle, .25, g);
		const fin = new BoxGeometry(.7, .04, .28);
		const left = new Mesh(fin, hot);
		left.position.set(-.28, 0, -.7);
		tag(left, .85, g);
		const right = new Mesh(fin.clone(), hot);
		right.position.set(.28, 0, -.7);
		tag(right, .85, g);
	} else if (id === "tripura") {
		tag(new Mesh(new OctahedronGeometry(.38), hot), .85, g);
		for (let i = 0; i < 3; i++) {
			const ring = new Mesh(new TorusGeometry(.72 + i * .18, .045, 8, 24), hull);
			ring.rotation.x = .4 + i * .5;
			ring.rotation.y = i * .7;
			tag(ring, .42, g);
		}
	} else if (id === "duskbreaker") {
		tag(new Mesh(new BoxGeometry(.36, .18, 1.7), hull), .25, g);
		const wing = new BoxGeometry(1.5, .04, .55);
		const delta = new Mesh(wing, hot);
		delta.position.z = -.1;
		tag(delta, .5, g);
		const tail = new Mesh(new BoxGeometry(.04, .38, .28), hull);
		tail.position.set(0, .2, -.7);
		tag(tail, .25, g);
	} else if (id === "sentinel") {
		tag(new Mesh(new BoxGeometry(.45, .32, .7), hull), .25, g);
		const panel = new BoxGeometry(1.3, .03, .45);
		const left = new Mesh(panel, hot);
		left.position.set(-.95, 0, 0);
		tag(left, .7, g);
		const right = new Mesh(panel.clone(), hot);
		right.position.set(.95, 0, 0);
		tag(right, .7, g);
		const dish = new Mesh(new CylinderGeometry(.22, .22, .06, 12), hot);
		dish.rotation.x = Math.PI / 2;
		dish.position.z = .55;
		tag(dish, .85, g);
	} else if (id === "splitter") {
		tag(new Mesh(new SphereGeometry(.28, 12, 10), hot), .85, g);
		tag(new Mesh(new TorusGeometry(.85, .06, 8, 28), hull), .25, g);
		const drone = new BoxGeometry(.16, .16, .16);
		const a = new Mesh(drone, hot);
		a.position.set(.95, .2, .2);
		tag(a, .85, g);
		const b = new Mesh(drone.clone(), hot);
		b.position.set(-.7, -.15, -.3);
		tag(b, .85, g);
	} else {
		const dart = new Mesh(new ConeGeometry(.22, 2.15, 6), hull);
		dart.geometry.rotateX(Math.PI / 2);
		tag(dart, .25, g);
		const stub = new BoxGeometry(.7, .03, .22);
		const fins = new Mesh(stub, hot);
		fins.position.z = -.55;
		tag(fins, .7, g);
	}
	const exhaust = new Mesh(new SphereGeometry(.11, 8, 8), hot);
	exhaust.position.z = -1.2;
	exhaust.name = "exhaust";
	tag(exhaust, .85, g);
	return g;
}
function paint(group, craft) {
	group.visible = craft.alive;
	const flash = craft.hurtT > 1.55;
	const cloak = craft.cloak > 0;
	const blink = craft.guard > 0 && Math.sin(performance.now() * .02) > 0;
	group.traverse((obj) => {
		const mesh = obj;
		if (!mesh.isMesh) return;
		const mat = mesh.material;
		if (!mat || !("emissiveIntensity" in mat)) return;
		const base = mesh.userData.baseE ?? .4;
		mat.emissiveIntensity = flash ? 2.2 : base;
		mat.transparent = cloak || blink;
		mat.opacity = cloak ? .16 : blink ? .4 : 1;
	});
	const exhaust = group.getObjectByName("exhaust");
	if (exhaust && craft.alive) {
		const s = .5 + Math.min(1.6, Math.abs(craft.speed) / 16);
		exhaust.scale.setScalar(s);
	}
}
function drawRadar(canvas, match) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const w = canvas.width;
	ctx.clearRect(0, 0, w, w);
	ctx.strokeStyle = "rgba(224,161,90,0.6)";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(w / 2, w / 2, w / 2 - 3, 0, Math.PI * 2);
	ctx.stroke();
	const scale = (w / 2 - 8) / 78;
	const pt = (x, z) => [w / 2 + x * scale, w / 2 + z * scale];
	ctx.fillStyle = "rgba(141,135,124,0.75)";
	for (const rock of match.rocks) {
		const [x, y] = pt(rock.x, rock.z);
		ctx.beginPath();
		ctx.arc(x, y, Math.max(2, rock.r * scale), 0, Math.PI * 2);
		ctx.fill();
	}
	for (const relay of match.relays) {
		const [x, y] = pt(relay.x, relay.z);
		ctx.fillStyle = relay.own === 1 ? "#e0a15a" : relay.own === -1 ? "#c45c48" : "#8d877c";
		ctx.fillRect(x - 3, y - 3, 6, 6);
	}
	for (const ally of match.allies) {
		if (!ally.alive) continue;
		const [x, y] = pt(ally.x, ally.z);
		ctx.fillStyle = "#e0a15a";
		ctx.fillRect(x - 2, y - 2, 4, 4);
	}
	for (const enemy of match.enemies) {
		if (!enemy.alive) continue;
		const [x, y] = pt(enemy.x, enemy.z);
		ctx.fillStyle = "#c45c48";
		const s = enemy.ace ? 6 : 4;
		ctx.fillRect(x - s / 2, y - s / 2, s, s);
		if (enemy.ace) {
			ctx.strokeStyle = "#e6e1d6";
			ctx.strokeRect(x - 5, y - 5, 10, 10);
		}
	}
	if (match.runner?.alive) {
		const [x, y] = pt(match.runner.x, match.runner.z);
		ctx.fillStyle = match.runner.team === "you" ? "#e0a15a" : "#c45c48";
		ctx.fillRect(x - 4, y - 5, 8, 10);
	}
	if (match.player.alive) {
		const [x, y] = pt(match.player.x, match.player.z);
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(-match.player.yaw);
		ctx.fillStyle = "#e6e1d6";
		ctx.beginPath();
		ctx.moveTo(0, -7);
		ctx.lineTo(4.5, 5);
		ctx.lineTo(-4.5, 5);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
}
function Stick({ label, onAxis }) {
	const root = (0, import_react.useRef)(null);
	const knob = (0, import_react.useRef)(null);
	const place = (clientX, clientY) => {
		const el = root.current;
		const dot = knob.current;
		if (!el || !dot) return;
		const rect = el.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		let dx = clientX - cx;
		let dy = clientY - cy;
		const max = rect.width * .36;
		const len = Math.hypot(dx, dy) || 1;
		const clamped = Math.min(max, len);
		dx = dx / len * clamped;
		dy = dy / len * clamped;
		dot.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
		onAxis(dx / max, dy / max);
	};
	const reset = () => {
		if (knob.current) knob.current.style.transform = "translate(-50%, -50%)";
		onAxis(0, 0);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: root,
		role: "slider",
		"aria-label": label,
		"aria-valuemin": -1,
		"aria-valuemax": 1,
		"aria-valuenow": 0,
		className: "relative size-28 touch-none rounded-full border border-bone/30 bg-panel/80",
		onPointerDown: (event) => {
			event.stopPropagation();
			event.currentTarget.setPointerCapture(event.pointerId);
			place(event.clientX, event.clientY);
		},
		onPointerMove: (event) => {
			if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
			place(event.clientX, event.clientY);
		},
		onPointerUp: (event) => {
			event.stopPropagation();
			reset();
		},
		onPointerCancel: reset,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: knob,
			className: "absolute top-1/2 left-1/2 size-11 rounded-full bg-solar",
			style: { transform: "translate(-50%, -50%)" }
		})
	});
}
function Arena({ shipId, faction, scheme, refit, pace, goal, disc, allyCount, foeCount, objective, tech, gyro, drilled, onDrill, onDone }) {
	const canvasRef = (0, import_react.useRef)(null);
	const radarRef = (0, import_react.useRef)(null);
	const shieldRef = (0, import_react.useRef)(null);
	const hullRef = (0, import_react.useRef)(null);
	const youRef = (0, import_react.useRef)(null);
	const foeRef = (0, import_react.useRef)(null);
	const clockRef = (0, import_react.useRef)(null);
	const pipRef = (0, import_react.useRef)(null);
	const wingRef = (0, import_react.useRef)(null);
	const cageRef = (0, import_react.useRef)(null);
	const ultRef = (0, import_react.useRef)(null);
	const lockRef = (0, import_react.useRef)(null);
	const lockNameRef = (0, import_react.useRef)(null);
	const lockHpRef = (0, import_react.useRef)(null);
	const callRef = (0, import_react.useRef)(null);
	const markRef = (0, import_react.useRef)(null);
	const hurtRef = (0, import_react.useRef)(null);
	const aheadRef = (0, import_react.useRef)(null);
	const leftRef = (0, import_react.useRef)(null);
	const rightRef = (0, import_react.useRef)(null);
	const behindRef = (0, import_react.useRef)(null);
	const downRef = (0, import_react.useRef)(null);
	const presetRefs = (0, import_react.useRef)([
		null,
		null,
		null,
		null
	]);
	const busRef = (0, import_react.useRef)(null);
	const matchRef = (0, import_react.useRef)(null);
	const gyroOn = (0, import_react.useRef)(gyro);
	const drillCb = (0, import_react.useRef)(onDrill);
	gyroOn.current = gyro;
	drillCb.current = onDrill;
	if (!busRef.current) busRef.current = createBus(scheme);
	if (!matchRef.current) matchRef.current = createMatch(shipId, faction, refit, pace, {
		goal,
		allyCount,
		foeCount,
		disc,
		tech
	});
	const [end, setEnd] = (0, import_react.useState)(null);
	const [glError, setGlError] = (0, import_react.useState)(null);
	const [muted, setMutedUi] = (0, import_react.useState)(false);
	const [coach, setCoach] = (0, import_react.useState)(drilled ? "" : DRILL[0]);
	const coachStep = (0, import_react.useRef)(drilled ? 4 : 0);
	const ship = SHIPS[shipId];
	(0, import_react.useLayoutEffect)(() => {
		const canvas = canvasRef.current;
		const bus = busRef.current;
		const match = matchRef.current;
		if (!canvas || !bus || !match) return;
		let renderer;
		try {
			renderer = new WebGLRenderer({
				canvas,
				antialias: true,
				alpha: false,
				powerPreference: "high-performance"
			});
		} catch (err) {
			setGlError(err instanceof Error ? err.message : "WebGL unavailable");
			return;
		}
		const look = match.disc === "beacon" ? {
			clear: 1054752,
			fog: .0064,
			hemi: 14018804,
			ground: 1317924,
			sun: 14149631,
			mars: 7226932,
			ring: 10474728
		} : match.disc === "night" ? {
			clear: 460298,
			fog: .011,
			hemi: 7232616,
			ground: 789008,
			sun: 12868680,
			mars: 3806738,
			ring: 12868680
		} : match.disc === "dust" ? {
			clear: 1446156,
			fog: .008,
			hemi: 15192752,
			ground: 1840656,
			sun: 14721370,
			mars: 9058852,
			ring: 14721370
		} : {
			clear: 460813,
			fog: .0072,
			hemi: 12964060,
			ground: 1053724,
			sun: 16763034,
			mars: 9058852,
			ring: 14721370
		};
		renderer.setClearColor(look.clear, 1);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
		renderer.outputColorSpace = SRGBColorSpace;
		const scene = new Scene();
		scene.fog = new FogExp2(look.clear, look.fog);
		const camera = new PerspectiveCamera(58, 1, .1, 520);
		scene.add(new HemisphereLight(look.hemi, 1708044, .9));
		scene.add(new AmbientLight(9077108, .28));
		const sun = new DirectionalLight(look.sun, 1.7);
		sun.position.set(-50, 40, -20);
		scene.add(sun);
		const floor = new Mesh(new CircleGeometry(78, 72), new MeshStandardMaterial({
			color: look.ground,
			roughness: 1,
			metalness: 0
		}));
		floor.rotation.x = -Math.PI / 2;
		scene.add(floor);
		const ringPts = [];
		for (let i = 0; i <= 80; i++) {
			const a = i / 80 * Math.PI * 2;
			ringPts.push(new Vector3(Math.cos(a) * 78, .05, Math.sin(a) * 78));
		}
		scene.add(new Line(new BufferGeometry().setFromPoints(ringPts), new LineBasicMaterial({ color: look.ring })));
		const starPositions = /* @__PURE__ */ new Float32Array(2100);
		for (let i = 0; i < 700; i++) {
			const r = 160 + Math.random() * 180;
			const th = Math.random() * Math.PI * 2;
			const ph = Math.acos(2 * Math.random() - 1);
			starPositions[i * 3] = r * Math.sin(ph) * Math.cos(th);
			starPositions[i * 3 + 1] = r * Math.cos(ph) * .55;
			starPositions[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
		}
		const stars = new BufferGeometry();
		stars.setAttribute("position", new BufferAttribute(starPositions, 3));
		scene.add(new Points(stars, new PointsMaterial({
			color: 15131094,
			size: .55
		})));
		const mars = new Mesh(new SphereGeometry(28, 32, 24), new MeshStandardMaterial({
			color: look.mars,
			emissive: look.mars,
			emissiveIntensity: .65,
			roughness: 1
		}));
		mars.position.set(-24, 6, -150);
		scene.add(mars);
		for (const rock of match.rocks) {
			const mesh = new Mesh(new DodecahedronGeometry(rock.r, 0), metal(3814444, 1314316, .08));
			mesh.position.set(rock.x, rock.r * .35, rock.z);
			mesh.rotation.set(rock.x, rock.z, 0);
			scene.add(mesh);
		}
		const relayMats = [];
		match.relays.forEach((relay) => {
			const group = new Group();
			const pole = new Mesh(new CylinderGeometry(.18, .26, 3.4, 8), metal(2894116, 0, 0));
			pole.position.y = 1.7;
			const lampMat = metal(9275260, 3814444, .2);
			const lamp = new Mesh(new TorusGeometry(1.05, .07, 8, 24), lampMat);
			lamp.rotation.x = Math.PI / 2;
			lamp.position.y = 2.6;
			group.add(pole, lamp);
			group.position.set(relay.x, 0, relay.z);
			scene.add(group);
			relayMats.push(lampMat);
		});
		const playerGroup = buildShip(match.player.ship);
		const marker = new Mesh(new RingGeometry(1.35, 1.52, 24), new MeshBasicMaterial({
			color: 14721370,
			side: 2
		}));
		marker.rotation.x = -Math.PI / 2;
		marker.position.y = -.82;
		playerGroup.add(marker);
		scene.add(playerGroup);
		const allyGroups = match.allies.map((ally) => {
			const group = buildShip(ally.ship);
			const ring = new Mesh(new RingGeometry(1.15, 1.28, 20), new MeshBasicMaterial({
				color: 15131094,
				side: 2
			}));
			ring.rotation.x = -Math.PI / 2;
			ring.position.y = -.82;
			group.add(ring);
			scene.add(group);
			return group;
		});
		const enemyGroups = match.enemies.map((enemy) => {
			const group = buildShip(enemy.ship);
			if (enemy.ace) {
				const ring = new Mesh(new RingGeometry(1.45, 1.62, 24), new MeshBasicMaterial({
					color: 12868680,
					side: 2
				}));
				ring.rotation.x = -Math.PI / 2;
				ring.position.y = -.82;
				group.add(ring);
			}
			scene.add(group);
			return group;
		});
		const cage = new Group();
		const cageBody = new Mesh(new BoxGeometry(1.7, .7, 4.4), metal(match.runner?.team === "you" ? 12886890 : 9058866, 2757644, .25));
		const cageCabin = new Mesh(new BoxGeometry(1.15, .45, 1.3), metal(15131094, 3814444, .15));
		cageCabin.position.set(0, .5, -1.15);
		cage.add(cageBody, cageCabin);
		cage.visible = false;
		scene.add(cage);
		const bulletGeo = new SphereGeometry(.2, 6, 6);
		const bulletMeshes = Array.from({ length: 110 }, () => {
			const mesh = new Mesh(bulletGeo, new MeshBasicMaterial({ color: 16766881 }));
			mesh.visible = false;
			scene.add(mesh);
			return mesh;
		});
		const bracket = new Mesh(new TorusGeometry(2.15, .055, 8, 28), new MeshBasicMaterial({ color: 14721370 }));
		bracket.rotation.x = Math.PI / 2;
		bracket.visible = false;
		scene.add(bracket);
		const flareMat = new MeshBasicMaterial({
			color: 16767392,
			transparent: true,
			opacity: .3,
			side: 2,
			depthWrite: false
		});
		const flare = new Mesh(new ConeGeometry(3.4, 16, 16, 1, true), flareMat);
		flare.geometry.rotateX(Math.PI / 2);
		flare.visible = false;
		scene.add(flare);
		const empMat = new MeshBasicMaterial({
			color: 14721370,
			transparent: true,
			opacity: .7,
			side: 2,
			depthWrite: false
		});
		const emp = new Mesh(new RingGeometry(.4, .7, 40), empMat);
		emp.rotation.x = -Math.PI / 2;
		emp.visible = false;
		scene.add(emp);
		const resize = () => {
			const w = canvas.clientWidth || window.innerWidth;
			const h = canvas.clientHeight || window.innerHeight;
			renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
			renderer.setSize(w, h, false);
			camera.aspect = w / Math.max(1, h);
			camera.fov = w < h ? 74 : 58;
			camera.updateProjectionMatrix();
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		const onKeyDown = (event) => {
			bus.keys.add(event.code);
			if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();
		};
		const onKeyUp = (event) => {
			bus.keys.delete(event.code);
		};
		const clearHeld = () => {
			bus.keys.clear();
			bus.fireCanvas = false;
			bus.fireButton = false;
		};
		const onPointerDown = (event) => {
			if (event.button !== 0) return;
			unlockAudio();
			canvas.setPointerCapture(event.pointerId);
			bus.fireCanvas = true;
		};
		const onPointerUp = () => {
			bus.fireCanvas = false;
		};
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("blur", clearHeld);
		canvas.addEventListener("pointerdown", onPointerDown);
		canvas.addEventListener("pointerup", onPointerUp);
		canvas.addEventListener("pointercancel", onPointerUp);
		canvas.addEventListener("contextmenu", (event) => event.preventDefault());
		window.__controlsTest = {
			getYaw: () => match.player.yaw,
			getSpeed: () => match.player.speed,
			setKeys: (codes) => {
				bus.override = new Set(codes);
			},
			setSteer: (value) => {
				bus.steerOverride = value;
			}
		};
		let alive = true;
		let raf = 0;
		let last = performance.now();
		let acc = 0;
		let shake = 0;
		let markT = 0;
		let callT = 0;
		let callName = "";
		const wrecks = [];
		const threats = [];
		let flareT = 0;
		let empT = 0;
		let empX = 0;
		let empZ = 0;
		let reported = false;
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const FIXED = 1 / 60;
		const frame = (now) => {
			if (!alive) return;
			const delta = Math.min(.1, (now - last) / 1e3);
			last = now;
			acc += delta;
			if (gyroOn.current) {
				const aim = gyroAim();
				bus.gyroYaw = aim.yaw;
				bus.gyroPitch = aim.pitch;
			} else {
				bus.gyroYaw = 0;
				bus.gyroPitch = 0;
			}
			const sample = readInput(bus);
			let first = true;
			let steps = 0;
			while (acc >= FIXED && steps < 5) {
				step(match, first ? sample : {
					...sample,
					ult: false,
					lock: false,
					evade: 0,
					preset: null
				}, FIXED);
				first = false;
				acc -= FIXED;
				steps += 1;
			}
			const drill = coachStep.current;
			if (drill < 4) {
				const moved = match.player.speed > 2;
				const turned = Math.abs(match.player.yaw) > .22;
				const fired = match.player.fireCd > 0;
				const powered = match.presetCd > 0;
				const next = drill === 0 && moved ? 1 : drill === 1 && turned ? 2 : drill === 2 && fired ? 3 : drill === 3 && powered ? 4 : drill;
				if (next !== drill) {
					coachStep.current = next;
					setCoach(next >= 4 ? "" : DRILL[next]);
					if (next >= 4) drillCb.current();
				}
			}
			for (const ev of match.fx) if (ev.k === "shot") {
				if (ev.you) sfxShot(ev.big);
			} else if (ev.k === "hit") {
				if (ev.you) {
					sfxHit();
					threats.push({
						rel: wrap(aimYaw(match.player.x, match.player.z, ev.fromX, ev.fromZ) - match.player.yaw),
						t: .45
					});
					if (!reduce) shake = Math.min(.32, shake + .07);
				}
			} else if (ev.k === "boom") {
				sfxBoom();
				wrecks.push({
					x: ev.x,
					z: ev.z,
					t: 1.6
				});
				if (!reduce) shake = Math.min(.48, shake + .2);
			} else if (ev.k === "ping") {
				sfxHit();
				markT = .14;
			} else if (ev.k === "down") {
				callT = 1.35;
				callName = `${ev.name.toUpperCase()} DOWN`;
			} else if (ev.k === "flare") {
				flareT = .3;
				sfxUlt();
			} else if (ev.k === "emp") {
				empT = .5;
				empX = ev.x;
				empZ = ev.z;
				sfxUlt();
			}
			match.fx.length = 0;
			if (match.over && !reported) {
				reported = true;
				setEnd({
					outcome: match.over,
					kills: match.kills,
					deaths: match.deaths,
					relays: relaysHeld(match)
				});
			}
			const player = match.player;
			playerGroup.position.set(player.x, .9, player.z);
			orient(playerGroup, player.yaw, player.pitch, player.steer);
			paint(playerGroup, player);
			match.allies.forEach((ally, index) => {
				const group = allyGroups[index];
				group.position.set(ally.x, .9, ally.z);
				orient(group, ally.yaw, 0, ally.steer);
				paint(group, ally);
			});
			match.enemies.forEach((enemy, index) => {
				const group = enemyGroups[index];
				group.position.set(enemy.x, .9, enemy.z);
				orient(group, enemy.yaw, 0, enemy.steer);
				paint(group, enemy);
			});
			if (match.runner) {
				cage.visible = match.runner.alive;
				cage.position.set(match.runner.x, .85, match.runner.z);
				cage.rotation.y = match.runner.yaw;
			}
			if (cageRef.current) cageRef.current.textContent = match.runner ? `CAGE ${Math.max(0, Math.ceil(match.runner.hull / match.runner.hullMax * 100))}` : "";
			relayMats.forEach((mat, index) => {
				const own = match.relays[index].own;
				mat.emissive.setHex(own === 1 ? 14721370 : own === -1 ? 12868680 : 3814444);
				mat.emissiveIntensity = own === 0 ? .15 : .9;
			});
			for (let i = 0; i < bulletMeshes.length; i++) {
				const bullet = match.bullets[i];
				const mesh = bulletMeshes[i];
				if (!bullet) {
					mesh.visible = false;
					continue;
				}
				mesh.visible = true;
				mesh.position.set(bullet.x, .85, bullet.z);
				mesh.scale.setScalar(bullet.r > .5 ? 2.2 : 1);
				mesh.material.color.setHex(bullet.faction === "accord" ? 16766881 : 14019839);
			}
			const locked = match.enemies.find((enemy) => enemy.id === match.lockId && enemy.alive);
			bracket.visible = Boolean(locked);
			if (locked) {
				bracket.position.set(locked.x, .2, locked.z);
				bracket.scale.setScalar(Math.max(1, locked.radius / 1.5));
			}
			flareT = Math.max(0, flareT - delta);
			flare.visible = flareT > 0;
			if (flare.visible) {
				const fwx = -Math.sin(player.yaw);
				const fwz = -Math.cos(player.yaw);
				flare.position.set(player.x + fwx * 9, .9, player.z + fwz * 9);
				flare.quaternion.copy(playerGroup.quaternion);
				flareMat.opacity = flareT / .3 * .38;
			}
			empT = Math.max(0, empT - delta);
			emp.visible = empT > 0;
			if (emp.visible) {
				const grow = 1 + (1 - empT / .5) * 16;
				emp.position.set(empX, .3, empZ);
				emp.scale.setScalar(grow);
				empMat.opacity = empT / .5;
			}
			const fwx = -Math.sin(player.yaw);
			const fwz = -Math.cos(player.yaw);
			_cam.set(player.x - fwx * 16, 7.4, player.z - fwz * 16);
			_look.set(player.x + fwx * 14, 1.05, player.z + fwz * 14);
			const blend = 1 - Math.exp(-5 * delta);
			camera.position.lerp(_cam, blend);
			if (!reduce && shake > .002) {
				camera.position.x += (Math.random() - .5) * shake;
				camera.position.y += (Math.random() - .5) * shake * .5;
				shake *= Math.exp(-3.2 * delta);
			}
			camera.lookAt(_look);
			renderer.render(scene, camera);
			if (shieldRef.current) shieldRef.current.style.width = `${Math.max(0, player.shield / player.shieldMax * 100)}%`;
			if (hullRef.current) hullRef.current.style.width = `${Math.max(0, player.hull / player.hullMax * 100)}%`;
			if (youRef.current) youRef.current.style.width = `${match.youBar}%`;
			if (foeRef.current) foeRef.current.style.width = `${match.foeBar}%`;
			if (clockRef.current) {
				const left = Math.max(0, match.limit - match.time);
				const mins = Math.floor(left / 60);
				const secs = Math.floor(left % 60);
				clockRef.current.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
			}
			if (lockNameRef.current && lockHpRef.current) {
				if (locked) {
					const pct = Math.max(0, (locked.shield + locked.hull) / (locked.shieldMax + locked.hullMax) * 100);
					lockNameRef.current.textContent = SHIPS[locked.ship].name.toUpperCase();
					lockHpRef.current.style.width = `${pct}%`;
				} else {
					lockNameRef.current.textContent = "";
					lockHpRef.current.style.width = "0%";
				}
			}
			if (hurtRef.current) hurtRef.current.style.opacity = player.alive ? String(Math.min(.7, player.hurtT / 2.2)) : "0";
			let ahead = 0;
			let left = 0;
			let right = 0;
			let behind = 0;
			for (let i = threats.length - 1; i >= 0; i--) {
				threats[i].t -= delta;
				if (threats[i].t <= 0) {
					threats.splice(i, 1);
					continue;
				}
				const rel = threats[i].rel;
				const strength = Math.min(1, threats[i].t / .45);
				const abs = Math.abs(rel);
				if (abs < .7) ahead = Math.max(ahead, strength);
				else if (abs > 2.4) behind = Math.max(behind, strength);
				else if (rel > 0) left = Math.max(left, strength);
				else right = Math.max(right, strength);
			}
			if (aheadRef.current) aheadRef.current.style.opacity = String(ahead);
			if (leftRef.current) leftRef.current.style.opacity = String(left);
			if (rightRef.current) rightRef.current.style.opacity = String(right);
			if (behindRef.current) behindRef.current.style.opacity = String(behind);
			if (downRef.current) downRef.current.textContent = !player.alive && !match.over ? `HULL DOWN ${Math.max(0, player.respawn).toFixed(1)}` : "";
			if (pipRef.current) pipRef.current.textContent = `ENG ${match.pips.eng.toFixed(1)}  WEP ${match.pips.wep.toFixed(1)}  DEF ${match.pips.def.toFixed(1)}`;
			if (wingRef.current) {
				const up = match.allies.filter((ally) => ally.alive).length;
				wingRef.current.textContent = `WING ${up}/${match.allies.length}`;
			}
			if (ultRef.current) ultRef.current.textContent = player.ultCd > .05 ? `${ship.ultShort} ${player.ultCd.toFixed(1)}` : ship.ultShort;
			if (lockRef.current) lockRef.current.textContent = locked ? SHIPS[locked.ship].name.toUpperCase() : "LOCK";
			presetRefs.current.forEach((button, index) => {
				if (!button) return;
				button.dataset.on = index === match.preset ? "1" : "0";
				button.style.opacity = match.presetCd > .05 && index !== match.preset ? "0.4" : "1";
			});
			const radar = radarRef.current;
			if (radar) {
				drawRadar(radar, match);
				if (wrecks.length) {
					const ctx = radar.getContext("2d");
					if (ctx) {
						const w = radar.width;
						const scale = (w / 2 - 8) / 78;
						ctx.strokeStyle = "#e6e1d6";
						ctx.lineWidth = 1;
						for (const wreck of wrecks) {
							const x = w / 2 + wreck.x * scale;
							const y = w / 2 + wreck.z * scale;
							ctx.globalAlpha = Math.max(.25, Math.min(1, wreck.t));
							ctx.strokeRect(x - 3, y - 3, 6, 6);
						}
						ctx.globalAlpha = 1;
					}
				}
			}
			for (let i = wrecks.length - 1; i >= 0; i--) {
				wrecks[i].t -= delta;
				if (wrecks[i].t <= 0) wrecks.splice(i, 1);
			}
			markT = Math.max(0, markT - delta);
			callT = Math.max(0, callT - delta);
			if (markRef.current) markRef.current.style.opacity = markT > 0 ? "1" : "0";
			if (callRef.current) callRef.current.textContent = callT > 0 ? callName : "";
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => {
			alive = false;
			cancelAnimationFrame(raf);
			delete window.__controlsTest;
			observer.disconnect();
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", clearHeld);
			canvas.removeEventListener("pointerdown", onPointerDown);
			canvas.removeEventListener("pointerup", onPointerUp);
			canvas.removeEventListener("pointercancel", onPointerUp);
			const geos = /* @__PURE__ */ new Set();
			const mats = /* @__PURE__ */ new Set();
			scene.traverse((obj) => {
				const mesh = obj;
				if (mesh.geometry) geos.add(mesh.geometry);
				const mat = mesh.material;
				if (Array.isArray(mat)) mat.forEach((item) => mats.add(item));
				else if (mat) mats.add(mat);
			});
			geos.forEach((geo) => geo.dispose());
			mats.forEach((mat) => mat.dispose());
			renderer.dispose();
		};
	}, [ship.ultShort]);
	const bus = busRef.current;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative h-dvh w-full touch-none overflow-hidden bg-void text-bone select-none",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "absolute inset-0 h-full w-full"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: hurtRef,
				className: "pointer-events-none absolute inset-0 opacity-0",
				style: { boxShadow: "inset 0 0 90px 12px rgba(196,92,72,0.95)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: aheadRef,
				className: "pointer-events-none absolute top-28 left-1/2 h-1.5 w-16 -translate-x-1/2 bg-alert opacity-0"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: leftRef,
				className: "pointer-events-none absolute top-1/2 left-3 h-16 w-1.5 -translate-y-1/2 bg-alert opacity-0"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: rightRef,
				className: "pointer-events-none absolute top-1/2 right-3 h-16 w-1.5 -translate-y-1/2 bg-alert opacity-0"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: behindRef,
				className: "pointer-events-none absolute bottom-32 left-1/2 h-1.5 w-16 -translate-x-1/2 bg-alert opacity-0"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				ref: downRef,
				className: "pointer-events-none absolute top-[58%] left-1/2 -translate-x-1/2 font-hud text-2xl tracking-widest text-alert"
			}),
			glError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "absolute inset-x-0 top-1/3 px-6 text-center text-sm text-alert",
				children: glError
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-none absolute inset-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "w-40",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-hud text-sm tracking-widest text-solar",
										children: ship.name.toUpperCase()
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-1 h-2 overflow-hidden bg-panel",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											ref: shieldRef,
											className: "h-full w-full bg-solar"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-1 h-2 overflow-hidden bg-panel",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											ref: hullRef,
											className: "h-full w-full bg-alert"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										ref: pipRef,
										className: "mt-1 font-hud text-xs tracking-wide text-muted",
										children: "ENG 2.0  WEP 2.0  DEF 2.0"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-center",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										ref: clockRef,
										className: "font-hud text-3xl leading-none text-bone",
										children: pace === "strike" ? "6:00" : "2:00"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-hud text-xs tracking-widest text-muted",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											ref: wingRef,
											children: "WING"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-hud text-[10px] tracking-widest text-solar",
										children: objective
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										ref: cageRef,
										className: "font-hud text-[10px] tracking-widest text-bone"
									}),
									tech ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-hud text-[10px] tracking-widest text-muted",
										children: tech === "stick" ? "LIGHTER STICK" : tech === "barrels" ? "HOT BARRELS" : "MARKED PREY"
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-1 flex items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-hud text-xs text-solar",
												children: "YOU"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "h-2 w-16 overflow-hidden bg-panel",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													ref: youRef,
													className: "h-full w-full bg-solar"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "h-2 w-16 overflow-hidden bg-panel",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													ref: foeRef,
													className: "h-full w-full bg-alert"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-hud text-xs text-muted",
												children: "THEM"
											})
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col items-end gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
									ref: radarRef,
									width: 160,
									height: 160,
									className: "size-24 border border-bone/20 bg-void/70"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "pointer-events-auto h-11 px-3 font-hud text-sm tracking-widest text-bone",
									onClick: () => {
										const next = !isMuted();
										setMuted(next);
										setMutedUi(next);
									},
									children: muted ? "SOUND OFF" : "SOUND"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "absolute top-16 right-3 left-3 hidden text-center font-hud text-xs tracking-widest text-muted sm:block",
						children: scheme === "arc" ? "A NOSE LEFT  ·  D NOSE RIGHT  ·  W BURN  ·  SPACE FIRE  ·  F ULT" : "A SLIDE LEFT  ·  D SLIDE RIGHT  ·  AIM STICK TURNS  ·  W BURN"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 border border-solar/80" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						ref: markRef,
						className: "pointer-events-none absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 border border-alert opacity-0"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "pointer-events-none absolute top-[42%] left-1/2 w-28 -translate-x-1/2 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								ref: lockNameRef,
								className: "font-hud text-xs tracking-widest text-solar"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mx-auto mt-1 h-1 overflow-hidden bg-panel/80",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									ref: lockHpRef,
									className: "h-full w-0 bg-alert"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								ref: callRef,
								className: "mt-2 font-hud text-xs tracking-widest text-bone"
							})
						]
					}),
					coach ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "pointer-events-none absolute bottom-36 left-1/2 w-[min(28rem,92vw)] -translate-x-1/2 bg-void/80 px-3 py-2 text-center font-hud text-sm tracking-wide text-bone",
						children: coach
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute bottom-4 left-3 flex flex-col items-start gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "pointer-events-auto flex flex-col gap-2",
							children: PRESET_NAME.map((name, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								ref: (node) => {
									presetRefs.current[index] = node;
								},
								"data-on": index === 0 ? "1" : "0",
								className: "h-11 w-16 border border-bone/25 bg-panel font-hud text-base tracking-widest text-bone",
								onPointerDown: (event) => {
									event.stopPropagation();
									if (bus) bus.presetPulse = index;
								},
								children: name
							}, name))
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "pointer-events-auto",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stick, {
								label: "Move",
								onAxis: (x, y) => {
									if (!bus) return;
									bus.leftX = x;
									bus.leftY = y;
								}
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "absolute right-3 bottom-4 flex flex-col items-end gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "pointer-events-auto flex gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									ref: lockRef,
									type: "button",
									className: "h-12 min-w-16 border border-bone/30 bg-panel px-2 font-hud text-sm tracking-widest text-bone",
									onPointerDown: (event) => {
										event.stopPropagation();
										if (bus) bus.lockPulse = true;
									},
									children: "LOCK"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "h-12 min-w-16 border border-bone/30 bg-panel px-2 font-hud text-sm tracking-widest text-bone",
									onPointerDown: (event) => {
										event.stopPropagation();
										if (!bus) return;
										bus.evadePulse = bus.leftX > .2 ? -1 : 1;
									},
									children: "DODGE"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									ref: ultRef,
									type: "button",
									className: "h-12 min-w-16 border border-solar bg-panel px-2 font-hud text-sm tracking-widest text-solar",
									onPointerDown: (event) => {
										event.stopPropagation();
										unlockAudio();
										if (bus) bus.ultPulse = true;
									},
									children: ship.ultShort
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "h-12 min-w-16 bg-solar px-3 font-hud text-sm tracking-widest text-void",
									onPointerDown: (event) => {
										event.stopPropagation();
										event.currentTarget.setPointerCapture(event.pointerId);
										unlockAudio();
										if (bus) bus.fireButton = true;
									},
									onPointerUp: (event) => {
										event.stopPropagation();
										if (bus) bus.fireButton = false;
									},
									onPointerCancel: () => {
										if (bus) bus.fireButton = false;
									},
									children: "FIRE"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "pointer-events-auto",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stick, {
								label: "Aim",
								onAxis: (x, y) => {
									if (!bus) return;
									bus.rightX = x;
									bus.rightY = y;
								}
							})
						})]
					})
				]
			}),
			end ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 z-10 flex items-center justify-center bg-void/80 p-6",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full max-w-sm border border-solar/50 bg-panel p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-hud text-sm tracking-widest text-solar",
							children: "STRIKE CLOSED"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-hud text-4xl leading-none text-bone",
							children: end.outcome === "win" ? goal === "extract" ? faction === "ussf" ? "Cage away" : "Cage stopped" : goal === "ace" ? "Warden down" : goal === "beacons" ? "Beacons held" : "Disc held" : end.outcome === "loss" ? goal === "extract" ? faction === "ussf" ? "Cage lost" : "Cage escaped" : "Wing lost" : "Split disc"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-3 text-sm text-muted",
							children: [
								end.kills,
								" kills · ",
								end.deaths,
								" losses · ",
								end.relays,
								" relays still yours"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "mt-5 h-12 w-full bg-solar font-hud text-lg tracking-widest text-void",
							onClick: () => onDone(end),
							children: "Debrief"
						})
					]
				})
			}) : null
		]
	});
}
var GOODS = [
	{
		id: "salt",
		name: "Solar salt",
		base: 40
	},
	{
		id: "iron",
		name: "Void iron",
		base: 70
	},
	{
		id: "dust",
		name: "Relic dust",
		base: 110
	},
	{
		id: "resin",
		name: "Med resin",
		base: 55
	}
];
function isGood(id) {
	return GOODS.some((good) => good.id === id);
}
function goodName(id) {
	return GOODS.find((good) => good.id === id)?.name ?? id;
}
function basePrices() {
	return {
		salt: 40,
		iron: 70,
		dust: 110,
		resin: 55
	};
}
function winBid(price) {
	return Math.round(price * 1.35);
}
function scrapValue(paid) {
	return Math.round(paid * .4);
}
function dockValue(paid) {
	return Math.round(paid * .7);
}
function drift(prices, sold) {
	const next = { ...prices };
	for (const good of GOODS) {
		const wobble = .9 + Math.random() * .22;
		const supply = sold === good.id ? .86 : 1;
		const raw = Math.round(next[good.id] * wobble * supply);
		const lo = Math.round(good.base * .55);
		const hi = Math.round(good.base * 1.9);
		next[good.id] = Math.max(lo, Math.min(hi, raw));
	}
	return next;
}
function applyBuy(save, id) {
	if (save.hold) return save;
	const price = save.prices[id];
	if (!Number.isFinite(price) || price <= 0 || save.credits < price) return save;
	return {
		...save,
		credits: save.credits - price,
		hold: id,
		paid: price
	};
}
function applyDock(save) {
	if (!save.hold) return save;
	return {
		...save,
		credits: save.credits + dockValue(save.paid),
		hold: null,
		paid: 0
	};
}
var SORTIES = [
	{
		id: "contact",
		name: "Contact",
		order: 0,
		pace: "practice",
		goal: "disc",
		disc: "rust",
		allyCount: 4,
		foeCount: 4,
		objective: "HOLD TWO RELAYS",
		brief: "First light on the rust disc. Hold two relays or break their integrity."
	},
	{
		id: "beacon",
		name: "Beacon",
		order: 1,
		pace: "practice",
		goal: "beacons",
		disc: "beacon",
		allyCount: 2,
		foeCount: 3,
		objective: "SECURE TWO BEACONS",
		brief: "A short wing on the pale disc. Take two beacons and the sortie ends."
	},
	{
		id: "warden",
		name: "Warden",
		order: 2,
		pace: "strike",
		goal: "ace",
		disc: "night",
		allyCount: 4,
		foeCount: 5,
		objective: "KILL THE WARDEN",
		brief: "Six minutes on the night side. The marked ship does not come back."
	},
	{
		id: "cage",
		name: "Cage",
		order: 3,
		pace: "practice",
		goal: "extract",
		disc: "dust",
		allyCount: 3,
		foeCount: 4,
		objective: "THE CAGE",
		brief: "A cage is running Dusk down the dust lane. USSF covers it. The Accord stops it."
	}
];
var DISPATCHES = [
	{
		need: 0,
		from: "YARD",
		text: "Dusk's fleet is ash. He lives. The Accord has him."
	},
	{
		need: 1,
		from: "CONTACT",
		text: "The rust disc answered. The pale beacons are still dark."
	},
	{
		need: 2,
		from: "BEACON",
		text: "Two beacons are lit. A warden sits on the night side."
	},
	{
		need: 3,
		from: "WARDEN",
		text: "The warden is down. A cage is moving. Dusk is on it."
	},
	{
		need: 4,
		from: "CAGE",
		text: "The cage run is over. Dusk's war is not. The yard stays open."
	}
];
function sortieById(id) {
	return SORTIES.find((sortie) => sortie.id === id) ?? null;
}
function sortieUnlocked(id, cleared) {
	if (id === "skirmish" || id === "contact") return true;
	if (id === "beacon") return cleared >= 1;
	if (id === "warden") return cleared >= 2;
	return cleared >= 3;
}
var TECHS = [
	{
		id: "stick",
		name: "Lighter Stick",
		need: 1,
		detail: "Turns faster"
	},
	{
		id: "barrels",
		name: "Hot Barrels",
		need: 2,
		detail: "Fires sooner"
	},
	{
		id: "mark",
		name: "Marked Prey",
		need: 3,
		detail: "The lock hits harder"
	}
];
var KEY = "wfm-save-v1";
function defaultSave() {
	return {
		v: 1,
		credits: 90,
		ship: "mandjet",
		faction: "accord",
		scheme: "arc",
		refit: 0,
		prices: basePrices(),
		hold: null,
		paid: 0,
		pace: "practice",
		gyro: false,
		drilled: false,
		mission: "contact",
		cleared: 0,
		tech: null
	};
}
function loadSave() {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return defaultSave();
		const p = JSON.parse(raw);
		const base = defaultSave();
		if (p.v !== 1) return base;
		if (!p.ship || !SHIPS[p.ship]) return base;
		if (p.faction !== "accord" && p.faction !== "ussf") return base;
		const prices = { ...base.prices };
		if (p.prices && typeof p.prices === "object") for (const id of Object.keys(base.prices)) {
			const n = p.prices[id];
			if (typeof n === "number" && Number.isFinite(n)) prices[id] = Math.max(1, Math.round(n));
		}
		const hold = isGood(p.hold) ? p.hold : null;
		return {
			v: 1,
			credits: Math.max(0, Math.floor(p.credits ?? 0)),
			ship: p.ship,
			faction: p.faction,
			scheme: p.scheme === "strafe" ? "strafe" : "arc",
			refit: Math.max(0, Math.min(5, Math.floor(p.refit ?? 0))),
			prices,
			hold,
			paid: hold ? Math.max(0, Math.floor(p.paid ?? prices[hold])) : 0,
			pace: p.pace === "strike" ? "strike" : "practice",
			gyro: p.gyro === true,
			drilled: p.drilled === true,
			mission: p.mission === "skirmish" || p.mission === "contact" || p.mission === "beacon" || p.mission === "warden" || p.mission === "cage" ? p.mission : "contact",
			cleared: Math.max(0, Math.min(4, Math.floor(p.cleared ?? 0))),
			tech: TECHS.some((tech) => tech.id === p.tech && Math.max(0, Math.min(4, Math.floor(p.cleared ?? 0))) >= tech.need) ? p.tech : null
		};
	} catch {
		return defaultSave();
	}
}
function writeSave(save) {
	localStorage.setItem(KEY, JSON.stringify(save));
}
function refitCost(level) {
	return 120 * (level + 1);
}
function applyRefit(save) {
	if (save.refit >= 5) return save;
	const cost = refitCost(save.refit);
	if (save.credits < cost) return save;
	return {
		...save,
		credits: save.credits - cost,
		refit: save.refit + 1
	};
}
var emptySave = () => ({
	v: 1,
	credits: 90,
	ship: "mandjet",
	faction: "accord",
	scheme: "arc",
	refit: 0,
	prices: {
		salt: 40,
		iron: 70,
		dust: 110,
		resin: 55
	},
	hold: null,
	paid: 0,
	pace: "practice",
	gyro: false,
	drilled: false,
	mission: "contact",
	cleared: 0,
	tech: null
});
function WarApp() {
	const [save, setSave] = (0, import_react.useState)(emptySave);
	const [ready, setReady] = (0, import_react.useState)(false);
	const [phase, setPhase] = (0, import_react.useState)("brief");
	const [sortie, setSortie] = (0, import_react.useState)(0);
	const [result, setResult] = (0, import_react.useState)(null);
	const [gain, setGain] = (0, import_react.useState)(0);
	const [cargoLine, setCargoLine] = (0, import_react.useState)("");
	const [advance, setAdvance] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		setSave(loadSave());
		setReady(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (ready) writeSave(save);
	}, [save, ready]);
	const ship = SHIPS[save.ship];
	const cost = refitCost(save.refit);
	const bonus = refitMul(save.refit);
	const active = sortieById(save.mission);
	const pace = active?.pace ?? save.pace;
	const goal = active?.goal ?? "disc";
	const pickFaction = (faction) => {
		setSave((prev) => ({
			...prev,
			faction,
			ship: ROSTER[faction].includes(prev.ship) ? prev.ship : ROSTER[faction][0]
		}));
	};
	const buy = (id) => {
		setSave((prev) => applyBuy(prev, id));
	};
	const sellDock = () => {
		setSave((prev) => applyDock(prev));
	};
	const start = () => {
		unlockAudio();
		setResult(null);
		setPhase("fight");
	};
	const finish = (next) => {
		const combat = (next.outcome === "win" ? 80 : next.outcome === "draw" ? 45 : 30) + next.kills * 12 + next.relays * 10;
		let cargo = 0;
		let line = "";
		if (save.hold) {
			const name = goodName(save.hold);
			if (next.outcome === "loss") {
				cargo = scrapValue(save.paid);
				line = `${name} burned on the way back. Scrap paid ${cargo}.`;
			} else if (next.outcome === "win") {
				cargo = winBid(save.prices[save.hold]);
				line = `${name} cleared the yard for ${cargo}.`;
			} else {
				cargo = save.prices[save.hold];
				line = `${name} sold flat for ${cargo}.`;
			}
		}
		const held = save.hold;
		const flown = sortieById(save.mission);
		let cleared = save.cleared;
		let nextLine = "";
		if (next.outcome === "win" && flown && flown.order === save.cleared) {
			cleared = Math.min(4, save.cleared + 1);
			const found = TECHS.find((tech) => tech.need === cleared);
			nextLine = cleared >= 4 ? "The cage run is over. The yard stays open." : `Next sortie: ${SORTIES[cleared].name}.${found ? " " + found.name + " is on the rack." : ""}`;
		}
		setAdvance(nextLine);
		setCargoLine(line);
		setGain(combat + cargo + (next.outcome === "win" && flown ? 40 : 0));
		setResult(next);
		setSave((prev) => ({
			...prev,
			credits: prev.credits + combat + cargo + (next.outcome === "win" && flown ? 40 : 0),
			hold: null,
			paid: 0,
			prices: drift(prev.prices, held),
			cleared
		}));
		setPhase("debrief");
	};
	if (phase === "fight") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Arena, {
		shipId: save.ship,
		faction: save.faction,
		scheme: save.scheme,
		refit: save.refit,
		pace,
		goal,
		disc: active?.disc ?? "rust",
		allyCount: active?.allyCount ?? 4,
		foeCount: active?.foeCount ?? 5,
		objective: active?.id === "cage" ? save.faction === "ussf" ? "COVER THE CAGE" : "STOP THE CAGE" : active?.objective ?? "HOLD TWO RELAYS",
		tech: save.tech,
		gyro: save.gyro,
		drilled: save.drilled,
		onDrill: () => setSave((prev) => prev.drilled ? prev : {
			...prev,
			drilled: true
		}),
		onDone: finish
	}, `${sortie}-${save.ship}-${save.scheme}-${save.refit}-${save.mission}-${pace}-${save.tech ?? "none"}`);
	if (phase === "debrief" && result) {
		const title = result.outcome === "win" ? goal === "extract" ? save.faction === "ussf" ? "Cage away" : "Cage stopped" : goal === "ace" ? "Warden down" : goal === "beacons" ? "Beacons held" : "Disc held" : result.outcome === "loss" ? goal === "extract" ? save.faction === "ussf" ? "Cage lost" : "Cage escaped" : "Wing lost" : "Split disc";
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "mx-auto flex h-dvh max-w-xl flex-col justify-center gap-4 overflow-y-auto px-5 py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-hud text-sm tracking-widest text-solar",
					children: "DEBRIEF"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-hud text-5xl leading-none text-bone",
					children: title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm leading-relaxed text-muted",
					children: [
						ship.name,
						" came back with ",
						result.kills,
						" kills and ",
						result.relays,
						" relays. The hangar logged",
						" ",
						gain,
						" credits. ",
						cargoLine || "No crate in the hold.",
						" ",
						advance
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-hud text-2xl text-solar",
					children: [save.credits, " CR"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "h-12 bg-solar font-hud text-lg tracking-widest text-void",
					onClick: () => {
						setSortie((n) => n + 1);
						start();
					},
					children: "Fly again"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "h-12 border border-bone/30 font-hud text-lg tracking-widest text-bone",
					onClick: () => setPhase("brief"),
					children: "Hangar"
				})
			]
		});
	}
	const held = save.hold ? GOODS.find((good) => good.id === save.hold) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex h-dvh max-w-3xl flex-col px-4 pt-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-hud text-sm tracking-widest text-solar",
						children: "USSF VS THE ACCORD"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-hud text-5xl leading-none text-bone sm:text-6xl",
						children: "WAR FOR MARS"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 max-w-xl text-sm leading-relaxed text-muted",
						children: "The fleet that took Eon Dusk to Mars is gone. He is a prisoner of the Accord. Answer with three sorties, or take the open skirmish."
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MissionButton, {
						label: "Skirmish",
						detail: save.pace === "strike" ? "Six minutes" : "Two minutes",
						active: save.mission === "skirmish",
						locked: false,
						onClick: () => setSave((prev) => ({
							...prev,
							mission: "skirmish"
						}))
					}), SORTIES.map((sortie) => {
						const locked = !sortieUnlocked(sortie.id, save.cleared);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MissionButton, {
							label: sortie.name,
							detail: locked ? "Locked" : sortie.objective.toLowerCase(),
							active: save.mission === sortie.id,
							locked,
							onClick: () => {
								if (locked) return;
								setSave((prev) => ({
									...prev,
									mission: sortie.id
								}));
							}
						}, sortie.id);
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs leading-relaxed text-muted",
					children: active ? active.brief : "Skirmish uses the practice or strike clock. Relays and integrity both count."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "border border-bone/15 px-3 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-hud text-sm tracking-widest text-solar",
						children: "YARD CHANNEL"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 flex flex-col gap-2",
						children: DISPATCHES.filter((note) => save.cleared >= note.need).map((note) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "text-sm leading-snug text-bone/90",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-hud text-xs tracking-widest text-solar",
									children: note.from
								}),
								" ",
								note.text
							]
						}, note.from))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-3 gap-2",
					children: TECHS.map((tech) => {
						const locked = save.cleared < tech.need;
						const on = save.tech === tech.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							disabled: locked,
							onClick: () => setSave((prev) => ({
								...prev,
								tech: prev.tech === tech.id ? null : tech.id
							})),
							className: on ? "h-14 bg-solar px-2 text-left text-void" : "h-14 border border-bone/20 bg-panel px-2 text-left text-bone disabled:opacity-40",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block font-hud text-xs leading-none tracking-widest",
								children: tech.name.toUpperCase()
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: on ? "text-xs text-void/80" : "text-xs text-muted",
								children: locked ? "Locked" : tech.detail
							})]
						}, tech.id);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FactionButton, {
						label: "The Accord",
						detail: "Solar, stealth, the rings",
						active: save.faction === "accord",
						onClick: () => pickFaction("accord")
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FactionButton, {
						label: "USSF",
						detail: "Sensors, wards, the glide",
						active: save.faction === "ussf",
						onClick: () => pickFaction("ussf")
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-1 gap-2 sm:grid-cols-2",
					children: ROSTER[save.faction].map((id) => {
						const def = SHIPS[id];
						const on = save.ship === id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setSave((prev) => ({
								...prev,
								ship: id
							})),
							className: on ? "border border-solar bg-panel px-3 py-2 text-left" : "border border-bone/15 bg-void px-3 py-2 text-left",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-baseline justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-hud text-xl leading-none text-bone",
										children: def.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-hud text-sm tracking-widest text-solar",
										children: def.ultShort
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "mt-1 block text-xs text-muted",
									children: [
										def.role,
										" · HND ",
										def.handling.toFixed(2),
										" · SPD ",
										def.maxSpeed,
										" · SHD ",
										Math.round(def.shield * bonus)
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-1 block line-clamp-2 text-sm leading-snug text-bone/90",
									children: def.blurb
								})
							]
						}, id);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: save.scheme === "arc" ? "h-11 bg-solar px-4 font-hud tracking-widest text-void" : "h-11 border border-bone/25 px-4 font-hud tracking-widest text-bone",
							onClick: () => setSave((prev) => ({
								...prev,
								scheme: "arc"
							})),
							children: "ARC"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: save.scheme === "strafe" ? "h-11 bg-solar px-4 font-hud tracking-widest text-void" : "h-11 border border-bone/25 px-4 font-hud tracking-widest text-bone",
							onClick: () => setSave((prev) => ({
								...prev,
								scheme: "strafe"
							})),
							children: "STRAFE"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs text-muted",
							children: [save.scheme === "arc" ? "Left stick and A/D turn the nose. Right stick aims." : "Left stick slides. Right stick turns the nose.", save.gyro ? " Tilt rolls the nose." : ""]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: save.pace === "practice" ? "h-11 bg-solar px-4 font-hud tracking-widest text-void" : "h-11 border border-bone/25 px-4 font-hud tracking-widest text-bone",
							onClick: () => setSave((prev) => ({
								...prev,
								pace: "practice"
							})),
							children: "PRACTICE 2:00"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: save.pace === "strike" ? "h-11 bg-solar px-4 font-hud tracking-widest text-void" : "h-11 border border-bone/25 px-4 font-hud tracking-widest text-bone",
							onClick: () => setSave((prev) => ({
								...prev,
								pace: "strike"
							})),
							children: "STRIKE 6:00"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: save.gyro ? "h-11 bg-solar px-4 font-hud tracking-widest text-void" : "h-11 border border-bone/25 px-4 font-hud tracking-widest text-bone",
							onClick: () => {
								if (save.gyro) {
									setSave((prev) => ({
										...prev,
										gyro: false
									}));
									return;
								}
								armGyro().then((ok) => {
									setSave((prev) => ({
										...prev,
										gyro: ok
									}));
								});
							},
							children: save.gyro ? "GYRO ON" : "GYRO"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "border border-bone/15 bg-panel px-3 py-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-baseline justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-hud text-sm tracking-widest text-solar",
								children: "PHOBOS YARD"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted",
								children: "One crate. Prices move after each strike."
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 grid grid-cols-2 gap-2",
							children: GOODS.map((good) => {
								const price = save.prices[good.id];
								const mine = save.hold === good.id;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									disabled: !mine && (save.hold != null || save.credits < price),
									onClick: () => buy(good.id),
									className: mine ? "border border-solar px-2 py-2 text-left" : "border border-bone/15 px-2 py-2 text-left disabled:opacity-40",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "flex items-baseline justify-between gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-hud text-sm text-bone",
											children: good.name
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-hud text-sm text-solar",
											children: price
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "mt-1 block text-xs text-muted",
										children: mine ? "In the hold" : `Win pays ${winBid(price)}`
									})]
								}, good.id);
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-xs leading-relaxed text-muted",
							children: held ? `${held.name} is aboard. A held disc pays ${winBid(save.prices[held.id])}. A loss scraps it for ${scrapValue(save.paid)}. The dock will take it now for ${dockValue(save.paid)}.` : "Buy a crate before you launch. Come back with the disc and the yard pays above the board."
						}),
						held ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "mt-2 h-10 border border-bone/25 px-3 font-hud text-sm tracking-widest text-bone",
							onClick: sellDock,
							children: ["Sell to the dock · ", dockValue(save.paid)]
						}) : null
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex shrink-0 flex-col gap-2 border-t border-bone/15 bg-void py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-hud text-xl text-solar",
					children: [save.credits, " CR"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: save.refit >= 5 || save.credits < cost,
					className: "h-11 border border-solar px-3 font-hud tracking-widest text-solar disabled:border-bone/20 disabled:text-muted",
					onClick: () => setSave((prev) => applyRefit(prev)),
					children: save.refit >= 5 ? "REFIT MAX" : `REFIT +6% · ${cost}`
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "h-14 bg-solar font-hud text-2xl tracking-widest text-void",
				onClick: () => {
					setSortie((n) => n + 1);
					start();
				},
				children: "Start"
			})]
		})]
	});
}
function MissionButton({ label, detail, active, locked, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		disabled: locked,
		onClick,
		className: active ? "h-14 bg-solar px-2 text-left text-void" : "h-14 border border-bone/20 bg-panel px-2 text-left text-bone disabled:opacity-40",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block font-hud text-sm leading-none tracking-widest",
			children: label.toUpperCase()
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: active ? "text-xs text-void/80" : "text-xs text-muted",
			children: detail
		})]
	});
}
function FactionButton({ label, detail, active, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		className: active ? "h-16 bg-solar px-3 text-left text-void" : "h-16 border border-bone/20 bg-panel px-3 text-left text-bone",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block font-hud text-xl leading-none",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: active ? "text-xs text-void/80" : "text-xs text-muted",
			children: detail
		})]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WarApp, {});
}
//#endregion
export { Home as component };
