// Splay trees: the family, access (search and splay) and insert.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, T = X.TreeKit;

  const SPLAY = `/* lift x one level: it takes its parent's place and the parent becomes its child */
void rotate(struct node *x)
{
    struct node *p = x->parent;
    struct node *g = p->parent;
    if (p->left == x) {               /* x is a left child: rotate right */
        p->left = x->right;
        if (x->right != NULL)
            x->right->parent = p;
        x->right = p;
    } else {                          /* x is a right child: rotate left */
        p->right = x->left;
        if (x->left != NULL)
            x->left->parent = p;
        x->left = p;
    }
    p->parent = x;
    x->parent = g;
    if (g == NULL)
        root = x;
    else if (g->left == p)
        g->left = x;
    else
        g->right = x;
}

/* bring x up to the root, two levels at a time */
void splay(struct node *x)
{
    struct node *p, *g;
    while (x->parent != NULL) {                         /*@ loop */
        p = x->parent;                                  /*@ p */
        g = p->parent;                                  /*@ g */
        if (g == NULL)                                  /*@ test-zig */
            rotate(x);                                  /*@ zig */
        else if ((g->left == p) == (p->left == x)) {    /*@ test-zigzig */
            rotate(p);                                  /*@ zigzig-1 */
            rotate(x);                                  /*@ zigzig-2 */
        } else {
            rotate(x);                                  /*@ zigzag-1 */
            rotate(x);                                  /*@ zigzag-2 */
        }
    }
}`;

  X.family({
    id: 'splay', order: 5, group: 'Balanced trees', title: 'Splay trees',
    blurb: 'A binary search tree that moves every key it touches to the root, by rotations in pairs. Nothing is stored to keep it balanced, yet a long run of operations is fast on average.',
    head: `#include <stdio.h>
#include <stdlib.h>

/* a binary search tree node that also knows its parent */
struct node {
    int key;
    struct node *left;
    struct node *right;
    struct node *parent;
};

struct node *root = NULL;

struct node *new_node(int key, struct node *parent)
{
    struct node *n = malloc(sizeof *n);
    n->key = key;
    n->left = NULL;
    n->right = NULL;
    n->parent = parent;
    return n;
}

/* main uses this to build the tree you chose: a plain BST insert, with no splaying,
   so the order of the keys decides the shape */
void add(int key)
{
    struct node *p = NULL;
    struct node *cur = root;
    while (cur != NULL) {
        p = cur;
        cur = key < cur->key ? cur->left : cur->right;
    }
    if (p == NULL)
        root = new_node(key, NULL);
    else if (key < p->key)
        p->left = new_node(key, p);
    else
        p->right = new_node(key, p);
}`,
  });

  const keysIn = { id: 'keys', kind: 'ints', label: 'Keys, placed in this order (plain BST)', def: [50, 30, 70, 20, 40, 60, 80, 10, 25, 5], min: 0, max: 14, distinct: true, check: (v) => (v.some((x) => x < -99 || x > 999) ? 'Keys: from -99 to 999' : null) };
  const splayMain = (inp, call) => `int main(void)
{
    int keys[] = { ${inp.keys.length ? inp.keys.join(', ') : '0'} };
    int i;
    for (i = 0; i < ${inp.keys.length}; i++)
        add(keys[i]);
    ${call}
    return 0;
}`;
  const capture = (names) => (P) => T.capture(P, { root: 'root', cursors: names, fields: ['key'], extra: (P) => ({ fn: P.frames[0].name }) });
  const depthMap = (d) => {
    const by = new Map(d.nodes.map((n) => [n.addr, n]));
    const m = new Map();
    const go = (a, k) => { if (!a || !by.has(a) || m.has(a) || k > 40) return; m.set(a, k); const n = by.get(a); go(n.links.left, k + 1); go(n.links.right, k + 1); };
    go(d.root, 0);
    return m;
  };
  const plural = (k, w, ws) => k + ' ' + (k === 1 ? w : ws || w + 's');
  const CASES = { zig: 'zig: the parent is the root, one rotation', 'zigzig-1': 'zig-zig: same side twice, rotate p first, then x', 'zigzig-2': 'zig-zig: same side twice, rotate p first, then x', 'zigzag-1': 'zig-zag: a bend, rotate x twice', 'zigzag-2': 'zig-zag: a bend, rotate x twice' };

  /** The shared splay picture: x, p, g, the case being done, the edges a rotation changed */
  function splayScene(ctx, opts) {
    const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo;
    const c = d.cursors;
    const by = new Map(d.nodes.map((n) => [n.addr, n]));
    const inSplay = d.extra.fn === 'splay';
    // rotate() is quiet: its line is drawn after the rotation, but splay's p and g are from before it
    const x = inSplay ? c.x : null;
    const p = inSplay && !/^zig/.test(tag) ? c.p : null, g = inSplay && !/^zig/.test(tag) ? c.g : null;
    const depth = depthMap(d);
    const pic = T.picture(ctx, d, {
      nodeCls: (n) => (n.addr === x ? 'mw-x' : n.addr === p ? 'mw-p' : n.addr === g ? 'mw-g' : opts.nodeCls ? opts.nodeCls(n) : ''),
      label: opts.label ? (n) => opts.label(n, depth) : null,
      edgeCls: (n, side) => (opts.edgeCls ? opts.edgeCls(n, side) : ''),
      showNull: false,
    });
    const items = pic.items.filter((it) => it.kind !== 'cursor');
    const tag2 = (name, a, slot) => { if (a && pic.pos.has(a)) items.push({ key: 'c' + name, kind: 'cursor', at: 'n' + a, side: 'left', slot: slot || 0, text: name, cls: X.ListKit.cursorCls(name) }); };
    if (inSplay) { tag2('x', x); tag2('p', p); tag2('g', g); }
    for (const [name, a] of Object.entries(opts.cursors || {})) tag2(name, a);
    // the case being done, over the tree
    if (CASES[tag] || memo.lastCase) {
      if (CASES[tag]) memo.lastCase = CASES[tag];
      const xs = [...pic.pos.values()].map((q) => q.x);
      const minX = xs.length ? Math.min(...xs) : 0;
      if (inSplay && !['loop'].includes(tag) || CASES[tag]) items.push({ key: 'case', kind: 'text', x: minX - 30, y: -150, text: memo.lastCase, cls: 'mw-tag' });
    }
    return { items, pic, by, depth, x, p, g, inSplay };
  }

  /** Narration for the lines of splay() */
  function splaySay(ctx, s) {
    const tag = ctx.tick.tag, d = ctx.tick.data, c = d.cursors;
    const k = (a) => (a && s.by.has(a) ? s.by.get(a).key : 'NULL');
    const xd = s.depth.get(c.x);
    switch (tag) {
      case 'loop': return c.x && s.by.get(c.x) && d.root === c.x ? k(c.x) + ' has no parent: it is the root. The splay is over.' : k(c.x) + ' is at depth ' + xd + ': it still has a parent, so keep lifting it.';
      case 'p': return 'p = ' + k(c.p) + ', the parent of x.';
      case 'g': return c.g ? 'g = ' + k(c.g) + ', the grandparent.' : 'g = NULL: p is the root.';
      case 'test-zig': return c.g ? 'There is a grandparent, so x can go up two levels in one step.' : 'No grandparent: a single rotation finishes the job (the zig case).';
      case 'zig': return 'Zig: rotate(x) lifts ' + k(c.x) + ' above ' + k(c.p) + '. ' + k(c.x) + ' is now the root.';
      case 'test-zigzig': { const by = s.by, g = by.get(c.g), p = by.get(c.p); const same = (g.links.left === c.p) === (p.links.left === c.x); return 'Is x on the same side of p as p is of g? ' + (same ? 'Yes, both ' + (p.links.left === c.x ? 'left' : 'right') + ': a straight line, the zig-zig case.' : 'No: the path bends, the zig-zag case.'); }
      case 'zigzig-1': return 'Zig-zig, part 1: rotate(p) first. ' + k(c.p) + ' goes up above ' + k(c.g) + ', taking ' + k(c.x) + ' with it. Rotating the parent first is what halves the depth of the whole path.';
      case 'zigzig-2': return 'Zig-zig, part 2: rotate(x): ' + k(c.x) + ' goes above ' + k(c.p) + '. Two levels up, now at depth ' + xd + '.';
      case 'zigzag-1': return 'Zig-zag, part 1: rotate(x): ' + k(c.x) + ' goes above ' + k(c.p) + ', straightening the bend.';
      case 'zigzag-2': return 'Zig-zag, part 2: rotate(x) again: ' + k(c.x) + ' goes above ' + k(c.g) + '. ' + k(c.p) + ' and ' + k(c.g) + ' end up as its two children. Now at depth ' + xd + '.';
    }
    return null;
  }

  const splayPredicts = [
    {
      at: (t, i, ts) => t.tag === 'test-zig' && t.data.cursors.g,
      once: true,
      ask: 'x has a grandparent. Which case is this?',
      options: () => ['zig-zig', 'zig-zag'],
      answer: (ts, i) => { for (let j = i + 1; j < ts.length; j++) { if (ts[j].tag === 'zigzig-1') return 'zig-zig'; if (ts[j].tag === 'zigzag-1') return 'zig-zag'; } return null; },
      pick: 'option',
      explain: () => 'Zig-zig when x and p are both left children or both right children; zig-zag when one is left and the other right.',
    },
    {
      at: (t, i, ts) => t.tag === 'test-zigzig' && ts[i + 1] && ts[i + 1].tag === 'zigzig-1',
      once: true,
      ask: 'A zig-zig. Which node is rotated first? Click it.',
      answer: (ts, i) => 'n' + ts[i].data.cursors.p,
      explain: () => 'In a zig-zig the parent p goes first, then x. Rotating x twice would not shorten the path as much.',
    },
  ];

  // ---- access --------------------------------------------------------------------------------------------------
  X.topic({
    id: 'splay-access', family: 'splay', order: 10, title: 'Access (zig, zig-zig, zig-zag)',
    blurb: 'Search as in any BST, then splay: the node found climbs to the root in zig, zig-zig and zig-zag steps, and every node on its path gets roughly half as deep.',
    code: SPLAY + `

/* find key and splay it to the root; if it is missing, splay the last node met */
struct node *access(int key)
{
    struct node *cur = root;                           /*@ start */
    struct node *last = NULL;
    while (cur != NULL && cur->key != key) {           /*@ test */
        last = cur;                                    /*@ last */
        if (key < cur->key)                            /*@ compare */
            cur = cur->left;                           /*@ follow-left */
        else
            cur = cur->right;                          /*@ follow-right */
    }
    if (cur == NULL)                                   /*@ found-test */
        cur = last;                                    /*@ use-last */
    if (cur != NULL)                                   /*@ nonempty */
        splay(cur);                                    /*@ splay */
    return cur;                                        /*@ done */
}`,
    animate: ['rotate', 'splay', 'access'], quiet: ['rotate'],
    inputs: [keysIn, { id: 'key', kind: 'int', label: 'Access', def: 5, lo: -99, hi: 999 }],
    presets: [
      { label: 'Deep left: zig-zig twice', values: { keys: [50, 30, 70, 20, 40, 60, 80, 10, 25, 5], key: 5 } },
      { label: 'A bent path: zig-zag', values: { keys: [50, 10, 40, 20, 30, 70], key: 30 } },
      { label: 'A chain from sorted input', values: { keys: [10, 20, 30, 40, 50, 60, 70], key: 70 } },
      { label: 'Just a zig', values: { keys: [50, 30, 70, 20, 40, 60, 80], key: 30 } },
      { label: 'A missing key', values: { keys: [50, 30, 70, 20, 40, 60, 80], key: 45 } },
    ],
    counters: ['compares', 'follows'],
    main: (inp) => splayMain(inp, 'access(' + inp.key + ');'),
    capture: capture(['cur', 'last', 'x', 'p', 'g']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, memo = ctx.memo;
      // the call line is drawn once splay() has started, the return line once access() has returned
      const c = (tag === 'splay' || tag === 'done') && ctx.prev ? ctx.prev.data.cursors : d.cursors;
      memo.path = memo.path || [];
      if (tag === 'last' && c.cur && !memo.path.includes(c.cur)) memo.path.push(c.cur);
      if (tag === 'nonempty' && c.cur && !memo.path.includes(c.cur)) memo.path.push(c.cur);
      if (tag === 'splay' || (tag === 'enter' && d.extra.fn === 'splay')) {
        if (!memo.before) { const dm = depthMap(d); memo.before = new Map(memo.path.map((a) => [a, dm.get(a)])); }
      }
      const onPath = new Set(memo.path);
      const s = splayScene(ctx, {
        nodeCls: (n) => (onPath.has(n.addr) ? 'part-a' : ''),
        label: (n, dm) => (memo.before && memo.before.has(n.addr) ? 'depth ' + memo.before.get(n.addr) + (dm.get(n.addr) !== memo.before.get(n.addr) ? ' → ' + dm.get(n.addr) : '') : ''),
        cursors: d.extra.fn === 'access' ? { cur: c.cur, last: tag === 'last' || tag === 'use-last' ? c.last : null } : {},
      });
      const items = s.items, by = s.by;
      if (d.extra.fn === 'access' && c.cur && s.pic.pos.has(c.cur) && ['test', 'compare', 'last'].includes(tag)) {
        const at = s.pic.pos.get(c.cur), ck = by.get(c.cur).key;
        items.push({ key: 'tok', kind: 'token', x: at.x + 40, y: at.y - 32, r: 15, text: String(key), cls: 'c-rose' });
        if (tag === 'compare') items.push({ key: 'q', kind: 'text', x: at.x + 60, y: at.y - 28, text: key + (key < ck ? ' < ' : ' > ') + ck, cls: 'hot' });
      }
      const k = (a) => (a && by.has(a) ? by.get(a).key : 'NULL');
      let say = splaySay(ctx, s);
      if (say === null) {
        switch (tag) {
          case 'enter': say = d.extra.fn === 'access' ? 'access(' + key + '): first an ordinary search from the root. Then, whatever it finds is splayed up to the root.' : 'splay(x): now lift ' + k(c.x) + ' to the root.'; break;
          case 'start': say = 'cur starts at the root, ' + k(c.cur) + '.'; break;
          case 'test': say = c.cur ? (by.get(c.cur).key === key ? 'cur holds ' + key + ': found it.' : 'cur = ' + k(c.cur) + ', not ' + key + ': keep searching.') : 'cur is NULL: ' + key + ' is not in the tree.'; break;
          case 'last': say = 'last = cur: remember ' + k(c.cur) + ' in case the search falls off the tree.'; break;
          case 'compare': { const ck = by.get(c.cur).key; say = 'Compare ' + key + ' with ' + ck + ': go ' + (key < ck ? 'left.' : 'right.'); break; }
          case 'follow-left': case 'follow-right': say = 'cur moves to ' + k(c.cur) + '.'; break;
          case 'found-test': say = c.cur ? key + ' is in the tree.' : key + ' is missing.'; break;
          case 'use-last': say = 'Splay the last node the search met, ' + k(c.cur) + ', anyway: the next search near ' + key + ' will be quick.'; break;
          case 'nonempty': say = c.cur ? k(c.cur) + ' is at depth ' + depthMap(d).get(c.cur) + '. It will take about that many rotations to reach the root.' : 'The tree is empty: nothing to splay.'; break;
          case 'splay': say = 'splay(' + k(c.cur) + '): lift it to the root.'; break;
          case 'done': say = 'access() returns ' + k(c.cur) + ', now the root.'; break;
          case 'after': {
            const dm = depthMap(d);
            const parts = memo.before ? [...memo.before].filter(([a]) => by.has(a)).map(([a, b]) => by.get(a).key + ': ' + b + ' → ' + dm.get(a)) : [];
            say = (memo.before ? 'Depth before → after, for the nodes on the search path: ' + parts.join(', ') + '. ' : '') + 'The accessed node is the root. The deep end of its old path moved up, the old top moved down a little: the path was folded roughly in half.';
            break;
          }
          default: say = '';
        }
      }
      return { items, say, slow: /^zig/.test(tag) };
    },
    predict: splayPredicts.concat([
      {
        at: (t, i, ts) => t.tag === 'nonempty' && t.data.cursors.cur,
        once: true,
        ask: 'How many calls to rotate() will it take to bring this node to the root?',
        options: () => ['0', '1', '2', '3', '4', '5', '6'],
        answer: (ts, i) => String(Math.min(6, ts.slice(i).filter((t) => /^zig/.test(t.tag)).length)),
        pick: 'option',
        explain: () => 'One rotation per level: a node at depth d needs d rotations, done in pairs plus perhaps one zig at the end.',
      },
    ]),
    quiz: [
      { q: 'In a zig-zig step, which rotation comes first?', options: ['x with p', 'p with g', 'x with g', 'Either'], answer: 1, why: 'The parent first, then x. That order is what makes the whole path about half as deep.' },
      { q: 'When is the zig case used?', options: ['When x is a leaf', 'When x\'s parent is the root', 'When the path bends', 'Always first'], answer: 1, why: 'With no grandparent, one rotation makes x the root.' },
      { q: 'What does a splay tree store to stay balanced?', options: ['Heights', 'Colours', 'Nothing extra', 'Sizes'], answer: 2, why: 'Only keys and links. It may even be unbalanced; the splaying makes a long run of operations cheap on average.' },
      { q: 'A search for a missing key...', options: ['Changes nothing', 'Splays the last node it reached', 'Inserts the key', 'Deletes a node'], answer: 1, why: 'The last node met is splayed, so the tree still adapts to where the searches go.' },
      { q: 'The amortised cost of a splay-tree operation is...', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], answer: 1, why: 'Any one access may be slow, but a sequence of m operations costs O(m log n) in total.' },
    ],
  });

  // ---- insert --------------------------------------------------------------------------------------------------
  X.topic({
    id: 'splay-insert', family: 'splay', order: 20, title: 'Insert',
    blurb: 'Insert as in a plain BST, so the new key lands as a leaf, perhaps very deep; then splay it all the way to the root.',
    code: SPLAY + `

/* insert key as a leaf, as in a plain BST, then splay it to the root */
void insert(int key)
{
    struct node *p = NULL;                             /*@ start */
    struct node *cur = root;
    struct node *n;
    while (cur != NULL) {                              /*@ test */
        p = cur;                                       /*@ parent */
        if (key < cur->key)                            /*@ compare */
            cur = cur->left;                           /*@ follow-left */
        else
            cur = cur->right;                          /*@ follow-right */
    }
    n = new_node(key, p);                              /*@ new */
    if (p == NULL)                                     /*@ attach-test */
        root = n;                                      /*@ first */
    else if (key < p->key)                             /*@ side */
        p->left = n;                                   /*@ attach-left */
    else
        p->right = n;                                  /*@ attach-right */
    splay(n);                                          /*@ splay */
}`,
    animate: ['rotate', 'splay', 'insert'], quiet: ['rotate', 'new_node'],
    inputs: [Object.assign({}, keysIn, { def: [50, 30, 70, 20, 40, 60, 80] }), { id: 'key', kind: 'int', label: 'Insert', def: 45, lo: -99, hi: 999 }],
    check: (inp) => (inp.keys.includes(inp.key) ? 'That key is already in the tree; pick another' : null),
    presets: [
      { label: 'Into a balanced tree', values: { keys: [50, 30, 70, 20, 40, 60, 80], key: 45 } },
      { label: 'At the end of a chain', values: { keys: [10, 20, 30, 40, 50, 60], key: 70 } },
      { label: 'A new smallest key', values: { keys: [50, 30, 70, 20, 40, 10], key: 5 } },
      { label: 'Under the root: one zig', values: { keys: [50], key: 30 } },
      { label: 'Into an empty tree', values: { keys: [], key: 42 } },
    ],
    counters: ['compares', 'follows', 'allocs'],
    main: (inp) => splayMain(inp, 'insert(' + inp.key + ');'),
    capture: capture(['cur', 'p', 'n', 'x', 'g']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, memo = ctx.memo;
      const c = tag === 'splay' && ctx.prev ? ctx.prev.data.cursors : d.cursors;
      const inIns = d.extra.fn === 'insert';
      const by0 = new Map(d.nodes.map((n) => [n.addr, n]));
      const fresh = d.nodes.find((n) => n.key === key);
      memo.walk = memo.walk || 0;
      if (tag === 'parent') memo.walk++;
      if (['attach-left', 'attach-right', 'first'].includes(tag)) memo.leafDepth = depthMap(d).get(fresh.addr);
      if (/^zig/.test(tag)) memo.rot = (memo.rot || 0) + 1;
      // where the new key was first attached: a faint ring that stays behind
      if (['attach-left', 'attach-right'].includes(tag)) memo.ringAt = fresh.addr;
      const s = splayScene(ctx, {
        nodeCls: (n) => (fresh && n.addr === fresh.addr && !(d.extra.fn === 'splay') ? 'part-b' : ''),
        label: (n, dm) => (fresh && n.addr === fresh.addr && memo.leafDepth !== undefined ? 'depth ' + dm.get(n.addr) : ''),
        cursors: inIns ? { cur: c.cur, p: c.p } : {},
      });
      const items = s.items, by = s.by;
      if (inIns && c.cur && s.pic.pos.has(c.cur) && ['test', 'compare', 'parent'].includes(tag)) {
        const at = s.pic.pos.get(c.cur), ck = by.get(c.cur).key;
        items.push({ key: 'tok', kind: 'token', x: at.x + 40, y: at.y - 32, r: 15, text: String(key), cls: 'c-green' });
        if (tag === 'compare') items.push({ key: 'q', kind: 'text', x: at.x + 60, y: at.y - 28, text: key + (key < ck ? ' < ' : ' > ') + ck + (key < ck ? ': left' : ': right'), cls: 'hot' });
      }
      if (memo.leafDepth !== undefined && memo.leafDepth > 0) items.push({ key: 'was', kind: 'text', x: (s.pic.pos.get(fresh.addr) || { x: 0 }).x, y: -130, text: 'inserted at depth ' + memo.leafDepth + ', ' + (memo.rot || 0) + ' rotation' + (memo.rot === 1 ? '' : 's') + ' so far', cls: 'mw-note', anchor: 'middle' });
      const k = (a) => (a && by0.has(a) ? by0.get(a).key : 'NULL');
      let say = splaySay(ctx, s);
      if (say === null) {
        switch (tag) {
          case 'enter': say = inIns ? 'insert(' + key + '): first exactly what a plain BST does, then one extra step that changes everything: splay the new node.' : 'splay(n): lift the new node ' + key + ' to the root.'; break;
          case 'start': say = 'p will trail one step behind cur, which starts at the root (' + k(c.cur) + ').'; break;
          case 'test': say = c.cur ? 'cur is at ' + k(c.cur) + ': keep walking down.' : 'cur fell off the tree under ' + k(c.p) + ': this is where ' + key + ' goes.'; break;
          case 'parent': say = 'p = cur (' + k(c.cur) + ').'; break;
          case 'compare': { const ck = by0.get(c.cur).key; say = key + (key < ck ? ' < ' : ' > ') + ck + ': go ' + (key < ck ? 'left.' : 'right.'); break; }
          case 'follow-left': case 'follow-right': say = 'cur = ' + k(c.cur) + '.'; break;
          case 'new': say = 'A new node for ' + key + ', with parent ' + k(c.p) + '.'; break;
          case 'attach-test': say = c.p ? 'The tree was not empty.' : 'The tree was empty: the new node becomes the root, and there is nothing to splay.'; break;
          case 'first': say = 'root = n.'; break;
          case 'side': say = key + (key < by0.get(c.p).key ? ' < ' : ' > ') + k(c.p) + ': it hangs on the ' + (key < by0.get(c.p).key ? 'left.' : 'right.'); break;
          case 'attach-left': case 'attach-right': say = 'Linked in as a leaf at depth ' + memo.leafDepth + '. A plain BST would stop here.'; break;
          case 'splay': say = 'splay(n): bring ' + key + ' up to the root.'; break;
          case 'after': say = key + ' went in at depth ' + (memo.leafDepth || 0) + ' and is now the root, after ' + plural(memo.rot || 0, 'rotation') + '. A key you have just used is the cheapest one to reach next.'; break;
          default: say = '';
        }
      }
      return { items, say, slow: /^zig/.test(tag) || tag === 'attach-left' || tag === 'attach-right' };
    },
    predict: splayPredicts.concat([
      {
        at: (t, i, ts) => (t.tag === 'attach-left' || t.tag === 'attach-right'),
        once: true,
        ask: 'How many rotations will the splay take?',
        options: () => ['1', '2', '3', '4', '5', '6'],
        answer: (ts, i) => String(Math.min(6, ts.slice(i).filter((t) => /^zig/.test(t.tag)).length)),
        pick: 'option',
        explain: () => 'As many as the depth where the new node was attached.',
      },
    ]),
    quiz: [
      { q: 'After inserting into a splay tree, where is the new key?', options: ['In a leaf', 'At the root', 'Wherever a BST would put it', 'Next to its parent'], answer: 1, why: 'It is inserted as a leaf, then splayed all the way up.' },
      { q: 'Inserting 1, 2, 3, ..., n into an empty splay tree gives...', options: ['A balanced tree', 'A chain, but each insert costs only one rotation', 'An error', 'A tree of height log n'], answer: 1, why: 'Each new key is bigger than the root, attaches at depth 1, and one zig brings it up: a left-leaning chain, built cheaply. Searching the deep end later is slow once, then the tree reshapes.' },
      { q: 'Why splay the new node rather than leave it as a leaf?', options: ['To free memory', 'Recently used keys tend to be used again, and the root is the cheapest place', 'To keep heights equal', 'The BST rules require it'], answer: 1, why: 'Splay trees bet on locality: what was touched recently stays near the top.' },
      { q: 'Each rotation...', options: ['Changes the in-order sequence', 'Keeps the in-order sequence and moves one node up a level', 'Deletes a node', 'Swaps two keys'], answer: 1, why: 'A rotation only re-hangs three links; the keys stay in order from left to right.' },
    ],
    compareWith: 'bst-insert',
  });
})(SEE);
