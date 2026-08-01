// Circular doubly linked lists: insert at the end and delete a key. The ring has next arrows round the
// outside and prev arrows round the inside; the first node's prev is the last node, so both ends are
// one step from head and there is no NULL to test for.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, D = X.DListKit;

  const HEAD = `#include <stdio.h>
#include <stdlib.h>

/* one node: a value, the node before it and the node after it; the ring has no NULL links */
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

/* main uses this to set up the list you chose; it returns the first node */
struct node *build(const int *values, int count)
{
    struct node *head = NULL;
    int i;
    for (i = 0; i < count; i++) {
        struct node *n = new_node(values[i]);
        if (head == NULL) {
            n->next = n;
            n->prev = n;
            head = n;
        } else {
            n->next = head;
            n->prev = head->prev;
            head->prev->next = n;
            head->prev = n;
        }
    }
    return head;
}`;

  const arrayInit = (vals) => (vals.length ? '{ ' + vals.join(', ') + ' }' : '{ 0 }');
  const cMain = (vals, call) => `int main(void)
{
    int values[] = ${arrayInit(vals)};
    struct node *head = build(values, ${vals.length});
    ${call}
    return 0;
}`;

  X.family({
    id: 'cdll', order: 4, group: 'Linked lists', title: 'Circular doubly linked lists',
    blurb: 'Two-way links closed into a ring. head->prev is the last node, every node has two neighbours, and the NULL tests disappear.',
    head: HEAD,
  });

  const values = { id: 'values', kind: 'ints', label: 'The list', def: [10, 20, 30, 40], min: 0, max: 8 };
  const LINKS = ['next', 'prev'];
  const readRing = (d, head) => {
    const by = D.byAddr(d);
    if (!head || !by.has(head)) return 'empty';
    const out = [];
    let p = head, k = 0;
    do { out.push(by.get(p).data); p = by.get(p).links.next; } while (p && p !== head && by.has(p) && k++ < 20);
    return out.join(' ⇄ ') + ' ⇄ (back to ' + out[0] + ')';
  };
  const legend = (R) => [
    { key: 'lgN', kind: 'text', x: R + 110, y: 110, text: 'next arrows: round the outside', cls: 'legend-next' },
    { key: 'lgP', kind: 'text', x: R + 110, y: 132, text: 'prev arrows: round the inside', cls: 'legend-prev' },
  ];

  // ---- insert at the end ---------------------------------------------------------------------------------
  const WRITES = ['link-next', 'link-prev', 'fix-last', 'fix-head'];
  X.topic({
    id: 'cdll-insert', family: 'cdll', order: 10, title: 'Insert at the end',
    blurb: 'The last node is head->prev: one step back, no walk. Then four pointers close the ring round the new node.',
    code: `/* put value in a new node after the last one; returns the head */
struct node *insert_end(struct node *head, int value)
{
    struct node *n = new_node(value);   /*@ new */
    struct node *last;
    if (head == NULL) {                 /*@ test-empty */
        n->next = n;                    /*@ self-next */
        n->prev = n;                    /*@ self-prev */
        return n;                       /*@ return-new */
    }
    last = head->prev;                  /*@ find-last */
    n->next = head;                     /*@ link-next */
    n->prev = last;                     /*@ link-prev */
    last->next = n;                     /*@ fix-last */
    head->prev = n;                     /*@ fix-head */
    return head;                        /*@ return */
}`,
    animate: ['insert_end'], quiet: ['new_node'],
    inputs: [values, { id: 'value', kind: 'int', label: 'Insert', def: 50, lo: -999, hi: 999 }],
    presets: [
      { label: 'Four nodes', values: { values: [10, 20, 30, 40], value: 50 } },
      { label: 'Empty list', values: { values: [], value: 50 } },
      { label: 'One node', values: { values: [10], value: 20 } },
      { label: 'Seven nodes', values: { values: [1, 2, 3, 4, 5, 6, 7], value: 8 } },
    ],
    counters: ['allocs', 'writes'],
    main: (inp) => cMain(inp.values, 'head = insert_end(head, ' + inp.value + ');'),
    capture: D.capture({ roots: ['head'], cursors: ['n', 'last'], links: LINKS }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const n = d.cursors.n, last = d.cursors.last;
      const head = d.roots.head;
      const by = D.byAddr(d);
      const memo = ctx.memo;
      memo.did = memo.did || new Set();
      if (WRITES.includes(tag)) memo.did.add(tag);
      const pic = D.ring(ctx, d, {
        start: head && by.has(head) ? head : n, links: LINKS, roots: ['head'], cursors: ['n', 'last'],
        nodeCls: (x) => (x.addr === n || (tag === 'after' && !D.original(ctx).has(x.addr)) ? 'part-b' : ''),
        arrowCls: (x, l) => (tag === 'find-last' && x.addr === head && l === 'prev' ? 'hot' : tag === 'fix-last' && x.addr === head && l === 'prev' ? 'bad' : ''),
      });
      const items = pic.items.concat(legend(pic.R));
      if (head && ctx.ticks[0].data.roots.head) {
        const k = (t) => (memo.did.has(t) ? 'done' : WRITES[WRITES.findIndex((w) => !memo.did.has(w))] === t && tag !== 'enter' && tag !== 'new' && tag !== 'test-empty' ? 'now' : 'todo');
        const lastN = last ? by.get(last).data : 'last';
        const headN = by.get(head) ? by.get(head).data : 'head';
        items.push(...D.checklist('ck', pic.R + 110, -60, 'Four pointers', [
          { text: 'n->next = head (' + headN + ')', state: k('link-next') },
          { text: 'n->prev = last (' + lastN + ')', state: k('link-prev') },
          { text: 'last->next = n', state: k('fix-last') },
          { text: 'head->prev = n', state: k('fix-head') },
        ]));
      }
      const nm = (a) => D.name(d, a);
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert_end(head, ' + inp.value + '): the new node goes after the last node, which in a ring is just before head.'; break;
        case 'new': say = 'new_node(' + inp.value + ') makes the node. It waits outside the ring, in the gap between the last node and head.'; break;
        case 'test-empty': say = head ? 'head is not NULL: there is a ring to join.' : 'head is NULL: the new node will be a ring by itself.'; break;
        case 'self-next': say = 'n->next = n: the only node follows itself.'; break;
        case 'self-prev': say = 'n->prev = n: and it comes before itself. Both arrows loop back.'; break;
        case 'return-new': say = 'Return n: the new node is head, and also its own last node.'; break;
        case 'find-last': say = 'last = head->prev: one step backwards from head reaches the last node, ' + nm(last) + '. A singly linked list with only head would have to walk the whole list here.'; break;
        case 'link-next': say = 'n->next = head: ' + inp.value + ' points forward at ' + nm(head) + ', closing its side of the ring.'; break;
        case 'link-prev': say = 'n->prev = last: ' + inp.value + ' points back at ' + nm(last) + '. Both of the new node\'s arrows are set, and the ring itself is untouched so far.'; break;
        case 'fix-last': say = 'last->next = n: ' + nm(last) + ' now points forward at ' + inp.value + ' instead of ' + nm(head) + '. Going forwards the ring is whole, but ' + nm(head) + '->prev still skips the new node.'; break;
        case 'fix-head': say = 'head->prev = n: ' + nm(head) + ' now points back at ' + inp.value + ', which makes it the last node. The ring is closed again.'; break;
        case 'return': say = 'Return head, unchanged.'; break;
        case 'after': say = 'Read from head: ' + readRing(d, d.roots.head) + '. Four pointers, no walk: O(1).'; break;
      }
      return { items, say, slow: tag === 'find-last' || tag === 'fix-head' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'test-empty' && t.data.roots.head && ts[i + 1] && ts[i + 1].tag === 'find-last', once: true, ask: 'last = head->prev is next. Click the node last will point to.', answer: (ts, i) => 'n' + ts[i + 1].data.cursors.last, explain: () => 'head->prev is the last node of the ring. No walking needed.' },
      { at: (t, i, ts) => t.tag === 'link-prev' && ts[i + 1] && ts[i + 1].tag === 'fix-last', once: true, ask: 'The new node\'s own arrows are set. How many pointers inside the ring still have to change?', options: () => ['0', '1', '2', '3'], answer: () => '2', pick: 'option', explain: () => 'last->next and head->prev: the two arrows that crossed the gap now have to meet the new node.' },
    ],
    quiz: [
      { q: 'How does insert_end find the last node of a circular doubly linked list?', options: ['By walking from head', 'head->prev', 'head->next->prev', 'It keeps a counter'], answer: 1, why: 'The first node\'s prev is the last node: one step.' },
      { q: 'How many pointers does inserting into a non-empty ring set?', options: ['Two', 'Three', 'Four', 'Six'], answer: 2, why: 'Two in the new node, one in each neighbour.' },
      { q: 'Why can n->next and n->prev be set before anything else?', options: ['They are NULL', 'They change nothing in the ring, so nothing can be lost', 'C requires it', 'They are set by malloc'], answer: 1, why: 'Until a neighbour points at the new node, the ring is exactly as it was.' },
      { q: 'In a one-node ring, what are n->next and n->prev?', options: ['NULL and NULL', 'n and n', 'head and NULL', 'Undefined'], answer: 1, why: 'The only node is its own neighbour on both sides.' },
      { q: 'What would inserting at the front need, compared with this?', options: ['A walk to the end', 'The same four pointers, and then head = n', 'Eight pointers', 'It is impossible'], answer: 1, why: 'Front and end are the same gap in a ring; only which node head names differs.' },
    ],
  });

  // ---- delete a key --------------------------------------------------------------------------------------
  X.topic({
    id: 'cdll-delete', family: 'cdll', order: 20, title: 'Delete a key',
    blurb: 'Both neighbours always exist, so the two repairs need no NULL tests. Only an empty ring and a ring of one are special.',
    code: `/* remove the first node holding key; returns the head */
struct node *delete_key(struct node *head, int key)
{
    struct node *p;
    if (head == NULL)                   /*@ test-empty */
        return NULL;                    /*@ empty */
    p = head;                           /*@ start */
    while (p->data != key) {            /*@ compare */
        p = p->next;                    /*@ follow */
        if (p == head)                  /*@ test-lap */
            return head;                /*@ missing */
    }
    if (p->next == p)                   /*@ test-only */
        head = NULL;                    /*@ only */
    else {
        p->prev->next = p->next;        /*@ bypass-next */
        p->next->prev = p->prev;        /*@ bypass-prev */
        if (p == head)                  /*@ test-head */
            head = p->next;             /*@ move-head */
    }
    free(p);                            /*@ free */
    return head;                        /*@ return */
}`,
    animate: ['delete_key'],
    inputs: [values, { id: 'key', kind: 'int', label: 'Delete', def: 30, lo: -999, hi: 999 }],
    presets: [
      { label: 'In the middle', values: { values: [10, 20, 30, 40], key: 30 } },
      { label: 'The head', values: { values: [10, 20, 30, 40], key: 10 } },
      { label: 'The only node', values: { values: [10], key: 10 } },
      { label: 'Not there', values: { values: [10, 20, 30], key: 99 } },
    ],
    counters: ['compares', 'follows', 'frees'],
    main: (inp) => cMain(inp.values, 'head = delete_key(head, ' + inp.key + ');'),
    capture: D.capture({ roots: ['head'], cursors: ['p'], links: LINKS }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const p = d.cursors.p;
      const by = D.byAddr(d);
      const memo = ctx.memo;
      if (tag === 'compare' && p && by.get(p).data === inp.key) memo.victim = p;
      const vic = memo.victim;
      const vn = vic && by.get(vic);
      const live = (a) => a && by.has(a) && !by.get(a).freed;
      const start = live(d.roots.head) ? d.roots.head : vn && live(vn.links.next) && vn.links.next !== vic ? vn.links.next : 0;
      const half = tag === 'bypass-next';
      const pic = D.ring(ctx, d, {
        start, links: LINKS, roots: ['head'], cursors: ['p'], keep: tag !== 'after' ? vic : 0,
        nodeCls: (x) => (x.addr === vic && !x.freed ? 'doomed' : tag === 'compare' && x.addr === p ? 'focus' : ''),
        arrowCls: (x, l) => (half && x.addr !== vic && x.links[l] === vic ? 'bad' : ''),
      });
      const items = pic.items.concat(legend(pic.R));
      if (half && vn) items.push({ key: 'warn', kind: 'text', x: 0, y: -pic.R - 104, text: D.name(d, vn.links.next) + '->prev still points at ' + inp.key, cls: 'bad', anchor: 'middle' });
      if (tag === 'compare' && p) items.push({ key: 'verdict', kind: 'text', x: 0, y: -pic.R - 104, text: by.get(p).data === inp.key ? '✓ ' + by.get(p).data + ' = ' + inp.key : '✗ ' + by.get(p).data + ' ≠ ' + inp.key, cls: by.get(p).data === inp.key ? 'good' : 'bad', anchor: 'middle' });
      // the doubly linked version needs a test before each repair; this one needs none
      if (vic) items.push(...D.checklist('ck', pic.R + 110, -60, 'Tests before the repairs', [
        { text: 'linear list: if (p->prev != NULL)', state: 'skip' },
        { text: 'linear list: if (p->next != NULL)', state: 'skip' },
        { text: 'ring: none, both neighbours exist', state: 'done' },
      ]));
      const nm = (a) => D.name(d, a);
      let say = '';
      switch (tag) {
        case 'enter': say = 'delete_key(head, ' + inp.key + '): find the node, then join its two neighbours. In a ring both neighbours always exist.'; break;
        case 'test-empty': say = d.roots.head ? 'The ring is not empty.' : 'head is NULL: nothing to delete.'; break;
        case 'empty': say = 'Return NULL.'; break;
        case 'start': say = 'p starts at head, ' + nm(p) + '.'; break;
        case 'compare': say = by.get(p).data === inp.key ? nm(p) + ' is ' + inp.key + ': found.' : nm(p) + ' is not ' + inp.key + ', move on.'; break;
        case 'follow': say = 'p = p->next: on to ' + nm(p) + '.'; break;
        case 'test-lap': say = p === d.roots.head ? 'p is back at head: a full lap without finding ' + inp.key + '.' : 'Not back at head yet.'; break;
        case 'missing': say = inp.key + ' is not in the ring. Return head unchanged.'; break;
        case 'test-only': say = vn.links.next === vic ? 'p->next is p itself: this is the only node.' : 'There are other nodes, so the ring closes over p.'; break;
        case 'only': say = 'head = NULL: deleting the only node leaves an empty list.'; break;
        case 'bypass-next': say = 'p->prev->next = p->next: ' + nm(vn.links.prev) + ' now points forward at ' + nm(vn.links.next) + '. No test for NULL first: in a ring p->prev always exists.'; break;
        case 'bypass-prev': say = 'p->next->prev = p->prev: ' + nm(vn.links.next) + ' now points back at ' + nm(vn.links.prev) + '. Nothing in the ring leads to ' + inp.key + ' any more.'; break;
        case 'test-head': say = vic === d.roots.head ? inp.key + ' is head: head must move before the node is freed.' : 'head is a different node and stays.'; break;
        case 'move-head': say = 'head = p->next: ' + nm(d.roots.head) + ' is the new head.'; break;
        case 'free': say = 'free(p): the node goes back to the heap.'; break;
        case 'return': say = 'Return head.'; break;
        case 'after': say = 'Read from head: ' + readRing(d, d.roots.head) + '.'; break;
      }
      return { items, say, slow: tag === 'bypass-prev' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'test-only' && ts[i + 1] && ts[i + 1].tag === 'bypass-next', once: true, ask: 'p->prev->next = p->next is next. Click the node whose next arrow changes.', answer: (ts, i) => { const d = ts[i].data; return 'n' + D.byAddr(d).get(d.cursors.p).links.prev; }, explain: () => 'p->prev, the node before p. In a ring there is always one, even for head.' },
      { at: (t, i, ts) => t.tag === 'compare' && ts[i + 1] && ts[i + 1].tag === 'follow' && ts[0].data.nodes.length > 2, once: true, ask: 'Without the test p == head inside the loop, what would happen when the key is missing?', options: () => ['p becomes NULL and the loop stops', 'p goes round the ring for ever', 'It deletes head'], answer: () => 'p goes round the ring for ever', pick: 'option', explain: () => 'A ring has no NULL. Getting back to head is the only sign that every node has been seen.' },
    ],
    quiz: [
      { q: 'Why does cdll delete need no if (p->prev != NULL) test?', options: ['It does need one', 'In a ring every node has a node before it', 'prev is never used', 'free() handles it'], answer: 1, why: 'The first node\'s prev is the last node, so p->prev always exists.' },
      { q: 'What is the special case left in this code?', options: ['Deleting the tail', 'A ring of one node', 'Deleting the second node', 'There is none'], answer: 1, why: 'When p->next == p, removing p leaves nothing, so head becomes NULL.' },
      { q: 'Why must head move when the head node is deleted?', options: ['To keep the ring sorted', 'Otherwise head would point at freed memory', 'To make it faster', 'It does not have to'], answer: 1, why: 'head must name a node that still exists.' },
      { q: 'How many pointers are repaired when a node is removed from a ring of 4?', options: ['One', 'Two', 'Three', 'Four'], answer: 1, why: 'The previous node\'s next and the following node\'s prev.' },
    ],
    compareWith: 'dll-delete',
  });
})(SEE);
