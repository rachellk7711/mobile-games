// FPS probe on GPU-backed headless Chrome at phone resolution, in several biomes.
const { launch, sleep, fileUrl } = require('./cdp.js');
const path = require('path'), fs = require('fs');
(async () => {
  const B = await launch(fileUrl(path.join(__dirname, '..', 'index.html')), { w: 390, h: 844, dpr: 3, gpu: true });
  const pilot = fs.readFileSync(path.join(__dirname, 't_sim.js'), 'utf8').match(/window\.__pilot = [\s\S]*?\n    \};/)[0];
  console.log('renderer', await B.eval(`(()=>{const c=document.createElement('canvas').getContext('webgl'); const d=c&&c.getExtension('WEBGL_debug_renderer_info'); return d?c.getParameter(d.UNMASKED_RENDERER_WEBGL):'n/a'})()`));
  await B.eval(pilot + `; window.__live = setInterval(()=>{ if(G.state==='play'){ Input.bot=__pilot(); G.player.shield=2; G.player.lives=3; } }, 16); startRun('normal');`);
  for (const [name, m] of [['dawn', 100], ['bamboo', 450], ['night', 1500], ['storm', 2300], ['clouds', 3100]]) {
    await B.eval(`(()=>{ const dt=1/60; for(let i=0;i<60*400;i++){ Input.bot=__pilot(); G.player.shield=2; G.player.lives=3; update(dt); FX.update(dt); if(G.maxH>${m}) break; } })()`);
    await sleep(800);
    const fps = await B.eval(`new Promise(r=>{let n=0;const t0=performance.now();function f(){n++;if(performance.now()-t0<3000)requestAnimationFrame(f);else r((n/3).toFixed(1))}requestAnimationFrame(f)})`);
    console.log(name, 'fps', fps, '| chunks cached', await B.eval('BGC.map.size'), '| weather', await B.eval('FX.weather.length'));
  }
  console.log('errors:', B.logs.filter(l => /EXCEPTION|error/i.test(l)).join(' | ') || 'none');
  await B.close(); process.exit(0);
})();
