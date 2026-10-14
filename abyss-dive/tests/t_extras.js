const { launch, sleep, fileUrl } = require('./cdp.js');
const path = require('path'), fs = require('fs');
const out = f => path.join(__dirname, '..', 'screenshots', f);
(async () => {
  const B = await launch(fileUrl(path.join(__dirname, '..', 'index.html')), { w: 390, h: 844, dpr: 2 });
  try {
    // codex locked state
    await B.eval('document.getElementById("btnCodex").click()'); await sleep(600);
    await B.shot(out('30_codex_locked.png'));
    console.log('codex count', await B.eval('document.getElementById("codexCount").textContent'));
    await B.eval('document.getElementById("btnCodexBack").click()'); await sleep(300);
    console.log('back ->', await B.eval('document.getElementById("scrMenu").hidden ? "hidden" : "menu"'));
    // unlock all and reopen
    await B.eval('CODEX.forEach(e=>Seen.mark(e.id)); document.getElementById("btnCodex").click()'); await sleep(800);
    await B.shot(out('31_codex.png'));
    await B.eval('document.querySelector("#codexGrid .cx:nth-child(9)").scrollIntoView()'); await sleep(300);
    await B.shot(out('32_codex_boss.png'));
    await B.eval('document.querySelector("#codexGrid .cx:nth-child(12)").scrollIntoView()'); await sleep(300);
    await B.shot(out('33_codex_boss2.png'));
    await B.eval('document.getElementById("btnCodexBack").click()'); await sleep(300);
    // onboarding hint
    await B.eval('document.getElementById("btnStart").click()'); await sleep(1500);
    await B.shot(out('34_hint.png'));
    // low hull cracks
    await B.eval('G.player.hp = 18'); await sleep(800);
    await B.shot(out('35_cracks.png'));
    // finale: jump to the final boss and kill it
    const bot = fs.readFileSync(path.join(__dirname, 't_sim.js'), 'utf8').match(/window\.__bot = [\s\S]*?\n    \};/)[0];
    await B.eval(bot + `; Input.vec = () => window.__bot(); const _cu=chooseUpgrade; chooseUpgrade=function(id){ levelOpenAt=-1e9; return _cu(id); };
      (()=>{ const dt=1/60; for(let i=0;i<60*1500;i++){ if(G.state==='levelup') chooseUpgrade(levelOpts[0]); G.player.hp=G.player.maxHp; if(G.boss && G.boss.kind!=='lord'){ G.boss.hp=1; damageBoss(G.boss,5); } update(dt); FX.update(dt); if(G.boss&&G.boss.kind==='lord'&&G.boss.t>3) break; } G.boss.hp=1; damageBoss(G.boss,5); })()`);
    console.log('milestone check nextMile', await B.eval('G.nextMile'));
    await sleep(2500);
    await B.shot(out('36_finale_a.png'));
    await sleep(3500);
    await B.shot(out('37_finale_b.png'));
    for (let i = 0; i < 30 && !(await B.eval('G.endShown')); i++) await sleep(500);
    console.log('state', await B.eval('G.state'), 'end visible', await B.eval('!document.getElementById("scrEnd").hidden'));
    await B.shot(out('38_win.png'));
  } catch (e) { console.log('ERR', e.message); }
  console.log('LOGS:', B.logs.join('\n') || 'none');
  await B.close(); process.exit(0);
})();
