// Graphs: minimum spanning trees. Prim grows one tree across a cut, Kruskal merges a forest edge by
// edge, and the union-find structure Kruskal needs, on its own (union by rank, path compression).
(function (SEE) {
  'use strict';
  const X = SEE.Strux, G = X.GraphKit, W = X.WGraphKit;

  const base = `#include <stdio.h>

#define MAXV 10`;
  X.family({
    id: 'mst', order: 3, group: 'Graphs', title: 'Spanning trees',
    blurb: 'Connect every vertex with the cheapest set of edges: no cycles, n-1 edges. Two greedy plans, and the disjoint-set forest that makes one of them fast.',
    head: (t) => {
      if (t.id === 'kruskal') return base + `

/* one undirected edge between u and v, costing w */
struct edge {
    int u, v, w;
};

/* the sets of vertices already joined: a forest, each set a tree */
int parent[MAXV];`;
      if (t.id === 'union-find') return base + `

int parent[MAXV];      /* the node above x; a root is its own parent */
int rank[MAXV];        /* for a root: an upper bound on its tree's height */

/* every element starts alone, as the root of its own one-node tree */
void make_sets(int n)
{
    int x;
    for (x = 0; x < n; x++) {
        parent[x] = x;
        rank[x] = 0;
    }
}`;
      return base + `
#define INF 1000000

/* adj[u][v] is the weight of the edge between u and v; 0 means no edge */
int adj[MAXV][MAXV];
int key[MAXV];         /* the cheapest edge known from the tree to v */
int parent[MAXV];      /* the tree vertex at the other end of that edge */
int intree[MAXV];      /* 1 once v has joined the tree */`;
    },
  });

  const city = { n: 6, graph: '0-1:7 0-2:9 0-5:14 1-2:10 1-3:15 2-3:11 2-5:2 3-4:6 4-5:9', pos: [[-250, 90], [-100, 210], [-40, 40], [170, 160], [240, -90], [-150, -110]] };
  const undirected = (opts) => G.input(city.graph, Object.assign({ label: 'Edges with weights (0-1:7)', weighted: true }, opts));
  const checkUndirected = (inp, most) => {
    const edges = G.parse(inp.graph);
    if (edges.some((e) => e[3])) return 'Edges: a spanning tree is for an undirected graph, so write edges like 0-1:4';
    if (edges.some((e) => e[2] < 1 || e[2] > 99)) return 'Edges: weights from 1 to 99';
    if (edges.length > most) return 'Edges: at most ' + most + ', so the picture stays readable';
    const seen = new Set();
    for (const [u, v] of edges) { const k = Math.min(u, v) + '-' + Math.max(u, v); if (seen.has(k)) return 'Edges: ' + k + ' is given twice'; seen.add(k); }
    return null;
  };
  const list = (xs) => (xs.length ? xs.join(', ') : 'none');
  const num = (v) => (v === null || v === undefined ? null : v);
  const same = (a, b, u, v) => (a === u && b === v) || (a === v && b === u);
  const adjOf = (inp) => {
    const m = Array.from({ length: inp.n }, () => new Array(inp.n).fill(0));
    for (const [u, v, w] of G.parse(inp.graph)) { m[u][v] = w; m[v][u] = w; }
    return m;
  };

  // ---- Prim -----------------------------------------------------------------------------------------------
  X.topic({
    id: 'prim', family: 'mst', order: 10, title: "Prim's algorithm",
    blurb: 'Grow one tree from a start vertex. At every step take the cheapest edge that leaves the tree: it crosses the cut between inside and outside.',
    code: `/* nothing is in the tree yet; s will be the first to join */
void init_keys(int n, int s)
{
    int v;
    for (v = 0; v < n; v++) {
        key[v] = INF;
        parent[v] = -1;
        intree[v] = 0;
    }
    key[s] = 0;
}

/* grow a minimum spanning tree from s; returns its total weight,
   or -1 when the graph is not connected */
int prim(int n, int s)
{
    int i, k, u, v, total = 0;                             /*@ decl */
    init_keys(n, s);                                       /*@ init */
    for (k = 0; k < n; k++) {                              /*@ round */
        u = -1;                                            /*@ pick-none */
        for (i = 0; i < n; i++)                            /*@ scan */
            if (!intree[i] && (u == -1 || key[i] < key[u]))    /*@ cmp-min */
                u = i;                                     /*@ new-min */
        if (key[u] == INF)                                 /*@ test-reach */
            return -1;                                     /*@ stop */
        intree[u] = 1;                                     /*@ join */
        total += key[u];                                   /*@ add */
        for (v = 0; v < n; v++)                            /*@ scan-v */
            if (adj[u][v] && !intree[v] && adj[u][v] < key[v]) {   /*@ cmp-edge */
                key[v] = adj[u][v];                        /*@ lower */
                parent[v] = u;                             /*@ parent */
            }
    }
    return total;                                          /*@ done */
}`,
    animate: ['prim'], quiet: ['init_keys'],
    inputs: [{ id: 'n', kind: 'int', label: 'Vertices', def: 6, lo: 1, hi: 8 }, undirected(), { id: 'pos', kind: 'hidden', def: city.pos }, { id: 's', kind: 'int', label: 'Start at', def: 0, lo: 0, hi: 9 }],
    check: (inp) => checkUndirected(inp, 14) || (inp.s >= inp.n ? 'Start at: a vertex from 0 to ' + (inp.n - 1) : null),
    presets: [
      { label: 'Small city', values: Object.assign({ s: 0 }, city) },
      { label: 'Square and diagonal', values: { n: 5, s: 0, graph: '0-1:4 1-2:4 2-3:4 3-0:4 0-2:1 2-4:3 3-4:2', pos: [[-180, -140], [180, -140], [180, 140], [-180, 140], [20, 230]] } },
      { label: 'Not connected', values: { n: 6, s: 0, graph: '0-1:4 1-2:3 0-2:8 3-4:1 4-5:2 3-5:5', pos: [[-240, 0], [-110, -130], [-110, 130], [110, -50], [240, -150], [240, 60]] } },
      { label: 'Start elsewhere', values: Object.assign({}, city, { s: 4 }) },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => X.graphMain(inp, 'printf("total weight %d\\n", prim(' + inp.n + ', ' + inp.s + '));'),
    capture(P) {
      const sc = (x) => (P.has(x, 0) && P.isSet(x, 0) ? P.val(x, 0) : null);
      return { key: P.arr('key', 10), parent: P.arr('parent', 10), intree: P.arr('intree', 10), k: sc('k'), u: sc('u'), v: sc('v'), i: sc('i'), total: sc('total') };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, n = inp.n, memo = ctx.memo;
      const edges = G.parse(inp.graph), A = adjOf(inp), pos = W.positions(inp);
      const key = d.key.slice(0, n), par = d.parent.slice(0, n).map((p) => (p === null ? -1 : p)), inT = d.intree.slice(0, n).map((x) => !!x);
      const pd = ctx.prev ? ctx.prev.data : null;
      const started = !['enter', 'decl'].includes(tag);
      if (d.total !== null) memo.total = d.total;
      if (d.u !== null) memo.u = d.u;
      const u = tag === 'done' || tag === 'stop' ? memo.u : num(d.u), v = num(d.v), i = num(d.i);
      memo.joined = memo.joined || [];
      if (tag === 'join' && !memo.joined.some((x) => x.v === u)) memo.joined.push({ v: u, p: par[u], w: key[u] });
      const expanding = ['scan-v', 'cmp-edge', 'lower', 'parent', 'join', 'add'].includes(tag) && u !== null && u >= 0;
      const edgeNow = ['scan-v', 'cmp-edge', 'lower', 'parent'].includes(tag) && v !== null && v < n && A[u][v];
      const oldPar = tag === 'parent' && pd ? pd.parent[v] : -1;
      const joining = tag === 'join' && par[u] >= 0;
      const items = W.graph({
        n, edges, pos,
        vcls: (x) => (inT[x] ? 'done' : '') + (expanding && x === u ? ' focus' : '') + ((tag === 'cmp-min' || tag === 'new-min') && x === i ? ' hot' : '') + (edgeNow && x === v && !inT[x] ? ' hot' : ''),
        ecls: (a, b) => {
          if (edgeNow && same(a, b, u, v)) return 'hot';
          if (joining && same(a, b, par[u], u)) return 'hot';
          if (oldPar !== null && oldPar >= 0 && oldPar !== u && same(a, b, oldPar, v)) return 'bad';
          if (inT[a] && inT[b] && (par[a] === b || par[b] === a)) return 'part-a';
          if (inT[a] !== inT[b] && started) return ((!inT[b] && par[b] === a) || (!inT[a] && par[a] === b)) ? 'cand' : 'cut';
          if (inT[a] && inT[b]) return 'dim';
          return '';
        },
      });
      // keys only matter outside the tree: a vertex that joins drops its badge
      items.push(...W.badges('gk', pos, (x) => (!started || (inT[x] && !(tag === 'join' && x === u)) ? '' : tag === 'lower' && x === v ? W.fmt(pd.key[v]) + ' → ' + key[v] : W.fmt(key[x])),
        (x) => (tag === 'lower' && x === v ? 'drop' : tag === 'join' && x === u ? 'final' : W.isInf(key[x]) ? 'inf' : ''), { flash: (x) => tag === 'lower' && x === v }));
      // the tree so far, edge by edge, and its weight
      const b = W.box(pos);
      const lx = b.x1 + 100, ly = b.y0 - 10;
      items.push({ key: 'lt', kind: 'text', x: lx, y: ly - 14, text: 'tree edges, in join order', cls: 'gb-head' });
      memo.joined.filter((x) => x.p >= 0).forEach((x, k) => {
        items.push({ key: 'te' + x.v, kind: 'node', x: lx, y: ly + k * 40, w: 150, h: 32, cells: [{ text: x.p + '–' + x.v, w: 1.6 }, { text: x.w, w: 1, cls: 'w' }], cls: 'gb-row took' + (tag === 'join' && x.v === u ? ' focus' : ''), enter: 'fly', from: { x: (pos[x.p].x + pos[x.v].x) / 2, y: (pos[x.p].y + pos[x.v].y) / 2 } });
      });
      const rows = Math.max(1, memo.joined.filter((x) => x.p >= 0).length);
      items.push({ key: 'total', kind: 'text', x: lx, y: ly + Math.max(rows, n - 1) * 40 + 24, text: started ? 'total = ' + (memo.total === undefined ? 0 : memo.total) : '', cls: 'gb-sum' + (tag === 'done' || tag === 'after' ? ' good' : '') });
      const ty = b.y0 - 120;
      const inside = inT.map((x, k) => (x ? k : -1)).filter((x) => x >= 0);
      items.push({ key: 'title', kind: 'text', x: b.x0 - 40, y: ty, text: 'Prim from ' + inp.s + (d.k !== null && d.k < n && started ? '  ·  ' + inside.length + ' of ' + n + ' in the tree' : ''), cls: 'gb-title' });
      let formula = '', fcls = 'gb-sum';
      if (tag === 'cmp-edge' && edgeNow) {
        if (inT[v]) { formula = v + ' is in the tree already'; fcls += ' muted'; }
        else { formula = 'edge ' + u + '–' + v + ' = ' + A[u][v] + (A[u][v] < key[v] ? '  <  ' : '  ≥  ') + 'key[' + v + '] = ' + W.fmt(key[v]); if (A[u][v] < key[v]) fcls += ' good'; }
      }
      if (joining) { formula = 'cheapest edge across the cut: ' + par[u] + '–' + u + ' = ' + key[u]; fcls += ' good'; }
      items.push({ key: 'formula', kind: 'text', x: b.x0 - 40, y: ty + 34, text: formula, cls: fcls });
      items.push({ key: 'legend', kind: 'text', x: b.x0 - 40, y: b.y1 + 100, text: started ? 'dashed amber: edges crossing the cut   ·   blue: the cheapest known edge to each outside vertex' : '', cls: 'gb-note muted' });
      if (u !== null && u >= 0 && u < n && expanding) items.push({ key: 'cu', kind: 'cursor', at: 'gv' + u, side: W.freeSide(pos, u), text: 'u', cls: 'c-rose' });
      if ((tag === 'scan' || tag === 'cmp-min' || tag === 'new-min') && i !== null && i < n) items.push({ key: 'ci', kind: 'cursor', at: 'gv' + i, side: W.freeSide(pos, i), text: 'i', cls: 'c-amber' });
      if (edgeNow) items.push({ key: 'cv', kind: 'cursor', at: 'gv' + v, side: W.freeSide(pos, v), text: 'v', cls: 'c-indigo' });
      const view = { x: b.x0 - 90, y: ty - 40, w: lx + 210 - (b.x0 - 90), h: b.y1 + 130 - (ty - 40) };

      let say = '';
      const outside = inT.map((x, k) => (x ? -1 : k)).filter((x) => x >= 0);
      switch (tag) {
        case 'enter': say = 'prim(' + n + ', ' + inp.s + '): connect all ' + n + ' vertices with the cheapest set of edges, growing one tree from ' + inp.s + '.'; break;
        case 'decl': say = 'total will add up the weights of the edges that join the tree.'; break;
        case 'init': say = 'init_keys(): key[v] is the cheapest edge known from the tree to v. Nothing is known yet, so every key is ∞, except key[' + inp.s + '] = 0 so that ' + inp.s + ' joins first.'; break;
        case 'round': say = d.k < n ? 'Round ' + (d.k + 1) + ': one more vertex joins the tree. Inside: ' + list(inside) + '.' : 'All ' + n + ' vertices are in the tree.'; break;
        case 'pick-none': say = 'Look for the outside vertex with the smallest key: the cheapest edge leaving the tree.'; break;
        case 'scan': say = i < n ? 'Vertex ' + i + (inT[i] ? ' is inside the tree.' : ': key ' + W.fmt(key[i]) + '.') : 'The smallest key outside the tree is key[' + u + '] = ' + W.fmt(key[u]) + '.'; break;
        case 'cmp-min': {
          const prevU = pd ? num(pd.u) : null;
          if (inT[i]) say = i + ' is already in the tree: skip it.';
          else if (prevU === -1 || prevU === null) say = i + ' is the first outside vertex: the best so far.';
          else say = key[i] < key[prevU] ? 'key[' + i + '] = ' + W.fmt(key[i]) + ' is smaller than key[' + prevU + '] = ' + W.fmt(key[prevU]) + ': a new best.' : 'key[' + i + '] = ' + W.fmt(key[i]) + ' is not smaller than ' + W.fmt(key[prevU]) + ': keep u = ' + prevU + '.';
          break;
        }
        case 'new-min': say = 'u = ' + u + ' for now.'; break;
        case 'test-reach': say = W.isInf(key[u]) ? 'The smallest key is ∞: no edge at all leaves the tree, yet ' + list(outside) + ' are still outside.' : 'key[' + u + '] = ' + key[u] + ': ' + u + ' can be joined.'; break;
        case 'stop': say = 'Return -1: the graph is not connected, so no spanning tree exists. (Running Prim again from an outside vertex would give a spanning forest.)'; break;
        case 'join': say = par[u] >= 0 ? u + ' joins the tree through the edge ' + par[u] + '–' + u + ', weight ' + key[u] + '. It is the cheapest edge crossing the cut between the tree and the rest, and such an edge is always safe to take.' : u + ' is the first vertex in the tree.'; break;
        case 'add': say = 'total = ' + memo.total + '.'; break;
        case 'scan-v': say = v < n ? (A[u][v] ? 'The edge ' + u + '–' + v + ' costs ' + A[u][v] + '.' : 'No edge between ' + u + ' and ' + v + '.') : 'Every edge of ' + u + ' looked at: the keys of its outside neighbours are up to date.'; break;
        case 'cmp-edge': say = !A[u][v] ? 'No edge between ' + u + ' and ' + v + '.' : inT[v] ? v + ' is inside the tree: that edge would make a cycle.' : A[u][v] < key[v] ? 'The edge ' + u + '–' + v + ' (' + A[u][v] + ') is cheaper than ' + v + "'s best so far (" + W.fmt(key[v]) + ').' : 'The edge ' + u + '–' + v + ' (' + A[u][v] + ') is not cheaper than ' + v + "'s best so far (" + key[v] + ').'; break;
        case 'lower': say = 'key[' + v + '] drops from ' + W.fmt(pd.key[v]) + ' to ' + key[v] + '.' + (memo.saidKey === undefined || memo.saidKey === ctx.i ? ' Just the edge weight: Prim does not add the distance from the start, which is the one difference from Dijkstra.' : ''); if (memo.saidKey === undefined) memo.saidKey = ctx.i; break;
        case 'parent': say = 'parent[' + v + '] = ' + u + ': if ' + v + ' joins, it will hang from ' + u + '.' + (oldPar >= 0 && oldPar !== u ? ' The old candidate edge ' + oldPar + '–' + v + ' is forgotten.' : ''); break;
        case 'done': say = 'Return ' + memo.total + ': the weight of a minimum spanning tree, ' + (n - 1) + ' edges.'; break;
        case 'after': say = memo.total !== undefined && ctx.ticks.some((t) => t.tag === 'stop') ? 'prim() returned -1: the green part is a minimum spanning tree of the part reachable from ' + inp.s + ' only.' : 'Done. The green edges form a minimum spanning tree of weight ' + memo.total + '. No other set of ' + (n - 1) + ' edges connecting every vertex is cheaper.'; break;
      }
      return { items, say, view, slow: tag === 'join' };
    },
    predict: [
      {
        at: (t, i, ts, ctx) => t.tag === 'pick-none' && t.data.intree.slice(0, ctx.input.n).some((x) => x),
        once: true, ask: 'Which vertex joins the tree next? Click it.',
        answer: (ts, i, ctx) => { const d = ts[i].data; let u = -1; for (let k = 0; k < ctx.input.n; k++) if (!d.intree[k] && (u === -1 || d.key[k] < d.key[u])) u = k; return u >= 0 && !W.isInf(d.key[u]) ? 'gv' + u : null; },
        explain: (ts, i, ctx) => { const d = ts[i].data; let u = -1; for (let k = 0; k < ctx.input.n; k++) if (!d.intree[k] && (u === -1 || d.key[k] < d.key[u])) u = k; return 'The outside vertex with the smallest key, ' + u + ': its edge ' + d.parent[u] + '–' + u + ' (' + d.key[u] + ') is the cheapest one leaving the tree.'; },
      },
      {
        at: (t, i, ts, ctx) => { t = ts[i + 1]; if (!t) return false; const d = t.data; if (t.tag !== 'cmp-edge' || d.v === null || d.v >= ctx.input.n) return false; const w = adjOf(ctx.input)[d.u][d.v]; return w && !d.intree[d.v] && d.key[d.u] > 0 && w < d.key[d.v]; },
        once: true, pick: 'option',
        ask: (t, ts, i, ctx) => { const d = t.data, w = adjOf(ctx.input)[d.u][d.v]; return 'u = ' + d.u + ' has just joined (key ' + d.key[d.u] + '). The edge ' + d.u + '–' + d.v + ' costs ' + w + ' and key[' + d.v + '] = ' + W.fmt(d.key[d.v]) + '. What will key[' + d.v + '] be?'; },
        options: (ts, i, ctx) => { const d = ts[i].data, w = adjOf(ctx.input)[d.u][d.v]; return [String(w), String(d.key[d.u] + w), W.fmt(d.key[d.v])]; },
        answer: (ts, i, ctx) => String(adjOf(ctx.input)[ts[i].data.u][ts[i].data.v]),
        explain: () => 'The key is the weight of the single edge that would connect the vertex to the tree. Adding the distance from the start would be Dijkstra.',
      },
    ],
    quiz: [
      { q: 'Why is the cheapest edge crossing the cut always safe to add?', options: ['Because it touches the start', 'Any spanning tree must cross the cut somewhere; swapping in the cheapest crossing edge never costs more', 'Because it was found first', 'It is not always safe'], answer: 1, why: 'This is the cut property: a spanning tree without it can trade one of its crossing edges for it and get no heavier.' },
      { q: 'What is the one change that turns this Dijkstra code into Prim?', options: ['Using a stack', 'Comparing adj[u][v] with key[v] instead of dist[u] + adj[u][v] with dist[v]', 'Sorting the edges', 'Starting from every vertex'], answer: 1, why: 'Both settle the smallest label each round. Prim\'s label is the cost of one connecting edge, not a path length.' },
      { q: 'Does the start vertex change the total weight of the tree Prim builds?', options: ['Yes, always', 'No: every minimum spanning tree has the same total weight', 'Only for odd n', 'Only with ties'], answer: 1, why: 'The tree may differ when weights tie, but the minimum total is the same.' },
      { q: 'How many edges does a spanning tree of n connected vertices have?', options: ['n', 'n - 1', 'n + 1', 'It depends on the edges'], answer: 1, why: 'Each vertex except the first joins through exactly one edge.' },
      { q: 'With the array scan used here, how long does Prim take?', options: ['O(n)', 'O(n²)', 'O(m log m)', 'O(n³)'], answer: 1, why: 'n rounds, each scanning n keys and one row of the matrix. That is ideal for dense graphs.' },
    ],
    compareWith: 'kruskal',
  });

  // ---- Kruskal --------------------------------------------------------------------------------------------
  const sortedOrder = (es) => es.map((e, k) => k).sort((a, b) => es[a].w - es[b].w);
  /** The path between u and v using only the taken edges (to show the cycle an edge would close) */
  const treePath = (n, taken, u, v) => {
    const prev = new Array(n).fill(-2);
    prev[u] = -1;
    const q = [u];
    while (q.length) {
      const x = q.shift();
      if (x === v) break;
      for (const e of taken) {
        const y = e.u === x ? e.v : e.v === x ? e.u : -1;
        if (y >= 0 && prev[y] === -2) { prev[y] = x; q.push(y); }
      }
    }
    if (prev[v] === -2) return [];
    const p = [];
    for (let x = v; x !== -1; x = prev[x]) p.push(x);
    return p;
  };
  /** Small forest items for parent[]: vertices keyed prefix+v, arrows child -> parent */
  const forest = (prefix, par, opts) => {
    const L = W.forestLayout(par, { dx: opts.dx || 54, dy: opts.dy || 62, x0: opts.x0, y0: opts.y0, center: opts.center });
    const items = [];
    par.forEach((p, v) => {
      const root = W.rootOf(par, v);
      items.push({ key: prefix + 'v' + v, kind: 'vertex', x: L.pos[v].x, y: L.pos[v].y, r: opts.r || 18, text: v, cls: 'gb-small ' + W.setCls(root) + (opts.vcls ? ' ' + (opts.vcls(v) || '') : '') + (p === v ? ' gb-root' : '') });
      if (p !== v && p !== null && p >= 0) items.push({ key: prefix + 'a' + v, kind: 'arrow', from: { key: prefix + 'v' + v }, to: { key: prefix + 'v' + p }, cls: 'gb-up' + (opts.acls ? ' ' + (opts.acls(v) || '') : '') });
    });
    return { items, L };
  };
  X.ufForest = forest;
  const cycles = { n: 5, graph: '2-3:4 0-4:9 1-2:2 3-4:6 0-1:1 2-4:7 0-2:3 1-3:5', pos: [[-220, -40], [-60, -170], [20, 20], [200, -80], [150, 170]] };

  X.topic({
    id: 'kruskal', family: 'mst', order: 20, title: "Kruskal's algorithm",
    blurb: 'Sort all edges by weight and take them cheapest first, skipping any edge whose ends are already connected. A union-find forest answers that question.',
    code: `/* insertion sort of the edges by weight, lightest first */
void sort_edges(struct edge e[], int m)
{
    int i, j;
    struct edge t;
    for (i = 1; i < m; i++) {
        t = e[i];
        for (j = i - 1; j >= 0 && e[j].w > t.w; j--)
            e[j + 1] = e[j];
        e[j + 1] = t;
    }
}

/* the root of the tree that holds x */
int find(int x)
{
    while (parent[x] != x)
        x = parent[x];
    return x;
}

/* the weight of a minimum spanning tree (or forest) */
int kruskal(struct edge e[], int m, int n)
{
    int i, a, b, total = 0, taken = 0;                     /*@ decl */
    sort_edges(e, m);                                      /*@ sort */
    for (i = 0; i < n; i++)                                /*@ init */
        parent[i] = i;                                     /*@ init-set */
    for (i = 0; i < m && taken < n - 1; i++) {             /*@ next */
        a = find(e[i].u);                                  /*@ find-u */
        b = find(e[i].v);                                  /*@ find-v */
        if (a == b)                                        /*@ same */
            continue;                                      /*@ reject */
        parent[a] = b;                                     /*@ union */
        total += e[i].w;                                   /*@ take */
        taken++;                                           /*@ count */
    }
    return total;                                          /*@ done */
}`,
    animate: ['kruskal'], quiet: ['sort_edges', 'find'],
    inputs: [{ id: 'n', kind: 'int', label: 'Vertices', def: cycles.n, lo: 1, hi: 8 }, undirected({ def: cycles.graph }), { id: 'pos', kind: 'hidden', def: cycles.pos }],
    check: (inp) => checkUndirected(inp, 11) || (G.parse(inp.graph).length ? null : 'Edges: give at least one edge'),
    presets: [
      { label: 'Many cycles', values: cycles },
      { label: 'Small city', values: Object.assign({}, city) },
      { label: 'Not connected', values: { n: 6, graph: '0-1:4 1-2:3 0-2:8 3-4:1 4-5:2 3-5:5', pos: [[-240, 0], [-110, -130], [-110, 130], [110, -50], [240, -150], [240, 60]] } },
      { label: 'Equal weights', values: { n: 4, graph: '0-1:5 1-2:5 2-3:5 3-0:5 0-2:5', pos: [[-160, -130], [160, -130], [160, 130], [-160, 130]] } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => {
      const es = G.parse(inp.graph);
      return `int main(void)
{
    struct edge e[] = {
        ${es.map((x) => '{ ' + x[0] + ', ' + x[1] + ', ' + x[2] + ' }').join(',\n        ')}
    };
    printf("total weight %d\\n", kruskal(e, ${es.length}, ${inp.n}));
    return 0;
}`;
    },
    capture(P) {
      const sc = (x) => (P.has(x, 0) && P.isSet(x, 0) ? P.val(x, 0) : null);
      return { parent: P.arr('parent', 10), i: sc('i'), a: sc('a'), b: sc('b'), total: sc('total'), taken: sc('taken') };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, n = inp.n, memo = ctx.memo;
      const edges = G.parse(inp.graph), pos = W.positions(inp).map((p) => ({ x: p.x * 0.82, y: p.y * 0.82 }));
      const es = edges.map(([u, v, w]) => ({ u, v, w }));
      const m = es.length;
      const sorted = !['enter', 'decl'].includes(tag);
      const order = tag === 'enter' || tag === 'decl' ? es.map((e, k) => k) : sortedOrder(es);
      const setsOn = ['init-set', 'next', 'find-u', 'find-v', 'same', 'reject', 'union', 'take', 'count', 'done', 'after'].includes(tag) || (tag === 'init' && d.i !== null && d.i > 0);
      const par = d.parent.slice(0, n).map((p, k) => (setsOn && p !== null ? p : k));
      if (d.total !== null) memo.total = d.total;
      if (d.taken !== null) memo.taken = d.taken;
      if (d.i !== null) memo.i = d.i;
      const i = d.i !== null ? d.i : memo.i;
      const inLoop = ['next', 'find-u', 'find-v', 'same', 'reject', 'union', 'take', 'count'].includes(tag) && i !== null && i < m;
      const e = inLoop ? es[order[i]] : null;
      // the two roots, worked out from parent[] as find() sees it (find changes nothing here)
      if (tag === 'next' && e) { memo.a = W.rootOf(par, e.u); memo.b = W.rootOf(par, e.v); }
      const ra = memo.a, rb = memo.b;
      memo.status = memo.status || {};
      if (tag === 'reject') memo.status[order[i]] = 'no';
      if (tag === 'union') memo.status[order[i]] = 'took';
      const taken = Object.keys(memo.status).filter((k) => memo.status[k] === 'took').map((k) => es[k]);
      const rejecting = (tag === 'same' || tag === 'reject') && e && ra === rb;
      const cyc = rejecting ? treePath(n, taken, e.u, e.v) : [];
      const onCyc = (a, b) => cyc.some((x, k) => k && same(a, b, cyc[k - 1], x));
      const rootOf = (x) => W.rootOf(par, x);
      // the graph: each vertex coloured by the set it is in
      const items = W.graph({
        n, edges, pos,
        vcls: (x) => (setsOn ? W.setCls(rootOf(x)) : '') + (e && (x === e.u || x === e.v) ? ' focus' : ''),
        ecls: (a, b) => {
          const k = es.findIndex((q) => same(a, b, q.u, q.v));
          if (e && same(a, b, e.u, e.v)) return rejecting ? 'bad' : 'hot';
          if (onCyc(a, b)) return 'hot';
          if (memo.status[k] === 'took') return 'part-a';
          if (memo.status[k] === 'no') return 'dim';
          return '';
        },
      });
      // the sorted edge list
      const b = W.box(pos);
      const lx = b.x1 + 100, ly = b.y0 - 30, rh = 32;
      items.push({ key: 'lt', kind: 'text', x: lx, y: ly - 14, text: sorted ? 'edges, lightest first' : 'edges, as given', cls: 'gb-head' });
      order.forEach((k, r) => {
        const st = memo.status[k];
        const cur = inLoop && r === i;
        const mark = st === 'took' ? '✓' : st === 'no' ? '✗' : '';
        items.push({ key: 'row' + k, kind: 'node', x: lx, y: ly + r * (rh + 6), w: 160, h: rh, cells: [{ text: es[k].w, w: 0.9, cls: 'w' }, { text: es[k].u + '–' + es[k].v, w: 1.5 }, { text: mark, w: 0.7 }], cls: 'gb-row ' + (cur && rejecting ? 'bad' : cur ? 'focus' : st || (sorted && inLoop && r > i ? 'later' : '')), arc: tag === 'sort' ? 40 : 0 });
      });
      if (inLoop) items.push({ key: 'ri', kind: 'cursor', at: 'row' + order[i], side: 'right', text: 'i', cls: 'c-amber' });
      // the union-find forest, small, under the graph
      const fy = ly + m * (rh + 6) + 76;
      let fpath = [];
      if (tag === 'find-u' && e) fpath = [e.u];
      if ((tag === 'find-v' || tag === 'same' || tag === 'reject') && e) fpath = [e.u, e.v];
      const onPath = new Set();
      for (const s of fpath) { let x = s, g = 0; onPath.add(x); while (par[x] !== x && g++ < 20) { x = par[x]; onPath.add(x); } }
      if (setsOn) {
        items.push({ key: 'ft', kind: 'text', x: lx, y: fy - 36, text: 'union-find forest (parent[])', cls: 'gb-head' });
        const F = forest('f', par, { x0: lx + 18, y0: fy, dy: 52, dx: 48, vcls: (x) => (onPath.has(x) ? 'gb-path' : '') + (tag === 'union' && x === ra ? ' focus' : ''), acls: (x) => (onPath.has(x) && onPath.has(par[x]) ? 'hot' : '') });
        items.push(...F.items);
      }
      if (memo.fh === undefined) {
        // the forest is deepest at the end: size the view for that once, so the camera stays still
        const last = ctx.ticks[ctx.ticks.length - 1].data.parent.slice(0, n).map((p, k) => (p === null ? k : p));
        memo.fh = Math.max(0, ...W.forestLayout(last, { dy: 52 }).depth) * 52;
      }
      const ty = b.y0 - 100;
      const nTaken = memo.taken || 0;
      items.push({ key: 'title', kind: 'text', x: b.x0 - 40, y: ty, text: 'Kruskal  ·  ' + nTaken + ' of ' + Math.max(0, n - 1) + ' edges taken  ·  total ' + (memo.total || 0), cls: 'gb-title' });
      let formula = '', fcls = 'gb-sum';
      if (tag === 'find-u' && e) formula = 'find(' + e.u + ') = ' + ra;
      if (tag === 'find-v' && e) formula = 'find(' + e.u + ') = ' + ra + ',  find(' + e.v + ') = ' + rb;
      if ((tag === 'same' || tag === 'reject') && e) { formula = ra === rb ? 'same root ' + ra + ': ' + e.u + ' and ' + e.v + ' are already connected' : 'roots ' + ra + ' ≠ ' + rb + ': different trees'; fcls += ra === rb ? ' bad' : ' good'; }
      if (tag === 'union' && e) { formula = 'parent[' + ra + '] = ' + rb; fcls += ' good'; }
      items.push({ key: 'formula', kind: 'text', x: b.x0 - 40, y: ty + 34, text: formula, cls: fcls });
      const view = { x: b.x0 - 80, y: ty - 36, w: Math.max(lx + 215, lx + 18 + (n - 1) * 48 + 40) - (b.x0 - 80), h: Math.max(fy + memo.fh + 40, b.y1 + 60) - (ty - 36) };

      let say = '';
      switch (tag) {
        case 'enter': say = 'kruskal(): ' + m + ' edges, ' + n + ' vertices. The plan: cheapest edges first, but never one that closes a cycle.'; break;
        case 'decl': say = 'total adds up the weights taken; taken counts the edges, and ' + Math.max(0, n - 1) + ' are needed.'; break;
        case 'sort': say = 'sort_edges(): the list is now in order of weight, lightest first. Kruskal never looks back at an edge once it has decided.'; break;
        case 'init': say = d.i < n ? 'Make vertex ' + d.i + ' a set of its own.' : 'Now there are ' + n + ' trees of one vertex each, every one its own root and its own colour.'; break;
        case 'init-set': say = 'parent[' + d.i + '] = ' + d.i + ': ' + d.i + ' is the root of its own one-vertex tree.'; break;
        case 'next':
          if (inLoop) say = 'Next lightest edge: ' + e.u + '–' + e.v + ', weight ' + e.w + '.';
          else if (nTaken >= n - 1) say = n - 1 + ' edges taken: the tree is complete. The remaining edges are not even looked at.';
          else say = 'No edges left, with only ' + nTaken + ' of ' + (n - 1) + ' taken: the graph is not connected, so the result is a spanning forest.';
          break;
        case 'find-u': say = 'find(' + e.u + '): climb parent[] from ' + e.u + ' to its root, ' + ra + '.'; break;
        case 'find-v': say = 'find(' + e.v + '): the root of ' + e.v + ' is ' + rb + '.'; break;
        case 'same': say = ra === rb ? 'Both ends have the same root, ' + ra + ': ' + e.u + ' and ' + e.v + ' are already connected (orange path). The edge would close a cycle.' : 'Different roots: ' + e.u + ' and ' + e.v + ' are in different trees, so this edge joins them without a cycle.'; break;
        case 'reject': say = 'Skip ' + e.u + '–' + e.v + '. It is the heaviest edge on that cycle, so no minimum tree needs it.'; break;
        case 'union': say = 'parent[' + ra + '] = ' + rb + ': the tree of ' + ra + ' hangs under ' + rb + '. One set now, one colour.'; break;
        case 'take': say = 'Take ' + e.u + '–' + e.v + ': total = ' + memo.total + '.'; break;
        case 'count': say = 'taken = ' + memo.taken + ' of ' + (n - 1) + '.'; break;
        case 'done': say = 'Return ' + memo.total + '.'; break;
        case 'after': say = nTaken >= n - 1 ? 'Done: a minimum spanning tree of weight ' + memo.total + ', ' + (n - 1) + ' green edges. Every skipped edge would have closed a cycle.' : 'Done: the graph is not connected, so this is a minimum spanning forest of weight ' + memo.total + ', one tree per colour.'; break;
      }
      return { items, say, view, slow: tag === 'sort' || tag === 'union' || rejecting };
    },
    predict: [
      {
        at: (t, i, ts) => t.tag === 'next' && t.data.i !== null && t.data.i >= 2 && ts[i + 1].tag === 'find-u',
        once: true, pick: 'option',
        ask: (t, ts, i, ctx) => { const es = G.parse(ctx.input.graph).map(([u, v, w]) => ({ u, v, w })); const e = es[sortedOrder(es)[t.data.i]]; return 'The next edge is ' + e.u + '–' + e.v + ' (weight ' + e.w + '). Look at the colours. Will it be taken?'; },
        options: () => ['Taken', 'Skipped: it would close a cycle'],
        answer: (ts, i) => { for (let k = i + 1; k < ts.length; k++) { if (ts[k].tag === 'union') return 'Taken'; if (ts[k].tag === 'reject') return 'Skipped: it would close a cycle'; } return null; },
        explain: () => 'Same colour means same set: its ends are already connected, so the edge would close a cycle.',
      },
      {
        at: (t, i, ts, ctx) => { if (t.tag !== 'next' || t.data.i === null || t.data.i < 3 || ts[i + 1].tag !== 'find-u') return false; const es = G.parse(ctx.input.graph).map(([u, v, w]) => ({ u, v, w })); if (t.data.i >= es.length) return false; const e = es[sortedOrder(es)[t.data.i]]; return W.rootOf(t.data.parent, e.u) !== e.u; },
        once: true,
        ask: (t, ts, i, ctx) => { const es = G.parse(ctx.input.graph).map(([u, v, w]) => ({ u, v, w })); const e = es[sortedOrder(es)[t.data.i]]; return 'find(' + e.u + ') is next. Which vertex is the root of ' + e.u + "'s tree? Click it in the graph."; },
        answer: (ts, i, ctx) => { const es = G.parse(ctx.input.graph).map(([u, v, w]) => ({ u, v, w })); const e = es[sortedOrder(es)[ts[i].data.i]]; return 'gv' + W.rootOf(ts[i].data.parent, e.u); },
        explain: () => 'Follow the arrows up the small forest until a vertex is its own parent.',
      },
    ],
    quiz: [
      { q: 'Kruskal skips an edge exactly when...', options: ['It is heavier than the last one taken', 'Its two ends are already in the same tree', 'One of its ends has degree 3', 'It crosses another edge'], answer: 1, why: 'Then the ends are already connected and the edge would close a cycle.' },
      { q: 'Why is skipping such an edge never a mistake?', options: ['Edges are sorted, so it is the heaviest edge on the cycle it would close', 'Because it is the last edge', 'Because cycles are allowed later', 'It can be a mistake'], answer: 0, why: 'Every other edge of that cycle was taken earlier, so each is no heavier. The cycle property says the heaviest edge of a cycle is not needed.' },
      { q: 'What dominates the running time with a good union-find?', options: ['The finds', 'Sorting the edges: O(m log m)', 'Printing', 'The init loop'], answer: 1, why: 'With union by rank and path compression the finds are almost constant time each.' },
      { q: 'This find() climbs the tree with no shortcuts. What can make it slow?', options: ['Many vertices with the same weight', 'Unions that build a long chain, so find walks all of it', 'Sorting', 'Negative weights'], answer: 1, why: 'Union by rank and path compression (see union-find) keep the trees flat.' },
      { q: 'On a graph that is not connected, Kruskal returns...', options: ['An error', 'A minimum spanning forest: one tree per connected part', 'A spanning tree of the biggest part', 'Nothing'], answer: 1, why: 'It simply runs out of edges with fewer than n-1 taken.' },
    ],
    compareWith: 'prim',
  });
  // ---- union-find -----------------------------------------------------------------------------------------
  /** "u 1 2 f 3" -> [{op: 'u', a: 1, b: 2}, {op: 'f', a: 3}] */
  const parseOps = (text) => {
    const t = String(text || '').trim().split(/[\s,;]+/).filter(Boolean);
    const out = [];
    for (let k = 0; k < t.length;) {
      const w = t[k].toLowerCase();
      if (w === 'u' || w === 'union') {
        if (!/^\d+$/.test(t[k + 1] || '') || !/^\d+$/.test(t[k + 2] || '')) throw new Error('Operations: "u" needs two numbers, like u 1 2');
        out.push({ op: 'u', a: +t[k + 1], b: +t[k + 2] }); k += 3;
      } else if (w === 'f' || w === 'find') {
        if (!/^\d+$/.test(t[k + 1] || '')) throw new Error('Operations: "f" needs one number, like f 3');
        out.push({ op: 'f', a: +t[k + 1] }); k += 2;
      } else throw new Error('Operations: "' + t[k] + '" is not u or f. Write them like: u 1 2 f 3');
    }
    return out;
  };
  const opText = (o) => (o.op === 'u' ? 'unite(' + o.a + ', ' + o.b + ')' : 'find(' + o.a + ')');
  X.topic({
    id: 'union-find', family: 'mst', order: 30, title: 'Union-find',
    blurb: 'Disjoint sets as a forest: each set is a tree, named by its root. Union by rank keeps the trees short; path compression flattens them a little more on every find.',
    code: `/* the root of x's tree; on the way back, every node on the path
   is hung directly under the root (path compression) */
int find(int x)
{
    if (parent[x] != x)                      /*@ test-root */
        parent[x] = find(parent[x]);         /*@ compress */
    return parent[x];                        /*@ root */
}

/* join the sets of a and b: the lower tree goes under the higher one */
void unite(int a, int b)
{
    int ra = find(a);                        /*@ find-a */
    int rb = find(b);                        /*@ find-b */
    if (ra == rb)                            /*@ same */
        return;                              /*@ already */
    if (rank[ra] < rank[rb])                 /*@ cmp-rank */
        parent[ra] = rb;                     /*@ hang-a */
    else if (rank[ra] > rank[rb])            /*@ cmp-rank2 */
        parent[rb] = ra;                     /*@ hang-b */
    else {
        parent[rb] = ra;                     /*@ hang-eq */
        rank[ra]++;                          /*@ rank-up */
    }
}`,
    animate: ['unite', 'find'],
    inputs: [
      { id: 'n', kind: 'int', label: 'Elements', def: 8, lo: 2, hi: 10 },
      { id: 'ops', kind: 'text', label: 'Operations (u a b = unite, f x = find)', def: 'u 0 1 u 2 3 u 0 2 u 4 5 u 6 7 u 4 6 u 0 4 f 7 f 5', check: (v, all) => {
        let ops;
        try { ops = parseOps(v); } catch (e) { return e.message; }
        if (!ops.length) return 'Operations: give at least one, like u 1 2';
        if (ops.length > 10) return 'Operations: at most 10, so the run stays short';
        if (ops.some((o) => o.a >= all.n || (o.op === 'u' && o.b >= all.n))) return 'Operations: elements go from 0 to ' + (all.n - 1);
        return null;
      } },
    ],
    presets: [
      { label: 'Build tall, then compress', values: { n: 8, ops: 'u 0 1 u 2 3 u 0 2 u 4 5 u 6 7 u 4 6 u 0 4 f 7 f 5' } },
      { label: 'Rank decides', values: { n: 6, ops: 'u 0 1 u 0 2 u 3 0 u 4 5 u 5 3' } },
      { label: 'Already together', values: { n: 5, ops: 'u 0 1 u 1 2 u 2 0 f 2' } },
      { label: 'Finds on a path', values: { n: 6, ops: 'u 0 1 u 2 3 u 0 2 u 4 5 u 0 4 f 3 f 3' } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => {
      const ops = parseOps(inp.ops);
      return `int main(void)
{
    make_sets(${inp.n});
${ops.map((o) => (o.op === 'u' ? '    unite(' + o.a + ', ' + o.b + ');' : '    printf("find(' + o.a + ') = %d\\n", find(' + o.a + '));')).join('\n')}
    return 0;
}`;
    },
    capture(P) {
      const sc = (x) => (P.has(x) && P.isSet(x) ? P.val(x) : null);
      const finds = P.calls().filter((c) => c.fn === 'find').map((c) => c.args.x);
      return { parent: P.arr('parent', 10), rank: P.arr('rank', 10), finds, ra: sc('ra'), rb: sc('rb'), a: sc('a'), b: sc('b') };
    },
    scene(ctx) {
      const t = ctx.tick, d = t.data, tag = t.tag, inp = ctx.input, n = inp.n, memo = ctx.memo;
      const ops = parseOps(inp.ops);
      const par = d.parent.slice(0, n), rk = d.rank.slice(0, n);
      const pd = ctx.prev ? ctx.prev.data : null;
      // which operation is running: each one ends with an 'after' tick back in main
      memo.op = memo.op || 0;
      if (ctx.prev && ctx.prev.tag === 'after') memo.op++;
      const op = ops[Math.min(memo.op, ops.length - 1)];
      // the stack of find calls, kept here because a return is drawn after its frame has gone
      memo.stack = memo.stack || [];
      let x = null, ret = null, was = null;
      if (tag === 'test-root' || (tag === 'enter' && op.op === 'f')) { x = d.finds[d.finds.length - 1]; if (tag === 'test-root') memo.stack.push(x); }
      if (tag === 'compress') x = memo.stack[memo.stack.length - 1];
      if (tag === 'root') { x = memo.stack.pop(); ret = par[x]; was = pd ? pd.parent[x] : null; }
      if (tag === 'enter' && op.op === 'u') x = null;
      const path = new Set(memo.stack);
      const L = W.forestLayout(par, { dx: 82, dy: 92, center: true });
      const items = [];
      par.forEach((p, v) => {
        const root = W.rootOf(par, v);
        const isX = v === x;
        const cls = W.setCls(root) + (p === v ? ' gb-root' : '') + (path.has(v) ? ' gb-path' : '') + (isX ? ' focus' : '') + (tag === 'root' && isX && was !== ret ? ' flash' : '');
        items.push({ key: 'uv' + v, kind: 'vertex', x: L.pos[v].x, y: L.pos[v].y, r: 25, text: v, cls, pick: true });
        if (p !== v) items.push({ key: 'ua' + v, kind: 'arrow', from: { key: 'uv' + v }, to: { key: 'uv' + p }, cls: 'gb-up' + (tag === 'root' && isX && was !== ret ? ' hot' : path.has(v) && path.has(p) ? ' hot' : '') });
        if (p === v) items.push({ key: 'ur' + v, kind: 'text', x: L.pos[v].x, y: L.pos[v].y - 36, text: 'rank ' + rk[v], cls: 'gb-rank', anchor: 'middle' });
      });
      // the find calls still waiting for an answer, newest on top
      const sx = L.pos.reduce((a, p) => Math.max(a, p.x), 0) + 120;
      const stackNow = memo.stack.slice();
      if (stackNow.length) items.push({ key: 'sth', kind: 'text', x: sx, y: -40, text: 'find calls waiting', cls: 'gb-head' });
      stackNow.forEach((v, k) => items.push({ key: 'st' + k, kind: 'node', x: sx, y: -26 + (stackNow.length - 1 - k) * 38, w: 110, h: 30, cells: [{ text: 'find(' + v + ')' }], cls: 'gb-row' + (k === stackNow.length - 1 ? ' focus' : ''), enter: 'drop', exit: 'fade' }));
      // the operations, as a strip on top
      const maxDepth = Math.max(0, ...L.depth);
      const ox = -Math.max(L.width / 2, 200), oy = -150;
      items.push({ key: 'opt', kind: 'text', x: ox, y: oy - 14, text: 'operations', cls: 'gb-head' });
      let cx = ox;
      ops.forEach((o, k) => {
        const s = o.op === 'u' ? 'u ' + o.a + ' ' + o.b : 'f ' + o.a;
        const w = s.length * 10 + 18;
        items.push({ key: 'op' + k, kind: 'node', x: cx, y: oy, w, h: 30, cells: [{ text: s }], cls: 'gb-row ' + (k === memo.op ? 'focus' : k < memo.op ? 'took' : 'later') });
        cx += w + 8;
      });
      // the two arrays
      const ty = maxDepth * 92 + 80;
      const tx = -((n * 48) / 2);
      for (const [row, name, vals] of [[0, 'parent', par], [1, 'rank', rk]]) {
        items.push({ key: 'tn' + row, kind: 'text', x: tx - 12, y: ty + row * 66 + 28, text: name, cls: 'gb-head', anchor: 'end' });
        vals.forEach((v, k) => {
          const changed = pd && pd[row === 0 ? 'parent' : 'rank'][k] !== v;
          items.push({ key: 't' + row + '_' + k, kind: 'cell', x: tx + k * 48, y: ty + row * 66, w: 44, h: 44, text: v, sub: row ? '' : k, cls: 'gb-tcell' + (changed ? ' hot' : ''), flash: changed });
        });
      }
      const view = { x: Math.min(ox, tx - 80) - 40, y: oy - 50, w: Math.max(cx, sx + 130, tx + n * 48) + 40 - (Math.min(ox, tx - 80) - 40), h: ty + 2 * 66 + 20 - (oy - 50) };

      let say = '';
      const ra = d.ra, rb = d.rb;
      switch (tag) {
        case 'enter': say = 'make_sets(' + n + ') has made ' + n + ' one-element sets: every element is its own root. First operation: ' + opText(op) + '.'; break;
        case 'test-root': say = (memo.stack.length > 1 ? 'Recursive call, depth ' + memo.stack.length + ': ' : opText(op).startsWith('find') && memo.stack.length === 1 ? opText(op) + ': ' : 'find(' + x + '): ') + (par[x] === x ? 'parent[' + x + '] = ' + x + ', so ' + x + ' is a root.' : 'parent[' + x + '] = ' + par[x] + ', not ' + x + ' itself: ' + x + ' is not a root. Climb.'); break;
        case 'compress': say = 'To learn the root, ask the parent: call find(' + par[x] + '). find(' + x + ') waits until the answer comes back.'; break;
        case 'root':
          if (was === null || was === undefined || ret === x) say = 'find(' + x + ') returns ' + x + ': the root.' + (memo.stack.length ? ' Now the answer travels back down the ' + memo.stack.length + ' waiting call' + (memo.stack.length === 1 ? '' : 's') + '.' : op.op === 'u' ? ' Back in unite().' : '');
          else if (was !== ret) say = 'Back in find(' + x + '): parent[' + x + '] was ' + was + ', now ' + ret + '. ' + x + ' hangs straight under the root, so the next find(' + x + ') takes one step. Return ' + ret + '.';
          else say = 'Back in find(' + x + '): its parent already is the root ' + ret + '. Return ' + ret + '.';
          break;
        case 'find-a': say = 'unite(' + d.a + ', ' + d.b + '): first find the root of ' + d.a + '.'; break;
        case 'find-b': say = 'ra = ' + ra + '. Now the root of ' + d.b + '.'; break;
        case 'same': say = 'ra = ' + ra + ', rb = ' + rb + (ra === rb ? ': the same root. ' + d.a + ' and ' + d.b + ' are already in one set.' : ': two different sets to join. Only the roots move; the rest of each tree comes along.'); break;
        case 'already': say = 'Nothing to do: joining a set with itself would change nothing.'; break;
        case 'cmp-rank': say = 'rank[' + ra + '] = ' + rk[ra] + ', rank[' + rb + '] = ' + rk[rb] + '. ' + (rk[ra] < rk[rb] ? ra + "'s tree is lower, so it goes under " + rb + '.' : 'Is ' + ra + "'s tree lower? No."); break;
        case 'hang-a': say = 'parent[' + ra + '] = ' + rb + ': the lower tree hangs under the higher root. The higher tree does not get any taller.'; break;
        case 'cmp-rank2': say = rk[ra] > rk[rb] ? 'rank[' + ra + '] = ' + rk[ra] + ' is higher: ' + rb + "'s tree goes under " + ra + '.' : 'Equal ranks (' + rk[ra] + '): either way works; the code puts ' + rb + ' under ' + ra + '.'; break;
        case 'hang-b': say = 'parent[' + rb + '] = ' + ra + ': the lower tree hangs under the higher root.'; break;
        case 'hang-eq': say = 'parent[' + rb + '] = ' + ra + '. Two trees of the same height: the result is one level taller.'; break;
        case 'rank-up': say = 'rank[' + ra + '] grows to ' + rk[ra] + '. This is the only place a rank grows, and it needs two equal trees, so a tree of rank r has at least 2^r elements.'; break;
        case 'after': say = op.op === 'f' ? 'find(' + op.a + ') = ' + W.rootOf(par, op.a) + '. ' + (memo.op + 1 < ops.length ? 'Next: ' + opText(ops[memo.op + 1]) + '.' : 'All operations done.') : opText(op) + ' done. ' + (memo.op + 1 < ops.length ? 'Next: ' + opText(ops[memo.op + 1]) + '.' : 'All operations done.'); break;
      }
      return { items, say, view, slow: tag === 'root' && was !== ret && was !== null };
    },
    predict: [
      {
        at: (t, i, ts) => t.tag === 'test-root' && t.data.finds.length === 1 && ts[i + 1] && ts[i + 1].tag === 'compress' && (() => { const p = t.data.parent, x = t.data.finds[0]; return p[p[x]] !== p[x]; })(),
        once: true,
        ask: (t) => { const x = t.data.finds[0]; return 'find(' + x + ') climbs to the root and compresses on the way back. After it, which node will be the parent of ' + x + '? Click it.'; },
        answer: (ts, i) => 'uv' + W.rootOf(ts[i].data.parent, ts[i].data.finds[0]),
        explain: () => 'Path compression hangs every node on the path straight under the root.',
      },
      {
        at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'cmp-rank' && t.tag === 'same',
        once: true, pick: 'option',
        ask: (t) => { const d = t.data; return 'Roots ' + d.ra + ' (rank ' + d.rank[d.ra] + ') and ' + d.rb + ' (rank ' + d.rank[d.rb] + ') are about to be joined. Which way round?'; },
        options: (ts, i) => { const d = ts[i].data; return [d.ra + ' goes under ' + d.rb, d.rb + ' goes under ' + d.ra]; },
        answer: (ts, i) => { const d = ts[i].data; return d.rank[d.ra] < d.rank[d.rb] ? d.ra + ' goes under ' + d.rb : d.rb + ' goes under ' + d.ra; },
        explain: (ts, i) => { const d = ts[i].data; return d.rank[d.ra] === d.rank[d.rb] ? 'Equal ranks: the code puts rb under ra and raises rank[ra].' : 'The root with the lower rank goes under the other, so the height does not grow.'; },
      },
    ],
    quiz: [
      { q: 'How do you tell whether a and b are in the same set?', options: ['Compare parent[a] and parent[b]', 'Compare find(a) and find(b)', 'Check whether a < b', 'Look at rank[a]'], answer: 1, why: 'Two elements are in the same set exactly when they have the same root; their parents may differ.' },
      { q: 'What does path compression change?', options: ['The sets', 'Only the shape: nodes on the find path are hung directly under the root', 'The ranks', 'The order of the elements'], answer: 1, why: 'The same elements stay together; the trees just get flatter, so later finds are faster.' },
      { q: 'Union by rank puts the root with the smaller rank under the other. Why?', options: ['So the result is no taller than the taller tree', 'To keep the root number small', 'It is required by C', 'To make find recursive'], answer: 0, why: 'Hanging the shorter tree under the taller one keeps the height the same; only equal ranks add one level.' },
      { q: 'With both union by rank and path compression, a sequence of m operations costs...', options: ['O(m n)', 'O(m log m)', 'O(m α(n)), where α grows so slowly it is below 5 in practice', 'O(m²)'], answer: 2, why: 'α is the inverse Ackermann function; each operation is effectively constant time.' },
      { q: 'After path compression, is rank[r] still the exact height of r\'s tree?', options: ['Yes, always', 'No: it is an upper bound, because compression can make the tree shorter without lowering the rank', 'Only for leaves', 'Rank is reset'], answer: 1, why: 'Compression never updates rank, so rank becomes an upper bound on the height, which is all union needs.' },
    ],
    compareWith: 'kruskal',
  });
})(SEE);
