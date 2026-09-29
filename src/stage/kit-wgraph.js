// Weighted graphs: shortest paths and spanning trees. Builds on the graph kit with what these topics
// need: INF shown as ∞, distance badges that sit outside the drawing, a vertical table per vertex,
// a matrix grid, an edge list and a small union-find forest.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, G = X.GraphKit;
  const W = X.WGraphKit = {};
  W.INF = 1000000;

  /** A distance as the student should read it */
  W.fmt = (v) => (v === null || v === undefined ? '?' : v >= W.INF / 2 ? '∞' : String(v));
  W.isInf = (v) => v === null || v === undefined || v >= W.INF / 2;

  /** Vertex positions: the preset's when they match n, otherwise a circle */
  W.positions = (inp) => G.positions(inp.n, inp.pos && inp.pos.length === inp.n ? inp.pos : null, { radius: Math.max(170, inp.n * 30) });

  /** The box around the vertices */
  W.box = (pos) => {
    const xs = pos.map((p) => p.x), ys = pos.map((p) => p.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };

  /** The key G.picture gives an edge */
  W.edgeKey = (u, v, directed, prefix) => (prefix || 'g') + 'e' + (directed ? u + '>' + v : Math.min(u, v) + '-' + Math.max(u, v));

  /** A weighted graph: big weight labels, our own edge class */
  W.graph = (opts) => {
    const items = G.picture(Object.assign({ weighted: true, r: 26 }, opts, {
      ecls: (u, v, w) => 'wg ' + (opts.ecls ? opts.ecls(u, v, w) || '' : ''),
    }));
    // two edges crossing at their middles would print their weights on top of each other: bend one
    const P = opts.prefix || 'g', mids = [];
    for (const it of items) {
      if (it.kind !== 'arrow' || it.bend) continue;
      const a = opts.pos[+it.from.key.slice(P.length + 1)], b = opts.pos[+it.to.key.slice(P.length + 1)];
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (mids.some((q) => Math.hypot(q.x - m.x, q.y - m.y) < 44)) it.bend = 48;
      else mids.push(m);
    }
    return items;
  };

  /** Where a badge for vertex v goes: away from the middle of the drawing, so edges do not run under it */
  W.outward = (pos, v, d) => {
    const c = pos.reduce((a, p) => ({ x: a.x + p.x / pos.length, y: a.y + p.y / pos.length }), { x: 0, y: 0 });
    let dx = pos[v].x - c.x, dy = pos[v].y - c.y;
    const l = Math.hypot(dx, dy);
    if (l < 30) { dx = 0; dy = -1; } else { dx /= l; dy /= l; }
    // mostly up or down: badges read best above or below a circle
    if (Math.abs(dy) < 0.35) dy = dy < 0 ? -0.35 : 0.35;
    const k = Math.hypot(dx, dy);
    return { x: pos[v].x + dx / k * d, y: pos[v].y + dy / k * d };
  };

  /** The side of vertex v away from its badge, for a cursor */
  W.freeSide = (pos, v) => (W.outward(pos, v, 50).y > pos[v].y ? 'above' : 'below');

  /** A badge (a small box with a value) for each vertex. text(v) -> string or '' for none; cls(v) -> classes */
  W.badges = (prefix, pos, text, cls, opts) => {
    opts = opts || {};
    const items = [];
    pos.forEach((p, v) => {
      const t = text(v);
      if (t === '' || t === null || t === undefined) return;
      const s = String(t);
      const w = Math.max(38, s.length * 11 + 16), h = 28;
      const at = W.outward(pos, v, opts.dist || 50);
      items.push({ key: prefix + v, kind: 'node', x: at.x - w / 2, y: at.y - h / 2, w, h, cells: [{ text: s }], cls: 'gb-badge ' + (cls ? cls(v) || '' : ''), flash: opts.flash ? opts.flash(v) : false, enter: 'fade' });
    });
    return items;
  };

  /**
   * A vertical table: one row per vertex, one column per array.
   * cols: [{title, value(v) -> text, cls(v) -> classes}], opts: {x0, y0, cw, ch, rowCls(v)}
   */
  W.table = (key, n, cols, opts) => {
    opts = opts || {};
    const items = [];
    const x0 = opts.x0 || 0, y0 = opts.y0 || 0, cw = opts.cw || 58, ch = opts.ch || 34;
    items.push({ key: key + 'hv', kind: 'text', x: x0 + 14, y: y0 - 10, text: 'v', cls: 'gb-head', anchor: 'middle' });
    cols.forEach((c, j) => items.push({ key: key + 'h' + j, kind: 'text', x: x0 + 34 + j * (cw + 4) + cw / 2, y: y0 - 10, text: c.title, cls: 'gb-head', anchor: 'middle' }));
    for (let v = 0; v < n; v++) {
      const y = y0 + v * (ch + 4);
      items.push({ key: key + 'r' + v, kind: 'text', x: x0 + 14, y: y + ch / 2 + 6, text: String(v), cls: 'gb-rowh' + (opts.rowCls ? ' ' + (opts.rowCls(v) || '') : ''), anchor: 'middle' });
      cols.forEach((c, j) => {
        items.push({ key: key + 'c' + j + '_' + v, kind: 'cell', x: x0 + 34 + j * (cw + 4), y, w: cw, h: ch, text: c.value(v), sub: '', cls: 'gb-tcell ' + (c.cls ? c.cls(v) || '' : ''), flash: c.flash ? c.flash(v) : false });
      });
    }
    return items;
  };

  /** Read a two-dimensional int array (a global or local) as rows */
  W.matrix = (P, name, n) => {
    const f = P.find(name);
    if (!f) return null;
    const T = SEE.Types;
    const t = T.unqual(f.type);
    if (t.k !== 'array') return null;
    const row = T.unqual(t.of), et = T.unqual(row.of);
    const rs = T.sizeof(row), es = T.sizeof(et);
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = [];
      for (let j = 0; j < n; j++) r.push(P.read(et, f.addr + i * rs + j * es));
      out.push(r);
    }
    return out;
  };

  /**
   * Layout of a union-find forest from parent[]: roots side by side, children under their parent.
   * Returns {pos: [{x, y}], depth: [], roots: []}. opts: {x0, y0, dx, dy}
   */
  W.forestLayout = (parent, opts) => {
    opts = opts || {};
    const n = parent.length, dx = opts.dx || 64, dy = opts.dy || 78;
    const kids = Array.from({ length: n }, () => []);
    const roots = [];
    for (let v = 0; v < n; v++) {
      const p = parent[v];
      if (p === null || p === undefined || p === v || p < 0 || p >= n) roots.push(v);
      else kids[p].push(v);
    }
    const pos = new Array(n), depth = new Array(n).fill(0);
    let slot = 0;
    const seen = new Set();
    const place = (v, d) => {
      if (seen.has(v)) return pos[v] ? pos[v].x : 0;
      seen.add(v);
      depth[v] = d;
      let x;
      if (!kids[v].length) x = slot++ * dx;
      else {
        const xs = kids[v].map((c) => place(c, d + 1));
        x = (Math.min(...xs) + Math.max(...xs)) / 2;
      }
      pos[v] = { x, y: d * dy };
      return x;
    };
    for (const r of roots) { place(r, 0); slot += 0.35; }
    // anything not reached (a cycle in parent[], which a correct program never makes) goes last
    for (let v = 0; v < n; v++) if (!pos[v]) { pos[v] = { x: slot++ * dx, y: 0 }; roots.push(v); }
    const w = Math.max(0, ...pos.map((p) => p.x));
    const x0 = (opts.x0 || 0) - (opts.center ? w / 2 : 0), y0 = opts.y0 || 0;
    return { pos: pos.map((p) => ({ x: p.x + x0, y: p.y + y0 })), depth, roots, width: w };
  };

  /** A vertex class for the set a vertex belongs to: one colour per root */
  W.setCls = (root) => 'uf-' + (root % 8);

  /** The root of v in parent[] (for drawing, not the C code) */
  W.rootOf = (parent, v) => {
    let x = v, k = 0;
    while (parent[x] !== x && parent[x] !== null && parent[x] !== undefined && k++ < 50) x = parent[x];
    return x;
  };
})(SEE);
