// The tests every topic gets: it opens, every step draws and narrates, every preset runs, the side tabs
// follow the steps, its predictions and quiz work, it opens in See, bad input is refused, and it fits a phone.
import { load } from '../load.mjs';

const X = load().Strux;

export function topicsOfGroup(group) {
  return X.topics.filter((t) => X.familyOf(t).group === group).map((t) => ({
    id: t.id, title: t.title, presets: (t.presets || []).map((p) => p.label), quiz: (t.quiz || []).length,
    compareWith: t.compareWith || null,
    bad: badInput(t),
  }));
}

/** An input value the topic must refuse, or null if it has nothing to refuse */
function badInput(t) {
  for (const i of t.inputs || []) {
    if (i.kind === 'ints') return { id: i.id, value: '1 x 2' };
    if (i.kind === 'int' && i.hi !== undefined) return { id: i.id, value: String(i.hi + 1000) };
  }
  return null;
}

export function suite(group) {
  return (t) => {
    let first = true;
    for (const tp of topicsOfGroup(group)) {
      const opts = first ? { fresh: true } : {};
      first = false;
      t.test(tp.id + ': opens with its title, blurb and code', async (p) => {
        await p.open(tp.id);
        p.assert.equal(await p.text('.t-head h1'), tp.title);
        p.assert.ok((await p.text('.t-head p')).length > 20);
        p.assert.ok((await p.count('#code .ln')) > 10);
        p.assert.ok((await p.frames()) >= 3);
      }, opts);
      t.test(tp.id + ': every step draws and has narration', async (p) => {
        await p.open(tp.id);
        const n = await p.frames();
        const silent = [];
        for (let i = 0; i < n; i++) {
          await p.ev(`SEE.Strux.app.player.go(${i}, true)`);
          const s = await p.ev("document.getElementById('say').innerText.split('\\n').slice(1).join(' ')");
          if (s.trim().length < 3) silent.push(i);
        }
        p.assert.ok(silent.length <= Math.max(1, n * 0.08), 'silent steps: ' + silent.join(','));
        p.assert.ok((await p.stageKeys()).length > 0);
        p.assert.deepEqual(p.newExceptions(), []);
      }, { timeout: 90000 });
      t.test(tp.id + ': no step says undefined or NaN', async (p) => {
        const bad = await p.ev("SEE.Strux.app.player.frames.map((f, i) => [i, f.say || '']).filter(([i, s]) => /undefined|NaN|\\[object/.test(s)).map(x => x[0])");
        p.assert.deepEqual(bad, []);
      });
      t.test(tp.id + ': the last step is marked Finished and the topic done', async (p) => {
        await p.open(tp.id);
        await p.toEnd();
        p.assert.match(await p.say(), /^Finished/i);
        await p.sleep(50);
        p.assert.ok(await p.exists(`#side .cat-topic[data-topic="${tp.id}"] .done`));
      });
      t.test(tp.id + ': stepping back gives the same picture again', async (p) => {
        await p.open(tp.id);
        const m = Math.floor((await p.frames()) / 2);
        await p.go(m);
        await p.sleep(250);
        const a = (await p.stageKeys()).sort();
        await p.go(m + 1);
        await p.go(m);
        await p.sleep(250);
        p.assert.deepEqual((await p.stageKeys()).sort(), a);
      });
      t.test(tp.id + ': the code tab lights the running line', async (p) => {
        await p.open(tp.id);
        await p.showTab('code');
        const m = Math.floor((await p.frames()) / 3);
        await p.go(m);
        p.assert.equal(await p.curLine(), (await p.frame()).line);
      });
      t.test(tp.id + ': the memory tab shows the frames', async (p) => {
        await p.open(tp.id);
        await p.go(Math.floor((await p.frames()) / 2));
        await p.showTab('memory');
        p.assert.ok((await p.count('.mem-frame')) >= 1);
        p.assert.match(await p.tabText(), /main\(\)/);
        await p.showTab('code');
      });
      t.test(tp.id + ': the calls tab shows the stack', async (p) => {
        await p.open(tp.id);
        await p.go(Math.floor((await p.frames()) / 2));
        await p.showTab('calls');
        p.assert.ok((await p.count('#callsView .frame')) >= 1);
        await p.showTab('code');
      });
      for (const label of tp.presets) {
        t.test(tp.id + ': preset "' + label + '" runs', async (p) => {
          await p.open(tp.id);
          await p.click('.presets .chip', label);
          await p.sleep(100);
          p.assert.equal(await p.inputError(), '');
          p.assert.ok((await p.frames()) >= 3);
          p.assert.equal(await p.at(), 0);
          await p.toEnd();
          p.assert.match(await p.say(), /^Finished/i);
        });
      }
      t.test(tp.id + ': the quiz has ' + tp.quiz + ' questions and scores them', async (p) => {
        await p.open(tp.id);
        await p.click('#btnQuiz');
        await p.waitModal();
        p.assert.equal(await p.count('.quiz-q'), tp.quiz);
        const answers = await p.ev(`SEE.Strux.byId(${JSON.stringify(tp.id)}).quiz.map(q => q.answer)`);
        for (let k = 0; k < answers.length; k++) await p.ev(`document.querySelectorAll('.quiz-q')[${k}].querySelectorAll('.quiz-opt')[${answers[k]}].click()`);
        p.assert.equal(await p.text('#quizScore'), answers.length + ' of ' + answers.length + ' right so far');
        await p.closeModals();
      });
      t.test(tp.id + ': its predictions can be answered', async (p) => {
        await p.ev('SEE.Strux.app.settings.predict = true');
        await p.open(tp.id);
        // the default input first, then each preset, until one asks something
        await p.ev(`(() => { const X = SEE.Strux, pl = X.app.player, t = pl.t;
          const tries = [X.inputOf(t)].concat((t.presets || []).map((pr) => Object.assign(X.inputOf(t), pr.values)));
          for (const inp of tries) { pl.input = inp; pl.run(); if (pl.frames.some((f) => f.predict)) return; }
        })()`);
        const qs = await p.ev("SEE.Strux.app.player.frames.map((f, i) => f.predict ? [i, f.predict.pick, String(f.predict.answer)] : null).filter(Boolean)");
        p.assert.ok(qs.length >= 1, 'no prediction with the default input or any preset');
        for (const [i, pick, ans] of qs.slice(0, 3)) {
          await p.go(i);
          await p.click('#btnFwd');
          await p.wait("!!document.getElementById('predict')");
          if (pick === 'option') await p.ev(`[...document.querySelectorAll('#predict .opts .chip')].find((c) => c.innerText.trim() === ${JSON.stringify(ans)}).click()`);
          else await p.click(`#stageWrap [data-key="${ans}"]`);
          p.assert.match(await p.text('#predict .res'), /Right/);
          await p.click('#predictGo');
          p.assert.equal(await p.at(), i + 1);
        }
        await p.ev('SEE.Strux.app.settings.predict = false');
      }, { timeout: 60000 });
      t.test(tp.id + ': Open in See sends the same program', async (p) => {
        await p.open(tp.id);
        await p.ev('window.__opened = null; window.open = (u) => { window.__opened = u; return null; }');
        await p.click('#btnSee');
        await p.wait('!!window.__opened');
        const code = await p.ev("SEE.Share.unpack(window.__opened.split('#share=')[1]).then(r => SEE.unutf8(r.files['main.c']))");
        p.assert.equal(code, await p.ev('SEE.Strux.app.player.code'));
        p.assert.ok(!/\/\*@/.test(code));
      });
      if (tp.bad) {
        t.test(tp.id + ': a bad input is refused with a message', async (p) => {
          await p.open(tp.id);
          const before = await p.ev('JSON.stringify(SEE.Strux.app.player.input)');
          await p.setInput(tp.bad.id, tp.bad.value);
          await p.runInput();
          p.assert.ok((await p.inputError()).length > 3);
          p.assert.equal(await p.ev('JSON.stringify(SEE.Strux.app.player.input)'), before);
        });
      }
      if (tp.compareWith) {
        t.test(tp.id + ': compares with ' + tp.compareWith, async (p) => {
          await p.open(tp.id);
          await p.click('#btnCompare');
          await p.wait("!!document.getElementById('compareView')");
          p.assert.ok(await p.ev('SEE.Strux.Compare.current.left.frames.length > 1 && SEE.Strux.Compare.current.right.frames.length > 1'));
        });
      }
      t.test(tp.id + ': fits a phone screen', async (p) => {
        await p.viewport(390, 844, { mobile: true, touch: true });
        await p.open(tp.id);
        await p.go(Math.floor((await p.frames()) / 2));
        p.assert.ok(await p.noHScroll());
        p.assert.ok((await p.rect('#stageWrap')).w > 300);
        await p.viewport(1400, 900);
      });
    }
  };
}
