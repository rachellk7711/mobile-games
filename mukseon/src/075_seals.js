// ---------- 낙관첩: collectible seal stamps (achievements), scroll-unroll intro ----------
const SEALS = [
  { id: 'first', han: '初線', name: '첫 먹줄', how: '매듭에 처음 먹줄을 겁니다' },
  { id: 'bamboo', han: '竹林', name: '대숲에 들다', how: '250 m에 오릅니다' },
  { id: 'falls', han: '瀑布', name: '폭포를 지나', how: '700 m에 오릅니다' },
  { id: 'moon', han: '明月', name: '달을 보다', how: '1,300 m에 오릅니다' },
  { id: 'storm', han: '雷雨', name: '번개 속으로', how: '2,000 m에 오릅니다' },
  { id: 'clouds', han: '雲上', name: '구름 위에 서다', how: '3,000 m에 오릅니다' },
  { id: 'master', han: '名筆', name: '명필', how: '명필 판정을 받습니다' },
  { id: 'onestroke', han: '一筆', name: '일필휘지', how: '일필휘지 판정을 받습니다' },
  { id: 'five', han: '五連', name: '다섯 획', how: '명필 이상을 5번 연속으로 냅니다' },
  { id: 'plum', han: '百梅', name: '매화 백 송이', how: '한 번에 매화 100송이를 모읍니다' },
  { id: 'talisman', han: '符籍', name: '부적 다루기', how: '붉은 매듭을 끊기 전에 20번 놓습니다' },
  { id: 'daily', han: '今日', name: '오늘의 족자', how: '오늘의 족자를 한 번 오릅니다' },
];
const Seals = {
  got: new Set(store.get('seals', [])),
  unlock(id) {
    if (!G || G.demo || this.got.has(id)) return;
    this.got.add(id); store.set('seals', [...this.got]);
    const s = SEALS.find(x => x.id === id);
    G.newSeals.push(s.name);
    const p = G.player;
    FX.word(p.x, p.y - 52, '낙관 · ' + s.name, true, true);
    SFX.power();
  },
  check() {
    const m = G.maxH;
    if (G.grabs >= 1) this.unlock('first');
    if (m >= 250) this.unlock('bamboo');
    if (m >= 700) this.unlock('falls');
    if (m >= 1300) this.unlock('moon');
    if (m >= 2000) this.unlock('storm');
    if (m >= 3000) this.unlock('clouds');
    if (G.blossoms >= 100) this.unlock('plum');
    if (G.combo >= 5) this.unlock('five');
    if (G.fragileSafe >= 20) this.unlock('talisman');
  },
};

// carved seal (白文印: the characters are cut away so paper shows through)
function drawSeal(cnv, s, owned) {
  const c = cnv.getContext('2d'), S = cnv.width;
  c.clearRect(0, 0, S, S);
  const r = mulberry32(hashStr(s.id));
  c.save(); c.translate(S / 2, S / 2); c.rotate((r() - 0.5) * 0.12);
  const w = S * 0.8;
  if (owned) {
    c.fillStyle = '#b3261e';
    c.beginPath(); c.roundRect ? c.roundRect(-w / 2, -w / 2, w, w, S * 0.06) : c.rect(-w / 2, -w / 2, w, w); c.fill();
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000'; c.font = `700 ${S * 0.3}px "Gowun Batang", serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    // two characters stacked right-to-left like a real seal: here side by side vertically
    c.fillText(s.han[0], w * 0.2, -w * 0.18); c.fillText(s.han[1], w * 0.2, w * 0.2);
    c.font = `700 ${S * 0.16}px "Gowun Batang", serif`;
    c.fillText('印', -w * 0.22, 0);
    // worn edges: small chips knocked out of the stone
    for (let i = 0; i < 26; i++) { const a = r() * TAU, rr = w * (0.36 + r() * 0.18); c.beginPath(); c.arc(Math.cos(a) * rr, Math.sin(a) * rr, r() * S * 0.025 + 0.5, 0, TAU); c.fill(); }
    c.fillRect(-w * 0.04, -w * 0.4, w * 0.012, w * 0.8);
    c.globalCompositeOperation = 'source-over';
  } else {
    c.strokeStyle = 'rgba(27,26,23,.35)'; c.lineWidth = 1.5; c.setLineDash([4, 4]);
    c.strokeRect(-w / 2, -w / 2, w, w); c.setLineDash([]);
    c.fillStyle = 'rgba(27,26,23,.25)'; c.font = `700 ${S * 0.3}px "Gowun Batang", serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('?', 0, 0);
  }
  c.restore();
}

function openSeals() {
  const grid = $('sealGrid'); grid.innerHTML = '';
  for (const s of SEALS) {
    const own = Seals.got.has(s.id);
    const d = document.createElement('div'); d.className = 'seal' + (own ? '' : ' locked');
    const cnv = document.createElement('canvas'); cnv.width = cnv.height = 120;
    d.appendChild(cnv);
    const t = document.createElement('div'); t.innerHTML = `<b>${s.name}</b><span>${s.how}</span>`;
    d.appendChild(t); grid.appendChild(d);
    drawSeal(cnv, s, own);
  }
  $('sealCount').textContent = `${Seals.got.size} / ${SEALS.length}`;
  showScreen('scrSeals');
}

// a wooden roller sweeps up as the scroll opens
function drawUnroll(c) {
  const k = clamp(G.t / 0.9, 0, 1);
  if (k >= 1 || G.demo) return;
  const e = 1 - Math.pow(1 - k, 3);
  const sw = W * V.scale, edge = V.h * (1 - e);
  c.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  c.fillStyle = '#2a2622'; c.fillRect(V.ox - 6, 0, sw + 12, edge);
  const g = c.createLinearGradient(0, edge - 10, 0, edge + 14);
  g.addColorStop(0, '#3d2a1c'); g.addColorStop(0.45, '#8a6440'); g.addColorStop(1, '#2e1f14');
  c.fillStyle = g; c.fillRect(V.ox - 14, edge - 10, sw + 28, 24);
  c.fillStyle = '#b8913e'; c.fillRect(V.ox - 22, edge - 7, 10, 18); c.fillRect(V.ox + sw + 12, edge - 7, 10, 18);
}
