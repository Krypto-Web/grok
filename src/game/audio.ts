export type Sfx = "collect" | "near" | "hit" | "shield" | "die" | "boost";

export type AudioBus = {
  unlock: () => void;
  play: (sfx: Sfx, combo?: number) => void;
  setMuted: (muted: boolean) => void;
  resume: () => void;
  close: () => void;
  muted: boolean;
};

export function createAudio(): AudioBus {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let music: GainNode | null = null;
  let sfx: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctx = new Ctx({ latencyHint: "interactive" });
      master = ctx.createGain();
      music = ctx.createGain();
      sfx = ctx.createGain();
      music.gain.value = 1;
      sfx.gain.value = 1;
      master.gain.value = muted ? 0.0001 : 0.9;
      music.connect(master);
      sfx.connect(master);
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.4);
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      drone(ctx, music);
    }
    if (ctx.state === "suspended") void ctx.resume();
  }

  function play(name: Sfx, combo = 1) {
    if (!ctx || !sfx || muted) return;
    const t = ctx.currentTime;
    if (name === "collect") tone(720 + combo * 36, 980 + combo * 40, 0.12, 0.07, "sine", t);
    else if (name === "near") tone(480, 720, 0.1, 0.045, "triangle", t);
    else if (name === "boost") noiseBurst(880, 0.7, 0.09, 0.05, t);
    else if (name === "shield") {
      tone(660, 990, 0.18, 0.06, "sine", t);
      tone(990, 1320, 0.2, 0.04, "triangle", t + 0.04);
    } else if (name === "hit") {
      tone(180, 70, 0.18, 0.08, "sine", t);
      noiseBurst(240, 0.6, 0.16, 0.12, t);
    } else if (name === "die") {
      tone(140, 48, 0.4, 0.1, "sine", t);
      noiseBurst(160, 0.5, 0.32, 0.2, t);
    }
  }

  function tone(
    f0: number,
    f1: number,
    dur: number,
    peak: number,
    type: OscillatorType,
    when: number,
  ) {
    if (!ctx || !sfx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(sfx);
    osc.start(when);
    osc.stop(when + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  function noiseBurst(freq: number, q: number, dur: number, peak: number, when: number) {
    if (!ctx || !sfx || !noise) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq, when);
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(sfx);
    src.start(when);
    src.stop(when + dur);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  return {
    get muted() {
      return muted;
    },
    unlock: ensure,
    play,
    setMuted(next: boolean) {
      muted = next;
      if (!ctx || !master) return;
      master.gain.setTargetAtTime(next ? 0.0001 : 0.9, ctx.currentTime, 0.03);
    },
    resume() {
      if (ctx && ctx.state === "suspended") void ctx.resume();
    },
    close() {
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
}

function drone(ctx: AudioContext, bus: GainNode) {
  const a = ctx.createOscillator();
  const b = ctx.createOscillator();
  const g = ctx.createGain();
  a.type = "sine";
  b.type = "triangle";
  a.frequency.value = 146.83;
  b.frequency.value = 220;
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.setTargetAtTime(0.035, ctx.currentTime, 0.6);
  a.connect(g);
  b.connect(g);
  g.connect(bus);
  a.start();
  b.start();
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
