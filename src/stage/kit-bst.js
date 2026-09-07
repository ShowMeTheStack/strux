// Helpers for the binary search tree topics: a capture that also reads every active call of a
// recursive function, a layout that keeps a freed node in its place until it is unlinked, cursor tags
// that do not sit on top of each other, a call-stack ladder, and the sorted key strip under a tree.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const B = X.BstKit = {};

  /** Values of some variables in every active call of fn, oldest call first */
  B.frames = (P, fn, names) => {
    const out = [];
    for (let i = P.frames.length - 1; i >= 0; i--) {
      const f = P.frames[i];
      if (f.name !== fn) continue;
      const o = {};
      for (const n of names) o[n] = P.has(n, i) && P.isSet(n, i) ? P.val(n, i) : null;
      out.push(o);
    }
    return out;
  };

  /**
   * Capture: the tree reached from main's root (and any loose nodes), the pointer variables of the
   * newest call, and for recursive topics the stack of calls of fn with the variables in vars.
   * o: {cursors, fn, vars, more: {fn: [names]}, extra(P)}
   */
  B.capture = (o) => (P) => {
    const d = X.TreeKit.capture(P, { type: o.type || 'root', root: 'root', cursors: o.cursors || [], fields: ['key'] });
    const top = P.frames.find((f) => !f.system);
    d.top = top ? top.name : '';
    d.stack = o.fn ? B.frames(P, o.fn, o.vars || ['node']) : [];
    if (o.more) { d.more = {}; for (const fn of Object.keys(o.more)) d.more[fn] = B.frames(P, fn, o.more[fn]); }
    if (o.extra) d.extra = o.extra(P);
    return d;
  };

  /** Key of the node at address a, or 'NULL' */
  B.name = (d, a) => { const n = a && d.nodes.find((x) => x.addr === a); return n ? String(n.key) : 'NULL'; };
  B.node = (d, a) => (a && d.nodes.find((x) => x.addr === a)) || null;
  B.byKey = (d, k) => d.nodes.find((x) => !x.freed && x.key === k) || null;

  /** Addresses in the subtree under a (a included) */
  B.subtree = (d, a) => {
    const by = new Map(d.nodes.map((n) => [n.addr, n]));
    const out = new Set();
    const go = (p, depth) => { if (!p || out.has(p) || !by.has(p) || depth > 40) return; out.add(p); const n = by.get(p); if (n.freed) return; go(n.links.left, depth + 1); go(n.links.right, depth + 1); };
    go(a, 0);
    return out;
  };
  /** The keys of the tree in increasing order (an in-order walk from the root) */
  B.inorder = (d, from) => {
    const by = new Map(d.nodes.map((n) => [n.addr, n]));
    const out = [];
    const go = (p, depth) => { if (!p || !by.has(p) || depth > 40) return; const n = by.get(p); if (n.freed) return; go(n.links.left, depth + 1); out.push(n); go(n.links.right, depth + 1); };
    go(from === undefined ? d.root : from, 0);
    return out;
  };

  /**
   * Positions like TreeKit.layout (x by in-order rank, y by depth), except that a freed node still
   * linked from the tree keeps its place, and its child stays under it, until the link is changed.
   */
  B.layout = (ctx, d, o) => {
    o = o || {};
    const T = X.TreeKit;
    const memo = ctx.memo;
    const known = memo.bstLinks || (memo.bstLinks = new Map());
    for (const n of d.nodes) if (!n.freed) known.set(n.addr, n.links);
    const links = (n) => (n.freed ? known.get(n.addr) || { left: 0, right: 0 } : n.links);
    const by = new Map(d.nodes.map((n) => [n.addr, n]));
    const pos = new Map();
    const dx = o.dx || T.DX, dy = o.dy || T.DY, x0 = o.x0 || 0, y0 = o.y0 || 0;
    let rank = 0;
    const seen = new Set();
    const visit = (a, depth) => {
      if (!a || !by.has(a) || seen.has(a) || depth > 40) return;
      seen.add(a);
      const n = by.get(a);
      visit(links(n).left, depth + 1);
      pos.set(a, { x: x0 + rank * dx, y: y0 + depth * dy, depth });
      rank++;
      visit(links(n).right, depth + 1);
    };
    visit(o.root !== undefined ? o.root : d.root, 0);
    // live nodes outside the tree (a node just made, a subtree just cut off): on the right
    rank++;
    for (const n of d.nodes) {
      if (pos.has(n.addr) || n.freed) continue;
      if (d.nodes.some((m) => !m.freed && (m.links.left === n.addr || m.links.right === n.addr))) continue;
      visit(n.addr, o.shelfDepth || 0);
      rank++;
    }
    return { pos, links };
  };

  /**
   * The tree picture. o: {nodeCls(n), edgeCls(n, side), label(n), labelAbove, showNull, pos,
   *   cursors: [[name, addr, cls]], noRoot, rootName}. Freed nodes that nothing links to are left out,
   *   so they fall away.
   */
  B.picture = (ctx, d, o) => {
    o = o || {};
    const T = X.TreeKit;
    const L = B.layout(ctx, d, o);
    const pos = o.pos || L.pos;
    const nodes = d.nodes.filter((n) => pos.has(n.addr)).map((n) => (n.freed ? Object.assign({}, n, { links: L.links(n) }) : n));
    const data = { nodes, root: o.noRoot ? undefined : d.root, cursors: {} };
    const pic = T.picture(ctx, data, { pos, nodeCls: o.nodeCls, edgeCls: o.edgeCls, label: o.label, labelAbove: o.labelAbove, showNull: o.showNull, rootName: o.rootName, x0: o.x0, y0: o.y0 });
    const items = pic.items;
    // cursor tags: the first on the left of its node, the second on the right, a third above
    const used = new Map();
    for (const c of o.cursors || []) {
      const [name, a, cls] = c;
      if (!a || !pos.has(a)) continue;
      const s = used.get(a) || 0;
      used.set(a, s + 1);
      const side = ['left', 'right', 'above', 'below'][s % 4];
      items.push({ key: 'c' + name, kind: 'cursor', at: 'n' + a, side, slot: 0, text: name, cls: cls || X.ListKit.cursorCls(name) });
    }
    const by = new Map(d.nodes.map((n) => [n.addr, n]));
    return { items, pos, by };
  };

  /** Where an empty child of the node at p would be drawn */
  B.nullAt = (pos, a, side) => { const p = pos.get(a); return p ? { x: p.x + (side === 'left' ? -32 : 32), y: p.y + X.TreeKit.DY * 0.62 } : null; };

  /** Extent of the drawn tree */
  B.box = (pos) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pos.values()) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    if (x0 === Infinity) return { x0: 0, x1: 0, y0: 0, y1: 0 };
    return { x0, x1, y0, y1 };
  };

  /** A shaded box behind a set of nodes (a subtree, the part still to search) */
  B.region = (pos, set, key, cls, text) => {
    const ps = [...set].map((a) => pos.get(a)).filter(Boolean);
    if (!ps.length) return null;
    const x0 = Math.min(...ps.map((p) => p.x)) - 34, x1 = Math.max(...ps.map((p) => p.x)) + 34;
    const y0 = Math.min(...ps.map((p) => p.y)) - (text ? 54 : 36), y1 = Math.max(...ps.map((p) => p.y)) + 40;
    return { key, kind: 'region', x: x0, y: y0, w: x1 - x0, h: y1 - y0, cls, text: text || '' };
  };

  /**
   * The call stack drawn as a ladder of rows, oldest at the top: rows [{text, cls}]. x, y: top left.
   * The newest call is marked.
   */
  B.ladder = (rows, x, y, key, w) => {
    const items = [];
    items.push({ key: key + '-t', kind: 'text', x, y: y - 12, text: 'CALLS WAITING TO FINISH', cls: 'bx-title' });
    rows.forEach((r, i) => {
      const yy = y + i * 38;
      items.push({ key: key + i, kind: 'region', x, y: yy, w: w || 250, h: 32, cls: 'bx-frame' + (i === rows.length - 1 ? ' bx-top' : '') + (r.cls ? ' ' + r.cls : ''), enter: 'grow', exit: 'fade' });
      items.push({ key: key + i + 'x', kind: 'text', x: x + 10, y: yy + 21, text: r.text, cls: 'bx-code' + (r.tcls ? ' ' + r.tcls : ''), layer: 'top' });
    });
    return items;
  };

  /**
   * Where the ladder goes: right of the tree or under it, whichever lets the stage draw everything
   * bigger (the stage is about 4:3). Decided once per run from the deepest stack, so it does not jump.
   */
  B.ladderAt = (ctx, box, w, under) => {
    under = under || 0;
    const memo = ctx.memo;
    if (!memo.ladderSide) {
      const rows = Math.max(1, ...ctx.ticks.map((t) => (t.data && t.data.stack ? t.data.stack.length + 1 : 1)));
      const tw = box.x1 - box.x0 + 120, th = box.y1 - box.y0 + 230 + under;
      const right = Math.min(4 / (tw + w + 80), 3 / Math.max(th, rows * 38 + 60));
      const below = Math.min(4 / Math.max(tw, w + 40), 3 / (th + 40 + rows * 38));
      memo.ladderSide = right > below ? 'right' : 'below';
    }
    return memo.ladderSide === 'right' ? { x: box.x1 + 80, y: box.y0 - 40 } : { x: box.x0 - 40, y: box.y1 + 120 + under };
  };

  /** The keys in increasing order as a row of cells, each under its node (x is the in-order rank) */
  B.strip = (d, pos, y, cls, key) => {
    const items = [];
    for (const n of B.inorder(d)) {
      const p = pos.get(n.addr);
      if (!p) continue;
      items.push({ key: (key || 's') + n.addr, kind: 'cell', x: p.x - 24, y, w: 48, h: 36, text: n.key, cls: cls ? cls(n) || '' : '' });
    }
    return items;
  };
})(SEE);
