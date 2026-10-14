// ---------- deep-sea creatures ----------
// zones: index of first zone where the creature appears; w: spawn weight per zone
const ETYPES = {
  lantern: { name: '샛비늘치', r: 7, hp: 7, speed: 125, dmg: 8, xp: 1, w: [5, 4, 2.5, 1.5, 1.2], group: [3, 5] },
  jelly: { name: '해파리', r: 15, hp: 24, speed: 38, dmg: 11, xp: 2, w: [2, 2, 1.5, 1.2, 1] },
  comb: { name: '빗해파리', r: 12, hp: 20, speed: 70, dmg: 8, xp: 3, w: [0, 1.6, 1.4, 1.2, 1] },
  squid: { name: '반딧불오징어', r: 13, hp: 30, speed: 90, dmg: 13, xp: 3, w: [0, 1.8, 1.6, 1.3, 1.2] },
  angler: { name: '초롱아귀', r: 19, hp: 70, speed: 48, dmg: 18, xp: 6, w: [0, 0, 1.6, 1.4, 1.3] },
  viper: { name: '독사고기', r: 12, hp: 32, speed: 150, dmg: 14, xp: 4, w: [0, 0, 1.4, 1.6, 1.5] },
  siph: { name: '관해파리', r: 9, hp: 150, speed: 70, dmg: 15, xp: 12, w: [0, 0, 0, 0.7, 0.8] },
  isopod: { name: '대왕등각류', r: 21, hp: 180, speed: 46, dmg: 20, xp: 10, w: [0, 0, 0, 1.1, 1.1] },
};

function spawnEnemy(type, x, y, elite = false) {
  const T = ETYPES[type];
  const hpMul = G.hpScale * (elite ? 4 : 1);
  const e = {
    type, x, y, vx: 0, vy: 0, r: T.r * (elite ? 1.35 : 1), hp: T.hp * hpMul, maxHp: T.hp * hpMul, speed: T.speed * rand(0.9, 1.1),
    dmg: T.dmg * (elite ? 1.4 : 1), xp: T.xp * (elite ? 6 : 1), elite, dead: false, t: rand(10), ph: rand(TAU), face: 0,
    state: 0, st: rand(1, 2.5), flash: 0, reveal: 0, kx: 0, ky: 0, seg: null,
  };
  if (type === 'siph') {
    e.seg = [];
    for (let i = 0; i < 11; i++) e.seg.push({ x, y: y + i * 12 });
  }
  G.enemies.push(e);
  if (!G.demo) Seen.mark(type);
  return e;
}

function spawnTick(dt) {
  if (G.finale !== undefined) return;
  if (G.boss && !G.boss.dead) { G.spawnAcc += dt * 0.18; } else G.spawnAcc += dt;
  const z = G.zone.id;
  const d = G.depth;
  // spawn interval tightens with depth, and briefly within each zone as it progresses
  const zt = clamp((d - G.zone.from) / (G.zone.to - G.zone.from), 0, 1);
  const rate = (0.75 + z * 0.5 + zt * 0.5) * (1 + G.t / 900);
  const interval = 1 / rate;
  const cap = G.boss ? 36 : (V.quality ? 130 : 90);
  while (G.spawnAcc > interval) {
    G.spawnAcc -= interval;
    if (G.enemies.length >= cap) break;
    const opts = [];
    for (const k in ETYPES) { const w = ETYPES[k].w[z]; if (w > 0) opts.push({ k, w }); }
    const k = weighted(opts).k;
    const a = rand(TAU), R = Math.hypot(V.w, V.h) * 0.55 + 60;
    const x = G.player.x + Math.cos(a) * R, y = G.player.y + Math.sin(a) * R;
    const T = ETYPES[k];
    const elite = z >= 2 && Math.random() < 0.02 + z * 0.015;
    if (T.group) {
      const n = randi(T.group[0], T.group[1]) + z;
      for (let i = 0; i < n; i++) spawnEnemy(k, x + rand(-30, 30), y + rand(-30, 30));
      G.spawnAcc -= interval * 1.5;
    } else spawnEnemy(k, x, y, elite);
  }
}

function damageAny(e, dmg, kx, ky, src) {
  if (e.isBoss) return damageBoss(e, dmg, src);
  if (e.dead) return;
  const crit = Math.random() < 0.08;
  if (crit) dmg *= 2;
  e.hp -= dmg; e.flash = 0.06;
  const kres = e.type === 'isopod' || e.type === 'siph' ? 0.25 : e.elite ? 0.4 : 1;
  e.kx += kx * kres; e.ky += ky * kres;
  G.stats.dealt += dmg;
  dmgNumber(e, e.x, e.y - e.r - 4, dmg, crit);
  SFX.hit();
  if (e.hp <= 0) killEnemy(e);
}

// damage numbers are pooled per target so rapid hits read as one number
function dmgNumber(e, x, y, dmg, crit) {
  if (!G.showDmg) return;
  e._dAcc = (e._dAcc || 0) + dmg;
  if (crit) e._dCrit = true;
  if (G.t - (e._dT || -1) < 0.3 && e.hp > 0) return;
  FX.text(x, y, Math.round(e._dAcc) + (e._dCrit ? '!' : ''), e._dCrit ? '#ffd36b' : (e.isBoss ? '#ffe6c2' : '#e3f6f3'), e.isBoss && e._dAcc > 200);
  e._dAcc = 0; e._dCrit = false; e._dT = G.t;
}

function killEnemy(e) {
  e.dead = true;
  G.stats.kills++;
  const col = enemyColor(e);
  FX.burst(e.x, e.y, col, e.r > 15 ? 18 : 10, 150 + e.r * 4, 0.55, 4);
  FX.ring(e.x, e.y, col, 4, e.r * 2.6, 0.35, 3);
  for (let i = 0; i < Math.min(6, e.r / 3); i++) FX.spawn({ x: e.x, y: e.y, vx: rand(-90, 90), vy: rand(-90, 90), life: rand(0.5, 0.9), size: rand(2, 4), col: mix(col, [20, 30, 40], 0.6), kind: 'chunk', add: false, vr: rand(-8, 8), drag: 3 });
  G.lights.push({ x: e.x, y: e.y, r: e.r * 5, life: 0.3, max: 0.3 });
  dropXp(e.x, e.y, e.xp);
  if (e.elite) { FX.shake(6); dropHeal(e.x, e.y); }
  else if (Math.random() < 0.012) dropHeal(e.x, e.y);
  SFX.kill();
}

function dropXp(x, y, v) {
  // break the value into orbs: big (10), mid (3), small (1)
  while (v > 0) {
    const val = v >= 10 ? 10 : v >= 3 ? 3 : 1; v -= val;
    if (G.orbs.length > 260) { const o = G.orbs[(Math.random() * G.orbs.length) | 0]; o.v += val; continue; }
    const a = rand(TAU), s = rand(20, 80);
    G.orbs.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, v: val, t: rand(10), heal: 0, pull: false });
  }
}
function dropHeal(x, y) { G.orbs.push({ x, y, vx: 0, vy: 0, v: 0, t: 0, heal: 25, pull: false }); }

function enemyColor(e) {
  switch (e.type) {
    case 'lantern': return COL.bio;
    case 'jelly': return e.ph > Math.PI ? COL.pink : COL.violet;
    case 'comb': return COL.blue;
    case 'squid': return COL.blue;
    case 'angler': return COL.lure;
    case 'viper': return [140, 200, 255];
    case 'siph': return COL.pink;
    case 'isopod': return [190, 200, 220];
  }
  return COL.white;
}

const _n = [];
function updateEnemies(dt) {
  const p = G.player;
  const far = Math.hypot(V.w, V.h) * 0.95 + 150;
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.t += dt; e.flash = Math.max(0, e.flash - dt); e.reveal = Math.max(0, e.reveal - dt);
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx);
    let tvx = 0, tvy = 0;
    switch (e.type) {
      case 'lantern': {
        const wob = Math.sin(e.t * 3 + e.ph) * 0.6;
        tvx = Math.cos(a + wob) * e.speed; tvy = Math.sin(a + wob) * e.speed;
        break;
      }
      case 'jelly': {
        const pulse = Math.max(0, Math.sin(e.t * 2.2 + e.ph));
        const s = e.speed * (0.3 + pulse * 1.8);
        tvx = Math.cos(a) * s; tvy = Math.sin(a) * s;
        break;
      }
      case 'comb': {
        const want = 210;
        const radial = d > want + 30 ? 1 : d < want - 30 ? -1 : 0;
        const tang = Math.sin(e.ph) > 0 ? 1 : -1;
        tvx = (Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * tang * 0.7) * e.speed;
        tvy = (Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * tang * 0.7) * e.speed;
        e.st -= dt;
        if (e.st <= 0 && d < 380) {
          e.st = rand(2.2, 3.2);
          const n = e.elite ? 5 : G.zone.id >= 3 ? 3 : 1;
          for (let i = 0; i < n; i++) {
            const aa = a + (i - (n - 1) / 2) * 0.28;
            G.eshots.push({ x: e.x, y: e.y, vx: Math.cos(aa) * 150, vy: Math.sin(aa) * 150, r: 6, dmg: 9, life: 4, col: COL.blue });
          }
          FX.ring(e.x, e.y, COL.blue, 4, 20, 0.25, 2);
        }
        break;
      }
      case 'squid': {
        // 0: approach, 1: wind-up (telegraph), 2: dash, 3: recover
        e.st -= dt;
        if (e.state === 0) {
          tvx = Math.cos(a) * e.speed; tvy = Math.sin(a) * e.speed; e.face = a;
          if (d < 230 && e.st <= 0) { e.state = 1; e.st = 0.55; e.da = a; }
        } else if (e.state === 1) {
          e.face = a; e.da = a;
          if (e.st <= 0) { e.state = 2; e.st = 0.38; e.vx = Math.cos(e.da) * 470; e.vy = Math.sin(e.da) * 470; FX.bubbles(e.x, e.y, 4, 60); }
        } else if (e.state === 2) {
          tvx = e.vx; tvy = e.vy;
          if (e.st <= 0) { e.state = 3; e.st = 1.3; for (let i = 0; i < 6; i++) FX.spawn({ x: e.x, y: e.y, vx: rand(-40, 40), vy: rand(-40, 40), life: 1.6, size: rand(10, 18), size1: rand(20, 30), col: [5, 8, 14], kind: 'ink', add: false, drag: 2 }); }
        } else { tvx = -Math.cos(a) * 40; tvy = -Math.sin(a) * 40; if (e.st <= 0) { e.state = 0; e.st = rand(0.6, 1.4); } }
        break;
      }
      case 'angler': {
        e.st -= dt;
        if (e.state === 0) {
          tvx = Math.cos(a) * e.speed; tvy = Math.sin(a) * e.speed; e.face += angDiff(e.face, a) * dt * 3;
          if (d < 210 && e.st <= 0) { e.state = 1; e.st = 0.7; }
        } else if (e.state === 1) {
          e.face += angDiff(e.face, a) * dt * 6;
          if (e.st <= 0) { e.state = 2; e.st = 0.5; e.vx = Math.cos(e.face) * 400; e.vy = Math.sin(e.face) * 400; }
        } else if (e.state === 2) {
          tvx = e.vx; tvy = e.vy;
          if (e.st <= 0) { e.state = 0; e.st = rand(1.6, 2.4); }
        }
        break;
      }
      case 'viper': {
        const wob = Math.sin(e.t * 5 + e.ph) * 0.35;
        tvx = Math.cos(a + wob) * e.speed; tvy = Math.sin(a + wob) * e.speed; e.face = Math.atan2(tvy, tvx);
        break;
      }
      case 'siph': {
        const wob = Math.sin(e.t * 1.4 + e.ph) * 0.9;
        e.face += angDiff(e.face, a + wob) * dt * 1.6;
        tvx = Math.cos(e.face) * e.speed; tvy = Math.sin(e.face) * e.speed;
        break;
      }
      case 'isopod': {
        e.face += angDiff(e.face, a) * dt * 2;
        tvx = Math.cos(e.face) * e.speed; tvy = Math.sin(e.face) * e.speed;
        break;
      }
    }
    if (e.flee) {
      tvx = -Math.cos(a) * e.speed * 1.6; tvy = -Math.sin(a) * e.speed * 1.6;
      if (d > far * 0.62) { e.dead = true; continue; }
    }
    if (e.flee || e.state !== 2 || (e.type !== 'squid' && e.type !== 'angler')) {
      const k = 1 - Math.exp(-4 * dt);
      e.vx += (tvx - e.vx) * k; e.vy += (tvy - e.vy) * k;
    }
    const kd = Math.exp(-6 * dt);
    e.x += (e.vx + e.kx) * dt; e.y += (e.vy + e.ky) * dt;
    e.kx *= kd; e.ky *= kd;
    if (e.type !== 'squid' && e.type !== 'angler' && e.type !== 'siph' && e.type !== 'isopod' && e.type !== 'viper') {
      if (Math.abs(e.vx) + Math.abs(e.vy) > 5) e.face = Math.atan2(e.vy, e.vx);
    }
    if (e.seg) {
      let px = e.x, py = e.y;
      for (const s of e.seg) {
        const sd = dist(px, py, s.x, s.y);
        if (sd > 12) { const t = (sd - 12) / sd; s.x += (px - s.x) * t; s.y += (py - s.y) * t; }
        px = s.x; py = s.y;
      }
    }
    // recycle creatures that drift far off-screen
    if (d > far) {
      const ra = rand(TAU), R = Math.hypot(V.w, V.h) * 0.55 + 40;
      const nx = p.x + Math.cos(ra) * R, ny = p.y + Math.sin(ra) * R;
      if (e.seg) for (const s of e.seg) { s.x += nx - e.x; s.y += ny - e.y; }
      e.x = nx; e.y = ny;
    }
    // contact damage
    const rr = e.r + p.r - 3;
    if (d < rr) hurtPlayer(e.dmg, e.x, e.y);
    else if (e.seg) {
      for (let i = 1; i < e.seg.length; i += 2) {
        const s = e.seg[i];
        if (dist2(s.x, s.y, p.x, p.y) < (e.r + p.r - 3) ** 2) { hurtPlayer(e.dmg * 0.7, s.x, s.y); break; }
      }
    }
  }
  // soft separation so schools don't stack into a single blob
  for (const e of G.enemies) {
    if (e.dead) continue;
    G.grid.query(e.x, e.y, e.r, _n);
    for (const o of _n) {
      if (o === e || o.dead || o._sep === e) continue;
      const dx = e.x - o.x, dy = e.y - o.y, mr = (e.r + o.r) * 0.85, d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < mr * mr) {
        const d = Math.sqrt(d2), push = (mr - d) * 0.5 / d;
        e.x += dx * push * 0.5; e.y += dy * push * 0.5; o.x -= dx * push * 0.5; o.y -= dy * push * 0.5;
      }
    }
    e._sep = null;
  }
  for (let i = G.enemies.length - 1; i >= 0; i--) if (G.enemies[i].dead) G.enemies.splice(i, 1);
}

function updateEnemyShots(dt) {
  const p = G.player;
  for (let i = G.eshots.length - 1; i >= 0; i--) {
    const s = G.eshots[i];
    s.life -= dt;
    if (s.accel) { s.vx *= 1 + s.accel * dt; s.vy *= 1 + s.accel * dt; }
    if (s.curve) { const a = Math.atan2(s.vy, s.vx) + s.curve * dt, sp = Math.hypot(s.vx, s.vy); s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; }
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (dist2(s.x, s.y, p.x, p.y) < (s.r + p.r - 4) ** 2) {
      hurtPlayer(s.dmg, s.x, s.y);
      FX.burst(s.x, s.y, s.col, 6, 100, 0.3, 3);
      G.eshots.splice(i, 1); continue;
    }
    if (s.life <= 0) G.eshots.splice(i, 1);
  }
}

function updateOrbs(dt) {
  const p = G.player;
  for (let i = G.orbs.length - 1; i >= 0; i--) {
    const o = G.orbs[i];
    o.t += dt;
    const d = dist(o.x, o.y, p.x, p.y);
    if (d < p.magnet || o.pull || G.vacuum > 0 || o.t > 9) o.pull = true;
    if (o.pull) {
      const a = angTo(o.x, o.y, p.x, p.y), s = 260 + (o.t * 40);
      o.vx += (Math.cos(a) * s - o.vx) * Math.min(1, dt * 8);
      o.vy += (Math.sin(a) * s - o.vy) * Math.min(1, dt * 8);
    } else { o.vx *= Math.exp(-3 * dt); o.vy *= Math.exp(-3 * dt); o.vy -= 4 * dt; }
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (d < p.r + 8) {
      if (o.heal) { p.hp = Math.min(p.maxHp, p.hp + o.heal); FX.text(p.x, p.y - 24, '+' + o.heal, '#7dffb0'); FX.ring(p.x, p.y, COL.green, 10, 40, 0.4, 3); SFX.pick(); }
      else { gainXp(o.v); SFX.pickup(); }
      G.orbs.splice(i, 1);
    }
  }
}

// ---------- creature drawing ----------
function drawEnemy(c, e) {
  c.save(); c.translate(e.x, e.y);
  const fl = e.flash > 0;
  switch (e.type) {
    case 'lantern': {
      c.rotate(e.face);
      c.fillStyle = fl ? '#fff' : '#2f4a5c';
      c.beginPath(); c.ellipse(0, 0, 8, 3.6, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(-6, 0); c.lineTo(-12, -4 + Math.sin(e.t * 18) * 2); c.lineTo(-12, 4 + Math.sin(e.t * 18) * 2); c.closePath(); c.fill();
      c.fillStyle = '#c9e7ef'; c.beginPath(); c.arc(4.5, -0.8, 1.6, 0, TAU); c.fill();
      break;
    }
    case 'jelly': {
      const pulse = Math.max(0, Math.sin(e.t * 2.2 + e.ph));
      const sx = 1 + pulse * 0.12, sy = 1 - pulse * 0.18;
      c.rotate(e.face + Math.PI / 2);
      const col = enemyColor(e);
      // trailing tentacles
      c.strokeStyle = rgba(col, 0.45); c.lineWidth = 1.2;
      for (let i = -2; i <= 2; i++) {
        c.beginPath(); c.moveTo(i * 4, 4);
        for (let j = 1; j <= 6; j++) c.lineTo(i * 4 + Math.sin(e.t * 3 + j * 0.8 + i) * 3, 4 + j * 5);
        c.stroke();
      }
      c.scale(sx * e.r / 15, sy * e.r / 15);
      const g = c.createRadialGradient(0, -4, 1, 0, -2, 16);
      g.addColorStop(0, fl ? '#fff' : rgba(mix(col, [255, 255, 255], 0.5), 0.75)); g.addColorStop(1, rgba(col, 0.15));
      c.fillStyle = g;
      c.beginPath(); c.moveTo(-15, 4); c.bezierCurveTo(-15, -18, 15, -18, 15, 4);
      c.quadraticCurveTo(10, 1, 5, 5); c.quadraticCurveTo(0, 1, -5, 5); c.quadraticCurveTo(-10, 1, -15, 4); c.fill();
      break;
    }
    case 'comb': {
      c.rotate(e.t * 0.6);
      c.fillStyle = fl ? '#fff' : 'rgba(170,220,255,.22)';
      c.beginPath(); c.ellipse(0, 0, e.r * 0.75, e.r, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(200,235,255,.35)'; c.lineWidth = 1; c.stroke();
      break;
    }
    case 'squid': {
      c.rotate(e.face);
      if (e.state === 1) c.translate(rand(-1.5, 1.5), rand(-1.5, 1.5));
      c.fillStyle = fl ? '#fff' : '#3b2a52';
      c.beginPath(); c.moveTo(15, 0); c.quadraticCurveTo(8, -7, -2, -6); c.lineTo(-4, 0); c.lineTo(-2, 6); c.quadraticCurveTo(8, 7, 15, 0); c.fill();
      c.beginPath(); c.moveTo(15, 0); c.lineTo(19, -6); c.lineTo(19, 6); c.closePath(); c.fill();
      c.strokeStyle = fl ? '#fff' : '#3b2a52'; c.lineWidth = 1.6;
      for (let i = -3; i <= 3; i++) {
        c.beginPath(); c.moveTo(-3, i * 1.4);
        const wv = e.state === 2 ? 0.3 : 1;
        c.quadraticCurveTo(-10, i * 2.2 + Math.sin(e.t * 8 + i) * 2 * wv, -17 - Math.abs(i), i * 2.8 + Math.sin(e.t * 6 + i) * 3 * wv);
        c.stroke();
      }
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -3.2, 1.5, 0, TAU); c.arc(0, 3.2, 1.5, 0, TAU); c.fill();
      break;
    }
    case 'angler': {
      c.rotate(e.face); const s = e.r / 19; c.scale(s, s);
      const open = e.state >= 1 ? 1 : 0.35 + Math.sin(e.t * 2) * 0.1;
      c.fillStyle = fl ? '#fff' : '#2a2226';
      c.beginPath(); c.ellipse(-2, 0, 18, 15, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(-18, 0); c.lineTo(-30, -9); c.lineTo(-27, 0); c.lineTo(-30, 9); c.closePath(); c.fill();
      // jaw
      c.fillStyle = '#120b0e';
      c.beginPath(); c.moveTo(16, 0); c.lineTo(4, -9 * open); c.lineTo(4, 9 * open); c.closePath(); c.fill();
      c.fillStyle = '#efe6d8';
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        c.beginPath(); c.moveTo(lerp(15, 5, t), -lerp(1, 9, t) * open); c.lineTo(lerp(13, 3, t), -lerp(1, 9, t) * open + 4); c.lineTo(lerp(11, 1, t), -lerp(1, 9, t) * open); c.fill();
        c.beginPath(); c.moveTo(lerp(15, 5, t), lerp(1, 9, t) * open); c.lineTo(lerp(13, 3, t), lerp(1, 9, t) * open - 4); c.lineTo(lerp(11, 1, t), lerp(1, 9, t) * open); c.fill();
      }
      // illicium (lure stalk)
      c.strokeStyle = '#4a3a3f'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(4, -12); c.quadraticCurveTo(18, -30, 26 + Math.sin(e.t * 2) * 3, -14 + Math.cos(e.t * 2.4) * 3); c.stroke();
      c.fillStyle = '#ffe9b0'; c.beginPath(); c.arc(8, -5, 2, 0, TAU); c.fill();
      break;
    }
    case 'viper': {
      c.rotate(e.face);
      c.fillStyle = fl ? '#fff' : '#1b2633';
      c.beginPath(); c.moveTo(13, 0); c.quadraticCurveTo(6, -6, -8, -3); c.lineTo(-16, 0); c.lineTo(-8, 3); c.quadraticCurveTo(6, 6, 13, 0); c.fill();
      c.beginPath(); c.moveTo(-14, 0); c.lineTo(-21, -5 + Math.sin(e.t * 14) * 2); c.lineTo(-21, 5 + Math.sin(e.t * 14) * 2); c.closePath(); c.fill();
      c.strokeStyle = '#dfe8ee'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(11, -2); c.lineTo(17, -6); c.moveTo(11, 2); c.lineTo(17, 6); c.stroke();
      break;
    }
    case 'siph': {
      c.restore(); c.save();
      for (let i = e.seg.length - 1; i >= 0; i--) {
        const s = e.seg[i];
        c.fillStyle = fl ? '#fff' : `rgba(255,140,210,${0.18 + (1 - i / e.seg.length) * 0.2})`;
        c.beginPath(); c.arc(s.x, s.y, e.r * (1 - i * 0.04), 0, TAU); c.fill();
      }
      c.fillStyle = fl ? '#fff' : 'rgba(255,180,230,.6)';
      c.beginPath(); c.arc(e.x, e.y, e.r * 1.1, 0, TAU); c.fill();
      break;
    }
    case 'isopod': {
      c.rotate(e.face); const s = e.r / 21; c.scale(s, s);
      c.fillStyle = fl ? '#fff' : '#6c6a73';
      c.beginPath(); c.ellipse(0, 0, 22, 14, 0, 0, TAU); c.fill();
      c.strokeStyle = '#3d3b44'; c.lineWidth = 1.4;
      for (let i = -14; i <= 14; i += 5) { c.beginPath(); c.moveTo(i, -13.5 + Math.abs(i) * 0.15); c.quadraticCurveTo(i + 2, 0, i, 13.5 - Math.abs(i) * 0.15); c.stroke(); }
      c.strokeStyle = '#55535c'; c.lineWidth = 1.5;
      for (let i = -10; i <= 10; i += 5) {
        const l = Math.sin(e.t * 10 + i) * 2;
        c.beginPath(); c.moveTo(i, -13); c.lineTo(i + l, -18); c.moveTo(i, 13); c.lineTo(i - l, 18); c.stroke();
      }
      c.beginPath(); c.moveTo(21, -4); c.quadraticCurveTo(30, -10, 33, -4); c.moveTo(21, 4); c.quadraticCurveTo(30, 10, 33, 4); c.stroke();
      break;
    }
  }
  c.restore();
  if (e.elite) {
    c.strokeStyle = 'rgba(255,211,107,.55)'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(e.x, e.y, e.r + 6 + Math.sin(G.t * 4) * 1.5, 0, TAU); c.stroke();
  }
}

// photophores and lures: drawn additively on top of the darkness
function drawEnemyGlow(c, e) {
  const rv = e.reveal > 0 ? Math.min(1, e.reveal) : 0;
  switch (e.type) {
    case 'lantern': {
      const cs = Math.cos(e.face), sn = Math.sin(e.face);
      for (let i = -1; i <= 1; i++) drawGlow(c, e.x + cs * i * 3.5 - sn * 2.5, e.y + sn * i * 3.5 + cs * 2.5, 4, COL.bio, 0.9);
      drawGlow(c, e.x, e.y, 14, COL.bio, 0.25);
      break;
    }
    case 'jelly': {
      const col = enemyColor(e), pulse = Math.max(0, Math.sin(e.t * 2.2 + e.ph));
      drawGlow(c, e.x, e.y, e.r * 2.2, col, 0.35 + pulse * 0.4);
      const fa = e.face + Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        const a = fa + Math.PI + (i / 5 - 0.5) * 2.4;
        drawGlow(c, e.x + Math.cos(a) * e.r * 0.9, e.y + Math.sin(a) * e.r * 0.9, 4, col, 0.6 + pulse * 0.4);
      }
      break;
    }
    case 'comb': {
      // rainbow cilia rows: light scattering along 8 comb rows
      for (let i = 0; i < 8; i++) {
        const a = e.t * 0.6 + (i / 8) * TAU;
        const hue = (e.t * 220 + i * 45) % 360;
        const col = hsl(hue);
        const rx = Math.cos(a) * e.r * 0.72, ry = Math.sin(a) * e.r * 0.95;
        drawGlow(c, e.x + rx, e.y + ry, 5, col, 0.85);
      }
      drawGlow(c, e.x, e.y, e.r * 2, COL.blue, 0.2);
      break;
    }
    case 'squid': {
      const tele = e.state === 1 ? 0.6 + 0.4 * Math.sin(G.t * 40) : 0;
      const cs = Math.cos(e.face), sn = Math.sin(e.face);
      for (let i = 0; i < 5; i++) {
        const t = i / 4 * 22 - 15;
        drawGlow(c, e.x + cs * t, e.y + sn * t, 4.5, COL.blue, 0.7 + tele * 0.3);
      }
      if (tele) drawGlow(c, e.x, e.y, 40, COL.blue, tele * 0.6, true);
      break;
    }
    case 'angler': {
      const s = e.r / 19, cs = Math.cos(e.face), sn = Math.sin(e.face);
      const lx = 26 + Math.sin(e.t * 2) * 3, ly = -14 + Math.cos(e.t * 2.4) * 3;
      const x = e.x + (cs * lx - sn * ly) * s, y = e.y + (sn * lx + cs * ly) * s;
      const flick = e.state === 1 ? 0.5 + 0.5 * Math.sin(G.t * 30) : 0.75 + 0.25 * Math.sin(e.t * 3);
      drawGlow(c, x, y, 26 * s * (1 + (e.state === 1 ? 0.6 : 0)), COL.lure, flick, true);
      drawGlow(c, x, y, 70 * s, COL.lure, 0.18 * flick);
      break;
    }
    case 'viper': {
      const cs = Math.cos(e.face), sn = Math.sin(e.face);
      for (let i = 0; i < 6; i++) {
        const t = 10 - i * 4;
        drawGlow(c, e.x + cs * t + sn * 3, e.y + sn * t - cs * 3, 3, [140, 200, 255], 0.8);
        drawGlow(c, e.x + cs * t - sn * 3, e.y + sn * t + cs * 3, 3, [140, 200, 255], 0.8);
      }
      drawGlow(c, e.x + cs * 8, e.y + sn * 8, 5, COL.coral, 0.9);
      break;
    }
    case 'siph': {
      for (let i = 0; i < e.seg.length; i++) {
        const s = e.seg[i];
        const p = 0.5 + 0.5 * Math.sin(G.t * 6 - i * 0.7);
        drawGlow(c, s.x, s.y, 12, i % 3 === 0 ? COL.pink : COL.violet, 0.3 + p * 0.6);
      }
      drawGlow(c, e.x, e.y, 26, COL.pink, 0.8, true);
      break;
    }
    case 'isopod': {
      const cs = Math.cos(e.face), sn = Math.sin(e.face), s = e.r / 21;
      drawGlow(c, e.x + (cs * 18 - sn * 6) * s, e.y + (sn * 18 + cs * 6) * s, 5, [200, 220, 255], 0.45);
      drawGlow(c, e.x + (cs * 18 + sn * 6) * s, e.y + (sn * 18 - cs * 6) * s, 5, [200, 220, 255], 0.45);
      break;
    }
  }
  if (rv) { c.strokeStyle = rgba(COL.blue, 0.55 * rv); c.lineWidth = 1.5; c.beginPath(); c.arc(e.x, e.y, e.r + 4, 0, TAU); c.stroke(); }
  if (e.elite) drawGlow(c, e.x, e.y, e.r * 2.6, COL.gold, 0.25 + 0.1 * Math.sin(G.t * 4));
}

const _hsl = new Map();
function hsl(h) {
  const k = Math.round(h / 15) * 15 % 360;
  let v = _hsl.get(k);
  if (!v) {
    const f = n => { const kk = (n + k / 30) % 12; return 0.5 - 0.5 * Math.max(-1, Math.min(kk - 3, 9 - kk, 1)); };
    v = [f(0) * 255, f(8) * 255, f(4) * 255]; _hsl.set(k, v);
  }
  return v;
}

function drawOrbs(c) {
  for (const o of G.orbs) {
    if (o.heal) {
      const p = 1 + Math.sin(o.t * 5) * 0.15;
      drawGlow(c, o.x, o.y, 22 * p, COL.green, 0.7, true);
      c.strokeStyle = '#eafff2'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(o.x - 4, o.y); c.lineTo(o.x + 4, o.y); c.moveTo(o.x, o.y - 4); c.lineTo(o.x, o.y + 4); c.stroke();
      continue;
    }
    const col = o.v >= 10 ? COL.pink : o.v >= 3 ? COL.gold : COL.bio;
    const s = o.v >= 10 ? 13 : o.v >= 3 ? 10 : 7;
    drawGlow(c, o.x, o.y, s * (1 + Math.sin(o.t * 6) * 0.15), col, 0.85, true);
  }
}
function drawEnemyShots(c) {
  for (const s of G.eshots) {
    drawGlow(c, s.x, s.y, s.r * 3.2, s.col, 0.85, true);
  }
}
