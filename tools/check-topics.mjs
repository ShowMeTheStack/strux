// Check every topic: with its default input and with every preset it builds, runs, records ticks,
// and draws every frame without an error; nearly every frame has narration; the topic has
// predictions and a quiz. Usage: node tools/check-topics.mjs [topic id or family fragment] [--verbose]
import { load } from '../tests/load.mjs';
const SEE = load();
const X = SEE.Strux;
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))[0];
const verbose = process.argv.includes('--verbose');
let pass = 0, fail = 0;
const ids = new Set();
for (const t of X.topics) {
  if (only && !t.id.includes(only) && !t.family.includes(only)) continue;
  const why = [];
  if (ids.has(t.id)) why.push('duplicate id');
  ids.add(t.id);
  if (!X.familyOf(t)) why.push('unknown family ' + t.family);
  if (!t.title || !t.blurb) why.push('title and blurb needed');
  if (!t.quiz || t.quiz.length < 3) why.push('at least 3 quiz questions');
  else for (const q of t.quiz) if (!(q.answer >= 0 && q.answer < q.options.length) || !q.why) why.push('quiz question needs a valid answer and a why: ' + q.q);
  if (!t.predict || !t.predict.length) why.push('at least one prediction');
  const runs = [{ label: 'default', values: {} }].concat(t.presets || []);
  let predicts = 0;
  for (const p of runs) {
    const input = X.inputOf(t, Object.assign(X.inputOf(t), p.values));
    const err = X.checkInput(t, input);
    if (err) { why.push(p.label + ': its own input is refused: ' + err); continue; }
    let r;
    try { r = X.run(t, input); } catch (e) { why.push(p.label + ': crashed: ' + e.stack.split('\n').slice(0, 2).join(' ')); continue; }
    if (!r.ok) { why.push(p.label + ': does not build: ' + r.errors.join(' | ')); continue; }
    if (r.rec.warnings && r.rec.warnings.length) why.push(p.label + ': compiler warnings: ' + r.rec.warnings.map((w) => w.message).join(' | '));
    if (r.fault && !t.expectFault) why.push(p.label + ': the program crashed: ' + r.fault.msg);
    if (r.rec.truncated) why.push(p.label + ': too many steps (over the limit); keep inputs small');
    if (r.frames.length < 3) why.push(p.label + ': only ' + r.frames.length + ' frames: is the animated function called?');
    const bad = r.frames.filter((f) => f.error);
    if (bad.length) why.push(p.label + ': ' + bad.length + ' frames failed to draw: ' + bad[0].error.message);
    const silent = r.frames.filter((f) => !f.say);
    if (silent.length > Math.max(1, r.frames.length * 0.08)) why.push(p.label + ': ' + silent.length + ' of ' + r.frames.length + ' frames have no narration (lines ' + [...new Set(silent.map((f) => f.line))].slice(0, 8).join(', ') + ')');
    for (const f of r.frames) {
      const keys = new Set();
      for (const it of f.items || []) {
        if (!it || !it.key) { why.push(p.label + ': an item without a key'); break; }
        if (keys.has(it.key)) { why.push(p.label + ': two items share the key ' + it.key + ' (line ' + f.line + ')'); break; }
        keys.add(it.key);
        for (const k of ['x', 'y', 'w', 'h']) if (it[k] !== undefined && !Number.isFinite(it[k])) { why.push(p.label + ': item ' + it.key + ' has ' + k + ' = ' + it[k]); break; }
      }
      if (/undefined|NaN|\[object|\bnull\b/.test(f.say || '')) { why.push(p.label + ': narration says "' + f.say.slice(0, 90) + '"'); break; }
    }
    predicts += r.frames.filter((f) => f.predict).length;
    // a prediction is shown on frame i and answered by what happens at frame i + 1
    r.frames.forEach((f, i) => {
      const q = f.predict;
      if (!q) return;
      if (q.pick === 'option') { if (!q.options || !q.options.map(String).includes(String(q.answer))) why.push(p.label + ': a prediction at frame ' + i + ' has an answer (' + q.answer + ') that is not among its options'); return; }
      if (!(f.items || []).some((it) => it.key === q.answer)) why.push(p.label + ': a prediction at frame ' + i + ' wants the item ' + q.answer + ' clicked, but frame ' + i + ' does not draw it');
    });
    if (verbose) console.log('  ' + t.id + ' / ' + p.label + ': ' + r.frames.length + ' frames, ' + r.frames.filter((f) => f.predict).length + ' predictions');
  }
  if (!predicts) why.push('no prediction fires with the default input or any preset');
  const uniq = [...new Set(why)];
  if (uniq.length) { fail++; console.log('FAIL ' + t.id + '\n    ' + uniq.slice(0, 12).join('\n    ')); } else pass++;
}
console.log(pass + ' topics ok, ' + fail + ' with problems');
if (fail) process.exitCode = 1;
