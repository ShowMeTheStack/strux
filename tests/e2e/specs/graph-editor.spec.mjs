// Drawing a graph by hand for the graph topics.
export default (t) => {
  const svgPoint = (p, fx, fy) => p.ev(`(() => { const r = document.getElementById('graphEditor').getBoundingClientRect(); return [r.left + r.width * ${fx}, r.top + r.height * ${fy}]; })()`);
  const vertexAt = (p, v) => p.ev(`(() => { const g = document.querySelector('#graphEditor .gedit-v[data-v="${v}"] circle').getBoundingClientRect(); return [g.left + g.width / 2, g.top + g.height / 2]; })()`);
  const press = async (p, x, y) => { await p.mouse('mouseMoved', x, y); await p.mouse('mousePressed', x, y); await p.mouse('mouseReleased', x, y); await p.sleep(60); };
  t.test('graph topics have a Draw the graph button', async (p) => {
    await p.open('bfs');
    p.assert.ok(await p.exists('#btnEditGraph'));
  }, { fresh: true });
  t.test('non-graph topics do not', async (p) => {
    await p.open('quick-sort');
    p.assert.ok(!(await p.exists('#btnEditGraph')));
  });
  t.test('the editor opens with the current graph', async (p) => {
    await p.open('bfs');
    await p.click('#btnEditGraph');
    p.assert.equal(await p.waitModal(), 'Edit the graph');
    p.assert.equal(await p.count('#graphEditor .gedit-v'), await p.ev('SEE.Strux.app.player.input.n'));
    p.assert.ok((await p.count('#graphEditor .gedit-edge')) >= 5);
  });
  t.test('clicking empty space adds a vertex', async (p) => {
    const before = await p.count('#graphEditor .gedit-v');
    const [x, y] = await svgPoint(p, 0.92, 0.1);
    await press(p, x, y);
    p.assert.equal(await p.count('#graphEditor .gedit-v'), before + 1);
  });
  t.test('clicking two vertices adds an edge', async (p) => {
    const e0 = await p.count('#graphEditor .gedit-edge');
    const n = await p.count('#graphEditor .gedit-v');
    const a = await vertexAt(p, n - 1), b = await vertexAt(p, 0);
    await press(p, ...a);
    p.assert.ok(await p.exists('#graphEditor .gedit-v.sel'));
    await press(p, ...b);
    p.assert.equal(await p.count('#graphEditor .gedit-edge'), e0 + 1);
  });
  t.test('clicking the same two again removes the edge', async (p) => {
    const e0 = await p.count('#graphEditor .gedit-edge');
    const n = await p.count('#graphEditor .gedit-v');
    await press(p, ...(await vertexAt(p, n - 1)));
    await press(p, ...(await vertexAt(p, 0)));
    p.assert.equal(await p.count('#graphEditor .gedit-edge'), e0 - 1);
  });
  t.test('dragging moves a vertex', async (p) => {
    const [x, y] = await vertexAt(p, 0);
    await p.mouse('mouseMoved', x, y);
    await p.mouse('mousePressed', x, y);
    for (let k = 1; k <= 5; k++) await p.mouse('mouseMoved', x + k * 12, y + k * 6);
    await p.mouse('mouseReleased', x + 60, y + 30);
    const [x2] = await vertexAt(p, 0);
    p.assert.ok(Math.abs(x2 - x) > 20);
  });
  t.test('Remove the last vertex drops it and its edges', async (p) => {
    const n = await p.count('#graphEditor .gedit-v');
    await p.click('#geditDropLast');
    p.assert.equal(await p.count('#graphEditor .gedit-v'), n - 1);
  });
  t.test('Use this graph runs the topic on it', async (p) => {
    const [x, y] = await svgPoint(p, 0.08, 0.9);
    await press(p, x, y);
    const n = await p.count('#graphEditor .gedit-v');
    await p.modalButton('Use this graph');
    await p.waitGone('.modal-back');
    p.assert.equal(await p.ev('SEE.Strux.app.player.input.n'), n);
    p.assert.equal(await p.ev("document.getElementById('in-n').value"), String(n));
    p.assert.ok((await p.frames()) > 3);
  });
  t.test('the drawn positions are kept', async (p) => {
    const pos = await p.ev('SEE.Strux.app.player.input.pos');
    p.assert.ok(Array.isArray(pos) && pos.length === (await p.ev('SEE.Strux.app.player.input.n')));
  });
  t.test('No edges clears the edges', async (p) => {
    await p.click('#btnEditGraph');
    await p.waitModal();
    await p.click('#geditClear');
    p.assert.equal(await p.count('#graphEditor .gedit-edge'), 0);
  });
  t.test('Cancel leaves the graph alone', async (p) => {
    const g = await p.ev('SEE.Strux.app.player.input.graph');
    await p.modalButton('Cancel');
    p.assert.equal(await p.ev('SEE.Strux.app.player.input.graph'), g);
  });
  t.test('directed edges can be drawn', async (p) => {
    await p.click('#btnEditGraph');
    await p.waitModal();
    await p.click('#geditClear');
    await p.ev("document.getElementById('geditDirected').click()");
    await press(p, ...(await vertexAt(p, 0)));
    await press(p, ...(await vertexAt(p, 1)));
    p.assert.ok(await p.ev("document.querySelector('#graphEditor .gedit-edge').hasAttribute('marker-end')"));
    await p.modalButton('Use this graph');
    await p.waitGone('.modal-back');
    p.assert.match(await p.ev('SEE.Strux.app.player.input.graph'), /^0>1$/);
  });
  t.test('a weighted topic asks for the weight', async (p) => {
    await p.open('dijkstra');
    await p.click('#btnEditGraph');
    await p.waitModal();
    p.assert.match(await p.modalText(), /weight/i);
    p.assert.ok((await p.count('#graphEditor .gedit-w')) >= 3);
    await p.ev("window.prompt = () => '7'");
    await p.click('#geditClear');
    await press(p, ...(await vertexAt(p, 0)));
    await press(p, ...(await vertexAt(p, 1)));
    p.assert.equal(await p.ev("document.querySelector('#graphEditor .gedit-w').textContent"), '7');
    await p.modalButton('Cancel');
  });
  t.test('a bad weight is refused', async (p) => {
    await p.click('#btnEditGraph');
    await p.waitModal();
    await p.ev("window.prompt = () => 'abc'");
    await p.click('#geditClear');
    await press(p, ...(await vertexAt(p, 0)));
    await press(p, ...(await vertexAt(p, 1)));
    p.assert.match(await p.text('#geditMsg'), /whole number/);
    p.assert.equal(await p.count('#graphEditor .gedit-edge'), 0);
    await p.modalButton('Cancel');
  });
};
