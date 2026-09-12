// Drawing balanced trees (AVL and red-black) and animating rotations. Nodes sit at x = their in-order
// rank (a rotation never changes the in-order, so nodes only move up and down) and y = depth. While a
// rotation is half done the picture holds still and only the arrows swing; once the subtree is whole
// again everybody glides to their new level. Also: small simulations in JS, used to turn the keys a
// student types into the tree that inserting them would really give.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const B = X.BalanceKit = {};
  B.DX = 62; B.DY = 88; B.R = 22;

  // ---- capture ---------------------------------------------------------------------------------------
  /**
   * opts: {fields: ['key', 'height'], links: ['left', 'right'] (and 'parent'), cursors: [names in frame 0],
   *   nil: name of the sentinel pointer (red-black), stack: {fns: [...], v: 'n'}: the value of v in every
   *   active call of those functions, extra(P, fi)}
   * Cursors are read from the frame running the tick's line: a line that calls a function is pictured
   * while the callee runs (or just after a helper returned), so the newest frame is not always it.
   */
  B.frameOf = function (P, tk) {
    if (!tk) return 0;
    let fb = -1;
    for (let i = 0; i < P.frames.length; i++) {
      const f = P.frames[i];
      if (f.name !== tk.fn) continue;
      if (f.where && f.where.line === tk.line) return i;
      if (fb < 0) fb = i;
    }
    return fb < 0 ? 0 : fb;
  };
  B.capture = function (P, opts, tk) {
    const t = P.pointee('root');
    const fi = B.frameOf(P, tk);
    const out = { nodes: [], root: 0, nil: 0, cursors: {}, stack: [], calls: P.calls(), fi };
    if (opts.nil && P.has(opts.nil)) out.nil = P.val(opts.nil) || 0;
    if (P.has('root')) out.root = P.isSet('root') ? P.val('root') || 0 : 0;
    for (const n of opts.cursors || []) {
      if (!P.has(n, fi)) continue;
      out.cursors[n] = P.isSet(n, fi) ? P.val(n, fi) : undefined;
    }
    if (opts.stack) {
      P.frames.forEach((f, fi) => {
        if (!opts.stack.fns.includes(f.name) || !P.has(opts.stack.v, fi)) return;
        out.stack.push(P.isSet(opts.stack.v, fi) ? P.val(opts.stack.v, fi) : 0);
      });
    }
    if (opts.extra) out.extra = opts.extra(P, fi);
    if (!t) return out;
    const starts = P.blocksOf(t).slice();
    for (const v of Object.values(out.cursors).concat(out.stack)) if (v && !starts.includes(v) && P.freed(v)) starts.push(v);
    const links = opts.links || ['left', 'right'];
    for (const a of starts) {
      const f = P.fields(t, a);
      const node = { addr: a, freed: P.freed(a), links: {} };
      for (const l of links) node.links[l] = f[l] && f[l] !== out.nil ? f[l] : 0;
      for (const k of opts.fields || ['key']) node[k] = f[k];
      out.nodes.push(node);
    }
    if (out.root === out.nil) out.root = 0;
    if (out.nil) { const f = P.fields(t, out.nil); out.nilParent = f.parent && f.parent !== out.nil ? f.parent : 0; }
    return out;
  };

  /** A pointer value as a node address, or 0 for NULL and the sentinel */
  B.addr = (d, p) => (p && p !== d.nil ? p : 0);
  B.byAddr = (d) => new Map(d.nodes.map((n) => [n.addr, n]));

  // ---- layout ----------------------------------------------------------------------------------------
  /**
   * Positions. opts: {freeze: keep last positions, subst: {from, to}: links to `from` (except from `to`)
   *   lead to `to` (a rotation whose caller has not stored the new subtree root yet), virt: [{from: addr |
   *   'root', side, to}] links that are about to exist, place: Map(addr -> {x, y}) fixed spots}
   * Returns {pos: Map(addr -> {x, y, depth}), reached: Set, top: the root drawn}
   */
  B.layout = function (ctx, d, opts) {
    opts = opts || {};
    const memo = ctx.memo;
    const last = memo.balPos || (memo.balPos = new Map());
    const by = B.byAddr(d);
    const dx = opts.dx || B.DX, dy = opts.dy || B.DY;
    const virt = opts.virt || [];
    const sub = opts.subst;
    const follow = (from, c) => (sub && c === sub.from && from !== sub.to ? sub.to : c);
    const kid = (a, side) => {
      const v = virt.find((w) => w.from === a && w.side === side);
      if (v) return v.to;
      const n = by.get(a);
      return n && !n.freed ? follow(a, n.links[side]) : 0;
    };
    const vr = virt.find((w) => w.from === 'root');
    const top = vr ? vr.to : follow(-1, d.root);
    const depth = new Map();
    let broken = false;
    const walk = (a, k) => {
      if (!a || !by.has(a)) return;
      if (depth.has(a) || k > 30) { broken = true; return; }
      depth.set(a, k);
      walk(kid(a, 'left'), k + 1);
      walk(kid(a, 'right'), k + 1);
    };
    walk(top, 0);
    // x: in-order rank by key (ties: where it was before), over every node in the picture
    const order = d.nodes.slice().sort((a, b) => a.key - b.key || ((last.get(a.addr) || {}).x || 0) - ((last.get(b.addr) || {}).x || 0) || a.addr - b.addr);
    const rank = new Map(order.map((n, i) => [n.addr, i]));
    const pos = new Map();
    const freeze = opts.freeze || broken;
    for (const n of d.nodes) {
      const fixed = opts.place && opts.place.get(n.addr);
      if (fixed) { pos.set(n.addr, Object.assign({ depth: 0 }, fixed)); continue; }
      const old = last.get(n.addr);
      if ((freeze || !depth.has(n.addr) || n.freed) && old) { pos.set(n.addr, old); continue; }
      const k = depth.has(n.addr) ? depth.get(n.addr) : 0;
      pos.set(n.addr, { x: rank.get(n.addr) * dx, y: k * dy + (depth.has(n.addr) ? 0 : dy * 0.5), depth: k });
    }
    for (const [a, p] of pos) last.set(a, p);
    return { pos, reached: new Set(depth.keys()), top, broken };
  };

  // ---- the picture -------------------------------------------------------------------------------------
  /**
   * Items for the tree. opts: {pos, text(n), sub(n), nodeCls(n), edgeCls(n, side), edgeLabel(n, side),
   *   parents: draw parent pointers, parentCls(n), parentLabel(n), stubs: short lines for empty children,
   *   rootArrow: {cls, label} | false, rootTo: where the root arrow points (default d.root),
   *   cursors: {name: addr}, cursorCls: {name: cls}, virt: dashed links about to exist}
   */
  B.picture = function (ctx, d, opts) {
    const pos = opts.pos;
    const items = [];
    const R = opts.r || B.R;
    const prev = ctx.prev && ctx.prev.data && ctx.prev.data.nodes ? B.byAddr(ctx.prev.data) : null;
    for (const n of d.nodes) {
      const p = pos.get(n.addr);
      if (!p) continue;
      const isNew = prev && !prev.has(n.addr);
      items.push({
        key: 'n' + n.addr, kind: 'vertex', x: p.x, y: p.y, r: R, text: opts.text ? opts.text(n) : n.key,
        sub: opts.sub ? opts.sub(n) : '', cls: (n.freed ? 'ghost bal-freed' : '') + (opts.nodeCls ? ' ' + (opts.nodeCls(n) || '') : ''),
        enter: isNew ? 'drop' : 'fade', exit: 'fall', pick: true, title: 'node at ' + X.hex(n.addr),
      });
      if (n.freed) continue;
      for (const side of ['left', 'right']) {
        const c = n.links[side];
        if ((opts.virt || []).some((v) => v.from === n.addr && v.side === side)) continue;
        if (!c || !pos.has(c)) {
          if (!c && opts.stubs) items.push({ key: 'z' + n.addr + side, kind: 'line', x1: p.x + (side === 'left' ? -9 : 9), y1: p.y + R - 3, x2: p.x + (side === 'left' ? -20 : 20), y2: p.y + R + 11, cls: 'dim' });
          continue;
        }
        const changed = prev && prev.has(n.addr) && prev.get(n.addr).links[side] !== c;
        items.push({ key: 'e' + n.addr + side, kind: 'arrow', from: { key: 'n' + n.addr }, to: { key: 'n' + c }, cls: 'tree-edge' + (changed ? ' hot' : '') + (opts.edgeCls ? ' ' + (opts.edgeCls(n, side) || '') : ''), label: opts.edgeLabel ? opts.edgeLabel(n, side) || '' : '', bend: opts.edgeBend ? opts.edgeBend(n, side) || 0 : 0 });
      }
      if (opts.parents && n.links.parent && pos.has(n.links.parent)) {
        const changed = prev && prev.has(n.addr) && prev.get(n.addr).links.parent !== n.links.parent;
        const pp = pos.get(n.links.parent);
        const bend = pp.x < p.x ? -16 : 16;
        items.push({ key: 'p' + n.addr, kind: 'arrow', from: { key: 'n' + n.addr }, to: { key: 'n' + n.links.parent }, bend, cls: 'bal-parent' + (changed ? ' hot' : '') + (opts.parentCls ? ' ' + (opts.parentCls(n) || '') : ''), label: opts.parentLabel ? opts.parentLabel(n) || '' : '' });
      }
    }
    for (const v of opts.virt || []) {
      if (v.from === 'root' || !pos.has(v.from) || !pos.has(v.to)) continue;
      items.push({ key: 'e' + v.from + v.side, kind: 'arrow', from: { key: 'n' + v.from }, to: { key: 'n' + v.to }, cls: 'tree-edge hot bal-pending', label: v.label || '' });
    }
    // the root pointer: a box above the top of the tree
    if (opts.rootArrow !== false) {
      let topA = null;
      for (const [a, p] of pos) { const n = d.nodes.find((m) => m.addr === a); if (n && !n.freed && (!topA || p.y < pos.get(topA).y || (p.y === pos.get(topA).y && a === d.root))) topA = a; }
      const to = opts.rootTo !== undefined ? opts.rootTo : d.root;
      const tp = (to && pos.get(to)) || (topA && pos.get(topA));
      const minY = Math.min(0, ...[...pos.values()].map((p) => p.y));
      const ra = opts.rootArrow || {};
      const changed = ctx.prev && ctx.prev.data && ctx.prev.data.root !== undefined && B.addr(ctx.prev.data, ctx.prev.data.root) !== B.addr(d, d.root);
      const bx = tp ? tp.x - 34 : 0;
      items.push({ key: 'rootbox', kind: 'node', x: bx, y: minY - 86, w: 68, h: 30, cells: [{ text: to ? '' : (d.nil ? 'NIL' : 'NULL'), port: 'p', cls: 'link' + (to ? '' : ' null') + (changed ? ' hot' : '') }], label: opts.rootName || 'root', cls: 'root c-indigo' });
      if (to && pos.has(to)) items.push({ key: 'rootarrow', kind: 'arrow', from: { key: 'rootbox', port: 'p' }, to: { key: 'n' + to }, cls: 'root-arrow c-indigo' + (changed ? ' hot' : '') + (ra.cls ? ' ' + ra.cls : ''), label: ra.label || '' });
    }
    // pointer variables as tags beside their nodes
    const slots = new Map();
    for (const [c, v] of Object.entries(opts.cursors || {})) {
      if (!v || !pos.has(v)) continue;
      const s = slots.get(v) || 0;
      slots.set(v, s + 1);
      const p = pos.get(v);
      items.push({ key: 'c' + c, kind: 'cursor', at: 'n' + v, side: s % 2 ? 'right' : 'left', slot: Math.floor(s / 2), text: c, cls: (opts.cursorCls && opts.cursorCls[c]) || X.ListKit.cursorCls(c) });
      void p;
    }
    return items;
  };

  /** A shaded box around a subtree (the part that changes parent in a rotation) */
  B.around = function (key, d, pos, top, cls, text) {
    if (!top || !pos.has(top)) return [];
    const by = B.byAddr(d);
    const xs = [], ys = [];
    const visit = (a, k) => { if (!a || !by.has(a) || k > 20 || !pos.has(a)) return; const p = pos.get(a); xs.push(p.x); ys.push(p.y); const n = by.get(a); visit(n.links.left, k + 1); visit(n.links.right, k + 1); };
    visit(top, 0);
    if (!xs.length) return [];
    const m = B.R + 10;
    const x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m - 26, x1 = Math.max(...xs) + m, y1 = Math.max(...ys) + m + 14;
    return [{ key, kind: 'region', x: x0, y: y0, w: x1 - x0, h: y1 - y0, cls: 'bal-zone ' + (cls || ''), text: text || '' }];
  };

  /** A bend for a link from a to b that bulges away from point c (so it does not run through c) */
  B.bendAway = function (pa, pb, pc, amount) {
    if (!pa || !pb || !pc) return 0;
    const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
    return (nx * (pc.x - mx) + ny * (pc.y - my) > 0 ? -1 : 1) * (amount || 40);
  };

  /** A camera that fits the items snugly: small trees are drawn bigger than the stage's own default */
  B.view = function (items, opts) {
    opts = opts || {};
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => { if (!isFinite(x) || !isFinite(y)) return; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const s of items) {
      if (s.kind === 'vertex' || s.kind === 'token' || s.kind === 'ring') { const r = s.r || 22; add(s.x - r, s.y - r - 12); add(s.x + r, s.y + r + 22); }
      else if (s.kind === 'node' || s.kind === 'region') { add(s.x, s.y - 16); add(s.x + s.w, s.y + s.h); }
      else if (s.kind === 'text') { const w = (s.text || '').length * 8; add(s.anchor === 'middle' ? s.x - w / 2 : s.x, s.y - 16); add(s.anchor === 'middle' ? s.x + w / 2 : s.x + w, s.y + 4); }
      else if (s.kind === 'cursor' && s.at) continue;
    }
    if (x0 === Infinity) return null;
    const m = opts.margin || 46;
    let x = x0 - m, y = y0 - m, w = x1 - x0 + 2 * m, h = y1 - y0 + 2 * m;
    const minW = opts.minW || 560, minH = opts.minH || 340;
    if (w < minW) { x -= (minW - w) / 2; w = minW; }
    if (h < minH) { y -= (minH - h) / 2; h = minH; }
    return { x, y, w, h };
  };

  /** Keys of a subtree, in order */
  B.keysUnder = function (d, a) {
    const by = B.byAddr(d);
    const out = [];
    const visit = (p, k) => { if (!p || !by.has(p) || k > 30) return; const n = by.get(p); visit(n.links.left, k + 1); out.push(n.key); visit(n.links.right, k + 1); };
    visit(a, 0);
    return out;
  };

  /** Stored height of a node (AVL), 0 for none */
  B.h = (d, a) => { const n = a && d.nodes.find((m) => m.addr === a); return n && !n.freed ? n.height : 0; };
  /** Balance factor as the program would compute it: left height minus right height */
  B.bf = (d, n) => B.h(d, n.links.left) - B.h(d, n.links.right);
  B.fmtBf = (b) => (b > 0 ? '+' + b : String(b));

  // ---- simulations: what inserting keys in order really builds -------------------------------------------
  /** AVL insertion in JS. Returns the root {key, left, right, h} */
  B.avlTree = function (keys) {
    const h = (n) => (n ? n.h : 0);
    const up = (n) => { n.h = 1 + Math.max(h(n.left), h(n.right)); return n; };
    const rr = (y) => { const x = y.left; y.left = x.right; x.right = y; up(y); return up(x); };
    const rl = (y) => { const x = y.right; y.right = x.left; x.left = y; up(y); return up(x); };
    const bal = (n) => h(n.left) - h(n.right);
    const ins = (n, k) => {
      if (!n) return { key: k, left: null, right: null, h: 1 };
      if (k < n.key) n.left = ins(n.left, k); else if (k > n.key) n.right = ins(n.right, k); else return n;
      up(n);
      if (bal(n) > 1) { if (bal(n.left) < 0) n.left = rl(n.left); return rr(n); }
      if (bal(n) < -1) { if (bal(n.right) > 0) n.right = rr(n.right); return rl(n); }
      return n;
    };
    let root = null;
    for (const k of keys) root = ins(root, k);
    return root;
  };
  /** A plain BST in JS (no balancing) */
  B.bstTree = function (keys) {
    let root = null;
    const ins = (n, k) => { if (!n) return { key: k, left: null, right: null }; if (k < n.key) n.left = ins(n.left, k); else if (k > n.key) n.right = ins(n.right, k); return n; };
    for (const k of keys) root = ins(root, k);
    const hh = (n) => (n ? (n.h = 1 + Math.max(hh(n.left), hh(n.right))) : 0);
    hh(root);
    return root;
  };
  /** Red-black insertion in JS (CLRS). Returns the root; nodes {key, red, left, right, parent} */
  B.rbTree = function (keys) {
    let root = null;
    const rotL = (x) => { const y = x.right; x.right = y.left; if (y.left) y.left.parent = x; y.parent = x.parent; if (!x.parent) root = y; else if (x === x.parent.left) x.parent.left = y; else x.parent.right = y; y.left = x; x.parent = y; };
    const rotR = (x) => { const y = x.left; x.left = y.right; if (y.right) y.right.parent = x; y.parent = x.parent; if (!x.parent) root = y; else if (x === x.parent.right) x.parent.right = y; else x.parent.left = y; y.right = x; x.parent = y; };
    const red = (n) => !!(n && n.red);
    for (const k of keys) {
      let y = null, x = root;
      while (x) { y = x; if (k === x.key) break; x = k < x.key ? x.left : x.right; }
      if (y && y.key === k) continue;
      let z = { key: k, red: true, left: null, right: null, parent: y };
      if (!y) root = z; else if (k < y.key) y.left = z; else y.right = z;
      while (red(z.parent)) {
        const p = z.parent, g = p.parent;
        const u = p === g.left ? g.right : g.left;
        if (red(u)) { p.red = false; u.red = false; g.red = true; z = g; continue; }
        if (p === g.left) { if (z === p.right) { z = p; rotL(z); } z.parent.red = false; g.red = true; rotR(g); }
        else { if (z === p.left) { z = p; rotR(z); } z.parent.red = false; g.red = true; rotL(g); }
      }
      root.red = false;
    }
    return root;
  };
  /** Level order of a JS tree: inserting these into a plain BST gives exactly the same shape */
  B.levelOrder = function (root) {
    const out = [], q = root ? [root] : [];
    while (q.length) { const n = q.shift(); out.push(n); if (n.left) q.push(n.left); if (n.right) q.push(n.right); }
    return out;
  };
  /** Is every node's balance within -1..1 (optionally skipping one node)? */
  B.avlOk = function (root, skip) {
    const hh = (n) => (n ? 1 + Math.max(hh(n.left), hh(n.right)) : 0);
    let ok = true;
    const visit = (n) => { if (!n) return; if (n !== skip && Math.abs(hh(n.left) - hh(n.right)) > 1) ok = false; visit(n.left); visit(n.right); };
    visit(root);
    return ok;
  };
})(SEE);
