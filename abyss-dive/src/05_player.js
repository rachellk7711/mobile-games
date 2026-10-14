// ---------- player submersible, weapons, upgrades ----------
const COL = {
  bio: hex('#6ff3e0'), lure: hex('#ffb84d'), coral: hex('#ff5d73'), white: [255, 255, 255],
  violet: hex('#a98bff'), blue: hex('#5fb8ff'), gold: hex('#ffd36b'), green: hex('#7dffb0'), pink: hex('#ff7ad9'),
};

const WSTAT = {
  harpoon: { dmg: [10, 12, 14, 17, 20, 24], cd: [0.6, 0.55, 0.5, 0.46, 0.42, 0.38], count: [1, 1, 2, 2, 3, 3], pierce: [0, 0, 0, 1, 1, 2] },
  sonar: { cd: [3.4, 3.1, 2.8, 2.5, 2.3, 2.0], radius: [130, 150, 170, 190, 215, 245], dmg: [9, 12, 15, 18, 22, 27] },
  drone: { count: [1, 2, 2, 3, 4, 5], dmg: [7, 8, 10, 12, 14, 16], orbit: [62, 66, 70, 74, 78, 84], spin: [2.6, 2.8, 3.0, 3.2, 3.4, 3.7] },
  torpedo: { cd: [2.6, 2.4, 2.2, 2.0, 1.8, 1.6], count: [1, 1, 2, 2, 3, 3], dmg: [26, 32, 38, 45, 53, 64], radius: [60, 66, 72, 78, 86, 96] },
  arc: { cd: [1.7, 1.6, 1.5, 1.4, 1.3, 1.2], chains: [3, 4, 5, 6, 7, 8], dmg: [12, 15, 18, 22, 26, 31] },
};
const ws = (id, k, lvl) => WSTAT[id][k][Math.min(lvl, 6) - 1];

const UPG = {
  harpoon: { kind: 'w', name: '작살포', col: COL.bio, max: 6, desc: l => l === 1 ? '가장 가까운 생물에게 작살을 쏩니다.' : ['', '', '피해 +2, 연사 속도 증가', '작살 2발 동시 발사', '작살이 1마리를 관통합니다', '피해 +3, 연사 속도 증가', '작살 3발, 2마리 관통'][l] },
  sonar: { kind: 'w', name: '소나 펄스', col: COL.blue, max: 6, desc: l => l === 1 ? '주기적으로 음파를 퍼뜨려 주변 생물을 밀어내고 드러냅니다.' : ['', '', '범위와 피해 증가', '주기 단축, 피해 증가', '범위 증가, 피해 증가', '범위와 피해 크게 증가', '최대 범위, 2초마다 발사'][l] },
  drone: { kind: 'w', name: '발광 드론', col: COL.gold, max: 6, desc: l => l === 1 ? '빛나는 드론이 잠수정 주위를 돌며 부딪힌 생물을 공격합니다. 어둠도 밝힙니다.' : ['', '', '드론 2기', '피해와 회전 속도 증가', '드론 3기', '드론 4기', '드론 5기, 피해 최대'][l] },
  torpedo: { kind: 'w', name: '유도 어뢰', col: COL.coral, max: 6, desc: l => l === 1 ? '적을 추적하는 어뢰를 쏘아 범위 폭발을 일으킵니다.' : ['', '', '피해와 폭발 범위 증가', '어뢰 2발 동시 발사', '피해 증가, 발사 간격 단축', '어뢰 3발', '폭발 범위와 피해 최대'][l] },
  arc: { kind: 'w', name: '전기 아크', col: COL.violet, max: 6, desc: l => l === 1 ? '전류가 생물 사이를 연쇄적으로 튀며 감전시킵니다.' : ['', '', '연쇄 대상 +1, 피해 증가', '연쇄 대상 +1, 피해 증가', '연쇄 대상 +1, 간격 단축', '연쇄 대상 +1, 피해 증가', '8연쇄, 피해 최대'][l] },
  hull: { kind: 'p', name: '강화 선체', col: COL.green, max: 5, desc: () => '최대 내구도 +20, 즉시 20 수리', apply: p => { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); } },
  plating: { kind: 'p', name: '티타늄 장갑', col: COL.green, max: 5, desc: () => '받는 피해 2 감소', apply: p => { p.armor += 2; } },
  thruster: { kind: 'p', name: '추진기 개조', col: COL.bio, max: 5, desc: () => '이동 속도 +9%, 급가속 대기 -8%', apply: p => { p.speed *= 1.09; p.dashMax *= 0.92; } },
  lamp: { kind: 'p', name: '고휘도 탐조등', col: COL.lure, max: 5, desc: () => '조명 반경과 탐조등 거리 +16%', apply: p => { p.lightR *= 1.16; p.coneLen *= 1.16; } },
  magnet: { kind: 'p', name: '흡입 펌프', col: COL.gold, max: 5, desc: () => '플랑크톤 흡입 범위 +35%', apply: p => { p.magnet *= 1.35; } },
  repair: { kind: 'p', name: '자동 수리', col: COL.green, max: 5, desc: () => '초당 내구도 0.5 회복', apply: p => { p.regen += 0.5; } },
  reactor: { kind: 'p', name: '원자로 과급', col: COL.violet, max: 5, desc: () => '모든 무기 재사용 대기 -8%', apply: p => { p.cdMul *= 0.92; } },
  warhead: { kind: 'p', name: '고폭 탄두', col: COL.coral, max: 5, desc: () => '모든 피해 +12%', apply: p => { p.dmgMul *= 1.12; } },
};

function newPlayer() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, r: 12, face: -Math.PI / 2, aim: 0, hp: 100, maxHp: 100, inv: 0, speed: 175,
    dashCd: 0, dashMax: 2.6, dashT: 0, prop: 0, lightR: 165, coneLen: 290, magnet: 95, regen: 0,
    cdMul: 1, dmgMul: 1, armor: 0, droneAng: 0, hitT: 0,
    weapons: { harpoon: { lvl: 1, t: 0.4 } }, passives: {},
  };
}
const lvlOf = (p, id) => (UPG[id].kind === 'w' ? (p.weapons[id] ? p.weapons[id].lvl : 0) : (p.passives[id] || 0));

function applyUpgrade(p, id) {
  const u = UPG[id];
  if (u.kind === 'w') {
    if (p.weapons[id]) p.weapons[id].lvl++;
    else p.weapons[id] = { lvl: 1, t: 0.3 };
  } else {
    p.passives[id] = (p.passives[id] || 0) + 1;
    u.apply(p);
  }
}

function rollUpgrades(p, n = 3) {
  const opts = [];
  const wCount = Object.keys(p.weapons).length;
  for (const id in UPG) {
    const u = UPG[id], l = lvlOf(p, id);
    if (l >= u.max) continue;
    if (u.kind === 'w' && l === 0 && wCount >= 5) continue;
    let w = u.kind === 'w' ? (l === 0 ? 1.3 : 1.6) : 1;
    if (id === 'hull' && p.hp < p.maxHp * 0.5) w += 1;
    opts.push({ id, w });
  }
  const out = [];
  while (out.length < n && opts.length) {
    const o = weighted(opts); out.push(o.id); opts.splice(opts.indexOf(o), 1);
  }
  if (!out.length) out.push('_heal');
  return out;
}

// ---------- player update ----------
function updatePlayer(p, dt) {
  const inp = Input.vec();
  const moving = inp.x * inp.x + inp.y * inp.y > 0.01;
  if (moving && !G.demo) G.moved = true;
  if (p.dashT > 0) {
    p.dashT -= dt;
    if (Math.random() < 0.8) FX.spawn({ x: p.x - Math.cos(p.face) * 14, y: p.y - Math.sin(p.face) * 14, life: 0.35, size: 5, col: COL.bio, drag: 4 });
  } else {
    const k = 1 - Math.exp(-9 * dt);
    p.vx += (inp.x * p.speed - p.vx) * k;
    p.vy += (inp.y * p.speed - p.vy) * k;
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 20) p.face += angDiff(p.face, Math.atan2(p.vy, p.vx)) * Math.min(1, dt * 10);
  p.prop += dt * (6 + sp * 0.12);
  if (moving && Math.random() < dt * 14) FX.bubbles(p.x - Math.cos(p.face) * 18, p.y - Math.sin(p.face) * 18, 1, 20);
  p.inv = Math.max(0, p.inv - dt);
  p.hitT = Math.max(0, p.hitT - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  if (p.regen && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
  if (Input.dashPressed) { Input.dashPressed = false; tryDash(p, inp, moving); }
  updateWeapons(p, dt);
}

function tryDash(p, inp, moving) {
  if (p.dashCd > 0 || G.state !== 'play') return;
  const a = moving ? Math.atan2(inp.y, inp.x) : p.face;
  const s = p.speed * 3.3;
  p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.face = a;
  p.dashT = 0.2; p.inv = Math.max(p.inv, 0.42); p.dashCd = p.dashMax;
  FX.ring(p.x, p.y, COL.bio, 8, 46, 0.35, 3);
  FX.bubbles(p.x, p.y, 10, 90);
  SFX.dash();
}

function hurtPlayer(dmg, sx, sy) {
  const p = G.player;
  if (p.inv > 0 || G.state !== 'play') return;
  dmg = Math.max(1, Math.round(dmg * G.dmgScale - p.armor));
  p.hp -= dmg; p.inv = 0.75; p.hitT = 0.25;
  const a = angTo(sx, sy, p.x, p.y);
  p.vx += Math.cos(a) * 260; p.vy += Math.sin(a) * 260;
  FX.shake(11); FX.hurtFlash(0.55); SFX.hurt(); G.hitstop = 0.06;
  FX.burst(p.x, p.y, COL.coral, 10, 180, 0.4, 4, 'spark');
  FX.text(p.x, p.y - 20, '-' + dmg, '#ff8a98');
  G.stats.damageTaken += dmg;
  if (p.hp <= 0) { p.hp = 0; gameOver(false); }
}

// ---------- weapons ----------
// Bosses get priority unless a creature is right on top of the sub.
function pickTarget(x, y, range) {
  const b = G.boss;
  if (b && !b.dead && !b.dying) {
    const t = bossTargetPoint(b);
    if (dist2(x, y, t.x, t.y) < range * range) return nearestEnemy(x, y, 95, null, true) || b;
  }
  return nearestEnemy(x, y, range);
}
function nearestEnemy(x, y, maxR, exclude, noBoss) {
  let best = null, bd = maxR * maxR;
  for (const e of G.enemies) {
    if (e.dead || (exclude && exclude.has(e))) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  if (!noBoss && G.boss && !G.boss.dead && !G.boss.dying && (!exclude || !exclude.has(G.boss))) {
    const t = bossTargetPoint(G.boss);
    const d = dist2(x, y, t.x, t.y);
    if (d < bd) { best = G.boss; }
  }
  return best;
}
function targetPos(e) { return e.isBoss ? bossTargetPoint(e) : e; }

function updateWeapons(p, dt) {
  const W = p.weapons;
  for (const id in W) {
    const w = W[id];
    if (id === 'drone') { updateDrones(p, w, dt); continue; }
    w.t -= dt;
    if (w.t > 0) continue;
    if (id === 'harpoon') {
      const tgt = pickTarget(p.x, p.y, 440);
      if (!tgt) { w.t = 0.1; continue; }
      const tp = targetPos(tgt);
      // lead the target, then fire a tight parallel volley
      const lt = dist(p.x, p.y, tp.x, tp.y) / 600;
      const tvx = tgt.vx || 0, tvy = tgt.vy || 0;
      const base = angTo(p.x, p.y, tp.x + tvx * lt * 0.8, tp.y + tvy * lt * 0.8);
      const n = ws(id, 'count', w.lvl);
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 9, a = base + (i - (n - 1) / 2) * 0.03;
        const ox = -Math.sin(base) * off, oy = Math.cos(base) * off;
        G.shots.push({ kind: 'harpoon', x: p.x + Math.cos(a) * 14 + ox, y: p.y + Math.sin(a) * 14 + oy, vx: Math.cos(a) * 600, vy: Math.sin(a) * 600, a, r: 5, dmg: ws(id, 'dmg', w.lvl) * p.dmgMul, pierce: ws(id, 'pierce', w.lvl), life: 0.9, hit: new Set() });
      }
      p.aim = base;
      SFX.harpoon();
      w.t = ws(id, 'cd', w.lvl) * p.cdMul;
    } else if (id === 'sonar') {
      G.pulses.push({ x: p.x, y: p.y, r: 10, rmax: ws(id, 'radius', w.lvl), dmg: ws(id, 'dmg', w.lvl) * p.dmgMul, hit: new Set() });
      SFX.sonar();
      w.t = ws(id, 'cd', w.lvl) * p.cdMul;
    } else if (id === 'torpedo') {
      const n = ws(id, 'count', w.lvl);
      for (let i = 0; i < n; i++) {
        const a = p.face + Math.PI + (i - (n - 1) / 2) * 0.6 + rand(-0.2, 0.2);
        G.shots.push({ kind: 'torp', x: p.x, y: p.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, a, r: 6, dmg: ws(id, 'dmg', w.lvl) * p.dmgMul, rad: ws(id, 'radius', w.lvl), life: 3.2, target: null, age: 0 });
      }
      SFX.torpedo();
      w.t = ws(id, 'cd', w.lvl) * p.cdMul;
    } else if (id === 'arc') {
      const first = pickTarget(p.x, p.y, 240);
      if (!first) { w.t = 0.15; continue; }
      const hit = new Set(), pts = [{ x: p.x, y: p.y }];
      let cur = first, n = ws(id, 'chains', w.lvl);
      const dmg = ws(id, 'dmg', w.lvl) * p.dmgMul;
      while (cur && n-- > 0) {
        hit.add(cur);
        const tp = targetPos(cur);
        pts.push({ x: tp.x, y: tp.y });
        damageAny(cur, dmg, 0, 0, 'arc');
        cur = nearestEnemy(tp.x, tp.y, 150, hit);
      }
      G.bolts.push({ pts, life: 0.22, max: 0.22, seed: Math.random() * 1000 });
      SFX.zap();
      w.t = ws(id, 'cd', w.lvl) * p.cdMul;
    }
  }
}

function dronePositions(p) {
  const w = p.weapons.drone; if (!w) return [];
  const n = ws('drone', 'count', w.lvl), R = ws('drone', 'orbit', w.lvl), out = [];
  for (let i = 0; i < n; i++) {
    const a = p.droneAng + (i / n) * TAU;
    out.push({ x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R * 0.92 });
  }
  return out;
}
const _q = [];
function updateDrones(p, w, dt) {
  p.droneAng += ws('drone', 'spin', w.lvl) * dt;
  const dmg = ws('drone', 'dmg', w.lvl) * p.dmgMul;
  for (const d of dronePositions(p)) {
    G.grid.query(d.x, d.y, 12, _q);
    for (const e of _q) {
      if (e.dead || (e._dr || 0) > G.t) continue;
      if (dist2(d.x, d.y, e.x, e.y) < (e.r + 9) * (e.r + 9)) {
        e._dr = G.t + 0.35;
        const a = angTo(p.x, p.y, e.x, e.y);
        damageAny(e, dmg, Math.cos(a) * 120, Math.sin(a) * 120, 'drone');
        FX.burst(d.x, d.y, COL.gold, 3, 90, 0.25, 3);
        SFX.drone();
      }
    }
    if (G.boss && !G.boss.dead && (G.boss._dr || 0) <= G.t && bossHitTest(G.boss, d.x, d.y, 9)) {
      G.boss._dr = G.t + 0.3; damageAny(G.boss, dmg, 0, 0, 'drone'); FX.burst(d.x, d.y, COL.gold, 3, 90, 0.25, 3);
    }
  }
}

function updateShots(dt) {
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i];
    s.life -= dt;
    if (s.kind === 'torp') {
      s.age += dt;
      if (!s.target || s.target.dead || s.target.dying) s.target = pickTarget(s.x, s.y, 560);
      const sp = Math.min(430, 160 + s.age * 520);
      if (s.target && s.age > 0.15) {
        const tp = targetPos(s.target);
        s.a += clamp(angDiff(s.a, angTo(s.x, s.y, tp.x, tp.y)), -6 * dt, 6 * dt);
      } else if (s.age > 0.15) s.a = Math.atan2(s.vy, s.vx);
      s.vx = Math.cos(s.a) * sp; s.vy = Math.sin(s.a) * sp;
      if (Math.random() < 0.7) FX.bubbles(s.x - Math.cos(s.a) * 8, s.y - Math.sin(s.a) * 8, 1, 10);
    }
    s.x += s.vx * dt; s.y += s.vy * dt;
    let done = s.life <= 0;
    if (!done) {
      G.grid.query(s.x, s.y, s.r + 4, _q);
      for (const e of _q) {
        if (e.dead || (s.hit && s.hit.has(e))) continue;
        if (dist2(s.x, s.y, e.x, e.y) < (e.r + s.r) * (e.r + s.r)) {
          if (s.kind === 'torp') { done = true; break; }
          s.hit.add(e);
          damageAny(e, s.dmg, s.vx * 0.25, s.vy * 0.25, 'harpoon');
          FX.burst(s.x, s.y, COL.bio, 4, 120, 0.25, 3, 'spark');
          if (s.pierce-- <= 0) { done = true; break; }
        }
      }
      if (!done && G.boss && !G.boss.dead && !(s.hit && s.hit.has(G.boss)) && bossHitTest(G.boss, s.x, s.y, s.r)) {
        if (s.kind === 'torp') done = true;
        else {
          s.hit.add(G.boss);
          damageAny(G.boss, s.dmg, 0, 0, 'harpoon');
          FX.burst(s.x, s.y, COL.bio, 4, 120, 0.25, 3, 'spark');
          if (s.pierce-- <= 0) done = true;
        }
      }
    }
    if (done) {
      if (s.kind === 'torp') explode(s.x, s.y, s.rad, s.dmg, COL.coral);
      G.shots.splice(i, 1);
    }
  }
  // sonar pulses
  for (let i = G.pulses.length - 1; i >= 0; i--) {
    const pu = G.pulses[i];
    pu.r += 420 * dt;
    for (const e of G.enemies) {
      if (e.dead || pu.hit.has(e)) continue;
      const d = dist(pu.x, pu.y, e.x, e.y);
      if (d < pu.r + e.r && d > pu.r - 40) {
        pu.hit.add(e);
        const a = angTo(pu.x, pu.y, e.x, e.y);
        damageAny(e, pu.dmg, Math.cos(a) * 260, Math.sin(a) * 260, 'sonar');
        e.reveal = 2.5;
      }
    }
    if (G.boss && !G.boss.dead && !pu.hit.has(G.boss)) {
      const t = bossTargetPoint(G.boss);
      if (dist(pu.x, pu.y, t.x, t.y) < pu.r + G.boss.r) { pu.hit.add(G.boss); damageAny(G.boss, pu.dmg, 0, 0, 'sonar'); G.boss.reveal = 2.5; }
    }
    if (pu.r >= pu.rmax) G.pulses.splice(i, 1);
  }
  for (let i = G.bolts.length - 1; i >= 0; i--) { G.bolts[i].life -= dt; if (G.bolts[i].life <= 0) G.bolts.splice(i, 1); }
}

function explode(x, y, rad, dmg, col) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = dist(x, y, e.x, e.y);
    if (d < rad + e.r) {
      const a = angTo(x, y, e.x, e.y), f = 1 - d / (rad + e.r);
      damageAny(e, dmg * (0.5 + 0.5 * f), Math.cos(a) * 300 * f, Math.sin(a) * 300 * f, 'torp');
    }
  }
  if (G.boss && !G.boss.dead && bossHitTest(G.boss, x, y, rad)) damageAny(G.boss, dmg, 0, 0, 'torp');
  FX.ring(x, y, col, 6, rad, 0.4, 5);
  FX.burst(x, y, col, 16, rad * 3, 0.5, 5);
  FX.burst(x, y, COL.white, 6, rad * 2, 0.25, 4);
  FX.bubbles(x, y, 8, 80);
  G.lights.push({ x, y, r: rad * 2.4, life: 0.35, max: 0.35 });
  FX.shake(5); SFX.explode(false);
}

// ---------- drawing ----------
function drawPlayer(c, p) {
  if (p.inv > 0 && p.dashT <= 0 && Math.floor(G.t * 20) % 2 === 0) c.globalAlpha = 0.45;
  c.save(); c.translate(p.x, p.y); c.rotate(p.face);
  // propeller
  const pr = p.prop;
  c.fillStyle = '#2b3a42';
  for (let i = 0; i < 3; i++) {
    const a = pr + i * TAU / 3;
    c.save(); c.translate(-20, 0); c.scale(0.35, 1); c.rotate(a);
    c.beginPath(); c.ellipse(0, -5, 2.6, 5.5, 0, 0, TAU); c.fill(); c.restore();
  }
  c.fillStyle = '#39484f'; c.fillRect(-21, -1.5, 5, 3);
  // fins
  c.fillStyle = '#c4581f';
  c.beginPath(); c.moveTo(-10, -8); c.lineTo(-19, -15); c.lineTo(-15, -6); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-10, 8); c.lineTo(-19, 15); c.lineTo(-15, 6); c.closePath(); c.fill();
  // float hull (Trieste-style yellow-orange)
  const g = c.createLinearGradient(0, -11, 0, 11);
  g.addColorStop(0, '#ffe08a'); g.addColorStop(0.45, '#f2a83a'); g.addColorStop(1, '#a3501a');
  c.fillStyle = p.hitT > 0 ? '#ffffff' : g;
  c.beginPath(); c.moveTo(19, 0);
  c.bezierCurveTo(19, -9, 10, -11, 0, -11); c.lineTo(-10, -10);
  c.bezierCurveTo(-17, -9, -17, 9, -10, 10); c.lineTo(0, 11);
  c.bezierCurveTo(10, 11, 19, 9, 19, 0); c.fill();
  // stripe + rivets
  c.fillStyle = 'rgba(60,25,8,.5)'; c.fillRect(-6, -10.5, 2.2, 21);
  c.fillStyle = 'rgba(255,240,200,.55)';
  for (let i = -8; i <= 8; i += 4) { c.fillRect(-1, i - 0.5, 1, 1); }
  // conning tower
  c.fillStyle = '#e2902c'; c.beginPath(); c.ellipse(-1, 0, 5.5, 4, 0, 0, TAU); c.fill();
  c.fillStyle = '#ffd88a'; c.beginPath(); c.ellipse(-2, -1.2, 3, 1.6, 0, 0, TAU); c.fill();
  // observation sphere window
  c.fillStyle = '#062a33'; c.beginPath(); c.arc(12, 0, 4.4, 0, TAU); c.fill();
  c.fillStyle = 'rgba(160,255,240,.9)'; c.beginPath(); c.arc(12.8, -1.2, 1.6, 0, TAU); c.fill();
  c.restore();
  c.globalAlpha = 1;
  // drones
  for (const d of dronePositions(p)) {
    c.fillStyle = '#3d3320'; c.beginPath(); c.arc(d.x, d.y, 5.5, 0, TAU); c.fill();
    c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(d.x, d.y, 3, 0, TAU); c.fill();
  }
}
function drawPlayerGlow(c, p) {
  const fx = p.x + Math.cos(p.face) * 18, fy = p.y + Math.sin(p.face) * 18;
  drawGlow(c, fx, fy, 22, COL.bio, 0.55, true);
  drawGlow(c, p.x + Math.cos(p.face) * 12, p.y + Math.sin(p.face) * 12, 9, COL.bio, 0.8, true);
  // navigation lights: port red, starboard green, blinking
  const blink = Math.sin(G.t * 5) > 0.2 ? 1 : 0.25;
  const px = Math.cos(p.face + Math.PI / 2), py = Math.sin(p.face + Math.PI / 2);
  drawGlow(c, p.x - px * 11 - Math.cos(p.face) * 4, p.y - py * 11 - Math.sin(p.face) * 4, 7, [255, 70, 70], blink);
  drawGlow(c, p.x + px * 11 - Math.cos(p.face) * 4, p.y + py * 11 - Math.sin(p.face) * 4, 7, [70, 255, 140], blink);
  for (const d of dronePositions(p)) drawGlow(c, d.x, d.y, 22, COL.gold, 0.85, true);
  if (p.dashT > 0) drawGlow(c, p.x, p.y, 40, COL.bio, 0.5);
}

function drawShots(c) {
  for (const s of G.shots) {
    if (s.kind === 'harpoon') {
      c.save(); c.translate(s.x, s.y); c.rotate(s.a);
      c.strokeStyle = '#cfe9ea'; c.lineWidth = 2; c.beginPath(); c.moveTo(-14, 0); c.lineTo(4, 0); c.stroke();
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(8, 0); c.lineTo(2, -3); c.lineTo(2, 3); c.closePath(); c.fill();
      c.restore();
    } else {
      c.save(); c.translate(s.x, s.y); c.rotate(s.a);
      c.fillStyle = '#4b5a61'; c.beginPath(); c.ellipse(0, 0, 9, 3.4, 0, 0, TAU); c.fill();
      c.fillStyle = '#ff5d73'; c.beginPath(); c.ellipse(6, 0, 3, 2.8, 0, 0, TAU); c.fill();
      c.restore();
    }
  }
}
function drawShotsGlow(c) {
  for (const s of G.shots) {
    if (s.kind === 'harpoon') drawGlow(c, s.x - Math.cos(s.a) * 4, s.y - Math.sin(s.a) * 4, 14, COL.bio, 0.6);
    else { drawGlow(c, s.x, s.y, 20, COL.coral, 0.7, true); drawGlow(c, s.x - Math.cos(s.a) * 12, s.y - Math.sin(s.a) * 12, 12, COL.lure, 0.5); }
  }
  for (const pu of G.pulses) {
    const k = 1 - pu.r / pu.rmax;
    c.strokeStyle = rgba(COL.blue, 0.75 * k + 0.1); c.lineWidth = 2 + 4 * k;
    c.beginPath(); c.arc(pu.x, pu.y, pu.r, 0, TAU); c.stroke();
    c.strokeStyle = rgba(COL.white, 0.35 * k); c.lineWidth = 1;
    c.beginPath(); c.arc(pu.x, pu.y, pu.r * 0.92, 0, TAU); c.stroke();
  }
  for (const b of G.bolts) {
    const k = b.life / b.max;
    for (let pass = 0; pass < 2; pass++) {
      c.strokeStyle = pass ? rgba(COL.white, k) : rgba(COL.violet, 0.8 * k);
      c.lineWidth = pass ? 1.4 : 5 * k + 1;
      c.beginPath();
      for (let i = 0; i < b.pts.length - 1; i++) {
        const a = b.pts[i], z = b.pts[i + 1];
        if (i === 0) c.moveTo(a.x, a.y);
        const segs = 6;
        for (let j = 1; j <= segs; j++) {
          const t = j / segs;
          const jit = j === segs ? 0 : (Math.sin(b.seed + i * 13 + j * 7.1 + G.t * 60) * 9);
          const nx = -(z.y - a.y), ny = z.x - a.x, nl = Math.hypot(nx, ny) || 1;
          c.lineTo(lerp(a.x, z.x, t) + nx / nl * jit, lerp(a.y, z.y, t) + ny / nl * jit);
        }
      }
      c.stroke();
    }
    for (let i = 1; i < b.pts.length; i++) drawGlow(c, b.pts[i].x, b.pts[i].y, 18, COL.violet, k);
  }
}
