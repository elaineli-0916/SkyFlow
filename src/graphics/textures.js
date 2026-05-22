import * as THREE from "three";

const SIZE = 2048;

export function makeEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE / 2;
  const ctx = canvas.getContext("2d");

  const ocean = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, "#17457b");
  ocean.addColorStop(0.42, "#0b5e8f");
  ocean.addColorStop(0.64, "#064b79");
  ocean.addColorStop(1, "#09264a");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawBathymetry(ctx, canvas);

  const continents = [
    {
      color: "#47703c",
      points: [[0.13, 0.26], [0.2, 0.17], [0.29, 0.2], [0.36, 0.34], [0.31, 0.48], [0.22, 0.56], [0.13, 0.47], [0.1, 0.35]],
      scale: 1.25
    },
    {
      color: "#4d7842",
      points: [[0.29, 0.51], [0.36, 0.58], [0.38, 0.72], [0.34, 0.9], [0.29, 0.83], [0.25, 0.66]],
      scale: 0.82
    },
    {
      color: "#5e7445",
      points: [[0.46, 0.23], [0.56, 0.18], [0.68, 0.25], [0.74, 0.38], [0.68, 0.52], [0.54, 0.56], [0.45, 0.44]],
      scale: 1.18
    },
    {
      color: "#9a8151",
      points: [[0.54, 0.39], [0.64, 0.38], [0.72, 0.5], [0.66, 0.66], [0.56, 0.63], [0.5, 0.5]],
      scale: 0.86
    },
    {
      color: "#557442",
      points: [[0.67, 0.22], [0.8, 0.2], [0.93, 0.34], [0.88, 0.5], [0.74, 0.56], [0.66, 0.42]],
      scale: 1.12
    },
    {
      color: "#6f7947",
      points: [[0.77, 0.66], [0.88, 0.69], [0.93, 0.83], [0.84, 0.91], [0.75, 0.8]],
      scale: 0.82
    },
    {
      color: "#dce8e4",
      points: [[0.0, 0.83], [0.2, 0.78], [0.42, 0.83], [0.62, 0.79], [0.86, 0.84], [1.0, 0.8], [1.0, 1.0], [0.0, 1.0]],
      scale: 1.3
    }
  ];

  for (const continent of continents) {
    drawLandmass(ctx, continent.color, continent.points, continent.scale);
  }

  drawPolarCaps(ctx, canvas);
  drawCurrents(ctx, canvas);
  addGrain(ctx, canvas, 0.045);

  return new THREE.CanvasTexture(canvas);
}

export function makeNightTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE / 2;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#020713";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cityClusters = [
    [0.22, 0.38, 260], [0.26, 0.45, 180], [0.51, 0.35, 220], [0.58, 0.39, 240],
    [0.64, 0.34, 160], [0.73, 0.38, 300], [0.82, 0.42, 240], [0.86, 0.5, 120],
    [0.35, 0.68, 100], [0.57, 0.58, 150]
  ];

  for (const [x, y, count] of cityClusters) {
    for (let i = 0; i < count; i += 1) {
      const dx = gaussianRandom() * 42;
      const dy = gaussianRandom() * 20;
      const alpha = 0.18 + Math.random() * 0.62;
      ctx.fillStyle = `rgba(255, 202, 119, ${alpha})`;
      ctx.fillRect(x * canvas.width + dx, y * canvas.height + dy, 1.2, 1.2);
    }
  }

  blurCanvas(ctx, canvas, 0.9);
  return new THREE.CanvasTexture(canvas);
}

export function makeCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE / 2;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let band = 0; band < 7; band += 1) {
    const y = canvas.height * (0.18 + band * 0.105 + Math.random() * 0.035);
    const drift = Math.random() * canvas.width;
    ctx.strokeStyle = `rgba(230, 244, 255, ${0.11 + Math.random() * 0.13})`;
    ctx.lineWidth = 12 + Math.random() * 18;
    ctx.beginPath();
    for (let x = -120; x <= canvas.width + 120; x += 24) {
      const wave = Math.sin((x + drift) * 0.009 + band) * 20 + Math.sin(x * 0.025) * 9;
      if (x === -120) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 820; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radiusX = 18 + Math.random() * 70;
    const radiusY = 5 + Math.random() * 18;
    const alpha = Math.random() * 0.11;
    ctx.fillStyle = `rgba(245, 251, 255, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y, radiusX, radiusY, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  blurCanvas(ctx, canvas, 1.8);
  return new THREE.CanvasTexture(canvas);
}

function drawLandmass(ctx, color, points, scale) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.save();
  drawCoastGlow(ctx, points, scale);
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(220, 244, 183, 0.34)";
  ctx.shadowBlur = 14 * scale;
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    const px = x * width;
    const py = y * height;
    const wobbleX = Math.sin(index * 1.7) * 46 * scale;
    const wobbleY = Math.cos(index * 1.3) * 24 * scale;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.quadraticCurveTo(px + wobbleX, py + wobbleY, px, py);
  });
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = 2.6 * scale;
  ctx.strokeStyle = "rgba(226, 238, 191, 0.42)";
  ctx.stroke();

  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = "#e3ca80";
  for (let i = 0; i < 46 * scale; i += 1) {
    const point = points[Math.floor(Math.random() * points.length)];
    ctx.beginPath();
    ctx.ellipse(point[0] * width + gaussianRandom() * 120, point[1] * height + gaussianRandom() * 50, 34, 9, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#203a29";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 18 * scale; i += 1) {
    const point = points[Math.floor(Math.random() * points.length)];
    ctx.beginPath();
    ctx.arc(point[0] * width + gaussianRandom() * 140, point[1] * height + gaussianRandom() * 60, 16 + Math.random() * 38, 0, Math.PI * 1.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCoastGlow(ctx, points, scale) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.save();
  ctx.strokeStyle = "rgba(106, 199, 219, 0.38)";
  ctx.lineWidth = 8 * scale;
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    const px = x * width;
    const py = y * height;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawBathymetry(ctx, canvas) {
  ctx.save();
  for (let i = 0; i < 90; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = 80 + Math.random() * 260;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(111, 194, 220, 0.08)");
    gradient.addColorStop(1, "rgba(111, 194, 220, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPolarCaps(ctx, canvas) {
  const top = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.16);
  top.addColorStop(0, "rgba(230, 248, 255, 0.8)");
  top.addColorStop(1, "rgba(230, 248, 255, 0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.16);

  const bottom = ctx.createLinearGradient(0, canvas.height, 0, canvas.height * 0.84);
  bottom.addColorStop(0, "rgba(225, 245, 255, 0.72)");
  bottom.addColorStop(1, "rgba(225, 245, 255, 0)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, canvas.height * 0.84, canvas.width, canvas.height * 0.16);
}

function drawCurrents(ctx, canvas) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#78b8d6";
  ctx.lineWidth = 1;
  for (let i = 0; i < 34; i += 1) {
    const y = Math.random() * canvas.height;
    const x = Math.random() * canvas.width;
    ctx.beginPath();
    ctx.arc(x, y, 18 + Math.random() * 80, Math.random() * 4, Math.random() * 4 + 1.8);
    ctx.stroke();
  }
  ctx.restore();
}

function addGrain(ctx, canvas, opacity) {
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 255 * opacity;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }

  ctx.putImageData(image, 0, 0);
}

function blurCanvas(ctx, canvas, amount) {
  ctx.save();
  ctx.filter = `blur(${amount}px)`;
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
}

function gaussianRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
