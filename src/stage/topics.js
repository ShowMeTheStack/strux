// Families and topics. A family holds what its programs share (the struct, helpers, main's command
// loop). A topic is one operation with its own C function, its own scene (how it is drawn and
// animated), its own narration, predictions and quiz.
(function (SEE) {
  'use strict';
  const X = SEE.Strux = SEE.Strux || {};
  X.families = [];
  X.topics = [];
  X.groups = [];

  /**
   * family: {id, group, title, blurb, head: C code before the operation, main(topic, input) -> C main,
   *          kit: drawing helpers shared by its topics}
   */
  X.GROUP_ORDER = ['Arrays', 'Linked lists', 'Stacks and queues', 'Searching', 'Sorting', 'Hashing', 'Trees', 'Balanced trees', 'Heaps and tries', 'Graphs'];
  X.family = function (f) {
    if (X.families.some((x) => x.id === f.id)) return;
    X.families.push(f);
    if (!X.groups.includes(f.group)) X.groups.push(f.group);
    const rank = (g) => { const i = X.GROUP_ORDER.indexOf(g); return i < 0 ? 99 : i; };
    X.groups.sort((a, b) => rank(a) - rank(b));
    X.families.sort((a, b) => rank(a.group) - rank(b.group) || (a.order || 0) - (b.order || 0));
  };
  /**
   * topic: {id, family, title, blurb, code: the C function(s) shown and animated, animate: [names],
   *   inputs: [{id, kind: 'ints'|'int'|'text'|'graph'|'choice', label, def, min, max, options}],
   *   presets: [{label, values}], stdin(input) -> text, mainCall(input) -> C statements in main,
   *   capture(P, t) -> data, scene(ctx) -> {items, say, ...} for each tick,
   *   predict: [{at(tick, i, ticks) -> bool, ask, answer(ticks, i) -> key|text, options?}],
   *   quiz: [{q, options, answer, why}] }
   */
  X.topic = function (t) {
    if (X.topics.some((x) => x.id === t.id)) throw new Error('two topics with id ' + t.id);
    X.topics.push(t);
    // within a family, topics are listed by order (then in the order they were written)
    const n = X.topics.map((x, k) => [x, k]);
    n.sort((a, b) => (a[0].order === undefined ? 500 : a[0].order) - (b[0].order === undefined ? 500 : b[0].order) || a[1] - b[1]);
    X.topics.length = 0;
    for (const [x] of n) X.topics.push(x);
  };
  X.byId = (id) => X.topics.find((t) => t.id === id) || null;
  X.familyOf = (t) => X.families.find((f) => f.id === t.family) || null;

  /** The full C program for a topic and an input: the family's head, the topic's functions, main */
  X.program = function (t, input) {
    const f = X.familyOf(t);
    const parts = [];
    if (f && f.head) parts.push(typeof f.head === 'function' ? f.head(t, input) : f.head);
    parts.push(typeof t.code === 'function' ? t.code(input) : t.code);
    if (t.main) parts.push(t.main(input));
    else if (f && f.main) parts.push(f.main(t, input));
    return parts.map((p) => p.replace(/^\n+|\s+$/g, '')).join('\n\n') + '\n';
  };

  /** The value given for each input, or its default */
  X.inputOf = function (t, given) {
    const o = {};
    for (const i of t.inputs || []) o[i.id] = given && given[i.id] !== undefined ? given[i.id] : (typeof i.def === 'function' ? i.def() : i.def);
    return o;
  };

  /** Check an input against the topic's limits; returns an error message or null */
  X.checkInput = function (t, input) {
    for (const i of t.inputs || []) {
      const v = input[i.id];
      if (i.kind === 'ints') {
        if (!Array.isArray(v)) return i.label + ': give a list of whole numbers';
        if (i.max !== undefined && v.length > i.max) return i.label + ': at most ' + i.max + ' values, so the picture stays readable';
        if (i.min !== undefined && v.length < i.min) return i.label + ': at least ' + i.min + ' value' + (i.min === 1 ? '' : 's');
        if (v.some((x) => !Number.isInteger(x) || Math.abs(x) > 999)) return i.label + ': whole numbers from -999 to 999';
        if (i.distinct && new Set(v).size !== v.length) return i.label + ': each value only once';
        if (i.sorted && v.some((x, k) => k && v[k - 1] > x)) return i.label + ': in increasing order';
      }
      if (i.kind === 'int') {
        if (!Number.isInteger(v)) return i.label + ': a whole number';
        if (i.lo !== undefined && v < i.lo) return i.label + ': at least ' + i.lo;
        if (i.hi !== undefined && v > i.hi) return i.label + ': at most ' + i.hi;
      }
      if (i.check) { const e = i.check(v, input); if (e) return e; }
    }
    if (t.check) return t.check(input);
    return null;
  };

  /** Record a topic with an input and turn every tick into a frame */
  X.run = function (t, input) {
    const code = X.program(t, input);
    const rec = X.record({ code, animate: t.animate, quiet: t.quiet, capture: t.capture, input: t.stdin ? t.stdin(input) : '', limit: t.limit });
    if (!rec.ok) return { ok: false, errors: rec.errors, code };
    const f = X.familyOf(t);
    const ctx = { topic: t, family: f, input, ticks: rec.ticks, rec, memo: {} };
    const frames = [];
    const counters = { compares: 0, swaps: 0, moves: 0, follows: 0, allocs: 0, frees: 0, writes: 0 };
    for (let i = 0; i < rec.ticks.length; i++) {
      const tk = rec.ticks[i];
      for (const e of tk.events) { if (e.kind === 'malloc') counters.allocs++; if (e.kind === 'free') counters.frees++; if (e.kind === 'write') counters.writes++; }
      if (/^(compare|cmp|test-key|probe)/.test(tk.tag)) counters.compares++;
      if (/^swap/.test(tk.tag)) counters.swaps++;
      if (/^(move|shift|copy|place)/.test(tk.tag)) counters.moves++;
      if (/^(follow|walk|advance|step)/.test(tk.tag)) counters.follows++;
      ctx.i = i;
      ctx.tick = tk;
      ctx.prev = i ? rec.ticks[i - 1] : null;
      ctx.counters = Object.assign({}, counters);
      let fr;
      try { fr = t.scene(ctx) || {}; } catch (e) { fr = { items: [], say: 'This step could not be drawn: ' + e.message, error: e }; }
      if (!fr.say && tk.end) fr.say = 'The end of ' + tk.fn + '(): it returns to its caller.';
      fr.line = tk.line;
      fr.calls = tk.calls || fr.calls || [];
      fr.mem = tk.mem || null;
      fr.counters = ctx.counters;
      fr.tag = tk.tag;
      fr.depth = tk.depth;
      frames.push(fr);
    }
    // predict points
    for (const p of t.predict || []) {
      for (let i = 0; i < frames.length - 1; i++) {
        let hit = false;
        try { hit = p.at(rec.ticks[i], i, rec.ticks, ctx); } catch (e) { hit = false; }
        if (!hit) continue;
        let q;
        try {
          q = { ask: typeof p.ask === 'function' ? p.ask(rec.ticks[i], rec.ticks, i, ctx) : p.ask, answer: p.answer(rec.ticks, i, ctx), options: p.options ? p.options(rec.ticks, i, ctx) : null, explain: p.explain ? p.explain(rec.ticks, i, ctx) : null, pick: p.pick || 'node' };
        } catch (e) { q = null; }
        if (!q || q.answer === null || q.answer === undefined) continue;
        frames[i].predict = q;
        if (p.once) break;
      }
    }
    return { ok: true, frames, rec, code: rec.clean, output: rec.output, fault: rec.fault, state: rec.state, ctx };
  };
})(SEE);
