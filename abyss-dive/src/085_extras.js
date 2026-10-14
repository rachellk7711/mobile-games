// ---------- codex, hull cracks, seabed finale, onboarding ----------
const CODEX = [
  { id: 'lantern', name: '샛비늘치', sci: 'Myctophidae', depth: '200–1,000 m', fact: '심해에서 가장 흔한 물고기 무리 가운데 하나입니다. 밤마다 수백 미터를 오르내리고, 배 쪽 발광포로 위에서 비치는 빛과 밝기를 맞춰 자기 그림자를 지웁니다.' },
  { id: 'jelly', name: '아톨라해파리', sci: 'Atolla wyvillei', depth: '1,000–4,000 m', fact: '공격을 받으면 몸 둘레를 따라 푸른 빛을 빙글빙글 돌립니다. 자기를 노리는 포식자보다 더 큰 포식자를 불러들이는 "도난 경보"로 알려져 있습니다.' },
  { id: 'comb', name: '빗해파리', sci: 'Ctenophora', depth: '0–7,000 m', fact: '몸을 따라 흐르는 무지갯빛은 스스로 내는 빛이 아닙니다. 여덟 줄의 빗판 섬모가 움직이며 빛을 산란시키는 것입니다. 이름과 달리 해파리와는 다른 문(門)에 속합니다.' },
  { id: 'squid', name: '반딧불오징어', sci: 'Watasenia scintillans', depth: '200–600 m', fact: '팔 끝과 몸에 발광기가 있습니다. 봄이면 일본 도야마만 해안으로 몰려와 밤바다를 푸르게 물들입니다.' },
  { id: 'angler', name: '초롱아귀', sci: 'Melanocetus johnsonii', depth: '1,000–4,000 m', fact: '머리에 달린 낚싯대(일리시움) 끝에 발광 세균이 삽니다. 그 빛으로 먹이를 꾀어 커다란 입으로 삼킵니다. 수컷은 암컷보다 훨씬 작습니다.' },
  { id: 'viper', name: '독사고기', sci: 'Chauliodus sloani', depth: '200–4,700 m', fact: '이빨이 너무 길어서 입 안에 다 들어가지 않습니다. 몸 옆으로 발광포가 줄지어 있고, 밤에는 먹이를 따라 얕은 곳까지 올라옵니다.' },
  { id: 'siph', name: '관해파리', sci: 'Siphonophorae', depth: '700–3,000 m', fact: '한 마리처럼 보이지만 역할이 나뉜 수많은 개충(zooid)이 모인 군체입니다. 헤엄, 사냥, 소화, 번식을 서로 다른 개충이 맡습니다.' },
  { id: 'isopod', name: '대왕등각류', sci: 'Bathynomus giganteus', depth: '170–2,140 m', fact: '쥐며느리의 친척인데 몸길이가 40 cm를 넘기도 합니다. 심해 거대화의 대표적인 예이며, 수족관에서 몇 년 동안 먹지 않고 버틴 기록이 있습니다.' },
  { id: 'b0', boss: 0, name: '대왕오징어', sci: 'Architeuthis dux', depth: '300–1,000 m', fact: '동물 가운데 손꼽히게 큰 눈을 가졌습니다. 지름이 25 cm를 넘는 눈으로 어둠 속에서 다가오는 향유고래의 윤곽을 찾아냅니다. 살아 있는 모습은 2004년에야 처음 사진으로 기록되었습니다.' },
  { id: 'b1', boss: 1, name: '심연의 초롱아귀', sci: 'Melanocetus johnsonii', depth: '4,000 m', fact: '실제 몸길이는 암컷도 20 cm 정도입니다. 아귀류 가운데 일부 종은 작은 수컷이 암컷 몸에 영구히 붙어 혈관까지 합쳐집니다. 이 게임 속 개체는 실제보다 수십 배 크게 그렸습니다.' },
  { id: 'b2', boss: 2, name: '거대 관해파리 군체', sci: 'Praya dubia', depth: '6,000 m', fact: '몸길이가 40 m를 넘는 기록이 있어 대왕고래보다 깁니다. 2020년 호주 닝갈루 협곡에서는 수십 m 길이의 다른 관해파리(아폴레미아속)가 나선형으로 감긴 채 촬영되었습니다.' },
  { id: 'b3', boss: 3, name: '해연의 군주', sci: '미기록종', depth: '10,935 m', fact: '붉은 빛을 내는 심해 드래곤피시에서 착안한 가상의 존재입니다. 대부분의 심해 생물은 붉은 빛을 보지 못해서, 드래곤피시는 들키지 않고 먹이를 비춰 볼 수 있습니다.' },
];

const Seen = {
  set: new Set(store.get('seen', [])),
  mark(id) { if (!this.set.has(id)) { this.set.add(id); store.set('seen', [...this.set]); } },
};

function makeBossObj(def, x, y) {
  const b = {
    isBoss: true, def, kind: def.kind, name: def.name, x, y, vx: 0, vy: 0, r: def.r, hp: 1, maxHp: 1, phase: 1, t: 0, st: 2.2,
    atk: 'intro', dead: false, dying: 0, flash: 0, reveal: 0, face: 0, orb: 0, dash: null, tent: [], seg: [], lureOff: 0,
  };
  if (b.kind === 'squid') {
    for (let i = 0; i < 10; i++) {
      const long = i >= 8, n = long ? 16 : 8, L = long ? 13 : 7, pts = [];
      for (let j = 0; j < n; j++) pts.push({ x: x - j * L, y });
      b.tent.push({ pts, L, long, off: (i < 8 ? (i - 3.5) * 0.16 : (i === 8 ? -0.25 : 0.25)), lash: 0, lx: 0, ly: 0 });
    }
  }
  if (b.kind === 'siph') for (let i = 0; i < 34; i++) b.seg.push({ x: x - i * 15, y, glow: 0, armed: 0 });
  if (b.kind === 'lord') for (let i = 0; i < 20; i++) b.seg.push({ x: x - i * 20, y });
  return b;
}

// portrait: the creature drawn with the same renderer as the game, on a lit backdrop
function drawPortrait(cnv, entry, locked) {
  const c = cnv.getContext('2d'), W = cnv.width, H = cnv.height;
  c.setTransform(1, 0, 0, 1, 0, 0);
  const g = c.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, '#0c2a3a'); g.addColorStop(1, '#020a10');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const keepT = G.t; G.t = 1.3;
  let obj, scale;
  if (entry.boss !== undefined) {
    const def = BOSSES[entry.boss];
    obj = makeBossObj(def, 0, 0);
    obj.t = 2; obj.face = entry.boss === 2 ? -0.5 : 0;
    if (obj.kind === 'siph') { // a gentle S-curve so the colony fits the frame
      obj.seg.forEach((s, i) => { s.x = -Math.cos(i * 0.22) * 70 + 40 - i * 2; s.y = Math.sin(i * 0.22) * 40 + i * 1.2; });
      obj.x = 70; obj.y = -10;
    } else if (obj.kind === 'lord') {
      obj.seg.forEach((s, i) => { s.x = -24 - i * 14; s.y = Math.sin(i * 0.5) * 16; });
    } else for (let k = 0; k < 90; k++) animateBossBody(obj, 1 / 60);
    scale = { squid: 0.62, angler: 0.75, siph: 0.85, lord: 0.62 }[obj.kind];
  } else {
    const T = ETYPES[entry.id];
    obj = { type: entry.id, x: 0, y: 0, vx: 0, vy: 0, r: T.r, t: 1.1, ph: 1.2, face: 0, state: 0, flash: 0, reveal: 0, elite: false, seg: null };
    if (entry.id === 'siph') { obj.seg = []; for (let i = 0; i < 11; i++) obj.seg.push({ x: -i * 12, y: Math.sin(i * 0.6) * 8 }); obj.x = 0; }
    if (entry.id === 'jelly') obj.face = -Math.PI / 2;
    scale = Math.min(3.2, 34 / T.r);
    if (entry.id === 'siph') scale = 1.5;
  }
  const ox = W / 2 + (entry.id === 'siph' ? 60 : (obj.kind === 'lord' ? 70 : obj.kind === 'squid' ? 30 : 0)), oy = H / 2;
  if (locked) {
    // silhouette: draw on a scratch canvas, then paint over the shape only
    const s = document.createElement('canvas'); s.width = W; s.height = H;
    const sc = s.getContext('2d');
    sc.setTransform(scale, 0, 0, scale, ox, oy);
    if (entry.boss !== undefined) drawBoss(sc, obj); else drawEnemy(sc, obj);
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalCompositeOperation = 'source-atop';
    sc.fillStyle = '#01060a'; sc.fillRect(0, 0, W, H);
    c.drawImage(s, 0, 0);
  } else {
    c.setTransform(scale, 0, 0, scale, ox, oy);
    if (entry.boss !== undefined) drawBoss(c, obj); else drawEnemy(c, obj);
  }
  if (!locked) {
    c.globalCompositeOperation = 'lighter';
    if (entry.boss !== undefined) drawBossGlow(c, obj); else drawEnemyGlow(c, obj);
    c.globalCompositeOperation = 'source-over';
  } else {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = 'rgba(2,10,16,.55)'; c.fillRect(0, 0, W, H);
  }
  G.t = keepT;
}

function openCodex() {
  const box = $('codexGrid'); box.innerHTML = '';
  let n = 0;
  for (const e of CODEX) {
    const seen = Seen.set.has(e.id);
    if (seen) n++;
    const card = document.createElement('div');
    card.className = 'cx' + (seen ? '' : ' locked') + (e.boss !== undefined ? ' boss' : '');
    const cnv = document.createElement('canvas'); cnv.width = 320; cnv.height = 180;
    card.appendChild(cnv);
    const body = document.createElement('div'); body.className = 'cxb';
    body.innerHTML = seen
      ? `<div class="cxn">${e.name}</div><div class="cxs">${/[가-힣]/.test(e.sci) ? e.sci : `<i>${e.sci}</i>`} · ${e.depth}</div><p>${e.fact}</p>`
      : `<div class="cxn">미확인 생물</div><div class="cxs">${e.depth}</div><p>${e.boss !== undefined ? '이 수심까지 내려가 마주치면 기록됩니다.' : '잠항 중에 마주치면 기록됩니다.'}</p>`;
    card.appendChild(body);
    box.appendChild(card);
    try { drawPortrait(cnv, e, !seen); } catch (err) { console.error(err); }
  }
  $('codexCount').textContent = `${n} / ${CODEX.length}`;
  showScreen('scrCodex');
}

// ---------- hull cracks: pre-drawn fractures fading in as the hull fails ----------
let crackCv = null;
function buildCracks() {
  crackCv = document.createElement('canvas');
  const w = crackCv.width = Math.ceil(V.w), h = crackCv.height = Math.ceil(V.h);
  const c = crackCv.getContext('2d');
  c.lineCap = 'round';
  const crack = (x, y, a, len, wdt, depth) => {
    c.lineWidth = wdt; c.strokeStyle = `rgba(220,245,255,${0.25 + wdt * 0.15})`;
    c.beginPath(); c.moveTo(x, y);
    let px = x, py = y;
    const n = 6 + (len / 20 | 0);
    for (let i = 0; i < n; i++) {
      a += rand(-0.5, 0.5);
      px += Math.cos(a) * len / n; py += Math.sin(a) * len / n;
      c.lineTo(px, py);
      if (depth < 3 && Math.random() < 0.25) { c.stroke(); crack(px, py, a + rand(-1.2, 1.2), len * 0.5, wdt * 0.6, depth + 1); c.beginPath(); c.moveTo(px, py); c.lineWidth = wdt; }
    }
    c.stroke();
  };
  const corners = [[0, 0, 0.8], [w, 0, 2.3], [0, h, -0.8], [w, h, -2.3]];
  for (const [x, y, a] of corners) for (let k = 0; k < 2; k++) crack(x, y, a + rand(-0.4, 0.4), Math.min(w, h) * rand(0.3, 0.5), 2, 0);
}

// ---------- seabed finale ----------
function drawSeabed(c, k) {
  // k: 0..1 rise
  const w = V.w, h = V.h, top = h - h * 0.34 * smooth(k);
  const g = c.createLinearGradient(0, top - 40, 0, h);
  g.addColorStop(0, 'rgba(70,60,90,0)'); g.addColorStop(0.15, 'rgba(48,40,62,0.95)'); g.addColorStop(1, '#0d0a14');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 12) {
    const y = top + Math.sin(x * 0.012 + 1) * 14 + Math.sin(x * 0.041) * 6 + Math.sin(x * 0.11) * 2;
    c.lineTo(x, y);
  }
  c.lineTo(w, h); c.closePath(); c.fill();
  // lit silt rim where the lamp reaches
  c.strokeStyle = `rgba(190,220,230,${0.25 * k})`; c.lineWidth = 1.5;
  c.beginPath();
  for (let x = 0; x <= w; x += 12) {
    const y = top + Math.sin(x * 0.012 + 1) * 14 + Math.sin(x * 0.041) * 6 + Math.sin(x * 0.11) * 2;
    if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();
  // xenophyophores and sea cucumbers: the real residents of the hadal floor
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5) / 9 * w + Math.sin(i * 7.3) * 20;
    const y = top + Math.sin(x * 0.012 + 1) * 14 + Math.sin(x * 0.041) * 6 + 10 + (i % 3) * 8;
    drawGlow(c, x, y, 10 + (i % 4) * 3, i % 3 ? [180, 140, 255] : [120, 230, 220], 0.35 * k * (0.6 + 0.4 * Math.sin(G.t * 2 + i)));
  }
  c.globalCompositeOperation = 'source-over';
}

// ---------- onboarding hint ----------
function drawHint(c) {
  if (G.demo || G.moved || G.t > 9 || G.state !== 'play') return;
  const a = clamp(Math.min(G.t * 2, (9 - G.t)), 0, 1) * 0.9;
  const x = V.w / 2, y = V.h * 0.72;
  const off = Math.sin(G.t * 3) * 26;
  c.globalAlpha = a;
  c.strokeStyle = 'rgba(111,243,224,.5)'; c.lineWidth = 2;
  c.beginPath(); c.arc(x, y, 46, 0, TAU); c.stroke();
  c.fillStyle = 'rgba(111,243,224,.75)';
  c.beginPath(); c.arc(x + off, y, 16, 0, TAU); c.fill();
  c.font = '600 14px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#e3f6f3'; c.fillText('화면을 끌어서 조종하세요', x, y + 72);
  c.globalAlpha = 1;
}
