// Two pointers and sliding windows: the family, pair sum in a sorted array, removing duplicates in place,
// the best fixed-size window and the shortest window reaching a target.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, S = X.StripKit;
  const W = S.CELL, PITCH = S.CELL + S.GAP;
  const pos = S.row(0, 0);
  const cx = (i) => i * PITCH + W / 2;
  const local = S.local;
  const list = (a) => (a.length ? a.join(' ') : 'nothing');

  X.family({
    id: 'window', order: 4, group: 'Arrays', title: 'Two pointers and sliding windows',
    blurb: 'Two indexes that only ever move forwards (or towards each other) can do in one pass what nested loops do in n². The trick is knowing which one to move.',
    head: '#include <stdio.h>',
  });
  const winMain = (vals, decl, call) => `int main(void)
{
    int a[] = { ${vals.length ? vals.join(', ') : '0'} };
    int n = ${vals.length};
${decl ? '    ' + decl + '\n' : ''}    ${call}
    return 0;
}`;

  // ---- pair sum in a sorted array ---------------------------------------------------------------------------
  X.topic({
    id: 'two-sum-sorted', family: 'window', order: 10, title: 'Pair with a given sum (sorted)',
    blurb: 'i starts at the smallest value, j at the largest. Too small a sum moves i up, too big moves j down: every step rules out a whole row or column of pairs.',
    code: `/* find i < j with a[i] + a[j] == target in sorted a;
   returns 1 and stores the indexes if there is such a pair */
int two_sum(const int a[], int n, int target, int *pi, int *pj)
{
    int i = 0, j = n - 1;                /*@ init */
    while (i < j) {                      /*@ test */
        int s = a[i] + a[j];             /*@ sum */
        if (s == target) {               /*@ compare */
            *pi = i;                     /*@ found-i */
            *pj = j;                     /*@ found-j */
            return 1;                    /*@ found */
        }
        if (s < target)                  /*@ compare-small */
            i++;                         /*@ step-i */
        else
            j--;                         /*@ step-j */
    }
    return 0;                            /*@ none */
}`,
    animate: ['two_sum'],
    inputs: [{ id: 'values', kind: 'ints', label: 'Sorted array', def: [1, 3, 4, 6, 8, 11, 13, 15], min: 1, max: 10, sorted: true }, { id: 'target', kind: 'int', label: 'Target sum', def: 17, lo: -999, hi: 999 }],
    presets: [
      { label: 'Found in the middle', values: { values: [1, 3, 4, 6, 8, 11, 13, 15], target: 17 } },
      { label: 'Found at the ends', values: { values: [2, 5, 7, 9, 12], target: 14 } },
      { label: 'No such pair', values: { values: [1, 2, 4, 7, 11, 16], target: 10 } },
      { label: 'Equal values', values: { values: [3, 3, 5, 5, 9], target: 10 } },
    ],
    counters: ['compares', 'follows'],
    main: (inp) => winMain(inp.values, 'int i, j;', 'if (two_sum(a, n, ' + inp.target + ', &i, &j))\n        printf("a[%d] + a[%d] = %d\\n", i, j, ' + inp.target + ');\n    else\n        printf("no pair\\n");'),
    capture: (P) => {
      const inFn = P.frames[0].name === 'two_sum';
      return { a: P.arr('a', P.val('n')), i: inFn ? local(P, 'i') : null, j: inFn ? local(P, 'j') : null, s: inFn ? local(P, 's') : null };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, T = inp.target;
      const a = inp.values, n = a.length;
      const memo = ctx.memo;
      if (d.i !== null) { memo.i = d.i; memo.j = d.j; }
      const i = d.i === null ? memo.i : d.i, j = d.i === null ? memo.j : d.j;
      const found = ctx.ticks.some((t, k) => k <= ctx.i && t.tag === 'found');
      const view = S.cells(ctx, 'a', d.a, { pos, hotWrites: false, cls: (k) => (found && (k === i || k === j) ? 'done' : i !== undefined && (k < i || k > j) ? 'used' : k === i || k === j ? 'focus' : '') });
      const items = view.items.slice();
      if (i !== undefined) {
        if (i < n) items.push(S.tag('ci', view.keyOf(i), 'i', 'c-teal', 'below', i === j ? 1 : 0));
        if (j >= 0) items.push(S.tag('cj', view.keyOf(j), 'j', 'c-amber', 'below'));
      }
      // the sum against the target
      const s = i !== undefined && i < j ? a[i] + a[j] : null;
      const verdict = s === null ? '' : s === T ? '= ' + T + ': found' : s < T ? '< ' + T + ': move i right' : '> ' + T + ': move j left';
      if (s !== null && tag !== 'init') items.push({ key: 'sum', kind: 'text', x: n * PITCH + 24, y: W / 2 + 6, text: a[i] + ' + ' + a[j] + ' = ' + s + ' ' + verdict, cls: s === T ? 'good' : 'code-text step-now' });
      items.push({ key: 'tg', kind: 'text', x: n * PITCH + 24, y: W / 2 - 22, text: 'target ' + T, cls: 'mono muted' });
      // every pair (r, c) with r < c: the ones ruled out are greyed
      const G = 30, gp = 32, gx = 30, gy = 200;
      items.push({ key: 'gt', kind: 'text', x: 0, y: gy - 34, text: 'all pairs a[r] + a[c] (r < c): row r, column c', cls: 'idx' });
      for (let c = 1; c < n; c++) items.push({ key: 'gc' + c, kind: 'text', x: gx + (c - 1) * gp + G / 2, y: gy - 8, text: String(a[c]), cls: 'idx', anchor: 'middle' });
      for (let r = 0; r < n - 1; r++) {
        items.push({ key: 'gr' + r, kind: 'text', x: gx - 12, y: gy + r * gp + G / 2 + 5, text: String(a[r]), cls: 'idx', anchor: 'middle' });
        for (let c = r + 1; c < n; c++) {
          const out = i !== undefined && (r < i || c > j);
          const now = i !== undefined && r === i && c === j;
          items.push({ key: 'p' + r + '-' + c, kind: 'cell', x: gx + (c - 1) * gp, y: gy + r * gp, w: G, h: G, text: a[r] + a[c], sub: '', cls: 'tiny ' + (now ? (found ? 'done' : 'lit') : out ? 'out' : a[r] + a[c] === T ? 'part-a' : '') });
        }
      }
      const left = i !== undefined ? Math.max(0, (j - i) * (j - i + 1) / 2) : n * (n - 1) / 2;
      let say = '';
      switch (tag) {
        case 'enter': say = 'two_sum(target ' + T + '): ' + n * (n - 1) / 2 + ' pairs in all (the grid). Checking them all would take nested loops; two pointers will need at most ' + Math.max(0, n - 1) + ' steps.'; break;
        case 'init': say = 'i = 0 at the smallest value (' + a[0] + '), j = ' + (n - 1) + ' at the largest (' + a[n - 1] + ').'; break;
        case 'test': say = i < j ? 'i < j: ' + S.pl(left, 'pair') + ' still possible, the bright part of the grid.' : 'i and j have met: every pair has been ruled out.'; break;
        case 'sum': say = 's = a[' + i + '] + a[' + j + '] = ' + a[i] + ' + ' + a[j] + ' = ' + s + '.'; break;
        case 'compare': say = s === T ? s + ' is the target.' : s + ' is not ' + T + '.'; break;
        case 'compare-small': say = s < T ? s + ' < ' + T + '. Even with the biggest value left, a[' + i + '] = ' + a[i] + ' is too small, so no pair with it can work: its whole row goes.' : s + ' > ' + T + '. Even with the smallest value left, a[' + j + '] = ' + a[j] + ' is too big, so its whole column goes.'; break;
        case 'step-i': say = 'i moves right to ' + i + ' (value ' + a[i] + ').'; break;
        case 'step-j': say = 'j moves left to ' + j + ' (value ' + a[j] + ').'; break;
        case 'found-i': case 'found-j': say = 'Store the index ' + (tag === 'found-i' ? 'i = ' + i : 'j = ' + j) + ' for the caller.'; break;
        case 'found': say = 'Found: a[' + i + '] + a[' + j + '] = ' + a[i] + ' + ' + a[j] + ' = ' + T + ', after ' + S.pl(ctx.counters.follows, 'pointer move') + '.'; break;
        case 'none': say = 'No pair adds up to ' + T + '. Every pair was ruled out without being looked at one by one.'; break;
        case 'after': say = (found ? 'main prints the pair a[' + i + '] + a[' + j + ']' : 'main prints "no pair"') + '. ' + S.pl(ctx.counters.compares, 'comparison') + ' instead of up to ' + n * (n - 1) / 2 + ' with nested loops.'; break;
      }
      return { items, say };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'compare' && ts[i + 1] && ts[i + 1].tag === 'compare-small', once: true, ask: (t, ts, i, ctx) => 'The sum is ' + t.data.s + ' and the target ' + ctx.input.target + '. Which pointer moves?', options: () => ['i moves right', 'j moves left'], answer: (ts, i, ctx) => (ts[i].data.s < ctx.input.target ? 'i moves right' : 'j moves left'), pick: 'option', explain: (ts, i, ctx) => (ts[i].data.s < ctx.input.target ? 'Too small: only a bigger left value can help.' : 'Too big: only a smaller right value can help.') },
      { at: (t) => t.tag === 'init', once: true, ask: (t, ts, i, ctx) => 'Is there a pair adding up to ' + ctx.input.target + '?', options: () => ['Yes', 'No'], answer: (ts) => (ts.some((t) => t.tag === 'found') ? 'Yes' : 'No'), pick: 'option', explain: () => 'Look for the target among the sums in the grid.' },
    ],
    quiz: [
      { q: 'Why does a sum that is too small move i and not j?', options: ['i is smaller', 'a[i] paired with the largest value left is still too small, so a[i] can be ruled out', 'j cannot move', 'By convention'], answer: 1, why: 'Moving j left would only make the sum smaller still.' },
      { q: 'How many steps does the two-pointer search take at most for n elements?', options: ['n²', 'n - 1', 'log n', 'n² / 2'], answer: 1, why: 'Each step moves one pointer one place closer to the other.' },
      { q: 'What does the method need from the array?', options: ['Nothing', 'That it is sorted', 'That it has no negatives', 'An even length'], answer: 1, why: 'The reasoning "too small, so this value can never work" relies on the order.' },
      { q: 'Each step rules out how many pairs at once?', options: ['One', 'A whole row or column of the pair grid', 'Half of them', 'None'], answer: 1, why: 'All pairs with that value and anything still between the pointers are impossible.' },
    ],
  });

  // ---- remove duplicates in place ---------------------------------------------------------------------------
  X.topic({
    id: 'dedup-sorted', family: 'window', order: 20, title: 'Remove duplicates in place',
    blurb: 'A fast read index r looks at every element; a slow write index w marks the end of the kept part. A value is copied down only if it differs from the last one kept.',
    code: `/* remove repeated values from sorted a, in place; returns the new count */
int dedup(int a[], int n)
{
    int w, r;
    if (n == 0)                       /*@ empty-test */
        return 0;                     /*@ empty */
    w = 1;                            /*@ init-w */
    for (r = 1; r < n; r++)           /*@ step-r */
        if (a[r] != a[w - 1])         /*@ compare */
            a[w++] = a[r];            /*@ copy */
    return w;                         /*@ done */
}`,
    animate: ['dedup'],
    inputs: [{ id: 'values', kind: 'ints', label: 'Sorted array', def: [1, 1, 2, 3, 3, 3, 5, 8, 8], min: 0, max: 10, sorted: true }],
    presets: [
      { label: 'Some runs', values: { values: [1, 1, 2, 3, 3, 3, 5, 8, 8] } },
      { label: 'No duplicates', values: { values: [2, 4, 6, 8, 10] } },
      { label: 'All the same', values: { values: [7, 7, 7, 7, 7, 7] } },
      { label: 'Empty', values: { values: [] } },
    ],
    counters: ['compares', 'moves'],
    main: (inp) => winMain(inp.values, '', 'n = dedup(a, n);'),
    capture: (P) => {
      const v = P.find('a');
      const base = SEE.Types.unqual(v.type).k === 'ptr' ? P.val('a') : v.addr;
      return { all: S.ints(P, base, 10), w: local(P, 'w'), r: local(P, 'r'), n: P.val('n') };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const n = inp.values.length;
      d.a = d.all.slice(0, n);
      const memo = ctx.memo;
      if (d.w !== null) memo.w = d.w;
      const w = d.w === null ? memo.w : d.w, r = d.r;
      // which elements were found to be repeats
      memo.dups = memo.dups || new Set();
      if (tag === 'compare' && ctx.ticks[ctx.i + 1] && ctx.ticks[ctx.i + 1].tag !== 'copy') memo.dups.add(r);
      const after = tag === 'done' || tag === 'after';
      const view = S.cells(ctx, 'a', n ? d.a : [], {
        pos,
        src: (k) => (tag === 'copy' && k === w - 1 ? r : null),
        cls: (k) => (w !== undefined && k < w ? 'part-a' : after ? 'stale' : r !== null && k === r ? 'focus' : memo.dups.has(k) && (r === null || k < r) ? 'used' : ''),
      });
      const items = view.items.slice();
      if (w !== undefined && n) {
        items.push({ key: 'kept', kind: 'region', x: -6, y: -6, w: w * PITCH + 4, h: W + 12, cls: 'kept' });
        items.push({ key: 'kept-t', kind: 'text', x: 0, y: -16, text: 'kept: ' + S.pl(w, 'value'), cls: 'c-green' });
        if (w < n) items.push(after ? S.tagAt('cw', w * PITCH + W / 2, -14, 'w = ' + w, 'c-green', true) : S.tag('cw', view.keyOf(w), 'w', 'c-green', 'above'));
        else items.push(S.tagAt('cw', w * PITCH + W / 2, -14, 'w', 'c-green', true));
        if (after) items.push(...S.wall('w-new', w * PITCH - S.GAP / 2, -10, w * PITCH - S.GAP / 2, W + 10, 'new n = ' + w, 'c-indigo', { x: w * PITCH - S.GAP / 2, y: W + 34 }));
      }
      if (r !== null && r < n && !after) items.push(S.tag('cr', view.keyOf(r), 'r', 'c-teal', 'below'));
      else if (r !== null && !after) items.push(S.tagAt('cr', r * PITCH + W / 2, W + 20, 'r', 'c-teal'));
      for (const k of memo.dups) if (!after && k < n && k >= w && (r === null || k <= r)) items.push({ key: 'dup' + k, kind: 'text', x: cx(k), y: W + 64, text: 'repeat', cls: 'bad', anchor: 'middle' });
      if (tag === 'compare' && r < n) {
        items.push({ key: 'cmp', kind: 'arrow', from: { x: cx(r), y: -4 }, to: { x: cx(w - 1), y: -4 }, bend: 26 + 6 * (r - w), cls: d.a[r] === d.a[w - 1] ? 'bad' : 'hot', label: d.a[r] === d.a[w - 1] ? d.a[r] + ' = ' + d.a[w - 1] : d.a[r] + ' ≠ ' + d.a[w - 1] });
      }
      let say = '';
      switch (tag) {
        case 'enter': say = n ? 'dedup(a, ' + n + '): ' + d.a.join(' ') + '. Because a is sorted, repeats sit next to each other.' : 'dedup(a, 0): nothing to do.'; break;
        case 'empty-test': say = n ? 'n is ' + n + ', not 0.' : 'n is 0.'; break;
        case 'empty': say = 'An empty array has no duplicates: return 0.'; break;
        case 'init-w': say = 'a[0] is always kept: w = 1 marks the end of the kept part.'; break;
        case 'step-r': say = r < n ? 'r = ' + r + ': read a[' + r + '] = ' + d.a[r] + '.' : 'r = ' + n + ': every element has been read once.'; break;
        case 'compare': say = d.a[r] !== d.a[w - 1] ? 'a[' + r + '] = ' + d.a[r] + ' differs from the last kept value ' + d.a[w - 1] + ': it is new.' : 'a[' + r + '] = ' + d.a[r] + ' is the same as the last kept value: a repeat, skipped. w stays where it is.'; break;
        case 'copy': say = 'a[' + (w - 1) + '] = a[' + r + ']: ' + d.a[w - 1] + ' is copied down to the end of the kept part, and w moves on to ' + w + '.' + (w - 1 === r ? ' (Same slot: nothing has been skipped yet.)' : ''); break;
        case 'done': say = 'dedup() returns ' + w + '. ' + S.pl(n - w, 'repeat') + ' removed in one pass, with no second array.'; break;
        case 'after': say = n ? 'n = ' + d.n + ': ' + list(d.a.slice(0, d.n)) + '. The slots after it still hold old values; n says they are no longer part of the array.' : 'n is still 0.'; break;
      }
      return { items, say };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'step-r' && ts[i + 1] && ts[i + 1].tag === 'compare' && ts[i + 2] && ts[i + 2].tag !== 'copy', once: true, ask: (t) => 'a[' + t.data.r + '] = ' + t.data.a[t.data.r] + ' and the last kept value is ' + t.data.a[t.data.w - 1] + '. Will it be copied?', options: () => ['Yes', 'No, it is a repeat'], answer: () => 'No, it is a repeat', pick: 'option', explain: () => 'Equal to the last kept value, so it is skipped; only r moves on.' },
      { at: (t) => t.tag === 'init-w', once: true, ask: 'What will dedup() return?', options: (ts, i, ctx) => { const v = ctx.input.values; const u = new Set(v).size; return [...new Set([u, v.length, u - 1, v.length - u])].sort((a, b) => a - b).map(String); }, answer: (ts, i, ctx) => String(new Set(ctx.input.values).size), pick: 'option', explain: () => 'The number of different values.' },
    ],
    quiz: [
      { q: 'Why compare a[r] with a[w - 1] and not with a[r - 1]?', options: ['They are always the same', 'a[w - 1] is the last value kept, which is what a new value must differ from', 'a[r - 1] may be out of range', 'To go faster'], answer: 1, why: 'In a sorted array both work here, but a[w - 1] states the rule directly: keep a value only if it is new.' },
      { q: 'Why can w never overtake r?', options: ['w starts at 0', 'w moves only when r has found a value to copy, so w ≤ r always', 'r is bigger', 'It can'], answer: 1, why: 'Copies go from r down to w, never up: nothing unread is overwritten.' },
      { q: 'What does this rely on?', options: ['The array is sorted, so repeats are neighbours', 'No negatives', 'An even number of elements', 'Nothing'], answer: 0, why: 'In an unsorted array, repeats may be far apart and this misses them.' },
      { q: 'How many passes over the array does it make?', options: ['One', 'Two', 'n', 'log n'], answer: 0, why: 'r visits each element once: O(n) time, O(1) extra memory.' },
    ],
  });

  // ---- best fixed-size window ---------------------------------------------------------------------------------
  X.topic({
    id: 'window-max-sum', family: 'window', order: 30, title: 'Largest sum of k in a row',
    blurb: 'A window of k elements slides one step at a time: the new element is added and the one that falls out is subtracted. Two operations per step instead of k.',
    code: `/* the largest sum of k neighbouring elements (k <= n) */
int max_window(const int a[], int n, int k)
{
    int sum = 0, best, i;               /*@ init */
    for (i = 0; i < k; i++)             /*@ fill */
        sum += a[i];                    /*@ add-first */
    best = sum;                         /*@ first */
    for (i = k; i < n; i++) {           /*@ slide */
        sum += a[i];                    /*@ add */
        sum -= a[i - k];                /*@ drop */
        if (sum > best)                 /*@ compare */
            best = sum;                 /*@ best */
    }
    return best;                        /*@ done */
}`,
    animate: ['max_window'],
    inputs: [{ id: 'values', kind: 'ints', label: 'The array', def: [4, 2, 12, 3, 8, 1, 9, 7, 2], min: 1, max: 10, check: (v) => (v.some((x) => x < 0 || x > 60) ? 'The array: values from 0 to 60, so the bars fit' : null) }, { id: 'k', kind: 'int', label: 'Window size k', def: 3, lo: 1, hi: 10 }],
    check: (inp) => (inp.k > inp.values.length ? 'Window size k: at most the number of elements (' + inp.values.length + ')' : null),
    presets: [
      { label: 'k = 3', values: { values: [4, 2, 12, 3, 8, 1, 9, 7, 2], k: 3 } },
      { label: 'k = 1 (the maximum)', values: { values: [5, 9, 3, 7], k: 1 } },
      { label: 'k = n (one window)', values: { values: [3, 1, 4, 1, 5], k: 5 } },
      { label: 'Best at the end', values: { values: [1, 2, 1, 3, 2, 10, 12, 11], k: 3 } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => winMain(inp.values, '', 'printf("best: %d\\n", max_window(a, n, ' + inp.k + '));'),
    capture: (P) => ({ a: P.arr('a', P.val('n')), i: local(P, 'i'), sum: local(P, 'sum'), best: local(P, 'best') }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, k = inp.k;
      const a = inp.values, n = a.length;
      const memo = ctx.memo;
      if (d.sum !== null) memo.sum = d.sum;
      if (d.best !== null) memo.best = d.best;
      const i = d.i, sum = d.sum === null ? memo.sum : d.sum, best = d.best === null ? memo.best : d.best;
      const past = ctx.ticks.slice(0, ctx.i + 1);
      // the window: during the fill it grows to k; while sliding, the new element joins before the old one leaves
      let lo = 0, hi = -1;
      if (i !== null) {
        if (tag === 'add-first' || tag === 'fill') { lo = 0; hi = tag === 'fill' ? i - 1 : i; }
        else if (tag === 'add') { lo = i - k; hi = i; }
        else if (tag === 'slide') { lo = i - k; hi = i - 1; }
        else { lo = i - k + 1; hi = i; }
        if (tag === 'first') { lo = 0; hi = k - 1; }
      } else { lo = memo.lo; hi = memo.hi; }
      memo.lo = lo; memo.hi = hi;
      // the sums of every window seen so far, by start index
      const sums = [];
      let bestStart = null;
      for (const t of past) {
        if (t.tag === 'first') sums[0] = t.data.sum;
        if (t.tag === 'drop') sums[t.data.i - k + 1] = t.data.sum;
      }
      sums.forEach((s, q) => { if (s !== undefined && (bestStart === null || s > sums[bestStart])) bestStart = q; });
      const view = S.cells(ctx, 'a', d.a, { pos, hotWrites: false, cls: (q) => (tag === 'add' && q === i ? 'hot' : tag === 'drop' && q === i - k ? 'victim' : q >= lo && q <= hi ? 'blk-b' : '') });
      const items = view.items.slice();
      if (hi >= lo) items.push({ key: 'win', kind: 'region', x: lo * PITCH - 6, y: -8, w: (hi - lo + 1) * PITCH + 4, h: W + 16, cls: 'win' });
      if (bestStart !== null && sums.length > 1) items.push({ key: 'bestw', kind: 'region', x: bestStart * PITCH - 9, y: -11, w: k * PITCH + 10, h: W + 22, cls: 'best' });
      // the running sum and the best so far
      const bx = n * PITCH + 50;
      items.push({ key: 'sum', kind: 'cell', x: bx, y: 0, w: W + 16, h: W, text: sum === undefined ? '0' : sum, sub: 'sum', cls: tag === 'add' || tag === 'drop' || tag === 'add-first' ? 'hot' : 'part-b', flash: tag === 'add' || tag === 'drop' || tag === 'add-first' });
      items.push({ key: 'best', kind: 'cell', x: bx + W + 30, y: 0, w: W + 16, h: W, text: best === undefined ? '-' : best, sub: 'best', cls: tag === 'best' || tag === 'first' ? 'done' : 'part-a', flash: tag === 'best' });
      if (tag === 'add' || tag === 'add-first') items.push({ key: 'tok' + ctx.i, kind: 'token', x: bx + W / 2 + 8, y: -22, r: 17, text: '+' + a[i], cls: 'c-amber', enter: 'fly', from: { x: cx(i), y: W / 2 }, exit: 'fade' });
      if (tag === 'drop') items.push({ key: 'tok' + ctx.i, kind: 'token', x: cx(i - k), y: W + 70, r: 17, text: '−' + a[i - k], cls: 'c-rose', enter: 'fly', from: { x: bx + W / 2 + 8, y: W / 2 }, exit: 'fade' });
      // bars: one per window, at its start
      const BY = 300, max = Math.max(1, ...sums.filter((s) => s !== undefined));
      for (let q = 0; q + k <= n; q++) {
        const s = sums[q];
        items.push({ key: 'bar' + q, kind: 'bar', x: q * PITCH + 7, y: BY, w: W - 14, h: s === undefined ? 0 : Math.max(4, 120 * s / max), text: s === undefined ? '' : String(s), cls: q === bestStart ? 'done' : '' });
      }
      items.push({ key: 'bars-t', kind: 'text', x: 0, y: BY - 140, text: 'sum of the window starting at each index', cls: 'idx' });
      const steps = past.filter((t) => /^(add|drop|add-first)$/.test(t.tag)).length;
      const brute = sums.filter((s) => s !== undefined).length * k;
      items.push({ key: 'work', kind: 'text', x: bx, y: W + 50, text: steps + ' additions so far', cls: 'mono' });
      items.push({ key: 'work2', kind: 'text', x: bx, y: W + 72, text: 'starting afresh: ' + brute, cls: 'mono muted' });
      let say = '';
      switch (tag) {
        case 'enter': say = 'max_window(a, ' + n + ', ' + k + '): ' + (n - k + 1) + ' windows of ' + k + '. Adding up each one from scratch would cost ' + (n - k + 1) * k + ' additions.'; break;
        case 'init': say = 'sum starts at 0. best has no value yet: it is set once the first window is complete.'; break;
        case 'fill': say = i < k ? 'Build the first window: element ' + i + '.' : 'The first window, a[0..' + (k - 1) + '], is complete.'; break;
        case 'add-first': say = 'sum += a[' + i + ']: ' + sum + '.'; break;
        case 'first': say = 'best = ' + best + ': the only window seen so far is the best so far.'; break;
        case 'slide': say = i < n ? 'Slide right: a[' + i + '] = ' + a[i] + ' comes in, a[' + (i - k) + '] = ' + a[i - k] + ' will drop out.' : 'The window has reached the end of the array.'; break;
        case 'add': say = 'sum += a[' + i + ']: ' + (sum - a[i]) + ' + ' + a[i] + ' = ' + sum + '. For a moment the window holds ' + (k + 1) + ' elements.'; break;
        case 'drop': say = 'sum -= a[' + (i - k) + ']: ' + (sum + a[i - k]) + ' − ' + a[i - k] + ' = ' + sum + '. That is the sum of a[' + (i - k + 1) + '..' + i + '], found with two operations, not ' + k + '.'; break;
        case 'compare': say = sum > best ? sum + ' > best ' + best + ': a new best window.' : sum + ' is not more than best ' + best + '.'; break;
        case 'best': say = 'best = ' + best + '.'; break;
        case 'done': say = 'max_window() returns ' + best + ' after ' + steps + ' additions and subtractions (from scratch: ' + (n - k + 1) * k + ').'; break;
        case 'after': say = 'The best window is a[' + bestStart + '..' + (bestStart + k - 1) + '] = ' + a.slice(bestStart, bestStart + k).join(' + ') + ' = ' + best + '.'; break;
      }
      return { items, say, slow: tag === 'drop' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'slide' && ts[i + 1] && ts[i + 1].tag === 'add', once: true, ask: (t, ts, i, ctx) => 'The window slides one step. What will the new sum be?', options: (ts, i, ctx) => { const a = ctx.input.values, k = ctx.input.k, j = ts[i].data.i, s = ts[i].data.sum; return [...new Set([s + a[j] - a[j - k], s + a[j], s - a[j - k], s])].map(String); }, answer: (ts, i, ctx) => { const a = ctx.input.values, k = ctx.input.k, j = ts[i].data.i; return String(ts[i].data.sum + a[j] - a[j - k]); }, pick: 'option', explain: () => 'Add the element coming in, subtract the one going out.' },
      { at: (t) => t.tag === 'enter', once: true, ask: (t, ts, i, ctx) => 'Which index does the best window start at? Click that element.', answer: (ts, i, ctx) => { const a = ctx.input.values, k = ctx.input.k; let b = 0, bs = -1; for (let q = 0; q + k <= a.length; q++) { const s = a.slice(q, q + k).reduce((x, y) => x + y, 0); if (s > bs) { bs = s; b = q; } } return 'ea' + b; }, explain: () => 'The first window with the largest sum: ties keep the earlier one, because the test is sum > best.' },
    ],
    quiz: [
      { q: 'How many additions and subtractions does sliding take for n elements and window k?', options: ['n × k', 'About k + 2(n - k)', 'k²', 'n²'], answer: 1, why: 'k to fill the first window, then two per slide: O(n) whatever k is.' },
      { q: 'Why is sum += a[i] done before sum -= a[i - k]?', options: ['It must be', 'Either order works: both happen before the sum is used', 'Subtracting first would be negative', 'To avoid overflow'], answer: 1, why: 'The window is complete again only after both lines; the order between them does not matter.' },
      { q: 'With the test sum > best, which window is reported when two windows tie?', options: ['The later one', 'The earlier one', 'Both', 'Neither'], answer: 1, why: 'A later window with an equal sum is not greater, so best keeps the first.' },
      { q: 'What would recomputing every window from scratch cost?', options: ['O(n)', 'O((n - k + 1) × k)', 'O(log n)', 'O(1)'], answer: 1, why: 'k additions for each of the n - k + 1 windows.' },
    ],
  });

  // ---- shortest window reaching a target ----------------------------------------------------------------------
  X.topic({
    id: 'window-shortest', family: 'window', order: 40, title: 'Shortest window with sum ≥ target',
    blurb: 'The right edge grows the window until its sum reaches the target; then the left edge shrinks it as far as it can. Both edges only ever move right.',
    code: `/* the length of the shortest run of neighbours with sum >= target; 0 if there is none */
int shortest(const int a[], int n, int target)
{
    int lo = 0, hi, sum = 0, best = n + 1;      /*@ init */
    for (hi = 0; hi < n; hi++) {                /*@ grow-loop */
        sum += a[hi];                           /*@ grow */
        while (sum >= target) {                 /*@ test */
            if (hi - lo + 1 < best)             /*@ compare */
                best = hi - lo + 1;             /*@ best */
            sum -= a[lo];                       /*@ shrink */
            lo++;                               /*@ step-lo */
        }
    }
    return best <= n ? best : 0;                /*@ done */
}`,
    animate: ['shortest'],
    inputs: [{ id: 'values', kind: 'ints', label: 'Positive numbers', def: [2, 3, 1, 2, 4, 3, 1, 1], min: 1, max: 10, check: (v) => (v.some((x) => x < 1 || x > 50) ? 'Positive numbers: from 1 to 50 (the method needs every value positive)' : null) }, { id: 'target', kind: 'int', label: 'Target', def: 7, lo: 1, hi: 500 }],
    presets: [
      { label: 'Target 7', values: { values: [2, 3, 1, 2, 4, 3, 1, 1], target: 7 } },
      { label: 'One element is enough', values: { values: [1, 2, 9, 1, 1], target: 8 } },
      { label: 'Needs everything', values: { values: [1, 1, 1, 1, 1], target: 5 } },
      { label: 'Impossible', values: { values: [1, 2, 3], target: 10 } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => winMain(inp.values, '', 'printf("shortest: %d\\n", shortest(a, n, ' + inp.target + '));'),
    capture: (P) => ({ a: P.arr('a', P.val('n')), lo: local(P, 'lo'), hi: local(P, 'hi'), sum: local(P, 'sum'), best: local(P, 'best') }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, T = inp.target;
      const a = inp.values, n = a.length;
      const memo = ctx.memo;
      for (const f of ['lo', 'hi', 'sum', 'best']) if (d[f] !== null) memo[f] = d[f];
      const lo = d.lo === null ? memo.lo : d.lo, hi0 = d.hi === null ? memo.hi : d.hi, sum = d.sum === null ? memo.sum : d.sum, best = d.best === null ? memo.best : d.best;
      // the window in the sum: a[lo..hi], except before the grow line has added a[hi]
      const hi = tag === 'grow-loop' || hi0 >= n ? Math.min(hi0, n) - 1 : hi0;
      // remember where the best window was
      if (tag === 'best') memo.bestAt = [lo, hi];
      const view = S.cells(ctx, 'a', d.a, { pos, hotWrites: false, cls: (q) => (tag === 'grow' && q === hi ? 'hot' : tag === 'shrink' && q === lo ? 'victim' : q >= lo && q <= hi ? 'blk-b' : q < lo ? 'used' : '') });
      const items = view.items.slice();
      if (hi !== undefined && lo !== undefined && hi >= lo) items.push({ key: 'win', kind: 'region', x: lo * PITCH - 6, y: -8, w: (hi - lo + 1) * PITCH + 4, h: W + 16, cls: 'win' });
      if (memo.bestAt) items.push({ key: 'bestw', kind: 'region', x: memo.bestAt[0] * PITCH - 6, y: W + 62, w: (memo.bestAt[1] - memo.bestAt[0] + 1) * PITCH + 4, h: 12, cls: 'fill-a' }, { key: 'bestw-t', kind: 'text', x: memo.bestAt[0] * PITCH - 6, y: W + 94, text: 'shortest so far: ' + (memo.bestAt[1] - memo.bestAt[0] + 1), cls: 'good' });
      if (lo !== undefined && lo < n) items.push(S.tag('clo', view.keyOf(lo), 'lo', 'c-rose', 'above'));
      if (hi !== undefined && hi >= 0 && hi < n) items.push(S.tag('chi', view.keyOf(hi), 'hi', 'c-teal', 'above', hi === lo ? 1 : 0));
      // the gauge: the window's sum against the target
      const gy = 200, total = a.reduce((x, y) => x + y, 0), scale = (n * PITCH * 0.85) / Math.max(total, T, 1);
      items.push({ key: 'g-back', kind: 'region', x: 0, y: gy, w: Math.max(total, T) * scale, h: 22, cls: 'gauge' });
      items.push({ key: 'g-fill', kind: 'region', x: 0, y: gy, w: Math.max(0, (sum || 0) * scale), h: 22, cls: (sum || 0) >= T ? 'fill-a' : 'fill-hot' });
      items.push({ key: 'g-t', kind: 'line', x1: T * scale, y1: gy - 12, x2: T * scale, y2: gy + 34, cls: 'target' });
      items.push({ key: 'g-tt', kind: 'text', x: T * scale, y: gy - 18, text: 'target ' + T, cls: 'bad', anchor: 'middle' });
      items.push({ key: 'g-s', kind: 'text', x: 0, y: gy + 56, text: 'window sum = ' + (sum || 0) + ((sum || 0) >= T ? ' ≥ ' + T : ' < ' + T), cls: 'mono' });
      const len = hi - lo + 1;
      let say = '';
      switch (tag) {
        case 'enter': say = 'shortest(target ' + T + '): find the fewest neighbours that add up to at least ' + T + '.'; break;
        case 'init': say = 'The window starts empty at the left. best = n + 1 = ' + (n + 1) + ' means "nothing found yet".'; break;
        case 'grow-loop': say = hi0 < n ? 'hi = ' + hi0 + ': the right edge takes in a[' + hi0 + '] next.' : 'hi has passed the end: no more elements to take in.'; break;
        case 'grow': say = 'sum += a[' + hi + '] = ' + a[hi] + ': the window a[' + lo + '..' + hi + '] sums to ' + sum + '.'; break;
        case 'test': say = sum >= T ? sum + ' ≥ ' + T + ': this window is long enough. Now see how short it can get.' : sum + ' < ' + T + ': not enough, so grow again.'; break;
        case 'compare': say = 'Its length is ' + len + (len < best ? ', shorter than the best so far (' + (best > n ? 'none' : best) + ').' : ', not shorter than ' + best + '.'); break;
        case 'best': say = 'best = ' + best + '.'; break;
        case 'shrink': say = 'sum -= a[' + lo + '] = ' + a[lo] + ': drop the leftmost element, sum ' + sum + '.'; break;
        case 'step-lo': say = 'lo moves to ' + lo + '. a[' + (lo - 1) + '] is done with: every window that starts there and ends at hi or later is at least ' + (hi - lo + 2) + ' long, so none of them can beat this one.'; break;
        case 'done': say = best <= n ? 'shortest() returns ' + best + '.' : 'No window reaches ' + T + ': it returns 0.'; break;
        case 'after': say = (best <= n ? 'The shortest window has length ' + best + '.' : 'Even the whole array sums to less than ' + T + '.') + ' lo and hi each moved at most ' + n + ' times: O(n), not O(n²).'; break;
      }
      return { items, say };
    },
    predict: [
      { at: (t, i, ts, ctx) => t.tag === 'test' && t.data.sum >= ctx.input.target, once: true, ask: 'The sum has reached the target. Which edge moves next?', options: () => ['hi, to grow the window', 'lo, to shrink it'], answer: () => 'lo, to shrink it', pick: 'option', explain: () => 'Once the target is met, the only way to find a shorter window is to drop elements from the left.' },
      { at: (t) => t.tag === 'init', once: true, ask: 'What will shortest() return?', options: (ts, i, ctx) => [...Array(ctx.input.values.length + 1).keys()].map(String), answer: (ts, i, ctx) => { const a = ctx.input.values, T = ctx.input.target; let b = 0; for (let L = 1; L <= a.length && !b; L++) for (let q = 0; q + L <= a.length; q++) if (a.slice(q, q + L).reduce((x, y) => x + y, 0) >= T) { b = L; break; } return String(b); }, pick: 'option', explain: () => 'The fewest neighbours whose sum is at least the target, or 0 if no window reaches it.' },
    ],
    quiz: [
      { q: 'Why must every value be positive?', options: ['C needs it', 'So that shrinking always lowers the sum and growing always raises it', 'For speed', 'To avoid overflow'], answer: 1, why: 'With negatives, dropping an element could raise the sum, and the window logic breaks.' },
      { q: 'How many times can lo move in total?', options: ['At most n', 'n² times', 'Once per hi', 'log n'], answer: 0, why: 'lo only moves right and never passes the end, so the inner while runs at most n times altogether.' },
      { q: 'What does best = n + 1 at the start mean?', options: ['The answer is n + 1', 'Nothing has been found yet: any real window is shorter', 'An error', 'The array is full'], answer: 1, why: 'It is a value no real window can have, so the first window found always replaces it.' },
      { q: 'The whole method takes...', options: ['O(n²)', 'O(n)', 'O(n log n)', 'O(1)'], answer: 1, why: 'Each element enters the window once and leaves it at most once.' },
    ],
  });
})(SEE);
