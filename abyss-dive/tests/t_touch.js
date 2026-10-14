// Two-thumb test: hold the joystick with one finger, tap dash with the other.
const { launch, sleep, fileUrl } = require('./cdp.js');
const path = require('path');
(async () => {
  const B = await launch(fileUrl(path.join(__dirname, '..', 'index.html')), { w: 390, h: 844, dpr: 2 });
  const res = [];
  const ok = (n, v) => res.push((v ? 'PASS ' : 'FAIL ') + n);
  try {
    const s = await B.eval(`(()=>{const b=document.getElementById('btnStart').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);
    await B.tap(s.x, s.y); await sleep(600);
    const d = await B.eval(`(()=>{const b=document.getElementById('dash').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);
    await B.eval(`window.__ev=[]; for (const t of ['pointerdown','pointerup','pointercancel','lostpointercapture','gotpointercapture']) { cv.addEventListener(t, e=>__ev.push(t+'#'+e.pointerId)); dashBtn.addEventListener(t, e=>__ev.push('dash:'+t+'#'+e.pointerId)); }`);
    const A = { x: 120, y: 600, id: 1 };
    await B.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [A] });
    for (let i = 1; i <= 8; i++) { await B.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120 + i * 6, y: 600 - i * 6, id: 1 }] }); await sleep(30); }
    const held = { x: 168, y: 552, id: 1 };
    ok('joystick active while held', await B.eval('Input.joy.active'));
    await B.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [held, { x: d.x, y: d.y, id: 2 }] });
    await sleep(80);
    // CDP: a touchMove listing only the remaining finger releases the other one
    await B.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [held] });
    await sleep(150);
    ok('dash fired from second finger', (await B.eval('G.player.dashCd')) > 0);
    ok('joystick still active after dash tap', await B.eval('Input.joy.active'));
    console.log('events', await B.eval('JSON.stringify(__ev)'));
    for (let i = 1; i <= 6; i++) { await B.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 168 + i * 5, y: 552, id: 1 }] }); await sleep(30); }
    const v = await B.eval('JSON.stringify(Input.vec())');
    ok('joystick still steering: ' + v, JSON.parse(v).x > 0.3);
    await B.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(100);
    ok('joystick released', !(await B.eval('Input.joy.active')));
    // level-up lock: a click in the same instant the overlay opens must not pick a card
    const r = await B.eval(`(()=>{ G.pendingLevels=1; update(1/60); const st0=G.state; document.querySelector('#cards .card').click(); return st0+'>'+G.state; })()`);
    ok('instant click ignored (' + r + ')', r === 'levelup>levelup');
    await sleep(700);
    await B.eval(`document.querySelector('#cards .card').click()`); await sleep(100);
    ok('click after lock picks card', (await B.eval('G.state')) === 'play');
  } catch (e) { res.push('ERR ' + e.message); }
  console.log(res.join('\n'));
  console.log('console errors:', B.logs.filter(l => /EXCEPTION|error/i.test(l)).join(' | ') || 'none');
  await B.close(); process.exit(0);
})();
