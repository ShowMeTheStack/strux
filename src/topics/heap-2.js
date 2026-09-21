// Binary heaps: Floyd's bottom-up build, changing a priority, and the k largest with a min-heap.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, HP = X.HeapPic;
  const plural = HP.plural;
  const valuesCheck = (label) => (v) => (v.some((x) => x < 1 || x > 99) ? label + ': from 1 to 99, so they fit in the circles' : null);

  // sift down in a min-heap: shared by pq-change and heap-kth
  const SIFT_DOWN_MIN = `/* min-heap: move the key at i down while a child is smaller */
void sift_down(struct heap *h, int i)
{
    int c;
    while (2 * i + 1 < h->size) {                        /*@ test-down */
        c = 2 * i + 1;                                   /*@ left */
        if (c + 1 < h->size && h->a[c + 1] < h->a[c])    /*@ compare-kids */
            c++;                                         /*@ right */
        if (h->a[i] <= h->a[c])                          /*@ compare-down */
            break;                                       /*@ stop */
        swap(&h->a[i], &h->a[c]);                        /*@ swap-down */
        i = c;                                           /*@ down */
    }
}`;
  /** Narration for the min-heap sift down (the same lines in two topics) */
  const sayDown = (tag, a, size, i, c) => {
    switch (tag) {
      case 'test-down': return 2 * i + 1 < size ? 'a[' + i + '] = ' + a[i] + ' has a child (2·' + i + '+1 = ' + (2 * i + 1) + ' < size ' + size + '): it may have to sink.' : 'a[' + i + '] has no child (2·' + i + '+1 = ' + (2 * i + 1) + ' ≥ size ' + size + '): it is a leaf, so it stops.';
      case 'left': return 'c = 2·' + i + '+1 = ' + c + ', the left child (' + a[c] + ').' + (c + 1 < size ? ' The right child is ' + a[c + 1] + '.' : ' There is no right child.');
      case 'compare-kids': return c + 1 < size ? 'Which child is smaller? ' + (a[c + 1] < a[c] ? a[c + 1] + ' < ' + a[c] + ': the right one.' : a[c] + ' < ' + a[c + 1] + ': the left one.') + ' Only the smaller child may become the parent of the other.' : 'Only one child, so c stays at ' + c + '.';
      case 'right': return 'c = ' + c + ': the right child, ' + a[c] + ', is the smaller.';
      case 'compare-down': return 'Is ' + a[i] + ' ≤ its smaller child ' + a[c] + '? ' + (a[i] <= a[c] ? 'Yes: it has found its level.' : 'No: the rule is broken, so they swap.');
      case 'stop': return 'break: ' + a[i] + ' stays at a[' + i + '].';
      case 'swap-down': return a[i] + ' comes up and ' + a[c] + ' sinks: a[' + i + '] ↔ a[' + c + '].';
      case 'down': return 'i = c = ' + i + ': follow ' + a[i] + ' down.';
    }
    return null;
  };
  const cmpDown = (tag, a, size, i, c) => {
    if (tag === 'compare-kids' && c !== null && c + 1 < size) return { a: c, b: c + 1, text: a[c + 1] < a[c] ? a[c + 1] + ' < ' + a[c] + ': right' : a[c] + ' < ' + a[c + 1] + ': left' };
    if (tag === 'compare-down' && c !== null) return { a: i, b: c, text: a[i] <= a[c] ? a[i] + ' ≤ ' + a[c] + ': stop' : a[i] + ' > ' + a[c] + ': swap', cls: a[i] <= a[c] ? 'hp-good' : 'hp-badt' };
    return null;
  };
  const DOWN_TAGS = ['test-down', 'left', 'compare-kids', 'right', 'compare-down', 'stop', 'swap-down', 'down'];

  // ---- build a heap bottom-up (Floyd) ----------------------------------------------------------------------
  X.topic({
    id: 'heap-build', family: 'heap', order: 30, title: 'Build a heap bottom-up',
    blurb: 'Leaves are heaps already. Walk back from the last parent to the root and let each key sink into the two heaps below it: the whole array becomes a heap in linear time.',
    code: `/* let the key at i sink until it is no smaller than its children */
void sift_down(struct heap *h, int i)
{
    int l, r, big;
    for (;;) {                                           /*@ loop */
        l = 2 * i + 1;  r = 2 * i + 2;                   /*@ kids */
        big = i;                                         /*@ assume */
        if (l < h->size && h->a[l] > h->a[big])          /*@ compare-left */
            big = l;                                     /*@ left-bigger */
        if (r < h->size && h->a[r] > h->a[big])          /*@ compare-right */
            big = r;                                     /*@ right-bigger */
        if (big == i)                                    /*@ settled */
            return;                                      /*@ done */
        swap(&h->a[i], &h->a[big]);                      /*@ swap */
        i = big;                                         /*@ down */
    }
}

/* Floyd: turn any array into a max-heap, from the last parent back to the root */
void build_heap(struct heap *h)
{
    int i;
    for (i = h->size / 2 - 1; i >= 0; i--)               /*@ next */
        sift_down(h, i);                                 /*@ fix */
}`,
    animate: ['build_heap'], quiet: ['swap'],
    inputs: [{ id: 'values', kind: 'ints', label: 'The array, in this order', def: [12, 35, 7, 41, 20, 9, 60, 3, 50, 28], min: 1, max: 12, distinct: true, check: valuesCheck('The array') }],
    presets: [
      { label: 'Mixed', values: { values: [12, 35, 7, 41, 20, 9, 60, 3, 50, 28] } },
      { label: 'Increasing (worst for inserts)', values: { values: [10, 20, 30, 40, 50, 60, 70, 80, 90] } },
      { label: 'Already a heap', values: { values: [90, 70, 80, 30, 60, 50, 20] } },
      { label: 'Two keys', values: { values: [4, 9] } },
    ],
    counters: ['compares', 'swaps'],
    main: (inp) => `int main(void)
{
    /* your keys, in the order you gave them: not a heap yet */
    struct heap heap = { { ${inp.values.join(', ')} }, ${inp.values.length} };
    build_heap(&heap);
    return 0;
}`,
    capture: HP.capture(['i', 'l', 'r', 'big'], (P) => ({ bi: P.frames[0].name === 'sift_down' && P.isSet('i', 1) ? P.val('i', 1) : null })),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, v = d.v, memo = ctx.memo;
      const n = d.size, a = d.a;
      const inSift = d.fn === 'sift_down';
      if (memo.doneFrom === undefined) memo.doneFrom = n >> 1;
      if (tag === 'next' && v.i !== null) memo.doneFrom = v.i + 1;
      if (tag === 'after') memo.doneFrom = 0;
      const root = inSift ? d.bi : tag === 'fix' ? v.i : null;
      const sub = root !== null ? HP.subtree(root, n) : new Set();
      const i = inSift ? v.i : null, l = inSift ? v.l : null, r = inSift ? v.r : null, big = inSift ? v.big : null;
      const green = (k) => k >= memo.doneFrom && !sub.has(k);
      let cmp = null;
      if (tag === 'compare-left' && l < n) cmp = { a: l, b: big, text: a[l] > a[big] ? a[l] + ' > ' + a[big] + ': left is bigger' : a[l] + ' < ' + a[big] };
      if (tag === 'compare-right' && r < n) cmp = { a: r, b: big, text: a[r] > a[big] ? a[r] + ' > ' + a[big] + ': right is bigger' : a[r] + ' < ' + a[big] };
      const pic = HP.picture(ctx, {
        n, a, size: n, isMin: false,
        cls: (k) => (inSift && k === i ? 'hot' : inSift && k === big && big !== i && !['kids', 'assume'].includes(tag) ? 'focus' : tag === 'after' ? 'part-a' : green(k) ? 'part-a' : ''),
        edgeCls: (p, c) => (tag === 'after' || (green(p) && green(c)) ? 'hp-done' : ''),
        marks: inSift ? { i: [i, 'c-teal'], l: [['kids', 'assume', 'compare-left', 'left-bigger'].includes(tag) && l < n ? l : null, 'c-gray'], r: [['kids', 'assume', 'compare-left', 'left-bigger', 'compare-right', 'right-bigger'].includes(tag) && r < n ? r : null, 'c-gray'], big: [['assume', 'compare-left', 'left-bigger', 'compare-right', 'right-bigger', 'settled', 'swap'].includes(tag) ? big : null, 'c-rose'] } : tag === 'next' || tag === 'fix' ? { i: [v.i, 'c-teal'] } : {},
        cmp,
        rel: tag === 'kids' && l < n ? { from: i, to: l, label: '2·' + i + '+1 = ' + l } : null,
      });
      const items = pic.items;
      if (root !== null && root >= 0) items.unshift(...HP.subRegion(pic, root, n, 'hsub', 'sift_down(h, ' + root + ')'));
      items.push({ key: 'hrule', kind: 'text', x: -110, y: -96, text: 'green: already a max-heap', cls: 'hp-rule' });
      const leaves = n - (n >> 1);
      if (tag === 'settled') memo.settledKey = a[i];
      let say = '';
      const lastPar = (n >> 1) - 1;
      switch (tag) {
        case 'enter': say = 'build_heap: ' + n + ' keys in the order you gave them, not a heap yet (red edges break the rule). Instead of inserting them one by one, repair the tree from the bottom up.'; break;
        case 'next':
          if (v.i === lastPar) say = 'i = size/2 - 1 = ' + v.i + ': the last node that has a child. a[' + (n >> 1) + '..' + (n - 1) + '] are leaves: ' + leaves + ' heaps of one key each, so they need no work at all.';
          else if (v.i >= 0) say = 'The subtree under a[' + (v.i + 1) + '] is a heap now. i = ' + v.i + ': the next parent back, a[' + v.i + '] = ' + a[v.i] + '.';
          else say = 'i = -1: the last subtree fixed was the root\'s, which is the whole array. Done.';
          break;
        case 'fix': say = 'sift_down(h, ' + v.i + '): both subtrees under a[' + v.i + '] = ' + a[v.i] + ' are heaps already, so only this one key can be out of place. It sinks until it fits.'; break;
        case 'kids': say = 'l = 2·' + i + '+1 = ' + l + ', r = 2·' + i + '+2 = ' + r + '.' + (l >= n ? ' Both are past the end: a[' + i + '] is a leaf.' : r >= n ? ' Only the left child exists.' : ''); break;
        case 'assume': say = 'big = i: start by assuming ' + a[i] + ' is the largest of the three.'; break;
        case 'compare-left': say = l < n ? 'Is the left child a[' + l + '] = ' + a[l] + ' bigger than a[big] = ' + a[big] + '? ' + (a[l] > a[big] ? 'Yes.' : 'No.') : 'There is no left child (l = ' + l + ' ≥ size).'; break;
        case 'left-bigger': say = 'big = l = ' + big + '.'; break;
        case 'compare-right': say = r < n ? 'Is the right child a[' + r + '] = ' + a[r] + ' bigger than a[big] = ' + a[big] + '? ' + (a[r] > a[big] ? 'Yes.' : 'No.') : 'There is no right child (r = ' + r + ' ≥ size).'; break;
        case 'right-bigger': say = 'big = r = ' + big + '.'; break;
        case 'settled': say = big === i ? 'big is still i: ' + a[i] + ' is at least as big as its children. This subtree is a heap.' : 'big = ' + big + ': the child ' + a[big] + ' must come up above ' + a[i] + '.'; break;
        case 'done': say = 'return: ' + memo.settledKey + ' has found its level.'; break;
        case 'loop': say = 'The loop has no test: it repeats until the key fits, and then return ends it.'; break;
        case 'swap': say = a[i] + ' rises and ' + a[big] + ' sinks one level: a[' + i + '] ↔ a[' + big + '].'; break;
        case 'down': say = 'i = ' + i + ': ' + a[i] + ' keeps sinking, now into the subtree below a[' + i + '].'; break;
        case 'after': say = 'A max-heap: ' + HP.list(a, n) + '. ' + plural(ctx.counters.swaps, 'swap') + ' and ' + plural(ctx.counters.compares, 'comparison') + '. Half the keys never move and most of the rest sink only a level or two: the whole build is O(n), where n inserts can cost O(n log n).'; break;
      }
      return { items, say, slow: tag === 'swap' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'enter' && ts[i + 1] && ts[i + 1].tag === 'next' && t.data.size > 1, once: true, ask: 'Floyd\'s method starts with the last node that has a child. Click it in the tree.', answer: (ts, i) => 'hv' + ts[i].data.a[(ts[i].data.size >> 1) - 1], explain: (ts, i) => 'a[size/2 - 1] = a[' + ((ts[i].data.size >> 1) - 1) + ']. Everything after it is a leaf.' },
      { at: (t) => t.tag === 'assume' && (2 * t.data.v.i + 1 < t.data.size), once: true, ask: (t) => 'Which of a[' + t.data.v.i + '] and its children is the largest?', options: (ts, i) => { const d = ts[i].data, k = d.v.i; return [k, 2 * k + 1, 2 * k + 2].filter((x) => x < d.size).map((x) => String(d.a[x])); }, answer: (ts, i) => { const d = ts[i].data, k = d.v.i; return String(Math.max(...[k, 2 * k + 1, 2 * k + 2].filter((x) => x < d.size).map((x) => d.a[x]))); }, pick: 'option', explain: () => 'The largest of the three goes on top; if it is a child, the parent sinks into its place.' },
    ],
    quiz: [
      { q: 'Why does Floyd\'s build start at index size/2 - 1?', options: ['It is the middle of the array', 'Every node after it is a leaf, and a leaf is already a heap', 'It is the smallest key', 'To save a comparison'], answer: 1, why: 'Children of i are at 2i+1; for i ≥ size/2 that is past the end, so those nodes have no children.' },
      { q: 'Why go from the back to the front, and not from the root down?', options: ['It does not matter', 'sift_down needs both subtrees below to be heaps already', 'The root is fixed last by luck', 'C arrays are read backwards'], answer: 1, why: 'Sinking one key only works if everything under it is a heap; working backwards makes sure of that.' },
      { q: 'How long does Floyd\'s build take for n keys?', options: ['O(n log n)', 'O(n)', 'O(n²)', 'O(log n)'], answer: 1, why: 'Half the nodes do nothing, a quarter sink at most 1 level, an eighth at most 2... The sum stays below n.' },
      { q: 'Inserting n keys one at a time into an empty heap costs, in the worst case...', options: ['O(n), the same', 'O(n log n): each key may climb the whole height', 'O(1) each', 'O(n²)'], answer: 1, why: 'With increasing keys every insert rises to the root, about log n swaps each. Compare the two topics side by side.' },
    ],
    compareWith: 'heap-insert',
  });

  // ---- priority queue: change a key ------------------------------------------------------------------------
  X.topic({
    id: 'pq-change', family: 'heap', order: 40, title: 'Priority queue: change a priority',
    blurb: 'In a min-heap the most urgent entry is at a[0]. Make an entry more urgent and it can only rise; make it less urgent and it can only sink.',
    code: `/* min-heap: move the key at i up while it is smaller than its parent */
void sift_up(struct heap *h, int i)
{
    while (i > 0 && h->a[(i - 1) / 2] > h->a[i]) {      /*@ compare-up */
        swap(&h->a[(i - 1) / 2], &h->a[i]);             /*@ swap-up */
        i = (i - 1) / 2;                                 /*@ up */
    }
}

${SIFT_DOWN_MIN}

/* give the entry at i a new priority, then put the heap right */
void change_key(struct heap *h, int i, int key)
{
    int old = h->a[i];                                   /*@ old */
    h->a[i] = key;                                       /*@ write */
    if (key < old)                                       /*@ which-way */
        sift_up(h, i);                                   /*@ go-up */
    else
        sift_down(h, i);                                 /*@ go-down */
}`,
    animate: ['change_key'], quiet: ['swap'],
    inputs: [
      { id: 'start', kind: 'ints', label: 'Priorities (a min-heap is built from them)', def: [2, 6, 4, 10, 8, 5, 9, 14, 12, 11], min: 1, max: 12, distinct: true, check: valuesCheck('Priorities') },
      { id: 'at', kind: 'int', label: 'Change the entry at index', def: 8, lo: 0, hi: 11 },
      { id: 'key', kind: 'int', label: 'New priority', def: 1, lo: 1, hi: 99 },
    ],
    check: (inp) => {
      if (inp.at >= inp.start.length) return 'Index: from 0 to ' + (inp.start.length - 1) + ', a slot inside the heap';
      const h = HP.build(inp.start, true);
      if (h.some((x, k) => x === inp.key && k !== inp.at)) return 'New priority: ' + inp.key + ' is already used by another entry; pick another so each one can be followed';
      return null;
    },
    presets: [
      { label: 'More urgent: rises to the top', values: { start: [2, 6, 4, 10, 8, 5, 9, 14, 12, 11], at: 8, key: 1 } },
      { label: 'Less urgent: sinks', values: { start: [2, 6, 4, 10, 8, 5, 9, 14, 12, 11], at: 1, key: 13 } },
      { label: 'Small change: stays', values: { start: [2, 6, 4, 10, 8, 5, 9, 14, 12, 11], at: 4, key: 7 } },
      { label: 'The front entry waits', values: { start: [2, 6, 4, 10, 8, 5, 9, 14, 12, 11], at: 0, key: 15 } },
    ],
    counters: ['compares', 'swaps'],
    main: (inp) => `int main(void)
{
${HP.decl(HP.build(inp.start, true), 'a min-heap: the smallest number is the most urgent')}
    change_key(&heap, ${inp.at}, ${inp.key});
    return 0;
}`,
    capture: HP.capture(['i', 'c', 'old', 'key']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, v = d.v, memo = ctx.memo, inp = ctx.input;
      const n = d.size, a = d.a;
      memo.alias = memo.alias || {};
      if (memo.oldVal === undefined) memo.oldVal = ctx.ticks[0].data.a[inp.at];
      if (tag === 'write') memo.alias[inp.key] = memo.oldVal;
      const idOf = (x) => (memo.alias[x] !== undefined ? memo.alias[x] : x);
      const old = memo.oldVal, key = inp.key;
      const at = a.findIndex((x, k) => k < n && idOf(x) === old);
      const changed = ctx.i > 0 && ctx.ticks.slice(0, ctx.i + 1).some((t) => t.tag === 'write');
      const fn = d.fn;
      const i = fn === 'change_key' ? inp.at : v.i, c = v.c;
      const sinking = fn === 'sift_down' && DOWN_TAGS.includes(tag);
      let cmp = null;
      if (fn === 'sift_up' && tag === 'compare-up' && i > 0) { const p = (i - 1) >> 1; cmp = { a: i, b: p, text: a[p] > a[i] ? a[i] + ' < ' + a[p] + ': swap' : a[i] + ' ≥ ' + a[p] + ': stop', cls: a[p] > a[i] ? 'hp-badt' : 'hp-good' }; }
      if (sinking) cmp = cmpDown(tag, a, n, i, c);
      const kids = sinking && ['left', 'compare-kids', 'right'].includes(tag) ? [2 * i + 1, 2 * i + 2].filter((k) => k < n) : [];
      const pic = HP.picture(ctx, {
        n, a, size: n, isMin: true, idOf,
        cls: (k) => (k === at && changed ? 'hot' : k === at ? 'focus' : kids.includes(k) ? 'focus' : tag === 'after' && k === 0 ? 'part-a' : ''),
        marks: fn === 'change_key' && tag !== 'after' ? { i: [inp.at, 'c-teal'] } : fn === 'sift_up' ? { i: [i, 'c-teal'] } : fn === 'sift_down' ? { i: [i, 'c-teal'], c: [['left', 'compare-kids', 'right', 'compare-down', 'stop', 'swap-down'].includes(tag) ? c : null, 'c-amber'] } : {},
        cmp,
      });
      const items = pic.items;
      // the changed entry carries a tag with its old and new priority and the way it must go
      if (at >= 0 && changed) {
        const p = pic.pos.get(at);
        const dir = tag === 'write' ? '' : key < old ? '↑' : key > old ? '↓' : '=';
        items.push({ key: 'hwas', kind: 'text', x: p.x, y: p.y + HP.R + 22, text: old + '→' + key + ' ' + dir, cls: 'hp-hot', anchor: 'middle' });
      }
      items.push({ key: 'hrule', kind: 'text', x: -110, y: -96, text: 'min-heap: every parent ≤ its children', cls: 'hp-rule' });
      items.push({ key: 'hfront', kind: 'text', x: pic.pos.get(0).x - HP.R - 14, y: 5, text: 'served next', cls: 'hp-title', anchor: 'end' });
      let say = sayDown(tag, a, n, i, c) || '';
      if (!sinking) switch (tag) {
        case 'enter': say = 'change_key(heap, ' + inp.at + ', ' + key + '): the entry at a[' + inp.at + '] has priority ' + a[inp.at] + ' (smaller means more urgent). It is about to get priority ' + key + '.'; break;
        case 'old': say = 'old = ' + old + ': remember the old priority, to know which way the entry may have to move.'; break;
        case 'write': say = 'a[' + inp.at + '] = ' + key + '. Everything else is still in heap order; only the edges touching this one entry can be wrong now.'; break;
        case 'which-way': say = key < old ? key + ' < ' + old + ': the entry became more urgent. Its children were ≥ ' + old + ', so they are ≥ ' + key + ' too: the only edge that can break is the one to its parent. It may rise.' : key + ' ≥ ' + old + ': the entry became less urgent. Its parent was ≤ ' + old + ', so it is ≤ ' + key + ' too: only the edges to its children can break. It may sink.'; break;
        case 'go-up': say = 'sift_up(h, ' + inp.at + '): rise past any parent with a bigger number.'; break;
        case 'go-down': say = 'sift_down(h, ' + inp.at + '): sink below any child with a smaller number.'; break;
        case 'compare-up': say = i === 0 ? key + ' is at the root: it is now the first to be served.' : 'Is the parent a[' + ((i - 1) >> 1) + '] = ' + a[(i - 1) >> 1] + ' bigger than ' + a[i] + '? ' + (a[(i - 1) >> 1] > a[i] ? 'Yes: swap.' : 'No: the entry has found its place.'); break;
        case 'swap-up': say = a[(i - 1) >> 1] + ' rises to a[' + ((i - 1) >> 1) + '] and ' + a[i] + ' drops to a[' + i + ']. ' + a[i] + ' was smaller than its other children already, so nothing below breaks.'; break;
        case 'up': say = 'i = ' + i + ': follow ' + a[i] + ' up.'; break;
        case 'after': say = 'The heap is right again: ' + HP.list(a, n) + '. The entry with priority ' + key + ' now sits at a[' + at + ']' + (at === 0 ? ', at the front of the queue.' : '.') + ' Next served: ' + a[0] + '. The change cost at most one trip along one path: O(log n).'; break;
        default: if (ctx.tick.end) say = ctx.tick.fn === 'change_key' ? 'change_key() returns to main: one entry changed, one path repaired.' : ctx.tick.fn + '() returns to change_key().';
      }
      return { items, say, slow: tag === 'swap-up' || tag === 'swap-down' || tag === 'write' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'write' && ts[i + 1] && ts[i + 1].tag === 'which-way', once: true, ask: 'Which way can the changed entry have to move?', options: () => ['Up only', 'Down only', 'Either way'], answer: (ts, i, ctx) => (ctx.input.key < ts[0].data.a[ctx.input.at] ? 'Up only' : 'Down only'), pick: 'option', explain: () => 'A smaller key can only be too small for its parent; a bigger key can only be too big for its children.' },
      { at: (t) => t.tag === 'old', once: true, ask: 'Where will the entry end up? Click the tree node that is in that place now.', answer: (ts, i, ctx) => { const last = ts[ts.length - 1].data; const fin = last.a.indexOf(ctx.input.key); const v = ts[i].data.a[fin]; return 'hv' + v; }, explain: (ts, i, ctx) => 'It ends at a[' + ts[ts.length - 1].data.a.indexOf(ctx.input.key) + '].' },
    ],
    quiz: [
      { q: 'In a min-heap, a key at a[5] is decreased. Which edges can now break the heap rule?', options: ['Only the edge to its parent', 'Only the edges to its children', 'Any edge in the tree', 'None'], answer: 0, why: 'Its children were bigger than the old key, so they are bigger than the new one too. Only its parent may now be bigger than it.' },
      { q: 'Why does change_key compare key with old before choosing sift_up or sift_down?', options: ['To save memory', 'The direction of the change decides the only direction the entry can move', 'sift_up only works on the root', 'It must always do both'], answer: 1, why: 'Smaller can only rise, bigger can only sink; the other repair would find nothing to do.' },
      { q: 'How long does changing one priority take in a heap of n entries?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], answer: 1, why: 'The entry moves along one path, up or down, of at most log₂ n levels.' },
      { q: 'Dijkstra\'s algorithm keeps distances in a priority queue. Which operation does it use when it finds a shorter path?', options: ['Increase a key', 'Decrease a key, so the vertex rises', 'Extract and reinsert everything', 'Build a new heap'], answer: 1, why: 'A shorter distance is a smaller key in a min-heap: decrease-key, which sifts up.' },
    ],
  });

  // ---- the k largest with a min-heap -----------------------------------------------------------------------
  X.topic({
    id: 'heap-kth', family: 'heap', order: 50, title: 'The k largest (a min-heap of size k)',
    blurb: 'To keep the k largest values of a stream, keep a min-heap of k: its root is the weakest of them, the one to beat. Anything smaller is thrown away at once.',
    code: `/* min-heap: add key at the end and let it rise */
void heap_push(struct heap *h, int key)
{
    int i = h->size++;
    h->a[i] = key;
    while (i > 0 && h->a[(i - 1) / 2] > h->a[i]) {
        swap(&h->a[(i - 1) / 2], &h->a[i]);
        i = (i - 1) / 2;
    }
}

${SIFT_DOWN_MIN}

/* keep the k largest of a[0..n-1] in h; the smallest of them sits at the root */
void k_largest(const int a[], int n, int k, struct heap *h)
{
    int j;
    for (j = 0; j < n; j++) {                            /*@ next */
        if (h->size < k)                                 /*@ room */
            heap_push(h, a[j]);                          /*@ push */
        else if (a[j] > h->a[0]) {                       /*@ compare-root */
            h->a[0] = a[j];                              /*@ replace */
            sift_down(h, 0);                             /*@ sink */
        }
    }
}`,
    animate: ['k_largest'], quiet: ['swap', 'heap_push'],
    inputs: [
      { id: 'values', kind: 'ints', label: 'The stream of values', def: [7, 42, 15, 3, 88, 23, 61, 9, 50], min: 1, max: 12, distinct: true, check: valuesCheck('The stream') },
      { id: 'k', kind: 'int', label: 'k', def: 3, lo: 1, hi: 5 },
    ],
    check: (inp) => (inp.k > inp.values.length ? 'k: at most the number of values' : null),
    presets: [
      { label: 'Mixed stream', values: { values: [7, 42, 15, 3, 88, 23, 61, 9, 50], k: 3 } },
      { label: 'Increasing: every value gets in', values: { values: [5, 12, 19, 26, 33, 40, 47, 54], k: 3 } },
      { label: 'Decreasing: the first k win', values: { values: [90, 80, 70, 60, 50, 40, 30, 20], k: 3 } },
      { label: 'k = 1: the maximum', values: { values: [31, 8, 77, 45, 12, 60], k: 1 } },
    ],
    counters: ['compares', 'swaps'],
    main: (inp) => `int main(void)
{
    int values[] = { ${inp.values.join(', ')} };
    struct heap heap = { { 0 }, 0 };    /* an empty min-heap */
    k_largest(values, ${inp.values.length}, ${inp.k}, &heap);
    return 0;
}`,
    capture: HP.capture(['i', 'c'], (P) => ({ j: P.isSet('j') ? P.val('j') : null })),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, v = d.v, memo = ctx.memo, inp = ctx.input;
      const vals = inp.values, K = inp.k, a = d.a, size = d.size;
      const j = d.j;
      memo.fate = memo.fate || {};
      const where = (x) => vals.indexOf(x);
      if (tag === 'push') memo.fate[j] = 'in';
      if (tag === 'compare-root' && !(vals[j] > a[0])) memo.fate[j] = 'skip';
      if (tag === 'replace') { memo.fate[j] = 'in'; if (memo.root !== undefined) memo.fate[where(memo.root)] = 'out'; }
      if (size) memo.root = a[0];
      const fn = d.fn, sinking = fn === 'sift_down' && DOWN_TAGS.includes(tag);
      const i = v.i, c = v.c;
      // the stream on top, the heap of k centred under it
      const sw = vals.length * HP.DX;
      const hx = Math.max(0, (sw - K * HP.DX) / 2);
      const sy = -190;
      const streamPos = (q) => ({ x: q * HP.DX + HP.CELL / 2, y: sy + HP.CELL / 2 });
      const kids = sinking && ['left', 'compare-kids', 'right'].includes(tag) ? [2 * i + 1, 2 * i + 2].filter((k) => k < size) : [];
      const pic = HP.picture(ctx, {
        n: K, a, size, isMin: true, x0: hx, arrLabel: 'h->a[]',
        from: (id) => streamPos(where(id)),
        cls: (k) => (sinking && k === i ? 'hot' : kids.includes(k) ? 'focus' : k === 0 && (tag === 'compare-root' || tag === 'replace') ? 'focus' : tag === 'after' ? 'part-a' : ''),
        marks: sinking ? { i: [i, 'c-teal'], c: [['left', 'compare-kids', 'right', 'compare-down', 'stop', 'swap-down'].includes(tag) ? c : null, 'c-amber'] } : {},
        cmp: sinking ? cmpDown(tag, a, size, i, c) : null,
      });
      const items = pic.items;
      for (const it of items) if (it.kind === 'vertex') it.exit = 'fall';
      vals.forEach((x, q) => {
        const f = memo.fate[q];
        items.push({ key: 'sv' + q, kind: 'cell', x: q * HP.DX, y: sy, w: HP.CELL, h: HP.CELL, text: String(x), sub: String(q), cls: (q === j && fn === 'k_largest' && tag !== 'after' ? 'focus ' : '') + (f === 'in' ? 'part-a' : f === 'skip' || f === 'out' ? 'hp-stale' : '') });
        if (f === 'skip' || f === 'out') items.push({ key: 'sx' + q, kind: 'text', x: q * HP.DX + HP.CELL / 2, y: sy - 10, text: f === 'skip' ? 'skip' : 'out', cls: 'hp-idx', anchor: 'middle' });
      });
      items.push({ key: 'sl', kind: 'text', x: -12, y: sy + HP.CELL / 2 + 5, text: 'a[]', cls: 'hp-code', anchor: 'end' });
      if (j !== null && j < vals.length && fn === 'k_largest' && tag !== 'after') items.push({ key: 'mj', kind: 'cursor', at: 'sv' + j, side: 'above', text: 'j', cls: 'c-violet' });
      // the gatekeeper: the root, compared with each newcomer once the heap is full
      if (size) {
        const r0 = pic.pos.get(0);
        items.push({ key: 'hgate', kind: 'text', x: r0.x - HP.R - 14, y: r0.y + 5, text: 'smallest kept', cls: 'hp-title', anchor: 'end' });
        if (tag === 'compare-root') {
          const sp = streamPos(j);
          const win = vals[j] > a[0];
          items.push({ key: 'hcmp', kind: 'line', x1: sp.x, y1: sp.y + HP.CELL / 2 + 4, x2: r0.x, y2: r0.y - HP.R, cls: 'hp-cmp' });
          items.push({ key: 'hcmpT', kind: 'text', x: r0.x + HP.R + 30, y: r0.y - 30, text: vals[j] + (win ? ' > ' : ' ≤ ') + a[0] + (win ? ': it gets in' : ': skip it'), cls: win ? 'hp-good' : 'hp-badt' });
        }
      }
      items.push({ key: 'hrule', kind: 'text', x: -40, y: sy - 50, text: 'keep the ' + K + ' largest in a min-heap of ' + K, cls: 'hp-rule' });
      const kept = a.slice(0, size).slice().sort((x, y) => y - x);
      let say = sayDown(tag, a, size, i, c) || '';
      if (!sinking) switch (tag) {
        case 'enter': say = 'k_largest(a, ' + vals.length + ', ' + K + ', heap): find the ' + K + ' largest values in one pass, holding only ' + K + ' at a time. They are kept in a min-heap, so the weakest of them is always at the root, ready to be pushed out.'; break;
        case 'next': say = j < vals.length ? 'j = ' + j + ': the next value is ' + vals[j] + '.' : 'j = ' + j + ': every value has been seen.'; break;
        case 'room': say = size < K ? 'The heap holds ' + size + ' of ' + K + ': there is room, so ' + vals[j] + ' goes in whatever its value.' : 'The heap is full (' + K + ' of ' + K + '): ' + vals[j] + ' has to beat the root to get in.'; break;
        case 'push': say = 'heap_push adds ' + vals[j] + ' at the end and lets it rise, as in insert but for a min-heap: smaller keys go up. The root is now ' + a[0] + '.'; break;
        case 'compare-root': say = 'Is ' + vals[j] + ' > the root ' + a[0] + '? ' + (vals[j] > a[0] ? 'Yes: it beats the weakest of the ' + K + ' kept, so it belongs among the ' + K + ' largest seen so far.' : 'No: it is not bigger than the smallest kept value, so it cannot be among the ' + K + ' largest. It is skipped after one comparison.'); break;
        case 'replace': say = 'a[0] = ' + vals[j] + ': ' + memo.prevRoot + ' is pushed out for good, and ' + vals[j] + ' takes the root\'s place.'; break;
        case 'sink': say = 'sift_down(h, 0): ' + a[0] + ' may be bigger than a child; it sinks so that the root is again the smallest kept value.'; break;
        case 'after': say = 'The ' + K + ' largest: ' + kept.join(', ') + '. The root, ' + a[0] + ', is the ' + K + (K === 1 ? 'st' : K === 2 ? 'nd' : K === 3 ? 'rd' : 'th') + ' largest. Each value cost at most one comparison plus log ' + K + ' work: O(n log k), with only ' + K + ' values in memory.'; break;
        default: if (ctx.tick.end) say = ctx.tick.fn === 'k_largest' ? 'k_largest() returns: the heap holds the answer.' : 'sift_down() returns: the root is the smallest kept value again. Back to the stream.';
      }
      if (size) memo.prevRoot = a[0];
      return { items, say, slow: tag === 'replace' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'room' && ts[i + 1] && ts[i + 1].tag === 'compare-root', once: true, ask: (t, ts, i, ctx) => 'Will ' + ctx.input.values[t.data.j] + ' get into the heap?', options: () => ['Yes', 'No'], answer: (ts, i, ctx) => (ctx.input.values[ts[i].data.j] > ts[i].data.a[0] ? 'Yes' : 'No'), pick: 'option', explain: (ts, i) => 'Only if it is bigger than the root, ' + ts[i].data.a[0] + ', the smallest value kept.' },
      { at: (t, i, ts) => t.tag === 'compare-root' && ts[i + 1] && ts[i + 1].tag === 'replace', once: true, ask: 'The newcomer gets in. Which kept value has to leave? Click it.', answer: (ts, i) => 'hv' + ts[i].data.a[0], explain: (ts, i) => 'The root, ' + ts[i].data.a[0] + ': the smallest of the kept values is the one that is no longer among the k largest.' },
      { at: (t, i, ts, ctx) => t.tag === 'next' && t.data.j === ctx.input.values.length && t.data.size > 1, once: true, ask: 'Every value has been seen. Click the k-th largest value.', answer: (ts, i) => 'hv' + ts[i].data.a[0], explain: () => 'The root: it is the smallest of the k largest.' },
    ],
    quiz: [
      { q: 'Why a min-heap for the k largest values?', options: ['It is faster to build', 'Its root is the smallest kept value, the one a newcomer must beat and the one to throw out', 'Max-heaps cannot hold k values', 'To sort the stream'], answer: 1, why: 'Every decision is about the weakest of the k kept, and the min-heap keeps that one at a[0].' },
      { q: 'When the heap is full and a value is not bigger than the root, what does it cost?', options: ['log k swaps', 'One comparison', 'k comparisons', 'A rebuild'], answer: 1, why: 'One look at a[0] is enough to throw it away.' },
      { q: 'After the whole stream, what is at the root?', options: ['The largest value', 'The k-th largest value', 'The smallest value of the stream', 'The last value read'], answer: 1, why: 'It is the smallest of the k largest: exactly the k-th largest.' },
      { q: 'How much memory does this need for a stream of a million values and k = 10?', options: ['A million ints', 'About 10 ints for the heap', 'Half a million', 'log of a million'], answer: 1, why: 'Only the heap of k values is kept; each value is looked at once and either kept or dropped.' },
    ],
  });
})(SEE);
