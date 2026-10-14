// UI flow test with real taps on multiple viewport sizes.
const { launch, sleep, fileUrl } = require('./cdp.js');
const path = require('path');
const out = f => path.join(__dirname, '..', 'screenshots', f);
const center = id => `(()=>{const el=document.getElementById('${id}'); el.scrollIntoView({block:'center'}); const b=el.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,w:b.width,h:b.height}})()`;
async function run(w, h, mobile, tag) {
  const url = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
  const B = await launch(url, { w, h, dpr: 2, mobile });
  const res = [];
  const ok = (name, v) => { res.push((v ? 'PASS ' : 'FAIL ') + name); console.log('  .', name, v); };
  const tap = async id => { const c = await B.eval(center(id)); if (mobile) await B.tap(c.x, c.y); else await B.eval(`document.getElementById('${id}').click()`); await sleep(250); };
  try {
    ok('no horizontal overflow (menu)', await B.eval('document.documentElement.scrollWidth <= innerWidth'));
    await B.shot(out(`ui_${tag}_menu.png`));
    await tap('btnStart');
    ok('start -> play', (await B.eval('G.state')) === 'play');
    await sleep(1500);
    await tap('btnPause');
    ok('pause button -> pause', (await B.eval('G.state')) === 'pause');
    ok('pause screen visible', await B.eval('!document.getElementById("scrPause").hidden'));
    await B.shot(out(`ui_${tag}_pause.png`));
    const q0 = await B.eval('V.quality');
    await tap('tgQuality');
    ok('quality toggles', (await B.eval('V.quality')) !== q0);
    await tap('tgQuality');
    await tap('btnResume');
    ok('resume -> play', (await B.eval('G.state')) === 'play');
    await B.eval('G.pendingLevels=1');
    await sleep(700);
    ok('level-up opens', (await B.eval('G.state')) === 'levelup');
    await B.shot(out(`ui_${tag}_level.png`));
    const before = await B.eval('levelOpts.join()');
    await tap('btnReroll');
    await sleep(600);
    ok('reroll consumed', (await B.eval('G.rerolls')) === 0);
    const firstCard = await B.eval(`(()=>{const b=document.querySelector('#cards .card').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);
    const wBefore = await B.eval('JSON.stringify(G.player.weapons)+JSON.stringify(G.player.passives)');
    if (mobile) await B.tap(firstCard.x, firstCard.y); else await B.eval(`document.querySelector('#cards .card').click()`);
    await sleep(250);
    ok('card pick -> play', (await B.eval('G.state')) === 'play');
    ok('upgrade applied', (await B.eval('JSON.stringify(G.player.weapons)+JSON.stringify(G.player.passives)')) !== wBefore);
    void before;
    if (!mobile) {
      await B.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyD', key: 'd', windowsVirtualKeyCode: 68 });
      await sleep(600);
      await B.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyD', key: 'd', windowsVirtualKeyCode: 68 });
      ok('keyboard moves right', (await B.eval('G.player.vx')) > 20 || (await B.eval('G.player.x')) > 40);
      await B.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 });
      await B.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 });
      await sleep(100);
      ok('space dashes', (await B.eval('G.player.dashCd')) > 0);
      await B.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Escape', key: 'Escape' });
      await B.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Escape', key: 'Escape' });
      await sleep(100);
      ok('esc pauses', (await B.eval('G.state')) === 'pause');
      await tap('btnResume');
    }
    await B.shot(out(`ui_${tag}_play.png`));
    await B.eval('G.player.inv=0; G.player.hp=1; hurtPlayer(50, G.player.x+5, G.player.y)');
    await sleep(2600);
    ok('death -> end screen', await B.eval('!document.getElementById("scrEnd").hidden'));
    ok('no horizontal overflow (end)', await B.eval('document.documentElement.scrollWidth <= innerWidth'));
    await B.shot(out(`ui_${tag}_end.png`));
    await tap('btnRetry');
    ok('retry -> play', (await B.eval('G.state')) === 'play');
    ok('fresh run', (await B.eval('G.t')) < 2 && (await B.eval('G.level')) === 1);
    ok('best saved', (await B.eval('store.get("best",null)!==null')));
  } catch (e) { res.push('ERR ' + e.message); }
  const errs = B.logs.filter(l => /EXCEPTION|error/i.test(l));
  res.push('console errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  await B.close();
  return res;
}
(async () => {
  const all = { phone: [390, 844, true], small: [360, 640, true], land: [844, 390, true], desk: [1280, 800, false] };
  for (const tag of (process.argv[2] || 'phone,small,land,desk').split(',')) { const [w, h, m] = all[tag];
    console.log(`--- ${tag} ${w}x${h}`);
    console.log((await run(w, h, m, tag)).join('\n'));
  }
  process.exit(0);
})();
