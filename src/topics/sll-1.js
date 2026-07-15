// Singly linked lists: the family, building and reversing.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, K = X.ListKit;

  const HEAD = `#include <stdio.h>
#include <stdlib.h>

/* one node: a value and the address of the next node (NULL at the end) */
struct node {
    int data;
    struct node *next;
};

/* a new node on the heap, holding value and pointing nowhere yet */
struct node *new_node(int value)
{
    struct node *n = malloc(sizeof *n);
    n->data = value;
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
        else
            tail->next = n;
        tail = n;
    }
    return head;
}`;

  /** C for main: build the chosen list, then the call (or calls) of the topic */
  const arrayInit = (vals) => (vals.length ? '{ ' + vals.join(', ') + ' }' : '{ 0 }');
  X.sllMain = (vals, call, extra) => `int main(void)
{
    int values[] = ${arrayInit(vals)};
    struct node *head = build(values, ${vals.length});
${extra ? extra + '\n' : ''}    ${call}
    return 0;
}`;

  X.family({
    id: 'sll', order: 1, group: 'Linked lists', title: 'Singly linked lists',
    blurb: 'Each node knows only the next one. Every operation is a matter of which arrow points where.',
    head: HEAD,
  });

  /** The standard capture for these topics */
  const cap = (cursors, roots) => (P) => K.capture(P, { type: 'head', roots: roots || ['head'], cursors, fields: ['data'], links: ['next'] });
  X.sllCapture = cap;
  const values = { id: 'values', kind: 'ints', label: 'The list', def: [10, 20, 30, 40], min: 0, max: 8 };
  X.sllValues = values;

  // ---- reverse, iteratively ----------------------------------------------------------------------------
  X.topic({
    id: 'sll-reverse', family: 'sll', order: 40, title: 'Reverse (iterative)',
    blurb: 'Three pointers walk the list and turn every arrow round, one node at a time.',
    code: `/* turn the list round and return its new first node */
struct node *reverse(struct node *head)
{
    struct node *prev = NULL;     /*@ init-prev */
    struct node *curr = head;     /*@ init-curr */
    struct node *next;
    while (curr != NULL) {        /*@ test */
        next = curr->next;        /*@ save */
        curr->next = prev;        /*@ flip */
        prev = curr;              /*@ move-prev */
        curr = next;              /*@ move-curr */
    }
    return prev;                  /*@ return */
}`,
    animate: ['reverse'],
    inputs: [values],
    presets: [{ label: 'Four nodes', values: { values: [10, 20, 30, 40] } }, { label: 'One node', values: { values: [7] } }, { label: 'Empty list', values: { values: [] } }, { label: 'Two nodes', values: { values: [1, 2] } }],
    main: (inp) => X.sllMain(inp.values, 'head = reverse(head);'),
    capture: cap(['prev', 'curr', 'next']),
    scene(ctx) {
      const d = ctx.tick.data;
      const tag = ctx.tick.tag;
      // the nodes stay where they started; only the arrows turn
      const done = new Set();
      if (d.cursors.prev) for (const a of K.chain(d, d.cursors.prev).order) done.add(a);
      const pic = K.picture(ctx, d, {
        mode: 'fixed', start: ctx.ticks[0].data.roots.head, roots: ['head'], cursors: ['prev', 'curr', 'next'],
        written: K.written(ctx, d),
        nodeCls: (n) => (done.has(n.addr) ? 'part-a' : ''),
        arrowCls: (n) => (done.has(n.addr) ? 'part-a' : ''),
      });
      const items = pic.items;
      if (d.cursors.prev !== undefined && done.size) items.push({ key: 'lbl-done', kind: 'text', x: 0, y: K.NODE_H + 92, text: 'already reversed: ' + done.size + ' node' + (done.size === 1 ? '' : 's'), cls: 'note part-a' });
      const nm = (a) => K.name(d, a);
      const c = d.cursors;
      let say = '';
      switch (tag) {
        case 'enter': say = d.roots.head ? 'reverse() is called with the list ' + K.chain(d, d.roots.head).order.map(nm).join(' → ') + '. Every arrow will have to point the other way.' : 'reverse() is called with an empty list: head is NULL.'; break;
        case 'init-prev': say = 'prev starts as NULL: it is where the first node\'s arrow will point once it has been turned round, because the first node becomes the last.'; break;
        case 'init-curr': say = 'curr starts at the first node, ' + nm(c.curr) + '. curr is the node whose arrow gets turned next.'; break;
        case 'test': say = c.curr ? 'curr is ' + nm(c.curr) + ', not NULL, so there is still an arrow to turn.' : 'curr is NULL: every arrow has been turned. prev is at the new first node.'; break;
        case 'save': say = 'Before turning curr\'s arrow, remember where it went: next = ' + nm(c.next) + '. Without this, the rest of the list would be lost.'; break;
        case 'flip': say = 'The key line: curr->next = prev. ' + nm(c.curr) + '\'s arrow swings round to ' + nm(c.prev) + (c.prev ? '' : ' (it is the new end of the list)') + '.'; break;
        case 'move-prev': say = 'prev moves up to ' + nm(c.prev) + ', which is now the first node of the reversed part.'; break;
        case 'move-curr': say = 'curr moves to ' + nm(c.curr) + ' (saved in next), the first node not yet turned round.'; break;
        case 'return': say = 'Done. prev, at ' + nm(c.prev) + ', is the new first node, and that is what reverse() returns.'; break;
        case 'after': say = 'Back in main, head = reverse(head): the list now reads ' + (d.roots.head ? K.chain(d, d.roots.head).order.map(nm).join(' → ') : 'nothing (it was empty)') + '. No node moved; only the arrows did.'; break;
        default: say = '';
      }
      return { items, say };
    },
    predict: [
      { at: (t) => t.tag === 'save' && t.data.cursors.prev, once: true, ask: 'curr->next = prev is next. Click the node curr\'s arrow will point to.', answer: (ts, i) => 'n' + ts[i].data.cursors.prev, explain: () => 'It points back to prev, the node turned round just before it.' },
      { at: (t, i, ts) => t.tag === 'move-curr' && ts[i + 1] && ts[i + 1].data.cursors.curr === 0, once: true, ask: 'The loop is about to test curr != NULL. Will it run again?', options: () => ['Yes', 'No'], answer: () => 'No', pick: 'option', explain: () => 'curr took the saved next, which was NULL: the old last node has been turned, so the loop ends.' },
    ],
    quiz: [
      { q: 'Why must next = curr->next come before curr->next = prev?', options: ['It does not matter', 'Otherwise the rest of the list is lost', 'It makes the loop faster', 'prev would be NULL'], answer: 1, why: 'After curr->next = prev, curr no longer leads to the rest of the list. next is the only copy of that address.' },
      { q: 'How many nodes does iterative reversal allocate?', options: ['One per node', 'One', 'None', 'Two'], answer: 2, why: 'It only changes the next fields of the nodes that are already there.' },
      { q: 'What does reverse() return for an empty list?', options: ['The old head', 'NULL', 'A new node', 'It crashes'], answer: 1, why: 'The loop never runs, and prev is still NULL.' },
    ],
  });
})(SEE);
