// Red-black trees: the family, rotations with parent pointers, insertion and deletion. Nodes are red or
// black; NIL is one shared black sentinel, drawn as a small black box when it matters (a NIL uncle, a
// NIL carrying the extra black). Rotations hold the picture still while the six pointers change, then
// the nodes glide; recoloured nodes pulse.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, B = X.BalanceKit;

  X.family({
    id: 'rbt', order: 2, group: 'Balanced trees', title: 'Red-black trees',
    blurb: 'Every node is red or black. No red node has a red child, and every path down to NIL passes the same number of black nodes. That keeps the tree within twice the best height.',
    head: `#include <stdio.h>
#include <stdlib.h>

#define RED   0
#define BLACK 1

/* a red-black node: a key, a colour, two children and a parent */
struct node {
    int key;
    int color;
    struct node *left;
    struct node *right;
    struct node *parent;
};

/* the sentinel: one black node standing for every empty child and for the root's parent */
struct node sentinel = { 0, BLACK, NULL, NULL, NULL };
struct node *NIL = &sentinel;
struct node *root = &sentinel;

struct node *new_node(int key, int color)
{
    struct node *n = malloc(sizeof *n);
    n->key = key;
    n->color = color;
    n->left = NIL;
    n->right = NIL;
    n->parent = NIL;
    return n;
}

/* the node holding key, or NIL */
struct node *find(int key)
{
    struct node *n = root;
    while (n != NIL && n->key != key)
        n = key < n->key ? n->left : n->right;
    return n;
}

/* main uses this to set up the tree you chose (keys and colours), before the animation starts */
void add(int key, int color)
{
    struct node *n = new_node(key, color);
    struct node *p = NIL, *cur = root;
    while (cur != NIL) {
        p = cur;
        cur = key < cur->key ? cur->left : cur->right;
    }
    n->parent = p;
    if (p == NIL)
        root = n;
    else if (key < p->key)
        p->left = n;
    else
        p->right = n;
}`,
  });

  /** main: rebuild the red-black tree your keys make (keys in level order with their colours), then the call */
  const rbMain = (keys, call) => {
    const t = B.rbTree(keys);
    const lv = B.levelOrder(t);
    return `int main(void)
{
    /* your keys, in an order that rebuilds the tree they make, with the colour of each */
    int keys[] = { ${lv.length ? lv.map((n) => n.key).join(', ') : '0'} };
    int colors[] = { ${lv.length ? lv.map((n) => (n.red ? 'RED' : 'BLACK')).join(', ') : 'BLACK'} };
    int i;
    for (i = 0; i < ${lv.length}; i++)
        add(keys[i], colors[i]);
    ${call}
    return 0;
}`;
  };
  X.rbMain = rbMain;

  const ROT = `/* x's right child y comes up; x goes down to the left */
void rotate_left(struct node *x)
{
    struct node *y = x->right;          /*@ l-y */
    x->right = y->left;                 /*@ l-beta */
    if (y->left != NIL)                 /*@ l-beta-test */
        y->left->parent = x;            /*@ l-beta-up */
    y->parent = x->parent;              /*@ l-up */
    if (x->parent == NIL)               /*@ l-where */
        root = y;                       /*@ l-root */
    else if (x == x->parent->left)      /*@ l-side */
        x->parent->left = y;            /*@ l-plink */
    else
        x->parent->right = y;           /*@ l-plink */
    y->left = x;                        /*@ l-down */
    x->parent = y;                      /*@ l-parent */
}                                       /*@ l-end */

/* x's left child y comes up; x goes down to the right */
void rotate_right(struct node *x)
{
    struct node *y = x->left;           /*@ r-y */
    x->left = y->right;                 /*@ r-beta */
    if (y->right != NIL)                /*@ r-beta-test */
        y->right->parent = x;           /*@ r-beta-up */
    y->parent = x->parent;              /*@ r-up */
    if (x->parent == NIL)               /*@ r-where */
        root = y;                       /*@ r-root */
    else if (x == x->parent->right)     /*@ r-side */
        x->parent->right = y;           /*@ r-plink */
    else
        x->parent->left = y;            /*@ r-plink */
    y->right = x;                       /*@ r-down */
    x->parent = y;                      /*@ r-parent */
}                                       /*@ r-end */`;

  const CUR = { x: 'c-teal', y: 'c-amber', z: 'c-violet', p: 'c-amber', g: 'c-indigo', u: 'c-teal', w: 'c-violet', n: 'c-teal' };
  const RED = 0;
  const capture = (cursors) => (P, tk) => B.capture(P, { fields: ['key', 'color'], links: ['left', 'right', 'parent'], nil: 'NIL', cursors }, tk);
  const keyOf = (d, a) => { if (a && a === d.nil) return 'NIL'; const n = a && d.nodes.find((q) => q.addr === a); return n ? n.key : 'NIL'; };
  const isRed = (d, a) => { const n = a && a !== d.nil && d.nodes.find((q) => q.addr === a); return !!(n && n.color === RED); };
  const colName = (d, a) => (isRed(d, a) ? 'red' : 'black');

  /** Black height along every path, or null if paths differ */
  function blackHeight(d) {
    const by = B.byAddr(d);
    const hs = new Set();
    const walk = (a, k, depth) => {
      if (!a || !by.has(a) || depth > 30) { hs.add(k + 1); return; }
      const n = by.get(a);
      const kk = k + (n.color === RED ? 0 : 1);
      walk(n.links.left, kk, depth + 1);
      walk(n.links.right, kk, depth + 1);
    };
    if (!d.root) return 1;
    walk(d.root, 0, 0);
    return hs.size === 1 ? [...hs][0] : null;
  }

  /** Follow rotations through the ticks: which ticks freeze the picture, and the numbered pointer marks */
  function track(ctx) {
    const d = ctx.tick.data, tag = ctx.tick.tag, m = ctx.memo, c = d.cursors;
    m.marks = m.marks || new Map();
    const rt = /^([lr])-([a-z-]+)$/.exec(tag);
    const o = {};
    if (!rt && ctx.prev && /^[lr]-end$/.test(ctx.prev.tag)) { /* keep the marks for one more step */ }
    else if (!rt) m.marks.clear();
    if (!rt) { if (m.rot) m.rot.active = false; return o; }
    const left = rt[1] === 'l';
    const inner = left ? 'right' : 'left', outer = left ? 'left' : 'right';
    switch (rt[2]) {
      case 'y': m.marks.clear(); m.rot = { left, x: c.x, y: c.y, beta: (d.nodes.find((q) => q.addr === c.y) || { links: {} }).links[outer] || 0, active: true }; break;
      case 'beta': m.marks.set(c.x + ':' + inner, '①'); break;
      case 'beta-up': m.marks.set('P' + m.rot.beta, '①'); break;
      case 'up': m.marks.set('P' + c.y, '②'); break;
      case 'root': m.marks.set('root', '②'); break;
      case 'plink': { const px = (d.nodes.find((q) => q.addr === c.x) || { links: {} }).links.parent; const pn = d.nodes.find((q) => q.addr === px); if (pn) for (const s of ['left', 'right']) if (pn.links[s] === c.y) m.marks.set(px + ':' + s, '②'); break; }
      case 'down': m.marks.set(c.y + ':' + outer, '③'); break;
      case 'parent': m.marks.set('P' + c.x, '③'); break;
    }
    if (['beta', 'beta-test', 'beta-up', 'up', 'where', 'root', 'side', 'plink'].includes(rt[2])) o.freeze = true;
    if (m.rot) m.rot.active = rt[2] !== 'end';
    return o;
  }

  /** The picture shared by the red-black topics. opts: {parents, place, nodeCls, extra(items, pos)} */
  function picture(ctx, opts) {
    opts = opts || {};
    const d0 = ctx.tick.data, m = ctx.memo;
    // a freed node stays one step as a ghost, then leaves
    const d = Object.assign({}, d0, { nodes: d0.nodes.filter((n) => !n.freed || ctx.tick.events.some((e) => e.kind === 'free' && e.addr === n.addr)) });
    const lo = track(ctx);
    const lay = B.layout(ctx, d, { freeze: lo.freeze, dy: 84 });
    const pos = lay.pos;
    if (opts.place) for (const [a, p] of opts.place) { pos.set(a, p); m.balPos.set(a, p); }
    const prev = ctx.prev && ctx.prev.data && ctx.prev.data.nodes ? B.byAddr(ctx.prev.data) : new Map();
    const rot = m.rot && m.rot.active ? m.rot : null;
    const cursors = {};
    for (const [k, v] of Object.entries(d.cursors)) if (v && v !== d.nil) cursors[k] = v;
    const items = B.picture(ctx, d, {
      pos, parents: opts.parents,
      nodeCls: (n) => {
        const cl = [n.color === RED ? 'red' : 'black'];
        const p = prev.get(n.addr);
        if (p && p.color !== n.color && !n.freed) cl.push('bal-recolor');
        if (opts.nodeCls) cl.push(opts.nodeCls(n) || '');
        return cl.join(' ');
      },
      edgeCls: (n, s) => (opts.edgeCls && opts.edgeCls(n, s)) || (m.marks.has(n.addr + ':' + s) ? 'bal-mark' : ''),
      edgeLabel: (n, s) => (opts.edgeLabel && opts.edgeLabel(n, s)) || m.marks.get(n.addr + ':' + s) || '',
      parentCls: (n) => (m.marks.has('P' + n.addr) ? 'hot' : ''),
      parentLabel: (n) => m.marks.get('P' + n.addr) || '',
      rootArrow: m.marks.has('root') ? { cls: 'bal-mark', label: '②' } : {},
      stubs: true, cursors, cursorCls: CUR,
    });
    if (rot && rot.beta && pos.has(rot.beta)) items.push(...B.around('beta', d, pos, rot.beta, 'bal-t2', 'β'));
    return { items, pos, d, lo };
  }

  /** A small black NIL box below parent on one side (an empty child that matters right now) */
  function nilBox(key, pos, parent, side, label) {
    const p = pos.get(parent);
    if (!p) return [];
    const x = p.x + (side === 'left' ? -1 : 1) * B.DX * 0.55, y = p.y + 62;
    return [
      { key, kind: 'node', x: x - 18, y: y - 11, w: 36, h: 22, cells: [{ text: 'NIL' }], cls: 'bal-nil', label: label || '' },
      { key: key + 'l', kind: 'line', x1: p.x + (side === 'left' ? -12 : 12), y1: p.y + 20, x2: x, y2: y - 11, cls: 'dim' },
    ];
  }

  /** Narration for the lines of rotate_left and rotate_right */
  function rotSay(ctx) {
    const d = ctx.tick.data, tag = ctx.tick.tag, c = d.cursors, m = ctx.memo;
    const rt = /^([lr])-([a-z-]+)$/.exec(tag);
    if (!rt) return '';
    const k = (a) => keyOf(d, a);
    const left = rt[1] === 'l';
    const inner = left ? 'right' : 'left', outer = left ? 'left' : 'right';
    const nm = left ? 'rotate_left' : 'rotate_right';
    const xn = d.nodes.find((q) => q.addr === c.x);
    const px = xn ? xn.links.parent : 0;
    const beta = m.rot ? m.rot.beta : 0;
    switch (rt[2]) {
      case 'y': return nm + '(' + k(c.x) + '): y = x->' + inner + ' = ' + k(c.y) + '. y will come up into x\'s place and x will go down to the ' + outer + '. Six pointers change: three links, each in both directions.';
      case 'beta': return '① x->' + inner + ' = y->' + outer + '. ' + (beta ? 'The shaded subtree β (' + B.keysUnder(d, beta).join(', ') + ') lies between ' + Math.min(k(c.x), k(c.y)) + ' and ' + Math.max(k(c.x), k(c.y)) + ', so it moves over to ' + k(c.x) + '.' : 'y has no ' + outer + ' child, so x->' + inner + ' becomes NIL.') + ' The picture holds still until the subtree is whole again.';
      case 'beta-test': return beta ? 'β is a real node, so its parent pointer must be turned round too.' : 'β is NIL: there is no parent pointer to fix.';
      case 'beta-up': return '① the other direction: β->parent = x. ' + k(beta) + ' now points up to ' + k(c.x) + '.';
      case 'up': return '② y->parent = x->parent: ' + k(c.y) + ' takes over ' + k(c.x) + '\'s parent' + (px ? ', ' + k(px) + '.' : ', which is NIL: ' + k(c.x) + ' was the root.');
      case 'where': return 'Was x the root? ' + (px ? 'No, it hangs from ' + k(px) + '.' : 'Yes.');
      case 'root': return '② root = y: ' + k(c.y) + ' is the new root of the whole tree.';
      case 'side': return 'Which child of ' + k(px) + ' was x? ' + (xn && d.nodes.find((q) => q.addr === px) && d.nodes.find((q) => q.addr === px).links[left ? 'left' : 'right'] === c.x ? 'The ' + (left ? 'left' : 'right') + ' one.' : 'The ' + (left ? 'right' : 'left') + ' one.');
      case 'plink': return '② ' + k(px) + ' now points down to ' + k(c.y) + ' instead of ' + k(c.x) + '.';
      case 'down': return '③ y->' + outer + ' = x: ' + k(c.x) + ' goes under ' + k(c.y) + '. Every child link is right again, so the nodes glide to their new levels.';
      case 'parent': return '③ the other direction: x->parent = y. All six pointers are done.';
      case 'end': return nm + ' is finished: ' + k(m.rot.y) + ' sits where ' + k(m.rot.x) + ' was. Left to right the keys read in the same order, and no colour changed.';
    }
    return '';
  }

  // ---- rotations ----------------------------------------------------------------------------------------
  X.topic({
    id: 'rb-rotate', family: 'rbt', order: 5, title: 'Rotations with parent pointers',
    blurb: 'The building block of every red-black fix: one node comes up, one goes down, and with parent pointers six pointers change instead of three.',
    code: ROT,
    animate: ['rotate_left', 'rotate_right'],
    inputs: [
      { id: 'keys', kind: 'ints', label: 'Keys, inserted in this order', def: [50, 30, 70, 20, 40, 60, 80, 35, 45], min: 2, max: 12, distinct: true },
      { id: 'at', kind: 'int', label: 'Rotate at (x)', def: 30, lo: -999, hi: 999 },
      { id: 'dir', kind: 'text', label: 'Direction (left or right)', def: 'left' },
    ],
    check(inp) {
      if (inp.dir !== 'left' && inp.dir !== 'right') return 'Direction: write left or right';
      if (!inp.keys.includes(inp.at)) return 'Rotate at: pick a key that is in the tree';
      const t = B.rbTree(inp.keys);
      let n = t;
      while (n && n.key !== inp.at) n = inp.at < n.key ? n.left : n.right;
      if (inp.dir === 'left' && !n.right) return 'A left rotation needs a right child to bring up; ' + inp.at + ' has none';
      if (inp.dir === 'right' && !n.left) return 'A right rotation needs a left child to bring up; ' + inp.at + ' has none';
      return null;
    },
    presets: [
      { label: 'Left, x is a left child', values: { keys: [50, 30, 70, 20, 40, 60, 80, 35, 45], at: 30, dir: 'left' } },
      { label: 'Right, at the root', values: { keys: [50, 30, 70, 20, 40, 60, 80, 35, 45], at: 50, dir: 'right' } },
      { label: 'Left, β is NIL', values: { keys: [10, 20, 30, 40, 50, 60], at: 40, dir: 'left' } },
      { label: 'Right, x is a right child', values: { keys: [40, 20, 60, 10, 30, 50, 70, 45, 55], at: 60, dir: 'right' } },
    ],
    counters: ['writes'],
    main: (inp) => rbMain(inp.keys, 'rotate_' + inp.dir + '(find(' + inp.at + '));'),
    capture: capture(['x', 'y']),
    scene(ctx) {
      const tag = ctx.tick.tag, inp = ctx.input;
      const pic = picture(ctx, { parents: true });
      const d = pic.d, items = pic.items;
      let say = rotSay(ctx);
      if (tag === 'enter') say = 'rotate_' + inp.dir + '(' + inp.at + '). The dashed grey arrows are the parent pointers. A rotation must keep both directions right: child links going down and parent links going up.';
      if (tag === 'after') {
        say = 'Back in main. The rotation is complete and the tree is still a search tree. In a red-black tree a rotation never comes alone: insert and delete pair it with recolouring, because on its own it can break the colour rules.';
        const bh = blackHeight(d);
        if (!bh) items.push({ key: 'warn', kind: 'text', x: Math.min(...[...pic.pos.values()].map((p) => p.x)) - 20, y: Math.max(...[...pic.pos.values()].map((p) => p.y)) + 70, text: 'the black counts now differ between paths', cls: 'bal-note' });
      }
      return { items, say, view: B.view(items), slow: /-down$/.test(tag) };
    },
    predict: [
      { at: (t) => t.tag === 'enter', once: true, ask: 'Click the node that will take x\'s place when the rotation is over.', answer: (ts, i) => { const d = ts[i + 1].data; return 'n' + d.cursors.y; }, explain: () => 'For a left rotation it is x\'s right child; for a right rotation, its left child.' },
      { at: (t, i, ts) => ts[i + 1] && /^[lr]-beta$/.test(ts[i + 1].tag), once: true, ask: 'How many pointers will this rotation write in total?', options: () => ['3', '5', '6'], pick: 'option',
        answer: (ts, i) => { const d = ts[i].data; const y = d.nodes.find((q) => q.addr === d.cursors.y); const outer = /^l/.test(ts[i].tag) ? 'left' : 'right'; return y.links[outer] ? '6' : '5'; },
        explain: () => 'Three links, each with a child pointer and a parent pointer. When β is NIL its parent pointer is not written, so only five.' },
    ],
    quiz: [
      { q: 'With parent pointers, how many pointers does a rotation change when β is a real node?', options: ['3', '4', '6', '8'], answer: 2, why: 'x->right, β->parent, y->parent, the parent\'s child link (or root), y->left and x->parent.' },
      { q: 'Why does rotate_left check whether x->parent is NIL?', options: ['To avoid freeing it', 'If x was the root, the global root must change to y', 'NIL cannot be read', 'To recolour it'], answer: 1, why: 'Someone must point down to y. For the root that is the variable root, not a node.' },
      { q: 'Does a rotation change any colour?', options: ['Yes, x and y swap colours', 'No, it only moves pointers', 'Only the root becomes black', 'β turns red'], answer: 1, why: 'Rotations only restructure. The fix-up code recolours separately.' },
      { q: 'Why does the subtree β move from y to x?', options: ['It is the smallest', 'Its keys lie between x and y, and after the rotation the only place between them is under x', 'Because it is red', 'It does not move'], answer: 1, why: 'The in-order sequence must stay the same: α, x, β, y, γ.' },
    ],
    compareWith: 'avl-rotate',
  });

  // ---- insert -------------------------------------------------------------------------------------------
  const INS = `

void insert_fixup(struct node *z);

/* an ordinary search-tree insert; the new node is red */
void insert(int key)
{
    struct node *z = new_node(key, RED);    /*@ new */
    struct node *y = NIL;                   /*@ init-y */
    struct node *x = root;                  /*@ init-x */
    while (x != NIL) {                      /*@ walk */
        y = x;                              /*@ trail */
        if (z->key < x->key)                /*@ compare */
            x = x->left;                    /*@ go-left */
        else
            x = x->right;                   /*@ go-right */
    }
    z->parent = y;                          /*@ hang */
    if (y == NIL)                           /*@ where */
        root = z;                           /*@ at-root */
    else if (z->key < y->key)               /*@ side */
        y->left = z;                        /*@ link */
    else
        y->right = z;                       /*@ link */
    insert_fixup(z);                        /*@ fixup */
}                                           /*@ done */

/* z is red. While its parent is red too, two reds touch: repair, moving up */
void insert_fixup(struct node *z)
{
    struct node *p, *g, *u;
    while (z->parent->color == RED) {           /*@ test */
        p = z->parent;                          /*@ p */
        g = p->parent;                          /*@ g */
        u = p == g->left ? g->right : g->left;  /*@ uncle */
        if (u->color == RED) {                  /*@ case1-test */
            p->color = BLACK;                   /*@ case1-p */
            u->color = BLACK;                   /*@ case1-u */
            g->color = RED;                     /*@ case1-g */
            z = g;                              /*@ case1-up */
        } else if (p == g->left) {              /*@ side */
            if (z == p->right) {                /*@ case2-test */
                z = p;                          /*@ case2-z */
                rotate_left(z);                 /*@ case2-rot */
                p = z->parent;                  /*@ case2-p */
            }
            p->color = BLACK;                   /*@ case3-p */
            g->color = RED;                     /*@ case3-g */
            rotate_right(g);                    /*@ case3-rot */
        } else {
            if (z == p->left) {                 /*@ case2-test */
                z = p;                          /*@ case2-z */
                rotate_right(z);                /*@ case2-rot */
                p = z->parent;                  /*@ case2-p */
            }
            p->color = BLACK;                   /*@ case3-p */
            g->color = RED;                     /*@ case3-g */
            rotate_left(g);                     /*@ case3-rot */
        }
    }
    root->color = BLACK;                        /*@ root */
}                                               /*@ end */`;

  X.topic({
    id: 'rb-insert', family: 'rbt', order: 10, title: 'Insert and fix up',
    blurb: 'The new key goes in red. If its parent is red too, the uncle decides: a red uncle means recolour and move up; a black uncle means one or two rotations and it is over.',
    code: ROT + INS,
    animate: ['insert', 'insert_fixup', 'rotate_left', 'rotate_right'], quiet: ['new_node'],
    inputs: [{ id: 'keys', kind: 'ints', label: 'Keys, inserted in this order', def: [50, 30, 70, 20, 40, 60], min: 0, max: 12, distinct: true }, { id: 'key', kind: 'int', label: 'Insert', def: 10, lo: -999, hi: 999 }],
    check: (inp) => (inp.keys.includes(inp.key) ? 'That key is already in the tree; pick another' : null),
    presets: [
      { label: 'Red uncle: recolour', values: { keys: [50, 30, 70, 20, 40, 60], key: 10 } },
      { label: 'Black uncle, outer: one rotation', values: { keys: [30, 20, 40, 10], key: 5 } },
      { label: 'Black uncle, inner: two rotations', values: { keys: [30, 20, 40, 10], key: 15 } },
      { label: 'Recolour, then rotate higher up', values: { keys: [90, 70, 80, 65, 55, 20, 5], key: 45 } },
      { label: 'Into an empty tree', values: { keys: [], key: 42 } },
    ],
    counters: ['compares', 'allocs', 'writes'],
    main: (inp) => rbMain(inp.keys, 'insert(' + inp.key + ');'),
    capture: capture(['z', 'x', 'y', 'p', 'g', 'u']),
    scene(ctx) {
      const tag = ctx.tick.tag, key = ctx.input.key, m = ctx.memo;
      const d0 = ctx.tick.data, c = d0.cursors;
      const inIns = ctx.tick.fn === 'insert';
      // the new node rides beside the walk until it is linked in
      const reach = new Set(B.keysUnder(d0, d0.root));
      const fresh = d0.nodes.find((q) => q.key === key && !reach.has(q.key));
      let place = null;
      if (fresh && inIns) {
        const last = m.balPos || new Map();
        const at = c.x && c.x !== d0.nil ? c.x : c.y && c.y !== d0.nil ? c.y : 0;
        const ap = at && last.get(at);
        if (ap && at === c.x) place = new Map([[fresh.addr, { x: ap.x + 52, y: ap.y - 46 }]]);
        else if (ap) place = new Map([[fresh.addr, { x: ap.x + (key < d0.nodes.find((q) => q.addr === at).key ? -0.6 : 0.6) * B.DX, y: ap.y + 70 }]]);
        else place = new Map([[fresh.addr, { x: 0, y: 0 }]]);
      }
      if (tag === 'enter') m.cases = [];
      const caseNow = /^case(\d)/.exec(tag);
      if (caseNow && !/test$/.test(tag)) m.caseNo = +caseNow[1];
      if (tag === 'test' || tag === 'root') m.caseNo = 0;
      const pic = picture(ctx, { place, nodeCls: (n) => (fresh && n.addr === fresh.addr ? 'bal-x' : c.z === n.addr && !inIns ? 'focus' : '') });
      const d = pic.d, items = pic.items, pos = pic.pos;
      const by = B.byAddr(d);
      // red-red violation between z and its parent
      const fix = ctx.tick.fn === 'insert_fixup';
      const zn = fix && by.get(c.z);
      if (zn && zn.color === RED && isRed(d, zn.links.parent)) {
        const pk = zn.links.parent, pn = by.get(pk);
        const side = pn.links.left === zn.addr ? 'left' : 'right';
        const k = 'e' + pk + side;
        const it = items.find((q) => q.key === k);
        if (it) { it.cls += ' bal-redred'; it.label = 'red-red'; }
      }
      // the uncle: ringed, and drawn as a NIL box when it is the sentinel
      if (fix && c.u !== undefined && c.g && ['uncle', 'case1-test', 'case1-p', 'case1-u', 'case1-g', 'side', 'case2-test'].includes(tag)) {
        if (c.u === d.nil) { const gn = by.get(c.g); if (gn) items.push(...nilBox('nilu', pos, c.g, gn.links.left ? 'right' : 'left', 'uncle')); }
        else if (pos.has(c.u)) items.push({ key: 'uring', kind: 'ring', x: pos.get(c.u).x, y: pos.get(c.u).y, r: B.R + 8, cls: 'bal-uncle' });
      }
      // the case, as a banner
      const xs = [...pos.values()].map((p) => p.x), ys = [...pos.values()].map((p) => p.y);
      const banner = { 1: 'Case 1: red uncle. Recolour and move z up two levels', 2: 'Case 2: black uncle, z an inner grandchild. Rotate it outward', 3: 'Case 3: black uncle, z an outer grandchild. Recolour and rotate g' }[m.caseNo];
      if (banner && xs.length) items.push({ key: 'banner', kind: 'text', x: Math.min(...xs) - 30, y: Math.min(0, ...ys) - 118, text: banner, cls: 'bal-case' });
      if (tag === 'after' && xs.length) { const bh = blackHeight(d); items.push({ key: 'bh', kind: 'text', x: Math.min(...xs) - 30, y: Math.max(...ys) + 72, text: bh ? 'every path down to NIL passes ' + bh + ' black nodes (NIL included)' : 'black counts differ', cls: 'bal-note' }); }
      if (tag === 'compare' && c.x && pos.has(c.x)) { const xp = pos.get(c.x), xk = by.get(c.x).key; items.push({ key: 'q', kind: 'text', x: xp.x + 78, y: xp.y - 42, text: key + (key < xk ? ' < ' : ' > ') + xk, cls: 'hot' }); }

      const k = (a) => keyOf(d, a);
      const zk = k(c.z), pk = k(c.p), gk = k(c.g), uk = k(c.u);
      let say = rotSay(ctx);
      switch (tag) {
        case 'enter': say = 'insert(' + key + '). First an ordinary search-tree insert. The new node is red, so no path gains a black node; the only rule that can break is "no red node has a red child".'; break;
        case 'new': say = 'new_node(' + key + ', RED): the new node is red, with NIL children. It travels beside the walk until its place is found.'; break;
        case 'init-y': say = 'y will trail one step behind x: it becomes the parent of the new node.'; break;
        case 'init-x': say = root0(d) ? 'x starts at the root, ' + k(d.root) + '.' : 'x starts at the root, which is NIL: the tree is empty.'; break;
        case 'walk': say = c.x && c.x !== d.nil ? 'x is ' + k(c.x) + ', not NIL: compare.' : 'x is NIL: the new node belongs here, under ' + (c.y && c.y !== d.nil ? k(c.y) : 'nothing (it is the first node)') + '.'; break;
        case 'trail': say = 'y = x = ' + k(c.x) + '.'; break;
        case 'compare': say = 'Compare ' + key + ' with ' + k(c.x) + ': ' + (key < by.get(c.x).key ? 'smaller, go left.' : 'bigger, go right.'); break;
        case 'go-left': case 'go-right': say = 'x moves to ' + k(c.x) + '.'; break;
        case 'hang': say = 'z->parent = y: the new node\'s parent pointer goes up to ' + (c.y && c.y !== d.nil ? k(c.y) : 'NIL') + '.'; break;
        case 'where': say = c.y === d.nil ? 'y is NIL, so the tree was empty.' : 'y is ' + k(c.y) + ', so z becomes one of its children.'; break;
        case 'at-root': say = 'root = z: ' + key + ' is the whole tree.'; break;
        case 'side': if (inIns) { say = key + (key < by.get(c.y).key ? ' < ' : ' > ') + k(c.y) + ': it goes on the ' + (key < by.get(c.y).key ? 'left.' : 'right.'); break; }
          say = 'p is ' + (by.get(c.g) && by.get(c.g).links.left === c.p ? 'g\'s left child, so the code works on the left branch.' : 'g\'s right child, so the code works on the mirror branch: every left and right swapped.'); break;
        case 'link': say = k(c.y) + ' now points down to the new red node ' + key + '. Now the colours must be checked.'; break;
        case 'fixup': say = 'insert_fixup(z): ' + (isRed(d, by.get(c.z) && by.get(c.z).links.parent) ? 'the parent of ' + zk + ' is red too: two reds in a row, which breaks the rules. The fix-up repairs it.' : 'checks whether the parent of ' + zk + ' is red.'); break;
        case 'done': say = 'insert() is finished.'; break;
        case 'test': say = zn && isRed(d, zn.links.parent) ? zk + ' is red and its parent ' + k(zn.links.parent) + ' is red: a red-red violation. The loop must repair it.' : (zn ? 'The parent of ' + zk + ' is ' + (zn.links.parent ? k(zn.links.parent) + ', black' : 'NIL (black): ' + zk + ' is the root') + '. No red-red violation is left, so the loop ends.' : 'The loop ends.'); break;
        case 'p': say = 'p = z->parent = ' + pk + ' (red).'; break;
        case 'g': say = 'g = p->parent = ' + gk + ', the grandparent. It must be black, because p is red and the tree was valid before.'; break;
        case 'uncle': say = 'u = the other child of g: the uncle, ' + (c.u === d.nil ? 'NIL, which counts as black.' : uk + ', which is ' + colName(d, c.u) + '.') + ' The uncle\'s colour decides what to do.'; break;
        case 'case1-test': say = isRed(d, c.u) ? 'The uncle ' + uk + ' is red: case 1. No rotation is needed, only recolouring.' : 'The uncle is black: no recolouring trick. A rotation will be needed.'; break;
        case 'case1-p': say = 'Case 1: p (' + pk + ') becomes black.'; break;
        case 'case1-u': say = 'And the uncle ' + uk + ' becomes black. Paths through p and u now have one more black node...'; break;
        case 'case1-g': say = '...so g (' + gk + ') becomes red, taking one black away again. Every path keeps the same number of black nodes.'; break;
        case 'case1-up': say = 'z = g: ' + gk + ' is now red, and its own parent might be red too. The problem has moved two levels up.'; break;
        case 'case2-test': { const pn = by.get(c.p); const inner = pn && (pn.links.left === c.z ? 'left' : 'right') !== (by.get(c.g).links.left === c.p ? 'left' : 'right'); say = inner ? zk + ' is an inner grandchild: a zig-zag (g, p, z bend). Case 2: first rotate p to turn it into a straight line.' : zk + ' is an outer grandchild: g, p and z form a straight line. Case 3 applies directly.'; break; }
        case 'case2-z': say = 'z = p: z moves up to ' + zk + '; after the rotation it will be the lower one again.'; break;
        case 'case2-rot': say = 'Case 2 rotation at ' + zk + ': the zig-zag becomes a straight line. The red-red pair is still there, now on the outside.'; break;
        case 'case2-p': say = 'p = z->parent = ' + pk + ': p has changed, so read it again.'; break;
        case 'case3-p': say = 'Case 3: p (' + pk + ') becomes black. It will be the top of this subtree.'; break;
        case 'case3-g': say = 'g (' + gk + ') becomes red. It will go down beside z.'; break;
        case 'case3-rot': say = 'Rotate at g (' + gk + '): the black ' + pk + ' comes up between two red children. No red-red, the same black count on every path, and the loop will stop.'; break;
        case 'root': say = 'root->color = BLACK: the root is painted black. ' + (ctx.prev && isRed(ctx.prev.data, ctx.prev.data.root) ? 'It was red after case 1: this is the only way a red-black tree gets taller in black.' : 'It was black already; this line is a safety net.'); break;
        case 'end': say = 'The fix-up is finished.'; break;
        case 'after': { const bh = blackHeight(d); say = 'Back in main. ' + key + ' is in the tree; no red node has a red child, and every path has ' + bh + ' black nodes. ' + (ctx.ticks.some((t) => /^case1-p$/.test(t.tag)) && !ctx.ticks.some((t) => /^[lr]-y$/.test(t.tag)) ? 'Only recolouring was needed.' : (ctx.ticks.filter((t) => /^[lr]-y$/.test(t.tag)).length === 1 ? 'One rotation' : 'Two rotations') + ': an insert never needs more than two.'); break; }
      }
      return { items, say, view: B.view(items), slow: /^case\d-(g|rot)$/.test(tag) || /-down$/.test(tag) };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'uncle', once: true, ask: 'The uncle is g\'s other child. Will the fix be case 1 (recolour), or will it need a rotation?', options: () => ['Case 1: recolour', 'A rotation (case 2 or 3)'], pick: 'option',
        answer: (ts, i) => { for (let j = i + 1; j < ts.length; j++) { if (ts[j].tag === 'case1-p') return 'Case 1: recolour'; if (/^case[23]/.test(ts[j].tag) && ts[j].tag !== 'case2-test') return 'A rotation (case 2 or 3)'; if (ts[j].tag === 'case2-test') return 'A rotation (case 2 or 3)'; } return null; },
        explain: () => 'Only the uncle\'s colour decides: red uncle, recolour; black uncle (NIL counts as black), rotate.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'case3-rot', once: true, ask: 'g is about to be rotated. Click the node that will be on top of this subtree afterwards.', answer: (ts, i) => 'n' + ts[i].data.cursors.p, explain: () => 'p comes up. It was just painted black, so the subtree top is black with two red children.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'walk' && t.tag === 'init-x' && t.data.root, once: true, ask: 'The new key walks down from the root. Click the node it will hang from.', answer: (ts) => { const h = ts.find((t) => t.tag === 'hang'); return h ? 'n' + h.data.cursors.y : null; }, explain: () => 'It is the last node the walk passes before x falls off at NIL.' },
    ],
    quiz: [
      { q: 'Why is a newly inserted node coloured red?', options: ['Red is the default in C', 'A red node adds no black to any path, so only the red-red rule can break', 'Red nodes are faster', 'So that the root is red'], answer: 1, why: 'A black node would add one black to some paths and break the black-height rule everywhere above. Red is the cheaper fault to fix.' },
      { q: 'z and its parent are red, and the uncle is red. What happens?', options: ['Rotate at the grandparent', 'Recolour parent and uncle black, grandparent red, and move z up', 'Delete z', 'Stop: nothing to do'], answer: 1, why: 'Case 1: recolouring keeps every black count and pushes the possible problem two levels up.' },
      { q: 'At most how many rotations does a red-black insertion need?', options: ['One', 'Two', 'log n', 'n'], answer: 1, why: 'Case 2 rotates once and leads into case 3, which rotates once and ends the loop. Case 1 only recolours.' },
      { q: 'What colour does an empty child (NIL) count as?', options: ['Red', 'Black', 'No colour', 'The colour of its parent'], answer: 1, why: 'NIL leaves are black. That is why a missing uncle sends the fix-up to the rotation cases.' },
      { q: 'Why does the loop stop after case 3?', options: ['It has reached the root', 'The new top of the subtree is black, so there is no red-red above it', 'The tree is empty', 'It does not stop'], answer: 1, why: 'After recolouring and rotating, the subtree top is black and the black counts are unchanged.' },
    ],
    compareWith: 'avl-insert',
  });
  const root0 = (d) => !!d.root;

  // ---- delete -------------------------------------------------------------------------------------------
  const DEL = `

void delete_fixup(struct node *x);

/* put the subtree v where the subtree u was */
void transplant(struct node *u, struct node *v)
{
    if (u->parent == NIL)                       /*@ tp-test */
        root = v;                               /*@ tp-root */
    else if (u == u->parent->left)              /*@ tp-side */
        u->parent->left = v;                    /*@ tp-link */
    else
        u->parent->right = v;                   /*@ tp-link */
    v->parent = u->parent;                      /*@ tp-parent */
}                                               /*@ tp-end */

struct node *minimum(struct node *n)
{
    while (n->left != NIL)                      /*@ min-test */
        n = n->left;                            /*@ min-step */
    return n;                                   /*@ min-found */
}

/* remove z; if a black node left the tree, repair the black counts */
void delete_node(struct node *z)
{
    struct node *y = z, *x;                     /*@ init */
    int y_color = y->color;                     /*@ colour */
    if (z->left == NIL) {                       /*@ no-left */
        x = z->right;                           /*@ x-child */
        transplant(z, z->right);                /*@ lift */
    } else if (z->right == NIL) {               /*@ no-right */
        x = z->left;                            /*@ x-child */
        transplant(z, z->left);                 /*@ lift */
    } else {
        y = minimum(z->right);                  /*@ succ */
        y_color = y->color;                     /*@ succ-colour */
        x = y->right;                           /*@ succ-x */
        if (y->parent == z) {                   /*@ succ-child */
            x->parent = y;                      /*@ x-parent */
        } else {
            transplant(y, y->right);            /*@ unhook */
            y->right = z->right;                /*@ take-right */
            y->right->parent = y;               /*@ take-right-p */
        }
        transplant(z, y);                       /*@ replace */
        y->left = z->left;                      /*@ take-left */
        y->left->parent = y;                    /*@ take-left-p */
        y->color = z->color;                    /*@ take-colour */
    }
    free(z);                                    /*@ free */
    if (y_color == BLACK)                       /*@ black-gone */
        delete_fixup(x);                        /*@ fixup */
}                                               /*@ done */

/* x carries an extra black: move it up, or get rid of it by recolouring and rotating */
void delete_fixup(struct node *x)
{
    struct node *w;
    while (x != root && x->color == BLACK) {            /*@ test */
        if (x == x->parent->left) {                     /*@ side */
            w = x->parent->right;                       /*@ sibling */
            if (w->color == RED) {                      /*@ case1-test */
                w->color = BLACK;                       /*@ case1-w */
                x->parent->color = RED;                 /*@ case1-p */
                rotate_left(x->parent);                 /*@ case1-rot */
                w = x->parent->right;                   /*@ case1-new */
            }
            if (w->left->color == BLACK && w->right->color == BLACK) {  /*@ case2-test */
                w->color = RED;                         /*@ case2-w */
                x = x->parent;                          /*@ case2-up */
            } else {
                if (w->right->color == BLACK) {         /*@ case3-test */
                    w->left->color = BLACK;             /*@ case3-near */
                    w->color = RED;                     /*@ case3-w */
                    rotate_right(w);                    /*@ case3-rot */
                    w = x->parent->right;               /*@ case3-new */
                }
                w->color = x->parent->color;            /*@ case4-w */
                x->parent->color = BLACK;               /*@ case4-p */
                w->right->color = BLACK;                /*@ case4-far */
                rotate_left(x->parent);                 /*@ case4-rot */
                x = root;                               /*@ case4-done */
            }
        } else {
            w = x->parent->left;                        /*@ sibling */
            if (w->color == RED) {                      /*@ case1-test */
                w->color = BLACK;                       /*@ case1-w */
                x->parent->color = RED;                 /*@ case1-p */
                rotate_right(x->parent);                /*@ case1-rot */
                w = x->parent->left;                    /*@ case1-new */
            }
            if (w->right->color == BLACK && w->left->color == BLACK) {  /*@ case2-test */
                w->color = RED;                         /*@ case2-w */
                x = x->parent;                          /*@ case2-up */
            } else {
                if (w->left->color == BLACK) {          /*@ case3-test */
                    w->right->color = BLACK;            /*@ case3-near */
                    w->color = RED;                     /*@ case3-w */
                    rotate_left(w);                     /*@ case3-rot */
                    w = x->parent->left;                /*@ case3-new */
                }
                w->color = x->parent->color;            /*@ case4-w */
                x->parent->color = BLACK;               /*@ case4-p */
                w->left->color = BLACK;                 /*@ case4-far */
                rotate_right(x->parent);                /*@ case4-rot */
                x = root;                               /*@ case4-done */
            }
        }
    }
    x->color = BLACK;                                   /*@ absorb */
}                                                       /*@ end */`;

  X.topic({
    id: 'rb-delete', family: 'rbt', order: 20, title: 'Delete and fix up',
    blurb: 'When a black node leaves, one path is a black short. The node that took its place carries an "extra black" up the tree until a red node absorbs it or a rotation hands it to the sibling\'s side.',
    code: ROT + DEL,
    animate: ['delete_node', 'transplant', 'minimum', 'delete_fixup', 'rotate_left', 'rotate_right'],
    inputs: [{ id: 'keys', kind: 'ints', label: 'Keys, inserted in this order', def: [90, 85, 20, 30, 60, 10], min: 1, max: 12, distinct: true }, { id: 'key', kind: 'int', label: 'Delete', def: 90, lo: -999, hi: 999 }],
    check: (inp) => (inp.keys.includes(inp.key) ? null : 'Delete: pick a key that is in the tree'),
    presets: [
      { label: 'Case 1 then 2: red sibling', values: { keys: [90, 85, 20, 30, 60, 10], key: 90 } },
      { label: 'Case 2: push the black up', values: { keys: [25, 90, 65, 15, 35, 60, 45, 30], key: 90 } },
      { label: 'Case 3 then 4: near nephew red', values: { keys: [20, 10, 30, 25], key: 10 } },
      { label: 'Case 4: far nephew red', values: { keys: [20, 10, 30, 40], key: 10 } },
      { label: 'Case 1 then 4', values: { keys: [80, 65, 35, 60, 10, 50], key: 80 } },
      { label: 'A red node: nothing to fix', values: { keys: [20, 10, 30, 40], key: 40 } },
    ],
    counters: ['frees', 'writes'],
    main: (inp) => rbMain(inp.keys, 'delete_node(find(' + inp.key + '));'),
    capture: capture(['z', 'y', 'x', 'w', 'u', 'v', 'n']),
    scene(ctx) {
      const tag = ctx.tick.tag, key = ctx.input.key, m = ctx.memo;
      const d0 = ctx.tick.data;
      const fn = ctx.tick.fn;
      if (fn === 'delete_node' && d0.cursors.z) m.z = d0.cursors.z;
      if (fn === 'delete_node' && d0.cursors.x !== undefined) m.x = d0.cursors.x;
      if (fn === 'delete_fixup') { m.x = d0.cursors.x; m.w = d0.cursors.w; m.inFix = true; }
      if (tag === 'absorb' || tag === 'end' || tag === 'after') m.inFix = tag === 'absorb';
      const caseNow = /^case(\d)-(\w+)$/.exec(tag);
      if (caseNow && caseNow[2] !== 'test') m.caseNo = +caseNow[1];
      if (tag === 'test' || tag === 'absorb') m.caseNo = 0;
      const pic = picture(ctx, { nodeCls: (n) => (n.addr === m.z ? 'bal-victim' : fn === 'delete_node' && n.addr === d0.cursors.y && n.addr !== m.z ? 'part-b' : '') });
      const d = pic.d, items = pic.items, pos = pic.pos;
      const by = B.byAddr(d);
      const c = d.cursors;
      // the extra black: a thick ring around x (a NIL box when x is the sentinel)
      if (tag === 'enter') m.dbGone = false;
      if (tag === 'case4-done') m.dbGone = true;
      const xAddr = (m.inFix || tag === 'black-gone' || tag === 'fixup') && !m.dbGone && ctx.ticks.some((t) => t.tag === 'test') ? m.x : undefined;
      if (xAddr !== undefined) {
        if (xAddr === d.nil) {
          const par = d.nilParent;
          const pn = by.get(par);
          if (pn) {
            const side = pn.links.left ? 'right' : 'left';
            items.push(...nilBox('nilx', pos, par, side, 'x'));
            const p = pos.get(par);
            if (p) items.push({ key: 'db', kind: 'ring', x: p.x + (side === 'left' ? -1 : 1) * B.DX * 0.55, y: p.y + 62, r: 24, cls: 'bal-db' });
          }
        } else if (pos.has(xAddr)) items.push({ key: 'db', kind: 'ring', x: pos.get(xAddr).x, y: pos.get(xAddr).y, r: B.R + 7, cls: 'bal-db' });
        if (tag !== 'absorb') {
          const at = xAddr === d.nil ? (pos.get(d.nilParent) ? { x: pos.get(d.nilParent).x, y: pos.get(d.nilParent).y + 62 } : null) : pos.get(xAddr);
          if (at) items.push({ key: 'dbt', kind: 'text', x: at.x, y: at.y + 50, text: 'extra black', anchor: 'middle', cls: 'bal-case' });
        }
      }
      if (fn === 'delete_fixup' && c.w && c.w !== d.nil && pos.has(c.w) && !/^[lr]-/.test(tag)) items.push({ key: 'wring', kind: 'ring', x: pos.get(c.w).x, y: pos.get(c.w).y, r: B.R + 8, cls: 'bal-sib' });
      const xs = [...pos.values()].map((p) => p.x), ys = [...pos.values()].map((p) => p.y);
      const banner = { 1: 'Case 1: red sibling. Recolour and rotate to get a black sibling', 2: 'Case 2: black sibling, both nephews black. Move the extra black up', 3: 'Case 3: near nephew red, far nephew black. Rotate the sibling', 4: 'Case 4: far nephew red. Recolour, rotate, done' }[m.caseNo];
      if (banner && xs.length) items.push({ key: 'banner', kind: 'text', x: Math.min(...xs) - 30, y: Math.min(0, ...ys) - 118, text: banner, cls: 'bal-case' });
      if (tag === 'after' && xs.length) { const bh = blackHeight(d); items.push({ key: 'bh', kind: 'text', x: Math.min(...xs) - 30, y: Math.max(...ys) + 72, text: bh ? 'every path down to NIL passes ' + bh + ' black nodes (NIL included)' : 'black counts differ', cls: 'bal-note' }); }

      const k = (a) => keyOf(d, a);
      const xn = by.get(m.x);
      const xpar = m.x === d.nil ? d.nilParent : xn ? xn.links.parent : 0;
      const wn = by.get(c.w);
      const xLeft = by.get(xpar) && (m.x === d.nil ? !by.get(xpar).links.left : by.get(xpar).links.left === m.x);
      const near = wn ? wn.links[xLeft ? 'left' : 'right'] : 0, far = wn ? wn.links[xLeft ? 'right' : 'left'] : 0;
      const zk = k(m.z);
      let say = rotSay(ctx);
      switch (tag) {
        case 'enter': say = 'delete_node(' + zk + '). First a search-tree delete with transplant(). Then the question that matters: was the node that left the tree black? If so, some paths are now one black short.'; break;
        case 'init': say = 'y starts as z (' + zk + '): y is the node that will really leave its place.'; break;
        case 'colour': say = 'Remember y\'s colour: ' + colName(d, m.z) + '. If a black node leaves, the black counts break.'; break;
        case 'no-left': say = by.get(m.z) && !by.get(m.z).links.left ? zk + ' has no left child: its right subtree (' + (by.get(m.z).links.right ? k(by.get(m.z).links.right) : 'NIL') + ') simply takes its place.' : zk + ' has a left child.'; break;
        case 'no-right': say = by.get(m.z) && !by.get(m.z).links.right ? zk + ' has no right child: its left subtree takes its place.' : zk + ' has two children: its successor will take its place.'; break;
        case 'x-child': say = 'x = ' + k(c.x) + ': the node moving into the hole. If a black node left, x is where the black is missing.'; break;
        case 'lift': case 'replace': case 'unhook': say = { lift: 'transplant(z, ' + k(c.x) + '): ' + (c.x === d.nil ? 'NIL' : k(c.x)) + ' takes ' + zk + '\'s place.', replace: 'transplant(z, y): the successor ' + k(c.y) + ' takes z\'s place.', unhook: 'transplant(y, y->right): first the successor ' + k(c.y) + ' is lifted out; its right subtree takes its place.' }[tag]; break;
        case 'tp-test': say = 'Is u the root? ' + (by.get(c.u) && by.get(c.u).links.parent ? 'No.' : 'Yes.'); break;
        case 'tp-root': say = 'root = v: ' + k(c.v) + ' becomes the root.'; break;
        case 'tp-side': { const un = by.get(c.u), pn = un && by.get(un.links.parent); say = 'Which side of its parent is u (' + k(c.u) + ')? ' + (pn && pn.links.left === c.u ? 'The left.' : 'The right.'); break; }
        case 'tp-link': say = 'The parent now points down to ' + k(c.v) + ' instead of ' + k(c.u) + '.'; break;
        case 'tp-parent': say = 'v->parent = u->parent: and ' + k(c.v) + ' points back up' + (c.v === d.nil ? ' (even NIL gets a parent here; the fix-up will use it)' : '') + '.'; break;
        case 'tp-end': say = 'transplant is done.'; break;
        case 'succ': say = zk + ' has two children: find its successor, the smallest key in its right subtree.'; break;
        case 'min-test': say = k(c.n) + (by.get(c.n) && by.get(c.n).links.left ? ' has a left child: go left.' : ' has no left child: it is the minimum.'); break;
        case 'min-step': say = 'n moves left to ' + k(c.n) + '.'; break;
        case 'min-found': say = 'The successor is ' + k(ctx.prev.data.cursors.n) + '.'; break;
        case 'succ-colour': say = 'y_color = ' + colName(d, c.y) + ': the successor\'s colour is what leaves its old place.'; break;
        case 'succ-x': say = 'x = y->right = ' + k(c.x) + ': it will fill the successor\'s old place.'; break;
        case 'succ-child': say = by.get(c.y) && by.get(c.y).links.parent === m.z ? 'The successor is z\'s own right child.' : 'The successor is deeper down; it must be cut out first.'; break;
        case 'x-parent': say = 'x->parent = y, so the fix-up can find x\'s parent even when x is NIL.'; break;
        case 'take-right': say = 'y takes over z\'s right subtree.'; break;
        case 'take-right-p': say = 'And that subtree points back up to y.'; break;
        case 'take-left': say = 'y takes over z\'s left subtree.'; break;
        case 'take-left-p': say = 'And that subtree points back up to y.'; break;
        case 'take-colour': say = 'y takes z\'s colour, so nothing changes at z\'s old place. Any missing black is at y\'s old place, where x now is.'; break;
        case 'free': say = 'free(z): ' + zk + ' goes back to the heap.'; break;
        case 'black-gone': say = ctx.ticks.some((t) => t.tag === 'test') ? 'The node that left was black: every path through x is one black short. Think of x as carrying an extra black that must be placed somewhere.' : 'The node that left was red: no path lost a black node. Nothing to fix.'; break;
        case 'fixup': say = 'delete_fixup(x) with x = ' + k(m.x) + '.'; break;
        case 'done': say = 'delete_node is finished.'; break;
        case 'test': say = m.dbGone ? 'x is the root, so the loop ends.' : m.x === d.root ? 'x is the root: the extra black can simply be dropped, every path loses one black together.' : isRed(d, m.x) ? 'x (' + k(m.x) + ') is red: "red plus extra black" is easy, the loop ends and x is painted black.' : 'x (' + k(m.x) + ') is black and not the root, so it is "doubly black". The loop works on it.'; break;
        case 'side': say = 'x is the ' + (xLeft ? 'left' : 'right') + ' child of ' + k(xpar) + (xLeft ? '.' : ': the code takes the mirror branch.'); break;
        case 'sibling': say = 'w = the sibling of x: ' + k(c.w) + ', ' + colName(d, c.w) + '. The sibling\'s side has a black to spare.'; break;
        case 'case1-test': say = isRed(d, c.w) ? 'The sibling is red: case 1.' : 'The sibling is black: not case 1.'; break;
        case 'case1-w': say = 'Case 1: the sibling ' + k(c.w) + ' becomes black...'; break;
        case 'case1-p': say = '...and the parent ' + k(xpar) + ' becomes red. A rotation will bring the sibling up.'; break;
        case 'case1-rot': say = 'Rotate at the parent ' + k(xpar) + '. x gets a new sibling, which is black: cases 2 to 4 can now be used.'; break;
        case 'case1-new': say = 'w = the new sibling: ' + k(c.w) + ', black.'; break;
        case 'case2-test': say = 'The nephews are ' + k(near) + ' (' + colName(d, near) + ') and ' + k(far) + ' (' + colName(d, far) + '). ' + (!isRed(d, near) && !isRed(d, far) ? 'Both black: case 2.' : 'Not both black: case 3 or 4.'); break;
        case 'case2-w': say = 'Case 2: the sibling ' + k(c.w) + ' turns red. Its side loses one black, so both sides are now equally short...'; break;
        case 'case2-up': say = '...and the extra black moves up to the parent: x = ' + k(m.x) + '. If that node is red, the loop ends there.'; break;
        case 'case3-test': say = isRed(d, far) ? 'The far nephew ' + k(far) + ' is red: straight to case 4.' : 'The far nephew is black but the near one is red: case 3.'; break;
        case 'case3-near': say = 'Case 3: the near nephew ' + k(ctx.prev && ctx.prev.data.cursors.w ? (by.get(ctx.prev.data.cursors.w) || { links: {} }).links[xLeft ? 'left' : 'right'] : 0) + ' becomes black...'; break;
        case 'case3-w': say = '...and the sibling becomes red.'; break;
        case 'case3-rot': say = 'Rotate the sibling away from x: the near nephew comes up and becomes the new sibling, with a red far child. That is case 4.'; break;
        case 'case3-new': say = 'w = the new sibling: ' + k(c.w) + '.'; break;
        case 'case4-w': say = 'Case 4: the sibling takes the parent\'s colour (' + colName(d, c.w) + ').'; break;
        case 'case4-p': say = 'The parent ' + k(xpar) + ' becomes black: this black will go down onto x\'s side.'; break;
        case 'case4-far': say = 'The far nephew becomes black: it replaces the black the sibling gives up.'; break;
        case 'case4-rot': say = 'Rotate at the parent: the sibling comes up. x\'s side gains a black, the other side keeps its count. The extra black is gone.'; break;
        case 'case4-done': say = 'x = root: a way to end the loop.'; break;
        case 'absorb': say = m.dbGone ? 'x->color = BLACK: x is the root, which is black already. Every path has the same black count again.' : 'x->color = BLACK: ' + (m.x === d.nil ? 'NIL is black anyway.' : k(m.x) + ' takes the extra black and is now black.') + ' Every path has the same black count again.'; break;
        case 'end': say = 'The fix-up is finished.'; break;
        case 'after': { const bh = blackHeight(d); const cases = [...new Set(ctx.ticks.filter((t) => /^case\d-(w|near)$/.test(t.tag)).map((t) => t.tag[4]))]; say = 'Back in main. ' + key + ' is gone; every path has ' + bh + ' black nodes. ' + (cases.length ? 'Cases used: ' + cases.join(', ') + '.' : 'No fix-up case was needed.'); break; }
      }
      return { items, say, view: B.view(items), slow: /^case\d-(rot|up)$/.test(tag) || /-down$/.test(tag) };
    },
    predict: [
      { at: (t) => t.tag === 'enter', once: true, ask: 'Will this delete need the fix-up (a black node leaving)?', options: () => ['Yes', 'No'], pick: 'option', answer: (ts) => (ts.some((t) => t.tag === 'fixup') ? 'Yes' : 'No'), explain: () => 'What matters is the colour of the node that really leaves its place: z itself, or its successor when z has two children.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'sibling', once: true, ask: 'Which case will apply first?', options: () => ['Case 1', 'Case 2', 'Case 3', 'Case 4'], pick: 'option',
        answer: (ts, i) => { for (let j = i + 1; j < ts.length; j++) { const mm = /^case(\d)-(w|near)$/.exec(ts[j].tag); if (mm) return 'Case ' + mm[1]; } return null; },
        explain: () => 'Look at the sibling first (red: case 1), then its children: both black is case 2, a red near one only is case 3, a red far one is case 4.' },
    ],
    quiz: [
      { q: 'Deleting a red leaf from a red-black tree needs...', options: ['A rotation', 'Recolouring the parent', 'No fix-up at all', 'Rebuilding the tree'], answer: 2, why: 'No path loses a black node and no red-red pair can appear.' },
      { q: 'What does the "extra black" on x mean?', options: ['x is freed', 'Paths through x are one black short, so x counts as one more black', 'x has two black children', 'x is NIL'], answer: 1, why: 'It is bookkeeping: the missing black is pinned to x until it can be absorbed by a red node or rebalanced across.' },
      { q: 'In case 2 the sibling is recoloured red. Why is that allowed?', options: ['Its children are black, so no red-red appears', 'Red nodes are always allowed', 'The sibling is freed', 'It is the root'], answer: 0, why: 'Both nephews are black, so making the sibling red breaks nothing and takes one black off its side too.' },
      { q: 'Which case ends the loop with a rotation?', options: ['Case 1', 'Case 2', 'Case 4', 'None'], answer: 2, why: 'Case 4 recolours, rotates at the parent and sets x = root. Case 1 and 3 only prepare for later cases.' },
      { q: 'At most how many rotations does a red-black deletion need?', options: ['One', 'Three', 'log n', 'n'], answer: 1, why: 'Case 1, then case 3, then case 4: three at most. Case 2 can repeat up the tree but only recolours.' },
    ],
    compareWith: 'avl-delete',
  });
})(SEE);
