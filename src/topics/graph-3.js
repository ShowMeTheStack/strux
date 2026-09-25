// Graphs: depth-first search, recursive and with an explicit stack.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, G = X.GraphKit, GW = X.GWalk;

  const P = X.graphPresets;
  const fwd = { n: 6, graph: '0>1 0>2 1>3 3>0 2>4 4>5 5>2', pos: [[0, -150], [-140, -40], [140, -40], [-140, 120], [140, 120], [0, 200]] };
  const startIn = { id: 's', kind: 'int', label: 'Start at', def: 0, lo: 0, hi: 9 };
  const startCheck = (inp) => (inp.s >= inp.n ? 'Start at: a vertex from 0 to ' + (inp.n - 1) : null);
  const isDir = (edges) => edges.some((e) => e[3]);

  // ---- depth-first search, recursive ---------------------------------------------------------------------
  const FRAME_H = 38;
  X.topic({
    id: 'dfs', family: 'graph', order: 20, title: 'Depth-first search',
    blurb: 'Go as deep as you can, then back up one step and try the next way. The recursion keeps the path; discovery and finish times nest like brackets.',
    code: `int visited[MAXV];
int disc[MAXV], fin[MAXV];   /* when each vertex was discovered and finished */
int timer = 0;

/* visit u, then everything reachable from u that is not visited yet */
void dfs(int n, int u)
{
    int v;
    visited[u] = 1;                     /*@ mark */
    disc[u] = ++timer;                  /*@ disc */
    for (v = 0; v < n; v++) {           /*@ scan */
        if (adj[u][v] && !visited[v])   /*@ check */
            dfs(n, v);                  /*@ dive */
    }
    fin[u] = ++timer;                   /*@ finish */
}`,
    animate: ['dfs'],
    inputs: X.graphInputs([startIn]),
    check: startCheck,
    presets: [
      { label: 'House', values: Object.assign({ s: 0 }, P.house) },
      { label: 'Tree', values: Object.assign({ s: 0 }, P.tree) },
      { label: 'Ring', values: Object.assign({ s: 0 }, P.ring) },
      { label: 'Two parts', values: Object.assign({ s: 0 }, P.two) },
      { label: 'Directed', values: Object.assign({ s: 0 }, fwd) },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => X.graphMain(inp, 'dfs(' + inp.n + ', ' + inp.s + ');'),
    capture(P) {
      const calls = P.calls(['v']).filter((c) => c.fn === 'dfs');
      return { visited: GW.ints(P, 'visited', 10), disc: GW.ints(P, 'disc', 10), fin: GW.ints(P, 'fin', 10), timer: P.val('timer'), calls };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input, n = inp.n;
      const edges = G.parse(inp.graph), dir = isDir(edges);
      const pos = G.positions(n, inp.pos), box = GW.box(pos, 30);
      const memo = ctx.memo;
      memo.parent = memo.parent || {};
      memo.kind = memo.kind || {};
      const calls = d.calls;
      const top = calls.length ? calls[calls.length - 1] : null;
      calls.forEach((c, k) => { if (k > 0 && memo.parent[c.args.u] === undefined) memo.parent[c.args.u] = calls[k - 1].args.u; });
      // the frame whose line this is: on 'dive' the new frame is already on the stack
      const me = tag === 'dive' && calls.length > 1 ? calls[calls.length - 2] : top;
      const u = me ? me.args.u : null, v = me && me.args.v !== undefined ? me.args.v : null;
      const onStack = new Set(calls.map((c) => c.args.u));
      const fin = (x) => d.fin[x] !== null && d.fin[x] !== undefined && d.fin[x] > 0 && d.visited[x];
      const ek = (a, b) => (dir ? a + '>' + b : Math.min(a, b) + '-' + Math.max(a, b));
      const hasE = (a, b) => GW.has(edges, a, b);
      if (tag === 'check' && v !== null && v < n && hasE(u, v) && d.visited[v] && memo.kind[ek(u, v)] === undefined && memo.parent[v] !== u) {
        if (!dir && v === memo.parent[u]) memo.kindNow = 'parent';
        else memo.kind[ek(u, v)] = onStack.has(v) ? 'back' : 'cross';
      }
      const isTree = (a, b) => memo.parent[b] === a || (!dir && memo.parent[a] === b);
      const checking = (tag === 'check' || tag === 'dive') && v !== null && v < n;
      const items = G.picture({
        n, edges, pos,
        vcls: (x) => 'gw-sub ' + (x === u && tag !== 'after' ? 'focus hot' : fin(x) ? 'done' : onStack.has(x) || d.visited[x] ? 'part-b' : ''),
        vsub: (x) => (d.visited[x] ? d.disc[x] + ' / ' + (fin(x) ? d.fin[x] : '–') : ''),
        ecls: (a, b) => {
          if (checking && ((a === u && b === v) || (!dir && b === u && a === v))) return 'hot';
          if (isTree(a, b)) return 'gw-tree';
          const k = memo.kind[ek(a, b)];
          return k === 'back' ? 'gw-back' : k === 'cross' ? 'gw-cross' : '';
        },
      });
      // tree edges point the way the search went
      for (const it of items) {
        if (it.kind !== 'arrow' || !/gw-tree/.test(it.cls)) continue;
        const [a, b] = [+it.from.key.slice(2), +it.to.key.slice(2)];
        if (memo.parent[a] === b) { it.from = { key: 'gv' + b }; it.to = { key: 'gv' + a }; }
        it.noHead = false;
      }
      if (checking) items.push({ key: 'cv', kind: 'cursor', at: 'gv' + v, side: 'above', text: 'v', cls: 'c-amber' });
      if (u !== null && tag !== 'after') items.push({ key: 'cu', kind: 'cursor', at: 'gv' + u, side: 'left', text: 'u', cls: 'c-teal' });
      // the call stack, beside the graph: one frame per active call, the newest on top
      const sx = box.x1 + 80, sy = box.y1 - FRAME_H;
      items.push(...GW.tower('st', calls, {
        x0: sx, y0: sy, w: 150, h: FRAME_H, title: 'call stack', empty: 'empty',
        ids: calls.map((c) => 'fr' + c.args.u),
        text: (k, c) => 'dfs(u=' + c.args.u + ')' + (c.args.v !== undefined && c.args.v < n ? '  v=' + c.args.v : ''),
        cls: (k) => 'gw-frame' + (k === calls.length - 1 ? ' gw-top' : ''),
      }));
      // the time line: each vertex is a bar from its discovery to its finish
      const T = 2 * n, tw = Math.min(40, 620 / T), tx = box.x0 + 10, ty = box.y1 + 50;
      items.push({ key: 'tlT', kind: 'text', x: tx - 10, y: ty - 4, text: 'time', cls: 'gw-small', anchor: 'end' });
      items.push({ key: 'tlA', kind: 'line', x1: tx, y1: ty, x2: tx + T * tw, y2: ty, cls: 'gw-axis' });
      for (let t = 1; t <= T; t += (T > 12 ? 2 : 1)) items.push({ key: 'tlN' + t, kind: 'text', x: tx + (t - 0.5) * tw, y: ty - 6, text: String(t), cls: 'gw-small', anchor: 'middle' });
      const depthOf = (x) => { let k = 0, p = x; while (memo.parent[p] !== undefined && k < 12) { p = memo.parent[p]; k++; } return k; };
      for (let x = 0; x < n; x++) {
        if (!d.visited[x] || !d.disc[x]) continue;
        const a = d.disc[x], b = fin(x) ? d.fin[x] : (d.timer || a) + 0.5;
        const y = ty + 20 + depthOf(x) * 22;
        items.push({ key: 'tl' + x, kind: 'line', x1: tx + (a - 0.5) * tw, y1: y, x2: tx + (b - 0.5) * tw, y2: y, cls: 'gw-span' + (fin(x) ? '' : ' open') });
        items.push({ key: 'tlv' + x, kind: 'text', x: tx + (a - 0.5) * tw - 8, y: y + 4, text: String(x), cls: 'gw-small', anchor: 'end' });
      }
      const view = GW.view([box, { x0: sx - 10, y0: Math.min(box.y0, sy - (n - 1) * (FRAME_H + 4)), x1: sx + 160, y1: sy + FRAME_H + 30 }, { x0: tx - 40, y0: ty - 20, x1: tx + T * tw + 10, y1: ty + 20 + Math.min(n, 7) * 22 }]);
      let say = '';
      const kindNow = memo.kindNow; memo.kindNow = null;
      switch (tag) {
        case 'enter': say = 'dfs(' + n + ', ' + inp.s + '): one call for the start. Each call will get its own frame on the stack, with its own u and v.'; break;
        case 'mark': say = 'Mark ' + u + ' visited, so no other path will start a second call for it.'; break;
        case 'disc': say = u + ' is discovered at time ' + d.disc[u] + '.' + (calls.length > 1 ? ' The calls waiting below it are the path from ' + inp.s + ' down to here: ' + calls.map((c) => c.args.u).join(' → ') + '.' : ''); break;
        case 'scan': say = v < n ? 'u = ' + u + ' tries v = ' + v + '.' : 'Every neighbour of ' + u + ' has been tried.'; break;
        case 'check': {
          if (!hasE(u, v)) say = 'No edge from ' + u + ' to ' + v + '.';
          else if (!d.visited[v]) say = v + ' is a neighbour nobody has visited: go deeper, at once, before trying ' + u + '\'s other neighbours.';
          else if (kindNow === 'parent' || (!dir && v === memo.parent[u])) say = v + ' is where ' + u + ' was reached from: the same edge, going back. Skip it.';
          else if (memo.parent[v] === u) say = v + ' was discovered from ' + u + ' already, and is finished: skip it.';
          else if (onStack.has(v)) say = v + ' is visited and still on the stack, an ancestor of ' + u + '. ' + u + '–' + v + ' is a back edge (dashed): it closes a cycle.';
          else say = v + ' is visited and already finished. Skip it.';
          break;
        }
        case 'dive': say = 'Call dfs(n, ' + v + '). dfs(u=' + u + ') stops here and waits, with v = ' + v + ' saved in its frame, until ' + v + ' is finished.'; break;
        case 'finish': say = u + ' is finished at time ' + d.fin[u] + ': everything reachable from it has been visited. Its interval ' + d.disc[u] + '–' + d.fin[u] + ' holds the intervals of everything discovered below it.'; break;
        case 'after': { const k = d.visited.slice(0, n).filter((x) => x).length; say = 'Done: ' + k + ' vertices reached, times 1 to ' + 2 * k + '. Green arrows are the DFS tree; dashed edges are back edges. Any two intervals on the time line are either nested or apart, never overlapping.'; break; }
      }
      if (!say && ctx.tick.end) say = 'dfs(u=' + u + ') returns' + (calls.length > 1 ? ' to dfs(u=' + calls[calls.length - 2].args.u + '), which carries on from v = ' + calls[calls.length - 2].args.v + '.' : ' to main.');
      return { items, say, view, slow: tag === 'finish' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'finish' && ts.slice(i + 1).some((x) => x.tag === 'mark'), once: true, ask: (t) => { const c = t.data.calls; return c[c.length - 1].args.u + ' is finished. Which vertex will be discovered next? Click it.'; }, answer: (ts, i) => { const j = ts.findIndex((x, k) => k > i && x.tag === 'mark'); const c = ts[j].data.calls; return 'gv' + c[c.length - 1].args.u; }, explain: () => 'The search backs up to the nearest call that still has an unvisited neighbour, and takes the smallest one.' },
      { at: (t) => t.tag === 'enter', once: true, ask: 'What will the finish time of the start vertex be?', options: (ts, i, ctx) => { const k = ts[ts.length - 1].data.timer / 2, n = ctx.input.n; return [...new Set([k, 2 * k - 1, 2 * k, 2 * n + 1])].sort((a, b) => a - b).map(String); }, answer: (ts, i) => { const last = ts[ts.length - 1].data; return String(last.timer); }, pick: 'option', explain: () => 'Each reached vertex uses two ticks of the clock, one when discovered and one when finished, and the start is the last to finish.' },
    ],
    quiz: [
      { q: 'Vertex a has times 2/9 and vertex b has times 4/7. What does that tell you?', options: ['b was discovered from inside a\'s call: b is a descendant of a', 'a and b are in different components', 'There is a back edge between them', 'Nothing'], answer: 0, why: 'b\'s interval sits inside a\'s, so b was discovered and finished while a was still on the stack.' },
      { q: 'In an undirected graph, DFS meets an edge to a visited vertex that is still on the stack and is not the parent. This means...', options: ['The graph is disconnected', 'There is a cycle', 'The graph is a tree', 'The search must restart'], answer: 1, why: 'The tree path from that ancestor down to u, plus this edge, closes a cycle.' },
      { q: 'How deep can the call stack get on n vertices?', options: ['2', 'log n', 'n', 'n²'], answer: 2, why: 'On a path graph every vertex is a call waiting for the next one: n frames.' },
      { q: 'How long does this DFS take with an adjacency matrix?', options: ['O(n)', 'O(n + m)', 'O(n²)', 'O(m log n)'], answer: 2, why: 'Each vertex is called once, and each call scans a whole row of n entries. With adjacency lists it would be O(n + m).' },
      { q: 'DFS and BFS from the same start visit...', options: ['The same set of vertices, usually in a different order', 'Different sets of vertices', 'The same vertices in the same order', 'Only DFS reaches every vertex'], answer: 0, why: 'Both reach exactly the vertices connected to the start; the order differs.' },
    ],
    compareWith: 'bfs',
  });

  // ---- depth-first search with an explicit stack ---------------------------------------------------------------
  X.topic({
    id: 'dfs-iter', family: 'graph', order: 21, title: 'Depth-first search with a stack',
    blurb: 'The same idea without recursion: a stack of vertices still to look at. A vertex can be pushed more than once; the old copies are skipped when they come off.',
    code: `/* depth-first from s, with a stack of vertices to look at */
void dfs_iter(int n, int s)
{
    int visited[MAXV] = { 0 };
    int stack[MAXV * MAXV];
    int top = 0;
    int u, v;
    stack[top++] = s;                     /*@ push-start */
    while (top > 0) {                     /*@ loop */
        u = stack[--top];                 /*@ pop */
        if (visited[u])                   /*@ test-seen */
            continue;                     /*@ skip */
        visited[u] = 1;                   /*@ visit */
        printf("visit %d\\n", u);
        for (v = n - 1; v >= 0; v--)      /*@ scan */
            if (adj[u][v] && !visited[v]) /*@ check */
                stack[top++] = v;         /*@ push */
    }
}`,
    animate: ['dfs_iter'],
    inputs: X.graphInputs([startIn]),
    check: startCheck,
    presets: [
      { label: 'House', values: Object.assign({ s: 0 }, P.house) },
      { label: 'Dense', values: Object.assign({ s: 0 }, P.dense) },
      { label: 'Tree', values: Object.assign({ s: 0 }, P.tree) },
      { label: 'Two parts', values: Object.assign({ s: 0 }, P.two) },
    ],
    counters: ['compares', 'writes'],
    main: (inp) => X.graphMain(inp, 'dfs_iter(' + inp.n + ', ' + inp.s + ');'),
    capture(P) {
      const s = (k) => (P.has(k, 0) && P.isSet(k, 0) ? P.val(k, 0) : null);
      const top = s('top');
      return { visited: GW.ints(P, 'visited', 10, 0), stack: top ? P.arr('stack', top, 0) : [], top, u: s('u'), v: s('v') };
    },
    scene(ctx) {
      const tag = ctx.tick.tag, inp = ctx.input, n = inp.n;
      // back in main the locals are gone: keep the last picture
      const d = tag === 'after' && ctx.prev ? ctx.prev.data : ctx.tick.data;
      const edges = G.parse(inp.graph);
      const pos = G.positions(n, inp.pos), box = GW.box(pos, 30);
      const memo = ctx.memo;
      // follow each stack slot: a stable key and who pushed it, so a push flies in and a pop flies out
      if (memo.at !== ctx.i) {
        memo.at = ctx.i;
        memo.ids = memo.ids || [];
        memo.by = memo.by || {};
        memo.order = memo.order || [];
        memo.tree = memo.tree || {};
        memo.k = memo.k || 0;
        const st = d.stack || [];
        if (st.length < memo.ids.length) { memo.popped = memo.ids[memo.ids.length - 1]; memo.ids.length = st.length; }
        while (memo.ids.length < st.length) { const id = 'sk' + (memo.k++); memo.ids.push(id); memo.by[id] = tag === 'push' ? d.u : null; }
        if (tag === 'visit') { memo.order.push(d.u); if (memo.by[memo.popped] !== null && memo.by[memo.popped] !== undefined) memo.tree[d.u] = memo.by[memo.popped]; }
      }
      const st = d.stack || [];
      const vis = (x) => !!(d.visited && d.visited[x]);
      const inStack = new Set(st);
      const cur = d.u !== null && tag !== 'after' && tag !== 'push-start' && tag !== 'enter' ? d.u : null;
      const checking = (tag === 'check' || tag === 'push') && d.v !== null && d.v >= 0 && cur !== null;
      const isTree = (a, b) => memo.tree[b] === a || memo.tree[a] === b;
      const items = G.picture({
        n, edges, pos,
        vcls: (x) => (x === cur && (tag !== 'skip' && tag !== 'test-seen' || !vis(x)) ? 'focus hot' : vis(x) ? 'done' : inStack.has(x) ? 'part-b' : ''),
        ecls: (a, b) => (checking && ((a === cur && b === d.v) || (b === cur && a === d.v)) ? 'hot' : isTree(a, b) ? 'gw-tree' : ''),
      });
      if (checking) items.push({ key: 'cv', kind: 'cursor', at: 'gv' + d.v, side: 'above', text: 'v', cls: 'c-amber' });
      if (cur !== null) items.push({ key: 'cu', kind: 'cursor', at: 'gv' + cur, side: 'left', text: 'u', cls: 'c-teal' });
      // the stack: a tower, top at the top; copies of visited vertices are struck through
      const sx = box.x1 + 90, sy = box.y1 - 36;
      items.push(...GW.tower('stk', st, {
        x0: sx, y0: sy, w: 64, h: 36, title: 'stack', empty: 'empty', ids: memo.ids,
        cls: (k, x) => (vis(x) ? 'gw-stale' : 'part-b') + (k === st.length - 1 ? ' gw-top' : ''),
      }).map((it) => (it.kind === 'cell' ? Object.assign(it, { enter: 'fly', from: { x: pos[it.text].x - 32, y: pos[it.text].y - 18 }, exit: 'fly', toward: { x: pos[it.text].x - 32, y: pos[it.text].y - 18 } }) : it)));
      if (st.length) items.push({ key: 'topc', kind: 'cursor', at: memo.ids[st.length - 1], side: 'right', text: 'top', cls: 'c-indigo' });
      // what has been visited, in order
      items.push({ key: 'ordT', kind: 'text', x: box.x0, y: box.y1 + 40, text: 'visit order: ' + (memo.order.length ? memo.order.join('  ') : ''), cls: 'gw-note' });
      const maxH = Math.min(14, n * 2);
      const view = GW.view([box, { x0: sx - 10, y0: Math.min(box.y0, sy - maxH * 40 + 40), x1: sx + 140, y1: sy + 70 }, { x0: box.x0, y0: box.y1, x1: box.x1, y1: box.y1 + 50 }]);
      let say = '';
      const dup = st.filter((x) => vis(x)).length;
      switch (tag) {
        case 'enter': say = 'dfs_iter(' + n + ', ' + inp.s + '). No recursion: the stack array does the remembering the call stack did before.'; break;
        case 'push-start': say = 'Push the start, ' + inp.s + '.'; break;
        case 'loop': say = st.length ? 'The stack holds ' + st.join(', ') + ' (top on the right' + (dup ? '; ' + dup + ' of them already visited' : '') + ').' : 'The stack is empty: every vertex reachable from ' + inp.s + ' has been visited.'; break;
        case 'pop': say = 'Pop the top: u = ' + d.u + '. Last in, first out: the vertex pushed most recently is looked at first, which is what makes the search go deep.'; break;
        case 'test-seen': say = vis(d.u) ? d.u + ' is already visited: this is an old copy, pushed before ' + d.u + ' was reached another way.' : d.u + ' is not visited yet.'; break;
        case 'skip': say = 'Skip it and pop again. This is the price of marking a vertex when it is popped, not when it is pushed.'; break;
        case 'visit': say = 'Visit ' + d.u + '.' + (memo.tree[d.u] !== undefined ? ' It was pushed by ' + memo.tree[d.u] + ', so ' + memo.tree[d.u] + '–' + d.u + ' joins the DFS tree.' : ''); break;
        case 'scan': say = d.v >= 0 ? 'Try v = ' + d.v + '. The loop runs from n - 1 down, so the smallest neighbour is pushed last and comes off first.' : 'All of ' + d.u + '\'s neighbours have been looked at.'; break;
        case 'check': { const e = GW.has(edges, d.u, d.v) || GW.has(edges, d.v, d.u); say = !e ? 'No edge ' + d.u + '–' + d.v + '.' : vis(d.v) ? d.v + ' is visited already: do not push it.' : d.v + ' is an unvisited neighbour.'; break; }
        case 'push': say = 'Push ' + d.v + (st.slice(0, -1).includes(d.v) ? ', even though a copy of ' + d.v + ' is already lower in the stack. The new copy is the one that will be used.' : '.'); break;
        case 'after': say = 'Done. Visit order: ' + memo.order.join(', ') + '. The green edges are the DFS tree. Compare with the recursive version: the same idea, with the stack in an array.'; break;
      }
      return { items, say, view, slow: tag === 'skip' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'loop' && ts[i + 1] && ts[i + 1].tag === 'pop' && i > 6, once: true, ask: 'Which vertex comes off the stack next? Click it.', answer: (ts, i) => { const st = ts[i].data.stack; return 'gv' + st[st.length - 1]; }, explain: () => 'The one on top: the most recently pushed.' },
      { at: (t, i, ts) => t.tag === 'pop' && ts[i + 2] && ts[i + 2].tag === 'skip', once: true, ask: (t) => t.data.u + ' has just come off the stack. What happens to it?', options: () => ['It is visited again', 'It is skipped: it was visited already', 'It is pushed back'], answer: () => 'It is skipped: it was visited already', pick: 'option', explain: () => 'This copy was pushed before the vertex was reached by another path. visited[u] catches it.' },
    ],
    quiz: [
      { q: 'Why can the same vertex be on the stack twice?', options: ['A bug in the code', 'It is marked visited when popped, not when pushed, so two neighbours can both push it', 'The stack is too small', 'Because the graph is directed'], answer: 1, why: 'Until it is popped and visited, nothing stops another neighbour from pushing it again.' },
      { q: 'Why does the loop go from v = n - 1 down to 0?', options: ['It is faster', 'So the smallest neighbour is on top and is visited first, like the recursive version', 'To avoid a crash', 'It makes no difference at all'], answer: 1, why: 'A stack reverses order: the last pushed comes out first.' },
      { q: 'How large must the stack array be in the worst case?', options: ['n', 'About the number of edges', 'log n', '2'], answer: 1, why: 'Every edge can push one copy, so the stack can hold up to about m entries (here MAXV * MAXV is safe).' },
      { q: 'What is the main advantage of the explicit stack over recursion?', options: ['It finds shorter paths', 'It cannot overflow the call stack on a very deep graph', 'It visits fewer vertices', 'It needs no visited array'], answer: 1, why: 'A long path makes deep recursion; an array on the heap or in a frame can be sized for it.' },
    ],
    compareWith: 'dfs',
  });
})(SEE);
