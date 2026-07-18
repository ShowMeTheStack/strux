// Binary search trees: the family and insertion.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, T = X.TreeKit;

  X.family({
    id: 'bst', order: 3, group: 'Trees', title: 'Binary search trees',
    blurb: 'Smaller keys to the left, bigger to the right, at every node. Each comparison throws away half of what is left.',
    head: `#include <stdio.h>
#include <stdlib.h>

/* a tree node: a key, and the roots of the smaller and bigger subtrees */
struct node {
    int key;
    struct node *left;
    struct node *right;
};

struct node *new_node(int key)
{
    struct node *n = malloc(sizeof *n);
    n->key = key;
    n->left = NULL;
    n->right = NULL;
    return n;
}

/* main uses this to set up the tree you chose, before the animation starts */
struct node *add(struct node *root, int key)
{
    if (root == NULL)
        return new_node(key);
    if (key < root->key)
        root->left = add(root->left, key);
    else if (key > root->key)
        root->right = add(root->right, key);
    return root;
}`,
  });
  X.bstMain = (keys, call, decl) => `int main(void)
{
    int keys[] = { ${keys.length ? keys.join(', ') : '0'} };
    struct node *root = NULL;
    int i;
${decl ? '    ' + decl + '\n' : ''}    for (i = 0; i < ${keys.length}; i++)
        root = add(root, keys[i]);
    ${call}
    return 0;
}`;
  X.bstKeys = { id: 'keys', kind: 'ints', label: 'Keys, inserted in this order', def: [50, 30, 70, 20, 40, 60, 80], min: 0, max: 15, distinct: true };
  X.bstCapture = (cursors, extra) => (P) => T.capture(P, { root: 'root', cursors, fields: ['key'], extra });

  // ---- insert (iterative) --------------------------------------------------------------------------------
  X.topic({
    id: 'bst-insert', family: 'bst', order: 10, title: 'Insert a key',
    blurb: 'The new key walks down from the root, turning left or right at every node, until it finds an empty place.',
    code: `/* add key to the tree and return the (possibly new) root */
struct node *insert(struct node *root, int key)
{
    struct node *n = new_node(key);           /*@ new */
    struct node *parent = NULL;
    struct node *cur = root;                  /*@ start */
    if (root == NULL)                         /*@ empty */
        return n;                             /*@ first */
    while (cur != NULL) {                     /*@ walk */
        parent = cur;                         /*@ parent */
        if (key < cur->key)                   /*@ compare */
            cur = cur->left;                  /*@ go-left */
        else
            cur = cur->right;                 /*@ go-right */
    }
    if (key < parent->key)                    /*@ attach-test */
        parent->left = n;                     /*@ attach-left */
    else
        parent->right = n;                    /*@ attach-right */
    return root;                              /*@ done */
}`,
    animate: ['insert'], quiet: ['new_node'],
    inputs: [X.bstKeys, { id: 'key', kind: 'int', label: 'Insert', def: 45, lo: -999, hi: 999 }],
    check: (inp) => (inp.keys.includes(inp.key) ? 'That key is already in the tree; pick another' : null),
    presets: [
      { label: 'Balanced tree', values: { keys: [50, 30, 70, 20, 40, 60, 80], key: 45 } },
      { label: 'Into an empty tree', values: { keys: [], key: 42 } },
      { label: 'A new smallest key', values: { keys: [50, 30, 70, 20, 40], key: 5 } },
      { label: 'A chain (sorted input)', values: { keys: [10, 20, 30, 40, 50], key: 60 } },
    ],
    main: (inp) => X.bstMain(inp.keys, 'root = insert(root, ' + inp.key + ');'),
    capture: X.bstCapture(['cur', 'parent', 'n'], (P) => ({ key: P.val('key', 0) })),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, key = ctx.input.key;
      const c = d.cursors;
      const memo = ctx.memo;
      memo.path = memo.path || [];
      if ((tag === 'parent') && c.cur && !memo.path.includes(c.cur)) memo.path.push(c.cur);
      const path = new Set(memo.path);
      const pic = T.picture(ctx, d, {
        nodeCls: (n) => (n.addr === c.n ? 'part-b' : path.has(n.addr) ? 'part-a' : ''),
        edgeCls: (n, side) => (path.has(n.addr) && path.has(n.links[side]) ? 'part-a' : ''),
        showNull: true,
      });
      const items = pic.items;
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      // the key on its way down: a token beside the node it is compared with
      const at = c.cur && pic.pos.get(c.cur);
      if (at && !['attach-left', 'attach-right', 'done', 'after'].includes(tag)) {
        items.push({ key: 'tok', kind: 'token', x: at.x + 46, y: at.y - 30, r: 16, text: String(key), cls: 'c-rose' });
        if (tag === 'compare') {
          const ck = by.get(c.cur).key;
          items.push({ key: 'q', kind: 'text', x: at.x + 70, y: at.y - 26, text: key + (key < ck ? ' < ' : ' > ') + ck + (key < ck ? '  go left' : '  go right'), cls: 'hot' });
        }
      }
      const nm = (a) => (a && by.has(a) ? by.get(a).key : 'NULL');
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert(root, ' + key + '): the new key will end up as a leaf, in the one place where a search for it would fall off the tree.'; break;
        case 'new': say = 'First the new node is made on the heap, holding ' + key + ', with no children. It waits on the side until its place is found.'; break;
        case 'start': say = 'cur starts at the root (' + nm(c.cur) + '); parent will trail one step behind cur.'; break;
        case 'empty': say = d.root ? 'The tree is not empty, so the walk begins.' : 'The tree is empty: the new node simply becomes the root.'; break;
        case 'first': say = 'insert() returns the new node, and main stores it in root.'; break;
        case 'walk': say = c.cur ? 'cur is at ' + nm(c.cur) + ', so there is another node to compare with.' : 'cur fell off the tree: this empty place, under ' + nm(c.parent) + ', is where ' + key + ' belongs.'; break;
        case 'parent': say = 'parent = cur: remember ' + nm(c.cur) + ', because once cur moves on we will need to come back and attach the node here.'; break;
        case 'compare': { const ck = by.get(c.cur) ? by.get(c.cur).key : 0; say = 'Compare ' + key + ' with ' + ck + ': it is ' + (key < ck ? 'smaller, so it belongs somewhere in the left subtree.' : 'bigger, so it belongs somewhere in the right subtree.') + ' Everything on the other side can be ignored.'; break; }
        case 'go-left': say = 'cur moves to the left child: ' + nm(c.cur) + '.'; break;
        case 'go-right': say = 'cur moves to the right child: ' + nm(c.cur) + '.'; break;
        case 'attach-test': say = 'Which side of ' + nm(c.parent) + '? ' + key + (key < (by.get(c.parent) || {}).key ? ' is smaller: the left.' : ' is bigger: the right.'); break;
        case 'attach-left': case 'attach-right': say = 'One pointer changes: ' + nm(c.parent) + '->' + (tag === 'attach-left' ? 'left' : 'right') + ' = n. The new node drops into the tree as a leaf.'; break;
        case 'done': say = 'The root did not change, so insert() returns it as it was.'; break;
        case 'after': say = key + ' is in the tree after ' + memo.path.length + ' comparison' + (memo.path.length === 1 ? '' : 's') + ', one per level it passed. An in-order walk still gives the keys in increasing order.'; break;
      }
      return { items, say, slow: tag === 'attach-left' || tag === 'attach-right' };
    },
    predict: [
      { at: (t) => t.tag === 'compare', once: true, ask: (t) => 'Which way will ' + t.data.extra.key + ' go from here?', options: () => ['Left', 'Right'], answer: (ts, i) => { const d = ts[i].data; const n = d.nodes.find((x) => x.addr === d.cursors.cur); return d.extra.key < n.key ? 'Left' : 'Right'; }, pick: 'option' },
      { at: (t) => t.tag === 'attach-test', once: true, ask: 'Click the node the new key will hang from.', answer: (ts, i) => 'n' + ts[i].data.cursors.parent, explain: () => 'It hangs from parent, the last node the walk passed before falling off the tree.' },
    ],
    quiz: [
      { q: 'Where does a newly inserted key always end up?', options: ['At the root', 'As a leaf', 'In the middle', 'It depends on its value'], answer: 1, why: 'It goes where a search for it falls off the tree: an empty child place, so it is a leaf.' },
      { q: 'Inserting 10, 20, 30, 40 in this order gives...', options: ['A balanced tree', 'A chain going right', 'A chain going left', 'An error'], answer: 1, why: 'Each key is bigger than all before it, so each becomes the right child of the last: a linked list in disguise.' },
      { q: 'How many comparisons does insert make in a tree of height h?', options: ['1', 'h at most', 'n always', 'log n always'], answer: 1, why: 'One per level on the way down: at most h. In a balanced tree h is about log n; in a chain it is n.' },
    ],
  });
})(SEE);
