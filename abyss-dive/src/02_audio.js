// ---------- synthesized audio (no files) ----------
const SFX = {
  ctx: null, out: null, echo: null, noiseBuf: null, amb: null, on: true, last: {},
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    comp.connect(c.destination);
    this.out = c.createGain(); this.out.gain.value = 0.7; this.out.connect(comp);
    // shared echo bus for sonar pings
    const d = c.createDelay(1); d.delayTime.value = 0.31;
    const fb = c.createGain(); fb.gain.value = 0.38;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    d.connect(lp); lp.connect(fb); fb.connect(d);
    const wet = c.createGain(); wet.gain.value = 0.5; lp.connect(wet); wet.connect(this.out);
    this.echo = d;
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.startAmbient();
  },
  ok(name, gap) {
    if (!this.on || !this.ctx || this.ctx.state !== 'running') return false;
    const t = performance.now();
    if (this.last[name] && t - this.last[name] < gap) return false;
    this.last[name] = t; return true;
  },
  env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  },
  tone(type, f0, f1, dur, vol, opt = {}) {
    const c = this.ctx, t = c.currentTime + (opt.delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    if (opt.detune) o.detune.value = opt.detune;
    this.env(g, t, opt.attack || 0.005, vol, dur);
    let node = o;
    if (opt.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opt.lp; node.connect(f); node = f; }
    node.connect(g); g.connect(this.out);
    if (opt.echo) g.connect(this.echo);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol, ftype, f0, f1, q = 1, opt = {}) {
    const c = this.ctx, t = c.currentTime + (opt.delay || 0);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = opt.rate || 1;
    const f = c.createBiquadFilter(); f.type = ftype; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); this.env(g, t, opt.attack || 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(this.out);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  // --- game sounds ---
  harpoon() { if (!this.ok('harpoon', 60)) return; this.tone('triangle', 720, 260, 0.09, 0.05); this.noise(0.06, 0.04, 'bandpass', 3000, 1200, 2); },
  hit() { if (!this.ok('hit', 35)) return; this.noise(0.05, 0.05, 'highpass', 2500, 1800, 1); },
  kill() { if (!this.ok('kill', 45)) return; this.tone('sine', 420, 90, 0.16, 0.08); this.noise(0.12, 0.05, 'lowpass', 1800, 300, 1); },
  pickup() { if (!this.ok('pickup', 45)) return; const f = 1100 + Math.random() * 500; this.tone('sine', f, f * 1.5, 0.07, 0.035); },
  sonar() { if (!this.ok('sonar', 200)) return; this.tone('sine', 1480, 1460, 0.9, 0.09, { echo: true, attack: 0.003 }); this.tone('sine', 740, 735, 0.6, 0.03); },
  torpedo() { if (!this.ok('torp', 90)) return; this.noise(0.35, 0.06, 'bandpass', 600, 1800, 3); this.tone('sawtooth', 120, 200, 0.25, 0.025, { lp: 900 }); },
  explode(big) { if (!this.ok('boom', 70)) return; this.noise(big ? 1.0 : 0.5, big ? 0.35 : 0.2, 'lowpass', 900, 70, 1); this.tone('sine', 110, 28, big ? 0.9 : 0.45, big ? 0.3 : 0.16); },
  zap() { if (!this.ok('zap', 80)) return; this.tone('square', 1800, 300, 0.12, 0.03, { lp: 4000 }); this.noise(0.14, 0.06, 'highpass', 4000, 2000, 1); },
  drone() { if (!this.ok('drone', 120)) return; this.tone('sine', 900, 1300, 0.05, 0.02); },
  hurt() { if (!this.ok('hurt', 120)) return; this.tone('square', 170, 55, 0.3, 0.07, { lp: 1200 }); this.noise(0.25, 0.12, 'lowpass', 1200, 200, 1); },
  dash() { if (!this.ok('dash', 100)) return; this.noise(0.3, 0.1, 'bandpass', 300, 2200, 2); },
  levelup() { if (!this.ok('lvl', 300)) return; [0, 4, 7, 12].forEach((s, i) => this.tone('triangle', 523.25 * Math.pow(2, s / 12), 523.25 * Math.pow(2, s / 12), 0.35, 0.06, { delay: i * 0.07, echo: true })); },
  pick() { if (!this.ok('pickc', 80)) return; this.tone('sine', 660, 990, 0.12, 0.06); },
  warn() { if (!this.ok('warn', 250)) return; this.tone('square', 880, 880, 0.12, 0.035, { lp: 2000 }); this.tone('square', 660, 660, 0.14, 0.035, { lp: 2000, delay: 0.14 }); },
  roar() { if (!this.ok('roar', 800)) return; this.tone('sawtooth', 70, 38, 1.6, 0.16, { lp: 380, attack: 0.15 }); this.tone('sawtooth', 71.5, 39, 1.6, 0.12, { lp: 300, attack: 0.2 }); this.noise(1.4, 0.12, 'lowpass', 500, 120, 2, { attack: 0.2 }); },
  creak() { if (!this.ok('creak', 2000)) return; this.noise(1.6, 0.16, 'bandpass', 180, 90, 9, { attack: 0.3, rate: 0.4 }); this.tone('sawtooth', 48, 41, 1.4, 0.05, { lp: 200, attack: 0.4 }); },
  breach() { this.tone('sawtooth', 200, 30, 1.6, 0.2, { lp: 900 }); this.noise(1.8, 0.4, 'lowpass', 2000, 60, 1); },
  win() { [0, 7, 12, 16, 19, 24].forEach((s, i) => this.tone('triangle', 392 * Math.pow(2, s / 12), 392 * Math.pow(2, s / 12), 0.8, 0.06, { delay: i * 0.12, echo: true })); },
  bossDown() { this.explode(true); [0, 3, 7, 10].forEach((s, i) => this.tone('sine', 220 * Math.pow(2, s / 12), 220 * Math.pow(2, s / 12), 0.9, 0.06, { delay: 0.4 + i * 0.15, echo: true })); },
  // --- ambient bed: detuned drone + water rumble, darkens with depth ---
  startAmbient() {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = 0; g.connect(this.out);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 0.7; lp.connect(g);
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 55.35;
    const og = c.createGain(); og.gain.value = 0.18; o1.connect(og); o2.connect(og); og.connect(lp);
    const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; n.playbackRate.value = 0.5;
    const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 320;
    const ng = c.createGain(); ng.gain.value = 0.25; n.connect(nf); nf.connect(ng); ng.connect(lp);
    o1.start(); o2.start(); n.start();
    this.amb = { g, lp, o1, o2 };
  },
  setAmbient(depth, playing) {
    if (!this.amb) return;
    const t = this.ctx.currentTime, a = this.amb;
    const target = (this.on && playing) ? 0.22 : 0.0001;
    a.g.gain.setTargetAtTime(target, t, 0.8);
    const k = clamp(depth / 11000, 0, 1);
    a.lp.frequency.setTargetAtTime(lerp(700, 180, k), t, 1.5);
    a.o1.frequency.setTargetAtTime(lerp(55, 41, k), t, 2);
    a.o2.frequency.setTargetAtTime(lerp(55.35, 41.3, k), t, 2);
  },
};
