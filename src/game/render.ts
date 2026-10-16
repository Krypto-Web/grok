import { ready, type Art } from "@/game/assets";
import { VIEW_H, VIEW_W, type Game } from "@/game/sim";

const GOLD = "#e8c27a";
const DEW = "#7ed9cf";
const DEEP = "#0c1020";

export function draw(ctx: CanvasRenderingContext2D, state: Game, art: Art, now: number) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  const mag = state.reduced ? 0 : state.shake;
  const ox = mag ? Math.sin(now * 47) * mag : 0;
  const oy = mag ? Math.cos(now * 39) * mag : 0;
  ctx.save();
  ctx.translate(ox, oy);
  paintGarden(ctx, state, art);
  paintShade(ctx);
  paintSpeed(ctx, state, now);
  for (const o of state.obstacles) {
    if (!o.active || o.kind === "lantern") continue;
    paintHazard(ctx, state, art, o);
  }
  for (const o of state.obstacles) {
    if (!o.active || o.kind !== "lantern") continue;
    paintLantern(ctx, state, art, o);
  }
  for (const p of state.pickups) {
    if (!p.active) continue;
    paintPickup(ctx, state, art, p, now);
  }
  paintParticles(ctx, state);
  paintMoth(ctx, state, art, now);
  paintFloaters(ctx, state);
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(232, 194, 122, ${state.flash * 0.28})`;
    ctx.fillRect(-8, -8, VIEW_W + 16, VIEW_H + 16);
  }
  ctx.restore();
}

function paintGarden(ctx: CanvasRenderingContext2D, state: Game, art: Art) {
  const img = art.garden;
  if (!ready(img)) {
    ctx.fillStyle = DEEP;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    return;
  }
  const dw = (img.naturalWidth / img.naturalHeight) * VIEW_H;
  const shift = ((state.scroll * 0.38) % dw) + (state.scroll * 0.38 < 0 ? dw : 0);
  ctx.drawImage(img, -shift, 0, dw, VIEW_H);
  ctx.drawImage(img, -shift + dw, 0, dw, VIEW_H);
  if (dw < VIEW_W) ctx.drawImage(img, -shift + dw * 2, 0, dw, VIEW_H);
}

function paintShade(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, "rgba(8, 10, 22, 0.45)");
  g.addColorStop(0.22, "rgba(8, 10, 22, 0.05)");
  g.addColorStop(0.62, "rgba(8, 10, 22, 0)");
  g.addColorStop(1, "rgba(8, 10, 22, 0.5)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function paintSpeed(ctx: CanvasRenderingContext2D, state: Game, now: number) {
  if (state.phase !== "playing" || state.speed < 180) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.28, (state.speed - 180) / 700);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.25;
  for (let i = 0; i < 7; i++) {
    const y = ((i * 97 + now * 80) % (VIEW_H + 40)) - 20;
    const x = VIEW_W - ((state.scroll * 1.4 + i * 140) % (VIEW_W + 80));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 28 - (state.speed - 180) * 0.08, y + 1);
    ctx.stroke();
  }
  ctx.restore();
}

function paintHazard(
  ctx: CanvasRenderingContext2D,
  state: Game,
  art: Art,
  o: Game["obstacles"][number],
) {
  const x = o.x - state.scroll;
  if (o.kind === "blossom") {
    const vine = ctx.createLinearGradient(0, 0, 0, o.h);
    vine.addColorStop(0, "rgba(22, 16, 40, 0.15)");
    vine.addColorStop(0.45, "rgba(42, 28, 68, 0.72)");
    vine.addColorStop(1, "rgba(42, 28, 68, 0)");
    ctx.fillStyle = vine;
    roundRect(ctx, x + 46, -8, 28, o.h * 0.72, 14);
    ctx.fill();
    const s = 148;
    if (ready(art.blossom)) ctx.drawImage(art.blossom, x + o.w / 2 - s / 2, o.h - s * 0.78, s, s);
    return;
  }
  const top = VIEW_H - o.h;
  const vine = ctx.createLinearGradient(0, top, 0, VIEW_H);
  vine.addColorStop(0, "rgba(28, 36, 28, 0)");
  vine.addColorStop(0.4, "rgba(24, 36, 30, 0.78)");
  vine.addColorStop(1, "rgba(12, 18, 16, 0.35)");
  ctx.fillStyle = vine;
  roundRect(ctx, x + 48, top + o.h * 0.35, 30, o.h, 14);
  ctx.fill();
  const s = 150;
  if (ready(art.bramble)) ctx.drawImage(art.bramble, x + o.w / 2 - s / 2, top - s * 0.22, s, s);
}

function paintLantern(
  ctx: CanvasRenderingContext2D,
  state: Game,
  art: Art,
  o: Game["obstacles"][number],
) {
  const x = o.x - state.scroll + o.w / 2;
  const y = o.y;
  const glow = ctx.createRadialGradient(x, y, 6, x, y, 70);
  glow.addColorStop(0, "rgba(232, 194, 122, 0.38)");
  glow.addColorStop(1, "rgba(232, 194, 122, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 70, 0, Math.PI * 2);
  ctx.fill();
  const s = 118;
  if (ready(art.lantern)) ctx.drawImage(art.lantern, x - s / 2, y - s / 2, s, s);
}

function paintPickup(
  ctx: CanvasRenderingContext2D,
  state: Game,
  art: Art,
  p: Game["pickups"][number],
  now: number,
) {
  const x = p.x - state.scroll;
  const y = p.y + Math.sin(now * 3 + p.x * 0.01) * 3;
  if (p.kind === "charm") {
    const s = 56;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(now * 1.6 + p.x) * 0.18);
    if (ready(art.charm)) ctx.drawImage(art.charm, -s / 2, -s / 2, s, s);
    ctx.restore();
    return;
  }
  const frame = art.dew[Math.floor(now * 8) % 4];
  const s = 42;
  if (ready(frame)) ctx.drawImage(frame, x - s / 2, y - s / 2, s, s);
}

function paintParticles(ctx: CanvasRenderingContext2D, state: Game) {
  for (const p of state.particles) {
    if (!p.active) continue;
    const alpha = Math.max(0, p.life / p.max);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.kind === "dew" ? DEW : GOLD;
    const x = p.x - state.scroll;
    ctx.beginPath();
    ctx.arc(x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function paintMoth(ctx: CanvasRenderingContext2D, state: Game, art: Art, now: number) {
  const flap = state.phase === "playing" && state.climbing ? 14 : 8;
  const frame = art.moth[Math.floor(now * flap) % 4];
  const x = state.playerX;
  const y = state.playerY;
  const glow = ctx.createRadialGradient(x, y, 4, x, y, 64);
  glow.addColorStop(0, "rgba(232, 194, 122, 0.32)");
  glow.addColorStop(1, "rgba(232, 194, 122, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 64, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y + 16);
  ctx.scale(1, 0.32);
  ctx.fillStyle = "rgba(6, 8, 16, 0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tilt = clamp(state.vy / 680, -0.42, 0.45);
  const blink = state.invuln > 0 && Math.sin(now * 42) > 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 2 + tilt);
  ctx.globalAlpha = blink ? 0.35 : 1;
  if (ready(frame)) {
    const s = 132;
    ctx.drawImage(frame, -s / 2, -s / 2, s, s);
  } else {
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function paintFloaters(ctx: CanvasRenderingContext2D, state: Game) {
  ctx.textAlign = "center";
  ctx.font = "600 18px Fraunces, Palatino, serif";
  for (const t of state.texts) {
    if (!t.active) continue;
    ctx.globalAlpha = Math.max(0, t.life / 0.7);
    ctx.fillStyle = t.dew ? DEW : GOLD;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
