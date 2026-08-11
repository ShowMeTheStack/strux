// Linked queues: enqueue at the rear, dequeue at the front, two pointers kept in step.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, S = X.StackKit, K = X.ListKit;

  X.family({
    id: 'lqueue', order: 4, group: 'Stacks and queues', title: 'Linked queues',
    blurb: 'A linked list with a pointer at each end: items join at the rear and leave from the front, both in constant time.',
    head: `#include <stdio.h>
#include <stdlib.h>

struct node {
    int data;
    struct node *next;      /* the node that arrived after this one */
};

struct node *front = NULL;  /* the oldest item: the next to leave */
struct node *rear = NULL;   /* the newest item: the last to arrive */`,
  });

  const NW = 96, STEP = 136;
  const longest = (ops) => { let n = 0, mx = 0; for (const o of ops) { if (o.op === 'add') n++; else if (n) n--; mx = Math.max(mx, n); } return mx; };

  X.topic({
    id: 'queue-linked', family: 'lqueue', order: 10, title: 'Enqueue and dequeue',
    blurb: 'enqueue hangs a new node after rear; dequeue unhooks the node at front. When the last node leaves, rear has to be reset too, or it is left pointing at freed memory.',
    code: `/* add x at the rear of the queue */
void enqueue(int x)
{
    struct node *n = malloc(sizeof *n);   /*@ alloc */
    n->data = x;                          /*@ fill */
    n->next = NULL;                       /*@ terminate */
    if (rear == NULL)                     /*@ empty-test */
        front = n;                        /*@ first */
    else
        rear->next = n;                   /*@ attach */
    rear = n;                             /*@ new-rear */
}

/* take the front item out; returns -1 if the queue is empty */
int dequeue(void)
{
    struct node *old;
    int x;
    if (front == NULL)                    /*@ none-test */
        return -1;                        /*@ underflow */
    old = front;                          /*@ hold */
    x = old->data;                        /*@ take */
    front = old->next;                    /*@ advance */
    if (front == NULL)                    /*@ last-test */
        rear = NULL;                      /*@ reset-rear */
    free(old);                            /*@ free */
    return x;                             /*@ give */
}`,
    animate: ['enqueue', 'dequeue'],
    inputs: [S.opsInput('+10 +20 +30 - +40 - - - +50', 'Operations (+5 adds 5, - takes one)', 10)],
    check: (inp) => (longest(S.parse(inp.ops)) > 5 ? 'At most 5 items waiting at once, so the picture fits' : null),
    presets: [
      { label: 'Empty, then refill', values: { ops: '+10 +20 +30 - +40 - - - +50' } },
      { label: 'First in, first out', values: { ops: '+1 +2 +3 +4 - - - -' } },
      { label: 'One item in and out', values: { ops: '+7 - +8' } },
      { label: 'Dequeue an empty queue', values: { ops: '- +9 - -' } },
    ],
    counters: ['allocs', 'frees', 'writes'],
    main: (inp) => 'int main(void)\n{\n' + S.parse(inp.ops).map((o) => (o.op === 'add' ? '    enqueue(' + o.v + ');' : '    dequeue();')).join('\n') + '\n    return 0;\n}',
    capture: (P) => Object.assign(K.capture(P, { type: 'front', roots: ['front', 'rear'], cursors: ['n', 'old'], fields: ['data'], links: ['next'] }), { x: P.has('x', 0) && P.isSet('x', 0) ? P.val('x', 0) : null }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const ops = S.parse(ctx.input.ops);
      const k = S.opIndex(ctx);
      const op = ops[Math.min(k, ops.length - 1)];
      const m = ctx.memo;
      if (m.maxN === undefined) m.maxN = Math.max(1, longest(ops));
      m.out = m.out || [];
      m.res = m.res || [];
      if (m.seen !== ctx.i) {
        m.seen = ctx.i;
        if (tag === 'take') m.out.push({ v: d.x });
        if (tag === 'underflow') { m.out.push({ v: -1, bad: true }); m.res[k] = 'empty'; }
        if (tag === 'new-rear') m.res[k] = 'ok';
        if (tag === 'give') m.res[k] = String(m.out[m.out.length - 1].v);
      }
      const xv = d.x !== null ? d.x : op && op.op === 'add' ? op.v : m.out.length ? m.out[m.out.length - 1].v : 0;
      const c = d.cursors, r = d.roots;
      const chain = K.chain(d, r.front).order;
      const pos = new Map();
      chain.forEach((a, i) => pos.set(a, { x: i * STEP, y: 0 }));
      // off the list: the node leaving sits just left of the front door; a new node waits below its place
      for (const n of d.nodes) {
        if (pos.has(n.addr)) continue;
        if (n.addr === c.old) pos.set(n.addr, { x: -STEP, y: 0 });
        else pos.set(n.addr, { x: chain.length * STEP, y: 96 });
      }
      const span = m.maxN * STEP;
      const items = [S.extent(-STEP - 40, -230, span + STEP + 60, 420)];
      items.push(...S.script(ops, tag === 'after' ? k + 1 : k, { x0: Math.max(-STEP + 40, span / 2 - ops.length * 51 / 2), y0: -222, result: (j) => m.res[j], bad: (j) => m.res[j] === 'empty' }));
      // where the two pointer boxes sit: above the nodes they point at
      const at = (a, dx, dflt) => (a && pos.has(a) ? pos.get(a).x + dx : dflt);
      const rootPos = { front: { x: at(r.front, -22, -22), y: -110 }, rear: { x: r.rear && r.rear === c.old && !chain.includes(r.rear) ? -STEP - 30 : at(r.rear, 48, 110), y: -110 } };
      if (r.front && r.front === r.rear) { rootPos.front.x -= 14; rootPos.rear.x += 14; }
      const pic = K.picture(ctx, d, { pos, roots: ['front', 'rear'], rootPos, cursors: ['n', 'old'], nodeW: NW, written: K.written(ctx, d), hideNull: true, nodeCls: (n) => (n.addr === c.old ? 'focus' : n.addr === c.n && !chain.includes(n.addr) ? 'part-b' : '') });
      const items2 = pic.items;
      // the danger: front has moved off the last node, but rear still points at it
      const dangling = r.rear && !chain.includes(r.rear);
      for (const it of items2) if (it.key === 'rarear' && dangling) it.cls += ' bad';
      items.push(...items2);
      if (dangling) items.push({ key: 'dangT', kind: 'text', x: rootPos.rear.x, y: -138, text: 'rear still points here', cls: 'sk-label bad', anchor: 'start' });
      if (chain.length) items.push({ key: 'doorF', kind: 'text', x: NW / 2, y: 76, text: 'leaves here', cls: 'sk-label', anchor: 'middle' });
      if (chain.length) items.push({ key: 'doorR', kind: 'text', x: (chain.length - 1) * STEP + NW / 2, y: 76 + (chain.length === 1 ? 18 : 0), text: 'joins after here', cls: 'sk-label', anchor: 'middle' });
      if (!chain.length && !d.nodes.length) items.push({ key: 'emptyT', kind: 'text', x: span / 2 - STEP / 2, y: 26, text: 'empty: front == NULL and rear == NULL', cls: 'sk-label' + (tag === 'underflow' || tag === 'none-test' ? ' bad' : ''), anchor: 'middle' });
      // what dequeue() gave, in order, along the bottom
      items.push({ key: 'outT', kind: 'text', x: -STEP - 10, y: 175, text: 'out', cls: 'sk-title', anchor: 'start' });
      m.out.forEach((o, j) => {
        const leaving = j === m.out.length - 1 && (tag === 'take' || tag === 'advance' || tag === 'last-test' || tag === 'reset-rear');
        items.push({ key: 'out' + j, kind: 'token', x: leaving ? -STEP + NW / 2 : -STEP + 60 + j * 40, y: leaving ? 126 : 170, r: 16, text: String(o.v), cls: o.bad ? 'sk-bad' : 'c-teal', enter: 'fly', from: { x: NW / 2, y: 0 } });
      });
      const nm = (a) => K.name(d, a);
      const vals = chain.map(nm);
      const name = op && op.op === 'add' ? 'enqueue(' + op.v + ')' : 'dequeue()';
      let say = '';
      switch (tag) {
        case 'enter': say = name + ' is the first operation. front and rear are both NULL: the queue is empty.'; break;
        case 'alloc': say = name + ': malloc makes a new node. It waits at the side until it is linked in.'; break;
        case 'fill': say = 'n->data = ' + xv + '.'; break;
        case 'terminate': say = 'n->next = NULL: the newest node is always the last one, so nothing comes after it.'; break;
        case 'empty-test': say = r.rear ? 'rear is not NULL: there is a last node (' + nm(r.rear) + ') to hang the new one after.' : 'rear is NULL: the queue is empty, so the new node will be the only one.'; break;
        case 'first': say = 'front = n. In an empty queue the new node is the front as well as the rear.'; break;
        case 'attach': say = 'rear->next = n: the old last node, ' + nm(r.rear) + ', now leads to ' + xv + '. No walking along the list was needed, because rear was already there.'; break;
        case 'new-rear': say = 'rear = n: rear moves to the new last node. The queue, front first: ' + vals.join(', ') + '.'; break;
        case 'none-test': say = r.front ? 'dequeue(): front is ' + nm(r.front) + ', the item that has waited longest.' : 'dequeue(): front is NULL, so there is nothing to take.'; break;
        case 'underflow': say = 'dequeue() returns -1: the queue is empty.'; break;
        case 'hold': say = 'old = front: keep the front node\'s address so it can be freed after front moves on.'; break;
        case 'take': say = 'x = old->data = ' + xv + '.'; break;
        case 'advance': say = r.front ? 'front = old->next: front moves to ' + nm(r.front) + '. Everyone moves up one place.' : 'front = old->next, which is NULL: that was the only node. But look at rear: it still points at the node that is about to be freed.'; break;
        case 'last-test': say = r.front ? 'front is not NULL, so other nodes remain and rear is still right.' : 'front is NULL, so the queue is now empty, and rear must be emptied as well.'; break;
        case 'reset-rear': say = 'rear = NULL. Without this line rear would dangle, and the next enqueue would do rear->next = n on freed memory.'; break;
        case 'free': say = 'free(old): the node that left gives its memory back.'; break;
        case 'give': say = 'dequeue() returns ' + xv + '.' + (vals.length ? ' The queue, front first: ' + vals.join(', ') + '.' : ' The queue is empty.'); break;
        case 'after':
          if (k < ops.length - 1) say = name + ' is done. ' + (vals.length ? 'The queue, front first: ' + vals.join(', ') + '.' : 'The queue is empty: front and rear are both NULL.') + ' Next: ' + (ops[k + 1].op === 'add' ? 'enqueue(' + ops[k + 1].v + ')' : 'dequeue()') + '.';
          else say = 'main is finished. ' + (vals.length ? 'Still waiting, front first: ' + vals.join(', ') + '.' : 'The queue is empty.') + ' The values came out in the order they went in: ' + (m.out.filter((o) => !o.bad).map((o) => o.v).join(', ') || 'none') + '.';
          break;
      }
      return { items, say, slow: tag === 'advance' && !r.front };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'terminate' && t.data.roots.rear && ts[i + 1] && ts[i + 1].tag === 'empty-test', once: true, ask: 'Which node will the new node be hung after? Click it.', answer: (ts, i) => 'n' + ts[i].data.roots.rear, explain: () => 'After rear, the newest node: new items join at the back.' },
      { at: (t, i, ts) => t.tag === 'take' && ts[i + 1] && ts[i + 1].tag === 'advance' && !ts[i + 1].data.roots.front, once: true, ask: 'This is the only node, so front = old->next will make front NULL. What will rear point at then?', options: () => ['NULL already', 'The node that is about to be freed', 'The new front'], answer: () => 'The node that is about to be freed', pick: 'option', explain: () => 'dequeue only moved front. rear still holds the old node\'s address, so the code must reset it.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'none-test' && t.data.roots.front, once: true, ask: 'dequeue() is next. Click the node it will take.', answer: (ts, i) => 'n' + ts[i].data.roots.front, explain: () => 'The one at front: it has waited longest.' },
    ],
    quiz: [
      { q: 'Why does a linked queue keep a rear pointer as well as front?', options: ['To go backwards', 'So enqueue can reach the last node without walking the list', 'To count the items', 'C requires it'], answer: 1, why: 'Without rear, every enqueue would walk to the end: O(n) instead of O(1).' },
      { q: 'Which end does dequeue take from, and why that end?', options: ['The rear: it is newest', 'The front: removing the first node only needs front = front->next', 'Either', 'The middle'], answer: 1, why: 'In a singly linked list, the head is easy to remove. Removing the tail would need the node before it.' },
      { q: 'The last node is dequeued and rear is not reset. What goes wrong next?', options: ['Nothing', 'The next enqueue writes rear->next into freed memory and front stays NULL', 'front becomes rear', 'The queue doubles'], answer: 1, why: 'rear dangles. enqueue sees rear != NULL, writes into the freed node, and the new node is never reachable from front.' },
      { q: 'How many pointers does enqueue write into a non-empty queue?', options: ['One', 'Three: n->next, rear->next and rear', 'All of them', 'None'], answer: 1, why: 'The new node\'s next, the old last node\'s next, and rear itself.' },
    ],
    compareWith: 'circular-queue',
  });
})(SEE);
