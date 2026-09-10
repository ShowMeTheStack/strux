// Binary search trees: k-th smallest, keys in a range, checking the order rule, building from a
// sorted array.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, T = X.TreeKit, B = X.BstKit;
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

  // ---- k-th smallest ------------------------------------------------------------------------------------
  X.topic({
    id: 'bst-kth', family: 'bst', order: 40, title: 'The k-th smallest key',
    blurb: 'An in-order walk visits the keys smallest first. Count them as they go by, and stop at the k-th: the rest of the tree is never touched.',
    code: `/* the k-th smallest key (k = 1 is the smallest); *count: keys passed so far */
struct node *kth(struct node *node, int k, int *count)
{
    struct node *found;
    if (node == NULL)                          /*@ base */
        return NULL;                           /*@ empty */
    found = kth(node->left, k, count);         /*@ go-left */
    if (found != NULL)                         /*@ check-left */
        return found;                          /*@ pass-up */
    (*count)++;                                /*@ count */
    if (*count == k)                           /*@ compare-k */
        return node;                           /*@ hit */
    return kth(node->right, k, count);         /*@ go-right */
}`,
    animate: ['kth'],
    inputs: [Object.assign({}, X.bstKeys, { min: 1 }), { id: 'k', kind: 'int', label: 'k', def: 3, lo: 1, hi: 16 }],
    presets: [
      { label: 'The 3rd smallest', values: { keys: [50, 30, 70, 20, 40, 60, 80], k: 3 } },
      { label: 'k = 1: the smallest', values: { keys: [50, 30, 70, 20, 40, 60, 80], k: 1 } },
      { label: 'The biggest: everything visited', values: { keys: [50, 30, 70, 20, 40, 60, 80], k: 7 } },
      { label: 'k too big: NULL', values: { keys: [50, 30, 70], k: 5 } },
      { label: 'Unbalanced', values: { keys: [10, 50, 30, 20, 40, 60], k: 4 } },
    ],
    main: (inp) => X.bstMain(inp.keys, 'r = kth(root, ' + inp.k + ', &seen);\n    if (r != NULL)\n        printf("%d\\n", r->key);\n    else\n        printf("fewer than ' + inp.k + ' keys\\n");', 'struct node *r;\n    int seen = 0;'),
    capture: B.capture({ cursors: ['node', 'found'], fn: 'kth', vars: ['node'], extra: (P) => ({ seen: P.val('seen') }) }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, k = ctx.input.k, memo = ctx.memo;
      memo.rank = memo.rank || {};
      memo.state = memo.state || {};
      memo.visited = memo.visited || new Set();
      const st = d.stack.map((f) => f.node);
      const top = st[st.length - 1];
      const seen = d.extra.seen;
      if (top) memo.visited.add(top);
      if (tag === 'go-left' || tag === 'go-right') memo.state[st[st.length - 2]] = tag === 'go-left' ? 'left' : 'right';
      if (tag === 'count') memo.rank[top] = seen;
      if (tag === 'hit') memo.hit = ctx.prev.data.stack[ctx.prev.data.stack.length - 1].node;
      const over = tag === 'after';
      const onStack = new Set(st.filter(Boolean));
      const pic = B.picture(ctx, d, {
        nodeCls: (n) => (n.addr === memo.hit ? 'done' : n.addr === top ? 'focus' : memo.rank[n.addr] ? 'part-a' : onStack.has(n.addr) ? 'part-b' : over && !memo.visited.has(n.addr) ? 'ghost' : ''),
        edgeCls: (n, side) => (onStack.has(n.addr) && onStack.has(n.links[side]) ? 'part-b' : ''),
        label: (n) => (memo.rank[n.addr] ? '#' + memo.rank[n.addr] : ''),
        showNull: true,
        cursors: top && !over ? [['node', top]] : [],
      });
      const items = pic.items, pos = pic.pos, box = B.box(pos);
      if (top && !over) { const z = B.region(pos, B.subtree(d, top), 'zone', 'bx-sub'); if (z) items.push(z); }
      if (top === 0 && st.length > 1) {
        const pa = st[st.length - 2], s = B.nullAt(pos, pa, memo.state[pa]);
        if (s) items.push({ key: 'nullspot', kind: 'ring', x: s.x, y: s.y + 26, r: 20, cls: 'bx-null' });
      }
      // the keys counted so far, each under its node: the sorted order appears from the left
      const sy = box.y1 + 100;
      for (const n of B.inorder(d)) {
        const p = pos.get(n.addr);
        if (memo.rank[n.addr]) items.push({ key: 's' + n.addr, kind: 'cell', x: p.x - 24, y: sy, w: 48, h: 36, text: n.key, sub: '#' + memo.rank[n.addr], cls: n.addr === memo.hit ? 'done' : 'part-a', enter: 'grow' });
        else items.push({ key: 'e' + n.addr + 'slot', kind: 'region', x: p.x - 24, y: sy, w: 48, h: 36, cls: 'null-spot' });
      }
      items.push({ key: 'cnt', kind: 'text', x: box.x0 - 24, y: sy + 84, text: 'count = ' + (seen || 0) + ' of k = ' + k, cls: 'bx-big' });
      // the calls still open
      const rows = st.map((a, i) => {
        const kk = B.name(d, a);
        if (i < st.length - 1) return { text: 'kth(' + kk + '): in its ' + memo.state[a] + ' subtree', tcls: 'bx-muted' };
        return { text: 'kth(' + kk + ')', tcls: 'bx-hot' };
      });
      if (rows.length) { const la = B.ladderAt(ctx, box, 280, 120); items.push(...B.ladder(rows, la.x, la.y, 'lad', 280)); }
      const nm = (a) => B.name(d, a);
      const total = d.nodes.length;
      let say = '';
      switch (tag) {
        case 'enter': say = 'kth(root, ' + k + ', &seen): an in-order walk meets the keys smallest first. count goes up by one at each key, and the walk stops when it reaches ' + k + '.'; break;
        case 'base': say = top ? 'node is ' + nm(top) + '. Its left subtree holds smaller keys, and they all come first.' : 'An empty subtree: nothing to count here.'; break;
        case 'empty': say = 'Return NULL: the k-th key is not in this empty subtree.'; break;
        case 'go-left': say = 'kth(' + nm(st[st.length - 2]) + ') first walks its left subtree' + (top ? ' (' + nm(top) + ')' : ', which is empty') + '. ' + plural(st.length, 'call') + ' open.'; break;
        case 'check-left': say = d.cursors.found ? 'The left subtree found it: ' + nm(d.cursors.found) + '.' : 'The left subtree gave NULL: fewer than ' + k + ' keys were there. count is now ' + seen + '.'; break;
        case 'pass-up': say = 'Pass the answer straight up: no more counting, no more walking.'; break;
        case 'count': say = 'Every smaller key has been counted, so ' + nm(top) + ' is next: count becomes ' + seen + '. ' + nm(top) + ' is the ' + ord(seen) + ' smallest key.'; break;
        case 'compare-k': say = seen === k ? 'count == k: ' + nm(top) + ' is the one.' : 'count is ' + seen + ', not ' + k + ': keep going, into the right subtree.'; break;
        case 'hit': say = 'Return ' + nm(memo.hit) + '. Every call waiting above passes it straight up.'; break;
        case 'go-right': say = 'kth(' + nm(st[st.length - 2]) + ') now walks its right subtree' + (top ? ' (' + nm(top) + ')' : ', which is empty') + ', and returns whatever that finds.'; break;
        case 'after': say = memo.hit ? 'main gets ' + nm(memo.hit) + ', the ' + ord(k) + ' smallest key. Only ' + memo.visited.size + ' of ' + total + ' nodes were visited; the greyed ones were never touched.' : 'kth returned NULL: the tree has only ' + total + ' keys, fewer than ' + k + '.'; break;
      }
      return { items, say, slow: tag === 'hit' || tag === 'count' };
    },
    predict: [
      { at: (t) => t.tag === 'enter', once: true, ask: (t, ts, i, ctx) => 'Click the node holding the ' + ord(ctx.input.k) + ' smallest key.', answer: (ts, i, ctx) => { const L = B.inorder(ts[i].data); return L[ctx.input.k - 1] ? 'n' + L[ctx.input.k - 1].addr : null; }, explain: () => 'Read the keys from left to right: the picture places every node by its rank in sorted order.' },
      { at: (t) => t.tag === 'count', once: true, ask: 'Which keys have been counted before this one?', options: () => ['Every key smaller than it', 'Its ancestors', 'Its children', 'The keys on the path from the root'], pick: 'option', answer: () => 'Every key smaller than it', explain: () => 'In-order: the whole left subtree, and every ancestor it hangs to the right of, come first.' },
    ],
    quiz: [
      { q: 'Why does the walk count a node only after its left subtree?', options: ['To save memory', 'Everything on the left is smaller and must come first', 'Because of the stack', 'It does not matter'], answer: 1, why: 'In-order means left subtree, node, right subtree: the keys in increasing order.' },
      { q: 'Why is count passed as a pointer?', options: ['It is faster', 'Every call must update the same counter, not a copy of it', 'C cannot pass ints', 'To return it to main'], answer: 1, why: 'Each call gets its own copy of an int argument. Through the pointer, all calls share main\'s variable seen.' },
      { q: 'Looking for the 2nd smallest in a tree of 1000 keys. Roughly how many nodes are visited?', options: ['All 1000', 'About the height of the tree', '500', 'Exactly 2'], answer: 1, why: 'The walk goes down the left side, counts two keys, and stops. The rest is never visited.' },
      { q: 'What does kth return when k is bigger than the number of keys?', options: ['The biggest key', 'NULL', 'The root', 'It crashes'], answer: 1, why: 'count never reaches k, every subtree returns NULL, and so does the first call.' },
    ],
  });

  // ---- keys in a range ----------------------------------------------------------------------------------
  X.topic({
    id: 'bst-range', family: 'bst', order: 41, title: 'Print the keys in a range',
    blurb: 'Visit only what could be in [lo, hi]. A subtree whose keys are all too small, or all too big, is cut off without a look.',
    code: `/* print, in increasing order, every key between lo and hi */
void print_range(struct node *node, int lo, int hi)
{
    if (node == NULL)                             /*@ base */
        return;                                   /*@ empty */
    if (lo < node->key)                           /*@ compare-lo */
        print_range(node->left, lo, hi);          /*@ go-left */
    if (lo <= node->key && node->key <= hi)       /*@ compare-in */
        printf("%d ", node->key);                 /*@ print */
    if (node->key < hi)                           /*@ compare-hi */
        print_range(node->right, lo, hi);         /*@ go-right */
}                                                 /*@ end */`,
    animate: ['print_range'],
    inputs: [X.bstKeys, { id: 'lo', kind: 'int', label: 'lo', def: 35, lo: -999, hi: 999 }, { id: 'hi', kind: 'int', label: 'hi', def: 65, lo: -999, hi: 999 }],
    check: (inp) => (inp.lo > inp.hi ? 'lo must not be bigger than hi' : null),
    presets: [
      { label: 'The middle', values: { keys: [50, 30, 70, 20, 40, 60, 80], lo: 35, hi: 65 } },
      { label: 'Fifteen keys, a narrow range', values: { keys: [80, 40, 120, 20, 60, 100, 140, 10, 30, 50, 70, 90, 110, 130, 150], lo: 55, hi: 95 } },
      { label: 'Nothing in range', values: { keys: [50, 30, 70, 20, 40, 60, 80], lo: 41, hi: 49 } },
      { label: 'Everything', values: { keys: [50, 30, 70, 20, 40], lo: 0, hi: 100 } },
    ],
    main: (inp) => X.bstMain(inp.keys, 'print_range(root, ' + inp.lo + ', ' + inp.hi + ');\n    printf("\\n");'),
    capture: B.capture({ cursors: ['node'], fn: 'print_range', vars: ['node'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, lo = ctx.input.lo, hi = ctx.input.hi, memo = ctx.memo;
      memo.cut = memo.cut || [];         // [{root, why}]
      memo.printed = memo.printed || [];
      memo.visited = memo.visited || new Set();
      memo.side = memo.side || {};
      const st = d.stack.map((f) => f.node);
      const top = st[st.length - 1];
      if (top) memo.visited.add(top);
      if (tag === 'go-left' || tag === 'go-right') memo.side[st[st.length - 2]] = tag === 'go-left' ? 'left' : 'right';
      const tn = B.node(d, top);
      // a failed test cuts a subtree off
      const next = ctx.ticks[ctx.i + 1];
      if (tag === 'compare-lo' && tn && !(lo < tn.key) && tn.links.left) memo.cut.push({ root: tn.links.left, why: 'all < ' + lo });
      if (tag === 'compare-hi' && tn && !(tn.key < hi) && tn.links.right) memo.cut.push({ root: tn.links.right, why: 'all > ' + hi });
      if (tag === 'print') memo.printed.push(top);
      void next;
      const cutSet = new Set();
      for (const c of memo.cut) for (const a of B.subtree(d, c.root)) cutSet.add(a);
      const printed = new Set(memo.printed);
      const onStack = new Set(st.filter(Boolean));
      const pic = B.picture(ctx, d, {
        nodeCls: (n) => (printed.has(n.addr) ? 'done' : cutSet.has(n.addr) ? 'ghost' : n.addr === top ? 'focus' : onStack.has(n.addr) ? 'part-b' : memo.visited.has(n.addr) ? 'part-a' : ''),
        edgeCls: (n, side) => (cutSet.has(n.links[side]) ? 'ghost' : onStack.has(n.addr) && onStack.has(n.links[side]) ? 'part-b' : ''),
        showNull: true,
        cursors: top ? [['node', top]] : [],
      });
      const items = pic.items, pos = pic.pos, box = B.box(pos);
      // the band: the columns whose keys are in range (x is the sorted position)
      const inr = B.inorder(d).filter((n) => n.key >= lo && n.key <= hi);
      if (inr.length) {
        const x0 = pos.get(inr[0].addr).x - 30, x1 = pos.get(inr[inr.length - 1].addr).x + 30;
        items.push({ key: 'band', kind: 'region', x: x0, y: box.y0 - 50, w: x1 - x0, h: box.y1 - box.y0 + 100, cls: 'bx-band', text: '[' + lo + ', ' + hi + ']' });
      } else {
        const below = B.inorder(d).filter((n) => n.key < lo);
        const all = B.inorder(d);
        const gx = !all.length ? 0 : !below.length ? pos.get(all[0].addr).x - 32 : below.length === all.length ? pos.get(all[all.length - 1].addr).x + 32 : (pos.get(below[below.length - 1].addr).x + pos.get(all[below.length].addr).x) / 2;
        items.push({ key: 'bandline', kind: 'line', x1: gx, y1: box.y0 - 40, x2: gx, y2: box.y1 + 40, cls: 'hot' });
        items.push({ key: 'bandt', kind: 'text', x: gx + 6, y: box.y0 - 46, text: '[' + lo + ', ' + hi + '] would be here: no keys', cls: 'bx-hot' });
      }
      for (const c of memo.cut) { const z = B.region(pos, B.subtree(d, c.root), 'cut' + c.root, 'bx-cut', 'pruned: ' + c.why); if (z) items.push(z); }
      // the output so far
      const oy = box.y1 + 110;
      items.push({ key: 'out-t', kind: 'text', x: box.x0 - 24, y: oy - 14, text: 'PRINTED', cls: 'bx-title' });
      memo.printed.forEach((a, i) => items.push({ key: 'o' + a, kind: 'cell', x: box.x0 - 24 + i * 54, y: oy, w: 48, h: 36, text: B.name(d, a), cls: 'done', enter: 'fly', from: pos.get(a) ? { x: pos.get(a).x - 24, y: pos.get(a).y } : undefined }));
      items.push({ key: 'vis', kind: 'text', x: box.x0 - 24, y: oy + 64, text: 'visited ' + memo.visited.size + ' of ' + d.nodes.length + ' nodes', cls: 'note' });
      if (top === 0 && st.length > 1) { const pa = st[st.length - 2], s = B.nullAt(pos, pa, memo.side[pa]); if (s) items.push({ key: 'nullspot', kind: 'ring', x: s.x, y: s.y + 26, r: 20, cls: 'bx-null' }); }
      const at = top && pos.get(top);
      if (at && ['compare-lo', 'compare-in', 'compare-hi'].includes(tag)) {
        const k = tn.key;
        const txt = tag === 'compare-lo' ? (lo < k ? lo + ' < ' + k + ': look left' : lo + ' >= ' + k + ': skip left') : tag === 'compare-hi' ? (k < hi ? k + ' < ' + hi + ': look right' : k + ' >= ' + hi + ': skip right') : (lo <= k && k <= hi ? k + ' in range' : k + ' outside');
        items.push({ key: 'q', kind: 'text', x: at.x + 34, y: at.y - 30, text: txt, cls: 'bx-hot' });
      }
      const nm = (a) => B.name(d, a);
      let say = '';
      switch (tag) {
        case 'enter': say = 'print_range(root, ' + lo + ', ' + hi + '). The green band covers the keys that should come out. Watch how much of the tree outside it is never visited.'; break;
        case 'base': say = top ? 'node is ' + nm(top) + '.' : 'An empty subtree: nothing to print.'; break;
        case 'empty': say = 'Return straight away.'; break;
        case 'compare-lo': say = lo < tn.key ? 'Is lo (' + lo + ') < ' + tn.key + '? Yes: the left subtree may hold keys from ' + lo + ' up, so it must be visited.' : 'Is lo (' + lo + ') < ' + tn.key + '? No. Every key in the left subtree is smaller than ' + tn.key + ', so smaller than ' + lo + ' too.' + (tn.links.left ? ' The whole left subtree is pruned without a look.' : ''); break;
        case 'go-left': say = 'Visit the left subtree of ' + nm(st[st.length - 2]) + ' first: its keys are smaller, so they are printed first.'; break;
        case 'compare-in': say = lo <= tn.key && tn.key <= hi ? lo + ' <= ' + tn.key + ' <= ' + hi + ': print it.' : tn.key + ' is outside [' + lo + ', ' + hi + ']: do not print it, but its subtrees may still matter.'; break;
        case 'print': say = 'printf prints ' + nm(top) + '. The keys come out in increasing order because the left subtree went first.'; break;
        case 'compare-hi': say = tn.key < hi ? tn.key + ' < hi (' + hi + '): the right subtree may hold keys up to ' + hi + '. Visit it.' : tn.key + ' is not below hi (' + hi + '). Every key on the right is bigger than ' + tn.key + '.' + (tn.links.right ? ' The right subtree is pruned.' : ''); break;
        case 'go-right': say = 'Visit the right subtree of ' + nm(st[st.length - 2]) + '.'; break;
        case 'end': say = 'print_range(' + nm(top) + ') is finished and returns.'; break;
        case 'after': say = 'Printed: ' + (memo.printed.map(nm).join(' ') || 'nothing') + '. Visited ' + memo.visited.size + ' of ' + d.nodes.length + ' nodes; the greyed subtrees were never entered.'; break;
      }
      return { items, say, slow: tag === 'print' };
    },
    predict: [
      { at: (t, i, ts) => { const u = ts[i + 1]; if (!u || u.tag !== 'compare-lo') return false; const n = B.node(u.data, u.data.stack[u.data.stack.length - 1].node); return !!(n && n.links.left); }, once: true, ask: (t, ts, i, ctx) => 'lo is ' + ctx.input.lo + '. Will the left subtree of this node be visited?', options: () => ['Yes', 'No, it is pruned'], pick: 'option', answer: (ts, i, ctx) => { const t = ts[i + 1], n = B.node(t.data, t.data.stack[t.data.stack.length - 1].node); return ctx.input.lo < n.key ? 'Yes' : 'No, it is pruned'; }, explain: () => 'Only if lo < node->key: otherwise every key on the left is below lo.' },
      { at: (t) => t.tag === 'enter', once: true, ask: 'Which keys will be printed first?', options: (ts, i, ctx) => ['The smallest one in range', 'The root', 'The biggest one in range', 'They come out unsorted'], pick: 'option', answer: () => 'The smallest one in range', explain: () => 'It is an in-order walk, cut down: left subtree, node, right subtree.' },
    ],
    quiz: [
      { q: 'At node 50, with lo = 55. What happens to its left subtree?', options: ['It is visited', 'It is skipped: every key there is below 50, so below 55', 'Only its root is checked', 'It is printed'], answer: 1, why: 'lo < node->key is false, so the recursive call on the left never happens.' },
      { q: 'Why do the keys come out in increasing order?', options: ['They are sorted afterwards', 'The left subtree is handled before the node, and the right after', 'printf sorts them', 'By chance'], answer: 1, why: 'It is the in-order walk with some subtrees skipped.' },
      { q: 'A node outside the range is not printed. Can its subtrees still hold keys in range?', options: ['Never', 'Yes, one of them can', 'Both always do', 'Only if it is the root'], answer: 1, why: 'A node below lo can have bigger keys on its right; a node above hi can have smaller keys on its left.' },
      { q: 'Roughly what does print_range cost for a tree of height h printing m keys?', options: ['O(n) always', 'O(h + m)', 'O(m) only', 'O(h * m)'], answer: 1, why: 'Two search paths along the edges of the range, plus the m keys printed in between.' },
    ],
  });

  // ---- is it a binary search tree? ----------------------------------------------------------------------
  const bound = (v) => (v === -2147483648 ? '-inf' : v === 2147483647 ? '+inf' : String(v));
  X.topic({
    id: 'bst-validate', family: 'bst', order: 50, title: 'Is it a binary search tree?',
    blurb: 'Checking each node against its children is not enough. Every node must lie inside a window set by all of its ancestors, and the window narrows on the way down.',
    code: `#include <limits.h>

/* 1 if every key in the subtree lies strictly between lo and hi */
int is_bst(struct node *node, int lo, int hi)
{
    if (node == NULL)                                  /*@ base */
        return 1;                                      /*@ empty */
    if (node->key <= lo || node->key >= hi)            /*@ compare-bounds */
        return 0;                                      /*@ fail */
    if (!is_bst(node->left, lo, node->key))            /*@ go-left */
        return 0;                                      /*@ pass-fail */
    return is_bst(node->right, node->key, hi);         /*@ go-right */
}`,
    animate: ['is_bst'],
    inputs: [X.bstKeys, { id: 'change', kind: 'int', label: 'Then change key', def: 40, lo: -999, hi: 999 }, { id: 'into', kind: 'int', label: 'into', def: 55, lo: -999, hi: 999 }],
    check: (inp) => (!inp.keys.includes(inp.change) ? 'The key to change must be one of the keys in the tree' : inp.into !== inp.change && inp.keys.includes(inp.into) ? 'Change it into a key that is not already in the tree' : null),
    presets: [
      { label: 'Looks right locally', values: { keys: [50, 30, 70, 20, 40, 60, 80], change: 40, into: 55 } },
      { label: 'A valid tree', values: { keys: [50, 30, 70, 20, 40, 60, 80], change: 40, into: 40 } },
      { label: 'Wrong deep on the right', values: { keys: [50, 30, 70, 20, 40, 60, 80, 65], change: 60, into: 45 } },
      { label: 'A child on the wrong side', values: { keys: [50, 30, 70, 20, 40, 60, 80], change: 20, into: 35 } },
    ],
    main: (inp) => X.bstMain(inp.keys, (inp.change !== inp.into ? '/* break the order on purpose: change one key, keep every link */\n    p = root;\n    while (p->key != ' + inp.change + ')\n        p = ' + inp.change + ' < p->key ? p->left : p->right;\n    p->key = ' + inp.into + ';\n    ' : '') + 'printf("%s\\n", is_bst(root, INT_MIN, INT_MAX) ? "a BST" : "not a BST");', inp.change !== inp.into ? 'struct node *p;' : ''),
    capture: B.capture({ cursors: ['node'], fn: 'is_bst', vars: ['node', 'lo', 'hi'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo, inp = ctx.input;
      memo.win = memo.win || {};        // addr -> [lo, hi]
      memo.ok = memo.ok || new Set();
      memo.side = memo.side || {};
      const st = d.stack, topF = st[st.length - 1] || null;
      const top = topF ? topF.node : undefined;
      if (top) memo.win[top] = [topF.lo, topF.hi];
      if (tag === 'go-left' || tag === 'go-right') memo.side[st[st.length - 2].node] = tag === 'go-left' ? 'left' : 'right';
      const tn = B.node(d, top);
      const breaks = tn && (tn.key <= topF.lo || tn.key >= topF.hi);
      if (tag === 'compare-bounds' && tn && !breaks) memo.ok.add(top);
      if (tag === 'compare-bounds' && breaks) memo.bad = top;
      // is the bad node at least on the right side of its own parent?
      const localOk = (a) => { const par = d.nodes.find((m) => m.links.left === a || m.links.right === a); const n = B.node(d, a); if (!par || !n) return true; return par.links.left === a ? n.key < par.key : n.key > par.key; };
      const changed = inp.change !== inp.into ? (B.byKey(d, inp.into) || {}).addr : 0;
      const onStack = new Set(st.map((f) => f.node).filter(Boolean));
      const pic = B.picture(ctx, d, {
        nodeCls: (n) => (n.addr === memo.bad ? 'bx-out' : n.addr === top ? 'focus' : memo.ok.has(n.addr) ? 'part-a' : '') + (memo.win[n.addr] ? (n.addr === memo.bad ? ' bx-sub-bad' : n.addr === top ? ' bx-sub-hot' : '') : ''),
        edgeCls: (n, side) => (onStack.has(n.addr) && onStack.has(n.links[side]) ? 'part-b' : ''),
        label: (n) => (memo.win[n.addr] ? '(' + bound(memo.win[n.addr][0]) + ', ' + bound(memo.win[n.addr][1]) + ')' : ''),
        labelAbove: true,
        showNull: true,
        cursors: top ? [['node', top]] : [],
      });
      const items = pic.items, pos = pic.pos, box = B.box(pos);
      // the ancestor whose key set the bound that is broken
      if (memo.bad && (tag === 'compare-bounds' || tag === 'fail' || tag === 'pass-fail' || tag === 'after')) {
        const w = memo.win[memo.bad], bn = B.node(d, memo.bad);
        const lim = bn.key <= w[0] ? w[0] : w[1];
        const anc = B.byKey(d, lim);
        if (anc && pos.get(anc.addr)) { const p = pos.get(anc.addr); items.push({ key: 'anc', kind: 'ring', x: p.x, y: p.y, r: 32, cls: 'bx-bad' }); }
        const p = pos.get(memo.bad);
        items.push({ key: 'why', kind: 'text', x: box.x0 - 24, y: box.y1 + 92, text: bn.key + (bn.key <= w[0] ? ' <= ' : ' >= ') + bound(lim) + ': outside its window, set by ' + (anc ? anc.key : 'an ancestor'), cls: 'bx-bad' });
        void p;
      }
      if (changed && pos.get(changed) && !memo.bad) { const p = pos.get(changed); items.push({ key: 'chg', kind: 'text', x: p.x + 30, y: p.y + 34, text: 'was ' + inp.change, cls: 'note' }); }
      if (top === 0 && st.length > 1) { const pa = st[st.length - 2].node, s = B.nullAt(pos, pa, memo.side[pa]); if (s) items.push({ key: 'nullspot', kind: 'ring', x: s.x, y: s.y + 26, r: 20, cls: 'bx-null' }); }
      if (topF) items.push({ key: 'call', kind: 'text', x: box.x0 - 24, y: box.y1 + 124, text: 'is_bst(' + B.name(d, top) + ', lo = ' + bound(topF.lo) + ', hi = ' + bound(topF.hi) + ')', cls: 'bx-code' });
      const nm = (a) => B.name(d, a);
      let say = '';
      switch (tag) {
        case 'enter': say = 'is_bst(root, INT_MIN, INT_MAX): the root may hold any key. Every node will be checked against a window (lo, hi), written above it. ' + (changed ? 'One key was changed after the tree was built: ' + inp.change + ' became ' + inp.into + '.' : 'The tree was built by insertion and not changed.'); break;
        case 'base': say = top ? 'node is ' + nm(top) + '; its window is (' + bound(topF.lo) + ', ' + bound(topF.hi) + ').' : 'An empty subtree is always fine.'; break;
        case 'empty': say = 'Return 1.'; break;
        case 'compare-bounds': say = breaks ? 'Is ' + tn.key + ' inside (' + bound(topF.lo) + ', ' + bound(topF.hi) + ')? No. ' + (localOk(top) ? 'Compared only with its parent, ' + tn.key + ' looks fine, but an ancestor further up rules it out.' : 'It is even on the wrong side of its own parent.') : 'Is ' + tn.key + ' inside (' + bound(topF.lo) + ', ' + bound(topF.hi) + ')? Yes.'; break;
        case 'fail': say = 'Return 0: the tree is not a binary search tree. A search for ' + nm(memo.bad) + ' from the root would go the wrong way and never find it.'; break;
        case 'go-left': { const pa = B.node(d, st[st.length - 2].node); say = 'Check the left subtree of ' + pa.key + '. Everything there must be below ' + pa.key + ', so the window becomes (' + bound(st[st.length - 2].lo) + ', ' + pa.key + '): hi shrinks to ' + pa.key + '.'; break; }
        case 'go-right': { const pa = B.node(d, st[st.length - 2].node); say = 'Then the right subtree of ' + pa.key + ': everything there must be above ' + pa.key + ', so lo rises to ' + pa.key + ': window (' + pa.key + ', ' + bound(st[st.length - 2].hi) + ').'; break; }
        case 'pass-fail': say = 'The left subtree failed, so this call fails too: return 0, without looking at the right subtree.'; break;
        case 'after': say = memo.bad ? 'main prints "not a BST". The culprit is ' + nm(memo.bad) + '. ' + (localOk(memo.bad) ? 'It was fine next to its parent; only the window, set by an ancestor, caught it.' : 'Here a check against the parent alone would also have caught it.') : 'main prints "a BST": every key sat inside its window.'; break;
      }
      return { items, say, slow: tag === 'fail' || (tag === 'compare-bounds' && breaks) };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'enter' && ts.some((u) => u.tag === 'fail'), once: true, ask: 'This tree is not a binary search tree. Click the node that breaks the rule.', answer: (ts) => { for (let j = 1; j < ts.length; j++) if (ts[j].tag === 'fail') { const s = ts[j - 1].data.stack; return 'n' + s[s.length - 1].node; } return null; }, explain: () => 'Compare each key with every ancestor, not only with its parent.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'go-right' && ts[i + 1].data.stack.length >= 3, once: true, ask: 'The right subtree is checked next. What will its window be?', options: (ts, i) => { const s = ts[i + 1].data.stack[ts[i + 1].data.stack.length - 1]; const a = '(' + bound(s.lo) + ', ' + bound(s.hi) + ')'; return [a, '(-inf, +inf)', '(' + bound(s.lo) + ', +inf)'].filter((x, k, arr) => arr.indexOf(x) === k); }, pick: 'option', answer: (ts, i) => { const s = ts[i + 1].data.stack[ts[i + 1].data.stack.length - 1]; return '(' + bound(s.lo) + ', ' + bound(s.hi) + ')'; }, explain: () => 'lo rises to the parent\'s key; hi is passed down unchanged from the parent\'s window.' },
    ],
    quiz: [
      { q: 'Is checking left->key < key < right->key at every node enough?', options: ['Yes', 'No: a key deep down can break a rule set by a grandparent', 'Only for balanced trees', 'Only for leaves'], answer: 1, why: '55 as the right child of 30, under 50 on the left, passes the local check but is bigger than 50.' },
      { q: 'Going to the left child of a node with key 40 and window (30, 50), the new window is...', options: ['(30, 50)', '(30, 40)', '(40, 50)', '(-inf, 40)'], answer: 1, why: 'Left means smaller than 40, and still above 30 from further up.' },
      { q: 'Why INT_MIN and INT_MAX for the root?', options: ['They are faster', 'The root has no ancestors, so no limits', 'C requires it', 'To store the height'], answer: 1, why: 'They stand for no bound at all. (A key equal to INT_MIN would need another way of saying it.)' },
      { q: 'Another correct test: walk the tree in order and check that...', options: ['the keys come out in increasing order', 'the height is small', 'every leaf is at the same depth', 'the root is the median'], answer: 0, why: 'A binary search tree is exactly a tree whose in-order walk is sorted.' },
    ],
  });

  // ---- build a balanced tree from a sorted array -------------------------------------------------------
  X.topic({
    id: 'bst-from-sorted', family: 'bst', order: 60, title: 'Build from a sorted array',
    blurb: 'The middle element becomes the root, the left half builds the left subtree and the right half the right. Every node ends up right under its place in the array.',
    code: `/* a balanced tree holding a[lo..hi], which is in increasing order */
struct node *from_sorted(const int *a, int lo, int hi)
{
    int mid;
    struct node *node;
    if (lo > hi)                                  /*@ base */
        return NULL;                              /*@ empty */
    mid = (lo + hi) / 2;                          /*@ mid */
    node = new_node(a[mid]);                      /*@ make */
    node->left = from_sorted(a, lo, mid - 1);     /*@ go-left */
    node->right = from_sorted(a, mid + 1, hi);    /*@ go-right */
    return node;                                  /*@ return */
}`,
    animate: ['from_sorted'], quiet: ['new_node'],
    inputs: [{ id: 'a', kind: 'ints', label: 'Sorted keys', def: [10, 20, 30, 40, 50, 60, 70], min: 1, max: 15, distinct: true, sorted: true }],
    presets: [
      { label: 'Seven keys: a perfect tree', values: { a: [10, 20, 30, 40, 50, 60, 70] } },
      { label: 'Ten keys', values: { a: [3, 8, 12, 19, 25, 31, 40, 46, 52, 60] } },
      { label: 'Two keys', values: { a: [5, 9] } },
      { label: 'Fifteen keys', values: { a: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] } },
    ],
    main: (inp) => `int main(void)
{
    int a[] = { ${inp.a.join(', ')} };
    struct node *root = NULL;
    root = from_sorted(a, 0, ${inp.a.length - 1});
    return 0;
}`,
    capture: B.capture({ cursors: ['node'], fn: 'from_sorted', vars: ['lo', 'hi', 'mid', 'node'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, a = ctx.input.a, memo = ctx.memo;
      memo.depth = memo.depth || {};
      memo.side = memo.side || {};
      const st = d.stack, topF = st[st.length - 1] || null;
      const DX = T.DX, DY = T.DY, AY = -170;
      const idx = (n) => a.indexOf(n.key);
      // a new node's depth is the depth of the call that made it
      for (const n of d.nodes) if (memo.depth[n.addr] === undefined) memo.depth[n.addr] = Math.max(0, st.length - 1);
      if (tag === 'go-left' || tag === 'go-right') memo.side[st[st.length - 2].node] = tag === 'go-left' ? 'left' : 'right';
      const pos = new Map();
      for (const n of d.nodes) pos.set(n.addr, { x: idx(n) * DX, y: memo.depth[n.addr] * DY, depth: memo.depth[n.addr] });
      const made = new Set(d.nodes.map((n) => n.key));
      const prevKeys = ctx.prev && ctx.prev.data.nodes ? new Set(ctx.prev.data.nodes.map((n) => n.addr)) : new Set();
      const onStack = new Set(st.map((f) => f.node).filter(Boolean));
      const top = topF && topF.node;
      const pic = B.picture(ctx, d, {
        pos,
        noRoot: tag !== 'after',
        nodeCls: (n) => (n.addr === top ? 'focus' : onStack.has(n.addr) ? 'part-b' : ''),
        showNull: tag === 'after',
        cursors: [],
      });
      const items = pic.items;
      // a new node flies down from its array cell
      for (const it of items) if (it.kind === 'vertex' && !prevKeys.has(+it.key.slice(1)) && ctx.prev) { it.enter = 'fly'; const n = B.node(d, +it.key.slice(1)); it.from = { x: idx(n) * DX, y: AY + 18 }; }
      // the array, with the part this call owns
      a.forEach((v, i) => {
        const isMid = topF && topF.mid !== null && topF.mid === i && ['mid', 'make'].includes(tag);
        items.push({ key: 'a' + i, kind: 'cell', x: i * DX - 24, y: AY, w: 48, h: 36, text: v, sub: String(i), cls: isMid ? 'pivot' : made.has(v) ? 'done' : '' });
      });
      items.push({ key: 'a-t', kind: 'text', x: -24, y: AY - 14, text: 'a[]', cls: 'bx-title' });
      if (topF && topF.lo <= topF.hi) items.push({ key: 'own', kind: 'region', x: topF.lo * DX - 32, y: AY - 8, w: (topF.hi - topF.lo) * DX + 64, h: 72, cls: 'bx-arr', enter: 'grow' });
      if (topF && topF.lo > topF.hi) items.push({ key: 'own', kind: 'region', x: topF.lo * DX - 36, y: AY - 8, w: 8, h: 72, cls: 'bx-arr' });
      if (topF && topF.mid !== null && ['mid', 'make'].includes(tag)) {
        const x = topF.mid * DX, y = (st.length - 1) * DY;
        items.push({ key: 'drop', kind: 'line', x1: x, y1: AY + 40, x2: x, y2: y - 28, cls: 'hot' });
      }
      if (topF && topF.lo > topF.hi && st.length > 1) { const pa = st[st.length - 2].node, s = B.nullAt(pos, pa, memo.side[pa]); if (s) items.push({ key: 'nullspot', kind: 'ring', x: s.x, y: s.y + 26, r: 18, cls: 'bx-null' }); }
      // the calls, each with its slice of the array
      const rows = st.map((f, i) => ({ text: 'from_sorted(a, ' + f.lo + ', ' + f.hi + ')' + (f.mid !== null && i < st.length - 1 ? ': ' + memo.side[f.node] : ''), tcls: i === st.length - 1 ? 'bx-hot' : 'bx-muted' }));
      const xs = a.length ? { x0: 0, x1: (a.length - 1) * DX, y0: 0, y1: Math.max(1, ...Object.values(memo.depth), Math.ceil(Math.log2(a.length + 1)) - 1) * DY } : { x0: 0, x1: 0, y0: 0, y1: 0 };
      if (rows.length) { const la = B.ladderAt(ctx, xs, 280); items.push(...B.ladder(rows, la.x, la.y + 40, 'lad', 280)); }
      const lo = topF ? topF.lo : 0, hi = topF ? topF.hi : 0;
      const nmk = (i) => a[i];
      let say = '';
      switch (tag) {
        case 'enter': say = 'from_sorted(a, 0, ' + (a.length - 1) + '): build a tree from ' + plural(a.length, 'sorted key') + '. The array is already in order, so each key\'s place in the tree is fixed: right under its cell.'; break;
        case 'base': say = lo > hi ? 'lo = ' + lo + ' > hi = ' + hi + ': an empty slice. There is nothing to build here.' : 'This call owns a[' + lo + '..' + hi + ']: ' + plural(hi - lo + 1, 'key') + '.'; break;
        case 'empty': say = 'Return NULL: the empty subtree.'; break;
        case 'mid': say = 'mid = (' + lo + ' + ' + hi + ') / 2 = ' + topF.mid + '. a[' + topF.mid + '] = ' + nmk(topF.mid) + ' has as many keys on its left as on its right (give or take one), so it becomes the root of this subtree.'; break;
        case 'make': say = 'A new node holding ' + nmk(topF.mid) + ' drops into place, at depth ' + (st.length - 1) + ', under its own cell.'; break;
        case 'go-left': { const f = st[st.length - 2]; say = 'Build the left subtree of ' + nmk(f.mid) + ' from a[' + f.lo + '..' + (f.mid - 1) + ']. ' + (f.mid - f.lo === 0 ? 'That slice is empty.' : ''); break; }
        case 'go-right': { const f = st[st.length - 2]; say = 'Now the right subtree of ' + nmk(f.mid) + ' from a[' + (f.mid + 1) + '..' + f.hi + ']. ' + (f.hi - f.mid === 0 ? 'That slice is empty.' : ''); break; }
        case 'return': { const f = topF && topF.mid !== null ? topF : null; say = f ? 'Both subtrees of ' + nmk(f.mid) + ' are built and linked. Return it to the caller, which links it in turn.' : 'Return the node.'; break; }
        case 'after': { const h = Math.max(...Object.values(memo.depth)) + 1; say = 'main stores the root, ' + B.name(d, d.root) + '. ' + plural(a.length, 'key') + ', height ' + h + ': as low as a tree with ' + a.length + ' keys can be.' + (a.length > 2 ? ' Inserting the same keys in sorted order would have made a chain of height ' + a.length + '.' : ''); break; }
      }
      return { items, say, slow: tag === 'make' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'mid', once: true, ask: 'Which key becomes the root of the whole tree?', options: (ts, i, ctx) => { const a = ctx.input.a; return [...new Set([a[0], a[Math.floor((a.length - 1) / 2)], a[a.length - 1]])].map(String); }, pick: 'option', answer: (ts, i, ctx) => String(ctx.input.a[Math.floor((ctx.input.a.length - 1) / 2)]), explain: () => 'The middle element: half the keys go left, half go right.' },
      { at: (t) => t.tag === 'go-right' && t.data.stack.length === 2, once: true, ask: 'The left half is done. Which key will be the root of the right subtree?', options: (ts, i, ctx) => { const a = ctx.input.a, f = ts[i].data.stack[0]; const m = Math.floor((f.mid + 1 + f.hi) / 2); return [...new Set([a[f.mid + 1], a[m], a[f.hi]])].filter((x) => x !== undefined).map(String); }, pick: 'option', answer: (ts, i, ctx) => { const a = ctx.input.a, f = ts[i].data.stack[0]; return String(a[Math.floor((f.mid + 1 + f.hi) / 2)]); }, explain: () => 'The middle of the right half, a[mid+1..hi].' },
    ],
    quiz: [
      { q: 'Why does each node end up right under its array cell?', options: ['By chance', 'In-order position in the tree equals position in the sorted array', 'Because of the stack', 'Only for 7 keys'], answer: 1, why: 'The tree is a binary search tree of exactly these keys, so its in-order walk is the sorted array.' },
      { q: 'What is the height of the tree built from 15 sorted keys?', options: ['15', '4', '8', '3'], answer: 1, why: 'Each level halves the slice: 15, 7, 3, 1. Four levels.' },
      { q: 'How many times is new_node called for n keys?', options: ['log n', 'n', '2n', 'n log n'], answer: 1, why: 'Each key becomes the middle of exactly one call.' },
      { q: 'What does the call with lo > hi return?', options: ['A node holding 0', 'NULL: an empty subtree', 'The parent', 'It is never made'], answer: 1, why: 'An empty slice builds an empty subtree, which the caller stores in its left or right field.' },
    ],
  });
})(SEE);
