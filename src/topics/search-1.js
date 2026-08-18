// Searching an array: the family, linear search, sentinel search and binary search.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, A = X.ArrayKit, S = X.SearchKit;

  X.family({
    id: 'search', order: 1, group: 'Searching', title: 'Searching an array',
    blurb: 'Find where a key sits in an array, or learn that it is not there. The question is always how many elements you must look at.',
    head: (t) => '#include <stdio.h>' + (t && t.id === 'jump-search' ? '\n#include <math.h>' : ''),
  });

  /** main: the array and the key, then one call; pos holds the answer */
  X.searchMain = (vals, call) => `int main(void)
{
    int a[] = { ${vals.join(', ')} };
    int n = ${vals.length};
    int pos;
    pos = ${call};
    printf("%d\\n", pos);
    return 0;
}`;
  X.searchValues = (def, extra) => Object.assign({ id: 'values', kind: 'ints', label: 'The array', def, min: 1, max: 12 }, extra || {});
  X.searchKey = (def, lo, hi) => ({ id: 'key', kind: 'int', label: 'Key to find', def, lo: lo === undefined ? -999 : lo, hi: hi === undefined ? 999 : hi });
  const plural = (k, w) => k + ' ' + (k === 1 ? w : w + (/s$/.test(w) ? 'es' : 's'));
  const span = (l, h) => (l === h ? 'a[' + l + ']' : 'a[' + l + '..' + h + ']');
  X.span = span;
  X.plural = plural;

  // ---- linear search -------------------------------------------------------------------------------------
  X.topic({
    id: 'linear-search', family: 'search', order: 10, title: 'Linear search',
    blurb: 'No order to rely on, so look at every element from the left until the key turns up or the array runs out.',
    code: `/* return the index of the first a[i] equal to key, or -1 */
int linear_search(int a[], int n, int key)
{
    int i;
    for (i = 0; i < n; i++) {        /*@ loop */
        if (a[i] == key)             /*@ compare */
            return i;                /*@ found */
    }
    return -1;                       /*@ missing */
}`,
    animate: ['linear_search'],
    inputs: [X.searchValues([42, 17, 8, 23, 91, 4, 56, 30]), X.searchKey(91)],
    presets: [
      { label: 'Found in the middle', values: { values: [42, 17, 8, 23, 91, 4, 56, 30], key: 91 } },
      { label: 'Not there', values: { values: [42, 17, 8, 23, 91, 4, 56, 30], key: 50 } },
      { label: 'The first element', values: { values: [42, 17, 8, 23, 91, 4, 56, 30], key: 42 } },
      { label: 'Twice in the array', values: { values: [5, 12, 7, 12, 3, 12], key: 12 } },
      { label: 'One element', values: { values: [7], key: 7 } },
    ],
    counters: ['compares'],
    main: (inp) => X.searchMain(inp.values, 'linear_search(a, n, ' + inp.key + ')'),
    capture: S.capture(['i']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, a = d.a, n = a.length;
      const memo = ctx.memo;
      const v = S.keep(ctx, ['i']);
      const i = v.i === undefined ? null : v.i;
      memo.seen = memo.seen || new Set();
      if (tag === 'compare' && a[i] !== key) memo.seen.add(i);
      if (tag === 'compare' && a[i] === key) memo.hit = i;
      const hit = memo.hit === undefined ? null : memo.hit;
      const view = A.cells(ctx, a, {
        cls: (k) => (k === hit && (tag === 'compare' || tag === 'found' || tag === 'after') ? 'found' : k === i && (tag === 'loop' || tag === 'compare') ? 'probe' : memo.seen.has(k) ? 'seen' : ''),
      });
      const items = view.items;
      // a cross over every element already ruled out, a tick over the one that matched
      for (const k of memo.seen) items.push({ key: 'x' + k, kind: 'text', x: S.xOf(k), y: -12, text: '✗', cls: 's-x', anchor: 'middle' });
      if (hit !== null) items.push({ key: 'ok', kind: 'text', x: S.xOf(hit), y: -12, text: '✓', cls: 's-ok', anchor: 'middle' });
      // where the array ends: an empty slot the loop walks into when the key is missing
      const ended = i === n;
      items.push({ key: 'end', kind: 'region', x: n * (S.CELL + S.GAP), y: 0, w: S.CELL, h: S.CELL, cls: 'spare', text: '', opacity: ended ? 1 : 0.35 });
      items.push({ key: 'endt', kind: 'text', x: S.xOf(n), y: S.CELL + 15, text: 'n = ' + n, cls: 's-note', anchor: 'middle' });
      // the key travels along above the element being looked at
      if (i !== null && tag !== 'enter') {
        items.push(S.keyBadge(key, S.xOf(i), -52));
        if (tag === 'compare') items.push({ key: 'q', kind: 'text', x: S.xOf(i), y: -82, text: a[i] + (a[i] === key ? ' = ' : ' ≠ ') + key, cls: a[i] === key ? 's-good' : 's-bad', anchor: 'middle' });
        if (i < n || tag !== 'after') items.push(...A.markers(view, { i }, { y: 0 }));
      } else items.push(S.keyBadge(key, -64, 28));
      const looked = memo.seen.size + (hit !== null ? 1 : 0);
      items.push({ key: 'tally', kind: 'text', x: 0, y: -120, text: 'looked at ' + looked + ' of ' + n, cls: 's-title' });
      let say = '';
      switch (tag) {
        case 'enter': say = 'linear_search(a, ' + n + ', ' + key + '): nothing is known about the order of the elements, so the only way is to look at them one by one, from the left.'; break;
        case 'loop':
          if (i === 0) say = 'i starts at 0: the first element, a[0] = ' + a[0] + '.';
          else if (i < n) say = 'i moves on to ' + i + '. Everything to the left of it has been ruled out.';
          else say = 'i = ' + n + ' = n: the test i < n fails. Every element has been looked at.';
          break;
        case 'compare': say = 'Is a[' + i + '] = ' + a[i] + ' equal to ' + key + '? ' + (a[i] === key ? 'Yes.' : 'No: cross it off and move on.'); break;
        case 'found': say = 'Return ' + i + '. It took ' + plural(i + 1, 'comparison') + '; the ' + plural(n - i - 1, 'element') + ' after it were never looked at.'; break;
        case 'missing': say = key + ' is not in the array. Proving that took all ' + n + ' comparisons: a missing key is the worst case.'; break;
        case 'after': say = 'linear_search returned ' + d.pos + (d.pos >= 0 ? ': a[' + d.pos + '] = ' + key + '.' : ': the key is not there.'); break;
      }
      return { items, say, slow: tag === 'found' || tag === 'missing', view: S.view(n + 1, -150, 150) };
    },
    predict: [
      {
        at: (t) => t.tag === 'loop', once: true, ask: (t, ts) => 'How many elements will the search look at before it stops?', pick: 'option',
        options: (ts, i) => ts[i].data.a.map((_, k) => String(k + 1)),
        answer: (ts) => String(ts.filter((t) => t.tag === 'compare').length),
        explain: (ts) => { const c = ts.filter((t) => t.tag === 'compare').length; return ts.some((t) => t.tag === 'found') ? 'The key is first found at index ' + (c - 1) + ', so the search looks at indexes 0 to ' + (c - 1) + '.' : 'The key is not there, so every one of the ' + c + ' elements is looked at.'; },
      },
      {
        at: (t, i, ts) => t.tag === 'compare' && ts[i + 1] && ts[i + 1].tag === 'found', once: true, pick: 'option',
        ask: (t) => 'a[' + t.data.v.i + '] equals the key. Does the loop look at the rest of the array?',
        options: () => ['Yes, it checks for other copies', 'No, it returns straight away'], answer: () => 'No, it returns straight away',
        explain: () => 'return leaves the function at once. That is also why a duplicate further right is never reported.',
      },
      {
        at: (t) => t.tag === 'loop' && t.data.v.i === t.data.n, once: true, pick: 'option',
        ask: (t) => 'i is now ' + t.data.n + ', equal to n. What happens next?',
        options: (ts, i) => ['a[' + ts[i].data.n + '] is compared with the key', 'The loop ends and -1 is returned'], answer: () => 'The loop ends and -1 is returned',
        explain: (ts, i) => 'There is no a[' + ts[i].data.n + ']: the last element is a[' + (ts[i].data.n - 1) + ']. The test i < n stops the loop before it reads past the end.',
      },
    ],
    quiz: [
      { q: 'How many comparisons does linear search make on n elements when the key is missing?', options: ['1', 'log2 n', 'n', 'n squared'], answer: 2, why: 'It cannot stop until every element has been ruled out: n comparisons.' },
      { q: 'If the key is present and equally likely to be at any position, about how many comparisons are made on average?', options: ['1', 'About n / 2', 'n', 'log2 n'], answer: 1, why: 'Position k costs k + 1 comparisons; averaged over all positions that is (n + 1) / 2.' },
      { q: 'The key appears at indexes 2 and 5. What does this function return?', options: ['2', '5', 'Both', '-1'], answer: 0, why: 'It returns at the first match, scanning from the left, so it reports index 2 and never sees index 5.' },
      { q: 'Does linear search need the array to be sorted?', options: ['Yes, always', 'No, it works on any order', 'Only for negative numbers', 'Only when the key is missing'], answer: 1, why: 'It looks at every element, so order does not matter. That is its strength, and why it is slow.' },
      { q: 'The array happens to be sorted, and the scan meets an element bigger than the key. What could a smarter loop do?', options: ['Nothing different', 'Stop: the key cannot be further right', 'Go back to the start', 'Swap the two'], answer: 1, why: 'In a sorted array everything further right is even bigger, so the key cannot be there. The worst case is still n comparisons.' },
    ],
    compareWith: 'binary-search',
  });

  // ---- sentinel search -----------------------------------------------------------------------------------
  X.topic({
    id: 'sentinel-search', family: 'search', order: 15, title: 'Sentinel linear search',
    blurb: 'Plant the key in the last slot, and the loop is sure to stop there. Then it needs only one test per element instead of two.',
    code: `/* linear search with one test per element: the key itself,
   planted in the last slot, stops the loop */
int sentinel_search(int a[], int n, int key)
{
    int last = a[n - 1];             /*@ save */
    int i = 0;                       /*@ start */
    a[n - 1] = key;                  /*@ plant */
    while (a[i] != key)              /*@ compare */
        i++;                         /*@ step */
    a[n - 1] = last;                 /*@ restore */
    if (i < n - 1 || last == key)    /*@ decide */
        return i;                    /*@ found */
    return -1;                       /*@ missing */
}`,
    animate: ['sentinel_search'],
    inputs: [X.searchValues([42, 17, 8, 23, 91, 4, 56, 30]), X.searchKey(4)],
    presets: [
      { label: 'Found', values: { values: [42, 17, 8, 23, 91, 4, 56, 30], key: 4 } },
      { label: 'Not there', values: { values: [42, 17, 8, 23, 91, 4, 56, 30], key: 60 } },
      { label: 'The key is the last element', values: { values: [42, 17, 8, 23, 91, 4, 56, 30], key: 30 } },
      { label: 'One element, missing', values: { values: [7], key: 9 } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => X.searchMain(inp.values, 'sentinel_search(a, n, ' + inp.key + ')'),
    capture: S.capture(['i', 'last']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, a = d.a, n = a.length;
      const memo = ctx.memo, orig = ctx.input.values;
      const v = S.keep(ctx, ['i', 'last']);
      const i = v.i === undefined ? null : v.i, last = v.last === undefined ? null : v.last;
      memo.tests = memo.tests || 0;
      memo.seen = memo.seen || new Set();
      if (tag === 'compare' && memo.at !== ctx.i) { memo.tests++; memo.at = ctx.i; if (a[i] !== key) memo.seen.add(i); }
      if (tag === 'plant') memo.planted = true;
      if (tag === 'restore') memo.planted = false;
      const planted = !!memo.planted;
      const boxX = n * (S.CELL + S.GAP) + 40;
      const view = A.cells(ctx, a, {
        cls: (k) => {
          if (k === n - 1 && planted) return 'sentinel' + (k === i && tag === 'compare' ? ' probe' : '');
          if (k === i && tag === 'compare') return a[k] === key ? 'found' : 'probe';
          if ((tag === 'found' || tag === 'after' && d.pos >= 0) && k === (tag === 'after' ? d.pos : i)) return 'found';
          return memo.seen.has(k) ? 'seen' : '';
        },
      });
      const items = view.items;
      // the planted key flies in from the badge; the saved value flies back from its box
      const lastItem = items.find((it) => it.key === view.keyOf(n - 1));
      if (tag === 'plant' && lastItem) { lastItem.enter = 'fly'; lastItem.from = { x: -64 - S.CELL / 2, y: 0 }; }
      if (tag === 'restore' && lastItem) { lastItem.enter = 'fly'; lastItem.from = { x: boxX, y: 0 }; }
      items.push(S.keyBadge(key, -64, 28));
      items.push({ key: 'kl', kind: 'text', x: -64, y: -6, text: 'key', cls: 's-rose', anchor: 'middle' });
      // the saved last element waits in its own box
      if (last !== null && tag !== 'after' && tag !== 'found' && tag !== 'missing') {
        items.push({ key: 'lastbox', kind: 'node', x: boxX, y: 4, w: 64, h: 48, cells: [{ text: last, cls: 'val' }], label: 'last', cls: 'saved', enter: tag === 'save' ? 'fly' : 'fade', from: { x: S.xOf(n - 1) - 32, y: 4 } });
      }
      if (planted) {
        items.push({ key: 'sent', kind: 'text', x: S.xOf(n - 1), y: -14, text: 'sentinel', cls: 's-rose', anchor: 'middle' });
        items.push({ key: 'wall', kind: 'line', x1: S.xOf(n - 1) + S.CELL / 2 + 3, y1: -6, x2: S.xOf(n - 1) + S.CELL / 2 + 3, y2: S.CELL + 6, cls: 'wall' });
      }
      if (i !== null && tag !== 'after') items.push(...A.markers(view, { i }, { y: 0 }));
      if (tag === 'compare') items.push({ key: 'q', kind: 'text', x: S.xOf(i), y: -40, text: a[i] + (a[i] !== key ? ' ≠ ' : ' = ') + key, cls: a[i] !== key ? 's-bad' : 's-good', anchor: 'middle' });
      // the saving: one test per step here, two in an ordinary loop
      const steps = memo.tests;
      items.push({ key: 'tally', kind: 'text', x: 0, y: -100, text: 'tests made: ' + steps, cls: 's-title' });
      if (steps) items.push({ key: 'tally2', kind: 'text', x: 0, y: -78, text: 'an ordinary loop (i < n, then a[i] == key) would have made ' + (2 * steps) + ' by now', cls: 's-note' });
      let say = '';
      switch (tag) {
        case 'enter': say = 'sentinel_search(a, ' + n + ', ' + key + '). An ordinary linear search tests two things per element: is i still inside the array, and is a[i] the key? This version gets rid of the first test.'; break;
        case 'save': say = 'Save the last element, a[' + (n - 1) + '] = ' + last + ', in last. Its slot is about to be borrowed.'; break;
        case 'start': say = 'i = 0: the walk starts at the first element.'; break;
        case 'plant': say = 'Plant the key ' + key + ' in a[' + (n - 1) + ']. Now the loop is certain to meet the key, by a[' + (n - 1) + '] at the latest, so it never needs to check i < n.'; break;
        case 'compare': say = a[i] !== key ? 'Is a[' + i + '] = ' + a[i] + ' different from ' + key + '? Yes: keep going. One test, not two.' : 'a[' + i + '] = ' + key + ': the loop stops here' + (i === n - 1 ? ', at the sentinel.' : '.'); break;
        case 'step': say = 'i = ' + i + '.'; break;
        case 'restore': say = 'Put the saved ' + last + ' back in a[' + (n - 1) + ']. The caller gets its array back unchanged.'; break;
        case 'decide':
          if (i < n - 1) say = 'The loop stopped at i = ' + i + ', before the last slot: a real element matched.';
          else if (last === key) say = 'The loop stopped at the last slot, but the saved element there was ' + key + ' all along: a real match.';
          else say = 'The loop stopped at the last slot only because of the sentinel. The real a[' + (n - 1) + '] is ' + last + ', not ' + key + ': the key is not in the array.';
          break;
        case 'found': say = 'Return ' + i + ' after ' + plural(steps, 'test') + ' in the loop.'; break;
        case 'missing': say = 'Return -1. ' + steps + ' tests in the loop, where an ordinary linear search would have made ' + (2 * n + 1) + '.'; break;
        case 'after': say = 'sentinel_search returned ' + d.pos + '. The array in main is exactly as it was: ' + a.join(' ') + '.'; break;
      }
      return { items, say, slow: tag === 'plant' || tag === 'restore' || tag === 'decide', view: S.view(n, -130, 150, -100, 140) };
    },
    predict: [
      {
        at: (t) => t.tag === 'plant', once: true, pick: 'option',
        ask: 'The loop below has no i < n test. If the key is not in the array, what stops it?',
        options: () => ['The key planted in the last slot', 'Nothing: it runs off the end', 'The return -1 line'], answer: () => 'The key planted in the last slot',
        explain: () => 'The loop stops when a[i] equals the key, and a[n - 1] now holds the key. So it stops there at the latest.',
      },
      {
        at: (t) => t.tag === 'decide', once: true, pick: 'option',
        ask: (t) => 'The loop stopped at i = ' + t.data.v.i + '. Does the function report the key as found?',
        options: (ts, i) => ['Yes, it returns ' + ts[i].data.v.i, 'No, it returns -1'],
        answer: (ts, i) => (ts.slice(i).some((t) => t.tag === 'found') ? 'Yes, it returns ' + ts[i].data.v.i : 'No, it returns -1'),
        explain: () => 'Stopping before the last slot is always a real match. Stopping at the last slot is a real match only if the saved element there was the key too.',
      },
    ],
    quiz: [
      { q: 'What does the sentinel save, compared with an ordinary linear search?', options: ['Half the elements', 'The i < n test on every step', 'The comparisons with the key', 'Nothing'], answer: 1, why: 'The loop is sure to stop at the sentinel, so the bounds test can go. Each step makes one test instead of two.' },
      { q: 'Why does the function save a[n - 1] in last and put it back?', options: ['To sort the array', 'So the caller gets its array back unchanged, and so a real key in the last slot can be recognised', 'To free memory', 'It does not need to'], answer: 1, why: 'The slot is borrowed for the sentinel. The saved value is restored, and it also decides the case where the loop stops at the last slot.' },
      { q: 'What is the worst case number of elements looked at?', options: ['n, the same as linear search', 'n / 2', 'log2 n', '1'], answer: 0, why: 'It is still a linear search: a missing key means walking the whole array. Only the cost per step is smaller.' },
      { q: 'When can this trick not be used?', options: ['When the array is sorted', 'When the array cannot be written to, for example it is const or shared with another thread', 'When n is even', 'When the key is negative'], answer: 1, why: 'Planting the sentinel writes into the array. Read-only or shared data must not be changed, even for a moment.' },
    ],
    compareWith: 'linear-search',
  });

  // ---- binary search --------------------------------------------------------------------------------------
  X.topic({
    id: 'binary-search', family: 'search', order: 20, title: 'Binary search',
    blurb: 'In a sorted array, look at the middle. One comparison tells you which half cannot hold the key, and that half is gone.',
    code: `/* a[0..n-1] is sorted; return an index of key, or -1 */
int binary_search(int a[], int n, int key)
{
    int lo = 0, hi = n - 1, mid;         /*@ init */
    while (lo <= hi) {                   /*@ range */
        mid = lo + (hi - lo) / 2;        /*@ mid */
        if (a[mid] == key)               /*@ compare-eq */
            return mid;                  /*@ found */
        else if (a[mid] < key)           /*@ compare-lt */
            lo = mid + 1;                /*@ go-right */
        else
            hi = mid - 1;                /*@ go-left */
    }
    return -1;                           /*@ missing */
}`,
    animate: ['binary_search'],
    inputs: [X.searchValues([3, 8, 15, 21, 27, 33, 40, 46, 52, 61, 70, 84], { sorted: true }), X.searchKey(21)],
    presets: [
      { label: 'Found', values: { values: [3, 8, 15, 21, 27, 33, 40, 46, 52, 61, 70, 84], key: 21 } },
      { label: 'Not there', values: { values: [3, 8, 15, 21, 27, 33, 40, 46, 52, 61, 70, 84], key: 50 } },
      { label: 'The last element', values: { values: [3, 8, 15, 21, 27, 33, 40, 46, 52, 61, 70, 84], key: 84 } },
      { label: 'Smaller than all', values: { values: [10, 20, 30, 40, 50, 60, 70], key: 5 } },
      { label: 'One element', values: { values: [42], key: 42 } },
    ],
    counters: ['compares'],
    main: (inp) => X.searchMain(inp.values, 'binary_search(a, n, ' + inp.key + ')'),
    capture: S.capture(['lo', 'hi', 'mid']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, a = d.a, n = a.length;
      const memo = ctx.memo;
      const v = S.keep(ctx, ['lo', 'hi', 'mid']);
      const lo = v.lo === undefined ? 0 : v.lo, hi = v.hi === undefined ? n - 1 : v.hi, mid = v.mid === undefined ? null : v.mid;
      memo.sizes = memo.sizes || [];
      memo.guesses = memo.guesses || 0;
      if (memo.at !== ctx.i) {
        memo.at = ctx.i;
        if (tag === 'range') memo.sizes.push(Math.max(0, hi - lo + 1));
        if (tag === 'mid') memo.guesses++;
      }
      const started = tag !== 'enter';
      const out = (k) => started && (k < lo || k > hi);
      const done = tag === 'found' || tag === 'after' && d.pos >= 0;
      const looking = ['mid', 'compare-eq', 'compare-lt'].includes(tag);
      const view = A.cells(ctx, a, {
        cls: (k) => {
          if (done && k === mid) return 'found';
          if (k === mid && looking) return 'probe';
          if (out(k)) return 'out';
          // about to be ruled out: the half on the wrong side of mid
          if (tag === 'compare-lt' && (a[mid] < key ? k < mid : k > mid)) return 'seen';
          return '';
        },
      });
      const items = view.items;
      // ruled-out elements sink a little as they grey out
      for (const it of items) if (it.kind === 'cell') { const k = Math.round((it.x - 0) / (S.CELL + S.GAP)); if (out(k) && !(done && k === mid)) it.y += 22; }
      if (started && lo <= hi) items.push(...S.bracket('live', lo, hi, '', {}));
      items.push(S.keyBadge(key, 50, -118));
      items.push({ key: 'kl', kind: 'text', x: 0, y: -113, text: 'key', cls: 's-rose' });
      if (mid !== null && (looking || tag === 'found')) {
        items.push({ key: 'guess', kind: 'token', x: S.xOf(mid), y: -44, r: 17, text: tag === 'mid' ? '?' : String(a[mid]), cls: 'guess' });
        if (tag === 'compare-eq' || tag === 'compare-lt' || tag === 'found') {
          const rel = a[mid] === key ? '=' : a[mid] < key ? '<' : '>';
          const txt = a[mid] + ' ' + rel + ' ' + key + (rel === '<' ? ':  go right' : rel === '>' ? ':  go left' : ':  found');
          items.push({ key: 'q', kind: 'text', x: S.xOf(mid), y: -76, text: txt, cls: rel === '=' ? 's-good' : 's-hot', anchor: 'middle' });
        }
      }
      const marks = {};
      if (started && tag !== 'after') { if (lo <= hi || tag === 'range' || tag === 'missing') { marks.lo = lo; marks.hi = hi; } if (mid !== null && (looking || tag === 'found')) marks.mid = mid; }
      if (tag === 'missing' || tag === 'range' && lo > hi) { delete marks.mid; }
      items.push(...A.markers(view, marks, { y: 22 }));
      // how the live range shrinks, and how many guesses that can take at most
      const sizes = memo.sizes.length ? memo.sizes : [n];
      const strip = 'live range: ' + sizes.join(' → ');
      items.push({ key: 'strip', kind: 'text', x: 0, y: 190, text: strip, cls: 's-strip' });
      items.push({ key: 'strip2', kind: 'text', x: 0, y: 214, text: 'guesses so far: ' + memo.guesses + ' · never more than ' + S.maxGuesses(n) + ' for n = ' + n, cls: 's-note' });
      let say = '';
      switch (tag) {
        case 'enter': say = 'binary_search on ' + n + ' sorted values, looking for ' + key + '. Because the array is sorted, one look at the middle rules out half of what is left.'; break;
        case 'init': say = 'lo = 0 and hi = ' + (n - 1) + ' mark the live range: if ' + key + ' is anywhere, it is in a[' + lo + '..' + hi + '].'; break;
        case 'range': say = lo <= hi ? 'lo = ' + lo + ' ≤ hi = ' + hi + ': ' + plural(hi - lo + 1, 'element') + ' still possible, so guess again.' : 'lo = ' + lo + ' > hi = ' + hi + ': the live range is empty. There is nowhere left for ' + key + ' to be.'; break;
        case 'mid': say = 'Guess the middle of the live range: mid = ' + lo + ' + (' + hi + ' - ' + lo + ') / 2 = ' + mid + '.'; break;
        case 'compare-eq': say = 'Is a[' + mid + '] = ' + a[mid] + ' the key ' + key + '? ' + (a[mid] === key ? 'Yes.' : 'No.'); break;
        case 'compare-lt': say = a[mid] < key ? a[mid] + ' < ' + key + ': since the array is sorted, the key can only be to the right of mid. a[' + lo + '..' + mid + '] is ruled out in one go.' : a[mid] + ' > ' + key + ': the key can only be to the left of mid. a[' + mid + '..' + hi + '] is ruled out in one go.'; break;
        case 'go-right': say = 'lo = mid + 1 = ' + lo + '. ' + plural(Math.max(0, hi - lo + 1), 'element') + ' left.'; break;
        case 'go-left': say = 'hi = mid - 1 = ' + hi + '. ' + plural(Math.max(0, hi - lo + 1), 'element') + ' left.'; break;
        case 'found': say = 'Found ' + key + ' at index ' + mid + ' after ' + plural(memo.guesses, 'guess') + '. A linear search would have needed ' + (mid + 1) + '.'; break;
        case 'missing': say = 'Return -1 after ' + plural(memo.guesses, 'guess') + '. For ' + n + ' elements it can never take more than ' + S.maxGuesses(n) + ', because ' + n + ' can only be halved that many times before nothing is left.'; break;
        case 'after': say = 'binary_search returned ' + d.pos + '.'; break;
      }
      return { items, say, slow: tag === 'go-left' || tag === 'go-right', view: S.view(n, -150, 230) };
    },
    predict: [
      {
        at: (t) => t.tag === 'range', once: true, ask: 'Click the element binary search will look at first.',
        answer: (ts, i) => { const v = ts[i].data.v; return 'ea:' + (v.lo + Math.floor((v.hi - v.lo) / 2)); },
        explain: (ts, i) => { const v = ts[i].data.v; return 'The middle of a[' + v.lo + '..' + v.hi + ']: ' + v.lo + ' + (' + v.hi + ' - ' + v.lo + ') / 2 = ' + (v.lo + Math.floor((v.hi - v.lo) / 2)) + '.'; },
      },
      {
        at: (t) => t.tag === 'compare-lt', once: true, pick: 'option',
        ask: (t) => 'a[mid] = ' + t.data.a[t.data.v.mid] + ' is not the key. Which part is ruled out?',
        options: (ts, i) => { const v = ts[i].data.v; return ['a[' + v.lo + '..' + v.mid + ']: mid and everything left of it', 'a[' + v.mid + '..' + v.hi + ']: mid and everything right of it']; },
        answer: (ts, i) => { const d = ts[i].data, v = d.v; const key = ts[i + 1] && ts[i + 1].tag === 'go-right'; return key ? 'a[' + v.lo + '..' + v.mid + ']: mid and everything left of it' : 'a[' + v.mid + '..' + v.hi + ']: mid and everything right of it'; },
        explain: () => 'If a[mid] is smaller than the key, so is everything to its left; if it is bigger, so is everything to its right.',
      },
    ],
    quiz: [
      { q: 'What must be true of the array for binary search to work?', options: ['It has no duplicates', 'It is sorted', 'Its length is a power of two', 'It is small'], answer: 1, why: 'Ruling out a whole half needs order: if a[mid] < key, everything left of mid is smaller too.' },
      { q: 'About how many guesses does binary search need at most for 1000 elements?', options: ['10', '100', '500', '1000'], answer: 0, why: '1000 can be halved about 10 times before one element is left: 2 to the 10th is 1024.' },
      { q: 'The array doubles in size. How many more guesses can the worst case need?', options: ['Twice as many', 'One more', 'Ten more', 'The same'], answer: 1, why: 'The first guess halves the doubled array back to the old size. That is the meaning of log2 n.' },
      { q: 'Why mid = lo + (hi - lo) / 2 rather than (lo + hi) / 2?', options: ['It is faster', 'lo + hi can overflow an int for very large arrays', 'It rounds up', 'There is no difference at all'], answer: 1, why: 'Both give the same middle, but lo + hi can exceed INT_MAX for huge arrays. hi - lo never does.' },
      { q: 'If the loop test were lo < hi instead of lo <= hi, what would go wrong?', options: ['Nothing', 'A live range of one element would never be checked', 'It would loop forever', 'It would read past the end'], answer: 1, why: 'When lo == hi one element is still possible. With lo < hi the loop stops without looking at it.' },
    ],
    compareWith: 'linear-search',
  });
})(SEE);
