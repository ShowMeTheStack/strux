// Graphs: the family and breadth-first search.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, G = X.GraphKit;

  X.family({
    id: 'graph', order: 1, group: 'Graphs', title: 'Graph traversal',
    blurb: 'Vertices and edges, stored as a matrix or as lists, and the two ways of visiting all of them: by layers and by going deep.',
    head: `#include <stdio.h>

#define MAXV 10

/* adj[u][v] is the weight of the edge from u to v; 0 means there is no edge */
int adj[MAXV][MAXV];`,
  });
  // a few graphs with good positions, so the picture is clear
  X.graphPresets = {
    house: { n: 6, graph: '0-1 0-2 1-3 2-3 2-4 3-5 4-5', pos: [[0, -150], [-130, -40], [130, -40], [-130, 120], [130, 120], [0, 230]] },
    tree: { n: 7, graph: '0-1 0-2 1-3 1-4 2-5 2-6', pos: [[0, -140], [-150, -20], [150, -20], [-220, 110], [-80, 110], [80, 110], [220, 110]] },
    ring: { n: 6, graph: '0-1 1-2 2-3 3-4 4-5 5-0', pos: null },
    two: { n: 7, graph: '0-1 1-2 2-0 3-4 4-5 5-6', pos: [[-220, -60], [-120, -140], [-120, 20], [60, -60], [160, -140], [260, -60], [160, 40]] },
    dense: { n: 6, graph: '0-1 0-2 0-3 1-2 1-4 2-3 2-5 3-5 4-5', pos: [[0, -160], [-170, -50], [0, -20], [170, -50], [-120, 140], [120, 140]] },
  };
  X.graphMain = (inp, call, directed) => {
    const edges = G.parse(inp.graph);
    return `int main(void)
{
    int init[MAXV][MAXV] = ${G.matrixInit(10, edges, directed).replace(/\n {8}/g, '\n        ')};
    int i, j;
    for (i = 0; i < MAXV; i++)
        for (j = 0; j < MAXV; j++)
            adj[i][j] = init[i][j];
    ${call}
    return 0;
}`;
  };
  X.graphInputs = (extra) => [
    { id: 'n', kind: 'int', label: 'Vertices', def: 6, lo: 1, hi: 10 },
    G.input('0-1 0-2 1-3 2-3 2-4 3-5 4-5'),
    { id: 'pos', kind: 'hidden', def: X.graphPresets.house.pos },
  ].concat(extra || []);

  // ---- breadth-first search --------------------------------------------------------------------------------
  X.topic({
    id: 'bfs', family: 'graph', order: 10, title: 'Breadth-first search',
    blurb: 'A queue decides the order: first the start, then everything one edge away, then everything two edges away, like ripples on water.',
    code: `/* visit every vertex reachable from s, nearest first */
void bfs(int n, int s)
{
    int visited[MAXV] = { 0 };
    int dist[MAXV];
    int queue[MAXV];
    int front = 0, rear = 0;
    int u, v;
    visited[s] = 1;                           /*@ mark-start */
    dist[s] = 0;
    queue[rear++] = s;                        /*@ enqueue-start */
    while (front < rear) {                    /*@ loop */
        u = queue[front++];                   /*@ dequeue */
        printf("visit %d (distance %d)\\n", u, dist[u]);   /*@ visit */
        for (v = 0; v < n; v++) {             /*@ scan */
            if (adj[u][v] && !visited[v]) {   /*@ check */
                visited[v] = 1;               /*@ discover */
                dist[v] = dist[u] + 1;        /*@ dist */
                queue[rear++] = v;            /*@ enqueue */
            }
        }
    }
}`,
    animate: ['bfs'],
    inputs: X.graphInputs([{ id: 's', kind: 'int', label: 'Start at', def: 0, lo: 0, hi: 9 }]),
    check: (inp) => (inp.s >= inp.n ? 'Start at: a vertex from 0 to ' + (inp.n - 1) : null),
    presets: [
      { label: 'House', values: Object.assign({ s: 0 }, X.graphPresets.house) },
      { label: 'Tree', values: Object.assign({ s: 0 }, X.graphPresets.tree) },
      { label: 'Ring', values: Object.assign({ s: 0 }, X.graphPresets.ring) },
      { label: 'Two parts', values: Object.assign({ s: 0 }, X.graphPresets.two) },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => X.graphMain(inp, 'bfs(' + inp.n + ', ' + inp.s + ');'),
    capture(P) {
      const n = P.val('n', 0) || 0;
      const g = (name) => P.arr(name, n);
      return { visited: g('visited'), dist: g('dist'), queue: P.arr('queue', n), front: P.val('front', 0), rear: P.val('rear', 0), u: P.isSet('u', 0) ? P.val('u', 0) : null, v: P.isSet('v', 0) ? P.val('v', 0) : null, n };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const edges = G.parse(inp.graph);
      const pos = G.positions(inp.n, inp.pos);
      const memo = ctx.memo;
      memo.parent = memo.parent || {};
      memo.done = memo.done || new Set();
      if (tag === 'discover' && d.v !== null) memo.parent[d.v] = d.u;
      if (tag === 'dequeue' && memo.cur !== undefined && memo.cur !== null) memo.done.add(memo.cur);
      if (tag === 'dequeue') memo.cur = d.u;
      if (tag === 'after') { if (memo.cur !== null && memo.cur !== undefined) memo.done.add(memo.cur); memo.cur = null; }
      const inQueue = new Set(d.queue && d.front !== null ? d.queue.slice(d.front, d.rear) : []);
      const isTree = (a, b) => memo.parent[b] === a || memo.parent[a] === b;
      const checking = (tag === 'check' || tag === 'scan') && d.u !== null && d.v !== null && d.v < inp.n;
      const items = G.picture({
        n: inp.n, edges, pos,
        vcls: (v) => (v === d.u && memo.cur === v && tag !== 'after' ? 'focus hot' : memo.done.has(v) ? 'done' : inQueue.has(v) ? 'part-b' : d.visited && d.visited[v] ? 'part-b' : ''),
        vsub: (v) => (d.visited && d.visited[v] && d.dist && d.dist[v] !== null ? 'd=' + d.dist[v] : ''),
        ecls: (a, b) => ((checking && ((a === d.u && b === d.v) || (b === d.u && a === d.v))) ? 'hot' : isTree(a, b) ? 'part-a' : 'dim'),
      });
      // the queue and the per-vertex arrays, under the graph
      const maxY = Math.max(...pos.map((p) => p.y)) + 90;
      const minX = Math.min(...pos.map((p) => p.x));
      items.push(...G.strip('queue', 'queue', d.queue ? d.queue.slice(d.front, d.rear) : [], { x0: minX + 60, y0: maxY, empty: 'empty' }));
      items.push(...G.table('vis', 'visited', (d.visited || []).map((x) => (x === null ? '' : x)), { x0: minX + 60, y0: maxY + 80, cls: (i, x) => (x ? 'part-b' : '') }));
      if (checking) items.push({ key: 'cv', kind: 'cursor', at: 'gv' + d.v, side: 'above', text: 'v', cls: 'c-amber' });
      if (d.u !== null && memo.cur === d.u && tag !== 'after') items.push({ key: 'cu', kind: 'cursor', at: 'gv' + d.u, side: 'left', text: 'u', cls: 'c-teal' });
      let say = '';
      const q = d.queue ? d.queue.slice(d.front, d.rear) : [];
      switch (tag) {
        case 'enter': say = 'bfs(' + inp.n + ', ' + inp.s + '): start at vertex ' + inp.s + '. Nothing is visited yet; the queue is empty.'; break;
        case 'mark-start': say = 'Vertex ' + inp.s + ' is marked visited before anything else, so it can never be added to the queue twice.'; break;
        case 'enqueue-start': say = 'The start goes into the queue, at distance 0. The queue holds the vertices that are found but not yet explored.'; break;
        case 'loop': say = q.length ? 'The queue holds ' + q.join(', ') + ': there is more to explore.' : 'The queue is empty: every vertex reachable from ' + inp.s + ' has been explored.'; break;
        case 'dequeue': say = 'Take the vertex at the front of the queue: u = ' + d.u + '. The queue is first in, first out, which is what makes the search go layer by layer.'; break;
        case 'visit': say = 'Visit ' + d.u + ', at distance ' + d.dist[d.u] + ' from the start. Now look at all its neighbours.'; break;
        case 'scan': say = d.v < inp.n ? 'Next candidate: v = ' + d.v + '.' : 'All neighbours of ' + d.u + ' have been looked at; ' + d.u + ' is finished.'; break;
        case 'check': { const e = edges.some(([a, b]) => (a === d.u && b === d.v) || (a === d.v && b === d.u)); say = !e ? 'No edge between ' + d.u + ' and ' + d.v + '.' : d.visited[d.v] ? d.v + ' is a neighbour, but it is already visited: skip it.' : d.v + ' is a neighbour that nobody has found yet.'; break; }
        case 'discover': say = 'Mark ' + d.v + ' visited now, as it is found, not later when it is explored.'; break;
        case 'dist': say = d.v + ' is one edge further than ' + d.u + ': distance ' + d.dist[d.v] + '. The edge ' + d.u + '–' + d.v + ' joins the search tree.'; break;
        case 'enqueue': say = d.v + ' joins the back of the queue: ' + q.join(', ') + '. It waits behind every vertex found before it.'; break;
        case 'after': say = 'Done. The green edges form the BFS tree: following them back from any vertex gives a shortest path to ' + inp.s + ' in number of edges.'; break;
      }
      return { items, say };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'dequeue' && i > 4, once: true, ask: 'Which vertex comes out of the queue next? Click it.', answer: (ts, i) => 'gv' + ts[i + 1].data.u, explain: () => 'The one at the front: it has waited longest.' },
      { at: (t, i, ts) => t.tag === 'check' && ts[i + 1] && ts[i + 1].tag === 'discover', once: true, ask: (t) => 'Vertex ' + t.data.v + ' is a neighbour nobody has found. What will its distance be?', options: (ts, i) => { const d = ts[i].data; const r = d.dist[d.u]; return [r, r + 1, r + 2].map(String); }, pick: 'option', answer: (ts, i) => String(ts[i].data.dist[ts[i].data.u] + 1), explain: () => 'One more than the vertex it was found from.' },
    ],
    quiz: [
      { q: 'Why does BFS mark a vertex visited when it is put in the queue, not when it comes out?', options: ['It is faster to type', 'So it cannot be put in the queue twice', 'To print it earlier', 'It makes no difference'], answer: 1, why: 'Another neighbour could find it again while it waits in the queue; marking it at once prevents a second copy.' },
      { q: 'In an unweighted graph, BFS from s finds...', options: ['The longest paths', 'Shortest paths in number of edges', 'A minimum spanning tree', 'Only cycles'], answer: 1, why: 'Vertices come out in order of distance, so the first time one is found is along a shortest path.' },
      { q: 'With an adjacency matrix, how much time does BFS take on n vertices?', options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)'], answer: 2, why: 'For each of the n vertices it scans a whole row of n entries.' },
    ],
    compareWith: 'dfs',
  });
})(SEE);
