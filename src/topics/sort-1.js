// Sorting: the family and quick sort.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, A = X.ArrayKit;

  X.family({
    id: 'sort', order: 1, group: 'Sorting', title: 'Sorting',
    blurb: 'Every sort is a strategy for comparing and moving. Watch the comparisons, the swaps and the parts that are already done.',
    head: `#include <stdio.h>

/* exchange two ints through their addresses */
void swap(int *x, int *y)
{
    int t = *x;
    *x = *y;
    *y = t;
}`,
  });
  X.sortMain = (vals, call) => `int main(void)
{
    int a[] = { ${vals.join(', ')} };
    int n = ${vals.length};
    ${call}
    return 0;
}`;
  X.sortValues = { id: 'values', kind: 'ints', label: 'The numbers', def: [38, 27, 43, 3, 9, 82, 10, 55], min: 1, max: 12, check: (v) => (v.some((x) => x < 1 || x > 99) ? 'The numbers: from 1 to 99, so the bars fit' : null) };
  X.sortPresets = [
    { label: 'Mixed', values: { values: [38, 27, 43, 3, 9, 82, 10, 55] } },
    { label: 'Already sorted', values: { values: [5, 12, 19, 26, 33, 40, 47, 54] } },
    { label: 'Reverse sorted', values: { values: [80, 70, 60, 50, 40, 30, 20, 10] } },
    { label: 'Many equal', values: { values: [4, 9, 4, 1, 9, 4, 1, 4] } },
    { label: 'Two', values: { values: [9, 2] } },
  ];

  // ---- quick sort (Lomuto partition) ----------------------------------------------------------------------
  X.topic({
    id: 'quick-sort', family: 'sort', order: 50, title: 'Quick sort',
    blurb: 'Pick a pivot, push everything smaller to its left, and the pivot lands exactly where it belongs. Then do the same to each side.',
    code: `/* put the pivot (the last element) where it belongs:
   everything up to i is <= pivot, everything after i is bigger */
int partition(int a[], int lo, int hi)
{
    int pivot = a[hi];               /*@ pivot */
    int i = lo - 1;                  /*@ init-i */
    int j;
    for (j = lo; j < hi; j++) {      /*@ loop */
        if (a[j] <= pivot) {         /*@ compare */
            i++;                     /*@ grow */
            swap(&a[i], &a[j]);      /*@ swap */
        }
    }
    swap(&a[i + 1], &a[hi]);         /*@ swap-pivot */
    return i + 1;                    /*@ placed */
}

void quicksort(int a[], int lo, int hi)
{
    if (lo < hi) {                   /*@ range */
        int p = partition(a, lo, hi);    /*@ split */
        quicksort(a, lo, p - 1);     /*@ left */
        quicksort(a, p + 1, hi);     /*@ right */
    }
}`,
    animate: ['quicksort'], quiet: ['swap'],
    inputs: [X.sortValues], presets: X.sortPresets,
    counters: ['compares', 'swaps', 'writes'],
    main: (inp) => X.sortMain(inp.values, 'quicksort(a, 0, n - 1);'),
    capture(P) {
      const n = P.val('n');
      const vars = {};
      for (const v of ['lo', 'hi', 'i', 'j', 'p', 'pivot']) vars[v] = P.has(v, 0) && P.isSet(v, 0) ? P.val(v, 0) : null;
      return { a: P.arr('a', n), vars, fn: P.frames[0].name, calls: P.calls() };
    },
    scene(ctx) {
      const d = ctx.tick.data, v = d.vars, tag = ctx.tick.tag;
      const memo = ctx.memo;
      memo.final = memo.final || new Set();
      if (tag === 'placed' && v.i !== null) memo.final.add(v.i + 1);
      if (tag === 'range' && v.lo !== null && v.lo === v.hi) memo.final.add(v.lo);
      const inPart = d.fn === 'partition';
      const lo = v.lo, hi = v.hi;
      const finals = new Set(memo.final);
      if (ctx.tick.tag === 'after' || ctx.i === ctx.ticks.length - 1) d.a.forEach((_, k) => finals.add(k));
      const view = A.bars(ctx, d.a, {
        cls: (k) => {
          if (finals.has(k)) return 'done';
          if (lo !== null && hi !== null && (k < lo || k > hi)) return 'dim';
          if (inPart && k === hi) return 'pivot';
          return '';
        },
      });
      const items = view.items.slice();
      if (inPart && lo !== null && v.i !== null) {
        // the two zones: <= pivot (lo..i) and > pivot (i+1..j-1)
        items.push(...A.range(view, 'zone-le', lo, v.i, 'part-a', '≤ pivot', { cell: 40, y0: 0, h: 290 }));
        items.push(...A.range(view, 'zone-gt', v.i + 1, (v.j === null ? hi : v.j) - 1, 'part-b', '> pivot', { cell: 40, y0: 0, h: 290 }));
      }
      const marks = {};
      if (inPart) { if (v.i !== null && v.i >= lo) marks.i = v.i; if (v.j !== null && v.j < hi) marks.j = v.j; }
      else { if (lo !== null) marks.lo = lo; if (hi !== null) marks.hi = hi; }
      items.push(...A.markers(view, marks, { y: 260 }));
      if (inPart && tag === 'compare' && v.j !== null) {
        // the comparison: a line from a[j] to the pivot
        const hMax = 220, max = Math.max(...d.a);
        const yj = 260 - d.a[v.j] / max * hMax, yp = 260 - d.a[hi] / max * hMax;
        items.push({ key: 'cmp', kind: 'line', x1: view.xOf(v.j), y1: yj - 6, x2: view.xOf(hi), y2: yp - 6, cls: 'hot' });
      }
      if (inPart && v.pivot !== null) items.push({ key: 'pv', kind: 'text', x: view.xOf(hi), y: 260 - 220 - 18, text: 'pivot ' + v.pivot, cls: 'hot', anchor: 'middle' });
      const depth = d.calls.filter((c) => c.fn === 'quicksort').length;
      items.push({ key: 'call', kind: 'text', x: 0, y: -10, text: depth ? 'call depth ' + depth + ': quicksort(lo=' + lo + ', hi=' + hi + ')' : '', cls: 'title' });
      const a = d.a;
      let say = '';
      switch (tag) {
        case 'enter': say = 'quicksort(a, 0, ' + (a.length - 1) + ') is called on the whole array.'; break;
        case 'range': say = lo < hi ? 'This call sorts a[' + lo + '..' + hi + ']: ' + (hi - lo + 1) + ' elements, so there is work to do.' : 'a[' + lo + '..' + hi + '] has ' + (hi >= lo ? 'one element' : 'no elements') + ': already sorted, nothing to do.'; break;
        case 'pivot': say = 'The pivot is the last element of the range, a[' + hi + '] = ' + v.pivot + '. Everything else will be compared with it.'; break;
        case 'init-i': say = 'i marks the end of the "≤ pivot" zone. It starts just before lo, because the zone is empty.'; break;
        case 'loop': say = v.j < hi ? 'j moves on to a[' + v.j + '] = ' + a[v.j] + ', the next element nobody has looked at.' : 'j has reached the pivot: every element has been compared.'; break;
        case 'compare': say = 'Is a[' + v.j + '] = ' + a[v.j] + ' ≤ ' + v.pivot + '? ' + (a[v.j] <= v.pivot ? 'Yes: it belongs in the left zone.' : 'No: it stays where it is, in the "> pivot" zone.'); break;
        case 'grow': say = 'The left zone grows by one: i = ' + v.i + '.'; break;
        case 'swap': say = v.i === v.j ? 'Swap a[' + v.i + '] with itself: it is already in the left zone.' : 'Swap a[' + v.i + '] and a[' + v.j + ']: the small value ' + a[v.i] + ' moves into the left zone, and the bigger ' + a[v.j] + ' moves out.'; break;
        case 'swap-pivot': say = 'Finally the pivot swaps into a[' + (v.i + 1) + '], right after the left zone. Smaller values on its left, bigger ones on its right.'; break;
        case 'placed': say = a[v.i + 1] + ' is now exactly where it will be in the sorted array, and never moves again.'; break;
        case 'split': say = v.p === null ? 'Call partition() on a[' + lo + '..' + hi + ']: it chooses a pivot and moves everything smaller to its left.' : 'partition() returned ' + v.p + ': the pivot is in its final place; the two sides are sorted separately.'; break;
        case 'left': say = 'Now sort the left side, a[' + lo + '..' + (v.p - 1) + ']: the same steps on a smaller range, in a call of its own.'; break;
        case 'right': say = 'The left side is done. Now sort the right side, a[' + (v.p + 1) + '..' + hi + '].'; break;
        case 'after': say = 'Sorted: ' + a.join(' ') + '. ' + ctx.counters.compares + ' comparisons, ' + ctx.counters.swaps + ' swaps.'; break;
        default: say = '';
      }
      return { items, say, calls: d.calls, slow: tag === 'swap-pivot' || tag === 'placed' };
    },
    predict: [
      { at: (t) => t.tag === 'swap-pivot', once: true, ask: (t) => 'The pivot ' + t.data.vars.pivot + ' is about to swap into place. At which index will it land?', options: (ts, i) => { const v = ts[i].data.vars; const o = []; for (let k = v.lo; k <= v.hi; k++) o.push(String(k)); return o; }, answer: (ts, i) => String(ts[i].data.vars.i + 1), pick: 'option', explain: (ts, i) => 'Right after the "≤ pivot" zone, which ends at i = ' + ts[i].data.vars.i + '.' },
      { at: (t) => t.tag === 'compare' && t.data.vars.j !== null, once: true, ask: (t) => 'Is a[j] = ' + t.data.a[t.data.vars.j] + ' ≤ the pivot ' + t.data.vars.pivot + '? What happens next?', options: () => ['It swaps into the left zone', 'It stays where it is'], answer: (ts, i) => (ts[i].data.a[ts[i].data.vars.j] <= ts[i].data.vars.pivot ? 'It swaps into the left zone' : 'It stays where it is'), pick: 'option' },
    ],
    quiz: [
      { q: 'After one call of partition, which element is sure to be in its final place?', options: ['The first element', 'The pivot', 'The smallest element', 'None'], answer: 1, why: 'Everything smaller is on its left and everything bigger on its right, so the pivot is exactly where it belongs.' },
      { q: 'What is the worst case for this quick sort, which always picks the last element as pivot?', options: ['Random input', 'Already sorted input', 'All different values', 'A short array'], answer: 1, why: 'On sorted input the pivot is always the largest, so one side is empty and the other has n-1 elements: n² comparisons.' },
      { q: 'How much extra memory does quick sort use?', options: ['An array of n', 'None at all', 'The call stack, log n deep on average', 'Two arrays'], answer: 2, why: 'It sorts in place, but each recursive call has a frame: about log n deep on average, n deep in the worst case.' },
    ],
    compareWith: 'merge-sort',
  });
})(SEE);
