'use strict';
// ---------- math & helpers ----------
const TAU = Math.PI * 2;
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const pick = a => a[Math.floor(Math.random() * a.length)];
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const approach = (v, t, s) => (v < t ? Math.min(v + s, t) : Math.max(v - s, t));
function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const fmt = n => Math.round(n).toLocaleString('ko-KR');
function weighted(list) { // [{w, ...}]
  let s = 0; for (const o of list) s += o.w;
  let r = Math.random() * s;
  for (const o of list) { r -= o.w; if (r <= 0) return o; }
  return list[list.length - 1];
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const store = {
  get(k, d) { try { const v = localStorage.getItem('abyss.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('abyss.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};

// Uniform grid for broad-phase collision. Rebuilt every frame.
class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  clear() { this.map.clear(); }
  key(cx, cy) { return (cx + 32768) * 65536 + (cy + 32768); }
  insert(o, x, y, r) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const k = this.key(cx, cy); let b = this.map.get(k);
      if (!b) { b = []; this.map.set(k, b); }
      b.push(o);
    }
  }
  query(x, y, r, out) {
    out.length = 0;
    const c = this.cell, stamp = ++Grid.stamp;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const b = this.map.get(this.key(cx, cy)); if (!b) continue;
      for (const o of b) { if (o._q !== stamp) { o._q = stamp; out.push(o); } }
    }
    return out;
  }
}
Grid.stamp = 0;
