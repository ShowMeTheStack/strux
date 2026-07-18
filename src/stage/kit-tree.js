// Drawing trees. Nodes are circles placed by their in-order position (x) and depth (y), so after a
// rotation every node glides to its new place and the tree stays readable. Child links are arrows,
// pointer variables are tags, and a node can carry a small label (its height, balance factor, colour).
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const T = X.TreeKit = {};
  T.DX = 64; T.DY = 92; T.R = 24;

  /**
   * Capture a pointer-based tree. opts: {type: a pointer name whose pointee is the node type,
   *   root: name of the root pointer (default 'root'), cursors: names, fields: ['key', ...], links: ['left','right'],
   *   extra(P)}
   */
  T.capture = function (P, opts) {
    let t = null;
    for (const n of [].concat(opts.type || [], opts.root || 'root', opts.cursors || [])) { t = P.pointee(n); if (t) break; }
    const out = { nodes: [], cursors: {}, root: null, roots: {} };
    if (opts.extra) out.extra = opts.extra(P);
    const rootName = opts.root || 'root';
    if (P.has(rootName)) out.root = P.isSet(rootName) ? P.val(rootName) : undefined;
    for (const r of opts.roots || []) if (P.has(r)) out.roots[r] = P.isSet(r) ? P.val(r) : undefined;
    for (const n of opts.cursors || []) if (P.has(n, opts.anyFrame ? undefined : 0)) out.cursors[n] = P.isSet(n, opts.anyFrame ? undefined : 0) ? P.val(n, opts.anyFrame ? undefined : 0) : undefined;
    if (!t) return out;
    const links = opts.links || ['left', 'right'];
    const starts = P.blocksOf(t);
    for (const p of Object.values(out.cursors).concat(Object.values(out.roots), [out.root])) if (p && !starts.includes(p) && P.freed(p)) starts.push(p);
    const w = P.walk(starts, t, links.concat(opts.alsoFollow || []), 400);
    for (const a of w.order) {
      const n = w.nodes.get(a);
      const node = { addr: a, freed: n.freed, links: {} };
      for (const l of links) node.links[l] = n.links[l] || 0;
      for (const f of opts.fields || ['key']) node[f] = n[f];
      out.nodes.push(node);
    }
    return out;
  };

  /**
   * Positions: x by in-order rank within the tree from `root`, y by depth. Nodes outside that tree
   * (just made, or cut off) sit on a shelf to the right. Returns Map(addr -> {x, y, depth})
   */
  T.layout = function (data, opts) {
    opts = opts || {};
    const by = new Map(data.nodes.map((n) => [n.addr, n]));
    const L = opts.left || 'left', R = opts.right || 'right';
    const pos = new Map();
    let rank = 0;
    const seen = new Set();
    const visit = (a, depth) => {
      if (!a || !by.has(a) || seen.has(a) || depth > 40) return;
      seen.add(a);
      const n = by.get(a);
      if (n.freed) return;
      visit(n.links[L], depth + 1);
      pos.set(a, { x: (opts.x0 || 0) + rank * (opts.dx || T.DX), y: (opts.y0 || 0) + depth * (opts.dy || T.DY), depth });
      rank++;
      visit(n.links[R], depth + 1);
    };
    const root = opts.root !== undefined ? opts.root : data.root;
    visit(root, 0);
    // others: their own small trees on the right (a node waiting to be linked in, or one cut off)
    const dx = opts.dx || T.DX, dy = opts.dy || T.DY;
    rank += 1;
    for (const n of data.nodes) {
      if (pos.has(n.addr)) continue;
      const isChild = data.nodes.some((m) => !m.freed && (m.links[L] === n.addr || m.links[R] === n.addr));
      if (n.freed) { pos.set(n.addr, { x: (opts.x0 || 0) + rank * dx, y: (opts.y0 || 0) + 2 * dy, depth: 2, off: true }); rank++; continue; }
      if (isChild) continue;
      visit(n.addr, 0);
      rank++;
    }
    for (const n of data.nodes) if (!pos.has(n.addr)) { pos.set(n.addr, { x: (opts.x0 || 0) + rank * dx, y: (opts.y0 || 0), depth: 0, off: true }); rank++; }
    return pos;
  };

  /**
   * The picture. opts: {label(n) -> text under/over the node, text(n) -> text in it (default key field),
   *   nodeCls(n), edgeCls(n, side), cursors, rootName, showNull: draw short stubs for empty children,
   *   pos (precomputed), written: Map(addr -> Set(field))}
   */
  T.picture = function (ctx, data, opts) {
    opts = opts || {};
    const pos = opts.pos || T.layout(data, opts);
    const items = [];
    const prev = ctx.prev && ctx.prev.data && ctx.prev.data.nodes ? new Map(ctx.prev.data.nodes.map((n) => [n.addr, n])) : null;
    const field = opts.field || 'key';
    for (const n of data.nodes) {
      const p = pos.get(n.addr);
      if (!p) continue;
      const isNew = prev && !prev.has(n.addr);
      const hot = opts.written && opts.written.get(n.addr);
      items.push({
        key: 'n' + n.addr, kind: 'vertex', x: p.x, y: p.y, r: opts.r || T.R, text: opts.text ? opts.text(n) : n[field],
        sub: opts.label ? opts.label(n) : '', subAbove: !!opts.labelAbove,
        cls: (n.freed ? 'bad ghost' : '') + (hot ? ' hot' : '') + (opts.nodeCls ? ' ' + (opts.nodeCls(n) || '') : ''),
        enter: isNew ? 'drop' : 'fade', exit: 'fall', pick: true, title: 'node at ' + X.hex(n.addr),
      });
      for (const side of opts.links || ['left', 'right']) {
        const c = n.links[side];
        if (!c) {
          if (opts.showNull) items.push({ key: 'z' + n.addr + side, kind: 'line', x1: p.x + (side === 'left' ? -10 : 10), y1: p.y + (opts.r || T.R) - 2, x2: p.x + (side === 'left' ? -22 : 22), y2: p.y + (opts.r || T.R) + 14, cls: 'dim' });
          continue;
        }
        if (!pos.has(c)) continue;
        const changed = prev && prev.has(n.addr) && prev.get(n.addr).links[side] !== c;
        items.push({ key: 'e' + n.addr + side, kind: 'arrow', from: { key: 'n' + n.addr }, to: { key: 'n' + c }, cls: 'tree-edge' + (changed ? ' hot' : '') + (opts.edgeCls ? ' ' + (opts.edgeCls(n, side) || '') : ''), noHead: !!opts.noHeads });
      }
    }
    // the root pointer: a box above the root with an arrow
    const rn = opts.rootName || 'root';
    if (data.root !== undefined && data.root !== null || data.root === 0) {
      const rp = data.root && pos.get(data.root);
      const x = rp ? rp.x - 35 : (opts.x0 || 0);
      const y = (opts.y0 || 0) - 92;
      const changed = ctx.prev && ctx.prev.data && ctx.prev.data.root !== data.root;
      items.push({ key: 'rootbox', kind: 'node', x, y, w: 70, h: 32, cells: [{ text: data.root ? '' : 'NULL', port: 'p', cls: 'link' + (data.root ? '' : ' null') + (changed ? ' hot' : '') }], label: rn, cls: 'root c-indigo' });
      if (rp) items.push({ key: 'rootarrow', kind: 'arrow', from: { key: 'rootbox', port: 'p' }, to: { key: 'n' + data.root }, cls: 'root-arrow c-indigo' + (changed ? ' hot' : '') });
    }
    const slots = new Map();
    for (const [c, v] of Object.entries(data.cursors)) {
      if (!v || !pos.has(v)) continue;
      const s = slots.get(v) || 0;
      slots.set(v, s + 1);
      items.push({ key: 'c' + c, kind: 'cursor', at: 'n' + v, side: opts.cursorSide || 'left', slot: s, text: c, cls: X.ListKit.cursorCls(c) });
    }
    return { items, pos };
  };

  /** Height of each node in a captured tree: Map(addr -> height), leaves 1, empty 0 */
  T.heights = function (data, L, R) {
    const by = new Map(data.nodes.map((n) => [n.addr, n]));
    const memo = new Map();
    const hgt = (a, d) => {
      if (!a || !by.has(a) || d > 60) return 0;
      if (memo.has(a)) return memo.get(a);
      const n = by.get(a);
      const v = 1 + Math.max(hgt(n.links[L || 'left'], d + 1), hgt(n.links[R || 'right'], d + 1));
      memo.set(a, v);
      return v;
    };
    for (const n of data.nodes) hgt(n.addr, 0);
    return memo;
  };

  /** Tree drawn from an array (heaps): index i at the in-order spot of a complete tree */
  T.fromArray = function (arr, opts) {
    opts = opts || {};
    const n = arr.length;
    const pos = new Map();
    let rank = 0;
    const visit = (i, d) => {
      if (i >= n) return;
      visit(2 * i + 1, d + 1);
      pos.set(i, { x: (opts.x0 || 0) + rank * (opts.dx || T.DX), y: (opts.y0 || 0) + d * (opts.dy || 86), depth: d });
      rank++;
      visit(2 * i + 2, d + 1);
    };
    visit(0, 0);
    return pos;
  };
})(SEE);
