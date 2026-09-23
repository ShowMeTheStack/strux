// Tries: the family, insert and search. A word is a path from the root, one letter per level; the
// letter itself is the index of the child pointer to follow, so no comparisons with other words.
(function (SEE) {
  'use strict';
  const X = SEE.Strux, TK = X.TrieKit;

  X.family({
    id: 'trie', order: 2, group: 'Heaps and tries', title: 'Tries',
    blurb: 'A tree of letters: every word is a path from the root, and words that share a beginning share the nodes for it. A flag marks where a word ends.',
    head: `#include <stdio.h>
#include <stdlib.h>

#define ALPHA 26    /* the letters 'a' to 'z' */

/* a trie node: one child pointer per letter, and a flag for "a word ends here" */
struct trie {
    struct trie *child[ALPHA];
    int end;
};

/* a node with no children that ends no word */
struct trie *new_node(void)
{
    struct trie *t = malloc(sizeof *t);
    int c;
    for (c = 0; c < ALPHA; c++)
        t->child[c] = NULL;
    t->end = 0;
    return t;
}

/* main uses this to put your words in before the animation starts */
void add(struct trie *root, const char *word)
{
    for (; *word != '\\0'; word++) {
        if (root->child[*word - 'a'] == NULL)
            root->child[*word - 'a'] = new_node();
        root = root->child[*word - 'a'];
    }
    root->end = 1;
}`,
  });

  /** main: make the root, add the words quietly, then the topic's call */
  X.trieMain = (words, call) => {
    const w = TK.parseWords(words);
    return `int main(void)
{
${w.length ? '    const char *words[] = { ' + w.map((x) => '"' + x + '"').join(', ') + ' };\n' : ''}    struct trie *root = new_node();
${w.length ? '    int i;\n    for (i = 0; i < ' + w.length + '; i++)\n        add(root, words[i]);\n' : ''}    ${call}
    return 0;
}`;
  };
  X.trieWords = (def) => ({ id: 'words', kind: 'text', label: 'Words already in the trie', def, check: (v) => TK.checkWords(v, 8, 8, 'Words') });
  X.trieWord = (id, label, def, allowEmpty) => ({ id, kind: 'text', label, def, check: (v) => {
    const s = String(v || '').trim();
    if (!s && !allowEmpty) return label + ': give a word';
    if (s && !/^[a-z]+$/.test(s)) return label + ': one word, lowercase letters a to z only';
    if (s.length > 8) return label + ': at most 8 letters';
    return null;
  } });
  const word = (inp, id) => String(inp[id] || '').trim();
  const q = (s) => '"' + s + '"';
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  /** Did the search end with a node whose end flag is set? (read just before search returned) */
  const found = (ts) => { const k = ts.findIndex((t) => t.tag === 'result'); if (k < 1) return false; const d = ts[k - 1].data; const n = TK.byAddr(d).get(d.cursors.cur); return !!(n && n.end); };

  // ---- insert ----------------------------------------------------------------------------------------------
  X.topic({
    id: 'trie-insert', family: 'trie', order: 10, title: 'Insert a word',
    blurb: 'The letters walk down from the root. Where a letter\'s child already exists the path is shared; where it is missing a new node is made. The last node gets the end flag.',
    code: `/* add word to the trie, making the nodes that are missing */
void insert(struct trie *root, const char *word)
{
    struct trie *cur = root;                         /*@ start */
    int i, c;
    for (i = 0; word[i] != '\\0'; i++) {              /*@ next */
        c = word[i] - 'a';                           /*@ letter */
        if (cur->child[c] == NULL)                   /*@ test-key */
            cur->child[c] = new_node();              /*@ make */
        cur = cur->child[c];                         /*@ step */
    }
    cur->end = 1;                                    /*@ mark */
}`,
    animate: ['insert'], quiet: ['new_node'],
    inputs: [X.trieWords('car cart cat dog'), X.trieWord('word', 'Insert', 'care')],
    presets: [
      { label: 'Shares a prefix', values: { words: 'car cart cat dog', word: 'care' } },
      { label: 'All new letters', values: { words: 'car cart cat dog', word: 'sun' } },
      { label: 'A prefix of a word already there', values: { words: 'cart card dog', word: 'car' } },
      { label: 'Into an empty trie', values: { words: '', word: 'tea' } },
    ],
    counters: ['compares', 'follows', 'allocs'],
    main: (inp) => X.trieMain(inp.words, 'insert(root, ' + q(word(inp, 'word')) + ');'),
    capture: (P) => Object.assign(TK.capture(P, { root: 'root', cursors: ['cur'] }), { i: TK.ptr(P, 'i', 0), c: TK.ptr(P, 'c', 0) }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, w = word(ctx.input, 'word'), memo = ctx.memo;
      const first = TK.byAddr(ctx.ticks[0].data);
      const cur = d.cursors.cur;
      memo.path = memo.path || [];
      if (cur && !memo.path.includes(cur)) memo.path.push(cur);
      if (tag === 'make') memo.made = (memo.made || 0) + 1;
      const path = new Set(memo.path);
      const inLoop = d.i !== null && tag !== 'after';
      const i = d.i;
      // the frame for new_node() is taken just before the pointer is stored: the new node waits beside
      // cur, and a dashed arrow shows the link about to be made
      const pos = TK.layout(ctx, d, {});
      const orphan = tag === 'make' ? d.nodes.find((n) => !n.inTree && !n.freed && n.addr !== d.root) : null;
      if (orphan && pos.get(cur)) { const p = pos.get(cur); pos.set(orphan.addr, { x: p.x + TK.DX * 1.2, y: p.y + TK.DY * 0.6, depth: p.depth + 1 }); orphan.letter = w[i]; }
      const pic = TK.picture(ctx, d, {
        pos,
        nodeCls: (n) => (n.addr === cur && tag !== 'after' ? 'tr-cur' : '') + (!first.has(n.addr) && !n.end ? ' tr-new' : path.has(n.addr) ? ' tr-path' : ''),
        edgeCls: (p, c) => (path.has(p.addr) && path.has(c.addr) ? 'tr-path' : ''),
      });
      const items = pic.items;
      const by = pic.by;
      if (orphan) items.push({ key: 'te' + orphan.addr, kind: 'arrow', from: { key: 'tn' + cur }, to: { key: 'tn' + orphan.addr }, cls: 'hot' });
      // the word, letter by letter, above the tree
      const tw = w.length * 38;
      const tx = -tw / 2 + (pic.pos.get(d.root) ? pic.pos.get(d.root).x : 0);
      items.push(...TK.tiles(w, inLoop ? i : tag === 'mark' || tag === 'after' ? w.length : -1, { x: tx, y: -230, label: 'word' }));
      if (inLoop && i < w.length) items.push({ key: 'tci', kind: 'cursor', at: 'tw' + i, side: 'above', text: 'i', cls: 'c-teal' });
      // the 26 child pointers of the current node: a letter is an index, not something to search for
      const node = by.get(cur);
      const probe = ['letter', 'test-key', 'make'].includes(tag) ? d.c : null;
      if (node && inLoop && i < w.length) {
        items.push(...TK.strip(node, probe, { x: -TK.STRIP_W / 2 + (pic.pos.get(d.root) ? pic.pos.get(d.root).x : 0), y: -150, label: 'cur->child[]' }));
      }
      // the letter on its way down, beside the node it stands at
      const at = cur && pic.pos.get(cur);
      if (at && inLoop && i < w.length) items.push({ key: 'tok', kind: 'token', x: at.x - TK.R - 20, y: at.y, r: 15, text: w[i], cls: 'tr-letter' });
      const sofar = (k) => w.slice(0, k);
      const shares = (pre) => TK.words(ctx.ticks[0].data).filter((x) => x.startsWith(pre) && x !== pre);
      let say = '';
      switch (tag) {
        case 'enter': say = 'insert(root, ' + q(w) + '): walk down from the root one letter at a time. Where the path already exists it is shared; where it stops, new nodes carry it on.'; break;
        case 'start': say = 'cur = root. The root holds no letter: its 26 child pointers lead to the words that start with a, b, c... z.'; break;
        case 'next': say = i < w.length ? 'i = ' + i + ': the next letter is word[' + i + '] = \'' + w[i] + '\'.' : 'word[' + i + '] is \'\\0\': all ' + w.length + ' letters are placed, and cur is the node for ' + q(w) + '.'; break;
        case 'letter': say = 'c = \'' + w[i] + '\' - \'a\' = ' + d.c + '. The letter is the index: child[' + d.c + '] is the only pointer worth looking at, with no search through the other letters.'; break;
        case 'test-key': {
          const has = node && node.kids.some((k) => k.c === d.c);
          const sh = shares(sofar(i + 1));
          say = has ? 'cur->child[' + d.c + '] is not NULL: a node for ' + q(sofar(i + 1)) + ' already exists' + (sh.length ? ', shared with ' + sh.join(', ') : '') + '. No new node is needed.' : 'cur->child[' + d.c + '] is NULL: no word so far starts with ' + q(sofar(i + 1)) + ', so a node must be made.';
          break;
        }
        case 'make': say = 'new_node() makes a node with 26 NULL children and end = 0, and cur->child[' + d.c + '] is set to point to it: the node for ' + q(sofar(i + 1)) + '.'; break;
        case 'step': say = 'cur moves down to the node for ' + q(sofar(i + 1)) + '.'; break;
        case 'mark': say = (node && ctx.prev && TK.byAddr(ctx.prev.data).get(cur) && TK.byAddr(ctx.prev.data).get(cur).end ? 'end was already 1: ' + q(w) + ' was in the trie before. ' : '') + 'cur->end = 1: a word ends here. Without this flag the path ' + q(w) + ' would only be the beginning of other words.'; break;
        case 'after': { const ws = TK.words(d); say = 'The trie holds ' + plural(ws.length, 'word') + ': ' + ws.join(', ') + '. Inserting ' + q(w) + ' made ' + plural(memo.made || 0, 'new node') + ' and took ' + w.length + ' steps, however many words the trie holds.'; break; }
      }
      return { items, say, slow: tag === 'make' || tag === 'mark' };
    },
    predict: [
      { at: (t) => t.tag === 'start', once: true, ask: 'How many new nodes will this insert make?', options: (ts, i, ctx) => { const o = []; for (let k = 0; k <= word(ctx.input, 'word').length; k++) o.push(String(k)); return o; }, answer: (ts) => String(ts.filter((t) => t.tag === 'make').length), pick: 'option', explain: () => 'One for each letter after the longest beginning the word shares with words already there.' },
      { at: (t) => t.tag === 'letter', once: true, ask: (t, ts, i, ctx) => 'Does cur already have a child for \'' + word(ctx.input, 'word')[t.data.i] + '\'?', options: () => ['Yes, follow it', 'No, make one'], answer: (ts, i) => (ts[i + 2] && ts[i + 2].tag === 'make' ? 'No, make one' : 'Yes, follow it'), pick: 'option', explain: () => 'Look at child[c] in the strip: a filled slot is a pointer that is not NULL.' },
    ],
    quiz: [
      { q: 'How many steps does inserting a word of length m take in a trie that holds n words?', options: ['About log n', 'About m, whatever n is', 'About n', 'About n·m'], answer: 1, why: 'One step per letter. The other words never get compared with it.' },
      { q: 'Inserting "car" into a trie that already holds "cart" makes how many new nodes?', options: ['3', '1', '0', '4'], answer: 2, why: 'The path c-a-r exists already; only the end flag of the r node is set.' },
      { q: 'Why does each node need the end flag?', options: ['To know where the trie stops', 'Because a word can end at a node that also has children', 'To count the letters', 'C needs it to free the node'], answer: 1, why: 'With "car" and "cart", the r node has a child (t) but is also the end of a word.' },
      { q: 'What does c = word[i] - \'a\' give for the letter \'e\'?', options: ['5', '4', '101', 'e'], answer: 1, why: 'Letters are consecutive codes: \'e\' - \'a\' = 4, the index of the e pointer.' },
      { q: 'What is the main cost of this trie?', options: ['Slow searches', '26 pointers in every node, most of them NULL', 'Words must be sorted first', 'It cannot hold words that share a prefix'], answer: 1, why: 'Speed is paid for with memory: each node carries a whole alphabet of pointers.' },
    ],
  });

  // ---- search ----------------------------------------------------------------------------------------------
  X.topic({
    id: 'trie-search', family: 'trie', order: 20, title: 'Search for a word',
    blurb: 'Follow one pointer per letter. Falling off the trie means the word is not there; reaching the last letter is not enough either: the end flag must be set.',
    code: `/* 1 if word was inserted, 0 if not */
int search(const struct trie *root, const char *word)
{
    const struct trie *cur = root;                   /*@ start */
    int i;
    for (i = 0; word[i] != '\\0'; i++) {              /*@ next */
        cur = cur->child[word[i] - 'a'];             /*@ step */
        if (cur == NULL)                             /*@ test */
            return 0;                                /*@ missing */
    }
    return cur->end;                                 /*@ result */
}`,
    animate: ['search'],
    inputs: [X.trieWords('car card care cart cat dog'), X.trieWord('word', 'Search for', 'cart')],
    presets: [
      { label: 'Found', values: { words: 'car card care cart cat dog', word: 'cart' } },
      { label: 'Falls off the trie', values: { words: 'car card care cart cat dog', word: 'cap' } },
      { label: 'Only a prefix, not a word', values: { words: 'car card care cart cat dog', word: 'ca' } },
      { label: 'Longer than any word', values: { words: 'car card care cart cat dog', word: 'carts' } },
    ],
    counters: ['follows'],
    main: (inp) => X.trieMain(inp.words, 'printf("%d\\n", search(root, ' + q(word(inp, 'word')) + '));'),
    capture: (P) => Object.assign(TK.capture(P, { root: 'root', cursors: ['cur'] }), { i: TK.ptr(P, 'i', 0), curSet: P.has('cur', 0) && P.isSet('cur', 0) }),
    scene(ctx) {
      const d = ctx.tick.data, tag = ctx.tick.tag, w = word(ctx.input, 'word'), memo = ctx.memo;
      const cur = d.cursors.cur, i = d.i;
      memo.path = memo.path || [];
      if (cur && !memo.path.includes(cur)) memo.path.push(cur);
      if (cur) memo.last = cur;
      const path = new Set(memo.path);
      if ((tag === 'test' && !cur && d.curSet)) memo.fell = { from: memo.path[memo.path.length - 1], i };
      const result = tag === 'result' || (tag === 'after' && !memo.fell);
      const lastNode = TK.byAddr(d).get(memo.last);
      const pic = TK.picture(ctx, d, {
        nodeCls: (n) => (n.addr === cur && tag !== 'after' ? 'tr-cur' : '') + (path.has(n.addr) ? ' tr-path' : '') + (result && n.addr === memo.last && !n.end ? ' bad' : ''),
        edgeCls: (p, c) => (path.has(p.addr) && path.has(c.addr) ? 'tr-path' : ''),
      });
      const items = pic.items;
      const rootX = pic.pos.get(d.root) ? pic.pos.get(d.root).x : 0;
      // the word: letters matched so far turn green, the one that failed turns red
      const matched = memo.fell ? memo.fell.i : Math.min(memo.path.length - 1, w.length);
      items.push(...TK.tiles(w, -1, { x: rootX - w.length * 19, y: -150, label: 'word', cls: (k) => (k < matched ? 'done' : memo.fell && k === memo.fell.i ? 'bad' : k === i && tag !== 'after' ? 'focus' : '') }));
      if (i !== null && i < w.length && tag !== 'after' && tag !== 'missing') items.push({ key: 'tci', kind: 'cursor', at: 'tw' + i, side: 'above', text: 'i', cls: 'c-teal' });
      // falling off: a dashed hole where the missing child would hang
      if (memo.fell && (tag === 'test' || tag === 'missing' || tag === 'after')) {
        const p = pic.pos.get(memo.fell.from);
        if (p) {
          const h = TK.freeSpot(pic.pos, p);
          items.push({ key: 'thole', kind: 'vertex', x: h.x, y: h.y, r: 18, text: 'NULL', cls: 'tr-hole', sub: '\'' + w[memo.fell.i] + '\'', enter: 'grow' });
          items.push({ key: 'tholeA', kind: 'arrow', from: { key: 'tn' + memo.fell.from }, to: { key: 'thole' }, cls: 'bad' });
        }
      }
      const at = cur && pic.pos.get(cur);
      if (at && i !== null && i < w.length && tag !== 'after') items.push({ key: 'tok', kind: 'token', x: at.x - TK.R - 20, y: at.y, r: 15, text: w[i], cls: 'tr-letter' });
      if (result && lastNode) {
        const p = pic.pos.get(lastNode.addr);
        if (p) items.push({ key: 'tres', kind: 'text', x: rootX + w.length * 19 + 24, y: -127, text: lastNode.end ? '✓ end = 1: found' : '✗ end = 0: not a word', cls: lastNode.end ? 'hp-good' : 'hp-badt' });
      }
      const pre = (k) => q(w.slice(0, k));
      let say = '';
      switch (tag) {
        case 'enter': say = 'search(root, ' + q(w) + '): one pointer per letter, from the root down. The other words are never looked at.'; break;
        case 'start': say = 'cur = root.'; break;
        case 'next': say = i < w.length ? 'i = ' + i + ': follow the pointer for \'' + w[i] + '\', child[' + (w.charCodeAt(i) - 97) + '].' : 'All ' + w.length + ' letters followed: cur is the node for ' + q(w) + '. But is it the end of a word?'; break;
        case 'step': say = cur ? 'cur = cur->child[' + (w.charCodeAt(i) - 97) + ']: down to the node for ' + pre(i + 1) + '.' : 'cur = cur->child[' + (w.charCodeAt(i) - 97) + '], and that pointer is NULL: no stored word starts with ' + pre(i + 1) + '.'; break;
        case 'test': say = cur ? 'cur is not NULL, so the path goes on.' : 'cur is NULL: the search has fallen off the trie.'; break;
        case 'missing': say = 'return 0: ' + q(w) + ' is not in the trie. It took ' + plural(i + 1, 'step') + ' to be sure.'; break;
        case 'result': say = lastNode && lastNode.end ? 'return cur->end, which is 1: ' + q(w) + ' was inserted as a word.' : 'return cur->end, which is 0. The path ' + q(w) + ' exists, but only because longer words (' + TK.words(d, memo.last).join(', ') + ') pass through it. ' + q(w) + ' itself was never inserted.'; break;
        case 'after': say = 'main prints ' + (memo.fell ? 0 : lastNode && lastNode.end ? 1 : 0) + '. A search costs one step per letter of the word, at most ' + w.length + ' here, no matter how many words are stored.'; break;
      }
      return { items, say, slow: tag === 'result' || tag === 'missing' };
    },
    predict: [
      { at: (t) => t.tag === 'start', once: true, ask: 'Will the search find the word?', options: () => ['Found (prints 1)', 'Not found (prints 0)'], answer: (ts) => (found(ts) ? 'Found (prints 1)' : 'Not found (prints 0)'), pick: 'option', explain: () => 'Found needs two things: the path for every letter, and the end flag on the last node.' },
      { at: (t) => t.tag === 'next' && t.data.i === 1, once: true, ask: 'Click the node the search will move to next.', answer: (ts, i) => { const n = ts.slice(i + 1).find((t) => t.tag === 'step'); return n && n.data.cursors.cur ? 'tn' + n.data.cursors.cur : null; }, explain: (ts, i, ctx) => 'The child for the letter \'' + word(ctx.input, 'word')[1] + '\' of the current node.' },
    ],
    quiz: [
      { q: 'The trie holds "cart" only. What does search for "car" return?', options: ['1', '0', 'It crashes', 'The node for r'], answer: 1, why: 'The path exists, but the r node\'s end flag is 0: "car" was never inserted.' },
      { q: 'When does a trie search stop early?', options: ['When a letter\'s child pointer is NULL', 'When it finds a bigger word', 'Never', 'After log n steps'], answer: 0, why: 'A NULL child means no stored word continues with that letter.' },
      { q: 'How does the time to search depend on the number of words stored?', options: ['Linearly', 'Logarithmically', 'It does not: only the length of the word matters', 'Quadratically'], answer: 2, why: 'Each step follows one pointer chosen by the letter, so the cost is the word\'s length.' },
      { q: 'Searching for "carts" when the trie has "cart": where does it stop?', options: ['At t, returning 1', 'After t, when child[\'s\' - \'a\'] is NULL', 'At the root', 'At r'], answer: 1, why: 'The t node has no s child, so the search falls off and returns 0.' },
    ],
  });
})(SEE);
