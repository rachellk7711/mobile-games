// ---------- input: press-and-hold anywhere ----------
const Input = {
  ptrs: new Set(), keys: new Set(), get down() { return this.ptrs.size > 0 || this.keys.size > 0 || !!this.bot; }, bot: false,
};
cv.addEventListener('pointerdown', e => {
  if (!G || G.state !== 'play') return;
  e.preventDefault(); SFX.init();
  Input.ptrs.add(e.pointerId);
  try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
}, { passive: false });
const ptrUp = e => Input.ptrs.delete(e.pointerId);
cv.addEventListener('pointerup', ptrUp); cv.addEventListener('pointercancel', ptrUp); cv.addEventListener('lostpointercapture', ptrUp);
document.addEventListener('touchmove', e => { if (G && G.state === 'play') e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if (!G) return;
  if (G.state === 'play' && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW')) { Input.keys.add(e.code); e.preventDefault(); SFX.init(); }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') pauseGame(); else if (G.state === 'pause') resumeGame(); }
});
window.addEventListener('keyup', e => Input.keys.delete(e.code));
window.addEventListener('blur', () => { Input.ptrs.clear(); Input.keys.clear(); });

// ---------- state ----------
let G = null;
function newGame(mode, demo = false) {
  const daily = mode === 'daily';
  const seed = daily ? hashStr('mukseon-' + todayKey()) : (Math.random() * 1e9) | 0;
  G = {
    state: demo ? 'menu' : 'play', demo, daily, seed, t: 0, player: newPlayer(), anchors: [], items: [], hazards: [],
    inkY: 420, inkSlow: 0, maxH: 0, score: 0, blossoms: 0, combo: 0, maxCombo: 0, grabs: 0, step: -1, target: null,
    biome: BIOMES[0], flashT: 0, newSeals: [], fragileSafe: 0, windX: 0, nextMile: 100, deadAt: 0, endShown: false, cause: '',
  };
  BGC.seed = seed; BGC.clear();
  Gen.reset(seed);
  G.anchors.push(makeAnchor('knot', W / 2, -70, mulberry32(seed + 1)));
  Gen.ensure(-1200);
  FX.init();
  V.camY = G.player.y - V.viewH * 0.6;
  Input.ptrs.clear(); Input.keys.clear(); Input.bot = false; // the menu autopilot must not leak into a real run
}

function update(dt) {
  G.t += dt;
  const p = G.player;
  const m = Math.max(0, -p.y / M);
  if (m > G.maxH) G.maxH = m;
  const pal = paletteAt(G.maxH);
  // biome change
  if (pal.b !== G.biome) {
    G.biome = pal.b;
    if (!G.demo) { showBanner(pal.b.en, pal.b.name, pal.b.poem, pal.b.night, 2.8); SFX.milestone(); }
  }
  if (!G.demo && G.maxH >= G.nextMile) {
    if (G.nextMile % 500 === 0) { FX.word(p.x, p.y - 40, fmt(G.nextMile) + ' m', true, true); SFX.milestone(); }
    G.nextMile += 100;
  }
  G.windX = pal.storm > 0.5 ? Math.sin(G.t * 0.35) * 140 + Math.sin(G.t * 1.3) * 40 : 0;
  if (G.state === 'play') Seals.check();
  Gen.ensure(V.camY - 900);
  updateAnchors(dt);
  if (G.state === 'play' || G.state === 'menu') updatePlayer(p, dt);
  else stepPlayer(p, dt);
  updateHazards(dt);
  // the ink rises: slow at first, faster with height, and it catches up if you dawdle far ahead
  if (!G.demo && G.state === 'play') {
    const started = G.grabs > 0 || G.t > 3;
    let v = started ? Math.min(170, 40 + G.maxH * 0.04) : 0;
    const gap = G.inkY - p.y;
    if (gap > 650) v += (gap - 650) * 0.8;
    if (G.inkSlow > 0) { G.inkSlow -= dt; v *= 0.35; }
    G.inkY -= v * dt;
  } else if (G.demo) { G.inkY = Math.max(G.inkY - 20 * dt, p.y + 520); }
  // prune what has sunk
  const cut = G.inkY + 400;
  if (G.anchors.length > 80) G.anchors = G.anchors.filter(a => a.y < cut || (p.rope && p.rope.a === a));
  if (G.items.length > 120) G.items = G.items.filter(i => !i.got && i.y < cut);
  if (G.hazards.length > 40) G.hazards = G.hazards.filter(h => !h.dead);
  // camera
  const target = p.y - V.viewH * 0.6;
  V.camY += (target - V.camY) * Math.min(1, dt * (target < V.camY ? 5 : 3));
  V.camY = Math.min(V.camY, G.inkY - V.viewH * 0.25);
  G.flashT = Math.max(0, G.flashT - dt);
  FX.updateWeather(dt, pal);
  SFX.setWind(Math.hypot((p.x - p.px) / STEP, (p.y - p.py) / STEP), G.state === 'play', pal.storm > 0.5);
  // random lightning flashes in the storm (harmless, for atmosphere)
  if (pal.storm > 0.5 && Math.random() < dt * 0.15) { G.flashT = 0.18; SFX.thunder(); }
}

function die(cause) {
  if (G.state !== 'play') return;
  const p = G.player;
  G.state = 'dead'; G.cause = cause; G.deadAt = performance.now();
  if (p.rope) p.rope = null;
  Input.ptrs.clear(); Input.keys.clear();
  FX.shake(cause === 'ink' ? 6 : 12);
  if (cause === 'ink') { FX.inkBurst(p.x, G.inkY, 30, 2); SFX.splash(); }
  else { SFX.hit(); FX.inkBurst(p.x, p.y, 18, 1.4, true); p.px = p.x - (p.x - p.px) * 0.3; p.py = p.y + 400 * STEP; }
  if (G.daily && cause !== 'quit') Seals.unlock('daily');
  Seals.check();
  const key = G.daily ? 'daily-' + todayKey() : 'best';
  const best = store.get(key, 0);
  G.isNew = G.maxH > best + 0.5;
  if (G.isNew) store.set(key, Math.floor(G.maxH));
  G.best = Math.max(best, Math.floor(G.maxH));
  if (!G.daily) { const total = store.get('blossoms', 0); store.set('blossoms', total + G.blossoms); }
}

// ---------- render ----------
let vignette = null;
function buildVignette() {
  vignette = document.createElement('canvas');
  const w = vignette.width = 200, h = vignette.height = 200, c = vignette.getContext('2d');
  const g = c.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
  g.addColorStop(0, 'rgba(60,45,30,0)'); g.addColorStop(1, 'rgba(60,45,30,0.35)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}
buildVignette();

function render() {
  const c = ctx, pal = paletteAt(G.maxH);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.fillStyle = '#2a2622'; c.fillRect(0, 0, cv.width, cv.height);
  drawBackground(c, pal);
  // clip the world to the scroll strip
  c.save();
  c.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  c.beginPath(); c.rect(V.ox, 0, W * V.scale, V.h); c.clip();
  worldXf(c);
  drawItems(c, pal);
  drawHazards(c, pal);
  drawAnchors(c, pal);
  drawRope(c, G.player, pal);
  if (G.state !== 'dead' || G.player.y < G.inkY + 20) drawPlayer(c, G.player, pal);
  FX.draw(c, pal);
  drawInk(c, pal);
  drawHint(c, pal);
  drawPaperOverlay(c, pal);
  worldXf(c);
  FX.drawWords(c, pal);
  c.restore();
  FX.drawWeather(c, pal);
  c.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  if (G.flashT > 0) { c.fillStyle = `rgba(255,252,240,${G.flashT * 2.5})`; c.fillRect(V.ox, 0, W * V.scale, V.h); }
  c.globalAlpha = 1;
  c.drawImage(vignette, V.ox, 0, W * V.scale, V.h);
  // ink proximity: the bottom edge darkens as the ink closes in
  const gap = (G.inkY - G.player.y);
  if (G.state === 'play' && gap < 260) {
    const a = clamp(1 - gap / 260, 0, 1) * 0.55, g = c.createLinearGradient(0, V.h * 0.6, 0, V.h);
    g.addColorStop(0, 'rgba(11,10,9,0)'); g.addColorStop(1, `rgba(11,10,9,${a})`);
    c.fillStyle = g; c.fillRect(V.ox, V.h * 0.6, W * V.scale, V.h * 0.4);
  }
  drawMounting(c);
  drawUnroll(c);
}

function drawHint(c, pal) {
  if (G.demo || G.grabs > 0 || G.state !== 'play') return;
  const a = G.anchors[0], p = G.player;
  const k = 0.6 + 0.4 * Math.sin(G.t * 5);
  c.globalAlpha = k;
  c.fillStyle = '#b3261e'; c.font = '26px "Nanum Brush Script", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('꾹 누르고 있으세요', W / 2, p.y + 60);
  c.font = '15px "Gowun Batang", serif'; c.fillStyle = rgba(pal.ink, 0.8);
  c.fillText('붉은 원의 매듭에 먹줄이 걸립니다', W / 2, p.y + 86);
  c.globalAlpha = 1;
  void a;
}

// ---------- HUD & screens ----------
const $ = id => document.getElementById(id);
const hud = {};
function setText(id, v) { if (hud[id] !== v) { hud[id] = v; $(id).textContent = v; } }
function updateHud() {
  const pal = paletteAt(G.maxH);
  setText('hH', fmt(Math.floor(G.maxH)));
  setText('hSub', `${pal.b.name} · 매화 ${G.blossoms}${G.daily ? ' · 오늘의 족자' : ''}`);
  const night = pal.night > 0.5;
  if (hud.night !== night) { hud.night = night; $('hud').classList.toggle('night', night); }
  const cmb = G.combo > 1 ? `연속 ${G.combo}` : '';
  if (hud.combo !== cmb) { hud.combo = cmb; $('hCombo').textContent = cmb; $('hCombo').classList.toggle('on', !!cmb); }
}
function updatePows() {
  const p = G.player, el = $('hPows'); let h = '';
  h += `<span class="lives" aria-label="남은 낙관 ${p.lives}">${'<i class="on"></i>'.repeat(Math.max(0, p.lives))}${'<i></i>'.repeat(Math.max(0, 3 - p.lives))}</span>`;
  if (p.shield) h += `<span class="pow"><i>符</i><b>${p.shield}</b></span>`;
  if (p.feather) h += `<span class="pow"><i style="background:#1b1a17">羽</i><b>${p.feather}</b></span>`;
  el.innerHTML = h;
}
let bannerT = 0;
function showBanner(a, b, c2, night, dur) {
  $('bn1').textContent = a; $('bn2').textContent = b; $('bn3').textContent = c2;
  const el = $('banner'); el.classList.toggle('night', !!night); el.classList.add('show');
  clearTimeout(bannerT); bannerT = setTimeout(() => el.classList.remove('show'), dur * 1000);
}
function showScreen(id) { for (const s of ['scrMenu', 'scrPause', 'scrEnd', 'scrSeals']) $(s).hidden = s !== id; }

function startRun(mode) {
  SFX.init();
  newGame(mode);
  $('hud').hidden = false; showScreen(null);
  for (const k in hud) delete hud[k];
  updatePows();
  showBanner(G.daily ? '오늘의 족자 · ' + todayKey() : BIOMES[0].en, BIOMES[0].name, BIOMES[0].poem, false, 2.4);
  last = performance.now();
}
function toMenu() {
  newGame('normal', true);
  $('hud').hidden = true; showScreen('scrMenu');
  const best = store.get('best', 0), daily = store.get('daily-' + todayKey(), 0);
  $('bestLine').textContent = [best ? `최고 ${fmt(best)} m` : '', daily ? `오늘의 족자 ${fmt(daily)} m` : ''].filter(Boolean).join(' · ');
}
function pauseGame() { if (G.state !== 'play') return; G.state = 'pause'; Input.ptrs.clear(); Input.keys.clear(); showScreen('scrPause'); }
function resumeGame() { if (G.state !== 'pause') return; SFX.init(); G.state = 'play'; showScreen(null); last = performance.now(); }
const CAUSE = {
  ink: '차오르는 먹물에 잠겼습니다.', crow: '까마귀와 부딪혀 떨어졌습니다.', spirit: '먹귀신에 닿아 손을 놓쳤습니다.',
  bolt: '번개가 먹줄을 끊었습니다.', rock: '굴러떨어진 바위에 맞았습니다.', quit: '붓을 내려놓았습니다.',
};
function showEnd() {
  $('endK').textContent = G.cause === 'ink' ? '먹물에 잠기다' : '떨어지다';
  $('endH').textContent = fmt(Math.floor(G.maxH)) + ' m';
  $('endNew').hidden = !G.isNew;
  $('endLede').textContent = `${biomeAt(G.maxH).name}에서 ${CAUSE[G.cause] || ''}`;
  const rows = [['도달 높이', fmt(Math.floor(G.maxH)) + ' m'], ['모은 매화', G.blossoms], ['최대 연속', G.maxCombo], ['먹줄을 건 횟수', G.grabs]];
  $('endStats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('endBest').textContent = (G.daily ? `오늘의 족자 최고 ${fmt(G.best)} m` : `최고 기록 ${fmt(G.best)} m`) + (G.newSeals.length ? ` · 새 낙관 ${G.newSeals.join(', ')}` : '');
  showScreen('scrEnd'); $('hud').hidden = true;
}

$('btnStart').addEventListener('click', () => startRun('normal'));
$('btnDaily').addEventListener('click', () => startRun('daily'));
$('btnSeals').addEventListener('click', openSeals);
$('btnSealsBack').addEventListener('click', () => showScreen('scrMenu'));
$('btnRetry').addEventListener('click', () => startRun(G && G.daily ? 'daily' : 'normal'));
$('btnMenu').addEventListener('click', toMenu);
$('btnPause').addEventListener('click', pauseGame);
$('btnResume').addEventListener('click', resumeGame);
$('btnQuit').addEventListener('click', () => { if (G.state === 'pause') { G.state = 'play'; showScreen(null); die('quit'); } });
function setToggle(id, on) { const b = $(id); b.classList.toggle('on', on); b.textContent = on ? '켜짐' : '꺼짐'; }
$('tgSound').addEventListener('click', () => { SFX.on = !SFX.on; store.set('sound', SFX.on); setToggle('tgSound', SFX.on); });
$('tgShake').addEventListener('click', () => { FX.shakeOn = !FX.shakeOn; store.set('shake', FX.shakeOn); setToggle('tgShake', FX.shakeOn); });
SFX.on = store.get('sound', true); setToggle('tgSound', SFX.on); setToggle('tgShake', FX.shakeOn);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// attract mode on the menu: a simple autopilot climbs behind the title
function demoPilot() {
  const p = G.player;
  if (p.rope) { const v = vel(p); Input.bot = !(v.y < -650 || p.rope.L <= LMIN + 2 || p.y < p.rope.a.y - 10); }
  else { const v = vel(p); Input.bot = v.y > -120 && !!findTarget(p); }
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (!(dt > 0)) dt = 0; dt = Math.min(dt, 0.05);
  try {
    if (G.state === 'menu') { demoPilot(); update(dt); if (G.player.y > G.inkY - 30) newGame('normal', true); }
    else if (G.state === 'play') update(dt);
    else if (G.state === 'dead') { update(dt); if (performance.now() - G.deadAt > 1500 && !G.endShown) { G.endShown = true; showEnd(); } }
    if (G.state !== 'menu') Input.bot = false;
    FX.update(dt);
    render();
    if (G.state === 'play') updateHud();
  } catch (err) { console.error(err); }
}

function boot() { resize(); toMenu(); requestAnimationFrame(t => { last = t; frame(t); }); }
if (window.claude?.hot?.ready) window.claude.hot.ready(boot); else boot();
