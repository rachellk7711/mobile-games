// ---------- input ----------
const Input = {
  keys: {}, dashPressed: false, joy: { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 }, R: 56,
  vec() {
    if (G && G.demo) return G.auto;
    let x = 0, y = 0;
    const k = this.keys;
    if (k.ArrowLeft || k.KeyA) x -= 1; if (k.ArrowRight || k.KeyD) x += 1;
    if (k.ArrowUp || k.KeyW) y -= 1; if (k.ArrowDown || k.KeyS) y += 1;
    if (this.joy.active) {
      const dx = this.joy.x - this.joy.ox, dy = this.joy.y - this.joy.oy, d = Math.hypot(dx, dy);
      if (d > 6) { const m = Math.min(1, (d - 6) / (this.R - 6)); x = dx / d * m; y = dy / d * m; }
    }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y };
  },
};
cv.addEventListener('pointerdown', e => {
  if (!G || G.state !== 'play') return;
  e.preventDefault();
  SFX.init(); // iOS suspends audio when the app is backgrounded; any touch revives it
  if (Input.joy.active) return;
  Input.joy = { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
  try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
}, { passive: false });
cv.addEventListener('pointermove', e => {
  const j = Input.joy;
  if (!j.active || e.pointerId !== j.id) return;
  e.preventDefault();
  j.x = e.clientX; j.y = e.clientY;
  // floating stick: the base trails the thumb when it overshoots
  const dx = j.x - j.ox, dy = j.y - j.oy, d = Math.hypot(dx, dy), R = Input.R * 1.25;
  if (d > R) { j.ox = j.x - dx / d * R; j.oy = j.y - dy / d * R; }
}, { passive: false });
const endJoy = e => { if (Input.joy.active && e.pointerId === Input.joy.id) Input.joy.active = false; };
cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy); cv.addEventListener('lostpointercapture', endJoy);
document.addEventListener('touchmove', e => { if (G && G.state === 'play') e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
const dashBtn = document.getElementById('dash');
dashBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Input.dashPressed = true; }, { passive: false });
window.addEventListener('keydown', e => {
  Input.keys[e.code] = true;
  if (!G) return;
  if (G.state === 'play') {
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { Input.dashPressed = true; e.preventDefault(); }
    if (e.code === 'Escape' || e.code === 'KeyP') pauseGame();
  } else if (G.state === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) resumeGame();
  else if (G.state === 'levelup' && /^Digit[1-3]$/.test(e.code)) { const b = document.querySelectorAll('#cards .card')[+e.code.slice(5) - 1]; if (b) b.click(); }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', e => { Input.keys[e.code] = false; });
window.addEventListener('blur', () => { Input.keys = {}; Input.joy.active = false; });

// ---------- game state ----------
let G = null;
const xpFor = l => Math.round(5 + l * 3.4 + Math.pow(l, 1.6));
function newGame(demo = false) {
  G = {
    state: demo ? 'menu' : 'play', demo, auto: { x: 0, y: 0 }, t: 0, depth: 0, player: newPlayer(),
    enemies: [], shots: [], eshots: [], orbs: [], pulses: [], bolts: [], warns: [], beams: [], lights: [], timers: [],
    boss: null, bossIdx: 0, grid: new Grid(72), spawnAcc: 0, level: 1, xp: 0, xpNext: xpFor(1), pendingLevels: 0,
    hitstop: 0, vacuum: 0, hpScale: 1, dmgScale: 1, zone: ZONES[0], stats: { kills: 0, dealt: 0, damageTaken: 0, bosses: 0 },
    rerolls: 1, showDmg: true, deadT: 0, endShown: false, moved: false, finale: undefined, nextMile: 2000,
  };
  if (demo) { applyUpgrade(G.player, 'drone'); applyUpgrade(G.player, 'sonar'); G.player.lightR = 190; }
  FX.init(); BG.init();
  V.camX = 0; V.camY = 0;
  Input.joy.active = false; Input.dashPressed = false;
}

function gainXp(v) {
  if (G.demo) return;
  G.xp += v;
  while (G.xp >= G.xpNext) { G.xp -= G.xpNext; G.level++; G.xpNext = xpFor(G.level); G.pendingLevels++; }
}

// ---------- update ----------
function update(dt) {
  G.t += dt;
  const p = G.player;
  // descent; halts while a boss is alive or waiting
  if (G.demo) {
    G.depth = (1 - Math.cos(G.t * 0.06)) * 0.5 * 5200;
    const a = G.t * 0.35;
    G.auto = { x: Math.cos(a) * 0.55, y: Math.sin(a * 1.3) * 0.55 };
  } else if (!G.boss) {
    const nb = BOSSES[G.bossIdx];
    const z = zoneAt(G.depth);
    const rate = (z.to - z.from) / z.secs;
    G.depth = Math.min(FINAL_DEPTH, G.depth + rate * dt);
    if (nb && G.depth >= nb.depth) { G.depth = nb.depth; spawnBoss(nb); }
  }
  const z = zoneAt(G.depth);
  if (z !== G.zone) {
    G.zone = z;
    if (!G.demo && !G.boss) showBanner(z.en, z.name, `${fmt(z.from)} – ${fmt(z.to)} m · 수온 ${z.temp[0]}°C`, false, 2.6);
  }
  if (!G.demo && G.depth >= G.nextMile) {
    if (!BOSSES.some(b => b.depth === G.nextMile) && !ZONES.some(z => z.from === G.nextMile) && !G.boss) {
      showBanner('DEPTH', fmt(G.nextMile) + ' m 통과', `수압 ${fmt(1 + G.nextMile / 10.06)} 기압 · 선체가 삐걱입니다`, false, 2.2);
      SFX.creak(); FX.shake(3);
    }
    G.nextMile += 1000;
  }
  G.hpScale = 1 + G.depth / 2100 + G.t / 700;
  G.dmgScale = 1 + G.depth / 9000;
  G.vacuum = Math.max(0, G.vacuum - dt);

  // broad-phase grid of creatures
  G.grid.clear();
  for (const e of G.enemies) if (!e.dead) G.grid.insert(e, e.x, e.y, e.r);

  updatePlayer(p, dt);
  if (!G.demo || G.enemies.length < 14) spawnTick(G.demo ? dt * 0.5 : dt);
  updateEnemies(dt);
  updateBoss(dt);
  updateShots(dt);
  updateEnemyShots(dt);
  updateOrbs(dt);
  updateWarns(dt);
  updateTimers(dt);
  for (let i = G.lights.length - 1; i >= 0; i--) { G.lights[i].life -= dt; if (G.lights[i].life <= 0) G.lights.splice(i, 1); }
  BG.update(dt, G.boss ? 0 : (G.demo ? 30 : (z.to - z.from) / z.secs));

  // camera: lead slightly in the direction of travel
  const lx = p.x + p.vx * 0.25, ly = p.y + p.vy * 0.25;
  V.camX += (lx - V.camX) * Math.min(1, dt * 5);
  V.camY += (ly - V.camY) * Math.min(1, dt * 5);

  if (G.demo) { p.hp = p.maxHp; }
  else if (G.pendingLevels > 0 && G.state === 'play' && G.finale === undefined) openLevelUp();
}

// ---------- render ----------
function worldXf(c, scale) {
  c.setTransform(scale, 0, 0, scale, (V.w / 2 - V.camX + V.shakeX) * scale, (V.h / 2 - V.camY + V.shakeY) * scale);
}
function onScreen(x, y, m) { return Math.abs(x - V.camX) < V.w / 2 + m && Math.abs(y - V.camY) < V.h / 2 + m; }

function renderLight(oc) {
  let dark = oc.dark;
  const b = G.boss;
  if (b && b.kind === 'angler' && b.lureOff > 0) dark = Math.min(0.985, dark + 0.05);
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.globalAlpha = 1;
  lctx.clearRect(0, 0, lightCv.width, lightCv.height);
  if (dark < 0.02) return false;
  lctx.fillStyle = rgba(oc.tint, dark);
  lctx.fillRect(0, 0, lightCv.width, lightCv.height);
  lctx.globalCompositeOperation = 'destination-out';
  worldXf(lctx, LS);
  const L = Spr.light;
  const lit = (x, y, r, a) => { if (!onScreen(x, y, r)) return; lctx.globalAlpha = a; lctx.drawImage(L, x - r, y - r, r * 2, r * 2); };
  const p = G.player;
  const blackout = b && b.kind === 'angler' && b.lureOff > 0 ? 0.55 : 1;
  lit(p.x, p.y, p.lightR * blackout, 1);
  lctx.save(); lctx.translate(p.x, p.y); lctx.rotate(p.face);
  lctx.globalAlpha = blackout;
  lctx.drawImage(Spr.cone, 4, -p.coneLen / 2, p.coneLen, p.coneLen);
  lctx.restore();
  for (const d of dronePositions(p)) lit(d.x, d.y, 75, 0.7);
  for (const s of G.shots) lit(s.x, s.y, s.kind === 'torp' ? 70 : 30, s.kind === 'torp' ? 0.8 : 0.45);
  for (const l of G.lights) lit(l.x, l.y, l.r, l.life / l.max);
  for (const pu of G.pulses) { const k = 1 - pu.r / pu.rmax; lit(pu.x, pu.y, pu.r * 1.1, 0.25 * k); }
  for (const s of G.eshots) lit(s.x, s.y, 34, 0.45);
  if (V.quality) for (const o of G.orbs) lit(o.x, o.y, 22, 0.35);
  for (const e of G.enemies) {
    if (e.type === 'angler') lit(e.x + Math.cos(e.face) * e.r * 1.2, e.y + Math.sin(e.face) * e.r * 1.2, 70, 0.55);
    else if (e.type === 'jelly' || e.type === 'siph') lit(e.x, e.y, e.r * 2.5, 0.35);
    else if (e.reveal > 0) lit(e.x, e.y, e.r * 2.5, 0.5 * Math.min(1, e.reveal));
  }
  if (b && !b.dead) {
    if (b.kind === 'angler' && b.lureOff <= 0) { const q = anglerLure(b); lit(q.x, q.y, 280, 0.9); }
    else if (b.kind === 'lord') { lit(b.x, b.y, 240, 0.6); for (let i = 0; i < b.seg.length; i += 4) lit(b.seg[i].x, b.seg[i].y, 90, 0.35); }
    else if (b.kind === 'siph') { lit(b.x, b.y, 120, 0.6); for (let i = 0; i < b.seg.length; i += 3) lit(b.seg[i].x, b.seg[i].y, 60, 0.4); }
    else lit(b.x, b.y, 140, 0.35);
  }
  for (const be of G.beams) for (let t = 0; t < be.len; t += 120) lit(be.x + Math.cos(be.a) * t, be.y + Math.sin(be.a) * t, 90, 0.7);
  lctx.globalAlpha = 1;
  lctx.globalCompositeOperation = 'source-over';
  return true;
}

function render() {
  const c = ctx, dpr = V.dpr;
  const oc = oceanAt(G.depth);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  BG.draw(c, oc);
  BG.drawSnow(c, oc);

  worldXf(c, dpr);
  FX.drawNormal(c);
  const m = 80;
  for (const e of G.enemies) if (onScreen(e.x, e.y, m + (e.seg ? 160 : 0))) drawEnemy(c, e);
  if (G.boss) drawBoss(c, G.boss);
  drawShots(c);
  if (G.state !== 'dead' || G.deadT < 0.15) drawPlayer(c, G.player);

  // darkness with light cut-outs
  if (renderLight(oc)) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.drawImage(lightCv, 0, 0, V.w, V.h);
  }

  // bioluminescence on top of the dark
  worldXf(c, dpr);
  c.globalCompositeOperation = 'lighter';
  drawOrbs(c);
  for (const e of G.enemies) if (onScreen(e.x, e.y, m + (e.seg ? 160 : 0))) drawEnemyGlow(c, e);
  if (G.boss) drawBossGlow(c, G.boss);
  if (G.state !== 'dead') drawPlayerGlow(c, G.player);
  drawShotsGlow(c);
  drawEnemyShots(c);
  drawBeams(c);
  FX.drawAdd(c);
  c.globalCompositeOperation = 'source-over';
  drawWarns(c);
  FX.drawTexts(c);

  // screen-space post
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (G.finale !== undefined) drawSeabed(c, clamp((G.t - G.finale) / 4, 0, 1));
  if (vignetteCv) c.drawImage(vignetteCv, 0, 0, V.w, V.h);
  const p = G.player;
  const low = !G.demo && G.state === 'play' && p.hp / p.maxHp < 0.3 ? (0.18 + 0.12 * Math.sin(G.t * 6)) : 0;
  const fa = Math.max(FX.flash, low);
  if (fa > 0.01) {
    const g = c.createRadialGradient(V.w / 2, V.h / 2, Math.min(V.w, V.h) * 0.3, V.w / 2, V.h / 2, Math.hypot(V.w, V.h) * 0.6);
    g.addColorStop(0, rgba(FX.flashCol, 0)); g.addColorStop(1, rgba(FX.flashCol, fa));
    c.fillStyle = g; c.fillRect(0, 0, V.w, V.h);
  }
  if (!G.demo && crackCv && (G.state === 'play' || G.state === 'dead')) {
    const ca = G.state === 'dead' ? 1 : clamp((0.45 - p.hp / p.maxHp) / 0.35, 0, 1);
    if (ca > 0) { c.globalAlpha = ca * 0.8; c.drawImage(crackCv, 0, 0, V.w, V.h); c.globalAlpha = 1; }
  }
  drawHint(c);
  if (G.boss && G.boss.kind === 'lord' && G.boss.phase >= 3) { c.fillStyle = `rgba(120,60,200,${0.05 + 0.03 * Math.sin(G.t * 2)})`; c.fillRect(0, 0, V.w, V.h); }
  // joystick
  const j = Input.joy;
  if (j.active && G.state === 'play') {
    c.strokeStyle = 'rgba(111,243,224,.35)'; c.lineWidth = 2; c.fillStyle = 'rgba(3,11,18,.25)';
    c.beginPath(); c.arc(j.ox, j.oy, Input.R, 0, TAU); c.fill(); c.stroke();
    const v = Input.vec();
    c.fillStyle = 'rgba(111,243,224,.55)';
    c.beginPath(); c.arc(j.ox + v.x * Input.R, j.oy + v.y * Input.R, 22, 0, TAU); c.fill();
  }
  // off-screen boss pointer
  if (G.boss && !G.boss.dead && G.state === 'play') {
    const b = G.boss, sx = b.x - V.camX + V.w / 2, sy = b.y - V.camY + V.h / 2;
    if (sx < 0 || sx > V.w || sy < 0 || sy > V.h) {
      const a = Math.atan2(sy - V.h / 2, sx - V.w / 2);
      const ex = clamp(V.w / 2 + Math.cos(a) * V.w, 24, V.w - 24), ey = clamp(V.h / 2 + Math.sin(a) * V.h, 90, V.h - 110);
      c.save(); c.translate(ex, ey); c.rotate(a);
      c.fillStyle = `rgba(255,184,77,${0.6 + 0.4 * Math.sin(G.t * 8)})`;
      c.beginPath(); c.moveTo(14, 0); c.lineTo(-6, -9); c.lineTo(-2, 0); c.lineTo(-6, 9); c.closePath(); c.fill();
      c.restore();
    }
  }
}

// ---------- HUD ----------
const $ = id => document.getElementById(id);
const hudCache = {};
function setStyleTop(id, v) { if (hudCache['top' + id] !== v) { hudCache['top' + id] = v; const el = $(id); if (el) el.style.top = v; } }
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHud() {
  const p = G.player;
  setText('hDepth', fmt(G.depth));
  setText('hZone', G.zone.name);
  setText('hPress', fmt(1 + G.depth / 10.06) + ' atm');
  setText('hTemp', oceanAt(G.depth).temp.toFixed(1) + ' °C');
  setText('hLvl', 'LV ' + G.level);
  setText('hHpT', Math.ceil(p.hp) + '/' + p.maxHp);
  const hpF = clamp(p.hp / p.maxHp, 0, 1);
  $('hHp').style.transform = `scaleX(${hpF})`;
  $('hHpBar').classList.toggle('ok', hpF > 0.35);
  $('hXp').style.transform = `scaleX(${clamp(G.xp / G.xpNext, 0, 1)})`;
  const dk = p.dashCd / p.dashMax;
  $('dashRing').setAttribute('stroke-dashoffset', String(245 * dk));
  dashBtn.classList.toggle('cool', dk > 0);
  setStyleTop('dMe', (G.depth / FINAL_DEPTH * 100).toFixed(1) + '%');
  if (G.boss) $('bossHp').style.transform = `scaleX(${clamp(G.boss.hp / G.boss.maxHp, 0, 1)})`;
}
// vertical depth track: zone bands to scale, boss markers, current position
function buildGauge() {
  const g = $('dgauge'); g.innerHTML = '';
  for (const z of ZONES) { const i = document.createElement('i'); i.style.height = ((z.to - z.from) / FINAL_DEPTH * 100) + '%'; i.style.background = rgba(mix(z.top, [255, 255, 255], 0.15)); g.appendChild(i); }
  for (const b of BOSSES) { const m = document.createElement('b'); m.style.top = (b.depth / FINAL_DEPTH * 100) + '%'; g.appendChild(m); }
  const me = document.createElement('em'); me.id = 'dMe'; g.appendChild(me);
}
function updateWeaponChips() {
  const p = G.player, el = $('weapons');
  el.innerHTML = '';
  for (const id in p.weapons) {
    const d = document.createElement('div'); d.className = 'wchip';
    d.innerHTML = `${UPG[id].name} <b>${p.weapons[id].lvl}</b>`;
    el.appendChild(d);
  }
}

let bannerTimer = 0;
function showBanner(t1, t2, t3, warn, dur) {
  $('bn1').textContent = t1; $('bn2').textContent = t2; $('bn3').textContent = t3;
  const b = $('banner'); b.classList.toggle('warn', !!warn); b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), dur * 1000);
}

// ---------- screens ----------
function showScreen(id) {
  for (const s of ['scrMenu', 'scrLevel', 'scrPause', 'scrEnd', 'scrCodex']) $(s).hidden = s !== id;
}

function drawIcon(c, id, col) {
  const s = c.canvas.width, m = s / 2;
  c.clearRect(0, 0, s, s);
  c.save(); c.translate(m, m); c.scale(s / 52, s / 52);
  c.globalCompositeOperation = 'lighter';
  drawGlow(c, 0, 0, 30, col, 0.35);
  c.globalCompositeOperation = 'source-over';
  c.strokeStyle = rgba(mix(col, [255, 255, 255], 0.4)); c.fillStyle = rgba(mix(col, [255, 255, 255], 0.4));
  c.lineWidth = 2.4; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath();
  switch (id) {
    case 'harpoon': c.moveTo(-13, 13); c.lineTo(11, -11); c.stroke(); c.beginPath(); c.moveTo(14, -14); c.lineTo(4, -12); c.lineTo(12, -4); c.closePath(); c.fill(); break;
    case 'sonar': for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(-10, 0, i * 7, -0.7, 0.7); c.stroke(); } c.beginPath(); c.arc(-10, 0, 2.5, 0, TAU); c.fill(); break;
    case 'drone': c.arc(0, 0, 11, 0, TAU); c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]); for (let i = 0; i < 3; i++) { const a = i * TAU / 3; c.beginPath(); c.arc(Math.cos(a) * 11, Math.sin(a) * 11, 3.5, 0, TAU); c.fill(); } break;
    case 'torpedo': c.ellipse(0, 0, 13, 5, -0.6, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(-9, 9); c.lineTo(-15, 15); c.stroke(); break;
    case 'arc': c.moveTo(-12, -14); c.lineTo(-2, -2); c.lineTo(-8, 0); c.lineTo(6, 14); c.lineTo(2, 2); c.lineTo(10, 0); c.lineTo(2, -14); c.stroke(); break;
    case 'hull': c.moveTo(0, -14); c.lineTo(12, -8); c.lineTo(10, 6); c.lineTo(0, 14); c.lineTo(-10, 6); c.lineTo(-12, -8); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 6); c.moveTo(-6, 0); c.lineTo(6, 0); c.stroke(); break;
    case 'plating': for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); } c.closePath(); c.stroke(); c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.lineTo(Math.cos(a) * 6, Math.sin(a) * 6); } c.closePath(); c.stroke(); break;
    case 'thruster': c.moveTo(-4, -12); c.lineTo(6, -12); c.lineTo(6, 12); c.lineTo(-4, 12); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(-8, -6); c.lineTo(-16, 0); c.lineTo(-8, 6); c.stroke(); break;
    case 'lamp': c.arc(-10, 0, 4, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-6, -2); c.lineTo(14, -12); c.moveTo(-6, 2); c.lineTo(14, 12); c.stroke(); break;
    case 'magnet': c.arc(0, 0, 10, Math.PI, 0, true); c.moveTo(-10, 0); c.lineTo(-10, -10); c.moveTo(10, 0); c.lineTo(10, -10); c.stroke(); break;
    case 'repair': c.moveTo(-10, 10); c.lineTo(6, -6); c.stroke(); c.beginPath(); c.arc(8, -8, 5, 0, TAU); c.stroke(); break;
    case 'reactor': c.ellipse(0, 0, 13, 5, 0, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(0, 0, 13, 5, 1.05, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(0, 0, 13, 5, -1.05, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, 2.5, 0, TAU); c.fill(); break;
    case 'warhead': for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); c.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); } c.stroke(); break;
    default: c.moveTo(0, -10); c.lineTo(0, 10); c.moveTo(-10, 0); c.lineTo(10, 0); c.stroke();
  }
  c.restore();
}

let levelOpts = [], levelOpenAt = 0;
const LEVEL_LOCK_MS = 450; // a steering thumb that lands on a card mid-fight shouldn't pick it
function openLevelUp(reroll = false) {
  G.state = 'levelup';
  Input.joy.active = false;
  if (!reroll) SFX.levelup();
  levelOpts = rollUpgrades(G.player, 3);
  const box = $('cards'); box.innerHTML = '';
  levelOpenAt = performance.now();
  box.classList.add('locked');
  setTimeout(() => box.classList.remove('locked'), LEVEL_LOCK_MS);
  $('lvK').textContent = `LEVEL ${G.level - G.pendingLevels + 1}`;
  levelOpts.forEach((id, i) => {
    const b = document.createElement('button');
    if (id === '_heal') {
      b.className = 'card';
      b.innerHTML = `<canvas width="104" height="104"></canvas><div><div class="nm">긴급 수리</div><div class="ds">내구도를 50 회복합니다.</div></div>`;
      drawIcon(b.querySelector('canvas').getContext('2d'), 'hull', COL.green);
    } else {
      const u = UPG[id], l = lvlOf(G.player, id) + 1;
      b.className = 'card' + (u.kind === 'w' ? ' wpn' : '');
      b.innerHTML = `<canvas width="104" height="104"></canvas><div><div class="nm">${u.name} ${l === 1 ? '<span class="nw">NEW</span>' : `<span class="lv">LV ${l}</span>`}</div><div class="ds">${u.desc(l)}</div></div>`;
      drawIcon(b.querySelector('canvas').getContext('2d'), id, u.col);
    }
    b.addEventListener('click', () => chooseUpgrade(id));
    box.appendChild(b);
    void i;
  });
  $('rerollN').textContent = G.rerolls;
  $('btnReroll').disabled = G.rerolls <= 0;
  $('btnReroll').style.opacity = G.rerolls > 0 ? 1 : 0.4;
  showScreen('scrLevel');
}
function chooseUpgrade(id) {
  if (G.state !== 'levelup' || performance.now() - levelOpenAt < LEVEL_LOCK_MS) return;
  SFX.init();
  if (id === '_heal') G.player.hp = Math.min(G.player.maxHp, G.player.hp + 50);
  else applyUpgrade(G.player, id);
  SFX.pick();
  G.pendingLevels--;
  updateWeaponChips();
  if (G.pendingLevels > 0) { openLevelUp(); return; }
  G.state = 'play'; G.player.inv = Math.max(G.player.inv, 0.8);
  showScreen(null);
}
$('btnReroll').addEventListener('click', () => { if (G.rerolls > 0 && G.state === 'levelup' && performance.now() - levelOpenAt >= LEVEL_LOCK_MS) { G.rerolls--; openLevelUp(true); } });

function statsHtml(rows) { return rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join(''); }
function timeStr(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; }

function pauseGame() {
  if (!G || G.state !== 'play') return;
  G.state = 'pause'; Input.joy.active = false;
  $('pauseStats').innerHTML = statsHtml([['현재 수심', fmt(G.depth) + ' m'], ['잠항 시간', timeStr(G.t)], ['처치', fmt(G.stats.kills)], ['레벨', G.level]]);
  showScreen('scrPause');
}
function resumeGame() { if (G.state !== 'pause') return; SFX.init(); G.state = 'play'; showScreen(null); last = performance.now(); }

function gameOver(win) {
  if (G.state === 'dead' || G.state === 'win') return;
  G.state = win ? 'win' : 'dead'; G.deadT = 0; G.deadAt = performance.now();
  Input.joy.active = false;
  const p = G.player;
  if (!win) {
    SFX.breach(); FX.shake(22); FX.hurtFlash(0.9);
    FX.burst(p.x, p.y, COL.lure, 40, 420, 1.0, 6);
    FX.burst(p.x, p.y, COL.white, 20, 300, 0.6, 5);
    FX.bubbles(p.x, p.y, 40, 160);
    for (let i = 0; i < 14; i++) FX.spawn({ x: p.x, y: p.y, vx: rand(-200, 200), vy: rand(-200, 200), life: rand(0.8, 1.4), size: rand(3, 7), col: [180, 100, 40], kind: 'chunk', add: false, vr: rand(-10, 10), drag: 2 });
  } else SFX.win();
  const best = store.get('best', { depth: 0, cleared: false, clearTime: 0 });
  const isNew = G.depth > best.depth + 0.5 || (win && (!best.cleared || G.t < best.clearTime));
  if (G.depth > best.depth) best.depth = G.depth;
  if (win) { if (!best.cleared || G.t < best.clearTime) best.clearTime = G.t; best.cleared = true; }
  store.set('best', best);
  G.endInfo = { win, isNew, best };
}
function showEnd() {
  const { win, isNew, best } = G.endInfo;
  $('endK').textContent = win ? 'CHALLENGER DEEP' : 'HULL BREACH';
  $('endH').textContent = win ? '해연 바닥 도달' : '선체 붕괴';
  $('endLede').textContent = win
    ? `수압 1,087 기압을 견디고 지구에서 가장 깊은 곳에 닿았습니다. 1960년 트리에스테호가 처음 내려갔던 길입니다.`
    : `${fmt(G.depth)} m, ${G.zone.name}에서 수압 ${fmt(1 + G.depth / 10.06)} 기압을 버티지 못했습니다.`;
  $('endStats').innerHTML = statsHtml([['도달 수심', fmt(G.depth) + ' m'], ['잠항 시간', timeStr(G.t)], ['처치한 생물', fmt(G.stats.kills)], ['격퇴한 보스', G.stats.bosses + ' / 4'], ['최종 레벨', G.level], ['가한 피해', fmt(G.stats.dealt)]]);
  $('endBest').textContent = isNew ? '새 기록' : `최고 기록 ${fmt(best.depth)} m${best.cleared ? ' · 최단 완주 ' + timeStr(best.clearTime) : ''}`;
  showScreen('scrEnd');
  $('hud').hidden = true; $('boss').hidden = true;
}

function startRun() {
  SFX.init();
  newGame(false);
  $('hud').hidden = false; $('boss').hidden = true;
  showScreen(null);
  updateWeaponChips();
  showBanner(ZONES[0].en, ZONES[0].name, '잠항을 시작합니다 · 0 – 200 m', false, 2.6);
  hudCache.hZone = null;
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); } catch (e) { /* optional */ }
  last = performance.now();
}
function toMenu() {
  newGame(true);
  $('hud').hidden = true; $('boss').hidden = true;
  refreshBest();
  showScreen('scrMenu');
}
function refreshBest() {
  const best = store.get('best', null);
  $('bestLine').textContent = best && best.depth > 0 ? `최고 기록 ${fmt(best.depth)} m${best.cleared ? ' · 최단 완주 ' + timeStr(best.clearTime) : ''}` : '';
}

$('btnStart').addEventListener('click', startRun);
$('btnCodex').addEventListener('click', openCodex);
$('btnCodexBack').addEventListener('click', () => showScreen('scrMenu'));
$('btnRetry').addEventListener('click', startRun);
$('btnMenu').addEventListener('click', toMenu);
$('btnPause').addEventListener('click', pauseGame);
$('btnResume').addEventListener('click', resumeGame);
$('btnQuit').addEventListener('click', () => { if (G.state === 'pause') { G.state = 'play'; showScreen(null); gameOver(false); G.deadT = 1.2; } });
function setToggle(id, on, onTxt, offTxt) { const b = $(id); b.classList.toggle('on', on); b.textContent = on ? onTxt : offTxt; }
$('tgSound').addEventListener('click', () => { SFX.on = !SFX.on; store.set('sound', SFX.on); setToggle('tgSound', SFX.on, '켜짐', '꺼짐'); });
$('tgShake').addEventListener('click', () => { FX.shakeOn = !FX.shakeOn; store.set('shake', FX.shakeOn); setToggle('tgShake', FX.shakeOn, '켜짐', '꺼짐'); });
$('tgQuality').addEventListener('click', () => { V.quality = V.quality ? 0 : 1; store.set('quality', V.quality); setToggle('tgQuality', !!V.quality, '높음', '절약'); resize(); BG.init(); });
SFX.on = store.get('sound', true);
setToggle('tgSound', SFX.on, '켜짐', '꺼짐'); setToggle('tgShake', FX.shakeOn, '켜짐', '꺼짐'); setToggle('tgQuality', !!V.quality, '높음', '절약');
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- main loop ----------
let last = performance.now();
let fpsAcc = 0, fpsN = 0, slowStreak = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (!(dt > 0)) dt = 0;
  dt = Math.min(dt, 0.05);
  // adaptive quality: drop to the lighter preset if the phone struggles for ~4 s
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 2) { const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (fps < 40 && V.quality && G && G.state === 'play') { if (++slowStreak >= 2) { V.quality = 0; resize(); BG.init(); setToggle('tgQuality', false, '높음', '절약'); } } else slowStreak = 0; }
  try {
    if (G.state === 'play' || G.state === 'menu') {
      if (G.hitstop > 0) G.hitstop -= dt;
      else { const steps = dt > 0.025 ? 2 : 1; for (let i = 0; i < steps; i++) update(dt / steps); }
      FX.update(dt);
    } else if (G.state === 'dead' || G.state === 'win') {
      G.deadT += dt; FX.update(dt); BG.update(dt, 0);
      if (G.state === 'win') { updateEnemies(dt * 0.3); }
      if ((G.deadT > 1.6 || performance.now() - G.deadAt > 1700) && !G.endShown) { G.endShown = true; showEnd(); }
    }
    render();
    if (G.state === 'play') updateHud();
    SFX.setAmbient(G.depth, G.state === 'play' || G.state === 'levelup' || G.state === 'pause');
  } catch (err) {
    console.error(err);
  }
}

function boot() {
  resize();
  buildGauge();
  toMenu();
  requestAnimationFrame(t => { last = t; frame(t); });
}
try { window.claude?.hot?.snapshot?.(() => ({ quality: V.quality })); } catch (e) { /* viewer hook optional */ }
if (window.claude?.hot?.ready) window.claude.hot.ready(boot); else boot();
