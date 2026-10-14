// ---------- canvas, scroll geometry, paper & ink primitives ----------
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = 400;           // scroll width in world units
const M = 18;            // world units per metre (the climber is about 1.7 m tall)
const V = { w: 360, h: 640, dpr: 1, scale: 1, ox: 0, viewH: 640, camY: 0, shakeX: 0, shakeY: 0 };

function resize() {
  V.dpr = Math.min(window.devicePixelRatio || 1, 2);
  V.w = Math.max(1, cv.clientWidth || innerWidth); V.h = Math.max(1, cv.clientHeight || innerHeight);
  cv.width = Math.round(V.w * V.dpr); cv.height = Math.round(V.h * V.dpr);
  V.scale = Math.min(V.w / W, V.h / 560);
  V.ox = (V.w - W * V.scale) / 2;
  V.viewH = V.h / V.scale;
  BGC.clear();
}

// ---------- paper ----------
const Paper = {
  cv: null, pattern: null,
  build() {
    const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
    const x = c.getContext('2d');
    x.fillStyle = '#e9e5da'; x.fillRect(0, 0, s, s);
    const img = x.getImageData(0, 0, s, s), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9; }
    x.putImageData(img, 0, 0);
    // mulberry fibres of hanji
    for (let i = 0; i < 140; i++) {
      x.strokeStyle = `rgba(${Math.random() < 0.5 ? '120,110,90' : '255,255,250'},${rand(0.05, 0.16)})`;
      x.lineWidth = rand(0.4, 1.1);
      const px = rand(s), py = rand(s), a = rand(TAU), L = rand(8, 30);
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 0.6) * L * 0.5, py + Math.sin(a + 0.6) * L * 0.5, px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke();
    }
    this.cv = c; this.pattern = null;
  },
  get(c) { if (!this.pattern) this.pattern = c.createPattern(this.cv, 'repeat'); return this.pattern; },
};
Paper.build();

// ---------- ink splat sprites (several organic variants) ----------
const Splat = {
  list: [],
  build() {
    for (let v = 0; v < 6; v++) {
      const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
      const x = c.getContext('2d'); x.fillStyle = '#000';
      x.beginPath();
      const n = 18, r0 = s * 0.22;
      for (let i = 0; i <= n; i++) { const a = i / n * TAU, r = r0 * (0.75 + Math.random() * 0.5); i ? x.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r) : x.moveTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); }
      x.closePath(); x.fill();
      for (let i = 0; i < 14; i++) { const a = rand(TAU), r = rand(r0 * 1.1, s * 0.48), rr = rand(1, 5); x.beginPath(); x.arc(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, rr, 0, TAU); x.fill(); }
      for (let i = 0; i < 5; i++) { const a = rand(TAU); x.lineWidth = rand(1.5, 4); x.lineCap = 'round'; x.beginPath(); x.moveTo(s / 2 + Math.cos(a) * r0, s / 2 + Math.sin(a) * r0); x.lineTo(s / 2 + Math.cos(a) * rand(r0 * 1.4, s * 0.46), s / 2 + Math.sin(a) * rand(r0 * 1.4, s * 0.46)); x.strokeStyle = '#000'; x.stroke(); }
      this.list.push(c);
    }
    // a red-tinted copy set for seal-coloured splashes
    this.red = this.list.map(src => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#b3261e'; x.fillRect(0, 0, 128, 128); return c; });
  },
};
Splat.build();

// warm glow for lanterns, fireflies, moon
const Glow = {
  cache: new Map(),
  get(col) {
    const k = col.join(','); let s = this.cache.get(k); if (s) return s;
    s = document.createElement('canvas'); s.width = s.height = 128; const c = s.getContext('2d');
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, rgba(col, 1)); g.addColorStop(0.25, rgba(col, 0.45)); g.addColorStop(0.6, rgba(col, 0.1)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); this.cache.set(k, s); return s;
  },
};
function glow(c, x, y, r, col, a = 1) { if (a <= 0.01) return; c.globalAlpha = a; c.drawImage(Glow.get(col), x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; }

// Tapered brush stroke along a polyline: widths go w0 -> w1, with a dry-brush edge.
function brush(c, pts, w0, w1, col, alpha = 1, dry = true) {
  const n = pts.length; if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    let dx = q.x - o.x, dy = q.y - o.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const t = i / (n - 1), w = lerp(w0, w1, t) * (0.85 + 0.15 * Math.sin(i * 1.7));
    L.push({ x: p.x - dy * w / 2, y: p.y + dx * w / 2 }); R.push({ x: p.x + dy * w / 2, y: p.y - dx * w / 2 });
  }
  c.globalAlpha = alpha; c.fillStyle = col;
  c.beginPath(); c.moveTo(L[0].x, L[0].y);
  for (let i = 1; i < n; i++) c.lineTo(L[i].x, L[i].y);
  for (let i = n - 1; i >= 0; i--) c.lineTo(R[i].x, R[i].y);
  c.closePath(); c.fill();
  if (dry) {
    // hairline streaks where the brush runs dry (비백)
    c.strokeStyle = col; c.lineWidth = 0.7; c.globalAlpha = alpha * 0.5;
    for (let k = -1; k <= 1; k += 2) {
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), w = lerp(w0, w1, t), p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)];
        let dx = q.x - o.x, dy = q.y - o.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
        const off = k * (w * 0.5 + 1.2);
        if ((i * 7 + k * 3) % 5 === 0) { c.moveTo(p.x - dy * off, p.y + dx * off); continue; }
        c.lineTo(p.x - dy * off, p.y + dx * off);
      }
      c.stroke();
    }
  }
  c.globalAlpha = 1;
}

function splat(c, x, y, r, a = 1, red = false, rot = 0) {
  const list = red ? Splat.red : Splat.list, s = list[(Math.abs(x * 7 + y * 13) | 0) % list.length];
  c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = a; c.drawImage(s, -r, -r, r * 2, r * 2); c.restore(); c.globalAlpha = 1;
}

// world -> screen transform (with shake); screen units are CSS px * dpr
function worldXf(c) {
  const s = V.scale * V.dpr;
  c.setTransform(s, 0, 0, s, (V.ox + V.shakeX) * V.dpr, (-V.camY * V.scale + V.shakeY) * V.dpr);
}
