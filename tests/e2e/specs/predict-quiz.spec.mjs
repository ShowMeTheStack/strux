// Predictions (stop and guess before the step happens) and the quiz.
const on = { settings: { predict: true } };
export default (t) => {
  const toPredict = async (p, kind) => {
    // a fresh run forgets the answers given so far
    await p.ev('SEE.Strux.app.player.run()');
    const i = await p.ev(`SEE.Strux.app.player.frames.findIndex(f => f.predict && (${JSON.stringify(kind || '')} === '' || f.predict.pick === ${JSON.stringify(kind || '')}))`);
    await p.go(i);
    await p.click('#btnFwd');
    await p.wait("!!document.getElementById('predict')");
    return i;
  };
  t.test('playing stops at a prediction and asks', async (p) => {
    await p.open('bst-insert');
    await p.ev('SEE.Strux.app.settings.speed = 5');
    await p.click('#btnPlay');
    await p.wait("!!document.getElementById('predict')", 15000);
    p.assert.ok(!(await p.playing()));
    p.assert.ok((await p.text('#predict p')).length > 5);
  }, { fresh: on });
  t.test('Next step also stops at a prediction', async (p) => {
    const i = await toPredict(p);
    p.assert.equal(await p.at(), i);
  });
  t.test('an option prediction offers its choices', async (p) => {
    await toPredict(p);
    const opts = await p.texts('#predict .opts .chip');
    p.assert.deepEqual(opts, ['Left', 'Right']);
  });
  t.test('a right answer says so and explains', async (p) => {
    const i = await toPredict(p);
    const ans = await p.ev(`SEE.Strux.app.player.frames[${i}].predict.answer`);
    await p.click('#predict .opts .chip', ans);
    p.assert.match(await p.text('#predict .res'), /Right/);
    p.assert.ok(await p.exists('#predictGo'));
  });
  t.test('See it happen moves on', async (p) => {
    const i = await toPredict(p);
    await p.click('#predictSkip');
    await p.click('#predictGo');
    p.assert.equal(await p.at(), i + 1);
    p.assert.ok(!(await p.exists('#predict')));
  });
  t.test('a wrong answer says Not quite', async (p) => {
    await p.open('bst-insert');
    const i = await toPredict(p);
    const ans = await p.ev(`SEE.Strux.app.player.frames[${i}].predict.answer`);
    await p.click('#predict .opts .chip', ans === 'Left' ? 'Right' : 'Left');
    p.assert.match(await p.text('#predict .res'), /Not quite/);
  });
  t.test('Show me reveals without judging', async (p) => {
    await toPredict(p);
    await p.click('#predictSkip');
    p.assert.equal(await p.text('#predict .res'), '');
    p.assert.ok(await p.exists('#predictGo'));
  });
  t.test('an answered prediction does not ask again', async (p) => {
    const i = await toPredict(p);
    await p.click('#predictSkip');
    await p.click('#predictGo');
    await p.go(i);
    await p.click('#btnFwd');
    p.assert.equal(await p.at(), i + 1);
  });
  t.test('a pick prediction asks to click the picture', async (p) => {
    await p.open('bfs');
    await toPredict(p, 'node');
    p.assert.match(await p.text('#predict'), /Click it on the picture/);
    p.assert.ok(await p.exists('#stageWrap.picking'));
  });
  t.test('clicking the right item answers a pick prediction', async (p) => {
    const i = await p.ev("SEE.Strux.app.player.frames.findIndex(f => f.predict && f.predict.pick === 'node')");
    const key = await p.ev(`SEE.Strux.app.player.frames[${i}].predict.answer`);
    await p.click(`#stageWrap [data-key="${key}"]`);
    p.assert.match(await p.text('#predict .res'), /Right/);
    p.assert.ok(!(await p.exists('#stageWrap.picking')));
  });
  t.test('clicking a wrong item answers Not quite', async (p) => {
    await p.open('bfs');
    await p.fresh(on);
    await p.open('bfs');
    const i = await toPredict(p, 'node');
    const key = await p.ev(`SEE.Strux.app.player.frames[${i}].predict.answer`);
    const other = await p.ev(`[...document.querySelectorAll('#stageWrap [data-key^="gv"]')].map(e => e.dataset.key).find(k => k !== ${JSON.stringify(key)})`);
    await p.click(`#stageWrap [data-key="${other}"]`);
    p.assert.match(await p.text('#predict .res'), /Not quite/);
  });
  t.test('with predictions off, play runs straight through', async (p) => {
    await p.fresh();
    await p.open('bst-insert');
    await p.ev('SEE.Strux.app.settings.speed = 5');
    await p.click('#btnPlay');
    await p.wait('!SEE.Strux.app.player.playing', 15000);
    p.assert.equal(await p.at(), (await p.frames()) - 1);
    p.assert.ok(!(await p.exists('#predict')));
  });
  t.test('the Quiz button opens the quiz', async (p) => {
    await p.open('quick-sort');
    await p.click('#btnQuiz');
    p.assert.match(await p.waitModal(), /^Quiz: Quick sort/);
    p.assert.ok((await p.count('.quiz-q')) >= 3);
  });
  t.test('a right quiz answer turns green and explains', async (p) => {
    const ans = await p.ev("SEE.Strux.byId('quick-sort').quiz[0].answer");
    await p.ev(`document.querySelectorAll('.quiz-q')[0].querySelectorAll('.quiz-opt')[${ans}].click()`);
    p.assert.ok(await p.ev(`document.querySelectorAll('.quiz-q')[0].querySelectorAll('.quiz-opt')[${ans}].classList.contains('right')`));
    p.assert.ok((await p.ev("document.querySelectorAll('.quiz-q')[0].querySelector('.quiz-why').innerText")).length > 10);
    p.assert.match(await p.text('#quizScore'), /1 of 1/);
  });
  t.test('a wrong quiz answer shows the right one', async (p) => {
    const ans = await p.ev("SEE.Strux.byId('quick-sort').quiz[1].answer");
    const wrong = ans === 0 ? 1 : 0;
    await p.ev(`document.querySelectorAll('.quiz-q')[1].querySelectorAll('.quiz-opt')[${wrong}].click()`);
    p.assert.ok(await p.ev(`document.querySelectorAll('.quiz-q')[1].querySelectorAll('.quiz-opt')[${wrong}].classList.contains('wrong')`));
    p.assert.ok(await p.ev(`document.querySelectorAll('.quiz-q')[1].querySelectorAll('.quiz-opt')[${ans}].classList.contains('right')`));
    p.assert.match(await p.text('#quizScore'), /1 of 2/);
  });
  t.test('a quiz question can be answered only once', async (p) => {
    await p.ev("document.querySelectorAll('.quiz-q')[1].querySelectorAll('.quiz-opt')[2].click()");
    p.assert.match(await p.text('#quizScore'), /1 of 2/);
    await p.closeModals();
  });
};
