// Browser adaptation of Mice-first-person / Cellworld BotEvade.
// Geometry is world 21_05; visitor controls and navigation are implemented here.
// This playground is independent of the Python research simulator.
export const SETTINGS = Object.freeze({
  playerSpeed: 0.17,
  predatorSpeed: 0.055,
  playerRadius: 0.008,
  predatorRadius: 0.011,
  turnSpeed: 1.65,
  peekSpeed: 2.8,
  headLimit: Math.PI / 3,
  headRecenter: 1.8,
  captureRadius: 0.085,
  goalRadius: 0.065,
  duration: 120,
});

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const cross = (a, b) => a.x * b.y - a.y * b.x;
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

function polygon(center, diameter, rotation, sides = 6) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = ((rotation + 90) * Math.PI) / 180 + (i * Math.PI * 2) / sides;
    return { x: center.x + (diameter / 2) * Math.cos(angle), y: center.y + (diameter / 2) * Math.sin(angle) };
  });
}

export function pointInPolygon(point, vertices) {
  let sign = 0;
  for (let i = 0; i < vertices.length; i++) {
    const value = cross(subtract(vertices[(i + 1) % vertices.length], vertices[i]), subtract(point, vertices[i]));
    if (Math.abs(value) < 1e-10) continue;
    if (sign && Math.sign(value) !== sign) return false;
    sign = Math.sign(value);
  }
  return true;
}

function segmentDistance(point, a, b) {
  const delta = subtract(b, a);
  const length = delta.x * delta.x + delta.y * delta.y;
  const t = clamp(((point.x - a.x) * delta.x + (point.y - a.y) * delta.y) / length, 0, 1);
  return Math.hypot(point.x - a.x - t * delta.x, point.y - a.y - t * delta.y);
}

export function isWalkable(world, point, radius = SETTINGS.playerRadius) {
  if (!pointInPolygon(point, world.arena)) return false;
  for (const block of world.blocks) {
    if (Math.abs(point.x - block.center.x) > world.blockSize + radius || Math.abs(point.y - block.center.y) > world.blockSize + radius) continue;
    if (pointInPolygon(point, block.vertices)) return false;
    for (let i = 0; i < block.vertices.length; i++) {
      if (segmentDistance(point, block.vertices[i], block.vertices[(i + 1) % block.vertices.length]) < radius) return false;
    }
  }
  for (let i = 0; i < world.arena.length; i++) {
    if (segmentDistance(point, world.arena[i], world.arena[(i + 1) % world.arena.length]) < radius) return false;
  }
  return true;
}

export function buildWorld(raw) {
  const impl = raw.implementation;
  const blocked = new Set(raw.occlusions);
  const arena = polygon(impl.space.center, impl.space.transformation.size, impl.space.transformation.rotation);
  const blockSize = impl.cell_transformation.size;
  const blocks = raw.occlusions.map((id, i) => ({
    center: impl.cell_locations[id],
    vertices: polygon(impl.cell_locations[id], blockSize, impl.space.transformation.rotation + impl.cell_transformation.rotation),
    tint: ((i * 17) % 14) - 7,
  }));
  const segments = [];
  const addSegments = (vertices, height, color) => {
    vertices.forEach((a, i) => {
      const b = vertices[(i + 1) % vertices.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const light = 0.72 + 0.28 * Math.abs((-dy * -0.45 + dx * 0.89) / length);
      segments.push({ a, b, dx, dy, height, color: color.map((c) => c * light) });
    });
  };
  addSegments(arena, 0.22, [147, 145, 137]);
  blocks.forEach((block) => addSegments(block.vertices, 0.16, [82 + block.tint, 86 + block.tint, 91 + block.tint]));
  const cells = impl.cell_locations.map((point, id) => ({ ...point, id, blocked: blocked.has(id), neighbors: [] }));
  const coordinateIndex = new Map(raw.configuration.cell_coordinates.map((p, i) => [`${p.x},${p.y}`, i]));
  const world = {
    name: raw.name,
    arena,
    blocks,
    blockSize,
    segments,
    cells,
    free: cells.filter((c) => !c.blocked),
    spawns: raw.spawns,
    goal: { x: 0.96875, y: 0.5 },
  };
  raw.configuration.cell_coordinates.forEach((point, id) => {
    if (cells[id].blocked) return;
    for (const offset of raw.configuration.connection_pattern) {
      const next = coordinateIndex.get(`${point.x + offset.x},${point.y + offset.y}`);
      if (next === undefined || cells[next].blocked) continue;
      const middle = { x: (cells[id].x + cells[next].x) / 2, y: (cells[id].y + cells[next].y) / 2 };
      if (isWalkable(world, middle, SETTINGS.predatorRadius)) cells[id].neighbors.push(next);
    }
  });
  return world;
}

export function nearestCell(world, point) {
  return world.free.reduce((best, cell) => (distance(cell, point) < distance(best, point) ? cell : best), world.free[0]);
}

export function findPath(world, from, to) {
  const start = nearestCell(world, from).id;
  const target = nearestCell(world, to).id;
  const queue = [start];
  const previous = new Map([[start, null]]);
  for (let i = 0; i < queue.length && !previous.has(target); i++) {
    for (const next of world.cells[queue[i]].neighbors) {
      if (previous.has(next)) continue;
      previous.set(next, queue[i]);
      queue.push(next);
    }
  }
  if (!previous.has(target)) return [];
  const path = [];
  for (let cell = target; cell !== null; cell = previous.get(cell)) path.push(world.cells[cell]);
  return path.reverse();
}

export function castRay(world, origin, angle, maxDistance = 2) {
  const ray = { x: Math.cos(angle), y: Math.sin(angle) };
  let depth = maxDistance;
  let hit = null;
  for (const segment of world.segments) {
    const denominator = ray.x * segment.dy - ray.y * segment.dx;
    if (Math.abs(denominator) < 1e-10) continue;
    const dx = segment.a.x - origin.x;
    const dy = segment.a.y - origin.y;
    const t = (dx * segment.dy - dy * segment.dx) / denominator;
    const u = (dx * ray.y - dy * ray.x) / denominator;
    if (t > 0.00001 && t < depth && u >= 0 && u <= 1) {
      depth = t;
      hit = segment;
    }
  }
  return { depth, segment: hit };
}

export function hasLineOfSight(world, a, b) {
  const delta = subtract(b, a);
  return castRay(world, a, Math.atan2(delta.y, delta.x), distance(a, b) + 0.001).depth >= distance(a, b) - 0.0001;
}

function moveWithCollision(world, agent, dx, dy, radius) {
  const parts = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.003));
  let movedX = true;
  let movedY = true;
  for (let i = 0; i < parts; i++) {
    const next = { x: agent.x + dx / parts, y: agent.y + dy / parts };
    if (isWalkable(world, next, radius)) {
      agent.x = next.x;
      agent.y = next.y;
    } else {
      if (isWalkable(world, { x: next.x, y: agent.y }, radius)) agent.x = next.x;
      else movedX = false;
      if (isWalkable(world, { x: agent.x, y: next.y }, radius)) agent.y = next.y;
      else movedY = false;
    }
  }
  if (!movedX && agent.vx !== undefined) agent.vx = 0;
  if (!movedY && agent.vy !== undefined) agent.vy = 0;
}

export function createGame(world, seed = 21) {
  let rng = seed >>> 0 || 21;
  const random = () => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return (rng >>> 0) / 4294967296;
  };
  const spawn = world.cells[world.spawns[Math.floor(random() * world.spawns.length)]];
  return {
    world,
    player: { x: 0.05, y: 0.5, vx: 0, vy: 0, heading: 0, head: 0 },
    predator: { x: spawn.x, y: spawn.y, path: [], target: null, replan: 0 },
    phase: "ready",
    time: 0,
    captures: 0,
    cooldown: 0,
    flash: 0,
    trail: [{ x: 0.05, y: 0.5 }],
    random,
  };
}

export function stepGame(game, action, delta) {
  if (game.phase !== "running") return;
  const dt = Math.min(delta, 0.025);
  const player = game.player;
  player.heading = wrapAngle(player.heading + clamp(action.turn || 0, -1, 1) * SETTINGS.turnSpeed * dt);
  if (action.peek) player.head = clamp(player.head + action.peek * SETTINGS.peekSpeed * dt, -SETTINGS.headLimit, SETTINGS.headLimit);
  else player.head = Math.sign(player.head) * Math.max(0, Math.abs(player.head) - SETTINGS.headRecenter * dt);
  const speed = (action.stop ? 0 : clamp(action.forward || 0, -1, 1)) * SETTINGS.playerSpeed;
  const desiredX = speed * Math.cos(player.heading);
  const desiredY = speed * Math.sin(player.heading);
  // Egocentric velocity feedback, semi-implicit point-mass integration,
  // damping, and collision sliding follow the original control structure.
  const accelX = clamp((5 * (desiredX - player.vx) + 8 * player.vx) / 6, -1, 1);
  const accelY = clamp((5 * (desiredY - player.vy) + 8 * player.vy) / 6, -1, 1);
  player.vx += (6 * accelX - 8 * player.vx) * dt;
  player.vy += (6 * accelY - 8 * player.vy) * dt;
  moveWithCollision(game.world, player, player.vx * dt, player.vy * dt, SETTINGS.playerRadius);
  game.time += dt;
  game.cooldown = Math.max(0, game.cooldown - dt);
  game.flash = Math.max(0, game.flash - dt);
  if (distance(player, game.trail.at(-1)) > 0.007) game.trail.push({ x: player.x, y: player.y });
  if (distance(player, game.world.goal) < SETTINGS.goalRadius) {
    game.phase = "won";
    return;
  }
  if (game.time >= SETTINGS.duration) {
    game.phase = "timeout";
    return;
  }
  const predator = game.predator;
  const seesPlayer = hasLineOfSight(game.world, predator, player);
  predator.replan -= dt;
  if (predator.replan <= 0) {
    if (seesPlayer) predator.target = { x: player.x, y: player.y };
    else if (!predator.target || !predator.path.length) predator.target = game.world.free[Math.floor(game.random() * game.world.free.length)];
    predator.path = findPath(game.world, predator, predator.target).slice(1);
    predator.replan = 0.3;
  }
  if (predator.path.length) {
    const next = predator.path[0];
    const gap = distance(predator, next);
    if (gap < 0.004) predator.path.shift();
    else {
      const travel = Math.min(gap, SETTINGS.predatorSpeed * dt);
      moveWithCollision(
        game.world,
        predator,
        ((next.x - predator.x) / gap) * travel,
        ((next.y - predator.y) / gap) * travel,
        SETTINGS.predatorRadius
      );
    }
  } else if (seesPlayer) {
    const gap = distance(predator, player);
    if (gap > 0.002)
      moveWithCollision(
        game.world,
        predator,
        ((player.x - predator.x) / gap) * SETTINGS.predatorSpeed * dt,
        ((player.y - predator.y) / gap) * SETTINGS.predatorSpeed * dt,
        SETTINGS.predatorRadius
      );
  }
  if (game.cooldown === 0 && distance(predator, player) < SETTINGS.captureRadius && hasLineOfSight(game.world, predator, player)) {
    game.captures++;
    game.cooldown = 1.8;
    game.flash = 1;
  }
}
