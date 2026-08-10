// Stacks in an array: push and pop on a fixed array with a top index.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, S = X.StackKit;

  X.family({
    id: 'astack', order: 1, group: 'Stacks and queues', title: 'Stacks in an array',
    blurb: 'A fixed array and one index, top. Everything happens at the top: the last item in is the first one out.',
    head: (t, inp) => `#include <stdio.h>

#define CAP ${inp.cap}

int items[CAP];
int top = -1;       /* index of the top item; -1 when the stack is empty */`,
  });

  const H = 46, G = 6, W = 96;

  X.topic({
    id: 'stack-array', family: 'astack', order: 10, title: 'Push and pop',
    blurb: 'push moves top up one slot and writes there; pop reads the top slot and moves top down. A full array means overflow, an empty one underflow.',
    code: `/* put x on top; returns 0 if there is no room (overflow) */
int push(int x)
{
    if (top == CAP - 1)        /*@ full-test */
        return 0;              /*@ overflow */
    top++;                     /*@ up */
    items[top] = x;            /*@ store */
    return 1;                  /*@ ok */
}

/* take the top item off; returns -1 if there is none (underflow) */
int pop(void)
{
    int x;
    if (top == -1)             /*@ empty-test */
        return -1;             /*@ underflow */
    x = items[top];            /*@ take */
    top--;                     /*@ down */
    return x;                  /*@ give */
}`,
    animate: ['push', 'pop'],
    inputs: [S.opsInput('+10 +20 +30 - +40 +50 +60 - - - - -', 'Operations (+5 pushes 5, - pops)'), { id: 'cap', kind: 'int', label: 'Capacity', def: 4, lo: 1, hi: 8 }],
    presets: [
      { label: 'Overflow and underflow', values: { ops: '+10 +20 +30 - +40 +50 +60 - - - - -', cap: 4 } },
      { label: 'Last in, first out', values: { ops: '+1 +2 +3 +4 - - - -', cap: 4 } },
      { label: 'Popped values stay behind', values: { ops: '+11 +22 +33 - - +44', cap: 4 } },
      { label: 'Pop an empty stack', values: { ops: '- +9 - -', cap: 3 } },
    ],
    counters: ['writes'],
    main: (inp) => 'int main(void)\n{\n' + S.parse(inp.ops).map((o) => (o.op === 'add' ? '    push(' + o.v + ');' : '    pop();')).join('\n') + '\n    return 0;\n}',
    capture(P) {
      const cap = P.ev('CAP');
      return { items: P.arr('items', cap), top: P.val('top'), x: P.has('x', 0) && P.isSet('x', 0) ? P.val('x', 0) : null, fn: P.frames[0].name, cap };
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, cap = d.cap, top = d.top;
      const ops = S.parse(ctx.input.ops);
      const k = S.opIndex(ctx);
      const op = ops[Math.min(k, ops.length - 1)];
      const m = ctx.memo;
      m.gen = m.gen || new Array(cap).fill(0);
      m.used = m.used || new Array(cap).fill(false);
      m.out = m.out || [];
      m.res = m.res || [];
      if (m.seen !== ctx.i) {
        m.seen = ctx.i;
        if (tag === 'store') { m.gen[top]++; m.used[top] = true; }
        if (tag === 'take') m.out.push({ v: d.x, from: top });
        if (tag === 'underflow') { m.out.push({ v: -1, bad: true, from: -1 }); m.res[k] = 'empty'; }
        if (tag === 'overflow') m.res[k] = 'full';
        if (tag === 'ok') m.res[k] = 'ok';
        if (tag === 'give') m.res[k] = String(m.out[m.out.length - 1].v);
      }
      // the value being pushed or popped (x is gone from memory once the function has returned)
      const xv = d.x !== null ? d.x : op && op.op === 'add' ? op.v : m.out.length ? m.out[m.out.length - 1].v : 0;
      const yOf = (i) => (cap - 1 - i) * (H + G);
      const bottom = cap * (H + G) - G;
      const items = [S.extent(-90, -130, 560, bottom + 220)];
      items.push(...S.script(ops, ctx.tick.tag === 'after' ? k + 1 : k, { x0: -40, y0: -118, result: (j) => m.res[j], bad: (j) => m.res[j] === 'full' || m.res[j] === 'empty' }));
      // the array, standing on end: slot 0 at the bottom
      for (let i = 0; i < cap; i++) {
        items.push({ key: 'slot' + i, kind: 'region', x: 0, y: yOf(i), w: W, h: H, cls: 'sk-slot' });
        items.push({ key: 'ix' + i, kind: 'text', x: -12, y: yOf(i) + H / 2 + 5, text: '[' + i + ']', cls: 'sk-idx', anchor: 'end' });
      }
      const fullNow = tag === 'overflow' || (tag === 'full-test' && top === cap - 1);
      const emptyNow = tag === 'underflow' || (tag === 'empty-test' && top === -1);
      items.push({ key: 'ceil', kind: 'line', x1: -26, y1: -10, x2: W + 26, y2: -10, cls: 'sk-ceiling' + (fullNow ? ' bad' : '') });
      items.push({ key: 'ceilT', kind: 'text', x: W + 32, y: -5, text: fullNow ? 'full: top == CAP - 1' : 'CAP = ' + cap, cls: 'sk-label' + (fullNow ? ' bad' : '') });
      items.push({ key: 'floor', kind: 'line', x1: -26, y1: bottom + 8, x2: W + 26, y2: bottom + 8, cls: 'sk-floor' + (emptyNow ? ' bad' : '') });
      items.push({ key: 'floorT', kind: 'text', x: W / 2, y: bottom + 30, text: emptyNow ? 'empty: top == -1' : 'items[' + cap + ']', cls: 'sk-label' + (emptyNow ? ' bad' : ''), anchor: 'middle' });
      // the values: live ones up to top, and old ones above it that pop() left behind
      const inX = W + 150;
      for (let i = 0; i < cap; i++) {
        if (!m.used[i]) continue;
        const live = i <= top;
        const fresh = tag === 'store' && i === top;
        items.push({
          key: 'v' + i + '_' + m.gen[i], kind: 'cell', x: 0, y: yOf(i), w: W, h: H, text: d.items[i], sub: '',
          cls: (live ? 'sk-live' : 'sk-garbage') + (live && i === top ? ' sk-top' : ''), enter: fresh ? 'fly' : 'fade', from: { x: inX - W / 2, y: yOf(i) }, flash: fresh, pick: true,
        });
      }
      // top: an arrow at its slot, or below the floor when it is -1
      const ty = top >= 0 ? yOf(top) + H / 2 : bottom + 56;
      if (top < 0) items.push({ key: 'minus1', kind: 'region', x: W / 2 - 22, y: bottom + 40, w: 44, h: 30, cls: 'sk-null' }, { key: 'minus1t', kind: 'text', x: W / 2, y: bottom + 60, text: '-1', cls: 'sk-null', anchor: 'middle' });
      items.push({ key: 'ctop', kind: 'cursor', x: top >= 0 ? W + 4 : W / 2 + 24, y: ty, tx: top >= 0 ? W + 62 : W / 2 + 78, ty, text: 'top = ' + top, cls: 'c-indigo' });
      // the value on its way in (push) or out (pop)
      if (op && op.op === 'add' && ['enter', 'full-test', 'overflow', 'up'].includes(tag)) {
        const dest = Math.min(cap - 1, top + (tag === 'up' ? 0 : 1));
        // on overflow it lands on the lid, right above the full pile
        const y = fullNow ? -40 : yOf(dest) + H / 2, x = fullNow ? W / 2 : inX;
        items.push({ key: 'in' + k, kind: 'token', x, y, r: 21, text: String(xv), cls: (fullNow ? 'sk-bad' : 'c-green') + ' sk-big', enter: 'fly', from: { x: inX + 60, y } });
        items.push({ key: 'inT', kind: 'text', x: x + 30, y: y + 5, text: fullNow ? 'no room' : 'x', cls: 'sk-label' + (fullNow ? ' bad' : '') });
      }
      // what pop() gave back, newest at the bottom of the tray
      const trayX = inX + 120;
      items.push({ key: 'trayT', kind: 'text', x: trayX, y: -40, text: 'pop() gave', cls: 'sk-title', anchor: 'middle' });
      m.out.forEach((o, j) => {
        const leaving = j === m.out.length - 1 && d.fn === 'pop' && (tag === 'take' || tag === 'down');
        const y = leaving ? (o.from >= 0 ? yOf(o.from) + H / 2 : bottom) : -8 + (j % 6) * 44;
        items.push({ key: 'out' + j, kind: 'token', x: leaving ? inX : trayX + Math.floor(j / 6) * 46, y, r: 19, text: String(o.v), cls: (o.bad ? 'sk-bad' : 'c-teal') + ' sk-big', enter: 'fly', from: { x: W / 2, y: o.from >= 0 ? yOf(o.from) + H / 2 : bottom } });
      });
      const live = d.items.slice(0, top + 1);
      const name = op && op.op === 'add' ? 'push(' + op.v + ')' : 'pop()';
      let say = '';
      switch (tag) {
        case 'enter': say = name + ' is the first operation. The stack starts empty, so top is -1: there is no top item yet.'; break;
        case 'full-test': say = top === cap - 1 ? name + ': top is ' + top + ', the last slot (CAP - 1). There is nowhere above it.' : name + ': top is ' + top + ', below CAP - 1 = ' + (cap - 1) + ', so there is room above.'; break;
        case 'overflow': say = 'Overflow. push() refuses and returns 0; ' + xv + ' is not stored anywhere. A fixed array cannot grow.'; break;
        case 'up': say = 'top moves up one slot, to ' + top + '. That slot is where the new item goes.'; break;
        case 'store': say = 'items[' + top + '] = ' + xv + '. The new item sits on top of ' + (top ? 'the ' + top + ' below it' : 'nothing: it is the only one') + '.'; break;
        case 'ok': say = 'push() returns 1. The stack, bottom to top: ' + live.join(', ') + '.'; break;
        case 'empty-test': say = top === -1 ? 'pop(): top is -1, so there is nothing to take.' : 'pop(): top is ' + top + ', so there is an item to take, and only one choice: items[' + top + '] = ' + d.items[top] + '.'; break;
        case 'underflow': say = 'Underflow. pop() returns -1 to say the stack was empty. (A real program must not mistake that -1 for a value.)'; break;
        case 'take': say = 'x = items[' + top + '] = ' + xv + ': the item pushed most recently.'; break;
        case 'down': say = 'top moves down to ' + top + '. ' + xv + ' is still in items[' + (top + 1) + '], but it is above top, so it no longer counts: it is garbage, and the next push will write over it.'; break;
        case 'give': say = 'pop() returns ' + xv + '. ' + (top >= 0 ? 'The new top is items[' + top + '] = ' + d.items[top] + '.' : 'The stack is empty again.'); break;
        case 'after': {
          if (k < ops.length - 1) { say = name + ' is done. ' + (live.length ? 'The stack, bottom to top: ' + live.join(', ') + '.' : 'The stack is empty.') + ' Next: ' + (ops[k + 1].op === 'add' ? 'push(' + ops[k + 1].v + ')' : 'pop()') + '.'; break; }
          const outs = m.out.filter((o) => !o.bad).map((o) => o.v);
          say = 'main is finished. ' + (live.length ? 'Left on the stack, bottom to top: ' + live.join(', ') + '. ' : 'The stack is empty. ') + (outs.length ? 'The pops gave ' + outs.join(', ') + ': each time, whatever had arrived last.' : '');
          break;
        }
      }
      return { items, say, slow: tag === 'overflow' || tag === 'underflow' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'full-test' && ts[i + 1].data.top === ts[i + 1].data.cap - 1, once: true, ask: (t, ts, i) => 'push(' + ts[i + 1].data.x + ') is next, and top is already CAP - 1 = ' + (ts[i + 1].data.cap - 1) + '. What will it do?', options: () => ['It goes into items[CAP]', 'It overwrites the top item', 'push() refuses: overflow'], answer: () => 'push() refuses: overflow', pick: 'option', explain: () => 'top == CAP - 1, so push() returns 0 without writing anything.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'empty-test' && ts[i + 1].data.top >= 1, once: true, ask: 'pop() is next. Click the value it will return.', answer: (ts, i, ctx) => { const d = ts[i].data; let g = 0; for (let j = 0; j <= i; j++) if (ts[j].tag === 'store' && ts[j].data.top === d.top) g++; void ctx; return 'v' + d.top + '_' + g; }, explain: () => 'Only the top item can come out: the one pushed last.' },
      { at: (t, i, ts) => t.tag === 'take' && ts[i + 1] && ts[i + 1].tag === 'down', once: true, ask: 'top is about to move down by one. What will the slot just above top hold then?', options: () => ['Nothing: pop() cleared it', 'The value that was popped, still there', 'A zero'], answer: () => 'The value that was popped, still there', pick: 'option', explain: () => 'pop() only moves top. The old value stays in the array until a push writes over it.' },
    ],
    quiz: [
      { q: 'CAP is 5 and the stack is full. What is top?', options: ['5', '4', '0', '-1'], answer: 1, why: 'The slots are 0 to 4, and top is the index of the top item: CAP - 1 = 4.' },
      { q: 'You push 1, 2, 3, then pop twice. What do the pops return?', options: ['1 then 2', '3 then 2', '2 then 3', '3 then 1'], answer: 1, why: 'Last in, first out: 3 was pushed last, so it comes out first, then 2.' },
      { q: 'After a pop, the old value is still in the array. Why is that not a problem?', options: ['It is a problem', 'Everything above top is ignored, and the next push writes over it', 'C clears it later', 'pop() sets it to 0'], answer: 1, why: 'Only items[0..top] are part of the stack; the rest is just leftover memory.' },
      { q: 'How long do push and pop take on a stack of n items?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n) for pop only'], answer: 2, why: 'Each one moves top by one and touches one slot, however many items are below.' },
      { q: 'Why does top start at -1 rather than 0?', options: ['C arrays start at -1', 'top is the index of the top item, and there is no item yet', 'To save memory', 'It must be negative to compile'], answer: 1, why: 'With one item, top is 0. With none, it must be one less: -1.' },
    ],
  });
})(SEE);
