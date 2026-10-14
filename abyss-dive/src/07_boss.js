// ---------- bosses, telegraphed attacks ----------
const BOSSES = [
  { depth: 1000, kind: 'squid', name: '대왕오징어', sub: 'Architeuthis dux · 1,000 m', secs: 40, base: 1400, r: 34 },
  { depth: 4000, kind: 'angler', name: '심연의 초롱아귀', sub: 'Melanocetus johnsonii · 4,000 m', secs: 52, base: 4200, r: 50 },
  { depth: 6000, kind: 'siph', name: '거대 관해파리 군체', sub: 'Praya dubia · 6,000 m', secs: 62, base: 7500, r: 22 },
  { depth: FINAL_DEPTH, kind: 'lord', name: '해연의 군주', sub: 'Challenger Deep · 10,935 m', secs: 80, base: 13000, r: 44 },
];

// ---- telegraphs ----
function warnLine(x, y, a, len, w, time, fire, col = COL.coral) { const o = { k: 'line', x, y, a, len, w, t: 0, max: time, fire, col }; G.warns.push(o); SFX.warn(); return o; }
function warnCircle(x, y, r, time, fire, col = COL.coral) { const o = { k: 'circle', x, y, r, t: 0, max: time, fire, col }; G.warns.push(o); return o; }
function lineHitsPlayer(x, y, a, len, w) {
  const p = G.player, dx = p.x - x, dy = p.y - y;
  const cs = Math.cos(a), sn = Math.sin(a);
  const along = dx * cs + dy * sn; if (along < -p.r || along > len + p.r) return false;
  const perp = Math.abs(-dx * sn + dy * cs);
  return perp < w / 2 + p.r - 3;
}
function updateWarns(dt) {
  for (let i = G.warns.length - 1; i >= 0; i--) {
    const w = G.warns[i]; w.t += dt;
    if (w.follow) w.follow(w);
    if (w.t >= w.max) { G.warns.splice(i, 1); if (w.fire) w.fire(w); }
  }
  for (let i = G.beams.length - 1; i >= 0; i--) {
    const b = G.beams[i]; b.life -= dt; b.a += b.va * dt;
    if (b.src) { b.x = b.src.x; b.y = b.src.y; }
    if (lineHitsPlayer(b.x, b.y, b.a, b.len, b.w)) hurtPlayer(b.dmg, b.x, b.y);
    if (b.life <= 0) G.beams.splice(i, 1);
  }
}
function drawWarns(c) {
  for (const w of G.warns) {
    const k = w.t / w.max, blink = 0.5 + 0.5 * Math.sin(G.t * 30);
    c.fillStyle = rgba(w.col, 0.08 + 0.22 * k);
    c.strokeStyle = rgba(w.col, 0.4 + 0.5 * blink * k);
    c.lineWidth = 1.5;
    if (w.k === 'line') {
      c.save(); c.translate(w.x, w.y); c.rotate(w.a);
      c.fillRect(0, -w.w / 2, w.len, w.w);
      c.strokeRect(0, -w.w / 2, w.len, w.w);
      c.fillStyle = rgba(w.col, 0.35); c.fillRect(0, -w.w / 2 * k, w.len * k, w.w * k);
      c.restore();
    } else {
      c.beginPath(); c.arc(w.x, w.y, w.r, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = rgba(w.col, 0.3); c.beginPath(); c.arc(w.x, w.y, w.r * k, 0, TAU); c.fill();
    }
  }
}
function drawBeams(c) {
  for (const b of G.beams) {
    const fade = Math.min(1, b.life * 4);
    c.save(); c.translate(b.x, b.y); c.rotate(b.a);
    const g = c.createLinearGradient(0, -b.w, 0, b.w);
    g.addColorStop(0, rgba(b.col, 0)); g.addColorStop(0.35, rgba(b.col, 0.55 * fade)); g.addColorStop(0.5, rgba(COL.white, 0.95 * fade)); g.addColorStop(0.65, rgba(b.col, 0.55 * fade)); g.addColorStop(1, rgba(b.col, 0));
    c.fillStyle = g; c.fillRect(0, -b.w, b.len, b.w * 2);
    c.restore();
    drawGlow(c, b.x, b.y, b.w * 3, b.col, fade, true);
  }
}

// ---- framework ----
function estimateDps(p) {
  let d = 0; const W = p.weapons;
  if (W.harpoon) { const l = W.harpoon.lvl; d += ws('harpoon', 'dmg', l) * ws('harpoon', 'count', l) / (ws('harpoon', 'cd', l) * p.cdMul); }
  if (W.sonar) { const l = W.sonar.lvl; d += ws('sonar', 'dmg', l) / (ws('sonar', 'cd', l) * p.cdMul); }
  if (W.drone) { const l = W.drone.lvl; d += ws('drone', 'count', l) * ws('drone', 'dmg', l) / 0.3 * 0.35; }
  if (W.torpedo) { const l = W.torpedo.lvl; d += ws('torpedo', 'dmg', l) * ws('torpedo', 'count', l) / (ws('torpedo', 'cd', l) * p.cdMul); }
  if (W.arc) { const l = W.arc.lvl; d += ws('arc', 'dmg', l) / (ws('arc', 'cd', l) * p.cdMul); }
  return d * p.dmgMul * 1.08; // crits
}

function spawnBoss(def) {
  const p = G.player;
  const a = rand(TAU), R = Math.hypot(V.w, V.h) * 0.6;
  const hp = clamp(estimateDps(p) * def.secs * 0.5, def.base * 0.4, def.base * 4);
  const b = {
    isBoss: true, def, kind: def.kind, name: def.name, x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R, vx: 0, vy: 0,
    r: def.r, hp, maxHp: hp, phase: 1, t: 0, st: 2.2, atk: 'intro', dead: false, dying: 0, flash: 0, reveal: 0, face: a + Math.PI,
    orb: a, dash: null, tent: [], seg: [], lureOff: 0, sub: 0,
  };
  if (b.kind === 'squid') {
    for (let i = 0; i < 10; i++) {
      const long = i >= 8, n = long ? 16 : 8, L = long ? 13 : 7;
      const pts = []; for (let j = 0; j < n; j++) pts.push({ x: b.x, y: b.y });
      b.tent.push({ pts, L, long, off: (i < 8 ? (i - 3.5) * 0.16 : (i === 8 ? -0.25 : 0.25)), lash: 0, lx: 0, ly: 0 });
    }
  }
  if (b.kind === 'siph') for (let i = 0; i < 34; i++) b.seg.push({ x: b.x, y: b.y, glow: 0, armed: 0 });
  if (b.kind === 'lord') for (let i = 0; i < 20; i++) b.seg.push({ x: b.x, y: b.y });
  G.boss = b;
  G.bossIdx++;
  Seen.mark('b' + BOSSES.indexOf(def));
  // the rest of the sea clears out when something this big arrives
  for (const e of G.enemies) if (!e.elite) e.flee = true;
  showBanner('경고 · 대형 생체 신호', def.name, def.sub, true, 3.2);
  SFX.roar(); FX.shake(8);
  document.getElementById('boss').hidden = false;
  document.getElementById('bossName').textContent = def.name;
}

function bossTargetPoint(b) {
  if (b.kind === 'siph') {
    if (b._tpT === G.t) return b._tp;
    const p = G.player; let best = b, bd = dist2(b.x, b.y, p.x, p.y);
    for (let i = 0; i < b.seg.length; i += 2) { const s = b.seg[i], d = dist2(s.x, s.y, p.x, p.y); if (d < bd) { bd = d; best = s; } }
    b._tpT = G.t; b._tp = best; return best;
  }
  return b;
}
function bossHitTest(b, x, y, r) {
  if (dist2(x, y, b.x, b.y) < (b.r + r) ** 2) return true;
  if (b.kind === 'siph') {
    for (let i = 0; i < b.seg.length; i++) { const s = b.seg[i], sr = 13 * (1 - i / b.seg.length * 0.5); if (dist2(x, y, s.x, s.y) < (sr + r) ** 2) return true; }
  } else if (b.kind === 'lord') {
    for (let i = 0; i < b.seg.length; i += 2) { const s = b.seg[i], sr = 22 * (1 - i / b.seg.length * 0.6); if (dist2(x, y, s.x, s.y) < (sr + r) ** 2) return true; }
  }
  return false;
}
function damageBoss(b, dmg, src) {
  if (b.dead || b.dying) return;
  const crit = Math.random() < 0.08; if (crit) dmg *= 2;
  b.hp -= dmg; b.flash = 0.08;
  G.stats.dealt += dmg;
  const tp = bossTargetPoint(b);
  dmgNumber(b, tp.x + rand(-b.r, b.r) * 0.5, tp.y - b.r * 0.6, dmg, crit);
  SFX.hit();
  const frac = b.hp / b.maxHp;
  const phases = b.kind === 'lord' ? [0.66, 0.33] : [0.5];
  if (b.phase <= phases.length && frac < phases[b.phase - 1]) {
    b.phase++;
    showBanner('', b.phase === 2 ? '격노' : '최후의 발악', '공격 패턴이 바뀝니다', true, 1.6);
    SFX.roar(); FX.shake(12); b.atk = 'idle'; b.st = 1.2; G.warns.length = 0;
    FX.ring(b.x, b.y, COL.coral, 10, 260, 0.6, 6);
  }
  if (b.hp <= 0) { b.hp = 0; b.dying = 2.2; G.warns.length = 0; G.beams.length = 0; G.eshots.length = 0; SFX.bossDown(); }
}

function bossOrbit(b, dt, R, spd, ease = 2) {
  const p = G.player;
  b.orb += spd * dt;
  const tx = p.x + Math.cos(b.orb) * R, ty = p.y + Math.sin(b.orb) * R;
  b.vx += ((tx - b.x) * ease - b.vx) * Math.min(1, dt * 3);
  b.vy += ((ty - b.y) * ease - b.vy) * Math.min(1, dt * 3);
}

function updateBoss(dt) {
  const b = G.boss; if (!b) return;
  const p = G.player;
  b.t += dt; b.flash = Math.max(0, b.flash - dt); b.reveal = Math.max(0, b.reveal - dt);
  if (b.dying) {
    b.dying -= dt; b.vx *= 0.95; b.vy *= 0.95;
    if (Math.random() < dt * 14) {
      const pts = [b, ...b.seg, ...(b.tent.length ? b.tent.map(t => t.pts[t.pts.length >> 1]) : [])];
      const q = pick(pts);
      FX.burst(q.x + rand(-20, 20), q.y + rand(-20, 20), pick([COL.coral, COL.lure, COL.white, COL.bio]), 10, 260, 0.6, 5);
      FX.shake(6); SFX.explode(false);
      G.lights.push({ x: q.x, y: q.y, r: 160, life: 0.3, max: 0.3 });
    }
    if (b.dying <= 0) bossDie(b);
    b.x += b.vx * dt; b.y += b.vy * dt;
    animateBossBody(b, dt);
    return;
  }
  const P2 = b.phase >= 2, P3 = b.phase >= 3;
  b.st -= dt;
  const dx = p.x - b.x, dy = p.y - b.y, toP = Math.atan2(dy, dx);

  if (b.kind === 'squid') {
    if (b.dash) {
      b.vx = b.dash.vx; b.vy = b.dash.vy; b.dash.t -= dt;
      if (Math.random() < 0.6) FX.bubbles(b.x, b.y, 2, 60);
      if (b.dash.t <= 0) b.dash = null;
    } else {
      bossOrbit(b, dt, 250, P2 ? 0.55 : 0.35);
      b.face += angDiff(b.face, toP) * Math.min(1, dt * 3);
    }
    if (b.st <= 0 && !b.dash) {
      const pool = P2 ? ['strike', 'strike', 'ink', 'charge', 'summon'] : ['strike', 'strike', 'ink', 'charge'];
      const atk = pick(pool);
      if (atk === 'strike') {
        const n = P2 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const lead = 0.35 * (i / Math.max(1, n - 1));
          const tx = p.x + p.vx * lead, ty = p.y + p.vy * lead;
          const a = angTo(b.x, b.y, tx, ty) + (i - (n - 1) / 2) * 0.22;
          const ti = 8 + (i % 2);
          warnLine(b.x, b.y, a, 460, 30, P2 ? 0.6 : 0.8, w => {
            const T = b.tent[ti]; T.lash = 0.35; T.lx = w.x + Math.cos(w.a) * w.len; T.ly = w.y + Math.sin(w.a) * w.len;
            if (lineHitsPlayer(w.x, w.y, w.a, w.len, w.w)) hurtPlayer(18, w.x, w.y);
            for (let k = 0; k < 8; k++) { const t = k / 7 * w.len; FX.burst(w.x + Math.cos(w.a) * t, w.y + Math.sin(w.a) * t, COL.coral, 2, 80, 0.3, 3, 'spark'); }
            FX.shake(5);
          }).follow = w => { w.x = b.x; w.y = b.y; };
        }
        b.st = P2 ? 1.5 : 2.1;
      } else if (atk === 'ink') {
        const n = P2 ? 22 : 15, off = rand(TAU);
        for (let i = 0; i < n; i++) {
          const a = off + i / n * TAU;
          G.eshots.push({ x: b.x, y: b.y, vx: Math.cos(a) * 115, vy: Math.sin(a) * 115, r: 8, dmg: 10, life: 5, col: [170, 100, 255], curve: P2 ? (i % 2 ? 0.5 : -0.5) : 0.35 });
        }
        for (let i = 0; i < 10; i++) FX.spawn({ x: b.x, y: b.y, vx: rand(-90, 90), vy: rand(-90, 90), life: 2, size: rand(16, 26), size1: rand(30, 46), col: [6, 4, 14], kind: 'ink', add: false, drag: 1.5 });
        b.st = 2.2;
      } else if (atk === 'charge') {
        warnLine(b.x, b.y, toP, 640, 70, 0.95, w => {
          b.dash = { vx: Math.cos(w.a) * 820, vy: Math.sin(w.a) * 820, t: 0.62 };
          b.face = w.a; FX.shake(6); SFX.dash();
        }).follow = w => { w.x = b.x; w.y = b.y; w.a = b.face = angTo(b.x, b.y, p.x, p.y); };
        b.st = 2.4;
      } else if (atk === 'summon') {
        for (let i = 0; i < 5; i++) spawnEnemy('squid', b.x + rand(-40, 40), b.y + rand(-40, 40));
        b.st = 1.6;
      }
    }
    // contact
    if (dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) ** 2) hurtPlayer(b.dash ? 30 : 18, b.x, b.y);
  }

  else if (b.kind === 'angler') {
    if (b.dash) {
      b.vx = b.dash.vx; b.vy = b.dash.vy; b.dash.t -= dt;
      if (b.dash.t <= 0) b.dash = null;
    } else {
      bossOrbit(b, dt, 270, P2 ? 0.3 : 0.2, 1.2);
      b.face += angDiff(b.face, toP) * Math.min(1, dt * 2.5);
    }
    if (b.lureOff > 0) {
      b.lureOff -= dt;
      if (b.lureOff <= 0) {
        const n = 40;
        for (let i = 0; i < n; i++) { const a = i / n * TAU; G.eshots.push({ x: b.x, y: b.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 7, dmg: 14, life: 5, col: COL.lure }); }
        FX.ring(b.x, b.y, COL.lure, 20, 300, 0.6, 6); FX.shake(10); SFX.explode(true);
      }
    }
    if (b.st <= 0 && !b.dash && b.lureOff <= 0) {
      const pool = P2 ? ['rings', 'lunge', 'blackout', 'summon', 'spiral'] : ['rings', 'lunge', 'summon', 'rings'];
      const atk = pick(pool);
      const lure = anglerLure(b);
      if (atk === 'rings') {
        const waves = P2 ? 4 : 3;
        for (let k = 0; k < waves; k++) setTimeoutGame(k * 0.45, () => {
          if (b.dead || b.dying) return; const L = anglerLure(b);
          const n = 16, off = k * 0.2;
          for (let i = 0; i < n; i++) { const a = off + i / n * TAU; G.eshots.push({ x: L.x, y: L.y, vx: Math.cos(a) * 125, vy: Math.sin(a) * 125, r: 7, dmg: 13, life: 5, col: COL.lure }); }
          FX.ring(L.x, L.y, COL.lure, 6, 50, 0.3, 3);
        });
        b.st = 2.6;
      } else if (atk === 'lunge') {
        warnLine(b.x, b.y, toP, 600, 100, 1.0, w => { b.dash = { vx: Math.cos(w.a) * 780, vy: Math.sin(w.a) * 780, t: 0.6 }; b.face = w.a; FX.shake(8); SFX.roar(); })
          .follow = w => { w.x = b.x; w.y = b.y; w.a = b.face; };
        b.st = 2.4;
      } else if (atk === 'summon') {
        for (let i = 0; i < 3; i++) spawnEnemy(pick(['angler', 'viper']), b.x + rand(-60, 60), b.y + rand(-60, 60));
        b.st = 1.8;
      } else if (atk === 'blackout') {
        b.lureOff = 2.4; showBanner('', '빛이 꺼졌다', '', true, 1.2);
        b.st = 3.4;
      } else if (atk === 'spiral') {
        for (let k = 0; k < 24; k++) setTimeoutGame(k * 0.09, () => {
          if (b.dead || b.dying) return; const L = anglerLure(b);
          for (let j = 0; j < 3; j++) { const a = k * 0.42 + j * TAU / 3; G.eshots.push({ x: L.x, y: L.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, r: 6, dmg: 12, life: 5, col: COL.lure }); }
        });
        b.st = 3.2;
      }
      void lure;
    }
    if (dist2(b.x, b.y, p.x, p.y) < (b.r + p.r - 6) ** 2) hurtPlayer(b.dash ? 34 : 20, b.x, b.y);
  }

  else if (b.kind === 'siph') {
    // the head sweeps in arcs around the player; the body follows
    let tx, ty;
    if (b.atk === 'coil') { b.orb += (P2 ? 1.25 : 1.0) * dt; tx = p.x + Math.cos(b.orb) * 230; ty = p.y + Math.sin(b.orb) * 230; }
    else { b.orb += 0.6 * dt; const R = 210 + Math.sin(b.t * 0.7) * 110; tx = p.x + Math.cos(b.orb) * R; ty = p.y + Math.sin(b.orb) * R; }
    const want = angTo(b.x, b.y, tx, ty);
    b.face += clamp(angDiff(b.face, want), -3 * dt, 3 * dt);
    const sp = b.atk === 'coil' ? 290 : (P2 ? 185 : 150);
    b.vx = Math.cos(b.face) * sp; b.vy = Math.sin(b.face) * sp;
    for (const s of b.seg) {
      if (s.armed > 0) {
        s.armed -= dt;
        if (s.armed <= 0) {
          const a = angTo(s.x, s.y, p.x, p.y);
          G.eshots.push({ x: s.x, y: s.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 6, dmg: 12, life: 4, col: COL.pink });
          FX.ring(s.x, s.y, COL.pink, 4, 22, 0.25, 2);
        }
      }
    }
    if (b.st <= 0) {
      if (b.atk === 'coil') { b.atk = 'idle'; b.st = 1.5; }
      else {
        const pool = P2 ? ['volley', 'coil', 'volley', 'spawn'] : ['volley', 'volley', 'coil', 'spawn'];
        const atk = pick(pool);
        if (atk === 'volley') {
          const step = P2 ? 2 : 3;
          for (let i = 2; i < b.seg.length; i += step) b.seg[i].armed = 0.7 + i * 0.02;
          b.st = 2.6; b.atk = 'idle';
        } else if (atk === 'coil') {
          b.atk = 'coil'; b.orb = angTo(p.x, p.y, b.x, b.y); b.st = 4.2;
          showBanner('', '포위', '몸통이 조여 옵니다', true, 1.1);
          for (let k = 0; k < 4; k++) setTimeoutGame(1 + k * 0.8, () => { if (b.dead || b.dying || b.atk !== 'coil') return; for (let i = 3; i < b.seg.length; i += 4) b.seg[i].armed = 0.5; });
        } else {
          for (let i = 0; i < 4; i++) spawnEnemy('jelly', b.x + rand(-50, 50), b.y + rand(-50, 50));
          b.st = 1.5; b.atk = 'idle';
        }
      }
    }
    if (dist2(b.x, b.y, p.x, p.y) < (b.r + p.r - 3) ** 2) hurtPlayer(20, b.x, b.y);
    for (let i = 3; i < b.seg.length; i += 2) { const s = b.seg[i]; if (dist2(s.x, s.y, p.x, p.y) < (11 + p.r - 3) ** 2) { hurtPlayer(14, s.x, s.y); break; } }
  }

  else if (b.kind === 'lord') {
    if (b.dash) {
      b.vx = b.dash.vx; b.vy = b.dash.vy; b.dash.t -= dt;
      b.dash.drop -= dt;
      if (b.dash.drop <= 0) { b.dash.drop = 0.06; const a = Math.atan2(b.vy, b.vx) + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1); G.eshots.push({ x: b.x, y: b.y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, r: 6, dmg: 12, life: 3.5, col: COL.violet, accel: 0.9 }); }
      if (b.dash.t <= 0) b.dash = null;
      b.face = Math.atan2(b.vy, b.vx);
    } else if (b.atk === 'beam') {
      b.vx *= 0.9; b.vy *= 0.9;
    } else {
      bossOrbit(b, dt, 290, P3 ? 0.4 : 0.28, 1.4);
      b.face += angDiff(b.face, toP) * Math.min(1, dt * 2.5);
    }
    if (b.st <= 0 && !b.dash) {
      if (b.atk === 'beam') { b.atk = 'idle'; b.st = 0.8; }
      else {
        const pool = P3 ? ['spiral', 'beam', 'charge', 'rain', 'beam'] : P2 ? ['spiral', 'beam', 'charge', 'summon', 'rain'] : ['spiral', 'charge', 'beam', 'summon'];
        const atk = pick(pool);
        if (atk === 'spiral') {
          const arms = b.phase + 1, dir = Math.random() < 0.5 ? 1 : -1;
          for (let k = 0; k < 34; k++) setTimeoutGame(k * 0.085, () => {
            if (b.dead || b.dying) return;
            for (let j = 0; j < arms; j++) { const a = dir * k * 0.33 + j * TAU / arms; G.eshots.push({ x: b.x, y: b.y, vx: Math.cos(a) * 135, vy: Math.sin(a) * 135, r: 6, dmg: 13, life: 5, col: j % 2 ? COL.violet : COL.bio }); }
          });
          b.st = 3.6;
        } else if (atk === 'beam') {
          const n = b.phase + 1, base = toP + Math.PI / n, va = (Math.random() < 0.5 ? 1 : -1) * (0.42 + b.phase * 0.06);
          for (let j = 0; j < n; j++) {
            const a = base + j * TAU / n;
            warnLine(b.x, b.y, a, 950, 26, 1.1, () => { G.beams.push({ src: b, x: b.x, y: b.y, a, va, len: 950, w: 14, life: 2.8, dmg: 18, col: COL.violet }); FX.shake(6); }, COL.violet);
          }
          b.atk = 'beam'; b.st = 4.2;
        } else if (atk === 'charge') {
          warnLine(b.x, b.y, toP, 700, 80, 0.9, w => { b.dash = { vx: Math.cos(w.a) * 860, vy: Math.sin(w.a) * 860, t: 0.7, drop: 0 }; SFX.roar(); FX.shake(8); })
            .follow = w => { w.x = b.x; w.y = b.y; w.a = b.face = angTo(b.x, b.y, p.x, p.y); };
          b.st = 2.3;
        } else if (atk === 'summon') {
          for (let i = 0; i < 2; i++) spawnEnemy(pick(['viper', 'angler', 'isopod']), b.x + rand(-80, 80), b.y + rand(-80, 80), true);
          b.st = 1.5;
        } else if (atk === 'rain') {
          const n = P3 ? 7 : 5;
          for (let k = 0; k < n; k++) setTimeoutGame(k * 0.28, () => {
            if (b.dead || b.dying) return;
            const q = G.player;
            warnCircle(q.x + q.vx * 0.5 + rand(-30, 30), q.y + q.vy * 0.5 + rand(-30, 30), 62, 0.95, w => {
              if (dist2(w.x, w.y, G.player.x, G.player.y) < (w.r + G.player.r - 4) ** 2) hurtPlayer(22, w.x, w.y);
              FX.ring(w.x, w.y, COL.violet, 8, w.r, 0.35, 5); FX.burst(w.x, w.y, COL.violet, 10, 200, 0.4, 4); SFX.explode(false);
              G.lights.push({ x: w.x, y: w.y, r: 180, life: 0.3, max: 0.3 });
            }, COL.violet);
          });
          b.st = 2.8;
        }
      }
    }
    if (dist2(b.x, b.y, p.x, p.y) < (b.r + p.r - 6) ** 2) hurtPlayer(b.dash ? 34 : 22, b.x, b.y);
    for (let i = 2; i < b.seg.length; i += 3) { const s = b.seg[i]; if (dist2(s.x, s.y, p.x, p.y) < (16 + p.r - 4) ** 2) { hurtPlayer(16, s.x, s.y); break; } }
  }

  b.x += b.vx * dt; b.y += b.vy * dt;
  animateBossBody(b, dt);
}

function anglerLure(b) {
  const s = b.r / 19, cs = Math.cos(b.face), sn = Math.sin(b.face);
  const lx = 26 + Math.sin(b.t * 2) * 3, ly = -14 + Math.cos(b.t * 2.4) * 3;
  return { x: b.x + (cs * lx - sn * ly) * s, y: b.y + (sn * lx + cs * ly) * s };
}

function animateBossBody(b, dt) {
  if (b.kind === 'squid') {
    const cs = Math.cos(b.face), sn = Math.sin(b.face);
    const hx = b.x + cs * 30, hy = b.y + sn * 30;
    for (let i = 0; i < b.tent.length; i++) {
      const T = b.tent[i], pts = T.pts;
      pts[0].x = hx - sn * T.off * 40; pts[0].y = hy + cs * T.off * 40;
      T.lash = Math.max(0, T.lash - dt);
      // tip seeks forward (or lashes to strike point); chain follows with fixed spacing
      const wave = Math.sin(b.t * 3 + i) * 0.5;
      const reach = T.long ? T.L * pts.length * 0.75 : T.L * pts.length * 0.9;
      let tx = pts[0].x + Math.cos(b.face + T.off * 1.4 + wave * 0.5) * reach, ty = pts[0].y + Math.sin(b.face + T.off * 1.4 + wave * 0.5) * reach;
      if (T.lash > 0) { tx = T.lx; ty = T.ly; }
      const tip = pts[pts.length - 1];
      const k = T.lash > 0 ? 0.6 : 0.08;
      tip.x += (tx - tip.x) * k; tip.y += (ty - tip.y) * k;
      for (let j = pts.length - 2; j > 0; j--) {
        const a = pts[j], nb = pts[j + 1];
        const d = dist(a.x, a.y, nb.x, nb.y) || 1, L = T.lash > 0 ? T.L * 2 : T.L;
        if (d > L) { const t = (d - L) / d; a.x += (nb.x - a.x) * t; a.y += (nb.y - a.y) * t; }
      }
      for (let j = 1; j < pts.length; j++) {
        const a = pts[j], pv = pts[j - 1];
        const d = dist(a.x, a.y, pv.x, pv.y) || 1, L = T.lash > 0 ? T.L * 2 : T.L;
        if (d > L) { const t = (d - L) / d; a.x += (pv.x - a.x) * t; a.y += (pv.y - a.y) * t; }
      }
    }
  } else if (b.seg.length) {
    const spacing = b.kind === 'siph' ? 15 : 20;
    let px = b.x, py = b.y;
    for (const s of b.seg) {
      const d = dist(px, py, s.x, s.y);
      if (d > spacing) { const t = (d - spacing) / d; s.x += (px - s.x) * t; s.y += (py - s.y) * t; }
      px = s.x; py = s.y;
    }
  }
}

function bossDie(b) {
  b.dead = true;
  G.stats.bosses++;
  FX.burst(b.x, b.y, COL.white, 30, 500, 0.9, 7);
  FX.ring(b.x, b.y, COL.lure, 10, 400, 0.9, 8);
  FX.shake(20);
  dropXp(b.x, b.y, 40 + G.bossIdx * 40);
  dropHeal(b.x + 20, b.y); dropHeal(b.x - 20, b.y);
  G.vacuum = 2.5;
  document.getElementById('boss').hidden = true;
  if (b.kind === 'lord') {
    G.finale = G.t;
    for (const e of G.enemies) e.flee = true;
    setTimeoutGame(2.4, () => { showBanner('CHALLENGER DEEP', '해저 도달', '10,935 m · 수압 1,087 기압', false, 3.2); SFX.creak(); });
    setTimeoutGame(6.2, () => gameOver(true));
  }
  else showBanner('생체 신호 소멸', b.name + ' 격퇴', '잠항을 재개합니다', false, 2.6);
  G.boss = null;
}

// ---------- boss drawing ----------
function drawBoss(c, b) {
  const fl = false; // hit feedback is an additive glint (drawBossGlow), not a white fill
  if (b.kind === 'squid') {
    // arms
    for (const T of b.tent) {
      const pts = T.pts, n = pts.length;
      for (let j = 0; j < n - 1; j++) {
        c.strokeStyle = fl ? '#fff' : (T.long ? '#8a2f2a' : '#9c3a30');
        c.lineWidth = (T.long ? 5 : 7) * (1 - j / n) + 1.2;
        c.lineCap = 'round';
        c.beginPath(); c.moveTo(pts[j].x, pts[j].y); c.lineTo(pts[j + 1].x, pts[j + 1].y); c.stroke();
      }
      if (T.long) { const t = pts[n - 1]; c.fillStyle = fl ? '#fff' : '#a8443a'; c.beginPath(); c.ellipse(t.x, t.y, 7, 4, angTo(pts[n - 2].x, pts[n - 2].y, t.x, t.y), 0, TAU); c.fill(); }
    }
    c.save(); c.translate(b.x, b.y); c.rotate(b.face);
    if (b.dash) c.scale(1.08, 0.92);
    const g = c.createLinearGradient(-60, 0, 40, 0);
    g.addColorStop(0, '#5c1d1f'); g.addColorStop(0.6, '#b04a3a'); g.addColorStop(1, '#d0705a');
    c.fillStyle = fl ? '#fff' : g;
    // mantle with rear fins
    c.beginPath(); c.moveTo(34, 0); c.bezierCurveTo(30, -22, -10, -22, -50, -10); c.lineTo(-70, 0); c.lineTo(-50, 10); c.bezierCurveTo(-10, 22, 30, 22, 34, 0); c.fill();
    c.beginPath(); c.moveTo(-46, -8); c.quadraticCurveTo(-66, -30, -78, -2); c.lineTo(-78, 2); c.quadraticCurveTo(-66, 30, -46, 8); c.fill();
    c.fillStyle = 'rgba(255,190,160,.12)';
    for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(-40 + i * 8, Math.sin(i * 2.1) * 8, 2.4, 0, TAU); c.fill(); }
    // the largest eyes in the animal kingdom
    c.fillStyle = '#f2e6d0';
    c.beginPath(); c.arc(24, -12, 7, 0, TAU); c.arc(24, 12, 7, 0, TAU); c.fill();
    c.fillStyle = '#0a0a12'; c.beginPath(); c.arc(26, -12, 4.6, 0, TAU); c.arc(26, 12, 4.6, 0, TAU); c.fill();
    c.restore();
  } else if (b.kind === 'angler') {
    c.save(); c.translate(b.x, b.y); c.rotate(b.face); const s = b.r / 19; c.scale(s, s);
    const open = b.dash ? 1 : 0.4 + Math.sin(b.t * 1.5) * 0.15;
    const g = c.createRadialGradient(-4, -6, 2, -2, 0, 22);
    g.addColorStop(0, '#3d3238'); g.addColorStop(1, '#141013');
    c.fillStyle = fl ? '#fff' : g;
    c.beginPath(); c.ellipse(-2, 0, 18, 15, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-18, 0); c.lineTo(-31, -10); c.lineTo(-27, 0); c.lineTo(-31, 10); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-6, -14); c.lineTo(-12, -20); c.lineTo(-2, -15); c.fill();
    c.fillStyle = '#0a0607'; c.beginPath(); c.moveTo(17, 0); c.lineTo(3, -10 * open); c.lineTo(3, 10 * open); c.closePath(); c.fill();
    c.fillStyle = '#efe6d8';
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      c.beginPath(); c.moveTo(lerp(16, 4, t), -lerp(1, 10, t) * open); c.lineTo(lerp(14.5, 2.5, t), -lerp(1, 10, t) * open + 4.5); c.lineTo(lerp(13, 1, t), -lerp(1, 10, t) * open); c.fill();
      c.beginPath(); c.moveTo(lerp(16, 4, t), lerp(1, 10, t) * open); c.lineTo(lerp(14.5, 2.5, t), lerp(1, 10, t) * open - 4.5); c.lineTo(lerp(13, 1, t), lerp(1, 10, t) * open); c.fill();
    }
    c.strokeStyle = '#4a3a3f'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(4, -12); c.quadraticCurveTo(18, -30, 26 + Math.sin(b.t * 2) * 3, -14 + Math.cos(b.t * 2.4) * 3); c.stroke();
    c.fillStyle = '#d8e8ff'; c.beginPath(); c.arc(8, -5, 1.6, 0, TAU); c.fill();
    c.restore();
  } else if (b.kind === 'siph') {
    for (let i = b.seg.length - 1; i >= 0; i--) {
      const s = b.seg[i], sr = 13 * (1 - i / b.seg.length * 0.5);
      c.fillStyle = fl ? '#fff' : `rgba(255,150,215,${0.22 + 0.2 * (1 - i / b.seg.length)})`;
      c.beginPath(); c.arc(s.x, s.y, sr, 0, TAU); c.fill();
      if (i % 2 === 0) {
        const nx = b.seg[Math.max(0, i - 1)], a = angTo(s.x, s.y, nx.x, nx.y) + Math.PI / 2;
        c.strokeStyle = 'rgba(255,180,230,.25)'; c.lineWidth = 1;
        const L = 16 + Math.sin(G.t * 3 + i) * 5;
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + Math.cos(a) * L, s.y + Math.sin(a) * L); c.moveTo(s.x, s.y); c.lineTo(s.x - Math.cos(a) * L, s.y - Math.sin(a) * L); c.stroke();
      }
    }
    c.fillStyle = fl ? '#fff' : 'rgba(255,200,235,.75)';
    c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill();
    c.fillStyle = 'rgba(80,20,60,.5)'; c.beginPath(); c.arc(b.x + Math.cos(b.face) * 6, b.y + Math.sin(b.face) * 6, b.r * 0.45, 0, TAU); c.fill();
  } else if (b.kind === 'lord') {
    for (let i = b.seg.length - 1; i >= 0; i--) {
      const s = b.seg[i], sr = 22 * (1 - i / b.seg.length * 0.65);
      c.fillStyle = fl ? '#fff' : (i % 2 ? '#1c1632' : '#251d42');
      c.beginPath(); c.arc(s.x, s.y, sr, 0, TAU); c.fill();
      if (i % 3 === 0) {
        const nx = b.seg[Math.max(0, i - 1)], a = angTo(s.x, s.y, nx.x, nx.y) + Math.PI / 2;
        c.fillStyle = '#251b40';
        c.beginPath(); c.moveTo(s.x + Math.cos(a) * sr, s.y + Math.sin(a) * sr); c.lineTo(s.x + Math.cos(a) * (sr + 12), s.y + Math.sin(a) * (sr + 12)); c.lineTo(s.x + Math.cos(a - 0.5) * sr, s.y + Math.sin(a - 0.5) * sr); c.fill();
      }
    }
    c.save(); c.translate(b.x, b.y); c.rotate(b.face);
    c.fillStyle = fl ? '#fff' : '#2a2148';
    c.beginPath(); c.moveTo(50, 0); c.bezierCurveTo(44, -30, -10, -36, -30, -20); c.lineTo(-30, 20); c.bezierCurveTo(-10, 36, 44, 30, 50, 0); c.fill();
    // jaws with needle fangs
    c.fillStyle = '#07050d'; c.beginPath(); c.moveTo(52, 0); c.lineTo(18, -12); c.lineTo(18, 12); c.closePath(); c.fill();
    c.strokeStyle = '#e8e2f5'; c.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { const x = 22 + i * 5; c.beginPath(); c.moveTo(x, -10 + i * 1.5); c.lineTo(x + 2, -2); c.moveTo(x, 10 - i * 1.5); c.lineTo(x + 2, 2); c.stroke(); }
    // barbel
    c.strokeStyle = '#3a2e5e'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(20, 14); c.quadraticCurveTo(10, 50, -10 + Math.sin(b.t * 2) * 10, 70); c.stroke();
    c.restore();
  }
}

function drawBossGlow(c, b) {
  const pulse = 0.6 + 0.4 * Math.sin(G.t * 3);
  if (b.kind === 'squid') {
    const cs = Math.cos(b.face), sn = Math.sin(b.face);
    // eyeshine catches the sub's lamp
    drawGlow(c, b.x + cs * 26 - sn * 12, b.y + sn * 26 + cs * 12, 12, [255, 230, 200], 0.55);
    drawGlow(c, b.x + cs * 26 + sn * 12, b.y + sn * 26 - cs * 12, 12, [255, 230, 200], 0.55);
    drawGlow(c, b.x, b.y, 110, COL.coral, 0.16);
    for (const T of b.tent) if (T.long) { const t = T.pts[T.pts.length - 1]; drawGlow(c, t.x, t.y, 12, COL.coral, 0.5); }
  } else if (b.kind === 'angler') {
    const L = anglerLure(b);
    const on = b.lureOff > 0 ? (b.lureOff < 0.6 ? Math.random() : 0) : 1;
    drawGlow(c, L.x, L.y, 60 * on, COL.lure, on * pulse, true);
    drawGlow(c, L.x, L.y, 200 * on, COL.lure, 0.25 * on);
    const s = b.r / 19, cs = Math.cos(b.face), sn = Math.sin(b.face);
    drawGlow(c, b.x + (cs * 8 + sn * 5) * s, b.y + (sn * 8 - cs * 5) * s, 10, [200, 230, 255], 0.5);
  } else if (b.kind === 'siph') {
    for (let i = 0; i < b.seg.length; i++) {
      const s = b.seg[i], arm = s.armed > 0 ? 1 : 0;
      const p = 0.5 + 0.5 * Math.sin(G.t * 5 - i * 0.5);
      drawGlow(c, s.x, s.y, arm ? 26 : 14, arm ? COL.white : (i % 3 ? COL.pink : COL.violet), arm ? 0.6 + 0.4 * Math.sin(G.t * 40) : 0.3 + 0.5 * p, arm);
    }
    drawGlow(c, b.x, b.y, 50, COL.pink, 0.9, true);
  } else if (b.kind === 'lord') {
    for (let i = 0; i < b.seg.length; i++) {
      const s = b.seg[i], nx = b.seg[Math.max(0, i - 1)], a = angTo(s.x, s.y, nx.x, nx.y) + Math.PI / 2;
      const sr = 22 * (1 - i / b.seg.length * 0.65) * 0.7, p = 0.5 + 0.5 * Math.sin(G.t * 4 - i * 0.6);
      drawGlow(c, s.x + Math.cos(a) * sr, s.y + Math.sin(a) * sr, 6, COL.violet, 0.4 + p * 0.5);
      drawGlow(c, s.x - Math.cos(a) * sr, s.y - Math.sin(a) * sr, 6, COL.bio, 0.4 + p * 0.5);
    }
    const cs = Math.cos(b.face), sn = Math.sin(b.face);
    drawGlow(c, b.x + cs * 22 - sn * 16, b.y + sn * 22 + cs * 16, 14, COL.coral, 0.9, true); // red suborbital photophore, as in dragonfish
    drawGlow(c, b.x + cs * 22 + sn * 16, b.y + sn * 22 - cs * 16, 14, COL.coral, 0.9, true);
    const bx = b.x + (cs * (-10 + Math.sin(b.t * 2) * 10) - sn * 70), by = b.y + (sn * (-10 + Math.sin(b.t * 2) * 10) + cs * 70);
    drawGlow(c, bx, by, 24, COL.bio, pulse, true);
    drawGlow(c, b.x, b.y, 160, COL.violet, 0.12 + 0.06 * pulse);
  }
  if (b.flash > 0) { const tp = bossTargetPoint(b); drawGlow(c, tp.x, tp.y, b.r * 1.8, COL.white, 0.22); }
  if (b.reveal > 0) { c.strokeStyle = rgba(COL.blue, 0.5 * Math.min(1, b.reveal)); c.lineWidth = 2; c.beginPath(); c.arc(b.x, b.y, b.r + 8, 0, TAU); c.stroke(); }
}

// game-time timers (pause-aware, unlike setTimeout)
function setTimeoutGame(t, fn) { G.timers.push({ t, fn }); }
function updateTimers(dt) {
  for (let i = G.timers.length - 1; i >= 0; i--) { const o = G.timers[i]; o.t -= dt; if (o.t <= 0) { G.timers.splice(i, 1); o.fn(); } }
}
