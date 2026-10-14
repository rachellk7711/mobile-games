const { launch } = require('./cdp.js');
const path = require('path'), fs = require('fs');
const which = +process.argv[2] || 0;
(async () => {
  const url = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
  const B = await launch(url, { w: 390, h: 844, dpr: 1 });
  const bot = fs.readFileSync(path.join(__dirname, 't_sim.js'), 'utf8').match(/window\.__bot = [\s\S]*?\n    \};/)[0];
  await B.eval(bot + '; Input.vec = () => window.__bot(); const _cu=chooseUpgrade; chooseUpgrade=function(id){ levelOpenAt=-1e9; return _cu(id); };');
  console.log(JSON.stringify(await B.eval(`(()=>{
    startRun(); const dt=1/60;
    for(let k=0;k<=${which};k++){
      while(!G.boss){ if(G.state==='levelup') chooseUpgrade(levelOpts[0]); G.player.hp=G.player.maxHp; update(dt); }
      if(k<${which}){ G.boss.hp=1; damageBoss(G.boss, 5); for(let i=0;i<200;i++) update(dt); }
    }
    let dsum=0,n=0, states={}, src={};
    const b=G.boss; const hp0=b.hp;
    const od=damageBoss; damageBoss=function(bb,dmg,s){ src[s]=(src[s]||0)+dmg; return od(bb,dmg,s); };
    for(let i=0;i<60*30;i++){ if(G.state==='levelup') chooseUpgrade(levelOpts[0]); G.player.hp=G.player.maxHp; update(dt); if(!G.boss)break; dsum+=dist(G.player.x,G.player.y,b.x,b.y); n++; const k=b.atk+(b.dash?'D':''); states[k]=(states[k]||0)+1; }
    for(const k in src) src[k]=Math.round(src[k]);
    return {boss:b.name, hp0:Math.round(hp0), hp:Math.round(b.hp), avgDist:Math.round(dsum/n), states, src, est:Math.round(estimateDps(G.player)), w:JSON.stringify(G.player.weapons), en:G.enemies.length};
  })()`)));
  console.log(B.logs.join('\n'));
  await B.close(); process.exit(0);
})();
