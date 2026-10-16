// The screenshots in the README: node tools/readme-shots.mjs (builds first; writes docs/images/*.png)
import { launch } from './cdp.mjs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execSync('node build.mjs', { cwd: root, stdio: 'ignore' });
const out = (n) => join(root, 'docs/images', n + '.png');
const only = process.argv[2];

// [file, hash, step: tag pattern | fraction | 'end', extra script, size]
const SHOTS = [
  ['home', '', null],
  ['quick-sort', 'topic=quick-sort', /^swap$/],
  ['sll-reverse', 'topic=sll-reverse', 0.55],
  ['sll-delete-key', 'topic=sll-delete-key', /free/],
  ['sll-floyd-detect', 'topic=sll-floyd-detect', 0.7],
  ['dll-insert-pos', 'topic=dll-insert-pos', 0.75],
  ['csll-traverse', 'topic=csll-traverse', 0.6],
  ['stack-array', 'topic=stack-array', 0.6],
  ['app-infix-postfix', 'topic=app-infix-postfix', 0.55],
  ['binary-search', 'topic=binary-search', 0.6],
  ['merge-sort', 'topic=merge-sort', 0.62],
  ['heap-sort', 'topic=heap-sort', 0.6],
  ['radix-sort', 'topic=radix-sort', 0.4],
  ['chain-search', 'topic=chain-search', 0.6],
  ['oa-delete', 'topic=oa-delete', 0.85],
  ['bt-inorder', 'topic=bt-inorder', 0.55],
  ['bt-morris', 'topic=bt-morris', 0.45],
  ['bst-delete', 'topic=bst-delete?keys=' + encodeURIComponent('[50,30,70,20,40,60,80,65]') + '&key=50', 0.55],
  ['avl-rotate', 'topic=avl-rotate', 0.6],
  ['rb-insert', 'topic=rb-insert', 0.7],
  ['btree-insert', 'topic=btree-insert', 0.6],
  ['heap-insert', 'topic=heap-insert', 0.6],
  ['trie-insert', 'topic=trie-insert', 0.7],
  ['dijkstra', 'topic=dijkstra', 0.55],
  ['kruskal', 'topic=kruskal', 0.7],
  ['floyd-warshall', 'topic=floyd-warshall', 0.5],
  ['scc', 'topic=scc', 0.85],
  ['mat-rowmajor', 'topic=mat-rowmajor', 0.5],
  ['dyn-push', 'topic=dyn-push', 0.55],
  ['memory', 'topic=sll-reverse', 0.5, "SEE.Strux.app.player.showTab('memory')"],
  ['calls', 'topic=merge-sort', 0.45, "SEE.Strux.app.player.showTab('calls')"],
  ['predict', 'topic=bst-insert', 'predict', null],
  ['quiz', 'topic=quick-sort', 0, "document.getElementById('btnQuiz').click(); setTimeout(() => { const q = document.querySelectorAll('.quiz-q'); q[0].querySelectorAll('.quiz-opt')[SEE.Strux.byId('quick-sort').quiz[0].answer].click(); q[1].querySelectorAll('.quiz-opt')[0].click(); }, 100)"],
  ['compare', 'compare=bubble-sort,insertion-sort', null, "for (let k = 0; k < 30; k++) SEE.Strux.Compare.current.step(1)"],
  ['courses', 'courses', null],
  ['course-step', 'course=lists/2', 0.5],
  ['graph-editor', 'topic=bfs', 0, "document.getElementById('btnEditGraph').click()"],
  ['light', 'topic=bst-range', 0.6, "SEE.Strux.app.settings.theme = 'light'; SEE.Strux.app.applyTheme()"],
  ['projector', 'topic=insertion-sort', 0.5, "SEE.Strux.app.settings.projector = true; SEE.Strux.app.applyTheme(); SEE.Strux.app.player.redraw()"],
  ['phone', 'topic=heap-extract', 0.5, null, [390, 844]],
  ['tablet', 'topic=bplus-range', 0.6, null, [820, 1180]],
];

for (const [name, hash, step, extra, size] of SHOTS) {
  if (only && name !== only) continue;
  const [w, h] = size || [1440, 900];
  const b = await launch({ width: w, height: h });
  try {
    await b.send('Page.navigate', { url: b.url + 'index.html' });
    await b.waitFor('window.__struxReady === true', 20000);
    await b.eval(`SEE.Strux.app.settings.predict = ${step === 'predict'}; SEE.Strux.app.settings.theme = 'dark'; SEE.Strux.app.applyTheme(); location.hash = ${JSON.stringify(hash)}`);
    await b.sleep(700);
    if (step !== null && step !== undefined) {
      const expr = step === 'predict'
        ? "(() => { const p = SEE.Strux.app.player; const i = p.frames.findIndex(f => f.predict); p.go(i, true); p.step(1); return i; })()"
        : step instanceof RegExp
          ? `(() => { const p = SEE.Strux.app.player; const re = new RegExp(${JSON.stringify(step.source)}); let i = p.frames.findIndex((f, k) => k > 2 && re.test(f.tag || '')); if (i < 0) i = Math.floor(p.frames.length / 2); p.go(i - 1, true); p.go(i); return i; })()`
          : `(() => { const p = SEE.Strux.app.player; const i = Math.max(0, Math.round((p.frames.length - 1) * ${step})); p.go(Math.max(0, i - 1), true); p.go(i); return i; })()`;
      await b.eval(expr);
    }
    if (extra) await b.eval(extra);
    await b.sleep(1100);
    await b.screenshot(out(name));
    console.log(name);
  } finally { await b.close(); }
}
