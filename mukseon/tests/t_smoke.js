const { launch, sleep, fileUrl } = require('./cdp.js');
const path = require('path'), fs = require('fs');
const out = f => path.join(__dirname, '..', 'screenshots', f);
fs.mkdirSync(path.join(__dirname, '..', 'screenshots'), { recursive: true });
(async () => {
  const B = await launch(fileUrl(path.join(__dirname, '..', 'index.html')), { w: 390, h: 844, dpr: 2 });
  try {
    await sleep(2500);
    await B.shot(out('01_menu.png'));
    console.log('menu demo y', await B.eval('Math.round(G.player.y)'), 'grabs', await B.eval('G.grabs'));
    await B.eval('document.getElementById("btnStart").click()'); await sleep(700);
    await B.shot(out('02_start.png'));
    // hold for a while, then release, a few times
    for (let i = 0; i < 4; i++) {
      await B.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 500 }] });
      await sleep(450);
      await B.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(350);
      console.log('after cycle', i, await B.eval('JSON.stringify({y:Math.round(G.player.y), h:Math.round(G.maxH), grabs:G.grabs, state:G.state, ink:Math.round(G.inkY)})'));
    }
    await B.shot(out('03_play.png'));
  } catch (e) { console.log('ERR', e.message); }
  console.log('LOGS:', B.logs.join('\n') || 'none');
  await B.close(); process.exit(0);
})();
