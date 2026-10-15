import { createRng, hashSeed } from "./rng";
import { sizes } from "./sizes";
import type { Ball, GameConfig, GameWorld, Goal, Pin } from "./types";
import type { EngineSkinImageMap, GameSkins } from "./skins";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function createWorld(config: GameConfig, seed: string): GameWorld {
  const { width, height } = sizes[config.aspectRatio];
  const rng = createRng(hashSeed(seed));
  const goal = createGoal(config, rng, width, height);
  const ball = createBall(config, rng, width, height, goal);
  const pins = createPins(config, rng, width, height, ball, goal);

  return {
    width,
    height,
    countdown: 3,
    ball,
    goal,
    pins,
    elapsed: 0,
    wallBounces: 0,
    pinHits: 0,
    done: false,
  };
}

function createGoal(config: GameConfig, rng: () => number, width: number, height: number): Goal {
  const side = config.goalMode === "random"
    ? (["top", "right", "bottom", "left"] as const)[Math.floor(rng() * 4)]
    : config.goalSide;

  const wallLength = side === "top" || side === "bottom" ? width : height;
  const margin = 96;
  const maxWidth = Math.max(config.ballDiameter, wallLength * 0.38);
  const goalWidth = clamp(config.goalWidth, config.ballDiameter, Math.min(maxWidth, wallLength - margin * 2));
  const half = goalWidth / 2;
  const minCenter = margin + half;
  const maxCenter = wallLength - margin - half;
  const center = config.goalMode === "random"
    ? minCenter + rng() * Math.max(0, maxCenter - minCenter)
    : wallLength / 2;

  return {
    side,
    width: goalWidth,
    center: clamp(center, minCenter, maxCenter),
  };
}

function distanceToGoal(x: number, y: number, goal: Goal, width: number, height: number) {
  const side = goal.side;
  if (side === "top" || side === "bottom") {
    return Math.hypot(x - goal.center, y - (side === "top" ? 0 : height));
  }
  return Math.hypot(x - (side === "left" ? 0 : width), y - goal.center);
}

function createBall(config: GameConfig, rng: () => number, width: number, height: number, goal: Goal): Ball {
  const radius = config.ballDiameter / 2;
  const padding = radius + 56;
  let x = padding;
  let y = padding;
  let angle = 0;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    x = padding + rng() * (width - padding * 2);
    y = padding + rng() * (height - padding * 2);
    angle = rng() * Math.PI * 2;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    if (Math.abs(cos) < 0.16 || Math.abs(sin) < 0.16) continue;
    if (distanceToGoal(x, y, goal, width, height) > radius + config.goalWidth * 0.3) break;
  }

  return {
    x,
    y,
    vx: Math.cos(angle) * config.speed,
    vy: Math.sin(angle) * config.speed,
    r: radius,
  };
}

function createPins(config: GameConfig, rng: () => number, width: number, height: number, ball: Ball, goal: Goal): Pin[] {
  const pins: Pin[] = [];
  const radius = config.pinDiameter / 2;
  const margin = radius + 56;

  for (let attempt = 0; attempt < config.pinCount * 120 && pins.length < config.pinCount; attempt += 1) {
    const x = margin + rng() * (width - margin * 2);
    const y = margin + rng() * (height - margin * 2);
    const distanceWall = Math.min(x, y, width - x, height - y);

    if (distanceWall < margin) continue;
    if (Math.hypot(x - ball.x, y - ball.y) < radius + ball.r + 52) continue;
    if (distanceToGoal(x, y, goal, width, height) < radius + ball.r + 90) continue;
    if (pins.some((pin) => Math.hypot(x - pin.x, y - pin.y) < radius + pin.r + 40)) continue;

    pins.push({ x, y, r: radius });
  }

  return pins;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private config: GameConfig;
  private seed: string;
  private world: GameWorld;
  private running: boolean;
  private lastTime: number;
  private jitterRng: () => number;
  private skins: GameSkins;
  private skinImages: EngineSkinImageMap;
  private doneReported = false;
  onDone?: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    config: GameConfig,
    seed: string,
    skins: GameSkins,
    skinImages: EngineSkinImageMap = {},
  ) {
    this.canvas = canvas;
    this.config = config;
    this.seed = seed;
    this.world = createWorld(config, seed);
    this.running = true;
    this.lastTime = 0;
    this.jitterRng = createRng(hashSeed(`${seed}-anti-loop`));
    this.skins = skins;
    this.skinImages = skinImages;
    this.resize();
  }

  setSkins(skins: GameSkins, images: EngineSkinImageMap = {}) {
    this.skins = skins;
    this.skinImages = images;
    this.render();
  }

  resize() {
    this.canvas.width = this.world.width;
    this.canvas.height = this.world.height;
  }

  setSettings(config: GameConfig) {
    const worldChanged = (["aspectRatio", "ballDiameter", "goalWidth", "goalMode", "goalSide", "pinCount", "pinDiameter"] as const)
      .some((key) => this.config[key] !== config[key]);
    const speedChanged = config.speed !== this.config.speed;
    this.config = config;

    if (worldChanged) {
      this.resetWorld();
      this.resize();
    } else if (speedChanged) {
      this.applySpeed();
    }

    this.render();
  }

  setSeed(seed: string) {
    this.seed = seed;
    this.jitterRng = createRng(hashSeed(`${seed}-anti-loop`));
    this.resetWorld();
    this.resize();
    this.render();
  }

  play() {
    this.running = true;
    this.lastTime = 0;
  }

  pause() {
    this.running = false;
  }

  tick(now: number) {
    if (!this.running || this.world.done) {
      this.lastTime = now;
      this.render();
      return;
    }

    if (!this.lastTime) {
      this.lastTime = now;
      return;
    }

    const dt = Math.min(0.08, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (this.world.countdown > 0) {
      this.world.countdown = Math.max(0, this.world.countdown - dt);
      this.render();
      return;
    }
    if (this.world.countdown > 0) {
      this.world.countdown = Math.max(0, this.world.countdown - dt);
      this.render();
      return;
    }

    this.world.elapsed += dt;

    const steps = Math.max(2, Math.min(6, Math.ceil(dt * 120)));
    for (let index = 0; index < steps; index += 1) {
      this.stepSubstep(dt / steps);
      if (this.world.done) break;
    }

    if (this.world.done) {
      this.reportDone();
    }

    this.render();
  }

  private applySpeed() {
    const ball = this.world.ball;
    if (ball.vx === 0 && ball.vy === 0) return;
    const angle = Math.atan2(ball.vy, ball.vx);
    ball.vx = Math.cos(angle) * this.config.speed;
    ball.vy = Math.sin(angle) * this.config.speed;
  }

  private reportDone() {
    if (this.doneReported) return;
    this.doneReported = true;
    this.onDone?.();
  }

  private resetWorld() {
    this.world = createWorld(this.config, this.seed);
    this.lastTime = 0;
    this.doneReported = false;
  }

  private stepSubstep(dt: number) {
    const world = this.world;
    if (world.done) return;

    world.ball.x += world.ball.vx * dt;
    world.ball.y += world.ball.vy * dt;

    if (this.resolvePinCollisions()) {
      world.pinHits += 1;
      this.applyJitter(3.2);
    }

    if (this.resolveGoal()) {
      world.done = true;
      return;
    }

    if (this.resolveWalls()) {
      world.wallBounces += 1;
      this.applyJitter(1.2);
    }
  }

  private applyJitter(degrees: number) {
    const ball = this.world.ball;
    const speed = this.config.speed;
    const current = Math.atan2(ball.vy, ball.vx);
    const next = current + (this.jitterRng() * 2 - 1) * degrees * (Math.PI / 180);
    ball.vx = Math.cos(next) * speed;
    ball.vy = Math.sin(next) * speed;
  }

  private resolvePinCollisions() {
    const world = this.world;
    const ball = world.ball;
    let hit = false;

    for (const pin of world.pins) {
      const dx = ball.x - pin.x;
      const dy = ball.y - pin.y;
      const distance = Math.hypot(dx, dy);
      const minDistance = ball.r + pin.r;
      if (distance >= minDistance) continue;

      const nx = distance === 0 ? 0 : dx / distance;
      const ny = distance === 0 ? 1 : dy / distance;
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
        hit = true;
      }

      ball.x = pin.x + nx * (minDistance + 0.5);
      ball.y = pin.y + ny * (minDistance + 0.5);
    }

    return hit;
  }

  private resolveGoal() {
    const world = this.world;
    const ball = world.ball;
    const half = world.goal.width / 2;

    switch (world.goal.side) {
      case "top":
        return ball.y <= ball.r && ball.x >= world.goal.center - half && ball.x <= world.goal.center + half;
      case "bottom":
        return ball.y >= world.height - ball.r && ball.x >= world.goal.center - half && ball.x <= world.goal.center + half;
      case "left":
        return ball.x <= ball.r && ball.y >= world.goal.center - half && ball.y <= world.goal.center + half;
      case "right":
        return ball.x >= world.width - ball.r && ball.y >= world.goal.center - half && ball.y <= world.goal.center + half;
      default:
        return false;
    }
  }

  private resolveWalls() {
    const world = this.world;
    const ball = world.ball;
    let hit = false;

    if (ball.y < ball.r) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
      hit = true;
    }
    if (ball.y > world.height - ball.r) {
      ball.y = world.height - ball.r;
      ball.vy = -Math.abs(ball.vy);
      hit = true;
    }
    if (ball.x < ball.r) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
      hit = true;
    }
    if (ball.x > world.width - ball.r) {
      ball.x = world.width - ball.r;
      ball.vx = -Math.abs(ball.vx);
      hit = true;
    }

    return hit;
  }

  render() {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    drawWorld(ctx, this.world, this.skins, this.skinImages);
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, world: GameWorld) {
  const { width, height, goal } = world;
  const half = goal.width / 2;

  const segments = goal.side === "top"
    ? [
        { x1: 0, y1: 0, x2: goal.center - half, y2: 0 },
        { x1: goal.center + half, y1: 0, x2: width, y2: 0 },
      ]
    : goal.side === "bottom"
      ? [
          { x1: 0, y1: height, x2: goal.center - half, y2: height },
          { x1: goal.center + half, y1: height, x2: width, y2: height },
        ]
      : goal.side === "left"
        ? [
            { x1: 0, y1: 0, x2: 0, y2: goal.center - half },
            { x1: 0, y1: goal.center + half, x2: 0, y2: height },
          ]
        : [
            { x1: width, y1: 0, x2: width, y2: goal.center - half },
            { x1: width, y1: goal.center + half, x2: width, y2: height },
          ];

  for (const edge of segments) {
    ctx.beginPath();
    ctx.moveTo(edge.x1, edge.y1);
    ctx.lineTo(edge.x2, edge.y2);
    ctx.stroke();
  }
}

function drawGoal(
  ctx: CanvasRenderingContext2D,
  world: GameWorld,
  skins: GameSkins,
  images: EngineSkinImageMap,
) {
  const { goal, width, height } = world;
  const half = goal.width / 2;
  let x1 = 0;
  let y1 = 0;
  let x2 = 0;
  let y2 = 0;

  if (goal.side === "top") {
    x1 = goal.center - half;
    y1 = 0;
    x2 = goal.center + half;
    y2 = 0;
  } else if (goal.side === "bottom") {
    x1 = goal.center - half;
    y1 = height;
    x2 = goal.center + half;
    y2 = height;
  } else if (goal.side === "left") {
    x1 = 0;
    y1 = goal.center - half;
    x2 = 0;
    y2 = goal.center + half;
  } else {
    x1 = width;
    y1 = goal.center - half;
    x2 = width;
    y2 = goal.center + half;
  }

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const rotation = goal.side === "top"
    ? 0
    : goal.side === "right"
      ? Math.PI / 2
      : goal.side === "bottom"
        ? Math.PI
        : -Math.PI / 2;
  const line = () => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  if (skins.goal === "custom" && images.goal) {
    const thickness = Math.max(64, Math.min(goal.width * 0.34, Math.min(width, height) * 0.09));
    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(rotation);
    drawImageCover(ctx, images.goal, -half, -thickness / 2, goal.width, thickness);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    line();
    ctx.restore();
    return;
  }

  if (skins.goal === "football") {
    ctx.save();
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = Math.max(8, goal.width * 0.055);
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(255,255,255,0.55)";
    ctx.shadowBlur = 22;
    line();
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(midX, midY, goal.width * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (skins.goal === "portal") {
    ctx.save();
    const glow = ctx.createRadialGradient(midX, midY, goal.width * 0.08, midX, midY, goal.width * 0.75);
    glow.addColorStop(0, "rgba(139,92,246,0.5)");
    glow.addColorStop(1, "rgba(139,92,246,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = Math.max(8, goal.width * 0.05);
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(139,92,246,0.65)";
    ctx.shadowBlur = 32;
    line();
    ctx.restore();
    return;
  }

  if (skins.goal === "target") {
    ctx.save();
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = Math.max(7, goal.width * 0.045);
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(249,115,22,0.5)";
    ctx.shadowBlur = 26;
    line();
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = Math.max(3, goal.width * 0.012);
    if (goal.side === "top" || goal.side === "bottom") {
      ctx.beginPath();
      ctx.ellipse(midX, midY, half * 0.55, half * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(midX, midY, half * 0.18, half * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }

  ctx.save();
  ctx.shadowColor = "rgba(77,208,167,0.5)";
  ctx.shadowBlur = 34;
  ctx.strokeStyle = "#4dd0a7";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  line();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#6ee7b7";
  ctx.lineWidth = 3;
  const postRadius = Math.max(6, goal.width * 0.03);
  for (const point of [{ x: x1, y: y1 }, { x: x2, y: y2 }]) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, postRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#e5e7eb";
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#4dd0a7";
  ctx.beginPath();
  if (goal.side === "top" || goal.side === "bottom") {
    ctx.ellipse(midX, midY, half, 12, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(midX, midY, 12, half, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (sourceRatio > targetRatio) {
    drawHeight = height;
    drawWidth = height * sourceRatio;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = width / sourceRatio;
    offsetY = (height - drawHeight) / 2;
  }

  ctx.drawImage(image, x + offsetX, y + offsetY, drawWidth, drawHeight);
}
function drawField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  skins: GameSkins,
  images: EngineSkinImageMap,
) {
  ctx.clearRect(0, 0, width, height);

  if (skins.field === "custom" && images.field) {
    drawImageCover(ctx, images.field, 0, 0, width, height);
    const opacity = Math.min(0.9, Math.max(0, skins.fieldImageOpacity / 100));
    ctx.fillStyle = `rgba(10,14,20,${opacity})`;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (skins.field === "solid") {
    ctx.fillStyle = "#101418";
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (skins.field === "grid") {
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 2;
    const spacing = Math.max(86, Math.min(width, height) * 0.075);
    for (let x = spacing; x < width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = spacing; y < height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    return;
  }

  if (skins.field === "dots") {
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    const spacing = Math.max(64, Math.min(width, height) * 0.06);
    for (let x = spacing; x < width; x += spacing) {
      for (let y = spacing; y < height; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, spacing * 0.035), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  if (skins.field === "stripes") {
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#121a25");
    background.addColorStop(1, "#182338");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = Math.max(10, Math.min(width, height) * 0.03);
    for (let x = -height; x < width + height; x += ctx.lineWidth * 2.8) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.rotate(Math.PI / 8);
      ctx.beginPath();
      ctx.moveTo(0, -height);
      ctx.lineTo(0, width + height);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#111927");
  background.addColorStop(0.62, "#0f141b");
  background.addColorStop(1, "#141a22");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.033)";
  const spacing = 72;
  for (let x = spacing; x < width; x += spacing) {
    for (let y = spacing; y < height; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  ball: Ball,
  skins: GameSkins,
  images: EngineSkinImageMap,
) {
  if (skins.ball === "custom" && images.ball) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.clip();
    drawImageCover(ctx, images.ball, ball.x - ball.r, ball.y - ball.r, ball.r * 2, ball.r * 2);
    ctx.restore();
  } else if (skins.ball === "cyan") {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = "#22d3ee";
    ctx.fill();
  } else if (skins.ball === "violet") {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = "#8b5cf6";
    ctx.fill();
  } else if (skins.ball === "red") {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
  } else if (skins.ball === "stripes") {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(ball.x - ball.r, ball.y - ball.r, ball.r * 2, ball.r * 2);
    ctx.fillStyle = "rgba(15,23,42,0.72)";
    for (let delta = -2; delta <= 2; delta += 1) {
      ctx.fillRect(
        ball.x - ball.r,
        ball.y + delta * ball.r * 0.38 - ball.r * 0.09,
        ball.r * 2,
        ball.r * 0.18,
      );
    }
    ctx.restore();
  } else if (skins.ball === "checker") {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(ball.x - ball.r, ball.y - ball.r, ball.r * 2, ball.r * 2);
    ctx.fillStyle = "#1f2937";
    const section = ball.r * 0.64;
    for (let ix = -1; ix <= 1; ix += 1) {
      for (let iy = -1; iy <= 1; iy += 1) {
        if ((ix + iy) % 2 === 0) {
          ctx.fillRect(
            ball.x + ix * section - section / 2,
            ball.y + iy * section - section / 2,
            section,
            section,
          );
        }
      }
    }
    ctx.restore();
  } else {
    const gradient = ctx.createRadialGradient(
      ball.x - ball.r * 0.32,
      ball.y - ball.r * 0.36,
      1,
      ball.x,
      ball.y,
      ball.r,
    );
    gradient.addColorStop(0, "#fee2a7");
    gradient.addColorStop(0.62, "#f97316");
    gradient.addColorStop(1, "#c0390b");
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = Math.max(1.4, ball.r * 0.08);
  ctx.stroke();
}

function drawCountdown(
  ctx: CanvasRenderingContext2D,
  world: GameWorld,
) {
  if (world.countdown <= 0) return;

  const { width, height, countdown } = world;
  const scale = Math.min(width, height);
  const radius = scale * 0.16;
  ctx.save();
  ctx.fillStyle = "rgba(11,15,20,0.68)";
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = Math.max(2, radius * 0.035);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(77,208,167,0.45)";
  ctx.shadowBlur = scale * 0.055;
  ctx.fillStyle = "#f8fafc";
  ctx.font = `700 ${scale * 0.1}px system-ui, sans-serif`;
  ctx.fillText(String(Math.ceil(countdown)), width / 2, height / 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.66)";
  ctx.font = `500 ${scale * 0.03}px system-ui, sans-serif`;
  ctx.fillText("准备开始", width / 2, height / 2 + scale * 0.1);
  ctx.restore();
}

function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: GameWorld,
  skins: GameSkins,
  images: EngineSkinImageMap,
) {
  const { width, height, ball, pins, done } = world;
  drawField(ctx, width, height, skins, images);

  ctx.strokeStyle = "rgba(226,232,240,0.28)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  drawWalls(ctx, world);
  drawGoal(ctx, world, skins, images);

  for (const pin of pins) {
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, pin.r, 0, Math.PI * 2);
    ctx.fillStyle = "#454f5a";
    ctx.fill();
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (!done) {
    drawBall(ctx, ball, skins, images);
    drawCountdown(ctx, world);
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.52)";
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.font = `700 ${Math.min(width, height) * 0.07}px system-ui, sans-serif`;
  ctx.fillText("进球", width / 2, height / 2 - Math.min(width, height) * 0.02);
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = `500 ${Math.min(width, height) * 0.028}px system-ui, sans-serif`;
  ctx.fillText(
    `${world.elapsed.toFixed(2)}s · 碰墙 ${world.wallBounces} · 碰钉 ${world.pinHits}`,
    width / 2,
    height / 2 + Math.min(width, height) * 0.045,
  );
  ctx.restore();
}
