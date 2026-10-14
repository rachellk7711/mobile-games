// ---------- particles (pooled), floating text, screen shake ----------
const FX = {
  pool: [], n: 0, max: 700, texts: [], shakeAmt: 0, shakeOn: store.get('shake', true), flash: 0, flashCol: [255, 93, 115],
  init() {
    if (!this.pool.length) for (let i = 0; i < this.max; i++) this.pool.push({ alive: false });
    for (const p of this.pool) p.alive = false;
    this.n = 0; this.texts.length = 0; this.shakeAmt = 0; this.flash = 0;
  },
  spawn(o) {
    const cap = V.quality ? this.max : this.max * 0.5;
    if (this.n >= cap) return null;
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.alive) {
        p.alive = true; this.n++;
        p.x = o.x; p.y = o.y; p.vx = o.vx || 0; p.vy = o.vy || 0;
        p.life = p.max = o.life || 0.6; p.size = o.size || 3; p.size1 = o.size1 === undefined ? p.size * 0.2 : o.size1;
        p.col = o.col || [255, 255, 255]; p.kind = o.kind || 'glow'; p.drag = o.drag === undefined ? 2 : o.drag;
        p.add = o.add !== false; p.a = o.a === undefined ? 1 : o.a; p.grav = o.grav || 0; p.rot = o.rot || 0; p.vr = o.vr || 0;
        return p;
      }
    }
    return null;
  },
  burst(x, y, col, n, spd = 160, life = 0.5, size = 4, kind = 'glow') {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), s = rand(0.25, 1) * spd;
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.6, 1) * life, size: rand(0.6, 1.2) * size, col, kind });
    }
  },
  ring(x, y, col, r0, r1, life = 0.4, width = 3) {
    this.spawn({ x, y, life, size: r0, size1: r1, col, kind: 'ring', drag: 0, a: width });
  },
  bubbles(x, y, n, spd = 40) {
    for (let i = 0; i < n; i++) this.spawn({ x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-spd, spd), vy: rand(-spd, 0) - 20, life: rand(0.6, 1.4), size: rand(1.2, 3.2), size1: undefined, col: [200, 240, 255], kind: 'bubble', drag: 1.5, grav: -50, add: false });
  },
  text(x, y, s, col = '#e3f6f3', big = false) {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x: x + rand(-6, 6), y, s, col, t: 0, big });
  },
  shake(a) { if (this.shakeOn) this.shakeAmt = Math.min(22, Math.max(this.shakeAmt, a)); },
  hurtFlash(a = 0.5, col = [255, 93, 115]) { this.flash = Math.max(this.flash, a); this.flashCol = col; },
  update(dt) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; this.n--; continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d; p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.t += dt; t.y -= (t.big ? 28 : 40) * dt;
      if (t.t > (t.big ? 1.2 : 0.7)) this.texts.splice(i, 1);
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - 60 * dt);
    V.shakeX = this.shakeAmt ? rand(-1, 1) * this.shakeAmt : 0;
    V.shakeY = this.shakeAmt ? rand(-1, 1) * this.shakeAmt : 0;
    this.flash = Math.max(0, this.flash - dt * 1.8);
  },
  // normal-blend pass (bubbles, ink) is drawn before darkness; additive after
  drawNormal(c) {
    for (const p of this.pool) {
      if (!p.alive || p.add) continue;
      const k = p.life / p.max, s = lerp(p.size1, p.size, k);
      if (p.kind === 'bubble') {
        c.globalAlpha = 0.55 * k; c.strokeStyle = rgba(p.col); c.lineWidth = 1;
        c.beginPath(); c.arc(p.x, p.y, s, 0, TAU); c.stroke();
      } else if (p.kind === 'ink') {
        c.globalAlpha = 0.5 * k * p.a; c.fillStyle = rgba(p.col);
        c.beginPath(); c.arc(p.x, p.y, s, 0, TAU); c.fill();
      } else if (p.kind === 'chunk') {
        c.globalAlpha = Math.min(1, k * 2); c.fillStyle = rgba(p.col);
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-s / 2, -s / 3, s, s * 0.66); c.restore();
      }
    }
    c.globalAlpha = 1;
  },
  drawAdd(c) {
    for (const p of this.pool) {
      if (!p.alive || !p.add) continue;
      const k = p.life / p.max;
      if (p.kind === 'ring') {
        const r = lerp(p.size1, p.size, k);
        c.globalAlpha = k * 0.9; c.strokeStyle = rgba(p.col); c.lineWidth = p.a * k + 0.5;
        c.beginPath(); c.arc(p.x, p.y, Math.max(0.1, r), 0, TAU); c.stroke();
      } else if (p.kind === 'spark') {
        c.globalAlpha = k; c.strokeStyle = rgba(p.col); c.lineWidth = p.size * k;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); c.stroke();
      } else {
        const s = lerp(p.size1, p.size, k);
        drawGlow(c, p.x, p.y, s * 3, p.col, k * p.a, s > 3);
      }
    }
    c.globalAlpha = 1;
  },
  drawTexts(c) {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const t of this.texts) {
      const life = t.big ? 1.2 : 0.7;
      const a = clamp(1 - (t.t / life - 0.5) * 2, 0, 1);
      const pop = t.t < 0.08 ? 1 + (0.08 - t.t) * 6 : 1;
      c.globalAlpha = a;
      c.font = `600 ${(t.big ? 18 : 12) * pop}px "IBM Plex Mono", monospace`;
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(t.s, t.x, t.y);
      c.fillStyle = t.col; c.fillText(t.s, t.x, t.y);
    }
    c.globalAlpha = 1;
  },
};
