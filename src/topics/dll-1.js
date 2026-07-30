// Doubly linked lists: inserting at the front, at the end and at a position, deleting a key, walking
// backwards, and reversing by swapping every node's two links.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, D = X.DListKit, K2 = X.ListKit;
  const nmOf = (d, a) => D.name(d, a);

  const HEAD = `#include <stdio.h>
#include <stdlib.h>

/* one node: a value, the node before it and the node after it (NULL at either end) */
struct node {
    int data;
    struct node *prev;
    struct node *next;
};

/* a new node on the heap, linked to nothing yet */
struct node *new_node(int value)
{
    struct node *n = malloc(sizeof *n);
    n->data = value;
    n->prev = NULL;
    n->next = NULL;
    return n;
}

/* main uses this to set up the list you chose, before the animation starts */
struct node *build(const int *values, int count)
{
    struct node *head = NULL, *tail = NULL;
    int i;
    for (i = 0; i < count; i++) {
        struct node *n = new_node(values[i]);
        if (head == NULL)
            head = n;
        else {
            tail->next = n;
            n->prev = tail;
        }
        tail = n;
    }
    return head;
}`;

  const arrayInit = (vals) => (vals.length ? '{ ' + vals.join(', ') + ' }' : '{ 0 }');
  X.dllMain = (vals, call) => `int main(void)
{
    int values[] = ${arrayInit(vals)};
    struct node *head = build(values, ${vals.length});
    ${call}
    return 0;
}`;

  X.family({
    id: 'dll', order: 2, group: 'Linked lists', title: 'Doubly linked lists',
    blurb: 'Each node knows the one before it as well as the one after it. Twice the arrows to keep right, and in return you can walk both ways and unlink a node without a trailing pointer.',
    head: HEAD,
  });

  const values = { id: 'values', kind: 'ints', label: 'The list', def: [10, 20, 30, 40], min: 0, max: 7 };
  const HEADBOX = { head: { x: -115, y: 5, side: 'left' } };
  const legend = (y) => [
    { key: 'lgN', kind: 'text', x: -115, y: y || 340, text: 'next arrows arch above', cls: 'legend-next' },
    { key: 'lgP', kind: 'text', x: -115, y: (y || 340) + 20, text: 'prev arrows arch below', cls: 'legend-prev' },
  ];
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');

  // ---- insert at the front -------------------------------------------------------------------------------
  X.topic({
    id: 'dll-insert-front', family: 'dll', order: 10, title: 'Insert at the front',
    blurb: 'A new first node needs three pointers set, not two: its next, the old first node\'s prev, and head.',
    code: `/* put value in a new node before the first one; returns the new head */
struct node *insert_front(struct node *head, int value)
{
    struct node *n = new_node(value);   /*@ new */
    n->next = head;                     /*@ link-next */
    if (head != NULL)                   /*@ test-empty */
        head->prev = n;                 /*@ link-prev */
    return n;                           /*@ return */
}`,
    animate: ['insert_front'], quiet: ['new_node'],
    inputs: [values, { id: 'value', kind: 'int', label: 'Insert', def: 5, lo: -999, hi: 999 }],
    presets: [
      { label: 'Four nodes', values: { values: [10, 20, 30, 40], value: 5 } },
      { label: 'Empty list', values: { values: [], value: 5 } },
      { label: 'One node', values: { values: [8], value: 3 } },
      { label: 'Seven nodes', values: { values: [2, 4, 6, 8, 10, 12, 14], value: 0 } },
    ],
    counters: ['allocs', 'writes'],
    main: (inp) => X.dllMain(inp.values, 'head = insert_front(head, ' + inp.value + ');'),
    capture: D.capture({ cursors: ['n'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const n = d.cursors.n, old = ctx.ticks[0].data.roots.head;
      const pic = D.row(ctx, d, { start: d.roots.head, roots: HEADBOX, nodeCls: (x) => (x.addr === n || (tag === 'after' && !D.original(ctx).has(x.addr)) ? 'part-b' : '') });
      const items = pic.items.concat(legend());
      if (n && pic.pos.has(n)) items.push({ key: 'cn', kind: 'cursor', at: 'n' + n, side: 'above', text: 'n', cls: 'c-green' });
      const nm = (a) => D.name(d, a);
      // the three pointers that make the new node first
      const order = ['new', 'link-next', 'test-empty', 'link-prev', 'return', 'after'];
      const k = order.indexOf(tag);
      const st = (doneAt, skip) => (skip ? 'skip' : k >= order.indexOf(doneAt) ? 'done' : k === order.indexOf(doneAt) - 1 ? 'now' : 'todo');
      items.push(...D.checklist('ck', -115, 150, 'Pointers to set', [
        { text: 'n->next = the old first node' + (old ? ' (' + nm(old) + ')' : ' (NULL here)'), state: st('link-next') },
        { text: old ? 'old first node\'s prev = n (' + nm(old) + '->prev)' : 'old first node\'s prev: there is none', state: st('link-prev', !old) },
        { text: 'head = n, in main', state: st('after') },
      ]));
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert_front(head, ' + inp.value + '): ' + inp.value + ' goes before ' + (old ? nm(old) : 'nothing, the list is empty') + '. In a doubly linked list a front insertion has three pointers to set.'; break;
        case 'new': say = 'new_node(' + inp.value + ') makes the node. Both its prev and its next start as NULL.'; break;
        case 'link-next': say = old ? 'n->next = head: the new node\'s forward arrow points at ' + nm(old) + ', the current first node.' : 'n->next = head, which is NULL: the list was empty, so ' + inp.value + ' has nothing after it.'; break;
        case 'test-empty': say = old ? 'head is not NULL, so the old first node ' + nm(old) + ' needs a back arrow to the new node.' : 'head is NULL: there is no old first node to update. Without this test, head->prev would write through a NULL pointer and crash.'; break;
        case 'link-prev': say = 'head->prev = n: ' + nm(old) + '\'s back arrow, NULL until now, points at ' + inp.value + '. Leave this out and a walk backwards would stop at ' + nm(old) + ' and never reach ' + inp.value + '.'; break;
        case 'return': say = 'insert_front() returns n. n->prev stays NULL: nothing comes before the first node.'; break;
        case 'after': say = 'head = insert_front(head, ' + inp.value + '): head now points at the new node. The list reads ' + D.read(d, d.roots.head) + '. Three pointers set, and no node was visited: O(1).'; break;
      }
      return { items, say, slow: tag === 'link-prev' };
    },
    predict: [
      { at: (t) => t.tag === 'new' && t.data.roots.head, once: true, ask: 'n->next = head runs next. Click the node the new node\'s next will point to.', answer: (ts, i) => 'n' + ts[i].data.roots.head, explain: () => 'head still holds the old first node, so the new node points forward at it.' },
      { at: (t) => t.tag === 'link-next' && t.data.roots.head, once: true, ask: 'n->next is set. Which pointer inside the list is still wrong?', options: () => ['The old first node\'s prev', 'The new node\'s prev', 'None: the list is already correct'], answer: () => 'The old first node\'s prev', pick: 'option', explain: () => 'The old first node\'s prev is still NULL, so going backwards would stop there. The new node\'s prev is right as NULL: it will be first.' },
    ],
    quiz: [
      { q: 'How many pointers does inserting at the front of a non-empty doubly linked list set?', options: ['One', 'Two', 'Three', 'Four'], answer: 2, why: 'n->next, the old first node\'s prev, and head. A singly linked list needs only n->next and head.' },
      { q: 'Why does insert_front test head != NULL before head->prev = n?', options: ['To save time', 'In an empty list there is no old first node, and head->prev would dereference NULL', 'Because n->prev must be set first', 'It does not need to'], answer: 1, why: 'Writing through a NULL pointer is undefined behaviour and usually a crash.' },
      { q: 'What is the new node\'s prev after insert_front?', options: ['The old first node', 'head', 'NULL', 'Itself'], answer: 2, why: 'It is the first node, so nothing comes before it.' },
      { q: 'If head->prev = n were left out, which walk would go wrong?', options: ['Forwards from head', 'Backwards from the last node', 'Both', 'Neither'], answer: 1, why: 'Forwards is fine, but backwards stops at the old first node, whose prev is still NULL.' },
    ],
  });

  // ---- insert at the end ---------------------------------------------------------------------------------
  X.topic({
    id: 'dll-insert-end', family: 'dll', order: 11, title: 'Insert at the end',
    blurb: 'Walk to the last node, then link the new node in both directions. The walk costs O(n); the linking is two pointers.',
    code: `/* put value in a new node after the last one; returns the head */
struct node *insert_end(struct node *head, int value)
{
    struct node *n = new_node(value);   /*@ new */
    struct node *p = head;              /*@ init */
    if (head == NULL)                   /*@ test-empty */
        return n;                       /*@ only */
    while (p->next != NULL)             /*@ test-end */
        p = p->next;                    /*@ walk */
    p->next = n;                        /*@ link-next */
    n->prev = p;                        /*@ link-prev */
    return head;                        /*@ return */
}`,
    animate: ['insert_end'], quiet: ['new_node'],
    inputs: [values, { id: 'value', kind: 'int', label: 'Insert', def: 50, lo: -999, hi: 999 }],
    presets: [
      { label: 'Four nodes', values: { values: [10, 20, 30, 40], value: 50 } },
      { label: 'Empty list', values: { values: [], value: 50 } },
      { label: 'One node', values: { values: [7], value: 9 } },
      { label: 'Six nodes: a long walk', values: { values: [1, 2, 3, 4, 5, 6], value: 7 } },
    ],
    counters: ['follows', 'allocs', 'writes'],
    main: (inp) => X.dllMain(inp.values, 'head = insert_end(head, ' + inp.value + ');'),
    capture: D.capture({ cursors: ['n', 'p'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const n = d.cursors.n, p = d.cursors.p;
      const memo = ctx.memo;
      memo.walked = memo.walked || new Set();
      if (tag === 'walk' && ctx.prev) memo.walked.add(ctx.prev.data.cursors.p);
      const hops = memo.walked.size;
      const pic = D.row(ctx, d, {
        start: d.roots.head, roots: HEADBOX, cursors: ['p'],
        nodeCls: (x) => (x.addr === n || (tag === 'after' && !D.original(ctx).has(x.addr)) ? 'part-b' : memo.walked.has(x.addr) ? 'ghost' : ''),
        arrowCls: (x, l) => (l === 'next' && memo.walked.has(x.addr) ? 'walked' : ''),
      });
      const items = pic.items.concat(legend());
      if (n && pic.pos.has(n)) items.push({ key: 'cn', kind: 'cursor', at: 'n' + n, side: 'above', text: 'n', cls: 'c-green' });
      if (d.nodes.length > 1 || tag === 'after') items.push({ key: 'hops', kind: 'text', x: -115, y: 175, text: 'hops along next: ' + hops, cls: 'big' });
      if (hops && ['test-end', 'walk'].includes(tag) === false && tag !== 'enter') items.push({ key: 'cost', kind: 'text', x: -115, y: 200, text: 'with a tail pointer: 0 hops', cls: 'note' });
      const nm = (a) => D.name(d, a);
      const len = ctx.ticks[0].data.nodes.length;
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert_end(head, ' + inp.value + '): the new node goes after the last node. Only head is known, so the last node has to be found first.'; break;
        case 'new': say = 'new_node(' + inp.value + ') makes the node, with prev and next both NULL. It already has the right next: NULL, because it will be last.'; break;
        case 'init': say = p ? 'p starts at the first node, ' + nm(p) + '.' : 'p starts as head, which is NULL.'; break;
        case 'test-empty': say = d.roots.head ? 'The list is not empty, so there is a last node to find.' : 'The list is empty: the new node will be the whole list.'; break;
        case 'only': say = 'Return n: it becomes head. Its prev and next stay NULL, since it is both first and last.'; break;
        case 'test-end': say = d.nodes.find((x) => x.addr === p).links.next ? nm(p) + '->next is not NULL: ' + nm(p) + ' is not the last node, keep going.' : nm(p) + '->next is NULL: p is at the last node, ' + nm(p) + '.'; break;
        case 'walk': say = 'p = p->next: one hop, to ' + nm(p) + '. That is ' + plural(hops, 'hop') + ' so far.'; break;
        case 'link-next': say = 'p->next = n: ' + nm(p) + ' now points forward at ' + inp.value + '. The forward chain is complete.'; break;
        case 'link-prev': say = 'n->prev = p: ' + inp.value + ' points back at ' + nm(p) + '. Without this line a backward walk would start at ' + inp.value + ' and stop at once.'; break;
        case 'return': say = 'Return head: unchanged, because the first node is still the first.'; break;
        case 'after': say = 'The list is ' + D.read(d, d.roots.head) + '. ' + (len > 1 ? 'Finding the end took ' + plural(hops, 'hop') + ' for ' + len + ' nodes: O(n). Keeping a tail pointer would make it O(1).' : 'Two links and no walking were needed.'); break;
      }
      return { items, say };
    },
    predict: [
      { at: (t) => t.tag === 'init' && t.data.nodes.length > 2, once: true, ask: 'How many times will p = p->next run before p reaches the last node?', options: (ts) => [...Array(ts[0].data.nodes.length + 1).keys()].map(String), answer: (ts) => String(ts.filter((t) => t.tag === 'walk').length), pick: 'option', explain: (ts) => 'p starts on the first node, so it takes one hop fewer than there are nodes: ' + ts.filter((t) => t.tag === 'walk').length + '.' },
      { at: (t) => t.tag === 'link-next', once: true, ask: 'n->prev = p is next. Click the node the new node\'s prev will point to.', answer: (ts, i) => 'n' + ts[i].data.cursors.p, explain: () => 'p is the old last node, the one just before the new node.' },
    ],
    quiz: [
      { q: 'Why does the loop test p->next != NULL and not p != NULL?', options: ['It is faster', 'p must stop on the last node, not run off the end', 'p->next is never NULL', 'To skip the first node'], answer: 1, why: 'The last node is the one whose next must change, so p has to stop on it.' },
      { q: 'With only a head pointer, inserting at the end of n nodes costs...', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], answer: 2, why: 'The walk to the last node visits every node.' },
      { q: 'What does an extra tail pointer change?', options: ['Nothing', 'Insertion at the end becomes O(1)', 'The list can hold more', 'prev links are no longer needed'], answer: 1, why: 'tail is the last node, so the walk disappears; only tail must be kept up to date.' },
      { q: 'Which two pointers join the new node to the old last node?', options: ['head and n->next', 'p->next = n and n->prev = p', 'n->next = p and p->prev = n', 'p->prev and n->prev'], answer: 1, why: 'Forward from the old last node, and back from the new node.' },
    ],
    compareWith: 'dll-insert-front',
  });

  // ---- insert at a position ------------------------------------------------------------------------------
  const STEPS4 = ['n->prev = p', 'n->next = p->next', 'p->next->prev = n', 'p->next = n'];
  const STEP_TAG = ['set-nprev', 'set-nnext', 'fix-succ', 'fix-p'];
  X.topic({
    id: 'dll-insert-pos', family: 'dll', order: 12, title: 'Insert at a position',
    blurb: 'Four pointers build a bridge in and out of the new node, and the order they are set in matters.',
    code: `/* insert value so that it ends up at position pos (0 is the front) */
struct node *insert_at(struct node *head, int pos, int value)
{
    struct node *n = new_node(value);       /*@ new */
    struct node *p = head;                  /*@ init */
    int i;
    if (pos == 0 || head == NULL) {         /*@ test-front */
        n->next = head;                     /*@ front-next */
        if (head != NULL)                   /*@ front-test */
            head->prev = n;                 /*@ front-prev */
        return n;                           /*@ front-return */
    }
    for (i = 0; i < pos - 1 && p->next != NULL; i++)   /*@ test-walk */
        p = p->next;                        /*@ walk */
    n->prev = p;                            /*@ set-nprev */
    n->next = p->next;                      /*@ set-nnext */
    if (p->next != NULL)                    /*@ test-succ */
        p->next->prev = n;                  /*@ fix-succ */
    p->next = n;                            /*@ fix-p */
    return head;                            /*@ return */
}`,
    animate: ['insert_at'], quiet: ['new_node'],
    inputs: [values, { id: 'pos', kind: 'int', label: 'Position', def: 2, lo: 0, hi: 7 }, { id: 'value', kind: 'int', label: 'Insert', def: 25, lo: -999, hi: 999 }],
    check: (inp) => (inp.pos > inp.values.length ? 'Position: at most ' + inp.values.length + ' (the end of this list)' : null),
    presets: [
      { label: 'In the middle', values: { values: [10, 20, 30, 40], pos: 2, value: 25 } },
      { label: 'At the front', values: { values: [10, 20, 30], pos: 0, value: 5 } },
      { label: 'At the end', values: { values: [10, 20, 30], pos: 3, value: 35 } },
      { label: 'Empty list', values: { values: [], pos: 0, value: 1 } },
    ],
    counters: ['follows', 'writes'],
    main: (inp) => X.dllMain(inp.values, 'head = insert_at(head, ' + inp.pos + ', ' + inp.value + ');'),
    capture: (P) => Object.assign(D.capture({ cursors: ['n', 'p'] })(P), { i: P.isSet('i', 0) ? P.val('i', 0) : null }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const n = d.cursors.n, p = d.cursors.p;
      const by = D.byAddr(d);
      const memo = ctx.memo;
      memo.done = memo.done || new Map();
      const si = STEP_TAG.indexOf(tag);
      if (si >= 0 && !memo.done.has(si)) memo.done.set(si, true);
      // where the new node hovers: above the gap after p (or before the first node)
      const place = (x, pos) => {
        if (x.addr !== n) return null;
        const step = D.STEP;
        if (x.links.prev && pos.has(x.links.prev)) return { x: pos.get(x.links.prev).x + step / 2, y: -128 };
        if (p && pos.has(p) && STEP_TAG.some((t) => memo.done.has(STEP_TAG.indexOf(t))) === false && ['set-nprev', 'test-walk', 'walk', 'init', 'test-front', 'new'].includes(tag) && inp.pos > 0) return { x: pos.get(p).x + step / 2, y: -128 };
        return null;
      };
      const pic = D.row(ctx, d, { start: d.roots.head, roots: HEADBOX, cursors: ['p'], place, nodeCls: (x) => (x.addr === n || (tag === 'after' && !D.original(ctx).has(x.addr)) ? 'part-b' : '') });
      const items = pic.items.concat(legend());
      if (n && pic.pos.has(n)) items.push({ key: 'cn', kind: 'cursor', at: 'n' + n, side: 'above', text: 'n', cls: 'c-green' });
      // numbered badges on the field each of the four lines wrote
      const badge = (k, addr, field) => {
        const at = pic.pos.get(addr);
        if (!at) return;
        const dx = field === 'prev' ? 16 : D.W - 16;
        items.push({ key: 'bd' + k, kind: 'token', x: at.x + dx, y: at.y + (field === 'prev' ? D.H + 14 : -14), r: 11, text: String(k + 1), cls: 'c-amber', enter: 'grow' });
      };
      const succ0 = memo.succ;
      if (tag === 'set-nnext') memo.succ = by.get(n).links.next;
      if (memo.done.has(0)) badge(0, n, 'prev');
      if (memo.done.has(1)) badge(1, n, 'next');
      if (memo.done.has(2) && memo.succ) badge(2, memo.succ, 'prev');
      if (memo.done.has(3)) badge(3, p || ctx.ticks.filter((t) => t.data.cursors.p).pop().data.cursors.p, 'next');
      void succ0;
      const middle = inp.pos > 0 && inp.values.length > 0;
      if (middle) {
        const row = (k) => (memo.done.has(k) ? 'done' : (k === 2 && tag === 'test-succ' && !by.get(p).links.next) ? 'skip' : STEP_TAG.indexOf(tag) + 1 === k || (k === 0 && ['test-walk', 'walk'].includes(tag)) ? 'now' : 'todo');
        const st = (k) => (k === 2 && memo.skip ? 'skip' : row(k));
        if (tag === 'test-succ' && !by.get(p).links.next) memo.skip = true;
        items.push(...D.checklist('ck', -115, 150, 'The bridge, in this order', STEPS4.map((s, k) => ({ text: (k + 1) + '.  ' + s, state: st(k) }))));
      }
      const nm = (a) => D.name(d, a);
      const pn = p && by.get(p) ? by.get(p).links.next : 0;
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert_at(head, ' + inp.pos + ', ' + inp.value + '): ' + inp.value + ' must end up at position ' + inp.pos + (inp.pos === 0 ? ', the front.' : ', so p has to stop on the node at position ' + (inp.pos - 1) + ', just before the gap.'); break;
        case 'new': say = 'new_node(' + inp.value + ') makes the node, linked to nothing yet.'; break;
        case 'init': say = p ? 'p starts at the first node, ' + nm(p) + '.' : 'p starts as head, NULL.'; break;
        case 'test-front': say = inp.pos === 0 || !inp.values.length ? 'Position 0 or an empty list: this is an insertion at the front, a case of its own.' : 'Not the front, so walk to the node before the gap.'; break;
        case 'front-next': say = 'n->next = head: the new node points at ' + (by.get(n).links.next ? nm(by.get(n).links.next) : 'NULL') + '.'; break;
        case 'front-test': say = d.roots.head ? 'There is an old first node; its prev must point back at the new one.' : 'The list was empty: no old first node to fix.'; break;
        case 'front-prev': say = 'head->prev = n: ' + nm(d.roots.head) + ' points back at ' + inp.value + '.'; break;
        case 'front-return': say = 'Return n, the new head.'; break;
        case 'test-walk': say = d.i < inp.pos - 1 && pn ? 'i = ' + d.i + ', still short of position ' + (inp.pos - 1) + ': move on.' : 'p has stopped at ' + nm(p) + (pn ? ', with ' + nm(pn) + ' after it.' : ', the last node.') + ' The new node goes between them.'; break;
        case 'walk': say = 'p = p->next: p moves to ' + nm(p) + '.'; break;
        case 'set-nprev': say = 'Step 1, n->prev = p: the new node points back at ' + nm(p) + '. Nothing in the list has changed yet, so nothing can be lost.'; break;
        case 'set-nnext': say = 'Step 2, n->next = p->next: the new node points forward at ' + nm(by.get(n).links.next) + '. Both of its own arrows are in place.'; break;
        case 'test-succ': say = pn ? 'There is a node after the gap, ' + nm(pn) + ', and its prev must now point at the new node.' : 'p is the last node: there is no node after the gap to fix, so step 3 is skipped.'; break;
        case 'fix-succ': say = 'Step 3, p->next->prev = n: ' + nm(by.get(n).links.next) + ' now points back at ' + inp.value + '. This line still reaches ' + nm(by.get(n).links.next) + ' through p->next, which is why p->next must not change before it.'; break;
        case 'fix-p': say = 'Step 4, p->next = n: ' + nm(p) + ' points forward at ' + inp.value + '. The new node is in, and the list is whole again.'; break;
        case 'return': say = 'Return head, unchanged.'; break;
        case 'after': say = 'The list is ' + D.read(d, d.roots.head) + ', with ' + inp.value + ' at position ' + inp.pos + '.'; break;
      }
      return { items, say, slow: tag === 'fix-p' };
    },
    predict: [
      { at: (t) => t.tag === 'set-nprev', once: true, ask: 'n->next = p->next is next. Click the node the new node\'s next will point to.', answer: (ts, i) => { const d = ts[i].data; const pp = d.nodes.find((x) => x.addr === d.cursors.p); return pp && pp.links.next ? 'n' + pp.links.next : null; }, explain: () => 'p->next is still the node after the gap: nothing in the list has changed yet.' },
      { at: (t) => t.tag === 'test-succ' && t.data.nodes.find((x) => x.addr === t.data.cursors.p).links.next, once: true, ask: 'Suppose step 4, p->next = n, had been done before step 3. What would p->next->prev = n then change?', options: () => ['The prev of the node after the gap', 'The new node\'s own prev: it would point at itself', 'Nothing'], answer: () => 'The new node\'s own prev: it would point at itself', pick: 'option', explain: () => 'After p->next = n, p->next is the new node, so p->next->prev = n would set n->prev = n, and the node after the gap would keep pointing back at p.' },
    ],
    quiz: [
      { q: 'Inserting in the middle of a doubly linked list sets how many pointers?', options: ['Two', 'Three', 'Four', 'Five'], answer: 2, why: 'Two in the new node (prev and next) and one in each neighbour.' },
      { q: 'Which line must come after p->next->prev = n?', options: ['n->prev = p', 'n->next = p->next', 'p->next = n', 'None'], answer: 2, why: 'p->next = n changes the path p->next->prev uses to reach the node after the gap.' },
      { q: 'Why are the new node\'s own two pointers safe to set first?', options: ['They are always NULL', 'They change nothing that is already in the list', 'They are set by malloc', 'C sets them in order'], answer: 1, why: 'The list is untouched until a neighbour points at the new node, so nothing can be lost.' },
      { q: 'When the new node goes at the end, which step is skipped?', options: ['n->prev = p', 'n->next = p->next', 'p->next->prev = n', 'p->next = n'], answer: 2, why: 'There is no node after the gap, so there is no prev to fix; n->next is simply NULL.' },
      { q: 'Why is position 0 handled separately?', options: ['It is faster', 'There is no node before the gap for p to stop on, and head must change', 'Position 0 is not allowed', 'To avoid a compiler warning'], answer: 1, why: 'Inserting at the front changes head itself. A sentinel node removes this special case.' },
    ],
  });

  // ---- delete a key --------------------------------------------------------------------------------------
  X.topic({
    id: 'dll-delete', family: 'dll', order: 20, title: 'Delete a key',
    blurb: 'Find the node, then repair two arrows around it: the left neighbour\'s next and the right neighbour\'s prev. No trailing pointer needed.',
    code: `/* remove the first node holding key; returns the head */
struct node *delete_key(struct node *head, int key)
{
    struct node *p = head;                  /*@ start */
    while (p != NULL && p->data != key)     /*@ compare */
        p = p->next;                        /*@ follow */
    if (p == NULL)                          /*@ test-found */
        return head;                        /*@ missing */
    if (p->prev != NULL)                    /*@ test-prev */
        p->prev->next = p->next;            /*@ bypass-next */
    else
        head = p->next;                     /*@ new-head */
    if (p->next != NULL)                    /*@ test-next */
        p->next->prev = p->prev;            /*@ bypass-prev */
    free(p);                                /*@ free */
    return head;                            /*@ return */
}`,
    animate: ['delete_key'],
    inputs: [values, { id: 'key', kind: 'int', label: 'Delete', def: 30, lo: -999, hi: 999 }],
    presets: [
      { label: 'In the middle', values: { values: [10, 20, 30, 40], key: 30 } },
      { label: 'The first node', values: { values: [10, 20, 30, 40], key: 10 } },
      { label: 'The last node', values: { values: [10, 20, 30, 40], key: 40 } },
      { label: 'The only node', values: { values: [10], key: 10 } },
      { label: 'Not there', values: { values: [10, 20, 30], key: 99 } },
    ],
    counters: ['compares', 'follows', 'frees'],
    main: (inp) => X.dllMain(inp.values, 'head = delete_key(head, ' + inp.key + ');'),
    capture: D.capture({ cursors: ['p'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const p = d.cursors.p;
      const by = D.byAddr(d);
      const memo = ctx.memo;
      const found = p && by.get(p) && by.get(p).data === inp.key && !['start', 'enter'].includes(tag) && !(tag === 'compare' && false);
      if (found && ['test-found', 'test-prev'].includes(tag)) memo.victim = p;
      const vic = memo.victim;
      const vn = vic && by.get(vic);
      const L = vn ? vn.links.prev : 0, Rn = vn ? vn.links.next : 0;
      const pic = D.row(ctx, d, {
        start: d.roots.head, roots: HEADBOX, cursors: ['p'], fixed: tag !== 'after',
        nodeCls: (x) => (x.addr === vic && !x.freed ? 'doomed' : tag === 'compare' && x.addr === p ? 'focus' : ''),
        arrowCls: (x, l) => (vic && x.addr !== vic && x.links[l] === vic && ['bypass-next', 'new-head', 'test-next'].includes(tag) ? 'bad' : ''),
      });
      const items = pic.items.concat(legend());
      // the bug that is easy to make: one arrow still points at the node being removed
      if (vic && ['bypass-next', 'new-head', 'test-next'].includes(tag) && Rn && by.get(Rn).links.prev === vic && pic.pos.has(Rn)) {
        const at = pic.pos.get(Rn);
        items.push({ key: 'warn', kind: 'text', x: at.x + D.W / 2, y: at.y + D.H + 92, text: Math.abs(at.y) < 1 ? nmOf(d, Rn) + '->prev still points at ' + inp.key : '', cls: 'bad', anchor: 'middle' });
      }
      if (vic) {
        const st = (doneTags, skipIf) => (skipIf ? 'skip' : doneTags.some((t) => memo['did-' + t]) ? 'done' : 'todo');
        if (['bypass-next', 'new-head', 'bypass-prev', 'free'].includes(tag)) memo['did-' + tag] = true;
        items.push(...D.checklist('ck', -115, 215, 'Repairs around ' + inp.key, [
          { text: L ? nmOf(d, L) + '->next skips ' + inp.key : 'no left neighbour: head moves instead', state: st(['bypass-next', 'new-head']) },
          { text: Rn ? nmOf(d, Rn) + '->prev skips ' + inp.key : 'no right neighbour: nothing to fix', state: st(['bypass-prev'], !Rn && !!memo['did-free']) },
          { text: 'free the node', state: st(['free']) },
        ]));
      }
      const nm = (a) => D.name(d, a);
      let say = '';
      switch (tag) {
        case 'enter': say = 'delete_key(head, ' + inp.key + '): find the node holding ' + inp.key + ', then join its neighbours to each other in both directions.'; break;
        case 'start': say = p ? 'p starts at the first node, ' + nm(p) + '. Unlike a singly linked list, no trailing prev pointer is needed: the node itself knows its predecessor.' : 'The list is empty: p is NULL.'; break;
        case 'compare': say = !p ? 'p is NULL: the end of the list, and ' + inp.key + ' was not found.' : by.get(p).data === inp.key ? nm(p) + ' is ' + inp.key + ': found it. The loop stops with p on the node to remove.' : nm(p) + ' is not ' + inp.key + ', move on.'; break;
        case 'follow': say = 'p = p->next: p moves to ' + nm(p) + '.'; break;
        case 'test-found': say = p ? 'p is not NULL: there is a node to remove.' : 'p is NULL: there is nothing to remove.'; break;
        case 'missing': say = inp.key + ' is not in the list. Return head, and nothing has changed.'; break;
        case 'test-prev': say = L ? inp.key + ' has a left neighbour, ' + nm(L) + ', whose next must skip over it.' : inp.key + ' is the first node: its prev is NULL, so there is no left neighbour. head itself must move.'; break;
        case 'bypass-next': say = 'p->prev->next = p->next: ' + nm(L) + '\'s next arches over ' + inp.key + ' to ' + nm(Rn) + '. Going forwards, ' + inp.key + ' is already out of the list.' + (Rn ? ' Going backwards it is not: ' + nm(Rn) + '->prev still points at it.' : ''); break;
        case 'new-head': say = 'head = p->next: the list now starts at ' + nm(Rn) + '.' + (Rn ? ' But ' + nm(Rn) + '->prev still points at ' + inp.key + '.' : ' The list will be empty.'); break;
        case 'test-next': say = Rn ? inp.key + ' has a right neighbour, ' + nm(Rn) + ', whose prev must skip back over it.' : inp.key + ' was the last node: there is no right neighbour to fix.'; break;
        case 'bypass-prev': say = 'p->next->prev = p->prev: ' + nm(Rn) + '\'s prev now points at ' + nm(L) + '. Nothing in the list leads to ' + inp.key + ' any more, in either direction.'; break;
        case 'free': say = 'free(p): the node\'s memory goes back to the heap. p still holds its address, but must not be used again.'; break;
        case 'return': say = 'Return head' + (L ? ', unchanged.' : ', which moved because the first node went.'); break;
        case 'after': say = 'The list is ' + D.read(d, d.roots.head) + '.' + (vic ? ' Two arrows were repaired (fewer at the ends), and the walk needed only one pointer.' : ''); break;
      }
      return { items, say, slow: tag === 'bypass-prev' || tag === 'free' };
    },
    predict: [
      { at: (t, i, ts, ctx) => t.tag === 'test-prev' && t.data.nodes.find((x) => x.addr === t.data.cursors.p).links.prev, once: true, ask: 'p->prev->next = p->next runs next. Click the node whose next arrow will change.', answer: (ts, i) => 'n' + ts[i].data.nodes.find((x) => x.addr === ts[i].data.cursors.p).links.prev, explain: () => 'p->prev is the left neighbour; its next is the arrow that must skip p.' },
      { at: (t) => t.tag === 'bypass-next' && t.data.nodes.find((x) => x.addr === t.data.cursors.p).links.next, once: true, ask: 'Going forwards, the node is gone. Which node still has an arrow pointing at it? Click it.', answer: (ts, i) => 'n' + ts[i].data.nodes.find((x) => x.addr === ts[i].data.cursors.p).links.next, explain: () => 'The right neighbour\'s prev. Forgetting this second repair leaves a pointer to freed memory.' },
    ],
    quiz: [
      { q: 'Why does deleting from a doubly linked list not need a trailing prev pointer while walking?', options: ['It does need one', 'Each node\'s prev field already says which node comes before it', 'The list is sorted', 'free() finds it'], answer: 1, why: 'p->prev gives the left neighbour directly.' },
      { q: 'How many pointers change when a middle node is deleted?', options: ['One', 'Two', 'Three', 'Four'], answer: 1, why: 'The left neighbour\'s next and the right neighbour\'s prev.' },
      { q: 'What goes wrong if p->next->prev = p->prev is left out?', options: ['Nothing', 'Walking backwards reaches the freed node', 'Walking forwards reaches the freed node', 'head becomes NULL'], answer: 1, why: 'The right neighbour still points back at the freed node: a dangling pointer.' },
      { q: 'Deleting the first node changes which pointer instead of p->prev->next?', options: ['p->next->next', 'head', 'The last node\'s next', 'None'], answer: 1, why: 'There is no left neighbour, so head must move to the second node.' },
      { q: 'Given a pointer to the node already, deleting it costs...', options: ['O(n)', 'O(1)', 'O(log n)', 'Depends on the key'], answer: 1, why: 'Both neighbours are one step away; only the search for the key costs O(n).' },
    ],
  });
  // ---- walk backwards ------------------------------------------------------------------------------------
  X.topic({
    id: 'dll-traverse-back', family: 'dll', order: 30, title: 'Walk backwards',
    blurb: 'Run to the end along next, then come back along prev, printing as you go. A singly linked list cannot do the second half.',
    code: `/* print the list from the last node to the first */
void print_backward(struct node *head)
{
    struct node *p = head;          /*@ start */
    if (p == NULL)                  /*@ test-empty */
        return;                     /*@ empty */
    while (p->next != NULL)         /*@ test-end */
        p = p->next;                /*@ walk-out */
    while (p != NULL) {             /*@ test-back */
        printf("%d ", p->data);     /*@ print */
        p = p->prev;                /*@ walk-back */
    }
    printf("\\n");                   /*@ newline */
}`,
    animate: ['print_backward'],
    inputs: [values],
    presets: [
      { label: 'Four nodes', values: { values: [10, 20, 30, 40] } },
      { label: 'One node', values: { values: [7] } },
      { label: 'Empty list', values: { values: [] } },
      { label: 'Seven nodes', values: { values: [3, 1, 4, 1, 5, 9, 2] } },
    ],
    counters: ['follows'],
    main: (inp) => X.dllMain(inp.values, 'print_backward(head);'),
    capture: D.capture({ cursors: ['p'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const p = d.cursors.p;
      const by = D.byAddr(d);
      const memo = ctx.memo;
      memo.out = memo.out || new Set();
      memo.back = memo.back || new Set();
      memo.printed = memo.printed || [];
      if (tag === 'walk-out' && ctx.prev) memo.out.add(ctx.prev.data.cursors.p);
      if (tag === 'print' && !memo.printed.includes(p)) memo.printed.push(p);
      if (tag === 'walk-back' && ctx.prev) memo.back.add(ctx.prev.data.cursors.p);
      const phase2 = ['test-back', 'print', 'walk-back', 'newline', 'after'].includes(tag) || (tag === 'end');
      const pic = D.row(ctx, d, {
        start: d.roots.head, roots: HEADBOX, cursors: ['p'], fixed: true,
        nodeCls: (x) => (memo.printed.includes(x.addr) ? 'part-b' : x.addr === p ? 'focus' : ''),
        arrowCls: (x, l) => (l === 'next' && memo.out.has(x.addr) ? 'walked' : l === 'prev' && memo.back.has(x.addr) ? 'walked-back' : ''),
      });
      const items = pic.items.concat(legend());
      if (d.nodes.length) items.push({ key: 'phase', kind: 'text', x: -115, y: -90, text: phase2 ? 'Phase 2: back along prev, printing' : 'Phase 1: out to the end along next', cls: phase2 ? 'phase-back' : 'phase-out' });
      const vals = memo.printed.map((a) => by.get(a).data);
      const lastP = memo.printed.length ? pic.pos.get(memo.printed[memo.printed.length - 1]) : null;
      items.push(...D.tape('tape', vals, -115, 190, { title: 'printed so far', fresh: tag === 'print', from: lastP ? { x: lastP.x + 40, y: lastP.y } : null }));
      const nm = (a) => D.name(d, a);
      let say = '';
      switch (tag) {
        case 'enter': say = 'print_backward(head): the list must come out last node first. All we have is head, at the front.'; break;
        case 'start': say = p ? 'p starts at the first node, ' + nm(p) + '.' : 'p = head, which is NULL.'; break;
        case 'test-empty': say = p ? 'The list is not empty.' : 'The list is empty: there is nothing to print.'; break;
        case 'empty': say = 'Return without printing anything.'; break;
        case 'test-end': say = by.get(p).links.next ? nm(p) + ' is not the last node: keep running forwards.' : nm(p) + '->next is NULL: p has reached the last node. Phase 1 is over.'; break;
        case 'walk-out': say = 'p = p->next: forwards to ' + nm(p) + '. Nothing is printed on the way out.'; break;
        case 'test-back': say = p ? 'p is at ' + nm(p) + ', not NULL: print it.' : 'p is NULL: the walk back has gone past the first node. Everything has been printed.'; break;
        case 'print': say = 'Print ' + nm(p) + '. That is ' + plural(vals.length, 'value') + ' printed: ' + vals.join(' ') + '.'; break;
        case 'walk-back': say = p ? 'p = p->prev: back to ' + nm(p) + '. This is the step a singly linked list has no arrow for.' : 'p = p->prev: the first node\'s prev is NULL, so p becomes NULL.'; break;
        case 'newline': say = 'End the line. Output: ' + (vals.join(' ') || '(nothing)') + '.'; break;
        case 'after': say = vals.length ? 'Printed ' + vals.join(' ') + ': the list in reverse, in O(n) time and with no extra memory. ' + (vals.length > 1 ? 'Every node was visited twice, once each way.' : '') : 'Nothing to print for an empty list.'; break;
      }
      return { items, say };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'test-end' && !t.data.nodes.find((x) => x.addr === t.data.cursors.p).links.next && ts.length > 0, once: true, ask: 'Phase 1 is over. Which node will be printed first? Click it.', answer: (ts, i) => 'n' + ts[i].data.cursors.p, explain: () => 'The last node: p is standing on it, and printing happens before each step back.' },
      { at: (t, i, ts) => t.tag === 'print' && ts[i + 1] && ts[i + 1].tag === 'walk-back' && ts[i + 1].data.cursors.p === 0, once: true, ask: 'p is on the first node. What will p = p->prev give?', options: () => ['NULL, so the loop ends', 'The last node', 'The second node'], answer: () => 'NULL, so the loop ends', pick: 'option', explain: () => 'The first node\'s prev is NULL: that is how the walk back knows to stop.' },
    ],
    quiz: [
      { q: 'Why must a singly linked list use recursion or a stack to print backwards?', options: ['It is shorter', 'Its nodes have no arrow to the node before', 'printf needs it', 'It does not'], answer: 1, why: 'Without prev, there is no way to step back from a node.' },
      { q: 'How many times is each node visited by print_backward?', options: ['Once', 'Twice: out and back', 'n times', 'Not at all'], answer: 1, why: 'Once on the way to the end, once while printing on the way back. Still O(n).' },
      { q: 'What stops the backward loop?', options: ['p reaching head', 'p becoming NULL after the first node', 'A counter', 'The last node'], answer: 1, why: 'The first node\'s prev is NULL.' },
      { q: 'With a tail pointer kept up to date, what changes?', options: ['Nothing', 'Phase 1 disappears: start at tail', 'Phase 2 disappears', 'The list must be circular'], answer: 1, why: 'The walk out to the last node is only needed to find it.' },
    ],
  });

  // ---- reverse --------------------------------------------------------------------------------------------
  X.topic({
    id: 'dll-reverse', family: 'dll', order: 40, title: 'Reverse',
    blurb: 'In every node, prev and next trade places. No node moves; the arrows turn round in pairs.',
    code: `/* reverse the list in place; returns the new head */
struct node *reverse(struct node *head)
{
    struct node *p = head;          /*@ start */
    struct node *tmp;
    while (p != NULL) {             /*@ test */
        tmp = p->prev;              /*@ save */
        p->prev = p->next;          /*@ swap-prev */
        p->next = tmp;              /*@ swap-next */
        head = p;                   /*@ mark-head */
        p = p->prev;                /*@ step */
    }
    return head;                    /*@ return */
}`,
    animate: ['reverse'],
    inputs: [values],
    presets: [
      { label: 'Four nodes', values: { values: [10, 20, 30, 40] } },
      { label: 'Two nodes', values: { values: [1, 2] } },
      { label: 'One node', values: { values: [7] } },
      { label: 'Empty list', values: { values: [] } },
    ],
    counters: ['swaps', 'writes'],
    main: (inp) => X.dllMain(inp.values, 'head = reverse(head);'),
    capture: (P) => Object.assign(D.capture({ cursors: ['p', 'tmp', 'head'] })(P), { tmpSet: P.has('tmp', 0) && P.isSet('tmp', 0) }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const p = d.cursors.p;
      const by = D.byAddr(d);
      const memo = ctx.memo;
      memo.done = memo.done || new Set();
      if (tag === 'swap-next' && p) memo.done.add(p);
      const cur = ['save', 'swap-prev', 'swap-next', 'mark-head'].includes(tag) ? p : (tag === 'step' && ctx.prev ? ctx.prev.data.cursors.p : 0);
      const cursors = ['p', 'head'].concat(d.tmpSet ? ['tmp'] : []);
      if (tag === 'after') d.cursors.head = d.roots.head;
      const pic = D.row(ctx, d, {
        start: ctx.ticks[0].data.roots.head, fixed: true, still: true, cursors,
        nodeCls: (x) => (memo.done.has(x.addr) ? 'part-a' : x.addr === cur ? 'focus' : ''),
        arrowCls: (x) => (memo.done.has(x.addr) ? 'part-a' : ''),
      });
      const items = pic.items.concat(legend());
      // the swap, close up: p's node's two links and tmp
      if (cur && by.get(cur)) {
        const c = by.get(cur);
        const w = K2.written(ctx, d).get(cur) || new Set();
        const cell = (k, x, label, v, hot) => items.push({ key: 'sw' + k, kind: 'cell', x, y: 200, w: 86, h: 40, text: D.name(d, v), sub: label, cls: hot ? 'hot' : '' });
        items.push({ key: 'swT', kind: 'text', x: -115, y: 225, text: 'node ' + c.data + ':', cls: 'note' });
        cell('p', -60, 'prev', c.links.prev, w.has('prev'));
        cell('n', 40, 'next', c.links.next, w.has('next'));
        if (d.tmpSet) cell('t', 170, 'tmp', d.cursors.tmp, tag === 'save');
      }
      const nm = (a) => D.name(d, a);
      const c = cur && by.get(cur);
      let say = '';
      switch (tag) {
        case 'enter': say = d.roots.head ? 'reverse(head) on ' + D.read(d, d.roots.head) + '. Every node\'s next must become its prev and the other way round.' : 'reverse(head) on an empty list: head is NULL.'; break;
        case 'start': say = p ? 'p starts at the first node, ' + nm(p) + '.' : 'p = head, which is NULL.'; break;
        case 'test': say = p ? 'p is at ' + nm(p) + ': swap its two links.' : 'p is NULL: every node has been swapped.'; break;
        case 'save': say = 'tmp = p->prev: keep ' + nm(d.cursors.tmp) + ' safe, the way a swap of two variables needs a third.'; break;
        case 'swap-prev': say = 'p->prev = p->next: ' + c.data + '\'s prev now points at ' + nm(c.links.prev) + ', the node that used to come after it.'; break;
        case 'swap-next': say = 'p->next = tmp: ' + c.data + '\'s next now points at ' + nm(c.links.next) + '. Node ' + c.data + ' is turned round.'; break;
        case 'mark-head': say = 'head = p: ' + c.data + ' is, so far, the last node turned round, which makes it the front of the reversed list.'; break;
        case 'step': say = 'p = p->prev moves p ' + (p ? 'forwards to ' + nm(p) : 'to NULL: that was the old last node') + '. It looks backwards, but p->prev now holds the old next.'; break;
        case 'return': say = 'Return head: ' + nm(d.cursors.head) + ', the old last node.'; break;
        case 'after': say = d.roots.head ? 'The list is now ' + D.read(d, d.roots.head) + '. Each node had its two links swapped; no node moved and nothing was allocated.' : 'Still empty.'; break;
      }
      return { items, say, slow: tag === 'swap-next' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'mark-head' && ts[i + 1] && ts[i + 1].data.cursors.p, once: true, ask: 'p = p->prev is next. Click the node p will move to.', answer: (ts, i) => 'n' + ts[i + 1].data.cursors.p, explain: () => 'p->prev was just given the old next, so "back" along prev is forwards along the old list.' },
      { at: (t) => t.tag === 'start' && t.data.cursors.p, once: true, ask: 'Which node will reverse() return as the new head? Click it.', answer: (ts) => 'n' + ts[ts.length - 1].data.roots.head, explain: () => 'The old last node: the loop leaves head on the last node it swapped.' },
    ],
    quiz: [
      { q: 'What does reversing a doubly linked list change in each node?', options: ['Its data', 'It swaps prev and next', 'Only next', 'Nothing: only head changes'], answer: 1, why: 'Every node\'s two links trade places; the data stays.' },
      { q: 'Why does the loop step with p = p->prev?', options: ['It walks backwards', 'After the swap, prev holds what used to be next', 'It is a mistake', 'To skip a node'], answer: 1, why: 'The old next was just moved into prev.' },
      { q: 'Why is tmp needed?', options: ['It is not', 'Swapping two values needs somewhere to keep one of them', 'To count the nodes', 'To free nodes'], answer: 1, why: 'Writing p->prev first would lose the old prev without a copy.' },
      { q: 'With only a reversed head pointer and no swapping, could you still read the list backwards?', options: ['No', 'Yes: start at the last node and follow prev', 'Only if it is circular', 'Only if it is sorted'], answer: 1, why: 'A doubly linked list can be read either way already; reversal is needed when the order itself must change.' },
    ],
  });
})(SEE);
