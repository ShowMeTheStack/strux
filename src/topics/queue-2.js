// Queues in an array: the naive linear queue, whose front and rear only ever move forward.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, S = X.StackKit;

  const C = 58, G = 6;

  X.topic({
    id: 'queue-array-naive', family: 'cqueue', order: 10, title: 'Linear queue (the naive way)',
    blurb: 'front and rear both march to the right and never come back. Space freed at the front is lost, and the queue reports full while cells stand empty.',
    code: `/* add x at the rear; returns 0 once rear has reached the end */
int enqueue(int x)
{
    if (rear == CAP)                  /*@ full-test */
        return 0;                     /*@ full */
    items[rear] = x;                  /*@ store */
    rear++;                           /*@ rear-up */
    count++;                          /*@ count-up */
    return 1;                         /*@ ok */
}

/* take the front item out; returns -1 if the queue is empty */
int dequeue(void)
{
    int x;
    if (front == rear)                /*@ empty-test */
        return -1;                    /*@ empty */
    x = items[front];                 /*@ take */
    front++;                          /*@ front-up */
    count--;                          /*@ count-down */
    return x;                         /*@ give */
}`,
    animate: ['enqueue', 'dequeue'],
    inputs: [S.opsInput('+10 +20 +30 - - +40 +50 +60', 'Operations (+5 adds 5, - takes one)', 14), { id: 'cap', kind: 'int', label: 'Capacity', def: 5, lo: 2, hi: 10 }],
    presets: [
      { label: 'Marches off the end', values: { ops: '+10 +20 +30 - - +40 +50 +60', cap: 5 } },
      { label: 'One in, one out', values: { ops: '+1 - +2 - +3 - +4 - +5 - +6', cap: 5 } },
      { label: 'Fill it up', values: { ops: '+1 +2 +3 +4 +5', cap: 4 } },
      { label: 'Empty it out', values: { ops: '+7 +8 - - -', cap: 4 } },
    ],
    counters: ['writes'],
    main: (inp) => 'int main(void)\n{\n' + S.parse(inp.ops).map((o) => (o.op === 'add' ? '    enqueue(' + o.v + ');' : '    dequeue();')).join('\n') + '\n    return 0;\n}',
    capture(P) {
      const cap = P.ev('CAP');
      return { items: P.arr('items', cap), front: P.val('front'), rear: P.val('rear'), count: P.val('count'), x: P.has('x', 0) && P.isSet('x', 0) ? P.val('x', 0) : null, cap };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, cap = d.cap;
      const ops = S.parse(ctx.input.ops);
      const k = S.opIndex(ctx);
      const op = ops[Math.min(k, ops.length - 1)];
      const m = ctx.memo;
      m.used = m.used || new Array(cap).fill(false);
      m.out = m.out || [];
      m.res = m.res || [];
      if (m.seen !== ctx.i) {
        m.seen = ctx.i;
        if (tag === 'store') m.used[d.rear] = true;
        if (tag === 'take') m.out.push({ v: d.x, from: d.front });
        if (tag === 'empty') { m.out.push({ v: -1, bad: true, from: d.front }); m.res[k] = 'empty'; }
        if (tag === 'full') { m.res[k] = 'full'; m.fullAt = m.fullAt || { count: d.count, front: d.front }; }
        if (tag === 'ok') m.res[k] = 'ok';
        if (tag === 'give') m.res[k] = String(m.out[m.out.length - 1].v);
      }
      const xv = d.x !== null ? d.x : op && op.op === 'add' ? op.v : m.out.length ? m.out[m.out.length - 1].v : 0;
      const xOf = (i) => i * (C + G);
      const end = xOf(cap) - G;
      const items = [S.extent(-110, -206, end + 230, 400)];
      items.push(...S.script(ops, tag === 'after' ? k + 1 : k, { x0: Math.min(0, end / 2 - ops.length * 51 / 2), y0: -196, result: (j) => m.res[j], bad: (j) => m.res[j] === 'full' || m.res[j] === 'empty' }));
      const fullNow = tag === 'full' || (tag === 'full-test' && d.rear === cap);
      // three zones: used up (left of front), the queue itself, and what is still free
      if (d.front > 0) items.push({ key: 'zWaste', kind: 'region', x: -6, y: -34, w: xOf(d.front) - G + 12, h: C + 44, cls: 'sk-waste', text: d.front === 1 ? 'lost' : 'lost for good' });
      if (d.rear > d.front) items.push({ key: 'zWin', kind: 'region', x: xOf(d.front) - 6, y: -34, w: xOf(d.rear) - xOf(d.front) - G + 12, h: C + 44, cls: 'sk-window', text: 'queue' });
      if (d.rear < cap) items.push({ key: 'zFree', kind: 'region', x: xOf(d.rear) - 6, y: -34, w: end - xOf(d.rear) + 12, h: C + 44, cls: 'sk-well', text: 'free' });
      for (let i = 0; i < cap; i++) {
        const live = i >= d.front && i < d.rear;
        const fresh = tag === 'store' && i === d.rear;
        items.push({
          key: 'c' + i, kind: 'cell', x: xOf(i), y: 0, w: C, h: C, text: m.used[i] ? d.items[i] : '', sub: i,
          cls: live ? 'sk-live' : m.used[i] ? 'sk-garbage' : '', flash: fresh, pick: true,
        });
      }
      // the end of the array: a wall rear runs into
      items.push({ key: 'wall', kind: 'line', x1: end + 10, y1: -40, x2: end + 10, y2: C + 16, cls: 'sk-ceiling' + (fullNow ? ' bad' : '') });
      items.push({ key: 'wallT', kind: 'text', x: end + 18, y: -24, text: 'CAP = ' + cap, cls: 'sk-label' + (fullNow ? ' bad' : '') });
      // front and rear, under the cells; rear == CAP points past the wall
      const mark = (name, idx, slot, cls) => {
        const x = idx < cap ? xOf(idx) + C / 2 : end + 34;
        items.push({ key: 'm' + name, kind: 'cursor', x, y: C + 20, tx: x, ty: C + 48 + slot * 24, text: name + ' = ' + idx, cls });
      };
      mark('front', d.front, 0, 'c-indigo');
      mark('rear', d.rear, d.rear === d.front ? 1 : 0, 'c-violet');
      // the value arriving (from the right) or leaving (to the left)
      if (op && op.op === 'add' && ['enter', 'full-test', 'full'].includes(tag)) {
        const tx = fullNow ? end + 50 : xOf(d.rear) + C / 2;
        items.push({ key: 'in' + k, kind: 'token', x: tx, y: -62, r: 20, text: String(xv), cls: (fullNow ? 'sk-bad' : 'c-green') + ' sk-big', enter: 'fly', from: { x: end + 120, y: -62 } });
      }
      if (fullNow) {
        const free = cap - d.count;
        items.push({ key: 'fullT', kind: 'text', x: end / 2, y: C + 112, text: free ? 'full, although ' + free + ' of ' + cap + ' cells hold nothing in the queue' : 'full: every cell is in use', cls: 'sk-label bad', anchor: 'middle' });
        if (d.front > 0) items.push({ key: 'wrap', kind: 'arrow', from: { x: end + 10, y: -40 }, to: { x: C / 2, y: -40 }, bend: 55, cls: 'dim', label: 'a circular queue would wrap round here' });
      }
      // what dequeue() gave, on the left, in the order they left
      items.push({ key: 'outT', kind: 'text', x: -60, y: -76, text: 'out', cls: 'sk-title', anchor: 'middle' });
      m.out.forEach((o, j) => {
        const leaving = j === m.out.length - 1 && (tag === 'take' || tag === 'front-up');
        items.push({ key: 'out' + j, kind: 'token', x: leaving ? xOf(o.from) + C / 2 : -60, y: leaving ? -62 : -48 + j * 36 - Math.max(0, m.out.length - 7) * 36, r: 16, text: String(o.v), cls: (o.bad ? 'sk-bad' : 'c-teal'), enter: 'fly', from: { x: xOf(Math.min(o.from, cap - 1)) + C / 2, y: C / 2 } });
      });
      const q = d.items.slice(d.front, d.rear);
      const name = op && op.op === 'add' ? 'enqueue(' + op.v + ')' : 'dequeue()';
      let say = '';
      switch (tag) {
        case 'enter': say = name + ' is the first operation. front and rear both start at 0: the queue is empty.'; break;
        case 'full-test': say = d.rear === cap ? name + ': rear is ' + cap + ', which is CAP. It has reached the end of the array.' + (d.front ? ' Cells 0 to ' + (d.front - 1) + ' are empty, but this code can never go back to them.' : '') : name + ': rear is ' + d.rear + ', not yet CAP, so there is a cell for it.'; break;
        case 'full': say = 'enqueue() returns 0: full. ' + (d.count < cap ? 'Only ' + d.count + ' item' + (d.count === 1 ? ' is' : 's are') + ' waiting in ' + cap + ' cells. The space in front of front is wasted.' : 'This time every cell really is in use.'); break;
        case 'store': say = 'items[' + d.rear + '] = ' + xv + ': it joins at the rear.'; break;
        case 'rear-up': say = 'rear moves on to ' + d.rear + '.' + (d.rear === cap ? ' That is past the last cell: no more enqueues, ever.' : ''); break;
        case 'count-up': say = 'count = ' + d.count + '.'; break;
        case 'ok': say = 'enqueue() returns 1. The queue, front first: ' + q.join(', ') + '.'; break;
        case 'empty-test': say = d.front === d.rear ? name + ': front == rear (' + d.front + '), so the queue is empty.' : name + ': front is ' + d.front + ' and rear is ' + d.rear + ', so items[' + d.front + '] = ' + d.items[d.front] + ' is waiting at the front.'; break;
        case 'empty': say = 'dequeue() returns -1: nothing to take.'; break;
        case 'take': say = 'x = items[' + d.front + '] = ' + xv + ': the item that has waited longest.'; break;
        case 'front-up': say = 'front moves on to ' + d.front + '. Cell ' + (d.front - 1) + ' is now behind front, and nothing will ever be stored there again.'; break;
        case 'count-down': say = 'count = ' + d.count + '.'; break;
        case 'give': say = 'dequeue() returns ' + xv + '.'; break;
        case 'after':
          if (k < ops.length - 1) say = name + ' is done. ' + (q.length ? 'The queue, front first: ' + q.join(', ') + '.' : 'The queue is empty.') + ' ' + (d.front ? d.front + ' cell' + (d.front === 1 ? ' is' : 's are') + ' lost at the front.' : '') + ' Next: ' + (ops[k + 1].op === 'add' ? 'enqueue(' + ops[k + 1].v + ')' : 'dequeue()') + '.';
          else say = 'main is finished. ' + (m.fullAt ? 'The queue said full with only ' + m.fullAt.count + ' item' + (m.fullAt.count === 1 ? '' : 's') + ' in it. A circular queue lets rear wrap round to cell 0 and fixes this.' : 'front and rear have only moved right: ' + d.front + ' cell' + (d.front === 1 ? '' : 's') + ' at the front can never be used again.');
          break;
      }
      return { items, say, slow: tag === 'full' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'full-test' && ts[i + 1].data.rear === t.data.cap, once: true, ask: (t) => 'An enqueue is next. rear is ' + t.data.rear + ' and only ' + t.data.count + ' item' + (t.data.count === 1 ? ' is' : 's are') + ' waiting. Will it succeed?', options: () => ['Yes, there are free cells', 'No, it reports full'], answer: () => 'No, it reports full', pick: 'option', explain: () => 'The test is rear == CAP. Free cells behind front do not count: this queue never goes back.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'empty-test' && t.data.front < t.data.rear, once: true, ask: 'dequeue() is next. Click the item it will take.', answer: (ts, i) => 'c' + ts[i].data.front, explain: () => 'The one at front: it arrived first.' },
    ],
    quiz: [
      { q: 'CAP = 4. You enqueue 4 items and dequeue all 4. How many more can you enqueue?', options: ['4', '0', '1', '3'], answer: 1, why: 'rear is already 4 = CAP, so every enqueue reports full, although the queue is empty.' },
      { q: 'Why does this queue waste space?', options: ['It stores each item twice', 'front and rear only move right, so cells behind front are never reused', 'It needs a count', 'The array is too small'], answer: 1, why: 'After a dequeue, the cell at the old front is behind both indexes for good.' },
      { q: 'One fix is to shift every item left after each dequeue. What does that cost?', options: ['Nothing', 'O(n) moves per dequeue', 'O(1)', 'An extra array'], answer: 1, why: 'Every waiting item has to move one cell: dequeue becomes O(n).' },
      { q: 'What does the circular queue change?', options: ['It uses a linked list', 'rear and front wrap round to 0 with % CAP', 'It doubles the array', 'It sorts the items'], answer: 1, why: 'Wrapping lets the freed cells at the start be used again, still in O(1).' },
    ],
    compareWith: 'circular-queue',
  });
})(SEE);
