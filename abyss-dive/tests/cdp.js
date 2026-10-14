// Minimal headless-Chrome driver over CDP (no deps). Usage: const B = await launch(url, {w,h,dpr})
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch(url, opt = {}) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files', ...(opt.gpu ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']), 'about:blank'], { stdio: 'ignore' });
  let ver;
  for (let i = 0; i < 60; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (ver.length) break; } catch (e) {} await sleep(250); }
  const page = ver.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const logs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    else if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    else if (m.method === 'Log.entryAdded') logs.push('log-' + m.params.entry.level + ': ' + m.params.entry.text);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  const w = opt.w || 390, h = opt.h || 844;
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: opt.dpr || 2, mobile: opt.mobile !== false });
  if (opt.mobile !== false) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url });
  await sleep(opt.wait || 1500);
  for (let i = 0; i < 40; i++) {
    const r = await send('Runtime.evaluate', { expression: "document.readyState==='complete' && typeof G!=='undefined' && !!G", returnByValue: true }).catch(() => null);
    if (r && r.result && r.result.value) break;
    await sleep(250);
  }
  const B = {
    send, logs, proc,
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async shot(file) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    },
    async tap(x, y) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await sleep(50);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
    async drag(x0, y0, x1, y1, ms = 600, hold = 0) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
      const n = 12;
      for (let i = 1; i <= n; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }] }); await sleep(ms / n); }
      if (hold) await sleep(hold);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
    async close() { try { await send('Browser.close'); } catch (e) {} try { proc.kill(); } catch (e) {} },
  };
  return B;
}
const fileUrl = p => 'file:///' + p.replace(/\\/g, '/');
module.exports = { launch, sleep, fileUrl };
