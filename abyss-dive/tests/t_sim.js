// Fast-forward simulation inside the real page: a kiting bot plays full runs.
// usage: node t_sim.js [runs] [god(0/1)] [maxSeconds]
const { launch } = require('./cdp.js');
const path = require('path');
const runs = +process.argv[2] || 3, god = process.argv[3] === '1', maxS = +process.argv[4] || 1500;
(async () => {
  const url = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
  const B = await launch(url, { w: 390, h: 844, dpr: 1 });
  await B.eval(`
    window.__bot = function(){
      const p=G.player; let x=0,y=0, danger=0;
      for(const e of G.enemies){ const dx=p.x-e.x, dy=p.y-e.y, d=Math.hypot(dx,dy)||1; if(d<260){ const w=(e.r+30)/(d*d); x+=dx/d*w*60; y+=dy/d*w*60; if(d<e.r+p.r+28) danger++; } }
      for(const s of G.eshots){ const dx=p.x-s.x, dy=p.y-s.y, d=Math.hypot(dx,dy)||1; if(d<140){ const w=1/(d*d); x+=dx/d*w*900; y+=dy/d*w*900; if(d<30) danger++; } }
      if(G.boss&&!G.boss.dead){ const b=G.boss; const dx=p.x-b.x, dy=p.y-b.y, d=Math.hypot(dx,dy)||1; if(d<320){x+=dx/d*2.5;y+=dy/d*2.5;} if(d<b.r+40) danger+=2; }
      for(const w of G.warns){ if(w.k==='line' && lineHitsPlayer(w.x,w.y,w.a,w.len,w.w+30)){ const nx=-Math.sin(w.a), ny=Math.cos(w.a); const side=((p.x-w.x)*nx+(p.y-w.y)*ny)>=0?1:-1; x+=nx*side*4; y+=ny*side*4; if(w.t>w.max-0.25) danger+=2; } else if(w.k==='circle'){ const dx=p.x-w.x, dy=p.y-w.y, d=Math.hypot(dx,dy)||1; if(d<w.r+30){x+=dx/d*4;y+=dy/d*4;} } }
      for(const b of G.beams){ if(lineHitsPlayer(b.x,b.y,b.a,b.len,b.w+50)){ const nx=-Math.sin(b.a+b.va*0.3), ny=Math.cos(b.a+b.va*0.3); const side=b.va>0?-1:1; x+=nx*side*5; y+=ny*side*5; danger+=1; } }
      // gentle orb seeking when calm
      if(Math.hypot(x,y)<0.4){ let bo=null,bd=1e9; for(const o of G.orbs){const d=dist2(o.x,o.y,p.x,p.y); if(d<bd){bd=d;bo=o;}} if(bo&&bd<300*300){const a=angTo(p.x,p.y,bo.x,bo.y); x+=Math.cos(a)*0.6; y+=Math.sin(a)*0.6;} else { x+=Math.cos(G.t*0.3)*0.3; y+=Math.sin(G.t*0.3)*0.3; } }
      const l=Math.hypot(x,y); if(l>1){x/=l;y/=l;}
      if(danger && p.dashCd<=0) Input.dashPressed=true;
      return {x,y};
    };
    Input.vec = () => window.__bot(); const _cu=chooseUpgrade; chooseUpgrade=function(id){ levelOpenAt=-1e9; return _cu(id); };
    window.__run = function(god, maxS){
      startRun();
      const dt=1/60; let steps=0; const log=[]; let lastZone=-1, bossLog=[], picks={};
      const t0=performance.now();
      while(steps < maxS*60){
        if(G.state==='levelup'){ const id=levelOpts[Math.floor(Math.random()*levelOpts.length)]; picks[id]=(picks[id]||0)+1; chooseUpgrade(id); }
        if(G.state!=='play') break;
        if(god){ G.player.hp=G.player.maxHp; }
        const hadBoss=!!G.boss;
        update(dt); FX.update(dt); steps++;
        if(G.zone.id!==lastZone){ lastZone=G.zone.id; log.push('z'+lastZone+'@'+Math.round(G.t)+'s'); }
        if(!hadBoss && G.boss){ G.boss._spawnT=G.t; bossLog.push(G.boss.name+' spawn t='+Math.round(G.t)+' hp='+Math.round(G.boss.maxHp)+' lvl='+G.level); }
        if(hadBoss && !G.boss){ bossLog.push('killed t='+Math.round(G.t)); }
        for(const e of G.enemies){ if(!isFinite(e.x)||!isFinite(e.y)||!isFinite(e.hp)) return {error:'NaN enemy '+e.type}; }
        if(!isFinite(G.player.x)) return {error:'NaN player'};
      }
      // flush timers e.g. win
      for(let i=0;i<200 && G.state==='play';i++){ update(dt); }
      return { state:G.state, t:Math.round(G.t), depth:Math.round(G.depth), lvl:G.level, kills:G.stats.kills, taken:G.stats.damageTaken, zones:log.join(' '), boss:bossLog.join(' | '),
        weapons:Object.entries(G.player.weapons).map(([k,v])=>k+v.lvl).join(','), ms:Math.round(performance.now()-t0), enemies:G.enemies.length, maxHp:G.player.maxHp };
    };
  `);
  for (let i = 0; i < runs; i++) {
    try { console.log(JSON.stringify(await B.eval(`__run(${god}, ${maxS})`))); }
    catch (e) { console.log('ERR', e.message.slice(0, 800)); }
  }
  const errs = B.logs.filter(l => /EXCEPTION|error/i.test(l));
  console.log('errors:', errs.length ? errs.slice(0, 10).join('\n') : 'none');
  await B.close(); process.exit(0);
})();
