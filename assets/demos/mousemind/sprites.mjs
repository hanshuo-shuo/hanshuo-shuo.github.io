// Original game artwork, drawn with Canvas and cached for the raycaster.
// Robot reference: the Cellworld platform used in Of Mice and Machines, Fig. 1.
// Close-up: https://github.com/cellworld/robot_assembly/blob/master/images/robot_overview.png
let cached;

function surface(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext("2d") };
}

function shape(ctx, points, fill, stroke = null, width = 2) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function rounded(ctx, x, y, width, height, radius, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function exitSprite() {
  const { canvas, ctx } = surface(384, 640);
  // A lit doorway and a large, high-contrast sign remain distinct from walls.
  const glow = ctx.createRadialGradient(192, 350, 60, 192, 350, 340);
  glow.addColorStop(0, "#84e8b02c");
  glow.addColorStop(1, "#84e8b000");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 384, 640);
  const opening = ctx.createLinearGradient(0, 154, 0, 596);
  opening.addColorStop(0, "#e4fce5");
  opening.addColorStop(0.6, "#7db891");
  opening.addColorStop(1, "#37684c");
  ctx.fillStyle = opening;
  ctx.fillRect(78, 144, 228, 458);
  shape(
    ctx,
    [
      [32, 143],
      [79, 143],
      [79, 601],
      [32, 620],
    ],
    "#254e3b",
    "#b9f5c5",
    8
  );
  shape(
    ctx,
    [
      [305, 143],
      [352, 143],
      [352, 620],
      [305, 601],
    ],
    "#254e3b",
    "#b9f5c5",
    8
  );
  ctx.fillStyle = "#b9f5c5";
  ctx.fillRect(38, 153, 9, 451);
  ctx.fillRect(338, 153, 9, 451);
  rounded(ctx, 13, 33, 358, 116, 14, "#144b33");
  ctx.strokeStyle = "#a2edb4";
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = "#f2fff2";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 92px sans-serif";
  ctx.fillText("EXIT", 192, 96);
  // Forward arrow through the doorway, readable without the text.
  ctx.strokeStyle = "#f4fff4";
  ctx.lineWidth = 23;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(192, 461);
  ctx.lineTo(192, 287);
  ctx.moveTo(137, 349);
  ctx.lineTo(192, 287);
  ctx.lineTo(247, 349);
  ctx.stroke();
  shape(
    ctx,
    [
      [31, 620],
      [79, 600],
      [305, 600],
      [353, 620],
    ],
    "#93d8a6",
    "#cdf5d0",
    3
  );
  return canvas;
}

function robotSprite() {
  const { canvas, ctx } = surface(384, 420);
  // Low tracked base, upright frame, silver CO2 cylinder, air nozzle,
  // and three red tracking LEDs follow the photographed experimental robot.
  ctx.fillStyle = "#1320294a";
  ctx.beginPath();
  ctx.ellipse(197, 396, 164, 17, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rear upright frame and elevated PCB platform.
  rounded(ctx, 102, 82, 27, 215, 5, "#262c31");
  rounded(ctx, 264, 92, 25, 192, 5, "#30363a");
  ctx.fillStyle = "#737d7f";
  ctx.fillRect(103, 94, 5, 187);
  shape(
    ctx,
    [
      [91, 90],
      [121, 53],
      [287, 65],
      [324, 99],
    ],
    "#383e42",
    "#929a97",
    3
  );
  shape(
    ctx,
    [
      [91, 90],
      [324, 99],
      [322, 108],
      [92, 100],
    ],
    "#1c2429",
    "#68736e",
    2
  );
  shape(
    ctx,
    [
      [127, 62],
      [280, 72],
      [303, 93],
      [113, 83],
    ],
    "#33433b",
    "#849080",
    2
  );
  for (const [x, y] of [
    [126, 77],
    [208, 70],
    [291, 91],
  ]) {
    ctx.fillStyle = "#fa645132";
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ed5849";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffcfb8";
    ctx.beginPath();
    ctx.arc(x - 1, y - 1, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#858f87";
  for (let i = 0; i < 5; i++) ctx.fillRect(158 + i * 13, 79 + i, 6, 6);

  // Cylinder, valve, and curved metal air nozzle.
  const metal = ctx.createLinearGradient(0, 208, 0, 264);
  metal.addColorStop(0, "#abb9bd");
  metal.addColorStop(0.3, "#eef2ef");
  metal.addColorStop(1, "#65797d");
  rounded(ctx, 135, 207, 136, 55, 25, metal);
  rounded(ctx, 255, 216, 36, 39, 7, "#202b2d");
  rounded(ctx, 276, 197, 29, 65, 8, "#303b3c");
  ctx.strokeStyle = "#485b5f";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(290, 203);
  ctx.lineTo(290, 153);
  ctx.quadraticCurveTo(290, 131, 316, 138);
  ctx.stroke();
  ctx.strokeStyle = "#c7d4d6";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(287, 202);
  ctx.lineTo(287, 153);
  ctx.quadraticCurveTo(287, 135, 312, 139);
  ctx.stroke();
  ctx.fillStyle = "#16292d";
  ctx.beginPath();
  ctx.ellipse(316, 139, 7, 10, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Exposed wiring connects the top board to the air-puff module.
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#90a660";
  ctx.beginPath();
  ctx.moveTo(273, 111);
  ctx.quadraticCurveTo(310, 192, 243, 272);
  ctx.stroke();
  ctx.strokeStyle = "#c29a54";
  ctx.beginPath();
  ctx.moveTo(133, 111);
  ctx.bezierCurveTo(137, 157, 151, 172, 114, 274);
  ctx.stroke();

  // Chassis: a slightly angled view makes the tracked body recognizable.
  shape(
    ctx,
    [
      [77, 285],
      [116, 264],
      [331, 264],
      [300, 290],
    ],
    "#4e585b",
    "#9aa5a3",
    2
  );
  shape(
    ctx,
    [
      [77, 285],
      [300, 290],
      [300, 384],
      [77, 377],
    ],
    "#263034",
    "#7d8a8c",
    3
  );
  shape(
    ctx,
    [
      [300, 290],
      [331, 264],
      [333, 359],
      [300, 384],
    ],
    "#1b2429",
    "#5c6d73",
    2
  );
  ctx.fillStyle = "#455258";
  ctx.fillRect(115, 308, 141, 10);
  ctx.fillStyle = "#131e25";
  for (let i = 0; i < 5; i++) ctx.fillRect(139 + i * 18, 328, 11, 22);

  // Rubber tracks with visible rollers and tread marks on both sides.
  for (const [x, y] of [
    [27, 284],
    [285, 287],
  ]) {
    rounded(ctx, x, y, 73, 104, 26, "#151e24");
    ctx.strokeStyle = "#81908f";
    ctx.lineWidth = 3;
    ctx.stroke();
    for (const cy of [y + 29, y + 73]) {
      ctx.fillStyle = "#46565b";
      ctx.beginPath();
      ctx.ellipse(x + 36, cy, 24, 21, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#889899";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#19282e";
      ctx.beginPath();
      ctx.arc(x + 36, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#9ba9a7";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.moveTo(x + 36 + Math.cos(a) * 10, cy + Math.sin(a) * 8);
        ctx.lineTo(x + 36 + Math.cos(a) * 19, cy + Math.sin(a) * 16);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = "#566768";
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 16 + i * 12);
      ctx.lineTo(x + 12, y + 16 + i * 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 61, y + 16 + i * 12);
      ctx.lineTo(x + 68, y + 16 + i * 12);
      ctx.stroke();
    }
  }
  return canvas;
}

export function objectSprite(type) {
  if (!cached) cached = { goal: exitSprite(), predator: robotSprite() };
  return cached[type];
}
