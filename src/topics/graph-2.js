// Graphs: how a graph is stored (adjacency matrix, adjacency lists, edge list, incidence matrix).
(function (SEE) {
  'use strict';
  const X = SEE.Strux, G = X.GraphKit, GW = X.GWalk;

  X.family({
    id: 'grep', order: 0, group: 'Graphs', title: 'Representing graphs',
    blurb: 'The same vertices and edges can be stored four ways. Each one makes some questions cheap and others slow.',
    head: `#include <stdio.h>
#include <stdlib.h>

#define MAXV 10
#define MAXE 16`,
  });

  // ---- shared by the four: the edges come in as two arrays, from[] and to[] -------------------------------
  const ints = (a) => '{ ' + (a.length ? a.join(', ') : '0') + ' }';
  const isDirected = (inp) => G.parse(inp.graph).some((e) => e[3]);
  const sameKind = (v) => {
    try { const e = G.parse(v); return e.some((x) => x[3]) && e.some((x) => !x[3]) ? 'Edges: use 2-3 for all of them (undirected) or 2>3 for all of them (directed), not a mix' : null; } catch (e) { return null; }
  };
  const fewEdges = (max) => (v) => { try { return G.parse(v).length > max ? 'Edges: at most ' + max + ', so the picture stays readable' : null; } catch (e) { return null; } };
  const edgeMain = (inp, call) => {
    const e = G.parse(inp.graph);
    return `int main(void)
{
    int from[] = ${ints(e.map((x) => x[0]))};
    int to[] = ${ints(e.map((x) => x[1]))};
    ${call}
    return 0;
}`;
  };
  const P = X.graphPresets;
  const dag = { n: 6, graph: '0>1 0>2 1>3 2>3 2>4 3>5 4>5', pos: [[-260, 0], [-120, -110], [-120, 110], [40, -110], [40, 110], [190, 0]] };
  const twoWay = { n: 5, graph: '0>1 1>0 1>2 2>3 3>1 3>4', pos: [[-230, -60], [-60, -60], [110, -120], [110, 60], [-60, 110]] };
  const lonely = { n: 4, graph: '0-1', pos: [[-120, -70], [80, -70], [-120, 90], [80, 90]] };
  X.gwRepPresets = { dag, twoWay, lonely };

  /** The graph on the left, positioned so the panels can sit to its right */
  const graphAt = (inp) => {
    const pos = G.positions(inp.n, inp.pos);
    return { pos, box: GW.box(pos, 30) };
  };
  /** The edges as small chips under the graph: the input the function reads, with i on the current one */
  const chips = (edges, box, cur, done, dir) => {
    const items = [];
    const per = 8, w = 58;
    const y0 = box.y1 + 46;
    items.push({ key: 'chT', kind: 'text', x: box.x0, y: y0 - 12, text: 'from[i], to[i]', cls: 'gw-title' });
    edges.forEach(([u, v], k) => {
      const x = box.x0 + (k % per) * (w + 6), y = y0 + Math.floor(k / per) * 52;
      items.push({ key: 'ch' + k, kind: 'cell', x, y, w, h: 32, text: u + (dir ? '→' : '–') + v, sub: k, cls: k === cur ? 'hot' : done(k) ? 'part-a' : '' });
    });
    return { items, y1: y0 + Math.ceil(Math.max(1, edges.length) / per) * 52 };
  };

  const edgeQuizDensity = { q: 'A graph has 1000 vertices and 3000 edges. Which storage wastes the most memory?', options: ['Adjacency lists', 'Edge list', 'Adjacency matrix', 'They all use the same'], answer: 2, why: 'The matrix always has 1000 × 1000 = a million cells, almost all of them 0. Lists and edge lists grow with the number of edges.' };

  // ---- adjacency matrix --------------------------------------------------------------------------------------
  X.topic({
    id: 'graph-matrix', family: 'grep', order: 10, title: 'Adjacency matrix',
    blurb: 'An n × n grid of 0s and 1s: row u, column v says whether there is an edge from u to v. Each edge lights one cell, or two when it goes both ways.',
    code: `/* adj[u][v] is 1 when there is an edge from u to v.
   A global array starts as all zeros: no edges yet. */
int adj[MAXV][MAXV];

/* record each of the m edges in the matrix */
void build_matrix(int m, const int from[], const int to[], int directed)
{
    int i, u, v;
    for (i = 0; i < m; i++) {        /*@ loop */
        u = from[i];                 /*@ take-u */
        v = to[i];                   /*@ take-v */
        adj[u][v] = 1;               /*@ set */
        if (!directed)               /*@ test-dir */
            adj[v][u] = 1;           /*@ mirror */
    }
}`,
    animate: ['build_matrix'],
    inputs: GW.inputs(P.house.graph, P.house.pos, 6, (v) => sameKind(v) || fewEdges(14)(v)),
    presets: [
      { label: 'House', values: Object.assign({}, P.house) },
      { label: 'Directed', values: Object.assign({}, dag) },
      { label: 'Both ways', values: Object.assign({}, twoWay) },
      { label: 'Almost empty', values: Object.assign({}, lonely) },
    ],
    counters: ['writes'],
    main: (inp) => edgeMain(inp, 'build_matrix(' + G.parse(inp.graph).length + ', from, to, ' + (isDirected(inp) ? 1 : 0) + ');'),
    capture(P) {
      const s = (k) => (P.isSet(k, 0) ? P.val(k, 0) : null);
      return { adj: GW.mat(P, 'adj', 10, 10), i: s('i'), u: s('u'), v: s('v'), m: P.val('m', 0) };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const n = inp.n, edges = G.parse(inp.graph), dir = isDirected(inp);
      const { pos, box } = graphAt(inp);
      const adj = d.adj;
      const cur = d.i !== null && d.i < edges.length && tag !== 'after' ? d.i : -1;
      const inMatrix = (u, v) => adj[u][v] === 1 || (!dir && adj[v][u] === 1);
      const items = G.picture({
        n, edges, pos,
        vcls: (v) => (cur >= 0 && (v === edges[cur][0] || v === edges[cur][1]) ? 'hot' : ''),
        ecls: (u, v) => (cur >= 0 && edges[cur][0] === u && edges[cur][1] === v ? 'hot' : inMatrix(u, v) ? 'part-b' : 'gw-faint'),
      });
      const ch = chips(edges, box, cur, (k) => inMatrix(edges[k][0], edges[k][1]), dir);
      items.push(...ch.items);
      // the matrix, to the right of the graph
      const cell = n > 7 ? 38 : 46;
      const gx = box.x1 + 110, gy = Math.min(box.y0 + 10, (box.y0 + box.y1) / 2 - n * cell / 2);
      const hotRow = tag === 'mirror' ? d.v : d.u, hotCol = tag === 'mirror' ? d.u : d.v;
      const showHot = cur >= 0 && (tag === 'set' || tag === 'mirror' || tag === 'test-dir');
      const g = { x0: gx, y0: gy, cell, rows: [...Array(n).keys()], cols: [...Array(n).keys()] };
      g.text = (i, j) => adj[i][j];
      g.cls = (i, j) => {
        if (showHot && ((tag !== 'mirror' && i === d.u && j === d.v) || (tag === 'mirror' && i === d.v && j === d.u))) return 'hot';
        return (adj[i][j] ? 'gw-one' : 'gw-zero') + (!dir && i === j ? ' gw-dg' : '');
      };
      g.rowCls = (i) => (showHot && i === hotRow ? 'gw-hot' : 'gw-label');
      g.colCls = (j) => (showHot && j === hotCol ? 'gw-hot' : 'gw-label');
      if (showHot) {
        items.push({ key: 'bandR', kind: 'region', x: gx - 30, y: gy + hotRow * cell - 2, w: n * cell + 32, h: cell + 1, cls: 'gw-band' });
        items.push({ key: 'bandC', kind: 'region', x: gx + hotCol * cell - 2, y: gy - 30, w: cell + 1, h: n * cell + 32, cls: 'gw-band' });
      }
      items.push(...GW.grid('mx', g));
      items.push({ key: 'mxT', kind: 'text', x: gx, y: gy - 38, text: 'adj: row = from, column = to', cls: 'gw-title' });
      if (!dir) items.push({ key: 'diagT', kind: 'text', x: gx + n * cell + 4, y: gy + n * cell + 16, text: '↖ mirror line', cls: 'gw-small' });
      if (tag === 'mirror') {
        const a = GW.gridAt(g, d.u, d.v), b = GW.gridAt(g, d.v, d.u);
        items.push({ key: 'mir' + ctx.i, kind: 'token', x: b.x, y: b.y, r: 13, text: '1', cls: 'gw-fly', enter: 'fly', from: a });
      }
      const ones = adj.slice(0, n).reduce((s, r) => s + r.slice(0, n).filter((x) => x === 1).length, 0);
      const view = GW.view([box, { x0: gx - 40, y0: gy - 60, x1: gx + n * cell + (dir ? 0 : 100), y1: gy + n * cell + 20 }, { x0: box.x0, y0: box.y1, x1: box.x1, y1: ch.y1 }]);
      let say = '';
      const e = cur >= 0 ? edges[cur] : null;
      switch (tag) {
        case 'enter': say = 'build_matrix() gets ' + edges.length + ' edge' + (edges.length === 1 ? '' : 's') + ' in two arrays, from[] and to[]. The matrix has ' + n + ' × ' + n + ' = ' + n * n + ' cells, all 0 so far.'; break;
        case 'loop': say = cur >= 0 ? 'Edge ' + cur + ': ' + e[0] + (dir ? ' → ' : ' – ') + e[1] + '.' : 'All ' + edges.length + ' edges are in. ' + ones + ' of the ' + n * n + ' cells hold 1.'; break;
        case 'take-u': say = 'u = from[' + cur + '] = ' + d.u + ': the row to write in.'; break;
        case 'take-v': say = 'v = to[' + cur + '] = ' + d.v + ': the column.'; break;
        case 'set': say = 'adj[' + d.u + '][' + d.v + '] = 1: row ' + d.u + ', column ' + d.v + '. Row ' + d.u + ' now lists where ' + d.u + '\'s edges go.'; break;
        case 'test-dir': say = dir ? 'The graph is directed: ' + d.u + ' → ' + d.v + ' says nothing about ' + d.v + ' → ' + d.u + ', so only one cell is set.' : 'The graph is undirected: the edge must also be found from ' + d.v + '\'s side.'; break;
        case 'mirror': say = 'adj[' + d.v + '][' + d.u + '] = 1, the mirror image across the diagonal. An undirected matrix is always symmetric.'; break;
        case 'after': say = 'Done: ' + ones + ' ones in ' + n * n + ' cells. "Is there an edge from 2 to 4?" is one look at adj[2][4]. But listing the neighbours of a vertex means reading a whole row of ' + n + ' cells, and the matrix takes n² space even when most of it is 0.'; break;
      }
      return { items, say, view, slow: tag === 'mirror' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'mirror', once: true, ask: (t) => 'adj[' + t.data.u + '][' + t.data.v + '] is set. Click the other cell that will become 1.', answer: (ts, i) => 'mxc' + ts[i].data.v + '_' + ts[i].data.u, explain: (ts, i) => 'Row ' + ts[i].data.v + ', column ' + ts[i].data.u + ': the same edge seen from the other end.' },
      { at: (t) => t.tag === 'enter', once: true, ask: 'How many cells will hold 1 when every edge is in?', options: (ts, i, ctx) => { const m = G.parse(ctx.input.graph).length, n = ctx.input.n; return [...new Set([m, 2 * m, n * n, m + n])].sort((a, b) => a - b).map(String); }, answer: (ts, i, ctx) => String(G.parse(ctx.input.graph).length * (isDirected(ctx.input) ? 1 : 2)), pick: 'option', explain: (ts, i, ctx) => (isDirected(ctx.input) ? 'One cell per directed edge.' : 'Two cells per edge: an undirected edge is stored from both ends.') },
    ],
    quiz: [
      { q: 'How long does "is there an edge from u to v?" take with an adjacency matrix?', options: ['O(1)', 'O(degree of u)', 'O(n)', 'O(m)'], answer: 0, why: 'It is one array access: adj[u][v].' },
      { q: 'How long does it take to list every neighbour of u?', options: ['O(1)', 'O(degree of u)', 'O(n)', 'O(n²)'], answer: 2, why: 'You must read the whole row u, n cells, even if u has only one neighbour.' },
      { q: 'For an undirected graph, the matrix is...', options: ['Symmetric across the diagonal', 'All 1s on the diagonal', 'Upper triangular', 'Sorted by row'], answer: 0, why: 'Every edge u–v is written twice: adj[u][v] and adj[v][u].' },
      { q: 'What does row u of a directed graph\'s matrix add up to?', options: ['The number of edges into u', 'The number of edges out of u', 'n', 'Always 1'], answer: 1, why: 'Row u has a 1 in column v for every edge u → v. Column u counts the edges coming in.' },
      edgeQuizDensity,
    ],
    compareWith: 'graph-list',
  });

  // ---- adjacency lists -----------------------------------------------------------------------------------
  const ROW = 58, NW = 84, NGAP = 36;
  X.topic({
    id: 'graph-list', family: 'grep', order: 20, title: 'Adjacency lists',
    blurb: 'An array of list heads, one per vertex. Each edge mallocs a small node and pushes it on the front of a list: the cost does not depend on how long the list already is.',
    code: `/* one entry in a vertex's list: a neighbour, and the next entry */
struct adjnode {
    int v;
    struct adjnode *next;
};

/* head[u] is the first entry of u's list (NULL: no neighbours yet) */
struct adjnode *head[MAXV];

/* put v on the front of u's list */
void add_arc(int u, int v)
{
    struct adjnode *a = malloc(sizeof *a);   /*@ alloc */
    a->v = v;                                /*@ fill */
    a->next = head[u];                       /*@ link */
    head[u] = a;                             /*@ head */
}

/* record each of the m edges, from both ends unless directed */
void build_lists(int m, const int from[], const int to[], int directed)
{
    int i;
    for (i = 0; i < m; i++) {                /*@ loop */
        add_arc(from[i], to[i]);             /*@ call */
        if (!directed)                       /*@ test-dir */
            add_arc(to[i], from[i]);         /*@ call-back */
    }
}`,
    animate: ['build_lists', 'add_arc'],
    inputs: GW.inputs('0-1 0-2 1-3 2-3 3-4', [[-120, -120], [80, -120], [-120, 50], [80, 50], [180, 170]], 5, (v) => sameKind(v) || fewEdges(10)(v)),
    presets: [
      { label: 'Small', values: { n: 5, graph: '0-1 0-2 1-3 2-3 3-4', pos: [[-120, -120], [80, -120], [-120, 50], [80, 50], [180, 170]] } },
      { label: 'Directed', values: Object.assign({}, dag) },
      { label: 'A star', values: { n: 5, graph: '0-1 0-2 0-3 0-4', pos: [[0, 0], [-140, -110], [140, -110], [-140, 110], [140, 110]] } },
      { label: 'Almost empty', values: Object.assign({}, lonely) },
    ],
    counters: ['allocs', 'writes'],
    main: (inp) => edgeMain(inp, 'build_lists(' + G.parse(inp.graph).length + ', from, to, ' + (isDirected(inp) ? 1 : 0) + ');'),
    capture(P) {
      const T = SEE.Types, Dbg = SEE.Debug;
      const hv = P.find('head');
      const nodeT = T.unqual(T.unqual(hv.type).of).to;
      const def = T.def(T.unqual(nodeT));
      const off = {};
      for (const mb of def.members) off[mb.name] = mb.offset;
      const heads = P.arr('head', 10);
      const lists = heads.map((h) => (h ? P.chain(h, nodeT, 'next', 20).nodes.map((x) => ({ addr: x.addr, v: x.v, next: x.next })) : []));
      const inAdd = P.frames[0] && P.frames[0].name === 'add_arc';
      let fresh = null;
      if (inAdd && P.isSet('a', 0)) {
        const a = P.val('a', 0);
        const set = (f) => !Dbg.uninit(P.vm, a + off[f], 4);
        fresh = { addr: a, v: set('v') ? P.read(def.members.find((x) => x.name === 'v').type, a + off.v) : null, next: set('next') ? P.read(def.members.find((x) => x.name === 'next').type, a + off.next) : undefined };
      }
      return { heads, lists, fresh, i: P.isSet('i') ? P.val('i') : null, u: inAdd ? P.val('u', 0) : null, v: inAdd ? P.val('v', 0) : null };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const n = inp.n, edges = G.parse(inp.graph), dir = isDirected(inp);
      const { pos, box } = graphAt(inp);
      const cur = d.i !== null && d.i < edges.length && tag !== 'after' ? d.i : -1;
      const has = (u, v) => d.lists[u].some((x) => x.v === v);
      const stored = (u, v) => has(u, v) || (!dir && has(v, u));
      const items = G.picture({
        n, edges, pos,
        vcls: (v) => (d.u !== null && v === d.u ? 'focus hot' : cur >= 0 && (v === edges[cur][0] || v === edges[cur][1]) ? 'hot' : ''),
        ecls: (u, v) => (cur >= 0 && edges[cur][0] === u && edges[cur][1] === v ? 'hot' : stored(u, v) ? 'part-b' : 'gw-faint'),
      });
      const ch = chips(edges, box, cur, (k) => stored(edges[k][0], edges[k][1]) && (dir || (has(edges[k][0], edges[k][1]) && has(edges[k][1], edges[k][0]))), dir);
      items.push(...ch.items);
      // the heads, one row per vertex, and each chain to the right
      const hx = box.x1 + 120, hy = Math.min(box.y0, (box.y0 + box.y1) / 2 - n * ROW / 2);
      const fresh = d.fresh && d.lists[d.u] && !d.lists[d.u].some((x) => x.addr === d.fresh.addr) ? d.fresh : null;
      let maxLen = 1;
      items.push({ key: 'hT', kind: 'text', x: hx - 40, y: hy - 18, text: 'head[u]', cls: 'gw-title' });
      for (let u = 0; u < n; u++) {
        const y = hy + u * ROW;
        const list = d.lists[u];
        const prevHead = ctx.prev && ctx.prev.data && ctx.prev.data.heads ? ctx.prev.data.heads[u] : d.heads[u];
        const changed = tag === 'head' && u === d.u;
        items.push({ key: 'hl' + u, kind: 'text', x: hx - 14, y: y + 25, text: String(u), cls: d.u === u ? 'gw-hot' : 'gw-label', anchor: 'end' });
        items.push({ key: 'h' + u, kind: 'node', x: hx, y, w: 52, h: 38, cells: [{ text: d.heads[u] ? '' : 'NULL', port: 'p', cls: 'link' + (d.heads[u] ? '' : ' null') + (changed ? ' hot' : '') }], cls: d.u === u ? 'focus' : '' });
        const shift = fresh && d.u === u ? 1 : 0;
        list.forEach((x, k) => {
          const slot = k + shift;
          items.push({ key: 'n' + x.addr, kind: 'node', x: hx + 90 + slot * (NW + NGAP), y, w: NW, h: 38, cells: [{ text: x.v, w: 1, cls: 'val' }, { text: x.next ? '' : 'NULL', port: 'next', w: 0.8, cls: 'link' + (x.next ? '' : ' null') }], cls: x.v === d.v && u === d.u ? 'part-b' : '' });
          if (x.next) items.push({ key: 'a' + x.addr, kind: 'arrow', from: { key: 'n' + x.addr, port: 'next' }, to: { key: 'n' + x.next, side: 'left' } });
        });
        maxLen = Math.max(maxLen, list.length + shift);
        if (d.heads[u]) items.push({ key: 'ha' + u, kind: 'arrow', from: { key: 'h' + u, port: 'p' }, to: { key: 'n' + d.heads[u], side: 'left' }, cls: changed ? 'hot' : '' });
        void prevHead;
      }
      if (fresh) {
        const y = hy + d.u * ROW;
        const nx = fresh.next === undefined ? '?' : fresh.next ? '' : 'NULL';
        items.push({ key: 'n' + fresh.addr, kind: 'node', x: hx + 90, y, w: NW, h: 38, cells: [{ text: fresh.v === null ? '?' : fresh.v, w: 1, cls: 'val' + (tag === 'fill' ? ' hot' : '') }, { text: nx, port: 'next', w: 0.8, cls: 'link' + (fresh.next ? '' : ' null') + (tag === 'link' ? ' hot' : '') }], cls: 'focus', enter: 'drop' });
        if (fresh.next) items.push({ key: 'a' + fresh.addr, kind: 'arrow', from: { key: 'n' + fresh.addr, port: 'next' }, to: { key: 'n' + fresh.next, side: 'left' }, cls: tag === 'link' ? 'hot' : '' });
        items.push({ key: 'ca', kind: 'cursor', at: 'n' + fresh.addr, side: 'above', text: 'a', cls: 'c-green' });
      }
      const total = d.lists.slice(0, n).reduce((s, l) => s + l.length, 0);
      const view = GW.view([box, { x0: box.x0, y0: box.y1, x1: box.x1, y1: ch.y1 }, { x0: hx - 50, y0: hy - 40, x1: hx + 90 + Math.max(3, maxLen) * (NW + NGAP), y1: hy + n * ROW }]);
      const nm = (u) => (d.lists[u].length ? d.lists[u].map((x) => x.v).join(' → ') : 'empty');
      let say = '';
      const e = cur >= 0 ? edges[cur] : null;
      switch (tag) {
        case 'enter': say = 'build_lists() gets ' + edges.length + ' edge' + (edges.length === 1 ? '' : 's') + '. Every head[u] starts as NULL: ' + n + ' empty lists.'; break;
        case 'loop': say = cur >= 0 ? 'Edge ' + cur + ': ' + e[0] + (dir ? ' → ' : ' – ') + e[1] + '.' : 'All edges are in: ' + total + ' list nodes for ' + edges.length + ' edges' + (dir ? '.' : ', two per edge.'); break;
        case 'call': say = 'Call add_arc(' + e[0] + ', ' + e[1] + '): ' + e[1] + ' goes into ' + e[0] + '\'s list.'; break;
        case 'test-dir': say = dir ? 'Directed: ' + e[1] + ' does not get ' + e[0] + ' in its list.' : 'Undirected: ' + e[1] + ' must also know about ' + e[0] + '.'; break;
        case 'call-back': say = 'Call add_arc(' + e[1] + ', ' + e[0] + '): the same edge, stored from ' + e[1] + '\'s end.'; break;
        case 'alloc': say = 'add_arc(' + d.u + ', ' + d.v + '): malloc a new node for ' + d.u + '\'s list. Its fields hold nothing useful yet.'; break;
        case 'fill': say = 'a->v = ' + d.v + ': the neighbour this entry stands for.'; break;
        case 'link': say = d.fresh && d.fresh.next ? 'a->next = head[' + d.u + ']: the new node points at the current first entry. Nothing is lost when head[' + d.u + '] moves.' : 'a->next = head[' + d.u + '], which is NULL: the list was empty, so the new node is also the last.'; break;
        case 'head': say = 'head[' + d.u + '] = a: the new node is first. ' + d.u + '\'s list is now ' + nm(d.u) + '. One step, however long the list was.'; break;
        case 'after': say = 'Done: ' + n + ' heads and ' + total + ' nodes, so the space grows with n + m, not n². Each list is in the reverse order of the edges, because every node went on the front.'; break;
      }
      if (ctx.tick.end && !say) say = 'add_arc() returns to build_lists().';
      return { items, say, view, slow: tag === 'head' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'link' && ts[i].data.heads[ts[i].data.u], once: true, ask: (t) => 'a->next = head[' + t.data.u + '] comes next. Click the node the new entry will point at.', answer: (ts, i) => 'n' + ts[i].data.heads[ts[i].data.u], explain: (ts, i) => 'The current first entry of ' + ts[i].data.u + '\'s list: the new node goes in front of it.' },
      { at: (t) => t.tag === 'enter', once: true, ask: 'How many list nodes will exist when every edge is in?', options: (ts, i, ctx) => { const m = G.parse(ctx.input.graph).length, n = ctx.input.n; return [...new Set([m, 2 * m, n, n * n])].sort((a, b) => a - b).map(String); }, answer: (ts, i, ctx) => String(G.parse(ctx.input.graph).length * (isDirected(ctx.input) ? 1 : 2)), pick: 'option', explain: (ts, i, ctx) => (isDirected(ctx.input) ? 'One per directed edge.' : 'Two per edge: u is in v\'s list and v is in u\'s list.') },
    ],
    quiz: [
      { q: 'Why does add_arc put the new node at the front rather than the end?', options: ['The order matters for correctness', 'It takes O(1) instead of walking the list', 'malloc only works that way', 'To keep the list sorted'], answer: 1, why: 'Reaching the end would mean walking the whole list; the front is always one step away. The order of neighbours does not matter for a graph.' },
      { q: 'What must happen before head[u] = a?', options: ['a->next = head[u]', 'free(head[u])', 'head[u] = NULL', 'Nothing'], answer: 0, why: 'If head[u] changed first, the old list would no longer be reachable from anywhere.' },
      { q: 'How long does "is v a neighbour of u?" take with adjacency lists?', options: ['O(1)', 'O(degree of u)', 'O(n²)', 'O(m²)'], answer: 1, why: 'You walk u\'s list until you find v or reach NULL.' },
      { q: 'How much memory do adjacency lists of an undirected graph use?', options: ['O(n²)', 'O(n + m)', 'O(m²)', 'O(n · m)'], answer: 1, why: 'n list heads plus 2m nodes.' },
      edgeQuizDensity,
    ],
    compareWith: 'graph-matrix',
  });
  // ---- edge list -----------------------------------------------------------------------------------------
  const ER = 46;
  X.topic({
    id: 'graph-edgelist', family: 'grep', order: 30, title: 'Edge list and degrees',
    blurb: 'The plainest storage: an array of edges, each just its two ends. Counting degrees reads every edge once, and each edge adds one to both of its ends.',
    code: `/* an edge is just its two ends */
struct edge {
    int u, v;
};

/* deg[x] = the number of edges that touch x */
void degrees(int n, int m, const struct edge e[], int deg[])
{
    int i;
    for (i = 0; i < n; i++)          /*@ zero-loop */
        deg[i] = 0;                  /*@ zero */
    for (i = 0; i < m; i++) {        /*@ loop */
        deg[e[i].u]++;               /*@ count-u */
        deg[e[i].v]++;               /*@ count-v */
    }
}`,
    animate: ['degrees'],
    inputs: GW.inputs(P.house.graph, P.house.pos, 6, (v) => GW.undirectedOnly(v) || fewEdges(10)(v)),
    presets: [
      { label: 'House', values: Object.assign({}, P.house) },
      { label: 'A star', values: { n: 5, graph: '0-1 0-2 0-3 0-4', pos: [[0, 0], [-140, -110], [140, -110], [-140, 110], [140, 110]] } },
      { label: 'Tree', values: Object.assign({}, P.tree) },
      { label: 'Lonely vertices', values: Object.assign({}, lonely) },
    ],
    counters: ['writes'],
    main: (inp) => {
      const e = G.parse(inp.graph);
      return `int main(void)
{
    struct edge e[] = { ${e.length ? e.map((x) => '{ ' + x[0] + ', ' + x[1] + ' }').join(', ') : '{ 0, 0 }'} };
    int deg[MAXV];
    degrees(${inp.n}, ${e.length}, e, deg);
    return 0;
}`;
    },
    capture(P) {
      return { deg: P.arr('deg', 10) || [], i: P.has('i', 0) && P.isSet('i', 0) ? P.val('i', 0) : null };
    },
    scene(ctx) {
      const d = Object.assign({}, ctx.tick.data), tag = ctx.tick.tag, inp = ctx.input;
      const n = inp.n, edges = G.parse(inp.graph), m = edges.length;
      d.deg = d.deg.slice(0, n);
      const { pos, box } = graphAt(inp);
      const counting = tag === 'loop' || tag === 'count-u' || tag === 'count-v';
      const cur = counting && d.i !== null && d.i < m ? d.i : -1;
      const deg = (x) => (d.deg[x] === null || d.deg[x] === undefined ? null : d.deg[x]);
      const counted = (k) => tag === 'after' || (d.i !== null && counting && (k < d.i || (k === d.i && tag === 'count-v')));
      const touched = cur >= 0 ? (tag === 'count-u' ? [edges[cur][0]] : tag === 'count-v' ? [edges[cur][1]] : []) : [];
      const items = G.picture({
        n, edges, pos,
        vsub: (x) => (deg(x) === null ? '' : 'deg ' + deg(x)),
        vcls: (x) => 'gw-sub ' + (touched.includes(x) ? 'hot' : cur >= 0 && (x === edges[cur][0] || x === edges[cur][1]) ? 'focus' : ''),
        ecls: (u, v) => { const k = edges.findIndex((e) => e[0] === u && e[1] === v); return k === cur ? 'hot' : counted(k) ? 'part-b' : 'gw-faint'; },
      });
      // the edge array, a column of structs to the right of the graph
      const ex = box.x1 + 130, ey = Math.min(box.y0, (box.y0 + box.y1) / 2 - Math.max(1, m) * ER / 2 + 20);
      items.push({ key: 'eT', kind: 'text', x: ex - 50, y: ey - 30, text: 'e[i]', cls: 'gw-title' });
      items.push({ key: 'eTu', kind: 'text', x: ex + 25, y: ey - 10, text: '.u', cls: 'gw-small', anchor: 'middle' });
      items.push({ key: 'eTv', kind: 'text', x: ex + 79, y: ey - 10, text: '.v', cls: 'gw-small', anchor: 'middle' });
      edges.forEach(([u, v], k) => {
        const y = ey + k * ER, c = k === cur ? 'hot' : counted(k) ? 'part-b' : '';
        items.push({ key: 'el' + k, kind: 'text', x: ex - 14, y: y + 25, text: String(k), cls: k === cur ? 'gw-hot' : 'gw-label', anchor: 'end' });
        items.push({ key: 'eu' + k, kind: 'cell', x: ex, y, w: 50, h: ER - 6, text: u, sub: '', cls: c + (k === cur && tag === 'count-u' ? ' focus' : '') });
        items.push({ key: 'ev' + k, kind: 'cell', x: ex + 54, y, w: 50, h: ER - 6, text: v, sub: '', cls: c + (k === cur && tag === 'count-v' ? ' focus' : '') });
      });
      if (cur >= 0) items.push({ key: 'ci', kind: 'cursor', at: 'ev' + cur, side: 'right', text: 'i', cls: 'c-teal' });
      // deg[], under the graph
      const dx = box.x0 + 40, dy = box.y1 + 40;
      items.push({ key: 'dT', kind: 'text', x: dx - 12, y: dy + 28, text: 'deg', cls: 'gw-label', anchor: 'end' });
      for (let x = 0; x < n; x++) items.push({ key: 'dg' + x, kind: 'cell', x: dx + x * 50, y: dy, w: 46, h: 46, text: deg(x) === null ? '' : deg(x), sub: x, cls: touched.includes(x) ? 'hot' : tag === 'zero' && d.i === x ? 'hot' : deg(x) ? 'part-b' : '', flash: touched.includes(x) });
      // the +1 that travels from the edge to the counter
      if (touched.length) {
        const x = touched[0];
        const from = tag === 'count-u' ? { x: ex + 25, y: ey + cur * ER + 20 } : { x: ex + 79, y: ey + cur * ER + 20 };
        items.push({ key: 'fly' + ctx.i, kind: 'token', x: dx + x * 50 + 23, y: dy - 16, r: 15, text: '+1', cls: 'gw-fly', enter: 'fly', from });
      }
      const sum = d.deg.reduce((a, b) => a + (b || 0), 0);
      if (tag === 'after') items.push({ key: 'sum', kind: 'text', x: dx - 40, y: dy + 100, text: 'sum of degrees = ' + d.deg.map((x) => x || 0).join(' + ') + ' = ' + sum + ' = 2 × ' + m + ' edges', cls: 'gw-big' });
      const view = GW.view([box, { x0: ex - 60, y0: ey - 50, x1: ex + 160, y1: ey + Math.max(1, m) * ER }, { x0: dx - 60, y0: dy, x1: dx + n * 50, y1: dy + (tag === 'after' ? 110 : 70) }, { x0: dx - 40, y0: dy, x1: dx + 560, y1: dy + 10 }]);
      let say = '';
      const e = cur >= 0 ? edges[cur] : null;
      switch (tag) {
        case 'enter': say = 'degrees() gets ' + m + ' edge' + (m === 1 ? '' : 's') + ' as an array of structs. Nothing else is stored: no matrix, no lists.'; break;
        case 'zero-loop': say = d.i < n ? 'Clear the counter of vertex ' + d.i + '.' : 'All ' + n + ' counters are 0. deg is a local array in main, so it started with rubbish in it.'; break;
        case 'zero': say = 'deg[' + d.i + '] = 0.'; break;
        case 'loop': say = cur >= 0 ? 'Edge e[' + cur + '] joins ' + e[0] + ' and ' + e[1] + '.' : 'Every edge has been read once.'; break;
        case 'count-u': say = 'deg[e[' + cur + '].u]++: one more edge touches ' + e[0] + ', now deg ' + deg(e[0]) + '.'; break;
        case 'count-v': say = 'deg[e[' + cur + '].v]++: the same edge touches ' + e[1] + ' too, now deg ' + deg(e[1]) + '. Every edge counts twice in total.'; break;
        case 'after': say = 'The degrees add up to ' + sum + ', twice the ' + m + ' edges: each edge was counted at both ends. Notice what an edge list cannot do quickly: to find the neighbours of one vertex you must read all ' + m + ' edges.'; break;
      }
      return { items, say, view };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'count-v', once: true, ask: 'The same edge is counted again. Click the counter that goes up next.', answer: (ts, i, ctx) => 'dg' + G.parse(ctx.input.graph)[ts[i].data.i][1], explain: () => 'deg[e[i].v]: the other end of the edge.' },
      { at: (t) => t.tag === 'enter', once: true, ask: 'When the loop is done, what will all the degrees add up to?', options: (ts, i, ctx) => { const m = G.parse(ctx.input.graph).length, n = ctx.input.n; return [...new Set([m, 2 * m, n, n + m])].sort((a, b) => a - b).map(String); }, answer: (ts, i, ctx) => String(2 * G.parse(ctx.input.graph).length), pick: 'option', explain: () => 'Each edge adds 1 at each of its two ends: twice the number of edges.' },
    ],
    quiz: [
      { q: 'Why is the sum of all degrees always even?', options: ['Graphs have an even number of vertices', 'Each edge adds 1 to two degrees', 'Degrees are always even', 'It is not always even'], answer: 1, why: 'Sum of degrees = 2m, so it is even. As a result the number of vertices with odd degree is even too.' },
      { q: 'How long does it take to find all neighbours of one vertex in an edge list?', options: ['O(1)', 'O(degree)', 'O(m)', 'O(n²)'], answer: 2, why: 'Nothing groups the edges by vertex, so every edge must be checked.' },
      { q: 'Which algorithm likes edge lists, because it only needs to go through all edges, often in order of weight?', options: ['Breadth-first search', 'Kruskal\'s minimum spanning tree', 'Depth-first search', 'Topological sort'], answer: 1, why: 'Kruskal sorts the edges by weight and looks at each once; an array of edges is exactly what it wants.' },
      { q: 'A vertex appears in no edge at all. What is its degree, and how does the edge list show it?', options: ['1; it is listed with itself', '0; it does not appear anywhere', '0; it has its own entry', 'The program crashes'], answer: 1, why: 'Only n tells you it exists. That is why degrees() takes n and clears every counter first.' },
    ],
  });

  // ---- incidence matrix --------------------------------------------------------------------------------------
  X.topic({
    id: 'graph-incidence', family: 'grep', order: 40, title: 'Incidence matrix',
    blurb: 'Rows are vertices, columns are edges. Every column has exactly two marks, one at each end. Finding a neighbour means two scans: along a row, then down a column.',
    code: `/* inc[x][i] is not 0 when edge i touches vertex x: 1 at both ends, or
   for a directed edge 1 where it leaves and -1 where it arrives */
int inc[MAXV][MAXE];

void build_incidence(int m, const int from[], const int to[], int directed)
{
    int i;
    for (i = 0; i < m; i++) {                  /*@ loop */
        inc[from[i]][i] = 1;                   /*@ set-u */
        inc[to[i]][i] = directed ? -1 : 1;     /*@ set-v */
    }
}

/* print the vertices that x's edges lead to */
void neighbours(int n, int m, int x)
{
    int i, w;
    for (i = 0; i < m; i++)                    /*@ scan-edge */
        if (inc[x][i] == 1)                    /*@ test-edge */
            for (w = 0; w < n; w++)            /*@ scan-col */
                if (w != x && inc[w][i] != 0)  /*@ test-end */
                    printf("%d\\n", w);         /*@ found */
}`,
    animate: ['build_incidence', 'neighbours'],
    inputs: GW.inputs(P.house.graph, P.house.pos, 6, (v) => sameKind(v) || fewEdges(10)(v), [{ id: 'x', kind: 'int', label: 'Neighbours of', def: 2, lo: 0, hi: 9 }]),
    check: (inp) => (inp.x >= inp.n ? 'Neighbours of: a vertex from 0 to ' + (inp.n - 1) : null),
    presets: [
      { label: 'House', values: Object.assign({ x: 2 }, P.house) },
      { label: 'Directed', values: Object.assign({ x: 2 }, dag) },
      { label: 'A star', values: { n: 5, graph: '0-1 0-2 0-3 0-4', pos: [[0, 0], [-140, -110], [140, -110], [-140, 110], [140, 110]], x: 0 } },
      { label: 'No neighbours', values: Object.assign({ x: 3 }, lonely) },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => edgeMain(inp, 'build_incidence(' + G.parse(inp.graph).length + ', from, to, ' + (isDirected(inp) ? 1 : 0) + ');\n    neighbours(' + inp.n + ', ' + G.parse(inp.graph).length + ', ' + inp.x + ');'),
    capture(P) {
      const s = (k) => (P.has(k, 0) && P.isSet(k, 0) ? P.val(k, 0) : null);
      return { inc: GW.mat(P, 'inc', 10, 16), fn: P.frames[0] ? P.frames[0].name : '', i: s('i'), w: s('w') };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const n = inp.n, edges = G.parse(inp.graph), m = edges.length, dir = isDirected(inp), x = inp.x;
      const memo = ctx.memo;
      if (memo.at !== ctx.i) {
        memo.at = ctx.i;
        if (tag === 'after') memo.afters = (memo.afters || 0) + 1;
        if (d.fn === 'neighbours') memo.phase2 = true;
        if (tag === 'found') (memo.found = memo.found || []).push(d.w);
      }
      const p2 = !!memo.phase2;
      const found = memo.found || [];
      const { pos, box } = graphAt(inp);
      const inc = d.inc;
      const cur = d.i !== null && d.i < m ? d.i : -1;
      const items = G.picture({
        n, edges, pos,
        vcls: (v) => 'gw-sub ' + (p2 && v === x ? 'focus hot' : p2 && tag === 'test-end' && v === d.w ? 'hot' : found.includes(v) ? 'part-a' : !p2 && cur >= 0 && (v === edges[cur][0] || v === edges[cur][1]) ? 'hot' : ''),
        ecls: (u, v) => { const k = edges.findIndex((e) => e[0] === u && e[1] === v); if (k === cur && tag !== 'after') return 'hot'; if (p2) return inc[x][k] === 1 ? 'part-a' : 'gw-faint'; return inc[u][k] ? 'part-b' : 'gw-faint'; },
      });
      // the matrix: rows are vertices, columns are edges
      const cell = 44;
      const gx = box.x1 + 110, gy = Math.min(box.y0 + 30, (box.y0 + box.y1) / 2 - n * cell / 2 + 10);
      const g = { x0: gx, y0: gy, cell, rows: [...Array(n).keys()], cols: edges.map((e, k) => 'e' + k) };
      g.text = (r, c) => inc[r][c];
      g.cls = (r, c) => {
        if (c === cur && tag !== 'after' && ((tag === 'set-u' && r === edges[c][0]) || (tag === 'set-v' && r === edges[c][1]) || (p2 && tag === 'test-end' && r === d.w) || (p2 && tag === 'test-edge' && r === x))) return 'hot';
        return inc[r][c] === 1 ? 'gw-one' : inc[r][c] === -1 ? 'gw-minus' : 'gw-zero';
      };
      g.rowCls = (r) => (p2 && r === x ? 'gw-hot' : 'gw-label');
      g.colCls = (c) => (c === cur && tag !== 'after' ? 'gw-hot' : 'gw-label');
      if (p2) items.push({ key: 'bandR', kind: 'region', x: gx - 30, y: gy + x * cell - 2, w: Math.max(1, m) * cell + 32, h: cell + 1, cls: 'gw-band' });
      if (cur >= 0 && tag !== 'after') items.push({ key: 'bandC', kind: 'region', x: gx + cur * cell - 2, y: gy - 46, w: cell + 1, h: n * cell + 48, cls: 'gw-band' });
      items.push(...GW.grid('ix', g));
      edges.forEach((e, k) => items.push({ key: 'ixe' + k, kind: 'text', x: gx + k * cell + cell / 2 - 2, y: gy - 30, text: e[0] + (dir ? '>' : '-') + e[1], cls: 'gw-small', anchor: 'middle' }));
      items.push({ key: 'ixT', kind: 'text', x: gx - 30, y: gy - 56, text: 'inc: row = vertex, column = edge', cls: 'gw-title' });
      if (p2 && tag === 'test-end' && d.w !== null && d.w < n && cur >= 0) items.push({ key: 'cw', kind: 'cursor', at: 'ixc' + d.w + '_' + cur, side: 'right', text: 'w', cls: 'c-amber' });
      if (p2) items.push({ key: 'out', kind: 'text', x: gx - 30, y: gy + n * cell + 34, text: 'neighbours of ' + x + ': ' + (found.length ? found.join(', ') : '…'), cls: 'gw-note' });
      const view = GW.view([box, { x0: gx - 40, y0: gy - 76, x1: gx + Math.max(4, m) * cell, y1: gy + n * cell + 44 }]);
      let say = '';
      const e = cur >= 0 ? edges[cur] : null;
      switch (tag) {
        case 'enter': say = 'build_incidence(): ' + n + ' rows (vertices) and ' + m + ' columns (edges), all 0 to begin with.'; break;
        case 'loop': say = cur >= 0 ? 'Column ' + cur + ' is edge ' + e[0] + (dir ? ' → ' : ' – ') + e[1] + '.' : 'All ' + m + ' columns are filled. Each one has exactly two marks.'; break;
        case 'set-u': say = 'inc[' + e[0] + '][' + cur + '] = 1: edge ' + cur + ' touches ' + e[0] + '.'; break;
        case 'set-v': say = dir ? 'inc[' + e[1] + '][' + cur + '] = -1: edge ' + cur + ' arrives at ' + e[1] + '. The sign keeps the direction.' : 'inc[' + e[1] + '][' + cur + '] = 1: the other end, ' + e[1] + '. Column ' + cur + ' is complete.'; break;
        case 'after': say = (memo.afters || 0) < 2 ? 'The matrix is built: ' + n + ' × ' + m + ' cells for ' + m + ' edges. Now neighbours(' + x + ') uses it.' : 'Done: the neighbours of ' + x + ' are ' + (found.length ? found.join(', ') : 'none') + '. It took a scan of row ' + x + ' (' + m + ' cells) and a scan of n = ' + n + ' cells down each of its columns.'; break;
        case 'scan-edge': say = cur >= 0 ? 'Look at edge ' + cur + ' in row ' + x + '.' : 'Row ' + x + ' has been read to the end.'; break;
        case 'test-edge': say = inc[x][cur] === 1 ? 'inc[' + x + '][' + cur + '] is 1: edge ' + cur + ' leaves ' + x + '. Find its other end.' : inc[x][cur] === -1 ? 'inc[' + x + '][' + cur + '] is -1: edge ' + cur + ' comes into ' + x + ', so it does not lead anywhere from ' + x + '.' : 'inc[' + x + '][' + cur + '] is 0: edge ' + cur + ' does not touch ' + x + '.'; break;
        case 'scan-col': say = d.w < n ? 'Down column ' + cur + ': row ' + d.w + '.' : 'Column ' + cur + ' has been read to the bottom.'; break;
        case 'test-end': say = d.w === x ? 'Row ' + x + ' is x itself: skip it.' : inc[d.w][cur] ? 'inc[' + d.w + '][' + cur + '] is not 0: ' + d.w + ' is the other end.' : 'inc[' + d.w + '][' + cur + '] is 0.'; break;
        case 'found': say = d.w + ' is a neighbour of ' + x + '.'; break;
      }
      return { items, say, view };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'test-edge' && ts[i + 1] && ts[i + 1].tag === 'scan-col', once: true, ask: (t, ts, i, ctx) => 'Edge ' + t.data.i + ' leaves ' + ctx.input.x + '. Click the vertex at its other end.', answer: (ts, i, ctx) => { const e = G.parse(ctx.input.graph)[ts[i].data.i]; return 'gv' + (e[0] === ctx.input.x ? e[1] : e[0]); }, explain: () => 'The only other row with a mark in this column.' },
      { at: (t) => t.tag === 'enter', once: true, ask: 'How many non-zero cells will each column have?', options: () => ['1', '2', 'Up to n', 'It depends on the vertex'], answer: () => '2', pick: 'option', explain: () => 'An edge has exactly two ends, so its column has two marks.' },
    ],
    quiz: [
      { q: 'How many non-zero entries does each column of an incidence matrix have?', options: ['Exactly 2', 'Up to n', 'Exactly 1', 'The degree of the vertex'], answer: 0, why: 'A column is an edge, and an edge has two ends.' },
      { q: 'What does row x add up to (undirected, 1s only)?', options: ['The number of edges', 'The degree of x', 'n', '2'], answer: 1, why: 'Row x has a 1 for every edge that touches x.' },
      { q: 'How long does neighbours(x) take?', options: ['O(degree)', 'O(m + degree · n)', 'O(1)', 'O(log n)'], answer: 1, why: 'It reads all m cells of row x, and for each edge of x a column of n cells.' },
      { q: 'Compared with an adjacency matrix, an incidence matrix for a graph with many more edges than vertices is...', options: ['Smaller', 'Bigger: n × m instead of n × n', 'The same size', 'Impossible'], answer: 1, why: 'It has one column per edge, so it grows with n · m.' },
    ],
  });
})(SEE);
