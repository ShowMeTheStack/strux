// Drawing multi-key trees (B-trees, B+ trees). A node is a wide box with a slot for every key it can
// hold and a thin pointer slot between and around them; an empty slot is drawn dashed, so a full node
// is easy to see. Keys are separate items keyed by their value, so when the program copies a key from
// one slot to another (a shift, a split, a borrow, a merge) the key glides there. Leaves sit on one
// row at the bottom and the tree grows upwards, the way a B-tree really grows.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const B = X.BTreeKit = {};
  B.KW = 38; B.KH = 34; B.PW = 11; B.LPW = 3; B.DY = 112; B.GAP = 26;

  /**
   * Capture the nodes. opts: {type: pointer names whose pointee is the node type, root: 'root',
   *   cursors: names read in the newest frame, stack: a pointer name read in every frame (recursion),
   *   extra(P)}
   */
  B.capture = function (P, opts) {
    let t = null;
    for (const n of [].concat(opts.type || [], opts.root || 'root', opts.cursors || [])) { t = P.pointee(n); if (t && SEE.Types.unqual(t).k !== 'ptr') break; t = null; }
    const out = { nodes: [], cursors: {}, root: undefined, stack: [] };
    if (opts.extra) out.extra = opts.extra(P);
    const rn = opts.root || 'root';
    if (P.has(rn)) out.root = P.isSet(rn) ? P.val(rn) : undefined;
    for (const n of opts.cursors || []) if (P.has(n, 0)) out.cursors[n] = P.isSet(n, 0) ? P.val(n, 0) : undefined;
    if (opts.stack) {
      for (let fi = P.frames.length - 1; fi >= 0; fi--) if (P.has(opts.stack, fi) && P.isSet(opts.stack, fi)) out.stack.push(P.val(opts.stack, fi));
    }
    if (!t) return out;
    const d = SEE.Types.def(SEE.Types.unqual(t));
    const lay = {};
    for (const m of d.members || []) {
      if (!m.name) continue;
      const mt = SEE.Types.unqual(m.type);
      lay[m.name] = { off: m.offset, size: SEE.Types.sizeof(mt), es: mt.k === 'array' ? SEE.Types.sizeof(mt.of) : SEE.Types.sizeof(mt), len: mt.k === 'array' ? mt.n : 1 };
    }
    out.layout = lay;
    out.size = SEE.Types.sizeof(t);
    const addrs = P.blocksOf(t);
    const ptrs = Object.values(out.cursors).concat(out.stack, [out.root]);
    for (const p of ptrs) if (p && !addrs.includes(p) && P.freed(p)) addrs.push(p);
    for (const a of addrs) {
      const f = P.fields(t, a);
      out.nodes.push({ addr: a, freed: P.freed(a), n: f.n, leaf: f.leaf, key: f.key || [], child: f.child || [], next: f.next || 0 });
    }
    return out;
  };

  /**
   * Which slot each key and each child pointer belongs to on this tick. A copy leaves the value in two
   * slots for a moment; the slot written last owns it, the other is a stale copy (drawn faint).
   * Returns {keyAt: Map(item key -> {a, i, v}), ghosts: [{a, i, v}], kidAt: Map(child addr -> {a, i})}
   */
  B.resolve = function (ctx, data, opts) {
    const memo = ctx.memo.bt || (ctx.memo.bt = { key: new Map(), kid: new Map(), nAt: new Map(), tick: -1 });
    const name = opts.keyName || ((n, v) => 'k' + v);
    const by = new Map(data.nodes.map((n) => [n.addr, n]));
    const L = data.layout;
    if (memo.tick !== ctx.i && L) {
      memo.tick = ctx.i;
      for (const e of ctx.tick.events) {
        if (e.kind !== 'write') continue;
        for (const n of data.nodes) {
          if (n.freed) continue;
          const o = e.addr - n.addr;
          if (o < 0 || o >= data.size) continue;
          if (o >= L.n.off && o < L.n.off + L.n.size) memo.nAt.set(n.addr, ctx.i);
          if (L.key && o >= L.key.off && o < L.key.off + L.key.size) {
            const i = Math.floor((o - L.key.off) / L.key.es);
            memo.key.set(name(n, n.key[i]), { a: n.addr, i, t: ctx.i });
          }
          if (L.child && o >= L.child.off && o < L.child.off + L.child.size) {
            const i = Math.floor((o - L.child.off) / L.child.es);
            if (n.child[i]) memo.kid.set(n.child[i], { a: n.addr, i, t: ctx.i });
          }
        }
      }
    }
    const nAt = (a) => memo.nAt.get(a) || 0;
    const keyAt = new Map();
    for (const [nm, s] of memo.key) {
      const n = by.get(s.a);
      if (!n || n.freed || s.i >= n.key.length || name(n, n.key[s.i]) !== nm || !(s.i < n.n || s.t >= nAt(s.a))) continue;
      keyAt.set(nm, { a: s.a, i: s.i, v: n.key[s.i] });
    }
    const order = B.order(data);
    const taken = new Set([...keyAt.values()].map((s) => s.a + ':' + s.i));
    const ghosts = [];
    for (const n of order) {
      for (let i = 0; i < n.n; i++) {
        const nm = name(n, n.key[i]);
        if (taken.has(n.addr + ':' + i)) continue;
        if (!keyAt.has(nm)) { keyAt.set(nm, { a: n.addr, i, v: n.key[i] }); taken.add(n.addr + ':' + i); } else ghosts.push({ a: n.addr, i, v: n.key[i] });
      }
    }
    const kidAt = new Map();
    for (const [c, s] of memo.kid) {
      const n = by.get(s.a);
      if (!n || n.freed || n.leaf || n.child[s.i] !== c || !(s.i <= n.n || s.t >= nAt(s.a))) continue;
      if (by.has(c) && !by.get(c).freed) kidAt.set(c, { a: s.a, i: s.i });
    }
    const kidTaken = new Set([...kidAt.values()].map((s) => s.a + ':' + s.i));
    for (const n of order) {
      if (n.leaf) continue;
      for (let i = 0; i <= n.n && i < n.child.length; i++) {
        const c = n.child[i];
        if (!c || kidTaken.has(n.addr + ':' + i) || kidAt.has(c) || !by.has(c) || by.get(c).freed) continue;
        kidAt.set(c, { a: n.addr, i });
      }
    }
    return { keyAt, ghosts, kidAt };
  };

  /** Live nodes, the ones nearer the root first (so a stale copy lower down loses to the real key) */
  B.order = function (data) {
    const by = new Map(data.nodes.map((n) => [n.addr, n]));
    const out = [], seen = new Set();
    const q = data.root && by.has(data.root) ? [data.root] : [];
    while (q.length) {
      const a = q.shift();
      if (seen.has(a) || !by.has(a)) continue;
      seen.add(a);
      const n = by.get(a);
      if (n.freed) continue;
      out.push(n);
      if (!n.leaf) for (let i = 0; i <= n.n && i < n.child.length; i++) if (n.child[i]) q.push(n.child[i]);
    }
    for (const n of data.nodes) if (!seen.has(n.addr) && !n.freed) out.push(n);
    return out;
  };

  /** Width of a node box with cap key slots */
  // leaves have no children, so their pointer slots are thin
  B.pw = (leaf) => (leaf ? B.LPW : B.PW);
  B.width = (cap, leaf) => cap * B.KW + (cap + 1) * B.pw(leaf);
  B.slotX = (i, leaf) => B.pw(leaf) + i * (B.KW + B.pw(leaf));
  B.ptrX = (i, leaf) => i * (B.KW + B.pw(leaf));

  /**
   * Positions of the node boxes: Map(addr -> {x, y, depth}), x the left edge, y the top. Leaves are on
   * row 0 and each level above is DY higher. opts: {cap, gap, orphan(node) -> {after: addr} | {above: true}}
   */
  B.layout = function (ctx, data, res, opts) {
    const by = new Map(data.nodes.map((n) => [n.addr, n]));
    const W = B.width(opts.cap), gap = opts.gap || B.GAP;
    const wOf = (a) => B.width(opts.cap, by.has(a) && by.get(a).leaf);
    const kids = new Map();
    for (const [c, s] of res.kidAt) { if (!kids.has(s.a)) kids.set(s.a, []); kids.get(s.a).push({ c, i: s.i }); }
    for (const l of kids.values()) l.sort((p, q) => p.i - q.i);
    const parent = new Map();
    for (const [a, l] of kids) for (const k of l) parent.set(k.c, a);
    // nodes nothing points at yet: a new right half waiting to be linked, a new root
    const live = data.nodes.filter((n) => !n.freed);
    const tops = live.filter((n) => !parent.has(n.addr));
    let main = data.root && by.has(data.root) && !by.get(data.root).freed ? data.root : null;
    if (main) { const seen = new Set(); while (parent.has(main) && !seen.has(main)) { seen.add(main); main = parent.get(main); } }
    if (!main && tops.length) main = tops[0].addr;
    const forest = main ? [main] : [];
    const above = [];
    const loose = [];
    for (const n of tops) {
      if (n.addr === main) continue;
      const h = opts.orphan ? opts.orphan(n) : null;
      if (h && h.after && parent.has(h.after)) {
        const l = kids.get(parent.get(h.after));
        const k = l.findIndex((x) => x.c === h.after);
        l.splice(k + 1, 0, { c: n.addr, i: -1 });
        parent.set(n.addr, parent.get(h.after));
      } else if (h && h.after && forest.includes(h.after)) forest.splice(forest.indexOf(h.after) + 1, 0, n.addr);
      else if (h && h.above) above.push(n.addr);
      else loose.push(n.addr);
    }
    const sub = new Map();
    const width = (a, d) => {
      const l = kids.get(a) || [];
      let s = 0;
      if (d < 30) l.forEach((k, j) => { s += width(k.c, d + 1) + (j ? gap : 0); });
      const w = Math.max(wOf(a), s);
      sub.set(a, w);
      return w;
    };
    const depthOf = new Map();
    let height = 1;
    const deep = (a, d) => { depthOf.set(a, d); height = Math.max(height, d + 1); if (d < 30) for (const k of kids.get(a) || []) deep(k.c, d + 1); };
    for (const a of forest) deep(a, 0);
    const pos = new Map();
    const place = (a, left, d) => {
      const l = kids.get(a) || [];
      const w = sub.get(a);
      const y = -(height - 1 - d) * B.DY;
      if (!l.length || d >= 30) { pos.set(a, { x: left + (w - wOf(a)) / 2, y, depth: d }); return; }
      let span = 0;
      l.forEach((k, j) => { span += sub.get(k.c) + (j ? gap : 0); });
      let x = left + (w - span) / 2;
      const xs = [];
      for (const k of l) { place(k.c, x, d + 1); xs.push(pos.get(k.c).x + wOf(k.c) / 2); x += sub.get(k.c) + gap; }
      pos.set(a, { x: (xs[0] + xs[xs.length - 1]) / 2 - wOf(a) / 2, y, depth: d });
    };
    let left = 0;
    for (const a of forest) { width(a, 0); place(a, left, 0); left += sub.get(a) + gap * 2; }
    const top = -(height - 1) * B.DY;
    // a new root waits above the old one
    const mid = forest.length ? (Math.min(...forest.map((a) => pos.get(a).x)) + Math.max(...forest.map((a) => pos.get(a).x + wOf(a)))) / 2 - W / 2 : 0;
    above.forEach((a, j) => pos.set(a, { x: mid + j * (W + gap), y: top - B.DY, depth: -1 }));
    const memo = ctx.memo.bt;
    loose.forEach((a, j) => pos.set(a, (memo && memo.pos && memo.pos.get(a)) || { x: left + j * (W + gap), y: 0, depth: height - 1 }));
    // freed nodes stay where they were last seen while they fade
    for (const n of data.nodes) if (n.freed && memo && memo.pos && memo.pos.has(n.addr)) pos.set(n.addr, memo.pos.get(n.addr));
    if (memo) { memo.pos = memo.pos || new Map(); for (const [a, p] of pos) memo.pos.set(a, p); }
    return { pos, kids, parent, height, main, W, wOf };
  };

  /**
   * The picture. opts: {cap: key slots drawn, over: first slot that is an overflow slot (B+ trees),
   *   keyName(node, v), frameCls(node), keyCls(node, i, v), orphan(node), chain: draw leaf next links,
   *   rootName, sepCls(node): extra class for keys of internal nodes}
   * Returns {items, pos, cell(itemKey) -> {x, y} of a key, slot(a, i) -> {x, y}, res, lay}
   */
  // every class word gets the mw- prefix, so other areas' styles for plain words cannot reach these items
  const pre = (c) => (c || '').split(/\s+/).filter(Boolean).map((w) => (/^mw-/.test(w) ? w : 'mw-' + w)).join(' ');
  B.pre = pre;

  B.picture = function (ctx, data, opts) {
    const res = B.resolve(ctx, data, opts);
    const lay = B.layout(ctx, data, res, opts);
    const pos = lay.pos, W = lay.W, wOf = lay.wOf;
    const by = new Map(data.nodes.map((n) => [n.addr, n]));
    const name = opts.keyName || ((n, v) => 'k' + v);
    const items = [];
    const prevNodes = ctx.memo.btPrev || new Set();
    const H = B.KH + 8;
    for (const n of data.nodes) {
      const p = pos.get(n.addr);
      if (!p) continue;
      const isNew = !prevNodes.has(n.addr);
      const fc = ' ' + pre((n.freed ? 'freed ' : '') + (opts.frameCls ? opts.frameCls(n) || '' : ''));
      items.push({ key: 'f' + n.addr, kind: 'region', x: p.x, y: p.y, w: wOf(n.addr), h: H, cls: 'mw-frame' + (n.leaf ? ' mw-leaf' : '') + fc, enter: isNew && ctx.i ? 'grow' : 'fade', exit: n.freed ? 'shrink' : 'fade' });
      for (let i = 0; i < opts.cap; i++) {
        const used = i < n.n;
        items.push({ key: 'ks' + n.addr + '_' + i, kind: 'region', x: p.x + B.slotX(i, n.leaf), y: p.y + 4, w: B.KW, h: B.KH, cls: 'mw-slot' + (used ? ' mw-used' : '') + (opts.over !== undefined && i >= opts.over ? ' mw-over' : ''), enter: 'fade' });
      }
      for (let i = 0; i <= opts.cap; i++) {
        const has = !n.leaf && i <= n.n;
        items.push({ key: 'p' + n.addr + '_' + i, kind: 'region', x: p.x + B.ptrX(i, n.leaf) + (n.leaf ? 0 : 2), y: p.y + 9, w: Math.max(1, B.pw(n.leaf) - 4), h: B.KH - 10, cls: 'mw-ptr' + (has ? ' mw-on' : '') + (n.leaf ? ' mw-leafp' : ''), enter: 'fade' });
      }
    }
    // keys
    const cells = new Map();
    for (const [nm, s] of res.keyAt) {
      const p = pos.get(s.a);
      if (!p) continue;
      const n = by.get(s.a);
      const x = p.x + B.slotX(s.i, n.leaf) + 2, y = p.y + 6;
      const faded = opts.frameCls && /(^|\s)faded/.test(opts.frameCls(n) || '');
      cells.set(nm, { x, y, a: s.a, i: s.i });
      items.push({ key: nm, kind: 'cell', x, y, w: B.KW - 4, h: B.KH - 4, text: s.v, cls: 'mw-key ' + pre((n.leaf ? '' : 'inner ') + (opts.keyCls ? opts.keyCls(n, s.i, s.v) || '' : '') + (faded ? ' faded' : '')), enter: 'fade', exit: 'shrink' });
    }
    for (const g of res.ghosts) {
      const p = pos.get(g.a);
      if (!p) continue;
      items.push({ key: 'g' + g.a + '_' + g.i, kind: 'cell', x: p.x + B.slotX(g.i, by.get(g.a).leaf) + 2, y: p.y + 6, w: B.KW - 4, h: B.KH - 4, text: g.v, cls: 'mw-key mw-stale', enter: 'fade', exit: 'fade' });
    }
    // child links
    for (const [c, s] of res.kidAt) {
      if (!pos.has(c) || !pos.has(s.a)) continue;
      items.push({ key: 'e' + c, kind: 'arrow', from: { key: 'p' + s.a + '_' + s.i, side: 'bottom' }, to: { key: 'f' + c, side: 'top' }, cls: 'mw-edge ' + pre(opts.edgeCls ? opts.edgeCls(s.a, c) || '' : '') });
    }
    // leaf chain (B+ trees)
    if (opts.chain) {
      for (const n of data.nodes) {
        if (!n.leaf || n.freed || !pos.has(n.addr)) continue;
        if (n.next && pos.has(n.next)) items.push({ key: 'nx' + n.addr, kind: 'arrow', from: { key: 'f' + n.addr, side: 'right' }, to: { key: 'f' + n.next, side: 'left' }, cls: 'mw-next ' + pre(opts.nextCls ? opts.nextCls(n) || '' : '') });
        else if (!n.next) { const p = pos.get(n.addr); items.push({ key: 'nn' + n.addr, kind: 'text', x: p.x + wOf(n.addr) + 6, y: p.y + H / 2 + 4, text: '/', cls: 'null-mark' }); }
      }
    }
    // the root pointer: a box on the left of the root
    if (data.root !== undefined && opts.rootName !== false) {
      const rp = data.root && pos.get(data.root);
      const ref = rp || (lay.main && pos.get(lay.main)) || { x: 0, y: 0 };
      const changed = ctx.prev && ctx.prev.data && ctx.prev.data.root !== data.root;
      items.push({ key: 'rootbox', kind: 'node', x: ref.x - 100, y: ref.y + 5, w: 64, h: 32, cells: [{ text: data.root ? '' : 'NULL', port: 'p', cls: 'link' + (data.root ? '' : ' null') + (changed ? ' hot' : '') }], label: opts.rootName || 'root', cls: 'root c-indigo' });
      if (rp) items.push({ key: 'rootarrow', kind: 'arrow', from: { key: 'rootbox', port: 'p' }, to: { key: 'f' + data.root, side: 'left' }, cls: 'root-arrow c-indigo' + (changed ? ' hot' : '') });
    }
    ctx.memo.btPrev = new Set(data.nodes.map((n) => n.addr));
    return {
      items, pos, res, lay, by, W, H,
      cell: (nm) => cells.get(nm) || null,
      wOf,
      slot: (a, i) => (pos.has(a) ? { x: pos.get(a).x + B.slotX(i, by.has(a) && by.get(a).leaf), y: pos.get(a).y } : null),
    };
  };

  /** A tag for a pointer variable on a node: above its pointer slot number cap (its right end when cap is the capacity) */
  B.cursor = function (name, a, slot, cls, cap) {
    return { key: 'c' + name, kind: 'cursor', at: 'p' + a + '_' + (cap || 0), side: 'above', slot: slot || 0, text: name, cls: cls || X.ListKit.cursorCls(name) };
  };
  /** An index tag under key slot i (or under pointer slot i when it points between keys) */
  B.index = function (name, a, i, between, cls) {
    return { key: 'c' + name, kind: 'cursor', at: (between ? 'p' : 'ks') + a + '_' + i, side: 'below', text: name, cls: cls || X.ListKit.cursorCls(name) };
  };
  /** Keys of a node in order, as text */
  B.keys = (n) => (n ? n.key.slice(0, n.n).join(', ') : '');
})(SEE);
