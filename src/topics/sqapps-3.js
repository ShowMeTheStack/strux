// Stacks at work: the call stack of a recursive function, frames pushed on the way down and popped
// on the way back up, each return value handed to the frame below.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, S = X.StackKit;

  const FW = 380, FH = 46, FG = 8;
  const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));

  X.topic({
    id: 'app-recursion', family: 'sqapps', order: 50, title: 'Recursion and the call stack',
    blurb: 'Each call of fact() gets a frame of its own on the call stack, with its own n. The calls pile up until n reaches 1; then the frames come off one by one, each handing its answer down to the call that is waiting for it.',
    headC: () => '#include <stdio.h>',
    code: `/* n! = n * (n - 1)!, and 0! = 1! = 1 */
int fact(int n)
{
    int smaller, result;
    if (n <= 1)                    /*@ base */
        return 1;                  /*@ base-return */
    smaller = fact(n - 1);         /*@ call */
    result = n * smaller;          /*@ combine */
    return result;                 /*@ return */
}`,
    animate: ['fact'],
    inputs: [{ id: 'n', kind: 'int', label: 'n', def: 4, lo: 0, hi: 7 }],
    presets: [
      { label: 'fact(4)', values: { n: 4 } },
      { label: 'Base case at once: fact(1)', values: { n: 1 } },
      { label: 'fact(0)', values: { n: 0 } },
      { label: 'Deep: fact(7)', values: { n: 7 } },
    ],
    counters: ['writes'],
    main: (inp) => `int main(void)
{
    int f = fact(${inp.n});
    printf("%d\\n", f);
    return 0;
}`,
    capture(P) {
      return { calls: P.calls(['smaller', 'result', 'f']), f: P.has('f') && P.isSet('f') ? P.val('f') : null };
    },
    scene(ctx) {
      const tk = ctx.tick, d = tk.data, tag = tk.tag, N = ctx.input.n;
      const m = ctx.memo;
      const frames = d.calls.filter((c) => c.fn === 'fact');
      const deepest = Math.max(1, N);
      const yOf = (j) => (deepest - j) * (FH + FG);        // j = 0 for main, 1 for the first fact
      const items = [S.extent(-40, -70, FW + 420, yOf(0) + FH + 90)];
      // which frame this line belongs to (on a call line the new frame is already there)
      const own = tag === 'call' ? frames.length - 1 : frames.length;
      // the value travelling down from a frame that has just returned
      if (m.at !== ctx.i) {
        m.at = ctx.i;
        m.done = m.done || {};
        if ((tag === 'base-return' || tag === 'return') && tk.ret !== undefined) { m.done[frames.length] = tk.ret; m.travel = { val: tk.ret, from: frames.length, at: ctx.i }; }
        if (tag === 'after') m.final = d.f;
      }
      items.push({ key: 'mainF', kind: 'node', x: 0, y: yOf(0), w: FW, h: FH, cells: [{ text: 'main', w: 1.4, cls: 'val' }, { text: 'f = ' + (d.f !== null && tag === 'after' ? d.f : '?'), w: 2.4, cls: 'val' }], cls: 'sk-frame-card sk-main' + (tag === 'after' ? ' sk-top' : '') });
      frames.forEach((f, k) => {
        const j = k + 1;
        const a = f.args;
        const isTop = j === frames.length;
        const fresh = tag === 'call' && isTop;
        const sm = a.smaller !== undefined ? a.smaller : '?';
        const rs = a.result !== undefined ? a.result : '?';
        const cells = [
          { text: 'fact(n = ' + a.n + ')', w: 1.4, cls: 'val' },
          { text: a.n <= 1 ? 'base case' : 'smaller = ' + sm, w: 1.2, cls: 'val' + (tag === 'combine' && isTop ? ' sk-new' : '') },
          { text: a.n <= 1 ? 'returns 1' : 'result = ' + rs, w: 1.2, cls: 'val' + ((tag === 'return' || tag === 'base-return') && isTop ? ' sk-done' : '') },
        ];
        items.push({ key: 'fr' + j, kind: 'node', x: 0, y: yOf(j), w: FW, h: FH, cells, cls: 'sk-frame-card' + (j === own ? ' sk-top' : ''), enter: fresh ? 'drop' : 'fade', exit: 'fade', pick: true });
      });
      items.push({ key: 'stT', kind: 'text', x: -14, y: yOf(0) + FH / 2 + 5, text: 'bottom', cls: 'sk-label', anchor: 'end' });
      if (frames.length) items.push({ key: 'topT', kind: 'cursor', x: -4, y: yOf(frames.length) + FH / 2, tx: -40, ty: yOf(frames.length) + FH / 2, text: 'top', cls: 'c-indigo' });
      // the return value: a token beside the returning frame, then dropping into the caller
      const tv = m.travel;
      if (tv && (tv.at === ctx.i || tv.at === ctx.i - 1)) {
        const down = tv.at === ctx.i - 1;
        const j = down ? tv.from - 1 : tv.from;
        items.push({ key: 'ret' + tv.at, kind: 'token', x: FW + 32, y: yOf(j) + FH / 2, r: 20, text: String(tv.val), cls: 'c-green sk-big' });
      }
      // the sum on paper: one line per call, filled in as the answers come back
      const PX = FW + 70;
      items.push({ key: 'pT', kind: 'text', x: PX, y: yOf(deepest) - 30, text: 'on paper', cls: 'sk-title' });
      const seen = m.seen = m.seen || {};
      frames.forEach((f, k) => { seen[k + 1] = f.args.n; });
      for (let j = 1; j <= deepest; j++) {
        if (seen[j] === undefined) continue;
        const n = seen[j];
        const back = m.done[j];
        const live = j <= frames.length;
        const line = n <= 1 ? 'fact(' + n + ') = 1' : 'fact(' + n + ') = ' + n + ' × fact(' + (n - 1) + ')' + (back !== undefined ? ' = ' + n + ' × ' + fact(n - 1) + ' = ' + back : '');
        items.push({ key: 'p' + j, kind: 'text', x: PX, y: yOf(j) + FH / 2 + 5, text: line, cls: 'sk-eq' + (back !== undefined ? ' good' : live ? '' : ' dim') });
      }
      const cur = frames[own - 1] ? frames[own - 1].args : null;
      const n = cur ? cur.n : N;
      let say = '';
      switch (tag) {
        case 'enter': say = 'main calls fact(' + N + '). A frame for it goes on the call stack: its own n = ' + N + ', and room for its own smaller and result.'; break;
        case 'base': say = 'fact(' + n + '): is n <= 1? ' + (n <= 1 ? 'Yes: this is the base case, the one call that does not recurse.' : 'No, so the answer depends on fact(' + (n - 1) + ').'); break;
        case 'base-return': say = 'fact(' + n + ') returns 1. ' + (frames.length > 1 ? 'Its frame comes off the stack, and the 1 goes down to fact(' + frames[frames.length - 2].args.n + '), which has been waiting all this time.' : 'Its frame comes off the stack and the 1 goes back to main.'); break;
        case 'call': { const callee = frames[frames.length - 1].args.n; say = 'fact(' + (callee + 1) + ') cannot finish yet: it calls fact(' + callee + ') and waits. A new frame goes on top; there are now ' + frames.length + ' fact frames, each with its own n.'; break; }
        case 'combine': say = 'Back in fact(' + n + '): smaller = ' + cur.smaller + ' has just arrived from below. result = ' + n + ' × ' + cur.smaller + ' = ' + cur.result + '.'; break;
        case 'return': say = 'fact(' + n + ') returns ' + tk.ret + ' and its frame comes off the stack. ' + (frames.length > 1 ? 'The value goes down to fact(' + frames[frames.length - 2].args.n + ').' : 'That is the answer main asked for.'); break;
        case 'after': say = 'main gets f = ' + d.f + '. The stack grew to ' + deepest + ' fact frame' + (deepest === 1 ? '' : 's') + ' on the way down, and every one was popped on the way back up, in reverse order.'; break;
      }
      return { items, say, calls: d.calls, slow: tag === 'base-return' || tag === 'base' && n <= 1 };
    },
    predict: [
      { at: (t, i) => i === 0, once: true, ask: (t, ts, i, ctx) => 'How many fact frames will be on the stack at the deepest point of fact(' + ctx.input.n + ')?', options: (ts, i, ctx) => { const o = []; for (let k = 1; k <= Math.max(3, ctx.input.n + 1); k++) o.push(String(k)); return o; }, answer: (ts, i, ctx) => String(Math.max(1, ctx.input.n)), pick: 'option', explain: (ts, i, ctx) => 'One for each n from ' + ctx.input.n + ' down to ' + (ctx.input.n <= 1 ? ctx.input.n : 1) + ': the base case stops the calls.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'combine' && (t.tag === 'return' || t.tag === 'base-return'), once: true, ask: (t, ts, i) => { const f = ts[i + 1].data.calls.filter((c) => c.fn === 'fact'); const n = f[f.length - 1].args.n; return 'fact(' + (n - 1) + ') has returned ' + t.ret + '. What will fact(' + n + ') work out?'; }, options: (ts, i) => { const f = ts[i + 1].data.calls.filter((c) => c.fn === 'fact'); const n = f[f.length - 1].args.n, v = ts[i].ret; return [...new Set([String(n * v), String(n + v), String(v)])].sort((a, b) => a - b); }, answer: (ts, i) => { const f = ts[i + 1].data.calls.filter((c) => c.fn === 'fact'); return String(f[f.length - 1].args.n * ts[i].ret); }, pick: 'option', explain: () => 'result = n × smaller.' },
    ],
    quiz: [
      { q: 'While fact(4) runs, how many frames of fact are on the stack at the deepest point?', options: ['1', '3', '4', '24'], answer: 2, why: 'fact(4), fact(3), fact(2) and fact(1), one frame each.' },
      { q: 'Which call finishes first?', options: ['fact(4)', 'fact(1)', 'main', 'They finish together'], answer: 1, why: 'The last frame pushed is the first popped: the base case returns first.' },
      { q: 'What would happen without the base case (if n <= 1)?', options: ['It returns 0', 'The calls never stop, until the stack runs out of memory', 'It returns n', 'Nothing'], answer: 1, why: 'Every call would make another: a stack overflow.' },
      { q: 'Each frame has its own n. Why does that matter?', options: ['It does not', 'Each waiting call still has its own n when the answer comes back', 'It saves memory', 'It makes n global'], answer: 1, why: 'fact(4) still knows n = 4 after fact(3) returns, because fact(3) used a different n.' },
      { q: 'How much stack memory does fact(n) use?', options: ['O(1)', 'O(n): one frame per level', 'O(n!)', 'O(log n)'], answer: 1, why: 'n frames are on the stack at the deepest point.' },
    ],
  });
})(SEE);
