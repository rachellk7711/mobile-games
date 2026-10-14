// ---------- biomes and level generation ----------
// Heights in metres (1 m = 10 world units). y grows downward, so climbing means y decreasing.
const BIOMES = [
  { id: 0, name: '새벽 송림', en: 'DAWN PINES', from: 0, top: hex('#dfe3e2'), bot: hex('#ece6d8'), ink: hex('#1b1a17'), night: false, flora: 'pine', weather: 'petal', poem: '안개 걷히는 소나무 절벽' },
  { id: 1, name: '대숲', en: 'BAMBOO GROVE', from: 250, top: hex('#d6dfd3'), bot: hex('#e6e4d6'), ink: hex('#1c211b'), night: false, flora: 'bamboo', weather: 'leaf', poem: '바람에 우는 대나무' },
  { id: 2, name: '폭포 계곡', en: 'WATERFALL GORGE', from: 700, top: hex('#cfd6d8'), bot: hex('#e2e2dc'), ink: hex('#17191b'), night: false, flora: 'falls', weather: 'mist', poem: '천 길 물줄기 곁으로' },
  { id: 3, name: '달밤', en: 'MOONLIT NIGHT', from: 1300, top: hex('#232a3d'), bot: hex('#3a3f50'), ink: hex('#0b0d14'), night: true, flora: 'lantern', weather: 'firefly', poem: '등불 하나씩 걸린 밤' },
  { id: 4, name: '뇌우', en: 'THUNDERSTORM', from: 2000, top: hex('#2b2d31'), bot: hex('#45464a'), ink: hex('#0a0a0b'), night: true, storm: true, flora: 'storm', weather: 'rain', poem: '번개가 산을 가른다' },
  { id: 5, name: '구름 위', en: 'ABOVE THE CLOUDS', from: 3000, top: hex('#efd9b4'), bot: hex('#f1e8d6'), ink: hex('#2a1d14'), night: false, flora: 'cloud', weather: 'gold', poem: '해 뜨는 봉우리, 끝없는 하늘' },
];
function biomeAt(m) { let b = BIOMES[0]; for (const x of BIOMES) if (m >= x.from) b = x; return b; }
// smooth palette blend over 40 m before each boundary
function paletteAt(m) {
  const b = biomeAt(m), n = BIOMES[b.id + 1];
  let t = 0; if (n) t = smooth(clamp((m - (n.from - 40)) / 40, 0, 1));
  const p = k => (n ? mix(b[k], n[k], t) : b[k]);
  return { b, top: p('top'), bot: p('bot'), ink: p('ink'), night: n ? lerp(b.night ? 1 : 0, n.night ? 1 : 0, t) : (b.night ? 1 : 0), storm: (b.storm ? 1 - t : 0) + (n && n.storm ? t : 0) };
}

const ROPE_R = 300;   // max rope reach
const Gen = {
  rng: null, nextY: 0, prevRow: [], rowN: 0, lastPow: 0,
  reset(seed) {
    this.rng = mulberry32(seed);
    this.nextY = -160; this.rowN = 0; this.lastPow = 0;
    this.prevRow = [{ x: W / 2, y: 40 }];
  },
  // keep generating until the world reaches above y
  ensure(y) { while (this.nextY > y) this.row(); },
  row() {
    const r = this.rng, m = -this.nextY / M, d = clamp(m / 3000, 0, 1), bio = biomeAt(m);
    const gap = lerp(165, 235, d) + r.range(-18, 18);
    const y = this.nextY;
    const count = d < 0.15 ? 2 : (r.chance(lerp(0.6, 0.35, d)) ? 2 : 1);
    const row = [];
    for (let i = 0; i < count; i++) {
      let x = count === 1 ? r.range(70, W - 70) : (i === 0 ? r.range(55, W / 2 - 25) : r.range(W / 2 + 25, W - 55));
      row.push({ x, y: y + r.range(-25, 25) });
    }
    // reachability: something in this row must be within 82% of rope reach of the previous row
    const reach = ROPE_R * 0.82;
    let best = Infinity, bi = 0, bp = null;
    for (let i = 0; i < row.length; i++) for (const p of this.prevRow) { const dd = dist(row[i].x, row[i].y, p.x, p.y); if (dd < best) { best = dd; bi = i; bp = p; } }
    if (best > reach) { const a = row[bi], t = reach / best; a.x = bp.x + (a.x - bp.x) * t; a.y = bp.y + (a.y - bp.y) * t; }
    for (let i = 0; i < row.length; i++) {
      const a = row[i];
      const type = this.pickType(r, d, bio, i === bi);
      G.anchors.push(makeAnchor(type, a.x, a.y, r));
    }
    // blossoms trace a path from the previous row up to the new one
    if (r.chance(0.65) && bp) {
      const a = row[bi], n = r.int(3, 5), lift = r.range(30, 70);
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1), x = lerp(bp.x, a.x, t), yy = lerp(bp.y, a.y, t) - Math.sin(t * Math.PI) * lift;
        G.items.push({ kind: 'blossom', x, y: yy, t: r.range(0, 6), got: false });
      }
    }
    // hazards and power-ups
    this.hazards(r, d, bio, y, gap, row);
    if (m - this.lastPow > 200 && r.chance(0.35)) {
      this.lastPow = m;
      const kind = r.pick(['charm', 'feather', 'inkstick']);
      const a = row[r.int(0, row.length - 1)];
      G.items.push({ kind, x: clamp(a.x + r.range(-60, 60), 40, W - 40), y: a.y - gap * 0.5, t: 0, got: false });
    }
    this.prevRow = row;
    this.nextY -= gap; this.rowN++;
  },
  pickType(r, d, bio, critical) {
    const opts = [{ k: 'knot', w: 5 }];
    if (bio.id >= 1) opts.push({ k: 'sway', w: 1.5 + d * 2 });
    if (bio.id >= 1) opts.push({ k: 'fragile', w: critical ? 0.6 + d : 1.2 + d * 2 });
    // the anchor that guarantees a route never moves far from where reachability was checked
    if (bio.id >= 2 && !critical) opts.push({ k: 'drift', w: 1 + d * 2 });
    if (bio.id >= 3 && !critical) opts.push({ k: 'crane', w: 0.8 + d });
    let s = 0; for (const o of opts) s += o.w; let x = r() * s;
    for (const o of opts) { x -= o.w; if (x <= 0) return o.k; }
    return 'knot';
  },
  hazards(r, d, bio, y, gap, row) {
    // crows cross the scroll; a warning mark shows on their entry side first
    if (bio.id >= 1 && r.chance(0.12 + d * 0.25)) {
      const dir = r.chance(0.5) ? 1 : -1;
      G.hazards.push({ kind: 'crow', x: dir > 0 ? -60 : W + 60, y: y - gap * 0.5, baseY: y - gap * 0.5, dir, speed: r.range(110, 150) + d * 90, armed: false, t: r.range(0, 6), dead: false });
    }
    // ink spirits orbit an anchor: grab it between passes
    if (bio.id >= 1 && r.chance(0.1 + d * 0.2)) {
      const a = G.anchors[G.anchors.length - 1];
      a.haunted = true;
      G.hazards.push({ kind: 'spirit', cx: a.x, cy: a.y, a: r.range(0, TAU), R: r.range(70, 86), w: (r.chance(0.5) ? 1 : -1) * r.range(1.6, 2.3), anchor: a, x: a.x, y: a.y, dead: false });
    }
    // storm: falling rocks and lightning strikes, both telegraphed
    if (bio.storm && r.chance(0.3)) G.hazards.push({ kind: 'bolt', x: r.range(60, W - 60), y, w: 46, t: 0, state: 'idle', dead: false });
    if (bio.id >= 2 && r.chance(0.08 + d * 0.12)) G.hazards.push({ kind: 'rock', x: r.range(50, W - 50), y: y - 900, vy: 0, armed: false, triggerY: y + 200, dead: false, rot: 0 });
  },
};

function makeAnchor(type, x, y, r) {
  const a = { type, x, y, x0: x, y0: y, t: r.range(0, 6), hold: 0, broken: false, used: 0, dir: r.chance(0.5) ? 1 : -1, amp: 0, speed: 0 };
  if (type === 'sway') { a.amp = r.range(20, 38); a.speed = r.range(1.1, 1.7); }
  if (type === 'drift') { a.amp = r.range(50, 90); a.speed = r.range(0.45, 0.8); }
  if (type === 'crane') { a.speed = r.range(70, 110); }
  return a;
}

function updateAnchors(dt) {
  for (const a of G.anchors) {
    a.t += dt;
    if (a.type === 'sway') { a.x = a.x0 + Math.sin(a.t * a.speed) * a.amp; a.y = a.y0 + (1 - Math.cos(a.t * a.speed * 2)) * 4; }
    else if (a.type === 'drift') { a.x = a.x0 + Math.sin(a.t * a.speed) * a.amp; a.y = a.y0 + Math.sin(a.t * a.speed * 1.7) * 10; }
    else if (a.type === 'crane') {
      a.x += a.dir * a.speed * dt; a.y = a.y0 + Math.sin(a.t * 3) * 6;
      if (a.x < 40) { a.x = 40; a.dir = 1; } if (a.x > W - 40) { a.x = W - 40; a.dir = -1; }
    }
    a.used = Math.max(0, a.used - dt);
  }
}
