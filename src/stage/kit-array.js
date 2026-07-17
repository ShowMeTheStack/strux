// Drawing arrays: as a row of cells or as bars. Elements keep an identity from tick to tick, so a swap
// shows the two values crossing over, a copy shows the value flying to its new place, and a value that
// gets overwritten leaves.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const A = X.ArrayKit = {};
  A.CELL = 56; A.GAP = 6;

  /**
   * Follow the elements of an array through the ticks: returns ids (one per slot) and, for this tick,
   * what moved: {ids, moves: [{id, from, to}], swaps: [[a, b]], wrote: Set(slots)}.
   * key names the array (several arrays in one topic each have their own).
   */
  A.track = function (ctx, key, arr) {
    const memo = ctx.memo;
    const k = 'track:' + key;
    let m = memo[k];
    if (!m) {
      m = memo[k] = { ids: arr.map((_, i) => key + ':' + i), vals: arr.slice(), next: arr.length, tick: ctx.i, last: { swaps: [], wrote: new Set(), copies: [] } };
      return Object.assign({ ids: m.ids.slice() }, m.last);
    }
    if (m.tick === ctx.i) return Object.assign({ ids: m.ids.slice() }, m.last);
    const prev = m.vals, ids = m.ids.slice();
    while (ids.length < arr.length) ids.push(key + ':' + (m.next++));
    ids.length = arr.length;
    const out = { swaps: [], wrote: new Set(), copies: [] };
    const changed = [];
    for (let i = 0; i < arr.length; i++) if (prev[i] !== arr[i]) changed.push(i);
    if (changed.length === 2 && prev[changed[0]] === arr[changed[1]] && prev[changed[1]] === arr[changed[0]]) {
      // a swap: the two values cross over
      const [a, b] = changed;
      const t = ids[a]; ids[a] = ids[b]; ids[b] = t;
      out.swaps.push([a, b]);
    } else {
      for (const i of changed) {
        out.wrote.add(i);
        // a value copied from another slot flies over from there
        const src = prev.findIndex((v, j) => v === arr[i] && j !== i && arr[i] !== null);
        ids[i] = key + ':' + (m.next++);
        if (src >= 0) out.copies.push({ id: ids[i], from: src, to: i });
      }
    }
    m.ids = ids; m.vals = arr.slice(); m.tick = ctx.i; m.last = out;
    return Object.assign({ ids: ids.slice() }, out);
  };

  /**
   * Cells for an array. opts: {x0, y0, cls(i, v) -> classes, sub(i) -> text under the cell (default index),
   *   key, cell (width), hide(i) -> true to leave a slot empty (shown as a gap), tracked: result of track()}
   */
  A.cells = function (ctx, arr, opts) {
    opts = opts || {};
    const key = opts.key || 'a';
    const tr = opts.tracked || A.track(ctx, key, arr);
    const w = opts.cell || A.CELL, gap = opts.gap === undefined ? A.GAP : opts.gap;
    const x0 = opts.x0 || 0, y0 = opts.y0 || 0;
    const items = [];
    arr.forEach((v, i) => {
      const id = tr.ids[i];
      const copy = tr.copies.find((c) => c.id === id);
      const swapped = tr.swaps.some((s) => s.includes(i));
      items.push({
        key: 'e' + id, kind: 'cell', x: x0 + i * (w + gap), y: y0, w, h: w, text: v === null || v === undefined ? '' : (opts.fmt ? opts.fmt(v, i) : v),
        sub: opts.sub ? opts.sub(i) : i, cls: (opts.cls ? opts.cls(i, v) || '' : '') + (v === null || v === undefined ? ' empty' : '') + (tr.wrote.has(i) ? ' hot' : ''),
        arc: swapped ? (opts.arc === undefined ? 70 : opts.arc) : 0, enter: copy ? 'fly' : 'grow', from: copy ? { x: x0 + copy.from * (w + gap), y: y0 - 50 } : null, exit: 'fade', flash: swapped || tr.wrote.has(i), pick: true,
      });
      // the slot itself: a faint frame so empty places show
      if (opts.slots) items.push({ key: key + 'slot' + i, kind: 'region', x: x0 + i * (w + gap) - 2, y: y0 - 2, w: w + 4, h: w + 4, cls: 'frame' });
    });
    return { items, tracked: tr, xOf: (i) => x0 + i * (w + gap) + w / 2, keyOf: (i) => 'e' + tr.ids[i] };
  };

  /** Bars for an array of numbers: heights scale to the largest value */
  A.bars = function (ctx, arr, opts) {
    opts = opts || {};
    const key = opts.key || 'a';
    const tr = opts.tracked || A.track(ctx, key, arr);
    const w = opts.bar || 40, gap = opts.gap === undefined ? 8 : opts.gap;
    const x0 = opts.x0 || 0, base = opts.base === undefined ? 260 : opts.base;
    const max = Math.max(1, ...arr.filter((v) => typeof v === 'number').map((v) => Math.abs(v)));
    const hMax = opts.height || 220;
    const items = [];
    arr.forEach((v, i) => {
      const id = tr.ids[i];
      const copy = tr.copies.find((c) => c.id === id);
      const swapped = tr.swaps.some((s) => s.includes(i));
      items.push({
        key: 'e' + id, kind: 'bar', x: x0 + i * (w + gap), y: base, w, h: v === null || v === undefined ? 0 : Math.max(4, Math.abs(v) / max * hMax), text: v === null || v === undefined ? '' : v,
        cls: (opts.cls ? opts.cls(i, v) || '' : '') + (tr.wrote.has(i) ? ' hot' : ''), arc: swapped ? 60 : 0, enter: copy ? 'fly' : 'grow',
        from: copy ? { x: x0 + copy.from * (w + gap), y: base } : null, flash: swapped, pick: true,
      });
      items.push({ key: key + 'ix' + i, kind: 'text', x: x0 + i * (w + gap) + w / 2, y: base + 34, text: String(i), cls: 'idx', anchor: 'middle' });
    });
    return { items, tracked: tr, xOf: (i) => x0 + i * (w + gap) + w / 2, keyOf: (i) => 'e' + tr.ids[i] };
  };

  /** Index markers: {name: index} drawn as tags under (or over) the element at that index */
  A.markers = function (view, marks, opts) {
    opts = opts || {};
    const items = [];
    const slots = new Map();
    for (const [name, idx] of Object.entries(marks)) {
      if (idx === null || idx === undefined) continue;
      const s = slots.get(idx) || 0;
      slots.set(idx, s + 1);
      const k = view.keyOf(idx);
      if (k && !/undefined/.test(k)) items.push({ key: 'm' + (opts.prefix || '') + name, kind: 'cursor', at: k, side: opts.side || 'below', slot: s, text: name, cls: X.ListKit.cursorCls(name) });
      else {
        // an index past the end: a free-standing tag where that slot would be
        items.push({ key: 'm' + (opts.prefix || '') + name, kind: 'cursor', x: view.xOf(idx), y: (opts.y || 0) + (opts.side === 'above' ? -10 : 74), text: name, cls: X.ListKit.cursorCls(name) });
      }
    }
    return items;
  };

  /** A shaded band behind slots lo..hi (inclusive) */
  A.range = function (view, key, lo, hi, cls, text, opts) {
    opts = opts || {};
    if (lo === null || hi === null || hi < lo) return [];
    const w = opts.cell || A.CELL;
    const x0 = view.xOf(lo) - w / 2 - 6, x1 = view.xOf(hi) + w / 2 + 6;
    return [{ key, kind: 'region', x: x0, y: (opts.y0 || 0) - 10 - (opts.top || 0), w: x1 - x0, h: (opts.h || w + 20) + (opts.top || 0), cls: cls || 'part-b', text: text || '' }];
  };
})(SEE);
