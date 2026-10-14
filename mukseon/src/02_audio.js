// ---------- sound: plucked strings (Karplus–Strong), wind, drum — all synthesized ----------
// Grabs walk up a pentatonic scale (평조 feel: C D F G A), so a clean climb plays a melody.
const PENTA = [0, 2, 5, 7, 9];
const SFX = {
  ctx: null, out: null, rev: null, on: true, last: {}, plucks: new Map(), noiseBuf: null, wind: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.ctx = new AC(); } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.connect(c.destination);
    this.out = c.createGain(); this.out.gain.value = 0.8; this.out.connect(comp);
    // small synthetic hall: decaying noise impulse response
    const len = Math.floor(c.sampleRate * 2.2), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    const conv = c.createConvolver(); conv.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.32; conv.connect(wet); wet.connect(this.out);
    this.rev = conv;
    const nlen = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, nlen, c.sampleRate);
    const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
    this.startWind();
  },
  ok(name, gap) {
    if (!this.on || !this.ctx || this.ctx.state !== 'running') return false;
    const t = performance.now(); if (this.last[name] && t - this.last[name] < gap) return false;
    this.last[name] = t; return true;
  },
  // Karplus–Strong string, rendered once per pitch and cached
  pluckBuf(freq, bright) {
    const key = Math.round(freq) + ':' + bright;
    let b = this.plucks.get(key); if (b) return b;
    const c = this.ctx, sr = c.sampleRate, dur = 2.2, n = Math.floor(sr * dur);
    b = c.createBuffer(1, n, sr); const d = b.getChannelData(0);
    const P = Math.max(2, Math.round(sr / freq)), ring = new Float32Array(P);
    for (let i = 0; i < P; i++) ring[i] = (Math.random() * 2 - 1) * (i < P * bright ? 1 : 0.3);
    let idx = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const cur = ring[idx], nxt = ring[(idx + 1) % P];
      const v = 0.996 * 0.5 * (cur + nxt);
      ring[idx] = v; d[i] = cur * 0.9 + prev * 0.1; prev = cur;
      idx = (idx + 1) % P;
    }
    this.plucks.set(key, b); return b;
  },
  pluck(step, vol = 0.22, bend = 0) {
    const c = this.ctx, t = c.currentTime;
    const oct = Math.floor(step / 5), deg = ((step % 5) + 5) % 5;
    const freq = 196 * Math.pow(2, oct + PENTA[deg] / 12); // G3 base
    const s = c.createBufferSource(); s.buffer = this.pluckBuf(freq, 0.6);
    if (bend) { s.playbackRate.setValueAtTime(1, t); s.playbackRate.linearRampToValueAtTime(Math.pow(2, bend / 12), t + 0.12); s.playbackRate.linearRampToValueAtTime(1, t + 0.5); } // 농현: string bend
    const g = c.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.out); g.connect(this.rev);
    s.start(t);
  },
  tone(type, f0, f1, dur, vol, delay = 0, toRev = false) {
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); if (toRev) g.connect(this.rev); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol, type, f0, f1, q = 1, delay = 0, attack = 0.005) {
    const c = this.ctx, t = c.currentTime + delay, s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  // --- game events ---
  grab(step) { if (!this.ok('grab', 40)) return; this.pluck(step, 0.2); this.noise(0.08, 0.05, 'highpass', 3000, 2000, 1); },
  release(grade) {
    if (!this.ok('rel', 60)) return;
    this.noise(0.25, 0.06, 'bandpass', 500, 1800, 2);
    if (grade >= 2) this.pluck(12 + grade, 0.14, 2);
  },
  whoosh(v) { if (!this.ok('whoosh', 200)) return; this.noise(0.4, 0.03 + v * 0.05, 'bandpass', 300, 1200, 1.5, 0, 0.1); },
  snap() { if (!this.ok('snap', 80)) return; this.noise(0.12, 0.25, 'highpass', 1500, 800, 1); this.tone('triangle', 900, 200, 0.12, 0.06); },
  creak() { if (!this.ok('creak', 300)) return; this.noise(0.5, 0.08, 'bandpass', 700, 400, 12); },
  blossom(n) { if (!this.ok('blossom', 50)) return; this.tone('sine', 1320 + (n % 5) * 110, 1320 + (n % 5) * 110, 0.25, 0.04, 0, true); },
  power() { [0, 2, 4, 5].forEach((s, i) => setTimeout(() => this.on && this.ctx && this.pluck(10 + s, 0.16), i * 70)); },
  drum(vol = 0.5) { if (!this.ok('drum', 90)) return; this.tone('sine', 120, 45, 0.45, vol); this.noise(0.2, vol * 0.5, 'lowpass', 900, 150, 1); }, // 북
  hit() { if (!this.ok('hit', 150)) return; this.drum(0.6); this.noise(0.5, 0.2, 'lowpass', 2500, 300, 1); },
  splash() { this.noise(1.2, 0.35, 'lowpass', 1600, 120, 0.8); this.tone('sine', 90, 30, 1.0, 0.25); },
  thunder() { if (!this.ok('thunder', 500)) return; this.noise(2.5, 0.4, 'lowpass', 600, 60, 0.7, 0, 0.02); this.noise(0.15, 0.3, 'highpass', 3000, 1500, 1); },
  crow() { if (!this.ok('crow', 600)) return; this.tone('sawtooth', 620, 380, 0.18, 0.05); this.tone('sawtooth', 600, 360, 0.2, 0.05, 0.22); },
  milestone() { [0, 2, 4, 7].forEach((s, i) => setTimeout(() => this.on && this.ctx && this.pluck(5 + s, 0.18, i === 3 ? 1 : 0), i * 110)); },
  startWind() {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.8;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(this.out); s.start();
    this.wind = { f, g };
  },
  setWind(speed, playing, storm) {
    if (!this.wind) return;
    const t = this.ctx.currentTime, k = clamp(speed / 900, 0, 1);
    this.wind.g.gain.setTargetAtTime(this.on && playing ? 0.03 + k * 0.1 + (storm ? 0.05 : 0) : 0.0001, t, 0.3);
    this.wind.f.frequency.setTargetAtTime(300 + k * 900, t, 0.3);
  },
};
