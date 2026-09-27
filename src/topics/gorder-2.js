// Graphs, order and structure: connected components, strongly connected components (Kosaraju) and
// two-colouring (is the graph bipartite?).
(function (SEE) {
  'use strict';
  const X = SEE.Strux, G = X.GraphKit, GW = X.GWalk;
  const DP = GW.dirPresets, UP = GW.undirPresets;
  const gMain = X.gwMain, layout = X.gwLayout, frameOf = X.gwFrameOf, orient = X.gwOrient, row = X.gwRow;

  /** A shaded box around each group of vertices, labelled; groups: Map(c -> [vertices]) */
  const groupBoxes = (groups, pos, word) => {
    const items = [];
    for (const [c, vs] of groups) {
      if (!vs.length) continue;
      const b = GW.box(vs.map((v) => pos[v]), 40);
      if (b.x1 - b.x0 < 120) { const m = (b.x0 + b.x1) / 2; b.x0 = m - 60; b.x1 = m + 60; }
      items.push({ key: 'grp' + c, kind: 'region', x: b.x0, y: b.y0 - 14, w: b.x1 - b.x0, h: b.y1 - b.y0 + 24, cls: GW.colour(c), text: word + ' ' + c });
    }
    return items;
  };
  const groupsOf = (arr, n) => {
    const m = new Map();
    for (let v = 0; v < n; v++) if (arr[v] !== null && arr[v] >= 0) { if (!m.has(arr[v])) m.set(arr[v], []); m.get(arr[v]).push(v); }
    return m;
  };

  // ---- connected components ------------------------------------------------------------------------------
  X.topic({
    id: 'components', family: 'gorder', order: 40, title: 'Connected components',
    blurb: 'Pick a vertex nobody has reached, and flood everything reachable from it with one colour. Repeat until every vertex has a colour: each colour is one component.',
    code: `int comp[MAXV];   /* the number of v's component; -1: not reached yet */

/* give u, and everything reachable from it, the number c */
void label(int n, int u, int c)
{
    int v;
    comp[u] = c;                            /*@ paint */
    for (v = 0; v < n; v++)                 /*@ scan */
        if (adj[u][v] && comp[v] == -1)     /*@ check */
            label(n, v, c);                 /*@ dive */
}

/* number the connected components; returns how many there are */
int components(int n)
{
    int u, count = 0;
    for (u = 0; u < n; u++)                 /*@ init */
        comp[u] = -1;                       /*@ clear */
    for (u = 0; u < n; u++)                 /*@ outer */
        if (comp[u] == -1)                  /*@ outer-test */
            label(n, u, count++);           /*@ start */
    return count;                           /*@ return */
}`,
    animate: ['components', 'label'],
    inputs: X.gwUndirInputs({ n: 7, graph: '0-1 1-2 2-0 3-4 4-5 5-6', pos: UP.twoPos }),
    presets: [
      { label: 'Two parts', values: { n: 7, graph: '0-1 1-2 2-0 3-4 4-5 5-6', pos: UP.twoPos } },
      { label: 'Three and a loner', values: { n: 8, graph: '0-4 4-6 1-5 5-2 3-7', pos: [[-260, -100], [40, -120], [160, 40], [280, -120], [-160, 20], [20, 40], [-260, 130], [280, 80]] } },
      { label: 'All connected', values: Object.assign({}, UP.house) },
      { label: 'No edges', values: { n: 4, graph: '', pos: [[-150, -80], [150, -80], [-150, 80], [150, 80]] } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => gMain(inp, '', 'printf("%d components\\n", components(' + inp.n + '));', false),
    capture(P) {
      const calls = P.calls(['v', 'u', 'count']);
      const top = calls.find((c) => c.fn === 'components') || { args: {} };
      return { comp: GW.ints(P, 'comp', 10), calls: calls.filter((c) => c.fn === 'label'), outer: top.args.u, count: top.args.count };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, n = inp.n;
      const edges = G.parse(inp.graph);
      const { pos, box } = layout(inp);
      const memo = ctx.memo;
      if (memo.at !== ctx.i) {
        memo.at = ctx.i;
        memo.parent = memo.parent || {};
        d.calls.forEach((c, k) => { if (k > 0 && memo.parent[c.args.u] === undefined) memo.parent[c.args.u] = d.calls[k - 1].args.u; });
        if (d.count !== undefined) memo.count = d.count;
        if (tag === 'outer') memo.started = true;
      }
      const comp = d.comp.slice(0, n);
      const painted = (x) => !!memo.started && comp[x] !== null && comp[x] >= 0;  /* a global starts as 0s: ignore them until cleared */
      const me = frameOf(ctx, d.calls, []);
      const u = me ? me.args.u : null, v = me && me.args.v !== undefined ? me.args.v : null, c = me ? me.args.c : null;
      const checking = (tag === 'check' || tag === 'dive') && v !== null && v < n;
      const items = memo.started ? groupBoxes(groupsOf(comp, n), pos, 'component') : [];
      items.push(...orient(G.picture({
        n, edges, pos,
        vcls: (x) => (painted(x) ? GW.colour(comp[x]) : '') + (x === u && tag !== 'after' ? ' focus' : ''),
        ecls: (a, b) => (checking && ((a === u && b === v) || (a === v && b === u)) ? 'hot' : memo.parent[b] === a || memo.parent[a] === b ? 'gw-tree' : ''),
      }), memo.parent));
      if (checking) items.push({ key: 'cv', kind: 'cursor', at: 'gv' + v, side: 'above', text: 'v', cls: 'c-amber' });
      items.push(...X.gwCallTower(d.calls, (f) => 'label(u=' + f.args.u + ', c=' + f.args.c + ')', box, n));
      const x0 = box.x0 + 80, y0 = box.y1 + 40;
      items.push(...row('cp', 'comp', [...Array(n).keys()], x0, y0, { ids: (x) => 'cp' + x, sub: (x) => x, cls: (x) => (painted(x) ? GW.colour(comp[x]) : '') }).map((it) => (it.kind === 'cell' ? Object.assign(it, { text: comp[it.sub] === null ? '' : comp[it.sub] }) : it)));
      const pu = d.outer;
      const outerOn = (tag === 'outer' || tag === 'outer-test' || tag === 'init' || tag === 'clear') && pu !== undefined && pu < n;
      if (outerOn) items.push({ key: 'cuo', kind: 'cursor', at: 'cp' + pu, side: 'below', text: 'u', cls: 'c-indigo' });
      const view = GW.view([box, X.gwTowerBox(box, n), { x0: x0 - 80, y0, x1: x0 + n * 48, y1: y0 + 80 }]);
      let say = '';
      const count = memo.count || 0;
      switch (tag) {
        case 'enter': say = 'components(' + n + '): no vertex has a component number yet.'; break;
        case 'init': say = pu < n ? 'Clear comp[' + pu + '].' : 'Every comp[] is -1: nobody has been reached.'; break;
        case 'clear': say = 'comp[' + pu + '] = -1.'; break;
        case 'outer': say = pu < n ? 'Next, vertex ' + pu + '.' : 'Every vertex has a number: ' + count + ' component' + (count === 1 ? '' : 's') + '.'; break;
        case 'outer-test': say = painted(pu) ? pu + ' already belongs to component ' + comp[pu] + ': a flood reached it.' : pu + ' has not been reached by any flood: it starts component ' + count + '.'; break;
        case 'start': say = 'Call label(n, ' + u + ', ' + c + '). count goes up to ' + count + '.'; break;
        case 'paint': say = 'comp[' + u + '] = ' + c + ': ' + u + ' joins component ' + c + '.'; break;
        case 'scan': say = v < n ? u + ' tries v = ' + v + '.' : 'All of ' + u + '\'s neighbours are done.'; break;
        case 'check': say = !GW.has(edges, u, v) ? 'No edge ' + u + '–' + v + '.' : painted(v) ? v + ' is already in component ' + comp[v] + '.' : v + ' is a neighbour with no number yet: the flood spreads to it.'; break;
        case 'dive': say = 'Call label(n, ' + v + ', ' + c + '): same colour, one step further.'; break;
        case 'return': say = 'components() returns ' + count + '.'; break;
        case 'after': say = count + ' component' + (count === 1 ? '' : 's') + '. Two vertices are connected exactly when they have the same number, so "is there a path from a to b?" is now just comp[a] == comp[b].'; break;
      }
      if (!say && ctx.tick.end) say = me ? 'label(' + u + ') returns: the flood from ' + u + ' is done.' : 'components() is done.';
      return { items, say, view, slow: tag === 'start' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'start' && ts.slice(0, i).some((x) => x.tag === 'start'), once: true, ask: 'A new component is about to start. Click the vertex it starts from.', answer: (ts, i) => 'gv' + ts[i].data.outer, explain: () => 'The first vertex, in number order, that no flood has reached.' },
      { at: (t) => t.tag === 'enter', once: true, ask: 'How many components will there be?', options: (ts, i, ctx) => [...Array(Math.min(ctx.input.n, 5)).keys()].map((k) => String(k + 1)), answer: (ts) => String(Math.max(...ts.map((x) => x.data.count || 0))), pick: 'option', explain: () => 'One per group of vertices joined by paths.' },
    ],
    quiz: [
      { q: 'After components() has run, how fast is "are a and b connected?"', options: ['O(1): compare comp[a] and comp[b]', 'O(n)', 'O(n²)', 'It needs another search'], answer: 0, why: 'The work was done once; every later question is two array reads.' },
      { q: 'How many times is label() called in total?', options: ['Once', 'Once per vertex', 'Once per edge', 'n²'], answer: 1, why: 'A vertex is labelled when it is first reached, and comp[v] == -1 stops a second call.' },
      { q: 'A graph has n vertices and no edges. How many components?', options: ['0', '1', 'n', 'n - 1'], answer: 2, why: 'Every vertex is alone.' },
      { q: 'Could breadth-first search do the flooding instead?', options: ['No, only DFS works', 'Yes: any search that reaches everything reachable works', 'Only on trees', 'Only with a matrix'], answer: 1, why: 'All that matters is which vertices are reached, not the order.' },
    ],
  });

  // ---- strongly connected components (Kosaraju) ----------------------------------------------------------
  X.topic({
    id: 'scc', family: 'gorder', order: 50, title: 'Strongly connected components',
    blurb: 'Kosaraju: a first depth-first search records finishing order; then, with every arrow turned round, searches started in reverse finishing order each collect exactly one strongly connected component.',
    code: `int visited[MAXV], comp[MAXV];
int order[MAXV], top = 0;    /* vertices by finishing time */

/* pass 1: depth-first, recording each vertex as it finishes */
void fill_order(int n, int u)
{
    int v;
    visited[u] = 1;                          /*@ mark */
    for (v = 0; v < n; v++)                  /*@ scan1 */
        if (adj[u][v] && !visited[v])        /*@ check1 */
            fill_order(n, v);                /*@ dive */
    order[top++] = u;                        /*@ finish */
}

/* pass 2: follow arrows backwards: adj[v][u] is v -> u, so u -> v turned round */
void collect(int n, int u, int c)
{
    int v;
    comp[u] = c;                             /*@ paint */
    for (v = 0; v < n; v++)                  /*@ scan2 */
        if (adj[v][u] && comp[v] == -1)      /*@ check2 */
            collect(n, v, c);                /*@ dive */
}

int scc(int n)
{
    int u, c = 0;
    for (u = 0; u < n; u++)                  /*@ outer1 */
        if (!visited[u])
            fill_order(n, u);                /*@ start1 */
    for (u = 0; u < n; u++)                  /*@ reset-loop */
        comp[u] = -1;                        /*@ reset */
    while (top > 0) {                        /*@ loop2 */
        u = order[--top];                    /*@ pop */
        if (comp[u] == -1)                   /*@ test2 */
            collect(n, u, c++);              /*@ start2 */
    }
    return c;                                /*@ return */
}`,
    animate: ['scc', 'fill_order', 'collect'],
    inputs: X.gwDirInputs(DP.scc),
    presets: [
      { label: 'Three groups', values: Object.assign({}, DP.scc) },
      { label: 'One ring', values: Object.assign({}, DP.ring) },
      { label: 'No cycles', values: Object.assign({}, DP.diamond) },
      { label: 'Two loops', values: { n: 6, graph: '0>1 1>0 1>2 2>3 3>4 4>2 5>4', pos: [[-260, -60], [-130, 40], [10, -60], [140, 60], [200, -110], [330, 0]] } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => gMain(inp, '', 'printf("%d strongly connected components\\n", scc(' + inp.n + '));', true),
    capture(P) {
      const calls = P.calls(['v', 'u', 'c']);
      const top = calls.find((c) => c.fn === 'scc') || { args: {} };
      return { visited: GW.ints(P, 'visited', 10), comp: GW.ints(P, 'comp', 10), order: GW.ints(P, 'order', 10), top: P.val('top'), calls: calls.filter((c) => c.fn !== 'scc' && c.fn !== 'main'), outer: top.args.u, c: top.args.c };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, n = inp.n;
      const edges = G.parse(inp.graph);
      const { pos, box } = layout(inp);
      const memo = ctx.memo;
      if (memo.at !== ctx.i) {
        memo.at = ctx.i;
        memo.parent = memo.parent || {};
        if (tag === 'reset-loop' || tag === 'reset') memo.flip = true;
        if (tag === 'loop2' || tag === 'pop') memo.pass2 = true;
        if (!memo.flip) d.calls.forEach((c, k) => { if (k > 0 && memo.parent[c.args.u] === undefined) memo.parent[c.args.u] = d.calls[k - 1].args.u; });
        memo.total = Math.max(memo.total || 0, d.top || 0);
        if (d.c !== undefined && d.c !== null) memo.c = d.c;
      }
      const flip = !!memo.flip, pass2 = !!memo.pass2;
      const me = frameOf(ctx, d.calls, ['finish']);
      const u = me ? me.args.u : null, v = me && me.args.v !== undefined ? me.args.v : null;
      const comp = d.comp.slice(0, n);
      const painted = (x) => pass2 && comp[x] !== null && comp[x] >= 0;
      const onStack = d.calls.map((c) => c.args.u);
      const finished = new Set(d.order.slice(0, flip ? memo.total : d.top || 0));
      const checking = (tag === 'check1' || tag === 'check2' || tag === 'dive') && v !== null && v < n;
      const pu = d.outer;
      const cur = pass2 && (tag === 'pop' || tag === 'test2') ? pu : u;
      const items = pass2 ? groupBoxes(groupsOf(comp, n), pos, 'SCC') : [];
      const pic = G.picture({
        n, edges, pos, directed: true,
        vcls: (x) => (painted(x) ? GW.colour(comp[x]) : !flip && finished.has(x) ? 'done' : onStack.includes(x) ? 'part-b' : '') + (x === cur && tag !== 'after' ? ' focus' : ''),
        ecls: (a, b) => {
          if (checking && me.fn === 'fill_order' && a === u && b === v) return 'hot';
          if (checking && me.fn === 'collect' && a === v && b === u) return 'hot';
          if (flip) return painted(a) && painted(b) && comp[a] === comp[b] ? 'gw-flip' : 'gw-faint';
          return memo.parent[b] === a ? 'gw-tree' : '';
        },
      });
      // in pass 2 every arrow is drawn turned round: the transpose
      if (flip) for (const it of pic) if (it.kind === 'arrow') { const t = it.from; it.from = it.to; it.to = t; }
      items.push(...pic);
      if (checking) items.push({ key: 'cv', kind: 'cursor', at: 'gv' + v, side: 'above', text: 'v', cls: 'c-amber' });
      // order[]: finished vertices pile up in pass 1 and come off the top in pass 2
      const stack = d.order.slice(0, d.top || 0);
      const sx = box.x1 + 90, sy = box.y1 - 36;
      items.push(...GW.tower('os', stack, { x0: sx, y0: sy, w: 60, h: 36, title: 'order[]', ids: stack.map((x) => 'os' + x), cls: (k) => (k === stack.length - 1 ? 'done gw-top' : 'done') }).map((it) => (it.kind === 'cell' ? Object.assign(it, { enter: 'fly', from: { x: pos[it.text].x - 30, y: pos[it.text].y - 18 }, exit: 'fly', toward: { x: pos[it.text].x - 30, y: pos[it.text].y - 18 } }) : it)));
      items.push({ key: 'phase', kind: 'text', x: box.x0, y: box.y0 - 34, text: flip ? 'pass 2: the arrows turned round, searches in reverse finishing order' : 'pass 1: depth-first search, recording finishing order', cls: 'gw-title' });
      if (d.calls.length) items.push({ key: 'path', kind: 'text', x: box.x0, y: box.y1 + 46, text: (me && me.fn === 'collect' ? 'collect: ' : 'fill_order: ') + onStack.join(' → '), cls: 'gw-note' });
      const view = GW.view([box, { x0: box.x0, y0: box.y0 - 50, x1: box.x1, y1: box.y0 }, { x0: sx - 20, y0: Math.min(box.y0, sy - (n - 1) * 40), x1: sx + 80, y1: sy + 60 }, { x0: box.x0, y0: box.y1, x1: box.x1, y1: box.y1 + 56 }]);
      let say = '';
      const nc = memo.c || 0;
      switch (tag) {
        case 'enter': say = 'scc(' + n + '): a strongly connected component is a group where every vertex can reach every other, following the arrows. Two passes find them.'; break;
        case 'outer1': say = pu < n ? (d.visited[pu] ? pu + ' is visited already.' : pu + ' is not visited: start a search there.') : 'Pass 1 is over. order[] holds every vertex, the last to finish on top.'; break;
        case 'start1': say = 'Call fill_order(n, ' + pu + ').'; break;
        case 'mark': say = 'Mark ' + u + ' visited.'; break;
        case 'scan1': case 'scan2': say = v < n ? u + ' tries v = ' + v + '.' : 'Every arrow ' + (tag === 'scan2' ? 'into ' : 'out of ') + u + ' has been tried.'; break;
        case 'check1': say = !GW.has(edges, u, v) ? 'No arrow ' + u + ' → ' + v + '.' : d.visited[v] ? v + ' is visited already.' : 'Arrow ' + u + ' → ' + v + ' to a new vertex: go deeper.'; break;
        case 'dive': say = me && me.fn === 'collect' ? 'Call collect(n, ' + v + ', ' + me.args.c + ').' : 'Call fill_order(n, ' + v + ').'; break;
        case 'finish': say = u + ' is finished: order[' + (d.top - 1) + '] = ' + u + '.'; break;
        case 'reset-loop': say = pu < n ? 'Clear comp[' + pu + '].' : 'Now turn every arrow round. The groups that can reach each other both ways stay the same; the arrows between groups now point the other way.'; break;
        case 'reset': say = 'comp[' + pu + '] = -1.'; break;
        case 'loop2': say = d.top > 0 ? 'order[] still holds ' + stack.join(', ') + '.' : 'order[] is empty: every vertex has a component.'; break;
        case 'pop': say = 'Take the top of order[]: u = ' + pu + ', the latest to finish.'; break;
        case 'test2': say = painted(pu) ? pu + ' already belongs to SCC ' + comp[pu] + '.' : pu + ' has no component yet: start SCC ' + nc + ' from it.'; break;
        case 'start2': say = 'Call collect(n, ' + u + ', ' + me.args.c + '). It follows the turned-round arrows.'; break;
        case 'paint': say = 'comp[' + u + '] = ' + me.args.c + '.'; break;
        case 'check2': say = !GW.has(edges, v, u) ? 'No arrow ' + v + ' → ' + u + ' in the graph, so none ' + u + ' → ' + v + ' turned round.' : painted(v) ? v + ' already has a component.' : 'The arrow ' + v + ' → ' + u + ' turned round leads from ' + u + ' to ' + v + ': ' + v + ' joins.'; break;
        case 'return': say = 'scc() returns ' + nc + '.'; break;
        case 'after': say = nc + ' strongly connected component' + (nc === 1 ? '' : 's') + '. Inside a box every vertex reaches every other; between boxes the arrows only go one way.'; break;
      }
      if (!say && ctx.tick.end) say = me ? me.fn + '(' + u + ') returns.' : 'scc() is done.';
      return { items, say, view, slow: (tag === 'reset-loop' && pu === 0) || tag === 'start2' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'pop' && ts.slice(0, i).every((x) => x.tag !== 'pop'), once: true, ask: 'Pass 2 starts with the top of order[]. Click that vertex.', answer: (ts, i) => 'gv' + ts[i].data.order[ts[i].data.top - 1], explain: () => 'The vertex that finished last in pass 1.' },
      { at: (t) => t.tag === 'enter', once: true, ask: 'How many strongly connected components will there be?', options: (ts, i, ctx) => [...Array(Math.min(ctx.input.n, 6)).keys()].map((k) => String(k + 1)), answer: (ts) => String(Math.max(...ts.map((x) => x.data.c || 0))), pick: 'option', explain: () => 'Each group where you can get from any vertex to any other and back.' },
    ],
    quiz: [
      { q: 'Why does pass 2 use the transposed graph (arrows turned round)?', options: ['It is faster', 'So a search cannot leak from one component into another one downstream', 'To find cycles', 'It does not matter'], answer: 1, why: 'Turning the arrows round keeps each component the same but blocks the way out to the components that were reachable from it.' },
      { q: 'Why are the pass-2 searches started in reverse finishing order?', options: ['Any order works', 'The vertex finishing last lies in a component that no other component reaches', 'To print them sorted', 'To save memory'], answer: 1, why: 'Starting there, the turned-round arrows lead only into its own component.' },
      { q: 'A directed graph with no cycles has how many strongly connected components?', options: ['1', 'n', '0', 'n / 2'], answer: 1, why: 'Without cycles no two vertices reach each other, so every vertex is alone.' },
      { q: 'How long does Kosaraju take with adjacency lists?', options: ['O(n + m)', 'O(n · m)', 'O(n²)', 'O(m log n)'], answer: 0, why: 'Two depth-first searches, each linear. With this matrix version it is O(n²).' },
    ],
  });

  // ---- two-colouring: is the graph bipartite? -------------------------------------------------------------
  X.topic({
    id: 'bipartite', family: 'gorder', order: 60, title: 'Bipartite check',
    blurb: 'Breadth-first search that paints each vertex the opposite colour of the one that found it. The vertices slide into two columns; an edge inside one column means an odd cycle, and no two-colouring exists.',
    code: `int side[MAXV];   /* -1: no colour yet; otherwise 0 or 1 */

/* colour the part of the graph around s; 0 if two neighbours clash */
int two_colour(int n, int s)
{
    int queue[MAXV];
    int front = 0, rear = 0;
    int u, v;
    side[s] = 0;                              /*@ seed */
    queue[rear++] = s;                        /*@ enqueue-start */
    while (front < rear) {                    /*@ loop */
        u = queue[front++];                   /*@ take */
        for (v = 0; v < n; v++)               /*@ scan */
            if (adj[u][v]) {                  /*@ test-edge */
                if (side[v] == -1) {          /*@ test-new */
                    side[v] = 1 - side[u];    /*@ colour */
                    queue[rear++] = v;        /*@ enqueue */
                } else if (side[v] == side[u])   /*@ test-clash */
                    return 0;                 /*@ clash */
            }
    }
    return 1;                                 /*@ ok */
}

int is_bipartite(int n)
{
    int u;
    for (u = 0; u < n; u++)                   /*@ init */
        side[u] = -1;                         /*@ clear */
    for (u = 0; u < n; u++)                   /*@ outer */
        if (side[u] == -1 && !two_colour(n, u))   /*@ start */
            return 0;                         /*@ no */
    return 1;                                 /*@ yes */
}`,
    animate: ['is_bipartite', 'two_colour'],
    inputs: X.gwUndirInputs(UP.house),
    presets: [
      { label: 'House', values: Object.assign({}, UP.house) },
      { label: 'Triangle', values: { n: 5, graph: '0-1 1-2 2-3 3-1 3-4', pos: [[-240, 0], [-80, -100], [90, -100], [10, 70], [190, 110]] } },
      { label: 'Tree', values: Object.assign({}, UP.tree) },
      { label: 'Even ring', values: { n: 6, graph: '0-1 1-2 2-3 3-4 4-5 5-0', pos: null } },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => gMain(inp, '', 'printf("%s\\n", is_bipartite(' + inp.n + ') ? "bipartite" : "not bipartite");', false),
    capture(P) {
      const s = (k) => (P.frames[0] && P.frames[0].name === 'two_colour' && P.isSet(k, 0) ? P.val(k, 0) : null);
      const calls = P.calls(['u']);
      const outer = calls.find((c) => c.fn === 'is_bipartite');
      const inner = P.frames[0] && P.frames[0].name === 'two_colour';
      return { side: GW.ints(P, 'side', 10), queue: inner ? GW.ints(P, 'queue', 10, 0) : null, front: s('front'), rear: s('rear'), u: s('u'), v: s('v'), outer: outer ? outer.args.u : null, inner };
    },
    scene(ctx) {
      const tag = ctx.tick.tag, inp = ctx.input, n = inp.n;
      const memo = ctx.memo;
      // a return line is recorded after two_colour has gone: keep its last queue and u, v
      if (ctx.tick.data.inner) memo.last = ctx.tick.data;
      const d = Object.assign({}, ctx.tick.data);
      if (!d.inner && memo.last && (tag === 'clash' || tag === 'ok')) for (const k of ['queue', 'front', 'rear', 'u', 'v']) d[k] = memo.last[k];
      const edges = G.parse(inp.graph);
      const orig = G.positions(n, inp.pos);
      const ob = GW.box(orig, 0);
      const cx = (ob.x0 + ob.x1) / 2, cy = (ob.y0 + ob.y1) / 2;
      // uncoloured vertices stay in the middle (a little smaller); coloured ones slide to their side's column
      const mid = orig.map((p) => ({ x: (p.x - cx) * 0.62, y: (p.y - cy) * 0.62 }));
      const half = Math.max(...mid.map((p) => Math.abs(p.x))) + 170;
      const top = Math.min(...mid.map((p) => p.y)) - 10;
      if (memo.at !== ctx.i) {
        memo.at = ctx.i;
        memo.slot = memo.slot || {};
        memo.count = memo.count || [0, 0];
        // side[] is a global, so it starts as all 0s: colours count only once the clearing loop is over
        if (tag === 'outer') memo.started = true;
        if (memo.started) for (let x = 0; x < n; x++) if (d.side[x] === 0 || d.side[x] === 1) { if (memo.slot[x] === undefined) memo.slot[x] = memo.count[d.side[x]]++; }
        if (tag === 'clash') memo.clash = [d.u, d.v];
      }
      const rows = Math.max(memo.count[0], memo.count[1], 1);
      const gap = Math.min(80, Math.max(56, (Math.max(...mid.map((p) => p.y)) - top + 40) / Math.max(1, Math.ceil(n / 2))));
      const col = (x) => (memo.started && (d.side[x] === 0 || d.side[x] === 1) ? d.side[x] : -1);
      const pos = mid.map((p, x) => (col(x) < 0 ? p : { x: col(x) === 0 ? -half : half, y: top + memo.slot[x] * gap }));
      const box = GW.box(pos.concat([{ x: -half, y: top }, { x: half, y: top + Math.max(rows, Math.ceil(n / 2)) * gap }]), 30);
      const q = d.queue && d.front !== null ? d.queue.slice(d.front, d.rear) : [];
      const clash = memo.clash;
      const cur = d.u !== null && d.front ? d.u : null;
      const looking = ['test-edge', 'test-new', 'colour', 'enqueue', 'test-clash', 'clash'].includes(tag) && cur !== null && d.v !== null && d.v < n;
      const items = [
        { key: 'h0', kind: 'text', x: -half, y: top - 50, text: 'side 0', cls: 'gw-title', anchor: 'middle' },
        { key: 'h1', kind: 'text', x: half, y: top - 50, text: 'side 1', cls: 'gw-title', anchor: 'middle' },
        { key: 'r0', kind: 'region', x: -half - 44, y: top - 40, w: 88, h: Math.max(rows, Math.ceil(n / 2)) * gap + 20, cls: 'gw-c0' },
        { key: 'r1', kind: 'region', x: half - 44, y: top - 40, w: 88, h: Math.max(rows, Math.ceil(n / 2)) * gap + 20, cls: 'gw-c1' },
      ];
      items.push(...G.picture({
        n, edges, pos,
        vcls: (x) => (col(x) >= 0 ? GW.colour(col(x)) : '') + (clash && clash.includes(x) ? ' gw-ring' : x === cur && tag !== 'after' ? ' focus' : ''),
        ecls: (a, b) => {
          if (clash && ((a === clash[0] && b === clash[1]) || (a === clash[1] && b === clash[0]))) return 'gw-cycle';
          if (looking && ((a === cur && b === d.v) || (a === d.v && b === cur))) return 'hot';
          if (col(a) >= 0 && col(b) >= 0) return col(a) !== col(b) ? 'gw-cross2' : 'gw-cycle';
          return '';
        },
      }));
      // an edge inside one column would be hidden behind the column: bow it out
      for (const it of items) if (it.kind === 'arrow' && /gw-cycle/.test(it.cls)) { const a = +it.from.key.slice(2), b = +it.to.key.slice(2); it.bend = (col(a) === 0 ? 1 : -1) * (memo.slot[a] < memo.slot[b] ? 1 : -1) * 60; }
      if (looking) items.push({ key: 'cv', kind: 'cursor', at: 'gv' + d.v, side: 'above', text: 'v', cls: 'c-amber' });
      const x0 = box.x0 + 70, y0 = box.y1 + 30;
      items.push(...row('qu', 'queue', q, x0, y0, { ids: (v) => 'q' + v, empty: 'empty', cls: (v) => GW.colour(col(v)) }));
      items.push(...row('sd', 'side', [...Array(n).keys()], x0, y0 + 62, { ids: (x) => 'sd' + x, sub: (x) => x, cls: (x) => GW.colour(col(x)) }).map((it) => (it.kind === 'cell' ? Object.assign(it, { text: d.side[it.sub] === null ? '' : d.side[it.sub] }) : it)));
      const view = GW.view([box, { x0: box.x0, y0: top - 70, x1: box.x1, y1: top }, { x0: x0 - 80, y0, x1: x0 + n * 48, y1: y0 + 120 }]);
      let say = '';
      const pu = d.outer;
      const nm = (x) => (col(x) === 0 ? 'side 0' : 'side 1');
      switch (tag) {
        case 'enter': say = 'is_bipartite(' + n + '): can the vertices be split into two sides so that every edge goes across?'; break;
        case 'init': say = pu < n ? 'Clear side[' + pu + '].' : 'No vertex has a side yet.'; break;
        case 'clear': say = 'side[' + pu + '] = -1.'; break;
        case 'outer': say = pu < n ? 'Vertex ' + pu + (col(pu) >= 0 ? ' is on ' + nm(pu) + ' already.' : ' has no side yet.') : 'Every part of the graph has been coloured without a clash.'; break;
        case 'start': say = d.inner ? 'Call two_colour(n, ' + pu + ').' : col(pu) >= 0 ? pu + ' was coloured already.' : 'two_colour found a clash.'; break;
        case 'seed': say = d.inner ? 'The start goes on side 0. The choice is free: swapping the two sides changes nothing.' : ''; break;
        case 'enqueue-start': say = 'It goes into the queue.'; break;
        case 'loop': say = q.length ? 'The queue holds ' + q.join(', ') + '.' : 'The queue is empty: this part of the graph is coloured.'; break;
        case 'take': say = 'Take u = ' + d.u + ', on ' + nm(d.u) + '. Its neighbours must all be on the other side.'; break;
        case 'scan': say = d.v < n ? d.u + ' tries v = ' + d.v + '.' : 'All of ' + d.u + '\'s neighbours are done.'; break;
        case 'test-edge': say = GW.has(edges, d.u, d.v) ? 'Edge ' + d.u + '–' + d.v + '.' : 'No edge ' + d.u + '–' + d.v + '.'; break;
        case 'test-new': say = col(d.v) < 0 ? d.v + ' has no side yet.' : d.v + ' is on ' + nm(d.v) + ' already.'; break;
        case 'colour': say = 'side[' + d.v + '] = 1 - side[' + d.u + '] = ' + d.side[d.v] + ': ' + d.v + ' slides across to ' + nm(d.v) + '.'; break;
        case 'enqueue': say = d.v + ' joins the queue.'; break;
        case 'test-clash': say = col(d.v) === col(d.u) ? d.u + ' and ' + d.v + ' are both on ' + nm(d.u) + ', and an edge joins them.' : d.v + ' is on the other side: the edge goes across, as it should.'; break;
        case 'clash': say = 'return 0: the red edge ' + clash[0] + '–' + clash[1] + ' lies inside one side. Following the colours round, it closes a cycle of odd length, and an odd cycle can never be two-coloured.'; break;
        case 'ok': say = 'return 1: this part of the graph has two clean sides.'; break;
        case 'no': say = 'is_bipartite() returns 0.'; break;
        case 'yes': say = 'is_bipartite() returns 1.'; break;
        case 'after': say = clash ? 'Not bipartite: the graph has an odd cycle.' : 'Bipartite: every edge goes from side 0 to side 1, so the graph has no odd cycle.'; break;
      }
      if (!say && ctx.tick.end) say = 'two_colour() returns.';
      return { items, say, view, slow: tag === 'colour' || tag === 'clash' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'colour' && i > 8, once: true, ask: (t) => 'Which side will ' + t.data.v + ' go to?', options: () => ['side 0', 'side 1'], answer: (ts, i) => 'side ' + (1 - ts[i].data.side[ts[i].data.u]), pick: 'option', explain: (ts, i) => 'The opposite of ' + ts[i].data.u + ', which found it.' },
      { at: (t) => t.tag === 'enter', once: true, ask: 'Is this graph bipartite?', options: () => ['Yes', 'No'], answer: (ts, i, ctx) => (ts.some((x) => x.tag === 'clash') ? 'No' : 'Yes'), pick: 'option', explain: (ts) => (ts.some((x) => x.tag === 'clash') ? 'It has a cycle of odd length.' : 'All its cycles have even length.') },
    ],
    quiz: [
      { q: 'Which graphs are bipartite?', options: ['Those with no cycles at all', 'Exactly those with no cycle of odd length', 'Only trees', 'Those with an even number of vertices'], answer: 1, why: 'Going round a cycle the colours alternate, so you return to the start on the right colour only if the length is even.' },
      { q: 'Are all trees bipartite?', options: ['Yes', 'No', 'Only binary trees', 'Only if n is even'], answer: 0, why: 'A tree has no cycles at all: colour by even or odd depth.' },
      { q: 'Why does the check loop over all vertices in is_bipartite()?', options: ['To count them', 'Each component must be coloured separately', 'To find the largest', 'It does not need to'], answer: 1, why: 'A search from one vertex never reaches another component, and an odd cycle could be there.' },
      { q: 'Could depth-first search do the colouring instead of BFS?', options: ['No', 'Yes: each vertex just takes the opposite colour of the vertex that reached it', 'Only on trees', 'Only for even n'], answer: 1, why: 'Any search works; the order does not change whether a clash exists.' },
    ],
  });
})(SEE);
