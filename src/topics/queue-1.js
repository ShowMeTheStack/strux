// Queues in an array: the circular queue.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, A = X.ArrayKit;

  X.family({
    id: 'cqueue', order: 3, group: 'Stacks and queues', title: 'Queues in an array',
    blurb: 'A fixed array, a front and a rear that chase each other round in a circle, and a count that tells full from empty.',
    head: (t, inp) => `#include <stdio.h>

#define CAP ${inp.cap}

int items[CAP];
int front = 0;      /* where the next one leaves */
int rear = 0;       /* where the next one arrives */
int count = 0;      /* how many are waiting */`,
  });
  /** "+5 +8 - +3" into a list of operations */
  X.parseOps = (text) => String(text || '').trim().split(/[\s,]+/).filter(Boolean).map((t) => {
    const m = /^([+-])(-?\d+)?$/.exec(t);
    if (!m) throw new Error('"' + t + '" is not an operation: use +5 to add 5, and - to take one out');
    return m[1] === '+' ? { op: 'add', v: m[2] === undefined ? 0 : +m[2] } : { op: 'take' };
  });
  const opsIn = (def) => ({ id: 'ops', kind: 'text', label: 'Operations (+5 adds 5, - takes one)', def, check: (v) => { try { const o = X.parseOps(v); if (!o.length) return 'Operations: give at least one'; if (o.length > 16) return 'Operations: at most 16'; } catch (e) { return e.message; } return null; } });

  X.topic({
    id: 'circular-queue', family: 'cqueue', order: 20, title: 'Circular queue',
    blurb: 'When rear reaches the end of the array it wraps round to slot 0, so the space freed at the front is used again.',
    code: `/* add x at the rear; returns 0 if the queue is full */
int enqueue(int x)
{
    if (count == CAP)                 /*@ full-test */
        return 0;                     /*@ full */
    items[rear] = x;                  /*@ store */
    rear = (rear + 1) % CAP;          /*@ wrap-rear */
    count++;                          /*@ count-up */
    return 1;                         /*@ ok */
}

/* take the front item out; returns -1 if the queue is empty */
int dequeue(void)
{
    int x;
    if (count == 0)                   /*@ empty-test */
        return -1;                    /*@ empty */
    x = items[front];                 /*@ take */
    front = (front + 1) % CAP;        /*@ wrap-front */
    count--;                          /*@ count-down */
    return x;                         /*@ give */
}`,
    animate: ['enqueue', 'dequeue'],
    inputs: [opsIn('+10 +20 +30 - - +40 +50 +60 +70 - +80'), { id: 'cap', kind: 'int', label: 'Capacity', def: 5, lo: 2, hi: 10 }],
    presets: [
      { label: 'Wrap around', values: { ops: '+10 +20 +30 - - +40 +50 +60 +70 - +80', cap: 5 } },
      { label: 'Fill it up', values: { ops: '+1 +2 +3 +4 +5 +6', cap: 5 } },
      { label: 'Empty it out', values: { ops: '+7 +8 - - -', cap: 4 } },
      { label: 'Round and round', values: { ops: '+1 - +2 - +3 - +4 - +5 - +6 -', cap: 3 } },
    ],
    counters: ['writes', 'moves'],
    main: (inp) => 'int main(void)\n{\n' + X.parseOps(inp.ops).map((o) => (o.op === 'add' ? '    enqueue(' + o.v + ');' : '    dequeue();')).join('\n') + '\n    return 0;\n}',
    capture(P) {
      const cap = P.ev('CAP');
      return { items: P.arr('items', cap), front: P.val('front'), rear: P.val('rear'), count: P.val('count'), x: P.has('x', 0) && P.isSet('x', 0) ? P.val('x', 0) : null, fn: P.frames[0].name, cap };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, cap = d.cap;
      const memo = ctx.memo;
      // which slots hold a waiting item: count of them, starting at front
      const live = new Set();
      for (let k = 0; k < d.count; k++) live.add((d.front + k) % cap);
      const R = Math.max(130, cap * 30);
      const cell = 56;
      const items = [];
      const at = (i, r) => ({ x: Math.cos(-Math.PI / 2 + 2 * Math.PI * i / cap) * r, y: Math.sin(-Math.PI / 2 + 2 * Math.PI * i / cap) * r });
      // the ring: each slot of the array at its place on the circle; the value keeps its identity as it moves
      const tr = A.track(ctx, 'q', d.items.map((v, i) => (live.has(i) ? v : null)));
      items.push({ key: 'ringline', kind: 'ring', x: 0, y: 0, r: R });
      for (let i = 0; i < cap; i++) {
        const p = at(i, R);
        items.push({ key: 'slot' + i, kind: 'cell', x: p.x - cell / 2, y: p.y - cell / 2, w: cell, h: cell, text: live.has(i) ? d.items[i] : '', sub: '', cls: (live.has(i) ? 'part-b' : 'empty') + (tr.wrote.has(i) ? ' hot' : '') + ((tag === 'take' || tag === 'wrap-front') && i === (tag === 'take' ? d.front : (d.front - 1 + cap) % cap) && d.fn === 'dequeue' ? ' focus' : ''), flash: tr.wrote.has(i) });
        const ip = at(i, R - 50);
        items.push({ key: 'ix' + i, kind: 'text', x: ip.x, y: ip.y + 4, text: String(i), cls: 'idx', anchor: 'middle' });
      }
      // front and rear: tags outside the ring, pointing at their slots
      const mark = (name, i, extra) => {
        const p = at(i, R + cell / 2 + 4), t = at(i, R + cell / 2 + 46 + extra);
        items.push({ key: 'mk' + name, kind: 'cursor', x: p.x, y: p.y, tx: t.x, ty: t.y, text: name, cls: name === 'front' ? 'c-indigo' : 'c-violet' });
      };
      mark('front', d.front, d.front === d.rear ? 0 : 0);
      mark('rear', d.rear, d.front === d.rear ? 34 : 0);
      // the same array laid flat, below the ring
      const y0 = R + 110;
      const x0 = -(cap * (cell + 6)) / 2;
      items.push({ key: 'flatT', kind: 'text', x: x0 - 12, y: y0 + cell / 2 + 5, text: 'items[]', cls: 'code-text', anchor: 'end' });
      for (let i = 0; i < cap; i++) items.push({ key: 'flat' + i, kind: 'cell', x: x0 + i * (cell + 6), y: y0, w: cell, h: cell, text: d.items[i] === null ? '' : d.items[i], sub: i, cls: live.has(i) ? 'part-b' : 'gone' });
      items.push({ key: 'cnt', kind: 'text', x: 0, y: 8, text: 'count = ' + d.count + ' of ' + cap, cls: 'big', anchor: 'middle' });
      if (d.fn === 'dequeue' && d.x !== null && ['wrap-front', 'count-down'].includes(tag)) {
        const p = at((d.front - (tag === 'wrap-front' || tag === 'count-down' ? 1 : 0) + cap) % cap, R + 140);
        items.push({ key: 'out', kind: 'token', x: p.x, y: p.y, r: 20, text: String(d.x), cls: 'c-green' });
      }
      const call = d.fn === 'enqueue' ? 'enqueue' : 'dequeue';
      let say = '';
      switch (tag) {
        case 'enter': say = call === 'enqueue' ? 'enqueue(): a new item wants to join the queue.' : 'dequeue(): the item that has waited longest leaves.'; break;
        case 'full-test': say = d.count === cap ? 'count is ' + cap + ', the capacity: the queue is full.' : 'count is ' + d.count + ' of ' + cap + ': there is room.'; break;
        case 'full': say = 'Full: nothing is stored, and enqueue() reports failure with 0. In a circular queue, full and empty both have front == rear; count tells them apart.'; break;
        case 'store': say = 'The item goes into items[' + ((d.rear - 0 + cap) % cap) + '], the slot rear points at.'; break;
        case 'wrap-rear': say = 'rear moves on by one: (rear + 1) % ' + cap + ' = ' + d.rear + '.' + (d.rear === 0 ? ' It wrapped round from the last slot back to slot 0.' : ''); break;
        case 'count-up': say = 'One more waiting: count = ' + d.count + '.'; break;
        case 'empty-test': say = d.count === 0 ? 'count is 0: the queue is empty.' : d.count + ' waiting, so there is something to take.'; break;
        case 'empty': say = 'Empty: dequeue() returns -1 to say there was nothing.'; break;
        case 'take': say = 'x = items[' + d.front + '] = ' + d.x + ': the item at the front.'; break;
        case 'wrap-front': say = 'front moves on by one: (front + 1) % ' + cap + ' = ' + d.front + '.' + (d.front === 0 ? ' It wrapped round to slot 0.' : '') + ' The old value is still in the array, but it is no longer part of the queue.'; break;
        case 'ok': say = 'enqueue() returns 1: the item is in, and ' + d.count + ' of ' + cap + ' slots are taken.'; break;
        case 'give': say = 'dequeue() hands back ' + d.x + '. The slot it sat in will be written over when rear comes round again.'; break;
        case 'count-down': say = 'One fewer waiting: count = ' + d.count + '.'; break;
        case 'after': say = 'Queue now: ' + (d.count ? [...Array(d.count).keys()].map((k) => d.items[(d.front + k) % cap]).join(' ← ') + ' (front first)' : 'empty') + '.'; break;
      }
      void memo;
      return { items, say };
    },
    predict: [
      { at: (t) => t.tag === 'store' && t.data.rear === t.data.cap - 1, once: true, ask: 'rear is at the last slot. Where will it point after this item is stored?', options: (ts) => ['0', String(ts[0].data.cap), 'It stays'], answer: () => '0', pick: 'option', explain: (ts) => '(rear + 1) % ' + ts[0].data.cap + ' wraps it round to 0.' },
    ],
    quiz: [
      { q: 'Why does a circular queue keep a count (or leave one slot unused)?', options: ['To go faster', 'Because front == rear when it is empty and also when it is full', 'To sort the items', 'C needs it'], answer: 1, why: 'Without it, an empty queue and a full one look the same.' },
      { q: 'With CAP = 5 and rear = 4, where does rear go after an enqueue?', options: ['5', '0', '4', '1'], answer: 1, why: '(4 + 1) % 5 = 0: back to the start of the array.' },
      { q: 'How long does dequeue take in a circular queue of n items?', options: ['O(n), everything shifts left', 'O(1)', 'O(log n)', 'O(n²)'], answer: 1, why: 'Only front moves; nothing is shifted.' },
    ],
  });
})(SEE);
