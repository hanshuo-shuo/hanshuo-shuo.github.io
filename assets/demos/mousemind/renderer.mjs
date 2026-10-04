import { castRay, isWalkable } from "./engine.mjs";

const rgb = (channels) => `rgb(${channels.map((c) => Math.round(c)).join(",")})`;

function drawObject(ctx, depths, pose, object, type, focal, horizon) {
  const dx = object.x - pose.x;
  const dy = object.y - pose.y;
  const forward = dx * Math.cos(pose.heading) + dy * Math.sin(pose.heading);
  if (forward < 0.006) return;
  const lateral = dx * Math.sin(pose.heading) - dy * Math.cos(pose.heading);
  const center = ctx.canvas.width / 2 + (focal * lateral) / forward;
  const width = (focal * (type === "goal" ? 0.026 : 0.043)) / forward;
  const height = (focal * (type === "goal" ? 0.1 : 0.082)) / forward;
  const bottom = horizon + (0.025 * focal) / forward;
  const left = Math.floor(center - width / 2);
  const right = Math.ceil(center + width / 2);
  if (right < 0 || left >= ctx.canvas.width || width > 4000) return;
  ctx.save();
  ctx.beginPath();
  for (let x = Math.max(0, left); x <= Math.min(ctx.canvas.width - 1, right); x++) {
    if (forward < depths[x] + 0.002) ctx.rect(x, 0, 1, ctx.canvas.height);
  }
  ctx.clip();
  ctx.translate(center, bottom - height);
  ctx.scale(width, height);
  if (type === "goal") {
    ctx.fillStyle = "#59cd83";
    ctx.fillRect(-0.08, 0.24, 0.16, 0.66);
    ctx.beginPath();
    ctx.ellipse(0, 0.2, 0.39, 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#bfffcf";
    ctx.beginPath();
    ctx.ellipse(-0.12, 0.15, 0.09, 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#306843";
    ctx.beginPath();
    ctx.ellipse(0, 0.93, 0.44, 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#303238";
    ctx.fillRect(-0.33, 0.32, 0.66, 0.55);
    ctx.fillStyle = "#4b4f54";
    ctx.fillRect(-0.43, 0.43, 0.86, 0.24);
    ctx.beginPath();
    ctx.ellipse(0, 0.24, 0.35, 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8b83a";
    ctx.fillRect(-0.09, 0.35, 0.18, 0.3);
    ctx.fillStyle = "#ea5347";
    for (const x of [-0.15, 0.15]) {
      ctx.beginPath();
      ctx.ellipse(x, 0.2, 0.065, 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#212429";
    ctx.fillRect(-0.4, 0.83, 0.8, 0.14);
  }
  ctx.restore();
}

export function renderEye(ctx, game, side) {
  const { width, height } = ctx.canvas;
  const player = game.player;
  const head = player.heading + player.head;
  const pose = {
    x: player.x + 0.012 * Math.cos(player.heading) - side * 0.008 * Math.sin(head),
    y: player.y + 0.012 * Math.sin(player.heading) + side * 0.008 * Math.cos(head),
    heading: head + (side * 40 * Math.PI) / 180,
  };
  // Eye offsets must never put the camera through a solid wall.
  if (!isWalkable(game.world, pose, 0)) {
    pose.x = player.x;
    pose.y = player.y;
  }
  const focal = width / 2 / Math.tan(Math.PI / 3);
  const horizon = height * 0.46;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#4b799f");
  sky.addColorStop(1, "#bccfd7");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon);
  const floor = ctx.createLinearGradient(0, horizon, 0, height);
  floor.addColorStop(0, "#707767");
  floor.addColorStop(1, "#283127");
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizon, width, height - horizon);
  const depths = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const offset = Math.PI / 3 - (x / (width - 1)) * ((2 * Math.PI) / 3);
    const hit = castRay(game.world, pose, pose.heading + offset);
    const depth = Math.max(0.002, hit.depth * Math.cos(offset));
    depths[x] = depth;
    if (!hit.segment) continue;
    const top = Math.max(-height, horizon - ((hit.segment.height - 0.025) * focal) / depth);
    const bottom = Math.min(height * 2, horizon + (0.025 * focal) / depth);
    const fog = Math.min(0.48, depth * 0.24);
    const shade = hit.segment.color.map((c, i) => c * (1 - fog) + [155, 169, 170][i] * fog);
    const gradient = ctx.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, rgb(shade.map((c) => c * 1.08)));
    gradient.addColorStop(1, rgb(shade.map((c) => c * 0.76)));
    ctx.fillStyle = gradient;
    ctx.fillRect(x, top, 1, bottom - top);
  }
  const objects = [
    { location: game.world.goal, type: "goal" },
    { location: game.predator, type: "predator" },
  ].sort((a, b) => Math.hypot(player.x - b.location.x, player.y - b.location.y) - Math.hypot(player.x - a.location.x, player.y - a.location.y));
  for (const object of objects) drawObject(ctx, depths, pose, object.location, object.type, focal, horizon);
  const vignette = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * 0.7);
  vignette.addColorStop(0, "#0000");
  vignette.addColorStop(1, "#0003");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(180, 62, 54, ${game.flash * 0.14})`;
    ctx.fillRect(0, 0, width, height);
  }
}

export function renderMap(ctx, game) {
  const size = ctx.canvas.width;
  const padding = 8;
  const scale = size - 2 * padding;
  const point = (p) => [padding + p.x * scale, padding + (1 - p.y) * scale];
  const drawPolygon = (vertices) => {
    ctx.beginPath();
    vertices.forEach((p, i) => {
      const [x, y] = point(p);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
  };
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#f5f5f0";
  ctx.strokeStyle = "#a5aaa0";
  drawPolygon(game.world.arena);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#87918a";
  game.world.blocks.forEach((b) => {
    drawPolygon(b.vertices);
    ctx.fill();
  });
  ctx.strokeStyle = "#9eb6bc";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  game.trail.forEach((p, i) => {
    const [x, y] = point(p);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.stroke();
  const [gx, gy] = point(game.world.goal);
  ctx.fillStyle = "#3c9963";
  ctx.beginPath();
  ctx.arc(gx, gy, 4, 0, Math.PI * 2);
  ctx.fill();
  const [x, y] = point(game.player);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-game.player.heading);
  ctx.fillStyle = "#785a8a";
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -3.5);
  ctx.lineTo(-4, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
