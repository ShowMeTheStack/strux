// Drawing helpers for stacks, queues and deques: the list of operations main will carry out (drawn as
// a script of chips), which of them is running, a tray for the values taken out, and an invisible
// extent that keeps the camera still while a pile grows and shrinks.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const S = X.StackKit = {};

  /** "+5 +8 -" into [{op: 'add', v}, {op: 'take'}] (the same syntax as the circular queue) */
  S.parse = (text) => String(text || '').trim().split(/[\s,]+/).filter(Boolean).map((t) => {
    const m = /^([+-])(-?\d+)?$/.exec(t);
    if (!m) throw new Error('"' + t + '" is not an operation: use +5 to add 5, and - to take one out');
    if (m[1] === '-' && m[2] !== undefined) throw new Error('"' + t + '": a minus sign alone takes one out; to add a negative number write +' + t);
    return m[1] === '+' ? { op: 'add', v: +(m[2] === undefined ? 0 : m[2]) } : { op: 'take' };
  });
  /** A text input for such operations */
  S.opsInput = (def, label, max) => ({
    id: 'ops', kind: 'text', label: label || 'Operations (+5 adds 5, - takes one)', def,
    check: (v) => {
      let o;
      try { o = S.parse(v); } catch (e) { return e.message; }
      if (!o.length) return 'Operations: give at least one';
      if (o.length > (max || 12)) return 'Operations: at most ' + (max || 12) + ', so the picture stays readable';
      if (o.some((x) => x.op === 'add' && Math.abs(x.v) > 999)) return 'Operations: values from -999 to 999';
      return null;
    },
  });

  /** Which operation of main's list is running at this tick: the number of calls that have returned */
  S.opIndex = (ctx) => {
    const m = ctx.memo;
    if (m.opAt !== ctx.i) {
      // ticks come in order, so count 'after' ticks as they go by
      if (m.opCount === undefined) m.opCount = 0;
      if (ctx.prev && ctx.prev.tag === 'after' && m.opAt === ctx.i - 1) m.opCount++;
      m.opAt = ctx.i;
    }
    return m.opCount;
  };

  /**
   * The script: one chip per operation, the running one lit, the finished ones faded.
   * opts: {x0, y0, w, label(op) -> text, result(k) -> text under a finished chip, bad(k) -> true to show it in red, title}
   */
  S.script = (ops, cur, opts) => {
    opts = opts || {};
    const w = opts.w || 46, gap = 5, x0 = opts.x0 || 0, y0 = opts.y0 || 0;
    const items = [];
    if (opts.title !== false) items.push({ key: 'scr-t', kind: 'text', x: x0 - 10, y: y0 + 21, text: opts.title || 'main:', cls: 'sk-title', anchor: 'end' });
    ops.forEach((o, k) => {
      const text = opts.label ? opts.label(o) : (o.op === 'add' ? '+' + o.v : '−');
      items.push({ key: 'scr' + k, kind: 'node', x: x0 + k * (w + gap), y: y0, w, h: 30, cells: [{ text, cls: 'val' }], cls: 'sk-chip' + (k === cur ? ' sk-now' : k < cur ? ' sk-past' : '') });
      const r = opts.result && k < cur ? opts.result(k) : '';
      if (r !== '' && r !== null && r !== undefined) items.push({ key: 'scr-r' + k, kind: 'text', x: x0 + k * (w + gap) + w / 2, y: y0 + 46, text: String(r), cls: 'sk-res' + (opts.bad && opts.bad(k) ? ' bad' : ''), anchor: 'middle' });
    });
    return items;
  };

  /** An invisible box that the camera always includes, so it does not zoom as things come and go */
  S.extent = (x, y, w, h) => ({ key: 'sk-extent', kind: 'region', x, y, w, h, cls: 'sk-extent' });

  /** A char code as a printable character */
  S.ch = (c) => (c === null || c === undefined || c === 0 ? '' : String.fromCharCode(c));
  /** A C string read from an array of char codes */
  S.str = (arr) => { let s = ''; for (const c of arr || []) { if (!c) break; s += String.fromCharCode(c); } return s; };
  S.plural = (n, word, many) => n + ' ' + (n === 1 ? word : (many || word + 's'));
})(SEE);
