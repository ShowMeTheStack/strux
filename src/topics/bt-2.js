// Binary trees: level order with a queue, Morris in-order (threads instead of a stack), and the array form.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, B = X.BtWalk;
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const LV = (d) => 'bt-lv' + Math.min(3, d);

  // ---- level order ----------------------------------------------------------------------------------------
  X.topic({
    id: 'bt-levelorder', family: 'bt', order: 30, title: 'Level order (breadth first)',
    blurb: 'A queue takes the nodes in the order they were found: the root, then all of level 1, then all of level 2. Each colour is a level.',
    code: `/* print the tree level by level, left to right */
void levelorder(struct node *root)
{
    struct node *queue[MAXN];
    int front = 0, rear = 0;
    struct node *cur;
    if (root == NULL)                      /*@ empty */
        return;                            /*@ none */
    queue[rear++] = root;                  /*@ enq-root */
    while (front < rear) {                 /*@ loop */
        cur = queue[front++];              /*@ deq */
        printf("%d ", cur->key);           /*@ visit */
        if (cur->left != NULL)             /*@ test-left */
            queue[rear++] = cur->left;     /*@ enq-left */
        if (cur->right != NULL)            /*@ test-right */
            queue[rear++] = cur->right;    /*@ enq-right */
    }
}`,
    animate: ['levelorder'], inputs: [X.btTree], presets: X.btPresets,
    main: (inp) => X.btMain(inp.tree, 'levelorder(root);'),
    capture: B.capture({ vars: ['front', 'rear', 'cur'], arrs: [['queue', (v) => v.rear || 0]] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, m = ctx.memo, v = d.vars;
      const geo = B.geometry(ctx);
      m.printed = m.printed || [];
      const cur = v.cur;
      if (tag === 'visit') m.printed.push(cur);
      const qall = d.arrs.queue || [];
      const front = v.front || 0;
      const q = qall.slice(front);
      m.maxQ = Math.max(m.maxQ || 0, q.length);
      const inQ = new Set(q), printed = new Set(m.printed);
      const node = cur && geo.by.get(cur);
      const dep = (a) => geo.depth.get(a) || 0;
      const items = [];
      // a band behind each level
      for (let k = 0; k < geo.height; k++) items.push({ key: 'band' + k, kind: 'region', x: geo.minX - 100, y: k * 92 - 34, w: geo.maxX - geo.minX + 200, h: 68, cls: 'bt-band ' + LV(k), text: 'level ' + k });
      items.push(...B.tree(geo, {
        cls: (a) => (a === cur && !ctx.tick.after ? 'focus ' : '') + (printed.has(a) || inQ.has(a) ? LV(dep(a)) : '') + (inQ.has(a) ? ' bt-waiting' : ''),
        edgeCls: (a, side) => (a === cur && ((tag.endsWith('left') && side === 'left') || (tag.endsWith('right') && side === 'right')) && node.links[side] ? 'hot' : ''),
      }));
      if (cur && geo.pos.has(cur) && !ctx.tick.after) items.push({ key: 'ccur', kind: 'cursor', at: 'n' + cur, side: 'left', text: 'cur', cls: 'c-teal' });
      // the queue: front on the left; cards slide left as the front moves on
      const y = geo.maxY + 104, x0 = geo.minX - 20, qx = x0 + 80, w = 44;
      const held = tag === 'deq' ? cur : null;
      items.push(...B.held(geo, held, { x: x0 - 10, y, title: 'cur', prefix: 'k' }));
      items.push({ key: 'qT', kind: 'text', x: qx, y: y - 12, text: 'queue (front on the left)', cls: 'bt-label' });
      if (!q.length) items.push({ key: 'qE', kind: 'text', x: qx + 4, y: y + 27, text: 'empty', cls: 'bt-muted' });
      q.forEach((a, k) => items.push({ key: 'k' + a, kind: 'cell', x: qx + k * (w + 6), y, w, h: w, text: B.key(geo, a), sub: '', cls: LV(dep(a)) + ' bt-card', enter: 'fly', from: { x: geo.pos.get(a).x - w / 2, y: geo.pos.get(a).y - w / 2 } }));
      if (q.length) items.push({ key: 'cfront', kind: 'cursor', at: 'k' + q[0], side: 'below', text: 'front', cls: 'c-indigo' });
      items.push(...B.output(geo, m.printed, { prefix: 'k', y: y + 116, cls: (a) => LV(dep(a)) }));
      const nm = (a) => B.key(geo, a);
      const levelOf = (a) => 'level ' + dep(a);
      let say = '';
      switch (tag) {
        case 'enter': say = geo.n ? 'levelorder(root): visit the nodes level by level. A queue remembers the nodes found but not yet printed.' : 'levelorder(root) with an empty tree.'; break;
        case 'empty': say = geo.n ? 'The tree is not empty.' : 'root is NULL: nothing to print.'; break;
        case 'none': say = 'Return at once.'; break;
        case 'enq-root': say = 'The root, ' + nm(d.root) + ', goes into the queue. It is all of level 0.'; break;
        case 'loop': say = q.length ? 'The queue holds ' + B.keys(geo, q) + '.' + (new Set(q.map(dep)).size === 1 ? ' All of them are on level ' + dep(q[0]) + '.' : ' The front ones are on level ' + dep(q[0]) + ', the back ones on level ' + dep(q[q.length - 1]) + '.') : 'The queue is empty: every node has been printed.'; break;
        case 'deq': say = 'Take ' + nm(cur) + ' from the front of the queue (' + levelOf(cur) + '). It has waited the longest.'; break;
        case 'visit': say = 'Print ' + nm(cur) + '.'; break;
        case 'test-left': say = node.links.left ? nm(cur) + ' has a left child, ' + nm(node.links.left) + ', on level ' + (dep(cur) + 1) + '.' : nm(cur) + ' has no left child.'; break;
        case 'enq-left': case 'enq-right': {
          const c = node.links[tag === 'enq-left' ? 'left' : 'right'];
          const ahead = q.slice(0, -1).filter((a) => dep(a) === dep(cur)).length;
          say = nm(c) + ' joins the back of the queue.' + (ahead ? ' It waits behind ' + plural(ahead, 'node') + ' of level ' + dep(cur) + ' that are still to be printed: a whole level always comes out before the next one.' : '');
          break;
        }
        case 'test-right': say = node.links.right ? nm(cur) + ' has a right child, ' + nm(node.links.right) + '.' : nm(cur) + ' has no right child.'; break;
        case 'after': {
          const groups = [];
          for (const a of m.printed) { const k = dep(a); (groups[k] = groups[k] || []).push(nm(a)); }
          say = geo.n ? 'Output, level by level: ' + groups.map((g) => g.join(' ')).join(' | ') + '. The queue never held more than ' + plural(m.maxQ, 'node') + '.' : 'Nothing to print.';
          break;
        }
      }
      return { items, say, slow: tag === 'deq' };
    },
    predict: [
      { at: (t) => t.tag === 'loop' && t.data.vars.rear - t.data.vars.front >= 2, once: true, ask: 'Which node comes out of the queue next? Click it.', answer: (ts, i) => 'n' + ts[i].data.arrs.queue[ts[i].data.vars.front], explain: () => 'The one at the front: first in, first out.' },
      {
        at: (t, i, ts, ctx) => {
          if (t.tag !== 'loop' || !ctx) return false;
          const q = t.data.arrs.queue.slice(t.data.vars.front);
          if (q.length < 2) return false;
          const geo = B.geometry(ctx);
          const lv = new Set(q.map((a) => geo.depth.get(a)));
          const k = geo.depth.get(q[0]);
          return k >= 2 && lv.size === 1 && [...geo.depth.values()].filter((x) => x === k).length === q.length;
        },
        once: true, ask: 'Look at the nodes in the queue right now. What do they have in common?',
        options: () => ['They are exactly one whole level of the tree', 'They are in increasing order', 'They are all left children', 'They are all leaves'],
        answer: () => 'They are exactly one whole level of the tree', pick: 'option',
        explain: () => 'Each level is added to the back while the level above is taken from the front. Between two levels, the queue holds exactly one of them.',
      },
    ],
    quiz: [
      { q: 'Level order uses a queue. What would a stack give instead (pushing left, then right)?', options: ['Level order backwards', 'A depth-first order: root, right subtree, left subtree', 'In-order', 'The same order'], answer: 1, why: 'A stack always continues with the newest node, so it goes deep before it goes wide.' },
      { q: 'At most how many nodes are in the queue at once, for a full tree with 8 leaves?', options: ['3', '4', '8', '15'], answer: 2, why: 'When the last node of level 2 is taken out, all 8 leaves of level 3 have been added: about half the tree.' },
      { q: 'Why can a plain array with front and rear be used as the queue here?', options: ['Each node enters the queue exactly once, so n places are enough', 'Trees are small', 'Because the queue is circular', 'It cannot; it overflows'], answer: 0, why: 'rear only grows, and it reaches n at most, so an array of n slots never runs out.' },
      { q: 'Level order is the tree version of which graph algorithm?', options: ['Depth-first search', 'Breadth-first search', 'Dijkstra', 'Topological sort'], answer: 1, why: 'A tree is a graph without cycles, so no visited marks are needed, but the queue works the same way.' },
      { q: 'For a tree given as "-1 = no node" level by level, level order prints the keys...', options: ['In the order they appear in that list, skipping -1', 'In sorted order', 'Backwards', 'In pre-order'], answer: 0, why: 'That list is the tree read level by level, left to right: exactly what level order produces.' },
    ],
    compareWith: 'bt-preorder-iter',
  });

  // ---- Morris in-order ----------------------------------------------------------------------------------
  X.topic({
    id: 'bt-morris', family: 'bt', order: 40, title: 'Morris in-order (no stack)',
    blurb: 'In-order with O(1) extra memory. Before going left, a node leaves itself a way back: a temporary thread from its in-order predecessor. The thread is removed on the way back.',
    code: `/* in-order with no stack and no recursion: borrow the empty right
   pointers of the tree as temporary threads back up */
void morris(struct node *root)
{
    struct node *cur = root;                          /*@ start */
    struct node *pre;
    while (cur != NULL) {                             /*@ loop */
        if (cur->left == NULL) {                      /*@ test-left */
            printf("%d ", cur->key);                  /*@ visit-alone */
            cur = cur->right;                         /*@ go-right */
        } else {
            pre = cur->left;                          /*@ find-pre */
            while (pre->right != NULL && pre->right != cur)   /*@ scan */
                pre = pre->right;                     /*@ step */
            if (pre->right == NULL) {                 /*@ test-thread */
                pre->right = cur;                     /*@ make-thread */
                cur = cur->left;                      /*@ go-left */
            } else {
                pre->right = NULL;                    /*@ cut-thread */
                printf("%d ", cur->key);              /*@ visit-back */
                cur = cur->right;                     /*@ go-right */
            }
        }
    }
}`,
    animate: ['morris'], inputs: [X.btTree], presets: X.btPresets,
    counters: ['follows', 'writes'],
    main: (inp) => X.btMain(inp.tree, 'morris(root);'),
    capture: B.capture({ vars: ['cur', 'pre'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, m = ctx.memo, v = d.vars;
      const geo = B.geometry(ctx);
      m.printed = m.printed || [];
      m.made = m.made || 0;
      const cur = v.cur, pre = v.pre;
      if (/^visit/.test(tag)) m.printed.push(cur);
      if (tag === 'make-thread') m.made++;
      // threads: right pointers that were NULL in the tree as built
      const now = new Map();
      for (const n of d.nodes) {
        const o = geo.by.get(n.addr);
        if (o && !o.links.right && n.links.right) now.set(n.addr, n.links.right);
      }
      const prevThreads = m.threads || new Map();
      m.threads = now;
      const followed = tag === 'go-right' && m.lastCur && prevThreads.get(m.lastCur) === cur && now.get(m.lastCur) === cur;
      const printed = new Set(m.printed);
      // the path pre walks: from cur's left child down the right spine
      const scanning = ['find-pre', 'scan', 'step', 'test-thread', 'make-thread', 'cut-thread'].includes(tag) && pre;
      const spine = new Set();
      if (scanning && cur) { let a = geo.by.get(cur).links.left; while (a && a !== cur) { spine.add(a); if (a === pre) break; a = geo.by.get(a).links.right; } }
      const items = B.tree(geo, {
        cls: (a) => (a === cur && !ctx.tick.after ? 'focus' : '') + (printed.has(a) ? ' done' : '') + (spine.has(a) && a !== cur ? ' bt-waiting' : ''),
        edgeCls: (a, side) => (scanning && spine.has(a) && side === 'right' && spine.has(geo.by.get(a).links.right) ? 'hot' : (scanning && a === cur && side === 'left' ? 'hot' : '')),
      });
      for (const [a, to] of now) {
        if (!geo.pos.has(to)) continue;
        const hot = (tag === 'make-thread' && a === pre) || followed && a === m.lastCur;
        items.push({ key: 'th' + a, kind: 'arrow', from: { key: 'n' + a }, to: { key: 'n' + to }, bend: 34, label: 'thread', cls: 'bt-thread alt' + (hot ? ' hot' : '') + (followed && a === m.lastCur ? ' bt-follow' : '') });
      }
      // the thread being cut: shown once more, in red, as it goes
      if (tag === 'cut-thread') for (const [a, to] of prevThreads) if (!now.has(a) && geo.pos.has(to)) items.push({ key: 'th' + a, kind: 'arrow', from: { key: 'n' + a }, to: { key: 'n' + to }, bend: 34, label: 'cut', cls: 'bt-thread bad' });
      if (cur && geo.pos.has(cur) && !ctx.tick.after) items.push({ key: 'ccur', kind: 'cursor', at: 'n' + cur, side: 'left', text: 'cur', cls: 'c-teal' });
      if (pre && geo.pos.has(pre) && scanning && !ctx.tick.after) items.push({ key: 'cpre', kind: 'cursor', at: 'n' + pre, side: 'below', text: 'pre', cls: 'c-violet' });
      items.push(...B.output(geo, m.printed, { aligned: true }));
      items.push({ key: 'mem', kind: 'text', x: geo.minX - 60, y: -70, text: 'extra memory: just cur and pre. Threads now: ' + now.size, cls: 'bt-note' });
      m.lastCur = cur;
      const nm = (a) => B.key(geo, a);
      const cn = cur && geo.by.get(cur);
      let say = '';
      switch (tag) {
        case 'enter': say = geo.n ? 'morris(root): in-order with no stack at all. The trick is to use right pointers that are NULL as temporary threads back up the tree.' : 'morris(root) with an empty tree.'; break;
        case 'start': say = geo.n ? 'cur starts at the root, ' + nm(cur) + '.' : 'cur = root, which is NULL.'; break;
        case 'loop': say = cur ? 'cur is ' + nm(cur) + '.' : 'cur is NULL: the walk is over, and every thread has been removed again.'; break;
        case 'test-left': say = cn.links.left ? nm(cur) + ' has a left subtree, which must be printed first. Before going there, make sure there is a way back.' : nm(cur) + ' has no left subtree, so it can be printed straight away.'; break;
        case 'visit-alone': say = 'Print ' + nm(cur) + '.'; break;
        case 'go-right': say = followed ? 'cur = cur->right follows a thread, not a real child: it jumps back up to ' + nm(cur) + ', whose left subtree is now finished.' : cur ? 'cur = cur->right: down to ' + nm(cur) + '.' : 'cur = cur->right is NULL: that was the last node.'; break;
        case 'find-pre': say = 'pre starts at the left child, ' + nm(pre) + '. It looks for the in-order predecessor of ' + nm(cur) + ': the rightmost node of the left subtree, the one printed just before ' + nm(cur) + '.'; break;
        case 'scan': say = geo.by.get(pre) && !now.has(pre) && geo.by.get(pre).links.right ? nm(pre) + ' has a right child, so the rightmost node is further down.' : (now.get(pre) === cur ? nm(pre) + '->right already points back to ' + nm(cur) + ': a thread made earlier.' : nm(pre) + '->right is NULL: ' + nm(pre) + ' is the rightmost node of the left subtree.'); break;
        case 'step': say = 'pre moves right, to ' + nm(pre) + '.'; break;
        case 'test-thread': say = now.get(pre) === cur ? 'pre->right points to cur: we have been here before. The left subtree of ' + nm(cur) + ' is finished.' : 'pre->right is NULL: this is the first time at ' + nm(cur) + '. Its left subtree has not been printed yet.'; break;
        case 'make-thread': say = 'Make a thread: ' + nm(pre) + '->right = ' + nm(cur) + '. When the walk finishes ' + nm(pre) + ', following its right pointer will lead back to ' + nm(cur) + '. This one pointer replaces a stack entry.'; break;
        case 'go-left': say = 'Now it is safe to go left: cur = ' + nm(cur) + '.'; break;
        case 'cut-thread': say = 'Remove the thread: ' + nm(pre) + '->right = NULL again. That pointer is back to what it was when the tree was built.'; break;
        case 'visit-back': say = 'Print ' + nm(cur) + ': its whole left subtree is done.'; break;
        case 'after': say = geo.n ? 'Output: ' + m.printed.map(nm).join(' ') + ', in-order. ' + plural(m.made, 'thread') + ' were made and all of them removed: the tree is unchanged, and no stack was used.' : 'Nothing to print.'; break;
      }
      return { items, say, slow: tag === 'make-thread' || tag === 'cut-thread' || followed };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'test-thread' && ts[i + 1] && ts[i + 1].tag === 'make-thread', once: true, ask: 'pre->right is NULL. What happens next?', options: () => ['pre->right is set to cur, then cur goes left', 'cur is printed', 'pre is printed', 'cur goes right'], answer: () => 'pre->right is set to cur, then cur goes left', pick: 'option', explain: () => 'First visit to cur: leave a thread from its predecessor so the walk can come back, then go into the left subtree.' },
      { at: (t, i, ts) => t.tag === 'test-thread' && ts[i + 1] && ts[i + 1].tag === 'cut-thread', once: true, ask: 'pre->right already points to cur. What does that mean?', options: () => ['The left subtree of cur is finished: cut the thread, print cur', 'The tree has a cycle: an error', 'cur has no left child', 'Make a second thread'], answer: () => 'The left subtree of cur is finished: cut the thread, print cur', pick: 'option', explain: () => 'The walk came back up through the thread, so everything left of cur has been printed.' },
      { at: (t, i, ts) => t.tag === 'visit-alone' && ts[i + 1] && ts[i + 1].data.nodes.some((n) => n.addr === t.data.vars.cur && n.links.right) && i > 4, once: true, ask: 'cur = cur->right is next. Click the node cur will move to.', answer: (ts, i) => 'n' + ts[i + 1].data.vars.cur, explain: () => 'If the right pointer is a thread, it leads back up to the in-order successor; otherwise down to a real right child.' },
    ],
    quiz: [
      { q: 'How much extra memory does Morris traversal use?', options: ['O(n) for a stack', 'O(height)', 'O(1): two pointers', 'O(log n)'], answer: 2, why: 'There is no stack and no recursion. The way back up is stored in right pointers that were NULL anyway.' },
      { q: 'Where does the thread made for cur start?', options: ['At cur\'s parent', 'At the rightmost node of cur\'s left subtree', 'At the leftmost node of cur\'s right subtree', 'At the root'], answer: 1, why: 'That node is cur\'s in-order predecessor: printed just before cur, and its right pointer is always NULL.' },
      { q: 'After morris() returns, the tree is...', options: ['Turned into a linked list', 'Exactly as before', 'Missing its leaves', 'Full of threads'], answer: 1, why: 'Every thread made on the way down is cut on the way back, so all pointers are restored.' },
      { q: 'How does the walk know it has come back to a node rather than meeting it for the first time?', options: ['A visited flag in each node', 'The predecessor\'s right pointer already points to it', 'A counter', 'It cannot tell'], answer: 1, why: 'On the first visit the predecessor\'s right pointer is NULL; on the second it is the thread made the first time.' },
      { q: 'What is the total running time for n nodes?', options: ['O(n²)', 'O(n log n)', 'O(n)', 'O(n) only for balanced trees'], answer: 2, why: 'Each edge is walked a constant number of times: the predecessor searches cross every edge at most twice in total.' },
    ],
    compareWith: 'bt-inorder-iter',
  });

  // ---- the array form -------------------------------------------------------------------------------------
  const arrayTree = Object.assign({}, X.btTree, { min: 1, check: (v) => B.checkTree(v) || (v[0] === -1 ? 'Tree: the root (position 0) must be a node' : null) });
  X.topic({
    id: 'bt-array', family: 'bt', order: 50, title: 'A tree in an array',
    blurb: 'No pointers at all: the node at index i keeps its children at 2i+1 and 2i+2, and its parent at (i-1)/2. Fill the array from the tree, then climb back up by arithmetic.',
    code: `/* store the tree in a[]: the node at index i has its
   children at 2i+1 and 2i+2, so no pointers are needed */
void to_array(struct node *t, int i, int a[])
{
    if (t == NULL)                        /*@ base */
        return;                           /*@ null */
    a[i] = t->key;                        /*@ place */
    to_array(t->left, 2 * i + 1, a);      /*@ walk-left */
    to_array(t->right, 2 * i + 2, a);     /*@ walk-right */
}                                         /*@ done */

/* climb from index i to the root: the parent of i is (i - 1) / 2 */
void path_up(const int a[], int i)
{
    while (i > 0) {                       /*@ test */
        printf("%d ", a[i]);              /*@ visit */
        i = (i - 1) / 2;                  /*@ step-up */
    }
    printf("%d\\n", a[0]);                 /*@ root */
}`,
    animate: ['to_array', 'path_up'],
    inputs: [arrayTree, { id: 'from', kind: 'int', label: 'Climb from index', def: 5, lo: 0, hi: 14 }],
    check: (inp) => (inp.from >= inp.tree.length || inp.tree[inp.from] === -1 ? 'Climb from index: pick a position that holds a node (0 to ' + (inp.tree.length - 1) + ', not a -1)' : null),
    presets: [
      { label: 'Full tree', values: { tree: [50, 30, 70, 20, 40, 60, 80], from: 5 } },
      { label: 'Lopsided', values: { tree: [8, 3, 10, 1, 6, -1, 14, -1, -1, 4, 7, -1, -1, 13], from: 13 } },
      { label: 'Chain to the right', values: { tree: [1, -1, 2, -1, -1, -1, 3], from: 6 } },
      { label: 'Complete, not full', values: { tree: [9, 5, 8, 1, 4, 7, 2, 0, 3], from: 8 } },
      { label: 'One node', values: { tree: [42], from: 0 } },
    ],
    counters: ['moves', 'follows'],
    main: (inp) => `int main(void)
{
    int keys[] = { ${inp.tree.join(', ')} };
    int n = ${inp.tree.length};
    struct node *root = build(keys, n, 0);
    int a[${inp.tree.length}];
    int i;
    for (i = 0; i < n; i++)
        a[i] = -1;
    to_array(root, 0, a);
    path_up(a, ${inp.from});
    return 0;
}`,
    capture(P) {
      const base = B.capture({ vars: ['i'] })(P);
      const mi = P.frames.findIndex((f) => f.name === 'main');
      const n = mi >= 0 ? P.val('n', mi) || 0 : 0;
      base.a = P.arr('a', n) || [];
      base.fn = P.frames[0].name;
      return base;
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, m = ctx.memo, inp = ctx.input;
      const geo = B.geometry(ctx);
      const n = inp.tree.length;
      m.idx = m.idx || new Map();
      m.at = m.at || [];
      const frames = d.calls.filter((c) => c.fn === 'to_array').map((c) => ({ t: c.args.t || 0, i: c.args.i }));
      const top = frames[frames.length - 1];
      if (tag === 'place' && top) { m.idx.set(top.t, top.i); m.at[top.i] = top.t; }
      if (d.fn === 'path_up') m.climbing = true;
      const climbing = !!m.climbing;
      const i = climbing ? d.vars.i : top ? top.i : null;
      m.path = m.path || [];
      if (climbing && i !== null && (tag === 'test' || tag === 'root') && !m.path.includes(i)) m.path.push(i);
      if (tag === 'visit' || tag === 'root') { m.out = m.out || []; m.out.push(d.a[tag === 'root' ? 0 : i]); }
      const onPath = new Set(m.path.map((k) => m.at[k]));
      const nodeAt = (k) => m.at[k];
      const items = [];
      const cw = 46, gap = 6;
      const ax0 = (geo.minX + geo.maxX) / 2 - (n * (cw + gap) - gap) / 2;
      const ay = geo.maxY + 170;
      const cx = (k) => ax0 + k * (cw + gap) + cw / 2;
      const curNode = climbing ? nodeAt(i) : top && top.t;
      items.push(...B.tree(geo, {
        cls: (a) => (a === curNode && !ctx.tick.after ? 'focus ' : '') + (climbing && onPath.has(a) ? 'part-a ' : '') + (!climbing && m.idx.has(a) ? 'part-b' : ''),
        sub: (a) => (m.idx.has(a) ? '[' + m.idx.get(a) + ']' : ''),
        edgeCls: (a, side) => (climbing && onPath.has(a) && onPath.has(geo.by.get(a).links[side]) ? 'part-a' : ''),
      }));
      // the array, one cell per position; -1 shows as an empty slot
      items.push({ key: 'aT', kind: 'text', x: ax0 - 14, y: ay + 29, text: 'a[]', cls: 'bt-label', anchor: 'end' });
      for (let k = 0; k < n; k++) {
        const val = d.a[k];
        const hot = !climbing && tag === 'place' && top && top.i === k;
        const on = climbing && k === i && tag !== 'after';
        items.push({ key: 'ac' + k, kind: 'cell', x: ax0 + k * (cw + gap), y: ay, w: cw, h: cw, text: val === -1 || val === null ? '-' : val, sub: k, cls: (val === -1 || val === null ? 'bt-empty' : 'part-b') + (hot ? ' hot' : '') + (on ? ' focus' : '') + (climbing && m.path.includes(k) ? ' part-a' : ''), flash: hot });
      }
      // the link between the node of this call and its slot
      if (!climbing && top && top.t && geo.pos.has(top.t) && top.i < n) {
        const p = geo.pos.get(top.t);
        items.push({ key: 'link', kind: 'line', x1: p.x, y1: p.y + 24, x2: cx(top.i), y2: ay - 2, cls: 'bt-link' });
      }
      // the index arithmetic: arcs under the array to the children, over it to the parent
      if (!climbing && top && top.t && !ctx.tick.after) {
        const past = [2 * top.i + 1, 2 * top.i + 2].filter((c) => c >= n);
        if (past.length) items.push({ key: 'arcx', kind: 'text', x: cx(Math.min(top.i, n - 1)), y: ay - 14, text: (past.length === 2 ? 'children at ' + past.join(' and ') : 'right child at ' + past[0]) + ': past the end', cls: 'bt-idx', anchor: 'middle' });
        for (const [c, lbl] of [[2 * top.i + 1, '2i+1'], [2 * top.i + 2, '2i+2']]) {
          if (c >= n) continue;
          items.push({ key: 'arc' + lbl, kind: 'arrow', from: { key: 'ac' + top.i, side: 'bottom' }, to: { key: 'ac' + c, side: 'bottom' }, bend: Math.min(90, 14 + (c - top.i) * 16), label: lbl + ' = ' + c, cls: 'bt-arc alt' + ((tag === 'walk-left' && lbl === '2i+1') || (tag === 'walk-right' && lbl === '2i+2') ? ' hot' : '') });
        }
      }
      // going up: after a step the arc shows the jump just made; before it, the jump about to be made
      const jump = tag === 'step-up' ? [m.path[m.path.length - 1], i] : climbing && tag === 'visit' && i > 0 ? [i, Math.floor((i - 1) / 2)] : null;
      if (jump) items.push({ key: 'arcup', kind: 'arrow', from: { key: 'ac' + jump[0], side: 'top' }, to: { key: 'ac' + jump[1], side: 'top' }, bend: Math.min(70, 16 + (jump[0] - jump[1]) * 12), label: '(' + jump[0] + ' - 1) / 2 = ' + jump[1], cls: 'bt-arc alt' + (tag === 'step-up' ? ' hot' : '') });
      if (climbing && m.out && m.out.length) items.push({ key: 'outline', kind: 'text', x: ax0, y: ay + cw + 64, text: 'printed: ' + m.out.join(' '), cls: 'bt-note' });
      const used = d.a.filter((x) => x !== -1 && x !== null).length;
      if (!climbing || ctx.tick.after) items.push({ key: 'usage', kind: 'text', x: ax0, y: ay + cw + 92, text: 'slots used: ' + used + ' of ' + n, cls: 'bt-muted' });
      // the recursion of to_array, beside the tree
      const sx = Math.max(geo.maxX, ax0 + n * (cw + gap)) + 70, sy = ay - 10;
      if (!climbing) {
        items.push({ key: 'stkT', kind: 'text', x: sx + 80, y: sy + 58, text: 'calls of to_array()', cls: 'bt-label', anchor: 'middle' });
        frames.forEach((f, k) => items.push({ key: 'fr' + k + '_' + f.t + '_' + f.i, kind: 'node', x: sx, y: sy - k * 40, w: 160, h: 32, cells: [{ text: f.t ? B.key(geo, f.t) : 'NULL', w: 2 }, { text: 'i = ' + f.i, w: 2, cls: 'link' }], cls: 'bt-frame' + (k === frames.length - 1 ? ' bt-frame-top' : '') + (f.t ? '' : ' bt-frame-null'), enter: 'drop', exit: 'fade' }));
      }
      const nm = (a) => B.key(geo, a);
      const lastTop = m.lastTop;
      m.lastTop = top;
      const parentNode = top && frames.length > 1 ? frames[frames.length - 2].t : 0;
      let say = '';
      switch (tag) {
        case 'enter': say = 'to_array(root, 0, a): the root goes to index 0. Every slot starts as -1, meaning no node.'; break;
        case 'base': say = top && top.t ? 'This call has node ' + nm(top.t) + ' and index i = ' + top.i + '.' : 'Index ' + top.i + ' gets no node: the subtree is empty' + (top.i >= n ? ', and the index is past the end of the array anyway.' : ', so a[' + top.i + '] stays -1, a gap in the array.'); break;
        case 'null': say = 'Nothing to store: return.'; break;
        case 'place': say = 'a[' + top.i + '] = ' + nm(top.t) + '. The key is stored by position; nothing in the array says who its children are. The index alone tells.'; break;
        case 'walk-left': say = 'The left child of ' + nm(parentNode) + ' goes to 2i+1 = 2*' + frames[frames.length - 2].i + '+1 = ' + top.i + (top.t ? ': that is ' + nm(top.t) + '.' : ', but there is no left child.'); break;
        case 'walk-right': say = 'The right child of ' + nm(parentNode) + ' goes to 2i+2 = 2*' + frames[frames.length - 2].i + '+2 = ' + top.i + (top.t ? ': that is ' + nm(top.t) + '.' : ', but there is no right child.'); break;
        case 'done': { const g = lastTop; say = g ? 'The call for ' + nm(g.t) + ' (i = ' + g.i + ') is finished: its whole subtree is in the array. It returns to ' + (top ? 'the call for ' + nm(top.t) + '.' : 'main.') : 'This call is finished.'; break; }
        case 'test': say = i > 0 ? 'i = ' + i + ' is not the root, so it has a parent.' : 'i = 0: the root has been reached.'; break;
        case 'visit': say = 'Print a[' + i + '] = ' + d.a[i] + '.'; break;
        case 'step-up': { const from = m.path[m.path.length - 1]; say = 'The parent of index ' + from + ' is (' + from + ' - 1) / 2 = ' + i + ' (integer division). No pointer was followed: one subtraction and one division.'; break; }
        case 'root': say = 'Print the root, a[0] = ' + d.a[0] + '. The climb took ' + plural(m.path.length - 1, 'step') + '.'; break;
        case 'after':
          if (!climbing) say = 'The array is filled: ' + used + ' of ' + n + ' slots hold a node' + (used < n ? '; the other ' + (n - used) + ' are gaps where a node is missing.' : ', with no gaps.') + ' Now path_up climbs from index ' + inp.from + '.';
          else say = 'path_up is done: ' + (m.out || []).join(' ') + '. ' + (used < n ? 'A lopsided tree leaves gaps, so the array wastes space. A complete tree has none, which is why heaps are stored this way.' : 'This tree has no gaps: complete trees fit an array perfectly, which is why heaps are stored this way.');
          break;
      }
      return { items, say, calls: [{ fn: 'main', args: {} }].concat(climbing ? [{ fn: 'path_up', args: { i } }] : frames.map((f) => ({ fn: 'to_array', args: { t: f.t ? nm(f.t) : 'NULL', i: f.i } }))), slow: tag === 'place' || tag === 'step-up' };
    },
    predict: [
      { at: (t) => t.tag === 'place' && t.data.calls.filter((c) => c.fn === 'to_array').length === 2, once: true, ask: (t) => { const c = t.data.calls.filter((x) => x.fn === 'to_array'); return 'This node is at index ' + c[c.length - 1].args.i + '. At which index will its right child go?'; }, options: (ts, i) => { const c = ts[i].data.calls.filter((x) => x.fn === 'to_array'); const k = c[c.length - 1].args.i; return [String(k + 1), String(2 * k + 1), String(2 * k + 2), String(k + 2)]; }, answer: (ts, i) => { const c = ts[i].data.calls.filter((x) => x.fn === 'to_array'); return String(2 * c[c.length - 1].args.i + 2); }, pick: 'option', explain: () => 'Right child: 2i+2. Left child: 2i+1.' },
      { at: (t) => t.tag === 'test' && t.data.vars.i > 0, once: true, ask: (t) => 'i = ' + t.data.vars.i + '. Which index is its parent?', options: (ts, i) => { const k = ts[i].data.vars.i; return [...new Set([Math.floor((k - 1) / 2), Math.floor(k / 2), k - 1, Math.max(0, k - 2)].map(String))]; }, answer: (ts, i) => String(Math.floor((ts[i].data.vars.i - 1) / 2)), pick: 'option', explain: () => '(i - 1) / 2 with integer division: it works for left children (odd i) and right children (even i) alike.' },
    ],
    quiz: [
      { q: 'In the array form, where are the children of the node at index 4?', options: ['5 and 6', '8 and 9', '9 and 10', '2 and 3'], answer: 2, why: '2*4+1 = 9 and 2*4+2 = 10.' },
      { q: 'What is the parent of index 10?', options: ['5', '4', '9', '3'], answer: 1, why: '(10 - 1) / 2 = 4 with integer division. Check: the children of 4 are 9 and 10.' },
      { q: 'A chain of 4 nodes going right needs an array of what size?', options: ['4', '8', '15', '16'], answer: 2, why: 'The indices go 0, 2, 6, 14: the array must reach index 14, so 15 slots for 4 nodes.' },
      { q: 'Why are heaps stored in arrays?', options: ['Heaps are always complete trees, so there are no gaps', 'Arrays are sorted', 'Heaps have no children', 'It is required by C'], answer: 0, why: 'A complete tree fills the array from index 0 with no holes, and parent and child are one calculation away.' },
      { q: 'What does the array form save compared with linked nodes?', options: ['Nothing', 'The two child pointers of every node', 'The keys', 'Time for every operation'], answer: 1, why: 'Positions replace pointers. The cost is wasted slots when the tree is not complete.' },
    ],
  });
})(SEE);
