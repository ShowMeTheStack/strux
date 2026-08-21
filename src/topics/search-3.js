// Searching an array: interpolation search, jump search and exponential search.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, A = X.ArrayKit, S = X.SearchKit;
  const plural = X.plural, span = X.span;

  // ---- interpolation search --------------------------------------------------------------------------------
  const BW = 40, BG = 8, bx = (k) => k * (BW + BG) + BW / 2;
  const fmt = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : x.toFixed(2));

  X.topic({
    id: 'interpolation-search', family: 'search', order: 50, title: 'Interpolation search',
    blurb: 'Instead of always trying the middle, guess where the key should be from its value, the way you open a dictionary near the back for "w".',
    code: `/* a is sorted; probe where key "should" be if the values
   were spread evenly between a[lo] and a[hi] */
int interpolation_search(int a[], int n, int key)
{
    int lo = 0, hi = n - 1, pos;                          /*@ init */
    while (lo <= hi && key >= a[lo] && key <= a[hi]) {    /*@ range */
        if (a[hi] == a[lo])                               /*@ flat */
            return a[lo] == key ? lo : -1;                /*@ flat-done */
        pos = lo + (key - a[lo]) * (hi - lo) / (a[hi] - a[lo]);   /*@ estimate */
        if (a[pos] == key)                                /*@ probe-eq */
            return pos;                                   /*@ found */
        if (a[pos] < key)                                 /*@ probe-lt */
            lo = pos + 1;                                 /*@ go-right */
        else
            hi = pos - 1;                                 /*@ go-left */
    }
    return -1;                                            /*@ missing */
}`,
    animate: ['interpolation_search'],
    inputs: [
      X.searchValues([10, 19, 31, 40, 52, 61, 69, 80, 92, 99], { sorted: true, check: (v) => (v.some((x) => x < 1 || x > 99) ? 'The array: values from 1 to 99, so the bars fit' : null) }),
      X.searchKey(69, 1, 99),
    ],
    presets: [
      { label: 'Roughly even', values: { values: [10, 19, 31, 40, 52, 61, 69, 80, 92, 99], key: 69 } },
      { label: 'Perfectly even', values: { values: [9, 18, 27, 36, 45, 54, 63, 72, 81, 90, 99], key: 63 } },
      { label: 'Bunched up (worst case)', values: { values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 99], key: 9 } },
      { label: 'Not there', values: { values: [10, 19, 31, 40, 52, 61, 69, 80, 92, 99], key: 45 } },
      { label: 'Below the smallest', values: { values: [20, 30, 40, 50, 60], key: 5 } },
    ],
    counters: ['compares'],
    main: (inp) => X.searchMain(inp.values, 'interpolation_search(a, n, ' + inp.key + ')'),
    capture: S.capture(['lo', 'hi', 'pos']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, a = d.a, n = a.length;
      const memo = ctx.memo;
      const v = S.keep(ctx, ['lo', 'hi', 'pos']);
      const lo = v.lo === undefined ? 0 : v.lo, hi = v.hi === undefined ? n - 1 : v.hi, pos = v.pos === undefined ? null : v.pos;
      memo.probes = memo.probes || 0;
      memo.binary = memo.binary || 0;
      if (tag === 'estimate' && memo.at !== ctx.i) { memo.at = ctx.i; memo.probes++; }
      const started = tag !== 'enter';
      const probing = ['estimate', 'probe-eq', 'probe-lt'].includes(tag);
      const done = tag === 'found' || tag === 'after' && d.pos >= 0;
      const max = Math.max(100, ...a);
      const view = S.bars(ctx, a, {
        bar: BW, gap: BG, max, base: 260, height: 220,
        cls: (k) => (done && k === pos ? 'found' : probing && k === pos ? 'probe' : started && (k < lo || k > hi) ? 'out' : ''),
      });
      const items = view.items;
      const W = n * (BW + BG) - BG;
      items.push({ key: 'base', kind: 'line', x1: -10, y1: 261, x2: W + 10, y2: 261, cls: 'axis' });
      if (started) {
        items.push({ key: 'klevel', kind: 'line', x1: -12, y1: view.yOf(key), x2: W + 12, y2: view.yOf(key), cls: 'key-level' });
        items.push({ key: 'klevt', kind: 'text', x: W + 18, y: view.yOf(key) + 5, text: 'key ' + key, cls: 's-rose' });
      }
      // the straight line from a[lo] to a[hi]: where it meets the key level is the estimate
      if (probing && lo < hi && a[hi] !== a[lo]) {
        const x0 = bx(lo), x1 = bx(hi), y0 = view.yOf(a[lo]), y1 = view.yOf(a[hi]);
        const f = (key - a[lo]) / (a[hi] - a[lo]);
        const xe = x0 + f * (x1 - x0), ye = view.yOf(key), exact = lo + f * (hi - lo);
        items.push({ key: 'interp', kind: 'line', x1: x0, y1: y0, x2: x1, y2: y1, cls: 'interp' });
        items.push({ key: 'cross', kind: 'token', x: xe, y: ye, r: 7, text: '', cls: 'cross' });
        items.push({ key: 'dropl', kind: 'line', x1: xe, y1: ye + 8, x2: xe, y2: 262, cls: 'drop' });
        items.push({ key: 'est', kind: 'text', x: xe - 12, y: ye - 12, text: '≈ ' + fmt(exact) + (fmt(exact) !== String(pos) ? ' → ' + pos : ''), cls: 's-amber', anchor: 'end' });
        items.push({ key: 'formula', kind: 'text', x: 0, y: -14, text: 'pos = ' + lo + ' + (' + key + ' - ' + a[lo] + ') × (' + hi + ' - ' + lo + ') / (' + a[hi] + ' - ' + a[lo] + ') = ' + pos, cls: 's-formula' });
        // where plain binary search would have looked instead
        const bm = lo + Math.floor((hi - lo) / 2);
        items.push({ key: 'bin', kind: 'text', x: bx(bm), y: 362, text: '▲ binary search would try ' + bm, cls: 's-note', anchor: 'middle' });
      }
      const marks = {};
      if (started && tag !== 'after') { if (lo <= hi) { marks.lo = lo; marks.hi = hi; } if (probing || tag === 'found') marks.pos = pos; }
      items.push(...A.markers(view, marks, { y: 260 }));
      items.push({ key: 'tally', kind: 'text', x: 0, y: -44, text: 'probes: ' + memo.probes + ' · binary search: at most ' + S.maxGuesses(n), cls: 's-title' });
      let say = '';
      const inRange = lo <= hi && key >= a[lo] && key <= a[hi];
      switch (tag) {
        case 'enter': say = 'interpolation_search for ' + key + '. Binary search always tries the middle; this search uses the value of the key to guess how far along it should be.'; break;
        case 'init': say = 'lo = 0, hi = ' + (n - 1) + '.'; break;
        case 'range': say = inRange ? key + ' lies between a[lo] = ' + a[lo] + ' and a[hi] = ' + a[hi] + ', so it may be in ' + span(lo, hi) + '.' : lo > hi ? 'lo = ' + lo + ' > hi = ' + hi + ': nothing left to search.' : key + ' is outside a[lo] = ' + a[lo] + ' to a[hi] = ' + a[hi] + ': it cannot be in a sorted range with those ends. Stop at once.'; break;
        case 'flat': say = 'a[lo] and a[hi] differ (' + a[lo] + ' and ' + a[hi] + '), so the division below is safe.'; break;
        case 'flat-done': say = 'All of ' + span(lo, hi) + ' hold the same value; the formula would divide by zero, so just check a[lo].'; break;
        case 'estimate': { const f = (key - a[lo]) / (a[hi] - a[lo]); say = key + ' is ' + Math.round(f * 100) + '% of the way from ' + a[lo] + ' to ' + a[hi] + ', so the guess is ' + Math.round(f * 100) + '% of the way from index ' + lo + ' to ' + hi + ': pos = ' + pos + ' (integer division rounds down).'; break; }
        case 'probe-eq': say = 'Is a[' + pos + '] = ' + a[pos] + ' the key? ' + (a[pos] === key ? 'Yes.' : 'No.'); break;
        case 'probe-lt': say = a[pos] < key ? a[pos] + ' < ' + key + ': the key is to the right of pos.' : a[pos] + ' > ' + key + ': the key is to the left of pos.'; break;
        case 'go-right': say = 'lo = pos + 1 = ' + lo + '. The line will be redrawn between the new ends.'; break;
        case 'go-left': say = 'hi = pos - 1 = ' + hi + '. The line will be redrawn between the new ends.'; break;
        case 'found': say = 'Found ' + key + ' at index ' + pos + ' with ' + plural(memo.probes, 'probe') + '.' + (memo.probes > S.maxGuesses(n) ? ' Binary search would have needed at most ' + S.maxGuesses(n) + ': the values are bunched, so the straight line keeps guessing badly.' : ''); break;
        case 'missing': say = 'Return -1 after ' + plural(memo.probes, 'probe') + '.'; break;
        case 'after': say = 'interpolation_search returned ' + d.pos + '.'; break;
      }
      return { items, say, slow: tag === 'estimate', view: { x: -60, y: -70, w: Math.max(640, W + 150), h: 450 } };
    },
    predict: [
      {
        at: (t) => t.tag === 'flat', once: true, pick: 'option',
        ask: (t, ts, i, ctx) => { const d = t.data, v = d.v; return 'The key ' + ctx.input.key + ' lies between a[' + v.lo + '] = ' + d.a[v.lo] + ' and a[' + v.hi + '] = ' + d.a[v.hi] + '. Roughly where will the first probe land?'; },
        options: () => ['Near the left end', 'Near the middle', 'Near the right end'],
        answer: (ts, i) => { const n = ts[i].data.a.length, p = ts.find((x, k) => k > i && x.tag === 'estimate').data.v.pos; return p < n / 3 ? 'Near the left end' : p < 2 * n / 3 ? 'Near the middle' : 'Near the right end'; },
        explain: () => 'The probe goes as far along the indexes as the key is along the values from a[lo] to a[hi].',
      },
      {
        at: (t) => t.tag === 'go-right' || t.tag === 'go-left', once: true, pick: 'option',
        ask: 'The range has shrunk. Will the next probe use the same straight line?',
        options: () => ['Yes, the line is fixed', 'No, a new line from the new a[lo] to the new a[hi]'], answer: () => 'No, a new line from the new a[lo] to the new a[hi]',
        explain: () => 'Each probe draws its line between the current ends, so the estimate gets better as the range closes in.',
      },
    ],
    quiz: [
      { q: 'For evenly spread values, about how many probes does interpolation search need?', options: ['About log2 n', 'About log2 log2 n, which is tiny', 'n / 2', 'Always exactly 1'], answer: 1, why: 'On uniform data each probe lands very close to the key; the expected number of probes grows like log log n.' },
      { q: 'What is its worst case, for example on 1 2 3 4 5 6 7 8 9 99 searching for 9?', options: ['1 probe', 'log2 n probes', 'n probes: it creeps along one step at a time', 'It fails'], answer: 2, why: 'The one huge value flattens the line, so every estimate lands at lo and the range shrinks by one.' },
      { q: 'Why does the loop also test key >= a[lo] and key <= a[hi]?', options: ['For speed only', 'Otherwise the estimate could fall outside lo..hi and read past the range', 'C needs it', 'To handle duplicates'], answer: 1, why: 'If the key is outside the end values, the formula gives a position outside the range. It also means a missing key stops early.' },
      { q: 'Why is the case a[hi] == a[lo] handled separately?', options: ['It is the found case', 'The formula would divide by zero', 'To save a comparison', 'It never happens'], answer: 1, why: 'The denominator is a[hi] - a[lo]. When the range holds one repeated value it is 0.' },
      { q: 'Where does binary search probe in the same situation?', options: ['At the same place', 'Always at the middle of lo..hi, ignoring the values', 'At lo', 'At a random place'], answer: 1, why: 'Binary search only uses the order of the values, never their size. Interpolation uses the size too.' },
    ],
    compareWith: 'binary-search',
  });

  // ---- jump search ---------------------------------------------------------------------------------------
  const valuesUpTo12 = (def) => X.searchValues(def, { sorted: true });

  X.topic({
    id: 'jump-search', family: 'search', order: 60, title: 'Jump search',
    blurb: 'Jump ahead a block of √n elements at a time, looking only at the last element of each block. When you overshoot, step back and walk through that one block.',
    code: `/* a is sorted; jump a block at a time, then walk one block */
int jump_search(int a[], int n, int key)
{
    int step = (int) sqrt((double) n);        /*@ step */
    int lo = 0, hi = step;                    /*@ init */
    while (hi < n && a[hi - 1] < key) {       /*@ probe-block */
        lo = hi;                              /*@ jump */
        hi = hi + step;                       /*@ jump-end */
    }
    if (hi > n)                               /*@ clip-test */
        hi = n;                               /*@ clip */
    while (lo < hi && a[lo] < key)            /*@ compare-walk */
        lo++;                                 /*@ step-in */
    if (lo < hi && a[lo] == key)              /*@ compare-eq */
        return lo;                            /*@ found */
    return -1;                                /*@ missing */
}`,
    animate: ['jump_search'],
    inputs: [valuesUpTo12([2, 5, 8, 12, 16, 23, 38, 45, 56, 62, 71, 77]), X.searchKey(45)],
    presets: [
      { label: 'Found in the third block', values: { values: [2, 5, 8, 12, 16, 23, 38, 45, 56, 62, 71, 77], key: 45 } },
      { label: 'In the first block', values: { values: [2, 5, 8, 12, 16, 23, 38, 45, 56, 62, 71, 77], key: 8 } },
      { label: 'The last element', values: { values: [2, 5, 8, 12, 16, 23, 38, 45, 56, 62, 71, 77], key: 99 } },
      { label: 'Not there', values: { values: [2, 5, 8, 12, 16, 23, 38, 45, 56, 62, 71, 77], key: 60 } },
      { label: 'Ten elements: a short last block', values: { values: [4, 9, 13, 20, 26, 31, 37, 42, 50, 58], key: 58 } },
    ],
    counters: ['compares'],
    main: (inp) => X.searchMain(inp.values, 'jump_search(a, n, ' + inp.key + ')'),
    capture: S.capture(['step', 'lo', 'hi']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, a = d.a, n = a.length;
      const memo = ctx.memo;
      const v = S.keep(ctx, ['step', 'lo', 'hi']);
      const step = v.step === undefined ? Math.floor(Math.sqrt(n)) : v.step;
      const lo = v.lo === undefined ? null : v.lo, hi = v.hi === undefined ? null : v.hi;
      memo.probed = memo.probed || [];
      memo.walked = memo.walked || new Set();
      if (memo.at !== ctx.i) {
        memo.at = ctx.i;
        if (tag === 'probe-block' && hi < n) memo.probed.push(hi - 1);
        if (tag === 'compare-walk' && lo < hi) memo.walked.add(lo);
        if (tag === 'clip-test' || tag === 'clip') memo.walking = true;
      }
      const walking = !!memo.walking || ['compare-walk', 'step-in', 'compare-eq', 'found', 'missing', 'after'].includes(tag);
      const done = tag === 'found' || tag === 'after' && d.pos >= 0;
      const last = memo.probed[memo.probed.length - 1];
      const view = A.cells(ctx, a, {
        cls: (k) => {
          if (done && k === (tag === 'after' ? d.pos : lo)) return 'found';
          if (walking && k === lo && ['compare-walk', 'compare-eq'].includes(tag)) return 'probe';
          if (!walking && k === last && tag === 'probe-block') return 'probe';
          if (walking && hi !== null && (k < lo && !memo.walked.has(k) || k >= hi)) return 'out';
          if (memo.walked.has(k) && k < lo) return 'seen';
          if (memo.probed.includes(k)) return 'blockend';
          return '';
        },
      });
      const items = view.items;
      // the blocks of step elements, drawn as dashed boxes; the block being walked lights up
      for (let b = 0; b * step < n; b++) {
        const k0 = b * step, k1 = Math.min(n, k0 + step) - 1;
        const on = walking && lo !== null && k0 <= Math.min(lo, n - 1) && Math.min(lo, n - 1) <= k1;
        items.push({ key: 'blk' + b, kind: 'region', x: k0 * (S.CELL + S.GAP) - 5, y: -6, w: (k1 - k0) * (S.CELL + S.GAP) + S.CELL + 10, h: S.CELL + 12, cls: 'block' + (on ? ' on' : ''), text: '' });
      }
      // the hops: an arc from each probed block end to the next
      const hops = memo.probed.slice();
      hops.forEach((k, j) => {
        const from = j === 0 ? null : hops[j - 1];
        const isNew = j === hops.length - 1 && tag === 'probe-block';
        if (from === null) items.push({ key: 'hop' + j, kind: 'arrow', from: { x: -40, y: -26 }, to: { x: S.xOf(k), y: -26 }, bend: -40, cls: 'hop' + (isNew ? '' : ' old'), label: '' });
        else items.push({ key: 'hop' + j, kind: 'arrow', from: { x: S.xOf(from), y: -26 }, to: { x: S.xOf(k), y: -26 }, bend: -40, cls: 'hop' + (isNew ? '' : ' old'), label: '+' + step });
      });
      if (!walking && last !== undefined) items.push({ key: 'frog', kind: 'token', x: S.xOf(last), y: -40, r: 12, text: '', cls: 'frog' });
      if (tag === 'probe-block' && hi < n) items.push({ key: 'q', kind: 'text', x: S.xOf(hi - 1), y: -88, text: a[hi - 1] + (a[hi - 1] < key ? ' < ' + key + ': jump' : ' ≥ ' + key + ': stop'), cls: a[hi - 1] < key ? 's-hot' : 's-good', anchor: 'middle' });
      if (tag === 'compare-walk' && lo < hi) items.push({ key: 'q', kind: 'text', x: S.xOf(lo), y: -88, text: a[lo] + (a[lo] < key ? ' < ' + key + ': step' : ' ≥ ' + key + ': stop'), cls: a[lo] < key ? 's-hot' : 's-good', anchor: 'middle' });
      const marks = {};
      if (lo !== null && tag !== 'after') { marks.lo = lo; marks.hi = hi; }
      items.push(...A.markers(view, marks, { y: 0 }));
      items.push(S.keyBadge(key, 50, -140));
      items.push({ key: 'kl', kind: 'text', x: 0, y: -135, text: 'key', cls: 's-rose' });
      items.push({ key: 'tally', kind: 'text', x: 100, y: -135, text: 'step = ' + step + ' (√' + n + ' ≈ ' + fmt(Math.sqrt(n)) + ')' + ' · block checks: ' + memo.probed.length + ' · walk steps: ' + memo.walked.size, cls: 's-title' });
      let say = '';
      switch (tag) {
        case 'enter': say = 'jump_search for ' + key + ' in ' + n + ' sorted elements. Linear search looks at every element; this one skips through the array in blocks first.'; break;
        case 'step': say = 'The block size is √' + n + ' = ' + fmt(Math.sqrt(n)) + (Number.isInteger(Math.sqrt(n)) ? '' : ', rounded down to ' + step) + '. That size balances the number of jumps against the length of the final walk.'; break;
        case 'init': say = 'The first block is a[' + lo + '..' + (hi - 1) + ']: lo = ' + lo + ' is its start, hi = ' + hi + ' is just past its end.'; break;
        case 'probe-block': say = hi >= n ? 'hi = ' + hi + ' is not below n = ' + n + ': this is the last block, so stop jumping.' : 'Look only at the last element of the block: a[' + (hi - 1) + '] = ' + a[hi - 1] + '. ' + (a[hi - 1] < key ? 'It is smaller than ' + key + ', so the whole block is smaller: jump over it.' : 'It is not smaller than ' + key + ', so if ' + key + ' is anywhere, it is in this block.'); break;
        case 'jump': say = 'lo = ' + lo + ': the next block starts here.'; break;
        case 'jump-end': say = 'hi = ' + hi + ': ' + (hi <= n ? 'the next block is a[' + lo + '..' + (hi - 1) + '].' : 'past the end of the array; the last block is shorter.'); break;
        case 'clip-test': say = hi > n ? 'hi = ' + hi + ' is past the end (n = ' + n + ').' : 'hi = ' + hi + ' is inside the array; nothing to trim.'; break;
        case 'clip': say = 'Trim the last block: hi = n = ' + n + '.'; break;
        case 'compare-walk': say = lo < hi ? (memo.walked.size === 1 ? 'Step back to the start of the block and walk forward: ' : '') + 'a[' + lo + '] = ' + a[lo] + (a[lo] < key ? ' < ' + key + ', keep walking.' : ' is not smaller than ' + key + ', stop.') : 'lo = ' + lo + ' reached hi: the whole block was smaller than ' + key + '.'; break;
        case 'step-in': say = 'lo = ' + lo + '.'; break;
        case 'compare-eq': say = lo < hi && a[lo] === key ? 'a[' + lo + '] = ' + key + ': it is the key.' : 'The walk stopped' + (lo < hi ? ' at a[' + lo + '] = ' + a[lo] + ', which is not ' + key : ' at the end of the block') + '.'; break;
        case 'found': say = 'Found at index ' + lo + ': ' + plural(memo.probed.length, 'block check') + ' and ' + plural(memo.walked.size, 'step') + ' in the block. Linear search would have needed ' + (lo + 1) + '.'; break;
        case 'missing': say = 'Return -1: the only block where ' + key + ' could be does not hold it.'; break;
        case 'after': say = 'jump_search returned ' + d.pos + '. At most about 2√n = ' + (2 * step) + ' elements are ever looked at.'; break;
      }
      return { items, say, slow: tag === 'compare-walk' && memo.walked.size === 1, view: S.view(n, -175, 150, -70, 30) };
    },
    predict: [
      {
        at: (t) => t.tag === 'init', once: true,
        ask: 'Click the element jump search looks at first.',
        answer: (ts, i) => 'ea:' + (ts[i].data.v.hi - 1),
        explain: (ts, i) => 'The last element of the first block, a[' + (ts[i].data.v.hi - 1) + ']. If even that is smaller than the key, the whole block is.',
      },
      {
        at: (t, i, ts) => t.tag === 'probe-block' && ts[i + 1] && ts[i + 1].tag !== 'jump', once: true, pick: 'option',
        ask: 'Jumping stops here. Where does the walk start?',
        options: (ts, i) => { const v = ts[i].data.v; return ['At a[' + v.lo + '], the start of this block', 'At a[' + Math.max(0, Math.min(v.hi, ts[i].data.n) - 1) + '], where the jump landed', 'At a[0]']; },
        answer: (ts, i) => 'At a[' + ts[i].data.v.lo + '], the start of this block',
        explain: () => 'The key is somewhere inside this block, and every block before it was ruled out, so the walk starts at the block\'s first element.',
      },
    ],
    quiz: [
      { q: 'Why is the block size √n?', options: ['It is easy to compute', 'It balances the jumps (n / m of them) against the walk (up to m): the total n/m + m is smallest at m = √n', 'Any size gives the same cost', 'So the blocks are all equal'], answer: 1, why: 'With block size m the worst case is about n/m jumps plus m - 1 steps. That sum is smallest when m = √n.' },
      { q: 'What is the worst case for n = 100?', options: ['About 10 elements', 'About 20 elements', '50 elements', '100 elements'], answer: 1, why: 'Up to √100 = 10 jumps, then up to 10 steps in the block: about 2√n = 20.' },
      { q: 'Jump search vs binary search: why ever use jump search?', options: ['It is faster on large arrays', 'It only ever moves forward and steps back once, which suits data where going back is expensive', 'It needs no sorting', 'It uses less memory'], answer: 1, why: 'Binary search jumps back and forth. Jump search moves forward in big strides and steps back at most one block, which helps on tape or linked storage.' },
      { q: 'Why look at the last element of a block rather than the first?', options: ['No reason', 'If the last one is smaller than the key, the whole sorted block is, so it can be skipped', 'The first one is not loaded yet', 'To avoid going out of bounds'], answer: 1, why: 'The last element is the biggest in its block. Smaller than the key means the whole block is too small.' },
    ],
    compareWith: 'linear-search',
  });

  // ---- exponential search --------------------------------------------------------------------------------
  X.topic({
    id: 'exponential-search', family: 'search', order: 70, title: 'Exponential search',
    blurb: 'Gallop: try index 1, 2, 4, 8, ... until you pass the key. That brackets the key between two powers of two, and binary search finishes the job.',
    code: `/* binary search on a[lo..hi] only */
int binary_range(int a[], int lo, int hi, int key)
{
    int mid;
    while (lo <= hi) {                         /*@ range */
        mid = lo + (hi - lo) / 2;              /*@ mid */
        if (a[mid] == key)                     /*@ compare-eq */
            return mid;                        /*@ found */
        if (a[mid] < key)                      /*@ compare-lt */
            lo = mid + 1;                      /*@ go-right */
        else
            hi = mid - 1;                      /*@ go-left */
    }
    return -1;                                 /*@ missing */
}

/* a is sorted; find a range that holds key by doubling */
int exponential_search(int a[], int n, int key)
{
    int bound = 1, hi;                         /*@ init */
    while (bound < n && a[bound] < key)        /*@ probe-bound */
        bound = bound * 2;                     /*@ double */
    hi = bound < n ? bound : n - 1;            /*@ clip */
    return binary_range(a, bound / 2, hi, key);    /*@ hand-over */
}`,
    animate: ['exponential_search', 'binary_range'],
    inputs: [valuesUpTo12([3, 6, 9, 14, 19, 25, 31, 38, 44, 52, 60, 67]), X.searchKey(31)],
    presets: [
      { label: 'In the middle', values: { values: [3, 6, 9, 14, 19, 25, 31, 38, 44, 52, 60, 67], key: 31 } },
      { label: 'Near the front', values: { values: [3, 6, 9, 14, 19, 25, 31, 38, 44, 52, 60, 67], key: 9 } },
      { label: 'The first element', values: { values: [3, 6, 9, 14, 19, 25, 31, 38, 44, 52, 60, 67], key: 3 } },
      { label: 'Not there', values: { values: [3, 6, 9, 14, 19, 25, 31, 38, 44, 52, 60, 67], key: 40 } },
      { label: 'Bigger than all', values: { values: [3, 6, 9, 14, 19, 25, 31, 38, 44, 52], key: 70 } },
    ],
    counters: ['compares'],
    main: (inp) => X.searchMain(inp.values, 'exponential_search(a, n, ' + inp.key + ')'),
    capture: S.capture(['bound', 'lo', 'hi', 'mid']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, a = d.a, n = a.length;
      const memo = ctx.memo;
      const v = S.keep(ctx, ['bound', 'lo', 'hi', 'mid']);
      const bound = v.bound === undefined ? null : v.bound;
      memo.bounds = memo.bounds || [];
      if (memo.at !== ctx.i) {
        memo.at = ctx.i;
        if (tag === 'probe-bound') memo.bounds.push(bound);
        if (d.fn === 'binary_range') memo.phase2 = true;
        if (tag === 'mid') memo.guesses = (memo.guesses || 0) + 1;
      }
      const phase2 = !!memo.phase2;
      const lo = phase2 && v.lo !== undefined ? v.lo : null, hi = v.hi === undefined ? null : v.hi, mid = phase2 && v.mid !== undefined ? v.mid : null;
      if (phase2 && memo.win === undefined && lo !== null) memo.win = [lo, hi];
      const looking = ['mid', 'compare-eq', 'compare-lt'].includes(tag);
      const done = tag === 'found' || tag === 'after' && d.pos >= 0;
      const out = (k) => phase2 && (k < lo || k > hi);
      const view = A.cells(ctx, a, {
        cls: (k) => {
          if (done && k === mid) return 'found';
          if (k === mid && looking) return 'probe';
          if (!phase2 && tag === 'probe-bound' && k === bound) return 'probe';
          if (out(k)) return 'out';
          if (!phase2 && memo.bounds.includes(k) && k < n) return 'blockend';
          return '';
        },
      });
      const items = view.items;
      for (const it of items) if (it.kind === 'cell') { const k = Math.round(it.x / (S.CELL + S.GAP)); if (out(k) && !(done && k === mid)) it.y += 22; }
      // the gallop: arcs 0 -> 1 -> 2 -> 4 -> 8, each twice as long as the one before
      const bs = memo.bounds.filter((b) => b < n);
      let prev = 0;
      bs.forEach((b, j) => {
        const isNew = !phase2 && j === bs.length - 1 && tag === 'probe-bound';
        items.push({ key: 'gal' + j, kind: 'arrow', from: { x: S.xOf(prev), y: -26 }, to: { x: S.xOf(b), y: -26 }, bend: -Math.min(70, 22 + (b - prev) * 6), cls: 'hop' + (isNew ? '' : ' old'), label: phase2 ? '' : j === 0 ? '1' : '×2' });
        prev = b;
      });
      if (!phase2 && bound !== null && bound >= n && tag !== 'enter') items.push({ key: 'past', kind: 'text', x: S.xOf(n - 1) + 40, y: -40, text: 'bound ' + bound + ' ≥ n', cls: 's-violet' });
      // the window handed to binary search
      if (memo.win) {
        const w0 = memo.win[0] * (S.CELL + S.GAP) - 12, w1 = memo.win[1] * (S.CELL + S.GAP) + S.CELL + 12;
        items.push({ key: 'win', kind: 'region', x: w0, y: -14, w: w1 - w0, h: S.CELL + 50, cls: 'block on', text: '' });
        items.push({ key: 'wint', kind: 'text', x: (w0 + w1) / 2, y: S.CELL + 112, text: 'window for binary search: ' + span(memo.win[0], memo.win[1]), cls: 's-amber', anchor: 'middle' });
      }
      if (phase2 && lo !== null && lo <= hi && tag !== 'after') items.push(...S.bracket('live', lo, hi, '', { y0: lo === null ? 0 : 0 }));
      if (mid !== null && looking) {
        items.push({ key: 'guess', kind: 'token', x: S.xOf(mid), y: -84, r: 16, text: tag === 'mid' ? '?' : String(a[mid]), cls: 'guess' });
      }
      if (tag === 'probe-bound' && bound < n) items.push({ key: 'q', kind: 'text', x: S.xOf(bound), y: -100, text: 'a[' + bound + '] = ' + a[bound] + (a[bound] < key ? ' < ' + key : ' ≥ ' + key), cls: a[bound] < key ? 's-hot' : 's-good', anchor: 'middle' });
      const marks = {};
      if (!phase2 && bound !== null && bound < n && tag !== 'enter') marks.bound = bound;
      if (phase2 && lo !== null && lo <= hi && tag !== 'after') { marks.lo = lo; marks.hi = hi; if (looking) marks.mid = mid; }
      items.push(...A.markers(view, marks, { y: 22 }));
      items.push(S.keyBadge(key, 50, -150));
      items.push({ key: 'kl', kind: 'text', x: 0, y: -145, text: 'key', cls: 's-rose' });
      items.push({ key: 'tally', kind: 'text', x: 100, y: -145, text: 'bounds tried: ' + (memo.bounds.length ? memo.bounds.join(', ') : '-') + (phase2 ? ' · binary guesses: ' + (memo.guesses || 0) : ''), cls: 's-title' });
      let say = '';
      switch (tag) {
        case 'enter': say = 'exponential_search for ' + key + '. First find a stretch that must hold the key by doubling an index; then binary search inside it.'; break;
        case 'init': say = 'bound = 1. The bound will double until it passes the key (or the end of the array).'; break;
        case 'probe-bound': say = bound >= n ? 'bound = ' + bound + ' is not below n = ' + n + ': stop doubling.' : 'Is a[' + bound + '] = ' + a[bound] + ' < ' + key + '? ' + (a[bound] < key ? 'Yes: the key is further on. Double the bound.' : 'No: the key cannot be beyond index ' + bound + '. Stop.'); break;
        case 'double': say = 'bound = ' + bound + '. Each jump is twice as long as the last.'; break;
        case 'clip': say = 'hi = ' + hi + (bound >= n ? ', the last index, because bound ran past the end.' : ', the bound itself.') + ' The key, if present, is in ' + span(Math.floor(bound / 2), hi) + ': past a[' + Math.floor(bound / 2) + '] which was too small' + (bound > 1 ? '' : ' (or at the start)') + '.'; break;
        case 'hand-over': say = 'Hand the window ' + span(Math.floor(bound / 2), hi) + ' to binary search.'; break;
        case 'range': say = lo <= hi ? 'Binary search on ' + span(lo, hi) + ': ' + plural(hi - lo + 1, 'element') + ' live.' : 'lo = ' + lo + ' > hi = ' + hi + ': the window is used up.'; break;
        case 'mid': say = 'mid = ' + lo + ' + (' + hi + ' - ' + lo + ') / 2 = ' + mid + '.'; break;
        case 'compare-eq': say = 'Is a[' + mid + '] = ' + a[mid] + ' the key? ' + (a[mid] === key ? 'Yes.' : 'No.'); break;
        case 'compare-lt': say = a[mid] < key ? a[mid] + ' < ' + key + ': go right.' : a[mid] + ' > ' + key + ': go left.'; break;
        case 'go-right': say = 'lo = ' + lo + '.'; break;
        case 'go-left': say = 'hi = ' + hi + '.'; break;
        case 'found': say = 'Found at index ' + mid + ': ' + plural(memo.bounds.length, 'bound check') + ' and ' + plural(memo.guesses || 0, 'binary guess') + '.'; break;
        case 'missing': say = 'binary_range returns -1: the key is not in the window, so it is nowhere.'; break;
        case 'after': say = 'exponential_search returned ' + d.pos + '. The cost grows with the log of the key\'s position, not of n.'; break;
      }
      if (!say && d.fn === 'exponential_search' && ctx.tick.end) say = 'exponential_search passes the answer back.';
      return { items, say, slow: tag === 'clip' || tag === 'found', view: S.view(n, -185, 175, -60, 120) };
    },
    predict: [
      {
        at: (t) => t.tag === 'init', once: true, pick: 'option',
        ask: 'Which indexes will the gallop look at, in order?',
        options: (ts) => { const n = ts[0].data.n; const p = []; for (let b = 1; b < n; b *= 2) p.push(b); return [p.slice(0, 3).join(', ') + ', ...', '1, 2, 3, 4, ...', '0, ' + Math.floor(n / 2) + ', ...']; },
        answer: (ts) => { const n = ts[0].data.n; const p = []; for (let b = 1; b < n; b *= 2) p.push(b); return p.slice(0, 3).join(', ') + ', ...'; },
        explain: () => 'The bound doubles each time: 1, 2, 4, 8, 16, ... so it reaches position p in about log2 p steps.',
      },
      {
        at: (t) => t.tag === 'clip', once: true, pick: 'option',
        ask: (t) => 'The gallop stopped at bound = ' + t.data.v.bound + '. Which window will binary search get?',
        options: (ts, i) => { const b = ts[i].data.v.bound, n = ts[i].data.n, h = Math.min(b, n - 1); return [span(Math.floor(b / 2), h), span(0, h), span(h, n - 1)]; },
        answer: (ts, i) => { const b = ts[i].data.v.bound, n = ts[i].data.n; return span(Math.floor(b / 2), Math.min(b, n - 1)); },
        explain: (ts, i) => { const b = ts[i].data.v.bound; return b > 1 ? 'a[' + (b / 2) + '] was smaller than the key, so the key is after it, and it is not after the stopping point.' : 'The gallop stopped at once, so the key can only be a[0] or a[1].'; },
      },
    ],
    quiz: [
      { q: 'The key is at position p in a huge array. About how many steps does exponential search take?', options: ['log2 n', 'About 2 log2 p', 'p', 'n'], answer: 1, why: 'log2 p doublings to pass it, then a binary search over a window of about p / 2: about 2 log2 p in all, however big n is.' },
      { q: 'When is exponential search better than plain binary search?', options: ['Never', 'When the key is near the front of a very long (or endless) sorted list', 'When the array is unsorted', 'When there are duplicates'], answer: 1, why: 'Its cost depends on where the key is, not on n. It also works when n is unknown, for example an unbounded stream.' },
      { q: 'Why does the binary search start at bound / 2?', options: ['To save time', 'a[bound / 2] was already found to be smaller than the key', 'Because of integer division', 'It should start at 0'], answer: 1, why: 'The doubling only went past bound / 2 because a[bound / 2] < key, so nothing at or before it can be the key (except when bound is still 1).' },
      { q: 'Why is hi set to n - 1 when bound runs past the end?', options: ['To make it even', 'a[bound] does not exist, so the window must stop at the last element', 'Binary search needs it', 'It is not needed'], answer: 1, why: 'bound can overshoot n after a doubling. Reading a[bound] then would be outside the array.' },
    ],
    compareWith: 'binary-search',
  });
})(SEE);
