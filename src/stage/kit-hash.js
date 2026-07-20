// Hash tables: a column of buckets, and for chaining, each bucket's list running to the right.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const H = X.HashKit = {};
  H.ROW = 60; H.BW = 60; H.NW = 88; H.NH = 40; H.GAP = 34;

  /** Capture a chained table: table[m] of pointers to struct entry {key; next} */
  H.captureChains = function (P, opts) {
    const m = opts.m;
    const tv = P.find(opts.table || 'table');
    const out = { buckets: [], cursors: {} };
    if (!tv) return out;
    const et = SEE.Types.unqual(tv.type).of;
    const nt = et.to;
    const heads = P.arr(opts.table || 'table', m) || [];
    for (let b = 0; b < m; b++) {
      const ch = heads[b] ? P.chain(heads[b], nt, 'next', 40) : { nodes: [] };
      out.buckets.push({ head: heads[b] || 0, nodes: ch.nodes.map((n) => ({ addr: n.addr, key: n.key, next: n.next, freed: n.freed })) });
    }
    // nodes made but not yet linked into a bucket
    out.loose = [];
    for (const a of P.blocksOf(nt)) if (!out.buckets.some((bk) => bk.nodes.some((n) => n.addr === a))) { const f = P.fields(nt, a); out.loose.push({ addr: a, key: f.key, next: f.next }); }
    for (const c of opts.cursors || []) if (P.has(c, 0)) out.cursors[c] = P.isSet(c, 0) ? P.val(c, 0) : undefined;
    return out;
  };

  /** The picture of a chained table. opts: {nodeCls(n, b), bucketCls(b), x0, y0, looseAt: {x, y}} */
  H.chains = function (ctx, d, opts) {
    opts = opts || {};
    const items = [];
    const pos = new Map();
    const x0 = opts.x0 || 0, y0 = opts.y0 || 0;
    d.buckets.forEach((bk, b) => {
      const y = y0 + b * H.ROW;
      items.push({ key: 'bk' + b, kind: 'node', x: x0, y, w: H.BW, h: H.NH, cells: [{ text: bk.head ? '' : 'NULL', port: 'p', cls: 'link' + (bk.head ? '' : ' null') }], label: '', cls: 'bucket' + (opts.bucketCls ? ' ' + (opts.bucketCls(b) || '') : '') });
      items.push({ key: 'bi' + b, kind: 'text', x: x0 - 12, y: y + H.NH / 2 + 5, text: '[' + b + ']', cls: 'idx', anchor: 'end' });
      bk.nodes.forEach((n, k) => {
        const x = x0 + H.BW + H.GAP + k * (H.NW + H.GAP);
        pos.set(n.addr, { x, y });
      });
    });
    let li = 0;
    for (const n of d.loose || []) {
      const at = opts.looseAt || { x: x0 + 230, y: y0 - 105 };
      pos.set(n.addr, { x: at.x + li * (H.NW + 20), y: at.y });
      li++;
    }
    const all = d.buckets.flatMap((bk, b) => bk.nodes.map((n) => [n, b])).concat((d.loose || []).map((n) => [n, -1]));
    const prevAddrs = ctx.prev && ctx.prev.data && ctx.prev.data.buckets ? new Set(ctx.prev.data.buckets.flatMap((bk) => bk.nodes.map((n) => n.addr)).concat((ctx.prev.data.loose || []).map((n) => n.addr))) : null;
    for (const [n, b] of all) {
      const p = pos.get(n.addr);
      items.push({ key: 'n' + n.addr, kind: 'node', x: p.x, y: p.y, w: H.NW, h: H.NH, cells: [{ text: n.key, w: 1.1, cls: 'val' }, { text: n.next ? '' : 'NULL', port: 'next', w: 0.8, cls: 'link' + (n.next ? '' : ' null') }], cls: opts.nodeCls ? opts.nodeCls(n, b) || '' : '', enter: prevAddrs && !prevAddrs.has(n.addr) ? 'drop' : 'fade', exit: 'fall', pick: true });
      if (n.next && pos.has(n.next)) items.push({ key: 'a' + n.addr, kind: 'arrow', from: { key: 'n' + n.addr, port: 'next' }, to: { key: 'n' + n.next, side: 'left' } });
    }
    d.buckets.forEach((bk, b) => { if (bk.head && pos.has(bk.head)) items.push({ key: 'ba' + b, kind: 'arrow', from: { key: 'bk' + b, port: 'p' }, to: { key: 'n' + bk.head, side: 'left' } }); });
    return { items, pos };
  };

  /** The hash box: key -> h = key % m, drawn above the table */
  H.box = function (key, m, h, opts) {
    opts = opts || {};
    const x = opts.x || -260, y = opts.y || 0;
    return [
      { key: 'hbox', kind: 'region', x, y, w: 180, h: 70, cls: 'box', text: 'hash(key)' },
      { key: 'hboxt', kind: 'text', x: x + 90, y: y + 46, text: h === null || h === undefined ? key + ' % ' + m : key + ' % ' + m + ' = ' + h, cls: 'code-text', anchor: 'middle' },
    ];
  };
})(SEE);
