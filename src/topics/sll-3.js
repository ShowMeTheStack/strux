// Singly linked lists, part B: two-pointer walks (k-th from the end, middle, split), recursive and group
// reversal, rotation, merging, Floyd's cycle detection and removal, duplicates, intersection, palindrome.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, K = X.ListKit, L = X.SllB;
  const S = L.STEP, W = L.W, H = L.H;
  const nth = (k) => k + (k % 100 >= 11 && k % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][k % 10] || 'th');
  const capWith = (cursors, extra, roots, type) => (P) => topOf(P, K.capture(P, { type: type || 'head', roots: roots || ['head'], cursors, fields: ['data'], links: ['next'], extra }));
  // which function the newest frame belongs to: a return line is recorded after its function has gone
  const topOf = (P, o) => { const f = P.frames.find((x) => !x.system); o.top = f ? f.name : ''; return o; };
  // a return line is recorded after the function has gone, so its pointers are read from the tick before
  const curs = (ctx) => { for (let j = ctx.i; j >= 0; j--) { const t = ctx.ticks[j].data; if (t.top !== 'main' && t.cursors) return t.cursors; } return {}; };
  const intOr = (P, name) => (P.has(name, 0) && P.isSet(name, 0) ? P.val(name, 0) : null);

  // ---- k-th node from the end ----------------------------------------------------------------------------
  X.topic({
    id: 'sll-kth-end', family: 'sll', order: 30, title: 'K-th node from the end',
    blurb: 'Send one pointer k nodes ahead, then walk both together: when the leader falls off the end, the trailer is k from the end.',
    code: `/* the node k places from the end (k = 1 is the last), or NULL if the list is too short */
struct node *kth_from_end(struct node *head, int k)
{
    struct node *lead = head;              /*@ init-lead */
    struct node *trail = head;             /*@ init-trail */
    int i;
    for (i = 0; i < k; i++) {              /*@ ahead-test */
        if (lead == NULL)                  /*@ short-test */
            return NULL;                   /*@ too-short */
        lead = lead->next;                 /*@ step-lead */
    }
    while (lead != NULL) {                 /*@ walk-test */
        lead = lead->next;                 /*@ step-both */
        trail = trail->next;               /*@ step-trail */
    }
    return trail;                          /*@ found */
}`,
    animate: ['kth_from_end'],
    inputs: [Object.assign({}, X.sllValues, { def: [10, 20, 30, 40, 50, 60], max: 8 }), { id: 'k', kind: 'int', label: 'k', def: 2, lo: 1, hi: 9 }],
    presets: [
      { label: '2nd from the end', values: { values: [10, 20, 30, 40, 50, 60], k: 2 } },
      { label: 'k = 1: the last node', values: { values: [5, 8, 13, 21], k: 1 } },
      { label: 'k = length: the first', values: { values: [7, 14, 21, 28, 35], k: 5 } },
      { label: 'List too short', values: { values: [4, 9, 16], k: 5 } },
    ],
    counters: ['follows'],
    main: (inp) => X.sllMain(inp.values, 'kth_from_end(head, ' + inp.k + ');'),
    capture: capWith(['lead', 'trail'], (P) => ({ i: intOr(P, 'i') })),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, k = ctx.input.k, n = ctx.input.values.length;
      const pos = L.fixed(ctx, d, ctx.ticks[0].data.roots.head);
      const c = curs(ctx);
      const order = ctx.memo['sllb-fixed:list'];
      const idx = (a) => (a ? order.indexOf(a) : n);
      const nullAt = { x: n * S, y: 0 };
      const ended = tag === 'found' || tag === 'after';
      const res = ended ? c.trail : null;
      const items = L.nodes(ctx, d, pos, {
        cls: (nd) => (ended && nd.addr === res ? 'sb-found' : ended && res && idx(nd.addr) > idx(res) ? 'part-b' : '') + (ended && res ? ' sb-lbl' : ''),
        label: (nd) => (ended && res ? (n - idx(nd.addr)) + ' from end' : ''),
      }).concat(L.links(ctx, d, pos));
      if (tag !== 'after') items.push(...L.tags(pos, [{ name: 'trail', addr: c.trail, cls: 'c-teal' }, { name: 'lead', addr: c.lead, cls: 'c-amber' }], { nullAt }));
      // the gap between the two pointers, drawn as a bracket under them
      if (c.trail && c.lead !== undefined && tag !== 'after') {
        const gap = idx(c.lead) - idx(c.trail);
        const x1 = idx(c.trail) * S + W / 2, x2 = idx(c.lead) * S + (c.lead ? W / 2 : 48);
        if (gap > 0) items.push(...L.bracket('gap', x1, x2, H + 84, 'gap = ' + L.plural(gap, 'link'), gap === k ? 'sb-violet' : 'sb-amber'));
      }
      if (tag === 'after' && res) {
        items.push({ key: 'cres', kind: 'cursor', at: 'n' + res, side: 'below', text: 'returned', cls: 'c-green' });
        items.push(...L.bracket('last', idx(res) * S, (n - 1) * S + W, H + 84, 'the last ' + L.plural(k, 'node'), 'sb-good'));
      }
      const phase = ['init-lead', 'init-trail', 'ahead-test', 'short-test', 'too-short', 'step-lead'].includes(tag) ? 'Phase 1: lead goes ' + k + ' ahead' : ['walk-test', 'step-both', 'step-trail'].includes(tag) ? 'Phase 2: both walk, the gap stays ' + k : '';
      if (phase) items.push({ key: 'phase', kind: 'text', x: 0, y: -40, text: phase, cls: 'sb-phase' });
      const nm = (a) => L.nm(d, a);
      const i = d.extra.i;
      let say = '';
      switch (tag) {
        case 'enter': say = 'kth_from_end(head, ' + k + ') on ' + (n ? L.seq(d, d.roots.head) : 'an empty list') + '. The list does not know its own length, and we want to walk it only once.'; break;
        case 'init-lead': say = 'lead starts at the first node' + (c.lead ? ', ' + nm(c.lead) : ' (NULL: the list is empty)') + '. It will be sent ahead as a scout.'; break;
        case 'init-trail': say = 'trail also starts at the first node. The idea: put exactly ' + k + ' links between them, then move them together.'; break;
        case 'ahead-test': say = i < k ? 'lead has taken ' + L.plural(i, 'step') + ' of ' + k + '; it needs ' + (k - i) + ' more.' : 'lead is now ' + k + ' links ahead of trail. Phase 1 is over.'; break;
        case 'short-test': say = c.lead ? 'lead is at ' + nm(c.lead) + ', so it can take another step.' : 'lead is NULL before it could get ' + k + ' ahead: the list has only ' + L.plural(n, 'node') + '.'; break;
        case 'too-short': say = 'There is no ' + nth(k) + ' node from the end in a list of ' + n + ', so the answer is NULL.'; break;
        case 'step-lead': say = 'lead = lead->next: lead moves on to ' + nm(c.lead) + '. trail stays put, so the gap grows to ' + L.plural(i + 1, 'link') + '.'; break;
        case 'walk-test': say = c.lead ? 'lead is at ' + nm(c.lead) + ', not NULL: both move one more step.' : 'lead has fallen off the end. trail is still ' + k + ' links behind it, so trail is the ' + nth(k) + ' node from the end: ' + nm(c.trail) + '.'; break;
        case 'step-both': say = 'lead moves to ' + (c.lead ? nm(c.lead) : 'NULL') + '...'; break;
        case 'step-trail': say = '...and trail moves to ' + nm(c.trail) + '. The bracket slides along the list without changing size: still ' + L.plural(k, 'link') + '.'; break;
        case 'found': say = 'Return trail, the node holding ' + nm(c.trail) + ': the ' + nth(k) + ' from the end, found in a single pass.'; break;
        case 'after': say = res ? 'kth_from_end returned ' + nm(res) + '. The labels show each node\'s place counted from the end. lead walked ' + n + ' links and trail ' + (n - k) + ', with no second pass to count the length.' : 'kth_from_end returned NULL: a list of ' + n + ' has no ' + nth(k) + ' node from the end.'; break;
      }
      return { items, say, slow: tag === 'found' || tag === 'too-short' };
    },
    predict: [
      { at: (t) => t.tag === 'init-trail', once: true, ask: (t, ts, i, ctx) => 'Where will lead be when phase 1 ends (after ' + ctx.input.k + ' steps)? Click that node.', answer: (ts) => { const t = ts.find((x) => x.tag === 'walk-test'); return t && t.data.cursors.lead ? 'n' + t.data.cursors.lead : null; }, explain: (ts, i, ctx) => 'Each step moves lead one node, so it ends ' + ctx.input.k + ' nodes after the first.' },
      { at: (t) => t.tag === 'walk-test' && t.data.cursors.lead, once: true, ask: 'Click the node trail will be on when the walk stops.', answer: (ts) => { const j = ts.findIndex((x) => x.tag === 'found'); return j > 0 && ts[j - 1].data.cursors.trail ? 'n' + ts[j - 1].data.cursors.trail : null; }, explain: (ts, i, ctx) => 'When lead reaches NULL, trail is ' + ctx.input.k + ' links behind NULL: the ' + nth(ctx.input.k) + ' node from the end.' },
    ],
    quiz: [
      { q: 'Why does lead go k nodes ahead first?', options: ['To count the list', 'So that when lead reaches NULL, trail is exactly k from the end', 'To check the list is sorted', 'To find the middle'], answer: 1, why: 'The gap of k links never changes in phase 2, and the end of the list is NULL, so trail stops k from it.' },
      { q: 'In a list of 6 nodes, how many steps does trail take when k = 2?', options: ['2', '4', '6', '8'], answer: 1, why: 'lead takes 2 alone, then 4 more with trail until it reaches NULL (6 in all). trail takes those 4.' },
      { q: 'A different method first counts the length n, then walks n - k steps. What does the two-pointer way save?', options: ['Memory', 'A second pass over the list', 'Comparisons of values', 'Nothing at all'], answer: 1, why: 'Both use O(1) memory, but counting first means walking the list twice; the two pointers do it in one pass.' },
      { q: 'What does kth_from_end return with k = 5 on a list of 3 nodes?', options: ['The first node', 'The last node', 'NULL', 'It crashes'], answer: 2, why: 'lead becomes NULL before it is 5 ahead; the check inside the first loop catches it and returns NULL.' },
      { q: 'With k equal to the length of the list, which node is returned?', options: ['The last', 'The first', 'NULL', 'The middle'], answer: 1, why: 'lead reaches NULL in phase 1 exactly as the loop ends, phase 2 does nothing, and trail is still at the first node.' },
    ],
  });
  // slow and fast move as hops over the row: fast's arc spans two links, slow's one
  const hopsFor = (ctx, c, pos) => {
    const items = [];
    const pc = ctx.prev && ctx.prev.data.cursors ? ctx.prev.data.cursors : {};
    const tag = ctx.tick.tag;
    if (tag === 'step-slow' && pc.slow && c.slow && pc.slow !== c.slow && pos.has(pc.slow)) items.push(L.hop('hop-slow', 'n' + pc.slow, 'n' + c.slow, { cls: 'sb-teal', height: 50, label: '1 step' }));
    if (tag === 'step-fast' && pc.fast && c.fast !== undefined && pc.fast !== c.fast && pos.has(pc.fast)) items.push(L.hop('hop-fast', 'n' + pc.fast, c.fast ? 'n' + c.fast : 'sllb-null', { cls: 'sb-rose', height: 100, label: '2 steps' }));
    return items;
  };
  const countTags = (ctx, tag) => ctx.ticks.slice(0, ctx.i + 1).filter((t) => t.tag === tag).length;

  // ---- middle node: slow and fast ------------------------------------------------------------------------
  X.topic({
    id: 'sll-middle', family: 'sll', order: 31, title: 'Middle node (slow and fast)',
    blurb: 'slow moves one node at a time, fast two. When fast runs out of list, slow has covered half the distance: it is in the middle.',
    code: `/* the middle node (the second of the two middles when the length is even) */
struct node *middle(struct node *head)
{
    struct node *slow = head;                          /*@ init-slow */
    struct node *fast = head;                          /*@ init-fast */
    while (fast != NULL && fast->next != NULL) {       /*@ test */
        slow = slow->next;                             /*@ step-slow */
        fast = fast->next->next;                       /*@ step-fast */
    }
    return slow;                                       /*@ found */
}`,
    animate: ['middle'],
    inputs: [Object.assign({}, X.sllValues, { def: [3, 1, 4, 1, 5], max: 8 })],
    presets: [
      { label: 'Odd length (5)', values: { values: [3, 1, 4, 1, 5] } },
      { label: 'Even length (6)', values: { values: [10, 20, 30, 40, 50, 60] } },
      { label: 'Two nodes', values: { values: [8, 9] } },
      { label: 'One node', values: { values: [42] } },
      { label: 'Empty list', values: { values: [] } },
    ],
    counters: ['follows'],
    main: (inp) => X.sllMain(inp.values, 'middle(head);'),
    capture: capWith(['slow', 'fast']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, n = ctx.input.values.length;
      const pos = L.fixed(ctx, d, ctx.ticks[0].data.roots.head);
      const order = ctx.memo['sllb-fixed:list'];
      const idx = (a) => (a ? order.indexOf(a) : n);
      const c = curs(ctx);
      const ended = tag === 'found' || tag === 'after';
      const mid = ended ? c.slow : null;
      const items = L.nodes(ctx, d, pos, { cls: (nd) => (mid && nd.addr === mid ? 'sb-found' : '') }).concat(L.links(ctx, d, pos));
      if (tag !== 'after') items.push(...L.tags(pos, [{ name: 'slow', addr: c.slow }, { name: 'fast', addr: c.fast }], { nullAt: { x: n * S, y: 0 } }));
      items.push(...hopsFor(ctx, c, pos));
      const ss = countTags(ctx, 'step-slow'), fs = countTags(ctx, 'step-fast');
      if (n) items.push({ key: 'steps', kind: 'text', x: 0, y: -118, text: 'slow has moved ' + L.plural(ss, 'link') + ', fast ' + L.plural(fs * 2, 'link'), cls: 'sb-note' });
      if (mid) {
        const m = idx(mid);
        if (m > 0) items.push(...L.bracket('before', 0, (m - 1) * S + W, H + 84, L.plural(m, 'node') + ' before', 'sb-teal'));
        if (m < n - 1) items.push(...L.bracket('after', (m + 1) * S, (n - 1) * S + W, H + 84, L.plural(n - 1 - m, 'node') + ' after', 'sb-teal'));
        if (tag === 'after') items.push({ key: 'cmid', kind: 'cursor', at: 'n' + mid, side: 'below', text: 'middle', cls: 'c-green' });
      }
      const nm = (a) => L.nm(d, a);
      const fn = c.fast ? d.nodes.find((x) => x.addr === c.fast) : null;
      let say = '';
      switch (tag) {
        case 'enter': say = n ? 'middle(head) on ' + L.seq(d, d.roots.head) + ': ' + L.plural(n, 'node') + ', but the function does not know that. It finds the middle in one pass without counting.' : 'middle(head) on an empty list: head is NULL.'; break;
        case 'init-slow': say = 'slow starts at the first node' + (c.slow ? ', ' + nm(c.slow) : ' (NULL)') + '. It will move one link at a time.'; break;
        case 'init-fast': say = 'fast starts there too. It will move two links at a time, so it is always twice as far along as slow.'; break;
        case 'test': say = !c.fast ? 'fast is NULL: it ran off the end. Stop; slow, at ' + nm(c.slow) + ', is in the middle.' : !fn.links.next ? 'fast is at ' + nm(c.fast) + ', the last node: there is no room for two more steps. Stop; slow, at ' + nm(c.slow) + ', is in the middle.' : 'fast is at ' + nm(c.fast) + ' and there is a node after it, so fast can jump again.'; break;
        case 'step-slow': say = 'slow = slow->next: one link, to ' + nm(c.slow) + '.'; break;
        case 'step-fast': say = 'fast = fast->next->next: two links in one go, to ' + (c.fast ? nm(c.fast) : 'NULL (past the end)') + '. fast has now moved ' + fs * 2 + ' links, slow ' + ss + '.'; break;
        case 'found': say = c.slow ? 'Return slow: ' + nm(c.slow) + ', node ' + (idx(c.slow) + 1) + ' of ' + n + '.' + (n % 2 === 0 && n ? ' With an even length there are two middles; this loop stops at the second.' : '') : 'Return slow, which is NULL: an empty list has no middle.'; break;
        case 'after': say = mid ? 'middle() returned ' + nm(mid) + ' after ' + L.plural(ss, 'step') + ' of slow. fast did the counting for it: when fast had covered the whole list, slow had covered half.' : 'middle() returned NULL for the empty list.'; break;
      }
      return { items, say, slow: tag === 'found' };
    },
    predict: [
      { at: (t) => t.tag === 'init-fast' && t.data.cursors.slow, once: true, ask: 'Click the node slow will stop on.', answer: (ts) => { const t = ts.find((x) => x.tag === 'found'); const c = ts[ts.indexOf(t) - 1].data.cursors; return c.slow ? 'n' + c.slow : null; }, explain: () => 'slow stops when fast cannot make another double step; by then slow has gone half as far as fast.' },
      { at: (t, i, ts) => t.tag === 'step-slow' && ts[i + 1] && ts[i + 1].data.cursors.fast, once: true, ask: 'fast = fast->next->next is next. Click the node fast lands on.', answer: (ts, i) => 'n' + ts[i + 1].data.cursors.fast, explain: () => 'Two links on from where fast is now: it skips the node in between.' },
    ],
    quiz: [
      { q: 'After slow has taken s steps, how far along is fast?', options: ['s links', '2s links', 's + 2 links', 's squared'], answer: 1, why: 'Every round moves slow one link and fast two, so fast is always twice as far along.' },
      { q: 'In the list 10 20 30 40 50 60, which node does middle() return?', options: ['30', '40', '20', '50'], answer: 1, why: 'With an even length there are two middles (30 and 40). This loop stops when fast is NULL, with slow on the second one, 40.' },
      { q: 'Why does the loop test fast->next != NULL as well as fast != NULL?', options: ['To stop at the first middle', 'Because fast->next->next would read through a NULL pointer otherwise', 'It is not needed', 'To skip the last node'], answer: 1, why: 'fast jumps two links. If fast is the last node, fast->next is NULL and fast->next->next would dereference NULL.' },
      { q: 'How many times is the list walked to find its middle this way?', options: ['Twice: once to count, once to walk', 'Once (by fast); slow covers half of it', 'n squared times', 'Not at all'], answer: 1, why: 'fast covers the list once and slow half of it, at the same time. There is no separate counting pass.' },
    ],
  });

  // ---- split into two halves --------------------------------------------------------------------------------
  X.topic({
    id: 'sll-split', family: 'sll', order: 44, title: 'Split into two halves',
    blurb: 'The step merge sort needs: slow and fast find the end of the first half, and one pointer set to NULL cuts the list in two.',
    code: `/* cut the list after its middle: head keeps the first half, the second half is returned */
struct node *split(struct node *head)
{
    struct node *slow, *fast, *second;
    if (head == NULL)                                  /*@ empty */
        return NULL;                                   /*@ none */
    slow = head;                                       /*@ init-slow */
    fast = head->next;                                 /*@ init-fast */
    while (fast != NULL && fast->next != NULL) {       /*@ test */
        slow = slow->next;                             /*@ step-slow */
        fast = fast->next->next;                       /*@ step-fast */
    }
    second = slow->next;                               /*@ second */
    slow->next = NULL;                                 /*@ cut */
    return second;                                     /*@ return */
}`,
    animate: ['split'],
    inputs: [Object.assign({}, X.sllValues, { def: [38, 27, 43, 3, 9, 82], max: 8 })],
    presets: [
      { label: 'Even length (6)', values: { values: [38, 27, 43, 3, 9, 82] } },
      { label: 'Odd length (7)', values: { values: [5, 1, 4, 2, 8, 7, 6] } },
      { label: 'Two nodes', values: { values: [2, 1] } },
      { label: 'One node', values: { values: [9] } },
    ],
    counters: ['follows'],
    main: (inp) => X.sllMain(inp.values, 'second = split(head);', '    struct node *second;'),
    capture: capWith(['slow', 'fast', 'second'], null, ['head', 'second']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, n = ctx.input.values.length;
      const fixed = L.fixed(ctx, d, ctx.ticks[0].data.roots.head);
      const order = ctx.memo['sllb-fixed:list'];
      const idx = (a) => (a ? order.indexOf(a) : n);
      const c = curs(ctx);
      const done = tag === 'cut' || tag === 'return' || tag === 'after';
      const sec = done ? c.second : null;
      // once cut, the second half drops to a row of its own
      let pos = fixed;
      const back = new Set(sec ? K.chain(d, sec).order : []);
      if (sec) { pos = new Map(fixed); K.chain(d, sec).order.forEach((a, j) => pos.set(a, { x: j * S, y: K.ROW + 40 })); }
      const slowAt = c.slow ? idx(c.slow) : -1;
      const items = L.nodes(ctx, d, pos, { cls: (nd) => (back.has(nd.addr) ? 'part-b' : done || (slowAt >= 0 && idx(nd.addr) <= slowAt && tag !== 'enter' && tag !== 'empty') ? 'part-a' : '') }).concat(L.links(ctx, d, pos));
      if (tag !== 'after') items.push(...L.tags(pos, [{ name: 'slow', addr: c.slow }, { name: 'fast', addr: c.fast }, { name: 'second', addr: c.second, cls: 'c-violet' }], { nullAt: { x: n * S, y: 0 } }));
      items.push(...hopsFor(ctx, c, pos));
      // where the cut would fall if the loop stopped now: just after slow
      if (c.slow && !done && slowAt < n - 1) {
        const x = slowAt * S + W + (S - W) / 2;
        items.push({ key: 'scis', kind: 'line', x1: x, y1: -30, x2: x, y2: H + 30, cls: 'sb-scissors' });
        items.push({ key: 'scist', kind: 'text', x, y: -40, text: tag === 'second' ? 'cut here' : 'cut here?', cls: 'sb-bad', anchor: 'middle' });
      }
      if (tag === 'after' || tag === 'return') {
        items.push(...L.rootBox('head', d.roots.head || ctx.ticks[0].data.roots.head, -150, 5, { label: 'head' }));
        items.push(...L.rootBox('second', c.second, -150, K.ROW + 45, { cls: 'c-violet', hot: tag === 'after', label: 'second' }));
      }
      const nm = (a) => L.nm(d, a);
      const fn = c.fast ? d.nodes.find((x) => x.addr === c.fast) : null;
      const first = sec ? K.chain(d, ctx.ticks[0].data.roots.head).order.length : 0;
      let say = '';
      switch (tag) {
        case 'enter': say = 'split(head) on ' + (n ? L.seq(d, d.roots.head) : 'an empty list') + '. Merge sort needs this: two halves, made without copying a single node.'; break;
        case 'empty': say = n ? 'The list is not empty, so there is something to split.' : 'The list is empty.'; break;
        case 'none': say = 'Nothing to split: the second half is NULL too.'; break;
        case 'init-slow': say = 'slow starts at the first node, ' + nm(c.slow) + '. It will end on the last node of the first half.'; break;
        case 'init-fast': say = 'fast starts one ahead, at ' + nm(c.fast) + '. Starting fast one step on makes slow stop one node earlier than the plain middle search, on the end of the first half rather than the start of the second.'; break;
        case 'test': say = !c.fast ? 'fast is NULL: stop. The first half ends at slow, ' + nm(c.slow) + '.' : !fn.links.next ? 'fast is on the last node, ' + nm(c.fast) + ': it cannot jump two more. Stop; the first half ends at slow, ' + nm(c.slow) + '.' : 'fast is at ' + nm(c.fast) + ' with a node after it, so both move on and the possible cut moves one place right.'; break;
        case 'step-slow': say = 'slow moves one link, to ' + nm(c.slow) + '.'; break;
        case 'step-fast': say = 'fast jumps two links, to ' + (c.fast ? nm(c.fast) : 'NULL') + '.'; break;
        case 'second': say = 'second = slow->next: remember ' + nm(c.second) + ', the first node of the second half, before the link to it is cut.' + (c.second ? '' : ' It is NULL: with one node there is no second half.'); break;
        case 'cut': say = 'slow->next = NULL: one write cuts the list. ' + nm(c.slow) + ' now ends the first half (' + L.plural(first, 'node') + '), and the second half (' + L.plural(n - first, 'node') + ') starts at ' + nm(c.second) + '.'; break;
        case 'return': say = 'split() returns second, ' + nm(c.second) + '.'; break;
        case 'after': say = 'Two lists now: head → ' + L.seq(d, d.roots.head) + (d.roots.second ? ' and second → ' + L.seq(d, d.roots.second) : ', and second is NULL') + '. ' + (n % 2 ? 'With an odd length the first half gets the extra node.' : 'With an even length the halves are equal.'); break;
      }
      return { items, say, slow: tag === 'cut' };
    },
    predict: [
      { at: (t) => t.tag === 'init-fast', once: true, ask: 'Click the node that will end the first half.', answer: (ts) => { const t = ts.find((x) => x.tag === 'second'); return t ? 'n' + t.data.cursors.slow : null; }, explain: () => 'slow stops on it: the loop ends when fast cannot jump twice more.' },
      { at: (t) => t.tag === 'second', once: true, ask: 'How many pointers must change to cut the list in two?', options: () => ['One', 'Two', 'One per node', 'None'], answer: () => 'One', pick: 'option', explain: () => 'Only slow->next is set to NULL. second already holds the start of the other half.' },
    ],
    quiz: [
      { q: 'Why does fast start at head->next here instead of head?', options: ['It is faster', 'So that slow stops on the last node of the first half', 'To skip the first value', 'To avoid a NULL check'], answer: 1, why: 'Starting fast one ahead stops slow one node earlier, on the node whose next must be cut.' },
      { q: 'Splitting 5 1 4 2 8 7 6 gives which halves?', options: ['5 1 4 and 2 8 7 6', '5 1 4 2 and 8 7 6', '5 1 and 4 2 8 7 6', '5 1 4 2 8 and 7 6'], answer: 1, why: 'With 7 nodes slow stops on the 4th (2): the first half gets the extra node.' },
      { q: 'What would go wrong if slow->next = NULL came before second = slow->next?', options: ['Nothing', 'second would be NULL and the second half lost', 'The first half would be lost', 'An infinite loop'], answer: 1, why: 'Once the link is cut, nothing points to the second half any more; its address must be saved first.' },
      { q: 'How much extra memory does split use?', options: ['A copy of half the list', 'A few pointer variables', 'An array of n pointers', 'A new list'], answer: 1, why: 'It only moves slow and fast and changes one link: O(1) extra memory.' },
    ],
  });
  // ---- reverse, recursively ----------------------------------------------------------------------------
  X.topic({
    id: 'sll-reverse-rec', family: 'sll', order: 41, title: 'Reverse (recursive)',
    blurb: 'The calls go down the list to the last node; on the way back up, each call turns one arrow round. One stack frame per node.',
    code: `/* reverse the list from head on, and return its new first node */
struct node *reverse(struct node *head)
{
    struct node *rest;
    if (head == NULL || head->next == NULL)   /*@ base-test */
        return head;                          /*@ base */
    rest = reverse(head->next);               /*@ recurse */
    head->next->next = head;                  /*@ flip */
    head->next = NULL;                        /*@ cut */
    return rest;                              /*@ return */
}`,
    animate: ['reverse'],
    inputs: [Object.assign({}, X.sllValues, { def: [10, 20, 30, 40], max: 7 })],
    presets: [
      { label: 'Four nodes', values: { values: [10, 20, 30, 40] } },
      { label: 'Six nodes', values: { values: [1, 2, 3, 4, 5, 6] } },
      { label: 'Two nodes', values: { values: [7, 8] } },
      { label: 'One node', values: { values: [5] } },
      { label: 'Empty list', values: { values: [] } },
    ],
    counters: ['writes'],
    main: (inp) => X.sllMain(inp.values, 'head = reverse(head);'),
    capture: (P) => {
      const o = topOf(P, K.capture(P, { type: 'head', roots: [], cursors: ['head', 'rest'], fields: ['data'], links: ['next'] }));
      o.calls = P.calls(['head', 'rest']).filter((f) => f.fn === 'reverse' || f.fn === 'main').map((f) => ({ fn: f.fn, head: f.args.head, rest: f.args.rest }));
      return o;
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, n = ctx.input.values.length;
      const first = ctx.ticks[0].data.cursors.head;
      const pos = L.fixed(ctx, d, first);
      const order = ctx.memo['sllb-fixed:list'];
      const idx = (a) => order.indexOf(a);
      const frames = d.calls.filter((f) => f.fn === 'reverse');
      const mainHead = (d.calls.find((f) => f.fn === 'main') || {}).head;
      // nodes whose arrows already point backwards (or end the list after being turned)
      const turned = new Set();
      for (const nd of d.nodes) if (nd.links.next && pos.has(nd.links.next) && idx(nd.links.next) < idx(nd.addr)) turned.add(nd.addr);
      const items = L.nodes(ctx, d, pos, { cls: (nd) => (turned.has(nd.addr) || (nd.addr === order[n - 1] && ctx.memo.based) ? 'part-a' : '') });
      items.push(...L.links(ctx, d, pos, { cls: (nd, to) => (idx(to) < idx(nd.addr) ? 'part-a' : '') }));
      if (tag === 'base' || (tag === 'base-test' && frames.length && frames[frames.length - 1].head === order[n - 1])) ctx.memo.based = true;
      // one band per active call, under the part of the list that call is responsible for
      const right = Math.max(0, n - 1) * S + W;
      frames.forEach((f, j) => {
        const x = f.head && pos.has(f.head) ? pos.get(f.head).x - 10 : right + 4;
        const y = H + 64 + j * 36;
        const topF = j === frames.length - 1;
        items.push({ key: 'band' + j, kind: 'region', x, y, w: Math.max(70, right + 10 - x), h: 28, cls: 'sb-band' + (topF ? ' sb-top' : ''), text: 'reverse(' + L.nm(d, f.head) + ')', enter: 'grow' });
        items.push({ key: 'depth' + j, kind: 'text', x: -24, y: y + 19, text: 'depth ' + (j + 1), cls: 'sb-muted', anchor: 'end' });
        if (f.rest) items.push({ key: 'got' + j, kind: 'text', x: right + 30, y: y + 19, text: 'rest = ' + L.nm(d, f.rest), cls: 'sb-good' });
      });
      const c = d.top === 'reverse' ? d.cursors : {};
      if (tag !== 'after' && c.head !== undefined) items.push(...L.tags(pos, [{ name: 'head', addr: c.head, cls: 'c-indigo', side: 'above' }, { name: 'rest', addr: c.rest, cls: 'c-green', side: 'above' }], {}));
      if (tag === 'after' || tag === 'enter') items.push(...L.rootBox('mainhead', mainHead, mainHead && pos.has(mainHead) ? pos.get(mainHead).x + 17 : -120, -110, { label: 'head in main', cls: 'c-indigo', side: 'top', hot: tag === 'after' }));
      const goingDown = frames.length && !ctx.memo.based;
      if (n > 1 && tag !== 'after') items.push({ key: 'phase', kind: 'text', x: 0, y: -150, text: goingDown ? 'going down: each call waits for the next' : 'coming back up: each call turns one arrow', cls: 'sb-phase' });
      const nm = (a) => L.nm(d, a);
      const pc = ctx.prev && ctx.prev.data.cursors ? ctx.prev.data.cursors : {};
      const depth = ctx.tick.depth + 1;
      let say = '';
      switch (tag) {
        case 'enter': say = n ? 'reverse(head) on ' + L.seq(d, first) + '. The recursive idea: reverse everything after the first node, then fix the first node\'s own arrow.' : 'reverse(head) on an empty list: head is NULL.'; break;
        case 'base-test': say = !c.head ? 'head is NULL: an empty list is its own reverse. Base case.' : !d.nodes.find((x) => x.addr === c.head).links.next ? 'head is ' + nm(c.head) + ' and has no next node: a list of one node is already reversed. This is the base case, at depth ' + depth + '.' : 'Depth ' + depth + ': head is ' + nm(c.head) + ', which has a next node, so this list is not small enough yet.'; break;
        case 'base': say = 'The base case returns ' + nm(pc.head) + ' to its caller.' + (pc.head ? ' ' + nm(pc.head) + ' will be the new first node; every call above will hand it back up unchanged, as rest.' : ''); break;
        case 'recurse': say = 'Depth ' + depth + ' calls reverse(head->next), that is reverse(' + nm(c.head) + '), and waits. A new band: the call at depth ' + (depth + 1) + ' is responsible for ' + L.plural(n - idx(c.head), 'node') + '.'; break;
        case 'flip': { const hn = d.nodes.find((x) => x.addr === c.head); const nx = hn && hn.links.next ? { addr: hn.links.next } : null; say = 'Back at depth ' + depth + ' with rest = ' + nm(c.rest) + ': everything after ' + nm(c.head) + ' is reversed. head->next->next = head: ' + (nx ? nm(nx.addr) : 'the next node') + '\'s arrow turns round to point back at ' + nm(c.head) + '. For a moment the two point at each other.'; break; }
        case 'cut': say = 'head->next = NULL: ' + nm(c.head) + '\'s own forward arrow goes. ' + nm(c.head) + ' is the end of the reversed part for now' + (depth > 1 ? '; the call above will point it back at its own node.' : ', and since this is the first call, it stays the end.'); break;
        case 'return': say = 'Depth ' + depth + ' is finished: it returns rest, still ' + nm(pc.rest) + ', and its band is about to go.' + (depth > 1 ? ' Control goes back to the call at depth ' + (depth - 1) + '.' : ''); break;
        case 'after': say = 'head = reverse(head): main\'s head now points at ' + nm(mainHead) + ', and the list reads ' + (mainHead ? L.seq(d, mainHead) : 'nothing') + '. The calls went ' + L.plural(Math.max(1, n), 'level') + ' deep: one stack frame per node, which is the memory the iterative version saves.'; break;
      }
      return { items, say, slow: tag === 'flip' || tag === 'base' };
    },
    predict: [
      { at: (t) => t.tag === 'enter' && t.data.cursors.head, once: true, ask: 'How many calls of reverse() will be active at the deepest point?', options: (ts, i, ctx) => [1, 2, 3, 4, 5, 6, 7].slice(0, Math.max(4, ctx.input.values.length + 1)).map(String), answer: (ts, i, ctx) => String(ctx.input.values.length), pick: 'option', explain: (ts, i, ctx) => 'One call per node: the deepest call gets the last node, ' + ctx.input.values[ctx.input.values.length - 1] + ', and stops there.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'flip', once: true, ask: 'head->next->next = head is next. Click the node whose arrow will change.', answer: (ts, i) => { const a = ts[i].data, b = ts[i + 1].data; const m = new Map(a.nodes.map((x) => [x.addr, x.links.next])); const ch = b.nodes.find((x) => m.get(x.addr) !== x.links.next); return ch ? 'n' + ch.addr : null; }, explain: () => 'It is head->next, the node after head: its arrow is turned to point back at head.' },
    ],
    quiz: [
      { q: 'What does every call of reverse() return, apart from the base case?', options: ['Its own head', 'The rest value it got from the call below: the old last node', 'NULL', 'The old first node'], answer: 1, why: 'The base case returns the last node, and each call passes that same rest straight back up.' },
      { q: 'What would happen without head->next = NULL?', options: ['Nothing', 'The old first node would still point at the second: the first two nodes would form a loop', 'The last node would be lost', 'It would not compile'], answer: 1, why: 'The second node now points back at the first; if the first kept its forward arrow, the two would point at each other forever.' },
      { q: 'How much stack memory does recursive reversal need for n nodes?', options: ['O(1)', 'O(log n)', 'O(n): one frame per node', 'O(n²)'], answer: 2, why: 'The calls go one level deeper per node before any returns, so n frames are on the stack at the deepest point.' },
      { q: 'In which order are the arrows turned round?', options: ['From the first node to the last', 'From the end of the list back towards the front', 'All at once', 'In random order'], answer: 1, why: 'Nothing is turned on the way down. The deepest waiting call turns first, so the arrows near the end turn first.' },
      { q: 'Why is a one-node list a base case?', options: ['It cannot be reversed', 'It is already its own reverse, so it can be returned as it is', 'Its next is the head', 'To save memory'], answer: 1, why: 'Reversing a single node changes nothing, so the call can return it directly and the recursion stops.' },
    ],
  });
  // ---- reverse in groups of k ------------------------------------------------------------------------------
  X.topic({
    id: 'sll-reverse-groups', family: 'sll', order: 42, title: 'Reverse in groups of k',
    blurb: 'Each call reverses k nodes with the usual three pointers, hands the rest to a recursive call, then joins its group to what comes back.',
    code: `/* reverse every run of k nodes; a shorter last run is reversed too */
struct node *reverse_groups(struct node *head, int k)
{
    struct node *prev = NULL, *curr = head, *next = NULL;   /*@ init */
    struct node *rest;
    int count = 0;                                          /*@ count-init */
    while (curr != NULL && count < k) {                     /*@ test */
        next = curr->next;                                  /*@ save */
        curr->next = prev;                                  /*@ flip */
        prev = curr;                                        /*@ move-prev */
        curr = next;                                        /*@ move-curr */
        count++;                                            /*@ count */
    }
    if (next != NULL) {                                     /*@ more */
        rest = reverse_groups(next, k);                     /*@ recurse */
        head->next = rest;                                  /*@ join */
    }
    return prev;                                            /*@ return */
}`,
    animate: ['reverse_groups'],
    inputs: [Object.assign({}, X.sllValues, { def: [10, 20, 30, 40, 50, 60], max: 8 }), { id: 'k', kind: 'int', label: 'k (group size)', def: 2, lo: 1, hi: 8 }],
    presets: [
      { label: 'k = 2', values: { values: [10, 20, 30, 40, 50, 60], k: 2 } },
      { label: 'k = 3, a short last group', values: { values: [1, 2, 3, 4, 5, 6, 7, 8], k: 3 } },
      { label: 'k = length: one group', values: { values: [4, 5, 6, 7], k: 4 } },
      { label: 'k = 1: no change', values: { values: [9, 8, 7], k: 1 } },
    ],
    counters: ['follows', 'writes'],
    main: (inp) => X.sllMain(inp.values, 'head = reverse_groups(head, ' + inp.k + ');'),
    capture: (P) => {
      const o = topOf(P, K.capture(P, { type: 'head', roots: [], cursors: ['head', 'prev', 'curr', 'next', 'rest'], fields: ['data'], links: ['next'] }));
      o.count = intOr(P, 'count');
      o.calls = P.calls(['head']).filter((f) => f.fn === 'reverse_groups' || f.fn === 'main').map((f) => ({ fn: f.fn, head: f.args.head }));
      return o;
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, n = ctx.input.values.length, k = ctx.input.k;
      const first = ctx.ticks[0].data.cursors.head;
      const pos = L.fixed(ctx, d, first);
      const order = ctx.memo['sllb-fixed:list'];
      const idx = (a) => order.indexOf(a);
      const groups = Math.ceil(n / k);
      const frames = d.calls.filter((f) => f.fn === 'reverse_groups');
      const mainHead = (d.calls.find((f) => f.fn === 'main') || {}).head;
      const c = d.top === 'reverse_groups' ? d.cursors : {};
      const g = c.head ? Math.floor(idx(c.head) / k) : -1;
      const items = [];
      for (let j = 0; j < groups; j++) {
        const a = j * k, b = Math.min(n, a + k) - 1;
        items.push({ key: 'grp' + j, kind: 'region', x: a * S - 14, y: -34, w: (b - a) * S + W + 28, h: H + 50, cls: (j % 2 ? 'sb-grp-b' : 'sb-grp-a') + (j === g && tag !== 'after' ? ' sb-on' : ''), text: 'group ' + (j + 1) + (frames[j] ? '  (depth ' + (j + 1) + ')' : '') });
      }
      items.push(...L.nodes(ctx, d, pos, { cls: (nd) => (Math.floor(idx(nd.addr) / k) % 2 ? 'part-b' : 'part-a') }));
      // a join (a group's last node to the next group's first) arches high over the row
      const isJoin = (nd, to) => Math.floor(idx(to) / k) !== Math.floor(idx(nd.addr) / k) && idx(to) > idx(nd.addr) + 1;
      items.push(...L.links(ctx, d, pos, { cls: (nd, to) => (isJoin(nd, to) ? 'sb-fresh' : ''), route: (nd, to, p, q) => (isJoin(nd, to) ? { bend: -(70 + (q.x - p.x) * 0.12 + (Math.floor(idx(nd.addr) / k) % 2) * 40) } : null) }));
      if (tag !== 'after' && c.head) items.push(...L.tags(pos, [{ name: 'prev', addr: c.prev }, { name: 'curr', addr: c.curr }, { name: 'next', addr: c.next }], { nullAt: { x: n * S, y: 0 } }));
      if (c.head && tag !== 'after') items.push({ key: 'cnt', kind: 'text', x: 0, y: -62, text: 'call for group ' + (g + 1) + ': count = ' + (d.count === null ? '?' : d.count) + ' of k = ' + k, cls: 'sb-note' });
      if (tag === 'after' || tag === 'enter') items.push(...L.rootBox('mainhead', mainHead, mainHead && pos.has(mainHead) ? pos.get(mainHead).x + 17 : -120, -150, { label: 'head in main', cls: 'c-indigo', side: 'top', hot: tag === 'after' }));
      const nm = (a) => L.nm(d, a);
      const pc = ctx.prev && ctx.prev.data.top === 'reverse_groups' ? ctx.prev.data.cursors : {};
      const depth = ctx.tick.depth + 1;
      const grpText = () => { const out = []; for (let j = 0; j < groups; j++) out.push('[' + ctx.input.values.slice(j * k, j * k + k).join(' ') + ']'); return out.join(' '); };
      let say = '';
      switch (tag) {
        case 'enter': say = n ? 'reverse_groups(head, ' + k + ') on ' + L.seq(d, first) + '. The groups: ' + grpText() + '. Each call reverses one group, then calls itself for the rest.' : 'An empty list: nothing to reverse.'; break;
        case 'init': say = (c.head ? 'A call for group ' + (g + 1) + ' (depth ' + depth + '), starting at ' + nm(c.head) + '. ' : '') + 'prev = NULL, curr = head, next = NULL: the same three pointers as plain reversal.'; break;
        case 'count-init': say = 'count = 0. It stops the loop after ' + L.plural(k, 'node') + ', so only this group is turned round.'; break;
        case 'test': say = c.curr && d.count < k ? 'count = ' + d.count + ' < ' + k + ' and curr is ' + nm(c.curr) + ': turn another arrow.' : d.count === k ? 'count reached ' + k + ': group ' + (g + 1) + ' is reversed and now reads ' + L.seq(d, c.prev) + '. curr, at ' + nm(c.curr) + ', is the first node of the next group.' : 'curr is NULL: the list ended after ' + L.plural(d.count, 'node') + ' in this group. They are reversed all the same.'; break;
        case 'save': say = 'next = curr->next = ' + nm(c.next) + ', saved before the arrow turns.'; break;
        case 'flip': say = 'curr->next = prev: ' + nm(c.curr) + ' now points ' + (c.prev ? 'back at ' + nm(c.prev) : 'to NULL; it was the first of its group and will be the group\'s last') + '.'; break;
        case 'move-prev': say = 'prev = curr: prev moves up to ' + nm(c.prev) + '.'; break;
        case 'move-curr': say = 'curr = next: curr moves on to ' + nm(c.curr) + '.'; break;
        case 'count': say = 'count = ' + d.count + (d.count === k ? ': a full group.' : '.'); break;
        case 'more': say = c.next ? 'next is ' + nm(c.next) + ': more nodes follow, so the rest needs reversing too.' : 'next is NULL: this was the last group, so no further call is made.'; break;
        case 'recurse': { const hn = frames.length > 1 ? frames[frames.length - 2].head : null; say = 'Depth ' + depth + ' calls reverse_groups(' + nm(pc.next) + ', ' + k + ') for the rest and waits. ' + (hn ? nm(hn) + ', the last node of group ' + depth + ', points to NULL for now: the group is cut off until that call returns.' : ''); break; }
        case 'join': say = 'Back at depth ' + depth + ': rest = ' + nm(c.rest) + ', the new first node of everything after this group. head->next = rest joins ' + nm(c.head) + ' (once first in group ' + (g + 1) + ', now its last) to ' + nm(c.rest) + '. Groups are joined from the back to the front.'; break;
        case 'return': say = 'Depth ' + depth + ' returns prev = ' + nm(pc.prev) + ', the new first node of group ' + (pc.head ? Math.floor(idx(pc.head) / k) + 1 : 1) + '.'; break;
        case 'after': say = 'head now points at ' + nm(mainHead) + ': ' + (mainHead ? L.seq(d, mainHead) : 'an empty list') + '. Every group was turned round in place, and ' + L.plural(Math.max(0, groups - 1), 'join was', 'joins were') + ' made on the way back up.'; break;
      }
      return { items, say, slow: tag === 'join' };
    },
    predict: [
      { at: (t) => t.tag === 'more' && t.data.cursors.next, once: true, ask: 'The call for the rest will return its new first node. Click the node it will return.', answer: (ts, i, ctx) => { const t = ts.slice(i).find((x) => x.tag === 'join'); return t ? 'n' + t.data.cursors.rest : null; }, explain: (ts, i, ctx) => 'The next group is reversed, so its last node comes first: that is what the call returns.' },
      { at: (t, i, ts) => t.tag === 'enter' && t.data.cursors.head, once: true, ask: 'Which link is set last of all?', options: () => ['The join after group 1', 'The join before the last group', 'The flip in the last group', 'head in main'], answer: () => 'head in main', pick: 'option', explain: () => 'The joins happen as the calls return, from the back to the front; the very last pointer to change is head in main, when the first call returns.' },
    ],
    quiz: [
      { q: 'Reversing 1 2 3 4 5 6 7 8 in groups of 3 gives...', options: ['3 2 1 6 5 4 8 7', '3 2 1 6 5 4 7 8', '8 7 6 5 4 3 2 1', '1 2 3 6 5 4 8 7'], answer: 0, why: 'Each run of 3 is turned round, and the short last run 7 8 is turned round too (this version reverses it).' },
      { q: 'Why can head->next not be set before the recursive call returns?', options: ['It could, nothing changes', 'Until then nobody knows which node will come first in the rest', 'head is NULL', 'It would free memory'], answer: 1, why: 'The rest\'s new first node is only known once it has been reversed; the call returns it.' },
      { q: 'Inside a group, what does head end up as?', options: ['The group\'s first node', 'The group\'s last node', 'NULL', 'The next group\'s head'], answer: 1, why: 'head was first in its group; after reversal it is last, which is why it is the node that gets joined to the rest.' },
      { q: 'How deep does the recursion go for n nodes and group size k?', options: ['n', 'About n / k calls', 'k', 'log n'], answer: 1, why: 'One call per group: n / k rounded up.' },
      { q: 'With k = 1, what happens?', options: ['The whole list is reversed', 'Nothing changes: each group of one is its own reverse', 'The list is emptied', 'Only the first node moves'], answer: 1, why: 'Each call turns one arrow to NULL and then joins it straight back to the rest, which leaves the order as it was.' },
    ],
  });
  // tags round a ring point outwards, so they never sit inside the circle on top of each other
  const sideOn = (rho, p) => {
    const dx = p.x + W / 2 - rho.cx, dy = p.y + H / 2 - rho.cy;
    if (Math.abs(dy) >= Math.abs(dx) * 0.6) return dy < 0 ? 'above' : 'below';
    return dx < 0 ? 'left' : 'right';
  };

  // ---- rotate ----------------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-rotate', family: 'sll', order: 43, title: 'Rotate by k places',
    blurb: 'Join the tail to the head so the list becomes a ring, walk to the right place, and cut the ring open there.',
    code: `/* rotate the list k places to the right: the last k nodes move to the front */
struct node *rotate_right(struct node *head, int k)
{
    struct node *tail, *new_tail;
    int len, i;
    if (head == NULL)                       /*@ empty */
        return head;                        /*@ trivial */
    tail = head;                            /*@ init-tail */
    len = 1;                                /*@ init-len */
    while (tail->next != NULL) {            /*@ len-test */
        tail = tail->next;                  /*@ walk-tail */
        len++;                              /*@ count */
    }
    k = k % len;                            /*@ reduce */
    if (k == 0)                             /*@ zero-test */
        return head;                        /*@ unchanged */
    tail->next = head;                      /*@ close */
    new_tail = head;                        /*@ init-cut */
    for (i = 1; i < len - k; i++)           /*@ cut-test */
        new_tail = new_tail->next;          /*@ walk-cut */
    head = new_tail->next;                  /*@ new-head */
    new_tail->next = NULL;                  /*@ cut */
    return head;                            /*@ return */
}`,
    animate: ['rotate_right'],
    inputs: [Object.assign({}, X.sllValues, { def: [1, 2, 3, 4, 5], max: 8 }), { id: 'k', kind: 'int', label: 'k (places to the right)', def: 2, lo: 0, hi: 30 }],
    presets: [
      { label: 'Rotate by 2', values: { values: [1, 2, 3, 4, 5], k: 2 } },
      { label: 'k bigger than the length', values: { values: [10, 20, 30, 40], k: 7 } },
      { label: 'k = length: no change', values: { values: [6, 7, 8], k: 3 } },
      { label: 'Rotate by 1', values: { values: [11, 22, 33, 44, 55, 66], k: 1 } },
    ],
    counters: ['follows', 'writes'],
    main: (inp) => X.sllMain(inp.values, 'head = rotate_right(head, ' + inp.k + ');'),
    capture: (P) => {
      const o = topOf(P, K.capture(P, { type: 'head', roots: [], cursors: ['head', 'tail', 'new_tail'], fields: ['data'], links: ['next'] }));
      o.len = intOr(P, 'len'); o.i = intOr(P, 'i'); o.k = intOr(P, 'k');
      return o;
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, n = ctx.input.values.length, k0 = ctx.input.k;
      const first = ctx.ticks[0].data.cursors.head;
      const fixed = L.fixed(ctx, d, first);
      const order = ctx.memo['sllb-fixed:list'];
      const kr = n ? k0 % n : 0;
      const c = d.top === 'rotate_right' ? d.cursors : {};
      // a ring while tail->next points back at the first node; a row before and after
      const lastNode = d.nodes.find((x) => x.addr === order[n - 1]);
      const ringed = n > 0 && lastNode && lastNode.links.next === first && tag !== 'after';
      const rho = L.rho(order, 0, 0, 0);
      let pos = fixed;
      if (ringed) pos = rho.pos;
      if (tag === 'after') pos = L.row(K.chain(d, c.head || d.cursors.head).order, 0, 0);
      const known = ['reduce', 'zero-test', 'unchanged', 'close', 'init-cut', 'cut-test', 'walk-cut', 'new-head', 'cut', 'return', 'after'].includes(tag);
      const moving = new Set(known && kr ? order.slice(n - kr) : []);
      const items = L.nodes(ctx, d, pos, { cls: (nd) => (moving.has(nd.addr) ? 'part-b' : known && kr ? 'part-a' : '') });
      const cutAt = tag === 'new-head' ? c.new_tail : null;
      items.push(...L.links(ctx, d, pos, { ring: ringed ? rho.ring : null, cls: (nd) => (nd.addr === cutAt ? 'sb-cut' : '') }));
      if (tag !== 'after') {
        const list = [{ name: 'head', addr: c.head, cls: 'c-indigo' }, { name: 'tail', addr: c.tail, cls: 'c-violet' }, { name: 'new_tail', addr: c.new_tail, cls: 'c-rose' }];
        // round the ring each tag points outwards; a second tag on the same node takes the top or bottom
        const used = new Map();
        if (ringed) for (const t of list) {
          if (!t.addr || !pos.has(t.addr)) continue;
          const first = sideOn(rho, pos.get(t.addr));
          const had = used.get(t.addr);
          t.side = !had ? first : had === 'below' ? 'above' : 'below';
          used.set(t.addr, t.side);
        }
        items.push(...L.tags(pos, list, { nullAt: { x: n * S, y: 0 } }));
      } else items.push(...L.rootBox('mainhead', d.cursors.head, -150, 5, { label: 'head', cls: 'c-indigo', hot: true }));
      if (ringed) items.push({ key: 'ringtxt', kind: 'text', x: rho.cx, y: rho.cy + 5, text: tag === 'cut' || tag === 'return' ? 'cut open' : 'a ring: no NULL', cls: 'sb-muted', anchor: 'middle' });
      if (known) items.push({ key: 'ktxt', kind: 'text', x: 0, y: ringed ? rho.cy - rho.R - 70 : -70, text: 'k = ' + k0 + ' % ' + n + ' = ' + kr + (kr ? ': the last ' + L.plural(kr, 'node') + ' go to the front' : ': nothing moves'), cls: 'sb-note' });
      const nm = (a) => L.nm(d, a);
      const pc = ctx.prev && ctx.prev.data.top === 'rotate_right' ? ctx.prev.data.cursors : {};
      let say = '';
      switch (tag) {
        case 'enter': say = n ? 'rotate_right(head, ' + k0 + ') on ' + L.seq(d, first) + '. Rotating right by ' + k0 + ' moves the last ' + L.plural(k0, 'node') + ' round to the front, in their order.' : 'rotate_right on an empty list.'; break;
        case 'empty': say = n ? 'The list is not empty.' : 'The list is empty: there is nothing to rotate.'; break;
        case 'trivial': say = 'Return head, NULL, unchanged.'; break;
        case 'init-tail': say = 'tail starts at the first node. It will walk to the last node, counting as it goes.'; break;
        case 'init-len': say = 'len = 1: the first node is counted already.'; break;
        case 'len-test': say = c.tail && d.nodes.find((x) => x.addr === c.tail).links.next ? nm(c.tail) + ' has a next node: keep going.' : 'tail is on ' + nm(c.tail) + ', whose next is NULL: the last node. The list has ' + L.plural(d.len, 'node') + '.'; break;
        case 'walk-tail': say = 'tail moves to ' + nm(c.tail) + '.'; break;
        case 'count': say = 'len = ' + d.len + '.'; break;
        case 'reduce': say = 'k = k % len = ' + k0 + ' % ' + n + ' = ' + kr + '. Rotating ' + n + ' nodes by ' + n + ' brings every node back where it started, so only the remainder matters.'; break;
        case 'zero-test': say = kr ? 'k = ' + kr + ', not 0: there is real work to do.' : 'k = 0: the rotation would leave the list exactly as it is.'; break;
        case 'unchanged': say = 'Return head unchanged. No pointer was written.'; break;
        case 'close': say = 'tail->next = head: the last node, ' + nm(c.tail) + ', now points to the first, ' + nm(c.head) + '. The list has become a ring with no NULL in it. Any node could be the start now; we only need to choose where to cut.'; break;
        case 'init-cut': say = 'The new last node will be the one ' + (n - kr) + ' along from the old first node (len - k = ' + n + ' - ' + kr + '). new_tail starts at ' + nm(c.new_tail) + '.'; break;
        case 'cut-test': say = d.i < n - kr ? 'i = ' + d.i + ' < ' + (n - kr) + ': new_tail moves on.' : 'i = ' + d.i + ': new_tail, at ' + nm(c.new_tail) + ', is where the ring must be cut.'; break;
        case 'walk-cut': say = 'new_tail moves to ' + nm(c.new_tail) + '.'; break;
        case 'new-head': say = 'head = new_tail->next = ' + nm(c.head) + ': the node after the cut is the new first node. The red link, ' + nm(c.new_tail) + ' → ' + nm(c.head) + ', is the one to cut.'; break;
        case 'cut': say = 'new_tail->next = NULL: the ring is cut open between ' + nm(c.new_tail) + ' and ' + nm(c.head) + '. Reading from head: ' + L.seq(d, c.head) + '.'; break;
        case 'return': say = 'Return the new head, ' + nm(pc.head) + '.'; break;
        case 'after': { const h = d.cursors.head; say = 'The rotated list: ' + (h ? L.seq(d, h) : 'empty') + '. ' + (kr ? 'Two pointers were written: one to close the ring and one to open it.' : 'Nothing moved.'); break; }
      }
      return { items, say, slow: tag === 'close' || tag === 'cut' };
    },
    predict: [
      { at: (t) => t.tag === 'reduce', once: true, ask: (t, ts, i, ctx) => 'Which node will be first after rotating by ' + ctx.input.k + '? Click it.', answer: (ts, i, ctx) => { const n = ctx.input.values.length, kr = ctx.input.k % n; const order = ctx.memo['sllb-fixed:list']; return order ? 'n' + order[(n - kr) % n] : null; }, explain: (ts, i, ctx) => 'k % len = ' + (ctx.input.k % ctx.input.values.length) + ', so the first of the last ' + (ctx.input.k % ctx.input.values.length) + ' nodes comes to the front (or nothing moves if that is 0).' },
      { at: (t) => t.tag === 'close', once: true, ask: 'The list is a ring now. How many links must change to finish the rotation?', options: () => ['One', 'Two', 'One per node', 'k'], answer: () => 'One', pick: 'option', explain: () => 'Only new_tail->next = NULL. head is a variable, not a link in the list.' },
    ],
    quiz: [
      { q: 'Rotating 1 2 3 4 5 right by 2 gives...', options: ['3 4 5 1 2', '4 5 1 2 3', '2 3 4 5 1', '5 4 3 2 1'], answer: 1, why: 'The last two nodes, 4 and 5, move to the front in their order.' },
      { q: 'Why is k replaced by k % len?', options: ['To avoid negative numbers', 'Rotating by len gives the same list, so only the remainder matters', 'To make k smaller than 2', 'It sorts the list'], answer: 1, why: 'Each full turn of len places brings every node back, so rotating by 7 on 4 nodes is the same as by 3.' },
      { q: 'How many next fields are written in a rotation with k % len != 0?', options: ['One', 'Two', 'len', 'k'], answer: 1, why: 'tail->next = head closes the ring and new_tail->next = NULL opens it; no other node changes.' },
      { q: 'Which node ends up last?', options: ['The old last node', 'The node len - k places from the start (counting the first as 1)', 'The old first node', 'The k-th node'], answer: 1, why: 'new_tail walks len - k - 1 steps from the first node, and its next becomes NULL.' },
      { q: 'What is the running time for n nodes?', options: ['O(1)', 'O(k)', 'O(n): one walk to find the tail and part of a second', 'O(n·k)'], answer: 2, why: 'Counting needs the whole list; the second walk is at most n steps. k does not matter after k % n.' },
    ],
  });
  // ---- merge two sorted lists ---------------------------------------------------------------------------
  const MS = 140;                     // a tighter step: three rows of up to nine boxes
  const sortedList = (id, label, def) => ({ id, kind: 'ints', label, def, min: 0, max: 5, sorted: true });
  X.topic({
    id: 'sll-merge-sorted', family: 'sll', order: 45, title: 'Merge two sorted lists',
    blurb: 'A dummy node gives the result somewhere to start. Compare the two fronts, hang the smaller one on the tail, and repeat: nodes are relinked, never copied.',
    code: `/* merge two sorted lists into one sorted list, reusing their nodes */
struct node *merge(struct node *a, struct node *b)
{
    struct node dummy;
    struct node *tail = &dummy;                 /*@ init */
    dummy.next = NULL;                          /*@ dummy */
    while (a != NULL && b != NULL) {            /*@ test */
        if (a->data <= b->data) {               /*@ compare */
            tail->next = a;                     /*@ take-a */
            a = a->next;                        /*@ advance-a */
        } else {
            tail->next = b;                     /*@ take-b */
            b = b->next;                        /*@ advance-b */
        }
        tail = tail->next;                      /*@ move-tail */
    }
    tail->next = (a != NULL) ? a : b;           /*@ rest */
    return dummy.next;                          /*@ return */
}`,
    animate: ['merge'],
    inputs: [sortedList('a', 'List a (sorted)', [1, 4, 7, 9]), sortedList('b', 'List b (sorted)', [2, 3, 8])],
    check: (inp) => (inp.a.length + inp.b.length > 8 ? 'At most 8 nodes in the two lists together, so the picture stays readable' : null),
    presets: [
      { label: 'Interleaved', values: { a: [1, 4, 7, 9], b: [2, 3, 8] } },
      { label: 'All of a first', values: { a: [1, 2, 3], b: [10, 20, 30] } },
      { label: 'Equal values', values: { a: [2, 5, 5], b: [2, 5, 6] } },
      { label: 'One list empty', values: { a: [], b: [4, 6, 9] } },
    ],
    counters: ['compares', 'follows', 'writes'],
    main: (inp) => {
      const init = (v) => (v.length ? '{ ' + v.join(', ') + ' }' : '{ 0 }');
      return `int main(void)
{
    int va[] = ${init(inp.a)};
    int vb[] = ${init(inp.b)};
    struct node *first = build(va, ${inp.a.length});
    struct node *second = build(vb, ${inp.b.length});
    struct node *merged;
    merged = merge(first, second);
    return 0;
}`;
    },
    capture: (P) => {
      const o = topOf(P, K.capture(P, { type: 'first', roots: ['first', 'second', 'merged'], cursors: ['a', 'b', 'tail'], fields: ['data'], links: ['next'] }));
      const f = P.has('dummy', 0) ? P.find('dummy', 0) : null;
      o.dummy = f ? f.addr : 0;
      if (f) o.nodes.push({ addr: f.addr, data: '', links: { next: P.fields(f.type, f.addr).next || 0 }, dummy: true });
      return o;
    },
    scene(ctx) {
      const d = Object.assign({}, ctx.tick.data), tag = ctx.tick.tag, inp = ctx.input;
      const t0 = ctx.ticks[0].data;
      const A = K.chain(t0, t0.roots.first).order, B = K.chain(t0, t0.roots.second).order;
      const inA = new Set(A), inB = new Set(B);
      const R1 = 0, R2 = 120, R3 = 270;
      const memo = ctx.memo;
      // until dummy.next = NULL has run, dummy holds whatever was on the stack: draw it empty
      if (tag === 'dummy') memo.dummyReady = true;
      if (d.dummy && !memo.dummyReady) d.nodes = d.nodes.map((x) => (x.dummy ? Object.assign({}, x, { links: { next: 0 } }) : x));
      const by = new Map(d.nodes.map((x) => [x.addr, x]));
      // the merged part: from the dummy (or main's merged) up to tail; after the rest is attached, all of it
      let start = d.dummy ? by.get(d.dummy).links.next : (d.roots.merged || memo.mergedStart || 0);
      if (d.dummy) memo.mergedStart = start;
      const c = d.top === 'merge' ? d.cursors : {};
      const whole = tag === 'rest' || tag === 'return' || tag === 'after';
      const merged = [];
      // a node hung on the tail joins the merged row at once, before tail itself moves on
      const taking = ['take-a', 'take-b', 'advance-a', 'advance-b'].includes(tag);
      const tailNext = c.tail && by.has(c.tail) ? by.get(c.tail).links.next : 0;
      if (whole) merged.push(...K.chain(d, start).order);
      else {
        if (c.tail !== d.dummy) for (const a of K.chain(d, start).order) { merged.push(a); if (a === c.tail) break; }
        if (taking && tailNext && !merged.includes(tailNext)) merged.push(tailNext);
      }
      const mset = new Set(merged);
      const pos = new Map();
      A.forEach((a, i) => pos.set(a, { x: (i + 1) * MS, y: R1 }));
      B.forEach((a, i) => pos.set(a, { x: (i + 1) * MS, y: R2 }));
      merged.forEach((a, i) => pos.set(a, { x: (i + 1) * MS, y: R3 }));
      if (d.dummy) pos.set(d.dummy, { x: 0, y: R3 });
      const items = [
        { key: 'lane-a', kind: 'region', x: MS - 14, y: R1 - 14, w: Math.max(1, inp.a.length) * MS - 18, h: H + 28, cls: 'sb-lane' },
        { key: 'lane-b', kind: 'region', x: MS - 14, y: R2 - 14, w: Math.max(1, inp.b.length) * MS - 18, h: H + 28, cls: 'sb-lane' },
        { key: 'lane-m', kind: 'region', x: -14, y: R3 - 14, w: (inp.a.length + inp.b.length + 1) * MS - 18, h: H + 28, cls: 'sb-lane' },
        { key: 'lt-a', kind: 'text', x: MS - 26, y: R1 + H / 2 + 5, text: 'list a', cls: 'sb-phase', anchor: 'end' },
        { key: 'lt-b', kind: 'text', x: MS - 26, y: R2 + H / 2 + 5, text: 'list b', cls: 'sb-phase', anchor: 'end' },
        { key: 'lt-m', kind: 'text', x: -26, y: R3 + H / 2 + 5, text: 'merged', cls: 'sb-phase', anchor: 'end' },
      ];
      items.push(...L.nodes(ctx, d, pos, { cls: (nd) => (nd.dummy ? 'sb-dummy' : inA.has(nd.addr) ? 'sb-a' : inB.has(nd.addr) ? 'sb-b' : ''), label: (nd) => (nd.dummy ? 'dummy' : '') }));
      // a merged node's old link back into its own list is stale: it will be overwritten or kept as the rest
      items.push(...L.links(ctx, d, pos, { cls: (nd, to) => (mset.has(to) || (nd.dummy && to) ? 'part-a' : mset.has(nd.addr) ? 'dim' : '') }));
      if (tag !== 'after' && tag !== 'return') items.push(...L.tags(pos, [{ name: 'a', addr: c.a, cls: 'c-teal', side: 'above' }, { name: 'b', addr: c.b, cls: 'c-amber' }, { name: 'tail', addr: c.tail, cls: 'c-indigo' }], { nullAt: { x: (Math.max(inp.a.length, inp.b.length) + 1) * MS, y: R1 } }));
      if (tag === 'compare' && c.a && c.b) {
        const va = by.get(c.a).data, vb = by.get(c.b).data;
        items.push({ key: 'cmp', kind: 'arrow', from: { key: 'n' + c.a, side: 'bottom' }, to: { key: 'n' + c.b, side: 'top' }, noHead: true, cls: 'sb-pair ' + (va <= vb ? 'sb-good' : 'sb-bad'), label: va + (va <= vb ? ' ≤ ' : ' > ') + vb });
      }
      if (tag === 'after') items.push(...L.rootBox('merged', d.roots.merged, MS + 17, R3 - 100, { cls: 'c-indigo', side: 'top', hot: true }));
      const nm = (a) => L.nm(d, a);
      const pc = ctx.prev && ctx.prev.data.top === 'merge' ? ctx.prev.data.cursors : {};
      let say = '';
      switch (tag) {
        case 'enter': say = 'merge(a, b) with a = ' + (inp.a.length ? inp.a.join(' → ') : 'empty') + ' and b = ' + (inp.b.length ? inp.b.join(' → ') : 'empty') + '. Both are sorted. The result will use these same nodes, relinked into one chain.'; break;
        case 'init': say = 'tail = &dummy. dummy is a node in merge\'s own stack frame, not on the heap: the merged list hangs from it, so the very first node needs no special case.'; break;
        case 'dummy': say = 'dummy.next = NULL: the merged list starts empty. tail always points at its last node, where the next node gets hung.'; break;
        case 'test': say = c.a && c.b ? 'Both lists still have nodes: a is at ' + nm(c.a) + ', b at ' + nm(c.b) + '.' : (c.a ? 'b has run out' : c.b ? 'a has run out' : 'Both lists are empty') + ', so the comparing stops.'; break;
        case 'compare': { const va = by.get(c.a).data, vb = by.get(c.b).data; say = 'Compare the two fronts: ' + va + (va <= vb ? ' ≤ ' : ' > ') + vb + '. ' + (va <= vb ? 'a\'s node is smaller' + (va === vb ? ' or equal (ties take from a, which keeps equal values in their original order)' : '') : 'b\'s node is smaller') + ', so it goes next.'; break; }
        case 'take-a': case 'take-b': say = 'tail->next = ' + (tag === 'take-a' ? 'a' : 'b') + ': ' + nm(tag === 'take-a' ? c.a : c.b) + ' is hung after ' + (c.tail === d.dummy ? 'dummy' : nm(c.tail)) + ' and drops into the merged row. Its own next still points into list ' + (tag === 'take-a' ? 'a' : 'b') + ' for now.'; break;
        case 'advance-a': say = c.a ? 'a = a->next: list a now starts at ' + nm(c.a) + '.' : 'a = a->next, which is NULL: list a is used up.'; break;
        case 'advance-b': say = c.b ? 'b = b->next: list b now starts at ' + nm(c.b) + '.' : 'b = b->next, which is NULL: list b is used up.'; break;
        case 'move-tail': say = 'tail = tail->next: tail moves to ' + nm(c.tail) + ', the new end of the merged list (' + L.plural(merged.length, 'node') + ' so far).'; break;
        case 'rest': say = 'tail->next = ' + (pc.a ? 'a' : 'b') + ': ' + ((pc.a || pc.b) ? 'what is left of list ' + (pc.a ? 'a' : 'b') + ' (' + L.seq(d, pc.a || pc.b) + ') is already sorted and already linked, so one pointer attaches all of it.' : 'both lists are used up; the merged list ends with NULL.'); break;
        case 'return': say = 'Return dummy.next, the first real node, ' + nm(start) + '. dummy disappears with merge\'s stack frame; it was never part of the answer.'; break;
        case 'after': say = 'merged → ' + (d.roots.merged ? L.seq(d, d.roots.merged) : 'nothing') + '. No node was created or copied: only next fields changed. first and second still point at their old first nodes, which are now inside the merged list.'; break;
      }
      return { items, say, slow: tag === 'rest' };
    },
    predict: [
      { at: (t) => t.tag === 'compare' && t.data.cursors.a && t.data.cursors.b, once: true, ask: 'Which node will be hung on the tail next? Click it.', answer: (ts, i) => { const d = ts[i].data, by = new Map(d.nodes.map((x) => [x.addr, x])); return 'n' + (by.get(d.cursors.a).data <= by.get(d.cursors.b).data ? d.cursors.a : d.cursors.b); }, explain: () => 'The smaller front goes first; on a tie, a\'s node goes first.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'rest' && (ts[i].data.cursors.a || ts[i].data.cursors.b), once: true, ask: 'One list has run out. How many pointer writes does it take to attach the rest of the other?', options: () => ['One', 'One per remaining node', 'None', 'Two'], answer: () => 'One', pick: 'option', explain: () => 'The remaining nodes are already linked to each other in sorted order; tail->next only has to point at the first of them.' },
    ],
    quiz: [
      { q: 'What does the dummy node save?', options: ['Memory', 'A special case for the first node of the result', 'A comparison per node', 'The need to sort'], answer: 1, why: 'Without it, the first node would need its own code to set the result\'s head; with it, every node is attached the same way, after tail.' },
      { q: 'Why is a->data <= b->data used rather than <?', options: ['It is faster', 'On equal values the node from a goes first, so equal values keep their order (stable)', 'It avoids NULL', 'It makes no difference to anything'], answer: 1, why: 'Taking from a on ties keeps equal keys in their original order, which is what makes merge sort stable.' },
      { q: 'How many comparisons does merging lists of 4 and 3 nodes make at most?', options: ['3', '6', '7', '12'], answer: 1, why: 'Each comparison places one node; the last node of the 7 never needs one, so at most 4 + 3 - 1 = 6.' },
      { q: 'How much extra memory does this merge use?', options: ['O(n + m)', 'O(1): a dummy node and a few pointers', 'O(log n)', 'A copy of the shorter list'], answer: 1, why: 'Nodes are relinked in place; nothing is allocated.' },
      { q: 'What would merging 3 1 2 with 4 5 give?', options: ['1 2 3 4 5', '3 1 2 4 5', '4 5 3 1 2', 'An error'], answer: 1, why: 'merge assumes both inputs are sorted. 3 ≤ 4, 1 ≤ 4, 2 ≤ 4, then 4 5: the result is only as sorted as the inputs.' },
    ],
  });
  // ---- lists with a loop: Floyd's tortoise and hare ------------------------------------------------------
  const loopIn = { id: 'loop', kind: 'int', label: 'Last node links back to node no. (0 = no loop)', def: 3, lo: 0, hi: 8 };
  const loopCheck = (inp) => (inp.loop > inp.values.length ? 'The loop must go back to one of the ' + inp.values.length + ' nodes (or 0 for none)' : null);
  /** main for a list whose last node points back to node number pos (counting from 1) */
  const loopMain = (inp, call) => {
    const vals = inp.values;
    const lines = ['int main(void)', '{', '    int values[] = ' + (vals.length ? '{ ' + vals.join(', ') + ' }' : '{ 0 }') + ';', '    struct node *head = build(values, ' + vals.length + ');'];
    if (inp.loop > 0) {
      lines.push('    struct node *last = head;', '    struct node *entry = head;', '    int i;', '    while (last->next != NULL)', '        last = last->next;', '    for (i = 1; i < ' + inp.loop + '; i++)', '        entry = entry->next;', '    last->next = entry;              /* close the loop */');
    }
    lines.push('    ' + call, '    return 0;', '}');
    return lines.join('\n');
  };
  /** The rho picture: the first tick's chain, its loop entry, positions; stable for the whole run */
  const rhoOf = (ctx) => {
    if (ctx.memo.rho) return ctx.memo.rho;
    const d0 = ctx.ticks[0].data;
    const ch = K.chain(d0, d0.cursors.head || d0.roots.head);
    const e = ch.cycleTo ? ch.order.indexOf(ch.cycleTo) : -1;
    const r = e >= 0 ? L.rho(ch.order, e, 0, 0) : { pos: L.row(ch.order, 0, 0), ring: null, cx: 0, cy: 0, R: 0, lam: 0 };
    r.order = ch.order; r.e = e; r.entry = e >= 0 ? ch.order[e] : 0; r.n = ch.order.length;
    // how far each node is from the loop's first node, following next
    r.toEntry = new Map();
    ch.order.forEach((a, i) => r.toEntry.set(a, e < 0 ? -1 : i < e ? e - i : (r.lam - (i - e)) % r.lam));
    return (ctx.memo.rho = r);
  };
  /** slow and fast as two tokens riding on top of the nodes; fast hops */
  const runners = (rho, c, pos, lift) => {
    const items = [];
    const place = (key, addr, text, cls, dx, arc) => {
      if (addr === undefined) return;
      const p = addr ? pos.get(addr) : null;
      const x = p ? p.x + W / 2 + dx : rho.n * S + 38 + dx, y = p ? p.y - 20 - (lift || 0) : H / 2 - 30;
      items.push({ key, kind: 'token', x, y, r: 19, text, cls: 'sb-tok ' + cls, arc });
    };
    const same = c.slow && c.slow === c.fast;
    place('tok-slow', c.slow, 'slow', 'c-teal', same ? -22 : 0, 0);
    place('tok-fast', c.fast, 'fast', 'c-rose', same ? 22 : 0, 46);
    if (c.fast === 0 || c.slow === 0) {
      items.push({ key: 'sllb-null', kind: 'region', x: rho.n * S + 10, y: 6, w: 56, h: H - 12, cls: 'sb-nullspot' });
      items.push({ key: 'sllb-nulltxt', kind: 'text', x: rho.n * S + 38, y: H / 2 + 5, text: 'NULL', cls: 'sb-null', anchor: 'middle' });
    }
    return items;
  };
  /** Steps round the loop from a to b (both on the loop) */
  const loopGap = (rho, a, b) => ((rho.order.indexOf(b) - rho.order.indexOf(a)) % rho.lam + rho.lam) % rho.lam;
  const inLoop = (rho, a) => rho.ring && rho.ring.has(a);

  X.topic({
    id: 'sll-floyd-detect', family: 'sll', order: 50, title: 'Detect a loop (Floyd)',
    blurb: 'A tortoise moves one node at a time and a hare two. On a list that ends, the hare finds NULL; on a loop, the hare laps the tortoise and they meet.',
    code: `/* 1 if following next from head goes round in a loop, 0 if it reaches NULL */
int has_cycle(struct node *head)
{
    struct node *slow = head;                         /*@ init-slow */
    struct node *fast = head;                         /*@ init-fast */
    while (fast != NULL && fast->next != NULL) {      /*@ test */
        slow = slow->next;                            /*@ step-slow */
        fast = fast->next->next;                      /*@ step-fast */
        if (slow == fast)                             /*@ compare */
            return 1;                                 /*@ meet */
    }
    return 0;                                         /*@ no-cycle */
}`,
    animate: ['has_cycle'],
    inputs: [Object.assign({}, X.sllValues, { def: [10, 20, 30, 40, 50, 60, 70], max: 8 }), loopIn],
    check: loopCheck,
    presets: [
      { label: 'Loop back to node 3', values: { values: [10, 20, 30, 40, 50, 60, 70], loop: 3 } },
      { label: 'No loop', values: { values: [10, 20, 30, 40, 50, 60], loop: 0 } },
      { label: 'Whole list is a loop', values: { values: [1, 2, 3, 4, 5], loop: 1 } },
      { label: 'Last node points to itself', values: { values: [5, 6, 7, 8], loop: 4 } },
    ],
    counters: ['compares', 'follows'],
    main: (inp) => loopMain(inp, 'has_cycle(head);'),
    capture: capWith(['slow', 'fast']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const rho = rhoOf(ctx);
      const pos = rho.pos;
      const c = curs(ctx);
      const met = tag === 'meet' || (tag === 'after' && ctx.ticks.some((t) => t.tag === 'meet'));
      const items = L.nodes(ctx, d, pos, { cls: (nd) => (met && nd.addr === c.slow ? 'sb-meet' : nd.addr === rho.entry ? 'sb-entry' : '') });
      items.push(...L.links(ctx, d, pos, { ring: rho.ring, cls: (nd, to) => (to === rho.entry && nd.addr === rho.order[rho.n - 1] ? 'sb-fresh' : '') }));
      if (tag !== 'after') items.push(...runners(rho, c, pos));
      if (rho.ring && rho.lam > 1) items.push({ key: 'ringtxt', kind: 'text', x: rho.cx, y: rho.cy + 5, text: 'the loop: ' + L.plural(rho.lam, 'node'), cls: 'sb-muted', anchor: 'middle' });
      const both = rho.ring && c.slow && c.fast && inLoop(rho, c.slow) && inLoop(rho, c.fast);
      const gap = both ? loopGap(rho, c.fast, c.slow) : null;
      if (both && tag !== 'after') items.push({ key: 'gaptxt', kind: 'text', x: rho.cx, y: rho.cy + 26, text: gap ? 'fast is ' + gap + ' behind slow' : 'same node', cls: gap ? 'sb-hot' : 'sb-good', anchor: 'middle' });
      if (met) items.push({ key: 'mettxt', kind: 'text', x: pos.get(c.slow).x + W / 2, y: pos.get(c.slow).y + H + 30, text: 'they meet here', cls: 'sb-good', anchor: 'middle' });
      const nm = (a) => L.nm(d, a);
      const fn = c.fast ? d.nodes.find((x) => x.addr === c.fast) : null;
      const ss = countTags(ctx, 'step-slow');
      let say = '';
      switch (tag) {
        case 'enter': say = rho.n ? 'has_cycle(head). Following next from ' + nm(rho.order[0]) + ' ' + (rho.ring ? 'never reaches NULL: the last node, ' + nm(rho.order[rho.n - 1]) + ', points back to ' + nm(rho.entry) + '. A simple walk would go round for ever.' : 'reaches NULL after ' + L.plural(rho.n, 'node') + '. The function cannot see that in advance.') : 'has_cycle on an empty list.'; break;
        case 'init-slow': say = 'slow, the tortoise, starts at ' + nm(c.slow) + '. It will move one node per round.'; break;
        case 'init-fast': say = 'fast, the hare, starts there too and will move two nodes per round.'; break;
        case 'test': say = !c.fast ? 'fast is NULL: the hare ran off the end, so there is no loop.' : !fn.links.next ? 'fast is on ' + nm(c.fast) + ', whose next is NULL: the list ends, so there is no loop.' : 'fast can still take two steps (' + nm(c.fast) + ' → ' + nm(fn.links.next) + ' → ...): no end in sight yet.' + (both && gap ? ' Both are on the loop now, fast ' + gap + ' behind slow.' : ''); break;
        case 'step-slow': say = 'slow moves one node, to ' + nm(c.slow) + '.'; break;
        case 'step-fast': say = 'fast jumps two nodes, to ' + nm(c.fast) + '.' + (both ? ' Each round fast gains one node on slow round the loop, so the gap is now ' + gap + '.' : ''); break;
        case 'compare': say = c.slow === c.fast ? 'slow == fast: both are on ' + nm(c.slow) + '.' : 'slow is on ' + nm(c.slow) + ', fast on ' + nm(c.fast) + ': not the same node.' + (both ? ' The gap round the loop is ' + gap + '; it shrinks by one each round, so they cannot miss each other.' : ''); break;
        case 'meet': say = 'They meet on ' + nm(c.slow) + ' after ' + L.plural(ss, 'round') + ': only a loop can bring the hare back behind the tortoise. Return 1.'; break;
        case 'no-cycle': say = 'The hare found the end of the list after ' + L.plural(ss, 'round') + '. Return 0: no loop.'; break;
        case 'after': say = met ? 'has_cycle returned 1. It used two pointers and no extra memory: no record of visited nodes was needed.' : 'has_cycle returned 0. On a list without a loop, the hare reaches NULL in about n/2 rounds.'; break;
      }
      return { items, say, slow: tag === 'meet' };
    },
    predict: [
      { at: (t, i, ts, ctx) => t.tag === 'init-fast' && ctx.input.loop > 0, once: true, ask: 'Click the node where slow and fast will meet.', answer: (ts) => { const t = ts.find((x) => x.tag === 'compare' && x.data.cursors.slow === x.data.cursors.fast); return t ? 'n' + t.data.cursors.slow : null; }, explain: () => 'Once both are on the loop, fast gains one node per round, so they meet within one lap of slow.' },
      { at: (t, i, ts, ctx) => t.tag === 'init-fast', once: true, ask: 'Will has_cycle return 1 or 0 for this list?', options: () => ['1: there is a loop', '0: the list ends'], answer: (ts) => (ts.some((x) => x.tag === 'meet') ? '1: there is a loop' : '0: the list ends'), pick: 'option', explain: (ts, i, ctx) => (ctx.input.loop ? 'The last node points back to node ' + ctx.input.loop + ', so the walk never reaches NULL.' : 'The last node points to NULL, which the hare finds first.') },
    ],
    quiz: [
      { q: 'Why can the hare not jump over the tortoise without landing on it?', options: ['It can, sometimes', 'Each round the gap round the loop shrinks by exactly one, so it must reach 0', 'Because the loop is short', 'Because slow waits'], answer: 1, why: 'fast moves 2 and slow 1, so the distance from fast to slow drops by one per round: 3, 2, 1, 0. It never skips 0.' },
      { q: 'How much extra memory does Floyd\'s method use?', options: ['A set of visited nodes', 'Two pointers', 'An array of n flags', 'A copy of the list'], answer: 1, why: 'Only slow and fast. Marking visited nodes would need memory for every node.' },
      { q: 'On a list with no loop and 10 nodes, roughly how many rounds run?', options: ['1', 'About 5', '10', '20'], answer: 1, why: 'The hare covers two nodes per round, so it reaches the end after about n/2 rounds.' },
      { q: 'Why does the loop test fast->next != NULL?', options: ['To find the middle', 'fast->next->next would dereference NULL if fast is the last node', 'To make slow faster', 'It is not needed'], answer: 1, why: 'The hare needs two links ahead to exist before it jumps.' },
      { q: 'A simple walk that stops at NULL, run on a list with a loop, would...', options: ['Stop at the loop\'s start', 'Never stop', 'Crash at once', 'Visit every node once'], answer: 1, why: 'There is no NULL to find, so it goes round the loop for ever.' },
    ],
  });

  X.topic({
    id: 'sll-floyd-remove', family: 'sll', order: 51, title: 'Find and break a loop',
    blurb: 'After the tortoise and hare meet, send one back to the start: walking at the same speed, they meet again exactly where the loop begins. Then cut the link that closes it.',
    code: `/* find where the loop begins and break it there; 1 if there was a loop */
int remove_loop(struct node *head)
{
    struct node *slow = head, *fast = head;           /*@ init */
    while (fast != NULL && fast->next != NULL) {      /*@ test */
        slow = slow->next;                            /*@ step-slow */
        fast = fast->next->next;                      /*@ step-fast */
        if (slow == fast)                             /*@ compare */
            break;                                    /*@ meet */
    }
    if (fast == NULL || fast->next == NULL)           /*@ no-loop-test */
        return 0;                                     /*@ no-loop */
    slow = head;                                      /*@ restart */
    while (slow != fast) {                            /*@ test2 */
        slow = slow->next;                            /*@ step2-slow */
        fast = fast->next;                            /*@ step2-fast */
    }
    while (fast->next != slow)                        /*@ test3 */
        fast = fast->next;                            /*@ step3 */
    fast->next = NULL;                                /*@ cut */
    return 1;                                         /*@ done */
}`,
    animate: ['remove_loop'],
    inputs: [Object.assign({}, X.sllValues, { def: [10, 20, 30, 40, 50, 60, 70], max: 8 }), Object.assign({}, loopIn, { def: 3 })],
    check: loopCheck,
    presets: [
      { label: 'Loop back to node 3', values: { values: [10, 20, 30, 40, 50, 60, 70], loop: 3 } },
      { label: 'Long lead-in, short loop', values: { values: [1, 2, 3, 4, 5, 6, 7], loop: 6 } },
      { label: 'Whole list is a loop', values: { values: [4, 8, 15, 16, 23], loop: 1 } },
      { label: 'No loop', values: { values: [3, 6, 9, 12], loop: 0 } },
    ],
    counters: ['compares', 'follows', 'writes'],
    main: (inp) => loopMain(inp, 'remove_loop(head);'),
    capture: capWith(['slow', 'fast']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const rho = rhoOf(ctx);
      const c = curs(ctx);
      const memo = ctx.memo;
      if (tag === 'meet') memo.meetAt = c.slow;
      const phase2 = ['restart', 'test2', 'step2-slow', 'step2-fast'].includes(tag);
      const phase3 = ['test3', 'step3', 'cut', 'done'].includes(tag);
      // once the loop is broken the list straightens out into a row
      const pos = tag === 'after' && ctx.ticks.some((t) => t.tag === 'cut') ? L.row(rho.order, 0, 0) : rho.pos;
      const straight = pos !== rho.pos;
      const items = L.nodes(ctx, d, pos, {
        cls: (nd) => (nd.addr === rho.entry && (phase3 || straight || (phase2 && c.slow === c.fast)) ? 'sb-entry' : nd.addr === memo.meetAt && !phase3 && !straight ? 'sb-meet' : '') + (phase2 ? ' sb-lbl' : ''),
        label: (nd) => (phase2 && rho.toEntry.get(nd.addr) >= 0 ? (rho.toEntry.get(nd.addr) ? rho.toEntry.get(nd.addr) + ' to go' : 'loop start') : ''),
      });
      const closing = rho.order[rho.n - 1];
      const fn = c.fast ? d.nodes.find((x) => x.addr === c.fast) : null;
      items.push(...L.links(ctx, d, pos, { ring: straight ? null : rho.ring, cls: (nd) => (phase3 && nd.addr === closing && tag !== 'step3' && fn && fn.links.next === c.slow ? 'sb-cut' : '') }));
      if (tag !== 'after') items.push(...runners(rho, c, pos, phase2 ? 22 : 0));
      const title = phase2 ? 'Phase 2: one from the start, one from the meeting point, same speed' : phase3 ? 'Phase 3: find the node that closes the loop' : straight ? '' : rho.n ? 'Phase 1: tortoise and hare' : '';
      if (title) items.push({ key: 'phase', kind: 'text', x: 0, y: rho.ring ? Math.min(-50, rho.cy - rho.R - 60) : -50, text: title, cls: 'sb-phase' });
      if (rho.ring && rho.lam > 1 && !straight) items.push({ key: 'ringtxt', kind: 'text', x: rho.cx, y: rho.cy + 5, text: 'loop of ' + rho.lam, cls: 'sb-muted', anchor: 'middle' });
      const nm = (a) => L.nm(d, a);
      const mu = rho.e;
      let say = '';
      switch (tag) {
        case 'enter': say = rho.ring ? 'remove_loop(head): ' + L.plural(mu, 'node') + ' lead in to a loop of ' + rho.lam + ' that starts at ' + nm(rho.entry) + '. The function knows none of this; it has to find where the loop starts and cut it.' : 'remove_loop(head) on a list that ends in NULL' + (rho.n ? '' : ' (it is empty)') + '.'; break;
        case 'init': say = 'Phase 1 is Floyd\'s detection: slow and fast both start at the first node.'; break;
        case 'test': say = !c.fast || !fn.links.next ? 'fast has reached the end: there is no loop.' : 'fast can jump again.'; break;
        case 'step-slow': say = 'slow moves one node, to ' + nm(c.slow) + '.'; break;
        case 'step-fast': say = 'fast moves two, to ' + nm(c.fast) + '.'; break;
        case 'compare': say = c.slow === c.fast ? 'slow == fast on ' + nm(c.slow) + '.' : 'slow on ' + nm(c.slow) + ', fast on ' + nm(c.fast) + ': not yet.'; break;
        case 'meet': say = 'They meet on ' + nm(c.slow) + ', so there is a loop. But the meeting point is not, in general, where the loop starts' + (c.slow === rho.entry ? ' (here it happens to be)' : ' (that is ' + nm(rho.entry) + ')') + '.'; break;
        case 'no-loop-test': say = !c.fast || !fn.links.next ? 'fast reached the end, so the loop ended without a meeting.' : 'The first loop ended by break, at a meeting point: there is a loop to remove.'; break;
        case 'no-loop': say = 'No loop: return 0 and change nothing.'; break;
        case 'restart': { const k = rho.toEntry.get(c.fast); say = 'slow goes back to the first node; fast stays on the meeting point. The labels show how far each node is from the loop\'s start: slow is ' + mu + ' away, and fast is ' + k + ' away going forward round the loop. They are equal (up to whole laps), so stepping together they arrive at the same moment.'; break; }
        case 'test2': say = c.slow === c.fast ? 'slow == fast: both stand on ' + nm(c.slow) + ', the first node of the loop.' : 'slow (' + nm(c.slow) + ') and fast (' + nm(c.fast) + ') are different nodes: both step once.'; break;
        case 'step2-slow': say = 'slow moves one node, to ' + nm(c.slow) + '.'; break;
        case 'step2-fast': say = 'fast also moves just one node now, to ' + nm(c.fast) + '.'; break;
        case 'test3': say = fn.links.next === c.slow ? 'fast->next is the loop\'s start: fast, on ' + nm(c.fast) + ', is the node that closes the loop. Its link is the one to cut.' : 'fast->next is ' + nm(fn.links.next) + ', not the loop\'s start: keep going round.'; break;
        case 'step3': say = 'fast moves on to ' + nm(c.fast) + '.'; break;
        case 'cut': say = 'fast->next = NULL: ' + nm(c.fast) + ' no longer points back to ' + nm(c.slow) + '. The loop is broken.'; break;
        case 'done': say = 'Return 1: there was a loop and it is gone.'; break;
        case 'after': say = straight ? 'The list straightens out: ' + L.seq(d, rho.order[0]) + ', ending in NULL. Every node is still there; one link changed.' : 'remove_loop returned 0; the list was already fine.'; break;
      }
      return { items, say, slow: tag === 'cut' || tag === 'restart' };
    },
    predict: [
      { at: (t) => t.tag === 'restart', once: true, ask: 'slow restarts from the first node and both now move one step at a time. Click the node where they will meet.', answer: (ts, i, ctx) => (rhoOf(ctx).entry ? 'n' + rhoOf(ctx).entry : null), explain: () => 'They are the same distance from the loop\'s start, so they meet exactly there.' },
      { at: (t, i, ts) => t.tag === 'test3', once: true, ask: 'Click the node whose next will be set to NULL.', answer: (ts, i, ctx) => 'n' + rhoOf(ctx).order[rhoOf(ctx).n - 1], explain: () => 'The node that points back into the loop: the last node of the original list.' },
    ],
    quiz: [
      { q: 'Why does phase 2 find the start of the loop?', options: ['By luck', 'The distance from the head to the loop\'s start equals the distance from the meeting point to it, counted forward (give or take whole laps)', 'Because fast is faster', 'Because the loop is short'], answer: 1, why: 'When they met, fast had gone twice as far as slow; working that through shows head-to-start = meeting-point-to-start mod the loop length.' },
      { q: 'In phase 2, how fast does fast move?', options: ['Two nodes per step', 'One node per step', 'It stays still', 'Three nodes per step'], answer: 1, why: 'Both move one node at a time; only then do equal distances mean arriving together.' },
      { q: 'Which link does remove_loop set to NULL?', options: ['head->next', 'The meeting node\'s next', 'The next of the node that points back to the loop\'s start', 'Every link in the loop'], answer: 2, why: 'That single link is what turns the end of the list back into the loop.' },
      { q: 'If the whole list is a loop, where do the pointers meet in phase 2?', options: ['They never meet', 'At the first node, at once', 'At the last node', 'In the middle'], answer: 1, why: 'The loop starts at the first node; the meeting point is a whole number of laps from it, so fast is already there or slow and fast arrive together at once.' },
    ],
  });
  // ---- remove duplicates ------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-remove-dups', family: 'sll', order: 52, title: 'Remove duplicates',
    blurb: 'For each node, a runner scans the rest of the list for the same value; every copy it finds is unlinked and freed, and the rest of the list closes up.',
    code: `/* remove every repeated value, keeping its first appearance */
void remove_dups(struct node *head)
{
    struct node *curr = head;                         /*@ init-curr */
    struct node *runner, *dup;
    while (curr != NULL) {                            /*@ outer */
        runner = curr;                                /*@ init-runner */
        while (runner->next != NULL) {                /*@ inner */
            if (runner->next->data == curr->data) {   /*@ compare */
                dup = runner->next;                   /*@ mark */
                runner->next = dup->next;             /*@ unlink */
                free(dup);                            /*@ free */
            } else {
                runner = runner->next;                /*@ advance-runner */
            }
        }
        curr = curr->next;                            /*@ advance-curr */
    }
}                                                     /*@ end */`,
    animate: ['remove_dups'],
    inputs: [Object.assign({}, X.sllValues, { def: [3, 7, 3, 5, 7, 3], max: 8 })],
    presets: [
      { label: 'Repeats scattered', values: { values: [3, 7, 3, 5, 7, 3] } },
      { label: 'Sorted, repeats side by side', values: { values: [1, 1, 2, 3, 3, 3] } },
      { label: 'All the same', values: { values: [4, 4, 4, 4] } },
      { label: 'No repeats', values: { values: [9, 2, 6, 1] } },
    ],
    counters: ['compares', 'follows', 'frees'],
    main: (inp) => X.sllMain(inp.values, 'remove_dups(head);'),
    capture: capWith(['curr', 'runner', 'dup']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag;
      const head = ctx.ticks[0].data.roots.head;
      const by = new Map(d.nodes.map((x) => [x.addr, x]));
      const chain = K.chain(d, head).order;
      const pos = L.row(chain, 0, 0);
      const c = curs(ctx);
      // a node just unlinked hovers above the gap it left; a freed one drops below and then goes
      for (const nd of d.nodes) {
        if (pos.has(nd.addr)) continue;
        if (nd.freed && tag !== 'free') continue;
        const after = nd.links.next && pos.has(nd.links.next) ? pos.get(nd.links.next).x : chain.length * S;
        pos.set(nd.addr, { x: after - S / 2, y: nd.freed ? K.ROW + 30 : -K.ROW * 0.8 });
      }
      const ci = chain.indexOf(c.curr);
      const items = L.nodes(ctx, d, pos, { cls: (nd) => (nd.freed ? '' : nd.addr === c.dup ? 'sb-meet' : ci >= 0 && chain.indexOf(nd.addr) >= 0 && chain.indexOf(nd.addr) <= ci ? 'part-a' : '') });
      items.push(...L.links(ctx, d, pos, { skip: (nd) => nd.freed }));
      if (tag !== 'after' && !ctx.tick.end) items.push(...L.tags(pos, [{ name: 'curr', addr: c.curr, cls: 'c-teal' }, { name: 'runner', addr: c.runner, cls: 'c-amber' }, { name: 'dup', addr: c.dup !== undefined && by.has(c.dup) && !by.get(c.dup).freed ? c.dup : undefined, cls: 'c-rose', side: 'above' }], { nullAt: { x: chain.length * S, y: 0 } }));
      const rn = c.runner && by.get(c.runner);
      const target = rn ? rn.links.next : 0;
      if (tag === 'compare' && c.curr && target) {
        const eq = by.get(target).data === by.get(c.curr).data;
        items.push({ key: 'cmp', kind: 'arrow', from: { key: 'n' + c.curr, side: 'top' }, to: { key: 'n' + target, side: 'top' }, bend: -(40 + (pos.get(target).x - pos.get(c.curr).x) * 0.12), noHead: true, cls: 'sb-pair ' + (eq ? 'sb-bad' : 'sb-good'), label: by.get(c.curr).data + (eq ? ' = ' : ' ≠ ') + by.get(target).data });
      }
      const removed = ctx.ticks.slice(0, ctx.i + 1).filter((t) => t.tag === 'free').length;
      items.push({ key: 'rm', kind: 'text', x: 0, y: -150, text: 'removed so far: ' + removed, cls: 'sb-note' });
      const nm = (a) => L.nm(d, a);
      const pc = ctx.prev && ctx.prev.data.cursors ? ctx.prev.data.cursors : {};
      let say = '';
      switch (tag) {
        case 'enter': say = 'remove_dups(head) on ' + L.seq(d, head) + '. The first appearance of each value stays; later copies go.'; break;
        case 'init-curr': say = 'curr starts at ' + nm(c.curr) + '. Everything up to and including curr will be free of repeats.'; break;
        case 'outer': say = c.curr ? 'curr is at ' + nm(c.curr) + ': look for later copies of ' + nm(c.curr) + '.' : 'curr is NULL: every value has had its turn.'; break;
        case 'init-runner': say = 'runner starts at curr. It always stands one node before the one being checked, so that it can unlink that node.'; break;
        case 'inner': say = rn && rn.links.next ? 'runner->next is ' + nm(rn.links.next) + ': check it.' : 'runner is at the last node: no more copies of ' + nm(c.curr) + ' anywhere.'; break;
        case 'compare': { const eq = by.get(target).data === by.get(c.curr).data; say = 'Is runner->next (' + nm(target) + ') the same value as curr (' + nm(c.curr) + ')? ' + (eq ? 'Yes: it is a repeat.' : 'No.'); break; }
        case 'mark': say = 'dup = runner->next: hold on to the repeat ' + nm(c.dup) + ', or its memory could never be freed.'; break;
        case 'unlink': say = 'runner->next = dup->next: ' + nm(c.runner) + ' now skips the copy and points to ' + nm(rn.links.next) + '. The copy lifts out of the list and the rest closes up; its own arrow still points in.'; break;
        case 'free': say = 'free(dup): the copy\'s memory goes back to the heap. runner does not move: its new next has not been checked yet.'; break;
        case 'advance-runner': say = 'runner moves on to ' + nm(c.runner) + '.'; break;
        case 'advance-curr': say = 'curr moves on to ' + nm(c.curr) + '.' + (pc.curr ? ' No copy of ' + nm(pc.curr) + ' is left after it.' : ''); break;
        case 'end': say = 'remove_dups returns. It returns nothing: the first node is never removed, so head in main is still right.'; break;
        case 'after': say = 'The list now reads ' + L.seq(d, head) + ': ' + L.plural(removed, 'node') + ' freed. For each node the runner scanned the rest, so this takes about n²/2 comparisons. On a sorted list the copies sit side by side and one pass would do.'; break;
      }
      return { items, say, slow: tag === 'unlink' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'init-curr', once: true, ask: 'How many nodes will be freed?', options: (ts, i, ctx) => ['0', '1', '2', '3', '4', '5'].slice(0, Math.max(3, ctx.input.values.length)), answer: (ts, i, ctx) => String(ctx.input.values.length - new Set(ctx.input.values).size), pick: 'option', explain: (ts, i, ctx) => 'One for every value after its first appearance: ' + ctx.input.values.length + ' nodes, ' + new Set(ctx.input.values).size + ' different values.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'unlink', once: true, ask: 'runner->next = dup->next is next. Click the node runner will point to afterwards.', answer: (ts, i) => { const d = ts[i].data, by = new Map(d.nodes.map((x) => [x.addr, x])); const nx = by.get(d.cursors.dup).links.next; return nx ? 'n' + nx : null; }, explain: () => 'The node after the copy: runner skips over the copy.' },
    ],
    quiz: [
      { q: 'Why does runner stop one node before the node it checks?', options: ['To save time', 'To unlink a node you need the node before it', 'Because of NULL', 'It does not matter'], answer: 1, why: 'Removing runner->next means changing runner\'s own next field; you cannot reach back to the previous node in a singly linked list.' },
      { q: 'After a copy is freed, why does runner not move on?', options: ['It is a bug', 'Its new next is a node nobody has checked yet', 'runner was freed', 'To avoid a loop'], answer: 1, why: 'runner->next now points to the node after the copy, which may itself be a copy.' },
      { q: 'How many comparisons can this make on n nodes?', options: ['n', 'About n²/2', 'n log n', '2n'], answer: 1, why: 'For each curr, the runner scans everything after it: (n-1) + (n-2) + ... + 1.' },
      { q: 'If the list is sorted, what simpler method works?', options: ['None', 'Compare each node with the next one and unlink the next if equal, in one pass', 'Sort it again', 'Reverse it'], answer: 1, why: 'In a sorted list equal values are neighbours, so one pass comparing neighbours finds them all.' },
      { q: 'What would go wrong with free(runner->next) before runner->next = dup->next?', options: ['Nothing', 'The next field of a freed node would be read: undefined behaviour', 'A memory leak', 'The list would be reversed'], answer: 1, why: 'After free, the node\'s memory must not be touched, but dup->next would still have to be read from it.' },
    ],
  });
  // ---- intersection of two lists ---------------------------------------------------------------------------
  const ownIn = (id, label, def) => ({ id, kind: 'ints', label, def, min: 0, max: 5 });
  X.topic({
    id: 'sll-intersection', family: 'sll', order: 53, title: 'Where two lists meet',
    blurb: 'Two lists that share their tail form a Y. Line their ends up by skipping the longer list\'s extra nodes; then the two pointers step together and arrive at the shared node at the same moment.',
    code: `/* main uses this to make the last node of list point at rest */
struct node *join(struct node *list, struct node *rest)
{
    struct node *p = list;
    if (list == NULL)
        return rest;
    while (p->next != NULL)
        p = p->next;
    p->next = rest;
    return list;
}

int length(struct node *p)
{
    int n = 0;
    while (p != NULL) {
        n++;
        p = p->next;
    }
    return n;
}

/* the first node the two lists share, or NULL if they never meet */
struct node *intersection(struct node *a, struct node *b)
{
    int la = length(a);                  /*@ len-a */
    int lb = length(b);                  /*@ len-b */
    while (la > lb) {                    /*@ skip-a-test */
        a = a->next;                     /*@ walk-skip-a */
        la--;                            /*@ count-a */
    }
    while (lb > la) {                    /*@ skip-b-test */
        b = b->next;                     /*@ walk-skip-b */
        lb--;                            /*@ count-b */
    }
    while (a != b) {                     /*@ compare */
        a = a->next;                     /*@ step-a */
        b = b->next;                     /*@ step-b */
    }
    return a;                            /*@ found */
}`,
    animate: ['intersection'], quiet: ['length'],
    inputs: [ownIn('ownA', 'Only in list a', [3, 6, 9]), ownIn('ownB', 'Only in list b', [15]), ownIn('shared', 'Shared tail', [20, 25])],
    check: (inp) => (inp.ownA.length + inp.ownB.length + inp.shared.length > 9 ? 'At most 9 nodes in all, so the picture stays readable' : null),
    presets: [
      { label: 'A Y shape', values: { ownA: [3, 6, 9], ownB: [15], shared: [20, 25] } },
      { label: 'Same values, other nodes', values: { ownA: [4, 8], ownB: [5, 8], shared: [8, 9] } },
      { label: 'No shared tail', values: { ownA: [1, 2, 3], ownB: [7, 8], shared: [] } },
      { label: 'b starts inside a', values: { ownA: [2, 4, 6], ownB: [], shared: [8, 10] } },
    ],
    counters: ['compares', 'follows'],
    main: (inp) => {
      const init = (v) => (v.length ? '{ ' + v.join(', ') + ' }' : '{ 0 }');
      return `int main(void)
{
    int va[] = ${init(inp.ownA)};
    int vb[] = ${init(inp.ownB)};
    int vc[] = ${init(inp.shared)};
    struct node *common = build(vc, ${inp.shared.length});
    struct node *first = join(build(va, ${inp.ownA.length}), common);
    struct node *second = join(build(vb, ${inp.ownB.length}), common);
    intersection(first, second);
    return 0;
}`;
    },
    capture: (P) => {
      const o = topOf(P, K.capture(P, { type: 'first', roots: ['first', 'second', 'common'], cursors: ['a', 'b'], fields: ['data'], links: ['next'] }));
      o.la = intOr(P, 'la'); o.lb = intOr(P, 'lb');
      return o;
    },
    scene(ctx) {
      const d = Object.assign({}, ctx.tick.data), tag = ctx.tick.tag, inp = ctx.input;
      // la = length(a): the line is recorded as length() returns, before la is set, so read it a step later
      const nx = ctx.ticks[ctx.i + 1] ? ctx.ticks[ctx.i + 1].data : d;
      if (tag === 'len-a') d.la = nx.la;
      if (tag === 'len-b') { d.la = nx.la; d.lb = nx.lb; }
      const t0 = ctx.ticks[0].data;
      const shared = K.chain(t0, t0.roots.common).order;
      const sset = new Set(shared);
      const ownA = K.chain(t0, t0.roots.first).order.filter((x) => !sset.has(x));
      const ownB = K.chain(t0, t0.roots.second).order.filter((x) => !sset.has(x));
      const m = Math.max(ownA.length, ownB.length);
      const RG = 115;
      const pos = new Map();
      ownA.forEach((a, i) => pos.set(a, { x: (m - ownA.length + i) * S, y: -RG }));
      ownB.forEach((a, i) => pos.set(a, { x: (m - ownB.length + i) * S, y: RG }));
      shared.forEach((a, i) => pos.set(a, { x: (m + i) * S, y: 0 }));
      const c = curs(ctx);
      const done = tag === 'found' || tag === 'after';
      const items = L.nodes(ctx, d, pos, { cls: (nd) => (done && nd.addr === c.a && c.a ? 'sb-found' : sset.has(nd.addr) ? 'sb-shared' : ownA.includes(nd.addr) ? 'sb-a' : 'sb-b') });
      items.push(...L.links(ctx, d, pos));
      const total = ownA.length + ownB.length + shared.length;
      if (tag !== 'after') items.push(...L.tags(pos, [{ name: 'a', addr: c.a, cls: 'c-teal', side: 'above' }, { name: 'b', addr: c.b, cls: 'c-amber', side: 'below' }], { nullAt: { x: (m + shared.length) * S, y: 0 } }));
      else if (c.a) items.push({ key: 'cres', kind: 'cursor', at: 'n' + c.a, side: 'below', text: 'returned', cls: 'c-green' });
      // the remaining lengths beside each branch
      const lx = Math.min(m - ownA.length, m - ownB.length, m) * S - 30;
      if (d.la !== null && tag !== 'after') items.push({ key: 'la', kind: 'text', x: lx, y: -RG + H / 2 + 5, text: 'la = ' + d.la, cls: 'sb-note', anchor: 'end' });
      if (d.lb !== null && tag !== 'after') items.push({ key: 'lb', kind: 'text', x: lx, y: RG + H / 2 + 5, text: 'lb = ' + d.lb, cls: 'sb-note', anchor: 'end' });
      // once the lengths agree, a and b stand in the same column: the same distance from the end
      const col = (addr) => (addr && pos.has(addr) ? pos.get(addr).x : addr === 0 ? (m + shared.length) * S : null);
      const aligned = d.la !== null && d.lb !== null && d.la === d.lb && ['skip-b-test', 'compare', 'step-a', 'step-b', 'found', 'skip-a-test', 'count-a', 'count-b'].includes(tag) && col(c.a) !== null && col(c.a) === col(c.b);
      if (aligned) {
        const x = col(c.a) + W / 2;
        items.push({ key: 'align', kind: 'line', x1: x, y1: -RG - 50, x2: x, y2: RG + H + 50, cls: 'sb-align' });
        items.push({ key: 'aligntxt', kind: 'text', x, y: -RG - 60, text: L.plural(d.la, 'node') + ' to the end', cls: 'sb-bracket', anchor: 'middle' });
      }
      const nm = (a) => L.nm(d, a);
      let say = '';
      switch (tag) {
        case 'enter': say = 'intersection(a, b): list a is ' + (K.chain(d, t0.roots.first).order.length ? L.seq(d, t0.roots.first) : 'empty') + ' and list b is ' + (K.chain(d, t0.roots.second).order.length ? L.seq(d, t0.roots.second) : 'empty') + '. ' + (shared.length ? 'They share their last ' + L.plural(shared.length, 'node') + ': the same nodes in memory, not copies.' : 'They share nothing.') + ' The question is which node they first have in common.'; break;
        case 'len-a': say = 'length(a) walks list a: la = ' + d.la + ', shared nodes included.'; break;
        case 'len-b': say = 'length(b) walks list b: lb = ' + d.lb + '. ' + (d.la === d.lb ? 'The same length: no skipping needed.' : 'List ' + (d.la > d.lb ? 'a' : 'b') + ' is longer by ' + Math.abs(d.la - d.lb) + '. Those extra nodes cannot be in the shared part, which both lists end with.'); break;
        case 'skip-a-test': say = d.la > d.lb ? 'la = ' + d.la + ' > lb = ' + d.lb + ': a is further from the end than b, so a skips a node.' : 'la = ' + d.la + ' is not more than lb = ' + d.lb + '.'; break;
        case 'walk-skip-a': say = 'a moves on to ' + nm(c.a) + '.'; break;
        case 'count-a': say = 'la = ' + d.la + '.' + (d.la === d.lb ? ' Now a and b are the same distance from the end: they stand in the same column.' : ''); break;
        case 'skip-b-test': say = d.lb > d.la ? 'lb = ' + d.lb + ' > la = ' + d.la + ': b skips a node.' : d.la === d.lb ? 'The lengths agree (' + d.la + ' each): from here a and b are equally far from the end.' : ''; break;
        case 'walk-skip-b': say = 'b moves on to ' + nm(c.b) + '.'; break;
        case 'count-b': say = 'lb = ' + d.lb + '.' + (d.la === d.lb ? ' Now a and b are the same distance from the end.' : ''); break;
        case 'compare': say = c.a === c.b ? (c.a ? 'a == b: both point at the same node, ' + nm(c.a) + '. This is where the lists meet.' : 'a and b are both NULL: they reached the end together without meeting. There is no shared node.') : 'a (' + nm(c.a) + ') and b (' + nm(c.b) + ') are different nodes' + (c.a && c.b && by(d, c.a).data === by(d, c.b).data ? ', even though they hold the same value: the test compares addresses, not values' : '') + '. Step both.'; break;
        case 'step-a': say = 'a moves to ' + nm(c.a) + '...'; break;
        case 'step-b': say = '...and b to ' + nm(c.b) + ', so they stay in the same column.'; break;
        case 'found': say = c.a ? 'Return ' + nm(c.a) + ': the first node of the shared tail.' : 'Return NULL: the lists do not meet.'; break;
        case 'after': say = c.a ? 'intersection returned ' + nm(c.a) + '. Each list was walked once to count it and once more to the meeting point: O(la + lb) time, no extra memory.' : 'intersection returned NULL. ' + total + ' nodes, none shared.'; break;
      }
      return { items, say, slow: tag === 'found' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'len-a' && ts[i + 2], once: true, ask: 'How many nodes will the longer list skip before the two pointers walk together?', options: () => ['0', '1', '2', '3', '4', '5'], answer: (ts, i) => String(Math.abs(ts[i + 2].data.la - ts[i + 2].data.lb)), pick: 'option', explain: () => 'The difference of the two lengths: the extra nodes at the front of the longer list.' },
      { at: (t, i, ts, ctx) => t.tag === 'compare' && ctx.input.shared.length > 0, once: true, ask: 'Click the node where a and b will meet.', answer: (ts, i, ctx) => { const t = ts.find((x) => x.tag === 'compare' && x.data.cursors.a && x.data.cursors.a === x.data.cursors.b); return t ? 'n' + t.data.cursors.a : null; }, explain: () => 'The first node of the shared tail: from the same column, they reach it together.' },
    ],
    quiz: [
      { q: 'Why skip the extra nodes of the longer list first?', options: ['To save memory', 'So that both pointers are the same distance from the end and reach the shared part together', 'To sort the lists', 'To find the middle'], answer: 1, why: 'The shared part is at the end of both lists. Starting equally far from the end, stepping together puts them on the first shared node at the same time.' },
      { q: 'Lists a: 4 8 [8 9] and b: 5 8 [8 9], where [8 9] is shared. Where do a and b meet?', options: ['On the first 8 of a', 'On the shared 8', 'On 9', 'They do not meet'], answer: 1, why: 'The test a != b compares addresses. The 8 nodes before the shared part are different nodes with the same value.' },
      { q: 'If the lists share nothing, what happens?', options: ['An infinite loop', 'a and b reach NULL at the same moment, and NULL is returned', 'A crash', 'The first node is returned'], answer: 1, why: 'After skipping they are equally far from NULL, so both become NULL together and a == b ends the loop.' },
      { q: 'Can two singly linked lists meet and then split apart again?', options: ['Yes', 'No: a shared node has only one next, so after meeting they stay together', 'Only if sorted', 'Only with a loop'], answer: 1, why: 'Every node has one next pointer, so once both lists reach the same node they follow the same path: a Y, never an X.' },
    ],
  });
  const by = (d, a) => d.nodes.find((x) => x.addr === a) || {};
  // ---- palindrome --------------------------------------------------------------------------------------------
  X.topic({
    id: 'sll-palindrome', family: 'sll', order: 54, title: 'Is it a palindrome?',
    blurb: 'Find the middle, turn the second half round, and compare from both ends inwards, pair by pair. Then turn the second half back so the list is left as it was.',
    code: `/* turn a list round and return its new first node (see Reverse) */
struct node *reverse(struct node *head)
{
    struct node *prev = NULL, *next;
    while (head != NULL) {
        next = head->next;
        head->next = prev;
        prev = head;
        head = next;
    }
    return prev;
}

/* 1 if the values read the same both ways; the list is left as it was */
int is_palindrome(struct node *head)
{
    struct node *slow = head, *fast = head;           /*@ init */
    struct node *second, *p, *q;
    int result = 1;                                   /*@ result */
    if (head == NULL)                                 /*@ empty */
        return 1;                                     /*@ trivial */
    while (fast->next != NULL && fast->next->next != NULL) {   /*@ test */
        slow = slow->next;                            /*@ step-slow */
        fast = fast->next->next;                      /*@ step-fast */
    }
    second = reverse(slow->next);                     /*@ reverse */
    p = head;                                         /*@ init-p */
    q = second;                                       /*@ init-q */
    while (q != NULL) {                               /*@ test-q */
        if (p->data != q->data) {                     /*@ compare */
            result = 0;                               /*@ mismatch */
            break;                                    /*@ stop */
        }
        p = p->next;                                  /*@ step-p */
        q = q->next;                                  /*@ step-q */
    }
    slow->next = reverse(second);                     /*@ restore */
    return result;                                    /*@ done */
}`,
    animate: ['is_palindrome'], quiet: ['reverse'],
    inputs: [Object.assign({}, X.sllValues, { def: [1, 2, 3, 2, 1], max: 8 })],
    presets: [
      { label: 'Odd palindrome', values: { values: [1, 2, 3, 2, 1] } },
      { label: 'Even palindrome', values: { values: [4, 7, 7, 4] } },
      { label: 'Not a palindrome', values: { values: [1, 2, 3, 4, 2, 1] } },
      { label: 'One node', values: { values: [5] } },
    ],
    counters: ['compares', 'follows', 'writes'],
    main: (inp) => X.sllMain(inp.values, 'is_palindrome(head);'),
    capture: capWith(['slow', 'fast', 'second', 'p', 'q'], (P) => ({ result: intOr(P, 'result') })),
    scene(ctx) {
      const tag = ctx.tick.tag, n = ctx.input.values.length;
      const d = Object.assign({}, ctx.tick.data);
      // second = reverse(...): the line is recorded as reverse() returns, so second is read a step later
      const c = Object.assign({}, curs(ctx));
      if (tag === 'reverse' && ctx.ticks[ctx.i + 1]) c.second = ctx.ticks[ctx.i + 1].data.cursors.second;
      const pos = L.fixed(ctx, d, ctx.ticks[0].data.roots.head);
      const order = ctx.memo['sllb-fixed:list'];
      const idx = (a) => order.indexOf(a);
      const memo = ctx.memo;
      if ((tag === 'reverse') && memo.half === undefined) memo.half = idx(c.slow);
      const cut = memo.half !== undefined ? memo.half : -1;
      const items = L.nodes(ctx, d, pos, { cls: (nd) => (cut < 0 ? '' : idx(nd.addr) <= cut ? 'part-a' : 'part-b') });
      // the turned arrows dip only a little under the row, leaving room for the pointer tags
      items.push(...L.links(ctx, d, pos, { cls: (nd, to) => (idx(to) < idx(nd.addr) ? 'part-b' : ''), route: (nd, to, p, q) => (q.x < p.x ? { loop: 30 } : null) }));
      // every pair compared so far stays as an arc: a rainbow from the two ends inwards
      memo.pairs = memo.pairs || [];
      if (tag === 'compare' && c.p && c.q && !memo.pairs.some((x) => x.p === c.p)) memo.pairs.push({ p: c.p, q: c.q });
      const by = new Map(d.nodes.map((x) => [x.addr, x]));
      memo.pairs.forEach((pr, j) => {
        const vp = by.get(pr.p).data, vq = by.get(pr.q).data, eq = vp === vq;
        const span = pos.get(pr.q).x - pos.get(pr.p).x;
        items.push({ key: 'pair' + j, kind: 'arrow', from: { key: 'n' + pr.p, side: 'top' }, to: { key: 'n' + pr.q, side: 'top' }, noHead: true, bend: -(30 + span * 0.18), cls: 'sb-pair ' + (eq ? 'sb-good' : 'sb-bad'), label: vp + (eq ? ' = ' : ' ≠ ') + vq });
      });
      const phase1 = ['init', 'result', 'empty', 'test', 'step-slow', 'step-fast'].includes(tag);
      const list = phase1 ? [{ name: 'slow', addr: c.slow }, { name: 'fast', addr: c.fast }] : [{ name: 'p', addr: c.p, cls: 'c-teal' }, { name: 'q', addr: c.q, cls: 'c-amber' }, { name: 'second', addr: c.second, cls: 'c-violet' }, { name: 'slow', addr: tag === 'restore' || tag === 'reverse' ? c.slow : undefined }];
      if (tag !== 'after') items.push(...L.tags(pos, list, { nullAt: { x: n * S, y: 0 } }));
      const title = phase1 ? '1. find the end of the first half' : ['reverse'].includes(tag) ? '2. turn the second half round' : ['init-p', 'init-q', 'test-q', 'compare', 'mismatch', 'stop', 'step-p', 'step-q'].includes(tag) ? '3. compare pairs from both ends' : ['restore', 'done'].includes(tag) ? '4. turn it back' : '';
      if (title && n > 1) items.push({ key: 'phase', kind: 'text', x: 0, y: -40 - Math.min(160, 40 + n * 22), text: title, cls: 'sb-phase' });
      const nm = (a) => L.nm(d, a);
      const result = ctx.ticks.some((t) => t.tag === 'mismatch') ? 0 : 1;
      const fn = c.fast ? by.get(c.fast) : null;
      let say = '';
      switch (tag) {
        case 'enter': say = 'is_palindrome(head) on ' + (n ? L.seq(d, order[0]) : 'an empty list') + '. With an array you would compare a[i] with a[n-1-i]; a singly linked list cannot walk backwards, so its second half will be turned round instead.'; break;
        case 'init': say = 'slow and fast start at the first node, to find the middle.'; break;
        case 'result': say = 'result = 1: a palindrome until a pair proves otherwise.'; break;
        case 'empty': say = n ? 'The list is not empty.' : 'An empty list reads the same both ways.'; break;
        case 'trivial': say = 'Return 1.'; break;
        case 'test': say = fn && fn.links.next && by.get(fn.links.next).links.next ? 'fast can jump two more nodes, so slow moves on too.' : 'fast cannot jump two more: slow, on ' + nm(c.slow) + ', is the last node of the first half.'; break;
        case 'step-slow': say = 'slow moves to ' + nm(c.slow) + '.'; break;
        case 'step-fast': say = 'fast jumps to ' + nm(c.fast) + '.'; break;
        case 'reverse': say = c.second ? 'second = reverse(slow->next): the second half is turned round in place, every arrow at once. second now points at the old last node, ' + nm(c.second) + ', and following next from it walks back towards the middle.' + (n % 2 ? ' The middle node, ' + nm(c.slow) + ', has no partner and is never compared.' : '') : 'second = reverse(NULL): with one node there is no second half.'; break;
        case 'init-p': say = 'p starts at the front: ' + nm(c.p) + '.'; break;
        case 'init-q': say = 'q starts at the back (the front of the reversed half): ' + (c.q ? nm(c.q) : 'NULL') + '.'; break;
        case 'test-q': say = c.q ? 'q is at ' + nm(c.q) + ': another pair to compare.' : 'q is NULL: every pair has been compared.'; break;
        case 'compare': { const eq = by.get(c.p).data === by.get(c.q).data; say = 'Pair ' + memo.pairs.length + ': ' + nm(c.p) + (eq ? ' = ' : ' ≠ ') + nm(c.q) + '. ' + (eq ? 'They match; move both inwards.' : 'They differ, so the list is not a palindrome.'); break; }
        case 'mismatch': say = 'result = 0.'; break;
        case 'stop': say = 'break: no need to compare more pairs. But the list must still be put back.'; break;
        case 'step-p': say = 'p moves inwards to ' + nm(c.p) + '...'; break;
        case 'step-q': say = '...and q moves inwards to ' + nm(c.q) + '.'; break;
        case 'restore': say = 'slow->next = reverse(second): the second half is turned back round and joined to the first half again, so the caller gets its list back as it was.'; break;
        case 'done': say = 'Return ' + result + '.'; break;
        case 'after': say = 'is_palindrome returned ' + result + ' (' + (result ? 'it is a palindrome' : 'it is not a palindrome') + '). The list reads ' + (n ? L.seq(d, order[0]) : 'nothing') + ' again: O(n) time and no extra memory, at the price of changing the list for a while.'; break;
      }
      return { items, say, slow: tag === 'reverse' || tag === 'restore' };
    },
    predict: [
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'reverse' && ts[i].data.cursors.slow && ts[i + 1].data && true, once: true, ask: 'reverse(slow->next) is next. Which node will second point at? Click it.', answer: (ts, i) => { const t = ts[i + 2]; return t && t.data.cursors.second ? 'n' + t.data.cursors.second : null; }, explain: () => 'The last node of the list: after the second half is turned round, it comes first.' },
      { at: (t) => t.tag === 'init-q', once: true, ask: 'Will the list turn out to be a palindrome?', options: () => ['Yes', 'No'], answer: (ts) => (ts.some((x) => x.tag === 'mismatch') ? 'No' : 'Yes'), pick: 'option', explain: (ts, i, ctx) => 'Read it both ways: ' + ctx.input.values.join(' ') + ' and ' + ctx.input.values.slice().reverse().join(' ') + '.' },
    ],
    quiz: [
      { q: 'Why is the second half reversed?', options: ['To sort it', 'A singly linked list cannot be walked backwards, so the back half is turned round to be walked from the end', 'To find the middle', 'To free memory'], answer: 1, why: 'After reversal, following next from the old last node moves towards the middle, matching p moving from the front.' },
      { q: 'In 1 2 3 2 1, which node is never compared?', options: ['The first 1', 'The 3 in the middle', 'The last 1', 'Every node is compared'], answer: 1, why: 'With an odd length the middle node is its own mirror image; q runs out after two pairs.' },
      { q: 'Why turn the second half back at the end?', options: ['It is required for the answer', 'The caller expects its list unchanged; leaving it half reversed would break it', 'To free the nodes', 'It is not needed'], answer: 1, why: 'A function that only answers a question should not leave the data changed.' },
      { q: 'What does this method cost in extra memory, compared with copying the values to a stack?', options: ['The same: O(n)', 'O(1) instead of O(n)', 'More', 'O(log n)'], answer: 1, why: 'It only uses a few pointers; a stack of the values would need room for n/2 or n of them.' },
    ],
  });
})(SEE);
