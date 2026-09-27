// Graphs, order and structure: topological order (Kahn's queue, DFS finishing order) and cycle detection
// (undirected with a parent, directed with three colours).
(function (SEE) {
  'use strict';
  const X = SEE.Strux, G = X.GraphKit, GW = X.GWalk;
  const DP = GW.dirPresets, UP = GW.undirPresets;

  X.family({
    id: 'gorder', order: 4, group: 'Graphs', title: 'Order and structure',
    blurb: 'What a search can tell you about a graph: an order that respects every arrow, whether there is a cycle, and how it falls apart into pieces.',
    head: `#include <stdio.h>

#define MAXV 10

/* adj[u][v] is 1 when there is an edge from u to v */
int adj[MAXV][MAXV];`,
  });

  /** main: the chosen graph into adj, a few declarations, then the call */
  const gMain = (inp, decl, call, directed) => {
    const edges = G.parse(inp.graph);
    return `int main(void)
{
    int init[MAXV][MAXV] = ${G.matrixInit(10, edges, directed).replace(/\n {8}/g, '\n        ')};
    int i, j;${decl ? '\n    ' + decl : ''}
    for (i = 0; i < MAXV; i++)
        for (j = 0; j < MAXV; j++)
            adj[i][j] = init[i][j];
    ${call}
    return 0;
}`;
  };
  X.gwMain = gMain;
  const layout = (inp) => { const pos = G.positions(inp.n, inp.pos); return { pos, box: GW.box(pos, 30) }; };
  X.gwLayout = layout;
  const dirInputs = (p, n) => GW.inputs(p.graph, p.pos, n || p.n, GW.directedOnly);
  const undirInputs = (p, n) => GW.inputs(p.graph, p.pos, n || p.n, GW.undirectedOnly);
  X.gwDirInputs = dirInputs; X.gwUndirInputs = undirInputs;

  /** The active calls of fn as a tower of frames beside the graph */
  const callTower = (calls, label, box, n) => GW.tower('fr', calls, {
    x0: box.x1 + 80, y0: box.y1 - 36, w: 250, h: 36, title: 'call stack', empty: 'empty',
    ids: calls.map((c) => 'fr' + c.args.u), text: (k, c) => label(c),
    cls: (k) => 'gw-frame' + (k === calls.length - 1 ? ' gw-top' : ''),
  });
  X.gwCallTower = callTower;
  const towerBox = (box, n) => ({ x0: box.x1 + 70, y0: Math.min(box.y0, box.y1 - 36 - (n - 1) * 40), x1: box.x1 + 340, y1: box.y1 + 30 });
  X.gwTowerBox = towerBox;
  /**
   * The frame a tick belongs to. If a return line is recorded after the function has gone, its frame is
   * the one on top in the tick before; a call line is recorded once the callee has started, so its frame is
   * the one under the top.
   */
  const frameOf = (ctx, calls, retTags) => {
    const t = ctx.tick;
    if ((t.end || retTags.includes(t.tag)) && ctx.prev && ctx.prev.data && ctx.prev.data.calls && calls.length < ctx.prev.data.calls.length) {
      const pc = ctx.prev.data.calls;
      return pc.length ? pc[pc.length - 1] : null;
    }
    const before = ctx.prev && ctx.prev.data && ctx.prev.data.calls ? ctx.prev.data.calls.length : 0;
    if (t.tag === 'dive' && calls.length > 1 && calls.length > before) return calls[calls.length - 2];
    return calls.length ? calls[calls.length - 1] : null;
  };
  X.gwFrameOf = frameOf;
  /** Point tree edges the way the search went */
  const orient = (items, parent) => {
    for (const it of items) {
      if (it.kind !== 'arrow' || !/gw-tree/.test(it.cls)) continue;
      const a = +it.from.key.slice(2), b = +it.to.key.slice(2);
      if (parent[a] === b) { it.from = { key: 'gv' + b }; it.to = { key: 'gv' + a }; }
      it.noHead = false;
    }
    return items;
  };
  X.gwOrient = orient;
  /** A row of cells with a title on the left; keys are stable per value so cells slide between rows */
  const row = (key, title, values, x0, y0, opts) => {
    opts = opts || {};
    const items = [{ key: key + 'T', kind: 'text', x: x0 - 14, y: y0 + 27, text: title, cls: 'gw-label', anchor: 'end' }];
    if (!values.length && opts.empty) items.push({ key: key + 'E', kind: 'text', x: x0 + 4, y: y0 + 27, text: opts.empty, cls: 'gw-small' });
    values.forEach((v, i) => items.push({ key: (opts.ids ? opts.ids(v, i) : key + v), kind: 'cell', x: x0 + i * 48, y: y0, w: 44, h: 42, text: v, sub: opts.sub ? opts.sub(v, i) : '', cls: opts.cls ? opts.cls(v, i) || '' : '', enter: opts.from ? 'fly' : 'fade', from: opts.from ? opts.from(v, i) : undefined }));
    return items;
  };
  X.gwRow = row;

  // ---- topological order: Kahn's algorithm --------------------------------------------------------------------
  X.topic({
    id: 'topo-kahn', family: 'gorder', order: 10, title: 'Topological order (Kahn)',
    blurb: 'Count the arrows coming into each vertex. A vertex with none can go first; taking it out lowers the count of everything it points to. A cycle never reaches zero.',
    code: `/* indeg[v] = the number of edges coming into v */
void count_in(int n, int indeg[])
{
    int u, v;
    for (v = 0; v < n; v++)
        indeg[v] = 0;
    for (u = 0; u < n; u++)
        for (v = 0; v < n; v++)
            if (adj[u][v])
                indeg[v]++;
}

/* fill topo[] so that every edge points forwards; returns how
   many vertices were placed (fewer than n: there is a cycle) */
int topo_kahn(int n, int topo[])
{
    int indeg[MAXV], queue[MAXV];
    int front = 0, rear = 0, done = 0;
    int u, v;
    count_in(n, indeg);                         /*@ count */
    for (v = 0; v < n; v++)                     /*@ seed-loop */
        if (indeg[v] == 0)                      /*@ seed-test */
            queue[rear++] = v;                  /*@ seed */
    while (front < rear) {                      /*@ loop */
        u = queue[front++];                     /*@ take */
        topo[done++] = u;                       /*@ place */
        for (v = 0; v < n; v++)                 /*@ scan */
            if (adj[u][v] && --indeg[v] == 0)   /*@ drop */
                queue[rear++] = v;              /*@ ready */
    }
    return done;                                /*@ return */
}`,
    animate: ['topo_kahn'], quiet: ['count_in'],
    inputs: dirInputs(DP.tangled),
    presets: [
      { label: 'Tangled', values: Object.assign({}, DP.tangled) },
      { label: 'Courses', values: Object.assign({}, DP.courses) },
      { label: 'With a cycle', values: Object.assign({}, DP.cyclic) },
      { label: 'A chain', values: Object.assign({}, DP.chain) },
    ],
    counters: ['compares', 'moves'],
    main: (inp) => gMain(inp, 'int topo[MAXV], placed;', 'placed = topo_kahn(' + inp.n + ', topo);\n    printf("%d of ' + inp.n + ' placed\\n", placed);', true),
    capture(P) {
      const s = (k) => (P.has(k, 0) && P.isSet(k, 0) ? P.val(k, 0) : null);
      return { indeg: GW.ints(P, 'indeg', 10, 0), queue: GW.ints(P, 'queue', 10, 0), topo: GW.ints(P, 'topo', 10, 0), front: s('front'), rear: s('rear'), done: s('done'), u: s('u'), v: s('v'), placed: P.isSet('placed') ? P.val('placed') : null };
    },
    scene(ctx) {
      const tag = ctx.tick.tag, inp = ctx.input, n = inp.n;
      // the return line and main see none of topo_kahn's locals: keep the last state that had them
      if (ctx.tick.data.front !== null) ctx.memo.last = ctx.tick.data;
      const d = ctx.tick.data.front === null && ctx.memo.last ? ctx.memo.last : ctx.tick.data;
      const edges = G.parse(inp.graph);
      const { pos, box } = layout(inp);
      const counted = d.indeg && d.indeg[0] !== null && tag !== 'enter';
      const q = d.front !== null && d.rear !== null ? d.queue.slice(d.front, d.rear) : [];
      const out = d.done ? d.topo.slice(0, d.done) : [];
      const outSet = new Set(out);
      const ended = tag === 'after' || tag === 'return';
      const left = ended ? [...Array(n).keys()].filter((x) => !outSet.has(x)) : [];
      const prevIn = ctx.prev && ctx.prev.data && ctx.prev.data.indeg ? ctx.prev.data.indeg : d.indeg;
      const dropped = tag === 'drop' && d.v !== null && d.v < n && prevIn[d.v] !== d.indeg[d.v];
      const cur = d.u !== null && !ended && d.done ? d.u : null;
      const checking = (tag === 'drop' || tag === 'ready') && cur !== null && d.v !== null && d.v < n;
      const items = G.picture({
        n, edges, pos,
        vsub: (x) => (counted ? 'in ' + d.indeg[x] : ''),
        vcls: (x) => 'gw-sub ' + (x === cur ? 'focus hot' : outSet.has(x) ? 'done' : left.includes(x) ? 'gw-ring' : q.includes(x) ? 'part-b' : dropped && x === d.v ? 'hot' : ''),
        ecls: (a, b) => (checking && a === cur && b === d.v ? 'hot' : outSet.has(a) ? 'gw-gone' : left.includes(a) && left.includes(b) ? 'gw-cycle' : ''),
      });
      for (const it of items) if (it.kind === 'vertex' && dropped && it.key === 'gv' + d.v) it.flash = true;
      if (checking) items.push({ key: 'cv', kind: 'cursor', at: 'gv' + d.v, side: 'above', text: 'v', cls: 'c-amber' });
      // the queue and the order, under the graph; a vertex slides from one to the other
      const x0 = box.x0 + 90, y0 = box.y1 + 34;
      items.push(...row('qu', 'queue', q, x0, y0, { ids: (v) => 'tk' + v, empty: 'empty', cls: () => 'part-b', from: (v) => ({ x: pos[v].x - 22, y: pos[v].y - 21 }) }));
      items.push(...row('or', 'topo', out, x0, y0 + 64, { ids: (v) => 'tk' + v, cls: () => 'done', sub: (v, i) => i }));
      items.push(...row('id', 'indeg', [...Array(n).keys()], x0, y0 + 136, { ids: (v) => 'id' + v, sub: (v) => v, cls: (v) => (dropped && v === d.v ? 'hot' : counted && d.indeg[v] === 0 && !outSet.has(v) ? 'part-b' : '') }).map((it) => (it.kind === 'cell' ? Object.assign(it, { text: counted ? d.indeg[it.sub] : '' }) : it)));
      const view = GW.view([box, { x0: x0 - 90, y0, x1: x0 + Math.max(n, 6) * 48, y1: y0 + 200 }]);
      let say = '';
      switch (tag) {
        case 'enter': say = 'topo_kahn(' + n + ', topo): find an order where every arrow points from an earlier vertex to a later one.'; break;
        case 'count': say = 'count_in() counts the arrows coming into each vertex: ' + [...Array(n).keys()].map((x) => x + ':' + d.indeg[x]).join(', ') + '. A vertex with 0 waits for nobody.'; break;
        case 'seed-loop': say = d.v < n ? 'Is vertex ' + d.v + ' free to go?' : 'The starting queue: ' + GW.list(q) + '.'; break;
        case 'seed-test': say = d.indeg[d.v] === 0 ? 'indeg[' + d.v + '] is 0: nothing has to come before ' + d.v + '.' : 'indeg[' + d.v + '] is ' + d.indeg[d.v] + ': ' + d.v + ' must wait.'; break;
        case 'seed': say = d.v + ' joins the queue.'; break;
        case 'loop': say = q.length ? 'The queue holds ' + q.join(', ') + ': each of these can go next.' : (d.done < n ? 'The queue is empty, but only ' + d.done + ' of ' + n + ' vertices are placed.' : 'The queue is empty and all ' + n + ' vertices are placed.'); break;
        case 'take': say = 'Take u = ' + d.u + ' from the front of the queue.'; break;
        case 'place': say = 'topo[' + (d.done - 1) + '] = ' + d.u + '. Everything that had to come before ' + d.u + ' is already in topo. Its arrows can now be taken away.'; break;
        case 'scan': say = d.v < n ? (GW.has(edges, d.u, d.v) ? 'There is an arrow ' + d.u + ' → ' + d.v + '.' : 'No arrow ' + d.u + ' → ' + d.v + '.') : 'All of ' + d.u + '\'s arrows have been taken away.'; break;
        case 'drop': say = !dropped ? 'Nothing to do for ' + d.v + '.' : '--indeg[' + d.v + ']: one fewer arrow into ' + d.v + ', now ' + d.indeg[d.v] + '.' + (d.indeg[d.v] === 0 ? ' It was the last one.' : ' It still has to wait.'); break;
        case 'ready': say = d.v + ' has nothing left to wait for: it joins the queue.'; break;
        case 'return': say = d.done === n ? 'All ' + n + ' vertices are placed: ' + out.join(', ') + '.' : 'Only ' + d.done + ' of ' + n + ' are placed. ' + left.join(', ') + ' never reached in-degree 0: each waits for another one of them. That is a cycle.'; break;
        case 'after': say = d.done === n ? 'topo = ' + out.join(', ') + '. Every arrow goes left to right in this order. Other orders can be right too: whenever the queue held two vertices, either could have gone first.' : 'No topological order exists: the red arrows form a cycle, and in a cycle every vertex waits for the one before it.'; break;
      }
      return { items, say, view, slow: tag === 'ready' || (tag === 'return' && d.done < n) };
    },
    predict: [
      {
        at: (t, i, ts) => { if (t.tag !== 'place') return false; const r = []; for (let k = i + 1; k < ts.length && ts[k].tag !== 'take' && ts[k].tag !== 'return'; k++) if (ts[k].tag === 'ready') r.push(ts[k].data.v); return r.length === 1 && i > 10; },
        once: true, ask: (t) => t.data.u + ' is placed and its arrows are taken away. Click the vertex that becomes ready because of it.',
        answer: (ts, i) => { for (let k = i + 1; k < ts.length; k++) if (ts[k].tag === 'ready') return 'gv' + ts[k].data.v; return null; },
        explain: () => 'The only vertex whose last incoming arrow came from it.',
      },
      { at: (t, i, ts) => t.tag === 'loop' && t.data.front === t.data.rear, once: true, ask: 'The queue is empty. Has every vertex been placed?', options: () => ['Yes', 'No'], answer: (ts, i, ctx) => (ts[i].data.done === ctx.input.n ? 'Yes' : 'No'), pick: 'option', explain: (ts, i, ctx) => (ts[i].data.done === ctx.input.n ? 'Every vertex got to in-degree 0.' : 'Some vertices still have arrows coming in from each other: a cycle.') },
    ],
    quiz: [
      { q: 'Which vertices can come first in a topological order?', options: ['Those with no arrows going out', 'Those with no arrows coming in', 'The one with the smallest number', 'Any vertex'], answer: 1, why: 'Nothing has to come before a vertex with in-degree 0.' },
      { q: 'Kahn\'s algorithm ends with fewer than n vertices placed. Why?', options: ['The graph is disconnected', 'There is a cycle', 'The queue was too small', 'Some vertex has no edges'], answer: 1, why: 'In a cycle every vertex has an arrow coming in from another vertex of the cycle, so none of them ever reaches 0.' },
      { q: 'Is the topological order unique?', options: ['Always', 'Never', 'Only when the queue never holds more than one vertex', 'Only for trees'], answer: 2, why: 'When two vertices are ready at the same time, either could go first.' },
      { q: 'With an adjacency matrix, Kahn\'s algorithm takes...', options: ['O(n)', 'O(n + m)', 'O(n²)', 'O(n³)'], answer: 2, why: 'Counting in-degrees and taking away each vertex\'s arrows both read whole rows: n² in all. With lists it is O(n + m).' },
    ],
    compareWith: 'topo-dfs',
  });

  // ---- topological order by depth-first finishing times --------------------------------------------------
  X.topic({
    id: 'topo-dfs', family: 'gorder', order: 20, title: 'Topological order (DFS)',
    blurb: 'Run depth-first search and note when each vertex is finished. A vertex finishes only after everything it points to: reverse the finishing order and every arrow points forwards.',
    code: `int visited[MAXV];
int order[MAXV];     /* vertices in the order they finish */
int count = 0;

void visit(int n, int u)
{
    int v;
    visited[u] = 1;                       /*@ mark */
    for (v = 0; v < n; v++)               /*@ scan */
        if (adj[u][v] && !visited[v])     /*@ check */
            visit(n, v);                  /*@ dive */
    order[count++] = u;                   /*@ finish */
}

/* print a topological order: the reverse of the finishing order */
void topo_dfs(int n)
{
    int u;
    for (u = 0; u < n; u++)               /*@ outer */
        if (!visited[u])                  /*@ outer-test */
            visit(n, u);                  /*@ start */
    while (count > 0)                     /*@ pop-loop */
        printf("%d ", order[--count]);    /*@ pop */
}`,
    animate: ['topo_dfs', 'visit'],
    inputs: dirInputs(DP.tangled),
    presets: [
      { label: 'Tangled', values: Object.assign({}, DP.tangled) },
      { label: 'Courses', values: Object.assign({}, DP.courses) },
      { label: 'Diamond', values: Object.assign({}, DP.diamond) },
      { label: 'A chain', values: Object.assign({}, DP.chain) },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => gMain(inp, '', 'topo_dfs(' + inp.n + ');', true),
    capture(P) {
      const calls = P.calls(['v', 'u']);
      return { visited: GW.ints(P, 'visited', 10), order: GW.ints(P, 'order', 10), count: P.val('count'), calls: calls.filter((c) => c.fn === 'visit'), outer: (calls.find((c) => c.fn === 'topo_dfs') || { args: {} }).args.u };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, n = inp.n;
      const edges = G.parse(inp.graph);
      const { pos, box } = layout(inp);
      const memo = ctx.memo;
      if (memo.at !== ctx.i) {
        memo.at = ctx.i;
        memo.parent = memo.parent || {};
        memo.total = Math.max(memo.total || 0, d.count || 0);
        d.calls.forEach((c, k) => { if (k > 0 && memo.parent[c.args.u] === undefined) memo.parent[c.args.u] = d.calls[k - 1].args.u; });
        if (tag === 'pop-loop' || tag === 'pop') memo.popping = true;
      }
      const me = frameOf(ctx, d.calls, ['finish']);
      const u = me ? me.args.u : null, v = me && me.args.v !== undefined ? me.args.v : null;
      const onStack = d.calls.map((c) => c.args.u);
      const total = memo.total;
      const fin = d.order.slice(0, memo.popping ? total : d.count || 0);
      const finSet = new Set(fin);
      const stackPart = memo.popping ? d.order.slice(0, d.count) : fin;
      const printed = memo.popping ? d.order.slice(d.count, total).reverse() : [];
      const checking = (tag === 'check' || tag === 'dive') && v !== null && v < n;
      const isTree = (a, b) => memo.parent[b] === a;
      const onPath = (a, b) => { const i = onStack.indexOf(a); return i >= 0 && onStack[i + 1] === b; };
      const items = orient(G.picture({
        n, edges, pos,
        vcls: (x) => (x === u && !memo.popping && tag !== 'start' ? 'focus hot' : finSet.has(x) ? 'done' : onStack.includes(x) ? 'part-b' : ''),
        ecls: (a, b) => (checking && a === u && b === v ? 'hot' : onPath(a, b) ? 'gw-path' : isTree(a, b) ? 'gw-tree' : ''),
      }), memo.parent);
      if (checking) items.push({ key: 'cv', kind: 'cursor', at: 'gv' + v, side: 'above', text: 'v', cls: 'c-amber' });
      // finished vertices pile up on a stack; at the end they come off it, newest first
      const sx = box.x1 + 90, sy = box.y1 - 36;
      items.push(...GW.tower('fs', stackPart, {
        x0: sx, y0: sy, w: 60, h: 36, title: 'order[]', ids: stackPart.map((x) => 'fo' + x),
        cls: (k) => 'done' + (k === stackPart.length - 1 ? ' gw-top' : ''),
      }).map((it) => (it.kind === 'cell' ? Object.assign(it, { enter: 'fly', from: { x: pos[it.text].x - 30, y: pos[it.text].y - 18 } }) : it)));
      stackPart.forEach((x, k) => items.push({ key: 'fsi' + k, kind: 'text', x: sx - 10, y: sy - k * 40 + 23, text: String(k), cls: 'gw-small', anchor: 'end' }));
      const ox = box.x0 + 150, oy = box.y1 + 40;
      if (memo.popping) items.push(...row('pr', 'printed', printed, ox, oy, { ids: (x) => 'fo' + x, cls: () => 'part-a' }));
      if (!memo.popping && d.calls.length) items.push({ key: 'path', kind: 'text', x: box.x0, y: box.y1 + 50, text: 'path: ' + onStack.join(' → '), cls: 'gw-note' });
      const view = GW.view([box, { x0: sx - 30, y0: Math.min(box.y0, sy - (n - 1) * 40), x1: sx + 90, y1: sy + 60 }, { x0: box.x0, y0: oy, x1: ox + n * 48, y1: oy + 50 }]);
      let say = '';
      const pu = d.outer;
      switch (tag) {
        case 'enter': say = 'topo_dfs(' + n + '): a depth-first search that writes each vertex down at the moment it is finished.'; break;
        case 'outer': say = pu < n ? 'Is ' + pu + ' visited yet?' : 'Every vertex has been visited and finished.'; break;
        case 'outer-test': say = d.visited[pu] ? pu + ' was reached already.' : pu + ' has not been reached: start a search from it.'; break;
        case 'start': say = 'Call visit(n, ' + pu + ').'; break;
        case 'mark': say = 'Mark ' + u + ' visited. The path of calls is ' + onStack.join(' → ') + '.'; break;
        case 'scan': say = v < n ? u + ' tries v = ' + v + '.' : 'All of ' + u + '\'s arrows have been followed.'; break;
        case 'check': say = !GW.has(edges, u, v) ? 'No arrow ' + u + ' → ' + v + '.' : !d.visited[v] ? 'Arrow ' + u + ' → ' + v + ', and ' + v + ' is new: follow it before anything else.' : finSet.has(v) ? v + ' is finished already, so it is already in order[] below where ' + u + ' will go. Good: ' + u + ' must come before ' + v + '.' : v + ' is on the path: that would be a cycle.'; break;
        case 'dive': say = 'Call visit(n, ' + v + '). ' + u + ' waits.'; break;
        case 'finish': say = u + ' is finished: everything it points to is already in order[]. order[' + (d.count - 1) + '] = ' + u + '.'; break;
        case 'pop-loop': say = d.count > 0 ? (d.count === total ? 'Every vertex is in order[], finished first at the bottom. Now read it from the top down.' : 'Next from the top.') : 'Done. Printed: ' + printed.join(' ') + '.'; break;
        case 'pop': say = 'Print ' + printed[printed.length - 1] + '. It finished after everything it points to, so it comes before all of them.'; break;
        case 'after': say = 'Topological order: ' + printed.join(', ') + '. Check any arrow: its tail is printed before its head.'; break;
      }
      if (!say && ctx.tick.end) say = me && me.fn === 'visit' ? 'visit(' + u + ') returns.' : 'topo_dfs() is done.';
      return { items, say, view, slow: tag === 'finish' };
    },
    predict: [
      { at: (t) => t.tag === 'start', once: true, ask: 'Which vertex will be the first to finish? Click it.', answer: (ts) => { const k = ts.findIndex((x) => x.tag === 'finish'); return 'gv' + ts[k].data.order[0]; }, explain: () => 'The first vertex the search reaches that has no unvisited vertex to go on to: a dead end.' },
      { at: (t, i, ts) => t.tag === 'pop-loop' && ts[i + 1] && ts[i + 1].tag === 'pop' && t.data.count === Math.max(...ts.map((x) => x.data.count || 0)), once: true, ask: 'Which vertex is printed first?', options: (ts, i, ctx) => [...Array(ctx.input.n).keys()].map(String), answer: (ts, i) => String(ts[i].data.order[ts[i].data.count - 1]), pick: 'option', explain: () => 'The one that finished last: it is on top of order[].' },
    ],
    quiz: [
      { q: 'Why is the reverse finishing order a topological order?', options: ['DFS visits vertices by number', 'For every arrow u → v, v finishes before u', 'Finishing order is random', 'Because the graph is a tree'], answer: 1, why: 'When u is finished, every vertex it points to has already finished (or was finished earlier), so reversing puts u first.' },
      { q: 'What would a back edge (to a vertex still on the path) mean here?', options: ['Nothing', 'A cycle, so no topological order exists', 'A disconnected graph', 'A shorter path'], answer: 1, why: 'The arrow goes from a descendant up to an ancestor: together with the path that is a cycle.' },
      { q: 'Why does topo_dfs loop over all vertices, not just start at 0?', options: ['To print each twice', 'Some vertices may not be reachable from 0', 'It is faster', 'To find cycles'], answer: 1, why: 'Every vertex must be in the order, even those no arrow from 0 reaches.' },
      { q: 'This method and Kahn\'s algorithm on the same graph...', options: ['Always give the same order', 'Can give different, equally correct orders', 'Cannot both be right', 'Only work on trees'], answer: 1, why: 'A graph usually has many topological orders.' },
    ],
    compareWith: 'topo-kahn',
  });

  // ---- cycle in an undirected graph ---------------------------------------------------------------------------
  X.topic({
    id: 'cycle-undirected', family: 'gorder', order: 30, title: 'Cycle (undirected)',
    blurb: 'Depth-first search that remembers where it came from. Meeting a visited vertex that is not the one you came from means the graph goes round in a circle.',
    code: `int visited[MAXV];

/* is there a cycle around u? parent is the vertex u was reached from (-1: none) */
int has_cycle(int n, int u, int parent)
{
    int v;
    visited[u] = 1;                         /*@ mark */
    for (v = 0; v < n; v++)                 /*@ scan */
        if (adj[u][v] && v != parent) {     /*@ test-edge */
            if (visited[v])                 /*@ test-seen */
                return 1;                   /*@ found */
            if (has_cycle(n, v, u))         /*@ dive */
                return 1;                   /*@ pass-up */
        }
    return 0;                               /*@ none */
}

int any_cycle(int n)
{
    int u;
    for (u = 0; u < n; u++)                 /*@ outer */
        if (!visited[u] && has_cycle(n, u, -1))   /*@ start */
            return 1;                       /*@ yes */
    return 0;                               /*@ no */
}`,
    animate: ['any_cycle', 'has_cycle'],
    inputs: undirInputs(UP.house),
    presets: [
      { label: 'House', values: Object.assign({}, UP.house) },
      { label: 'Tree', values: Object.assign({}, UP.tree) },
      { label: 'Two parts', values: { n: 7, graph: '0-1 1-2 3-4 4-5 5-6 6-3', pos: UP.twoPos } },
      { label: 'Forest', values: { n: 6, graph: '0-1 1-2 3-4 3-5', pos: [[-220, -80], [-120, 40], [-220, 150], [120, -80], [40, 80], [210, 80]] } },
    ],
    counters: ['compares'],
    main: (inp) => gMain(inp, '', 'printf("%s\\n", any_cycle(' + inp.n + ') ? "cycle" : "no cycle");', false),
    capture(P) {
      const calls = P.calls(['v', 'u']);
      return { visited: GW.ints(P, 'visited', 10), calls: calls.filter((c) => c.fn === 'has_cycle'), outer: (calls.find((c) => c.fn === 'any_cycle') || { args: {} }).args.u };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, n = inp.n;
      const edges = G.parse(inp.graph);
      const { pos, box } = layout(inp);
      const memo = ctx.memo;
      const me = frameOf(ctx, d.calls, ['found', 'pass-up', 'none']);
      if (memo.at !== ctx.i) {
        memo.at = ctx.i;
        memo.parent = memo.parent || {};
        d.calls.forEach((c) => { if (c.args.parent >= 0 && memo.parent[c.args.u] === undefined) memo.parent[c.args.u] = c.args.parent; });
        if (tag === 'found' && me) {
          // the cycle: the path of calls from v up to u, closed by the edge u–v
          const path = ctx.prev.data.calls.map((c) => c.args.u);
          memo.cycle = path.slice(path.indexOf(me.args.v));
          memo.close = [me.args.u, me.args.v];
        }
      }
      const u = me ? me.args.u : null, v = me && me.args.v !== undefined ? me.args.v : null, par = me ? me.args.parent : null;
      const onStack = d.calls.map((c) => c.args.u);
      const cyc = memo.cycle || [];
      const inCycle = (a, b) => { const i = cyc.indexOf(a), j = cyc.indexOf(b); return i >= 0 && j >= 0 && (Math.abs(i - j) === 1 || (memo.close && ((a === memo.close[0] && b === memo.close[1]) || (b === memo.close[0] && a === memo.close[1])))); };
      const looking = (tag === 'test-edge' || tag === 'test-seen' || tag === 'dive' || tag === 'found') && v !== null && v < n;
      const isParentEdge = looking && tag === 'test-edge' && v === par && GW.has(edges, u, v);
      const onPath = (a, b) => { const i = onStack.indexOf(a), j = onStack.indexOf(b); return i >= 0 && j >= 0 && Math.abs(i - j) === 1; };
      const items = orient(G.picture({
        n, edges, pos,
        vcls: (x) => (cyc.includes(x) ? 'gw-ring hot' : x === u && tag !== 'after' ? 'focus hot' : onStack.includes(x) ? 'part-b' : d.visited[x] ? 'done' : ''),
        ecls: (a, b) => {
          if (inCycle(a, b)) return 'gw-cycle';
          const here = looking && ((a === u && b === v) || (a === v && b === u));
          if (here) return isParentEdge ? 'gw-ignore' : 'hot';
          if (onPath(a, b)) return 'gw-path gw-tree';
          return memo.parent[b] === a || memo.parent[a] === b ? 'gw-tree' : '';
        },
        elabel: (a, b) => (isParentEdge && ((a === u && b === v) || (a === v && b === u)) ? 'came from here' : ''),
      }), memo.parent);
      for (const it of items) if (it.kind === 'arrow') it.cls += ' gw-lab';
      if (looking) items.push({ key: 'cv', kind: 'cursor', at: 'gv' + v, side: 'above', text: 'v', cls: 'c-amber' });
      items.push(...callTower(d.calls, (c) => 'has_cycle(u=' + c.args.u + ', parent=' + c.args.parent + ')', box, n));
      // the answer travelling back up the stack
      if ((tag === 'found' || tag === 'pass-up') && d.calls.length) items.push({ key: 'ret', kind: 'token', x: box.x1 + 352, y: box.y1 - 18 - (d.calls.length - 1) * 40, r: 15, text: '1', cls: 'c-rose' });
      const view = GW.view([box, towerBox(box, n), { x0: box.x1 + 330, y0: box.y1 - 30, x1: box.x1 + 372, y1: box.y1 }]);
      let say = '';
      const pu = d.outer;
      switch (tag) {
        case 'enter': say = 'any_cycle(' + n + '): look for a cycle in every part of the graph.'; break;
        case 'outer': say = pu < n ? 'Vertex ' + pu + (d.visited[pu] ? ' is visited already.' : ' is not visited.') : 'Every part of the graph has been searched.'; break;
        case 'start': say = d.calls.length ? 'Call has_cycle(n, ' + pu + ', -1): a new search, with no parent.' : (d.visited[pu] ? pu + ' was reached by an earlier search: no need to start one.' : 'The search from ' + pu + ' found a cycle.'); break;
        case 'mark': say = 'Mark ' + u + ' visited. It was reached from ' + (par >= 0 ? par : 'nowhere (it starts the search)') + '.'; break;
        case 'scan': say = v < n ? u + ' tries v = ' + v + '.' : 'All of ' + u + '\'s neighbours are done, without finding a cycle.'; break;
        case 'test-edge': say = !GW.has(edges, u, v) ? 'No edge ' + u + '–' + v + '.' : v === par ? v + ' is the parent: ' + u + ' was reached along this very edge. Going back along it is not a cycle.' : 'Edge ' + u + '–' + v + ', not the one ' + u + ' came along.'; break;
        case 'test-seen': say = d.visited[v] ? v + ' is visited already, and it is not the parent. There is another way from ' + v + ' to ' + u + '.' : v + ' is new.'; break;
        case 'found': say = 'return 1: a cycle, ' + cyc.join(' – ') + ' – ' + cyc[0] + '. The red edge ' + u + '–' + v + ' is the one that closes it.'; break;
        case 'dive': say = 'Call has_cycle(n, ' + v + ', ' + u + '): ' + u + ' is the parent of ' + v + '.'; break;
        case 'pass-up': say = 'The call below found a cycle, so this one returns 1 too. The answer climbs back up the stack.'; break;
        case 'none': say = 'has_cycle(' + u + ') returns 0: no cycle below ' + u + '.'; break;
        case 'yes': say = 'any_cycle() returns 1.'; break;
        case 'no': say = 'any_cycle() returns 0: no cycle anywhere. Every component is a tree, so the green edges are all the edges.'; break;
        case 'after': say = cyc.length ? 'The graph has a cycle: ' + cyc.join(' – ') + ' – ' + cyc[0] + '.' : 'No cycle: the graph is a forest.'; break;
      }
      if (!say && ctx.tick.end) say = 'has_cycle(' + u + ') returns.';
      return { items, say, view, slow: tag === 'found' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'test-edge' && (() => { const c = ts[i + 1].data.calls; const f = c[c.length - 1]; return f && f.args.v === f.args.parent; })(), once: true, ask: 'u is about to look at the edge back to its parent. Does that count as a cycle?', options: () => ['Yes', 'No'], answer: () => 'No', pick: 'option', explain: () => 'It is the edge u was reached along. A cycle needs a different way back.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'found', once: true, ask: 'A cycle has just been found. Click the vertex at the far end of the closing edge.', answer: (ts, i) => { const c = ts[i].data.calls; return 'gv' + c[c.length - 1].args.v; }, explain: () => 'v: an ancestor of u, still on the path, reached a second way.' },
    ],
    quiz: [
      { q: 'Why does the code skip v == parent?', options: ['To save time', 'In an undirected graph the edge to the parent is the edge just used: it would look like a cycle of length 2', 'The parent is never visited', 'To avoid recursion'], answer: 1, why: 'adj[u][parent] is the same edge seen from the other end.' },
      { q: 'A connected undirected graph with n vertices has no cycle. How many edges does it have?', options: ['n', 'n - 1', 'n + 1', 'Any number'], answer: 1, why: 'It is a tree, and a tree on n vertices has n - 1 edges.' },
      { q: 'Why does any_cycle() start a search from every unvisited vertex?', options: ['To count vertices', 'The cycle may be in a part that 0 cannot reach', 'Each search only checks one edge', 'It does not need to'], answer: 1, why: 'A disconnected graph can have a cycle in any of its components.' },
      { q: 'Would this parent test work for a directed graph?', options: ['Yes, unchanged', 'No: a visited vertex that is already finished does not make a directed cycle', 'Only for trees', 'Only with a matrix'], answer: 1, why: 'Directed graphs need to know whether the vertex is still on the path: the white/grey/black colouring.' },
    ],
    compareWith: 'cycle-directed',
  });

  // ---- cycle in a directed graph: white, grey, black -------------------------------------------------------
  X.topic({
    id: 'cycle-directed', family: 'gorder', order: 31, title: 'Cycle (directed)',
    blurb: 'Three colours: white not reached, grey on the current path, black finished. An arrow to a grey vertex leads back up the path: a cycle. An arrow to a black one does not.',
    code: `#define WHITE 0   /* not reached yet */
#define GREY  1   /* on the current path */
#define BLACK 2   /* finished: nothing below it leads back */

int colour[MAXV];

int cyclic(int n, int u)
{
    int v;
    colour[u] = GREY;                                /*@ grey */
    for (v = 0; v < n; v++)                          /*@ scan */
        if (adj[u][v]) {                             /*@ test-edge */
            if (colour[v] == GREY)                   /*@ test-grey */
                return 1;                            /*@ back */
            if (colour[v] == WHITE && cyclic(n, v))  /*@ dive */
                return 1;                            /*@ pass-up */
        }
    colour[u] = BLACK;                               /*@ black */
    return 0;                                        /*@ none */
}

int has_cycle(int n)
{
    int u;
    for (u = 0; u < n; u++)                          /*@ outer */
        if (colour[u] == WHITE && cyclic(n, u))      /*@ start */
            return 1;                                /*@ yes */
    return 0;                                        /*@ no */
}`,
    animate: ['has_cycle', 'cyclic'],
    inputs: dirInputs(DP.diamond),
    presets: [
      { label: 'Diamond', values: Object.assign({}, DP.diamond) },
      { label: 'With a cycle', values: Object.assign({}, DP.cyclic) },
      { label: 'Ring', values: Object.assign({}, DP.ring) },
      { label: 'Tangled', values: Object.assign({}, DP.tangled) },
    ],
    counters: ['compares'],
    main: (inp) => gMain(inp, '', 'printf("%s\\n", has_cycle(' + inp.n + ') ? "cycle" : "no cycle");', true),
    capture(P) {
      const calls = P.calls(['v', 'u']);
      return { colour: GW.ints(P, 'colour', 10), calls: calls.filter((c) => c.fn === 'cyclic'), outer: (calls.find((c) => c.fn === 'has_cycle') || { args: {} }).args.u };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, n = inp.n;
      const edges = G.parse(inp.graph);
      const { pos, box } = layout(inp);
      const memo = ctx.memo;
      const me = frameOf(ctx, d.calls, ['back', 'pass-up', 'none']);
      if (memo.at !== ctx.i) {
        memo.at = ctx.i;
        memo.parent = memo.parent || {};
        d.calls.forEach((c, k) => { if (k > 0 && memo.parent[c.args.u] === undefined) memo.parent[c.args.u] = d.calls[k - 1].args.u; });
        memo.blackHits = memo.blackHits || new Set();
        if (tag === 'dive' && me && d.colour[me.args.v] === 2) memo.blackHits.add(me.args.u + '>' + me.args.v);
        if (tag === 'back' && me) {
          const path = ctx.prev.data.calls.map((c) => c.args.u);
          memo.cycle = path.slice(path.indexOf(me.args.v));
        }
      }
      const u = me ? me.args.u : null, v = me && me.args.v !== undefined ? me.args.v : null;
      const col = (x) => d.colour[x] || 0;
      const onStack = d.calls.map((c) => c.args.u);
      const cyc = memo.cycle || [];
      const inCycle = (a, b) => { const i = cyc.indexOf(a), j = cyc.indexOf(b); return i >= 0 && j >= 0 && (j === i + 1 || (i === cyc.length - 1 && j === 0)); };
      const looking = ['test-edge', 'test-grey', 'dive', 'back'].includes(tag) && v !== null && v < n;
      const onPath = (a, b) => { const i = onStack.indexOf(a); return i >= 0 && onStack[i + 1] === b; };
      const items = orient(G.picture({
        n, edges, pos,
        vcls: (x) => (col(x) === 1 ? 'gw-grey' : col(x) === 2 ? 'gw-black' : '') + (cyc.includes(x) ? ' gw-ring' : x === u && tag !== 'after' ? ' focus' : ''),
        ecls: (a, b) => (inCycle(a, b) ? 'gw-cycle' : looking && a === u && b === v ? 'hot' : onPath(a, b) ? 'gw-path' : memo.blackHits.has(a + '>' + b) ? 'gw-cross' : memo.parent[b] === a ? 'gw-tree' : ''),
      }), memo.parent);
      if (looking) items.push({ key: 'cv', kind: 'cursor', at: 'gv' + v, side: 'above', text: 'v', cls: 'c-amber' });
      if (u !== null && tag !== 'after') items.push({ key: 'cu', kind: 'cursor', at: 'gv' + u, side: 'left', text: 'u', cls: 'c-teal' });
      items.push(...callTower(d.calls, (c) => 'cyclic(u=' + c.args.u + ')' + (c.args.v !== undefined && c.args.v < n ? '  v=' + c.args.v : ''), box, n));
      // the colour array, under the graph
      const x0 = box.x0 + 80, y0 = box.y1 + 34;
      const names = ['W', 'G', 'B'];
      items.push(...row('co', 'colour', [...Array(n).keys()], x0, y0, { ids: (x) => 'co' + x, sub: (x) => x, cls: (x) => ['gw-white', 'gw-grey', 'gw-black'][col(x)] }).map((it) => (it.kind === 'cell' ? Object.assign(it, { text: names[col(it.sub)] }) : it)));
      items.push({ key: 'leg', kind: 'text', x: x0 - 80, y: y0 + 84, text: 'W = white, not reached.  G = grey, on the path.  B = black, finished.', cls: 'gw-note' });
      const view = GW.view([box, towerBox(box, n), { x0: x0 - 90, y0, x1: x0 + n * 48, y1: y0 + 90 }]);
      let say = '';
      const pu = d.outer;
      switch (tag) {
        case 'enter': say = 'has_cycle(' + n + '): every vertex starts white.'; break;
        case 'outer': say = pu < n ? 'Vertex ' + pu + ' is ' + ['white', 'grey', 'black'][col(pu)] + '.' : 'Every vertex is black: no cycle anywhere.'; break;
        case 'start': say = d.calls.length ? 'Call cyclic(n, ' + pu + ').' : col(pu) === 2 ? pu + ' is black already: an earlier search finished it.' : 'The search from ' + pu + ' found a cycle.'; break;
        case 'grey': say = u + ' turns grey: it is on the current path, ' + onStack.join(' → ') + '.'; break;
        case 'scan': say = v < n ? u + ' tries v = ' + v + '.' : 'Every arrow out of ' + u + ' has been followed.'; break;
        case 'test-edge': say = GW.has(edges, u, v) ? 'Arrow ' + u + ' → ' + v + ', and ' + v + ' is ' + ['white', 'grey', 'black'][col(v)] + '.' : 'No arrow ' + u + ' → ' + v + '.'; break;
        case 'test-grey': say = col(v) === 1 ? v + ' is grey: it is on the path above ' + u + '. The arrow leads back up the path.' : v + ' is not grey.'; break;
        case 'back': say = 'return 1: the cycle is ' + cyc.join(' → ') + ' → ' + cyc[0] + '.'; break;
        case 'dive': say = col(v) === 2 ? v + ' is black: it was finished and nothing below it leads back. Reaching it again is not a cycle, so skip it.' : d.calls.length > onStack.indexOf(u) + 1 ? 'Call cyclic(n, ' + v + ').' : v + ' was white, its search came back with 0.'; break;
        case 'pass-up': say = 'A cycle was found below, so return 1 here too.'; break;
        case 'black': say = u + ' turns black: no arrow from it leads back to the path. It never needs to be searched again.'; break;
        case 'none': say = 'cyclic(' + u + ') returns 0.'; break;
        case 'yes': say = 'has_cycle() returns 1.'; break;
        case 'no': say = 'has_cycle() returns 0: no cycle.'; break;
        case 'after': say = cyc.length ? 'Cycle: ' + cyc.join(' → ') + ' → ' + cyc[0] + '.' : 'No cycle.' + (memo.blackHits.size ? ' The dotted arrows reached a black vertex a second way: two paths to the same vertex, which is fine in a directed graph.' : ''); break;
      }
      if (!say && ctx.tick.end) say = 'cyclic(' + u + ') returns.';
      return { items, say, view, slow: tag === 'back' || (tag === 'dive' && col(v) === 2) };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'test-edge' && (() => { const c = ts[i + 1].data.calls; const f = c[c.length - 1]; return f && f.args.v < 10 && ts[i + 1].data.colour[f.args.v] === 2; })(), once: true, ask: 'The next arrow leads to a black vertex. Is that a cycle?', options: () => ['Yes', 'No'], answer: () => 'No', pick: 'option', explain: () => 'Black means finished: no path from it leads back to the current path.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'back', once: true, ask: 'A grey vertex has been reached. Click it.', answer: (ts, i) => { const c = ts[i].data.calls; return 'gv' + c[c.length - 1].args.v; }, explain: () => 'It is on the current path: the arrow closes a cycle.' },
    ],
    quiz: [
      { q: 'Why is meeting a black vertex not a cycle?', options: ['Black vertices have no edges', 'It is finished: nothing reachable from it leads to the current path', 'It is a bug', 'It always is a cycle'], answer: 1, why: 'If a path from it led back to a grey vertex, the search would have found that before turning it black.' },
      { q: 'What are the grey vertices at any moment?', options: ['All visited vertices', 'Exactly the vertices on the current path of calls', 'The finished ones', 'The unvisited ones'], answer: 1, why: 'A vertex turns grey when its call starts and black when it returns.' },
      { q: 'Why is a simple visited[] flag not enough for directed graphs?', options: ['It is enough', 'It cannot tell "on the path" from "finished", so a diamond would look like a cycle', 'It uses too much memory', 'It cannot be reset'], answer: 1, why: 'In 0 → 1 → 3, 0 → 2 → 3, vertex 3 is visited when reached from 2, but there is no cycle.' },
      { q: 'A directed graph has no cycle. What else can you then compute?', options: ['A topological order', 'A minimum spanning tree', 'An Euler tour', 'Nothing'], answer: 0, why: 'A directed acyclic graph always has a topological order.' },
    ],
    compareWith: 'cycle-undirected',
  });
})(SEE);
