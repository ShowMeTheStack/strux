// Binary tree properties: mirror, identical, balanced, lowest common ancestor.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, T = X.TreeKit, B = X.BtProp;

  // ---- mirror ------------------------------------------------------------------------------------------------
  X.topic({
    id: 'bt-mirror', family: 'btprop', order: 30, title: 'Mirror a tree',
    blurb: 'Swap the two children of every node and the whole tree flips left to right. Three pointer moves per node, and for one moment a subtree hangs only by tmp.',
    code: `/* turn the tree into its mirror image */
void mirror(struct node *root)
{
    struct node *tmp;
    if (root == NULL)                 /*@ test */
        return;                       /*@ base */
    tmp = root->left;                 /*@ save */
    root->left = root->right;         /*@ move-right */
    root->right = tmp;                /*@ move-left */
    mirror(root->left);               /*@ go-left */
    mirror(root->right);              /*@ go-right */
}`,
    animate: ['mirror'], quiet: ['new_node'],
    inputs: [B.levelInput('tree', null, [4, 2, 7, 1, 3, 6, 9])],
    presets: [
      { label: 'Search tree', values: { tree: [4, 2, 7, 1, 3, 6, 9] } },
      { label: 'Lopsided', values: { tree: [1, 2, 3, 4, -1, -1, -1, 5, 6] } },
      { label: 'A chain to the left', values: { tree: [3, 2, -1, 1] } },
      { label: 'One node', values: { tree: [8] } },
      { label: 'Empty tree', values: { tree: [] } },
    ],
    counters: ['writes'],
    main: (inp) => B.main(inp.tree, 'mirror(tree);'),
    capture: B.capture(['tmp']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo;
      const end = ctx.tick.end;
      const { fr, top, ret, key } = B.step(ctx, 'mirror', 'root', ['go-left'], ['go-right'], (tg) => (tg === 'base' || end ? 1 : undefined), ['base']);
      memo.done = memo.done || new Set();
      if (ret && ret.f.node) memo.done.add(ret.f.node);
      // while a node's two pointers are being moved, the picture keeps its places, so the arrows swing first
      // and the subtrees glide over only once both pointers are right again
      let pos;
      if (tag === 'move-right' && memo.pos) pos = memo.pos;
      else { pos = T.layout(d, { root: d.root }); memo.pos = pos; }
      const path = B.pathSet(fr);
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      const held = top && top.node && top.vars.tmp ? top.vars.tmp : 0;
      const inside = (a, r) => { if (!a || !r) return false; let hit = false; const go = (c) => { if (!c || hit || !by.has(c)) return; if (c === a) hit = true; go(by.get(c).links.left); go(by.get(c).links.right); }; go(r); return hit; };
      const loose = tag === 'move-right' && held;
      const pic = T.picture(ctx, d, {
        rootName: 'tree', pos,
        nodeCls: (n) => 'bp-lab ' + (top && n.addr === top.node ? 'focus' : loose && inside(n.addr, held) ? 'hot' : memo.done.has(n.addr) ? 'part-a' : path.has(n.addr) ? 'part-b' : ''),
        label: (n) => (memo.done.has(n.addr) ? '✓' : ''),
      });
      const items = pic.items;
      // the keys as they read from left to right: reversed by the end
      const order = [...pos.entries()].filter(([a, p]) => !p.off && by.has(a)).sort((u, v) => u[1].x - v[1].x).map(([a]) => key(a));
      const maxY = Math.max(0, ...[...pos.values()].map((p) => p.y));
      if (order.length && tag !== 'move-right') items.push({ key: 'order', kind: 'text', x: 0, y: maxY + 90, text: 'left to right: ' + order.join('  '), cls: 'bp-big' });
      if (loose) {
        // both pointers lead to the same child: bend one so both can be seen
        const e = items.find((it) => it.key === 'e' + top.node + 'left');
        if (e) { e.bend = -34; e.cls += ' hot'; }
      }
      if (held && ['save', 'move-right', 'move-left'].includes(tag)) {
        items.push({ key: 'ctmp', kind: 'cursor', at: 'n' + held, side: 'left', text: 'tmp', cls: 'c-violet' });
      }
      if (top && !top.node) items.push(...B.nullSpot(pos, top, 'hot'));
      if (ret && !ret.f.node) items.push(...B.nullSpot(pos, ret.f, ''));
      items.push(...B.stack(fr, (f) => [
        { text: 'mirror(' + key(f.node) + ')', w: 2 },
        { text: f.node ? 'tmp ' + (f.vars.tmp === undefined ? '?' : f.vars.tmp ? 'at ' + key(f.vars.tmp) : 'NULL') : '', w: 1.6, cls: 'link' },
      ], { w: 240 }));
      const k = top ? key(top.node) : '', pk = top && top.parent ? key(top.parent) : '';
      const tn = top && top.node ? by.get(top.node) : null;
      const kid = (a) => (a ? key(a) : 'NULL');
      let say = '';
      if (end && ret) say = 'mirror(' + key(ret.f.node) + ') is finished: every node under ' + key(ret.f.node) + ' has had its children swapped.' + (top ? ' Back in mirror(' + key(top.node) + ').' : '');
      else switch (tag) {
        case 'enter': say = top && top.node ? 'mirror(tree) starts at ' + k + '. Each call swaps the two children of its node, then lets the recursion do the same below.' : 'mirror(tree) on an empty tree.'; break;
        case 'test': say = top.node ? 'Node ' + k + ' has left = ' + kid(tn.links.left) + ' and right = ' + kid(tn.links.right) + '.' : 'An empty subtree' + (top.parent ? ' of ' + pk : '') + ': nothing to swap.'; break;
        case 'base': say = 'Return at once.'; break;
        case 'save': say = top.vars.tmp ? 'tmp = root->left: tmp now also points at ' + kid(top.vars.tmp) + '. Without this copy, the next line would lose that subtree for good.' : 'tmp = root->left, which is NULL. ' + (tn.links.right ? 'Only the right side of ' + k + ' has a child.' : k + ' is a leaf: the swap will change nothing, but the code does not need to know that.'); break;
        case 'move-right': say = 'root->left = root->right. ' + (tn.links.left ? 'Both pointers of ' + k + ' now lead to ' + kid(tn.links.left) + '.' : 'The left pointer of ' + k + ' is NULL, as before or now.') + (held ? ' The old left subtree, ' + key(held) + ', is held only by tmp.' : ''); break;
        case 'move-left': say = 'root->right = tmp. ' + (tn.links.left || tn.links.right ? 'The two subtrees of ' + k + ' have traded places, each taking all of its nodes along.' : 'Both children of ' + k + ' are still NULL.'); break;
        case 'go-left': say = 'The subtrees of ' + pk + ' are swapped, but not yet mirrored inside. ' + (top.node ? 'mirror(' + k + ') does the new left side.' : 'Its new left side is empty.'); break;
        case 'go-right': say = top.node ? 'Now mirror(' + k + '), the new right side of ' + pk + '.' : 'The new right side of ' + pk + ' is empty.'; break;
        case 'after': say = d.root ? 'The tree is mirrored: read it left to right and the keys come in the reverse order. Each node was visited once, with three pointer moves.' : 'An empty tree is its own mirror.'; break;
      }
      if (!say && end) say = 'The call is finished.';
      return { items, say, calls: B.callsTab(d, 'mirror', ['root', 'tmp']), slow: tag === 'move-left' };
    },
    predict: [
      { at: (t) => t.tag === 'move-right', once: true,
        ask: 'If the line before (tmp = root->left) were missing, what would this line do?', options: () => ['Nothing bad', 'The left subtree would be lost: nothing would point to it', 'The program would not compile'], pick: 'option',
        answer: () => 'The left subtree would be lost: nothing would point to it',
        explain: () => 'root->left is overwritten here. tmp is the only other way back to that subtree.' },
      { at: (t) => t.tag === 'save' && (() => { const c = B.topCall(t, 'mirror'); const n = t.data.nodes.find((x) => x.addr === c.args.root); return n && n.links.right; })(), once: true,
        ask: 'Once the three moves are done, which node will be the left child of the node being swapped? Click it.',
        answer: (ts, i) => { const d = ts[i].data; const c = B.topCall(ts[i], 'mirror'); const n = d.nodes.find((x) => x.addr === c.args.root); return n && n.links.right ? 'n' + n.links.right : null; },
        explain: () => 'The old right child: root->left = root->right moves it over.' },
    ],
    quiz: [
      { q: 'Why is tmp needed?', options: ['To count the nodes', 'Because root->left is overwritten before root->right can take its old value', 'C needs a variable for every pointer', 'It is not needed'], answer: 1, why: 'A swap through assignments needs a third place to keep one value while the other moves.' },
      { q: 'An in-order walk of the original tree gives 1 2 3 4 6 7 9. What does it give after mirror()?', options: ['1 2 3 4 6 7 9', '9 7 6 4 3 2 1', '4 7 2 9 6 3 1', 'It depends on the shape'], answer: 1, why: 'Left and right swap everywhere, so the in-order walk runs backwards.' },
      { q: 'Would it still work if the two recursive calls came before the swap?', options: ['Yes', 'No'], answer: 0, why: 'Then the subtrees are mirrored first and swapped afterwards. Every node still has its children swapped exactly once.' },
      { q: 'What happens if mirror() is called twice on the same tree?', options: ['The tree is back as it was', 'The tree is mirrored twice as much', 'Crash', 'All nodes go left'], answer: 0, why: 'Swapping the children of every node twice undoes it.' },
    ],
  });

  // ---- identical ---------------------------------------------------------------------------------------------
  /** Places for the nodes of one tree only, from x0 */
  const layoutOne = (d, root, x0) => {
    const all = T.layout(d, { root, x0 });
    const by = new Map(d.nodes.map((n) => [n.addr, n]));
    const out = new Map();
    const go = (a) => { if (!a || !by.has(a) || out.has(a)) return; out.set(a, all.get(a)); go(by.get(a).links.left); go(by.get(a).links.right); };
    go(root);
    return out;
  };
  const twoTrees = (vals2) => (inp) => `int main(void)
{
    int a[] = ${B.cArray(inp.first)};
    int b[] = ${B.cArray(inp.second)};
    struct node *first = build(a, ${inp.first.length || 1});
    struct node *second = build(b, ${inp.second.length || 1});
    if (same(first, second))
        printf("identical\\n");
    else
        printf("different\\n");
    return 0;
}`;
  X.topic({
    id: 'bt-identical', family: 'btprop', order: 31, title: 'Are two trees identical?',
    blurb: 'Two fingers walk the two trees in lock-step, one pair of nodes at a time. The first difference in shape or in key settles it, and the rest is never looked at.',
    code: `/* 1 if the trees have the same shape and the same keys, else 0 */
int same(struct node *a, struct node *b)
{
    if (a == NULL && b == NULL)        /*@ both-empty */
        return 1;                      /*@ yes-empty */
    if (a == NULL || b == NULL)        /*@ one-empty */
        return 0;                      /*@ no-shape */
    if (a->key != b->key)              /*@ compare */
        return 0;                      /*@ no-key */
    if (!same(a->left, b->left))       /*@ go-left */
        return 0;                      /*@ no-left */
    return same(a->right, b->right);   /*@ go-right */
}`,
    animate: ['same'], quiet: ['new_node'],
    inputs: [B.levelInput('first', 'First tree', [5, 3, 8, 1, 4, -1, 9], 9, 4), B.levelInput('second', 'Second tree', [5, 3, 8, 1, 4, -1, 9], 9, 4)],
    presets: [
      { label: 'Identical', values: { first: [5, 3, 8, 1, 4, -1, 9], second: [5, 3, 8, 1, 4, -1, 9] } },
      { label: 'One key differs', values: { first: [5, 3, 8, 1, 4, -1, 9], second: [5, 3, 8, 1, 6, -1, 9] } },
      { label: 'Same keys, other shape', values: { first: [2, 1, 3], second: [2, 1, -1, -1, 3] } },
      { label: 'Early difference', values: { first: [5, 3, 8, 1, 4, 7, 9], second: [5, 2, 8, 1, 4, 7, 9] } },
      { label: 'Both empty', values: { first: [], second: [] } },
    ],
    counters: ['compares'],
    main: twoTrees(),
    capture(P) {
      const d = T.capture(P, { type: 'first', root: 'first', roots: ['second'], fields: ['key'] });
      d.calls = P.calls([]);
      return d;
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo;
      const { fr, top, ret, key } = B.step(ctx, 'same', 'a', ['go-left'], ['go-right'], (tg, f, t, last) => (tg === 'yes-empty' ? 1 : ['no-shape', 'no-key', 'no-left'].includes(tg) ? 0 : tg === 'after' || tg === 'go-right' || tg === '' ? last : undefined), ['yes-empty', 'no-shape', 'no-key', 'no-left']);
      const A = d.root || 0, Bt = d.roots.second || 0;
      const posA = layoutOne(d, A, 0);
      const wA = posA.size ? Math.max(...[...posA.values()].map((p) => p.x)) : 0;
      const posB = layoutOne(d, Bt, wA + 3 * B.DX);
      const pos = new Map([...posA, ...posB]);
      memo.seen = memo.seen || new Set();
      memo.match = memo.match || [];
      memo.bad = memo.bad || null;
      if (top) { if (top.vars.a) memo.seen.add(top.vars.a); if (top.vars.b) memo.seen.add(top.vars.b); }
      if (tag === 'go-left' && fr.length > 1) {
        const p = fr[fr.length - 2];
        if (!memo.match.some((m) => m[0] === p.vars.a)) memo.match.push([p.vars.a, p.vars.b]);
      }
      if (ret && ret.v === 0 && !memo.bad) memo.bad = [ret.f.vars.a, ret.f.vars.b, ctx.tick.tag];
      const matched = new Set(memo.match.flat());
      const bad = memo.bad ? new Set(memo.bad.slice(0, 2).filter(Boolean)) : new Set();
      const finished = tag === 'after';
      const cur = top ? [top.vars.a, top.vars.b] : [];
      if (ret && ['yes-empty', 'no-shape', 'no-key'].includes(tag)) cur.push(ret.f.vars.a, ret.f.vars.b);
      const pic = T.picture(ctx, Object.assign({}, d, { root: undefined }), {
        pos,
        nodeCls: (n) => 'bp-lab ' + (bad.has(n.addr) ? 'bp-bad' : cur.includes(n.addr) ? 'focus' : matched.has(n.addr) ? 'bp-good' : finished && !memo.seen.has(n.addr) ? 'bp-dim' : ''),
      });
      const items = pic.items;
      // the two root pointers
      const rootBox = (name, a, x) => {
        const p = pos.get(a);
        const bx = p ? p.x - 35 : x;
        items.push({ key: 'rb' + name, kind: 'node', x: bx, y: -92, w: 70, h: 32, cells: [{ text: a ? '' : 'NULL', port: 'p', cls: 'link' + (a ? '' : ' null') }], label: name, cls: 'root c-indigo' });
        if (p) items.push({ key: 'ra' + name, kind: 'arrow', from: { key: 'rb' + name, port: 'p' }, to: { key: 'n' + a }, cls: 'root-arrow c-indigo' });
      };
      rootBox('first', A, 0);
      rootBox('second', Bt, wA + 3 * B.DX);
      // where a call stands in each tree (a node, or the empty spot under its parent)
      const spotIn = (f, which, p0) => {
        if (!f) return null;
        const a = f.vars[which];
        if (a && pos.get(a)) return pos.get(a);
        const j = fr.indexOf(f);
        const par = j > 0 ? fr[j - 1].vars[which] : j < 0 && top ? top.vars[which] : 0;
        const pp = par && pos.get(par);
        if (!pp) return p0;
        return { x: pp.x + (f.side === 'left' ? -0.42 : 0.42) * B.DX, y: pp.y + 0.62 * B.DY, empty: true, par, side: f.side };
      };
      // on a return line the pair that just answered stays in view
      const pairF = ret && ['yes-empty', 'no-shape', 'no-key'].includes(tag) ? ret.f : top;
      const sa = spotIn(pairF, 'a', { x: 0, y: 0 }), sb = spotIn(pairF, 'b', { x: wA + 3 * B.DX, y: 0 });
      const nullAt = (s, nm) => {
        if (!s || !s.empty) return;
        items.push({ key: 'nl' + nm, kind: 'ring', x: s.x, y: s.y, r: 13, cls: 'bp-null hot' });
        items.push({ key: 'nlt' + nm, kind: 'text', x: s.x, y: s.y + 30, text: 'NULL', anchor: 'middle', cls: 'bp-nullmark' });
      };
      if (pairF) {
        nullAt(sa, 'a'); nullAt(sb, 'b');
        const lineCls = tag === 'no-key' || tag === 'no-shape';
        items.push({ key: 'pair', kind: 'arrow', from: { key: sa.empty ? 'nla' : 'n' + pairF.vars.a }, to: { key: sb.empty ? 'nlb' : 'n' + pairF.vars.b }, bend: -80, noHead: true, cls: lineCls ? 'bad' : 'hot' });
        items.push({ key: 'ca', kind: 'cursor', x: sa.x, y: sa.y - 26, tx: sa.x, ty: sa.y - 48, text: 'a', cls: 'c-rose' });
        items.push({ key: 'cb', kind: 'cursor', x: sb.x, y: sb.y - 26, tx: sb.x, ty: sb.y - 48, text: 'b', cls: 'c-teal' });
      }
      if (ret) {
        const from = ret.f.vars.a && pos.get(ret.f.vars.a) ? pos.get(ret.f.vars.a) : sa || { x: 0, y: 0 };
        const to = top ? spotIn(top, 'a', from) : { x: from.x, y: from.y - 60 };
        items.push(B.flyUp('ret' + ctx.i, from, to, ret.v, ret.v ? 'c-green' : 'bp-red', -30));
      }
      const ka = top ? key(top.vars.a) : '', kb = top ? key(top.vars.b) : '';
      const popped = ret ? Math.max(0, (memo.prevN || 0) - fr.length - 1) : 0;
      memo.prevN = fr.length;
      let say = '';
      switch (tag) {
        case 'enter': say = 'same(first, second): a walks the first tree, b walks the second, always to the same place.'; break;
        case 'both-empty': say = !top.vars.a && !top.vars.b ? 'a and b are both NULL: two empty subtrees, in the same place.' : 'a is ' + ka + ', b is ' + kb + ': not both empty.'; break;
        case 'yes-empty': say = 'Two empty trees are identical: return 1.'; break;
        case 'one-empty': say = !top.vars.a || !top.vars.b ? 'Only one of them is NULL: ' + (top.vars.a ? 'the second tree has no node where the first has ' + ka : 'the first tree has no node where the second has ' + kb) + '.' : 'Neither is NULL, so there are two keys to compare.'; break;
        case 'no-shape': say = 'The shapes differ here: return 0.'; break;
        case 'compare': say = 'Compare the keys: ' + ka + (top.vars.a && top.vars.b && key(top.vars.a) === key(top.vars.b) ? ' = ' + kb + '. They match; now the subtrees must match too.' : ' ≠ ' + kb + '.'); break;
        case 'no-key': say = 'Different keys: return 0. Nothing below this pair needs looking at.'; break;
        case 'go-left': say = 'Both fingers move to the left children together: ' + ka + ' and ' + kb + '.'; break;
        case 'no-left': say = 'The left subtrees differ, so the trees differ. The right subtrees are skipped.'; break;
        case 'go-right': say = 'The left subtrees matched. Both fingers move to the right children: ' + ka + ' and ' + kb + '.'; break;
        case 'after': {
          const unseen = d.nodes.filter((n) => !memo.seen.has(n.addr)).length;
          say = memo.bad ? 'Different: the first difference is at the red pair. ' + (unseen ? unseen + ' node' + (unseen === 1 ? ' was' : 's were') + ' never looked at (faded).' : 'It came at the very last pair.') : 'Identical: every pair matched, down to the empty subtrees.';
          break;
        }
      }
      const tail = ret && !['yes-empty', 'no-shape', 'no-key', 'no-left', 'after'].includes(tag);
      if (tail) say = 'same(' + key(ret.f.vars.a) + ', ' + key(ret.f.vars.b) + ') hands back the ' + ret.v + ' from its right children unchanged' + (popped ? ', and so ' + (popped === 1 ? 'does the call' : 'do the ' + popped + ' calls') + ' above it' : '') + ': it was returning same(a->right, b->right). ' + say;
      else if (ret && popped) say += ' The ' + (popped === 1 ? 'call' : popped + ' calls') + ' waiting on it pass' + (popped === 1 ? 'es' : '') + ' the same ' + ret.v + ' straight up.';
      if (!say && ret) say = 'same(' + key(ret.f.vars.a) + ', ' + key(ret.f.vars.b) + ') returns ' + ret.v + '.';
      return { items, say, calls: B.callsTab(d, 'same', ['a', 'b']), slow: tag === 'no-key' || tag === 'no-shape' };
    },
    predict: [
      { at: (t) => t.tag === 'compare', once: true, ask: 'Which pair of nodes will be compared right after this one, if the keys match? Click the node in the first tree.',
        answer: (ts, i) => { const c = B.topCall(ts[i], 'same'); const n = ts[i].data.nodes.find((x) => x.addr === c.args.a); return n && n.links.left ? 'n' + n.links.left : null; },
        explain: () => 'The left children come next, in both trees at once.' },
      { at: (t, i, ts) => i === 0 && ts.length > 4, once: true, ask: 'Will same() return 1 or 0 for these two trees?', options: () => ['1: identical', '0: different'], pick: 'option',
        answer: (ts) => { const last = ts[ts.length - 1]; void last; let bad = false; for (let j = 1; j < ts.length; j++) if (['no-shape', 'no-key'].includes(ts[j].tag)) bad = true; return bad ? '0: different' : '1: identical'; },
        explain: () => 'Compare the shapes first, then the keys, level by level.' },
    ],
    quiz: [
      { q: 'Two trees have the same keys in the same in-order sequence. Are they identical?', options: ['Always', 'Not necessarily: the shapes can differ', 'Only if they are search trees', 'Never'], answer: 1, why: '2 with left child 1 and right child 3, and 1 with right child 2 with right child 3: same in-order, different trees.' },
      { q: 'Why test "a == NULL && b == NULL" before "a == NULL || b == NULL"?', options: ['It is faster', 'Otherwise two empty subtrees would be reported as different', 'C requires it', 'It does not matter'], answer: 1, why: 'Both NULL also makes the || test true. The order lets the "both empty" case answer 1 first.' },
      { q: 'What is the worst case running time for trees of n nodes each?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], answer: 2, why: 'When the trees are identical every pair is visited once.' },
      { q: 'In the best case, how many pairs does same() compare?', options: ['One: the roots differ', 'n', 'log n', 'Two'], answer: 0, why: 'If the root keys differ it returns 0 at once.' },
    ],
  });

  // ---- balanced ----------------------------------------------------------------------------------------------
  X.topic({
    id: 'bt-balanced', family: 'btprop', order: 32, title: 'Is it height-balanced?',
    blurb: 'At every node the two subtree heights may differ by at most 1. A small beam at each node tips towards the heavier side; the first node where it tips too far raises an alarm, -1, that runs straight to the top.',
    code: `/* the height of the tree, or -1 if somewhere the two subtrees
   of a node differ in height by more than 1 */
int check(struct node *root)
{
    int lh, rh;
    if (root == NULL)                     /*@ test */
        return 0;                         /*@ base */
    lh = check(root->left);               /*@ go-left */
    if (lh == -1)                         /*@ left-bad */
        return -1;                        /*@ pass-left */
    rh = check(root->right);              /*@ go-right */
    if (rh == -1)                         /*@ right-bad */
        return -1;                        /*@ pass-right */
    if (lh - rh > 1 || rh - lh > 1)       /*@ compare */
        return -1;                        /*@ tipped */
    return 1 + (lh > rh ? lh : rh);       /*@ ret */
}`,
    animate: ['check'], quiet: ['new_node'],
    inputs: [B.levelInput('tree', null, [10, 5, 20, 3, 7, -1, 30, 2, -1, -1, -1, -1, -1, 1])],
    presets: [
      { label: 'Tips over deep down', values: { tree: [10, 5, 20, 3, 7, -1, 30, 2, -1, -1, -1, -1, -1, 1] } },
      { label: 'Balanced', values: { tree: [8, 4, 12, 2, 6, 10, -1, 1] } },
      { label: 'Root tips, children fine', values: { tree: [5, 3, 8, 2, 4, -1, -1, 1] } },
      { label: 'A chain of three', values: { tree: [1, -1, 2, -1, 3] } },
      { label: 'Empty tree', values: { tree: [] } },
    ],
    counters: ['compares'],
    main: (inp) => B.main(inp.tree, 'if (check(tree) == -1)\n        printf("not balanced\\n");\n    else\n        printf("balanced\\n");'),
    capture: B.capture(['lh', 'rh']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo;
      const { fr, top, ret, key } = B.step(ctx, 'check', 'root', ['go-left'], ['go-right'], (tg, f) => (tg === 'base' ? 0 : ['pass-left', 'pass-right', 'tipped'].includes(tg) ? -1 : tg === 'ret' ? 1 + Math.max(f.vars.lh, f.vars.rh) : undefined), ['base', 'pass-left', 'pass-right', 'tipped', 'ret']);
      memo.h = memo.h || {};
      memo.seen = memo.seen || new Set();
      if (top && top.node) memo.seen.add(top.node);
      if (ret && ret.f.node) memo.h[ret.f.node] = ret.v;
      if (tag === 'tipped' && ret && !memo.flag) memo.flag = { node: ret.f.node, lh: ret.f.vars.lh, rh: ret.f.vars.rh };
      const path = B.pathSet(fr);
      const finished = tag === 'after';
      const flag = memo.flag ? memo.flag.node : 0;
      const pic = T.picture(ctx, d, {
        rootName: 'tree',
        nodeCls: (n) => 'bp-lab ' + (n.addr === flag ? 'bp-bad' : top && n.addr === top.node ? 'focus' : memo.h[n.addr] === -1 ? 'bp-bad' : memo.h[n.addr] !== undefined ? 'part-a' : path.has(n.addr) ? 'part-b' : finished && !memo.seen.has(n.addr) ? 'bp-dim' : ''),
        label: (n) => (memo.h[n.addr] === -1 ? (n.addr === flag ? '-1 here' : '-1') : memo.h[n.addr] !== undefined ? 'h = ' + memo.h[n.addr] : ''),
      });
      const items = pic.items, pos = pic.pos;
      if (top && !top.node) items.push(...B.nullSpot(pos, top, 'hot'));
      if (ret && !ret.f.node) items.push(...B.nullSpot(pos, ret.f, ''));
      if (ret && top) items.push(B.flyUp('ret' + ctx.i, B.spot(pos, ret.f), B.spot(pos, top), ret.v, ret.v === -1 ? 'bp-red' : 'c-amber', ret.f.side === 'left' ? -30 : 30));
      // the beam: tilted towards the taller side, red when the difference is more than 1
      const beam = (a, lh, rh, k) => {
        const p = pos.get(a);
        if (!p) return;
        const diff = Math.max(-3, Math.min(3, lh - rh));
        const bad = Math.abs(lh - rh) > 1;
        // above the node, on the side away from the edge that comes down from its parent
        const par = d.nodes.find((m) => m.links.left === a || m.links.right === a);
        const cx = p.x + (par && par.links.right === a ? 40 : -40), y = p.y - 44, dy = diff * 7;
        items.push({ key: 'beam' + k, kind: 'line', x1: cx - 28, y1: y + dy, x2: cx + 28, y2: y - dy, cls: 'bp-beam ' + (bad ? 'bp-red' : 'bp-green') });
        items.push({ key: 'beamf' + k, kind: 'token', x: cx, y: y + 6, r: 5, cls: bad ? 'bp-red' : 'c-green' });
        items.push({ key: 'beaml' + k, kind: 'text', x: cx - 33, y: y + dy + 5, text: String(lh), anchor: 'end', cls: bad ? 'bp-bad' : 'bp-good' });
        items.push({ key: 'beamr' + k, kind: 'text', x: cx + 33, y: y - dy + 5, text: String(rh), cls: bad ? 'bp-bad' : 'bp-good' });
      };
      if (tag === 'compare' && top) beam(top.node, top.vars.lh, top.vars.rh, 'c');
      if (memo.flag && tag !== 'compare') beam(memo.flag.node, memo.flag.lh, memo.flag.rh, 'f');
      items.push(...B.stack(fr, (f) => [
        { text: 'check(' + key(f.node) + ')', w: 2.2 },
        { text: f.node ? 'lh ' + (f.vars.lh === undefined ? '?' : f.vars.lh) : '', w: 1, cls: 'link' },
        { text: f.node ? 'rh ' + (f.vars.rh === undefined ? '?' : f.vars.rh) : '', w: 1, cls: 'link' },
      ], { w: 260, x: -340 }));
      const k = top ? key(top.node) : '', pk = top && top.parent ? key(top.parent) : '';
      let say = '';
      switch (tag) {
        case 'enter': say = 'check(tree) works out heights from the bottom up, like height(), and tests the balance at every node on the way.'; break;
        case 'test': say = top.node ? 'Node ' + k + '.' : 'An empty subtree' + (top.parent ? ' of ' + pk : '') + ': height 0, and nothing in it can be out of balance.'; break;
        case 'base': say = 'It returns 0.'; break;
        case 'go-left': say = top.node ? 'First the left subtree of ' + pk + ', at ' + k + '.' : pk + ' has no left child.'; break;
        case 'left-bad': say = top.vars.lh === -1 ? 'The left subtree of ' + k + ' answered -1: something in it is out of balance.' : 'The left subtree of ' + k + ' is fine, with height ' + top.vars.lh + '.'; break;
        case 'pass-left': case 'pass-right': say = (ret ? key(ret.f.node) : '') + ' passes the -1 straight up without looking any further. ' + (tag === 'pass-left' ? 'Its right subtree is never checked.' : ''); break;
        case 'go-right': say = top.node ? 'Now the right subtree of ' + pk + ', at ' + k + '.' : pk + ' has no right child.'; break;
        case 'right-bad': say = top.vars.rh === -1 ? 'The right subtree of ' + k + ' answered -1.' : 'The right subtree of ' + k + ' is fine, with height ' + top.vars.rh + '.'; break;
        case 'compare': { const df = Math.abs(top.vars.lh - top.vars.rh); say = 'At ' + k + ': left height ' + top.vars.lh + ', right height ' + top.vars.rh + '. They differ by ' + df + (df > 1 ? ', more than 1: ' + k + ' is out of balance.' : df === 1 ? ', which is allowed.' : ': level.'); break; }
        case 'tipped': say = key(ret ? ret.f.node : 0) + ' returns -1 instead of a height. From here on, every caller just passes the -1 up.'; break;
        case 'ret': say = ret ? key(ret.f.node) + ' is balanced and returns its height, ' + ret.v + '.' : ''; break;
        case 'after': say = !d.root ? 'An empty tree is balanced.' : memo.flag ? 'Not balanced. The first node found out of balance was ' + key(memo.flag.node) + ', with subtree heights ' + memo.flag.lh + ' and ' + memo.flag.rh + '. The faded nodes were never checked.' : 'Balanced: at every node the two heights differ by at most 1. Each node was visited once.'; break;
      }
      return { items, say, calls: B.callsTab(d, 'check', ['root']), slow: tag === 'tipped' || tag === 'compare' && top && Math.abs(top.vars.lh - top.vars.rh) > 1 };
    },
    predict: [
      { at: (t) => { const c = B.topCall(t, 'check'); return t.tag === 'right-bad' && c.args.rh !== -1 && c.args.lh !== -1 && c.args.lh !== c.args.rh; }, once: true,
        ask: (t) => { const c = B.topCall(t, 'check'); return 'Heights ' + c.args.lh + ' and ' + c.args.rh + '. Is this node in balance?'; }, options: () => ['Yes', 'No'], pick: 'option',
        answer: (ts, i) => { const c = B.topCall(ts[i], 'check'); return Math.abs(c.args.lh - c.args.rh) > 1 ? 'No' : 'Yes'; },
        explain: () => 'A difference of 0 or 1 is allowed; 2 or more is not.' },
      { at: (t, i, ts) => i === 0 && ts.some((x) => x.tag === 'tipped'), once: true, ask: 'Click the node that will be found out of balance first.',
        answer: (ts) => { for (let j = 0; j < ts.length; j++) if (ts[j].tag === 'compare' && Math.abs(B.topCall(ts[j], 'check').args.lh - B.topCall(ts[j], 'check').args.rh) > 1) return 'n' + B.topCall(ts[j], 'check').args.root; return null; },
        explain: () => 'Heights are checked bottom up, so the lowest node that tips (in postorder) is caught first.' },
    ],
    quiz: [
      { q: 'Can a tree be unbalanced even though the root\'s two subtrees have the same height?', options: ['No', 'Yes: a node lower down can tip'], answer: 1, why: 'The rule holds at every node. Two tall thin chains under the root have equal heights but are badly out of balance inside.' },
      { q: 'Why return -1 instead of a separate flag?', options: ['-1 is never a real height, so one int carries both answers', 'C cannot return two values', 'It is faster to compare', 'No reason'], answer: 0, why: 'Heights are 0 or more, so -1 is free to mean "out of balance".' },
      { q: 'What does checking height(left) and height(right) separately at every node cost on a chain?', options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], answer: 2, why: 'Each node would measure its whole subtree again. This version gets each height once, so it is O(n).' },
      { q: 'Which tree is balanced?', options: ['A chain of 3 nodes', 'A root with one child', 'A root whose left subtree has height 2 and right is empty', 'A single path of length 4'], answer: 1, why: 'A root with one child: heights 1 and 0 differ by 1. The others all have a node with a difference of 2 or more.' },
    ],
  });

  // ---- lowest common ancestor --------------------------------------------------------------------------------
  const lcaInputs = [
    B.levelInput('tree', null, [3, 5, 1, 6, 2, 0, 8, -1, -1, 7, 4]),
    { id: 'x', kind: 'int', label: 'x', def: 7, lo: 0, hi: 99 },
    { id: 'y', kind: 'int', label: 'y', def: 8, lo: 0, hi: 99 },
  ];
  X.topic({
    id: 'bt-lca', family: 'btprop', order: 40, title: 'Lowest common ancestor',
    blurb: 'Each call reports up what it found: x, y, or nothing. The node where a report from the left meets a report from the right is the lowest common ancestor.',
    code: `/* the deepest node with both x and y in its subtree
   (both keys are in the tree) */
struct node *lca(struct node *root, int x, int y)
{
    struct node *l, *r;
    if (root == NULL)                          /*@ test */
        return NULL;                           /*@ base */
    if (root->key == x || root->key == y)      /*@ match */
        return root;                           /*@ found */
    l = lca(root->left, x, y);                 /*@ go-left */
    r = lca(root->right, x, y);                /*@ go-right */
    if (l != NULL && r != NULL)                /*@ both */
        return root;                           /*@ split */
    return l != NULL ? l : r;                  /*@ pass */
}`,
    animate: ['lca'], quiet: ['new_node'],
    inputs: lcaInputs,
    check: (inp) => {
      const keys = inp.tree.filter((v) => v !== -1);
      if (!keys.includes(inp.x) || !keys.includes(inp.y)) return 'x and y must both be keys in the tree';
      if (inp.x === inp.y) return 'pick two different keys for x and y';
      return null;
    },
    presets: [
      { label: 'Split high up', values: { tree: [3, 5, 1, 6, 2, 0, 8, -1, -1, 7, 4], x: 7, y: 8 } },
      { label: 'Split lower down', values: { tree: [3, 5, 1, 6, 2, 0, 8, -1, -1, 7, 4], x: 6, y: 4 } },
      { label: 'One is above the other', values: { tree: [3, 5, 1, 6, 2, 0, 8, -1, -1, 7, 4], x: 5, y: 4 } },
      { label: 'A chain', values: { tree: [1, 2, -1, 3, -1, 4], x: 4, y: 3 } },
    ],
    counters: ['compares'],
    main: (inp) => B.main(inp.tree, 'anc = lca(tree, ' + inp.x + ', ' + inp.y + ');\n    printf("lca = %d\\n", anc->key);', 'struct node *anc;'),
    capture: B.capture(['l', 'r']),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, memo = ctx.memo, inp = ctx.input;
      const { fr, top, ret, key } = B.step(ctx, 'lca', 'root', ['go-left'], ['go-right'], (tg, f) => (tg === 'base' ? 0 : tg === 'found' || tg === 'split' ? f.node : tg === 'pass' ? (f.vars.l ? f.vars.l : f.vars.r || 0) : undefined), ['base', 'found', 'split', 'pass']);
      memo.gave = memo.gave || {};
      memo.carry = memo.carry || [];
      memo.seen = memo.seen || new Set();
      if (top && top.node) memo.seen.add(top.node);
      if (ret && ret.f.node) {
        memo.gave[ret.f.node] = ret.v;
        if (ret.v && top) memo.carry.push([ret.f.node, top.node, ret.v]);
      }
      const by = new Map(d.nodes.map((n) => [n.addr, n]));
      const xa = d.nodes.find((n) => n.key === inp.x), ya = d.nodes.find((n) => n.key === inp.y);
      const xA = xa ? xa.addr : 0, yA = ya ? ya.addr : 0;
      if (tag === 'split' && ret) memo.split = ret.f.node;
      const path = B.pathSet(fr);
      const finished = tag === 'after';
      const answer = finished ? memo.gave[d.root] : 0;
      const pic = T.picture(ctx, d, {
        rootName: 'tree',
        nodeCls: (n) => 'bp-lab ' + (n.addr === xA ? 'bp-x' : n.addr === yA ? 'bp-y' : top && n.addr === top.node ? 'focus' : n.addr === memo.split ? 'bp-good' : path.has(n.addr) ? 'part-b' : finished && !memo.seen.has(n.addr) ? 'bp-dim' : ''),
        label: (n) => (memo.gave[n.addr] !== undefined ? '↑ ' + (memo.gave[n.addr] ? key(memo.gave[n.addr]) : 'NULL') : ''),
      });
      const items = pic.items, pos = pic.pos;
      if (top && top.node && top.node !== xA && top.node !== yA) { const f = items.find((it) => it.key === 'n' + top.node); if (f) f.cls += ' focus'; }
      // the reports that travelled up: an edge glows in the colour of what it carried
      for (const [c, p, v] of memo.carry) {
        const cls = v === xA ? 'bp-x' : v === yA ? 'bp-y' : 'bp-green';
        items.push(...B.glow(pos, [p, c], cls, 'c'));
      }
      if (top && !top.node) items.push(...B.nullSpot(pos, top, 'hot'));
      if (ret && !ret.f.node) items.push(...B.nullSpot(pos, ret.f, ''));
      if (ret && top) items.push(B.flyUp('ret' + ctx.i, B.spot(pos, ret.f), B.spot(pos, top), ret.v ? key(ret.v) : 'NULL', !ret.v ? 'bp-gray' : ret.v === xA ? 'c-rose' : ret.v === yA ? 'c-teal' : 'c-green', ret.f.side === 'left' ? -32 : 32));
      if (answer && pos.get(answer)) items.push({ key: 'halo', kind: 'ring', x: pos.get(answer).x, y: pos.get(answer).y, r: 33, cls: 'bp-halo' });
      items.push({ key: 'lgxd', kind: 'token', x: -340, y: -116, r: 13, text: 'x', cls: 'c-rose' });
      items.push({ key: 'lgx', kind: 'text', x: -320, y: -110, text: '= ' + inp.x, cls: 'bp-big' });
      items.push({ key: 'lgyd', kind: 'token', x: -250, y: -116, r: 13, text: 'y', cls: 'c-teal' });
      items.push({ key: 'lgy', kind: 'text', x: -230, y: -110, text: '= ' + inp.y, cls: 'bp-big' });
      const ptr = (v) => (v === undefined ? '?' : v ? key(v) : 'NULL');
      items.push(...B.stack(fr, (f) => [
        { text: 'lca(' + key(f.node) + ')', w: 1.8 },
        { text: f.node ? 'l ' + ptr(f.vars.l) : '', w: 1.2, cls: 'link' },
        { text: f.node ? 'r ' + ptr(f.vars.r) : '', w: 1.2, cls: 'link' },
      ], { w: 270, x: -350 }));
      const k = top ? key(top.node) : '', pk = top && top.parent ? key(top.parent) : '';
      let say = '';
      switch (tag) {
        case 'enter': say = 'lca(tree, ' + inp.x + ', ' + inp.y + '): look for ' + inp.x + ' and ' + inp.y + ' everywhere, and let each call report what its subtree contains.'; break;
        case 'test': say = top.node ? 'Node ' + k + '.' : 'An empty subtree' + (top.parent ? ' of ' + pk : '') + ': neither key can be in it.'; break;
        case 'base': say = 'It reports NULL: found nothing.'; break;
        case 'match': say = key(top.node) === inp.x || key(top.node) === inp.y ? k + ' is one of the two keys.' : k + ' is neither ' + inp.x + ' nor ' + inp.y + '.'; break;
        case 'found': say = (ret ? key(ret.f.node) : '') + ' reports itself. The search does not go below it: if the other key is down there, this node is the answer anyway.'; break;
        case 'go-left': say = top.node ? 'Search the left subtree of ' + pk + ', from ' + k + '.' : pk + ' has no left child.'; break;
        case 'go-right': say = 'The left of ' + pk + ' reported ' + ptr(fr.length > 1 ? fr[fr.length - 2].vars.l : 0) + '. ' + (top.node ? 'Now the right subtree, from ' + k + '.' : 'Its right side is empty.'); break;
        case 'both': say = 'At ' + k + ': the left reported ' + ptr(top.vars.l) + ', the right reported ' + ptr(top.vars.r) + '. ' + 'Are both reports non-NULL?'; break;
        case 'split': say = 'Yes: one key on each side, so ' + (ret ? key(ret.f.node) : '') + ' is where their paths meet. It is the lowest common ancestor, and reports itself.'; break;
        case 'pass': say = ret ? key(ret.f.node) + ' passes up ' + (ret.v ? key(ret.v) : 'NULL') + (ret.v ? ', the only thing found below it.' : ': nothing below it.') : ''; break;
        case 'after': say = 'The lowest common ancestor of ' + inp.x + ' and ' + inp.y + ' is ' + key(memo.gave[d.root]) + '. ' + (memo.split ? 'The two reports met there, one from each side.' : 'One key was an ancestor of the other, so it is the answer itself.'); break;
      }
      return { items, say, calls: B.callsTab(d, 'lca', ['root', 'l', 'r']), slow: tag === 'split' || tag === 'found' };
    },
    predict: [
      { at: (t, i) => i === 0, once: true, ask: 'Click the node you think is the lowest common ancestor.',
        answer: (ts) => { const last = ts[ts.length - 1]; for (let j = ts.length - 1; j > 0; j--) if (ts[j].tag === 'found' || ts[j].tag === 'split' || ts[j].tag === 'pass') { const c = B.topCall(ts[j - 1], 'lca'); if (c && ts[j].data.calls.filter((x) => x.fn === 'lca').length === 0) { if (ts[j].tag === 'pass') return 'n' + (c.args.l || c.args.r); return 'n' + c.args.root; } } void last; return null; },
        explain: () => 'Follow both keys up towards the root: the first node on both paths is the answer.' },
      { at: (t) => t.tag === 'both', once: true, ask: (t) => { const c = B.topCall(t, 'lca'); const k = B.keyOf(t.data); return 'The left reported ' + (c.args.l ? k(c.args.l) : 'NULL') + ' and the right ' + (c.args.r ? k(c.args.r) : 'NULL') + '. What will this call return?'; },
        options: (ts, i) => { const c = B.topCall(ts[i], 'lca'); const k = B.keyOf(ts[i].data); return [...new Set(['NULL', k(c.args.root), c.args.l ? k(c.args.l) : 'NULL', c.args.r ? k(c.args.r) : 'NULL'])]; }, pick: 'option',
        answer: (ts, i) => { const c = B.topCall(ts[i], 'lca'); const k = B.keyOf(ts[i].data); return c.args.l && c.args.r ? k(c.args.root) : c.args.l ? k(c.args.l) : c.args.r ? k(c.args.r) : 'NULL'; },
        explain: () => 'Both sides found something: return this node. One side: pass its report up. Neither: NULL.' },
    ],
    quiz: [
      { q: 'x is an ancestor of y. What does lca return?', options: ['The root', 'x', 'y', 'The parent of x'], answer: 1, why: 'x is the deepest node with both in its subtree. The code returns x as soon as it meets it, without looking further down.' },
      { q: 'Why can the search stop at a node holding x without looking below it?', options: ['Because y is never below x', 'If y is below, x is the answer; if not, the answer is higher and only needs to know x is here', 'To save memory', 'It cannot; that is a bug'], answer: 1, why: 'Either way, reporting x is enough for the ancestors to decide.' },
      { q: 'At which node do a non-NULL report from the left and one from the right meet?', options: ['At the root always', 'At the lowest common ancestor', 'At x', 'At a leaf'], answer: 1, why: 'x is on one side of it and y on the other, so it is the deepest node containing both.' },
      { q: 'How long does this take on a tree of n nodes?', options: ['O(log n)', 'O(n)', 'O(n²)', 'O(1)'], answer: 1, why: 'In the worst case every node is visited once. In a search tree the keys could guide one path instead.' },
    ],
  });
})(SEE);
