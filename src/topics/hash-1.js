// Hashing: separate chaining, insert and search.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, H = X.HashKit;

  X.family({
    id: 'chain', order: 1, group: 'Hashing', title: 'Hash tables with chaining',
    blurb: 'A hash function turns a key into a bucket number; each bucket keeps a short linked list of the keys that landed there.',
    head: (t, inp) => `#include <stdio.h>
#include <stdlib.h>

#define M ${inp.m}

/* one entry in a bucket's chain */
struct entry {
    int key;
    struct entry *next;
};

/* the table: M buckets, each the head of a chain (NULL when empty) */
struct entry *table[M];

/* which bucket a key belongs to */
int hash(int key)
{
    return key % M;
}

struct entry *new_entry(int key)
{
    struct entry *e = malloc(sizeof *e);
    e->key = key;
    e->next = NULL;
    return e;
}

/* main uses this to fill the table before the animation starts */
void put(int key)
{
    struct entry *e = new_entry(key);
    e->next = table[hash(key)];
    table[hash(key)] = e;
}`,
  });
  X.chainMain = (inp, call) => `int main(void)
{
    int keys[] = { ${inp.keys.length ? inp.keys.join(', ') : '0'} };
    int i;
    for (i = 0; i < ${inp.keys.length}; i++)
        put(keys[i]);
    ${call}
    return 0;
}`;
  const keysIn = { id: 'keys', kind: 'ints', label: 'Keys already in the table', def: [15, 8, 22, 29, 3, 11, 40], min: 0, max: 14, distinct: true, check: (v) => (v.some((x) => x < 0) ? 'Keys: 0 or more' : null) };
  const mIn = { id: 'm', kind: 'int', label: 'Buckets (M)', def: 7, lo: 1, hi: 13 };
  const presets = (k) => [
    { label: 'Some collisions', values: { keys: [15, 8, 22, 29, 3, 11, 40], m: 7, key: k } },
    { label: 'Everything collides', values: { keys: [7, 14, 21, 28, 35], m: 7, key: 42 } },
    { label: 'No collisions', values: { keys: [1, 2, 3, 4, 5], m: 7, key: 6 } },
    { label: 'An empty table', values: { keys: [], m: 7, key: k } },
  ];

  // ---- insert ----------------------------------------------------------------------------------------------
  X.topic({
    id: 'chain-insert', family: 'chain', order: 10, title: 'Insert with chaining',
    blurb: 'Hash the key to find its bucket, then push it onto the front of that bucket\'s chain: no searching, no shifting.',
    code: `/* add key to the table (at the front of its bucket's chain) */
void insert(int key)
{
    int h = hash(key);                    /*@ hash */
    struct entry *e = new_entry(key);     /*@ new */
    e->next = table[h];                   /*@ link */
    table[h] = e;                         /*@ head */
}`,
    animate: ['insert'], quiet: ['hash', 'new_entry'],
    inputs: [keysIn, mIn, { id: 'key', kind: 'int', label: 'Insert', def: 36, lo: 0, hi: 999 }],
    check: (inp) => (inp.keys.includes(inp.key) ? 'That key is already in the table' : null),
    presets: presets(36),
    counters: ['allocs', 'writes'],
    main: (inp) => X.chainMain(inp, 'insert(' + inp.key + ');'),
    capture: (P) => Object.assign(H.captureChains(P, { m: P.ev('M') || 7, cursors: ['e'] }), { h: P.isSet('h', 0) ? P.val('h', 0) : null }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const h = d.h;
      const pic = H.chains(ctx, d, { bucketCls: (b) => (b === h ? 'focus' : ''), nodeCls: (n) => (n.addr === d.cursors.e ? 'part-b' : '') });
      const items = pic.items.concat(H.box(inp.key, inp.m, h, { x: 0, y: -120 }));
      if (h !== null) items.push({ key: 'hl', kind: 'arrow', from: { x: -120, y: 15 }, to: { key: 'bk' + h, side: 'left' }, cls: 'hot', bend: 20 });
      if (d.cursors.e) items.push({ key: 'ce', kind: 'cursor', at: 'n' + d.cursors.e, side: 'above', text: 'e', cls: 'c-green' });
      const chain = h !== null ? d.buckets[h].nodes.map((n) => n.key) : [];
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert(' + inp.key + '): first find which of the ' + inp.m + ' buckets it belongs to.'; break;
        case 'hash': say = 'hash(' + inp.key + ') = ' + inp.key + ' % ' + inp.m + ' = ' + h + '. Every lookup of this key will come straight to bucket ' + h + '.'; break;
        case 'new': say = 'A new entry for ' + inp.key + ' is made on the heap. Bucket ' + h + ' already holds ' + (chain.length ? chain.length + ' key' + (chain.length === 1 ? '' : 's') + ' (' + chain.join(', ') + '): a collision, and the chain will just get longer.' : 'nothing.'); break;
        case 'link': say = 'The new entry\'s next points at the current front of the chain' + (chain.length ? ' (' + chain[0] + ')' : ', NULL') + '. Nothing is lost.'; break;
        case 'head': say = 'table[' + h + '] now points at the new entry: it is the first in its chain. Inserting at the front takes the same time however long the chain is.'; break;
        case 'after': { const tot = d.buckets.reduce((a, b) => a + b.nodes.length, 0); say = 'The table holds ' + tot + ' keys in ' + inp.m + ' buckets: a load factor of ' + (tot / inp.m).toFixed(2) + '. The longer the chains, the slower a search.'; break; }
      }
      return { items, say, slow: tag === 'head' };
    },
    predict: [{ at: (t) => t.tag === 'enter', once: true, ask: (t, ts, i, ctx) => 'Which bucket will ' + ctx.input.key + ' go to? Click it.', answer: (ts, i, ctx) => 'bk' + (ctx.input.key % ctx.input.m), explain: (ts, i, ctx) => ctx.input.key + ' % ' + ctx.input.m + ' = ' + (ctx.input.key % ctx.input.m) + '.' }],
    quiz: [
      { q: 'Why insert at the front of the chain instead of the end?', options: ['It keeps the chain sorted', 'It takes the same short time whatever the chain\'s length', 'The end is not allowed', 'It saves memory'], answer: 1, why: 'Reaching the end means walking the chain; the front is right there in table[h].' },
      { q: 'With M = 7, which keys collide with 15?', options: ['16 and 17', '8 and 22', '5 and 25', 'None'], answer: 1, why: '15 % 7 = 1, and 8 % 7 = 1, 22 % 7 = 1.' },
      { q: 'What is the load factor of 21 keys in 7 buckets?', options: ['0.33', '3', '7', '21'], answer: 1, why: 'Keys divided by buckets: 21 / 7 = 3 keys per chain on average.' },
    ],
  });

  // ---- search ----------------------------------------------------------------------------------------------
  X.topic({
    id: 'chain-search', family: 'chain', order: 20, title: 'Search with chaining',
    blurb: 'Hash the key, go straight to its bucket, and chase the chain one pointer at a time until the key turns up or the chain ends.',
    code: `/* the entry holding key, or NULL if it is not in the table */
struct entry *search(int key)
{
    int h = hash(key);                    /*@ hash */
    struct entry *p = table[h];           /*@ start */
    while (p != NULL) {                   /*@ walk */
        if (p->key == key)                /*@ compare */
            return p;                     /*@ found */
        p = p->next;                      /*@ follow */
    }
    return NULL;                          /*@ missing */
}`,
    animate: ['search'], quiet: ['hash'],
    inputs: [keysIn, mIn, { id: 'key', kind: 'int', label: 'Search for', def: 8, lo: 0, hi: 999 }],
    presets: [
      { label: 'Found deep in a chain', values: { keys: [15, 8, 22, 29, 3, 11, 40], m: 7, key: 8 } },
      { label: 'Found at the front', values: { keys: [15, 8, 22, 29, 3, 11, 40], m: 7, key: 29 } },
      { label: 'Not there', values: { keys: [15, 8, 22, 29, 3, 11, 40], m: 7, key: 36 } },
      { label: 'Empty bucket', values: { keys: [15, 8, 22, 29, 3, 11, 40], m: 7, key: 13 } },
    ],
    counters: ['compares', 'follows'],
    main: (inp) => X.chainMain(inp, 'search(' + inp.key + ');'),
    capture: (P) => Object.assign(H.captureChains(P, { m: P.ev('M') || 7, cursors: ['p'] }), { h: P.isSet('h', 0) ? P.val('h', 0) : null }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const h = d.h, p = d.cursors.p;
      const memo = ctx.memo;
      memo.seen = memo.seen || new Set();
      if (tag === 'compare' && p) memo.seen.add(p);
      const by = new Map(d.buckets.flatMap((b) => b.nodes).map((n) => [n.addr, n]));
      const pic = H.chains(ctx, d, {
        bucketCls: (b) => (b === h ? 'focus' : h !== null ? 'ghost' : ''),
        nodeCls: (n, b) => (n.addr === p && tag === 'found' ? 'part-a' : memo.seen.has(n.addr) && n.addr !== p ? 'ghost' : h !== null && b !== h ? 'ghost' : ''),
      });
      const items = pic.items.concat(H.box(inp.key, inp.m, h, { x: 0, y: -120 }));
      if (h !== null) items.push({ key: 'hl', kind: 'arrow', from: { x: -120, y: 15 }, to: { key: 'bk' + h, side: 'left' }, cls: 'hot', bend: 20 });
      // the chaser: a token that sits on the entry p points at
      if (p && pic.pos.has(p) && tag !== 'after') {
        const at = pic.pos.get(p);
        items.push({ key: 'chaser', kind: 'token', x: at.x + 46, y: at.y - 18, r: 14, text: String(inp.key), cls: 'c-rose' });
        if (tag === 'compare' || tag === 'found' || tag === 'follow') {
          const hit = by.get(p) && by.get(p).key === inp.key;
          items.push({ key: 'mark', kind: 'text', x: at.x + 46, y: at.y + 64, text: hit ? '✓ ' + inp.key + ' = ' + by.get(p).key : '✗ ' + inp.key + ' ≠ ' + (by.get(p) || {}).key, cls: hit ? 'good' : 'bad', anchor: 'middle' });
        }
      }
      if (p !== undefined) items.push(...(p && pic.pos.has(p) ? [{ key: 'cp', kind: 'cursor', at: 'n' + p, side: 'below', text: 'p', cls: 'c-teal' }] : []));
      const nm = (a) => (a && by.has(a) ? by.get(a).key : 'NULL');
      let say = '';
      switch (tag) {
        case 'enter': say = 'search(' + inp.key + '): there is no need to look at every key, only at one bucket.'; break;
        case 'hash': say = inp.key + ' % ' + inp.m + ' = ' + h + ': if ' + inp.key + ' is anywhere, it is in bucket ' + h + '. The other buckets are never looked at.'; break;
        case 'start': say = p ? 'p starts at the front of bucket ' + h + '\'s chain: ' + nm(p) + '.' : 'Bucket ' + h + ' is empty: table[' + h + '] is NULL.'; break;
        case 'walk': say = p ? 'p points at an entry (' + nm(p) + '), so compare it.' : 'p is NULL: the chain has ended.'; break;
        case 'compare': say = 'Is ' + nm(p) + ' the key we want? ' + (by.get(p) && by.get(p).key === inp.key ? 'Yes.' : 'No, ' + nm(p) + ' only landed in the same bucket.'); break;
        case 'found': say = 'Found ' + inp.key + ' after ' + memo.seen.size + ' comparison' + (memo.seen.size === 1 ? '' : 's') + '. search() returns its address.'; break;
        case 'follow': say = 'Chase the pointer: p = p->next, to ' + nm(p) + '.'; break;
        case 'missing': say = inp.key + ' is not in the table: the whole chain of bucket ' + h + ' was checked (' + memo.seen.size + ' entr' + (memo.seen.size === 1 ? 'y' : 'ies') + ') and nothing else needed to be.'; break;
        case 'after': say = 'One hash, then ' + memo.seen.size + ' comparison' + (memo.seen.size === 1 ? '' : 's') + '. With short chains, a search costs about the same however big the table gets.'; break;
      }
      return { items, say };
    },
    predict: [{ at: (t) => t.tag === 'start', once: true, ask: 'How many entries will be compared before this search ends?', options: () => ['0', '1', '2', '3', '4'], answer: (ts) => String(ts.filter((t) => t.tag === 'compare').length), pick: 'option', explain: () => 'Only the entries of this one bucket, until the key is found or the chain ends.' }],
    quiz: [
      { q: 'A search for a key that is not there checks...', options: ['Every key in the table', 'Every entry in one bucket\'s chain', 'Only the first entry', 'Nothing'], answer: 1, why: 'The key could only be in its own bucket, so the whole chain of that bucket, and nothing else.' },
      { q: 'If every key hashes to the same bucket, a search takes...', options: ['Constant time', 'Time proportional to the number of keys', 'log n time', 'No time'], answer: 1, why: 'It becomes a search through one long linked list.' },
      { q: 'What does p = p->next do?', options: ['Deletes p', 'Moves p to the following entry in the chain', 'Moves to the next bucket', 'Copies the key'], answer: 1, why: 'It follows the arrow from the current entry to the next one in the same chain.' },
    ],
  });
})(SEE);
