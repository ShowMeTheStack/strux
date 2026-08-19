// Searching an array: binary search for the first and the last copy of a key, and binary search in a
// sorted array that has been rotated.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, A = X.ArrayKit, S = X.SearchKit;
  const plural = X.plural, span = X.span;

  // ---- first and last occurrence --------------------------------------------------------------------------
  // The two share a picture: under every element, what the search has proved about it. Everything left of
  // lo is known to be on one side of the key, everything right of hi on the other; the "?" in between
  // shrinks to nothing, and the answer is the edge where the two kinds meet.
  function boundaryScene(mode) {
    const first = mode === 'first';
    const leftSym = first ? '<' : '≤', rightSym = first ? '≥' : '>';
    return function (ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, a = d.a, n = a.length;
      const memo = ctx.memo;
      const v = S.keep(ctx, ['lo', 'hi', 'mid', 'ans']);
      const lo = v.lo === undefined ? 0 : v.lo, hi = v.hi === undefined ? n - 1 : v.hi, mid = v.mid === undefined ? null : v.mid;
      const ans = v.ans === undefined ? null : v.ans;
      memo.trail = memo.trail || [];
      if (tag === 'record' && memo.at !== ctx.i) { memo.at = ctx.i; memo.trail.push(ans); }
      const started = !['enter', 'init'].includes(tag);
      const looking = ['mid', 'compare-eq', 'compare-lt'].includes(tag);
      const finished = tag === 'done' || tag === 'after' || tag === 'range' && lo > hi;
      const view = A.cells(ctx, a, {
        cls: (k) => {
          if (finished && k === ans) return 'found';
          if (k === mid && looking) return 'probe';
          if (started && (k < lo || k > hi)) return 'out';
          return a[k] === key ? 'match' : '';
        },
      });
      const items = view.items;
      // the copies of the key, so you can see which of them the search is after
      const copies = a.map((x, k) => (x === key ? k : -1)).filter((k) => k >= 0);
      if (copies.length) {
        const c0 = copies[0], c1 = copies[copies.length - 1];
        items.push({ key: 'run', kind: 'region', x: c0 * (S.CELL + S.GAP) - 4, y: -4, w: (c1 - c0) * (S.CELL + S.GAP) + S.CELL + 8, h: S.CELL + 8, cls: 'run', text: '' });
      }
      // what is known about each element: proved below the boundary, proved above it, or not known yet
      items.push(...S.chips(n, 84, (k) => {
        if (!started) return { text: '?', cls: 'unk' };
        if (k < lo) return { text: leftSym, cls: 'lt' };
        if (k > hi) return { text: rightSym, cls: 'ge' };
        return { text: '?', cls: 'unk' };
      }));
      items.push({ key: 'chipl', kind: 'text', x: -14, y: 101, text: 'known', cls: 's-note', anchor: 'end' });
      if (started && lo > hi) {
        // the boundary has been found: between hi and lo
        const bx = lo * (S.CELL + S.GAP) - S.GAP / 2;
        items.push({ key: 'edge', kind: 'line', x1: bx, y1: -16, x2: bx, y2: 116, cls: 'boundary' });
        items.push({ key: 'edget', kind: 'text', x: bx, y: -24, text: first ? 'first ≥ ' + key + ' starts here' : 'last ≤ ' + key + ' ends here', cls: 's-hot', anchor: 'middle' });
      }
      // ans: a pin under the best answer so far; in "last" mode the earlier pins stay as faint marks
      if (!first) memo.trail.forEach((p, k) => { if (p !== ans) items.push({ key: 'old' + k, kind: 'text', x: S.xOf(p), y: 140, text: '▲', cls: 's-note', anchor: 'middle' }); });
      if (ans !== null && ans >= 0) items.push({ key: 'ans', kind: 'cursor', x: S.xOf(ans), y: 112, tx: S.xOf(ans), ty: 140, text: 'ans', cls: 'c-green' });
      else if (ans !== null) items.push({ key: 'ansnone', kind: 'text', x: -14, y: 145, text: 'ans = -1', cls: 's-note', anchor: 'end' });
      const marks = {};
      if (started && tag !== 'after' && lo <= hi) { marks.lo = lo; marks.hi = hi; if (looking && mid !== null) marks.mid = mid; }
      items.push(...A.markers(view, marks, { side: 'above', y: 0 }));
      items.push(S.keyBadge(key, 50, -126));
      items.push({ key: 'kl', kind: 'text', x: 0, y: -121, text: 'key', cls: 's-rose' });
      if ((tag === 'compare-eq' || tag === 'compare-lt') && mid !== null) {
        const rel = a[mid] === key ? '=' : a[mid] < key ? '<' : '>';
        const txt = rel === '=' ? 'a[' + mid + '] = ' + key + ': a candidate, ' + (first ? 'look further left' : 'look further right') : 'a[' + mid + '] = ' + a[mid] + (rel === '<' ? ' < ' : ' > ') + key + (rel === '<' ? ': go right' : ': go left');
        items.push({ key: 'q', kind: 'text', x: 130, y: -121, text: txt, cls: rel === '=' ? 's-good' : 's-hot' });
      }
      let say = '';
      const found = copies.length;
      switch (tag) {
        case 'enter': say = first ? 'Find the first ' + key + '. ' + (found > 1 ? 'There are ' + found + ' copies; ordinary binary search would return whichever one it happens to hit.' : found ? 'There is only one copy, but the search does not know that.' : key + ' is not in the array; the search will have to prove it.') : 'Find the last ' + key + '. ' + (found > 1 ? 'There are ' + found + ' copies, and the search wants the rightmost one.' : found ? 'There is one copy, but the search does not know that.' : key + ' is not in the array; the search will have to prove it.'); break;
        case 'init': say = 'The live range is the whole array, a[0..' + (n - 1) + ']. Nothing is known yet: every element shows "?".'; break;
        case 'none-yet': say = 'ans = -1: no copy of ' + key + ' has been seen yet.'; break;
        case 'range': say = lo <= hi ? plural(hi - lo + 1, 'element') + ' still "?" (a[' + lo + '..' + hi + ']). Keep going.' : 'lo = ' + lo + ' > hi = ' + hi + ': no "?" left. Every element left of the line is ' + leftSym + ' ' + key + ', every one right of it is ' + rightSym + ' ' + key + '.'; break;
        case 'mid': say = 'mid = ' + lo + ' + (' + hi + ' - ' + lo + ') / 2 = ' + mid + ', where a[' + mid + '] = ' + a[mid] + '.'; break;
        case 'compare-eq': say = a[mid] === key ? 'a[' + mid + '] is ' + key + '. But a copy is not necessarily the ' + (first ? 'first' : 'last') + ' one: there may be more to its ' + (first ? 'left' : 'right') + '.' : 'a[' + mid + '] = ' + a[mid] + ' is not ' + key + '.'; break;
        case 'record': say = 'Remember it: ans = ' + ans + '. If nothing better turns up, this is the answer.'; break;
        case 'keep-left': say = 'hi = mid - 1 = ' + hi + ': keep searching to the left of the copy. Everything from a[' + (hi + 1) + '] on is now known to be ≥ ' + key + '.'; break;
        case 'keep-right': say = 'lo = mid + 1 = ' + lo + ': keep searching to the right of the copy. Everything up to a[' + (lo - 1) + '] is now known to be ≤ ' + key + '.'; break;
        case 'compare-lt': say = a[mid] < key ? a[mid] + ' < ' + key + ': the ' + (first ? 'first' : 'last') + ' copy must be to the right of mid.' : a[mid] + ' > ' + key + ': every copy must be to the left of mid.'; break;
        case 'go-right': say = 'lo = mid + 1 = ' + lo + '. Everything up to a[' + (lo - 1) + '] is ' + leftSym + ' ' + key + '.'; break;
        case 'go-left': say = 'hi = mid - 1 = ' + hi + '. Everything from a[' + (hi + 1) + '] on is ' + rightSym + ' ' + key + '.'; break;
        case 'done': say = ans >= 0 ? 'Return ans = ' + ans + '. The ' + (first ? 'first' : 'last') + ' copy sits right ' + (first ? 'after' : 'before') + ' the boundary, found in ' + plural(ctx.ticks.slice(0, ctx.i).filter((t) => t.tag === 'mid').length, 'step') + ' of halving.' : 'Return -1: the boundary was found, but the element next to it is not ' + key + ', so there are no copies.'; break;
        case 'after': say = (first ? 'first_of' : 'last_of') + ' returned ' + d.pos + '.' + (d.pos >= 0 && copies.length > 1 ? ' Even with ' + copies.length + ' copies, it still took only about log2 n steps.' : ''); break;
      }
      const vw = S.view(n, -160, 175, -80, 30);
      return { items, say, slow: tag === 'record' || tag === 'done', view: vw };
    };
  }

  const dupValues = (def) => X.searchValues(def, { sorted: true });
  const answerCell = (ts) => { const last = ts[ts.length - 1].data; return last.pos; };
  // the options for "which index will it return": every copy of the key, the place it would go, and -1
  const indexChoices = (ts, key) => {
    const a = ts[0].data.a, o = new Set(['-1', String(answerCell(ts))]);
    a.forEach((x, k) => { if (x === key) o.add(String(k)); });
    const at = a.findIndex((x) => x >= key);
    if (at >= 0) o.add(String(at));
    return [...o].map(Number).sort((x, y) => x - y).map(String);
  };

  X.topic({
    id: 'binary-first', family: 'search', order: 30, title: 'Binary search: first occurrence',
    blurb: 'Finding a copy of the key is not the end. Keep halving to the left until you reach the edge where the copies begin.',
    code: `/* a is sorted; return the index of the FIRST key, or -1 */
int first_of(int a[], int n, int key)
{
    int lo = 0, hi = n - 1, mid;         /*@ init */
    int ans = -1;                        /*@ none-yet */
    while (lo <= hi) {                   /*@ range */
        mid = lo + (hi - lo) / 2;        /*@ mid */
        if (a[mid] == key) {             /*@ compare-eq */
            ans = mid;                   /*@ record */
            hi = mid - 1;                /*@ keep-left */
        } else if (a[mid] < key)         /*@ compare-lt */
            lo = mid + 1;                /*@ go-right */
        else
            hi = mid - 1;                /*@ go-left */
    }
    return ans;                          /*@ done */
}`,
    animate: ['first_of'],
    inputs: [dupValues([2, 4, 7, 7, 7, 7, 7, 9, 12, 15, 20]), X.searchKey(7)],
    presets: [
      { label: 'A run of copies', values: { values: [2, 4, 7, 7, 7, 7, 7, 9, 12, 15, 20], key: 7 } },
      { label: 'All the same', values: { values: [5, 5, 5, 5, 5, 5, 5, 5], key: 5 } },
      { label: 'Copies at the start', values: { values: [3, 3, 3, 6, 8, 10, 11, 14], key: 3 } },
      { label: 'Not there', values: { values: [2, 4, 7, 7, 7, 9, 12, 15], key: 8 } },
      { label: 'One copy', values: { values: [1, 3, 5, 7, 9, 11, 13], key: 11 } },
    ],
    counters: ['compares'],
    main: (inp) => X.searchMain(inp.values, 'first_of(a, n, ' + inp.key + ')'),
    capture: S.capture(['lo', 'hi', 'mid', 'ans']),
    scene: boundaryScene('first'),
    predict: [
      {
        at: (t, i, ts) => t.tag === 'compare-eq' && ts[i + 1] && ts[i + 1].tag === 'record', once: true, pick: 'option',
        ask: (t) => 'a[' + t.data.v.mid + '] is the key. What does first_of do now?',
        options: () => ['Return ' + 'mid straight away', 'Remember mid and keep searching to the left', 'Keep searching to the right'],
        answer: () => 'Remember mid and keep searching to the left',
        explain: () => 'A copy further left would be an earlier occurrence, so the search remembers this one and carries on leftwards.',
      },
      {
        at: (t) => t.tag === 'range' && t.data.v.lo <= t.data.v.hi, once: true, pick: 'option',
        ask: 'Which index will first_of return in the end?',
        options: (ts, i, ctx) => indexChoices(ts, ctx.input.key),
        answer: (ts) => String(answerCell(ts)),
        explain: (ts) => { const p = answerCell(ts); return p >= 0 ? 'Index ' + p + ': the leftmost copy, right after the last element smaller than the key.' : 'None: the key is not there, so it returns -1.'; },
      },
    ],
    quiz: [
      { q: 'first_of finds the key at mid. Why does it not return at once?', options: ['It has a bug', 'There may be an earlier copy to the left', 'It needs to count the copies', 'It must check the right half'], answer: 1, why: 'A match proves the key exists, not that this is its first copy. Anything to the left might also be the key.' },
      { q: 'When the loop ends, what is true of every element left of lo?', options: ['It equals the key', 'It is smaller than the key', 'It is bigger than the key', 'Nothing is known'], answer: 1, why: 'lo only moves past elements proved smaller than the key, so a[0..lo-1] are all smaller. lo is the first place that is not.' },
      { q: 'An array of 1000 copies of the same key. How many steps does first_of take?', options: ['1', 'About 10', 'About 500', '1000'], answer: 1, why: 'Every step still halves the range: each match moves hi left of mid. About log2 1000 = 10 steps.' },
      { q: 'How would you count the copies of a key in a sorted array in O(log n)?', options: ['Linear scan from first_of', 'last_of minus first_of plus 1', 'n minus first_of', 'You cannot'], answer: 1, why: 'Two binary searches give both ends of the run; the count is last - first + 1 (or 0 if not found).' },
    ],
    compareWith: 'binary-last',
  });

  X.topic({
    id: 'binary-last', family: 'search', order: 31, title: 'Binary search: last occurrence',
    blurb: 'The mirror image: on a match, remember it and keep halving to the right. The answer pin moves right each time a later copy turns up.',
    code: `/* a is sorted; return the index of the LAST key, or -1 */
int last_of(int a[], int n, int key)
{
    int lo = 0, hi = n - 1, mid;         /*@ init */
    int ans = -1;                        /*@ none-yet */
    while (lo <= hi) {                   /*@ range */
        mid = lo + (hi - lo) / 2;        /*@ mid */
        if (a[mid] == key) {             /*@ compare-eq */
            ans = mid;                   /*@ record */
            lo = mid + 1;                /*@ keep-right */
        } else if (a[mid] < key)         /*@ compare-lt */
            lo = mid + 1;                /*@ go-right */
        else
            hi = mid - 1;                /*@ go-left */
    }
    return ans;                          /*@ done */
}`,
    animate: ['last_of'],
    inputs: [dupValues([1, 3, 3, 3, 3, 3, 3, 8, 10, 14, 19]), X.searchKey(3)],
    presets: [
      { label: 'A run of copies', values: { values: [1, 3, 3, 3, 3, 3, 3, 8, 10, 14, 19], key: 3 } },
      { label: 'Copies at the end', values: { values: [2, 6, 9, 11, 11, 11, 11, 11], key: 11 } },
      { label: 'All the same', values: { values: [4, 4, 4, 4, 4, 4, 4], key: 4 } },
      { label: 'Not there', values: { values: [1, 3, 3, 3, 8, 10, 14], key: 9 } },
      { label: 'One element', values: { values: [6], key: 6 } },
    ],
    counters: ['compares'],
    main: (inp) => X.searchMain(inp.values, 'last_of(a, n, ' + inp.key + ')'),
    capture: S.capture(['lo', 'hi', 'mid', 'ans']),
    scene: boundaryScene('last'),
    predict: [
      {
        at: (t) => t.tag === 'record', once: true, pick: 'option',
        ask: 'ans now points at this copy. Which way does the live range go next?',
        options: () => ['Left of mid', 'Right of mid', 'Nowhere: the search is over'], answer: () => 'Right of mid',
        explain: () => 'A later copy can only be to the right, so lo = mid + 1. ans keeps the copy in case none is found.',
      },
      {
        at: (t) => t.tag === 'range' && t.data.v.lo > t.data.v.hi, once: true, pick: 'option',
        ask: (t) => 'The loop is over: lo = ' + t.data.v.lo + ', hi = ' + t.data.v.hi + '. Which index will be returned?',
        options: (ts, i) => { const v = ts[i].data.v; const o = new Set(['-1', String(v.hi), String(v.lo)]); if (v.ans !== null) o.add(String(v.ans)); return [...o].sort((x, y) => x - y); },
        answer: (ts) => String(answerCell(ts)),
        explain: (ts, i) => { const v = ts[i].data.v; return v.ans >= 0 ? 'ans = ' + v.ans + ', which is hi: the last element that is ≤ the key, and it is a copy of the key.' : 'ans was never set, so -1: no copy was ever seen.'; },
      },
    ],
    quiz: [
      { q: 'In last_of, a match sets ans = mid and then...', options: ['hi = mid - 1', 'lo = mid + 1', 'returns', 'mid++'], answer: 1, why: 'A later copy could only be to the right of mid, so the live range moves right.' },
      { q: 'When the loop ends with the key present, which index equals ans?', options: ['lo', 'hi', 'mid always', 'n - 1'], answer: 1, why: 'Everything right of hi is bigger than the key and a[hi] is not, so a[hi] is the last element ≤ key: the last copy.' },
      { q: 'Why keep ans in a separate variable instead of reading a[hi] at the end?', options: ['It is faster', 'Without it you would still have to check that a[hi] really is the key, and that hi is not -1', 'C needs it', 'It saves memory'], answer: 1, why: 'The loop finds a boundary whether or not the key is there. ans is set only when a copy was actually seen, so it handles the missing key and the empty-left case.' },
      { q: 'The run of copies covers indexes 4 to 9. What do first_of and last_of return?', options: ['4 and 9', '9 and 4', 'Both 4', 'Any index from 4 to 9'], answer: 0, why: 'first_of finds the left edge of the run, last_of the right edge. The count is 9 - 4 + 1 = 6.' },
    ],
    compareWith: 'binary-first',
  });

  // ---- search in a rotated sorted array ----------------------------------------------------------------
  const isRotation = (v) => {
    let drops = 0;
    for (let k = 1; k < v.length; k++) if (v[k] < v[k - 1]) drops++;
    return drops === 0 || drops === 1 && v[v.length - 1] < v[0];
  };
  const BW = 40, BG = 8, bx = (k) => k * (BW + BG) + BW / 2;

  X.topic({
    id: 'binary-rotated', family: 'search', order: 40, title: 'Search a rotated sorted array',
    blurb: 'A sorted array cut in two and swapped round. At every mid, one half is still in order: check whether the key falls in that half\'s range.',
    code: `/* a is a sorted array that was rotated, all values different;
   return the index of key, or -1 */
int search_rotated(int a[], int n, int key)
{
    int lo = 0, hi = n - 1, mid;                  /*@ init */
    while (lo <= hi) {                            /*@ range */
        mid = lo + (hi - lo) / 2;                 /*@ mid */
        if (a[mid] == key)                        /*@ compare-eq */
            return mid;                           /*@ found */
        if (a[lo] <= a[mid]) {                    /*@ cmp-halves */
            /* a[lo..mid] is in order */
            if (a[lo] <= key && key < a[mid])     /*@ test-key-left */
                hi = mid - 1;                     /*@ go-left */
            else
                lo = mid + 1;                     /*@ go-right */
        } else {
            /* a[mid..hi] is in order */
            if (a[mid] < key && key <= a[hi])     /*@ test-key-right */
                lo = mid + 1;                     /*@ go-right */
            else
                hi = mid - 1;                     /*@ go-left */
        }
    }
    return -1;                                    /*@ missing */
}`,
    animate: ['search_rotated'],
    inputs: [
      X.searchValues([40, 52, 63, 77, 88, 95, 6, 14, 21, 33], { distinct: true, label: 'The rotated array', check: (v) => (v.some((x) => x < 1 || x > 99) ? 'The array: values from 1 to 99, so the bars fit' : !isRotation(v) ? 'The array: give a sorted list turned round, for example 40 52 63 6 14 21 (one drop only, and the end smaller than the start)' : null) }),
      X.searchKey(14, 1, 99),
    ],
    presets: [
      { label: 'Key after the drop', values: { values: [40, 52, 63, 77, 88, 95, 6, 14, 21, 33], key: 14 } },
      { label: 'Key before the drop', values: { values: [40, 52, 63, 77, 88, 95, 6, 14, 21, 33], key: 52 } },
      { label: 'Not there', values: { values: [40, 52, 63, 77, 88, 95, 6, 14, 21, 33], key: 50 } },
      { label: 'Drop near the end', values: { values: [12, 25, 31, 47, 58, 66, 70, 81, 3, 8], key: 8 } },
      { label: 'Not rotated at all', values: { values: [5, 18, 26, 37, 44, 59, 72, 90], key: 72 } },
    ],
    counters: ['compares'],
    main: (inp) => X.searchMain(inp.values, 'search_rotated(a, n, ' + inp.key + ')'),
    capture: S.capture(['lo', 'hi', 'mid']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, a = d.a, n = a.length;
      const memo = ctx.memo;
      const v = S.keep(ctx, ['lo', 'hi', 'mid']);
      const lo = v.lo === undefined ? 0 : v.lo, hi = v.hi === undefined ? n - 1 : v.hi, mid = v.mid === undefined ? null : v.mid;
      const started = tag !== 'enter';
      // which half is in order at this mid (decided on cmp-halves, kept for the test that follows)
      if (tag === 'mid') memo.half = null;
      if (tag === 'cmp-halves') memo.half = a[lo] <= a[mid] ? 'left' : 'right';
      const half = ['cmp-halves', 'test-key-left', 'test-key-right'].includes(tag) ? memo.half : null;
      const inHalf = (k) => (half === 'left' ? k >= lo && k <= mid : half === 'right' ? k >= mid && k <= hi : false);
      const done = tag === 'found' || tag === 'after' && d.pos >= 0;
      const max = Math.max(100, ...a, key);
      const view = S.bars(ctx, a, {
        bar: BW, gap: BG, max, base: 260, height: 220,
        cls: (k) => {
          if (done && k === mid) return 'found';
          if (k === mid && ['mid', 'compare-eq'].includes(tag)) return 'probe';
          if (started && (k < lo || k > hi)) return 'out';
          if (inHalf(k)) return 'half-a';
          return '';
        },
      });
      const items = view.items;
      const W = n * (BW + BG) - BG;
      // the drop: where the rotation cut the sorted array
      const drop = a.findIndex((x, k) => k > 0 && x < a[k - 1]);
      if (drop > 0) {
        const xd = drop * (BW + BG) - BG / 2;
        items.push({ key: 'drop', kind: 'line', x1: xd, y1: 30, x2: xd, y2: 262, cls: 'axis' });
        items.push({ key: 'dropt', kind: 'text', x: xd, y: 22, text: 'the drop', cls: 's-note', anchor: 'middle' });
      }
      // the sorted half's values form a band; the key either falls inside it or not
      if (half && (tag === 'test-key-left' || tag === 'test-key-right' || tag === 'cmp-halves')) {
        const k0 = half === 'left' ? lo : mid, k1 = half === 'left' ? mid : hi;
        const vLo = a[k0], vHi = a[k1];
        const inside = half === 'left' ? vLo <= key && key < vHi : vLo < key && key <= vHi;
        const y1 = view.yOf(vHi), y0 = view.yOf(vLo);
        items.push({ key: 'band', kind: 'region', x: k0 * (BW + BG) - 4, y: y1, w: (k1 - k0) * (BW + BG) + BW + 8, h: Math.max(6, y0 - y1), cls: 'band' + (tag !== 'cmp-halves' && !inside ? ' miss' : ''), text: '' });
        items.push({ key: 'bandt', kind: 'text', x: k0 * (BW + BG), y: y1 - 10, text: 'in order: ' + vLo + ' to ' + vHi, cls: 's-good' });
      }
      // the key as a level across the chart
      if (started) {
        items.push({ key: 'klevel', kind: 'line', x1: -12, y1: view.yOf(key), x2: W + 12, y2: view.yOf(key), cls: 'key-level' });
        items.push({ key: 'klevt', kind: 'text', x: W + 18, y: view.yOf(key) + 5, text: 'key ' + key, cls: 's-rose' });
      }
      items.push({ key: 'base', kind: 'line', x1: -10, y1: 261, x2: W + 10, y2: 261, cls: 'axis' });
      const marks = {};
      if (started && tag !== 'after' && lo <= hi) { marks.lo = lo; marks.hi = hi; if (mid !== null && tag !== 'range' && tag !== 'init') marks.mid = mid; }
      items.push(...A.markers(view, marks, { y: 260 }));
      let say = '';
      switch (tag) {
        case 'enter': say = 'This array was sorted, then rotated: ' + (drop > 0 ? 'it climbs to ' + a[drop - 1] + ', drops to ' + a[drop] + ', and climbs again.' : 'here by zero places, so it is simply sorted.') + ' Plain binary search would be fooled by the drop.'; break;
        case 'init': say = 'lo = 0, hi = ' + (n - 1) + ': the whole array is live.'; break;
        case 'range': say = lo <= hi ? plural(hi - lo + 1, 'element') + ' still live, ' + span(lo, hi) + '.' : 'lo = ' + lo + ' > hi = ' + hi + ': nothing left. ' + key + ' is not in the array.'; break;
        case 'mid': say = 'mid = ' + lo + ' + (' + hi + ' - ' + lo + ') / 2 = ' + mid + ', a[mid] = ' + a[mid] + '.'; break;
        case 'compare-eq': say = 'Is a[' + mid + '] = ' + a[mid] + ' the key ' + key + '? ' + (a[mid] === key ? 'Yes.' : 'No.'); break;
        case 'found': say = 'Found ' + key + ' at index ' + mid + '.'; break;
        case 'cmp-halves': say = a[lo] <= a[mid] ? 'a[lo] = ' + a[lo] + ' ≤ a[mid] = ' + a[mid] + ': no drop between lo and mid, so the left half ' + span(lo, mid) + ' is in order.' : 'a[lo] = ' + a[lo] + ' > a[mid] = ' + a[mid] + ': the drop is in the left half, so the right half ' + span(mid, hi) + ' must be in order.'; break;
        case 'test-key-left': { const ok = a[lo] <= key && key < a[mid]; say = 'Is ' + key + ' within the ordered half, ' + a[lo] + ' ≤ ' + key + ' < ' + a[mid] + '? ' + (ok ? 'Yes: the key line crosses the band, so search the left half.' : 'No: the key line misses the band. If it is anywhere, it is in the other half.'); break; }
        case 'test-key-right': { const ok = a[mid] < key && key <= a[hi]; say = 'Is ' + key + ' within the ordered half, ' + a[mid] + ' < ' + key + ' ≤ ' + a[hi] + '? ' + (ok ? 'Yes: the key line crosses the band, so search the right half.' : 'No: the key line misses the band. If it is anywhere, it is in the other half.'); break; }
        case 'go-left': say = 'hi = mid - 1 = ' + hi + '. ' + (lo <= hi ? 'Live now: ' + span(lo, hi) + '.' : 'Nothing is left.'); break;
        case 'go-right': say = 'lo = mid + 1 = ' + lo + '. ' + (lo <= hi ? 'Live now: ' + span(lo, hi) + '.' : 'Nothing is left.'); break;
        case 'missing': say = 'Return -1. Every step still threw away half, so this took about log2 ' + n + ' steps, drop or no drop.'; break;
        case 'after': say = 'search_rotated returned ' + d.pos + '.'; break;
      }
      return { items, say, slow: tag === 'test-key-left' || tag === 'test-key-right', view: { x: -80, y: -10, w: Math.max(620, W + 170), h: 360 } };
    },
    predict: [
      {
        at: (t) => t.tag === 'cmp-halves', once: true, pick: 'option',
        ask: (t) => 'a[lo] = ' + t.data.a[t.data.v.lo] + ' and a[mid] = ' + t.data.a[t.data.v.mid] + '. Which half is certainly in order?',
        options: () => ['The left half, lo..mid', 'The right half, mid..hi'],
        answer: (ts, i) => { const d = ts[i].data; return d.a[d.v.lo] <= d.a[d.v.mid] ? 'The left half, lo..mid' : 'The right half, mid..hi'; },
        explain: () => 'There is only one drop. If a[lo] ≤ a[mid], the drop is not between them, so lo..mid climbs steadily; otherwise the drop is there, and mid..hi is clean.',
      },
      {
        at: (t) => t.tag === 'test-key-left' || t.tag === 'test-key-right', once: true, pick: 'option',
        ask: 'Does the key line pass through the green band of the ordered half?',
        options: () => ['Yes, search that half', 'No, search the other half'],
        answer: (ts, i) => ((ts[i].tag === 'test-key-left') === (ts[i + 1].tag === 'go-left') ? 'Yes, search that half' : 'No, search the other half'),
        explain: () => 'The band spans the values of the ordered half. If the key level crosses it, the key can only be there; if not, it can only be in the half with the drop.',
      },
    ],
    quiz: [
      { q: 'Why is one half always in order, whichever mid you pick?', options: ['Because the array is short', 'There is only one drop, and it can be in at most one of the two halves', 'Because mid is the middle', 'It is not always'], answer: 1, why: 'A rotated sorted array has a single place where the values fall. The half without it climbs steadily.' },
      { q: 'Why test the key against the ordered half and not the other one?', options: ['It is shorter', 'Only an ordered range can be checked with two comparisons: low end ≤ key ≤ high end', 'The other half is empty', 'It does not matter'], answer: 1, why: 'For an ordered stretch, its first and last values bound everything in it. The half with the drop has no such simple bounds.' },
      { q: 'How many steps does this take for n elements?', options: ['n', 'About log2 n', 'n / 2', 'Depends on where the drop is'], answer: 1, why: 'Each step still discards half the live range, so it is O(log n) like ordinary binary search.' },
      { q: 'Why does the code require all values to be different?', options: ['To save memory', 'With repeats, a[lo] == a[mid] could hide the drop, and neither half can be ruled out', 'To make the bars fit', 'It does not'], answer: 1, why: 'For example 3 3 3 1 3: a[lo] = a[mid] = 3 tells you nothing about where the 1 is, and the worst case becomes linear.' },
    ],
  });
})(SEE);
