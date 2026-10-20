let muted = false;
let ctx: AudioContext | null = null;

export function setMuted(next: boolean) {
  muted = next;
}

export function isMuted() {
  return muted;
}

export function unlockAudio() {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0, variance = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const jitter = variance ? 1 + (Math.random() * 2 - 1) * variance : 1;
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(40, freq * jitter), t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * jitter + slide), t + dur);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function sfxShot(big: boolean) {
  tone(big ? 140 : 520, big ? 0.18 : 0.06, big ? "sawtooth" : "square", big ? 0.08 : 0.035, big ? -80 : -220, 0.08);
}

export function sfxHit() {
  tone(180, 0.07, "triangle", 0.04, -100);
}

export function sfxBoom() {
  tone(90, 0.28, "sawtooth", 0.09, -60);
  tone(46, 0.4, "triangle", 0.05, -18);
}

export function sfxFlare() {
  tone(68, 0.34, "sawtooth", 0.07, 36);
}

export function sfxDive() {
  tone(170, 0.22, "sawtooth", 0.06, 280);
}

export function sfxCloak() {
  tone(720, 0.32, "sine", 0.04, -480);
}

export function sfxEmp() {
  tone(210, 0.26, "square", 0.045, -120);
}

export function sfxMark() {
  tone(660, 0.07, "square", 0.03, 0);
  tone(990, 0.09, "square", 0.028, 40);
}

export function sfxGuard() {
  tone(460, 0.18, "triangle", 0.05, 140);
}

export function sfxJam() {
  tone(78, 0.16, "square", 0.04, 24);
  tone(140, 0.1, "square", 0.03, -40);
}

export function sfxRam() {
  tone(130, 0.18, "sawtooth", 0.07, -70);
}

export function sfxPaint() {
  tone(880, 0.05, "square", 0.03, 40);
}

export function sfxUi() {
  tone(420, 0.04, "square", 0.02, -80);
}

let engine: { osc: OscillatorNode; amp: GainNode } | null = null;

export function engineGain(amount: number) {
  if (!ctx) return;
  const level = Math.max(0, Math.min(1, amount));
  if (!engine) {
    if (muted || level <= 0.02) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "triangle";
    osc.frequency.value = 46;
    filter.type = "lowpass";
    filter.frequency.value = 280;
    amp.gain.value = 0.0001;
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);
    osc.start();
    engine = { osc, amp };
  }
  const now = ctx.currentTime;
  const target = muted || level <= 0.02 ? 0.0001 : 0.01 + level * 0.018;
  engine.amp.gain.setTargetAtTime(target, now, 0.07);
  engine.osc.frequency.setTargetAtTime(44 + level * 64, now, 0.08);
}
