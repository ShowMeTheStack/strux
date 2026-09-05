// Building trees: from preorder and inorder, from postorder and inorder, and writing a tree out to an
// array (serialize) and reading it back (deserialize).
(function (SEE) {
  'use strict';
  const X = SEE.Strux, T = X.TreeKit, B = X.BtProp;
  const CW = 50;          // array cells, one per column of the tree

  // ---- trees worked out in JavaScript, to place nodes where they will end up ---------------------------
  /** From two traversals: {key: {depth, left, right}} or null when the orders do not fit together */
  const fromOrders = (order, inorder, post) => {
    const out = {};
    let next = post ? order.length - 1 : 0;
    const go = (lo, hi, depth) => {
      if (lo > hi) return null;
      if (next < 0 || next >= order.length) throw new Error('bad');
      const key = order[next];
      next += post ? -1 : 1;
      const k = inorder.indexOf(key);
      if (k < lo || k > hi) throw new Error('bad');
      out[key] = { depth, col: k };
      if (post) { out[key].right = go(k + 1, hi, depth + 1); out[key].left = go(lo, k - 1, depth + 1); }
      else { out[key].left = go(lo, k - 1, depth + 1); out[key].right = go(k + 1, hi, depth + 1); }
      return key;
    };
    try { go(0, inorder.length - 1, 0); } catch (e) { return null; }
    return out;
  };
  const ordersCheck = (a, b, nameA, post) => {
    if (!a.length) return nameA + ': give at least one key';
    if (a.length > 12) return 'at most 12 keys, so the arrays and the tree fit';
    if (a.length !== b.length) return 'both orders must have the same number of keys';
    if (a.some((v) => v < 0 || v > 99) || b.some((v) => v < 0 || v > 99)) return 'keys from 0 to 99';
    if (new Set(a).size !== a.length || new Set(b).size !== b.length) return 'each key only once: with repeated keys the tree cannot be told from its orders';
    if ([...a].sort((x, y) => x - y).join() !== [...b].sort((x, y) => x - y).join()) return 'both orders must hold the same keys';
    const t = fromOrders(a, b, post);
    if (!t) return 'these two orders cannot come from the same tree';
    if (Math.max(...Object.values(t).map((n) => n.depth)) > 5) return 'that tree is more than 6 levels deep; pick one that fits on the screen';
    return null;
  };
  const cell = (key, x, y, text, cls, sub, extra) => Object.assign({ key, kind: 'cell', x: x - CW / 2, y, w: CW, h: CW, text, sub: sub === undefined ? '' : sub, cls: cls || '' }, extra || {});
  const zone = (key, i0, i1, y, cls) => (i1 < i0 ? null : { key, kind: 'region', x: i0 * B.DX - CW / 2 - 5, y: y - 5, w: (i1 - i0) * B.DX + CW + 10, h: CW + 10, cls });

  /** The shared scene of the two "build from traversals" topics */
  const buildScene = (post) => (ctx) => {
    const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo, inp = ctx.input;
    const order = post ? inp.post : inp.pre, inorder = inp.inorder;
    const shape = memo.shape || (memo.shape = fromOrders(order, inorder, post));
    const fr = B.frames(ctx, 'build', 'lo', ['go-left'], ['go-right']);
    const top = fr[fr.length - 1] || null;
    const v = top ? top.vars : {};
    const key = B.keyOf(d);
    // every node sits in the column of its key in the inorder array, at its depth
    const pos = new Map();
    for (const n of d.nodes) { const s = shape[n.key]; if (s) pos.set(n.addr, { x: s.col * B.DX, y: s.depth * B.DY, depth: s.depth }); }
    const yIn = -180, yOrd = -285;
    const ordName = post ? 'post' : 'pre';
    const nodeOf = (a) => d.nodes.find((n) => n.addr === a);
    const curRoot = top && top.vars.root ? top.vars.root : 0;
    const rootKey = curRoot && nodeOf(curRoot) ? nodeOf(curRoot).key : null;
    const split = rootKey !== null && v.k !== undefined && inorder[v.k] === rootKey ? v.k : null;
    const pic = T.picture(ctx, d, {
      pos, rootName: 'tree',
      nodeCls: (n) => 'bp-lab ' + (n.addr === curRoot ? 'focus' : fr.some((f) => f.vars.root === n.addr) ? 'part-b' : ''),
    });
    const items = pic.items;
    // a new node comes down from the cell it was read from
    const nextIdx = post ? null : d.extra.next;
    for (const it of items) {
      if (it.kind === 'vertex' && it.enter === 'drop') {
        const n = nodeOf(+it.key.slice(1));
        const i = n ? order.indexOf(n.key) : -1;
        if (i >= 0) { it.enter = 'fly'; it.from = { x: i * B.DX, y: yOrd + CW / 2 }; }
      }
    }
    // the inorder array: the range of this call, split around its root
    items.push({ key: 'lbl-in', kind: 'text', x: -B.DX + 4, y: yIn + CW / 2 + 5, text: 'in', anchor: 'end', cls: 'bp-title' });
    items.push({ key: 'lbl-ord', kind: 'text', x: -B.DX + 4, y: yOrd + CW / 2 + 5, text: ordName, anchor: 'end', cls: 'bp-title' });
    const inRange = (i) => top && v.lo !== undefined && i >= v.lo && i <= v.hi;
    inorder.forEach((k, i) => {
      let cls = inRange(i) ? '' : 'bp-used';
      if (split !== null && i === split) cls = 'bp-root';
      else if (inRange(i) && split === null && v.k === i && tag !== 'empty') cls = 'bp-next';
      items.push(cell('in' + i, i * B.DX, yIn, k, cls, i));
    });
    if (top && v.lo !== undefined) {
      if (split !== null) {
        const za = zone('zin-a', v.lo, split - 1, yIn, 'bp-zone-a'), zb = zone('zin-b', split + 1, v.hi, yIn, 'bp-zone-b');
        if (za) items.push(za);
        if (zb) items.push(zb);
      } else if (v.lo <= v.hi) items.push(zone('zin-x', v.lo, v.hi, yIn, 'bp-zone-x'));
      if (v.k !== undefined && v.k >= v.lo && v.k <= v.hi && tag !== 'ret') items.push({ key: 'ck', kind: 'cursor', at: 'in' + v.k, side: 'below', text: 'k', cls: 'c-amber' });
    }
    // the other order: pre[] is used up from the left; post[] ranges shrink, the root is the last of each
    order.forEach((k, i) => {
      let cls = '';
      if (!post) cls = i < nextIdx ? 'bp-used' : i === nextIdx ? 'bp-next' : '';
      else if (top && v.plo !== undefined) {
        cls = i < v.plo || i > v.phi ? 'bp-used' : i === v.phi && v.lo <= v.hi ? 'bp-root' : '';
      }
      items.push(cell('o' + i, i * B.DX, yOrd, k, cls, i));
    });
    if (!post && nextIdx !== null && nextIdx < order.length) items.push({ key: 'cnext', kind: 'cursor', at: 'o' + nextIdx, side: 'above', text: 'next', cls: 'c-rose' });
    if (post && top && v.plo !== undefined && v.lo <= v.hi) {
      if (v.nleft !== undefined) {
        const za = zone('zpo-a', v.plo, v.plo + v.nleft - 1, yOrd, 'bp-zone-a'), zb = zone('zpo-b', v.plo + v.nleft, v.phi - 1, yOrd, 'bp-zone-b');
        if (za) items.push(za);
        if (zb) items.push(zb);
      } else items.push(zone('zpo-x', v.plo, v.phi, yOrd, 'bp-zone-x'));
    }
    // the column guide: the root's place in the inorder array is its place across the tree
    if (curRoot && pos.get(curRoot) && split !== null) {
      const p = pos.get(curRoot);
      items.push({ key: 'guide', kind: 'line', x1: p.x, y1: yIn + CW + 20, x2: p.x, y2: p.y - 30, cls: 'bp-dashed' });
    }
    if (top && v.lo !== undefined && v.lo > v.hi && fr.length > 1) {
      const par = fr[fr.length - 2].vars.root;
      if (par && pos.get(par)) items.push(...B.nullSpot(pos, { node: 0, parent: par, side: top.side }, 'hot'));
    }
    items.push(...B.stack(fr, (f) => [
      { text: 'build(' + f.vars.lo + ', ' + f.vars.hi + ')', w: 2.2 },
      { text: f.vars.root ? 'root ' + key(f.vars.root) : '', w: 1.4, cls: 'link' },
      { text: f.vars.k !== undefined && f.vars.root ? 'k ' + f.vars.k : '', w: 0.9, cls: 'link' },
    ], { w: 270, x: -380 }));
    const range = (a, b) => (a > b ? 'nothing' : a === b ? 'in[' + a + '] = ' + inorder[a] : 'in[' + a + '..' + b + '] = ' + inorder.slice(a, b + 1).join(' '));
    const parent = fr.length > 1 ? fr[fr.length - 2].vars : null;
    let say = '';
    switch (tag) {
      case 'enter': say = post ? 'The last key of the postorder is the root. Find it in the inorder: what is left of it is the left subtree, what is right of it the right subtree. Then the same again, smaller.' : 'The first key of the preorder is the root. Find it in the inorder: what is left of it is the left subtree, what is right of it the right subtree. Then the same again, smaller.'; break;
      case 'empty': say = v.lo > v.hi ? 'The range is empty (lo = ' + v.lo + ' > hi = ' + v.hi + '): there is no subtree here.' : 'This call builds the tree for ' + range(v.lo, v.hi) + '.'; break;
      case 'none': say = 'It returns NULL.'; break;
      case 'take': say = post ? 'Its root is the last key of its part of post[]: post[' + v.phi + '] = ' + rootKey + '. A new node is made for it.' : 'Its root is the next unused key of the preorder: pre[' + (nextIdx) + '] = ' + rootKey + '. A new node is made for it.'; break;
      case 'advance': say = 'next moves on to ' + nextIdx + ', so the following call takes the following preorder key.'; break;
      case 'scan-start': say = 'Now find ' + rootKey + ' in the inorder range, starting at k = ' + v.lo + '.'; break;
      case 'scan': say = inorder[v.k] === rootKey ? 'in[' + v.k + '] is ' + rootKey + ': found. Left of it, ' + range(v.lo, v.k - 1) + '; right of it, ' + range(v.k + 1, v.hi) + '.' : 'in[' + v.k + '] = ' + inorder[v.k] + ', not ' + rootKey + '.'; break;
      case 'step': say = 'k moves on to ' + v.k + '.'; break;
      case 'count': say = 'nleft = ' + v.nleft + ': the left subtree has ' + v.nleft + ' key' + (v.nleft === 1 ? '' : 's') + ', so in this part of post[] the left subtree fills the first ' + (v.nleft === 1 ? 'place' : v.nleft + ' places') + ' and the right subtree the rest, just before the root.'; break;
      case 'go-left': say = parent ? 'The left subtree of ' + key(parent.root) + ' is built from ' + range(v.lo, v.hi) + '.' : ''; break;
      case 'go-right': say = parent ? 'The left subtree of ' + key(parent.root) + ' is done' + (post ? '' : '') + '. Its right subtree is built from ' + range(v.lo, v.hi) + '.' : ''; break;
      case 'ret': { const r = top && top.vars.root && fr.length >= (memo.prevN || 0) ? top.vars.root : memo.prevRoot; say = 'The subtree rooted at ' + key(r) + ' is complete' + (fr.length > 1 || fr.length < (memo.prevN || 0) ? ' and goes back to be linked to its parent.' : '. It is the whole tree.'); break; }
      case 'after': say = 'The tree is built: ' + order.length + ' node' + (order.length === 1 ? '' : 's') + ', each made once. Each node sits in the column of its key in the inorder array.'; break;
    }
    if (post && tag === 'go-left') say = parent ? 'The right subtree of ' + key(parent.root) + ' is done. Its left subtree is built from ' + range(v.lo, v.hi) + ', the ' + (parent.nleft === 1 ? 'first key' : 'first ' + parent.nleft + ' keys') + ' of its part of post[].' : '';
    if (post && tag === 'go-right') say = parent ? 'First the right subtree of ' + key(parent.root) + ', from ' + range(v.lo, v.hi) + '.' : '';
    memo.prevN = fr.length;
    memo.prevRoot = top ? top.vars.root : 0;
    return { items, say, calls: B.callsTab(d, 'build', ['root']), slow: tag === 'take' };
  };
  const buildCapture = (post) => (P) => {
    const d = T.capture(P, { type: 'tree', root: 'tree', fields: ['key'] });
    d.calls = P.calls(['root', 'k', 'nleft']);
    const fi = P.frames.findIndex((f) => f.name === 'main');
    d.extra = { next: post ? null : (fi >= 0 && P.isSet('next', fi) ? P.val('next', fi) : 0) };
    return d;
  };
  const buildMain = (post) => (inp) => {
    const ord = post ? inp.post : inp.pre;
    return `int main(void)
{
    int ${post ? 'post' : 'pre'}[] = { ${ord.join(', ')} };
    int in[] = { ${inp.inorder.join(', ')} };
${post ? '' : '    int next = 0;\n'}    struct node *tree;
    tree = build(${post ? 'in, post, 0, ' + (ord.length - 1) + ', 0, ' + (ord.length - 1) : 'pre, in, 0, ' + (ord.length - 1) + ', &next'});
    return 0;
}`;
  };

  // ---- from preorder and inorder ----------------------------------------------------------------------------
  X.topic({
    id: 'bt-build-pre-in', family: 'btprop', order: 50, title: 'Build from preorder and inorder', noLevel: true,
    blurb: 'The preorder says who is the root; the inorder says who is on its left and who on its right. Read the preorder from the left, split the inorder again and again, and the tree comes out.',
    code: `/* build the tree whose inorder is in[lo..hi]; its preorder is in pre[],
   and *next is the place in pre[] of the next root to use */
struct node *build(int pre[], int in[], int lo, int hi, int *next)
{
    struct node *root;
    int k;
    if (lo > hi)                                    /*@ empty */
        return NULL;                                /*@ none */
    root = new_node(pre[*next]);                    /*@ take */
    (*next)++;                                      /*@ advance */
    k = lo;                                         /*@ scan-start */
    while (in[k] != root->key)                      /*@ scan */
        k++;                                        /*@ step */
    root->left = build(pre, in, lo, k - 1, next);   /*@ go-left */
    root->right = build(pre, in, k + 1, hi, next);  /*@ go-right */
    return root;                                    /*@ ret */
}`,
    animate: ['build'], quiet: ['new_node'],
    inputs: [
      { id: 'pre', kind: 'ints', label: 'Preorder', def: [1, 2, 4, 5, 3, 6, 7], max: 12 },
      { id: 'inorder', kind: 'ints', label: 'Inorder', def: [4, 2, 5, 1, 6, 3, 7], max: 12 },
    ],
    check: (inp) => ordersCheck(inp.pre, inp.inorder, 'Preorder', false),
    presets: [
      { label: 'Full tree', values: { pre: [1, 2, 4, 5, 3, 6, 7], inorder: [4, 2, 5, 1, 6, 3, 7] } },
      { label: 'Uneven tree', values: { pre: [8, 3, 1, 6, 4, 7, 10, 14, 13], inorder: [1, 3, 4, 6, 7, 8, 10, 13, 14] } },
      { label: 'Chain to the left', values: { pre: [4, 3, 2, 1], inorder: [1, 2, 3, 4] } },
      { label: 'One node', values: { pre: [5], inorder: [5] } },
    ],
    counters: ['compares', 'allocs'],
    main: buildMain(false),
    capture: buildCapture(false),
    scene: buildScene(false),
    predict: [
      { at: (t) => t.tag === 'advance', once: true, ask: 'Where will the root just made land in the inorder array? Click its cell.',
        answer: (ts, i, ctx) => { const c = B.topCall(ts[i], 'build'); const n = ts[i].data.nodes.find((x) => x.addr === c.args.root); return n ? 'in' + ctx.input.inorder.indexOf(n.key) : null; },
        explain: () => 'k scans the inorder range until it meets the root\'s key.' },
      { at: (t) => t.tag === 'go-right' && B.topCall(t, 'build') && B.topCall(t, 'build').args.lo <= B.topCall(t, 'build').args.hi, once: true, ask: 'Which preorder key becomes the root of this right subtree?',
        options: (ts, i, ctx) => ctx.input.pre.map(String), pick: 'option', answer: (ts, i, ctx) => String(ctx.input.pre[ts[i].data.extra.next]),
        explain: () => 'The next unused preorder key: every key of the left subtree has been used up already, because preorder lists the whole left subtree before the right.' },
    ],
    quiz: [
      { q: 'Why does the preorder alone not fix the tree?', options: ['It does fix it', 'It says who the roots are, but not where the left subtree ends', 'It has no root', 'It is sorted'], answer: 1, why: 'pre = 1 2 3 fits a chain to the left, a chain to the right, or 1 with children 2 and 3. The inorder tells which keys are on which side.' },
      { q: 'Why does the left subtree have to be built before the right one?', options: ['C evaluates left first', 'In preorder the whole left subtree comes before the right, and next walks the preorder in order', 'It does not matter', 'To save memory'], answer: 1, why: 'next is shared. If the right side were built first, it would take the left subtree\'s keys.' },
      { q: 'The root of in[lo..hi] is found at k. How many keys does its left subtree have?', options: ['k', 'k - lo', 'hi - k', 'lo + k'], answer: 1, why: 'in[lo..k-1] holds the left subtree: k - lo keys.' },
      { q: 'What is the cost of the scan for the root, over the whole build, on a chain of n nodes?', options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], answer: 2, why: 'Each call may scan its whole range. A hash map from key to inorder position makes it O(n).' },
    ],
  });

  // ---- from postorder and inorder ---------------------------------------------------------------------------
  X.topic({
    id: 'bt-build-post-in', family: 'btprop', order: 51, title: 'Build from postorder and inorder', noLevel: true,
    blurb: 'In a postorder the root comes last. Each call cuts both arrays the same way: left part, right part, root. The two arrays hold the same keys in the same three blocks, only in a different order.',
    code: `/* build the tree whose inorder is in[lo..hi] and whose postorder
   is post[plo..phi]: the same keys, in another order */
struct node *build(int in[], int post[], int lo, int hi, int plo, int phi)
{
    struct node *root;
    int k, nleft;
    if (lo > hi)                                  /*@ empty */
        return NULL;                              /*@ none */
    root = new_node(post[phi]);                   /*@ take */
    k = lo;                                       /*@ scan-start */
    while (in[k] != root->key)                    /*@ scan */
        k++;                                      /*@ step */
    nleft = k - lo;                               /*@ count */
    root->right = build(in, post, k + 1, hi, plo + nleft, phi - 1);    /*@ go-right */
    root->left = build(in, post, lo, k - 1, plo, plo + nleft - 1);     /*@ go-left */
    return root;                                  /*@ ret */
}`,
    animate: ['build'], quiet: ['new_node'],
    inputs: [
      { id: 'post', kind: 'ints', label: 'Postorder', def: [9, 15, 7, 20, 3], max: 12 },
      { id: 'inorder', kind: 'ints', label: 'Inorder', def: [9, 3, 15, 20, 7], max: 12 },
    ],
    check: (inp) => ordersCheck(inp.post, inp.inorder, 'Postorder', true),
    presets: [
      { label: 'Small tree', values: { post: [9, 15, 7, 20, 3], inorder: [9, 3, 15, 20, 7] } },
      { label: 'Full tree', values: { post: [4, 5, 2, 6, 7, 3, 1], inorder: [4, 2, 5, 1, 6, 3, 7] } },
      { label: 'Uneven tree', values: { post: [1, 4, 7, 6, 3, 13, 14, 10, 8], inorder: [1, 3, 4, 6, 7, 8, 10, 13, 14] } },
      { label: 'Chain to the right', values: { post: [4, 3, 2, 1], inorder: [1, 2, 3, 4] } },
    ],
    counters: ['compares', 'allocs'],
    main: buildMain(true),
    capture: buildCapture(true),
    scene: buildScene(true),
    predict: [
      { at: (t) => t.tag === 'take', once: true, ask: 'This call needs its root. Which postorder cell holds it? Click it.',
        answer: (ts, i) => { const c = B.topCall(ts[i], 'build'); return 'o' + c.args.phi; },
        explain: () => 'The last cell of the call\'s part of post[]: in postorder the root always comes after its subtrees.' },
      { at: (t) => t.tag === 'count', once: true, ask: 'Which subtree will this call build first?', options: () => ['The left one', 'The right one'], pick: 'option', answer: () => 'The right one',
        explain: () => 'This version builds the right subtree first, the mirror of the preorder build. With both ranges passed in, either order would work.' },
    ],
    quiz: [
      { q: 'Where is the root in a postorder?', options: ['First', 'Last', 'In the middle', 'Anywhere'], answer: 1, why: 'Postorder visits the left subtree, the right subtree, and only then the root.' },
      { q: 'The inorder range lo..hi has its root at k. Which postorder positions hold the left subtree?', options: ['plo .. plo + (k - lo) - 1', 'k + 1 .. hi', 'plo .. k', 'phi - k .. phi'], answer: 0, why: 'The left subtree has k - lo keys and they come first in its part of the postorder.' },
      { q: 'Can a tree be rebuilt from its preorder and postorder alone?', options: ['Always', 'Not always: a node with one child could have it on either side', 'Never', 'Only for search trees'], answer: 1, why: 'Root 1 with child 2 gives pre 1 2 and post 2 1 whether 2 is a left or a right child. The inorder tells them apart.' },
      { q: 'Why are both the inorder and the postorder ranges shrinking in every call?', options: ['To save memory', 'Each subtree\'s keys sit together in both arrays, so a subtree is one range in each', 'They are not', 'Because of recursion limits'], answer: 1, why: 'A subtree is a contiguous block in every one of these orders, so two ranges describe it exactly.' },
    ],
  });
  // ---- serialize ---------------------------------------------------------------------------------------------
  X.topic({
    id: 'bt-serialize', family: 'btprop', order: 60, title: 'Serialize (tree to array)',
    blurb: 'Walk the tree in preorder and write each key into an array, and a -1 for every empty subtree. The -1s keep the shape: without them the array could not be turned back into this tree.',
    code: `/* write the tree into out[] in preorder, with -1 for every empty
   subtree; *n counts the values written so far */
void serialize(struct node *root, int out[], int *n)
{
    if (root == NULL) {                   /*@ test */
        out[*n] = -1;                     /*@ write-null */
        (*n)++;                           /*@ count */
        return;                           /*@ base */
    }
    out[*n] = root->key;                  /*@ write-key */
    (*n)++;                               /*@ count */
    serialize(root->left, out, n);        /*@ go-left */
    serialize(root->right, out, n);       /*@ go-right */
}`,
    animate: ['serialize'], quiet: ['new_node'],
    inputs: [B.levelInput('tree', null, [1, 2, 3, -1, 4, 5], 9, 5)],
    presets: [
      { label: 'Small tree', values: { tree: [1, 2, 3, -1, 4, 5] } },
      { label: 'Full tree', values: { tree: [4, 2, 6, 1, 3, 5, 7] } },
      { label: 'Chain to the right', values: { tree: [1, -1, 2, -1, 3] } },
      { label: 'One node', values: { tree: [7] } },
      { label: 'Empty tree', values: { tree: [] } },
    ],
    counters: ['writes'],
    main: (inp) => B.main(inp.tree, 'serialize(tree, out, &n);\n    for (i = 0; i < n; i++)\n        printf("%d ", out[i]);\n    printf("\\n");', 'int out[40];\n    int n = 0, i;'),
    capture: B.capture([], (P) => {
      const fi = P.frames.findIndex((f) => f.name === 'main');
      const n = fi >= 0 && P.isSet('n', fi) ? P.val('n', fi) : 0;
      return { n, out: n ? P.arr('out', n, fi) : [] };
    }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo;
      const end = ctx.tick.end;
      const { fr, top, ret, key } = B.step(ctx, 'serialize', 'root', ['go-left'], ['go-right'], (tg) => (tg === 'base' || end ? 1 : undefined), ['base']);
      memo.written = memo.written || {};
      memo.src = memo.src || [];
      if ((tag === 'write-key' || tag === 'write-null') && top) {
        memo.src[d.extra.n] = top;
        if (top.node) memo.written[top.node] = d.extra.n;
        else memo.written['z' + top.parent + top.side] = d.extra.n;
      }
      const path = B.pathSet(fr);
      const pic = T.picture(ctx, d, {
        rootName: 'tree',
        nodeCls: (n) => 'bp-lab ' + (top && n.addr === top.node ? 'focus' : memo.written[n.addr] !== undefined ? 'part-a' : path.has(n.addr) ? 'part-b' : ''),
        label: (n) => (memo.written[n.addr] !== undefined ? 'out[' + memo.written[n.addr] + ']' : ''),
      });
      const items = pic.items, pos = pic.pos;
      // every empty subtree is drawn from the start: each will become a -1
      const ws = (k) => memo.written[k];
      for (const n of d.nodes) for (const side of ['left', 'right']) {
        if (n.links[side]) continue;
        const f = { node: 0, parent: n.addr, side };
        const zk = 'z' + n.addr + side;
        const isCur = top && !top.node && top.parent === n.addr && top.side === side;
        const sp = B.nullSpot(pos, f, isCur ? 'hot' : '');
        if (ws(zk) !== undefined) sp[sp.length - 1] = Object.assign({}, sp[sp.length - 1], { text: '-1' });
        items.push(...sp);
      }
      // the output array, below the tree
      const maxY = Math.max(0, ...[...pos.values()].map((p) => p.y));
      const ys = maxY + 150;
      const step = 54;
      const outv = d.extra.out || [];
      items.push({ key: 'outl', kind: 'text', x: -40, y: ys + 30, text: 'out', anchor: 'end', cls: 'bp-title' });
      outv.forEach((val, i) => {
        const src = memo.src[i];
        const from = src ? B.spot(pos, src) : { x: i * step, y: ys - 60 };
        items.push({ key: 'out' + i, kind: 'cell', x: i * step, y: ys, w: 48, h: 48, text: val, sub: i, cls: val === -1 ? 'bp-nullv' : 'part-a', enter: 'fly', from: { x: from.x - 24, y: from.y - 24 } });
      });
      if (top && !d.root && !top.parent) items.push({ key: 'emptyroot', kind: 'ring', x: 0, y: 0, r: 13, cls: 'bp-null hot' });
      items.push(...B.stack(fr, (f) => [{ text: 'serialize(' + key(f.node) + ')', w: 1 }], { w: 210, x: -300 }));
      const k = top ? key(top.node) : '', pk = top && top.parent ? key(top.parent) : '';
      let say = '';
      if (end && ret) say = 'serialize(' + key(ret.f.node) + ') is done: its whole subtree is in out[], as one block.';
      else switch (tag) {
        case 'enter': say = 'serialize(tree, out, &n): visit the root, then the left subtree, then the right, writing as it goes. n starts at 0.'; break;
        case 'test': say = top.node ? 'Node ' + k + ' is a real node.' : 'An empty subtree' + (top.parent ? ', the ' + top.side + ' of ' + pk : '') + '. It must still leave a mark, or the shape would be lost.'; break;
        case 'write-null': say = 'out[' + (d.extra.n) + '] = -1: "nothing here".'; break;
        case 'write-key': say = 'Preorder: the node comes first. out[' + d.extra.n + '] = ' + k + '.'; break;
        case 'count': say = 'n becomes ' + d.extra.n + '.'; break;
        case 'base': say = 'Return to ' + (top ? key(top.node) : 'main') + '.'; break;
        case 'go-left': say = 'Now the whole left subtree of ' + pk + ' is written' + (top.node ? ', starting at ' + k + '.' : ': it is empty.'); break;
        case 'go-right': say = 'Then the right subtree of ' + pk + (top.node ? ', starting at ' + k + '.' : ', which is empty.'); break;
        case 'after': { const nn = outv.filter((x) => x !== -1).length; say = 'out[] holds ' + outv.length + ' values: ' + nn + ' key' + (nn === 1 ? '' : 's') + ' and ' + (outv.length - nn) + ' times -1. There is always one more -1 than there are keys.'; break; }
      }
      if (!say && end) say = 'This call is finished.';
      return { items, say, calls: B.callsTab(d, 'serialize', ['root', 'n']), slow: tag === 'write-key' || tag === 'write-null' };
    },
    predict: [
      { at: (t) => t.tag === 'go-right' && B.topCall(t, 'serialize'), once: true, ask: 'What will the next value written into out[] be?',
        options: (ts, i) => ['-1'].concat(ts[i].data.nodes.map((n) => String(n.key))), pick: 'option',
        answer: (ts, i) => { for (let j = i + 1; j < ts.length; j++) if (ts[j].tag === 'write-key' || ts[j].tag === 'write-null') { const c = B.topCall(ts[j], 'serialize'); const n = ts[j].data.nodes.find((x) => x.addr === c.args.root); return n ? String(n.key) : '-1'; } return null; },
        explain: () => 'Preorder: the root of the right subtree, or -1 if the right subtree is empty.' },
      { at: (t, i) => i === 0, once: true, ask: 'How many values will out[] hold at the end?', options: (ts) => { const k = ts[0].data.nodes.length; return [String(k), String(k + 1), String(2 * k), String(2 * k + 1)]; }, pick: 'option',
        answer: (ts) => String(2 * ts[0].data.nodes.length + 1), explain: () => 'n keys and n + 1 empty subtrees: 2n + 1 values.' },
    ],
    quiz: [
      { q: 'A tree has 6 nodes. How many -1s does its serialization hold?', options: ['5', '6', '7', '12'], answer: 2, why: 'Every tree of n nodes has n + 1 empty subtrees.' },
      { q: 'Why not just write the preorder without the -1s?', options: ['It would be longer', 'Different trees have the same preorder; the -1s record where each subtree ends', 'Preorder is not allowed', 'For speed'], answer: 1, why: 'pre = 1 2 fits 2 as a left child or as a right child. 1 2 -1 -1 -1 and 1 -1 2 -1 -1 tell them apart.' },
      { q: 'Why is n passed as a pointer?', options: ['So all calls write into the next free place of the same array', 'To save memory', 'Arrays need it', 'It is not needed'], answer: 0, why: 'Each call must continue where the previous one stopped. A copy of n would be lost when the call returns.' },
      { q: 'What does an empty tree serialize to?', options: ['Nothing', 'A single -1', '0', 'Two -1s'], answer: 1, why: 'The empty tree is one empty subtree: one -1.' },
    ],
  });

  // ---- deserialize -------------------------------------------------------------------------------------------
  /** A preorder strip with -1 markers: {key: {depth, col}} or {err} */
  const parseStrip = (v) => {
    let i = 0, col = 0;
    const out = {};
    const go = (depth) => {
      if (i >= v.length) throw new Error('the list ends too early: every node needs both of its subtrees, even empty ones (-1)');
      const k = v[i++];
      if (k === -1) return null;
      const me = { depth };
      go(depth + 1);
      me.col = col++;
      out[k] = me;
      go(depth + 1);
      return k;
    };
    try { go(0); } catch (e) { return { err: e.message }; }
    if (i < v.length) return { err: 'the tree is complete after ' + i + ' values; the rest is left over' };
    return { tree: out };
  };
  X.topic({
    id: 'bt-deserialize', family: 'btprop', order: 61, title: 'Deserialize (array to tree)', noLevel: true,
    blurb: 'Read the array from the left. A key makes a node, which first takes the values that follow for its left subtree, then for its right. A -1 closes an empty place. The tree grows back exactly as it was.',
    code: `/* rebuild a tree from in[], written in preorder with -1 for every
   empty subtree; *pos is the place of the next value to read */
struct node *deserialize(int in[], int *pos)
{
    struct node *root;
    int key = in[*pos];                       /*@ read */
    (*pos)++;                                 /*@ advance */
    if (key == -1)                            /*@ test */
        return NULL;                          /*@ none */
    root = new_node(key);                     /*@ make */
    root->left = deserialize(in, pos);        /*@ go-left */
    root->right = deserialize(in, pos);       /*@ go-right */
    return root;                              /*@ ret */
}`,
    animate: ['deserialize'], quiet: ['new_node'],
    inputs: [{ id: 'data', kind: 'ints', label: 'Values in preorder (-1 = empty)', def: [1, 2, -1, 4, -1, -1, 3, 5, -1, -1, -1], max: 19 }],
    check: (inp) => {
      const v = inp.data;
      if (v.some((x) => x < -1 || x > 99)) return 'keys from 0 to 99, and -1 for an empty subtree';
      const keys = v.filter((x) => x !== -1);
      if (new Set(keys).size !== keys.length) return 'each key only once';
      if (keys.length > 9) return 'at most 9 keys, so the array and the tree fit';
      const r = parseStrip(v);
      if (r.err) return 'Values: ' + r.err;
      if (Object.values(r.tree).some((n) => n.depth > 4)) return 'at most 5 levels, so the tree fits on the screen';
      return null;
    },
    presets: [
      { label: 'Small tree', values: { data: [1, 2, -1, 4, -1, -1, 3, 5, -1, -1, -1] } },
      { label: 'Full tree', values: { data: [4, 2, 1, -1, -1, 3, -1, -1, 6, 5, -1, -1, 7, -1, -1] } },
      { label: 'Chain to the left', values: { data: [3, 2, 1, -1, -1, -1, -1] } },
      { label: 'Just -1', values: { data: [-1] } },
    ],
    counters: ['allocs'],
    main: (inp) => `int main(void)
{
    int data[] = { ${inp.data.join(', ')} };
    int pos = 0;
    struct node *tree;
    tree = deserialize(data, &pos);
    return 0;
}`,
    capture(P) {
      const d = T.capture(P, { type: 'tree', root: 'tree', fields: ['key'] });
      d.calls = P.calls(['root', 'key']);
      const fi = P.frames.findIndex((f) => f.name === 'main');
      d.extra = { pos: fi >= 0 && P.isSet('pos', fi) ? P.val('pos', fi) : 0 };
      return d;
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo, data = ctx.input.data;
      const shape = memo.shape || (memo.shape = parseStrip(data).tree);
      const fr = B.frames(ctx, 'deserialize', 'fp', ['go-left'], ['go-right']);
      const top = fr[fr.length - 1] || null;
      const v = top ? top.vars : {};
      const key = B.keyOf(d);
      const pos = new Map();
      for (const n of d.nodes) { const s = shape[n.key]; if (s) pos.set(n.addr, { x: s.col * B.DX, y: s.depth * B.DY, depth: s.depth }); }
      const yS = -250, step = 54;
      const at = d.extra.pos;
      const readIdx = tag === 'read' ? at : at - 1;
      // where the value now being read will go: under the parent call's node, on its side
      const parentOf = (j) => (j > 0 ? fr[j - 1].vars.root : 0);
      const slot = (f, j) => {
        if (f.vars.root && pos.get(f.vars.root)) return pos.get(f.vars.root);
        const par = parentOf(j);
        if (!par || !pos.get(par)) return { x: 0, y: 0 };
        const p = pos.get(par);
        if (f.vars.key !== undefined && f.vars.key !== -1 && shape[f.vars.key]) return { x: shape[f.vars.key].col * B.DX, y: shape[f.vars.key].depth * B.DY };
        return { x: p.x + (f.side === 'left' ? -0.42 : 0.42) * B.DX, y: p.y + 0.62 * B.DY, empty: true };
      };
      memo.closed = memo.closed || [];
      if (tag === 'none') {
        // the call that read -1: still on top of the stack, or (if already gone) the one that was on top before
        const still = top && top.vars.key === -1;
        const f = still ? top : memo.lastTop;
        const par = still ? parentOf(fr.length - 1) : fr.length ? fr[fr.length - 1].vars.root : 0;
        if (f && par && !memo.closed.some((c) => c.par === par && c.side === f.side)) memo.closed.push({ par, side: f.side });
      }
      const pic = T.picture(ctx, d, {
        pos, rootName: 'tree',
        nodeCls: (n) => 'bp-lab ' + (top && n.addr === v.root ? 'focus' : fr.some((f) => f.vars.root === n.addr) ? 'part-b' : 'part-a'),
      });
      const items = pic.items;
      for (const it of items) if (it.kind === 'vertex' && it.enter === 'drop') {
        const n = d.nodes.find((x) => 'n' + x.addr === it.key);
        const i = n ? data.indexOf(n.key) : -1;
        if (i >= 0) { it.enter = 'fly'; it.from = { x: i * step, y: yS + 24 }; }
      }
      // the empty places closed by a -1
      for (const c of memo.closed) {
        const sp = B.nullSpot(pos, { node: 0, parent: c.par, side: c.side }, '');
        sp[sp.length - 1] = Object.assign({}, sp[sp.length - 1], { text: '-1' });
        items.push(...sp);
      }
      // the place the current call will fill
      if (top && !v.root) {
        const s = slot(top, fr.length - 1);
        if (s.empty || v.key === undefined || v.key === -1) items.push({ key: 'open', kind: 'ring', x: s.x, y: s.y, r: s.empty ? 13 : 26, cls: 'bp-null hot' });
        else items.push({ key: 'open', kind: 'ring', x: s.x, y: s.y, r: 26, cls: 'bp-null hot' });
      }
      // the array being read
      items.push({ key: 'inl', kind: 'text', x: -40, y: yS + 30, text: 'in', anchor: 'end', cls: 'bp-title' });
      data.forEach((val, i) => {
        const cls = i < readIdx || (i === readIdx && tag !== 'read' && tag !== 'advance') ? 'bp-used' : i === readIdx ? 'bp-next' : '';
        items.push({ key: 'in' + i, kind: 'cell', x: i * step - 24, y: yS, w: 48, h: 48, text: val, sub: i, cls: cls + (val === -1 ? ' bp-nullv' : '') });
      });
      if (at < data.length) items.push({ key: 'cpos', kind: 'cursor', at: 'in' + at, side: 'above', text: 'pos', cls: 'c-rose' });
      items.push(...B.stack(fr, (f) => [
        { text: 'deserialize()', w: 1.8 },
        { text: 'key ' + (f.vars.key === undefined ? '?' : f.vars.key), w: 1.2, cls: 'link' },
      ], { w: 240, x: -330 }));
      if (top) memo.lastTop = top;
      const parK = fr.length > 1 && fr[fr.length - 2].vars.root ? key(fr[fr.length - 2].vars.root) : '';
      let say = '';
      switch (tag) {
        case 'enter': say = 'deserialize(data, &pos) reads the values from the left, one per call. Each call builds one subtree and leaves pos just after it.'; break;
        case 'read': say = 'key = in[' + at + '] = ' + v.key + '.'; break;
        case 'advance': say = 'pos moves on to ' + at + '.'; break;
        case 'test': say = v.key === -1 ? 'It is -1: this subtree is empty' + (parK ? ' (the ' + top.side + ' of ' + parK + ')' : '') + '.' : v.key + ' is a key, so there is a node here.'; break;
        case 'none': say = 'Return NULL: the empty place is closed.'; break;
        case 'make': say = 'A node for ' + key(v.root) + '. Its children are not known yet: the values that follow are its left subtree, and after them its right subtree.'; break;
        case 'go-left': say = 'The left subtree of ' + parK + ' is read from in[' + at + '] on.'; break;
        case 'go-right': say = 'The left subtree of ' + parK + ' is complete. The values from in[' + at + '] on belong to its right subtree.'; break;
        case 'ret': say = 'This subtree is complete; its root goes back to be linked to its parent.'; break;
        case 'after': say = d.root ? 'The tree is back, with all ' + d.nodes.length + ' node' + (d.nodes.length === 1 ? '' : 's') + ' and the same shape. pos = ' + at + ': every value was read once.' : 'A single -1: the empty tree.'; break;
      }
      return { items, say, calls: B.callsTab(d, 'deserialize', ['root']), slow: tag === 'make' };
    },
    predict: [
      { at: (t) => t.tag === 'make', once: true, ask: 'The node just made: will its left subtree be empty?', options: () => ['Yes', 'No'], pick: 'option',
        answer: (ts, i, ctx) => (ctx.input.data[ts[i].data.extra.pos] === -1 ? 'Yes' : 'No'),
        explain: (ts, i) => 'Look at the next value, in[' + ts[i].data.extra.pos + ']: a -1 there means an empty left subtree.' },
      { at: (t) => t.tag === 'go-right' && t.data.calls.filter((c) => c.fn === 'deserialize').length === 2, once: true, ask: 'Which value starts the right subtree of the root?',
        options: (ts, i, ctx) => [...new Set(ctx.input.data.map(String))], pick: 'option', answer: (ts, i, ctx) => String(ctx.input.data[ts[i].data.extra.pos]),
        explain: () => 'Whatever comes right after the whole left subtree has been read.' },
    ],
    quiz: [
      { q: 'How does deserialize know where the left subtree ends?', options: ['It counts the keys', 'It does not need to: the left call reads exactly its own values and leaves pos after them', 'A special end marker', 'It looks at the inorder'], answer: 1, why: 'The -1s close every subtree, so the recursion itself stops at the right place.' },
      { q: 'Why is pos a pointer?', options: ['All calls must share one reading position', 'To save memory', 'Arrays need it', 'For speed'], answer: 0, why: 'When the left call returns, the right call must continue where the left one stopped.' },
      { q: 'Which of these is a complete serialization?', options: ['1 -1', '1 2 -1 -1', '1 -1 -1', '-1 -1'], answer: 2, why: 'A single node: its key, then -1 for its left and -1 for its right.' },
      { q: 'How many calls does deserialize make for n nodes?', options: ['n', 'n + 1', '2n + 1', '2n'], answer: 2, why: 'One per value in the array: n keys and n + 1 times -1.' },
    ],
  });
})(SEE);
