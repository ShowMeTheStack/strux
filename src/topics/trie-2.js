// Tries: listing the words with a prefix (walk down, then a depth-first walk below) and deleting a
// word (clear its flag, then free the nodes that lead nowhere, from the bottom up).
(function (SEE) {
  'use strict';
  const X = SEE.Strux, TK = X.TrieKit;
  const word = (inp, id) => String(inp[id] || '').trim();
  const q = (s) => '"' + s + '"';
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  /** The letters in buf[0..len-1], wherever buf lives (an array in one frame, a pointer in another) */
  const bufText = (P, len) => {
    const v = P.find('buf');
    if (!v || len === null || len < 0) return '';
    const t = SEE.Types.unqual(v.type);
    const addr = t.k === 'ptr' ? P.read(t, v.addr) : v.addr;
    let s = '';
    for (let k = 0; k < len && k < 16; k++) { const c = P.vm.mem.peek(1, addr + k); s += c >= 97 && c <= 122 ? String.fromCharCode(c) : '?'; }
    return s;
  };

  // ---- words with a prefix ---------------------------------------------------------------------------------
  X.topic({
    id: 'trie-prefix', family: 'trie', order: 30, title: 'All words with a prefix',
    blurb: 'Walk down to the node for the prefix: every word that starts with it lives in the subtree below. A depth-first walk of that subtree spells them out, letter by letter, in alphabetical order.',
    code: `/* the first letter at or after c that has a child, or ALPHA if none */
int next_child(const struct trie *t, int c)
{
    while (c < ALPHA && t->child[c] == NULL)
        c++;
    return c;
}

/* print every word under t; buf[0..depth-1] spells the path to t */
int collect(const struct trie *t, char buf[], int depth)
{
    int c, count = t->end;                           /*@ visit */
    if (t->end) {                                    /*@ test-end */
        buf[depth] = '\\0';                           /*@ cut */
        printf("%s\\n", buf);                         /*@ found */
    }
    for (c = next_child(t, 0); c < ALPHA; c = next_child(t, c + 1)) {   /*@ child */
        buf[depth] = 'a' + c;                        /*@ push */
        count += collect(t->child[c], buf, depth + 1);   /*@ descend */
    }
    return count;                                    /*@ return */
}

/* how many stored words start with prefix (they are printed too) */
int with_prefix(const struct trie *root, const char *prefix)
{
    const struct trie *cur = root;                   /*@ start */
    char buf[16];
    int i;
    for (i = 0; prefix[i] != '\\0'; i++) {            /*@ next */
        buf[i] = prefix[i];                          /*@ copy */
        cur = cur->child[prefix[i] - 'a'];           /*@ step */
        if (cur == NULL)                             /*@ test */
            return 0;                                /*@ none */
    }
    return collect(cur, buf, i);                     /*@ collect */
}`,
    animate: ['with_prefix'], quiet: ['next_child'],
    inputs: [X.trieWords('car card care cart cat do dog'), X.trieWord('prefix', 'Prefix', 'car', true)],
    presets: [
      { label: 'A prefix that is a word too', values: { words: 'car card care cart cat do dog', prefix: 'car' } },
      { label: 'A short prefix', values: { words: 'car card care cart cat do dog', prefix: 'd' } },
      { label: 'No word has it', values: { words: 'car card care cart cat do dog', prefix: 'cow' } },
      { label: 'Empty prefix: every word', values: { words: 'cat cow do dog', prefix: '' } },
    ],
    counters: ['follows'],
    main: (inp) => X.trieMain(inp.words, 'printf("%d words\\n", with_prefix(root, ' + q(word(inp, 'prefix')) + '));'),
    capture(P) {
      const o = TK.capture(P, { root: 'root', cursors: ['cur'], stack: { fn: 'collect', name: 't' } });
      const fn = P.frames[0].name;
      o.fn = fn;
      o.i = fn === 'with_prefix' ? TK.ptr(P, 'i', 0) : null;
      o.depth = fn === 'collect' ? TK.ptr(P, 'depth', 0) : null;
      o.count = fn === 'collect' ? TK.ptr(P, 'count', 0) : null;
      o.c = fn === 'collect' ? TK.ptr(P, 'c', 0) : null;
      // the letters spelled so far: up to depth (plus the one just pushed)
      const len = fn === 'collect' ? o.depth + 1 : o.i !== null ? o.i + 1 : 0;
      o.buf = bufText(P, len);
      o.str = fn === 'collect' && o.depth !== null ? P.str(P.val('buf'), o.depth + 1) : '';
      return o;
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, pre = word(ctx.input, 'prefix'), memo = ctx.memo;
      memo.out = memo.out || [];
      memo.seen = memo.seen || new Set();
      if (tag === 'found' && !memo.out.includes(d.str)) memo.out.push(d.str);
      const inCollect = d.fn === 'collect';
      const t = inCollect ? d.stack[0] : null;
      if (t) memo.seen.add(t);
      if (d.cursors.cur) memo.preNode = d.cursors.cur;
      if (tag === 'none') memo.none = true;
      // where the walk down stopped: the node for the prefix
      const preNode = inCollect || tag === 'collect' || tag === 'after' ? memo.preNode : null;
      const stack = new Set(d.stack);
      const below = preNode ? new Set(TK.words(d, preNode)) : new Set();
      const pic = TK.picture(ctx, d, {
        nodeCls: (n) => (n.addr === t ? 'tr-cur' : stack.has(n.addr) ? 'tr-stack' : !inCollect && n.addr === d.cursors.cur && tag !== 'after' ? 'tr-cur' : memo.seen.has(n.addr) ? 'tr-path' : ''),
        edgeCls: (p, c) => (stack.has(p.addr) && stack.has(c.addr) ? 'tr-stack' : ''),
      });
      const items = pic.items;
      // the subtree that holds every answer, shaded
      if (preNode && pic.pos.get(preNode)) {
        const sub = [];
        const by = pic.by;
        const go = (a) => { const n = by.get(a); if (!n) return; sub.push(pic.pos.get(a)); for (const k of n.kids) go(k.addr); };
        go(preNode);
        const xs = sub.filter(Boolean).map((p) => p.x), ys = sub.filter(Boolean).map((p) => p.y);
        const x0 = Math.min(...xs) - 36, x1 = Math.max(...xs) + 36, y0 = Math.min(...ys) - 36, y1 = Math.max(...ys) + 52;
        items.unshift({ key: 'tsub', kind: 'region', x: x0, y: y0, w: x1 - x0, h: y1 - y0, cls: 'tr-sub', text: '' });
        items.push({ key: 'tsubT', kind: 'text', x: (x0 + x1) / 2, y: y1 + 20, text: pre ? 'every word starting ' + q(pre) : 'every word', cls: 'hp-note', anchor: 'middle' });
      }
      const rootX = pic.pos.get(d.root) ? pic.pos.get(d.root).x : 0;
      // buf: the prefix (indigo) and then the letters the walk below adds and takes away
      if (tag === 'push') memo.pushC = d.c;
      const len = inCollect ? (tag === 'push' ? d.depth + 1 : d.depth) : tag === 'after' ? 0 : d.i !== null ? Math.min(d.i + (tag === 'copy' || tag === 'step' || tag === 'test' || tag === 'none' ? 1 : 0), pre.length) : 0;
      const letters = (inCollect ? d.buf : pre).slice(0, len);
      items.push(...TK.tiles(letters, -1, { x: rootX - 150, y: -150, key: 'tb', label: 'buf', noIndex: false, cls: (k) => (k < pre.length ? 'part-b' : k === len - 1 && tag === 'push' ? 'hot' : 'part-a') }));
      if (inCollect && d.depth !== null && tag !== 'return') items.push({ key: 'tdep', kind: 'cursor', x: rootX - 150 + d.depth * 38 + 17, y: -110, tx: rootX - 150 + d.depth * 38 + 17, ty: -84, text: 'depth', cls: 'c-violet' });
      // the words printed so far
      const ox = Math.max(...[...pic.pos.values()].map((p) => p.x)) + 90;
      items.push({ key: 'touth', kind: 'text', x: ox, y: -10, text: 'printed', cls: 'hp-title' });
      memo.out.forEach((s, k) => items.push({ key: 'tout' + s, kind: 'text', x: ox, y: 20 + k * 24, text: s, cls: 'tr-word' }));
      const by = pic.by;
      const nodeWord = (a) => (by.get(a) ? by.get(a).word : '');
      const kidsOf = (a) => (by.get(a) ? by.get(a).kids.map((k) => TK.letter(k.c)).join(', ') : '');
      let say = '';
      const L = (c) => '\'' + TK.letter(c) + '\'';
      switch (tag) {
        case 'enter': say = !pre ? 'with_prefix(root, ""): every word starts with the empty prefix, so there is no walk down: the root is the starting point and the whole trie gets listed.' : 'with_prefix(root, ' + q(pre) + '): first walk down to the node for ' + q(pre) + ', as a search would. Every word that starts with it is somewhere below that node.'; break;
        case 'start': say = 'cur = root.' + (pre ? '' : ' The prefix is empty, so the root itself is the starting point: every word will be listed.'); break;
        case 'next': say = d.i < pre.length ? 'Prefix letter ' + d.i + ': \'' + pre[d.i] + '\'.' : 'The whole prefix is followed. cur is the node for ' + q(pre) + '.'; break;
        case 'copy': say = 'buf[' + d.i + '] = \'' + pre[d.i] + '\': buf will spell each word as the walk goes on.'; break;
        case 'step': say = d.cursors.cur ? 'cur moves to the node for ' + q(pre.slice(0, d.i + 1)) + '.' : 'child[\'' + pre[d.i] + '\' - \'a\'] is NULL: no word starts with ' + q(pre.slice(0, d.i + 1)) + '.'; break;
        case 'test': say = d.cursors.cur ? 'Not NULL: keep going.' : 'cur is NULL.'; break;
        case 'none': say = 'return 0: no stored word starts with ' + q(pre) + ', and nothing below needs to be looked at.'; break;
        case 'collect': say = 'collect(cur, buf, ' + pre.length + '): list every word in the shaded subtree. buf already holds ' + q(pre) + '.'; break;
        case 'visit': say = 'At the node for ' + q(nodeWord(t)) + ' (depth ' + d.depth + '). count starts at t->end = ' + d.count + (d.count ? ': a word ends right here.' : '.'); break;
        case 'test-end': say = d.count ? q(nodeWord(t)) + ' is a word: print it before going deeper, so shorter words come first.' : q(nodeWord(t) || pre) + ' is not a word itself, only a step on the way.'; break;
        case 'cut': say = 'buf[' + d.depth + '] = \'\\0\': end the string after ' + d.depth + ' letters, so buf reads ' + q(d.str) + '.'; break;
        case 'found': say = 'printf prints ' + q(d.str) + '.'; break;
        case 'child': say = ctx.ticks[ctx.i + 1] && ctx.ticks[ctx.i + 1].tag === 'child' ? (d.c === null || ctx.prev.tag === 'test-end' || ctx.prev.tag === 'found' || ctx.prev.tag === 'visit' ? 'next_child(t, 0) looks for the first letter, from \'a\' on, whose child pointer is not NULL.' : 'next_child(t, c + 1) looks for the next letter after ' + L(d.c) + ' with a child.') : d.c < 26 ? 'next_child finds the next letter that has a child: ' + L(d.c) + ' (children here: ' + kidsOf(t) + '). Letters are tried in order a to z, so the words come out sorted.' : 'No more children (c = ALPHA): every word under ' + q(nodeWord(t) || pre) + ' has been listed.'; break;
        case 'push': say = 'buf[' + d.depth + '] = ' + L(d.c) + ': buf now spells ' + q(d.buf.slice(0, d.depth + 1)) + '.'; break;
        case 'descend': say = 'Go down: collect(t->child[' + memo.pushC + '], buf, ' + d.depth + '), the node for ' + q(nodeWord(t)) + '. The violet nodes are the calls still waiting for it.'; break;
        case 'return': {
          const n = ctx.tick.ret !== undefined && ctx.tick.ret !== null ? ctx.tick.ret : d.count;
          const parent = d.stack[1];
          say = parent ? 'return ' + n + ': the call for ' + q(nodeWord(t)) + ' hands back ' + plural(n, 'word') + ' to the call for ' + q(nodeWord(parent) || pre) + ', which adds it to its count. The letter in buf[' + (d.depth - 1) + '] will be written over by the next child.' : 'return ' + n + ': the first call hands the total to with_prefix.';
          break;
        }
        case 'after': say = memo.none ? 'main prints "0 words".' : 'main prints "' + memo.out.length + ' words": ' + memo.out.join(', ') + '. The walk down took ' + pre.length + ' steps; after that only the shaded subtree was visited, never the rest of the trie.'; break;
        default: if (ctx.tick.end) say = ctx.tick.fn + '() returns.';
      }
      void below;
      return { items, say, slow: tag === 'found' };
    },
    predict: [
      { at: (t, i, ts) => t.tag === 'enter', once: true, ask: 'How many stored words start with the prefix?', options: () => ['0', '1', '2', '3', '4', '5', '6', '7', '8'], answer: (ts) => String(ts.filter((t) => t.tag === 'found').length), pick: 'option', explain: () => 'They are exactly the words in the subtree under the prefix node.' },
      { at: (t, i, ts) => t.tag === 'child' && ts[i + 1] && ts[i + 1].tag === 'push' && ts.slice(0, i).some((x) => x.tag === 'found'), once: true, ask: 'Which word will be printed next?', options: (ts) => [...new Set(ts.filter((t) => t.tag === 'found').map((t) => t.data.str))], answer: (ts, i) => { const n = ts.slice(i + 1).find((t) => t.tag === 'found'); return n ? n.data.str : null; }, pick: 'option', explain: () => 'The walk tries letters from a to z and prints a word as soon as it reaches its end node, so words come out in alphabetical order.' },
    ],
    quiz: [
      { q: 'Where are all the words that start with "ca"?', options: ['Spread over the whole trie', 'In the subtree under the node for "ca"', 'In the leaves only', 'At depth 2 only'], answer: 1, why: 'Every word starting with "ca" passes through that node, so they are all below it.' },
      { q: 'Why do the words come out in alphabetical order?', options: ['They were inserted in order', 'Children are visited from a to z, and a word is printed before the longer ones below it', 'printf sorts them', 'By chance'], answer: 1, why: 'A depth-first walk that tries letters in order, printing at the end node first, is exactly alphabetical order.' },
      { q: 'What does buf[depth] = \'a\' + c do before the recursive call?', options: ['Allocates a node', 'Writes the next letter of the word being spelled', 'Marks the end of a word', 'Counts the words'], answer: 1, why: 'buf holds the path so far; each level writes its letter at its own depth and the next child writes over it.' },
      { q: 'Why is a trie good for autocomplete?', options: ['It uses little memory', 'After walking the prefix, only the words that match are ever visited', 'It keeps words sorted by length', 'It needs no pointers'], answer: 1, why: 'The prefix walk costs one step per letter, and then the subtree holds exactly the candidates.' },
    ],
  });

  // ---- delete ----------------------------------------------------------------------------------------------
  X.topic({
    id: 'trie-delete', family: 'trie', order: 40, title: 'Delete a word',
    blurb: 'Go down to the word\'s last node and clear its end flag. Then, on the way back up, free every node that no longer ends a word and has no children, until one is still needed.',
    code: `/* 1 if t has no children */
int no_children(const struct trie *t)
{
    int c;
    for (c = 0; c < ALPHA; c++)
        if (t->child[c] != NULL)
            return 0;
    return 1;
}

/* remove word from the subtree under t, where t spells word[0..depth-1];
   returns t, or NULL if t was freed because it leads to no word any more */
struct trie *delete_word(struct trie *t, const char *word, int depth)
{
    int c;
    if (t == NULL)                                   /*@ test-null */
        return NULL;                                 /*@ absent */
    if (word[depth] == '\\0')                         /*@ at-end */
        t->end = 0;                                  /*@ unmark */
    else {
        c = word[depth] - 'a';                       /*@ letter */
        t->child[c] = delete_word(t->child[c], word, depth + 1);   /*@ descend */
    }
    if (depth > 0 && !t->end && no_children(t)) {    /*@ test-free */
        free(t);                                     /*@ free */
        return NULL;                                 /*@ gone */
    }
    return t;                                        /*@ keep */
}`,
    animate: ['delete_word'], quiet: ['no_children'],
    inputs: [X.trieWords('car card care cat cattle dog'), X.trieWord('word', 'Delete', 'cattle')],
    presets: [
      { label: 'Its own tail is freed', values: { words: 'car card care cat cattle dog', word: 'cattle' } },
      { label: 'A prefix of other words: only the flag', values: { words: 'car card care cat cattle dog', word: 'car' } },
      { label: 'A whole branch goes', values: { words: 'car card care cat cattle dog', word: 'dog' } },
      { label: 'Not in the trie', values: { words: 'car card care cat cattle dog', word: 'cow' } },
    ],
    counters: ['frees'],
    main: (inp) => X.trieMain(inp.words, 'delete_word(root, ' + q(word(inp, 'word')) + ', 0);'),
    capture(P) {
      const o = TK.capture(P, { root: 'root', stack: { fn: 'delete_word', name: 't' } });
      const fn = P.frames[0].name;
      o.fn = fn;
      o.depth = fn === 'delete_word' ? TK.ptr(P, 'depth', 0) : null;
      o.c = fn === 'delete_word' ? TK.ptr(P, 'c', 0) : null;
      return o;
    },
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, w = word(ctx.input, 'word'), memo = ctx.memo;
      const inCall = d.fn === 'delete_word';
      const t = inCall ? d.stack[0] : null;
      const depth = d.depth;
      memo.freed = memo.freed || [];
      if (tag === 'free' && t && !memo.freed.includes(t)) memo.freed.push(t);
      if (tag === 'unmark') memo.unmarked = true;
      if (tag === 'absent') memo.absent = depth;
      const first = TK.byAddr(ctx.ticks[0].data);
      const stack = new Set(d.stack.filter(Boolean));
      const pic = TK.picture(ctx, d, {
        nodeCls: (n) => (n.addr === t && !n.freed ? 'tr-cur' : stack.has(n.addr) ? 'tr-stack' : ''),
        edgeCls: (p, c) => (stack.has(p.addr) && stack.has(c.addr) ? 'tr-stack' : ''),
        sub: (n) => (n.end && n.addr !== d.root ? n.word : first.get(n.addr) && first.get(n.addr).end && !n.end ? n.word + ' ✗' : ''),
      });
      const items = pic.items;
      const rootX = pic.pos.get(d.root) ? pic.pos.get(d.root).x : 0;
      items.push(...TK.tiles(w, -1, { x: rootX - w.length * 19, y: -150, label: 'word', cls: (k) => (inCall && depth !== null ? (k < depth ? 'done' : k === depth ? 'focus' : '') : '') }));
      if (inCall && depth !== null && depth <= w.length && tag !== 'gone' && tag !== 'keep') {
        items.push({ key: 'tdep', kind: 'cursor', x: rootX - w.length * 19 + depth * 38 + 17, y: -112, tx: rootX - w.length * 19 + depth * 38 + 17, ty: -86, text: depth < w.length ? 'depth' : 'depth (\\0)', cls: 'c-violet' });
      }
      // why a node stays: it ends a word, or other words go on below it
      const by = pic.by;
      const node = t && by.get(t);
      if (node && tag === 'test-free' && depth > 0) {
        const why = node.end ? 'ends a word: keep' : node.kids.length ? (node.kids.length === 1 ? 'has a child' : 'has ' + node.kids.length + ' children') + ': keep' : 'leads nowhere: free';
        items.push({ key: 'twhy', kind: 'text', x: rootX - w.length * 19 + w.length * 38 + 24, y: -127, text: q(node.word) + ' ' + why, cls: node.end || node.kids.length ? 'hp-good' : 'hp-badt' });
      }
      if (memo.absent !== undefined && (tag === 'absent' || !inCall || ['keep', 'test-free'].includes(tag))) {
        const parent = by.get(memo.missFrom);
        if (parent && pic.pos.get(parent.addr)) {
          const h = TK.freeSpot(pic.pos, pic.pos.get(parent.addr));
          items.push({ key: 'thole', kind: 'vertex', x: h.x, y: h.y, r: 18, text: 'NULL', cls: 'tr-hole', sub: '\'' + w[memo.absent - 1] + '\'' });
          items.push({ key: 'tholeA', kind: 'arrow', from: { key: 'tn' + parent.addr }, to: { key: 'thole' }, cls: 'bad' });
        }
      }
      if (tag === 'descend') memo.missFrom = d.stack[1];
      const nm = (a) => (by.get(a) && by.get(a).word ? q(by.get(a).word) : 'the root');
      let say = '';
      switch (tag) {
        case 'enter': say = 'delete_word(root, ' + q(w) + ', 0): go down letter by letter to the end of the word, then come back up. The call stack (violet) remembers the way back.'; break;
        case 'test-null': say = t ? 'depth ' + depth + ': t is the node for ' + nm(t) + '.' : 'depth ' + depth + ': t is NULL. The word is not in the trie.'; break;
        case 'absent': say = 'return NULL: ' + q(w.slice(0, depth)) + ' does not exist, so there is nothing to delete. The parent stores NULL in a pointer that was NULL already.'; break;
        case 'at-end': say = depth < w.length ? 'word[' + depth + '] = \'' + w[depth] + '\': not the end of the word yet.' : 'word[' + depth + '] is \'\\0\': t is the node where ' + q(w) + ' ends.'; break;
        case 'unmark': say = 't->end = 0: ' + q(w) + ' is no longer a word. That is the real deletion; the rest is tidying up memory.'; break;
        case 'letter': say = 'c = \'' + w[depth] + '\' - \'a\' = ' + d.c + '.'; break;
        case 'descend': { const pc = ctx.prev && ctx.prev.data.c; say = 'Go down: delete_word(t->child[' + pc + '], word, ' + depth + '). Whatever it returns will be stored back in t->child[' + pc + ']: the child itself, or NULL if it was freed.'; break; }
        case 'test-free': {
          if (!node) break;
          if (depth === 0) { say = 'depth 0: this is the root, which is never freed.'; break; }
          say = 'Can the node for ' + nm(t) + ' go? ' + (node.end ? 'No: it is the end of the word ' + q(node.word) + '.' : node.kids.length ? 'No: it still has a child (' + node.kids.map((k) => '\'' + TK.letter(k.c) + '\'').join(', ') + '), so other words need it.' : 'Yes: it ends no word and has no children.');
          break;
        }
        case 'free': say = 'free(t): the node for ' + nm(t) + ' goes back to the heap. Its parent still points at it for a moment.'; break;
        case 'gone': say = 'return NULL: the parent will store NULL in place of the freed node, so no pointer is left dangling.'; break;
        case 'keep': say = memo.kept ? 'return t: this node stays too.' + (depth === 0 ? ' The root goes back to main unchanged.' : '') : 'return t: this node stays. Every node above it is on the path to it, so nothing more will be freed.'; memo.kept = true; break;
        case 'after': say = (memo.absent !== undefined ? q(w) + ' was not in the trie: nothing changed.' : q(w) + ' is deleted. ' + plural(memo.freed.length, 'node') + ' freed.') + ' Words left: ' + (TK.words(d).join(', ') || 'none') + '.'; break;
        default: if (ctx.tick.end) say = 'delete_word() returns.';
      }
      return { items, say, slow: tag === 'free' || tag === 'unmark' };
    },
    predict: [
      { at: (t) => t.tag === 'enter', once: true, ask: 'How many nodes will be freed?', options: () => ['0', '1', '2', '3', '4', '5'], answer: (ts) => String(ts.filter((t) => t.tag === 'free').length), pick: 'option', explain: () => 'Only the nodes at the end of the path that end no other word and have no other children.' },
      { at: (t, i, ts) => ts[i + 1] && ts[i + 1].tag === 'test-free' && ts[i + 1].data.depth > 0 && t.tag !== 'enter', once: true, ask: (t, ts, i) => 'Will the node for "' + (TK.byAddr(ts[i + 1].data).get(ts[i + 1].data.stack[0]) || {}).word + '" be freed?', options: () => ['Yes, freed', 'No, kept'], answer: (ts, i) => (ts[i + 2] && ts[i + 2].tag === 'free' ? 'Yes, freed' : 'No, kept'), pick: 'option', explain: () => 'A node is freed only if it ends no word and has no children left.' },
    ],
    quiz: [
      { q: 'The trie holds "car" and "cart". Deleting "car" frees how many nodes?', options: ['0', '1', '3', '4'], answer: 0, why: 'The r node still leads to "cart", so only its end flag is cleared.' },
      { q: 'Why does the freeing happen on the way back up, not on the way down?', options: ['It is faster', 'A node can only be judged after everything below it has been dealt with', 'free() needs the root', 'To keep the word sorted'], answer: 1, why: 'Whether a node has children left depends on what was freed below it, so children are handled first.' },
      { q: 'Why does delete_word return a pointer, stored in t->child[c]?', options: ['To count the nodes', 'So the parent\'s pointer becomes NULL when the child is freed', 'To return the deleted word', 'It is needed for the root only'], answer: 1, why: 'Otherwise the parent would keep the address of freed memory: a dangling pointer.' },
      { q: 'The trie holds "dog" only. Deleting it frees...', options: ['Only g', 'g, o and d', 'Everything including the root', 'Nothing'], answer: 1, why: 'Each of g, o, d ends no other word and has no other child once the one below is gone. The root stays.' },
    ],
  });
})(SEE);
