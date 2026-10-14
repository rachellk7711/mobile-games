// ---------- canvas, sprite caches, ocean zones ----------
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const V = { w: 360, h: 640, dpr: 1, camX: 0, camY: 0, shakeX: 0, shakeY: 0, quality: store.get('quality', 1) };
const lightCv = document.createElement('canvas');
const lctx = lightCv.getContext('2d');
const LS = 0.5; // light-map resolution relative to CSS px
let vignetteCv = null;

function resize() {
  const dprCap = V.quality ? 2 : 1.25;
  V.dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  V.w = Math.max(1, cv.clientWidth || window.innerWidth);
  V.h = Math.max(1, cv.clientHeight || window.innerHeight);
  cv.width = Math.round(V.w * V.dpr); cv.height = Math.round(V.h * V.dpr);
  lightCv.width = Math.ceil(V.w * LS); lightCv.height = Math.ceil(V.h * LS);
  buildVignette();
  buildCracks();
}

function buildVignette() {
  vignetteCv = document.createElement('canvas');
  const w = vignetteCv.width = Math.ceil(V.w / 2), h = vignetteCv.height = Math.ceil(V.h / 2);
  const c = vignetteCv.getContext('2d');
  const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.65)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}

// Pre-rendered glow sprites: drawImage instead of shadowBlur (cheap on phones).
const Spr = {
  cache: new Map(),
  glow(col, hot = false) {
    const key = col.join(',') + (hot ? 'h' : '');
    let s = this.cache.get(key);
    if (s) return s;
    s = document.createElement('canvas'); s.width = s.height = 128;
    const c = s.getContext('2d');
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    if (hot) { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, rgba(mix(col, [255, 255, 255], 0.5), 0.9)); }
    else g.addColorStop(0, rgba(col, 1));
    g.addColorStop(0.28, rgba(col, 0.42));
    g.addColorStop(0.6, rgba(col, 0.1));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    this.cache.set(key, s); return s;
  },
  light: null, cone: null,
  build() {
    // soft white disc used to punch holes into the darkness map
    const l = this.light = document.createElement('canvas'); l.width = l.height = 128;
    let c = l.getContext('2d');
    let g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    // headlight cone pointing +x from (0,128); nested wedges give a soft edge
    const k = this.cone = document.createElement('canvas'); k.width = 256; k.height = 256;
    c = k.getContext('2d');
    for (let i = 0; i < 7; i++) {
      const a = 0.16 + i * 0.05;
      g = c.createRadialGradient(0, 128, 0, 0, 128, 256);
      g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(0.7, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, 128); c.arc(0, 128, 256, -a, a); c.closePath(); c.fill();
    }
  },
};
Spr.build();

function drawGlow(c, x, y, r, col, a = 1, hot = false) {
  if (a <= 0.01) return;
  c.globalAlpha = a;
  c.drawImage(Spr.glow(col, hot), x - r, y - r, r * 2, r * 2);
  c.globalAlpha = 1;
}

// ---------- ocean zones (real pelagic layers) ----------
const ZONES = [
  { id: 0, name: '표층', en: 'EPIPELAGIC', from: 0, to: 200, secs: 35, top: hex('#3aa6c0'), bot: hex('#0f5e86'), dark: 0.0, snow: hex('#cfeff2'), tint: hex('#04202e'), temp: [20, 16] },
  { id: 1, name: '중층 · 박광대', en: 'MESOPELAGIC', from: 200, to: 1000, secs: 120, top: hex('#0d4a70'), bot: hex('#061f3a'), dark: 0.55, snow: hex('#9fd6e0'), tint: hex('#020c18'), temp: [16, 5] },
  { id: 2, name: '점심해층 · 무광대', en: 'BATHYPELAGIC', from: 1000, to: 4000, secs: 170, top: hex('#071a33'), bot: hex('#030b1a'), dark: 0.86, snow: hex('#7fb4c4'), tint: hex('#01050c'), temp: [5, 2.5] },
  { id: 3, name: '심해저층', en: 'ABYSSOPELAGIC', from: 4000, to: 6000, secs: 140, top: hex('#060c1e'), bot: hex('#03040e'), dark: 0.93, snow: hex('#7f9fc4'), tint: hex('#010208'), temp: [2.5, 1.5] },
  { id: 4, name: '초심해층 · 해구', en: 'HADOPELAGIC', from: 6000, to: 10935, secs: 170, top: hex('#120821'), bot: hex('#05020c'), dark: 0.95, snow: hex('#b49fd6'), tint: hex('#030108'), temp: [1.5, 1.1] },
];
const FINAL_DEPTH = 10935;
function zoneAt(d) { for (const z of ZONES) if (d < z.to) return z; return ZONES[ZONES.length - 1]; }
// Smoothly blended palette across a 250 m band around each boundary.
function oceanAt(d) {
  const z = zoneAt(d);
  const n = ZONES[z.id + 1];
  let t = 0;
  if (n) { const band = Math.min(250, (z.to - z.from) * 0.4); t = smooth(clamp((d - (z.to - band)) / band, 0, 1)); }
  const pick2 = k => (n ? mix(z[k], n[k], t) : z[k]);
  const zt = clamp((d - z.from) / (z.to - z.from), 0, 1);
  return {
    zone: z, top: pick2('top'), bot: pick2('bot'), snow: pick2('snow'), tint: pick2('tint'),
    dark: n ? lerp(z.dark, n.dark, t) : z.dark,
    sun: clamp(1 - d / 650, 0, 1),
    temp: lerp(z.temp[0], z.temp[1], zt),
  };
}

// ---------- background layers ----------
const BG = {
  snow: [], far: [], whale: null, t: 0,
  init() {
    this.snow.length = 0; this.far.length = 0;
    const n = V.quality ? 120 : 60;
    for (let i = 0; i < n; i++) this.snow.push({ x: Math.random(), y: Math.random(), z: rand(0.35, 1), s: rand(0.6, 2.1), ph: rand(TAU) });
    for (let i = 0; i < 26; i++) this.far.push({ x: Math.random(), y: Math.random(), s: rand(2, 5), ph: rand(TAU), hue: Math.random() });
    this.whale = null; this.whaleTimer = 8;
  },
  update(dt, descent) {
    this.t += dt;
    // marine snow drifts upward as we descend, plus slow sinking of its own
    for (const p of this.snow) {
      p.y -= (descent * 0.012 * p.z - 0.004) * dt;
      p.x += Math.sin(this.t * 0.3 + p.ph) * 0.0015 * dt;
      if (p.y < -0.05) { p.y += 1.1; p.x = Math.random(); }
      if (p.y > 1.05) p.y -= 1.1;
    }
    if (this.whale) {
      this.whale.x += this.whale.vx * dt;
      if (this.whale.x < -0.8 || this.whale.x > 1.8) this.whale = null;
    } else if ((this.whaleTimer -= dt) <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.whale = { x: dir > 0 ? -0.6 : 1.6, y: rand(0.15, 0.6), vx: dir * 0.018, s: rand(0.8, 1.3) };
      this.whaleTimer = rand(30, 50);
    }
  },
  draw(c, oc) {
    const w = V.w, h = V.h;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgba(oc.top)); g.addColorStop(1, rgba(oc.bot));
    c.fillStyle = g; c.fillRect(0, 0, w, h);

    // far silhouettes / faint distant lights (parallax 0.12)
    const px = -V.camX * 0.12, py = -V.camY * 0.12;
    if (oc.sun > 0.05 && this.whale) this.drawWhale(c, this.whale, oc);
    c.globalCompositeOperation = 'lighter';
    const deep = 1 - oc.sun;
    if (deep > 0.3) {
      for (const f of this.far) {
        const x = ((f.x * w + px) % w + w) % w, y = ((f.y * h + py) % h + h) % h;
        const a = (0.25 + 0.25 * Math.sin(this.t * 0.8 + f.ph)) * (deep - 0.3);
        drawGlow(c, x, y, f.s * 4, f.hue < 0.6 ? [80, 220, 230] : (f.hue < 0.85 ? [150, 120, 255] : [255, 170, 80]), a);
      }
    }
    // god rays near the surface
    if (oc.sun > 0.02) {
      c.save();
      for (let i = 0; i < 6; i++) {
        const sway = Math.sin(this.t * 0.25 + i * 1.7) * 40;
        const x = ((i / 6) * w * 1.4 - w * 0.2 + sway - V.camX * 0.05 % w);
        const rw = 30 + (i % 3) * 26;
        const lg = c.createLinearGradient(0, 0, 0, h);
        const a = oc.sun * (0.07 + 0.05 * Math.sin(this.t * 0.6 + i));
        lg.addColorStop(0, `rgba(210,250,255,${a})`); lg.addColorStop(1, 'rgba(210,250,255,0)');
        c.fillStyle = lg;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x + rw, 0); c.lineTo(x + rw + h * 0.35, h); c.lineTo(x + h * 0.35 - rw, h); c.closePath(); c.fill();
      }
      c.restore();
    }
    c.globalCompositeOperation = 'source-over';
  },
  // marine snow is drawn in screen space after the world, with parallax by z
  drawSnow(c, oc) {
    const w = V.w, h = V.h;
    c.fillStyle = rgba(oc.snow, 1);
    for (const p of this.snow) {
      const x = (((p.x * w - V.camX * p.z) % w) + w) % w;
      const y = (((p.y * h - V.camY * p.z) % h) + h) % h;
      c.globalAlpha = 0.18 + 0.4 * p.z;
      c.fillRect(x, y, p.s * p.z, p.s * p.z);
    }
    c.globalAlpha = 1;
  },
  drawWhale(c, wh, oc) {
    const x = wh.x * V.w, y = wh.y * V.h, s = wh.s * Math.min(V.w, V.h) / 360;
    c.save(); c.translate(x, y); c.scale(wh.vx > 0 ? s : -s, s);
    c.globalAlpha = 0.22 * oc.sun;
    c.fillStyle = rgba(mix(oc.bot, [0, 0, 0], 0.5));
    const tail = Math.sin(this.t * 1.2) * 8;
    c.beginPath();
    c.moveTo(120, 0); c.bezierCurveTo(110, -28, 40, -34, -40, -20);
    c.bezierCurveTo(-90, -12, -120, -4, -150, tail);
    c.lineTo(-180, tail - 22); c.lineTo(-172, tail); c.lineTo(-182, tail + 22); c.lineTo(-150, tail + 4);
    c.bezierCurveTo(-110, 14, -40, 26, 30, 24); c.bezierCurveTo(80, 22, 118, 14, 120, 0);
    c.fill();
    c.beginPath(); c.moveTo(20, 18); c.quadraticCurveTo(0, 50, -26, 52); c.quadraticCurveTo(-10, 30, -4, 18); c.fill();
    c.restore(); c.globalAlpha = 1;
  },
};
