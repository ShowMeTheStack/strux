// Hashing with chaining: deleting an entry, and growing the table (rehashing).
(function (SEE) {
  'use strict';
  const X = SEE.Strux, H = X.HashKit;
  const NW = H.NW, NH = H.NH, BW = H.BW, GAP = H.GAP;
  const plural = (n, w, ws) => n + ' ' + (n === 1 ? w : (ws || w + 's'));

  /** A chain entry as a node box: key | next */
  const entryNode = (n, x, y, cls, extra) => Object.assign({
    key: 'n' + n.addr, kind: 'node', x, y, w: NW, h: NH,
    cells: [{ text: n.key, w: 1.1, cls: 'val' }, { text: n.next ? '' : 'NULL', port: 'next', w: 0.8, cls: 'link' + (n.next ? '' : ' null') }],
    cls: cls || '', enter: 'drop', exit: 'fall', pick: true,
  }, extra || {});

  // ---- delete ------------------------------------------------------------------------------------------------
  const ROW = 58;      // the bucket being worked on gets extra room above (for a bypass arrow) and below
  const rowY = (b, h) => b * ROW + (h !== null && b >= h ? 40 : 0) + (h !== null && b > h ? 50 : 0);
  X.topic({
    id: 'chain-delete', family: 'chain', order: 30, title: 'Delete with chaining',
    blurb: 'Find the key in its bucket\'s chain and unlink it. In a singly linked chain the arrow to change belongs to the entry before, so a second pointer has to trail one step behind.',
    code: `/* remove key from the table; returns 1 if it was there */
int delete_key(int key)
{
    int h = hash(key);                      /*@ hash */
    struct entry *prev = NULL;              /*@ init-prev */
    struct entry *p = table[h];             /*@ start */
    while (p != NULL && p->key != key) {    /*@ compare */
        prev = p;                           /*@ step-prev */
        p = p->next;                        /*@ follow */
    }
    if (p == NULL)                          /*@ none */
        return 0;                           /*@ missing */
    if (prev == NULL)                       /*@ which */
        table[h] = p->next;                 /*@ unlink-head */
    else
        prev->next = p->next;               /*@ unlink */
    free(p);                                /*@ free */
    return 1;                               /*@ done */
}`,
    animate: ['delete_key'], quiet: ['hash'],
    inputs: [
      { id: 'keys', kind: 'ints', label: 'Keys already in the table', def: [15, 8, 22, 29, 3, 11, 40], min: 0, max: 12, distinct: true, check: (v) => (v.some((x) => x < 0) ? 'Keys: 0 or more' : null) },
      { id: 'm', kind: 'int', label: 'Buckets (M)', def: 7, lo: 1, hi: 11 },
      { id: 'key', kind: 'int', label: 'Delete', def: 22, lo: 0, hi: 999 },
    ],
    check: (inp) => { const per = new Map(); for (const k of inp.keys) per.set(k % inp.m, (per.get(k % inp.m) || 0) + 1); return Math.max(0, ...per.values()) > 6 ? 'At most 6 keys in one bucket, so the chain fits on the screen' : null; },
    presets: [
      { label: 'From the middle', values: { keys: [15, 8, 22, 29, 3, 11, 40], m: 7, key: 22 } },
      { label: 'The first entry', values: { keys: [15, 8, 22, 29, 3, 11, 40], m: 7, key: 29 } },
      { label: 'The last entry', values: { keys: [15, 8, 22, 29, 3, 11, 40], m: 7, key: 15 } },
      { label: 'The only entry', values: { keys: [15, 8, 22, 29, 3, 11, 40], m: 7, key: 3 } },
      { label: 'Not there', values: { keys: [15, 8, 22, 29, 3, 11, 40], m: 7, key: 36 } },
    ],
    counters: ['compares', 'follows', 'frees'],
    main: (inp) => X.chainMain(inp, 'delete_key(' + inp.key + ');'),
    capture: (P) => Object.assign(H.captureChains(P, { m: P.ev('M') || 7, cursors: ['p', 'prev'] }), { h: P.isSet('h', 0) ? P.val('h', 0) : null }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, memo = ctx.memo;
      // hash() runs quietly and its line is pictured as it returns, before h is assigned: work h out here
      if (tag === 'hash') memo.h = inp.key % inp.m;
      if (d.h !== null) memo.h = d.h;
      const h = memo.h === undefined ? null : memo.h, p = d.cursors.p, prev = d.cursors.prev;
      const by = new Map();
      d.buckets.forEach((bk) => bk.nodes.forEach((n) => by.set(n.addr, n)));
      for (const n of d.loose || []) by.set(n.addr, n);
      // where every entry started: kept until the freed one has gone, so the gap stays visible
      if (!memo.start) {
        memo.start = new Map();
        ctx.ticks[0].data.buckets.forEach((bk, b) => bk.nodes.forEach((n, k) => memo.start.set(n.addr, { b, k, key: n.key })));
      }
      if (tag === 'unlink' || tag === 'unlink-head') memo.victim = Object.assign({}, by.get(p));
      if (tag === 'compare' && p) { memo.seen = memo.seen || []; if (!memo.seen.includes(p)) memo.seen.push(p); }
      const freedNow = tag === 'free';
      if (ctx.prev && ctx.prev.tag === 'free') memo.gone = true;
      const compact = !!memo.gone;
      const xAt = (k) => BW + GAP + k * (NW + GAP);
      const items = [];
      const pos = new Map();
      d.buckets.forEach((bk, b) => {
        const y = rowY(b, h);
        const cls = b === h ? 'focus' : h !== null ? 'ghost' : '';
        items.push({ key: 'bk' + b, kind: 'node', x: 0, y, w: BW, h: NH, cells: [{ text: bk.head ? '' : 'NULL', port: 'p', cls: 'link' + (bk.head ? '' : ' null') + (ctx.prev && ctx.prev.data.buckets && ctx.prev.data.buckets[b] && ctx.prev.data.buckets[b].head !== bk.head ? ' hot' : '') }], cls: 'bucket ' + cls, pick: true });
        items.push({ key: 'bi' + b, kind: 'text', x: -12, y: y + NH / 2 + 5, text: '[' + b + ']', cls: 'idx', anchor: 'end' });
        bk.nodes.forEach((n, k) => { const s = memo.start.get(n.addr); pos.set(n.addr, { x: xAt(compact || !s ? k : s.k), y, b }); });
      });
      const victim = memo.victim && (by.has(memo.victim.addr) || freedNow) ? memo.victim : null;
      if (victim) { const s = memo.start.get(victim.addr); pos.set(victim.addr, { x: xAt(s.k), y: rowY(s.b, h), b: s.b }); }
      for (const [a, at] of pos) {
        const n = a === (victim && victim.addr) ? victim : by.get(a);
        let cls = '';
        if (h !== null && at.b !== h) cls = 'ghost';
        else if (victim && a === victim.addr) cls = freedNow ? 'freed' : 'lost';
        else if (a === p && tag !== 'after') cls = (p && by.get(p) && by.get(p).key === inp.key) ? 'part-a' : 'focus';
        else if (a === prev) cls = 'part-b';
        else if (memo.seen && memo.seen.includes(a) && tag !== 'after') cls = 'ghost';
        items.push(entryNode(n, at.x, at.y, cls));
      }
      // arrows: a pointer that now jumps over the unlinked entry arches above it
      const vx = victim && !compact ? pos.get(victim.addr).x : null;
      const over = (from, to) => vx !== null && pos.get(to) && from < vx && pos.get(to).x > vx;
      for (const [a, at] of pos) {
        const n = a === (victim && victim.addr) ? victim : by.get(a);
        if (!n.next || !pos.has(n.next)) continue;
        const isV = victim && a === victim.addr;
        const into = n.next === p && !isV && tag !== 'after' && h === at.b;
        items.push({ key: 'a' + a, kind: 'arrow', from: { key: 'n' + a, port: 'next' }, to: { key: 'n' + n.next, side: over(at.x, n.next) ? 'top' : 'left' }, bend: over(at.x, n.next) ? -70 : 0, cls: isV ? 'dim' : into ? (tag === 'which' ? 'hot' : 'part-b') : (memo.victim && a === prev && !compact ? 'hot' : '') });
      }
      d.buckets.forEach((bk, b) => {
        if (!bk.head || !pos.has(bk.head)) return;
        const ov = over(BW, bk.head);
        const into = bk.head === p && h === b && !prev && tag !== 'after';
        items.push({ key: 'ba' + b, kind: 'arrow', from: { key: 'bk' + b, port: 'p' }, to: { key: 'n' + bk.head, side: ov ? 'top' : 'left' }, bend: ov ? -70 : 0, cls: into ? (tag === 'which' ? 'hot' : 'part-b') : (memo.victim && !memo.victim.prevWas && b === h && !prev && !compact ? 'hot' : '') });
      });
      items.push(...H.box(inp.key, inp.m, h, { x: 0, y: -130 }));
      if (h !== null) items.push({ key: 'hl', kind: 'arrow', from: { x: 90, y: -60 }, to: { key: 'bk' + h, side: 'top' }, cls: 'hot', bend: 0 });
      if (p && pos.has(p) && tag !== 'after') items.push({ key: 'cp', kind: 'cursor', at: 'n' + p, side: 'below', text: 'p', cls: 'c-teal' });
      if (prev && pos.has(prev) && tag !== 'after') items.push({ key: 'cprev', kind: 'cursor', at: 'n' + prev, side: 'below', text: 'prev', cls: 'c-violet' });
      if (victim && !freedNow && pos.has(victim.addr)) items.push({ key: 'vnote', kind: 'text', x: pos.get(victim.addr).x + NW / 2, y: pos.get(victim.addr).y - 46, text: 'nothing points here now', cls: 'bad', anchor: 'middle' });
      if (freedNow && victim) items.push({ key: 'vnote', kind: 'text', x: pos.get(victim.addr).x + NW / 2, y: pos.get(victim.addr).y - 46, text: 'free(p): back to the heap', cls: 'bad', anchor: 'middle' });
      // the arrow that will have to change, named while p walks
      const nm = (a) => (a && by.has(a) ? String(by.get(a).key) : 'NULL');
      const chainKeys = h !== null && d.buckets[h] ? d.buckets[h].nodes.map((n) => n.key) : [];
      let say = '';
      switch (tag) {
        case 'enter': say = 'delete_key(' + inp.key + '): find the entry, take it out of its chain without breaking the chain, then give its memory back.'; break;
        case 'hash': say = 'hash(' + inp.key + ') = ' + inp.key + ' % ' + inp.m + ' = ' + h + '. If ' + inp.key + ' is in the table, it is in bucket ' + h + (chainKeys.length ? ' (' + chainKeys.join(' → ') + ').' : ', which is empty.'); break;
        case 'init-prev': say = 'prev starts as NULL. It will trail one entry behind p, because the arrow to change when p finds the key lives in the entry before p, and a singly linked chain cannot be walked backwards.'; break;
        case 'start': say = p ? 'p starts at the front of the chain, ' + nm(p) + '. The arrow into it is table[' + h + '] itself, since prev is NULL.' : 'table[' + h + '] is NULL: bucket ' + h + ' has no entries at all.'; break;
        case 'compare': say = !p ? 'p is NULL: the chain ended without finding ' + inp.key + '.' : by.get(p).key === inp.key ? 'p->key is ' + inp.key + ': found it. prev is at ' + (prev ? nm(prev) : 'NULL (p is the first entry)') + '.' : nm(p) + ' ≠ ' + inp.key + ': keep walking.'; break;
        case 'step-prev': say = 'prev = p: prev moves up to ' + nm(prev) + ' before p leaves it.'; break;
        case 'follow': say = 'p = p->next: p moves on to ' + nm(p) + ', and prev stays one behind, holding the arrow that points at p.'; break;
        case 'none': say = p ? 'p is not NULL, so the key was found.' : 'p is NULL, so ' + inp.key + ' is not in the table.'; break;
        case 'missing': say = 'Nothing to delete: ' + inp.key + ' is not in bucket ' + h + '. delete_key returns 0 and the table is unchanged.'; break;
        case 'which': say = prev ? 'prev is ' + nm(prev) + ', so the arrow to change is ' + nm(prev) + '\'s next. It points at ' + inp.key + ' now.' : 'prev is NULL: ' + inp.key + ' is the first entry, so the arrow to change is table[' + h + '] itself.'; break;
        case 'unlink-head': say = 'table[' + h + '] = p->next: the bucket now points ' + (by.get(p).next ? 'straight at ' + nm(by.get(p).next) : 'at NULL, the chain is empty') + '. Nothing points at ' + inp.key + ' any more, though its own next still does.'; break;
        case 'unlink': say = 'prev->next = p->next: ' + nm(prev) + '\'s arrow jumps over ' + inp.key + ' to ' + nm(by.get(p).next) + '. The chain is whole again, without ' + inp.key + '.'; break;
        case 'free': say = 'free(p): the entry for ' + inp.key + ' goes back to the heap. Unlinking first matters: freeing it while it was still in the chain would leave a dangling pointer behind.'; break;
        case 'done': say = 'delete_key returns 1. The entries after the gap did not move in memory; only one pointer changed.'; break;
        case 'after': { const tot = d.buckets.reduce((a, b) => a + b.nodes.length, 0); say = 'Bucket ' + h + ' now holds ' + (chainKeys.length ? chainKeys.join(' → ') : 'nothing') + '. The table has ' + plural(tot, 'key') + ' left.'; break; }
      }
      return { items, say, slow: tag === 'unlink' || tag === 'unlink-head' || tag === 'free' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'which', once: true, ask: (t, ts, i, ctx) => 'Which box holds the pointer that must change so the chain skips ' + ctx.input.key + '? Click it.', answer: (ts, i) => (ts[i].data.cursors.prev ? 'n' + ts[i].data.cursors.prev : 'bk' + ts[i].data.h), explain: (ts, i, ctx) => (ts[i].data.cursors.prev ? 'The arrow into ' + ctx.input.key + ' starts in prev\'s entry, so prev->next is the one to rewrite.' : ctx.input.key + ' is first in its chain, so the pointer into it is the bucket, table[h].') },
      { at: (t) => t.tag === 'start', once: true, ask: 'How many times will p move along before the loop stops?', options: () => ['0', '1', '2', '3', '4', '5'], answer: (ts) => String(ts.filter((t) => t.tag === 'follow').length), pick: 'option', explain: () => 'p stops on the key, or after the last entry when the key is missing.' },
    ],
    quiz: [
      { q: 'Why does delete_key need prev as well as p?', options: ['To count the entries', 'The pointer to rewrite is in the entry before p, and the chain only goes forwards', 'To free two entries', 'prev holds the key'], answer: 1, why: 'Unlinking p means changing the next of the entry before it. With only forward arrows, you must remember that entry as you walk.' },
      { q: 'The key is the first entry of its chain. What changes?', options: ['prev->next', 'table[h]', 'Nothing, it is just freed', 'Every entry moves'], answer: 1, why: 'prev is NULL, so the pointer into the key is the bucket itself: table[h] = p->next.' },
      { q: 'What goes wrong if free(p) comes before the unlink?', options: ['Nothing', 'p->next is read from freed memory', 'The key is found twice', 'hash() fails'], answer: 1, why: 'After free, p\'s memory is no longer yours; reading p->next to relink the chain is undefined behaviour.' },
      { q: 'How much work is deleting from a chain of length L, once the bucket is known?', options: ['Always one step', 'Up to L steps to find it, then one pointer change', 'L pointer changes', 'M steps'], answer: 1, why: 'Finding the key is a walk along the chain; the unlink itself is one assignment.' },
      { q: 'After unlinking 22 from 29 → 22 → 8, where does 22\'s own next point?', options: ['NULL', 'Still at 8', 'At 29', 'At the bucket'], answer: 1, why: 'Nobody changed it. That is harmless because nothing points at 22 any more, and it is freed straight after.' },
    ],
    compareWith: 'chain-search',
  });

  // ---- grow and rehash -----------------------------------------------------------------------------------------
  const CW = 96, VW = 76, VH = 34, VSTEP = 56;   // column width, node size, vertical step
  const vNode = (n, x, y, cls, extra) => Object.assign({
    key: 'n' + n.addr, kind: 'node', x, y, w: VW, h: VH,
    cells: [{ text: n.key, w: 1.1, cls: 'val' }, { text: n.next ? '' : 'NULL', port: 'next', w: 0.9, cls: 'link' + (n.next ? '' : ' null') }],
    cls: cls || '', enter: 'drop', exit: 'fade', pick: true,
  }, extra || {});

  X.topic({
    id: 'chain-rehash', family: 'chain', order: 40, title: 'Growing the table (rehash)',
    blurb: 'When the chains get too long on average, make a table with twice as many buckets and move every entry to the bucket its key now hashes to.',
    code: `#define MAX_LOAD 2        /* grow when keys > 2 per bucket */

struct entry **buckets = table;   /* the table in use */
int m = M;                        /* how many buckets it has */
int count = 0;                    /* how many keys it holds */

/* make a table with twice the buckets and move every entry over */
void grow(void)
{
    int new_m = 2 * m;                                      /*@ size */
    struct entry **fresh = calloc(new_m, sizeof *fresh);    /*@ alloc */
    int b, h;
    struct entry *e, *next;
    for (b = 0; b < m; b++) {                               /*@ bucket */
        e = buckets[b];                                     /*@ start */
        while (e != NULL) {                                 /*@ walk */
            next = e->next;                                 /*@ save */
            h = e->key % new_m;                             /*@ rehash */
            e->next = fresh[h];                             /*@ relink */
            fresh[h] = e;                                   /*@ move */
            e = next;                                       /*@ follow */
        }
    }
    buckets = fresh;                                        /*@ switch */
    m = new_m;                                              /*@ new-m */
}

/* add key at the front of its chain, then grow if too full */
void insert(int key)
{
    int h = key % m;                                        /*@ hash */
    struct entry *e = new_entry(key);                       /*@ new */
    e->next = buckets[h];                                   /*@ link */
    buckets[h] = e;                                         /*@ head */
    count++;                                                /*@ count */
    if (count > MAX_LOAD * m)                               /*@ load */
        grow();                                             /*@ grow */
}`,
    animate: ['insert', 'grow'], quiet: ['new_entry'],
    inputs: [
      { id: 'keys', kind: 'ints', label: 'Keys already in the table', def: [3, 7, 10, 12, 17, 26], min: 0, max: 10, distinct: true, check: (v) => (v.some((x) => x < 0) ? 'Keys: 0 or more' : null) },
      { id: 'm', kind: 'int', label: 'Buckets (M)', def: 3, lo: 1, hi: 5 },
      { id: 'key', kind: 'int', label: 'Insert', def: 21, lo: 0, hi: 999 },
    ],
    check: (inp) => {
      if (inp.keys.includes(inp.key)) return 'That key is already in the table';
      if (inp.keys.length > 2 * inp.m) return 'With ' + inp.m + ' buckets the table would already have grown: give at most ' + 2 * inp.m + ' keys';
      return null;
    },
    presets: [
      { label: 'One key too many', values: { keys: [3, 7, 10, 12, 17, 26], m: 3, key: 21 } },
      { label: 'Still room', values: { keys: [3, 7, 10], m: 3, key: 21 } },
      { label: 'One long chain', values: { keys: [0, 2, 4, 6], m: 2, key: 8 } },
      { label: 'Four buckets', values: { keys: [1, 6, 9, 14, 4, 13, 22, 7], m: 4, key: 30 } },
    ],
    counters: ['moves', 'follows', 'allocs'],
    main: (inp) => `int main(void)
{
    int keys[] = { ${inp.keys.length ? inp.keys.join(', ') : '0'} };
    int i;
    for (i = 0; i < ${inp.keys.length}; i++)
        put(keys[i]);
    count = ${inp.keys.length};
    insert(${inp.key});
    return 0;
}`,
    capture(P) {
      const tv = P.find('table');
      const nt = SEE.Types.unqual(SEE.Types.unqual(tv.type).of).to;
      const M = P.ev('M');
      const m = P.val('m');
      const chains = (heads) => heads.map((a) => (a ? P.chain(a, nt, 'next', 30).nodes.map((n) => ({ addr: n.addr, key: n.key, next: n.next })) : []));
      const tableAddr = P.addr('table');
      const inGrow = P.frames[0].name === 'grow';
      const v = (n) => (P.has(n, 0) && P.isSet(n, 0) ? P.val(n, 0) : null);
      const newM = inGrow ? v('new_m') : null;
      let fresh = null;
      if (inGrow && v('fresh')) fresh = P.arr('fresh', newM);
      else if (!inGrow && P.val('buckets') !== tableAddr) fresh = P.arr('buckets', m);
      const old = P.arr('table', M);
      // every entry on the heap, with its fields, whatever chain it is in
      const all = {};
      for (const a of P.blocksOf(nt)) { const f = P.fields(nt, a); all[a] = { addr: a, key: f.key, next: f.next }; }
      return {
        M, m, count: P.val('count'), fn: P.frames[0].name, newM: newM || (fresh ? m : null),
        oldHeads: old, old: chains(old), freshHeads: fresh, fresh: fresh ? chains(fresh) : null, all,
        b: inGrow ? v('b') : null, h: v('h'), e: v('e'), next: inGrow ? v('next') : null,
      };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, memo = ctx.memo;
      const M = d.M, M2 = 2 * M;
      const items = [];
      const pos = new Map();
      const inGrow = d.fn === 'grow';
      // the old table's chains, as they were when grow() began (the pointers inside get reused)
      if (inGrow && !memo.oldLayout) memo.oldLayout = d.old.map((ch) => ch.map((n) => n.addr));
      const moved = new Set();
      if (d.fresh) d.fresh.forEach((ch) => ch.forEach((n) => moved.add(n.addr)));
      const oldLayout = memo.oldLayout || d.old.map((ch) => ch.map((n) => n.addr));
      const deepest = Math.max(1, ...ctx.ticks.map((t) => Math.max(0, ...t.data.old.map((c) => c.length))));
      const Y2 = (deepest + 1) * VSTEP + 125;
      const colX = (c) => c * CW;
      const done = new Set();
      if (inGrow && d.b !== null) for (let b = 0; b < d.b; b++) done.add(b);
      if (memo.oldLayout && !inGrow) for (let b = 0; b < M; b++) done.add(b);
      if (inGrow && tag === 'switch') for (let b = 0; b < M; b++) done.add(b);
      // old table: a row of buckets with chains hanging down
      const showNew = d.fresh !== null;
      items.push({ key: 'tOld', kind: 'text', x: -14, y: -34, text: showNew ? (inGrow ? 'old table: ' + M + ' buckets' : 'old array: no longer used') : 'the table: ' + d.m + ' buckets, ' + d.count + ' keys', cls: 'title' });
      for (let b = 0; b < M; b++) {
        const head = d.oldHeads[b];
        const live = oldLayout[b].filter((a) => !moved.has(a) && d.all[a]);
        const showsPtr = head && !moved.has(head) && d.all[head];
        items.push({ key: 'ob' + b, kind: 'node', x: colX(b), y: 0, w: VW, h: VH, cells: [{ text: showsPtr ? '' : (head ? '' : 'NULL'), port: 'p', cls: 'link' + (showsPtr ? '' : ' null') }], cls: 'bucket' + (inGrow && d.b === b ? ' focus' : done.has(b) ? ' ghost' : ''), labelBelow: false, label: '[' + b + ']' });
        if (showsPtr) items.push({ key: 'oa' + b, kind: 'arrow', from: { key: 'ob' + b, port: 'p' }, to: { key: 'n' + head, side: 'top' }, cls: head === d.e && inGrow && ['rehash', 'relink'].includes(tag) ? 'dim' : '' });
        live.forEach((a, k) => pos.set(a, { x: colX(b), y: VSTEP * (k + 1), side: 'old' }));
      }
      // before grow: the old chains are live, so lay them out straight from memory
      if (!memo.oldLayout) d.old.forEach((ch, b) => ch.forEach((n, k) => pos.set(n.addr, { x: colX(b), y: VSTEP * (k + 1), side: 'old' })));
      // the new table
      if (showNew) {
        items.push({ key: 'tNew', kind: 'text', x: -14, y: Y2 - 34, text: 'new table: ' + M2 + ' buckets', cls: 'title' });
        const cand = inGrow && d.b !== null && d.b < M ? [d.b, d.b + M] : [];
        if (cand.length && tag !== 'switch') for (const c of cand) items.push({ key: 'cand' + (c === cand[0] ? 0 : 1), kind: 'region', x: colX(c) - 8, y: Y2 - 8, w: VW + 16, h: VH + 16 + VSTEP * Math.max(0, d.fresh[c].length), cls: 'hot' });
        for (let c = 0; c < M2; c++) {
          const head = d.freshHeads[c];
          const prevHead = ctx.prev && ctx.prev.data.freshHeads ? ctx.prev.data.freshHeads[c] : head;
          items.push({ key: 'nb' + c, kind: 'node', x: colX(c), y: Y2, w: VW, h: VH, cells: [{ text: head ? '' : 'NULL', port: 'p', cls: 'link' + (head ? '' : ' null') + (prevHead !== head ? ' hot' : '') }], cls: 'bucket' + (d.h === c && inGrow && ['rehash', 'relink', 'move'].includes(tag) ? ' focus' : ''), label: '[' + c + ']', enter: 'grow' });
          d.fresh[c].forEach((n, k) => pos.set(n.addr, { x: colX(c), y: Y2 + VSTEP * (k + 1), side: 'new' }));
          if (head) items.push({ key: 'na' + c, kind: 'arrow', from: { key: 'nb' + c, port: 'p' }, to: { key: 'n' + head, side: 'top' }, cls: prevHead !== head ? 'hot' : '' });
        }
      }
      // the entry in flight: lifted out of its old chain, hovering over the bucket it is going to
      const e = d.e;
      let flying = null;
      if (e && d.all[e] && !pos.has(e)) {
        if (inGrow && d.h !== null && ['rehash', 'relink'].includes(tag)) flying = { x: colX(d.h), y: Y2 - 80 };
        else if (!inGrow) flying = { x: colX(d.h || 0), y: -90 };
      }
      if (inGrow && e && ['rehash', 'relink'].includes(tag) && pos.has(e) && pos.get(e).side === 'old') { pos.delete(e); flying = { x: colX(d.h), y: Y2 - 80 }; }
      if (flying) pos.set(e, Object.assign(flying, { side: 'fly' }));
      // a new entry from insert() that is not linked in yet (e is not set while new_entry's line is pictured)
      if (!inGrow) for (const a of Object.keys(d.all).map(Number)) if (!pos.has(a)) pos.set(a, { x: colX(d.h || 0), y: -90, side: 'fly' });
      // loose new entry from insert(): above its bucket
      for (const [a, at] of pos) {
        const n = d.all[a];
        if (!n) continue;
        let cls = '';
        if ((a === e && inGrow) || (!inGrow && at.side === 'fly') || (a === e && tag === 'link')) cls = 'focus';
        if (at.side === 'new' && !(a === e && tag === 'move')) cls = 'part-a';
        if (at.side === 'old' && done.has(Math.round(at.x / CW))) cls = 'ghost';
        items.push(vNode(n, at.x, at.y, cls, { arc: at.side === 'new' && ctx.prev && ctx.prev.tag === 'relink' ? 0 : 0 }));
      }
      for (const [a] of pos) {
        const n = d.all[a];
        if (!n || !n.next || !pos.has(n.next)) continue;
        const crossing = pos.get(a).side !== pos.get(n.next).side;
        items.push({ key: 'l' + a, kind: 'arrow', from: { key: 'n' + a, port: 'next' }, to: { key: 'n' + n.next, side: 'top' }, cls: a === e && (tag === 'relink' || tag === 'link') ? 'hot' : crossing ? 'dim' : '' });
      }
      if (e && pos.has(e) && (inGrow || tag !== 'after')) items.push({ key: 'ce', kind: 'cursor', at: 'n' + e, side: 'left', text: 'e', cls: 'c-green' });
      if (inGrow && d.next && pos.has(d.next) && d.next !== e) items.push({ key: 'cnx', kind: 'cursor', at: 'n' + d.next, side: 'left', text: 'next', cls: 'c-amber' });
      const fly = flying && d.all[e] ? d.all[e] : null;
      if (fly && inGrow) items.push({ key: 'calc', kind: 'text', x: flying.x + VW + 14, y: flying.y + 23, text: fly.key + ' % ' + d.newM + ' = ' + d.h, cls: 'code-text' });
      // the load factor, top right
      const lf = d.count !== null ? d.count / d.m : 0;
      const rx = colX(Math.max(M, showNew ? M2 : M)) + 10;
      items.push({ key: 'load', kind: 'region', x: rx, y: -10, w: 210, h: 82, cls: 'box', text: 'load factor = keys / buckets' });
      items.push({ key: 'loadt', kind: 'text', x: rx + 105, y: 40, text: d.count + ' / ' + d.m + ' = ' + lf.toFixed(2) + (lf > 2 ? ' > 2' : ' ≤ 2'), cls: lf > 2 ? 'bad' : 'code-text', anchor: 'middle' });
      if (tag === 'hash' || tag === 'new' || tag === 'link' || tag === 'head') items.push({ key: 'hcalc', kind: 'text', x: colX(d.h) + VW / 2, y: -108, text: inp.key + ' % ' + d.m + ' = ' + d.h, cls: 'code-text', anchor: 'middle' });
      const keysOf = (ch) => ch.map((n) => n.key).join(', ');
      const bOld = d.b !== null && d.b < M ? d.b : null;
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert(' + inp.key + ') into a table with ' + d.m + ' buckets and ' + d.count + ' keys. It never searches more than one chain, so the chains must stay short.'; break;
        case 'hash': say = inp.key + ' % ' + d.m + ' = ' + d.h + ': ' + inp.key + ' goes to bucket ' + d.h + '.'; break;
        case 'new': say = 'A new entry for ' + inp.key + ' is made on the heap.'; break;
        case 'link': say = 'Its next points at the current front of bucket ' + d.h + '.'; break;
        case 'head': say = 'buckets[' + d.h + '] points at it: ' + inp.key + ' is in.'; break;
        case 'count': say = 'count goes up to ' + d.count + '.'; break;
        case 'load': say = d.count > 2 * d.m ? d.count + ' keys in ' + d.m + ' buckets is ' + lf.toFixed(2) + ' per bucket, more than MAX_LOAD = 2. The chains are getting long: time to grow.' : d.count + ' keys in ' + d.m + ' buckets is ' + lf.toFixed(2) + ' per bucket, within MAX_LOAD = 2. No need to grow.'; break;
        case 'grow': say = memo.oldLayout ? 'grow() has returned: the table now has ' + d.m + ' buckets and the load factor is ' + lf.toFixed(2) + '.' : 'grow() is called.'; break;
        case 'size': say = 'The new table will have 2 × ' + d.m + ' = ' + d.newM + ' buckets. Doubling means growing happens rarely: each time, the table can hold twice as many keys before the next one.'; break;
        case 'alloc': say = 'calloc makes ' + d.newM + ' empty buckets, all NULL. No entry is copied: the same entries will be relinked into the new table.'; break;
        case 'bucket': say = bOld !== null ? 'Old bucket ' + bOld + (d.old[bOld] && memo.oldLayout[bOld].length ? ' holds ' + memo.oldLayout[bOld].map((a) => d.all[a].key).join(', ') + '. Each of them must go to bucket ' + bOld + ' or ' + (bOld + M) + ' of the new table: key % ' + M + ' = ' + bOld + ' leaves only those two choices for key % ' + M2 + '.' : ' is empty: nothing to move.') : 'Every old bucket has been emptied.'; break;
        case 'start': say = e ? 'e starts at the first entry of old bucket ' + bOld + ', ' + d.all[e].key + '.' : 'Old bucket ' + bOld + ' is empty.'; break;
        case 'walk': say = e ? 'e is at ' + d.all[e].key + ': it still has to move.' : 'e is NULL: old bucket ' + bOld + ' is done.'; break;
        case 'save': say = 'next = e->next, ' + (d.next ? d.all[d.next].key : 'NULL') + '. e\'s next is about to be reused for the new table, so the rest of the old chain must be saved first.'; break;
        case 'rehash': say = 'Re-hash with the new size: ' + d.all[e].key + ' % ' + d.newM + ' = ' + d.h + '. ' + (d.h === bOld ? 'It stays in bucket ' + d.h + '.' : 'It moves from bucket ' + bOld + ' to bucket ' + d.h + '.'); break;
        case 'relink': say = 'e->next = fresh[' + d.h + ']: ' + d.all[e].key + ' now points at ' + (d.fresh[d.h].length ? 'the front of new bucket ' + d.h + ', ' + d.fresh[d.h][0].key : 'NULL, as new bucket ' + d.h + ' is empty') + '.'; break;
        case 'move': say = 'fresh[' + d.h + '] = e: ' + d.all[e].key + ' is at the front of new bucket ' + d.h + ' (' + keysOf(d.fresh[d.h]) + ').'; break;
        case 'follow': say = 'e = next: on to ' + (e ? d.all[e].key : 'NULL, the end of old bucket ' + bOld) + '.'; break;
        case 'switch': say = 'buckets = fresh: from now on the table in use is the new one. The old array of ' + M + ' bucket pointers is no longer used.'; break;
        case 'new-m': say = 'm = ' + d.m + '. ' + d.count + ' keys in ' + d.m + ' buckets: the load factor drops to ' + lf.toFixed(2) + '.'; break;
        case 'after': { const lens = d.fresh ? d.fresh.map((c) => c.length) : d.old.map((c) => c.length); say = 'Done. Chain lengths are now ' + lens.join(', ') + '; the longest is ' + Math.max(...lens) + '. Growing costs one pass over every key, but it happens rarely, so an insert still costs a constant amount on average.'; break; }
      }
      return { items, say, slow: tag === 'move' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'rehash', once: true, ask: (t, ts, i) => 'Which new bucket will ' + ts[i].data.all[ts[i].data.e].key + ' move to? Click it.', answer: (ts, i) => 'nb' + (ts[i].data.all[ts[i].data.e].key % ts[i].data.newM), explain: (ts, i) => { const d = ts[i].data, k = d.all[d.e].key; return k + ' % ' + d.newM + ' = ' + (k % d.newM) + '.'; } },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'load', once: true, ask: 'Is the table too full now? Will grow() be called?', options: () => ['Yes', 'No'], answer: (ts, i) => (ts[i].data.count > 2 * ts[i].data.m ? 'Yes' : 'No'), pick: 'option', explain: (ts, i) => ts[i].data.count + ' keys in ' + ts[i].data.m + ' buckets: compare ' + ts[i].data.count + ' with 2 × ' + ts[i].data.m + ' = ' + 2 * ts[i].data.m + '.' },
    ],
    quiz: [
      { q: 'Why can entries not stay in the same bucket numbers when the table doubles?', options: ['They can', 'The bucket is key % m, and m has changed', 'The keys change', 'calloc moves them'], answer: 1, why: 'A lookup in the new table computes key % 2m. An entry left where key % m put it would not be found.' },
      { q: 'With M = 3 growing to 6, where can the entries of old bucket 1 go?', options: ['Anywhere', 'Bucket 1 or bucket 4', 'Only bucket 1', 'Bucket 2 or 3'], answer: 1, why: 'key % 3 = 1 means key % 6 is 1 or 4: the chain splits in two.' },
      { q: 'Why save next = e->next before relinking e?', options: ['It is faster', 'e->next is overwritten to join the new chain, so the rest of the old chain would be lost', 'To free it', 'It is not needed'], answer: 1, why: 'Once e->next points into the new table, the only way to the rest of the old chain is the saved copy.' },
      { q: 'Why double the size rather than add one bucket?', options: ['Doubling uses less memory', 'Each grow is then followed by many cheap inserts, so the average cost per insert stays constant', 'One bucket is not allowed', 'Doubling keeps keys sorted'], answer: 1, why: 'Growing touches every key. Doubling makes it rare enough that the cost spread over all inserts is a constant.' },
      { q: 'After a grow, what happens to the order of a chain that stays together?', options: ['It stays the same', 'It is reversed, because entries are pushed onto the front', 'It is sorted', 'It is random'], answer: 1, why: 'Entries are taken from the front of the old chain and pushed onto the front of the new one, so their order flips.' },
    ],
  });
})(SEE);
