// Drawing doubly linked, circular and sentinel lists. A row of nodes where next arrows arch above and
// prev arrows arch below, and a ring where the nodes sit on a circle (next arrows outside, prev arrows
// inside), so the wrap-around link is as visible as any other. Small panels too: an output tape and a
// checklist of the pointers an operation must set.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, K = X.ListKit;
  const D = X.DListKit = {};

  D.W = 116; D.H = 44; D.STEP = 180;

  /** Capture: nodes with data and links, the named roots and cursors (newest frame), and extras */
  D.capture = (opts) => (P) => K.capture(P, { type: opts.type || 'head', roots: opts.roots || ['head'], cursors: opts.cursors || [], fields: ['data'], links: opts.links || ['next', 'prev'], extra: opts.extra });

  D.byAddr = (d) => new Map(d.nodes.map((n) => [n.addr, n]));
  D.name = (d, a) => (a ? K.name(d, a) : 'NULL');
  /** The values of a chain, joined with arrows */
  D.read = (d, start, link, sep) => {
    const ch = K.chain(d, start, link || 'next');
    return ch.order.length ? ch.order.map((a) => K.name(d, a)).join(sep || ' ⇄ ') : 'empty';
  };

  /** Nodes that were there when the function was entered (the rest are new) */
  D.original = (ctx) => {
    if (!ctx.memo.orig) ctx.memo.orig = new Set(ctx.ticks[0].data.nodes.map((n) => n.addr));
    return ctx.memo.orig;
  };

  // ---- a row --------------------------------------------------------------------------------------------
  /**
   * opts: start (address of the first node), links (['next', 'prev'] or ['next']), fixed (nodes keep the
   *   slot they first had), roots: {name: {x, y}} variable boxes, cursors: [names], nodeCls(n), arrowCls(n, l),
   *   place(n, pos) -> {x, y} for a node off the row, sentinel (address drawn as the dummy), written,
   *   lift: y offset of new nodes (above), drop: y offset of unlinked old nodes (below)
   * Returns {items, pos, order}
   */
  D.row = function (ctx, d, opts) {
    opts = opts || {};
    const links = opts.links || ['next', 'prev'];
    const two = links.includes('prev');
    const W = opts.w || (two ? D.W : K.NODE_W), H = D.H;
    const step = W + (opts.gap || (two ? 64 : 60));
    const orig = D.original(ctx);
    const pos = new Map();
    const order = K.chain(d, opts.start, 'next').order.filter((a) => !d.nodes.find((n) => n.addr === a).freed);
    if (opts.fixed) {
      const m = ctx.memo.rowSlots || (ctx.memo.rowSlots = new Map());
      if (!m.size) order.forEach((a, i) => m.set(a, i));
      for (const a of order) if (!m.has(a)) m.set(a, m.size);
      for (const a of order) pos.set(a, { x: m.get(a) * step, y: 0 });
      // still: every node keeps its place on the row, linked or not (reversal)
      if (opts.still) for (const n of d.nodes) if (m.has(n.addr) && !n.freed) pos.set(n.addr, { x: m.get(n.addr) * step, y: 0 });
    } else order.forEach((a, i) => pos.set(a, { x: i * step, y: 0 }));
    const lastX = pos.size ? Math.max(...[...pos.values()].map((q) => q.x)) : -step;
    // nodes off the row: new ones hover above the gap they are heading for, old ones drop below
    const slots = ctx.memo.rowSlots;
    for (const n of d.nodes) {
      if (pos.has(n.addr)) continue;
      let p = opts.place ? opts.place(n, pos) : null;
      if (!p) {
        const isNew = !orig.has(n.addr);
        const y = isNew ? -(opts.lift || 128) : (opts.drop || 120) + (n.freed ? 20 : 0);
        let x;
        if (slots && slots.has(n.addr)) x = slots.get(n.addr) * step;
        else if (n.links.next && pos.has(n.links.next)) x = pos.get(n.links.next).x - step / 2;
        else if (n.links.prev && pos.has(n.links.prev)) x = pos.get(n.links.prev).x + step / 2;
        else x = isNew ? lastX + step / 2 : lastX + step;
        p = { x, y };
      }
      pos.set(n.addr, p);
    }
    const items = [];
    const prevData = ctx.prev && ctx.prev.data;
    const prevLinks = new Map();
    if (prevData && prevData.nodes) for (const n of prevData.nodes) prevLinks.set(n.addr, n.links);
    const written = opts.written || K.written(ctx, d);
    for (const n of d.nodes) {
      const p = pos.get(n.addr);
      const sent = n.addr === opts.sentinel;
      const cells = K.cells(n, { links, hotCells: written.get(n.addr) });
      if (sent) cells.find((c) => c.cls.startsWith('val')).text = '—';
      items.push({
        key: 'n' + n.addr, kind: 'node', x: p.x, y: p.y, w: W, h: H, cells,
        cls: (n.freed ? 'freed' : '') + (sent ? ' sentinel' : '') + (opts.nodeCls ? ' ' + (opts.nodeCls(n) || '') : ''),
        enter: orig.has(n.addr) ? 'fade' : 'drop', exit: 'fall', label: sent ? 'dummy' : '', pick: !sent, title: 'node at ' + X.hex(n.addr),
      });
      if (n.freed) continue;
      for (const l of links) {
        const to = n.links[l];
        if (!to || !pos.has(to)) continue;
        const tp = pos.get(to);
        const changed = prevLinks.has(n.addr) && prevLinks.get(n.addr)[l] !== to;
        const cls = 'link-' + l + (l === 'prev' ? ' alt' : '') + (changed ? ' hot' : '') + (opts.arrowCls ? ' ' + (opts.arrowCls(n, l) || '') : '');
        const a = { key: 'a' + n.addr + l, kind: 'arrow', from: { key: 'n' + n.addr, port: l }, cls };
        const same = Math.abs(tp.y - p.y) < 1;
        if (to === n.addr) Object.assign(a, l === 'prev' ? { to: { key: 'n' + to, side: 'right' }, loop: -64 } : { to: { key: 'n' + to, side: 'left' }, loop: 64 });
        else if (!two) Object.assign(a, same && tp.x > p.x ? { to: { key: 'n' + to, side: 'left' } } : same ? { to: { key: 'n' + to, side: 'bottom' }, loop: 70 } : { to: { key: 'n' + to } });
        else if (!same) Object.assign(a, { to: { key: 'n' + to }, bend: l === 'prev' ? 14 : -14 });
        else if (l === 'next') Object.assign(a, tp.x > p.x ? { to: { key: 'n' + to, side: 'topleft' }, bend: -18 } : { to: { key: 'n' + to, side: 'top' }, bend: 52 });
        else Object.assign(a, tp.x < p.x ? { to: { key: 'n' + to, side: 'bottom' }, bend: -24 } : { to: { key: 'n' + to, side: 'bottomleft' }, bend: 46 });
        items.push(a);
      }
    }
    // variable boxes with arrows (head, tail...)
    for (const [r, rp] of Object.entries(opts.roots || {})) {
      if (!(r in d.roots)) continue;
      const v = d.roots[r];
      const prevV = prevData && prevData.roots ? prevData.roots[r] : v;
      const hot = prevV !== v ? ' hot' : '';
      items.push({ key: 'r' + r, kind: 'node', x: rp.x, y: rp.y, w: 70, h: 34, cells: [{ text: v === undefined ? '?' : v ? '' : 'NULL', port: 'p', cls: 'link' + (v ? '' : ' null') + hot }], label: rp.label || r, cls: 'root ' + K.cursorCls(r) });
      if (v && pos.has(v)) items.push({ key: 'ra' + r, kind: 'arrow', from: { key: 'r' + r, port: 'p' }, to: { key: 'n' + v, side: rp.side }, cls: 'root-arrow ' + K.cursorCls(r) + hot });
    }
    // cursors: tags under their nodes, below the prev arcs; NULL ones wait past the end
    const used = new Map();
    let nullSpot = false;
    for (const c of opts.cursors || []) {
      if (!(c in d.cursors) || d.cursors[c] === undefined) continue;
      const v = d.cursors[c];
      if (v && pos.has(v)) {
        const s = used.get(v) || 0;
        used.set(v, s + 1);
        items.push({ key: 'c' + c, kind: 'cursor', at: 'n' + v, side: 'below', slot: s + (two ? 1 : 0), text: c, cls: K.cursorCls(c) });
      } else if (!v) {
        if (!nullSpot) {
          nullSpot = true;
          items.push({ key: 'nulspot', kind: 'region', x: lastX + W + 34, y: 4, w: 52, h: H - 8, cls: 'null-spot' });
          items.push({ key: 'nul', kind: 'text', x: lastX + W + 60, y: H / 2 + 5, text: 'NULL', cls: 'null-mark', anchor: 'middle' });
        }
        const s = used.get(0) || 0;
        used.set(0, s + 1);
        items.push({ key: 'c' + c, kind: 'cursor', at: 'nulspot', side: 'below', slot: s + (two ? 1 : 0), text: c, cls: K.cursorCls(c) });
      }
    }
    return { items, pos, order, step, W };
  };

  // ---- a ring -------------------------------------------------------------------------------------------
  D.RW = 66;
  /**
   * The nodes of a circular list on a circle, in next order, clockwise from the top. The order is anchored:
   * the first node seen keeps the top while it is in the ring, so an insertion opens a gap rather than
   * turning the whole ring.
   * opts: start (a node in the ring), links, roots: [names] (boxes at the centre), cursors, marks:
   *   [{at, text, cls}] extra tags, nodeCls(n), arrowCls(n, l), radius
   * Returns {items, pos, ring, R, angle(addr)}
   */
  D.ring = function (ctx, d, opts) {
    opts = opts || {};
    const links = opts.links || ['next'];
    const two = links.includes('prev');
    const by = D.byAddr(d);
    // the cycle through start
    let ring = [];
    if (opts.start && by.has(opts.start)) {
      const seen = new Map();
      let p = opts.start, k = 0;
      while (p && by.has(p) && !seen.has(p) && !by.get(p).freed) { seen.set(p, k++); ring.push(p); p = by.get(p).links.next; }
      ring = p && seen.has(p) ? ring.slice(seen.get(p)) : [];
    }
    const memo = ctx.memo;
    memo.ringSeen = memo.ringSeen || [];
    const first = memo.ringSeen.find((a) => ring.includes(a));
    if (first) { const i = ring.indexOf(first); ring = ring.slice(i).concat(ring.slice(0, i)); }
    for (const a of ring) if (!memo.ringSeen.includes(a)) memo.ringSeen.push(a);
    // keep: a node just unlinked keeps its slot (pushed outward) until the topic lets it go
    let slots = ring;
    if (opts.keep && by.has(opts.keep) && !ring.includes(opts.keep) && memo.ringSeen.includes(opts.keep)) slots = memo.ringSeen.filter((a) => ring.includes(a) || a === opts.keep);
    const n = slots.length;
    const RW = D.RW, H = D.H;
    const R = opts.radius || Math.max(two ? 150 : 135, n * (RW + (two ? 92 : 80)) / (2 * Math.PI));
    const angOf = (i, cnt) => -Math.PI / 2 + 2 * Math.PI * i / Math.max(1, cnt);
    const at = (ang, r) => ({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
    const pos = new Map(), ang = new Map();
    slots.forEach((a, i) => { const t = angOf(i, n); ang.set(a, t); if (!ring.includes(a)) return; const c = at(t, R); pos.set(a, { x: c.x - RW / 2, y: c.y - H / 2 }); });
    // off the ring: a new node waits outside the gap it will go into; an unlinked one is pushed outward
    memo.ringAng = memo.ringAng || new Map();
    for (const [a, t] of ang) if (ring.includes(a)) memo.ringAng.set(a, t);
    for (const nd of d.nodes) {
      if (pos.has(nd.addr)) continue;
      let t;
      if (ang.has(nd.addr)) t = ang.get(nd.addr);
      else if (memo.ringAng.has(nd.addr)) t = memo.ringAng.get(nd.addr);
      else if (nd.links.next && ang.has(nd.links.next)) t = ang.get(nd.links.next) - Math.PI / Math.max(2, n);
      else t = -Math.PI / 2 - Math.PI / Math.max(2, n);
      const c = at(t, R + (nd.freed ? 130 : 110));
      ang.set(nd.addr, t);
      pos.set(nd.addr, { x: c.x - RW / 2, y: c.y - H / 2 });
    }
    const items = [];
    if (n > 1) items.push({ key: 'ringline', kind: 'ring', x: 0, y: 0, r: R });
    const prevData = ctx.prev && ctx.prev.data;
    const prevLinks = new Map();
    if (prevData && prevData.nodes) for (const m of prevData.nodes) prevLinks.set(m.addr, m.links);
    const orig = D.original(ctx);
    const side = (from, to) => {
      const dx = to.x - from.x, dy = to.y - from.y;
      return Math.abs(dx) * H > Math.abs(dy) * RW ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
    };
    for (const nd of d.nodes) {
      const p = pos.get(nd.addr);
      items.push({
        key: 'n' + nd.addr, kind: 'node', x: p.x, y: p.y, w: RW, h: H, cells: [{ text: nd.data, cls: 'val' }],
        cls: (nd.freed ? 'freed' : '') + (ring.includes(nd.addr) ? '' : ' off-ring') + (opts.nodeCls ? ' ' + (opts.nodeCls(nd) || '') : ''),
        enter: orig.has(nd.addr) ? 'fade' : 'drop', exit: 'fall', pick: true, title: 'node at ' + X.hex(nd.addr),
      });
      if (nd.freed) continue;
      for (const l of links) {
        const to = nd.links[l];
        if (!to || !pos.has(to)) continue;
        const changed = prevLinks.has(nd.addr) && prevLinks.get(nd.addr)[l] !== to;
        const cls = 'link-' + l + (l === 'prev' ? ' alt' : '') + (changed ? ' hot' : '') + (opts.arrowCls ? ' ' + (opts.arrowCls(nd, l) || '') : '');
        const a = { key: 'a' + nd.addr + l, kind: 'arrow', cls };
        if (to === nd.addr) {
          Object.assign(a, l === 'next' ? { from: { key: 'n' + nd.addr, side: 'right' }, to: { key: 'n' + to, side: 'left' }, loop: -70 } : { from: { key: 'n' + nd.addr, side: 'left' }, to: { key: 'n' + to, side: 'right' }, loop: 70 });
        } else {
          const tp = pos.get(to);
          const c1 = { x: p.x + RW / 2, y: p.y + H / 2 }, c2 = { x: tp.x + RW / 2, y: tp.y + H / 2 };
          // next bows outward and prev inward; with two nodes the two directions share a chord, so bow more
          let bend = l === 'next' ? -22 : -22;
          if (ring.length === 2 && ring.includes(to)) bend = l === 'next' ? -70 : -26;
          // a link that jumps over a slot (a node being unlinked) bows out round the gap
          const si = slots.indexOf(nd.addr), ti = slots.indexOf(to);
          const len = Math.hypot(c2.x - c1.x, c2.y - c1.y);
          if (si >= 0 && ti >= 0 && n > 2 && Math.abs(si - ti) !== 1 && Math.abs(si - ti) !== n - 1) bend = l === 'next' ? -0.42 * len : 0.28 * len;
          Object.assign(a, { from: { key: 'n' + nd.addr, side: side(c1, c2) }, to: { key: 'n' + to, side: side(c2, c1) }, bend });
        }
        items.push(a);
      }
    }
    // pointer variables: boxes at the centre of the ring
    const roots = (opts.roots || []).filter((r) => r in d.roots);
    roots.forEach((r, i) => {
      const v = d.roots[r];
      const prevV = prevData && prevData.roots ? prevData.roots[r] : v;
      const hot = prevV !== v ? ' hot' : '';
      const y = (i - (roots.length - 1) / 2) * 62 - 17;
      items.push({ key: 'r' + r, kind: 'node', x: -35, y, w: 70, h: 34, cells: [{ text: v === undefined ? '?' : v ? '' : 'NULL', port: 'p', cls: 'link' + (v ? '' : ' null') + hot }], label: r, cls: 'root ' + K.cursorCls(r) });
      if (v && pos.has(v)) items.push({ key: 'ra' + r, kind: 'arrow', from: { key: 'r' + r, port: 'p' }, to: { key: 'n' + v }, cls: 'root-arrow ' + K.cursorCls(r) + hot });
    });
    // cursors and marks: tags on the outside of their node
    const used = new Map();
    const tags = [];
    for (const c of opts.cursors || []) if (c in d.cursors && d.cursors[c]) tags.push({ key: 'c' + c, at: d.cursors[c], text: c, cls: K.cursorCls(c) });
    for (const m of opts.marks || []) if (m.at) tags.push({ key: 'm' + m.key, at: m.at, text: m.text, cls: m.cls || 'c-gray' });
    for (const tg of tags) {
      if (!pos.has(tg.at)) continue;
      const t = ang.get(tg.at);
      const s = used.get(tg.at) || 0;
      used.set(tg.at, s + 1);
      const sd = ring.length === 1 && ring.includes(tg.at) ? 'right' : Math.sin(t) < -0.5 ? 'above' : Math.sin(t) > 0.5 ? 'below' : Math.cos(t) > 0 ? 'right' : 'left';
      items.push({ key: tg.key, kind: 'cursor', at: 'n' + tg.at, side: sd, slot: s, text: tg.text, cls: tg.cls });
    }
    return { items, pos, ring, R, ang };
  };

  // ---- panels -------------------------------------------------------------------------------------------
  /** A strip of cells: what has been printed so far */
  D.tape = function (key, values, x, y, opts) {
    opts = opts || {};
    const items = [{ key: key + 'T', kind: 'text', x, y: y - 12, text: opts.title || 'printed', cls: 'title' }];
    values.forEach((v, i) => items.push({ key: key + i, kind: 'cell', x: x + i * 50, y, w: 44, h: 40, text: v, sub: '', cls: i === values.length - 1 && opts.fresh ? 'hot' : 'part-a', enter: opts.from ? 'fly' : 'grow', from: opts.from }));
    return items;
  };

  /** A checklist of steps: [{text, state: 'todo' | 'now' | 'done' | 'skip'}] */
  D.checklist = function (key, x, y, title, rows) {
    const items = [{ key: key + 'T', kind: 'text', x, y, text: title, cls: 'title' }];
    rows.forEach((r, i) => {
      const mark = r.state === 'done' ? '✓' : r.state === 'now' ? '▶' : r.state === 'skip' ? '–' : '○';
      items.push({ key: key + i, kind: 'text', x, y: y + 28 + i * 26, text: mark + '  ' + r.text, cls: 'ck ' + (r.state === 'done' ? 'good' : r.state === 'now' ? 'hot' : 'check-todo') });
    });
    return items;
  };
})(SEE);
