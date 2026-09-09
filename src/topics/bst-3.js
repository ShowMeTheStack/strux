// Binary search trees: smallest and biggest key, successor, predecessor, floor and ceiling. These all
// use the sorted strip under the tree: a node sits right above its place in sorted order.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, B = X.BstKit;
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const inTree = (inp) => (inp.keys.includes(inp.key) ? null : 'Pick a key that is in the tree (one of ' + inp.keys.join(', ') + ')');

  // ---- smallest and biggest -----------------------------------------------------------------------------
  X.topic({
    id: 'bst-min-max', family: 'bst', order: 30, title: 'Smallest and biggest key',
    blurb: 'No comparisons at all: the smallest key is as far left as you can go, the biggest as far right.',
    code: `/* the smallest key: keep going left */
struct node *tree_min(struct node *root)
{
    struct node *cur = root;             /*@ start-min */
    if (cur == NULL)                     /*@ empty */
        return NULL;                     /*@ none */
    while (cur->left != NULL)            /*@ test-left */
        cur = cur->left;                 /*@ step-left */
    return cur;                          /*@ found-min */
}

/* the biggest key: keep going right */
struct node *tree_max(struct node *root)
{
    struct node *cur = root;             /*@ start-max */
    if (cur == NULL)                     /*@ empty */
        return NULL;                     /*@ none */
    while (cur->right != NULL)           /*@ test-right */
        cur = cur->right;                /*@ step-right */
    return cur;                          /*@ found-max */
}`,
    animate: ['tree_min', 'tree_max'],
    inputs: [X.bstKeys],
    presets: [
      { label: 'Balanced tree', values: { keys: [50, 30, 70, 20, 40, 60, 80] } },
      { label: 'The root is the smallest', values: { keys: [20, 50, 40, 70, 60] } },
      { label: 'A chain to the left', values: { keys: [50, 40, 30, 20, 10] } },
      { label: 'One node', values: { keys: [42] } },
      { label: 'Empty tree', values: { keys: [] } },
    ],
    main: (inp) => X.bstMain(inp.keys, 'lo = tree_min(root);\n    hi = tree_max(root);\n    if (lo != NULL)\n        printf("smallest %d, biggest %d\\n", lo->key, hi->key);', 'struct node *lo, *hi;'),
    capture: B.capture({ cursors: ['cur', 'lo', 'hi'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo, c = d.cursors;
      memo.lpath = memo.lpath || [];
      memo.rpath = memo.rpath || [];
      const inMax = ctx.tick.fn === 'tree_max' || (tag === 'after' && memo.maxStarted);
      if (ctx.tick.fn === 'tree_max') memo.maxStarted = true;
      if (c.cur) { const pth = ctx.tick.fn === 'tree_max' ? memo.rpath : memo.lpath; if (!pth.includes(c.cur)) pth.push(c.cur); }
      if (tag === 'found-min') memo.min = ctx.prev.data.cursors.cur;
      if (tag === 'found-max') memo.max = ctx.prev.data.cursors.cur;
      const L = new Set(memo.lpath), R = new Set(memo.rpath);
      const pic = B.picture(ctx, d, {
        nodeCls: (n) => (n.addr === memo.min || n.addr === memo.max ? 'done' : n.addr === c.cur ? 'focus' : L.has(n.addr) ? 'part-b' : R.has(n.addr) ? 'part-a' : ''),
        edgeCls: (n, side) => (side === 'left' && L.has(n.addr) && L.has(n.links.left) ? 'bx-left' : side === 'right' && R.has(n.addr) && R.has(n.links.right) ? 'bx-right' : ''),
        showNull: true,
        cursors: [['cur', c.cur], ['lo', c.lo], ['hi', c.hi]],
      });
      const items = pic.items, pos = pic.pos, box = B.box(pos);
      // the keys in sorted order, each right under its node
      const sy = box.y1 + 96;
      if (d.nodes.length) {
        items.push(...B.strip(d, pos, sy, (n) => (n.addr === memo.min || n.addr === memo.max ? 'done' : '')));
        items.push({ key: 'strip-t', kind: 'text', x: box.x0 - 24, y: sy + 62, text: 'the same keys in sorted order: each sits under its node', cls: 'note' });
        for (const [k, a] of [['dropmin', memo.min], ['dropmax', memo.max]]) {
          const p = a && pos.get(a);
          if (p) items.push({ key: k, kind: 'line', x1: p.x, y1: p.y + 26, x2: p.x, y2: sy - 2, cls: 'hot' });
        }
      }
      // the tag in the stage corner: no keys compared
      items.push({ key: 'cmp', kind: 'text', x: box.x0 - 24, y: sy + 86, text: 'keys compared so far: 0', cls: 'bx-a' });
      const at = c.cur && pos.get(c.cur);
      if (at && (tag === 'test-left' || tag === 'test-right')) {
        const n = B.node(d, c.cur), side = tag === 'test-left' ? 'left' : 'right';
        const s = B.nullAt(pos, c.cur, side);
        if (!n.links[side]) items.push({ key: 'nul', kind: 'ring', x: s.x, y: s.y + 8, r: 14, cls: 'bx-null' });
      }
      const nm = (a) => B.name(d, a);
      const n = B.node(d, c.cur);
      let say = '';
      switch (tag) {
        case 'enter': say = 'tree_min(root): where is the smallest key? Smaller keys are always to the left, so the answer is as far left as the tree goes.'; break;
        case 'start-min': say = d.root ? 'cur starts at the root, ' + nm(c.cur) + '.' : 'cur starts as NULL: the tree is empty.'; break;
        case 'start-max': say = 'tree_max(root) does the same thing on the other side. cur starts at the root, ' + nm(c.cur) + ', again.'; break;
        case 'empty': say = c.cur ? 'The tree is not empty.' : 'The tree is empty, so there is no smallest or biggest key.'; break;
        case 'none': say = 'Return NULL: an empty tree has no ' + (inMax ? 'biggest' : 'smallest') + ' key.'; break;
        case 'test-left': say = n.links.left ? n.key + ' has a left child, ' + nm(n.links.left) + ', which is smaller. Keep going.' : n.key + ' has no left child: nothing in the tree is smaller than ' + n.key + '.'; break;
        case 'step-left': say = 'cur = cur->left: down to ' + nm(c.cur) + '. No key was compared; the shape of the tree says where to go.'; break;
        case 'found-min': say = 'The smallest key is ' + nm(memo.min) + ', after ' + plural(memo.lpath.length, 'node') + '. Look at the strip: it is the first in sorted order, right under its node.'; break;
        case 'test-right': say = n.links.right ? n.key + ' has a right child, ' + nm(n.links.right) + ', which is bigger. Keep going.' : n.key + ' has no right child: nothing in the tree is bigger than ' + n.key + '.'; break;
        case 'step-right': say = 'cur = cur->right: down to ' + nm(c.cur) + '.'; break;
        case 'found-max': say = 'The biggest key is ' + nm(memo.max) + ': the last in sorted order. ' + (memo.max === d.root ? 'Here it is the root itself, because the root has no right child.' : 'It may have a left child, but never a right one.'); break;
        case 'after': say = !memo.maxStarted ? 'Back in main, lo holds the node with ' + nm(c.lo) + '.' : d.root ? 'main prints: smallest ' + nm(c.lo) + ', biggest ' + nm(c.hi) + '. Each cost one step per level, and not a single key comparison.' : 'Both are NULL, so main prints nothing.'; break;
      }
      return { items, say, slow: tag === 'found-min' || tag === 'found-max' };
    },
    predict: [
      { at: (t) => t.tag === 'start-min' && !!t.data.cursors.cur, once: true, ask: 'Click the node that tree_min will return.', answer: (ts, i) => { const L = B.inorder(ts[i].data); return L.length ? 'n' + L[0].addr : null; }, explain: () => 'The leftmost node: keep taking left links until there is none.' },
      { at: (t) => t.tag === 'start-max' && !!t.data.cursors.cur, once: true, ask: 'Click the node that tree_max will return.', answer: (ts, i) => { const L = B.inorder(ts[i].data); return L.length ? 'n' + L[L.length - 1].addr : null; }, explain: () => 'The rightmost node. It can be the root, if the root has no right child.' },
    ],
    quiz: [
      { q: 'How many key comparisons does tree_min make?', options: ['None', 'One per level', 'log n', 'n'], answer: 0, why: 'It only tests whether left is NULL. The order rule guarantees that left means smaller.' },
      { q: 'Can the smallest key have a right child?', options: ['No, never', 'Yes', 'Only if it is the root', 'Only in a balanced tree'], answer: 1, why: 'It cannot have a left child, but it can have a right one, holding bigger keys.' },
      { q: 'Keys 20, 50, 40, 70, 60 inserted in that order. Where is the smallest key?', options: ['At the root', 'At the bottom left', 'At the bottom right', 'In the middle'], answer: 0, why: '20 went in first and nothing smaller came after it, so the root has no left child.' },
      { q: 'How long does tree_max take in a tree of height h?', options: ['O(1)', 'O(h)', 'O(n log n)', 'O(n) always'], answer: 1, why: 'One step per level down the right side: at most h steps.' },
    ],
  });

  // ---- successor and predecessor: one scene, mirrored --------------------------------------------------
  // succ: the last node where the search turned left, unless the key has a right subtree.
  // pred: the last node where it turned right, unless the key has a left subtree.
  function neighbourScene(kind) {
    const S = kind === 'succ';
    const near = S ? 'right' : 'left', far = S ? 'left' : 'right';
    const word = S ? 'successor' : 'predecessor';
    const v = S ? 'succ' : 'pred';
    return function scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, memo = ctx.memo, c = d.cursors;
      memo.turns = memo.turns || [];      // [{from, side}]
      memo.path = memo.path || [];
      if (c.cur && !memo.path.includes(c.cur)) memo.path.push(c.cur);
      if ((tag === 'go-left' || tag === 'go-right' || tag === 'into-sub' || tag === 'step') && ctx.prev) memo.turns.push({ from: ctx.prev.data.cursors.cur, side: tag === 'go-left' ? 'left' : tag === 'go-right' ? 'right' : tag === 'into-sub' ? near : far });
      if (tag === 'has-sub') memo.self = c.cur;
      if (tag === 'into-sub') memo.phase2 = true;
      if (tag === 'test-key' && c.cur && B.node(d, c.cur).key === key) memo.self = c.cur;
      if (tag === 'leftmost' || tag === 'ancestor') memo.answer = tag === 'leftmost' ? ctx.prev.data.cursors.cur : ctx.prev.data.cursors[v];
      const self = memo.self || (B.byKey(d, key) || {}).addr;
      const turnCls = (n, side) => { const t = memo.turns.find((u) => u.from === n.addr && u.side === side); return t ? (side === 'left' ? 'bx-left' : 'bx-right') : ''; };
      const done = tag === 'after' || tag === 'leftmost' || tag === 'ancestor';
      const ans = done ? memo.answer : 0;
      const pic = B.picture(ctx, d, {
        nodeCls: (n) => (n.addr === ans ? 'done' : n.addr === self ? 'part-b' : n.addr === c.cur ? 'focus' : memo.path.includes(n.addr) ? 'part-a' : ''),
        edgeCls: turnCls,
        showNull: true,
        cursors: tag === 'after' ? [] : [['cur', c.cur], [v, c[v], 'c-violet']],
      });
      const items = pic.items, pos = pic.pos, box = B.box(pos);
      // the candidate: the last node passed on the far side, waiting in case nothing better turns up
      const cand = c[v];
      if (cand && pos.get(cand) && !done) { const p = pos.get(cand); items.push({ key: 'cand', kind: 'ring', x: p.x, y: p.y, r: 32, cls: 'bx-cand' }); items.push({ key: 'candt', kind: 'text', x: p.x, y: p.y - 40, text: 'candidate', anchor: 'middle', cls: 'bx-b' }); }
      // the key's own subtree on the near side: the answer is at its far end
      const sn = self && B.node(d, self);
      if (sn && (tag === 'has-sub' || memo.phase2) && sn.links[near] && !done) { const z = B.region(pos, B.subtree(d, sn.links[near]), 'zone', 'bx-sub', (S ? 'smallest' : 'biggest') + ' key in here'); if (z) items.push(z); }
      // no near subtree: the key is the far-end key of the answer's subtree
      if (tag === 'ancestor' && memo.answer) { const an = B.node(d, memo.answer); const z = B.region(pos, B.subtree(d, an.links[far]), 'zone', 'bx-sub', key + ' is the ' + (S ? 'biggest' : 'smallest') + ' in here'); if (z) items.push(z); }
      // the strip: the answer is the key's neighbour in sorted order
      const sy = box.y1 + 96;
      const order = B.inorder(d);
      items.push(...B.strip(d, pos, sy, (n) => (n.addr === ans ? 'done' : n.addr === self ? 'part-b' : '')));
      const sp = self && pos.get(self), ap = ans && pos.get(ans);
      if (sp && ap) { items.push({ key: 'nextarrow', kind: 'arrow', from: { x: sp.x, y: sy + 40 }, to: { x: ap.x, y: sy + 40 }, bend: S ? 26 : -26, cls: 'hot', label: '' }); items.push({ key: 'nextlbl', kind: 'text', x: (sp.x + ap.x) / 2, y: sy + 82, text: S ? 'next in order' : 'previous in order', anchor: 'middle', cls: 'bx-hot' }); }
      if (sp && done && !ans) items.push({ key: 'noneT', kind: 'text', x: sp.x, y: sy + 66, text: S ? 'nothing after it' : 'nothing before it', anchor: 'middle', cls: 'bx-bad' });
      const at = c.cur && pos.get(c.cur);
      if (at && (tag === 'compare' || tag === 'test-key') && !done) {
        const n = B.node(d, c.cur);
        items.push({ key: 'tok', kind: 'token', x: at.x + 44, y: at.y - 30, r: 16, text: String(key), cls: 'c-rose' });
        if (tag === 'compare') items.push({ key: 'q', kind: 'text', x: at.x + 66, y: at.y - 25, text: key < n.key ? key + ' < ' + n.key + ': left' : key + ' > ' + n.key + ': right', cls: 'bx-hot' });
      }
      const nm = (a) => B.name(d, a);
      const n = B.node(d, c.cur);
      const total = order.length;
      const idx = order.findIndex((x) => x.key === key);
      let say = '';
      switch (tag) {
        case 'enter': say = word + '(root, ' + key + '): the key that comes just ' + (S ? 'after' : 'before') + ' ' + key + ' in sorted order. In the strip it is the ' + (S ? 'right' : 'left') + ' neighbour of ' + key + '; in the tree it can be far away.'; break;
        case 'start': say = 'cur starts at the root, ' + nm(c.cur) + '.'; break;
        case 'init': say = v + ' = NULL: no candidate yet. Every time the search turns ' + far + ', the node it turns at is ' + (S ? 'bigger' : 'smaller') + ' than ' + key + ' and becomes the new candidate.'; break;
        case 'test-key': say = n.key === key ? 'cur is at ' + key + ': found it. Now, where is its ' + word + '?' : n.key + ' is not ' + key + '; keep searching.'; break;
        case 'compare': say = key < n.key ? key + ' < ' + n.key + ': the search goes left.' : key + ' > ' + n.key + ': the search goes right.'; break;
        case 'remember': say = n.key + ' is ' + (S ? 'bigger' : 'smaller') + ' than ' + key + ', and the search is about to pass it on the ' + far + '. ' + n.key + ' is the best candidate so far: ' + v + ' = ' + n.key + '.'; break;
        case 'go-left': case 'go-right': {
          const turned = tag === (S ? 'go-left' : 'go-right');
          say = 'cur moves ' + (tag === 'go-left' ? 'left' : 'right') + ' to ' + nm(c.cur) + '.' + (turned ? '' : ' A ' + (S ? 'right' : 'left') + ' turn: the node passed is ' + (S ? 'smaller' : 'bigger') + ' than ' + key + ', so it cannot be the ' + word + '. ' + v + ' stays ' + nm(c[v]) + '.');
          break;
        }
        case 'has-sub': say = sn.links[near] ? key + ' has a ' + near + ' subtree. The ' + word + ' is the ' + (S ? 'smallest' : 'biggest') + ' key in it, and the candidate does not matter any more.' : key + ' has no ' + near + ' subtree. Then the ' + word + ' is the candidate: the last node where the search turned ' + far + '.'; break;
        case 'into-sub': say = 'cur steps ' + near + ' once, into the subtree, to ' + nm(c.cur) + '.'; break;
        case 'test-far': say = n.links[far] ? n.key + ' has a ' + far + ' child: something ' + (S ? 'smaller' : 'bigger') + ' is still in the subtree. Keep going ' + far + '.' : n.key + ' has no ' + far + ' child: it is the ' + (S ? 'smallest' : 'biggest') + ' key in the subtree.'; break;
        case 'step': say = 'cur moves ' + far + ' to ' + nm(c.cur) + '.'; break;
        case 'leftmost': say = 'The ' + word + ' of ' + key + ' is ' + nm(memo.answer) + '. In the strip it sits right ' + (S ? 'after' : 'before') + ' ' + key + '.'; break;
        case 'ancestor': say = memo.answer ? 'The ' + word + ' of ' + key + ' is ' + nm(memo.answer) + ', the last ' + far + ' turn. ' + key + ' is the ' + (S ? 'biggest' : 'smallest') + ' key in ' + nm(memo.answer) + '\'s ' + far + ' subtree, so ' + nm(memo.answer) + ' comes next.' : 'The search never turned ' + far + ', so ' + v + ' is still NULL: ' + key + ' is the ' + (S ? 'biggest' : 'smallest') + ' key and has no ' + word + '.'; break;
        case 'after': say = memo.answer ? 'main prints ' + nm(memo.answer) + '. In the sorted strip, ' + key + ' is number ' + (idx + 1) + ' of ' + total + ' and its ' + word + ' is number ' + (idx + (S ? 2 : 0)) + '.' : 'main prints "none".'; break;
      }
      return { items, say, slow: tag === 'leftmost' || tag === 'ancestor' };
    };
  }
  const neighbourCode = (S) => {
    const v = S ? 'succ' : 'pred', near = S ? 'right' : 'left', far = S ? 'left' : 'right', fn = S ? 'successor' : 'predecessor';
    const pad = (s, w) => s + ' '.repeat(Math.max(1, w - s.length));
    const L = (s, tag) => pad(s, 46) + '/*@ ' + tag + ' */';
    return `/* the node with the next ${S ? 'bigger' : 'smaller'} key ${S ? 'after' : 'before'} key, which is in the tree; NULL if none */
struct node *${fn}(struct node *root, int key)
{
${L('    struct node *cur = root;', 'start')}
${L('    struct node *' + v + ' = NULL;', 'init')}
${L('    while (cur->key != key) {', 'test-key')}
${L('        if (' + (S ? 'key < cur->key' : 'key > cur->key') + ') {', 'compare')}
${L('            ' + v + ' = cur;', 'remember')}
${L('            cur = cur->' + far + ';', 'go-' + far)}
        } else
${L('            cur = cur->' + near + ';', 'go-' + near)}
    }
${L('    if (cur->' + near + ' != NULL) {', 'has-sub')}
${L('        cur = cur->' + near + ';', 'into-sub')}
${L('        while (cur->' + far + ' != NULL)', 'test-far')}
${L('            cur = cur->' + far + ';', 'step')}
${L('        return cur;', 'leftmost')}
    }
${L('    return ' + v + ';', 'ancestor')}
}`;
  };
  const neighbourMain = (fn) => (inp) => X.bstMain(inp.keys, 'r = ' + fn + '(root, ' + inp.key + ');\n    if (r != NULL)\n        printf("%d\\n", r->key);\n    else\n        printf("none\\n");', 'struct node *r;');

  X.topic({
    id: 'bst-successor', family: 'bst', order: 31, title: 'In-order successor',
    blurb: 'The next key in sorted order. If the key has a right subtree, it is the leftmost node there; if not, it is the last node where the search turned left.',
    code: neighbourCode(true),
    animate: ['successor'],
    inputs: [Object.assign({}, X.bstKeys, { min: 1 }), { id: 'key', kind: 'int', label: 'Successor of', def: 40, lo: -999, hi: 999 }],
    check: inTree,
    presets: [
      { label: 'No right subtree: go back up', values: { keys: [50, 30, 70, 20, 40, 60, 80], key: 40 } },
      { label: 'Right subtree: its leftmost', values: { keys: [50, 30, 70, 20, 40, 60, 80, 55, 65], key: 50 } },
      { label: 'Deep: many turns', values: { keys: [50, 30, 70, 20, 40, 35, 45, 42, 48], key: 48 } },
      { label: 'The biggest key: none', values: { keys: [50, 30, 70, 20, 40, 60, 80], key: 80 } },
    ],
    main: neighbourMain('successor'),
    capture: B.capture({ cursors: ['cur', 'succ'] }),
    scene: neighbourScene('succ'),
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'has-sub', once: true, ask: (t, ts, i, ctx) => 'Click the node holding the successor of ' + ctx.input.key + '.', answer: (ts) => { for (let j = ts.length - 1; j > 0; j--) if (ts[j].tag === 'leftmost') return 'n' + ts[j - 1].data.cursors.cur; else if (ts[j].tag === 'ancestor') return ts[j - 1].data.cursors.succ ? 'n' + ts[j - 1].data.cursors.succ : null; return null; }, explain: () => 'Right subtree: its leftmost node. No right subtree: the last node where the search went left.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'remember', once: true, ask: 'The search is about to go left past this node. Could this node be the successor?', options: () => ['Yes, it is bigger than the key', 'No, it is smaller', 'Only if it is a leaf'], pick: 'option', answer: () => 'Yes, it is bigger than the key', explain: () => 'Every node passed on a left turn is bigger than the key. The last one passed is the smallest of them so far.' },
    ],
    quiz: [
      { q: 'A key has a right subtree. Where is its successor?', options: ['Its parent', 'The leftmost node of its right subtree', 'Its right child, always', 'The root'], answer: 1, why: 'Everything in the right subtree is bigger; the smallest of those is as far left as the subtree goes.' },
      { q: 'A key has no right subtree. Where is its successor?', options: ['There is none', 'Its left child', 'The last ancestor where the path from the root turned left', 'The root, always'], answer: 2, why: 'The key is then the biggest key in that ancestor\'s left subtree, so the ancestor comes next.' },
      { q: 'Why does a right turn not update succ?', options: ['It does, in another line', 'A node passed on the right is smaller than the key, so it cannot come after it', 'Right turns are rare', 'To save time'], answer: 1, why: 'Going right means key > cur->key: cur comes before the key in sorted order.' },
      { q: 'Which key has no successor?', options: ['The root', 'The biggest key', 'Every leaf', 'The smallest key'], answer: 1, why: 'Nothing comes after the last key in sorted order.' },
    ],
    compareWith: 'bst-predecessor',
  });

  X.topic({
    id: 'bst-predecessor', family: 'bst', order: 32, title: 'In-order predecessor',
    blurb: 'The mirror image of the successor: the rightmost node of the left subtree, or else the last node where the search turned right.',
    code: neighbourCode(false),
    animate: ['predecessor'],
    inputs: [Object.assign({}, X.bstKeys, { min: 1 }), { id: 'key', kind: 'int', label: 'Predecessor of', def: 60, lo: -999, hi: 999 }],
    check: inTree,
    presets: [
      { label: 'No left subtree: go back up', values: { keys: [50, 30, 70, 20, 40, 60, 80], key: 60 } },
      { label: 'Left subtree: its rightmost', values: { keys: [50, 30, 70, 20, 40, 60, 80, 35, 45], key: 50 } },
      { label: 'Deep: many turns', values: { keys: [30, 10, 60, 50, 70, 40, 55, 52], key: 52 } },
      { label: 'The smallest key: none', values: { keys: [50, 30, 70, 20, 40, 60, 80], key: 20 } },
    ],
    main: neighbourMain('predecessor'),
    capture: B.capture({ cursors: ['cur', 'pred'] }),
    scene: neighbourScene('pred'),
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'has-sub', once: true, ask: (t, ts, i, ctx) => 'Click the node holding the predecessor of ' + ctx.input.key + '.', answer: (ts) => { for (let j = ts.length - 1; j > 0; j--) if (ts[j].tag === 'leftmost') return 'n' + ts[j - 1].data.cursors.cur; else if (ts[j].tag === 'ancestor') return ts[j - 1].data.cursors.pred ? 'n' + ts[j - 1].data.cursors.pred : null; return null; }, explain: () => 'Left subtree: its rightmost node. No left subtree: the last node where the search went right.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'go-left' && ts.slice(0, i).some((u) => u.tag === 'remember'), once: true, ask: 'The search is about to turn left. What happens to pred?', options: () => ['It becomes this node', 'It stays as it was', 'It becomes NULL'], pick: 'option', answer: () => 'It stays as it was', explain: () => 'A node passed on a left turn is bigger than the key, so it cannot come before it.' },
    ],
    quiz: [
      { q: 'A key has a left subtree. Where is its predecessor?', options: ['Its left child, always', 'The rightmost node of its left subtree', 'Its parent', 'The smallest key'], answer: 1, why: 'Everything on the left is smaller; the biggest of those is as far right as the subtree goes.' },
      { q: 'Keys 50, 30, 70, 20, 40, 60, 80. What is the predecessor of 60, and where is it?', options: ['40, the root\'s left subtree', '50, the root: the last right turn', '20, the smallest', '70, its parent'], answer: 1, why: '60 has no left child. The search went right at 50 and left at 70, so the last right turn was at 50.' },
      { q: 'How does the code for predecessor differ from successor?', options: ['It is completely different', 'Every left becomes right and every < becomes >', 'It needs parent pointers', 'It is recursive'], answer: 1, why: 'The two are mirror images: swap left and right and the direction of the comparison.' },
      { q: 'Which key has no predecessor?', options: ['The smallest key', 'The root', 'The biggest key', 'Every leaf'], answer: 0, why: 'Nothing comes before the first key in sorted order.' },
    ],
    compareWith: 'bst-successor',
  });

  // ---- floor and ceiling --------------------------------------------------------------------------------
  X.topic({
    id: 'bst-floor-ceil', family: 'bst', order: 33, title: 'Floor and ceiling',
    blurb: 'For a value x that may not be in the tree: the biggest key at most x and the smallest key at least x. Each step of the search pulls one side of the bracket closer.',
    code: `/* floor: the biggest key <= x; ceiling: the smallest key >= x (NULL if there is none) */
void floor_ceil(struct node *root, int x, struct node **fl, struct node **ce)
{
    struct node *cur = root;                  /*@ start */
    *fl = NULL;                               /*@ init-fl */
    *ce = NULL;                               /*@ init-ce */
    while (cur != NULL) {                     /*@ walk */
        if (x == cur->key) {                  /*@ compare-eq */
            *fl = cur;                        /*@ exact-fl */
            *ce = cur;                        /*@ exact-ce */
            return;                           /*@ exact */
        }
        if (x < cur->key) {                   /*@ compare */
            *ce = cur;                        /*@ new-ce */
            cur = cur->left;                  /*@ go-left */
        } else {
            *fl = cur;                        /*@ new-fl */
            cur = cur->right;                 /*@ go-right */
        }
    }
}                                             /*@ done */`,
    animate: ['floor_ceil'],
    inputs: [X.bstKeys, { id: 'x', kind: 'int', label: 'x', def: 45, lo: -999, hi: 999 }],
    presets: [
      { label: 'Between two keys', values: { keys: [50, 30, 70, 20, 40, 60, 80], x: 45 } },
      { label: 'x is in the tree', values: { keys: [50, 30, 70, 20, 40, 60, 80], x: 60 } },
      { label: 'Below every key: no floor', values: { keys: [50, 30, 70, 20, 40, 60, 80], x: 5 } },
      { label: 'Above every key: no ceiling', values: { keys: [50, 30, 70, 20, 40, 60, 80], x: 99 } },
      { label: 'Many steps', values: { keys: [80, 40, 120, 20, 60, 100, 140, 50, 70, 65], x: 67 } },
    ],
    main: (inp) => X.bstMain(inp.keys, 'floor_ceil(root, ' + inp.x + ', &floor_node, &ceil_node);\n    if (floor_node != NULL)\n        printf("floor %d\\n", floor_node->key);\n    else\n        printf("no floor\\n");\n    if (ceil_node != NULL)\n        printf("ceiling %d\\n", ceil_node->key);\n    else\n        printf("no ceiling\\n");', 'struct node *floor_node, *ceil_node;'),
    capture: B.capture({ cursors: ['cur'], extra: (P) => ({ fl: P.isSet('floor_node') ? P.val('floor_node') : undefined, ce: P.isSet('ceil_node') ? P.val('ceil_node') : undefined }) }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, x = ctx.input.x, memo = ctx.memo, c = d.cursors;
      const fl = d.extra.fl, ce = d.extra.ce;
      memo.path = memo.path || [];
      if (c.cur && !memo.path.includes(c.cur)) memo.path.push(c.cur);
      const path = new Set(memo.path);
      const pic = B.picture(ctx, d, {
        nodeCls: (n) => (n.addr === fl && n.addr === ce ? 'done' : n.addr === fl ? 'part-a' : n.addr === ce ? 'part-b' : n.addr === c.cur ? 'focus' : ''),
        edgeCls: (n, side) => (path.has(n.addr) && path.has(n.links[side]) ? 'hot' : ''),
        showNull: true,
        cursors: [['cur', c.cur]],
      });
      const items = pic.items, pos = pic.pos, box = B.box(pos);
      const order = B.inorder(d);
      const sy = box.y1 + 100;
      items.push(...B.strip(d, pos, sy, (n) => (n.addr === fl && n.addr === ce ? 'done' : n.addr === fl ? 'part-a' : n.addr === ce ? 'part-b' : (fl && n.key < B.node(d, fl).key) || (ce && n.key > B.node(d, ce).key) ? 'bx-dim' : '')));
      // where x falls in the sorted strip
      const r = order.filter((n) => n.key < x).length;
      const exactly = order.find((n) => n.key === x);
      let mx;
      if (exactly) mx = pos.get(exactly.addr).x;
      else if (!order.length) mx = 0;
      else if (r === 0) mx = pos.get(order[0].addr).x - 40;
      else if (r === order.length) mx = pos.get(order[order.length - 1].addr).x + 40;
      else mx = (pos.get(order[r - 1].addr).x + pos.get(order[r].addr).x) / 2;
      items.push({ key: 'xline', kind: 'line', x1: mx, y1: sy - 8, x2: mx, y2: sy + 52, cls: 'hot' });
      items.push({ key: 'xlbl', kind: 'text', x: mx, y: sy + 70, text: 'x = ' + x, anchor: 'middle', cls: 'bx-hot' });
      // the bracket: floor and ceiling tags on the strip
      if (fl && pos.get(fl)) items.push({ key: 'cfl', kind: 'cursor', at: 's' + fl, side: 'above', text: 'floor', cls: 'c-green' });
      if (ce && pos.get(ce)) items.push({ key: 'cce', kind: 'cursor', at: 's' + ce, side: ce === fl ? 'below' : 'above', slot: 0, text: 'ceiling', cls: 'c-indigo' });
      const fk = fl ? B.node(d, fl).key : null, ck = ce ? B.node(d, ce).key : null;
      if (fl !== undefined && ce !== undefined) items.push({ key: 'brk', kind: 'text', x: box.x0 - 24, y: sy + 100, text: 'bracket:  ' + (fk === null ? 'none' : fk) + '  <=  ' + x + '  <=  ' + (ck === null ? 'none' : ck), cls: 'bx-big' });
      const at = c.cur && pos.get(c.cur);
      const n = B.node(d, c.cur);
      if (at && ['walk', 'compare-eq', 'compare'].includes(tag)) {
        items.push({ key: 'tok', kind: 'token', x: at.x + 44, y: at.y - 30, r: 16, text: String(x), cls: 'c-rose' });
        if (tag === 'compare') items.push({ key: 'q', kind: 'text', x: at.x + 66, y: at.y - 25, text: x < n.key ? x + ' < ' + n.key + ': new ceiling' : x + ' > ' + n.key + ': new floor', cls: 'bx-hot' });
      }
      const nm = (a) => B.name(d, a);
      let say = '';
      switch (tag) {
        case 'enter': say = 'floor_ceil(root, ' + x + ', ...): find the keys on either side of ' + x + ' in sorted order. The answers go back through the pointers fl and ce.'; break;
        case 'start': say = d.root ? 'cur starts at the root, ' + nm(c.cur) + '.' : 'The tree is empty: cur is NULL.'; break;
        case 'init-fl': say = '*fl = NULL: no floor found yet.'; break;
        case 'init-ce': say = '*ce = NULL: no ceiling found yet. The bracket is open on both sides.'; break;
        case 'walk': say = c.cur ? 'cur is at ' + nm(c.cur) + '.' : 'cur is NULL: the search has fallen off the tree, just where ' + x + ' would go. The bracket is as tight as it gets.'; break;
        case 'compare-eq': say = x === n.key ? x + ' is in the tree: it is its own floor and ceiling.' : n.key + ' is not ' + x + '.'; break;
        case 'exact-fl': case 'exact-ce': say = (tag === 'exact-fl' ? '*fl' : '*ce') + ' = cur: ' + x + '.'; break;
        case 'exact': say = 'Return: floor and ceiling are both ' + x + '.'; break;
        case 'compare': say = x < n.key ? x + ' < ' + n.key + ': ' + n.key + ' is above x, and it is closer than any ceiling so far (everything bigger was passed earlier). Look left for something closer still.' : x + ' > ' + n.key + ': ' + n.key + ' is below x and is the best floor so far. Look right for something closer.'; break;
        case 'new-ce': say = '*ce = cur: the ceiling moves in to ' + n.key + '. Keys above it are greyed in the strip: they can never be the answer now.'; break;
        case 'new-fl': say = '*fl = cur: the floor moves up to ' + n.key + '. Keys below it are greyed in the strip.'; break;
        case 'go-left': case 'go-right': say = 'cur moves ' + (tag === 'go-left' ? 'left' : 'right') + ' to ' + nm(c.cur) + '.'; break;
        case 'done': say = 'The loop ends with floor ' + (fk === null ? 'none' : fk) + ' and ceiling ' + (ck === null ? 'none' : ck) + '. In the strip they are the two keys on either side of ' + x + '.'; break;
        case 'after': say = 'main prints floor ' + (fk === null ? 'none' : fk) + ', ceiling ' + (ck === null ? 'none' : ck) + '. One walk down, ' + plural(memo.path.length, 'node') + ' looked at.'; break;
      }
      return { items, say, slow: tag === 'new-fl' || tag === 'new-ce' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'compare' && !!t.data.cursors.cur, once: true, ask: 'Which side of the bracket does this node move in?', options: () => ['The floor', 'The ceiling'], pick: 'option', answer: (ts, i, ctx) => { const d = ts[i].data; return ctx.input.x < B.node(d, d.cursors.cur).key ? 'The ceiling' : 'The floor'; }, explain: () => 'A key above x is a ceiling candidate, a key below x a floor candidate. Each one met is closer than the last.' },
      { at: (t) => t.tag === 'init-ce' && !!t.data.root, once: true, ask: (t, ts, i, ctx) => 'Before watching: what will the floor of ' + ctx.input.x + ' be?', options: (ts, i, ctx) => { const ks = ctx.input.keys.slice().sort((a, b) => a - b); const below = ks.filter((k) => k <= ctx.input.x); const opts = ['none'].concat(ks.filter((k) => Math.abs(k - ctx.input.x) < 40).slice(0, 3).map(String)); if (below.length && !opts.includes(String(below[below.length - 1]))) opts.push(String(below[below.length - 1])); return opts; }, pick: 'option', answer: (ts, i, ctx) => { const below = ctx.input.keys.filter((k) => k <= ctx.input.x); return below.length ? String(Math.max(...below)) : 'none'; } },
    ],
    quiz: [
      { q: 'The search goes left at node 50 while looking for x = 45. What does that say about 50?', options: ['It is the floor', 'It is a ceiling candidate, closer than any before it', 'Nothing', 'It is the answer for sure'], answer: 1, why: '50 > 45, and every earlier ceiling candidate was bigger than 50 (or the search would not have reached 50).' },
      { q: 'When does the floor stay NULL?', options: ['When x is in the tree', 'When every key is bigger than x', 'When the tree is balanced', 'Never'], answer: 1, why: 'Then the search only ever goes left, and floor is set only on a right turn.' },
      { q: 'How many nodes does floor_ceil look at?', options: ['All of them', 'One per level at most', 'Two per level', 'log n always'], answer: 1, why: 'It is a single search path from the root, updating one side of the bracket at each node.' },
      { q: 'x = 45 is not in the tree and the search ends at NULL. Where are the floor and ceiling?', options: ['Anywhere', 'On the path just walked', 'At the leaves only', 'In the right subtree'], answer: 1, why: 'Both are always nodes on the search path: the last one passed on each side.' },
    ],
  });
})(SEE);
