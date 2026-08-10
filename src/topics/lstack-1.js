// Linked stacks: push and pop at the head of a singly linked list.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, S = X.StackKit, K = X.ListKit;

  X.family({
    id: 'lstack', order: 2, group: 'Stacks and queues', title: 'Linked stacks',
    blurb: 'Each item is a node on the heap. top points at the newest one, and every node points down to the one pushed before it.',
    head: `#include <stdio.h>
#include <stdlib.h>

struct node {
    int data;
    struct node *next;      /* the node below this one */
};

struct node *top = NULL;    /* the top of the stack; NULL when it is empty */`,
  });

  const NW = 112, NH = 44, STEP = 80;
  /** How many items are on the stack after each operation (for the input check) */
  const depths = (ops) => { let n = 0, mx = 0; for (const o of ops) { if (o.op === 'add') n++; else if (n) n--; mx = Math.max(mx, n); } return mx; };

  X.topic({
    id: 'stack-linked', family: 'lstack', order: 10, title: 'Push and pop',
    blurb: 'push mallocs a node and links it in above the old top; pop unhooks the top node and frees it. No capacity, no overflow: only the heap can run out.',
    code: `/* put x on top; returns 0 if memory ran out */
int push(int x)
{
    struct node *n = malloc(sizeof *n);   /*@ alloc */
    if (n == NULL)                        /*@ nomem-test */
        return 0;                         /*@ nomem */
    n->data = x;                          /*@ fill */
    n->next = top;                        /*@ link */
    top = n;                              /*@ new-top */
    return 1;                             /*@ ok */
}

/* take the top item off; returns -1 if the stack is empty */
int pop(void)
{
    struct node *old;
    int x;
    if (top == NULL)                      /*@ empty-test */
        return -1;                        /*@ underflow */
    old = top;                            /*@ hold */
    x = old->data;                        /*@ take */
    top = old->next;                      /*@ unlink */
    free(old);                            /*@ free */
    return x;                             /*@ give */
}`,
    animate: ['push', 'pop'],
    inputs: [S.opsInput('+10 +20 +30 - +40 - - - -', 'Operations (+5 pushes 5, - pops)', 10)],
    check: (inp) => (depths(S.parse(inp.ops)) > 6 ? 'At most 6 items on the stack at once, so the picture fits' : null),
    presets: [
      { label: 'Push, pop, empty', values: { ops: '+10 +20 +30 - +40 - - - -' } },
      { label: 'Last in, first out', values: { ops: '+1 +2 +3 +4 +5 - - -' } },
      { label: 'Into an empty stack', values: { ops: '+7 -' } },
      { label: 'Pop an empty stack', values: { ops: '- +9 - -' } },
    ],
    counters: ['allocs', 'frees', 'writes'],
    main: (inp) => 'int main(void)\n{\n' + S.parse(inp.ops).map((o) => (o.op === 'add' ? '    push(' + o.v + ');' : '    pop();')).join('\n') + '\n    return 0;\n}',
    capture: (P) => Object.assign(K.capture(P, { type: 'top', roots: ['top'], cursors: ['n', 'old'], fields: ['data'], links: ['next'] }), { x: P.has('x', 0) && P.isSet('x', 0) ? P.val('x', 0) : null }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const ops = S.parse(ctx.input.ops);
      const k = S.opIndex(ctx);
      const op = ops[Math.min(k, ops.length - 1)];
      const m = ctx.memo;
      if (m.maxN === undefined) m.maxN = Math.max(1, depths(ops));
      m.out = m.out || [];
      m.res = m.res || [];
      if (m.seen !== ctx.i) {
        m.seen = ctx.i;
        if (tag === 'take') m.out.push({ v: d.x });
        if (tag === 'underflow') { m.out.push({ v: -1, bad: true }); m.res[k] = 'empty'; }
        if (tag === 'ok') m.res[k] = 'ok';
        if (tag === 'give') m.res[k] = String(m.out[m.out.length - 1].v);
      }
      const xv = d.x !== null ? d.x : op && op.op === 'add' ? op.v : m.out.length ? m.out[m.out.length - 1].v : 0;
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      const chain = K.chain(d, d.roots.top).order;            // top first
      const len = chain.length;
      const yOf = (j) => (m.maxN - 1 - j) * STEP + 20;                 // j counts up from the bottom
      const pos = new Map();
      chain.forEach((a, i) => pos.set(a, { x: 0, y: yOf(len - 1 - i) }));
      // a node that is not on the stack: the new one before top points at it, or the old top being removed
      const offX = NW + 70;
      for (const n of d.nodes) {
        if (pos.has(n.addr)) continue;
        pos.set(n.addr, { x: offX, y: n.addr === d.cursors.old ? yOf(len) : yOf(len) });
      }
      const items = [S.extent(-160, -150, 590, yOf(0) + NH + 200)];
      items.push(...S.script(ops, tag === 'after' ? k + 1 : k, { x0: -110, y0: -138, result: (j) => m.res[j], bad: (j) => m.res[j] === 'empty' }));
      items.push({ key: 'ground', kind: 'line', x1: -30, y1: yOf(0) + NH + 14, x2: NW + 30, y2: yOf(0) + NH + 14, cls: 'sk-floor' + (tag === 'underflow' || (tag === 'empty-test' && !d.roots.top) ? ' bad' : '') });
      items.push({ key: 'groundT', kind: 'text', x: NW / 2, y: yOf(0) + NH + 36, text: len ? 'the bottom node points to NULL' : 'empty: top == NULL', cls: 'sk-label' + (len ? '' : ' bad'), anchor: 'middle' });
      const written = K.written(ctx, d);
      for (const n of d.nodes) {
        const p = pos.get(n.addr);
        const hot = written.get(n.addr);
        const isTop = n.addr === d.roots.top;
        items.push({
          key: 'n' + n.addr, kind: 'node', x: p.x, y: p.y, w: NW, h: NH, cells: K.cells(n, { hotCells: hot }),
          cls: n.freed ? 'freed' : isTop ? 'part-b' : '', enter: 'drop', exit: 'fall', pick: true, title: 'node at ' + X.hex(n.addr),
        });
        const to = n.links.next;
        if (to && pos.has(to)) {
          const tp = pos.get(to);
          items.push({ key: 'a' + n.addr, kind: 'arrow', from: { key: 'n' + n.addr, port: 'next' }, to: { key: 'n' + to, side: tp.x === p.x ? 'top' : 'right' }, cls: hot && hot.has('next') ? 'hot' : '' });
        }
      }
      if (d.nodes.some((n) => !chain.includes(n.addr))) items.push({ key: 'heapT', kind: 'text', x: offX + NW / 2, y: yOf(len) - 14, text: d.cursors.old && !chain.includes(d.cursors.old) ? 'off the stack' : 'new, on the heap', cls: 'sk-label', anchor: 'middle' });
      // top: a pointer box on the left with its arrow
      const topY = len ? yOf(len - 1) + 5 : yOf(0) + 5;
      const prevTop = ctx.prev && ctx.prev.data.roots ? ctx.prev.data.roots.top : d.roots.top;
      items.push({ key: 'rtop', kind: 'node', x: -150, y: topY, w: 70, h: 34, cells: [{ text: d.roots.top ? '' : 'NULL', port: 'p', cls: 'link' + (d.roots.top ? '' : ' null') + (prevTop !== d.roots.top ? ' hot' : '') }], label: 'top', cls: 'root c-indigo' });
      if (d.roots.top && pos.has(d.roots.top)) items.push({ key: 'ratop', kind: 'arrow', from: { key: 'rtop', port: 'p' }, to: { key: 'n' + d.roots.top, side: 'left' }, cls: 'root-arrow c-indigo' + (prevTop !== d.roots.top ? ' hot' : '') });
      for (const c of ['n', 'old']) {
        const v = d.cursors[c];
        if (v && pos.has(v)) items.push({ key: 'c' + c, kind: 'cursor', at: 'n' + v, side: 'right', text: c, cls: c === 'n' ? 'c-green' : 'c-rose' });
      }
      // what pop() gave back
      const trayX = offX + NW + 70;
      items.push({ key: 'trayT', kind: 'text', x: trayX, y: -60, text: 'pop() gave', cls: 'sk-title', anchor: 'middle' });
      m.out.forEach((o, j) => {
        const leaving = j === m.out.length - 1 && (tag === 'take' || tag === 'unlink');
        const from = d.cursors.old && pos.get(d.cursors.old);
        items.push({ key: 'out' + j, kind: 'token', x: leaving && from ? from.x + NW / 2 : trayX + Math.floor(j / 6) * 46, y: leaving && from ? from.y - 26 : -26 + (j % 6) * 44, r: 19, text: String(o.v), cls: (o.bad ? 'sk-bad' : 'c-teal') + ' sk-big', enter: 'fly', from: from ? { x: from.x + NW / 2, y: from.y } : { x: 0, y: yOf(0) } });
      });
      const nm = (a) => K.name(d, a);
      const vals = chain.map(nm);
      const name = op && op.op === 'add' ? 'push(' + op.v + ')' : 'pop()';
      let say = '';
      switch (tag) {
        case 'enter': say = name + ' is the first operation. top is NULL: the stack is empty, and no memory is in use yet.'; break;
        case 'alloc': say = name + ': malloc makes a new node on the heap. It is not part of the stack yet; nothing points to it but n.'; break;
        case 'nomem-test': say = 'malloc gave a real address, not NULL, so there was memory to spare. This is the only way a linked stack can be full.'; break;
        case 'nomem': say = 'malloc failed: no memory left. push() returns 0.'; break;
        case 'fill': say = 'n->data = ' + xv + '.'; break;
        case 'link': say = d.roots.top ? 'n->next = top: the new node points down at the current top, ' + nm(d.roots.top) + '. Nothing has changed for the stack yet.' : 'n->next = top, which is NULL: the new node will be the bottom of the stack.'; break;
        case 'new-top': say = 'top = n. The arrow from top swings to the new node, and ' + xv + ' is now on top. Only two pointers were written, however tall the stack is.'; break;
        case 'ok': say = 'push() returns 1. The stack, top first: ' + vals.join(', ') + '.'; break;
        case 'empty-test': say = d.roots.top ? 'pop(): top is not NULL, so there is a node to take: ' + nm(d.roots.top) + '.' : 'pop(): top is NULL, so the stack is empty.'; break;
        case 'underflow': say = 'Underflow: there is nothing to pop, so pop() returns -1.'; break;
        case 'hold': say = 'old = top: keep the address of the top node. After top moves, old is the only way to reach it and free it.'; break;
        case 'take': say = 'x = old->data = ' + xv + ': copy the value out before the node goes.'; break;
        case 'unlink': say = d.roots.top ? 'top = old->next: top drops to ' + nm(d.roots.top) + '. The old node is off the stack, but still on the heap.' : 'top = old->next, which is NULL: the stack is now empty. The old node is still on the heap.'; break;
        case 'free': say = 'free(old) gives the node\'s memory back. Without this line every pop would leak one node.'; break;
        case 'give': say = 'pop() returns ' + xv + '. ' + (len ? 'The new top is ' + nm(d.roots.top) + '.' : 'The stack is empty again.'); break;
        case 'after':
          if (k < ops.length - 1) say = name + ' is done. ' + (len ? 'The stack, top first: ' + vals.join(', ') + '.' : 'The stack is empty.') + ' Next: ' + (ops[k + 1].op === 'add' ? 'push(' + ops[k + 1].v + ')' : 'pop()') + '.';
          else say = 'main is finished. ' + (len ? 'Still on the stack, top first: ' + vals.join(', ') + ' (a real program would free these too).' : 'The stack is empty, and every node that was malloced has been freed.') + ' ' + ctx.counters.allocs + ' malloc' + (ctx.counters.allocs === 1 ? '' : 's') + ', ' + ctx.counters.frees + ' free' + (ctx.counters.frees === 1 ? '' : 's') + '.';
          break;
      }
      void by;
      return { items, say, slow: tag === 'new-top' || tag === 'unlink' };
    },
    predict: [
      { at: (t) => t.tag === 'fill' && t.data.roots.top, once: true, ask: 'n->next = top comes next. Click the node the new node will point to.', answer: (ts, i) => 'n' + ts[i].data.roots.top, explain: () => 'The old top: the new node sits on top of it.' },
      { at: (t, i, ts) => t.tag === 'take' && ts[i].data.nodes.some((n) => n.addr === ts[i].data.roots.top && n.links.next), once: true, ask: 'top = old->next is next. Click the node that becomes the new top.', answer: (ts, i) => 'n' + ts[i].data.nodes.find((n) => n.addr === ts[i].data.roots.top).links.next, explain: () => 'The node below the old top: the one pushed just before it.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'hold', once: true, ask: 'Why does pop() copy top into old before moving top?', options: () => ['To make pop faster', 'So the old node can still be freed after top moves', 'Because top cannot be read twice'], answer: () => 'So the old node can still be freed after top moves', pick: 'option', explain: () => 'Once top = old->next has run, nothing else points to the old node. Without old, its memory would be lost.' },
    ],
    quiz: [
      { q: 'In a linked stack, where does push add the new node?', options: ['At the end of the list', 'At the head, where top points', 'In the middle', 'Wherever malloc puts it in the list'], answer: 1, why: 'The head is the top: it can be reached at once, so push and pop are O(1).' },
      { q: 'When is a linked stack full?', options: ['When it reaches CAP', 'Only when malloc returns NULL', 'After 100 pushes', 'Never: it cannot be full'], answer: 1, why: 'There is no fixed array; each push asks the heap for one more node.' },
      { q: 'What happens if pop() does top = top->next but never frees the old node?', options: ['The program crashes', 'Nothing, the memory is reused', 'The node leaks: its memory is lost until the program ends', 'The value comes back'], answer: 2, why: 'Nothing points to it any more, so it can never be freed.' },
      { q: 'What does the bottom node\'s next hold?', options: ['The top', 'NULL', 'Its own address', 'The value below it'], answer: 1, why: 'It was pushed when top was NULL, and n->next = top copied that NULL.' },
      { q: 'Compared with an array stack, what does each item cost a linked stack?', options: ['Nothing extra', 'A next pointer and a malloc', 'Two arrays', 'A copy of the whole stack'], answer: 1, why: 'Each node carries a pointer as well as its value, and each push calls malloc.' },
    ],
    compareWith: 'stack-array',
  });
})(SEE);
