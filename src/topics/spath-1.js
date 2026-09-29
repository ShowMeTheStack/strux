// Graphs: shortest paths. Dijkstra (greedy, labels only go down), Bellman-Ford (rounds over an edge
// list, finds negative cycles), Floyd-Warshall (a distance matrix, one intermediate vertex at a time).
(function (SEE) {
  'use strict';
  const X = SEE.Strux, G = X.GraphKit, W = X.WGraphKit;
  const INF = W.INF;

  const base = `#include <stdio.h>

#define MAXV 10
#define INF 1000000    /* larger than any real path: "no path known yet" */`;
  const matrix = `
/* adj[u][v] is the weight of the edge from u to v; 0 means there is no edge */
int adj[MAXV][MAXV];`;
  const labels = `
int dist[MAXV];        /* the shortest distance from the start found so far */
int parent[MAXV];      /* the vertex just before v on that path; -1 for none */

/* before the search: no vertex can be reached yet, except the start */
void init_source(int n, int s)
{
    int v;
    for (v = 0; v < n; v++) {
        dist[v] = INF;
        parent[v] = -1;
    }
    dist[s] = 0;
}`;
  X.family({
    id: 'spath', order: 2, group: 'Graphs', title: 'Shortest paths',
    blurb: 'Every vertex carries a label: the cheapest way found so far. Each algorithm is a different plan for lowering those labels until they are right.',
    head: (t) => {
      if (t.id === 'bellman-ford') return base + `

/* one directed edge: from u to v, costing w */
struct edge {
    int u, v, w;
};
` + labels;
      if (t.id === 'floyd-warshall') return base + '\n' + matrix + `
int d[MAXV][MAXV];     /* d[i][j]: the shortest distance from i to j found so far */`;
      return base + '\n' + matrix + '\n' + labels;
    },
  });

  // ---- shared helpers for the three topics ----------------------------------------------------------------
  /** The weight matrix of the input, as JS (0 = no edge) */
  const adjOf = (inp) => {
    const m = Array.from({ length: inp.n }, () => new Array(inp.n).fill(0));
    for (const [u, v, w, d] of G.parse(inp.graph)) { m[u][v] = w; if (!d) m[v][u] = w; }
    return m;
  };
  /** Does picture edge (a, b) stand for the step u -> v? */
  const isEdge = (a, b, u, v, dirs) => (a === u && b === v) || (!dirs.has(a + '>' + b) && a === v && b === u);
  const dirsOf = (edges) => new Set(edges.filter((e) => e[3]).map((e) => e[0] + '>' + e[1]));
  const list = (xs) => (xs.length ? xs.join(', ') : 'none');
  const num = (v) => (v === null || v === undefined ? null : v);
  const sumText = (a, w) => W.fmt(a) + ' + ' + w + ' = ' + (W.isInf(a) ? '∞' : a + w);
  const nIn = (hi, def) => ({ id: 'n', kind: 'int', label: 'Vertices', def: def || 6, lo: 1, hi });
  const startIn = { id: 's', kind: 'int', label: 'Start at', def: 0, lo: 0, hi: 9 };

  // weighted graphs with good positions
  const city = { n: 6, graph: '0-1:7 0-2:9 0-5:14 1-2:10 1-3:15 2-3:11 2-5:2 3-4:6 4-5:9', pos: [[-250, 90], [-100, 210], [-40, 40], [170, 160], [240, -90], [-150, -110]] };
  X.spathPresets = { city };

  // ---- Dijkstra -------------------------------------------------------------------------------------------
  X.topic({
    id: 'dijkstra', family: 'spath', order: 10, title: "Dijkstra's algorithm",
    blurb: 'Always settle the closest vertex nobody has settled yet, then try every edge out of it. With positive weights a settled label is final.',
    code: `/* shortest distances from s; every weight must be positive */
void dijkstra(int n, int s)
{
    int done[MAXV] = { 0 };     /* done[v] is 1 once dist[v] is final */  /*@ decl */
    int i, k, u, v;
    init_source(n, s);                                     /*@ init */
    for (k = 0; k < n; k++) {                              /*@ round */
        u = -1;                                            /*@ pick-none */
        for (i = 0; i < n; i++)                            /*@ scan */
            if (!done[i] && (u == -1 || dist[i] < dist[u]))    /*@ cmp-min */
                u = i;                                     /*@ new-min */
        if (dist[u] == INF)                                /*@ test-reach */
            break;                                         /*@ stop */
        done[u] = 1;                                       /*@ settle */
        for (v = 0; v < n; v++)                            /*@ scan-v */
            if (adj[u][v] && !done[v] && dist[u] + adj[u][v] < dist[v]) {   /*@ cmp-edge */
                dist[v] = dist[u] + adj[u][v];             /*@ relax */
                parent[v] = u;                             /*@ parent */
            }
    }
}`,
    animate: ['dijkstra'], quiet: ['init_source'],
    inputs: [nIn(8), G.input(city.graph, { label: 'Edges with weights (0-1:7, 2>3:4)', weighted: true, negative: true }), { id: 'pos', kind: 'hidden', def: city.pos }, startIn],
    check: (inp) => {
      const edges = G.parse(inp.graph);
      if (edges.some((e) => e[2] < 0)) return 'Dijkstra needs weights above 0: once a vertex is settled it is never looked at again, so a negative edge found later would come too late. For negative weights use Bellman-Ford.';
      if (edges.some((e) => e[2] === 0 || e[2] > 99)) return 'Edges: weights from 1 to 99 (0 would mean "no edge" in the matrix)';
      if (edges.length > 14) return 'Edges: at most 14, so the picture stays readable';
      if (inp.s >= inp.n) return 'Start at: a vertex from 0 to ' + (inp.n - 1);
      return null;
    },
    presets: [
      { label: 'Small city', values: Object.assign({ s: 0 }, city) },
      { label: 'Detour is cheaper', values: { n: 5, s: 0, graph: '0-1:12 0-2:2 2-3:3 3-1:4 1-4:2 3-4:9', pos: [[-250, 20], [60, -150], [-110, 150], [100, 120], [260, -10]] } },
      { label: 'Some unreachable', values: { n: 6, s: 0, graph: '0-1:4 1-2:3 0-2:8 3-4:1 4-5:2', pos: [[-240, 0], [-110, -130], [-110, 130], [110, -50], [240, -150], [240, 60]] } },
      { label: 'Start in the middle', values: { n: 5, s: 2, graph: '0-2:5 1-2:2 2-3:6 2-4:1 0-1:2 3-4:3', pos: [[-230, -110], [-230, 110], [0, 0], [230, -110], [230, 110]] } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => X.graphMain(inp, 'dijkstra(' + inp.n + ', ' + inp.s + ');'),
    capture(P) {
      const sc = (x) => (P.has(x, 0) && P.isSet(x, 0) ? P.val(x, 0) : null);
      return { dist: P.arr('dist', 10), parent: P.arr('parent', 10), done: P.has('done', 0) ? P.arr('done', 10, 0) : null, k: sc('k'), u: sc('u'), v: sc('v'), i: sc('i') };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, n = inp.n, memo = ctx.memo;
      const edges = G.parse(inp.graph), dirs = dirsOf(edges), A = adjOf(inp), pos = W.positions(inp);
      const dist = d.dist.slice(0, n), par = d.parent.slice(0, n).map((p) => (p === null ? -1 : p));
      if (d.done) memo.done = d.done.slice(0, n);
      const done = (memo.done || new Array(n).fill(0)).map((x) => !!x);
      const started = tag !== 'enter';
      const pd = ctx.prev ? ctx.prev.data : null;
      const u = num(d.u), v = num(d.v), i = num(d.i);
      const expanding = ['scan-v', 'cmp-edge', 'relax', 'parent', 'settle'].includes(tag) && u !== null && u >= 0;
      const edgeNow = (tag === 'scan-v' || tag === 'cmp-edge' || tag === 'relax' || tag === 'parent') && v !== null && v < n && A[u][v];
      const oldPar = tag === 'parent' && pd ? pd.parent[v] : -1;
      // the graph: settled vertices green, the one being expanded ringed
      const items = W.graph({
        n, edges, pos, directed: false,
        vcls: (x) => (done[x] ? 'done' : '') + (expanding && x === u ? ' focus' : '') + ((tag === 'cmp-min' || tag === 'new-min') && x === i ? ' hot' : '') + (edgeNow && x === v && !done[x] ? ' hot' : ''),
        ecls: (a, b) => {
          if (edgeNow && isEdge(a, b, u, v, dirs)) return 'hot';
          if (oldPar !== null && oldPar >= 0 && oldPar !== u && isEdge(a, b, oldPar, v, dirs)) return 'bad';
          if (started && (par[b] === a || (!dirs.has(a + '>' + b) && par[a] === b))) return 'part-a';
          return '';
        },
      });
      // distance badges: "old → new" for the moment a label drops
      items.push(...W.badges('gd', pos, (x) => (!started ? '' : tag === 'relax' && x === v ? W.fmt(pd.dist[v]) + ' → ' + W.fmt(dist[v]) : W.fmt(dist[x])),
        (x) => (tag === 'relax' && x === v ? 'drop' : done[x] ? 'final' : W.isInf(dist[x]) ? 'inf' : ''), { flash: (x) => tag === 'relax' && x === v }));
      // the arrays, as a table on the right
      const b = W.box(pos);
      const tx = b.x1 + 80, ty = b.y0 - 20;
      items.push(...W.table('tb', n, [
        { title: 'dist', value: (x) => (started ? W.fmt(dist[x]) : ''), cls: (x) => (tag === 'relax' && x === v ? 'hot' : done[x] ? 'part-a' : W.isInf(dist[x]) ? 'inf' : '') },
        { title: 'parent', value: (x) => (started ? par[x] : ''), cls: (x) => (tag === 'parent' && x === v ? 'hot' : '') },
      ], { x0: tx, y0: ty, cw: 54, rowCls: (x) => (x === u && (expanding || tag === 'test-reach') ? 'hot' : done[x] ? 'done' : '') }));
      // the question being asked on this line, in words and numbers
      let formula = '', fcls = 'gb-sum';
      if (tag === 'cmp-edge' && edgeNow) {
        const s = dist[u] + A[u][v];
        if (done[v]) { formula = v + ' is settled: skip'; fcls += ' muted'; }
        else { formula = 'dist[' + u + '] + ' + A[u][v] + ' = ' + dist[u] + ' + ' + A[u][v] + ' = ' + s + (s < dist[v] ? '  <  ' : '  ≥  ') + 'dist[' + v + '] = ' + W.fmt(dist[v]); if (s < dist[v]) fcls += ' good'; }
      }
      if (tag === 'cmp-min' && i !== null && i < n && !done[i]) formula = u === i ? 'best so far: ' + i : 'dist[' + i + '] = ' + W.fmt(dist[i]) + (u !== null && u >= 0 ? '  vs best dist[' + u + '] = ' + W.fmt(dist[u]) : '');
      const fy = b.y0 - 120;
      items.push({ key: 'formula', kind: 'text', x: b.x0 - 40, y: fy + 34, text: formula, cls: fcls });
      const settled = done.map((x, k) => (x ? k : -1)).filter((x) => x >= 0);
      items.push({ key: 'title', kind: 'text', x: b.x0 - 40, y: fy, text: 'Dijkstra from ' + inp.s + (d.k !== null && d.k < n && started ? '  ·  round ' + (d.k + 1) + ' of ' + n : ''), cls: 'gb-title' });
      items.push({ key: 'settled', kind: 'text', x: tx, y: ty + n * 38 + 30, text: 'settled: ' + list(settled), cls: 'gb-note' });
      if (u !== null && u >= 0 && u < n && tag !== 'pick-none' && tag !== 'after') items.push({ key: 'cu', kind: 'cursor', at: 'gv' + u, side: W.freeSide(pos, u), text: 'u', cls: 'c-rose' });
      if ((tag === 'scan' || tag === 'cmp-min' || tag === 'new-min') && i !== null && i < n) items.push({ key: 'ci', kind: 'cursor', at: 'gv' + i, side: W.freeSide(pos, i), slot: i === u ? 1 : 0, text: 'i', cls: 'c-amber' });
      if ((tag === 'scan-v' || tag === 'cmp-edge' || tag === 'relax' || tag === 'parent') && v !== null && v < n) items.push({ key: 'cv', kind: 'cursor', at: 'gv' + v, side: W.freeSide(pos, v), slot: v === u ? 1 : 0, text: 'v', cls: 'c-indigo' });
      const view = { x: b.x0 - 90, y: fy - 40, w: tx + 34 + 2 * 58 + 30 - (b.x0 - 90), h: Math.max(b.y1 + 110, ty + n * 38 + 60) - (fy - 40) };

      let say = '';
      const unreached = dist.map((x, k) => (W.isInf(x) ? k : -1)).filter((x) => x >= 0);
      switch (tag) {
        case 'enter': say = 'dijkstra(' + n + ', ' + inp.s + '): find the cheapest way from ' + inp.s + ' to every vertex. The numbers on the edges are their costs.'; break;
        case 'decl': say = 'done[] starts all 0: no vertex is settled. A settled vertex is one whose distance is known for sure.'; break;
        case 'init': say = 'init_source(): every label starts at ∞ ("no path known yet") except dist[' + inp.s + '] = 0. Labels will only ever go down.'; break;
        case 'round': say = d.k < n ? 'Round ' + (d.k + 1) + ': settle one more vertex. Settled so far: ' + list(settled) + '.' : 'Every round is done.'; break;
        case 'pick-none': say = 'u = -1 means "no candidate yet". Now look for the unsettled vertex with the smallest label.'; break;
        case 'scan': say = i < n ? 'Look at vertex ' + i + (done[i] ? ', which is already settled.' : ', label ' + W.fmt(dist[i]) + '.') : 'Every vertex looked at: the smallest unsettled label is dist[' + u + '] = ' + W.fmt(dist[u]) + ', at vertex ' + u + '.'; break;
        case 'cmp-min': {
          const prevU = pd ? num(pd.u) : null;
          if (done[i]) say = i + ' is settled: its label is final, it is not a candidate any more.';
          else if (prevU === -1 || prevU === null) say = i + ' is the first unsettled vertex: it is the best so far.';
          else say = dist[i] < dist[prevU] ? 'dist[' + i + '] = ' + W.fmt(dist[i]) + ' is smaller than dist[' + prevU + '] = ' + W.fmt(dist[prevU]) + ': a new best.' : 'dist[' + i + '] = ' + W.fmt(dist[i]) + ' is not smaller than dist[' + prevU + '] = ' + W.fmt(dist[prevU]) + ': keep u = ' + prevU + '.';
          break;
        }
        case 'new-min': say = 'u = ' + u + ': the closest unsettled vertex so far.'; break;
        case 'test-reach': say = W.isInf(dist[u]) ? 'The smallest label left is ∞: no edge leads from the settled part to ' + list(unreached.filter((x) => !done[x])) + '.' : 'dist[' + u + '] = ' + dist[u] + ' is a real distance, so ' + u + ' can be reached.'; break;
        case 'stop': say = 'Stop early: ' + list(unreached.filter((x) => !done[x])) + ' cannot be reached from ' + inp.s + '. Their labels stay ∞.'; break;
        case 'settle': say = 'Settle ' + u + ': dist[' + u + '] = ' + dist[u] + ' is final. Every other route would leave the green part through a label of at least ' + dist[u] + ', and positive edges only add to it.'; break;
        case 'scan-v': say = v < n ? (A[u][v] ? 'Try the edge ' + u + '–' + v + ', cost ' + A[u][v] + '.' : 'Is there an edge from ' + u + ' to ' + v + '?') : 'Every edge out of ' + u + ' has been tried. Back to choose the next vertex.'; break;
        case 'cmp-edge': {
          if (!A[u][v]) { say = 'No edge from ' + u + ' to ' + v + '.'; break; }
          if (done[v]) { say = v + ' is already settled: its label cannot get better.'; break; }
          const s = dist[u] + A[u][v];
          say = 'Going through ' + u + ': ' + sumText(dist[u], A[u][v]) + '. ' + (s < dist[v] ? 'That beats ' + W.fmt(dist[v]) + ', the best known way to ' + v + '.' : 'That does not beat ' + W.fmt(dist[v]) + ': keep the old label.');
          break;
        }
        case 'relax': say = 'Relax the edge: dist[' + v + '] drops from ' + W.fmt(pd.dist[v]) + ' to ' + dist[v] + '.'; break;
        case 'parent': say = 'parent[' + v + '] = ' + u + ': the best way to ' + v + ' now arrives from ' + u + '.' + (oldPar >= 0 && oldPar !== u ? ' The old route through ' + oldPar + ' (red) is dropped from the tree.' : ''); break;
        case 'after': say = 'Done. The green edges are the shortest-path tree: follow parent[] back from any vertex to reach ' + inp.s + ' along a cheapest route. Distances: ' + dist.map((x, k) => k + ':' + W.fmt(x)).join('  ') + '.'; break;
      }
      return { items, say, view, slow: tag === 'relax' || tag === 'settle' };
    },
    predict: [
      {
        at: (t) => t.tag === 'pick-none' && t.data.done && t.data.done.some((x, k) => k < 10 && x === 0),
        once: true, ask: 'Which vertex will be settled next? Click it.',
        answer: (ts, i, ctx) => {
          const d = ts[i].data, n = ctx.input.n;
          let u = -1;
          for (let k = 0; k < n; k++) if (!d.done[k] && (u === -1 || d.dist[k] < d.dist[u])) u = k;
          return u >= 0 && !W.isInf(d.dist[u]) && d.done.some((x) => x) ? 'gv' + u : null;
        },
        explain: (ts, i, ctx) => { const d = ts[i].data; let u = -1; for (let k = 0; k < ctx.input.n; k++) if (!d.done[k] && (u === -1 || d.dist[k] < d.dist[u])) u = k; return 'The unsettled vertex with the smallest label: ' + u + ', with ' + d.dist[u] + '. Its distance is the cheapest still unknown.'; },
      },
      {
        at: (t, i, ts, ctx) => { t = ts[i + 1]; if (!t) return false; const d = t.data; if (t.tag !== 'cmp-edge' || d.v === null || d.v >= ctx.input.n) return false; const A = adjOf(ctx.input); return A[d.u][d.v] && !d.done[d.v] && !W.isInf(d.dist[d.v]); },
        once: true, pick: 'option',
        ask: (t, ts, i, ctx) => { const d = t.data; const w = adjOf(ctx.input)[d.u][d.v]; return 'dist[' + d.u + '] is ' + d.dist[d.u] + ' and the edge ' + d.u + '–' + d.v + ' costs ' + w + '. dist[' + d.v + '] is ' + d.dist[d.v] + '. What happens to it?'; },
        options: () => ['It drops', 'It stays the same'],
        answer: (ts, i, ctx) => { const d = ts[i].data; const w = adjOf(ctx.input)[d.u][d.v]; return d.dist[d.u] + w < d.dist[d.v] ? 'It drops' : 'It stays the same'; },
        explain: (ts, i, ctx) => { const d = ts[i].data; const w = adjOf(ctx.input)[d.u][d.v]; return d.dist[d.u] + ' + ' + w + ' = ' + (d.dist[d.u] + w) + ', compared with ' + d.dist[d.v] + '. A label only changes when the new route is strictly cheaper.'; },
      },
    ],
    quiz: [
      { q: 'Why may Dijkstra treat dist[u] as final the moment u is settled?', options: ['Because u has the fewest edges', 'Every other route must leave through a vertex with a label at least as big, and edges only add', 'Because the queue is first in, first out', 'It may not: labels can still change later'], answer: 1, why: 'u had the smallest label of all unsettled vertices. Any other path to u passes one of them and then adds non-negative edges, so it cannot be cheaper.' },
      { q: 'What goes wrong with a negative edge?', options: ['Nothing', 'The program crashes', 'A vertex may be settled before a cheaper route through the negative edge is found', 'The loop never ends'], answer: 2, why: 'The negative edge might be found after its target is settled, and a settled label is never revisited. Bellman-Ford handles negative weights.' },
      { q: 'This version scans an array to find the smallest label. How long does it take on n vertices?', options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(n³)'], answer: 2, why: 'n rounds, each scanning n labels and n matrix entries. A binary heap brings it to O((n + m) log n) for sparse graphs.' },
      { q: 'What does "relaxing" the edge u–v mean?', options: ['Deleting it', 'Checking whether going through u gives a cheaper way to v, and if so lowering dist[v]', 'Making its weight smaller', 'Marking v settled'], answer: 1, why: 'dist[v] = min(dist[v], dist[u] + w). It never makes a label bigger.' },
      { q: 'After the run, how do you print the shortest route from s to some vertex t?', options: ['Read dist[] from s to t', 'Follow parent[] from t back to s, then print it reversed', 'Sort the vertices by dist', 'Run BFS'], answer: 1, why: 'parent[t] is the vertex before t on its cheapest route; repeating that walks back to s.' },
    ],
    compareWith: 'prim',
  });
  // ---- Bellman-Ford ---------------------------------------------------------------------------------------
  /** The edge list in the input's own order */
  const edgeList = (inp) => G.parse(inp.graph).map(([u, v, w]) => ({ u, v, w }));
  /** The vertices of the negative cycle behind edge u -> v (walk parent[] back n times, then go round) */
  const cycleOf = (par, n, u, v) => {
    const p = par.slice();
    p[v] = u;
    let x = v;
    for (let k = 0; k < n; k++) { if (p[x] < 0) return []; x = p[x]; }
    const cyc = [x];
    for (let y = p[x]; y !== x && cyc.length <= n; y = p[y]) { if (y < 0) return []; cyc.push(y); }
    return cyc.reverse();
  };
  X.topic({
    id: 'bellman-ford', family: 'spath', order: 20, title: 'Bellman-Ford',
    blurb: 'No greedy choice: just relax every edge, round after round. n-1 rounds are always enough, and one more round tells whether a negative cycle spoils everything.',
    code: `/* returns 1 when dist[] holds the shortest distances from s,
   0 when a negative cycle can be reached from s */
int bellman_ford(struct edge e[], int m, int n, int s)
{
    int round, i, u, v, w;
    init_source(n, s);                                     /*@ init */
    for (round = 1; round < n; round++)                    /*@ round */
        for (i = 0; i < m; i++) {                          /*@ edge */
            u = e[i].u; v = e[i].v; w = e[i].w;            /*@ pick */
            if (dist[u] != INF && dist[u] + w < dist[v]) { /*@ cmp-edge */
                dist[v] = dist[u] + w;                     /*@ relax */
                parent[v] = u;                             /*@ parent */
            }
        }
    for (i = 0; i < m; i++) {                              /*@ check */
        u = e[i].u; v = e[i].v; w = e[i].w;                /*@ pick2 */
        if (dist[u] != INF && dist[u] + w < dist[v])       /*@ cmp-cycle */
            return 0;                                      /*@ cycle */
    }
    return 1;                                              /*@ ok */
}`,
    animate: ['bellman_ford'], quiet: ['init_source'],
    inputs: [nIn(7, 5), G.input('0>1:6 0>3:7 1>2:5 1>3:8 1>4:-4 2>1:-2 3>2:-3 3>4:9 4>2:7 4>0:2', { label: 'Directed edges, in this order (0>1:6)', weighted: true, negative: true }),
      { id: 'pos', kind: 'hidden', def: [[-250, 0], [-60, -150], [210, -150], [-60, 150], [210, 150]] }, startIn],
    check: (inp) => {
      const edges = G.parse(inp.graph);
      if (edges.some((e) => !e[3])) return 'Edges: write directed edges like 0>1:4. (An undirected edge with a negative weight would be a negative cycle on its own.)';
      if (edges.some((e) => Math.abs(e[2]) > 99)) return 'Edges: weights from -99 to 99';
      if (!edges.length) return 'Edges: give at least one edge';
      if (edges.length > 12) return 'Edges: at most 12, so the edge list fits beside the graph';
      const seen = new Set();
      for (const [u, v] of edges) { if (seen.has(u + '>' + v)) return 'Edges: ' + u + '>' + v + ' is given twice'; seen.add(u + '>' + v); }
      if (inp.s >= inp.n) return 'Start at: a vertex from 0 to ' + (inp.n - 1);
      return null;
    },
    presets: [
      { label: 'Negative edges', values: { n: 5, s: 0, graph: '0>1:6 0>3:7 1>2:5 1>3:8 1>4:-4 2>1:-2 3>2:-3 3>4:9 4>2:7 4>0:2', pos: [[-260, 0], [-80, -150], [200, -150], [-80, 150], [200, 150]] } },
      { label: 'Negative cycle', values: { n: 5, s: 0, graph: '0>1:4 1>2:3 2>3:-2 3>1:-4 3>4:2', pos: [[-260, 0], [-80, -130], [170, -130], [50, 130], [260, 130]] } },
      { label: 'Edges in the worst order', values: { n: 5, s: 0, graph: '3>4:2 2>3:3 1>2:1 0>1:4', pos: [[-260, 40], [-130, -60], [0, 40], [130, -60], [260, 40]] } },
      { label: 'Edges in the best order', values: { n: 5, s: 0, graph: '0>1:4 1>2:1 2>3:3 3>4:2', pos: [[-260, 40], [-130, -60], [0, 40], [130, -60], [260, 40]] } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => {
      const es = edgeList(inp);
      return `int main(void)
{
    struct edge e[] = {
        ${es.map((x) => '{ ' + x.u + ', ' + x.v + ', ' + x.w + ' }').join(',\n        ')}
    };
    if (bellman_ford(e, ${es.length}, ${inp.n}, ${inp.s}))
        printf("shortest distances found\\n");
    else
        printf("a negative cycle: no shortest paths\\n");
    return 0;
}`;
    },
    capture(P) {
      const sc = (x) => (P.has(x, 0) && P.isSet(x, 0) ? P.val(x, 0) : null);
      return { dist: P.arr('dist', 10), parent: P.arr('parent', 10), round: sc('round'), i: sc('i'), u: sc('u'), v: sc('v'), w: sc('w') };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, n = inp.n, memo = ctx.memo;
      const edges = G.parse(inp.graph), es = edgeList(inp), m = es.length, pos = W.positions(inp);
      const dist = d.dist.slice(0, n), par = d.parent.slice(0, n).map((p) => (p === null ? -1 : p));
      const pd = ctx.prev ? ctx.prev.data : null;
      const started = tag !== 'enter';
      // what the function's locals were last (a return line is drawn after the frame is gone)
      if (d.i !== null) memo.i = d.i;
      if (d.round !== null) memo.round = d.round;
      const i = d.i !== null ? d.i : memo.i, round = d.round !== null ? d.round : memo.round;
      const checking = ['check', 'pick2', 'cmp-cycle', 'cycle', 'ok'].includes(tag);
      memo.changes = memo.changes || {};
      memo.took = memo.took || {};
      if (tag === 'relax') { memo.changes[round] = (memo.changes[round] || 0) + 1; (memo.took[round] = memo.took[round] || new Set()).add(i); }
      const cur = i !== null && i < m ? es[i] : null;
      const looking = cur && ['pick', 'cmp-edge', 'relax', 'parent', 'pick2', 'cmp-cycle', 'cycle'].includes(tag);
      const violating = (tag === 'cmp-cycle' || tag === 'cycle') && cur && !W.isInf(dist[cur.u]) && dist[cur.u] + cur.w < dist[cur.v];
      if (violating && !memo.cyc) memo.cyc = cycleOf(par, n, cur.u, cur.v);
      const cyc = violating ? memo.cyc || [] : [];
      const onCyc = (a, b) => cyc.some((x, k) => x === a && cyc[(k + 1) % cyc.length] === b);
      const items = W.graph({
        n, edges, pos,
        vcls: (x) => (cyc.includes(x) ? 'bad' : looking && x === cur.v ? 'hot' : looking && x === cur.u ? 'focus' : x === inp.s && started ? 'part-a' : ''),
        ecls: (a, b) => (onCyc(a, b) ? 'bad' : looking && a === cur.u && b === cur.v ? 'hot' : started && par[b] === a ? 'part-a' : ''),
      });
      const final = tag === 'ok' || tag === 'after' && !memo.cyc;
      items.push(...W.badges('gd', pos, (x) => (!started ? '' : tag === 'relax' && x === cur.v ? W.fmt(pd.dist[x]) + ' → ' + W.fmt(dist[x]) : W.fmt(dist[x])),
        (x) => (tag === 'relax' && x === cur.v ? 'drop' : cyc.includes(x) ? 'bad' : final && !W.isInf(dist[x]) ? 'final' : W.isInf(dist[x]) ? 'inf' : ''), { flash: (x) => tag === 'relax' && x === cur.v }));
      // the edge list: the order the C code walks it
      const b = W.box(pos);
      const lx = b.x1 + 90, ly = b.y0 - 40, rh = 34;
      const took = memo.took[round] || new Set();
      items.push({ key: 'lt', kind: 'text', x: lx, y: ly - 14, text: 'edge list e[]', cls: 'gb-head' });
      es.forEach((e, k) => {
        const c = checking ? (violating && k === i ? 'bad' : k === i && looking ? 'focus' : k < i ? 'took' : '') : (k === i && looking ? 'focus' : took.has(k) ? 'took' : '');
        items.push({ key: 'row' + k, kind: 'node', x: lx, y: ly + k * (rh + 6), w: 170, h: rh, cells: [{ text: k, w: 0.7, cls: 'w' }, { text: e.u + ' → ' + e.v, w: 1.8 }, { text: e.w, w: 1 }], cls: 'gb-row ' + c });
      });
      // the round counter and what each round changed
      const ty = b.y0 - 120;
      const title = !started ? 'Bellman-Ford from ' + inp.s : checking || tag === 'after' ? 'extra pass: any edge still improving?' : 'round ' + Math.min(round || 1, n - 1) + ' of ' + (n - 1);
      items.push({ key: 'title', kind: 'text', x: b.x0 - 40, y: ty, text: title, cls: 'gb-big' + (cyc.length ? ' bad' : final ? ' good' : '') });
      const hist = [];
      for (let r = 1; r < n; r++) if (memo.changes[r] !== undefined || (round > r || checking)) hist.push('round ' + r + ': ' + (memo.changes[r] || 0) + ' changed');
      items.push({ key: 'hist', kind: 'text', x: b.x0 - 40, y: ty + 30, text: hist.slice(-4).join('   ·   '), cls: 'gb-note muted' });
      let formula = '', fcls = 'gb-sum';
      if ((tag === 'cmp-edge' || tag === 'cmp-cycle') && cur) {
        if (W.isInf(dist[cur.u])) { formula = 'dist[' + cur.u + '] = ∞: skip'; fcls += ' muted'; }
        else { const s = dist[cur.u] + cur.w; formula = 'dist[' + cur.u + '] + (' + cur.w + ') = ' + s + (s < dist[cur.v] ? '  <  ' : '  ≥  ') + 'dist[' + cur.v + '] = ' + W.fmt(dist[cur.v]); if (s < dist[cur.v]) fcls += tag === 'cmp-cycle' ? '' : ' good'; }
      }
      items.push({ key: 'formula', kind: 'text', x: b.x0 - 40, y: ty + 62, text: formula, cls: fcls });
      if (cyc.length) items.push({ key: 'cycsum', kind: 'text', x: b.x0 - 40, y: b.y1 + 90, text: 'cycle ' + cyc.concat(cyc[0]).join(' → ') + ' costs ' + cyc.reduce((a, x, k) => a + es.find((e) => e.u === x && e.v === cyc[(k + 1) % cyc.length]).w, 0), cls: 'gb-sum bad' });
      const view = { x: b.x0 - 90, y: ty - 40, w: lx + 200 - (b.x0 - 90), h: Math.max(b.y1 + 120, ly + m * (rh + 6) + 20) - (ty - 40) };

      let say = '';
      const roundsLeft = n - 1;
      switch (tag) {
        case 'enter': say = 'bellman_ford(): ' + m + ' directed edges, ' + n + ' vertices, start at ' + inp.s + '. Some weights may be negative, so no label can be trusted early.'; break;
        case 'init': say = 'init_source(): dist[' + inp.s + '] = 0, every other label ∞.'; break;
        case 'round': {
          const last = memo.changes[round - 1];
          say = round < n ? 'Round ' + round + ' of ' + roundsLeft + ': relax every edge once, in list order.' + (round > 1 ? ' The last round changed ' + (last || 0) + ' label' + (last === 1 ? '' : 's') + '.' : '') : 'All ' + roundsLeft + ' rounds done. A shortest path uses at most ' + roundsLeft + ' edges, so if there is no negative cycle every label is now right.';
          break;
        }
        case 'edge': say = i < m ? 'Edge e[' + i + ']: ' + es[i].u + ' → ' + es[i].v + ', weight ' + es[i].w + '.' : 'End of the list: round ' + round + ' changed ' + (memo.changes[round] || 0) + ' label' + (memo.changes[round] === 1 ? '' : 's') + '.'; break;
        case 'pick': case 'pick2': say = 'u = ' + cur.u + ', v = ' + cur.v + ', w = ' + cur.w + '.'; break;
        case 'cmp-edge': {
          if (W.isInf(dist[cur.u])) { say = 'dist[' + cur.u + '] is ∞: no route to ' + cur.u + ' is known yet, so this edge cannot help. (That is why the code checks for INF before adding.)'; break; }
          const s = dist[cur.u] + cur.w;
          say = dist[cur.u] + ' + (' + cur.w + ') = ' + s + (s < dist[cur.v] ? ', better than ' + W.fmt(dist[cur.v]) + '.' : ', not better than ' + W.fmt(dist[cur.v]) + '.');
          break;
        }
        case 'relax': say = 'dist[' + cur.v + '] drops from ' + W.fmt(pd.dist[cur.v]) + ' to ' + dist[cur.v] + (cur.w < 0 ? ', thanks to a negative edge.' : '.'); break;
        case 'parent': say = 'parent[' + cur.v + '] = ' + cur.u + '.'; break;
        case 'check': say = i < m ? 'Extra pass, edge e[' + i + ']: if any edge can still lower a label after ' + roundsLeft + ' rounds, there is a negative cycle.' : 'No edge improved anything.'; break;
        case 'cmp-cycle': say = W.isInf(dist[cur.u]) ? cur.u + ' cannot be reached: skip.' : violating ? dist[cur.u] + ' + (' + cur.w + ') = ' + (dist[cur.u] + cur.w) + ' < ' + dist[cur.v] + ': after ' + roundsLeft + ' rounds this edge still improves a label. Something keeps getting cheaper.' : 'Edge ' + cur.u + ' → ' + cur.v + ' cannot improve dist[' + cur.v + '] any more. Good.'; break;
        case 'cycle': say = 'Return 0: the cycle ' + cyc.concat(cyc[0]).join(' → ') + ' has a negative total. Going round it again and again makes every route through it cheaper without end, so "shortest" has no meaning there.'; break;
        case 'ok': say = 'Return 1: every edge passed the test, so there is no negative cycle and every label is final.'; break;
        case 'after': say = memo.cyc ? 'bellman_ford() returned 0: the distances are not trustworthy, because of the negative cycle in red.' : 'Done. Distances: ' + dist.map((x, k) => k + ':' + W.fmt(x)).join('  ') + '. ' + ctx.counters.compares + ' comparisons; Dijkstra would need fewer, but could not handle the negative edges.'; break;
      }
      return { items, say, view, slow: tag === 'relax' || tag === 'cycle' };
    },
    predict: [
      {
        at: (t, i, ts, ctx) => { t = ts[i + 1]; if (!t || t.tag !== 'cmp-edge') return false; const d = t.data, e = edgeList(ctx.input)[d.i]; return e && !W.isInf(d.dist[e.u]) && !W.isInf(d.dist[e.v]); },
        once: true, pick: 'option',
        ask: (t, ts, i, ctx) => { const d = t.data, e = edgeList(ctx.input)[d.i]; return 'Edge ' + e.u + ' → ' + e.v + ' has weight ' + e.w + '. dist[' + e.u + '] = ' + d.dist[e.u] + ', dist[' + e.v + '] = ' + d.dist[e.v] + '. Will dist[' + e.v + '] drop?'; },
        options: () => ['Yes', 'No'],
        answer: (ts, i, ctx) => { const d = ts[i].data, e = edgeList(ctx.input)[d.i]; return d.dist[e.u] + e.w < d.dist[e.v] ? 'Yes' : 'No'; },
        explain: (ts, i, ctx) => { const d = ts[i].data, e = edgeList(ctx.input)[d.i]; return d.dist[e.u] + ' + (' + e.w + ') = ' + (d.dist[e.u] + e.w) + ' against ' + d.dist[e.v] + '.'; },
      },
      {
        at: (t, i, ts, ctx) => { t = ts[i + 1]; if (!t || t.tag !== 'cmp-edge') return false; const d = t.data, e = edgeList(ctx.input)[d.i]; return e && W.isInf(d.dist[e.u]); },
        once: true, pick: 'option',
        ask: (t, ts, i, ctx) => { const e = edgeList(ctx.input)[t.data.i]; return 'dist[' + e.u + '] is still ∞. Can the edge ' + e.u + ' → ' + e.v + ' lower dist[' + e.v + '] in this step?'; },
        options: () => ['Yes', 'No'], answer: () => 'No',
        explain: () => 'No route to the start of the edge is known, so nothing can be offered to its end. A later round will come back to it.',
      },
      {
        at: (t) => t.tag === 'check', once: true, pick: 'option',
        ask: 'The rounds are over. Will the extra pass find an edge that still lowers a label?',
        options: () => ['Yes: there is a negative cycle', 'No: the labels are final'],
        answer: (ts) => (ts.some((t) => t.tag === 'cycle') ? 'Yes: there is a negative cycle' : 'No: the labels are final'),
        explain: (ts) => (ts.some((t) => t.tag === 'cycle') ? 'A cycle with a negative total can be gone round again and again, so some label can always drop.' : 'Without a negative cycle, n-1 rounds are enough for every label.'),
      },
    ],
    quiz: [
      { q: 'Why are n-1 rounds enough when there is no negative cycle?', options: ['Because there are n-1 edges', 'A shortest path has at most n-1 edges, and round k fixes at least every path of k edges', 'Because each round settles one vertex for good', 'They are not always enough'], answer: 1, why: 'After round k, every vertex whose shortest path has k edges has its right label, whatever order the edges are listed in.' },
      { q: 'How is a negative cycle detected?', options: ['A label becomes negative', 'The program loops for ever', 'After n-1 rounds some edge can still lower a label', 'Two vertices get the same label'], answer: 2, why: 'Without a negative cycle the labels stop changing after n-1 rounds. If one more pass still improves something, a cycle keeps making routes cheaper.' },
      { q: 'What is the running time on n vertices and m edges?', options: ['O(n + m)', 'O(m log n)', 'O(n · m)', 'O(n³) always'], answer: 2, why: 'n-1 rounds, each relaxing all m edges.' },
      { q: 'Why does the test say dist[u] != INF before adding w?', options: ['To save time', 'INF plus a negative weight would look like a real, finite route', 'INF is not a number', 'It is not needed'], answer: 1, why: 'INF - 3 is still a huge number but smaller than INF, so an unreachable vertex would seem to offer a route.' },
      { q: 'With the edges listed in the best order (along the paths), how many rounds actually change something?', options: ['n-1', 'Only the first', 'None', 'Half of them'], answer: 1, why: 'Each label is right as soon as its predecessor is. The other rounds just confirm it; a "changed" flag could stop early.' },
    ],
    compareWith: 'dijkstra',
  });
  // ---- Floyd-Warshall -------------------------------------------------------------------------------------
  X.topic({
    id: 'floyd-warshall', family: 'spath', order: 30, title: 'Floyd-Warshall',
    blurb: 'Every pair at once, in a matrix. First no stops are allowed, then vertex 0 may be a stop, then 0 and 1, and so on: three nested loops and one comparison.',
    code: `/* start from the edges: 0 on the diagonal, the weight where
   there is an edge, INF where there is none */
void init_matrix(int n)
{
    int i, j;
    for (i = 0; i < n; i++)
        for (j = 0; j < n; j++)
            if (i == j)
                d[i][j] = 0;
            else if (adj[i][j])
                d[i][j] = adj[i][j];
            else
                d[i][j] = INF;
}

/* all-pairs shortest distances: allow k = 0, 1, ... as a stop in turn */
void floyd_warshall(int n)
{
    int i, j, k;
    init_matrix(n);                                   /*@ init */
    for (k = 0; k < n; k++)                           /*@ via */
        for (i = 0; i < n; i++)                       /*@ row */
            for (j = 0; j < n; j++)                   /*@ col */
                if (d[i][k] + d[k][j] < d[i][j])      /*@ cmp */
                    d[i][j] = d[i][k] + d[k][j];      /*@ improve */
}`,
    animate: ['floyd_warshall'], quiet: ['init_matrix'],
    inputs: [nIn(6, 4), G.input('0>1:3 0>3:7 1>0:8 1>2:2 2>0:5 2>3:1 3>0:2', { label: 'Edges with weights (0>1:3, 1-2:4)', weighted: true }),
      { id: 'pos', kind: 'hidden', def: [[-170, -130], [170, -130], [170, 130], [-170, 130]] }],
    check: (inp) => {
      const edges = G.parse(inp.graph);
      if (edges.some((e) => e[2] < 1 || e[2] > 99)) return 'Edges: weights from 1 to 99 here (0 would mean "no edge" in the matrix)';
      if (edges.length > 14) return 'Edges: at most 14, so the picture stays readable';
      return null;
    },
    presets: [
      { label: 'Four towns', values: { n: 4, graph: '0>1:3 0>3:7 1>0:8 1>2:2 2>0:5 2>3:1 3>0:2', pos: [[-170, -130], [170, -130], [170, 130], [-170, 130]] } },
      { label: 'Undirected', values: { n: 5, graph: '0-1:4 0-2:1 1-2:2 1-3:5 2-3:8 3-4:3', pos: [[-220, 0], [-40, -150], [-40, 150], [140, 0], [270, -120]] } },
      { label: 'A chain and a shortcut', values: { n: 5, graph: '0>1:2 1>2:2 2>3:2 3>4:2 0>4:20', pos: [[-240, 60], [-120, -90], [0, 60], [120, -90], [240, 60]] } },
      { label: 'Two islands', values: { n: 4, graph: '0-1:3 2-3:4 0>2:5', pos: [[-170, -110], [-170, 110], [170, -110], [170, 110]] } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => X.graphMain(inp, 'floyd_warshall(' + inp.n + ');'),
    capture(P) {
      const sc = (x) => (P.has(x, 0) && P.isSet(x, 0) ? P.val(x, 0) : null);
      return { d: W.matrix(P, 'd', 10), i: sc('i'), j: sc('j'), k: sc('k') };
    },
    scene(ctx) {
      const t = ctx.tick, data = t.data, tag = t.tag, inp = ctx.input, n = inp.n, memo = ctx.memo;
      const edges = G.parse(inp.graph), pos = W.positions(inp);
      const D = data.d.slice(0, n).map((r) => r.slice(0, n));
      const pd = ctx.prev ? ctx.prev.data.d : null;
      const started = tag !== 'enter';
      const k = data.k, i = data.i, j = data.j;
      const kk = k !== null && k < n ? k : null;
      const inPair = kk !== null && i !== null && i < n && j !== null && j < n && (tag === 'cmp' || tag === 'improve' || tag === 'col');
      memo.better = memo.better || {};
      if (tag === 'improve') (memo.better[k] = memo.better[k] || new Set()).add(i + ',' + j);
      const better = kk !== null ? memo.better[kk] || new Set() : new Set();
      const total = Object.values(memo.better).reduce((a, s) => a + s.size, 0);
      // the graph, with the route being tried drawn over it
      const items = W.graph({
        n, edges, pos,
        vcls: (x) => (x === kk ? 'focus hot' : inPair && (x === i || x === j) ? 'part-b' : ''),
        ecls: () => (inPair ? 'dim' : ''),
      });
      const tryVia = inPair && tag !== 'col' && i !== j && i !== kk && j !== kk;
      if (tryVia && !W.isInf(D[i][kk])) items.push({ key: 'via1', kind: 'arrow', from: { key: 'gv' + i }, to: { key: 'gv' + kk }, bend: 34, label: 'd=' + W.fmt(D[i][kk]), cls: 'gb-via hot' });
      if (tryVia && !W.isInf(D[kk][j])) items.push({ key: 'via2', kind: 'arrow', from: { key: 'gv' + kk }, to: { key: 'gv' + j }, bend: 34, label: 'd=' + W.fmt(D[kk][j]), cls: 'gb-via hot' });
      if (inPair && i !== j && !W.isInf(tag === 'improve' ? pd[i][j] : D[i][j])) items.push({ key: 'direct', kind: 'arrow', from: { key: 'gv' + i }, to: { key: 'gv' + j }, bend: -30, label: 'd=' + W.fmt(tag === 'improve' ? pd[i][j] : D[i][j]), cls: 'gb-direct alt' + (tag === 'improve' ? ' ghost' : '') });
      if (kk !== null) items.push({ key: 'ck', kind: 'cursor', at: 'gv' + kk, side: 'above', text: 'k', cls: 'c-rose' });
      if (inPair) {
        items.push({ key: 'cci', kind: 'cursor', at: 'gv' + i, side: 'below', text: 'i', cls: 'c-teal' });
        items.push({ key: 'ccj', kind: 'cursor', at: 'gv' + j, side: 'below', slot: i === j ? 1 : 0, text: 'j', cls: 'c-indigo' });
      }
      // the matrix
      const b = W.box(pos);
      const cw = 60, gap = 4, step = cw + gap;
      const mx = b.x1 + 130, my = (b.y0 + b.y1) / 2 - (n * step) / 2;
      items.push({ key: 'mt', kind: 'text', x: mx, y: my - 44, text: 'd[i][j]   (row i = from, column j = to)', cls: 'gb-head' });
      for (let c = 0; c < n; c++) {
        items.push({ key: 'mh' + c, kind: 'text', x: mx + c * step + cw / 2, y: my - 12, text: String(c), cls: 'gb-rowh' + (c === kk ? ' hot' : ''), anchor: 'middle' });
        items.push({ key: 'mr' + c, kind: 'text', x: mx - 20, y: my + c * step + cw / 2 + 6, text: String(c), cls: 'gb-rowh' + (c === kk ? ' hot' : ''), anchor: 'middle' });
      }
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        let cls = 'gb-tcell';
        const v = started ? D[r][c] : null;
        if (r === c) cls += ' diag';
        else if (W.isInf(v)) cls += ' inf';
        if (kk !== null && (r === kk || c === kk)) cls += ' lane';
        if (better.has(r + ',' + c)) cls += ' better';
        if (inPair && tag !== 'col' && ((r === i && c === kk) || (r === kk && c === j))) cls += ' via';
        if (inPair && r === i && c === j) cls += tag === 'improve' ? ' fresh' : ' target';
        const text = !started ? '' : tag === 'improve' && r === i && c === j ? W.fmt(pd[r][c]) + '→' + W.fmt(v) : W.fmt(v);
        items.push({ key: 'm' + r + '_' + c, kind: 'cell', x: mx + c * step, y: my + r * step, w: cw, h: cw, text, sub: '', cls, flash: tag === 'improve' && r === i && c === j });
      }
      const ty = Math.min(b.y0, my) - 110;
      items.push({ key: 'title', kind: 'text', x: b.x0 - 40, y: ty, text: !started ? 'Floyd-Warshall' : kk === null ? (tag === 'init' ? 'no stops allowed yet' : 'every vertex allowed as a stop') : 'k = ' + kk + ':  stops allowed at ' + Array.from({ length: kk + 1 }, (_, x) => x).join(', '), cls: 'gb-big' });
      let formula = '', fcls = 'gb-sum';
      if (inPair && tag === 'cmp') {
        if (W.isInf(D[i][kk]) || W.isInf(D[kk][j])) { formula = 'd[' + i + '][' + kk + '] + d[' + kk + '][' + j + '] = ∞'; fcls += ' muted'; }
        else {
          const s = D[i][kk] + D[kk][j];
          formula = 'd[' + i + '][' + kk + '] + d[' + kk + '][' + j + '] = ' + D[i][kk] + ' + ' + D[kk][j] + ' = ' + s + (s < D[i][j] ? '  <  ' : '  ≥  ') + 'd[' + i + '][' + j + '] = ' + W.fmt(D[i][j]);
          if (s < D[i][j]) fcls += ' good';
        }
      }
      if (inPair && tag === 'improve') { formula = 'd[' + i + '][' + j + '] = ' + D[i][kk] + ' + ' + D[kk][j] + ' = ' + D[i][j] + '   (was ' + W.fmt(pd[i][j]) + ')'; fcls += ' good'; }
      items.push({ key: 'formula', kind: 'text', x: b.x0 - 40, y: ty + 34, text: formula, cls: fcls });
      items.push({ key: 'count', kind: 'text', x: mx, y: my + n * step + 26, text: started ? total + ' cell' + (total === 1 ? '' : 's') + ' improved so far' + (kk !== null ? ', ' + better.size + ' with k = ' + kk : '') : '', cls: 'gb-note muted' });
      const view = { x: b.x0 - 80, y: ty - 40, w: mx + n * step + 40 - (b.x0 - 80), h: Math.max(b.y1 + 110, my + n * step + 60) - (ty - 40) };

      let say = '';
      switch (tag) {
        case 'enter': say = 'floyd_warshall(' + n + '): the shortest distance from every vertex to every other, kept in the matrix d. Row i, column j is the trip from i to j.'; break;
        case 'init': say = 'init_matrix(): each cell starts as the direct edge, 0 on the diagonal and ∞ where there is no edge. These are the best trips with no stops in between.'; break;
        case 'via': say = k < n ? 'k = ' + k + ': from now on a trip may also stop at ' + k + '. Row ' + k + ' and column ' + k + ' (blue) hold the trips to and from ' + k + '; every other cell is checked against them.' : 'Every vertex has been allowed as a stop, so every cell holds a shortest distance. ' + total + ' cells improved on the way.'; break;
        case 'row': say = i < n ? 'Row ' + i + ': trips that start at ' + i + '.' : 'All pairs tried with stop ' + k + ': ' + better.size + ' cell' + (better.size === 1 ? '' : 's') + ' improved.'; break;
        case 'col': say = j < n ? 'Pair ' + i + ' → ' + j + '.' : 'Row ' + i + ' done for k = ' + k + '.'; break;
        case 'cmp': {
          if (i === j) say = 'd[' + i + '][' + i + '] is 0: no trip from a vertex to itself can beat that.';
          else if (i === kk || j === kk) say = (i === kk ? 'The trip starts' : 'The trip ends') + ' at ' + kk + ' itself, so a stop at ' + kk + ' adds nothing: the sum equals d[' + i + '][' + j + '].';
          else if (W.isInf(D[i][kk])) say = 'No route from ' + i + ' to ' + kk + ' is known (∞): stopping at ' + kk + ' cannot help this trip.';
          else if (W.isInf(D[kk][j])) say = 'No route from ' + kk + ' to ' + j + ' is known (∞): stopping at ' + kk + ' cannot help.';
          else {
            const s = D[i][kk] + D[kk][j];
            say = i + ' → ' + kk + ' → ' + j + ' costs ' + D[i][kk] + ' + ' + D[kk][j] + ' = ' + s + '. ' + (s < D[i][j] ? 'Cheaper than ' + W.fmt(D[i][j]) + '.' : 'Not cheaper than ' + W.fmt(D[i][j]) + ': keep it.');
          }
          break;
        }
        case 'improve': say = 'd[' + i + '][' + j + '] drops from ' + W.fmt(pd[i][j]) + ' to ' + D[i][j] + ': the trip ' + i + ' → ' + j + ' is now cheaper with a stop at ' + k + '.'; break;
        case 'after': say = 'Done: the matrix holds every shortest distance, read it as row = from, column = to.' + (D.some((r) => r.some((x) => W.isInf(x))) ? ' A cell still at ∞ means there is no route at all.' : ''); break;
      }
      return { items, say, view, slow: tag === 'improve' };
    },
    predict: [
      {
        at: (t, i, ts, ctx) => { t = ts[i + 1]; if (!t) return false; const d = t.data; if (t.tag !== 'cmp' || d.k === null || d.i === d.j || d.i === d.k || d.j === d.k) return false; return !W.isInf(d.d[d.i][d.k]) && !W.isInf(d.d[d.k][d.j]); },
        once: true, pick: 'option',
        ask: (t) => { const d = t.data; return 'd[' + d.i + '][' + d.k + '] = ' + d.d[d.i][d.k] + ', d[' + d.k + '][' + d.j + '] = ' + d.d[d.k][d.j] + ', d[' + d.i + '][' + d.j + '] = ' + W.fmt(d.d[d.i][d.j]) + '. Will d[' + d.i + '][' + d.j + '] change?'; },
        options: () => ['Yes', 'No'],
        answer: (ts, i) => { const d = ts[i].data; return d.d[d.i][d.k] + d.d[d.k][d.j] < d.d[d.i][d.j] ? 'Yes' : 'No'; },
        explain: (ts, i) => { const d = ts[i].data; return 'Through ' + d.k + ': ' + d.d[d.i][d.k] + ' + ' + d.d[d.k][d.j] + ' = ' + (d.d[d.i][d.k] + d.d[d.k][d.j]) + ', against ' + W.fmt(d.d[d.i][d.j]) + ' now.'; },
      },
      {
        at: (t, i, ts, ctx) => t.tag === 'via' && t.data.k === 1 && ctx.input.n > 2, once: true, pick: 'option',
        ask: 'Now k = 1. Can any cell in row 1 or column 1 change during this pass?',
        options: () => ['Yes, they change first', 'No, they cannot change', 'Only the diagonal'],
        answer: () => 'No, they cannot change',
        explain: () => 'For a cell in row 1, the route through 1 is d[1][1] + d[1][j] = 0 + d[1][j]: never smaller. That is why the loops can update d in place.',
      },
    ],
    quiz: [
      { q: 'What does d[i][j] hold after the pass for k?', options: ['The shortest distance using any stops', 'The shortest distance whose stops are all among 0..k', 'The direct edge only', 'The number of paths'], answer: 1, why: 'Each pass allows one more vertex as a stop; after the last pass every vertex is allowed.' },
      { q: 'Why must the k loop be the outermost loop?', options: ['It is faster', 'The answer for stops 0..k needs every pair finished for stops 0..k-1', 'C requires it', 'It makes no difference'], answer: 1, why: 'Putting k inside would combine half-finished values: some pairs would never be offered the right stop.' },
      { q: 'How long does it take on n vertices?', options: ['O(n²)', 'O(n² log n)', 'O(n³)', 'O(2ⁿ)'], answer: 2, why: 'Three nested loops of n each, one comparison inside.' },
      { q: 'How could you tell that the graph has a negative cycle (if negative weights were allowed)?', options: ['Some d[i][i] ends up below 0', 'Some cell stays ∞', 'The matrix is not symmetric', 'You cannot'], answer: 0, why: 'A trip from i back to i with a negative total means a negative cycle through i.' },
      { q: 'When is Floyd-Warshall a better choice than running Dijkstra from every vertex?', options: ['For huge sparse graphs', 'For small, dense graphs, or when weights may be negative', 'Never', 'Only for trees'], answer: 1, why: 'It is short, has no priority queue, and is n³ whatever the number of edges; it also allows negative edges.' },
    ],
    compareWith: 'dijkstra',
  });
})(SEE);
