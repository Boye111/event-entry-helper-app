"use client";

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, duration: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.02);
}

/** Must be called from a user gesture once (e.g. login/tap) so mobile browsers allow audio. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* audio not available */
  }
}

export function feedback(kind: "ok" | "used" | "invalid" | "error") {
  try {
    unlockAudio();
    if (kind === "ok") {
      tone(1046, 0, 0.18);
      navigator.vibrate?.(150);
    } else {
      tone(220, 0, 0.22);
      tone(220, 0.3, 0.35);
      navigator.vibrate?.([120, 80, 120, 80, 400]);
    }
  } catch {
    /* ignore */
  }
}
