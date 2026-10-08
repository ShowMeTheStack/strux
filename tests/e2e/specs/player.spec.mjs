// The topic player: stepping, playing, the timeline, keys, inputs and presets, the side tabs, counters.
export default (t) => {
  t.test('a topic opens at its first step', async (p) => {
    await p.open('quick-sort');
    p.assert.equal(await p.at(), 0);
    p.assert.match(await p.say(), /^Start/i);
  }, { fresh: true });
  t.test('the heading shows group, family, title and blurb', async (p) => {
    p.assert.match(await p.text('.crumbs'), /Sorting/);
    p.assert.equal(await p.text('.t-head h1'), 'Quick sort');
    p.assert.ok((await p.text('.t-head p')).length > 20);
  });
  t.test('Next step moves one step on', async (p) => {
    await p.go(0);
    await p.click('#btnFwd');
    p.assert.equal(await p.at(), 1);
  });
  t.test('Step back moves one step back', async (p) => {
    await p.go(5);
    await p.click('#btnBack');
    p.assert.equal(await p.at(), 4);
  });
  t.test('Step back is disabled on the first step', async (p) => {
    await p.go(0);
    p.assert.ok(await p.ev("document.getElementById('btnBack').disabled"));
  });
  t.test('Next step is disabled on the last step', async (p) => {
    await p.toEnd();
    p.assert.ok(await p.ev("document.getElementById('btnFwd').disabled"));
    p.assert.match(await p.say(), /^Finished/i);
  });
  t.test('From the start goes back to step one', async (p) => {
    await p.go(9);
    await p.click('#btnFirst');
    p.assert.equal(await p.at(), 0);
  });
  t.test('the position shows step of steps', async (p) => {
    await p.go(3);
    p.assert.equal(await p.text('#pos'), '4 / ' + (await p.frames()));
  });
  t.test('Play runs on by itself and Pause stops it', async (p) => {
    await p.go(0);
    await p.ev('SEE.Strux.app.settings.speed = 5');
    await p.click('#btnPlay');
    p.assert.ok(await p.playing());
    await p.wait('SEE.Strux.app.player.i >= 3', 6000);
    await p.click('#btnPlay');
    p.assert.ok(!(await p.playing()));
    const i = await p.at();
    await p.sleep(600);
    p.assert.equal(await p.at(), i);
  });
  t.test('Play stops by itself at the end', async (p) => {
    await p.go((await p.frames()) - 3);
    await p.ev('SEE.Strux.app.settings.speed = 5');
    await p.click('#btnPlay');
    await p.wait('!SEE.Strux.app.player.playing', 6000);
    p.assert.equal(await p.at(), (await p.frames()) - 1);
  });
  t.test('Play at the end starts again from the beginning', async (p) => {
    await p.toEnd();
    await p.ev('SEE.Strux.app.settings.speed = 5');
    await p.click('#btnPlay');
    await p.sleep(100);
    p.assert.ok((await p.at()) < 3);
    await p.click('#btnPlay');
  });
  t.test('the play button label follows the state', async (p) => {
    await p.go(0);
    p.assert.equal(await p.attr('#btnPlay', 'aria-label'), 'Play');
    await p.click('#btnPlay');
    p.assert.equal(await p.attr('#btnPlay', 'aria-label'), 'Pause');
    await p.click('#btnPlay');
    p.assert.equal(await p.attr('#btnPlay', 'aria-label'), 'Play');
  });
  t.test('the timeline jumps to a step', async (p) => {
    await p.ev("(() => { const r = document.getElementById('timeline'); r.value = '7'; r.dispatchEvent(new Event('input')); })()");
    p.assert.equal(await p.at(), 7);
  });
  t.test('the timeline follows stepping', async (p) => {
    await p.go(4);
    await p.click('#btnFwd');
    p.assert.equal(await p.ev("document.getElementById('timeline').value"), '5');
  });
  t.test('the timeline has marks for predictions', async (p) => {
    const n = await p.ev('SEE.Strux.app.player.frames.filter(f => f.predict).length');
    p.assert.equal(await p.count('.marks i.q'), n);
    p.assert.ok(n >= 1);
  });
  t.test('the speed slider is remembered', async (p) => {
    await p.ev("(() => { const r = document.getElementById('speed'); r.value = '1'; r.dispatchEvent(new Event('input')); })()");
    p.assert.equal((await p.settings()).speed, 1);
    await p.reload();
    p.assert.equal((await p.settings()).speed, 1);
  });
  t.test('the right arrow key steps on', async (p) => {
    await p.open('quick-sort');
    await p.go(2);
    await p.ev('document.activeElement && document.activeElement.blur()');
    await p.key('ArrowRight');
    p.assert.equal(await p.at(), 3);
  });
  t.test('the left arrow key steps back', async (p) => {
    await p.go(2);
    await p.ev('document.activeElement && document.activeElement.blur()');
    await p.key('ArrowLeft');
    p.assert.equal(await p.at(), 1);
  });
  t.test('End and Home jump to the ends', async (p) => {
    await p.ev('document.activeElement && document.activeElement.blur()');
    await p.key('End');
    p.assert.equal(await p.at(), (await p.frames()) - 1);
    await p.key('Home');
    p.assert.equal(await p.at(), 0);
  });
  t.test('Space plays and pauses', async (p) => {
    await p.ev('document.activeElement && document.activeElement.blur()');
    await p.key(' ');
    p.assert.ok(await p.playing());
    await p.key(' ');
    p.assert.ok(!(await p.playing()));
  });
  t.test('keys typed in an input box do not step', async (p) => {
    await p.go(2);
    await p.click('#in-values');
    await p.key('ArrowRight');
    p.assert.equal(await p.at(), 2);
  });
  t.test('every step has narration text', async (p) => {
    const n = await p.frames();
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 12))) {
      await p.go(i);
      p.assert.ok((await p.say()).length > 10, 'step ' + i);
    }
  });
  t.test('the stage draws items with keys', async (p) => {
    await p.go(3);
    p.assert.ok((await p.stageKeys()).length > 3);
  });
  t.test('stepping back gives the same picture as before', async (p) => {
    await p.go(10);
    const a = (await p.stageKeys()).sort();
    await p.go(11);
    await p.go(10);
    await p.sleep(300);
    p.assert.deepEqual((await p.stageKeys()).sort(), a);
  });
  t.test('the code tab shows the program with the current line lit', async (p) => {
    await p.showTab('code');
    await p.go(4);
    const f = await p.frame();
    p.assert.equal(await p.curLine(), f.line);
  });
  t.test('lines outside the topic are dimmed', async (p) => {
    p.assert.ok((await p.count('#code .ln.dimmed')) > 3);
    p.assert.ok((await p.count('#code .ln:not(.dimmed)')) > 5);
  });
  t.test('clicking a code line jumps to the next time it runs', async (p) => {
    await p.go(0);
    const line = await p.ev("+document.querySelector('#code .ln.click:not(.dimmed)').dataset.line");
    await p.click(`#code .ln[data-line="${line}"]`);
    const f = await p.frame();
    p.assert.equal(f.line, line);
  });
  t.test('the code shown has no annotation comments', async (p) => {
    p.assert.ok(!/\/\*@/.test(await p.text('#code')));
  });
  t.test('the Memory tab shows stack frames and the heap', async (p) => {
    await p.open('sll-reverse');
    await p.go(8);
    await p.showTab('memory');
    const txt = await p.tabText();
    p.assert.match(txt, /Stack/i);
    p.assert.match(txt, /Heap/i);
    p.assert.match(txt, /reverse\(\)/);
    p.assert.match(txt, /main\(\)/);
  });
  t.test('the Memory tab shows heap blocks as structs', async (p) => {
    p.assert.ok((await p.count('.mem-block')) >= 3);
    p.assert.match(await p.text('.mem-block'), /struct node/);
  });
  t.test('the Memory tab follows the step', async (p) => {
    await p.go(2);
    const a = await p.tabText();
    await p.go(12);
    const b = await p.tabText();
    p.assert.notEqual(a, b);
  });
  t.test('the Memory tab lights what changed', async (p) => {
    let found = false;
    for (let i = 3; i < 15 && !found; i++) { await p.go(i); found = (await p.count('.mem-row.chg, .mem-block.chg')) > 0; }
    p.assert.ok(found);
  });
  t.test('hovering a pointer lights its heap block', async (p) => {
    await p.go(8);
    await p.hover('.mem-ptr');
    p.assert.ok(await p.exists('.mem-block.lit'));
  });
  t.test('the Calls tab shows the stack of calls', async (p) => {
    await p.open('quick-sort');
    await p.go(40);
    await p.showTab('calls');
    const txt = await p.tabText();
    p.assert.match(txt, /quicksort\(/);
    p.assert.match(txt, /main\(\)/);
  });
  t.test('the Calls tab draws the recursion tree', async (p) => {
    await p.go(80);
    p.assert.ok(await p.exists('.rtree'));
    p.assert.ok((await p.count('.rtree .rt-node')) >= 3);
    p.assert.ok(await p.exists('.rtree .rt-node.top'));
  });
  t.test('finished calls in the tree show what they returned', async (p) => {
    await p.go(100);
    p.assert.ok(await p.exists('.rtree .rt-node.done'));
    p.assert.match(await p.text('.rtree-wrap'), /returned/);
  });
  t.test('the chosen tab is remembered', async (p) => {
    await p.showTab('memory');
    await p.open('bst-insert');
    p.assert.equal(await p.tab(), 'memory');
    await p.showTab('code');
  });
  t.test('the Output tab shows what the program printed', async (p) => {
    await p.open('bfs');
    await p.showTab('output');
    p.assert.match(await p.tabText(), /visit 0/);
    await p.showTab('code');
  });
  t.test('a program that prints nothing says so', async (p) => {
    await p.open('sll-reverse');
    await p.showTab('output');
    p.assert.match(await p.tabText(), /prints nothing/);
    await p.showTab('code');
  });
  t.test('the counters count as the steps go', async (p) => {
    await p.open('quick-sort');
    await p.go(0);
    const a = await p.counters();
    await p.toEnd();
    const b = await p.counters();
    p.assert.notDeepEqual(a, b);
    p.assert.match(b[0], /^[1-9]\d* comparisons/);
  });
  t.test('a counter that changed is lit', async (p) => {
    let found = false;
    for (let i = 1; i < 30 && !found; i++) { await p.go(i); found = (await p.count('#counters .counter.bump')) > 0; }
    p.assert.ok(found);
  });
  t.test('changing the input and pressing Run plays the new data', async (p) => {
    await p.open('quick-sort');
    await p.setInput('values', '5 4 3 2 1');
    await p.runInput();
    p.assert.deepEqual(await p.ev('SEE.Strux.app.player.input.values'), [5, 4, 3, 2, 1]);
    p.assert.equal(await p.at(), 0);
    p.assert.match(await p.text('#code'), /5, 4, 3, 2, 1/);
  });
  t.test('Enter in an input box runs it', async (p) => {
    await p.setInput('values', '9 8 7');
    await p.click('#in-values');
    await p.key('Enter');
    await p.sleep(150);
    p.assert.deepEqual(await p.ev('SEE.Strux.app.player.input.values'), [9, 8, 7]);
  });
  t.test('the last input is remembered for the topic', async (p) => {
    await p.reload();
    await p.open('quick-sort');
    p.assert.deepEqual(await p.ev('SEE.Strux.app.player.input.values'), [9, 8, 7]);
  });
  t.test('a wrong input is refused with a message', async (p) => {
    await p.setInput('values', '1 two 3');
    await p.runInput();
    p.assert.ok((await p.inputError()).length > 5);
    p.assert.deepEqual(await p.ev('SEE.Strux.app.player.input.values'), [9, 8, 7]);
  });
  t.test('too many values are refused', async (p) => {
    await p.setInput('values', Array.from({ length: 30 }, (_, i) => i + 1).join(' '));
    await p.runInput();
    p.assert.match(await p.inputError(), /at most/);
  });
  t.test('values too large are refused', async (p) => {
    await p.setInput('values', '1 5000 3');
    await p.runInput();
    p.assert.ok((await p.inputError()).length > 5);
  });
  t.test('a good input clears the message', async (p) => {
    await p.setInput('values', '3 1 2');
    await p.runInput();
    p.assert.equal(await p.inputError(), '');
  });
  t.test('a preset sets the input and runs it', async (p) => {
    const presets = await p.texts('.presets .chip');
    p.assert.ok(presets.length >= 3);
    await p.click('.presets .chip', 'Reverse sorted');
    const v = await p.ev('SEE.Strux.app.player.input.values');
    p.assert.ok(v.every((x, k) => k === 0 || v[k - 1] >= x));
    p.assert.equal(await p.ev("document.getElementById('in-values').value"), v.join(' '));
  });
  t.test('an input in the address is used', async (p) => {
    await p.route('topic=quick-sort?values=' + encodeURIComponent('[4,2,6]'));
    await p.wait("SEE.Strux.app.player && SEE.Strux.app.player.input.values.join() === '4,2,6'");
  });
  t.test('the bigger stage button enlarges the stage', async (p) => {
    await p.open('quick-sort');
    const h1 = (await p.rect('#stageWrap')).h;
    await p.click('#btnBig');
    const h2 = (await p.rect('#stageWrap')).h;
    p.assert.ok(h2 > h1, h1 + ' -> ' + h2);
    await p.click('#btnBig');
  });
  t.test('reaching the end marks the topic done in the catalogue', async (p) => {
    await p.fresh();
    await p.open('bst-insert');
    await p.toEnd();
    await p.sleep(100);
    p.assert.ok(await p.exists('#side .cat-topic[data-topic="bst-insert"] .done'));
  });
  t.test('done marks are remembered', async (p) => {
    await p.reload();
    await p.open('bst-insert');
    p.assert.ok(await p.exists('#side .cat-topic[data-topic="bst-insert"] .done'));
  });
  t.test('Open in See opens See with the program', async (p) => {
    await p.open('sll-reverse');
    await p.ev("window.__opened = null; window.open = (u) => { window.__opened = u; return null; }");
    await p.click('#btnSee');
    await p.wait('!!window.__opened');
    p.assert.match(await p.ev('window.__opened'), /^https:\/\/see\.jyotiprakash\.org\/#share=SEE1/);
  });
  t.test('the program sent to See unpacks to the same code', async (p) => {
    const code = await p.ev("SEE.Share.unpack(window.__opened.split('#share=')[1]).then(r => SEE.unutf8(r.files['main.c']))");
    p.assert.equal(code, await p.ev('SEE.Strux.app.player.code'));
  });
  t.test('a topic with a compareWith has a Compare button', async (p) => {
    await p.open('bfs');
    p.assert.ok(await p.exists('#btnCompare'));
    await p.click('#btnCompare');
    await p.wait("!!document.getElementById('compareView')");
  });
  t.test('no page errors while stepping through a topic', async (p) => {
    await p.open('bst-insert');
    const n = await p.frames();
    for (let i = 0; i < n; i++) await p.go(i);
    p.assert.deepEqual(p.newExceptions(), []);
  });
};
