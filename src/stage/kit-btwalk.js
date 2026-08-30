// Drawing helpers for the binary-tree traversal topics (family 'bt'): the tree read from main's root,
// a layout that never changes during a run, the points around a node where an Euler-tour walk passes
// (left side, below, right side), empty-child spots, an output strip, and a column of stack cells.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const B = X.BtWalk = {};
  B.R = 22;
  B.SIDE = 40;        // how far the walk passes from a node's centre

  /** Read the tree from main's root, plus named variables and arrays of the newest frame */
  B.capture = (opts) => (P) => {
    opts = opts || {};
    const fr = P.frames;
    const mi = fr.findIndex((f) => f.name === 'main');
    const root = mi >= 0 && P.isSet('root', mi) ? P.val('root', mi) : 0;
    const t = P.pointee('root');
    const nodes = [];
    if (t && root) {
      const w = P.walk([root], t, ['left', 'right'], 40);
      for (const a of w.order) {
        const n = w.nodes.get(a);
        nodes.push({ addr: a, key: n.key, links: { left: n.links.left || 0, right: n.links.right || 0 } });
      }
    }
    const v = (n) => (P.has(n, 0) && P.isSet(n, 0) ? P.val(n, 0) : null);
    const out = { root, nodes, calls: P.calls(), vars: {}, arrs: {} };
    for (const n of opts.vars || []) out.vars[n] = v(n);
    for (const [name, len] of opts.arrs || []) {
      const k = typeof len === 'function' ? len(out.vars) : len;
      out.arrs[name] = P.has(name, 0) && k > 0 ? P.arr(name, k, 0) || [] : [];
    }
    return out;
  };

  /** Positions of the tree as it was when the run started (in-order rank across, depth down) */
  B.geometry = function (ctx) {
    const m = ctx.memo;
    if (m.btGeo) return m.btGeo;
    const d0 = ctx.ticks[0].data;
    const pos = X.TreeKit.layout({ nodes: d0.nodes, root: d0.root }, { dx: 64, dy: 92 });
    const by = new Map(d0.nodes.map((n) => [n.addr, n]));
    const depth = new Map();
    const parent = new Map();
    const order = [];   // in-order
    const walk = (a, dp) => {
      if (!a || !by.has(a) || depth.has(a)) return;
      depth.set(a, dp);
      const n = by.get(a);
      if (n.links.left) parent.set(n.links.left, a);
      walk(n.links.left, dp + 1);
      order.push(a);
      if (n.links.right) parent.set(n.links.right, a);
      walk(n.links.right, dp + 1);
    };
    walk(d0.root, 0);
    const xs = [...pos.values()].map((p) => p.x), ys = [...pos.values()].map((p) => p.y);
    m.btGeo = {
      pos, by, depth, parent, inorder: order, root: d0.root, n: d0.nodes.length,
      minX: xs.length ? Math.min(...xs) : 0, maxX: xs.length ? Math.max(...xs) : 0, maxY: ys.length ? Math.max(...ys) : 0,
      height: depth.size ? Math.max(...depth.values()) + 1 : 0,
    };
    return m.btGeo;
  };

  B.key = (geo, a) => (a && geo.by.has(a) ? geo.by.get(a).key : 'NULL');
  B.point = function (geo, a, phase) {
    const p = geo.pos.get(a);
    if (!p) return { x: 0, y: 0 };
    if (phase === 'pre') return { x: p.x - B.SIDE, y: p.y };
    if (phase === 'in') return { x: p.x, y: p.y + B.SIDE };
    return { x: p.x + B.SIDE, y: p.y };
  };
  /** A point beside the edge from a to its child c: on the outer side ('down') or the inner side ('up') */
  B.beside = function (geo, a, c, way) {
    const p = geo.pos.get(a), q = geo.pos.get(c);
    if (!p || !q) return { x: 0, y: 0 };
    const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
    const s = way === 'up' ? 1 : -1;
    return { x: (p.x + q.x) / 2 + s * dy / l * 24, y: (p.y + q.y) / 2 - s * dx / l * 24 };
  };
  /** Where an empty child of node a would be */
  B.nullSpot = function (geo, a, side) {
    const p = geo.pos.get(a);
    if (!p) return { x: 0, y: 0 };
    return { x: p.x + (side === 'left' ? -26 : 26), y: p.y + 62 };
  };

  /** The tree: circles and child arrows. opts: {cls(a), sub(a), edgeCls(a, side), links(a) -> current links} */
  B.tree = function (geo, opts) {
    opts = opts || {};
    const items = [];
    for (const [a, n] of geo.by) {
      const p = geo.pos.get(a);
      if (!p) continue;
      items.push({ key: 'n' + a, kind: 'vertex', x: p.x, y: p.y, r: B.R, text: n.key, sub: opts.sub ? opts.sub(a) || '' : '', cls: opts.cls ? opts.cls(a) || '' : '', pick: true, title: 'node ' + n.key });
      for (const side of ['left', 'right']) {
        const c = n.links[side];
        if (!c || !geo.pos.has(c)) continue;
        items.push({ key: 'e' + a + side, kind: 'arrow', from: { key: 'n' + a }, to: { key: 'n' + c }, cls: 'tree-edge' + (opts.edgeCls ? ' ' + (opts.edgeCls(a, side) || '') : '') });
      }
    }
    return items;
  };

  /** Faint rings where each empty child is; the one named in `on` ({a, side}) is lit */
  B.nullSpots = function (geo, on) {
    const items = [];
    for (const [a, n] of geo.by) {
      for (const side of ['left', 'right']) {
        if (n.links[side]) continue;
        const s = B.nullSpot(geo, a, side);
        const lit = on && on.a === a && on.side === side;
        items.push({ key: 'z' + a + side, kind: 'ring', x: s.x, y: s.y, r: lit ? 10 : 6, cls: 'bt-null' + (lit ? ' bt-null-on' : '') });
        if (lit) items.push({ key: 'zt', kind: 'text', x: s.x, y: s.y + 26, text: 'NULL', cls: 'bt-nulltext', anchor: 'middle' });
      }
    }
    return items;
  };

  /**
   * The output strip under the tree. printed: [addr]. aligned: each key under its own node (in-order);
   * otherwise one after another. prefix: key prefix (share it with other places a node's card goes, so the
   * card slides from there).
   */
  B.output = function (geo, printed, opts) {
    opts = opts || {};
    const items = [];
    const y = opts.y !== undefined ? opts.y : geo.maxY + 118;
    const w = 40, pre = opts.prefix || 'o';
    const x0 = geo.minX - 20;
    items.push({ key: 'outT', kind: 'text', x: x0 - 14, y: y + 26, text: opts.title || 'printed', cls: 'bt-label', anchor: 'end' });
    const slotX = (k, a) => (opts.aligned ? geo.pos.get(a).x - w / 2 : x0 + k * (w + 6));
    if (opts.aligned) geo.inorder.forEach((a, k) => items.push({ key: 'os' + k, kind: 'region', x: slotX(k, a) - 2, y: y - 2, w: w + 4, h: w + 4, cls: 'bt-slot' }));
    else for (let k = 0; k < geo.n; k++) items.push({ key: 'os' + k, kind: 'region', x: slotX(k) - 2, y: y - 2, w: w + 4, h: w + 4, cls: 'bt-slot' });
    printed.forEach((a, k) => {
      const p = geo.pos.get(a);
      items.push({ key: pre + a, kind: 'cell', x: slotX(k, a), y, w, h: w, text: B.key(geo, a), sub: opts.aligned ? '' : String(k + 1), cls: (opts.cls ? opts.cls(a, k) || '' : 'bt-out'), enter: 'fly', from: p ? { x: p.x - w / 2, y: p.y - w / 2 } : null });
    });
    return items;
  };

  /**
   * A vertical stack of node cards, bottom (index 0) to top. Returns items; opts: {x, yBase, title, prefix,
   * cls(a, k), topName}
   */
  B.stack = function (geo, addrs, opts) {
    opts = opts || {};
    const items = [];
    const w = 44, gap = 6, x = opts.x, yb = opts.yBase;
    const pre = opts.prefix || 'k';
    items.push({ key: (opts.id || 'st') + 'base', kind: 'line', x1: x - 8, y1: yb + w + 4, x2: x + w + 8, y2: yb + w + 4, cls: 'bt-floor' });
    items.push({ key: (opts.id || 'st') + 'T', kind: 'text', x: x + w / 2, y: yb + w + 26, text: opts.title || 'stack', cls: 'bt-label', anchor: 'middle' });
    if (!addrs.length) items.push({ key: (opts.id || 'st') + 'E', kind: 'text', x: x + w / 2, y: yb + w / 2 + 5, text: 'empty', cls: 'bt-muted', anchor: 'middle' });
    addrs.forEach((a, k) => {
      const p = geo.pos.get(a);
      items.push({ key: pre + a, kind: 'cell', x, y: yb - k * (w + gap), w, h: w, text: B.key(geo, a), sub: '', cls: (opts.cls ? opts.cls(a, k) || '' : '') + ' bt-card', enter: 'fly', from: p ? { x: p.x - w / 2, y: p.y - w / 2 } : null });
    });
    if (addrs.length && opts.topName) items.push({ key: (opts.id || 'st') + 'top', kind: 'cursor', at: pre + addrs[addrs.length - 1], side: 'right', text: opts.topName, cls: 'c-indigo' });
    return items;
  };

  /** A held card: the node just taken off a stack or queue, waiting in a labelled slot */
  B.held = function (geo, a, opts) {
    const w = 44;
    const items = [{ key: (opts.id || 'h') + 'slot', kind: 'region', x: opts.x - 4, y: opts.y - 4, w: w + 8, h: w + 8, cls: 'bt-slot' },
      { key: (opts.id || 'h') + 'T', kind: 'text', x: opts.x + w / 2, y: opts.y - 12, text: opts.title || 'cur', cls: 'bt-label', anchor: 'middle' }];
    if (a) items.push({ key: (opts.prefix || 'k') + a, kind: 'cell', x: opts.x, y: opts.y, w, h: w, text: B.key(geo, a), sub: '', cls: 'hot bt-card' });
    return items;
  };

  /** Keys of a list of addresses, for narration */
  B.keys = (geo, list) => list.map((a) => B.key(geo, a)).join(', ');

  /** The level-order input: -1 is an empty place, every key needs a parent */
  B.checkTree = function (v) {
    if (v.some((x) => x !== -1 && (x < 0 || x > 99))) return 'Tree: keys from 0 to 99, and -1 for a missing node';
    for (let i = 1; i < v.length; i++) if (v[i] !== -1 && v[(i - 1) >> 1] === -1) return 'Tree: position ' + i + ' holds ' + v[i] + ', but its parent at position ' + ((i - 1) >> 1) + ' is -1 (no node)';
    return null;
  };
  /** Keys of the tree in each traversal order, worked out from the input (for predictions and checks) */
  B.orders = function (v) {
    const has = (i) => i < v.length && v[i] !== -1;
    const pre = [], ino = [], post = [], level = [];
    const rec = (i) => { if (!has(i)) return; pre.push(i); rec(2 * i + 1); ino.push(i); rec(2 * i + 2); post.push(i); };
    rec(0);
    for (let i = 0; i < v.length; i++) if (has(i)) level.push(i);
    return { pre, in: ino, post, level };
  };
})(SEE);
