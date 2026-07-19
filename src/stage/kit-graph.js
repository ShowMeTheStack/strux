// Graphs: the input (vertices, edges, weights, where each vertex sits), the C arrays that hold it, and
// the picture: vertices as circles, edges as lines or arrows with their weights, and whatever the
// algorithm keeps per vertex (visited, distance, parent) as labels and colours.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const G = X.GraphKit = {};

  /** Parse "0-1 0-2:5 2>3" into edges; '-' undirected, '>' directed, ':w' a weight */
  G.parse = function (text) {
    const edges = [];
    for (const tok of String(text || '').trim().split(/[\s,;]+/).filter(Boolean)) {
      const m = /^(\d+)\s*([->])\s*(\d+)(?::(-?\d+))?$/.exec(tok);
      if (!m) throw new Error('"' + tok + '" is not an edge like 0-1, 2>3 or 1-4:7');
      edges.push([+m[1], +m[3], m[4] === undefined ? 1 : +m[4], m[2] === '>']);
    }
    return edges;
  };
  G.format = (edges) => edges.map(([u, v, w, d]) => u + (d ? '>' : '-') + v + (w !== 1 ? ':' + w : '')).join(' ');

  /** Positions for n vertices: given ones, or a circle */
  G.positions = function (n, given, opts) {
    opts = opts || {};
    const out = [];
    const R = opts.radius || Math.max(190, n * 32);
    for (let i = 0; i < n; i++) {
      if (given && given[i]) out.push({ x: given[i][0], y: given[i][1] });
      else out.push({ x: R * Math.cos(-Math.PI / 2 + 2 * Math.PI * i / n), y: R * Math.sin(-Math.PI / 2 + 2 * Math.PI * i / n) });
    }
    return out;
  };

  /** C initialisers for an adjacency matrix of n vertices (weights; 0 means no edge) */
  G.matrixInit = function (n, edges, directed) {
    const m = [];
    for (let i = 0; i < n; i++) m.push(new Array(n).fill(0));
    for (const [u, v, w, d] of edges) { m[u][v] = w; if (!(d || directed)) m[v][u] = w; }
    return '{\n' + m.map((r) => '        { ' + r.join(', ') + ' }').join(',\n') + '\n    }';
  };
  /** C initialisers for an edge list: three parallel arrays */
  G.edgeArrays = function (edges) {
    return {
      from: '{ ' + (edges.length ? edges.map((e) => e[0]).join(', ') : '0') + ' }',
      to: '{ ' + (edges.length ? edges.map((e) => e[1]).join(', ') : '0') + ' }',
      w: '{ ' + (edges.length ? edges.map((e) => e[2]).join(', ') : '0') + ' }',
    };
  };

  /**
   * The graph picture. opts: {n, edges, pos, directed, weighted, vcls(v) -> classes, vsub(v) -> label,
   *   ecls(u, v, w) -> classes, elabel(u, v, w) -> text, prefix}
   */
  G.picture = function (opts) {
    const items = [];
    const P = opts.prefix || 'g';
    const pos = opts.pos;
    for (let v = 0; v < opts.n; v++) {
      items.push({ key: P + 'v' + v, kind: 'vertex', x: pos[v].x, y: pos[v].y, r: opts.r || 24, text: opts.vtext ? opts.vtext(v) : v, sub: opts.vsub ? opts.vsub(v) : '', subAbove: !!opts.subAbove, cls: opts.vcls ? opts.vcls(v) || '' : '', pick: true });
    }
    const seen = new Set();
    for (const [u, v, w, d] of opts.edges) {
      const dir = d || opts.directed;
      const k = dir ? u + '>' + v : Math.min(u, v) + '-' + Math.max(u, v);
      if (seen.has(k)) continue;
      seen.add(k);
      // two directed edges between the same pair bend apart
      const twin = dir && opts.edges.some((e) => e[0] === v && e[1] === u);
      items.push({
        key: P + 'e' + k, kind: 'arrow', from: { key: P + 'v' + u }, to: { key: P + 'v' + v }, noHead: !dir, bend: twin ? 18 : 0,
        label: opts.weighted ? String(opts.elabel ? opts.elabel(u, v, w) : w) : (opts.elabel ? opts.elabel(u, v, w) : ''),
        cls: 'g-edge' + (opts.ecls ? ' ' + (opts.ecls(u, v, w) || '') : ''),
      });
    }
    return items;
  };

  /** A row of labelled cells under the graph: an array the algorithm keeps per vertex */
  G.table = function (key, title, values, opts) {
    opts = opts || {};
    const items = [];
    const x0 = opts.x0 || 0, y0 = opts.y0 || 0, w = opts.w || 46;
    items.push({ key: key + 'T', kind: 'text', x: x0 - 12, y: y0 + w / 2 + 5, text: title, cls: 'code-text', anchor: 'end' });
    values.forEach((v, i) => {
      items.push({ key: key + i, kind: 'cell', x: x0 + i * (w + 4), y: y0, w, h: w, text: v === null || v === undefined ? '' : v, sub: opts.noSub ? '' : i, cls: opts.cls ? opts.cls(i, v) || '' : '' });
    });
    return items;
  };

  /** A queue or stack shown as a strip of cells, front on the left */
  G.strip = function (key, title, values, opts) {
    opts = opts || {};
    const items = [];
    const x0 = opts.x0 || 0, y0 = opts.y0 || 0, w = opts.w || 46;
    items.push({ key: key + 'T', kind: 'text', x: x0 - 12, y: y0 + w / 2 + 5, text: title, cls: 'code-text', anchor: 'end' });
    if (!values.length) items.push({ key: key + 'E', kind: 'text', x: x0, y: y0 + w / 2 + 5, text: opts.empty || 'empty', cls: 'free-text' });
    // cells keyed by the value and its occurrence, so an item slides along as the queue moves
    const count = new Map();
    values.forEach((v, i) => {
      const c = count.get(v) || 0;
      count.set(v, c + 1);
      items.push({ key: key + 'q' + v + '_' + c, kind: 'cell', x: x0 + i * (w + 4), y: y0, w, h: w, text: v, sub: '', cls: (opts.cls ? opts.cls(i, v) || '' : ''), enter: 'fly', from: { x: x0 + values.length * (w + 4) + 30, y: y0 }, exit: 'fade' });
    });
    return items;
  };

  /** The graph input box: an edge list, with checks */
  G.input = (def, opts) => Object.assign({ id: 'graph', kind: 'text', label: 'Edges (0-1, 2>3, 1-4:7)', def, check: (v, all) => {
    let edges;
    try { edges = G.parse(v); } catch (e) { return e.message; }
    const n = all.n;
    if (edges.some(([u, w]) => u >= n || w >= n || u < 0 || w < 0)) return 'Edges: every vertex must be between 0 and ' + (n - 1);
    if (edges.some(([u, w]) => u === w)) return 'Edges: no edge from a vertex to itself';
    if (opts && opts.weighted && edges.some((e) => e[2] < 0 && !opts.negative)) return 'Edges: weights must not be negative here';
    return null;
  } }, opts || {});
})(SEE);
