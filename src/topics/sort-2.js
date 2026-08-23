// Sorting, part A: bubble, selection, insertion, merge and shell sort. Each has its own picture:
// neighbours swapping, a long swap after a scan, a lifted card, halves and a temp row, gap groups.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, A = X.ArrayKit;
  const BASE = 260, HMAX = 220, BAR = 40, BGAP = 8;

  // read some int variables of the newest frame; null when missing or not set yet
  const ints = (P, names) => {
    const o = {};
    for (const v of names) o[v] = P.has(v, 0) && P.isSet(v, 0) ? P.val(v, 0) : null;
    return o;
  };
  const list = (arr) => arr.join(' ');
  const plural = (k, w, ws) => k + ' ' + (k === 1 ? w : ws || (/(s|x|sh|ch)$/.test(w) ? w + 'es' : w + 's'));
  // the top of a bar drawn by A.bars with the default sizes
  const barTop = (arr, k) => BASE - Math.max(4, Math.abs(arr[k]) / Math.max(1, ...arr.map(Math.abs)) * HMAX);
  const allDone = (ctx) => ctx.tick.tag === 'after' || ctx.i === ctx.ticks.length - 1;
  const ahead = (ticks, i, tag) => { for (let k = i + 1; k < ticks.length; k++) if (ticks[k].tag === tag) return ticks[k]; return null; };

  // ---- bubble sort ---------------------------------------------------------------------------------------
  X.topic({
    id: 'bubble-sort', family: 'sort', order: 10, title: 'Bubble sort',
    blurb: 'Walk along the array comparing neighbours and swap any pair that is out of order. The largest value bubbles to the end on every pass; a pass with no swap means the array is sorted.',
    code: `void bubble_sort(int a[], int n)
{
    int pass, j, swapped;
    for (pass = 0; pass < n - 1; pass++) {      /*@ pass */
        swapped = 0;                            /*@ reset */
        for (j = 0; j < n - 1 - pass; j++) {    /*@ inner */
            if (a[j] > a[j + 1]) {              /*@ compare */
                swap(&a[j], &a[j + 1]);         /*@ swap */
                swapped = 1;                    /*@ mark */
            }
        }
        if (!swapped)                           /*@ check */
            break;                              /*@ early */
    }
}`,
    animate: ['bubble_sort'], quiet: ['swap'],
    inputs: [X.sortValues],
    presets: [
      { label: 'Mixed', values: { values: [38, 27, 43, 3, 9, 82, 10, 55] } },
      { label: 'Already sorted', values: { values: [5, 12, 19, 26, 33, 40, 47, 54] } },
      { label: 'Reverse sorted', values: { values: [80, 70, 60, 50, 40, 30, 20, 10] } },
      { label: 'Small value last', values: { values: [20, 30, 40, 50, 60, 70, 80, 10] } },
      { label: 'Two', values: { values: [9, 2] } },
    ],
    counters: ['compares', 'swaps'],
    main: (inp) => X.sortMain(inp.values, 'bubble_sort(a, n);'),
    capture(P) {
      const n = P.val('n');
      return { a: P.arr('a', n), n, vars: ints(P, ['pass', 'j', 'swapped']) };
    },
    scene(ctx) {
      const d = ctx.tick.data, v = d.vars, tag = ctx.tick.tag, a = d.a, n = d.n;
      const memo = ctx.memo;
      memo.log = memo.log || [];
      if (tag === 'reset') memo.log[v.pass] = 0;
      if (tag === 'swap') memo.log[v.pass]++;
      if (tag === 'early') memo.early = true;
      const pass = v.pass;
      if (pass !== null) memo.passes = Math.min(pass + 1, n - 1);
      // how many values at the right end are settled for good
      let settled = pass === null ? 0 : pass + (tag === 'check' || tag === 'early' ? 1 : 0);
      if (memo.early || allDone(ctx) || pass === n - 1) settled = n;
      const inPass = pass !== null && pass < n - 1 && v.j !== null && v.j < n - 1 - pass && ['compare', 'swap', 'mark', 'inner'].includes(tag);
      const view = A.bars(ctx, a, {
        cls: (k) => {
          if (k >= n - settled) return 'done';
          if (inPass && (k === v.j || k === v.j + 1)) return tag === 'inner' ? 'sa-pair' : 'hot';
          return '';
        },
      });
      const items = view.items.slice();
      // the bracket around the two neighbours being looked at
      if (inPass) {
        items.push(...A.range(view, 'pairbox', v.j, v.j + 1, 'sa-pairbox', '', { cell: BAR, y0: 22, h: 266 }));
        if (tag === 'compare' || tag === 'swap' || tag === 'mark') {
          const x = a[v.j], y = a[v.j + 1];
          const txt = tag === 'compare' ? (x > y ? x + ' > ' + y + ': swap' : x + ' ≤ ' + y + ': keep') : 'swapped';
          items.push({ key: 'cmpt', kind: 'text', x: (view.xOf(v.j) + view.xOf(v.j + 1)) / 2, y: 6, text: txt, cls: 'sa-hot', anchor: 'middle' });
        }
      }
      // the wall between the unsorted part and the settled tail
      if (settled > 0 && settled < n) {
        const wx = (view.xOf(n - settled - 1) + view.xOf(n - settled)) / 2;
        items.push({ key: 'wall', kind: 'line', x1: wx, y1: 20, x2: wx, y2: BASE + 6, cls: 'sa-wall' });
        items.push({ key: 'wallt', kind: 'text', x: wx + 8, y: 30, text: 'settled', cls: 'sa-good' });
      }
      // the pass log on the right: how many swaps each pass made
      const lx = view.xOf(n - 1) + 60;
      items.push({ key: 'logt', kind: 'text', x: lx, y: 40, text: 'swaps per pass', cls: 'sa-title' });
      memo.log.forEach((s, p) => {
        items.push({ key: 'log' + p, kind: 'text', x: lx, y: 66 + p * 22, text: 'pass ' + (p + 1) + ':  ' + s, cls: p === pass && !allDone(ctx) ? 'sa-hot' : s === 0 ? 'sa-good' : 'sa-log' });
      });
      if (v.swapped !== null && pass !== null && pass < n - 1 && !memo.early) items.push({ key: 'flag', kind: 'text', x: lx, y: 76 + memo.log.length * 22, text: 'swapped = ' + v.swapped, cls: 'sa-code' });
      const marks = {};
      if (inPass) marks.j = v.j;
      items.push(...A.markers(view, marks, { y: BASE }));
      items.push({ key: 'title', kind: 'text', x: 0, y: -30, text: allDone(ctx) || memo.early ? 'sorted after ' + plural(memo.passes || 0, 'pass') : pass === null ? 'bubble sort' : 'pass ' + (pass + 1) + ' of at most ' + (n - 1), cls: 'sa-title' });

      const P1 = pass === null ? 0 : pass + 1;
      let say = '';
      switch (tag) {
        case 'enter': say = 'bubble_sort(a, ' + n + '): each pass walks from left to right and swaps any two neighbours that are out of order.'; break;
        case 'pass':
          if (pass < n - 1) say = pass === 0 ? 'Pass 1 begins. Nothing is settled yet, so it compares all ' + (n - 1) + ' pairs of neighbours.' : 'Pass ' + P1 + ' begins. ' + (pass === 1 ? 'The last value is already in its final place, so this pass stops before it: ' : 'The last ' + pass + ' values are already in their final places, so this pass stops before them: ') + plural(n - 1 - pass, 'comparison') + '.';
          else say = 'pass = ' + pass + ' = n - 1: after n - 1 passes every value is in place, even a[0].';
          break;
        case 'reset': say = 'swapped = 0. If no swap happens during this pass, the flag stays 0 and we will know the array is sorted.'; break;
        case 'inner': say = inPass ? 'Look at the neighbours a[' + v.j + '] = ' + a[v.j] + ' and a[' + (v.j + 1) + '] = ' + a[v.j + 1] + '.' : 'j = ' + v.j + ' reaches the settled part, so pass ' + P1 + ' is over.'; break;
        case 'compare': say = a[v.j] > a[v.j + 1] ? 'Is ' + a[v.j] + ' > ' + a[v.j + 1] + '? Yes: the bigger one is on the left, so they swap.' : 'Is ' + a[v.j] + ' > ' + a[v.j + 1] + '? No: these two are in order, so nothing moves.'; break;
        case 'swap': say = 'Swap: ' + a[v.j] + ' steps left and ' + a[v.j + 1] + ' steps right. The bigger value keeps travelling right as long as it wins each comparison.'; break;
        case 'mark': say = 'swapped = 1: this pass changed something, so another pass will be needed to check.'; break;
        case 'check': say = v.swapped ? 'Pass ' + P1 + ' made ' + plural(memo.log[pass], 'swap') + '. The largest unsettled value, ' + a[n - 1 - pass] + ', has bubbled up to a[' + (n - 1 - pass) + '] and is settled.' : 'Pass ' + P1 + ' made no swap at all: every neighbour is in order, so the whole array is sorted.'; break;
        case 'early': say = P1 < n - 1 ? 'break: bubble sort stops early, after ' + plural(P1, 'pass') + ' instead of ' + (n - 1) + '. This is why it is fast on input that is already sorted.' : 'break: no swap in the last pass either, so the sort ends.'; break;
        case 'after': say = 'Sorted: ' + list(a) + '. ' + plural(ctx.counters.compares, 'comparison') + ', ' + plural(ctx.counters.swaps, 'swap') + ', every swap between two neighbours.'; break;
        default: say = '';
      }
      return { items, say, slow: tag === 'early' || tag === 'check' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'compare', once: true, ask: (t, ts, i) => 'a[j] = ' + ts[i + 1].data.a[ts[i + 1].data.vars.j] + ' and a[j+1] = ' + ts[i + 1].data.a[ts[i + 1].data.vars.j + 1] + '. Will they swap?', options: () => ['Yes, they swap', 'No, they stay'], answer: (ts, i) => { const d = ts[i + 1].data; return d.a[d.vars.j] > d.a[d.vars.j + 1] ? 'Yes, they swap' : 'No, they stay'; }, pick: 'option', explain: () => 'They swap only when the left one is strictly bigger.' },
      { at: (t) => t.tag === 'reset' && t.data.vars.pass === 0 && t.data.n > 2 && t.data.a.indexOf(Math.max(...t.data.a)) < t.data.n - 1, once: true, ask: (t) => 'Where will the largest value, ' + Math.max(...t.data.a) + ', be when pass 1 ends?', options: () => ['Where it is now', 'At a[0]', 'At the far right', 'One place further right'], answer: () => 'At the far right', pick: 'option', explain: () => 'Once the walk reaches the largest value it wins every comparison, so it is carried all the way to the end.' },
      { at: (t, i, ts) => t.tag === 'check' && t.data.vars.pass === 0 && t.data.n > 3 && !!ahead(ts, i, 'reset'), once: true, ask: (t) => 'Pass 1 is over. How many comparisons will pass 2 make on these ' + t.data.n + ' values?', options: (ts, i) => { const o = []; for (let k = 1; k < ts[i].data.n; k++) o.push(String(k)); return o; }, answer: (ts, i) => String(ts[i].data.n - 2), pick: 'option', explain: (ts, i) => 'The last value is settled after pass 1, so only n - 2 = ' + (ts[i].data.n - 2) + ' pairs are left to compare.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'check' && ts[i + 1].data.vars.pass > 0, once: true, ask: (t, ts, i) => 'Pass ' + (ts[i + 1].data.vars.pass + 1) + ' is ending with swapped = ' + ts[i + 1].data.vars.swapped + '. Will there be another pass?', options: () => ['Yes, another pass', 'No, the sort stops'], answer: (ts, i) => (ahead(ts, i + 1, 'reset') ? 'Yes, another pass' : 'No, the sort stops'), pick: 'option', explain: () => 'A pass without any swap proves the array is sorted. Otherwise the loop goes on, until n - 1 passes are done.' },
    ],
    quiz: [
      { q: 'After the first pass of bubble sort, what is sure to be true?', options: ['The smallest value is at a[0]', 'The largest value is at the end', 'The array is half sorted', 'Nothing yet'], answer: 1, why: 'The largest value wins every comparison it takes part in, so it is carried all the way to the right.' },
      { q: 'Why does a pass with no swaps let the sort stop early?', options: ['It saves memory', 'Every pair of neighbours is in order, so the whole array is sorted', 'The next pass would undo the work', 'It does not: it must do n - 1 passes'], answer: 1, why: 'If every a[j] ≤ a[j + 1], the values increase from left to right: that is exactly what sorted means.' },
      { q: 'With the early exit, how many comparisons does bubble sort make on an already sorted array of n values?', options: ['n - 1', 'n log n', 'n²/2', '0'], answer: 0, why: 'One pass of n - 1 comparisons finds no swap, and the sort stops.' },
      { q: 'In [20, 30, 40, 50, 60, 70, 80, 10], how far does 10 move in each pass?', options: ['All the way in one pass', 'One place to the left', 'Two places', 'It does not move'], answer: 1, why: 'A small value near the end only swaps with its left neighbour once per pass, so it needs 7 passes to reach a[0]. Such values are called turtles.' },
      { q: 'Is bubble sort stable (equal values keep their order)?', options: ['Yes, because it only swaps when a[j] > a[j + 1]', 'No, swaps can jump over equal values', 'Only on sorted input', 'Only with the early exit'], answer: 0, why: 'Two equal neighbours are never swapped, and values only move one place at a time, so equal values never pass each other.' },
    ],
    compareWith: 'insertion-sort',
  });

  // ---- selection sort ------------------------------------------------------------------------------------
  X.topic({
    id: 'selection-sort', family: 'sort', order: 20, title: 'Selection sort',
    blurb: 'Scan the unsorted part for its smallest value, then make one swap to put it at the front. The scan is long; the swap is a single jump, often across the whole array.',
    code: `void selection_sort(int a[], int n)
{
    int i, j, min;
    for (i = 0; i < n - 1; i++) {        /*@ pass */
        min = i;                         /*@ guess */
        for (j = i + 1; j < n; j++) {    /*@ scan */
            if (a[j] < a[min])           /*@ compare */
                min = j;                 /*@ new-min */
        }
        if (min != i)                    /*@ check */
            swap(&a[i], &a[min]);        /*@ swap */
    }
}`,
    animate: ['selection_sort'], quiet: ['swap'],
    inputs: [X.sortValues],
    presets: [
      { label: 'Mixed', values: { values: [38, 27, 43, 3, 9, 82, 10, 55] } },
      { label: 'Already sorted', values: { values: [5, 12, 19, 26, 33, 40, 47, 54] } },
      { label: 'Reverse sorted', values: { values: [80, 70, 60, 50, 40, 30, 20, 10] } },
      { label: 'Smallest at the end', values: { values: [41, 52, 63, 74, 85, 96, 30, 7] } },
      { label: 'One value', values: { values: [42] } },
    ],
    counters: ['compares', 'swaps'],
    main: (inp) => X.sortMain(inp.values, 'selection_sort(a, n);'),
    capture(P) {
      const n = P.val('n');
      return { a: P.arr('a', n), n, vars: ints(P, ['i', 'j', 'min']) };
    },
    scene(ctx) {
      const d = ctx.tick.data, v = d.vars, tag = ctx.tick.tag, a = d.a, n = d.n;
      const memo = ctx.memo;
      const done = allDone(ctx);
      const i = v.i, mn = v.min;
      const active = !done && i !== null && i < n - 1;
      // the prefix a[0..i-1] holds the smallest values for good; after the swap a[i] does too
      const fixed = done ? n : i === null ? 0 : i >= n - 1 ? n : i + (tag === 'swap' || (tag === 'check' && mn === i) ? 1 : 0);
      const scanning = active && v.j !== null && v.j < n && (tag === 'compare' || tag === 'new-min' || tag === 'scan');
      const view = A.bars(ctx, a, {
        cls: (k) => {
          if (k < fixed) return 'done';
          if (active && mn !== null && k === mn && tag !== 'swap') return 'sa-min';
          if (scanning && k === v.j) return tag === 'scan' ? 'sa-pair' : 'hot';
          if (active && k === i) return 'sa-target';
          return '';
        },
      });
      const items = view.items;
      // a swap across a long distance hops higher
      for (const [p, q] of view.tracked.swaps) {
        const h = 50 + 16 * Math.abs(p - q);
        for (const it of items) if (it.key === view.keyOf(p) || it.key === view.keyOf(q)) it.arc = h;
      }
      if (active && v.j !== null) {
        // the part already scanned in this pass
        const last = Math.min(v.j - (tag === 'scan' && v.j < n ? 1 : 0), n - 1);
        if (last >= i) items.push(...A.range(view, 'scanned', i, last, 'sa-zone', '', { cell: BAR, y0: 26, h: 262 }));
      }
      // the "smallest so far" tag floats above the min bar and jumps when a new one is found
      if (active && mn !== null && tag !== 'swap') {
        items.push({ key: 'mintag', kind: 'cursor', x: view.xOf(mn), y: barTop(a, mn) - 3, tx: view.xOf(mn), ty: 4, text: 'min ' + a[mn], cls: 'c-rose' });
      }
      if (tag === 'compare' && scanning) {
        items.push({ key: 'cmp', kind: 'line', x1: view.xOf(v.j), y1: barTop(a, v.j) - 4, x2: view.xOf(mn), y2: barTop(a, mn) - 4, cls: 'sa-cmp' });
      }
      if (tag === 'swap') {
        const far = memo.swapFrom;
        if (far !== undefined && far !== i) items.push({ key: 'jump', kind: 'text', x: (view.xOf(i) + view.xOf(far)) / 2, y: -6, text: 'one swap across ' + plural(Math.abs(far - i), 'place'), cls: 'sa-hot', anchor: 'middle' });
      }
      if (tag === 'check') memo.swapFrom = mn;
      const marks = {};
      if (active) { marks.i = i; if (v.j !== null && v.j < n && tag !== 'guess' && tag !== 'pass') marks.j = v.j; if (tag === 'swap') marks.min = memo.swapFrom; }
      items.push(...A.markers(view, marks, { y: BASE }));
      items.push({ key: 'title', kind: 'text', x: 0, y: -30, text: done || fixed === n ? 'sorted' : i === null ? 'selection sort' : 'filling slot a[' + i + ']', cls: 'sa-title' });

      let say = '';
      const m = mn === null ? 0 : a[mn];
      switch (tag) {
        case 'enter': say = 'selection_sort(a, ' + n + '): fill the slots from left to right, each time with the smallest value that is not placed yet.'; break;
        case 'pass':
          if (i < n - 1) say = i === 0 ? 'Slot a[0] is to be filled. It must get the smallest of all ' + n + ' values, so all of them have to be looked at.' : 'Slot a[' + i + '] is next. ' + (i === 1 ? 'a[0] already holds the smallest value; it is never touched again.' : 'a[0..' + (i - 1) + '] already holds the ' + i + ' smallest values in order; they are never touched again.');
          else say = n === 1 ? 'One value: there is nothing to sort, so the loop does not run at all.' : 'i = ' + i + ' = n - 1: the one value left must be the largest, so it is already in place.';
          break;
        case 'guess': say = 'min = ' + i + ': before looking further, a[' + i + '] = ' + a[i] + ' is the smallest seen so far.'; break;
        case 'scan': say = v.j < n ? 'j moves to a[' + v.j + '] = ' + a[v.j] + '.' : 'The scan is over. The smallest of a[' + i + '..' + (n - 1) + '] is a[' + mn + '] = ' + m + '.'; break;
        case 'compare': say = 'Is a[' + v.j + '] = ' + a[v.j] + ' < the smallest so far, ' + m + '? ' + (a[v.j] < m ? 'Yes: a new smallest.' : 'No: ' + m + ' stays the smallest.'); break;
        case 'new-min': say = 'min = ' + v.j + ': the marker jumps to ' + a[v.j] + '. Nothing moves in the array; only the index is remembered.'; break;
        case 'check': say = mn !== i ? 'min = ' + mn + ' is not ' + i + ', so ' + m + ' and ' + a[i] + ' swap places.' : 'min = ' + i + ': the smallest is already in slot a[' + i + '], so no swap is needed.'; break;
        case 'swap': say = 'One swap: ' + a[i] + ' lands in a[' + i + '] for good, and ' + a[memo.swapFrom] + ' goes to a[' + memo.swapFrom + '], where ' + a[i] + ' was.'; break;
        case 'after': say = 'Sorted: ' + list(a) + '. ' + plural(ctx.counters.compares, 'comparison') + ' but only ' + plural(ctx.counters.swaps, 'swap') + ': never more than n - 1.'; break;
        default: say = '';
      }
      return { items, say, slow: tag === 'swap' };
    },
    predict: [
      { at: (t) => t.tag === 'guess' && t.data.vars.i === 0 && t.data.n > 2, once: true, ask: 'Which value will end up in a[0] when this pass is over?', options: (ts, i) => [...new Set(ts[i].data.a)].map(String), answer: (ts, i) => String(Math.min(...ts[i].data.a)), pick: 'option', explain: () => 'The scan looks at every remaining value and keeps the smallest. That one is swapped into the slot.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'compare', once: true, ask: (t, ts, i) => 'a[j] = ' + ts[i + 1].data.a[ts[i + 1].data.vars.j] + ', smallest so far = ' + ts[i + 1].data.a[ts[i + 1].data.vars.min] + '. Will the min marker jump?', options: () => ['Yes, to a[j]', 'No, it stays'], answer: (ts, i) => { const d = ts[i + 1].data; return d.a[d.vars.j] < d.a[d.vars.min] ? 'Yes, to a[j]' : 'No, it stays'; }, pick: 'option', explain: () => 'It jumps only when a[j] is strictly smaller; an equal value does not move it.' },
      { at: (t) => t.tag === 'pass' && t.data.vars.i === 1 && t.data.n > 3, once: true, ask: (t) => 'How many comparisons will the pass for a[1] make on these ' + t.data.n + ' values?', options: (ts, i) => { const o = []; for (let k = 1; k < ts[i].data.n; k++) o.push(String(k)); return o; }, answer: (ts, i) => String(ts[i].data.n - 2), pick: 'option', explain: () => 'j runs from 2 to n - 1: every value right of the slot, however sorted the array already is.' },
    ],
    quiz: [
      { q: 'How many comparisons does selection sort make on an array that is already sorted?', options: ['n - 1', 'About n²/2, the same as always', 'None', 'n log n'], answer: 1, why: 'The scan cannot know the rest is sorted: every pass still compares every remaining value. (n - 1) + (n - 2) + ... + 1 = n(n - 1)/2.' },
      { q: 'At most how many swaps does selection sort make?', options: ['n - 1', 'n²', 'n log n', 'One per comparison'], answer: 0, why: 'One swap per pass at most, and there are n - 1 passes. This makes it useful when writing to memory is expensive.' },
      { q: 'During the scan, what does the variable min hold?', options: ['The smallest value', 'The index of the smallest value seen so far', 'The number of comparisons', 'The last index'], answer: 1, why: 'It is an index: the array does not change until the one swap at the end of the pass.' },
      { q: 'Is selection sort stable?', options: ['Yes', 'No: the long swap can carry a value past an equal one', 'Only on sorted input', 'Only for two values'], answer: 1, why: 'In [5a, 5b, 2], the first pass swaps 5a with 2, putting 5a behind 5b: equal values changed order.' },
      { q: 'After the pass for slot a[i], what is true of a[0..i]?', options: ['It is sorted, but values may still move into it', 'It holds the i + 1 smallest values, in their final places', 'Nothing in particular', 'It holds the largest values'], answer: 1, why: 'Each pass picks the smallest of what is left, so the prefix grows with final values. Compare insertion sort, whose sorted prefix is not final.' },
    ],
    compareWith: 'bubble-sort',
  });

  // ---- insertion sort ------------------------------------------------------------------------------------
  // The card picture: the key is lifted above the row, bigger values slide right into the hole it left,
  // and the key drops into the hole where it stops. The hole still shows the stale copy memory holds.
  const CW = 56, CG = 6, LIFT = -96;
  X.topic({
    id: 'insertion-sort', family: 'sort', order: 30, title: 'Insertion sort',
    blurb: 'Like sorting a hand of cards: take the next card, slide the bigger ones in your hand one place right, and drop the card into the gap.',
    code: `void insertion_sort(int a[], int n)
{
    int i, j, key;
    for (i = 1; i < n; i++) {               /*@ pass */
        key = a[i];                         /*@ lift */
        j = i - 1;                          /*@ start */
        while (j >= 0 && a[j] > key) {      /*@ compare */
            a[j + 1] = a[j];                /*@ shift */
            j--;                            /*@ left */
        }
        a[j + 1] = key;                     /*@ drop */
    }
}`,
    animate: ['insertion_sort'],
    inputs: [X.sortValues],
    presets: [
      { label: 'Mixed', values: { values: [38, 27, 43, 3, 9, 82, 10, 55] } },
      { label: 'Already sorted', values: { values: [5, 12, 19, 26, 33, 40, 47, 54] } },
      { label: 'Reverse sorted', values: { values: [80, 70, 60, 50, 40, 30, 20, 10] } },
      { label: 'Nearly sorted', values: { values: [12, 19, 26, 5, 33, 40, 54, 47] } },
      { label: 'Two', values: { values: [9, 2] } },
    ],
    counters: ['compares', 'moves'],
    main: (inp) => X.sortMain(inp.values, 'insertion_sort(a, n);'),
    capture(P) {
      const n = P.val('n');
      return { a: P.arr('a', n), n, vars: ints(P, ['i', 'j', 'key']) };
    },
    scene(ctx) {
      const d = ctx.tick.data, v = d.vars, tag = ctx.tick.tag, a = d.a, n = d.n;
      const memo = ctx.memo;
      const done = allDone(ctx);
      if (!memo.ids) { memo.ids = a.map((_, k) => 'c' + k); memo.hole = null; memo.keyId = null; memo.shifts = 0; }
      const prevHole = memo.hole;
      // follow the cards: lifting makes a hole, a shift moves the card at j into the hole, the drop fills it
      if (tag === 'lift') { memo.keyId = memo.ids[v.i]; memo.hole = v.i; memo.shifts = 0; memo.sorted = v.i - 1; }
      if (tag === 'shift') { memo.ids[v.j + 1] = memo.ids[v.j]; memo.ids[v.j] = null; memo.hole = v.j; memo.shifts++; }
      if (tag === 'drop') { memo.ids[v.j + 1] = memo.keyId; memo.keyId = null; memo.hole = null; memo.sorted = v.i; }
      if (tag === 'enter') memo.sorted = 0;
      // value comparisons only: when j is -1 the && stops before a[j] > key is looked at
      if (tag === 'compare' && v.j >= 0) memo.cmp = (memo.cmp || 0) + 1;
      const sortedTo = done ? n - 1 : memo.sorted;
      const x = (k) => k * (CW + CG);
      const items = [];
      for (let k = 0; k < n; k++) {
        if (k === memo.hole) {
          items.push({ key: 'hole', kind: 'cell', x: x(k), y: 0, w: CW, h: CW, text: a[k], sub: k, cls: 'sa-hole' });
          continue;
        }
        const inSorted = k <= sortedTo || (memo.hole !== null && k <= v.i);
        items.push({
          key: 'e' + memo.ids[k], kind: 'cell', x: x(k), y: 0, w: CW, h: CW, text: a[k], sub: k,
          cls: (done ? 'done' : inSorted ? 'sa-run' : '') + (tag === 'compare' && k === v.j && v.j >= 0 ? ' focus' : '') + (tag === 'shift' && k === v.j + 1 ? ' hot' : ''),
          arc: tag === 'shift' && k === v.j + 1 ? 30 : 0, enter: 'grow', flash: tag === 'shift' && k === v.j + 1,
        });
      }
      // the key card hovers over the hole
      if (memo.keyId !== null) {
        items.push({ key: 'e' + memo.keyId, kind: 'cell', x: x(memo.hole), y: LIFT, w: CW, h: CW, text: v.key, sub: 'key', cls: 'sa-lifted' });
      }
      if (tag === 'drop') {
        for (const it of items) if (it.key === 'e' + memo.ids[v.j + 1]) { it.cls += ' sa-lifted'; it.flash = true; }
      }
      void prevHole;
      // the sorted prefix: a shaded band behind the cards
      const bandTo = memo.hole !== null ? v.i : sortedTo;
      if (bandTo !== null && bandTo >= 0) {
        items.push({ key: 'band', kind: 'region', x: -8, y: -26, w: x(bandTo) + CW + 16, h: CW + 52, cls: 'sa-sorted', text: done ? 'sorted' : 'sorted part' });
      }
      if (tag === 'compare') {
        const kx = x(memo.hole) + CW / 2;
        if (v.j >= 0) {
          items.push({ key: 'cmp', kind: 'line', x1: kx, y1: LIFT + CW, x2: x(v.j) + CW / 2, y2: -2, cls: 'sa-cmp' });
          items.push({ key: 'cmpt', kind: 'text', x: kx + CW / 2 + 10, y: LIFT + 22, text: a[v.j] > v.key ? a[v.j] + ' > ' + v.key + ': slide right' : a[v.j] + ' ≤ ' + v.key + ': stop', cls: 'sa-hot' });
        } else {
          items.push({ key: 'cmpt', kind: 'text', x: kx + CW / 2 + 10, y: LIFT + 22, text: 'j = -1: front reached', cls: 'sa-hot' });
        }
      }
      const view = { xOf: (k) => x(k) + CW / 2, keyOf: (k) => (k === memo.hole ? 'hole' : k >= 0 && k < n ? 'e' + memo.ids[k] : null) };
      const marks = {};
      if (!done && v.i !== null && v.i < n && tag !== 'pass') marks.i = v.i;
      if (!done && v.j !== null && ['start', 'compare', 'shift', 'left'].includes(tag)) marks.j = v.j;
      items.push(...A.markers(view, marks, { y: 0 }));
      items.push({ key: 'title', kind: 'text', x: 0, y: LIFT - 30, text: done ? 'sorted' : v.i !== null && v.i < n ? 'inserting a[' + v.i + ']' : 'insertion sort', cls: 'sa-title' });

      let say = '';
      const k = v.key;
      switch (tag) {
        case 'enter': say = 'insertion_sort(a, ' + n + '): a[0] on its own is a sorted part of one card. Each pass takes the next card and inserts it into the sorted part.'; break;
        case 'pass': say = v.i < n ? (v.i === 1 ? 'a[0] alone is sorted.' : 'a[0..' + (v.i - 1) + '] is sorted.') + ' The next card to insert is a[' + v.i + '] = ' + a[v.i] + '.' : 'i = ' + n + ': every card has been inserted.'; break;
        case 'lift': say = 'key = ' + k + ': the card is lifted out. Its slot a[' + v.i + '] becomes a hole; memory still holds a stale ' + a[v.i] + ' there, but it is free to be overwritten.'; break;
        case 'start': say = 'j = ' + v.j + ': compare the key with the card just left of the hole, a[' + v.j + '] = ' + a[v.j] + '.'; break;
        case 'compare': say = v.j < 0 ? 'j = -1: there is no card left to compare with. The key belongs at the very front.' : a[v.j] > k ? 'Is a[' + v.j + '] = ' + a[v.j] + ' > key ' + k + '? Yes: ' + a[v.j] + ' must slide right to make room.' : 'Is a[' + v.j + '] = ' + a[v.j] + ' > key ' + k + '? No: the key belongs right after ' + a[v.j] + '. The loop stops.'; break;
        case 'shift': say = 'a[' + (v.j + 1) + '] = a[' + v.j + ']: ' + a[v.j + 1] + ' slides one place right, into the hole. The hole moves left to a[' + v.j + '].'; break;
        case 'left': say = 'j-- makes j = ' + v.j + (v.j >= 0 ? ': the next card to compare is a[' + v.j + '] = ' + a[v.j] + '.' : ': we have run off the left end.'); break;
        case 'drop': say = 'a[' + (v.j + 1) + '] = key: ' + k + ' drops into the hole' + (memo.shifts ? ' after ' + plural(memo.shifts, 'card') + ' slid right' : ', which is where it started: nothing had to move') + '. a[0..' + v.i + '] is sorted now.'; break;
        case 'after': say = 'Sorted: ' + list(a) + '. ' + plural(memo.cmp || 0, 'comparison') + ' of two values and ' + plural(ctx.counters.moves, 'slide') + ' (each slide is one write, not a swap).'; break;
        default: say = '';
      }
      return { items, say, slow: tag === 'lift' || tag === 'drop' };
    },
    predict: [
      { at: (t) => t.tag === 'lift' && t.data.vars.i >= 2, once: true, ask: (t) => 'key = ' + t.data.vars.key + '. At which index will it drop?', options: (ts, i) => { const o = []; for (let k = 0; k <= ts[i].data.vars.i; k++) o.push(String(k)); return o; }, answer: (ts, i) => { const dr = ahead(ts, i, 'drop'); return dr ? String(dr.data.vars.j + 1) : null; }, pick: 'option', explain: () => 'Right after the last card that is not bigger than the key; every bigger card slides one place right.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'compare' && ts[i + 1].data.vars.j >= 0, once: true, ask: (t, ts, i) => 'a[j] = ' + ts[i + 1].data.a[ts[i + 1].data.vars.j] + ' and key = ' + ts[i + 1].data.vars.key + '. Will a[j] slide right?', options: () => ['Yes, it slides right', 'No, the loop stops'], answer: (ts, i) => { const d = ts[i + 1].data; return d.a[d.vars.j] > d.vars.key ? 'Yes, it slides right' : 'No, the loop stops'; }, pick: 'option', explain: () => 'Only cards strictly bigger than the key slide. An equal card stays in front, which keeps the sort stable.' },
    ],
    quiz: [
      { q: 'Why does insertion sort use key = a[i] before the while loop?', options: ['To save a comparison', 'The first shift overwrites a[i], so its value must be kept somewhere', 'C needs a variable for the loop', 'To make it stable'], answer: 1, why: 'a[j + 1] = a[j] with j = i - 1 writes into a[i]. Without the copy in key, that value would be lost.' },
      { q: 'How many comparisons on an already sorted array of n values?', options: ['n - 1', 'n²/2', 'n log n', '0'], answer: 0, why: 'Each pass compares once, finds a[i - 1] ≤ key, and stops. That is why insertion sort is the choice for nearly sorted data.' },
      { q: 'What is a shift, compared with a swap?', options: ['The same thing', 'One write instead of three; the key is written only once at the end', 'Two swaps', 'A comparison'], answer: 1, why: 'A swap needs three assignments through a temporary. Shifting moves each bigger value with one write and places the key once.' },
      { q: 'After the pass for i = 3, what is true of a[0..3]?', options: ['It holds the 4 smallest values', 'It is sorted, but later keys may still be inserted into it', 'It never changes again', 'Nothing yet'], answer: 1, why: 'It is the first four values, sorted among themselves. A smaller value further right will still be inserted in front of them.' },
      { q: 'What is the worst case input for insertion sort?', options: ['Already sorted', 'Reverse sorted', 'All equal', 'Random'], answer: 1, why: 'Every key is smaller than everything before it, so it slides all the way to the front: 1 + 2 + ... + (n - 1) shifts.' },
    ],
    compareWith: 'shell-sort',
  });

  // ---- merge sort ----------------------------------------------------------------------------------------
  // The tree of halves: every value sits on the row of the deepest call that holds it, so calls going
  // down pull their part of the array down a row and returning lifts it back up. During a merge the
  // row below holds tmp, and the cards travel down into it in order and then back up into a.
  const MW = 50, MG = 6, ROW = 116;
  const mergeLayout = (n) => {
    // a fixed extra gap at each split point, wider for splits higher up the tree
    const extra = new Array(n).fill(0);
    const split = (lo, hi, depth) => {
      if (lo >= hi) return;
      const mid = Math.floor((lo + hi) / 2);
      extra[mid] = Math.max(extra[mid], Math.max(4, 30 - 9 * depth));
      split(lo, mid, depth + 1); split(mid + 1, hi, depth + 1);
    };
    split(0, n - 1, 0);
    const xs = [];
    let x = 0;
    for (let k = 0; k < n; k++) { xs.push(x); x += MW + MG + extra[k]; }
    return xs;
  };
  X.topic({
    id: 'merge-sort', family: 'sort', order: 40, title: 'Merge sort',
    blurb: 'Split the array in half, sort each half the same way, then merge the two sorted halves through a temporary array. Splitting goes down to single values; all the work happens on the way back up.',
    code: `/* merge the sorted runs a[lo..mid] and a[mid+1..hi] */
void merge(int a[], int tmp[], int lo, int mid, int hi)
{
    int i = lo, j = mid + 1, k = lo;     /*@ init */
    while (i <= mid && j <= hi) {        /*@ both */
        if (a[i] <= a[j])                /*@ compare */
            tmp[k++] = a[i++];           /*@ place-left */
        else
            tmp[k++] = a[j++];           /*@ place-right */
    }
    while (i <= mid)                     /*@ rest-left */
        tmp[k++] = a[i++];               /*@ copy-left */
    while (j <= hi)                      /*@ rest-right */
        tmp[k++] = a[j++];               /*@ copy-right */
    for (k = lo; k <= hi; k++)           /*@ back */
        a[k] = tmp[k];                   /*@ copy-back */
}

void merge_sort(int a[], int tmp[], int lo, int hi)
{
    int mid;
    if (lo >= hi)                        /*@ base */
        return;                          /*@ single */
    mid = (lo + hi) / 2;                 /*@ split */
    merge_sort(a, tmp, lo, mid);         /*@ left */
    merge_sort(a, tmp, mid + 1, hi);     /*@ right */
    merge(a, tmp, lo, mid, hi);          /*@ merged */
}`,
    animate: ['merge_sort', 'merge'],
    inputs: [Object.assign({}, X.sortValues, { max: 10 })],
    presets: [
      { label: 'Mixed', values: { values: [38, 27, 43, 3, 9, 82, 10, 55] } },
      { label: 'Odd length', values: { values: [64, 25, 12, 22, 11, 90, 47] } },
      { label: 'Reverse sorted', values: { values: [80, 70, 60, 50, 40, 30, 20, 10] } },
      { label: 'Already sorted', values: { values: [5, 12, 19, 26, 33, 40] } },
      { label: 'Two', values: { values: [9, 2] } },
    ],
    counters: ['compares', 'moves'],
    main: (inp) => `int main(void)
{
    int a[] = { ${inp.values.join(', ')} };
    int tmp[${inp.values.length}];
    int n = ${inp.values.length};
    merge_sort(a, tmp, 0, n - 1);
    return 0;
}`,
    capture(P) {
      const n = P.val('n');
      const calls = P.calls().filter((c) => c.fn === 'merge_sort' || c.fn === 'merge').map((c) => ({ fn: c.fn, lo: c.args.lo, hi: c.args.hi, mid: c.args.mid }));
      return { a: P.arr('a', n), tmp: P.arr('tmp', n), n, vars: ints(P, ['lo', 'mid', 'hi', 'i', 'j', 'k']), calls };
    },
    scene(ctx) {
      const d = ctx.tick.data, v = d.vars, tag = ctx.tick.tag, a = d.a, n = d.n;
      const memo = ctx.memo;
      const done = allDone(ctx);
      const xs = memo.xs || (memo.xs = mergeLayout(n));
      if (!memo.aIds) { memo.aIds = a.map((_, k) => 'm' + k); memo.tIds = new Array(n).fill(null); memo.side = {}; memo.runs = []; }
      const aIds = memo.aIds, tIds = memo.tIds;
      // the cards travel: into tmp from a[i] or a[j], and back from tmp[k] into a[k]
      if (tag === 'place-left' || tag === 'copy-left') { tIds[v.k - 1] = aIds[v.i - 1]; aIds[v.i - 1] = null; memo.side[tIds[v.k - 1]] = 'l'; }
      if (tag === 'place-right' || tag === 'copy-right') { tIds[v.k - 1] = aIds[v.j - 1]; aIds[v.j - 1] = null; memo.side[tIds[v.k - 1]] = 'r'; }
      if (tag === 'copy-back') { aIds[v.k] = tIds[v.k]; tIds[v.k] = null; }
      // merge has returned (its end tick shows the caller, merge_sort, with the same lo..hi): one sorted run
      const mergeEnd = ctx.tick.end && ctx.tick.fn === 'merge';
      if (mergeEnd) {
        memo.runs = memo.runs.filter((r) => r[0] < v.lo || r[1] > v.hi);
        memo.runs.push([v.lo, v.hi]);
        for (let k = v.lo; k <= v.hi; k++) delete memo.side[aIds[k]];
        memo.lastRun = [v.lo, v.hi];
      }
      if (tag === 'base' && v.lo >= v.hi) memo.base = v.lo;
      const sorts = d.calls.filter((c) => c.fn === 'merge_sort');
      const merging = d.calls.length && d.calls[d.calls.length - 1].fn === 'merge' ? d.calls[d.calls.length - 1] : null;
      // the row of a slot: the depth of the deepest call whose range holds it
      const rowOf = (k) => Math.max(0, sorts.filter((c) => c.lo <= k && k <= c.hi).length - 1);
      const yOf = (r) => r * ROW;
      const items = [];
      const inRun = (k) => memo.runs.some((r) => r[0] <= k && k <= r[1] && r[1] > r[0]);
      const card = (id, x, y, text, sub, cls) => items.push({ key: id, kind: 'cell', x, y, w: MW, h: MW, text, sub, cls, enter: 'grow' });
      for (let k = 0; k < n; k++) {
        const y = yOf(rowOf(k));
        const id = aIds[k];
        if (id) {
          const side = memo.side[id];
          const half = merging && k >= merging.lo && k <= merging.hi ? (k <= merging.mid ? 'l' : 'r') : null;
          card('e' + id, xs[k], y, a[k], k, done ? 'done' : side ? 'sa-half-' + side : half ? 'sa-half-' + half : inRun(k) ? 'sa-run' : '');
        } else {
          // the value has gone down into tmp; memory keeps a stale copy here
          card('ag' + k, xs[k], y, a[k], k, 'sa-stale');
        }
      }
      // room on the left for the call labels
      items.push({ key: 'pad', kind: 'text', x: -96, y: 0, text: '' });
      // the bands: one per active call, on its own row
      sorts.forEach((c, depth) => {
        const x0 = xs[c.lo] - 8, x1 = xs[c.hi] + MW + 8;
        items.push({ key: 'band' + depth, kind: 'region', x: x0, y: yOf(depth) - 12, w: x1 - x0, h: MW + 34, cls: 'sa-band sa-d' + ((depth % 5) + 1) + (depth === sorts.length - 1 && !merging ? ' sa-active' : '') });
        items.push({ key: 'lbl' + depth, kind: 'text', x: -24, y: yOf(depth) + MW / 2 + 5, text: 'a[' + c.lo + '..' + c.hi + ']', cls: 'sa-depth' + (depth === sorts.length - 1 && !merging ? ' sa-on' : ''), anchor: 'end' });
      });
      let tmpRow = null;
      if (merging) {
        tmpRow = sorts.length;
        const lo = merging.lo, hi = merging.hi;
        const ty = yOf(tmpRow);
        items.push({ key: 'tband', kind: 'region', x: xs[lo] - 8, y: ty - 12, w: xs[hi] + MW + 16 - xs[lo], h: MW + 34, cls: 'sa-tmp' });
        items.push({ key: 'tlbl', kind: 'text', x: -24, y: ty + MW / 2 + 5, text: 'tmp', cls: 'sa-depth sa-on', anchor: 'end' });
        for (let k = lo; k <= hi; k++) {
          const id = tIds[k];
          if (id) card('e' + id, xs[k], ty, d.tmp[k], k, 'sa-half-' + memo.side[id]);
          else card('tg' + k, xs[k], ty, d.tmp[k] === null ? '' : d.tmp[k], k, 'sa-stale');
        }
        // the split point between the two halves
        const mx = (xs[merging.mid] + MW + xs[merging.mid + 1]) / 2;
        items.push({ key: 'midline', kind: 'line', x1: mx, y1: yOf(tmpRow - 1) - 8, x2: mx, y2: yOf(tmpRow - 1) + MW + 8, cls: 'sa-wall' });
      } else if (tag === 'split' && v.mid !== null) {
        const r = rowOf(v.lo);
        const mx = (xs[v.mid] + MW + xs[v.mid + 1]) / 2;
        items.push({ key: 'midline', kind: 'line', x1: mx, y1: yOf(r) - 8, x2: mx, y2: yOf(r) + MW + 8, cls: 'sa-cmp' });
      }
      // read and write cursors during a merge
      const keyAt = (k) => (aIds[k] ? 'e' + aIds[k] : 'ag' + k);
      const tkeyAt = (k) => (tIds[k] ? 'e' + tIds[k] : 'tg' + k);
      if (merging && tag !== 'enter') {
        const lo = merging.lo, hi = merging.hi, mid = merging.mid;
        const ry = yOf(tmpRow - 1);
        const mk = (name, idx, at, y, side) => {
          if (idx === null) return;
          const inside = idx >= lo && idx <= hi;
          if (inside) items.push({ key: 'm' + name, kind: 'cursor', at, side, text: name, cls: X.ListKit.cursorCls(name) });
          else items.push({ key: 'm' + name, kind: 'cursor', x: xs[Math.min(idx, n - 1)] + MW / 2 + (idx >= n ? MW + MG : 0), y: side === 'above' ? y - 4 : y + MW + 18, ty: side === 'above' ? y - 30 : y + MW + 44, text: name + ' done', cls: X.ListKit.cursorCls(name) });
        };
        if (tag !== 'back' && tag !== 'copy-back') {
          if (v.i !== null) mk('i', v.i, v.i <= mid ? keyAt(v.i) : null, ry, 'above');
          if (v.j !== null) mk('j', v.j, v.j <= hi ? keyAt(v.j) : null, ry, 'above');
        }
        if (v.k !== null) mk('k', v.k, v.k <= hi ? tkeyAt(v.k) : null, yOf(tmpRow), 'below');
        if (tag === 'compare' && v.i <= mid && v.j <= hi) {
          items.push({ key: 'cmpt', kind: 'text', x: (xs[lo] + xs[hi] + MW) / 2, y: ry - 52, text: a[v.i] + (a[v.i] <= a[v.j] ? ' ≤ ' : ' > ') + a[v.j] + ': take ' + Math.min(a[v.i], a[v.j]) + (a[v.i] <= a[v.j] ? ' from the left' : ' from the right'), cls: 'sa-hot', anchor: 'middle' });
        }
      }
      const top = sorts.length ? sorts[sorts.length - 1] : null;
      let say = '';
      const L = v.lo, H = v.hi, M = v.mid;
      const seg = (p, q) => list(a.slice(p, q + 1));
      switch (tag) {
        case 'enter': say = 'merge_sort(a, tmp, 0, ' + (n - 1) + '): sort all ' + n + ' values. tmp is a spare array of the same size, used only while merging.'; break;
        case 'base': say = L >= H ? 'merge_sort(' + L + ', ' + H + ') holds one value, ' + a[L] + ': one value is already sorted.' : 'merge_sort(' + L + ', ' + H + ') holds ' + (H - L + 1) + ' values: split them and sort each half first.'; break;
        case 'single': say = 'return: a single value, ' + a[memo.base] + ', is already sorted. It goes back up to merge_sort(' + L + ', ' + H + ').'; break;
        case 'split': say = 'mid = (' + L + ' + ' + H + ') / 2 = ' + M + ': the left half is a[' + L + '..' + M + '], the right half a[' + (M + 1) + '..' + H + '].'; break;
        case 'left': say = 'The left half goes first, all the way down: call merge_sort(a, tmp, ' + L + ', ' + H + '). ' + (H === L ? 'Its one value drops' : 'Its ' + (H - L + 1) + ' values drop') + ' down to level ' + sorts.length + '.'; break;
        case 'right': say = 'The left half is sorted. Now call merge_sort(a, tmp, ' + L + ', ' + H + ') on the right half: ' + (H === L ? 'its one value drops' : 'its ' + (H - L + 1) + ' values drop') + ' down to level ' + sorts.length + '.'; break;
        case 'merged': say = 'Both halves are sorted runs: ' + seg(L, M) + ' and ' + seg(M + 1, H) + '. Call merge to combine them into one.'; break;
        case 'init': say = 'Merge a[' + L + '..' + M + '] with a[' + (M + 1) + '..' + H + ']: i reads the left run, j the right run, k writes into tmp[' + L + '..' + H + '].'; break;
        case 'both': say = v.i <= M && v.j <= H ? 'Both runs still have values. Their smallest are at the front: a[' + v.i + '] = ' + a[v.i] + ' and a[' + v.j + '] = ' + a[v.j] + '.' : (v.i > M ? 'The left run is used up.' : 'The right run is used up.') + ' The loop of comparisons ends.'; break;
        case 'compare': say = 'Is ' + a[v.i] + ' ≤ ' + a[v.j] + '? ' + (a[v.i] <= a[v.j] ? 'Yes: ' + a[v.i] + ' from the left run goes next.' : 'No: ' + a[v.j] + ' from the right run goes next.'); break;
        case 'place-left': say = 'tmp[' + (v.k - 1) + '] = ' + d.tmp[v.k - 1] + ' from the left run; i and k move on.'; break;
        case 'place-right': say = 'tmp[' + (v.k - 1) + '] = ' + d.tmp[v.k - 1] + ' from the right run; j and k move on.'; break;
        case 'rest-left': say = v.i <= M ? 'The left run still has ' + seg(v.i, M) + '. They are sorted and bigger than everything in tmp, so they are copied without comparing.' : 'Nothing is left in the left run.'; break;
        case 'copy-left': say = 'tmp[' + (v.k - 1) + '] = ' + d.tmp[v.k - 1] + ', copied straight across.'; break;
        case 'rest-right': say = v.j <= H ? 'The right run still has ' + seg(v.j, H) + '. They are copied without comparing.' : 'Nothing is left in the right run.'; break;
        case 'copy-right': say = 'tmp[' + (v.k - 1) + '] = ' + d.tmp[v.k - 1] + ', copied straight across.'; break;
        case 'back': say = v.k <= H ? (v.k === L ? 'tmp[' + L + '..' + H + '] holds the merged run. Copy it back into a, one value at a time.' : 'Next: tmp[' + v.k + '].') : 'All of tmp[' + L + '..' + H + '] is back in a.'; break;
        case 'copy-back': say = 'a[' + v.k + '] = tmp[' + v.k + '] = ' + a[v.k] + '.'; break;
        case 'after': say = 'Sorted: ' + list(a) + '. ' + plural(ctx.counters.compares, 'comparison') + ', and ' + plural(ctx.counters.moves, 'copy', 'copies') + ' into tmp and back.'; break;
        default:
          if (mergeEnd) say = 'merge returns. a[' + L + '..' + H + '] is one sorted run now: ' + seg(L, H) + '.';
          else if (ctx.tick.end && L !== null) say = 'merge_sort(' + memo.lastRun[0] + ', ' + memo.lastRun[1] + ') is done and returns. Its sorted values rise back up to merge_sort(' + L + ', ' + H + ').';
          else if (ctx.tick.end) say = 'The top call returns: the whole array is one sorted run.';
          else say = '';
      }
      void top;
      return { items, say, slow: tag === 'merged' || tag === 'single' };
    },
    predict: [
      { at: (t) => t.tag === 'split' && t.data.vars.lo === 0, once: true, ask: (t) => 'mid = ' + t.data.vars.mid + '. Which call runs next?', options: (ts, i) => { const v = ts[i].data.vars; return ['merge_sort(a, tmp, ' + v.lo + ', ' + v.mid + ')', 'merge_sort(a, tmp, ' + (v.mid + 1) + ', ' + v.hi + ')', 'merge(a, tmp, ' + v.lo + ', ' + v.mid + ', ' + v.hi + ')']; }, answer: (ts, i) => { const v = ts[i].data.vars; return 'merge_sort(a, tmp, ' + v.lo + ', ' + v.mid + ')'; }, pick: 'option', explain: () => 'The left half is sorted completely, all the way down to single values, before the right half is even started.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'compare', once: true, ask: (t, ts, i) => { const d = ts[i + 1].data; return 'The fronts of the runs are ' + d.a[d.vars.i] + ' (left) and ' + d.a[d.vars.j] + ' (right). Which goes into tmp first?'; }, options: (ts, i) => { const d = ts[i + 1].data; return [d.a[d.vars.i] + ' from the left', d.a[d.vars.j] + ' from the right']; }, answer: (ts, i) => { const d = ts[i + 1].data; return d.a[d.vars.i] <= d.a[d.vars.j] ? d.a[d.vars.i] + ' from the left' : d.a[d.vars.j] + ' from the right'; }, pick: 'option', explain: () => 'The smaller front goes first; on a tie the left one, which keeps the sort stable.' },
      { at: (t, i, ts) => { const u = ts[i + 1]; return !!u && ((u.tag === 'rest-left' && u.data.vars.i <= u.data.vars.mid) || (u.tag === 'rest-right' && u.data.vars.j <= u.data.vars.hi)); }, once: true, ask: 'One run is used up. What happens to the values left in the other run?', options: () => ['They are copied across as they are', 'Each is compared again', 'They stay in a', 'They are merged later'], answer: () => 'They are copied across as they are', pick: 'option', explain: () => 'They are already in order and bigger than everything in tmp so far, so no comparison is needed.' },
    ],
    quiz: [
      { q: 'Where does merge sort do its comparisons?', options: ['While splitting', 'Only while merging', 'In the base case', 'While copying back'], answer: 1, why: 'Splitting just computes mid. All comparing happens in merge, on the way back up.' },
      { q: 'How many levels of halving does an array of 8 values go through?', options: ['8', '3', '4', '2'], answer: 1, why: '8 → 4 → 2 → 1: log2 8 = 3 levels. Each level does about n work in its merges, so n log n in total.' },
      { q: 'Why is the tmp array needed?', options: ['To store the recursion', 'Merging in place would overwrite values of the left run before they are used', 'To count comparisons', 'It is not needed'], answer: 1, why: 'The merged run is built in tmp and then copied back. This is the price of merge sort: n extra places of memory.' },
      { q: 'What is the running time of merge sort on already sorted input?', options: ['n', 'n log n, the same as always', 'n²', 'log n'], answer: 1, why: 'It splits and merges the same way whatever the order; sorted input only saves a few comparisons in each merge.' },
      { q: 'Why does merge take from the left run when the two fronts are equal (a[i] <= a[j])?', options: ['It is faster', 'It keeps equal values in their original order: the sort is stable', 'To avoid going out of bounds', 'No reason'], answer: 1, why: 'The left run came first in the array, so taking from it first keeps equal values in their original order.' },
    ],
    compareWith: 'quick-sort',
  });

  // ---- shell sort ----------------------------------------------------------------------------------------
  // Bars coloured by gap group (index mod gap). The group being worked on stays bright, the others fade,
  // and coloured lanes under the bars show which slots belong together. A shift is a jump of gap places.
  const gapsOf = (n) => { const g = []; for (let k = Math.floor(n / 2); k > 0; k = Math.floor(k / 2)) g.push(k); return g; };
  X.topic({
    id: 'shell-sort', family: 'sort', order: 60, title: 'Shell sort',
    blurb: 'Insertion sort on values far apart first: with gap g, every g-th value forms a group that is sorted on its own. Big jumps early mean little is left to move when the gap reaches 1.',
    code: `void shell_sort(int a[], int n)
{
    int gap, i, j, key;
    for (gap = n / 2; gap > 0; gap /= 2) {           /*@ gap */
        for (i = gap; i < n; i++) {                  /*@ pass */
            key = a[i];                              /*@ lift */
            j = i;                                   /*@ start */
            while (j >= gap && a[j - gap] > key) {   /*@ compare */
                a[j] = a[j - gap];                   /*@ shift */
                j -= gap;                            /*@ hop */
            }
            a[j] = key;                              /*@ drop */
        }
    }
}`,
    animate: ['shell_sort'],
    inputs: [X.sortValues],
    presets: [
      { label: 'Ten values', values: { values: [62, 83, 18, 53, 7, 17, 95, 86, 47, 69] } },
      { label: 'Reverse sorted', values: { values: [80, 70, 60, 50, 40, 30, 20, 10] } },
      { label: 'Small values at the end', values: { values: [40, 50, 60, 70, 80, 90, 10, 20] } },
      { label: 'Twelve values', values: { values: [35, 33, 42, 10, 14, 19, 27, 44, 26, 31, 8, 21] } },
      { label: 'Already sorted', values: { values: [5, 12, 19, 26, 33, 40, 47, 54] } },
    ],
    counters: ['compares', 'moves'],
    main: (inp) => X.sortMain(inp.values, 'shell_sort(a, n);'),
    capture(P) {
      const n = P.val('n');
      return { a: P.arr('a', n), n, vars: ints(P, ['gap', 'i', 'j', 'key']) };
    },
    scene(ctx) {
      const d = ctx.tick.data, v = d.vars, tag = ctx.tick.tag, a = d.a, n = d.n;
      const memo = ctx.memo;
      const done = allDone(ctx);
      if (!memo.ids) { memo.ids = a.map((_, k) => 's' + k); memo.hole = null; memo.keyId = null; memo.moved = {}; }
      const ids = memo.ids;
      let hopFrom = null;
      if (tag === 'lift') { memo.keyId = ids[v.i]; memo.hole = v.i; memo.shifts = 0; }
      if (tag === 'shift') { ids[v.j] = ids[v.j - v.gap]; ids[v.j - v.gap] = memo.keyId; memo.hole = v.j - v.gap; memo.shifts++; hopFrom = v.j - v.gap; }
      if (tag === 'drop') { ids[v.j] = memo.keyId; memo.keyId = null; memo.hole = null; }
      if (tag === 'gap' && v.gap > 0) memo.moved[v.gap] = 0;
      if (tag === 'shift') memo.moved[v.gap]++;
      if (tag === 'compare' && v.j >= v.gap) memo.cmp = (memo.cmp || 0) + 1;
      const gap = v.gap !== null && v.gap > 0 ? v.gap : null;
      const working = gap !== null && v.i !== null && v.i < n && ['lift', 'start', 'compare', 'shift', 'hop', 'drop'].includes(tag);
      const grp = working ? v.i % gap : null;
      // the key is drawn where it will go: in the hole, while bigger values of its group jump over it
      const vals = a.slice();
      if (memo.hole !== null) vals[memo.hole] = v.key;
      const view = A.bars(ctx, vals, {
        tracked: { ids: ids.slice(), swaps: [], wrote: new Set(), copies: [] },
        cls: (k) => {
          if (done) return 'done';
          if (gap === null) return '';
          const g = 'sa-g' + (k % gap) % 6;
          if (grp !== null && k % gap !== grp) return g + ' sa-faint';
          if (memo.hole === k) return 'sa-key';
          if (tag === 'compare' && k === v.j - gap) return 'hot';
          return g;
        },
      });
      const items = view.items;
      if (hopFrom !== null) for (const it of items) if (it.key === view.keyOf(v.j)) { it.arc = 70; it.flash = true; }
      // lanes: one coloured line per group, through the slots it owns
      if (gap !== null && !done) {
        for (let g = 0; g < gap; g++) {
          let last = g;
          while (last + gap < n) last += gap;
          const y = BASE + 108 + g * 13;
          items.push({ key: 'lane' + g, kind: 'line', x1: view.xOf(g), y1: y, x2: view.xOf(last), y2: y, cls: 'sa-lane sa-g' + (g % 6) + (grp !== null && g !== grp ? ' sa-faint' : '') });
          for (let k = g; k < n; k += gap) items.push({ key: 'dot' + k, kind: 'token', x: view.xOf(k), y, r: 5, cls: ['c-teal', 'c-amber', 'c-violet', 'c-rose', 'c-indigo', 'c-green'][g % 6] + ' small' });
        }
      }
      // the gap sequence across the top
      const seq = gapsOf(n);
      seq.forEach((g, k) => {
        const on = gap === g && !done, past = done || (gap !== null ? g > gap : v.gap === 0);
        items.push({ key: 'seq' + k, kind: 'text', x: 70 + k * 86, y: -34, text: 'gap ' + g, cls: 'sa-seq' + (on ? ' sa-on' : past ? ' sa-past' : '') });
      });
      items.push({ key: 'seqt', kind: 'text', x: 0, y: -34, text: 'gaps', cls: 'sa-title' });
      if (tag === 'compare' && gap !== null && v.j >= gap) {
        const top = Math.max(1, ...vals.map(Math.abs));
        const yv = (val) => BASE - Math.max(4, Math.abs(val) / top * HMAX) - 6;
        items.push({ key: 'cmp', kind: 'line', x1: view.xOf(v.j - gap), y1: yv(vals[v.j - gap]), x2: view.xOf(v.j), y2: yv(vals[v.j]), cls: 'sa-cmp' });
        items.push({ key: 'cmpt', kind: 'text', x: (view.xOf(v.j - gap) + view.xOf(v.j)) / 2, y: 6, text: vals[v.j - gap] > v.key ? vals[v.j - gap] + ' > ' + v.key + ': jump ' + gap + ' right' : vals[v.j - gap] + ' ≤ ' + v.key + ': stop', cls: 'sa-hot', anchor: 'middle' });
      }
      const marks = {};
      if (working && tag !== 'lift') marks.j = v.j;
      if (working) marks.i = v.i;
      items.push(...A.markers(view, marks, { y: BASE }));
      if (memo.hole !== null && working) items.push({ key: 'keytag', kind: 'cursor', at: view.keyOf(memo.hole), side: 'above', text: 'key ' + v.key, cls: 'c-green' });

      let say = '';
      const G = v.gap, I = v.i, J = v.j, K = v.key;
      const members = (g) => { const o = []; for (let k = g; k < n; k += G) o.push('a[' + k + ']'); return o.join(', '); };
      switch (tag) {
        case 'enter': say = 'shell_sort(a, ' + n + '): insertion sort on values gap apart, with the gaps ' + seq.join(', ') + '. The last pass, gap 1, is a plain insertion sort.'; break;
        case 'gap':
          if (G > 0) say = G === 1 ? 'gap = 1: one group, the whole array. This is plain insertion sort, but the earlier gaps have left every value close to its place, so little has to move.' : 'gap = ' + G + ': the array splits into ' + G + ' interleaved groups, one colour each. The group of a[0] is ' + members(0) + '. Each group is sorted on its own.';
          else say = 'gap = 0: the gap sequence is over and the array is sorted.';
          break;
        case 'pass': say = I < n ? (G === 1 ? 'i = ' + I + ': insert a[' + I + '] = ' + a[I] + ' into the sorted part a[0..' + (I - 1) + '].' : 'i = ' + I + ': insert a[' + I + '] = ' + a[I] + ' into its group (' + members(I % G) + '). The members before it are already in order.') : 'i = ' + n + ': every group is sorted for gap ' + G + '. This gap moved ' + plural(memo.moved[G] || 0, 'value') + '.'; break;
        case 'lift': say = 'key = ' + K + '. Its bar is drawn where it will end up; the bigger values of its group jump over it.'; break;
        case 'start': say = 'j = ' + J + ': compare the key with its neighbour in the group, ' + (J >= G ? 'a[' + (J - G) + '] = ' + vals[J - G] + ', ' + plural(G, 'place') + ' to the left.' : 'but there is none: j < gap.'); break;
        case 'compare': say = J < G ? 'j = ' + J + ' < gap ' + G + ': no group neighbour left of it. The key stays at a[' + J + '].' : vals[J - G] > K ? 'Is a[' + (J - G) + '] = ' + vals[J - G] + ' > key ' + K + '? Yes: ' + vals[J - G] + ' jumps ' + plural(G, 'place') + ' right.' : 'Is a[' + (J - G) + '] = ' + vals[J - G] + ' > key ' + K + '? No: the key belongs at a[' + J + '].'; break;
        case 'shift': say = 'a[' + J + '] = a[' + (J - G) + ']: ' + a[J] + ' moves ' + plural(G, 'place') + ' right in one step' + (G > 1 ? '; plain insertion sort would need ' + G + ' shifts for the same distance.' : '.'); break;
        case 'hop': say = 'j -= gap: j = ' + J + '. The next group neighbour to compare is ' + (J >= G ? 'a[' + (J - G) + '] = ' + vals[J - G] + '.' : 'none: j < gap.'); break;
        case 'drop': say = 'a[' + J + '] = key: ' + K + ' settles at a[' + J + ']' + (J !== I ? ', ' + plural(I - J, 'place') + ' left of where it started.' : '; it did not have to move.'); break;
        case 'after': say = 'Sorted: ' + list(a) + '. ' + plural(memo.cmp || 0, 'comparison') + ' of two values and ' + plural(ctx.counters.moves, 'move') + ': ' + seq.map((g) => 'gap ' + g + ' moved ' + (memo.moved[g] || 0)).join(', ') + '.'; break;
        default: say = '';
      }
      return { items, say, slow: tag === 'gap' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'gap' && ts[i + 1].data.vars.gap > 1, once: true, ask: (t, ts, i) => 'Next, gap = ' + ts[i + 1].data.vars.gap + '. Which slots will be in the same group as a[0]?', options: (ts, i) => { const n = ts[i + 1].data.n, g = ts[i + 1].data.vars.gap; const by = (s) => { const o = []; for (let k = 0; k < n; k += s) o.push(k); return o.join(', '); }; return [...new Set([by(g), by(1), by(2), '0, ' + g])]; }, answer: (ts, i) => { const n = ts[i + 1].data.n, g = ts[i + 1].data.vars.gap; const o = []; for (let k = 0; k < n; k += g) o.push(k); return o.join(', '); }, pick: 'option', explain: (ts, i) => 'Every ' + ts[i + 1].data.vars.gap + '-th slot, starting at 0: the indexes that leave the same remainder when divided by the gap.' },
      { at: (t, i, ts) => { const u = ts[i + 1]; return !!u && u.tag === 'compare' && u.data.vars.j >= u.data.vars.gap && u.data.vars.gap > 1; }, once: true, ask: (t, ts, i) => { const d = ts[i + 1].data; return 'key = ' + d.vars.key + ', and its group neighbour ' + d.vars.gap + ' places left holds ' + d.a[d.vars.j - d.vars.gap] + '. What happens next?'; }, options: (ts, i) => ['It jumps ' + ts[i + 1].data.vars.gap + ' places right', 'The key stays here'], answer: (ts, i) => { const d = ts[i + 1].data; return d.a[d.vars.j - d.vars.gap] > d.vars.key ? 'It jumps ' + d.vars.gap + ' places right' : 'The key stays here'; }, pick: 'option', explain: () => 'A bigger neighbour moves right by a whole gap; one move can carry a value far.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'gap' && ts[i + 1].data.vars.gap === 1 && t.data.n > 3, once: true, ask: 'Next comes gap = 1, a plain insertion sort. Compared with insertion sort on the original input, will it move...', options: () => ['Fewer values', 'The same number', 'More values'], answer: (ts, i, ctx) => { const v = ctx.input.values; let inv = 0; for (let p = 0; p < v.length; p++) for (let q = p + 1; q < v.length; q++) if (v[p] > v[q]) inv++; const last = ts.slice(i + 1).filter((t) => t.tag === 'shift').length; return last < inv ? 'Fewer values' : last === inv ? 'The same number' : 'More values'; }, pick: 'option', explain: (ts, i, ctx) => { const v = ctx.input.values; let inv = 0; for (let p = 0; p < v.length; p++) for (let q = p + 1; q < v.length; q++) if (v[p] > v[q]) inv++; return 'Plain insertion sort would move ' + plural(inv, 'value') + ' here; the gap-1 pass moves ' + plural(ts.slice(i + 1).filter((t) => t.tag === 'shift').length, 'value') + ', because the big gaps already carried values close to their places.'; } },
    ],
    quiz: [
      { q: 'With n = 10, which gaps does this shell sort use?', options: ['5, 2, 1', '10, 5, 1', '4, 2, 1', '3, 1'], answer: 0, why: 'gap starts at n / 2 = 5 and is halved with integer division: 5, 2, 1.' },
      { q: 'Why does shell sort end with gap = 1?', options: ['To save memory', 'Only gap 1 compares every pair of neighbours, so it guarantees the array is sorted', 'It is the fastest gap', 'It does not have to'], answer: 1, why: 'Larger gaps only sort their groups. The final gap-1 pass is an insertion sort, which always leaves the whole array sorted.' },
      { q: 'What is the advantage over plain insertion sort?', options: ['It uses less memory', 'A small value far to the right can jump many places in one move', 'It never compares', 'It is stable'], answer: 1, why: 'Insertion sort moves a value one place per shift. With a big gap, one shift moves it gap places, so little work is left for the end.' },
      { q: 'Is shell sort stable?', options: ['Yes', 'No: values in different groups can jump past equal values', 'Only for gap 1', 'Only on sorted input'], answer: 1, why: 'Two equal values in different gap groups are sorted separately, and one can be carried past the other.' },
      { q: 'With gap = 3, which index is in the same group as a[2]?', options: ['a[3]', 'a[5]', 'a[6]', 'a[4]'], answer: 1, why: 'Same group means the same remainder mod 3: 2, 5, 8 and so on.' },
    ],
    compareWith: 'insertion-sort',
  });
})(SEE);
