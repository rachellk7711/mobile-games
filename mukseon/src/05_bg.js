// ---------- painted background: cached ink-wash chunks with parallax ----------
const CH = 1000;                       // chunk height in layer space
const LAYERS = [{ p: 0.28, res: 0.55 }, { p: 0.62, res: 0.85 }];
const BGC = {
  map: new Map(), seed: 1,
  clear() { this.map.clear(); },
  get(li, idx) {
    const key = li + ':' + idx;
    let ch = this.map.get(key);
    if (!ch) {
      ch = renderChunk(li, idx, this.seed);
      this.map.set(key, ch);
      if (this.map.size > 10) { // drop the farthest chunk
        let far = null, fd = -1;
        for (const [k, v] of this.map) { const d = Math.abs(v.idx - idx) + (v.li !== li ? 0.5 : 0); if (d > fd) { fd = d; far = k; } }
        this.map.delete(far);
      }
    }
    return ch;
  },
};

function renderChunk(li, idx, seed) {
  const L = LAYERS[li], res = L.res * V.scale * Math.min(V.dpr, 1.5);
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * res); c.height = Math.ceil(CH * res);
  const x = c.getContext('2d');
  x.scale(res, res);
  const r = mulberry32(hashStr(seed + ':' + li + ':' + idx));
  const n = makeNoise(hashStr('n' + seed + li + idx));
  // which height does this chunk show? (layer space -> camera -> metres)
  const yMid = (idx + 0.5) * CH, m = Math.max(0, -(yMid / L.p) / M);
  const pal = paletteAt(m), b = pal.b, ink = pal.ink;
  x.__y0 = idx * CH;
  // features that cross chunk borders (cliff edges, bamboo stalks) use run-wide noise and absolute y
  const gn = makeNoise(hashStr('cliff' + seed + li));
  if (li === 0) drawFar(x, r, n, b, ink, pal);
  else drawMid(x, r, gn, b, ink, pal, idx, seed);
  return { cv: c, idx, li };
}

// --- far: misty peaks (or clouds / a great waterfall) ---
function drawFar(x, r, n, b, ink, pal) {
  if (b.flora === 'cloud') { drawClouds(x, r, n, ink, 0.5); return; }
  const peaks = r.int(2, 3);
  for (let k = 0; k < peaks; k++) {
    const H = r.range(200, 400), base = r.range(H * 1.3 + 40, CH - 165), cx = r.range(40, W - 40), w = r.range(90, 170);
    const alpha = (pal.night > 0.5 ? 0.5 : 0.2) + k * 0.06;
    const ridge = xx => base - H * Math.exp(-Math.pow((xx - cx) / w, 2)) * (0.75 + 0.5 * fbm(n, xx * 0.02 + k * 9)) - fbm(n, xx * 0.06 + k * 3) * 25;
    const g = x.createLinearGradient(0, base - H, 0, base + 120);
    g.addColorStop(0, rgba(ink, alpha)); g.addColorStop(0.55, rgba(ink, alpha * 0.35)); g.addColorStop(1, rgba(ink, 0));
    x.fillStyle = g;
    x.beginPath(); x.moveTo(-20, base + 140);
    for (let xx = -20; xx <= W + 20; xx += 6) x.lineTo(xx, ridge(xx));
    x.lineTo(W + 20, base + 140); x.closePath(); x.fill();
    // ridge line in drier ink
    x.strokeStyle = rgba(ink, alpha * 1.3); x.lineWidth = 1.4;
    x.beginPath();
    for (let xx = cx - w * 1.6; xx <= cx + w * 1.6; xx += 5) { const yy = ridge(xx); if (xx === cx - w * 1.6) x.moveTo(xx, yy); else x.lineTo(xx, yy); }
    x.stroke();
    // texture dots (미점) on the slopes
    x.fillStyle = rgba(ink, alpha * 0.9);
    for (let i = 0; i < 26; i++) { const xx = cx + r.range(-w, w), yy = ridge(xx) + r.range(4, 50); x.beginPath(); x.ellipse(xx, yy, r.range(1.5, 3.5), r.range(0.8, 1.8), 0, 0, TAU); x.fill(); }
  }
  if (b.flora === 'falls') {
    // one waterfall for the whole gorge: same x in every chunk, faded where the gorge begins and ends
    const fr = mulberry32(hashStr('falls' + BGC.seed));
    const fx = fr.range(150, 250), L = LAYERS[0];
    const mAt = yy => Math.max(0, -(yy / L.p) / M);
    const top = biomeAt(mAt(x.__y0)).flora === 'falls' && biomeAt(mAt(x.__y0 - CH)).flora === 'falls';
    const bot = biomeAt(mAt(x.__y0 + CH * 1.5)).flora === 'falls';
    const g = x.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, `rgba(255,255,255,${top ? 0.55 : 0})`); g.addColorStop(0.25, 'rgba(255,255,255,.55)');
    g.addColorStop(0.75, 'rgba(255,255,255,.55)'); g.addColorStop(1, `rgba(255,255,255,${bot ? 0.55 : 0})`);
    x.strokeStyle = g;
    for (let i = 0; i < 18; i++) { x.lineWidth = fr.range(1, 3.5); const xx = fx + fr.range(-24, 24), w1 = fr.range(-6, 6), w2 = fr.range(-6, 6); x.beginPath(); x.moveTo(xx, -2); x.bezierCurveTo(xx + w1, CH * 0.3, xx + w2, CH * 0.7, xx, CH + 2); x.stroke(); }
  }
  // mist bands
  for (let i = 0; i < 3; i++) {
    const yy = r.range(70, CH - 70), g = x.createLinearGradient(0, yy - 60, 0, yy + 60);
    const mc = pal.night > 0.5 ? [80, 90, 110] : [250, 250, 245];
    g.addColorStop(0, rgba(mc, 0)); g.addColorStop(0.5, rgba(mc, pal.night > 0.5 ? 0.25 : 0.55)); g.addColorStop(1, rgba(mc, 0));
    x.fillStyle = g; x.fillRect(0, yy - 60, W, 120);
  }
}

function drawClouds(x, r, n, ink, a) {
  for (let i = 0; i < 6; i++) {
    const cx = r.range(0, W), cy = r.range(0, CH), s = r.range(30, 60);
    x.fillStyle = 'rgba(255,250,240,.75)'; x.strokeStyle = rgba(ink, 0.35); x.lineWidth = 1.2;
    x.beginPath();
    for (let k = 0; k < 5; k++) x.arc(cx + (k - 2) * s * 0.7, cy + Math.sin(k * 1.7) * s * 0.15, s * (0.5 + 0.2 * Math.sin(k * 2.3)), Math.PI, 0);
    x.closePath(); x.fill(); x.stroke();
    // 운문: the curling cloud motif
    x.beginPath(); for (let t = 0; t < 4.5 * Math.PI; t += 0.2) { const rr = 2 + t * 1.6; x.lineTo(cx + Math.cos(t) * rr, cy - s * 0.2 + Math.sin(t) * rr * 0.7); } x.stroke();
  }
}

// --- mid: cliff walls with pines, bamboo, lanterns ---
function drawMid(x, r, n, b, ink, pal, idx, seed) {
  const y0 = idx * CH;
  if (b.flora === 'cloud') { drawClouds(x, r, n, ink, 0.8); return; }
  const night = pal.night > 0.5;
  for (const side of [-1, 1]) {
    const off = side < 0 ? 0 : 50;
    const edge = yy => 16 + 30 * fbm(n, (y0 + yy) * 0.004 + off) + 18 * fbm(n, (y0 + yy) * 0.02 + off + 7);
    const X = (e) => side < 0 ? e : W - e;
    const g = x.createLinearGradient(side < 0 ? 0 : W, 0, side < 0 ? 70 : W - 70, 0);
    g.addColorStop(0, rgba(ink, night ? 0.85 : 0.7)); g.addColorStop(1, rgba(ink, night ? 0.35 : 0.18));
    x.fillStyle = g;
    x.beginPath(); x.moveTo(X(0), -10);
    for (let yy = -10; yy <= CH + 10; yy += 10) x.lineTo(X(edge(yy)), yy);
    x.lineTo(X(0), CH + 10); x.closePath(); x.fill();
    // axe-cut texture strokes (부벽준)
    x.strokeStyle = rgba(ink, 0.35); x.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const yy = r.range(0, CH), e = edge(yy), xx = r.range(2, e - 4);
      x.lineWidth = r.range(1, 3);
      x.beginPath(); x.moveTo(X(xx), yy); x.lineTo(X(xx + r.range(4, 12)), yy + r.range(8, 20)); x.stroke();
    }
    // flora from the cliff edge
    if (b.flora === 'pine' || b.flora === 'falls' || b.flora === 'storm') {
      const count = b.flora === 'storm' ? 2 : 3;
      for (let i = 0; i < count; i++) {
        const yy = r.range(60, CH - 60), e = edge(yy);
        drawPine(x, r, X(e - 2), yy, side, ink, b.flora === 'storm', r.range(0.8, 1.25));
      }
    } else if (b.flora === 'bamboo') {
      // stalk positions are fixed for the whole run, so stalks continue across chunks
      const sr = mulberry32(hashStr('bamboo' + seed + side));
      for (let i = 0; i < 4; i++) drawBamboo(x, r, X(sr.range(8, 64)), ink, side, y0, sr.range(55, 80), sr.range(5, 8), sr.range(-0.04, 0.04), sr.range(0.35, 0.8));
    } else if (b.flora === 'lantern') {
      for (let i = 0; i < 2; i++) {
        const yy = r.range(80, CH - 80), e = edge(yy);
        drawPine(x, r, X(e - 2), yy, side, ink, false, 0.9);
      }
    }
  }
  if (b.flora === 'lantern') {
    // strings of lanterns across the gorge, glow baked into the chunk
    for (let k = 0; k < 2; k++) {
      const y0 = r.range(100, CH - 100), sag = r.range(30, 60);
      x.strokeStyle = rgba(ink, 0.6); x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, y0); x.quadraticCurveTo(W / 2, y0 + sag * 2, W, y0 + r.range(-20, 20)); x.stroke();
      for (let i = 1; i < 6; i++) {
        const t = i / 6, lx = t * W, ly = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0 + 12;
        x.globalCompositeOperation = 'lighter';
        glow(x, lx, ly, 34, [255, 170, 80], 0.55);
        x.globalCompositeOperation = 'source-over';
        x.fillStyle = '#d9672e'; x.beginPath(); x.ellipse(lx, ly, 5, 7, 0, 0, TAU); x.fill();
        x.fillStyle = 'rgba(255,220,150,.9)'; x.beginPath(); x.ellipse(lx, ly, 2.5, 4, 0, 0, TAU); x.fill();
      }
    }
  }
}

function drawPine(x, r, px, py, side, ink, bare, s) {
  // trunk: a confident curved stroke leaning out over the gorge
  const dir = -side; // grows inward
  const len = r.range(70, 130) * s;
  const p1 = { x: px, y: py }, c1 = { x: px + dir * len * 0.4, y: py - len * 0.1 }, c2 = { x: px + dir * len * 0.6, y: py - len * 0.55 }, p2 = { x: px + dir * len, y: py - len * 0.45 };
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, mt = 1 - t;
    pts.push({ x: mt * mt * mt * p1.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * p2.x, y: mt * mt * mt * p1.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * p2.y });
  }
  brush(x, pts, 9 * s, 2.5 * s, rgba(ink), 0.85);
  // bark knots
  x.fillStyle = rgba(ink, 0.7);
  for (let i = 2; i < 10; i += 3) { x.beginPath(); x.ellipse(pts[i].x, pts[i].y, 2.5 * s, 1.4 * s, 0, 0, TAU); x.fill(); }
  if (bare) {
    for (let i = 4; i <= 12; i += 3) { const p = pts[i]; brush(x, [p, { x: p.x + dir * r.range(10, 25), y: p.y - r.range(10, 25) }, { x: p.x + dir * r.range(20, 40), y: p.y - r.range(5, 30) }], 2.5, 0.6, rgba(ink), 0.8, false); }
    return;
  }
  // needle clusters: flat umbrella fans, the signature of ink-painted pines
  for (let i = 5; i <= 12; i += 2) {
    const p = pts[i], cx = p.x + dir * r.range(-5, 15), cy = p.y - r.range(6, 16), w = r.range(22, 36) * s;
    x.fillStyle = rgba(ink, 0.22);
    x.beginPath(); x.ellipse(cx, cy, w, w * 0.32, 0, 0, TAU); x.fill();
    x.strokeStyle = rgba(ink, 0.75); x.lineWidth = 0.9;
    x.beginPath();
    for (let k = 0; k < 16; k++) { const a = Math.PI + (k / 15) * Math.PI; x.moveTo(cx, cy + w * 0.12); x.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * w * 0.38); }
    x.stroke();
  }
}

function drawBamboo(x, r, bx, ink, side, y0, segH, w, lean, a) {
  // segments are laid on an absolute grid so nodes line up across chunk borders
  const first = Math.floor(y0 / segH) * segH - y0 - segH;
  for (let y = first; y < CH + segH; y += segH) {
    const xs = yy => bx + Math.sin((y0 + yy) * 0.002 + lean * 40) * 6;
    const x0 = xs(y), x1 = xs(y + segH - 5);
    x.strokeStyle = rgba(ink, a); x.lineWidth = w; x.lineCap = 'butt';
    x.beginPath(); x.moveTo(x0, y); x.lineTo(x1, y + segH - 5); x.stroke();
    // node
    x.lineWidth = 1.6; x.strokeStyle = rgba(ink, Math.min(1, a + 0.2));
    x.beginPath(); x.moveTo(x1 - w * 0.8, y + segH - 3); x.quadraticCurveTo(x1, y + segH - 6, x1 + w * 0.8, y + segH - 3); x.stroke();
    // leaves: dagger strokes from nodes
    if (r.chance(0.45)) {
      const nx = x1, ny = y + segH - 4, dirx = side < 0 ? 1 : -1;
      for (let k = 0; k < r.int(2, 4); k++) {
        const ang = (dirx > 0 ? 0 : Math.PI) + r.range(-0.9, 0.6) * dirx + 0.4;
        const L = r.range(22, 36);
        brush(x, [{ x: nx, y: ny }, { x: nx + Math.cos(ang) * L * 0.5, y: ny + Math.sin(ang) * L * 0.5 + 2 }, { x: nx + Math.cos(ang) * L, y: ny + Math.sin(ang) * L + 5 }], 1, 5.5, rgba(ink), a + 0.15, false);
      }
    }
  }
}

// ---------- per-frame sky + chunk compositing ----------
function drawBackground(c, pal) {
  const s = V.scale * V.dpr;
  // sky wash
  c.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  const g = c.createLinearGradient(0, 0, 0, V.h);
  g.addColorStop(0, rgba(pal.top)); g.addColorStop(1, rgba(pal.bot));
  c.fillStyle = g; c.fillRect(V.ox, 0, W * V.scale, V.h);
  // moon at night, sun disc above the clouds
  const m = -V.camY / M;
  if (pal.night > 0.05 && pal.storm < 0.9) {
    const mx = V.ox + W * V.scale * 0.72, my = V.h * 0.2;
    c.globalAlpha = pal.night * (1 - pal.storm);
    c.globalCompositeOperation = 'lighter'; glow(c, mx, my, 120 * V.scale, [200, 210, 230], 0.5); c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#efe9d6'; c.beginPath(); c.arc(mx, my, 34 * V.scale, 0, TAU); c.fill();
    c.fillStyle = 'rgba(180,175,160,.35)'; c.beginPath(); c.arc(mx - 9 * V.scale, my - 6 * V.scale, 8 * V.scale, 0, TAU); c.arc(mx + 10 * V.scale, my + 8 * V.scale, 5 * V.scale, 0, TAU); c.fill();
    c.globalAlpha = 1;
  }
  if (pal.b.id === 5 || m > 2950) {
    const k = clamp((m - 2950) / 50, 0, 1);
    c.globalAlpha = k;
    glow(c, V.ox + W * V.scale * 0.3, V.h * 0.25, 170 * V.scale, [240, 170, 110], 0.35 * k);
    c.fillStyle = '#c8372d'; c.beginPath(); c.arc(V.ox + W * V.scale * 0.3, V.h * 0.25, 30 * V.scale, 0, TAU); c.fill();
    c.globalAlpha = 1;
  }
  // parallax chunks
  for (let li = 0; li < LAYERS.length; li++) {
    const L = LAYERS[li], top = V.camY * L.p, bottom = top + V.viewH;
    const i0 = Math.floor(top / CH), i1 = Math.floor(bottom / CH);
    for (let i = i0; i <= i1; i++) {
      const ch = BGC.get(li, i);
      c.setTransform(s, 0, 0, s, (V.ox + V.shakeX * L.p) * V.dpr, ((i * CH - top) * V.scale + V.shakeY * L.p) * V.dpr);
      c.drawImage(ch.cv, 0, 0, W, CH);
    }
  }
}

// paper fibres over everything inside the scroll, so ink and sky share one surface
function drawPaperOverlay(c, pal) {
  worldXf(c);
  c.globalCompositeOperation = 'multiply';
  c.globalAlpha = pal.night > 0.5 ? 0.35 : 0.85;
  c.fillStyle = Paper.get(c);
  c.fillRect(0, V.camY - 10, W, V.viewH + 20);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}

// silk mounting around the painting when the screen is wider than the scroll
function drawMounting(c) {
  c.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  const sw = W * V.scale;
  if (V.ox > 1) {
    c.fillStyle = '#3b3129'; c.fillRect(0, 0, V.ox, V.h); c.fillRect(V.ox + sw, 0, V.w - V.ox - sw, V.h);
    c.fillStyle = 'rgba(184,145,62,.18)';
    for (let y = 0; y < V.h; y += 22) for (let xx = (y / 22) % 2 ? 11 : 0; xx < V.w; xx += 22) { if (xx > V.ox - 4 && xx < V.ox + sw + 4) continue; c.beginPath(); c.arc(xx, y, 2, 0, TAU); c.fill(); }
    c.fillStyle = '#b8913e'; c.fillRect(V.ox - 4, 0, 2, V.h); c.fillRect(V.ox + sw + 2, 0, 2, V.h);
  }
  c.fillStyle = 'rgba(27,26,23,.55)'; c.fillRect(V.ox - 1, 0, 1, V.h); c.fillRect(V.ox + sw, 0, 1, V.h);
}
