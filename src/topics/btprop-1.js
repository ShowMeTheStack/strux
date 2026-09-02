// Binary tree properties: the family, its shared helpers, and height, size, leaves, diameter.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, T = X.TreeKit;
  const B = X.BtProp = {};
  B.DX = 64; B.DY = 92;

  // ---- the tree you type: level order, -1 for "no node here" ----------------------------------------------
  /** Parse a level-order list into {key[], left[], right[], depth[], root} (indices; -1 for none), or {err} */
  B.parse = function (vals) {
    const out = { key: [], left: [], right: [], depth: [], root: -1 };
    if (!vals.length || vals[0] === -1) {
      if (vals.length > 1) return { err: 'the first value is the root; with -1 there the tree is empty, so nothing may follow it' };
      return out;
    }
    const add = (k, d) => { out.key.push(k); out.left.push(-1); out.right.push(-1); out.depth.push(d); return out.key.length - 1; };
    out.root = add(vals[0], 0);
    const q = [out.root];
    let i = 1;
    while (q.length && i < vals.length) {
      const p = q.shift();
      for (const side of ['left', 'right']) {
        if (i >= vals.length) break;
        if (vals[i] !== -1) { const c = add(vals[i], out.depth[p] + 1); out[side][p] = c; q.push(c); }
        i++;
      }
    }
    if (i < vals.length) return { err: 'there are more values than places for them: after ' + vals.slice(0, i).join(' ') + ' every node already has both children given' };
    return out;
  };
  B.levelCheck = function (vals, maxNodes, maxHeight) {
    const keys = vals.filter((v) => v !== -1);
    if (vals.some((v) => v < -1 || v > 99)) return 'keys from 0 to 99, and -1 where there is no node';
    if (new Set(keys).size !== keys.length) return 'each key only once, so every node can be told apart';
    if (keys.length > (maxNodes || 15)) return 'at most ' + (maxNodes || 15) + ' nodes, so the picture stays readable';
    const t = B.parse(vals);
    if (t.err) return t.err;
    const h = t.depth.length ? Math.max(...t.depth) + 1 : 0;
    if (h > (maxHeight || 5)) return 'at most ' + (maxHeight || 5) + ' levels, so the tree fits on the screen';
    return null;
  };
  B.levelInput = (id, label, def, maxNodes, maxHeight) => ({
    id, kind: 'ints', label: label || 'Tree in level order (-1 = no node)', def, max: 31,
    check: (v) => { const e = B.levelCheck(v, maxNodes, maxHeight); return e ? (label || 'Tree') + ': ' + e : null; },
  });
  B.cArray = (vals) => '{ ' + (vals.length ? vals.join(', ') : '-1') + ' }';

  const NODE = `#include <stdio.h>
#include <stdlib.h>

/* a binary tree node: a key and two subtrees, either of which may be empty */
struct node {
    int key;
    struct node *left;
    struct node *right;
};

struct node *new_node(int key)
{
    struct node *n = malloc(sizeof *n);
    n->key = key;
    n->left = NULL;
    n->right = NULL;
    return n;
}`;
  const LEVEL = `
/* main uses this to build the tree you chose: keys in level order, -1 where there is no node */
struct node *build(int a[], int n)
{
    struct node *queue[32];
    struct node *root;
    int head = 0, tail = 0, i = 1;
    if (n == 0 || a[0] == -1)
        return NULL;
    root = new_node(a[0]);
    queue[tail++] = root;
    while (head < tail && i < n) {
        struct node *p = queue[head++];
        if (i < n && a[i] != -1)
            queue[tail++] = p->left = new_node(a[i]);
        i++;
        if (i < n && a[i] != -1)
            queue[tail++] = p->right = new_node(a[i]);
        i++;
    }
    return root;
}`;
  X.family({
    id: 'btprop', order: 2, group: 'Trees', title: 'Tree properties and construction',
    blurb: 'Height, size, balance, ancestors, and building a tree back from its traversals. Almost every answer comes from asking both subtrees and combining what they say.',
    head: (t) => NODE + (t.noLevel ? '' : '\n' + LEVEL),
  });
  /** main for a topic on one level-order tree: tree = build(...); then the call */
  B.main = (vals, call, decl) => `int main(void)
{
    int keys[] = ${B.cArray(vals)};
    struct node *tree = build(keys, ${vals.length || 1});
${decl ? '    ' + decl + '\n' : ''}    ${call}
    return 0;
}`;

  // ---- following the recursion ------------------------------------------------------------------------------
  /** The capture for a recursive function over one tree: the nodes, and every call on the stack */
  B.capture = (locals, extra) => (P) => {
    const d = T.capture(P, { type: 'tree', root: 'tree', fields: ['key'] });
    d.calls = P.calls(locals || []);
    if (extra) d.extra = extra(P);
    return d;
  };
  /**
   * The calls of fn on the stack, oldest first, as [{node, vars, id, side, parent}]. Each call keeps an id
   * while it is alive, and remembers whether its caller asked about the left or the right subtree
   * (the tick that enters a call carries the tag of the caller's line).
   */
  B.frames = function (ctx, fn, ptr, leftTags, rightTags) {
    const memo = ctx.memo;
    const key = 'frames:' + fn;
    if (memo[key] && memo[key].i === ctx.i) return memo[key].list;
    const old = memo[key] ? memo[key].list : [];
    memo.callId = memo.callId || 0;
    const calls = (ctx.tick.data.calls || []).filter((c) => c.fn === fn);
    const tag = ctx.tick.tag;
    const list = calls.map((c, j) => {
      const node = c.args[ptr || 'root'] || 0;
      const o = old[j];
      // the top call on a calling line has just been entered, even if a finished sibling looked the same
      const fresh = j === calls.length - 1 && (leftTags.includes(tag) || rightTags.includes(tag));
      if (o && !fresh && o.node === node && o.fp === c.fp) return Object.assign({}, o, { vars: c.args });
      return { node, vars: c.args, fp: c.fp, id: ++memo.callId, side: leftTags.includes(tag) ? 'left' : rightTags.includes(tag) ? 'right' : null, parent: j ? calls[j - 1].args[ptr || 'root'] : null, depth: j };
    });
    memo[key] = { i: ctx.i, list };
    return list;
  };
  /** Where a call stands on the picture: a node, or the empty spot under its parent */
  B.spot = (pos, f) => {
    if (f.node && pos.get(f.node)) return pos.get(f.node);
    const p = f.parent && pos.get(f.parent);
    if (!p) return { x: 0, y: 0 };
    return { x: p.x + (f.side === 'left' ? -0.42 : 0.42) * B.DX, y: p.y + 0.62 * B.DY, empty: true };
  };
  /** A dashed circle marking an empty subtree that a call is looking at */
  B.nullSpot = (pos, f, cls) => {
    const s = B.spot(pos, f), p = f.parent && pos.get(f.parent);
    return [
      p ? { key: 'nullln' + f.parent + f.side, kind: 'line', x1: p.x + (s.x - p.x) * 0.38, y1: p.y + (s.y - p.y) * 0.38, x2: p.x + (s.x - p.x) * 0.78, y2: p.y + (s.y - p.y) * 0.78, cls: 'bp-dashed' } : null,
      { key: 'null' + f.parent + f.side, kind: 'ring', x: s.x, y: s.y, r: 13, cls: 'bp-null ' + (cls || '') },
      { key: 'nullt' + f.parent + f.side, kind: 'text', x: s.x, y: s.y + 30, text: 'NULL', anchor: 'middle', cls: 'bp-nullmark' },
    ].filter(Boolean);
  };
  /**
   * The call stack, drawn to the left of the tree: one row per call, each row level with the depth it
   * works on. fmt(frame) -> [cells]. Returns items.
   */
  B.stack = function (frames, fmt, opts) {
    opts = opts || {};
    const items = [];
    const x = opts.x === undefined ? -330 : opts.x, w = opts.w || 250;
    if (frames.length) items.push({ key: 'stk-title', kind: 'text', x, y: -40, text: opts.title || 'calls on the stack', cls: 'bp-title' });
    frames.forEach((f, j) => {
      const top = j === frames.length - 1;
      items.push({
        key: 'stk' + f.id, kind: 'node', x, y: j * B.DY - 17, w, h: 34, cells: fmt(f, top),
        cls: 'bp-frame' + (top ? ' bp-top' : ''), enter: 'drop', exit: 'fade',
      });
    });
    return items;
  };
  B.keyOf = (d) => { const m = new Map(d.nodes.map((n) => [n.addr, n.key])); return (a) => (a && m.has(a) ? m.get(a) : 'NULL'); };
  /** Classes for the nodes on the active path of calls */
  B.pathSet = (frames) => new Set(frames.map((f) => f.node).filter(Boolean));
  /** Readable call stack for the Calls tab: pointers shown by the key they point to */
  B.callsTab = (d, fn, ptrs) => {
    const k = B.keyOf(d);
    return (d.calls || []).filter((c) => c.fn === fn).map((c) => {
      const args = {};
      for (const [n, v] of Object.entries(c.args)) args[n] = ptrs.includes(n) ? (v ? 'node ' + k(v) : 'NULL') : v;
      return { fn: c.fn, args };
    });
  };
  /** The value of a finished call, flying up from the callee to the caller */
  B.flyUp = (key, from, to, text, cls, dx) => ({ key, kind: 'token', x: to.x + (dx || 0), y: to.y - 34, r: String(text).length > 2 ? 19 : 15, text: String(text), cls: (cls || 'c-amber') + (String(text).length > 2 ? ' bp-wide' : ''), enter: 'fly', from: { x: from.x, y: from.y - 10 } });
  /**
   * One step of a recursive function: the calls on the stack, the top one, and, on a return line, the
   * call that has just finished with the value it gave back. retVal(tag, finished, top, last value
   * returned before this one) -> value or undefined.
   */
  B.step = function (ctx, fn, ptr, leftTags, rightTags, retVal, retTags) {
    const memo = ctx.memo;
    let fr = B.frames(ctx, fn, ptr, leftTags, rightTags);
    const lastKey = 'last:' + fn;
    const done = memo[lastKey], prevN = memo[lastKey + 'n'] || 0;
    const tag = ctx.tick.tag;
    let ret = null;
    if (fr.length && fr.length >= prevN && (retTags.includes(tag) || ctx.tick.end)) {
      // the return line is drawn while the returning call is still on the stack: treat it as already
      // finished, so the picture shows the value on its way to the caller
      const f = fr[fr.length - 1];
      const rest = fr.slice(0, -1);
      const v = retVal(tag, f, rest[rest.length - 1] || null, memo[lastKey + 'v']);
      if (v !== undefined) { ret = { f, v }; fr = rest; memo[lastKey + 'v'] = v; }
    } else if (done && fr.length < prevN) {
      // a call that ended without a line of its own: return f(...) hands back its callee's value
      const v = retVal(tag, done, fr[fr.length - 1] || null, memo[lastKey + 'v']);
      if (v !== undefined) { ret = { f: done, v }; memo[lastKey + 'v'] = v; }
    }
    const top = fr[fr.length - 1] || null;
    memo[lastKey] = top;
    memo[lastKey + 'n'] = fr.length;
    return { fr, top, ret, key: B.keyOf(ctx.tick.data) };
  };
  /** The deepest path down from node a, following the taller child: [addr, ...] */
  B.deepest = (d, a, hts) => {
    const by = new Map(d.nodes.map((n) => [n.addr, n]));
    const out = [];
    while (a && by.has(a)) {
      out.push(a);
      const n = by.get(a), l = n.links.left, r = n.links.right;
      a = (hts.get(l) || 0) >= (hts.get(r) || 0) ? l : r;
    }
    return out;
  };
  /** Thick soft lines under the edges of a path of nodes: [addr, ...] */
  B.glow = (pos, path, cls, tag) => {
    const out = [];
    for (let j = 1; j < path.length; j++) {
      const a = pos.get(path[j - 1]), b = pos.get(path[j]);
      if (a && b) out.push({ key: 'gl' + (tag || '') + path[j - 1] + '-' + path[j], kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, cls: 'bp-glow ' + (cls || '') });
    }
    return out;
  };
  /** The box around a subtree, in picture coordinates */
  B.box = (d, pos, a) => {
    const by = new Map(d.nodes.map((n) => [n.addr, n]));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const go = (c) => {
      if (!c || !by.has(c) || !pos.get(c)) return;
      const p = pos.get(c);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      go(by.get(c).links.left); go(by.get(c).links.right);
    };
    go(a);
    if (x0 === Infinity) return null;
    return { x: x0 - 30, y: y0 - 30, w: x1 - x0 + 60, h: y1 - y0 + 66 };
  };
  /** Leaves and other shape facts of a captured tree */
  B.shape = (d) => {
    const by = new Map(d.nodes.map((n) => [n.addr, n]));
    return { by, isLeaf: (a) => by.has(a) && !by.get(a).links.left && !by.get(a).links.right };
  };

  // ---- height ------------------------------------------------------------------------------------------------
  const topCall = (t, fn) => (t.data.calls || []).filter((c) => c.fn === fn).pop() || null;
  B.topCall = topCall;
  B.trees = [
    { label: 'Uneven tree', values: { tree: [8, 3, 10, 1, 6, -1, 14, -1, -1, 4, 7] } },
    { label: 'Full tree', values: { tree: [4, 2, 6, 1, 3, 5, 7] } },
    { label: 'A chain to the left', values: { tree: [5, 4, -1, 3, -1, 2] } },
    { label: 'One node', values: { tree: [9] } },
    { label: 'Empty tree', values: { tree: [] } },
  ];
  X.topic({
    id: 'bt-height', family: 'btprop', order: 10, title: 'Height',
    blurb: 'A node cannot know its height until both children have answered. The answers start at the empty subtrees, as 0, and climb back up one level at a time.',
    code: `/* the number of nodes on the longest path from root down to a leaf */
int height(struct node *root)
{
    int lh, rh;
    if (root == NULL)                 /*@ test */
        return 0;                     /*@ base */
    lh = height(root->left);          /*@ go-left */
    rh = height(root->right);         /*@ go-right */
    if (lh > rh)                      /*@ compare */
        return lh + 1;                /*@ ret-left */
    return rh + 1;                    /*@ ret-right */
}`,
    animate: ['height'], quiet: ['new_node'],
    inputs: [B.levelInput('tree', null, [8, 3, 10, 1, 6, -1, 14, -1, -1, 4, 7])],
    presets: B.trees,
    counters: ['compares'],
    main: (inp) => B.main(inp.tree, 'printf("height = %d\\n", height(tree));'),
    capture: B.capture(['lh', 'rh']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo;
      const st = B.step(ctx, 'height', 'root', ['go-left'], ['go-right'], (tg, f) => (tg === 'base' ? 0 : tg === 'ret-left' ? f.vars.lh + 1 : tg === 'ret-right' ? f.vars.rh + 1 : undefined), ['base', 'ret-left', 'ret-right']);
      const { fr, top, ret, key } = st;
      memo.h = memo.h || {};
      if (ret && ret.f.node) memo.h[ret.f.node] = ret.v;
      const end = tag === 'after';
      const tall = end && d.root ? B.deepest(d, d.root, T.heights(d)) : [];
      const path = B.pathSet(fr);
      const pic = T.picture(ctx, d, {
        rootName: 'tree',
        nodeCls: (n) => 'bp-lab ' + (top && n.addr === top.node ? 'focus' : path.has(n.addr) ? 'part-b' : memo.h[n.addr] !== undefined ? 'part-a' : ''),
        label: (n) => (memo.h[n.addr] !== undefined ? 'h = ' + memo.h[n.addr] : ''),
      });
      const items = pic.items, pos = pic.pos;
      items.push(...B.glow(pos, tall, 'bp-green'));
      if (top && !top.node) items.push(...B.nullSpot(pos, top, 'hot'));
      if (ret && !ret.f.node) items.push(...B.nullSpot(pos, ret.f, ''));
      if (ret) {
        const from = B.spot(pos, ret.f), to = top ? B.spot(pos, top) : { x: from.x, y: from.y - 40 };
        items.push(B.flyUp('ret' + ctx.i, from, to, ret.v, 'c-amber', ret.f.side === 'left' ? -30 : ret.f.side === 'right' ? 30 : 0));
      }
      if (tag === 'compare' && top) {
        const p = pos.get(top.node);
        items.push({ key: 'cmp', kind: 'text', x: p.x + 34, y: p.y - 30, text: 'lh ' + top.vars.lh + ' vs rh ' + top.vars.rh, cls: 'bp-hot' });
      }
      items.push(...B.stack(fr, (f) => [
        { text: 'height(' + key(f.node) + ')', w: 2.2 },
        { text: f.node ? 'lh ' + (f.vars.lh === undefined ? '?' : f.vars.lh) : '', w: 1, cls: 'link' },
        { text: f.node ? 'rh ' + (f.vars.rh === undefined ? '?' : f.vars.rh) : '', w: 1, cls: 'link' },
      ]));
      const k = top ? key(top.node) : '';
      const pk = top && top.parent ? key(top.parent) : '';
      const below = fr.length > 1 ? fr[fr.length - 2] : null;
      let say = '';
      switch (tag) {
        case 'enter': say = 'height(tree) starts at the root' + (top && top.node ? ', ' + k : ', but the tree is empty') + '. Nothing is known yet: first both subtrees must be measured.'; break;
        case 'test': say = top.node ? 'Node ' + k + ' is a real node, so this call has work to do.' : (top.parent ? 'This is the empty ' + top.side + ' subtree of ' + pk + '. ' : 'The tree is empty. ') + 'An empty tree has height 0: here the recursion stops going down.'; break;
        case 'base': say = 'The empty subtree answers 0' + (top ? ', and the 0 goes back up to ' + key(top.node) + '.' : '.'); break;
        case 'go-left': say = top.node ? 'Node ' + pk + ' asks its left child, ' + k + ', for its height, and waits on the stack.' : 'Node ' + pk + ' asks its left subtree for its height. There is no left child, so this call gets NULL.'; break;
        case 'go-right': say = 'Node ' + pk + ' has lh = ' + (below ? below.vars.lh : 0) + '. ' + (top.node ? 'Now it asks its right child, ' + k + '.' : 'Its right subtree is empty: one more call, with NULL.'); break;
        case 'compare': say = 'Both answers are in for ' + k + ': lh = ' + top.vars.lh + ', rh = ' + top.vars.rh + '. The taller side counts, plus 1 for ' + k + ' itself.'; break;
        case 'ret-left': case 'ret-right':
          say = 'height(' + (ret ? key(ret.f.node) : '') + ') returns ' + (ret ? ret.v : '') + (top ? '. The value climbs one level, to ' + key(top.node) + ', which was waiting for it.' : '. That is the height of the whole tree.');
          break;
        case 'after': say = d.root ? 'The height is ' + memo.h[d.root] + ': the green path from the root has ' + memo.h[d.root] + ' node' + (memo.h[d.root] === 1 ? '' : 's') + '. Each node was visited once, and so was each empty subtree.' : 'The tree is empty, so its height is 0.'; break;
      }
      return { items, say, calls: B.callsTab(d, 'height', ['root']), slow: !!ret && !!ret.f.node };
    },
    predict: [
      { at: (t) => t.tag === 'compare' && t.data.calls.filter((c) => c.fn === 'height').length > 1, once: true,
        ask: (t) => { const c = topCall(t, 'height'); return 'lh = ' + c.args.lh + ' and rh = ' + c.args.rh + '. What will this call return?'; },
        options: () => ['0', '1', '2', '3', '4', '5'], pick: 'option',
        answer: (ts, i) => { const c = topCall(ts[i], 'height'); return String(1 + Math.max(c.args.lh, c.args.rh)); },
        explain: () => 'One more than the taller of the two subtrees.' },
      { at: (t) => t.tag === 'test' && topCall(t, 'height') && !topCall(t, 'height').args.root, once: true,
        ask: 'This call got an empty subtree. What does it return?', options: () => ['0', '1', '-1', 'Nothing, it crashes'], pick: 'option', answer: () => '0',
        explain: () => 'The base case: an empty tree has no nodes on any path, so its height is 0. A leaf then gets 1 + max(0, 0) = 1.' },
      { at: (t) => t.tag === 'go-left' && t.data.calls.filter((c) => c.fn === 'height').length === 2, once: true,
        ask: 'Which node will be the first to learn its own height? Click it.',
        answer: (ts) => { for (const t of ts) if (t.tag === 'compare') return 'n' + topCall(t, 'height').args.root; return null; },
        explain: () => 'The leftmost node with no left child that is a leaf: the calls go left as far as they can, and a leaf finishes as soon as its two empty subtrees answer 0.' },
    ],
    quiz: [
      { q: 'With this code, what is the height of a tree with a single node?', options: ['0', '1', '2', 'Undefined'], answer: 1, why: 'Both children are empty and return 0, so the node returns 1 + 0 = 1. (Some books count edges instead and get 0.)' },
      { q: 'In which order do the nodes find out their heights?', options: ['Root first, then down', 'Level by level', 'Children before parents (postorder)', 'In key order'], answer: 2, why: 'A node needs both answers before it can compute its own, so every node finishes after its subtrees: postorder.' },
      { q: 'How many calls does height make on a tree of n nodes?', options: ['n', 'n + 1', '2n + 1', 'log n'], answer: 2, why: 'One per node and one per empty subtree. A tree of n nodes has n + 1 empty subtrees, so 2n + 1 calls in all.' },
      { q: 'How deep does the call stack get?', options: ['Always log n', 'The height of the tree, plus one for an empty subtree', 'n always', 'Two calls'], answer: 1, why: 'Only the calls on one root-to-leaf path wait at the same time. A chain of n nodes makes the stack n deep.' },
    ],
  });

  // ---- size --------------------------------------------------------------------------------------------------
  X.topic({
    id: 'bt-size', family: 'btprop', order: 11, title: 'Size (count the nodes)',
    blurb: 'Every subtree is counted by its own call. The box around the subtree being counted shrinks as the calls go down, and each finished box reports its count to the box around it.',
    code: `/* the number of nodes in the tree */
int size(struct node *root)
{
    int left, right;
    if (root == NULL)                 /*@ test */
        return 0;                     /*@ base */
    left = size(root->left);          /*@ go-left */
    right = size(root->right);        /*@ go-right */
    return left + 1 + right;          /*@ ret */
}`,
    animate: ['size'], quiet: ['new_node'],
    inputs: [B.levelInput('tree', null, [1, 2, 3, 4, 5, 6, -1, -1, 7, -1, -1, 8])],
    presets: [
      { label: 'Mixed tree', values: { tree: [1, 2, 3, 4, 5, 6, -1, -1, 7, -1, -1, 8] } },
      { label: 'Full tree', values: { tree: [4, 2, 6, 1, 3, 5, 7] } },
      { label: 'A chain to the right', values: { tree: [1, -1, 2, -1, 3, -1, 4] } },
      { label: 'One node', values: { tree: [9] } },
      { label: 'Empty tree', values: { tree: [] } },
    ],
    counters: [],
    main: (inp) => B.main(inp.tree, 'printf("size = %d\\n", size(tree));'),
    capture: B.capture(['left', 'right']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo;
      const { fr, top, ret, key } = B.step(ctx, 'size', 'root', ['go-left'], ['go-right'], (tg, f) => (tg === 'base' ? 0 : tg === 'ret' ? f.vars.left + 1 + f.vars.right : undefined), ['base', 'ret']);
      memo.n = memo.n || {};
      if (ret && ret.f.node) memo.n[ret.f.node] = ret.v;
      const path = B.pathSet(fr);
      const pic = T.picture(ctx, d, {
        rootName: 'tree',
        nodeCls: (n) => 'bp-lab ' + (top && n.addr === top.node ? 'focus' : memo.n[n.addr] !== undefined ? 'done' : path.has(n.addr) ? 'part-b' : ''),
        label: (n) => (memo.n[n.addr] !== undefined ? 'size ' + memo.n[n.addr] : ''),
      });
      const items = pic.items, pos = pic.pos;
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      const boxText = (k, b, text, cls) => [
        { key: k, kind: 'region', x: b.x, y: b.y, w: b.w, h: b.h, cls },
        { key: k + 't', kind: 'text', x: b.x + 4, y: b.y + b.h + 18, text, cls: cls === 'bp-sub-done' ? 'bp-good' : 'bp-hot' },
      ];
      if (ret && ret.f.node) {
        // the finished subtree, with its count made of three parts
        const b = B.box(d, pos, ret.f.node);
        if (b) items.push(...boxText('subdone', b, ret.f.vars.left + ' + 1 + ' + ret.f.vars.right + ' = ' + ret.v + ' node' + (ret.v === 1 ? '' : 's'), 'bp-sub-done'));
      } else if (top && top.node) {
        const b = B.box(d, pos, top.node);
        if (b) items.push(...boxText('subtop', b, 'size(' + key(top.node) + ') counts this', 'bp-sub'));
      }
      if (top && !top.node) items.push(...B.nullSpot(pos, top, 'hot'));
      if (ret && !ret.f.node) items.push(...B.nullSpot(pos, ret.f, ''));
      if (ret) {
        const from = B.spot(pos, ret.f), to = top ? B.spot(pos, top) : { x: from.x, y: from.y - 40 };
        items.push(B.flyUp('ret' + ctx.i, from, to, ret.v, 'c-green', ret.f.side === 'left' ? -30 : ret.f.side === 'right' ? 30 : 0));
      }
      items.push(...B.stack(fr, (f) => [
        { text: 'size(' + key(f.node) + ')', w: 2 },
        { text: f.node ? 'left ' + (f.vars.left === undefined ? '?' : f.vars.left) : '', w: 1.3, cls: 'link' },
        { text: f.node ? 'right ' + (f.vars.right === undefined ? '?' : f.vars.right) : '', w: 1.3, cls: 'link' },
      ], { w: 270, x: -350 }));
      const k = top ? key(top.node) : '', pk = top && top.parent ? key(top.parent) : '';
      const below = fr.length > 1 ? fr[fr.length - 2] : null;
      const sub = (a) => { let c = 0; const go = (x) => { if (!x || !by.has(x)) return; c++; go(by.get(x).links.left); go(by.get(x).links.right); }; go(a); return c; };
      let say = '';
      switch (tag) {
        case 'enter': say = top && top.node ? 'size(tree) must count all the nodes under ' + k + '. It will not count them itself: it asks each subtree for its count.' : 'size(tree) on an empty tree.'; break;
        case 'test': say = top.node ? 'Node ' + k + ': its box holds ' + sub(top.node) + ' node' + (sub(top.node) === 1 ? '' : 's') + ', but the call does not know that yet.' : 'An empty subtree' + (top.parent ? ' (the ' + top.side + ' of ' + pk + ')' : '') + ' has no nodes to count.'; break;
        case 'base': say = 'It answers 0.'; break;
        case 'go-left': say = 'size(' + pk + ') first asks its left subtree' + (top.node ? ', the box around ' + k + '.' : ', which is empty.'); break;
        case 'go-right': say = 'The left side of ' + pk + ' has ' + (below ? below.vars.left : 0) + ' node' + (below && below.vars.left === 1 ? '' : 's') + '. Now the right subtree' + (top.node ? ', the box around ' + k + '.' : ', which is empty.'); break;
        case 'ret': say = ret ? 'size(' + key(ret.f.node) + ') = left + 1 + right = ' + ret.f.vars.left + ' + 1 + ' + ret.f.vars.right + ' = ' + ret.v + '. The + 1 counts node ' + key(ret.f.node) + ' itself.' + (top ? ' The count goes up to ' + key(top.node) + '.' : '') : ''; break;
        case 'after': say = d.root ? 'The tree has ' + memo.n[d.root] + ' nodes. Each call counted only one node, its own; all the rest came from adding up the answers.' : 'An empty tree has size 0.'; break;
      }
      return { items, say, calls: B.callsTab(d, 'size', ['root']), slow: !!ret && !!ret.f.node };
    },
    predict: [
      { at: (t) => t.tag === 'go-right' && topCall(t, 'size') && topCall(t, 'size').args.root && t.data.calls.filter((c) => c.fn === 'size').length === 2, once: true,
        ask: 'The root\'s left subtree has been counted. What will size() of the right subtree return?', options: () => ['0', '1', '2', '3', '4', '5', '6', '7'], pick: 'option',
        answer: (ts, i) => { const d = ts[i].data, by = new Map(d.nodes.map((n) => [n.addr, n])); let c = 0; const go = (x) => { if (!x || !by.has(x)) return; c++; go(by.get(x).links.left); go(by.get(x).links.right); }; go(topCall(ts[i], 'size').args.root); return String(c); },
        explain: () => 'Count the nodes inside the box: that is exactly what the call will add up.' },
      { at: (t) => t.tag === 'ret' && t.data.calls.filter((c) => c.fn === 'size').length === 0, once: true,
        ask: 'The last return is the root\'s. Why is there a "+ 1" in left + 1 + right?', options: () => ['For the root of this call', 'For the NULL at the end', 'To count from 1, not 0'], pick: 'option', answer: () => 'For the root of this call',
        explain: () => 'Each call counts exactly one node, its own root. The subtrees count the rest.' },
    ],
    quiz: [
      { q: 'What does size() return for a leaf?', options: ['0', '1', '2', 'It depends on the key'], answer: 1, why: 'Both subtrees are empty and return 0, so 0 + 1 + 0 = 1.' },
      { q: 'Which change would make the function count only the empty subtrees?', options: ['return 1 for NULL and left + right otherwise', 'return 0 for NULL and left + right otherwise', 'return left * right', 'It cannot be done'], answer: 0, why: 'Each empty subtree then counts 1 and nodes add nothing. The answer is always size + 1.' },
      { q: 'How long does size() take on a tree of n nodes?', options: ['O(log n)', 'O(n)', 'O(n log n)', 'O(n²)'], answer: 1, why: 'Every node and every empty subtree is visited once, and each call does a constant amount of work.' },
      { q: 'Could size() visit the nodes in a different order and still be right?', options: ['Yes, any order works, addition does not care', 'No, it must be postorder'], answer: 0, why: 'The count is a sum. Preorder, inorder or a queue all give the same total; this version happens to add after both calls.' },
    ],
  });

  // ---- leaves ------------------------------------------------------------------------------------------------
  X.topic({
    id: 'bt-leaves', family: 'btprop', order: 12, title: 'Count the leaves',
    blurb: 'A leaf is a node with no children. Each call checks its node\'s two child pointers; every leaf found drops into the tray, in the order the recursion meets them.',
    code: `/* the number of leaves: nodes with no children */
int leaves(struct node *root)
{
    int left, right;
    if (root == NULL)                                   /*@ test */
        return 0;                                       /*@ base */
    if (root->left == NULL && root->right == NULL)      /*@ is-leaf */
        return 1;                                       /*@ leaf */
    left = leaves(root->left);                          /*@ go-left */
    right = leaves(root->right);                        /*@ go-right */
    return left + right;                                /*@ ret */
}`,
    animate: ['leaves'], quiet: ['new_node'],
    inputs: [B.levelInput('tree', null, [10, 5, 15, 3, 7, -1, 20, -1, -1, 6])],
    presets: [
      { label: 'Some one-child nodes', values: { tree: [10, 5, 15, 3, 7, -1, 20, -1, -1, 6] } },
      { label: 'Full tree', values: { tree: [4, 2, 6, 1, 3, 5, 7] } },
      { label: 'A zigzag chain', values: { tree: [1, 2, -1, -1, 3, 4] } },
      { label: 'One node', values: { tree: [9] } },
      { label: 'Empty tree', values: { tree: [] } },
    ],
    counters: ['compares'],
    main: (inp) => B.main(inp.tree, 'printf("leaves = %d\\n", leaves(tree));'),
    capture: B.capture(['left', 'right']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo;
      const { fr, top, ret, key } = B.step(ctx, 'leaves', 'root', ['go-left'], ['go-right'], (tg, f) => (tg === 'base' ? 0 : tg === 'leaf' ? 1 : tg === 'ret' ? f.vars.left + f.vars.right : undefined), ['base', 'leaf', 'ret']);
      memo.found = memo.found || [];
      memo.cnt = memo.cnt || {};
      if (ret && ret.f.node) memo.cnt[ret.f.node] = ret.v;
      if (tag === 'leaf' && ret && ret.f.node && !memo.found.includes(ret.f.node)) memo.found.push(ret.f.node);
      const found = new Set(memo.found);
      const path = B.pathSet(fr);
      const testing = tag === 'is-leaf' && top ? top.node : 0;
      const pic = T.picture(ctx, d, {
        rootName: 'tree',
        nodeCls: (n) => 'bp-lab ' + (found.has(n.addr) ? 'bp-leaf' : top && n.addr === top.node ? 'focus' : path.has(n.addr) ? 'part-b' : ''),
        edgeCls: (n) => (n.addr === testing ? 'hot' : ''),
        label: (n) => (memo.cnt[n.addr] !== undefined && !found.has(n.addr) ? memo.cnt[n.addr] + ' below' : ''),
      });
      const items = pic.items, pos = pic.pos;
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      if (testing) {
        // the two child pointers being tested: empty ones as dashed circles
        for (const side of ['left', 'right']) if (!by.get(testing).links[side]) items.push(...B.nullSpot(pos, { node: 0, parent: testing, side }, 'hot'));
      }
      if (top && !top.node) items.push(...B.nullSpot(pos, top, 'hot'));
      if (ret && !ret.f.node) items.push(...B.nullSpot(pos, ret.f, ''));
      if (ret && top) {
        const from = B.spot(pos, ret.f), to = B.spot(pos, top);
        items.push(B.flyUp('ret' + ctx.i, from, to, ret.v, 'c-green', ret.f.side === 'left' ? -30 : 30));
      }
      // the tray: leaves in the order they were found
      const maxY = Math.max(0, ...[...pos.values()].map((p) => p.y));
      const ty = maxY + 110;
      const xs = [...pos.values()].map((p) => p.x);
      const x0 = xs.length ? Math.min(...xs) : 0;
      items.push({ key: 'tray', kind: 'region', x: x0 - 30, y: ty - 34, w: Math.max(260, memo.found.length * 58 + 30), h: 70, cls: 'bp-tray' });
      items.push({ key: 'trayt', kind: 'text', x: x0 - 30, y: ty - 44, text: 'leaves found: ' + memo.found.length, cls: 'bp-title' });
      memo.found.forEach((a, j) => {
        const p = pos.get(a) || { x: 0, y: 0 };
        items.push({ key: 'tr' + a, kind: 'cell', x: x0 - 16 + j * 58, y: ty - 24, w: 48, h: 48, text: key(a), sub: '', cls: 'done', enter: 'fly', from: { x: p.x - 24, y: p.y - 24 } });
      });
      items.push(...B.stack(fr, (f) => [
        { text: 'leaves(' + key(f.node) + ')', w: 2.2 },
        { text: f.node ? 'left ' + (f.vars.left === undefined ? '?' : f.vars.left) : '', w: 1.3, cls: 'link' },
        { text: f.node ? 'right ' + (f.vars.right === undefined ? '?' : f.vars.right) : '', w: 1.3, cls: 'link' },
      ], { w: 280, x: -360 }));
      const k = top ? key(top.node) : '', pk = top && top.parent ? key(top.parent) : '';
      const tn = top && top.node ? by.get(top.node) : null;
      let say = '';
      switch (tag) {
        case 'enter': say = top && top.node ? 'leaves(tree) starts at ' + k + '. A leaf is easy to spot: both of its child pointers are NULL.' : 'leaves(tree) on an empty tree.'; break;
        case 'test': say = top.node ? 'Node ' + k + ' exists.' : 'An empty subtree' + (top.parent ? ' (the ' + top.side + ' of ' + pk + '). It happens because ' + pk + ' has only one child.' : '.') + ' No node, so no leaf.'; break;
        case 'base': say = 'It answers 0.'; break;
        case 'is-leaf': {
          const has = ['left', 'right'].filter((s) => tn && tn.links[s]);
          say = !has.length ? 'Both pointers of ' + k + ' are NULL: ' + k + ' is a leaf.' : k + ' has a ' + has.join(' and a ') + ' child, so it is not a leaf. The leaves are somewhere below it.';
          break;
        }
        case 'leaf': say = 'Leaf ' + (ret ? key(ret.f.node) : '') + ' answers 1 and drops into the tray. Its call ends without looking at its empty children.'; break;
        case 'go-left': say = 'leaves(' + pk + ') asks its left subtree' + (top.node ? ', starting at ' + k + '.' : ', which is empty.'); break;
        case 'go-right': say = 'The left of ' + pk + ' held ' + (fr.length > 1 ? fr[fr.length - 2].vars.left : 0) + ' lea' + (fr.length > 1 && fr[fr.length - 2].vars.left === 1 ? 'f' : 'ves') + '. Now the right subtree' + (top.node ? ', starting at ' + k + '.' : ', which is empty.'); break;
        case 'ret': say = ret ? key(ret.f.node) + ' passes up ' + ret.f.vars.left + ' + ' + ret.f.vars.right + ' = ' + ret.v + '. An inner node adds nothing of its own.' : ''; break;
        case 'after': say = d.root ? memo.found.length + ' lea' + (memo.found.length === 1 ? 'f' : 'ves') + ': ' + memo.found.map(key).join(', ') + '. They were found left to right, because every call looks left before right.' : 'An empty tree has no leaves.'; break;
      }
      return { items, say, calls: B.callsTab(d, 'leaves', ['root']), slow: tag === 'leaf' };
    },
    predict: [
      { at: (t) => t.tag === 'is-leaf', once: true, ask: 'Click the first leaf that will drop into the tray.',
        answer: (ts) => { for (let j = 1; j < ts.length; j++) if (ts[j].tag === 'leaf') return 'n' + topCall(ts[j - 1], 'leaves').args.root; return null; },
        explain: () => 'The leftmost leaf: every call tries its left subtree first.' },
      { at: (t) => t.tag === 'test' && topCall(t, 'leaves') && !topCall(t, 'leaves').args.root, once: true,
        ask: 'A call with NULL. Which kind of node made it?', options: () => ['A leaf', 'A node with exactly one child', 'A node with two children'], pick: 'option', answer: () => 'A node with exactly one child',
        explain: () => 'A leaf returns 1 before recursing, and a node with two children never passes NULL. Only a one-child node calls on its empty side.' },
    ],
    quiz: [
      { q: 'What makes a node a leaf?', options: ['It is at the bottom level', 'Its left and right pointers are both NULL', 'Its key is the smallest', 'It has one child'], answer: 1, why: 'A leaf has no children at all. Leaves can sit at different depths.' },
      { q: 'If the leaf test were removed (keep only the NULL test and left + right), what would leaves() return?', options: ['The same', 'Always 0', 'The number of nodes', 'It would crash'], answer: 1, why: 'Nothing would ever add a 1: every call would return the sum of two zeros eventually.' },
      { q: 'A tree where every node has 0 or 2 children has 6 inner nodes. How many leaves?', options: ['5', '6', '7', '12'], answer: 2, why: 'In a full binary tree, leaves = inner nodes + 1.' },
      { q: 'Why is the NULL test still needed when leaves are caught first?', options: ['For an empty tree and for nodes with one child', 'It is not needed', 'For leaves'], answer: 0, why: 'A node with one child calls the function on its empty side, and the whole tree may be empty.' },
    ],
  });

  // ---- diameter ----------------------------------------------------------------------------------------------
  X.topic({
    id: 'bt-diameter', family: 'btprop', order: 20, title: 'Diameter (longest path)',
    blurb: 'The longest path between any two nodes bends at exactly one node: down the deepest branch on its left and down the deepest branch on its right. Every node gets a turn to be that bend.',
    code: `/* returns the height of the tree; *best keeps the longest path seen
   so far, counted in edges */
int diameter(struct node *root, int *best)
{
    int lh, rh;
    if (root == NULL)                     /*@ test */
        return 0;                         /*@ base */
    lh = diameter(root->left, best);      /*@ go-left */
    rh = diameter(root->right, best);     /*@ go-right */
    if (lh + rh > *best)                  /*@ compare */
        *best = lh + rh;                  /*@ record */
    return 1 + (lh > rh ? lh : rh);       /*@ ret */
}`,
    animate: ['diameter'], quiet: ['new_node'],
    inputs: [B.levelInput('tree', null, [1, 2, 3, 4, 5, -1, -1, 6, -1, -1, 7, 8, -1, -1, 9])],
    presets: [
      { label: 'Longest path misses the root', values: { tree: [1, 2, 3, 4, 5, -1, -1, 6, -1, -1, 7, 8, -1, -1, 9] } },
      { label: 'Through the root', values: { tree: [8, 3, 10, 1, 6, -1, 14, -1, -1, 4, 7, 13] } },
      { label: 'A chain', values: { tree: [1, 2, -1, 3, -1, 4] } },
      { label: 'Full tree', values: { tree: [4, 2, 6, 1, 3, 5, 7] } },
      { label: 'One node', values: { tree: [9] } },
    ],
    counters: ['compares'],
    main: (inp) => B.main(inp.tree, 'diameter(tree, &best);\n    printf("diameter = %d edges\\n", best);', 'int best = 0;'),
    capture: B.capture(['lh', 'rh'], (P) => { const fi = P.frames.findIndex((f) => f.name === 'main'); return { best: fi >= 0 && P.isSet('best', fi) ? P.val('best', fi) : 0 }; }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo;
      const { fr, top, ret, key } = B.step(ctx, 'diameter', 'root', ['go-left'], ['go-right'], (tg, f) => (tg === 'base' ? 0 : tg === 'ret' ? 1 + Math.max(f.vars.lh, f.vars.rh) : undefined), ['base', 'ret']);
      memo.h = memo.h || {};
      if (ret && ret.f.node) memo.h[ret.f.node] = ret.v;
      const hts = T.heights(d);
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      // the path that bends at a node: deepest branch left, the node, deepest branch right
      const bendPath = (a) => { const n = by.get(a); return B.deepest(d, n.links.left, hts).reverse().concat([a], B.deepest(d, n.links.right, hts)); };
      if (tag === 'record' && top) memo.best = bendPath(top.node);
      const cand = (tag === 'compare' || tag === 'record') && top ? bendPath(top.node) : [];
      const best = memo.best || [];
      const path = B.pathSet(fr);
      const pic = T.picture(ctx, d, {
        rootName: 'tree',
        nodeCls: (n) => 'bp-lab ' + (top && n.addr === top.node ? 'focus' : path.has(n.addr) ? 'part-b' : memo.h[n.addr] !== undefined ? 'part-a' : ''),
        label: (n) => (memo.h[n.addr] !== undefined ? 'h = ' + memo.h[n.addr] : ''),
      });
      const items = pic.items, pos = pic.pos;
      items.push(...B.glow(pos, best, 'bp-green', 'b'), ...B.glow(pos, cand, tag === 'record' ? 'bp-green' : 'bp-amber', 'c'));
      if (top && !top.node) items.push(...B.nullSpot(pos, top, 'hot'));
      if (ret && !ret.f.node) items.push(...B.nullSpot(pos, ret.f, ''));
      if (ret && top) items.push(B.flyUp('ret' + ctx.i, B.spot(pos, ret.f), B.spot(pos, top), ret.v, 'c-amber', ret.f.side === 'left' ? -30 : 30));
      if (cand.length && top) {
        const p = pos.get(top.node);
        const s = top.vars.lh + top.vars.rh;
        items.push({ key: 'cmp', kind: 'text', x: p.x + 34, y: p.y - 30, text: 'bend here: ' + top.vars.lh + ' + ' + top.vars.rh + ' = ' + s + ' edges', cls: tag === 'record' ? 'bp-good' : 'bp-hot' });
      }
      const xs = [...pos.values()].map((p) => p.x);
      const bx = xs.length ? Math.max(...xs) + 70 : 100;
      items.push({ key: 'bestbox', kind: 'node', x: bx, y: -110, w: 90, h: 36, cells: [{ text: d.extra.best, cls: tag === 'record' ? 'hot' : '' }], label: 'best', cls: 'root c-teal' });
      items.push(...B.stack(fr, (f) => [
        { text: 'diameter(' + key(f.node) + ')', w: 2.5 },
        { text: f.node ? 'lh ' + (f.vars.lh === undefined ? '?' : f.vars.lh) : '', w: 1, cls: 'link' },
        { text: f.node ? 'rh ' + (f.vars.rh === undefined ? '?' : f.vars.rh) : '', w: 1, cls: 'link' },
      ], { w: 290, x: -370 }));
      const k = top ? key(top.node) : '', pk = top && top.parent ? key(top.parent) : '';
      let say = '';
      switch (tag) {
        case 'enter': say = 'diameter(tree, &best): each call returns a height, as before, and on the side checks one candidate path: the one that bends at its own node.'; break;
        case 'test': say = top.node ? 'Node ' + k + '.' : 'An empty subtree' + (top.parent ? ' under ' + pk : '') + ': height 0, and no path at all.'; break;
        case 'base': say = 'It returns height 0.'; break;
        case 'go-left': say = top.node ? pk + ' needs the height of its left subtree, at ' + k + '.' : pk + ' has no left child; its left height will be 0.'; break;
        case 'go-right': say = top.node ? 'Now the height of the right subtree of ' + pk + ', at ' + k + '.' : pk + ' has no right child; its right height will be 0.'; break;
        case 'compare': say = 'The longest path that bends at ' + k + ' goes ' + top.vars.lh + ' edge' + (top.vars.lh === 1 ? '' : 's') + ' down the left and ' + top.vars.rh + ' down the right: ' + (top.vars.lh + top.vars.rh) + ' in all. ' + (top.vars.lh + top.vars.rh > d.extra.best ? 'That beats the best so far, ' + d.extra.best + '.' : 'Not longer than the best so far, ' + d.extra.best + '.'); break;
        case 'record': say = 'New best: ' + d.extra.best + ' edges, the path drawn in green.'; break;
        case 'ret': say = ret ? key(ret.f.node) + ' returns its height, 1 + max(' + ret.f.vars.lh + ', ' + ret.f.vars.rh + ') = ' + ret.v + '. The parent needs the height, not the path.' : ''; break;
        case 'after': {
          const b = memo.best || [];
          const misses = d.root && b.length && !b.includes(d.root);
          say = 'The diameter is ' + d.extra.best + ' edge' + (d.extra.best === 1 ? '' : 's') + (b.length > 1 ? ': ' + b.map(key).join(' - ') + '.' : '.') + (misses ? ' It does not pass through the root, which is why every node had to be tried as the bend.' : '');
          break;
        }
      }
      return { items, say, calls: B.callsTab(d, 'diameter', ['root', 'best']), slow: tag === 'record' };
    },
    predict: [
      { at: (t) => t.tag === 'compare' && t.data.calls.filter((c) => c.fn === 'diameter').length <= 2, once: true,
        ask: (t) => { const c = topCall(t, 'diameter'); return 'lh = ' + c.args.lh + ', rh = ' + c.args.rh + ', best = ' + t.data.extra.best + '. Will best change?'; },
        options: () => ['Yes', 'No'], pick: 'option',
        answer: (ts, i) => { const c = topCall(ts[i], 'diameter'); return c.args.lh + c.args.rh > ts[i].data.extra.best ? 'Yes' : 'No'; },
        explain: () => 'best changes only when lh + rh, the path bending here, is strictly longer.' },
      { at: (t, i, ts) => i === 0 && ts.length > 10, once: true, ask: 'Click the node where the longest path will bend.',
        answer: (ts) => { let a = null; for (const t of ts) if (t.tag === 'record') a = topCall(t, 'diameter').args.root; return a ? 'n' + a : null; },
        explain: () => 'The bend is the node whose left height plus right height is largest. It need not be the root.' },
    ],
    quiz: [
      { q: 'Why is the diameter not simply height(left) + height(right) of the root?', options: ['It is always that', 'The longest path may bend at a node below the root', 'Because of empty subtrees', 'Because heights count nodes'], answer: 1, why: 'If one side of the root is short, the longest path can lie entirely inside the other subtree.' },
      { q: 'What does each call return to its parent?', options: ['Its diameter', 'Its height', 'The best path', 'Its key'], answer: 1, why: 'The parent needs the height to build its own candidate; the best path is kept on the side in *best.' },
      { q: 'Why is best passed as a pointer?', options: ['To save memory', 'So every call updates the one variable in main', 'C cannot return ints', 'To make it faster'], answer: 1, why: 'A copy would be lost when the call ends. Through the pointer all calls share one best.' },
      { q: 'How long does this take for n nodes?', options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], answer: 0, why: 'One visit per node. Calling a separate height() at every node would be O(n²) on a chain.' },
    ],
  });
})(SEE);
