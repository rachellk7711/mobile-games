// Visual tour across biomes: fast-forward with an invulnerable autopilot, then capture in real time.
const { launch, sleep, fileUrl } = require('./cdp.js');
const path = require('path'), fs = require('fs');
const out = f => path.join(__dirname, '..', 'screenshots', f);
const W = +process.argv[2] || 390, H = +process.argv[3] || 844, tag = process.argv[4] || '';
(async () => {
  const B = await launch(fileUrl(path.join(__dirname, '..', 'index.html')), { w: W, h: H, dpr: 2 });
  const pilot = fs.readFileSync(path.join(__dirname, 't_sim.js'), 'utf8').match(/window\.__pilot = [\s\S]*?\n    \};/)[0];
  await B.eval(pilot + `;
    window.__ff = function(cond){ const dt=1/60; for(let i=0;i<60*600;i++){ Input.bot=__pilot(); G.player.shield=2; G.player.lives=3; update(dt); FX.update(dt); if(cond()) break; } Input.bot=false; return Math.round(G.maxH)+'m t='+Math.round(G.t); };
    window.__live = setInterval(()=>{ if(G.state==='play'){ Input.bot=__pilot(); G.player.shield=Math.max(G.player.shield,1); G.player.lives=3; } }, 16);
    startRun('normal');`);
  const step = async (name, cond, wait = 1800) => { console.log(name, await B.eval(`__ff(()=>${cond})`)); await sleep(wait); await B.shot(out(tag + name + '.png')); };
  try {
    await step('10_dawn', 'G.maxH>120');
    await step('11_bamboo', 'G.maxH>420');
    await step('12_falls', 'G.maxH>900');
    await step('13_night', 'G.maxH>1500');
    await step('14_storm', 'G.maxH>2300');
    await step('15_clouds', 'G.maxH>3150');
    await B.eval('clearInterval(__live); Input.bot=false; G.player.shield=0; G.player.lives=1; G.player.flash=0; hitPlayer("crow")');
    await sleep(2400);
    await B.shot(out(tag + '16_end.png'));
    console.log('state', await B.eval('G.state'), 'end shown', await B.eval('!document.getElementById("scrEnd").hidden'));
  } catch (e) { console.log('ERR', e.message); }
  console.log('LOGS:', B.logs.join('\n') || 'none');
  await B.close(); process.exit(0);
})();
