// Two topics side by side.
export default (t) => {
  t.test('the Compare chooser lists the suggested pairs', async (p) => {
    await p.route('compare');
    const n = await p.ev('SEE.Strux.Compare.pairs().length');
    p.assert.ok(n >= 10, 'pairs: ' + n);
    p.assert.equal(await p.count('.fam-card'), n);
  }, { fresh: true });
  t.test('a pair card opens the side-by-side view', async (p) => {
    await p.route('compare');
    await p.click('.fam-card');
    await p.wait("!!document.getElementById('compareView')");
    p.assert.equal(await p.count('.cmp-side'), 2);
  });
  t.test('any two topics can be picked', async (p) => {
    await p.route('compare');
    await p.ev("document.getElementById('cmpA').value = 'bubble-sort'; document.getElementById('cmpB').value = 'selection-sort'");
    await p.click('#cmpGo');
    await p.wait("!!document.getElementById('compareView')");
    p.assert.match(await p.text('.t-head h1'), /Bubble sort vs Selection sort/);
  });
  t.test('shared inputs drive both sides', async (p) => {
    await p.route('compare=bubble-sort,insertion-sort');
    await p.wait("!!document.getElementById('cmp-in-values')");
    await p.ev("document.getElementById('cmp-in-values').value = '4 3 2 1'");
    await p.click('#cmpRun');
    await p.sleep(200);
    const l = await p.ev('SEE.Strux.Compare.current.left.frames.length');
    const r = await p.ev('SEE.Strux.Compare.current.right.frames.length');
    p.assert.ok(l > 3 && r > 3);
    p.assert.match(await p.ev('SEE.Strux.Compare.current.left.frames[0].say'), /./);
  });
  t.test('a bad shared input is refused', async (p) => {
    await p.ev("document.getElementById('cmp-in-values').value = '1 x 2'");
    await p.click('#cmpRun');
    p.assert.ok((await p.text('#compareView .err')).length > 3);
  });
  t.test('Next step moves both sides', async (p) => {
    await p.route('compare=bubble-sort,insertion-sort');
    await p.wait("!!document.getElementById('cmpFwd')");
    await p.click('#cmpFwd');
    await p.click('#cmpFwd');
    p.assert.equal(await p.ev('SEE.Strux.Compare.current.left.i'), 2);
    p.assert.equal(await p.ev('SEE.Strux.Compare.current.right.i'), 2);
  });
  t.test('Step back moves both sides back', async (p) => {
    await p.click('#cmpBack');
    p.assert.equal(await p.ev('SEE.Strux.Compare.current.left.i'), 1);
  });
  t.test('From the start resets both', async (p) => {
    await p.click('#cmpFirst');
    p.assert.equal(await p.ev('SEE.Strux.Compare.current.left.i + SEE.Strux.Compare.current.right.i'), 0);
  });
  t.test('Play runs both until both finish', async (p) => {
    await p.ev('SEE.Strux.app.settings.speed = 5');
    await p.click('#cmpPlay');
    await p.wait('SEE.Strux.Compare.current.left.done && SEE.Strux.Compare.current.right.done', 60000);
    p.assert.match(await p.text('.cmp-side .say'), /Finished/i);
  }, { timeout: 70000 });
  t.test('each side has its own counters', async (p) => {
    p.assert.equal(await p.count('.cmp-side .counters'), 2);
    const a = await p.ev("document.querySelectorAll('.cmp-side .counters')[0].innerText");
    const b = await p.ev("document.querySelectorAll('.cmp-side .counters')[1].innerText");
    p.assert.ok(a.length > 3 && b.length > 3);
  });
  t.test('a side links to its topic', async (p) => {
    await p.click('.cmp-head a');
    await p.wait('!!SEE.Strux.app.player');
  });
  t.test('BFS against DFS on the same graph', async (p) => {
    await p.route('compare=bfs,dfs');
    await p.wait("!!document.getElementById('compareView')");
    p.assert.ok(await p.exists('#cmp-in-graph'));
  });
  t.test('every suggested pair runs on both sides without errors', async (p) => {
    const pairs = await p.ev('SEE.Strux.Compare.pairs().map(([a, b]) => a.id + "," + b.id)');
    for (const pr of pairs) {
      await p.route('compare=' + pr);
      await p.wait("!!document.getElementById('compareView')");
      const ok = await p.ev('SEE.Strux.Compare.current.left.frames.length > 1 && SEE.Strux.Compare.current.right.frames.length > 1');
      p.assert.ok(ok, pr);
    }
    p.assert.deepEqual(p.newExceptions(), []);
  }, { timeout: 120000 });
};
