// B+ trees: the family, insertion (reactive splits, copy up and push up) and range queries.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, B = X.BTreeKit;

  const INSERT = `/* a new root above two nodes, with sep between them */
struct bpnode *grow(struct bpnode *left, int sep, struct bpnode *right)
{
    struct bpnode *s = new_node(0);
    s->key[0] = sep;
    s->child[0] = left;
    s->child[1] = right;
    s->n = 1;
    return s;
}

/* leaf x has one key too many: its top half moves to a new leaf z,
   z joins the leaf chain, and a COPY of z's first key goes up */
struct bpnode *split_leaf(struct bpnode *x, int *up)
{
    struct bpnode *z = new_node(1);                 /*@ new-z */
    int half = (MAXK + 1) / 2;                      /*@ half */
    int j;
    z->n = x->n - half;                             /*@ z-size */
    for (j = 0; j < z->n; j++)                      /*@ loop-keys */
        z->key[j] = x->key[half + j];               /*@ move-key */
    x->n = half;                                    /*@ x-size */
    z->next = x->next;                              /*@ chain-z */
    x->next = z;                                    /*@ chain-x */
    *up = z->key[0];                                /*@ copy-up */
    return z;                                       /*@ ret-z */
}

/* inner node x has one key too many: its middle key MOVES up (no copy
   stays below), and the keys and children after it go to a new node z */
struct bpnode *split_internal(struct bpnode *x, int *up)
{
    struct bpnode *z = new_node(0);                 /*@ new-z */
    int half = (MAXK + 1) / 2;                      /*@ half */
    int j;
    z->n = x->n - half - 1;                         /*@ z-size */
    for (j = 0; j < z->n; j++)                      /*@ loop-keys */
        z->key[j] = x->key[half + 1 + j];           /*@ move-key */
    for (j = 0; j <= z->n; j++)                     /*@ loop-kids */
        z->child[j] = x->child[half + 1 + j];       /*@ move-child */
    *up = x->key[half];                             /*@ push-up */
    x->n = half;                                    /*@ x-size */
    return z;                                       /*@ ret-z */
}

/* insert k below x; if x had to split, return its new right half
   (with the separator in *up), otherwise NULL */
struct bpnode *insert_rec(struct bpnode *x, int k, int *up)
{
    struct bpnode *z;
    int i = 0, j, sep;                              /*@ start */
    while (i < x->n && k >= x->key[i])              /*@ compare */
        i++;                                        /*@ next-key */
    if (x->leaf) {                                  /*@ leaf-test */
        for (j = x->n; j > i; j--)                  /*@ loop-room */
            x->key[j] = x->key[j - 1];              /*@ shift-key */
        x->key[i] = k;                              /*@ place */
        x->n++;                                     /*@ count */
    } else {
        z = insert_rec(x->child[i], k, &sep);       /*@ recurse */
        if (z == NULL)                              /*@ no-split */
            return NULL;                            /*@ unchanged */
        for (j = x->n; j > i; j--) {                /*@ loop-room */
            x->key[j] = x->key[j - 1];              /*@ shift-key */
            x->child[j + 1] = x->child[j];          /*@ shift-child */
        }
        x->key[i] = sep;                            /*@ take-sep */
        x->child[i + 1] = z;                        /*@ take-z */
        x->n++;                                     /*@ count */
    }
    if (x->n <= MAXK)                               /*@ overflow */
        return NULL;                                /*@ fits */
    return x->leaf ? split_leaf(x, up) : split_internal(x, up);    /*@ split */
}

/* add k; when the split reaches the top, a new root goes above */
struct bpnode *insert(struct bpnode *root, int k)
{
    struct bpnode *z;
    int sep;
    z = insert_rec(root, k, &sep);                  /*@ call */
    if (z == NULL)                                  /*@ root-split */
        return root;                                /*@ same-root */
    return grow(root, sep, z);                      /*@ grow */
}`;

  X.family({
    id: 'bplus', order: 4, group: 'Balanced trees', title: 'B+ trees',
    blurb: 'Every key lives in a leaf, and the leaves are linked left to right. The inner nodes only hold copies of keys, as signposts for the way down.',
    head: (t) => `#include <stdio.h>
#include <stdlib.h>

#define MAXK 3      /* order 4: at most 3 keys and 4 children per node */

/* a B+ tree node. Arrays have one spare slot: a node may hold MAXK + 1
   keys for a moment, just before it splits. Leaves are chained by next. */
struct bpnode {
    int n;
    int leaf;
    int key[MAXK + 1];
    struct bpnode *child[MAXK + 2];
    struct bpnode *next;
};

struct bpnode *new_node(int leaf)
{
    struct bpnode *x = malloc(sizeof *x);
    int i;
    x->n = 0;
    x->leaf = leaf;
    x->next = NULL;
    for (i = 0; i <= MAXK + 1; i++)
        x->child[i] = NULL;
    return x;
}${t.id === 'bplus-insert' ? '' : '\n\n/* main uses these to build the tree you chose (the B+ tree insert topic animates them) */\n' + INSERT}`,
  });

  const keysIn = { id: 'keys', kind: 'ints', label: 'Keys, inserted in this order', def: [10, 20, 30, 40, 50, 60, 70], min: 0, max: 14, distinct: true, check: (v) => (v.some((x) => x < 1 || x > 999) ? 'Keys: from 1 to 999' : null) };
  const CAP = 4, MAXK = 3;
  const keyName = (n, v) => (n.leaf ? 'L' : 'I') + v;
  const keysOf = (n) => (n && n.n ? n.key.slice(0, n.n).join(', ') : 'no keys');
  const nm = (n) => '[' + keysOf(n) + ']';
  const plural = (k, w, ws) => k + ' ' + (k === 1 ? w : ws || w + 's');
  const gapName = (n, i) => (!n || !n.n ? 'the only child' : i <= 0 ? 'left of ' + n.key[0] : i >= n.n ? 'right of ' + n.key[n.n - 1] : 'between ' + n.key[i - 1] + ' and ' + n.key[i]);

  /** Remember where every key was drawn, so a key that appears in a new place can fly in from its old one */
  const remember = (ctx, pic) => {
    const m = new Map();
    for (const it of pic.items) if (it.kind === 'cell' && /^[LI]\d/.test(it.key)) m.set(it.key, { x: it.x, y: it.y });
    ctx.memo.cells = m;
  };

  // ---- insert ----------------------------------------------------------------------------------------------
  X.topic({
    id: 'bplus-insert', family: 'bplus', order: 10, title: 'Insert (copy up, push up)',
    blurb: 'Put the key into its leaf. A leaf that overflows splits and sends a copy of its new right half\'s first key up; an inner node that overflows splits and sends its middle key itself up.',
    code: INSERT,
    animate: ['grow', 'insert'], quiet: ['grow', 'new_node'],
    inputs: [keysIn, { id: 'key', kind: 'int', label: 'Insert', def: 65, lo: 1, hi: 999 }],
    check: (inp) => (inp.keys.includes(inp.key) ? 'That key is already in the tree; pick another' : null),
    presets: [
      { label: 'A leaf splits: copy up', values: { keys: [10, 20, 30, 40, 50, 60, 70], key: 65 } },
      { label: 'The split climbs to the root', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35], key: 95 } },
      { label: 'Room in the leaf', values: { keys: [10, 20, 30, 40, 50, 60, 70], key: 25 } },
      { label: 'The first root split', values: { keys: [10, 20, 30], key: 40 } },
      { label: 'Into an empty tree', values: { keys: [], key: 42 } },
    ],
    counters: ['compares', 'moves', 'allocs'],
    main: (inp) => `int main(void)
{
    int keys[] = { ${inp.keys.length ? inp.keys.join(', ') : '0'} };
    struct bpnode *root = new_node(1);
    struct bpnode *z;
    int i, sep;
    /* build the starting tree quietly, with the same steps insert() takes */
    for (i = 0; i < ${inp.keys.length}; i++) {
        z = insert_rec(root, keys[i], &sep);
        if (z != NULL)
            root = grow(root, sep, z);
    }
    root = insert(root, ${inp.key});
    return 0;
}`,
    capture: (P) => B.capture(P, {
      type: ['x', 'root'], root: 'root', cursors: ['x', 'z'], stack: 'x',
      extra: (P) => { const g = (v) => (P.has(v, 0) && P.isSet(v, 0) ? P.val(v, 0) : null); return { i: g('i'), j: g('j'), half: g('half'), fn: P.frames[0].name }; },
    }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, k = ctx.input.key, memo = ctx.memo;
      const callish = ['recurse', 'call', 'split'].includes(tag) && ctx.prev;
      const src = callish ? ctx.prev.data : d;
      const e = src.extra, fn = e.fn, i = e.i;
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      let x = fn === 'insert' ? d.root : src.cursors.x;
      const xn = by.get(x);
      const inSplit = fn === 'split_leaf' || fn === 'split_internal';
      const fresh = ctx.prev && ctx.prev.data ? d.nodes.find((n) => !ctx.prev.data.nodes.some((m) => m.addr === n.addr)) : null;
      const z = inSplit ? (d.cursors.z || (tag === 'new-z' && fresh ? fresh.addr : null)) : null;
      if (tag === 'new-z') { memo.pending = { z, after: x }; memo.splits = (memo.splits || []).concat(fn === 'split_leaf' ? 'leaf' : 'inner'); }
      if (memo.pending && [...d.nodes].some((n) => !n.freed && !n.leaf && n.child.slice(0, n.n + 2).includes(memo.pending.z)) && tag !== 'new-z') memo.pending = null;
      if (tag === 'copy-up' || tag === 'push-up') {
        const zn = by.get(z), v = tag === 'copy-up' ? zn.key[0] : xn.key[e.half];
        const from = memo.cells && memo.cells.get((tag === 'copy-up' ? 'L' : 'I') + v);
        memo.up = { v, copy: tag === 'copy-up', from };
      }
      const placed = d.nodes.some((n) => !n.freed && n.leaf && n.key.slice(0, n.n + 1).includes(k) && (n.key.slice(0, n.n).includes(k) || tag === 'place'));
      const stack = new Set(d.stack);
      const over = xn && xn.n > MAXK;
      const pic = B.picture(ctx, d, {
        cap: CAP, over: MAXK, gap: 44, keyName, chain: true,
        orphan: (n) => (memo.pending && n.addr === memo.pending.z ? { after: memo.pending.after } : null),
        frameCls: (n) => {
          if (inSplit && n.addr === z) return 'newbie';
          if (n.addr === x && over && ['count', 'overflow', 'split'].includes(tag)) return 'full';
          if (n.addr === x && tag !== 'after') return 'focus';
          if (stack.has(n.addr) && tag !== 'after') return 'path';
          return '';
        },
        keyCls: (n, j, v) => {
          if (v === k && n.leaf) return placed && tag !== 'after' ? 'good' : '';
          if (memo.up && v === memo.up.v && ['copy-up', 'push-up', 'take-sep', 'grow'].includes(tag)) return 'rise';
          if ((tag === 'compare') && n.addr === x && j === i) return 'hot';
          if (tag === 'shift-key' && n.addr === x && j === e.j) return 'hot';
          if (tag === 'move-key' && n.addr === z && j === e.j) return 'hot';
          return '';
        },
        edgeCls: (a, c) => (stack.has(a) && stack.has(c) ? 'path' : ''),
        nextCls: (n) => (['chain-z', 'chain-x'].includes(tag) && (n.addr === x || n.addr === z) ? 'hot' : ''),
      });
      const items = pic.items;
      // a separator that appears in an inner node flies in from where it came from
      for (const it of items) {
        if (it.kind !== 'cell' || it.key[0] !== 'I' || (memo.cells && memo.cells.has(it.key))) continue;
        const v = +it.key.slice(1);
        const from = memo.upPos && memo.up && memo.up.v === v ? memo.upPos : memo.cells && memo.cells.get('L' + v);
        if (from && ctx.i) { it.enter = 'fly'; it.from = { x: from.x, y: from.y }; }
      }
      // the key on its way down, above the node it is being compared in
      if (!placed && tag !== 'after' && xn && pic.pos.has(x) && fn === 'insert_rec') {
        const p = pic.pos.get(x), slot = Math.max(0, Math.min(CAP - 1, i === null ? 0 : i));
        items.push({ key: 'L' + k, kind: 'cell', x: p.x + B.slotX(slot, xn && xn.leaf) + 2, y: p.y - 46, w: B.KW - 4, h: B.KH - 4, text: k, cls: 'mw-key mw-carry' });
        if (tag === 'compare') items.push({ key: 'note', kind: 'text', x: p.x + B.slotX(slot, xn && xn.leaf) + B.KW + 4, y: p.y - 25, text: i < xn.n ? (k >= xn.key[i] ? k + ' ≥ ' + xn.key[i] + ': go on' : k + ' < ' + xn.key[i] + ': stop') : 'past the last key', cls: 'mw-tag' });
      }
      // the separator travelling up, held in the caller's sep until the parent takes it
      if (memo.up && !['take-sep', 'grow', 'after'].includes(tag)) {
        const anchor = fn === 'insert' ? d.root : x;
        if (anchor && pic.pos.has(anchor)) {
          const p = pic.pos.get(anchor);
          memo.upPos = { x: p.x + pic.wOf(anchor) + 8, y: p.y - 40 };
          items.push({ key: 'up', kind: 'cell', x: memo.upPos.x, y: memo.upPos.y, w: B.KW - 4, h: B.KH - 4, text: memo.up.v, cls: 'mw-key mw-rise', enter: memo.up.from ? 'fly' : 'fade', from: memo.up.from });
          items.push({ key: 'upl', kind: 'text', x: memo.upPos.x + B.KW, y: memo.upPos.y + 20, text: memo.up.copy ? 'copy going up' : 'moving up', cls: 'mw-tag' });
        }
      }
      if (inSplit && z && pic.pos.has(z)) items.push(B.cursor('z', z, 0, 'c-green', CAP));
      if (xn && i !== null && fn === 'insert_rec' && ['compare', 'next-key', 'leaf-test', 'place', 'take-sep'].includes(tag)) items.push(B.index('i', x, Math.min(i, CAP - 1), !xn.leaf && tag !== 'take-sep'));
      const ki = (j) => (xn ? xn.key[j] : '');
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert(root, ' + k + '). In a B+ tree every key ends up in a leaf. A node may overflow by one key for a moment; then it splits and the split may climb up.'; break;
        case 'call': say = 'insert_rec(root, ' + k + ', &sep): go down from the root.'; break;
        case 'start': say = (xn.leaf ? 'A leaf ' : 'An inner node ') + nm(xn) + '. Scan for the first key bigger than ' + k + '.'; break;
        case 'compare': say = i < xn.n ? (k >= ki(i) ? k + ' ≥ ' + ki(i) + ': keep going right' + (memo.eqTold ? '.' : ' (equal keys go right too, because a separator is a copy of the first key of its right side).') : k + ' < ' + ki(i) + ': stop at slot ' + i + '.') : 'i = ' + i + ': past the last key.'; break;
        case 'next-key': say = 'i = ' + i + '.'; memo.eqTold = true; break;
        case 'leaf-test': say = xn.leaf ? 'This is a leaf: ' + k + ' goes in at slot ' + i + '.' : 'An inner node holds only signposts. Go down child ' + i + ' (' + gapName(xn, i) + ').'; break;
        case 'loop-room': say = e.j > i ? 'Slot ' + e.j + ' takes the key from slot ' + (e.j - 1) + '.' : 'Slot ' + i + ' is free.'; break;
        case 'shift-key': say = ki(e.j) + ' moves one slot right.'; break;
        case 'shift-child': say = 'Its child pointer moves along with it.'; break;
        case 'place': say = 'x->key[' + i + '] = ' + k + '.'; break;
        case 'count': say = 'x->n is now ' + xn.n + ': ' + nm(xn) + (xn.n > MAXK ? '. That is one key more than MAXK = ' + MAXK + ': the spare slot is in use.' : '.'); break;
        case 'recurse': say = 'insert_rec(x->child[' + i + '], ' + k + ', &sep): go down one level. This call waits here for the answer.'; break;
        case 'no-split': say = d.cursors.z ? 'The child split: z is its new right half, and sep holds the separator for it.' : 'The child did not split (z is NULL).'; break;
        case 'unchanged': say = 'Nothing to do at this level: return NULL to the caller too.'; break;
        case 'take-sep': say = 'x->key[' + i + '] = sep: ' + ki(i) + ' arrives from below and becomes a signpost here.'; break;
        case 'take-z': say = 'x->child[' + (i + 1) + '] = z: the new right half hangs right after the old node.'; break;
        case 'overflow': say = xn.n <= MAXK ? nm(xn) + ' has ' + xn.n + ' of ' + MAXK + ' keys: it fits.' : nm(xn) + ' has ' + xn.n + ' keys, one too many. It must split.'; break;
        case 'fits': say = 'Return NULL: no split here, so the parent has nothing to add.'; break;
        case 'split': say = xn.leaf ? 'split_leaf(x, up): split the leaf.' : 'split_internal(x, up): split the inner node.'; break;
        case 'new-z': say = 'z = a new ' + (fn === 'split_leaf' ? 'leaf' : 'inner node') + ' for the top half of ' + nm(xn) + '.'; break;
        case 'half': say = 'half = ' + e.half + ': x keeps its first ' + e.half + ' keys.'; break;
        case 'z-size': say = fn === 'split_leaf' ? 'z gets the other ' + plural(by.get(z).n, 'key') + '.' : 'z gets the keys after the middle one: ' + plural(by.get(z).n, 'key') + '. The middle key goes to neither half.'; break;
        case 'loop-keys': { const zn = by.get(z); say = zn && e.j < zn.n ? 'j = ' + e.j + ': the next key for z.' : 'z has all its keys.'; break; }
        case 'loop-kids': { const zn = by.get(z); say = zn && e.j <= zn.n ? 'j = ' + e.j + ': the next child pointer for z.' : 'z has all its children.'; break; }
        case 'move-key': say = 'z->key[' + e.j + '] = ' + (by.get(z) ? by.get(z).key[e.j] : '') + ': it moves across.'; break;
        case 'move-child': say = 'A child of x now belongs to z.'; break;
        case 'x-size': say = 'x->n = ' + e.half + ': x keeps ' + nm(xn) + '.'; break;
        case 'chain-z': say = 'z->next = x->next: z points to the leaf that followed x' + (by.get(z) && by.get(z).next ? ' (' + nm(by.get(by.get(z).next)) + ')' : ' (none: x was the last leaf)') + '.'; break;
        case 'chain-x': say = 'x->next = z: the chain now runs x, z, then the rest. A walk along the leaves still meets every key in order.'; break;
        case 'copy-up': say = '*up = z->key[0] = ' + memo.up.v + '. Only a copy goes up: ' + memo.up.v + ' stays in the leaf, because every key must be in a leaf.'; break;
        case 'push-up': say = '*up = x->key[' + e.half + '] = ' + memo.up.v + '. In an inner node the middle key moves up and is not kept below: it was only a signpost, and the real ' + memo.up.v + ' is still in its leaf.'; break;
        case 'ret-z': say = 'Return z; the caller links it in.'; break;
        case 'root-split': say = d.cursors.z || (ctx.ticks[ctx.i + 1] && ctx.ticks[ctx.i + 1].tag === 'grow') ? 'Even the root split. A new root is needed.' : 'The root did not split.'; break;
        case 'same-root': say = 'The root stays the same.'; break;
        case 'grow': say = 'grow(root, ' + (memo.up ? memo.up.v : '') + ', z): a new root with one signpost and two children. The tree is one level taller; every leaf is still on the bottom row.'; break;
        case 'after': { const leaves = d.nodes.filter((n) => !n.freed && n.leaf).length; say = k + ' is in. ' + (memo.splits ? 'Splits: ' + memo.splits.join(', then ') + '. ' : 'No split was needed. ') + 'The ' + plural(leaves, 'leaf', 'leaves') + ' still hold every key once, in order along the chain.'; break; }
      }
      if (tag === 'take-sep' || tag === 'grow') memo.up = null;
      remember(ctx, pic);
      return { items, say, slow: ['copy-up', 'push-up', 'take-sep', 'chain-x', 'grow', 'place'].includes(tag) };
    },
    predict: [
      {
        at: (t, i, ts) => t.tag === 'overflow' && ts[i + 1] && ts[i + 1].tag === 'split' && t.data.nodes.some((n) => n.addr === t.data.cursors.x && n.leaf),
        once: true,
        ask: 'This leaf has one key too many. Which key will go up to the parent as a copy?',
        options: (ts, i) => { const d = ts[i].data, n = d.nodes.find((m) => m.addr === d.cursors.x); return n.key.slice(0, n.n).map(String); },
        answer: (ts, i) => { const d = ts[i].data, n = d.nodes.find((m) => m.addr === d.cursors.x); return String(n.key[2]); },
        pick: 'option',
        explain: () => 'The leaf keeps its first two keys; the new leaf starts with the third, and a copy of that first key becomes the separator.',
      },
      {
        at: (t, i, ts) => t.tag === 'overflow' && ts[i + 1] && ts[i + 1].tag === 'split' && t.data.nodes.some((n) => n.addr === t.data.cursors.x && !n.leaf),
        once: true,
        ask: 'Now an inner node has one key too many. Which key moves up?',
        options: (ts, i) => { const d = ts[i].data, n = d.nodes.find((m) => m.addr === d.cursors.x); return n.key.slice(0, n.n).map(String); },
        answer: (ts, i) => { const d = ts[i].data, n = d.nodes.find((m) => m.addr === d.cursors.x); return String(n.key[2]); },
        pick: 'option',
        explain: () => 'The middle key (index 2) moves up and leaves the node; two keys stay left, one goes right.',
      },
      {
        at: (t) => t.tag === 'enter', once: true,
        ask: 'Will this insertion add a level to the tree?',
        options: () => ['Yes', 'No'],
        answer: (ts) => (ts.some((t) => t.tag === 'grow') ? 'Yes' : 'No'),
        pick: 'option',
        explain: () => 'Only when the split climbs all the way and the root itself splits.',
      },
    ],
    quiz: [
      { q: 'When a B+ tree leaf splits, what goes up to the parent?', options: ['The middle key, removed from the leaf', 'A copy of the first key of the new right leaf', 'Nothing', 'The whole leaf'], answer: 1, why: 'All keys must stay in leaves, so the leaf keeps the key and the parent gets a copy to steer searches.' },
      { q: 'When an inner node splits, its middle key...', options: ['Is copied up and kept', 'Moves up and is not kept below', 'Is deleted', 'Goes to a leaf'], answer: 1, why: 'Inner keys are only signposts; the real key is already in a leaf, so the signpost can move.' },
      { q: 'Why are the leaves linked into a chain?', options: ['To save memory', 'So a range of keys can be read by walking sideways, without going back up', 'To balance the tree', 'For deletion only'], answer: 1, why: 'Find the first leaf once, then follow next pointers: that is what makes range queries fast.' },
      { q: 'A key equal to a separator is found...', options: ['In the left child', 'In the right child', 'In the inner node', 'Anywhere'], answer: 1, why: 'The separator is a copy of the first key of its right side, so the search goes right on equality (k >= key[i]).' },
      { q: 'Compared with this B+ tree insert, the B-tree insert in the other topic...', options: ['Splits full nodes on the way down, before they overflow', 'Never splits', 'Splits only leaves', 'Splits after the insert, walking back up'], answer: 0, why: 'This one is reactive: overflow, then split on the way back up. The B-tree topic is proactive.' },
    ],
    compareWith: 'btree-insert',
  });

  // ---- range query -------------------------------------------------------------------------------------------
  X.topic({
    id: 'bplus-range', family: 'bplus', order: 20, title: 'Range query',
    blurb: 'Go down once, to the leaf where lo would be. From there, never go up again: walk right along the leaf chain, printing keys until one is bigger than hi.',
    code: `/* print every key from lo to hi, in increasing order */
void range(struct bpnode *root, int lo, int hi)
{
    struct bpnode *x = root;                   /*@ start */
    int i;
    while (!x->leaf) {                         /*@ inner-test */
        i = 0;                                 /*@ scan */
        while (i < x->n && lo >= x->key[i])    /*@ compare */
            i++;                               /*@ next-key */
        x = x->child[i];                       /*@ follow */
    }
    i = 0;                                     /*@ leaf */
    while (i < x->n && x->key[i] < lo)         /*@ compare-lo */
        i++;                                   /*@ skip */
    while (x != NULL) {                        /*@ walk */
        for (; i < x->n; i++) {                /*@ loop */
            if (x->key[i] > hi)                /*@ test-hi */
                return;                        /*@ stop */
            printf("%d ", x->key[i]);          /*@ print */
        }
        x = x->next;                           /*@ advance */
        i = 0;                                 /*@ reset */
    }
}`,
    animate: ['range'],
    inputs: [Object.assign({}, keysIn, { def: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35] }), { id: 'lo', kind: 'int', label: 'From (lo)', def: 25, lo: 0, hi: 999 }, { id: 'hi', kind: 'int', label: 'To (hi)', def: 65, lo: 0, hi: 999 }],
    check: (inp) => (inp.lo > inp.hi ? 'From must not be bigger than To' : null),
    presets: [
      { label: 'Across several leaves', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35], lo: 25, hi: 65 } },
      { label: 'Inside one leaf', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35], lo: 31, hi: 39 } },
      { label: 'Starts in the next leaf', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35], lo: 42, hi: 62 } },
      { label: 'Nothing in range', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35], lo: 41, hi: 49 } },
      { label: 'Everything', values: { keys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 25, 35], lo: 0, hi: 999 } },
    ],
    counters: ['compares', 'follows'],
    main: (inp) => `int main(void)
{
    int keys[] = { ${inp.keys.length ? inp.keys.join(', ') : '0'} };
    struct bpnode *root = new_node(1);
    int i;
    for (i = 0; i < ${inp.keys.length}; i++)
        root = insert(root, keys[i]);
    range(root, ${inp.lo}, ${inp.hi});
    printf("\\n");
    return 0;
}`,
    capture: (P) => B.capture(P, { type: ['x', 'root'], root: 'root', cursors: ['x'], extra: (P) => ({ i: P.has('i', 0) && P.isSet('i', 0) ? P.val('i', 0) : null }) }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo, lo = ctx.input.lo, hi = ctx.input.hi;
      const x = d.cursors.x, i = d.extra.i;
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      const xn = by.get(x);
      memo.down = memo.down || [];
      memo.leaves = memo.leaves || [];
      memo.out = memo.out || [];
      memo.walked = memo.walked || new Set();
      if (xn && !memo.walking && !memo.down.includes(x)) memo.down.push(x);
      if (tag === 'leaf') { memo.walking = true; memo.leaves.push(x); }
      if (tag === 'advance' && ctx.prev) { memo.walked.add(ctx.prev.data.cursors.x); if (x) memo.leaves.push(x); }
      if (tag === 'print') memo.out.push(xn.key[i]);
      const out = new Set(memo.out);
      const down = new Set(memo.down), leaves = new Set(memo.leaves);
      const pic = B.picture(ctx, d, {
        cap: CAP, over: MAXK, gap: 44, keyName, chain: true,
        frameCls: (n) => (n.addr === x && tag !== 'after' ? 'focus' : down.has(n.addr) || leaves.has(n.addr) ? 'path' : memo.walking && !n.leaf ? 'faded' : ''),
        keyCls: (n, j, v) => {
          if (n.leaf && out.has(v)) return 'out';
          if (n.addr === x && j === i && ['compare', 'compare-lo', 'test-hi'].includes(tag)) return tag === 'test-hi' && v > hi ? 'doomed' : 'hot';
          if (n.addr === x && j === i && tag === 'print') return 'good';
          return '';
        },
        edgeCls: (a, c) => (down.has(a) && down.has(c) ? 'path' : ''),
        nextCls: (n) => (tag === 'advance' && ctx.prev && n.addr === ctx.prev.data.cursors.x ? 'hot' : memo.walked.has(n.addr) ? 'walked' : ''),
      });
      const items = pic.items;
      // the output: printed keys drop into a tray under the leaves
      const leafRow = [...pic.pos.values()].filter((p) => p.y === 0);
      const x0 = leafRow.length ? Math.min(...leafRow.map((p) => p.x)) : 0;
      const ty = pic.H + 70;
      items.push({ key: 'tray', kind: 'region', x: x0, y: ty, w: Math.max(300, (memo.out.length + 1) * 46 + 150), h: 52, cls: 'mw-tray' });
      items.push({ key: 'trayl', kind: 'text', x: x0 + 12, y: ty + 31, text: 'printed:', cls: 'mw-note' });
      memo.out.forEach((v, j) => {
        const from = memo.cells && memo.cells.get('L' + v);
        items.push({ key: 'o' + v, kind: 'cell', x: x0 + 80 + j * 46, y: ty + 9, w: B.KW - 4, h: B.KH - 4, text: v, cls: 'mw-key mw-good', enter: from ? 'fly' : 'fade', from });
      });
      items.push({ key: 'range', kind: 'text', x: x0, y: ty - 14, text: 'range(' + lo + ', ' + hi + ')', cls: 'mw-tag' });
      if (xn && pic.pos.has(x) && tag !== 'after') {
        if (i !== null && !['start', 'scan', 'follow', 'advance'].includes(tag)) items.push(B.index('i', x, Math.min(i, CAP - 1), !xn.leaf && tag !== 'scan'));
        items.push(B.cursor('x', x, 0, 'c-teal', CAP));
      }
      const ki = (j) => (xn && j < xn.n ? xn.key[j] : null);
      let say = '';
      switch (tag) {
        case 'enter': say = 'range(root, ' + lo + ', ' + hi + '): two phases. First go down to the one leaf where ' + lo + ' would be; then walk right along the leaves.'; break;
        case 'start': say = 'x = root ' + nm(xn) + '.'; break;
        case 'inner-test': say = xn.leaf ? 'x is a leaf: the descent is over after ' + plural(memo.down.length, 'node') + '.' : 'x is an inner node: pick the child where ' + lo + ' belongs.'; break;
        case 'scan': say = 'i = 0.'; break;
        case 'compare': say = i < xn.n ? (lo >= ki(i) ? lo + ' ≥ ' + ki(i) + ': further right.' : lo + ' < ' + ki(i) + ': stop.') : 'Past the last signpost.'; break;
        case 'next-key': say = 'i = ' + i + '.'; break;
        case 'follow': say = 'x = x->child[' + (ctx.prev && ctx.prev.data.extra.i) + ']: down to ' + nm(xn) + '.'; break;
        case 'leaf': say = 'In the leaf ' + nm(xn) + '. The search part is done: from here on the tree above is never used again.'; break;
        case 'compare-lo': say = i < xn.n ? (ki(i) < lo ? ki(i) + ' < ' + lo + ': too small, skip it.' : ki(i) + ' ≥ ' + lo + ': the range starts here.') : 'Every key in this leaf is smaller than ' + lo + ': the first key in range, if any, is in the next leaf.'; break;
        case 'skip': say = 'i = ' + i + '.'; break;
        case 'walk': say = x ? 'x is the leaf ' + nm(xn) + '.' : 'x is NULL: the chain has ended.'; break;
        case 'loop': say = i < xn.n ? 'Look at key[' + i + '] = ' + ki(i) + '.' : 'The end of this leaf.'; break;
        case 'test-hi': say = ki(i) > hi ? ki(i) + ' > ' + hi + ': past the end of the range.' : ki(i) + ' ≤ ' + hi + ': in range.'; break;
        case 'stop': say = 'Stop. Everything further right is bigger still.'; break;
        case 'print': say = 'Print ' + ki(i) + '.'; break;
        case 'advance': say = x ? 'x = x->next: sideways to the next leaf ' + nm(xn) + ', with no climb back up the tree.' : 'x = x->next is NULL: that was the last leaf.'; break;
        case 'reset': say = 'i = 0: start at its first key.'; break;
        case 'after': say = (memo.out.length ? 'Printed ' + plural(memo.out.length, 'key') + ': ' + memo.out.join(', ') + '.' : 'Nothing was in the range.') + ' Cost: ' + plural(memo.down.length, 'node') + ' on the way down, then ' + plural(memo.leaves.length, 'leaf', 'leaves') + ' along the chain.'; break;
      }
      remember(ctx, pic);
      return { items, say, slow: tag === 'advance' || tag === 'stop' };
    },
    predict: [
      {
        at: (t, i, ts) => t.tag === 'leaf',
        once: true,
        ask: 'How many leaves will the walk visit, counting this one?',
        options: () => ['1', '2', '3', '4', '5'],
        answer: (ts, i) => String(Math.min(5, 1 + ts.slice(i).filter((t) => t.tag === 'advance' && t.data.cursors.x).length)),
        pick: 'option',
        explain: () => 'It keeps going right until a key is bigger than hi or the chain ends.',
      },
      {
        at: (t, i, ts) => t.tag === 'loop' && ts[i + 1] && ts[i + 1].tag === 'test-hi' && !ts.slice(0, i).some((u) => u.tag === 'test-hi'),
        once: true,
        ask: 'Which key will be the last one printed?',
        options: (ts, i, ctx) => { const all = ctx.input.keys.slice().sort((a, b) => a - b).filter((v) => v >= ctx.input.lo); return all.slice(0, 5).map(String).concat(['none']); },
        answer: (ts, i, ctx) => { const r = ctx.input.keys.filter((v) => v >= ctx.input.lo && v <= ctx.input.hi).sort((a, b) => a - b); const all = ctx.input.keys.slice().sort((a, b) => a - b).filter((v) => v >= ctx.input.lo).slice(0, 5); return r.length && all.includes(r[r.length - 1]) ? String(r[r.length - 1]) : r.length ? null : 'none'; },
        pick: 'option',
        explain: (ts, i, ctx) => 'The largest key that is not bigger than ' + ctx.input.hi + '.',
      },
    ],
    quiz: [
      { q: 'How does a B+ tree find all keys between lo and hi?', options: ['Searches each key separately from the root', 'Goes down once to lo\'s leaf, then follows the leaf chain', 'Visits every node', 'Uses only the inner nodes'], answer: 1, why: 'One descent costs the height of the tree; after that each step sideways reaches the next keys in order.' },
      { q: 'Why does a plain B-tree make range queries harder?', options: ['Its keys are unsorted', 'Keys are spread over all levels and leaves are not linked, so you must go up and down', 'It has no leaves', 'It cannot store ranges'], answer: 1, why: 'An in-order walk of a B-tree climbs back through inner nodes; a B+ tree keeps every key in the linked bottom row.' },
      { q: 'The walk stops when...', options: ['It reaches the root', 'It sees a key bigger than hi, or the chain ends', 'It has printed 10 keys', 'It reaches a full leaf'], answer: 1, why: 'Keys along the chain only grow, so the first key above hi means nothing later can be in range.' },
      { q: 'The descent uses lo >= key[i] to go right. Why the =?', options: ['A typo', 'A separator equal to lo is the first key of its right side, so lo is found there', 'To skip lo', 'To go left'], answer: 1, why: 'Separators are copies of the first key of the right subtree.' },
    ],
  });
})(SEE);
