// Binary search trees: search, recursive insert, delete.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, T = X.TreeKit, B = X.BstKit;
  const keyIn = { id: 'key', kind: 'int', lo: -999, hi: 999 };
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  // ---- search (iterative) -------------------------------------------------------------------------------
  X.topic({
    id: 'bst-search', family: 'bst', order: 5, title: 'Search for a key',
    blurb: 'One comparison per level. Each time the search turns, the node and the whole subtree on the other side are ruled out.',
    code: `/* the node holding key, or NULL if key is not in the tree */
struct node *search(struct node *root, int key)
{
    struct node *cur = root;          /*@ start */
    while (cur != NULL) {             /*@ walk */
        if (key == cur->key)          /*@ compare-eq */
            return cur;               /*@ found */
        if (key < cur->key)           /*@ compare */
            cur = cur->left;          /*@ go-left */
        else
            cur = cur->right;         /*@ go-right */
    }
    return NULL;                      /*@ missing */
}`,
    animate: ['search'],
    inputs: [X.bstKeys, Object.assign({}, keyIn, { label: 'Search for', def: 60 })],
    presets: [
      { label: 'Found at the bottom', values: { keys: [50, 30, 70, 20, 40, 60, 80], key: 60 } },
      { label: 'Not in the tree', values: { keys: [50, 30, 70, 20, 40, 60, 80], key: 45 } },
      { label: 'Found at once (the root)', values: { keys: [50, 30, 70, 20, 40, 60, 80], key: 50 } },
      { label: 'A chain: no halving', values: { keys: [10, 20, 30, 40, 50, 60], key: 60 } },
      { label: 'Fifteen keys', values: { keys: [80, 40, 120, 20, 60, 100, 140, 10, 30, 50, 70, 90, 110, 130, 150], key: 110 } },
    ],
    main: (inp) => X.bstMain(inp.keys, 'found = search(root, ' + inp.key + ');\n    printf("%s\\n", found != NULL ? "found" : "not found");', 'struct node *found;'),
    capture: B.capture({ cursors: ['cur'], extra: (P) => ({ found: P.isSet('found') ? P.val('found') : null }) }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, memo = ctx.memo;
      memo.out = memo.out || new Set();
      memo.path = memo.path || [];
      let cur = d.cursors.cur;
      if (cur) memo.cur = cur;
      if (cur === undefined && (tag === 'found' || tag === 'after')) cur = memo.cur;
      let cut = 0;
      if ((tag === 'go-left' || tag === 'go-right') && ctx.prev) {
        const was = ctx.prev.data.cursors.cur, n = B.node(d, was);
        if (n) {
          const gone = B.subtree(d, tag === 'go-left' ? n.links.right : n.links.left);
          gone.add(was);
          for (const a of gone) if (!memo.out.has(a)) { memo.out.add(a); cut++; }
          memo.last = { addr: was, side: tag === 'go-left' ? 'left' : 'right' };
        }
      }
      if (tag === 'walk' && cur && !memo.path.includes(cur)) memo.path.push(cur);
      const hit = (tag === 'found' || tag === 'after') && memo.cur && B.node(d, memo.cur) && B.node(d, memo.cur).key === key ? memo.cur : 0;
      const path = new Set(memo.path);
      const pic = B.picture(ctx, d, {
        nodeCls: (n) => (n.addr === hit ? 'done' : memo.out.has(n.addr) ? 'ghost' : n.addr === cur ? 'focus' : path.has(n.addr) ? 'part-a' : ''),
        edgeCls: (n, side) => (path.has(n.addr) && path.has(n.links[side]) ? 'part-a' : memo.out.has(n.links[side]) ? 'ghost' : ''),
        showNull: true,
        cursors: cur && !hit && tag !== 'after' && tag !== 'missing' ? [['cur', cur]] : [],
      });
      const items = pic.items, pos = pic.pos, box = B.box(pos);
      const total = d.nodes.length;
      const left = total - memo.out.size;
      if (cur && !hit && tag !== 'missing' && tag !== 'after') {
        const z = B.region(pos, B.subtree(d, cur), 'zone', 'bx-sub');
        if (z) items.push(z);
      }
      const at = cur && pos.get(cur);
      const n = B.node(d, cur);
      if (at && !hit && !['missing', 'after'].includes(tag)) {
        items.push({ key: 'tok', kind: 'token', x: at.x + 44, y: at.y - 30, r: 16, text: String(key), cls: 'c-rose' });
        if (tag === 'compare-eq' || tag === 'compare') {
          const eq = tag === 'compare-eq';
          items.push({ key: 'q', kind: 'text', x: at.x + 66, y: at.y - 25, text: eq ? key + (key === n.key ? ' == ' : ' != ') + n.key : key + (key < n.key ? ' < ' : ' > ') + n.key + (key < n.key ? ': go left' : ': go right'), cls: 'bx-hot' });
        }
      }
      if (hit) { const p = pos.get(hit); items.push({ key: 'tok', kind: 'token', x: p.x + 44, y: p.y - 30, r: 16, text: String(key), cls: 'c-green' }); }
      // fallen off the tree: the empty place where the key would have been
      if ((tag === 'missing' || (tag === 'after' && !hit) || (tag === 'walk' && !cur)) && memo.last) {
        const s = B.nullAt(pos, memo.last.addr, memo.last.side);
        if (s) {
          items.push({ key: 'nullspot', kind: 'ring', x: s.x, y: s.y + 10, r: 18, cls: 'bx-null' });
          items.push({ key: 'tok', kind: 'token', x: s.x, y: s.y + 10, r: 16, text: String(key), cls: 'c-rose' });
          items.push({ key: 'q', kind: 'text', x: s.x, y: s.y + 48, text: 'NULL: not here', anchor: 'middle', cls: 'bx-bad' });
        }
      }
      if (total) {
        items.push({ key: 'score', kind: 'text', x: box.x0 - 20, y: box.y1 + 140, text: 'still possible: ' + left + ' of ' + total + ' keys', cls: 'bx-big' });
        items.push({ key: 'score2', kind: 'text', x: box.x0 - 20, y: box.y1 + 164, text: 'nodes looked at: ' + memo.path.length, cls: 'note' });
      }
      const nm = (a) => B.name(d, a);
      let say = '';
      switch (tag) {
        case 'enter': say = 'search(root, ' + key + '): the tree has ' + plural(total, 'key') + '. Each comparison will rule out a node and one of its subtrees.'; break;
        case 'start': say = total ? 'cur starts at the root, ' + nm(cur) + '. Every one of the ' + total + ' keys could still be ' + key + '.' : 'The tree is empty: cur starts as NULL.'; break;
        case 'walk': say = cur ? 'cur is at ' + nm(cur) + ', not NULL: there is still a node to look at.' : 'cur is NULL: the search has fallen off the tree. If ' + key + ' were in the tree, it would have to be right here.'; break;
        case 'compare-eq': say = key === n.key ? 'Is ' + key + ' equal to ' + n.key + '? Yes.' : 'Is ' + key + ' equal to ' + n.key + '? No, so keep going.'; break;
        case 'found': say = 'Found ' + key + ' after looking at ' + plural(memo.path.length, 'node') + ', out of ' + total + '. search() returns its address.'; break;
        case 'compare': {
          const other = B.subtree(d, key < n.key ? n.links.right : n.links.left).size;
          say = key + (key < n.key ? ' < ' : ' > ') + n.key + ', so if ' + key + ' is anywhere, it is in the ' + (key < n.key ? 'left' : 'right') + ' subtree. ' + n.key + ' and the ' + plural(other, 'key') + ' on its ' + (key < n.key ? 'right' : 'left') + ' are ruled out.';
          break;
        }
        case 'go-left': case 'go-right': say = 'cur moves ' + (tag === 'go-left' ? 'left' : 'right') + ' to ' + nm(cur) + '. ' + plural(cut, 'key') + ' greyed out without being looked at; ' + left + ' still possible.'; break;
        case 'missing': say = 'search() returns NULL: ' + key + ' is not in the tree. It looked at ' + plural(memo.path.length, 'node') + ' to be sure, not all ' + total + '.'; break;
        case 'after': say = hit ? 'main gets the address of the node holding ' + key + ' and prints "found".' : 'main gets NULL and prints "not found".'; break;
      }
      return { items, say, slow: tag === 'found' };
    },
    predict: [
      { at: (t) => t.tag === 'start', once: true, ask: (t, ts, i, ctx) => 'Is ' + ctx.input.key + ' in the tree? Watch the search to check.', options: () => ['Yes', 'No'], pick: 'option', answer: (ts, i, ctx) => (ctx.input.keys.includes(ctx.input.key) ? 'Yes' : 'No') },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'compare' && !!t.data.cursors.cur, once: true, ask: (t, ts, i, ctx) => 'Which way does ' + ctx.input.key + ' go from here?', options: () => ['Left', 'Right'], pick: 'option', answer: (ts, i, ctx) => { const d = ts[i].data, n = B.node(d, d.cursors.cur); return ctx.input.key < n.key ? 'Left' : 'Right'; }, explain: () => 'Smaller keys live in the left subtree, bigger ones in the right.' },
      { at: (t, i, ts) => t.tag === 'walk' && !!t.data.cursors.cur && ts.slice(i).some((u) => u.tag === 'missing'), once: true, ask: 'This search will fail. Click the node it will fall off from.', answer: (ts) => { let last = 0; for (const u of ts) if (u.data && u.data.cursors && u.data.cursors.cur) last = u.data.cursors.cur; return last ? 'n' + last : null; }, explain: () => 'It falls off below the last node it compares with: that empty place is where the key would have to be.' },
    ],
    quiz: [
      { q: 'Searching for 45 reaches 50 and goes left. Which keys can it skip?', options: ['Only 50', '50 and every key in its right subtree', 'Every key bigger than 45 in the whole tree', 'None, it may need to come back'], answer: 1, why: 'Everything in 50\'s right subtree is bigger than 50, so it cannot be 45. The search never comes back up.' },
      { q: 'A search fails when cur becomes NULL. What does that NULL place mean?', options: ['The tree is broken', 'It is where the key would be if it were in the tree', 'The key is at the root', 'The key is a duplicate'], answer: 1, why: 'Every turn was forced by the comparisons, so the key could only have been in that one place. Insert would put it there.' },
      { q: 'How many nodes does a search look at in a tree of height h?', options: ['Exactly h', 'At most h', 'Always all n', 'log n, always'], answer: 1, why: 'One node per level at most. In a balanced tree h is about log2 n; in a chain h is n.' },
      { q: 'Keys 10, 20, 30, 40, 50, 60 inserted in that order. How many nodes does a search for 60 look at?', options: ['1', '3', '6', '2'], answer: 2, why: 'Sorted input makes a chain to the right, and each comparison rules out only one node.' },
    ],
  });

  // ---- insert (recursive) -------------------------------------------------------------------------------
  // the calls go down; on the way back every call stores what the call below it returned
  const ladderRows = (d, list, memo, done, key) => list.map((a, i) => {
    const k = B.name(d, a);
    const side = memo.side[a];
    if (i < list.length - 1) return { text: k + '->' + side + ' = insert(...)', tcls: 'bx-muted' };
    if (done === 'make') return { text: 'insert(NULL) returns new ' + key, cls: 'bx-done', tcls: 'bx-good' };
    if (done === 'return') return { text: (side ? k + '->' + side + ' set, ' : '') + 'returns ' + k, cls: 'bx-done', tcls: 'bx-good' };
    return { text: 'insert(' + k + ', ' + key + ')', tcls: 'bx-hot' };
  });
  X.topic({
    id: 'bst-insert-rec', family: 'bst', order: 11, title: 'Insert a key (recursive)',
    blurb: 'Each call hands the job to a call on one subtree. On the way back up, every call stores the answer in its own link, even when nothing changed.',
    code: `/* insert key into the subtree at node; return the subtree's root */
struct node *insert(struct node *node, int key)
{
    if (node == NULL)                            /*@ base */
        return new_node(key);                    /*@ make */
    if (key < node->key)                         /*@ compare */
        node->left = insert(node->left, key);    /*@ relink-left */
    else if (key > node->key)                    /*@ compare-right */
        node->right = insert(node->right, key);  /*@ relink-right */
    return node;                                 /*@ return */
}`,
    animate: ['insert'], quiet: ['new_node'],
    inputs: [X.bstKeys, Object.assign({}, keyIn, { label: 'Insert', def: 45 })],
    presets: [
      { label: 'Three levels down', values: { keys: [50, 30, 70, 20, 40, 60, 80], key: 45 } },
      { label: 'Into an empty tree', values: { keys: [], key: 42 } },
      { label: 'A key already there', values: { keys: [50, 30, 70, 20, 40], key: 40 } },
      { label: 'Under the root', values: { keys: [50, 70], key: 30 } },
    ],
    main: (inp) => X.bstMain(inp.keys, 'root = insert(root, ' + inp.key + ');'),
    capture: B.capture({ cursors: ['node'], fn: 'insert', vars: ['node'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, memo = ctx.memo;
      memo.side = memo.side || {};
      const st = d.stack.map((f) => f.node);
      // a return line is pictured while the returning call is still on the stack
      const back = tag === 'make' || tag === 'return';
      if (tag === 'relink-left' || tag === 'relink-right') memo.side[st[st.length - 2]] = tag === 'relink-left' ? 'left' : 'right';
      const first = new Set(ctx.ticks[0].data.nodes.map((n) => n.addr));
      const fresh = (d.nodes.find((n) => !first.has(n.addr)) || {}).addr || 0;
      const list = st;
      const top = list.length ? list[list.length - 1] : undefined;
      const retFrom = back ? top : undefined;
      // a node just made waits at the empty place it will fill
      const L = B.layout(ctx, d);
      const pos = L.pos;
      const parent = list[list.length - 2];
      const linked = fresh && d.nodes.some((m) => m.links.left === fresh || m.links.right === fresh);
      if (fresh && !linked && parent && memo.side[parent]) { const s = B.nullAt(pos, parent, memo.side[parent]); if (s) pos.set(fresh, { x: s.x, y: s.y + 26, depth: 0 }); }
      const onPath = new Set(list.filter(Boolean));
      const pic = B.picture(ctx, d, {
        pos,
        nodeCls: (n) => (n.addr === fresh ? 'part-b' : n.addr === top ? 'focus' : onPath.has(n.addr) ? 'part-a' : ''),
        edgeCls: (n, side) => (tag === 'return' && n.addr === retFrom && memo.side[n.addr] === side ? 'hot' : onPath.has(n.addr) && (onPath.has(n.links[side]) || n.links[side] === fresh) ? 'part-a' : ''),
        showNull: true,
        cursors: top && !back ? [['node', top]] : [],
      });
      const items = pic.items, box = B.box(pos);
      if (top && !back) { const z = B.region(pos, B.subtree(d, top), 'zone', 'bx-sub'); if (z) items.push(z); }
      // the call on an empty subtree: a dashed place under its parent
      if (top === 0 && list.length > 1 && tag !== 'make') {
        const s = B.nullAt(pos, list[list.length - 2], memo.side[list[list.length - 2]]);
        if (s) { items.push({ key: 'nullspot', kind: 'ring', x: s.x, y: s.y + 26, r: 22, cls: 'bx-null' }); items.push({ key: 'nulltext', kind: 'text', x: s.x, y: s.y + 64, text: 'NULL', anchor: 'middle', cls: 'null-mark' }); items.push({ key: 'tok', kind: 'token', x: s.x + 36, y: s.y + 4, r: 16, text: String(key), cls: 'c-rose' }); }
      }
      const at = top && pos.get(top);
      if (at && !back) {
        items.push({ key: 'tok', kind: 'token', x: at.x + 44, y: at.y - 30, r: 16, text: String(key), cls: 'c-rose' });
        const nk = B.node(d, top).key;
        if (tag === 'compare' || tag === 'compare-right') items.push({ key: 'q', kind: 'text', x: at.x + 66, y: at.y - 25, text: key < nk ? key + ' < ' + nk + ': left' : key > nk ? key + ' > ' + nk + ': right' : key + ' == ' + nk + ': already here', cls: 'bx-hot' });
      }
      // the link being stored on the way back
      if (tag === 'return' && retFrom && memo.side[retFrom]) {
        const n = B.node(d, retFrom), c = n && n.links[memo.side[retFrom]], p = pos.get(retFrom), q = c && pos.get(c);
        const changed = ctx.prev && B.node(ctx.prev.data, retFrom) && B.node(ctx.prev.data, retFrom).links[memo.side[retFrom]] !== c;
        if (p && q) items.push({ key: 'setlbl', kind: 'text', x: (p.x + q.x) / 2 + (memo.side[retFrom] === 'left' ? -14 : 14), y: (p.y + q.y) / 2 - 4, anchor: memo.side[retFrom] === 'left' ? 'end' : 'start', text: changed ? 'set: new link' : 're-set, same', cls: changed ? 'bx-good' : 'bx-hot' });
      }
      if (list.length) { const la = B.ladderAt(ctx, box, 270); items.push(...B.ladder(ladderRows(d, list, memo, back ? tag : '', key), la.x, la.y, 'lad', 270)); }
      const nm = (a) => B.name(d, a);
      const caller = list[list.length - 2];
      let say = '';
      switch (tag) {
        case 'enter': say = 'main calls insert(root, ' + key + ')' + (d.root ? '. This call only has to deal with the tree under ' + nm(d.root) + ', and it may hand part of the job to a call on a subtree.' : ' on an empty tree.'); break;
        case 'base': say = top ? 'node is ' + nm(top) + ', not NULL, so this call must decide which subtree ' + key + ' belongs in.' : 'node is NULL: this call has reached an empty subtree. That is where ' + key + ' goes.'; break;
        case 'make': say = 'insert(NULL) makes a new node holding ' + key + ' and returns its address. Nothing points to it yet: the caller' + (parent ? ', insert(' + nm(parent) + '),' : '') + ' will store it.'; break;
        case 'compare': { const nk = B.node(d, top).key; say = key < nk ? key + ' < ' + nk + ': the new key belongs in ' + nk + '\'s left subtree.' : key + ' is not smaller than ' + nk + '.'; break; }
        case 'compare-right': { const nk = B.node(d, top).key; say = key > nk ? key + ' > ' + nk + ': it belongs in ' + nk + '\'s right subtree.' : key + ' equals ' + nk + ': it is already in the tree, so this call changes nothing and just returns ' + nk + '.'; break; }
        case 'relink-left': case 'relink-right': {
          const side = tag === 'relink-left' ? 'left' : 'right';
          say = 'insert(' + nm(caller) + ') calls insert on its ' + side + ' subtree (' + nm(top) + ') and waits. Whatever comes back will be stored in ' + nm(caller) + '->' + side + '. ' + plural(list.length, 'call') + ' now open.';
          break;
        }
        case 'return': {
          const side = memo.side[retFrom];
          if (!side) { say = 'insert(' + nm(retFrom) + ') returns ' + nm(retFrom) + ' unchanged.'; break; }
          const c = B.node(d, retFrom).links[side];
          const changed = ctx.prev && B.node(ctx.prev.data, retFrom).links[side] !== c;
          say = changed ? 'Back in insert(' + nm(retFrom) + '): ' + nm(retFrom) + '->' + side + ' = the new node. This is the one assignment that changes the tree. Then it returns ' + nm(retFrom) + '.' : 'Back in insert(' + nm(retFrom) + '): ' + nm(retFrom) + '->' + side + ' = ' + nm(c) + ', the address it already held. The assignment happens anyway; nothing changes. Then it returns ' + nm(retFrom) + '.';
          break;
        }
        case 'after': say = 'Back in main: root = insert(root, ' + key + ') stores ' + nm(d.root) + (d.root === fresh ? ', the new node: the tree had been empty.' : fresh ? ' in root, the same as before. Every call on the path re-wrote its link; only one link really changed.' : ' in root again. ' + key + ' was already there, so every link was re-written with the value it already had.'); break;
      }
      return { items, say, slow: tag === 'make' || tag === 'return' };
    },
    predict: [
      { at: (t) => (t.tag === 'relink-left' || t.tag === 'relink-right') && t.data.stack.length === 2 && !!t.data.stack[1].node, once: true, ask: (t) => 'When this call returns, will the root\'s ' + (t.tag === 'relink-left' ? 'left' : 'right') + ' link point somewhere new?', options: () => ['Yes', 'No'], pick: 'option', answer: () => 'No', explain: () => 'The call below returns the root of its own subtree, which is the node the link already points to. The link is re-assigned with the same value.' },
      { at: (t) => t.tag === 'make' && t.data.stack.length > 1, once: true, ask: 'A new node has been made. Click the node whose link will point to it.', answer: (ts, i) => 'n' + ts[i].data.stack[ts[i].data.stack.length - 2].node, explain: () => 'The call that made the recursive call on the empty subtree stores the returned address in its own left or right field.' },
    ],
    quiz: [
      { q: 'Why does insert() return a pointer instead of returning nothing?', options: ['To report errors', 'So a call on an empty subtree can hand the new node to its parent, which stores it', 'To make it faster', 'C requires it'], answer: 1, why: 'A call on NULL cannot change its parent\'s link itself. Returning the new subtree root lets the caller store it.' },
      { q: 'Inserting 45 three levels down: how many link assignments happen on the way back?', options: ['1', 'One per call that recursed: 3', 'None', '7'], answer: 1, why: 'Every call on the path does node->left = ... or node->right = .... Only the last one changes anything; the others store the same address again.' },
      { q: 'What does main do with the value insert() returns?', options: ['Nothing', 'Stores it in root', 'Frees it', 'Prints it'], answer: 1, why: 'root = insert(root, key). For an empty tree this is how root gets its first node.' },
      { q: 'What happens if the key is already in the tree?', options: ['A second node is added', 'The program crashes', 'Neither comparison is true, so the call returns node and nothing changes', 'The old node is replaced'], answer: 2, why: 'key < node->key and key > node->key are both false. The call returns node, and every caller re-stores the same links.' },
      { q: 'How deep does the recursion go for a tree of height h?', options: ['At most h + 1 calls', 'Always n calls', 'log n calls', '2h calls'], answer: 0, why: 'One call per level, plus the call on the empty subtree at the bottom.' },
    ],
    compareWith: 'bst-insert',
  });

  // ---- delete -------------------------------------------------------------------------------------------
  X.topic({
    id: 'bst-delete', family: 'bst', order: 20, title: 'Delete a key',
    blurb: 'A leaf just goes. A node with one child is replaced by that child. A node with two children takes its successor\'s key, and the successor is deleted instead.',
    code: `/* the node with the smallest key in a non-empty subtree */
struct node *min_node(struct node *node)
{
    while (node->left != NULL)                         /*@ hunt */
        node = node->left;                             /*@ step-left */
    return node;                                       /*@ found-min */
}

/* remove key from the subtree at node; return the subtree's new root */
struct node *delete_key(struct node *node, int key)
{
    struct node *child, *succ;
    if (node == NULL)                                  /*@ base */
        return NULL;                                   /*@ missing */
    if (key < node->key)                               /*@ compare */
        node->left = delete_key(node->left, key);      /*@ relink-left */
    else if (key > node->key)                          /*@ compare-right */
        node->right = delete_key(node->right, key);    /*@ relink-right */
    else if (node->left == NULL || node->right == NULL) { /*@ test-kids */
        child = node->left != NULL ? node->left : node->right; /*@ pick-child */
        free(node);                                    /*@ free */
        return child;                                  /*@ lift */
    } else {
        succ = min_node(node->right);                  /*@ succ */
        node->key = succ->key;                         /*@ copy-key */
        node->right = delete_key(node->right, succ->key); /*@ relink-succ */
    }
    return node;                                       /*@ return */
}`,
    animate: ['delete_key', 'min_node'],
    inputs: [Object.assign({}, X.bstKeys, { def: [50, 30, 70, 20, 40, 60, 80, 65] }), Object.assign({}, keyIn, { label: 'Delete', def: 50 })],
    presets: [
      { label: 'Two children (the root)', values: { keys: [50, 30, 70, 20, 40, 60, 80, 65], key: 50 } },
      { label: 'A leaf', values: { keys: [50, 30, 70, 20, 40, 60, 80], key: 40 } },
      { label: 'One child: it moves up', values: { keys: [50, 30, 70, 20, 25, 60, 80], key: 30 } },
      { label: 'Two children, deeper', values: { keys: [50, 30, 80, 20, 40, 35, 45, 37], key: 30 } },
      { label: 'Not in the tree', values: { keys: [50, 30, 70, 20, 40], key: 45 } },
    ],
    main: (inp) => X.bstMain(inp.keys, 'root = delete_key(root, ' + inp.key + ');'),
    capture: B.capture({ cursors: ['node', 'child', 'succ'], fn: 'delete_key', vars: ['node', 'key'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo;
      memo.side = memo.side || {};
      const st = d.stack;
      const back = tag === 'missing' || tag === 'lift' || tag === 'return';
      const list = st;
      const topF = list[list.length - 1] || null;
      const top = topF ? topF.node : undefined;
      const fkey = topF ? topF.key : ctx.input.key;
      if (['relink-left', 'relink-right', 'relink-succ'].includes(tag)) memo.side[st[st.length - 2].node] = tag === 'relink-left' ? 'left' : 'right';
      if (tag === 'test-kids') memo.target = top;
      const inMin = d.top === 'min_node';
      if (inMin) memo.hunter = d.cursors.node;
      if (tag === 'found-min') memo.succ = ctx.prev.data.cursors.node;
      if (tag === 'test-kids' && memo.copied) memo.second = top;
      if (tag === 'copy-key') { memo.copied = { from: d.cursors.succ, to: top }; }
      const target = memo.target;
      const onPath = new Set(list.map((f) => f.node).filter(Boolean));
      const freed = d.nodes.find((n) => n.freed);
      const cursors = inMin ? [['node', d.cursors.node, 'c-teal']] : back ? [] : [['node', top], ['child', d.cursors.child], ['succ', d.cursors.succ, 'c-green']];
      const pic = B.picture(ctx, d, {
        nodeCls: (n) => (n.freed ? '' : memo.copied && n.addr === memo.copied.to && !['after'].includes(tag) ? 'part-b' : n.addr === memo.succ ? 'hot' : inMin && n.addr === d.cursors.node ? 'focus' : n.addr === top && !back ? (n.addr === target ? 'bad' : 'focus') : onPath.has(n.addr) ? 'part-a' : ''),
        edgeCls: (n, side) => { const c = B.node(d, n.links[side]); if (c && c.freed) return 'bad'; if (tag === 'return' && n.addr === top && memo.side[n.addr] === side) return 'hot'; return onPath.has(n.addr) && onPath.has(n.links[side]) ? 'part-a' : ''; },
        showNull: true,
        cursors: cursors.filter((c) => c[1]),
      });
      const items = pic.items, pos = pic.pos, box = B.box(pos);
      // the right subtree where the successor is hunted
      if ((tag === 'succ' || inMin || tag === 'found-min') && target) { const t = B.node(d, target); const z = B.region(pos, B.subtree(d, t.links.right), 'zone', 'bx-sub', 'the smallest key in here'); if (z) items.push(z); }
      else if (top && !back && !memo.copied && tag !== 'test-kids' && tag !== 'pick-child') { const z = B.region(pos, B.subtree(d, top), 'zone', 'bx-sub'); if (z) items.push(z); }
      // the node to delete, and its successor
      if (target && pos.get(target) && !B.node(d, target).freed && !memo.copied) {
        const p = pos.get(target);
        items.push({ key: 'ring-t', kind: 'ring', x: p.x, y: p.y, r: 31, cls: 'bx-bad' });
      }
      if (memo.succ && pos.get(memo.succ) && B.node(d, memo.succ) && !B.node(d, memo.succ).freed) {
        const p = pos.get(memo.succ);
        items.push({ key: 'ring-s', kind: 'ring', x: p.x, y: p.y, r: 31, cls: 'bx-cand2' });
        items.push({ key: 'lbl-s', kind: 'text', x: p.x, y: p.y + 52, text: memo.copied ? 'old copy' : 'successor', anchor: 'middle', cls: 'bx-a' });
      }
      if (memo.copied && pos.get(memo.copied.to) && tag !== 'after') { const p = pos.get(memo.copied.to); items.push({ key: 'lbl-c', kind: 'text', x: p.x + 32, y: p.y - 22, text: 'key copied in', cls: 'bx-b' }); }
      if (tag === 'copy-key') {
        const a = pos.get(memo.copied.from), b = pos.get(memo.copied.to);
        if (a && b) {
          items.push({ key: 'fly', kind: 'token', x: b.x - 34, y: b.y - 30, r: 15, text: String(B.node(d, memo.copied.to).key), cls: 'c-green', enter: 'fly', from: { x: a.x, y: a.y } });
          items.push({ key: 'flyarrow', kind: 'arrow', from: { key: 'n' + memo.copied.from }, to: { key: 'n' + memo.copied.to }, bend: 50, cls: 'bx-fly', label: 'copy the key' });
        }
      }
      // a returned child going up to the caller
      if (tag === 'lift' && list.length > 1) {
        const c = ctx.prev.data.cursors.child, par = list[list.length - 2].node;
        if (c && pos.get(c) && pos.get(par)) items.push({ key: 'flyarrow', kind: 'arrow', from: { key: 'n' + c }, to: { key: 'n' + par }, bend: -40, cls: 'bx-fly', label: 'returned' });
        else if (pos.get(par)) items.push({ key: 'q', kind: 'text', x: pos.get(par).x, y: pos.get(par).y - 40, text: 'gets NULL back', anchor: 'middle', cls: 'bx-hot' });
      }
      // the call on an empty subtree
      if (top === 0 && list.length > 1) {
        const pa = list[list.length - 2].node, s = B.nullAt(pos, pa, memo.side[pa]);
        if (s) { items.push({ key: 'nullspot', kind: 'ring', x: s.x, y: s.y + 26, r: 22, cls: 'bx-null' }); items.push({ key: 'nulltext', kind: 'text', x: s.x, y: s.y + 64, text: 'NULL', anchor: 'middle', cls: 'null-mark' }); items.push({ key: 'tok', kind: 'token', x: s.x + 36, y: s.y + 4, r: 16, text: String(fkey), cls: 'c-rose' }); }
      }
      const at = top && !back && !inMin && pos.get(top);
      if (at && ['enter', 'base', 'compare', 'compare-right', 'relink-left', 'relink-right', 'relink-succ'].includes(tag)) {
        items.push({ key: 'tok', kind: 'token', x: at.x + 44, y: at.y - 30, r: 16, text: String(fkey), cls: 'c-rose' });
        const nk = B.node(d, top).key;
        if (tag === 'compare' || tag === 'compare-right') items.push({ key: 'q', kind: 'text', x: at.x + 66, y: at.y - 25, text: fkey < nk ? fkey + ' < ' + nk + ': left' : fkey > nk ? fkey + ' > ' + nk + ': right' : fkey + ' == ' + nk + ': this one', cls: 'bx-hot' });
      }
      // the call stack
      const rows = list.map((f, i) => {
        const k = B.name(d, f.node), side = memo.side[f.node];
        if (i < list.length - 1) return { text: k + '->' + side + ' = delete_key(...)', tcls: 'bx-muted' };
        if (back) return { text: tag === 'lift' ? 'returns ' + (ctx.prev.data.cursors.child ? B.name(d, ctx.prev.data.cursors.child) : 'NULL') + ' (node freed)' : tag === 'missing' ? 'returns NULL' : (side ? k + '->' + side + ' set, ' : '') + 'returns ' + k, cls: 'bx-done', tcls: 'bx-good' };
        return { text: 'delete_key(' + k + ', ' + f.key + ')', tcls: 'bx-hot' };
      });
      if (inMin) rows.push({ text: 'min_node(...): node at ' + B.name(d, d.cursors.node), tcls: 'bx-hot' });
      if (rows.length) { const la = B.ladderAt(ctx, box, 300); items.push(...B.ladder(rows, la.x, la.y, 'lad', 300)); }
      const nm = (a) => B.name(d, a);
      const tn = B.node(d, top);
      let say = '';
      switch (tag) {
        case 'enter': say = 'delete_key(root, ' + fkey + '). First the key has to be found, exactly as a search would; then how it is removed depends on how many children its node has.'; break;
        case 'base': say = top ? 'node is ' + nm(top) + ', not NULL.' : 'node is NULL: ' + fkey + ' is not in this subtree.'; break;
        case 'missing': say = fkey + ' was not found. This call returns NULL, which its caller stores back into the link that was already NULL: the tree does not change.'; break;
        case 'compare': say = fkey < tn.key ? fkey + ' < ' + tn.key + ': if it is anywhere, it is on the left.' : fkey + ' is not smaller than ' + tn.key + '.'; break;
        case 'compare-right': say = fkey > tn.key ? fkey + ' > ' + tn.key + ': look on the right.' : fkey + ' == ' + tn.key + ': this is the node to delete.'; break;
        case 'relink-left': case 'relink-right': case 'relink-succ': {
          const c = st[st.length - 2].node, side = memo.side[c];
          say = tag === 'relink-succ' ? 'Now the old ' + fkey + ' must go. delete_key(' + nm(c) + '->right, ' + fkey + ') removes it from the right subtree. It has no left child, so this will be the easy case.' : 'delete_key(' + nm(c) + ') hands the job to its ' + side + ' subtree (' + nm(top) + '). Whatever comes back, maybe a different node, is stored in ' + nm(c) + '->' + side + '.';
          break;
        }
        case 'test-kids': {
          const kids = (tn.links.left ? 1 : 0) + (tn.links.right ? 1 : 0);
          say = kids === 0 ? tn.key + ' has no children: a leaf. It can simply be removed; its parent\'s link becomes NULL.' : kids === 1 ? tn.key + ' has one child. That child, with its whole subtree, can take ' + tn.key + '\'s place: every key in it is on the same side of the parent as ' + tn.key + ' was.' : tn.key + ' has two children. Its parent has only one link to give, so the node cannot simply be cut out.';
          break;
        }
        case 'pick-child': say = d.cursors.child ? 'child = ' + nm(d.cursors.child) + ', the one child of ' + tn.key + '. It will move up into ' + tn.key + '\'s place.' : 'Both links are NULL, so child = NULL.'; break;
        case 'free': say = 'free(node): ' + B.name(d, freed && freed.addr) + '\'s memory goes back to the heap. Its parent still points at it, a dangling pointer, until this call returns and the parent\'s link is replaced.'; break;
        case 'lift': say = 'return child: hand ' + (ctx.prev.data.cursors.child ? nm(ctx.prev.data.cursors.child) : 'NULL') + ' up to the caller, which will store it where the removed node was.'; break;
        case 'succ': say = 'Two children: take the in-order successor instead, the smallest key bigger than ' + B.node(d, target).key + '. It lives in the right subtree, as far left as possible. min_node goes to find it.'; break;
        case 'hunt': { const h = B.node(d, d.cursors.node); say = h.links.left ? h.key + ' has a left child, so there is something smaller: keep going left.' : h.key + ' has no left child: nothing in this subtree is smaller. This is the successor.'; break; }
        case 'step-left': say = 'node moves left to ' + nm(d.cursors.node) + '.'; break;
        case 'found-min': say = 'min_node returns ' + nm(memo.succ) + '. A successor found this way never has a left child, which is why deleting it later is easy.'; break;
        case 'copy-key': say = 'node->key = succ->key: ' + nm(top) + ' now sits where ' + B.node(ctx.prev.data, top).key + ' was. The order still holds: it is bigger than everything on the left and smaller than everything else on the right. But it now appears twice.'; break;
        case 'return': {
          const side = memo.side[top];
          const c = side ? tn.links[side] : 0;
          const changed = side && ctx.prev && B.node(ctx.prev.data, top) && B.node(ctx.prev.data, top).links[side] !== c;
          say = !side ? 'delete_key(' + nm(top) + ') returns ' + nm(top) + '.' : changed ? 'Back in delete_key(' + nm(top) + '): ' + nm(top) + '->' + side + ' = ' + nm(c) + '. The link now skips the removed node' + (c ? ', and ' + nm(c) + '\'s subtree moves up a level.' : '.') + ' Then it returns ' + nm(top) + '.' : nm(top) + '->' + side + ' = ' + nm(c) + ': the same address as before. delete_key(' + nm(top) + ') returns ' + nm(top) + '.';
          break;
        }
        case 'after': say = 'main stores the returned root' + (d.root ? ' (' + nm(d.root) + ')' : ' (NULL: the tree is now empty)') + '. In order, the keys now read ' + (B.inorder(d).map((n) => n.key).join(', ') || 'nothing') + '.'; break;
      }
      return { items, say, slow: tag === 'copy-key' || tag === 'free' || tag === 'found-min' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'test-kids', once: true, ask: 'This is the node to delete. How many children does it have?', options: () => ['0', '1', '2'], pick: 'option', answer: (ts, i) => { const d = ts[i + 1].data, n = B.node(d, d.cursors.node); return String((n.links.left ? 1 : 0) + (n.links.right ? 1 : 0)); } },
      { at: (t) => t.tag === 'succ', once: true, ask: 'Click the node whose key will replace the deleted one.', answer: (ts, i) => { for (let j = i; j < ts.length; j++) if (ts[j].tag === 'found-min') return 'n' + ts[j - 1].data.cursors.node; return null; }, explain: () => 'The successor: go right once, then left until there is no left child.' },
      { at: (t, i, ts) => t.tag === 'test-kids' && ts[i + 1] && ts[i + 1].tag === 'pick-child' && !!ts[i + 1].data.cursors.child, once: true, ask: 'After the deletion, which node will take the deleted node\'s place?', answer: (ts, i) => 'n' + ts[i + 1].data.cursors.child, explain: () => 'Its only child moves up, bringing its whole subtree with it.' },
    ],
    quiz: [
      { q: 'Deleting a node with one child: what happens to the child\'s subtree?', options: ['It is deleted too', 'It moves up a level and takes the node\'s place', 'It is re-inserted key by key', 'It becomes the root'], answer: 1, why: 'The parent\'s link is set to the child. Every key in that subtree is still on the correct side of every ancestor.' },
      { q: 'Why can the in-order successor replace a node with two children?', options: ['It is always a leaf', 'It is bigger than every key on the left and smaller than every other key on the right', 'It is the root\'s child', 'Any key would do'], answer: 1, why: 'It is the next key in sorted order, so putting it in the node keeps every order rule true.' },
      { q: 'Why is deleting the successor afterwards always easy?', options: ['It is in the left subtree', 'It never has a left child, so it has at most one child', 'It is never freed', 'It is always the root'], answer: 1, why: 'min_node stopped because left was NULL. A node with at most one child is a leaf or one-child case.' },
      { q: 'free(node) runs before the parent\'s link is changed. Why is that safe here?', options: ['It is not safe', 'Nothing reads the freed node again; the parent\'s link is overwritten by the returned child', 'free does not release memory', 'The child is copied first'], answer: 1, why: 'The function saved child first and returns it; the caller replaces its dangling link before using it.' },
      { q: 'Instead of the successor, which other key could fill the hole?', options: ['The root', 'The predecessor: the biggest key in the left subtree', 'Any leaf', 'The parent'], answer: 1, why: 'The in-order predecessor works the same way, mirrored.' },
    ],
  });
})(SEE);
