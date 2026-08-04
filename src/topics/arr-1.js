// Static arrays: the family (a fixed int a[CAP] and a count n), traversal, insertion, deletion, reversal,
// rotation by three reversals, and merging two sorted arrays.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, S = X.StripKit;
  const W = S.CELL, PITCH = S.CELL + S.GAP;
  const CAP = 8;

  X.family({
    id: 'arr', order: 1, group: 'Arrays', title: 'Static arrays',
    blurb: 'A row of CAP slots fixed when the program is compiled, and a count n of how many are in use. Everything else is moving values between slots.',
    head: `#include <stdio.h>

#define CAP ${CAP}    /* the number of slots: fixed for the life of the program */`,
  });

  /** main: an array of CAP slots holding the chosen values, n of them in use, then the call */
  const arrMain = (vals, call) => `int main(void)
{
    int a[CAP] = { ${vals.length ? vals.join(', ') : '0'} };
    int n = ${vals.length};
    ${call}
    return 0;
}`;
  X.arrMain = arrMain;
  const valuesIn = (def, min) => ({ id: 'values', kind: 'ints', label: 'The array', def, min: min || 0, max: CAP });

  const pos = S.row(0, 0);
  const cx = (i) => i * PITCH + W / 2;
  /** the end of the data (n) and of the storage (CAP): two walls between slots */
  function walls(n, cap, opts) {
    opts = opts || {};
    const items = [];
    const xn = n * PITCH - S.GAP / 2, xc = cap * PITCH - S.GAP / 2;
    if (n !== cap) items.push(...S.wall('wall-n', xn, -40, xn, W + 14, (opts.nName || 'n') + ' = ' + n, 'c-indigo', { x: xn, y: -50 }));
    items.push(...S.wall('wall-cap', xc, -40, xc, W + 14, n === cap ? (opts.nName || 'n') + ' = CAP = ' + cap : 'CAP = ' + cap, n === cap ? 'c-rose' : '', { x: xc + 4, y: -50 }));
    return items;
  }
  /** a label that ends at x (the stage sizes its view from where text starts, so start it there) */
  const lbl = (key, x, y, text, cls) => ({ key, kind: 'text', x: x - text.length * 7.6, y, text, cls: cls || 'idx' });
  X.arrLabel = lbl;
  const tickTags = (ctx) => ctx.ticks.slice(0, ctx.i + 1).map((t) => t.tag);
  const list = (arr) => (arr.length ? arr.join(' ') : 'nothing');

  // ---- traverse ----------------------------------------------------------------------------------------
  X.topic({
    id: 'arr-traverse', family: 'arr', order: 10, title: 'Traverse: visit, print and sum',
    blurb: 'One index walks from 0 up to n - 1. Each value is printed and added to a running total; the walk stops at n, never at CAP.',
    code: `/* print every element and return the sum of them all */
int sum(const int a[], int n)
{
    int total = 0;                /*@ init */
    int i;
    for (i = 0; i < n; i++) {     /*@ loop */
        printf("%d ", a[i]);      /*@ visit */
        total += a[i];            /*@ add */
    }
    return total;                 /*@ done */
}`,
    animate: ['sum'],
    inputs: [valuesIn([12, 7, 30, 5, 21])],
    presets: [
      { label: 'Five values', values: { values: [12, 7, 30, 5, 21] } },
      { label: 'One value', values: { values: [42] } },
      { label: 'Empty (n = 0)', values: { values: [] } },
      { label: 'Negatives too', values: { values: [8, -3, 15, -10, 4, -1] } },
      { label: 'Full: n = CAP', values: { values: [1, 2, 3, 4, 5, 6, 7, 8] } },
    ],
    counters: ['follows'],
    main: (inp) => arrMain(inp.values, 'printf("\\nsum = %d\\n", sum(a, n));'),
    capture: (P) => ({ a: P.arr('a', CAP), n: P.val('n'), i: S.local(P, 'i'), total: S.local(P, 'total') }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, n = ctx.input.values.length;
      const past = ctx.ticks.slice(0, ctx.i + 1);
      const printed = past.filter((t) => t.tag === 'visit').map((t) => t.data.a[t.data.i]);
      const added = past.filter((t) => t.tag === 'add').length;
      const total = d.total === null ? (tag === 'done' || tag === 'after' ? printed.reduce((s, v) => s + v, 0) : null) : d.total;
      const i = d.i;
      const view = S.cells(ctx, 'a', d.a, {
        pos,
        cls: (k) => (k >= n ? 'unused' : (tag === 'visit' || tag === 'add') && k === i ? 'focus' : k < added ? 'part-a' : ''),
        hotWrites: false,
      });
      const items = view.items.concat(walls(n, CAP));
      // the running total above every cell already added: the prefix sums
      let run = 0;
      for (let k = 0; k < added; k++) {
        run += d.a[k];
        items.push({ key: 'ps' + k, kind: 'text', x: cx(k), y: -46, text: '= ' + run, cls: 'mono muted small', anchor: 'middle' });
      }
      if (added) items.push(lbl('ps-l', -14, -46, 'running total'));
      // the total box, and the value travelling into it
      const tx = Math.max(n, 1) * PITCH / 2 - W / 2, ty = 150;
      items.push({ key: 'tot', kind: 'cell', x: tx - 10, y: ty, w: W + 20, h: W, text: total === null ? '?' : total, sub: 'total', cls: tag === 'add' ? 'hot' : tag === 'done' || tag === 'after' ? 'done' : 'part-b', flash: tag === 'add' });
      if (tag === 'add' && i !== null) items.push({ key: 'tok' + ctx.i, kind: 'token', x: tx - 40, y: ty + W / 2, r: 17, text: '+' + d.a[i], cls: 'c-teal', enter: 'fly', from: { x: cx(i), y: W / 2 }, exit: 'fade' });
      if (i !== null) {
        const off = i >= n;
        items.push(i < CAP ? S.tag('ci', view.keyOf(i), 'i = ' + i, off ? 'c-rose' : 'c-teal') : S.tagAt('ci', cx(i), W + 20, 'i = ' + i, 'c-rose'));
      }
      items.push(lbl('outl', -14, 262, 'output'));
      items.push({ key: 'out', kind: 'text', x: 0, y: 262, text: printed.join(' ') + (tag === 'after' ? '   sum = ' + total : ''), cls: 'out' });
      let say = '';
      switch (tag) {
        case 'enter': say = n ? 'sum(a, ' + n + '): the array has ' + CAP + ' slots, but only the first ' + n + ' hold data. The walk must stop at n.' : 'sum(a, 0): n is 0, so no slot holds data, even though all ' + CAP + ' slots exist.'; break;
        case 'init': say = 'total starts at 0, the sum of no numbers at all.'; break;
        case 'loop': say = i < n ? 'i = ' + i + '. Is ' + i + ' < n (' + n + ')? Yes: a[' + i + '] is part of the data.' : 'i = ' + i + '. Is ' + i + ' < ' + n + '? No: the walk stops. a[' + i + '] ' + (i < CAP ? 'exists in memory but holds no data of ours' : 'does not even exist') + ', so it is never read.'; break;
        case 'visit': say = 'Print a[' + i + '] = ' + d.a[i] + '. Reaching slot ' + i + ' takes one step: its address is the start of a plus ' + i + ' × 4 bytes.'; break;
        case 'add': say = 'total += a[' + i + ']: ' + (d.total - d.a[i]) + ' + ' + d.a[i] + ' = ' + d.total + '.'; break;
        case 'done': say = 'The loop ran ' + S.pl(n, 'time') + ', once per element: sum() returns ' + total + '.'; break;
        case 'after': say = 'main prints sum = ' + total + '. Every element was visited exactly once: the work grows in step with n.'; break;
      }
      return { items, say };
    },
    predict: [
      { at: (t) => t.tag === 'init' && t.data.n > 1, once: true, ask: 'What will sum() return?', options: (ts) => { const a = ts[0].data.a.slice(0, ts[0].data.n), s = a.reduce((x, y) => x + y, 0); return [...new Set([s, s - a[a.length - 1], s + a[0], s - a[0]])].sort((x, y) => x - y).map(String); }, answer: (ts) => String(ts[0].data.a.slice(0, ts[0].data.n).reduce((x, y) => x + y, 0)), pick: 'option', explain: () => 'Every element from a[0] to a[n - 1] is added once, and nothing else.' },
      { at: (t, i, ts) => t.tag === 'add' && t.data.i === t.data.n - 1, once: true, ask: (t) => 'i will become ' + t.data.n + ', which is n. Does the loop body run once more?', options: () => ['Yes, for a[n]', 'No, the test i < n fails'], answer: () => 'No, the test i < n fails', pick: 'option', explain: (ts, i) => 'The last element is a[n - 1] = a[' + (ts[i].data.n - 1) + ']. Writing i <= n would read a[n], one past the data.' },
    ],
    quiz: [
      { q: 'Why does the loop test i < n and not i < CAP?', options: ['CAP is not known inside sum()', 'Slots from n to CAP - 1 exist but hold no data of ours', 'It makes no difference', 'i < CAP would be slower to compile'], answer: 1, why: 'n counts the values in use. The other slots are storage that has not been filled.' },
      { q: 'What goes wrong with for (i = 0; i <= n; i++)?', options: ['Nothing', 'The first element is skipped', 'a[n] is read, one past the last element', 'The loop never ends'], answer: 2, why: 'The valid elements are a[0] to a[n - 1]. i <= n reads one slot too many: the classic off-by-one.' },
      { q: 'How long does it take to reach a[5] compared with a[0]?', options: ['Five times longer', 'The same: one address calculation', 'It depends on the values', 'It needs a loop'], answer: 1, why: 'The address of a[i] is the start of a plus i × sizeof(int): one multiplication and one addition, whatever i is.' },
      { q: 'sum() of an empty array (n = 0) returns...', options: ['0', 'a[0]', 'Whatever is in memory', 'It crashes'], answer: 0, why: 'The loop test 0 < 0 fails at once, and total is still 0.' },
      { q: 'Why is the parameter written const int a[]?', options: ['The array is copied', 'sum() promises not to change the elements', 'It makes the loop faster', 'It stops n from changing'], answer: 1, why: 'Only the address of the array is passed; const says this function only reads through it.' },
    ],
  });

  // ---- insert at a position ------------------------------------------------------------------------------
  X.topic({
    id: 'arr-insert', family: 'arr', order: 20, title: 'Insert at a position',
    blurb: 'To make room at index pos, every element from the end down to pos moves one slot right. The gap travels left until it reaches pos.',
    code: `/* put x at index pos, moving a[pos..n-1] one place right;
   returns the new number of elements */
int insert_at(int a[], int n, int pos, int x)
{
    int i;
    if (n == CAP)                  /*@ full-test */
        return n;                  /*@ full */
    for (i = n; i > pos; i--)      /*@ loop */
        a[i] = a[i - 1];           /*@ shift */
    a[pos] = x;                    /*@ place */
    return n + 1;                  /*@ done */
}`,
    animate: ['insert_at'],
    inputs: [valuesIn([10, 20, 30, 40, 50]), { id: 'pos', kind: 'int', label: 'At index', def: 1, lo: 0, hi: CAP }, { id: 'x', kind: 'int', label: 'Insert', def: 15, lo: -999, hi: 999 }],
    check: (inp) => (inp.pos > inp.values.length ? 'At index: from 0 to n (' + inp.values.length + '), so no gap is left in the array' : null),
    presets: [
      { label: 'In the middle', values: { values: [10, 20, 30, 40, 50], pos: 2, x: 25 } },
      { label: 'At the front (worst)', values: { values: [10, 20, 30, 40, 50, 60], pos: 0, x: 5 } },
      { label: 'At the end (no moves)', values: { values: [10, 20, 30], pos: 3, x: 40 } },
      { label: 'Into a full array', values: { values: [1, 2, 3, 4, 5, 6, 7, 8], pos: 2, x: 99 } },
      { label: 'Into an empty array', values: { values: [], pos: 0, x: 7 } },
    ],
    counters: ['moves', 'writes'],
    main: (inp) => arrMain(inp.values, 'n = insert_at(a, n, ' + inp.pos + ', ' + inp.x + ');'),
    capture: (P) => ({ a: P.arr('a', CAP), n: P.val('n'), i: S.local(P, 'i') }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const n0 = inp.values.length, p = inp.pos, i = d.i;
      const tags = tickTags(ctx);
      const full = n0 === CAP;
      const started = tags.includes('loop');
      const placed = tags.includes('place');
      const L = tag === 'after' ? d.n : started ? n0 + 1 : n0;
      let hole = null;
      if (tag === 'loop') hole = i;
      else if (tag === 'shift') hole = i - 1;
      const tokY = -92;
      const view = S.cells(ctx, 'a', d.a, {
        pos,
        src: (k) => (tag === 'shift' && k === i ? k - 1 : tag === 'place' && k === p ? { x: k * PITCH, y: tokY - W / 2 } : null),
        cls: (k) => {
          if (k === hole) return 'stale';
          if (k >= L) return 'unused';
          if (placed && k === p) return 'part-a';
          if (started && k > p && k < L && (k > (i === null ? p : tag === 'shift' ? i - 1 : i))) return 'part-b';
          return '';
        },
      });
      const items = view.items.concat(walls(L, CAP));
      if (hole !== null && hole < CAP) {
        items.push({ key: 'hole', kind: 'region', x: hole * PITCH - 5, y: -5, w: W + 10, h: W + 10, cls: 'gapbox' });
        items.push({ key: 'hole-t', kind: 'text', x: cx(hole), y: W + 46, text: hole === p && tag === 'loop' ? 'gap at pos' : 'gap', cls: 'hot', anchor: 'middle' });
      }
      // x waits above its place until it drops in
      if (!placed && !full) {
        items.push({ key: 'xtok', kind: 'token', x: cx(p), y: tokY, r: 20, text: String(inp.x), cls: 'c-green' });
        items.push({ key: 'xtok-l', kind: 'text', x: cx(p), y: tokY - 30, text: 'x, waiting for index ' + p, cls: 'idx', anchor: 'middle' });
      }
      if (full && tag !== 'enter') items.push({ key: 'xtok', kind: 'token', x: cx(Math.min(p, CAP - 1)), y: tokY, r: 20, text: String(inp.x), cls: 'c-gray' }, { key: 'xtok-l', kind: 'text', x: cx(Math.min(p, CAP - 1)), y: tokY - 30, text: 'no room for ' + inp.x, cls: 'bad', anchor: 'middle' });
      if (i !== null) items.push(i < CAP ? S.tag('ci', view.keyOf(i), 'i', 'c-teal', 'below', hole === i ? 1 : 0) : S.tagAt('ci', cx(i), W + 20, 'i', 'c-teal'));
      if (!placed && tag !== 'after') items.push(p < CAP ? S.tag('cp', view.keyOf(p), 'pos', 'c-violet', 'below', i === p ? 1 : hole === p ? 1 : 0) : S.tagAt('cp', cx(p), W + 20, 'pos', 'c-violet'));
      const moves = tags.filter((t) => t === 'shift').length;
      let say = '';
      switch (tag) {
        case 'enter': say = full ? 'insert_at(a, ' + n0 + ', ' + p + ', ' + inp.x + '): every one of the ' + CAP + ' slots is already in use.' : 'insert_at(a, ' + n0 + ', ' + p + ', ' + inp.x + '): ' + inp.x + ' must end up at index ' + p + (n0 - p ? ', so the ' + S.pl(n0 - p, 'value') + ' from a[' + p + '] to a[' + (n0 - 1) + '] must each move one slot right.' : '. Nothing sits there yet, so nothing has to move.'); break;
        case 'full-test': say = full ? 'n == CAP: ' + n0 + ' == ' + CAP + '. The array is full, and a static array cannot grow.' : 'n is ' + n0 + ', CAP is ' + CAP + ': there is a free slot at the end, a[' + n0 + '].'; break;
        case 'full': say = 'insert_at() gives up and returns n unchanged. Nothing was written: ' + inp.x + ' is simply not stored. A dynamic array would grow instead.'; break;
        case 'loop': say = i > p ? 'i = ' + i + '. Is ' + i + ' > pos (' + p + ')? Yes: slot ' + i + ' is the gap, and it takes the value on its left.' : 'i = ' + i + ' = pos. The gap has travelled all the way to index ' + p + ': the loop stops.'; break;
        case 'shift': say = 'a[' + i + '] = a[' + (i - 1) + ']: ' + d.a[i] + ' moves right into slot ' + i + '. Slot ' + (i - 1) + ' still holds a copy of ' + d.a[i - 1] + ', but that copy is now the gap.'; break;
        case 'place': say = 'a[' + p + '] = ' + inp.x + ': x drops into the gap. ' + (moves ? S.pl(moves, 'value') + ' moved to make room.' : 'Nothing had to move.'); break;
        case 'done': say = 'insert_at() returns n + 1 = ' + (n0 + 1) + '.'; break;
        case 'after': say = full ? 'n stays ' + d.n + ': the array is unchanged.' : 'Back in main, n = ' + d.n + ': ' + list(d.a.slice(0, d.n)) + '. Inserting at index ' + p + ' cost ' + S.pl(moves, 'move') + (p ? '; at index 0 it would have cost ' + n0 + '.' : ', the most possible: every element moved.'); break;
      }
      return { items, say, slow: tag === 'place' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'full-test' && ts[i + 1] && ts[i + 1].tag === 'loop' && ts[i + 1].data.i > 0 && ts[0].data.n > 0, once: true, ask: 'The shifting starts now. Click the slot that is written first.', answer: (ts) => 'ea' + ts[0].data.n, explain: (ts) => 'a[' + ts[0].data.n + '] = a[' + (ts[0].data.n - 1) + '] comes first. Working from the end, every value moves into a slot that is already free; going left to right would copy one value over all the others.' },
      { at: (t) => t.tag === 'enter', once: true, ask: 'How many values will have to move?', options: (ts, i, ctx) => [...Array(ctx.input.values.length + 1).keys()].map(String), answer: (ts, i, ctx) => String(ctx.input.values.length === CAP ? 0 : ctx.input.values.length - ctx.input.pos), pick: 'option', explain: (ts, i, ctx) => (ctx.input.values.length === CAP ? 'None: the array is full, so nothing happens at all.' : 'Everything from index ' + ctx.input.pos + ' to n - 1 moves one place: n - pos values.') },
    ],
    quiz: [
      { q: 'Why does the loop run from i = n down to pos + 1, and not upwards?', options: ['It is faster', 'Going upwards would copy a[pos] over every later slot', 'C loops must count down', 'To skip a[0]'], answer: 1, why: 'Moving right must start at the right end: each value moves into a slot whose old value has already been moved on.' },
      { q: 'How many moves does inserting at index 0 of an array of n elements take?', options: ['1', 'n', 'n / 2', 'log n'], answer: 1, why: 'All n elements move one place right: the worst case, O(n).' },
      { q: 'How many moves does inserting at index n (the end) take?', options: ['0', '1', 'n', 'It is not allowed'], answer: 0, why: 'The gap is already at a[n], so x goes straight in.' },
      { q: 'What does insert_at() do when n == CAP?', options: ['Overwrites the last value', 'Writes past the end of the array', 'Returns n unchanged and stores nothing', 'Makes the array bigger'], answer: 2, why: 'A static array has CAP slots for ever. The check stops it writing a[CAP], which does not exist.' },
      { q: 'During the shifting, two neighbouring slots briefly hold the same value. Is that a problem?', options: ['Yes, a value is lost', 'No: the left copy is the gap and gets overwritten next', 'Yes, n is wrong', 'Only if the values are equal'], answer: 1, why: 'The left copy is no longer needed; the next step (or a[pos] = x) writes over it.' },
    ],
    compareWith: 'arr-delete',
  });

  // ---- delete at a position ------------------------------------------------------------------------------
  X.topic({
    id: 'arr-delete', family: 'arr', order: 30, title: 'Delete at a position',
    blurb: 'The value at pos is overwritten by its right neighbour, and every later element moves one slot left. Nothing is erased: the last slot keeps a stale copy that n no longer counts.',
    code: `/* remove a[pos], closing the gap; returns the new number of elements */
int delete_at(int a[], int n, int pos)
{
    int i;
    for (i = pos; i < n - 1; i++)  /*@ loop */
        a[i] = a[i + 1];           /*@ shift */
    return n - 1;                  /*@ done */
}`,
    animate: ['delete_at'],
    inputs: [valuesIn([10, 20, 30, 40, 50, 60], 1), { id: 'pos', kind: 'int', label: 'Delete index', def: 1, lo: 0, hi: CAP - 1 }],
    check: (inp) => (inp.pos >= inp.values.length ? 'Delete index: from 0 to n - 1 (' + (inp.values.length - 1) + ')' : null),
    presets: [
      { label: 'From the middle', values: { values: [10, 20, 30, 40, 50, 60], pos: 2 } },
      { label: 'The first (worst)', values: { values: [10, 20, 30, 40, 50, 60, 70], pos: 0 } },
      { label: 'The last (no moves)', values: { values: [10, 20, 30, 40], pos: 3 } },
      { label: 'The only element', values: { values: [42], pos: 0 } },
    ],
    counters: ['moves', 'writes'],
    main: (inp) => arrMain(inp.values, 'n = delete_at(a, n, ' + inp.pos + ');'),
    capture: (P) => ({ a: P.arr('a', CAP), n: P.val('n'), i: S.local(P, 'i') }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const n0 = inp.values.length, p = inp.pos, i = d.i, victim = inp.values[p];
      const tags = tickTags(ctx);
      const hit = tags.includes('shift');
      const L = tag === 'after' ? d.n : n0;
      let gap = null;
      if (tag === 'loop' && i < n0 - 1) gap = i;
      else if (tag === 'shift') gap = i + 1;
      const stale = tag === 'after' || tag === 'done' ? n0 - 1 : null;
      const view = S.cells(ctx, 'a', d.a, {
        pos,
        src: (k) => (tag === 'shift' && k === i ? k + 1 : null),
        exit: 'fall',
        cls: (k) => {
          if (k === p && !hit && n0 - 1 > p) return 'victim';
          if (k === p && n0 - 1 === p) return tag === 'done' || tag === 'after' ? 'stale' : 'victim';
          if (k === stale) return 'stale';
          if (k === gap && tag === 'shift') return 'stale';
          if (k >= L) return 'unused';
          if (hit && k >= p && k < (gap === null ? n0 - 1 : gap)) return 'part-b';
          return '';
        },
      });
      const items = view.items.concat(walls(L, CAP));
      if (!hit && tag !== 'after' && tag !== 'done') items.push({ key: 'vic-t', kind: 'text', x: cx(p), y: -50, text: 'delete ' + victim, cls: 'bad', anchor: 'middle' });
      if (!hit && tag !== 'after' && tag !== 'done') items.push({ key: 'vic-x', kind: 'text', x: cx(p), y: -76, text: '×', cls: 'bad', anchor: 'middle', size: 22 });
      if (gap !== null && (hit || tag === 'loop')) {
        items.push({ key: 'gap', kind: 'region', x: gap * PITCH - 5, y: -5, w: W + 10, h: W + 10, cls: 'gapbox' });
      }
      if (stale !== null && n0 - 1 >= 0) items.push({ key: 'stale-t', kind: 'text', x: cx(n0 - 1), y: W + 44, text: tag === 'after' ? 'leftover ' + d.a[n0 - 1] : 'not counted any more', cls: 'idx', anchor: 'middle' });
      if (i !== null) items.push(S.tag('ci', view.keyOf(i), 'i', 'c-teal'));
      if (tag === 'enter') items.push(S.tag('cp', view.keyOf(p), 'pos', 'c-violet'));
      const moves = ctx.counters.moves;
      let say = '';
      switch (tag) {
        case 'enter': say = 'delete_at(a, ' + n0 + ', ' + p + '): remove a[' + p + '] = ' + victim + '. ' + (n0 - 1 - p ? 'The ' + S.pl(n0 - 1 - p, 'value') + ' after it must each move one slot left to close the gap.' : 'It is the last element, so nothing has to move.'); break;
        case 'loop': say = i < n0 - 1 ? 'i = ' + i + '. Is ' + i + ' < n - 1 (' + (n0 - 1) + ')? Yes: slot ' + i + ' takes the value from its right.' : 'i = ' + i + ' = n - 1: the loop stops. ' + (moves ? 'Every value after pos has moved left.' : 'Nothing needed to move.'); break;
        case 'shift': say = (i === p ? 'a[' + i + '] = a[' + (i + 1) + ']: ' + victim + ' is overwritten by ' + d.a[i] + '. That is the delete: the value is simply written over.' : 'a[' + i + '] = a[' + (i + 1) + ']: ' + d.a[i] + ' moves left.') + (i + 1 === n0 - 1 ? ' Slot ' + (i + 1) + ' keeps its old ' + d.a[i + 1] + ': it is about to become a leftover past the end.' : ' Slot ' + (i + 1) + ' now holds a copy that is about to be replaced.'); break;
        case 'done': say = 'delete_at() returns n - 1 = ' + (n0 - 1) + '. Look at a[' + (n0 - 1) + ']: it still holds ' + d.a[n0 - 1] + '. Nothing clears it; n simply stops counting it.'; break;
        case 'after': say = 'Back in main, n = ' + d.n + ': ' + list(d.a.slice(0, d.n)) + '. a[' + d.n + '] = ' + d.a[d.n] + ' is a leftover that the next insertion will overwrite. ' + S.pl(moves, 'move') + ' in all.'; break;
      }
      return { items, say, slow: tag === 'shift' && i === p };
    },
    predict: [
      { at: (t) => t.tag === 'enter', once: true, ask: 'How many values will move left?', options: (ts, i, ctx) => [...Array(ctx.input.values.length).keys()].map(String), answer: (ts, i, ctx) => String(ctx.input.values.length - 1 - ctx.input.pos), pick: 'option', explain: (ts, i, ctx) => 'Every value after index ' + ctx.input.pos + ': n - 1 - pos of them.' },
      { at: (t, i, ts) => t.tag === 'loop' && ts[i + 1] && ts[i + 1].tag === 'done' && t.data.n > 1, once: true, ask: (t) => 'When delete_at() returns, what will a[' + (t.data.n - 1) + '] hold?', options: (ts) => { const v = ts[0].data.a; const n = ts[0].data.n; return ['0', String(v[n - 1]), String(v[n - 2]), 'Nothing, it is erased']; }, answer: (ts) => String(ts[0].data.a[ts[0].data.n - 1]), pick: 'option', explain: (ts) => 'The old last value ' + ts[0].data.a[ts[0].data.n - 1] + ' was copied left but never cleared. Only n says it is no longer part of the array.' },
    ],
    quiz: [
      { q: 'What actually removes the deleted value from memory?', options: ['free()', 'Setting it to 0', 'It is overwritten by the value to its right', 'n - 1'], answer: 2, why: 'The first copy a[pos] = a[pos + 1] writes over it.' },
      { q: 'After deleting, the old last slot a[n - 1]...', options: ['Is zero', 'Still holds its old value, but is not counted', 'Is freed', 'Holds the deleted value'], answer: 1, why: 'Arrays are never "emptied". The count n decides which slots are data.' },
      { q: 'Why does this loop run left to right, unlike insertion?', options: ['It does not matter', 'Values move left, so each one goes into a slot that has already been copied on', 'Deletion is always at the front', 'To keep the array sorted'], answer: 1, why: 'The direction must follow the movement: left moves start at the left, right moves start at the right.' },
      { q: 'Deleting the first of n elements costs...', options: ['1 move', 'n - 1 moves', 'n² moves', 'No moves'], answer: 1, why: 'Every other element moves one place left.' },
      { q: 'If the order of the elements does not matter, how can a delete be done in one move?', options: ['It cannot', 'Copy the last element into the hole and decrease n', 'Set a[pos] to 0', 'Sort first'], answer: 1, why: 'a[pos] = a[n - 1]; n--; fills the hole without shifting anything.' },
    ],
    compareWith: 'arr-insert',
  });

  // ---- reverse in place ----------------------------------------------------------------------------------
  X.topic({
    id: 'arr-reverse', family: 'arr', order: 40, title: 'Reverse in place',
    blurb: 'Two indexes start at the two ends, swap their values through a temporary, and walk towards each other until they meet.',
    code: `/* reverse a[0..n-1] in place */
void reverse(int a[], int n)
{
    int i = 0;                 /*@ init-i */
    int j = n - 1;             /*@ init-j */
    int t;
    while (i < j) {            /*@ test */
        t = a[i];              /*@ hold */
        a[i] = a[j];           /*@ move-in */
        a[j] = t;              /*@ swap */
        i++;                   /*@ step-i */
        j--;                   /*@ step-j */
    }
}                              /*@ back */`,
    animate: ['reverse'],
    inputs: [valuesIn([1, 2, 3, 4, 5, 6, 7])],
    presets: [
      { label: 'Odd length', values: { values: [1, 2, 3, 4, 5, 6, 7] } },
      { label: 'Even length', values: { values: [10, 20, 30, 40, 50, 60] } },
      { label: 'Two', values: { values: [8, 3] } },
      { label: 'One', values: { values: [5] } },
      { label: 'Empty', values: { values: [] } },
    ],
    counters: ['swaps', 'writes'],
    main: (inp) => arrMain(inp.values, 'reverse(a, n);'),
    capture: (P) => ({ a: P.arr('a', CAP), i: S.local(P, 'i'), j: S.local(P, 'j'), t: S.local(P, 't') }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, n = ctx.input.values.length;
      const i = d.i, j = d.j;
      const mid = Math.max(n, 1) * PITCH / 2 - W / 2;
      const tPos = { x: mid, y: 170 };
      const view = S.cells(ctx, 'a', d.a, {
        pos,
        src: (k) => (tag === 'move-in' && k === i ? j : tag === 'swap' && k === j ? tPos : null),
        cls: (k) => {
          if (k >= n) return 'unused';
          if (tag === 'after' || tag === 'back') return 'done';
          if (i !== null && j !== null && (k < i || k > j)) return 'done';
          if (tag === 'move-in' && k === j) return 'stale';
          if ((k === i || k === j) && i !== null && j !== null && i < j) return 'focus';
          return '';
        },
      });
      const items = view.items.concat(walls(n, CAP));
      // the temporary: its own little box below the array
      const tv = S.cells(ctx, 't', [d.t], { pos: () => tPos, src: () => (tag === 'hold' ? { x: i * PITCH, y: 0 } : null), sub: () => 't', cls: () => (tag === 'hold' || tag === 'move-in' ? 'part-b' : 'ghost') });
      if (d.t !== null || tag === 'test') items.push(...tv.items);
      // the pair being exchanged, joined by an arc under the array
      if (i !== null && j !== null && i < j && tag !== 'step-i' && tag !== 'step-j') items.push({ key: 'pair', kind: 'arrow', from: { x: cx(i), y: W + 26 }, to: { x: cx(j), y: W + 26 }, bend: Math.min(60, 12 + (j - i) * 7), noHead: true, cls: 'hot' });
      if (i !== null) items.push(S.tag('ci', i < CAP && i >= 0 ? view.keyOf(i) : null, 'i', 'c-teal', 'above', 0));
      if (j !== null && j >= 0) items.push(S.tag('cj', view.keyOf(j), 'j', 'c-amber', 'above', i === j ? 1 : 0));
      else if (j !== null) items.push(S.tagAt('cj', cx(j), -6, 'j', 'c-amber', true));
      const sw = ctx.counters.swaps;
      let say = '';
      switch (tag) {
        case 'enter': say = 'reverse(a, ' + n + '): the first and last values trade places, then the second and second-to-last, and so on: ' + S.pl(Math.floor(n / 2), 'exchange') + ' in all.'; break;
        case 'init-i': say = 'i starts at the left end, index 0.'; break;
        case 'init-j': say = 'j starts at the right end, index n - 1 = ' + j + '.'; break;
        case 'test': say = i < j ? 'i = ' + i + ', j = ' + j + ': i < j, so a[' + i + '] = ' + d.a[i] + ' and a[' + j + '] = ' + d.a[j] + ' still have to trade places.' : i === j ? 'i = j = ' + i + ': they meet at the middle element, ' + d.a[i] + ', which is its own mirror image. It stays.' : 'i = ' + i + ' has passed j = ' + j + ': every pair has been exchanged.'; break;
        case 'hold': say = 't = a[' + i + ']: keep a copy of ' + d.t + ' first. The next line overwrites a[' + i + '], and without t that value would be gone.'; break;
        case 'move-in': say = 'a[' + i + '] = a[' + j + ']: ' + d.a[i] + ' arrives on the left. For a moment both slots hold ' + d.a[i] + '; the only other copy of ' + d.t + ' is in t.'; break;
        case 'swap': say = 'a[' + j + '] = t: ' + d.t + ' goes to the right end. The pair has traded places: ' + S.pl(sw, 'swap') + ' done.'; break;
        case 'step-i': say = 'i moves right to ' + i + '.'; break;
        case 'step-j': say = 'j moves left to ' + j + '. The green ends are finished and never touched again.'; break;
        case 'back': say = 'reverse() ends. It returns nothing: it changed the caller\'s array itself, through the address it was given.'; break;
        case 'after': say = 'Back in main: ' + list(d.a.slice(0, n)) + '. ' + S.pl(sw, 'swap') + ' for ' + S.pl(n, 'element') + ': each swap puts two values in their final place.'; break;
      }
      return { items, say };
    },
    predict: [
      { at: (t) => t.tag === 'hold', once: true, ask: 'a[i] = a[j] comes next. Where is the only safe copy of the old a[i] after that line?', options: () => ['In a[i]', 'In a[j]', 'In t', 'Nowhere'], answer: () => 'In t', pick: 'option', explain: () => 'a[i] is overwritten, and a[j] holds the other value. t was saved just for this.' },
      { at: (t, i, ts) => t.tag === 'init-j' && ts[0].data.a.filter((v, k) => k < 8).length && t.data.j > 0, once: true, ask: 'How many swaps will this reversal make?', options: (ts, i) => { const n = ts[i].data.j + 1; return [...new Set([Math.floor(n / 2), n, n - 1, Math.ceil(n / 2) + 1])].sort((a, b) => a - b).map(String); }, answer: (ts, i) => String(Math.floor((ts[i].data.j + 1) / 2)), pick: 'option', explain: () => 'One swap per pair: n / 2 rounded down. With an odd n the middle element stays.' },
    ],
    quiz: [
      { q: 'Why is the temporary t needed?', options: ['C has no swap', 'a[i] = a[j] overwrites the old a[i], which is still needed for a[j]', 'To count swaps', 'It is not needed'], answer: 1, why: 'Without a copy, both slots end up holding the old a[j].' },
      { q: 'What happens if the loop runs while i <= n - 1 instead of i < j?', options: ['The same result', 'Every pair is swapped twice and the array ends up as it started', 'It crashes', 'Only half is reversed'], answer: 1, why: 'After the middle, the indexes cross and swap the pairs back.' },
      { q: 'How many swaps does reversing 7 elements take?', options: ['7', '6', '3', '4'], answer: 2, why: 'Three pairs; the middle element stays where it is.' },
      { q: 'How much extra memory does this reversal use?', options: ['A second array of n', 'One int (t) and two indexes', 'n / 2 ints', 'None at all'], answer: 1, why: 'It works in place: the only extra storage is t, i and j.' },
    ],
  });

  // ---- rotate by three reversals -------------------------------------------------------------------------
  X.topic({
    id: 'arr-rotate', family: 'arr', order: 50, title: 'Rotate left (three reversals)',
    blurb: 'Rotating left by k: reverse the first k, reverse the rest, then reverse the whole array. Three reversals, no extra array.',
    code: `/* exchange two ints through their addresses */
void swap(int *x, int *y)
{
    int t = *x;
    *x = *y;
    *y = t;
}

/* reverse a[lo..hi] */
void reverse(int a[], int lo, int hi)
{
    while (lo < hi) {              /*@ test */
        swap(&a[lo], &a[hi]);      /*@ swap */
        lo++;                      /*@ step-lo */
        hi--;                      /*@ step-hi */
    }
}                                  /*@ back */

/* move every element k places to the left; the first k wrap round to the end */
void rotate_left(int a[], int n, int k)
{
    k = k % n;                     /*@ mod */
    reverse(a, 0, k - 1);          /*@ rev1 */
    reverse(a, k, n - 1);          /*@ rev2 */
    reverse(a, 0, n - 1);          /*@ rev3 */
}                                  /*@ done */`,
    animate: ['rotate_left', 'reverse'], quiet: ['swap'],
    inputs: [valuesIn([1, 2, 3, 4, 5, 6, 7], 1), { id: 'k', kind: 'int', label: 'Rotate left by k', def: 3, lo: 0, hi: 20 }],
    presets: [
      { label: 'k = 3 of 7', values: { values: [1, 2, 3, 4, 5, 6, 7], k: 3 } },
      { label: 'k = 1', values: { values: [10, 20, 30, 40, 50, 60], k: 1 } },
      { label: 'k bigger than n', values: { values: [1, 2, 3, 4, 5], k: 7 } },
      { label: 'k = n (no change)', values: { values: [4, 8, 15, 16], k: 4 } },
    ],
    counters: ['swaps'],
    main: (inp) => arrMain(inp.values, 'rotate_left(a, n, ' + inp.k + ');'),
    capture: (P) => ({ a: P.arr('a', CAP), lo: S.local(P, 'lo'), hi: S.local(P, 'hi'), k: P.has('k') ? P.val('k') : null, fn: P.frames[0].name }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const n = inp.values.length, k = inp.k % n;
      // which reversal is running: count the calls seen so far
      const calls = ctx.ticks.slice(0, ctx.i + 1).filter((t) => /^rev\d$/.test(t.tag)).length;
      const ranges = [[0, k - 1], [k, n - 1], [0, n - 1]];
      const inRev = d.fn === 'reverse' && tag !== 'back';
      const view = S.cells(ctx, 'a', d.a.slice(0, n), {
        pos, arc: 50,
        cls: (i, v) => {
          if (i >= n) return 'unused';
          // colour by where the value started: the first k (block A) or the rest (block B)
          const orig = inp.values.indexOf(v);
          const blk = orig >= 0 && orig < k ? 'blk-a' : 'blk-b';
          if (inRev && d.lo !== null && d.lo < d.hi && (i === d.lo || i === d.hi)) return blk + ' focus';
          return blk;
        },
      });
      const items = view.items.slice();
      // the goal: what the array must look like at the end, faint, above
      const goal = inp.values.slice(k).concat(inp.values.slice(0, k));
      items.push(lbl('goal-l', -14, -140 + W / 2 + 5, 'goal'));
      goal.forEach((v, i) => items.push({ key: 'goal' + i, kind: 'cell', x: i * PITCH, y: -140, w: W, h: W * 0.7, text: v, sub: '', cls: 'stale small' + (tag === 'after' || tag === 'done' ? ' part-a' : '') }));
      // the three steps, listed on the right
      const sx = 0;
      ['1. reverse(a, 0, k - 1)', '2. reverse(a, k, n - 1)', '3. reverse(a, 0, n - 1)'].forEach((s, q) => {
        const r = ranges[q];
        const done = calls > q + 1 || (calls === q + 1 && (tag === 'back' && d.fn !== 'reverse')) || tag === 'done' || tag === 'after';
        const now = calls === q + 1 && !done;
        items.push({ key: 'st' + q, kind: 'text', x: sx, y: W + 110 + q * 26, text: s.replace('k - 1', String(k - 1)).replace('k, n - 1', k + ', ' + (n - 1)).replace('0, n - 1', '0, ' + (n - 1)) + (r[0] > r[1] ? '  (empty)' : ''), cls: now ? 'code-text step-now' : done ? 'code-text step-done' : 'code-text step-later' });
      });
      // the bracket over the range being reversed
      if (calls && tag !== 'done' && tag !== 'after' && !(tag === 'back' && d.fn !== 'reverse' && calls === 3)) {
        const [lo, hi] = ranges[calls - 1];
        if (lo <= hi) items.push(...S.bracket('brk', lo * PITCH - 4, hi * PITCH + W + 4, -26, 'reverse a[' + lo + '..' + hi + ']', 'hot'));
      }
      if (inRev && d.lo !== null && d.lo <= d.hi + 1) {
        if (d.lo < n) items.push(S.tag('clo', view.keyOf(Math.min(d.lo, n - 1)), 'lo', 'c-indigo', 'below', 0));
        if (d.hi >= 0) items.push(S.tag('chi', view.keyOf(Math.max(d.hi, 0)), 'hi', 'c-violet', 'below', d.lo === d.hi || d.lo > d.hi ? 1 : 0));
      }
      // the two blocks, named once at the start
      if (calls === 0 && k > 0) {
        items.push(...S.bracket('ba', -4, (k - 1) * PITCH + W + 4, W + 40, 'A: the first ' + k, 'c-teal', true));
        if (k < n) items.push(...S.bracket('bb', k * PITCH - 4, (n - 1) * PITCH + W + 4, W + 40, 'B: the other ' + (n - k), 'c-amber', true));
      }
      const r = calls ? ranges[calls - 1] : null;
      let say = '';
      switch (tag) {
        case 'enter': say = 'rotate_left(a, ' + n + ', ' + inp.k + '): every value moves ' + inp.k + ' places left, and the ones pushed off the front come back at the end. The goal is shown faintly above.'; break;
        case 'mod': say = inp.k === k ? 'k % n = ' + k + '. Block A is the first ' + k + ' values (teal), block B the other ' + (n - k) + ' (amber). Rotating means B then A.' : 'k % n = ' + inp.k + ' % ' + n + ' = ' + k + ': rotating by ' + n + ' brings everything back to where it was, so only ' + k + ' places matter.'; break;
        case 'rev1': case 'rev2': case 'rev3': say = 'Step ' + calls + ': reverse a[' + r[0] + '..' + r[1] + ']' + (r[0] >= r[1] ? ', ' + (r[0] > r[1] ? 'an empty range' : 'one element') + ': nothing to do.' : calls === 1 ? ', block A on its own.' : calls === 2 ? ', block B on its own.' : ', the whole array. This puts B before A, and turns each block the right way round again.'); break;
        case 'test': say = d.lo < d.hi ? 'lo = ' + d.lo + ', hi = ' + d.hi + ': a[' + d.lo + '] = ' + d.a[d.lo] + ' and a[' + d.hi + '] = ' + d.a[d.hi] + ' trade places.' : 'lo and hi have met: this range is reversed.'; break;
        case 'swap': say = 'Swap: ' + d.a[d.hi] + ' and ' + d.a[d.lo] + ' cross over.'; break;
        case 'step-lo': say = 'lo moves right to ' + d.lo + '.'; break;
        case 'step-hi': say = 'hi moves left to ' + d.hi + '.'; break;
        case 'back': say = 'Reversal ' + calls + ' is finished: ' + list(d.a.slice(0, n)) + '.' + (calls === 1 ? ' Block A is now backwards.' : calls === 2 ? ' Both blocks are backwards, each in its own place.' : ''); break;
        case 'done': say = 'rotate_left() is finished: three reversals, each one a walk of two indexes towards each other.'; break;
        case 'after': say = 'Rotated: ' + list(d.a.slice(0, n)) + ', exactly the goal. ' + S.pl(ctx.counters.swaps, 'swap') + ', and not a single extra array.'; break;
      }
      return { items, say, slow: tag === 'back' && calls === 3 };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'back' && ts.slice(0, i + 1).filter((x) => /^rev\d$/.test(x.tag)).length === 2, once: true, ask: 'Both blocks are now backwards, each in its own place. What will reversing the whole array give?', options: (ts, i, ctx) => { const a = ts[i].data.a.slice(0, ctx.input.values.length); const k = ctx.input.k % a.length; const g = ctx.input.values.slice(k).concat(ctx.input.values.slice(0, k)); return [...new Set([g.join(' '), a.slice().reverse().reverse().join(' '), ctx.input.values.join(' ')])]; }, answer: (ts, i, ctx) => { const k = ctx.input.k % ctx.input.values.length; return ctx.input.values.slice(k).concat(ctx.input.values.slice(0, k)).join(' '); }, pick: 'option', explain: () => 'Reversing the whole thing puts B in front of A and turns each block the right way round again.' },
      { at: (t) => t.tag === 'mod', once: true, ask: 'After all three reversals, which value will be at index 0?', options: (ts, i, ctx) => [...new Set(ctx.input.values.map(String))], answer: (ts, i, ctx) => String(ctx.input.values[ctx.input.k % ctx.input.values.length]), pick: 'option', explain: (ts, i, ctx) => 'Rotating left by ' + (ctx.input.k % ctx.input.values.length) + ' brings a[' + (ctx.input.k % ctx.input.values.length) + '] to the front.' },
    ],
    quiz: [
      { q: 'Rotating 1 2 3 4 5 left by 2 gives...', options: ['4 5 1 2 3', '3 4 5 1 2', '2 1 5 4 3', '5 4 3 2 1'], answer: 1, why: 'The first two (1 2) move to the end: 3 4 5 1 2.' },
      { q: 'Why does reversing the whole array at the end work?', options: ['It sorts the array', 'It puts block B before block A and turns each block the right way round', 'It undoes the first two steps', 'It is only needed when k is odd'], answer: 1, why: 'Reverse(A) reverse(B), reversed as a whole, is B followed by A, each in its original order.' },
      { q: 'How many element moves does the three-reversal rotation make for n elements?', options: ['About n (each value is swapped about twice)', 'k × n', 'n²', 'k'], answer: 0, why: 'Each reversal of m elements does m / 2 swaps; in total about n swaps, so O(n) time with O(1) extra memory.' },
      { q: 'Why is k replaced by k % n first?', options: ['To avoid negative numbers', 'Rotating by n changes nothing, so only the remainder matters (and the ranges stay inside the array)', 'To make k even', 'The compiler needs it'], answer: 1, why: 'Rotating by 7 in an array of 5 is the same as rotating by 2.' },
    ],
  });

  // ---- merge two sorted arrays -----------------------------------------------------------------------------
  const ROW_A = 0, ROW_B = 120, ROW_C = 290;
  X.topic({
    id: 'arr-merge', family: 'arr', order: 60, title: 'Merge two sorted arrays',
    blurb: 'Two read cursors, one in each sorted input, and one write cursor in the output. The smaller of the two front values is copied each time.',
    code: `/* merge sorted a[0..na-1] and b[0..nb-1] into c; returns the count */
int merge(const int a[], int na, const int b[], int nb, int c[])
{
    int i = 0, j = 0, k = 0;          /*@ init */
    while (i < na && j < nb) {        /*@ test */
        if (a[i] <= b[j])             /*@ compare */
            c[k++] = a[i++];          /*@ copy-a */
        else
            c[k++] = b[j++];          /*@ copy-b */
    }
    while (i < na)                    /*@ test-a */
        c[k++] = a[i++];              /*@ copy-rest-a */
    while (j < nb)                    /*@ test-b */
        c[k++] = b[j++];              /*@ copy-rest-b */
    return k;                         /*@ done */
}`,
    animate: ['merge'],
    inputs: [
      { id: 'a', kind: 'ints', label: 'Sorted array a', def: [3, 9, 14, 20], min: 0, max: 6, sorted: true },
      { id: 'b', kind: 'ints', label: 'Sorted array b', def: [5, 6, 15, 27, 31], min: 0, max: 6, sorted: true },
    ],
    check: (inp) => (!inp.a.length && !inp.b.length ? 'Give at least one value in a or b' : null),
    presets: [
      { label: 'Interleaved', values: { a: [3, 9, 14, 20], b: [5, 6, 15, 27, 31] } },
      { label: 'All of a first', values: { a: [1, 2, 3], b: [10, 20, 30, 40] } },
      { label: 'Equal values', values: { a: [2, 4, 4, 8], b: [4, 4, 6] } },
      { label: 'One side empty', values: { a: [], b: [7, 8, 9] } },
    ],
    counters: ['compares', 'moves'],
    main: (inp) => `int main(void)
{
    int a[] = { ${inp.a.length ? inp.a.join(', ') : '0'} };
    int b[] = { ${inp.b.length ? inp.b.join(', ') : '0'} };
    int c[${inp.a.length + inp.b.length}];
    int na = ${inp.a.length}, nb = ${inp.b.length};
    int nc = merge(a, na, b, nb, c);
    printf("%d values merged\\n", nc);
    return 0;
}`,
    capture: (P) => {
      const na = P.val('na'), nb = P.val('nb');
      return { a: P.arr('a', na), b: P.arr('b', nb), c: P.arr('c', na + nb), i: S.local(P, 'i'), j: S.local(P, 'j'), k: S.local(P, 'k') };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const na = inp.a.length, nb = inp.b.length;
      const memo = ctx.memo;
      if (d.i !== null) { memo.i = d.i; memo.j = d.j; memo.k = d.k; }
      const i = d.i === null ? memo.i : d.i, j = d.i === null ? memo.j : d.j, k = d.i === null ? memo.k : d.k;
      const rowA = S.row(0, ROW_A), rowB = S.row(0, ROW_B), rowC = S.row(0, ROW_C);
      const fromA = /copy(-rest)?-a/.test(tag), fromB = /copy(-rest)?-b/.test(tag);
      const items = [];
      const va = S.cells(ctx, 'a', d.a, { pos: rowA, cls: (q) => (i !== undefined && q < i ? 'used' : q === i && tag === 'compare' ? 'focus' : 'blk-a'), hotWrites: false });
      const vb = S.cells(ctx, 'b', d.b, { pos: rowB, cls: (q) => (j !== undefined && q < j ? 'used' : q === j && tag === 'compare' ? 'focus' : 'blk-b'), hotWrites: false });
      const vc = S.cells(ctx, 'c', d.c, {
        pos: rowC,
        src: (q) => (fromA ? rowA(i - 1) : fromB ? rowB(j - 1) : null),
        cls: (q, v) => (v === null ? '' : cOrigin(ctx, q) === 'a' ? 'blk-a' : 'blk-b'),
      });
      items.push(...va.items, ...vb.items, ...vc.items);
      items.push({ key: 'la', kind: 'text', x: -16, y: ROW_A + W / 2 + 6, text: 'a', cls: 'code-text', anchor: 'end' });
      items.push({ key: 'lb', kind: 'text', x: -16, y: ROW_B + W / 2 + 6, text: 'b', cls: 'code-text', anchor: 'end' });
      items.push({ key: 'lc', kind: 'text', x: -16, y: ROW_C + W / 2 + 6, text: 'c', cls: 'code-text', anchor: 'end' });
      if (!na) items.push({ key: 'ea', kind: 'text', x: 0, y: ROW_A + W / 2 + 6, text: '(empty)', cls: 'idx' });
      if (!nb) items.push({ key: 'eb', kind: 'text', x: 0, y: ROW_B + W / 2 + 6, text: '(empty)', cls: 'idx' });
      // read cursors over a and b, the write cursor under c
      if (i !== undefined) {
        items.push(i < na ? S.tag('ci', va.keyOf(i), 'i', 'c-teal', 'above') : S.tagAt('ci', na * PITCH + W / 2, ROW_A - 4, 'i', 'c-teal', true));
        items.push(j < nb ? S.tag('cj', vb.keyOf(j), 'j', 'c-amber', 'below') : S.tagAt('cj', nb * PITCH + W / 2, ROW_B + W + 4, 'j', 'c-amber'));
        if (k < na + nb) items.push(S.tag('ck', vc.keyOf(k), 'k', 'c-green', 'below'));
        else items.push(S.tagAt('ck', k * PITCH + W / 2, ROW_C + W + 18, 'k', 'c-green'));
        if (i >= na && tag !== 'done' && tag !== 'after') items.push({ key: 'xa', kind: 'text', x: na * PITCH + 40, y: ROW_A + W / 2 + 6, text: 'a used up', cls: 'idx' });
        if (j >= nb && tag !== 'done' && tag !== 'after') items.push({ key: 'xb', kind: 'text', x: nb * PITCH + 40, y: ROW_B + W / 2 + 6, text: 'b used up', cls: 'idx' });
      }
      if (tag === 'compare') {
        const left = d.a[i] <= d.b[j];
        items.push({ key: 'cmp', kind: 'line', x1: cx(i), y1: ROW_A + W + 4, x2: cx(j), y2: ROW_B - 4, cls: 'hot' });
        items.push({ key: 'cmp-t', kind: 'text', x: Math.max(na, nb) * PITCH + 40, y: ROW_B - 30, text: d.a[i] + (left ? ' ≤ ' : ' > ') + d.b[j] + ': take from ' + (left ? 'a' : 'b'), cls: 'hot' });
      }
      let say = '';
      const last = (fromA ? d.a[i - 1] : fromB ? d.b[j - 1] : null);
      switch (tag) {
        case 'enter': say = 'merge(): a has ' + S.pl(na, 'value') + ' and b has ' + S.pl(nb, 'value') + ', each already sorted. c has room for all ' + (na + nb) + '.'; break;
        case 'init': say = 'i reads a, j reads b, k writes c. All three start at 0.'; break;
        case 'test': say = i < na && j < nb ? 'Both inputs still have values: a[' + i + '] = ' + d.a[i] + ' and b[' + j + '] = ' + d.b[j] + ' are the smallest left in each.' : (i >= na ? 'a is used up' : 'b is used up') + ', so the main loop ends.'; break;
        case 'compare': say = 'Is a[' + i + '] = ' + d.a[i] + ' ≤ b[' + j + '] = ' + d.b[j] + '? ' + (d.a[i] <= d.b[j] ? 'Yes: ' + d.a[i] + ' is the smallest value left anywhere.' : 'No: ' + d.b[j] + ' is the smallest value left anywhere.') + (d.a[i] === d.b[j] ? ' On a tie, a goes first, which keeps the merge stable.' : ''); break;
        case 'copy-a': case 'copy-b': say = 'c[' + (k - 1) + '] = ' + last + ', copied from ' + (fromA ? 'a[' + (i - 1) + ']' : 'b[' + (j - 1) + ']') + '. ' + (fromA ? 'i' : 'j') + ' and k both move on by one.'; break;
        case 'test-a': say = i < na ? 'a still has ' + S.pl(na - i, 'value') + ' left. They are all bigger than everything in c, so they are copied as they are.' : 'Nothing left in a.'; break;
        case 'test-b': say = j < nb ? 'b still has ' + S.pl(nb - j, 'value') + ' left, copied straight across.' : 'Nothing left in b.'; break;
        case 'copy-rest-a': case 'copy-rest-b': say = 'c[' + (k - 1) + '] = ' + last + ', with no comparison needed: the other array is used up.'; break;
        case 'done': say = 'merge() returns k = ' + k + '. Every value was copied exactly once, after at most ' + (na + nb - 1 < 0 ? 0 : na + nb - 1) + ' comparisons.'; break;
        case 'after': say = 'c = ' + list(d.c) + ': sorted, in ' + ctx.counters.compares + ' comparisons and ' + ctx.counters.moves + ' copies.'; break;
      }
      return { items, say };
    },
    predict: [
      { at: (t) => t.tag === 'test' && t.data.i < t.data.a.length && t.data.j < t.data.b.length, once: true, ask: 'Click the value that will be copied into c next.', answer: (ts, i) => { const d = ts[i].data; return d.a[d.i] <= d.b[d.j] ? 'ea' + d.i : 'eb' + d.j; }, explain: () => 'The smaller of the two front values: a[i] on a tie.' },
      { at: (t, i, ts) => (t.tag === 'test') && ts[i + 1] && ts[i + 1].tag === 'test-a', once: true, ask: 'One input is used up. How many more values will be copied without any comparison?', options: (ts, i) => { const d = ts[i].data; const r = d.a.length - d.i + d.b.length - d.j; return [...new Set([0, 1, r, r + 1])].sort((x, y) => x - y).map(String); }, answer: (ts, i) => { const d = ts[i].data; return String(d.a.length - d.i + d.b.length - d.j); }, pick: 'option', explain: () => 'Everything left in the other array: it is sorted and bigger than all of c so far.' },
    ],
    quiz: [
      { q: 'How many comparisons does merging na and nb values take at most?', options: ['na × nb', 'na + nb - 1', 'log(na + nb)', 'na'], answer: 1, why: 'Each comparison copies one value, and the last value is always copied without one.' },
      { q: 'Why does the test use a[i] <= b[j] and not a[i] < b[j]?', options: ['It is faster', 'On a tie the value from a goes first, keeping equal values in their original order (stable)', 'To avoid an infinite loop', 'It makes no difference at all'], answer: 1, why: 'Stability matters when the values carry other data: merge sort relies on it.' },
      { q: 'When a is used up, why can the rest of b be copied without comparing?', options: ['b is sorted and all its remaining values are at least as big as anything in c', 'b is shorter', 'Comparisons are not allowed', 'They are copied backwards'], answer: 0, why: 'The remaining values of b come straight after everything already merged.' },
      { q: 'What does merge need that sorting in place does not?', options: ['A third array c for the output', 'Recursion', 'A hash table', 'Nothing'], answer: 0, why: 'This merge writes into a separate array of na + nb slots.' },
    ],
  });
  /** Where the value now in c[q] came from, by replaying the copies */
  function cOrigin(ctx, q) {
    let n = 0;
    for (let t = 0; t <= ctx.i; t++) {
      const tg = ctx.ticks[t].tag;
      if (/^copy/.test(tg)) { if (n === q) return /-a$/.test(tg) ? 'a' : 'b'; n++; }
    }
    return 'a';
  }
})(SEE);
