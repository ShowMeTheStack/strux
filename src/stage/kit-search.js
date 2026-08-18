// Drawing searches over an array: what the search still has to look at, what it has ruled out, the key it
// is looking for, and the probes it has made. The searching topics use these pieces and add their own.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const S = X.SearchKit = {};
  S.CELL = 56; S.GAP = 6;
  S.xOf = (i) => i * (S.CELL + S.GAP) + S.CELL / 2;

  /** Capture: the array, n, and the named variables of the newest frame (null when not set yet) */
  S.capture = (names, extra) => (P) => {
    const n = P.val('n');
    const fn = P.frames[0] ? P.frames[0].name : '';
    const v = {};
    for (const k of names) v[k] = P.has(k, 0) && P.isSet(k, 0) ? P.val(k, 0) : null;
    const out = { a: P.arr('a', n), n, fn, v, pos: fn === 'main' && P.has('pos') && P.isSet('pos') ? P.val('pos') : null };
    if (extra) Object.assign(out, extra(P, fn));
    return out;
  };

  /**
   * Remember the newest value of each variable, so a frame taken just after a return still knows where
   * the search was. Returns an object with the remembered values.
   */
  S.keep = function (ctx, names) {
    const m = ctx.memo.keep = ctx.memo.keep || { at: -1, v: {} };
    if (m.at !== ctx.i) {
      const v = ctx.tick.data.v || {};
      for (const k of names) if (v[k] !== null && v[k] !== undefined) m.v[k] = v[k];
      m.at = ctx.i;
    }
    return Object.assign({}, m.v);
  };

  /** The key the search is looking for: a badge at a free place */
  S.keyBadge = (key, x, y, opts) => {
    opts = opts || {};
    return { key: opts.key || 'kbadge', kind: 'token', x, y, r: opts.r || 19, text: String(key), cls: 'c-rose search-key' + (opts.cls ? ' ' + opts.cls : '') };
  };

  /** An outline bracket around slots lo..hi (cells), with a label under its top edge */
  S.bracket = (key, lo, hi, text, opts) => {
    opts = opts || {};
    if (lo === null || hi === null || lo === undefined || hi === undefined || hi < lo) return [];
    const x0 = lo * (S.CELL + S.GAP) - 7, x1 = hi * (S.CELL + S.GAP) + S.CELL + 7;
    const y0 = (opts.y0 === undefined ? 0 : opts.y0) - 8;
    return [{ key, kind: 'region', x: x0, y: y0, w: x1 - x0, h: (opts.h || S.CELL + 16), cls: 'bracket ' + (opts.cls || ''), text: '' }].concat(text ? [{ key: key + 't', kind: 'text', x: (x0 + x1) / 2, y: y0 - 8, text, cls: 's-bracket ' + (opts.cls || ''), anchor: 'middle' }] : []);
  };

  /** Bars with a fixed scale (so a key line can be drawn on the same scale), via the array kit */
  S.bars = function (ctx, arr, opts) {
    const view = X.ArrayKit.bars(ctx, arr, opts);
    const max = opts.max, hMax = opts.height || 220;
    for (const it of view.items) if (it.kind === 'bar' && typeof it.text === 'number') it.h = Math.max(4, it.text / max * hMax);
    view.yOf = (v) => (opts.base === undefined ? 260 : opts.base) - v / max * hMax;
    return view;
  };

  /** A row of small verdict chips under the cells: text and class per index (null leaves the slot blank) */
  S.chips = (n, y, f, prefix) => {
    const items = [];
    for (let i = 0; i < n; i++) {
      const c = f(i);
      if (!c) continue;
      items.push({ key: (prefix || 'chip') + i, kind: 'region', x: S.xOf(i) - 22, y, w: 44, h: 24, cls: 'chip ' + (c.cls || ''), text: '' });
      items.push({ key: (prefix || 'chip') + 't' + i, kind: 'text', x: S.xOf(i), y: y + 17, text: c.text, cls: 's-chip ' + (c.cls || ''), anchor: 'middle' });
    }
    return items;
  };

  /** A camera that frames n cells tightly (the stage's own framing leaves wide margins) */
  S.view = (n, top, bottom, left, right) => {
    let x0 = left === undefined ? -30 : left;
    let x1 = n * (S.CELL + S.GAP) - S.GAP + (right === undefined ? 30 : right);
    if (x1 - x0 < 600) { const c = (x0 + x1) / 2; x0 = c - 300; x1 = c + 300; }
    return { x: x0, y: top, w: x1 - x0, h: bottom - top };
  };

  /** log2 helpers for "at most this many guesses" */
  S.maxGuesses = (n) => (n < 1 ? 0 : Math.floor(Math.log2(n)) + 1);
  S.list = (xs) => xs.join(', ');
})(SEE);
