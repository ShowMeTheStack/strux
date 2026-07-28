// Drawing helpers for the second set of singly linked list topics (sll-3.js): node boxes placed by the
// topic, links routed so they never cut through other nodes (arches over a row, loops under it, curves
// round a ring), pointer tags with a shared NULL spot, hops, brackets and the ring and rho layouts used
// for rotation and for lists with a cycle.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, K = X.ListKit;
  const L = X.SllB = {};

  L.W = K.NODE_W; L.H = K.NODE_H; L.STEP = K.NODE_W + K.GAP;

  /** A row of addresses from x0: Map(addr -> {x, y}) */
  L.row = function (addrs, x0, y0, step, into) {
    const pos = into || new Map();
    addrs.forEach((a, i) => pos.set(a, { x: (x0 || 0) + i * (step || L.STEP), y: y0 || 0 }));
    return pos;
  };

  /** Positions that never change: the order of the chain from start at the first tick */
  L.fixed = function (ctx, d, start, id) {
    const k = 'sllb-fixed:' + (id || 'list');
    if (!ctx.memo[k]) ctx.memo[k] = K.chain(d, start).order;
    const pos = L.row(ctx.memo[k], 0, 0);
    let extra = ctx.memo[k].length;
    for (const n of d.nodes) if (!pos.has(n.addr)) pos.set(n.addr, { x: (extra++) * L.STEP, y: K.ROW });
    return pos;
  };

  /**
   * A rho: the first `entry` nodes of order in a row, the rest on a circle that starts at order[entry]
   * (clockwise). With entry = 0 the whole list is a ring. Returns {pos, ring: Set, cx, cy, R}.
   */
  L.rho = function (order, entry, x0, y0) {
    x0 = x0 || 0; y0 = y0 || 0;
    const pos = new Map();
    const lam = order.length - entry;
    for (let i = 0; i < entry; i++) pos.set(order[i], { x: x0 + i * L.STEP, y: y0 });
    const ex = x0 + entry * L.STEP + L.W / 2, ey = y0 + L.H / 2;
    const R = lam <= 1 ? 0 : Math.max(96, 182 / (2 * Math.sin(Math.PI / lam)));
    const cx = ex + R, cy = ey;
    for (let j = 0; j < lam; j++) {
      const th = Math.PI + j * 2 * Math.PI / lam;
      pos.set(order[entry + j], { x: cx + R * Math.cos(th) - L.W / 2, y: cy + R * Math.sin(th) - L.H / 2 });
    }
    return { pos, ring: new Set(order.slice(entry)), cx, cy, R, lam };
  };

  /**
   * Node boxes. opts: {cls(n) -> classes, written: Map from K.written, label(n) -> text above, key(n),
   *   skip(n) -> true to leave out, nullText}
   */
  L.nodes = function (ctx, d, pos, opts) {
    opts = opts || {};
    const items = [];
    const prevData = ctx.prev && ctx.prev.data;
    const had = new Set(prevData && prevData.nodes ? prevData.nodes.map((m) => m.addr) : []);
    for (const n of d.nodes) {
      const p = pos.get(n.addr);
      if (!p || (opts.skip && opts.skip(n))) continue;
      const hot = opts.written ? opts.written.get(n.addr) : null;
      items.push({
        key: 'n' + n.addr, kind: 'node', x: p.x, y: p.y, w: L.W, h: L.H,
        cells: K.cells(n, { fields: ['data'], links: ['next'], hotCells: hot, nullText: opts.nullText }),
        cls: (n.freed ? 'freed' : '') + (opts.cls ? ' ' + (opts.cls(n) || '') : ''),
        enter: prevData && !had.has(n.addr) ? 'drop' : 'fade', exit: 'fall',
        label: opts.label ? opts.label(n) || '' : '', title: 'node at ' + X.hex(n.addr), pick: true,
      });
    }
    return items;
  };

  /**
   * The next links, routed: straight to the neighbour on the right; an arch over the row to a node
   * further right; a loop under the row to a node on the left; straight between rows; a curve on a ring.
   * opts: {cls(n, to) -> classes, ring: Set of addrs on a circle, skip(n) -> true, route(n, to, p, q) -> extra spec}
   */
  L.links = function (ctx, d, pos, opts) {
    opts = opts || {};
    const items = [];
    const prevData = ctx.prev && ctx.prev.data;
    const prevNext = new Map();
    if (prevData && prevData.nodes) for (const n of prevData.nodes) prevNext.set(n.addr, n.links.next);
    for (const n of d.nodes) {
      const to = n.links.next;
      const p = pos.get(n.addr), q = to && pos.get(to);
      if (!p || !q || n.freed || (opts.skip && opts.skip(n))) continue;
      const changed = prevNext.has(n.addr) && prevNext.get(n.addr) !== to;
      const spec = { key: 'a' + n.addr, kind: 'arrow', from: { key: 'n' + n.addr, port: 'next' }, to: { key: 'n' + to }, cls: (changed ? 'hot ' : '') + (opts.cls ? opts.cls(n, to) || '' : '') };
      const dx = q.x - p.x, dy = q.y - p.y;
      if (to === n.addr) { spec.to.side = 'bottom'; spec.loop = 62; }
      else if (opts.ring && opts.ring.has(n.addr) && opts.ring.has(to)) spec.bend = -Math.hypot(dx, dy) * 0.16;
      else if (Math.abs(dy) < 1) {
        if (dx > 0 && dx <= L.STEP + 20) spec.to.side = 'left';
        else if (dx > 0) { spec.to.side = 'top'; spec.bend = -(26 + dx * 0.1); }
        else { spec.to.side = 'bottom'; spec.loop = 48 + Math.min(60, -dx * 0.08); }
      }
      if (opts.route) Object.assign(spec, opts.route(n, to, p, q) || {});
      items.push(spec);
    }
    return items;
  };

  /**
   * Pointer tags. list: [{name, addr, cls, side, text}]; addr 0 goes to the NULL spot at opts.nullAt {x, y}
   * (top-left of where a node would be). Undefined addrs are left out.
   */
  L.tags = function (pos, list, opts) {
    opts = opts || {};
    const items = [];
    const slots = new Map();
    let spot = false;
    for (const c of list) {
      if (c.addr === undefined || c.addr === null) continue;
      const side = c.side || opts.side || 'below';
      let at;
      if (c.addr && pos.has(c.addr)) at = 'n' + c.addr;
      else if (!c.addr && opts.nullAt) {
        at = 'sllb-null';
        if (!spot) {
          spot = true;
          items.push({ key: 'sllb-null', kind: 'region', x: opts.nullAt.x + 10, y: opts.nullAt.y + 6, w: 56, h: L.H - 12, cls: 'sb-nullspot' });
          items.push({ key: 'sllb-nulltxt', kind: 'text', x: opts.nullAt.x + 38, y: opts.nullAt.y + L.H / 2 + 5, text: 'NULL', cls: 'sb-null', anchor: 'middle' });
        }
      } else continue;
      const sk = at + side;
      const s = slots.get(sk) || 0;
      slots.set(sk, s + 1);
      items.push({ key: 'c' + c.name, kind: 'cursor', at, side, slot: s, text: c.text || c.name, cls: c.cls || K.cursorCls(c.name) });
    }
    return items;
  };

  /** A hop: a curved arrow over (or under) the row from one box to another, for a pointer that jumps */
  L.hop = function (key, fromKey, toKey, opts) {
    opts = opts || {};
    return { key, kind: 'arrow', from: { key: fromKey, side: opts.below ? 'bottom' : 'top' }, to: { key: toKey, side: opts.below ? 'bottom' : 'top' }, bend: opts.below ? 34 : -(opts.height || 44), cls: 'sb-hop ' + (opts.cls || ''), label: opts.label || '' };
  };

  /** A bracket under (or over) a stretch of the picture: from x1 to x2 at height y, with a label */
  L.bracket = function (key, x1, x2, y, text, cls, up) {
    const t = up ? 8 : -8;
    return [
      { key: key + '-h', kind: 'line', x1, y1: y, x2, y2: y, cls: 'sb-bracket ' + (cls || '') },
      { key: key + '-l', kind: 'line', x1, y1: y, x2: x1, y2: y + t, cls: 'sb-bracket ' + (cls || '') },
      { key: key + '-r', kind: 'line', x1: x2, y1: y, x2, y2: y + t, cls: 'sb-bracket ' + (cls || '') },
      { key: key + '-t', kind: 'text', x: (x1 + x2) / 2, y: up ? y - 8 : y + 18, text, cls: 'sb-bracket ' + (cls || ''), anchor: 'middle' },
    ];
  };

  /** A pointer variable drawn as a small box with an arrow to its node (side: where the arrow lands) */
  L.rootBox = function (name, addr, x, y, opts) {
    opts = opts || {};
    const cls = opts.cls || K.cursorCls(name);
    const items = [{ key: 'r' + name, kind: 'node', x, y, w: 70, h: 34, cells: [{ text: addr ? '' : 'NULL', port: 'p', cls: 'link' + (addr ? '' : ' null') + (opts.hot ? ' hot' : '') }], label: opts.label || name, cls: 'root ' + cls }];
    if (addr) items.push({ key: 'ra' + name, kind: 'arrow', from: { key: 'r' + name, port: 'p' }, to: { key: 'n' + addr, side: opts.side || 'left' }, cls: 'root-arrow ' + cls + (opts.hot ? ' hot' : '') });
    return items;
  };

  /** The value of a node, or NULL */
  L.nm = (d, a) => K.name(d, a);
  /** Values along a chain, joined with arrows */
  L.seq = (d, start) => K.chain(d, start).order.map((a) => K.name(d, a)).join(' → ');
  L.plural = (n, w, ws) => n + ' ' + (n === 1 ? w : (ws || w + 's'));
})(SEE);
