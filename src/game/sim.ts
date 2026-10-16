export const VIEW_W = 420;
export const VIEW_H = 760;

export type Phase = "ready" | "playing" | "paused" | "over";
export type HazardKind = "blossom" | "bramble" | "lantern";
export type GameEvent = "collect" | "near" | "hit" | "shield" | "die" | "boost";

export type KeyState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
};

export type Input = {
  keys: KeyState;
  override: KeyState | null;
  pointer: { x: number; y: number } | null;
};

type Obstacle = {
  active: boolean;
  kind: HazardKind;
  x: number;
  y: number;
  w: number;
  h: number;
  passed: boolean;
};

type Pickup = {
  active: boolean;
  kind: "dew" | "charm";
  x: number;
  y: number;
  r: number;
};

type Particle = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: "gold" | "dew";
  size: number;
};

type Floater = {
  active: boolean;
  x: number;
  y: number;
  life: number;
  text: string;
  dew: boolean;
};

export type Game = {
  phase: Phase;
  scroll: number;
  travel: number;
  speed: number;
  time: number;
  score: number;
  bonus: number;
  dew: number;
  near: number;
  combo: number;
  comboT: number;
  shield: boolean;
  invuln: number;
  shake: number;
  flash: number;
  hitStop: number;
  pendingOver: boolean;
  overT: number;
  reduced: boolean;
  playerX: number;
  playerY: number;
  vx: number;
  vy: number;
  climbing: boolean;
  boostCd: number;
  seed: number;
  spawnX: number;
  patternIndex: number;
  dustT: number;
  flyT: number;
  events: GameEvent[];
  obstacles: Obstacle[];
  pickups: Pickup[];
  particles: Particle[];
  texts: Floater[];
  partCursor: number;
};

const PLAYER_R = 18;
const X_MIN = 58;
const X_MAX = 196;
const Y_MIN = 64;
const Y_MAX = VIEW_H - 86;

export function createGame(reduced = false): Game {
  const obstacles: Obstacle[] = [];
  for (let i = 0; i < 24; i++) obstacles.push(blankObstacle());
  const pickups: Pickup[] = [];
  for (let i = 0; i < 40; i++) pickups.push(blankPickup());
  const particles: Particle[] = [];
  for (let i = 0; i < 96; i++) particles.push(blankParticle());
  const texts: Floater[] = [];
  for (let i = 0; i < 12; i++) texts.push(blankText());
  return {
    phase: "ready",
    scroll: 0,
    travel: 0,
    speed: 0,
    time: 0,
    score: 0,
    bonus: 0,
    dew: 0,
    near: 0,
    combo: 0,
    comboT: 0,
    shield: false,
    invuln: 0,
    shake: 0,
    flash: 0,
    hitStop: 0,
    pendingOver: false,
    overT: 0,
    reduced,
    playerX: 140,
    playerY: VIEW_H * 0.4,
    vx: 0,
    vy: 0,
    climbing: false,
    boostCd: 0,
    seed: 0xdecaf,
    spawnX: 0,
    patternIndex: 0,
    dustT: 0,
    flyT: 0,
    events: [],
    obstacles,
    pickups,
    particles,
    texts,
    partCursor: 0,
  };
}

export function beginRun(state: Game) {
  state.phase = "playing";
  state.travel = 0;
  state.bonus = 0;
  state.score = 0;
  state.dew = 0;
  state.near = 0;
  state.combo = 0;
  state.comboT = 0;
  state.shield = false;
  state.invuln = 1.1;
  state.shake = 0;
  state.flash = 0;
  state.hitStop = 0;
  state.pendingOver = false;
  state.overT = 0;
  state.playerX = 132;
  state.playerY = VIEW_H * 0.46;
  state.vx = 0;
  state.vy = 0;
  state.climbing = false;
  state.boostCd = 0;
  state.seed = (Math.floor(performance.now() * 1000) ^ 0x9e3779b9) >>> 0;
  state.spawnX = state.scroll + VIEW_W + 460;
  state.patternIndex = 0;
  state.dustT = 0;
  state.events.length = 0;
  for (const o of state.obstacles) o.active = false;
  for (const p of state.pickups) p.active = false;
  for (const p of state.particles) p.active = false;
  for (const t of state.texts) t.active = false;
}

export function tick(state: Game, dt: number, input: Input) {
  state.time += dt;
  if (state.phase === "ready") {
    state.scroll += 26 * dt;
    state.playerX = 148;
    state.playerY = VIEW_H * 0.4 + Math.sin(state.time * 1.25) * 14;
    state.vy = Math.cos(state.time * 1.25) * 18;
    sprinkle(state, dt);
    decayJuice(state, dt);
    return;
  }
  if (state.phase === "paused") return;
  if (state.phase === "over") {
    state.overT += dt;
    if (state.overT < 0.9) decayJuice(state, dt);
    return;
  }
  if (state.hitStop > 0) {
    state.hitStop -= dt;
    decayJuice(state, dt);
    if (state.hitStop <= 0 && state.pendingOver) {
      state.phase = "over";
      state.pendingOver = false;
      state.overT = 0;
    }
    return;
  }

  const steer = steerOf(state, input);
  const acc = 2400;
  state.vx += steer.ax * acc * dt;
  state.vy += steer.ay * acc * dt;
  const damp = Math.exp(-5.1 * dt);
  state.vx *= damp;
  state.vy *= damp;
  state.vx = clamp(state.vx, -300, 300);
  state.vy = clamp(state.vy, -440, 460);
  const prevX = state.playerX;
  state.playerX += state.vx * dt;
  state.playerY += state.vy * dt;
  if (state.playerX < X_MIN) {
    state.playerX = X_MIN;
    state.vx = Math.max(0, state.vx);
  } else if (state.playerX > X_MAX) {
    state.playerX = X_MAX;
    state.vx = Math.min(0, state.vx);
  }
  if (state.playerY < Y_MIN) {
    state.playerY = Y_MIN;
    state.vy = Math.max(0, state.vy);
  } else if (state.playerY > Y_MAX) {
    state.playerY = Y_MAX;
    state.vy = Math.min(0, state.vy);
  }

  const climbing = steer.ay < -0.45;
  state.boostCd = Math.max(0, state.boostCd - dt);
  if (climbing && !state.climbing && state.boostCd <= 0) {
    state.events.push("boost");
    state.boostCd = 0.22;
  }
  state.climbing = climbing;

  state.speed = Math.min(336, 146 + state.travel * 0.0105);
  const ds = state.speed * dt;
  const prevScroll = state.scroll;
  state.scroll += ds;
  state.travel += ds;
  if (state.invuln > 0) state.invuln -= dt;
  if (state.comboT > 0) {
    state.comboT -= dt;
    if (state.comboT <= 0) state.combo = 0;
  }

  for (const o of state.obstacles) {
    if (!o.active) continue;
    if (o.x - state.scroll + o.w < -80) o.active = false;
  }
  for (const p of state.pickups) {
    if (!p.active) continue;
    if (p.x - state.scroll < -40) p.active = false;
  }

  for (const p of state.pickups) {
    if (!p.active) continue;
    const sx = p.x - state.scroll;
    const rr = PLAYER_R + p.r;
    const dx = state.playerX - sx;
    const dy = state.playerY - p.y;
    if (dx * dx + dy * dy <= rr * rr) {
      p.active = false;
      if (p.kind === "charm") {
        state.shield = true;
        state.bonus += 40;
        state.events.push("shield");
        burst(state, p.x, p.y, 12, "gold");
        floater(state, sx, p.y, "Charm", false);
      } else {
        state.dew += 1;
        state.combo = state.comboT > 0 ? state.combo + 1 : 1;
        state.comboT = 2.35;
        const pts = 10 * state.combo;
        state.bonus += pts;
        state.events.push("collect");
        burst(state, p.x, p.y, 8, "dew");
        floater(state, sx, p.y, `+${pts}`, true);
      }
    }
  }

  if (state.invuln <= 0) {
    for (const o of state.obstacles) {
      if (!o.active || state.pendingOver) continue;
      if (circleHits(state.playerX, state.playerY, o, state.scroll)) {
        o.passed = true;
        if (state.shield) {
          state.shield = false;
          state.invuln = 0.95;
          state.hitStop = 0.05;
          state.shake = state.reduced ? 0 : 7;
          state.flash = 0.45;
          state.bonus += 20;
          state.events.push("hit");
          burst(state, state.scroll + state.playerX, state.playerY, 14, "gold");
        } else {
          state.pendingOver = true;
          state.hitStop = 0.09;
          state.shake = state.reduced ? 0 : 16;
          state.flash = 0.85;
          state.vx = 0;
          state.vy = 0;
          state.events.push("die");
          burst(state, state.scroll + state.playerX, state.playerY, 22, "gold");
        }
        break;
      }
    }
  }

  if (!state.pendingOver) {
    for (const o of state.obstacles) {
      if (!o.active || o.passed) continue;
      const prev = rectOf(o, prevScroll);
      const now = rectOf(o, state.scroll);
      if (prev.x + prev.w >= prevX && now.x + now.w < state.playerX) {
        o.passed = true;
        const d = gapDist(state.playerX, state.playerY, o, state.scroll);
        if (d > 0 && d < 46) {
          state.near += 1;
          state.combo = state.comboT > 0 ? state.combo + 1 : 1;
          state.comboT = 2.35;
          state.bonus += 25;
          state.shake = Math.max(state.shake, state.reduced ? 0 : 3.5);
          state.events.push("near");
          floater(state, state.playerX + 28, state.playerY - 18, "Close", false);
        }
      }
    }
    spawnWave(state);
  }

  state.score = Math.floor(state.travel / 16) + state.bonus;
  state.dustT -= dt;
  if (state.dustT <= 0) {
    state.dustT = 0.045;
    const p = takeParticle(state);
    p.x = state.scroll + state.playerX - 8;
    p.y = state.playerY + (nextRand(state) - 0.5) * 18;
    p.vx = -30 - nextRand(state) * 40;
    p.vy = (nextRand(state) - 0.5) * 30;
    p.life = 0.35 + nextRand(state) * 0.2;
    p.max = p.life;
    p.kind = "gold";
    p.size = 2 + nextRand(state) * 2;
    p.active = true;
  }
  sprinkle(state, dt);
  decayJuice(state, dt);
}

function steerOf(state: Game, input: Input): { ax: number; ay: number } {
  if (input.override) return fromKeys(input.override);
  if (input.pointer) {
    const dx = input.pointer.x - state.playerX;
    const dy = input.pointer.y - state.playerY;
    if (Math.hypot(dx, dy) < 16) return { ax: 0, ay: 0 };
    return { ax: clamp(dx / 72, -1, 1), ay: clamp(dy / 72, -1, 1) };
  }
  return fromKeys(input.keys);
}

function fromKeys(k: KeyState): { ax: number; ay: number } {
  let ax = 0;
  let ay = 0;
  if (k.left) ax -= 1;
  if (k.right) ax += 1;
  if (k.up) ay -= 1;
  if (k.down) ay += 1;
  if (ax !== 0 || ay !== 0) {
    const m = Math.hypot(ax, ay);
    if (m > 1) {
      ax /= m;
      ay /= m;
    }
    return { ax, ay };
  }
  return { ax: 0, ay: 0.14 };
}

function spawnWave(state: Game) {
  const horizon = state.scroll + VIEW_W + 40;
  let guard = 0;
  while (state.spawnX < horizon && guard++ < 4) {
    const reaction = Math.max(0.95, 1.32 - state.travel / 18000);
    const spacing = Math.max(360, state.speed * reaction);
    placePattern(state, state.spawnX);
    state.spawnX += spacing;
  }
}

function placePattern(state: Game, x: number) {
  const gap = Math.max(168, 206 - state.travel * 0.0016);
  state.patternIndex += 1;
  if (state.patternIndex <= 2) {
    const h = 210 + nextRand(state) * 70;
    obstacle(state, "blossom", x, 0, 124, h);
    const y0 = h + 70;
    placeDew(state, x + 36, y0);
    placeDew(state, x + 36, y0 + 52);
    placeDew(state, x + 78, y0 + 26);
    return;
  }
  const roll = nextRand(state);
  const gate = state.travel > 1100 && roll > 0.84;
  if (gate) {
    let top = 150 + nextRand(state) * 190;
    let bot = 140 + nextRand(state) * 180;
    const maxSum = VIEW_H - gap;
    if (top + bot > maxSum) {
      const s = maxSum / (top + bot);
      top *= s;
      bot *= s;
    }
    obstacle(state, "blossom", x, 0, 118, top);
    obstacle(state, "bramble", x + 18, 0, 118, bot);
    const openTop = top + 36;
    const openBot = VIEW_H - bot - 36;
    placeDew(state, x + 46, (openTop + openBot) / 2);
    if (nextRand(state) < 0.55) placeDew(state, x + 78, openTop + 20);
    return;
  }
  if (roll > 0.58) {
    const margin = 156;
    const y = margin + nextRand(state) * (VIEW_H - margin * 2);
    obstacle(state, "lantern", x, y, 108, 108);
    const below = y < VIEW_H * 0.5;
    placeDew(state, x + 24, y + (below ? 96 : -96));
    placeDew(state, x + 70, y + (below ? 132 : -132));
    if (nextRand(state) < 0.22) placeCharm(state, x + 8, y + (below ? 168 : -168));
    return;
  }
  if (roll > 0.29) {
    const maxH = VIEW_H - gap - 80;
    const h = Math.min(maxH, 170 + nextRand(state) * Math.max(40, maxH - 170));
    obstacle(state, "bramble", x, 0, 124, h);
    const y1 = VIEW_H - h - 86;
    placeDew(state, x + 40, y1 - 10);
    placeDew(state, x + 40, y1 - 58);
    placeDew(state, x + 78, y1 - 34);
    if (nextRand(state) < 0.18) placeCharm(state, x + 20, y1 - 110);
    return;
  }
  const maxH = VIEW_H - gap - 80;
  const h = Math.min(maxH, 170 + nextRand(state) * Math.max(40, maxH - 170));
  obstacle(state, "blossom", x, 0, 124, h);
  const y0 = h + 52;
  placeDew(state, x + 40, y0);
  placeDew(state, x + 40, y0 + 48);
  placeDew(state, x + 78, y0 + 24);
  if (nextRand(state) < 0.18) placeCharm(state, x + 16, y0 + 96);
}

function obstacle(state: Game, kind: HazardKind, x: number, y: number, w: number, h: number) {
  const o = take(state.obstacles, blankObstacle);
  o.kind = kind;
  o.x = x;
  o.y = y;
  o.w = w;
  o.h = h;
  o.passed = false;
  o.active = true;
}

function placeDew(state: Game, x: number, y: number) {
  if (y < 56 || y > VIEW_H - 56) return;
  const p = take(state.pickups, blankPickup);
  p.kind = "dew";
  p.x = x;
  p.y = y;
  p.r = 16;
  p.active = true;
}

function placeCharm(state: Game, x: number, y: number) {
  if (y < 70 || y > VIEW_H - 70) return;
  const p = take(state.pickups, blankPickup);
  p.kind = "charm";
  p.x = x;
  p.y = y;
  p.r = 18;
  p.active = true;
}

type Rect = { x: number; y: number; w: number; h: number };

function rectOf(o: Obstacle, scroll: number): Rect {
  const x = o.x - scroll;
  if (o.kind === "lantern") return { x: x + o.w / 2 - 32, y: o.y - 32, w: 64, h: 64 };
  if (o.kind === "blossom") return { x: x + 22, y: -16, w: o.w - 44, h: o.h + 28 };
  return { x: x + 22, y: VIEW_H - o.h - 20, w: o.w - 44, h: o.h + 44 };
}

function circleHits(px: number, py: number, o: Obstacle, scroll: number): boolean {
  if (o.kind === "lantern") {
    const cx = o.x - scroll + o.w / 2;
    const cy = o.y;
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy < (PLAYER_R + 30) * (PLAYER_R + 30);
  }
  const r = rectOf(o, scroll);
  const nx = Math.max(r.x, Math.min(px, r.x + r.w));
  const ny = Math.max(r.y, Math.min(py, r.y + r.h));
  const dx = px - nx;
  const dy = py - ny;
  return dx * dx + dy * dy <= PLAYER_R * PLAYER_R;
}

function gapDist(px: number, py: number, o: Obstacle, scroll: number): number {
  if (o.kind === "lantern") {
    const cx = o.x - scroll + o.w / 2;
    const cy = o.y;
    return Math.hypot(px - cx, py - cy) - PLAYER_R - 30;
  }
  const r = rectOf(o, scroll);
  const nx = Math.max(r.x, Math.min(px, r.x + r.w));
  const ny = Math.max(r.y, Math.min(py, r.y + r.h));
  return Math.hypot(px - nx, py - ny) - PLAYER_R;
}

function sprinkle(state: Game, dt: number) {
  state.flyT -= dt;
  if (state.flyT > 0) return;
  state.flyT = 0.22;
  const p = takeParticle(state);
  p.x = state.scroll + nextRand(state) * VIEW_W;
  p.y = 40 + nextRand(state) * (VIEW_H - 80);
  p.vx = -12 - nextRand(state) * 18;
  p.vy = (nextRand(state) - 0.5) * 16;
  p.life = 1.6 + nextRand(state);
  p.max = p.life;
  p.kind = nextRand(state) > 0.5 ? "gold" : "dew";
  p.size = 1.4;
  p.active = true;
}

function burst(state: Game, x: number, y: number, n: number, kind: "gold" | "dew") {
  for (let i = 0; i < n; i++) {
    const p = takeParticle(state);
    const a = nextRand(state) * Math.PI * 2;
    const s = 50 + nextRand(state) * 180;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.life = 0.35 + nextRand(state) * 0.35;
    p.max = p.life;
    p.kind = kind;
    p.size = 2 + nextRand(state) * 2.4;
    p.active = true;
  }
}

function floater(state: Game, x: number, y: number, text: string, dew: boolean) {
  const t = take(state.texts, blankText);
  t.x = x;
  t.y = y;
  t.life = 0.7;
  t.text = text;
  t.dew = dew;
  t.active = true;
}

function decayJuice(state: Game, dt: number) {
  state.shake = Math.max(0, state.shake - dt * 26);
  state.flash = Math.max(0, state.flash - dt * 2.4);
  for (const p of state.particles) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-1.4 * dt);
    p.vy *= Math.exp(-1.4 * dt);
  }
  for (const t of state.texts) {
    if (!t.active) continue;
    t.life -= dt;
    t.y -= 36 * dt;
    if (t.life <= 0) t.active = false;
  }
}

function take<T extends { active: boolean }>(pool: T[], make: () => T): T {
  for (const item of pool) {
    if (!item.active) return item;
  }
  const extra = make();
  pool.push(extra);
  return extra;
}

function takeParticle(state: Game): Particle {
  for (const p of state.particles) if (!p.active) return p;
  state.partCursor = (state.partCursor + 1) % state.particles.length;
  return state.particles[state.partCursor]!;
}

function nextRand(state: Game): number {
  state.seed = (state.seed + 0x6d2b79f5) | 0;
  let t = Math.imul(state.seed ^ (state.seed >>> 15), 1 | state.seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function blankObstacle(): Obstacle {
  return { active: false, kind: "blossom", x: 0, y: 0, w: 0, h: 0, passed: false };
}
function blankPickup(): Pickup {
  return { active: false, kind: "dew", x: 0, y: 0, r: 16 };
}
function blankParticle(): Particle {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, kind: "gold", size: 2 };
}
function blankText(): Floater {
  return { active: false, x: 0, y: 0, life: 0, text: "", dew: false };
}
