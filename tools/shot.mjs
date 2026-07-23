// Screenshots of a topic for review: node tools/shot.mjs <topic> <out dir> [steps, e.g. 0,5,12,end] [width] [height] [input as JSON, e.g. '{"values":[3,1,2]}']
// Uses /dev.html, so nothing needs building first. Prints the narration of each step it shot.
import { launch } from './cdp.mjs';
import { mkdirSync } from 'node:fs';
const [topic, out, stepsArg, w, h, k] = process.argv.slice(2);
if (!topic || !out) { console.log('usage: node tools/shot.mjs <topic> <out dir> [0,5,end] [width] [height] [input json]'); process.exit(1); }
mkdirSync(out, { recursive: true });
const b = await launch({ width: +(w || 1440), height: +(h || 900) });
try {
  await b.send('Page.navigate', { url: b.url + 'dev.html#topic=' + topic + (k ? '?' + Object.entries(JSON.parse(k)).map(([a, v]) => a + '=' + encodeURIComponent(JSON.stringify(v))).join('&') : '') });
  await b.waitFor('window.__struxReady === true', 20000);
  await b.sleep(300);
  const n = await b.eval('SEE.Strux.app.settings.predict = false; SEE.Strux.app.player.frames.length');
  const steps = (stepsArg || '0,mid,end').split(',').map((s) => (s === 'end' ? n - 1 : s === 'mid' ? Math.floor(n / 2) : Math.min(n - 1, +s)));
  for (const st of steps) {
    await b.eval(`SEE.Strux.app.player.go(${st}, true)`);
    await b.sleep(450);
    const file = out.replace(/\/$/, '') + '/' + topic + '-' + st + '.png';
    await b.screenshot(file);
    console.log(file + '\n   ' + (await b.eval("document.getElementById('say').innerText")));
  }
  console.log('frames: ' + n);
  const errs = b.logs.filter((l) => /error/i.test(JSON.stringify(l)));
  if (errs.length) console.log('page errors: ' + JSON.stringify(errs.slice(0, 5)));
} finally { await b.close(); }
