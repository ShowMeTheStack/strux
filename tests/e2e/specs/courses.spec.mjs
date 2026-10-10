// Guided courses.
export default (t) => {
  t.test('the course list shows every course', async (p) => {
    await p.route('courses');
    p.assert.equal(await p.count('.course-card'), await p.ev('SEE.Strux.Courses.list.length'));
  }, { fresh: true });
  t.test('a fresh course shows 0 done', async (p) => {
    p.assert.match(await p.text('.course-card .n'), /^0 of \d+ done/);
  });
  t.test('a course card opens the course page', async (p) => {
    await p.click('.course-card');
    await p.wait("!!document.getElementById('courseStart')");
    p.assert.ok((await p.count('.course-steps li')) >= 5);
  });
  t.test('every step of every course is a real topic', async (p) => {
    const bad = await p.ev('SEE.Strux.Courses.list.flatMap(c => c.steps.filter(([id]) => !SEE.Strux.byId(id)).map(s => c.id + ":" + s[0]))');
    p.assert.deepEqual(bad, []);
  });
  t.test('every step has a note', async (p) => {
    const bad = await p.ev('SEE.Strux.Courses.list.flatMap(c => c.steps.filter(s => !s[1] || s[1].length < 15).map(s => s[0]))');
    p.assert.deepEqual(bad, []);
  });
  t.test('Start opens the first step with the course strip', async (p) => {
    await p.route('course=sorting');
    await p.click('#courseStart');
    await p.wait("!!document.getElementById('courseStrip')");
    p.assert.equal(await p.ev('SEE.Strux.app.player.t.id'), 'bubble-sort');
    p.assert.match(await p.text('#courseStrip'), /step 1 of/);
  });
  t.test('Back is disabled on the first step', async (p) => {
    p.assert.ok(await p.ev("document.getElementById('coursePrev').disabled"));
  });
  t.test('Next goes to the next step', async (p) => {
    await p.click('#courseNext');
    await p.wait("SEE.Strux.app.player && SEE.Strux.app.player.t.id === 'selection-sort'");
    p.assert.match(await p.text('#courseStrip'), /step 2 of/);
  });
  t.test('Back goes to the previous step', async (p) => {
    await p.click('#coursePrev');
    await p.wait("SEE.Strux.app.player && SEE.Strux.app.player.t.id === 'bubble-sort'");
  });
  t.test('the strip shows the step note', async (p) => {
    p.assert.match(await p.text('#courseStrip p'), /biggest bubbles/);
  });
  t.test('finishing a step counts it as done', async (p) => {
    await p.toEnd();
    await p.route('courses');
    const txt = await p.ev("document.querySelector('.course-card[data-course=sorting] .n').innerText");
    p.assert.match(txt, /^1 of/);
  });
  t.test('the course page offers Continue after progress', async (p) => {
    await p.route('course=sorting');
    p.assert.match(await p.text('#courseStart'), /Continue/);
    p.assert.ok(await p.exists('.course-steps li.done'));
  });
  t.test('Continue opens the first unfinished step', async (p) => {
    await p.click('#courseStart');
    await p.wait("SEE.Strux.app.player && SEE.Strux.app.player.t.id === 'selection-sort'");
  });
  t.test('the last step offers Finish, which returns to the course', async (p) => {
    const n = await p.ev("SEE.Strux.Courses.list.find(c => c.id === 'sorting').steps.length");
    await p.route('course=sorting/' + (n - 1));
    await p.wait("!!document.getElementById('courseNext')");
    p.assert.equal(await p.text('#courseNext'), 'Finish');
    await p.click('#courseNext');
    await p.wait("!!document.getElementById('courseStart')");
  });
  t.test('a step number out of range is clamped', async (p) => {
    await p.route('course=sorting/999');
    await p.wait("!!document.getElementById('courseStrip')");
  });
  t.test('an unknown course falls back to the list', async (p) => {
    await p.route('course=nope');
    p.assert.ok(await p.exists('.course-card'));
  });
  t.test('every course opens each of its steps', async (p) => {
    const cs = await p.ev('SEE.Strux.Courses.list.map(c => [c.id, c.steps.length])');
    for (const [id, n] of cs) {
      for (const k of [0, n - 1]) {
        await p.route('course=' + id + '/' + k);
        await p.wait("!!document.getElementById('courseStrip') && SEE.Strux.app.player && SEE.Strux.app.player.frames.length > 1", 15000);
      }
    }
    p.assert.deepEqual(p.newExceptions(), []);
  }, { timeout: 120000 });
};
