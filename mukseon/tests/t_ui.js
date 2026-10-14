// UI flows with real touch (or keyboard on desktop) across viewport sizes.
// usage: node t_ui.js [phone,small,land,desk]
const { launch, sleep, fileUrl } = require('./cdp.js');
const path = require('path');
const out = f => path.join(__dirname, '..', 'screenshots', f);
const center = id => `(()=>{const el=document.getElementById('${id}'); el.scrollIntoView({block:'center'}); const b=el.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2}})()`;
async function run(w, h, mobile, tag) {
  const B = await launch(fileUrl(path.join(__dirname, '..', 'index.html')), { w, h, dpr: 2, mobile });
  const res = [];
  const ok = (n, v) => res.push((v ? 'PASS ' : 'FAIL ') + n);
  const tap = async id => { const c = await B.eval(center(id)); if (mobile) await B.tap(c.x, c.y); else await B.eval(`document.getElementById('${id}').click()`); await sleep(300); };
  const hold = async ms => {
    if (mobile) { await B.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: w / 2, y: h * 0.7 }] }); await sleep(ms); await B.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    else { await B.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 }); await sleep(ms); await B.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 }); }
  };
  try {
    ok('menu fits without sideways scroll', await B.eval('document.documentElement.scrollWidth <= innerWidth'));
    await B.shot(out(`ui_${tag}_menu.png`));
    await tap('btnStart');
    ok('start -> play', (await B.eval('G.state')) === 'play');
    const y0 = await B.eval('G.player.y');
    for (let i = 0; i < 4; i++) { await hold(500); await sleep(350); }
    ok('hold/release climbs (' + Math.round(await B.eval('G.maxH')) + ' m, grabs ' + (await B.eval('G.grabs')) + ')', (await B.eval('G.grabs')) >= 2 && (await B.eval('G.player.y')) < y0 - 50);
    await B.shot(out(`ui_${tag}_play.png`));
    await tap('btnPause');
    ok('pause', (await B.eval('G.state')) === 'pause');
    const s0 = await B.eval('SFX.on');
    await tap('tgSound');
    ok('sound toggle', (await B.eval('SFX.on')) !== s0);
    await tap('tgSound');
    await tap('btnResume');
    ok('resume', (await B.eval('G.state')) === 'play');
    await tap('btnPause');
    await tap('btnQuit');
    await sleep(1900);
    ok('quit -> end screen', await B.eval('!document.getElementById("scrEnd").hidden'));
    ok('end fits without sideways scroll', await B.eval('document.documentElement.scrollWidth <= innerWidth'));
    await B.shot(out(`ui_${tag}_end.png`));
    await tap('btnRetry');
    ok('retry -> fresh run', (await B.eval('G.state')) === 'play' && (await B.eval('G.grabs')) === 0);
    // die in the ink for real: stop climbing and wait
    await B.eval('G.inkY = G.player.y + 30');
    for (let i = 0; i < 24 && !(await B.eval('!document.getElementById("scrEnd").hidden')); i++) await sleep(250);
    ok('ink death -> end screen', await B.eval('!document.getElementById("scrEnd").hidden') && (await B.eval('G.cause')) === 'ink');
    await tap('btnMenu');
    ok('back to menu', await B.eval('!document.getElementById("scrMenu").hidden') && (await B.eval('G.state')) === 'menu');
    await tap('btnDaily');
    const seedA = await B.eval('G.seed');
    ok('daily run starts', (await B.eval('G.daily')) === true);
    await B.eval('G.inkY = G.player.y + 30');
    for (let i = 0; i < 24 && !(await B.eval('!document.getElementById("scrEnd").hidden')); i++) await sleep(250);
    await tap('btnRetry');
    ok('daily retry keeps the same scroll', (await B.eval('G.seed')) === seedA && (await B.eval('G.daily')) === true);
    ok('best saved', (await B.eval('store.get("best", -1)')) >= 0);
  } catch (e) { res.push('ERR ' + e.message); }
  res.push('console errors: ' + (B.logs.filter(l => /EXCEPTION|error/i.test(l)).join(' | ') || 'none'));
  await B.close();
  return res;
}
(async () => {
  const all = { phone: [390, 844, true], small: [360, 640, true], land: [844, 390, true], desk: [1280, 800, false] };
  for (const tag of (process.argv[2] || 'phone,small,land,desk').split(',')) {
    const [w, h, m] = all[tag];
    const r = await run(w, h, m, tag);
    console.log(`--- ${tag} ${w}x${h}\n` + r.join('\n'));
  }
  process.exit(0);
})();
