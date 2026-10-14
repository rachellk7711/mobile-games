const { launch, sleep, fileUrl } = require('./cdp.js');
const path = require('path'), fs = require('fs');
const out = f => path.join(__dirname, '..', 'screenshots', f);
(async () => {
  const B = await launch(fileUrl(path.join(__dirname, '..', 'index.html')), { w: 390, h: 844, dpr: 2 });
  const res = [];
  const ok = (n, v) => res.push((v ? 'PASS ' : 'FAIL ') + n);
  try {
    await B.eval('document.getElementById("btnSeals").click()'); await sleep(500);
    ok('seal book opens with 0 owned', (await B.eval('document.getElementById("sealCount").textContent')) === '0 / 12');
    await B.eval('document.getElementById("btnSealsBack").click()'); await sleep(200);
    // unroll intro mid-way
    await B.eval('document.getElementById("btnStart").click()'); await sleep(250);
    await B.shot(out('20_unroll.png'));
    // play a bit with the pilot to earn a few seals naturally
    const pilot = fs.readFileSync(path.join(__dirname, 't_sim.js'), 'utf8').match(/window\.__pilot = [\s\S]*?\n    \};/)[0];
    await B.eval(pilot + `; (()=>{ const dt=1/60; for(let i=0;i<60*120;i++){ Input.bot=__pilot(); G.player.shield=2; G.player.lives=3; update(dt); FX.update(dt); if(G.maxH>760) break; } Input.bot=false; })()`);
    ok('height seals earned (' + (await B.eval('[...Seals.got].join(",")')) + ')', await B.eval('Seals.got.has("first") && Seals.got.has("bamboo") && Seals.got.has("falls")'));
    await sleep(600);
    await B.shot(out('21_seal_toast.png'));
    await B.eval('G.player.shield=0; G.player.lives=1; G.player.flash=0; hitPlayer("crow")'); await sleep(2200);
    ok('end screen lists new seals', /새 낙관/.test(await B.eval('document.getElementById("endBest").textContent')));
    await B.shot(out('22_end_seals.png'));
    await B.eval('document.getElementById("btnMenu").click()'); await sleep(300);
    await B.eval('document.getElementById("btnSeals").click()'); await sleep(500);
    await B.shot(out('23_sealbook.png'));
    ok('seal book shows owned count', (await B.eval('document.getElementById("sealCount").textContent')) !== '0 / 12');
  } catch (e) { res.push('ERR ' + e.message); }
  console.log(res.join('\n'));
  console.log('console errors:', B.logs.filter(l => /EXCEPTION|error/i.test(l)).join(' | ') || 'none');
  await B.close(); process.exit(0);
})();
