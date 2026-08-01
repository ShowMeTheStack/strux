// Circular singly linked lists, kept by a tail pointer: insert at the front, insert at the end, delete a
// key, and a full lap with do-while. Drawn as a ring, so the link from the last node back to the first is
// as plain as any other.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, D = X.DListKit;

  const HEAD = `#include <stdio.h>
#include <stdlib.h>

/* one node: a value and the next node; the last node's next is the first node */
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

/* main uses this to set up the list you chose; it returns the tail (the last node),
   whose next is the first node */
struct node *build(const int *values, int count)
{
    struct node *tail = NULL;
    int i;
    for (i = 0; i < count; i++) {
        struct node *n = new_node(values[i]);
        if (tail == NULL)
            n->next = n;
        else {
            n->next = tail->next;
            tail->next = n;
        }
        tail = n;
    }
    return tail;
}`;

  const arrayInit = (vals) => (vals.length ? '{ ' + vals.join(', ') + ' }' : '{ 0 }');
  const cMain = (vals, call) => `int main(void)
{
    int values[] = ${arrayInit(vals)};
    struct node *tail = build(values, ${vals.length});
    ${call}
    return 0;
}`;

  X.family({
    id: 'csll', order: 3, group: 'Linked lists', title: 'Circular singly linked lists',
    blurb: 'The last node points back to the first, and the list is held by its tail: one pointer that reaches both ends in a single step.',
    head: HEAD,
  });

  const values = { id: 'values', kind: 'ints', label: 'The list', def: [10, 20, 30, 40], min: 0, max: 8 };
  const byOf = (d) => D.byAddr(d);
  const firstOf = (d) => { const t = d.roots.tail; const n = t && byOf(d).get(t); return n ? n.links.next : 0; };
  const readRing = (d, tail) => {
    const by = byOf(d);
    if (!tail || !by.has(tail)) return 'empty';
    const out = [];
    let p = by.get(tail).links.next, k = 0;
    while (p && by.has(p) && k++ < 20) { out.push(by.get(p).data); if (p === tail) break; p = by.get(p).links.next; }
    return out.join(' → ') + ' → (back to ' + out[0] + ')';
  };
  const legend = (R) => [{ key: 'lg', kind: 'text', x: 0, y: R + 92, text: 'first node = tail->next', cls: 'legend-next', anchor: 'middle' }];

  // the two insertions share one picture: a ring, tail in the middle, the first node marked
  function insertScene(ctx, end) {
    const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
    const n = d.cursors.n;
    const tail = d.roots.tail;
    const by = byOf(d);
    const first = firstOf(d);
    const start = first || n;
    const pic = D.ring(ctx, d, {
      start, roots: ['tail'], cursors: ['n'],
      marks: [{ key: 'first', at: first, text: 'first', cls: 'c-amber' }],
      nodeCls: (x) => (x.addr === n || (tag === 'after' && !D.original(ctx).has(x.addr)) ? 'part-b' : ''),
    });
    const items = pic.items.concat(legend(pic.R));
    items.push({ key: 'walk', kind: 'text', x: 0, y: -pic.R - 120, text: 'nodes visited to find the place: 0', cls: 'lnote', anchor: 'middle' });
    const nm = (a) => D.name(d, a);
    const old = ctx.ticks[0].data;
    const oldFirst = firstOf(old), oldTail = old.roots.tail;
    let say = '';
    switch (tag) {
      case 'enter': say = (end ? 'insert_end' : 'insert_front') + '(tail, ' + inp.value + '): ' + (oldTail ? 'the new node goes between the tail ' + nm(oldTail) + ' and the first node ' + nm(oldFirst) + '. Both are one step from tail, so no walking is needed.' : 'the list is empty, so the new node will be the whole ring.'); break;
      case 'new': say = 'new_node(' + inp.value + ') makes the node. It waits outside the ring, in the gap between the last node and the first.'; break;
      case 'test-empty': say = tail ? 'tail is not NULL: there is a ring to join.' : 'tail is NULL: the list is empty.'; break;
      case 'self': say = 'n->next = n: a ring of one. The only node is its own next, so it is both first and last.'; break;
      case 'return-new': say = 'Return n: it becomes the tail. In a one-node ring, tail->next is the node itself.'; break;
      case 'link': say = 'n->next = tail->next: the new node points at the first node, ' + nm(by.get(n).links.next) + '. The ring is still closed through the old link, so nothing is lost.'; break;
      case 'close': say = 'tail->next = n: ' + nm(tail) + ' now points at ' + inp.value + ', and the ring has grown by one. ' + (end ? 'As far as the links go, the new node sits between the last and the first.' : 'Since the first node is tail->next, ' + inp.value + ' is now first.'); break;
      case 'return': say = end ? 'Return n: the new node becomes the tail. That one change of which node tail points at is the whole difference between inserting at the end and at the front.' : 'Return tail, unchanged: the new node is first because tail->next points at it.'; break;
      case 'after': say = 'tail = ' + (end ? 'insert_end' : 'insert_front') + '(tail, ' + inp.value + '). Read from tail->next: ' + readRing(d, d.roots.tail) + '. No node was visited, so this is O(1).'; break;
    }
    return { items, say, slow: tag === 'close' || (end && tag === 'after') };
  }
  const insertCode = (end) => `/* put value in a new node at the ${end ? 'end' : 'front'}; returns the tail */
struct node *${end ? 'insert_end' : 'insert_front'}(struct node *tail, int value)
{
    struct node *n = new_node(value);   /*@ new */
    if (tail == NULL) {                 /*@ test-empty */
        n->next = n;                    /*@ self */
        return n;                       /*@ return-new */
    }
    n->next = tail->next;               /*@ link */
    tail->next = n;                     /*@ close */
    return ${end ? 'n;   ' : 'tail;'}                       /*@ return */
}`;
  const insertPresets = (v) => [
    { label: 'Four nodes', values: { values: [10, 20, 30, 40], value: v } },
    { label: 'Empty list', values: { values: [], value: v } },
    { label: 'One node', values: { values: [10], value: v } },
    { label: 'Seven nodes', values: { values: [1, 2, 3, 4, 5, 6, 7], value: v } },
  ];
  const insertQuiz = [
    { q: 'Why does a circular list keep a tail pointer rather than a head pointer?', options: ['It uses less memory', 'tail reaches the last node directly and the first node in one step, tail->next', 'Head pointers are not allowed', 'It makes searching faster'], answer: 1, why: 'With head only, reaching the last node means walking the whole ring.' },
    { q: 'What is the only difference between insert_front and insert_end here?', options: ['Where the node is linked', 'Whether tail moves to the new node', 'insert_end walks the list', 'insert_front allocates two nodes'], answer: 1, why: 'Both link the node between tail and tail->next; insert_end then makes it the tail.' },
    { q: 'In a ring of one node, what is n->next?', options: ['NULL', 'n itself', 'tail->next->next', 'Undefined'], answer: 1, why: 'The only node is both first and last, so it points to itself.' },
    { q: 'Which order is safe?', options: ['tail->next = n, then n->next = tail->next', 'n->next = tail->next, then tail->next = n', 'Either', 'Neither'], answer: 1, why: 'Doing tail->next = n first loses the old first node: n->next = tail->next would then make n point at itself.' },
  ];
  const valueIn = (def) => ({ id: 'value', kind: 'int', label: 'Insert', def, lo: -999, hi: 999 });

  X.topic({
    id: 'csll-insert-front', family: 'csll', order: 10, title: 'Insert at the front',
    blurb: 'The new node slips in after the tail. It is first because tail->next now points at it; tail does not move.',
    code: insertCode(false),
    animate: ['insert_front'], quiet: ['new_node'],
    inputs: [values, valueIn(5)],
    presets: insertPresets(5),
    counters: ['allocs', 'writes'],
    main: (inp) => cMain(inp.values, 'tail = insert_front(tail, ' + inp.value + ');'),
    capture: D.capture({ roots: ['tail'], cursors: ['n'], links: ['next'] }),
    scene: (ctx) => insertScene(ctx, false),
    predict: [
      { at: (t) => t.tag === 'test-empty' && t.data.roots.tail, once: true, ask: 'n->next = tail->next is next. Click the node the new node will point to.', answer: (ts, i) => 'n' + firstOf(ts[i].data), explain: () => 'tail->next is the first node, and the new node goes in front of it.' },
      { at: (t) => t.tag === 'close', once: true, ask: 'Does tail have to move for the new node to be first?', options: () => ['Yes', 'No'], answer: () => 'No', pick: 'option', explain: () => 'The first node is whatever tail->next points at, and that is now the new node.' },
    ],
    quiz: insertQuiz,
    compareWith: 'csll-insert-end',
  });

  X.topic({
    id: 'csll-insert-end', family: 'csll', order: 11, title: 'Insert at the end',
    blurb: 'The same splice after the tail, and then tail moves on to the new node. No walk to the end: tail is already there.',
    code: insertCode(true),
    animate: ['insert_end'], quiet: ['new_node'],
    inputs: [values, valueIn(50)],
    presets: insertPresets(50),
    counters: ['allocs', 'writes'],
    main: (inp) => cMain(inp.values, 'tail = insert_end(tail, ' + inp.value + ');'),
    capture: D.capture({ roots: ['tail'], cursors: ['n'], links: ['next'] }),
    scene: (ctx) => insertScene(ctx, true),
    predict: [
      { at: (t) => t.tag === 'enter' && t.data.roots.tail, once: true, ask: 'How many nodes must insert_end visit to find the end of the ring?', options: () => ['None', 'One', 'All of them'], answer: () => 'None', pick: 'option', explain: () => 'tail already points at the last node.' },
      { at: (t) => t.tag === 'close', once: true, ask: 'After return n, which node will tail point at? Click it.', answer: (ts, i) => 'n' + ts[i].data.cursors.n, explain: () => 'insert_end returns n, and main stores it in tail: the new node is the last node.' },
    ],
    quiz: insertQuiz.concat([{ q: 'Inserting at the end of a circular list held by tail costs...', options: ['O(n)', 'O(1)', 'O(log n)', 'O(n²)'], answer: 1, why: 'Two links and one assignment to tail, whatever the length.' }]),
    compareWith: 'csll-insert-front',
  });

  // ---- delete a key --------------------------------------------------------------------------------------
  X.topic({
    id: 'csll-delete', family: 'csll', order: 20, title: 'Delete a key',
    blurb: 'prev starts at the tail, so even the first node has a node before it. Unlink, and move tail back if the tail itself went.',
    code: `/* remove the first node holding key; returns the tail */
struct node *delete_key(struct node *tail, int key)
{
    struct node *prev, *curr;
    if (tail == NULL)                   /*@ test-empty */
        return NULL;                    /*@ empty */
    prev = tail;                        /*@ init-prev */
    curr = tail->next;                  /*@ init-curr */
    while (curr->data != key) {         /*@ compare */
        if (curr == tail)               /*@ test-lap */
            return tail;                /*@ missing */
        prev = curr;                    /*@ move-prev */
        curr = curr->next;              /*@ move-curr */
    }
    if (curr == prev)                   /*@ test-only */
        tail = NULL;                    /*@ only */
    else {
        prev->next = curr->next;        /*@ bypass */
        if (curr == tail)               /*@ test-tail */
            tail = prev;                /*@ move-tail */
    }
    free(curr);                         /*@ free */
    return tail;                        /*@ return */
}`,
    animate: ['delete_key'],
    inputs: [values, { id: 'key', kind: 'int', label: 'Delete', def: 30, lo: -999, hi: 999 }],
    presets: [
      { label: 'In the middle', values: { values: [10, 20, 30, 40], key: 30 } },
      { label: 'The first node', values: { values: [10, 20, 30, 40], key: 10 } },
      { label: 'The tail', values: { values: [10, 20, 30, 40], key: 40 } },
      { label: 'The only node', values: { values: [10], key: 10 } },
      { label: 'Not there', values: { values: [10, 20, 30], key: 99 } },
    ],
    counters: ['compares', 'follows', 'frees'],
    main: (inp) => cMain(inp.values, 'tail = delete_key(tail, ' + inp.key + ');'),
    capture: D.capture({ roots: ['tail'], cursors: ['prev', 'curr'], links: ['next'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, inp = ctx.input;
      const { prev, curr } = d.cursors;
      const by = byOf(d);
      const memo = ctx.memo;
      memo.seen = memo.seen || new Set();
      if (tag === 'compare' && curr) memo.seen.add(curr);
      const hit = curr && by.get(curr) && by.get(curr).data === inp.key && !['init-curr', 'move-curr'].includes(tag) && tag !== 'enter';
      if (hit && tag === 'compare') memo.victim = curr;
      const vic = memo.victim;
      const live = (a) => a && by.has(a) && !by.get(a).freed;
      const start = live(d.roots.tail) && live(firstOf(d)) ? firstOf(d) : live(prev) ? prev : 0;
      const pic = D.ring(ctx, d, {
        start, roots: ['tail'], cursors: ['prev', 'curr'], keep: tag !== 'after' ? vic : 0,
        nodeCls: (x) => (x.addr === vic && !x.freed ? 'doomed' : tag === 'compare' && x.addr === curr ? 'focus' : memo.seen.has(x.addr) && !vic ? 'ghost' : ''),
        arrowCls: (x) => (vic && x.addr === prev && tag === 'bypass' ? 'hot' : ''),
      });
      const items = pic.items;
      if (tag === 'compare' && curr && pic.pos.has(curr)) {
        const at = pic.pos.get(curr);
        const ok = by.get(curr).data === inp.key;
        items.push({ key: 'verdict', kind: 'text', x: 0, y: pic.R + 70, text: ok ? '✓ ' + by.get(curr).data + ' = ' + inp.key : '✗ ' + by.get(curr).data + ' ≠ ' + inp.key, cls: ok ? 'good' : 'bad', anchor: 'middle' });
      }
      const nm = (a) => D.name(d, a);
      const tail0 = ctx.ticks[0].data.roots.tail;
      let say = '';
      switch (tag) {
        case 'enter': say = 'delete_key(tail, ' + inp.key + '): find ' + inp.key + ' and close the ring over it. Its predecessor\'s next must change, so the walk keeps prev one step behind curr.'; break;
        case 'test-empty': say = d.roots.tail ? 'The ring is not empty.' : 'tail is NULL: nothing to delete.'; break;
        case 'empty': say = 'Return NULL: the list stays empty.'; break;
        case 'init-prev': say = 'prev = tail: the walk starts one node before the first. In a ring the first node has a predecessor too, the tail, so it needs no special case.'; break;
        case 'init-curr': say = 'curr = tail->next: the first node, ' + nm(curr) + '.'; break;
        case 'compare': say = by.get(curr).data === inp.key ? nm(curr) + ' is ' + inp.key + ': found. prev is at ' + nm(prev) + ', the node whose next must change.' : nm(curr) + ' is not ' + inp.key + '.'; break;
        case 'test-lap': say = curr === d.roots.tail ? 'curr is the tail: the whole ring has been checked.' : 'curr is not the tail yet, so there are more nodes to check.'; break;
        case 'missing': say = inp.key + ' is not in the ring. Return tail; nothing changed. Testing curr == tail is what stops the walk going round for ever.'; break;
        case 'move-prev': say = 'prev = curr: prev moves to ' + nm(prev) + '.'; break;
        case 'move-curr': say = 'curr = curr->next: curr moves to ' + nm(curr) + '.'; break;
        case 'test-only': say = curr === prev ? 'curr == prev: the node is its own predecessor, so it is the only node in the ring.' : 'curr and prev are different nodes: there is a ring left to close.'; break;
        case 'only': say = 'tail = NULL: removing the only node leaves an empty list.'; break;
        case 'bypass': say = 'prev->next = curr->next: ' + nm(prev) + ' now points at ' + nm(by.get(prev).links.next) + ', and the ring closes over ' + inp.key + '.'; break;
        case 'test-tail': say = curr === d.roots.tail ? inp.key + ' is the tail: tail must not be left pointing at a node about to be freed.' : inp.key + ' is not the tail, so tail stays.'; break;
        case 'move-tail': say = 'tail = prev: ' + nm(prev) + ' is the new last node. Its next already points at the first node.'; break;
        case 'free': say = 'free(curr): the node\'s memory goes back to the heap.'; break;
        case 'return': say = 'Return tail' + (d.roots.tail !== tail0 ? ', which has changed.' : '.'); break;
        case 'after': say = 'tail = delete_key(tail, ' + inp.key + '). The ring is now ' + readRing(d, d.roots.tail) + '.'; break;
      }
      return { items, say, slow: tag === 'bypass' };
    },
    predict: [
      { at: (t) => t.tag === 'init-prev' && t.data.roots.tail, once: true, ask: 'prev starts at the tail. Which node does curr start at? Click it.', answer: (ts, i) => 'n' + firstOf(ts[i].data), explain: () => 'curr = tail->next, the first node: prev is one step behind it, all the way round the ring.' },
      { at: (t) => t.tag === 'test-only' && t.data.cursors.curr !== t.data.cursors.prev, once: true, ask: 'prev->next = curr->next is next. Click the node prev will point to.', answer: (ts, i) => { const d = ts[i].data; return 'n' + byOf(d).get(d.cursors.curr).links.next; }, explain: () => 'The node after curr: the ring closes over the node being removed.' },
    ],
    quiz: [
      { q: 'Why does prev start at tail?', options: ['To delete the tail faster', 'The tail is the first node\'s predecessor, so the first node needs no special case', 'It is a mistake', 'To count the nodes'], answer: 1, why: 'In a ring every node has a predecessor; for the first node it is the tail.' },
      { q: 'What stops the search when the key is missing?', options: ['curr becoming NULL', 'curr reaching the tail', 'A counter', 'prev becoming NULL'], answer: 1, why: 'There is no NULL in a ring; reaching the tail means every node has been checked.' },
      { q: 'When must tail itself change?', options: ['Always', 'When the tail is deleted (or the only node)', 'When the first node is deleted', 'Never'], answer: 1, why: 'tail must point at the last remaining node, or be NULL.' },
      { q: 'How is a one-node ring recognised in this code?', options: ['tail == NULL', 'curr == prev', 'curr->next == NULL', 'key == 0'], answer: 1, why: 'Only in a one-node ring is a node its own predecessor.' },
    ],
  });

  // ---- traverse ------------------------------------------------------------------------------------------
  X.topic({
    id: 'csll-traverse', family: 'csll', order: 30, title: 'Traverse (do-while)',
    blurb: 'Start at the first node and go round until you are back at it. The test must come after the step, or the loop stops before it starts.',
    code: `/* print every value once, starting at the first node */
void print_all(struct node *tail)
{
    struct node *p;
    if (tail == NULL)                   /*@ test-empty */
        return;                         /*@ empty */
    p = tail->next;                     /*@ start */
    do {                                /*@ body */
        printf("%d ", p->data);         /*@ print */
        p = p->next;                    /*@ step */
    } while (p != tail->next);          /*@ test */
    printf("\\n");                       /*@ newline */
}`,
    animate: ['print_all'],
    inputs: [values],
    presets: [
      { label: 'Four nodes', values: { values: [10, 20, 30, 40] } },
      { label: 'One node', values: { values: [7] } },
      { label: 'Empty list', values: { values: [] } },
      { label: 'Eight nodes', values: { values: [3, 1, 4, 1, 5, 9, 2, 6] } },
    ],
    counters: ['follows'],
    main: (inp) => cMain(inp.values, 'print_all(tail);'),
    capture: D.capture({ roots: ['tail'], cursors: ['p'], links: ['next'] }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const p = d.cursors.p;
      const by = byOf(d);
      const memo = ctx.memo;
      memo.printed = memo.printed || [];
      memo.trail = memo.trail || new Set();
      if (tag === 'print') memo.printed.push(p);
      if (tag === 'step' && ctx.prev) memo.trail.add(ctx.prev.data.cursors.p);
      const first = firstOf(d);
      const total = d.nodes.length;
      const pic = D.ring(ctx, d, {
        start: first, roots: ['tail'], cursors: ['p'],
        marks: [{ key: 'first', at: first, text: 'start', cls: 'c-amber' }],
        nodeCls: (x) => (memo.printed.includes(x.addr) ? 'part-b' : ''),
        arrowCls: (x) => (memo.trail.has(x.addr) ? 'walked' : ''),
      });
      const items = pic.items;
      const R = pic.R;
      const vals = memo.printed.map((a) => by.get(a).data);
      const w = vals.length * 50;
      items.push(...D.tape('tape', vals, -Math.max(w, 100) / 2, R + 110, { title: 'printed', fresh: tag === 'print' }));
      if (total) items.push({ key: 'lap', kind: 'text', x: 0, y: -R - 110, text: 'visited ' + Math.min(memo.printed.length, total) + ' of ' + total, cls: 'lnote', anchor: 'middle' });
      // what a while loop would have done: tested first, while p is still on the first node
      if (tag === 'start' && total) items.push({ key: 'whilebox', kind: 'text', x: 0, y: -R - 88, text: 'while (p != tail->next) here would be false at once', cls: 'bad', anchor: 'middle' });
      const nm = (a) => D.name(d, a);
      let say = '';
      switch (tag) {
        case 'enter': say = 'print_all(tail): print every value once. There is no NULL anywhere in a ring, so the walk must stop when it gets back to where it began.'; break;
        case 'test-empty': say = d.roots.tail ? 'The ring is not empty.' : 'tail is NULL: there is nothing to print.'; break;
        case 'empty': say = 'Return: nothing printed.'; break;
        case 'start': say = 'p = tail->next: p starts on the first node, ' + nm(p) + '. The stopping test is "p is back at tail->next", which is already true. A while loop would test it now and print nothing; do-while runs the body first.'; break;
        case 'body': say = memo.printed.length ? 'Round the loop again, with p on ' + nm(p) + '.' : 'Into the body of the do-while: no test has been made yet.'; break;
        case 'print': say = 'Print ' + nm(p) + '.'; break;
        case 'step': say = 'p = p->next: on to ' + nm(p) + (p === first ? ', which is the first node again.' : '.'); break;
        case 'test': say = p === first ? 'p is back at tail->next: one full lap, so the loop stops.' : 'p is not back at the start yet: go round again.'; break;
        case 'newline': say = 'Output: ' + vals.join(' ') + '. Each node printed exactly once.'; break;
        case 'after': say = vals.length ? 'Printed ' + vals.join(' ') + ': ' + vals.length + ' value' + (vals.length === 1 ? '' : 's') + ', one lap.' : 'Nothing to print for an empty list.'; break;
      }
      return { items, say };
    },
    predict: [
      { at: (t) => t.tag === 'start', once: true, ask: 'Suppose this were while (p != tail->next) { ... } instead of do-while. How many values would it print?', options: (ts) => ['0', '1', String(ts[0].data.nodes.length)].filter((v, k, a) => a.indexOf(v) === k), answer: () => '0', pick: 'option', explain: () => 'p starts equal to tail->next, so the test fails before the body ever runs.' },
      { at: (t, i, ts) => t.tag === 'step' && t.data.cursors.p === firstOf(t.data) && ts[0].data.nodes.length > 1, once: true, ask: 'p is back on the first node. Will the loop run again?', options: () => ['Yes', 'No'], answer: () => 'No', pick: 'option', explain: () => 'The test p != tail->next is now false: one lap is done.' },
    ],
    quiz: [
      { q: 'Why does traversing a circular list use do-while?', options: ['It is faster', 'The stop condition (back at the start) is already true before the first step', 'C requires it', 'To skip the first node'], answer: 1, why: 'A while loop would test p != start when p == start and never run.' },
      { q: 'What would while (p != NULL) do on a circular list?', options: ['Print each value once', 'Never stop', 'Print nothing', 'Crash at once'], answer: 1, why: 'There is no NULL in a ring, so the condition is always true.' },
      { q: 'How else could a while loop be made to work?', options: ['It cannot', 'Print the first node before the loop and start p at its next', 'Start p at NULL', 'Test p == tail->next'], answer: 1, why: 'That runs the body once by hand, which is what do-while does.' },
      { q: 'For a one-node ring, how many times does the body run?', options: ['0', '1', '2', 'For ever'], answer: 1, why: 'It prints, steps to itself (the start), and the test then stops the loop.' },
    ],
  });
})(SEE);
