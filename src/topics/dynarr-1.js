// Dynamic arrays: the family (a heap block, a size and a capacity), push_back with doubling and
// pop_back with halving.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, S = X.StripKit;
  const W = 42, GAP = 4, PITCH = W + GAP;
  const hex = (v) => X.hex(v);

  X.family({
    id: 'dynarr', order: 2, group: 'Arrays', title: 'Dynamic arrays',
    blurb: 'An array on the heap that grows when it is full: size counts the elements, capacity counts the slots, and a full block is replaced by one twice as big.',
    head: `#include <stdio.h>
#include <stdlib.h>

/* a growable array of ints */
struct vec {
    int *data;     /* the block of slots on the heap */
    int size;      /* how many slots are in use */
    int cap;       /* how many slots the block has */
};`,
  });

  /** The vector's fields and blocks, from inside the functions (v is a pointer) or main (v is the struct) */
  function capVec(P) {
    const sz = P.ev('v->size'), inFn = sz !== null;
    const size = inFn ? sz : P.ev('v.size');
    const cap = inFn ? P.ev('v->cap') : P.ev('v.cap');
    const data = inFn ? P.ev('v->data') : P.ev('v.data');
    const out = { size, cap, data, slots: P.live(data) ? S.ints(P, data, cap) : null, freed: P.freed(data) };
    const big = S.local(P, 'bigger'), nc = S.local(P, 'newcap');
    out.newcap = nc;
    if (big !== null && nc !== null && P.live(big)) { out.bigger = big; out.bslots = S.ints(P, big, nc); }
    out.i = S.local(P, 'i');
    out.x = S.local(P, 'x');
    return out;
  }

  /** One block: a frame around its slots, its address, and the slots (values keep their identity) */
  function block(ctx, addr, slots, y, opts) {
    opts = opts || {};
    const pos = S.row(0, y, W, GAP);
    const view = S.cells(ctx, 'b' + addr + '-', slots, Object.assign({ pos, w: W, sub: (i) => i, exit: opts.exit || 'fade' }, opts.cells || {}));
    const items = view.items.slice();
    const wid = Math.max(1, slots.length) * PITCH + 8;
    items.push({ key: 'frame' + addr, kind: 'region', x: -8, y: y - 8, w: wid + 4, h: W + 30, cls: opts.freed ? 'freed' : 'heap' + (opts.color ? ' ' + opts.color : '') });
    items.push({ key: 'addr' + addr, kind: 'text', x: -8, y: y - 30, text: (opts.name ? opts.name + ': ' : '') + 'block at ' + hex(addr) + ', ' + S.pl(slots.length, 'slot') + (opts.freed ? ', freed' : ''), cls: opts.freed ? 'bad' : 'idx' });
    return { items, view, pos };
  }
  /** The size wall inside the block */
  const sizeWall = (size, y, name) => S.wall('wall-size', size * PITCH - GAP / 2, y - 6, size * PITCH - GAP / 2, y + W + 6, (name || 'size') + ' = ' + size, 'c-indigo', { x: size * PITCH + 2, y: y + W + 40, anchor: 'start' });

  const parsePushes = { id: 'pushes', kind: 'ints', label: 'Values to push', def: [5, 8, 2, 9, 4, 7, 1, 6, 3], min: 1, max: 10 };

  // ---- push_back with doubling ---------------------------------------------------------------------------
  X.topic({
    id: 'dyn-push', family: 'dynarr', order: 10, title: 'Push back (doubling)',
    blurb: 'When the block is full, a block twice as big is allocated, every element is copied across, and the old block is freed. Rare, expensive copies; cheap pushes in between.',
    code: `/* add x at the end, doubling the capacity first if the block is full */
void push_back(struct vec *v, int x)
{
    if (v->size == v->cap) {                             /*@ full-test */
        int newcap = 2 * v->cap;                         /*@ newcap */
        int *bigger = malloc(newcap * sizeof *bigger);   /*@ alloc */
        int i;
        for (i = 0; i < v->size; i++)                    /*@ copy-loop */
            bigger[i] = v->data[i];                      /*@ copy */
        free(v->data);                                   /*@ free */
        v->data = bigger;                                /*@ adopt */
        v->cap = newcap;                                 /*@ cap */
    }
    v->data[v->size] = x;                                /*@ store */
    v->size++;                                           /*@ size */
}                                                        /*@ back */`,
    animate: ['push_back'],
    inputs: [parsePushes, { id: 'cap', kind: 'int', label: 'Starting capacity', def: 1, lo: 1, hi: 4 }],
    presets: [
      { label: 'From capacity 1', values: { pushes: [5, 8, 2, 9, 4, 7, 1, 6, 3], cap: 1 } },
      { label: 'Exactly full', values: { pushes: [10, 20, 30, 40], cap: 4 } },
      { label: 'One past full', values: { pushes: [10, 20, 30, 40, 50], cap: 4 } },
      { label: 'From capacity 3', values: { pushes: [1, 2, 3, 4, 5, 6, 7], cap: 3 } },
    ],
    counters: ['moves', 'allocs', 'frees'],
    main: (inp) => `int main(void)
{
    struct vec v;
    v.size = 0;
    v.cap = ${inp.cap};
    v.data = malloc(v.cap * sizeof *v.data);
${inp.pushes.map((x) => '    push_back(&v, ' + x + ');').join('\n')}
    printf("size %d, capacity %d\\n", v.size, v.cap);
    free(v.data);
    return 0;
}`,
    capture: capVec,
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const memo = ctx.memo;
      memo.seen = memo.seen || {};
      if (d.slots && !d.freed) memo.seen[d.data] = d.slots;
      const past = ctx.ticks.slice(0, ctx.i + 1);
      // one call after another: each 'after' tick closes a call
      const call = past.filter((t, k) => t.tag === 'after' && k < ctx.i).length + 1;
      const x = inp.pushes[call - 1];
      const items = [];
      const Y0 = 0, Y1 = 130;
      // the old (current) block; while it is being freed it is drawn from what it held
      const gone = d.freed || !d.slots;
      const oldSlots = gone ? (memo.seen[d.data] || []) : d.slots;
      const copying = d.bigger !== undefined;
      const main = block(ctx, d.data, oldSlots, Y0, {
        name: 'v->data', freed: gone, exit: 'fall',
        cells: { src: (k) => (tag === 'store' && k === d.size ? { x: oldSlots.length * PITCH + 60 - W / 2, y: Y0 } : null), cls: (k, v) => (gone ? 'used' : k >= d.size ? '' : copying && d.i !== null && k < d.i ? 'used' : copying && k === d.i && tag === 'copy-loop' ? 'focus' : ''), hotWrites: tag === 'store' },
      });
      if (!(tag === 'adopt' || tag === 'cap') || d.data !== d.bigger) items.push(...main.items);
      if (!gone) items.push(...sizeWall(d.size, Y0));
      if (copying && d.data !== d.bigger) {
        const nb = block(ctx, d.bigger, d.bslots, Y1, {
          name: 'bigger', color: 'c-teal',
          cells: { src: (k) => (tag === 'copy' ? main.pos(k) : null), cls: () => 'blk-a' },
        });
        items.push(...nb.items);
      }
      // the value being pushed waits on the right
      if (call && tag !== 'store' && tag !== 'size' && tag !== 'back' && tag !== 'after') {
        const tx = Math.max(oldSlots.length, d.newcap || 0) * PITCH + 60;
        items.push({ key: 'xtok' + call, kind: 'token', x: tx, y: Y0 + W / 2, r: 18, text: String(x), cls: 'c-green' });
        items.push({ key: 'xl', kind: 'text', x: tx, y: Y0 - 18, text: 'push ' + x, cls: 'idx', anchor: 'middle' });
      }
      // the cost of every push so far: 1 write plus the copies a growth made
      const costs = [];
      past.forEach((t, k) => { if (k === 0 || (past[k - 1].tag === 'after')) costs.push(1); if (t.tag === 'copy') costs[costs.length - 1]++; });
      const CY = 400;
      items.push({ key: 'cost-t', kind: 'text', x: -8, y: CY - 120, text: 'cost of each push: 1 write + the copies it made', cls: 'idx' });
      inp.pushes.forEach((v, k) => {
        const h = k < costs.length ? costs[k] * 11 : 0;
        items.push({ key: 'cost' + k, kind: 'bar', x: k * 38, y: CY, w: 30, h, text: k < costs.length ? String(costs[k]) : '', cls: k === costs.length - 1 ? 'hot' : costs[k] > 1 ? 'pivot' : '' });
      });
      const totalCost = costs.reduce((s, v) => s + v, 0);
      const copies = totalCost - costs.length;
      if (costs.length) items.push({ key: 'avg', kind: 'text', x: -8, y: CY - 98, text: copies + ' copies in ' + S.pl(costs.length, 'push', 'pushes') + ': ' + (totalCost / costs.length).toFixed(2) + ' per push', cls: 'mono' });
      if (d.i !== null && copying) items.push(S.tag('ci', d.i < oldSlots.length ? main.view.keyOf(d.i) : null, 'i', 'c-teal', 'below'));
      let say = '';
      switch (tag) {
        case 'enter': say = 'push_back(&v, ' + x + '): size ' + d.size + ', capacity ' + d.cap + '.'; break;
        case 'full-test': say = (call > 1 ? 'push_back(&v, ' + x + '). ' : '') + (d.size === d.cap ? 'size == cap (' + d.size + '): every slot is taken. Before ' + x + ' can go in, the array must grow.' : 'size ' + d.size + ' < cap ' + d.cap + ': there is a free slot, so this push costs one write.'); break;
        case 'newcap': say = 'The new capacity is twice the old one: ' + d.newcap + '. Doubling, not adding one slot, is what keeps pushes cheap on average.'; break;
        case 'alloc': say = 'malloc gives a new block of ' + d.newcap + ' ints at ' + hex(d.bigger) + '. A block cannot be stretched in place in general: the memory after it may belong to something else.'; break;
        case 'copy-loop': say = d.i < d.size ? 'i = ' + d.i + ': copy element ' + d.i + ' of ' + d.size + '.' : (d.size === 1 ? 'The only element is' : 'All ' + d.size + ' elements are') + ' in the new block.'; break;
        case 'copy': say = 'bigger[' + d.i + '] = v->data[' + d.i + ']: ' + d.bslots[d.i] + ' is copied down into the new block.'; break;
        case 'free': say = 'free(v->data): the old block at ' + hex(d.data) + ' goes back to the heap. v->data still holds its address for a moment, but it must not be used.'; break;
        case 'adopt': say = 'v->data = bigger: the vector now uses the new block. realloc() does these same steps (allocate, copy, free) in one call.'; break;
        case 'cap': say = 'v->cap = ' + d.cap + '. ' + S.pl(d.cap - d.size, 'free slot') + ': the next ' + S.pl(d.cap - d.size, 'push', 'pushes') + ' will be cheap.'; break;
        case 'store': say = 'v->data[' + d.size + '] = ' + x + ': the new value goes into the first free slot.'; break;
        case 'size': say = 'size becomes ' + d.size + ' of ' + d.cap + '.'; break;
        case 'back': say = 'push_back(' + x + ') is done' + (costs[costs.length - 1] > 1 ? ': it cost ' + (costs[costs.length - 1] - 1) + ' copies and a write.' : ': it cost one write.'); break;
        case 'after': say = ctx.i === ctx.ticks.length - 1 ? 'All ' + S.pl(costs.length, 'push', 'pushes') + ' done: ' + copies + ' copies in all, ' + (totalCost / costs.length).toFixed(2) + ' writes per push on average. However many pushes there are, the average stays below 3: amortised O(1).' : 'Back in main: size ' + d.size + ', capacity ' + d.cap + '.'; break;
      }
      return { items, say, slow: tag === 'adopt' };
    },
    predict: [
      { at: (t) => t.tag === 'full-test' && t.data.size === t.data.cap, once: true, ask: (t) => 'The block is full with ' + S.pl(t.data.size, 'element') + '. How many copies will this push make?', options: (ts, i) => { const s = ts[i].data.size; return [...new Set([0, 1, s, 2 * s])].map(String); }, answer: (ts, i) => String(ts[i].data.size), pick: 'option', explain: () => 'Every element already stored is copied into the new block, once.' },
      { at: (t, i, ts) => t.tag === 'cap', once: true, ask: 'After this growth, how many more pushes fit before the next one?', options: (ts, i) => { const d = ts[i].data; return [...new Set([1, d.cap - d.size, d.cap, d.size])].sort((a, b) => a - b).map(String); }, answer: (ts, i) => String(ts[i].data.cap - ts[i].data.size), pick: 'option', explain: () => 'The block is now half full: as many free slots as there are elements.' },
    ],
    quiz: [
      { q: 'Why double the capacity rather than add one slot?', options: ['It uses less memory', 'Adding one slot would copy everything on every push: O(n²) in total', 'malloc only gives powers of two', 'It is the same either way'], answer: 1, why: 'With doubling, each element is copied about once on average over its life, so n pushes cost O(n).' },
      { q: 'Starting from capacity 1, how many copies do 9 pushes make?', options: ['9', '15', '36', '45'], answer: 1, why: 'Growths at sizes 1, 2, 4 and 8: 1 + 2 + 4 + 8 = 15 copies.' },
      { q: 'What is wrong with using the old v->data after free(v->data)?', options: ['Nothing', 'The block belongs to the heap again: reading or writing it is undefined behaviour', 'It is slower', 'It holds zeros'], answer: 1, why: 'A freed block may be reused for anything; the pointer dangles.' },
      { q: 'What is the worst case for a single push_back?', options: ['O(1)', 'O(log n)', 'O(n), when it has to grow', 'O(n²)'], answer: 2, why: 'One push can copy every element. It is the average over many pushes that is O(1).' },
      { q: 'What does realloc(p, bigger) do?', options: ['Always fails', 'Grows the block in place if it can, otherwise allocates, copies and frees, returning the new address', 'Only frees', 'Clears the memory'], answer: 1, why: 'That is why its result must be stored: the block may have moved.' },
    ],
    compareWith: 'dyn-pop',
  });

  // ---- pop_back with halving ------------------------------------------------------------------------------
  X.topic({
    id: 'dyn-pop', family: 'dynarr', order: 20, title: 'Pop back (halving)',
    blurb: 'Popping only moves size down. When the array falls to a quarter full, the block is halved with realloc, and the tail goes back to the heap.',
    code: `/* remove and return the last element; halve the block when it is a quarter full */
int pop_back(struct vec *v)
{
    int x = v->data[v->size - 1];                        /*@ take */
    v->size--;                                           /*@ size */
    if (v->size > 0 && v->size <= v->cap / 4) {          /*@ quarter-test */
        v->cap = v->cap / 2;                             /*@ halve */
        v->data = realloc(v->data, v->cap * sizeof *v->data);   /*@ shrink */
    }
    return x;                                            /*@ give */
}`,
    animate: ['pop_back'],
    inputs: [
      { id: 'values', kind: 'ints', label: 'The elements', def: [3, 1, 4, 1, 5, 9, 2, 6], min: 1, max: 16 },
      { id: 'cap', kind: 'int', label: 'Capacity', def: 8, lo: 1, hi: 16 },
      { id: 'pops', kind: 'int', label: 'Pops', def: 7, lo: 1, hi: 16 },
    ],
    check: (inp) => (inp.cap < inp.values.length ? 'Capacity: at least the number of elements (' + inp.values.length + ')' : inp.pops > inp.values.length ? 'Pops: at most the number of elements (' + inp.values.length + ')' : null),
    presets: [
      { label: 'Full, pop most', values: { values: [3, 1, 4, 1, 5, 9, 2, 6], cap: 8, pops: 7 } },
      { label: 'Big block, few elements', values: { values: [10, 20, 30, 40, 50], cap: 16, pops: 3 } },
      { label: 'Pop everything', values: { values: [7, 8, 9, 10], cap: 4, pops: 4 } },
      { label: 'Half full: no shrink yet', values: { values: [1, 2, 3, 4, 5], cap: 8, pops: 2 } },
    ],
    counters: ['writes'],
    main: (inp) => `int main(void)
{
    int start[] = { ${inp.values.join(', ')} };
    struct vec v;
    int i;
    v.cap = ${inp.cap};
    v.size = ${inp.values.length};
    v.data = malloc(v.cap * sizeof *v.data);
    for (i = 0; i < v.size; i++)
        v.data[i] = start[i];
${Array(inp.pops).fill('    pop_back(&v);').join('\n')}
    printf("size %d, capacity %d\\n", v.size, v.cap);
    free(v.data);
    return 0;
}`,
    capture: capVec,
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const past = ctx.ticks.slice(0, ctx.i + 1);
      const call = past.filter((t, k) => t.tag === 'after' && k < ctx.i).length + 1;
      const slots = d.slots || [];
      if (d.x !== null) ctx.memo.x = d.x;
      const x = d.x === null ? ctx.memo.x : d.x;
      const halving = tag === 'halve';   // cap is already halved, the block is not yet
      const shown = halving ? slots.concat(ctx.prev.data.slots.slice(slots.length)) : slots;
      const b = block(ctx, d.data, shown, 0, {
        name: 'v->data', exit: 'shrink',
        cells: { cls: (k) => (halving && k >= d.cap ? 'victim' : k >= d.size ? 'stale' : ''), hotWrites: false },
      });
      const items = b.items.slice();
      items.push(...sizeWall(d.size, 0));
      // the quarter line: when size drops to it, the block is halved
      const q = Math.floor(d.cap / 4);
      const qx = q * PITCH - GAP / 2;
      if (q > 0 && q !== d.size) items.push(...S.wall('wall-q', qx, -6, qx, W + 6, 'cap/4 = ' + q, 'c-rose dash', { x: qx, y: -13 }));
      // fill gauge
      const gx = -8, gy = 150, gw = Math.max(shown.length, 4) * PITCH;
      items.push({ key: 'g-back', kind: 'region', x: gx, y: gy, w: gw, h: 18, cls: 'gauge' });
      items.push({ key: 'g-fill', kind: 'region', x: gx, y: gy, w: d.cap ? gw * d.size / d.cap : 0, h: 18, cls: d.size && d.size <= d.cap / 4 ? 'fill-bad' : 'fill-b' });
      items.push({ key: 'g-t', kind: 'text', x: gx, y: gy + 40, text: 'size ' + d.size + ' of capacity ' + d.cap + ': ' + Math.round(100 * d.size / Math.max(1, d.cap)) + '% full', cls: 'mono' });
      // the value taken out flies away to the right
      if (x !== undefined && ['take', 'size', 'quarter-test', 'halve', 'shrink', 'give'].includes(tag)) {
        items.push({ key: 'xtok' + call, kind: 'token', x: Math.max(shown.length, 1) * PITCH + 60, y: W / 2, r: 18, text: String(x), cls: 'c-green', enter: 'fly', from: { x: (d.size - (tag === 'take' ? 1 : 0)) * PITCH + W / 2, y: W / 2 } });
        items.push({ key: 'xl', kind: 'text', x: Math.max(shown.length, 1) * PITCH + 60, y: -10, text: 'x', cls: 'idx', anchor: 'middle' });
      }
      const shrinks = past.filter((t) => t.tag === 'shrink').length;
      let say = '';
      switch (tag) {
        case 'enter': say = 'pop_back(&v): size ' + d.size + ', capacity ' + d.cap + '.'; break;
        case 'take': say = (call > 1 ? 'pop_back(&v). ' : '') + 'x = v->data[' + (d.size - 1) + '] = ' + d.x + ', the last element.'; break;
        case 'size': say = 'size drops to ' + d.size + '. Nothing is erased: slot ' + d.size + ' still holds ' + slots[d.size] + ', but it is no longer counted.'; break;
        case 'quarter-test': say = d.size > 0 && d.size <= d.cap / 4 ? 'size ' + d.size + ' ≤ cap / 4 = ' + Math.floor(d.cap / 4) + ': three quarters of the block are wasted. Time to halve it.' : d.size === 0 ? 'size is 0: the block is kept for the next push.' : 'size ' + d.size + ' > cap / 4 = ' + Math.floor(d.cap / 4) + ': the block stays as it is.'; break;
        case 'halve': say = 'v->cap = ' + d.cap + '. The block itself is still ' + shown.length + ' slots; the red ones are about to go.'; break;
        case 'shrink': say = 'realloc shrinks the block to ' + S.pl(d.cap, 'slot') + '. ' + (d.data === ctx.prev.data.data ? 'It stays at the same address; its tail goes back to the heap.' : 'It moved to ' + hex(d.data) + '.') + ' The array is now half full, so the next push or pop cannot trigger another resize straight away.'; break;
        case 'give': say = 'pop_back() returns ' + x + '.'; break;
        case 'after': say = ctx.i === ctx.ticks.length - 1 ? 'Done: size ' + d.size + ', capacity ' + d.cap + ', after ' + S.pl(shrinks, 'shrink') + '.' : 'Back in main: size ' + d.size + ', capacity ' + d.cap + '.'; break;
      }
      return { items, say, slow: tag === 'shrink' };
    },
    predict: [
      { at: (t) => t.tag === 'size' && t.data.size > 0 && t.data.size * 2 === t.data.cap, once: true, ask: (t) => 'size is now ' + t.data.size + ' of ' + t.data.cap + ': half full. Will the block shrink?', options: () => ['Yes, to half', 'No, not until a quarter full'], answer: () => 'No, not until a quarter full', pick: 'option', explain: () => 'Shrinking at half full would leave the block full: the very next push would have to grow it again.' },
      { at: (t) => t.tag === 'quarter-test' && t.data.size > 0 && t.data.size <= t.data.cap / 4, once: true, ask: (t) => 'size ' + t.data.size + ' ≤ cap / 4. What will the new capacity be?', options: (ts, i) => { const c = ts[i].data.cap; return [...new Set([c / 4, c / 2, c - 1, ts[i].data.size])].filter((v) => v >= 1).map((v) => String(Math.floor(v))); }, answer: (ts, i) => String(Math.floor(ts[i].data.cap / 2)), pick: 'option', explain: () => 'Halved, so the array ends up half full, with room to move both ways.' },
    ],
    quiz: [
      { q: 'Why shrink at a quarter full and not at half full?', options: ['It saves more memory', 'At half full, a shrink leaves the block full, and one push would grow it again: alternating push and pop would resize every time', 'realloc needs it', 'No reason'], answer: 1, why: 'The gap between the grow point (full) and the shrink point (a quarter) stops this thrashing.' },
      { q: 'What does v->size-- do to the popped slot?', options: ['Frees it', 'Sets it to 0', 'Nothing: it just stops being counted', 'Moves it'], answer: 2, why: 'The value stays in memory until it is overwritten by a later push.' },
      { q: 'Why is the result of realloc stored back into v->data?', options: ['Style only', 'realloc may move the block and return a new address', 'To free the old one', 'It returns the size'], answer: 1, why: 'Even when shrinking, a library may move the block. The old pointer is not to be trusted.' },
      { q: 'After a shrink, how full is the array?', options: ['Full', 'Half full', 'A quarter full', 'Empty'], answer: 1, why: 'A quarter of the old capacity is half of the new one.' },
    ],
    compareWith: 'dyn-push',
  });
})(SEE);
