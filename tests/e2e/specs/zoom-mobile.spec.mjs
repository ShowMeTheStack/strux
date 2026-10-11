// Zoom on the stage, and the page on phones and tablets.
export default (t) => {
  const vb = (p) => p.ev("document.querySelector('#stageWrap svg').getAttribute('viewBox').split(' ').map(Number)");
  t.test('zoom in makes the view smaller', async (p) => {
    await p.open('heap-insert');
    const a = await vb(p);
    await p.click('#btnZoomIn');
    const b = await vb(p);
    p.assert.ok(b[2] < a[2] * 0.8, a[2] + ' -> ' + b[2]);
  }, { fresh: true });
  t.test('zoom out and fit are disabled when not zoomed', async (p) => {
    await p.click('#btnZoomFit');
    p.assert.ok(await p.ev("document.getElementById('btnZoomOut').disabled"));
    p.assert.ok(await p.ev("document.getElementById('btnZoomFit').disabled"));
  });
  t.test('zoom out undoes zoom in', async (p) => {
    const a = await vb(p);
    await p.click('#btnZoomIn');
    await p.click('#btnZoomOut');
    const b = await vb(p);
    p.assert.ok(Math.abs(a[2] - b[2]) < 1);
  });
  t.test('zoom stays while stepping', async (p) => {
    await p.click('#btnZoomIn');
    await p.go(3);
    p.assert.ok((await p.ev('SEE.Strux.app.player.stage.zoom')) > 1.3);
    await p.click('#btnZoomFit');
  });
  t.test('dragging pans when zoomed in', async (p) => {
    await p.click('#btnZoomIn');
    await p.click('#btnZoomIn');
    const a = await vb(p);
    const r = await p.rect('#stageWrap svg');
    const x = r.x + r.w / 2, y = r.y + r.h / 2;
    await p.mouse('mouseMoved', x, y);
    await p.mouse('mousePressed', x, y);
    for (let k = 1; k <= 6; k++) await p.mouse('mouseMoved', x + k * 15, y);
    await p.mouse('mouseReleased', x + 90, y);
    const b = await vb(p);
    p.assert.ok(b[0] < a[0] - 5, a[0] + ' -> ' + b[0]);
    await p.click('#btnZoomFit');
  });
  t.test('ctrl and the wheel zoom', async (p) => {
    const r = await p.rect('#stageWrap svg');
    await p.b.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: r.x + 50, y: r.y + 50, deltaX: 0, deltaY: -120, modifiers: 2 });
    await p.sleep(100);
    p.assert.ok((await p.ev('SEE.Strux.app.player.stage.zoom')) > 1);
    await p.click('#btnZoomFit');
  });
  t.test('a new topic starts unzoomed', async (p) => {
    await p.click('#btnZoomIn');
    await p.open('bfs');
    p.assert.equal(await p.ev('SEE.Strux.app.player.stage.zoom || 1'), 1);
  });
  for (const [name, w, h] of [['phone', 390, 844], ['small phone', 360, 640], ['tablet', 820, 1180], ['tablet landscape', 1180, 820]]) {
    t.test(name + ': no sideways scroll on home', async (p) => {
      await p.fresh({ width: w, height: h, mobile: w < 900, touch: w < 900 });
      p.assert.ok(await p.noHScroll());
    });
    t.test(name + ': a topic has no sideways scroll', async (p) => {
      await p.open('quick-sort');
      p.assert.ok(await p.noHScroll());
    });
    t.test(name + ': the stage and controls are visible', async (p) => {
      p.assert.ok((await p.rect('#stageWrap')).w > 200);
      await p.ev("document.getElementById('btnPlay').scrollIntoView()");
      p.assert.ok(await p.visible('#btnPlay'));
    });
    t.test(name + ': stepping works by tap', async (p) => {
      await p.go(0);
      await p.tap('#btnFwd');
      p.assert.equal(await p.at(), 1);
    });
    t.test(name + ': the side tabs are reachable', async (p) => {
      await p.ev("document.getElementById('tab-memory').scrollIntoView()");
      await p.tap('#tab-memory');
      p.assert.equal(await p.tab(), 'memory');
      await p.tap('#tab-code');
    });
  }
  t.test('phone: the menu button opens the catalogue', async (p) => {
    await p.fresh({ width: 390, height: 844, mobile: true, touch: true });
    await p.tap('#btnMenu');
    p.assert.ok(await p.ev("document.getElementById('app').classList.contains('menu-open')"));
    p.assert.ok(await p.visible('#catSearch'));
  });
  t.test('phone: picking a topic closes the catalogue', async (p) => {
    await p.ev("document.querySelector('#side .cat-fam > button').click()");
    await p.tap('#side .cat-topic');
    await p.wait('!!SEE.Strux.app.player');
    p.assert.ok(!(await p.ev("document.getElementById('app').classList.contains('menu-open')")));
  });
  t.test('phone: pinch zooms the stage', async (p) => {
    await p.open('heap-insert');
    const r = await p.rect('#stageWrap svg');
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    await p.b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 20, y: cy, id: 1 }, { x: cx + 20, y: cy, id: 2 }] });
    for (let k = 1; k <= 6; k++) await p.b.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 20 - k * 12, y: cy, id: 1 }, { x: cx + 20 + k * 12, y: cy, id: 2 }] });
    await p.b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.sleep(100);
    p.assert.ok((await p.ev('SEE.Strux.app.player.stage.zoom || 1')) > 1.5);
  });
  t.test('projector mode on a laptop: no sideways scroll', async (p) => {
    await p.fresh({ settings: { projector: true } });
    await p.open('bst-delete');
    p.assert.ok(await p.noHScroll());
  });
  t.test('light theme on a phone: readable text colours', async (p) => {
    await p.fresh({ width: 390, height: 844, mobile: true, touch: true, settings: { theme: 'light' } });
    await p.open('quick-sort');
    p.assert.equal(await p.theme(), 'light');
    p.assert.notEqual(await p.ev("getComputedStyle(document.getElementById('say')).color"), await p.ev('getComputedStyle(document.body).backgroundColor'));
  });
};
