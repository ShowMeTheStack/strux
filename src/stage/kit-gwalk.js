// Helpers for the graph representation, depth-first and ordering topics: reading two-dimensional C
// arrays, a fixed camera around the picture, a stack drawn as a tower, a grid with row and column
// headers, and the input checks for directed and undirected graphs.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const GW = X.GWalk = {};

  /** rows x cols of a two-dimensional int array (global or local), or null */
  GW.mat = function (P, name, rows, cols) {
    const f = P.find(name);
    if (!f) return null;
    const T = SEE.Types;
    const t = T.unqual(f.type);
    if (t.k !== 'array') return null;
    const row = T.unqual(t.of);
    if (row.k !== 'array') return null;
    const et = T.unqual(row.of), es = T.sizeof(et), rs = T.sizeof(row);
    const out = [];
    for (let i = 0; i < rows; i++) {
      const r = [];
      for (let j = 0; j < cols; j++) r.push(P.read(et, f.addr + i * rs + j * es));
      out.push(r);
    }
    return out;
  };
  /** An int array with n elements, nulls where not yet set */
  GW.ints = (P, name, n, fi) => P.arr(name, n, fi) || new Array(n).fill(null);

  /** The key G.picture gives an edge */
  GW.ekey = (u, v, dir, prefix) => (prefix || 'g') + 'e' + (dir ? u + '>' + v : Math.min(u, v) + '-' + Math.max(u, v));

  /** The box around the vertices */
  GW.box = function (pos, r) {
    r = r || 24;
    return { x0: Math.min(...pos.map((p) => p.x)) - r, y0: Math.min(...pos.map((p) => p.y)) - r, x1: Math.max(...pos.map((p) => p.x)) + r, y1: Math.max(...pos.map((p) => p.y)) + r };
  };
  /** A fixed camera: the union of boxes, with a margin, so the picture does not zoom between steps */
  GW.view = function (boxes, m) {
    m = m === undefined ? 40 : m;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const b of boxes) { x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
    return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
  };

  /**
   * A stack drawn as a tower of cells, bottom at y0, growing upwards. values bottom first.
   * opts: {x0, y0, w, h, cls(i, v), text(i, v), ids: stable keys per slot, empty, title}
   */
  GW.tower = function (key, values, opts) {
    opts = opts || {};
    const items = [];
    const x0 = opts.x0 || 0, y0 = opts.y0 || 0, w = opts.w || 60, h = opts.h || 34;
    if (opts.title) items.push({ key: key + 'T', kind: 'text', x: x0 + w / 2, y: y0 + h + 22, text: opts.title, cls: 'title', anchor: 'middle' });
    items.push({ key: key + 'F', kind: 'line', x1: x0 - 8, y1: y0 + h + 4, x2: x0 + w + 8, y2: y0 + h + 4 });
    if (!values.length && opts.empty) items.push({ key: key + 'E', kind: 'text', x: x0 + w / 2, y: y0 + h / 2 + 5, text: opts.empty, cls: 'free-text', anchor: 'middle' });
    values.forEach((v, i) => {
      items.push({
        key: opts.ids ? opts.ids[i] : key + i, kind: 'cell', x: x0, y: y0 - i * (h + 4), w, h,
        text: opts.text ? opts.text(i, v) : v, sub: '', cls: opts.cls ? opts.cls(i, v) || '' : '',
        enter: opts.from ? 'fly' : 'drop', from: opts.from, exit: opts.exit || 'fade',
      });
    });
    return items;
  };

  /**
   * A grid of cells with row and column headers (a matrix). opts: {x0, y0, cell, rows: [labels],
   *   cols: [labels], text(i, j), cls(i, j), rowCls(i), colCls(j), corner}
   * Cell keys: key + 'c' + i + '_' + j; headers key + 'r' + i and key + 'k' + j.
   */
  GW.grid = function (key, opts) {
    const items = [];
    const s = opts.cell || 40, x0 = opts.x0 || 0, y0 = opts.y0 || 0;
    opts.cols.forEach((c, j) => items.push({ key: key + 'k' + j, kind: 'text', x: x0 + j * s + s / 2, y: y0 - 10, text: String(c), cls: 'code-text ' + (opts.colCls ? opts.colCls(j) || '' : ''), anchor: 'middle' }));
    opts.rows.forEach((r, i) => {
      items.push({ key: key + 'r' + i, kind: 'text', x: x0 - 10, y: y0 + i * s + s / 2 + 5, text: String(r), cls: 'code-text ' + (opts.rowCls ? opts.rowCls(i) || '' : ''), anchor: 'end' });
      opts.cols.forEach((c, j) => {
        const t = opts.text(i, j);
        items.push({ key: key + 'c' + i + '_' + j, kind: 'cell', x: x0 + j * s, y: y0 + i * s, w: s - 3, h: s - 3, text: t === null || t === undefined ? '' : t, sub: '', cls: opts.cls ? opts.cls(i, j) || '' : '' });
      });
    });
    return items;
  };
  GW.gridAt = (opts, i, j) => { const s = opts.cell || 40; return { x: (opts.x0 || 0) + j * s + (s - 3) / 2, y: (opts.y0 || 0) + i * s + (s - 3) / 2 }; };

  /** Input checks: every edge directed (2>3), or every edge undirected (2-3) */
  GW.directedOnly = (v) => { try { return X.GraphKit.parse(v).some((e) => !e[3]) ? 'Edges: this topic needs directed edges, written like 2>3' : null; } catch (e) { return null; } };
  GW.undirectedOnly = (v) => { try { return X.GraphKit.parse(v).some((e) => e[3]) ? 'Edges: this topic is about undirected graphs; write edges like 2-3' : null; } catch (e) { return null; } };
  GW.noRepeat = (v) => {
    try {
      const seen = new Set();
      for (const [u, w, , d] of X.GraphKit.parse(v)) { const k = d ? u + '>' + w : Math.min(u, w) + '-' + Math.max(u, w); if (seen.has(k)) return 'Edges: ' + k + ' is given twice'; seen.add(k); }
    } catch (e) { return null; }
    return null;
  };
  /** A graph input with extra checks after the usual ones */
  GW.input = (def, extra, opts) => {
    const base = X.GraphKit.input(def, opts);
    const inner = base.check;
    base.check = (v, all) => inner(v, all) || GW.noRepeat(v) || (extra ? extra(v, all) : null);
    return base;
  };
  GW.inputs = (def, pos, n, extra, more) => [
    { id: 'n', kind: 'int', label: 'Vertices', def: n, lo: 1, hi: 10 },
    GW.input(def, extra),
    { id: 'pos', kind: 'hidden', def: pos },
  ].concat(more || []);

  /** Is there an edge u to v (or either way for an undirected edge) in the parsed list */
  GW.has = (edges, u, v) => edges.some(([a, b, , d]) => (a === u && b === v) || (!d && a === v && b === u));
  /** Colour class for group number c */
  GW.colour = (c) => (c === null || c === undefined || c < 0 ? '' : 'gw-c' + (c % 6));
  GW.list = (a) => (a.length ? a.join(', ') : 'nothing');
  /** Directed graphs with clear positions */
  GW.dirPresets = {
    courses: { n: 7, graph: '0>2 1>2 1>3 2>4 3>4 3>5 4>6 5>6', pos: [[-300, -90], [-300, 90], [-130, -90], [-130, 90], [40, -90], [40, 90], [200, 0]] },
    tangled: { n: 6, graph: '3>0 3>1 0>2 1>2 2>5 4>1 4>5', pos: [[-60, -150], [60, 10], [-180, 40], [-230, -130], [200, -90], [40, 180]] },
    cyclic: { n: 6, graph: '0>1 1>2 2>3 3>1 0>4 4>5', pos: [[-260, 0], [-90, -110], [90, -110], [0, 60], [-120, 170], [100, 190]] },
    chain: { n: 4, graph: '0>1 1>2 2>3', pos: [[-240, 0], [-80, 0], [80, 0], [240, 0]] },
    diamond: { n: 5, graph: '0>1 0>2 1>3 2>3 3>4', pos: [[-240, 0], [-80, -110], [-80, 110], [80, 0], [240, 0]] },
    scc: { n: 8, graph: '0>1 1>2 2>0 1>3 3>4 4>5 5>3 5>6 6>7 7>6 2>6', pos: [[-330, -100], [-200, -10], [-330, 90], [-60, -10], [60, -110], [80, 80], [220, 40], [330, -60]] },
    ring: { n: 5, graph: '0>1 1>2 2>3 3>4 4>0', pos: null },
  };
  /** Undirected graphs with clear positions (the same shapes as the breadth-first search presets) */
  GW.undirPresets = {
    house: { n: 6, graph: '0-1 0-2 1-3 2-3 2-4 3-5 4-5', pos: [[0, -150], [-130, -40], [130, -40], [-130, 120], [130, 120], [0, 230]] },
    tree: { n: 7, graph: '0-1 0-2 1-3 1-4 2-5 2-6', pos: [[0, -140], [-150, -20], [150, -20], [-220, 110], [-80, 110], [80, 110], [220, 110]] },
    twoPos: [[-220, -60], [-120, -140], [-120, 20], [60, -60], [160, -140], [260, -60], [160, 40]],
  };
})(SEE);
