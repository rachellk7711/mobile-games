// FPS probe on GPU-backed headless Chrome (realistic) vs SwiftShader (software).
// usage: node t_gpu.js [zone2|lord] [gpu|sw|both]
const { launch, sleep, fileUrl } = require('./cdp.js');
const path = require('path');
const scene = process.argv[2] || 'zone2', mode = process.argv[3] || 'both';
(async () => {
  const modes = mode === 'both' ? [false, true] : [mode === 'gpu'];
  for (const gpu of modes) {
    const B = await launch(fileUrl(path.join(__dirname, '..', 'index.html')), { w: 390, h: 844, dpr: 3, gpu });
    const info = await B.eval(`(()=>{const c=document.createElement('canvas').getContext('webgl'); const d=c&&c.getExtension('WEBGL_debug_renderer_info'); return d?c.getParameter(d.UNMASKED_RENDERER_WEBGL):'n/a'})()`);
    await B.eval('document.getElementById("btnStart").click()');
    const cond = scene === 'lord' ? "G.boss&&G.boss.kind==='lord'&&G.boss.t>6" : 'G.depth>2400';
    await B.eval(`(()=>{ const _cu=chooseUpgrade; chooseUpgrade=function(id){ levelOpenAt=-1e9; return _cu(id); }; window.__god=setInterval(()=>{G.player.hp=G.player.maxHp},100); const dt=1/60; for(let i=0;i<60*1500;i++){ if(G.state==='levelup') chooseUpgrade(levelOpts[Math.floor(Math.random()*3)]); G.player.hp=G.player.maxHp; update(dt); if(${cond}) break; } })()`);
    await sleep(1000);
    const fps = await B.eval(`new Promise(r=>{let n=0;const t0=performance.now();function f(){n++;if(performance.now()-t0<4000)requestAnimationFrame(f);else r((n/4).toFixed(1))}requestAnimationFrame(f)})`);
    console.log(gpu ? 'GPU' : 'SwiftShader', '|', info.slice(0, 60), '| scene', scene, '| fps', fps, '| enemies', await B.eval('G.enemies.length'), '| eshots', await B.eval('G.eshots.length'), '| quality', await B.eval('V.quality'));
    await B.close();
  }
  process.exit(0);
})();
