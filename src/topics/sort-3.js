// Sorting, part B: Hoare and three-way quick sort, heap sort, counting, radix and bucket sort.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, A = X.ArrayKit;

  // ---- shared helpers ---------------------------------------------------------------------------------------
  /** Scalar variables of the newest frame (null when missing or not set yet) */
  const varsOf = (P, names) => {
    const o = {};
    for (const v of names) o[v] = P.has(v, 0) && P.isSet(v, 0) ? P.val(v, 0) : null;
    return o;
  };
  const range = (lo, hi) => { const o = []; for (let k = lo; k <= hi; k++) o.push(k); return o; };
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  /**
   * The recursion as nested brackets under the bars: one bracket per active call, the newest on top
   * of the pile and coloured, older ones grey. calls: [{lo, hi}] oldest first.
   */
  function callBrackets(view, calls, y0) {
    const items = [];
    calls.forEach((c, d) => {
      if (c.lo === null || c.lo === undefined || c.hi === null || c.hi === undefined) return;
      const top = d === calls.length - 1;
      const y = y0 + d * 17;
      const x1 = c.hi >= c.lo ? view.xOf(c.lo) - 18 : view.xOf(c.lo) - 6, x2 = c.hi >= c.lo ? view.xOf(c.hi) + 18 : view.xOf(c.lo) + 6;
      items.push({ key: 'cb' + d, kind: 'line', x1, y1: y, x2, y2: y, cls: 'sb-call' + (top ? ' top' : '') });
      items.push({ key: 'cbt' + d, kind: 'text', x: x2 + 8, y: y + 4, text: '[' + c.lo + '..' + c.hi + ']', cls: 'sb-calltext' + (top ? ' top' : '') });
    });
    return items;
  }

  /**
   * Remembers which picture item stands for which element as values move between places (slots of
   * arrays, buckets, a held key). A move gives the destination the element's key, so it slides there;
   * a copy that leaves the old value behind marks the old place as a ghost.
   */
  function mover(memo) {
    const m = memo.mover = memo.mover || { at: new Map(), ghost: new Set(), next: 0 };
    return {
      key(place) { if (!m.at.has(place)) m.at.set(place, 'k' + (m.next++)); return m.at.get(place); },
      move(from, to, ghost) {
        const k = this.key(from);
        m.at.set(to, k);
        m.ghost.delete(to);
        if (ghost) { m.at.set(from, 'k' + (m.next++)); m.ghost.add(from); } else m.at.delete(from);
      },
      swap(p, q) { const a = this.key(p), b = this.key(q); m.at.set(p, b); m.at.set(q, a); },
      isGhost(place) { return m.ghost.has(place); },
      clear(place) { m.at.delete(place); m.ghost.delete(place); },
      has(place) { return m.at.has(place); },
    };
  }
  /** Run fn once per tick (the scene of a tick is drawn once, in order, but be safe) */
  const once = (ctx, name, fn) => {
    const k = 'once:' + name;
    if (ctx.memo[k] === ctx.i) return;
    ctx.memo[k] = ctx.i;
    fn();
  };

  const hoareValues = Object.assign({}, X.sortValues, { def: [52, 27, 81, 9, 43, 70, 12, 60, 35] });
  const hoarePresets = [
    { label: 'Mixed', values: { values: [52, 27, 81, 9, 43, 70, 12, 60, 35] } },
    { label: 'Already sorted', values: { values: [5, 12, 19, 26, 33, 40, 47, 54] } },
    { label: 'Reverse sorted', values: { values: [80, 70, 60, 50, 40, 30, 20, 10] } },
    { label: 'All equal', values: { values: [7, 7, 7, 7, 7, 7] } },
    { label: 'Two', values: { values: [9, 2] } },
  ];

  // ---- quick sort with Hoare's partition --------------------------------------------------------------------
  X.topic({
    id: 'quick-hoare', family: 'sort', order: 51, title: 'Quick sort (Hoare partition)',
    blurb: 'Two scanners start at opposite ends, each stops at an element on the wrong side of the pivot, and the two swap. Where they cross, the array splits.',
    code: `/* split a[lo..hi] into a left part <= pivot and a right part >= pivot;
   returns the last index of the left part */
int partition(int a[], int lo, int hi)
{
    int pivot = a[(lo + hi) / 2];     /*@ pivot */
    int i = lo - 1;                   /*@ init-i */
    int j = hi + 1;                   /*@ init-j */
    for (;;) {                        /*@ round */
        i++;                          /*@ step-i */
        while (a[i] < pivot)          /*@ cmp-i */
            i++;                      /*@ step-i */
        j--;                          /*@ step-j */
        while (a[j] > pivot)          /*@ cmp-j */
            j--;                      /*@ step-j */
        if (i >= j)                   /*@ cross */
            return j;                 /*@ split-at */
        swap(&a[i], &a[j]);           /*@ swap */
    }
}

void quicksort(int a[], int lo, int hi)
{
    int p;
    if (lo < hi) {                    /*@ range */
        p = partition(a, lo, hi);     /*@ split */
        quicksort(a, lo, p);          /*@ left */
        quicksort(a, p + 1, hi);      /*@ right */
    }
}`,
    animate: ['quicksort', 'partition'], quiet: ['swap'],
    inputs: [hoareValues], presets: hoarePresets,
    counters: ['compares', 'swaps'],
    main: (inp) => X.sortMain(inp.values, 'quicksort(a, 0, n - 1);'),
    capture(P) {
      const n = P.val('n');
      const calls = P.calls().filter((c) => c.fn === 'quicksort').map((c) => ({ lo: c.args.lo, hi: c.args.hi }));
      return { a: P.arr('a', n), vars: varsOf(P, ['lo', 'hi', 'i', 'j', 'p', 'pivot']), fn: P.frames[0].name, calls, stack: P.calls() };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, a = d.a, memo = ctx.memo;
      let v = d.vars;
      // the return line is pictured after partition's frame has gone: use what it last showed
      if (d.fn === 'partition') memo.part = Object.assign({}, v);
      if (tag === 'split-at' && memo.part) v = memo.part;
      const inPart = d.fn === 'partition' || tag === 'split-at';
      const lo = v.lo, hi = v.hi;
      const tr = A.track(ctx, 'a', a);
      memo.final = memo.final || new Set();
      if (tag === 'range' && lo === hi) memo.final.add(lo);
      if (tag === 'pivot') memo.pivotId = tr.ids[(lo + hi) >> 1];
      if (!inPart && tag !== 'enter') memo.pivotId = null;
      const end = tag === 'after' || ctx.i === ctx.ticks.length - 1;
      const swapped = tag === 'swap';
      // what is known so far: a[lo..leftEnd] <= pivot, a[rightStart..hi] >= pivot
      const leftEnd = inPart && v.i !== null ? (swapped ? v.i : v.i - 1) : null;
      const rightStart = inPart && v.j !== null ? (swapped ? v.j : v.j + 1) : null;
      const view = A.bars(ctx, a, {
        tracked: tr,
        cls: (k) => {
          if (end || memo.final.has(k)) return 'done';
          if (lo !== null && hi !== null && (k < lo || k > hi)) return 'dim';
          if (inPart && tr.ids[k] === memo.pivotId) return 'pivot';
          if (inPart && (tag === 'cmp-i' && k === v.i || tag === 'cmp-j' && k === v.j)) return 'hot';
          return '';
        },
      });
      const items = view.items.slice();
      const max = Math.max(1, ...a.map(Math.abs));
      const yOf = (val) => 260 - Math.max(4, Math.abs(val) / max * 220);
      if (inPart && v.i !== null && leftEnd >= lo) items.push(...A.range(view, 'zl', lo, Math.min(leftEnd, hi), 'sb-a', '≤ pivot', { cell: 40, y0: 0, h: 290 }));
      if (inPart && v.j !== null && rightStart <= hi) items.push(...A.range(view, 'zr', Math.max(rightStart, lo), hi, 'sb-b', '≥ pivot', { cell: 40, y0: 0, h: 290 }));
      // the pivot value as a water line across the range: below it belongs left, above it belongs right
      if (inPart && v.pivot !== null) {
        const y = yOf(v.pivot);
        items.push({ key: 'wl', kind: 'line', x1: view.xOf(lo) - 26, y1: y, x2: view.xOf(hi) + 26, y2: y, cls: 'sb-water' });
        items.push({ key: 'wlt', kind: 'text', x: view.xOf(hi) + 32, y: y + 5, text: 'pivot ' + v.pivot, cls: 'sb-water' });
      }
      // a swap: the two stopped elements trade places across the line
      if (swapped) items.push({ key: 'sw', kind: 'arrow', from: { x: view.xOf(v.i), y: 252 }, to: { x: view.xOf(v.j), y: 252 }, bend: -40, cls: 'hot', noHead: true });
      // the crossing: a split between j and j + 1
      const split = tag === 'cross' && v.i >= v.j || tag === 'split-at' ? v.j : (!inPart && v.p !== null && ['split', 'left', 'right'].includes(tag) ? v.p : null);
      if (split !== null) {
        const x = (view.xOf(split) + view.xOf(split + 1)) / 2;
        items.push({ key: 'split', kind: 'line', x1: x, y1: 10, x2: x, y2: 290, cls: 'sb-split' });
        items.push({ key: 'splitt', kind: 'text', x, y: 2, text: 'split after ' + split, cls: 'sb-splittext', anchor: 'middle' });
      }
      const marks = {};
      if (inPart) { if (v.i !== null && v.i >= lo) marks.i = v.i; if (v.j !== null && v.j <= hi) marks.j = v.j; } else if (!end) { if (lo !== null) marks.lo = lo; if (hi !== null) marks.hi = hi; }
      items.push(...A.markers(view, marks, { y: 260 }));
      if (!end) items.push(...callBrackets(view, d.calls, 370));
      items.push({ key: 'title', kind: 'text', x: view.xOf(0) - 20, y: -24, text: end ? 'sorted' : d.calls.length ? (inPart ? 'partition(' + lo + ', ' + hi + ')' : 'quicksort(' + lo + ', ' + hi + ')') + ', depth ' + d.calls.length : '', cls: 'sb-title' });

      let say = '';
      const ai = v.i !== null ? a[v.i] : null, aj = v.j !== null ? a[v.j] : null;
      switch (tag) {
        case 'enter': say = 'quicksort(a, 0, ' + (a.length - 1) + ') is called on the whole array.'; break;
        case 'range': say = lo < hi ? 'This call sorts a[' + lo + '..' + hi + ']: ' + (hi - lo + 1) + ' elements, so it partitions them.' : 'a[' + lo + '..' + hi + '] is a single element: already in place.'; break;
        case 'pivot': say = 'The pivot is the middle element, a[' + ((lo + hi) >> 1) + '] = ' + v.pivot + '. The dashed line is its value: bars under it belong on the left, bars over it on the right.'; break;
        case 'init-i': say = 'i starts one place before lo. It will scan to the right.'; break;
        case 'init-j': say = 'j starts one place after hi. It will scan to the left.'; break;
        case 'step-i': say = 'i moves right to a[' + v.i + '] = ' + ai + '.'; break;
        case 'cmp-i': say = ai < v.pivot ? ai + ' < ' + v.pivot + ': it is already on the correct side, so i keeps going.' : ai + ' is not smaller than ' + v.pivot + ', so i stops here: this element ' + (ai === v.pivot ? 'equals the pivot, and i stops on it anyway.' : 'belongs on the right.'); break;
        case 'step-j': say = 'j moves left to a[' + v.j + '] = ' + aj + '.'; break;
        case 'cmp-j': say = aj > v.pivot ? aj + ' > ' + v.pivot + ': it is already on the correct side, so j keeps going.' : aj + ' is not bigger than ' + v.pivot + ', so j stops here: this element ' + (aj === v.pivot ? 'equals the pivot, and j stops on it anyway.' : 'belongs on the left.'); break;
        case 'cross': say = v.i >= v.j ? 'i = ' + v.i + ' and j = ' + v.j + ' have met or crossed. Everything up to j is ≤ ' + v.pivot + ', everything after it is ≥ ' + v.pivot + '.' : 'i = ' + v.i + ' is still left of j = ' + v.j + ': both have stopped on an element that is on the wrong side.'; break;
        case 'swap': say = 'Swap them: ' + ai + ' goes left to a[' + v.i + '], ' + aj + ' goes right to a[' + v.j + ']. Both zones grow by one.'; break;
        case 'split-at': { const pk = tr.ids.indexOf(memo.pivotId); say = 'partition returns ' + v.j + ': a[' + lo + '..' + v.j + '] ≤ ' + v.pivot + ' ≤ a[' + (v.j + 1) + '..' + hi + ']. ' + (pk < 0 ? '' : 'The pivot itself ended up at a[' + pk + ']' + (pk === v.j ? ', which happens to be the split.' : ', not at the split: Hoare does not put the pivot in its final place.')); break; }
        case 'round': say = 'One round: i runs right and j runs left, each until it finds an element on the wrong side of ' + v.pivot + '.'; break;
        case 'split': say = 'quicksort calls partition(a, ' + lo + ', ' + hi + ') to split this range in two.'; break;
        case 'left': say = 'Now sort the left part, a[' + lo + '..' + hi + '], with a recursive call. The bracket pile under the bars grows by one.'; break;
        case 'right': say = 'The left part is sorted. Now the right part, a[' + lo + '..' + hi + '].'; break;
        case 'after': say = 'Sorted: ' + a.join(' ') + '. ' + plural(ctx.counters.compares, 'comparison') + ', ' + plural(ctx.counters.swaps, 'swap') + '.'; break;
      }
      if (!say && ctx.tick.end) say = ctx.tick.fn === 'quicksort' ? 'This call of quicksort is finished; back to its caller.' : 'partition is finished.';
      return { items, say, slow: tag === 'swap' || tag === 'split-at' };
    },
    predict: [
      {
        at: (t) => t.tag === 'init-j', once: true,
        ask: (t) => 'i scans right and stops at the first value that is not smaller than the pivot ' + t.data.vars.pivot + '. At which index will it stop?',
        options: (ts, i) => range(ts[i].data.vars.lo, ts[i].data.vars.hi).map(String),
        answer: (ts, i) => { for (let k = i + 1; k < ts.length; k++) if (ts[k].tag === 'step-j') return String(ts[k].data.vars.i); return null; },
        pick: 'option', explain: (ts, i) => 'Every value before it is smaller than ' + ts[i].data.vars.pivot + '. At worst it stops on the pivot itself, so i can never run off the end.',
      },
      {
        at: (t, i, ts) => t.tag === 'cmp-j' && ts[i + 1] && ts[i + 1].tag === 'cross' && t.data.vars.i >= t.data.vars.j, once: true,
        ask: (t) => 'Both have stopped: i = ' + t.data.vars.i + ', j = ' + t.data.vars.j + '. What does partition do now?',
        options: () => ['Swap a[i] and a[j]', 'Return j as the split point', 'Move the pivot into a[j]'], answer: () => 'Return j as the split point', pick: 'option',
        explain: () => 'Once they cross, every element is on its correct side, so the job is done. Nothing moves the pivot on purpose.',
      },
      {
        at: (t, i, ts) => t.tag === 'step-j' && ts[i + 1] && ts[i + 1].tag === 'cmp-j' && t.data.a[t.data.vars.j] > t.data.vars.pivot, once: true,
        ask: (t) => 'j is at ' + t.data.a[t.data.vars.j] + ', the pivot is ' + t.data.vars.pivot + '. Does j stop here?',
        options: () => ['Yes, it stops', 'No, it keeps moving left'], answer: () => 'No, it keeps moving left', pick: 'option',
        explain: (ts, i) => ts[i].data.a[ts[i].data.vars.j] + ' > ' + ts[i].data.vars.pivot + ' is already on the right side, so j passes over it.',
      },
    ],
    quiz: [
      { q: 'Why do i and j also stop on values equal to the pivot?', options: ['It is a bug', 'So that many equal keys are split evenly between the halves', 'To find the pivot', 'To save comparisons'], answer: 1, why: 'Stopping on equals swaps them across, so an array of equal values splits in the middle instead of giving one empty side.' },
      { q: 'After partition returns j, where is the pivot?', options: ['Always at j', 'Always at j + 1', 'Somewhere in a[lo..hi], not necessarily in its final place', 'At lo'], answer: 2, why: 'Hoare\'s scheme only guarantees a[lo..j] ≤ pivot ≤ a[j+1..hi]. That is why the recursion uses a[lo..j], including j.' },
      { q: 'Why does quicksort recurse on a[lo..p] and not a[lo..p-1]?', options: ['Because a[p] may still be out of place', 'To make the recursion deeper', 'Because p is the pivot', 'It makes no difference'], answer: 0, why: 'a[p] is not fixed in place by Hoare\'s partition; it has to be sorted with the left part.' },
      { q: 'Compared with Lomuto\'s partition, Hoare\'s usually makes...', options: ['More swaps', 'About three times fewer swaps', 'The same swaps', 'No comparisons'], answer: 1, why: 'Hoare only swaps pairs that are both on the wrong side; Lomuto swaps every small element it meets.' },
      { q: 'What happens on an already sorted array with the middle element as pivot?', options: ['n² comparisons', 'The halves stay balanced: about n log n', 'It loops forever', 'Nothing is compared'], answer: 1, why: 'The middle of a sorted range is its median, so every split is even.' },
    ],
    compareWith: 'quick-sort',
  });

  /** Name tags under elements of a bar or cell view, with chosen colours: marks {name: [index, cls]} */
  function tags(view, marks, opts) {
    opts = opts || {};
    const items = [], slots = new Map();
    for (const [name, m] of Object.entries(marks)) {
      if (!m || m[0] === null || m[0] === undefined) continue;
      const idx = m[0], s = slots.get(idx) || 0;
      slots.set(idx, s + 1);
      const k = idx >= 0 && idx < view.n ? view.keyOf(idx) : null;
      if (k) items.push({ key: 'tag' + name, kind: 'cursor', at: k, side: opts.side || 'below', slot: s, text: name, cls: m[1] });
      else items.push({ key: 'tag' + name, kind: 'cursor', x: view.xOf(idx), y: opts.y || 300, ty: (opts.y || 300) + 20 + s * 22, text: name, cls: m[1] });
    }
    return items;
  }

  // ---- three-way quick sort (Dijkstra's Dutch national flag) ---------------------------------------------------
  const flagValues = Object.assign({}, X.sortValues, { def: [4, 9, 4, 1, 9, 4, 1, 4, 7, 4] });
  X.topic({
    id: 'quick-3way', family: 'sort', order: 52, title: 'Quick sort (three-way partition)',
    blurb: 'One pass splits the range into three stripes: smaller than the pivot, equal to it, bigger. The whole equal stripe is finished at once, so many repeated keys cost almost nothing.',
    code: `/* sort a[lo..hi]: a[lo..lt-1] < pivot, a[lt..i-1] == pivot,
   a[i..gt] not seen yet, a[gt+1..hi] > pivot */
void quicksort3(int a[], int lo, int hi)
{
    int lt, gt, i, pivot;
    if (lo >= hi)                       /*@ range */
        return;                         /*@ base */
    pivot = a[lo];                      /*@ pivot */
    lt = lo;                            /*@ init-lt */
    gt = hi;                            /*@ init-gt */
    i = lo + 1;                         /*@ init-i */
    while (i <= gt) {                   /*@ loop */
        if (a[i] < pivot)               /*@ cmp-less */
            swap(&a[lt++], &a[i++]);    /*@ swap-less */
        else if (a[i] > pivot)          /*@ cmp-greater */
            swap(&a[i], &a[gt--]);      /*@ swap-greater */
        else
            i++;                        /*@ step-equal */
    }
    quicksort3(a, lo, lt - 1);          /*@ left */
    quicksort3(a, gt + 1, hi);          /*@ right */
}`,
    animate: ['quicksort3'], quiet: ['swap'],
    inputs: [flagValues],
    presets: [
      { label: 'Many equal', values: { values: [4, 9, 4, 1, 9, 4, 1, 4, 7, 4] } },
      { label: 'All equal', values: { values: [5, 5, 5, 5, 5, 5, 5, 5] } },
      { label: 'Two values', values: { values: [2, 8, 8, 2, 8, 2, 2, 8] } },
      { label: 'All different', values: { values: [38, 27, 43, 3, 9, 82, 10, 55] } },
      { label: 'One', values: { values: [6] } },
    ],
    counters: ['compares', 'swaps'],
    main: (inp) => X.sortMain(inp.values, 'quicksort3(a, 0, n - 1);'),
    capture(P) {
      const n = P.val('n');
      const calls = P.calls().filter((c) => c.fn === 'quicksort3').map((c) => ({ lo: c.args.lo, hi: c.args.hi }));
      return { a: P.arr('a', n), vars: varsOf(P, ['lo', 'hi', 'i', 'lt', 'gt', 'pivot']), calls };
    },
    scene(ctx) {
      const d = ctx.tick.data, v = d.vars, tag = ctx.tick.tag, a = d.a, memo = ctx.memo;
      const lo = v.lo, hi = v.hi, P = v.pivot;
      memo.final = memo.final || new Set();
      const looping = P !== null && v.i !== null && v.lt !== null && v.gt !== null;
      const doneLoop = looping && tag === 'loop' && v.i > v.gt;
      if (doneLoop) for (let k = v.lt; k <= v.gt; k++) memo.final.add(k);
      if (tag === 'range' && lo === hi) memo.final.add(lo);
      const end = tag === 'after' || ctx.i === ctx.ticks.length - 1;
      const zone = (k) => {
        if (!looping) return '';
        if (k < v.lt) return 'sb-less';
        if (k < v.i) return 'sb-eq';
        if (k <= v.gt) return 'sb-unk';
        return 'sb-more';
      };
      const view = A.bars(ctx, a, {
        cls: (k) => {
          if (end || memo.final.has(k) && !(looping && k >= lo && k <= hi && !doneLoop)) return 'done';
          if (lo !== null && hi !== null && (k < lo || k > hi)) return 'dim';
          if (looping) return zone(k) + (k === v.i && /^cmp/.test(tag) ? ' hot' : '');
          return '';
        },
      });
      view.n = a.length;
      const items = view.items.slice();
      if (looping && !doneLoop) {
        const z = [['zless', lo, v.lt - 1, 'sb-less', '< ' + P], ['zeq', v.lt, v.i - 1, 'sb-eq', '= ' + P], ['zmore', v.gt + 1, hi, 'sb-more', '> ' + P]];
        for (const [key, l, h, c, t] of z) items.push(...A.range(view, key, l, h, c, t, { cell: 40, y0: 0, h: 290 }));
        if (v.i <= v.gt) items.push(...A.range(view, 'zunk', v.i, v.gt, 'sb-frame', 'not seen', { cell: 40, y0: 0, h: 290 }));
        items.push(...tags(view, { lt: [v.lt, 'c-teal'], i: [v.i, 'c-amber'], gt: [v.gt, 'c-violet'] }, { y: 260 }));
      } else if (!end && lo !== null) items.push(...tags(view, { lo: [lo, 'c-indigo'], hi: [hi, 'c-violet'] }, { y: 260 }));
      if (doneLoop) {
        // the finished flag: three stripes
        const stripes = [['fl', lo, v.lt - 1, 'sb-less', '< ' + P], ['fe', v.lt, v.gt, 'sb-eq', '= ' + P + ': done'], ['fm', v.gt + 1, hi, 'sb-more', '> ' + P]];
        for (const [key, l, h, c, t] of stripes) items.push(...A.range(view, key, l, h, c, t, { cell: 40, y0: 0, h: 290 }));
      }
      if (P !== null && !end) items.push({ key: 'pv', kind: 'text', x: view.xOf(lo), y: -26, text: 'pivot ' + P, cls: 'sb-hot', anchor: 'middle' });
      if (!end) items.push(...callBrackets(view, d.calls, 370));
      items.push({ key: 'title', kind: 'text', x: view.xOf(0) - 20, y: -50, text: end ? 'sorted' : 'quicksort3(' + lo + ', ' + hi + '), depth ' + d.calls.length, cls: 'sb-title' });

      const ai = looping && v.i <= hi ? a[v.i] : null;
      let say = '';
      switch (tag) {
        case 'enter': say = 'quicksort3(a, 0, ' + (a.length - 1) + ') is called on the whole array.'; break;
        case 'range': say = lo >= hi ? 'a[' + lo + '..' + hi + '] has ' + (lo === hi ? 'one element' : 'no elements') + ': nothing to sort.' : 'This call sorts a[' + lo + '..' + hi + '], ' + (hi - lo + 1) + ' elements.'; break;
        case 'base': say = 'Return straight away.'; break;
        case 'pivot': say = 'The pivot is the first element, ' + P + '. Every other value is about to be sorted into one of three stripes: less, equal, greater.'; break;
        case 'init-lt': say = 'lt marks where the equal stripe starts. For now it is just the pivot at a[' + lo + '].'; break;
        case 'init-gt': say = 'gt marks the last unseen element: everything after it will be bigger than ' + P + '. It starts at the end, a[' + hi + '].'; break;
        case 'init-i': say = 'i is the next element to look at, a[' + v.i + ']. The grey stripe a[' + v.i + '..' + v.gt + '] is still unseen.'; break;
        case 'loop': say = v.i <= v.gt ? 'Still ' + plural(v.gt - v.i + 1, 'element') + ' unseen. Look at a[' + v.i + '] = ' + ai + '.' : 'Nothing is left unseen. The flag is complete: a[' + v.lt + '..' + v.gt + '] all equal ' + P + ' and are in their final places.'; break;
        case 'cmp-less': say = ai < P ? ai + ' < ' + P + ': it belongs in the blue stripe on the left.' : ai + ' is not smaller than ' + P + '.'; break;
        case 'swap-less': say = 'Swap it with a[' + (v.lt - 1) + '], the first of the equal stripe. The small value joins the left stripe and the equal one moves to the stripe\'s end. lt and i both move on.'; break;
        case 'cmp-greater': say = ai > P ? ai + ' > ' + P + ': it belongs in the violet stripe on the right.' : ai + ' = ' + P + ': it is equal to the pivot.'; break;
        case 'swap-greater': say = 'Swap it with a[' + (v.gt + 1) + '], the last unseen element, and gt moves left. i does not move: the value that came back from the end has not been looked at yet.'; break;
        case 'step-equal': say = 'An equal value: the equal stripe just grows to include it. No swap needed.'; break;
        case 'left': say = 'Sort the "less" stripe a[' + lo + '..' + hi + '] with a recursive call. The equal stripe is never touched again.'; break;
        case 'right': say = 'Now the "greater" stripe, a[' + lo + '..' + hi + '].'; break;
        case 'after': say = 'Sorted: ' + a.join(' ') + '. ' + plural(ctx.counters.compares, 'comparison') + ', ' + plural(ctx.counters.swaps, 'swap') + '.'; break;
      }
      if (!say && ctx.tick.end) say = 'This call is finished; back to its caller.';
      return { items, say, slow: doneLoop };
    },
    predict: [
      {
        at: (t, i, ts) => t.tag === 'cmp-greater' && ts[i + 1] && ts[i + 1].tag === 'swap-greater', once: true,
        ask: (t) => t.data.a[t.data.vars.i] + ' is about to be swapped with a[gt] = a[' + t.data.vars.gt + ']. After the swap, does i move on to the next element?',
        options: () => ['Yes, i moves right', 'No, i stays where it is'], answer: () => 'No, i stays where it is', pick: 'option',
        explain: () => 'The value that arrives at a[i] comes from the unseen end. It still has to be compared with the pivot.',
      },
      {
        at: (t) => t.tag === 'loop' && t.data.vars.i !== null && t.data.vars.i <= t.data.vars.gt && t.data.a[t.data.vars.i] === t.data.vars.pivot, once: true,
        ask: (t) => 'a[i] = ' + t.data.a[t.data.vars.i] + ' and the pivot is ' + t.data.vars.pivot + '. What happens to it?',
        options: () => ['It is swapped to the left', 'It is swapped to the right', 'It stays; the equal stripe grows'], answer: () => 'It stays; the equal stripe grows', pick: 'option',
        explain: () => 'The equal stripe ends just before i, so an equal value is already in the right place.',
      },
      {
        at: (t, i, ts) => { const u = ts[i + 1]; return !!u && u.tag === 'loop' && u.data.vars.i !== null && u.data.vars.gt !== null && u.data.vars.i > u.data.vars.gt; }, once: true,
        ask: (t, ts, i) => 'The last unseen element has just been placed, so the partition of a[' + ts[i + 1].data.vars.lo + '..' + ts[i + 1].data.vars.hi + '] is done. How many of its elements still need sorting?',
        options: (ts, i) => { const v = ts[i + 1].data.vars; return range(0, v.hi - v.lo + 1).map(String); },
        answer: (ts, i) => { const v = ts[i + 1].data.vars; return String((v.lt - v.lo) + (v.hi - v.gt)); }, pick: 'option',
        explain: (ts, i) => { const v = ts[i + 1].data.vars; return 'Only the two outer stripes: ' + (v.lt - v.lo) + ' smaller and ' + (v.hi - v.gt) + ' bigger. The ' + (v.gt - v.lt + 1) + ' equal values are finished.'; },
      },
    ],
    quiz: [
      { q: 'Why is three-way partitioning good for arrays with many equal keys?', options: ['It uses less memory', 'All keys equal to the pivot are finished in one pass and never looked at again', 'It needs no comparisons', 'It is stable'], answer: 1, why: 'The equal stripe is excluded from both recursive calls, so repeated keys do not cause repeated work.' },
      { q: 'How long does it take on an array where every value is the same?', options: ['n² steps', 'n log n steps', 'One pass: about n steps', 'It never finishes'], answer: 2, why: 'Every element joins the equal stripe in the first pass, and both recursive calls get empty ranges.' },
      { q: 'After a[i] > pivot is swapped with a[gt], why does i not move?', options: ['A mistake', 'The value that arrived at a[i] has not been compared yet', 'i always waits one step', 'Because gt moved'], answer: 1, why: 'It came from the unseen part, so it must be classified first.' },
      { q: 'After a[i] < pivot is swapped with a[lt], why can i move on?', options: ['a[lt] was already known to equal the pivot', 'Because lt moved', 'It cannot', 'i always moves'], answer: 0, why: 'Everything in a[lt..i-1] is equal to the pivot, so the value coming back to a[i] has already been seen.' },
      { q: 'Is this three-way quick sort stable?', options: ['Yes', 'No: long-distance swaps can reorder equal keys', 'Only with small arrays', 'Only if the pivot is the median'], answer: 1, why: 'Swaps jump over other elements, so two equal keys can end up in the other order.' },
    ],
    compareWith: 'quick-sort',
  });

  // ---- heap sort -------------------------------------------------------------------------------------------
  // The same cells drawn twice: as the array they really are, and as the tree that the indices describe
  // (children of k at 2k + 1 and 2k + 2). A swap moves a value in both pictures at once.
  const HEAP_W = 512, HEAP_DY = 80, HEAP_R = 22, HEAP_Y = 340;
  const heapPos = (k) => {
    const lev = Math.floor(Math.log2(k + 1)), p = k - (Math.pow(2, lev) - 1);
    return { x: (p + 0.5) * HEAP_W / Math.pow(2, lev), y: lev * HEAP_DY };
  };
  X.topic({
    id: 'heap-sort', family: 'sort', order: 70, title: 'Heap sort',
    blurb: 'Read the array as a tree and turn it into a max-heap. The biggest value is then at the root: swap it to the end, shrink the heap by one, let the new root sink, and repeat.',
    code: `/* let a[i] sink until it is no smaller than its children;
   the heap is a[0..n-1], the children of k are 2k+1 and 2k+2 */
void sift_down(int a[], int n, int i)
{
    int child;
    while (2 * i + 1 < n) {                          /*@ has-child */
        child = 2 * i + 1;                           /*@ left */
        if (child + 1 < n && a[child + 1] > a[child])    /*@ cmp-kids */
            child++;                                 /*@ right */
        if (a[i] >= a[child])                        /*@ cmp-parent */
            break;                                   /*@ settled */
        swap(&a[i], &a[child]);                      /*@ swap-down */
        i = child;                                   /*@ descend */
    }
}

void heap_sort(int a[], int n)
{
    int i;
    for (i = n / 2 - 1; i >= 0; i--)                 /*@ build */
        sift_down(a, n, i);                          /*@ heapify */
    for (i = n - 1; i > 0; i--) {                    /*@ extract */
        swap(&a[0], &a[i]);                          /*@ swap-root */
        sift_down(a, i, 0);                          /*@ shrink */
    }
}`,
    animate: ['heap_sort', 'sift_down'], quiet: ['swap'],
    inputs: [Object.assign({}, X.sortValues, { def: [27, 64, 12, 90, 45, 33, 71, 8, 56, 19] })],
    presets: [
      { label: 'Mixed', values: { values: [27, 64, 12, 90, 45, 33, 71, 8, 56, 19] } },
      { label: 'Already sorted', values: { values: [5, 12, 19, 26, 33, 40, 47, 54] } },
      { label: 'Reverse sorted (a heap already)', values: { values: [80, 70, 60, 50, 40, 30, 20, 10] } },
      { label: 'Many equal', values: { values: [4, 9, 4, 1, 9, 4, 1, 4] } },
      { label: 'Two', values: { values: [9, 2] } },
    ],
    counters: ['compares', 'swaps'],
    main: (inp) => X.sortMain(inp.values, 'heap_sort(a, n);'),
    capture(P) {
      const mi = P.frames.findIndex((f) => f.name === 'main');
      const N = P.val('n', mi);
      return { a: P.arr('a', N), vars: varsOf(P, ['i', 'n', 'child']), fn: P.frames[0].name };
    },
    scene(ctx) {
      const d = ctx.tick.data, v = d.vars, tag = ctx.tick.tag, a = d.a, memo = ctx.memo, N = a.length;
      const tr = A.track(ctx, 'a', a);
      memo.ids = memo.ids || [];
      memo.ids[ctx.i] = tr.ids.slice();
      if (tag === 'extract') memo.phase = 'sort';
      const phase = memo.phase || 'build';
      const inSift = d.fn === 'sift_down';
      // which call of sift_down is this: remember the element it started with, to follow it down
      if (inSift && (!ctx.prev || ctx.prev.data.fn !== 'sift_down' || ctx.prev.tag === 'heapify' || ctx.prev.tag === 'shrink')) {
        if (tag === 'heapify' || tag === 'shrink' || memo.siftId === undefined || ctx.prev.data.fn !== 'sift_down') memo.siftId = tr.ids[v.i];
      }
      const end = tag === 'after' || ctx.i === ctx.ticks.length - 1;
      let heap;
      if (end) heap = 0;
      else if (inSift) heap = v.n;
      else if (phase === 'build') heap = N;
      else heap = tag === 'swap-root' ? v.i : (v.i === null ? N : v.i + 1);
      const ci = inSift ? v.i : null, ch = inSift ? v.child : null;
      const cmpKids = tag === 'cmp-kids' || tag === 'right', cmpPar = tag === 'cmp-parent' || tag === 'settled' || tag === 'swap-down';
      const hotIdx = new Set();
      if (cmpKids && ch !== null) { const l = tag === 'right' ? ch - 1 : ch; hotIdx.add(l); if (l + 1 < v.n) hotIdx.add(l + 1); }
      if (cmpPar && ch !== null) hotIdx.add(ch);
      const sinker = (k) => inSift && tr.ids[k] === memo.siftId && tag !== 'enter';
      const cls = (k) => {
        if (k >= heap) return 'done';
        if (sinker(k)) return 'focus';
        if (hotIdx.has(k)) return 'hot';
        if (phase === 'sort' && tag === 'swap-root' && k === 0) return 'hot';
        return '';
      };
      const items = [];
      // the tree
      const ox = 0;
      for (let k = 1; k < N; k++) {
        const pa = heapPos((k - 1) >> 1), pc = heapPos(k);
        const par = (k - 1) >> 1;
        const isHot = ch === k && (cmpPar || cmpKids) || cmpKids && hotIdx.has(k) && ci === par;
        items.push({ key: 'ed' + k, kind: 'line', x1: ox + pa.x, y1: pa.y, x2: ox + pc.x, y2: pc.y, cls: 'sb-edge' + (k >= heap ? ' gone' : isHot ? ' hot' : '') });
      }
      a.forEach((val, k) => {
        const p = heapPos(k);
        const swapped = tr.swaps.some((s) => s.includes(k));
        items.push({ key: 'v' + tr.ids[k], kind: 'vertex', x: ox + p.x, y: p.y, r: HEAP_R, text: val, cls: (k >= heap ? 'sb-out' : cls(k)), flash: swapped });
      });
      // the array
      const cw = 48, x0 = HEAP_W / 2 - (N * (cw + 6) - 6) / 2;
      const view = A.cells(ctx, a, { tracked: tr, x0, y0: HEAP_Y, cell: cw, cls: (k) => cls(k), arc: 40 });
      items.push(...view.items);
      if (heap > 0 && heap < N) {
        const x = x0 + heap * (cw + 6) - 3;
        items.push({ key: 'wall', kind: 'line', x1: x, y1: HEAP_Y - 30, x2: x, y2: HEAP_Y + cw + 26, cls: 'sb-wall' });
        items.push({ key: 'wallh', kind: 'text', x: x - 8, y: HEAP_Y - 14, text: 'heap', cls: 'sb-hot', anchor: 'end' });
        items.push({ key: 'walls', kind: 'text', x: x + 8, y: HEAP_Y - 14, text: 'sorted', cls: 'sb-good' });
      }
      if (inSift && ci !== null && ci < N) items.push({ key: 'ci', kind: 'cursor', at: view.keyOf(ci), side: 'below', text: 'i', cls: 'c-teal' });
      if (inSift && ch !== null && ch < N && ['left', 'cmp-kids', 'right', 'cmp-parent', 'settled', 'swap-down'].includes(tag)) items.push({ key: 'cc', kind: 'cursor', at: view.keyOf(ch), side: 'below', slot: ch === ci ? 1 : 0, text: 'child', cls: 'c-amber' });
      items.push({ key: 'title', kind: 'text', x: -40, y: -48, text: end ? 'sorted' : phase === 'build' ? 'phase 1: build a max-heap' : 'phase 2: take the root, ' + heap + ' left in the heap', cls: 'sb-title' });

      const A_ = (k) => 'a[' + k + '] = ' + a[k];
      let say = '';
      switch (tag) {
        case 'enter': say = 'The array, read as a tree: a[0] is the root and the children of a[k] are a[2k+1] and a[2k+2]. No pointers, just index arithmetic.'; break;
        case 'build': say = v.i === (N >> 1) - 1 ? 'Build the heap from the bottom up. a[' + v.i + '] is the last node that has children; everything after it is a leaf, and a leaf is already a heap.' : v.i >= 0 ? 'Move one node back: a[' + v.i + '] = ' + a[v.i] + ' is next. Everything under it is a heap already.' : 'Every node has been sifted: the array is now a max-heap. Each parent is at least as big as its children.'; break;
        case 'heapify': say = 'sift_down(a, ' + v.n + ', ' + v.i + '): its two subtrees are heaps already; now make the subtree under a[' + v.i + '] = ' + a[v.i] + ' a heap too.'; break;
        case 'has-child': say = 2 * v.i + 1 < v.n ? a[v.i] + ' at a[' + v.i + '] has at least one child inside the heap.' : a[v.i] + ' at a[' + v.i + '] has no children inside the heap: it is a leaf, so it stops here.'; break;
        case 'left': say = 'Its left child is ' + A_(v.child) + '.'; break;
        case 'cmp-kids': say = v.child + 1 < v.n ? 'Which child is bigger, ' + a[v.child] + ' or ' + a[v.child + 1] + '? ' + (a[v.child + 1] > a[v.child] ? 'The right one.' : 'The left one.') : 'There is no right child inside the heap, so the left child it is.'; break;
        case 'right': say = 'child moves to the right child, ' + A_(v.child) + '.'; break;
        case 'cmp-parent': say = 'Is ' + a[v.i] + ' ≥ its bigger child ' + a[v.child] + '? ' + (a[v.i] >= a[v.child] ? 'Yes.' : 'No: it has to sink.'); break;
        case 'settled': say = a[v.i] + ' is no smaller than its children: the subtree is a heap. Stop.'; break;
        case 'swap-down': say = 'Swap: ' + a[v.child] + ' sinks to a[' + v.child + '] and ' + a[v.i] + ' rises to a[' + v.i + ']. Watch both the tree and the array.'; break;
        case 'descend': say = 'Follow ' + a[v.i] + ' down to a[' + v.i + '] and check it again.'; break;
        case 'extract': say = v.i > 0 ? 'The root a[0] = ' + a[0] + ' is the biggest of the ' + (v.i + 1) + ' values left in the heap.' : 'One value is left in the heap, and it is the smallest. Done.'; break;
        case 'swap-root': say = 'Swap it with the last heap element, a[' + v.i + ']. ' + a[v.i] + ' is now in its final place, and the heap shrinks to a[0..' + (v.i - 1) + '].'; break;
        case 'shrink': say = 'The new root ' + a[0] + ' is probably too small for the top. sift_down(a, ' + v.n + ', 0) lets it sink.'; break;
        case 'after': say = 'Sorted: ' + a.join(' ') + '. ' + plural(ctx.counters.compares, 'comparison') + ', ' + plural(ctx.counters.swaps, 'swap') + ', and no extra array.'; break;
      }
      if (!say && ctx.tick.end) say = ctx.tick.fn === 'sift_down' ? 'sift_down returns: this subtree is a heap again.' : 'heap_sort is finished.';
      return { items, say, slow: tag === 'swap-root' };
    },
    predict: [
      {
        at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'extract' && t.tag !== 'extract' && t.tag !== 'shrink' && t.tag !== 'swap-root' && !ts.slice(0, i).some((x) => x.tag === 'extract'), once: true,
        ask: () => 'The heap is about to be complete. Where is the biggest value?', options: () => ['At a[0], the root', 'At the last index', 'At a leaf', 'Anywhere'],
        answer: () => 'At a[0], the root', pick: 'option', explain: () => 'Every parent is at least as big as its children, so nothing can be bigger than the root.',
      },
      {
        at: (t, i, ts) => t.tag === 'left' && t.data.vars.child + 1 < t.data.vars.n, once: true,
        ask: (t) => 'a[' + t.data.vars.i + '] = ' + t.data.a[t.data.vars.i] + ' may have to sink. Which child would it swap with?',
        options: (ts, i) => { const v = ts[i].data.vars, a = ts[i].data.a; return ['a[' + v.child + '] = ' + a[v.child], 'a[' + (v.child + 1) + '] = ' + a[v.child + 1]]; },
        answer: (ts, i) => { const v = ts[i].data.vars, a = ts[i].data.a; const c = a[v.child + 1] > a[v.child] ? v.child + 1 : v.child; return 'a[' + c + '] = ' + a[c]; }, pick: 'option',
        explain: () => 'Always the bigger child: it becomes the parent of the other one, so it must be the bigger of the two.',
      },
      {
        at: (t) => t.tag === 'extract' && t.data.vars.i > 1 && t.data.vars.i < t.data.a.length - 1, once: true,
        ask: (t) => 'Which value moves into a[0] after the next swap?',
        options: (ts, i) => [...new Set(ts[i].data.a.slice(0, ts[i].data.vars.i + 1))].map(String),
        answer: (ts, i) => String(ts[i].data.a[ts[i].data.vars.i]), pick: 'option',
        explain: (ts, i) => 'The root swaps with the last element of the heap, a[' + ts[i].data.vars.i + '].',
      },
    ],
    quiz: [
      { q: 'In the array form of a heap, where are the children of a[4]?', options: ['a[5] and a[6]', 'a[8] and a[9]', 'a[9] and a[10]', 'a[2]'], answer: 2, why: '2·4 + 1 = 9 and 2·4 + 2 = 10.' },
      { q: 'Why does building the heap start at index n/2 - 1 and go backwards?', options: ['To save memory', 'Nodes after it are leaves, and sifting needs both subtrees to be heaps already', 'Because the root is at the end', 'It does not matter'], answer: 1, why: 'Working from the bottom up, each sift_down call can rely on the subtrees under it being heaps.' },
      { q: 'When sifting down, why swap with the bigger child?', options: ['It is faster', 'So the new parent is at least as big as the other child', 'To keep the sort stable', 'The smaller child is never compared'], answer: 1, why: 'Swapping with the smaller one would put a smaller value above a bigger one.' },
      { q: 'How much extra memory does heap sort need?', options: ['An array of n', 'A constant amount', 'log n for recursion', 'n² cells'], answer: 1, why: 'The heap lives inside the array itself and sift_down here is a loop, so only a few variables are needed.' },
      { q: 'What is heap sort\'s running time on any input?', options: ['n', 'n log n', 'n² in the worst case', 'log n'], answer: 1, why: 'Building the heap is O(n), then n - 1 sift-downs of at most log n levels each.' },
      { q: 'Is heap sort stable?', options: ['Yes', 'No', 'Only for small arrays', 'Only if values are distinct'], answer: 1, why: 'Equal values can be swapped past each other on their way to the root and back.' },
    ],
    compareWith: 'merge-sort',
  });

  // ---- counting sort ---------------------------------------------------------------------------------------
  // Three rows: the input, the count array (a histogram of tallies, then running totals), the output.
  // The prefix sums carve the output into one band per value; elements then drop into their band from the right.
  const CW = 50, CS = 56;
  const LETTERS = 'abcdefghijkl';
  /** Small letters that tell equal values apart: the first 4 is 4a, the second 4b, ... (only for repeated values) */
  const dupMarks = (vals) => {
    const seen = {}, total = {};
    for (const x of vals) total[x] = (total[x] || 0) + 1;
    return vals.map((x) => { seen[x] = (seen[x] || 0) + 1; return total[x] > 1 ? LETTERS[seen[x] - 1] : ''; });
  };
  const countValues = { id: 'values', kind: 'ints', label: 'The numbers (0 to 9)', def: [3, 6, 4, 1, 3, 4, 1, 4], min: 1, max: 12, check: (v) => (v.some((x) => x < 0 || x > 9) ? 'Counting sort here uses keys from 0 to 9 only' : null) };
  X.topic({
    id: 'counting-sort', family: 'sort', order: 80, title: 'Counting sort',
    blurb: 'No comparisons at all: count how many times each key occurs, turn the counts into positions, and drop every element straight into its place.',
    code: `#define K 9    /* every key is between 0 and K */

/* sort a[0..n-1] into out[0..n-1]; equal keys keep their order */
void counting_sort(int a[], int out[], int n)
{
    int count[K + 1] = { 0 };             /*@ zero */
    int i, v;
    for (i = 0; i < n; i++)               /*@ tally-loop */
        count[a[i]]++;                    /*@ tally */
    for (v = 1; v <= K; v++)              /*@ prefix-loop */
        count[v] += count[v - 1];         /*@ prefix */
    for (i = n - 1; i >= 0; i--) {        /*@ back-loop */
        count[a[i]]--;                    /*@ claim */
        out[count[a[i]]] = a[i];          /*@ place */
    }
}`,
    animate: ['counting_sort'],
    inputs: [countValues],
    presets: [
      { label: 'Repeated keys', values: { values: [3, 6, 4, 1, 3, 4, 1, 4] } },
      { label: 'All different', values: { values: [7, 2, 9, 0, 5, 3] } },
      { label: 'All the same', values: { values: [5, 5, 5, 5, 5] } },
      { label: 'Only 0 and 9', values: { values: [9, 0, 9, 0, 0, 9] } },
      { label: 'Reverse', values: { values: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] } },
    ],
    counters: ['compares', 'moves'],
    main: (inp) => `int main(void)
{
    int a[] = { ${inp.values.join(', ')} };
    int out[${inp.values.length}];
    int n = ${inp.values.length};
    counting_sort(a, out, n);
    return 0;
}`,
    capture(P) {
      const n = P.val('n');
      return { a: P.arr('a', n), out: P.arr('out', n), count: P.arr('count', 10), vars: varsOf(P, ['i', 'v']) };
    },
    scene(ctx) {
      const d = ctx.tick.data, v = d.vars, tag = ctx.tick.tag, a = d.a, memo = ctx.memo, n = a.length;
      const count = d.count || [];
      const marks = dupMarks(ctx.input.values);
      const W = Math.max(n, 10) * CS;
      const ax = (k) => (W - n * CS) / 2 + k * CS, cx = (k) => (W - 10 * CS) / 2 + k * CS;
      const AY = 0, CY = 235, OY = 370;
      if (tag === 'tally-loop' && v.i === 0) memo.phase = 'tally';
      if (tag === 'prefix-loop' && !memo.tally) { memo.tally = count.slice(); memo.phase = 'prefix'; }
      if (tag === 'back-loop' && memo.phase === 'prefix') { memo.phase = 'place'; memo.starts = memo.tally.map((c, w) => count[w] - c); }
      memo.outFrom = memo.outFrom || {};
      if (tag === 'place') memo.outFrom[count[a[v.i]]] = v.i;
      const phase = memo.phase || 'start';
      const end = tag === 'after' || ctx.i === ctx.ticks.length - 1;
      const items = [];
      const label = (key, y, text) => items.push({ key, kind: 'text', x: -66, y: y + 31, text, cls: 'sb-label' });
      label('la', AY, 'a'); label('lc', CY, 'count'); label('lo', OY, 'out');
      // input row: an element that has been placed is left behind as a faint copy
      const placed = new Set(Object.values(memo.outFrom));
      a.forEach((x, k) => {
        const cur = v.i === k && (phase === 'tally' || phase === 'place') && !end;
        items.push({ key: 'a' + k, kind: 'cell', x: ax(k), y: AY, w: CW, h: CW, text: x, sub: k, cls: placed.has(k) ? 'ghost' : cur ? 'focus' : '' });
        if (marks[k]) items.push({ key: 'am' + k, kind: 'text', x: ax(k) + CW - 4, y: AY + 13, text: marks[k], cls: 'sb-mark', anchor: 'end' });
      });
      // count row
      const hotV = (tag === 'tally' && v.i !== null) || tag === 'claim' || tag === 'place' ? a[v.i] : tag === 'prefix' ? v.v : null;
      for (let w = 0; w <= 9; w++) {
        items.push({ key: 'c' + w, kind: 'cell', x: cx(w), y: CY, w: CW, h: CW, text: count[w] === null || count[w] === undefined ? '' : count[w], sub: 'key ' + w, cls: w === hotV ? 'hot' : '', flash: w === hotV && (tag === 'tally' || tag === 'claim' || tag === 'prefix') });
      }
      // out row: empty slots and the elements placed so far
      for (let s = 0; s < n; s++) {
        items.push({ key: 'os' + s, kind: 'region', x: ax(s) - 2, y: OY - 2, w: CW + 4, h: CW + 4, cls: 'sb-frame' });
        items.push({ key: 'oi' + s, kind: 'text', x: ax(s) + CW / 2, y: OY + CW + 16, text: String(s), cls: 'idx', anchor: 'middle' });
        if (d.out[s] !== null && memo.outFrom[s] !== undefined) {
          const from = memo.outFrom[s];
          items.push({ key: 'o' + s, kind: 'cell', x: ax(s), y: OY, w: CW, h: CW, text: d.out[s], sub: '', cls: end ? 'done' : tag === 'place' && from === v.i ? 'hot' : 'part-a', enter: 'fly', from: { x: ax(from), y: AY } });
          if (marks[from]) items.push({ key: 'om' + s, kind: 'text', x: ax(s) + CW - 4, y: OY + 13, text: marks[from], cls: 'sb-mark', anchor: 'end' });
        }
      }
      // tallies: a dot per element counted; after the prefix sums each dot stands on the out slot it reserves
      const tallies = phase === 'tally' ? count : memo.tally || [];
      const banded = (w) => phase === 'place' || end || phase === 'prefix' && v.v !== null && w <= Math.min(v.v, 9) && tag !== 'prefix-loop' || phase === 'prefix' && v.v !== null && w < v.v;
      tallies.forEach((c, w) => {
        for (let j = 0; j < (c || 0); j++) {
          let x = cx(w) + CW / 2, y = CY - 12 - j * 13;
          if (banded(w)) {
            const start = phase === 'place' || end ? memo.starts[w] : count[w] - c;
            const slot = start + j;
            if (memo.outFrom[slot] !== undefined) continue;
            x = ax(slot) + CW / 2; y = OY - 14;
          }
          const fresh = tag === 'tally' && w === a[v.i] && j === c - 1;
          items.push({ key: 'tal' + w + '_' + j, kind: 'token', x, y, r: 5, cls: 'sb-tally' + (fresh ? ' hot' : ''), enter: fresh ? 'fly' : 'fade', from: fresh ? { x: ax(v.i) + CW / 2, y: AY + CW } : null });
        }
      });
      // bands over the out row: the slots each key owns
      if (memo.tally) {
        for (let w = 0; w <= 9; w++) {
          const c = memo.tally[w];
          if (!c || !banded(w)) continue;
          const start = phase === 'place' || end ? memo.starts[w] : count[w] - c;
          items.push({ key: 'band' + w, kind: 'region', x: ax(start) - 5, y: OY - 44, w: (c - 1) * CS + CW + 10, h: CW + 49, cls: 'sb-band' + (w === hotV && phase !== 'prefix' ? ' hot' : ''), text: 'key ' + w });
        }
      }
      if (tag === 'prefix') items.push({ key: 'pf', kind: 'arrow', from: { key: 'c' + (v.v - 1), side: 'top' }, to: { key: 'c' + v.v, side: 'top' }, bend: -24, cls: 'hot', label: '+' });
      if (tag === 'claim') items.push({ key: 'cl', kind: 'arrow', from: { key: 'c' + a[v.i], side: 'bottom' }, to: { x: ax(count[a[v.i]]) + CW / 2, y: OY - 46 }, cls: 'hot' });
      if (!end && v.i !== null && v.i >= 0 && v.i < n && (phase === 'tally' || phase === 'place')) items.push({ key: 'ti', kind: 'cursor', at: 'a' + v.i, side: 'above', text: 'i', cls: 'c-teal' });
      if (!end && phase === 'prefix' && v.v !== null && v.v <= 9) items.push({ key: 'tv', kind: 'cursor', at: 'c' + v.v, side: 'below', text: 'v', cls: 'c-violet' });
      items.push({ key: 'title', kind: 'text', x: -70, y: -40, text: end ? 'sorted, and stable' : { start: '', tally: 'step 1: count each key', prefix: 'step 2: running totals', place: 'step 3: place, from the right' }[phase], cls: 'sb-title' });

      const x = v.i !== null && v.i >= 0 && v.i < n ? a[v.i] : null;
      let say = '';
      switch (tag) {
        case 'enter': say = 'counting_sort(a, out, ' + n + '): it reads a and writes the sorted keys into out.'; break;
        case 'zero': say = 'count starts as ten zeros, one counter for each possible key 0 to 9. The program will never compare two elements with each other.'; break;
        case 'tally-loop': say = v.i < n ? 'Look at a[' + v.i + '] = ' + x + '.' : 'Every element has been counted. The dots form a histogram of the keys.'; break;
        case 'tally': say = 'count[' + x + '] goes up to ' + count[x] + ': ' + plural(count[x], 'copy') .replace('copys', 'copies') + ' of ' + x + ' so far.'; break;
        case 'prefix-loop': say = v.v <= 9 ? 'Running total at key ' + v.v + '.' : 'Now count[v] is the number of keys ≤ v: the position just after the last v in the sorted output. Each band above out is the place reserved for one key.'; break;
        case 'prefix': say = 'count[' + v.v + '] += count[' + (v.v - 1) + ']: ' + count[v.v] + ' keys are ≤ ' + v.v + '.' + (memo.tally[v.v] ? ' So the ' + plural(memo.tally[v.v], 'copy').replace('copys', 'copies') + ' of ' + v.v + ' will fill out[' + (count[v.v] - memo.tally[v.v]) + '..' + (count[v.v] - 1) + '].' : ''); break;
        case 'back-loop': say = v.i >= 0 ? 'Take a[' + v.i + '] = ' + x + ', walking from the right end of a.' : 'Every element is in out. The array is sorted.'; break;
        case 'claim': say = 'count[' + x + '] goes down to ' + count[x] + ': the rightmost free slot in the band for ' + x + ' is out[' + count[x] + '].'; break;
        case 'place': {
          const first = marks[v.i] && !memo.stableSaid;
          if (first) memo.stableSaid = true;
          say = 'out[' + count[x] + '] = ' + x + (marks[v.i] ? ' (' + x + marks[v.i] + ').' : '.') + (first ? ' Going from the right, later copies of a key land further right, so equal keys keep their order: the sort is stable.' : '');
          break;
        }
        case 'after': say = 'out holds ' + d.out.join(' ') + '. ' + plural(ctx.counters.moves, 'move') + ' and no comparisons: about n + K steps.'; break;
      }
      if (!say && ctx.tick.end) say = 'counting_sort is finished.';
      return { items, say, slow: tag === 'prefix-loop' && v.v > 9 };
    },
    predict: [
      {
        at: (t) => t.tag === 'prefix-loop' && t.data.vars.v === 1, once: true,
        ask: (t, ts, i, ctx) => { const c = t.data.count; const w = c.indexOf(Math.max(...c)); return 'count[' + w + '] is ' + c[w] + ' now. What will it be after the running totals?'; },
        options: (ts, i) => range(0, ts[i].data.a.length).map(String),
        answer: (ts, i) => { const c = ts[i].data.count; const w = c.indexOf(Math.max(...c)); let s = 0; for (let k = 0; k <= w; k++) s += c[k]; return String(s); }, pick: 'option',
        explain: (ts, i) => { const c = ts[i].data.count; const w = c.indexOf(Math.max(...c)); return 'It becomes the number of keys ≤ ' + w + ': the sum of count[0..' + w + '].'; },
      },
      {
        at: (t) => t.tag === 'back-loop' && t.data.vars.i === t.data.a.length - 1, once: true,
        ask: (t) => 'a[' + t.data.vars.i + '] = ' + t.data.a[t.data.vars.i] + ' is placed first. Into which index of out will it go?',
        options: (ts, i) => range(0, ts[i].data.a.length - 1).map(String),
        answer: (ts, i) => String(ts[i].data.count[ts[i].data.a[ts[i].data.vars.i]] - 1), pick: 'option',
        explain: (ts, i) => 'count[' + ts[i].data.a[ts[i].data.vars.i] + '] = ' + ts[i].data.count[ts[i].data.a[ts[i].data.vars.i]] + ' is one past the last place for that key; it is decremented first.',
      },
      {
        at: (t, ts, i, ctx) => t.tag === 'back-loop' && t.data.vars.i >= 0 && dupMarks(ctx.input.values)[t.data.vars.i] && dupMarks(ctx.input.values)[t.data.vars.i] !== 'a' && t.data.vars.i < t.data.a.length - 1, once: true,
        ask: (t, ts, i, ctx) => { const k = t.data.vars.i, x = t.data.a[k]; return 'This is ' + x + dupMarks(ctx.input.values)[k] + '. Will it land left or right of ' + x + 'a in out?'; },
        options: () => ['Left of it', 'Right of it'], answer: () => 'Right of it', pick: 'option',
        explain: () => 'Elements are placed from the right end of a into the right end of their band, so a later copy always lands further right. That is what makes the sort stable.',
      },
    ],
    quiz: [
      { q: 'How many comparisons between elements does counting sort make?', options: ['n log n', 'n²', 'None', 'n'], answer: 2, why: 'It only uses keys as indices into count. That is how it beats the n log n limit for comparison sorts.' },
      { q: 'After the running totals, what does count[v] mean?', options: ['How many times v occurs', 'How many keys are ≤ v', 'Where v was in the input', 'The largest key'], answer: 1, why: 'Each total adds the counts of all smaller keys, so count[v] is one past the last slot for v.' },
      { q: 'Why does the last loop go from right to left?', options: ['It is faster', 'To keep equal keys in their original order', 'To avoid a negative index', 'It does not matter'], answer: 1, why: 'Bands are filled from their right end, so the last copy of a key must be placed first.' },
      { q: 'When is counting sort a poor choice?', options: ['When n is large', 'When the keys range over a huge interval, like 0 to a billion', 'When keys repeat', 'When the input is sorted'], answer: 1, why: 'count needs one cell per possible key, so time and memory grow with K, not just with n.' },
      { q: 'Why does radix sort use a stable sort for each digit?', options: ['So earlier digit passes are not undone', 'To save memory', 'Because digits repeat', 'It does not need to'], answer: 0, why: 'Keys with the same current digit must stay in the order the previous passes gave them.' },
    ],
  });

  // ---- radix sort (LSD, base 10) --------------------------------------------------------------------------
  // Ten bins under the array. Each pass, every number drops into the bin of its current digit (that digit
  // lit up), then the bins are emptied back into the array from bin 0 to bin 9, oldest first.
  const RX = 62, RW = 54, RH = 38, RDY = 42, RBY = 150;
  const digitsOf = (x, D) => String(x).padStart(D, '0').split('');
  const radixValues = { id: 'values', kind: 'ints', label: 'The numbers (0 to 999)', def: [170, 45, 75, 90, 802, 24, 2, 66], min: 1, max: 10, check: (v) => (v.some((x) => x < 0 || x > 999) ? 'Radix sort here takes numbers from 0 to 999' : null) };
  X.topic({
    id: 'radix-sort', family: 'sort', order: 81, title: 'Radix sort',
    blurb: 'Sort by the last digit, then by the tens, then by the hundreds. Each pass drops the numbers into ten bins and collects them in order; because no pass reorders equal digits, the earlier passes are never undone.',
    code: `#define BASE 10
#define MAXN 12

/* one pass: drop each a[i] into the bin of its digit (a[i] / exp) % 10,
   then empty the bins back into a, bin 0 first */
void digit_pass(int a[], int n, int exp)
{
    int bin[BASE][MAXN];
    int size[BASE] = { 0 };                         /*@ zero */
    int i, d, j, k;
    for (i = 0; i < n; i++) {                       /*@ next */
        d = (a[i] / exp) % BASE;                    /*@ digit */
        bin[d][size[d]++] = a[i];                   /*@ place */
    }
    k = 0;                                          /*@ collect-start */
    for (d = 0; d < BASE; d++)                      /*@ bin */
        for (j = 0; j < size[d]; j++) a[k++] = bin[d][j];   /*@ collect */
}

/* the largest value decides how many digit passes are needed */
int max_of(int a[], int n)
{
    int m = a[0], i;
    for (i = 1; i < n; i++)
        if (a[i] > m)
            m = a[i];
    return m;
}

void radix_sort(int a[], int n)
{
    int max = max_of(a, n);                         /*@ max */
    int exp;
    for (exp = 1; max / exp > 0; exp *= BASE)       /*@ pass */
        digit_pass(a, n, exp);                      /*@ call */
}`,
    animate: ['radix_sort', 'digit_pass'], quiet: ['max_of'],
    inputs: [radixValues],
    presets: [
      { label: 'Mixed lengths', values: { values: [170, 45, 75, 90, 802, 24, 2, 66] } },
      { label: 'Same last digit', values: { values: [31, 51, 11, 91, 41, 71] } },
      { label: 'Two digits, repeats', values: { values: [23, 32, 23, 13, 32, 31] } },
      { label: 'One digit', values: { values: [7, 3, 9, 1, 5] } },
      { label: 'Reverse', values: { values: [900, 800, 707, 606, 505, 404, 303, 202, 101, 0] } },
    ],
    counters: ['moves'],
    main: (inp) => X.sortMain(inp.values, 'radix_sort(a, n);'),
    capture(P) {
      const n = P.val('n');
      const out = { a: P.arr('a', n), vars: varsOf(P, ['i', 'd', 'k', 'exp', 'max']), fn: P.frames[0].name, size: null, bins: null };
      if (out.fn === 'digit_pass') {
        out.size = P.arr('size', 10);
        const b = P.find('bin', 0);
        if (b) {
          const T = SEE.Types, it = T.unqual(T.unqual(b.type).of).of;
          out.bins = [];
          for (let d = 0; d < 10; d++) {
            const row = [];
            for (let j = 0; j < (out.size[d] || 0); j++) row.push(P.read(it, b.addr + (d * 12 + j) * 4));
            out.bins.push(row);
          }
        }
      }
      return out;
    },
    scene(ctx) {
      const d = ctx.tick.data, v = d.vars, tag = ctx.tick.tag, a = d.a, memo = ctx.memo, n = a.length;
      const M = mover(memo);
      const vals = ctx.input.values;
      const maxV = Math.max(...vals), D = String(maxV).length;
      // the deepest bin over all passes, so the bins do not change height between passes
      if (!memo.rows) {
        memo.rows = 2;
        for (let e = 1; Math.floor(maxV / e) > 0; e *= 10) { const c = new Array(10).fill(0); for (const x of vals) c[Math.floor(x / e) % 10]++; memo.rows = Math.max(memo.rows, ...c); }
      }
      const inPass = d.fn === 'digit_pass';
      once(ctx, 'radix', () => {
        if (tag === 'place') M.move('a' + v.i, 'b' + v.d + '.' + (d.size[v.d] - 1));
        if (tag === 'collect' && d.size[v.d]) for (let j = 0; j < d.size[v.d]; j++) M.move('b' + v.d + '.' + j, 'a' + (v.k - d.size[v.d] + j));
      });
      const exp = v.exp, pos = exp ? Math.round(Math.log10(exp)) : -1;
      const end = tag === 'after' || ctx.i === ctx.ticks.length - 1;
      const W = 10 * RX, ax = (k) => (W - n * RX) / 2 + k * RX, bx = (b) => b * RX;
      const items = [];
      const hotBin = inPass && ['digit', 'place', 'bin', 'collect'].includes(tag) && v.d !== null && v.d < 10 ? v.d : null;
      const cellOf = (key, x, y, val, cls, sub) => {
        items.push({ key, kind: 'cell', x, y, w: RW, h: RH, text: '', sub: sub === undefined ? '' : sub, cls });
        digitsOf(val, D).forEach((ch, p) => {
          const fromRight = D - 1 - p;
          const lead = String(val).length < D - p;
          const c = fromRight === pos && !end ? 'cur' : lead ? 'lead' : '';
          items.push({ key: key + 'd' + p, kind: 'text', x: x + RW / 2 + (p - (D - 1) / 2) * 11, y: y + RH / 2 + 6, text: ch, cls: 'sb-digit ' + c, anchor: 'middle' });
        });
      };
      // the array row: a slot is empty while its number sits in a bin
      for (let k = 0; k < n; k++) {
        items.push({ key: 'as' + k, kind: 'region', x: ax(k) - 2, y: -2, w: RW + 4, h: RH + 4, cls: 'sb-frame' });
        items.push({ key: 'ai' + k, kind: 'text', x: ax(k) + RW / 2, y: RH + 17, text: String(k), cls: 'idx', anchor: 'middle' });
        const key = M.key('a' + k);
        const inBin = inPass && d.bins && ((tag !== 'collect-start' && tag !== 'bin' && tag !== 'collect') ? k < (d.size || []).reduce((s, x) => s + (x || 0), 0) - (tag === 'place' ? 0 : 0) : k >= (v.k || 0));
        if (!inBin || !inPass) cellOf(key, ax(k), 0, a[k], end ? 'done' : inPass && v.i === k && (tag === 'next' || tag === 'digit') ? 'focus' : '');
      }
      // the bins
      for (let b = 0; b < 10; b++) {
        items.push({ key: 'bin' + b, kind: 'region', x: bx(b) - 4, y: RBY - 26, w: RW + 8, h: 30 + memo.rows * RDY, cls: 'sb-bin' + (b === hotBin ? ' hot' : '') });
        items.push({ key: 'binl' + b, kind: 'text', x: bx(b) + RW / 2, y: RBY - 8, text: String(b), cls: 'sb-label' + (b === hotBin ? ' hot' : ''), anchor: 'middle' });
        const row = inPass && d.bins ? d.bins[b] : [];
        row.forEach((val, j) => {
          if (tag === 'collect' && b === v.d) return;
          if ((tag === 'collect' || tag === 'bin') && b < v.d) return;
          cellOf(M.key('b' + b + '.' + j), bx(b), RBY + 4 + j * RDY, val, tag === 'place' && b === v.d && j === row.length - 1 ? 'hot' : '');
        });
      }
      if (inPass && v.i !== null && v.i < n && ['next', 'digit', 'place'].includes(tag)) items.push({ key: 'ti', kind: 'cursor', at: 'as' + v.i, side: 'above', text: 'i', cls: 'c-teal' });
      if (inPass && v.k !== null && ['collect-start', 'bin', 'collect'].includes(tag)) items.push({ key: 'tk', kind: 'cursor', x: ax(Math.min(v.k, n - 1)) + (v.k >= n ? RX : 0) + RW / 2, y: -4, ty: -30, text: 'k', cls: 'c-violet' });
      const place = ['ones', 'tens', 'hundreds'][pos] || '';
      items.push({ key: 'title', kind: 'text', x: -10, y: -52, text: end ? 'sorted' : exp ? 'pass ' + (pos + 1) + ': the ' + place + ' digit (exp = ' + exp + ')' : 'radix sort', cls: 'sb-title' });

      const x = v.i !== null && v.i < n ? a[v.i] : null;
      let say = '';
      switch (tag) {
        case 'enter': say = 'radix_sort(a, ' + n + '): sort ' + plural(n, 'number') + ' one digit at a time, starting with the last digit.'; break;
        case 'max': say = 'The largest value is ' + maxV + ', which has ' + plural(D, 'digit') + ': that many passes. Shorter numbers count as having leading zeros (shown faint).'; break;
        case 'zero': say = 'Ten empty bins: size[d] counts the numbers in bin d.'; break;
        case 'pass': say = maxV / exp >= 1 ? (exp === 1 ? 'First pass: exp = 1 picks out the ones digit.' : 'Next pass: exp = ' + exp + ' picks out the ' + place + ' digit. The array is already sorted by its last ' + plural(pos, 'digit') + '.') : 'exp = ' + exp + ' is bigger than ' + maxV + ': no digits left. Done.'; break;
        case 'call': say = 'digit_pass(a, ' + n + ', ' + exp + ').'; break;
        case 'next': say = v.i < n ? 'Take a[' + v.i + '] = ' + x + '.' : 'All ' + plural(n, 'number') + ' are in bins. The array is empty for now.'; break;
        case 'digit': say = 'Its ' + place + ' digit: (' + x + ' / ' + exp + ') % 10 = ' + v.d + '.'; break;
        case 'place': say = x + ' drops into bin ' + v.d + ', behind ' + ((d.size[v.d] - 1) ? plural(d.size[v.d] - 1, 'number') + ' already there' : 'nothing') + '.'; break;
        case 'collect-start': say = 'Now empty the bins back into a, starting at a[0], bin 0 first.'; break;
        case 'bin': say = v.d < 10 ? (d.size[v.d] ? 'Bin ' + v.d + ' holds ' + d.bins[v.d].join(', ') + '.' : 'Bin ' + v.d + ' is empty.') : 'All bins are empty again. a is sorted by its last ' + plural(pos + 1, 'digit') + ': ' + a.join(' ') + '.'; break;
        case 'collect': say = d.size[v.d] ? 'They go back in the order they came in: ' + d.bins[v.d].join(', ') + ' to a[' + (v.k - d.size[v.d]) + (d.size[v.d] > 1 ? '..' + (v.k - 1) : '') + '].' : 'Nothing to copy.'; break;
        case 'after': say = 'Sorted: ' + a.join(' ') + '. ' + plural(D, 'pass') .replace('passs', 'passes') + ', ' + plural(ctx.counters.moves, 'drop') + ' into bins, and not a single comparison between numbers.'; break;
      }
      if (!say && ctx.tick.end) say = ctx.tick.fn === 'digit_pass' ? 'This pass is finished.' : 'radix_sort is finished.';
      return { items, say, slow: tag === 'bin' && v.d === 10 };
    },
    predict: [
      {
        at: (t) => t.tag === 'next' && t.data.vars.i === 1 && t.data.vars.exp === 1, once: true,
        ask: (t) => 'Which bin will ' + t.data.a[1] + ' drop into in this pass?',
        options: () => range(0, 9).map(String), answer: (ts, i) => String(ts[i].data.a[1] % 10), pick: 'option',
        explain: (ts, i) => 'This pass looks only at the ones digit: ' + ts[i].data.a[1] + ' % 10 = ' + (ts[i].data.a[1] % 10) + '.',
      },
      {
        at: (t) => t.tag === 'bin' && t.data.vars.d < 10 && t.data.size && t.data.size[t.data.vars.d] > 1, once: true,
        ask: (t) => 'Bin ' + t.data.vars.d + ' holds ' + t.data.bins[t.data.vars.d].join(', ') + '. In what order will they go back into the array?',
        options: () => ['In the order they went in', 'Smallest first', 'Largest first'], answer: () => 'In the order they went in', pick: 'option',
        explain: () => 'A bin is first in, first out. Keeping that order is what makes each pass stable, so the earlier passes are not undone.',
      },
      {
        at: (t, i, ts, ctx) => { const u = ts[i + 1]; return !!u && u.tag === 'pass' && u.data.vars.exp >= 10 && Math.max(...ctx.input.values) / u.data.vars.exp >= 1; }, once: true,
        ask: () => 'A pass has just finished. By how many of their last digits are the numbers sorted now?',
        options: () => ['None', '1', '2', '3'], answer: (ts, i) => String(Math.round(Math.log10(ts[i + 1].data.vars.exp))), pick: 'option',
        explain: (ts, i) => 'Each finished pass adds one sorted digit, from the right. ' + Math.round(Math.log10(ts[i + 1].data.vars.exp)) + ' passes are done.',
      },
    ],
    quiz: [
      { q: 'Why does LSD radix sort start with the last digit, not the first?', options: ['It is faster to compute', 'Later passes decide the order and stable passes keep earlier ties broken correctly', 'The first digit can be zero', 'It does not matter'], answer: 1, why: 'The last pass (the most significant digit) has the final say; for numbers with the same leading digit, the order from earlier passes survives.' },
      { q: 'What goes wrong if a pass is not stable?', options: ['Nothing', 'The order from earlier digits can be scrambled', 'It uses more bins', 'It needs more passes'], answer: 1, why: 'Two numbers with the same current digit must stay in the order the previous passes put them in.' },
      { q: 'How many passes for numbers up to 999 in base 10?', options: ['1', '3', '10', '999'], answer: 1, why: 'One pass per digit: ones, tens, hundreds.' },
      { q: 'With n numbers of d digits, how much work is radix sort?', options: ['n log n', 'd · (n + 10)', 'n²', 'd²'], answer: 1, why: 'Each pass touches every number once and every bin once.' },
      { q: 'Which bin does 802 go into in the tens pass?', options: ['8', '0', '2', '80'], answer: 1, why: '(802 / 10) % 10 = 80 % 10 = 0.' },
    ],
    compareWith: 'counting-sort',
  });

  // ---- bucket sort -----------------------------------------------------------------------------------------
  // Five shelves, one per range of twenty. Values are sorted onto their shelf, each shelf is put in order by
  // insertion sort (the key lifts out, bigger values slide right under it), then the shelves are read off in order.
  const BK = 5, BS = 56, BW = 50, BH = 40, BROW = 90, BY = 130;
  const bucketValues = { id: 'values', kind: 'ints', label: 'The numbers (0 to 99)', def: [56, 12, 94, 35, 70, 42, 7, 88, 29, 61, 23], min: 1, max: 12, check: (v) => (v.some((x) => x < 0 || x > 99) ? 'Bucket sort here takes numbers from 0 to 99' : null) };
  X.topic({
    id: 'bucket-sort', family: 'sort', order: 82, title: 'Bucket sort',
    blurb: 'Spread the values over buckets by range, sort each small bucket on its own, and read the buckets off in order. Fast when the values are spread evenly; slow when they all crowd into one bucket.',
    code: `#define B 5        /* number of buckets */
#define MAXN 12    /* most values one bucket can hold */

/* sort v[0..m-1] by insertion; a bucket is short, so this is quick */
void insertion_sort(int v[], int m)
{
    int i, j, key;
    for (i = 1; i < m; i++) {                          /*@ next */
        key = v[i];                                    /*@ lift */
        for (j = i - 1; j >= 0 && v[j] > key; j--)     /*@ cmp */
            v[j + 1] = v[j];                           /*@ shift */
        v[j + 1] = key;                                /*@ place-key */
    }
}

/* values 0..99: bucket b takes the range 20b to 20b + 19 */
void bucket_sort(int a[], int n)
{
    int bucket[B][MAXN];
    int size[B] = { 0 };                               /*@ zero */
    int i, b, j, k;
    for (i = 0; i < n; i++) {                          /*@ scan */
        b = a[i] * B / 100;                            /*@ which */
        bucket[b][size[b]++] = a[i];                   /*@ move-in */
    }
    for (b = 0; b < B; b++)                            /*@ each */
        insertion_sort(bucket[b], size[b]);            /*@ sort-bucket */
    k = 0;                                             /*@ k0 */
    for (b = 0; b < B; b++)                            /*@ gather */
        for (j = 0; j < size[b]; j++) a[k++] = bucket[b][j];   /*@ concat */
}`,
    animate: ['bucket_sort', 'insertion_sort'],
    inputs: [bucketValues],
    presets: [
      { label: 'Spread out', values: { values: [56, 12, 94, 35, 70, 42, 7, 88, 29, 61, 23] } },
      { label: 'All in one bucket', values: { values: [49, 45, 43, 41, 47, 40, 44] } },
      { label: 'Already sorted', values: { values: [5, 18, 27, 39, 44, 58, 63, 79, 85, 97] } },
      { label: 'Empty buckets', values: { values: [3, 97, 15, 88, 9, 91] } },
      { label: 'Repeats', values: { values: [30, 31, 30, 77, 31, 30] } },
    ],
    counters: ['compares', 'moves'],
    main: (inp) => X.sortMain(inp.values, 'bucket_sort(a, n);'),
    capture(P) {
      const bi = P.frames.findIndex((f) => f.name === 'bucket_sort');
      const n = bi >= 0 ? P.val('n', bi) : P.val('n');
      const out = { a: P.arr('a', n), fn: P.frames[0].name, size: bi >= 0 ? P.arr('size', BK, bi) : null, bins: null };
      out.top = varsOf(P, ['i', 'j', 'b', 'k', 'key', 'm']);
      out.b = bi >= 0 && P.isSet('b', bi) ? P.val('b', bi) : null;
      out.k = bi >= 0 && P.isSet('k', bi) ? P.val('k', bi) : null;
      const bk = bi >= 0 ? P.find('bucket', bi) : null;
      if (bk && out.size) {
        const T = SEE.Types, it = T.unqual(T.unqual(bk.type).of).of;
        out.bins = [];
        for (let b = 0; b < BK; b++) {
          const row = [];
          for (let j = 0; j < (out.size[b] || 0); j++) row.push(P.read(it, bk.addr + (b * 12 + j) * 4));
          out.bins.push(row);
        }
      }
      return out;
    },
    scene(ctx) {
      const d = ctx.tick.data, v = d.top, tag = ctx.tick.tag, a = d.a, memo = ctx.memo, n = a.length;
      const M = mover(memo);
      const inIns = d.fn === 'insertion_sort';
      const cb = d.b;     // the bucket being worked on
      if (ctx.i === 0) for (let k = 0; k < n; k++) M.key('a' + k);
      const shelf = (b, j) => 'b' + b + '.' + j;
      once(ctx, 'bucket', () => {
        if (tag === 'move-in') M.move('a' + v.i, shelf(v.b, d.size[v.b] - 1));
        if (tag === 'lift') { M.move(shelf(cb, v.i), 'key'); memo.hole = v.i; }
        if (tag === 'shift') { M.move(shelf(cb, v.j), shelf(cb, v.j + 1)); memo.hole = v.j; }
        if (tag === 'place-key') { M.move('key', shelf(cb, v.j + 1)); memo.hole = null; }
        if (tag === 'concat' && d.size[cb]) for (let j = 0; j < d.size[cb]; j++) M.move(shelf(cb, j), 'a' + (d.k - d.size[cb] + j));
      });
      const end = tag === 'after' || ctx.i === ctx.ticks.length - 1;
      const items = [];
      // shelves just long enough for the fullest bucket
      if (!memo.shelfLen) { const c = new Array(BK).fill(0); for (const x of ctx.input.values) c[Math.floor(x * BK / 100)]++; memo.shelfLen = Math.max(4, ...c); }
      const W = memo.shelfLen * BS;
      const ax = (k) => k * BS;
      const rowY = (b) => BY + b * BROW;
      memo.sorted = memo.sorted || new Set();
      if (tag === 'sort-bucket' && ctx.prev && ctx.prev.data.fn === 'insertion_sort') memo.sorted.add(ctx.prev.data.b);
      if (inIns && tag !== 'enter') memo.sorting = cb;
      if (!inIns && tag !== 'sort-bucket') memo.sorting = null;
      if (tag === 'each' && cb > 0) memo.sorted.add(cb - 1);
      // the array row
      for (let k = 0; k < n; k++) {
        items.push({ key: 'as' + k, kind: 'region', x: ax(k) - 2, y: -2, w: BW + 4, h: BW + 4, cls: 'sb-frame' });
        items.push({ key: 'ai' + k, kind: 'text', x: ax(k) + BW / 2, y: BW + 17, text: String(k), cls: 'idx', anchor: 'middle' });
        if (M.has('a' + k)) items.push({ key: M.key('a' + k), kind: 'cell', x: ax(k), y: 0, w: BW, h: BW, text: a[k], sub: '', cls: end ? 'done' : tag === 'which' && v.i === k || tag === 'scan' && v.i === k ? 'focus' : '' });
      }
      // the shelves
      const busy = tag === 'which' || tag === 'move-in' ? v.b : inIns || tag === 'sort-bucket' || tag === 'each' || tag === 'gather' || tag === 'concat' ? cb : null;
      for (let b = 0; b < BK; b++) {
        const y = rowY(b);
        const hot = b === busy && !end;
        items.push({ key: 'sh' + b, kind: 'region', x: -112, y: y - 6, w: W + 124, h: BH + 12, cls: 'sb-bin' + (hot ? ' hot' : '') });
        items.push({ key: 'shl' + b, kind: 'text', x: -100, y: y + BH / 2 + 5, text: (20 * b) + '–' + (20 * b + 19), cls: 'sb-label' + (hot ? ' hot' : '') });
        if (memo.sorted.has(b) && d.bins && d.bins[b].length) items.push({ key: 'shok' + b, kind: 'text', x: W + 4, y: y + BH / 2 + 5, text: 'sorted', cls: 'sb-good', anchor: 'end' });
        const row = d.bins ? d.bins[b] : [];
        row.forEach((val, j) => {
          const place = shelf(b, j);
          if (!M.has(place)) return;
          if (inIns && b === cb && memo.hole === j) return;
          const isCmp = inIns && b === cb && tag === 'cmp' && v.j === j;
          items.push({ key: M.key(place), kind: 'cell', x: j * BS, y, w: BW, h: BH, text: val, sub: '', cls: isCmp ? 'hot' : memo.sorted.has(b) ? 'part-a' : '' });
        });
        if (inIns && b === cb && memo.hole !== null && memo.hole !== undefined) items.push({ key: 'hole', kind: 'region', x: memo.hole * BS - 2, y: y - 2, w: BW + 4, h: BH + 4, cls: 'sb-frame' });
      }
      // the lifted key hovers over the hole
      if (inIns && M.has('key') && v.key !== null && memo.hole !== null && memo.hole !== undefined) {
        const y = rowY(cb) - BH - 8;
        items.push({ key: M.key('key'), kind: 'cell', x: memo.hole * BS, y, w: BW, h: BH, text: v.key, sub: '', cls: 'focus' });
        items.push({ key: 'keyl', kind: 'text', x: memo.hole * BS - 8, y: y + BH / 2 + 5, text: 'key', cls: 'sb-hot', anchor: 'end' });
      }
      if (!end && (tag === 'scan' || tag === 'which' || tag === 'move-in') && v.i !== null && v.i < n) items.push({ key: 'ti', kind: 'cursor', at: 'as' + v.i, side: 'above', text: 'i', cls: 'c-teal' });
      if (tag === 'which') items.push({ key: 'wh', kind: 'arrow', from: { key: 'as' + v.i, side: 'bottom' }, to: { key: 'sh' + v.b, side: 'top' }, cls: 'hot' });
      if (!end && (tag === 'k0' || tag === 'gather' || tag === 'concat') && d.k !== null) items.push({ key: 'tk', kind: 'cursor', x: ax(Math.min(d.k, n - 1)) + (d.k >= n ? BS : 0) + BW / 2, y: -4, ty: -30, text: 'k', cls: 'c-violet' });
      const phase = end ? 'sorted' : inIns || tag === 'each' || tag === 'sort-bucket' ? 'step 2: sort each bucket' : tag === 'k0' || tag === 'gather' || tag === 'concat' ? 'step 3: read the buckets off in order' : 'step 1: spread into buckets';
      items.push({ key: 'title', kind: 'text', x: -112, y: -52, text: phase, cls: 'sb-title' });

      const x = v.i !== null && !inIns && v.i < n ? a[v.i] : null;
      const vals = d.bins && cb !== null && cb < BK ? d.bins[cb] : [];
      let say = '';
      switch (tag) {
        case 'enter': say = inIns ? '' : 'bucket_sort(a, ' + n + '): five buckets, one for each range of twenty values.'; break;
        case 'zero': say = 'All five buckets start empty.'; break;
        case 'scan': say = v.i < n ? 'Take a[' + v.i + '] = ' + x + '.' : 'Every value is on its shelf. Inside a shelf they are still in input order.'; break;
        case 'which': say = x + ' × 5 / 100 = ' + v.b + ' (integer division): bucket ' + v.b + ', for ' + (20 * v.b) + ' to ' + (20 * v.b + 19) + '.'; break;
        case 'move-in': say = x + ' joins bucket ' + v.b + (d.size[v.b] > 1 ? ', which now holds ' + d.size[v.b] + ' values.' : '.'); break;
        case 'each': say = cb < BK ? 'Bucket ' + cb + ' holds ' + (vals.length ? vals.join(', ') : 'nothing') + '.' : 'Every bucket is sorted, and every value in bucket b is smaller than every value in bucket b + 1.'; break;
        case 'sort-bucket': say = 'insertion_sort(bucket[' + cb + '], ' + vals.length + ')' + (vals.length < 2 ? ': with ' + (vals.length ? 'one value' : 'no values') + ' there is nothing to do.' : ': sort the ' + vals.length + ' values of this bucket.'); break;
        case 'next': say = inIns ? (v.i < v.m ? 'Insert v[' + v.i + '] into the sorted part v[0..' + (v.i - 1) + '].' : 'This bucket is in order.') : ''; break;
        case 'lift': say = 'Lift ' + v.key + ' out, leaving a gap at v[' + v.i + '].'; break;
        case 'cmp': say = v.j < 0 ? 'j = -1: nothing is left to compare. The key goes to v[0].' : vals[v.j] > v.key ? vals[v.j] + ' > ' + v.key + ': it has to make room.' : vals[v.j] + ' ≤ ' + v.key + ': stop. The key goes just after it, into the gap.'; break;
        case 'shift': say = vals[v.j] + ' slides one place right, into the gap. The gap moves left.'; break;
        case 'place-key': say = v.key + ' drops into the gap at v[' + (v.j + 1) + '].'; break;
        case 'k0': say = 'Now read the buckets off, bucket 0 first, into a[0], a[1], ...'; break;
        case 'gather': say = cb < BK ? (vals.length ? 'Bucket ' + cb + ': ' + vals.join(', ') + '.' : 'Bucket ' + cb + ' is empty.') : 'All buckets are read off.'; break;
        case 'concat': say = vals.length ? vals.join(', ') + ' go' + (vals.length === 1 ? 'es' : '') + ' to a[' + (d.k - vals.length) + (vals.length > 1 ? '..' + (d.k - 1) : '') + '], in order.' : 'Nothing to copy.'; break;
        case 'after': say = 'Sorted: ' + a.join(' ') + '. ' + plural(ctx.counters.compares, 'comparison') + ', all of them inside buckets.'; break;
      }
      if (!say && ctx.tick.end) say = ctx.tick.fn === 'insertion_sort' ? 'Bucket ' + cb + ' is sorted.' : 'bucket_sort is finished.';
      if (!say && tag === 'enter') say = 'insertion_sort starts on bucket ' + cb + '.';
      return { items, say, slow: tag === 'place-key' };
    },
    predict: [
      {
        at: (t) => t.tag === 'scan' && t.data.top.i === 1, once: true,
        ask: (t) => 'Which bucket will a[1] = ' + t.data.a[1] + ' go into?',
        options: () => ['0–19', '20–39', '40–59', '60–79', '80–99'], answer: (ts, i) => ['0–19', '20–39', '40–59', '60–79', '80–99'][Math.floor(ts[i].data.a[1] * 5 / 100)], pick: 'option',
        explain: (ts, i) => ts[i].data.a[1] + ' × 5 / 100 = ' + Math.floor(ts[i].data.a[1] * 5 / 100) + '.',
      },
      {
        at: (t) => t.tag === 'each' && t.data.b === 0, once: true,
        ask: () => 'Which bucket will cost insertion sort the most work?',
        options: () => ['0–19', '20–39', '40–59', '60–79', '80–99'],
        answer: (ts, i) => { const s = ts[i].data.size; return ['0–19', '20–39', '40–59', '60–79', '80–99'][s.indexOf(Math.max(...s))]; }, pick: 'option',
        explain: () => 'The fullest one: insertion sort can take up to m² / 2 steps for m values, so one crowded bucket costs more than several small ones.',
      },
      {
        at: (t, i, ts) => { const u = ts[i + 1]; return t.tag === 'lift' && !!u && u.tag === 'cmp' && u.data.top.j >= 0 && u.data.bins[u.data.b][u.data.top.j] > u.data.top.key; }, once: true,
        ask: (t, ts, i) => { const u = ts[i + 1]; return 'The key ' + u.data.top.key + ' is lifted out. Its left neighbour ' + u.data.bins[u.data.b][u.data.top.j] + ' is bigger. What happens next?'; },
        options: () => ['It slides one place right', 'The key is placed now', 'They swap'], answer: () => 'It slides one place right', pick: 'option',
        explain: () => 'Bigger values move right one at a time to open a gap for the key.',
      },
    ],
    quiz: [
      { q: 'When is bucket sort fast?', options: ['When values are spread evenly over the range', 'When all values are equal', 'When the array is reversed', 'Always'], answer: 0, why: 'Then each bucket holds only a few values and sorting them costs almost nothing: about n steps in total.' },
      { q: 'What happens if every value lands in the same bucket?', options: ['It is still linear', 'It becomes plain insertion sort: up to n² steps', 'It crashes', 'It sorts nothing'], answer: 1, why: 'One bucket holding everything means sorting the whole array with insertion sort.' },
      { q: 'Why can the buckets simply be read off one after another?', options: ['They are the same size', 'Every value in a bucket is smaller than every value in the next bucket', 'Insertion sort merges them', 'Buckets are sorted by size'], answer: 1, why: 'The ranges do not overlap and are in increasing order.' },
      { q: 'Which bucket does 60 go into with five buckets for 0 to 99?', options: ['2', '3', '4', '1'], answer: 1, why: '60 × 5 / 100 = 3, the range 60–79.' },
      { q: 'How is bucket sort different from radix sort?', options: ['It does not use buckets', 'It splits by value range once and sorts inside buckets; radix makes one stable pass per digit', 'It needs no extra memory', 'It is a comparison-free sort'], answer: 1, why: 'Radix sort never compares values; bucket sort compares them inside each bucket.' },
    ],
    compareWith: 'radix-sort',
  });
})(SEE);
