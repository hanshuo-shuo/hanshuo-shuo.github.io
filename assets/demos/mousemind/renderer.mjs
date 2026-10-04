import { castRay, isWalkable } from "./engine.mjs";
import { objectSprite } from "./sprites.mjs";

const rgb = (channels) => `rgb(${channels.map((c) => Math.round(c)).join(",")})`;

function drawObject(ctx, depths, pose, object, type, focal, horizon) {
  const dx = object.x - pose.x;
  const dy = object.y - pose.y;
  const forward = dx * Math.cos(pose.heading) + dy * Math.sin(pose.heading);
  if (forward < 0.006) return;
  const lateral = dx * Math.sin(pose.heading) - dy * Math.cos(pose.heading);
  const center = ctx.canvas.width / 2 + (focal * lateral) / forward;
  const width = (focal * (type === "goal" ? 0.125 : 0.069)) / forward;
  const height = (focal * (type === "goal" ? 0.195 : 0.078)) / forward;
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
  ctx.drawImage(objectSprite(type), center - width / 2, bottom - height, width, height);
  // At mouse height the overhead sign moves above the viewport up close.
  // Keep a small EXIT plaque on the visible doorway when that happens.
  if (type === "goal" && bottom - height < 0 && center > 0 && center < ctx.canvas.width) {
    const y = Math.max(18, Math.min(ctx.canvas.height - 18, bottom - 15));
    ctx.fillStyle = "#144b33";
    ctx.beginPath();
    ctx.roundRect(center - 25, y - 12, 50, 24, 4);
    ctx.fill();
    ctx.fillStyle = "#f2fff2";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EXIT", center, y);
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
    // Put the wide doorway just inside the tapered arena end.
    { location: { x: game.world.goal.x - 0.04, y: game.world.goal.y }, type: "goal" },
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
  ctx.fillStyle = "#247449";
  ctx.fillRect(gx - 4, gy - 6, 8, 12);
  ctx.strokeStyle = "#c9f5d0";
  ctx.lineWidth = 1;
  ctx.strokeRect(gx - 2, gy - 4, 4, 8);
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("EXIT", gx - 8, gy + 3);
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
