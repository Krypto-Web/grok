import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Pause,
  Play,
  Shield,
  Volume2,
  VolumeX,
} from "lucide-react";
import { loadArt } from "@/game/assets";
import { createAudio } from "@/game/audio";
import { draw } from "@/game/render";
import { loadBest, loadMuted, saveBest, saveMuted } from "@/game/save";
import {
  beginRun,
  createGame,
  tick,
  VIEW_H,
  VIEW_W,
  type Game,
  type Input,
  type KeyState,
  type Phase,
} from "@/game/sim";

type Card = { score: number; dew: number; near: number; best: number; fresh: boolean };

const EMPTY_KEYS: KeyState = { left: false, right: false, up: false, down: false };

function codesToKeys(codes: string[]): KeyState {
  return {
    left: codes.includes("KeyA") || codes.includes("ArrowLeft"),
    right: codes.includes("KeyD") || codes.includes("ArrowRight"),
    up: codes.includes("KeyW") || codes.includes("ArrowUp") || codes.includes("Space"),
    down: codes.includes("KeyS") || codes.includes("ArrowDown"),
  };
}

export function VesperStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const stateRef = useRef<Game | null>(null);
  const inputRef = useRef<Input | null>(null);
  const apiRef = useRef({
    start: () => {},
    pause: () => {},
    setKey: (_key: keyof KeyState, _down: boolean) => {},
    toggleMute: () => {},
  });
  const scoreRef = useRef<HTMLParagraphElement>(null);
  const comboRef = useRef<HTMLParagraphElement>(null);
  const charmRef = useRef<HTMLParagraphElement>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = createGame(reduced);
    const input: Input = { keys: { ...EMPTY_KEYS }, override: null, pointer: null };
    const audio = createAudio();
    const art = loadArt();
    stateRef.current = state;
    inputRef.current = input;
    const savedBest = loadBest();
    const savedMuted = loadMuted();
    audio.setMuted(savedMuted);
    setBest(savedBest);
    setMuted(savedMuted);

    let shown: Phase = "ready";
    let acc = 0;
    let last = performance.now();
    let raf = 0;
    let hintTimer = 0;

    function fit() {
      const stage = stageRef.current;
      const frame = frameRef.current;
      const canvas = canvasRef.current;
      if (!stage || !frame || !canvas) return;
      const availW = stage.clientWidth;
      const availH = stage.clientHeight;
      if (availW < 2 || availH < 2) return;
      const scale = Math.min(availW / VIEW_W, availH / VIEW_H);
      const cssW = Math.max(1, Math.floor(VIEW_W * scale));
      const cssH = Math.max(1, Math.floor(VIEW_H * scale));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      frame.style.width = `${cssW}px`;
      frame.style.height = `${cssH}px`;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform((cssW * dpr) / VIEW_W, 0, 0, (cssH * dpr) / VIEW_H, 0, 0);
      ctxRef.current = ctx;
    }

    function publish(next: Phase) {
      shown = next;
      setPhase(next);
    }

    function finish() {
      const prev = loadBest();
      const fresh = state.score > prev && state.score > 0;
      const nextBest = Math.max(prev, state.score);
      saveBest(nextBest);
      setBest(nextBest);
      setCard({
        score: state.score,
        dew: state.dew,
        near: state.near,
        best: nextBest,
        fresh,
      });
      setHint(false);
    }

    function start() {
      audio.unlock();
      beginRun(state);
      input.pointer = null;
      publish("playing");
      if (loadBest() === 0) {
        setHint(true);
        window.clearTimeout(hintTimer);
        hintTimer = window.setTimeout(() => setHint(false), 3200);
      }
    }

    function pause() {
      if (state.phase === "playing") {
        input.pointer = null;
        state.phase = "paused";
        publish("paused");
      } else if (state.phase === "paused") {
        audio.unlock();
        state.phase = "playing";
        publish("playing");
      }
    }

    apiRef.current.start = start;
    apiRef.current.pause = pause;
    apiRef.current.setKey = (key, down) => {
      input.keys[key] = down;
    };
    apiRef.current.toggleMute = () => {
      audio.unlock();
      const next = !audio.muted;
      audio.setMuted(next);
      saveMuted(next);
      setMuted(next);
    };

    function hardware(code: string, down: boolean) {
      if (code === "KeyA" || code === "ArrowLeft") input.keys.left = down;
      else if (code === "KeyD" || code === "ArrowRight") input.keys.right = down;
      else if (code === "KeyW" || code === "ArrowUp" || code === "Space") input.keys.up = down;
      else if (code === "KeyS" || code === "ArrowDown") input.keys.down = down;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      if (e.repeat) return;
      if (e.code === "KeyP" || e.code === "Escape") {
        pause();
        return;
      }
      if ((state.phase === "ready" || state.phase === "over") && (e.code === "Enter" || e.code === "Space")) {
        start();
      }
      hardware(e.code, true);
    }

    function onKeyUp(e: KeyboardEvent) {
      hardware(e.code, false);
    }

    function onBlur() {
      input.keys = { ...EMPTY_KEYS };
      input.pointer = null;
    }

    function onHide() {
      if (document.hidden && state.phase === "playing") pause();
      else audio.resume();
    }

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      let steps = 0;
      while (acc >= 1 / 60 && steps < 5) {
        tick(state, 1 / 60, input);
        acc -= 1 / 60;
        steps += 1;
      }
      if (steps === 5) acc = 0;
      for (const ev of state.events) audio.play(ev, state.combo);
      state.events.length = 0;
      const ctx = ctxRef.current;
      if (ctx) draw(ctx, state, art, now / 1000);
      if (scoreRef.current) scoreRef.current.textContent = state.score.toLocaleString();
      if (comboRef.current) {
        const show = state.combo >= 2 && (state.phase === "playing" || state.phase === "paused");
        comboRef.current.hidden = !show;
        comboRef.current.textContent = `×${state.combo}`;
      }
      if (charmRef.current) charmRef.current.hidden = !state.shield;
      if (state.phase !== shown) {
        const next = state.phase;
        if (next === "over") finish();
        publish(next);
      }
      raf = requestAnimationFrame(frame);
    }

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onHide);
    const stage = stageRef.current;
    const ro = new ResizeObserver(() => fit());
    if (stage) ro.observe(stage);
    fit();
    raf = requestAnimationFrame(frame);

    window.__controlsTest = {
      getX: () => state.playerX,
      getY: () => state.playerY,
      getYaw: () => 0,
      getSpeed: () => (state.phase === "playing" && state.hitStop <= 0 ? state.speed : 0),
      setKeys: (codes) => {
        input.override = codes.length ? codesToKeys(codes) : null;
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hintTimer);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onHide);
      audio.close();
      if (window.__controlsTest) window.__controlsTest = undefined;
    };
  }, []);

  function viewPoint(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * VIEW_W,
      y: ((e.clientY - rect.top) / rect.height) * VIEW_H,
    };
  }

  return (
    <main className="flex h-dvh w-full select-none flex-col bg-deep text-fg">
      <h1 className="sr-only">Vesper</h1>
      <div ref={stageRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div ref={frameRef} className="relative overflow-hidden">
          <canvas
            ref={canvasRef}
            className="block touch-none"
            onPointerDown={(e) => {
              const state = stateRef.current;
              const input = inputRef.current;
              if (!state || !input || state.phase !== "playing") return;
              e.currentTarget.setPointerCapture(e.pointerId);
              input.pointer = viewPoint(e);
            }}
            onPointerMove={(e) => {
              const input = inputRef.current;
              if (!input?.pointer) return;
              input.pointer = viewPoint(e);
            }}
            onPointerUp={() => {
              const input = inputRef.current;
              if (input) input.pointer = null;
            }}
            onPointerCancel={() => {
              const input = inputRef.current;
              if (input) input.pointer = null;
            }}
          />
          {(phase === "playing" || phase === "paused") && (
            <div className="vesper-hud pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
              <div>
                <p ref={scoreRef} className="font-display text-4xl leading-none text-gold">
                  0
                </p>
                <p ref={comboRef} hidden className="mt-1 text-sm font-medium text-dew" />
                <p ref={charmRef} hidden className="mt-1 flex items-center gap-1 text-sm text-gold">
                  <Shield className="size-4" aria-hidden="true" />
                  Charmed
                </p>
              </div>
              <div className="pointer-events-auto flex gap-2">
                <IconButton label={muted ? "Unmute" : "Mute"} onClick={() => apiRef.current.toggleMute()}>
                  {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                </IconButton>
                <IconButton label={phase === "paused" ? "Resume" : "Pause"} onClick={() => apiRef.current.pause()}>
                  {phase === "paused" ? <Play className="size-5" /> : <Pause className="size-5" />}
                </IconButton>
              </div>
            </div>
          )}
          {hint && phase === "playing" && (
            <p className="pointer-events-none absolute inset-x-6 top-24 text-center text-sm text-muted">
              Hold or drag to climb
            </p>
          )}
          {phase === "ready" && (
            <div className="absolute inset-x-0 bottom-0 p-4">
              <section className="vesper-card rounded-lg p-5">
                <p className="vesper-kicker text-xs font-medium text-gold">Midnight garden</p>
                <p className="mt-2 font-display text-5xl leading-none text-fg">Vesper</p>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Steer a moon moth through the wisteria. Sip the dew, skim the dark, and don’t touch it.
                </p>
                <p className="mt-3 text-sm text-fg">Arrows or WASD. Drag to fly. A charm absorbs one hit.</p>
                {best > 0 && <p className="mt-2 text-sm text-muted">Best {best.toLocaleString()}</p>}
                <button
                  type="button"
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-gold font-display text-lg text-deep"
                  onClick={() => apiRef.current.start()}
                >
                  <Play className="size-5" aria-hidden="true" />
                  Start
                </button>
              </section>
            </div>
          )}
          {phase === "paused" && (
            <div className="absolute inset-0 grid place-items-center bg-deep/40 p-4">
              <section className="vesper-card w-full rounded-lg p-5 text-center">
                <p className="font-display text-4xl text-fg">Paused</p>
                <button
                  type="button"
                  className="mt-5 h-12 w-full rounded-lg bg-gold font-display text-lg text-deep"
                  onClick={() => apiRef.current.pause()}
                >
                  Resume
                </button>
              </section>
            </div>
          )}
          {phase === "over" && card && (
            <div className="absolute inset-x-0 bottom-0 p-4">
              <section className="vesper-card rounded-lg p-5" aria-live="polite">
                <p className="vesper-kicker text-xs font-medium text-gold">The garden keeps you</p>
                <h2 className="mt-2 font-display text-4xl leading-none text-fg">Folded wings</h2>
                <p className="mt-3 font-display text-5xl leading-none text-gold">{card.score.toLocaleString()}</p>
                <p className="mt-2 text-sm text-muted">
                  {card.dew} dew · {card.near} close {card.near === 1 ? "call" : "calls"}
                </p>
                <p className="mt-1 text-sm text-fg">{card.fresh ? "New best" : `Best ${card.best.toLocaleString()}`}</p>
                <button
                  type="button"
                  className="mt-5 h-12 w-full rounded-lg bg-gold font-display text-lg text-deep"
                  onClick={() => apiRef.current.start()}
                >
                  Fly again
                </button>
              </section>
            </div>
          )}
        </div>
      </div>
      <div className="vesper-pad">
        <PadButton label="Left" onKey="left" apiRef={apiRef}>
          <ChevronLeft className="size-6" />
        </PadButton>
        <PadButton label="Dive" onKey="down" apiRef={apiRef}>
          <ChevronDown className="size-6" />
        </PadButton>
        <PadButton label="Rise" onKey="up" apiRef={apiRef}>
          <ChevronUp className="size-6" />
        </PadButton>
        <PadButton label="Right" onKey="right" apiRef={apiRef}>
          <ChevronRight className="size-6" />
        </PadButton>
      </div>
    </main>
  );
}

function PadButton({
  label,
  onKey,
  apiRef,
  children,
}: {
  label: string;
  onKey: keyof KeyState;
  apiRef: RefObject<{ setKey: (key: keyof KeyState, down: boolean) => void }>;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="vesper-key"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        apiRef.current.setKey(onKey, true);
      }}
      onPointerUp={() => apiRef.current.setKey(onKey, false)}
      onPointerCancel={() => apiRef.current.setKey(onKey, false)}
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-11 place-items-center rounded-full border border-line bg-deep/70 text-gold"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

declare global {
  interface Window {
    __controlsTest?: {
      getX: () => number;
      getY: () => number;
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
    };
  }
}
