// Binary heaps: the family, a drawing shared by its topics, insert and extract.
// A heap is drawn twice at once: as the tree it stands for (index i has children 2i+1 and 2i+2) and
// as the array it really is. Every value keeps one key in both pictures, so a swap moves the two
// values past each other along a tree edge and across the array at the same moment.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, T = X.TreeKit;
  const HP = X.HeapPic = {};
  HP.DX = 58; HP.DY = 82; HP.R = 22; HP.CELL = 52;

  X.family({
    id: 'heap', order: 1, group: 'Heaps and tries', title: 'Binary heaps',
    blurb: 'A complete binary tree kept in a plain array: the children of a[i] are a[2i+1] and a[2i+2]. Every parent beats its children, so the best key is always at a[0].',
    head: `#include <stdio.h>

#define CAP 16

/* a heap: the keys in a[0..size-1]; the children of a[i] are a[2i+1] and a[2i+2] */
struct heap {
    int a[CAP];
    int size;
};

/* exchange two ints through their addresses */
void swap(int *x, int *y)
{
    int t = *x;
    *x = *y;
    *y = t;
}`,
  });

  /** A heap made by inserting values one at a time (what main starts from) */
  HP.build = function (values, isMin) {
    const a = [];
    for (const v of values) {
      a.push(v);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (isMin ? a[p] <= a[i] : a[p] >= a[i]) break;
        [a[p], a[i]] = [a[i], a[p]];
        i = p;
      }
    }
    return a;
  };
  /** The C for main's heap: an initialised struct (the zeroes after size are never read) */
  HP.decl = (a, what) => `    /* ${what} */
    struct heap heap = { { ${a.length ? a.join(', ') : '0'} }, ${a.length} };`;

  /** Capture: the heap struct in main, the current function and some of its variables */
  HP.capture = (vars, more) => (P) => {
    const v = P.find('heap');
    const f = v ? P.fields(v.type, v.addr) : { a: [], size: 0 };
    const o = { a: f.a, size: f.size, fn: P.frames[0].name, v: {} };
    for (const n of vars) o.v[n] = P.has(n, 0) && P.isSet(n, 0) ? P.val(n, 0) : null;
    if (more) Object.assign(o, more(P));
    return o;
  };

  /** The largest size the heap has during the whole run: the tree is laid out for that many slots */
  HP.span = function (ctx) {
    if (ctx.memo.span) return ctx.memo.span;
    let n = 1;
    for (const t of ctx.ticks) if (t.data && t.data.size > n) n = t.data.size;
    ctx.memo.span = n;
    return n;
  };

  /** True when a[p] and its child a[c] break the heap rule */
  HP.broken = (a, p, c, isMin) => (isMin ? a[p] > a[c] : a[p] < a[c]);

  /**
   * The tree and the array together. o: {n: slots laid out, a, size, isMin, x0, y0,
   *   idOf(v) -> stable id of a value, cls(k, v) -> classes for slot k, extra: a slot past size to show
   *   as part of the heap, stale: show old values left past size, from(id) -> {x, y} for a value that
   *   arrives from outside, marks: {name: [slot, cls]}, cmp: {a, b, text, cls}, rel: {from, to, label},
   *   edgeCls(p, c) -> classes, next: draw the free slot at index size as a dashed place}
   */
  HP.picture = function (ctx, o) {
    const memo = ctx.memo;
    const n = o.n, a = o.a, size = o.size;
    const x0 = o.x0 || 0, y0 = o.y0 || 0;
    const pos = T.fromArray(new Array(n), { dx: HP.DX, dy: HP.DY, x0: x0 + HP.CELL / 2, y0 });
    let depth = 0;
    for (const p of pos.values()) depth = Math.max(depth, p.depth);
    const ay = y0 + depth * HP.DY + 96;
    const cellX = (k) => x0 + k * HP.DX;
    const idOf = o.idOf || ((v) => v);
    memo.used = memo.used || new Set();
    const live = (k) => k < size || k === o.extra;
    for (let k = 0; k < n; k++) if (live(k)) memo.used.add(k);
    // which slots hold a value that belongs to the heap; a value seen twice (a copy left behind) is
    // drawn once, at its lower index, and the other place is an old copy
    const owner = new Map();
    const kind = [];
    for (let k = 0; k < n; k++) {
      const v = a[k];
      if (live(k) && v !== null && v !== undefined) {
        const id = idOf(v);
        if (owner.has(id)) kind[k] = 'stale'; else { owner.set(id, k); kind[k] = 'el'; }
      } else kind[k] = memo.used.has(k) && o.stale ? 'old' : 'free';
    }
    const prevIdx = memo['hpIdx' + (o.id || '')] || {};
    const nowIdx = {};
    const items = [];
    const keyOf = (k) => (kind[k] === 'el' ? 'hv' + idOf(a[k]) : 'hsv' + k);
    const cellKey = (k) => (kind[k] === 'el' ? 'hc' + idOf(a[k]) : 'hs' + k);
    // edges: drawn between slots, so values slide along them
    for (let c = 1; c < n; c++) {
      const p = (c - 1) >> 1;
      if (kind[c] === 'free' || kind[c] === 'old' || kind[p] === 'free' || kind[p] === 'old') continue;
      const P0 = pos.get(p), C0 = pos.get(c);
      const dx = C0.x - P0.x, dy = C0.y - P0.y, len = Math.hypot(dx, dy);
      const bad = kind[c] === 'el' && kind[p] === 'el' && HP.broken(a, p, c, o.isMin);
      const extra = o.edgeCls ? o.edgeCls(p, c) : '';
      items.push({ key: 'he' + c, kind: 'line', x1: P0.x + dx / len * HP.R, y1: P0.y + dy / len * HP.R, x2: C0.x - dx / len * HP.R, y2: C0.y - dy / len * HP.R, cls: kind[c] === 'stale' ? 'hp-ghost' : bad ? 'hp-bad' : extra || 'hp-edge' });
    }
    if (o.next && size < n && kind[size] === 'free') {
      const p = pos.get(size);
      items.push({ key: 'hnext', kind: 'ring', x: p.x, y: p.y, r: HP.R });
    }
    for (let k = 0; k < n; k++) {
      const p = pos.get(k);
      const v = a[k];
      const cls = o.cls ? o.cls(k, v) || '' : '';
      if (kind[k] === 'el') {
        const id = idOf(v);
        nowIdx[id] = k;
        const was = prevIdx[id];
        const moved = was !== undefined && was !== k;
        const from = was === undefined && o.from ? o.from(id) : null;
        items.push({ key: 'hv' + id, kind: 'vertex', x: p.x, y: p.y, r: HP.R, text: String(v), cls, arc: moved ? (k < was ? 26 : -26) : 0, enter: from ? 'fly' : 'grow', from, exit: 'fade', pick: true, flash: moved });
        items.push({ key: 'hc' + id, kind: 'cell', x: cellX(k), y: ay, w: HP.CELL, h: HP.CELL, text: String(v), sub: String(k), cls, arc: moved ? (k < was ? 46 : -46) : 0, enter: from ? 'fly' : 'grow', from: from ? { x: from.x - HP.CELL / 2, y: from.y - HP.CELL / 2 } : null, exit: 'fade', pick: true, flash: moved });
        items.push({ key: 'hti' + k, kind: 'text', x: p.x + HP.R + 2, y: p.y - HP.R + 4, text: String(k), cls: 'hp-idx' });
      } else if (kind[k] === 'stale') {
        items.push({ key: 'hsv' + k, kind: 'vertex', x: p.x, y: p.y, r: HP.R, text: String(v), cls: 'hp-stale' });
        items.push({ key: 'hs' + k, kind: 'cell', x: cellX(k), y: ay, w: HP.CELL, h: HP.CELL, text: String(v), sub: String(k), cls: 'hp-stale' });
      } else {
        items.push({ key: 'hs' + k, kind: 'cell', x: cellX(k), y: ay, w: HP.CELL, h: HP.CELL, text: kind[k] === 'old' ? String(v) : '', sub: String(k), cls: kind[k] === 'old' ? 'hp-stale' : 'hp-free', pick: true });
      }
    }
    memo['hpIdx' + (o.id || '')] = nowIdx;
    // size: a divider in the array between the heap and the free slots
    const dx = cellX(size) - 3;
    items.push({ key: 'hdiv', kind: 'line', x1: dx, y1: ay - 10, x2: dx, y2: ay + HP.CELL + 10, cls: 'hp-div' });
    items.push({ key: 'hsize', kind: 'text', x: dx, y: ay - 16, text: 'size = ' + size, cls: 'hp-size', anchor: 'middle' });
    items.push({ key: 'harr', kind: 'text', x: x0 - 12, y: ay + HP.CELL / 2 + 5, text: o.arrLabel || 'a[]', cls: 'hp-code', anchor: 'end' });
    // index cursors under the array and beside the tree node
    const slots = new Map();
    for (const [name, m] of Object.entries(o.marks || {})) {
      const k = m[0];
      if (k === null || k === undefined || k < 0 || k >= n) continue;
      const s = slots.get(k) || 0;
      slots.set(k, s + 1);
      items.push({ key: 'hm' + name, kind: 'cursor', at: cellKey(k), side: 'below', slot: s, text: name, cls: m[1] });
      if (kind[k] === 'el' || kind[k] === 'stale') items.push({ key: 'hmt' + name, kind: 'cursor', at: keyOf(k), side: 'left', slot: s, text: name, cls: m[1] });
    }
    // a comparison: a dotted line between the two values, with what it found
    if (o.cmp && kind[o.cmp.a] && kind[o.cmp.b] && kind[o.cmp.a] !== 'free' && kind[o.cmp.b] !== 'free') {
      const A = pos.get(o.cmp.a), B = pos.get(o.cmp.b);
      items.push({ key: 'hcmp', kind: 'line', x1: A.x, y1: A.y, x2: B.x, y2: B.y, cls: 'hp-cmp' });
      // the verdict: always in the same place, above the root, so it never covers a node
      items.push({ key: 'hcmpT', kind: 'text', x: pos.get(0).x, y: y0 - 58, text: o.cmp.text, cls: o.cmp.cls || 'hp-hot', anchor: 'middle', size: 16 });
    }
    // parent and child in the array: a curved arrow from one cell to the other, with the arithmetic
    if (o.rel && kind[o.rel.from] !== 'free' && kind[o.rel.to] !== 'free' && o.rel.from !== o.rel.to) {
      const leftToRight = o.rel.to > o.rel.from;
      items.push({ key: 'hrel', kind: 'arrow', from: { key: cellKey(o.rel.from), side: 'top' }, to: { key: cellKey(o.rel.to), side: 'top' }, bend: leftToRight ? -34 : 34, cls: 'hp-rel', label: o.rel.label || '' });
    }
    return { items, pos, ay, cellX, kind, keyOf, cellKey, depth };
  };

  /** Classes for the slots on the path from slot k up to the root */
  HP.pathUp = (k) => { const s = new Set(); while (k > 0) { k = (k - 1) >> 1; s.add(k); } return s; };
  /** The slots in the subtree under k */
  HP.subtree = (k, n) => { const s = new Set(); const st = [k]; while (st.length) { const x = st.pop(); if (x >= n) continue; s.add(x); st.push(2 * x + 1, 2 * x + 2); } return s; };
  /** A shaded box behind the subtree under k */
  HP.subRegion = (pic, k, size, key, text) => {
    const sub = HP.subtree(k, size);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of sub) { const p = pic.pos.get(s); if (!p) continue; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    if (x0 === Infinity) return [];
    return [{ key, kind: 'region', x: x0 - 34, y: y0 - 44, w: x1 - x0 + 68, h: y1 - y0 + 78, cls: 'hp-sub', text: text || '' }];
  };
  HP.list = (a, size) => a.slice(0, size).join(' ');
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  HP.plural = plural;

  const valuesCheck = (label) => (v) => (v.some((x) => x < 1 || x > 99) ? label + ': from 1 to 99, so they fit in the circles' : null);

  // ---- insert ----------------------------------------------------------------------------------------------
  X.topic({
    id: 'heap-insert', family: 'heap', order: 10, title: 'Insert (sift up)',
    blurb: 'The new key takes the first free slot, the next leaf, and then rises: it swaps with its parent for as long as it is bigger.',
    code: `/* add key to a max-heap: it joins at the end, then rises past smaller parents */
void heap_insert(struct heap *h, int key)
{
    int i, p;
    if (h->size == CAP)                      /*@ full */
        return;                              /*@ no-room */
    i = h->size;                             /*@ slot */
    h->a[i] = key;                           /*@ store */
    h->size++;                               /*@ grow */
    while (i > 0) {                          /*@ test */
        p = (i - 1) / 2;                     /*@ parent */
        if (h->a[p] >= h->a[i])              /*@ compare */
            break;                           /*@ stop */
        swap(&h->a[p], &h->a[i]);            /*@ swap */
        i = p;                               /*@ up */
    }
}`,
    animate: ['heap_insert'], quiet: ['swap'],
    inputs: [
      { id: 'start', kind: 'ints', label: 'Heap already holds (inserted in this order)', def: [50, 30, 40, 10, 20, 35], min: 0, max: 11, distinct: true, check: valuesCheck('Heap') },
      { id: 'values', kind: 'ints', label: 'Insert', def: [45], min: 1, max: 8, distinct: true, check: valuesCheck('Insert') },
    ],
    check: (inp) => {
      if (inp.start.length + inp.values.length > 12) return 'At most 12 keys in all, so the tree stays readable';
      if (inp.values.some((v) => inp.start.includes(v))) return 'Each key only once: one of the keys to insert is already in the heap';
      return null;
    },
    presets: [
      { label: 'Rises part way', values: { start: [50, 30, 40, 10, 20, 35], values: [45] } },
      { label: 'Rises to the root', values: { start: [50, 30, 40, 10, 20, 35], values: [99] } },
      { label: 'Stays at the leaf', values: { start: [50, 30, 40, 10, 20, 35], values: [5] } },
      { label: 'Empty heap, sorted keys', values: { start: [], values: [10, 20, 30, 40, 50, 60, 70] } },
    ],
    counters: ['compares', 'swaps'],
    main: (inp) => `int main(void)
{
${HP.decl(HP.build(inp.start, false), 'a max-heap holding your keys')}
${inp.values.map((v) => '    heap_insert(&heap, ' + v + ');').join('\n')}
    return 0;
}`,
    capture: HP.capture(['i', 'p', 'key']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, v = d.v, memo = ctx.memo;
      const n = HP.span(ctx);
      const a = d.a;
      const key = v.key !== null ? v.key : memo.lastKey;
      if (v.key !== null) memo.lastKey = v.key;
      // which call this is, and its swaps so far
      if (tag === 'full') { memo.calls = (memo.calls || 0) + 1; memo.swaps = 0; }
      if (tag === 'swap') memo.swaps = (memo.swaps || 0) + 1;
      const i = v.i, p = v.p;
      const inCall = d.fn === 'heap_insert' && tag !== 'after';
      const placed = inCall && i !== null && ['store', 'grow', 'test', 'parent', 'compare', 'stop', 'swap', 'up'].includes(tag);
      const path = placed ? HP.pathUp(i) : new Set();
      const keyPos = { x: -70, y: 0 };
      const cmp = tag === 'compare' && i !== null && p !== null ? { a: i, b: p, text: a[i] + (a[p] >= a[i] ? ' ≤ ' : ' > ') + a[p] + (a[p] >= a[i] ? ': stop' : ': swap'), cls: a[p] >= a[i] ? 'hp-good' : 'hp-badt' } : null;
      const pic = HP.picture(ctx, {
        n, a, size: d.size, isMin: false, extra: tag === 'store' ? i : undefined, next: inCall && ['enter', 'full', 'slot'].includes(tag),
        from: () => keyPos,
        cls: (k) => (placed && k === i ? 'hot' : placed && k === p && ['parent', 'compare', 'stop'].includes(tag) ? 'focus' : placed && path.has(k) ? 'part-b' : tag === 'after' ? 'part-a' : ''),
        edgeCls: (pp, c) => (placed && (c === i || path.has(c)) && path.has(pp) ? 'hp-path' : ''),
        marks: inCall ? { i: [i, 'c-teal'], p: [['parent', 'compare', 'stop', 'swap'].includes(tag) ? p : null, 'c-violet'] } : {},
        cmp,
        rel: tag === 'parent' && i !== null && p !== null ? { from: i, to: p, label: '(' + i + '-1)/2 = ' + p } : null,
      });
      const items = pic.items;
      // the key waiting to go in
      if (inCall && ['enter', 'full', 'slot', 'no-room'].includes(tag)) {
        items.push({ key: 'hv' + key, kind: 'vertex', x: keyPos.x, y: keyPos.y, r: HP.R, text: String(key), cls: 'hot', enter: 'drop' });
        items.push({ key: 'hkeyT', kind: 'text', x: keyPos.x, y: keyPos.y + HP.R + 18, text: 'key', cls: 'hp-code', anchor: 'middle' });
      }
      items.push({ key: 'hrule', kind: 'text', x: -110, y: -96, text: 'max-heap: every parent ≥ its children', cls: 'hp-rule' });
      let say = '';
      const lv = (k) => Math.floor(Math.log2(k + 1));
      switch (tag) {
        case 'enter': say = 'heap_insert(heap, ' + key + '). In a max-heap every parent is at least as big as its children. The new key joins at the end of the array, then rises to its level.'; break;
        case 'full': say = (memo.calls > 1 ? 'Next: heap_insert(heap, ' + key + '). ' : '') + 'size is ' + d.size + ' of ' + 16 + ', so there is room.'; break;
        case 'no-room': say = 'The array is full: the key is not added.'; break;
        case 'slot': say = 'i = size = ' + i + '. Slot ' + i + ' is the next leaf: the bottom row fills from left to right, so the tree stays complete.' + (i > 0 ? ' Its parent is a[(' + i + '-1)/2] = a[' + ((i - 1) >> 1) + '].' : ' It is the root, because the heap was empty.'); break;
        case 'store': say = 'a[' + i + '] = ' + key + '. The shape is right, but ' + key + ' may be bigger than its parent.'; break;
        case 'grow': say = 'size becomes ' + d.size + '. Only the edges on the path from slot ' + i + ' up to the root (shaded) can be wrong now.'; break;
        case 'test': say = i > 0 ? 'i = ' + i + ' is not the root, so there is a parent to look at.' : key + ' has reached the root, a[0]: there is nothing above it.'; break;
        case 'parent': say = 'p = (' + i + ' - 1) / 2 = ' + p + ': the parent of a[' + i + '] is a[' + p + '] = ' + a[p] + '. No pointers: the arithmetic finds it.'; break;
        case 'compare': say = 'Is the parent a[' + p + '] = ' + a[p] + ' ≥ ' + a[i] + '? ' + (a[p] >= a[i] ? 'Yes: the rule holds on this edge, and above it, so ' + a[i] + ' stops here.' : 'No: the edge breaks the rule (red), so the two swap.'); break;
        case 'stop': say = 'break: ' + a[i] + ' stays at a[' + i + '], level ' + lv(i) + '.'; break;
        case 'swap': say = a[p] + ' and ' + a[i] + ' change places, in the tree and in the array at the same time (a[' + p + '] ↔ a[' + i + ']). ' + a[i] + ' moved down, and it is bigger than anything below it, so nothing below breaks.'; break;
        case 'up': say = 'i = p = ' + i + ': follow ' + a[i] + ' up one level.'; break;
        case 'after': say = 'The heap: ' + HP.list(a, d.size) + '. The insert took ' + plural(memo.swaps || 0, 'swap') + '; it can never take more than the height of the tree, about log₂ n.'; break;
      }
      return { items, say, slow: tag === 'swap' };
    },
    predict: [
      { at: (t) => t.tag === 'slot' || (t.tag === 'full' && t.data.size < 16), once: true, ask: 'Where will the new key go first? Click the slot in the array.', answer: (ts, i) => 'hs' + ts[i].data.size, explain: (ts, i) => 'At a[size] = a[' + ts[i].data.size + ']: the first free slot, which is the next leaf of the tree.' },
      { at: (t, i, ts) => t.tag === 'parent' && ts[i + 1] && ts[i + 1].tag === 'compare', once: true, ask: (t) => 'Will ' + t.data.a[t.data.v.i] + ' swap with its parent ' + t.data.a[t.data.v.p] + '?', options: () => ['Yes, swap', 'No, stop here'], answer: (ts, i) => { const d = ts[i].data; return d.a[d.v.p] >= d.a[d.v.i] ? 'No, stop here' : 'Yes, swap'; }, pick: 'option', explain: () => 'In a max-heap the key rises only while it is bigger than its parent.' },
      { at: (t) => t.tag === 'grow', once: true, ask: 'How many swaps will this insert make?', options: () => ['0', '1', '2', '3', '4'], answer: (ts, i) => { let k = 0; for (let j = i; j < ts.length && ts[j].tag !== 'after'; j++) if (ts[j].tag === 'swap') k++; return String(k); }, pick: 'option', explain: () => 'One swap per level the key climbs; it stops at the first parent that is bigger, or at the root.' },
    ],
    quiz: [
      { q: 'In the array, where are the children of a[4]?', options: ['a[5] and a[6]', 'a[8] and a[9]', 'a[9] and a[10]', 'a[2] and a[3]'], answer: 2, why: 'Children of a[i] are a[2i+1] and a[2i+2]: 2·4+1 = 9 and 2·4+2 = 10.' },
      { q: 'Why does the new key go into a[size] and not somewhere else?', options: ['It is the smallest', 'It keeps the tree complete: the next leaf, left to right', 'It is faster to compare there', 'Any free slot would do'], answer: 1, why: 'The array has no gaps, so the tree is always complete; the only place that keeps it so is the next leaf.' },
      { q: 'How many swaps can one insert make in a heap of 1000 keys?', options: ['About 1000', 'About 500', 'About 10', 'Always 1'], answer: 2, why: 'At most one per level, and a complete tree of 1000 nodes has about log₂ 1000 ≈ 10 levels.' },
      { q: 'While the key rises, which edges can break the heap rule?', options: ['Any edge', 'Only the edges on the path from the new leaf to the root', 'Only edges to leaves', 'None'], answer: 1, why: 'Everything else was a heap before; only the new key is out of place, and it moves along one path.' },
      { q: 'Inserting 10, 20, 30, 40 one at a time into an empty max-heap: what happens each time?', options: ['No swaps at all', 'Each new key rises all the way to the root', 'Each key stays at its leaf', 'The heap overflows'], answer: 1, why: 'Each key is bigger than everything before it, so it climbs to a[0]: the worst case for inserts.' },
    ],
  });

  // ---- extract the maximum ---------------------------------------------------------------------------------
  X.topic({
    id: 'heap-extract', family: 'heap', order: 20, title: 'Extract the maximum (sift down)',
    blurb: 'The root leaves. The last key jumps into the hole at the top, and then sinks, always swapping with the larger of its two children.',
    code: `/* remove and return the largest key; the heap must not be empty */
int extract_max(struct heap *h)
{
    int top = h->a[0];                               /*@ top */
    int i = 0;                                       /*@ start */
    int c;
    h->a[0] = h->a[h->size - 1];                     /*@ move-last */
    h->size--;                                       /*@ shrink */
    while (2 * i + 1 < h->size) {                    /*@ test */
        c = 2 * i + 1;                               /*@ left */
        if (c + 1 < h->size && h->a[c + 1] > h->a[c])    /*@ compare-kids */
            c++;                                     /*@ right */
        if (h->a[i] >= h->a[c])                      /*@ compare */
            break;                                   /*@ stop */
        swap(&h->a[i], &h->a[c]);                    /*@ swap */
        i = c;                                       /*@ down */
    }
    return top;                                      /*@ return */
}`,
    animate: ['extract_max'], quiet: ['swap'],
    inputs: [
      { id: 'start', kind: 'ints', label: 'Heap holds (inserted in this order)', def: [90, 70, 80, 30, 60, 50, 20, 10, 25], min: 1, max: 12, distinct: true, check: valuesCheck('Heap') },
      { id: 'times', kind: 'int', label: 'Extract how many times', def: 1, lo: 1, hi: 3 },
    ],
    check: (inp) => (inp.times > inp.start.length ? 'Cannot extract more keys than the heap holds' : null),
    presets: [
      { label: 'Sinks to a leaf', values: { start: [90, 70, 80, 30, 60, 50, 20, 10, 25], times: 1 } },
      { label: 'Stops early', values: { start: [90, 60, 85, 50, 55, 40, 30, 48], times: 1 } },
      { label: 'Three in a row', values: { start: [90, 70, 80, 30, 60, 50, 20, 10, 25], times: 3 } },
      { label: 'One key', values: { start: [42], times: 1 } },
    ],
    counters: ['compares', 'swaps'],
    main: (inp) => `int main(void)
{
${HP.decl(HP.build(inp.start, false), 'a max-heap holding your keys')}
${'    printf("%d\\n", extract_max(&heap));\n'.repeat(inp.times)}    return 0;
}`,
    capture: HP.capture(['top', 'i', 'c']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, v = d.v, memo = ctx.memo;
      const n = HP.span(ctx);
      const a = d.a, size = d.size;
      memo.out = memo.out || [];
      if (tag === 'top' && !memo.out.includes(v.top)) memo.out.push(v.top);
      if (tag === 'top') memo.top = v.top;
      if (tag === 'top') { memo.swaps = 0; memo.round = (memo.round || 0) + 1; }
      if (tag === 'swap') memo.swaps++;
      const inCall = d.fn === 'extract_max' && tag !== 'after';
      const i = inCall ? v.i : null, c = inCall ? v.c : null;
      const sinking = inCall && ['move-last', 'shrink', 'test', 'left', 'compare-kids', 'right', 'compare', 'stop', 'swap', 'down'].includes(tag);
      const kids = sinking && ['left', 'compare-kids', 'right'].includes(tag) && i !== null ? [2 * i + 1, 2 * i + 2].filter((k) => k < size) : [];
      let cmp = null;
      if (tag === 'compare-kids' && c !== null) cmp = c + 1 < size ? { a: c, b: c + 1, text: a[c + 1] > a[c] ? a[c + 1] + ' > ' + a[c] + ': right is larger' : a[c] + ' > ' + a[c + 1] + ': left is larger' } : null;
      if (tag === 'compare' && c !== null) cmp = { a: i, b: c, text: a[i] >= a[c] ? a[i] + ' ≥ ' + a[c] + ': stop' : a[i] + ' < ' + a[c] + ': swap', cls: a[i] >= a[c] ? 'hp-good' : 'hp-badt' };
      // removed keys wait in a tray on the right, in the order they came out
      const trayX = n * HP.DX + 70;
      const pic = HP.picture(ctx, {
        n, a, size, isMin: false, stale: true,
        cls: (k) => (sinking && k === i ? 'hot' : kids.includes(k) || (sinking && k === c && ['compare', 'stop'].includes(tag)) ? 'focus' : tag === 'top' && k === 0 ? 'hot' : ''),
        marks: inCall && i !== null ? { i: [i, 'c-teal'], c: [['left', 'compare-kids', 'right', 'compare', 'stop', 'swap'].includes(tag) ? c : null, 'c-amber'] } : {},
        cmp,
        rel: tag === 'left' && c !== null ? { from: i, to: c, label: '2·' + i + '+1 = ' + c } : null,
      });
      const items = pic.items;
      const inHeap = new Set();
      for (let k = 0; k < size; k++) inHeap.add(a[k]);
      items.push({ key: 'htray', kind: 'text', x: trayX, y: -50, text: 'removed', cls: 'hp-title', anchor: 'middle' });
      memo.out.forEach((x, k) => {
        if (inHeap.has(x)) return;
        items.push({ key: 'hv' + x, kind: 'vertex', x: trayX, y: k * 62, r: HP.R, text: String(x), cls: 'hp-out', sub: k === memo.out.length - 1 && inCall ? 'top' : '' });
      });
      items.push({ key: 'hrule', kind: 'text', x: -110, y: -96, text: 'max-heap: every parent ≥ its children', cls: 'hp-rule' });
      let say = '';
      const last = size;   // after shrink, the slot that was cut off
      switch (tag) {
        case 'enter': say = 'extract_max(heap): the largest key is always at the root, a[0]. Taking it out leaves a hole at the top that must be filled.'; break;
        case 'top': say = (memo.round > 1 ? 'Again: ' : '') + 'top = a[0] = ' + v.top + ', the largest key. It is saved, to be returned at the end.'; break;
        case 'start': say = 'i = 0: the hole is at the root.'; break;
        case 'move-last': say = 'a[0] = a[' + (size - 1) + ']: the last key, ' + a[0] + ', jumps to the root. The last slot is the only one that can be given up without leaving a gap in the tree. ' + v.top + ' is gone from the heap.'; break;
        case 'shrink': say = 'size becomes ' + size + '. a[' + last + '] still holds an old copy of ' + a[last] + ', but it is past size, so it is no longer part of the heap.' + (size > 1 ? ' Now ' + a[0] + ' is almost certainly too small for the root.' : ''); break;
        case 'test': say = 2 * i + 1 < size ? 'a[' + i + '] = ' + a[i] + ' has a child (2·' + i + '+1 = ' + (2 * i + 1) + ' < ' + size + '), so it may need to sink.' : 'a[' + i + '] has no children (2·' + i + '+1 = ' + (2 * i + 1) + ' ≥ size): it is a leaf, and the loop ends.'; break;
        case 'left': say = 'c = 2·' + i + '+1 = ' + c + ': start with the left child, ' + a[c] + '.' + (c + 1 < size ? ' The right child is a[' + (c + 1) + '] = ' + a[c + 1] + '.' : ' There is no right child.'); break;
        case 'compare-kids': say = c + 1 < size ? 'Which child is larger? ' + (a[c + 1] > a[c] ? a[c + 1] + ' > ' + a[c] + ': the right one.' : a[c] + ' > ' + a[c + 1] + ': the left one.') + ' Only the larger child can safely become the parent of the other.' : 'There is only a left child, so c stays at ' + c + '.'; break;
        case 'right': say = 'c = ' + c + ': the right child, ' + a[c] + ', is the larger.'; break;
        case 'compare': say = 'Is ' + a[i] + ' ≥ its larger child ' + a[c] + '? ' + (a[i] >= a[c] ? 'Yes: ' + a[i] + ' has found its level.' : 'No: the rule is broken, so they swap.'); break;
        case 'stop': say = 'break: ' + a[i] + ' stays at a[' + i + '].'; break;
        case 'swap': say = a[i] + ' moves up and ' + a[c] + ' sinks: a[' + i + '] ↔ a[' + c + '] in the array and in the tree. ' + a[i] + ' was the larger child, so it is bigger than its old sibling too.'; break;
        case 'down': say = 'i = c = ' + i + ': follow ' + a[i] + ' down.'; break;
        case 'return': say = 'return ' + memo.top + ' after ' + plural(memo.swaps, 'swap') + '. The heap is whole again, with ' + size + ' key' + (size === 1 ? '' : 's') + '.'; break;
        case 'after': say = 'main prints ' + memo.out[memo.out.length - 1] + '. Heap now: ' + (size ? HP.list(a, size) : 'empty') + '.' + (memo.out.length > 1 ? ' Keys removed so far: ' + memo.out.join(', ') + ', largest first: this is how heap sort works.' : ''); break;
      }
      return { items, say, slow: tag === 'move-last' || tag === 'swap' };
    },
    predict: [
      { at: (t) => t.tag === 'top' && t.data.size > 1, once: true, ask: 'The root is about to leave. Which key will be moved into its place? Click it.', answer: (ts, i) => 'hv' + ts[i].data.a[ts[i].data.size - 1], explain: (ts, i) => 'The last key, a[size-1] = ' + ts[i].data.a[ts[i].data.size - 1] + ': taking it keeps the tree complete.' },
      { at: (t) => t.tag === 'left' && t.data.v.c + 1 < t.data.size, once: true, ask: (t) => { const d = t.data, c = d.v.c; return d.a[d.v.i] + ' must sink. Click the child it will be compared with (the left is ' + d.a[c] + ', the right ' + d.a[c + 1] + ').'; }, answer: (ts, i) => { const d = ts[i].data, c = d.v.c; return 'hv' + (d.a[c + 1] > d.a[c] ? d.a[c + 1] : d.a[c]); }, explain: () => 'Always the larger child: it is the only one that can sit above the other.' },
    ],
    quiz: [
      { q: 'Why is the last key moved to the root, and not the larger child of the root?', options: ['It is faster to find', 'Only removing the last slot keeps the tree complete, with no gap', 'The last key is the smallest', 'It does not matter'], answer: 1, why: 'Promoting a child would leave a hole further down. The last slot can go without breaking the shape; then the order is repaired.' },
      { q: 'When the key sinks, why swap with the larger child?', options: ['To make fewer comparisons', 'The larger child is the only one that can be the parent of the other', 'It is always the left one', 'To keep the tree complete'], answer: 1, why: 'Swapping with the smaller child would put it above a bigger sibling, breaking the rule right away.' },
      { q: 'How many comparisons can one extract make in a heap of n keys?', options: ['About n', 'About 2·log₂ n', 'Exactly 1', 'About n/2'], answer: 1, why: 'Two per level (which child is larger, then key against that child), and there are about log₂ n levels.' },
      { q: 'After size--, a[size] still holds a value. Is that a problem?', options: ['Yes, it must be zeroed', 'No: everything from a[size] on is outside the heap and is never read', 'Yes, it breaks the heap rule', 'Only for min-heaps'], answer: 1, why: 'size says where the heap ends; the next insert simply writes over that slot.' },
    ],
  });
})(SEE);
