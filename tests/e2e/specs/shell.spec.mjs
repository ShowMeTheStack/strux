// The frame of the page: home, top bar, catalogue, themes, projector mode, dialogs.
export default (t) => {
  t.test('the page starts and shows the home page', async (p) => {
    p.assert.ok(await p.exists('.home'));
    p.assert.match(await p.text('.home h1'), /data structures/i);
  }, { fresh: true });
  t.test('the title names Strux', async (p) => {
    p.assert.match(await p.ev('document.title'), /Strux/);
  });
  t.test('the home page has a card for every family with topics', async (p) => {
    const fams = await p.ev('SEE.Strux.families.filter(f => SEE.Strux.topics.some(t => t.family === f.id)).length');
    p.assert.equal(await p.count('.fam-card'), fams);
  });
  t.test('the home page lists the groups in teaching order', async (p) => {
    const hs = await p.texts('.home h2');
    const order = await p.ev('SEE.Strux.GROUP_ORDER');
    const idx = hs.map((x) => order.indexOf(x));
    p.assert.ok(idx.every((v, k) => k === 0 || v > idx[k - 1]), hs.join(', '));
  });
  t.test('a family card opens its first topic', async (p) => {
    const fam = await p.attr('.fam-card', 'data-fam');
    await p.click('.fam-card');
    await p.wait('!!SEE.Strux.app.player');
    p.assert.equal(await p.ev('SEE.Strux.app.player.t.family'), fam);
  });
  t.test('the brand link goes home', async (p) => {
    await p.open('quick-sort');
    await p.click('#brand');
    await p.wait("!!document.querySelector('.home')");
  });
  t.test('the top nav has Topics, Courses and Compare', async (p) => {
    p.assert.deepEqual(await p.texts('#topNav button'), ['Topics', 'Courses', 'Compare']);
  });
  t.test('Courses in the top nav opens the course list', async (p) => {
    await p.click('#topNav button', 'Courses');
    await p.wait("!!document.querySelector('.course-card')");
    p.assert.ok(await p.ev("document.querySelector('#topNav button.on').innerText === 'Courses'"));
  });
  t.test('Compare in the top nav opens the chooser', async (p) => {
    await p.click('#topNav button', 'Compare');
    await p.wait("!!document.getElementById('cmpGo')");
  });
  t.test('Topics in the top nav goes home', async (p) => {
    await p.route('courses');
    await p.click('#topNav button', 'Topics');
    await p.wait("!!document.querySelector('.home')");
  });
  t.test('the catalogue lists every topic under its family', async (p) => {
    await p.ev("document.querySelectorAll('#side .cat-fam:not(.open) > button').forEach(b => b.click())");
    await p.sleep(100);
    const side = await p.sideTopics();
    const all = await p.topics();
    p.assert.equal(side.length, all.length);
  });
  t.test('a catalogue family folds open and shut', async (p) => {
    await p.fresh();
    const sel = '#side .cat-fam';
    const was = await p.ev(`document.querySelector('${sel}').classList.contains('open')`);
    await p.click(sel + ' > button');
    p.assert.equal(await p.ev(`document.querySelector('${sel}').classList.contains('open')`), !was);
    await p.click(sel + ' > button');
    p.assert.equal(await p.ev(`document.querySelector('${sel}').classList.contains('open')`), was);
  });
  t.test('the folded state of the catalogue is remembered', async (p) => {
    await p.fresh();
    const fam = await p.attr('#side .cat-fam:not(.open)', 'data-fam');
    await p.click(`#side .cat-fam[data-fam="${fam}"] > button`);
    await p.reload();
    p.assert.ok(await p.ev(`document.querySelector('#side .cat-fam[data-fam="${fam}"]').classList.contains('open')`));
  });
  t.test('searching the catalogue narrows it', async (p) => {
    await p.fresh();
    await p.click('#catSearch');
    await p.type('quick');
    const shown = await p.sideTopics();
    p.assert.ok(shown.length >= 1 && shown.includes('quick-sort'), shown.join(','));
    p.assert.ok(shown.length < (await p.topics()).length);
  });
  t.test('a search with no match leaves the catalogue empty but working', async (p) => {
    await p.fresh();
    await p.click('#catSearch');
    await p.type('zzzzqqq');
    p.assert.equal((await p.sideTopics()).length, 0);
  });
  t.test('a search matches family names too', async (p) => {
    await p.fresh();
    await p.click('#catSearch');
    await p.type('hash');
    const shown = await p.sideTopics();
    p.assert.ok(shown.includes('chain-insert'));
  });
  t.test('clicking a catalogue topic opens it and marks it current', async (p) => {
    await p.fresh();
    await p.ev("document.querySelector('#side .cat-fam > button').click()");
    const id = await p.attr('#side .cat-topic', 'data-topic');
    await p.click(`#side .cat-topic[data-topic="${id}"]`);
    await p.wait(`SEE.Strux.app.player && SEE.Strux.app.player.t.id === '${id}'`);
    p.assert.ok(await p.exists(`#side .cat-topic.on[data-topic="${id}"]`));
  });
  t.test('a topic reached by its address opens directly', async (p) => {
    await p.fresh({ hash: 'topic=bst-insert' });
    await p.wait("SEE.Strux.app.player && SEE.Strux.app.player.t.id === 'bst-insert'");
  });
  t.test('an unknown topic address falls back to home', async (p) => {
    await p.fresh({ hash: 'topic=no-such-topic' });
    p.assert.ok(await p.exists('.home'));
  });
  t.test('the window title names the topic', async (p) => {
    await p.open('bfs');
    p.assert.match(await p.ev('document.title'), /Breadth-first search/);
  });
  t.test('the theme button switches between light and dark', async (p) => {
    await p.fresh();
    const a = await p.theme();
    await p.click('#btnTheme');
    const b = await p.theme();
    p.assert.notEqual(a, b);
    await p.click('#btnTheme');
    p.assert.equal(await p.theme(), a);
  });
  t.test('the chosen theme is remembered', async (p) => {
    await p.fresh();
    await p.click('#btnTheme');
    const b = await p.theme();
    await p.reload();
    p.assert.equal(await p.theme(), b);
  });
  t.test('the body background follows the theme', async (p) => {
    await p.fresh();
    const bg1 = await p.ev('getComputedStyle(document.body).backgroundColor');
    await p.click('#btnTheme');
    const bg2 = await p.ev('getComputedStyle(document.body).backgroundColor');
    p.assert.notEqual(bg1, bg2);
  });
  t.test('projector mode toggles and enlarges the type', async (p) => {
    await p.fresh();
    await p.open('quick-sort');
    const f1 = await p.ev("parseFloat(getComputedStyle(document.getElementById('say')).fontSize)");
    await p.click('#btnProjector');
    p.assert.equal(await p.ev('document.documentElement.dataset.projector'), 'on');
    const f2 = await p.ev("parseFloat(getComputedStyle(document.getElementById('say')).fontSize)");
    p.assert.ok(f2 > f1, f1 + ' -> ' + f2);
    await p.click('#btnProjector');
    p.assert.equal(await p.ev('document.documentElement.dataset.projector'), 'off');
  });
  t.test('projector mode is remembered', async (p) => {
    await p.fresh();
    await p.click('#btnProjector');
    await p.reload();
    p.assert.equal(await p.ev('document.documentElement.dataset.projector'), 'on');
  });
  t.test('the help button opens a menu', async (p) => {
    await p.fresh();
    await p.click('#btnAbout');
    await p.wait("!!document.querySelector('.menu-pop')");
    const items = await p.texts('.menu-pop .menu-item');
    p.assert.ok(items.some((x) => /Keyboard shortcuts/.test(x)));
    p.assert.ok(items.some((x) => /About the author/.test(x)));
    await p.closeMenus();
  });
  t.test('the shortcuts dialog lists the keys', async (p) => {
    await p.click('#btnAbout');
    await p.click('.menu-pop .menu-item', 'Keyboard shortcuts');
    p.assert.equal(await p.waitModal(), 'Keyboard shortcuts');
    p.assert.match(await p.modalText(), /Play or pause/);
    await p.modalButton('OK');
    p.assert.ok(!(await p.modalOpen()));
  });
  t.test('the About dialog names the licence and the version', async (p) => {
    await p.click('#btnAbout');
    await p.click('.menu-pop .menu-item', 'About Strux');
    await p.waitModal();
    const txt = await p.modalText();
    p.assert.match(txt, /GNU General Public License/);
    p.assert.match(txt, /\d+\.\d+\.\d+/);
    await p.closeModals();
  });
  t.test('the About dialog leads to the author', async (p) => {
    await p.click('#btnAbout');
    await p.click('.menu-pop .menu-item', 'About Strux');
    await p.waitModal();
    await p.click('.modal a', 'About the author');
    await p.wait("/Jyotiprakash Mishra/.test((document.querySelector('.modal-back:last-child .modal') || {}).innerText || '')");
    await p.closeModals();
  });
  t.test('the author dialog shows the photo and names See, Baysik and Lohgo', async (p) => {
    await p.click('#btnAbout');
    await p.click('.menu-pop .menu-item', 'About the author');
    await p.waitModal();
    p.assert.ok(await p.exists('.modal img'));
    const txt = await p.modalText();
    for (const w of ['See', 'Baysik', 'Lohgo']) p.assert.ok(txt.includes(w), w);
    await p.closeModals();
  });
  t.test('Escape closes a dialog', async (p) => {
    await p.click('#btnAbout');
    await p.click('.menu-pop .menu-item', 'Keyboard shortcuts');
    await p.waitModal();
    await p.key('Escape');
    await p.waitGone('.modal-back');
  });
  t.test('the settings dialog changes the prediction setting', async (p) => {
    await p.fresh();
    await p.click('#btnAbout');
    await p.click('.menu-pop .menu-item', 'Settings');
    await p.waitModal();
    const before = (await p.settings()).predict;
    await p.ev("document.querySelector('.modal input[type=checkbox]').click()");
    p.assert.equal((await p.settings()).predict, !before);
    await p.closeModals();
  });
  t.test('the settings dialog turns sound on and off', async (p) => {
    await p.fresh();
    p.assert.equal((await p.settings()).sound, false);
    await p.click('#btnAbout');
    await p.click('.menu-pop .menu-item', 'Settings');
    await p.waitModal();
    await p.ev("document.querySelectorAll('.modal input[type=checkbox]')[1].click()");
    p.assert.equal((await p.settings()).sound, true);
    await p.ev("document.querySelectorAll('.modal input[type=checkbox]')[1].click()");
    p.assert.equal((await p.settings()).sound, false);
    await p.closeModals();
  });
  t.test('sound is off by default', async (p) => {
    await p.fresh();
    p.assert.equal((await p.settings()).sound, false);
  });
  t.test('every topic belongs to a known family and group', async (p) => {
    const bad = await p.ev("SEE.Strux.topics.filter(t => !SEE.Strux.familyOf(t) || !SEE.Strux.GROUP_ORDER.includes(SEE.Strux.familyOf(t).group)).map(t => t.id)");
    p.assert.deepEqual(bad, []);
  });
  t.test('topic ids are unique', async (p) => {
    const ids = await p.topics();
    p.assert.equal(new Set(ids).size, ids.length);
  });
  t.test('the page has no horizontal scroll on a laptop', async (p) => {
    await p.fresh();
    p.assert.ok(await p.noHScroll());
  });
  t.test('no page errors on the home page', async (p) => {
    await p.fresh();
    p.assert.deepEqual(p.newExceptions(), []);
  });
};
