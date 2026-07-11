/* Star Miner: 100 Missions — Game Engine
   All game rendering and simulation are implemented in code.
   No external game assets are used for the asteroid, ship, or particles. */

const CONFIG = {
  resources: {
    iron:     { name: 'Iron',     baseValue: 5,    color: '#8d8d8d' },
    copper:   { name: 'Copper',   baseValue: 12,   color: '#b87333' },
    silver:   { name: 'Silver',   baseValue: 30,   color: '#c0c0c0' },
    gold:     { name: 'Gold',     baseValue: 80,   color: '#ffd700' },
    platinum: { name: 'Platinum', baseValue: 200,  color: '#e5e4e2' },
    uranium:  { name: 'Uranium',  baseValue: 500,  color: '#39ff14' },
    crystal:  { name: 'Crystal',  baseValue: 1200, color: '#ff00ff' }
  },
  resourceOrder: ['iron', 'copper', 'silver', 'gold', 'platinum', 'uranium', 'crystal'],
  upgrades: {
    laser:    { name: 'Mining Laser', baseCost: 50,    costScale: 1.15, basePower: 1,    desc: 'More ore per click' },
    cargo:    { name: 'Cargo Bay',    baseCost: 100,   costScale: 1.18, basePower: 50,   desc: 'More storage capacity' },
    drone:    { name: 'Mining Drone', baseCost: 300,   costScale: 1.20, basePower: 0.5,  desc: 'Passive mining per second' },
    refinery: { name: 'Refinery',     baseCost: 250,   costScale: 1.17, basePower: 0.05, desc: 'Better sell prices' },
    scanner:  { name: 'Deep Scanner', baseCost: 1000,  costScale: 1.25, basePower: 0.02, desc: 'Chance for rare ore' },
    warp:     { name: 'Warp Drive',   baseCost: 5000,  costScale: 2.30, basePower: 1,    desc: 'Unlock new asteroid belts' }
  }
};

const state = {
  credits: 0,
  resources: { iron: 0, copper: 0, silver: 0, gold: 0, platinum: 0, uranium: 0, crystal: 0 },
  allTime: { mined: {}, credits: 0, spent: 0, sold: 0, clicks: 0 },
  upgrades: { laser: 1, cargo: 1, drone: 1, refinery: 1, scanner: 1, warp: 0 },
  activeResource: 'iron',
  missionState: []
};

let canvas, ctx, canvasRect;
let asteroidShape = [];
let particles = [];
let lastTick = 0;
let saveTimer = 0;

/* Utilities */
const fmt = (n) => {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return Number(n.toFixed(2)).toString();
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const getResIndex = (id) => CONFIG.resourceOrder.indexOf(id);

const unlockedResources = () => {
  const lvl = state.upgrades.warp + 1;
  return CONFIG.resourceOrder.slice(0, Math.max(1, lvl));
};

const resourceUnlocked = (id) => unlockedResources().includes(id);

const getUpgradeLevel = (id) => state.upgrades[id] || 0;

const getUpgradeCost = (id) => {
  const up = CONFIG.upgrades[id];
  const lvl = getUpgradeLevel(id);
  return Math.floor(up.baseCost * Math.pow(up.costScale, lvl));
};

const getClickPower = () => {
  const lvl = getUpgradeLevel('laser');
  return Math.floor(1 + lvl * 0.8 + Math.pow(lvl, 1.6));
};

const getCapacity = () => {
  const lvl = getUpgradeLevel('cargo');
  return Math.floor(50 * Math.pow(1.35, lvl - 1) * lvl);
};

const getDroneRate = () => {
  const lvl = getUpgradeLevel('drone');
  return lvl * 0.5 + Math.pow(lvl, 1.4) * 0.1;
};

const getPriceMultiplier = () => {
  const lvl = getUpgradeLevel('refinery');
  return 1 + (lvl - 1) * 0.08;
};

const getRareChance = () => {
  const lvl = getUpgradeLevel('scanner');
  return Math.min(0.5, lvl * 0.025);
};

const totalCargo = () => CONFIG.resourceOrder.reduce((s, r) => s + (state.resources[r] || 0), 0);

const canMine = (amount) => totalCargo() + amount <= getCapacity();

const getResourcePrice = (id) => {
  const base = CONFIG.resources[id].baseValue;
  return Math.floor(base * getPriceMultiplier());
};

const mineResource = (id, amount, source) => {
  const cap = getCapacity();
  const current = totalCargo();
  const free = Math.max(0, cap - current);
  const add = Math.min(amount, free);
  if (add > 0) {
    state.resources[id] = (state.resources[id] || 0) + add;
    state.allTime.mined[id] = (state.allTime.mined[id] || 0) + add;
    if (source !== 'auto') spawnFloatText(`+${fmt(add)} ${CONFIG.resources[id].name}`, source);
  }
  if (add < amount && source !== 'auto') {
    toast('Cargo bay full!', 'danger');
  }
  return add;
};

const pickResource = () => {
  const available = unlockedResources();
  const active = state.activeResource;
  const activeIndex = CONFIG.resourceOrder.indexOf(active);
  if (activeIndex === -1 || !available.includes(active)) return available[0];
  const chance = getRareChance();
  if (Math.random() < chance && activeIndex < available.length - 1) {
    const higher = available.slice(activeIndex + 1);
    const weights = higher.map((r, i) => (i + 1) * 2);
    const sum = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * sum;
    for (let i = 0; i < higher.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return higher[i];
    }
    return higher[higher.length - 1];
  }
  return active;
};

const clickAsteroid = (e) => {
  state.allTime.clicks++;
  const amount = getClickPower();
  const res = pickResource();
  const x = e ? e.clientX - canvasRect.left : canvas.width / 2;
  const y = e ? e.clientY - canvasRect.top : canvas.height / 2;
  mineResource(res, amount, { x, y });
  spawnParticles(x, y, CONFIG.resources[res].color);
  fireLaser(x, y);
  checkMissions();
  render();
};

const autoTick = (dt) => {
  const rate = getDroneRate();
  if (rate <= 0) return;
  const amount = rate * dt;
  const res = pickResource();
  mineResource(res, amount, 'auto');
};

const sellResource = (id) => {
  const amount = state.resources[id] || 0;
  if (amount <= 0) return;
  const price = getResourcePrice(id);
  const value = Math.floor(amount * price);
  state.resources[id] = 0;
  state.credits += value;
  state.allTime.credits += value;
  state.allTime.sold += value;
  toast(`Sold ${fmt(amount)} ${CONFIG.resources[id].name} for ${fmt(value)} credits`);
  checkMissions();
  render();
};

const sellAll = () => {
  const order = CONFIG.resourceOrder;
  let total = 0;
  let count = 0;
  for (const id of order) {
    const amount = state.resources[id] || 0;
    if (amount > 0) {
      const value = Math.floor(amount * getResourcePrice(id));
      state.resources[id] = 0;
      total += value;
      count++;
    }
  }
  if (total > 0) {
    state.credits += total;
    state.allTime.credits += total;
    state.allTime.sold += total;
    toast(`Sold ${count} resources for ${fmt(total)} credits`);
  }
  checkMissions();
  render();
};

const buyUpgrade = (id) => {
  const cost = getUpgradeCost(id);
  if (state.credits < cost) return;
  state.credits -= cost;
  state.allTime.spent += cost;
  state.upgrades[id] = (state.upgrades[id] || 0) + 1;
  if (id === 'warp') {
    const newList = unlockedResources();
    const newRes = newList[newList.length - 1];
    if (newRes && newRes !== 'iron') {
      toast(`Unlocked ${CONFIG.resources[newRes].name} belt!`, 'success');
      if (!resourceUnlocked(state.activeResource)) {
        state.activeResource = newList[0];
      }
    }
  }
  toast(`${CONFIG.upgrades[id].name} upgraded to level ${getUpgradeLevel(id)}`, 'success');
  checkMissions();
  render();
};

/* Mission system */
const initMissions = () => {
  state.missionState = MISSIONS.map((m) => ({ completed: false, claimed: false, progress: 0 }));
};

const missionProgress = (m) => {
  switch (m.type) {
    case 'collect': return state.allTime.mined[m.resource] || 0;
    case 'earn': return state.allTime.credits;
    case 'click': return state.allTime.clicks;
    case 'upgrade': return getUpgradeLevel(m.upgradeId);
    case 'spend': return state.allTime.spent;
    case 'sell': return state.allTime.sold;
    case 'reach': return state.credits;
    case 'allResources': {
      const total = unlockedResources().reduce((s, r) => s + (state.allTime.mined[r] || 0), 0);
      const count = unlockedResources().length;
      return count > 0 ? total / count : 0;
    }
    default: return 0;
  }
};

const checkMissionCondition = (m, ms) => {
  if (m.type === 'allResources') {
    const unlocked = unlockedResources();
    if (unlocked.length === 0) return false;
    return unlocked.every((r) => (state.allTime.mined[r] || 0) >= m.target);
  }
  return missionProgress(m) >= m.target;
};

const checkMissions = () => {
  let newComplete = false;
  for (let i = 0; i < MISSIONS.length; i++) {
    const m = MISSIONS[i];
    const ms = state.missionState[i];
    if (!ms.completed && checkMissionCondition(m, ms)) {
      ms.completed = true;
      newComplete = true;
    }
    ms.progress = missionProgress(m);
  }
  if (newComplete) toast('Mission completed! Claim your reward.', 'success');
};

const claimMission = (index) => {
  const m = MISSIONS[index];
  const ms = state.missionState[index];
  if (!ms.completed || ms.claimed) return;
  state.credits += m.reward;
  ms.claimed = true;
  toast(`Claimed ${fmt(m.reward)} credits: ${m.title}`, 'success');
  render();
};

/* UI rendering */
const render = () => {
  document.getElementById('credit-display').textContent = fmt(state.credits);

  const resourceList = document.getElementById('resource-list');
  resourceList.innerHTML = '';
  for (const id of CONFIG.resourceOrder) {
    if (!resourceUnlocked(id)) continue;
    const cfg = CONFIG.resources[id];
    const amount = state.resources[id] || 0;
    const item = document.createElement('div');
    item.className = 'resource-item';
    item.innerHTML = `
      <div class="resource-info">
        <div class="resource-icon" style="background:${cfg.color}">${id[0].toUpperCase()}</div>
        <div>
          <div class="resource-name">${cfg.name}</div>
          <div class="resource-value">${fmt(amount)} × ${getResourcePrice(id)} cr</div>
        </div>
      </div>
      <button class="sell-btn" ${amount <= 0 ? 'disabled' : ''} data-resource="${id}">Sell</button>
    `;
    resourceList.appendChild(item);
  }

  const capacity = getCapacity();
  const used = totalCargo();
  document.getElementById('capacity-fill').style.width = `${Math.min(100, (used / capacity) * 100)}%`;
  document.getElementById('capacity-text').textContent = `${fmt(used)} / ${fmt(capacity)} units`;

  const beltBar = document.getElementById('belt-bar');
  beltBar.innerHTML = '';
  for (const id of CONFIG.resourceOrder) {
    if (!resourceUnlocked(id)) continue;
    const btn = document.createElement('button');
    btn.className = 'belt-btn' + (state.activeResource === id ? ' active' : '');
    btn.textContent = CONFIG.resources[id].name;
    btn.addEventListener('click', () => {
      state.activeResource = id;
      render();
    });
    beltBar.appendChild(btn);
  }

  const upgradeList = document.getElementById('upgrade-list');
  upgradeList.innerHTML = '';
  for (const id of Object.keys(CONFIG.upgrades)) {
    const up = CONFIG.upgrades[id];
    const lvl = getUpgradeLevel(id);
    const cost = getUpgradeCost(id);
    const item = document.createElement('div');
    item.className = 'upgrade-item';
    let effect = '';
    if (id === 'laser') effect = `+${getClickPower()} per click`;
    if (id === 'cargo') effect = `${fmt(getCapacity())} capacity`;
    if (id === 'drone') effect = `${getDroneRate().toFixed(1)}/sec`;
    if (id === 'refinery') effect = `${(getPriceMultiplier() * 100 - 100).toFixed(0)}% price bonus`;
    if (id === 'scanner') effect = `${(getRareChance() * 100).toFixed(0)}% rare chance`;
    if (id === 'warp') effect = `${unlockedResources().length} belts unlocked`;
    item.innerHTML = `
      <div class="upgrade-header">
        <span class="upgrade-name">${up.name}</span>
        <span class="upgrade-level">Lvl ${lvl}</span>
      </div>
      <div class="upgrade-desc">${up.desc} &mdash; ${effect}</div>
      <div class="upgrade-footer">
        <span class="upgrade-cost">${fmt(cost)} cr</span>
        <button class="buy-btn" data-upgrade="${id}" ${state.credits < cost ? 'disabled' : ''}>Buy</button>
      </div>
    `;
    upgradeList.appendChild(item);
  }

  const missionList = document.getElementById('mission-list');
  missionList.innerHTML = '';
  let shown = 0;
  for (let i = 0; i < MISSIONS.length && shown < 20; i++) {
    const m = MISSIONS[i];
    const ms = state.missionState[i];
    if (ms.claimed) continue;
    shown++;
    const progress = Math.min(1, ms.progress / m.target);
    const item = document.createElement('div');
    item.className = 'mission-item' + (ms.completed ? ' completed' : '') + (ms.claimed ? ' claimed' : '');
    item.innerHTML = `
      <div class="mission-title">${m.title}</div>
      <div class="mission-desc">${m.description}</div>
      <div class="mission-progress">
        <div class="mission-progress-fill ${progress >= 1 ? 'complete' : ''}" style="width:${Math.max(0, progress * 100)}%"></div>
      </div>
      <div class="mission-footer">
        <span class="mission-reward">${fmt(m.reward)} cr</span>
        <button class="claim-btn" data-mission="${i}" ${!ms.completed ? 'disabled' : ''}>${ms.claimed ? 'Claimed' : (ms.completed ? 'Claim' : 'Locked')}</button>
      </div>
    `;
    missionList.appendChild(item);
  }

  document.getElementById('mission-completed').textContent = `${state.missionState.filter((m) => m.completed).length} / 100`;

  document.querySelectorAll('.sell-btn').forEach((btn) => {
    btn.addEventListener('click', () => sellResource(btn.dataset.resource));
  });
  document.querySelectorAll('.buy-btn').forEach((btn) => {
    btn.addEventListener('click', () => buyUpgrade(btn.dataset.upgrade));
  });
  document.querySelectorAll('.claim-btn').forEach((btn) => {
    btn.addEventListener('click', () => claimMission(parseInt(btn.dataset.mission)));
  });
};

/* Canvas visuals */
const generateAsteroidShape = () => {
  const points = [];
  const count = 12;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 80 + Math.random() * 30;
    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
  }
  return points;
};

let asteroidRotation = 0;
let shake = 0;
let laser = null;
let floatTexts = [];

const spawnFloatText = (text, pos) => {
  if (pos === 'auto') return;
  const x = pos ? pos.x : canvas.width / 2;
  const y = pos ? pos.y : canvas.height / 2;
  floatTexts.push({ text, x, y, life: 1.0 });
};

const spawnParticles = (x, y, color) => {
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      color
    });
  }
};

const fireLaser = (tx, ty) => {
  laser = { x: canvas.width / 2, y: 60, tx, ty, life: 0.15 };
  shake = 0.12;
};

const drawAsteroid = () => {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const offsetX = (Math.random() - 0.5) * shake * 20;
  const offsetY = (Math.random() - 0.5) * shake * 20;

  ctx.save();
  ctx.translate(cx + offsetX, cy + offsetY);
  ctx.rotate(asteroidRotation);

  ctx.beginPath();
  for (let i = 0; i < asteroidShape.length; i++) {
    const p = asteroidShape[i];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();

  const grad = ctx.createRadialGradient(-30, -30, 10, 0, 0, 120);
  grad.addColorStop(0, '#5a5a5a');
  grad.addColorStop(0.6, '#2f2f2f');
  grad.addColorStop(1, '#111');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.stroke();

  ctx.restore();
};

const drawShip = () => {
  const cx = canvas.width / 2;
  const y = 60;
  ctx.save();
  ctx.translate(cx, y);
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(14, 14);
  ctx.lineTo(0, 8);
  ctx.lineTo(-14, 14);
  ctx.closePath();
  ctx.fillStyle = '#00d4ff';
  ctx.shadowColor = '#00d4ff';
  ctx.shadowBlur = 15;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
};

const drawParticles = () => {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.02;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
};

const drawLaser = () => {
  if (!laser) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(laser.x, laser.y);
  ctx.lineTo(laser.tx, laser.ty);
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#00d4ff';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
  laser.life -= 0.02;
  if (laser.life <= 0) laser = null;
};

const drawFloatTexts = () => {
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const ft = floatTexts[i];
    ft.y -= 1.5;
    ft.life -= 0.015;
    if (ft.life <= 0) {
      floatTexts.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = ft.life;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
};

const drawStarfield = () => {
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 80; i++) {
    const x = ((i * 37) + Date.now() * 0.002) % canvas.width;
    const y = ((i * 13) % canvas.height);
    const size = (i % 3) + 1;
    const alpha = 0.2 + (i % 7) / 10;
    ctx.globalAlpha = alpha;
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1.0;
};

const drawCanvas = () => {
  if (!canvas || !ctx) return;
  canvasRect = canvas.getBoundingClientRect();
  const w = Math.floor(canvasRect.width);
  const h = Math.floor(canvasRect.height);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  drawStarfield();
  drawShip();
  drawLaser();
  drawAsteroid();
  drawParticles();
  drawFloatTexts();

  asteroidRotation += 0.002;
  if (shake > 0) shake -= 0.01;
  if (shake < 0) shake = 0;

  requestAnimationFrame(drawCanvas);
};

/* Toast notifications */
const toast = (message, type = 'info') => {
  const area = document.getElementById('toast-area');
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.borderColor = type === 'danger' ? 'var(--danger)' : (type === 'success' ? 'var(--success)' : 'var(--accent)');
  el.textContent = message;
  area.appendChild(el);
  setTimeout(() => el.remove(), 3000);
};

/* Save / Load */
const SAVE_KEY = 'star-miner-100-save';

const save = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {}
};

const load = () => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      Object.assign(state, data);
      if (!state.missionState || state.missionState.length !== MISSIONS.length) {
        initMissions();
      }
      if (!state.activeResource || !resourceUnlocked(state.activeResource)) {
        state.activeResource = unlockedResources()[0];
      }
    }
  } catch (e) {
    initMissions();
  }
};

const resetGame = () => {
  if (!confirm('Reset all progress?')) return;
  state.credits = 0;
  state.resources = { iron: 0, copper: 0, silver: 0, gold: 0, platinum: 0, uranium: 0, crystal: 0 };
  state.allTime = { mined: {}, credits: 0, spent: 0, sold: 0, clicks: 0 };
  state.upgrades = { laser: 1, cargo: 1, drone: 1, refinery: 1, scanner: 1, warp: 0 };
  state.activeResource = 'iron';
  initMissions();
  save();
  toast('Progress reset');
  render();
};

/* Game loop */
const loop = (ts) => {
  if (!lastTick) lastTick = ts;
  const dt = (ts - lastTick) / 1000;
  lastTick = ts;

  autoTick(dt);

  saveTimer += dt;
  if (saveTimer >= 5) {
    save();
    saveTimer = 0;
  }

  checkMissions();
  if (Math.floor(ts / 500) !== Math.floor((ts - dt * 1000) / 500)) {
    render();
  }

  requestAnimationFrame(loop);
};

/* Setup */
const init = () => {
  initMissions();
  load();

  canvas = document.getElementById('asteroid-canvas');
  ctx = canvas.getContext('2d');
  canvas.addEventListener('mousedown', clickAsteroid);
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    clickAsteroid({ clientX: touch.clientX, clientY: touch.clientY });
  });

  asteroidShape = generateAsteroidShape();

  document.getElementById('sell-all').addEventListener('click', sellAll);
  document.getElementById('save-btn').addEventListener('click', () => { save(); toast('Game saved'); });
  document.getElementById('reset-btn').addEventListener('click', resetGame);

  render();
  drawCanvas();
  requestAnimationFrame(loop);
};

window.addEventListener('DOMContentLoaded', init);
