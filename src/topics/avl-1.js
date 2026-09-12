// AVL trees: the family, rotations, insertion and deletion. Every node shows its stored height (h)
// and its balance factor (left height minus right height) in a badge; a rotation is drawn in three
// pointer changes, with the subtree T2 that changes parent shaded, and the nodes glide to their new
// levels once the subtree is whole again.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, B = X.BalanceKit;

  X.family({
    id: 'avl', order: 1, group: 'Balanced trees', title: 'AVL trees',
    blurb: 'A binary search tree where, at every node, the two subtrees differ in height by at most one. Rotations put it right after every change.',
    head: `#include <stdio.h>
#include <stdlib.h>

/* an AVL node: a key, the height of its subtree (a leaf has 1), two children */
struct node {
    int key;
    int height;
    struct node *left;
    struct node *right;
};

/* the height of a subtree; an empty one has height 0 */
int height(struct node *n)
{
    return n == NULL ? 0 : n->height;
}

/* recompute n's height from the heights of its children */
void update(struct node *n)
{
    int hl = n->left != NULL ? n->left->height : 0;
    int hr = n->right != NULL ? n->right->height : 0;
    n->height = 1 + (hl > hr ? hl : hr);
}

/* left height minus right height: the AVL rule allows -1, 0 or +1 */
int balance(struct node *n)
{
    return height(n->left) - height(n->right);
}

struct node *new_node(int key)
{
    struct node *n = malloc(sizeof *n);
    n->key = key;
    n->height = 1;
    n->left = NULL;
    n->right = NULL;
    return n;
}

/* main uses this to set up the tree you chose, before the animation starts */
struct node *add(struct node *root, int key)
{
    if (root == NULL)
        return new_node(key);
    if (key < root->key)
        root->left = add(root->left, key);
    else
        root->right = add(root->right, key);
    update(root);
    return root;
}`,
  });

  /** main: add the keys one by one (no balancing), then the topic's call */
  const avlMain = (keys, call, note) => `int main(void)
{
${note ? '    /* ' + note + ' */\n' : ''}    int keys[] = { ${keys.length ? keys.join(', ') : '0'} };
    struct node *root = NULL;
    int i;
    for (i = 0; i < ${keys.length}; i++)
        root = add(root, keys[i]);
    ${call}
    return 0;
}`;
  /** The keys in an order that makes add() build the AVL tree that inserting them one by one gives */
  const avlOrder = (keys) => B.levelOrder(B.avlTree(keys)).map((n) => n.key);
  X.avlMain = avlMain;
  X.avlOrder = avlOrder;

  // the rotations and rebalance(): shared by the three topics
  const ROT = `/* y's left child x comes up; y goes down to the right */
struct node *rotate_right(struct node *y)
{
    struct node *x = y->left;                   /*@ r-x */
    struct node *t2 = x->right;                 /*@ r-t2 */
    y->left = t2;                               /*@ r-link1 */
    x->right = y;                               /*@ r-link2 */
    update(y);                                  /*@ r-hy */
    update(x);                                  /*@ r-hx */
    return x;                                   /*@ r-done */
}

/* y's right child x comes up; y goes down to the left */
struct node *rotate_left(struct node *y)
{
    struct node *x = y->right;                  /*@ l-x */
    struct node *t2 = x->left;                  /*@ l-t2 */
    y->right = t2;                              /*@ l-link1 */
    x->left = y;                                /*@ l-link2 */
    update(y);                                  /*@ l-hy */
    update(x);                                  /*@ l-hx */
    return x;                                   /*@ l-done */
}

/* make the subtree at n obey the AVL rule again; returns its root */
struct node *rebalance(struct node *n)
{
    int bf;
    update(n);                                  /*@ height */
    bf = balance(n);                            /*@ bf */
    if (bf > 1) {                               /*@ left-heavy */
        if (balance(n->left) < 0)               /*@ lr-test */
            n->left = rotate_left(n->left);     /*@ lr-first */
        return rotate_right(n);                 /*@ fix-right */
    }
    if (bf < -1) {                              /*@ right-heavy */
        if (balance(n->right) > 0)              /*@ rl-test */
            n->right = rotate_right(n->right);  /*@ rl-first */
        return rotate_left(n);                  /*@ fix-left */
    }
    return n;                                   /*@ ok */
}`;

  const CUR = { x: 'c-teal', y: 'c-amber', t2: 'c-violet', n: 'c-indigo', t: 'c-green' };
  const capture = (cursors, stackFns) => (P, tk) => B.capture(P, { fields: ['key', 'height'], cursors, stack: stackFns ? { fns: stackFns, v: 'n' } : null }, tk);

  /** Follow rotations through the ticks (memo.rot) and work out the layout options for this tick */
  function track(ctx) {
    const d = ctx.tick.data, tag = ctx.tick.tag, m = ctx.memo, c = d.cursors;
    m.marks = m.marks || new Map();
    const o = {};
    const rt = /^([rl])-(\w+)$/.exec(tag);
    // pointer change 3: the tick after a rotation returned, its caller has stored x where y was
    if (m.rot && m.rot.stage === 'done') {
      const r = m.rot;
      r.stage = 'stored';
      if (d.root === r.x && ctx.prev.data.root === r.y) { m.marks.set('root', '③'); r.where = 'root'; }
      else for (const n of d.nodes) for (const s of ['left', 'right']) if (n.addr !== r.x && n.links[s] === r.x) { const pn = ctx.prev.data.nodes.find((q) => q.addr === n.addr); if (pn && pn.links[s] === r.y) { m.marks.set(n.addr + ':' + s, '③'); r.where = n.key + '->' + s; } }
    }
    if (tag === 'height' || tag === 'enter') m.marks.clear();
    if (rt) {
      const dir = rt[1] === 'r' ? 'right' : 'left', inner = dir === 'right' ? 'left' : 'right';
      switch (rt[2]) {
        case 'x': m.marks.clear(); m.rot = { dir, y: c.y, x: c.x, stage: 'start' }; break;
        case 't2': m.rot.t2 = c.t2 || 0; break;
        case 'link1': m.marks.set(m.rot.y + ':' + inner, '①'); o.freeze = true; break;
        case 'link2': m.marks.set(m.rot.x + ':' + dir, '②'); o.freeze = true; break;
        case 'hy': case 'hx': o.freeze = true; break;
        case 'done': {
          m.rot.stage = 'done';
          o.subst = { from: m.rot.y, to: m.rot.x };
          // the link that still holds y: the caller has not stored x yet
          if (d.root === m.rot.y) o.stale = 'root';
          else for (const n of d.nodes) for (const s of ['left', 'right']) if (n.addr !== m.rot.x && n.links[s] === m.rot.y && !n.freed) o.stale = n.addr + ':' + s;
          break;
        }
      }
    }
    return o;
  }

  /** The picture shared by the AVL topics. opts: {virt, nodeCls(n), extra items, keyToken} */
  function picture(ctx, opts) {
    opts = opts || {};
    const d = ctx.tick.data, tag = ctx.tick.tag, m = ctx.memo;
    const lo = track(ctx);
    const before = new Map(m.balPos || []);
    const lay = B.layout(ctx, d, { freeze: lo.freeze, subst: lo.subst, virt: opts.virt });
    const pos = lay.pos;
    const by = B.byAddr(d);
    const prev = ctx.prev && ctx.prev.data && ctx.prev.data.nodes ? B.byAddr(ctx.prev.data) : new Map();
    const parentOf = new Map();
    for (const n of d.nodes) if (!n.freed) for (const s of ['left', 'right']) if (n.links[s]) parentOf.set(n.links[s], { a: n.addr, s });
    const rot = m.rot && m.rot.stage !== 'stored' ? m.rot : null;
    const stack = new Set(d.stack || []);
    const items = B.picture(ctx, d, {
      pos,
      sub: (n) => (n.freed ? '' : 'h' + n.height),
      nodeCls: (n) => {
        const cl = [];
        const p = prev.get(n.addr);
        if (p && p.height !== n.height && !n.freed) cl.push('bal-hnew');
        if (m.alarmBf && m.alarmBf.has(n.addr)) cl.push('bad');
        if (opts.nodeCls) cl.push(opts.nodeCls(n) || '');
        else if (stack.has(n.addr)) cl.push('part-a');
        if (rot && n.addr === rot.x) cl.push('bal-x');
        if (rot && n.addr === rot.y) cl.push('bal-y');
        return cl.join(' ');
      },
      edgeCls: (n, s) => {
        const k = n.addr + ':' + s;
        if (lo.stale === k) return 'bal-stale';
        const t = by.get(n.links[s]);
        if (t && t.freed) return 'bad';
        return m.marks.has(k) ? 'bal-mark' : (stack.has(n.addr) && stack.has(n.links[s]) ? 'part-a' : '');
      },
      edgeBend: (n, s) => (lo.stale === n.addr + ':' + s ? B.bendAway(pos.get(n.addr), pos.get(n.links[s]), pos.get(m.rot.x), 46) : 0),
      edgeLabel: (n, s) => (lo.stale === n.addr + ':' + s ? '③ still ' + (by.get(n.links[s]) || {}).key : m.marks.get(n.addr + ':' + s) || ''),
      rootArrow: lo.stale === 'root' ? { cls: 'bal-stale', label: '③ still ' + (by.get(d.root) || {}).key } : m.marks.has('root') ? { cls: 'bal-mark', label: '③' } : {},
      stubs: true, virt: opts.virt,
      cursors: d.cursors, cursorCls: CUR,
    });
    // a badge with the balance factor on each node, on the side away from its parent
    m.checked = m.checked || new Set();
    if (tag === 'height') m.checked.add(d.cursors.n);
    const midRot = m.rot && /^[rl]-(link1|link2|hy)$/.test(tag);
    for (const n of d.nodes) {
      if (n.freed || !pos.has(n.addr)) continue;
      const p = pos.get(n.addr), b = m.alarmBf && m.alarmBf.has(n.addr) ? m.alarmBf.get(n.addr) : B.bf(d, n);
      // nodes still waiting on the stack have not been checked yet: their badge is a question mark
      const unsure = (stack.has(n.addr) && !m.checked.has(n.addr)) || (midRot && (n.addr === m.rot.x || n.addr === m.rot.y));
      if (unsure) { const po = parentOf.get(n.addr); items.push({ key: 'b' + n.addr, kind: 'token', x: p.x + (po && po.s === 'left' ? -25 : 25), y: p.y - 22, r: 10, text: '?', cls: 'bal-b0' }); continue; }
      const po = parentOf.get(n.addr);
      const sgn = po && po.s === 'left' ? -1 : 1;
      const big = Math.abs(b) > 1;
      items.push({ key: 'b' + n.addr, kind: 'token', x: p.x + sgn * 25, y: p.y - 22, r: big ? 12 : 10, text: B.fmtBf(b), cls: big ? 'bal-b2' : b ? 'bal-b1' : 'bal-b0', flash: big });
    }
    // the first node found out of balance gets a ring
    if (m.alarmBf) for (const a of m.alarmBf.keys()) if (pos.has(a) && by.has(a) && !by.get(a).freed) items.push({ key: 'alarm' + a, kind: 'ring', x: pos.get(a).x, y: pos.get(a).y, r: B.R + 9, cls: 'bal-alarm' });
    // the subtree T2: the one part that changes parent
    if (rot && rot.t2 !== undefined) {
      if (rot.t2) items.push(...B.around('t2zone', d, pos, rot.t2, 'bal-t2', 'T2'));
      else if (pos.has(rot.x) && ['t2', 'link1', 'link2', 'hy', 'hx'].includes(tag.slice(2))) {
        const xp = pos.get(rot.x), s = rot.dir === 'right' ? 1 : -1;
        items.push({ key: 't2zone', kind: 'region', x: xp.x + s * 22 - 26, y: xp.y + 30, w: 52, h: 40, cls: 'bal-zone bal-t2', text: 'T2' });
        items.push({ key: 't2null', kind: 'text', x: xp.x + s * 22, y: xp.y + 62, text: 'empty', anchor: 'middle', cls: 'idx' });
      }
    }
    // when a rotation returns, show where x and y came from
    if (lo.subst) {
      for (const [a, w] of [[m.rot.x, 'up'], [m.rot.y, 'down']]) {
        const p0 = before.get(a), p1 = pos.get(a);
        if (!p0 || !p1 || Math.abs(p0.y - p1.y) < 1) continue;
        // x's trail on its outer side, y's on the other, so the two never cross
        const out = (w === 'up') === (m.rot.dir === 'right') ? -1 : 1;
        items.push({ key: 'trail' + w, kind: 'arrow', from: { x: p0.x + out * 34, y: p0.y }, to: { x: p1.x + out * 34, y: p1.y + (w === 'up' ? 8 : -8) }, bend: out * (w === 'up' ? 18 : -18), cls: 'bal-trail' });
      }
    }
    return { items, pos, by, lay, lo, track: lo };
  }

  const keyOf = (d, a) => { const n = a && d.nodes.find((q) => q.addr === a); return n ? n.key : 'NULL'; };

  /** Narration for the lines of rebalance() and the two rotations */
  function rotSay(ctx) {
    const d = ctx.tick.data, tag = ctx.tick.tag, c = d.cursors, m = ctx.memo;
    const k = (a) => keyOf(d, a);
    const by = B.byAddr(d);
    const nn = by.get(c.n);
    const hOf = (a) => B.h(d, a);
    const rt = /^([rl])-(\w+)$/.exec(tag);
    if (rt) {
      const right = rt[1] === 'r';
      const inner = right ? 'right' : 'left', outer = right ? 'left' : 'right';
      const nm = right ? 'rotate_right' : 'rotate_left';
      switch (rt[2]) {
        case 'x': return nm + '(' + k(c.y) + '): x = y->' + outer + ', so x is ' + k(c.x) + ', the node that will come up. y, ' + k(c.y) + ', will go down to the ' + (right ? 'right' : 'left') + '.';
        case 't2': return c.t2 ? 't2 = x->' + inner + ' = ' + k(c.t2) + '. The shaded subtree T2 holds ' + (B.keysUnder(d, c.t2).length === 1 ? 'just ' + k(c.t2) + ', which lies' : 'the keys ' + B.keysUnder(d, c.t2).join(', ') + ', all') + ' between ' + Math.min(k(c.x), k(c.y)) + ' and ' + Math.max(k(c.x), k(c.y)) + '. It is the only subtree that changes parent.' : 't2 = x->' + inner + ' is NULL: T2 is empty this time. The links still change in the same way.';
        case 'link1': return 'Pointer change ①: y->' + outer + ' = t2. ' + (c.t2 ? 'T2 (' + k(c.t2) + ') leaves ' + k(c.x) + ' and hangs from ' + k(c.y) + ' instead; its keys are all ' + (right ? 'smaller' : 'bigger') + ' than ' + k(c.y) + ', so that is a legal place.' : k(c.y) + '->' + outer + ' becomes NULL.') + ' The picture holds still while the links change.';
        case 'link2': return 'Pointer change ②: x->' + inner + ' = y. ' + k(c.y) + ' now hangs below ' + k(c.x) + '. But nothing points to ' + k(c.x) + ' yet: the link from above still holds ' + k(c.y) + '.';
        case 'hy': return 'update(y): ' + k(c.y) + ' is now the lower of the two, so its height is fixed first: h = ' + hOf(c.y) + '.';
        case 'hx': return 'update(x): then ' + k(c.x) + ', which sits above ' + k(c.y) + ': h = ' + hOf(c.x) + '. The order matters, because x\'s height depends on y\'s.';
        case 'done': return nm + ' returns ' + k(m.rot.x) + ', the new root of this subtree, and the nodes glide to their new levels: ' + k(m.rot.x) + ' up, ' + k(m.rot.y) + ' down. Left to right the keys read in the same order as before. Pointer change ③ is the caller\'s job: store ' + k(m.rot.x) + ' where ' + k(m.rot.y) + ' was.';
      }
    }
    if (!nn) return '';
    const n = nn.key, bf = B.bf(d, nn), hl = hOf(nn.links.left), hr = hOf(nn.links.right);
    switch (tag) {
      case 'height': { const p = ctx.prev && ctx.prev.data.nodes.find((q) => q.addr === c.n); const was = p ? p.height : nn.height; return 'rebalance(' + n + '): first update(n). The children have heights ' + hl + ' and ' + hr + ', so ' + n + ' gets 1 + ' + Math.max(hl, hr) + ' = ' + nn.height + (was !== nn.height ? ' (it was ' + was + ': this subtree got ' + (nn.height > was ? 'taller' : 'shorter') + ').' : ' (unchanged).'); }
      case 'bf': return 'balance(' + n + ') = ' + hl + ' - ' + hr + ' = ' + B.fmtBf(bf) + '. ' + (Math.abs(bf) <= 1 ? 'Within -1..+1: the AVL rule holds here.' : 'That breaks the AVL rule: one side is two levels taller. ' + n + ' must be rotated.');
      case 'left-heavy': return bf > 1 ? 'bf > 1: ' + n + ' is too tall on the left.' : 'Too tall on the left (bf > 1)? No.';
      case 'right-heavy': return bf < -1 ? 'bf < -1: ' + n + ' is too tall on the right.' : 'Too tall on the right (bf < -1)? No.';
      case 'ok': return 'So ' + n + ' is balanced, and rebalance() returns it unchanged.';
      case 'lr-test': case 'rl-test': {
        const lr = tag === 'lr-test';
        const ch = by.get(lr ? nn.links.left : nn.links.right);
        const cb = B.bf(d, ch);
        const zig = lr ? cb < 0 : cb > 0;
        return 'Look at the taller child, ' + ch.key + ': its balance is ' + B.fmtBf(cb) + '. ' + (zig ? 'It leans the other way, so the path from ' + n + ' zig-zags: the ' + (lr ? 'LR' : 'RL') + ' case. One rotation would not fix that; first rotate ' + ch.key + (lr ? ' left' : ' right') + ' to straighten the zig-zag.' : 'It does not lean the other way: the ' + (lr ? 'LL' : 'RR') + ' case. A single rotation at ' + n + ' is enough.');
      }
      case 'lr-first': return 'n->left = rotate_left(n->left): the first of two rotations, at ' + keyOf(d, nn.links.left) + '. It turns the zig-zag into a straight line.';
      case 'rl-first': return 'n->right = rotate_right(n->right): the first of two rotations, at ' + keyOf(d, nn.links.right) + '. It turns the zig-zag into a straight line.';
      case 'fix-right': return 'return rotate_right(n): ' + n + '\'s left child comes up and ' + n + ' goes down to the right. Whatever rotate_right returns becomes this subtree\'s root.';
      case 'fix-left': return 'return rotate_left(n): ' + n + '\'s right child comes up and ' + n + ' goes down to the left. Whatever rotate_left returns becomes this subtree\'s root.';
    }
    return '';
  }
  /** "③ ..." when the tick just after a rotation stored its result */
  function storedSay(ctx) {
    const m = ctx.memo;
    if (!m.rot || m.rot.stage !== 'stored' || !m.rot.where || m.rot.said) return '';
    m.rot.said = true;
    return 'Pointer change ③: ' + m.rot.where + ' = ' + keyOf(ctx.tick.data, m.rot.x) + '. ';
  }
  /** Mark the first unbalanced nodes as they are found */
  function noteAlarm(ctx) {
    const d = ctx.tick.data, m = ctx.memo;
    m.alarm = m.alarm || new Set();
    m.alarmBf = m.alarmBf || new Map();
    if (ctx.tick.tag === 'bf') { const n = d.nodes.find((q) => q.addr === d.cursors.n); if (n && Math.abs(B.bf(d, n)) > 1) { m.alarm.add(n.addr); m.alarmBf.set(n.addr, B.bf(d, n)); } }
    // the node stays marked until the rotation that lowers it has returned
    if (/^[rl]-done$/.test(ctx.tick.tag) && m.rot) m.alarmBf.delete(m.rot.y);
  }
  /** The case a rebalance is in, as a banner over the tree */
  function banner(ctx, items, pos) {
    const d = ctx.tick.data, m = ctx.memo, tag = ctx.tick.tag;
    const n = d.nodes.find((q) => q.addr === d.cursors.n);
    if (n && (tag === 'lr-test' || tag === 'rl-test')) {
      const lr = tag === 'lr-test';
      const ch = d.nodes.find((q) => q.addr === (lr ? n.links.left : n.links.right));
      const cb = ch ? B.bf(d, ch) : 0;
      m.banner = lr ? (cb < 0 ? 'LR case at ' + n.key + ': rotate ' + ch.key + ' left, then ' + n.key + ' right' : 'LL case at ' + n.key + ': one right rotation') : (cb > 0 ? 'RL case at ' + n.key + ': rotate ' + ch.key + ' right, then ' + n.key + ' left' : 'RR case at ' + n.key + ': one left rotation');
    }
    if (tag === 'height') m.banner = null;
    if (!m.banner) return;
    const xs = [...pos.values()].map((p) => p.x), ys = [...pos.values()].map((p) => p.y);
    items.push({ key: 'banner', kind: 'text', x: Math.min(...xs) - 30, y: Math.min(0, ...ys) - 120, text: m.banner, cls: 'bal-banner' });
  }

  // ---- rotations -------------------------------------------------------------------------------------------
  const rotPresets = [
    { label: 'LL: one right rotation', values: { keys: [50, 30, 70, 20, 40, 10] } },
    { label: 'RR: one left rotation', values: { keys: [30, 20, 50, 40, 60, 70] } },
    { label: 'LR: left, then right', values: { keys: [60, 20, 80, 10, 40, 30, 50] } },
    { label: 'RL: right, then left', values: { keys: [30, 10, 70, 50, 80, 40, 60] } },
    { label: 'Three in a row', values: { keys: [10, 20, 30] } },
  ];
  X.topic({
    id: 'avl-rotate', family: 'avl', order: 10, title: 'Rotations: LL, RR, LR, RL',
    blurb: 'The root leans two levels to one side. One or two rotations lift the tall side up, and only three links change each time.',
    code: ROT,
    animate: ['rebalance', 'rotate_left', 'rotate_right'], quiet: ['update', 'height', 'balance'],
    inputs: [{ id: 'keys', kind: 'ints', label: 'Keys, added with no balancing', def: [50, 30, 70, 20, 40, 10], min: 3, max: 12, distinct: true }],
    check(inp) {
      const t = B.bstTree(inp.keys);
      const b = (t.left ? t.left.h : 0) - (t.right ? t.right.h : 0);
      if (Math.abs(b) !== 2 || !B.avlOk(t, t)) return 'The tree these keys make must lean by exactly 2 at the root and be balanced everywhere else (try 50 30 70 20 40 10, or a preset)';
      return null;
    },
    presets: rotPresets,
    counters: ['writes'],
    main: (inp) => avlMain(inp.keys, 'root = rebalance(root);'),
    capture: capture(['n', 'x', 'y', 't2']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      noteAlarm(ctx);
      if (tag === 'enter') { const r = d.nodes.find((q) => q.addr === d.root); ctx.memo.alarm.add(d.root); ctx.memo.alarmBf.set(d.root, B.bf(d, r)); }
      const pic = picture(ctx, { nodeCls: () => '' });
      const items = pic.items;
      banner(ctx, items, pic.pos);
      let say = storedSay(ctx);
      const rk = keyOf(d, d.root);
      if (tag === 'enter') {
        const r = d.nodes.find((q) => q.addr === d.root);
        say = 'The tree leans: at the root ' + rk + ' the left subtree has height ' + B.h(d, r.links.left) + ' and the right ' + B.h(d, r.links.right) + ', a balance of ' + B.fmtBf(B.bf(d, r)) + '. rebalance(root) is called to fix it. The badges show every node\'s balance factor.';
      } else if (tag === 'after') {
        const r = d.nodes.find((q) => q.addr === d.root);
        say += 'Back in main: root = ' + rk + '. Every badge now reads -1, 0 or +1, and the height went from ' + ctx.ticks[0].data.nodes.find((q) => q.addr === ctx.ticks[0].data.root).height + ' to ' + r.height + '. An in-order walk still gives ' + B.keysUnder(d, d.root).join(' ') + '.';
      } else say += rotSay(ctx);
      return { items, say, view: B.view(items), slow: /-done$/.test(tag) };
    },
    predict: [
      { at: (t) => t.tag === 'left-heavy' || t.tag === 'right-heavy', once: true, ask: 'Which case is this? Look at which way the root leans and which way its taller child leans.', options: () => ['LL', 'LR', 'RR', 'RL'], pick: 'option',
        answer: (ts, i) => { const d = ts[i].data; const n = d.nodes.find((q) => q.addr === d.root); const b = B.bf(d, n); const ch = d.nodes.find((q) => q.addr === (b > 0 ? n.links.left : n.links.right)); const cb = B.bf(d, ch); return b > 0 ? (cb < 0 ? 'LR' : 'LL') : (cb > 0 ? 'RL' : 'RR'); },
        explain: () => 'The first letter is where the root is too tall; the second is which way that taller child leans. Same way: one rotation. Opposite way (a zig-zag): two.' },
      { at: (t) => t.tag === 'bf' && t.data.cursors.n && Math.abs(B.bf(t.data, t.data.nodes.find((q) => q.addr === t.data.cursors.n))) > 1, once: true, ask: 'This subtree must be rebalanced. Click the node that will be at its top when the rotations are over.',
        answer: (ts, i) => { let f = i; while (f < ts.length && !/^fix-/.test(ts[f].tag)) f++; while (f < ts.length && !/^[rl]-x$/.test(ts[f].tag)) f++; return f < ts.length ? 'n' + ts[f].data.cursors.x : null; },
        explain: () => 'In the LL and RR cases the taller child comes up. In LR and RL it is the grandchild in the middle of the zig-zag: its key lies between the other two.' },
      { at: (t, i, ts) => ts[i + 1] && /^[rl]-link1$/.test(ts[i + 1].tag) && t.data.cursors.t2, once: true, ask: 'T2 is about to change parent. Click the node it will hang from.', answer: (ts, i) => 'n' + ts[i].data.cursors.y, explain: () => 'T2 moves from x over to y: its keys lie between x and y, so it fits in the place y gives up when x moves out.' },
    ],
    quiz: [
      { q: 'A single rotation changes how many child links (counting the parent\'s link to the subtree)?', options: ['One', 'Two', 'Three', 'All of them in the subtree'], answer: 2, why: 'y gets T2, x gets y, and the parent (or root) gets x. Everything else stays where it was.' },
      { q: 'Why does T2 change parent and not T1 or T3?', options: ['It is the smallest subtree', 'Its keys lie between x and y, so it must sit between them', 'It is always empty', 'Only by convention'], answer: 1, why: 'After the rotation x is above y. The only place for keys between x and y is y\'s inner side, where x used to be.' },
      { q: 'The root has balance +2 and its left child has balance -1. What fixes it?', options: ['One right rotation at the root', 'One left rotation at the root', 'A left rotation at the left child, then a right rotation at the root', 'Recolouring'], answer: 2, why: 'That is the LR case, a zig-zag. The first rotation straightens it into the LL shape; the second lifts the middle key to the top.' },
      { q: 'In rotate_right, why is update(y) called before update(x)?', options: ['y has the bigger key', 'y is now x\'s child, so x\'s height depends on y\'s', 'It does not matter', 'x is freed'], answer: 1, why: 'Heights are computed from the children. After the rotation y is below x, so y must be right before x can be.' },
      { q: 'Does a rotation change the in-order sequence of keys?', options: ['Yes, it sorts them', 'No, it keeps the same order', 'Only for T2', 'Only in the double cases'], answer: 1, why: 'A rotation only moves nodes up and down. Left to right, the keys read the same, so it is still a search tree.' },
    ],
  });

  // ---- insert ----------------------------------------------------------------------------------------------
  X.topic({
    id: 'avl-insert', family: 'avl', order: 20, title: 'Insert and rebalance',
    blurb: 'A normal insert on the way down. On the way back up every node on the path updates its height and checks its balance; the first one that is off by two is rotated.',
    code: ROT + `

/* insert key below n; returns the subtree's root, which a rotation may change */
struct node *insert(struct node *n, int key)
{
    if (n == NULL)                              /*@ empty */
        return new_node(key);                   /*@ place */
    if (key < n->key)                           /*@ compare */
        n->left = insert(n->left, key);         /*@ down-left */
    else
        n->right = insert(n->right, key);       /*@ down-right */
    return rebalance(n);                        /*@ up */
}`,
    animate: ['insert', 'rebalance', 'rotate_left', 'rotate_right'], quiet: ['update', 'height', 'balance', 'new_node'],
    inputs: [{ id: 'keys', kind: 'ints', label: 'Keys, inserted in this order', def: [40, 20, 60, 10, 30, 50, 70, 25], min: 0, max: 14, distinct: true }, { id: 'key', kind: 'int', label: 'Insert', def: 27, lo: -999, hi: 999 }],
    check: (inp) => (inp.keys.includes(inp.key) ? 'That key is already in the tree; pick another' : null),
    presets: [
      { label: 'Double rotation (LR)', values: { keys: [40, 20, 60, 10, 30, 50, 70, 25], key: 27 } },
      { label: 'Single rotation (RR)', values: { keys: [20, 10, 30, 40], key: 50 } },
      { label: 'No rotation needed', values: { keys: [40, 20, 60, 10, 30], key: 50 } },
      { label: 'Rotation at the root', values: { keys: [30, 20, 40, 10, 25], key: 5 } },
      { label: 'Into an empty tree', values: { keys: [], key: 42 } },
    ],
    counters: ['compares', 'allocs', 'writes'],
    main: (inp) => avlMain(avlOrder(inp.keys), 'root = insert(root, ' + inp.key + ');', 'your keys, in an order that gives the same AVL tree'),
    capture: capture(['n', 'x', 'y', 't2'], ['insert']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, m = ctx.memo;
      noteAlarm(ctx);
      const by = B.byAddr(d);
      // the new node, just made: it hangs from the caller's node until the caller stores it
      let virt = null, fresh = 0;
      if (tag === 'place') {
        const reach = new Set(B.keysUnder(d, d.root));
        const nn = d.nodes.find((q) => q.key === key && !reach.has(q.key));
        fresh = nn ? nn.addr : 0;
        const par = d.stack[1];
        if (fresh) virt = [par ? { from: par, side: key < by.get(par).key ? 'left' : 'right', to: fresh, label: 'on return' } : { from: 'root', to: fresh }];
      }
      if (fresh) m.fresh = fresh;
      const pic = picture(ctx, { virt, nodeCls: (n) => (n.addr === m.fresh ? 'part-b' : d.stack.includes(n.addr) ? 'part-a' : '') });
      const items = pic.items;
      banner(ctx, items, pic.pos);
      // the key on its way down
      const c = d.cursors;
      if (['enter', 'empty', 'compare', 'down-left', 'down-right'].includes(tag)) {
        let at = c.n && pic.pos.get(c.n);
        let tx, ty;
        if (at) { tx = at.x + 44; ty = at.y - 30; }
        else if (d.stack[1] && pic.pos.get(d.stack[1])) { const pp = pic.pos.get(d.stack[1]); tx = pp.x + (key < by.get(d.stack[1]).key ? -1 : 1) * B.DX * 0.6; ty = pp.y + B.DY * 0.8; at = { x: tx, y: ty }; }
        else { tx = 0; ty = 0; }
        items.push({ key: 'tok', kind: 'token', x: tx, y: ty, r: 15, text: String(key), cls: 'c-rose' });
        if (tag === 'compare' && c.n) { const k = by.get(c.n).key; items.push({ key: 'q', kind: 'text', x: tx + 22, y: ty + 4, text: key + (key < k ? ' < ' : ' > ') + k, cls: 'hot' }); }
      }
      const nk = keyOf(d, c.n);
      let say = storedSay(ctx);
      switch (tag) {
        case 'enter': say = 'insert(root, ' + key + '). On the way down it is an ordinary search-tree insert. The interesting part comes as the calls return: each node on the path checks its height and balance.'; break;
        case 'empty': say += c.n ? 'n is ' + nk + ', not NULL: keep going down.' : 'n is NULL: this empty spot is where ' + key + ' belongs.'; break;
        case 'place': say = 'new_node(' + key + ') makes a leaf of height 1. It is returned to the call for ' + keyOf(d, d.stack[1]) + ', which stores it as its ' + (d.stack[1] && key < by.get(d.stack[1]).key ? 'left' : 'right') + ' child.'; break;
        case 'compare': { const k = by.get(c.n).key; say += 'Compare ' + key + ' with ' + k + ': ' + (key < k ? 'smaller, so it goes into the left subtree.' : 'bigger, so it goes into the right subtree.'); break; }
        case 'down-left': case 'down-right': { const n = by.get(c.n); const ch = n.links[tag === 'down-left' ? 'left' : 'right']; say += 'insert(n->' + (tag === 'down-left' ? 'left' : 'right') + ', ' + key + ') on ' + nk + '\'s ' + (tag === 'down-left' ? 'left' : 'right') + ' subtree (' + (ch ? 'rooted at ' + keyOf(d, ch) : 'empty') + '). The call for ' + nk + ' waits on the stack until it returns; ' + d.stack.length + ' calls of insert are active now.'; break; }
        case 'up': { say += 'Back in the call for ' + nk + ': its subtree now holds ' + key + '. Before returning, return rebalance(n) checks ' + nk + '.'; break; }
        case 'after': { const r = by.get(d.root); say += 'Back in main: root = ' + keyOf(d, d.root) + '. ' + d.nodes.length + ' keys, height ' + (r ? r.height : 0) + ', and every badge is -1, 0 or +1. ' + (m.alarm.size ? 'One rebalance was enough: it brought that subtree back to the height it had before the insert, so the nodes above saw no change.' : 'No node went out of balance, so no rotation was needed.'); break; }
        default: say += rotSay(ctx);
      }
      return { items, say, calls: d.calls, view: B.view(items), slow: /-done$/.test(tag) || (tag === 'bf' && m.alarm.has(c.n)) };
    },
    predict: [
      { at: (t) => t.tag === 'place', once: true, ask: 'On the way back up, will any node be out of balance?', options: () => ['Yes, a rotation will be needed', 'No, only heights change'], pick: 'option',
        answer: (ts) => (ts.some((t) => /^[rl]-x$/.test(t.tag)) ? 'Yes, a rotation will be needed' : 'No, only heights change'),
        explain: () => 'A node goes out of balance when the side that grew was already the taller one.' },
      { at: (t, i, ts) => t.tag === 'up' && ts.some((u) => /^[rl]-x$/.test(u.tag)), once: true, ask: 'Click the first node on the way up that will be out of balance.',
        answer: (ts, i) => { for (let j = i; j < ts.length; j++) if (/^(left|right)-heavy$/.test(ts[j].tag)) { const d = ts[j].data; const n = d.nodes.find((q) => q.addr === d.cursors.n); if (n && Math.abs(B.bf(d, n)) > 1) return 'n' + n.addr; } return null; },
        explain: () => 'It is the lowest node on the path whose taller side is the side that just grew.' },
      { at: (t, i, ts) => ts[i + 1] && (ts[i + 1].tag === 'lr-test' || ts[i + 1].tag === 'rl-test'), once: true, ask: 'This node needs rebalancing. One rotation or two?', options: () => ['One', 'Two'], pick: 'option',
        answer: (ts, i) => (ts[i + 2] && /first$/.test(ts[i + 2].tag) ? 'Two' : 'One'), explain: () => 'Two when the taller child leans the opposite way (a zig-zag).' },
    ],
    quiz: [
      { q: 'After an insertion, how many rebalancing operations (single or double rotations) can be needed?', options: ['None or one', 'One per level', 'Always two', 'log n'], answer: 0, why: 'The rotation brings the unbalanced subtree back to the height it had before the insert, so every node above sees no change.' },
      { q: 'Which node is the first to go out of balance after an insert?', options: ['Always the root', 'The new leaf', 'The lowest node on the path whose taller side just grew', 'The parent of the new leaf'], answer: 2, why: 'Heights are checked on the way up; the first node where the side that grew was already taller now differs by 2.' },
      { q: 'Why is the height stored in each node rather than computed when needed?', options: ['To save memory', 'Computing it would visit the whole subtree, making every operation O(n)', 'C cannot compute heights', 'It is only for drawing'], answer: 1, why: 'With heights stored, update() is O(1), and the whole insert stays O(log n).' },
      { q: 'What is the height of an AVL tree with n keys?', options: ['Up to n', 'About 1.44 log2 n at most', 'Exactly log2 n', 'About n / 2'], answer: 1, why: 'The worst AVL trees (Fibonacci trees) are still within about 1.44 log2 n, so search stays logarithmic.' },
      { q: 'Inserting 10, 20, 30 in this order into an empty AVL tree gives...', options: ['A chain 10-20-30', 'Root 20 with children 10 and 30', 'Root 30', 'Root 10'], answer: 1, why: 'After 30 goes in, 10 has balance -2: the RR case. A left rotation lifts 20 to the top.' },
    ],
    compareWith: 'bst-insert',
  });

  // ---- delete ----------------------------------------------------------------------------------------------
  X.topic({
    id: 'avl-delete', family: 'avl', order: 30, title: 'Delete and rebalance',
    blurb: 'Removing a key can shorten one side. On the way back up, more than one node may need a rotation, because a rotation can make its subtree shorter too.',
    code: ROT + `

/* the smallest key in a subtree: keep going left */
struct node *min_node(struct node *t)
{
    while (t->left != NULL)                     /*@ min-test */
        t = t->left;                            /*@ min-step */
    return t;                                   /*@ min-found */
}

/* delete key from the subtree at n; returns the subtree's new root */
struct node *delete_key(struct node *n, int key)
{
    struct node *t;
    if (n == NULL)                              /*@ missing */
        return NULL;                            /*@ not-found */
    if (key < n->key)                           /*@ compare */
        n->left = delete_key(n->left, key);     /*@ down-left */
    else if (key > n->key)                      /*@ compare2 */
        n->right = delete_key(n->right, key);   /*@ down-right */
    else if (n->left == NULL || n->right == NULL) {   /*@ found */
        t = n->left != NULL ? n->left : n->right;     /*@ child */
        free(n);                                /*@ free */
        return t;                               /*@ splice */
    } else {
        t = min_node(n->right);                 /*@ succ */
        n->key = t->key;                        /*@ copy */
        n->right = delete_key(n->right, t->key);    /*@ down-succ */
    }
    return rebalance(n);                        /*@ up */
}`,
    animate: ['delete_key', 'min_node', 'rebalance', 'rotate_left', 'rotate_right'], quiet: ['update', 'height', 'balance'],
    inputs: [{ id: 'keys', kind: 'ints', label: 'Keys, inserted in this order', def: [45, 25, 70, 15, 40, 60, 90, 35, 65, 75, 95, 85], min: 1, max: 14, distinct: true }, { id: 'key', kind: 'int', label: 'Delete', def: 15, lo: -999, hi: 999 }],
    check: (inp) => (inp.keys.includes(inp.key) ? null : 'Delete: pick a key that is in the tree'),
    presets: [
      { label: 'Rotations at two levels', values: { keys: [45, 25, 70, 15, 40, 60, 90, 35, 65, 75, 95, 85], key: 15 } },
      { label: 'A leaf, one rotation', values: { keys: [20, 10, 30, 40], key: 10 } },
      { label: 'Two children: successor', values: { keys: [40, 20, 60, 10, 30, 50, 70, 55], key: 40 } },
      { label: 'No rotation needed', values: { keys: [40, 20, 60, 10, 30, 50, 70], key: 30 } },
      { label: 'Double rotation (RL)', values: { keys: [20, 10, 40, 30], key: 10 } },
    ],
    counters: ['compares', 'frees', 'writes'],
    main: (inp) => avlMain(avlOrder(inp.keys), 'root = delete_key(root, ' + inp.key + ');', 'your keys, in an order that gives the same AVL tree'),
    capture: capture(['n', 'x', 'y', 't2', 't'], ['delete_key']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, m = ctx.memo;
      noteAlarm(ctx);
      const by = B.byAddr(d);
      const c = d.cursors;
      // the freed node's only child is handed up: it hangs from the caller's node until stored
      let virt = null;
      if (tag === 'splice') {
        // the caller that will store t: the nearest live node on the stack (the freed one is not it)
        const par = d.stack.map((a) => by.get(a)).find((q) => q && !q.freed);
        const t = c.t !== undefined ? c.t : ctx.prev.data.cursors.t;
        if (t && par) virt = [{ from: par.addr, side: m.side || 'left', to: t, label: 'on return' }];
        else if (t) virt = [{ from: 'root', to: t }];
      }
      if (tag === 'down-left') m.side = 'left';
      if (tag === 'down-right' || tag === 'down-succ') m.side = 'right';
      if (tag === 'succ') m.target = c.n;
      const pic = picture(ctx, { virt, nodeCls: (n) => (n.freed ? '' : n.addr === m.victim ? 'bal-victim' : n.addr === c.t && /^(min|copy|succ)/.test(tag) ? 'part-b' : d.stack.includes(n.addr) ? 'part-a' : '') });
      if (tag === 'found') m.victim = c.n;
      const items = pic.items;
      banner(ctx, items, pic.pos);
      const nk = keyOf(d, c.n);
      const n = by.get(c.n);
      const target = m.copyKey !== undefined ? m.copyKey : key;
      let say = storedSay(ctx);
      switch (tag) {
        case 'enter': say = 'delete_key(root, ' + key + '). Down the tree to find ' + key + ', remove it, and then on the way back up check every node on the path. Unlike insertion, a rotation here can leave its subtree one level shorter, so the check must go all the way to the root.'; break;
        case 'missing': say += c.n ? 'n is ' + nk + ', not NULL.' : 'n is NULL: ' + target + ' is not in this subtree.'; break;
        case 'not-found': say = 'Nothing to delete here: return NULL.'; break;
        case 'compare': say += 'Is ' + target + ' < ' + nk + '? ' + (target < n.key ? 'Yes: go left.' : 'No.'); break;
        case 'compare2': say += 'Is ' + target + ' > ' + nk + '? ' + (target > n.key ? 'Yes: go right.' : 'No: this is the node to delete.'); break;
        case 'down-left': case 'down-right': say += 'delete_key on ' + nk + '\'s ' + (tag === 'down-left' ? 'left' : 'right') + ' subtree. The call for ' + nk + ' waits on the stack; it will rebalance on the way back.'; break;
        case 'found': say += nk + (n.links.left && n.links.right ? ' has two children: it cannot simply be cut out. Its key will be replaced by its successor\'s, and the successor deleted instead.' : n.links.left || n.links.right ? ' has one child: that child takes its place.' : ' is a leaf: it can simply be removed.'); break;
        case 'child': say = 't = ' + (c.t ? keyOf(d, c.t) + ', the only child: it moves up into ' + nk + '\'s place.' : 'NULL: there is no child, the place becomes empty.'); m.victim = c.n; break;
        case 'free': say = 'free(n): the node that held ' + target + ' goes back to the heap. The link from above still points at it until this call returns.'; break;
        case 'splice': say = 'return t: the call above stores ' + (ctx.prev.data.cursors.t ? keyOf(d, ctx.prev.data.cursors.t) : 'NULL') + ' in the link that held the freed node. That side is now one level shorter.'; break;
        case 'succ': say = 'min_node(n->right): the successor is the smallest key in ' + nk + '\'s right subtree.'; break;
        case 'min-test': say = keyOf(d, c.t) + (by.get(c.t) && by.get(c.t).links.left ? ' has a left child: keep going left.' : ' has no left child: it is the smallest.'); break;
        case 'min-step': say = 't moves left to ' + keyOf(d, c.t) + '.'; break;
        case 'min-found': say = 'min_node returns ' + keyOf(d, ctx.prev.data.cursors.t) + ': the successor, the next key after ' + target + ' in order.'; break;
        case 'copy': m.copyKey = n.key; say = 'n->key = t->key: ' + n.key + ' is copied up into the node being deleted. Now the tree holds ' + n.key + ' twice, and the lower copy must go: it has no left child, so it is easy to remove.'; break;
        case 'down-succ': say = 'delete_key(n->right, ' + target + '): delete the old copy of ' + target + ' from the right subtree.'; break;
        case 'up': say += 'Back in the call for ' + nk + ': one of its subtrees may be shorter now. return rebalance(n) checks.'; break;
        case 'after': { const r = by.get(d.root); const rots = ctx.ticks.slice(0, ctx.i).filter((t) => /^[rl]-x$/.test(t.tag)).length; say += 'Back in main: root = ' + keyOf(d, d.root) + '. ' + d.nodes.length + ' keys, height ' + (r ? r.height : 0) + '. ' + (rots ? rots + ' rotation' + (rots === 1 ? '' : 's') + ' on the way up, at ' + m.alarm.size + (m.alarm.size === 1 ? ' level.' : ' different levels: the lower rebalance left its subtree shorter, and that unbalanced a node higher up.') : 'No rotation was needed: every node stayed within -1..+1.'); break; }
        default: say += rotSay(ctx);
      }
      return { items, say, calls: d.calls, view: B.view(items), slow: /-done$/.test(tag) || tag === 'free' || (tag === 'bf' && m.alarm.has(c.n)) };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'found', once: true, ask: 'This is the node holding the key. Which node will actually be freed? Click it.',
        answer: (ts, i) => { const d = ts[i + 1].data; const n = d.nodes.find((q) => q.addr === d.cursors.n); if (!n.links.left || !n.links.right) return 'n' + n.addr; let s = d.nodes.find((q) => q.addr === n.links.right); while (s.links.left) s = d.nodes.find((q) => q.addr === s.links.left); return 'n' + s.addr; },
        explain: () => 'With two children, the node stays and takes its successor\'s key; the successor\'s node is the one freed.' },
      { at: (t, i, ts) => { if (!/^[rl]-done$/.test(t.tag)) return false; for (let j = i - 1; j >= 0; j--) if (/^(fix-|lr-first|rl-first)/.test(ts[j].tag)) return /^fix-/.test(ts[j].tag); return false; }, once: true, ask: 'This rotation is done. Will another node further up need a rotation too?', options: () => ['Yes', 'No'], pick: 'option',
        answer: (ts, i) => (ts.slice(i + 1).some((u) => /^(fix-|lr-first|rl-first)/.test(u.tag)) ? 'Yes' : 'No'),
        explain: () => 'After a deletion a rotation can leave its subtree one level shorter than before, and that can unbalance a node higher up.' },
    ],
    quiz: [
      { q: 'How many rotations can one AVL deletion need?', options: ['At most one', 'At most two', 'Up to one per level, O(log n)', 'Always none'], answer: 2, why: 'A rotation after a delete can shorten its subtree, which can unbalance the next node up, all the way to the root.' },
      { q: 'Why can insertion stop after one rotation, but deletion cannot?', options: ['Deletion frees memory', 'After an insert, the rotation restores the old height; after a delete, it may leave the subtree shorter', 'Deletion uses the successor', 'It can; both stop after one'], answer: 1, why: 'The insert rotation exactly cancels the growth. A delete rotation may reduce the height by one, which the parent notices.' },
      { q: 'The node to delete has two children. What happens?', options: ['Both children are freed', 'Its successor\'s key is copied in, and the successor node is deleted', 'The tree is rebuilt', 'The left child takes its place'], answer: 1, why: 'The successor has no left child, so removing it is easy; copying its key keeps the order.' },
      { q: 'A node has balance -2 and its right child has balance 0. This only happens after deletion. What fixes it?', options: ['A single left rotation', 'A right then a left rotation', 'Nothing', 'Two left rotations'], answer: 0, why: 'A child with balance 0 counts as leaning the same way: one rotation is enough (and the subtree keeps its height).' },
    ],
    compareWith: 'avl-insert',
  });
})(SEE);
