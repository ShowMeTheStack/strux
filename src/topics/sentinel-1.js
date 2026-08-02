// Lists with a sentinel: a dummy node at the front that is never removed. Every real node then has a
// node before it, so inserting and deleting at the front, in the middle and at the end are one case.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, D = X.DListKit, K_W = X.ListKit.NODE_W;

  const HEAD = `#include <stdio.h>
#include <stdlib.h>

/* one node: a value and the next node (NULL at the end) */
struct node {
    int data;
    struct node *next;
};

/* a new node on the heap, linked to nothing yet */
struct node *new_node(int value)
{
    struct node *n = malloc(sizeof *n);
    n->data = value;
    n->next = NULL;
    return n;
}

/* main uses this to set up the list you chose: first the dummy node, whose data is
   never used, then the values in order after it */
struct node *build(const int *values, int count)
{
    struct node *head = new_node(0);
    struct node *tail = head;
    int i;
    for (i = 0; i < count; i++) {
        tail->next = new_node(values[i]);
        tail = tail->next;
    }
    return head;
}`;

  const arrayInit = (vals) => (vals.length ? '{ ' + vals.join(', ') + ' }' : '{ 0 }');
  const sMain = (vals, call) => `int main(void)
{
    int values[] = ${arrayInit(vals)};
    struct node *head = build(values, ${vals.length});
    ${call}
    return 0;
}`;

  X.family({
    id: 'sentinel', order: 5, group: 'Linked lists', title: 'Lists with a sentinel',
    blurb: 'A dummy node sits in front of the real ones and is never removed. head never changes, and the first node stops being a special case.',
    head: HEAD,
  });

  const HEADBOX = { head: { x: -130, y: 5, side: 'left' } };
  // the cases one piece of code covers, with the one this run takes picked out
  const cases = (key, rows, which, y) => {
    const items = [{ key: key + 'T', kind: 'text', x: -130, y, text: 'One piece of code, every case', cls: 'title' }];
    rows.forEach((r, i) => items.push({ key: key + i, kind: 'text', x: -130, y: y + 28 + i * 26, text: (i === which ? '▶  ' : '    ') + r, cls: 'ck ' + (i === which ? 'hot' : 'check-todo') }));
    return items;
  };
  const realRead = (d, head) => {
    const by = D.byAddr(d);
    const h = by.get(head);
    return h && h.links.next ? D.read(d, h.links.next, 'next', ' → ') : 'empty (only the dummy)';
  };

  // ---- sorted insert -------------------------------------------------------------------------------------
  X.topic({
    id: 'sentinel-insert', family: 'sentinel', order: 10, title: 'Insert in order',
    blurb: 'prev starts on the dummy and looks one node ahead. Inserting before the first real node is just inserting after the dummy.',
    code: `/* insert value so the list stays in increasing order */
void insert_sorted(struct node *head, int value)
{
    struct node *prev = head;           /*@ start */
    struct node *n;
    while (prev->next != NULL && prev->next->data < value)   /*@ compare */
        prev = prev->next;              /*@ follow */
    n = new_node(value);                /*@ new */
    n->next = prev->next;               /*@ link */
    prev->next = n;                     /*@ attach */
}`,
    animate: ['insert_sorted'], quiet: ['new_node'],
    inputs: [
      { id: 'values', kind: 'ints', label: 'The list (in order)', def: [10, 20, 30, 40], min: 0, max: 7, sorted: true },
      { id: 'value', kind: 'int', label: 'Insert', def: 25, lo: -999, hi: 999 },
    ],
    presets: [
      { label: 'In the middle', values: { values: [10, 20, 30, 40], value: 25 } },
      { label: 'Smaller than all', values: { values: [10, 20, 30, 40], value: 5 } },
      { label: 'Empty list', values: { values: [], value: 7 } },
      { label: 'Larger than all', values: { values: [10, 20, 30], value: 99 } },
    ],
    counters: ['compares', 'follows', 'allocs'],
    main: (inp) => sMain(inp.values, 'insert_sorted(head, ' + inp.value + ');'),
    capture: D.capture({ roots: ['head'], cursors: ['prev', 'n'], links: ['next'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const head = d.roots.head;
      const { prev, n } = d.cursors;
      const by = D.byAddr(d);
      const ahead = prev && by.get(prev) ? by.get(prev).links.next : 0;
      const place = (x, pos) => (x.addr === n && prev && pos.has(prev) && !pos.has(x.addr) ? { x: pos.get(prev).x + 82, y: -120 } : null);
      const pic = D.row(ctx, d, {
        start: head, links: ['next'], roots: HEADBOX, cursors: ['prev'], sentinel: head, place,
        nodeCls: (x) => (x.addr === n || (tag === 'after' && !D.original(ctx).has(x.addr)) ? 'part-b' : tag === 'compare' && x.addr === ahead && ahead !== n ? 'focus' : ''),
      });
      const items = pic.items;
      if (n && pic.pos.has(n)) items.push({ key: 'cn', kind: 'cursor', at: 'n' + n, side: 'above', text: 'n', cls: 'c-green' });
      // the look-ahead: prev stands still and peeks at the node after it
      if (tag === 'compare' && prev && pic.pos.has(prev)) {
        const at = pic.pos.get(prev);
        const v = ahead ? by.get(ahead).data : null;
        const txt = ahead ? 'prev->next->data: ' + v + (v < inp.value ? ' < ' + inp.value + ', go on' : ' ≥ ' + inp.value + ', stop') : 'prev->next is NULL, stop';
        items.push({ key: 'peek', kind: 'text', x: at.x + K_W / 2, y: -26, text: txt, cls: ahead && v < inp.value ? 'lnote' : 'hot', anchor: 'start' });
      }
      const vals = inp.values;
      const which = !vals.length ? 0 : inp.value <= vals[0] ? 1 : inp.value > vals[vals.length - 1] ? 3 : 2;
      items.push(...cases('cs', ['empty list: after the dummy', 'smallest: after the dummy', 'in the middle: after a real node', 'largest: after the last node'], which, 170));
      const nm = (a) => (a === head ? 'the dummy' : D.name(d, a));
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert_sorted(head, ' + inp.value + '): head points at the dummy node, which is never removed and holds no real value. So head will not change, and the function returns nothing.'; break;
        case 'start': say = 'prev starts on the dummy. The new node will go after prev, so even "before the first real node" is "after some node".'; break;
        case 'compare': say = !ahead ? 'prev->next is NULL: prev is the last node, so ' + inp.value + ' goes at the end.' : by.get(ahead).data < inp.value ? 'Look one ahead: ' + by.get(ahead).data + ' < ' + inp.value + ', so ' + inp.value + ' belongs further on.' : 'Look one ahead: ' + by.get(ahead).data + ' is not less than ' + inp.value + ', so ' + inp.value + ' goes between ' + nm(prev) + ' and ' + by.get(ahead).data + '.'; break;
        case 'follow': say = 'prev = prev->next: prev steps on to ' + nm(prev) + '.'; break;
        case 'new': say = 'new_node(' + inp.value + ') makes the node, waiting above the gap after ' + nm(prev) + '.'; break;
        case 'link': say = 'n->next = prev->next: the new node points at ' + (by.get(n).links.next ? D.name(d, by.get(n).links.next) : 'NULL, because it will be last') + '.'; break;
        case 'attach': say = 'prev->next = n: ' + nm(prev) + ' now points at ' + inp.value + '. ' + (prev === head ? 'This wrote into the dummy, not into head: head itself is untouched.' : 'The same two lines as for any other position.'); break;
        case 'after': say = 'The real nodes now read ' + realRead(d, head) + '. Without the dummy, a new smallest value or an empty list would need an extra if and a change to head.'; break;
      }
      return { items, say, slow: tag === 'attach' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'start' && ts.some((x) => x.tag === 'new'), once: true, ask: (t, ts, i, ctx) => 'Where will ' + ctx.input.value + ' go? Click the node it will be linked after (the dummy counts).', answer: (ts) => 'n' + ts.find((x) => x.tag === 'new').data.cursors.prev, explain: () => 'prev stops on the last node whose successor is not smaller than the new value, or on the dummy if there is none.' },
      { at: (t, i, ts) => t.tag === 'link' && ts[i + 1] && ts[i + 1].tag === 'attach', once: true, ask: 'prev->next = n is next. Does head change?', options: () => ['Yes', 'No'], answer: () => 'No', pick: 'option', explain: () => 'head points at the dummy, and the dummy never moves. Only a next field is written.' },
    ],
    quiz: [
      { q: 'What does the dummy node hold?', options: ['The smallest value', 'Nothing that is ever used', 'The list length', 'A copy of the first value'], answer: 1, why: 'Its data is never read; it exists only so every real node has a predecessor.' },
      { q: 'Why does insert_sorted not return a new head?', options: ['It forgets to', 'head points at the dummy, which never changes', 'It uses a global', 'It returns it through value'], answer: 1, why: 'All insertions write into some node\'s next field, the dummy\'s included.' },
      { q: 'Inserting into an empty list here writes into...', options: ['head', 'the dummy\'s next', 'n->next only', 'Nothing'], answer: 1, why: 'prev stays on the dummy, so prev->next = n is dummy->next = n.' },
      { q: 'Why does the loop look at prev->next->data rather than prev->data?', options: ['It is faster', 'The new node goes after prev, so prev must stop one node early', 'prev->data is the dummy', 'To skip the last node'], answer: 1, why: 'A singly linked list cannot step back, so prev peeks ahead and stops on the node before the gap.' },
      { q: 'What does the sentinel cost?', options: ['Nothing', 'One extra node of memory', 'O(n) extra memory', 'Slower searches'], answer: 1, why: 'One node that holds no data, in return for no special cases.' },
    ],
  });
  // ---- delete a key --------------------------------------------------------------------------------------
  X.topic({
    id: 'sentinel-delete', family: 'sentinel', order: 20, title: 'Delete a key',
    blurb: 'The same three lines remove the first real node, a middle one or the last. There is no "if it is the head" branch, because the head is the dummy.',
    code: `/* remove the first node holding key, if there is one */
void delete_key(struct node *head, int key)
{
    struct node *prev = head;           /*@ start */
    struct node *victim;
    while (prev->next != NULL && prev->next->data != key)   /*@ compare */
        prev = prev->next;              /*@ follow */
    if (prev->next == NULL)             /*@ test-found */
        return;                         /*@ missing */
    victim = prev->next;                /*@ grab */
    prev->next = victim->next;          /*@ bypass */
    free(victim);                       /*@ free */
}`,
    animate: ['delete_key'],
    inputs: [
      { id: 'values', kind: 'ints', label: 'The list', def: [10, 20, 30, 40], min: 0, max: 7 },
      { id: 'key', kind: 'int', label: 'Delete', def: 10, lo: -999, hi: 999 },
    ],
    presets: [
      { label: 'The first real node', values: { values: [10, 20, 30, 40], key: 10 } },
      { label: 'In the middle', values: { values: [10, 20, 30, 40], key: 30 } },
      { label: 'The only node', values: { values: [10], key: 10 } },
      { label: 'Not there (or empty)', values: { values: [], key: 10 } },
    ],
    counters: ['compares', 'follows', 'frees'],
    main: (inp) => sMain(inp.values, 'delete_key(head, ' + inp.key + ');'),
    capture: D.capture({ roots: ['head'], cursors: ['prev', 'victim'], links: ['next'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const head = d.roots.head;
      const { prev, victim } = d.cursors;
      const by = D.byAddr(d);
      const ahead = prev && by.get(prev) ? by.get(prev).links.next : 0;
      const pic = D.row(ctx, d, {
        start: head, links: ['next'], roots: HEADBOX, cursors: ['prev', 'victim'], sentinel: head, fixed: tag !== 'after',
        nodeCls: (x) => (x.addr === victim && !x.freed ? 'doomed' : tag === 'compare' && x.addr === ahead ? 'focus' : ''),
        arrowCls: (x) => (tag === 'bypass' && x.addr === prev ? 'hot' : ''),
      });
      const items = pic.items;
      if (tag === 'compare' && prev && pic.pos.has(prev)) {
        const at = pic.pos.get(prev);
        const v = ahead ? by.get(ahead).data : null;
        const txt = ahead ? 'prev->next->data: ' + v + (v === inp.key ? ' = ' + inp.key + ', stop' : ' ≠ ' + inp.key + ', go on') : 'prev->next is NULL, stop';
        items.push({ key: 'peek', kind: 'text', x: at.x + K_W / 2, y: -26, text: txt, cls: ahead && v !== inp.key ? 'lnote' : 'hot', anchor: 'start' });
      }
      const vals = inp.values;
      const idx = vals.indexOf(inp.key);
      const which = idx < 0 ? 3 : idx === 0 ? 0 : idx === vals.length - 1 ? 2 : 1;
      items.push(...cases('cs', ['first real node: prev is the dummy', 'in the middle: prev is a real node', 'last node: prev->next becomes NULL', 'not there: prev reaches the end'], which, 210));
      items.push({ key: 'sllnote', kind: 'text', x: -130, y: 350, text: 'singly linked without a dummy: if (head->data == key) { ... head = head->next; }', cls: 'lnote' });
      const nm = (a) => (a === head ? 'the dummy' : D.name(d, a));
      let say = '';
      switch (tag) {
        case 'enter': say = 'delete_key(head, ' + inp.key + '): the list starts with the dummy node, so even the first real node has a node before it whose next can be changed.'; break;
        case 'start': say = 'prev starts on the dummy. prev never becomes NULL: it always stands on a node and looks at the one after it.'; break;
        case 'compare': say = !ahead ? 'prev->next is NULL: there is no node left to look at.' : by.get(ahead).data === inp.key ? 'Look one ahead: ' + by.get(ahead).data + ' is ' + inp.key + '. prev stops on ' + nm(prev) + ', the node whose next must change.' : 'Look one ahead: ' + by.get(ahead).data + ' is not ' + inp.key + '.'; break;
        case 'follow': say = 'prev = prev->next: prev steps on to ' + nm(prev) + '.'; break;
        case 'test-found': say = ahead ? 'prev->next is not NULL, so it is the node to delete.' : inp.key + ' was not found.'; break;
        case 'missing': say = 'Nothing to delete. ' + (vals.length ? '' : 'The list was empty, and this needed no extra test: prev->next of the dummy was simply NULL.'); break;
        case 'grab': say = 'victim = prev->next: the node holding ' + inp.key + '.'; break;
        case 'bypass': say = 'prev->next = victim->next: ' + nm(prev) + ' now points at ' + (by.get(prev).links.next ? D.name(d, by.get(prev).links.next) : 'NULL') + '. ' + (prev === head ? 'This is the first real node going, and it was done by writing into the dummy: head did not change.' : 'The same line that removes the first real node.'); break;
        case 'free': say = 'free(victim): the node goes back to the heap.'; break;
        case 'after': say = 'The real nodes now read ' + realRead(d, head) + '. One code path for every case; compare the singly linked version, which needs a separate branch for the first node.'; break;
      }
      return { items, say, slow: tag === 'bypass' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'start' && ts.some((x) => x.tag === 'grab'), once: true, ask: 'Where will prev stop? Click the node whose next will change (the dummy counts).', answer: (ts) => 'n' + ts.find((x) => x.tag === 'grab').data.cursors.prev, explain: () => 'On the node just before the one holding the key, which for the first real node is the dummy.' },
      { at: (t, i, ts) => t.tag === 'grab' && ts[i + 1] && ts[i + 1].tag === 'bypass', once: true, ask: 'Deleting this node: does head need to change?', options: () => ['Yes', 'No'], answer: () => 'No', pick: 'option', explain: () => 'head points at the dummy, which is never deleted.' },
    ],
    quiz: [
      { q: 'Why can prev never be NULL in sentinel delete?', options: ['It is checked first', 'It starts on the dummy and only moves to a node that exists', 'free() sets it', 'It can be'], answer: 1, why: 'prev moves to prev->next only after checking that prev->next is not NULL.' },
      { q: 'Deleting the first real node changes which pointer?', options: ['head', 'The dummy\'s next', 'The last node\'s next', 'None'], answer: 1, why: 'The dummy is the first real node\'s predecessor.' },
      { q: 'What does the singly linked version without a dummy need that this does not?', options: ['A loop', 'A separate case when the head holds the key', 'A call to free', 'A prev pointer'], answer: 1, why: 'Without a predecessor for the first node, head itself must be moved.' },
      { q: 'What happens with an empty list?', options: ['A crash', 'dummy->next is NULL, so the loop ends and nothing is deleted', 'The dummy is deleted', 'head becomes NULL'], answer: 1, why: 'An empty list is just the dummy; the same tests handle it.' },
    ],
    compareWith: 'sll-delete-key',
  });
})(SEE);
