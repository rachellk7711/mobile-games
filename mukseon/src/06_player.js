// ---------- climber, ink rope physics, anchors/hazards/items ----------
const GRAV = 1650, REEL = 340, LMIN = 44, STEP = 1 / 120;
const SEAL = hex('#b3261e'), GOLD = hex('#b8913e');

function newPlayer() {
  const p = { x: W / 2, y: 20, px: W / 2, py: 20, r: 9, rope: null, face: 1, scarf: [], shield: 0, lives: 3, trail: [], feather: 0, flash: 0, lastGrab: null, airT: 0, spin: 0, grabT: 0 };
  for (let i = 0; i < 9; i++) p.scarf.push({ x: p.x, y: p.y, px: p.x, py: p.y });
  return p;
}
const vel = p => ({ x: (p.x - p.px) / STEP, y: (p.y - p.py) / STEP });

// the anchor the rope would catch right now
function findTarget(p) {
  let best = null, bs = -Infinity;
  for (const a of G.anchors) {
    if (a.broken || a.used > 0 || a.y > p.y + 70) continue;
    const d = dist(p.x, p.y, a.x, a.y);
    if (d > ROPE_R) continue;
    const s = (p.y - a.y) - Math.abs(a.x - p.x) * 0.35 - (d > ROPE_R * 0.85 ? 40 : 0) - (a.haunted ? 70 : 0);
    if (s > bs) { bs = s; best = a; }
  }
  return best;
}

function attach(p, a) {
  p.rope = { a, L: Math.max(LMIN, dist(p.x, p.y, a.x, a.y)), t: 0 };
  p.grabT = 0;
  G.grabs++;
  G.step = (G.step + 1) % 15;
  SFX.grab(G.step);
  FX.inkBurst(a.x, a.y, 6, 0.6);
  FX.ring(a.x, a.y, 4, 22, 0.3);
}
function release(p, auto) {
  const r = p.rope; if (!r) return;
  r.a.used = 0.35;
  if (!auto && r.a.type === 'fragile') G.fragileSafe++;
  p.rope = null;
  const v = vel(p);
  let grade = 0;
  if (!auto) grade = v.y < -1000 ? 3 : v.y < -720 ? 2 : v.y < -450 ? 1 : 0;
  if (p.feather > 0 && !auto) {
    // crane feather: an extra upward gust on release
    const vy = Math.min(v.y, 0) - 520;
    p.px = p.x - v.x * STEP; p.py = p.y - vy * STEP; p.feather--;
    updatePows();
    FX.feathers(p.x, p.y);
    grade = Math.max(grade, 2);
  }
  if (grade >= 1) {
    G.combo = grade >= 2 ? G.combo + 1 : Math.max(1, G.combo);
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    const words = ['', '좋음', '명필', '일필휘지'];
    FX.word(p.x, p.y - 26, words[grade] + (G.combo > 1 ? ' ×' + G.combo : ''), grade >= 3);
    if (grade >= 2) { FX.inkBurst(p.x, p.y + 8, 10, 0.9); Seals.unlock('master'); }
    if (grade >= 3) Seals.unlock('onestroke');
  } else if (!auto) G.combo = 0;
  SFX.release(grade);
  p.spin = v.x * 0.004;
}

function stepPlayer(p, dt) {
  // Verlet integration in fixed sub-steps for a stable pendulum
  let acc = dt;
  while (acc > 1e-6) {
    const h = Math.min(STEP, acc); acc -= h;
    const vx = (p.x - p.px) * 0.9995, vy = (p.y - p.py) * 0.9995;
    p.px = p.x; p.py = p.y;
    p.x += vx * (h / STEP) + (p.rope ? 0 : (G.windX || 0) * 0.5 * h * STEP); p.y += vy * (h / STEP) + GRAV * h * STEP;
    if (p.rope) {
      const r = p.rope, a = r.a;
      r.t += h;
      r.L = Math.max(LMIN, r.L - REEL * h);
      const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (d > r.L) { p.x = a.x + dx / d * r.L; p.y = a.y + dy / d * r.L; }
    }
    // scroll edges: cliff faces bounce the climber back
    const m = 14;
    if (p.x < m) { const v = p.x - p.px; p.x = m; p.px = p.x + v * 0.45; }
    if (p.x > W - m) { const v = p.x - p.px; p.x = W - m; p.px = p.x + v * 0.45; }
    // terminal velocity
    const fy = p.y - p.py; if (fy > 1400 * STEP) p.py = p.y - 1400 * STEP;
  }
}

function updatePlayer(p, dt) {
  const holding = Input.down;
  p.flash = Math.max(0, p.flash - dt);
  if (p.rope) {
    const a = p.rope.a;
    p.grabT += dt;
    if (a.type === 'fragile') {
      a.hold += dt;
      if (a.hold > 0.55 && Math.random() < dt * 30) FX.dust(a.x, a.y);
      if (a.hold > 1.0) { a.broken = true; SFX.snap(); FX.inkBurst(a.x, a.y, 14, 1.2, true); FX.word(a.x, a.y - 16, '뚝', false, true); release(p, true); }
    }
    if (p.rope && !holding) release(p, false);
  } else if (holding) {
    const t = findTarget(p);
    if (t) attach(p, t);
  }
  G.target = p.rope ? null : findTarget(p);
  stepPlayer(p, dt);
  const v = vel(p);
  if (Math.abs(v.x) > 30) p.face = v.x > 0 ? 1 : -1;
  if (!p.rope) { p.airT += dt; } else p.airT = 0;
  // ink trail: a fading brush stroke behind fast flight
  const sp = Math.hypot(v.x, v.y);
  if (!p.rope && sp > 380) { p.trail.push({ x: p.x, y: p.y + 2, t: G.t }); if (p.trail.length > 14) p.trail.shift(); }
  else if (p.trail.length) p.trail.shift();
  // scarf: a short verlet chain trailing from the neck
  const nx = p.x - p.face * 2, ny = p.y - 6;
  p.scarf[0].x = nx; p.scarf[0].y = ny;
  for (let i = 1; i < p.scarf.length; i++) {
    const s = p.scarf[i], vx = (s.x - s.px) * 0.9, vy = (s.y - s.py) * 0.9;
    s.px = s.x; s.py = s.y; s.x += vx + Math.sin(G.t * 6 + i) * 0.25 - (G.windX || 0) * 0.02; s.y += vy + 0.25;
  }
  for (let k = 0; k < 2; k++) for (let i = 1; i < p.scarf.length; i++) {
    const a = p.scarf[i - 1], b = p.scarf[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, L = 4.2;
    const f = (d - L) / d; b.x -= dx * f; b.y -= dy * f;
  }
  // collectibles
  for (const it of G.items) {
    if (it.got) continue;
    it.t += dt;
    const rr = it.kind === 'blossom' ? 18 : 22;
    if (dist2(it.x, it.y, p.x, p.y) < rr * rr) collect(it);
  }
  // falling into the ink
  if (p.y > G.inkY - 4) {
    if (p.shield > 0) {
      p.shield--; p.py = p.y + 1300 * STEP; p.flash = 0.6; G.inkY += 220;
      FX.inkBurst(p.x, p.y, 24, 1.6); FX.word(p.x, p.y - 30, '부적이 막았다', true, true); SFX.hit(); FX.shake(10);
    } else die('ink');
  }
}

function collect(it) {
  it.got = true;
  const p = G.player;
  if (it.kind === 'blossom') {
    G.blossoms++; G.score += 10 * Math.max(1, G.combo);
    SFX.blossom(G.blossoms);
    FX.petals(it.x, it.y, 6);
  } else {
    SFX.power();
    FX.ring(it.x, it.y, 6, 40, 0.5, true);
    if (it.kind === 'charm') { p.shield = Math.min(2, p.shield + 1); FX.word(it.x, it.y - 20, '부적', true, true); }
    if (it.kind === 'feather') { p.feather = 3; FX.word(it.x, it.y - 20, '학의 깃털 ×3', true, true); }
    if (it.kind === 'inkstick') { G.inkY += 420; G.inkSlow = 6; FX.word(it.x, it.y - 20, '먹이 물러났다', true, true); }
    updatePows();
  }
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return dist(px, py, ax + dx * t, ay + dy * t);
}

function hitPlayer(src) {
  const p = G.player;
  if (p.flash > 0 || G.state !== 'play') return;
  if (p.shield > 0) {
    p.shield--; p.flash = 1.0; FX.shake(8); SFX.hit();
    FX.inkBurst(p.x, p.y, 16, 1.2, true); FX.word(p.x, p.y - 26, '부적이 막았다', true, true);
    updatePows();
    return;
  }
  p.lives--;
  updatePows();
  if (p.lives <= 0) { die(src); return; }
  // knocked loose: lose the rope, tumble, brief grace period
  p.flash = 1.4; FX.shake(10); SFX.hit();
  if (p.rope) release(p, true);
  p.py = p.y - 250 * STEP; p.px = p.x - (p.x - p.px) * 0.3;
  FX.inkBurst(p.x, p.y, 16, 1.2, true);
  FX.word(p.x, p.y - 26, '낙관 하나를 잃었다', false, true);
  G.combo = 0;
}

// ---------- hazards ----------
function updateHazards(dt) {
  const p = G.player;
  for (const h of G.hazards) {
    if (h.dead) continue;
    if (h.kind === 'crow') {
      // wait until the climber is near its altitude, then fly across
      if (!h.armed) { if (Math.abs(p.y - h.baseY) < V.viewH * 0.7) { h.armed = true; h.warnT = 1.0; SFX.crow(); } else continue; }
      if (h.warnT > 0) { h.warnT -= dt; continue; }
      h.t += dt; h.x += h.dir * h.speed * dt; h.y = h.baseY + Math.sin(h.t * 3) * 18;
      if (dist2(h.x, h.y, p.x, p.y) < 18 * 18) hitPlayer('crow');
      if (h.x < -100 || h.x > W + 100) h.dead = true;
    } else if (h.kind === 'spirit') {
      h.a += h.w * dt; h.x = h.anchor.x + Math.cos(h.a) * h.R; h.y = h.anchor.y + Math.sin(h.a) * h.R * 0.85;
      if (dist2(h.x, h.y, p.x, p.y) < 14 * 14) hitPlayer('spirit');
      // a spirit crossing the ink line bites through it
      else if (p.rope && segDist(h.x, h.y, p.x, p.y - 7, p.rope.a.x, p.rope.a.y) < 9) {
        FX.inkBurst(h.x, h.y, 10, 0.9); FX.word(h.x, h.y - 18, '끊겼다', false, true); SFX.snap();
        release(p, true);
      }
      if (h.anchor.y > G.inkY + 200) h.dead = true;
    } else if (h.kind === 'bolt') {
      if (h.state === 'idle' && Math.abs(p.y - h.y) < V.viewH * 0.45) { h.state = 'warn'; h.t = 0; }
      if (h.state === 'warn') { h.t += dt; if (h.t > 1.1) { h.state = 'strike'; h.t = 0; SFX.thunder(); G.flashT = 0.25; FX.shake(9); if (Math.abs(p.x - h.x) < h.w / 2 + 6 && Math.abs(p.y - h.y) < V.viewH) hitPlayer('bolt'); } }
      else if (h.state === 'strike') { h.t += dt; if (h.t > 0.35) h.dead = true; }
    } else if (h.kind === 'rock') {
      if (!h.armed) { if (p.y < h.triggerY) { h.armed = true; h.y = V.camY - 60; h.warnT = 0.9; } else continue; }
      if (h.warnT > 0) { h.warnT -= dt; h.y = V.camY - 60; continue; }
      h.vy += 900 * dt; h.y += h.vy * dt; h.rot += dt * 3;
      if (dist2(h.x, h.y, p.x, p.y) < 20 * 20) hitPlayer('rock');
      if (h.y > G.inkY) { h.dead = true; FX.inkBurst(h.x, G.inkY, 8, 0.8); }
    }
  }
}

// ---------- drawing ----------
function drawAnchors(c, pal) {
  const night = pal.night > 0.5, ink = rgba(pal.ink);
  const top = V.camY - 40, bot = V.camY + V.viewH + 40;
  for (const a of G.anchors) {
    if (a.y < top || a.y > bot || a.broken) continue;
    const near = G.target === a;
    if (a.type === 'crane') { drawCrane(c, a, pal); }
    else if (night && a.type !== 'fragile') {
      // a paper lantern hanging from a short cord
      c.globalCompositeOperation = 'lighter'; glow(c, a.x, a.y + 6, 30, [255, 170, 80], 0.6); c.globalCompositeOperation = 'source-over';
      c.strokeStyle = 'rgba(30,25,20,.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(a.x, a.y - 10); c.lineTo(a.x, a.y - 2); c.stroke();
      c.fillStyle = '#c95a28'; c.beginPath(); c.ellipse(a.x, a.y + 6, 7, 9, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,225,160,.95)'; c.beginPath(); c.ellipse(a.x, a.y + 6, 3.5, 6, 0, 0, TAU); c.fill();
      c.fillStyle = '#1b1a17'; c.fillRect(a.x - 4, a.y - 3, 8, 2); c.fillRect(a.x - 4, a.y + 14, 8, 2);
    } else if (a.type === 'fragile') {
      // a cinnabar talisman nailed in place; it shakes as it gives way
      const sh = a.hold > 0.4 ? Math.sin(G.t * 60) * a.hold * 2.5 : 0;
      c.save(); c.translate(a.x + sh, a.y); c.rotate(Math.sin(a.t * 2) * 0.08);
      c.fillStyle = '#e6c46a'; c.fillRect(-7, -4, 14, 24);
      c.strokeStyle = '#b3261e'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-3, 0); c.lineTo(3, 4); c.lineTo(-3, 8); c.lineTo(3, 12); c.lineTo(-2, 17); c.stroke();
      c.fillStyle = '#b3261e'; c.beginPath(); c.arc(0, -2, 3.2, 0, TAU); c.fill();
      if (a.hold > 0.3) { c.strokeStyle = 'rgba(27,26,23,.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-7, 6); c.lineTo(-1, 9); c.lineTo(-4, 14); c.lineTo(2, 18); c.stroke(); }
      c.restore();
    } else {
      // pine knot: a gnarled stub with a ring of paper rope
      c.fillStyle = ink;
      c.beginPath(); c.ellipse(a.x, a.y, 6.5, 5, 0.3, 0, TAU); c.fill();
      brush(c, [{ x: a.x - 3, y: a.y + 2 }, { x: a.x - 14, y: a.y + 10 }, { x: a.x - 22, y: a.y + 12 }], 4, 1, ink, 0.9, false);
      c.strokeStyle = night ? '#e8dcc0' : '#efe7d4'; c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(a.x, a.y, 4, 3, 0.3, 0, TAU); c.stroke();
    }
    if (near) {
      // target ring: a red brush circle, open at the top like an ensō
      const pulse = 1 + Math.sin(G.t * 8) * 0.08;
      c.strokeStyle = 'rgba(179,38,30,.85)'; c.lineWidth = 2.2;
      c.beginPath(); c.arc(a.x, a.y, 16 * pulse, -1.2, Math.PI * 1.6); c.stroke();
    }
  }
}

function drawCrane(c, a, pal) {
  c.save(); c.translate(a.x, a.y); c.scale(a.dir, 1);
  const flap = Math.sin(a.t * 7);
  c.fillStyle = '#f4f1e8'; c.strokeStyle = '#1b1a17'; c.lineWidth = 1.2;
  c.beginPath(); c.ellipse(0, 0, 13, 5, 0, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-4, -2); c.quadraticCurveTo(-10, -18 * flap - 4, -26, -14 * flap - 6); c.lineTo(-12, 2); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#1b1a17'; c.beginPath(); c.moveTo(-22, -12 * flap - 5); c.lineTo(-26, -14 * flap - 6); c.lineTo(-18, -9 * flap - 2); c.fill();
  c.strokeStyle = '#1b1a17'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(11, -1); c.quadraticCurveTo(18, -8, 22, -7); c.stroke();
  c.fillStyle = '#b3261e'; c.beginPath(); c.arc(21, -8, 2, 0, TAU); c.fill(); // red crown of the red-crowned crane
  c.strokeStyle = '#1b1a17'; c.lineWidth = 1; c.beginPath(); c.moveTo(-10, 2); c.lineTo(-20, 6); c.moveTo(-10, 3); c.lineTo(-19, 9); c.stroke();
  c.restore();
}

function drawRope(c, p, pal) {
  if (!p.rope) return;
  const a = p.rope.a, hx = p.x + p.face * 3, hy = p.y - 7;
  const d = dist(hx, hy, a.x, a.y), slack = Math.max(0, p.rope.L - d), n = 10, pts = [];
  // brief throw animation, then a taut (or slightly sagging) ink line
  const k = Math.min(1, p.rope.t / 0.06);
  for (let i = 0; i <= n; i++) {
    const t = i / n * k;
    pts.push({ x: lerp(hx, a.x, t), y: lerp(hy, a.y, t) + Math.sin(t * Math.PI) * slack * 0.5 });
  }
  brush(c, pts, 3.2, 1.4, rgba(pal.night > 0.5 ? [20, 18, 16] : pal.ink), 0.95);
}

function drawPlayer(c, p, pal) {
  const v = vel(p), night = pal.night > 0.5;
  const inkC = night ? '#0d0c0b' : rgba(pal.ink);
  // moonlit halo so the figure reads against a dark sky
  if (night) { c.globalCompositeOperation = 'lighter'; glow(c, p.x, p.y - 3, 34, [150, 150, 140], 0.55); c.globalCompositeOperation = 'source-over'; }
  if (p.flash > 0 && Math.floor(G.t * 18) % 2 === 0) c.globalAlpha = 0.45;
  if (p.trail.length > 2) brush(c, p.trail, 0.5, 7, night ? 'rgba(10,10,12,1)' : rgba(pal.ink), night ? 0.5 : 0.28, true);
  // scarf
  brush(c, p.scarf, 4.5, 1.5, '#b3261e', 0.95, false);
  c.save(); c.translate(p.x, p.y);
  const lean = p.rope ? Math.atan2(p.rope.a.x - p.x, -(p.rope.a.y - p.y)) * 0.6 : clamp(v.x * 0.0012, -0.6, 0.6) + p.spin * Math.min(1, p.airT * 3);
  c.rotate(lean);
  // robe: a single wet stroke
  c.fillStyle = inkC;
  c.beginPath(); c.moveTo(-6, -4); c.quadraticCurveTo(-9, 6, -7, 11); c.lineTo(7, 11); c.quadraticCurveTo(9, 4, 6, -4); c.closePath(); c.fill();
  if (night) { c.strokeStyle = 'rgba(230,222,200,.75)'; c.lineWidth = 1; c.stroke(); }
  // legs tucked or trailing
  c.strokeStyle = inkC; c.lineWidth = 2.6; c.lineCap = 'round';
  const tuck = p.rope ? 0 : clamp(-v.y / 900, -0.3, 1);
  c.beginPath(); c.moveTo(-3, 10); c.lineTo(-4 - tuck * 3, 16 - tuck * 4); c.moveTo(3, 10); c.lineTo(5 + tuck * 2, 16 - tuck * 5); c.stroke();
  // head and gat (horsehair hat)
  c.fillStyle = night ? '#e2d6bd' : '#efe7d4';
  c.beginPath(); c.arc(0, -9, 4.6, 0, TAU); c.fill();
  c.strokeStyle = inkC; c.lineWidth = 1.1; c.stroke();
  c.fillStyle = inkC;
  c.beginPath(); c.ellipse(0, -13.5, 9.5, 1.8, 0, 0, TAU); c.fill();
  c.fillRect(-3.4, -19, 6.8, 5.5);
  // arm reaching to the rope
  c.restore();
  if (p.rope) {
    c.strokeStyle = inkC; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(p.x, p.y - 2); c.lineTo(p.x + p.face * 3, p.y - 7); c.stroke();
  }
  c.globalAlpha = 1;
  if (p.shield > 0) {
    c.strokeStyle = 'rgba(184,145,62,.7)'; c.lineWidth = 1.5;
    for (let i = 0; i < p.shield; i++) { c.beginPath(); c.arc(p.x, p.y - 2, 19 + i * 5, G.t * 2 + i, G.t * 2 + i + Math.PI * 1.4); c.stroke(); }
  }
}

function drawHazards(c, pal) {
  const ink = rgba(pal.ink);
  for (const h of G.hazards) {
    if (h.dead) continue;
    if (h.kind === 'crow') {
      if (!h.armed) continue;
      if (h.warnT > 0) {
        // warning: a red brush "!" at the entry edge
        const ex = h.dir > 0 ? 18 : W - 18, ey = clamp(h.baseY, V.camY + 60, V.camY + V.viewH - 60);
        c.globalAlpha = 0.5 + 0.5 * Math.sin(G.t * 20);
        c.fillStyle = '#b3261e'; c.font = '700 26px "Nanum Brush Script", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('!', ex, ey);
        c.globalAlpha = 1;
        continue;
      }
      c.save(); c.translate(h.x, h.y); c.scale(h.dir, 1);
      const f = Math.sin(h.t * 14);
      c.fillStyle = pal.night > 0.5 ? '#050505' : ink;
      c.beginPath(); c.ellipse(0, 0, 10, 4.5, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(-2, -1); c.quadraticCurveTo(-6, -14 * f, -16, -12 * f); c.lineTo(-6, 2); c.fill();
      c.beginPath(); c.moveTo(9, -2); c.lineTo(15, 0); c.lineTo(9, 1); c.fill();
      c.beginPath(); c.moveTo(-9, 0); c.lineTo(-16, -3); c.lineTo(-15, 3); c.fill();
      c.fillStyle = '#d9b44a'; c.beginPath(); c.arc(6, -1.5, 1, 0, TAU); c.fill();
      c.restore();
    } else if (h.kind === 'spirit') {
      // ink wisp with a tail
      c.globalAlpha = 0.85;
      splat(c, h.x, h.y, 13, 0.9, false, G.t * 2);
      c.fillStyle = '#efe7d4'; c.beginPath(); c.arc(h.x - 3, h.y - 2, 1.8, 0, TAU); c.arc(h.x + 3, h.y - 2, 1.8, 0, TAU); c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = rgba(pal.ink, 0.2); c.lineWidth = 1; c.setLineDash([3, 5]);
      c.beginPath(); c.ellipse(h.anchor.x, h.anchor.y, h.R, h.R * 0.85, 0, 0, TAU); c.stroke(); c.setLineDash([]);
    } else if (h.kind === 'bolt') {
      const top = V.camY - 20, bot = V.camY + V.viewH + 20;
      if (h.state === 'warn') {
        c.fillStyle = `rgba(179,38,30,${0.08 + 0.12 * (h.t / 1.1)})`; c.fillRect(h.x - h.w / 2, top, h.w, bot - top);
        c.strokeStyle = `rgba(179,38,30,${0.3 + 0.4 * Math.sin(G.t * 25) ** 2})`; c.lineWidth = 1.5; c.setLineDash([6, 6]);
        c.strokeRect(h.x - h.w / 2, top, h.w, bot - top); c.setLineDash([]);
      } else if (h.state === 'strike') {
        const pts = []; let x = h.x;
        for (let y = top; y <= bot; y += 30) { x = h.x + rand(-12, 12); pts.push({ x, y }); }
        c.globalCompositeOperation = 'lighter';
        brush(c, pts, 9, 4, 'rgba(255,250,230,1)', 1 - h.t / 0.35, false);
        c.globalCompositeOperation = 'source-over';
        brush(c, pts, 3, 1.5, '#1b1a17', 1 - h.t / 0.35, false);
      }
    } else if (h.kind === 'rock') {
      if (!h.armed) continue;
      if (h.warnT > 0) {
        c.fillStyle = `rgba(179,38,30,${0.5 + 0.5 * Math.sin(G.t * 20)})`;
        c.beginPath(); c.moveTo(h.x, V.camY + 34); c.lineTo(h.x - 8, V.camY + 18); c.lineTo(h.x + 8, V.camY + 18); c.closePath(); c.fill();
        continue;
      }
      c.save(); c.translate(h.x, h.y); c.rotate(h.rot);
      c.fillStyle = ink; c.beginPath();
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, rr = 14 + Math.sin(i * 2.7) * 4; i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(239,231,212,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-6, -4); c.lineTo(4, -8); c.stroke();
      c.restore();
    }
  }
}

function drawItems(c, pal) {
  const top = V.camY - 30, bot = V.camY + V.viewH + 30;
  for (const it of G.items) {
    if (it.got || it.y < top || it.y > bot) continue;
    const bob = Math.sin(it.t * 2.5) * 3;
    if (it.kind === 'blossom') {
      // five-petal plum blossom
      c.save(); c.translate(it.x, it.y + bob); c.rotate(it.t * 0.6);
      c.fillStyle = pal.night > 0.5 ? '#f3d6dc' : '#e8a3b0';
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; c.beginPath(); c.arc(Math.cos(a) * 4.2, Math.sin(a) * 4.2, 3.6, 0, TAU); c.fill(); }
      c.fillStyle = '#b3261e'; c.beginPath(); c.arc(0, 0, 1.8, 0, TAU); c.fill();
      c.restore();
    } else {
      c.save(); c.translate(it.x, it.y + bob);
      c.globalCompositeOperation = pal.night > 0.5 ? 'lighter' : 'source-over';
      glow(c, 0, 0, 30, pal.night > 0.5 ? [220, 180, 90] : [255, 240, 200], pal.night > 0.5 ? 0.5 : 0.8);
      c.globalCompositeOperation = 'source-over';
      if (it.kind === 'charm') {
        c.rotate(Math.sin(it.t * 2) * 0.15);
        c.fillStyle = '#e6c46a'; c.fillRect(-7, -11, 14, 22);
        c.strokeStyle = '#b3261e'; c.lineWidth = 1.5; c.strokeRect(-5, -9, 10, 18);
        c.fillStyle = '#b3261e'; c.font = '700 11px "Gowun Batang", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('符', 0, 0);
      } else if (it.kind === 'feather') {
        c.rotate(-0.6 + Math.sin(it.t * 2) * 0.2);
        c.fillStyle = '#f7f4ec'; c.strokeStyle = '#1b1a17'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(0, 12); c.quadraticCurveTo(-8, 0, 0, -13); c.quadraticCurveTo(8, 0, 0, 12); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(0, 12); c.lineTo(0, -12); c.stroke();
        c.fillStyle = '#1b1a17'; c.beginPath(); c.moveTo(0, -13); c.quadraticCurveTo(4, -9, 3, -6); c.lineTo(0, -8); c.fill();
      } else if (it.kind === 'inkstick') {
        c.rotate(0.4);
        c.fillStyle = '#1b1a17'; c.fillRect(-4, -12, 8, 24);
        c.fillStyle = '#b8913e'; c.fillRect(-3, -8, 6, 1.4); c.fillRect(-3, 6, 6, 1.4);
        c.fillStyle = '#b8913e'; c.font = '700 8px "Gowun Batang", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('墨', 0, -1);
      }
      c.restore();
    }
  }
}

function drawInk(c, pal) {
  const y0 = G.inkY, t = G.t;
  if (y0 > V.camY + V.viewH + 60) return;
  const surf = x => y0 + Math.sin(x * 0.03 + t * 2) * 6 + Math.sin(x * 0.071 - t * 2.7) * 3.5 + Math.sin(x * 0.013 + t * 0.7) * 5;
  // wisps rising from the surface
  c.strokeStyle = 'rgba(10,9,8,.18)'; c.lineWidth = 6; c.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const x = ((i * 61 + t * 12) % (W + 40)) - 20, h = 40 + 30 * Math.sin(t + i);
    c.beginPath(); c.moveTo(x, surf(x)); c.quadraticCurveTo(x + Math.sin(t * 1.3 + i) * 14, surf(x) - h * 0.5, x + Math.sin(t + i) * 8, surf(x) - h); c.stroke();
  }
  const g = c.createLinearGradient(0, y0 - 10, 0, y0 + 300);
  g.addColorStop(0, '#0b0a09'); g.addColorStop(0.08, '#141210'); g.addColorStop(1, '#050404');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(-10, V.camY + V.viewH + 400);
  for (let x = -10; x <= W + 10; x += 8) c.lineTo(x, surf(x));
  c.lineTo(W + 10, V.camY + V.viewH + 400); c.closePath(); c.fill();
  // sheen on the surface
  c.strokeStyle = pal.night > 0.5 ? 'rgba(200,210,230,.25)' : 'rgba(255,255,255,.18)'; c.lineWidth = 1.2;
  c.beginPath(); for (let x = -10; x <= W + 10; x += 8) { const y = surf(x) + 3; x === -10 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke();
}
