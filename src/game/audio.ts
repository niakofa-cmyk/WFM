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

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function sfxShot(big: boolean) {
  tone(big ? 140 : 520, big ? 0.18 : 0.06, big ? "sawtooth" : "square", big ? 0.08 : 0.035, big ? -80 : -220);
}

export function sfxHit() {
  tone(180, 0.07, "triangle", 0.04, -100);
}

export function sfxBoom() {
  tone(90, 0.28, "sawtooth", 0.09, -60);
}

export function sfxUlt() {
  tone(240, 0.22, "square", 0.05, 180);
}
