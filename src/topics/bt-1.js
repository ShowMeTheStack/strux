// Binary trees: the family, and the depth-first traversals, recursive and with an explicit stack.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, B = X.BtWalk;

  X.family({
    id: 'bt', order: 1, group: 'Trees', title: 'Binary trees',
    blurb: 'Every node has at most two children. Visiting all of them in a sensible order is the first thing to learn: depth first, level by level, or with no extra memory at all.',
    head: `#include <stdio.h>
#include <stdlib.h>

#define MAXN 16

/* a tree node: a key and the roots of its two subtrees */
struct node {
    int key;
    struct node *left;
    struct node *right;
};

/* main uses this to build the tree you chose. keys[] lists the tree level by
   level: the children of position i are at 2i+1 and 2i+2, and -1 means no node */
struct node *build(const int keys[], int n, int i)
{
    struct node *t;
    if (i >= n || keys[i] == -1)
        return NULL;
    t = malloc(sizeof *t);
    t->key = keys[i];
    t->left = build(keys, n, 2 * i + 1);
    t->right = build(keys, n, 2 * i + 2);
    return t;
}`,
  });

  X.btTree = { id: 'tree', kind: 'ints', label: 'Tree, level by level (-1 = no node)', def: [50, 30, 70, 20, 40, 60, 80], min: 0, max: 15, check: B.checkTree };
  X.btMain = (keys, call, decl) => `int main(void)
{
    int keys[] = { ${keys.length ? keys.join(', ') : '-1'} };
    struct node *root = build(keys, ${keys.length}, 0);
${decl ? '    ' + decl + '\n' : ''}    ${call}
    printf("\\n");
    return 0;
}`;
  X.btPresets = [
    { label: 'Full tree', values: { tree: [50, 30, 70, 20, 40, 60, 80] } },
    { label: 'Lopsided', values: { tree: [8, 3, 10, 1, 6, -1, 14, -1, -1, 4, 7, -1, -1, 13] } },
    { label: 'Chain to the left', values: { tree: [40, 30, -1, 20, -1, -1, -1, 10] } },
    { label: 'One node', values: { tree: [7] } },
    { label: 'Empty tree', values: { tree: [] } },
  ];
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  // ---- recursive traversals: one Euler-tour walk, three moments to print ------------------------------
  // The walk goes round the outside of the tree: it passes a node's left side on the way down, its
  // underside between the two subtrees, and its right side on the way back up. Pre-order prints at the
  // first, in-order at the second, post-order at the third.
  const SIDE_WORD = { pre: 'left side', in: 'underside', post: 'right side' };

  /** Keep the call frames in step with the machine; returns {frames, popped} */
  function syncFrames(ctx, fname) {
    const m = ctx.memo, d = ctx.tick.data;
    m.fr = m.fr || [];
    m.nextId = m.nextId || 0;
    m.callCount = m.callCount || 0;
    m.nullCount = m.nullCount || 0;
    const live = d.calls.filter((c) => c.fn === fname).map((c) => c.args.root || 0);
    const popped = [];
    let k = 0;
    while (k < m.fr.length && k < live.length && m.fr[k].addr === live[k]) k++;
    while (m.fr.length > k) popped.unshift(m.fr.pop());
    const side = /left/.test(ctx.tick.tag) ? 'left' : 'right';
    while (m.fr.length < live.length) {
      const parent = m.fr[m.fr.length - 1];
      if (parent) parent.phase = side === 'left' ? 'in' : 'post';
      m.fr.push({ id: m.nextId++, addr: live[m.fr.length], phase: 'pre', parent: parent ? parent.addr : 0, side: parent ? side : null });
      m.callCount++;
      if (!live[m.fr.length - 1]) m.nullCount++;
    }
    return { frames: m.fr, popped, pushed: m.fr.length > k };
  }

  function recursiveScene(kind, fname) {
    return function (ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, m = ctx.memo;
      const geo = B.geometry(ctx);
      const st = syncFrames(ctx, fname);
      const frames = st.frames;
      const top = frames[frames.length - 1];
      m.printed = m.printed || [];
      m.trail = m.trail || [];
      if (tag === 'visit' && top && top.addr) m.printed.push(top.addr);
      // where the walk is now
      let wp;
      const gone = st.popped[st.popped.length - 1];
      if (ctx.tick.end && gone && gone.addr) wp = B.point(geo, gone.addr, 'post');
      else if (top && top.addr) wp = B.point(geo, top.addr, top.phase);
      else if (top) wp = top.parent ? B.nullSpot(geo, top.parent, top.side) : { x: 0, y: 0 };
      else wp = m.trail[m.trail.length - 1] || { x: 0, y: 0 };
      const add = (p) => { const last = m.trail[m.trail.length - 1]; if (!last || last.x !== p.x || last.y !== p.y) m.trail.push(p); };
      // the walk keeps to the outside of an edge going down and to the inside coming back up
      if (m.climb) { m.climb.forEach(add); m.climb = null; }
      if (st.pushed && top && top.addr && top.parent) add(B.beside(geo, top.parent, top.addr, 'down'));
      add(wp);
      if (ctx.tick.end && gone && gone.addr && gone.parent) m.climb = [B.beside(geo, gone.parent, gone.addr, 'up'), B.point(geo, gone.parent, gone.side === 'left' ? 'in' : 'post')];
      const printedSet = new Set(m.printed);
      const waiting = new Set(frames.slice(0, -1).map((f) => f.addr));
      const items = [];
      // the trail of the walk, behind everything
      for (let k = 0; k + 1 < m.trail.length; k++) items.push({ key: 'tr' + k, kind: 'line', x1: m.trail[k].x, y1: m.trail[k].y, x2: m.trail[k + 1].x, y2: m.trail[k + 1].y, cls: 'bt-tour' });
      items.push(...B.tree(geo, {
        cls: (a) => (top && a === top.addr && !ctx.tick.after ? 'focus' : '') + (printedSet.has(a) ? ' done' : '') + (waiting.has(a) ? ' bt-onstack' : ''),
      }));
      items.push(...B.nullSpots(geo, top && !top.addr && top.parent ? { a: top.parent, side: top.side } : null));
      // where each node will be printed: a dashed ring, then its place in the output
      for (const a of geo.by.keys()) {
        const p = B.point(geo, a, kind);
        const at = m.printed.indexOf(a);
        if (at < 0) items.push({ key: 'vs' + a, kind: 'ring', x: p.x, y: p.y, r: 11, cls: 'bt-spot' });
        else items.push({ key: 'vb' + a, kind: 'vertex', x: p.x, y: p.y, r: 12, text: String(at + 1), cls: 'bt-badge', enter: 'grow' });
      }
      if (geo.n) items.push({ key: 'walker', kind: 'token', x: wp.x, y: wp.y, r: 8, text: '', cls: 'bt-walker' });
      else items.push({ key: 'emptyT', kind: 'text', x: 0, y: 6, text: 'root is NULL: the tree is empty', cls: 'bt-muted', anchor: 'middle' });
      // the call stack, oldest at the bottom
      const sx = geo.maxX + 120, sy = Math.max(geo.maxY, 92 * 3) + 30;
      items.push({ key: 'stkT', kind: 'text', x: sx + 85, y: sy + 58, text: 'calls of ' + fname + '()', cls: 'bt-label', anchor: 'middle' });
      items.push({ key: 'stkF', kind: 'line', x1: sx - 6, y1: sy + 38, x2: sx + 176, y2: sy + 38, cls: 'bt-floor' });
      frames.forEach((f, k) => {
        const isTop = k === frames.length - 1;
        const status = isTop ? (f.addr ? 'running' : /^walk/.test(ctx.tick.tag) ? 'just called' : 'empty: returns') : f.phase === 'in' ? 'waits: left call' : 'waits: right call';
        items.push({ key: 'fr' + f.id, kind: 'node', x: sx, y: sy - k * 40, w: 170, h: 32, cells: [{ text: f.addr ? B.key(geo, f.addr) : 'NULL', w: 2 }, { text: status, w: 3, cls: 'link' }], cls: 'bt-frame' + (isTop ? ' bt-frame-top' : '') + (f.addr ? '' : ' bt-frame-null'), enter: 'drop', exit: 'fade' });
      });
      items.push(...B.output(geo, m.printed, { aligned: kind === 'in' }));
      items.push({ key: 'legend', kind: 'text', x: geo.minX - 60, y: -62, text: kind + '-order prints a node when the walk passes its ' + SIDE_WORD[kind], cls: 'bt-note' });
      const calls = [{ fn: 'main', args: {} }].concat(frames.map((f) => ({ fn: fname, args: { root: f.addr ? B.key(geo, f.addr) : 'NULL' } })));
      return { items, say: recursiveSay(kind, fname, ctx, geo, st, top, gone), calls, slow: tag === 'visit' };
    };
  }

  function recursiveSay(kind, fname, ctx, geo, st, top, gone) {
    const tag = ctx.tick.tag, m = ctx.memo;
    const nm = (a) => B.key(geo, a);
    const out = m.printed.map(nm).join(' ');
    const here = top ? nm(top.addr) : 'NULL';
    const parentOf = (f) => (f && f.parent ? nm(f.parent) : '');
    const n = geo.n;
    switch (tag) {
      case 'enter':
        if (!n) return fname + '(root) is called with an empty tree: root is NULL.';
        return fname + '(root) is called on the whole tree, rooted at ' + here + '. ' + ({
          pre: 'The rule: print the node, then its whole left subtree, then its whole right subtree.',
          in: 'The rule: the whole left subtree first, then the node, then the whole right subtree.',
          post: 'The rule: the whole left subtree, then the whole right subtree, and only then the node.',
        })[kind];
      case 'base':
        if (top && top.addr) return 'root is ' + here + ', not NULL, so this call has a node to deal with' + (st.frames.length > 1 ? ' (' + plural(st.frames.length, 'call') + ' are now on the stack).' : '.');
        return top && top.parent ? 'root is NULL: this is the empty ' + top.side + ' subtree of ' + parentOf(top) + '. This is the base case that stops the recursion.' : 'root is NULL: there is nothing to visit.';
      case 'null':
        return top ? 'Nothing to do for an empty subtree: return at once. The frame is popped and the call for ' + here + ' carries on where it stopped.' : 'Nothing to do: return straight away.';
      case 'visit': {
        const k = m.printed.length;
        const node = geo.by.get(top.addr);
        const kids = [node.links.left, node.links.right].filter(Boolean);
        let why = '';
        if (kind === 'pre') why = kids.length ? ' Its ' + (kids.length === 2 ? 'children ' + kids.map(nm).join(' and ') + ' are' : 'child ' + nm(kids[0]) + ' is') + ' not printed yet: a node always comes before everything below it.' : ' It is a leaf, so there is nothing below it.';
        else if (kind === 'in') why = (node.links.left ? ' Its whole left subtree is already printed; its right subtree is not.' : ' It has no left subtree, so it comes straight away.') + ' The key drops into the column right under its node.';
        else why = kids.length ? ' Its ' + (kids.length === 2 ? 'children ' + kids.map(nm).join(' and ') + ' are' : 'child ' + nm(kids[0]) + ' is') + ' already printed: a node always comes after everything below it.' : ' It is a leaf: nothing below it to wait for.';
        return 'Print ' + here + ', number ' + k + ' of ' + n + ', as the walk passes its ' + SIDE_WORD[kind] + '.' + why;
      }
      case 'walk-left': {
        const p = parentOf(top);
        return top && top.addr ? 'Call ' + fname + ' on the left child of ' + p + ': ' + here + '. The call for ' + p + ' waits on the stack until that whole subtree is done.' : p + ' has no left child, but the call is still made with NULL. It will return at once.';
      }
      case 'walk-right': {
        const p = parentOf(top);
        return (kind === 'post' ? 'The left subtree of ' + p + ' is finished. ' : '') + (top && top.addr ? 'Now call ' + fname + ' on the right child of ' + p + ': ' + here + '.' : p + ' has no right child: the call is made with NULL and returns at once.');
      }
      case 'done':
        if (!gone) return '';
        return 'The call for ' + nm(gone.addr) + ' reaches its end: ' + nm(gone.addr) + ' and everything below it are finished. ' + (top ? 'Its frame is popped and control goes back to the call for ' + here + '.' : 'That was the first call, so the whole tree is done.');
      case 'after':
        if (!n) return 'Nothing was printed. One call was made, for the empty tree, and it returned at once.';
        return 'Output: ' + out + '. ' + ({
          pre: 'The root came first, and every node came before its children.',
          in: 'Read the tree from left to right and you get exactly this order.' + (isSorted(m.printed.map(nm)) ? ' The keys come out sorted, because this tree is a binary search tree.' : ''),
          post: 'The root came last, and every node came after its children.',
        })[kind] + ' ' + plural(m.callCount, 'call') + ' for ' + plural(n, 'node') + ': ' + m.nullCount + ' of them were for empty subtrees.';
    }
    return '';
  }
  const isSorted = (a) => a.every((x, k) => !k || a[k - 1] <= x);

  /** Index of the next visit after tick i, and the node it prints */
  function nextVisit(ts, i, fname) {
    for (let j = i + 1; j < ts.length; j++) if (ts[j].tag === 'visit') { const c = ts[j].data.calls.filter((x) => x.fn === fname); return c[c.length - 1].args.root; }
    return null;
  }
  const visitsSoFar = (ts, i) => ts.slice(0, i + 1).filter((t) => t.tag === 'visit').length;
  const topOf = (t, fname) => { const c = t.data.calls.filter((x) => x.fn === fname); return c.length ? c[c.length - 1].args.root : null; };
  const nullCallPredict = (fname) => ({
    at: (t, i, ts) => /^walk/.test(t.tag) && topOf(t, fname) === 0 && visitsSoFar(ts, i) >= 1, once: true,
    ask: 'This call is made with root = NULL. What will it do?', options: () => ['Return at once, printing nothing', 'Crash, because there is no node', 'Print 0', 'Go back to the root'], answer: () => 'Return at once, printing nothing', pick: 'option',
    explain: () => 'The first line tests root == NULL. An empty subtree is the base case: there is nothing to print, so it returns.',
  });

  function recursiveTopic(o) {
    const kind = o.kind, fname = o.fname;
    X.topic({
      id: o.id, family: 'bt', order: o.order, title: o.title, blurb: o.blurb, code: o.code,
      animate: [fname], inputs: [X.btTree], presets: X.btPresets,
      counters: ['follows'],
      main: (inp) => X.btMain(inp.tree, fname + '(root);'),
      capture: B.capture(),
      scene: recursiveScene(kind, fname),
      predict: o.predict.concat([nullCallPredict(fname)]),
      quiz: o.quiz,
      compareWith: o.compareWith,
    });
  }

  recursiveTopic({
    id: 'bt-preorder', order: 10, kind: 'pre', fname: 'preorder', title: 'Pre-order (recursive)',
    blurb: 'Node first, then the left subtree, then the right. The walk round the tree prints each node as it passes the node\'s left side.',
    code: `/* print a node before both of its subtrees */
void preorder(struct node *root)
{
    if (root == NULL)                  /*@ base */
        return;                        /*@ null */
    printf("%d ", root->key);          /*@ visit */
    preorder(root->left);              /*@ walk-left */
    preorder(root->right);             /*@ walk-right */
}                                      /*@ done */`,
    predict: [
      { at: (t, i) => i === 0 && t.data.root, once: true, ask: 'Which node is printed first? Click it.', answer: (ts) => 'n' + ts[0].data.root, explain: () => 'Pre-order prints a node before anything below it, so the root is always first.' },
      { at: (t, i, ts) => t.tag === 'visit' && visitsSoFar(ts, i) === 2 && nextVisit(ts, i, 'preorder'), once: true, ask: 'Which node will be printed next? Click it.', answer: (ts, i) => 'n' + nextVisit(ts, i, 'preorder'), explain: () => 'Go left if you can; if not, the next node is the right child of the nearest node still waiting on the stack.' },
    ],
    quiz: [
      { q: 'In a pre-order listing, which key always comes first?', options: ['The smallest key', 'The root', 'The leftmost leaf', 'The last key inserted'], answer: 1, why: 'The node is printed before its subtrees, and the root is the node of the first call.' },
      { q: 'The tree has root 1, left child 2, right child 3, and 2 has a left child 4. Pre-order gives...', options: ['1 2 4 3', '4 2 1 3', '4 2 3 1', '1 2 3 4'], answer: 0, why: 'Print 1, then all of the left subtree (2, then its left child 4), then the right subtree (3).' },
      { q: 'How many calls of preorder() are made for a tree of n nodes?', options: ['n', 'n + 1', '2n + 1', '2n'], answer: 2, why: 'One call per node and one per empty child. A tree of n nodes has n + 1 empty children, so n + (n + 1) = 2n + 1.' },
      { q: 'What decides how deep the call stack gets?', options: ['The number of nodes', 'The height of the tree', 'The number of leaves', 'The largest key'], answer: 1, why: 'The frames on the stack are one path from the root down. A chain of n nodes needs n frames; a balanced tree about log n.' },
      { q: 'Pre-order is a natural way to copy a tree or to save it to a file. Why?', options: ['It is the fastest order', 'Each parent comes before its children, so it can be rebuilt top-down', 'It prints keys in sorted order', 'It uses no stack'], answer: 1, why: 'When rebuilding, every node can be attached as soon as it is read, because its parent was read before it.' },
    ],
    compareWith: 'bt-preorder-iter',
  });

  recursiveTopic({
    id: 'bt-inorder', order: 11, kind: 'in', fname: 'inorder', title: 'In-order (recursive)',
    blurb: 'Left subtree, then the node, then the right subtree. Each key drops straight down from its node: in-order reads the tree from left to right.',
    code: `/* print a node between its left and its right subtree */
void inorder(struct node *root)
{
    if (root == NULL)                  /*@ base */
        return;                        /*@ null */
    inorder(root->left);               /*@ walk-left */
    printf("%d ", root->key);          /*@ visit */
    inorder(root->right);              /*@ walk-right */
}                                      /*@ done */`,
    predict: [
      { at: (t, i) => i === 0 && t.data.root, once: true, ask: 'Which node is printed first? Click it.', answer: (ts, i) => 'n' + nextVisit(ts, i, 'inorder'), explain: () => 'The leftmost node: keep going left from the root until there is no left child.' },
      { at: (t, i, ts) => t.tag === 'visit' && visitsSoFar(ts, i) === 2 && nextVisit(ts, i, 'inorder'), once: true, ask: 'Which node will be printed next? Click it.', answer: (ts, i) => 'n' + nextVisit(ts, i, 'inorder'), explain: () => 'The next node to the right in the picture: in-order is the tree read from left to right.' },
    ],
    quiz: [
      { q: 'An in-order traversal of a binary search tree prints the keys...', options: ['In the order they were inserted', 'In increasing order', 'Level by level', 'In decreasing order'], answer: 1, why: 'Everything smaller is in the left subtree and printed first; everything bigger is in the right subtree and printed after.' },
      { q: 'Which node does in-order print first?', options: ['The root', 'The leftmost node', 'The leftmost leaf of the deepest level', 'The left child of the root'], answer: 1, why: 'Every call goes left first, so nothing is printed until a node with no left child is reached.' },
      { q: 'A node is printed. What has been printed just before it, if it has a left subtree?', options: ['Its parent', 'Its left child', 'The rightmost node of its left subtree', 'Its right child'], answer: 2, why: 'The left subtree is printed in full just before the node, and the last one of it is its rightmost node: the in-order predecessor.' },
      { q: 'How many times does each node appear on the call stack as the running call?', options: ['Once', 'Twice', 'Three times', 'It depends'], answer: 0, why: 'Each node gets exactly one call. That call is paused twice (during the left and the right call), but it is still one frame.' },
      { q: 'Pre-order and in-order lists of the same tree are given. Can the tree be rebuilt?', options: ['Yes, if keys are distinct', 'No, never', 'Only for full trees', 'Only with post-order too'], answer: 0, why: 'Pre-order gives the root; finding it in the in-order list splits the rest into the left and right subtrees, and so on.' },
    ],
    compareWith: 'bt-inorder-iter',
  });

  recursiveTopic({
    id: 'bt-postorder', order: 12, kind: 'post', fname: 'postorder', title: 'Post-order (recursive)',
    blurb: 'Both subtrees first, the node last. The walk prints each node on its way back up, as it passes the node\'s right side.',
    code: `/* print a node after both of its subtrees */
void postorder(struct node *root)
{
    if (root == NULL)                  /*@ base */
        return;                        /*@ null */
    postorder(root->left);             /*@ walk-left */
    postorder(root->right);            /*@ walk-right */
    printf("%d ", root->key);          /*@ visit */
}                                      /*@ done */`,
    predict: [
      { at: (t, i) => i === 0 && t.data.root, once: true, ask: 'Which node is printed first? Click it.', answer: (ts, i) => 'n' + nextVisit(ts, i, 'postorder'), explain: () => 'Go left whenever possible, otherwise right, until a leaf: nothing can be printed before a node with no children.' },
      { at: (t, i, ts) => t.tag === 'visit' && visitsSoFar(ts, i) === 1 && nextVisit(ts, i, 'postorder'), once: true, ask: 'Which node will be printed last of all? Click it.', answer: (ts) => 'n' + ts[0].data.root, explain: () => 'The root: its call can only print after both of its subtrees are completely finished.' },
      { at: (t, i, ts) => t.tag === 'visit' && visitsSoFar(ts, i) === 3 && nextVisit(ts, i, 'postorder'), once: true, ask: 'Which node will be printed next? Click it.', answer: (ts, i) => 'n' + nextVisit(ts, i, 'postorder'), explain: () => 'Look at the node waiting on top of the stack: if its right subtree is done it is next; otherwise the first node of that right subtree is.' },
    ],
    quiz: [
      { q: 'In a post-order listing, which key always comes last?', options: ['The largest key', 'The root', 'The rightmost leaf', 'The deepest node'], answer: 1, why: 'The root\'s call prints only after both of its subtrees are completely done.' },
      { q: 'To free every node of a tree, which order is safe?', options: ['Pre-order', 'In-order', 'Post-order', 'Any order'], answer: 2, why: 'A node is freed only after its children, so its left and right pointers are still valid when the children are reached.' },
      { q: 'The tree has root 1, left child 2, right child 3, and 2 has a left child 4. Post-order gives...', options: ['4 2 3 1', '1 2 4 3', '4 2 1 3', '2 4 3 1'], answer: 0, why: 'The left subtree (4, then 2), then the right subtree (3), then the root 1.' },
      { q: 'An expression tree (+ at the root, 2 and * below, * having 3 and 4) printed in post-order is...', options: ['+ 2 * 3 4', '2 + 3 * 4', '2 3 4 * +', '3 4 * 2 +'], answer: 2, why: 'Post-order of an expression tree is reverse Polish notation: operands before their operator.' },
      { q: 'Pre-order, in-order and post-order differ in...', options: ['The nodes they reach', 'The order of the recursive calls', 'Where the print is, relative to the two calls', 'How much stack they use'], answer: 2, why: 'All three make exactly the same calls in the same order; only the line that prints moves.' },
    ],
    compareWith: 'bt-postorder-iter',
  });

  // ---- iterative traversals: the stack is out in the open ----------------------------------------------
  const STACK_X = (geo) => geo.maxX + 120;
  const STACK_Y = (geo) => Math.max(geo.maxY, 92 * 3) + 10;

  /** Track cur, and where it fell off the tree when it is NULL */
  function curSpot(ctx, cur) {
    const m = ctx.memo;
    const tag = ctx.tick.tag;
    if (cur) { m.lastCur = cur; m.fell = null; return null; }
    if (cur === 0 && m.lastCur && (tag === 'go-left' || tag === 'go-right')) m.fell = { a: m.lastCur, side: tag === 'go-left' ? 'left' : 'right' };
    return m.fell;
  }

  // in-order with a stack
  X.topic({
    id: 'bt-inorder-iter', family: 'bt', order: 20, title: 'In-order with a stack',
    blurb: 'The same order as the recursive version, but the waiting nodes sit on a stack you can see: dive left pushing every node, pop one, print it, then turn right.',
    code: `/* in-order without recursion: the stack holds the nodes still waiting
   for their turn, the ones whose left subtree is being printed */
void inorder_iter(struct node *root)
{
    struct node *stack[MAXN];
    int top = -1;
    struct node *cur = root;               /*@ start */
    while (cur != NULL || top >= 0) {      /*@ loop */
        while (cur != NULL) {              /*@ dive */
            stack[++top] = cur;            /*@ push */
            cur = cur->left;               /*@ go-left */
        }
        cur = stack[top--];                /*@ pop */
        printf("%d ", cur->key);           /*@ visit */
        cur = cur->right;                  /*@ go-right */
    }
}`,
    animate: ['inorder_iter'], inputs: [X.btTree], presets: X.btPresets,
    counters: ['follows'],
    main: (inp) => X.btMain(inp.tree, 'inorder_iter(root);'),
    capture: B.capture({ vars: ['top', 'cur'], arrs: [['stack', (v) => (v.top === null ? 0 : v.top + 1)]] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, m = ctx.memo, v = d.vars;
      const geo = B.geometry(ctx);
      m.printed = m.printed || [];
      const stack = d.arrs.stack || [];
      const cur = v.cur;
      if (tag === 'visit') m.printed.push(cur);
      const fell = curSpot(ctx, cur);
      m.maxStack = Math.max(m.maxStack || 0, stack.length);
      const onStack = new Set(stack);
      const printed = new Set(m.printed);
      const items = B.tree(geo, { cls: (a) => (a === cur && !ctx.tick.after ? 'focus' : '') + (printed.has(a) ? ' done' : '') + (onStack.has(a) ? ' bt-onstack' : '') });
      if (fell && !ctx.tick.after) items.push(...B.nullSpots(geo, fell).filter((it) => it.key === 'z' + fell.a + fell.side || it.key === 'zt'));
      if (cur && geo.pos.has(cur) && !ctx.tick.after) items.push({ key: 'ccur', kind: 'cursor', at: 'n' + cur, side: 'left', text: 'cur', cls: 'c-teal' });
      else if (fell && !ctx.tick.after) { const s = B.nullSpot(geo, fell.a, fell.side); items.push({ key: 'ccur', kind: 'cursor', x: s.x - 12, y: s.y, tx: s.x - 52, ty: s.y, text: 'cur', cls: 'c-teal' }); }
      // the stack, and the card being printed
      const sx = STACK_X(geo), sy = STACK_Y(geo);
      items.push(...B.stack(geo, stack, { x: sx, yBase: sy, title: 'stack', topName: 'top', prefix: 'k' }));
      items.push(...B.held(geo, tag === 'pop' ? cur : null, { x: sx + 120, y: sy, title: 'popped', prefix: 'k' }));
      items.push(...B.output(geo, m.printed, { aligned: true, prefix: 'k' }));
      const nm = (a) => B.key(geo, a);
      let say = '';
      switch (tag) {
        case 'enter': say = geo.n ? 'inorder_iter(root): no recursion this time. The stack plays the part of the call stack: it holds the nodes that are waiting to be printed.' : 'inorder_iter(root) with an empty tree.'; break;
        case 'start': say = geo.n ? 'cur starts at the root, ' + nm(cur) + '. The stack is empty (top = -1).' : 'cur = root, which is NULL.'; break;
        case 'loop': say = cur ? 'cur is ' + nm(cur) + ': there is a subtree to deal with.' : stack.length ? 'cur is NULL, but ' + plural(stack.length, 'node') + ' still wait on the stack.' : 'cur is NULL and the stack is empty: every node has been printed.'; break;
        case 'dive': say = cur ? 'cur is ' + nm(cur) + ', not NULL: keep going down to the left.' : 'cur is NULL: there is nothing further left. The node on top of the stack, ' + nm(stack[stack.length - 1]) + ', has no unprinted left subtree any more.'; break;
        case 'push': say = 'Push ' + nm(cur) + ': it cannot be printed yet, because its left subtree comes first. It waits on the stack.'; break;
        case 'go-left': say = cur ? 'cur = cur->left: down to ' + nm(cur) + '.' : 'cur = cur->left: ' + nm(m.lastCur) + ' has no left child, so cur becomes NULL.'; break;
        case 'pop': say = 'Pop ' + nm(cur) + ' off the top. Everything to its left is already printed, so it is its turn.'; break;
        case 'visit': say = 'Print ' + nm(cur) + '. Its key drops into its own column, as in the recursive version.'; break;
        case 'go-right': say = cur ? 'cur = cur->right: ' + nm(cur) + '. Its right subtree gets the same treatment: dive left from there.' : nm(m.lastCur) + ' has no right child: cur is NULL, so the next node comes off the stack.'; break;
        case 'after': say = geo.n ? 'Output: ' + m.printed.map(nm).join(' ') + ', the same as the recursive in-order. The stack never held more than ' + plural(m.maxStack, 'node') + ' here, never more than the height of the tree (' + geo.height + '), just like the call stack of the recursive version.' : 'Nothing to print.'; break;
      }
      return { items, say, slow: tag === 'pop' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'dive' && t.data.vars.cur === 0 && ts[i + 1] && ts[i + 1].tag === 'pop' && t.data.arrs.stack.length >= 2, once: true, ask: 'cur is NULL. Which node comes off the stack next? Click it.', answer: (ts, i) => { const st = ts[i].data.arrs.stack; return 'n' + st[st.length - 1]; }, explain: () => 'The one on top: the last node pushed, the deepest one on the current path to the left.' },
      { at: (t, i, ts) => t.tag === 'go-right' && t.data.vars.cur && ts.slice(i + 1).some((x) => x.tag === 'visit'), once: true, ask: 'cur has moved into a right subtree. Which node will be printed next? Click it.', answer: (ts, i) => { for (let j = i + 1; j < ts.length; j++) if (ts[j].tag === 'visit') return 'n' + ts[j].data.vars.cur; return null; }, explain: () => 'The leftmost node of that right subtree: the dive goes left as far as it can before anything is printed.' },
    ],
    quiz: [
      { q: 'What does the stack in inorder_iter hold?', options: ['Nodes already printed', 'Nodes whose left subtree is still being printed', 'All the leaves', 'The right children'], answer: 1, why: 'A node is pushed on the way down and popped when everything to its left is done: exactly the calls that would be paused in the recursive version.' },
      { q: 'At most how many nodes are on the stack at once?', options: ['n', 'The height of the tree', 'The number of leaves', '2'], answer: 1, why: 'The stack holds one path going left from some node, never more than the height.' },
      { q: 'Why is the loop condition cur != NULL || top >= 0?', options: ['To print NULL', 'Work remains if there is a subtree to start or a node waiting on the stack', 'To avoid a stack overflow', 'It could be just top >= 0'], answer: 1, why: 'After printing the last node of a left part, cur may be NULL while nodes still wait; after a pop, the stack may be empty while cur has a right subtree.' },
      { q: 'How many times is each node pushed?', options: ['Never', 'Once', 'Twice', 'Once per child'], answer: 1, why: 'Each node is pushed once, during a dive, and popped once, when it is printed: O(n) work in total.' },
    ],
    compareWith: 'bt-inorder',
  });

  // pre-order with a stack
  X.topic({
    id: 'bt-preorder-iter', family: 'bt', order: 21, title: 'Pre-order with a stack',
    blurb: 'Pop a node, print it, push its children. The right child goes in first, so that the left one comes out first.',
    code: `/* pre-order without recursion: pop, print, push the children */
void preorder_iter(struct node *root)
{
    struct node *stack[MAXN];
    int top = -1;
    struct node *cur;
    if (root == NULL)                      /*@ empty */
        return;                            /*@ none */
    stack[++top] = root;                   /*@ push-root */
    while (top >= 0) {                     /*@ loop */
        cur = stack[top--];                /*@ pop */
        printf("%d ", cur->key);           /*@ visit */
        if (cur->right != NULL)            /*@ test-right */
            stack[++top] = cur->right;     /*@ push-right */
        if (cur->left != NULL)             /*@ test-left */
            stack[++top] = cur->left;      /*@ push-left */
    }
}`,
    animate: ['preorder_iter'], inputs: [X.btTree], presets: X.btPresets,
    main: (inp) => X.btMain(inp.tree, 'preorder_iter(root);'),
    capture: B.capture({ vars: ['top', 'cur'], arrs: [['stack', (v) => (v.top === null ? 0 : v.top + 1)]] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, m = ctx.memo, v = d.vars;
      const geo = B.geometry(ctx);
      m.printed = m.printed || [];
      const stack = d.arrs.stack || [];
      const cur = v.cur;
      if (tag === 'visit') m.printed.push(cur);
      const onStack = new Set(stack);
      const printed = new Set(m.printed);
      const node = cur && geo.by.get(cur);
      const kidL = node && (tag === 'test-left' || tag === 'push-left') ? node.links.left : 0;
      const kidR = node && (tag === 'test-right' || tag === 'push-right') ? node.links.right : 0;
      const items = B.tree(geo, {
        cls: (a) => (a === cur && !ctx.tick.after ? 'focus' : '') + (printed.has(a) ? ' done' : '') + (onStack.has(a) ? ' bt-onstack' : '') + (a === kidL || a === kidR ? ' hot' : ''),
        edgeCls: (a, side) => (a === cur && ((side === 'left' && kidL) || (side === 'right' && kidR)) ? 'hot' : ''),
      });
      if (cur && geo.pos.has(cur) && !ctx.tick.after) items.push({ key: 'ccur', kind: 'cursor', at: 'n' + cur, side: 'left', text: 'cur', cls: 'c-teal' });
      const sx = STACK_X(geo), sy = STACK_Y(geo);
      items.push(...B.stack(geo, stack, { x: sx, yBase: sy, title: 'stack', topName: 'top', prefix: 'k' }));
      items.push(...B.held(geo, tag === 'pop' ? cur : null, { x: sx + 120, y: sy, title: 'popped', prefix: 'k' }));
      items.push(...B.output(geo, m.printed, { prefix: 'k' }));
      // the order of the two pushes, spelled out next to the stack
      if (node && /right|left/.test(tag) && !ctx.tick.after) {
        items.push({ key: 'pushnote', kind: 'text', x: sx + 22, y: sy - Math.max(1, stack.length) * 50 - 14, anchor: 'middle', text: tag.includes('right') ? 'right child first: it must come out last' : 'left child last: it comes out first', cls: 'bt-hot' });
      }
      const nm = (a) => B.key(geo, a);
      let say = '';
      switch (tag) {
        case 'enter': say = geo.n ? 'preorder_iter(root): the stack holds nodes that have been found but not yet printed.' : 'preorder_iter(root) with an empty tree.'; break;
        case 'empty': say = geo.n ? 'The tree is not empty.' : 'root is NULL: there is nothing to print.'; break;
        case 'none': say = 'Return at once.'; break;
        case 'push-root': say = 'Push the root, ' + nm(d.root) + '. It is the first node pre-order prints.'; break;
        case 'loop': say = stack.length ? 'The stack holds ' + B.keys(geo, stack) + ' (top on the right): keep going.' : 'The stack is empty: every node has been printed.'; break;
        case 'pop': say = 'Pop the top: ' + nm(cur) + '.'; break;
        case 'visit': say = 'Print ' + nm(cur) + ' straight away, before anything below it. That is what makes this pre-order.'; break;
        case 'test-right': say = node.links.right ? nm(cur) + ' has a right child, ' + nm(node.links.right) + '.' : nm(cur) + ' has no right child.'; break;
        case 'push-right': say = 'Push the right child ' + nm(node.links.right) + ' first. It goes underneath, so it will come out after the whole left subtree.'; break;
        case 'test-left': say = node.links.left ? nm(cur) + ' has a left child, ' + nm(node.links.left) + '.' : nm(cur) + ' has no left child.'; break;
        case 'push-left': say = 'Push the left child ' + nm(node.links.left) + ' last, so it is on top and is popped next.'; break;
        case 'after': say = geo.n ? 'Output: ' + m.printed.map(nm).join(' ') + ', the same as the recursive pre-order. Swap the two if-blocks and you would get root, right, left instead.' : 'Nothing to print.'; break;
      }
      return { items, say, slow: tag === 'push-left' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'loop' && t.data.arrs.stack.length >= 2, once: true, ask: 'Which node will be popped and printed next? Click it.', answer: (ts, i) => { const s = ts[i].data.arrs.stack; return 'n' + s[s.length - 1]; }, explain: () => 'The top of the stack: the left child pushed last.' },
      { at: (t) => t.tag === 'visit' && t.data.nodes.some((n) => n.addr === t.data.vars.cur && n.links.left && n.links.right), once: true, ask: 'Both children of this node will be pushed. Which should go in first?', options: () => ['The right child', 'The left child', 'It does not matter'], answer: () => 'The right child', pick: 'option', explain: () => 'A stack gives back the last thing pushed. To print the left subtree first, the left child must be pushed last.' },
    ],
    quiz: [
      { q: 'Why is the right child pushed before the left one?', options: ['Right children are more important', 'So the left child is on top and popped first', 'To keep the stack small', 'It is a convention with no effect'], answer: 1, why: 'Last in, first out: the child pushed last is popped next, and pre-order wants the left subtree first.' },
      { q: 'If the two pushes were swapped (left first, then right), the output would be...', options: ['Post-order', 'Root, right subtree, left subtree', 'In-order', 'Unchanged'], answer: 1, why: 'Each node is still printed before its children, but the right subtree now comes out first.' },
      { q: 'How many times is each node pushed?', options: ['Once', 'Twice', 'Up to three times', 'Never'], answer: 0, why: 'A node is pushed by its parent (or as the root) once and popped once.' },
      { q: 'With a queue instead of a stack (and left pushed before right), this loop would print...', options: ['Pre-order', 'Level order', 'Post-order', 'In-order'], answer: 1, why: 'First in, first out takes the nodes in the order they were found: one level after another.' },
    ],
    compareWith: 'bt-preorder',
  });

  // post-order with two stacks
  X.topic({
    id: 'bt-postorder-iter', family: 'bt', order: 22, title: 'Post-order with two stacks',
    blurb: 'The first stack produces root, right, left: exactly post-order backwards. A second stack turns it round.',
    code: `/* post-order without recursion: s1 yields root-right-left, and s2
   reverses that into left-right-root */
void postorder_iter(struct node *root)
{
    struct node *s1[MAXN], *s2[MAXN];
    int top1 = -1, top2 = -1;
    struct node *cur;
    if (root == NULL)                      /*@ empty */
        return;                            /*@ none */
    s1[++top1] = root;                     /*@ push-root */
    while (top1 >= 0) {                    /*@ loop1 */
        cur = s1[top1--];                  /*@ pop1 */
        s2[++top2] = cur;                  /*@ move */
        if (cur->left != NULL)             /*@ test-left */
            s1[++top1] = cur->left;        /*@ push-left */
        if (cur->right != NULL)            /*@ test-right */
            s1[++top1] = cur->right;       /*@ push-right */
    }
    while (top2 >= 0) {                    /*@ loop2 */
        cur = s2[top2--];                  /*@ pop2 */
        printf("%d ", cur->key);           /*@ visit */
    }
}`,
    animate: ['postorder_iter'], inputs: [X.btTree], presets: X.btPresets,
    counters: ['moves'],
    main: (inp) => X.btMain(inp.tree, 'postorder_iter(root);'),
    capture: B.capture({ vars: ['top1', 'top2', 'cur'], arrs: [['s1', (v) => (v.top1 === null ? 0 : v.top1 + 1)], ['s2', (v) => (v.top2 === null ? 0 : v.top2 + 1)]] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, m = ctx.memo, v = d.vars;
      const geo = B.geometry(ctx);
      m.printed = m.printed || [];
      const s1 = d.arrs.s1 || [], s2 = d.arrs.s2 || [];
      const cur = v.cur;
      if (tag === 'visit') m.printed.push(cur);
      const in1 = new Set(s1), in2 = new Set(s2), printed = new Set(m.printed);
      const phase2 = ['loop2', 'pop2', 'visit', 'after'].includes(tag) && !in1.size;
      const node = cur && geo.by.get(cur);
      const items = B.tree(geo, { cls: (a) => (a === cur && !ctx.tick.after ? 'focus' : '') + (printed.has(a) ? ' done' : in2.has(a) ? ' bt-waiting' : '') + (in1.has(a) ? ' bt-onstack' : '') });
      if (cur && geo.pos.has(cur) && !ctx.tick.after) items.push({ key: 'ccur', kind: 'cursor', at: 'n' + cur, side: 'left', text: 'cur', cls: 'c-teal' });
      const sx = STACK_X(geo), sy = STACK_Y(geo);
      const heldNow = tag === 'pop1' || tag === 'pop2' ? cur : null;
      items.push(...B.stack(geo, s1, { x: sx, yBase: sy, title: 's1', topName: 'top1', prefix: 'k', id: 'a' }));
      items.push(...B.held(geo, heldNow, { x: sx + 110, y: sy - 140, title: 'cur', prefix: 'k' }));
      items.push(...B.stack(geo, s2, { x: sx + 220, yBase: sy, title: 's2', topName: 'top2', prefix: 'k', id: 'b' }));
      items.push(...B.output(geo, m.printed, { prefix: 'k' }));
      // s2 read from the bottom: root, right, left order so far
      if (s2.length && !phase2) items.push({ key: 's2note', kind: 'text', x: sx + 110, y: sy - 5 * 50 - 30, text: 's2 from the bottom: ' + B.keys(geo, s2), cls: 'bt-note', anchor: 'middle' });
      const nm = (a) => B.key(geo, a);
      let say = '';
      switch (tag) {
        case 'enter': say = geo.n ? 'postorder_iter(root): two stacks. s1 finds the nodes, s2 collects them in the reverse of post-order.' : 'postorder_iter(root) with an empty tree.'; break;
        case 'empty': say = geo.n ? 'The tree is not empty.' : 'root is NULL: nothing to print.'; break;
        case 'none': say = 'Return at once.'; break;
        case 'push-root': say = 'Push the root, ' + nm(d.root) + ', onto s1.'; break;
        case 'loop1': say = s1.length ? 's1 still holds ' + B.keys(geo, s1) + '.' : 's1 is empty. s2, read from the top down, is now post-order: ' + B.keys(geo, s2.slice().reverse()) + '.'; break;
        case 'pop1': say = 'Pop ' + nm(cur) + ' from s1.'; break;
        case 'move': say = 'Push ' + nm(cur) + ' onto s2 instead of printing it. Nodes go into s2 as root, right, left, which is post-order read backwards.'; break;
        case 'test-left': say = node.links.left ? nm(cur) + ' has a left child, ' + nm(node.links.left) + '.' : nm(cur) + ' has no left child.'; break;
        case 'push-left': say = 'Push the left child ' + nm(node.links.left) + ' onto s1 first, so it comes out after the right one.'; break;
        case 'test-right': say = node.links.right ? nm(cur) + ' has a right child, ' + nm(node.links.right) + '.' : nm(cur) + ' has no right child.'; break;
        case 'push-right': say = 'Push the right child ' + nm(node.links.right) + ' onto s1: it is on top, so the right subtree reaches s2 before the left one.'; break;
        case 'loop2': say = s2.length ? 's2 still holds ' + plural(s2.length, 'node') + '.' : 's2 is empty: done.'; break;
        case 'pop2': say = 'Pop ' + nm(cur) + ' from s2: the node that went in last comes out first.'; break;
        case 'visit': say = 'Print ' + nm(cur) + '.' + (node && (node.links.left || node.links.right) ? ' Its children are already printed.' : ' It is a leaf.'); break;
        case 'after': say = geo.n ? 'Output: ' + m.printed.map(nm).join(' ') + ', the same as the recursive post-order. The price: a second stack that holds all n nodes.' : 'Nothing to print.'; break;
      }
      return { items, say, slow: tag === 'move' || tag === 'pop2' };
    },
    predict: [
      { at: (t) => t.tag === 'loop1' && t.data.arrs.s1.length === 0 && t.data.arrs.s2.length > 1, once: true, ask: 'Phase two starts. Which node will be printed first? Click it.', answer: (ts, i) => { const s = ts[i].data.arrs.s2; return 'n' + s[s.length - 1]; }, explain: () => 'The top of s2, the last node moved there. Post-order starts with it.' },
      { at: (t) => t.tag === 'move' && t.data.vars.cur === t.data.root, once: true, ask: 'The root is the first node to enter s2. When will it be printed?', options: () => ['First', 'Last', 'In the middle'], answer: () => 'Last', pick: 'option', explain: () => 'It is at the bottom of s2, so it comes out last: post-order prints the root at the very end.' },
    ],
    quiz: [
      { q: 'In what order do nodes enter s2?', options: ['Left, right, root', 'Root, right, left', 'Root, left, right', 'Level by level'], answer: 1, why: 's1 works like the pre-order loop with the children pushed the other way round: root, then right, then left. Reversed, that is post-order.' },
      { q: 'How much extra memory does the two-stack version need?', options: ['O(1)', 'O(height)', 'O(n) for s2', 'O(n²)'], answer: 2, why: 's2 ends up holding every node before anything is printed.' },
      { q: 'A version with one stack must decide, when it sees a node on top again, whether...', options: ['It is a leaf', 'Its right subtree has already been printed', 'It is the root', 'Its key is larger'], answer: 1, why: 'With one stack a node is met twice; it may be printed only when coming back from its right child, which needs a last-visited pointer.' },
      { q: 'Why is the left child pushed onto s1 before the right child?', options: ['So the right one is processed first and lands deeper in s2', 'To print the left child first', 'It does not matter', 'To save memory'], answer: 0, why: 's1 pops the right child first, so the right subtree enters s2 before the left one, and comes out of s2 after it.' },
    ],
    compareWith: 'bt-postorder',
  });
})(SEE);
