// B-trees: the family, search, insert (proactive splitting) and delete (borrow and merge).
(function (SEE) {
  'use strict';
  const X = SEE.Strux, B = X.BTreeKit;

  // the insertion code: shown and animated in btree-insert, used quietly by main in the other topics
  const INSERT = `/* a node is full when it holds MAX keys */
int is_full(struct bnode *x)
{
    return x->n == MAX;
}

/* x->child[i] is full: split it in two around its middle key,
   and move that middle key up into x (x has room for it) */
void split_child(struct bnode *x, int i)
{
    struct bnode *y = x->child[i];               /*@ split-y */
    struct bnode *z = new_node(y->leaf);         /*@ split-z */
    int j;
    z->n = T - 1;                                /*@ z-size */
    for (j = 0; j < T - 1; j++)                  /*@ loop-keys */
        z->key[j] = y->key[j + T];               /*@ move-key */
    if (!y->leaf)                                /*@ inner */
        for (j = 0; j < T; j++)                  /*@ loop-kids */
            z->child[j] = y->child[j + T];       /*@ move-child */
    y->n = T - 1;                                /*@ y-size */
    for (j = x->n; j > i; j--)                   /*@ loop-ptrs */
        x->child[j + 1] = x->child[j];           /*@ shift-child */
    x->child[i + 1] = z;                         /*@ link-z */
    for (j = x->n - 1; j >= i; j--)              /*@ loop-room */
        x->key[j + 1] = x->key[j];               /*@ shift-key */
    x->key[i] = y->key[T - 1];                   /*@ rise */
    x->n++;                                      /*@ x-size */
}

/* put k into the subtree of x, a node that is not full */
void insert_nonfull(struct bnode *x, int k)
{
    int i = x->n - 1;                            /*@ last */
    while (!x->leaf) {                           /*@ inner-test */
        while (i >= 0 && k < x->key[i])          /*@ compare */
            i--;                                 /*@ left */
        i++;                                     /*@ gap */
        if (is_full(x->child[i])) {               /*@ full-test */
            split_child(x, i);                   /*@ split */
            if (k > x->key[i])                   /*@ which-half */
                i++;                             /*@ right-half */
        }
        x = x->child[i];                         /*@ follow */
        i = x->n - 1;                            /*@ last */
    }
    while (i >= 0 && k < x->key[i]) {            /*@ compare-leaf */
        x->key[i + 1] = x->key[i];               /*@ shift-right */
        i--;                                     /*@ left */
    }
    x->key[i + 1] = k;                           /*@ place */
    x->n++;                                      /*@ count */
}

/* add k to the tree; returns the root, which is new when the old root was full */
struct bnode *insert(struct bnode *root, int k)
{
    struct bnode *s;
    if (is_full(root)) {                         /*@ root-full */
        s = new_node(0);                         /*@ new-root */
        s->child[0] = root;                      /*@ adopt */
        split_child(s, 0);                       /*@ split-root */
        insert_nonfull(s, k);                    /*@ descend */
        return s;                                /*@ taller */
    }
    insert_nonfull(root, k);                     /*@ descend */
    return root;                                 /*@ same-root */
}`;

  X.family({
    id: 'btree', order: 3, group: 'Balanced trees', title: 'B-trees',
    blurb: 'Wide nodes holding several sorted keys, with a child between every two. All leaves are on the same level, so the tree is always short.',
    head: (t, inp) => `#include <stdio.h>
#include <stdlib.h>

#define T ${inp.t || 2}                 /* minimum degree: a node other than the root has at least T - 1 keys */
#define MAX (2 * T - 1)     /* and at most MAX keys */

/* a B-tree node: n keys in increasing order and, unless it is a leaf, n + 1 children;
   child[i] holds the keys between key[i - 1] and key[i] */
struct bnode {
    int n;
    int leaf;
    int key[MAX];
    struct bnode *child[MAX + 1];
};

struct bnode *new_node(int leaf)
{
    struct bnode *x = malloc(sizeof *x);
    int i;
    x->n = 0;
    x->leaf = leaf;
    for (i = 0; i <= MAX; i++)
        x->child[i] = NULL;
    return x;
}${t.id === 'btree-insert' ? '' : '\n\n/* main uses these to build the tree you chose (the B-tree insert topic animates them) */\n' + INSERT}`,
  });

  X.btreeKeys = { id: 'keys', kind: 'ints', label: 'Keys, inserted in this order', def: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35, 45], min: 0, max: 15, distinct: true, check: (v) => (v.some((x) => x < 1 || x > 999) ? 'Keys: from 1 to 999' : null) };
  X.btreeT = { id: 't', kind: 'int', label: 'Minimum degree t', def: 2, lo: 2, hi: 3 };
  X.btreeMain = (inp, call, decl) => `int main(void)
{
    int keys[] = { ${inp.keys.length ? inp.keys.join(', ') : '0'} };
    struct bnode *root = new_node(1);
    int i;
${decl ? decl.map((d) => '    ' + d + '\n').join('') : ''}    for (i = 0; i < ${inp.keys.length}; i++)
        root = insert(root, keys[i]);
${call}
    return 0;
}`;

  // A JavaScript copy of the insertion, to describe trees in presets and checks
  X.btreeBuild = function (keys, t) {
    const MAX = 2 * t - 1;
    const node = (leaf) => ({ leaf, key: [], child: [] });
    const split = (x, i) => {
      const y = x.child[i], z = node(y.leaf);
      z.key = y.key.slice(t);
      if (!y.leaf) z.child = y.child.slice(t);
      const mid = y.key[t - 1];
      y.key = y.key.slice(0, t - 1);
      if (!y.leaf) y.child = y.child.slice(0, t);
      x.child.splice(i + 1, 0, z);
      x.key.splice(i, 0, mid);
    };
    let root = node(true);
    for (const k of keys) {
      if (root.key.length === MAX) { const s = node(false); s.child = [root]; split(s, 0); root = s; }
      let x = root;
      for (;;) {
        let i = x.key.length - 1;
        while (i >= 0 && k < x.key[i]) i--;
        i++;
        if (x.leaf) { x.key.splice(i, 0, k); break; }
        if (x.child[i].key.length === MAX) { split(x, i); if (k > x.key[i]) i++; }
        x = x.child[i];
      }
    }
    return root;
  };
  X.btreeHeight = (r) => { let h = 1; while (!r.leaf) { r = r.child[0]; h++; } return h; };

  const gapName = (n, i) => (!n || !n.n ? 'the only child' : i <= 0 ? 'left of ' + n.key[0] : i >= n.n ? 'right of ' + n.key[n.n - 1] : 'between ' + n.key[i - 1] + ' and ' + n.key[i]);
  const keysOf = (n) => (n && n.n ? n.key.slice(0, n.n).join(', ') : 'no keys');
  const plural = (k, w, ws) => k + ' ' + (k === 1 ? w : ws || w + 's');
  const capOf = (inp) => 2 * (inp.t || 2) - 1;

  // ---- search ------------------------------------------------------------------------------------------------
  X.topic({
    id: 'btree-search', family: 'btree', order: 10, title: 'Search',
    blurb: 'Inside a node, scan the keys from the left until one is not smaller than the key you want; then either it is that key, or you go down the pointer just before it.',
    code: `/* find k: the node holding it (its index goes into *pos), or NULL */
struct bnode *search(struct bnode *x, int k, int *pos)
{
    int i;
    for (;;) {
        i = 0;                                  /*@ start */
        while (i < x->n && k > x->key[i])       /*@ compare */
            i++;                                /*@ next-key */
        if (i < x->n && k == x->key[i]) {       /*@ test-key */
            *pos = i;                           /*@ found */
            return x;                           /*@ return */
        }
        if (x->leaf)                            /*@ leaf */
            return NULL;                        /*@ missing */
        x = x->child[i];                        /*@ follow */
    }
}`,
    animate: ['search'],
    inputs: [X.btreeKeys, X.btreeT, { id: 'key', kind: 'int', label: 'Search for', def: 45, lo: 1, hi: 999 }],
    presets: [
      { label: 'Found in a leaf', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35, 45], t: 2, key: 35 } },
      { label: 'Found in the root', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35, 45], t: 2, key: 40 } },
      { label: 'Not in the tree', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35, 45], t: 2, key: 77 } },
      { label: 't = 3: wider and shorter', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35, 45, 55, 65], t: 3, key: 65 } },
      { label: 'An empty tree', values: { keys: [], t: 2, key: 12 } },
    ],
    counters: ['compares', 'follows'],
    main: (inp) => X.btreeMain(inp, `    where = search(root, ${inp.key}, &pos);
    if (where != NULL)
        printf("found %d at index %d of its node\\n", ${inp.key}, pos);
    else
        printf("%d is not in the tree\\n", ${inp.key});`, ['struct bnode *where;', 'int pos;']),
    capture: (P) => B.capture(P, { type: ['x', 'root'], root: 'root', cursors: ['x'], extra: (P) => ({ i: P.has('i', 0) && P.isSet('i', 0) ? P.val('i', 0) : null }) }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, k = ctx.input.key, memo = ctx.memo;
      const x = d.cursors.x, i = d.extra.i;
      memo.path = memo.path || [];
      if (tag === 'start' && x && !memo.path.includes(x)) memo.path.push(x);
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      const xn = by.get(x);
      const done = tag === 'found' || tag === 'return' || (tag === 'after' && memo.hit);
      if (tag === 'found') memo.hit = true;
      const onPath = new Set(memo.path);
      const pic = B.picture(ctx, d, {
        cap: capOf(ctx.input),
        frameCls: (n) => (n.addr === x && tag !== 'after' ? 'focus' : onPath.has(n.addr) ? 'path' : memo.path.length > 1 ? 'faded' : ''),
        keyCls: (n, j, v) => {
          if (v === k && (done || (n.addr === x && tag === 'test-key' && j === i))) return 'good';
          if (n.addr === x && j === i && ['compare', 'test-key'].includes(tag)) return 'hot';
          if (n.addr === x && i !== null && j < i && tag !== 'after') return 'faded';
          return '';
        },
        edgeCls: (a, c) => (onPath.has(a) && onPath.has(c) ? 'path' : ''),
      });
      const items = pic.items;
      // the key being looked for travels above the slot it is compared with
      if (xn && pic.pos.has(x) && !['after', 'found', 'return'].includes(tag)) {
        const p = pic.pos.get(x);
        const j = i === null ? 0 : Math.max(0, Math.min(i, capOf(ctx.input)));
        const tx = p.x + (i !== null && i >= xn.n ? B.ptrX(j, xn.leaf) - B.KW / 2 + B.pw(xn.leaf) / 2 : B.slotX(j, xn.leaf));
        items.push({ key: 'tok', kind: 'cell', x: tx + 2, y: p.y - 48, w: B.KW - 4, h: B.KH - 4, text: k, cls: 'mw-key mw-carry' });
        let note = '';
        if (tag === 'compare') note = i < xn.n ? (k > xn.key[i] ? k + ' > ' + xn.key[i] + ': go on' : k + ' ≤ ' + xn.key[i] + ': stop') : 'no keys left';
        if (tag === 'test-key') note = i < xn.n && xn.key[i] === k ? k + ' = ' + k : i < xn.n ? k + ' ≠ ' + xn.key[i] : 'not in this node';
        if (tag === 'leaf' || tag === 'follow' || tag === 'missing') note = tag === 'missing' ? '✗ nowhere to go' : 'down ' + gapName(xn, i);
        if (note) items.push({ key: 'note', kind: 'text', x: tx + B.KW + 6, y: p.y - 27, text: note, cls: tag === 'missing' ? 'bad' : 'mw-tag' });
      }
      if (xn && i !== null && pic.pos.has(x) && tag !== 'after') items.push(B.index('i', x, Math.min(i, xn.n), tag === 'leaf' || tag === 'follow' || tag === 'missing' || i >= xn.n));
      let say = '';
      const kn = (j) => (xn && j < xn.n ? xn.key[j] : null);
      switch (tag) {
        case 'enter': say = 'search(root, ' + k + '): start at the root. In every node, the keys are in order and the children sit between them.'; break;
        case 'start': say = 'A new node with keys ' + keysOf(xn) + '. i = 0: scan from its first key.'; break;
        case 'compare':
          if (i < xn.n && k > kn(i)) say = 'Compare ' + k + ' with ' + kn(i) + ': ' + k + ' is bigger, so it is not here and not in the child to the left of ' + kn(i) + '. Keep going right.';
          else if (i < xn.n) say = 'Compare ' + k + ' with ' + kn(i) + ': not bigger. The scan stops: ' + k + ' is either ' + kn(i) + ' itself or somewhere in the child just to its left.';
          else say = 'i = ' + i + ', which is n: ' + k + ' is bigger than every key in this node, so only the last child can hold it.';
          break;
        case 'next-key': say = 'i = ' + i + ': one slot to the right.'; break;
        case 'test-key': say = i < xn.n && kn(i) === k ? 'key[' + i + '] is ' + k + ': this is the key.' : i < xn.n ? 'key[' + i + '] is ' + kn(i) + ', not ' + k + '. ' + k + ' is not in this node.' : 'There is no key[' + i + '] to match: ' + k + ' is not in this node.'; break;
        case 'found': say = 'Found ' + k + ' at index ' + i + ' of this node. *pos = ' + i + ' tells the caller where.'; break;
        case 'return': say = 'search() returns the node, after looking at ' + plural(memo.path.length, 'node') + '.'; break;
        case 'leaf': say = xn.leaf ? 'This node is a leaf: there is no child ' + gapName(xn, i) + ' to look in.' : 'Not a leaf, so ' + k + ' may be further down: in child ' + i + ', the subtree ' + gapName(xn, i) + '.'; break;
        case 'missing': say = k + ' is not in the tree. The search went down ' + plural(memo.path.length, 'level') + ' and every level had only one node to look at.'; break;
        case 'follow': say = 'x = x->child[' + memo.lastI + ']: down one level, to the node with keys ' + keysOf(xn) + '.'; break;
        case 'after': say = (memo.hit ? 'Found ' + k : k + ' was not found') + ' after visiting ' + plural(memo.path.length, 'node') + ' and ' + plural(ctx.counters.compares, 'key comparison') + '. Wide nodes keep the tree short: ' + d.nodes.filter((n) => !n.freed).reduce((a, n) => a + n.n, 0) + ' keys, only ' + (pic.lay.height) + ' level' + (pic.lay.height === 1 ? '' : 's') + '.'; break;
      }
      if (tag === 'leaf' || tag === 'test-key') memo.lastI = i;
      return { items, say, slow: tag === 'found' || tag === 'follow' };
    },
    predict: [
      {
        at: (t, i, ts) => { if (t.tag !== 'start') return false; for (let j = i + 1; j < ts.length; j++) { if (ts[j].tag === 'follow') return true; if (ts[j].tag === 'start' || ts[j].tag === 'found') return false; } return false; },
        once: true,
        ask: (t, ts, i, ctx) => 'Which pointer of this node will the search for ' + ctx.input.key + ' go down?',
        options: (ts, i) => { const d = ts[i].data, n = d.nodes.find((m) => m.addr === d.cursors.x); const o = []; for (let j = 0; j <= n.n; j++) o.push(gapName(n, j)); return o; },
        answer: (ts, i) => { let j = i + 1; while (ts[j].tag !== 'leaf') j++; const d = ts[i].data, n = d.nodes.find((m) => m.addr === d.cursors.x); return gapName(n, ts[j].data.extra.i); },
        pick: 'option',
        explain: () => 'The scan stops at the first key that is not smaller; the pointer just before that key leads to every key in that range.',
      },
      {
        at: (t) => t.tag === 'enter', once: true,
        ask: 'How many nodes will this search look at?',
        options: () => ['1', '2', '3', '4'],
        answer: (ts) => String(Math.min(4, ts.filter((t) => t.tag === 'start').length)),
        pick: 'option',
        explain: () => 'One node per level, from the root down to the node holding the key or to a leaf.',
      },
    ],
    quiz: [
      { q: 'Inside one node with keys 20, 40, 60, where does a search for 50 go?', options: ['It stops: 50 is not here', 'Down the pointer between 40 and 60', 'Down the pointer right of 60', 'Down the pointer left of 20'], answer: 1, why: '50 > 20 and 50 > 40 but 50 < 60, so the scan stops at 60 and goes down the pointer just before it.' },
      { q: 'Why are B-trees used for data on disk?', options: ['They use less memory', 'Each node read brings many keys, and the tree is very short, so few reads are needed', 'They need no comparisons', 'They keep keys unsorted'], answer: 1, why: 'Reading a node is the expensive part. With hundreds of keys per node, even a huge tree is three or four levels deep.' },
      { q: 'A search for a key that is not in the tree ends...', options: ['At the root', 'In a leaf, always', 'In any node', 'It never ends'], answer: 1, why: 'It only stops early when it finds the key; otherwise it goes down until a leaf has no child to offer.' },
      { q: 'How many comparisons can one node cost with t = 2 (at most 3 keys)?', options: ['1', 'Up to 3 for the scan, plus the equality test', 'Always 3', '7'], answer: 1, why: 'A linear scan looks at up to all 3 keys before it stops. Large nodes often use binary search inside instead.' },
      { q: 'With t = 3, a non-root node has between ... keys.', options: ['1 and 3', '2 and 5', '3 and 6', '0 and 5'], answer: 1, why: 'At least t - 1 = 2 and at most 2t - 1 = 5.' },
    ],
  });
  // ---- insert --------------------------------------------------------------------------------------------------
  X.topic({
    id: 'btree-insert', family: 'btree', order: 20, title: 'Insert (splitting on the way down)',
    blurb: 'Keys always go into a leaf. A full node met on the way down is split first: its middle key rises into the parent, and a full root makes the whole tree one level taller.',
    code: INSERT,
    animate: ['is_full', 'insert'], quiet: ['is_full', 'new_node'],
    inputs: [X.btreeKeys, X.btreeT, { id: 'key', kind: 'int', label: 'Insert', def: 85, lo: 1, hi: 999 }],
    check: (inp) => (inp.keys.includes(inp.key) ? 'That key is already in the tree; pick another' : null),
    presets: [
      { label: 'A full leaf splits', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35, 45], t: 2, key: 85 } },
      { label: 'The root splits: the tree grows', values: { keys: [10, 20, 30, 40, 50, 60, 70, 15, 25, 35, 45], t: 2, key: 33 } },
      { label: 'Room in the leaf', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35, 45], t: 2, key: 47 } },
      { label: 'Into an empty tree', values: { keys: [], t: 2, key: 42 } },
      { label: 't = 3: five keys per node', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35, 45, 55, 65], t: 3, key: 52 } },
    ],
    counters: ['compares', 'moves', 'allocs'],
    main: (inp) => `int main(void)
{
    int keys[] = { ${inp.keys.length ? inp.keys.join(', ') : '0'} };
    struct bnode *root = new_node(1);
    struct bnode *s;
    int i;
    /* build the starting tree quietly, with the same steps insert() takes */
    for (i = 0; i < ${inp.keys.length}; i++) {
        if (is_full(root)) {
            s = new_node(0);
            s->child[0] = root;
            split_child(s, 0);
            root = s;
        }
        insert_nonfull(root, keys[i]);
    }
    root = insert(root, ${inp.key});
    return 0;
}`,
    capture: (P) => B.capture(P, {
      type: ['x', 'root'], root: 'root', cursors: ['x', 'y', 'z', 's'],
      extra: (P) => ({ i: P.has('i', 0) && P.isSet('i', 0) ? P.val('i', 0) : null, j: P.has('j', 0) && P.isSet('j', 0) ? P.val('j', 0) : null, fn: P.frames[0].name }),
    }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, k = ctx.input.key, memo = ctx.memo, inp = ctx.input;
      const cap = capOf(inp), T = inp.t || 2;
      const c = Object.assign({}, d.cursors), i = d.extra.i, fn = d.extra.fn;
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      const inSplit = fn === 'split_child';
      // a line that calls new_node() is drawn as soon as new_node() returns, before the assignment
      const fresh = ctx.prev && ctx.prev.data ? d.nodes.find((n) => !ctx.prev.data.nodes.some((m) => m.addr === n.addr)) : null;
      if (tag === 'split-z' && !c.z && fresh) c.z = fresh.addr;
      if (tag === 'new-root' && !c.s && fresh) c.s = fresh.addr;
      const x = c.x, xn = by.get(x), yn = inSplit ? by.get(c.y) : null, zn = inSplit ? by.get(c.z) : null;
      memo.splits = memo.splits || 0;
      if (tag === 'split-y') { memo.splits++; memo.mid = yn ? yn.key[T - 1] : null; memo.yAddr = c.y; }
      if (tag === 'enter') memo.tok = null;
      const placed = d.nodes.some((n) => !n.freed && n.key.slice(0, n.n).includes(k)) || tag === 'place';
      const pic = B.picture(ctx, d, {
        cap,
        orphan: (n) => (inSplit && n.addr === c.z ? { after: c.y } : n.addr === c.s ? { above: true } : null),
        frameCls: (n) => {
          if (inSplit && n.addr === c.z) return 'newbie';
          if (inSplit && n.addr === c.y) return tag === 'split-y' ? 'full' : 'path';
          if (n.addr === x && tag !== 'after') return 'focus';
          if ((tag === 'root-full' && n.addr === d.root && n.n === cap) || (tag === 'full-test' && xn && !xn.leaf && i !== null && n.addr === xn.child[i] && n.n === cap)) return 'full';
          if (n.addr === c.s && fn === 'insert') return 'newbie';
          return '';
        },
        keyCls: (n, j, v) => {
          if (v === k) return placed && tag !== 'after' ? 'good' : '';
          if (inSplit && v === memo.mid && ['rise', 'x-size'].includes(tag)) return 'rise';
          if (tag === 'shift-right' && n.addr === x && j === i + 1) return 'hot';
          if ((tag === 'compare' || tag === 'compare-leaf') && n.addr === x && j === i) return 'hot';
          if (inSplit && tag === 'move-key' && n.addr === c.z && j === d.extra.j) return 'hot';
          if (inSplit && tag === 'shift-key' && n.addr === x && j === d.extra.j + 1) return 'hot';
          return '';
        },
      });
      const items = pic.items;
      // the middle key between y->n = T - 1 and its rise: no longer counted in y, not yet in x
      if (inSplit && memo.mid !== null && !items.some((it) => it.key === 'k' + memo.mid) && pic.pos.has(memo.yAddr)) {
        const p = pic.pos.get(memo.yAddr);
        items.push({ key: 'k' + memo.mid, kind: 'cell', x: p.x + B.slotX(T - 1, by.get(memo.yAddr) && by.get(memo.yAddr).leaf) + 2, y: p.y + 6, w: B.KW - 4, h: B.KH - 4, text: memo.mid, cls: 'mw-key mw-rise' });
      }
      // the new key, carried above the node it is being placed into
      if (!placed && tag !== 'after') {
        let anchor = null, slot = 0;
        if (fn === 'insert_nonfull' && xn) { anchor = x; slot = i === null ? xn.n : Math.max(0, Math.min(cap - 1, i + 1)); }
        else if (inSplit) { anchor = memo.tok ? memo.tok.a : x; slot = memo.tok ? memo.tok.s : 0; }
        else { anchor = d.root; slot = 0; if (c.s && pic.pos.has(c.s) && tag !== 'root-full' && tag !== 'new-root') anchor = c.s; }
        if (anchor && pic.pos.has(anchor)) {
          memo.tok = { a: anchor, s: slot };
          const p = pic.pos.get(anchor);
          items.push({ key: 'k' + k, kind: 'cell', x: p.x + B.slotX(slot, xn && xn.leaf) + 2, y: p.y - 46, w: B.KW - 4, h: B.KH - 4, text: k, cls: 'mw-key mw-carry' });
          if ((tag === 'compare' || tag === 'compare-leaf') && xn) {
            const note = i >= 0 ? (k < xn.key[i] ? k + ' < ' + xn.key[i] + ': further left' : k + ' > ' + xn.key[i] + ': stop') : 'smaller than all';
            items.push({ key: 'note', kind: 'text', x: p.x + B.slotX(slot, xn && xn.leaf) + B.KW + 4, y: p.y - 25, text: note, cls: 'mw-tag' });
          }
        }
      }
      if (inSplit) {
        if (c.y && pic.pos.has(c.y)) items.push(B.cursor('y', c.y, 0, 'c-violet', cap));
        if (c.z && pic.pos.has(c.z)) items.push(B.cursor('z', c.z, 0, 'c-green', cap));
      }
      if (c.s && pic.pos.has(c.s) && fn === 'insert') items.push(B.cursor('s', c.s, 0, 'c-green', cap));
      const nm = (n) => '[' + keysOf(n) + ']';
      const ki = (j) => (xn && j >= 0 && j < xn.n ? xn.key[j] : null);
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert(root, ' + k + '). A new key always goes into a leaf. On the way down, any full node is split before we enter it, so there is always room for a key that has to move up.'; break;
        case 'root-full': { const r = by.get(d.root); say = r && r.n === cap ? 'The root ' + nm(r) + ' holds ' + cap + ' keys: it is full. It has to be split first, and that is the only way a B-tree ever gets taller.' : 'The root ' + nm(r) + ' has room (' + (r ? r.n : 0) + ' of ' + cap + ' keys), so no new root is needed.'; break; }
        case 'new-root': say = 's = a new, empty inner node. It will sit above the old root.'; break;
        case 'adopt': say = 's->child[0] = root: the old root now hangs below s, as its only child.'; break;
        case 'split-root': say = 'split_child(s, 0): split the old root. Its middle key will move up into s.'; break;
        case 'descend': say = 'insert_nonfull(' + (c.s && fn === 'insert' ? 's' : 'root') + ', ' + k + '): go down from the root, which now has room.'; break;
        case 'taller': say = 'return s: s is the new root. The tree grew by one level at the top, so every leaf is still at the same depth.'; break;
        case 'same-root': say = 'The root is the same node as before, so insert() returns it.'; break;
        case 'split-y': say = 'y = x->child[' + i + ']: the full node ' + nm(yn) + '. Its middle key is ' + memo.mid + '.'; break;
        case 'split-z': say = 'z = a new node (' + (zn && zn.leaf ? 'a leaf' : 'an inner node') + ', like y). It will take the top ' + plural(T - 1, 'key') + ' of y.'; break;
        case 'loop-keys': say = d.extra.j < T - 1 ? 'j = ' + d.extra.j + ': the next key for z is y->key[' + (d.extra.j + T) + '].' : 'z has its ' + plural(T - 1, 'key') + '.'; break;
        case 'loop-kids': say = d.extra.j < T ? 'j = ' + d.extra.j + ': the next child for z.' : 'z has its ' + T + ' children.'; break;
        case 'loop-ptrs': say = d.extra.j > i ? 'Pointer slot ' + (d.extra.j + 1) + ' of x takes child ' + d.extra.j + '.' : 'The pointer slot right after y (' + (i + 1) + ') is free now.'; break;
        case 'loop-room': say = d.extra.j >= i ? 'Key slot ' + (d.extra.j + 1) + ' of x takes ' + (xn ? xn.key[d.extra.j] : '') + '.' : 'Key slot ' + i + ' of x is free for the middle key.'; break;
        case 'z-size': say = 'z->n = ' + (T - 1) + '.'; break;
        case 'move-key': say = 'z->key[' + d.extra.j + '] = y->key[' + (d.extra.j + T) + ']: ' + (zn ? zn.key[d.extra.j] : '') + ' moves from y over to z.'; break;
        case 'inner': say = yn && yn.leaf ? 'y is a leaf, so there are no children to share out.' : 'y is an inner node: its top ' + T + ' children go with the keys to z.'; break;
        case 'move-child': say = 'z->child[' + d.extra.j + '] = y->child[' + (d.extra.j + T) + ']: a whole subtree moves to z with a single pointer copy.'; break;
        case 'y-size': say = 'y->n = ' + (T - 1) + ': y keeps ' + nm(yn) + '. The middle key ' + memo.mid + ' is still in its slot, but y no longer counts it: it is on its way up.'; break;
        case 'shift-child': say = 'Make room in x for a pointer to z: child ' + (d.extra.j) + ' moves one place right.'; break;
        case 'link-z': say = 'x->child[' + (i + 1) + '] = z: z hangs right after y.'; break;
        case 'shift-key': say = 'Make room for the middle key: ' + (xn ? xn.key[d.extra.j + 1] : '') + ' moves one place right in x.'; break;
        case 'rise': say = 'x->key[' + i + '] = y->key[' + (T - 1) + ']: ' + memo.mid + ' rises into the parent, between y and z. Everything in y is smaller than ' + memo.mid + ', everything in z bigger.'; break;
        case 'x-size': say = 'x->n++: the parent now holds ' + nm(xn) + '. The split is done; no node is over-full and every leaf kept its depth.'; memo.tok = { a: x, s: Math.min(cap - 1, i) }; break;
        case 'last': say = 'x is the node ' + nm(xn) + '. i = n - 1 = ' + i + ': scan from its last key towards the left.'; break;
        case 'inner-test': say = xn.leaf ? 'x is a leaf: ' + k + ' goes in here.' : 'x is an inner node: find which child ' + k + ' belongs in.'; break;
        case 'compare': say = i >= 0 ? (k < ki(i) ? k + ' < ' + ki(i) + ': ' + k + ' belongs further left.' : k + ' > ' + ki(i) + ': stop. ' + k + ' belongs right of ' + ki(i) + '.') : 'i = -1: ' + k + ' is smaller than every key in this node.'; break;
        case 'left': say = 'i = ' + i + '.'; break;
        case 'gap': say = 'i++: child ' + i + ' is the one for ' + k + ' (' + gapName(xn, i) + ').'; break;
        case 'full-test': { const ch = xn && by.get(xn.child[i]); say = ch && ch.n === cap ? 'That child ' + nm(ch) + ' is full. Split it now, before going down: then, if anything must move up later, the parent has room.' : 'That child ' + nm(ch) + ' has room, so no split is needed here.'; break; }
        case 'split': say = 'split_child(x, ' + i + '): split the full child.'; break;
        case 'which-half': say = 'The child is now two nodes with ' + ki(i) + ' between them in x. Is ' + k + ' bigger than ' + ki(i) + '? ' + (k > ki(i) ? 'Yes: it goes into the right half, z.' : 'No: it stays with the left half, y.'); break;
        case 'right-half': say = 'i++: go down to the right half.'; break;
        case 'follow': say = 'x = x->child[' + i + ']: down one level, to ' + nm(xn) + '.'; break;
        case 'compare-leaf': say = i >= 0 ? (k < ki(i) ? k + ' < ' + ki(i) + ': ' + ki(i) + ' must move one slot right to make room.' : k + ' > ' + ki(i) + ': stop. The slot right of ' + ki(i) + ' is free now.') : 'i = -1: ' + k + ' goes into the first slot.'; break;
        case 'shift-right': say = 'x->key[' + (i + 1) + '] = x->key[' + i + ']: ' + (xn ? xn.key[i + 1] : '') + ' slides one slot right. Its old slot still holds a stale copy, about to be overwritten.'; break;
        case 'place': say = 'x->key[' + (i + 1) + '] = ' + k + ': the key drops into its slot.'; break;
        case 'count': say = 'x->n++: the leaf now holds ' + nm(xn) + '.'; break;
        case 'after': { const tot = d.nodes.filter((n) => !n.freed).reduce((a, n) => a + n.n, 0); say = k + ' is in. ' + (memo.splits ? plural(memo.splits, 'split') + ' on the way down. ' : 'No splits were needed. ') + 'The tree holds ' + tot + ' keys in ' + plural(pic.lay.height, 'level') + ', and all its leaves are still on the bottom level.'; break; }
      }
      return { items, say, slow: tag === 'rise' || tag === 'taller' || tag === 'place' || tag === 'link-z' };
    },
    predict: [
      {
        at: (t) => (t.tag === 'full-test' || t.tag === 'root-full') && t.data.extra.fn !== 'split_child' && (() => { const d = t.data, by = new Map(d.nodes.map((n) => [n.addr, n])); const n = t.tag === 'root-full' ? by.get(d.root) : by.get((by.get(d.cursors.x) || { child: [] }).child[d.extra.i]); return n && n.n === n.key.length; })(),
        once: true,
        ask: 'This node is full and is about to be split. Which of its keys will move up?',
        options: (ts, i) => { const d = ts[i].data, by = new Map(d.nodes.map((n) => [n.addr, n])); const n = ts[i].tag === 'root-full' ? by.get(d.root) : by.get(by.get(d.cursors.x).child[d.extra.i]); return n.key.slice(0, n.n).map(String); },
        answer: (ts, i) => { const d = ts[i].data, by = new Map(d.nodes.map((n) => [n.addr, n])); const n = ts[i].tag === 'root-full' ? by.get(d.root) : by.get(by.get(d.cursors.x).child[d.extra.i]); return String(n.key[(n.n - 1) / 2]); },
        pick: 'option',
        explain: () => 'The middle key: it leaves T - 1 keys on each side, so both halves are legal B-tree nodes.',
      },
      {
        at: (t) => t.tag === 'enter', once: true,
        ask: 'Will this insertion make the tree taller?',
        options: () => ['Yes', 'No'],
        answer: (ts) => (ts.some((t) => t.tag === 'new-root') ? 'Yes' : 'No'),
        pick: 'option',
        explain: () => 'Only a full root makes a B-tree taller: it is split, and a new root goes on top.',
      },
      {
        at: (t) => t.tag === 'inner-test' && t.data.nodes.some((n) => n.addr === t.data.cursors.x && n.leaf),
        once: true,
        ask: (t, ts, i, ctx) => 'In which slot of this leaf will ' + ctx.input.key + ' end up?',
        options: (ts, i) => { const d = ts[i].data, n = d.nodes.find((m) => m.addr === d.cursors.x); const o = []; for (let j = 0; j <= n.n; j++) o.push('slot ' + j); return o; },
        answer: (ts, i, ctx) => { const d = ts[i].data, n = d.nodes.find((m) => m.addr === d.cursors.x); return 'slot ' + n.key.slice(0, n.n).filter((v) => v < ctx.input.key).length; },
        pick: 'option',
        explain: () => 'The keys of a node stay sorted: every bigger key shifts one slot right to open a gap.',
      },
    ],
    quiz: [
      { q: 'Where does a new key go in a B-tree?', options: ['Always into the root', 'Always into a leaf', 'Into any node with room', 'Into a new node'], answer: 1, why: 'Like a binary search tree, the key goes to the leaf where a search for it would end. Only splits push keys upwards.' },
      { q: 'When a full node with keys 10, 20, 30 splits (t = 2), what happens?', options: ['20 moves up; 10 and 30 become two nodes', '10 moves up', 'All three move up', 'The node is copied'], answer: 0, why: 'The middle key rises into the parent, the keys below it stay, the keys above it go to a new node.' },
      { q: 'How does a B-tree get taller?', options: ['A leaf gets a new child', 'The root splits and a new root goes on top', 'A rotation', 'It never does'], answer: 1, why: 'B-trees grow at the top. That is why every leaf is always at the same depth.' },
      { q: 'Why split full nodes on the way down, even when the key may not need the room?', options: ['It is faster to code', 'So a key that moves up always finds room in the parent, and no second pass back up is needed', 'It saves memory', 'It is required for searching'], answer: 1, why: 'This proactive splitting goes down once. The other way (split only when a node overflows) may have to walk back up, splitting parents.' },
      { q: 'With t = 2, how many keys can a node hold?', options: ['1 to 2', '1 to 3', '2 to 4', 'Any number'], answer: 1, why: 'Between t - 1 = 1 and 2t - 1 = 3 (the root may hold fewer). That is a 2-3-4 tree: 2, 3 or 4 children.' },
    ],
    compareWith: 'bplus-insert',
  });
  // ---- delete --------------------------------------------------------------------------------------------------
  const DELETE = `/* the largest key in the subtree of x: keep going right */
int max_key(struct bnode *x)
{
    while (!x->leaf)
        x = x->child[x->n];
    return x->key[x->n - 1];
}

/* the smallest key in the subtree of x: keep going left */
int min_key(struct bnode *x)
{
    while (!x->leaf)
        x = x->child[0];
    return x->key[0];
}

/* give x->child[i] one more key: the separator comes down from x,
   and the left sibling's last key goes up to take its place */
void borrow_left(struct bnode *x, int i)
{
    struct bnode *c = x->child[i];                /*@ pick-c */
    struct bnode *s = x->child[i - 1];            /*@ pick-s */
    int j;
    for (j = c->n - 1; j >= 0; j--)               /*@ loop-room */
        c->key[j + 1] = c->key[j];                /*@ shift-key */
    if (!c->leaf)                                 /*@ inner */
        for (j = c->n; j >= 0; j--)               /*@ loop-kids */
            c->child[j + 1] = c->child[j];        /*@ shift-child */
    c->key[0] = x->key[i - 1];                    /*@ down */
    if (!c->leaf)                                 /*@ inner */
        c->child[0] = s->child[s->n];             /*@ adopt */
    x->key[i - 1] = s->key[s->n - 1];             /*@ up */
    c->n++;                                       /*@ c-size */
    s->n--;                                       /*@ s-size */
}

/* the same with the right sibling: its first key goes up */
void borrow_right(struct bnode *x, int i)
{
    struct bnode *c = x->child[i];                /*@ pick-c */
    struct bnode *s = x->child[i + 1];            /*@ pick-s */
    int j;
    c->key[c->n] = x->key[i];                     /*@ down */
    if (!c->leaf)                                 /*@ inner */
        c->child[c->n + 1] = s->child[0];         /*@ adopt */
    x->key[i] = s->key[0];                        /*@ up */
    for (j = 1; j < s->n; j++)                    /*@ loop-close */
        s->key[j - 1] = s->key[j];                /*@ shift-key */
    if (!s->leaf)                                 /*@ inner */
        for (j = 1; j <= s->n; j++)               /*@ loop-kids */
            s->child[j - 1] = s->child[j];        /*@ shift-child */
    c->n++;                                       /*@ c-size */
    s->n--;                                       /*@ s-size */
}

/* x->child[i] and x->child[i + 1] both have T - 1 keys: join them,
   with the separator from x in the middle, into one full node */
void merge(struct bnode *x, int i)
{
    struct bnode *c = x->child[i];                /*@ pick-c */
    struct bnode *s = x->child[i + 1];            /*@ pick-s */
    int j;
    c->key[T - 1] = x->key[i];                    /*@ down */
    for (j = 0; j < s->n; j++)                    /*@ loop-join */
        c->key[j + T] = s->key[j];                /*@ move-key */
    if (!c->leaf)                                 /*@ inner */
        for (j = 0; j <= s->n; j++)               /*@ loop-kids */
            c->child[j + T] = s->child[j];        /*@ move-child */
    for (j = i + 1; j < x->n; j++)                /*@ loop-close */
        x->key[j - 1] = x->key[j];                /*@ shift-key */
    for (j = i + 2; j <= x->n; j++)               /*@ loop-ptrs */
        x->child[j - 1] = x->child[j];            /*@ shift-child */
    c->n += s->n + 1;                             /*@ c-size */
    x->n--;                                       /*@ x-size */
    free(s);                                      /*@ free */
}

/* remove k from the subtree of x; x has at least T keys, or is the root */
void delete_key(struct bnode *x, int k)
{
    int i = 0, j, p;                              /*@ start */
    while (i < x->n && x->key[i] < k)             /*@ compare */
        i++;                                      /*@ next-key */
    if (i < x->n && x->key[i] == k) {             /*@ test-key */
        if (x->leaf) {                            /*@ case-leaf */
            for (j = i + 1; j < x->n; j++)        /*@ loop-close */
                x->key[j - 1] = x->key[j];        /*@ shift-key */
            x->n--;                               /*@ shrink */
        } else if (x->child[i]->n >= T) {         /*@ case-pred */
            p = max_key(x->child[i]);             /*@ pred */
            x->key[i] = p;                        /*@ replace */
            delete_key(x->child[i], p);           /*@ recurse-p */
        } else if (x->child[i + 1]->n >= T) {     /*@ case-succ */
            p = min_key(x->child[i + 1]);         /*@ succ */
            x->key[i] = p;                        /*@ replace */
            delete_key(x->child[i + 1], p);       /*@ recurse-p */
        } else {
            merge(x, i);                          /*@ merge-around */
            delete_key(x->child[i], k);           /*@ recurse-merged */
        }
        return;                                   /*@ done */
    }
    if (x->leaf)                                  /*@ leaf */
        return;                                   /*@ missing */
    if (x->child[i]->n == T - 1) {                /*@ thin */
        if (i > 0 && x->child[i - 1]->n >= T)     /*@ left-rich */
            borrow_left(x, i);                    /*@ borrow-left */
        else if (i < x->n && x->child[i + 1]->n >= T)    /*@ right-rich */
            borrow_right(x, i);                   /*@ borrow-right */
        else {
            if (i == x->n)                        /*@ last-child */
                i--;                              /*@ use-left */
            merge(x, i);                          /*@ merge */
        }
    }
    delete_key(x->child[i], k);                   /*@ recurse */
}

/* delete k from the tree and return the root (the old one, or its only child) */
struct bnode *delete(struct bnode *root, int k)
{
    struct bnode *old;
    delete_key(root, k);                          /*@ call */
    if (root->n == 0 && !root->leaf) {            /*@ empty-root */
        old = root;                               /*@ old */
        root = root->child[0];                    /*@ shorter */
        free(old);                                /*@ free-root */
    }
    return root;                                  /*@ result */
}`;

  const K11 = [10, 20, 30, 40, 50, 60, 70, 15, 25, 35, 45];
  X.topic({
    id: 'btree-delete', family: 'btree', order: 30, title: 'Delete (borrow and merge)',
    blurb: 'Before stepping into a child with the fewest keys allowed, give it one more: borrow from a sibling through the parent, or merge it with a sibling. Then a key can always be removed without breaking the rules.',
    code: DELETE,
    animate: ['delete', 'delete_key', 'borrow_left', 'borrow_right', 'merge'], quiet: ['max_key', 'min_key'],
    inputs: [X.btreeKeys, X.btreeT, { id: 'key', kind: 'int', label: 'Delete', def: 70, lo: 1, hi: 999 }],
    presets: [
      { label: 'Borrow from the left sibling', values: { keys: K11, t: 2, key: 70 } },
      { label: 'Borrow from the right sibling', values: { keys: [10, 20, 30, 40, 50, 60, 70, 25, 35], t: 2, key: 10 } },
      { label: 'Merge with a sibling', values: { keys: [10, 20, 30, 40, 50, 60, 70], t: 2, key: 10 } },
      { label: 'Inner key: the predecessor', values: { keys: K11, t: 2, key: 40 } },
      { label: 'Inner key: the successor', values: { keys: [10, 20, 30, 40, 50, 60, 70, 25, 35, 45], t: 2, key: 20 } },
      { label: 'The tree gets shorter', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35, 45], t: 2, key: 40 } },
    ],
    counters: ['compares', 'moves', 'frees'],
    main: (inp) => X.btreeMain(inp, `    root = delete(root, ${inp.key});`),
    capture: (P) => B.capture(P, {
      type: ['x', 'root'], root: 'root', cursors: ['x', 'c', 's'], stack: 'x',
      extra: (P) => ({ i: P.has('i', 0) && P.isSet('i', 0) ? P.val('i', 0) : null, j: P.has('j', 0) && P.isSet('j', 0) ? P.val('j', 0) : null, p: P.has('p', 0) && P.isSet('p', 0) ? P.val('p', 0) : null, k: P.has('k', 0) ? P.val('k', 0) : null, fn: P.frames[0].name }),
    }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, K = ctx.input.key, memo = ctx.memo, inp = ctx.input;
      const cap = capOf(inp), T = inp.t || 2;
      // a call line is drawn once the callee has started, and a return line once it has returned:
      // their numbers come from the step before
      const callish = ['recurse', 'recurse-p', 'recurse-merged', 'call'].includes(tag) && ctx.prev;
      const e = callish ? ctx.prev.data.extra : d.extra, fn = e.fn, i = e.i, k = e.k === null ? K : e.k;
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      let x = fn === 'delete' ? d.root : callish ? ctx.prev.data.cursors.x : d.cursors.x;
      const xn = by.get(x);
      const helper = ['borrow_left', 'borrow_right', 'merge'].includes(fn);
      const cn = helper ? by.get(d.cursors.c) : null, sn = helper ? by.get(d.cursors.s) : null;
      const stack = new Set(d.stack);
      // max_key() and min_key() are quiet, so work out p from the tree (the line is drawn before p is set)
      if ((tag === 'pred' || tag === 'succ') && xn) {
        let n = by.get(xn.child[tag === 'pred' ? i : i + 1]);
        while (n && !n.leaf) n = by.get(n.child[tag === 'pred' ? n.n : 0]);
        memo.p = n ? (tag === 'pred' ? n.key[n.n - 1] : n.key[0]) : e.p;
      }
      if (fn === 'delete_key' && tag === 'start') memo.visits = (memo.visits || 0) + 1;
      if (tag === 'borrow-left' || tag === 'borrow-right') memo.fix = (memo.fix || []).concat('borrow');
      if (tag === 'merge' || tag === 'merge-around') memo.fix = (memo.fix || []).concat('merge');
      const thinKid = (tag === 'thin' || tag === 'left-rich' || tag === 'right-rich' || tag === 'last-child' || tag === 'use-left') && xn ? xn.child[tag === 'use-left' ? i + 1 : i] : null;
      const pic = B.picture(ctx, d, {
        cap,
        frameCls: (n) => {
          if (n.freed) return '';
          if (helper && n.addr === d.cursors.s) return 'sibling';
          if (helper && n.addr === d.cursors.c) return 'thin';
          if (n.addr === thinKid && by.get(thinKid).n === T - 1) return 'thin';
          if (n.addr === x && tag !== 'after') return 'focus';
          if (stack.has(n.addr) && tag !== 'after') return 'path';
          return '';
        },
        keyCls: (n, j, v) => {
          if (v === K && tag !== 'after') return 'doomed';
          if (['down', 'up', 'replace'].includes(tag) && helper && ((tag === 'down' && n.addr === d.cursors.c) || (tag === 'up' && n.addr === d.cursors.x)) && j === (tag === 'down' ? (fn === 'borrow_left' ? 0 : fn === 'merge' ? T - 1 : cn.n) : (fn === 'borrow_left' ? i - 1 : i))) return 'rise';
          if (tag === 'replace' && n.addr === x && j === i) return 'rise';
          if ((tag === 'compare' || tag === 'test-key') && n.addr === x && j === i) return 'hot';
          if (tag === 'move-key' && n.addr === d.cursors.c && j === e.j + T) return 'hot';
          return '';
        },
        edgeCls: (a, c) => (stack.has(a) && stack.has(c) ? 'path' : ''),
      });
      const items = pic.items;
      // what is being deleted, above the node being searched
      if (xn && pic.pos.has(x) && fn === 'delete_key' && !['done', 'missing'].includes(tag)) {
        const p = pic.pos.get(x);
        const slot = i === null ? 0 : Math.max(0, Math.min(cap - 1, i));
        items.push({ key: 'tok', kind: 'cell', x: p.x + B.slotX(slot, xn && xn.leaf) + 2, y: p.y - 46, w: B.KW - 4, h: B.KH - 4, text: k, cls: 'mw-key mw-carry' });
        let note = '';
        if (tag === 'compare') note = i < xn.n ? (xn.key[i] < k ? xn.key[i] + ' < ' + k + ': go on' : 'stop at ' + xn.key[i]) : 'past the last key';
        if (tag === 'test-key') note = i < xn.n && xn.key[i] === k ? 'found ' + k : 'not here';
        if (note) items.push({ key: 'note', kind: 'text', x: p.x + B.slotX(slot, xn && xn.leaf) + B.KW + 4, y: p.y - 25, text: note, cls: 'mw-tag' });
        if (i !== null && tag !== 'start') items.push(B.index('i', x, Math.min(i, xn.n), i >= xn.n || ['thin', 'left-rich', 'right-rich', 'recurse', 'leaf', 'merge', 'borrow-left', 'borrow-right', 'last-child', 'use-left'].includes(tag)));
      }
      if (helper) {
        if (d.cursors.c && pic.pos.has(d.cursors.c)) items.push(B.cursor('c', d.cursors.c, 0, 'c-amber', cap));
        if (d.cursors.s && pic.pos.has(d.cursors.s)) items.push(B.cursor('s', d.cursors.s, 0, 'c-violet', cap));
      }
      const nm = (n) => '[' + keysOf(n) + ']';
      const kid = (j) => (xn ? by.get(xn.child[j]) : null);
      const side = fn === 'borrow_left' ? 'left' : 'right';
      let say = '';
      switch (tag) {
        case 'enter': say = fn === 'delete' ? 'delete(root, ' + K + '). On the way down, every child we step into is first given more than the minimum of ' + plural(T - 1, 'key') + ', so taking a key out never leaves a node too small.' : 'The work starts in ' + fn + '().'; break;
        case 'call': say = 'delete_key(root, ' + K + '): start the walk down at the root.'; break;
        case 'start': say = 'delete_key at the node ' + nm(xn) + '. i = 0: scan its keys from the left.'; break;
        case 'compare': say = i < xn.n ? (xn.key[i] < k ? xn.key[i] + ' < ' + k + ': keep going right.' : 'Stop at ' + xn.key[i] + ': it is not smaller than ' + k + '.') : 'i = ' + i + ' = n: ' + k + ' is bigger than every key in this node.'; break;
        case 'next-key': say = 'i = ' + i + '.'; break;
        case 'test-key': say = i < xn.n && xn.key[i] === k ? k + ' is in this node, at index ' + i + '.' : k + ' is not in this node; if it is anywhere, it is down child ' + i + ' (' + gapName(xn, i) + ').'; break;
        case 'case-leaf': say = xn.leaf ? 'The node is a leaf: just take the key out. It is safe, because this node was made to have more than the minimum.' : 'The node is an inner node: ' + k + ' separates two children, so it cannot simply vanish. Something has to take its place.'; break;
        case 'loop-close': say = fn === 'merge' ? 'Close the gap in x that the separator left.' : fn === 'borrow_right' ? 'Close the gap at the front of the sibling.' : 'Close the gap: every key right of it moves one slot left.'; break;
        case 'shift-key': say = fn === 'borrow_left' ? 'c->key[' + (e.j + 1) + '] = c->key[' + e.j + ']: make room at the front of c.' : 'One key moves one slot left.'; break;
        case 'shift-child': say = 'The child pointers move along with the keys.'; break;
        case 'shrink': say = 'x->n--: the leaf now holds ' + nm(xn) + '. ' + k + ' is gone.'; break;
        case 'case-pred': { const l = kid(i); say = 'The child left of ' + k + ' ' + nm(l) + ' has ' + (l.n >= T ? l.n + ' keys, more than the minimum: it can give up its largest key, the predecessor of ' + k + '.' : 'only the minimum of ' + plural(l.n, 'key') + ', so it cannot spare one.'); break; }
        case 'pred': say = 'p = ' + memo.p + ': the largest key left of ' + k + ' (found by going right all the way down to a leaf).'; break;
        case 'succ': say = 'p = ' + memo.p + ': the smallest key right of ' + k + ' (found by going left all the way down to a leaf).'; break;
        case 'case-succ': { const r = kid(i + 1); say = 'The child right of ' + k + ' ' + nm(r) + ' has ' + (r.n >= T ? r.n + ' keys: it can give up its smallest key, the successor of ' + k + '.' : 'only the minimum too. Neither side can spare a key.'); break; }
        case 'replace': say = 'x->key[' + i + '] = ' + memo.p + ': ' + memo.p + ' moves up and overwrites ' + k + ', which is gone. The order still holds. The old copy of ' + memo.p + ' (drawn faint) is still in the leaf.'; break;
        case 'recurse-p': say = 'Now delete the old copy of ' + memo.p + ' from that child, the same way.'; break;
        case 'merge-around': say = 'Both children around ' + k + ' have only ' + plural(T - 1, 'key') + '. Merge them, with ' + k + ' coming down into the middle.'; break;
        case 'recurse-merged': say = k + ' is now in the merged child. Carry on deleting it there.'; break;
        case 'done': say = 'The call at ' + nm(xn) + ' is finished' + (d.stack.length > 1 ? '; back up one level.' : '.'); break;
        case 'loop-ptrs': say = 'Close the gap among x\'s child pointers too: s is no longer a child.'; break;
        case 'leaf': say = xn.leaf ? k + ' is not here and this is a leaf: ' + k + ' is not in the tree.' : 'Not a leaf: ' + k + ' can only be in child ' + i + ' (' + gapName(xn, i) + ').'; break;
        case 'missing': say = k + ' is not in the tree, so nothing changes.'; break;
        case 'thin': { const ch = kid(i); say = ch && ch.n === T - 1 ? 'Child ' + i + ' ' + nm(ch) + ' has only ' + plural(T - 1, 'key') + ', the minimum. If a key were taken from it later, it would be too small. Top it up first.' : 'Child ' + i + ' ' + nm(ch) + ' has ' + ch.n + ' keys, more than the minimum: safe to go down.'; break; }
        case 'left-rich': { const l = i > 0 ? kid(i - 1) : null; say = l ? 'The left sibling ' + nm(l) + ' has ' + l.n + (l.n >= T ? ' keys: it can lend one.' : ' key: it cannot lend.') : 'There is no left sibling.'; break; }
        case 'right-rich': { const r = i < xn.n ? kid(i + 1) : null; say = r ? 'The right sibling ' + nm(r) + ' has ' + r.n + (r.n >= T ? ' keys: it can lend one.' : ' key: it cannot lend either.') : 'There is no right sibling.'; break; }
        case 'borrow-left': case 'borrow-right': say = 'borrow_' + (tag === 'borrow-left' ? 'left' : 'right') + '(x, ' + i + '): a key moves through the parent, like a rotation.'; break;
        case 'last-child': say = i === xn.n ? 'It is the last child, so it merges with its left sibling.' : 'It merges with its right sibling.'; break;
        case 'use-left': say = 'i-- : merge child ' + i + ' and child ' + (i + 1) + '.'; break;
        case 'merge': say = 'merge(x, ' + i + '): no sibling can lend, so two minimal children become one node.'; break;
        case 'recurse': say = 'delete_key(x->child[' + i + '], ' + k + '): go down to ' + nm(kid(i)) + ', which now has room to lose a key.'; break;
        case 'pick-c': say = (fn === 'merge' ? 'c = the left one of the two children: ' : 'c = the child that needs a key: ') + nm(cn) + '.'; break;
        case 'pick-s': say = 's = its ' + (fn === 'merge' ? 'right sibling' : side + ' sibling') + ' ' + nm(sn) + '.'; break;
        case 'loop-room': say = e.j >= 0 ? 'Make room at the front of c.' : 'Slot 0 of c is free.'; break;
        case 'inner': say = cn && cn.leaf ? 'Leaves have no children to move.' : 'Inner nodes: a child pointer has to move too.'; break;
        case 'loop-kids': say = 'Move the child pointers along.'; break;
        case 'down': say = fn === 'merge' ? 'c->key[' + (T - 1) + '] = x->key[' + i + ']: the separator ' + (cn ? cn.key[T - 1] : '') + ' comes down into the middle of the new node.' : 'The separator ' + (fn === 'borrow_left' ? cn.key[0] : cn.key[cn.n]) + ' comes down from the parent into c.'; break;
        case 'adopt': say = 'The sibling\'s ' + (fn === 'borrow_left' ? 'last' : 'first') + ' child moves over to c with it.'; break;
        case 'up': say = 'The sibling\'s ' + (fn === 'borrow_left' ? 'largest' : 'smallest') + ' key goes up into the parent to be the new separator. Keys stay in order: smaller on the left, bigger on the right.'; break;
        case 'c-size': say = 'c->n is now ' + (cn ? cn.n : '') + ': c holds ' + nm(cn) + '.'; break;
        case 's-size': say = 's->n is now ' + (sn ? sn.n : '') + ': the sibling holds ' + nm(sn) + ', still at least the minimum.'; break;
        case 'loop-join': say = e.j < (sn ? sn.n : 0) ? 'Copy the sibling\'s keys after the separator.' : 'All the sibling\'s keys are in c.'; break;
        case 'move-key': say = 'c->key[' + (e.j + T) + '] = s->key[' + e.j + ']: ' + (cn ? cn.key[e.j + T] : '') + ' moves over into c.'; break;
        case 'move-child': say = 'A child of s moves over into c.'; break;
        case 'x-size': say = 'x->n--: the parent lost its separator and now holds ' + nm(by.get(d.cursors.x)) + (by.get(d.cursors.x) && by.get(d.cursors.x).n === 0 ? ': none at all. Only the root may become empty like this.' : '.'); break;
        case 'free': say = 'free(s): the right node is empty now and goes back to the heap.'; break;
        case 'empty-root': { const r = by.get(d.root); say = r && r.n === 0 && !r.leaf ? 'The root has no keys left: its last key came down in a merge. Its only child becomes the root.' : 'The root still has keys, so it stays.'; break; }
        case 'old': say = 'old = root, to free it in a moment.'; break;
        case 'shorter': say = 'root = root->child[0]: the tree is one level shorter. B-trees shrink at the top, so the leaves stay level.'; break;
        case 'free-root': say = 'free(old): the empty old root goes back to the heap.'; break;
        case 'result': say = 'delete() returns the root.'; break;
        case 'after': { const tot = d.nodes.filter((n) => !n.freed).reduce((a, n) => a + n.n, 0); const f = memo.fix || []; say = (d.nodes.some((n) => !n.freed && n.key.slice(0, n.n).includes(K)) ? K + ' was not in the tree.' : K + ' is gone.') + ' ' + (f.length ? 'On the way: ' + f.join(', then ') + '. ' : 'No borrowing or merging was needed. ') + tot + ' keys remain, every node has at least ' + plural(T - 1, 'key') + ' (except perhaps the root), and all leaves are level.'; break; }
      }
      return { items, say, slow: ['down', 'up', 'replace', 'free', 'shorter', 'merge', 'shrink'].includes(tag) };
    },
    predict: [
      {
        at: (t) => t.tag === 'thin' && (() => { const d = t.data, n = d.nodes.find((m) => m.addr === d.cursors.x); const c = n && d.nodes.find((m) => m.addr === n.child[d.extra.i]); return c && c.n === c.key.length >> 1; })(),
        once: true,
        ask: 'This child has the fewest keys allowed. How will it be topped up?',
        options: () => ['Borrow from the left sibling', 'Borrow from the right sibling', 'Merge with a sibling'],
        answer: (ts, i) => { for (let j = i + 1; j < ts.length; j++) { if (ts[j].tag === 'borrow-left') return 'Borrow from the left sibling'; if (ts[j].tag === 'borrow-right') return 'Borrow from the right sibling'; if (ts[j].tag === 'merge') return 'Merge with a sibling'; } return null; },
        pick: 'option',
        explain: () => 'First a sibling with a key to spare (left, then right). Only if neither can lend do the two merge.',
      },
      {
        at: (t) => t.tag === 'case-leaf' && t.data.nodes.some((n) => n.addr === t.data.cursors.x && !n.leaf),
        once: true,
        ask: (t, ts, i, ctx) => ctx.input.key + ' is in an inner node. What happens to its place?',
        options: () => ['Its predecessor moves up into it', 'Its successor moves up into it', 'The two children merge around it'],
        answer: (ts, i) => { for (let j = i + 1; j < ts.length; j++) { if (ts[j].tag === 'pred') return 'Its predecessor moves up into it'; if (ts[j].tag === 'succ') return 'Its successor moves up into it'; if (ts[j].tag === 'merge-around') return 'The two children merge around it'; } return null; },
        pick: 'option',
        explain: () => 'Predecessor if the left child can spare a key, else successor if the right one can, else merge.',
      },
      {
        at: (t) => t.tag === 'enter' && t.data.extra.fn === 'delete', once: true,
        ask: 'Will this delete make the tree shorter?',
        options: () => ['Yes', 'No'],
        answer: (ts) => (ts.some((t) => t.tag === 'shorter') ? 'Yes' : 'No'),
        pick: 'option',
        explain: () => 'Only when the root loses its last key in a merge does the tree lose a level.',
      },
    ],
    quiz: [
      { q: 'Why does delete top up a child before stepping into it?', options: ['To keep the tree sorted', 'So that removing a key from it later can never leave it below the minimum', 'To make the search faster', 'It is not needed'], answer: 1, why: 'With at least t keys in every node it enters, a removal deep down never forces fixes back up the tree.' },
      { q: 'In a borrow from the left sibling, which key goes up into the parent?', options: ['The sibling\'s smallest key', 'The sibling\'s largest key', 'The deleted key', 'The separator'], answer: 1, why: 'The separator comes down into the child; the sibling\'s largest key replaces it, so the order stays right.' },
      { q: 'A merge joins two nodes with t - 1 keys each. How many keys does the result have?', options: ['2t - 2', '2t - 1', 't', 't + 1'], answer: 1, why: '(t - 1) + (t - 1) + 1 separator from the parent = 2t - 1, a full node.' },
      { q: 'How can deleting make a B-tree shorter?', options: ['A leaf disappears', 'The root loses its last key in a merge and its child becomes the root', 'A rotation', 'It cannot'], answer: 1, why: 'Like growth, shrinking happens only at the root, so all leaves stay at the same depth.' },
      { q: 'Deleting a key from an inner node usually...', options: ['Removes the whole node', 'Replaces it with its predecessor or successor from a leaf', 'Moves all its children up', 'Is not allowed'], answer: 1, why: 'The predecessor or successor sits in a leaf, where removing is easy, and it keeps the order when it takes the deleted key\'s place.' },
    ],
  });
})(SEE);
