// Drawing linked lists: nodes as boxes split into fields, the links as arrows, the program's pointer
// variables as coloured tags (curr, prev, next...) or as boxes with arrows (head, tail). Topics use these
// pieces and add their own touches.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const K = X.ListKit = {};

  K.NODE_W = 104; K.NODE_H = 44; K.GAP = 66; K.ROW = 150;
  // each cursor name keeps its colour everywhere
  const CURSOR_CLS = {
    curr: 'c-teal', cur: 'c-teal', p: 'c-teal', q: 'c-amber', prev: 'c-violet', next: 'c-amber', nxt: 'c-amber', temp: 'c-green', tmp: 'c-green',
    n: 'c-green', node: 'c-green', newnode: 'c-green', fresh: 'c-green', slow: 'c-teal', fast: 'c-rose', tortoise: 'c-teal', hare: 'c-rose',
    head: 'c-indigo', tail: 'c-indigo', last: 'c-amber', first: 'c-indigo', second: 'c-violet', a: 'c-teal', b: 'c-amber', mid: 'c-rose',
    victim: 'c-rose', del: 'c-rose', dup: 'c-rose', runner: 'c-amber', start: 'c-indigo', end: 'c-violet', front: 'c-indigo', rear: 'c-violet',
    top: 'c-indigo', l1: 'c-teal', l2: 'c-amber', result: 'c-indigo', dummy: 'c-gray', pp: 'c-violet', link: 'c-violet',
    i: 'c-teal', j: 'c-amber', k: 'c-violet', lo: 'c-indigo', hi: 'c-violet', low: 'c-indigo', high: 'c-violet', min: 'c-rose', max: 'c-rose', key: 'c-green',
    left: 'c-teal', right: 'c-amber', l: 'c-teal', r: 'c-amber', gap: 'c-gray', pos: 'c-green', u: 'c-teal', v: 'c-amber', w: 'c-violet', src: 'c-indigo', s: 'c-indigo', t: 'c-violet',
    parent: 'c-violet', child: 'c-amber', root: 'c-indigo', x: 'c-teal', y: 'c-amber', z: 'c-violet', h: 'c-rose', idx: 'c-teal', write: 'c-green', read: 'c-teal', win: 'c-amber',
  };
  K.cursorCls = (name) => CURSOR_CLS[name] || 'c-gray';

  /**
   * Capture a list program's state.
   * opts: {type: a pointer variable whose pointee is the node type, roots: names drawn as boxes (head, tail),
   *        cursors: names drawn as tags, fields: [field names to show], links: ['next'] or ['next', 'prev'],
   *        extra: (P) -> anything else}
   */
  K.capture = function (P, opts) {
    let t = null;
    for (const n of [].concat(opts.type || [], opts.roots || [], opts.cursors || [])) { t = P.pointee(n); if (t) break; }
    const out = { nodes: [], roots: {}, cursors: {}, ptrNull: {} };
    if (opts.extra) out.extra = opts.extra(P);
    for (const n of opts.roots || []) { if (P.has(n)) out.roots[n] = P.isSet(n) ? P.val(n) : undefined; }
    for (const n of opts.cursors || []) { if (P.has(n, 0) || (opts.anyFrame && P.has(n))) out.cursors[n] = P.isSet(n, opts.anyFrame ? undefined : 0) ? P.val(n, opts.anyFrame ? undefined : 0) : undefined; }
    if (!t) return out;
    // where each field sits in a node, so the picture can light up the field a line wrote
    const d = SEE.Types.def(SEE.Types.unqual(t));
    out.layout = { size: d.size, fields: {} };
    for (const m of d.members || []) if (m.name) out.layout.fields[m.name] = { off: m.offset, size: SEE.Types.sizeof(m.type) };
    const links = opts.links || ['next'];
    // every node block on the heap (reachable or not), plus freed ones something still points at
    const starts = P.blocksOf(t);
    const ptrs = Object.values(out.roots).concat(Object.values(out.cursors)).filter((x) => x);
    for (const p of ptrs) if (!starts.includes(p) && P.freed(p)) starts.push(p);
    const w = P.walk(starts, t, links, 300);
    for (const a of w.order) {
      const n = w.nodes.get(a);
      const node = { addr: a, freed: n.freed, links: n.links };
      for (const f of opts.fields || ['data']) node[f] = n[f];
      out.nodes.push(node);
    }
    return out;
  };

  /** The order of a chain from a start address, following one link (stops on a repeat) */
  K.chain = function (data, start, link) {
    const by = new Map(data.nodes.map((n) => [n.addr, n]));
    const out = [];
    const seen = new Set();
    let p = start;
    while (p && by.has(p) && !seen.has(p)) { seen.add(p); out.push(p); p = by.get(p).links[link || 'next']; }
    return { order: out, cycleTo: p && seen.has(p) ? p : 0, end: p };
  };

  /**
   * Positions of nodes. mode 'chain': in list order from the first root at every tick (insertions push
   * the rest along); mode 'fixed': each node keeps the place it first had (good for reversal, where the
   * links change but the nodes should stay still). Nodes nothing reaches go on a row below.
   */
  K.layout = function (ctx, data, opts) {
    opts = opts || {};
    const root = opts.root || 'head';
    const link = opts.link || 'next';
    const x0 = opts.x0 || 0, y0 = opts.y0 || 0;
    const step = K.NODE_W + K.GAP;
    const pos = new Map();
    const memo = ctx.memo;
    const key = 'pos:' + (opts.id || 'list');
    if (opts.mode === 'fixed') {
      if (!memo[key]) memo[key] = { map: new Map(), next: 0 };
      const m = memo[key];
      if (!m.map.size) {
        // first picture: the chain order (from the root, or the given start)
        const start = opts.start !== undefined ? opts.start : data.roots[root];
        for (const a of K.chain(data, start, link).order) m.map.set(a, m.next++);
      }
      for (const n of data.nodes) if (!m.map.has(n.addr)) m.map.set(n.addr, m.next++);
      for (const n of data.nodes) { const i = m.map.get(n.addr); pos.set(n.addr, { x: x0 + i * step, y: y0 }); }
      return pos;
    }
    const start = opts.start !== undefined ? opts.start : data.roots[root];
    const ch = K.chain(data, start, link);
    ch.order.forEach((a, i) => pos.set(a, { x: x0 + i * step, y: y0 }));
    // the rest: new nodes not linked in yet sit above where they will go; freed or lost ones below
    let k = 0;
    for (const n of data.nodes) {
      if (pos.has(n.addr)) continue;
      // a node pointing into the chain hovers above its successor
      const succ = n.links[link];
      if (!n.freed && succ && pos.has(succ)) { const s = pos.get(succ); pos.set(n.addr, { x: s.x - step / 2, y: y0 - K.ROW * 0.85 }); continue; }
      pos.set(n.addr, { x: x0 + k * step, y: y0 + K.ROW * (n.freed ? 1.1 : 0.95) });
      k++;
    }
    return pos;
  };

  /** Cells of a node: data then links, with port names for the arrows */
  K.cells = function (n, opts) {
    opts = opts || {};
    const fields = opts.fields || ['data'];
    const links = opts.links || ['next'];
    const cells = [];
    const linkCell = (l) => ({ text: n.links[l] ? '' : (opts.nullText || 'NULL'), port: l, w: 0.75, cls: 'link' + (n.links[l] ? '' : ' null') + (opts.hotCells && opts.hotCells.has(l) ? ' hot' : '') });
    if (links.includes('prev')) cells.push(linkCell('prev'));
    for (const f of fields) cells.push({ text: n[f], w: 1, cls: 'val' + (opts.hotCells && opts.hotCells.has(f) ? ' hot' : '') });
    for (const l of links) if (l !== 'prev') cells.push(linkCell(l));
    return cells;
  };

  /** Which fields of which nodes a tick wrote: Map(addr -> Set(field)) */
  K.written = function (ctx, data, layoutType) {
    const out = new Map();
    const tk = ctx.tick;
    if (!tk || !tk.events) return out;
    const off = data.layout || { size: 8, fields: {} };
    for (const e of tk.events) {
      if (e.kind !== 'write') continue;
      for (const n of data.nodes) {
        const d = e.addr - n.addr;
        if (d < 0 || d >= (off.size || 8)) continue;
        for (const [f, o] of Object.entries(off.fields || {})) if (d >= o.off && d < o.off + o.size) { if (!out.has(n.addr)) out.set(n.addr, new Set()); out.get(n.addr).add(f); }
      }
    }
    void layoutType;
    return out;
  };
  /**
   * The standard picture of a list at one tick. opts:
   *   roots: names drawn as variable boxes with an arrow (head, tail), placed above the start
   *   cursors: names drawn as tags under the nodes they point at
   *   mode, link, fields, links: as above
   *   nodeCls(n) -> extra classes;  arrowCls(n, link) -> classes for a link;  hideNull
   * Returns {items, pos, chain}
   */
  K.picture = function (ctx, data, opts) {
    opts = opts || {};
    const links = opts.links || ['next'];
    const pos = opts.pos || K.layout(ctx, data, opts);
    const items = [];
    const prevData = ctx.prev && ctx.prev.data;
    const prevLinks = new Map();
    if (prevData && prevData.nodes) for (const n of prevData.nodes) prevLinks.set(n.addr, n.links);
    const written = opts.written || new Map();
    for (const n of data.nodes) {
      const p = pos.get(n.addr);
      if (!p) continue;
      const hot = written.get(n.addr);
      const isNew = prevData && prevData.nodes && !prevData.nodes.some((m) => m.addr === n.addr);
      items.push({
        key: 'n' + n.addr, kind: 'node', x: p.x, y: p.y, w: opts.nodeW || K.NODE_W, h: K.NODE_H, cells: K.cells(n, { fields: opts.fields, links, hotCells: hot, nullText: opts.nullText }),
        cls: (n.freed ? 'freed' : '') + (opts.nodeCls ? ' ' + (opts.nodeCls(n) || '') : ''), enter: isNew ? 'drop' : 'fade', exit: 'fall', exitFall: true,
        label: opts.showAddr ? X.hex(n.addr) : '', title: 'node at ' + X.hex(n.addr), pick: true,
      });
      for (const l of links) {
        const to = n.links[l];
        if (!to || !pos.has(to)) continue;
        const changed = prevLinks.has(n.addr) && prevLinks.get(n.addr)[l] !== to;
        const tp = pos.get(to);
        const back = tp.x < p.x - 1 && Math.abs(tp.y - p.y) < 1;
        const self = to === n.addr;
        items.push({
          key: 'a' + n.addr + l, kind: 'arrow', from: { key: 'n' + n.addr, port: l }, to: { key: 'n' + to, side: l === 'prev' ? (back ? 'right' : 'right') : (back ? 'bottom' : (Math.abs(tp.y - p.y) < 1 ? 'left' : undefined)) },
          cls: 'link-' + l + (changed ? ' hot' : '') + (opts.arrowCls ? ' ' + (opts.arrowCls(n, l) || '') : ''),
          bend: l === 'prev' ? -26 : (back ? 0 : (Math.abs(tp.y - p.y) < 1 && tp.x > p.x ? 0 : 0)), loop: back && l !== 'prev' ? 70 : (self ? 70 : 0),
        });
        if (l === 'prev' && Math.abs(tp.y - p.y) < 1) items[items.length - 1].bend = 22;
      }
    }
    // the pointer variables that are roots: boxes above the first node they point to
    const rootNames = opts.roots || Object.keys(data.roots);
    let ri = 0;
    for (const r of rootNames) {
      if (!(r in data.roots)) continue;
      const v = data.roots[r];
      const tp = v && pos.get(v);
      const rp = opts.rootPos && opts.rootPos[r] ? opts.rootPos[r] : { x: (opts.x0 || 0) - 20 + ri * 130, y: (opts.y0 || 0) - 110 };
      const prevV = prevData && prevData.roots ? prevData.roots[r] : v;
      items.push({ key: 'r' + r, kind: 'node', x: rp.x, y: rp.y, w: 70, h: 34, cells: [{ text: v === undefined ? '?' : v ? '' : 'NULL', port: 'p', cls: 'link' + (v ? '' : ' null') + (prevV !== v ? ' hot' : '') }], label: r, cls: 'root ' + K.cursorCls(r) });
      if (tp) items.push({ key: 'ra' + r, kind: 'arrow', from: { key: 'r' + r, port: 'p' }, to: { key: 'n' + v, side: 'top' }, cls: 'root-arrow ' + K.cursorCls(r) + (prevV !== v ? ' hot' : '') });
      ri++;
    }
    // cursors: tags under their nodes; NULL ones wait at the end of the row
    const slots = new Map();
    let nullX = null;
    const lastX = Math.max(opts.x0 || 0, ...[...pos.values()].filter((p) => p.y === (opts.y0 || 0)).map((p) => p.x));
    for (const c of opts.cursors || Object.keys(data.cursors)) {
      if (!(c in data.cursors)) continue;
      const v = data.cursors[c];
      if (v === undefined) continue;
      if (v && pos.has(v)) {
        const s = slots.get(v) || 0;
        slots.set(v, s + 1);
        items.push({ key: 'c' + c, kind: 'cursor', at: 'n' + v, side: opts.cursorSide || 'below', slot: s, text: c, cls: K.cursorCls(c) });
      } else if (!v && !opts.hideNull) {
        const first = nullX === null;
        if (first) nullX = lastX + K.NODE_W + 40;
        const s = slots.get(0) || 0;
        slots.set(0, s + 1);
        if (first) items.push({ key: 'nul', kind: 'text', x: nullX + 10, y: (opts.y0 || 0) + K.NODE_H / 2 + 5, text: 'NULL', cls: 'null-mark', anchor: 'middle' });
        if (first) items.push({ key: 'nulspot', kind: 'region', x: nullX - 16, y: (opts.y0 || 0) + 4, w: 52, h: K.NODE_H - 8, cls: 'null-spot' });
        items.push({ key: 'c' + c, kind: 'cursor', at: 'nulspot', side: opts.cursorSide || 'below', slot: s, text: c, cls: K.cursorCls(c) });
      }
    }
    return { items, pos };
  };

  /** A short readable name for a node: its value */
  K.name = (data, addr, field) => {
    if (!addr) return 'NULL';
    const n = data.nodes.find((x) => x.addr === addr);
    return n ? String(n[field || 'data']) : X.hex(addr);
  };
})(SEE);
