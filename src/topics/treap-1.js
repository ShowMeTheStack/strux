// Treaps: the family, insert (BST insert, then rotate up by priority) and delete (rotate down, then cut).
(function (SEE) {
  'use strict';
  const X = SEE.Strux, T = X.TreeKit;

  const ROTATE = `/* lift the left child of *t into its place */
void rotate_right(struct node **t)
{
    struct node *l = (*t)->left;
    (*t)->left = l->right;
    l->right = *t;
    *t = l;
}

/* lift the right child of *t into its place */
void rotate_left(struct node **t)
{
    struct node *r = (*t)->right;
    (*t)->right = r->left;
    r->left = *t;
    *t = r;
}`;

  X.family({
    id: 'treap', order: 6, group: 'Balanced trees', title: 'Treaps',
    blurb: 'Every node has a key and a random priority. By key it is a binary search tree; by priority it is a heap, bigger priorities on top. Random priorities keep it balanced on average.',
    head: `#include <stdio.h>
#include <stdlib.h>

/* a treap node: ordered by key like a BST, and by pri like a heap (parents have bigger pri) */
struct node {
    int key;
    int pri;
    struct node *left;
    struct node *right;
};

struct node *root = NULL;

struct node *new_node(int key, int pri)
{
    struct node *n = malloc(sizeof *n);
    n->key = key;
    n->pri = pri;
    n->left = NULL;
    n->right = NULL;
    return n;
}

/* main uses this to build the treap you chose: a plain BST insert. Done in order of
   falling priority, every parent comes before its children, so no rotation is needed */
void add(struct node **t, int key, int pri)
{
    while (*t != NULL)
        t = key < (*t)->key ? &(*t)->left : &(*t)->right;
    *t = new_node(key, pri);
}`,
  });

  const keysIn = { id: 'keys', kind: 'ints', label: 'Keys', def: [50, 30, 70, 20, 40, 60, 80], min: 0, max: 12, distinct: true, check: (v) => (v.some((x) => x < -99 || x > 999) ? 'Keys: from -99 to 999' : null) };
  const prisIn = { id: 'pris', kind: 'ints', label: 'Their priorities', def: [90, 60, 80, 30, 50, 40, 70], min: 0, max: 12, distinct: true, check: (v) => (v.some((x) => x < 1 || x > 99) ? 'Priorities: from 1 to 99' : null) };
  const treapMain = (inp, call) => {
    const pairs = inp.keys.map((k, j) => [k, inp.pris[j]]).sort((a, b) => b[1] - a[1]);
    return `int main(void)
{
    /* the keys and priorities, highest priority first */
    int keys[] = { ${pairs.length ? pairs.map((p) => p[0]).join(', ') : '0'} };
    int pris[] = { ${pairs.length ? pairs.map((p) => p[1]).join(', ') : '0'} };
    int i;
    for (i = 0; i < ${pairs.length}; i++)
        add(&root, keys[i], pris[i]);
    ${call}
    return 0;
}`;
  };
  const sameLen = (inp) => (inp.keys.length !== inp.pris.length ? 'Give one priority for every key (' + inp.keys.length + ' keys, ' + inp.pris.length + ' priorities)' : null);
  /** The tree, plus the node *t refers to in every active call (oldest first) */
  const capture = (P) => {
    const out = T.capture(P, { root: 'root', fields: ['key', 'pri'], cursors: ['l', 'r'] });
    out.stack = [];
    for (let fi = P.frames.length - 1; fi >= 0; fi--) {
      const v = P.find('t', fi);
      if (!v || !P.frames[fi] || !['insert', 'delete'].includes(P.frames[fi].name) || !P.isSet('t', fi)) continue;
      const link = P.val('t', fi);
      const pt = SEE.Types.unqual(v.type).to;
      out.stack.push({ node: P.read(pt, link) || 0, link });
    }
    out.fn = P.frames[0].name;
    return out;
  };
  const plural = (k, w, ws) => k + ' ' + (k === 1 ? w : ws || w + 's');

  /** Tree, priority badges, red edges where the heap order is broken, the active calls */
  function treapPicture(ctx, d, opts) {
    const by = new Map(d.nodes.map((n) => [n.addr, n]));
    const active = new Set(d.stack.map((s) => s.node).filter(Boolean));
    const cur = d.stack.length ? d.stack[d.stack.length - 1].node : 0;
    const pic = T.picture(ctx, d, {
      pos: opts.pos,
      nodeCls: (n) => (opts.nodeCls && opts.nodeCls(n)) || (n.addr === cur && ctx.tick.tag !== 'after' ? 'focus' : active.has(n.addr) && ctx.tick.tag !== 'after' ? 'part-a' : ''),
      edgeCls: (n, side) => { const c = by.get(n.links[side]); return c && !c.freed && c.pri > n.pri ? 'mw-bad' : active.has(n.addr) && active.has(n.links[side]) ? 'mw-path' : ''; },
    });
    const items = pic.items.filter((it) => it.kind !== 'cursor');
    for (const n of d.nodes) {
      const p = pic.pos.get(n.addr);
      if (!p || n.freed) continue;
      const parent = d.nodes.find((m) => !m.freed && (m.links.left === n.addr || m.links.right === n.addr));
      const bad = parent && parent.pri < n.pri;
      items.push({ key: 'pr' + n.addr, kind: 'token', x: p.x + 22, y: p.y - 22, r: 12, text: String(n.pri), cls: 'mw-pri' + (bad ? ' mw-badpri' : '') });
    }
    return { items, pic, by, cur, active };
  }

  // ---- insert --------------------------------------------------------------------------------------------------
  X.topic({
    id: 'treap-insert', family: 'treap', order: 10, title: 'Insert (rotate up by priority)',
    blurb: 'First a plain BST insert by key: the new node becomes a leaf. Then, on the way back up the recursion, it rotates above every parent with a smaller priority, like a heap\'s sift-up.',
    code: ROTATE + `

/* insert key with priority pri below *t: BST order by key, heap order by pri */
void insert(struct node **t, int key, int pri)
{
    if (*t == NULL) {                              /*@ empty */
        *t = new_node(key, pri);                   /*@ new */
        return;                                    /*@ placed */
    }
    if (key < (*t)->key) {                         /*@ compare */
        insert(&(*t)->left, key, pri);             /*@ go-left */
        if ((*t)->left->pri > (*t)->pri)           /*@ check-left */
            rotate_right(t);                       /*@ rotate-right */
    } else {
        insert(&(*t)->right, key, pri);            /*@ go-right */
        if ((*t)->right->pri > (*t)->pri)          /*@ check-right */
            rotate_left(t);                        /*@ rotate-left */
    }
}                                                  /*@ back */`,
    animate: ['rotate_right', 'rotate_left', 'insert'], quiet: ['rotate_right', 'rotate_left', 'new_node'],
    inputs: [keysIn, prisIn, { id: 'key', kind: 'int', label: 'Insert key', def: 45, lo: -99, hi: 999 }, { id: 'pri', kind: 'int', label: 'with priority', def: 95, lo: 1, hi: 99 }],
    check: (inp) => sameLen(inp) || (inp.keys.includes(inp.key) ? 'That key is already in the treap' : null) || (inp.pris.includes(inp.pri) ? 'Pick a priority no other key has' : null),
    presets: [
      { label: 'Climbs to the root', values: { keys: [50, 30, 70, 20, 40, 60, 80], pris: [90, 60, 80, 30, 50, 40, 70], key: 45, pri: 95 } },
      { label: 'Climbs part way', values: { keys: [50, 30, 70, 20, 40, 60, 80], pris: [90, 60, 80, 30, 50, 40, 70], key: 45, pri: 65 } },
      { label: 'Stays a leaf', values: { keys: [50, 30, 70, 20, 40, 60, 80], pris: [90, 60, 80, 30, 50, 40, 70], key: 45, pri: 10 } },
      { label: 'Into an empty treap', values: { keys: [], pris: [], key: 42, pri: 50 } },
    ],
    counters: ['compares', 'allocs'],
    main: (inp) => treapMain(inp, `insert(&root, ${inp.key}, ${inp.pri});`),
    capture,
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, pri = ctx.input.pri, memo = ctx.memo;
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      const fresh = d.nodes.find((n) => n.key === key && !n.freed);
      // a call line is drawn once the callee has started, a return line once it has returned
      const callish = ['go-left', 'go-right'].includes(tag) && ctx.prev;
      const stack = callish ? ctx.prev.data.stack : d.stack;
      const cur = stack.length ? stack[stack.length - 1].node : 0, cn = by.get(cur);
      if (/^rotate/.test(tag)) memo.rot = (memo.rot || 0) + 1;
      // new_node() is quiet, so its line is drawn before *t is set: hang the new node where it is going
      let pos = null;
      if (fresh && !d.nodes.some((n) => n.links.left === fresh.addr || n.links.right === fresh.addr) && d.root !== fresh.addr) {
        const parent = stack.length >= 2 ? by.get(stack[stack.length - 2].node) : null;
        if (parent) {
          const clone = { nodes: d.nodes.map((n) => (n.addr === parent.addr ? Object.assign({}, n, { links: Object.assign({}, n.links, key < n.key ? { left: fresh.addr } : { right: fresh.addr }) }) : n)), root: d.root, cursors: {} };
          pos = T.layout(clone);
        }
      }
      const tp = treapPicture(ctx, Object.assign({}, d, { stack }), { pos, nodeCls: (n) => (fresh && n.addr === fresh.addr ? 'part-b' : '') });
      const items = tp.items;
      // the key and its priority, travelling down beside the node it is compared with
      if (!fresh && cn && tp.pic.pos.has(cur)) {
        const at = tp.pic.pos.get(cur);
        items.push({ key: 'tok', kind: 'token', x: at.x + 52, y: at.y - 10, r: 16, text: String(key), cls: 'c-indigo' });
        if (tag === 'compare') items.push({ key: 'q', kind: 'text', x: at.x + 74, y: at.y - 6, text: key + (key < cn.key ? ' < ' : ' > ') + cn.key + (key < cn.key ? ': left' : ': right'), cls: 'hot' });
      }
      if (fresh && /^check/.test(tag) && cn) {
        const at = tp.pic.pos.get(cur), child = by.get(cn.links[tag === 'check-left' ? 'left' : 'right']);
        if (at && child) items.push({ key: 'q', kind: 'text', x: at.x + 44, y: at.y - 40, text: 'pri ' + child.pri + (child.pri > cn.pri ? ' > ' : ' < ') + cn.pri + (child.pri > cn.pri ? ': rotate' : ': fine'), cls: child.pri > cn.pri ? 'mw-tag' : 'mw-note' });
      }
      const k = (a) => (a && by.has(a) ? by.get(a).key : 'NULL');
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert(&root, ' + key + ', ' + pri + '). Step one is an ordinary BST insert by key. Step two happens as the recursion returns: the new node rotates up while its priority beats its parent\'s.'; break;
        case 'empty': say = cn ? '*t is the node ' + cn.key + ' (priority ' + cn.pri + '): not empty, keep going down.' : '*t is NULL: this empty place is where ' + key + ' goes.'; break;
        case 'new': say = 'A new node, key ' + key + ' with priority ' + pri + ', fills the empty place: it is a leaf.'; break;
        case 'placed': say = 'Return. From here on, each call that is waiting gets its turn to check the heap order.'; break;
        case 'compare': say = 'Compare ' + key + ' with ' + cn.key + ': ' + (key < cn.key ? 'smaller, go left.' : 'bigger, go right.') + ' Priorities play no part on the way down.'; break;
        case 'go-left': case 'go-right': say = 'insert(&(*t)->' + (tag === 'go-left' ? 'left' : 'right') + ', ...): one level deeper. This call at ' + k(cur) + ' waits.'; break;
        case 'check-left': case 'check-right': {
          const child = cn && by.get(cn.links[tag === 'check-left' ? 'left' : 'right']);
          say = 'Back in the call at ' + cn.key + '. Its ' + (tag === 'check-left' ? 'left' : 'right') + ' child ' + child.key + ' has priority ' + child.pri + (child.pri > cn.pri ? ', bigger than ' + cn.key + '\'s ' + cn.pri + ': the heap order is broken (red edge). Rotate.' : ', smaller than ' + cn.key + '\'s ' + cn.pri + ': the heap order holds here.');
          break;
        }
        case 'rotate-right': case 'rotate-left': say = 'rotate_' + (tag === 'rotate-right' ? 'right' : 'left') + '(t): ' + key + ' moves up one level and ' + k(ctx.prev && ctx.prev.data.stack.length ? ctx.prev.data.stack[ctx.prev.data.stack.length - 1].node : 0) + ' goes down to be its child. Left to right, the keys are still in order.'; break;
        case 'back': { const up = d.stack.length > 1 ? by.get(d.stack[d.stack.length - 2].node) : null; say = up ? 'This call is done; back to the call at ' + up.key + '.' : 'The outermost call is done.'; break; }
        case 'after': { const dep = (() => { let a = d.root, n = 0; while (a && by.has(a) && by.get(a).key !== key) { a = key < by.get(a).key ? by.get(a).links.left : by.get(a).links.right; n++; } return n; })(); say = key + ' is in at depth ' + dep + ', after ' + plural(memo.rot || 0, 'rotation') + '. Every edge goes from a bigger priority down to a smaller one, and the keys are in BST order.'; break; }
      }
      return { items, say, slow: /^rotate/.test(tag) || tag === 'new' };
    },
    predict: [
      {
        at: (t, i) => t.tag === 'compare' && i < 4, once: true,
        ask: (t, ts, i, ctx) => 'Under which node will ' + ctx.input.key + ' first be attached? Click it.',
        answer: (ts, i, ctx) => { const d = ts[i].data, by = new Map(d.nodes.map((n) => [n.addr, n])); let a = d.root, last = 0; while (a && by.has(a)) { last = a; a = ctx.input.key < by.get(a).key ? by.get(a).links.left : by.get(a).links.right; } return last ? 'n' + last : null; },
        explain: () => 'By key alone, exactly as in a BST: where a search for it falls off the tree.',
      },
      {
        at: (t, i, ts) => /^check/.test(t.tag), once: true,
        ask: 'Will the new node rotate up past this one?',
        options: () => ['Yes', 'No'],
        answer: (ts, i) => (ts[i + 1] && /^rotate/.test(ts[i + 1].tag) ? 'Yes' : 'No'),
        pick: 'option',
        explain: () => 'Only if its priority is bigger than this node\'s.',
      },
      {
        at: (t) => t.tag === 'enter', once: true,
        ask: 'How many rotations will this insert need?',
        options: () => ['0', '1', '2', '3', '4'],
        answer: (ts) => String(Math.min(4, ts.filter((t) => /^rotate/.test(t.tag)).length)),
        pick: 'option',
        explain: () => 'One for every ancestor on its path with a smaller priority, counted from the bottom until one has a bigger priority.',
      },
    ],
    quiz: [
      { q: 'A treap is ordered...', options: ['By priority only', 'By key like a BST, and by priority like a heap', 'By insertion time', 'By key like a heap'], answer: 1, why: 'Left subtree keys are smaller, right ones bigger; and every parent\'s priority is bigger than its children\'s.' },
      { q: 'Why rotate rather than swap the two nodes\' contents?', options: ['Rotations are faster', 'A rotation keeps the BST order by key while changing which node is on top', 'Swapping is not allowed in C', 'To free memory'], answer: 1, why: 'Swapping keys would break the BST order; a rotation preserves it.' },
      { q: 'Where does the new node start before any rotation?', options: ['At the root', 'As a leaf, where a BST insert puts it', 'Next to the node with the closest priority', 'At the end of a list'], answer: 1, why: 'Priority only matters on the way back up.' },
      { q: 'Why give nodes random priorities?', options: ['To make keys unique', 'The treap then has the shape of a BST built in random order: expected depth O(log n)', 'To sort the keys', 'They are not random'], answer: 1, why: 'Whatever order the keys arrive in, the shape depends only on the random priorities.' },
      { q: 'A new node with the biggest priority of all ends up...', options: ['As a leaf', 'At the root', 'In the middle', 'It depends on its key only'], answer: 1, why: 'It beats every ancestor, so it rotates all the way up.' },
    ],
  });

  // ---- delete --------------------------------------------------------------------------------------------------
  X.topic({
    id: 'treap-delete', family: 'treap', order: 20, title: 'Delete (rotate down, then cut)',
    blurb: 'Find the node, then push it down: rotate up whichever child has the bigger priority, again and again, until the node is a leaf. Then simply cut it off.',
    code: ROTATE + `

/* delete key below *t: rotate it down until it is a leaf, then cut it off */
void delete(struct node **t, int key)
{
    struct node *l, *r;
    if (*t == NULL)                                     /*@ empty */
        return;                                         /*@ missing */
    if (key < (*t)->key)                                /*@ compare */
        delete(&(*t)->left, key);                       /*@ go-left */
    else if (key > (*t)->key)                           /*@ compare-right */
        delete(&(*t)->right, key);                      /*@ go-right */
    else {
        l = (*t)->left;                                 /*@ found */
        r = (*t)->right;                                /*@ kids */
        if (l == NULL && r == NULL) {                   /*@ leaf-test */
            free(*t);                                   /*@ free */
            *t = NULL;                                  /*@ cut */
        } else if (r == NULL || (l != NULL && l->pri > r->pri)) {    /*@ which */
            rotate_right(t);                            /*@ rotate-right */
            delete(&(*t)->right, key);                  /*@ follow-down */
        } else {
            rotate_left(t);                             /*@ rotate-left */
            delete(&(*t)->left, key);                   /*@ follow-down */
        }
    }
}                                                       /*@ back */`,
    animate: ['rotate_right', 'rotate_left', 'delete'], quiet: ['rotate_right', 'rotate_left'],
    inputs: [keysIn, prisIn, { id: 'key', kind: 'int', label: 'Delete', def: 50, lo: -99, hi: 999 }],
    check: sameLen,
    presets: [
      { label: 'Delete the root', values: { keys: [50, 30, 70, 20, 40, 60, 80], pris: [90, 60, 80, 30, 50, 40, 70], key: 50 } },
      { label: 'A node in the middle', values: { keys: [50, 30, 70, 20, 40, 60, 80, 35, 45], pris: [90, 60, 80, 30, 50, 40, 70, 20, 25], key: 30 } },
      { label: 'Already a leaf', values: { keys: [50, 30, 70, 20, 40, 60, 80], pris: [90, 60, 80, 30, 50, 40, 70], key: 60 } },
      { label: 'Not in the treap', values: { keys: [50, 30, 70, 20, 40, 60, 80], pris: [90, 60, 80, 30, 50, 40, 70], key: 65 } },
    ],
    counters: ['compares', 'frees'],
    main: (inp) => treapMain(inp, `delete(&root, ${inp.key});`),
    capture,
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key, memo = ctx.memo;
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      const callish = ['go-left', 'go-right', 'follow-down'].includes(tag) && ctx.prev;
      const stack = callish ? ctx.prev.data.stack : d.stack;
      const cur = stack.length ? stack[stack.length - 1].node : 0, cn = by.get(cur);
      const victim = d.nodes.find((n) => n.key === key);
      if (/^rotate/.test(tag)) memo.rot = (memo.rot || 0) + 1;
      if (victim && memo.startDepth === undefined) { let a = d.root, n = 0; while (a && by.has(a) && a !== victim.addr) { a = key < by.get(a).key ? by.get(a).links.left : by.get(a).links.right; n++; } memo.startDepth = n; }
      const tp = treapPicture(ctx, Object.assign({}, d, { stack }), { nodeCls: (n) => (victim && n.addr === victim.addr && !n.freed && memo.found ? 'mw-sink' : '') });
      if (tag === 'found') memo.found = true;
      const items = tp.items;
      if (cn && !memo.found && tag !== 'found' && tp.pic.pos.has(cur) && tag !== 'after') {
        const at = tp.pic.pos.get(cur);
        items.push({ key: 'tok', kind: 'token', x: at.x + 52, y: at.y - 10, r: 16, text: String(key), cls: 'c-rose' });
        if (tag === 'compare' || tag === 'compare-right') items.push({ key: 'q', kind: 'text', x: at.x + 74, y: at.y - 6, text: key === cn.key ? key + ' = ' + cn.key : key + (key < cn.key ? ' < ' : ' > ') + cn.key, cls: 'hot' });
      }
      // in the found call: the two children and which one comes up
      if (victim && !victim.freed && ['kids', 'leaf-test', 'which'].includes(tag)) {
        const l = by.get(victim.links.left), r = by.get(victim.links.right);
        const up = !r || (l && l.pri > r.pri) ? l : r;
        const at = tp.pic.pos.get(victim.addr);
        if (at && tag === 'which' && up) items.push({ key: 'q', kind: 'text', x: at.x, y: at.y - 52, text: (l && r ? 'pri ' + l.pri + ' vs ' + r.pri + ': ' : '') + up.key + ' comes up', cls: 'mw-tag', anchor: 'middle' });
      }
      const k = (a) => (a && by.has(a) ? by.get(a).key : 'NULL');
      let say = '';
      switch (tag) {
        case 'enter': say = 'delete(&root, ' + key + '). A node with children cannot just be removed, but a leaf can. So the node is rotated down until it is a leaf.'; break;
        case 'empty': say = cn ? '*t is ' + cn.key + '.' : '*t is NULL.'; break;
        case 'missing': say = key + ' is not in the treap: nothing to delete.'; break;
        case 'compare': say = key < cn.key ? key + ' < ' + cn.key + ': it can only be on the left.' : key + ' is not smaller than ' + cn.key + '.'; break;
        case 'compare-right': say = key > cn.key ? key + ' > ' + cn.key + ': go right.' : key + ' = ' + cn.key + ': this is the node to delete.'; break;
        case 'go-left': case 'go-right': say = 'One level down.'; break;
        case 'found': { const n = victim; say = 'l = ' + k(n.links.left) + ', the left child' + (by.get(n.links.left) ? ' (priority ' + by.get(n.links.left).pri + ')' : '') + '.'; break; }
        case 'kids': { const n = victim; say = 'r = ' + k(n.links.right) + ', the right child' + (by.get(n.links.right) ? ' (priority ' + by.get(n.links.right).pri + ')' : '') + '.'; break; }
        case 'leaf-test': say = victim.links.left || victim.links.right ? key + ' still has a child, so it cannot be cut off yet.' : key + ' has no children now: it is a leaf.'; break;
        case 'which': { const l = by.get(victim.links.left), r = by.get(victim.links.right); const up = !r || (l && l.pri > r.pri) ? l : r; say = (l && r ? 'Of its children, ' + up.key + ' has the bigger priority (' + up.pri + '), so ' + up.key + ' must be the one to come up: the other one stays below it, and the heap order holds.' : 'It has only one child, ' + up.key + ': that one comes up.'); break; }
        case 'rotate-right': case 'rotate-left': { const p = victim && d.nodes.find((m) => m.links.left === victim.addr || m.links.right === victim.addr); say = 'rotate_' + (tag === 'rotate-right' ? 'right' : 'left') + '(t): ' + k(p && p.addr) + ' moves up into ' + key + '\'s place and ' + key + ' sinks one level, to depth ' + (() => { let a = d.root, n = 0; while (a && by.has(a) && a !== victim.addr) { a = key < by.get(a).key ? by.get(a).links.left : by.get(a).links.right; n++; } return n; })() + '. Only the sinking node breaks the heap order (red edge), and it is about to go.'; break; }
        case 'follow-down': say = 'Follow ' + key + ' down and repeat.'; break;
        case 'free': say = 'free(*t): the leaf ' + key + ' goes back to the heap.'; break;
        case 'cut': say = '*t = NULL: the parent\'s link is cleared. ' + key + ' is gone.'; break;
        case 'back': { const up = d.stack.length > 1 ? by.get(d.stack[d.stack.length - 2].node) : null; say = up ? 'This call is done; back to the call at ' + up.key + '.' : 'The outermost call is done.'; break; }
        case 'after': say = memo.found ? key + ' sank from depth ' + memo.startDepth + ' with ' + plural(memo.rot || 0, 'rotation') + ' and was cut off as a leaf. Every rotation lifted the child with the bigger priority, so the heap order never broke.' : key + ' was not in the treap; nothing changed.'; break;
      }
      return { items, say, slow: /^rotate/.test(tag) || tag === 'cut' || tag === 'free' };
    },
    predict: [
      {
        at: (t, i, ts) => t.tag === 'which' && ts[i + 1] && /^rotate/.test(ts[i + 1].tag), once: true,
        ask: 'Which child will be rotated up into this place? Click it.',
        answer: (ts, i) => { const d = ts[i].data, by = new Map(d.nodes.map((n) => [n.addr, n])); const v = d.nodes.find((n) => n.addr === d.stack[d.stack.length - 1].node); const l = by.get(v.links.left), r = by.get(v.links.right); const up = !r || (l && l.pri > r.pri) ? l : r; return 'n' + up.addr; },
        explain: () => 'The child with the bigger priority: it can sit above the other one without breaking the heap order.',
      },
      {
        at: (t) => t.tag === 'enter', once: true,
        ask: 'How many rotations before the node is a leaf?',
        options: () => ['0', '1', '2', '3', '4'],
        answer: (ts) => String(Math.min(4, ts.filter((t) => /^rotate/.test(t.tag)).length)),
        pick: 'option',
        explain: () => 'One per level it has to sink; it stops as soon as it has no children.',
      },
    ],
    quiz: [
      { q: 'Why is the node rotated down rather than replaced by its successor, as in a BST?', options: ['Successors do not exist in treaps', 'Moving a key would carry its priority to a place where the heap order may break; rotations keep both orders', 'It is shorter code only', 'To save memory'], answer: 1, why: 'Each rotation keeps the keys in order and lifts the right child by priority, so both orders hold at every step.' },
      { q: 'Which child is rotated up?', options: ['Always the left', 'The one with the smaller key', 'The one with the bigger priority', 'The one with fewer children'], answer: 2, why: 'It becomes the parent of the other child, so its priority must be the bigger one.' },
      { q: 'When does the sinking stop?', options: ['After one rotation', 'When the node has no children', 'When it reaches depth log n', 'When its priority is smallest'], answer: 1, why: 'A leaf can be cut off by setting one link to NULL.' },
      { q: 'If the node has only one child...', options: ['That child is rotated up', 'The node is freed at once', 'An error', 'Nothing happens'], answer: 0, why: 'This code still rotates; many versions splice the single child straight in, which has the same result.' },
    ],
  });
})(SEE);
