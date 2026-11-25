// NEON AEGIS — High-DPI 60FPS Canvas Arcade Shooter with Web Audio Synthesizer

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreVal = document.getElementById("scoreVal");
const waveVal = document.getElementById("waveVal");
const multVal = document.getElementById("multVal");
const shieldBar = document.getElementById("shieldBar");
const overdriveBar = document.getElementById("overdriveBar");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySub = document.getElementById("overlaySub");
const startBtn = document.getElementById("startBtn");

let width = 0;
let height = 0;
let dpr = 1;

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Procedural Web Audio sound engine (zero external audio files needed)
class SoundFX {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }
  tone(freq, endFreq, duration, type = "sawtooth", gainPeak = 0.08) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    gain.gain.setValueAtTime(gainPeak, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
  laser() {
    this.tone(780, 220, 0.09, "triangle", 0.06);
  }
  explosion(big = false) {
    this.tone(big ? 160 : 240, 28, big ? 0.42 : 0.22, "sawtooth", big ? 0.14 : 0.08);
  }
  nova() {
    this.tone(320, 960, 0.28, "sine", 0.14);
    this.tone(180, 40, 0.45, "sawtooth", 0.12);
  }
  pickup() {
    this.tone(520, 1040, 0.14, "sine", 0.09);
  }
}
const sfx = new SoundFX();

const keys = new Set();
const pointer = { x: width / 2, y: height / 2, down: false };

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === "p" && state.running) {
    state.paused = !state.paused;
    overlayTitle.textContent = state.paused ? "PAUSED" : "NEON AEGIS";
    overlaySub.textContent = state.paused
      ? "Press P or click below to resume mission."
      : "";
    startBtn.textContent = state.paused ? "RESUME" : "LAUNCH MISSION";
    overlay.classList.toggle("visible", state.paused);
  }
  if ((e.key === "Shift" || k === "e") && state.running && !state.paused) {
    triggerOverdrive();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("mousemove", (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});
window.addEventListener("mousedown", (e) => {
  if (e.button === 0) pointer.down = true;
  if (e.button === 2 && state.running && !state.paused) triggerOverdrive();
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) pointer.down = false;
});
window.addEventListener("contextmenu", (e) => e.preventDefault());

const stars = Array.from({ length: 140 }, () => ({
  x: Math.random() * 2000,
  y: Math.random() * 1200,
  z: 0.3 + Math.random() * 1.4,
  r: 0.6 + Math.random() * 1.6,
}));

const state = {
  running: false,
  paused: false,
  score: 0,
  wave: 1,
  multiplier: 1.0,
  comboTimer: 0,
  shake: 0,
  lastTime: 0,
  spawnTimer: 0,
  waveKills: 0,
  player: null,
  bullets: [],
  enemies: [],
  particles: [],
  pickups: [],
  shockwaves: [],
};

function resetGame() {
  state.running = true;
  state.paused = false;
  state.score = 0;
  state.wave = 1;
  state.multiplier = 1.0;
  state.comboTimer = 0;
  state.shake = 0;
  state.spawnTimer = 0.4;
  state.waveKills = 0;
  state.bullets = [];
  state.enemies = [];
  state.particles = [];
  state.pickups = [];
  state.shockwaves = [];
  state.player = {
    x: width / 2,
    y: height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: 16,
    shield: 100,
    maxShield: 100,
    overdrive: 40,
    fireCooldown: 0,
    invuln: 0,
  };
  updateHud();
}

function updateHud() {
  scoreVal.textContent = String(Math.floor(state.score)).padStart(6, "0");
  waveVal.textContent = String(state.wave).padStart(2, "0");
  multVal.textContent = `${state.multiplier.toFixed(1)}x`;
  if (state.player) {
    shieldBar.style.width = `${Math.max(0, (state.player.shield / state.player.maxShield) * 100)}%`;
    overdriveBar.style.width = `${Math.min(100, state.player.overdrive)}%`;
  }
}

function spawnParticles(x, y, color, count = 16, speed = 220) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 35 + Math.random() * speed;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.35 + Math.random() * 0.4,
      maxLife: 0.75,
      color,
      size: 1.8 + Math.random() * 2.6,
    });
  }
}

function triggerOverdrive() {
  const p = state.player;
  if (!p || p.overdrive < 100) return;
  p.overdrive = 0;
  p.invuln = 1.0;
  state.shake = 14;
  sfx.nova();
  state.shockwaves.push({ x: p.x, y: p.y, radius: 12, maxRadius: 440, alpha: 1 });

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    const dist = Math.hypot(e.x - p.x, e.y - p.y);
    if (dist <= 440) {
      damageEnemy(i, 999);
    }
  }
  updateHud();
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (edge === 0) {
    x = Math.random() * width;
    y = -30;
  } else if (edge === 1) {
    x = width + 30;
    y = Math.random() * height;
  } else if (edge === 2) {
    x = Math.random() * width;
    y = height + 30;
  } else {
    x = -30;
    y = Math.random() * height;
  }

  const roll = Math.random();
  let kind = "chaser";
  let hp = 20 + state.wave * 4;
  let speed = 135 + Math.min(120, state.wave * 10);
  let radius = 15;
  let color = "#f43f5e";
  let points = 100;

  if (roll > 0.78 && state.wave >= 2) {
    kind = "tank";
    hp = 65 + state.wave * 12;
    speed = 78 + Math.min(50, state.wave * 4);
    radius = 24;
    color = "#f97316";
    points = 260;
  } else if (roll > 0.55) {
    kind = "dasher";
    hp = 16 + state.wave * 3;
    speed = 210 + Math.min(140, state.wave * 12);
    radius = 12;
    color = "#a855f7";
    points = 140;
  }

  state.enemies.push({ x, y, vx: 0, vy: 0, kind, hp, maxHp: hp, speed, radius, color, points, angle: 0 });
}

function damageEnemy(index, dmg) {
  const e = state.enemies[index];
  if (!e) return;
  e.hp -= dmg;
  spawnParticles(e.x, e.y, e.color, 6, 130);
  if (e.hp <= 0) {
    state.enemies.splice(index, 1);
    state.score += e.points * state.multiplier;
    state.multiplier = Math.min(8.0, state.multiplier + 0.2);
    state.comboTimer = 3.2;
    state.waveKills += 1;
    state.shake = Math.max(state.shake, e.kind === "tank" ? 9 : 5);
    if (state.player) {
      state.player.overdrive = Math.min(100, state.player.overdrive + (e.kind === "tank" ? 18 : 9));
    }
    sfx.explosion(e.kind === "tank");
    spawnParticles(e.x, e.y, e.color, e.kind === "tank" ? 28 : 16, 260);

    if (Math.random() < 0.16) {
      state.pickups.push({
        x: e.x,
        y: e.y,
        type: Math.random() < 0.6 ? "shield" : "overdrive",
        life: 8.0,
      });
    }

    if (state.waveKills >= 8 + state.wave * 4) {
      state.wave += 1;
      state.waveKills = 0;
    }
  }
}

function update(dt) {
  const p = state.player;
  if (!p) return;

  for (const s of stars) {
    s.x -= p.vx * dt * 0.06 * s.z;
    s.y -= p.vy * dt * 0.06 * s.z;
    if (s.x < 0) s.x += width;
    if (s.x > width) s.x -= width;
    if (s.y < 0) s.y += height;
    if (s.y > height) s.y -= height;
  }

  let ax = 0;
  let ay = 0;
  if (keys.has("w") || keys.has("arrowup")) ay -= 1;
  if (keys.has("s") || keys.has("arrowdown")) ay += 1;
  if (keys.has("a") || keys.has("arrowleft")) ax -= 1;
  if (keys.has("d") || keys.has("arrowright")) ax += 1;

  if (ax !== 0 || ay !== 0) {
    const len = Math.hypot(ax, ay);
    ax /= len;
    ay /= len;
  }

  const accel = 1350;
  const drag = 4.2;
  p.vx += (ax * accel - p.vx * drag) * dt;
  p.vy += (ay * accel - p.vy * drag) * dt;
  p.x = Math.max(24, Math.min(width - 24, p.x + p.vx * dt));
  p.y = Math.max(76, Math.min(height - 24, p.y + p.vy * dt));
  p.angle = Math.atan2(pointer.y - p.y, pointer.x - p.x);
  p.invuln = Math.max(0, p.invuln - dt);

  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.multiplier = 1.0;
  }

  p.fireCooldown -= dt;
  const firing = pointer.down || keys.has(" ");
  if (firing && p.fireCooldown <= 0) {
    p.fireCooldown = state.wave >= 4 ? 0.095 : 0.115;
    const spread = state.wave >= 3 ? [-0.07, 0, 0.07] : [-0.035, 0.035];
    for (const offset of spread) {
      const a = p.angle + offset;
      state.bullets.push({
        x: p.x + Math.cos(a) * 20,
        y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * 760,
        vy: Math.sin(a) * 760,
        life: 1.1,
        dmg: 14,
      });
    }
    sfx.laser();
  }

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer = Math.max(0.28, 1.15 - state.wave * 0.08);
  }

  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -40 || b.x > width + 40 || b.y < -40 || b.y > height + 40) {
      state.bullets.splice(i, 1);
      continue;
    }
    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const e = state.enemies[j];
      if (Math.hypot(b.x - e.x, b.y - e.y) <= e.radius + 5) {
        state.bullets.splice(i, 1);
        damageEnemy(j, b.dmg);
        break;
      }
    }
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    e.angle = ang;
    e.vx = Math.cos(ang) * e.speed;
    e.vy = Math.sin(ang) * e.speed;
    e.x += e.vx * dt;
    e.y += e.vy * dt;

    if (Math.hypot(e.x - p.x, e.y - p.y) <= e.radius + p.radius) {
      if (p.invuln <= 0) {
        p.shield -= e.kind === "tank" ? 28 : 18;
        p.invuln = 0.65;
        state.multiplier = 1.0;
        state.shake = 12;
        sfx.explosion(true);
        spawnParticles(p.x, p.y, "#38bdf8", 20, 240);
      }
      state.enemies.splice(i, 1);
      if (p.shield <= 0) {
        endGame();
        return;
      }
    }
  }

  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pk = state.pickups[i];
    pk.life -= dt;
    if (pk.life <= 0) {
      state.pickups.splice(i, 1);
      continue;
    }
    if (Math.hypot(pk.x - p.x, pk.y - p.y) <= p.radius + 14) {
      if (pk.type === "shield") {
        p.shield = Math.min(p.maxShield, p.shield + 25);
      } else {
        p.overdrive = Math.min(100, p.overdrive + 35);
      }
      sfx.pickup();
      spawnParticles(pk.x, pk.y, "#22c55e", 12, 160);
      state.pickups.splice(i, 1);
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }

  for (let i = state.shockwaves.length - 1; i >= 0; i--) {
    const sw = state.shockwaves[i];
    sw.radius += 1150 * dt;
    sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
    if (sw.radius >= sw.maxRadius) state.shockwaves.splice(i, 1);
  }

  state.shake = Math.max(0, state.shake - 36 * dt);
  updateHud();
}

function draw() {
  ctx.save();
  ctx.fillStyle = "#040711";
  ctx.fillRect(0, 0, width, height);

  if (state.shake > 0) {
    const sx = (Math.random() - 0.5) * state.shake;
    const sy = (Math.random() - 0.5) * state.shake;
    ctx.translate(sx, sy);
  }

  // Starfield
  for (const s of stars) {
    ctx.fillStyle = `rgba(186, 230, 253, ${0.25 + s.z * 0.35})`;
    ctx.beginPath();
    ctx.arc(s.x % width, s.y % height, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shockwaves
  for (const sw of state.shockwaves) {
    ctx.strokeStyle = `rgba(250, 204, 21, ${sw.alpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Pickups
  for (const pk of state.pickups) {
    ctx.fillStyle = pk.type === "shield" ? "#22c55e" : "#facc15";
    ctx.shadowBlur = 14;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Bullets
  ctx.fillStyle = "#38bdf8";
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#38bdf8";
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Enemies
  for (const e of state.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.strokeStyle = e.color;
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 14;
    ctx.shadowColor = e.color;

    ctx.beginPath();
    const sides = e.kind === "tank" ? 6 : e.kind === "dasher" ? 3 : 4;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const rx = Math.cos(a) * e.radius;
      const ry = Math.sin(a) * e.radius;
      if (i === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Player ship
  const p = state.player;
  if (p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    const blink = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
    if (!blink) {
      ctx.strokeStyle = "#38bdf8";
      ctx.fillStyle = "#0f172a";
      ctx.lineWidth = 2.6;
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#38bdf8";
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-14, -12);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Particles
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function endGame() {
  state.running = false;
  overlayTitle.textContent = "HULL BREACHED";
  overlaySub.textContent = `Final Score: ${Math.floor(state.score).toLocaleString()} • Reached Wave ${state.wave}`;
  startBtn.textContent = "PLAY AGAIN";
  overlay.classList.add("visible");
  updateHud();
}

function loop(timestamp) {
  const dt = Math.min(0.05, (timestamp - state.lastTime) / 1000 || 0);
  state.lastTime = timestamp;

  if (state.running && !state.paused) {
    update(dt);
  }
  draw();
  requestAnimationFrame(loop);
}

startBtn.addEventListener("click", () => {
  sfx.init();
  if (state.running && state.paused) {
    state.paused = false;
    overlay.classList.remove("visible");
    return;
  }
  overlay.classList.remove("visible");
  resetGame();
});

requestAnimationFrame(loop);
