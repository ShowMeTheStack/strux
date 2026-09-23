// Drawing tries. Only the children that exist are drawn: each node shows the letter of the pointer
// that leads to it, a node whose end flag is set is filled and carries its word, and the 26 child
// pointers of one node can be laid out as a strip of slots to show that a letter is an index.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const TK = X.TrieKit = {};
  TK.DX = 64; TK.DY = 80; TK.R = 22;
  const A = 'abcdefghijklmnopqrstuvwxyz';
  TK.letter = (c) => A[c] || '?';

  /** The address held by a pointer variable in frame fi (or any frame), or null */
  const ptr = (P, name, fi) => (P.has(name, fi) && P.isSet(name, fi) ? P.val(name, fi) : null);
  TK.ptr = ptr;

  /**
   * Capture a trie. opts: {root: name of the root pointer, cursors: names read from the newest frame,
   *   stack: {fn, name}: that pointer in every frame of fn, newest first}
   * Returns {root, nodes: [{addr, end, freed, kids: [{c, addr}], letter, parent, word}], cursors, stack}
   */
  TK.capture = function (P, opts) {
    const out = { root: null, nodes: [], cursors: {}, stack: [] };
    const rootName = opts.root || 'root';
    out.root = ptr(P, rootName);
    for (const n of opts.cursors || []) out.cursors[n] = ptr(P, n, 0);
    if (opts.stack) P.frames.forEach((f, fi) => { if (f.name === opts.stack.fn) out.stack.push(ptr(P, opts.stack.name, fi)); });
    let t = P.pointee(rootName);
    for (const n of opts.cursors || []) if (!t) t = P.pointee(n);
    if (!t) return out;
    const nodes = new Map();
    const queue = [out.root].concat(P.blocksOf(t));
    for (const p of Object.values(out.cursors).concat(out.stack)) if (p && P.freed(p)) queue.push(p);
    while (queue.length && nodes.size < 200) {
      const p = queue.shift();
      if (!p || nodes.has(p) || !P.vm.mem.mapped(p)) continue;
      const f = P.fields(t, p);
      const node = { addr: p, end: f.end, freed: P.freed(p), kids: [] };
      (f.child || []).forEach((q, c) => { if (q) node.kids.push({ c, addr: q }); });
      nodes.set(p, node);
      if (!node.freed) for (const k of node.kids) queue.push(k.addr);
    }
    for (const n of nodes.values()) for (const k of n.kids) { const m = nodes.get(k.addr); if (m && !n.freed) { m.letter = TK.letter(k.c); m.parent = n.addr; } }
    for (const n of nodes.values()) {
      let w = '', p = n, guard = 0;
      while (p && p.letter && guard++ < 40) { w = p.letter + w; p = nodes.get(p.parent); }
      n.word = w;
      n.inTree = !!p && p.addr === out.root;
    }
    out.nodes = [...nodes.values()];
    return out;
  };

  TK.byAddr = (data) => new Map(data.nodes.map((n) => [n.addr, n]));
  /** The words stored in the trie (or under one node), in alphabetical order */
  TK.words = function (data, from) {
    const by = TK.byAddr(data);
    const out = [];
    const go = (a, d) => { const n = by.get(a); if (!n || n.freed || d > 30) return; if (n.end && n.letter) out.push(n.word); for (const k of n.kids) go(k.addr, d + 1); };
    go(from || data.root, 0);
    return out;
  };
  /** The node reached by following a string from the root, or null */
  TK.find = function (data, s) {
    const by = TK.byAddr(data);
    let n = by.get(data.root);
    for (const ch of s) { if (!n) return null; const k = n.kids.find((x) => TK.letter(x.c) === ch); n = k ? by.get(k.addr) : null; }
    return n || null;
  };

  /**
   * Positions: leaves take the next free column, a parent sits over the middle of its children,
   * depth gives the row. Nodes not hanging from the root (just freed) sit where they were last drawn.
   */
  TK.layout = function (ctx, data, opts) {
    opts = opts || {};
    const by = TK.byAddr(data);
    const dx = opts.dx || TK.DX, dy = opts.dy || TK.DY;
    const x0 = opts.x0 || 0, y0 = opts.y0 || 0;
    const pos = new Map();
    let col = 0;
    const visit = (a, d) => {
      const n = by.get(a);
      if (!n || d > 30 || pos.has(a)) return null;
      const kids = n.freed ? [] : n.kids.slice().sort((p, q) => p.c - q.c);
      const xs = [];
      for (const k of kids) { const r = visit(k.addr, d + 1); if (r !== null) xs.push(r); }
      const x = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : x0 + (col++) * dx;
      pos.set(a, { x, y: y0 + d * dy, depth: d });
      return x;
    };
    if (data.root) visit(data.root, 0);
    const last = ctx.memo['trPos' + (opts.id || '')] || new Map();
    for (const n of data.nodes) if (!pos.has(n.addr)) pos.set(n.addr, last.get(n.addr) || { x: x0 + (col++) * dx, y: y0 + dy, depth: 1, off: true });
    ctx.memo['trPos' + (opts.id || '')] = pos;
    return pos;
  };

  /**
   * The picture: nodes and child links. opts: {nodeCls(n), edgeCls(parent, child), sub(n) -> text under
   *   the node (default: the word, for nodes that end one), rootLabel, exit}
   */
  TK.picture = function (ctx, data, opts) {
    opts = opts || {};
    const pos = opts.pos || TK.layout(ctx, data, opts);
    const by = TK.byAddr(data);
    const prev = ctx.prev && ctx.prev.data && ctx.prev.data.nodes ? TK.byAddr(ctx.prev.data) : null;
    const items = [];
    for (const n of data.nodes) {
      const p = pos.get(n.addr);
      if (!p) continue;
      const isRoot = n.addr === data.root;
      const isNew = prev && !prev.has(n.addr);
      const sub = opts.sub ? opts.sub(n) : n.end && !isRoot ? n.word : '';
      items.push({
        key: 'tn' + n.addr, kind: 'vertex', x: p.x, y: p.y, r: TK.R, text: isRoot ? (opts.rootLabel || 'root') : n.letter || '', sub: sub || '',
        cls: (isRoot ? 'tr-root ' : '') + (n.end && !isRoot ? 'tr-end ' : 'tr-plain ') + (n.freed ? 'tr-dead ' : '') + (opts.nodeCls ? opts.nodeCls(n) || '' : ''),
        enter: isNew ? 'drop' : 'fade', exit: opts.exit || 'fall', pick: true, title: (n.word ? '"' + n.word + '"' : 'root') + ' at ' + X.hex(n.addr),
      });
      if (n.freed) continue;
      for (const k of n.kids) {
        if (!pos.has(k.addr) || !by.has(k.addr)) continue;
        const changed = prev && prev.has(n.addr) && !prev.get(n.addr).kids.some((x) => x.addr === k.addr);
        items.push({ key: 'te' + k.addr, kind: 'arrow', from: { key: 'tn' + n.addr }, to: { key: 'tn' + k.addr }, cls: 'tree-edge' + (changed ? ' tr-new' : '') + (opts.edgeCls ? ' ' + (opts.edgeCls(n, by.get(k.addr)) || '') : '') });
      }
    }
    return { items, pos, by };
  };

  /** The 26 child pointers of one node as two rows of slots (a-m, n-z); probe is the slot looked at */
  TK.STRIP_W = 13 * 24;
  TK.strip = function (node, probe, o) {
    o = o || {};
    const x0 = o.x || 0, y0 = o.y || 0, w = 22, gap = 2;
    const items = [];
    const on = new Set(node ? node.kids.map((k) => k.c) : []);
    for (let c = 0; c < 26; c++) {
      const row = c < 13 ? 0 : 1, col = c % 13;
      items.push({ key: 'ts' + c, kind: 'cell', x: x0 + col * (w + gap), y: y0 + row * 30, w, h: 24, text: A[c], sub: '', cls: 'tr-slot' + (on.has(c) ? ' tr-on' : '') + (c === probe ? ' tr-probe' : '') });
    }
    items.push({ key: 'tsl', kind: 'text', x: x0 - 10, y: y0 + 32, text: o.label || 'child[]', cls: 'hp-code', anchor: 'end' });
    if (probe !== null && probe !== undefined && probe >= 0) items.push({ key: 'tsp', kind: 'text', x: x0 + TK.STRIP_W + 10, y: y0 + 32, text: 'child[' + probe + ']', cls: 'hp-hot' });
    return items;
  };

  /** A free place one row below p (for a child that is not there): no node within reach of it */
  TK.freeSpot = function (pos, p) {
    const y = p.y + TK.DY;
    for (const f of [0.6, -0.6, 1.3, -1.3, 2, -2, 2.7, -2.7, 3.4]) {
      const x = p.x + f * TK.DX;
      if (![...pos.values()].some((q) => Math.abs(q.y - y) < TK.DY / 2 && Math.abs(q.x - x) < TK.DX * 0.8)) return { x, y };
    }
    return { x: p.x + 4 * TK.DX, y };
  };
  /** A word as letter tiles; i is the current position */
  TK.tiles = function (word, i, o) {
    o = o || {};
    const x0 = o.x || 0, y0 = o.y || 0, w = 34, gap = 4;
    const items = [];
    for (let k = 0; k < word.length; k++) {
      items.push({ key: (o.key || 'tw') + k, kind: 'cell', x: x0 + k * (w + gap), y: y0, w, h: w, text: word[k], sub: o.noIndex ? '' : String(k), cls: 'tr-tile ' + (o.cls ? o.cls(k) || '' : k < i ? 'done' : k === i ? 'focus' : '') });
    }
    if (o.label) items.push({ key: (o.key || 'tw') + 'L', kind: 'text', x: x0 - 10, y: y0 + 23, text: o.label, cls: 'hp-code', anchor: 'end' });
    return items;
  };

  /** Parse and check a list of words: lowercase a-z, at most max words of at most len letters */
  TK.parseWords = (text) => String(text || '').trim().split(/[\s,]+/).filter(Boolean);
  TK.checkWords = function (text, max, len, label) {
    const w = TK.parseWords(text);
    if (w.length > max) return label + ': at most ' + max + ' words, so the trie stays readable';
    for (const x of w) {
      if (!/^[a-z]+$/.test(x)) return label + ': only the lowercase letters a to z ("' + x + '" has something else)';
      if (x.length > len) return label + ': at most ' + len + ' letters per word ("' + x + '" is longer)';
    }
    return null;
  };
})(SEE);
