// Visual tour: fast-forward with a god-mode bot, then screenshot key moments in real time.
const { launch, sleep } = require('./cdp.js');
const path = require('path'), fs = require('fs');
const out = f => path.join(__dirname, '..', 'screenshots', f);
(async () => {
  const url = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
  const B = await launch(url, { w: 390, h: 844, dpr: 2 });
  const bot = fs.readFileSync(path.join(__dirname, 't_sim.js'), 'utf8').match(/window\.__bot = [\s\S]*?\n    \};/)[0];
  await B.eval(bot + `; Input.vec = () => window.__bot(); const _cu=chooseUpgrade; chooseUpgrade=function(id){ levelOpenAt=-1e9; return _cu(id); }; window.__god=true;
    const _hp = hurtPlayer; hurtPlayer = function(d,x,y){ _hp(d,x,y); if(window.__god && G.player.hp<20) G.player.hp=G.player.maxHp; };
    window.__ff = function(cond, maxSteps=60*900){ const dt=1/60; for(let i=0;i<maxSteps;i++){ if(G.state==='levelup') chooseUpgrade(levelOpts[Math.floor(Math.random()*levelOpts.length)]); if(G.state!=='play') return 'state '+G.state; update(dt); FX.update(dt); if(cond()) return 'ok t='+Math.round(G.t)+' d='+Math.round(G.depth); } return 'timeout'; };
    startRun();`);
  const step = async (name, cond, wait = 1800) => {
    console.log(name, await B.eval(`__ff(()=>${cond})`));
    await sleep(wait);
    // auto-dismiss level up for the screenshot unless that's the point
    if (name !== 'levelup') await B.eval(`(()=>{ let n=0; while(G.state==='levelup'&&n++<10) chooseUpgrade(levelOpts[0]); })()`);
    await sleep(300);
    await B.shot(out(name + '.png'));
  };
  try {
    await step('10_z0_fight', 'G.t>20', 2500);
    await step('levelup', "G.state==='levelup'", 400);
    await B.eval(`(()=>{ let n=0; while(G.state==='levelup'&&n++<10) chooseUpgrade(levelOpts[0]); })()`);
    await step('11_z1', 'G.depth>650');
    await step('12_boss_squid', 'G.boss && G.boss.t>4', 2200);
    await step('13_z2', 'G.depth>2300', 2200);
    await step('14_boss_angler', "G.boss && G.boss.kind==='angler' && G.boss.t>5", 2200);
    await step('15_z3', 'G.depth>5000 && !G.boss', 2200);
    await step('16_boss_siph', "G.boss && G.boss.kind==='siph' && G.boss.t>6", 2200);
    await step('17_z4', 'G.depth>8000', 2200);
    await step('18_boss_lord', "G.boss && G.boss.kind==='lord' && G.boss.t>6", 2600);
    await step('19_lord_p3', "G.boss && G.boss.kind==='lord' && G.boss.phase>=3 && G.boss.t>0", 2600);
    await B.eval('window.__god=false; G.player.hp=1; G.player.inv=0; hurtPlayer(99,G.player.x+10,G.player.y)');
    await sleep(2600);
    await B.shot(out('20_end.png'));
    await B.eval(`document.getElementById('btnMenu').click()`);
    await sleep(1500);
    await B.shot(out('21_menu_again.png'));
    console.log('final', await B.eval('G.state'));
  } catch (e) { console.log('ERR', e.message); }
  console.log('LOGS:', B.logs.join('\n') || 'none');
  await B.close(); process.exit(0);
})();
