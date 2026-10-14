// ---------- particles, brush words, weather ----------
const FX = {
  ps: [], words: [], shakeAmt: 0, shakeOn: store.get('shake', true), weather: [],
  init() { this.ps.length = 0; this.words.length = 0; this.shakeAmt = 0; this.weather.length = 0; },
  add(o) { if (this.ps.length > 420) this.ps.shift(); this.ps.push(o); return o; },
  inkBurst(x, y, n, s = 1, red = false) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), v = rand(60, 260) * s;
      this.add({ k: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, r: rand(1.5, 4.5) * s, life: rand(0.5, 1.0), max: 1, red, g: 700 });
    }
    this.add({ k: 'splat', x, y, r: 10 * s + rand(4), life: 0.9, max: 0.9, red, rot: rand(TAU) });
  },
  ring(x, y, r0, r1, life, gold = false) { this.add({ k: 'ring', x, y, r0, r1, life, max: life, gold }); },
  petals(x, y, n) { for (let i = 0; i < n; i++) this.add({ k: 'petal', x, y, vx: rand(-80, 80), vy: rand(-120, -20), r: rand(2.5, 4), life: rand(0.8, 1.4), max: 1.4, rot: rand(TAU), vr: rand(-8, 8), g: 120 }); },
  feathers(x, y) { for (let i = 0; i < 4; i++) this.add({ k: 'feather', x, y, vx: rand(-60, 60), vy: rand(20, 80), r: 6, life: 1.4, max: 1.4, rot: rand(TAU), vr: rand(-4, 4), g: 40 }); },
  dust(x, y) { this.add({ k: 'drop', x: x + rand(-6, 6), y: y + rand(0, 10), vx: rand(-20, 20), vy: rand(0, 40), r: rand(0.8, 1.6), life: 0.6, max: 0.6, g: 400, gold: true }); },
  word(x, y, s, big = false, red = false) { this.words.push({ x, y, s, big, red, t: 0 }); if (this.words.length > 8) this.words.shift(); },
  shake(a) { if (this.shakeOn) this.shakeAmt = Math.max(this.shakeAmt, a); },
  update(dt) {
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i]; p.life -= dt;
      if (p.life <= 0) { this.ps.splice(i, 1); continue; }
      if (p.vx !== undefined) { p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-1.5 * dt); }
      if (p.vr) p.rot += p.vr * dt;
    }
    for (let i = this.words.length - 1; i >= 0; i--) { const w = this.words[i]; w.t += dt; w.y -= 22 * dt; if (w.t > 1.1) this.words.splice(i, 1); }
    this.shakeAmt = Math.max(0, this.shakeAmt - 40 * dt);
    V.shakeX = this.shakeAmt ? rand(-1, 1) * this.shakeAmt : 0; V.shakeY = this.shakeAmt ? rand(-1, 1) * this.shakeAmt : 0;
  },
  draw(c, pal) {
    const inkCol = pal.night > 0.5 ? '#0b0a09' : rgba(pal.ink);
    for (const p of this.ps) {
      const k = clamp(p.life / p.max, 0, 1);
      if (p.k === 'drop') { c.globalAlpha = Math.min(1, k * 1.5); c.fillStyle = p.gold ? '#b8913e' : p.red ? '#b3261e' : inkCol; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }
      else if (p.k === 'splat') { splat(c, p.x, p.y, p.r * (1.4 - k * 0.4), k * 0.55, p.red, p.rot); }
      else if (p.k === 'ring') { c.globalAlpha = k; c.strokeStyle = p.gold ? '#b8913e' : inkCol; c.lineWidth = 2 * k + 0.5; c.beginPath(); c.arc(p.x, p.y, lerp(p.r1, p.r0, k), 0, TAU); c.stroke(); }
      else if (p.k === 'petal') { c.globalAlpha = Math.min(1, k * 2); c.fillStyle = '#e8a3b0'; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath(); c.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, TAU); c.fill(); c.restore(); }
      else if (p.k === 'feather') { c.globalAlpha = k; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = '#f7f4ec'; c.strokeStyle = '#1b1a17'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(0, 0, 2.5, 7, 0, 0, TAU); c.fill(); c.stroke(); c.restore(); }
    }
    c.globalAlpha = 1;
  },
  drawWords(c, pal) {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const w of this.words) {
      const a = w.t < 0.1 ? w.t / 0.1 : clamp(1 - (w.t - 0.6) / 0.5, 0, 1);
      const sc = w.t < 0.12 ? 1.5 - w.t * 4 : 1;
      c.globalAlpha = a;
      c.font = `${(w.big ? 34 : 24) * sc}px "Nanum Brush Script", serif`;
      c.lineWidth = 4; c.strokeStyle = pal.night > 0.5 ? 'rgba(20,24,36,.85)' : 'rgba(239,231,212,.9)';
      c.strokeText(w.s, w.x, w.y);
      c.fillStyle = w.red ? '#b3261e' : (pal.night > 0.5 ? '#f1ecdf' : '#1b1a17');
      c.fillText(w.s, w.x, w.y);
    }
    c.globalAlpha = 1;
  },
  // screen-space weather tied to the biome
  updateWeather(dt, pal) {
    const b = pal.b, want = b.weather === 'rain' ? 90 : b.weather === 'mist' ? 8 : 34;
    while (this.weather.length < want) this.weather.push(this.spawnW(b.weather, true));
    if (this.weather.length > want) this.weather.length = want;
    for (let i = 0; i < this.weather.length; i++) {
      const w = this.weather[i];
      if (w.type !== b.weather) { this.weather[i] = this.spawnW(b.weather, false); continue; }
      w.x += w.vx * dt + (G.windX || 0) * dt * 0.3; w.y += w.vy * dt; w.rot += w.vr * dt; w.t += dt;
      if (w.y > 1.1 || w.y < -0.1 || w.x < -0.15 || w.x > 1.15) this.weather[i] = this.spawnW(b.weather, false);
    }
  },
  spawnW(type, anywhere) {
    const w = { type, x: rand(), y: anywhere ? rand() : -0.05, vx: 0, vy: 0, rot: rand(TAU), vr: rand(-2, 2), s: rand(0.6, 1.3), t: rand(10) };
    if (type === 'petal') { w.vx = rand(0.01, 0.05); w.vy = rand(0.04, 0.08); }
    else if (type === 'leaf') { w.vx = rand(-0.03, 0.06); w.vy = rand(0.05, 0.09); }
    else if (type === 'mist') { w.vx = rand(0.01, 0.03) * (Math.random() < 0.5 ? 1 : -1); w.vy = 0; w.y = rand(); w.x = anywhere ? rand() : (w.vx > 0 ? -0.1 : 1.1); }
    else if (type === 'firefly') { w.vx = rand(-0.02, 0.02); w.vy = rand(-0.03, 0.01); if (!anywhere) w.y = 1.05; }
    else if (type === 'rain') { w.vx = -0.25; w.vy = rand(1.4, 1.9); }
    else if (type === 'gold') { w.vx = rand(-0.01, 0.01); w.vy = rand(-0.05, -0.02); if (!anywhere) w.y = 1.05; }
    return w;
  },
  drawWeather(c, pal) {
    c.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    const sw = W * V.scale, ox = V.ox, h = V.h;
    c.save(); c.beginPath(); c.rect(ox, 0, sw, h); c.clip();
    for (const w of this.weather) {
      const x = ox + w.x * sw, y = w.y * h;
      if (w.type === 'petal') { c.fillStyle = 'rgba(232,163,176,.85)'; c.save(); c.translate(x, y); c.rotate(w.rot); c.beginPath(); c.ellipse(0, 0, 3.4 * w.s, 2 * w.s, 0, 0, TAU); c.fill(); c.restore(); }
      else if (w.type === 'leaf') { c.fillStyle = rgba(pal.ink, 0.55); c.save(); c.translate(x, y); c.rotate(w.rot); c.beginPath(); c.moveTo(-7 * w.s, 0); c.quadraticCurveTo(0, -2.4 * w.s, 7 * w.s, 0); c.quadraticCurveTo(0, 2.4 * w.s, -7 * w.s, 0); c.fill(); c.restore(); }
      else if (w.type === 'mist') { const g = c.createRadialGradient(x, y, 0, x, y, 140 * w.s); g.addColorStop(0, 'rgba(250,250,246,.35)'); g.addColorStop(1, 'rgba(250,250,246,0)'); c.fillStyle = g; c.fillRect(x - 140 * w.s, y - 140 * w.s, 280 * w.s, 280 * w.s); }
      else if (w.type === 'firefly') { c.globalCompositeOperation = 'lighter'; glow(c, x, y, 8 * w.s, [200, 255, 150], 0.5 + 0.5 * Math.sin(w.t * 3)); c.globalCompositeOperation = 'source-over'; }
      else if (w.type === 'rain') { c.strokeStyle = 'rgba(200,205,215,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 4, y + 16); c.stroke(); }
      else if (w.type === 'gold') { c.fillStyle = `rgba(184,145,62,${0.5 + 0.4 * Math.sin(w.t * 4)})`; c.fillRect(x, y, 2 * w.s, 2 * w.s); }
    }
    c.restore();
  },
};
