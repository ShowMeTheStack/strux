// Double-ended queues: push and pop at both ends, in a circular array and in a doubly linked list.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, S = X.StackKit, K = X.ListKit;

  X.family({
    id: 'deque', order: 5, group: 'Stacks and queues', title: 'Double-ended queues',
    blurb: 'A deque lets items join and leave at both ends. Use only one end and it is a stack; join at one and leave at the other and it is a queue.',
    head: (t, inp) => (t.id === 'deque-array' ? `#include <stdio.h>

#define CAP ${inp.cap}

int items[CAP];
int front = 0;      /* index of the first item */
int count = 0;      /* how many items there are; the last is at (front + count - 1) % CAP */` : `#include <stdio.h>
#include <stdlib.h>

struct node {
    int data;
    struct node *prev;      /* towards the front */
    struct node *next;      /* towards the back */
};

struct node *front = NULL;  /* the first item */
struct node *back = NULL;   /* the last item */`),
  });

  /** "<5 >8 < >": add 5 at the front, add 8 at the back, take from the front, take from the back */
  const parse = (text) => String(text || '').trim().split(/[\s,]+/).filter(Boolean).map((t) => {
    const m = /^([<>])(-?\d+)?$/.exec(t);
    if (!m) throw new Error('"' + t + '" is not an operation: <5 adds 5 at the front, >5 at the back; < alone takes from the front, > from the back');
    const end = m[1] === '<' ? 'front' : 'back';
    return m[2] === undefined ? { op: 'take', end } : { op: 'add', end, v: +m[2] };
  });
  const opsIn = (def, max) => ({
    id: 'ops', kind: 'text', label: 'Operations (<5 adds 5 at the front, >5 at the back; < or > alone takes one)', def,
    check: (v) => {
      let o;
      try { o = parse(v); } catch (e) { return e.message; }
      if (!o.length) return 'Operations: give at least one';
      if (o.length > max) return 'Operations: at most ' + max + ', so the picture stays readable';
      if (o.some((x) => x.op === 'add' && Math.abs(x.v) > 999)) return 'Operations: values from -999 to 999';
      return null;
    },
  });
  const callOf = (o) => (o.op === 'add' ? 'push_' + o.end + '(' + o.v + ')' : 'pop_' + o.end + '()');
  const chipOf = (o) => (o.op === 'add' ? (o.end === 'front' ? '<' + o.v : '>' + o.v) : (o.end === 'front' ? '<' : '>'));
  const mainOf = (inp) => 'int main(void)\n{\n' + parse(inp.ops).map((o) => '    ' + callOf(o) + ';').join('\n') + '\n    return 0;\n}';
  const longest = (ops) => { let n = 0, mx = 0; for (const o of ops) { if (o.op === 'add') n++; else if (n) n--; mx = Math.max(mx, n); } return mx; };
  /** Bookkeeping shared by both: which operation, its results, the values taken out at each end */
  const book = (ctx, ops, takeTags) => {
    const tag = ctx.tick.tag, d = ctx.tick.data;
    const k = S.opIndex(ctx);
    const op = ops[Math.min(k, ops.length - 1)];
    const m = ctx.memo;
    m.out = m.out || { front: [], back: [] };
    m.res = m.res || [];
    if (m.seen !== ctx.i) {
      m.seen = ctx.i;
      if (takeTags.includes(tag)) { m.out[op.end].push({ v: d.x }); m.last = d.x; }
      if (tag === 'empty' || tag === 'underflow') { m.out[op.end].push({ v: -1, bad: true }); m.res[k] = 'empty'; m.last = -1; }
      if (tag === 'full') m.res[k] = 'full';
      if (tag === 'ok' || tag === 'new-front' || tag === 'new-back') m.res[k] = 'ok';
      if (tag === 'give') m.res[k] = String(m.last);
    }
    const xv = d.x !== null && d.x !== undefined ? d.x : op.op === 'add' ? op.v : m.last;
    return { k, op, m, xv };
  };
  const trays = (m, xL, xR, y0, leaving) => {
    const items = [];
    for (const end of ['front', 'back']) {
      const x = end === 'front' ? xL : xR;
      items.push({ key: 'trT' + end, kind: 'text', x, y: y0 - 26, text: 'out at ' + end, cls: 'sk-title', anchor: 'middle' });
      m.out[end].forEach((o, j) => {
        const lv = leaving && leaving.end === end && j === m.out[end].length - 1;
        items.push({ key: 'out' + end + j, kind: 'token', x: lv ? leaving.x : x, y: lv ? leaving.y : y0 + j * 38, r: 16, text: String(o.v), cls: o.bad ? 'sk-bad' : 'c-teal', enter: 'fly', from: leaving ? { x: leaving.x, y: leaving.y } : { x, y: y0 } });
      });
    }
    return items;
  };

  // ---- deque in a circular array ---------------------------------------------------------------------------
  const C = 56, G = 8, LY = 0, PY = 170;
  X.topic({
    id: 'deque-array', family: 'deque', order: 10, title: 'Deque in a circular array',
    blurb: 'Two views of the same deque: the items in order, first to last, and where they really sit in the array. push_front steps front backwards, and from slot 0 that means wrapping round to the end.',
    code: `/* add x before the first item; returns 0 if full */
int push_front(int x)
{
    if (count == CAP)                      /*@ full-test */
        return 0;                          /*@ full */
    front = (front - 1 + CAP) % CAP;       /*@ step-back */
    items[front] = x;                      /*@ store-front */
    count++;                               /*@ count-up */
    return 1;                              /*@ ok */
}

/* add x after the last item; returns 0 if full */
int push_back(int x)
{
    if (count == CAP)                      /*@ full-test */
        return 0;                          /*@ full */
    items[(front + count) % CAP] = x;      /*@ store-back */
    count++;                               /*@ count-up */
    return 1;                              /*@ ok */
}

/* take the first item; returns -1 if empty */
int pop_front(void)
{
    int x;
    if (count == 0)                        /*@ empty-test */
        return -1;                         /*@ empty */
    x = items[front];                      /*@ take-front */
    front = (front + 1) % CAP;             /*@ step-on */
    count--;                               /*@ count-down */
    return x;                              /*@ give */
}

/* take the last item; returns -1 if empty */
int pop_back(void)
{
    int x;
    if (count == 0)                        /*@ empty-test */
        return -1;                         /*@ empty */
    x = items[(front + count - 1) % CAP];  /*@ take-back */
    count--;                               /*@ count-down */
    return x;                              /*@ give */
}`,
    animate: ['push_front', 'push_back', 'pop_front', 'pop_back'],
    inputs: [opsIn('<10 >20 <30 >40 > < <50 >60', 12), { id: 'cap', kind: 'int', label: 'Capacity', def: 5, lo: 2, hi: 8 }],
    presets: [
      { label: 'Both ends', values: { ops: '<10 >20 <30 >40 > < <50 >60', cap: 5 } },
      { label: 'Front only: a stack', values: { ops: '<1 <2 <3 < < <', cap: 4 } },
      { label: 'Back in, front out: a queue', values: { ops: '>1 >2 >3 < >4 >5 < <', cap: 4 } },
      { label: 'Full, then empty', values: { ops: '<1 <2 >3 <4 > > > >', cap: 3 } },
    ],
    counters: ['writes'],
    main: mainOf,
    capture(P) {
      const cap = P.ev('CAP');
      return { items: P.arr('items', cap), front: P.val('front'), count: P.val('count'), x: P.has('x', 0) && P.isSet('x', 0) ? P.val('x', 0) : null, cap };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, cap = d.cap;
      const ops = parse(ctx.input.ops);
      const { k, op, m, xv } = book(ctx, ops, ['take-front', 'take-back']);
      m.gen = m.gen || new Array(cap).fill(0);
      if (m.genAt !== ctx.i) { m.genAt = ctx.i; if (tag === 'store-front') m.gen[d.front]++; if (tag === 'store-back') m.gen[(d.front + d.count) % cap]++; }
      const W = cap * (C + G) - G;
      const px = (i) => i * (C + G) - W / 2;
      const lx = (j, n) => (j - n / 2) * (C + G) + G / 2;
      const items = [S.extent(-W / 2 - 220, -150, W + 380, PY + C + 140)];
      items.push(...S.script(ops, tag === 'after' ? k + 1 : k, { x0: Math.max(-W / 2 - 110, -ops.length * 51 / 2), y0: -140, w: 44, label: chipOf, result: (j) => m.res[j], bad: (j) => m.res[j] === 'full' || m.res[j] === 'empty' }));
      // the items in order, as a list of slots; it changes on the line that really adds or removes one
      if (m.listAt !== ctx.i) {
        m.listAt = ctx.i;
        if (!m.list || tag === 'after' || tag === 'enter') { m.list = []; for (let j = 0; j < d.count; j++) m.list.push((d.front + j) % cap); }
        else if (tag === 'store-front') m.list.unshift(d.front);
        else if (tag === 'store-back') m.list.push((d.front + d.count) % cap);
        else if (tag === 'step-on') m.list.shift();
        else if (tag === 'take-back') m.list.pop();
      }
      const list = m.list.slice(), n = list.length, cnt = d.count;
      const slotOf = (j) => (d.front + j) % cap;
      const last = cnt ? slotOf(cnt - 1) : null;
      // where the current line reads or writes
      let touch = null;
      if (tag === 'store-front' || tag === 'take-front') touch = d.front;
      if (tag === 'store-back') touch = slotOf(cnt);
      if (tag === 'take-back') touch = (d.front + cnt - 1) % cap;
      // the deque as the user sees it: first to last
      items.push({ key: 'lT', kind: 'text', x: -W / 2 - 140, y: LY + C / 2 + 5, text: 'in order', cls: 'sk-title' });
      for (let j = 0; j < n; j++) {
        const s = list[j];
        const fresh = (tag === 'store-front' && j === 0) || (tag === 'store-back' && j === n - 1);
        items.push({ key: 'l' + s + '_' + m.gen[s], kind: 'cell', x: lx(j, n), y: LY, w: C, h: C, text: d.items[s], sub: '', cls: 'sk-live' + (s === touch ? ' sk-top' : ''), enter: fresh ? 'grow' : 'fade', flash: fresh });
        items.push({ key: 'ln' + s + '_' + m.gen[s], kind: 'line', x1: lx(j, n) + C / 2, y1: LY + C + 4, x2: px(s) + C / 2, y2: PY - 4, cls: 'sk-link' + (s === touch ? ' hot' : '') });
      }
      // the value about to be written, waiting at its end of the row
      if (tag === 'store-back' || (op.op === 'add' && op.end === 'back' && tag === 'full-test')) items.push({ key: 'inB' + k, kind: 'token', x: lx(n, n) + C / 2 + 16, y: LY + C / 2, r: 20, text: String(xv), cls: 'c-green sk-big' });
      if (op.op === 'add' && op.end === 'front' && (tag === 'full-test' || tag === 'step-back')) items.push({ key: 'inF' + k, kind: 'token', x: lx(0, n) - 34, y: LY + C / 2, r: 20, text: String(xv), cls: 'c-green sk-big' });
      if (!n) items.push({ key: 'lEmpty', kind: 'text', x: 0, y: LY + C / 2 + 5, text: 'empty', cls: 'sk-label' + (tag === 'empty' ? ' bad' : ''), anchor: 'middle' });
      items.push({ key: 'dF', kind: 'text', x: (n ? lx(0, n) : -40) - 70, y: LY - 14, text: '← front end', cls: 'sk-label' });
      items.push({ key: 'dB', kind: 'text', x: (n ? lx(n - 1, n) + C : 40) + 70, y: LY - 14, text: 'back end →', cls: 'sk-label', anchor: 'end' });
      // the real array
      items.push({ key: 'pT', kind: 'text', x: -W / 2 - 140, y: PY + C / 2 + 5, text: 'items[]', cls: 'sk-title' });
      const live = new Set();
      for (const s of list) live.add(s);
      for (let i = 0; i < cap; i++) {
        items.push({ key: 'p' + i, kind: 'cell', x: px(i), y: PY, w: C, h: C, text: m.gen[i] ? d.items[i] : '', sub: i, cls: (live.has(i) ? 'sk-live' : m.gen[i] ? 'sk-garbage' : '') + (i === touch ? ' sk-top' : ''), flash: i === touch && /store/.test(tag), pick: true });
      }
      items.push({ key: 'cf', kind: 'cursor', x: px(d.front) + C / 2, y: PY + C + 20, tx: px(d.front) + C / 2, ty: PY + C + 46, text: 'front = ' + d.front, cls: 'c-indigo' });
      if (cnt) items.push({ key: 'cb', kind: 'cursor', x: px(last) + C / 2, y: PY + C + 20, tx: px(last) + C / 2, ty: PY + C + (last === d.front ? 70 : 46), text: 'last', cls: 'c-violet' });
      items.push({ key: 'cnt', kind: 'text', x: W / 2 + 20, y: PY + C / 2 + 5, text: 'count = ' + cnt, cls: 'sk-label' + (cnt === cap && /full/.test(tag) ? ' bad' : '') });
      let leaving = null;
      if (tag === 'take-front' || tag === 'step-on') leaving = { end: 'front', x: lx(0, Math.max(n, 1)) - 34, y: LY + C / 2 };
      if (tag === 'take-back') leaving = { end: 'back', x: lx(n, n) + 16, y: LY + C / 2 };
      items.push(...trays(m, -W / 2 - 200, W / 2 + 130, 16, leaving));
      const order = [];
      for (const s of list) order.push(d.items[s]);
      const name = callOf(op);
      let say = '';
      switch (tag) {
        case 'enter': say = name + ' is the first operation. front = 0 and count = 0: the deque is empty.'; break;
        case 'full-test': say = cnt === cap ? name + ': count is ' + cap + ', so every slot is in use.' : name + ': count is ' + cnt + ' of ' + cap + ', so there is room.'; break;
        case 'full': say = 'Full: ' + xv + ' is not added, and the call returns 0.'; break;
        case 'step-back': { const was = (d.front + 1) % cap; say = 'front steps back one slot: (' + was + ' - 1 + ' + cap + ') % ' + cap + ' = ' + d.front + '.' + (was === 0 ? ' From slot 0, "back one" wraps round to the last slot. The + CAP stops the result going negative.' : ''); break; }
        case 'store-front': say = 'items[' + d.front + '] = ' + xv + '. In the row above it is now the first item, though in the array it sits at slot ' + d.front + '.'; break;
        case 'store-back': { const s = slotOf(cnt); say = 'The back is (front + count) % CAP = (' + d.front + ' + ' + cnt + ') % ' + cap + ' = ' + s + ': items[' + s + '] = ' + xv + '. front does not move.'; break; }
        case 'count-up': say = 'count = ' + cnt + '. In order: ' + order.join(', ') + '.'; break;
        case 'ok': say = name + ' returns 1.'; break;
        case 'empty-test': say = cnt ? name + ': ' + cnt + ' item' + (cnt === 1 ? '' : 's') + ' in the deque, so there is one to take.' : name + ': count is 0, so the deque is empty.'; break;
        case 'empty': say = 'Empty: the call returns -1.'; break;
        case 'take-front': say = 'x = items[front] = items[' + d.front + '] = ' + xv + ': the first item.'; break;
        case 'step-on': say = 'front moves on: (' + ((d.front - 1 + cap) % cap) + ' + 1) % ' + cap + ' = ' + d.front + '.' + (d.front === 0 ? ' It wrapped round to slot 0.' : ''); break;
        case 'take-back': say = 'The last item is at (front + count - 1) % CAP = (' + d.front + ' + ' + cnt + ' - 1) % ' + cap + ' = ' + last + ': x = ' + xv + '. Only count changes; front stays.'; break;
        case 'count-down': say = 'count = ' + cnt + '. ' + (cnt ? 'In order: ' + order.join(', ') + '.' : 'The deque is empty.'); break;
        case 'give': say = name + ' returns ' + xv + '.'; break;
        case 'after':
          if (k < ops.length - 1) say = name + ' is done. ' + (n ? 'In order: ' + order.join(', ') + '; in the array they start at slot ' + d.front + '.' : 'The deque is empty.') + ' Next: ' + callOf(ops[k + 1]) + '.';
          else say = 'main is finished. ' + (n ? 'The deque, first to last: ' + order.join(', ') + '.' : 'The deque is empty.') + ' Every operation touched one slot and one or two counters: all O(1).';
          break;
      }
      return { items, say, slow: tag === 'step-back' && (d.front === cap - 1) };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'full-test' && t.data.front === 0 && t.data.count < t.data.cap && ts[i + 1] && ts[i + 1].tag === 'step-back', once: true, ask: 'push_front() with front at 0. Where will front point after the next line?', options: (ts) => ['-1', '0', '1', String(ts[0].data.cap - 1)], answer: (ts) => String(ts[0].data.cap - 1), pick: 'option', explain: (ts) => '(0 - 1 + ' + ts[0].data.cap + ') % ' + ts[0].data.cap + ' = ' + (ts[0].data.cap - 1) + ': one step back from slot 0 wraps round to the last slot.' },
      { at: (t, i, ts) => t.tag === 'empty-test' && t.data.count > 1 && ts[i + 1] && ts[i + 1].tag === 'take-back', once: true, ask: 'pop_back() is next. Click the slot in items[] it will read.', answer: (ts, i) => { const d = ts[i].data; return 'p' + ((d.front + d.count - 1) % d.cap); }, explain: () => '(front + count - 1) % CAP: the slot of the last item.' },
    ],
    quiz: [
      { q: 'CAP = 6, front = 0. After push_front, what is front?', options: ['-1', '5', '1', '0'], answer: 1, why: '(0 - 1 + 6) % 6 = 5: it wraps round to the last slot.' },
      { q: 'Why write (front - 1 + CAP) % CAP and not (front - 1) % CAP?', options: ['It is faster', 'In C, -1 % CAP is -1, not CAP - 1', 'To avoid overflow at the top', 'No reason'], answer: 1, why: 'C\'s % keeps the sign of the left operand, so adding CAP first keeps the index from going negative.' },
      { q: 'front = 3, count = 4, CAP = 5. Where is the last item?', options: ['items[7]', 'items[2]', 'items[1]', 'items[4]'], answer: 1, why: '(3 + 4 - 1) % 5 = 6 % 5 = 1. The items sit in slots 3, 4, 0 and 1: the deque wraps round the end of the array.' },
      { q: 'Which variables does pop_back() change?', options: ['front and count', 'count only', 'front only', 'Every item'], answer: 1, why: 'The last item is found from front and count, so taking it only needs count to drop by one.' },
      { q: 'Using only push_front and pop_front, a deque behaves like...', options: ['A queue', 'A stack', 'A sorted list', 'A heap'], answer: 1, why: 'Items leave from the same end they joined: last in, first out.' },
    ],
    compareWith: 'deque-linked',
  });

  // ---- deque as a doubly linked list -----------------------------------------------------------------------
  const NW = 114, STEP = 176;
  X.topic({
    id: 'deque-linked', family: 'deque', order: 20, title: 'Deque as a doubly linked list',
    blurb: 'Every node points both ways, so either end can be unhooked in one step. Each push writes four pointers and each pop must cut the link to the node it frees.',
    code: `/* add x before the first item */
void push_front(int x)
{
    struct node *n = malloc(sizeof *n);    /*@ alloc */
    n->data = x;                           /*@ fill */
    n->prev = NULL;                        /*@ end-prev */
    n->next = front;                       /*@ link-out */
    if (front == NULL)                     /*@ empty-test */
        back = n;                          /*@ only */
    else
        front->prev = n;                   /*@ link-in */
    front = n;                             /*@ new-front */
}

/* add x after the last item */
void push_back(int x)
{
    struct node *n = malloc(sizeof *n);    /*@ alloc */
    n->data = x;                           /*@ fill */
    n->next = NULL;                        /*@ end-next */
    n->prev = back;                        /*@ link-out */
    if (back == NULL)                      /*@ empty-test */
        front = n;                         /*@ only */
    else
        back->next = n;                    /*@ link-in */
    back = n;                              /*@ new-back */
}

/* take the first item; returns -1 if empty */
int pop_front(void)
{
    struct node *old;
    int x;
    if (front == NULL)                     /*@ none-test */
        return -1;                         /*@ underflow */
    old = front;                           /*@ hold */
    x = old->data;                         /*@ take */
    front = old->next;                     /*@ advance */
    if (front == NULL)                     /*@ last-test */
        back = NULL;                       /*@ reset */
    else
        front->prev = NULL;                /*@ cut */
    free(old);                             /*@ free */
    return x;                              /*@ give */
}

/* take the last item; returns -1 if empty */
int pop_back(void)
{
    struct node *old;
    int x;
    if (back == NULL)                      /*@ none-test */
        return -1;                         /*@ underflow */
    old = back;                            /*@ hold */
    x = old->data;                         /*@ take */
    back = old->prev;                      /*@ advance */
    if (back == NULL)                      /*@ last-test */
        front = NULL;                      /*@ reset */
    else
        back->next = NULL;                 /*@ cut */
    free(old);                             /*@ free */
    return x;                              /*@ give */
}`,
    animate: ['push_front', 'push_back', 'pop_front', 'pop_back'],
    inputs: [opsIn('<20 >30 <10 > < >40 <', 10)],
    check: (inp) => (longest(parse(inp.ops)) > 4 ? 'At most 4 items in the deque at once, so the picture fits' : null),
    presets: [
      { label: 'Both ends', values: { ops: '<20 >30 <10 > < >40 <' } },
      { label: 'Into an empty deque', values: { ops: '>5 <' } },
      { label: 'Back in, front out', values: { ops: '>1 >2 >3 < < <' } },
      { label: 'Pop an empty deque', values: { ops: '> <7 > <' } },
    ],
    counters: ['allocs', 'frees', 'writes'],
    main: mainOf,
    capture: (P) => Object.assign(K.capture(P, { type: 'front', roots: ['front', 'back'], cursors: ['n', 'old'], fields: ['data'], links: ['next', 'prev'] }), { x: P.has('x', 0) && P.isSet('x', 0) ? P.val('x', 0) : null }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const ops = parse(ctx.input.ops);
      const { k, op, m, xv } = book(ctx, ops, ['take']);
      if (m.maxN === undefined) m.maxN = Math.max(1, longest(ops));
      const c = d.cursors, r = d.roots;
      const chain = K.chain(d, r.front).order;
      const len = chain.length;
      // the log of pointer writes made by this operation, in the order the lines make them
      const E = op.end, O = E === 'front' ? 'prev' : 'next', I = E === 'front' ? 'next' : 'prev', other = E === 'front' ? 'back' : 'front';
      const LOG = { 'end-prev': 'n->' + O + ' = NULL', 'end-next': 'n->' + O + ' = NULL', 'link-out': 'n->' + I + ' = ' + E, only: other + ' = n', 'link-in': E + '->' + O + ' = n', 'new-front': E + ' = n', 'new-back': E + ' = n', advance: E + ' = old->' + I, reset: other + ' = NULL', cut: E + '->' + O + ' = NULL' };
      if (m.wAt !== ctx.i) {
        m.wAt = ctx.i;
        if (m.wOp !== k) { m.wOp = k; m.writes = []; }
        if (LOG[tag]) m.writes.push(LOG[tag]);
      }
      const pos = new Map();
      chain.forEach((a, i) => pos.set(a, { x: i * STEP, y: 0 }));
      for (const nd of d.nodes) {
        if (pos.has(nd.addr)) continue;
        const atFront = op.end === 'front';
        if (nd.addr === c.old) pos.set(nd.addr, { x: atFront ? -STEP : len * STEP, y: 0 });
        else pos.set(nd.addr, { x: atFront ? -STEP : len * STEP, y: 0 });
      }
      const span = m.maxN * STEP;
      const items = [S.extent(-STEP - 70, -230, span + STEP + 110, 430)];
      items.push(...S.script(ops, tag === 'after' ? k + 1 : k, { x0: span / 2 - STEP / 2 - ops.length * 51 / 2, y0: -222, w: 44, label: chipOf, result: (j) => m.res[j], bad: (j) => m.res[j] === 'empty' }));
      const at = (a, dflt) => (a && pos.has(a) ? pos.get(a).x + NW / 2 - 35 : dflt);
      const rootPos = { front: { x: at(r.front, -20), y: -110 }, back: { x: at(r.back, 120), y: -110 } };
      if (r.front && r.front === r.back) { rootPos.front.x -= 42; rootPos.back.x += 42; }
      const danger = new Set();
      // a pointer that leads to the node being removed, from a node that stays: it must be cut
      if (c.old) for (const nd of d.nodes) if (nd.addr !== c.old && !nd.freed) for (const l of ['next', 'prev']) if (nd.links[l] === c.old) danger.add('a' + nd.addr + l);
      for (const name of ['front', 'back']) if (c.old && r[name] === c.old && tag !== 'hold' && tag !== 'take') danger.add('ra' + name);
      const pic = K.picture(ctx, d, {
        pos, roots: ['front', 'back'], rootPos, cursors: ['n', 'old'], nodeW: NW, links: ['next', 'prev'], written: K.written(ctx, d), hideNull: true,
        nodeCls: (nd) => (nd.addr === c.old ? 'focus' : nd.addr === c.n && !chain.includes(nd.addr) ? 'part-b' : ''),
      });
      for (const it of pic.items) if (it.kind === 'arrow' && danger.has(it.key)) it.cls += ' bad';
      items.push(...pic.items);
      if (!len && !d.nodes.length) items.push({ key: 'emptyT', kind: 'text', x: span / 2 - STEP / 2, y: 26, text: 'empty: front == NULL and back == NULL', cls: 'sk-label' + (tag === 'underflow' ? ' bad' : ''), anchor: 'middle' });
      const lx0 = span / 2 - STEP / 2 - 90;
      if (m.writes.length && tag !== 'after') {
        items.push({ key: 'wT', kind: 'text', x: lx0, y: 112, text: 'pointer writes in ' + callOf(op), cls: 'sk-title' });
        m.writes.forEach((w, j) => items.push({ key: 'w' + k + '_' + j, kind: 'text', x: lx0, y: 138 + j * 22, text: (j + 1) + '.  ' + w, cls: 'sk-eq' + (j === m.writes.length - 1 && LOG[tag] ? ' hot' : '') }));
      }
      if (danger.size && op.op === 'take') items.push({ key: 'dT', kind: 'text', x: lx0 + 260, y: 112, text: 'red: still leads to the leaving node', cls: 'sk-label bad' });
      const leavingAt = c.old && pos.get(c.old);
      const leaving = (tag === 'take' || tag === 'advance') && leavingAt ? { end: op.end, x: leavingAt.x + NW / 2, y: -40 } : null;
      items.push(...trays(m, -STEP - 40, span + 40, -40, leaving));
      const nm = (a) => K.name(d, a);
      const vals = chain.map(nm);
      const name = callOf(op);
      const inward = op.end === 'front' ? 'next' : 'prev', outward = op.end === 'front' ? 'prev' : 'next';
      let say = '';
      switch (tag) {
        case 'enter': say = name + ' is the first operation. front and back are both NULL: the deque is empty.'; break;
        case 'alloc': say = name + ': malloc makes a new node. It waits beside the ' + op.end + ' end.'; break;
        case 'fill': say = 'n->data = ' + xv + '.'; break;
        case 'end-prev': case 'end-next': say = 'n->' + outward + ' = NULL: nothing will be beyond the new node on the ' + op.end + ' side.'; break;
        case 'link-out': say = 'n->' + inward + ' = ' + op.end + ': the new node points in at the old ' + op.end + ' item' + (r[op.end] ? ', ' + nm(r[op.end]) + '.' : ', which is NULL: the deque is empty.'); break;
        case 'empty-test': say = r[op.end] ? 'The deque is not empty, so the old ' + op.end + ' node must point back out at the new one.' : 'The deque is empty: the new node will be the ' + other + ' item as well.'; break;
        case 'only': say = other + ' = n: with one item, front and back are the same node.'; break;
        case 'link-in': say = op.end + '->' + outward + ' = n: the old ' + op.end + ' node, ' + nm(r[op.end]) + ', now points out at ' + xv + '. Links go both ways, so both must be set.'; break;
        case 'new-front': case 'new-back': say = op.end + ' = n. ' + xv + ' is the new ' + (op.end === 'front' ? 'first' : 'last') + ' item, after ' + m.writes.length + ' pointer writes. In order: ' + vals.join(', ') + '.'; break;
        case 'none-test': say = r[op.end] ? name + ': the ' + op.end + ' item is ' + nm(r[op.end]) + '.' : name + ': ' + op.end + ' is NULL, so the deque is empty.'; break;
        case 'underflow': say = name + ' returns -1: nothing to take.'; break;
        case 'hold': say = 'old = ' + op.end + ': keep the address so the node can be freed later.'; break;
        case 'take': say = 'x = old->data = ' + xv + '.'; break;
        case 'advance': say = r[op.end] ? op.end + ' = old->' + inward + ': ' + op.end + ' moves in to ' + nm(r[op.end]) + '. But ' + nm(r[op.end]) + '->' + outward + ' still points at the old node (red).' : op.end + ' = old->' + inward + ', which is NULL: that was the only item. ' + other + ' still points at it (red).'; break;
        case 'last-test': say = r[op.end] ? op.end + ' is not NULL, so other items remain.' : op.end + ' is NULL: the deque is now empty.'; break;
        case 'reset': say = other + ' = NULL as well. Otherwise ' + other + ' would point at freed memory.'; break;
        case 'cut': say = op.end + '->' + outward + ' = NULL: the new ' + op.end + ' node no longer points at the node that is leaving. No pointer to it is left anywhere but old.'; break;
        case 'free': say = 'free(old): the node is gone, and nothing still points at it.'; break;
        case 'give': say = name + ' returns ' + xv + '. ' + (vals.length ? 'In order: ' + vals.join(', ') + '.' : 'The deque is empty.'); break;
        case 'after':
          if (k < ops.length - 1) say = name + ' is done. ' + (vals.length ? 'In order: ' + vals.join(', ') + '.' : 'The deque is empty.') + ' Next: ' + callOf(ops[k + 1]) + '.';
          else say = 'main is finished. ' + (vals.length ? 'The deque, first to last: ' + vals.join(', ') + '.' : 'The deque is empty.') + ' push_front and push_back are mirror images: swap front with back and next with prev, and one becomes the other.';
          break;
      }
      return { items, say, slow: tag === 'advance' || tag === 'cut' };
    },
    predict: [
      { at: (t) => t.tag === 'empty-test' && t.data.roots.front, once: true, ask: 'How many pointers will this push have written by the time it returns?', options: () => ['2', '3', '4', '5'], answer: () => '4', pick: 'option', explain: () => 'The new node\'s prev and next, the old end node\'s link to it, and front or back itself.' },
      { at: (t, i, ts) => t.tag === 'take' && ts[i + 1] && ts[i + 1].tag === 'advance' && !ts[i + 1].data.roots.front !== !ts[i + 1].data.roots.back, once: true, ask: 'This is the only node. After the next line one end pointer is NULL. What will the other one point at?', options: () => ['NULL already', 'The node about to be freed', 'The new first node'], answer: () => 'The node about to be freed', pick: 'option', explain: () => 'Only one of front and back was moved, so the other must be reset to NULL too.' },
      { at: (t, i, ts) => t.tag === 'take' && ts[i + 1] && ts[i + 1].tag === 'advance' && ts[i + 1].data.roots.front && ts[i + 1].data.roots.back, once: true, ask: 'The end pointer is about to move inwards, past this node. Which pointer will still lead to the node after that?', options: () => ['None', 'The outward link of the new end node', 'front and back both'], answer: () => 'The outward link of the new end node', pick: 'option', explain: () => 'That is why the next line sets it to NULL before free(old).' },
    ],
    quiz: [
      { q: 'Why can a doubly linked deque pop from the back in O(1), when a singly linked list cannot?', options: ['It is shorter', 'back->prev gives the node before the last at once', 'It uses an array', 'It cannot'], answer: 1, why: 'In a singly linked list, finding the node before the last means walking from the front.' },
      { q: 'How many pointers does push_front write into a non-empty deque?', options: ['2', '3', '4', '6'], answer: 2, why: 'n->prev, n->next, the old front\'s prev, and front.' },
      { q: 'What goes wrong if pop_front forgets front->prev = NULL?', options: ['Nothing', 'The new first node still points back at freed memory', 'front becomes NULL', 'The deque reverses'], answer: 1, why: 'A later walk backwards, or pop_back on the last item, would follow that dangling pointer.' },
      { q: 'Compared with the circular-array deque, the linked one...', options: ['Is never full until memory runs out, but costs two pointers and a malloc per item', 'Is always faster', 'Needs CAP', 'Cannot pop from the back'], answer: 0, why: 'No fixed capacity, at the price of extra memory and heap calls.' },
    ],
    compareWith: 'deque-array',
  });
})(SEE);
