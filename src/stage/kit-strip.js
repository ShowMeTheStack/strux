// Drawing helpers for the array topics (static and dynamic arrays, matrices, two pointers): values that
// keep their identity as C copies them from slot to slot, brackets over ranges, walls at boundaries.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const S = X.StripKit = {};
  S.CELL = 54; S.GAP = 8;

  /** n ints from address addr; null for a slot that was never written (or is not memory at all) */
  S.ints = function (P, addr, n) {
    const out = [];
    const T = SEE.Types.T.int;
    for (let i = 0; i < n; i++) {
      const a = addr + 4 * i;
      out.push(addr && P.vm.mem.mapped(a) && !SEE.Debug.uninit(P.vm, a, 4) ? P.read(T, a) : null);
    }
    return out;
  };
  /** A scalar variable of the newest frame, or null when it does not exist there or is not set yet */
  S.local = (P, name) => (P.has(name, 0) && P.isSet(name, 0) ? P.val(name, 0) : null);

  /**
   * Follow values through the ticks. Each slot holds an id; a slot whose value changed gets a new id,
   * and src(i) says where its value came from: a slot index, {x, y} (a point on the stage), or null.
   * Two slots that exchanged values (a swap) exchange ids instead, so the values cross over.
   * Returns {ids, from: Map(id -> slot index or {x, y}), swapped: Set(slots), wrote: Set(slots)}.
   */
  S.track = function (ctx, key, arr, src) {
    const k = 'strip:' + key;
    let m = ctx.memo[k];
    if (!m) {
      m = ctx.memo[k] = { ids: arr.map((_, i) => key + i), vals: arr.slice(), next: arr.length, tick: ctx.i, last: { from: new Map(), swapped: new Set(), wrote: new Set() } };
      return Object.assign({ ids: m.ids.slice() }, m.last);
    }
    if (m.tick === ctx.i) return Object.assign({ ids: m.ids.slice() }, m.last);
    const ids = m.ids.slice();
    while (ids.length < arr.length) ids.push(key + (m.next++));
    ids.length = arr.length;
    const out = { from: new Map(), swapped: new Set(), wrote: new Set() };
    const changed = [];
    for (let i = 0; i < arr.length; i++) if (m.vals[i] !== arr[i]) changed.push(i);
    const [p, q] = changed;
    if (changed.length === 2 && m.vals[p] === arr[q] && m.vals[q] === arr[p] && !(src && (src(p) !== null || src(q) !== null))) {
      const t = ids[p]; ids[p] = ids[q]; ids[q] = t;
      out.swapped.add(p); out.swapped.add(q);
    } else {
      for (const i of changed) {
        ids[i] = key + (m.next++);
        out.wrote.add(i);
        const s = src ? src(i) : null;
        if (s !== null && s !== undefined) out.from.set(ids[i], s);
      }
    }
    m.ids = ids; m.vals = arr.slice(); m.tick = ctx.i; m.last = out;
    return Object.assign({ ids: ids.slice() }, out);
  };

  /**
   * Cells for an array whose slots sit at pos(i) -> {x, y}.
   * opts: {pos, w, h, src(i), cls(i, v), text(i, v), sub(i), arc, exit, hotWrites (default true)}
   * Returns {items, keyOf(i), pos, tracked}.
   */
  S.cells = function (ctx, key, arr, opts) {
    const w = opts.w || S.CELL, h = opts.h || w;
    const tr = opts.tracked || S.track(ctx, key, arr, opts.src);
    const items = [];
    arr.forEach((v, i) => {
      const p = opts.pos(i);
      const id = tr.ids[i];
      const f = tr.from.get(id);
      const fp = f === undefined ? null : typeof f === 'number' ? opts.pos(f) : f;
      const wrote = tr.wrote.has(i) && opts.hotWrites !== false;
      const text = opts.text ? opts.text(i, v) : (v === null || v === undefined ? '' : v);
      items.push({
        key: 'e' + id, kind: 'cell', x: p.x, y: p.y, w, h, text: text === null || text === undefined ? '' : text,
        sub: opts.sub ? opts.sub(i) : i,
        cls: ((opts.cls ? opts.cls(i, v) || '' : '') + (wrote ? ' hot' : '') + (v === null || v === undefined ? ' empty' : '')).trim(),
        enter: fp ? 'fly' : 'grow', from: fp, arc: tr.swapped.has(i) ? (opts.arc === undefined ? 60 : opts.arc) : 0,
        exit: opts.exit || 'fade', flash: wrote || tr.swapped.has(i), pick: true,
      });
    });
    return { items, keyOf: (i) => 'e' + tr.ids[i], pos: opts.pos, tracked: tr };
  };

  /** A row layout: slot i at x0 + i * (w + gap) */
  S.row = (x0, y0, w, gap) => (i) => ({ x: x0 + i * ((w || S.CELL) + (gap === undefined ? S.GAP : gap)), y: y0 });

  /** A named pointer tag at an item (or at a free point when the key is null) */
  S.tag = (key, at, text, cls, side, slot) => ({ key, kind: 'cursor', at, side: side || 'below', slot: slot || 0, text, cls });
  S.tagAt = (key, x, y, text, cls, up) => ({ key, kind: 'cursor', x, y, tx: x, ty: up ? y - 26 : y + 26, text, cls });

  /** A bracket over (or under) x0..x1: a bar with two short ends and a label */
  S.bracket = function (key, x0, x1, y, text, cls, down) {
    const d = down ? -10 : 10;
    return [
      { key: key + '-h', kind: 'line', x1: x0, y1: y, x2: x1, y2: y, cls: 'br ' + (cls || '') },
      { key: key + '-l', kind: 'line', x1: x0, y1: y, x2: x0, y2: y + d, cls: 'br ' + (cls || '') },
      { key: key + '-r', kind: 'line', x1: x1, y1: y, x2: x1, y2: y + d, cls: 'br ' + (cls || '') },
      { key: key + '-t', kind: 'text', x: (x0 + x1) / 2, y: down ? y + 18 : y - 8, text: text || '', cls: 'br-text ' + (cls || ''), anchor: 'middle' },
    ];
  };

  /** A wall: a thick vertical (or horizontal) line with a label at one end */
  S.wall = function (key, x1, y1, x2, y2, text, cls, at) {
    const items = [{ key, kind: 'line', x1, y1, x2, y2, cls: 'wall ' + (cls || '') }];
    if (text) {
      const p = at || { x: x2, y: y2 + 16 };
      items.push({ key: key + '-t', kind: 'text', x: p.x, y: p.y, text, cls: 'wall-text ' + (cls || ''), anchor: p.anchor || 'middle' });
    }
    return items;
  };

  /** Plural helper for narration */
  S.pl = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
})(SEE);
