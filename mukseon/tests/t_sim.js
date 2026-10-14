// Fast-forward runs with an autopilot climber.
// usage: node t_sim.js [runs] [god 0/1] [maxSeconds] [daily 0/1]
const { launch, fileUrl } = require('./cdp.js');
const path = require('path');
const runs = +process.argv[2] || 3, god = process.argv[3] === '1', maxS = +process.argv[4] || 600, daily = process.argv[5] === '1';
(async () => {
  const B = await launch(fileUrl(path.join(__dirname, '..', 'index.html')), { w: 390, h: 844, dpr: 1 });
  await B.eval(`
    window.__pilot = function(){
      const p=G.player, v=vel(p);
      // dodge: let go if a hazard is about to touch us while roped
      if (p.rope) {
        const a=p.rope.a;
        if (a.type==='fragile' && a.hold>0.75) return false;
        if (p.y < a.y + 4 && v.y < -250) return false;
        if (p.rope.L <= LMIN + 1 && (v.y < -150 || p.grabT > 0.5)) return false;
        return true;
      }
      const t = findTarget(p);
      return !!t && (v.y > -200);
    };
    window.__run = function(god, maxS, mode){
      startRun(mode);
      const dt=1/60; let steps=0, noT=0; const biomes=[]; let lastB=-1; let causes='';
      while(steps < maxS*60){
        if (G.state!=='play') break;
        Input.bot = __pilot();
        if (god) G.player.shield = 2;
        if (!G.player.rope && !findTarget(G.player) && vel(G.player).y > 0) noT++;
        update(dt); FX.update(dt); steps++;
        if (G.biome.id!==lastB){ lastB=G.biome.id; biomes.push(G.biome.id+'@'+Math.round(G.t)+'s'); }
        if (!isFinite(G.player.x)||!isFinite(G.player.y)) return {error:'NaN player'};
      }
      Input.bot=false;
      return { state:G.state, cause:G.cause, t:Math.round(G.t), h:Math.round(G.maxH), blossoms:G.blossoms, grabs:G.grabs, maxCombo:G.maxCombo,
        biomes:biomes.join(' '), anchors:G.anchors.length, hazards:G.hazards.length, items:G.items.length, inkGap:Math.round(G.inkY-G.player.y), noTargetFallS:(noT/60).toFixed(1) };
    };
  `);
  for (let i = 0; i < runs; i++) {
    try { console.log(JSON.stringify(await B.eval(`__run(${god}, ${maxS}, '${daily ? 'daily' : 'normal'}')`))); }
    catch (e) { console.log('ERR', e.message.slice(0, 600)); }
  }
  const errs = B.logs.filter(l => /EXCEPTION|error/i.test(l));
  console.log('errors:', errs.length ? errs.slice(0, 8).join('\n') : 'none');
  await B.close(); process.exit(0);
})();
