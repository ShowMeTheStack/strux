// Singly linked lists, part A: walking, counting, searching, and every kind of insertion and deletion.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, K = X.ListKit;
  const STEP = K.NODE_W + K.GAP, UP = -135, DOWN = 135, HEADX = -128, MID = K.NODE_W / 2;

  // ---- shared pieces ---------------------------------------------------------------------------------------
  const cap = (cursors, extra) => (P) => K.capture(P, { type: 'head', roots: ['head'], cursors, fields: ['data'], links: ['next'], extra });
  /** an int local of the newest frame, or null before it is set */
  const local = (P, name) => (P.isSet(name, 0) ? P.val(name, 0) : null);
  const nm = (d, a) => K.name(d, a);
  const chainOf = (d) => (d.roots.head ? K.chain(d, d.roots.head).order : []);
  const listText = (d) => { const c = chainOf(d); return c.length ? c.map((a) => nm(d, a)).join(' → ') : 'empty (head is NULL)'; };
  const plural = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
  const isRet = (tag) => /^(return|found|missing)/.test(tag || '');
  /** A return line is recorded after the function has gone: draw it with the state just before */
  const dataOf = (ctx) => (isRet(ctx.tick.tag) && ctx.prev ? ctx.prev.data : ctx.tick.data);
  const nodeAt = (d, a) => d.nodes.find((n) => n.addr === a) || null;
  const nextOf = (d, a) => { const n = nodeAt(d, a); return n ? n.links.next : 0; };
  const numOpts = (lo, hi) => { const o = []; for (let k = lo; k <= hi; k++) o.push(String(k)); return o; };
  const values = (max, def) => ({ id: 'values', kind: 'ints', label: 'The list', def: def || [10, 20, 30, 40], min: 0, max });

  /**
   * Where each node goes. The list from head sits on one row. A new node not linked in yet waits above
   * (over the gap it will fill, or where o.side says); with o.hold, a node that has been cut out keeps its
   * column and hangs below the row, so the gap it left and the arrow that skips it are plain to see.
   */
  function place(ctx, d, o) {
    const memo = ctx.memo, tag = ctx.tick.tag;
    const ch = chainOf(d);
    const pos = new Map();
    if (o.hold) {
      if (!memo.slot) { memo.slot = new Map(); ch.forEach((a, i) => memo.slot.set(a, i)); }
      ch.forEach((a, i) => pos.set(a, { x: (tag === 'after' || !memo.slot.has(a) ? i : memo.slot.get(a)) * STEP, y: 0 }));
    } else ch.forEach((a, i) => pos.set(a, { x: i * STEP, y: 0 }));
    for (const n of d.nodes) {
      if (pos.has(n.addr)) continue;
      if (o.hold && memo.slot.has(n.addr)) { pos.set(n.addr, { x: memo.slot.get(n.addr) * STEP, y: DOWN }); continue; }
      const s = n.links.next;
      if (!n.freed && s && pos.has(s) && pos.get(s).y === 0) { pos.set(n.addr, { x: pos.get(s).x - STEP / 2, y: UP }); continue; }
      pos.set(n.addr, { x: o.side ? o.side(d, pos) : -STEP / 2, y: UP });
    }
    return pos;
  }

  /**
   * The picture: nodes and links, the head variable as a box on the left with its arrow, the program's
   * pointer variables as tags, and a NULL spot after the last node. Returns {items, pos, nullX, inChain}.
   */
  function draw(ctx, d, o) {
    o = o || {};
    const pos = place(ctx, d, o);
    const inChain = new Set(chainOf(d));
    const wasIn = (a) => !!(o.hold && ctx.memo.slot && ctx.memo.slot.has(a));
    const fresh = (n) => !inChain.has(n.addr) && !n.freed && !wasIn(n.addr);
    const cut = (n) => !inChain.has(n.addr) && !n.freed && wasIn(n.addr);
    const pic = K.picture(ctx, d, {
      pos, roots: [], cursors: [], written: K.written(ctx, d),
      nodeCls: (n) => [fresh(n) ? 'part-b' : '', cut(n) ? 'lost' : '', o.nodeCls ? o.nodeCls(n) : ''].join(' ').trim(),
      arrowCls: (n, l) => [n.freed || cut(n) ? 'dim' : '', fresh(n) ? 'part-b' : '', o.arrowCls ? o.arrowCls(n, l) : ''].join(' ').trim(),
    });
    const items = pic.items;
    for (const it of items) {
      if (it.kind !== 'node') continue;
      const n = nodeAt(d, +it.key.slice(1));
      if (n && n.freed) it.label = 'freed';
      else if (n && cut(n)) it.label = 'cut out';
      else if (n && fresh(n)) it.label = 'new';
    }
    // the head variable
    const hv = d.roots.head;
    const pd = ctx.prev && ctx.prev.data && ctx.prev.data.roots ? ctx.prev.data.roots.head : hv;
    const moved = ctx.prev && pd !== hv;
    items.push({ key: 'rhead', kind: 'node', x: HEADX, y: 5, w: 72, h: 34, label: o.headLabel || 'head', cls: 'root c-indigo', cells: [{ text: hv === undefined ? '?' : hv ? '' : 'NULL', port: 'p', cls: 'link' + (hv ? '' : ' null') + (moved ? ' hot' : '') }] });
    if (hv && pos.has(hv)) items.push({ key: 'rahead', kind: 'arrow', from: { key: 'rhead', port: 'p' }, to: { key: 'n' + hv, side: pos.get(hv).y === 0 ? 'left' : undefined }, cls: 'root-arrow c-indigo' + (moved ? ' hot' : '') });
    // pointer variables
    const rowX = [...pos.values()].filter((p) => p.y === 0).map((p) => p.x);
    const nullX = rowX.length ? Math.max(...rowX) + K.NODE_W + 46 : 0;
    let needNull = !!o.showNull;
    const slots = new Map();
    for (const c of o.cursors || []) {
      if (!(c in d.cursors)) continue;
      const v = d.cursors[c];
      if (v === undefined) continue;
      const text = o.label ? o.label(c, v) : c;
      const cls = (o.cursorCls && o.cursorCls(c, v)) || K.cursorCls(c);
      if (v && pos.has(v)) {
        const s = slots.get(v) || 0;
        slots.set(v, s + 1);
        items.push({ key: 'c' + c, kind: 'cursor', at: 'n' + v, side: pos.get(v).y < 0 ? 'left' : 'below', slot: pos.get(v).y < 0 ? 0 : s, text, cls });
      } else if (!v) {
        needNull = true;
        const s = slots.get(0) || 0;
        slots.set(0, s + 1);
        items.push({ key: 'c' + c, kind: 'cursor', at: 'nulspot', side: 'below', slot: s, text, cls });
      }
    }
    if (needNull) {
      items.push({ key: 'nul', kind: 'text', x: nullX + 10, y: K.NODE_H / 2 + 5, text: 'NULL', cls: 'null-mark', anchor: 'middle' });
      items.push({ key: 'nulspot', kind: 'region', x: nullX - 16, y: 4, w: 52, h: K.NODE_H - 8, cls: 'null-spot' });
    }
    return { items, pos, nullX, inChain };
  }

  /** A travelling marker above the node a pointer is at (or over the NULL spot); it hops from node to node */
  function hopper(key, pic, addr, text, cls) {
    let x;
    if (addr && pic.pos.has(addr)) x = pic.pos.get(addr).x + MID;
    else if (!addr) x = pic.nullX + 10;
    else return [];
    const y = addr && pic.pos.get(addr).y < 0 ? pic.pos.get(addr).y - 30 : -34;
    return [{ key, kind: 'token', x, y, r: 16, text, cls, arc: 46 }];
  }

  /** The pointer writes an insertion needs, ticked off as they happen */
  function writes(lines, done, y) {
    const items = [{ key: 'wt', kind: 'text', x: HEADX, y, text: 'The pointer writes, in this order:', cls: 'note', size: 16 }];
    lines.forEach((l, i) => items.push({ key: 'w' + i, kind: 'text', x: HEADX + 16, y: y + 24 * (i + 1), text: (i < done ? '✓  ' : (i + 1) + '.  ') + l, cls: i < done ? 'good' : i === done ? 'hot' : '', size: 16 }));
    return items;
  }
  /** One line of commentary under the picture */
  const note = (key, text, y, cls) => ({ key, kind: 'text', x: HEADX, y, text, cls: 'note' + (cls ? ' ' + cls : ''), size: 16 });
  /** [0] [1] ... over the nodes of the row */
  const indexLabels = (pic, order) => order.filter((a) => pic.pos.has(a) && pic.pos.get(a).y === 0).map((a, i) => ({ key: 'ix' + a, kind: 'text', x: pic.pos.get(a).x + MID, y: -12, text: '[' + i + ']', cls: 'null-mark', anchor: 'middle' }));
  /** count how many ticks of a tag there are up to (and including) i */
  const countTo = (ticks, i, tag) => { let k = 0; for (let j = 0; j <= i; j++) if (ticks[j].tag === tag) k++; return k; };
  const lenOf = (ctx) => (ctx.input.values || []).length;

  // ---- traverse --------------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-traverse', family: 'sll', order: 1, title: 'Traverse and print',
    blurb: 'One pointer hops from node to node along the arrows, printing each value, until it falls off the end into NULL.',
    code: `/* visit every node from first to last, printing its value */
void print_list(struct node *head)
{
    struct node *p = head;          /*@ start */
    while (p != NULL) {             /*@ test */
        printf("%d ", p->data);     /*@ print */
        p = p->next;                /*@ follow */
    }
    printf("\\n");                   /*@ done */
}`,
    animate: ['print_list'],
    inputs: [values(8)],
    presets: [{ label: 'Four nodes', values: { values: [10, 20, 30, 40] } }, { label: 'One node', values: { values: [7] } }, { label: 'Empty list', values: { values: [] } }, { label: 'Eight nodes', values: { values: [3, 1, 4, 1, 5, 9, 2, 6] } }],
    counters: ['follows'],
    main: (inp) => X.sllMain(inp.values, 'print_list(head);'),
    capture: cap(['p']),
    scene(ctx) {
      const d = dataOf(ctx), tag = ctx.tick.tag, memo = ctx.memo;
      const p = d.cursors.p;
      memo.out = memo.out || [];
      if (tag === 'print' && p) memo.out.push({ v: nm(d, p), addr: p });
      const seen = new Set(memo.out.map((o) => o.addr));
      const was = ctx.prev && ctx.prev.data.cursors ? ctx.prev.data.cursors.p : 0;
      const pic = draw(ctx, d, {
        showNull: true,
        nodeCls: (n) => (n.addr === p ? 'focus' : seen.has(n.addr) ? 'part-a' : ''),
        arrowCls: (n) => (tag === 'follow' && n.addr === was ? 'hot' : seen.has(n.addr) && n.addr !== p ? 'part-a' : ''),
      });
      const items = pic.items;
      if (p !== undefined && tag !== 'after' && !ctx.tick.end) items.push(...hopper('tokp', pic, p, 'p', 'c-teal'));
      // the output, each value flying down from the node it came from
      items.push({ key: 'outl', kind: 'text', x: HEADX, y: 150, text: 'output:', cls: 'note' , size: 15 });
      memo.out.forEach((o, i) => {
        const at = pic.pos.get(o.addr);
        items.push({ key: 'out' + i, kind: 'cell', x: i * 58, y: 125, w: 50, h: 40, text: o.v, cls: i === memo.out.length - 1 && tag === 'print' ? 'hot' : 'part-a', enter: 'fly', from: { x: at ? at.x + 27 : 0, y: 0 } });
      });
      const n = chainOf(d).length;
      const nx = nextOf(d, p);
      let say = '';
      switch (tag) {
        case 'enter': say = n ? 'print_list() is given head, the address of the first node (' + nm(d, d.roots.head) + '). It will visit the ' + plural(n, 'node') + ' one at a time, in order.' : 'print_list() is given an empty list: head is NULL.'; break;
        case 'start': say = p ? 'p = head: p points at ' + nm(d, p) + '. Only p will move; head and the list itself stay exactly as they are.' : 'p = head, which is NULL. There is nothing to visit.'; break;
        case 'test': say = p ? 'p is not NULL (it points at ' + nm(d, p) + '), so there is a node to visit.' : 'p is NULL: it has stepped off the last node. The loop ends.'; break;
        case 'print': say = 'printf prints p->data, ' + nm(d, p) + '. Output so far: ' + memo.out.map((o) => o.v).join(' ') + '.'; break;
        case 'follow': say = p ? 'p = p->next: p hops along the arrow from ' + nm(d, was) + ' to ' + nm(d, p) + '.' : 'p = p->next: ' + nm(d, was) + ' is the last node, its next is NULL, so p becomes NULL.'; break;
        case 'done': say = memo.out.length ? 'All ' + plural(memo.out.length, 'value') + ' printed, then a newline: "' + memo.out.map((o) => o.v).join(' ') + '".' : 'Only a newline is printed: an empty list has no values.'; break;
        case 'after': say = 'Back in main, head still points at the first node: p was print_list()\'s own variable. ' + (n ? n + ' nodes took ' + plural(n, 'hop') + ' of p.' : ''); break;
        default: say = ctx.tick.end ? 'print_list() reaches its closing brace and returns. Nothing in the list was changed.' : '';
      }
      void nx;
      return { items, say };
    },
    predict: [
      { at: (t) => t.tag === 'print' && t.data.cursors.p && nextOf(t.data, t.data.cursors.p), once: true, ask: 'p = p->next is next. Click the node p will move to.', answer: (ts, i) => 'n' + nextOf(ts[i].data, ts[i].data.cursors.p), explain: () => 'p follows the arrow out of its node: the node it points at is the next one.' },
      { at: (t) => t.tag === 'start', once: true, ask: 'How many times will the test p != NULL be checked in all?', options: (ts, i, ctx) => numOpts(0, lenOf(ctx) + 2), answer: (ts, i, ctx) => String(lenOf(ctx) + 1), pick: 'option', explain: (ts, i, ctx) => 'Once for each of the ' + lenOf(ctx) + ' nodes, plus one more time when p is NULL and the loop stops.' },
    ],
    quiz: [
      { q: 'Why is the loop test p != NULL rather than p->next != NULL?', options: ['It is faster', 'With p->next != NULL the last value would never be printed', 'p->next is never NULL', 'There is no difference'], answer: 1, why: 'On the last node p->next is NULL, so that loop would stop before printing it.' },
      { q: 'After print_list(head) returns, where does head in main point?', options: ['At NULL', 'At the last node', 'At the first node, as before', 'At a copy of the list'], answer: 2, why: 'The function got a copy of head and moved its own pointer p. main\'s head is untouched.' },
      { q: 'Why not walk the list in main with head = head->next?', options: ['It does not compile', 'Once head has moved on, nothing points at the earlier nodes any more', 'It prints the values in reverse', 'It frees the nodes'], answer: 1, why: 'head is the only way into the list. Moving it loses the nodes behind it.' },
      { q: 'How many hops does p make on a list of n nodes?', options: ['1', 'n - 1', 'n', 'n * n'], answer: 2, why: 'One p = p->next per node, the last one landing on NULL.' },
    ],
  });

  // ---- count -----------------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-count', family: 'sll', order: 2, title: 'Count the nodes',
    blurb: 'A list does not know its own length. The only way to find it is to walk to the end, adding one at every node.',
    code: `/* how many nodes the list has */
int length(struct node *head)
{
    int count = 0;                  /*@ init */
    struct node *p = head;          /*@ start */
    while (p != NULL) {             /*@ test */
        count++;                    /*@ add */
        p = p->next;                /*@ follow */
    }
    return count;                   /*@ return */
}`,
    animate: ['length'],
    inputs: [values(8)],
    presets: [{ label: 'Four nodes', values: { values: [10, 20, 30, 40] } }, { label: 'One node', values: { values: [42] } }, { label: 'Empty list', values: { values: [] } }, { label: 'Seven nodes', values: { values: [5, 5, 5, 5, 5, 5, 5] } }],
    counters: ['follows'],
    main: (inp) => X.sllMain(inp.values, 'printf("%d\\n", length(head));'),
    capture: cap(['p'], (P) => ({ count: local(P, 'count') })),
    scene(ctx) {
      const d = dataOf(ctx), tag = ctx.tick.tag, memo = ctx.memo;
      const p = d.cursors.p;
      const count = d.extra ? d.extra.count : null;
      memo.stamps = memo.stamps || [];
      if (tag === 'add' && p) memo.stamps.push(p);
      if (tag === 'return' || tag === 'after') memo.result = memo.stamps.length;
      const pic = draw(ctx, d, { cursors: ['p'], showNull: tag !== 'enter', nodeCls: (n) => (n.addr === p ? 'focus' : memo.stamps.includes(n.addr) ? 'part-a' : '') });
      const items = pic.items;
      const shown = count !== null ? count : memo.result !== undefined ? memo.result : null;
      const prevCount = ctx.prev && ctx.prev.data.extra ? ctx.prev.data.extra.count : null;
      items.push({ key: 'cnt', kind: 'node', x: HEADX, y: -110, w: 72, h: 44, label: tag === 'after' ? 'length' : 'count', cls: 'root c-amber', cells: [{ text: shown === null ? '?' : shown, cls: 'val' + (tag === 'add' && prevCount !== count ? ' hot' : '') }], flash: tag === 'add' });
      // one numbered stamp per counted node, thrown from the counter
      memo.stamps.forEach((a, i) => {
        const at = pic.pos.get(a);
        if (at) items.push({ key: 'st' + a, kind: 'token', x: at.x + MID, y: -26, r: 14, text: String(i + 1), cls: 'c-amber', enter: 'fly', from: { x: HEADX + 36, y: -88 } });
      });
      const last = p && !nextOf(d, p);
      let say = '';
      switch (tag) {
        case 'enter': say = 'length() has only head to go on. Nothing in the list records how many nodes there are, so it has to count them.'; break;
        case 'init': say = 'count = 0: nothing counted yet.'; break;
        case 'start': say = p ? 'p = head: p starts at the first node, ' + nm(d, p) + '.' : 'p = head, which is NULL: an empty list.'; break;
        case 'test': say = !p ? 'p is NULL: there are no more nodes. count is final.' : last ? 'p is at ' + nm(d, p) + '. Its next is NULL, but p itself is not NULL, so this node still counts. (A loop testing p->next != NULL would stop now and be one short.)' : 'p points at a node (' + nm(d, p) + '), so count it.'; break;
        case 'add': say = 'count++: ' + nm(d, p) + ' is node number ' + count + '. It gets stamp ' + count + '.'; break;
        case 'follow': say = p ? 'p = p->next: on to ' + nm(d, p) + '.' : 'p = p->next: that was the last node, so p is now NULL.'; break;
        case 'return': say = 'return count: the list has ' + plural(memo.stamps.length, 'node') + '. Finding that out took a walk over every one of them.'; break;
        case 'after': say = 'main prints ' + memo.stamps.length + '. Each call to length() walks the whole list again; programs that need the length often keep it in a variable.'; break;
      }
      return { items, say, slow: tag === 'add' };
    },
    predict: [
      { at: (t) => t.tag === 'init', once: true, ask: 'What will length() return?', options: (ts, i, ctx) => numOpts(0, Math.max(4, lenOf(ctx) + 1)), answer: (ts, i, ctx) => String(lenOf(ctx)), pick: 'option', explain: (ts, i, ctx) => 'One count++ for each node: ' + lenOf(ctx) + '.' },
      { at: (t) => t.tag === 'add' && t.data.cursors.p && !nextOf(t.data, t.data.cursors.p), once: true, ask: 'p is on the last node. What will p be after p = p->next?', options: () => ['NULL', 'The first node', 'Still the last node'], answer: () => 'NULL', pick: 'option', explain: () => 'The last node\'s next field holds NULL, and p copies it. The next test then ends the loop.' },
    ],
    quiz: [
      { q: 'Why can a singly linked list not tell its length straight away, as an array of known size can?', options: ['Nodes are too small', 'Nothing stores the count; only walking finds the end', 'malloc hides it', 'It can, with sizeof'], answer: 1, why: 'Each node knows only its successor. The end is found by following arrows until NULL.' },
      { q: 'If the loop tested p->next != NULL instead, what would length() return for a list of 4?', options: ['3', '4', '5', 'It would crash on every list'], answer: 0, why: 'It would stop on the last node before counting it. (On an empty list it would also crash, reading NULL->next.)' },
      { q: 'What does length() return for an empty list?', options: ['-1', '0', '1', 'It crashes'], answer: 1, why: 'p starts as NULL, the loop never runs, and count stays 0.' },
      { q: 'How long does length() take on a list of n nodes?', options: ['Constant time', 'Time proportional to n', 'Time proportional to n * n', 'log n'], answer: 1, why: 'One visit per node.' },
    ],
  });

  // ---- search ----------------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-search', family: 'sll', order: 3, title: 'Search for a key',
    blurb: 'Carry the key along the list and compare it with every node in turn, until it matches or the list runs out.',
    code: `/* the first node holding key, or NULL if there is none */
struct node *search(struct node *head, int key)
{
    struct node *p = head;          /*@ start */
    while (p != NULL) {             /*@ test */
        if (p->data == key)         /*@ compare */
            return p;               /*@ found */
        p = p->next;                /*@ follow */
    }
    return NULL;                    /*@ missing */
}`,
    animate: ['search'],
    inputs: [values(8, [12, 7, 30, 25, 9]), { id: 'key', kind: 'int', label: 'Search for', def: 25, lo: -999, hi: 999 }],
    presets: [
      { label: 'Found in the middle', values: { values: [12, 7, 30, 25, 9], key: 25 } },
      { label: 'Found at the front', values: { values: [12, 7, 30, 25, 9], key: 12 } },
      { label: 'Not there', values: { values: [12, 7, 30, 25, 9], key: 40 } },
      { label: 'Empty list', values: { values: [], key: 5 } },
      { label: 'Two matches', values: { values: [4, 8, 4, 8], key: 8 } },
    ],
    counters: ['compares', 'follows'],
    main: (inp) => X.sllMain(inp.values, 'printf("%s\\n", search(head, ' + inp.key + ') != NULL ? "found" : "not found");'),
    capture: cap(['p']),
    scene(ctx) {
      const d = dataOf(ctx), tag = ctx.tick.tag, memo = ctx.memo, key = ctx.input.key;
      const p = d.cursors.p;
      memo.checked = memo.checked || [];
      if (tag === 'compare' && p) memo.checked.push(p);
      const hit = (a) => nodeAt(d, a) && nodeAt(d, a).data === key;
      const found = tag === 'found' || (tag === 'after' && memo.hit);
      if (tag === 'found') memo.hit = p;
      const pic = draw(ctx, d, {
        cursors: ['p'], showNull: tag !== 'enter',
        nodeCls: (n) => (found && n.addr === memo.hit ? 'part-a' : n.addr === p && tag !== 'after' ? 'focus' : memo.checked.includes(n.addr) ? 'ghost' : ''),
      });
      const items = pic.items;
      // the key being carried along
      if (tag !== 'after' && tag !== 'enter' && p !== undefined) items.push(...hopper('tokk', pic, found ? memo.hit : p, String(key), found ? 'c-green' : 'c-rose'));
      for (const a of memo.checked) {
        const at = pic.pos.get(a);
        if (at) items.push({ key: 'mk' + a, kind: 'text', x: at.x + MID, y: 118, text: hit(a) ? '✓ ' + key + ' = ' + nm(d, a) : '✗ ' + nm(d, a) + ' ≠ ' + key, cls: hit(a) ? 'good' : 'bad', anchor: 'middle' , size: 15 });
      }
      items.push(note('kl', 'looking for ' + key + '   ·   comparisons: ' + memo.checked.length, 170, found ? 'good' : tag === 'missing' || (tag === 'after' && !memo.hit) ? 'bad' : ''));
      const n = chainOf(d).length;
      let say = '';
      switch (tag) {
        case 'enter': say = 'search(head, ' + key + '): a list has no order and no index to jump to, so the only way is to look at the nodes one by one from the front.'; break;
        case 'start': say = p ? 'p = head: the key ' + key + ' is carried to the first node, ' + nm(d, p) + '.' : 'p = head, which is NULL: the list is empty.'; break;
        case 'test': say = p ? 'p points at ' + nm(d, p) + ', so there is a node to check.' : 'p is NULL: the list has run out without a match.'; break;
        case 'compare': say = hit(p) ? 'Is ' + nm(d, p) + ' equal to ' + key + '? Yes.' : 'Is ' + nm(d, p) + ' equal to ' + key + '? No. Move on.'; break;
        case 'found': say = 'return p: found ' + key + ' at node number ' + memo.checked.length + ', after ' + plural(memo.checked.length, 'comparison') + '. The nodes after it were never looked at.'; break;
        case 'follow': say = p ? 'p = p->next: the key moves on to ' + nm(d, p) + '.' : 'p = p->next: that was the last node, p is now NULL.'; break;
        case 'missing': say = 'return NULL: ' + key + ' is not in the list. All ' + plural(n, 'node') + ' had to be compared to be sure.'; break;
        case 'after': say = memo.hit ? 'main prints "found". A search that hits early is cheap; the worst case is the last node, or a key that is not there.' : 'main prints "not found". A failed search always costs a full walk: ' + plural(memo.checked.length, 'comparison') + ' here.'; break;
      }
      return { items, say, slow: tag === 'found' };
    },
    predict: [
      { at: (t) => t.tag === 'start', once: true, ask: (t, ts, i, ctx) => 'Will search() find ' + ctx.input.key + '?', options: () => ['Yes', 'No'], answer: (ts) => (ts.some((t) => t.tag === 'found') ? 'Yes' : 'No'), pick: 'option', explain: (ts, i, ctx) => (ts.some((t) => t.tag === 'found') ? ctx.input.key + ' is in the list, and the walk stops at its first copy.' : ctx.input.key + ' is not in the list, so p will run off the end.') },
      { at: (t) => t.tag === 'test' && t.data.cursors.p, once: true, ask: 'How many comparisons will this search make in all?', options: (ts, i, ctx) => numOpts(1, Math.max(3, lenOf(ctx))), answer: (ts) => String(ts.filter((t) => t.tag === 'compare').length), pick: 'option', explain: () => 'One per node until the first match, or one per node in the whole list when there is no match.' },
    ],
    quiz: [
      { q: 'The list holds 4 8 4 8 and you search for 8. Which node is returned?', options: ['The first 8 (second node)', 'The last 8', 'Both', 'NULL'], answer: 0, why: 'The loop returns at the first match; the rest is never looked at.' },
      { q: 'Why can a linked list not use binary search, even when it is sorted?', options: ['Its values are not numbers', 'There is no way to jump to the middle node without walking to it', 'Binary search needs duplicates', 'It can'], answer: 1, why: 'Reaching node k means following k arrows, so jumping to the middle costs as much as walking.' },
      { q: 'How many comparisons does a search for a missing key make in a list of n nodes?', options: ['0', '1', 'n / 2', 'n'], answer: 3, why: 'Every node must be ruled out before NULL is returned.' },
      { q: 'What must the caller check before using the result of search()?', options: ['That it is positive', 'That it is not NULL', 'That it is the head', 'Nothing'], answer: 1, why: 'NULL means "not found"; reading ->data through NULL would crash.' },
    ],
  });

  // ---- insert at the front ----------------------------------------------------------------------------------
  X.topic({
    id: 'sll-insert-front', family: 'sll', order: 10, title: 'Insert at the front',
    blurb: 'Make the new node, point it at the current first node, then move head. Two pointer writes, in the only safe order.',
    code: `/* put a new node holding value before the first one; returns the new head */
struct node *insert_front(struct node *head, int value)
{
    struct node *n = new_node(value);   /*@ new */
    n->next = head;                     /*@ link */
    head = n;                           /*@ head */
    return head;                        /*@ return */
}`,
    animate: ['insert_front'], quiet: ['new_node'],
    inputs: [values(7, [20, 30, 40]), { id: 'value', kind: 'int', label: 'Insert', def: 10, lo: -999, hi: 999 }],
    presets: [{ label: 'Three nodes', values: { values: [20, 30, 40], value: 10 } }, { label: 'Empty list', values: { values: [], value: 10 } }, { label: 'One node', values: { values: [5], value: 1 } }, { label: 'Seven nodes', values: { values: [2, 3, 4, 5, 6, 7, 8], value: 1 } }],
    counters: ['allocs', 'writes'],
    main: (inp) => X.sllMain(inp.values, 'head = insert_front(head, ' + inp.value + ');'),
    capture: cap(['n']),
    scene(ctx) {
      const d = dataOf(ctx), tag = ctx.tick.tag, v = ctx.input.value;
      const n = d.cursors.n;
      const pic = draw(ctx, d, { cursors: ['n'] });
      const done = { enter: 0, new: 0, link: 1, head: 2, return: 2, after: 2 }[tag] || 0;
      const items = pic.items.concat(writes(['n->next = head', 'head = n'], done, 150));
      items.push(note('cost', 'nodes walked: 0  (the same three steps for any length)', 230));
      const old = ctx.ticks[0].data.roots.head;
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert_front(head, ' + v + '): ' + (old ? v + ' has to go before ' + nm(d, old) + ', the current first node.' : 'the list is empty, so ' + v + ' will be its only node.'); break;
        case 'new': say = 'new_node(' + v + ') makes a node on the heap, off to the side. Its next is NULL and nothing points at it yet.'; break;
        case 'link': say = old ? 'First write: n->next = head. The new node now points at ' + nm(d, old) + '. head still points there too, so the list is still whole.' : 'First write: n->next = head copies NULL: the new node is also the last node.'; break;
        case 'head': say = 'Second write: head = n. The head arrow swings to ' + v + '. The list reads ' + listText(d) + '.'; break;
        case 'return': say = 'return head. This head is the function\'s own copy, so the new first node must be handed back to main.'; break;
        case 'after': say = 'main stores it: head = insert_front(head, ' + v + '). The list is ' + listText(d) + '. No node was moved and none was visited.'; break;
      }
      void n;
      return { items, say, slow: tag === 'head' };
    },
    predict: [
      { at: (t) => t.tag === 'new', once: true, ask: 'Two pointer writes are needed now. Which must come first?', options: () => ['n->next = head', 'head = n'], answer: () => 'n->next = head', pick: 'option', explain: () => 'If head = n ran first, the only pointer to the old first node would be gone, and n->next = head would make the new node point at itself.' },
      { at: (t) => t.tag === 'link', once: true, ask: 'head = n is next. Click the node head will point at.', answer: (ts, i) => 'n' + ts[i].data.cursors.n, explain: () => 'head moves to the new node, which already leads on to the rest of the list.' },
    ],
    quiz: [
      { q: 'What goes wrong with head = n; n->next = head; (the other order)?', options: ['Nothing', 'The new node points at itself and the old list is lost', 'The program does not compile', 'The new node goes at the end'], answer: 1, why: 'After head = n, head is n, so n->next = head makes a loop of one node, and nothing points at the old first node any more.' },
      { q: 'main calls insert_front(head, 5); without assigning the result. What happens?', options: ['The list gets 5 at the front', 'main\'s head is unchanged and the new node is leaked', 'The program crashes', 'The list is emptied'], answer: 1, why: 'The function changed only its copy of head. The new node points into the list, but nothing points at it.' },
      { q: 'How long does insertion at the front take on a list of 1000 nodes?', options: ['1000 steps', '500 steps', 'The same few steps as on any list', 'It depends on the value'], answer: 2, why: 'It never walks: one allocation and two pointer writes.' },
      { q: 'Inserting at the front of an empty list gives...', options: ['A crash, because head is NULL', 'A one-node list whose next is NULL', 'A node pointing at itself', 'An empty list'], answer: 1, why: 'n->next = head copies NULL, then head = n.' },
    ],
  });

  // ---- insert at the end -------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-insert-end', family: 'sll', order: 11, title: 'Insert at the end',
    blurb: 'With only a head pointer, adding at the end means walking the whole list first. Every hop is counted.',
    code: `/* add a node holding value after the last one; returns the head */
struct node *insert_end(struct node *head, int value)
{
    struct node *n = new_node(value);   /*@ new */
    struct node *p;
    if (head == NULL)                   /*@ test-empty */
        return n;                       /*@ return-new */
    p = head;                           /*@ start */
    while (p->next != NULL)             /*@ test */
        p = p->next;                    /*@ follow */
    p->next = n;                        /*@ link */
    return head;                        /*@ return */
}`,
    animate: ['insert_end'], quiet: ['new_node'],
    inputs: [values(7, [10, 20, 30, 40]), { id: 'value', kind: 'int', label: 'Insert', def: 50, lo: -999, hi: 999 }],
    presets: [{ label: 'Four nodes', values: { values: [10, 20, 30, 40], value: 50 } }, { label: 'Empty list', values: { values: [], value: 50 } }, { label: 'One node', values: { values: [10], value: 20 } }, { label: 'Seven nodes', values: { values: [1, 2, 3, 4, 5, 6, 7], value: 8 } }],
    counters: ['follows', 'allocs'],
    main: (inp) => X.sllMain(inp.values, 'head = insert_end(head, ' + inp.value + ');'),
    capture: cap(['n', 'p']),
    scene(ctx) {
      const d = dataOf(ctx), tag = ctx.tick.tag, memo = ctx.memo, v = ctx.input.value;
      const p = d.cursors.p;
      memo.hops = memo.hops || [];
      if (tag === 'follow' && ctx.prev) memo.hops.push(ctx.prev.data.cursors.p);
      const pic = draw(ctx, d, {
        cursors: ['p', 'n'],
        side: (dd, pos) => { const xs = [...pos.values()].filter((q) => q.y === 0).map((q) => q.x); return xs.length ? Math.max(...xs) + STEP : 0; },
        nodeCls: (nd) => (nd.addr === p && tag !== 'link' ? 'focus' : ''),
        arrowCls: (nd) => (memo.hops.includes(nd.addr) ? 'part-b' : ''),
      });
      const items = pic.items;
      // number the arrows the walk followed
      memo.hops.forEach((a, k) => { const at = pic.pos.get(a); if (at) items.push({ key: 'hop' + a, kind: 'text', x: at.x + K.NODE_W + K.GAP / 2, y: 4, text: 'hop ' + (k + 1), cls: 'hot', anchor: 'middle', size: 13 }); });
      const len = lenOf(ctx);
      items.push(note('cost', 'links followed to find the end: ' + memo.hops.length + (len > 1 ? '  (for ' + len + ' nodes it is always ' + (len - 1) + ')' : ''), 170, tag === 'link' || tag === 'return' ? 'hot' : ''));
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert_end(head, ' + v + '): the new node belongs after the last node, but the function only has head, the first node.'; break;
        case 'new': say = 'new_node(' + v + ') is made and waits beyond the end. Its next is already NULL, which is right for a last node.'; break;
        case 'test-empty': say = d.roots.head ? 'head is not NULL, so there is a last node somewhere, to be found.' : 'head is NULL: the list is empty, so the new node will be the whole list.'; break;
        case 'return-new': say = 'return n: the new node is the first and only node. head itself is NULL here, so only main can take the new node in.'; break;
        case 'start': say = 'p = head: the search for the last node starts at ' + nm(d, p) + '.'; break;
        case 'test': say = nextOf(d, p) ? 'p->next is not NULL, so ' + nm(d, p) + ' is not the last node. Keep walking.' : 'p->next is NULL: ' + nm(d, p) + ' is the last node. Stop here, with p on it.'; break;
        case 'follow': say = 'p = p->next: hop ' + memo.hops.length + ', to ' + nm(d, p) + '. This is work done only to find the end.'; break;
        case 'link': say = 'The one pointer write: p->next = n. ' + nm(d, p) + ' now points at ' + v + ', the new last node.'; break;
        case 'return': say = 'return head: the first node has not changed. Adding one node cost ' + plural(memo.hops.length, 'hop') + '.'; break;
        case 'after': say = !len ? 'main stores the returned node in head: the list is ' + listText(d) + '. On an empty list there was nothing to walk; the cost grows with every node added.' : 'The list is ' + listText(d) + '. Appending to n nodes walks n - 1 links; a tail pointer kept beside head would make it a single step.'; break;
      }
      return { items, say, slow: tag === 'link' };
    },
    predict: [
      { at: (t) => t.tag === 'start', once: true, ask: 'How many times will p = p->next run before p stops?', options: (ts, i, ctx) => numOpts(0, Math.max(4, lenOf(ctx))), answer: (ts) => String(ts.filter((t) => t.tag === 'follow').length), pick: 'option', explain: (ts, i, ctx) => 'p starts on the first node and must reach the last: ' + (lenOf(ctx) - 1) + ' hops for ' + lenOf(ctx) + ' nodes.' },
      { at: (t, i, ts) => t.tag === 'new' && t.data.roots.head, once: true, ask: 'Click the node whose next field will be changed.', answer: (ts) => { const l = ts.find((t) => t.tag === 'link'); return l ? 'n' + l.data.cursors.p : null; }, explain: () => 'Only the last node\'s next changes, from NULL to the new node.' },
    ],
    quiz: [
      { q: 'Why does the loop test p->next != NULL and not p != NULL here?', options: ['It is shorter', 'p must stop ON the last node, so its next can be changed', 'p != NULL would skip the first node', 'They do the same'], answer: 1, why: 'With p != NULL, p would run past the last node to NULL, and there would be no node left to link from.' },
      { q: 'Why is the empty list a special case?', options: ['malloc fails', 'There is no last node, and head itself must change', 'The new node would be lost', 'It is not special'], answer: 1, why: 'p = head would be NULL, and p->next would crash. The new node becomes the head instead.' },
      { q: 'Appending 100 values one after another to an empty list with this function costs about...', options: ['100 hops', '5,000 hops', '10,000 hops', '1 hop'], answer: 1, why: 'The k-th append walks k - 1 links: 0 + 1 + ... + 99 = 4,950.' },
      { q: 'What makes appending a constant-time operation?', options: ['A larger malloc', 'Keeping a tail pointer to the last node', 'Sorting the list', 'Inserting at the front and reversing'], answer: 1, why: 'With tail, the last node is known: tail->next = n; tail = n;.' },
    ],
  });

  // ---- insert at a position ------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-insert-pos', family: 'sll', order: 12, title: 'Insert at a position',
    blurb: 'To make the new node number pos, stop at node pos - 1, the one before the gap. Its next is the arrow that changes.',
    code: `/* insert value as node number pos (0 is the front, the length is the end); returns the head */
struct node *insert_at(struct node *head, int pos, int value)
{
    struct node *n, *p;
    int i;
    if (pos == 0) {                     /*@ test-front */
        n = new_node(value);            /*@ new */
        n->next = head;                 /*@ link */
        return n;                       /*@ return-new */
    }
    p = head;                           /*@ start */
    for (i = 0; i < pos - 1; i++)       /*@ count */
        p = p->next;                    /*@ follow */
    n = new_node(value);                /*@ new */
    n->next = p->next;                  /*@ link */
    p->next = n;                        /*@ hook */
    return head;                        /*@ return */
}`,
    animate: ['insert_at'], quiet: ['new_node'],
    inputs: [values(7, [10, 20, 30, 40]), { id: 'pos', kind: 'int', label: 'Position', def: 2, lo: 0, hi: 7 }, { id: 'value', kind: 'int', label: 'Insert', def: 25, lo: -999, hi: 999 }],
    check: (inp) => (inp.pos > inp.values.length ? 'Position: from 0 (the front) to ' + inp.values.length + ' (the end) for this list' : null),
    presets: [
      { label: 'In the middle', values: { values: [10, 20, 30, 40], pos: 2, value: 25 } },
      { label: 'At the front', values: { values: [10, 20, 30, 40], pos: 0, value: 5 } },
      { label: 'At the end', values: { values: [10, 20, 30, 40], pos: 4, value: 50 } },
      { label: 'Empty list', values: { values: [], pos: 0, value: 1 } },
    ],
    counters: ['follows', 'allocs'],
    main: (inp) => X.sllMain(inp.values, 'head = insert_at(head, ' + inp.pos + ', ' + inp.value + ');'),
    capture: cap(['p', 'n'], (P) => ({ i: local(P, 'i') })),
    scene(ctx) {
      const d = dataOf(ctx), tag = ctx.tick.tag, inp = ctx.input;
      const p = d.cursors.p, i = d.extra ? d.extra.i : null;
      const before = ctx.ticks[0].data;
      const order0 = chainOf(before);
      const placed = ['hook', 'return', 'return-new', 'after'].includes(tag) || (inp.pos === 0 && tag === 'link');
      const pic = draw(ctx, d, {
        cursors: ['p', 'n'], label: (c) => (c === 'p' && i !== null && tag !== 'start' ? 'p   i=' + i : c),
        side: () => inp.pos * STEP - STEP / 2,
        nodeCls: (nd) => (nd.addr === p && tag !== 'hook' ? 'focus' : ''),
      });
      const items = pic.items.concat(indexLabels(pic, chainOf(d)));
      if (!placed) {
        const gx = inp.pos * STEP - K.GAP / 2;
        items.push({ key: 'gap', kind: 'line', x1: gx, y1: -28, x2: gx, y2: 72, cls: 'hot' });
        items.push({ key: 'gapt', kind: 'text', x: gx, y: 104, text: 'new [' + inp.pos + '] goes here', cls: 'hot', anchor: 'middle' , size: 15 });
      }
      const done = { link: 1, hook: 2, return: 2, after: 2, 'return-new': 2 }[tag] || 0;
      items.push(...writes(inp.pos === 0 ? ['n->next = head', 'head = n  (main does this with the returned value)'] : ['n->next = p->next', 'p->next = n'], done, 160));
      const v = inp.value;
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert_at(head, ' + inp.pos + ', ' + v + '): ' + v + ' must end up as node [' + inp.pos + ']' + (inp.pos ? ', between [' + (inp.pos - 1) + '] and ' + (inp.pos < order0.length ? '[' + inp.pos + ']' : 'the end') + '.' : ', the new first node.'); break;
        case 'test-front': say = inp.pos === 0 ? 'pos is 0: there is no node before the gap, so the new node goes in front and becomes the head.' : 'pos is not 0, so there is a node before the gap. p must stop on it: node [' + (inp.pos - 1) + '].'; break;
        case 'start': say = 'p = head: p is on node [0], ' + nm(d, p) + '.'; break;
        case 'count': say = i < inp.pos - 1 ? 'i = ' + i + ' < pos - 1 = ' + (inp.pos - 1) + ': p is on [' + i + '], not yet the node before the gap. Move on.' : 'i = ' + i + ' is not less than pos - 1 = ' + (inp.pos - 1) + ': stop. p is on [' + i + '], ' + nm(d, p) + ', the node right before the gap.'; break;
        case 'follow': say = 'p = p->next: p moves to ' + nm(d, p) + '.'; break;
        case 'new': say = 'new_node(' + v + ') is made and waits above the gap. Nothing points at it yet.'; break;
        case 'link': say = inp.pos === 0 ? 'n->next = head: the new node points at ' + nm(d, d.roots.head) + '.' : 'First write: n->next = p->next. The new node points at ' + nm(d, nextOf(d, d.cursors.n)) + '. p->next still points there as well, so nothing is lost yet.'; break;
        case 'hook': say = 'Second write: p->next = n. ' + nm(d, p) + ' now leads to ' + v + ', and every node after it is now one position further on: ' + listText(d) + '.'; break;
        case 'return-new': say = 'return n: the new node is the new first node; main stores it in head.'; break;
        case 'return': say = 'return head: the first node is the same. ' + v + ' is node [' + inp.pos + '].'; break;
        case 'after': say = 'The list is ' + listText(d) + '. Reaching the node before position ' + inp.pos + ' took ' + plural(Math.max(0, inp.pos - 1), 'hop') + '.'; break;
      }
      return { items, say, slow: tag === 'hook' };
    },
    predict: [
      { at: (t, i, ts, ctx) => t.tag === 'start' && ctx.input.pos > 1, once: true, ask: (t, ts, i, ctx) => 'p has to stop on the node just before position ' + ctx.input.pos + '. Click it.', answer: (ts, i, ctx) => 'n' + K.chain(ts[0].data, ts[0].data.roots.head).order[ctx.input.pos - 1], explain: (ts, i, ctx) => 'Node [' + (ctx.input.pos - 1) + ']: its next field is the arrow the new node must take over.' },
      { at: (t) => t.tag === 'new', once: true, ask: 'The new node is ready. Which write must come first?', options: (ts, i, ctx) => (ctx.input.pos === 0 ? ['n->next = head', 'head = n'] : ['n->next = p->next', 'p->next = n']), answer: (ts, i, ctx) => (ctx.input.pos === 0 ? 'n->next = head' : 'n->next = p->next'), pick: 'option', explain: () => 'The new node must grab the rest of the list first. Overwriting the old arrow first would leave nothing pointing at the rest.' },
    ],
    quiz: [
      { q: 'To insert at position 3, p must stop on which node?', options: ['[2]', '[3]', '[4]', 'The last'], answer: 0, why: 'The node before the gap: its next field is the arrow that has to change.' },
      { q: 'With p->next = n; n->next = p->next; (wrong order), what happens?', options: ['It works', 'n points at itself and the rest of the list is lost', 'The new node goes at the end', 'It does not compile'], answer: 1, why: 'After p->next = n, p->next is n, so n->next = p->next sets n->next = n.' },
      { q: 'Why does pos == 0 need its own case?', options: ['It is faster', 'There is no node before the gap; head itself has to change', 'malloc needs it', 'It does not'], answer: 1, why: 'The pointer to change is head, not some node\'s next.' },
      { q: 'How many hops does p make to insert at position k (k > 0)?', options: ['k', 'k - 1', 'k + 1', 'Always n'], answer: 1, why: 'From node [0] to node [k - 1].' },
      { q: 'What does this function do if pos is larger than the length?', options: ['Appends', 'Follows NULL and crashes', 'Inserts at the front', 'Nothing'], answer: 1, why: 'p would become NULL inside the loop and p->next would read through NULL. The caller must keep pos in range.' },
    ],
  });

  // ---- insert after a key ------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-insert-after', family: 'sll', order: 13, title: 'Insert after a key',
    blurb: 'Find the node holding the key; everything needed is then in reach from it, because the node after it is p->next.',
    code: `/* insert value just after the first node holding key; returns 1, or 0 if key is not there */
int insert_after(struct node *head, int key, int value)
{
    struct node *p = head;                  /*@ start */
    struct node *n;
    while (p != NULL && p->data != key)     /*@ compare */
        p = p->next;                        /*@ follow */
    if (p == NULL)                          /*@ test-missing */
        return 0;                           /*@ missing */
    n = new_node(value);                    /*@ new */
    n->next = p->next;                      /*@ link */
    p->next = n;                            /*@ hook */
    return 1;                               /*@ return */
}`,
    animate: ['insert_after'], quiet: ['new_node'],
    inputs: [values(7, [10, 20, 30, 40]), { id: 'key', kind: 'int', label: 'After', def: 20, lo: -999, hi: 999 }, { id: 'value', kind: 'int', label: 'Insert', def: 25, lo: -999, hi: 999 }],
    presets: [
      { label: 'In the middle', values: { values: [10, 20, 30, 40], key: 20, value: 25 } },
      { label: 'After the last', values: { values: [10, 20, 30, 40], key: 40, value: 45 } },
      { label: 'Key missing', values: { values: [10, 20, 30, 40], key: 35, value: 99 } },
      { label: 'One node', values: { values: [8], key: 8, value: 9 } },
    ],
    counters: ['compares', 'follows', 'allocs'],
    main: (inp) => X.sllMain(inp.values, 'insert_after(head, ' + inp.key + ', ' + inp.value + ');'),
    capture: cap(['p', 'n']),
    scene(ctx) {
      const d = dataOf(ctx), tag = ctx.tick.tag, inp = ctx.input, memo = ctx.memo;
      const p = d.cursors.p, n = d.cursors.n;
      const isKey = (a) => nodeAt(d, a) && nodeAt(d, a).data === inp.key;
      memo.passed = memo.passed || [];
      if (tag === 'follow' && ctx.prev) memo.passed.push(ctx.prev.data.cursors.p);
      const anchored = p && isKey(p) && tag !== 'compare';
      const pic = draw(ctx, d, {
        cursors: ['p', 'n'],
        side: (dd, pos) => (p && pos.has(p) ? pos.get(p).x + STEP / 2 : -STEP / 2),
        nodeCls: (nd) => (nd.addr === p && anchored ? 'part-a' : nd.addr === p ? 'focus' : memo.passed.includes(nd.addr) ? 'ghost' : ''),
        arrowCls: (nd) => (anchored && nd.addr === p && tag !== 'hook' ? 'hot' : ''),
      });
      const items = pic.items;
      const searching = !['new', 'link', 'hook', 'return', 'after', 'missing', 'test-missing'].includes(tag);
      if (searching && p !== undefined && tag !== 'enter') items.push(...hopper('tokk', pic, p, String(inp.key), 'c-rose'));
      // what p reaches: the node after it, named the way the code names it
      const succ = p ? nextOf(d, p) : 0;
      if (anchored && !n && succ && pic.pos.has(succ)) items.push({ key: 'cpn', kind: 'cursor', at: 'n' + succ, side: 'below', text: 'p->next', cls: 'c-gray' });
      if (anchored) items.push(...writes(['n->next = p->next', 'p->next = n'], { link: 1, hook: 2, return: 2, after: 2 }[tag] || 0, 165));
      else items.push(note('kl', 'looking for ' + inp.key + (memo.passed.length ? '   ·   passed: ' + memo.passed.map((a) => nm(d, a)).join(', ') : ''), 165, tag === 'missing' || tag === 'test-missing' ? 'bad' : ''));
      const v = inp.value;
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert_after(head, ' + inp.key + ', ' + v + '): first find the node holding ' + inp.key + '. The new node goes straight after it.'; break;
        case 'start': say = p ? 'p = head: start at ' + nm(d, p) + '.' : 'p = head, which is NULL: the list is empty.'; break;
        case 'compare': say = !p ? 'p is NULL: the whole list was checked and ' + inp.key + ' is not in it.' : isKey(p) ? 'p->data is ' + nm(d, p) + ', the key. The loop stops with p on it.' : nm(d, p) + ' is not ' + inp.key + ', keep going.'; break;
        case 'follow': say = 'p = p->next: on to ' + nm(d, p) + '.'; break;
        case 'test-missing': say = p ? 'p is not NULL: the key was found.' : 'p is NULL: there is nowhere to insert after.'; break;
        case 'missing': say = 'return 0: ' + inp.key + ' is not in the list. Nothing was allocated and nothing changed.'; break;
        case 'new': say = 'new_node(' + v + ') waits above the gap after ' + nm(d, p) + '. Notice that p alone reaches both nodes around the gap: p and p->next.'; break;
        case 'link': say = 'First write: n->next = p->next. ' + v + ' points at ' + (nextOf(d, n) ? nm(d, nextOf(d, n)) : 'NULL (' + nm(d, p) + ' was the last node)') + '. The old arrow is still in place, so nothing is lost.'; break;
        case 'hook': say = 'Second write: p->next = n. ' + nm(d, p) + ' now leads to ' + v + ': ' + listText(d) + '.'; break;
        case 'return': say = 'return 1: inserted. head never changed, because the new node can never be the first one.'; break;
        case 'after': say = 'The list is ' + listText(d) + '. The cost was the search: ' + plural(memo.passed.length, 'hop') + '; the insertion itself is two writes.'; break;
      }
      return { items, say, slow: tag === 'hook' };
    },
    predict: [
      { at: (t) => t.tag === 'new', once: true, ask: 'Which write must come first?', options: () => ['n->next = p->next', 'p->next = n'], answer: () => 'n->next = p->next', pick: 'option', explain: () => 'p->next is the only pointer to the rest of the list. The new node must copy it before it is overwritten.' },
      { at: (t, i, ts) => t.tag === 'start' && ts.some((x) => x.tag === 'new'), once: true, ask: 'Click the node whose next field will change.', answer: (ts) => { const h = ts.find((t) => t.tag === 'hook'); return h ? 'n' + h.data.cursors.p : null; }, explain: (ts, i, ctx) => 'The node holding ' + ctx.input.key + ': its arrow is redirected to the new node.' },
    ],
    quiz: [
      { q: 'Why does insert after a key not need a pointer to the previous node?', options: ['It does need one', 'Both neighbours of the gap are p and p->next', 'The list is sorted', 'head is used instead'], answer: 1, why: 'The gap is after p, and the node on its far side is p->next, both reachable from p.' },
      { q: 'Can insert_after ever change head?', options: ['Yes, for an empty list', 'Yes, when the key is first', 'No: the new node always has a node before it', 'Only for duplicates'], answer: 2, why: 'The new node goes after an existing node, so it can never become the first.' },
      { q: 'The key is on the last node. What is n->next after the first write?', options: ['The first node', 'NULL', 'n itself', 'p'], answer: 1, why: 'p->next was NULL, and n->next copies it: n becomes the new last node.' },
      { q: 'What does the while condition p != NULL && p->data != key rely on?', options: ['Nothing special', 'That && stops before p->data when p is NULL', 'That key is positive', 'That the list is sorted'], answer: 1, why: 'Short-circuit evaluation: if p is NULL, p->data is never read.' },
    ],
  });

  // ---- insert before a key ------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-insert-before', family: 'sll', order: 14, title: 'Insert before a key',
    blurb: 'The arrow that must change belongs to the node before the key, and arrows only go forward. So prev has to trail one step behind curr.',
    code: `/* insert value just before the first node holding key; returns the head */
struct node *insert_before(struct node *head, int key, int value)
{
    struct node *prev = NULL;                       /*@ init-prev */
    struct node *curr = head;                       /*@ init-curr */
    struct node *n;
    while (curr != NULL && curr->data != key) {     /*@ compare */
        prev = curr;                                /*@ trail */
        curr = curr->next;                          /*@ follow */
    }
    if (curr == NULL)                               /*@ test-missing */
        return head;                                /*@ missing */
    n = new_node(value);                            /*@ new */
    n->next = curr;                                 /*@ link */
    if (prev == NULL)                               /*@ test-front */
        head = n;                                   /*@ head */
    else
        prev->next = n;                             /*@ hook */
    return head;                                    /*@ return */
}`,
    animate: ['insert_before'], quiet: ['new_node'],
    inputs: [values(7, [10, 20, 30, 40]), { id: 'key', kind: 'int', label: 'Before', def: 30, lo: -999, hi: 999 }, { id: 'value', kind: 'int', label: 'Insert', def: 25, lo: -999, hi: 999 }],
    presets: [
      { label: 'In the middle', values: { values: [10, 20, 30, 40], key: 30, value: 25 } },
      { label: 'Before the first', values: { values: [10, 20, 30, 40], key: 10, value: 5 } },
      { label: 'Key missing', values: { values: [10, 20, 30, 40], key: 35, value: 99 } },
      { label: 'Before the last', values: { values: [1, 2, 3, 4, 5, 6], key: 6, value: 9 } },
    ],
    counters: ['compares', 'follows', 'allocs'],
    main: (inp) => X.sllMain(inp.values, 'head = insert_before(head, ' + inp.key + ', ' + inp.value + ');'),
    capture: cap(['prev', 'curr', 'n']),
    scene(ctx) {
      const d = dataOf(ctx), tag = ctx.tick.tag, inp = ctx.input;
      const c = d.cursors;
      const isKey = (a) => nodeAt(d, a) && nodeAt(d, a).data === inp.key;
      const found = c.curr && isKey(c.curr) && !['enter', 'init-prev', 'init-curr', 'compare', 'trail', 'follow'].includes(tag);
      const linked = ['hook', 'head', 'return', 'after'].includes(tag);
      const pic = draw(ctx, d, {
        cursors: ['prev', 'curr', 'n'],
        side: (dd, pos) => (c.curr && pos.has(c.curr) ? pos.get(c.curr).x - STEP / 2 : -STEP / 2),
        nodeCls: (nd) => (nd.addr === c.curr && found ? 'part-a' : nd.addr === c.curr ? 'focus' : ''),
        // the arrow that will have to change: the one leaving prev (or head, when prev is NULL)
        arrowCls: (nd) => (!linked && c.prev && nd.addr === c.prev ? 'hot' : ''),
      });
      const items = pic.items;
      if (!linked && c.prev === 0 && c.curr) for (const it of items) if (it.key === 'rahead') it.cls += ' hot';
      // the trailing pair
      if (c.prev && c.curr && pic.pos.has(c.prev) && pic.pos.has(c.curr) && !linked && !found) {
        const a = pic.pos.get(c.prev), b = pic.pos.get(c.curr);
        if (a.y === 0 && b.y === 0) items.push({ key: 'pair', kind: 'region', x: a.x - 12, y: -30, w: b.x - a.x + K.NODE_W + 24, h: K.NODE_H + 46, cls: 'part-b', text: 'prev trails curr' });
      }
      // why prev is needed: there is no arrow back
      if (found && !c.n && c.prev && pic.pos.has(c.prev)) items.push({ key: 'noback', kind: 'arrow', from: { key: 'n' + c.curr, side: 'top' }, to: { key: 'n' + c.prev, side: 'top' }, cls: 'bad', bend: 50, label: 'no arrow back' });
      const done = { link: 1, 'test-front': 1, hook: 2, head: 2, return: 2, after: 2 }[tag] || 0;
      if (found || linked) items.push(...writes(['n->next = curr', c.prev ? 'prev->next = n' : 'head = n  (prev is NULL)'], done, 185));
      const v = inp.value;
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert_before(head, ' + inp.key + ', ' + v + '): the new node goes in front of ' + inp.key + '. The arrow that has to change is the one coming INTO ' + inp.key + '.'; break;
        case 'init-prev': say = 'prev = NULL: there is no node before the first one. prev will always be one step behind curr.'; break;
        case 'init-curr': say = c.curr ? 'curr = head: curr starts at ' + nm(d, c.curr) + '. The arrow into curr is head itself, shown hot.' : 'curr = head, which is NULL: the list is empty.'; break;
        case 'compare': say = !c.curr ? 'curr is NULL: ' + inp.key + ' is not in the list.' : isKey(c.curr) ? 'curr->data is ' + inp.key + ': found. The loop stops with prev on ' + nm(d, c.prev) + '.' : nm(d, c.curr) + ' is not ' + inp.key + '. Step both pointers forward.'; break;
        case 'trail': say = 'prev = curr: prev takes curr\'s place on ' + nm(d, c.prev) + ' before curr moves on. Its next arrow, shown hot, is the one that would change.'; break;
        case 'follow': say = 'curr = curr->next: curr moves to ' + nm(d, c.curr) + ', with prev one step behind.'; break;
        case 'test-missing': say = c.curr ? 'curr is not NULL: ' + inp.key + ' was found. The red dashed arrow shows the problem prev solves: from curr there is no way back.' : 'curr is NULL: nothing to insert before.'; break;
        case 'missing': say = 'return head: ' + inp.key + ' is not in the list, so the list is unchanged and nothing was allocated.'; break;
        case 'new': say = 'new_node(' + v + ') waits above the gap between ' + (c.prev ? nm(d, c.prev) : 'head') + ' and ' + nm(d, c.curr) + '.'; break;
        case 'link': say = 'First write: n->next = curr. ' + v + ' points at ' + nm(d, c.curr) + '.'; break;
        case 'test-front': say = c.prev ? 'prev is ' + nm(d, c.prev) + ', not NULL: the arrow to change is prev->next.' : 'prev is NULL: ' + inp.key + ' is the first node, so the arrow to change is head itself.'; break;
        case 'head': say = 'Second write: head = n. ' + v + ' is the new first node: ' + listText(d) + '.'; break;
        case 'hook': say = 'Second write: prev->next = n. ' + nm(d, c.prev) + ' now leads to ' + v + ', which leads to ' + nm(d, c.curr) + ': ' + listText(d) + '.'; break;
        case 'return': say = 'return head, which ' + (c.prev ? 'is unchanged.' : 'is now the new node; main stores it.'); break;
        case 'after': say = 'The list is ' + listText(d) + '. Inserting before a node always needs the node before it: that is what prev was for.'; break;
      }
      return { items, say, slow: tag === 'hook' || tag === 'head' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'test-missing' && t.data.cursors.curr && t.data.cursors.prev, once: true, ask: 'curr has found the key. Click the node whose next field must change.', answer: (ts, i) => 'n' + ts[i].data.cursors.prev, explain: () => 'The arrow into the key comes from the node before it, and that is the node prev is on.' },
      { at: (t) => t.tag === 'new', once: true, ask: 'Which write must come first?', options: () => ['n->next = curr', 'prev->next = n (or head = n)'], answer: () => 'n->next = curr', pick: 'option', explain: () => 'Here curr also holds the address, so the other order would not lose the list, but linking the new node first keeps the list whole after every single step.' },
    ],
    quiz: [
      { q: 'Why does inserting before a key need prev, when inserting after does not?', options: ['It does not', 'The arrow to change belongs to the node before the key, and there is no way back to it from curr', 'prev makes it faster', 'To free memory'], answer: 1, why: 'In a singly linked list arrows only point forward. The predecessor has to be remembered on the way.' },
      { q: 'When is prev still NULL after the loop?', options: ['When the key is missing', 'When the key is in the first node', 'Never', 'When the list has one node'], answer: 1, why: 'The loop did not run at all, so prev never moved. Then head must change.' },
      { q: 'What would the function do without prev = curr; inside the loop?', options: ['The same', 'prev stays NULL, so head = n would drop every node before the key', 'It would crash', 'Insert after the key'], answer: 1, why: 'It would always take the head branch, cutting off every node before the key.' },
      { q: 'Another way to insert before a node p without prev: insert a new node after p, then...', options: ['Free p', 'Swap the data of p and the new node', 'Reverse the list', 'It is impossible'], answer: 1, why: 'The new node goes after p, then the values are swapped so the new value sits in front. A known trick, though it moves data instead of nodes.' },
    ],
  });

  // ---- insert into a sorted list -------------------------------------------------------------------------------
  X.topic({
    id: 'sll-insert-sorted', family: 'sll', order: 15, title: 'Insert into a sorted list',
    blurb: 'The new node rides along above the list while p looks one node ahead, until the next value is no longer smaller.',
    code: `/* insert value into a list sorted from small to large, keeping it sorted; returns the head */
struct node *insert_sorted(struct node *head, int value)
{
    struct node *n = new_node(value);                   /*@ new */
    struct node *p;
    if (head == NULL || value < head->data) {           /*@ test-front */
        n->next = head;                                 /*@ link */
        return n;                                       /*@ return-new */
    }
    p = head;                                           /*@ start */
    while (p->next != NULL && p->next->data < value)    /*@ compare */
        p = p->next;                                    /*@ follow */
    n->next = p->next;                                  /*@ link */
    p->next = n;                                        /*@ hook */
    return head;                                        /*@ return */
}`,
    animate: ['insert_sorted'], quiet: ['new_node'],
    inputs: [{ id: 'values', kind: 'ints', label: 'The sorted list', def: [10, 20, 30, 40, 50], min: 0, max: 7, sorted: true }, { id: 'value', kind: 'int', label: 'Insert', def: 35, lo: -999, hi: 999 }],
    presets: [
      { label: 'In the middle', values: { values: [10, 20, 30, 40, 50], value: 35 } },
      { label: 'Smallest: new head', values: { values: [10, 20, 30, 40, 50], value: 5 } },
      { label: 'Largest: at the end', values: { values: [10, 20, 30, 40, 50], value: 60 } },
      { label: 'Empty list', values: { values: [], value: 7 } },
      { label: 'Equal values', values: { values: [10, 20, 20, 30], value: 20 } },
    ],
    counters: ['compares', 'follows', 'allocs'],
    main: (inp) => X.sllMain(inp.values, 'head = insert_sorted(head, ' + inp.value + ');'),
    capture: cap(['n', 'p']),
    scene(ctx) {
      const d = dataOf(ctx), tag = ctx.tick.tag, v = ctx.input.value;
      const p = d.cursors.p, n = d.cursors.n;
      const ahead = p ? nextOf(d, p) : 0;
      const val = (a) => (nodeAt(d, a) ? nodeAt(d, a).data : null);
      const pic = draw(ctx, d, {
        cursors: ['p', 'n'],
        side: (dd, pos) => (p && pos.has(p) ? pos.get(p).x + STEP / 2 : -STEP / 2),
        nodeCls: (nd) => (nd.addr === n ? '' : nd.addr === ahead && tag === 'compare' ? 'focus' : val(nd.addr) < v ? 'part-a' : ''),
      });
      const items = pic.items;
      // the comparison under the gap p is looking across
      if ((tag === 'compare' || tag === 'test-front') && pic.pos.size) {
        let x, text, ok;
        if (tag === 'test-front') { const h = d.roots.head; x = -K.GAP / 2; ok = !(h && v >= val(h)); text = h ? v + ' < ' + val(h) + '? ' + (ok ? 'yes: new head' : 'no') : 'empty list'; }
        else { x = pic.pos.get(p).x + K.NODE_W + K.GAP / 2; ok = ahead && val(ahead) < v; text = ahead ? val(ahead) + ' < ' + v + '? ' + (ok ? 'yes: go on' : 'no: stop') : 'p->next is NULL: stop'; }
        items.push({ key: 'cmp', kind: 'text', x, y: 112, text, cls: ok && tag === 'compare' ? 'good' : 'hot', anchor: 'middle' , size: 15 });
      }
      items.push(note('leg', 'green: smaller than ' + v + ', so ' + v + ' goes after them', 170, 'part-a'));
      const linking = ['link', 'hook', 'return', 'return-new', 'after'].includes(tag);
      if (linking) items.push(...writes(p ? ['n->next = p->next', 'p->next = n'] : ['n->next = head', 'head = n  (main stores the returned n)'], { link: 1, hook: 2, return: 2, 'return-new': 2, after: 2 }[tag], 205));
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert_sorted(head, ' + v + '): the list is in increasing order and must stay that way. ' + v + ' goes after every smaller value.'; break;
        case 'new': say = 'new_node(' + v + ') is made first and waits above the list.'; break;
        case 'test-front': say = !d.roots.head ? 'head is NULL: the new node becomes the whole list.' : v < val(d.roots.head) ? v + ' < ' + val(d.roots.head) + ': it is smaller than everything, so it becomes the new first node.' : v + ' is not smaller than the first value, ' + val(d.roots.head) + ', so head stays where it is.'; break;
        case 'start': say = 'p = head. p always looks one node ahead: it compares p->next->data, because p must stop on the node BEFORE the gap.'; break;
        case 'compare': say = !ahead ? 'p->next is NULL: ' + nm(d, p) + ' is the last node, so ' + v + ' goes at the end.' : val(ahead) < v ? 'p->next->data is ' + val(ahead) + ', smaller than ' + v + ': ' + v + ' goes after it. p moves on, and the new node rides along.' : 'p->next->data is ' + val(ahead) + ', not smaller than ' + v + ': the gap is between ' + nm(d, p) + ' and ' + val(ahead) + '. Stop.'; break;
        case 'follow': say = 'p = p->next: p is on ' + nm(d, p) + ' now.'; break;
        case 'link': say = p ? 'First write: n->next = p->next. ' + v + ' points at ' + (nextOf(d, n) ? nm(d, nextOf(d, n)) : 'NULL') + '.' : 'n->next = head: ' + v + ' points at ' + (d.roots.head ? nm(d, d.roots.head) : 'NULL') + '.'; break;
        case 'return-new': say = 'return n: the new node is the new first node. main stores it in head.'; break;
        case 'hook': say = 'Second write: p->next = n. ' + listText(d) + ': still in order.'; break;
        case 'return': say = 'return head: unchanged. ' + v + ' sits between ' + nm(d, p) + ' and ' + (nextOf(d, n) ? nm(d, nextOf(d, n)) : 'the end') + '.'; break;
        case 'after': say = 'The list is ' + listText(d) + '. The look-ahead p->next->data is what lets p stop on the node before the gap.'; break;
      }
      return { items, say, slow: tag === 'hook' };
    },
    predict: [
      { at: (t) => t.tag === 'new', once: true, ask: (t, ts, i, ctx) => 'Click the node ' + ctx.input.value + ' will be linked after (or the first node, if it goes in front).', answer: (ts, i, ctx) => { const h = ts.find((t) => t.tag === 'hook'); if (h) return 'n' + h.data.cursors.p; const c = K.chain(ts[0].data, ts[0].data.roots.head).order; return c.length ? 'n' + c[0] : null; }, explain: (ts, i, ctx) => 'The last node whose value is smaller than ' + ctx.input.value + '. If there is none, it goes in front.' },
      { at: (t) => t.tag === 'start', once: true, ask: 'Why does the loop compare p->next->data and not p->data?', options: () => ['It is faster', 'So p stops on the node before the gap, whose next must change', 'p->data is already known', 'To skip the first node'], answer: () => 'So p stops on the node before the gap, whose next must change', pick: 'option', explain: () => 'Comparing p->data would stop p on the first larger node, one too far: from there the arrow into it cannot be reached.' },
    ],
    quiz: [
      { q: 'Inserting 20 into 10 20 20 30 with this code puts it...', options: ['Before the first 20', 'Between the two 20s', 'After the last 20', 'At the end'], answer: 2, why: 'The loop goes on while p->next->data < 20; it stops when p->next holds 30, after both 20s.' },
      { q: 'Why test p->next != NULL before p->next->data?', options: ['Style', 'At the end p->next is NULL, and && stops before reading through it', 'To count nodes', 'It is not needed'], answer: 1, why: 'Reading NULL->data would crash; short-circuit && protects it.' },
      { q: 'Which values need the head case?', options: ['Values larger than all', 'Values smaller than the first (or any value into an empty list)', 'Duplicates', 'None'], answer: 1, why: 'Then there is no node before the gap; the new node becomes the head.' },
      { q: 'Building a sorted list by inserting n values one by one this way takes about...', options: ['n steps', 'n log n steps', 'n * n / 2 steps in the worst case', '1 step'], answer: 2, why: 'Each insertion may walk the whole list so far: like insertion sort.' },
    ],
  });

  // ---- delete the first node -------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-delete-front', family: 'sll', order: 20, title: 'Delete the first node',
    blurb: 'Hold on to the first node, move head past it, and only then free it. The order is everything.',
    code: `/* remove the first node; returns the new head */
struct node *delete_front(struct node *head)
{
    struct node *victim;
    if (head == NULL)               /*@ test-empty */
        return NULL;                /*@ return-empty */
    victim = head;                  /*@ mark */
    head = head->next;              /*@ head */
    free(victim);                   /*@ free */
    return head;                    /*@ return */
}`,
    animate: ['delete_front'],
    inputs: [values(8)],
    presets: [{ label: 'Four nodes', values: { values: [10, 20, 30, 40] } }, { label: 'One node', values: { values: [7] } }, { label: 'Empty list', values: { values: [] } }, { label: 'Two nodes', values: { values: [1, 2] } }],
    counters: ['frees', 'writes'],
    main: (inp) => X.sllMain(inp.values, 'head = delete_front(head);'),
    capture: cap(['victim']),
    scene(ctx) {
      const d = dataOf(ctx), tag = ctx.tick.tag;
      const vic = d.cursors.victim;
      const vn = vic && nodeAt(d, vic);
      const freed = vn && vn.freed;
      const pic = draw(ctx, d, { hold: true, cursors: ['victim'], label: (c) => (freed ? 'victim (dangling)' : c), cursorCls: () => (freed ? 'c-gray' : '') });
      const items = pic.items;
      if (tag === 'head' || tag === 'free') items.push(note('warn', 'Wrong order: free(head); head = head->next; reads a freed node.', 250, 'bad'));
      const old = ctx.ticks[0].data;
      let say = '';
      switch (tag) {
        case 'enter': say = old.roots.head ? 'delete_front(head): ' + nm(old, old.roots.head) + ' must go, and ' + (nextOf(old, old.roots.head) ? nm(old, nextOf(old, old.roots.head)) + ' becomes the first node.' : 'the list will be empty.') : 'delete_front(head) on an empty list.'; break;
        case 'test-empty': say = d.roots.head ? 'head is not NULL: there is a first node to remove.' : 'head is NULL: nothing to delete.'; break;
        case 'return-empty': say = 'return NULL: the list stays empty. Without this check, head->next would read through NULL.'; break;
        case 'mark': say = 'victim = head: keep the first node\'s address. In a moment head will move on, and victim will be the only way left to reach this node to free it.'; break;
        case 'head': say = d.roots.head ? 'head = head->next: the head arrow swings to ' + nm(d, d.roots.head) + '. ' + nm(d, vic) + ' is cut out; it still points into the list, but nothing points at it except victim.' : 'head = head->next, which is NULL: the head arrow now points nowhere. The list is empty.'; break;
        case 'free': say = 'free(victim): the node\'s memory goes back to the heap. victim still holds the address, a dangling pointer: reading victim->data now would be a bug, even if it seemed to work.'; break;
        case 'return': say = 'return head: ' + (d.roots.head ? nm(d, d.roots.head) + ' is the new first node.' : 'NULL, the list is now empty.'); break;
        case 'after': say = 'main stores the new head. The list is ' + listText(d) + '. Constant time: no walking at all.'; break;
      }
      return { items, say, slow: tag === 'head' || tag === 'free' };
    },
    predict: [
      { at: (t) => t.tag === 'mark', once: true, ask: 'Which must happen first?', options: () => ['head = head->next', 'free(victim)'], answer: () => 'head = head->next', pick: 'option', explain: () => 'head->next must be read while the node is still allocated. Once it is freed, its next field may hold anything.' },
      { at: (t) => t.tag === 'test-empty' && t.data.roots.head, once: true, ask: 'Click the node head will point at once the first node is removed (or the first node, if the list will be empty).', answer: (ts, i) => { const h = ts[i].data.roots.head; const nx = nextOf(ts[i].data, h); return 'n' + (nx || h); }, explain: () => 'head takes the first node\'s next: the second node, or NULL for a one-node list.' },
    ],
    quiz: [
      { q: 'What is wrong with: free(head); head = head->next;', options: ['Nothing', 'head->next is read from memory that has already been freed', 'It frees two nodes', 'It does not compile'], answer: 1, why: 'After free, the node\'s contents are no longer yours. It may seem to work and then fail at random.' },
      { q: 'What is wrong with: head = head->next; (and no free)?', options: ['Nothing', 'The old first node is never freed: a memory leak', 'The list is lost', 'It crashes'], answer: 1, why: 'Nothing points at the old node any more, so it can never be freed.' },
      { q: 'Why does main write head = delete_front(head);?', options: ['Style', 'The function cannot change main\'s head variable itself; it returns the new value', 'To free the node', 'To count nodes'], answer: 1, why: 'C passes the pointer by value. Another way is to pass &head (a struct node **).' },
      { q: 'After deleting the only node, head is...', options: ['The freed node', 'NULL', 'Unchanged', 'Itself'], answer: 1, why: 'The only node\'s next was NULL, and head takes it.' },
    ],
  });

  // ---- delete the last node -------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-delete-end', family: 'sll', order: 21, title: 'Delete the last node',
    blurb: 'The node whose arrow changes is the second-last, and the last node cannot point back to it. So p looks two nodes ahead.',
    code: `/* remove the last node; returns the head (NULL if the list becomes empty) */
struct node *delete_end(struct node *head)
{
    struct node *p, *last;
    if (head == NULL)                       /*@ test-empty */
        return NULL;                        /*@ return-empty */
    if (head->next == NULL) {               /*@ test-one */
        free(head);                         /*@ free-only */
        return NULL;                        /*@ return-empty */
    }
    p = head;                               /*@ start */
    while (p->next->next != NULL)           /*@ test */
        p = p->next;                        /*@ follow */
    last = p->next;                         /*@ mark */
    p->next = NULL;                         /*@ cut */
    free(last);                             /*@ free */
    return head;                            /*@ return */
}`,
    animate: ['delete_end'],
    inputs: [values(8)],
    presets: [{ label: 'Four nodes', values: { values: [10, 20, 30, 40] } }, { label: 'One node', values: { values: [7] } }, { label: 'Two nodes', values: { values: [1, 2] } }, { label: 'Empty list', values: { values: [] } }, { label: 'Eight nodes', values: { values: [1, 2, 3, 4, 5, 6, 7, 8] } }],
    counters: ['follows', 'frees'],
    main: (inp) => X.sllMain(inp.values, 'head = delete_end(head);'),
    capture: cap(['p', 'last']),
    scene(ctx) {
      const d = dataOf(ctx), tag = ctx.tick.tag, memo = ctx.memo;
      const c = d.cursors;
      const lastFreed = c.last && nodeAt(d, c.last) && nodeAt(d, c.last).freed;
      const p2 = c.p ? nextOf(d, nextOf(d, c.p)) : null;
      const pic = draw(ctx, d, {
        hold: true, cursors: ['p', 'last'], showNull: ['start', 'test', 'follow'].includes(tag),
        label: (nmx) => (nmx === 'last' && lastFreed ? 'last (dangling)' : nmx), cursorCls: (nmx) => (nmx === 'last' && lastFreed ? 'c-gray' : ''),
        nodeCls: (n) => (n.addr === c.p && tag !== 'after' ? 'focus' : ''),
      });
      const items = pic.items;
      // the double look-ahead: where p->next->next lands
      if ((tag === 'test' || tag === 'start' || tag === 'follow') && c.p) {
        if (p2 && pic.pos.has(p2)) items.push({ key: 'peek', kind: 'cursor', at: 'n' + p2, side: 'above', text: 'p->next->next', cls: 'c-gray' });
        else items.push({ key: 'peek', kind: 'text', x: pic.nullX + 10, y: -20, text: 'p->next->next', cls: 'hot', anchor: 'middle' , size: 15 });
      }
      const original = ctx.ticks[0].data;
      const lastNode = chainOf(original).slice(-1)[0];
      if (lastNode && pic.pos.has(lastNode) && ['start', 'test', 'follow'].includes(tag) && memo.ok !== false) items.push(note('nb', 'The last node, ' + nm(original, lastNode) + ', cannot help: it has no arrow back to the node before it.', 250));
      let say = '';
      switch (tag) {
        case 'enter': say = 'delete_end(head): to remove the last node, the second-last node\'s next must become NULL. Finding that node is the real job.'; break;
        case 'test-empty': say = d.roots.head ? 'head is not NULL.' : 'head is NULL: there is nothing to delete.'; break;
        case 'return-empty': say = d.roots.head ? 'return NULL: the list is now empty; main stores NULL in head.' : 'return NULL: the list stays empty.'; break;
        case 'test-one': say = nextOf(d, d.roots.head) ? 'head->next is not NULL: there are at least two nodes, so there is a second-last node.' : 'head->next is NULL: the only node is also the last. There is no second-last node; head itself must become NULL.'; break;
        case 'free-only': say = 'free(head): the only node is freed. head still holds its address (dangling) until the function returns NULL.'; break;
        case 'start': say = 'p = head. p must stop on the second-last node, so the loop looks two nodes ahead: p->next->next.'; break;
        case 'test': say = p2 ? 'p->next->next is ' + nm(d, p2) + ', not NULL: ' + nm(d, c.p) + ' is not the second-last node yet.' : 'p->next->next is NULL: ' + nm(d, nextOf(d, c.p)) + ' is the last node, so p, on ' + nm(d, c.p) + ', is the second-last. Stop.'; break;
        case 'follow': say = 'p = p->next: p moves to ' + nm(d, c.p) + '.'; break;
        case 'mark': say = 'last = p->next: keep the last node\'s address, ' + nm(d, c.last) + ', so it can still be freed after it is unlinked.'; break;
        case 'cut': say = 'p->next = NULL: ' + nm(d, c.p) + ' is the new end of the list. ' + nm(d, c.last) + ' hangs below, reachable only through last.'; break;
        case 'free': say = 'free(last): the old last node is gone. last is now a dangling pointer and must not be used.'; break;
        case 'return': say = 'return head: the first node is unchanged.'; break;
        case 'after': say = chainOf(original).length <= 1 ? 'main stores the result: head is NULL and the list is empty. With one node (or none), head itself is what changes.' : 'The list is ' + listText(d) + '. Removing the last node walked the whole list; with only next arrows there is no shortcut, even with a tail pointer.'; break;
      }
      return { items, say, slow: tag === 'cut' || tag === 'free' || tag === 'free-only' };
    },
    predict: [
      { at: (t) => t.tag === 'start', once: true, ask: 'Click the node p must stop on.', answer: (ts) => { const m = ts.find((t) => t.tag === 'mark'); return m ? 'n' + m.data.cursors.p : null; }, explain: () => 'The second-last node: it is the one whose next field must become NULL.' },
      { at: (t) => t.tag === 'mark', once: true, ask: 'Which comes next, safely?', options: () => ['p->next = NULL, then free(last)', 'free(p->next), and nothing else', 'free(p), then p->next = NULL'], answer: () => 'p->next = NULL, then free(last)', pick: 'option', explain: () => 'Freeing p->next alone would leave p->next dangling: the list would still lead into freed memory.' },
    ],
    quiz: [
      { q: 'Why does deleting the last node need the second-last node?', options: ['To copy its value', 'Its next field must become NULL, and the last node cannot point back to it', 'free needs it', 'It does not'], answer: 1, why: 'The change is made in the node before the one removed.' },
      { q: 'Does a tail pointer make deleting the last node fast in a singly linked list?', options: ['Yes, constant time', 'No: tail must move back to the second-last node, which still has to be found by walking', 'Only for short lists', 'Yes, if the list is sorted'], answer: 1, why: 'A doubly linked list (with prev arrows) solves this.' },
      { q: 'What happens with free(p->next); but no p->next = NULL;?', options: ['Nothing bad', 'The list ends in a dangling pointer; the next walk reads freed memory', 'The whole list is freed', 'p is freed'], answer: 1, why: 'p->next still holds the freed address.' },
      { q: 'Why is the one-node list a special case?', options: ['There is no second-last node; head must become NULL', 'malloc fails', 'p->next->next is fine', 'It is not'], answer: 0, why: 'p->next->next would read through NULL, and the pointer to change is head.' },
    ],
  });

  // ---- delete at a position --------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-delete-pos', family: 'sll', order: 22, title: 'Delete at a position',
    blurb: 'Stop on node pos - 1, swing its arrow over the victim to the node after it, then free the victim hanging below.',
    code: `/* remove node number pos (0 is the front); returns the head */
struct node *delete_at(struct node *head, int pos)
{
    struct node *p, *victim;
    int i;
    if (pos == 0) {                         /*@ test-front */
        victim = head;                      /*@ mark */
        head = head->next;                  /*@ head */
        free(victim);                       /*@ free */
        return head;                        /*@ return */
    }
    p = head;                               /*@ start */
    for (i = 0; i < pos - 1; i++)           /*@ count */
        p = p->next;                        /*@ follow */
    victim = p->next;                       /*@ mark */
    p->next = victim->next;                 /*@ bypass */
    free(victim);                           /*@ free */
    return head;                            /*@ return */
}`,
    animate: ['delete_at'],
    inputs: [values(8, [10, 20, 30, 40, 50]), { id: 'pos', kind: 'int', label: 'Position', def: 2, lo: 0, hi: 7 }],
    check: (inp) => (!inp.values.length ? 'The list: give at least one value to delete' : inp.pos >= inp.values.length ? 'Position: from 0 to ' + (inp.values.length - 1) + ' for this list' : null),
    presets: [
      { label: 'In the middle', values: { values: [10, 20, 30, 40, 50], pos: 2 } },
      { label: 'The first', values: { values: [10, 20, 30, 40, 50], pos: 0 } },
      { label: 'The last', values: { values: [10, 20, 30, 40, 50], pos: 4 } },
      { label: 'The only node', values: { values: [9], pos: 0 } },
    ],
    counters: ['follows', 'frees'],
    main: (inp) => X.sllMain(inp.values, 'head = delete_at(head, ' + inp.pos + ');'),
    capture: cap(['p', 'victim'], (P) => ({ i: local(P, 'i') })),
    scene(ctx) {
      const d = dataOf(ctx), tag = ctx.tick.tag, inp = ctx.input;
      const c = d.cursors, i = d.extra ? d.extra.i : null;
      const vn = c.victim && nodeAt(d, c.victim);
      const freed = vn && vn.freed;
      const pic = draw(ctx, d, {
        hold: true, cursors: ['p', 'victim'],
        label: (x) => (x === 'victim' && freed ? 'victim (dangling)' : x === 'p' && i !== null && tag !== 'start' ? 'p   i=' + i : x),
        cursorCls: (x) => (x === 'victim' && freed ? 'c-gray' : ''),
        nodeCls: (n) => (n.addr === c.p && tag !== 'after' ? 'focus' : ''),
      });
      const items = pic.items;
      // the arrow that jumps over the victim arches over its empty column
      for (const it of items) {
        if (it.kind !== 'arrow' || !/^a\d+next$/.test(it.key)) continue;
        const from = pic.pos.get(+it.key.slice(1, -4)), to = it.to && it.to.key ? pic.pos.get(+it.to.key.slice(1)) : null;
        if (from && to && from.y === 0 && to.y === 0 && to.x - from.x > STEP + 1) { it.bend = -40; it.label = 'bypass'; }
      }
      // index labels from the list as it was, until it closes up
      const order = tag === 'after' ? chainOf(d) : chainOf(ctx.ticks[0].data);
      for (const [k, a] of order.entries()) if (pic.pos.has(a) && pic.pos.get(a).y === 0) { const at = pic.pos.get(a); items.push({ key: 'ix' + a, kind: 'text', x: at.x + MID, y: at.y - 12, text: '[' + k + ']', cls: 'null-mark', anchor: 'middle' }); }
      const target = chainOf(ctx.ticks[0].data)[inp.pos];
      if (target && pic.pos.has(target) && !c.victim && tag !== 'after') items.push({ key: 'tgt', kind: 'text', x: pic.pos.get(target).x + MID, y: -34, text: 'to delete', cls: 'bad', anchor: 'middle' , size: 15 });
      if (tag === 'bypass' || tag === 'free') items.push(note('warn', 'Wrong order: free(p->next); p->next = p->next->next; reads the freed node.', 260, 'bad'));
      const old = ctx.ticks[0].data;
      let say = '';
      switch (tag) {
        case 'enter': say = 'delete_at(head, ' + inp.pos + '): node [' + inp.pos + '], ' + nm(old, target) + ', must go. ' + (inp.pos ? 'The arrow that changes is the one leaving node [' + (inp.pos - 1) + '].' : 'It is the first node, so head changes.'); break;
        case 'test-front': say = inp.pos === 0 ? 'pos is 0: the node to remove is the first, and the pointer to change is head.' : 'pos is not 0: p must stop on node [' + (inp.pos - 1) + '], the node before the victim.'; break;
        case 'start': say = 'p = head: p is on [0], ' + nm(d, c.p) + '.'; break;
        case 'count': say = i < inp.pos - 1 ? 'i = ' + i + ' < pos - 1 = ' + (inp.pos - 1) + ': keep going.' : 'i = ' + i + ' reaches pos - 1: p is on [' + i + '], ' + nm(d, c.p) + ', right before the victim.'; break;
        case 'follow': say = 'p = p->next: p moves to ' + nm(d, c.p) + '.'; break;
        case 'mark': say = 'victim = ' + (inp.pos ? 'p->next' : 'head') + ': keep the address of ' + nm(d, c.victim) + '. After the next line, this will be the only pointer to it.'; break;
        case 'head': say = 'head = head->next: the head arrow swings past ' + nm(d, c.victim) + (d.roots.head ? ' to ' + nm(d, d.roots.head) + '.' : ' to NULL: the list is empty.') + ' The victim hangs below.'; break;
        case 'bypass': say = 'p->next = victim->next: ' + nm(d, c.p) + '\'s arrow swings over the victim to ' + (nextOf(d, c.p) ? nm(d, nextOf(d, c.p)) : 'NULL') + '. ' + nm(d, c.victim) + ' is cut out but still allocated.'; break;
        case 'free': say = 'free(victim): ' + nm(d, c.victim) + '\'s memory is released. victim now dangles; the gap closes when the function returns.'; break;
        case 'return': say = 'return head' + (inp.pos ? ': unchanged.' : ': the new first node.'); break;
        case 'after': say = 'The list is ' + listText(d) + '. Every node after the removed one is now one position lower.'; break;
      }
      return { items, say, slow: tag === 'bypass' || tag === 'head' || tag === 'free' };
    },
    predict: [
      { at: (t, i, ts, ctx) => t.tag === 'start', once: true, ask: (t, ts, i, ctx) => 'To delete node [' + ctx.input.pos + '], p must stop on which node? Click it.', answer: (ts, i, ctx) => 'n' + K.chain(ts[0].data, ts[0].data.roots.head).order[ctx.input.pos - 1], explain: (ts, i, ctx) => 'Node [' + (ctx.input.pos - 1) + ']: its next is the arrow that has to skip the victim.' },
      { at: (t) => t.tag === 'mark', once: true, ask: 'After the arrow is moved past the victim, what must happen to the victim?', options: () => ['Nothing, it disappears on its own', 'free(victim)', 'victim->next = NULL is enough'], answer: () => 'free(victim)', pick: 'option', explain: () => 'C has no garbage collector. Without free, the node is a leak: unreachable but still allocated.' },
    ],
    quiz: [
      { q: 'To delete node [3], p stops on...', options: ['[2]', '[3]', '[4]', 'head'], answer: 0, why: 'The node before the victim owns the arrow that must skip it.' },
      { q: 'Why save victim = p->next before p->next = victim->next?', options: ['Style', 'After the bypass, nothing else points at the victim, so it could not be freed', 'To make it faster', 'To count nodes'], answer: 1, why: 'victim is the last handle on the node.' },
      { q: 'Deleting [0] differs because...', options: ['It is slower', 'head, not a node\'s next, must change', 'It needs two frees', 'It does not differ'], answer: 1, why: 'There is no node before the first one.' },
      { q: 'After free(victim), what is victim->next?', options: ['NULL', 'The next node', 'Undefined: the memory is no longer the program\'s', 'victim'], answer: 2, why: 'Reading freed memory is undefined behaviour, even if it seems to work.' },
    ],
  });

  // ---- delete by key -----------------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-delete-key', family: 'sll', order: 23, title: 'Delete a key',
    blurb: 'prev and curr walk together, comparing as they go. When curr finds the key, prev\'s arrow (or head) jumps over it, then curr is freed.',
    code: `/* remove the first node holding key; returns the head */
struct node *delete_key(struct node *head, int key)
{
    struct node *prev = NULL;                       /*@ init-prev */
    struct node *curr = head;                       /*@ init-curr */
    while (curr != NULL && curr->data != key) {     /*@ compare */
        prev = curr;                                /*@ trail */
        curr = curr->next;                          /*@ follow */
    }
    if (curr == NULL)                               /*@ test-missing */
        return head;                                /*@ missing */
    if (prev == NULL)                               /*@ test-front */
        head = curr->next;                          /*@ head */
    else
        prev->next = curr->next;                    /*@ bypass */
    free(curr);                                     /*@ free */
    return head;                                    /*@ return */
}`,
    animate: ['delete_key'],
    inputs: [values(8, [10, 20, 30, 40, 50]), { id: 'key', kind: 'int', label: 'Delete', def: 30, lo: -999, hi: 999 }],
    presets: [
      { label: 'In the middle', values: { values: [10, 20, 30, 40, 50], key: 30 } },
      { label: 'The first node', values: { values: [10, 20, 30, 40, 50], key: 10 } },
      { label: 'Not there', values: { values: [10, 20, 30, 40, 50], key: 35 } },
      { label: 'The only node', values: { values: [8], key: 8 } },
      { label: 'Duplicates', values: { values: [5, 7, 5, 7], key: 7 } },
    ],
    counters: ['compares', 'follows', 'frees'],
    main: (inp) => X.sllMain(inp.values, 'head = delete_key(head, ' + inp.key + ');'),
    capture: cap(['prev', 'curr']),
    scene(ctx) {
      const d = dataOf(ctx), tag = ctx.tick.tag, inp = ctx.input, memo = ctx.memo;
      const c = d.cursors;
      const isKey = (a) => nodeAt(d, a) && nodeAt(d, a).data === inp.key;
      memo.checked = memo.checked || [];
      if (tag === 'compare' && c.curr) memo.checked.push(c.curr);
      const freed = c.curr && nodeAt(d, c.curr) && nodeAt(d, c.curr).freed;
      const pic = draw(ctx, d, {
        hold: true, cursors: ['prev', 'curr'],
        label: (x) => (x === 'curr' && freed ? 'curr (dangling)' : x), cursorCls: (x) => (x === 'curr' && freed ? 'c-gray' : ''),
        nodeCls: (n) => (n.addr === c.curr && isKey(n.addr) && !n.freed && tag !== 'after' ? 'focus' : ''),
      });
      const items = pic.items;
      for (const it of items) {
        if (it.kind !== 'arrow' || !/^a\d+next$/.test(it.key)) continue;
        const from = pic.pos.get(+it.key.slice(1, -4)), to = it.to && it.to.key ? pic.pos.get(+it.to.key.slice(1)) : null;
        if (from && to && from.y === 0 && to.y === 0 && to.x - from.x > STEP + 1) { it.bend = -40; it.label = 'bypass'; }
      }
      // a verdict under every node compared (they move down with a node that is cut out)
      for (const a of memo.checked) {
        const at = pic.pos.get(a);
        if (!at || at.y !== 0 || tag === 'after') continue;
        const ok = nodeAt(d, a) && nodeAt(d, a).data === inp.key;
        items.push({ key: 'mk' + a, kind: 'text', x: at.x + MID, y: -14, text: ok ? '= ' + inp.key : '≠ ' + inp.key, cls: ok ? 'bad' : 'good', anchor: 'middle' });
      }
      if (tag === 'free' || tag === 'bypass' || tag === 'head') items.push(note('warn', 'Classic mistake: free(curr) first, then prev->next = curr->next reads the freed node.', 270, 'bad'));
      let say = '';
      switch (tag) {
        case 'enter': say = 'delete_key(head, ' + inp.key + '): find the first node holding ' + inp.key + ', unlink it, free it. Unlinking needs the node before it, so prev comes along.'; break;
        case 'init-prev': say = 'prev = NULL: nothing comes before the first node.'; break;
        case 'init-curr': say = c.curr ? 'curr = head: curr starts at ' + nm(d, c.curr) + '.' : 'curr = head, which is NULL: an empty list.'; break;
        case 'compare': say = !c.curr ? 'curr is NULL: ' + inp.key + ' is not in the list.' : isKey(c.curr) ? 'curr->data is ' + inp.key + ': this is the node to delete. prev is on ' + nm(d, c.prev) + '.' : nm(d, c.curr) + ' ≠ ' + inp.key + ': step on.'; break;
        case 'trail': say = 'prev = curr: prev moves up to ' + nm(d, c.prev) + '.'; break;
        case 'follow': say = 'curr = curr->next: curr moves to ' + nm(d, c.curr) + '.'; break;
        case 'test-missing': say = c.curr ? 'curr is not NULL: found it.' : 'curr is NULL: nothing to delete.'; break;
        case 'missing': say = 'return head: ' + inp.key + ' is not in the list, which is left exactly as it was.'; break;
        case 'test-front': say = c.prev ? 'prev is ' + nm(d, c.prev) + ': the arrow to change is prev->next.' : 'prev is NULL: the key is in the first node, so head itself must skip it.'; break;
        case 'head': say = 'head = curr->next: the head arrow jumps past ' + nm(d, c.curr) + (d.roots.head ? ' to ' + nm(d, d.roots.head) + '.' : '. The list is now empty.') + ' The cut-out node drops below.'; break;
        case 'bypass': say = 'prev->next = curr->next: ' + nm(d, c.prev) + '\'s arrow jumps over ' + nm(d, c.curr) + ' to ' + (nextOf(d, c.prev) ? nm(d, nextOf(d, c.prev)) : 'NULL') + '. The node is out of the list but not yet freed.'; break;
        case 'free': say = 'free(curr): the node is gone. curr is left dangling; nothing may read curr->data or curr->next now.'; break;
        case 'return': say = 'return head.'; break;
        case 'after': say = 'The list is ' + listText(d) + '. ' + (memo.checked.length ? plural(memo.checked.length, 'comparison') + ' to find the key; the unlinking itself was one write.' : ''); break;
      }
      return { items, say, slow: tag === 'bypass' || tag === 'head' || tag === 'free' };
    },
    predict: [
      { at: (t) => t.tag === 'init-curr' && t.data.cursors.curr, once: true, ask: 'Which pointer will be changed to unlink the node?', options: () => ['head', 'the next field of the node before it', 'nothing: the key is not there'], answer: (ts) => (ts.some((t) => t.tag === 'head') ? 'head' : ts.some((t) => t.tag === 'bypass') ? 'the next field of the node before it' : 'nothing: the key is not there'), pick: 'option', explain: () => 'If the key is in the first node, head skips it; otherwise the node before it does; if it is missing, nothing changes.' },
      { at: (t) => t.tag === 'test-missing' && t.data.cursors.curr, once: true, ask: 'Which line must run before free(curr)?', options: () => ['The unlink (prev->next or head = curr->next)', 'curr = NULL', 'prev = curr'], answer: () => 'The unlink (prev->next or head = curr->next)', pick: 'option', explain: () => 'The unlink reads curr->next. After free, curr->next is no longer valid.' },
    ],
    quiz: [
      { q: 'In 5 7 5 7, delete_key(head, 7) removes...', options: ['Both 7s', 'The first 7', 'The last 7', 'Nothing'], answer: 1, why: 'The loop stops at the first match.' },
      { q: 'When does delete_key change head?', options: ['Always', 'When the key is in the first node', 'When the key is missing', 'When the key is last'], answer: 1, why: 'Then prev is NULL and there is no node before it to change.' },
      { q: 'What is wrong with: free(curr); prev->next = curr->next;', options: ['Nothing', 'curr->next is read after the node was freed', 'prev is freed', 'It leaks the node'], answer: 1, why: 'Use after free: the read may return garbage or crash.' },
      { q: 'What is wrong with: prev->next = curr->next; (with no free)?', options: ['The list is broken', 'The node is leaked: unreachable but still allocated', 'It frees prev', 'Nothing'], answer: 1, why: 'The list is correct, but the memory is never returned.' },
      { q: 'Deleting the last node with this function: what does prev->next become?', options: ['curr', 'NULL', 'head', 'prev'], answer: 1, why: 'curr->next was NULL, and prev->next copies it: prev is the new last node.' },
    ],
  });
})(SEE);
